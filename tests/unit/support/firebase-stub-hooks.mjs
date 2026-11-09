// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Module loader hooks (node:module register) that let Node import the pages' modules: each Firebase SDK URL
// (https://www.gstatic.com/firebasejs/<version>/<module>.js) loads a stub that exports the names Owl imports from
// it. The stubs only let the module graph link: initializeApp, getAuth, getFirestore and getStorage return empty
// objects (scripts/firebase/config.js calls them at load), and every other export throws when called, so a unit
// test that reaches Firestore fails loudly instead of touching a network. A test that wants an in-memory Firestore
// installs one as globalThis.__owlFirebaseFake (./firestore-fake.mjs); while it is installed, each export the fake
// defines calls it instead of throwing. Register with stubFirebase() from ./firebase-stub.mjs.
const PREFIX = "https://www.gstatic.com/firebasejs/";
let modules = {};

export async function initialize(data) {
  modules = (data && data.modules) || {};
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith(PREFIX)) return { url: specifier, format: "module", shortCircuit: true };
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (!url.startsWith(PREFIX)) return next(url, context);
  const names = modules[url];
  if (!names) throw new Error(`no stub for ${url}: no file under scripts/ imports it`);
  const lines = names.map((n) => (/^(initializeApp|getAuth|getFirestore|getStorage)$/.test(n)
    ? `export const ${n} = () => Object.freeze({ stub: ${JSON.stringify(n)} });`
    : `export const ${n} = (...args) => { const fake = globalThis.__owlFirebaseFake; ` +
      `if (fake && typeof fake[${JSON.stringify(n)}] === "function") return fake[${JSON.stringify(n)}](...args); ` +
      `throw new Error(${JSON.stringify(`${n} (Firebase) is not available in unit tests`)}); };`));
  return { format: "module", source: lines.join("\n") + "\n", shortCircuit: true };
}
