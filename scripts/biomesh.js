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
/** decode a crystal packet → { chunkLen, parityOk }. */
function unpackPacket(hex) {
  const word = BigInt("0x" + hex);
  const parityBit = (word >> 59n) & 1n;
  return { chunkLen: Number((word >> 8n) & 0xFFFFn), parityOk: popcountEven(word) === parityBit };
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

/** Grow a biochain from text — pure Biostrata step, no network. */
export async function growBiochain(text) {
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
  // shipped = the stream + the leaf-commitment vector + root/weave overhead
  const ship = stream.length / 2 + leafHashes.length * 32 + 40;
  return {
    chainId, stream, streamVersion: STREAM_VERSION, leafHashes, merkleRoot,
    weaveChiral: quatHex(wf), weaveMirror: quatHex(wm), segCuts, segments: SEGMENTS,
    origBytes: data.length, shippedBytes: Math.round(ship),
    value: +(data.length / ship).toFixed(4),
  };
}

/** Recreate + verify a chain record client-side. Returns {ok, reasons}.
 *  Reads the single SHD-CCP `stream` (v2); falls back to legacy parallel
 *  `streams`/`chunkLens` arrays if a pre-stream record is encountered. */
export async function verifyIntegrity(chain) {
  const reasons = [];
  try {
    let frames;
    if (typeof chain.stream === "string") {
      frames = parseBiochainStream(chain.stream);
    } else if (Array.isArray(chain.streams)) {                       // legacy record
      frames = chain.streams.map((residual, i) =>
        ({ residual, chunkLen: chain.chunkLens[i], parityOk: true }));
    } else {
      return { ok: false, reasons: ["no stream data on record"] };
    }
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
    reasons.push(`recreated ${out.reduce((a, c) => a + c.length, 0)} B · parity + leaves + merkle + chiral weave verified`);
    return { ok: true, reasons };
  } catch (e) {
    return { ok: false, reasons: ["decode failure: " + e.message] };
  }
}

// ─── certification (GROWN/1) + publication ───────────────────────────────────

export const grownCommitment = (c) =>
  ["GROWN/1", c.chainId, c.merkleRoot, c.weaveChiral, c.weaveMirror, String(c.origBytes)].join("|");

/** Publish a grown biochain: seal-sign the commitment, write the record. */
export async function publishBiochain(uid, sealId, chain, meta = {}) {
  const reg = await readRegistrar(uid);
  if (!reg || !reg.cosmologicalId) throw new Error("Forge your Cosmological ID first.");
  const grownSeal = await signWithMinorTome(uid, sealId, grownCommitment(chain));
  const tick = await getTick();
  const rec = {
    ...chain,
    title: meta.title || "Untitled Biochain",
    description: meta.description || "",
    growerUid: uid, growerGenesisId: reg.cosmologicalId, growerSealId: sealId,
    grownSeal,                                   // the certification block
    ownerUid: uid, ownerGenesisId: reg.cosmologicalId,
    lineage: [{ event: "grown", uid, genesisId: reg.cosmologicalId, tick: tick.token, at: new Date().toISOString() }],
    lastTransferId: null,
    status: meta.listed ? "listed" : "grown",
    tickToken: tick.token,
    createdAt: new Date().toISOString(),
  };
  await setDocument(`biochains/${chain.chainId}`, rec);
  await addToCollection("chronicles", { kind: "biomesh.grown", uid, chainId: chain.chainId,
    genesisId: reg.cosmologicalId, sealId, merkleRoot: chain.merkleRoot, tickToken: tick.token });
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
