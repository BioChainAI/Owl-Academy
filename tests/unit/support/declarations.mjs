// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// The top-level declarations of one of Owl's browser ES modules, read from its source text: for each declared name,
// the text V8 keeps for it (Function.prototype.toString, for functions, arrow functions and classes) or its value
// (for other constants), with a SHA-256 of that text. Used by tests/unit/biomesh-core.test.mjs to check that the
// functions moved from scripts/biomesh.js to scripts/biomesh-core.js kept their text.
//
// The source is evaluated without its imports: import and export-from statements are removed, the imported names
// become parameters bound to undefined, and "export " is dropped from declarations. Only the declarations run, so a
// module whose top level does more than declare (calls a function, reads a global) is refused.
//
//   node tests/unit/support/declarations.mjs <file.js>     prints the declarations as JSON (name: { kind, sha256 })
//
// tests/unit/fixtures/biomesh-7f45f35.json was written from `git show 7f45f35:scripts/biomesh.js` with
// declarations(), table() and exportNames(); the unit test rebuilds it from git history when the commit is present.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const sha256 = (s) => createHash("sha256").update(typeof s === "string" ? Buffer.from(s, "utf8") : s).digest("hex");

const IDENT = "[A-Za-z_$][\\w$]*";
const IMPORT = /^import\s+(?!["'])([\s\S]*?)\s*from\s*(["'])([^"']+)\2\s*;?[ \t]*$/gm;
const IMPORT_BARE = /^import\s*(["'])([^"']+)\1\s*;?[ \t]*$/gm;
const EXPORT_FROM = /^export\s+(?:\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s*from\s*(["'])[^"']+\1\s*;?[ \t]*$/gm;

/**
 * The import statements of a module, in source order: [{ names, from, text }], names being the local bindings (empty
 * for a bare `import "./x.js";`, which binds nothing but still loads the module).
 */
export function imports(src) {
  const out = [];
  for (const m of src.matchAll(IMPORT_BARE)) out.push({ names: [], from: m[2], text: m[0], at: m.index });
  for (const m of src.matchAll(IMPORT)) {
    const clause = m[1].trim(), names = [];
    for (const part of splitTop(clause)) {
      const p = part.trim();
      if (!p) continue;
      let ns = new RegExp(`^\\*\\s*as\\s+(${IDENT})$`).exec(p);
      if (ns) { names.push(ns[1]); continue; }
      if (p.startsWith("{")) {
        for (const spec of p.slice(1, p.lastIndexOf("}")).split(",")) {
          const s = spec.trim();
          if (!s) continue;
          const as = new RegExp(`^(${IDENT})(?:\\s+as\\s+(${IDENT}))?$`).exec(s);
          if (!as) throw new Error(`cannot read import specifier "${s}"`);
          names.push(as[2] || as[1]);
        }
        continue;
      }
      if (new RegExp(`^${IDENT}$`).test(p)) { names.push(p); continue; }
      throw new Error(`cannot read import clause "${clause}"`);
    }
    out.push({ names, from: m[3], text: m[0], at: m.index });
  }
  return out.sort((a, b) => a.at - b.at).map(({ at, ...rest }) => rest);
}

// "a, { b, c }" -> ["a", "{ b, c }"]: commas outside braces
function splitTop(s) {
  const parts = []; let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") depth--;
    else if (s[i] === "," && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
  }
  parts.push(s.slice(start));
  return parts;
}

// The other declarators of a one-line `const a = 1, b = 2;` statement: names after a comma at bracket depth 0,
// outside strings, template literals and regular expression literals.
function laterDeclarators(line) {
  const names = [];
  let depth = 0, i = line.indexOf("=") + 1, prev = "=";
  while (i > 0 && i < line.length) {
    const c = line[i];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < line.length && line[j] !== c) j += line[j] === "\\" ? 2 : 1;
      i = j + 1; prev = c; continue;
    }
    if (c === "/" && line[i + 1] === "/") break;                       // a line comment
    if (c === "/" && "(,=:[!&|?{};".includes(prev)) {                 // a regular expression literal
      let j = i + 1, cls = false;
      while (j < line.length) {
        if (line[j] === "\\") { j += 2; continue; }
        if (line[j] === "[") cls = true; else if (line[j] === "]") cls = false; else if (line[j] === "/" && !cls) break;
        j++;
      }
      i = j + 1; prev = "/"; continue;
    }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === "," && depth === 0) {
      const m = new RegExp(`^,\\s*(${IDENT})\\s*=`).exec(line.slice(i));
      if (m) names.push(m[1]);
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return names;
}

/** The names declared at the top level (column 0) of a module, in source order. */
export function declaredNames(src) {
  const names = [];
  for (const line of src.split("\n")) {
    const l = line.replace(/^export\s+/, "");
    let m = new RegExp(`^(?:async\\s+)?function\\s*\\*?\\s*(${IDENT})\\s*\\(`).exec(l)
      || new RegExp(`^class\\s+(${IDENT})`).exec(l);
    if (m) { names.push(m[1]); continue; }
    m = new RegExp(`^(?:const|let|var)\\s+(${IDENT})\\s*=`).exec(l);
    if (m) {
      names.push(m[1]);
      if (/;\s*(\/\/.*)?$/.test(l)) names.push(...laterDeclarators(l));
    }
  }
  return names;
}

function describe(value) {
  if (typeof value === "function") {
    const text = Function.prototype.toString.call(value);
    return { kind: text.startsWith("class") ? "class" : "function", text };
  }
  const text = typeof value === "bigint" ? `${value}n`
    : JSON.stringify(value, (k, v) => (typeof v === "bigint" ? `${v}n` : typeof v === "function" ? `[function ${v.name}]` : v));
  return { kind: "value", text: String(text) };
}

/**
 * Evaluate a module's declarations without its imports. Returns a Map name -> { kind, text, sha256 }, in source
 * order, with an `imported` property listing its import statements ({ names, from }).
 */
export function declarations(src) {
  const imp = imports(src);
  if (/^export\s+default\b/m.test(src)) throw new Error("export default is not supported");
  let body = src.replace(IMPORT, "").replace(IMPORT_BARE, "").replace(EXPORT_FROM, "");
  if (/^\s*(import|export)\s*[{*]/m.test(body)) throw new Error("an import or export statement was not recognised");
  body = body.replace(/^export\s+(?=(?:async\s+)?function\b|class\b|const\b|let\b|var\b)/gm, "");
  const names = declaredNames(body);
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) throw new Error(`${dup} is declared twice`);
  const params = imp.flatMap((x) => x.names);
  // the module's top level, strict as a module is; it returns its declarations by name
  const make = new Function(...params, `"use strict";\n${body}\n;return { ${names.join(", ")} };`);
  const values = make(...params.map(() => undefined));
  const out = new Map();
  for (const n of names) {
    const d = describe(values[n]);
    out.set(n, { ...d, sha256: sha256(d.text) });
  }
  out.imported = imp.map(({ names: ns, from }) => ({ names: ns, from }));
  return out;
}

/** The names a module exports from its own declarations (`export function|const|let|class name`), in order. */
export const exportNames = (src) =>
  [...src.matchAll(new RegExp(`^export\\s+(?:async\\s+)?(?:function\\s*\\*?|const|let|class)\\s+(${IDENT})`, "gm"))].map((m) => m[1]);

/** { name: { kind, sha256 } } for a fixture or a report. */
export const table = (decls) => Object.fromEntries([...decls].map(([n, d]) => [n, { kind: d.kind, sha256: d.sha256 }]));

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const file = process.argv[2];
  if (!file) { console.error("usage: node tests/unit/support/declarations.mjs <file.js>"); process.exit(2); }
  console.log(JSON.stringify(table(declarations(readFileSync(file, "utf8"))), null, 1));
}
