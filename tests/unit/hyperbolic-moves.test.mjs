// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
// scripts/hyperbolic-moves.js (the geometry core; for drawing and demonstration only, never committed to a chain):
// the helpers ported from the tested research snippets with their 21 tests, the {4,5} and {4,6} tilings, the rings
// of the word wheel; slides of a body that never turns and the turn found on coming home; the tree layout with
// relative edges (every entry owns a cell) on 300 seeded random trees per dims, on the 54-entry spine tree that
// breaks absolute frames, on a chain eight levels deep and on 2,900 entries under one node; the author's "three
// squares": the exact Gram-TQF against the 300 SHD-CCP vectors (tests/unit/fixtures/gram-tqf-vectors.json) and
// every triple of the 4 x 4 x 4 lattice, three rim points fixing a Möbius map, three squares fixing the next.
// Run: node --test tests/unit/hyperbolic-moves.test.mjs   (about 15 seconds)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.env.OWL_TEST_ROOT || path.resolve(import.meta.dirname, "../..");
const load = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const H = await load("scripts/hyperbolic-moves.js");
const OW = await load("scripts/strix-overwatch.js");
const { IDENT, lmul, rotY, rotZ, boostX, boostAlong, linv, lapply, originOf, toBall, hypDist } = OW;

// ─── helpers ─────────────────────────────────────────────────────────────────

