// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// The Firestore reads of scripts/firebase/firestore.js and scripts/biomesh.js, against an in-memory Firestore
// (tests/unit/support/firestore-fake.mjs; the Firebase SDK is stubbed). Run from the repository root:
//   node --test tests/unit/biomesh-services.test.mjs
//
// - getDocument, queryCollection and watchDocument give each document with `id` set to its document id, also when
//   its data has a field named id; queryDocuments gives the document id and the data side by side.
// - listBiochainsPage pages by the document ids of the query snapshot: 30 records in pages of 25 are each read once,
//   in two queries, whatever `id` field the 25th record's data carries ("0", a later document id, a number, null),
//   and that field is reported in dataIds. The strict audit (mage_tower/Biomesh_Audit.html) pages this way.
// - traceBiochain returns verifyIntegrity's own result as selfCheck. With STRICT_ENFORCE off it is `integrity`; with
//   it on (biomesh.js loaded with the flag set) `integrity` fails for a strict failure while selfCheck still passes,
//   so the label (decision D15) stays "self-consistent only, failed at <check>". The Console labels the trace with it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stubFirebase } from "./support/firebase-stub.mjs";
import { installFirestoreFake } from "./support/firestore-fake.mjs";
import { flipPacketBit, refixParity } from "./support/tamper.mjs";

const ROOT = resolve(process.env.OWL_TEST_ROOT || fileURLToPath(new URL("../..", import.meta.url)));
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
stubFirebase(ROOT);
const C = await import(pathToFileURL(join(ROOT, "scripts/biomesh-core.js")).href);
const FS = await import(pathToFileURL(join(ROOT, "scripts/firebase/firestore.js")).href);
const BM = await import(pathToFileURL(join(ROOT, "scripts/biomesh.js")).href);

const TEXT = ("The owl keeps the tome by lamplight; café, naïve, 中文 and \u{1F989} share the shelf. Rain on the tower, " +
  "stars over the spire; the fox keeps the lantern. ").repeat(14);

/** scripts/biomesh.js with STRICT_ENFORCE set to true; its imports load the same modules as BM's. */
async function enforcingBiomesh() {
  const dir = pathToFileURL(join(ROOT, "scripts")).href + "/";
  const src = read("scripts/biomesh.js");
  const flag = /^export const STRICT_ENFORCE = false;$/m;
  assert.match(src, flag);
  const patched = src.replace(flag, "export const STRICT_ENFORCE = true;").replace(/(\bfrom\s*|\bimport\s*\(\s*)"\.\//g, `$1"${dir}`);
  return import("data:text/javascript;base64," + Buffer.from(patched).toString("base64"));
}

test("firestore.js rows carry the document id, whatever id field the data holds", async (t) => {
  const fake = installFirestoreFake({ "things/a": { id: "z", n: 1 }, "things/b": { n: 2 }, "things/c": { id: 7, n: 3 } });
  t.after(fake.uninstall);
  assert.deepEqual(await FS.getDocument("things/a"), { id: "a", n: 1 });
  assert.deepEqual(await FS.getDocument("things/b"), { id: "b", n: 2 });
  assert.equal(await FS.getDocument("things/none"), null);
  const byId = [FS.orderBy(FS.documentId())];
  assert.deepEqual(await FS.queryCollection("things", byId), [{ id: "a", n: 1 }, { id: "b", n: 2 }, { id: "c", n: 3 }]);
  assert.deepEqual(await FS.queryDocuments("things", byId),
    [{ id: "a", data: { id: "z", n: 1 } }, { id: "b", data: { n: 2 } }, { id: "c", data: { id: 7, n: 3 } }]);
  const seen = [];
  FS.watchDocument("things/c", (d) => seen.push(d));
  FS.watchDocument("things/none", (d) => seen.push(d));
  assert.deepEqual(seen, [{ id: "c", n: 3 }, null]);
});

test("listBiochainsPage pages by the snapshot's document ids, whatever id field a record carries", async () => {
  const rec = await C.growBiochain("The owl keeps the tome by lamplight.", { engrams: false });
  for (const dataId of ["0", "BC-x28", 7, null, "BC-x24"]) {
    const docs = {};
    for (let i = 0; i < 30; i++) docs[`biochains/BC-x${String(i).padStart(2, "0")}`] = { ...rec, title: `copy ${i}` };
    docs["biochains/BC-x24"].id = dataId;            // the last record of the first page
    const fake = installFirestoreFake(docs);
    try {
      const seen = [], dataIds = [];
      let after = null, queries = 0;
      for (;;) {
        const page = await BM.listBiochainsPage(25, after);
        assert.ok(++queries <= 3, `${dataId}: the paging ends`);
        for (const r of page.records) {
          seen.push(r.id);
          assert.equal(r.title, `copy ${Number(r.id.slice(4))}`, `${dataId}: ${r.id} is that document's record`);
        }
        dataIds.push(...page.dataIds);
        assert.equal(page.lastId, page.records.length ? page.records.at(-1).id : null);
        if (page.records.length < 25 || page.lastId === null) break;
        after = page.lastId;
      }
      assert.deepEqual(seen, Object.keys(docs).map((k) => k.slice("biochains/".length)).sort(), `${dataId}: every record once`);
      assert.equal(queries, 2, `${dataId}: two page queries`);
      assert.deepEqual(dataIds, dataId === "BC-x24" ? [] : [["BC-x24", dataId]], `${dataId}: reported`);
    } finally { fake.uninstall(); }
  }
  const audit = read("mage_tower/Biomesh_Audit.html");
  assert.match(audit, /after = page\.lastId;/, "the audit's cursor is the snapshot's last document id");
  assert.match(audit, /auditRecord\(doc, page\.dataIds\.get\(doc\.id\)\)/);
});

