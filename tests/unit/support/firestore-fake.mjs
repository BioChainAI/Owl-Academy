// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// An in-memory, read-only Firestore for unit tests of scripts/firebase/firestore.js and the services built on it.
// Call stubFirebase() (./firebase-stub.mjs) first, then installFirestoreFake(docs) with documents keyed by path
// ("biochains/BC-…"); the stubbed SDK functions call the fake while it is installed. It has what the Biomesh reads
// use: doc, collection, query, where ("==" and "in"), orderBy (one field or documentId(), ascending), startAfter,
// limit, getDoc, getDocs and onSnapshot. Like Firestore, startAfter with documentId() order takes only a plain
// document id. Writes are not supported: they throw as the stub does.
const DOC_ID = Object.freeze({ documentId: true });
const clone = (v) => structuredClone(v);

export function installFirestoreFake(docs) {
  const reads = [];
  const snapOf = (path) => {
    const d = docs[path];
    return { id: path.split("/").pop(), exists: () => d !== undefined, data: () => (d === undefined ? undefined : clone(d)) };
  };
  const fake = {
    doc: (_db, ...segs) => ({ path: segs.join("/") }),
    collection: (_db, ...segs) => ({ path: segs.join("/") }),
    query: (ref, ...cs) => ({ path: ref.path, cs }),
    where: (field, op, value) => ({ t: "where", field, op, value }),
    orderBy: (field, dir = "asc") => ({ t: "orderBy", field, dir }),
    documentId: () => DOC_ID,
    startAfter: (v) => ({ t: "startAfter", v }),
    limit: (n) => ({ t: "limit", n }),
    getDoc: async (ref) => { reads.push({ op: "get", path: ref.path }); return snapOf(ref.path); },
    onSnapshot: (ref, cb) => { reads.push({ op: "watch", path: ref.path }); cb(snapOf(ref.path)); return () => {}; },
    getDocs: async (q) => {
      reads.push({ op: "query", path: q.path, cs: q.cs });
      const depth = q.path.split("/").length + 1;
      let rows = Object.keys(docs).filter((k) => k.startsWith(q.path + "/") && k.split("/").length === depth)
        .map((k) => ({ id: k.split("/").pop(), d: docs[k] }));
      for (const c of q.cs.filter((c) => c.t === "where")) {
        if (c.op === "==") rows = rows.filter((r) => r.d[c.field] === c.value);
        else if (c.op === "in") rows = rows.filter((r) => c.value.includes(r.d[c.field]));
        else throw new Error(`firestore-fake: where op ${c.op}`);
      }
      const ob = q.cs.filter((c) => c.t === "orderBy");
      if (ob.length > 1 || ob.some((o) => o.dir !== "asc")) throw new Error("firestore-fake: one ascending orderBy");
      const key = (r) => (ob[0].field === DOC_ID ? r.id : r.d[ob[0].field]);
      if (ob.length) rows = rows.filter((r) => key(r) !== undefined).sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
      const sa = q.cs.find((c) => c.t === "startAfter");
      if (sa) {
        if (!ob.length) throw new Error("firestore-fake: startAfter needs orderBy");
        if (ob[0].field === DOC_ID && (typeof sa.v !== "string" || sa.v.includes("/")))
          throw new Error("Invalid query. When querying a collection and ordering by documentId(), the value passed to startAfter() must be a plain document ID");
        rows = rows.filter((r) => key(r) > sa.v);
      }
      const lim = q.cs.find((c) => c.t === "limit");
      if (lim) rows = rows.slice(0, lim.n);
      return { docs: rows.map((r) => ({ id: r.id, data: () => clone(r.d) })) };
    },
  };
  globalThis.__owlFirebaseFake = fake;
  return { reads, uninstall: () => { if (globalThis.__owlFirebaseFake === fake) delete globalThis.__owlFirebaseFake; } };
}
