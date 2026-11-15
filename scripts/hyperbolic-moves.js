// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
/**
 * Hyperbolic moves: the geometry core of the Celestial Control Panel and the
 * Lexicon Explorer (binary64, DOM-free, deterministic).
 * ----------------------------------------------------------------------------
 * This module is for drawing and demonstration only. Nothing in it is ever
 * committed to a chain: no packet, hash, address, certificate or signature
 * depends on a number computed here.
 *
 * Conventions are those of scripts/strix-overwatch.js, whose functions are used
 * unchanged: a point of hyperbolic space is kept on the hyperboloid
 * x² + y² + z² − t² = −1 as [x, y, z, t]; a move is a 4x4 Lorentz matrix
 * (row-major, 16 numbers); lmul(A, B) is A·B, so B acts first; the Poincaré
 * ball point is [x, y, z] / (1 + t), and with z = 0 it is the disc. A complex
 * number is [re, im]. Every angle in this module is in radians.
 *
 * The tree layout and its guarantee. treeLayout gives every entry of a lexicon
 * a cell of its own: the walls round an entry never meet, and an entry shares
 * exactly one wall with its parent. So the cells of two different entries never
 * overlap, any two entries are at least r_i + r_j apart, and a child is exactly
 * r(parent) + r(child) from its parent; in 2D the cells tile the disc.
 * The consequence: when an entry is brought to the centre, its children sit
 * near the rim and its grandchildren on it. That is the price of disjoint cells.
 *
 * The layout keeps one edge per entry (the entry's frame seen from its parent)
 * and no absolute frame: far from the root an absolute frame loses every digit
 * in binary64. Pages draw from relativeFrames(layout, focus) and keep their
 * view as { focus, local }.
 *
 * Parts:
 *   1  helpers ported unchanged from the tested research snippets (the move
 *      T_c, compositions, walks, quadrilaterals, rings, the sky, {p,q} tilings)
 *   2  slides of a body that never turns, and the turn found on coming home
 *   3  the tree layout with relative edges
 *   4  the author's "three squares": the exact Gram-TQF of SHD-CCP RFC 02
 *      section 3, three points fixing a Möbius map, three squares fixing the next
 */

import { IDENT, lmul, rotY, rotZ, boostX, boostAlong, linv, lapply, originOf, toBall } from "./strix-overwatch.js";

// ─── 1. ported helpers (tested research code, unchanged) ─────────────────────

const ORIGIN = [0, 0, 0, 1];

/** Inverse of toBall: Poincare-ball point [x,y,z] (|p| < 1) -> hyperboloid point [x,y,z,t]. Disc points use z = 0. */
export const fromBall = (p) => { const r2 = p[0] * p[0] + p[1] * p[1] + p[2] * p[2], k = 1 / (1 - r2);
  return [2 * p[0] * k, 2 * p[1] * k, 2 * p[2] * k, (1 + r2) * k]; };

/** The non-turning move that brings the ball point p to the centre.
 *  In the disc (p = [re, im, 0]) this is exactly T_c(z) = (z - c)/(1 - conj(c) z) with c = re + i im. */
export const centreOn = (p) => { const r = Math.hypot(p[0], p[1], p[2]);
  return r < 1e-15 ? IDENT.slice() : boostAlong([-p[0] / r, -p[1] / r, -p[2] / r], 2 * Math.atanh(r)); };

/** Apply a Lorentz matrix to a ball (or disc) point and return the ball point. */
export const moveBall = (M, p) => toBall(lapply(M, fromBall(p)));

/** T_c(z) for complex numbers given as [re, im]. */
export const mobius = (c, z) => { const nr = z[0] - c[0], ni = z[1] - c[1], dr = 1 - (c[0] * z[0] + c[1] * z[1]), di = -(c[0] * z[1] - c[1] * z[0]), d = dr * dr + di * di;
  return [(nr * dr + ni * di) / d, (ni * dr - nr * di) / d]; };

/** Two translations in a row: T_b(T_a(z)) = e^{i theta} T_w(z).
 *  Returns w = (a+b)/(1+conj(a) b) and theta = 2 arg(1 + conj(a) b); |theta| is the area of the geodesic triangle 0, a, w. */
