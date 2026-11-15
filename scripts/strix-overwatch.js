// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
/**
 * STRIX Overwatch core (a draft) — the Firebase-free, DOM-free half of three
 * pages of Library/Experimental_Systems/: First Explorers (a journey of
 * observations), the Lexicon Explorer (a tree lexicon) and the Celestial
 * Control Panel (a sky, sealed as a tree lexicon).
 * ----------------------------------------------------------------------------
 * One of three cores. This one holds the formats and the checks. Two others
 * stand beside it: scripts/celestial-core.js (the sky: Sun, Moon, frames and
 * the rows of a sky lexicon; it imports nothing) and scripts/hyperbolic-moves.js
 * (the geometry the two newer pages draw with; it uses the moves of this file
 * unchanged and nothing it computes is ever committed).
 *
 * What is reused, unchanged: the shdccp/2 grow cell, growth epochs, the GROWN/1
 * and GROWTH/1 commitments and the strict verifier (RFC 07 section 12) of
 * scripts/biomesh-core.js, and the ECDSA P-256 signatures of seal-crypto.js.
 *
 * What is new here, and a draft (no RFC, nothing registered, nothing stored):
 *   OBS/1       one observation as one canonical line of text: a sense, a name
 *               and integer measurements. A journey is these lines in order.
 *   LEXICON/1   the journey's lexicon: every observation gets the address
 *               "sense.index" in a tree rooted at the observer. The address is
 *               exact (two integers); the 2D disc and 3D ball coordinates are
 *               derived from it for display and are never committed.
 *   LEX/1       one entry of a tree lexicon as one canonical line of text: an
 *               address of 1 to 8 indices, a layer (text, said, checked or
 *               reading), a kind, a name and a text.
 *   LEXICON/2   a tree lexicon: its text is the lines in the one depth-first
 *               order, and its object lists every entry with the hash of its
 *               line. The layer is in the line and in the root, so a label
 *               changed after sealing no longer fits the certificate.
 *   TRACE/1     a hash-chained ledger of everything that happened.
 *   OVERWATCH/1 a certificate: one signed line binding a chain that passes the
 *               strict check to its meaning (OBS/1 or LEX/1), its lexicon, its
 *               lineage (every epoch redone from the text) and a point of the
 *               trace.
 *   HYPERPACK/1 the bundle a receiver needs to repeat every check.
 *   HANDSHAKE/1 the receiver's signed answer: what it read and what it decided.
 * A lexicon's format picks its profile (PROFILES): a journey grows one epoch
 * per observation, a tree one epoch per top-level entry. The certificate, the
 * bundle and the answer are the same for both.
 *
 * Also here, each with its own section below:
 *   readHyperpack   the front door: the one way a text from outside the page
 *                   becomes a package. It refuses, before any check runs, what
 *                   is not exactly the wire form of a package with the members
 *                   and types this format knows; then it runs every check.
 *   witnessQuorum   the witness rule: one seal is one witness. An answer counts
 *                   only if it is whole, for the wire that was sent, accepting,
 *                   canonically spelled, from a seal the caller already holds,
 *                   not the sealer's, and not counted before.
 *   the word figures  one 64-bit word as a wheel of 16 sectors and as a square
 *                   of 8 by 8 (glyphCells, glyphHex), the mirror rule that fills
 *                   64 cells from four (seedMirror), and three quarters giving
 *                   the fourth (squareQuarters, fourthFromThree,
 *                   quarterParities). Properties of the words, not of meaning.
 *   LEXICON_TAMPERS what a page lets a visitor try on a sealed tree package,
 *                   and the check that refuses each; the last row is the limit:
 *                   relabelled and sealed again with a new key, it passes.
 *
 * The signing key is whatever key pair the caller passes. A page makes one
 * per visit: its signature shows a certificate has not changed since it was
 * issued, not who issued it and not that its sentences are true. This file
 * cannot tell a package the page made from one that came in as a file, so no
 * check detail says whose key it is. Binding to a Genesis seal is later work.
 */

import { generateSealKeypair, signPayload, verifyPayload, sealIdFromPublic } from "./seal-crypto.js";
import {
  growBiochain, extendBiochain, verifyIntegrityStrict, recreateText, crystalQuat,
  grownCommitment, growthCommitment, sha256HexSync, STRICT_CHECKS,
  crystallize, leafHashSync, merkleRootSync, chainWeaves, qmul, qn, quatHex,
  parseBiochainStreamStrict, decodeChunk, encodeChunk, frameStream,
} from "./biomesh-core.js";

export const OVERWATCH_VERSION = "OVERWATCH/1";
export const SENSES = Object.freeze(["sound", "light", "touch", "symbol", "number"]);
export const MAX_OBSERVATIONS = 64;
export const LEXICON_DIMS = Object.freeze(["2D", "3D"]);
export const TOUCH_GRID = 32, TOUCH_MAX_STEPS = 240, SYMBOL_MAX = 120, NUMBER_MAX_TERMS = 16;

// ─── OBS/1: one observation, one canonical line ──────────────────────────────
// OBS/1|<sense>|<name>|<fields>
//   sound   hz=<20..20000>;ms=<50..5000>
//   light   r=<0..255>;g=<0..255>;b=<0..255>
//   touch   at=<x>,<y>;path=<digits 0..7, at most 240>   (32 x 32 grid; step d
//           moves by TOUCH_STEPS[d]; the path never leaves the grid)
//   symbol  text=<1..120 code points, NFC; %, | and control characters as %XX>
//   number  seq=<1..16 integers 0..65535, comma separated>
// Every number is a canonical decimal (no sign, no leading zero), so one
// observation has exactly one line and the line can be read back to it.

const DEC = /^(0|[1-9]\d*)$/;
const NAME = /^[A-Za-z0-9]([A-Za-z0-9' -]{0,22}[A-Za-z0-9'])?$/;
export const TOUCH_STEPS = Object.freeze([[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]);

const int = (v, lo, hi, what) => {
  if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(`${what} must be a whole number from ${lo} to ${hi}`);
  return v;
};
const dec = (s, lo, hi, what) => {
  if (typeof s !== "string" || !DEC.test(s)) throw new Error(`${what} is not a canonical decimal`);
  return int(Number(s), lo, hi, what);
};
const fieldsOf = (payload, keys) => {
  const parts = payload.split(";");
  if (parts.length !== keys.length) throw new Error("wrong number of fields");
  return parts.map((p, i) => {
    if (!p.startsWith(keys[i] + "=")) throw new Error(`field ${i + 1} is not ${keys[i]}`);
    return p.slice(keys[i].length + 1);
  });
};

export function escapeSymbol(text) {
  let out = "";
  for (const ch of text) {
    const c = ch.codePointAt(0);
    out += (c < 0x20 || c === 0x7f || ch === "%" || ch === "|") ? "%" + c.toString(16).toUpperCase().padStart(2, "0") : ch;
  }
  return out;
}
export function unescapeSymbol(s) {
  return s.replace(/%([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Walk a touch path from its start; throws if it leaves the grid. → [[x, y], ...] */
export function touchCells(at, path) {
  const cells = [[at[0], at[1]]];
  let [x, y] = at;
  for (const d of path) {
    const s = TOUCH_STEPS[Number(d)];
    x += s[0]; y += s[1];
    if (x < 0 || y < 0 || x >= TOUCH_GRID || y >= TOUCH_GRID) throw new Error("the touch path leaves the grid");
    cells.push([x, y]);
  }
  return cells;
}

const PAYLOAD = {
  sound: (o) => `hz=${int(o.hz, 20, 20000, "hz")};ms=${int(o.ms, 50, 5000, "ms")}`,
  light: (o) => `r=${int(o.r, 0, 255, "r")};g=${int(o.g, 0, 255, "g")};b=${int(o.b, 0, 255, "b")}`,
  touch: (o) => {
    if (!Array.isArray(o.at) || o.at.length !== 2) throw new Error("touch needs a start cell");
    int(o.at[0], 0, TOUCH_GRID - 1, "x"); int(o.at[1], 0, TOUCH_GRID - 1, "y");
    if (typeof o.path !== "string" || !/^[0-7]*$/.test(o.path) || o.path.length > TOUCH_MAX_STEPS) throw new Error("touch path must be at most 240 digits 0..7");
    touchCells(o.at, o.path);
    return `at=${o.at[0]},${o.at[1]};path=${o.path}`;
  },
  symbol: (o) => {
    if (typeof o.text !== "string") throw new Error("symbol needs text");
    const t = o.text.normalize("NFC");
    const n = [...t].length;
    if (n < 1 || n > SYMBOL_MAX) throw new Error(`symbol text must be 1 to ${SYMBOL_MAX} characters`);
    if (/[\ud800-\udfff]/.test(t.replace(/[\ud800-\udbff][\udc00-\udfff]/g, ""))) throw new Error("symbol text has a lone surrogate");
    return `text=${escapeSymbol(t)}`;
  },
  number: (o) => {
    if (!Array.isArray(o.seq) || o.seq.length < 1 || o.seq.length > NUMBER_MAX_TERMS) throw new Error(`number needs 1 to ${NUMBER_MAX_TERMS} terms`);
    return `seq=${o.seq.map((v) => int(v, 0, 65535, "term")).join(",")}`;
  },
};
const READ = {
  sound: (p) => { const [hz, ms] = fieldsOf(p, ["hz", "ms"]); return { hz: dec(hz, 20, 20000, "hz"), ms: dec(ms, 50, 5000, "ms") }; },
  light: (p) => { const [r, g, b] = fieldsOf(p, ["r", "g", "b"]); return { r: dec(r, 0, 255, "r"), g: dec(g, 0, 255, "g"), b: dec(b, 0, 255, "b") }; },
  touch: (p) => {
    const [at, path] = fieldsOf(p, ["at", "path"]);
    const xy = at.split(",");
    if (xy.length !== 2) throw new Error("touch start is not x,y");
    return { at: [dec(xy[0], 0, TOUCH_GRID - 1, "x"), dec(xy[1], 0, TOUCH_GRID - 1, "y")], path };
  },
  symbol: (p) => { if (!p.startsWith("text=")) throw new Error("field 1 is not text"); return { text: unescapeSymbol(p.slice(5)) }; },
  number: (p) => { const [seq] = fieldsOf(p, ["seq"]); return { seq: seq.split(",").map((s) => dec(s, 0, 65535, "term")) }; },
};

/** Build an observation. → { sense, name, ...measurements, line } (throws on bad input). */
export function makeObservation(sense, input, name) {
  if (!SENSES.includes(sense)) throw new Error("unknown sense: " + sense);
  if (typeof name !== "string" || !NAME.test(name)) throw new Error("a name is 1 to 24 letters, digits, spaces, ' or -, starting with a letter or digit");
  const payload = PAYLOAD[sense](input || {});
  const line = `OBS/1|${sense}|${name}|${payload}`;
  return { sense, name, ...READ[sense](payload), line };
}

/** Read one OBS/1 line back. Throws unless the line is the canonical line of what it says. */
export function parseObservation(line) {
  if (typeof line !== "string") throw new Error("not a line");
  const a = line.indexOf("|"), b = line.indexOf("|", a + 1), c = line.indexOf("|", b + 1);
  if (a < 0 || b < 0 || c < 0 || line.slice(0, a) !== "OBS/1") throw new Error("not an OBS/1 line");
  const sense = line.slice(a + 1, b), name = line.slice(b + 1, c);
  if (!SENSES.includes(sense)) throw new Error("unknown sense");
  const obs = makeObservation(sense, READ[sense](line.slice(c + 1)), name);
  if (obs.line !== line) throw new Error("not the canonical line");
  return obs;
}

/** A journey's text is its lines, each ended by a newline. → observations (throws otherwise). */
export function parseJourney(text) {
  if (typeof text !== "string" || !text.endsWith("\n")) throw new Error("a journey ends with a newline");
  const lines = text.slice(0, -1).split("\n");
  if (lines.length > MAX_OBSERVATIONS) throw new Error(`a journey holds at most ${MAX_OBSERVATIONS} observations`);
  return lines.map((l, i) => { try { return parseObservation(l); } catch (e) { throw new Error(`line ${i + 1}: ${e.message}`); } });
}
export const journeyText = (observations) => observations.map((o) => o.line + "\n").join("");

// ─── LEXICON/1: exact addresses for a journey ────────────────────────────────

/** observations → [{ address, sense, name, obsSha }]; address = "<sense index>.<n-th of that sense>". */
export function lexiconEntries(observations) {
  const seen = SENSES.map(() => 0);
  return observations.map((o) => {
    const s = SENSES.indexOf(o.sense);
    return { address: `${s}.${seen[s]++}`, sense: o.sense, name: o.name, obsSha: sha256HexSync(o.line) };
  });
}
export const lexiconRoot = (entries) =>
  sha256HexSync([`LEXICON/1|${entries.length}`, ...entries.map((e) => [e.address, e.sense, e.name, e.obsSha].join("|"))].join("\n"));
export function lexiconOf(observations) {
  const entries = lexiconEntries(observations);
  return { format: "LEXICON/1", dims: [...LEXICON_DIMS], entries, root: lexiconRoot(entries) };
}
export function parseAddress(address) {
  const m = /^([0-4])(?:\.(0|[1-9]\d*))?$/.exec(String(address));
  if (!m) throw new Error("not a lexicon address: " + address);
  return m[2] === undefined ? [Number(m[1])] : [Number(m[1]), Number(m[2])];
}

// ─── geometry (binary64; for display only, never committed) ──────────────────
// Points of hyperbolic space are kept on the hyperboloid x²+y²+z²−t² = −1 as
// [x, y, z, t]; isometries are 4x4 Lorentz matrices (row-major, 16 numbers).
// The Poincaré ball point is [x, y, z] / (1 + t); with z = 0 it is the disc.

const D2R = Math.PI / 180, GOLD = 0.6180339887498949;
export const IDENT = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export function lmul(a, b) {
  const o = new Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[r * 4 + k] * b[k * 4 + c];
    o[r * 4 + c] = s;
  }
  return o;
}
export const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
export const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]; };
export const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]; };
export const boostX = (d) => { const c = Math.cosh(d), s = Math.sinh(d); return [c, 0, 0, s, 0, 1, 0, 0, 0, 0, 1, 0, s, 0, 0, c]; };
/** The boost that moves the origin a hyperbolic distance d along the unit vector u. */
export function boostAlong(u, d) {
  const c = Math.cosh(d), s = Math.sinh(d), k = c - 1, [x, y, z] = u;
  return [1 + k * x * x, k * x * y, k * x * z, s * x, k * y * x, 1 + k * y * y, k * y * z, s * y,
    k * z * x, k * z * y, 1 + k * z * z, s * z, s * x, s * y, s * z, c];
}
/** Inverse of a Lorentz matrix: η Mᵀ η. */
export function linv(m) {
  const o = new Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[r * 4 + c] = m[c * 4 + r] * ((r === 3) !== (c === 3) ? -1 : 1);
  return o;
}
export const lapply = (m, p) => [0, 1, 2, 3].map((r) => m[r * 4] * p[0] + m[r * 4 + 1] * p[1] + m[r * 4 + 2] * p[2] + m[r * 4 + 3] * p[3]);
export const originOf = (m) => [m[3], m[7], m[11], m[15]];
export const toBall = (h) => [h[0] / (1 + h[3]), h[1] / (1 + h[3]), h[2] / (1 + h[3])];
export const hypDist = (a, b) => Math.acosh(Math.max(1, a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]));
/** n+1 points of the geodesic from a to b (hyperboloid points). */
export function geodesic(a, b, n = 24) {
  const d = hypDist(a, b);
  if (d < 1e-9) return [a.slice()];
  const out = [], sd = Math.sinh(d);
  for (let i = 0; i <= n; i++) {
    const t = i / n, wa = Math.sinh((1 - t) * d) / sd, wb = Math.sinh(t * d) / sd;
    out.push([0, 1, 2, 3].map((k) => wa * a[k] + wb * b[k]));
  }
  return out;
}

