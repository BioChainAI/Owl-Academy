// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// scripts/biomesh-core.js: the Firebase-free half of scripts/biomesh.js. Run from the repository root:
//   node --test tests/unit/biomesh-core.test.mjs
//
// - The move kept every function: each top-level declaration of biomesh.js at 7f45f35 has the same text at HEAD,
//   in biomesh-core.js or in biomesh.js (tests/unit/fixtures/biomesh-7f45f35.json; rebuilt from git history when
//   the commit is present, and required to be present when OWL_REQUIRE_HISTORY=1).
// - The core imports only sha256Hex from seal-crypto.js; biomesh.js re-exports the core, and every re-export is the
//   same function object (biomesh.js is imported with the Firebase SDK stubbed, tests/unit/support/).
// - Goldens: crystallizeGolden() = 9841D88D8B003CEA and the GEODESIC engram key 5C896A4801C9C24C.
// - Grow and recreate round trips, growth epochs, codex derivation, seeds.
// - The 13 texts of the Hyperbolic Lexicon's biomesh_compat_v1.json (tests/vendor/biomesh-compat-v1/) give the
//   pinned records, engrams off and on: chainId, merkleRoot, value, and the SHA-256 of the whole record as
//   JSON.stringify writes it (all fields, the weaves included); verifyIntegrity accepts each and it recreates the text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { declarations, exportNames, sha256, table } from "./support/declarations.mjs";
import { stubFirebase } from "./support/firebase-stub.mjs";

const ROOT = resolve(process.env.OWL_TEST_ROOT || fileURLToPath(new URL("../..", import.meta.url)));
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const CORE_SRC = read("scripts/biomesh-core.js");
const BIO_SRC = read("scripts/biomesh.js");
const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/biomesh-7f45f35.json", import.meta.url), "utf8"));
// Imported here so that a core which cannot load in Node (say, one that imports Firebase) still lets the import
// checks below report why; every test that runs the core fails with the import error.
let Core = null, coreError = null;
try { Core = await import(pathToFileURL(join(ROOT, "scripts/biomesh-core.js")).href); } catch (e) { coreError = e; }
const core = () => { if (coreError) throw coreError; return Core; };

// Additions at HEAD: the two exports BioChain-AI's copy carries, and the core's SC = { sha256Hex }.
const ADDED_TO_CORE = ["SC", "crystallizeGolden", "engramHex"];
// What stays in biomesh.js: Firestore reads and writes, and the checks that read the seal registry (verifySealBlock
// in minor-tome.js reads Firestore): verifyGrowth, verifyGrown, verifyPair, traceBiochain.
const KEPT = ["verifyGrowth", "publishBiochain", "verifyGrown", "listBiochains", "getBiochain", "setListing",
  "publishCodex", "getCodex", "pairCodex", "verifyPair", "sendBiochain", "acceptBiochain", "declineBiochain",
  "listIncoming", "listTransfersForChain", "listAllTransfers", "logSessionBurn", "traceBiochain", "TIER_WEIGHT",
  "rateBiochain", "listRatings", "successScore"];

// ---------------------------------------------------------------- the move