export function composeTranslations(a, b) {
  const pr = 1 + a[0] * b[0] + a[1] * b[1], pi = a[0] * b[1] - a[1] * b[0];        // 1 + conj(a) b
  const sr = a[0] + b[0], si = a[1] + b[1], d = pr * pr + pi * pi;
  return { w: [(sr * pr + si * pi) / d, (si * pr - sr * pi) / d], theta: 2 * Math.atan2(pi, pr) };
}
/** The same law for displacements: go d1 along a direction, then d2 along a direction turned by phi from the first.
 *  Net displacement dw and turning angle theta (radians; sign of phi). */
export function wignerAngle(d1, d2, phi) {
  const t = Math.tanh(d1 / 2) * Math.tanh(d2 / 2);
  return { theta: 2 * Math.atan2(t * Math.sin(phi), 1 + t * Math.cos(phi)),
    dw: Math.acosh(Math.cosh(d1) * Math.cosh(d2) + Math.sinh(d1) * Math.sinh(d2) * Math.cos(phi)) };
}
/** Any planar Lorentz matrix M (built from rotZ and boosts in the plane z = 0) acts on the disc as e^{i theta} T_c.
 *  Returns that c and theta, so M = rotZ(theta) . centreOn([c[0], c[1], 0]). */
export function discForm(M) {
  const h = lapply(linv(M), ORIGIN), c = [h[0] / (1 + h[3]), h[1] / (1 + h[3])];
  const Rm = lmul(M, linv(centreOn([c[0], c[1], 0])));
  return { c, theta: Math.atan2(Rm[4], Rm[0]) };
}

/** Walk: forward `step`, then turn left by `turn`, n times. Returns the frame matrix (walker's position = originOf(frame)). */
export function walk(step, turn, n) { const S = lmul(boostX(step), rotZ(turn)); let W = IDENT.slice(); for (let i = 0; i < n; i++) W = lmul(W, S); return W; }

/** "Forward a, turn left 90 degrees" four times: distance from the start at the end. */
export const squareWalkGap = (a) => 2 * Math.asinh(2 * Math.SQRT2 * Math.cosh(a / 2) * Math.sinh(a / 2) ** 3);
/** ... and the angle (radians, clockwise) by which the final facing differs from the start facing carried straight from start to end.
 *  It equals the area of the pentagon start, P1, P2, P3, end. */
export const squareWalkTurn = (a) => 2 * Math.atan2(Math.sinh(a) ** 2 / 2, 1 - 2 * Math.sinh(a / 2) ** 4);
/** ... and the bearing of the end point seen from the start, measured to the left of the first heading. */
export const squareWalkBearing = (a) => 3 * Math.PI / 4 - squareWalkTurn(a) / 2;
/** Step length for which n right-angle legs close up (regular right-angled n-gon), n >= 5. */
export const rightAngledPolygonSide = (n) => 2 * Math.acosh(Math.SQRT2 * Math.cos(Math.PI / n));

/** Regular geodesic quadrilateral with side a: interior angle, area, circumradius, inradius. */
export function regularQuad(a) {
  const angle = 2 * Math.asin(Math.SQRT1_2 / Math.cosh(a / 2));            // cosh(a/2) sin(angle/2) = cos(pi/4)
  return { angle, turn: Math.PI - angle, area: 2 * Math.PI - 4 * angle,
    R: Math.asinh(Math.SQRT2 * Math.sinh(a / 2)), r: Math.acosh(Math.SQRT2 * Math.cos(angle / 2)) };
}
/** Lambert quadrilateral: three right angles, the two sides a, b that meet at the middle right angle. Fourth angle (radians) or null. */
export const lambertAngle = (a, b) => { const c = Math.sinh(a) * Math.sinh(b); return c < 1 ? Math.acos(c) : null; };

/** Ring radii (hyperbolic) for m rings of equal area inside hyperbolic radius RHO; and equally spaced rings. Disc radius = tanh(rho/2). */
export const equalAreaRings = (RHO, m) => Array.from({ length: m }, (_, i) => Math.acosh(1 + (i + 1) / m * (Math.cosh(RHO) - 1)));
export const equalStepRings = (RHO, m) => Array.from({ length: m }, (_, i) => (i + 1) * RHO / m);
export const discRadius = (rho) => Math.tanh(rho / 2);
/** Area of the cell of ring i (0-based) in a disc cut into n equal sectors. */
export const cellArea = (radii, i, n) => 2 * Math.PI * (Math.cosh(radii[i]) - (i ? Math.cosh(radii[i - 1]) : 1)) / n;