const SENSE_STEP = 1.25, ENTRY_STEP = 1.0, ENTRY_RING = 0.3, RECEIVER_SCALE = 0.8;
const frac = (v) => v - Math.floor(v);
function senseFrame(s, dims) {
  if (dims === "2D") return lmul(rotZ((90 + 72 * s) * D2R), boostX(SENSE_STEP));
  const m = s === 0 ? rotZ(90 * D2R) : lmul(rotY((s - 1) * 90 * D2R), rotZ(20 * D2R));
  return lmul(m, boostX(SENSE_STEP));
}
/** The frame (Lorentz matrix) of a lexicon address in the 2D disc or the 3D ball. */
export function lexiconFrame(address, dims = "2D") {
  if (dims !== "2D" && dims !== "3D") throw new Error("dims is 2D or 3D");
  const [s, e] = parseAddress(address);
  let m = senseFrame(s, dims);
  if (e === undefined) return m;
  const step = boostX(ENTRY_STEP + ENTRY_RING * Math.floor(e / 7));
  if (dims === "2D") m = lmul(m, rotZ((frac((e + 1) * GOLD) - 0.5) * 200 * D2R));
  else m = lmul(lmul(m, rotX(e * 137.50776405 * D2R)), rotZ((22 + 48 * frac(e * GOLD)) * D2R));
  return lmul(m, step);
}
/** The crossroads: four receivers named for cities around first-century Galilee. bearing is the compass
 *  bearing from Galilee (degrees east of north) and km the great-circle distance, both rounded; on the map
 *  north is +y and the distance is compressed to 0.8 ln(1 + km / 60). Athens and Rome share a road. */
export const CROSSROADS = Object.freeze([
  Object.freeze({ id: "antioch", city: "Antioch", people: "Syrians", bearing: 11, km: 397 }),
  Object.freeze({ id: "alexandria", city: "Alexandria", people: "Egyptians", bearing: 253, km: 534 }),
  Object.freeze({ id: "athens", city: "Athens", people: "Greeks", bearing: 303, km: 1201 }),
  Object.freeze({ id: "rome", city: "Rome", people: "Romans", bearing: 304, km: 2252 }),
]);
/** A receiver's frame: a second observer with its own zero point, in the plane z = 0. */
export function receiverFrame(id = CROSSROADS[0].id) {
  const r = CROSSROADS.find((c) => c.id === id);
  if (!r) throw new Error("unknown receiver: " + id);
  return lmul(rotZ((90 - r.bearing) * D2R), boostX(RECEIVER_SCALE * Math.log(1 + r.km / 60)));
}
/** Poincaré point of an address: [x, y, z] (z is 0 in 2D). */
export const lexiconPoint = (address, dims = "2D") => toBall(originOf(lexiconFrame(address, dims)));

/** The crystal of some bytes as a point of the unit ball: the unit quaternion
 *  crystalQuat(bytes) = (w, x, y, z), taken with w >= 0, projected (x, y, z) / (1 + w). */
export function crystalPoint(bytes) {
  let q = crystalQuat(bytes);
  if (q[0] < 0) q = q.map((v) => -v);
  return { quat: q, point: [q[1] / (1 + q[0]), q[2] / (1 + q[0]), q[3] / (1 + q[0])] };
}

/** The native shape of an observation: Euclidean points [x, y, z] inside the unit ball. */
export function senseGlyph(o) {
  const TAU = 2 * Math.PI;
  if (o.sense === "sound") {            // pitch helix: angle = pitch class, height and radius = octave
    const oct = Math.log2(o.hz / 16.3516), a = TAU * frac(oct) + Math.PI / 2, r = 0.2 + 0.06 * oct;
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const w = (i / 48) * Math.min(1, o.ms / 2000);
      pts.push([(r + 0.05 * Math.sin(i * 1.3)) * Math.cos(a - w * TAU), (r + 0.05 * Math.sin(i * 1.3)) * Math.sin(a - w * TAU), (oct - 5) / 7]);
    }
    return pts;
  }
  if (o.sense === "light") {            // colour solid: angle = hue, radius = saturation, height = lightness
    const r = o.r / 255, g = o.g / 255, b = o.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
    const h = c === 0 ? 0 : mx === r ? ((g - b) / c + 6) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
    const l = (mx + mn) / 2, rad = 0.85 * c * Math.sqrt(Math.max(0, 1 - (2 * l - 1) ** 2)) + 0.02;
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push([rad * (i / 12) * Math.cos(h * TAU / 6), rad * (i / 12) * Math.sin(h * TAU / 6), (2 * l - 1) * 0.8 * (i / 12)]);
    return pts;
  }
  if (o.sense === "touch") {            // the stroke itself, rising as it goes
    const cells = touchCells(o.at, o.path), n = Math.max(1, cells.length - 1);
    return cells.map(([x, y], i) => [((x + 0.5) / TOUCH_GRID * 2 - 1) * 0.66, -((y + 0.5) / TOUCH_GRID * 2 - 1) * 0.66, (i / n - 0.5) * 0.5]);
  }
  if (o.sense === "symbol") {           // each UTF-8 byte is an angle on a 256-gon; the text spirals outwards
    const bytes = [...new TextEncoder().encode(o.text)], n = Math.max(1, bytes.length - 1);
    return bytes.map((v, i) => { const r = 0.25 + 0.6 * (i / n); return [r * Math.cos(TAU * v / 256), r * Math.sin(TAU * v / 256), (i / n - 0.5) * 0.9]; });
  }
  const mx = Math.max(1, ...o.seq), n = Math.max(1, o.seq.length - 1);   // number: golden-angle turns, radius by size
  return o.seq.map((v, i) => { const r = 0.12 + 0.75 * Math.sqrt(v / mx), a = v * TAU * GOLD; return [r * Math.cos(a), r * Math.sin(a), (i / n - 0.5) * 0.9]; });
}

