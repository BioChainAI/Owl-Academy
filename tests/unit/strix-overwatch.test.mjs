// SPDX-License-Identifier: MIT
// scripts/strix-overwatch.js (draft 0): OBS/1 lines, LEXICON/1 addresses and their 2D/3D frames, TRACE/1,
// the journey chain (real shdccp/2 epochs), the Overwatch inspection, OVERWATCH/1 certificates and HYPERPACK/1.
// Run: node --test tests/unit/strix-overwatch.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.env.OWL_TEST_ROOT || path.resolve(import.meta.dirname, "../..");
const load = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const OW = await load("scripts/strix-overwatch.js");
const BM = await load("scripts/biomesh-core.js");

const SAMPLES = [
  ["sound", { hz: 432, ms: 400 }, "tone-432", "OBS/1|sound|tone-432|hz=432;ms=400"],
  ["light", { r: 56, g: 189, b: 248 }, "sky", "OBS/1|light|sky|r=56;g=189;b=248"],
  ["touch", { at: [4, 4], path: "0011223" }, "first stroke", "OBS/1|touch|first stroke|at=4,4;path=0011223"],
  ["symbol", { text: "owl | 100%\nwise" }, "owl", "OBS/1|symbol|owl|text=owl %7C 100%25%0Awise"],
  ["number", { seq: [1, 1, 2, 3, 5, 8] }, "fib", "OBS/1|number|fib|seq=1,1,2,3,5,8"],
];
const observations = () => SAMPLES.map(([s, i, n]) => OW.makeObservation(s, i, n));

async function journey(obs = observations(), at = "2026-01-01T00:00:00.000Z") {
  const trace = [], lineage = [];
  OW.traceAppend(trace, "system", "genesis", "darkness", at);
  let chain = null;
  for (const o of obs) {
    OW.traceAppend(trace, "human", "observe", o.line, at);
    chain = await OW.growJourney(chain, o);
    lineage.push(OW.lineageRow(chain));
    OW.traceAppend(trace, "strix", "chain.grown", OW.epochCommitment(chain), at);
  }
  return { chain, lexicon: OW.lexiconOf(obs), lineage, trace };
}
const clone = (v) => JSON.parse(JSON.stringify(v));

test("OBS/1: each sense has one canonical line, and the line reads back to the observation", () => {
  for (const [sense, input, name, line] of SAMPLES) {
    const o = OW.makeObservation(sense, input, name);
    assert.equal(o.line, line);
    assert.deepEqual(OW.parseObservation(line), o);
  }
  assert.equal(OW.parseObservation(SAMPLES[3][3]).text, "owl | 100%\nwise");
  assert.equal(OW.makeObservation("symbol", { text: "é" }, "x").text, "é", "NFC");
});

test("OBS/1: lines that are not canonical, or out of range, are refused", () => {
  const bad = [
    "OBS/1|sound|a|hz=0432;ms=400", "OBS/1|sound|a|hz=19;ms=400", "OBS/1|sound|a|ms=400;hz=432", "OBS/1|sound|a|hz=432;ms=400;x=1",
    "OBS/1|light|a|r=256;g=0;b=0", "OBS/1|touch|a|at=31,31;path=0", "OBS/1|touch|a|at=1,1;path=8", "OBS/1|symbol|a|text=",
    "OBS/1|symbol|a|text=a|b", "OBS/1|symbol|a|text=a%7cb", "OBS/1|number|a|seq=1,,2", "OBS/1|number|a|seq=65536", "OBS/1|smell|a|x=1",
    "OBS/2|sound|a|hz=432;ms=400", "OBS/1|sound| a|hz=432;ms=400", "OBS/1|sound|a |hz=432;ms=400", "OBS/1|sound||hz=432;ms=400",
  ];
  for (const line of bad) assert.throws(() => OW.parseObservation(line), null, line);
  assert.throws(() => OW.makeObservation("sound", { hz: 432.5, ms: 400 }, "a"));
  assert.throws(() => OW.makeObservation("number", { seq: Array(17).fill(1) }, "a"));
  assert.throws(() => OW.makeObservation("symbol", { text: "\ud800" }, "a"));
  assert.throws(() => OW.parseJourney("OBS/1|sound|a|hz=432;ms=400"), /newline/);
  assert.throws(() => OW.parseJourney("OBS/1|sound|a|hz=432;ms=400\n\n"), /line 2/);
});