/** Boundary (sky) action of a Lorentz matrix: unit vector n -> unit vector n', and the stretch factor lambda. */
export const skyImage = (M, n) => { const v = lapply(M, [n[0], n[1], n[2], 1]); return { n: [v[0] / v[3], v[1] / v[3], v[2] / v[3]], lambda: v[3] }; };
/** Aberration for boostAlong(u, d): a boundary point at angle theta from u goes to this angle (moves towards u). */
export const aberrate = (theta, d) => 2 * Math.atan(Math.exp(-d) * Math.tan(theta / 2));

/** Exact "grab and drag" for a camera that never turns: the camera centre c' for which T_c'(z) = s,
 *  where z is the grabbed scene point (intrinsic disc coordinate) and s the pointer position in the unit disc.
 *  c' = (u + v conj(u)) / (1 - |v|^2) with u = z - s, v = s z.  Always |c'| < 1. */
export function dragCentre(z, s) {
  const u = [z[0] - s[0], z[1] - s[1]], v = [s[0] * z[0] - s[1] * z[1], s[0] * z[1] + s[1] * z[0]];
  const k = 1 - (v[0] * v[0] + v[1] * v[1]);
  return [(u[0] + v[0] * u[0] + v[1] * u[1]) / k, (u[1] + v[1] * u[0] - v[0] * u[1]) / k];
}
/** Area of a geodesic triangle from its three side lengths (also the turning angle of item 2):
 *  cos(area/2) = (1 + cosh a + cosh b + cosh c) / (4 cosh(a/2) cosh(b/2) cosh(c/2)). */
export const triangleArea = (a, b, c) => 2 * Math.acos(Math.min(1, (1 + Math.cosh(a) + Math.cosh(b) + Math.cosh(c)) / (4 * Math.cosh(a / 2) * Math.cosh(b / 2) * Math.cosh(c / 2))));

/** Constants of {p,q} in curvature -1 (requires 1/p + 1/q < 1/2). Lengths are hyperbolic; disc* are Poincare-disc radii. */
export function tilingConstants(p, q) {
  if (!(1 / p + 1 / q < 1 / 2 - 1e-12)) throw new Error("{p,q} is not hyperbolic");
  const side = 2 * Math.acosh(Math.cos(Math.PI / p) / Math.sin(Math.PI / q));      // edge length
  const R = Math.acosh(1 / (Math.tan(Math.PI / p) * Math.tan(Math.PI / q)));       // circumradius: centre -> corner
  const r = Math.acosh(Math.cos(Math.PI / q) / Math.sin(Math.PI / p));             // inradius: centre -> edge midpoint
  return { p, q, side, R, r, angle: 2 * Math.PI / q, area: (p - 2) * Math.PI - p * 2 * Math.PI / q,
    discR: Math.tanh(R / 2), discr: Math.tanh(r / 2) };
}

/**
 * Tiles of {p,q} out to `layers` layers round the central tile.
 *   adjacency "edge":   layer n = tiles reached by crossing n edges (and no fewer)
 *   adjacency "vertex": layer n = n-th corona (tiles touching layer n-1 at an edge or a corner)
 * A tile is { M, centre, layer }: M is its frame (4x4 Lorentz matrix, row-major), centre = originOf(M).
 *   edge midpoints:  M . rotZ(j 2pi/p) . boostX(r) . O            j = 0..p-1
 *   corners:         M . rotZ(pi/p + j 2pi/p) . boostX(R) . O     j = 0..p-1
 * Duplicates: two different tile centres are >= 2r apart, so their hyperboloid (x, y) parts are >= 2 sinh(r) apart in the
 * ordinary Euclidean sense. A hash grid with cells smaller than 2 sinh(r)/sqrt(2) therefore holds at most one centre per
 * cell, and a candidate is "already known" iff a stored centre lies within tol in the surrounding 3 x 3 cells.
 */