const O = [0, 0, 0, 1], DEG = 180 / Math.PI, RAD = Math.PI / 180, TWO_PI = 2 * Math.PI;
/** mulberry32: the same seed always gives the same numbers. */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// complex numbers as [re, im]
const C = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
  conj: (a) => [a[0], -a[1]],
  abs: (a) => Math.hypot(a[0], a[1]),
  cis: (t) => [Math.cos(t), Math.sin(t)],
};
/** T_c(z) = (z - c) / (1 - conj(c) z), written out here independently of the module. */
const T = (c, z) => C.div(C.sub(z, c), C.sub([1, 0], C.mul(C.conj(c), z)));
const maxAbs = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
const wrap = (t) => { let x = t % TWO_PI; if (x > Math.PI) x -= TWO_PI; if (x <= -Math.PI) x += TWO_PI; return x; };
const randDisc = (R, rmax = 0.95) => { const r = rmax * Math.sqrt(R()), t = TWO_PI * R(); return [r * Math.cos(t), r * Math.sin(t)]; };
const randUnit3 = (R) => { const z = 2 * R() - 1, t = TWO_PI * R(), s = Math.sqrt(1 - z * z); return [s * Math.cos(t), s * Math.sin(t), z]; };
const randBall = (R, rmax = 0.95) => { const u = randUnit3(R), r = rmax * Math.cbrt(R()); return [u[0] * r, u[1] * r, u[2] * r]; };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a) => { const n = Math.hypot(a[0], a[1], a[2]); return [a[0] / n, a[1] / n, a[2] / n]; };
const angle3 = (a, b) => Math.atan2(Math.hypot(...cross3(a, b)), dot3(a, b));
/** Largest entry of Mᵀ η M − η: zero exactly when M is a Lorentz matrix. */
const lorentzDefect = (m) => {
  let worst = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += m[k * 4 + i] * m[k * 4 + j] * (k === 3 ? -1 : 1);
    worst = Math.max(worst, Math.abs(s - (i === j ? (i === 3 ? -1 : 1) : 0)));
  }
  return worst;
};
const close = (actual, expected, tol, what) => {
  assert.equal(typeof actual, "number", `${what}: got ${actual}, not a number`);
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: got ${actual}, expected ${expected} within ${tol}`);
};
const atMost = (value, limit, what) => {
  assert.equal(typeof value, "number", `${what}: got ${value}, not a number`);
  assert.ok(value <= limit, `${what}: ${value} is not at most ${limit}`);
};
const throwsPlain = (fn, message) => assert.throws(fn, (e) => e instanceof Error && e.message === message);

// ─── the module's surface ────────────────────────────────────────────────────

const PORTED = ["fromBall", "centreOn", "moveBall", "composeTranslations", "wignerAngle", "discForm", "walk", "squareWalkGap",
  "squareWalkTurn", "squareWalkBearing", "rightAngledPolygonSide", "regularQuad", "lambertAngle", "triangleArea", "equalAreaRings",
  "equalStepRings", "discRadius", "cellArea", "skyImage", "aberrate", "dragCentre", "tilingConstants", "generateTiling"];
const ADDED = ["slidePath", "homecoming", "conformalFactor", "treeLayout", "relativeFrame", "relativeFrames", "cellWall", "treePath",
  "cellAt", "gramTqf", "isCollinear", "mobiusFromThree", "squareNumbersNext"];
const ALLOWED_IMPORTS = ["IDENT", "lmul", "rotX", "rotY", "rotZ", "boostX", "boostAlong", "linv", "lapply", "originOf", "toBall", "hypDist", "geodesic"];

test("exports: the names of section 3, the ported T_c helper mobius and the constant R_MIN, and nothing else", () => {
  assert.deepEqual(Object.keys(H).sort(), [...PORTED, ...ADDED, "mobius", "R_MIN"].sort());
  for (const name of [...PORTED, ...ADDED, "mobius"]) assert.equal(typeof H[name], "function", name);
  assert.equal(H.R_MIN, 0.55);
});

test("source: the two licence lines come first, and the one import takes only the thirteen geometry names from ./strix-overwatch.js", () => {
  const src = readFileSync(path.join(ROOT, "scripts/hyperbolic-moves.js"), "utf8");
  const lines = src.split("\n");
  assert.equal(lines[0], "// SPDX-License-Identifier: MIT");
  assert.equal(lines[1], "// Copyright (c) 2026 Ebayednoob");
  const imports = [...src.matchAll(/^import\b([\s\S]*?)\bfrom\s*["']([^"']+)["']/gm)];
  assert.equal(imports.length, 1, "exactly one import statement");
  assert.equal(imports[0][2], "./strix-overwatch.js");
  const names = imports[0][1].replace(/[{}]/g, " ").split(",").map((s) => s.trim()).filter(Boolean);
  assert.ok(names.length > 0);
  for (const name of names) {
    assert.ok(ALLOWED_IMPORTS.includes(name), `${name} is not one of the thirteen`);
    assert.notEqual(OW[name], undefined, `${name} is exported by strix-overwatch.js`);
  }
  assert.equal(src.match(/^import\b/gm).length, 1, "no second import");
});

// ─── 3.1 the 21 snippet tests ────────────────────────────────────────────────
// Ported from the research file snippets.test.mjs: the same seed, the same order of draws, the same tolerances.
// Only the printing is gone; the numbers it printed are pinned in the tests that follow.

function snippetChecks() {
  const S = H, checks = [];
  const check = (name, err, tol = 1e-9) => checks.push({ name, err, tol });
  const R = rng(424242);
  { let e = 0, e3 = 0;
    for (let i = 0; i < 1000; i++) { const c = randDisc(R), z = randDisc(R);
      e = Math.max(e, C.abs(C.sub(S.moveBall(S.centreOn([c[0], c[1], 0]), [z[0], z[1], 0]).slice(0, 2), T(c, z))), C.abs(C.sub(S.mobius(c, z), T(c, z))));
      const p = randBall(R); e3 = Math.max(e3, Math.hypot(...S.moveBall(S.centreOn(p), p))); }
    check("S1  centreOn([c,0]) acts on the disc as T_c; mobius(c,z) = T_c(z)", e, 1e-12);
    check("S1  centreOn(p) sends the ball point p to the centre (3D)", e3, 1e-12);
    check("S1  centreOn([0,0,0]) is the identity", maxAbs(S.centreOn([0, 0, 0]), IDENT), 0);
  }
  { let e = 0, e2 = 0, e3 = 0;
    for (let i = 0; i < 1000; i++) { const a = randDisc(R), b = randDisc(R), z = randDisc(R), { w, theta } = S.composeTranslations(a, b);
      e = Math.max(e, C.abs(C.sub(T(b, T(a, z)), C.mul(C.cis(theta), T(w, z)))));
      const d1 = 3 * R(), d2 = 3 * R(), p1 = 2 * Math.PI * R(), p2 = 2 * Math.PI * R(), u1 = [Math.cos(p1), Math.sin(p1), 0], u2 = [Math.cos(p2), Math.sin(p2), 0];
      const M = lmul(boostAlong(u2, d2), boostAlong(u1, d1)), { theta: th, dw } = S.wignerAngle(d1, d2, p2 - p1), df = S.discForm(M);
      e2 = Math.max(e2, Math.abs(wrap(df.theta - th)), Math.abs(2 * Math.atanh(C.abs(df.c)) - dw) / (1 + dw));
      e3 = Math.max(e3, maxAbs(M, lmul(rotZ(df.theta), S.centreOn([df.c[0], df.c[1], 0]))) / M[15]); }
    check("S2  composeTranslations: T_b o T_a = e^{i theta} T_w", e, 1e-12);
    check("S2  wignerAngle agrees with discForm(boostAlong(u2,d2).boostAlong(u1,d1))", e2, 1e-8);
    check("S2  discForm: M = rotZ(theta) . centreOn(c)", e3, 1e-10);
  }
  { let e = 0, eB = 0, eNoTurn = 0, eClose = 0, eQ = 0;
    for (let i = 0; i < 300; i++) { const a = 0.05 + 3 * R(), W = S.walk(a, Math.PI / 2, 4), end = lapply(W, O);
      const D = Math.asinh(Math.hypot(end[0], end[1]));
      e = Math.max(e, Math.abs(D - S.squareWalkGap(a)) / S.squareWalkGap(a));
      eB = Math.max(eB, Math.abs(wrap(Math.atan2(end[1], end[0]) - S.squareWalkBearing(a))));
      // W = B . rotZ(psi) with B the straight slide from the start to the end: psi is the turn of the frame
      const B = linv(S.centreOn(toBall(end))), psi = Math.atan2(lmul(linv(B), W)[4], lmul(linv(B), W)[0]);
      if (D < 3) e = Math.max(e, Math.abs(wrap(-psi - S.squareWalkTurn(a))));
      // "four directions without turning": forward, left, back, right, the body never rotated -> the very same matrix
      const N = lmul(lmul(boostAlong([1, 0, 0], a), boostAlong([0, 1, 0], a)), lmul(boostAlong([-1, 0, 0], a), boostAlong([0, -1, 0], a)));
      eNoTurn = Math.max(eNoTurn, maxAbs(N, W) / W[15]);
      const q = S.regularQuad(a); eQ = Math.max(eQ, maxAbs(S.walk(a, q.turn, 4), IDENT) / Math.cosh(2 * a)); }
    for (const n of [5, 6, 7, 9]) eClose = Math.max(eClose, maxAbs(S.walk(S.rightAngledPolygonSide(n), Math.PI / 2, n), IDENT));
    check("S3  squareWalkGap, squareWalkTurn, squareWalkBearing agree with walk(a, pi/2, 4)", Math.max(e, eB), 1e-7);
    check("S3  forward/left/back/right by a WITHOUT turning the body gives the same final frame as the turning walk", eNoTurn, 1e-10);
    check("S3  walk(rightAngledPolygonSide(n), pi/2, n) = identity for n = 5,6,7,9", eClose, 1e-9);
    check("S3  walk(a, regularQuad(a).turn, 4) = identity", eQ, 1e-11);
  }
  { const r = S.equalAreaRings(3, 4), areas = r.map((_, i) => S.cellArea(r, i, 16));
    check("S5  equalAreaRings(3,4): four equal cell areas", Math.max(...areas.map((x) => Math.abs(x - areas[0]))), 1e-12);
  }
  { let e = 0, eSlice = 0;
    for (let i = 0; i < 1000; i++) { const u = randUnit3(R), n = randUnit3(R), d = 3 * R(), img = S.skyImage(boostAlong(u, d), n);
      const th = Math.acos(u[0] * n[0] + u[1] * n[1] + u[2] * n[2]), th2 = Math.acos(Math.max(-1, Math.min(1, u[0] * img.n[0] + u[1] * img.n[1] + u[2] * img.n[2])));
      e = Math.max(e, Math.abs(th2 - S.aberrate(th, d)));
      // a Lorentz matrix preserves every hyperbolic slice x^2+y^2+z^2-t^2 = -tau^2
      const tau = 0.1 + 5 * R(), p = S.fromBall(randBall(R)).map((x) => x * tau), q = lapply(lmul(boostAlong(u, d), rotY(R())), p);
      eSlice = Math.max(eSlice, Math.abs((q[0] * q[0] + q[1] * q[1] + q[2] * q[2] - q[3] * q[3]) + tau * tau) / (q[3] * q[3])); }
    check("S6  skyImage(boostAlong(u,d), n) is at angle aberrate(theta, d) from u", e, 1e-7);
    check("S6  a Lorentz matrix maps each slice x^2+y^2+z^2-t^2 = -tau^2 to itself (same isometry on every hyperbolic slice)", eSlice, 1e-12);
  }
  { // sliding once round a regular quadrilateral WITHOUT turning the body: back home, rotated clockwise by the area 2 pi - 4 alpha
    let e = 0;
    const carry = (a) => { const q = S.regularQuad(a); let P = IDENT.slice(), heading = 0;
      for (let i = 0; i < 4; i++) { P = lmul(P, boostAlong([Math.cos(heading), Math.sin(heading), 0], a)); heading += q.turn; } return { P, q }; };
    for (let i = 0; i < 200; i++) { const a = 0.05 + 3 * R(), { P, q } = carry(a); e = Math.max(e, maxAbs(P, rotZ(-q.area)) / Math.cosh(2 * a)); }
    check("S7  four non-turning slides round the regular quadrilateral of side a compose to rotZ(-(2 pi - 4 alpha)): home again, turned clockwise by the area", e, 1e-11);
    const { P } = carry(2 * Math.acosh(Math.SQRT1_2 / Math.sin(Math.PI / 5)));
    check("S7  round one {4,5} square: turned by exactly 72 deg = 2 pi/5 (five circuits restore the original facing)", maxAbs(P, rotZ(-2 * Math.PI / 5)), 1e-12);
  }
  { // velocity <-> ball coordinate: Poincare radius tanh(d/2) = beta/(1 + sqrt(1 - beta^2)); Klein radius = beta = tanh d
    let e = 0;
    for (let i = 0; i < 500; i++) { const d = 4 * R(), beta = Math.tanh(d), h = lapply(boostX(d), O);
      e = Math.max(e, Math.abs(toBall(h)[0] - beta / (1 + Math.sqrt(1 - beta * beta))), Math.abs(h[0] / h[3] - beta), Math.abs(toBall(h)[0] - Math.tanh(d / 2))); }
    check("S8  boostX(d).O has Poincare radius tanh(d/2) = beta/(1+sqrt(1-beta^2)) and Klein radius x/t = beta = tanh d", e, 1e-12);
  }
  { let e = 0, big = 0, eA = 0;
    for (let i = 0; i < 2000; i++) { const z = randDisc(R, 0.97), s = randDisc(R, 0.97), c = S.dragCentre(z, s);
      e = Math.max(e, C.abs(C.sub(T(c, z), s))); big = Math.max(big, C.abs(c));
      const d1 = 0.05 + 3 * R(), d2 = 0.05 + 3 * R(), phi = 0.05 + (Math.PI - 0.1) * R(), { theta, dw } = S.wignerAngle(d1, d2, phi);
      eA = Math.max(eA, Math.abs(S.triangleArea(d1, d2, dw) - theta)); }
    check("S9  dragCentre(z, s): T_c'(z) = s exactly (the grabbed point stays under the pointer, with no turning term)", e, 1e-11);
    check("S9  dragCentre always returns a point inside the unit disc", big < 1 ? 0 : 1, 0);
    check("S10 triangleArea(d1, d2, dw) = turning angle of item 2: cos(theta/2) = (1 + cosh d1 + cosh d2 + cosh dw)/(4 cosh(d1/2) cosh(d2/2) cosh(dw/2))", eA, 1e-7);
  }
  { // right-angle walk: closes after n legs going k times round iff cosh(a/2) = sqrt2 cos(pi k/n), n > 4k
    let e = 0, early = 0;
    for (const [n, k] of [[5, 1], [6, 1], [9, 2], [11, 2], [13, 3]]) { const a = 2 * Math.acosh(Math.SQRT2 * Math.cos(Math.PI * k / n));
      const W = S.walk(a, Math.PI / 2, n); e = Math.max(e, maxAbs(W, IDENT));
      let M = IDENT.slice(); for (let j = 1; j < n; j++) { M = lmul(M, lmul(boostX(a), rotZ(Math.PI / 2))); if (maxAbs(M, IDENT) < 1e-6) early++; } }
    check("S11 walk(2 acosh(sqrt2 cos(pi k/n)), pi/2, n) = identity for (n,k) = (5,1),(6,1),(9,2),(11,2),(13,3), and not before n legs", early ? Infinity : e, 1e-9);
    // at and beyond a* = 2 ln(1+sqrt2) the walker never returns: distance from the start increases at every one of 40 legs
    let mono = 0; for (const a of [2 * Math.log(1 + Math.SQRT2), 1.8, 2.5, 4]) { let M = IDENT.slice(), prev = 0; for (let j = 1; j <= 40; j++) { M = lmul(M, lmul(boostX(a), rotZ(Math.PI / 2))); const d = Math.acosh(M[15]); if (!(d > prev)) mono++; prev = d; } }
    check("S11 for a = a*, 1.8, 2.5, 4 the distance from the start increases at each of 40 right-angle legs", mono, 0);
  }
  return checks;
}

test("ported helpers: the 21 snippet tests", async (t) => {
  const checks = snippetChecks();
  assert.equal(checks.length, 21);
  for (const { name, err, tol } of checks) {
    await t.test(name, () => assert.ok(Number.isFinite(err) && err <= tol, `max error ${err} exceeds the tolerance ${tol}`));
  }
});

test("ported helpers: the square walk of the report (gap, clockwise turn and bearing for six steps; four legs never close)", () => {
  // step a, gap D, clockwise turn in degrees, bearing of the end seen from the start in degrees
  const rows = [[0.1, 0.000709, 0.5749, 134.7126], [0.5, 0.094018, 15.5890, 127.2055], [1, 0.874463, 78.0148, 95.9926],
    [1.5, 2.919439, 175.6804, 47.1598], [2, 5.311824, 226.3401, 21.8299], [3, 9.711439, 257.2752, 6.3624]];
  for (const [a, gap, turn, bearing] of rows) {
    close(H.squareWalkGap(a), gap, 5e-7, `gap for a = ${a}`);
    close(H.squareWalkTurn(a) * DEG, turn, 5e-5, `turn for a = ${a}`);
    close(H.squareWalkBearing(a) * DEG, bearing, 5e-5, `bearing for a = ${a}`);
    const end = originOf(H.walk(a, Math.PI / 2, 4));
    close(Math.asinh(Math.hypot(end[0], end[1])), gap, 5e-7, `walked gap for a = ${a}`);
  }
  // right-angle legs close only after five or more: the step for n legs
  for (const [n, a] of [[5, 1.061275], [6, 1.316958], [7, 1.449075], [8, 1.528571]]) close(H.rightAngledPolygonSide(n), a, 5e-7, `n = ${n}`);
  assert.ok(maxAbs(H.walk(H.rightAngledPolygonSide(5), Math.PI / 2, 5), IDENT) < 1e-12);
  assert.ok(maxAbs(H.walk(H.rightAngledPolygonSide(5), Math.PI / 2, 4), IDENT) > 0.1, "four legs of that step are not home");
});

test("ported helpers: regular quadrilaterals, the Lambert angle (0.5, 0.5 gives 74.2441 degrees) and the two-slide turn of 24.109145 degrees", () => {
  // side a, interior angle, turn, area, circumradius, inradius
  const rows = [[0.1, 89.856999, 90.143001, 0.009983, 0.070681, 0.049938], [0.5, 86.561040, 93.438960, 0.240085, 0.350055, 0.242534],
    [1, 77.669394, 102.330606, 0.860839, 0.682666, 0.447074], [1.5, 66.208210, 113.791790, 1.660980, 0.992024, 0.598730],
    [2, 54.547653, 125.452347, 2.475041, 1.281385, 0.702397], [3, 34.985881, 145.014119, 3.840710, 1.822000, 0.812689]];
  for (const [a, angle, turn, area, R, r] of rows) {
    const q = H.regularQuad(a);
    close(q.angle * DEG, angle, 5e-7, `angle for a = ${a}`); close(q.turn * DEG, turn, 5e-7, `turn for a = ${a}`);
    close(q.area, area, 5e-7, `area for a = ${a}`); close(q.R, R, 5e-7, `R for a = ${a}`); close(q.r, r, 5e-7, `r for a = ${a}`);
    assert.ok(q.angle < Math.PI / 2, "no hyperbolic quadrilateral has four right angles");
  }
  close(H.lambertAngle(0.5, 0.5) * DEG, 74.2441, 5e-5, "lambertAngle(0.5, 0.5)");
  close(Math.cos(H.lambertAngle(0.3, 0.7)), Math.sinh(0.3) * Math.sinh(0.7), 1e-15, "cos of the fourth angle is sinh a sinh b");
  assert.equal(H.lambertAngle(1, 1), null, "sinh(1)² is above 1: no fourth corner");
  // boostAlong(+y, 1) . boostAlong(+x, 1) = rotZ(24.109145°) . a slide of 1.513374
  const d = H.discForm(lmul(boostAlong([0, 1, 0], 1), boostAlong([1, 0, 0], 1)));
  close(d.theta * DEG, 24.109145, 5e-7, "the turn of two unit slides at right angles");
  close(2 * Math.atanh(Math.hypot(d.c[0], d.c[1])), 1.513374, 5e-7, "their net slide");
  const w = H.wignerAngle(1, 1, Math.PI / 2);
  close(w.theta * DEG, 24.109145, 5e-7, "wignerAngle turn"); close(w.dw, 1.513374, 5e-7, "wignerAngle slide");
  close(H.triangleArea(1, 1, w.dw) * DEG, 24.109145, 5e-7, "the turn is the area of the triangle gone round");
});

test("ported helpers: centreOn equals the Möbius map T_c on random disc points (1e-12)", () => {
  const R = rng(5);
  let worst = 0, offPlane = 0;
  for (let i = 0; i < 5000; i++) {
    const c = randDisc(R), z = randDisc(R), moved = H.moveBall(H.centreOn([c[0], c[1], 0]), [z[0], z[1], 0]), want = T(c, z);
    worst = Math.max(worst, Math.hypot(moved[0] - want[0], moved[1] - want[1]));
    offPlane = Math.max(offPlane, Math.abs(moved[2]));
  }
  atMost(worst, 1e-12, "centreOn against T_c");
  assert.equal(offPlane, 0, "a disc point stays in the disc");
  // the move brings c to the centre and does not turn there: a small step at c keeps its direction
  const c = [0.3, -0.4], h = 1e-6;
  assert.deepEqual(H.moveBall(H.centreOn([c[0], c[1], 0]), [c[0], c[1], 0]).map((v) => Math.abs(v) < 1e-15), [true, true, true]);
  for (const phi of [0, 1, 2.5, 4]) {
    const moved = H.moveBall(H.centreOn([c[0], c[1], 0]), [c[0] + h * Math.cos(phi), c[1] + h * Math.sin(phi), 0]);
    close(wrap(Math.atan2(moved[1], moved[0]) - phi), 0, 1e-5, `a step at c in direction ${phi}`);
    close(Math.hypot(moved[0], moved[1]) / h, 1 / (1 - 0.25), 1e-5, "stretched by T_c'(c) = 1 / (1 - |c|²)");
  }
});

test("ported helpers: equalAreaRings(3, 4), its cell area 0.890215635, and the 64 equal cells of equalAreaRings(1.5, 4)", () => {
  const r3 = H.equalAreaRings(3, 4);
  [1.852700573, 2.395761977, 2.743232711, 3].forEach((v, i) => close(r3[i], v, 5e-10, `ring ${i + 1} of equalAreaRings(3, 4)`));
  [0.728887739, 0.833007123, 0.879060038, 0.905148254].forEach((v, i) => close(H.discRadius(r3[i]), v, 5e-10, `disc radius of ring ${i + 1}`));
  for (let i = 0; i < 4; i++) close(H.cellArea(r3, i, 16), 0.890215635, 5e-10, `cell area of ring ${i + 1}`);
  // equally spaced rings do not have equal cells: the outer cell is 17.89 times the inner one
  const e3 = H.equalStepRings(3, 4);
  assert.deepEqual(e3, [0.75, 1.5, 2.25, 3]);
  [0.115721855, 0.415368159, 0.959818569, 2.069953956].forEach((v, i) => close(H.cellArea(e3, i, 16), v, 5e-10, `equal-step cell ${i + 1}`));
  close(H.cellArea(e3, 3, 16) / H.cellArea(e3, 0, 16), 17.89, 5e-3, "outer over inner");
  // the word wheel: 16 sectors x 4 rings inside hyperbolic radius 1.5 are 64 cells of one area, 0.1328 each
  const r = H.equalAreaRings(1.5, 4), areas = [];
  for (let ring = 0; ring < 4; ring++) for (let sector = 0; sector < 16; sector++) areas.push(H.cellArea(r, ring, 16));
  assert.equal(areas.length, 64);
  for (const a of areas) close(a, areas[0], 1e-15, "every cell has the same area");
  close(areas[0], 0.1328, 5e-5, "one cell");
  close(areas.reduce((s, a) => s + a, 0), TWO_PI * (Math.cosh(1.5) - 1), 1e-12, "the 64 cells make up the disc of radius 1.5");
  assert.equal(r[3], 1.5);
  // with any number of sectors and rings the cells of equalAreaRings share the disc equally
  for (const [RHO, rings, sectors] of [[1.5, 4, 8], [2, 3, 5], [0.7, 6, 1], [3, 2, 24]]) {
    const radii = H.equalAreaRings(RHO, rings), one = TWO_PI * (Math.cosh(RHO) - 1) / (rings * sectors);
    assert.equal(radii.length, rings);
    for (let i = 0; i < rings; i++) close(H.cellArea(radii, i, sectors), one, 1e-12 * (1 + one), `${rings} rings x ${sectors} sectors inside ${RHO}`);
  }
  // ring thicknesses on a wheel of radius 150 px: 89.8, 28.9, 18.3, 13.0
  const s = r.map(H.discRadius);
  [89.8, 28.9, 18.3, 13.0].forEach((px, i) => close(150 * (s[i] - (i ? s[i - 1] : 0)) / s[3], px, 0.05, `thickness of ring ${i + 1}`));
});

test("ported helpers: aberrate matches skyImage (the examples for rapidity 1; every point but the two poles moves towards u)", () => {
  // boostAlong(u, 1): a rim point 30° from u goes to 11.26°, and so on
  for (const [before, after] of [[30, 11.26], [60, 23.98], [90, 40.40], [120, 65.01], [150, 107.86]]) {
    close(H.aberrate(before * RAD, 1) * DEG, after, 5e-3, `${before} degrees`);
    const img = H.skyImage(boostX(1), [Math.cos(before * RAD), Math.sin(before * RAD), 0]);
    close(Math.atan2(img.n[1], img.n[0]) * DEG, after, 5e-3, `skyImage at ${before} degrees`);
    close(Math.hypot(...img.n), 1, 1e-15, "the image is on the rim");
  }
  const R = rng(77);
  let worst = 0, worstLaw = 0;
  for (let i = 0; i < 2000; i++) {
    const u = randUnit3(R), n = randUnit3(R), d = 3 * R(), theta = angle3(u, n), img = H.skyImage(boostAlong(u, d), n), after = angle3(u, img.n);
    worst = Math.max(worst, Math.abs(after - H.aberrate(theta, d)));
    // cos θ' = (cos θ + β) / (1 + β cos θ), β = tanh d, and the stretch factor is λ = cosh d + sinh d cos θ
    const beta = Math.tanh(d);
    worstLaw = Math.max(worstLaw, Math.abs(Math.cos(after) - (Math.cos(theta) + beta) / (1 + beta * Math.cos(theta))), Math.abs(img.lambda - (Math.cosh(d) + Math.sinh(d) * Math.cos(theta))) / img.lambda);
    assert.ok(after <= theta + 1e-12, "the point moved towards u");
  }
  atMost(worst, 1e-9, "aberrate against skyImage");
  atMost(worstLaw, 1e-9, "the aberration law");
  assert.equal(H.aberrate(0, 2), 0);
  close(H.aberrate(Math.PI, 2), Math.PI, 1e-12, "the point opposite u stays");
});

test("ported helpers: fromBall and moveBall undo toBall, and conformalFactor is 2 / (1 - |p|²)", () => {
  const R = rng(12);
  for (let i = 0; i < 500; i++) {
    const p = randBall(R), h = H.fromBall(p);
    close(h[0] * h[0] + h[1] * h[1] + h[2] * h[2] - h[3] * h[3], -1, 1e-9 * h[3] * h[3], "fromBall lands on the hyperboloid");
    atMost(maxAbs(toBall(h), p), 1e-14, "toBall(fromBall(p)) = p");
    atMost(maxAbs(H.moveBall(IDENT, p), p), 1e-14, "the identity moves nothing");
    close(H.conformalFactor(p), 2 / (1 - dot3(p, p)), 0, "ball point");
    close(H.conformalFactor(p), 1 + h[3], 1e-12 * h[3], "2 / (1 - |p|²) = 1 + t on the hyperboloid");
    close(H.conformalFactor([p[0], p[1]]), 2 / (1 - (p[0] * p[0] + p[1] * p[1])), 0, "disc point");
  }
  assert.equal(H.conformalFactor([0, 0]), 2);
  assert.equal(H.conformalFactor([0, 0, 0]), 2);
  close(H.conformalFactor([0.5, 0, 0]), 8 / 3, 1e-15, "at half the radius");
  // at hyperbolic distance rho the factor is 2 cosh²(rho / 2)
  close(H.conformalFactor([Math.tanh(0.7), 0]), 2 * Math.cosh(0.7) ** 2, 1e-12, "in terms of distance");
});

// ─── 3.1 tilings ─────────────────────────────────────────────────────────────

test("tilings: the constants of {4,5}, {4,6} and {4,8}; a flat or spherical {p,q} is refused", () => {
  // q, side, circumradius, its disc radius, inradius, its disc radius, area
  const rows = [[5, 1.253739326, 0.842482081, 0.397975427, 0.530637531, 0.259263587, TWO_PI / 5],
    [6, 1.762747174, 1.146215835, 0.517638090, 0.658478948, 0.317837245, TWO_PI / 3],
    [8, 2.448452448, 1.528570919, 0.643594253, 0.764285460, 0.364566859, Math.PI]];
  for (const [q, side, R, discR, r, discr, area] of rows) {
    const k = H.tilingConstants(4, q);
    close(k.side, side, 5e-10, `{4,${q}} side`); close(k.R, R, 5e-10, `{4,${q}} R`); close(k.discR, discR, 5e-10, `{4,${q}} disc R`);
    close(k.r, r, 5e-10, `{4,${q}} r`); close(k.discr, discr, 5e-10, `{4,${q}} disc r`); close(k.area, area, 1e-12, `{4,${q}} area`);
    close(k.angle, TWO_PI / q, 1e-15, `{4,${q}} corner`);
    assert.equal(k.p, 4); assert.equal(k.q, q);
    // the same square from regularQuad: its corner is 2 pi / q
    const quad = H.regularQuad(k.side);
    close(quad.angle, k.angle, 1e-12, "corner angle of the square of that side"); close(quad.R, k.R, 1e-12, "circumradius"); close(quad.r, k.r, 1e-12, "inradius");
  }
  for (const [p, q] of [[4, 4], [3, 6], [6, 3], [4, 3], [3, 3], [5, 3]]) throwsPlain(() => H.tilingConstants(p, q), "{p,q} is not hyperbolic");
  throwsPlain(() => H.generateTiling(4, 4, 2), "{p,q} is not hyperbolic");
});

test("tilings: generateTiling(4,5,6) has 597 tiles in layers 1, 4, 12, 28, 64, 148, 340 and generateTiling(4,6,6) 929 in 1, 4, 12, 32, 84, 220, 576", () => {
  for (const [q, total, counts] of [[5, 597, [1, 4, 12, 28, 64, 148, 340]], [6, 929, [1, 4, 12, 32, 84, 220, 576]]]) {
    const { constants: k, tiles } = H.generateTiling(4, q, 6);
    assert.equal(tiles.length, total);
    const layers = new Array(7).fill(0);
    for (const tile of tiles) layers[tile.layer]++;
    assert.deepEqual(layers, counts);
    assert.deepEqual(tiles[0].centre, [0, 0, 0, 1]);
    // no duplicates: all centres are at least 2r apart, and the nearest are exactly 2r apart
    let nearest = Infinity;
    for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i].centre, b = tiles[j].centre;
      nearest = Math.min(nearest, a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]);
    }
    close(Math.acosh(nearest), 2 * k.r, 1e-7, `{4,${q}} nearest centres`);
    // every tile is a frame: its four edge midpoints are r from its centre, and each layer-n tile touches layer n - 1
    for (const tile of tiles) {
      assert.deepEqual(tile.centre, originOf(tile.M));
      for (let j = 0; j < 4; j++) close(hypDist(tile.centre, lapply(lmul(tile.M, lmul(rotZ(j * Math.PI / 2), boostX(k.r))), O)), k.r, 1e-6, "edge midpoint");
    }
    for (const tile of tiles.filter((x) => x.layer > 0 && x.layer < 4)) {
      assert.ok(tiles.some((x) => x.layer === tile.layer - 1 && Math.abs(hypDist(x.centre, tile.centre) - 2 * k.r) < 1e-6), "an edge neighbour one layer in");
    }
  }
  // by corners instead of edges the first corona has 4(q - 1) - 4 tiles
  for (const [q, counts] of [[5, [1, 12, 48]], [6, [1, 16, 96]]]) {
    const layers = [0, 0, 0];
    for (const tile of H.generateTiling(4, q, 2, "vertex").tiles) layers[tile.layer]++;
    assert.deepEqual(layers, counts);
  }
});

// ─── 3.2 slides ──────────────────────────────────────────────────────────────

const square = (a) => [0, 1, 2, 3].map((k) => ({ angle: k * Math.PI / 2, dist: a }));   // forward, left, back, right

test("slides: forward, left, back, right by 1 ends 0.874463 from home; slid home, the body is found turned 78.0148 degrees clockwise", () => {
  const frames = H.slidePath(square(1));
  assert.equal(frames.length, 5);
  assert.deepEqual(frames[0], [...IDENT]);
  assert.notEqual(frames[0], IDENT, "a copy, not the frozen identity itself");
  for (const F of frames) atMost(lorentzDefect(F), 1e-12, "every frame is a Lorentz matrix");
  const home = H.homecoming(frames[4]);
  close(home.distance, H.squareWalkGap(1), 1e-12, "the gap is squareWalkGap(1)");
  close(home.distance, 0.874463, 5e-7, "the gap");
  close(home.turn * DEG, -78.0148, 1e-4, "turn (anticlockwise positive)");
  close(home.turnClockwise * DEG, 78.0148, 1e-4, "turnClockwise");
  close(home.turnClockwise, H.squareWalkTurn(1), 1e-12, "the closed form");
  // never turning the body gives the very frame of the walk that turns left after each leg
  atMost(maxAbs(frames[4], H.walk(1, Math.PI / 2, 4)), 1e-12, "last frame against walk(1, pi/2, 4)");
  // each slide alone turns nothing: one step out, and the body faces as it did
  for (const s of square(1)) {
    const one = H.homecoming(H.slidePath([s])[1]);
    close(one.distance, 1, 1e-14, "one slide of 1"); close(one.turn, 0, 1e-14, "no turn after one slide"); close(wrap(one.turnClockwise), 0, 1e-14, "none clockwise either");
  }
  // on a flat floor both would be zero; here the turn is the area gone round (the pentagon home, P1, P2, P3, end)
  // as a fan of triangles from home; the disc is conformal, so each triangle's sense is that of its flat picture
  const P = frames.map(originOf);
  let area = 0;
  for (let i = 1; i < 4; i++) {
    const a = toBall(P[i]), b = toBall(P[i + 1]);
    area += Math.sign(a[0] * b[1] - a[1] * b[0]) * H.triangleArea(hypDist(P[0], P[i]), hypDist(P[0], P[i + 1]), hypDist(P[i], P[i + 1]));
  }
  close(home.turnClockwise, area, 1e-9, "the turn equals the area inside the five-sided path");
  close(area * DEG, 78.0148, 1e-4, "that area, in degrees");
});

test("slides: two unit slides at right angles turn the body by 24.109145 degrees, to the right after forward then left, to the left after forward then right", () => {
  const left = H.homecoming(H.slidePath([{ angle: 0, dist: 1 }, { angle: Math.PI / 2, dist: 1 }])[2]);
  const right = H.homecoming(H.slidePath([{ angle: 0, dist: 1 }, { angle: -Math.PI / 2, dist: 1 }])[2]);
  close(left.turn * DEG, -24.109145, 5e-7, "forward then left");
  close(right.turn * DEG, 24.109145, 5e-7, "forward then right");
  close(left.turnClockwise * DEG, 24.109145, 5e-7, "forward then left, clockwise");
  close(right.turnClockwise * DEG, 360 - 24.109145, 5e-7, "forward then right, clockwise");
  close(left.distance, 1.513374, 5e-7, "the straight way home"); close(right.distance, left.distance, 1e-14, "the mirror path is as long");
  close(H.composeTranslations([Math.tanh(0.5), 0], [0, Math.tanh(0.5)]).theta * DEG, 24.109145, 5e-7, "composeTranslations");
});

test("slides: at a = 1.75 the clockwise turn is 206.84 degrees, past the half turn that turn alone would hide", () => {
  const home = H.homecoming(H.slidePath(square(1.75))[4]);
  close(home.turnClockwise * DEG, 206.84, 0.01, "turnClockwise");
  close(home.turn * DEG, 153.16, 0.01, "turn wraps to +153.16");
  close(home.turnClockwise, H.squareWalkTurn(1.75), 1e-9, "the closed form");
  // over the range of the lab's step slider the two always agree
  for (let a = 0.25; a <= 1.5001; a += 0.125) {
    const h = H.homecoming(H.slidePath(square(a))[4]);
    close(h.turnClockwise, H.squareWalkTurn(a), 1e-10, `turnClockwise for a = ${a}`);
    close(h.distance, H.squareWalkGap(a), 1e-10, `distance for a = ${a}`);
    assert.ok(h.turn > -Math.PI && h.turn <= Math.PI && h.turnClockwise >= 0 && h.turnClockwise < TWO_PI);
  }
});

test("slides: four slides round one {4,5} tile (headings 0, 108, 216, 324 degrees) come home turned 72 degrees clockwise, the area of the tile", () => {
  const k = H.tilingConstants(4, 5);
  close(k.side, 1.253739, 5e-7, "the side of a {4,5} square");
  const frames = H.slidePath([0, 108, 216, 324].map((heading) => ({ angle: heading * RAD, dist: k.side })));
  const home = H.homecoming(frames[4]);
  atMost(home.distance, 1e-9, "home again");
  close(home.turn * DEG, -72, 1e-6, "turn");
  close(home.turnClockwise * DEG, 72, 1e-6, "turnClockwise");
  close(home.turnClockwise, k.area, 1e-9, "the area of one {4,5} square");
  close(k.area, TWO_PI / 5, 1e-15, "which is 2 pi / 5");
  // five times round restores the facing
  let F = IDENT.slice();
  for (let lap = 0; lap < 5; lap++) F = lmul(F, frames[4]);
  atMost(maxAbs(F, IDENT), 1e-12, "five laps");
  // the same slides with a rounded side do not close: the test above is about the tile, not about any four slides
  const off = H.homecoming(H.slidePath([0, 108, 216, 324].map((heading) => ({ angle: heading * RAD, dist: 1.2 })))[4]);
  assert.ok(off.distance > 0.01);
});

test("slides: five slides of rightAngledPolygonSide(5) = 1.061275 (forward, left, back, right, forward) come home, a quarter turn to the right", () => {
  const five = (step) => H.homecoming(H.slidePath([0, 1, 2, 3, 0].map((k) => ({ angle: k * Math.PI / 2, dist: step })))[5]);
  const a = H.rightAngledPolygonSide(5);
  close(a, 1.061275, 5e-7, "the step");
  atMost(five(a).distance, 1e-9, "home after five slides");
  close(five(a).turnClockwise, Math.PI / 2, 1e-9, "turned by the area of the right-angled pentagon, 3 pi - 5 pi / 2");
  // the gap closes at that step and nowhere else on the lab's slider: it is already 0.016 at 0.005 to either side
  for (const step of [0.25, 0.5, 0.75, 1, 1.25, 1.5]) assert.ok(five(step).distance > 0.1, `a gap at step ${step}`);
  close(five(a - 0.005).distance, 0.0156, 5e-4, "just short of the step");
  close(five(a + 0.005).distance, 0.0160, 5e-4, "just past it");
});

test("slides: homecoming reads the turn of any frame, keeps turn in (-pi, pi] and turnClockwise in [0, 2 pi), and gives null turns beyond 12", () => {
  assert.deepEqual(H.homecoming(IDENT), { distance: 0, turn: 0, turnClockwise: 0 });
  assert.ok(Object.is(H.homecoming(rotZ(-0)).turn, 0), "a zero turn is written +0");
  // a body d away in the direction u and turned by psi: sliding it home leaves exactly the turn psi
  const R = rng(9);
  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    const t = TWO_PI * R(), d = 5 * R(), psi = (2 * R() - 1) * Math.PI;
    const home = H.homecoming(lmul(boostAlong([Math.cos(t), Math.sin(t), 0], d), rotZ(psi)));
    worst = Math.max(worst, Math.abs(wrap(home.turn - psi)), Math.abs(home.distance - d), Math.abs(wrap(home.turnClockwise + home.turn)));
    assert.ok(home.turn > -Math.PI && home.turn <= Math.PI, "turn in (-pi, pi]");
    assert.ok(home.turnClockwise >= 0 && home.turnClockwise < TWO_PI, "turnClockwise in [0, 2 pi)");
  }
  atMost(worst, 1e-9, "turn, distance and the clockwise form");
  close(H.homecoming(rotZ(Math.PI)).turn, Math.PI, 1e-15, "a half turn is +pi");
  assert.equal(H.homecoming([-1, 0, 0, 0, -0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]).turn, Math.PI, "also when atan2 would say -pi");
  assert.equal(H.homecoming([-1, 0, 0, 0, -0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]).turnClockwise, Math.PI);
  close(H.homecoming(rotZ(Math.PI)).turnClockwise, Math.PI, 1e-15, "and pi clockwise");
  close(H.homecoming(rotZ(0.25)).turnClockwise, TWO_PI - 0.25, 1e-15, "a turn to the left is the rest of the circle clockwise");
  // out of the plane the distance is still the distance from home
  for (let i = 0; i < 200; i++) {
    const d = 4 * R(), F = lmul(boostAlong(randUnit3(R), d), lmul(rotY(R()), rotZ(R())));
    close(H.homecoming(F).distance, d, 1e-12, "distance in 3D");
  }
  // farther than 12 from home the turn is reported as null (binary64 has too few digits left); the distance is still given
  const near = H.homecoming(H.slidePath([{ angle: 0.3, dist: 11.5 }])[1]);
  close(near.distance, 11.5, 1e-9, "11.5 out"); close(near.turn, 0, 1e-6, "still resolved at 11.5");
  const far = H.homecoming(H.slidePath([{ angle: 0.3, dist: 12.5 }])[1]);
  close(far.distance, 12.5, 1e-9, "12.5 out");
  assert.equal(far.turn, null); assert.equal(far.turnClockwise, null);
  const corner = H.homecoming(H.slidePath([{ angle: 0, dist: 8 }, { angle: Math.PI / 2, dist: 8 }])[2]);
  assert.ok(corner.distance > 15 && corner.distance < 16);
  assert.deepEqual([corner.turn, corner.turnClockwise], [null, null]);
  // a frame that is not made of numbers has no turn either
  const broken = H.homecoming(new Array(16).fill(NaN));
  assert.ok(Number.isNaN(broken.distance)); assert.equal(broken.turn, null); assert.equal(broken.turnClockwise, null);
});

test("slides: slidePath accepts any finite slides and refuses anything else with a plain message", () => {
  assert.deepEqual(H.slidePath([]), [[...IDENT]]);
  const back = H.slidePath([{ angle: 0.7, dist: 2 }, { angle: 0.7, dist: -2 }]);
  atMost(maxAbs(back[2], IDENT), 1e-12, "out and back along one line is home, unturned");
  // the angle is in the body's own fixed axes: the k-th position is the product of the boosts so far
  const slides = [{ angle: 0.4, dist: 0.8 }, { angle: 2.1, dist: 0.3 }, { angle: -1.2, dist: 1.1 }];
  const frames = H.slidePath(slides);
  let F = IDENT.slice();
  slides.forEach((s, i) => {
    F = lmul(F, boostAlong([Math.cos(s.angle), Math.sin(s.angle), 0], s.dist));
    assert.deepEqual(frames[i + 1], F);
  });
  throwsPlain(() => H.slidePath("forward"), "slides must be an array of { angle, dist }");
  throwsPlain(() => H.slidePath(), "slides must be an array of { angle, dist }");
  for (const bad of [null, 3, {}, { angle: 0 }, { angle: 0, dist: "1" }, { angle: NaN, dist: 1 }, { angle: 0, dist: Infinity }]) {
    throwsPlain(() => H.slidePath([{ angle: 0, dist: 1 }, bad]), "a slide needs a finite angle and a finite dist");
  }
});

// ─── 3.3 tree layout ─────────────────────────────────────────────────────────

const parentOf = (a) => { const i = a.lastIndexOf("."); return i < 0 ? "" : a.slice(0, i); };
const depthOf = (a) => (a === "" ? 0 : a.split(".").length);
function childrenOf(addresses) {
  const m = new Map([["", []]]);
  for (const a of addresses) m.set(a, []);
  for (const a of addresses) m.get(parentOf(a)).push(a);
  return m;
}
/** The depth-first listing (canonical order) of a set of addresses whose siblings were made in increasing order. */
function depthFirst(addresses) {
  const kids = childrenOf(addresses), out = [];
  (function walk(a) { for (const k of kids.get(a)) { out.push(k); walk(k); } })("");
  return out;
}
/** A seeded random tree in canonical order: up to maxEntries entries, depth up to maxDepth, fan-out up to maxFan,
 *  in four styles (uniform, deep, bushy, star) and with sparse increasing indices, as LEXICON/2 allows. */
function randomTree(R, maxEntries = 80, maxDepth = 7, maxFan = 14) {
  const n = 1 + Math.floor(R() * maxEntries), style = Math.floor(R() * 4);
  const nodes = [""], fan = new Map([["", 0]]), next = new Map([["", 0]]);
  for (let guard = 0; nodes.length - 1 < n && guard < 100000; guard++) {
    let p;
    if (style === 1) p = nodes[Math.max(0, nodes.length - 1 - Math.floor(R() * R() * nodes.length))];
    else if (style === 2) { p = nodes[Math.floor(R() * nodes.length)]; const q = nodes[Math.floor(R() * nodes.length)]; if (fan.get(q) > fan.get(p)) p = q; }
    else if (style === 3) p = nodes[Math.floor(R() * Math.min(nodes.length, 4))];
    else p = nodes[Math.floor(R() * nodes.length)];
    if (depthOf(p) >= maxDepth || fan.get(p) >= maxFan) continue;
    const index = next.get(p) + (R() < 0.2 ? 1 + Math.floor(R() * 20) : 0);
    next.set(p, index + 1);
    const a = p === "" ? String(index) : p + "." + index;
    nodes.push(a); fan.set(a, 0); next.set(a, 0); fan.set(p, fan.get(p) + 1);
  }
  return depthFirst(nodes.slice(1));
}
/** The named spine tree: `fan` children at every level, the middle one carrying the next level, `depth` levels. */
function spineTree(depth, fan) {
  const out = [], mid = Math.floor((fan - 1) / 2);
  (function level(prefix, d) {
    for (let j = 0; j < fan; j++) {
      const a = prefix === "" ? String(j) : prefix + "." + j;
      out.push(a);
      if (j === mid && d + 1 < depth) level(a, d + 1);
    }
  })("", 0);
  return out;
}
/** A point 0.2 from the origin in a random direction (in the plane z = 0 for 2D). */
function nearOrigin(R, dims) {
  let u;
  if (dims === "2D") { const t = TWO_PI * R(); u = [Math.cos(t), Math.sin(t), 0]; } else u = randUnit3(R);
  const s = Math.sinh(0.2);
  return [s * u[0], s * u[1], s * u[2], Math.cosh(0.2)];
}

const newStats = () => ({ layouts: 0, entries: 0, largest: 0, deepest: 0, widest: 0,
  edges: 0, worstLorentz: 0, pairs: 0, minSlack: Infinity, children: 0, worstChild: 0,
  sides: 0, wrongSide: 0, minClearance: Infinity, wallPoints: 0, worstWall: 0, worstFootEntry: 0, worstFootParent: 0, worstWallDistance: 0,
  hits: 0, missed: 0, misses: [], frameSets: 0, worstFrames: 0, wrongMembers: 0, outOfOrder: 0, cut: 0 });

/** Every check of the layout on one tree, through relative transforms only. Adds to st. */
function measure(addresses, dims, R, st) {
  // R is used for focuses and directions only: the trees come from their own generator
  const L = H.treeLayout(addresses, dims), kids = childrenOf(addresses), all = ["", ...addresses];
  st.layouts++; st.entries += addresses.length; st.largest = Math.max(st.largest, addresses.length);
  for (const a of addresses) st.deepest = Math.max(st.deepest, depthOf(a));
  for (const list of kids.values()) st.widest = Math.max(st.widest, list.length);
  const ch = new Map(all.map((a) => [a, Math.cosh(L.get(a).r)])), sh = new Map(all.map((a) => [a, Math.sinh(L.get(a).r)]));
  for (const a of all) { st.edges++; st.worstLorentz = Math.max(st.worstLorentz, lorentzDefect(L.get(a).edge)); }
  for (const a of all) {
    const ra = L.get(a).r;
    for (const b of all) {
      if (a === b) continue;
      const M = H.relativeFrame(L, a, b), rb = L.get(b).r;
      const d = Math.acosh(M[15]);                                   // the distance between the entries a and b
      st.pairs++; st.minSlack = Math.min(st.minSlack, d - ra - rb);
      if (L.get(b).parent === a) { st.children++; st.worstChild = Math.max(st.worstChild, Math.abs(d - (ra + rb))); }
      if (a !== "") {
        // the wall between a and its parent, in a's frame: a's side is s > 0; asinh(s) is the signed distance to it
        const s = M[3] * ch.get(a) + M[15] * sh.get(a), below = b.startsWith(a + ".");
        st.sides++;
        if (below ? !(s > 0) : !(s < 0)) st.wrongSide++;
        st.minClearance = Math.min(st.minClearance, (below ? Math.asinh(s) : -Math.asinh(s)) - rb);
      }
    }
    if (a !== "") {
      const wall = H.cellWall(L, a), parent = L.get(a).parent;
      for (const p of wall) {
        st.wallPoints++;
        st.worstWall = Math.max(st.worstWall, Math.abs(p[0] * ch.get(a) + p[3] * sh.get(a)) / p[3], Math.abs(p[0] * p[0] + p[1] * p[1] + p[2] * p[2] - p[3] * p[3] + 1) / (p[3] * p[3]));
      }
      const foot = wall[12];                                         // s = 0, the middle of 25 points
      st.worstFootEntry = Math.max(st.worstFootEntry, Math.abs(Math.acosh(foot[3]) - ra));
      st.worstFootParent = Math.max(st.worstFootParent, Math.abs(Math.acosh(lapply(L.get(a).edge, foot)[3]) - L.get(parent).r));
      // a wall point at s is at acosh(cosh r cosh s) from the entry: only the foot is at r
      const end = wall[0];
      st.worstWallDistance = Math.max(st.worstWallDistance, Math.abs(Math.acosh(end[3]) - Math.acosh(ch.get(a) * Math.cosh(4))));
    }
  }
  // cellAt: a point 0.2 from the origin of e, for every e within two edges of the focus
  const focuses = [""];
  for (let i = 0; i < 5; i++) focuses.push(all[Math.floor(R() * all.length)]);
  for (const focus of focuses) {
    for (const e of all) {
      if (H.treePath(focus, e).length - 1 > 2) continue;
      const p = lapply(H.relativeFrame(L, focus, e), nearOrigin(R, dims)), got = H.cellAt(L, focus, p);
      st.hits++;
      if (got !== e) { st.missed++; if (st.misses.length < 5) st.misses.push(`${dims} focus "${focus}" entry "${e}" got "${got}"`); }
    }
  }
  // relativeFrames: the frames of relativeFrame, in breadth-first order, not going past an entry farther than maxRho
  for (const [focus, maxRho] of [[focuses[1], 9], [focuses[2], 3], [focuses[3], Infinity]]) {
    const frames = maxRho === 9 ? H.relativeFrames(L, focus) : H.relativeFrames(L, focus, maxRho), limit = Math.cosh(maxRho);
    st.frameSets++;
    let steps = 0;
    for (const [b, F] of frames) {
      const M = H.relativeFrame(L, focus, b);
      st.worstFrames = Math.max(st.worstFrames, maxAbs(F, M) / M[15]);
      const n = H.treePath(focus, b).length - 1;
      if (n < steps) st.outOfOrder++;
      steps = n;
    }
    for (const b of all) {
      const before = H.treePath(focus, b).slice(0, -1);              // the entries passed on the way to b
      const reachable = before.every((c) => H.relativeFrame(L, focus, c)[15] <= limit);
      if (frames.has(b) !== reachable) st.wrongMembers++;
      if (!reachable) st.cut++;
    }
  }
  return L;
}

async function layoutChecks(t, st, name) {
  await t.test(`${name}: every edge E satisfies Eᵀ η E = η (1e-12)`, () => {
    assert.ok(st.edges > 0); atMost(st.worstLorentz, 1e-12, "largest entry of Eᵀ η E − η");
  });
  await t.test(`${name}: any two entries are at least r_i + r_j apart (acosh of the last entry of relativeFrame, to 1e-9)`, () => {
    assert.ok(st.pairs > 0); assert.ok(st.minSlack >= -1e-9, `smallest distance minus r_i + r_j is ${st.minSlack}`);
  });
  await t.test(`${name}: each child is r(parent) + r(child) from its parent (1e-9)`, () => {
    assert.equal(st.children, st.entries); atMost(st.worstChild, 1e-9, "largest error");
  });
  await t.test(`${name}: no entry lies on the wrong side of any wall, and each keeps its own radius clear of it`, () => {
    assert.ok(st.sides > 0); assert.equal(st.wrongSide, 0);
    assert.ok(st.minClearance >= -1e-9, `smallest clearance minus the entry's own radius is ${st.minClearance}`);
  });
  await t.test(`${name}: cellWall points satisfy p_x cosh r + p_t sinh r = 0 (1e-9 of p_t); the foot is r from the entry and r(parent) from the parent`, () => {
    assert.equal(st.wallPoints, 25 * st.entries);
    atMost(st.worstWall, 1e-9, "wall equation and hyperboloid equation, relative to p_t");
    atMost(st.worstFootEntry, 1e-9, "foot to entry"); atMost(st.worstFootParent, 1e-9, "foot to parent");
    atMost(st.worstWallDistance, 1e-9, "a wall point at s is acosh(cosh r cosh s) from the entry");
  });
  await t.test(`${name}: cellAt finds e from a point 0.2 from its origin, for every e within two edges of the focus`, () => {
    assert.ok(st.hits > 0); assert.deepEqual(st.misses, []); assert.equal(st.missed, 0);
  });
  await t.test(`${name}: relativeFrames gives the frames of relativeFrame, nearest first, and does not go past an entry farther than maxRho`, () => {
    assert.ok(st.frameSets > 0); atMost(st.worstFrames, 1e-12, "frame against relativeFrame, relative to its size");
    assert.equal(st.outOfOrder, 0, "breadth-first order"); assert.equal(st.wrongMembers, 0, "which entries are in the Map");
  });
}