test("traceBiochain returns verifyIntegrity's result as selfCheck, with STRICT_ENFORCE off and on", async (t) => {
  const honest = await C.growBiochain(TEXT, { engrams: false });
  const frames = C.parseBiochainStreamStrict(honest.stream);
  frames[1].packet = refixParity(flipPacketBit(frames[1].packet, 30));         // T2: a crystal bit, parity fixed
  const t2 = { ...honest, stream: C.frameStream(frames.map((f) => f.packet), frames.map((f) => f.residual)) };
  const fake = installFirestoreFake({ "biochains/HONEST": honest, "biochains/T2": t2 });
  t.after(fake.uninstall);
  const label = "self-consistent only, failed at crystal";

  assert.equal(BM.STRICT_ENFORCE, false);
  const shadow = await BM.traceBiochain("T2");
  assert.equal(shadow.strict.failed, "crystal");
  assert.equal(shadow.selfCheck.ok, true);
  assert.equal(shadow.integrity, shadow.selfCheck, "shadow mode: integrity is the self-consistency check");
  assert.equal(BM.strictLabel(shadow.strict, shadow.selfCheck.ok), label);

  const E = await enforcingBiomesh();
  assert.equal(E.STRICT_ENFORCE, true);
  assert.equal(E.verifyIntegrityStrict, BM.verifyIntegrityStrict, "the same core");
  const enforced = await E.traceBiochain("T2");
  assert.equal(enforced.integrity.ok, false, "enforced: a strict failure fails integrity");
  assert.equal(enforced.integrity.reasons[0], `strict check: ${label}`);
  assert.equal(enforced.selfCheck.ok, true, "enforced: selfCheck is still verifyIntegrity's verdict");
  assert.equal(E.strictLabel(enforced.strict, enforced.selfCheck.ok), label);
  const ok = await E.traceBiochain("HONEST");
  assert.equal(ok.strict.ok, true);
  assert.equal(ok.integrity, ok.selfCheck);

  assert.match(read("mage_tower/Biomesh_Console.html"), /BM\.strictLabel\(sv, tr\.selfCheck\.ok\)/,
    "the Console labels the trace with selfCheck");
});