export function generateTiling(p, q, layers, adjacency = "edge") {
  const k = tilingConstants(p, q), turn = 2 * Math.PI / p;
  // cross edge j: go to the neighbour's centre (2r away) and turn round, so the neighbour's edge 0 is the shared edge
  const G = Array.from({ length: p }, (_, j) => lmul(lmul(rotZ(j * turn), boostX(2 * k.r)), rotZ(Math.PI)));
  // rotation by one tile-angle (2pi/q) about corner j of the tile whose frame is the identity
  const V = Array.from({ length: p }, (_, j) => { const A = lmul(rotZ(turn / 2 + j * turn), boostX(k.R)); return lmul(lmul(A, rotZ(k.angle)), linv(A)); });
  const cell = 0.999 * 2 * Math.sinh(k.r) / Math.SQRT2, tol = 0.5 * Math.sinh(k.r);
  const grid = new Map(), tiles = [];
  const key = (c) => Math.floor(c[0] / cell) + "," + Math.floor(c[1] / cell);
  const find = (c) => { const i = Math.floor(c[0] / cell), j = Math.floor(c[1] / cell);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const t = grid.get((i + di) + "," + (j + dj));
      if (t !== undefined && Math.hypot(tiles[t].centre[0] - c[0], tiles[t].centre[1] - c[1]) < tol) return t; }
    return -1; };
  const add = (M, layer) => { const centre = originOf(M); tiles.push({ M, centre, layer }); grid.set(key(centre), tiles.length - 1); return tiles.length - 1; };
  add(IDENT, 0);
  let frontier = [0];
  for (let L = 1; L <= layers; L++) {
    const next = [];
    for (const id of frontier) {
      const M = tiles[id].M, moves = [];
      if (adjacency === "edge") for (const g of G) moves.push(lmul(M, g));
      else for (const v of V) { let N = M; for (let s = 1; s < q; s++) { N = lmul(N, v); moves.push(N); } }   // the q-1 other tiles round each corner
      for (const N of moves) if (find(originOf(N)) < 0) next.push(add(N, L));
    }
    frontier = next;
  }
  return { constants: k, tiles };
}

// ─── 2. slides: a body that never turns ──────────────────────────────────────

const TWO_PI = 2 * Math.PI;
/** Farther from home than this, homecoming reports the turn as null: its error in binary64 grows like 1e-16 cosh²(distance). */
const HOME_LIMIT = 12;

/**
 * The frames of a body that slides and never turns. slides = [{ angle, dist }]: angle is measured in the body's own
 * fixed axes, anticlockwise from its +x; dist is the hyperbolic length of the slide. Each slide multiplies the frame
 * on the right: F <- F . boostAlong([cos angle, sin angle, 0], dist). Returns slides.length + 1 frames, the first
 * being the identity; the body's position after slide k is originOf(frames[k]).
 */
export function slidePath(slides) {
  if (!Array.isArray(slides)) throw new Error("slides must be an array of { angle, dist }");
  let F = IDENT.slice();
  const frames = [F];
  for (const s of slides) {
    if (s === null || typeof s !== "object" || !Number.isFinite(s.angle) || !Number.isFinite(s.dist)) throw new Error("a slide needs a finite angle and a finite dist");
    F = lmul(F, boostAlong([Math.cos(s.angle), Math.sin(s.angle), 0], s.dist));
    frames.push(F);
  }
  return frames;
}

/**
 * Slide a frame straight home and read off how it is turned. With o = originOf(F): distance = asinh |o.xyz|; the
 * slide home is H = boostAlong(-o.xyz / |o.xyz|, distance) (the identity when distance < 1e-12), and H . F is a
 * rotation. turn is its angle about z, anticlockwise positive, in (-pi, pi]; turnClockwise = (-turn) mod 2 pi, in
 * [0, 2 pi). For a path of slides the turn is the area the path went round, taken clockwise when the path ran
 * anticlockwise. Both turns are null when distance > 12: farther out binary64 has too few digits left for them.
 */
export function homecoming(F) {
  const o = originOf(F), n = Math.hypot(o[0], o[1], o[2]), distance = Math.asinh(n);
  if (!(distance <= HOME_LIMIT)) return { distance, turn: null, turnClockwise: null };
  const R = distance < 1e-12 ? F : lmul(boostAlong([-o[0] / n, -o[1] / n, -o[2] / n], distance), F);
  let turn = Math.atan2(R[4], R[0]);
  if (turn <= -Math.PI) turn = Math.PI;      // keep the half turn at +pi
  else if (turn === 0) turn = 0;             // and write a zero turn as +0
  return { distance, turn, turnClockwise: ((-turn) % TWO_PI + TWO_PI) % TWO_PI };
}

/** The conformal factor 2 / (1 - |p|²) of the Poincaré metric at a ball point [x, y, z] or a disc point [x, y]: 2 at the centre. */
export const conformalFactor = (p) => 2 / (1 - (p[0] * p[0] + p[1] * p[1] + (p.length > 2 ? p[2] * p[2] : 0)));

