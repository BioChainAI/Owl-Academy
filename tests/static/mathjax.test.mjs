// Every page that loads MathJax pins an exact version and turns on its safe mode (ui/safe),
// which filters the links, classes, ids and styles TeX can create. Pages typeset text that
// comes from records and loaded files (cartridges, ontologies, lessons), so TeX markup is
// shared input too.
// Run from the repository root: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.OWL_TEST_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function htmlFiles() {
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (name === ".git" || name === "node_modules") continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.html?$/.test(name)) out.push(p);
    }
  })(ROOT);
  return out;
}

test("pages that load MathJax pin its version and load ui/safe first", () => {
  const problems = [];
  let pages = 0;
  for (const p of htmlFiles()) {
    const html = readFileSync(p, "utf8");
    const tags = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']*\/mathjax@[^"']*)["'][^>]*>/gi)];
    if (!tags.length) continue;
    pages++;
    const rel = relative(ROOT, p);
    for (const t of tags) {
      if (!/\/mathjax@\d+\.\d+\.\d+\//.test(t[1])) problems.push(`${rel}: MathJax URL is not pinned to an exact version: ${t[1]}`);
      // The configuration must come before the script tag and load ui/safe.
      const before = html.slice(0, t.index);
      const cfgAt = before.search(/(?:window\.)?MathJax\s*=\s*\{[\s\S]*$/);
      const cfg = cfgAt < 0 ? "" : before.slice(cfgAt);
      if (!/loader\s*:\s*\{\s*load\s*:\s*\[[^\]]*['"]ui\/safe['"]/.test(cfg)) problems.push(`${rel}: the MathJax configuration before the MathJax script does not load 'ui/safe'`);
    }
  }
  assert.ok(pages > 0, "expected pages that load MathJax");
  assert.deepEqual(problems, []);
});
