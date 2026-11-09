// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
/**
 * Biomesh core — the Firebase-free half of scripts/biomesh.js.
 * ----------------------------------------------------------------------------
 * The pure biochain functions: the Biostrata grow cell (SHD-CCP packets, the
 * order-2 rank coder, 720-byte chunks, the leaf commitments and Merkle root,
 * the chiral and mirror weaves), recreation and the integrity check, the token
 * engram layer and language seeds, growth epochs, the CODEX/1 packet program,
 * and the GROWN/1, GROWTH/1, CODEX/1 and PAIR/1 commitment strings.
 *
 * It imports only sha256Hex from seal-crypto.js (Web Crypto: the browser's
 * `crypto`, Node 20+'s `globalThis.crypto`), so it also runs in Node, where
 * tests/unit/biomesh-core.test.mjs checks it. Pages keep importing
 * scripts/biomesh.js, which re-exports everything here and adds the Firestore
 * services (publish, certify, transfer, rate).
 *
 * The functions were moved here from biomesh.js without change; the unit test
 * checks each one's text against biomesh.js at 7f45f35. crystallizeGolden and
 * engramHex are additions (the golden packet and a token's engram key).
 *
 * The strict verifier (RFC 07 section 12, in BioChainAI/SHD-CCP-core) is
 * verifyIntegrityStrict: synchronous, with the hash passed in (sha256HexSync,
 * a FIPS 180-4 SHA-256 in plain JS, by default). verifyIntegrity is unchanged:
 * it checks self-consistency only (see its comment). Changed on purpose since
 * 7f45f35, each checked by behaviour in the unit tests: engramGrid builds each
 * letter's grid once (same output), parseBiochainStream throws on a negative
 * residual length, and extendBiochain also computes the parent's strict verdict.
 * Exported primitives (crystallize, encodeChunk, frameStream, the quaternion
 * helpers, mulberry32) let the tests run the RFC 07 vectors; text unchanged.
 */

import { sha256Hex } from "./seal-crypto.js";

// The moved functions call the hash as SC.sha256Hex, as they did in biomesh.js.
const SC = { sha256Hex };

export const MAX_GROW_BYTES = 60000;   // Firestore doc budget (stream stored inline)
export const STREAM_VERSION = "shdccp/2";
const CHUNK = 720, SEGMENTS = 7;

// ─── the Biostrata grow cell (pure; mirrors BioChain_Enterprise/codex_engine) ─

const M64 = (1n << 64n) - 1n;
function fold64(bytes) {
  let a = 0x9E3779B97F4A7C15n;
  for (const b of bytes) a = (((a << 7n) | (a >> 57n)) & M64) ^ ((BigInt(b) * 0x100000001B3n) & M64);
  return a;
}
export const qmul = (a, b) => [
  a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3], a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
  a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1], a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
export const qconj = a => [a[0], -a[1], -a[2], -a[3]];
export const qn = a => { const n = Math.hypot(...a) || 1; return a.map(x => x / n); };
export function crystalQuat(bytes) {
  const c32 = Number((fold64(bytes) ^ (fold64(bytes) >> 32n)) & 0xFFFFFFFFn);
  const s = i => { const v = (c32 >>> i) & 255; return v >= 128 ? v - 256 : v; };
  return qn([0.5 + s(24) / 254, s(16) / 127, s(8) / 127, s(0) / 127]);
}
export const quatHex = q => q.map(v => v.toFixed(12)).join(",");

// ─── SHD-CCP 64-bit packet: the shdccp/2 crystal packet (RFC 07 section 5) ───
// Field map (MSB..LSB of the 64-bit word):
//   63..60 form · 59 parity · 58..56 spin · 55..24 quat32 · 23..8 payload16 · 7..3 freq · 2..0 amp
// The four crystal bytes are written RAW (RFC 07 section 5.4, decision D6): a
// crystal byte 0x80 stays 0x80 in the packet, and crystalQuat reads it as -128.
// The Python kernel shdccp_kernel.py (BioChainAI/BioChain-AI protocol/, and the
// copy in BioChain-AI/BioChain_Enterprise/ here) rewrites the int8 code -128 as
// -127 (byte 0x81) for its ABI and codex words; shdccp/2 packets never do, so
// this packet equals the kernel's only for chunks without a 0x80 crystal byte
// (about 1.5 % of real chunks have one). The golden 9841D88D8B003CEA has none.
// A biochain body is stored as ONE framed stream of these packets instead of
// parallel per-chunk arrays: each chunk contributes its crystal packet (which
// carries the chunk length in its payload field) followed by a length-prefixed
// residual. Self-describing → no array-index alignment to keep in sync, and no
// nested arrays for Firestore to choke on.
const PAR_MASK = M64 ^ (1n << 59n);        // all 64 bits except the parity bit
function popcountEven(word) {               // parity over the other 63 bits
  let b = word & PAR_MASK, c = 0n;
  while (b) { c ^= (b & 1n); b >>= 1n; }
  return c;                                 // 0n | 1n
}
/** chunk bytes → 16-hex SHD-CCP crystal packet (form 9, payload = chunk length). */
export function crystallize(bytes) {
  const acc = fold64(bytes);
  const crystal32 = (acc ^ (acc >> 32n)) & 0xFFFFFFFFn;
  let csum = 0; for (const b of bytes) csum += b; csum &= 0xFF;
  let word = (9n << 60n) | (crystal32 << 24n)
           | (BigInt(bytes.length & 0xFFFF) << 8n)
           | (BigInt(csum >> 3) << 3n) | BigInt(csum & 7);
  word |= (popcountEven(word) << 59n);      // set parity last
  return word.toString(16).toUpperCase().padStart(16, "0");
}
/** decode a 64-bit SHD-CCP word → all fields (+ chunkLen alias for stream frames). */
function unpackPacket(hex) {
  const word = BigInt("0x" + hex);
  const parityBit = (word >> 59n) & 1n;
  const payload16 = Number((word >> 8n) & 0xFFFFn);
  return {
    form: Number((word >> 60n) & 0xFn), spin: Number((word >> 56n) & 0x7n),
    quat32: Number((word >> 24n) & 0xFFFFFFFFn), payload16, chunkLen: payload16,
    freq: Number((word >> 3n) & 0x1Fn), amp: Number(word & 0x7n),
    parityOk: popcountEven(word) === parityBit,
  };
}
/** general packer: form/spin/4 signed-byte quat codes/payload16/freq/amp → 16 hex. */
function packWord(form, spin, quatCodes, payload16, freq, amp) {
  let q = 0n;
  for (const c of quatCodes) q = (q << 8n) | BigInt(c & 0xFF);
  let word = (BigInt(form & 0xF) << 60n) | (BigInt(spin & 0x7) << 56n) | (q << 24n)
           | (BigInt(payload16 & 0xFFFF) << 8n) | (BigInt(freq & 0x1F) << 3n) | BigInt(amp & 0x7);
  word |= (popcountEven(word) << 59n);
  return word.toString(16).toUpperCase().padStart(16, "0");
}
/** Golden packet: crystallize(bytes 0..59) = 9841D88D8B003CEA (BIOMESH_SYSTEM.md). */
export const crystallizeGolden = () => crystallize(Array.from({ length: 60 }, (_, i) => i));