// ─── 3. tree layout with relative edges (every entry owns a cell) ────────────
// A node's spokes are its edge directions, unit vectors in its own frame. A non-root node's frame has +x pointing
// away from its parent, so its parent spoke is -x.
//   2D  root with n children: child j (0-based, in the order given) at 90° - j·360°/n;
//       non-root with n children: child j at 180° - (j + 1)·360°/(n + 1).
//   3D  N = n (root) or n + 1 points of the Fibonacci lattice. Root: the set is turned by the minimal rotation taking
//       point 0 to +y and the children are points 0..n-1. Non-root: the set is turned by the minimal rotation taking
//       point 0 to -x and the children are points 1..n. A single child of a non-root node goes to +x, a single
//       child of the root to +y.
// Cell radius: r = max(R_MIN, atanh(cos(δ/2))), δ the smallest angle between two spokes of the node (the parent
// spoke included); R_MIN with fewer than two spokes. A wall at distance r is seen from the node under the
// half-angle acos(tanh r) <= δ/2, so the walls round a node are disjoint.
// Edge: edge(child) = Rot(spoke) . boostX(r(parent) + r(child)), the child's frame seen from its parent.

/** The smallest cell radius: a node with fewer than two spokes, or with spokes far apart, gets this. */
export const R_MIN = 0.55;

const D2R = Math.PI / 180;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const UNKNOWN_ADDRESS = "unknown address";
const NOT_A_LAYOUT = "layout must be a Map made by treeLayout";

/** The address with its last index removed; "" (the root) for a top-level entry. */
const parentAddress = (a) => { const i = a.lastIndexOf("."); return i < 0 ? "" : a.slice(0, i); };

/** N points of the Fibonacci lattice on the unit sphere: z_i = 1 - (2i + 1)/N, azimuth i·π(3 - √5). */
function fibonacciLattice(N) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const z = 1 - (2 * i + 1) / N, az = i * GOLDEN_ANGLE, s = Math.sqrt(Math.max(0, 1 - z * z));
    out.push([s * Math.cos(az), s * Math.sin(az), z]);
  }
  return out;
}

/** The minimal rotation taking the unit vector u to the unit vector v, as a function on 3-vectors: a turn about u × v
 *  by the angle between them; the identity if u = v; a half-turn about the z axis if u = -v. */
function minimalRotation(u, v) {
  const k = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const s = Math.hypot(k[0], k[1], k[2]), c = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];       // sin and cos of the angle
  if (s < 1e-12) return c > 0 ? (p) => [p[0], p[1], p[2]] : (p) => [-p[0], -p[1], p[2]];
  const x = k[0] / s, y = k[1] / s, z = k[2] / s;
  return (p) => {                                    // Rodrigues: p cos + (k × p) sin + k (k · p)(1 - cos)
    const t = (x * p[0] + y * p[1] + z * p[2]) * (1 - c);
    return [p[0] * c + (y * p[2] - z * p[1]) * s + x * t, p[1] * c + (z * p[0] - x * p[2]) * s + y * t, p[2] * c + (x * p[1] - y * p[0]) * s + z * t];
  };
}

/** The smallest angle between two of the given unit vectors (at least two). */
function smallestAngle(vs) {
  let best = -Infinity, a = vs[0], b = vs[1];
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
    const d = vs[i][0] * vs[j][0] + vs[i][1] * vs[j][1] + vs[i][2] * vs[j][2];
    if (d > best) { best = d; a = vs[i]; b = vs[j]; }
  }
  // the angle of the closest pair from both its sine and its cosine, which stays exact for small angles
  return Math.atan2(Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]), best);
}

/** The child spokes of a node with n children and δ, the smallest angle between two of its spokes (null with fewer than two). */
function spokesOf(n, isRoot, dims) {
  const N = isRoot ? n : n + 1;                      // number of spokes
  if (dims === "2D") {
    const child = [];
    for (let j = 0; j < n; j++) {
      const a = (isRoot ? 90 - j * 360 / n : 180 - (j + 1) * 360 / (n + 1)) * D2R;
      child.push([Math.cos(a), Math.sin(a), 0]);
    }
    return { child, delta: N < 2 ? null : TWO_PI / N };
  }
  const toParent = [-1, 0, 0];
  if (n === 0) return { child: [], delta: null };
  if (n === 1) return isRoot ? { child: [[0, 1, 0]], delta: null } : { child: [[1, 0, 0]], delta: Math.PI };
  const lattice = fibonacciLattice(N), target = isRoot ? [0, 1, 0] : toParent, turn = minimalRotation(lattice[0], target);
  const turned = lattice.map(turn);
  turned[0] = target;                                // exactly where the rotation puts point 0
  return { child: isRoot ? turned : turned.slice(1), delta: smallestAngle(turned) };
}

