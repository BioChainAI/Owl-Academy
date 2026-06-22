/**
 * Major Tome — the centralized, immutable Owl Academy canon.
 * ----------------------------------------------------------------------------
 * Major tomes are locked by default. A student REQUESTS access (signing the
 * request with their minor tome); an Instructor/Archon GRANTS it by signing
 * OVER the student's request signature with their own minor tome. The grant is
 * therefore a genuine 2-of-2 combination, immutably recording the instructor as
 * the issuer who signed it off.
 */

import { getDocument, addToCollection, updateDocument, queryCollection, where } from "./firebase/firestore.js";
import { readRegistrar } from "./spire-registrar.js";
import { resolveTier } from "./genesis-registrar.js";
import { getTick } from "./schumann-oracle.js";
import * as SC from "./seal-crypto.js";

// ─── Canon (Archon-only, immutable) ────────────────────────────────────────
export async function createMajorTome(uid, data = {}) {
  const tier = await resolveTier(uid);
  if (tier !== "ARCHON") throw new Error("Only Archons may inscribe a Major Tome into the immutable canon.");
  if (!data.title) throw new Error("A Major Tome needs a title.");
  const reg = await readRegistrar(uid);
  const payload = {
    title: data.title, summary: data.summary || "", plane: data.plane || "custom",
    dept: data.dept || null, requiredTier: data.requiredTier || "ACOLYTE",
    lockSpec: data.lockSpec || { kind: "instructor-grant" },
    creatorUid: uid, creatorGenesisId: reg ? reg.cosmologicalId : null,
    immutable: true, status: "canon",
  };
  const ref = await addToCollection("majorTomes", payload);
  await addToCollection("chronicles", { kind: "major-tome.inscribe", uid, majorTomeId: ref.id, title: data.title });
  return { id: ref.id, ...payload };
}

export const listMajorTomes = () => queryCollection("majorTomes", []);

// ─── Request → Combine → Unlock ─────────────────────────────────────────────
export async function requestUnlock(uid, majorTomeId, studentSealId) {
  const m = await getDocument(`users/${uid}/minorTomes/${studentSealId}`);
  if (!m || m.status !== "active") throw new Error("Select one of your active minor tomes to sign the request.");
  const studentSig = await SC.signPayload(m.privateJwk, SC.unlockRequestPayload({ majorTomeId, studentSealId, tickToken: m.tickToken }));
  const ref = await addToCollection("unlockRequests", {
    majorTomeId, studentUid: uid, studentSealId, studentGenesisId: m.genesisId,
    studentSig, tickToken: m.tickToken, status: "pending",
  });
  await addToCollection("chronicles", { kind: "unlock.request", uid, majorTomeId, requestId: ref.id });
  return { id: ref.id, majorTomeId, status: "pending" };
}

export const listPendingRequests = () => queryCollection("unlockRequests", [where("status", "==", "pending")]);
export const listMyRequests = (uid) => queryCollection("unlockRequests", [where("studentUid", "==", uid)]);

/** Instructor/Archon combines the two seals and signs the unlock off. */
export async function grantUnlock(uid, requestId, instructorSealId) {
  const tier = await resolveTier(uid);
  if (tier !== "INSTRUCTOR" && tier !== "ARCHON") throw new Error("Only Instructors or Archons may unlock Major Tomes.");

  const req = await getDocument(`unlockRequests/${requestId}`);
  if (!req) throw new Error("Unlock request not found.");
  if (req.status !== "pending") throw new Error(`Request already ${req.status}.`);

  // 1) verify the student's request signature against their public seal
  const studentSeal = await getDocument(`seals/${req.studentSealId}`);
  if (!studentSeal) throw new Error("Student seal missing from the registry.");
  const reqOk = await SC.verifyPayload(
    studentSeal.publicJwk,
    SC.unlockRequestPayload({ majorTomeId: req.majorTomeId, studentSealId: req.studentSealId, tickToken: req.tickToken }),
    req.studentSig
  );
  if (!reqOk) throw new Error("Student request signature failed verification — refusing to combine.");

  // 2) instructor signs OVER the student signature → 2-of-2
  const instr = await getDocument(`users/${uid}/minorTomes/${instructorSealId}`);
  if (!instr || instr.status !== "active") throw new Error("Select one of your active minor tomes to sign off.");
  const grantSig = await SC.signPayload(
    instr.privateJwk,
    SC.unlockGrantPayload({ majorTomeId: req.majorTomeId, studentSealId: req.studentSealId, studentSig: req.studentSig, tickToken: req.tickToken })
  );
  const tick = await getTick();

  const ref = await addToCollection("tomeUnlocks", {
    majorTomeId: req.majorTomeId, studentUid: req.studentUid, studentSealId: req.studentSealId, studentSig: req.studentSig,
    issuerUid: uid, issuerSealId: instructorSealId, issuerGenesisId: instr.genesisId, issuerTier: tier,
    grantSig, tickToken: req.tickToken, grantTick: tick.token, status: "granted",
  });
  await updateDocument(`unlockRequests/${requestId}`, { status: "granted", resolvedBy: uid, resolvedAt: new Date().toISOString(), grantId: ref.id });
  await addToCollection("chronicles", { kind: "unlock.grant", uid, majorTomeId: req.majorTomeId, studentUid: req.studentUid, grantId: ref.id });
  return { id: ref.id, majorTomeId: req.majorTomeId, studentUid: req.studentUid, issuerGenesisId: instr.genesisId };
}

/** Re-verify a grant's combined signatures against the public seal registry. */
export async function verifyUnlockGrant(grant) {
  const s = await getDocument(`seals/${grant.studentSealId}`);
  const i = await getDocument(`seals/${grant.issuerSealId}`);
  if (!s || !i) return { valid: false, reason: "seal(s) missing from registry" };
  const v = await SC.verifyUnlock({
    studentPubJwk: s.publicJwk, instructorPubJwk: i.publicJwk,
    majorTomeId: grant.majorTomeId, studentSealId: grant.studentSealId,
    tickToken: grant.tickToken, studentSig: grant.studentSig, grantSig: grant.grantSig,
  });
  return { ...v, issuerGenesisId: i.genesisId, issuerTier: grant.issuerTier, studentGenesisId: s.genesisId, sealStatus: { student: s.status, issuer: i.status } };
}

/** Is `majorTomeId` unlocked for `studentUid`? (single-field query → no composite index) */
export async function isUnlockedFor(majorTomeId, studentUid) {
  const grants = await queryCollection("tomeUnlocks", [where("studentUid", "==", studentUid)]);
  const g = grants.find((x) => x.majorTomeId === majorTomeId && x.status === "granted");
  if (!g) return { unlocked: false };
  const verification = await verifyUnlockGrant(g);
  return { unlocked: verification.valid, grant: g, verification };
}

export const listGrantsByIssuer = (uid) => queryCollection("tomeUnlocks", [where("issuerUid", "==", uid)]);
export const listGrantsForStudent = (uid) => queryCollection("tomeUnlocks", [where("studentUid", "==", uid)]);
