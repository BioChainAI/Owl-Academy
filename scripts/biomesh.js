/**
 * Biomesh AI — biochain growing, certification, free transfer & marketplace.
 * ----------------------------------------------------------------------------
 * The school-system deployment of the BioChain Enterprise engram machinery:
 *
 *  • GROW    — grow a biochain in the Biostrata substrate (in-browser, the
 *              measured predict-then-correct cell: order-2 rank coder, 720-byte
 *              chunks, kernel-packet crystallization, 7 weave segments with
 *              chiral + mirror holonomies).
 *  • CERTIFY — the grower signs a GROWN/1 commitment with their Minor Tome
 *              seal. Certification is therefore recallable, publicly
 *              verifiable, and traces to a Genesis identity via seals/{id}.
 *  • SEND    — transfers are ALWAYS FREE. A transfer is a seal-signed
 *              BIOMESH-XFER/1 record; ownership only moves when the recipient
 *              accepts. The transfer docs are the lineage — never deleted.
 *  • RATE    — marketplace ratings: measured value + verified integrity are
 *              automatic; utility stars come from raters (tier-weighted).
 *
 * Trust posture matches the rest of the Academy: client-side crypto with
 * firestore.rules as the backstop (see rules: biochains / biochainTransfers /
 * biochainRatings). Every event is also chronicled (append-only).
 */

import {
  getDocument, setDocument, updateDocument, addToCollection, queryCollection,
  where, orderBy, limit,
} from "./firebase/firestore.js";
import { readRegistrar } from "./spire-registrar.js";
import { getTick } from "./schumann-oracle.js";
import { signWithMinorTome, verifySealBlock } from "./minor-tome.js";
import * as SC from "./seal-crypto.js";

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
const qmul = (a, b) => [
  a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3], a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
  a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1], a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
const qconj = a => [a[0], -a[1], -a[2], -a[3]];
const qn = a => { const n = Math.hypot(...a) || 1; return a.map(x => x / n); };
function crystalQuat(bytes) {
  const c32 = Number((fold64(bytes) ^ (fold64(bytes) >> 32n)) & 0xFFFFFFFFn);
  const s = i => { const v = (c32 >>> i) & 255; return v >= 128 ? v - 256 : v; };
  return qn([0.5 + s(24) / 254, s(16) / 127, s(8) / 127, s(0) / 127]);
}
const quatHex = q => q.map(v => v.toFixed(12)).join(",");