// ─── the 64-bit SHD-CCP word, read back (RFC 07 section 5 field map) ─────────

export const PACKET_FIELDS = Object.freeze([
  { key: "form", hi: 63, lo: 60 }, { key: "parity", hi: 59, lo: 59 }, { key: "spin", hi: 58, lo: 56 },
  { key: "quat32", hi: 55, lo: 24 }, { key: "payload16", hi: 23, lo: 8 }, { key: "freq", hi: 7, lo: 3 }, { key: "amp", hi: 2, lo: 0 },
]);
/** 16 hex digits → { bits (64 chars, bit 63 first), parityOk, form, parity, spin, quat32, payload16, freq, amp }. */
export function decodePacket(hex) {
  if (typeof hex !== "string" || !/^[0-9A-Fa-f]{16}$/.test(hex)) throw new Error("a packet is 16 hex digits");
  const word = BigInt("0x" + hex), bits = word.toString(2).padStart(64, "0");
  const out = { hex: hex.toUpperCase(), bits };
  for (const f of PACKET_FIELDS) out[f.key] = Number((word >> BigInt(f.lo)) & ((1n << BigInt(f.hi - f.lo + 1)) - 1n));
  let ones = 0; for (let i = 0; i < 64; i++) if (i !== 4 && bits[i] === "1") ones++;   // bits[4] is bit 59
  out.parityOk = (ones & 1) === out.parity;
  return out;
}
/** The same word with one bit (0..63) flipped. */
export const flipBit = (hex, bit) => (BigInt("0x" + hex) ^ (1n << BigInt(bit))).toString(16).toUpperCase().padStart(16, "0");

// ─── TRACE/1: a hash-chained ledger ──────────────────────────────────────────

const ZERO64 = "0".repeat(64);
const traceHash = (e) => sha256HexSync(["TRACE/1", e.n, e.actor, e.event, e.at, sha256HexSync(e.detail), e.prev].join("|"));
/** Append an entry in place and return it. actor: "human" | "strix" | "overwatch" | "system". */
export function traceAppend(ledger, actor, event, detail = "", at = new Date().toISOString()) {
  const e = { n: ledger.length, actor: String(actor), event: String(event), detail: String(detail), at: String(at), prev: ledger.length ? ledger[ledger.length - 1].hash : ZERO64 };
  e.hash = traceHash(e);
  ledger.push(e);
  return e;
}
/** → { ok, brokenAt (index or null), head } */
export function verifyTrace(ledger) {
  if (!Array.isArray(ledger)) return { ok: false, brokenAt: 0, head: null };
  let prev = ZERO64;
  for (let i = 0; i < ledger.length; i++) {
    const e = ledger[i];
    const fine = e && typeof e === "object" && e.n === i && e.prev === prev
      && ["actor", "event", "detail", "at", "hash"].every((k) => typeof e[k] === "string") && e.hash === traceHash(e);
    if (!fine) return { ok: false, brokenAt: i, head: null };
    prev = e.hash;
  }
  return { ok: true, brokenAt: null, head: ledger.length ? prev : null };
}

// ─── the journey chain: one shdccp/2 biochain, one epoch per observation ─────

/** The commitment an epoch's grower signs: GROWN/1 for the first, GROWTH/1 after. */
export const epochCommitment = (chain) => ((chain.epoch || 1) > 1 ? growthCommitment(chain) : grownCommitment(chain));
/** Grow the journey by one observation: the first grows a chain, the rest extend it. */
export async function growJourney(parent, observation) {
  const chain = parent ? await extendBiochain(parent, observation.line + "\n", { enforceStrict: true }) : await growBiochain(observation.line + "\n");
  return JSON.parse(JSON.stringify(chain));          // a plain record (drops extendBiochain's hidden parentStrict)
}
export const lineageRow = (chain) => ({ epoch: chain.epoch || 1, chainId: chain.chainId, merkleRoot: chain.merkleRoot });

// ─── Overwatch: inspect, certify, package, verify ────────────────────────────