test("layout: 300 seeded random trees per dims (up to 80 entries, depth up to 7, fan-out up to 14)", async (t) => {
  const stats = { "2D": newStats(), "3D": newStats() };
  const trees = rng(20261114), R = rng(7);
  for (let i = 0; i < 300; i++) {
    const tree = randomTree(trees);
    assert.deepEqual(tree, depthFirst(tree), "canonical order");
    for (const dims of ["2D", "3D"]) measure(tree, dims, R, stats[dims]);
  }
  for (const dims of ["2D", "3D"]) {
    const st = stats[dims];
    await t.test(`${dims}: the trees cover the stated range`, () => {
      assert.equal(st.layouts, 300); assert.equal(st.largest, 80); assert.equal(st.deepest, 7); assert.equal(st.widest, 14);
      assert.ok(st.pairs > 500000, `${st.pairs} ordered pairs of entries`);
      assert.ok(st.cut > 1000, "the maxRho rule was exercised");
    });
    await layoutChecks(t, st, dims);
    t.diagnostic(`${dims}: ${st.entries} entries, ${st.pairs} ordered pairs (smallest slack ${st.minSlack.toExponential(1)}), ${st.sides} wall-side checks, ${st.hits} cellAt hits, edge defect ${st.worstLorentz.toExponential(1)}`);
  }
});