test("LEXICON/1: addresses count per sense, the root commits to every entry", () => {
  const obs = [...observations(), OW.makeObservation("sound", { hz: 864, ms: 400 }, "octave")];
  const lex = OW.lexiconOf(obs);
  assert.deepEqual(lex.entries.map((e) => e.address), ["0.0", "1.0", "2.0", "3.0", "4.0", "0.1"]);
  assert.deepEqual(lex.dims, ["2D", "3D"]);
  assert.match(lex.root, /^[0-9a-f]{64}$/);
  const other = clone(lex.entries); other[5].name = "octavo";
  assert.notEqual(OW.lexiconRoot(other), lex.root);
  assert.deepEqual(OW.parseAddress("3.12"), [3, 12]);
  for (const a of ["5.0", "0.01", "0.", "a", "0.0.0"]) assert.throws(() => OW.parseAddress(a));
});

test("geometry: frames are isometries, addresses sit at their tree distance, 2D stays in the disc", () => {
  const origin = [0, 0, 0, 1];
  for (const dims of ["2D", "3D"]) {
    const seen = [];
    for (let s = 0; s < 5; s++) for (const e of [undefined, 0, 1, 6, 7, 20]) {
      const addr = e === undefined ? String(s) : `${s}.${e}`;
      const m = OW.lexiconFrame(addr, dims), h = OW.originOf(m);
      assert.ok(Math.abs(h[0] ** 2 + h[1] ** 2 + h[2] ** 2 - h[3] ** 2 + 1) < 1e-9, "on the hyperboloid");
      const back = OW.lmul(OW.linv(m), m);
      back.forEach((v, i) => assert.ok(Math.abs(v - OW.IDENT[i]) < 1e-9, "inverse"));
      const p = OW.lexiconPoint(addr, dims);
      assert.ok(Math.hypot(...p) < 1);
      if (dims === "2D") assert.equal(p[2], 0);
      if (e !== undefined) {
        const parent = OW.originOf(OW.lexiconFrame(String(s), dims));
        assert.ok(Math.abs(OW.hypDist(parent, h) - (1 + 0.3 * Math.floor(e / 7))) < 1e-9, "entry step");
        assert.ok(OW.hypDist(origin, h) > OW.hypDist(origin, parent), "entries lie beyond their sense");
      } else assert.ok(Math.abs(OW.hypDist(origin, h) - 1.25) < 1e-9, "sense step");
      seen.push(p);
    }
    for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++)
      assert.ok(Math.hypot(seen[i][0] - seen[j][0], seen[i][1] - seen[j][1], seen[i][2] - seen[j][2]) > 1e-3, `${dims}: distinct points`);
    const r = OW.originOf(OW.receiverFrame());
    for (let s = 0; s < 5; s++) assert.ok(OW.hypDist(r, OW.originOf(OW.lexiconFrame(String(s), dims))) > 1.5, "receiver is apart");
  }
  const a = OW.originOf(OW.lexiconFrame("0.0", "3D")), b = OW.originOf(OW.lexiconFrame("3.2", "3D")), g = OW.geodesic(a, b, 10);
  assert.equal(g.length, 11);
  let total = 0; for (let i = 1; i < g.length; i++) total += OW.hypDist(g[i - 1], g[i]);
  assert.ok(Math.abs(total - OW.hypDist(a, b)) < 1e-9, "geodesic length adds up");
  const o = OW.originOf(OW.boostAlong([0, 0.6, 0.8], 1.5));
  assert.ok(Math.abs(OW.hypDist(origin, o) - 1.5) < 1e-12 && Math.abs(o[0]) < 1e-12);
  for (const obs of observations()) for (const p of OW.senseGlyph(obs)) assert.ok(Math.hypot(...p) < 1, obs.sense + " glyph inside the ball");
  const c = OW.crystalPoint([...new TextEncoder().encode("OBS/1")]);
  assert.ok(c.quat[0] >= 0 && Math.abs(Math.hypot(...c.quat) - 1) < 1e-12 && Math.hypot(...c.point) <= 1);
});

