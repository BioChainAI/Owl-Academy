// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// What the three browser walkthroughs of tests/browser/ share: finding Playwright, reading the options, one static
// server for the repository, the routing of the two font hosts, the record of expected against actual with its
// summary, the screenshots with their manifest, and a temporary folder for files a walkthrough makes while it runs.
//
// Nothing here is a test and nothing here is run by node --test. See tests/browser/README.md.
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** A value as one line of text, cut to n characters. */
const brief = (v, n = 260) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s === undefined ? "undefined" : s.length > n ? s.slice(0, n) + "…" : s; };

// ─── Playwright ──────────────────────────────────────────────────────────────
const INSTALL = "Playwright with Chromium is needed and was not found: install it in a folder of your choice (npm i -D playwright && npx playwright install chromium) and set NODE_PATH to that folder's node_modules, or install it globally (npm i -g playwright && npx playwright install chromium) and set NODE_PATH to the folder that `npm root -g` prints.";

/** Stops the script with one line and exit code 2: it could not be run at all (which is not the same as a failed check). */
function cannotRun(line) { console.error(line); process.exit(2); }

/** The playwright module, or one plain line on how to install it and exit code 2. */
function playwright() {
  try { return require("playwright"); } catch (e) {
    if (e && e.code === "MODULE_NOT_FOUND" && /playwright/.test(String(e.message))) cannotRun(INSTALL);
    throw e;
  }
}
function playwrightVersion() { try { return require("playwright/package.json").version; } catch { return "unknown"; } }

/** Starts Chromium; if the browser itself is missing, says so in one line and exits with code 2. */
async function launch() {
  const pw = playwright();
  try { return await pw.chromium.launch(); } catch (e) {
    return cannotRun("Chromium could not be started (" + String((e && e.message) || e).split("\n")[0] + "). " + INSTALL);
  }
}

// ─── options ─────────────────────────────────────────────────────────────────
/**
 * Reads --name=value and --name from the command line. `own` lists the names a walkthrough adds to the common ones
 * (root, shots, json, verbose, help). An unknown option, or an argument that is not an option, stops the script.
 * here is the folder of the calling script: the repository root is two folders above it unless --root names another.
 */
function options(here, usage, own = []) {
  const known = new Set(["root", "shots", "json", "verbose", "help", ...own]), o = {};
  for (const a of process.argv.slice(2)) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
    if (!m || !known.has(m[1])) cannotRun("Unknown argument " + a + "\n\n" + usage);
    o[m[1]] = m[2] === undefined ? true : m[2];
  }
  if (o.help) { console.log(usage); process.exit(0); }
  for (const k of ["root", "shots", "json"]) if (o[k] === true || o[k] === "") cannotRun("--" + k + " needs a value: --" + k + "=<" + (k === "json" ? "file" : "folder") + ">\n\n" + usage);
  o.root = path.resolve(o.root || path.resolve(here, "..", ".."));
  if (o.shots) o.shots = path.resolve(o.shots);
  if (o.json) o.json = path.resolve(o.json);
  o.verbose = !!o.verbose;
  return o;
}
/** Stops the script unless the page it is about is in the served folder. */
function needFile(root, rel) { if (!fs.existsSync(path.join(root, rel))) cannotRun("No " + rel + " under " + root + ": --root must name a copy of the repository."); }
/** A comma-separated option as a list checked against the names that exist, or null when the option was not given. */
function listOption(value, names, what) {
  if (value === undefined) return null;
  const list = value === true ? [] : String(value).split(",").filter(Boolean), bad = list.filter((x) => !names.includes(x));
  if (list.length === 0 || bad.length) cannotRun("--" + what + " takes one or more of " + names.join(", ") + (bad.length ? "; not " + bad.join(", ") : ""));
  return list;
}

// ─── the static server ───────────────────────────────────────────────────────
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8" };

/** Serves the files of root on 127.0.0.1, on a free port chosen by the system. A folder is answered with its index.html. */
function serve(root) {
  const top = path.resolve(root);
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(req.url.split("?")[0]); } catch { res.writeHead(400); res.end(); return; }
    let file = path.join(top, rel);
    if (file !== top && !file.startsWith(top + path.sep)) { res.writeHead(403); res.end(); return; }
    if (rel.endsWith("/")) file = path.join(file, "index.html");
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); res.end("not found"); return; }
      res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
      res.end(data);
    });
  });
  return new Promise((ok, no) => {
    server.once("error", no);
    server.listen(0, "127.0.0.1", () => { const port = server.address().port; ok({ server, port, base: "http://127.0.0.1:" + port, close: () => new Promise((done) => { server.closeAllConnections(); server.close(() => done()); }) }); });
  });
}