test("layout: the named 54-entry spine tree (depth 6, 9 children per node), which breaks absolute frames", async (t) => {
  const tree = spineTree(6, 9);
  assert.equal(tree.length, 54);
  assert.deepEqual(tree, depthFirst(tree), "canonical order");
  assert.equal(Math.max(...tree.map(depthOf)), 6);
  const R = rng(54);
  for (const dims of ["2D", "3D"]) {
    const st = newStats(), L = measure(tree, dims, R, st);
    assert.equal(st.widest, 9);
    await layoutChecks(t, st, dims);
    // every pair, also through relativeFrames from each entry
    await t.test(`${dims}: the same distances from relativeFrames(layout, entry, Infinity)`, () => {
      for (const a of ["", ...tree]) {
        const frames = H.relativeFrames(L, a, Infinity);
        assert.equal(frames.size, 55);
        for (const [b, F] of frames) if (b !== a) assert.ok(Math.acosh(F[15]) >= L.get(a).r + L.get(b).r - 1e-9, `${a} to ${b}`);
      }
    });
  }
  await t.test("2D: absolute frames (edges multiplied from the root) lose the child distance; relative frames keep it", () => {
    const L = H.treeLayout(tree, "2D"), absolute = new Map([["", IDENT.slice()]]);
    for (const a of tree) absolute.set(a, lmul(absolute.get(L.get(a).parent), L.get(a).edge));
    let worstAbsolute = 0, worstRelative = 0, farthest = 0;
    for (const a of tree) {
      const p = L.get(a).parent, want = L.get(p).r + L.get(a).r;
      worstAbsolute = Math.max(worstAbsolute, Math.abs(hypDist(originOf(absolute.get(p)), originOf(absolute.get(a))) - want));
      worstRelative = Math.max(worstRelative, Math.abs(Math.acosh(H.relativeFrame(L, p, a)[15]) - want));
      farthest = Math.max(farthest, Math.acosh(H.relativeFrame(L, "", a)[15]));
    }
    assert.ok(farthest > 20, `the farthest entry is ${farthest} from the root`);
    assert.ok(worstAbsolute > 1e-3, `absolute frames are wrong by ${worstAbsolute}`);
    atMost(worstRelative, 1e-9, "relative frames");
  });
});

