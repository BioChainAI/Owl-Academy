// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// tests/rules/client-requests.json, offline (no emulator): the file is well formed; every allowed step names the
// client function that makes it, and that function writes or reads the step's collection and uses every field the
// step sends; every function of scripts/biomesh.js and scripts/minor-tome.js that writes to Firestore has an allowed
// step; and every collection the client writes refuses a signed-out visitor. Run from the repository root:
//   node --test tests/unit/rules-requests.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { problems, steps } from "../rules/requests.mjs";

const ROOT = resolve(process.env.OWL_TEST_ROOT || fileURLToPath(new URL("../..", import.meta.url)));
const source = (rel) => readFileSync(join(ROOT, rel), "utf8");
const all = steps();

// Top-level functions of a browser module, by name: from the declaration line to the next line at column 0 that
// starts another declaration or a comment.
const DECL = /^(?:export\s+)?(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(|const\s+([A-Za-z_$][\w$]*)\s*=)/;
const STOP = /^(?:export\b|import\b|function\b|async\b|const\b|let\b|var\b|class\b|\/\/|\/\*)/;
function functions(src) {
  const lines = src.split("\n"), out = new Map();
  lines.forEach((line, i) => {
    const m = DECL.exec(line);
    if (!m) return;
    let end = i + 1;
    while (end < lines.length && !STOP.test(lines[end])) end++;
    out.set(m[1] || m[2], lines.slice(i, end).join("\n"));
  });
  return out;
}
const collectionOf = (path) => { const s = path.split("/"); return s[s.length - (s.length % 2 === 0 ? 2 : 1)]; };
const WRITES_FIRESTORE = /\b(?:setDocument|updateDocument|addToCollection)\s*\(/;

test("client-requests.json is well formed", () => {
  assert.deepEqual(problems(), []);
  assert.ok(all.some(({ step }) => step.expect === "allow") && all.some(({ step }) => step.expect === "deny"));
});

test("each allowed step is a request its client function makes", () => {
  const cache = new Map();
  for (const { step } of all.filter(({ step }) => step.expect === "allow")) {
    const [file, name] = step.client.split(" ");
    if (!cache.has(file)) cache.set(file, functions(source(file)));
    const text = cache.get(file).get(name);
    assert.ok(text, `${step.id}: ${file} declares ${name}`);
    assert.ok(text.includes(collectionOf(step.path)), `${step.id}: ${name} uses ${collectionOf(step.path)}`);
    for (const key of Object.keys(step.data || {})) {
      assert.match(text, new RegExp(`\\b${key}\\b`), `${step.id}: ${name} sends the field ${key}`);
    }
  }
});

test("every function of biomesh.js and minor-tome.js that writes to Firestore has an allowed step", () => {
  const named = new Set(all.filter(({ step }) => step.expect === "allow").map(({ step }) => step.client));
  const writers = [];
  for (const file of ["scripts/biomesh.js", "scripts/minor-tome.js"]) {
    for (const [name, text] of functions(source(file))) if (WRITES_FIRESTORE.test(text)) writers.push(`${file} ${name}`);
  }
  assert.ok(writers.length >= 10, "the scan finds the client's writers");
  assert.deepEqual(writers.filter((w) => !named.has(w)), [], "writers without an allowed step");
});

test("every collection the client writes refuses a signed-out visitor", () => {
  const written = new Set(all.filter(({ step }) => step.expect === "allow" && step.data).map(({ step }) => collectionOf(step.path)));
  const refused = new Set(all.filter(({ step }) => step.expect === "deny" && step.as === null).map(({ step }) => collectionOf(step.path)));
  assert.deepEqual([...written].filter((c) => !refused.has(c)), []);
});