// ─── the network: the two font hosts, and nothing else leaves this computer ──
const FONT_HOSTS = /^https?:\/\/fonts\.(googleapis|gstatic)\.com\//;

/**
 * Answers the two font hosts for a page or a context: "empty" gives an empty style sheet with status 200, "abort"
 * refuses the request. mode may be a function, asked at every request.
 */
function routeFonts(target, mode = "empty") {
  return target.route(FONT_HOSTS, (r) => ((typeof mode === "function" ? mode() : mode) === "abort" ? r.abort() : r.fulfill({ status: 200, contentType: "text/css", body: "" })));
}
/**
 * Refuses every request of a context that would leave this computer: any http or https address that is not the
 * walkthrough's own server. With fonts: false the two font hosts are left to routeFonts. seen(url) is told each refusal.
 */
function refuseOutside(context, base, { fonts = true, seen = null } = {}) {
  const outside = (url) => /^https?:$/.test(url.protocol) && url.origin !== base && (fonts || !FONT_HOSTS.test(url.href));
  return context.route(outside, (route) => { if (seen) seen(route.request().url()); return route.abort(); });
}

/**
 * The fonts Chromium really drew a page's text with, most used first, as one line for the summary. The web fonts
 * are never fetched, so these are fonts installed on this computer, and positions measured in a walkthrough are
 * positions with these fonts. Read in a context of its own, before the walk; never a check.
 */
async function fontsDrawn(browser, url) {
  let ctx = null;
  try {
    ctx = await browser.newContext();
    await refuseOutside(ctx, new URL(url).origin, { fonts: false });
    await routeFonts(ctx, "empty");
    const page = await ctx.newPage();
    await page.goto(url);
    await sleep(500);
    const cdp = await ctx.newCDPSession(page), used = new Map();
    await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
    const root = (await cdp.send("DOM.getDocument")).root.nodeId;
    const ids = (await cdp.send("DOM.querySelectorAll", { nodeId: root, selector: "body *" })).nodeIds.slice(0, 400);
    for (const nodeId of ids) for (const f of (await cdp.send("CSS.getPlatformFontsForNode", { nodeId })).fonts) used.set(f.familyName, (used.get(f.familyName) || 0) + f.glyphCount);
    const names = [...used].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    return "text drawn with " + (names.join(", ") || "no font that could be read") + " (fonts of this computer; the web fonts are never fetched)";
  } catch { return "the fonts the text was drawn with could not be read"; } finally { if (ctx) await ctx.close().catch(() => {}); }
}

// ─── the record of expected against actual ───────────────────────────────────
/**
 * One row per check: { part, section, step, expected, actual, ok }. part is the viewport (or the window size),
 * section the stretch of the walk. A failed check is printed at once with expected against actual; with verbose
 * every check is. Otherwise one line is printed per group of checks (by default per part and section).
 */
