// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// The Lexicon Explorer walkthrough's own helpers (tests/browser/lexicon-explorer.cjs): the two viewports, the
// measurements made inside the page, opening the page in a new context, the gestures, and the two package files
// the walkthrough loads, which are made when it runs and never kept.
const path = require("path"), fs = require("fs");
const { pathToFileURL } = require("url");
const kit = require("./walk-kit.cjs");

const PAGE_PATH = "/Library/Experimental_Systems/Lexicon_Explorer/index.html";
const MODEL_PATH = "/Library/Experimental_Systems/Lexicon_Explorer/lexicon-explorer-model.js";
const { sleep } = kit;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const VIEWPORTS = {
  phone: { name: "390x844", phone: true, opts: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  desk: { name: "1440x900", phone: false, opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } },
};

/** The record as this walkthrough writes to it: at(viewport, section), then check(step, expected, actual, ok). */
class Steps {
  constructor(record) { this.record = record; this.vp = ""; this.section = ""; }
  at(vp, section) { this.vp = vp; this.section = section; }
  /** check(step, expected, actual, ok): ok defaults to "the two are the same value". */
  check(step, expected, actual, ok) { return this.record.add({ part: this.vp, section: this.section, step, expected, actual, ok: ok === undefined ? same(expected, actual) : !!ok }); }
}

