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
 *
 * The pure, Firebase-free functions (grow, recreate, verify, engrams, seeds,
 * codex derivation, commitments) live in scripts/biomesh-core.js; this module
 * re-exports all of them and keeps the Firestore services below.
 */

import {
  getDocument, setDocument, updateDocument, addToCollection, queryCollection,
  where, orderBy, limit,
} from "./firebase/firestore.js";
import { readRegistrar } from "./spire-registrar.js";
import { getTick } from "./schumann-oracle.js";
import { signWithMinorTome, verifySealBlock } from "./minor-tome.js";
import * as SC from "./seal-crypto.js";
import {
  verifyIntegrity, growthCommitment, grownCommitment, parseCodexStream, codexCommitment, pairCommitment,
} from "./biomesh-core.js";

export * from "./biomesh-core.js";

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

// ─── codex files (CODEX/1) + chain pairing (PAIR/1): publication ────────────
// deriveCodex, parseCodexStream, codexCommitment and pairCommitment are in
// biomesh-core.js.

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