// ─── token engrams (Engram Mind Eye compatible, bit-identical) ────────────────
// Verbatim port of the TTMPT engram core in
// Library/Experimental_Systems/Engram_Mind_Eye.html: Mulberry32 PRNG,
// per-character panmagic 8×8 grid (seed = seed*31 + charCode), XOR
// crystallization across a token's characters, LSB-first byte packing (the
// same packing its chiralKey uses). A biochain's engram packet for a token is
// therefore bit-identical to crystallize(token) on that page — an engram
// stream can pre-seed the Mind Eye's Hamming matcher directly.
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function engramCharGrid(ch) {
  let seed = 0;
  for (let i = 0; i < ch.length; i++) seed = (seed * 31 + ch.charCodeAt(i)) & 0xffffffff;
  const rng = mulberry32(seed);
  return Array.from({ length: 64 }, () => rng() > 0.5 ? 1 : 0);
}
// Each letter's grid, built once: engramGrid used to rebuild it for every one of
// the 64 cells (F15). Only the 26 letters A-Z reach it, so the cache stays small.
const LETTER_GRIDS = new Map();
function letterGrid(ch) {
  let g = LETTER_GRIDS.get(ch);
  if (!g) { g = engramCharGrid(ch); LETTER_GRIDS.set(ch, g); }
  return g;
}
/** token → 64-bit XOR-crystallized engram grid (Mind Eye crystallize; the same
 *  output as at 7f45f35, with each letter's grid built once). */