class Record {
  constructor(name, { verbose = false } = {}) { this.name = name; this.verbose = verbose; this.rows = []; this.group = null; this.t0 = Date.now(); }
  seconds() { return Math.round((Date.now() - this.t0) / 1000); }
  /** Prints the line of the group that has just ended. */
  flush() {
    const g = this.group;
    this.group = null;
    if (!g || this.verbose) return;
    console.log((g.failed ? "FAIL " : "ok   ") + g.key + ": " + (g.passed + g.failed) + " checks, " + g.passed + " passed, " + g.failed + " failed");
  }
  add({ part, section, step, expected, actual, ok, group }) {
    const row = { part: String(part), section: String(section), step: String(step), expected, actual, ok: !!ok }, key = group || row.part + " | " + row.section;
    if (!this.group || this.group.key !== key) { this.flush(); this.group = { key, passed: 0, failed: 0 }; }
    this.rows.push(row);
    if (row.ok) this.group.passed++; else this.group.failed++;
    if (!row.ok || this.verbose) console.log((row.ok ? "ok   " : "FAIL ") + row.part + " | " + row.section + " | " + row.step + (row.ok ? "" : "\n       expected: " + brief(expected, 600) + "\n       actual:   " + brief(actual, 900)));
    return row.ok;
  }
  failures() { return this.rows.filter((r) => !r.ok); }
  totals() {
    const by = new Map();
    for (const r of this.rows) { const t = by.get(r.part) || { checks: 0, passed: 0, failed: 0 }; t.checks++; if (r.ok) t.passed++; else t.failed++; by.set(r.part, t); }
    return by;
  }
  /** The summary: checks per part, every failure with expected against actual, and the last line "N checks, N passed, 0 failed". */
  summary(notes = []) {
    this.flush();
    const bad = this.failures(), n = this.rows.length;
    console.log("\n" + this.name + " walkthrough: " + this.seconds() + " s");
    for (const [part, t] of this.totals()) console.log("  " + part.padEnd(12) + t.checks + " checks, " + t.passed + " passed, " + t.failed + " failed");
    for (const line of notes) console.log("  " + line);
    for (const r of bad) console.log("FAILED " + r.part + " | " + r.section + " | " + r.step + "\n   expected: " + brief(r.expected, 600) + "\n   actual:   " + brief(r.actual, 900));
    if (n === 0) console.log("No check was made.");
    console.log(n + " checks, " + (n - bad.length) + " passed, " + bad.length + " failed");
    return n > 0 && bad.length === 0;
  }
}

// ─── screenshots ─────────────────────────────────────────────────────────────
/** Screenshots are off unless a folder is given (--shots=<folder>); then each picture is listed in manifest.json there. */
class Shots {
  constructor(folder, note) { this.folder = folder || null; this.note = note; this.list = []; if (this.folder) fs.mkdirSync(this.folder, { recursive: true }); }
  get on() { return !!this.folder; }
  /** Takes one picture of the page and lists it; entry holds what the manifest says of it. Does nothing when off. */
  async take(page, file, entry, options = {}) {
    if (!this.folder) return false;
    await page.screenshot({ ...options, path: path.join(this.folder, file) });
    this.list.push({ file, ...entry });
    return true;
  }
  /** A picture of the page as it was when a part of the walk stopped with an error. Not listed in the manifest. */
  async error(page, file) { if (this.folder && page) await page.screenshot({ path: path.join(this.folder, file) }).catch(() => {}); }
  write() { if (this.folder) fs.writeFileSync(path.join(this.folder, "manifest.json"), JSON.stringify({ note: this.note, shots: this.list }, null, 1) + "\n"); }
}

// ─── a temporary folder, and the end of a run ────────────────────────────────
function removeFolder(folder) { try { fs.rmSync(folder, { recursive: true, force: true }); } catch { /* left to the system */ } }
/**
 * A new folder under the system's temporary folder, for downloads and for files made at run time. It is removed
 * when the process ends, also when the run is interrupted from the keyboard.
 */
function tempFolder(name) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "owl-" + name + "-"));
  process.on("exit", () => removeFolder(folder));
  process.once("SIGINT", () => process.exit(130));
  process.once("SIGTERM", () => process.exit(143));
  return folder;
}

/**
 * Prints the summary, writes the manifest of the screenshots and, with --json=<file>, the full record, and returns
 * the exit code: 0 only when at least one check was made and every check passed.
 */
function finish(rec, { opts, shots = null, notes = [], extra = {} }) {
  const ok = rec.summary(notes);
  if (shots) shots.write();
  if (opts.json) {
    fs.mkdirSync(path.dirname(opts.json), { recursive: true });
    fs.writeFileSync(opts.json, JSON.stringify({ walkthrough: rec.name, seconds: rec.seconds(), playwright: playwrightVersion(), totals: Object.fromEntries(rec.totals()), checks: rec.rows.length, passed: rec.rows.length - rec.failures().length, failed: rec.failures().length, ...extra, rows: rec.rows }, null, 1) + "\n");
  }
  return ok ? 0 : 1;
}

/** Ends the process with this exit code once everything printed so far has been written out (a pipe may still hold it). */
function leave(code) { process.exitCode = code; process.stdout.write("", () => process.exit(code)); }

module.exports = { sleep, brief, cannotRun, playwright, playwrightVersion, launch, options, needFile, listOption, serve, FONT_HOSTS, routeFonts, refuseOutside, fontsDrawn, Record, Shots, tempFolder, removeFolder, finish, leave };