// ─── SHD-CCP 64-bit packet (byte-identical to shdccp_kernel.crystallize) ──────
// Field map (MSB..LSB of the 64-bit word):
//   63..60 form · 59 parity · 58..56 spin · 55..24 quat32 · 23..8 payload16 · 7..3 freq · 2..0 amp
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
function crystallize(bytes) {
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

// ─── token engrams (Engram Mind Eye compatible, bit-identical) ────────────────
// Verbatim port of the TTMPT engram core in
// Library/Experimental_Systems/Engram_Mind_Eye.html: Mulberry32 PRNG,
// per-character panmagic 8×8 grid (seed = seed*31 + charCode), XOR
// crystallization across a token's characters, LSB-first byte packing (the
// same packing its chiralKey uses). A biochain's engram packet for a token is
// therefore bit-identical to crystallize(token) on that page — an engram
// stream can pre-seed the Mind Eye's Hamming matcher directly.
function mulberry32(seed) {
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
/** token → 64-bit XOR-crystallized engram grid (Mind Eye crystallize, verbatim). */
export function engramGrid(token) {
  let acc = new Array(64).fill(0);
  for (const ch of token.toUpperCase()) {
    if (!/[A-Z]/.test(ch)) continue;
    acc = acc.map((b, i) => b ^ engramCharGrid(ch)[i]);
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
function frameStream(packetsHex, residualsHex) {
  let s = "";
  for (let i = 0; i < packetsHex.length; i++) {
    const r = residualsHex[i];
    s += packetsHex[i] + (r.length / 2).toString(16).padStart(8, "0") + r;
  }
  return s;
}
/** Parse a framed stream back into [{ packet, chunkLen, residual, parityOk }]. */
export function parseBiochainStream(streamHex) {
  const frames = []; let p = 0;
  while (p < streamHex.length) {
    const packet = streamHex.slice(p, p + 16); p += 16;
    const rbytes = parseInt(streamHex.slice(p, p + 8), 16); p += 8;
    if (!Number.isFinite(rbytes)) throw new Error("malformed stream frame");
    const residual = streamHex.slice(p, p + rbytes * 2); p += rbytes * 2;
    frames.push({ packet, residual, ...unpackPacket(packet) });
  }
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

function encodeChunk(bytes) {
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
 *  `streams`/`chunkLens` arrays if a pre-stream record is encountered. */
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

// ─── growth epochs (GROWTH/1) — extending a crystallized chain ────────────────
// A published biochain is immutable (rules freeze it), so "growing it further"
// mints a NEW epoch: recreate the parent losslessly (proving you hold the real
// body, not just its hashes), append the new text, regrow. The child is a
// full, independently verifiable chain whose record carries the parent link;
// the parent stays frozen and tradable. Content addressing makes growth
// deterministic: same parent + same added text → same child chainId.

export const growthCommitment = (c) =>
  ["GROWTH/1", c.parentChainId, c.chainId, c.parentMerkleRoot, c.merkleRoot, String(c.addedBytes)].join("|");

/** Extend a chain with more data → a child-epoch claim (pure, no network). */
export async function extendBiochain(parentChain, newText, opts = {}) {
  if (!newText || !newText.length) throw new Error("Nothing to add.");
  const integ = await verifyIntegrity(parentChain);
  if (!integ.ok) throw new Error("Parent chain fails integrity: " + integ.reasons[0]);
  const parentText = recreateText(parentChain);
  const child = await growBiochain(parentText + newText, opts);
  return {
    ...child,
    parentChainId: parentChain.chainId,
    parentMerkleRoot: parentChain.merkleRoot,
    epoch: (parentChain.epoch || 1) + 1,
    addedBytes: child.origBytes - parentChain.origBytes,
  };
}

/** Verify a child epoch's GROWTH/1 seal against the record's own commitment. */
export async function verifyGrowth(chain) {
  if (!chain.parentChainId) return { valid: false, reason: "not a growth epoch" };
  if (!chain.growthSeal) return { valid: false, reason: "no growth certification block" };
  const base = await verifySealBlock(chain.growthSeal);
  if (!base.valid) return base;
  const h = await SC.sha256Hex(growthCommitment(chain));
  const match = h === chain.growthSeal.contentHash;
  return { ...base, valid: base.valid && match,
    reason: match ? `epoch ${chain.epoch} grown from ${chain.parentChainId} by ` + base.genesisId
                  : "growth commitment does not match certification" };
}

// ─── certification (GROWN/1) + publication ───────────────────────────────────

export const grownCommitment = (c) =>
  ["GROWN/1", c.chainId, c.merkleRoot, c.weaveChiral, c.weaveMirror, String(c.origBytes)].join("|");

/** Publish a grown biochain: seal-sign the commitment, write the record. */
export async function publishBiochain(uid, sealId, chain, meta = {}) {
  const reg = await readRegistrar(uid);
  if (!reg || !reg.cosmologicalId) throw new Error("Forge your Cosmological ID first.");
  const grownSeal = await signWithMinorTome(uid, sealId, grownCommitment(chain));
  // child epoch: also seal the GROWTH/1 commitment binding parent → child
  const growthSeal = chain.parentChainId
    ? await signWithMinorTome(uid, sealId, growthCommitment(chain)) : null;
  const tick = await getTick();
  const rec = {
    ...chain,
    title: meta.title || "Untitled Biochain",
    description: meta.description || "",
    growerUid: uid, growerGenesisId: reg.cosmologicalId, growerSealId: sealId,
    grownSeal,                                   // the certification block
    ...(growthSeal ? { growthSeal } : {}),
    ownerUid: uid, ownerGenesisId: reg.cosmologicalId,
    lineage: [{
      event: chain.parentChainId ? "extended" : "grown",
      uid, genesisId: reg.cosmologicalId, tick: tick.token, at: new Date().toISOString(),
      ...(chain.parentChainId ? { parentChainId: chain.parentChainId, epoch: chain.epoch } : {}),
    }],
    lastTransferId: null,
    status: meta.listed ? "listed" : "grown",
    tickToken: tick.token,
    createdAt: new Date().toISOString(),
  };
  await setDocument(`biochains/${chain.chainId}`, rec);
  await addToCollection("chronicles", {
    kind: chain.parentChainId ? "biomesh.extended" : "biomesh.grown",
    uid, chainId: chain.chainId, genesisId: reg.cosmologicalId, sealId,
    merkleRoot: chain.merkleRoot, tickToken: tick.token,
    ...(chain.parentChainId ? { parentChainId: chain.parentChainId, epoch: chain.epoch } : {}),
  });
  return rec;
}

/** Verify certification: the GROWN/1 seal block against the record's own commitment. */
export async function verifyGrown(chain) {
  if (!chain.grownSeal) return { valid: false, reason: "no certification block" };
  const base = await verifySealBlock(chain.grownSeal);
  if (!base.valid) return base;
  const h = await SC.sha256Hex(grownCommitment(chain));
  const match = h === chain.grownSeal.contentHash;
  return { ...base, valid: base.valid && match,
    reason: match ? "certified grown by " + base.genesisId : "commitment does not match certification" };
}

export const listBiochains = (max = 100) =>
  queryCollection("biochains", [orderBy("createdAt", "desc"), limit(max)]);
export const getBiochain = (chainId) => getDocument(`biochains/${chainId}`);

/** Owner toggles marketplace listing (transfers stay free either way). */
export async function setListing(uid, chainId, listed) {
  await updateDocument(`biochains/${chainId}`, { status: listed ? "listed" : "grown" });
  await addToCollection("chronicles", { kind: "biomesh.listing", uid, chainId, listed });
}

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

/** Publish a codex: seal-sign the commitment, write the immutable record. */
export async function publishCodex(uid, sealId, codex, meta = {}) {
  const reg = await readRegistrar(uid);
  if (!reg || !reg.cosmologicalId) throw new Error("Forge your Cosmological ID first.");
  parseCodexStream(codex.stream);                                    // ABI gate before write
  const codexSeal = await signWithMinorTome(uid, sealId, codexCommitment(codex));
  await setDocument(`biomeshCodices/${codex.codexHash}`, {
    ...codex,
    title: meta.title || "Untitled Codex",
    derivedFromChainId: meta.derivedFromChainId || null,
    creatorUid: uid, creatorGenesisId: reg.cosmologicalId, creatorSealId: sealId,
    codexSeal, createdAt: new Date().toISOString(),
  });
  await addToCollection("chronicles", { kind: "biomesh.codex", uid, codexHash: codex.codexHash,
    genesisId: reg.cosmologicalId, entryCount: codex.entryCount });
  return codex.codexHash;
}

export const getCodex = (codexHash) => getDocument(`biomeshCodices/${codexHash}`);

export const pairCommitment = (chainId, codexHash) => ["PAIR/1", chainId, codexHash].join("|");

/** Pair a codex to a chain you own — both then travel together on the mesh. */
export async function pairCodex(uid, sealId, chainId, codexHash) {
  const chain = await getBiochain(chainId);
  if (!chain) throw new Error("Unknown biochain.");
  if (chain.ownerUid !== uid) throw new Error("Only the current owner may pair a codex.");
  if (!(await getCodex(codexHash))) throw new Error("Unknown codex — publish it first.");
  const pairSeal = await signWithMinorTome(uid, sealId, pairCommitment(chainId, codexHash));
  await updateDocument(`biochains/${chainId}`, { pairedCodexHash: codexHash, pairSeal });
  await addToCollection("chronicles", { kind: "biomesh.paired", uid, chainId, codexHash });
  return true;
}

/** Verify a chain's codex pairing seal. */
export async function verifyPair(chain) {
  if (!chain.pairedCodexHash) return { valid: false, reason: "no codex paired" };
  if (!chain.pairSeal) return { valid: false, reason: "pairing has no seal" };
  const base = await verifySealBlock(chain.pairSeal);
  if (!base.valid) return base;
  const h = await SC.sha256Hex(pairCommitment(chain.chainId, chain.pairedCodexHash));
  const match = h === chain.pairSeal.contentHash;
  return { ...base, valid: base.valid && match,
    reason: match ? `codex ${chain.pairedCodexHash} paired by ` + base.genesisId
                  : "pairing does not match seal" };
}

// ─── free transfers (BIOMESH-XFER/1) — the lineage spine ─────────────────────

export async function sendBiochain(uid, sealId, chainId, toUid) {
  const chain = await getBiochain(chainId);
  if (!chain) throw new Error("Unknown biochain.");
  if (chain.ownerUid !== uid) throw new Error("Only the current owner may send a biochain.");
  const reg = await readRegistrar(uid);
  const tick = await getTick();
  const payload = ["BIOMESH-XFER/1", chainId, reg.cosmologicalId, toUid, tick.token].join("|");
  const xferSeal = await signWithMinorTome(uid, sealId, payload);
  const doc = await addToCollection("biochainTransfers", {
    chainId, fromUid: uid, fromGenesisId: reg.cosmologicalId, toUid,
    payload, xferSeal, price: 0,                  // transfers are ALWAYS free
    status: "pending", tickToken: tick.token, sentAt: new Date().toISOString(),
  });
  await addToCollection("chronicles", { kind: "biomesh.sent", uid, chainId, toUid, transferId: doc.id });
  return doc.id;
}

/** Recipient accepts: transfer flips to accepted, then ownership moves (rules
 *  verify the accepted transfer addressed to the caller before allowing it). */
export async function acceptBiochain(uid, transferId) {
  const t = await getDocument(`biochainTransfers/${transferId}`);
  if (!t) throw new Error("Unknown transfer.");
  if (t.toUid !== uid) throw new Error("This transfer is not addressed to you.");
  if (t.status !== "pending") throw new Error(`Transfer already ${t.status}.`);
  const sealCheck = await verifySealBlock(t.xferSeal);
  if (!sealCheck.valid) throw new Error("Sender's transfer seal fails verification: " + sealCheck.reason);
  const reg = await readRegistrar(uid);
  await updateDocument(`biochainTransfers/${transferId}`, { status: "accepted", acceptedAt: new Date().toISOString() });
  const chain = await getBiochain(t.chainId);
  await updateDocument(`biochains/${t.chainId}`, {
    ownerUid: uid, ownerGenesisId: reg?.cosmologicalId || null, lastTransferId: transferId,
    lineage: [...(chain.lineage || []), {
      event: "transfer", transferId, fromUid: t.fromUid, fromGenesisId: t.fromGenesisId,
      toUid: uid, toGenesisId: reg?.cosmologicalId || null, tick: t.tickToken, at: new Date().toISOString(),
    }],
  });
  await addToCollection("chronicles", { kind: "biomesh.accepted", uid, chainId: t.chainId, transferId });
  return true;
}

export const declineBiochain = async (uid, transferId) => {
  await updateDocument(`biochainTransfers/${transferId}`, { status: "declined" });
  await addToCollection("chronicles", { kind: "biomesh.declined", uid, transferId });
};

export const listIncoming = (uid) =>
  queryCollection("biochainTransfers", [where("toUid", "==", uid), where("status", "==", "pending")]);
export const listTransfersForChain = (chainId) =>
  queryCollection("biochainTransfers", [where("chainId", "==", chainId)]);
export const listAllTransfers = (max = 200) =>
  queryCollection("biochainTransfers", [orderBy("createdAt", "desc"), limit(max)]);

/** Record that a Language Growing session was burned (destroyed, unexported).
 *  Logs ONLY the fact + turn count + last parity — never the content — so a
 *  burn is itself an auditable system event even though the session it
 *  destroys is deliberately unrecoverable. */
export async function logSessionBurn(uid, turnCount, parityHex) {
  await addToCollection("chronicles", {
    kind: "biomesh.session_burned", uid, turnCount, parityHex, at: new Date().toISOString(),
  });
}

/** Full trace: certification + every hop's seal, verified. */
export async function traceBiochain(chainId) {
  const chain = await getBiochain(chainId);
  if (!chain) throw new Error("Unknown biochain.");
  const grown = await verifyGrown(chain);
  const transfers = (await listTransfersForChain(chainId))
    .sort((a, b) => (a.sentAt || "").localeCompare(b.sentAt || ""));
  const hops = [];
  for (const t of transfers) {
    const v = await verifySealBlock(t.xferSeal);
    hops.push({ ...t, sealValid: v.valid, sealReason: v.reason, senderGenesis: v.genesisId || t.fromGenesisId });
  }
  const integrity = await verifyIntegrity(chain);
  return { chain, grown, hops, integrity };
}

// ─── marketplace ratings → success score ─────────────────────────────────────

const TIER_WEIGHT = { ARCHON: 3, INSTRUCTOR: 2, ACOLYTE: 1 };

export async function rateBiochain(uid, chainId, stars, comment = "", recreatedOk = null) {
  const reg = await readRegistrar(uid);
  let tier = "ACOLYTE";
  try { const { resolveTier } = await import("./genesis-registrar.js"); tier = await resolveTier(uid); } catch (_) {}
  await setDocument(`biochainRatings/${chainId}_${uid}`, {
    chainId, raterUid: uid, raterGenesisId: reg?.cosmologicalId || null, raterTier: tier,
    stars: Math.max(1, Math.min(5, Math.round(stars))), comment: String(comment).slice(0, 500),
    recreatedOk, ratedAt: new Date().toISOString(),
  });
  await addToCollection("chronicles", { kind: "biomesh.rated", uid, chainId, stars });
}

export const listRatings = (chainId) =>
  queryCollection("biochainRatings", [where("chainId", "==", chainId)]);

/** Success score: measured value 40 · verified integrity 25 · utility stars 25 · adoption 10. */
export function successScore(chain, ratings = [], transferCount = 0) {
  const valuePart = 40 * Math.min(1, (chain.value || 0) / 2);            // value 2.0 ≈ ceiling
  const verified = ratings.filter(r => r.recreatedOk === true).length;
  const integrityPart = 25 * (ratings.length ? Math.min(1, verified / Math.max(1, ratings.length)) : 0);
  let wsum = 0, wtot = 0;
  for (const r of ratings) { const w = TIER_WEIGHT[r.raterTier] || 1; wsum += w * (r.stars || 0); wtot += w; }
  const starsPart = 25 * (wtot ? (wsum / wtot) / 5 : 0);
  const adoptionPart = 10 * Math.min(1, transferCount / 5);
  return {
    total: +(valuePart + integrityPart + starsPart + adoptionPart).toFixed(1),
    parts: { value: +valuePart.toFixed(1), integrity: +integrityPart.toFixed(1),
             stars: +starsPart.toFixed(1), adoption: +adoptionPart.toFixed(1) },
    verifiedCount: verified, ratingCount: ratings.length, transferCount,
  };
}