test("layout: at depth 8 in a chain of 12-spoke nodes the parent is found at r(parent) + r(child) within 1e-9", () => {
  // the root has 12 children; child 5 has 11 children (12 spokes with its parent), and so on down to depth 8
  const made = [];
  let p = "";
  for (let d = 0; d < 8; d++) {
    for (let k = 0; k < (d === 0 ? 12 : 11); k++) made.push(p === "" ? String(k) : `${p}.${k}`);
    p = p === "" ? "5" : `${p}.5`;
  }
  const tree = depthFirst(made), deep = "5.5.5.5.5.5.5.5", parent = "5.5.5.5.5.5.5";
  assert.equal(tree.length, 89); assert.ok(tree.includes(deep)); assert.equal(depthOf(deep), 8);
  for (const dims of ["2D", "3D"]) {
    const L = H.treeLayout(tree, dims), kids = childrenOf(tree), want = L.get(parent).r + L.get(deep).r;
    assert.equal(kids.get(parent).length + 1, 12, "twelve spokes");
    if (dims === "2D") close(L.get(parent).r, Math.atanh(Math.cos(Math.PI / 12)), 1e-15, "the radius of a 12-spoke node");
    assert.ok(L.get(parent).r > H.R_MIN);
    const frames = H.relativeFrames(L, deep);
    close(Math.acosh(frames.get(parent)[15]), want, 1e-9, `${dims}: parent seen from the deep entry`);
    close(Math.acosh(H.relativeFrame(L, deep, parent)[15]), want, 1e-9, `${dims}: relativeFrame up`);
    close(Math.acosh(H.relativeFrame(L, parent, deep)[15]), want, 1e-9, `${dims}: relativeFrame down`);
    // the parent's other children, all seen from the deep entry: each is r(parent) + r(sibling) from the parent
    for (const s of kids.get(parent)) {
      close(hypDist(originOf(frames.get(parent)), originOf(frames.get(s))), L.get(parent).r + L.get(s).r, 1e-9, `${dims}: ${s} to its parent, in the deep entry's frame`);
      if (s !== deep) assert.ok(Math.acosh(frames.get(s)[15]) >= L.get(deep).r + L.get(s).r - 1e-9);
    }
    // and the whole way up: the root is seen where the product of the eight inverse edges puts it
    const up = H.relativeFrame(L, deep, ""), down = H.relativeFrame(L, "", deep);
    atMost(maxAbs(lmul(up, down), IDENT) / (up[15] * up[15]), 1e-12, `${dims}: up then down is the identity, relative to the size of the frames`);
    // the same question asked of absolute frames has no answer left in binary64
    const absolute = new Map([["", IDENT.slice()]]);
    for (const a of tree) absolute.set(a, lmul(absolute.get(L.get(a).parent), L.get(a).edge));
    assert.ok(Math.abs(hypDist(originOf(absolute.get(parent)), originOf(absolute.get(deep))) - want) > 1e-3, `${dims}: absolute frames miss it`);
  }
});

test("layout: finite edges, without throwing, for 2,900 entries under one node and for a chain eight levels deep", () => {
  const underRoot = Array.from({ length: 2900 }, (_, i) => String(i));
  const underNode = ["0", ...Array.from({ length: 2900 }, (_, i) => "0." + i)];
  const chain = Array.from({ length: 8 }, (_, d) => Array(d + 1).fill("0").join("."));
  assert.equal(chain[7], "0.0.0.0.0.0.0.0");
  for (const dims of ["2D", "3D"]) {
    for (const [tree, hub] of [[underRoot, ""], [underNode, "0"]]) {
      const L = H.treeLayout(tree, dims);
      assert.equal(L.size, tree.length + 1);
      for (const node of L.values()) { assert.ok(Number.isFinite(node.r)); assert.ok(node.edge.every(Number.isFinite), "finite edge"); }
      const hubR = L.get(hub).r, first = hub === "" ? "0" : "0.0", last = tree[tree.length - 1];
      assert.ok(hubR > 4 && hubR < 8, `the hub's radius is ${hubR}`);
      // the guarantee still holds at this size: child at r + r, neighbours apart, and the hit test finds them
      for (const child of [first, last, tree[1500]]) {
        close(Math.acosh(L.get(child).edge[15]), hubR + H.R_MIN, 1e-9, "child distance");
        atMost(lorentzDefect(L.get(child).edge) / L.get(child).edge[15] ** 2, 1e-12, "edge, relative to its size");
        assert.equal(H.cellAt(L, hub, lapply(L.get(child).edge, nearOrigin(rng(1), dims))), child);
      }
      let nearest = Infinity;
      const from = H.relativeFrames(L, last, Infinity);
      assert.equal(from.size, L.size);
      for (const [b, F] of from) if (b !== last && b !== hub) nearest = Math.min(nearest, Math.acosh(F[15]));
      assert.ok(nearest >= 2 * H.R_MIN - 1e-9, `the nearest sibling is ${nearest} away`);
    }
    const L = H.treeLayout(chain, dims);
    for (const node of L.values()) assert.ok(node.edge.every(Number.isFinite));
    close(Math.acosh(H.relativeFrame(L, "", chain[7])[15]), 8 * 2 * H.R_MIN, 1e-9, "a chain of single children runs straight: eight edges of 1.1");
    assert.deepEqual(H.treePath("", chain[7]), ["", ...chain]);
  }
});

