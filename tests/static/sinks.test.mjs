// Static check: HTML built from templates must escape every interpolated value.
// Run from the repository root: node --test "tests/**/*.test.mjs"
//
// Scope (listFiles): the pages that render Firestore records, other users' data or
// files a user loads -- every mage_tower page and script, index.html, login.html,
// Learning-Hub.html, Independent_Learning.html, Engram_Mind_Eye.html, everything under
// Proofs/, the Ontology Department import tools -- and every script under scripts/.
// In those files (inline scripts of HTML files):
//
//  1. Every template literal that contains an HTML tag, and every template that is
//     assigned to innerHTML/outerHTML or passed to insertAdjacentHTML/document.write,
//     may interpolate only:
//       - escapeHtml(...), escapeAttr(...) or jsArg(...) (scripts/ui/escape.js, or a
//         local definition that passes the behaviour check in this file);
//       - literals, or a ternary / || / + whose results are all literals or escaped;
//       - a nested template (checked by the same rule);
//       - a variable, followed to its own scope: every assignment there must be one of
//         the above. A function parameter is followed to the calls of that function in
//         the same file, and each argument passed for it must be one of the above;
//       - a call to a function of the same file whose every return value is one of the
//         above;
//       - markup by naming convention, for code this file cannot follow: a call to an
//         imported render*(...), *Html(...) or *Svg(...), or a property named html,
//         *Html or *Svg.
//  2. Inside an on*="..." attribute only jsArg(...) (or a literal) may be interpolated.
//  3. A value that starts an href/src/action/formaction/poster attribute must go
//     through safeUrl(...) (and an escaper).
//  4. Values concatenated with + into innerHTML/outerHTML/insertAdjacentHTML follow 1.
//
// SVG geometry builders whose templates interpolate only numbers computed in the
// function and constant colours are listed in SVG_BUILDERS and skipped. Values that are
// constants, numbers or reviewed markup are listed with the reason in
// tests/static/sinks-reviewed.json (file -> expression -> reason); an entry that no
// longer matches anything fails the test, so the list stays current.
//
// OWL_TEST_ROOT=<dir> runs the check against another checkout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.OWL_TEST_ROOT || join(HERE, "..", "..");
const REVIEWED = JSON.parse(readFileSync(join(HERE, "sinks-reviewed.json"), "utf8"));
const REVIEWED_USED = new Set();   // "file\0call:name" entries used while checking

const ESCAPERS = new Set(["escapeHtml", "escapeAttr", "jsArg"]);
const URL_ATTRS = new Set(["href", "src", "action", "formaction", "poster", "xlink:href"]);
const MARKUP_NAME = /^(html|[\w$]*Html|[\w$]*HTML|[\w$]*Svg|[\w$]*SVG)$/;
const MARKUP_CALL = /^(render[A-Z][\w$]*|[\w$]*Html|[\w$]*HTML|[\w$]*Svg|[\w$]*SVG)$/;
// A template counts as HTML when its static text contains one of these tags.
const TAGS = "a|abbr|article|aside|audio|b|blockquote|br|button|canvas|caption|circle|code|col|dd|defs|details|div|dl|dt|" +
  "ellipse|em|figcaption|figure|footer|form|g|h[1-6]|header|hr|i|iframe|img|input|kbd|label|li|line|link|main|mark|" +
  "meta|nav|ol|optgroup|option|p|path|picture|polygon|polyline|pre|rect|script|section|select|small|source|span|" +
  "strong|style|sub|summary|sup|svg|table|tbody|td|text|textarea|textPath|tfoot|th|thead|time|tr|tspan|u|ul|use|video";
const HTML_TAG = new RegExp(`<\\/?(?:${TAGS})(?=[\\s>/])|<!--`, "i");

// file -> function names whose bodies are numeric SVG geometry (reviewed).
const SVG_BUILDERS = {
  "scripts/sigil-renderer.js": ["generateManifoldSVG", "renderUserSigil", "renderSealSigil"],
  "scripts/tome-procgen.js": ["hilbertLayer", "manifoldLayer", "sigilLayer", "renderTomeSVG"],
  "scripts/spire-registrar.js": ["renderSigil"],
  "scripts/genesis-registrar.js": ["tierRingOverlay"],
};

// ---------------------------------------------------------------- files

// Pages and scripts that render records, other users' data or loaded files.
const SCOPE_FILES = [
  "index.html", "login.html", "Learning-Hub.html",
  "Library/Community & Research/Independent_Learning.html",
  "Library/Experimental_Systems/Engram_Mind_Eye.html",
  "Library/Ontology Department/Root_Ontology_Creator.html",
  "Library/Ontology Department/Lexicons/Lexicon_Creator.html",
  "Library/Ontology Department/Lexicons/Holographic_Geometry/Holographic_Geometry.html",
];
const SCOPE_DIRS = ["mage_tower", "Proofs", "scripts"];

function listFiles() {
  const out = [];
  for (const f of SCOPE_FILES) if (existsSync(join(ROOT, f))) out.push(join(ROOT, f));
  for (const d of SCOPE_DIRS) {
    if (!existsSync(join(ROOT, d))) continue;
    (function walk(dir) {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(m?js|html)$/.test(name)) out.push(p);
      }
    })(join(ROOT, d));
  }
  return out.sort();
}

// Inline <script> blocks of an HTML file, with their offset in the file.
function scriptsOf(path, text) {
  if (!path.endsWith(".html")) return [{ code: text, offset: 0 }];
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const m of text.matchAll(re)) {
    const attrs = m[1];
    if (/\btype\s*=\s*["']?(importmap|application\/json|text\/template|text\/x-)/i.test(attrs)) continue;
    if (!m[2].trim()) continue;
    out.push({ code: m[2], offset: m.index + m[0].indexOf(">") + 1 });
  }
  return out;
}

// ---------------------------------------------------------------- JS scanner
// Finds template literals (with nesting) while skipping strings, comments and regexes.

const REGEX_AFTER_WORD = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
  "throw", "case", "do", "else", "yield", "await"]);

function prevSignificant(src, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  if (j < 0) return { ch: "", word: "" };
  if (/[\w$]/.test(src[j])) {
    let k = j;
    while (k >= 0 && /[\w$]/.test(src[k])) k--;
    return { ch: src[j], word: src.slice(k + 1, j + 1) };
  }
  return { ch: src[j], word: "" };
}

function regexAllowed(src, i) {
  const { ch, word } = prevSignificant(src, i);
  if (!ch) return true;
  if (word) return REGEX_AFTER_WORD.has(word);
  return !/[)\]}\w$]/.test(ch);
}

