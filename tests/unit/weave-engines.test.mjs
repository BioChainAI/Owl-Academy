// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// The D7 measurement's set-up, offline (no browser is started here): .github/workflows/weave-engines.yml runs only
// when dispatched by hand, pins its actions to commits and holds no write permission; Playwright is pinned by version
// and lockfile in tests/engines/; the seeded shards are the same on every run and cover chunk counts 1..9; and the
// weaves the harness compares (chainWeaves) are the ones growBiochain writes. The strict audit's engine check
// (scripts/biomesh-engine-check.js): its hypot table is shdccp2_arith's 24 hypot cases, Node and RFC 07's hypotV8
// reproduce it and its seeded weave, and a Math.hypot computed another way is reported as not V8's. Run from the
// repository root:
//   node --test tests/unit/weave-engines.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(process.env.OWL_TEST_ROOT || fileURLToPath(new URL("../..", import.meta.url)));
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const C = await import(pathToFileURL(join(ROOT, "scripts/biomesh-core.js")).href);
const S = await import(pathToFileURL(join(ROOT, "tests/engines/shards.mjs")).href);
const E = await import(pathToFileURL(join(ROOT, "scripts/biomesh-engine-check.js")).href);

test("weave-engines.yml runs only by hand, read-only, with actions pinned to commits", () => {
  const wf = read(".github/workflows/weave-engines.yml");
  const on = /^on:\n([\s\S]*?)\n(?=\S)/m.exec(wf);
  assert.ok(on, "an on: block");
  assert.deepEqual(on[1].split("\n").filter((l) => /^ {2}\S/.test(l)).map((l) => l.trim()), ["workflow_dispatch:"]);
  assert.match(wf, /^permissions:\n {2}contents: read\n/m);
  assert.doesNotMatch(wf, /\bsecrets\.|write-all|contents: write/);
  const uses = [...wf.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 3);
  for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${u} is pinned to a commit`);
  assert.match(wf, /\$\{\{ inputs\.shards \}\}/);
  assert.doesNotMatch(wf, /run:.*\$\{\{/, "inputs reach the shell through env, not interpolated into a script");
});

test("Playwright is pinned by exact version and lockfile, and nothing else is installed", () => {
  const pkg = JSON.parse(read("tests/engines/package.json"));
  const lock = JSON.parse(read("tests/engines/package-lock.json"));
  assert.deepEqual(Object.keys(pkg.devDependencies), ["playwright"]);
  assert.match(pkg.devDependencies.playwright, /^\d+\.\d+\.\d+$/);
  assert.equal(lock.packages["node_modules/playwright"].version, pkg.devDependencies.playwright);
  assert.deepEqual(Object.keys(lock.packages).sort(), ["", "node_modules/playwright", "node_modules/playwright-core"]);
  for (const [k, p] of Object.entries(lock.packages)) if (k) assert.match(p.integrity, /^sha512-/);
});

test("the seeded shards are deterministic, mix bytes and text, and cover 1 to 9 chunks", () => {
  const a = S.shards(20261108, 200), b = S.shards(20261108, 200);
  assert.deepEqual(a, b);
  assert.notDeepEqual(S.shards(1, 4), S.shards(2, 4));
  const ks = new Set(a.map((chunks) => chunks.length));
  for (let k = 1; k <= 9; k++) assert.ok(ks.has(k), `a shard with ${k} chunk(s)`);
  for (const chunks of a) {
    assert.ok(chunks.slice(0, -1).every((c) => c.length === 720) && chunks.at(-1).length >= 1 && chunks.at(-1).length <= 720);
    assert.ok(chunks.flat().every((x) => Number.isInteger(x) && x >= 0 && x <= 255));
  }
  assert.ok(a.some((chunks) => chunks.flat().some((x) => x >= 0x80)), "bytes of 0x80 and above");
  const h = S.hypotInputs(7, 100);
  assert.equal(h.length, 100);
  assert.ok(h.every((q) => q.length === 4 && q.every(Number.isFinite)));
  assert.equal(S.f64hex(1), "3ff0000000000000");
  assert.equal(S.f64hex(-0), "8000000000000000");
});

test("the harness compares the weaves growBiochain writes", async () => {
  const shards = S.shards(20261108, 40);
  let compared = 0;
  for (let i = 1; i < shards.length; i += 2) {                       // odd shards are UTF-8 text
    const bytes = shards[i].flat();
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes)); } catch { continue; }
    const rec = await C.growBiochain(text, { engrams: false });
    if (rec.origBytes !== bytes.length) continue;
    assert.deepEqual(C.chainWeaves(shards[i]), { weaveChiral: rec.weaveChiral, weaveMirror: rec.weaveMirror }, `shard ${i}`);
    compared++;
  }
  assert.ok(compared >= 5, `${compared} shards compared with growBiochain`);
  const page = read("tests/engines/weave-engines.html");
  assert.match(page, /import \{ chainWeaves \} from "\.\.\/\.\.\/scripts\/biomesh-core\.js";/);
  assert.match(page, /from "\.\/shards\.mjs";/);
});

/** hypotV8 as RFC 07 section 8.3 writes it: a Kahan-compensated sum of squares scaled by the largest magnitude. */
function hypotV8(...xs) {
  if (xs.some((x) => x === Infinity || x === -Infinity)) return Infinity;
  if (xs.some((x) => Number.isNaN(x))) return NaN;
  const m = Math.max(...xs.map(Math.abs));
  if (m === 0) return 0;
  let sum = 0, comp = 0;
  for (const x of xs) {
    const t = Math.abs(x) / m;
    const summand = t * t - comp;
    const prelim = sum + summand;
    comp = (prelim - sum) - summand;
    sum = prelim;
  }
  return Math.sqrt(sum) * m;
}

test("the engine check's tables are shdccp2_arith's hypot cases and V8's seeded weave", () => {
  const arith = JSON.parse(read("tests/vendor/shdccp2-contract/suites/shdccp2_arith.json"));
  const want = arith.cases.filter((c) => c.input.op === "hypot").map((c) => [c.id, c.input.args, c.expect.result]);
  assert.equal(want.length, 24);
  assert.deepEqual(E.HYPOT_V8.map(([id, args, r]) => [id, [...args], r]), want);
  assert.equal(E.HYPOT_V8.filter(([id]) => id.startsWith("hypot_differs_")).length, 12);
  assert.deepEqual(E.seededWeaves(), { chiral: [...E.WEAVE_V8.chiral], mirror: [...E.WEAVE_V8.mirror] });
  assert.deepEqual(E.engineCheck(), { matchesV8: true, hypotCases: 24, hypotMismatches: [], weaveMatches: true });
  for (const h of ["3ff0000000000000", "8000000000000000", "7e37e43c8800759c", "01a56e1fc2f8f359"]) assert.equal(E.f64hex(E.hexf64(h)), h);
  const src = read("scripts/biomesh-engine-check.js");
  assert.deepEqual([...src.matchAll(/^\s*import\b[^;]*from\s*"([^"]+)"/gm)].map((m) => m[1]), ["./biomesh-core.js"], "Firebase-free");
  assert.doesNotMatch(src, /\bimport\s*\(/);
  assert.match(read("mage_tower/Biomesh_Audit.html"), /import \{ engineCheck \} from "\.\.\/scripts\/biomesh-engine-check\.js";/);
});

test("the engine check reports a Math.hypot computed another way, and passes RFC 07's hypotV8", () => {
  const orig = Math.hypot;
  try {
    Math.hypot = (...a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0));          // the plain form
    const plain = E.engineCheck();
    assert.equal(plain.matchesV8, false);
    assert.equal(plain.weaveMatches, false);
    for (const [id] of E.HYPOT_V8.filter(([id]) => id.startsWith("hypot_differs_"))) assert.ok(plain.hypotMismatches.includes(id), id);
    Math.hypot = (...a) => {                                                      // scaled, without the compensation
      const m = Math.max(...a.map(Math.abs));
      if (m === 0) return 0;
      let s = 0;
      for (const x of a) s += (x / m) * (x / m);
      return Math.sqrt(s) * m;
    };
    const scaled = E.engineCheck();
    assert.equal(scaled.matchesV8, false);
    assert.equal(scaled.weaveMatches, false, "the seeded weave tells it apart");
    Math.hypot = hypotV8;
    assert.deepEqual(E.engineCheck(), { matchesV8: true, hypotCases: 24, hypotMismatches: [], weaveMatches: true });
  } finally {
    Math.hypot = orig;
  }
});