test("layout: degenerate cases (the root alone, a root with 1 or 2 children, a non-root with 1 child, a leaf)", () => {
  const rim = Math.tanh(H.R_MIN);                                   // disc radius of a point 2 R_MIN away
  for (const dims of ["2D", "3D"]) {
    const at = (L, a) => toBall(originOf(L.get(a).edge));
    // the root alone
    let L = H.treeLayout([], dims);
    assert.deepEqual([...L.keys()], [""]);
    assert.deepEqual(L.get(""), { parent: null, r: H.R_MIN, edge: IDENT });
    assert.deepEqual([...H.relativeFrames(L, "")], [["", [...IDENT]]]);
    assert.equal(H.cellAt(L, "", H.fromBall([0.9, 0.3, 0])), "");
    assert.deepEqual(H.cellWall(L, ""), []);
    // a root with one child: both have the smallest radius, and the child is straight up
    L = H.treeLayout(["7"], dims);
    assert.equal(L.get("").r, H.R_MIN); assert.equal(L.get("7").r, H.R_MIN);
    atMost(maxAbs(at(L, "7"), [0, rim, 0]), 1e-15, `${dims}: a single child of the root is at +y`);
    // a root with two children
    L = H.treeLayout(["3", "8"], dims);
    for (const a of ["", "3", "8"]) assert.equal(L.get(a).r, H.R_MIN);
    atMost(maxAbs(at(L, "3"), [0, rim, 0]), 1e-15, `${dims}: the first child is at +y`);
    const between = angle3(at(L, "3"), at(L, "8"));
    if (dims === "2D") { atMost(maxAbs(at(L, "8"), [0, -rim, 0]), 1e-15, "2D: the second is opposite"); close(between, Math.PI, 1e-15, "2D: half a turn apart"); }
    else {
      close(between * DEG, 143.42, 0.01, "3D: the two lattice points are 143.42 degrees apart");
      assert.ok(Math.atanh(Math.cos(between / 2)) < H.R_MIN, "so R_MIN applies");
    }
    // two sides of 1.1 and the angle between them give the third side
    const side = 2 * H.R_MIN;
    close(Math.acosh(H.relativeFrame(L, "3", "8")[15]), Math.acosh(Math.cosh(side) ** 2 - Math.sinh(side) ** 2 * Math.cos(between)), 1e-12, "distance between the two");
    assert.ok(Math.acosh(H.relativeFrame(L, "3", "8")[15]) >= 2 * H.R_MIN);
    // a non-root with one child sends it straight on (+x): root, 0, 0.4 and 0.4.9 lie on one line
    L = H.treeLayout(["0", "0.4", "0.4.9"], dims);
    for (const a of ["", "0", "0.4", "0.4.9"]) assert.equal(L.get(a).r, H.R_MIN);
    atMost(maxAbs(at(L, "0.4"), [rim, 0, 0]), 1e-15, `${dims}: a single child of a non-root node is at +x`);
    atMost(maxAbs(at(L, "0.4.9"), [rim, 0, 0]), 1e-15, `${dims}: and so is its own single child`);
    close(Math.acosh(H.relativeFrame(L, "", "0.4.9")[15]), 6 * H.R_MIN, 1e-12, "three edges in a straight line");
    // in the child's frame its parent is at -x
    atMost(maxAbs(toBall(originOf(H.relativeFrame(L, "0.4", "0"))), [-rim, 0, 0]), 1e-15, "the parent spoke is -x");
    // a leaf
    assert.equal(H.cellWall(L, "0.4.9").length, 25);
    assert.equal(H.cellWall(L, "0.4.9", 6, 2).length, 7);
    assert.deepEqual(H.cellWall(L, "0.4.9", 2, 1)[1], [-Math.sinh(H.R_MIN), 0, 0, Math.cosh(H.R_MIN)]);
    assert.equal(H.cellAt(L, "0.4.9", [0, 0, 0, 1]), "0.4.9");
    assert.equal(H.cellAt(L, "0.4.9", [-Math.sinh(2), 0, 0, Math.cosh(2)]), "0", "two cells back along the line");
    assert.equal(H.cellAt(L, "0.4.9", [Math.sinh(5), 0, 0, Math.cosh(5)]), "0.4.9", "a leaf's cell runs on to the rim");
  }
});

test("layout: cellWall gives steps + 1 points of the wall, evenly spaced from -reach to reach, as a geodesic at right angles to the edge", () => {
  const L = H.treeLayout(["0", "0.0", "0.1", "0.2", "0.3", "0.4"], "2D"), r = L.get("0").r;
  assert.ok(r > H.R_MIN);
  for (const [steps, reach] of [[24, 4], [1, 4], [7, 0.5], [60, 6]]) {
    const wall = steps === 24 && reach === 4 ? H.cellWall(L, "0") : H.cellWall(L, "0", steps, reach);
    assert.equal(wall.length, steps + 1);
    wall.forEach((p, i) => {
      const s = -reach + 2 * reach * i / steps;
      close(Math.asinh(p[1]), s, 1e-12, `point ${i} of ${steps + 1} is ${s} along the wall`);
      close(Math.acosh(p[3]), Math.acosh(Math.cosh(r) * Math.cosh(s)), 1e-12, "its distance from the entry is acosh(cosh r cosh s)");
      assert.ok(Math.abs(p[2]) === 0, "in the entry's plane z = 0");
    });
    // equal steps along the wall, and every piece meets the perpendicular from the entry at a right angle (it is a
    // straight line: the distance between two of its points is the difference of their s)
    for (let i = 1; i < wall.length; i++) close(hypDist(wall[i - 1], wall[i]), 2 * reach / steps, 1e-9 * Math.cosh(reach) ** 2, "spacing");
  }
  // the wall is one line seen from both sides: in the parent's frame the same points are r(parent) from the parent at the foot
  const inParent = H.cellWall(L, "0").map((p) => lapply(L.get("0").edge, p)), rp = L.get("").r;
  close(Math.min(...inParent.map((p) => Math.acosh(p[3]))), rp, 1e-12, "nearest point to the parent");
  close(Math.acosh(inParent[12][3]), rp, 1e-12, "which is the foot");
  // a child's wall and its parent's other walls never meet: the foot of each child's wall is r(node) out along its spoke
  for (const k of ["0.0", "0.1", "0.2", "0.3", "0.4"]) {
    const foot = lapply(L.get(k).edge, H.cellWall(L, k, 2, 1)[1]);
    close(Math.acosh(foot[3]), r, 1e-12, `foot of the wall of ${k}, seen from its parent`);
  }
});

test("layout: the 2D spoke rule (root children at screen angles 90, 0, -90, 180 degrees for n = 4; clockwise from the top, and from the parent)", () => {
  const angleOf = (L, a) => { const b = toBall(originOf(L.get(a).edge)); return Math.atan2(b[1], b[0]) * DEG; };
  const sameAngle = (got, want, what) => close(wrap((got - want) * RAD) * DEG, 0, 1e-9, what);
  const four = H.treeLayout(["0", "1", "2", "3"], "2D");
  [90, 0, -90, 180].forEach((want, j) => sameAngle(angleOf(four, String(j)), want, `child ${j} of 4`));
  assert.equal(four.get("").r, Math.atanh(Math.cos(Math.PI / 4)));
  for (let n = 1; n <= 14; n++) {
    // n top-level entries, and n children under the first of them
    const top = Array.from({ length: n }, (_, j) => String(10 * j + 2)), under = Array.from({ length: n }, (_, j) => `${top[0]}.${3 * j}`);
    const L = H.treeLayout(depthFirst([...top, ...under]), "2D");
    top.forEach((a, j) => sameAngle(angleOf(L, a), 90 - j * 360 / n, `root child ${j} of ${n}`));
    under.forEach((a, j) => sameAngle(angleOf(L, a), 180 - (j + 1) * 360 / (n + 1), `child ${j} of ${n} under a non-root node`));
    // radii: N spokes are 360°/N apart
    assert.equal(L.get("").r, n < 2 ? H.R_MIN : Math.max(H.R_MIN, Math.atanh(Math.cos(Math.PI / n))));
    assert.equal(L.get(top[0]).r, Math.max(H.R_MIN, Math.atanh(Math.cos(Math.PI / (n + 1)))));
    for (const a of under) assert.equal(L.get(a).r, H.R_MIN, "a leaf");
    for (const a of [...top, ...under]) assert.ok(Math.abs(L.get(a).edge[11]) === 0, "a 2D layout stays in the plane z = 0");
  }
});

test("layout: the 3D spoke rule (the Fibonacci lattice, turned by the minimal rotation that takes point 0 to +y at the root and to -x elsewhere)", () => {
  // the lattice and the rotation written out here another way: the rotation keeps the axis k = u × v and takes u to v
  const lattice = (N) => Array.from({ length: N }, (_, i) => { const z = 1 - (2 * i + 1) / N, az = i * Math.PI * (3 - Math.sqrt(5)), s = Math.sqrt(1 - z * z); return [s * Math.cos(az), s * Math.sin(az), z]; });
  const turnTo = (u, v) => { const k = unit3(cross3(u, v)), ku = cross3(k, u), kv = cross3(k, v);
    return (p) => { const a = dot3(p, u), b = dot3(p, ku), c = dot3(p, k); return [a * v[0] + b * kv[0] + c * k[0], a * v[1] + b * kv[1] + c * k[1], a * v[2] + b * kv[2] + c * k[2]]; }; };
  const spoke = (L, a) => unit3(originOf(L.get(a).edge));
  for (let n = 2; n <= 24; n++) {
    const top = Array.from({ length: n }, (_, j) => String(j)), under = Array.from({ length: n }, (_, j) => `0.${j}`);
    const L = H.treeLayout(depthFirst([...top, ...under]), "3D");
    const rootSet = lattice(n), rootTurn = turnTo(rootSet[0], [0, 1, 0]);
    top.forEach((a, j) => atMost(maxAbs(spoke(L, a), rootTurn(rootSet[j])), 1e-12, `root child ${j} of ${n} is lattice point ${j}`));
    const set = lattice(n + 1), turn = turnTo(set[0], [-1, 0, 0]);
    under.forEach((a, j) => atMost(maxAbs(spoke(L, a), turn(set[j + 1])), 1e-12, `child ${j} of ${n} under a non-root node is lattice point ${j + 1}`));
    atMost(maxAbs(turn(set[0]), [-1, 0, 0]), 1e-12, "point 0 goes to the parent spoke");
    // the radius comes from the smallest angle between two spokes, the parent spoke included
    let rootDelta = Infinity, delta = Infinity;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) rootDelta = Math.min(rootDelta, angle3(rootSet[i], rootSet[j]));
    for (let i = 0; i <= n; i++) for (let j = i + 1; j <= n; j++) delta = Math.min(delta, angle3(set[i], set[j]));
    close(L.get("").r, Math.max(H.R_MIN, Math.atanh(Math.cos(rootDelta / 2))), 1e-12, `r of a root with ${n} children`);
    close(L.get("0").r, Math.max(H.R_MIN, Math.atanh(Math.cos(delta / 2))), 1e-12, `r of a non-root node with ${n} children`);
  }
  // Rot(s) = rotZ(atan2(s_y, s_x)) . rotY(-asin(s_z)) fixes the roll: the edge is that rotation times boostX(r + r)
  const L = H.treeLayout(["0", "1", "2", "3", "4"], "3D"), s = spoke(L, "3");
  const expected = lmul(lmul(rotZ(Math.atan2(s[1], s[0])), rotY(-Math.asin(s[2]))), boostX(L.get("").r + L.get("3").r));
  atMost(maxAbs(L.get("3").edge, expected), 1e-12, "edge = Rot(spoke) . boostX(r(parent) + r(child))");
});

test("layout: at every node the walls are disjoint (a wall at r is seen under the half-angle acos(tanh r) <= δ/2), tightly when r is above R_MIN", () => {
  for (const dims of ["2D", "3D"]) for (let n = 0; n <= 40; n++) for (const isRoot of [true, false]) {
    const kids = Array.from({ length: n }, (_, j) => (isRoot ? String(j) : `0.${j}`));
    const L = H.treeLayout(isRoot ? kids : ["0", ...kids], dims), node = L.get(isRoot ? "" : "0");
    // the spokes as the layout really draws them: the directions of the children, and -x towards the parent
    const spokes = kids.map((a) => unit3(originOf(L.get(a).edge)));
    if (!isRoot) spokes.push([-1, 0, 0]);
    if (spokes.length < 2) { assert.equal(node.r, H.R_MIN); continue; }
    let delta = Infinity;
    for (let i = 0; i < spokes.length; i++) for (let j = i + 1; j < spokes.length; j++) delta = Math.min(delta, angle3(spokes[i], spokes[j]));
    const half = Math.acos(Math.tanh(node.r)), what = `${dims}, ${isRoot ? "root" : "non-root"} with ${n} children`;
    assert.ok(half <= delta / 2 + 1e-9, `${what}: half-angle ${half} against δ/2 = ${delta / 2}`);
    if (node.r > H.R_MIN) close(half, delta / 2, 1e-9, `${what}: r = atanh(cos(δ/2)) exactly`);
    else assert.ok(Math.atanh(Math.cos(delta / 2)) <= H.R_MIN + 1e-12, `${what}: R_MIN is the larger`);
    // every child is r(node) + r(child) out along its spoke
    for (const a of kids) close(Math.acosh(L.get(a).edge[15]), node.r + L.get(a).r, 1e-12, `${what}: edge length`);
  }
});