function skipString(src, i) {           // src[i] is ' or "
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === "\\") { j++; continue; }
    if (src[j] === q || src[j] === "\n") return j + 1;
  }
  return src.length;
}

function skipRegex(src, i) {            // src[i] is /
  let inClass = false;
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") { j++; continue; }
    if (c === "\n") return j;
    if (inClass) { if (c === "]") inClass = false; continue; }
    if (c === "[") inClass = true;
    else if (c === "/") { j++; while (j < src.length && /[a-z]/i.test(src[j])) j++; return j; }
  }
  return src.length;
}

// Scan code from i until an unmatched closer `stop` (or end). Returns {end, templates}.
function scanCode(src, i, stop) {
  const templates = [];
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { const n = src.indexOf("\n", i); i = n < 0 ? src.length : n; continue; }
    if (c === "/" && src[i + 1] === "*") { const n = src.indexOf("*/", i + 2); i = n < 0 ? src.length : n + 2; continue; }
    if (c === "'" || c === '"') { i = skipString(src, i); continue; }
    if (c === "`") { const t = scanTemplate(src, i); templates.push(t); i = t.end; continue; }
    if (c === "/" && regexAllowed(src, i)) { i = skipRegex(src, i); continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0 && c === stop) return { end: i, templates };
      depth--;
    }
    i++;
  }
  return { end: i, templates };
}

// src[i] is `. Returns {start, end, quasis: [text...], exprs: [{text, start, end, templates}]}.
function scanTemplate(src, i) {
  const t = { start: i, quasis: [], exprs: [] };
  let j = i + 1, buf = "";
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") { buf += src.slice(j, j + 2); j += 2; continue; }
    if (c === "`") { t.quasis.push(buf); t.end = j + 1; return t; }
    if (c === "$" && src[j + 1] === "{") {
      t.quasis.push(buf); buf = "";
      const r = scanCode(src, j + 2, "}");
      t.exprs.push({ text: src.slice(j + 2, r.end), start: j + 2, end: r.end, templates: r.templates });
      j = r.end + 1;
      continue;
    }
    buf += c; j++;
  }
  t.quasis.push(buf); t.end = src.length;
  return t;
}

// ---------------------------------------------------------------- expression helpers

// Split at top-level occurrences of the given operators (strings, templates, brackets skipped).
function topSplit(text, ops) {
  const parts = [];
  let depth = 0, last = 0, i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"') { i = skipString(text, i); continue; }
    if (c === "`") { i = scanTemplate(text, i).end; continue; }
    if (c === "/" && text[i + 1] === "/") { const n = text.indexOf("\n", i); i = n < 0 ? text.length : n; continue; }
    if (c === "/" && text[i + 1] === "*") { const n = text.indexOf("*/", i + 2); i = n < 0 ? text.length : n + 2; continue; }
    if (c === "/" && regexAllowed(text, i)) { i = skipRegex(text, i); continue; }
    if ("([{".includes(c)) { depth++; i++; continue; }
    if (")]}".includes(c)) { depth--; i++; continue; }
    if (depth === 0) {
      const op = ops.find((o) => text.startsWith(o, i));
      if (op && !(op === "+" && (text[i + 1] === "+" || text[i + 1] === "=" || text[i - 1] === "+"))
             && !(op === "?" && (text[i + 1] === "." || text[i + 1] === "?" || text[i - 1] === "?"))
             && !(op === "," && false)) {
        parts.push(text.slice(last, i)); i += op.length; last = i; continue;
      }
    }
    i++;
  }
  parts.push(text.slice(last));
  return parts;
}

// Top-level ternary: returns [cond, a, b] or null.
function splitTernary(text) {
  let depth = 0, q = -1, nest = 0, i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"') { i = skipString(text, i); continue; }
    if (c === "`") { i = scanTemplate(text, i).end; continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (depth === 0 && c === "?" && text[i + 1] !== "." && text[i + 1] !== "?" && text[i - 1] !== "?") {
      if (q < 0) q = i; else nest++;
    } else if (depth === 0 && c === ":" && q >= 0) {
      if (nest === 0) return [text.slice(0, q), text.slice(q + 1, i), text.slice(i + 1)];
      nest--;
    }
    i++;
  }
  return null;
}

function stripParens(t) {
  t = t.trim();
  while (t.startsWith("(") && t.endsWith(")")) {
    const r = scanCode(t, 1, ")");
    if (r.end !== t.length - 1) break;
    t = t.slice(1, -1).trim();
  }
  return t;
}

