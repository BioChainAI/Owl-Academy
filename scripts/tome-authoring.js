/**
 * Tome Authoring Module
 * ----------------------
 * CRUD for tomes and artifacts. Stamps every created item with the
 * author's tier-derived priority (canonical / validated / experimental).
 */

import { db } from "./firebase/config.js";
import {
  collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { readRegistrar } from "./spire-registrar.js";
import { canAuthorOnPlane, stampPriority, TIERS } from "./genesis-registrar.js";

// ─── Tome Operations ──────────────────────────────────────────────────

export async function createTome(uid, tomeData) {
  const reg = await readRegistrar(uid);
  if (!reg) throw new Error("Registrar not found.");

  const plane = tomeData.plane || `dept-${tomeData.dept}`;
  if (!canAuthorOnPlane(reg, plane)) {
    throw new Error(`Your Genesis certificate does not authorize authorship on ${plane}.`);
  }

  const tier = reg.tier || "ACOLYTE";
  const payload = {
    title: tomeData.title,
    description: tomeData.description || "",
    body: tomeData.body || "",
    dept: tomeData.dept,
    plane,
    status: tomeData.status || "manuscript",  // "active" | "manuscript" | "sealed"
    creatorUid: uid,
    creatorGenesisId: reg.cosmologicalId,
    creatorTier: tier,
    priority: stampPriority(tier),
    certificateHash: reg.certificate ? reg.certificate.signature.slice(0, 16) : null,
    enrolledCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, "tomes"), payload);
  return { id: ref.id, ...payload };
}

export async function updateTome(uid, tomeId, updates) {
  const ref = doc(db, "tomes", tomeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Tome not found.");
  if (snap.data().creatorUid !== uid) throw new Error("Only the creator can edit this tome.");
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
  return { id: tomeId, ...snap.data(), ...updates };
}

export async function deleteTome(uid, tomeId) {
  const ref = doc(db, "tomes", tomeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Tome not found.");
  if (snap.data().creatorUid !== uid) throw new Error("Only the creator can delete this tome.");
  await deleteDoc(ref);
}

export async function listMyTomes(uid) {
  const q = query(
    collection(db, "tomes"),
    where("creatorUid", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listTomesByPlane(plane) {
  const q = query(
    collection(db, "tomes"),
    where("plane", "==", plane),
    orderBy("priority"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Artifact Operations ──────────────────────────────────────────────

export async function createArtifact(uid, artifactData) {
  const reg = await readRegistrar(uid);
  if (!reg) throw new Error("Registrar not found.");
  const tier = reg.tier || "ACOLYTE";
  if (tier === "ACOLYTE") throw new Error("Acolytes cannot mint artifacts.");

  const plane = artifactData.plane || `dept-${artifactData.dept}`;
  if (!canAuthorOnPlane(reg, plane)) {
    throw new Error(`Your Genesis certificate does not authorize authorship on ${plane}.`);
  }

  const payload = {
    name: artifactData.name,
    description: artifactData.description || "",
    domain: artifactData.domain,
    dept: artifactData.dept,
    plane,
    requiredTomes: artifactData.requiredTomes || [],
    creatorUid: uid,
    creatorGenesisId: reg.cosmologicalId,
    creatorTier: tier,
    priority: stampPriority(tier),
    createdAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, "artifacts"), payload);
  return { id: ref.id, ...payload };
}

export async function listArtifactsByPlane(plane) {
  const q = query(collection(db, "artifacts"), where("plane", "==", plane));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Helpers ──────────────────────────────────────────────────────────

export const PRIORITY_LABELS = {
  canonical:    { label: "Canonical",    color: "#D4AF37", desc: "Archon-sealed; absolute consensus" },
  validated:    { label: "Validated",    color: "#00d4ff", desc: "Instructor-signed; XP-eligible" },
  experimental: { label: "Experimental", color: "#e81cff", desc: "Biostrata-layer; XP-neutral" }
};

export const DEPARTMENT_PLANES = [
  { plane: "dept-I",    name: "Sacred Geometry & Topology", color: "#D4AF37" },
  { plane: "dept-II",   name: "Cryptography & Sigils",       color: "#a855f7" },
  { plane: "dept-III",  name: "Celestial Topology",          color: "#3b82f6" },
  { plane: "dept-IV",   name: "Hyperbolic Systems",          color: "#f43f5e" },
  { plane: "dept-V",    name: "Fractal Processing",          color: "#10b981" },
  { plane: "dept-VI",   name: "Seed Protocols",              color: "#f59e0b" },
  { plane: "dept-VII",  name: "Human Consciousness",         color: "#a855f7" },
  { plane: "dept-VIII", name: "Soul-Mind Projection",        color: "#14b8a6" },
  { plane: "dept-IX",   name: "AI-Human Integration",        color: "#3b82f6" },
  { plane: "dept-X",    name: "BioChain Substrate",          color: "#00ff88" },
  { plane: "custom",    name: "Custom Parallel Plane",       color: "#e81cff" }
];