/** Runs inside the page before its own script: counts animation frames and holds the measuring functions. */
function initScript() {
  const raf = window.requestAnimationFrame.bind(window);
  window.__raf = 0;
  window.requestAnimationFrame = (f) => { window.__raf += 1; return raf(f); };
  const W = (window.__W = {});
  const shown = (el) => {
    if (!el.isConnected || el.closest("[hidden]")) return false;
    if (typeof el.checkVisibility === "function" && !el.checkVisibility({ checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 1.5 || r.height <= 1.5) return false;                    // also the visually hidden (1 px, clipped)
    const d = el.closest("dialog");
    if (!d && document.querySelector("dialog[open]")) return false;         // behind an open dialog
    return true;
  };
  W.shown = shown;
  const ownText = (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim() !== "");
  const nameOf = (el) => el.localName + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().replace(/\s+/g, ".") : "") + (el.getAttribute("data-key") ? "[" + el.getAttribute("data-key") + "]" : "");
  /** Visible text that is not 17 or 14 px, or 13 px outside the hash class. Also the sizes in use. */
  W.text = () => {
    const bad = [], sizes = {};
    for (const el of document.querySelectorAll("body *")) {
      if (el.localName === "canvas" || el.localName === "script" || el.localName === "style" || !ownText(el) || !shown(el)) continue;
      const fs = Math.round(parseFloat(getComputedStyle(el).fontSize) * 100) / 100, hash = !!el.closest(".hash");
      sizes[fs] = (sizes[fs] || 0) + 1;
      if (!(fs === 17 || fs === 14 || (fs === 13 && hash))) bad.push(nameOf(el) + ":" + fs + ":" + el.textContent.trim().slice(0, 24));
    }
    return { bad: bad.slice(0, 8), n: bad.length, sizes };
  };
  /** Enabled, visible controls under the minimum size. Term buttons inside a verse of line-height 2 are exempt. */
  W.controls = (min) => {
    const bad = []; let n = 0, exempt = 0;
    for (const el of document.querySelectorAll("button, input, select, textarea, summary, [role=tab], [role=button], a.btn")) {
      if (el.disabled || !shown(el)) continue;
      const verse = el.closest(".verse");
      if (verse && el.getAttribute("role") === "button") {
        const cs = getComputedStyle(verse);
        if (Math.abs(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) - 2) < 0.01) { exempt++; continue; }
      }
      n++;
      const r = el.getBoundingClientRect();
      if (r.width < min - 0.5 || r.height < min - 0.5) bad.push(nameOf(el) + ":" + Math.round(r.width) + "x" + Math.round(r.height));
    }
    return { bad: bad.slice(0, 8), n: bad.length, measured: n, exempt };
  };
  W.overflow = () => {
    const over = document.documentElement.scrollWidth - innerWidth;
    if (over <= 0) return { over, who: [] };
    const who = [];
    for (const el of document.querySelectorAll("body *")) { if (!shown(el)) continue; const r = el.getBoundingClientRect(); if (r.right > innerWidth + 0.5 && who.length < 5) who.push(nameOf(el) + ":" + Math.round(r.right)); }
    return { over, who };
  };
  W.focus = () => { const a = document.activeElement; return !a || a === document.body || a === document.documentElement ? "body" : nameOf(a); };
  /** The first line of the explanation card (the Entry): where its first visible child and its title end, at scroll 0. */
  W.card = () => {
    scrollTo(0, 0);
    const card = document.getElementById("explain"), title = card.querySelector(".explain-body:not([hidden]) h2");
    const first = Array.from(card.children).find((c) => shown(c));
    const lh = (el) => { const cs = getComputedStyle(el); return parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.45; };
    const firstLine = (el) => { const r = el.getClientRects()[0] || el.getBoundingClientRect(); return Math.round(r.top + Math.min(r.height, lh(el))); };
    return { top: Math.round(card.getBoundingClientRect().top), firstChild: first ? (first.id || first.className) : null, firstChildLine: first ? (first.id === "tabs" ? Math.round(first.getBoundingClientRect().bottom) : title ? firstLine(title) : -1) : -1, title: title ? firstLine(title) : -1 };
  };
  W.canvasSum = (id) => {
    const c = document.getElementById(id); if (!c || !c.width) return "none";
    const u = c.toDataURL(); let x = 0;
    for (let i = 0; i < u.length; i++) x = (x * 31 + u.charCodeAt(i)) | 0;
    return u.length + ":" + x;
  };
  /** Pairs of label boxes of the tree that lie on each other, and the smallest label size. */
  W.labels = () => {
    // A label box is its text plus a plate of 4 px left and right and 3 px above and below (lexicon-canvas.js).
    const ls = window.LexiconExplorer.tree.labels(), pairs = [], textPairs = [];
    for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) {
      const a = ls[i], b = ls[j], ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 0.5 && oy > 0.5) pairs.push(a.text + " / " + b.text + " (" + ox.toFixed(1) + " x " + oy.toFixed(1) + ")");
      if (ox > 8.5 && oy > 6.5) textPairs.push(a.text + " / " + b.text + " (" + ox.toFixed(1) + " x " + oy.toFixed(1) + ")");
    }
    return { n: ls.length, min: ls.reduce((m, l) => Math.min(m, l.size), 99), pairs, textPairs, texts: ls.map((l) => l.text) };
  };
  /** Where an entry's marker is, in page coordinates, and whether that point is inside the window. */
  W.markAt = (address) => {
    const t = window.LexiconExplorer.tree, m = t.marks().filter((x) => x.address === address).pop(), r = document.getElementById("tree").getBoundingClientRect();
    return m ? { x: r.left + m.x, y: r.top + m.y, r: m.r, cx: m.x - r.width / 2, cy: m.y - r.height / 2, side: r.width } : null;
  };
  W.treeBox = () => { const r = document.getElementById("tree").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  /** Text contrast under 4.5:1 (solid colours only: a gradient or picture behind the text is taken as its colour beneath). */
  W.contrast = () => {
    const rgba = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const bgOf = (el) => {
      const stack = [];
      for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } }
      let base = { r: 3, g: 5, b: 10, a: 1 };
      for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
      return base;
    };
    const bad = []; let n = 0, off = 0;
    for (const el of document.querySelectorAll("body *")) {
      if (el.localName === "canvas" || !ownText(el) || !shown(el)) continue;
      if (el.closest(":disabled, [aria-disabled=true]")) { off++; continue; }       // an inactive control is exempt, as in WCAG 1.4.3
      const cs = getComputedStyle(el), fg0 = rgba(cs.color); if (!fg0) continue;
      let op = 1; for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
      const bg = bgOf(el), fg = over(fg0, bg);
      const a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      n++;
      if (ratio < 4.5 || op < 1) bad.push(nameOf(el) + ":" + ratio.toFixed(2) + (op < 1 ? " opacity " + op : "") + ":" + el.textContent.trim().slice(0, 20));
    }
    return { bad: bad.slice(0, 8), n: bad.length, measured: n, inactive: off };
  };
  /** Collects every distinct text an element shows while a job runs (the element may be replaced). */
  W.watch = (hostId, pick) => {
    const host = document.getElementById(hostId), seen = [], extra = [];
    const read = () => { const el = host.querySelector(pick); const t = el ? el.textContent : ""; if (t && seen[seen.length - 1] !== t) { seen.push(t); extra.push(W.onWatch ? W.onWatch() : null); } };
    const mo = new MutationObserver(read);
    mo.observe(host, { childList: true, subtree: true, characterData: true });
    read();
    return { seen, extra, stop: () => mo.disconnect() };
  };
}

/**
 * Opens the page in a new context. fonts: "empty" (the two font hosts are answered with empty 200 responses) or
 * "abort". Every other request that would leave this computer is refused.
 */