test("the core imports only sha256Hex from seal-crypto.js, which imports nothing", () => {
  assert.deepEqual(declarations(CORE_SRC).imported, [{ names: ["sha256Hex"], from: "./seal-crypto.js" }]);
  // Any other static import, however written, and any dynamic import() would load another module.
  assert.deepEqual(CORE_SRC.match(/^[ \t]*import\b(?!\s*\()/gm), ["import"], "one import statement");
  assert.doesNotMatch(CORE_SRC, /\bimport\s*\(/, "no dynamic import()");
  assert.doesNotMatch(CORE_SRC, /^\s*export\s+(\*|\{)[^;]*from/m, "the core re-exports nothing");
  assert.doesNotMatch(read("scripts/seal-crypto.js"), /^\s*(import|export\s+(\*|\{)[^;]*from)\b/m);
});

test("biomesh.js imports the core, re-exports all of it and declares only the Firestore-bound functions", () => {
  assert.match(BIO_SRC, /^export \* from "\.\/biomesh-core\.js";$/m);
  const bio = declarations(BIO_SRC);
  assert.deepEqual([...bio.keys()], KEPT);
  const fromCore = bio.imported.find((i) => i.from === "./biomesh-core.js");
  assert.ok(fromCore, "biomesh.js imports the names it calls from the core");
  for (const n of fromCore.names) assert.ok(n in core(), `${n} is exported by the core`);
  for (const n of ["verifyGrowth", "verifyGrown", "verifyPair"]) assert.ok(!declarations(CORE_SRC).has(n), `${n} is not in the core`);
});

test("every declaration of biomesh.js at 7f45f35 has the same text at HEAD, in exactly one of the two files", () => {
  const inCore = declarations(CORE_SRC), inBio = declarations(BIO_SRC);
  for (const [name, want] of Object.entries(FIXTURE.declarations)) {
    const hits = [["biomesh-core.js", inCore.get(name)], ["biomesh.js", inBio.get(name)]].filter(([, d]) => d);
    assert.equal(hits.length, 1, `${name} is declared in ${hits.map(([f]) => f).join(" and ") || "neither file"}`);
    const [file, got] = hits[0];
    assert.equal(got.kind, want.kind, `${name} (${file}) kind`);
    assert.equal(got.sha256, want.sha256, `${name} (${file}) has a different text than at 7f45f35`);
  }
  const extra = [...inCore.keys(), ...inBio.keys()].filter((n) => !(n in FIXTURE.declarations));
  assert.deepEqual(extra.sort(), [...ADDED_TO_CORE].sort());
  assert.ok(ADDED_TO_CORE.every((n) => inCore.has(n)));
});

test("the 7f45f35 table is rebuilt from git history", (t) => {
  let src = null;
  try {
    execFileSync("git", ["-C", ROOT, "cat-file", "-e", `${FIXTURE.commit}^{commit}`], { stdio: "ignore" });
    src = execFileSync("git", ["-C", ROOT, "show", `${FIXTURE.commit}:${FIXTURE.file}`], { maxBuffer: 64 << 20 });
  } catch {
    if (process.env.OWL_REQUIRE_HISTORY === "1") assert.fail(`commit ${FIXTURE.commit} is not in this clone (fetch-depth 0 needed)`);
    t.skip(`commit ${FIXTURE.commit.slice(0, 7)} is not in this clone; the recorded table is used`);
    return;
  }
  assert.equal(sha256(src), FIXTURE.sha256);
  const text = src.toString("utf8");
  assert.deepEqual(table(declarations(text)), FIXTURE.declarations);
  assert.deepEqual(exportNames(text), FIXTURE.exports);
});

test("biomesh.js exports what it exported at 7f45f35 plus the two additions, the core's as the same objects", async () => {
  stubFirebase(ROOT);
  const BM = await import(pathToFileURL(join(ROOT, "scripts/biomesh.js")).href);
  for (const n of FIXTURE.exports) assert.ok(n in BM, `${n} is still exported`);
  assert.deepEqual(Object.keys(BM).sort(), [...FIXTURE.exports, "crystallizeGolden", "engramHex"].sort());
  assert.ok(Object.keys(core()).length > 0);
  for (const n of Object.keys(core())) assert.equal(BM[n], core()[n], `${n} re-exported as the same object`);
  for (const n of Object.keys(BM)) if (!(n in core())) assert.ok(KEPT.includes(n), `${n} is one of biomesh.js's own`);
});

// ---------------------------------------------------------------- goldens

test("crystallizeGolden() is 9841D88D8B003CEA, the packet growBiochain writes for bytes 0..59", async () => {
  assert.equal(core().crystallizeGolden(), "9841D88D8B003CEA");
  const rec = await core().growBiochain(String.fromCharCode(...Array.from({ length: 60 }, (_, i) => i)), { engrams: false });
  assert.equal(rec.stream.slice(0, 16), "9841D88D8B003CEA");
  assert.equal(core().parseBiochainStream(rec.stream)[0].chunkLen, 60);
});

test("the GEODESIC engram key is 5C896A4801C9C24C", () => {
  assert.equal(core().engramHex("GEODESIC"), "5C896A4801C9C24C");
  assert.equal(core().engramHex("geodesic"), "5C896A4801C9C24C");
  assert.equal(core().engramStreamFromText("GEODESIC").stream, "5C896A4801C9C24C");
  const grid = core().engramGrid("GEODESIC");
  assert.equal(grid.length, 64);
  assert.equal(core().engramJ(grid), core().engramJ(core().engramGrid("Geodesic")));
});

// ---------------------------------------------------------------- round trips

const a = (n) => "abcdefghijklmnopqrstuvwxyz ".repeat(Math.ceil(n / 27)).slice(0, n);
const ROUND_TRIP = {
  "one byte": "x",
  "720 bytes": a(720),
  "721 bytes": a(721),
  "two-byte character across a chunk boundary": a(719) + "é" + a(50),
  "four-byte character at the end": a(100) + "\u{1D538}",
  "mixed scripts and 0x80": "Owl's tome \u0080 café 中文 — 42 \u{1F989} end\n",
  "3,000 bytes of prose": ("The owl reads the tome by lamplight. ").repeat(81).slice(0, 3000),
};

test("grow → recreate round trips, engrams off and on", async () => {
  for (const [label, text] of Object.entries(ROUND_TRIP)) {
    const bytes = [...new TextEncoder().encode(text)];
    for (const engrams of [false, true]) {
      const rec = await core().growBiochain(text, { engrams });
      assert.equal(core().recreateText(rec), text, `${label}: recreated text`);
      assert.deepEqual(core().recreateChunks(rec).flat(), bytes, `${label}: recreated bytes`);
      assert.equal(rec.leafHashes.length, Math.ceil(bytes.length / 720), `${label}: one leaf per 720-byte chunk`);
      assert.equal(core().parseBiochainStream(rec.stream).length, rec.leafHashes.length);
      assert.equal(rec.origBytes, bytes.length);
      assert.equal(rec.streamVersion, core().STREAM_VERSION);
      assert.equal("engramStream" in rec, engrams, `${label}: engram layer present only when asked`);
      const v = await core().verifyIntegrity(rec);
      assert.equal(v.ok, true, `${label}: ${v.reasons.join("; ")}`);
      const again = await core().growBiochain(text, { engrams });
      assert.deepEqual(again, rec, `${label}: growth is deterministic`);
    }
  }
});

test("the grow cap and empty input are refused", async () => {
  await assert.rejects(core().growBiochain(""), /Nothing to grow/);
  await assert.rejects(core().growBiochain("z".repeat(core().MAX_GROW_BYTES + 1), { engrams: false }), /capped/);
  const full = await core().growBiochain("z".repeat(core().MAX_GROW_BYTES), { engrams: false });
  assert.equal(full.origBytes, core().MAX_GROW_BYTES);
});

test("a growth epoch recreates parent + added text and carries its commitment", async () => {
  const parent = await core().growBiochain(a(1000), { engrams: false });
  const child = await core().extendBiochain(parent, " and then some more text.", { engrams: false });
  assert.equal(core().recreateText(child), a(1000) + " and then some more text.");
  assert.equal(child.parentChainId, parent.chainId);
  assert.equal(child.parentMerkleRoot, parent.merkleRoot);
  assert.equal(child.epoch, 2);
  assert.equal(child.addedBytes, 25);
  assert.equal(core().growthCommitment(child), ["GROWTH/1", parent.chainId, child.chainId, parent.merkleRoot, child.merkleRoot, "25"].join("|"));
  assert.equal(core().grownCommitment(child), ["GROWN/1", child.chainId, child.merkleRoot, child.weaveChiral, child.weaveMirror, String(child.origBytes)].join("|"));
  assert.equal((await core().verifyIntegrity(child)).ok, true);
  await assert.rejects(core().extendBiochain(parent, ""), /Nothing to add/);
});

test("a derived codex parses back: GEAR, PRIME entries, HALT", async () => {
  const text = ROUND_TRIP["3,000 bytes of prose"];
  const cx = await core().deriveCodex(text, { topN: 40 });
  assert.equal(cx.codexHash, "CX-" + sha256(cx.stream).slice(0, 24));
  const parsed = core().parseCodexStream(cx.stream);
  assert.equal(parsed.order, 2);
  assert.equal(parsed.chunk, 720);
  assert.equal(parsed.entries.length, cx.entryCount);
  assert.equal(core().codexCommitment(cx), `CODEX/1|${cx.codexHash}|2|${cx.entryCount}`);
  assert.equal(core().pairCommitment("BC-x", cx.codexHash), `PAIR/1|BC-x|${cx.codexHash}`);
  assert.throws(() => core().parseCodexStream(cx.stream.slice(0, -16)), /HALT/);
});

test("language seeds retrieve the passage a query was taken from", async () => {
  const text = "The owl keeps the tome. The fox keeps the lantern! Rain falls on the tower? Stars wheel overhead.";
  const rec = await core().growBiochain(text, { engrams: false });
  const seeds = core().biochainToSeeds(rec);
  assert.deepEqual(seeds.map((s) => s.text), core().passagesOf(text));
  const best = core().matchSeeds("The fox keeps the lantern!", seeds, 1)[0];
  assert.equal(best.text, "The fox keeps the lantern!");
  assert.equal(best.dist, 0);
  assert.equal(core().hammingGrids(best.grid, core().engramOf(best.text)), 0);
});

// ---------------------------------------------------------------- the 13 compat texts (I3)

const COMPAT_DIR = join(ROOT, "tests/vendor/biomesh-compat-v1");
const COMPAT = JSON.parse(readFileSync(join(COMPAT_DIR, "biomesh_compat_v1.json"), "utf8"));
const TEXT_FILES = readdirSync(join(COMPAT_DIR, "texts")).filter((f) => f.endsWith(".txt")).sort();

test("biomesh_compat_v1: the 13 texts give the pinned records, engrams off and on", async (t) => {
  for (const [i, entry] of COMPAT.texts.entries()) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(join(COMPAT_DIR, "texts", TEXT_FILES[i])));
    for (const mode of ["off", "on"]) {
      await t.test(`${entry.name}, engrams ${mode}`, async () => {
        const want = entry.records[mode];
        const rec = await core().growBiochain(text, { engrams: mode === "on" });
        assert.equal(rec.chainId, want.chainId);
        assert.equal(rec.merkleRoot, want.merkleRoot);
        assert.equal(rec.value, want.value);
        assert.equal(rec.leafHashes.length, entry.chunks);
        assert.equal(sha256(JSON.stringify(rec)), want.record, "the whole record (weaves, leaves, stream, segments, engrams)");
        assert.equal(want.owlVerify, true);
        const v = await core().verifyIntegrity(rec);
        assert.equal(v.ok, true, v.reasons.join("; "));
        assert.equal(core().recreateText(rec), text);
      });
    }
  }
});