export const OVERWATCH_CHECKS = Object.freeze([...STRICT_CHECKS, "meaning", "lexicon", "lineage", "trace"]);
export const PACKAGE_CHECKS = Object.freeze(["parse", ...OVERWATCH_CHECKS, "commitment", "signature"]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Inspect an evidence bundle { chain, lexicon, lineage, trace }.
 * → { ok, failed, checks: [{ name, ok (true | false | null = not run), detail }] }
 * The checks run in order and stop at the first failure:
 *   parity .. derived  verifyIntegrityStrict(chain), check for check
 *   meaning   the recreated text is a journey: every line a canonical OBS/1 line
 *   lexicon   the lexicon is exactly the one the observations give (addresses,
 *             names, line hashes, root, dims 2D and 3D)
 *   lineage   one epoch per observation; every epoch regrown from the text's
 *             first lines has the chainId and Merkle root lineage lists, the
 *             last one is the chain, and the chain's parent link is the epoch before
 *   trace     the ledger's hash chain is whole and holds, for every epoch, a
 *             "chain.grown" entry whose detail is that epoch's commitment
 * opts.traceUpTo: inspect only the ledger up to (and including) that entry hash.
 * The words above describe a journey (LEXICON/1). What the text is, is decided by lexicon.format
 * (profileOf, at the end of this file): for a tree lexicon (LEXICON/2) meaning reads LEX/1 lines, the
 * lexicon is the one the entries give, and there is one epoch per top-level entry.
 */
export async function overwatchInspect(bundle, opts = {}) {
  const { chain, lexicon, lineage, trace } = bundle || {};
  const checks = [];
  const done = (failed) => {
    for (const name of OVERWATCH_CHECKS) if (!checks.some((c) => c.name === name)) checks.push({ name, ok: null, detail: "not run" });
    return { ok: failed === null, failed, checks };
  };
  const strict = verifyIntegrityStrict(chain);
  for (const c of strict.checks) checks.push({ name: c.name, ok: c.ok, detail: c.detail });
  if (!strict.ok) return done(strict.failed);

  const profile = profileOf(lexicon);      // what the text is: a journey (LEXICON/1, the default) or a tree (LEXICON/2)
  let observations, text;
  try { text = recreateText(chain); observations = profile.parse(text); }
  catch (e) { checks.push({ name: "meaning", ok: false, detail: String(e.message || e) }); return done("meaning"); }
  checks.push({ name: "meaning", ok: true, detail: `${observations.length} canonical ${profile.line} line${observations.length === 1 ? "" : "s"}` });

  const want = profile.lexicon(observations);
  if (!lexicon || !same(lexicon, want)) {
    const detail = !lexicon ? "no lexicon" : lexicon.root !== want.root ? `the lexicon root is not the one the ${profile.items} give` : `the lexicon is not the one the ${profile.items} give`;
    checks.push({ name: "lexicon", ok: false, detail }); return done("lexicon");
  }
  checks.push({ name: "lexicon", ok: true, detail: `${want.entries.length} exact address${want.entries.length === 1 ? "" : "es"}, 2D and 3D` });

  const epochTexts = profile.epochs(observations);
  let epochs = [], bad = null;
  if (!Array.isArray(lineage) || lineage.length !== epochTexts.length) bad = `lineage does not list one epoch per ${profile.unit}`;
  else if ((chain.epoch || 1) !== epochTexts.length) bad = `the chain's epoch is not its number of ${profile.units}`;
  if (!bad) {
    epochs = await profile.lineage(epochTexts);
    const at = epochs.findIndex((rec, i) => !same(lineage[i], lineageRow(rec)));
    if (at >= 0) bad = `epoch ${at + 1} ${profile.redone} from the text is not the one lineage lists`;
  }
  if (!bad) {
    const last = epochs[epochs.length - 1];
    if (last.chainId !== chain.chainId || last.merkleRoot !== chain.merkleRoot) bad = "the last epoch is not this chain";
    else for (const k of ["parentChainId", "parentMerkleRoot", "epoch", "addedBytes"]) if (!same(chain[k], last[k])) { bad = `the chain's ${k} is not the ${profile.redone} one`; break; }
  }
  if (bad) { checks.push({ name: "lineage", ok: false, detail: bad }); return done("lineage"); }
  checks.push({ name: "lineage", ok: true, detail: `${epochs.length} epoch${epochs.length === 1 ? "" : "s"} ${profile.redone} from the text` });

  let ledger = Array.isArray(trace) ? trace : [];
  if (opts.traceUpTo !== undefined) {
    const at = ledger.findIndex((e) => e && e.hash === opts.traceUpTo);
    if (at < 0) { checks.push({ name: "trace", ok: false, detail: "the ledger does not hold the entry the certificate names" }); return done("trace"); }
    ledger = ledger.slice(0, at + 1);
  }
  const tv = verifyTrace(Array.isArray(trace) ? trace : null);
  if (!tv.ok) { checks.push({ name: "trace", ok: false, detail: `the ledger's hash chain breaks at entry ${tv.brokenAt}` }); return done("trace"); }
  const missing = epochs.findIndex((r) => !ledger.some((e) => e.event === "chain.grown" && e.detail === epochCommitment(r)));
  if (missing >= 0) { checks.push({ name: "trace", ok: false, detail: `no chain.grown entry for epoch ${missing + 1}` }); return done("trace"); }
  checks.push({ name: "trace", ok: true, detail: `${ledger.length} linked entries, every epoch recorded` });
  return done(null);
}

export const SCOPE = "strict+meaning+lexicon+lineage+trace";
export const overwatchCommitment = ({ chain, lexicon, traceHead }) =>
  [OVERWATCH_VERSION, chain.chainId, chain.merkleRoot, String(chain.epoch || 1), lexicon.root, LEXICON_DIMS.join("+"), traceHead, SCOPE].join("|");

export const newSessionKeys = () => generateSealKeypair();

/** Inspect, and if every check passes sign the OVERWATCH/1 line. → { certificate, report } (certificate null on failure). */
export async function issueCertificate(bundle, keys, at = new Date().toISOString()) {
  const report = await overwatchInspect(bundle);
  if (!report.ok) return { certificate: null, report };
  const traceHead = bundle.trace[bundle.trace.length - 1].hash;
  const commitment = overwatchCommitment({ chain: bundle.chain, lexicon: bundle.lexicon, traceHead });
  const certificate = {
    format: OVERWATCH_VERSION, commitment, traceHead, issuedAt: at,
    sealId: await sealIdFromPublic(keys.publicJwk), publicJwk: keys.publicJwk,
    sig: await signPayload(keys.privateJwk, commitment),
  };
  return { certificate, report };
}

/** Repeat the inspection and check the certificate against it. → { ok, failed, checks } over OVERWATCH_CHECKS + commitment + signature. */
export async function verifyCertificate(certificate, bundle) {
  const cert = certificate && typeof certificate === "object" ? certificate : {};
  const report = await overwatchInspect(bundle, { traceUpTo: cert.traceHead });
  const checks = report.checks.slice();
  const finish = (failed) => {
    for (const name of ["commitment", "signature"]) if (!checks.some((c) => c.name === name)) checks.push({ name, ok: null, detail: "not run" });
    return { ok: failed === null, failed, checks };
  };
  if (!report.ok) return finish(report.failed);
  const want = overwatchCommitment({ chain: bundle.chain, lexicon: bundle.lexicon, traceHead: cert.traceHead });
  if (cert.format !== OVERWATCH_VERSION || cert.commitment !== want) {
    checks.push({ name: "commitment", ok: false, detail: "the certificate's line is not the one this evidence gives" }); return finish("commitment");
  }
  checks.push({ name: "commitment", ok: true, detail: "the OVERWATCH/1 line rebuilt from the evidence" });
  const jwk = cert.publicJwk;
  const idOk = jwk && typeof jwk === "object" && typeof jwk.x === "string" && typeof jwk.y === "string" && cert.sealId === await sealIdFromPublic(jwk);
  const sigOk = idOk && typeof cert.sig === "string" && await verifyPayload(jwk, cert.commitment, cert.sig);
  if (!sigOk) { checks.push({ name: "signature", ok: false, detail: idOk ? "the signature does not verify" : "the seal id is not the key's" }); return finish("signature"); }
  // What was checked, and no more: this code cannot know when the key was made or whose it is. A page that made
  // the key in this visit may say so beside this detail; for a package from outside nobody here can.
  checks.push({ name: "signature", ok: true, detail: `ECDSA P-256 by ${cert.sealId}` });
  return finish(null);
}

/** Bundle everything a receiver needs. route.to is a lexicon address or "receiver". */
export function makeHyperpack({ chain, lexicon, lineage, trace, certificate }, route = { from: "origin", to: "receiver" }) {
  return JSON.parse(JSON.stringify({ format: "HYPERPACK/1", route, chain, lexicon, lineage, trace, certificate }));
}
/** Verify a HYPERPACK/1 (an object or its JSON text). → { ok, failed, checks } over PACKAGE_CHECKS. */
export async function verifyHyperpack(input) {
  let pack = input, why = null;
  if (typeof input === "string") { try { pack = JSON.parse(input); } catch { why = "not JSON"; } }
  if (!why && (!pack || typeof pack !== "object" || pack.format !== "HYPERPACK/1")) why = "not a HYPERPACK/1";
  if (why) return { ok: false, failed: "parse", checks: PACKAGE_CHECKS.map((name, i) => ({ name, ok: i ? null : false, detail: i ? "not run" : why })) };
  const v = await verifyCertificate(pack.certificate, pack);
  return { ok: v.ok, failed: v.failed, checks: [{ name: "parse", ok: true, detail: "a HYPERPACK/1 bundle" }, ...v.checks] };
}

// ─── HANDSHAKE/1: the receiver answers, the sender checks the answer ─────────
// HANDSHAKE/1|<sha256 of the text received>|<chainId or ->|accepted or refused|<failed check or ->
// The receiver signs the line with its own key. The sender then knows three
// things without trusting the path: the answer is whole (signature), the
// receiver read exactly the text that was sent (echo), and what it decided.
// Not RFC 06: that RFC (the frame-free alignment handshake) is still an outline.

export const handshakeLine = (wireSha, verdict, chainId = "-") =>
  ["HANDSHAKE/1", wireSha, chainId, verdict.ok ? "accepted" : "refused", verdict.failed || "-"].join("|");

/** The receiver's side: verify the text, then sign what was read and what was decided. → { verdict, answer } */
export async function answerHyperpack(wire, keys, at = new Date().toISOString()) {
  const verdict = await verifyHyperpack(wire);
  let chainId = "-";
  try { const id = JSON.parse(wire).chain.chainId; if (typeof id === "string" && /^BC-[0-9a-f]{24}$/.test(id)) chainId = id; } catch { /* not readable: "-" */ }
  const line = handshakeLine(sha256HexSync(String(wire)), verdict, chainId);
  const answer = {
    format: "HANDSHAKE/1", line, answeredAt: at,
    sealId: await sealIdFromPublic(keys.publicJwk), publicJwk: keys.publicJwk, sig: await signPayload(keys.privateJwk, line),
  };
  return { verdict, answer };
}

/** The sender's side. → { ok, failed ("signature" | "echo" | "refused" | null), checks } ; ok means the handshake is complete. */
export async function verifyAnswer(answer, sentWire) {
  const a = answer && typeof answer === "object" ? answer : {};
  const checks = [];
  const end = (failed) => {
    for (const name of ["signature", "echo", "accepted"]) if (!checks.some((c) => c.name === name)) checks.push({ name, ok: null, detail: "not run" });
    return { ok: failed === null, failed, checks };
  };
  const jwk = a.publicJwk, parts = typeof a.line === "string" ? a.line.split("|") : [];
  const shaped = a.format === "HANDSHAKE/1" && parts.length === 5 && parts[0] === "HANDSHAKE/1" && (parts[3] === "accepted" || parts[3] === "refused");
  const idOk = shaped && jwk && typeof jwk === "object" && typeof jwk.x === "string" && typeof jwk.y === "string" && a.sealId === await sealIdFromPublic(jwk);
  if (!(idOk && typeof a.sig === "string" && await verifyPayload(jwk, a.line, a.sig))) {
    checks.push({ name: "signature", ok: false, detail: !shaped ? "not a HANDSHAKE/1 answer" : idOk ? "the signature does not verify" : "the seal id is not the key's" });
    return end("signature");
  }
  checks.push({ name: "signature", ok: true, detail: `the answer is whole, signed by ${a.sealId}` });
  if (parts[1] !== sha256HexSync(String(sentWire))) {
    checks.push({ name: "echo", ok: false, detail: "the receiver read a different text from the one sent" }); return end("echo");
  }
  checks.push({ name: "echo", ok: true, detail: "the receiver read exactly the text that was sent" });
  if (parts[3] !== "accepted") { checks.push({ name: "accepted", ok: false, detail: `the receiver refused it at ${parts[4]}` }); return end("refused"); }
  checks.push({ name: "accepted", ok: true, detail: "the receiver repeated every check and accepted" });
  return end(null);
}

/** What two observers need to change frames, from the frame of one as the other sees it: the distance between
 *  their zero points (the same from either side) and the direction each sees the other in (degrees in the
 *  xy-plane, anticlockwise from +x). Binary64, display only. */
export function frameParameters(frame) {
  const there = originOf(frame), back = originOf(linv(frame));
  return {
    distance: Math.acosh(Math.max(1, there[3])), distanceBack: Math.acosh(Math.max(1, back[3])),
    bearingOut: Math.atan2(there[1], there[0]) / D2R, bearingBack: Math.atan2(back[1], back[0]) / D2R,
  };
}

// ─── LEX/1 and LEXICON/2 (drafts, not RFCs): a tree lexicon as text ──────────
// A tree lexicon is a list of entries, and each entry is one canonical line of text:
//   LEX/1|<address>|<layer>|<kind>|<name>|<text>
//   address  1 to 8 indices joined by "."; each index a canonical decimal 0..9999 (no sign, no
//            leading zero). Indices need not be consecutive, so an address can be a citation:
//            43.3.16 is John 3:16.
//   layer    one of LAYERS: the kind of statement the entry makes
//   kind     a lower-case letter, then at most 15 lower-case letters, digits or hyphens
//            (presentation only)
//   name     after NFC: 1 to 96 code points, each a letter, a mark, a number, punctuation, a symbol
//            or the space U+0020; no space first, last or twice in a row; no mark first; nothing
//            default-ignorable
//   text     after NFC: 0 to 1200 code points from the same set or the newline U+000A; nothing
//            default-ignorable
// In name and text "%", "|" and the newline are written %25, %7C and %0A (escapeSymbol), so a line
// splits at "|" into exactly six parts; and the whole line must be its own NFC form. One entry has
// exactly one line, and the line reads back to the entry. A line holds no control or format
// character (so no zero-width character and no bidi control), no private-use, unassigned or
// surrogate code point and no separator but U+0020. NFC and the categories are those of the Unicode
// version of the engine that runs this code. Two things the rule does not exclude: a symbol that
// draws nothing (U+2800), and right-to-left letters, which take part in bidi layout like any text.
// Pages therefore show the address beside a name and isolate every string they did not write.
//
// LEXICON/2 text: every line followed by "\n", in the one canonical order, the depth-first listing
// of the tree with the children of every entry in increasing index order. The first line is a
// top-level entry. Every later line with address P.k has P empty, or P the address of the line
// before, or P that address with trailing indices removed; and k is greater, as a number, than the
// index of the last line seen with parent P. So one tree has exactly one text. Limits:
// MAX_LEXICON_BYTES of UTF-8, MAX_ENTRIES lines, MAX_EPOCHS top-level entries (one growth epoch each).
//
// Every error thrown here is a fixed sentence, at most with a line number in front: never input text.

export const LAYERS = Object.freeze(["text", "said", "checked", "reading"]);
export const MAX_LEXICON_BYTES = 60000, MAX_ENTRIES = 3000, MAX_EPOCHS = 16;

const LEX_ADDRESS = /^(0|[1-9]\d{0,3})(\.(0|[1-9]\d{0,3})){0,7}$/;
const LEX_KIND = /^[a-z][a-z0-9-]{0,15}$/;
const LEX_NAME = /^(?! )(?!.* $)(?!.*  )(?!\p{M})[\p{L}\p{M}\p{N}\p{P}\p{S} ]+$/u;
const LEX_TEXT = /^[\p{L}\p{M}\p{N}\p{P}\p{S} \n]*$/u;
const LEX_IGNORABLE = /\p{Default_Ignorable_Code_Point}/u;
const LEX_NAME_MAX = 96, LEX_TEXT_MAX = 1200;
// No canonical line is longer than this many UTF-16 units: the tag, five separators, the longest address (39),
// layer (7) and kind (16), and a name and a text in which every code point takes three units (an escape).
const LEX_LINE_MAX = 5 + 5 + 39 + 7 + 16 + 3 * (LEX_NAME_MAX + LEX_TEXT_MAX);
/** Is v an array of objects, each with a string member of that name (when one is named)? */
const entriesWith = (v, member) => Array.isArray(v) && v.every((e) => e !== null && typeof e === "object" && (member === undefined || typeof e[member] === "string"));

/** Build an entry. → frozen { address, layer, kind, name, text, line }, name and text in NFC (throws on bad input). */
export function makeEntry(address, layer, kind, name, text) {
  if (![address, layer, kind, name, text].every((v) => typeof v === "string")) throw new Error("an entry is five strings: address, layer, kind, name and text");
  if (!LEX_ADDRESS.test(address)) throw new Error("an address is 1 to 8 whole numbers from 0 to 9999 joined by dots, each without a leading zero");
  if (!LAYERS.includes(layer)) throw new Error("a layer is text, said, checked or reading");
  if (!LEX_KIND.test(kind)) throw new Error("a kind is a lower-case letter, then at most 15 lower-case letters, digits or hyphens");
  const n = name.normalize("NFC"), t = text.normalize("NFC");
  const nameLength = [...n].length;
  if (nameLength < 1 || nameLength > LEX_NAME_MAX) throw new Error(`a name is 1 to ${LEX_NAME_MAX} code points long`);
  if (!LEX_NAME.test(n)) throw new Error("a name holds letters, marks, numbers, punctuation, symbols and single spaces, and begins with no space or mark and ends with no space");
  if (LEX_IGNORABLE.test(n)) throw new Error("a name holds no invisible (default-ignorable) character");
  if ([...t].length > LEX_TEXT_MAX) throw new Error(`entry text is at most ${LEX_TEXT_MAX} code points long`);
  if (!LEX_TEXT.test(t)) throw new Error("entry text holds letters, marks, numbers, punctuation, symbols, spaces and newlines only");
  if (LEX_IGNORABLE.test(t)) throw new Error("entry text holds no invisible (default-ignorable) character");
  const line = "LEX/1|" + [address, layer, kind, escapeSymbol(n), escapeSymbol(t)].join("|");
  if (line.normalize("NFC") !== line) throw new Error("the line of an entry is its own NFC form: no combining mark may join the escape written for a | or a newline");
  return Object.freeze({ address, layer, kind, name: n, text: t, line });
}

/** Read one LEX/1 line back. Throws unless the line is the canonical line of the entry it gives. */
export function parseEntry(line) {
  if (typeof line !== "string") throw new Error("a LEX/1 line is a string");
  if (line.length > LEX_LINE_MAX) throw new Error("not a LEX/1 line: longer than the line of any entry");
  const parts = line.split("|");
  if (parts.length !== 6 || parts[0] !== "LEX/1") throw new Error("not a LEX/1 line: the tag LEX/1 and five more parts, separated by |");
  const entry = makeEntry(parts[1], parts[2], parts[3], unescapeSymbol(parts[4]), unescapeSymbol(parts[5]));
  if (entry.line !== line) throw new Error("not the canonical line of its entry");
  return entry;
}

/** A lexicon's text: the line of every entry, each ended by a newline (entries in canonical order). */
export function lexiconText(entries) {
  if (!entriesWith(entries, "line")) throw new Error("lexiconText needs an array of entries made by makeEntry");
  return entries.map((e) => e.line + "\n").join("");
}

/** Read a LEXICON/2 text back. → entries (throws unless the text is the one canonical text of a tree within the limits). */
export function parseLexiconText(text) {
  if (typeof text !== "string") throw new Error("a lexicon text is a string");
  // every UTF-16 unit is at least one byte, so a text that is far too long is refused without being encoded
  const tooLong = text.length > MAX_LEXICON_BYTES || new TextEncoder().encode(text).length > MAX_LEXICON_BYTES;
  if (tooLong) throw new Error(`a lexicon text is at most ${MAX_LEXICON_BYTES} bytes of UTF-8`);
  if (text === "") throw new Error("a lexicon has at least one entry");
  if (!text.endsWith("\n")) throw new Error("a lexicon text ends with a newline");
  const lines = text.slice(0, -1).split("\n");
  if (lines.length > MAX_ENTRIES) throw new Error(`a lexicon holds at most ${MAX_ENTRIES} entries`);
  const lastIndex = new Map();        // parent address → the index of the last line seen with that parent
  let before = null, topLevel = 0;    // before: the address of the line before
  return lines.map((l, i) => {
    const fail = (why) => { throw new Error(`line ${i + 1}: ${why}`); };
    let entry;
    try { entry = parseEntry(l); } catch (e) { fail(e.message); }
    const parent = parentOf(entry.address), index = Number(entry.address.slice(parent === "" ? 0 : parent.length + 1));
    if (before === null && parent !== "") fail("the first entry of a lexicon is a top-level entry");
    const near = parent === "" || parent === before || before.startsWith(parent + ".");   // an ancestor ends at a dot: 1 is none of 10.0
    if (!near) fail("out of depth-first order: the parent is neither the entry before nor one of its ancestors");
    if (lastIndex.has(parent) && index <= lastIndex.get(parent)) fail("the index is not greater than the last index under the same parent");
    if (parent === "" && ++topLevel > MAX_EPOCHS) fail(`a lexicon holds at most ${MAX_EPOCHS} top-level entries`);
    lastIndex.set(parent, index); before = entry.address;
    return entry;
  });
}

/** The address with its last index removed: parentOf("26.1") is "26", parentOf("26") is "" (the root, which is its own parent). */
export function parentOf(address) {
  if (typeof address !== "string") throw new Error("an address is a string");
  const dot = address.lastIndexOf(".");
  return dot < 0 ? "" : address.slice(0, dot);
}
/** The number of indices in an address: depthOf("") is 0, depthOf("26") is 1, depthOf("26.1.4") is 3. */
export function depthOf(address) {
  if (typeof address !== "string") throw new Error("an address is a string");
  return address === "" ? 0 : address.split(".").length;
}
/** entries (canonical order) → Map(address → [child addresses, in order]); "" lists the top level and every entry has a list. */
export function childrenIndex(entries) {
  if (!entriesWith(entries, "address")) throw new Error("childrenIndex needs an array of entries");
  const index = new Map([["", []]]);
  for (const e of entries) {
    const parent = parentOf(e.address);
    if (!index.has(e.address)) index.set(e.address, []);
    if (!index.has(parent)) index.set(parent, []);
    index.get(parent).push(e.address);
  }
  return index;
}
/** entries → { text, said, checked, reading }: how many entries carry each layer. */
export function layerCounts(entries) {
  if (!entriesWith(entries)) throw new Error("layerCounts needs an array of entries");
  const counts = { text: 0, said: 0, checked: 0, reading: 0 };
  for (const e of entries) if (LAYERS.includes(e.layer)) counts[e.layer] += 1;
  return counts;
}

const LEX_WORD_BEFORE = /[\p{L}\p{M}]$/u;
/** How often a word stands in a text as a whole word: matches not directly preceded or followed by a letter (or a
 *  combining mark, which belongs to its letter), case-insensitive, both strings in NFC. Matches do not overlap. */
export function countWord(text, word) {
  if (typeof text !== "string" || typeof word !== "string") throw new Error("countWord needs a text and a word, both strings");
  const t = text.normalize("NFC"), w = word.normalize("NFC");
  if (w === "") return 0;
  const find = new RegExp(w.replace(/[\\^$.*+?()[\]{}|\/]/g, "\\$&") + "(?![\\p{L}\\p{M}])", "giu");
  let count = 0;
  for (let m = find.exec(t); m !== null; m = find.exec(t)) {
    if (!LEX_WORD_BEFORE.test(t.slice(Math.max(0, m.index - 2), m.index))) count += 1;
    else find.lastIndex = m.index + (t.codePointAt(m.index) > 0xffff ? 2 : 1);   // not a whole word: look again one code point on
  }
  return count;
}

// ─── LEXICON/2: the lexicon object, the epochs and the chain of a tree ───────
// The lexicon object of a tree lists every entry by address, layer, kind and name with the SHA-256 of
// its line. Its root hashes that list under the tag LEXICON/2, and the root is in the signed OVERWATCH/1
// line. The layer is part of each line and of the root, so a package in which a label was changed no
// longer fits its certificate. This protects a label after sealing. It does not show the label was right
// when it was sealed, and anyone can seal a relabelled lexicon with a key of their own.
//
// A tree grows one epoch per top-level entry, in address order: epoch k is the text up to the line before
// top-level entry k + 1, and the last epoch is the whole text. The epochs are where the format cuts the
// text. They are no record of when or in what order anything was written. A lexicon chain is an ordinary
// shdccp/2 record without the optional engram layer.

const CHUNK_BYTES = 720;                 // the shdccp/2 cut (RFC 07): every chunk but the last holds 720 bytes
const copyOf = (v) => JSON.parse(JSON.stringify(v));
const isRecord = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** The root of the entry list of a LEXICON/2 lexicon object, [{ address, layer, kind, name, lineSha }]. */
export function treeLexiconRoot(entries) {
  if (!entriesWith(entries)) throw new Error("treeLexiconRoot needs the entries of a lexicon object");
  return sha256HexSync([`LEXICON/2|${entries.length}`, ...entries.map((e) => [e.address, e.layer, e.kind, e.name, e.lineSha].join("|"))].join("\n"));
}
/** entries (canonical order) → { format: "LEXICON/2", dims: ["2D", "3D"], entries: [{ address, layer, kind, name, lineSha }], root }.
 *  The members come in exactly this order: the lexicon check compares JSON text. name is the entry's (NFC, not escaped). */
export function treeLexiconOf(entries) {
  if (!entriesWith(entries, "line")) throw new Error("treeLexiconOf needs an array of entries made by makeEntry");
  const list = entries.map((e) => ({ address: e.address, layer: e.layer, kind: e.kind, name: e.name, lineSha: sha256HexSync(e.line) }));
  return { format: "LEXICON/2", dims: [...LEXICON_DIMS], entries: list, root: treeLexiconRoot(list) };
}
/** entries (canonical order) → the text of every epoch: one per top-level entry, each the text up to the line before the
 *  next top-level entry, the last the whole text. Every one is a beginning of the next. */
export function treeEpochTexts(entries) {
  if (!entriesWith(entries, "line") || !entriesWith(entries, "address")) throw new Error("treeEpochTexts needs an array of entries made by makeEntry");
  if (entries.length === 0) throw new Error("a lexicon has at least one entry");
  const texts = [];
  let text = "";
  entries.forEach((e, i) => {
    if (i > 0 && !e.address.includes(".")) texts.push(text);
    text += e.line + "\n";
  });
  texts.push(text);
  return texts;
}

/** One record per epoch, computed once from the last text: what lineageRow and epochCommitment read, with the values a
 *  chain grown from that epoch's text has. Every epoch text is a beginning of the last one, so the two share every full
 *  720-byte chunk: the leaves and the chiral weave of the full chunks are computed once, and each epoch adds its own
 *  last, shorter chunk. Only functions biomesh-core.js exports are used (leafHashSync, merkleRootSync, crystalQuat,
 *  qmul, qn, quatHex, chainWeaves). The first record has no epoch member, as a chain of one epoch has none. */
function treeEpochRecords(epochTexts) {
  const fine = Array.isArray(epochTexts) && epochTexts.length > 0 && epochTexts.every((t) => typeof t === "string" && t !== "" && t.isWellFormed());
  if (!fine) throw new Error("a lineage needs the text of every epoch, first to last, each a well-formed string that is not empty");
  const whole = epochTexts[epochTexts.length - 1], utf8 = new TextEncoder(), all = utf8.encode(whole);
  if (all.length > MAX_LEXICON_BYTES) throw new Error(`a lexicon text is at most ${MAX_LEXICON_BYTES} bytes of UTF-8`);
  const full = Math.floor(all.length / CHUNK_BYTES), leaves = [], weaves = [[1, 0, 0, 0]];   // weaves[j]: the chiral weave after j full chunks
  for (let j = 0; j < full; j++) {
    const chunk = all.subarray(j * CHUNK_BYTES, (j + 1) * CHUNK_BYTES);
    leaves.push(leafHashSync(j, chunk));
    weaves.push(qn(qmul(crystalQuat(chunk), weaves[j])));
  }
  const records = [];
  let before = 0;                        // the bytes of the epoch before
  for (let i = 0; i < epochTexts.length; i++) {
    if (!whole.startsWith(epochTexts[i])) throw new Error("every epoch text is a beginning of the last one");
    const bytes = i === epochTexts.length - 1 ? all.length : utf8.encode(epochTexts[i]).length;
    if (bytes <= before) throw new Error("every epoch adds text to the one before");
    const m = Math.floor(bytes / CHUNK_BYTES), epochLeaves = leaves.slice(0, m);
    let weave = weaves[m];
    if (bytes > m * CHUNK_BYTES) {       // this epoch ends in a chunk of fewer than 720 bytes
      const rest = all.subarray(m * CHUNK_BYTES, bytes);
      epochLeaves.push(leafHashSync(m, rest));
      weave = qn(qmul(crystalQuat(rest), weave));
    }
    const merkleRoot = merkleRootSync(epochLeaves), weaveChiral = quatHex(weave);
    const chainId = "BC-" + sha256HexSync(merkleRoot + "|" + weaveChiral).slice(0, 24);
    if (i === 0) {                       // GROWN/1 also names the mirror weave: computed for the first epoch only
      const chunks = [];
      for (let at = 0; at < bytes; at += CHUNK_BYTES) chunks.push(all.subarray(at, Math.min(at + CHUNK_BYTES, bytes)));
      records.push({ chainId, merkleRoot, weaveChiral, weaveMirror: chainWeaves(chunks).weaveMirror, origBytes: bytes });
    } else {
      const prev = records[i - 1];
      records.push({ chainId, merkleRoot, origBytes: bytes, parentChainId: prev.chainId, parentMerkleRoot: prev.merkleRoot, epoch: i + 1, addedBytes: bytes - before });
    }
    before = bytes;
  }
  return records;
}
/** The lineage rows of a tree's epochs → [{ epoch, chainId, merkleRoot }], exactly as lineageRow gives them for a chain grown
 *  from each epoch text, but computed once from the last text (see treeEpochRecords). epochTexts: treeEpochTexts(entries).
 *  Throws unless every text is a well-formed, non-empty beginning of the last and longer than the one before. */
export const treeLineage = (epochTexts) => treeEpochRecords(epochTexts).map(lineageRow);

// ─── profiles: what the text of a chain is ───────────────────────────────────
// A profile says how a chain's text is read: parse(text) → items (the meaning check), lexicon(items) → the
// lexicon object those items give, epochs(items) → the text of every epoch, lineage(epochTexts) → one record
// per epoch, holding what lineageRow and epochCommitment read (it may be a promise). unit, units, line, items
// and redone are the words the checks use in their details. overwatchInspect takes the profile from
// lexicon.format. The certificate line, HYPERPACK/1 and HANDSHAKE/1 are the same for every profile: the text
// a lexicon root hashes begins with the format tag, and the root is in the signed line.

/** The journey's lineage: every epoch regrown from its text, as before profiles existed. */
async function regrownEpochs(epochTexts) {
  const epochs = [];
  for (let i = 0; i < epochTexts.length; i++) {
    const grown = await growBiochain(epochTexts[i]), prev = epochs[i - 1];
    epochs.push(i === 0 ? grown : { ...grown, parentChainId: prev.chainId, parentMerkleRoot: prev.merkleRoot, epoch: i + 1, addedBytes: grown.origBytes - prev.origBytes });
  }
  return epochs;
}
const JOURNEY = Object.freeze({
  format: "LEXICON/1", unit: "observation", units: "observations", line: "OBS/1", items: "observations", redone: "regrown",
  parse: parseJourney, lexicon: lexiconOf, epochs: (observations) => observations.map((_, i) => journeyText(observations.slice(0, i + 1))), lineage: regrownEpochs,
});
const TREE = Object.freeze({
  format: "LEXICON/2", unit: "top-level entry", units: "top-level entries", line: "LEX/1", items: "entries", redone: "recomputed",
  parse: parseLexiconText, lexicon: treeLexiconOf, epochs: treeEpochTexts, lineage: treeEpochRecords,
});
export const PROFILES = Object.freeze({ "LEXICON/1": JOURNEY, "LEXICON/2": TREE });
/** The profile a lexicon object names: PROFILES[format] only when format is a string and an own member of PROFILES.
 *  Anything else, a missing lexicon included, is read as a journey, as before profiles existed (and then fails its checks). */
export function profileOf(lexicon) {
  const format = lexicon !== null && typeof lexicon === "object" ? lexicon.format : undefined;
  return typeof format === "string" && Object.prototype.hasOwnProperty.call(PROFILES, format) ? PROFILES[format] : JOURNEY;
}

// ─── growing and bundling a tree lexicon ─────────────────────────────────────

/** Grow a lexicon chain by one epoch: the first grows a chain from the text, the rest extend the parent (which must pass
 *  the strict check) by the added text. No engram layer. → a plain chain record. */
export async function growLexicon(parent, addedText) {
  if (typeof addedText !== "string" || addedText === "") throw new Error("growLexicon needs the text an epoch adds");
  const chain = parent ? await extendBiochain(parent, addedText, { enforceStrict: true, engrams: false }) : await growBiochain(addedText, { engrams: false });
  return copyOf(chain);                  // a plain record (drops extendBiochain's hidden parentStrict)
}
/** Grow, epoch by epoch, the evidence bundle of a tree lexicon. entries: makeEntry results in canonical order (checked: the
 *  order rule and the limits of parseLexiconText apply). After each epoch it awaits onEpoch({ epoch, epochs, chain, addedBytes }).
 *  → { chain, lexicon, lineage, trace }; the ledger holds (system, genesis, "LEXICON/2, N entries") and one
 *  (strix, chain.grown, the epoch's commitment) per epoch, all stamped at. For a given at the bundle is deterministic.
 *  options: { at = new Date().toISOString(), onEpoch }. */
export async function buildLexiconBundle(entries, options = {}) {
  const { at = new Date().toISOString(), onEpoch } = isRecord(options) ? options : {};
  if (typeof at !== "string") throw new Error("at is a time, written as a string");
  if (onEpoch !== undefined && typeof onEpoch !== "function") throw new Error("onEpoch is a function");
  const items = parseLexiconText(lexiconText(entries)), texts = treeEpochTexts(items), trace = [], lineage = [];
  traceAppend(trace, "system", "genesis", `LEXICON/2, ${items.length} entries`, at);
  let chain = null, sofar = 0;
  for (let i = 0; i < texts.length; i++) {
    chain = await growLexicon(chain, texts[i].slice(sofar));
    sofar = texts[i].length;
    lineage.push(lineageRow(chain));
    traceAppend(trace, "strix", "chain.grown", epochCommitment(chain), at);
    if (onEpoch) await onEpoch({ epoch: i + 1, epochs: texts.length, chain, addedBytes: i === 0 ? chain.origBytes : chain.addedBytes });
  }
  return { chain, lexicon: treeLexiconOf(items), lineage, trace };
}

/** The 16-hex-digit packet of every 720-byte chunk of a text's UTF-8 bytes, in order: the packets a chain grown from the
 *  text holds, without growing it. */
export function lexiconPackets(text) {
  if (typeof text !== "string") throw new Error("lexiconPackets needs a text");
  const bytes = new TextEncoder().encode(text), packets = [];
  for (let at = 0; at < bytes.length; at += CHUNK_BYTES) packets.push(crystallize(bytes.subarray(at, at + CHUNK_BYTES)));
  return packets;
}
/** The packets of a grown chain, in order (throws if its stream is not a strict shdccp/2 stream). */
export function chainPackets(chain) {
  if (!isRecord(chain)) throw new Error("chainPackets needs a chain record");
  return parseBiochainStreamStrict(chain.stream).map((f) => f.packet);
}
/** The index of the packet that holds the first byte of an entry's line: floor(byte offset of the line in lexiconText(entries) / 720).
 *  -1 when no entry has that address. */
export function entryPacketIndex(entries, address) {
  if (!entriesWith(entries, "line") || !entriesWith(entries, "address") || typeof address !== "string") throw new Error("entryPacketIndex needs an array of entries made by makeEntry and an address");
  const utf8 = new TextEncoder();
  let offset = 0;
  for (const e of entries) {
    if (e.address === address) return Math.floor(offset / CHUNK_BYTES);
    offset += utf8.encode(e.line).length + 1;
  }
  return -1;
}
/** The entries (or, for a journey, the observations) parsed from the text a package's chain recreates, with the package's
 *  profile. Call it only after the package was accepted: on other input it may throw. */
export function entriesOfPack(pack) {
  if (!isRecord(pack) || !isRecord(pack.chain)) throw new Error("entriesOfPack needs an accepted package");
  return profileOf(pack.lexicon).parse(recreateText(pack.chain));
}

// ─── the front door for outside text ─────────────────────────────────────────
// The wire is JSON.stringify(makeHyperpack(...)) with no indentation: download and send use this exact
// string, and HANDSHAKE/1 hashes it. Member order is part of the format. readHyperpack is the one way a
// text that did not originate in the page becomes a package. Before any check runs it refuses, as "parse"
// and with a fixed sentence: anything but a string; a text of more than MAX_PACK_CHARS characters (before
// parsing it); a text that is not JSON; a text that is not exactly the JSON its own value is written as
// (so no indentation, no padding and no member named twice); a value nested deeper than 12 levels or
// holding a string that is not well-formed Unicode; anything but an object with exactly the members
// format, route, chain, lexicon, lineage, trace and certificate, in that order and of their types; a
// member this format does not know in the chain, the certificate or a ledger entry; a certificate that
// does not hold all seven of its members, six of them strings and the public key an object; more than
// 3,000 lexicon entries, 64 lineage rows or 4,096 ledger entries. Then it runs verifyHyperpack.
// Why the certificate's members are required here: verifyCertificate reads a certificate without traceHead
// as one that names no ledger entry. The signed line then holds an empty place for the head, the signature
// covers no point of the ledger, and anyone could write another ledger under the same seal.
// What a passing verdict covers is what the checks rebuilt and the signed line: the chain, the lexicon,
// the lineage and the ledger up to the certified head. The route, issuedAt, ledger entries after the head
// and whatever the key's record says beside the key itself (x and y) are not covered by the signature.

export const MAX_PACK_CHARS = 1500000;
const MAX_PACK_DEPTH = 12, MAX_LINEAGE_ROWS = 64, MAX_LEDGER_ENTRIES = 4096;
const PACK_MEMBERS = Object.freeze(["format", "route", "chain", "lexicon", "lineage", "trace", "certificate"]);
// what growBiochain returns, with or without the engram layer, and what extendBiochain adds
const CHAIN_MEMBERS = Object.freeze(["chainId", "stream", "streamVersion", "leafHashes", "merkleRoot", "weaveChiral", "weaveMirror", "segCuts", "segments",
  "engramStream", "engramCount", "engramMeanJ", "origBytes", "shippedBytes", "value", "parentChainId", "parentMerkleRoot", "epoch", "addedBytes"]);
const CERTIFICATE_MEMBERS = Object.freeze(["format", "commitment", "traceHead", "issuedAt", "sealId", "publicJwk", "sig"]);
const CERTIFICATE_STRINGS = Object.freeze(CERTIFICATE_MEMBERS.filter((k) => k !== "publicJwk"));
const LEDGER_MEMBERS = Object.freeze(["n", "actor", "event", "detail", "at", "prev", "hash"]);
const onlyMembers = (o, allowed) => Object.keys(o).every((k) => allowed.includes(k));

/** Why a parsed JSON object goes deeper than 12 levels or holds a string that is not well-formed Unicode, or null.
 *  The object itself is level 1. Walks without recursion, so no depth of nesting can exhaust the stack. */
function deepFault(value) {
  const ILL = "a string in the package is not well-formed Unicode";
  const pending = [value], levels = [1];
  while (pending.length) {
    const v = pending.pop(), level = levels.pop();
    if (level > MAX_PACK_DEPTH) return `the package is nested deeper than ${MAX_PACK_DEPTH} levels`;
    const keys = Array.isArray(v) ? null : Object.keys(v), n = keys ? keys.length : v.length;
    for (let i = 0; i < n; i++) {
      if (keys && !keys[i].isWellFormed()) return ILL;
      const x = keys ? v[keys[i]] : v[i];
      if (typeof x === "string") { if (!x.isWellFormed()) return ILL; }
      else if (x !== null && typeof x === "object") { pending.push(x); levels.push(level + 1); }
    }
  }
  return null;
}
/** Why a parsed JSON value is not a package this door lets in, or null. */
function packFault(v) {
  if (!isRecord(v)) return "not a package: the text is not a JSON object";
  const deep = deepFault(v);
  if (deep) return deep;
  const keys = Object.keys(v);
  if (keys.length !== PACK_MEMBERS.length || !PACK_MEMBERS.every((k, i) => keys[i] === k)) return "not a package: its members are not format, route, chain, lexicon, lineage, trace and certificate, in that order";
  if (v.format !== "HYPERPACK/1") return "not a HYPERPACK/1";
  if (![v.route, v.chain, v.lexicon, v.certificate].every(isRecord) || !Array.isArray(v.lineage) || !Array.isArray(v.trace)) return "not a package: route, chain, lexicon and certificate are objects, lineage and trace are lists";
  if (!onlyMembers(v.chain, CHAIN_MEMBERS)) return "the chain has a member this format does not know";
  if (!onlyMembers(v.certificate, CERTIFICATE_MEMBERS)) return "the certificate has a member this format does not know";
  const whole = CERTIFICATE_STRINGS.every((k) => Object.hasOwn(v.certificate, k) && typeof v.certificate[k] === "string") && Object.hasOwn(v.certificate, "publicJwk") && isRecord(v.certificate.publicJwk);
  if (!whole) return "the certificate does not hold its seven members: six strings and the public key, an object";
  if (v.trace.length > MAX_LEDGER_ENTRIES) return `the ledger holds more than ${MAX_LEDGER_ENTRIES} entries`;
  if (!v.trace.every((e) => isRecord(e) && onlyMembers(e, LEDGER_MEMBERS))) return "a ledger entry is not an object, or has a member this format does not know";
  if (v.lineage.length > MAX_LINEAGE_ROWS) return `the lineage lists more than ${MAX_LINEAGE_ROWS} epochs`;
  if (Array.isArray(v.lexicon.entries) && v.lexicon.entries.length > MAX_ENTRIES) return `the lexicon lists more than ${MAX_ENTRIES} entries`;
  return null;
}

/** Read a text that came from outside as a HYPERPACK/1 and verify it. Never rejects.
 *  → { ok, failed, checks, pack }: the verdict of verifyHyperpack over PACKAGE_CHECKS, and pack, the parsed package, when
 *  every check passed (null otherwise: a package that fails is not to be shown beyond its failure). A text the door
 *  refuses, and anything that makes a check throw, fails at "parse" with a fixed sentence as its detail. */
export async function readHyperpack(text) {
  const refuse = (why) => ({ ok: false, failed: "parse", checks: PACKAGE_CHECKS.map((name, i) => ({ name, ok: i ? null : false, detail: i ? "not run" : why })), pack: null });
  if (typeof text !== "string") return refuse("not a text");
  if (text.length > MAX_PACK_CHARS) return refuse(`longer than ${MAX_PACK_CHARS} characters`);
  let pack, fault;
  try { pack = JSON.parse(text); } catch { return refuse("not JSON"); }
  try { fault = packFault(pack) || (JSON.stringify(pack) !== text ? "not in wire form: the text is not exactly the JSON of its own value" : null); }
  catch { fault = "not a package: its form could not be read"; }
  if (fault) return refuse(fault);
  try {
    const verdict = await verifyHyperpack(pack);
    return { ok: verdict.ok, failed: verdict.failed, checks: verdict.checks, pack: verdict.ok ? pack : null };
  } catch { return refuse("the checks could not be run on this package"); }
}

// ─── words: the wheel, the square, the mirror ────────────────────────────────
// One SHD-CCP word is 64 bits, written as 16 hex digits. Read left to right, each digit's bits high to low,
// the bits are numbered i = 0..63 (i = 0 is bit 63). Two pictures of the same 64 cells:
//   the wheel   16 sectors of 4 rings. sector = i >> 2 is one hex digit, one sixteenth of the word;
//               ring = i & 3 (0 the outer ring, the digit's 8; 3 the inner ring, its 1);
//               quadrant = i >> 4 (four sectors, sixteen bits).
//   the square  8 rows of 8, row-major: row = i >> 3, col = i & 7 (the grid the Loom Weave seed uses).
// What these support, each one tested: the first sector is the form field; the parity bit (bit 59) is the
// XOR of the other 63, so sixty-three bits fix the sixty-fourth, any one flipped cell breaks parity and any
// two leave it whole (parity catches an odd number of flips only); in a word whose parity holds, the
// parities of three quadrants fix the parity of the fourth; four cells, one sixteenth of the word, fill all
// 64 by the mirror rule, and in such a word any three corner squares give the fourth bit for bit.
// These are properties of the words. They say nothing about what a word means.

const HEX16 = /^[0-9A-Fa-f]{16}$/;
/** 16 hex digits → 64 bits (0 or 1), i = 0 first. */
function wordBits(hex) {
  if (typeof hex !== "string" || !HEX16.test(hex)) throw new Error("a packet is 16 hex digits");
  const bits = [];
  for (const digit of hex) { const v = parseInt(digit, 16); bits.push((v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1); }
  return bits;
}
/** 64 bits → 16 hex digits, upper case (the case packets are written in). */
function bitsWord(bits) {
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += ((bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3]).toString(16).toUpperCase();
  return hex;
}

/** 16 hex digits → the 64 cells of the word: { i, bit, sector, ring, quadrant, row, col, on, field }, i = 0..63 in reading
 *  order, bit = 63 - i, on a boolean, field the PACKET_FIELDS key that holds the bit. */
export function glyphCells(hex) {
  return wordBits(hex).map((value, i) => {
    const bit = 63 - i;
    return { i, bit, sector: i >> 2, ring: i & 3, quadrant: i >> 4, row: i >> 3, col: i & 7, on: value === 1, field: PACKET_FIELDS.find((f) => bit <= f.hi && bit >= f.lo).key };
  });
}
/** The 64 cells of a word, in the order i = 0..63 → its 16 hex digits (upper case). Only on is read; a cell that carries an i must sit at that place. */
export function glyphHex(cells) {
  const fine = Array.isArray(cells) && cells.length === 64 && cells.every((c, k) => c !== null && typeof c === "object" && typeof c.on === "boolean" && (c.i === undefined || c.i === k));
  if (!fine) throw new Error("glyphHex needs the 64 cells of a word in order, each on or off");
  return bitsWord(cells.map((c) => (c.on ? 1 : 0)));
}

/** The author's mirror rule (the "1/16 M.C. ESCHER SYMMETRY" button of Loom Weave) on the 8 x 8 row-major grid: four seed
 *  bits [m00, m10, m01, m11], the cells (x, y) = (0,0), (1,0), (0,1), (1,1), are mirrored to fill all 64. → 16 hex digits. */
export function seedMirror(fourBits) {
  const fine = Array.isArray(fourBits) && fourBits.length === 4 && fourBits.every((b) => b === 0 || b === 1 || b === false || b === true);
  if (!fine) throw new Error("a seed is four bits: the cells (0,0), (1,0), (0,1) and (1,1)");
  const seed = fourBits.map(Number), bits = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    let rx = x > 3 ? 7 - x : x; if (rx > 1) rx = 3 - rx;
    let ry = y > 3 ? 7 - y : y; if (ry > 1) ry = 3 - ry;
    bits.push(seed[ry * 2 + rx]);
  }
  return bitsWord(bits);
}
/** 16 hex digits → the four 4 x 4 corner squares of the 8 x 8 grid, [topLeft, topRight, bottomLeft, bottomRight], each 16 bits (0 or 1) row-major. */
export function squareQuarters(hex) {
  const bits = wordBits(hex);
  const corner = (qx, qy) => { const out = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) out.push(bits[(qy * 4 + y) * 8 + qx * 4 + x]); return out; };
  return [corner(0, 0), corner(1, 0), corner(0, 1), corner(1, 1)];
}
const mirrorLeftRight = (q) => q.map((_, k) => q[(k & 12) + 3 - (k & 3)]);     // every row reversed
const mirrorTopBottom = (q) => q.map((_, k) => q[12 - (k & 12) + (k & 3)]);    // the rows in reverse order
/** The bottom-right corner square a mirror word must have, predicted from each of the other three by mirroring.
 *  → { fromTopLeft, fromTopRight, fromBottomLeft, agree }: three squares of 16 bits, and whether the three are equal. */
