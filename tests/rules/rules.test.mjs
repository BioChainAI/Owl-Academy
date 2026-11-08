// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// firestore.rules in the Firestore emulator. From tests/:
//   npm ci && npm run test:rules        (Java 21; firebase emulators:exec starts and stops the emulator)
//
// The steps of tests/rules/client-requests.json run in file order against one database, starting empty, each with
// its expected verdict: the requests Owl's client makes are allowed, and the same documents are refused to another
// account and to a signed-out visitor. setDocument, updateDocument and addToCollection send what the helpers of
// scripts/firebase/firestore.js send (merge, updatedAt, createdAt). Without the emulator (FIRESTORE_EMULATOR_HOST
// unset) the test is skipped, or fails when OWL_RULES_REQUIRED=1 (CI).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { problems, steps } from "./requests.mjs";

const here = (p) => new URL(p, import.meta.url);
const PROJECT = "demo-owl-rules";            // a demo- project: the emulator never reaches a real one

const host = process.env.FIRESTORE_EMULATOR_HOST;

if (!host) {
  test("Firestore rules: client requests", { skip: process.env.OWL_RULES_REQUIRED === "1" ? false : "no Firestore emulator (cd tests && npm ci && npm run test:rules)" }, () => {
    assert.fail("OWL_RULES_REQUIRED=1 but FIRESTORE_EMULATOR_HOST is not set: run under firebase emulators:exec");
  });
} else {
  const { initializeTestEnvironment, assertFails, assertSucceeds } = await import("@firebase/rules-unit-testing");
  const { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } = await import("firebase/firestore");

  const request = (db, { method, path, data }) => {
    switch (method) {
      case "setDocument": return setDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() }, { merge: true });
      case "updateDocument": return updateDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() });
      case "addToCollection": return setDoc(doc(db, path), { ...data, createdAt: serverTimestamp() });
      case "get": return getDoc(doc(db, path));
      case "list": return getDocs(collection(db, path));
      case "delete": return deleteDoc(doc(db, path));
      default: throw new Error(`unknown method ${method}`);
    }
  };

  test("Firestore rules: client requests", async (t) => {
    assert.deepEqual(problems(), [], "tests/rules/client-requests.json is well formed");
    const [h, port] = [host.slice(0, host.lastIndexOf(":")), Number(host.slice(host.lastIndexOf(":") + 1))];
    const env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: { rules: readFileSync(here("../../firestore.rules"), "utf8"), host: h.replace(/^\[|\]$/g, ""), port },
    });
    try {
      await env.clearFirestore();
      const dbFor = (uid) => (uid === null ? env.unauthenticatedContext() : env.authenticatedContext(uid)).firestore();
      for (const { group, step } of steps()) {
        await t.test(`${group.id}: ${step.name} (${step.expect})`, async () => {
          await (step.expect === "allow" ? assertSucceeds : assertFails)(request(dbFor(step.as), step));
        });
      }
    } finally {
      await env.cleanup();
    }
  });
}
