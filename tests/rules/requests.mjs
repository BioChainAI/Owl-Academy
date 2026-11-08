// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// tests/rules/client-requests.json, read and checked: the steps in order, and problems() listing anything malformed.
// Used by tests/rules/rules.test.mjs (in the Firestore emulator) and tests/unit/rules-requests.test.mjs (offline).
import { readFileSync } from "node:fs";

export const FILE = JSON.parse(readFileSync(new URL("./client-requests.json", import.meta.url), "utf8"));

/** The methods a step can use. The first three are the helpers of scripts/firebase/firestore.js. */
export const METHODS = {
  setDocument: "doc", updateDocument: "doc", addToCollection: "doc", get: "doc", delete: "doc", list: "collection",
};
const WRITES = new Set(["setDocument", "updateDocument", "addToCollection"]);

/** [{ group, step }] in file order. */
export const steps = (file = FILE) => file.groups.flatMap((group) => group.steps.map((step) => ({ group, step })));

/** Problems with a cases file, as text; empty when it is well formed. */
export function problems(file = FILE) {
  const out = [];
  if (file.format !== "owl-rules/1") out.push(`format is ${file.format}, not owl-rules/1`);
  const accounts = new Set(Object.keys(file.accounts || {}));
  const ids = new Set();
  for (const { group, step } of steps(file)) {
    const at = `${group.id}/${step.id}`;
    if (ids.has(step.id)) out.push(`${at}: id used twice`);
    ids.add(step.id);
    if (!step.name) out.push(`${at}: no name`);
    if (step.as !== null && !accounts.has(step.as)) out.push(`${at}: as "${step.as}" is not an account (or null, signed out)`);
    if (step.expect !== "allow" && step.expect !== "deny") out.push(`${at}: expect is "${step.expect}"`);
    const kind = METHODS[step.method];
    if (!kind) { out.push(`${at}: unknown method "${step.method}"`); continue; }
    const segments = String(step.path || "").split("/");
    if (segments.some((s) => !s)) out.push(`${at}: path "${step.path}"`);
    else if ((segments.length % 2 === 0) !== (kind === "doc")) out.push(`${at}: ${step.method} needs a ${kind} path, not "${step.path}"`);
    if (WRITES.has(step.method) !== (step.data !== undefined)) out.push(`${at}: data goes with setDocument, updateDocument and addToCollection only`);
    if (step.expect === "allow" && !/^scripts\/[\w./-]+\.js [A-Za-z_$][\w$]*$/.test(step.client || "")) out.push(`${at}: an allowed step names the client function that makes it ("scripts/<file>.js <function>")`);
    if (step.expect === "deny" && step.client) out.push(`${at}: a refused step names no client function`);
  }
  return out;
}