export function fourthFromThree(topLeft, topRight, bottomLeft) {
  const fine = [topLeft, topRight, bottomLeft].every((q) => Array.isArray(q) && q.length === 16 && q.every((b) => b === 0 || b === 1));
  if (!fine) throw new Error("fourthFromThree needs three corner squares of 16 bits each");
  const fromTopLeft = mirrorTopBottom(mirrorLeftRight(topLeft)), fromTopRight = mirrorTopBottom(topRight), fromBottomLeft = mirrorLeftRight(bottomLeft);
  return { fromTopLeft, fromTopRight, fromBottomLeft, agree: fromTopLeft.every((b, k) => b === fromTopRight[k] && b === fromBottomLeft[k]) };
}
/** 16 hex digits → [p0, p1, p2, p3], the parity (0 or 1) of each 16-bit quadrant (quadrant = i >> 4). In a word whose
 *  parity holds, p0 ^ p1 ^ p2 ^ p3 is 0: three of them fix the fourth. */
export function quarterParities(hex) {
  const bits = wordBits(hex);
  return [0, 1, 2, 3].map((q) => { let p = 0; for (let i = q * 16; i < q * 16 + 16; i++) p ^= bits[i]; return p; });
}

// ─── witnesses: counting HANDSHAKE/1 answers ─────────────────────────────────
// One seal is one witness. An answer counts toward a quorum only if it is whole and for the wire that was
// sent and accepts it (verifyAnswer); if its key and signature are spelled in the one canonical way (so one
// key cannot appear under two seal ids); if its seal id is one the caller already holds (known); if it is
// not the sealer's (exclude: pass the certificate's sealId); and if that seal id has not been counted yet.
// A key that seals never answers: pages make separate keys for receivers. What a quorum shows depends on
// who holds the keys: receivers simulated in one page are not independent testimony.