test("decodePacket reads the crystal packet's fields; one flipped bit breaks parity", () => {
  const d = OW.decodePacket(BM.crystallizeGolden());
  assert.equal(d.hex, "9841D88D8B003CEA");
  assert.deepEqual([d.form, d.payload16, d.parityOk], [9, 60, true]);
  assert.equal(d.bits.length, 64);
  assert.equal(parseInt(d.bits.slice(0, 4), 2), 9);
  for (const [, input, name] of SAMPLES.slice(0, 1)) {
    const bytes = [...new TextEncoder().encode(OW.makeObservation("sound", input, name).line + "\n")];
    const p = OW.decodePacket(BM.crystallize(bytes));
    assert.deepEqual([p.form, p.payload16, p.parityOk], [9, bytes.length, true]);
    for (let bit = 0; bit < 64; bit++) assert.equal(OW.decodePacket(OW.flipBit(p.hex, bit)).parityOk, false, "bit " + bit);
  }
});

test("TRACE/1: the ledger verifies, and any edit, removal or reorder breaks it", () => {
  const t = [];
  for (let i = 0; i < 5; i++) OW.traceAppend(t, "human", "e" + i, "d" + i, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(OW.verifyTrace(t), { ok: true, brokenAt: null, head: t[4].hash });
  assert.deepEqual(OW.verifyTrace([]), { ok: true, brokenAt: null, head: null });
  const edit = clone(t); edit[2].detail = "x"; assert.equal(OW.verifyTrace(edit).brokenAt, 2);
  const cut = clone(t); cut.splice(1, 1); assert.equal(OW.verifyTrace(cut).brokenAt, 1);
  const swap = clone(t); [swap[3], swap[4]] = [swap[4], swap[3]]; assert.equal(OW.verifyTrace(swap).brokenAt, 3);
  assert.equal(OW.verifyTrace(null).ok, false);
});

test("a journey grows one real shdccp/2 epoch per observation and passes every Overwatch check", async () => {
  const b = await journey();
  assert.equal(b.chain.streamVersion, "shdccp/2");
  assert.equal(b.chain.epoch, 5);
  assert.equal(BM.verifyIntegrityStrict(b.chain).ok, true);
  assert.equal(BM.recreateText(b.chain), OW.journeyText(observations()));
  assert.equal(b.lineage[4].chainId, b.chain.chainId);
  const r = await OW.overwatchInspect(b);
  assert.deepEqual([r.ok, r.failed], [true, null]);
  assert.deepEqual(r.checks.map((c) => c.name), [...OW.OVERWATCH_CHECKS]);
  assert.ok(r.checks.every((c) => c.ok === true));
  const one = await journey(observations().slice(0, 1));
  assert.equal(one.chain.epoch, undefined);
  assert.equal((await OW.overwatchInspect(one)).ok, true);
  const again = await journey();
  assert.equal(again.chain.chainId, b.chain.chainId, "growth is deterministic");
});

test("certificate and package: issued only on a clean inspection, verified by a receiver from JSON", async () => {
  const b = await journey(), keys = await OW.newSessionKeys();
  const { certificate, report } = await OW.issueCertificate(b, keys, "2026-01-01T00:00:01.000Z");
  assert.equal(report.ok, true);
  assert.match(certificate.commitment, /^OVERWATCH\/1\|BC-[0-9a-f]{24}\|[0-9a-f]{64}\|5\|[0-9a-f]{64}\|2D\+3D\|[0-9a-f]{64}\|strict\+meaning\+lexicon\+lineage\+trace$/);
  OW.traceAppend(b.trace, "overwatch", "certificate.issued", certificate.commitment);   // the ledger keeps growing
  const wire = JSON.stringify(OW.makeHyperpack({ ...b, certificate }));
  const v = await OW.verifyHyperpack(wire);
  assert.deepEqual([v.ok, v.failed], [true, null]);
  assert.deepEqual(v.checks.map((c) => c.name), [...OW.PACKAGE_CHECKS]);
  assert.equal((await OW.verifyHyperpack("{")).failed, "parse");
  assert.equal((await OW.verifyHyperpack({ format: "nope" })).failed, "parse");

  const bad = clone(b); bad.lexicon.entries[0].name = "forged";
  const refused = await OW.issueCertificate(bad, keys);
  assert.deepEqual([refused.certificate, refused.report.failed], [null, "lexicon"]);
});

test("tampering: each change is rejected at its named check", async () => {
  const b = await journey(), keys = await OW.newSessionKeys(), other = await OW.newSessionKeys();
  const { certificate } = await OW.issueCertificate(b, keys);
  OW.traceAppend(b.trace, "overwatch", "certificate.issued", certificate.commitment);
  const good = OW.makeHyperpack({ ...b, certificate });
  const flipHex = (s, i) => s.slice(0, i) + (s[i] === "0" ? "1" : "0") + s.slice(i + 1);
  const cases = {
    parity: (p) => { p.chain.stream = flipHex(p.chain.stream, 15); },
    canonical: (p) => { p.chain.stream = p.chain.stream.slice(0, -2) + flipHex(p.chain.stream.slice(-2), 1); },
    leaves: (p) => { p.chain.leafHashes[0] = flipHex(p.chain.leafHashes[0], 3); },
    weaves: (p) => { p.chain.chainId = "BC-" + "0".repeat(24); },
    derived: (p) => { p.chain.engramCount += 1; },
    lexicon: (p) => { p.lexicon.entries[1].address = "1.1"; },
    lineage: (p) => { p.lineage[2].chainId = p.lineage[1].chainId; },
    trace: (p) => { p.trace[1].detail = "OBS/1|sound|tone-433|hz=433;ms=400"; },
    commitment: (p) => { p.certificate.commitment = p.certificate.commitment.replace("|5|", "|6|"); },
    signature: (p) => { p.certificate.sig = flipHex(p.certificate.sig, 10); },
  };
  for (const [check, change] of Object.entries(cases)) {
    const p = clone(good); change(p);
    const v = await OW.verifyHyperpack(JSON.stringify(p));
    assert.deepEqual([v.ok, v.failed], [false, check], check);
    const at = v.checks.findIndex((c) => c.name === check);
    assert.ok(v.checks.slice(0, at).every((c) => c.ok === true) && v.checks.slice(at + 1).every((c) => c.ok === null), check + ": stops there");
  }
  // a different journey under the same certificate, and another key's signature under the same seal id
  const swapped = clone(good); swapped.chain = (await journey(observations().slice(0, 4))).chain;
  assert.equal((await OW.verifyHyperpack(swapped)).ok, false);
  const resigned = clone(good);
  resigned.certificate.sig = (await OW.issueCertificate({ ...b, trace: b.trace.slice(0, -1) }, other)).certificate.sig;
  assert.equal((await OW.verifyHyperpack(resigned)).failed, "signature");
  const dropped = clone(good); dropped.trace = dropped.trace.filter((e) => e.event !== "chain.grown" || !e.detail.startsWith("GROWN/1"));
  assert.equal((await OW.verifyHyperpack(dropped)).failed, "trace");
  // meaning: a chain that is a valid shdccp/2 record but not a journey
  const prose = await BM.growBiochain("hello world\n");
  const m = await OW.overwatchInspect({ chain: clone(prose), lexicon: OW.lexiconOf([]), lineage: [], trace: [] });
  assert.equal(m.failed, "meaning");
});