test("layout: the Map holds the root and every address in the order given, frozen, as { parent, r, edge }; the same input gives the same layout", () => {
  const tree = ["0", "0.3", "0.3.1", "0.7", "26", "26.1", "26.1.4", "26.1.9", "100"];
  for (const dims of ["2D", "3D"]) {
    const L = H.treeLayout(tree, dims);
    assert.ok(L instanceof Map);
    assert.deepEqual([...L.keys()], ["", ...tree]);
    for (const [a, node] of L) {
      assert.deepEqual(Object.keys(node), ["parent", "r", "edge"]);
      assert.equal(node.parent, a === "" ? null : parentOf(a));
      assert.ok(node.r >= H.R_MIN && Number.isFinite(node.r));
      assert.equal(node.edge.length, 16);
      assert.ok(Object.isFrozen(node) && Object.isFrozen(node.edge), "nodes and edges cannot be changed by a page");
    }
    assert.deepEqual(L.get("").edge, IDENT);
    assert.deepEqual([...H.treeLayout(tree, dims)], [...L], "deterministic");
    assert.deepEqual(tree, ["0", "0.3", "0.3.1", "0.7", "26", "26.1", "26.1.4", "26.1.9", "100"], "the input is not changed");
    // relativeFrame: the identity on itself, the edge to a child, its inverse back, and products along the way
    assert.deepEqual(H.relativeFrame(L, "26.1", "26.1"), [...IDENT]);
    assert.deepEqual(H.relativeFrame(L, "26.1", "26.1.4"), lmul(IDENT, L.get("26.1.4").edge));
    assert.deepEqual(H.relativeFrame(L, "26.1.4", "26.1"), lmul(IDENT, linv(L.get("26.1.4").edge)));
    assert.deepEqual(H.relativeFrame(L, "", "0.3.1"), lmul(lmul(lmul(IDENT, L.get("0").edge), L.get("0.3").edge), L.get("0.3.1").edge));
    assert.deepEqual(H.relativeFrame(L, "0.3.1", "26"), lmul(lmul(lmul(lmul(IDENT, linv(L.get("0.3.1").edge)), linv(L.get("0.3").edge)), linv(L.get("0").edge)), L.get("26").edge));
    for (const [a, b, c] of [["0.3.1", "26.1.9", "100"], ["26.1.4", "", "0.7"], ["100", "0", "26.1"]]) {
      const ac = H.relativeFrame(L, a, c), viaB = lmul(H.relativeFrame(L, a, b), H.relativeFrame(L, b, c));
      atMost(maxAbs(ac, viaB) / (ac[15] * H.relativeFrame(L, a, b)[15] ** 2), 1e-12, `${a} to ${c} through ${b}`);
    }
    // relativeFrames from an entry lists the entry first, then its children, then its parent
    assert.deepEqual([...H.relativeFrames(L, "26.1").keys()].slice(0, 4), ["26.1", "26.1.4", "26.1.9", "26"]);
    assert.deepEqual([...H.relativeFrames(L, "26.1", 0).keys()], ["26.1", "26.1.4", "26.1.9", "26"], "maxRho 0: the neighbours are reached, nothing behind them");
    assert.equal(H.relativeFrames(L, "", Infinity).size, L.size);
  }
  // sibling order is the order given, whatever the indices
  const sparse = H.treeLayout(["43", "43.3", "43.3.16", "43.18", "43.18.36", "43.18.37"], "2D");
  const angle = (a) => Math.atan2(originOf(sparse.get(a).edge)[1], originOf(sparse.get(a).edge)[0]) * DEG;
  close(angle("43.3"), 60, 1e-9, "first of two children of a non-root node"); close(angle("43.18"), -60, 1e-9, "second of two");
});

test("layout: bad input is refused with a fixed plain message that never repeats the input", () => {
  throwsPlain(() => H.treeLayout(["0"], "4D"), "dims is 2D or 3D");
  throwsPlain(() => H.treeLayout(["0"]), "dims is 2D or 3D");
  throwsPlain(() => H.treeLayout("0", "2D"), "addresses must be an array of address strings");
  throwsPlain(() => H.treeLayout(new Set(["0"]), "3D"), "addresses must be an array of address strings");
  for (const bad of [0, null, undefined, "", ".", "1.", ".1", "1..2", ["1"]]) throwsPlain(() => H.treeLayout(["1", bad], "2D"), "an address is one or more indices joined by dots");
  throwsPlain(() => H.treeLayout(["1", "2", "1"], "2D"), "an address is listed twice");
  throwsPlain(() => H.treeLayout(["1", "2.1"], "2D"), "the parent of an address is not in the list");
  throwsPlain(() => H.treeLayout(["1.1"], "3D"), "the parent of an address is not in the list");
  const L = H.treeLayout(["1", "1.1"], "2D");
  const secret = "<img src=x onerror=1>";
  for (const call of [() => H.relativeFrame(L, secret, "1"), () => H.relativeFrame(L, "1", secret), () => H.relativeFrame(L, "1", undefined),
    () => H.relativeFrames(L, secret), () => H.cellWall(L, "2"), () => H.cellAt(L, secret, [0, 0, 0, 1]), () => H.cellAt(L, null, [0, 0, 0, 1])]) {
    throwsPlain(call, "unknown address");
  }
  for (const call of [() => H.relativeFrame({}, "1", "1"), () => H.relativeFrames(null, "1"), () => H.cellWall([], "1"), () => H.cellAt(undefined, "1", [0, 0, 0, 1])]) {
    throwsPlain(call, "layout must be a Map made by treeLayout");
  }
  for (const p of [null, undefined, 7, [1, 2, 3], "abcd"]) throwsPlain(() => H.cellAt(L, "1", p), "p must be a hyperboloid point [x, y, z, t]");
  for (const [steps, reach] of [[0, 4], [2.5, 4], [-3, 4], [24, 0], [24, -1], [24, Infinity], [24, NaN], ["24", 4]]) {
    throwsPlain(() => H.cellWall(L, "1.1", steps, reach), "steps is a whole number of at least 1 and reach a positive number");
  }
  throwsPlain(() => H.treePath("1", 1), "an address is a string");
  throwsPlain(() => H.treePath(undefined, "1"), "an address is a string");
  // a Map of the right shape that was not made by treeLayout works too, as long as it is a tree
  const wide = H.treeLayout(["1", "1.1", "1.2", "1.3", "2", "2.5"], "2D"), copy = new Map([...wide].map(([a, node]) => [a, { ...node }]));
  assert.deepEqual(H.relativeFrame(copy, "2.5", "1.2"), H.relativeFrame(wide, "2.5", "1.2"));
  for (const focus of ["", "1", "1.2"]) assert.deepEqual([...H.relativeFrames(copy, focus)], [...H.relativeFrames(wide, focus)]);
  assert.deepEqual([...H.relativeFrames(copy, "1").keys()], ["1", "1.1", "1.2", "1.3", "", "2", "2.5"]);
  assert.equal(H.cellAt(copy, "", lapply(H.relativeFrame(wide, "", "1.3"), [0.1, 0, 0, Math.hypot(1, 0.1)])), "1.3");
  const loop = new Map([["a", { parent: "b", r: 1, edge: IDENT }], ["b", { parent: "a", r: 1, edge: IDENT }], ["c", { parent: null, r: 1, edge: IDENT }]]);
  throwsPlain(() => H.relativeFrame(loop, "c", "a"), "layout must be a Map made by treeLayout");
});

test("layout: treePath runs from a up to the lowest common ancestor and down to b, through the root between top-level entries", () => {
  assert.deepEqual(H.treePath("26.1.4", "26.1.9.2"), ["26.1.4", "26.1", "26.1.9", "26.1.9.2"]);
  assert.deepEqual(H.treePath("26.1", "43.3.16"), ["26.1", "26", "", "43", "43.3", "43.3.16"]);
  assert.deepEqual(H.treePath("26", "43"), ["26", "", "43"]);
  assert.deepEqual(H.treePath("26.1.9", "26.1.9"), ["26.1.9"]);
  assert.deepEqual(H.treePath("", ""), [""]);
  assert.deepEqual(H.treePath("", "26.1"), ["", "26", "26.1"]);
  assert.deepEqual(H.treePath("26.1", ""), ["26.1", "26", ""]);
  assert.deepEqual(H.treePath("26.1.4.2", "26"), ["26.1.4.2", "26.1.4", "26.1", "26"]);
  assert.deepEqual(H.treePath("26", "26.1.4.2"), ["26", "26.1", "26.1.4", "26.1.4.2"]);
  // indices are compared whole: 1 and 10 are different entries, and 26.1 is not above 26.10
  assert.deepEqual(H.treePath("1.5", "10.5"), ["1.5", "1", "", "10", "10.5"]);
  assert.deepEqual(H.treePath("26.1.3", "26.10"), ["26.1.3", "26.1", "26", "26.10"]);
  // the path back is the path reversed, and every step is one edge
  const R = rng(3), tree = randomTree(R, 60, 7, 6), all = ["", ...tree];
  for (let i = 0; i < 300; i++) {
    const a = all[Math.floor(R() * all.length)], b = all[Math.floor(R() * all.length)], path = H.treePath(a, b);
    assert.deepEqual(H.treePath(b, a), [...path].reverse());
    assert.equal(path[0], a); assert.equal(path[path.length - 1], b);
    assert.equal(new Set(path).size, path.length, "no entry twice");
    for (let k = 1; k < path.length; k++) assert.ok(parentOf(path[k]) === path[k - 1] || parentOf(path[k - 1]) === path[k], "neighbours in the tree");
    for (const p of path) assert.ok(all.includes(p));
  }
});

test("layout: cellAt gives one cell to every point whatever the focus, stops after `depth` moves, and a neighbour's whole cell is its hit area", () => {
  const tree = ["0", "0.0", "0.1", "0.2", "1", "1.0", "1.1", "1.2", "1.3", "1.3.0", "1.3.1", "2", "2.0", "2.1", "3", "3.0", "3.0.0", "3.0.1", "3.0.2", "3.0.2.0", "3.0.2.5"];
  const all = ["", ...tree], kids = childrenOf(tree);
  for (const dims of ["2D", "3D"]) {
    const L = H.treeLayout(tree, dims), R = rng(99), found = new Set();
    for (let i = 0; i < 3000; i++) {
      // a random point within 6 of the root, given in the root's frame
      const rho = 6 * Math.sqrt(R()), turn = TWO_PI * R(), u = dims === "2D" ? [Math.cos(turn), Math.sin(turn), 0] : randUnit3(R);
      const p = [Math.sinh(rho) * u[0], Math.sinh(rho) * u[1], Math.sinh(rho) * u[2], Math.cosh(rho)];
      const cell = H.cellAt(L, "", p, 99);
      found.add(cell);
      // the point is on the cell's own side of every wall of the cell
      const own = lapply(H.relativeFrame(L, cell, ""), p), node = L.get(cell);
      if (cell !== "") assert.ok(own[0] * Math.cosh(node.r) + own[3] * Math.sinh(node.r) >= 0, "inside the wall to the parent");
      for (const k of kids.get(cell)) {
        const q = lapply(linv(L.get(k).edge), own);
        assert.ok(q[0] * Math.cosh(L.get(k).r) + q[3] * Math.sinh(L.get(k).r) <= 0, "outside every child's wall");
      }
      // the same point seen from two other entries is in the same cell
      for (let f = 0; f < 2; f++) {
        const focus = all[Math.floor(R() * all.length)], seen = lapply(H.relativeFrame(L, focus, ""), p);
        assert.equal(H.cellAt(L, focus, seen, 99), cell, `${dims}: from "${focus}"`);
        // with a short reach the answer is the entry that many edges out on the way to the cell
        const way = H.treePath(focus, cell);
        for (const depth of [0, 1, 2, 3]) assert.equal(H.cellAt(L, focus, seen, depth), way[Math.min(depth, way.length - 1)], `${dims}: depth ${depth} from "${focus}"`);
        assert.equal(H.cellAt(L, focus, seen), way[Math.min(2, way.length - 1)], "the default depth is 2");
      }
    }
    assert.ok(found.size >= all.length - 2, `${dims}: ${found.size} of ${all.length} cells were hit`);
    // the hit area of a neighbour is its whole cell: far beyond its origin, and near its wall, still that neighbour
    const far = lapply(L.get("1").edge, [Math.sinh(3) * Math.cos(2), Math.sinh(3) * Math.sin(2), 0, Math.cosh(3)]);
    assert.equal(H.cellAt(L, "", far, 1), "1");
    const r = L.get("1").r, justInside = lapply(L.get("1").edge, [-Math.sinh(r - 1e-6), 0, 0, Math.cosh(r - 1e-6)]), justOutside = lapply(L.get("1").edge, [-Math.sinh(r + 1e-6), 0, 0, Math.cosh(r + 1e-6)]);
    assert.equal(H.cellAt(L, "", justInside), "1"); assert.equal(H.cellAt(L, "", justOutside), "");
    // a point of the rim (a direction, t = 1) is given a cell too
    assert.equal(typeof H.cellAt(L, "", [1, 0, 0, 1]), "string");
    assert.equal(H.cellAt(L, "3.0.2", [NaN, 0, 0, 1]), "3.0.2", "a point that is not a number moves nowhere");
  }
});

// ─── 3.4 the author's "three squares" ────────────────────────────────────────

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/gram-tqf-vectors.json", import.meta.url), "utf8"));

test("gramTqf: the fixture is the SHD-CCP vector file with a first member that names its source, licence and copyright line", () => {
  assert.equal(Object.keys(FIXTURE)[0], "source");
  assert.deepEqual(Object.keys(FIXTURE), ["source", "suite", "spec_version", "rfc", "status", "description", "generator", "binary", "cases"]);
  const { source } = FIXTURE;
  assert.equal(source.path, "Geometric_Engine/ecosystem/SHD-CCP/geometric-engine-spec/test_vectors/gram_tqf_collinearity.json");
  assert.equal(source.licence, "MIT");
  assert.equal(source.copyright, "Copyright (c) 2026 Schism-Labs-AI");
  assert.match(source.sha256, /^[0-9a-f]{64}$/);
  assert.equal(FIXTURE.suite, "gram_tqf_collinearity"); assert.equal(FIXTURE.rfc, "02"); assert.equal(FIXTURE.status, "normative");
  assert.equal(FIXTURE.cases.length, 300);
  // the vectors themselves, pinned: an edit to any case changes this digest
  assert.equal(createHash("sha256").update(JSON.stringify(FIXTURE.cases)).digest("hex"), "da0fcac07266e67e9eeab4cf846c83cb8cf739a86d964b66c9d1293ad9fbaaea");
  // without the first member the text is the source file, byte for byte: its SHA-256 is the one recorded
  const text = readFileSync(new URL("./fixtures/gram-tqf-vectors.json", import.meta.url), "utf8");
  const start = text.indexOf("  \"suite\"");
  assert.ok(start > 0);
  assert.equal(createHash("sha256").update("{\n" + text.slice(start)).digest("hex"), source.sha256);
});

