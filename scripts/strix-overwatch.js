// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
/**
 * STRIX Overwatch core (draft 0) — the Firebase-free, DOM-free half of the
 * First Explorers introduction (Library/Experimental_Systems/First_Explorers/).
 * ----------------------------------------------------------------------------
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
 *   TRACE/1     a hash-chained ledger of everything that happened.
 *   OVERWATCH/1 a certificate: one signed line binding a chain that passes the
 *               strict check to its meaning (OBS/1), its lexicon, its lineage
 *               (every epoch regrown from the text) and a point of the trace.
 *   HYPERPACK/1 the bundle a receiver needs to repeat every check.
 *
 * The signing key is whatever key pair the caller passes. The page makes one
 * per visit: its signature shows a certificate has not changed since it was
 * issued, not who issued it. Binding to a Genesis seal is later work.
 */

import { generateSealKeypair, signPayload, verifyPayload, sealIdFromPublic } from "./seal-crypto.js";
import {
  growBiochain, extendBiochain, verifyIntegrityStrict, recreateText, crystalQuat,
  grownCommitment, growthCommitment, sha256HexSync, STRICT_CHECKS,
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

const SENSE_STEP = 1.25, ENTRY_STEP = 1.0, ENTRY_RING = 0.3, RECEIVER_STEP = 2.4;
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
/** The receiver's frame: a second observer, away from every sense branch. */
export const receiverFrame = () => lmul(rotZ(-90 * D2R), boostX(RECEIVER_STEP));
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

  let observations, text;
  try { text = recreateText(chain); observations = parseJourney(text); }
  catch (e) { checks.push({ name: "meaning", ok: false, detail: String(e.message || e) }); return done("meaning"); }
  checks.push({ name: "meaning", ok: true, detail: `${observations.length} canonical OBS/1 line${observations.length === 1 ? "" : "s"}` });

  const want = lexiconOf(observations);
  if (!lexicon || !same(lexicon, want)) {
    const detail = !lexicon ? "no lexicon" : lexicon.root !== want.root ? "the lexicon root is not the one the observations give" : "the lexicon is not the one the observations give";
    checks.push({ name: "lexicon", ok: false, detail }); return done("lexicon");
  }
  checks.push({ name: "lexicon", ok: true, detail: `${want.entries.length} exact address${want.entries.length === 1 ? "" : "es"}, 2D and 3D` });

  const epochs = [];
  let bad = null;
  if (!Array.isArray(lineage) || lineage.length !== observations.length) bad = "lineage does not list one epoch per observation";
  else if ((chain.epoch || 1) !== observations.length) bad = "the chain's epoch is not its number of observations";
  for (let i = 0; !bad && i < observations.length; i++) {
    const grown = await growBiochain(journeyText(observations.slice(0, i + 1)));
    const prev = epochs[i - 1];
    const rec = i === 0 ? grown : { ...grown, parentChainId: prev.chainId, parentMerkleRoot: prev.merkleRoot, epoch: i + 1, addedBytes: grown.origBytes - prev.origBytes };
    epochs.push(rec);
    if (!same(lineage[i], lineageRow(rec))) bad = `epoch ${i + 1} regrown from the text is not the one lineage lists`;
  }
  if (!bad) {
    const last = epochs[epochs.length - 1];
    if (last.chainId !== chain.chainId || last.merkleRoot !== chain.merkleRoot) bad = "the last epoch is not this chain";
    else for (const k of ["parentChainId", "parentMerkleRoot", "epoch", "addedBytes"]) if (!same(chain[k], last[k])) { bad = `the chain's ${k} is not the regrown one`; break; }
  }
  if (bad) { checks.push({ name: "lineage", ok: false, detail: bad }); return done("lineage"); }
  checks.push({ name: "lineage", ok: true, detail: `${epochs.length} epoch${epochs.length === 1 ? "" : "s"} regrown from the text` });

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
  checks.push({ name: "signature", ok: true, detail: `ECDSA P-256 by ${cert.sealId} (a key made for this visit)` });
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