export function engramGrid(token) {
  let acc = new Array(64).fill(0);
  for (const ch of token.toUpperCase()) {
    if (!/[A-Z]/.test(ch)) continue;
    const g = letterGrid(ch);
    acc = acc.map((b, i) => b ^ g[i]);
  }
  return acc;
}
const engramGridHex = (grid) => {
  let hex = "";
  for (let i = 0; i < 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte |= (grid[i * 8 + b] << b);   // LSB-first, as chiralKey packs
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex.toUpperCase();
};
/** token → its 16-hex engram key (engramGridHex of engramGrid: LSB-first, upper-case). */
export const engramHex = (token) => engramGridHex(engramGrid(token));
/** torsion flow J of an engram grid: (upper − lower triangle sum) / 32. */
export function engramJ(grid) {
  let upper = 0, lower = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (c > r) upper += grid[r * 8 + c]; else if (c < r) lower += grid[r * 8 + c];
  }
  return (upper - lower) / 32;
}
/** tokenize for engrams: word tokens only (the Mind Eye ignores non-letters). */
export const tokenizeEngrams = (text) => text.match(/[A-Za-z0-9']+/g) || [];
/** text → one 16-hex engram packet per token, concatenated. */
export function engramStreamFromText(text) {
  const tokens = tokenizeEngrams(text);
  let stream = "", jSum = 0;
  for (const t of tokens) {
    const g = engramGrid(t);
    stream += engramGridHex(g);
    jSum += engramJ(g);
  }
  return { stream, count: tokens.length, meanJ: tokens.length ? +(jSum / tokens.length).toFixed(4) : 0 };
}

// ─── language seeds — turning a biochain into a retrieval corpus ──────────────
// The Mind Eye is a RETRIEVAL engine, not a generator: crystallize(query) →
// Hamming-nearest concept → that concept's text. Its "legibility" is the
// pre-written response, keyed geometrically. A biochain already holds the real
// recorded text (lossless stream) AND its engram index — so it converts into a
// concept library directly: each passage becomes { key engram, text }. Match a
// query engram against these keys and you retrieve real recorded language,
// legible by construction. This is how a hyperbolic engram AI "speaks" before
// it has learned to generate: it recalls, it doesn't invent.

/** Hamming distance between two 64-bit engram grids (0..64). */
export function hammingGrids(a, b) {
  let d = 0; for (let i = 0; i < 64; i++) if (a[i] !== b[i]) d++; return d;
}
/** Engram for arbitrary text (XOR-crystallization over all its letters) — the
 *  exact key the Mind Eye's crystallize(text) produces. */
export const engramOf = (text) => engramGrid(text);

/** Split recreated biochain text into retrieval passages (sentence-ish, capped). */
export function passagesOf(text, maxLen = 320) {
  const out = [];
  for (const raw of (text || "").split(/(?<=[.!?])\s+|\n{2,}/)) {
    let p = raw.trim();
    if (!p) continue;
    while (p.length > maxLen) { out.push(p.slice(0, maxLen).trim()); p = p.slice(maxLen).trim(); }
    if (p) out.push(p);
  }
  return out;
}

/** Convert a biochain into language seeds: [{ key(16 hex), grid, text, j }].
 *  These are the concept library a familiar retrieves from. */
export function biochainToSeeds(chain, opts = {}) {
  const passages = passagesOf(recreateText(chain), opts.maxLen || 320);
  return passages.map((text, i) => {
    const grid = engramGrid(text);
    return { id: (chain.chainId || "seed") + "#" + i, key: engramGridHex(grid), grid,
             text, j: +engramJ(grid).toFixed(4) };
  });
}

/** Match a query against a seed library → ranked nearest passages.
 *  distance 0..64; similarity = 1 - d/64. */
export function matchSeeds(queryText, seeds, topK = 3) {
  const q = engramGrid(queryText);
  return seeds
    .map(s => ({ ...s, dist: hammingGrids(q, s.grid), sim: +(1 - hammingGrids(q, s.grid) / 64).toFixed(3) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, topK);
}

/** Frame parallel packet/residual lists into one self-describing hex stream. */
export function frameStream(packetsHex, residualsHex) {
  let s = "";
  for (let i = 0; i < packetsHex.length; i++) {
    const r = residualsHex[i];
    s += packetsHex[i] + (r.length / 2).toString(16).padStart(8, "0") + r;
  }
  return s;
}
/** Parse a framed stream back into [{ packet, chunkLen, residual, parityOk }]; a length that is not a number or is negative throws. */
export function parseBiochainStream(streamHex) {
  const frames = []; let p = 0;
  while (p < streamHex.length) {
    const packet = streamHex.slice(p, p + 16); p += 16;
    const rbytes = parseInt(streamHex.slice(p, p + 8), 16); p += 8;
    if (!Number.isFinite(rbytes) || rbytes < 0) throw new Error("malformed stream frame");
    const residual = streamHex.slice(p, p + rbytes * 2); p += rbytes * 2;
    frames.push({ packet, residual, ...unpackPacket(packet) });
  }
  return frames;
}
/** Parse a framed stream strictly (RFC 07 section 4.3, F85): at each frame start
 *  16 hex digits (the packet) and 8 hex digits (the residual length L), then
 *  exactly 2·L hex digits; the stream ends exactly after the last frame and holds
 *  at least one. Throws on anything else. Hex digits of either case are read here
 *  (RFC 07 section 17, option (a)); verifyIntegrityStrict enforces the case of
 *  section 4.3 later: a residual or length not in lower case fails at canonical,
 *  a packet not in upper case at crystal. Parity, the 720-byte cut and canonical
 *  residuals are checked by verifyIntegrityStrict.
 *  → [{ packet, residual, residualBytes, form, spin, quat32, payload16, chunkLen,
 *       freq, amp, parityOk }] */
export function parseBiochainStreamStrict(streamHex) {
  if (typeof streamHex !== "string") throw new Error("the stream is not a string");
  const frames = []; let p = 0;
  while (p < streamHex.length) {
    const i = frames.length;
    if (p + 24 > streamHex.length) throw new Error(`frame ${i}: truncated frame header`);
    const packet = streamHex.slice(p, p + 16), lenHex = streamHex.slice(p + 16, p + 24);
    if (!/^[0-9A-Fa-f]{16}$/.test(packet)) throw new Error(`frame ${i}: the packet is not 16 hex digits`);
    if (!/^[0-9A-Fa-f]{8}$/.test(lenHex)) throw new Error(`frame ${i}: the residual length is not 8 hex digits`);
    const residualBytes = parseInt(lenHex, 16), end = p + 24 + 2 * residualBytes;
    if (end > streamHex.length) throw new Error(`frame ${i}: the residual is shorter than its length`);
    const residual = streamHex.slice(p + 24, end);
    if (!/^[0-9A-Fa-f]*$/.test(residual)) throw new Error(`frame ${i}: the residual is not hex`);
    frames.push({ packet, residual, residualBytes, ...unpackPacket(packet) });
    p = end;
  }
  if (!frames.length) throw new Error("the stream holds no frame");
  return frames;
}

class BW { constructor(){ this.bits = []; }
  w(v, n){ for (let i = n - 1; i >= 0; i--) this.bits.push((v >> i) & 1); }
  g(n){ const w = 32 - Math.clz32(n); this.w(0, w - 1); this.w(n, w); }
  hex(){ const out = []; for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0; const s = this.bits.slice(i, i + 8);
      for (const bit of s) b = (b << 1) | bit;
      out.push((b << (8 - s.length)) & 0xFF); }
    return out.map(x => x.toString(16).padStart(2, "0")).join(""); } }
class BR { constructor(hex){ this.d = []; for (let i = 0; i < hex.length; i += 2) this.d.push(parseInt(hex.slice(i, i + 2), 16)); this.p = 0; }
  r(n){ let v = 0; for (let i = 0; i < n; i++) { if (this.p >= this.d.length * 8) throw new Error("residual truncated");
      v = (v << 1) | ((this.d[this.p >> 3] >> (7 - (this.p & 7))) & 1); this.p++; } return v; }
  g(){ let z = 0; while (this.r(1) === 0) z++; return z ? ((1 << z) | this.r(z)) : 1; } }
const cands = (t, c) => { const m = t.get(c); return m ? [...m.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(e => e[0]) : []; };
const upd = (t, c, b) => { let m = t.get(c); if (!m) { m = new Map(); t.set(c, m); } m.set(b, (m.get(b) || 0) + 1); };

export function encodeChunk(bytes) {
  const t = new Map(), bw = new BW(); let c = [0, 0], ctx = "0,0";
  for (const b of bytes) {
    const cs = cands(t, ctx), i = cs.indexOf(b);
    if (i >= 0) bw.g(i + 1); else { bw.g(cs.length + 1); bw.w(b, 8); }
    upd(t, ctx, b); c = [c[1], b]; ctx = c.join(",");
  }
  return bw.hex();
}
export function decodeChunk(hex, len) {
  const t = new Map(), br = new BR(hex), out = []; let c = [0, 0], ctx = "0,0";
  for (let k = 0; k < len; k++) {
    const cs = cands(t, ctx), n = br.g();
    const b = (n - 1 < cs.length) ? cs[n - 1] : br.r(8);
    out.push(b); upd(t, ctx, b); c = [c[1], b]; ctx = c.join(",");
  }
  return out;
}

/** Grow a biochain from text — pure Biostrata step, no network.
 *  opts.engrams (default true): also crystallize the text as token engrams —
 *  one Mind-Eye-compatible 64-bit packet per word token, in `engramStream`. */
export async function growBiochain(text, opts = {}) {
  const withEngrams = opts.engrams !== false;
  const data = [...new TextEncoder().encode(text)];
  if (!data.length) throw new Error("Nothing to grow.");
  if (data.length > MAX_GROW_BYTES) throw new Error(`Grow input capped at ${MAX_GROW_BYTES} bytes (got ${data.length}).`);
  const chunks = []; for (let i = 0; i < data.length; i += CHUNK) chunks.push(data.slice(i, i + CHUNK));
  const packets = [], residuals = [], leafHashes = [];
  for (let i = 0; i < chunks.length; i++) {
    residuals.push(encodeChunk(chunks[i]));
    packets.push(crystallize(chunks[i]));   // carries chunk length in its payload field
    leafHashes.push(await SC.sha256Hex(i + "|" + await SC.sha256Hex(String.fromCharCode(...chunks[i]))));
  }
  const stream = frameStream(packets, residuals);   // ONE self-describing SHD-CCP stream
  let root = leafHashes.slice();
  while (root.length > 1) {
    if (root.length & 1) root.push(root[root.length - 1]);
    const next = [];
    for (let i = 0; i < root.length; i += 2) next.push(await SC.sha256Hex(root[i] + root[i + 1]));
    root = next;
  }
  // Segment cut boundaries as a FLAT array — segment s spans segCuts[s]..segCuts[s+1].
  // (Firestore rejects nested arrays, so this must not be an array of [lo,hi] pairs.)
  const segCuts = Array.from({ length: SEGMENTS + 1 }, (_, i) => Math.round(i * chunks.length / SEGMENTS));
  let wf = [1, 0, 0, 0], wm = [1, 0, 0, 0];
  for (const c of chunks) wf = qn(qmul(crystalQuat(c), wf));
  for (const c of [...chunks].reverse()) wm = qn(qmul(qconj(crystalQuat(c)), wm));
  const merkleRoot = root[0] || await SC.sha256Hex("empty");
  const chainId = "BC-" + (await SC.sha256Hex(merkleRoot + "|" + quatHex(wf))).slice(0, 24);
  // token engram layer (semantic face of the chain; the stream stays the lossless archive)
  const eng = withEngrams ? engramStreamFromText(text) : null;
  // shipped = the stream + engram layer + the leaf-commitment vector + root/weave overhead
  const ship = stream.length / 2 + (eng ? eng.stream.length / 2 : 0) + leafHashes.length * 32 + 40;
  return {
    chainId, stream, streamVersion: STREAM_VERSION, leafHashes, merkleRoot,
    weaveChiral: quatHex(wf), weaveMirror: quatHex(wm), segCuts, segments: SEGMENTS,
    ...(eng ? { engramStream: eng.stream, engramCount: eng.count, engramMeanJ: eng.meanJ } : {}),
    origBytes: data.length, shippedBytes: Math.round(ship),
    value: +(data.length / ship).toFixed(4),
  };
}

/** Frame list for a record — v2 `stream` or legacy `streams`/`chunkLens`. */
function chainFrames(chain) {
  if (typeof chain.stream === "string") return parseBiochainStream(chain.stream);
  if (Array.isArray(chain.streams))                                  // legacy record
    return chain.streams.map((residual, i) =>
      ({ residual, chunkLen: chain.chunkLens[i], parityOk: true }));
  throw new Error("no stream data on record");
}
/** Recreate the raw chunk byte-arrays of a chain (throws on decode failure). */
export function recreateChunks(chain) {
  return chainFrames(chain).map(f => {
    if (f.parityOk === false) throw new Error("packet parity failed");
    return decodeChunk(f.residual, f.chunkLen);
  });
}
/** Recreate the full original text of a chain. */
export function recreateText(chain) {
  const bytes = recreateChunks(chain).flat();
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** Recreate + verify a chain record client-side. Returns {ok, reasons}.
 *  Reads the single SHD-CCP `stream` (v2); falls back to legacy parallel
 *  `streams`/`chunkLens` arrays if a pre-stream record is encountered.
 *
 *  SELF-CONSISTENCY ONLY (F83): it checks packet parity, each leaf and the root
 *  when the record has them, the chiral weave, and the engram stream when present.
 *  It does not check the strict stream form, the packets against their chunks,
 *  the number of leaves, weaveMirror, segCuts, segments, the chainId or the
 *  derived numbers, and it reads legacy records. A record it accepts can still
 *  fail RFC 07's validity predicate; verifyIntegrityStrict checks that predicate.
 *  Kept unchanged for display and for the records verifyIntegrityStrict labels. */
export async function verifyIntegrity(chain) {
  const reasons = [];
  try {
    const frames = chainFrames(chain);
    const out = [];
    for (let i = 0; i < frames.length; i++) {
      if (frames[i].parityOk === false) { reasons.push(`packet ${i} parity failed`); return { ok: false, reasons }; }
      out.push(decodeChunk(frames[i].residual, frames[i].chunkLen));
    }
    // leaves: each recreated chunk must hash to its committed leaf
    const leaves = [];
    for (let i = 0; i < out.length; i++) {
      const h = await SC.sha256Hex(i + "|" + await SC.sha256Hex(String.fromCharCode(...out[i])));
      if (chain.leafHashes && h !== chain.leafHashes[i]) { reasons.push(`leaf ${i} mismatch`); return { ok: false, reasons }; }
      leaves.push(h);
    }
    // rebuild the Merkle root from recreated leaves and match the committed root
    let root = leaves.slice();
    if (!root.length) root = [await SC.sha256Hex("empty")];
    while (root.length > 1) {
      if (root.length & 1) root.push(root[root.length - 1]);
      const next = [];
      for (let i = 0; i < root.length; i += 2) next.push(await SC.sha256Hex(root[i] + root[i + 1]));
      root = next;
    }
    if (chain.merkleRoot && root[0] !== chain.merkleRoot) { reasons.push("merkle root mismatch"); return { ok: false, reasons }; }
    // chiral weave must reproduce
    let wf = [1, 0, 0, 0];
    for (const c of out) wf = qn(qmul(crystalQuat(c), wf));
    if (quatHex(wf) !== chain.weaveChiral) { reasons.push("chiral weave mismatch"); return { ok: false, reasons }; }
    // token engram layer must reproduce from the recreated text
    let engNote = "";
    if (typeof chain.engramStream === "string") {
      const text = new TextDecoder().decode(new Uint8Array(out.flat()));
      const eng = engramStreamFromText(text);
      if (eng.stream !== chain.engramStream) { reasons.push("engram stream mismatch"); return { ok: false, reasons }; }
      engNote = ` + ${eng.count} token engrams`;
    }
    reasons.push(`recreated ${out.reduce((a, c) => a + c.length, 0)} B · parity + leaves + merkle + chiral weave${engNote} verified`);
    return { ok: true, reasons };
  } catch (e) {
    return { ok: false, reasons: ["decode failure: " + e.message] };
  }
}

// ─── strict verification (RFC 07 section 12) ─────────────────────────────────
// verifyIntegrityStrict checks RFC 07's validity predicate (section 12.1) in the
// order of section 12.3 and reports the first failing check. It is synchronous
// and takes the hash as a parameter (opts.sha256: string → 64 lower-case hex of
// SHA-256 over its UTF-8), so a copy of this file can run with another SHA-256.
// Two rules sit where RFC 07 section 17's option (a) puts them, so that the first
// failing check is the one the Hyperbolic Lexicon's verifyPackage (steps 1-6)
// names: hex digits of either case pass parity (the case fails at canonical or
// crystal), and well-formed UTF-8 is checked at the start of derived (ill-formed
// bytes fail at the first check their change leaves wrong, at derived when every
// other field comes from the same bytes). Which records pass is unchanged.

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
const SHA256_H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const UTF8 = new TextEncoder();
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

/** SHA-256 (FIPS 180-4) of the UTF-8 encoding of String(str), as 64 lower-case hex
 *  digits: the same value as seal-crypto.js sha256Hex (Web Crypto), synchronously. */
export function sha256HexSync(str) {
  const msg = UTF8.encode(String(str)), n = msg.length;
  const buf = new Uint8Array((((n + 8) >>> 6) + 1) * 64);   // message, 0x80, zeros, 64-bit length
  buf.set(msg); buf[n] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(buf.length - 8, Math.floor(n / 0x20000000));  // bit length = 8·n, high word
  dv.setUint32(buf.length - 4, (n << 3) >>> 0);              // low word
  const H = SHA256_H0.slice(), W = new Uint32Array(64);
  for (let off = 0; off < buf.length; off += 64) {
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(off + 4 * t);
    for (let t = 16; t < 64; t++) {
      const x = W[t - 15], y = W[t - 2];
      W[t] = W[t - 16] + (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) + W[t - 7] + (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10));
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA256_K[t] + W[t]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(v => (v >>> 0).toString(16).padStart(8, "0")).join("");
}

/** The shdccp/2 leaf of chunk i (RFC 07 section 7.1): H(i + "|" + H(latin1(chunk))). */
export const leafHashSync = (i, chunk, sha256 = sha256HexSync) =>
  sha256(i + "|" + sha256(String.fromCharCode(...chunk)));
/** The shdccp/2 Merkle root (RFC 07 section 7.2): pairs H(left + right), the last
 *  node of an odd level duplicated; one leaf is its own root. */
export function merkleRootSync(leaves, sha256 = sha256HexSync) {
  let level = leaves.slice();
  while (level.length > 1) {
    if (level.length & 1) level.push(level[level.length - 1]);
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(sha256(level[i] + level[i + 1]));
    level = next;
  }
  return level[0] || sha256("empty");
}
/** The chiral and mirror weaves of a chunk list, as growBiochain computes them (RFC 07 section 8). */
export function chainWeaves(chunks) {
  let wf = [1, 0, 0, 0], wm = [1, 0, 0, 0];
  for (const c of chunks) wf = qn(qmul(crystalQuat(c), wf));
  for (let i = chunks.length - 1; i >= 0; i--) wm = qn(qmul(qconj(crystalQuat(chunks[i])), wm));
  return { weaveChiral: quatHex(wf), weaveMirror: quatHex(wm) };
}
const segCutsOf = (k) => Array.from({ length: SEGMENTS + 1 }, (_, i) => Math.round(i * k / SEGMENTS));

/** The strict checks, in the order verifyIntegrityStrict runs them (RFC 07 section 12.3). */
export const STRICT_CHECKS = Object.freeze(["parity", "canonical", "crystal", "leaves", "weaves", "derived"]);
const ENGRAM_FIELDS = ["engramStream", "engramCount", "engramMeanJ"];
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const numEq = (a, b) => typeof a === "number" && a === b;   // binary64 equality (-0 equals 0)

/** Check a record against RFC 07's validity predicate, synchronously.
 *  → { ok, failed, legacy, checks: [{ name, ok, detail, fields? }] }
 *  The checks run in order and stop at the first failure (`failed` names it; null
 *  when ok); `checks` lists the checks that ran. `fields` names the record fields
 *  a failing leaves, weaves or derived check found different.
 *    parity     streamVersion is "shdccp/2", the stream parses strictly
 *               (parseBiochainStreamStrict, hex digits of either case), at least
 *               one frame, every packet's parity holds
 *    canonical  the chunk lengths are the 720-byte cut (720 for every frame but the
 *               last, 1..720 for the last, at most 60,000 bytes in all); each
 *               residual decodes and re-encodes to itself (lower case); re-framing
 *               gives the stream (a length not in lower case fails here)
 *    crystal    every packet is crystallize(chunk), raw rule (upper case)
 *    leaves     leafHashes has exactly K entries, each the recomputed leaf;
 *               merkleRoot is present and equals the root of the leaves
 *    weaves     weaveChiral, weaveMirror, segCuts, segments (7) and the chainId
 *    derived    the bytes are well-formed UTF-8 (section 12.1, step 2), then the
 *               three engram fields when any is present (recomputed from the
 *               text), origBytes, shippedBytes and value
 *  A record without a string `stream`, or whose streamVersion is missing or not
 *  "shdccp/2", is legacy: { ok: false, failed: "parity", legacy: true }.
 *  opts.sha256: the hash (default sha256HexSync), synchronous, same contract. */
export function verifyIntegrityStrict(chain, { sha256 = sha256HexSync } = {}) {
  const checks = [];
  const verdict = (failed, legacy = false) => ({ ok: failed === null, failed, legacy, checks });
  const isRecord = chain !== null && typeof chain === "object" && !Array.isArray(chain);
  if (!isRecord || typeof chain.stream !== "string" || chain.streamVersion !== STREAM_VERSION) {
    const detail = !isRecord ? "not a record"
      : typeof chain.stream !== "string" ? "no shdccp/2 stream (a legacy record)"
      : !hasOwn(chain, "streamVersion") ? "no streamVersion (a legacy record)"
      : "streamVersion is not shdccp/2 (a legacy record)";
    checks.push({ name: "parity", ok: false, detail });
    return verdict("parity", isRecord);
  }
  const pass = (detail) => ({ ok: true, detail });
  const fail = (detail, fields) => ({ ok: false, detail, ...(fields ? { fields } : {}) });
  const st = {};
  const run = {
    parity() {
      st.frames = parseBiochainStreamStrict(chain.stream);
      const bad = st.frames.findIndex(f => !f.parityOk);
      return bad < 0 ? pass(`${st.frames.length} frame(s), parity holds`) : fail(`packet ${bad}: parity does not hold`);
    },
    canonical() {
      const { frames } = st, k = frames.length;
      let total = 0;
      for (let i = 0; i < k; i++) {
        const n = frames[i].chunkLen;
        if (i < k - 1 ? n !== CHUNK : !(n >= 1 && n <= CHUNK)) return fail(`frame ${i}: a ${n}-byte chunk is not the 720-byte cut`);
        total += n;
      }
      if (total > MAX_GROW_BYTES) return fail(`${total} bytes is more than ${MAX_GROW_BYTES}`);
      const chunks = [];
      for (let i = 0; i < k; i++) {
        let bytes;
        try { bytes = decodeChunk(frames[i].residual, frames[i].chunkLen); }
        catch (e) { return fail(`frame ${i}: the residual does not decode (${e.message})`); }
        if (!bytes.every(b => Number.isInteger(b) && b >= 0 && b <= 255)) return fail(`frame ${i}: the residual decodes to a value that is not a byte`);
        if (encodeChunk(bytes) !== frames[i].residual) return fail(`frame ${i}: the residual is not the canonical encoding of its chunk`);
        chunks.push(bytes);
      }
      if (frameStream(frames.map(f => f.packet), frames.map(f => f.residual)) !== chain.stream)
        return fail("the stream is not the framing of its packets and residuals");
      st.chunks = chunks; st.bytes = total;
      return pass(`${k} chunk(s), ${total} bytes, canonical`);
    },
    crystal() {
      const bad = st.chunks.findIndex((c, i) => crystallize(c) !== st.frames[i].packet);
      return bad < 0 ? pass("every packet is crystallize(chunk)") : fail(`packet ${bad} is not crystallize(chunk ${bad})`);
    },
    leaves() {
      const k = st.chunks.length, lh = chain.leafHashes;
      if (!Array.isArray(lh)) return fail("leafHashes is missing", ["leafHashes"]);
      if (typeof chain.merkleRoot !== "string") return fail("merkleRoot is missing", ["merkleRoot"]);
      if (lh.length !== k) return fail(`leafHashes has ${lh.length} entries for ${k} chunk(s)`, ["leafHashes"]);
      const leaves = st.chunks.map((c, i) => leafHashSync(i, c, sha256));
      const bad = leaves.findIndex((h, i) => lh[i] !== h);
      if (bad >= 0) return fail(`leaf ${bad} differs from the recomputed leaf`, ["leafHashes"]);
      st.root = merkleRootSync(leaves, sha256);
      return chain.merkleRoot === st.root ? pass(`${k} leaves and merkleRoot`) : fail("merkleRoot is not the root of the leaves", ["merkleRoot"]);
    },
    weaves() {
      const w = chainWeaves(st.chunks), cuts = segCutsOf(st.chunks.length);
      const chainId = "BC-" + sha256(st.root + "|" + w.weaveChiral).slice(0, 24);
      const bad = [];
      if (chain.weaveChiral !== w.weaveChiral) bad.push("weaveChiral");
      if (chain.weaveMirror !== w.weaveMirror) bad.push("weaveMirror");
      if (!(Array.isArray(chain.segCuts) && chain.segCuts.length === cuts.length && cuts.every((c, i) => numEq(chain.segCuts[i], c))))
        bad.push("segCuts");
      if (!numEq(chain.segments, SEGMENTS)) bad.push("segments");
      if (chain.chainId !== chainId) bad.push("chainId");
      return bad.length ? fail(`${bad.join(", ")} not reproduced`, bad) : pass("weaveChiral, weaveMirror, segCuts, segments and chainId");
    },
    derived() {
      const data = new Uint8Array(st.bytes);
      let at = 0;
      for (const c of st.chunks) { data.set(c, at); at += c.length; }
      try { st.text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(data); }
      catch (_) { return fail("the chunks are not well-formed UTF-8"); }
      const bad = [];
      let engramHexLen = 0;
      if (ENGRAM_FIELDS.some(f => hasOwn(chain, f))) {
        const eng = engramStreamFromText(st.text);
        engramHexLen = eng.stream.length;
        if (chain.engramStream !== eng.stream) bad.push("engramStream");
        if (!numEq(chain.engramCount, eng.count)) bad.push("engramCount");
        if (!numEq(chain.engramMeanJ, eng.meanJ)) bad.push("engramMeanJ");
      }
      const ship = chain.stream.length / 2 + engramHexLen / 2 + st.chunks.length * 32 + 40;
      if (!numEq(chain.origBytes, st.bytes)) bad.push("origBytes");
      if (!numEq(chain.shippedBytes, Math.round(ship))) bad.push("shippedBytes");
      if (!numEq(chain.value, +(st.bytes / ship).toFixed(4))) bad.push("value");
      return bad.length ? fail(`${bad.join(", ")} not reproduced`, bad) : pass("engram fields (when present), origBytes, shippedBytes and value");
    },
  };
  for (const name of STRICT_CHECKS) {
    let r;
    try { r = run[name](); } catch (e) { r = fail(String((e && e.message) || e)); }
    checks.push({ name, ...r });
    if (!r.ok) return verdict(name);
  }
  return verdict(null);
}

/** The failing check of a strict verdict ({ name, ok, detail, fields? }), or null. */
export const failedCheck = (v) => (v && !v.ok && v.checks.length ? v.checks[v.checks.length - 1] : null);

/** The label a page shows for a strict verdict (decision D15): "strict ok",
 *  "legacy", "failed at <check>", or "self-consistent only, failed at <check>"
 *  when selfConsistent (verifyIntegrity's ok) is true. */
export function strictLabel(v, selfConsistent) {
  if (!v) return "not checked";
  if (v.ok) return "strict ok";
  if (v.legacy) return "legacy";
  return (selfConsistent === true ? "self-consistent only, " : "") + "failed at " + v.failed;
}

// ─── growth epochs (GROWTH/1) — extending a crystallized chain ────────────────
// A published biochain is immutable (rules freeze it), so "growing it further"
// mints a NEW epoch: recreate the parent losslessly (proving you hold the real
// body, not just its hashes), append the new text, regrow. The child is a
// full, independently verifiable chain whose record carries the parent link;
// the parent stays frozen and tradable. Content addressing makes growth
// deterministic: same parent + same added text → same child chainId.

export const growthCommitment = (c) =>
  ["GROWTH/1", c.parentChainId, c.chainId, c.parentMerkleRoot, c.merkleRoot, String(c.addedBytes)].join("|");

/** Extend a chain with more data → a child-epoch claim (pure, no network).
 *  The parent's strict verdict is computed every time and returned as the
 *  non-enumerable `parentStrict` (so publishBiochain does not store it); with
 *  opts.enforceStrict a parent that fails it is refused. scripts/biomesh.js
 *  passes its STRICT_ENFORCE flag. The self-consistency check refuses as before. */
export async function extendBiochain(parentChain, newText, opts = {}) {
  if (!newText || !newText.length) throw new Error("Nothing to add.");
  const strict = verifyIntegrityStrict(parentChain);
  if (opts.enforceStrict && !strict.ok) throw new Error("Parent chain fails the strict check: " + strictLabel(strict));
  const integ = await verifyIntegrity(parentChain);
  if (!integ.ok) throw new Error("Parent chain fails integrity: " + integ.reasons[0]);
  const parentText = recreateText(parentChain);
  const child = await growBiochain(parentText + newText, opts);
  const claim = {
    ...child,
    parentChainId: parentChain.chainId,
    parentMerkleRoot: parentChain.merkleRoot,
    epoch: (parentChain.epoch || 1) + 1,
    addedBytes: child.origBytes - parentChain.origBytes,
  };
  Object.defineProperty(claim, "parentStrict", { value: strict, enumerable: false });
  return claim;
}

// ─── certification commitment (GROWN/1) ───────────────────────────────────────

export const grownCommitment = (c) =>
  ["GROWN/1", c.chainId, c.merkleRoot, c.weaveChiral, c.weaveMirror, String(c.origBytes)].join("|");

// ─── codex files (CODEX/1) + chain pairing (PAIR/1) ──────────────────────────
// A codex is the personalization seed for hyperbolic AI systems (the Engram
// Mind Eye family): the chain's learned expectations distilled into a packet
// program — GEAR header, PRIME entries (context → byte, count), HALT — the
// same closed instruction set as BioChain_Enterprise/codex_engine.py. Codices
// are content-addressed (codexHash), immutable, and PAIRED to a biochain by an
// owner-signed PAIR/1 seal on the chain doc, so chain + codex travel together
// through every transfer on the biomesh.

/** Distill a codex from text: top-N order-2 context→byte expectations. */
export async function deriveCodex(text, opts = {}) {
  const order = 2, chunk = opts.chunk || 720, topN = opts.topN || 120;
  const data = [...new TextEncoder().encode(text)];
  if (!data.length) throw new Error("Nothing to distill.");
  const counts = new Map();
  let c0 = 0, c1 = 0;
  for (const b of data) {
    const k = ((c0 << 16) | (c1 << 8) | b);          // ctx byte-pair + next byte
    counts.set(k, (counts.get(k) || 0) + 1);
    c0 = c1; c1 = b;
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, topN);
  const packets = [packWord(1, order, [0, 0, 0, 0], chunk, 0, 0)];          // GEAR
  for (const [k, count] of top) {
    const ctx16 = (k >> 8) & 0xFFFF, byte = k & 0xFF;
    packets.push(packWord(2, order, [byte >> 4, byte & 15, Math.min(count, 127), 0], ctx16, 0, 0)); // PRIME
  }
  packets.push(packWord(0, 0, [0, 0, 0, 0], 0, 0, 0));                       // HALT
  const stream = packets.join("");
  const codexHash = "CX-" + (await SC.sha256Hex(stream)).slice(0, 24);
  return { codexHash, stream, codexVersion: "codex/1", order, chunk, entryCount: top.length };
}

/** Parse + validate a bare codex packet stream (parity, opcode discipline). */
export function parseCodexStream(streamHex) {
  if (streamHex.length % 16) throw new Error("codex stream not packet-aligned");
  const words = [];
  for (let p = 0; p < streamHex.length; p += 16) words.push(unpackPacket(streamHex.slice(p, p + 16)));
  if (words.some(w => !w.parityOk)) throw new Error("codex packet parity failed");
  if (!words.length || words[0].form !== 1) throw new Error("codex must open with GEAR");
  if (words[words.length - 1].form !== 0) throw new Error("codex must end with HALT");
  const entries = [];
  for (const w of words.slice(1, -1)) {
    if (w.form !== 2) throw new Error(`unknown codex opcode FORM ${w.form} — closed instruction set`);
    const q = w.quat32;
    entries.push({ ctx16: w.payload16, byte: (((q >>> 24) & 0xFF) << 4) | ((q >>> 16) & 0xFF), count: (q >>> 8) & 0xFF });
  }
  return { order: words[0].spin, chunk: words[0].payload16, entries };
}

export const codexCommitment = (c) =>
  ["CODEX/1", c.codexHash, String(c.order), String(c.entryCount)].join("|");

export const pairCommitment = (chainId, codexHash) => ["PAIR/1", chainId, codexHash].join("|");

// ─── record kinds ─────────────────────────────────────────────────────────────
// The `kind` a published biochain carries (F14, P14): what the grown text is. The
// callers of publishBiochain pass these; RFC 07 section 11.3 lists them.
export const KINDS = Object.freeze({
  "text": "text grown in the Biomesh Console",
  "language-session": "a Language Growing session transcript",
  "language-shard": "a language shard grown for a seed corpus",
  "mindseye.lattice_seed": "a Mind's Eye 3D lattice seed (LATTICE-SEED/1)",
  "mindseye.environment": "a Mind's Eye 3D environment (ENVIRONMENT/1)",
  "latticeforge.lattice_seed": "a BioChain-AI Lattice Forge lattice seed",
  "latticeforge.environment": "a BioChain-AI Lattice Forge environment",
});
/** The kind if it is in KINDS; throws otherwise. */
export function validateKind(kind) {
  if (typeof kind === "string" && hasOwn(KINDS, kind)) return kind;
  throw new Error("Unknown biochain kind; the known kinds are " + Object.keys(KINDS).join(", ") + ".");
}