test("gramTqf: the 300 normative vectors of SHD-CCP RFC 02 section 3, exactly", () => {
  const kinds = { collinear: 0, near_collinear: 0, general: 0 };
  let collinear = 0;
  for (const c of FIXTURE.cases) {
    const A = H.gramTqf(c.p1, c.p2, c.p3);
    assert.equal(typeof A, "bigint");
    assert.equal(A.toString(), c.tqf);
    assert.equal(H.isCollinear(c.p1, c.p2, c.p3), c.collinear);
    assert.equal(c.collinear, c.tqf === "0");
    assert.ok(A >= 0n, "16 x area² is never negative");
    kinds[c.kind]++; if (c.collinear) collinear++;
    // the order of the points does not matter, nor does where the origin is
    assert.equal(H.gramTqf(c.p3, c.p1, c.p2), A);
    assert.equal(H.gramTqf(c.p2, c.p1, c.p3), A);
    assert.equal(H.gramTqf(...[c.p1, c.p2, c.p3].map(([x, y]) => [x + 12345, y - 67890])), A);
    // A = 16 x area²: four times the square of twice the area (the shoelace sum)
    const [x1, y1] = c.p1.map(BigInt), [x2, y2] = c.p2.map(BigInt), [x3, y3] = c.p3.map(BigInt);
    const twice = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
    assert.equal(A, 4n * twice * twice);
  }
  assert.deepEqual(kinds, { collinear: 100, near_collinear: 100, general: 100 });
  assert.equal(collinear, 100);
});

test("gramTqf: the same formula in binary64 gets 35 of the 300 wrong, the cases the file marks; that is why A is a BigInt", () => {
  const q = (a, b) => (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]);
  let wrong = 0;
  for (const c of FIXTURE.cases) {
    const q1 = q(c.p2, c.p3), q2 = q(c.p1, c.p3), q3 = q(c.p1, c.p2), s = q1 + q2 + q3;
    const float = s * s - 2 * (q1 * q1 + q2 * q2 + q3 * q3);
    const misclassified = (float === 0) !== c.collinear;
    assert.equal(misclassified, c.float64_misclassifies);
    if (misclassified) wrong++;
  }
  assert.equal(wrong, 35);
});

test("gramTqf: all 41,664 triples of distinct points of the 4 x 4 x 4 lattice give A = 4 |u × v|² (16 x area²), and exactly 376 are collinear", () => {
  const pts = [];
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) for (let z = 0; z < 4; z++) pts.push([x, y, z]);
  assert.equal(pts.length, 64);
  let triples = 0, collinear = 0;
  for (let i = 0; i < 64; i++) for (let j = i + 1; j < 64; j++) for (let k = j + 1; k < 64; k++) {
    const a = pts[i], b = pts[j], c = pts[k];
    triples++;
    const A = H.gramTqf(a, b, c);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], w = cross3(u, v);
    const crossSquared = w[0] * w[0] + w[1] * w[1] + w[2] * w[2];   // |u × v|² = 4 x area², a small exact integer
    if (A !== BigInt(4 * crossSquared)) assert.fail(`A is ${A} for ${JSON.stringify([a, b, c])}, expected ${4 * crossSquared}`);
    const inLine = crossSquared === 0;
    if (H.isCollinear(a, b, c) !== inLine) assert.fail(`isCollinear is wrong for ${JSON.stringify([a, b, c])}`);
    if (inLine) collinear++;
  }
  assert.equal(triples, 41664);                                      // C(64, 3)
  assert.equal(collinear, 376);
  // 376 = 76 lines of four points (4 triples each) + 72 lines of exactly three
  assert.equal(76 * 4 + 72, 376);
});

test("gramTqf: the triangle (0,0), (3,0), (0,4) has squares 9, 16, 25 and A = 576 = 16 x 6²", () => {
  const p1 = [0, 0], p2 = [3, 0], p3 = [0, 4];
  const squared = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  assert.deepEqual([squared(p1, p2), squared(p1, p3), squared(p2, p3)], [9, 16, 25]);
  assert.equal(H.gramTqf(p1, p2, p3), 576n);
  assert.equal(576, 16 * 6 * 6);                                     // the area of the 3-4-5 triangle is 6
  assert.equal((9 + 16 + 25) ** 2 - 2 * (9 ** 2 + 16 ** 2 + 25 ** 2), 576);
  assert.equal(H.isCollinear(p1, p2, p3), false);
  assert.equal(H.gramTqf([0, 0], [1, 0], [0, 1]), 4n);               // squares 1, 1, 2: 16 x (1/2)²
  assert.equal(H.gramTqf([0, 0, 0], [1, 0, 0], [0, 1, 0]), 4n);
  assert.equal(H.gramTqf([0, 0], [1, 1], [5, 5]), 0n);
  assert.equal(H.isCollinear([0, 0, 0], [1, 2, 3], [-2, -4, -6]), true);
  assert.equal(H.isCollinear([0, 0, 0], [1, 2, 3], [-2, -4, -5]), false);
  assert.equal(H.isCollinear([7, 7], [7, 7], [9, 1]), true, "two equal points are in line with any third");
});

test("gramTqf: exact for coordinates far beyond binary64, and anything that is not an integer point is refused with a plain message", () => {
  // a thin triangle with coordinates near 2^80: area 1/2, so A = 4
  const big = 2n ** 80n;
  assert.equal(H.gramTqf([big, big], [big + 1n, big], [big, big + 1n]), 4n);
  assert.equal(H.gramTqf([0n, 0n], [big, big + 1n], [2n * big, 2n * big + 2n]), 0n);
  assert.equal(H.gramTqf([0n, 0n], [big, big + 1n], [2n * big, 2n * big + 3n]), 4n * big * big);
  assert.equal(H.gramTqf([0, 0n], [3n, 0], [0, 4]), 576n, "numbers and BigInts mix");
  assert.equal(H.gramTqf([-(2 ** 20), 2 ** 20], [2 ** 20, 2 ** 20], [0, -(2 ** 20)]), 2n ** 86n, "the largest coordinates of the RFC: A = 4 x (2^42)²");
  const message = "gramTqf needs three integer points of the same dimension, [x, y] or [x, y, z]";
  for (const bad of [[[0, 0], [1, 0]], [[0, 0], [1, 0], [0, 1, 0]], [[0, 0, 0], [1, 0], [0, 1]], [[0], [1], [2]], [[0, 0, 0, 0], [1, 0, 0, 0], [0, 1, 0, 0]],
    [[0, 0], [1.5, 0], [0, 1]], [[0, 0], [NaN, 0], [0, 1]], [[0, 0], [Infinity, 0], [0, 1]], [[0, 0], ["1", 0], [0, 1]], [[0, 0], [2 ** 53, 0], [0, 1]],
    [[0, 0], null, [0, 1]], ["ab", "cd", "ef"], [[0, 0], [1, 0], { 0: 0, 1: 1, length: 2 }], [[0, 0], [1, null], [0, 1]]]) {
    throwsPlain(() => H.gramTqf(...bad), message);
    throwsPlain(() => H.isCollinear(...bad), message);
  }
});

test("mobiusFromThree: three points of the rim fix where every fourth goes (200 random moves of the disc, 1e-9)", (t) => {
  const R = rng(31);
  let worst = 0, worstRim = 0;
  for (let i = 0; i < 200; i++) {
    // a random 2D move: a product of one to three turns and slides in the plane
    let M = IDENT.slice();
    for (let k = 1 + Math.floor(3 * R()); k > 0; k--) {
      const t = TWO_PI * R();
      M = lmul(M, lmul(rotZ(TWO_PI * R()), boostAlong([Math.cos(t), Math.sin(t), 0], 2 * R())));
    }
    const rim = [0, 1, 2, 3].map(() => C.cis(TWO_PI * R()));
    const image = rim.map((p) => { const n = H.skyImage(M, [p[0], p[1], 0]).n; worstRim = Math.max(worstRim, Math.abs(n[2]), Math.abs(Math.hypot(n[0], n[1]) - 1)); return [n[0], n[1]]; });
    const f = H.mobiusFromThree(rim.slice(0, 3), image.slice(0, 3));
    worst = Math.max(worst, C.abs(C.sub(f(rim[3]), image[3])));
    for (let j = 0; j < 3; j++) worst = Math.max(worst, C.abs(C.sub(f(rim[j]), image[j])));
  }
  atMost(worst, 1e-9, "the fourth point against its image");
  atMost(worstRim, 1e-12, "a move of the disc keeps the rim");
  t.diagnostic(`mobiusFromThree: largest error over 200 moves ${worst.toExponential(1)}`);
  // the move itself is that map: inside the disc too, f is where M sends the point
  const M = lmul(rotZ(0.7), boostAlong([Math.cos(2), Math.sin(2), 0], 1.2));
  const rim = [0.3, 2.2, 4.4].map((a) => C.cis(a)), image = rim.map((p) => H.skyImage(M, [p[0], p[1], 0]).n.slice(0, 2));
  const f = H.mobiusFromThree(rim, image), R2 = rng(8);
  for (let i = 0; i < 200; i++) {
    const z = randDisc(R2), moved = H.moveBall(M, [z[0], z[1], 0]);
    atMost(C.abs(C.sub(f(z), [moved[0], moved[1]])), 1e-12, "an inside point");
  }
});

test("mobiusFromThree: the map is exact at its three points, is the identity when nothing moves, and refuses points that are not distinct", () => {
  const z = [[1, 0], [0, 1], [-1, 0]], w = [[0, 1], [-1, 0], [0, -1]];
  const quarter = H.mobiusFromThree(z, w);                           // a quarter turn
  for (let i = 0; i < 3; i++) atMost(C.abs(C.sub(quarter(z[i]), w[i])), 1e-15, `point ${i + 1}`);
  atMost(C.abs(C.sub(quarter([0, -1]), [1, 0])), 1e-15, "the fourth rim point");
  atMost(C.abs(C.sub(quarter([0.5, 0.25]), [-0.25, 0.5])), 1e-15, "an inside point");
  // the map keeps its own copy of the six points
  const zs = z.map((c) => [...c]), ws = w.map((c) => [...c]), kept = H.mobiusFromThree(zs, ws);
  zs[0][0] = 5; ws[2][1] = 7; zs.pop();
  assert.deepEqual(kept([0.5, 0.25]), quarter([0.5, 0.25]));
  const same = H.mobiusFromThree(z, z), R = rng(4);
  for (let i = 0; i < 100; i++) { const p = [4 * R() - 2, 4 * R() - 2]; atMost(C.abs(C.sub(same(p), p)), 1e-12, "the identity"); }
  // any three points to any three: z -> 1/z takes 1, 2, 4 to 1, 1/2, 1/4, and then 8 to 1/8 and i to -i
  const inverse = H.mobiusFromThree([[1, 0], [2, 0], [4, 0]], [[1, 0], [0.5, 0], [0.25, 0]]);
  atMost(C.abs(C.sub(inverse([8, 0]), [0.125, 0])), 1e-15, "1/8"); atMost(C.abs(C.sub(inverse([0, 1]), [0, -1])), 1e-15, "1/i");
  assert.ok(!inverse([0, 0]).every(Number.isFinite), "the one point sent to infinity has no finite image");
  // a Möbius map keeps the cross-ratio of four points
  const g = H.mobiusFromThree([[0.2, 0.1], [-0.5, 0.3], [0.1, -0.7]], [[1.5, 0.5], [-0.3, 2], [0.4, 0.4]]);
  const cr = (a, b, c, d) => C.div(C.mul(C.sub(a, c), C.sub(b, d)), C.mul(C.sub(a, d), C.sub(b, c)));
  const four = [[0.9, 0.1], [-0.2, 0.6], [0.3, 0.3], [0.5, -0.8]];
  atMost(C.abs(C.sub(cr(...four.map(g)), cr(...four))), 1e-12, "cross-ratio");
  const message = "mobiusFromThree needs three distinct points and three distinct images, each [re, im]";
  for (const [a, b] of [[[[1, 0], [1, 0], [0, 1]], w], [z, [[0, 1], [-1, 0], [0, 1]]], [[[1, 0], [0, 1]], w], [z, undefined], [z, [[0, 1], [-1, 0], [0]]],
    [[[1, 0], [0, 1], [NaN, 0]], w], [z, [[0, 1], [-1, 0], [0, Infinity]]], ["abc", w], [z, [[0, 1], [-1, 0], "ab"]], [z.concat([[2, 2]]), w]]) {
    throwsPlain(() => H.mobiusFromThree(a, b), message);
  }
});

test("squareNumbersNext: three consecutive squares fix the next (1, 4, 9 give 16; holds for 1..1000)", () => {
  assert.equal(H.squareNumbersNext(1, 4, 9), 16);
  assert.equal(3 * 9 - 3 * 4 + 1, 16);
  for (let n = 1; n <= 1000; n++) assert.equal(H.squareNumbersNext(n * n, (n + 1) ** 2, (n + 2) ** 2), (n + 3) ** 2, `n = ${n}`);
  assert.equal(H.squareNumbersNext(0, 1, 4), 9);
  assert.notEqual(H.squareNumbersNext(1, 4, 8), 16, "it is a rule about squares: a wrong third gives a wrong fourth");
  // the rule is 3c - 3b + a, the one every sequence with constant second differences obeys: 1, 3, 6 give 10
  assert.equal(H.squareNumbersNext(1, 3, 6), 10);
  assert.equal(H.squareNumbersNext(2, 3, 5), 8);
});