const JWK_COORDINATE = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;      // 32 bytes as base64url: 43 characters, the last with two zero bits
const SIG_HEX = /^[0-9a-f]{128}$/;
const idSet = (v) => ((Array.isArray(v) || v instanceof Set) && [...v].every((id) => typeof id === "string") ? new Set(v) : null);

/** Count the answers that witness a sent wire. options: { need = 2, known, exclude = [] }. need: a whole number of at least 1; known (required): the seal ids the caller
 *  already holds, an array or a Set; exclude: seal ids that may not count. Throws on bad arguments, never on a bad answer.
 *  → { met, need, accepted: [sealId], rejected: [{ index, failed }] }; failed is one of signature, echo, refused (from
 *  verifyAnswer), form, sealer, unknown, repeat. */
export async function witnessQuorum(answers, sentWire, options = {}) {
  const { need = 2, known, exclude = [] } = isRecord(options) ? options : {};
  if (!Number.isInteger(need) || need < 1) throw new Error("need is a whole number of at least 1");
  const knownIds = idSet(known), excluded = idSet(exclude);
  if (!knownIds) throw new Error("known is the list of seal ids the caller already holds");
  if (!excluded) throw new Error("exclude is a list of seal ids");
  if (!Array.isArray(answers)) throw new Error("answers is a list of HANDSHAKE/1 answers");
  if (typeof sentWire !== "string") throw new Error("the wire that was sent is a string");
  const accepted = [], rejected = [];
  for (let index = 0; index < answers.length; index++) {
    const a = answers[index];
    let failed;
    try { failed = (await verifyAnswer(a, sentWire)).failed; } catch { failed = "form"; }
    if (failed === null) {
      const jwk = a.publicJwk;
      const spelled = jwk.kty === "EC" && jwk.crv === "P-256" && JWK_COORDINATE.test(jwk.x) && JWK_COORDINATE.test(jwk.y) && SIG_HEX.test(a.sig);
      failed = !spelled ? "form" : excluded.has(a.sealId) ? "sealer" : !knownIds.has(a.sealId) ? "unknown" : accepted.includes(a.sealId) ? "repeat" : null;
    }
    if (failed === null) accepted.push(a.sealId); else rejected.push({ index, failed });
  }
  return { met: accepted.length >= need, need, accepted, rejected };
}