async function open(browser, base, vp, { hash = "", fonts = "empty", reducedMotion = null, viewport = null } = {}) {
  const opts = { ...vp.opts, acceptDownloads: true };
  if (viewport) opts.viewport = viewport;
  if (reducedMotion) opts.reducedMotion = reducedMotion;
  const ctx = await browser.newContext(opts), page = await ctx.newPage(), messages = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") messages.push(m.type() + ": " + m.text() + " @ " + (m.location().url || "")); });
  page.on("pageerror", (e) => messages.push("pageerror: " + e.message + " @ " + (e.stack || "").split("\n").slice(1, 3).join(" | ")));
  let dialogs = 0;
  page.on("dialog", (d) => { dialogs++; d.dismiss().catch(() => {}); });
  await kit.refuseOutside(ctx, base, { fonts: false });
  await kit.routeFonts(page, fonts);
  const outside = [];
  page.on("request", (q) => { const u = q.url(); if (!u.startsWith(base) && !u.startsWith("blob:") && !u.startsWith("data:")) outside.push(u); });
  await page.addInitScript(initScript);
  await page.goto(base + PAGE_PATH + hash);
  await page.waitForFunction(() => window.LexiconExplorer && window.LexiconExplorer.ready);
  await page.evaluate(() => window.LexiconExplorer.ready);
  await page.evaluate(async (p) => { window.__M = await import(location.origin + p); }, MODEL_PATH);
  await sleep(250);
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, messages, outside, cdp, dialogs: () => dialogs };
}

const E = (page, fn, arg) => page.evaluate(fn, arg);
const state = (page, key) => E(page, (k) => { const s = window.LexiconExplorer.state, v = s[k]; return v === undefined ? null : JSON.parse(JSON.stringify(v, (kk, x) => (x instanceof Map ? "[Map]" : x))); }, key);
async function settle(page, ms = 150) { await page.waitForFunction(() => !window.LexiconExplorer.tree.flying, null, { timeout: 15000 }); await sleep(ms); }
async function idle(page) { await page.waitForFunction(() => !window.LexiconExplorer.state.busy, null, { timeout: 120000 }); await sleep(200); }

/** A one-finger swipe made of real touch events (so the browser itself decides whether the page scrolls). */
async function swipe(cdp, from, to, { steps = 12, cancel = false } = {}) {
  const pt = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(from.x, from.y) });
  for (let i = 1; i <= steps; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps) }); await sleep(16); }
  await cdp.send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] });
  await sleep(350);
}

/**
 * Makes the two package files the walkthrough loads, with the repository's own modules: journey.json, a First
 * Explorers journey, and invented.json, a tree lexicon with an invented verse, markup in a text, a right-to-left
 * name and a word of 120 letters.
 */
async function makeFiles(root, folder) {
  const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);
  const OW = await load("scripts/strix-overwatch.js"), M = await load("Library/Experimental_Systems/Lexicon_Explorer/lexicon-explorer-model.js");
  const AT = "2026-11-15T10:00:00.000Z", keys = await OW.newSessionKeys();
  const obs = [OW.makeObservation("sound", { hz: 432, ms: 400 }, "tone-432"), OW.makeObservation("number", { seq: [1, 1, 2, 3, 5, 8] }, "fib")];
  const trace = [], lineage = [];
  OW.traceAppend(trace, "system", "genesis", "darkness", AT);
  let chain = null;
  for (const o of obs) { chain = await OW.growJourney(chain, o); lineage.push(OW.lineageRow(chain)); OW.traceAppend(trace, "strix", "chain.grown", OW.epochCommitment(chain), AT); }
  const jb = { chain, lexicon: OW.lexiconOf(obs), lineage, trace }, jc = (await OW.issueCertificate(jb, keys, AT)).certificate;
  fs.writeFileSync(path.join(folder, "journey.json"), JSON.stringify(OW.makeHyperpack({ ...jb, certificate: jc })));
  const rows = [
    ["26", "text", "book", "Ezekiel", ""],
    ["26.1", "text", "chapter", "Ezekiel 1", ""],
    ["26.1.1", "text", "verse", "Ezekiel 1:1", "An invented verse that is in no Bible. <img src=x onerror=alert(1)> javascript:alert(1)"],
    ["26.1.1.1", "checked", "count", "שלום עולם (a name in Hebrew letters)", "A row with a right-to-left name and a long unbroken word " + "x".repeat(120)],
    ["26.1.2", "said", "link", "A link that leads nowhere", "99.9"],
  ];
  const lexicon = M.makeLexicon(rows.map((r) => OW.makeEntry(...r)), "page", "invented", "");
  const seal = await M.sealLexicon(lexicon, { at: AT, keys });
  if (!seal.ok) throw new Error("the invented lexicon did not seal");
  fs.writeFileSync(path.join(folder, "invented.json"), seal.wire);
}

module.exports = { PAGE_PATH, VIEWPORTS, Steps, open, makeFiles, E, state, settle, idle, swipe, sleep, same, fs, path };