/** Rot(s): the rotation taking +x to the unit vector s, rotZ(atan2(s_y, s_x)) . rotY(-asin(s_z)). */
const rotTo = (s) => lmul(rotZ(Math.atan2(s[1], s[0])), rotY(-Math.asin(Math.max(-1, Math.min(1, s[2])))));

const CHILDREN = new WeakMap();                      // layout -> Map(address -> [child addresses])
function childLists(layout) {
  if (!(layout instanceof Map)) throw new Error(NOT_A_LAYOUT);
  let kids = CHILDREN.get(layout);
  if (!kids) {
    kids = new Map();
    for (const a of layout.keys()) kids.set(a, []);
    for (const [a, node] of layout) if (node.parent !== null && kids.has(node.parent)) kids.get(node.parent).push(a);
    CHILDREN.set(layout, kids);
  }
  return kids;
}
function nodeOf(layout, address) {
  if (!(layout instanceof Map)) throw new Error(NOT_A_LAYOUT);
  const node = layout.get(address);
  if (node === undefined) throw new Error(UNKNOWN_ADDRESS);
  return node;
}

/**
 * Lay out a tree of addresses in the disc ("2D") or the ball ("3D").
 * addresses: the LEX/1 address strings of a lexicon in canonical order (indices joined by "."; the parent of an
 * address is the address with its last index removed, and every parent must be in the list).
 * Returns Map(address -> { parent, r, edge }), frozen, in the order given, with the root "" first
 * ({ parent: null, r, edge: IDENT }). Top-level entries are children of the root. r is the cell radius; edge is the
 * entry's frame seen from its parent, so originOf(edge) is where the entry sits in its parent's frame, exactly
 * r(parent) + r(entry) away, and the entry's own +x points away from its parent.
 */
export function treeLayout(addresses, dims) {
  if (dims !== "2D" && dims !== "3D") throw new Error("dims is 2D or 3D");
  if (!Array.isArray(addresses)) throw new Error("addresses must be an array of address strings");
  const kids = new Map([["", []]]);
  for (const a of addresses) {
    if (typeof a !== "string" || a === "" || a.split(".").includes("")) throw new Error("an address is one or more indices joined by dots");
    if (kids.has(a)) throw new Error("an address is listed twice");
    kids.set(a, []);
  }
  for (const a of addresses) {
    const siblings = kids.get(parentAddress(a));
    if (siblings === undefined) throw new Error("the parent of an address is not in the list");
    siblings.push(a);
  }
  const shapes = new Map();                          // spokes and radius depend only on the number of children
  const shapeOf = (a) => {
    const n = kids.get(a).length, isRoot = a === "", key = isRoot ? -1 - n : n;
    let shape = shapes.get(key);
    if (!shape) {
      const { child, delta } = spokesOf(n, isRoot, dims);
      const r = delta === null ? R_MIN : Math.max(R_MIN, Math.atanh(Math.cos(delta / 2)));
      if (!Number.isFinite(r)) throw new Error("too many entries under one entry");
      shape = { r, turns: child.map(rotTo) };
      shapes.set(key, shape);
    }
    return shape;
  };
  const layout = new Map([["", Object.freeze({ parent: null, r: shapeOf("").r, edge: IDENT })]]);
  for (const a of addresses) layout.set(a, null);    // keep the order given
  for (const [p, list] of kids) {
    const shape = shapeOf(p);
    list.forEach((a, j) => {
      const r = shapeOf(a).r;
      layout.set(a, Object.freeze({ parent: p, r, edge: Object.freeze(lmul(shape.turns[j], boostX(shape.r + r))) }));
    });
  }
  CHILDREN.set(layout, kids);
  return layout;
}

/**
 * The frame of the entry "to" seen from the entry "from": the product of the inverse edges from "from" up to their
 * lowest common ancestor, then of the edges down to "to". acosh of its last entry ([15]) is the distance between
 * the two entries. relativeFrame(layout, a, a) is the identity.
 */
export function relativeFrame(layout, from, to) {
  const chain = [], place = new Map();               // "to" and its ancestors, nearest first
  for (let a = to; a !== null; a = nodeOf(layout, a).parent) {
    if (chain.length > layout.size) throw new Error(NOT_A_LAYOUT);
    place.set(a, chain.length); chain.push(a);
  }
  let M = IDENT.slice(), a = from;
  for (let steps = 0; !place.has(a); steps++) {
    if (steps > layout.size) throw new Error(NOT_A_LAYOUT);
    const node = nodeOf(layout, a);
    M = lmul(M, linv(node.edge)); a = node.parent;
  }
  for (let i = place.get(a) - 1; i >= 0; i--) M = lmul(M, layout.get(chain[i]).edge);
  return M;
}

