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
  startAfter,
  documentId,
  getDocs,
  onSnapshot,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Splits "users/uid/profile/main" into path segments for doc()
const toRef = (path) => doc(db, ...path.split("/"));

// A document as a plain object: its fields, with `id` set to the document id. A field
// named "id" in the data does not replace the document id.
const asRow = (snap) => ({ ...snap.data(), id: snap.id });

export const getDocument = async (path) => {
  const snap = await getDoc(toRef(path));
  return snap.exists() ? asRow(snap) : null;
};

export const setDocument = (path, data) =>
  setDoc(toRef(path), { ...data, updatedAt: serverTimestamp() }, { merge: true });

export const updateDocument = (path, data) =>
  updateDoc(toRef(path), { ...data, updatedAt: serverTimestamp() });

export const addToCollection = (collectionPath, data) =>
  addDoc(collection(db, collectionPath), { ...data, createdAt: serverTimestamp() });

// The documents a query returns as { id, data } pairs: the document id from the
// snapshot, beside the fields (for callers that page by document id).
export const queryDocuments = async (collectionPath, constraints = []) => {
  const ref = collection(db, collectionPath);
  const q = query(ref, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
};

export const queryCollection = async (collectionPath, constraints = []) =>
  (await queryDocuments(collectionPath, constraints)).map(({ id, data }) => ({ ...data, id }));

export const watchDocument = (path, callback) =>
  onSnapshot(toRef(path), (snap) =>
    callback(snap.exists() ? asRow(snap) : null)
  );

// Re-export Firestore constraint helpers so services don't import from the SDK directly
export { where, orderBy, limit, startAfter, documentId, increment };