// ─── tampers in one table ────────────────────────────────────────────────────
// What a page lets a visitor try on a sealed tree package, and what happens. apply(pack, tools) is given a
// parsed package and returns (or resolves to) a changed deep copy; the package given is left as it was.
// expected is the check that refuses the changed package, or "accepted". The last row is the documented
// limit: the same relabelling done in the text, everything rebuilt and sealed with a new key, is a
// different package under a different key, and it passes. A seal protects what was sealed. It cannot tell
// that a label is deserved or whose key it is. For that row the caller supplies tools.newKeys (a key pair,
// or a function that gives one) and tools.at (the time to stamp).

/** A deep copy of a parsed tree package whose lexicon lists at least `least` entries (throws otherwise). */
function tamperCopy(pack, least = 1) {
  const p = isRecord(pack) ? copyOf(pack) : null;
  const fine = p && isRecord(p.chain) && isRecord(p.lexicon) && isRecord(p.certificate) && Array.isArray(p.trace) && entriesWith(p.lexicon.entries, "address");
  if (!fine) throw new Error("a tamper is applied to a parsed HYPERPACK/1 package");
  if (p.lexicon.entries.length < least) throw new Error(least === 1 ? "this tamper needs a lexicon with an entry" : `this tamper needs a lexicon with ${least} entries`);
  return p;
}
/** Change the lexicon object's entries and write the root those entries give: the best a forger can do without the text. */
function withEntries(pack, least, change) {
  const p = tamperCopy(pack, least);
  change(p.lexicon.entries);
  p.lexicon.root = treeLexiconRoot(p.lexicon.entries);
  return p;
}
const firstReading = (entries) => {
  const at = entries.findIndex((e) => e.layer === "reading");
  if (at < 0) throw new Error("this lexicon has no reading entry to relabel");
  return at;
};
/** Change one byte of the text a chain holds: the first ASCII letter of a name or a text becomes the next letter (z
 *  becomes a), and only that chunk's residual is written again. The packet, the leaves and everything else stay. */