/**
 * Every entry's frame seen from the focus: Map(address -> frame), built breadth-first outward from the focus (down
 * through children, up through the parent and on to its other children), so the Map lists entries by their number
 * of tree steps from the focus. The walk does not go past an entry whose origin is farther than maxRho from the
 * focus: that entry is in the Map, the entries behind it are not. The root "" is a node like any other.
 * A page draws only from this Map, in a view { focus, local }: screen point = toBall(local . frame . point).
 */
export function relativeFrames(layout, focus, maxRho = 9) {
  const kids = childLists(layout);
  nodeOf(layout, focus);
  const limit = Math.cosh(maxRho), frames = new Map([[focus, IDENT.slice()]]);
  let ring = [focus];
  while (ring.length) {
    const next = [];
    for (const a of ring) {
      const M = frames.get(a), node = layout.get(a);
      if (M[15] > limit) continue;                   // M[15] = cosh(distance of this entry from the focus)
      for (const k of kids.get(a)) if (!frames.has(k)) { frames.set(k, lmul(M, layout.get(k).edge)); next.push(k); }
      if (node.parent !== null && !frames.has(node.parent)) { frames.set(node.parent, lmul(M, linv(node.edge))); next.push(node.parent); }
    }
    ring = next;
  }
  return frames;
}

/**
 * The wall between an entry and its parent, in the entry's own frame: steps + 1 hyperboloid points
 * [-sinh r cosh s, sinh s, 0, cosh r cosh s] for s evenly spaced from -reach to reach, r = r(entry). Only the foot
 * (s = 0) is at distance r from the entry and r(parent) from the parent; the point at s is at acosh(cosh r cosh s).
 * In 3D this is the wall's line in the entry's own plane z = 0. The root has no parent: its list is empty.
 */
export function cellWall(layout, address, steps = 24, reach = 4) {
  const node = nodeOf(layout, address);
  if (!Number.isInteger(steps) || steps < 1 || !(reach > 0) || !Number.isFinite(reach)) throw new Error("steps is a whole number of at least 1 and reach a positive number");
  if (node.parent === null) return [];
  const sh = Math.sinh(node.r), ch = Math.cosh(node.r), points = [];
  for (let i = 0; i <= steps; i++) {
    const s = -reach + 2 * reach * i / steps;
    points.push([-sh * Math.cosh(s), Math.sinh(s), 0, ch * Math.cosh(s)]);
  }
  return points;
}

/**
 * The addresses from a up to the lowest common ancestor of a and b and down to b. The root is "": it is in the path
 * when a and b lie under different top-level entries. treePath(a, a) is [a]. Works on the address strings alone.
 */
export function treePath(a, b) {
  if (typeof a !== "string" || typeof b !== "string") throw new Error("an address is a string");
  const ia = a === "" ? [] : a.split("."), ib = b === "" ? [] : b.split(".");
  let common = 0;
  while (common < ia.length && common < ib.length && ia[common] === ib[common]) common++;
  const path = [];
  for (let n = ia.length; n >= common; n--) path.push(ia.slice(0, n).join("."));
  for (let n = common + 1; n <= ib.length; n++) path.push(ib.slice(0, n).join("."));
  return path;
}

/**
 * The hit test of the tree canvas. p is a hyperboloid point given in the frame of the focus. Starting at the focus,
 * while a neighbour of the current entry (a child, or the parent) has p on its side of the wall they share, move
 * to that neighbour; at most "depth" moves. Returns the address reached: the entry whose cell contains p when that
 * entry is within "depth" edges of the focus, otherwise the entry "depth" edges out on the way to it. So a
 * neighbour's whole cell is its hit area. The answer can be "" (the root's own cell). A point exactly on a wall
 * stays on the side the walk came from.
 * In a child's frame its side of the wall to its parent is p_x cosh r + p_t sinh r > 0, r = r(child).
 */
