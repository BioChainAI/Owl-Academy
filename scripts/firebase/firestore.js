import { db } from "./config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Splits "users/uid/profile/main" into path segments for doc()
const toRef = (path) => doc(db, ...path.split("/"));

export const getDocument = async (path) => {
  const snap = await getDoc(toRef(path));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const setDocument = (path, data) =>
  setDoc(toRef(path), { ...data, updatedAt: serverTimestamp() }, { merge: true });

export const updateDocument = (path, data) =>
  updateDoc(toRef(path), { ...data, updatedAt: serverTimestamp() });

export const addToCollection = (collectionPath, data) =>
  addDoc(collection(db, collectionPath), { ...data, createdAt: serverTimestamp() });

export const queryCollection = async (collectionPath, constraints = []) => {
  const ref = collection(db, collectionPath);
  const q = query(ref, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const watchDocument = (path, callback) =>
  onSnapshot(toRef(path), (snap) =>
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  );

// Re-export Firestore constraint helpers so services don't import from the SDK directly
export { where, orderBy, limit, increment };
