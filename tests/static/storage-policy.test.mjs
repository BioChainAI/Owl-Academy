// Browser-storage policy for Owl Academy. Run from the repository root: node --test "tests/**/*.test.mjs"
//
// The site shares its origin with other apps, so Owl code must never wipe the
// whole of localStorage/sessionStorage, and every key Owl writes must be listed in
// scripts/auth-logout.js (removed on logout, or kept as saved work).
//
// OWL_TEST_ROOT=<dir> runs the checks against another checkout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.env.OWL_TEST_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CODE = /\.(html?|js|mjs|cjs|ts|tsx|jsx)$/i;
const SKIP_DIRS = new Set(["node_modules", ".git", "tests"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (CODE.test(name)) out.push(p);
  }
  return out;
}
const FILES = walk(ROOT).map((p) => ({ path: relative(ROOT, p), src: readFileSync(p, "utf8") }));

function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
}

test("no code clears the whole of localStorage or sessionStorage", () => {
  const re = /\b(?:local|session)Storage\s*(?:\.\s*clear|\[\s*["'`]clear["'`]\s*\])\s*\(/g;
  const hits = [];
  for (const { path, src } of FILES) {
    for (const m of src.matchAll(re)) hits.push(`${path}:${lineOf(src, m.index)}: ${m[0]}`);
  }
  assert.deepEqual(hits, [], "remove only your own keys (see scripts/auth-logout.js):\n" + hits.join("\n"));
});

// Resolve the key argument of a setItem call to a literal (or a literal prefix).
function resolveKey(arg, src) {
  arg = arg.trim();
  let m = /^(["'])((?:\\.|(?!\1).)*)\1$/.exec(arg);
  if (m) return { key: m[2], prefix: false };
  m = /^(["'])((?:\\.|(?!\1).)*)\1\s*\+/.exec(arg);            // 'tut_idx_' + ...
  if (m) return { key: m[2], prefix: true };
  m = /^`([^`$]*)\$\{/.exec(arg);                                // `owl.x.${id}`
  if (m) return { key: m[1], prefix: true };
  m = /^`([^`$]*)`$/.exec(arg);
  if (m) return { key: m[1], prefix: false };
  if (/^[A-Za-z_$][\w$]*$/.test(arg)) {                          // a constant defined in the same file
    const def = new RegExp(`(?:^|[^\\w$.])${arg.replace(/\$/g, "\\$")}\\s*=\\s*([^,;\\n]+)`, "m").exec(src);
    if (def) return resolveKey(def[1], src);
  }
  return null;
}

async function logoutLists() {
  const mod = await import(pathToFileURL(join(ROOT, "scripts", "auth-logout.js")).href);
  return mod;
}

// Keys that predate the "owl." prefix rule. Any other key must start with "owl.".
const GRANDFATHERED = new Set([
  "owlAcademy_codex", "owl_hub_tab", "owl_academy_session_token", "owl_academy_tomes",
  "engram_mind_eye_v1", "tut_idx_",
]);

test("every storage key Owl writes is listed in scripts/auth-logout.js", async () => {
  const { OWL_LOCAL_KEYS, OWL_KEPT_KEYS, OWL_SESSION_PREFIXES } = await logoutLists();
  const listedLocal = new Set([...OWL_LOCAL_KEYS, ...OWL_KEPT_KEYS]);
  const re = /\b(local|session)Storage\s*\.\s*setItem\s*\(\s*([^,]+?)\s*,/g;
  const problems = [];
  let seen = 0;
  for (const { path, src } of FILES) {
    for (const m of src.matchAll(re)) {
      seen++;
      const where = `${path}:${lineOf(src, m.index)}`;
      const k = resolveKey(m[2], src);
      if (!k) { problems.push(`${where}: key ${m[2]} is not a literal or a constant in this file`); continue; }
      const ok = m[1] === "local"
        ? (!k.prefix && listedLocal.has(k.key))
        : OWL_SESSION_PREFIXES.some((p) => k.key.startsWith(p));
      if (!ok) problems.push(`${where}: ${m[1]}Storage key "${k.key}${k.prefix ? "…" : ""}" is not listed in scripts/auth-logout.js`);
    }
  }
  assert.ok(seen > 0, "expected to find setItem calls");
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("new storage keys use the owl. prefix", async () => {
  const { OWL_LOCAL_KEYS, OWL_KEPT_KEYS, OWL_SESSION_PREFIXES } = await logoutLists();
  const bad = [...OWL_LOCAL_KEYS, ...OWL_KEPT_KEYS, ...OWL_SESSION_PREFIXES]
    .filter((k) => !k.startsWith("owl.") && !GRANDFATHERED.has(k));
  assert.deepEqual(bad, []);
});

// A Map-backed stand-in for window.localStorage / sessionStorage.
function fakeStorage(entries) {
  const m = new Map(Object.entries(entries));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    keys: () => [...m.keys()].sort(),
  };
}

test("logout removes Owl's keys and keeps saved work and other apps' data", async () => {
  const { removeOwlStorage, OWL_LOCAL_KEYS, OWL_KEPT_KEYS } = await logoutLists();
  const others = {
    "ebayednoob-github-settings": "{}", "engram-minds-eye/session": "{}",
    "hyperbolic-lexicon/state": "{}", "glh-theme": "dark", "unrelated": "1",
  };
  const local = fakeStorage({
    ...others,
    ...Object.fromEntries(OWL_LOCAL_KEYS.map((k) => [k, "x"])),
    ...Object.fromEntries(OWL_KEPT_KEYS.map((k) => [k, "saved"])),
  });
  const session = fakeStorage({ "tut_idx_Seal Forge": "3", "tut_idx_Codex": "1", "other-app/tab": "2" });
  const removed = removeOwlStorage(local, session);
  assert.deepEqual(local.keys(), [...Object.keys(others), ...OWL_KEPT_KEYS].sort());
  assert.deepEqual(session.keys(), ["other-app/tab"]);
  assert.equal(removed.length, OWL_LOCAL_KEYS.length + 2);
  assert.ok(OWL_KEPT_KEYS.includes("engram_mind_eye_v1"));
});

test("logout cleanup survives storage that throws on access", async () => {
  const { removeOwlStorage } = await import("../../scripts/auth-logout.js");
  const saved = {};
  for (const name of ["localStorage", "sessionStorage"]) {
    saved[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error("Access is denied for this document"); } });
  }
  try {
    assert.deepEqual(removeOwlStorage(), []);
  } finally {
    for (const name of ["localStorage", "sessionStorage"]) {
      if (saved[name]) Object.defineProperty(globalThis, name, saved[name]); else delete globalThis[name];
    }
  }
});