export function cellAt(layout, focus, p, depth = 2) {
  const kids = childLists(layout);
  let at = focus, node = nodeOf(layout, focus);
  if (p === null || typeof p !== "object" || !(p.length >= 4)) throw new Error("p must be a hyperboloid point [x, y, z, t]");
  let q = p;                                         // the point, in the frame of the entry reached so far
  for (let move = 0; move < depth; move++) {
    let next = null, moved = null;
    if (node.parent !== null && q[0] * Math.cosh(node.r) + q[3] * Math.sinh(node.r) < 0) {
      next = node.parent; moved = lapply(node.edge, q);                    // the same point in the parent's frame
    } else {
      for (const k of kids.get(at)) {
        const child = layout.get(k), inChild = lapply(linv(child.edge), q);
        if (inChild[0] * Math.cosh(child.r) + inChild[3] * Math.sinh(child.r) > 0) { next = k; moved = inChild; break; }
      }
    }
    if (next === null) break;
    at = next; node = layout.get(at); q = moved;
  }
  return at;
}

// ─── 4. the author's "three squares" (exact and checked) ─────────────────────

const TQF_INPUT = "gramTqf needs three integer points of the same dimension, [x, y] or [x, y, z]";
const bigOf = (v) => {
  if (typeof v === "bigint") return v;
  if (!Number.isSafeInteger(v)) throw new Error(TQF_INPUT);
  return BigInt(v);
};
/** The squared distance of two integer points, exactly. */
const quadrance = (a, b) => { let q = 0n; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; q += d * d; } return q; };

/**
 * Gram-TQF of SHD-CCP RFC 02 section 3, exactly, as a BigInt: A = (Q1 + Q2 + Q3)² − 2(Q1² + Q2² + Q3²) with the
 * squared distances Q1 = |P2P3|², Q2 = |P1P3|², Q3 = |P1P2|² of three integer points of the same dimension
 * ([x, y] or [x, y, z]; safe integers or BigInts). A is 16 times the squared area of the triangle, and it is zero
 * exactly when the three points are in line.
 */
export function gramTqf(p1, p2, p3) {
  const pts = [p1, p2, p3].map((p) => {
    if (!Array.isArray(p) || (p.length !== 2 && p.length !== 3) || p.length !== p1.length) throw new Error(TQF_INPUT);
    return p.map(bigOf);
  });
  const q1 = quadrance(pts[1], pts[2]), q2 = quadrance(pts[0], pts[2]), q3 = quadrance(pts[0], pts[1]);
  const s = q1 + q2 + q3;
  return s * s - 2n * (q1 * q1 + q2 * q2 + q3 * q3);
}
/** Three integer points are in line exactly when their Gram-TQF is zero. */
export const isCollinear = (p1, p2, p3) => gramTqf(p1, p2, p3) === 0n;

const cSub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cMul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cDiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const THREE_POINTS = "mobiusFromThree needs three distinct points and three distinct images, each [re, im]";
const threeDistinct = (t) => {
  if (!Array.isArray(t) || t.length !== 3) throw new Error(THREE_POINTS);
  for (const c of t) if (!Array.isArray(c) || c.length !== 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) throw new Error(THREE_POINTS);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (t[i][0] === t[j][0] && t[i][1] === t[j][1]) throw new Error(THREE_POINTS);
  return t.map((c) => [c[0], c[1]]);
};

/**
 * The unique Möbius map f with f(z_i) = w_i, for z = [z1, z2, z3] and w = [w1, w2, w3], distinct complex numbers
 * [re, im]. Returns f([re, im]) -> [re, im]. Three points of the rim fix where every fourth goes: a move of the sky
 * is such a map. (At the one point f sends to infinity the result is not finite.)
 * f = S_w⁻¹ ∘ S_z with S_z(ζ) = (ζ − z1)(z2 − z3) / ((ζ − z3)(z2 − z1)), which sends z1, z2, z3 to 0, 1, ∞.
 */
export function mobiusFromThree(z, w) {
  const [z1, z2, z3] = threeDistinct(z), [w1, w2, w3] = threeDistinct(w);
  const zA = cSub(z2, z3), zB = cSub(z2, z1), wA = cSub(w2, w3), wB = cSub(w2, w1);
  const a = cMul(w3, wB), b = cMul(w1, wA);
  return (p) => {
    const n = cMul(cSub(p, z1), zA), d = cMul(cSub(p, z3), zB);            // S_z(p) = n / d, kept as a pair
    return cDiv(cSub(cMul(b, d), cMul(a, n)), cSub(cMul(wA, d), cMul(wB, n)));
  };
}

/** Three consecutive squares fix the next: for a = n², b = (n + 1)², c = (n + 2)² this is (n + 3)². 3·9 − 3·4 + 1 = 16. */
export const squareNumbersNext = (a, b, c) => 3 * c - 3 * b + a;
