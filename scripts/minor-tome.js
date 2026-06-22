/**
 * Minor Tome — personal, ephemeral, recallable seals.
 * ----------------------------------------------------------------------------
 * Any tier may mint a minor tome and control its three aspects:
 *   1. Hilbert-space params (lattice / dimension / modulus)
 *   2. Manifold selection (manifold + coherency + torsion)
 *   3. Schumann timing (the issuance tick, from the NOAA-driven oracle)
 *
 * A minor tome carries an ECDSA keypair: the PRIVATE key lives only in the
 * owner-only users/{uid}/minorTomes/{sealId} doc; the PUBLIC key is mirrored to
 * the signed-in-readable seals/{sealId} registry so anyone can verify a seal and
 * trace it back to the owner. Recalling/archiving flips status → every seal it
 * signed stops verifying ("send out, then recall validity").
 */

import { getDocument, setDocument, updateDocument, addToCollection, queryCollection } from "./firebase/firestore.js";
import { readRegistrar } from "./spire-registrar.js";
import { resolveTier, stampPriority } from "./genesis-registrar.js";
import { getTick } from "./schumann-oracle.js";
import * as SC from "./seal-crypto.js";

export { SEAL_LATTICES, MANIFOLDS } from "./seal-crypto.js";

/** Mint a new minor tome owned by `uid`. */
export async function mintMinorTome(uid, params = {}, label = "") {
  const reg = await readRegistrar(uid);
  if (!reg || !reg.cosmologicalId) throw new Error("Forge your Cosmological ID in the Registrar first.");
  let tier = "ACOLYTE";
  try { tier = await resolveTier(uid); } catch (_) {}
  const tick = await getTick();
  const { publicJwk, privateJwk } = await SC.generateSealKeypair();
  const sealId = await SC.sealIdFromPublic(publicJwk);
  const sv = await SC.deriveSealVector(reg.cosmologicalId, params, tick.token);
  const createdAt = new Date().toISOString();
  const cleanParams = JSON.parse(SC.canonicalParams(params));

  // owner-only doc — holds the private key
  await setDocument(`users/${uid}/minorTomes/${sealId}`, {
    sealId, label: label || "Minor Tome", params: cleanParams,
    sealVector: sv.vector64, coords: sv.coords, entropy: sv.entropy,
    tickToken: tick.token, tick, genesisId: reg.cosmologicalId, ownerUid: uid,
    tier, priority: stampPriority(tier), status: "active", createdAt,
    publicJwk, privateJwk,
  });
  // public mirror — verification surface, NO private key
  await setDocument(`seals/${sealId}`, {
    sealId, ownerUid: uid, genesisId: reg.cosmologicalId, tier,
    sealVector: sv.vector64, coords: sv.coords, params: cleanParams,
    tickToken: tick.token, tick, publicJwk, status: "active",
    label: label || "Minor Tome", createdAt,
  });
  await addToCollection("chronicles", { kind: "minor-tome.mint", uid, sealId, genesisId: reg.cosmologicalId, tickToken: tick.token });

  return { sealId, label: label || "Minor Tome", params: cleanParams, sealVector: sv.vector64, coords: sv.coords, entropy: sv.entropy, tick, tier, status: "active", createdAt };
}

/** List the caller's own minor tomes (private key stripped for safety). */
export async function listMinorTomes(uid) {
  const rows = await queryCollection(`users/${uid}/minorTomes`, []);
  return rows.map(({ privateJwk, ...safe }) => safe)
             .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

async function setStatus(uid, sealId, status) {
  const tick = await getTick();
  await updateDocument(`users/${uid}/minorTomes/${sealId}`, { status });
  await updateDocument(`seals/${sealId}`, { status, recalledTick: tick.token });
  await addToCollection("chronicles", { kind: `minor-tome.${status}`, uid, sealId, tickToken: tick.token });
  return { sealId, status };
}
/** Recall a minor tome — instantly invalidates every seal it signed. */
export const recallMinorTome  = (uid, sealId) => setStatus(uid, sealId, "recalled");
/** Archive a minor tome — retires it (also invalidates its seals). */
export const archiveMinorTome = (uid, sealId) => setStatus(uid, sealId, "archived");

/** Sign arbitrary content (lesson, document, anything) → an embeddable seal block. */
export async function signWithMinorTome(uid, sealId, contentText) {
  const m = await getDocument(`users/${uid}/minorTomes/${sealId}`);
  if (!m) throw new Error("Minor tome not found.");
  if (m.status !== "active") throw new Error(`This minor tome is ${m.status}; only active tomes can sign.`);
  const contentHash = await SC.sha256Hex(contentText);
  const sig = await SC.signPayload(m.privateJwk, SC.sealContentPayload({ sealId, sealVector: m.sealVector, contentHash, tickToken: m.tickToken }));
  return {
    format: "owl-seal/1", sealId, genesisId: m.genesisId, ownerUid: uid,
    sealVector: m.sealVector, tickToken: m.tickToken, contentHash, sig,
    signedAt: new Date().toISOString(),
  };
}

/** Verify a seal block: signature + registry status. Traces back to the owner. */
export async function verifySealBlock(block) {
  if (!block || !block.sealId || !block.sig) return { valid: false, reason: "malformed seal block" };
  const seal = await getDocument(`seals/${block.sealId}`);
  if (!seal) return { valid: false, reason: "unknown seal — no registry entry" };
  if (seal.status !== "active")
    return { valid: false, status: seal.status, genesisId: seal.genesisId, ownerUid: seal.ownerUid,
             reason: `seal ${seal.status} — validity has been recalled` };
  if (block.sealVector !== seal.sealVector) return { valid: false, reason: "seal-vector mismatch" };
  const ok = await SC.verifyPayload(
    seal.publicJwk,
    SC.sealContentPayload({ sealId: block.sealId, sealVector: seal.sealVector, contentHash: block.contentHash, tickToken: block.tickToken }),
    block.sig
  );
  return {
    valid: ok, status: seal.status, genesisId: seal.genesisId, ownerUid: seal.ownerUid,
    tier: seal.tier, label: seal.label, sealVector: seal.sealVector,
    reason: ok ? "verified" : "signature invalid",
  };
}

/** Optional stronger check: confirm the seal AND that it signs this exact content. */
export async function verifySealAgainstContent(block, contentText) {
  const base = await verifySealBlock(block);
  if (!base.valid) return base;
  const h = await SC.sha256Hex(contentText);
  const contentMatch = h === block.contentHash;
  return { ...base, valid: base.valid && contentMatch, contentMatch, reason: contentMatch ? base.reason : "content does not match seal" };
}