function changeOneLetter(chain) {
  const frames = parseBiochainStreamStrict(chain.stream), chunks = frames.map((f) => decodeChunk(f.residual, f.chunkLen));
  const isLetter = (b) => (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a);
  let c = 0, o = 0, bars = 0, before1 = 0, before2 = 0, found = false;       // without such a letter: the first byte
  for (let i = 0; i < chunks.length && !found; i++) for (let k = 0; k < chunks[i].length && !found; k++) {
    const b = chunks[i][k];
    if (b === 0x0a) bars = 0;
    else if (b === 0x7c) bars += 1;
    else if (bars >= 4 && isLetter(b) && before1 !== 0x25 && before2 !== 0x25) { c = i; o = k; found = true; }   // after the fourth |, and not the hex digit of an escape
    before2 = before1; before1 = b;
  }
  const b = chunks[c][o];
  chunks[c][o] = b === 0x5a ? 0x41 : b === 0x7a ? 0x61 : isLetter(b) ? b + 1 : b ^ 1;
  chain.stream = frameStream(frames.map((f) => f.packet), frames.map((f, i) => (i === c ? encodeChunk(chunks[i]) : f.residual)));
}
/** A lexicon-object entry no line of the text gives: a new top-level entry after the last one (or, when that index is taken, a child of the last entry). */
function addedEntry(entries) {
  const last = entries[entries.length - 1].address, tops = entries.filter((e) => !e.address.includes(".")).map((e) => Number(e.address));
  const top = Math.max(-1, ...tops.filter(Number.isInteger)) + 1;
  let made;
  try { made = makeEntry(top <= 9999 ? String(top) : last + ".0", "text", "note", "An added entry", "This entry was added after sealing."); }
  catch { made = makeEntry("0", "text", "note", "An added entry", "This entry was added after sealing."); }
  return { address: made.address, layer: made.layer, kind: made.kind, name: made.name, lineSha: sha256HexSync(made.line) };
}

export const LEXICON_TAMPERS = Object.freeze([
  { key: "word", label: "Change a word", expected: "crystal",
    apply: (pack) => { const p = tamperCopy(pack, 0); changeOneLetter(p.chain); return p; } },
  { key: "drop", label: "Drop an entry", expected: "lexicon",
    apply: (pack) => withEntries(pack, 1, (entries) => { entries.pop(); }) },
  { key: "add", label: "Add an entry", expected: "lexicon",
    apply: (pack) => withEntries(pack, 1, (entries) => { entries.push(addedEntry(entries)); }) },
  { key: "move", label: "Swap two addresses", expected: "lexicon",
    apply: (pack) => withEntries(pack, 2, (entries) => { [entries[0].address, entries[1].address] = [entries[1].address, entries[0].address]; }) },
  { key: "relabel", label: "Relabel a READING as TEXT", expected: "lexicon",
    apply: (pack) => withEntries(pack, 1, (entries) => { entries[firstReading(entries)].layer = "text"; }) },
  { key: "ledger", label: "Remove a ledger entry", expected: "trace",
    apply: (pack) => {
      const p = tamperCopy(pack, 0), grown = p.trace.findIndex((e) => isRecord(e) && e.event === "chain.grown");
      if (p.trace.length === 0) throw new Error("this tamper needs a ledger with an entry");
      p.trace.splice(Math.max(0, grown), 1);                // the first chain.grown entry: at or before the certified head
      return p;
    } },
  { key: "signature", label: "Alter the signature", expected: "signature",
    apply: (pack) => {
      const p = tamperCopy(pack, 0), sig = p.certificate.sig;
      if (typeof sig !== "string" || sig === "") throw new Error("this tamper needs a signed certificate");
      p.certificate.sig = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
      return p;
    } },
  { key: "reseal", label: "Relabel a READING as TEXT and seal it again with a new key", expected: "accepted",
    apply: async (pack, tools) => {
      const p = tamperCopy(pack, 1), t = isRecord(tools) ? tools : {};
      const keys = typeof t.newKeys === "function" ? await t.newKeys() : t.newKeys;
      if (!isRecord(keys) || !isRecord(keys.publicJwk) || !isRecord(keys.privateJwk) || typeof t.at !== "string") throw new Error("the reseal tamper needs tools.newKeys (a key pair) and tools.at (a time)");
      if (profileOf(p.lexicon) !== TREE) throw new Error("the reseal tamper needs the package of a tree lexicon");
      const entries = entriesOfPack(p), at = firstReading(entries), e = entries[at];
      entries[at] = makeEntry(e.address, "text", e.kind, e.name, e.text);
      const bundle = await buildLexiconBundle(entries, { at: t.at });
      const { certificate } = await issueCertificate(bundle, keys, t.at);
      return makeHyperpack({ ...bundle, certificate }, p.route);
    } },
].map((row) => Object.freeze(row)));