// "name(...)" covering the whole text -> name (possibly dotted), else null.
function wholeCall(t) {
  const m = /^([A-Za-z_$][\w$]*(?:\s*\??\.\s*[A-Za-z_$][\w$]*)*)\s*\(/.exec(t);
  if (!m) return null;
  const r = scanCode(t, m[0].length, ")");
  return r.end === t.length - 1 ? m[1].replace(/\s/g, "") : null;
}

// "list.map(x => BODY).join(sep)" (optionally with filter/slice/reverse before map) -> BODY, else null.
function mapJoin(t) {
  const m = /\.join\s*\(/g;
  let last = null;
  for (const x of t.matchAll(m)) last = x;
  if (!last || scanCode(t, last.index + last[0].length, ")").end !== t.length - 1) return null;
  const head = t.slice(0, last.index);
  const mm = /\.map\s*\(/g;
  let mapAt = null;
  for (const x of head.matchAll(mm)) mapAt = x;
  if (!mapAt || scanCode(head, mapAt.index + mapAt[0].length, ")").end !== head.length - 1) return null;
  const arg = head.slice(mapAt.index + mapAt[0].length, head.length - 1).trim();
  const arrow = /^(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*/.exec(arg);
  if (!arrow) return /^[A-Za-z_$][\w$]*$/.test(arg) ? arg + "()" : null;   // .map(fnName)
  const body = arg.slice(arrow[0].length).trim();
  return body.startsWith("{") ? null : body;
}

const isLiteral = (t) =>
  /^(["'])(?:\\.|(?!\1)[^\\\n])*\1$/.test(t) || /^-?\d+(\.\d+)?$/.test(t) ||
  /^(true|false|null|undefined)$/.test(t) || /^`[^`$]*`$/.test(t);

// ---------------------------------------------------------------- code structure
// Bracket pairs (including ${ } of templates), arrow positions and `function` keywords.

function structure(src) {
  const pairs = [];
  const stack = [];
  const arrows = [];
  const fnKw = [];
  const modes = ["code"];
  const mask = new Uint8Array(src.length); // 1 where the character is code (not a string, comment or template text)
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (modes[modes.length - 1] !== "tpl") mask[i] = 1;
    if (modes[modes.length - 1] === "tpl") {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { modes.pop(); i++; continue; }
      if (c === "$" && src[i + 1] === "{") { stack.push({ open: i + 1, kind: "${" }); modes.push("code"); i += 2; continue; }
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") { mask[i] = 0; const n = src.indexOf("\n", i); i = n < 0 ? src.length : n; continue; }
    if (c === "/" && src[i + 1] === "*") { mask[i] = 0; const n = src.indexOf("*/", i + 2); i = n < 0 ? src.length : n + 2; continue; }
    if (c === "'" || c === '"') { mask[i] = 0; i = skipString(src, i); continue; }
    if (c === "`") { mask[i] = 0; modes.push("tpl"); i++; continue; }
    if (c === "/" && regexAllowed(src, i)) { mask[i] = 0; i = skipRegex(src, i); continue; }
    if (c === "(" || c === "[" || c === "{") { stack.push({ open: i, kind: c }); i++; continue; }
    if (c === ")" || c === "]" || c === "}") {
      const top = stack.pop();
      if (top) {
        pairs.push({ open: top.open, close: i, kind: top.kind });
        if (top.kind === "${") modes.pop();
      }
      i++;
      continue;
    }
    if (c === "=" && src[i + 1] === ">") { arrows.push(i); i += 2; continue; }
    if (/[A-Za-z_$]/.test(c) && !/[\w$]/.test(src[i - 1] || "")) {
      const w = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 64))[0];
      if (w === "function" && src[i - 1] !== ".") fnKw.push(i);
      mask.fill(1, i, i + w.length);
      i += w.length;
      continue;
    }
    i++;
  }
  const closeOf = new Map(pairs.map((p) => [p.open, p.close]));
  const openOf = new Map(pairs.map((p) => [p.close, p.open]));
  return { pairs, arrows, fnKw, closeOf, openOf, mask };
}

// Binding names in a parameter list or destructuring pattern.
function bindingNames(text) {
  const names = [];
  for (const part of topSplit(text, [","])) {
    let t = part.trim().replace(/^\.\.\./, "");
    const eq = topSplit(t, ["="]).filter((x, k, a) => !(k > 0 && a[k - 1].endsWith("=")));
    t = (eq[0] || "").trim();
    if (!t) continue;
    if (/^[{[]/.test(t)) {
      // {a, b: c, d = 1} / [a, b]: the bound names are those not followed by ":"
      for (const m of t.slice(1, -1).matchAll(/([A-Za-z_$][\w$]*)\s*(?=[,}\]=]|$)/g)) names.push(m[1]);
    } else if (/^[A-Za-z_$][\w$]*$/.test(t)) names.push(t);
  }
  return names;
}

// Functions of a script: name (if any), params, the range their parameters are bound in, and their body.
function functionsOf(code, S) {
  const fns = [];
  const nameBefore = (at) => {
    const m = /(?:\b(?:const|let|var)\s+|^|[,;{}\s])([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?$/.exec(code.slice(Math.max(0, at - 80), at));
    return m ? m[1] : null;
  };
  for (const k of S.fnKw) {
    const m = /^function\s*\*?\s*([A-Za-z_$][\w$]*)?\s*\(/.exec(code.slice(k, k + 120));
    if (!m) continue;
    const pOpen = k + m[0].length - 1;
    const pClose = S.closeOf.get(pOpen);
    if (pClose === undefined) continue;
    const bOpen = code.indexOf("{", pClose);
    const bClose = S.closeOf.get(bOpen);
    if (bClose === undefined) continue;
    fns.push({ name: m[1] || nameBefore(k), declared: !!m[1], at: k, params: bindingNames(code.slice(pOpen + 1, pClose)),
      scope: [pOpen, bClose], body: [bOpen, bClose], expr: null });
  }
  for (const a of S.arrows) {
    let j = a - 1;
    while (j >= 0 && /\s/.test(code[j])) j--;
    let params, pStart;
    if (code[j] === ")") {
      const o = S.openOf.get(j);
      if (o === undefined) continue;
      params = bindingNames(code.slice(o + 1, j));
      pStart = o;
    } else {
      const m = /([A-Za-z_$][\w$]*)$/.exec(code.slice(Math.max(0, j - 63), j + 1));
      if (!m) continue;
      params = [m[1]];
      pStart = j - m[1].length + 1;
    }
    let b = a + 2;
    while (b < code.length && /\s/.test(code[b])) b++;
    let body, expr = null;
    if (code[b] === "{") {
      const c = S.closeOf.get(b);
      if (c === undefined) continue;
      body = [b, c];
    } else {
      const text = statementRhs(code, b);
      body = [b, b + text.length];
      expr = { text, at: b };
    }
    const head = code.slice(Math.max(0, pStart - 7), pStart);
    const nameAt = /async\s*$/.test(head) ? pStart - head.length + head.search(/async\s*$/) : pStart;
    fns.push({ name: nameBefore(nameAt), declared: false, at: pStart, params, scope: [pStart, body[1]], body, expr });
  }
  return fns;
}

// `return` expressions of a function body, not looking into nested functions.
function returnsOf(code, S, fn, fns) {
  if (fn.expr) return [fn.expr];
  const nested = fns.filter((g) => g !== fn && g.scope[0] > fn.body[0] && g.scope[1] <= fn.body[1]);
  const out = [];
  for (const m of code.slice(fn.body[0], fn.body[1]).matchAll(/(?<![\w$.])return\b/g)) {
    const at = fn.body[0] + m.index;
    if (nested.some((g) => at > g.scope[0] && at < g.scope[1])) continue;
    if (!S.mask[at]) continue;
    const start = at + 6;
    out.push({ text: statementRhs(code, start), at: start });
  }
  return out;
}

// ---------------------------------------------------------------- the checker

const norm = (t) => t.replace(/\s+/g, " ").trim();

// Returns [{ file, line, expr, msg }] for one file.
function checkFile(relPath, text) {
  const findings = [];
  const local = checkLocalEscapers(relPath, text);
  findings.push(...local.findings);
  const fileEscapers = local.ok;
  for (const { code, offset } of scriptsOf(relPath, text)) {
    const lineAt = (i) => text.slice(0, offset + i).split("\n").length;
    const report = (i, expr, msg) => findings.push({ file: relPath, line: lineAt(i), expr: norm(expr), msg });

    const skipRanges = [];
    for (const fn of SVG_BUILDERS[relPath] || []) {
      const m = new RegExp(`function\\s+${fn}\\s*\\(`).exec(code);
      if (!m) { report(0, fn, `SVG_BUILDERS lists ${fn}, which is not defined here`); continue; }
      const open = code.indexOf("{", scanCode(code, m.index + m[0].length, ")").end);
      skipRanges.push([open, scanCode(code, open + 1, "}").end]);
    }
    const skipped = (i) => skipRanges.some(([a, b]) => i >= a && i <= b);

    const top = scanCode(code, 0, null).templates;
    const all = [];
    (function flat(list) { for (const t of list) { all.push(t); for (const e of t.exprs) flat(e.templates); } })(top);

    const S = structure(code);
    const fns = functionsOf(code, S);
    const named = new Map();
    for (const f of fns) if (f.name && !named.has(f.name)) named.set(f.name, f);
    const checked = new Set();
    const tracing = new Set();
    const escapers = new Set([...ESCAPERS, ...fileEscapers]);
    // ALL_CAPS constants with a literal initializer (tables of labels, colours, limits).
    const consts = new Set();
    for (const m of code.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*(?:Object\.freeze\(\s*)?[[{"'`\d-]/g)) if (S.mask[m.index]) consts.add(m[1]);
    // ALL_CAPS constants imported from a module of this repository that exports them with a literal initializer.
    for (const m of code.matchAll(/\bimport\s*\{([^}]*)\}\s*from\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      let dep = "";
      try { dep = readFileSync(join(ROOT, dirname(relPath), m[2]), "utf8"); } catch { continue; }
      for (const n of m[1].split(",").map((x) => x.trim().split(/\s+as\s+/).pop()).filter((x) => /^[A-Z][A-Z0-9_]*$/.test(x))) {
        if (new RegExp(`\\bexport\\s+const\\s+${n}\\s*=\\s*(?:Object\\.freeze\\(\\s*)?[[{"'\`\\d-]`).test(dep)) consts.add(n);
      }
    }

    // The innermost bracket pair of the given kinds around position i.
    function around(i, kinds) {
      let best = null;
      for (const p of S.pairs) {
        if (p.open < i && i < p.close && kinds.includes(p.kind) && (!best || p.close - p.open < best.close - best.open)) best = p;
      }
      return best;
    }

    // Where `name` (used at position at) is bound: { kind: "param", fn, index } | { kind: "let", range } |
    // { kind: "unsafe" } (destructured, loop or catch variable) | { kind: "global" }.
    function bindingOf(name, at) {
      const cands = [];
      for (const f of fns) {
        const k = f.params.indexOf(name);
        if (k < 0 || f.scope[0] > at || at > f.scope[1]) continue;
        // A callback of an array method: its index argument is a number, and its element argument comes from the
        // receiver (a constant table is safe).
        const cb = !f.name && /([A-Za-z_$][\w$]*|\))\s*\??\.\s*(map|forEach|filter|flatMap|some|every|find|findIndex|reduce)\s*\(\s*(?:async\s*)?$/.exec(code.slice(Math.max(0, f.at - 120), f.at));
        if (cb) {
          const indexAt = cb[2] === "reduce" ? 2 : 1;
          if (k === indexAt) { cands.push({ kind: "number", range: f.scope }); continue; }
          let recv = cb[1];
          if (recv === ")") {
            const close = Math.max(0, f.at - 120) + cb.index;
            const o = S.openOf.get(close);
            const head = o !== undefined ? code.slice(Math.max(0, o - 40), o) : "";
            const om = /Object\s*\.\s*(?:entries|keys|values)\s*$/.test(head) && o !== undefined ? /^\(\s*([A-Z][A-Z0-9_]*)\s*\)$/.exec(code.slice(o, close + 1)) : null;
            recv = om ? om[1] : null;
          }
          if (recv && consts.has(recv) && k !== indexAt && (cb[2] !== "reduce" || k === 1)) { cands.push({ kind: "const", range: f.scope }); continue; }
        }
        cands.push({ kind: "param", fn: f, index: k, range: f.scope });
      }
      const esc = name.replace(/\$/g, "\\$");
      for (const m of code.matchAll(new RegExp(`\\b(const|let|var)\\s+(?:${esc}(?![\\w$])|([{[][^;=]*?(?<![\\w$.])${esc}(?![\\w$])[^;=]*?[}\\]])\\s*=)`, "g"))) {
        if (!S.mask[m.index]) continue;
        let range;
        if (m[1] === "var") {
          const f = fns.filter((g) => g.body[0] < m.index && m.index < g.body[1]).sort((a, b) => (a.body[1] - a.body[0]) - (b.body[1] - b.body[0]))[0];
          range = f ? f.body : [0, code.length];
        } else {
          const p = around(m.index, ["{", "("]);
          if (p && p.kind === "(" && /\bfor\s*$/.test(code.slice(Math.max(0, p.open - 8), p.open))) {
            let b = p.close + 1;
            while (b < code.length && /\s/.test(code[b])) b++;
            range = [p.open, code[b] === "{" ? S.closeOf.get(b) ?? code.length : b + statementRhs(code, b).length];
            // for (let i = 0; ...; i++): a counter
            const counter = new RegExp(`^\\(\\s*(?:let|var)\\s+${esc}\\s*=\\s*-?\\d+\\s*;`).test(code.slice(p.open, p.close));
            if (range[0] <= at && at <= range[1]) cands.push({ kind: counter ? "number" : "unsafe", range });
            continue;
          }
          const blk = around(m.index, ["{"]);
          range = blk ? [blk.open, blk.close] : [0, code.length];
        }
        if (range[0] <= at && at <= range[1]) cands.push(m[2] ? { kind: "unsafe", range } : { kind: "let", range });
      }
      for (const m of code.matchAll(new RegExp(`\\bcatch\\s*\\(\\s*${esc}\\s*\\)`, "g"))) {
        const blk = S.closeOf.get(code.indexOf("{", m.index + m[0].length));
        if (blk !== undefined && m.index <= at && at <= blk) cands.push({ kind: "unsafe", range: [m.index, blk] });
      }
      if (!cands.length) return { kind: "global", range: [0, code.length] };
      return cands.sort((a, b) => (a.range[1] - a.range[0]) - (b.range[1] - b.range[0]))[0];
    }

    // Assignments to a plain identifier within a range of this script.
    function assignmentsOf(name, range) {
      const out = [];
      const re = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}\\s*(\\+?=)(?![=>])`, "g");
      for (const m of code.matchAll(re)) {
        if (!S.mask[m.index] || m.index < range[0] || m.index > range[1]) continue;
        const start = m.index + m[0].length;
        out.push({ text: statementRhs(code, start), start });
      }
      return out;
    }

    // The position of `name` in the expression that starts at `at` (for scope lookups).
    function posOf(name, at) {
      const re = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`, "g");
      re.lastIndex = at;
      const m = re.exec(code);
      return m && m.index < at + 4000 ? m.index : at;
    }

    // Calls of a named function in this script: [{ args: [{text, at}], at }].
    function callsOf(fn) {
      const out = [];
      const re = new RegExp(`(?<![\\w$.])${fn.name.replace(/\$/g, "\\$")}\\s*\\(`, "g");
      for (const m of code.matchAll(re)) {
        if (!S.mask[m.index] || (m.index >= fn.at - 80 && m.index <= fn.scope[0])) continue; // the definition
        if (/\bfunction\s*$/.test(code.slice(Math.max(0, m.index - 12), m.index))) continue;
        const open = m.index + m[0].length;
        const r = scanCode(code, open, ")");
        const argsText = code.slice(open, r.end);
        const args = [];
        let cur = open;
        for (const a of topSplit(argsText, [","])) { args.push({ text: a, at: cur }); cur += a.length + 1; }
        out.push({ at: m.index, args });
      }
      return out;
    }

    // Is an identifier safe to put into HTML (in context ctx)?
    function safeIdent(t, ctx, at) {
      const use = posOf(t, at);
      const b = bindingOf(t, use);
      const key = `${t}@${b.kind}:${b.range?.[0]}`;
      if (tracing.has(key)) return true;
      tracing.add(key);
      try {
        if (b.kind === "unsafe") return false;
        if (b.kind === "number") return ctx !== "url";
        if (b.kind === "const") return true;
        if (b.kind === "param") {
          if (!b.fn.name) return false;                       // a callback: its arguments come from elsewhere
          const calls = callsOf(b.fn);
          if (!calls.length) return false;                     // no call here to check
          return calls.every((c) => {
            const a = c.args[b.index];
            if (!a || !a.text.trim()) return true;             // not passed: undefined
            if (/^\s*\.\.\./.test(a.text)) return false;
            checkTemplatesIn(a.text, a.at, ctx === "js" || ctx === "url" ? { mode: "text" } : { mode: "text" });
            return safeExpr(a.text, ctx, a.at);
          });
        }
        const defs = assignmentsOf(t, b.range);
        return defs.length > 0 && defs.every((d) => {
          checkTemplatesIn(d.text, d.start, { mode: "text" });
          return safeExpr(d.text, ctx, d.start);
        });
      } finally {
        tracing.delete(key);
      }
    }

    // A call of a function defined in this script: safe when every value it returns is.
    function safeLocalCall(fn, ctx) {
      const key = `fn@${fn.at}:${ctx}`;
      if (tracing.has(key)) return true;
      tracing.add(key);
      try {
        return returnsOf(code, S, fn, fns).every((r) => {
          checkTemplatesIn(r.text, r.at, { mode: "text" });
          return safeExpr(r.text, ctx, r.at);
        });
      } finally {
        tracing.delete(key);
      }
    }

    // A local array whose every element is safe: its assignments are array literals, `x.map(cb)` or
    // `await Promise.all(x.map(cb))` with safe callback results, and everything pushed into it is safe.
    function safeArray(name, ctx, at) {
      const b = bindingOf(name, posOf(name, at));
      if (b.kind !== "let" && b.kind !== "global") return false;
      const key = `arr:${name}@${b.range[0]}`;
      if (tracing.has(key)) return true;
      tracing.add(key);
      try {
        const defs = assignmentsOf(name, b.range);
        if (!defs.length) return false;
        for (const d of defs) {
          let rhs = stripParens(d.text).replace(/^await\s+Promise\.all\(\s*([\s\S]*)\)$/, "$1").trim();
          const lit = /^\[([\s\S]*)\]$/.exec(rhs);
          if (lit) { if (lit[1].trim() && !topSplit(lit[1], [","]).every((x) => { checkTemplatesIn(x, d.start, { mode: "text" }); return safeExpr(x, ctx, d.start); })) return false; continue; }
          const mm = /\.map\s*\(\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.exec(rhs);
          if (!mm) return false;
          const arrowAt = d.start + d.text.indexOf(rhs) + mm.index + mm[0].length - 2;
          const fn = fns.find((f) => f.body[0] > arrowAt && f.body[0] - arrowAt < 8);
          if (!fn || !safeLocalCall(fn, ctx)) return false;
        }
        const pushRe = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}\\s*\\.\\s*(?:push|unshift)\\s*\\(`, "g");
        for (const m of code.matchAll(pushRe)) {
          if (!S.mask[m.index] || m.index < b.range[0] || m.index > b.range[1]) continue;
          const open = m.index + m[0].length;
          const r = scanCode(code, open, ")");
          let cur = open;
          for (const a of topSplit(code.slice(open, r.end), [","])) {
            checkTemplatesIn(a, cur, { mode: "text" });
            if (!safeExpr(a, ctx, cur)) return false;
            cur += a.length + 1;
          }
        }
        return true;
      } finally {
        tracing.delete(key);
      }
    }

    // Is a non-template expression safe to put into HTML (in context ctx)?
    function safeExpr(text, ctx, at) {
      let t = stripParens(text);
      if (!t) return true;
      if (/^`/.test(t) && scanTemplate(t, 0).end === t.length) {
        return true;   // a template operand: its own interpolations are checked separately
      }
      if (isLiteral(t)) return ctx !== "url" || !/^["'`]\s*(javascript|data|vbscript):/i.test(t);
      const tern = splitTernary(t);
      if (tern) return safeExpr(tern[1], ctx, at) && safeExpr(tern[2], ctx, at);
      for (const op of ["||", "??"]) {
        const parts = topSplit(t, [op]);
        if (parts.length > 1) return parts.every((p) => safeExpr(p, ctx, at));
      }
      const and = topSplit(t, ["&&"]);
      if (and.length > 1) return safeExpr(and[and.length - 1], ctx, at);
      const plus = topSplit(t, ["+"]);
      if (plus.length > 1) return ctx !== "js" && ctx !== "url" ? plus.every((p) => safeExpr(p, ctx, at)) : false;
      const mapped = mapJoin(t);
      if (mapped !== null) return safeExpr(mapped, ctx, at);
      // Numbers: a count, arithmetic, Math/Number/parseInt results, toFixed.
      if (ctx !== "url") {
        if (/^[\w$.?()[\]]+\.(length|size)$/.test(t) && containsNoCall(t)) return true;
        if (/^\(?[\w$.?[\]]+\s*(\|\|\s*\[\s*\])?\)?\.length$/.test(t)) return true;
        if (topSplit(t, ["-", "*", "/", "%"]).length > 1 && !/^["'`]/.test(t)) return true;
        if (/^(Math\.[a-z]+|Number|parseInt|parseFloat)\s*\(/.test(t) && wholeCall(t)) return true;
        if (/\.toFixed\(\s*\d*\s*\)$/.test(t)) return true;
      }
      // A constant table: CONST.x, CONST[k], CONST[k]?.x
      if (/^([A-Z][A-Z0-9_]*)\b/.test(t) && consts.has(/^([A-Z][A-Z0-9_]*)/.exec(t)[1]) && /^[A-Z][A-Z0-9_]*(?:\??\.[A-Za-z_$][\w$]*|\??\.?\[[^\]]*\])*$/.test(t)) return ctx !== "url" || isLiteral(t);
      // [a, b].join(sep) and list.join(sep) for a local array of safe parts
      const aj = /^\[([\s\S]*)\]\s*\.join\(\s*(?:(["'`])[^"'`]*\2)?\s*\)$/.exec(t);
      if (aj) return topSplit(aj[1], [","]).every((x) => safeExpr(x, ctx, at));
      const nj = /^([A-Za-z_$][\w$]*)\.join\(\s*(?:(["'`])[^"'`]*\2)?\s*\)$/.exec(t);
      if (nj) return safeArray(nj[1], ctx, at);
      const call = wholeCall(t);
      if (call) {
        const last = call.split(".").pop();
        if (ctx === "js") return last === "jsArg";
        if (ctx === "url") return escapers.has(last) && /\bsafeUrl\s*\(/.test(t);
        if (escapers.has(last)) return true;
        if (!call.includes(".") && REVIEWED[relPath]?.[`call:${call}`] !== undefined) {   // a reviewed markup builder
          REVIEWED_USED.add(`${relPath}\u0000call:${call}`);
          return true;
        }
        if (last === "encodeURIComponent" && (ctx === "text" || ctx === "attr")) return true; // no < > " &
        const local = !call.includes(".") && named.get(call);
        if (local) return safeLocalCall(local, ctx);
        if (MARKUP_CALL.test(last)) return true;                 // imported markup builder (its file is checked)
        return /`/.test(t) && containsTemplate(t);   // e.g. list.map(x => `<li>…</li>`).join("")
      }
      if (/^[A-Za-z_$][\w$]*$/.test(t)) {
        if (consts.has(t) && bindingOf(t, posOf(t, at)).kind === "global") return ctx !== "url";
        if (ctx === "url") return false;
        if (ctx === "js") { const b = bindingOf(t, posOf(t, at)); return b.kind === "number" || (b.kind === "let" && safeIdent(t, ctx, at)); }
        return safeIdent(t, ctx, at);
      }
      if (ctx === "js" || ctx === "url") return false;
      const mem = /^([A-Za-z_$][\w$]*)(?:\??\.[A-Za-z_$][\w$]*|\??\.?\[[^\]]*\])+$/.exec(t);
      if (mem) {
        const base = mem[1];
        if (consts.has(base) || bindingOf(base, posOf(base, at)).kind === "const") return true;   // a field of a constant table
        return /^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)+$/.test(t) && MARKUP_NAME.test(t.split(".").pop());
      }
      return containsTemplate(t);   // e.g. arr.map(...).join("") built from templates
    }

    function containsTemplate(t) {
      return scanCode(t, 0, null).templates.length > 0;
    }
    function containsNoCall(t) {
      return !/\(/.test(t);
    }

    // Check every template literal inside an arbitrary expression text (at code offset base).
    function checkTemplatesIn(text, base, state) {
      for (const t of scanCode(text, 0, null).templates) {
        const real = all.find((x) => x.start === base + t.start);
        if (real) checkTemplate(real, state);
      }
    }

    // Walk a template's static text with a small HTML state machine.
    function advance(state, s) {
      let st = { ...state };
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (st.mode === "text") {
          if (c === "<" && s.startsWith("<!--", i)) { st = { mode: "comment" }; i += 3; }
          else if (c === "<" && /[A-Za-z/!]/.test(s[i + 1] || "")) st = { mode: "tag" };
        } else if (st.mode === "comment") {
          if (s.startsWith("-->", i)) { st = { mode: "text" }; i += 2; }
        } else if (st.mode === "tag") {
          if (c === ">") st = { mode: "text" };
          else if (c === "=") {
            const before = s.slice(0, i).match(/([\w:.-]+)\s*$/);
            const name = (before ? before[1] : st.lastName || "").toLowerCase();
            let k = i + 1; while (k < s.length && s[k] === " ") k++;
            if (s[k] === '"' || s[k] === "'") { st = { mode: "value", quote: s[k], name, empty: true }; i = k; }
            else st = { mode: "value", quote: null, name, empty: true };
          } else if (/[\w:.-]/.test(c)) {
            const m = /^[\w:.-]+/.exec(s.slice(i)); st.lastName = m[0]; i += m[0].length - 1;
          }
        } else if (st.mode === "value") {
          if (st.quote ? c === st.quote : /[\s>]/.test(c)) st = c === ">" ? { mode: "text" } : { mode: "tag" };
          else st.empty = false;
        }
      }
      return st;
    }

    function ctxOf(state) {
      if (state.mode === "value") {
        if (state.name.startsWith("on")) return "js";
        if (URL_ATTRS.has(state.name) && state.empty) return "url";
        return state.quote === '"' ? "attr" : state.quote ? "attr1" : "tag";
      }
      if (state.mode === "tag") return "tag";
      return "text";
    }

    function checkTemplate(t, initial) {
      if (checked.has(t.start) || skipped(t.start)) return;
      checked.add(t.start);
      let state = initial || { mode: "text" };
      t.exprs.forEach((e, k) => {
        state = advance(state, t.quasis[k]);
        let ctx = ctxOf(state);
        if (ctx === "tag") ctx = "js";   // unquoted/tag position: literals or jsArg only
        const expr = stripParens(e.text);
        const call = wholeCall(expr);
        const escapedWhole = call && ESCAPERS.has(call.split(".").pop());
        if (e.templates.length && !escapedWhole) {
          for (const nested of e.templates) checkTemplate(nested, state);
          // the parts of the expression around nested templates must be safe too
          const parts = splitTernary(expr);
          const outs = parts ? [parts[1], parts[2]] : [expr];
          for (const o of outs) {
            if (!safeExpr(o, ctx === "url" || ctx === "js" ? ctx : "text", e.start)) {
              report(e.start, e.text, "unescaped value in HTML template");
            }
          }
        } else if (!safeExpr(expr, ctx, e.start)) {
          const why = ctx === "js" ? "inline handler needs jsArg()" :
                      ctx === "url" ? "URL attribute needs escapeAttr(safeUrl())" : "unescaped value in HTML template";
          report(e.start, e.text, why);
        }
        if (state.mode === "value") state.empty = false;
      });
    }

    // 1. templates that contain HTML tags
    for (const t of all) {
      if (t.quasis.some((q) => HTML_TAG.test(q))) checkTemplate(t);
    }

    // 2. sink statements
    const sinkRe = /\.(?:innerHTML|outerHTML)\s*\+?=(?!=)|\.insertAdjacentHTML\s*\(|\bdocument\.write(?:ln)?\s*\(/g;
    for (const m of code.matchAll(sinkRe)) {
      if (!S.mask[m.index + 1]) continue;   // in a comment or string
      const start = m.index + m[0].length;
      let rhs, rhsStart = start;
      if (m[0].endsWith("(")) {
        const r = scanCode(code, start, ")");
        const args = topSplit(code.slice(start, r.end), [","]);
        rhs = m[0].includes("insertAdjacentHTML") ? args.slice(1).join(",") : args.join(",");
        if (m[0].includes("insertAdjacentHTML")) rhsStart = start + args[0].length + 1;
      } else {
        rhs = statementRhs(code, start);
      }
      checkTemplatesIn(rhs, rhsStart, { mode: "text" });
      let cur = rhsStart;
      for (const operand of topSplit(rhs, ["+"])) {
        if (!safeExpr(operand, "text", cur)) report(cur, operand, "unescaped value into HTML sink");
        cur += operand.length + 1;
      }
    }
  }

  return findings;
}

// A file may define its own escaper (classic scripts cannot import scripts/ui/escape.js). Such a definition counts as
// an escaper only if it turns markup and quotes into inert text; otherwise it is reported.
const LOCAL_ESCAPER = /^(escapeHtml|escapeAttr|jsArg|escHtml|escAttr|escapeHTML|esc)$/;
const PROBE = `<img src=x onerror="go('1')">&\``;
function checkLocalEscapers(relPath, text) {
  const findings = [];
  const ok = new Set();
  if (relPath === "scripts/ui/escape.js") return { findings, ok };   // the shared module, tested in escape.test.mjs
  const defs = [];
  for (const { code } of scriptsOf(relPath, text)) {
    for (const m of code.matchAll(/(?:\bfunction\s+([A-Za-z_$][\w$]*)\s*\(|\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=)/g)) {
      const name = m[1] || m[2];
      if (!LOCAL_ESCAPER.test(name)) continue;
      let src;
      if (m[1]) {
        const open = code.indexOf("{", scanCode(code, m.index + m[0].length, ")").end);
        src = code.slice(m.index, scanCode(code, open + 1, "}").end + 1);
      } else {
        src = `${m[0]} ${statementRhs(code, m.index + m[0].length)};`;
      }
      defs.push({ name, src });
    }
  }
  if (!defs.length) return { findings, ok };
  const box = vm.createContext({});
  try {
    vm.runInContext(defs.map((d) => d.src.replace(/^(const|let)\s/, "var ")).join("\n"), box, { timeout: 1000 });
  } catch (e) {
    findings.push({ file: relPath, line: 0, expr: defs.map((d) => d.name).join(","), msg: `local escape helpers could not be checked: ${e.message}` });
    return { findings, ok };
  }
  for (const d of defs) {
    let got;
    try { got = String(vm.runInContext(`${d.name}(${JSON.stringify(PROBE)})`, box, { timeout: 1000 })); } catch (e) { got = `(threw ${e.message})`; }
    if (/[<>"']/.test(got) || got.startsWith("(threw")) {
      findings.push({ file: relPath, line: 0, expr: d.name, msg: `local ${d.name} leaves markup or quotes in place: ${got.slice(0, 60)}` });
    } else ok.add(d.name);
  }
  return { findings, ok };
}

// Right-hand side of an assignment starting at i: up to ; , or a statement-ending newline.
function statementRhs(code, i) {
  let depth = 0, j = i;
  while (j < code.length && /\s/.test(code[j])) j++;
  const begin = j;
  while (j < code.length) {
    const c = code[j];
    if (c === "/" && code[j + 1] === "/") { const n = code.indexOf("\n", j); j = n < 0 ? code.length : n; continue; }
    if (c === "/" && code[j + 1] === "*") { const n = code.indexOf("*/", j + 2); j = n < 0 ? code.length : n + 2; continue; }
    if (c === "'" || c === '"') { j = skipString(code, j); continue; }
    if (c === "`") { j = scanTemplate(code, j).end; continue; }
    if (c === "/" && regexAllowed(code, j)) { j = skipRegex(code, j); continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) { if (depth === 0) break; depth--; }
    else if (depth === 0 && (c === ";" || c === ",")) break;
    else if (depth === 0 && c === "\n") {
      const before = code.slice(begin, j).trimEnd();
      const after = code.slice(j + 1).trimStart();
      const cont = /[+\-*/%?:=,(&|]$/.test(before) || /^([+\-*/%?:.,)\]]|&&|\|\||\?\?)/.test(after);
      if (!cont) break;
    }
    j++;
  }
  return code.slice(begin, j);
}

// ---------------------------------------------------------------- tests

function runAll() {
  const files = listFiles();
  const findings = [];
  for (const p of files) findings.push(...checkFile(relative(ROOT, p).split("\\").join("/"), readFileSync(p, "utf8")));
  const used = new Set(REVIEWED_USED);
  const open = findings.filter((f) => {
    const why = REVIEWED[f.file]?.[f.expr];
    if (why === undefined) return true;
    used.add(`${f.file}\u0000${f.expr}`);
    return false;
  });
  const stale = [];
  for (const [file, entries] of Object.entries(REVIEWED)) {
    if (file.startsWith("//") || !existsSync(join(ROOT, file))) continue;
    for (const expr of Object.keys(entries)) if (!used.has(`${file}\u0000${expr}`)) stale.push(`${file}: ${expr}`);
  }
  return { files, open, stale };
}

test("HTML templates in pages that render records escape every interpolated value", () => {
  const { files, open } = runAll();
  assert.ok(files.length > 40, "expected the pages in scope and scripts/ to be present");
  const lines = open.map((f) => `${f.file}:${f.line}: ${f.msg}: \${${f.expr.slice(0, 100)}}`);
  assert.deepEqual(lines, [], `\n${lines.join("\n")}\n\nUse escapeHtml/escapeAttr/jsArg/safeUrl from scripts/ui/escape.js, or, for a constant or a number, add the expression to tests/static/sinks-reviewed.json with the reason.`);
});

test("every entry in tests/static/sinks-reviewed.json still matches an expression", () => {
  if (process.env.OWL_TEST_ROOT) return; // the list belongs to this checkout
  assert.deepEqual(runAll().stale, []);
});

test("the pages that show other users' records and loaded files are in scope", () => {
  if (process.env.OWL_TEST_ROOT) return;
  const files = new Set(listFiles().map((p) => relative(ROOT, p).split("\\").join("/")));
  for (const f of ["mage_tower/Constellation_Map.html", "mage_tower/Admin_Console.html", "mage_tower/Unlock_Console.html",
    "mage_tower/Prereq_Math.html", "mage_tower/Major_Tome.html", "mage_tower/Instructor_Console.html", "mage_tower/Codex.html",
    "mage_tower/Seal_Forge.html", "mage_tower/Store.html", "mage_tower/Familiars.html", "mage_tower/Biomesh_Console.html",
    "mage_tower/Biomesh_Language_Growing.html", "index.html", "login.html", "Learning-Hub.html",
    "Library/Community & Research/Independent_Learning.html", "Library/Experimental_Systems/Engram_Mind_Eye.html",
    "Proofs/Proofer_Terminal/Proofer_Terminal.html", "Proofs/emulators/Amiga_Proof_Emulator.html",
    "Library/Ontology Department/Lexicons/Lexicon_Creator.html", "Library/Ontology Department/Root_Ontology_Creator.html",
    "Library/Ontology Department/Lexicons/Holographic_Geometry/Holographic_Geometry.html"]) {
    assert.ok(files.has(f), `${f} is in scope`);
  }
});

const findingsOf = (code) => checkFile("x.js", code).map((f) => `${f.msg}: ${f.expr}`);

test("the checker flags the unsafe patterns it is meant to catch", () => {
  const bad = [
    "el.innerHTML = `<h4>${c.title}</h4>`;",
    "el.innerHTML = `<option value=\"${c.id}\">x</option>`;",
    "el.innerHTML = \"<b>\" + rec.name + \"</b>\";",
    "el.innerHTML = `<i style=\"width:${score.total}%\"></i>`;",
    "el.innerHTML = `<a href=\"${escapeAttr(rec.url)}\">x</a>`;",
    "el.innerHTML = `<b onclick=\"go('${escapeHtml(rec.id)}')\">x</b>`;",
    "el.insertAdjacentHTML('beforeend', `<p>${msg}</p>`);",
    "function f(msg, cls) { el.innerHTML = cls ? `<span class=\"${cls}\">${msg}</span>` : msg; }",
    "const row = `<td>${t.chainId?.slice(0,14)}</td>`;",
    "el.innerHTML = `<p>${c.parentChainId ? `epoch ${c.epoch}` : \"\"}</p>`;",
    // a display name of another user, unescaped
    "list.innerHTML = users.map((u) => `<li>${u.displayName || 'Unknown Scholar'}</li>`).join('');",
    // a record id in an inline handler, quoted by hand
    "row.innerHTML = `<button onclick=\"openTomeModal('${t.id}', 1)\">Open</button>`;",
    // a record field kept in a variable whose name says "markup"
    "function card(c) { const titleHtml = c.title; d.innerHTML = `<h4>${titleHtml}</h4>`; }",
    // a record field passed to a helper that inserts its argument as HTML
    "function addMsg(role, html, src) { log.innerHTML += `<div class=\"${escapeAttr(role)}\">${html}</div>`; }\n" +
      "addMsg('status', 'ready'); addMsg('status', chain.title, 'loaded');",
    // a parameter that shares its name with literal assignments in another function
    "function addMsg(role, html, src) { log.innerHTML += (src ? `<span class=\"src\">${src}</span>` : '') + escapeHtml(html); }\n" +
      "function transmit() { let src = 'local'; if (x) src = 'remote'; }\naddMsg('status', 'x', chain.title);",
    // a loop variable
    "for (const s of students) { tbody.innerHTML += `<tr><td>${s}</td></tr>`; }",
    // a destructured record field
    "const { title } = rec; el.innerHTML = `<h4>${title}</h4>`;",
    // a local helper that returns a record field
    "function label(r) { return r.title; } el.innerHTML = `<p>${label(rec)}</p>`;",
  ];
  for (const code of bad) {
    assert.notDeepEqual(findingsOf(code), [], code);
  }
  const good = [
    "el.innerHTML = `<h4>${escapeHtml(c.title)}</h4>`;",
    "el.innerHTML = `<option value=\"${escapeAttr(c.id)}\">${escapeHtml(c.t)}</option>`;",
    "el.innerHTML = \"<b>\" + escapeHtml(rec.name) + \"</b>\";",
    "el.innerHTML = `<span class=\"pill ${ok ? \"ok\" : \"bad\"}\">x</span>`;",
    "el.innerHTML = `<a href=\"${escapeAttr(safeUrl(rec.url))}\">x</a>`;",
    "el.innerHTML = `<b onclick=\"go(${jsArg(rec.id)})\">x</b>`;",
    "const chipHtml = `<i>${escapeHtml(a)}</i>`; el.innerHTML = chipHtml + `<b>${escapeHtml(b)}</b>`;",
    "let sigil = ''; sigil = renderTomeSVG(t, 5); el.innerHTML = `<div>${sigil}</div>`;",
    "el.innerHTML = list.map(x => `<li>${escapeHtml(x)}</li>`).join('');",
    "function addMsg(role, html) { log.innerHTML += `<div>${html}</div>`; }\naddMsg('s', escapeHtml(rec.title)); addMsg('s', `<b>${escapeHtml(n)}</b>`);",
    "function label(r) { return escapeHtml(r.title); } el.innerHTML = `<p>${label(rec)}</p>`;",
    "let html = ''; for (const r of rows) html += `<li>${escapeHtml(r)}</li>`; el.innerHTML = html;",
  ];
  for (const code of good) {
    assert.deepEqual(findingsOf(code), [], code);
  }
});

test("local escape helpers must actually escape", () => {
  const weak = "<script>function escapeHtml(s) { return String(s).replace(/</g, '&lt;'); }</script>";
  assert.notDeepEqual(checkFile("x.html", weak), []);
  const strong = "<script>function escapeHtml(v) { const m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }; " +
    "return String(v).replace(/[&<>\"']/g, (c) => m[c]); }\nfunction jsArg(v) { return escapeHtml(JSON.stringify(String(v))); }</script>";
  assert.deepEqual(checkFile("x.html", strong), []);
});

test("the files in scope exist", () => {
  for (const f of Object.keys(SVG_BUILDERS)) assert.ok(existsSync(join(ROOT, f)), f);
  assert.ok(existsSync(join(ROOT, "mage_tower", "Biomesh_Console.html")));
});
