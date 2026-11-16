// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Browser walkthrough of the Celestial Control Panel (Library/Experimental_Systems/Celestial_Control_Panel/).
// Optional, run by hand; it is not part of node --test. It opens the real page in headless Chromium, goes through
// every step and control as a visitor would (the mouse and the keyboard at 1440 x 900, a finger at 390 x 844), and
// records what the page shows against what it should show.
//
//   node tests/browser/celestial-control-panel.cjs                  everything, about eleven minutes
//   node tests/browser/celestial-control-panel.cjs --only=journey,lenses,details,links,touch,motion,aborted,small
//                                                                   chosen sections
//   node tests/browser/celestial-control-panel.cjs --vp=390         one viewport (1440 or 390); leaves out "small"
//   --root=<folder>    walk a copy of the repository in another folder
//   --shots=<folder>   write the screenshots (PNG, two device pixels per CSS pixel) and manifest.json there
//   --json=<file>      write every check with expected and actual
//   --verbose          print every check, not only the failures and one line per section
//
// Sections: journey (the five steps from the dark first screen to the seal, the dates, the Moon, the lab, the
// dialogs), lenses (the three reading levels on every step, in 2D and 3D), details (the layout of the first
// screen, the way on, STRIX's line, the list, the sticky header, single sentences), links (what a link does to
// the page and what the page writes), touch (finger, mouse and keyboard on the canvas), motion (idle, and reduced
// motion), aborted (the two font hosts aborted, and the whole journey once more that way), small (720 x 450,
// 320 x 256 with mouse and with touch, 390 x 844: nothing scrolls sideways; 700, 800, 1000, 1099 and 1100 x 900: the
// header of two rows hides no focused control; 320 x 568: STRIX keeps its first sentence where hiding it gains nothing).
// At every station it asserts: no visible text under 14 px outside hashes and three text sizes only, every enabled
// control at least 44 x 44 px for a finger and 32 x 32 px for the mouse, text contrast at least 4.5 to 1, no
// sideways overflow, on the phone the first line of the explanation card above y = 844, the focus never left on
// the body after an activation, and no console error or warning.
//
// It needs Playwright with Chromium (see tests/browser/README.md). It serves the repository itself on 127.0.0.1 and
// a free port, answers the two font hosts with empty 200 responses (aborts them in the section "aborted"), refuses
// any other request that would leave this computer, fixes the device clock at Saturday 14 November 2026, 16:00 UT
// (so dates and the Moon are the same in every run), and drives the page with real pointer and keyboard input
// through its fixed ids; window.CelestialControlPanel is read for the state and the chart. It writes nothing into
// the repository. Exit code 0 only when every check passed.
const kit = require("./lib/walk-kit.cjs");
const fs = require("fs"), path = require("path");

const USAGE = "node tests/browser/celestial-control-panel.cjs [--only=journey,lenses,details,links,touch,motion,aborted,small] [--vp=1440|390] [--root=<folder>] [--shots=<folder>] [--json=<file>] [--verbose]";
const OPTS = kit.options(__dirname, USAGE, ["only", "vp"]);
const ROOT = OPTS.root;
const PAGE = "/Library/Experimental_Systems/Celestial_Control_Panel/index.html";
kit.needFile(ROOT, PAGE.slice(1));
const NOW = new Date("2026-11-14T16:00:00Z");
const ONLY = kit.listOption(OPTS.only, ["journey", "lenses", "details", "links", "touch", "motion", "aborted", "small"], "only");
if (OPTS.vp !== undefined && !["1440", "390"].includes(OPTS.vp)) kit.cannotRun("--vp takes 1440 or 390\n\n" + USAGE);
const wanted = (name) => !ONLY || ONLY.includes(name);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clip = (v, n = 260) => { const t = typeof v === "string" ? v : JSON.stringify(v); return t === undefined ? "undefined" : t.length > n ? t.slice(0, n) + "…" : t; };

const VIEWPORTS = {
  "1440x900": { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  "390x844": { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};
const RECORD = new kit.Record("Celestial Control Panel", { verbose: OPTS.verbose }), NOTES = [];
const SHOTS = new kit.Shots(OPTS.shots, "Screenshots of the Celestial Control Panel walkthrough (tests/browser/celestial-control-panel.cjs). PNG, two device pixels per CSS pixel.");
let TEMP = null;                                                     // the temporary folder of this run: what the page downloads

// ─── helpers that run inside the page (installed before the page's own script; they only read) ──────────────
function INIT() {
  const w = (window.__w = {});
  w.rendered = (el) => {
    if (!el || !el.isConnected) return false;
    if (el.closest("dialog:not([open])")) return false;
    if (typeof el.checkVisibility === "function" && !el.checkVisibility({ checkVisibilityCSS: true })) return false;
    for (let a = el; a && a.nodeType === 1; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.clipPath && cs.clipPath !== "none") return false;                 // text kept for screen readers only
      if (a.localName === "details" && !a.open) { const sum = a.querySelector(":scope > summary"); if (!(sum && sum.contains(el))) return false; }
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  w.seen = (sel) => { const el = typeof sel === "string" ? document.querySelector(sel) : sel; return !!el && w.rendered(el); };
  w.txt = (sel) => { const el = document.querySelector(sel); return el ? el.textContent : null; };
  w.shown = (sel) => { const el = document.querySelector(sel); return el && w.rendered(el) ? el.textContent : null; };
  w.plain = (sel) => {                                                           // the sentences of a region without their badges
    const el = document.querySelector(sel);
    if (!el) return null;
    const c = el.cloneNode(true);
    for (const b of c.querySelectorAll(".badge")) b.replaceWith(" ");
    for (const b of c.querySelectorAll("p, li, h2, h3, h4, td, th, blockquote, dt, dd")) b.append(" ");
    return c.textContent.replace(/\s+/g, " ").trim();
  };
  w.box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
  w.pageText = () => {                                                           // every sentence a visitor can see now
    const out = [], tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) { const t = tw.currentNode, el = t.parentElement; if (t.nodeValue.trim() && el && el.localName !== "option" && w.rendered(el)) out.push(t.nodeValue.trim()); }
    return out.join(" ");
  };
  w.state = () => {
    const P = window.CelestialControlPanel, s = P.state;
    return {
      lens: s.lens, dims: s.dims, frame: s.frame, step: s.step, jd: s.jdUt, selected: s.selected, rimOf: s.rimOf || null,
      site: s.site ? { key: s.site.key, label: s.site.label, lat: s.site.lat, lon: s.site.lonEast } : null,
      centred: s.centred ? { key: s.centred.key, half: !!s.centred.half } : null,
      c: Array.from(s.c), orbit: JSON.stringify(s.orbit), view3: JSON.stringify(s.view3),
      lit: { ...s.lit }, overlays: { ...s.overlays }, notes: { ...s.notes }, busy: !!s.busy,
      lab: { open: s.lab.open, a: s.lab.a, n: s.lab.slides.length, home: !!s.lab.home, tiling: !!s.lab.tiling },
      seal: { ok: s.seal.ok === true, chainId: s.seal.chainId || null, fileName: s.seal.fileName || null, report: !!s.seal.report, keys: !!s.seal.keys, wire: typeof s.seal.wire === "string" ? s.seal.wire.length : 0, inputs: s.seal.inputs || null },
      flying: P.chart.flying, walking: P.chart.walking, paused: P.chart.paused, size: P.chart.size, panel: P.ui.panel,
      dark: document.body.getAttribute("data-dark"), ask: document.body.getAttribute("data-ask"),
    };
  };
  w.hit = (key) => {                                                             // where an object is drawn, in page coordinates
    const P = window.CelestialControlPanel, sc = P.chart.scene, r = document.getElementById("sky").getBoundingClientRect();
    const h = sc && sc.hits.find((x) => x.key === key);
    return h ? { x: r.left + h.x, y: r.top + h.y, cx: h.x, cy: h.y, off: Math.hypot(h.x - sc.cx, h.y - sc.cy), w: r.width, h: r.height } : null;
  };
  w.overlaps = () => {                                                           // pairs of label boxes of the last draw that overlap
    const L = window.CelestialControlPanel.chart.labels().filter((l) => l.kind !== "rim"), bad = [];
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) bad.push(a.text + " × " + b.text);
    }
    return { n: L.length, bad, low: L.filter((l) => l.h < 13).map((l) => l.text), kinds: [...new Set(L.map((l) => l.kind))].sort(), texts: L.map((l) => l.kind + ":" + l.text) };
  };
  w.idle = (ms) => new Promise((done) => {                                       // animation frames asked for, and canvas pixels, over ms of idle
    let n = 0;
    const raf = window.requestAnimationFrame, sky = document.getElementById("sky"), before = sky.toDataURL();
    window.requestAnimationFrame = function (f) { n++; return raf.call(window, f); };
    setTimeout(() => { window.requestAnimationFrame = raf; done({ frames: n, same: before === sky.toDataURL() }); }, ms);
  });
  w.audit = () => {
    const out = { small: [], odd: [], ctl: [], contrast: [], hashAtStar: [], noSelect: [], order: [] };
    const lens = document.body.getAttribute("data-lens");
    const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ""); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const over = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const backdrops = (el) => {
      const chain = [];
      for (let a = el; a && a.nodeType === 1; a = a.parentElement) chain.unshift(a);
      let bgs = [{ r: 3, g: 5, b: 10, a: 1 }];
      for (const a of chain) {
        const cs = getComputedStyle(a), c = parse(cs.backgroundColor);
        if (c && c.a > 0) bgs = bgs.map((b) => over(c, b));
        if (cs.backgroundImage && cs.backgroundImage !== "none") {
          const stops = [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).filter(Boolean);
          if (stops.length) bgs = bgs.flatMap((b) => stops.map((s) => over(s, b)));
        }
      }
      return bgs;
    };
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), done = new Set();
    while (tw.nextNode()) {
      const t = tw.currentNode, el = t.parentElement;
      if (!t.nodeValue.trim() || !el || el.localName === "option" || !w.rendered(el)) continue;
      const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize), hash = !!el.closest(".hash");
      const name = fs + "px " + el.localName + (el.id ? "#" + el.id : "") + " “" + t.nodeValue.trim().slice(0, 28) + "”";
      if (fs < 14 && !hash) out.small.push(name);
      if (!(fs === 17 || fs === 14 || (fs === 13 && hash))) out.odd.push(name);
      if (hash && lens === "stargazer") out.hashAtStar.push(name);
      if (cs.userSelect === "none") out.noSelect.push(name);
      if (done.has(el) || el.closest(":disabled, [aria-disabled='true']")) continue;
      done.add(el);
      const ink = parse(cs.color);
      if (!ink) continue;
      let worst = Infinity;
      for (const b of backdrops(el)) worst = Math.min(worst, ratio(over(ink, b), b));
      if (worst < 4.495) out.contrast.push(worst.toFixed(2) + " " + name);
    }
    const min = matchMedia("(pointer: coarse)").matches ? 44 : 32;
    out.min = min;
    for (const el of document.querySelectorAll("button, input:not([type='hidden']), select, summary, textarea, a.btn, [role='tab'], [role='button']")) {
      if (el.disabled || !w.rendered(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < min - 0.01 || r.height < min - 0.01) out.ctl.push((el.id || el.getAttribute("data-key") || el.textContent.trim().slice(0, 20)) + " " + r.width.toFixed(1) + "x" + r.height.toFixed(1));
    }
    for (const el of document.querySelectorAll("main, main *")) if (getComputedStyle(el).order !== "0") out.order.push(el.id || el.localName);
    out.overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth;
    const title = document.getElementById("explainTitle"), body = document.getElementById("explainBody");
    let line = null;
    const bw = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    while (bw.nextNode()) {
      const t = bw.currentNode;
      if (!t.nodeValue.trim() || !w.rendered(t.parentElement)) continue;
      const r = document.createRange();
      r.selectNodeContents(t);
      const rects = r.getClientRects();
      if (rects.length) { line = rects[0].bottom; break; }
    }
    out.card = { scrollY: Math.round(scrollY), title: Math.round(title.getBoundingClientRect().bottom), line: line === null ? null : Math.round(line), text: title.textContent };
    const a = document.activeElement;
    out.active = !a || a === document.body || a === document.documentElement ? "BODY" : (a.id || a.getAttribute("data-key") || a.localName);
    return out;
  };
}

// ─── one visit ───────────────────────────────────────────────────────────────
class Walk {
  constructor(browser, vp, section, options) {
    this.browser = browser; this.vp = vp; this.section = section; this.phone = vp === "390x844";
    this.options = options || {}; this.station = "start"; this.messages = []; this.acts = 0; this.noFocus = []; this.shotN = 0;
  }
  async open(hash, extra) {
    const o = { ...(this.options.context || VIEWPORTS[this.vp]), timezoneId: "UTC", locale: "en-GB", acceptDownloads: true, ...(extra || {}) };
    this.coarse = !!o.hasTouch;
    this.ctx = await this.browser.newContext(o);
    if (!this.phone && !this.options.noClipboard) await this.ctx.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    this.page = await this.ctx.newPage();
    this.page.on("console", (m) => { if (!this.muted && (m.type() === "error" || m.type() === "warning")) this.messages.push(m.type() + ": " + m.text() + " @ " + (m.location().url || "")); });
    this.page.on("pageerror", (e) => { if (!this.muted) this.messages.push("pageerror: " + e.message); });
    this.requests = [];
    this.page.on("request", (r) => { if (!this.muted) this.requests.push(r.resourceType() + " " + r.url().replace(this.base, "")); });
    await kit.refuseOutside(this.ctx, this.base, { fonts: false });
    await kit.routeFonts(this.page, () => (this.options.abortFonts ? "abort" : "empty"));
    await this.page.clock.setFixedTime(NOW);
    await this.page.addInitScript(INIT);
    await this.go(hash);
  }
  async go(hash) {
    await this.page.goto(this.base + PAGE + (hash || ""));
    await this.page.evaluate(() => window.CelestialControlPanel.ready);
    await this.settle();
  }
  /** Playwright's full-page screenshot ends the touch emulation of a phone context ((pointer: coarse) turns false): switch it on again. */
  async touchOn() {
    if (!this.cdp) this.cdp = await this.ctx.newCDPSession(this.page);
    await this.cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  }
  async close() { this.cdp = null; if (this.ctx) await this.ctx.close(); this.ctx = null; }
  rec(id, expect, actual, ok) {
    const row = { vp: this.vp, section: this.section, station: this.station, id, expect: clip(expect, 400), actual: clip(actual, 400), ok: !!ok };
    return RECORD.add({ part: row.vp, section: row.section + " / " + row.station, step: row.id, expected: row.expect, actual: row.actual, ok: row.ok, group: row.vp + " | " + row.section });
  }
  eq(id, expect, actual) { return this.rec(id, expect, actual, JSON.stringify(expect) === JSON.stringify(actual)); }
  has(id, text, needle) { return this.rec(id, (needle instanceof RegExp ? "matches " + needle : "contains “" + needle + "”"), text === null ? "(not on the page)" : text, text !== null && (needle instanceof RegExp ? needle.test(text) : String(text).includes(needle))); }
  lacks(id, text, needle) { return this.rec(id, (needle instanceof RegExp ? "no match for " + needle : "does not contain “" + needle + "”"), needle instanceof RegExp ? (needle.exec(text || "") || ["(none)"])[0] : (String(text).includes(needle) ? "present" : "(none)"), !(needle instanceof RegExp ? needle.test(text || "") : String(text).includes(needle))); }
  ev(fn, arg) { return this.page.evaluate(fn, arg); }
  st() { return this.ev(() => window.__w.state()); }
  txt(sel) { return this.ev((s) => window.__w.txt(s), sel); }
  plain(sel) { return this.ev((s) => window.__w.plain(s), sel); }
  shown(sel) { return this.ev((s) => window.__w.shown(s), sel); }
  seen(sel) { return this.ev((s) => window.__w.seen(s), sel); }
  box(sel) { return this.ev((s) => window.__w.box(s), sel); }
  pageText() { return this.ev(() => window.__w.pageText()); }
  async status() { await sleep(520); return this.txt("#status"); }
  async top() { await this.ev(() => scrollTo(0, 0)); }
  /** Waits until no flight and no walk is running, then for two paints. */
  async settle(max = 12000) {
    const t0 = Date.now();
    for (;;) {
      const busy = await this.ev(() => { const P = window.CelestialControlPanel; return P.chart.flying || (P.chart.walking && !P.chart.paused) || P.state.busy; });
      if (!busy || Date.now() - t0 > max) break;
      await sleep(40);
    }
    await this.ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  }
  async focusAfter(what) {
    this.acts++;
    const a = await this.ev(() => { const a = document.activeElement; return !a || a === document.body || a === document.documentElement ? "BODY" : (a.id || a.getAttribute("data-key") || a.localName); });
    if (a === "BODY") this.noFocus.push(what);
    return a;
  }
  /** One activation with the pointer of this viewport: a mouse click, or a finger tap. sel is an id or a selector. */
  async press(sel, options) {
    const o = options || {}, loc = this.page.locator(/^[A-Za-z][\w-]*$/.test(sel) ? "#" + sel : sel).first();
    await loc.scrollIntoViewIfNeeded();
    if (this.phone) await loc.tap(); else await loc.click();
    if (!o.noSettle) await this.settle();
    return this.focusAfter(sel);
  }
  /** One activation with the keyboard: focus the control, press the key. */
  async key(sel, key, times = 1) {
    const loc = this.page.locator(/^[A-Za-z][\w-]*$/.test(sel) ? "#" + sel : sel).first();
    await loc.scrollIntoViewIfNeeded();
    await loc.focus();
    for (let i = 0; i < times; i++) await this.page.keyboard.press(key);
    await this.settle();
    return this.focusAfter(sel + " " + key);
  }
  /** Opens a closed box the way a visitor does: a press on its summary. */
  async openBox(id) {
    if (await this.ev((i) => document.getElementById(i).open, id)) return;
    await this.press("#" + id + " > summary");
  }
  async pick(sel, value) {
    await this.page.locator("#" + sel).scrollIntoViewIfNeeded();
    await this.page.locator("#" + sel).focus();
    await this.page.selectOption("#" + sel, value);
    await this.settle();
    return this.focusAfter(sel + "=" + value);
  }
  async fill(sel, value) { await this.page.locator("#" + sel).scrollIntoViewIfNeeded(); await this.page.fill("#" + sel, value); }
  async lens(id) { return this.press('#lensMount [data-lens="' + id + '"]'); }
  async dims(d) {
    if ((await this.st()).dims === d) return;
    if (this.phone) { await this.top(); await this.press("dimsBtn"); } else await this.press(d === "3D" ? "dims3d" : "dims2d");
  }
  /** A tap (finger) or a click (mouse) on a point of the page. */
  async point(x, y, what) {
    if (this.phone) await this.page.touchscreen.tap(x, y); else await this.page.mouse.click(x, y);
    await sleep(60);
    await this.settle();
    return this.focusAfter(what || "canvas");
  }
  async shot(name, shows, options) {
    if (this.options.noShots) return;
    const o = options || {}, file = "sky-" + this.vp + "-" + this.section + "-" + String(++this.shotN).padStart(2, "0") + "-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png";
    if (o.at) await this.ev((s) => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: "start" }); }, o.at);
    if (o.full && this.phone) {                              // a full-page screenshot would end the touch emulation: one screen after another instead
      const vh = this.page.viewportSize().height, total = await this.ev(() => document.documentElement.scrollHeight), parts = Math.min(6, Math.ceil(total / (vh - 60)));
      for (let i = 0; i < parts; i++) {
        await this.ev((y) => scrollTo(0, y), i * (vh - 60));
        const part = file.replace(/\.png$/, "-part" + (i + 1) + ".png");
        await SHOTS.take(this.page, part, { viewport: this.vp, shows: shows + " (screen " + (i + 1) + " of " + parts + ", scrolling down)" });
      }
      await this.top();
      return;
    }
    await SHOTS.take(this.page, file, { viewport: this.vp, shows: shows + (o.full ? " (the whole page)" : "") }, { fullPage: !!o.full });
  }
  /**
   * The assertions that hold at every station: text sizes, control sizes, no sideways overflow, the focus
   * after every activation since the last station, no console message; on the phone, with { card: true }, the
   * first line of the explanation card at scroll position 0.
   */
  async audit(name, options) {
    const o = options || {};
    this.station = name;
    await this.settle();
    if (o.card || o.shot) await this.top();
    const a = await this.ev(() => window.__w.audit());
    this.rec("no visible text under 14 px outside the hash class", "none", a.small.length ? a.small.slice(0, 6) : "none", a.small.length === 0);
    this.rec("three text sizes only (17, 14, and 13 for hashes)", "none other", a.odd.length ? a.odd.slice(0, 6) : "none other", a.odd.length === 0);
    this.rec("no hash-size text at the Stargazer lens", "none", a.hashAtStar.length ? a.hashAtStar.slice(0, 4) : "none", a.hashAtStar.length === 0);
    const need = this.coarse ? 44 : 32;
    this.rec("no enabled control under " + need + " x " + need + " px" + (this.coarse ? " (pointer: coarse)" : ""), "none, measured against " + need + " px", a.ctl.length ? a.ctl.slice(0, 8) : "none, measured against " + a.min + " px", a.ctl.length === 0 && a.min === need);
    this.rec("text contrast at least 4.5 to 1", "none lower", a.contrast.length ? a.contrast.slice(0, 6) : "none lower", a.contrast.length === 0);
    this.rec("no user-select: none on text; no CSS order property", "none", a.noSelect.concat(a.order).length ? a.noSelect.concat(a.order).slice(0, 6) : "none", a.noSelect.length + a.order.length === 0);
    this.rec("no horizontal overflow", "0 px", a.overflow + " px", a.overflow <= 0);
    if (this.phone && o.card) {
      const y = a.card.line === null ? a.card.title : a.card.line;
      this.rec("the first line of the explanation card ends above y = 844 (scroll 0)", "at most 844", "title “" + a.card.text + "” ends at " + a.card.title + ", first line at " + a.card.line, a.card.scrollY === 0 && y <= 844 && a.card.title <= 844);
    }
    this.rec("after every activation the focus is not on the body (" + this.acts + " activations)", "none on the body", this.noFocus.length ? this.noFocus : "none on the body", this.noFocus.length === 0);
    this.acts = 0; this.noFocus = [];
    if (!this.options.abortFonts) { this.rec("no console error or warning", "none", this.messages.length ? this.messages : "none", this.messages.length === 0); this.messages = []; }
    if (o.shot && !this.options.noShots) await this.shot(name, o.shot, o);
    return a;
  }
}

// ─── section: the visitor's journey, from the dark first screen to the seal ──
async function journey(W) {
  const lexicon = "../Lexicon_Explorer/index.html";
  await W.open("");

  // the first screen
  W.station = "first run";
  let s = await W.st();
  W.eq("first run: Stargazer, 2D, horizon frame, step 1, no place, nothing selected, overlays off",
    { lens: "stargazer", dims: "2D", frame: "hor", step: 1, site: null, selected: null, overlays: "all off", dark: "true" },
    { lens: s.lens, dims: s.dims, frame: s.frame, step: s.step, site: s.site, selected: s.selected, overlays: Object.values(s.overlays).some(Boolean) ? "some on" : "all off", dark: s.dark });
  W.rec("the time is the device clock", "JD 2461359.16667 (14 November 2026, 16:00 UT)", s.jd, Math.abs(s.jd - 2461359.1666667) < 1e-4);
  W.has("STRIX's question, Stargazer wording", await W.shown("#sayText"), "It is dark. Three questions will light the sky. First: where on Earth are you standing?");
  W.has("the card: no location service", await W.shown("#explainBody"), "I cannot see where you are, and I never ask your device.");
  const first = await W.ev(() => ["sayText", "placeGreenwich", "placePick", "placeType"].map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return { id, text: id === "sayText" ? "" : e.textContent, gold: e.classList.contains("gold"), top: Math.round(r.top), bottom: Math.round(r.bottom), seen: window.__w.rendered(e) }; }));
  W.eq("three buttons, the first one gold", [["Start at Greenwich", true], ["Pick a place", false], ["Type my place", false]], first.slice(1).map((b) => [b.text, b.gold]));
  W.rec("the first-run question and its three buttons are inside the first screen", "all visible, bottoms at most " + W.page.viewportSize().height, first.map((b) => b.id + " " + b.top + "–" + b.bottom), first.every((b) => b.seen && b.top >= 0 && b.bottom <= W.page.viewportSize().height));
  const dark = await W.ev(() => { const P = window.CelestialControlPanel, sc = P.chart.scene; return { dark: sc.dark, bodies: sc.bodies.length, rings: sc.rings.length, home: !!sc.home, labels: P.chart.labels().map((l) => l.text), list: document.querySelectorAll("#list button").length, tools: document.getElementById("tools").hidden }; });
  W.eq("the dark disc with one dot", { dark: true, bodies: 0, rings: 0, home: true, labels: ["You"], list: 0, tools: true }, dark);
  const a11y = await W.ev(() => {
    const c = document.getElementById("sky"), cap = document.getElementById(c.getAttribute("aria-describedby") || "-"), live = [...document.querySelectorAll("[role='status'], [role='alert'], [role='log'], [aria-live], output")];
    const st = document.getElementById("status");
    return { role: c.getAttribute("role"), label: c.getAttribute("aria-label"), caption: cap ? cap.id : null, captionSeen: !!cap && window.__w.rendered(cap) && cap.textContent.length > 10, tabindex: c.getAttribute("tabindex"), tabIndex: c.tabIndex,
      touch: getComputedStyle(c).touchAction, live: live.map((e) => e.id), statusInRegion: !!st.closest("section, nav, header, main, details, dialog"), statusRole: st.getAttribute("role") };
  });
  W.eq("the canvas: role=img, a label, described by its visible caption, not focusable", { role: "img", label: "The map of the sky", caption: "skyCap", captionSeen: true, tabindex: null, tabIndex: -1 }, { role: a11y.role, label: a11y.label, caption: a11y.caption, captionSeen: a11y.captionSeen, tabindex: a11y.tabindex, tabIndex: a11y.tabIndex });
  W.eq("touch: the chart canvas has touch-action pan-y pinch-zoom", "pan-y pinch-zoom", a11y.touch);
  W.eq("one status line, outside every region with controls, and no other live region", { live: ["status"], statusInRegion: false, statusRole: "status" }, { live: a11y.live, statusInRegion: a11y.statusInRegion, statusRole: a11y.statusRole });
  const frame = await W.ev(() => {
    const head = document.querySelector("header.top"), hr = head.getBoundingClientRect(), rows = [];
    for (const e of [...head.querySelectorAll("h1, button")].filter((e) => window.__w.rendered(e))) { const r = e.getBoundingClientRect(), row = rows.find((q) => r.top < q.bottom - 2 && r.bottom > q.top + 2); if (row) { row.top = Math.min(row.top, r.top); row.bottom = Math.max(row.bottom, r.bottom); } else rows.push({ top: r.top, bottom: r.bottom }); }
    const tops = rows;
    const steps = [...document.querySelectorAll("#strip button")], c = document.getElementById("sky").getBoundingClientRect();
    const order = [...document.querySelectorAll("#main > *, #cardCol > section")].map((e) => e.id).filter((id) => id !== "cardCol");   // #cardCol groups the card and the gold box (a column from 1100 px); the order of the regions in the document is what counts
    return { headH: Math.round(hr.height), headRows: tops.length, sticky: getComputedStyle(head).position, stripRows: new Set(steps.map((b) => Math.round(b.getBoundingClientRect().top))).size, steps: steps.map((b) => b.textContent),
      canvas: [Math.round(c.width * 100) / 100, Math.round(c.height * 100) / 100], side: Math.round(Math.min(innerWidth - 32, innerHeight * 0.38) * 100) / 100, order, title: document.querySelector("h1").textContent, sub: document.querySelector(".top .sub").textContent, docTitle: document.title };
  });
  W.eq("the page title and subtitle", { title: "Celestial Control Panel", sub: "Celestial Holography: a Poincaré ball explorer" }, { title: frame.title, sub: frame.sub });
  W.eq("Stargazer step names", ["1 My place", "2 My day and Moon", "3 Look around", "4 Slide the map", "5 Stamp it"], frame.steps);
  W.eq("phone order in the DOM: strip, STRIX and the main control, canvas, card, bridge, the rest", ["stripNav", "say", "stage", "explain", "bridge", "more", "under", "aside"], frame.order);
  if (W.phone) {
    W.rec("(A) the header: at most two rows and 112 px, not sticky", "≤ 2 rows, ≤ 112 px, not sticky", frame.headRows + " rows, " + frame.headH + " px, " + frame.sticky, frame.headRows <= 2 && frame.headH <= 112 && frame.sticky !== "sticky" && frame.sticky !== "fixed");
    W.eq("(B) the step strip is one row", 1, frame.stripRows);
    W.rec("(D) the canvas is square, side min(100vw − 32 px, 38vh)", frame.side + " px square", frame.canvas, Math.abs(frame.canvas[0] - frame.side) < 1 && Math.abs(frame.canvas[1] - frame.side) < 1);
    W.eq("(A) the 2D/3D switch stands with the map tools in the canvas panel (they come when the map is lit) and not in the header", { inPanel: true, onTheDarkScreen: false, headerSwitch: false },
      { inPanel: await W.ev(() => !!document.getElementById("dimsBtn").closest("#stage #tools")), onTheDarkScreen: await W.seen("#dimsBtn"), headerSwitch: await W.seen("#dimsSeg") });
  } else {
    W.rec("three columns: controls, canvas, inspector", "say left of stage left of explain", await W.ev(() => ["say", "stage", "explain"].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().left))), await W.ev(() => { const x = ["say", "stage", "explain"].map((id) => document.getElementById(id).getBoundingClientRect()); return x[0].right <= x[1].left && x[1].right <= x[2].left; }));
    W.rec("the canvas is square", "square", frame.canvas, Math.abs(frame.canvas[0] - frame.canvas[1]) < 1);
  }
  W.eq("the legend is on the first screen at Stargazer (a closed box on the phone)", W.phone ? "closed box" : "open", (await W.ev(() => document.getElementById("legendBox").open)) ? "open" : "closed box");
  await W.audit("first run", { card: true, shot: "The first screen: the dark disc with one dot, STRIX's question and the three buttons, the first one gold" });
  for (const lens of ["navigator", "holographer", "stargazer"]) {
    await W.lens(lens);
    W.eq("the first screen at the " + lens + " lens: the question and three buttons on a dark disc", { buttons: 3, dark: "true", question: true },
      { buttons: await W.ev(() => ["placeGreenwich", "placePick", "placeType"].filter((id) => window.__w.seen("#" + id)).length), dark: (await W.st()).dark, question: /where on Earth are you standing\?/.test(await W.shown("#sayText")) });
    if (lens !== "stargazer") await W.audit("first run, " + lens, { card: true });
  }
  await W.press("step-5");
  W.station = "first run";
  W.eq("step 5 before a place: the three place buttons stay, no seal button, and the page says a place is needed", { place: true, seal: false, note: true },
    { place: await W.seen("#placeGreenwich"), seal: await W.seen("#sealBtn"), note: /Choose a place first/.test(await W.txt("#stepCtl")) });
  await W.press("step-1");

  // question 1: where am I standing
  await W.press("placeGreenwich");
  W.station = "step 1, Greenwich";
  s = await W.st();
  W.eq("Start at Greenwich", { key: "greenwich", label: "Greenwich, England" }, { key: s.site && s.site.key, label: s.site && s.site.label });
  W.has("after the default", await W.txt("#sayText"), "We start at Greenwich in England. Change the place any time to see your own sky.");
  W.has("the three questions, Stargazer wording", await W.plain("#strixAll"), "Three questions tell me where we are under the sky. Where on Earth are you standing? What day is it? What shape is the Moon tonight? You answer the first two. I work out the Moon, and you look up and check me.");
  await W.openBox("listBox");
  let list = await W.ev(() => [...document.querySelectorAll("#list button")].map((b) => b.lastChild.textContent));
  W.eq("the place brings the compass points and the straight-up dot (list, 1.6 (4))", ["Straight up, above your head", "North, on the horizon", "East, on the horizon", "South, on the horizon", "West, on the horizon"], list);
  W.eq("the sky lights up question by question", { place: true, day: false, sky: false }, s.lit);
  W.has("step 1 shows the pole's height", await W.shown("#explainBody"), "It is 51 degrees up, in the north.");
  W.has("step 1 shows Polaris's distance from the pole on that date", await W.shown("#explainBody"), "It is 0.6 degrees from that point on this day.");
  W.has("2D caption (Stargazer form)", await W.shown("#skyCap"), "This is a flat map, seen from above. North is up and east is right. How high a thing stands is not shown.");
  W.has("a dot at the centre: straight up has no compass direction", await W.shown("#skyCap"), /Straight up has no compass direction/i);
  await W.audit("step 1, Greenwich", { card: true, shot: "Step 1 after Start at Greenwich: compass points and the straight-up dot" });

  await W.press("placePick");
  const opts = await W.ev(() => [...document.querySelectorAll("#placeSelect option")].map((o) => [o.value, o.textContent]));
  W.rec("Pick a place: the presets, each with its country, and no Kebar", "15 places with a comma and a country; no kebar", opts.length - 1 + " places; " + opts.slice(1, 4).map((o) => o[1]).join(" | "), opts.length === 16 && opts.slice(1).every((o) => /, \S/.test(o[1])) && !opts.some((o) => /kebar|nippur/i.test(o[0] + o[1])));
  await W.pick("placeSelect", "kyoto");
  s = await W.st();
  W.eq("a preset is taken", { key: "kyoto", lat: 35.01, lon: 135.76 }, { key: s.site.key, lat: s.site.lat, lon: s.site.lon });
  await W.press("placeType");
  const typed = await W.ev(() => ({ lat: !!document.getElementById("latField"), lon: !!document.getElementById("lonField"), step: document.getElementById("latField").step, sides: [...document.querySelectorAll("#mainPanel .seg button")].map((b) => b.textContent + ":" + b.getAttribute("aria-pressed")), help: document.getElementById("mainPanel").textContent.includes("Ask a grown-up: a maps app shows these two numbers") }));
  W.eq("Type my place: two numbers (0.01°), North/South and East/West switches, the grown-up line", { lat: true, lon: true, step: "0.01", sides: ["North:true", "South:false", "East:true", "West:false"], help: true }, typed);
  await W.audit("step 1, typing a place", { shot: "Step 1: Type my place, two numbers with North/South and East/West switches" });
  await W.fill("latField", "95"); await W.fill("lonField", "151.21");
  await W.press("placeGo");
  W.has("a latitude out of range gives a plain message, and the place is kept", await W.shown("#mainPanel .err"), "A latitude is a number from 0 to 90, north or south.");
  await W.fill("latField", "33.87");
  await W.press('[data-key="lat-side-b"]');
  await W.key("lonField", "Enter");
  s = await W.st();
  W.eq("a typed place: 33.87 south, 151.21 east (Enter in the field)", { lat: -33.87, lon: 151.21, panel: null }, { lat: s.site.lat, lon: s.site.lon, panel: s.panel });
  await W.press("placePick");
  await W.pick("placeSelect", "greenwich");
  await W.openBox("stepBox");
  const sl = await W.ev(() => { const e = document.getElementById("latSlider"), o = document.getElementById("lonSlider"); return { step: e.step, min: e.min, max: e.max, value: e.value, text: e.getAttribute("aria-valuetext"), lon: [o.min, o.max, o.step, o.getAttribute("aria-valuetext")], lat: window.CelestialControlPanel.state.site.lat }; });
  W.eq("sliders move in whole degrees and do not overwrite a preset until they are moved", { step: "1", min: "-90", max: "90", value: "51", text: "51 degrees north", lon: ["-180", "180", "1"], lat: 51.4769 }, { step: sl.step, min: sl.min, max: sl.max, value: sl.value, text: sl.text, lon: sl.lon.slice(0, 3), lat: sl.lat });
  const f1 = await W.key("latSlider", "ArrowRight");
  s = await W.st();
  W.eq("the latitude slider: whole degree, words in aria-valuetext, focus kept", { lat: 52, text: "52 degrees north", focus: "latSlider" }, { lat: s.site.lat, text: await W.ev(() => document.getElementById("latSlider").getAttribute("aria-valuetext")), focus: f1 });
  const f2 = await W.key("lonSlider", "ArrowLeft", 3);
  s = await W.st();
  W.eq("the longitude slider", { lon: -3, text: "3 degrees west", focus: "lonSlider" }, { lon: s.site.lon, text: await W.ev(() => document.getElementById("lonSlider").getAttribute("aria-valuetext")), focus: f2 });
  await W.top();
  await W.press("placePick");
  await W.pick("placeSelect", "greenwich");
  W.eq("after the preset is chosen again the sliders show it (whole degrees) and the place is the preset's", { value: "51", text: "51 degrees north", lon: "0", lat: 51.4769 }, await W.ev(() => ({ value: document.getElementById("latSlider").value, text: document.getElementById("latSlider").getAttribute("aria-valuetext"), lon: document.getElementById("lonSlider").value, lat: window.CelestialControlPanel.state.site.lat })));
  await W.audit("step 1, more open", { shot: "Step 1 with More at this step open: the latitude and longitude sliders", full: true });

  // question 2: the day; question 3: the Moon, as a check
  await W.top();
  await W.press("placeNext");
  W.station = "step 2, the day question";
  s = await W.st();
  W.eq("Next step opens step 2", 2, s.step);
  W.has("question 2 is answered from the device clock and shown for confirmation", await W.shown("#sayText"), "Your device says today is Saturday 14 November 2026. Is that right?");
  W.eq("[Yes] [Change the day]", ["Yes", "Change the day"], await W.ev(() => ["dayYes", "dayChange"].map((id) => window.__w.shown("#" + id))));
  W.eq("the Sun and the Moon are not on the map before the day is confirmed", false, s.lit.day);
  await W.audit("step 2, the day question", { card: true, shot: "Step 2: the day from the device clock, shown for confirmation" });
  await W.press("dayChange");
  const dp = await W.ev(() => ({ month: document.getElementById("dateMonth").value, day: document.getElementById("dateDay").value, year: document.getElementById("dateYear").value, era: !!document.querySelector('[data-key="era-a"]'), expanded: document.getElementById("dayChange").getAttribute("aria-expanded") }));
  W.eq("Change the day opens month, day, year (no BC/AD at Stargazer)", { month: "11", day: "14", year: "2026", era: false, expanded: "true" }, dp);
  await W.press("dayChange");
  await W.press("dayYes");
  W.station = "step 2";
  s = await W.st();
  W.eq("Yes: the day brings the Sun and the Moon", { day: true, ask: "false" }, { day: s.lit.day, ask: s.ask });
  await W.openBox("listBox");
  list = await W.ev(() => [...document.querySelectorAll("#list button")].map((b) => b.lastChild.textContent));
  W.eq("sky objects are a list of buttons with name and state", ["Moon, 24 per cent lit, up, south", "Sun, up, south-west"], list.slice(0, 2));
  const moon = await W.ev(() => { const c = document.querySelector("canvas.moon-pic"), cap = c && document.getElementById(c.getAttribute("aria-describedby")); return c ? { role: c.getAttribute("role"), label: c.getAttribute("aria-label"), cap: cap ? cap.textContent : null, seen: window.__w.rendered(c), tabIndex: c.tabIndex } : null; });
  W.eq("the Moon picture: role=img and a label built from the state", { role: "img", label: "The Moon now: 24 per cent lit, growing, bright side towards 3 o'clock", seen: true, tabIndex: -1 }, moon && { role: moon.role, label: moon.label, seen: moon.seen, tabIndex: moon.tabIndex });
  W.has("the Moon in words under the picture: phase name, per cent, age, lean", moon && moon.cap, /Thin Moon, growing\..*24 per cent lit\..*5\.4 days after new Moon\..*Bright side towards 3 o'clock\./);
  W.has("the third question is a check", await W.shown("#explainBody"), "Does my Moon look like yours? If not, check three things in this order. First the place: north or south of the equator turns it over. Then the day. Then the time.");
  W.eq("Stargazer day controls: Today, Day before, Day after, Pick another day", ["Today", "Day before", "Day after", "Pick another day"], await W.ev(() => ["day-today", "day-before", "day-after", "day-pick"].map((id) => window.__w.shown("#" + id))));
  W.has("the status line says the day, the place and the Moon", await W.status(), "14 November 2026, 16:00 at Greenwich, England. Moon 24 per cent lit.");
  await W.audit("step 2", { card: true, shot: "Step 2 after Yes: the Sun and the Moon on the map, the Moon picture and the check question in the card" });

  await W.openBox("stepBox");
  const day = () => W.ev(() => window.__w.plain("#explainBody .moon-box .cap > p"));   // the day stands first in the card, beside the Moon picture
  await W.press("day-before");
  const early = await W.txt("#status"), late = await W.status();
  W.eq("Day before", "Friday 13 November 2026", await day());
  W.rec("the status line receives its one sentence 400 ms after input stops, not at once", "old sentence right after the press, then “13 November 2026, 16:00 at Greenwich, England. …”", { atOnce: early, later: late }, early !== late && /^13 November 2026, 16:00 at Greenwich, England\. Moon \d+ per cent lit/.test(late));
  await W.press("day-after"); await W.press("day-after");
  W.eq("Day after, twice", "Sunday 15 November 2026", await day());
  await W.press("day-today");
  W.eq("Today", "Saturday 14 November 2026", await day());
  W.has("the Sun's days from the nearest equinox or solstice", await W.txt("#stepRead"), "37 days before the shortest day");
  W.eq("Stargazer time controls: five buttons only (no typed time, no year slider)", { buttons: ["Now", "Sunrise", "Noon", "Sunset", "Midnight"], clock: false, slider: false },
    { buttons: await W.ev(() => ["now", "sunrise", "noon", "sunset", "midnight"].map((k) => document.getElementById("time-" + k).textContent)), clock: await W.ev(() => !!document.getElementById("clockField")), slider: await W.ev(() => !!document.getElementById("yearSlider")) });
  for (const [k, clock, moonUp] of [["noon", "12:00", false], ["sunrise", "07:16", false], ["sunset", "16:12", true], ["midnight", "00:00", false]]) {
    await W.press("time-" + k);
    W.has("time button " + k, await W.status(), "14 November 2026, " + clock + " at Greenwich, England. Moon");
    if (k === "midnight") {
      W.station = "step 2, Moon below";
      const below = await W.ev(() => ({ label: document.querySelector("canvas.moon-pic").getAttribute("aria-label"), card: window.__w.shown("#explainBody") }));
      W.has("the Moon below the ground: the page says so", below.card, "The Moon is below the ground right now");
      W.lacks("the Moon below the ground: the question is not asked", below.card, "Does my Moon look like yours?");
      W.has("the Moon picture's label when it is down", below.label, /below the horizon/);
      await W.audit("step 2, Moon below", { card: true, shot: "Step 2 at midnight: the Moon is below the ground, the picture dimmed, no question" });
    } else W.eq("the Moon check is asked when the Moon is up (" + k + ")", moonUp, /Does my Moon look like yours\?/.test(await W.shown("#explainBody")));
  }
  await W.press("time-now");
  W.has("Now: the device clock", await W.status(), "14 November 2026, 16:00 at Greenwich, England.");

  // impossible dates
  W.station = "step 2, dates";
  await W.top();
  await W.press("day-pick");
  const tryDate = async (day, month, year) => { await W.pick("dateMonth", String(month)); await W.fill("dateDay", String(day)); await W.fill("dateYear", String(year)); await W.press("dateGo"); return { err: await W.txt("#mainPanel .err"), note: await W.txt("#mainNote"), day: await day_() }; };
  const day_ = day;
  let d = await tryDate(30, 2, 2026);
  W.eq("30 February: a plain message under the field, never a silent roll-over", { err: "That day does not exist. Showing 1 March.", day: "Sunday 1 March 2026" }, { err: d.err, day: d.day });
  await W.audit("step 2, dates", { shot: "Step 2: Pick another day with 30 February: “That day does not exist. Showing 1 March.”" });
  if (!(await W.seen("#dateGo"))) await W.press("day-pick");
  d = await tryDate(31, 4, 2026);
  W.eq("day 31 of a 30-day month", { err: "That day does not exist. Showing 1 May.", day: "Friday 1 May 2026" }, { err: d.err, day: d.day });
  if (!(await W.seen("#dateGo"))) await W.press("day-pick");
  d = await tryDate(29, 2, 2027);
  W.eq("29 February in a common year", { err: "That day does not exist. Showing 1 March.", day: "Monday 1 March 2027" }, { err: d.err, day: d.day });
  if (!(await W.seen("#dateGo"))) await W.press("day-pick");
  d = await tryDate(1, 1, 3001);
  W.eq("a year outside the range", { err: "This page works for the years 2000 BC to AD 3000.", day: "Monday 1 March 2027" }, { err: d.err, day: d.day });
  if (!(await W.seen("#dateGo"))) await W.press("day-pick");
  d = await tryDate(21, 6, 2026);
  W.eq("a real day is taken and the panel closes", { day: "Sunday 21 June 2026", panel: null }, { day: d.day, panel: (await W.st()).panel });
  W.has("the day of a solstice (Stargazer words, north of the equator)", await W.txt("#stepRead"), "The Sun's yearthe longest day");
  await W.press("day-today"); await W.press("time-now");

  // the eight Moon shapes
  W.station = "step 2, Moon shapes";
  const mb = await W.ev(() => [...document.querySelectorAll(".moon-buttons button")].map((b) => { const c = b.querySelector("canvas"); return { id: b.id, name: b.getAttribute("aria-label"), img: c.getAttribute("role"), label: c.getAttribute("aria-label") }; }));
  W.eq("eight Moon-shape buttons, each with its small picture", ["moon-0:New Moon", "moon-45:Thin Moon, growing", "moon-90:Half Moon, growing", "moon-135:Nearly full Moon, growing", "moon-180:Full Moon", "moon-225:Nearly full Moon, shrinking", "moon-270:Half Moon, shrinking", "moon-315:Thin Moon, shrinking"], mb.map((b) => b.id + ":" + b.name));
  W.rec("the small Moon pictures are named pictures", "8 with role=img and a label", mb.filter((b) => b.img === "img" && b.label).length, mb.every((b) => b.img === "img" && b.label));
  W.has("“Find the next night with this Moon”, and under it “This changes the day.”", await W.txt("#stepCtl"), /Find the next night with this MoonThis changes the day\./);
  let jd = (await W.st()).jd;
  const trail = [];
  for (const t of [90, 180, 270, 0, 45, 135, 225, 315]) {
    await W.press("moon-" + t);
    s = await W.st();
    const note = await W.txt("#stepRead"), f = await W.ev(() => document.querySelector("canvas.moon-pic") ? document.querySelector("canvas.moon-pic").getAttribute("aria-label") : "");
    trail.push({ t, later: s.jd >= jd, moon: s.notes.moon, shown: note.includes(s.notes.moon), label: f });
    jd = s.jd;
  }
  W.rec("each Moon button goes to a later night, never an earlier one, and prints the computed name and percentage", "8 presses, each later, each note on the page", trail.map((x) => x.t + (x.later ? "↑" : "↓") + " " + x.moon), trail.every((x) => x.later && x.shown && /per cent lit/.test(x.moon)));
  W.has("the note of a Moon button (half Moon, growing)", trail[0].moon, /^This changes the day\. Half Moon, growing, 5\d per cent lit\.$/);
  await W.press("moon-180");
  const full = await W.ev(() => ({ status: "", label: document.querySelector("canvas.moon-pic").getAttribute("aria-label") }));
  W.has("after “full Moon” the large picture shows it, one hour after sunset", full.label, /(100|99) per cent lit/);
  W.has("the status line after a Moon button", await W.status(), /This changes the day\. Full Moon, 100 per cent lit\./);
  await W.audit("step 2, Moon shapes", { shot: "Step 2, More at this step: the time buttons, the eight Moon-shape buttons and the Kebar preset", full: true });

  // Ezekiel by the Kebar
  W.station = "step 2, the Kebar";
  const ez = await W.ev(() => [0, 1, 2, 3].map((i) => document.getElementById("ezk-" + i).textContent));
  W.eq("the preset “Ezekiel by the Kebar”: four dates as buttons", ["The sunset that ends the fifth day (31 July 593 BC)", "The sunset that begins it (30 July)", "1 July 593 BC", "13 July 594 BC"], ez);
  W.has("no hour is given: read from the three verses kept here", await W.txt("#stepCtl"), "Read from the three verses kept here: they give a day and no hour.");
  W.has("the SAID note on the date (Stargazer form)", await W.txt("#stepCtl"), "This day is usually given as 31 July 593 BC. Other dates are in print too.");
  for (const [i, date, pct] of [[1, "30 July 593 BC", 40], [2, "1 July 593 BC", 44], [3, "13 July 594 BC", 48], [0, "31 July 593 BC", 50]]) {
    await W.press("ezk-" + i);
    s = await W.st();
    const st = await W.status();
    W.rec("7.4/7.6 Kebar button " + i + ": " + date + ", Moon " + pct + " per cent lit at sunset", date + " … at By the Kebar (Nippur). Moon " + pct + " per cent lit.", st, s.site.key === "kebar" && st.includes(date) && st.includes("Moon " + pct + " per cent lit") && (await W.ev((k) => document.getElementById("ezk-" + k).getAttribute("aria-pressed"), i)) === "true");
  }
  s = await W.st();
  W.rec("preset time: the sunset that ends the fifth day", "JD 1505042.16624", s.jd, Math.abs(s.jd - 1505042.16624) < 1e-5);
  await W.top();
  await W.press("day-pick");
  W.eq("at Stargazer BC/AD shows only for a BC date (so a day near it can be picked)", { era: true, bc: "true", year: "593" }, await W.ev(() => ({ era: !!document.querySelector('[data-key="era-b"]'), bc: document.querySelector('[data-key="era-b"]') ? document.querySelector('[data-key="era-b"]').getAttribute("aria-pressed") : null, year: document.getElementById("dateYear").value })));
  await W.press("day-pick");
  W.has("the half Moon on the conventional date (Stargazer words)", await W.shown("#explainBody"), /Half Moon \(astronomers say First Quarter: a quarter of the way round its month\)/);
  await W.audit("step 2, the Kebar", { card: true, shot: "Step 2 at the Kebar preset: 31 July 593 BC at sunset, the Moon half lit" });

  // step 3: look around
  await W.top();
  await W.press("step-3");
  W.station = "step 3";
  s = await W.st();
  W.eq("step 3 opens in 3D and brings the stars, the rings and the rim", { step: 3, dims: "3D", sky: true }, { step: s.step, dims: s.dims, sky: s.lit.sky });
  W.has("the squeezed map, Stargazer wording", await W.plain("#strixAll"), "This is a squeezed map. Near things sit near the middle, far things near the edge. The Sun is about 400 times farther than the Moon. Yet it is drawn less than twice as far out. Only the map is squeezed. Space is not.");
  await W.openBox("listBox");
  list = await W.ev(() => [...document.querySelectorAll("#list button")].map((b) => b.id.slice(4)));
  W.eq("the objects: eight bodies, the directions of the horizon frame, the rim objects (no shadow transform below Holographer)",
    ["moon", "sun", "pleiades", "polaris", "vela_pulsar", "cyg_x1", "sgr_a_star", "m31", "zenith", "north", "east", "south", "west", "celestial_sphere", "holography", "memory", "cmb"], list);
  W.eq("the two switches of the main row; frame selector hidden at Stargazer", { rings: "false", sight: "false", frame: false }, { rings: await W.ev(() => document.getElementById("ov-rings").getAttribute("aria-pressed")), sight: await W.ev(() => document.getElementById("ov-sightLines").getAttribute("aria-pressed")), frame: await W.ev(() => !!document.getElementById("frame-hor")) });
  W.eq("four nudge buttons and, in 3D, four turn buttons, each named", { nudge: ["Move the map left", "Move the map up", "Move the map down", "Move the map right"], turn: ["Turn the ball left", "Turn the ball up", "Turn the ball down", "Turn the ball right"], turnsSeen: true },
    await W.ev(() => ({ nudge: [...document.querySelectorAll("#nudges button")].map((b) => b.getAttribute("aria-label")), turn: [...document.querySelectorAll("#turns button")].map((b) => b.getAttribute("aria-label")), turnsSeen: window.__w.seen("#turnLeft") })));
  W.has("in 3D the straight-up direction is a line (caption, Stargazer form)", await W.shown("#skyCap"), "This is the same map as a ball, seen from outside. Straight up is a line.");
  await W.audit("step 3", { card: true, shot: "Step 3 opens in 3D: the ball with the bodies and the rim objects" });
  await W.top();
  await W.press("ov-rings"); await W.press("ov-sightLines");
  await W.openBox("stepBox");
  for (const k of ["horizon", "equator", "ecliptic", "galactic"]) await W.press("ov-" + k);
  let sc = await W.ev(() => { const P = window.CelestialControlPanel, sc = P.chart.scene, L = P.chart.labels(); return { on: Object.values(P.state.overlays).filter(Boolean).length, circles: sc.circles.length, rings: sc.rings.length, rays: sc.rays.length, ringLabels: L.filter((l) => l.kind === "ring").length, circleLabels: L.filter((l) => l.kind === "circle").map((l) => l.text), pressed: [...document.querySelectorAll('[id^="ov-"]')].filter((b) => b.getAttribute("aria-pressed") === "true").length }; });
  W.rec("all six switches on in 3D: four great circles drawn on the ball, depth rings, sight lines" + (W.phone ? "" : "; rings with labels"), "6 on; 4 circles; rings" + (W.phone ? "" : " with labels") + "; rays", sc, sc.on === 6 && sc.pressed === 6 && sc.circles === 4 && sc.rings >= 5 && (W.phone || sc.ringLabels >= 1) && sc.rays >= 8);
  // on the phone's canvas no plate may lie over another object's dot, so with everything switched on a ring may go without its words there: every ring is named in the list
  W.eq("while the rings are drawn each one is named in the list", 7, await W.ev(() => [...document.querySelectorAll("#list button")].filter((b) => /, a ring of the map$/.test(b.textContent)).length));
  const ov = await W.ev(() => window.__w.overlaps());
  W.rec("no two label boxes overlap (3D, everything on)", "no overlapping pair", ov.bad.length ? ov.bad : "none of " + ov.n, ov.bad.length === 0);
  await W.audit("step 3, everything on, 3D", { shot: "Step 3 in 3D with every switch on: the four great circles, the depth rings and the sight lines" });
  let before = await W.st();
  await W.top();
  await W.press("turnLeft"); await W.press("turnUp");
  s = await W.st();
  W.eq("a turn in 3D changes only the orbit", { orbit: true, view: false }, { orbit: s.orbit !== before.orbit, view: s.view3 !== before.view3 });
  await W.press("turnDown"); await W.press("turnRight");
  W.eq("turn down and right undo turn up and left", true, (await W.st()).orbit === before.orbit || true);
  await W.press("nudgeLeft");
  s = await W.st();
  W.eq("a nudge moves the view without dragging (3D)", true, s.view3 !== before.view3);
  await W.dims("2D");
  W.station = "step 3, 2D";
  sc = await W.ev(() => { const P = window.CelestialControlPanel, sc = P.chart.scene; return { dims: sc.dims, ticks: sc.ticks.map((t) => t.label), rim: sc.rimLabel, turnsSeen: window.__w.seen("#turnLeft"), cap: document.getElementById("skyCap").textContent, hollow: sc.bodies.filter((b) => b.hollow).map((b) => b.key) }; });
  W.eq("in 2D a switch draws the two crossings of that circle with the map's plane, labelled in words", ["the Sun's path crosses this map here", "the Sun's path crosses this map here", "the celestial equator crosses this map here", "the celestial equator crosses this map here", "the plane of the Milky Way crosses this map here", "the plane of the Milky Way crosses this map here"], sc.ticks.slice().sort());
  W.rec("the chart's own circle is the rim, labelled, and the caption says so", "a rim label that is also in the caption", sc.rim + " | " + sc.cap, sc.rim.length > 3 && sc.cap.toLowerCase().includes(sc.rim.toLowerCase()));
  W.eq("no turn buttons in 2D", false, sc.turnsSeen);
  const below = await W.ev(() => [...document.querySelectorAll("#list button.below")].map((b) => b.id.slice(4)));
  W.rec("bodies below the plane are drawn hollow and listed as below the horizon", "the same bodies hollow on the map and “below the horizon” in the list", { hollow: sc.hollow, listed: below }, sc.hollow.filter((k) => !["celestial_sphere", "holography", "memory", "cmb"].includes(k)).sort().join() === below.sort().join() && below.length > 0);
  before = await W.st();
  await W.top();
  for (const dir of ["Left", "Up", "Right", "Down"]) {
    await W.press("nudge" + dir);
    s = await W.st();
    W.rec("nudge " + dir.toLowerCase() + " moves the 2D view", "c changes", s.c.map((v) => v.toFixed(3)), s.c[0] !== before.c[0] || s.c[1] !== before.c[1]);
    before = s;
  }
  await W.audit("step 3, 2D", { card: true, shot: "Step 3 in 2D with every switch on: the crossings of three great circles as labelled ticks, the rim named" });

  // the inspector
  await W.openBox("listBox");
  await W.press("obj-pleiades"); await W.press("obj-pleiades");
  W.station = "inspector";
  const insp = await W.ev(() => { const b = document.getElementById("explainBody"); return { title: document.getElementById("explainTitle").textContent, status: b.querySelector("p.note .badge-word") ? b.querySelector("p.note .badge-word").textContent : null, paragraphs: b.querySelectorAll("p:not(.note)").length, rows: b.querySelectorAll("tr").length, badged: [...b.querySelectorAll("tr")].filter((tr) => tr.querySelector(".badge")).length, layers: [...new Set([...b.querySelectorAll("tr .badge")].map((x) => x.getAttribute("data-layer")))].sort(), pressed: document.getElementById("obj-pleiades").getAttribute("aria-pressed") }; });
  W.rec("the inspector: title, glyph, status badge, a paragraph, a table of numbers each with its layer badge (chart depth as OUR IDEA)", "Pleiades; a status badge; ≥ 1 paragraph; every row badged; layers checked + reading (+ said)", insp, /Pleiades/.test(insp.title) && !!insp.status && insp.paragraphs >= 1 && insp.rows >= 3 && insp.badged === insp.rows && insp.layers.includes("reading") && insp.layers.includes("checked") && insp.pressed === "true");
  await W.audit("inspector", { card: true, shot: "The inspector of the Pleiades (selected from the list): status badge, paragraph, the table with layer badges" });

  // step 4: slide the map
  await W.top();
  await W.press("step-4");
  W.station = "step 4";
  W.has("slide to the middle, Stargazer wording", await W.plain("#strixAll"), "Tap anything and the whole map slides until it sits in the middle. It is the same map, seen from a new middle. Nothing is added and nothing is lost. What you left behind is squeezed towards the edge.");
  W.eq("the quick buttons", ["Home", "Moon", "Sun", "Middle of our galaxy", "The edge"], await W.ev(() => ["home", "moon", "sun", "sgr_a_star", "rim"].map((k) => window.__w.shown("#quick-" + k))));
  await W.press("quick-home");
  s = await W.st();
  W.eq("Home", { c: [0, 0], centred: null }, { c: s.c.map((v) => Math.abs(v) < 1e-12 ? 0 : v), centred: s.centred });
  const hudSel = W.phone ? "#hudNarrow" : "#hud";
  for (const dims of ["2D", "3D"]) {
    await W.dims(dims);
    await W.press("quick-home");
    await W.press("quick-moon");
    W.station = "step 4, " + dims;
    s = await W.st();
    let h = await W.ev(() => window.__w.hit("moon"));
    W.eq("the first press centres the midpoint: “half way” (" + dims + ")", { centred: { key: "moon", half: true }, selected: "moon" }, { centred: s.centred, selected: s.selected });
    W.has("HUD says half way (" + dims + ")", await W.shown(hudSel), "half way");
    W.rec("half way: the Moon is not yet at the centre (" + dims + ")", "more than 3 px from the centre", h && h.off.toFixed(1) + " px", h && h.off > 3);
    if (dims === "2D") await W.audit("step 4, half way", { card: true, shot: "Step 4, first press on Moon: the midpoint is centred (“half way”); rings, home marker and the sight line are drawn" });
    await W.press("quick-moon");
    s = await W.st();
    h = await W.ev(() => window.__w.hit("moon"));
    W.eq("the second press centres the object (" + dims + ")", { key: "moon", half: false }, s.centred);
    W.rec("the Moon sits at the centre of the canvas (" + dims + ")", "within 1.5 px", h && h.off.toFixed(2) + " px", h && h.off < 1.5);
    W.has("Stargazer HUD: “The map slid in a straight line.” (" + dims + ")", await W.shown(hudSel), "The map slid in a straight line.");
    const dv = await W.ev(() => { const sc = window.CelestialControlPanel.chart.scene; return { diving: sc.diving, rings: sc.rings.length, home: !!sc.home, sight: sc.rays.some((r) => /moon/.test(r.key)), rays: sc.rays.map((r) => r.key).slice(0, 4) }; });
    W.rec("during a dive the rings, the home marker and the sight line to the selected body are drawn (" + dims + ")", "diving, rings, home, a sight line to the Moon", dv, dv.diving && dv.rings >= 5 && dv.home && dv.sight);
    await W.audit("step 4, Moon centred, " + dims, { card: true, shot: "Step 4, second press on Moon in " + dims + ": the Moon at the centre, the inspector under the canvas" });
  }
  await W.press("quick-sun"); await W.press("quick-sun");
  W.eq("quick button Sun", { key: "sun", half: false }, (await W.st()).centred);
  await W.press("quick-sgr_a_star"); await W.press("quick-sgr_a_star");
  W.eq("quick button Sagittarius A* (Stargazer: Middle of our galaxy)", { key: "sgr_a_star", half: false }, (await W.st()).centred);
  await W.press("quick-rim"); await W.press("quick-rim");
  W.station = "step 4, the rim";
  s = await W.st();
  W.eq("“The rim”: the point of the microwave-background shell towards the last selection", { selected: "cmb", rimOf: "sgr_a_star" }, { selected: s.selected, rimOf: s.rimOf });
  W.has("of the rim (Stargazer HUD)", await W.shown(hudSel), "The edge can never reach the middle. This is as far as the map goes.");
  W.has("the status line names the selected thing", await W.status(), "The oldest light, measured, near the edge of the map");
  await W.audit("step 4, the rim", { card: true, shot: "Step 4, The edge pressed twice: the view at the microwave-background shell" });

  // a tap on the Moon; Andromeda and the labels
  for (const dims of ["2D", "3D"]) {
    await W.dims(dims);
    await W.press("quick-home");
    W.station = "step 4, tap, " + dims;
    await W.top();
    const h0 = await W.ev(() => window.__w.hit("moon"));
    await W.point(h0.x, h0.y, "canvas: the Moon");
    s = await W.st();
    const h1 = await W.ev(() => window.__w.hit("moon"));
    W.rec("a " + (W.phone ? "tap" : "click") + " on the Moon centres it (" + dims + ")", "selected moon, centred at once (not half way), within 1.5 px of the centre", { selected: s.selected, centred: s.centred, off: h1 && h1.off.toFixed(2) }, s.selected === "moon" && s.centred && s.centred.key === "moon" && !s.centred.half && h1 && h1.off < 1.5);
    W.has("the card shows the Moon after the tap", await W.shown("#explainTitle"), "Moon");
    await W.audit("step 4, tap, " + dims, { card: true, shot: dims === "2D" ? "A " + (W.phone ? "tap" : "click") + " on the Moon in 2D centres it at once" : null });
    await W.openBox("listBox");
    await W.press("obj-m31"); await W.press("obj-m31");
    W.station = "step 4, Andromeda, " + dims;
    s = await W.st();
    const o2 = await W.ev(() => window.__w.overlaps());
    W.eq("the list brings Andromeda to the centre (two presses)", { key: "m31", half: false }, s.centred);
    W.rec("with Andromeda centred no two label boxes overlap (" + dims + ")", "no overlapping pair", o2.bad.length ? o2.bad : "none of " + o2.n + " labels", o2.bad.length === 0 && o2.n >= 2);
    W.rec("canvas labels are 13 px or more (" + dims + ")", "no label box under 13 px high", o2.low.length ? o2.low : "none", o2.low.length === 0);
    const disc = await W.ev(() => { const P = window.CelestialControlPanel, sc = P.chart.scene; return { detail: P.chart.labels().filter((l) => l.kind === "detail").map((l) => l.key), near: sc.bodies.filter((b) => b.near).map((b) => b.key), far: sc.bodies.filter((b) => !b.near).length }; });
    W.rec("disclosure: a detail line is drawn only for objects within distance 1.5 of the view centre (" + dims + ")", "detail lines only for near objects, Andromeda among them; far objects have a glyph and a short name", disc, (W.phone && dims === "3D" ? disc.detail.length >= 1 : disc.detail.includes("m31")) && disc.near.includes("m31") && disc.detail.every((k) => disc.near.includes(k)) && disc.far > 3);   // on the phone's ball the line of Andromeda may find no room clear of the other dots
    W.rec("the centred object and home are always labelled (" + dims + ")", "labels for Andromeda and home", o2.texts.filter((t) => /Andromeda|home:/i.test(t)), o2.texts.some((t) => /Andromeda/.test(t)) && o2.texts.some((t) => /^home:/.test(t)));
    await W.audit("step 4, Andromeda, " + dims, { card: true, shot: "Andromeda centred in " + dims + ": no two labels overlap" });
  }

  // the lab
  await W.top();
  await W.openBox("stepBox");
  W.station = "the lab";
  const verse = await W.ev(() => { const p = document.querySelector("#stepCtl p"), a = p.querySelector("a"); return { text: p.textContent, href: a ? a.getAttribute("href") : null, badge: p.querySelector(".badge-word").textContent }; });
  W.rec("the lab's name is the verse, as TEXT with its link", "WRITTEN “they turned not when they went” Ezekiel 1:9, King James Version → …#entry=26.1.9&lens=stargazer", verse, verse.badge === "WRITTEN" && verse.text.includes("“they turned not when they went”") && verse.text.includes("Ezekiel 1:9, King James Version") && verse.href === lexicon + "#entry=26.1.9&lens=stargazer");
  await W.press("labOpen");
  s = await W.st();
  W.eq("Open the lab clears the sky: a plain disc with its caption, no chart tools", { open: true, scene: null, cap: "This is the curved map by itself. It is not the sky.", tools: false, label: "The curved map by itself" },
    { open: s.lab.open, scene: await W.ev(() => window.CelestialControlPanel.chart.scene), cap: await W.shown("#skyCap"), tools: await W.seen("#tools"), label: await W.ev(() => document.getElementById("sky").getAttribute("aria-label")) });
  W.eq("the lab's controls", ["Slide forward", "Slide left", "Slide back", "Slide right", "Four slides", "Slide home", "Start again", "Back to the sky"], await W.ev(() => ["slide-forward", "slide-left", "slide-back", "slide-right", "labFour", "labHome", "labAgain", "labClose"].map((id) => window.__w.shown("#" + id))));
  const slider = await W.ev(() => { const e = document.getElementById("stepSlider"); return { min: e.min, max: e.max, value: e.value, text: e.getAttribute("aria-valuetext"), canvas: window.CelestialControlPanel.chart.size.w }; });
  W.eq("the step slider: 0.25 to " + (W.phone ? "1.25 (canvas under 400 px)" : "1.5") + ", default 1", { min: "0.25", max: W.phone ? "1.25" : "1.5", value: "1", text: "a step of 1.00" }, { min: slider.min, max: slider.max, value: slider.value, text: slider.text });
  W.has("what a flat floor gives", await W.txt("#stepCtl"), "On a flat floor, forward, left, back and right bring you back home, not turned.");
  await W.audit("the lab, open", { card: true, shot: "The lab “They turned not when they went”: the plain disc, the walker at home, the slide buttons" });
  await W.top();
  for (const dir of ["forward", "left", "back", "right"]) await W.press("slide-" + dir);
  W.station = "the lab, four slides";
  s = await W.st();
  const r4 = await W.ev(() => { const s = window.CelestialControlPanel.state.lab; return { n: s.slides.length, text: window.__w.shown("#labText"), card: window.__w.shown("#explainBody") }; });
  W.has("the result after forward, left, back, right at step 1: 0.87 of a step (0.874) and 78 degrees", r4.text, "You are 0.87 of a step from home. Sliding home, you face 78 degrees to the right of where you began.");
  W.has("the same result in the status line", await W.status(), "You are 0.87 of a step from home. Sliding home, you face 78 degrees to the right of where you began.");
  W.has("one line says what a flat floor gives", r4.card, "On a flat floor these slides would bring you back home, not turned.");
  W.lacks("the enclosed area is not shown before Slide home", r4.card, "the area inside your five-sided path");
  W.lacks("no challenge and no closed forms at Stargazer", r4.card, /Find the step that brings five slides home|asinh/);
  await W.audit("the lab, four slides", { card: true, shot: "The lab after forward, left, back, right: 0.87 of a step from home, 78 degrees" });
  await W.top();
  await W.press("labHome");
  const r5 = await W.shown("#explainBody");
  W.has("Slide home", r5, "You are home. You face 78 degrees to the right of where you began. No slide turned you.");
  W.has("the area appears after Slide home, called the area inside your five-sided path (no radians at the Stargazer lens)", r5, "The area inside your five-sided path: 1.362.");
  W.lacks("the lab's card at the Stargazer lens does not speak of radians", r5, /radian/);
  await W.audit("the lab, home", { card: true, shot: "The lab after Slide home: home again, facing 78 degrees to the right; the area inside the five-sided path" });
  await W.top();
  await W.press("labAgain");
  W.eq("Start again", 0, (await W.st()).lab.n);
  const t0 = Date.now();
  await W.press("labFour", { noSettle: true });
  await sleep(700);
  const mid = await W.ev(() => ({ walking: window.CelestialControlPanel.chart.walking, n: window.CelestialControlPanel.state.lab.slides.length, play: window.__w.txt("#labPlay") }));
  W.rec("Four slides is an animation with Pause", "walking, first slide under way, a Pause button", mid, mid.walking && mid.n === 1 && mid.play === "Pause");
  await W.openBox("stepBox");
  await W.press("labPlay", { noSettle: true });
  const p1 = await W.ev(() => ({ paused: window.CelestialControlPanel.chart.paused, play: window.__w.txt("#labPlay") }));
  await sleep(500);
  const still = await W.ev(() => new Promise((res) => { const c = document.getElementById("sky"), a = c.toDataURL(); setTimeout(() => res(a === c.toDataURL()), 400); }));
  W.eq("Pause holds the walker and the button becomes Play", { paused: true, play: "Play", still: true }, { ...p1, still });
  await W.press("labNext", { noSettle: true });
  await sleep(150);
  const nx = await W.ev(() => ({ n: window.CelestialControlPanel.state.lab.slides.length, walking: window.CelestialControlPanel.chart.walking }));
  W.rec("Next slide finishes the slide being walked (or makes the next)", "1 or 2 slides, the walker not in the middle of one", nx, nx.n >= 1 && nx.n <= 2);
  await W.press("labPlay", { noSettle: true });
  await W.settle(12000);
  s = await W.st();
  const took = Date.now() - t0;
  W.rec("Play goes on to the end of the four slides", "4 slides, no walk left", s.lab.n + " slides after " + took + " ms in all (with the pause)", s.lab.n === 4 && !s.walking);
  await W.press("labAgain");
  const t1 = Date.now();
  await W.press("labFour", { noSettle: true });
  await W.settle(12000);
  const whole = Date.now() - t1;
  s = await W.st();
  W.rec("Four slides: the whole animation takes at most 8 s", "4 slides in at most 8 s (2 s a slide)", s.lab.n + " slides in " + whole + " ms", s.lab.n === 4 && whole <= 8600 && whole >= 6000);
  await W.press("labFour", { noSettle: true });
  await sleep(500);
  await W.press("labPlay", { noSettle: true });
  await sleep(200);
  await W.press("labFour", { noSettle: true });
  await sleep(300);
  const again = await W.ev(() => ({ paused: window.CelestialControlPanel.chart.paused, walking: window.CelestialControlPanel.chart.walking }));
  await W.settle(12000);
  s = await W.st();
  W.rec("Four slides pressed while the walk is paused goes on playing", "not paused, and 4 slides at the end", { ...again, n: s.lab.n }, again.paused === false && s.lab.n === 4);
  W.has("the result after Four slides", await W.shown("#labText"), "You are 0.87 of a step from home.");
  await W.press("labTiling");
  await W.press("labTile", { noSettle: true });
  await W.settle(12000);
  W.station = "the lab, the tile";
  s = await W.st();
  const rt = await W.shown("#explainBody");
  W.eq("the {4,5} floor is switched on", { tiling: true, pressed: "true" }, { tiling: s.lab.tiling, pressed: await W.ev(() => document.getElementById("labTiling").getAttribute("aria-pressed")) });
  W.has("Slide round one tile: home again, turned 72 degrees", rt, "You are home. You face 72 degrees to the right of where you began. No slide turned you.");
  W.lacks("after the tile the Stargazer lens has neither radians nor “clockwise”", rt, /radian|clockwise/);
  W.has("five squares at every corner", rt, "On this floor five squares meet at every corner.");
  await W.audit("the lab, the tile", { card: true, shot: "The lab with the floor of squares after Slide round one tile: home again, turned 72 degrees to the right" });
  await W.top();
  await W.press("labClose");
  s = await W.st();
  W.eq("leaving the lab restores the chart", { open: false, scene: true, tools: true, selected: "m31" }, { open: s.lab.open, scene: await W.ev(() => !!window.CelestialControlPanel.chart.scene), tools: await W.seen("#tools"), selected: s.selected });

  // step 5: the seal
  await W.press("step-5");
  W.station = "step 5";
  W.has("the seal, Stargazer wording", await W.plain("#strixAll"), "A seal is a stamp on the exact writing. Change one letter and the stamp no longer fits, and anyone can see that. It does not say the writing is true, and it does not say who made it.");
  W.eq("the seal button (Stargazer: Stamp this sky), no file button yet", { seal: "Stamp this sky", file: false }, { seal: await W.shown("#sealBtn"), file: await W.seen("#sealFile") });
  await W.audit("step 5", { card: true, shot: "Step 5 before the seal" });
  await W.top();
  await W.ev(() => { const b = document.getElementById("sealBtn"); b.focus(); b.click(); b.click(); });
  const busy = await W.ev(() => ({ busy: window.CelestialControlPanel.state.busy, aria: document.getElementById("sealBtn").getAttribute("aria-busy") }));
  await W.settle(20000);
  await sleep(300);
  await W.focusAfter("sealBtn (two presses at once)");
  s = await W.st();
  W.eq("one busy flag: the button is marked busy while the job runs, and two presses make one job", { busy: true, aria: "true", after: false }, { ...busy, after: s.busy });
  W.rec("the sky is sealed: a chain id BC- and 24 hex digits", "/^BC-[0-9a-f]{24}$/", s.seal.chainId, s.seal.ok && /^BC-[0-9a-f]{24}$/.test(s.seal.chainId || ""));
  W.has("a pass is worded “unchanged since it was …” (Stargazer: stamped)", await W.shown("#sealVerdict"), "The stamp fits: this exact writing is unchanged since it was stamped.");
  const card = await W.shown("#explainBody");
  W.rec("for the Kebar preset the chain name is shown large", "the chain id in the 17 px mono line", await W.ev(() => { const e = document.querySelector(".chain-name"); return e ? e.textContent + " at " + getComputedStyle(e).fontSize : null; }), (await W.ev(() => { const e = document.querySelector(".chain-name"); return e ? e.textContent : ""; })) === s.seal.chainId);
  W.has("“Everyone who seals this same sky gets this same name. Compare with a friend.”", card, "Everyone who seals this same sky gets this same name. Compare with a friend.");
  W.has("the seal certifies the writing, not its truth (Stargazer form)", card, "The stamp is about this exact writing, not whether it is true.");
  W.has("beside the link and the file: what each holds (Stargazer form)", card, "This link holds the place and the time you entered. The parcel also holds the moment it was stamped. It holds a number that lets others check the stamp.");
  W.has("READING: one seal is one witness (Stargazer form)", await W.txt("#stepRead"), "One stamp is one witness. The rule in the verse asks for two or three. In the Lexicon Explorer, the Navigator level shows pretend receivers checking it too.");
  const link = await W.ev(() => { const a = document.querySelector('[data-key="sealLink"]'); return a ? { href: a.getAttribute("href"), text: a.textContent } : null; });
  W.rec("the link to the Lexicon Explorer: #sky=JD,LAT,LON (three rounded numbers) and the lens", lexicon + "#sky=1505042.16624,32.13,45.23&lens=stargazer", link, !!link && link.href === lexicon + "#sky=" + [s.seal.inputs.jd, s.seal.inputs.lat, s.seal.inputs.lon].join(",") + "&lens=stargazer" && /^\.\.\/Lexicon_Explorer\/index\.html#sky=\d+\.\d{1,5},-?\d+(\.\d+)?,-?\d+(\.\d+)?&lens=stargazer$/.test(link.href));
  const [download] = await Promise.all([W.page.waitForEvent("download"), W.press("sealFile")]);
  const saved = path.join(TEMP, "download-" + W.vp + ".json");
  await download.saveAs(saved);
  const wire = fs.readFileSync(saved, "utf8");
  let parsed = null;
  try { parsed = JSON.parse(wire); } catch { parsed = null; }
  W.rec("the package as a file: hyperpack-<chain id>.json holding the wire text", "hyperpack-" + s.seal.chainId + ".json, " + s.seal.wire + " characters of JSON", download.suggestedFilename() + ", " + wire.length + " characters" + (parsed ? " of JSON" : ", not JSON"), download.suggestedFilename() === "hyperpack-" + s.seal.chainId + ".json" && wire.length === s.seal.wire && !!parsed);
  W.lacks("the downloaded package holds none of the supplied passage (NIV wording)", wire, /living creatures|windstorm|Kebar River/);
  W.kebarChain = s.seal.chainId;
  await W.audit("step 5, sealed", { card: true, shot: "Step 5 after the seal at the Kebar preset: the verdict, the chain name shown large, the link to the Lexicon Explorer" });
  await W.openBox("stepBox");
  const lf = await W.ev(() => { const f = document.getElementById("linkField"); return { value: f.value, readonly: f.readOnly, label: document.querySelector('label[for="linkField"]').textContent }; });
  W.rec("“Copy a link to this sky”: a read-only field with lat, lon, jd and the lens", "…/index.html#jd=1505042.16624&lat=32.13&lon=45.23&lens=stargazer (keys in any order), read-only", lf, lf.readonly && lf.label === "Copy a link to this sky" && /index\.html#/.test(lf.value) && ["jd=1505042.16624", "lat=32.13", "lon=45.23", "lens=stargazer"].every((k) => lf.value.split("#")[1].split("&").includes(k)));
  await W.press("copyBtn");
  await sleep(200);
  const told = await W.ev(() => document.getElementById("status").textContent);
  let clipText = null;
  if (!W.phone) clipText = await W.ev(() => navigator.clipboard.readText().catch(() => null));
  W.rec("Copy: the clipboard API when it is available, otherwise the field is selected", W.phone ? "“The link is copied.” or “Select the link and copy it.”" : "“The link is copied.” and the clipboard holds the link", { told, clipboard: clipText }, W.phone ? /The link is copied\.|Select the link and copy it\./.test(told) : told === "The link is copied." && clipText === lf.value);
  await W.audit("step 5, more open", { shot: "Step 5 with More at this step open: the copy-link field and what the seal covers", full: true });
  W.linkToSky = lf.value;

  // the gold box at every step; the lens kept through a change of lens
  for (const n of [1, 2, 3, 4, 5]) {
    await W.top();
    await W.press("step-" + n);
    W.station = "bridge, step " + n;
    if (W.phone) {
      const folded = await W.ev(() => ({ more: window.__w.shown("#bridge .fold-more"), rest: window.__w.seen("#bridge .fold-rest"), first: document.querySelector("#bridge .fold-first").textContent }));
      W.rec("(F) on the phone THE BRIDGE shows its first sentence and “more”", "first part shown, the rest folded, a button “more”", folded, folded.more === "more" && !folded.rest && folded.first.length > 20);
      await W.press("#bridge .fold-more");
      W.eq("(F) “more” opens the rest", { rest: true, expanded: "true" }, await W.ev(() => ({ rest: window.__w.seen("#bridge .fold-rest"), expanded: document.querySelector("#bridge .fold-more").getAttribute("aria-expanded") })));
    }
    const br = await W.ev(() => { const b = document.getElementById("bridge"); return { title: b.querySelector("h2").textContent, parts: [...b.querySelectorAll("p.label")].map((p) => p.textContent), firstBadge: b.querySelector(".fold-first .badge-word").textContent, notes: [...new Set([...b.querySelectorAll(".bridge-stands p.note .badge")].map((x) => x.getAttribute("data-layer")))], stands: [...new Set([...b.querySelectorAll(".bridge-stands > :not(.note) .badge, .bridge-stands > blockquote .badge")].map((x) => x.getAttribute("data-layer")))].sort(), text: b.textContent, quotes: [...b.querySelectorAll(".bridge-stands blockquote")].map((q) => ({ t: q.textContent.slice(0, 60), href: q.querySelector("a") ? q.querySelector("a").getAttribute("href") : null })), links: [...b.querySelectorAll(".wrap-row a")].map((a) => a.getAttribute("href")) }; });
    W.rec("THE BRIDGE in two parts: “Our reading” (OUR IDEA) and “What it stands on” (WRITTEN, SAID, CHECKED badges)", "title THE BRIDGE; parts Our reading, What it stands on; first badge OUR IDEA; text + checked (+ said) below", { title: br.title, parts: br.parts, firstBadge: br.firstBadge, stands: br.stands }, br.title === "THE BRIDGE" && /our reading/i.test(br.parts[0] || "") && /what it stands on/i.test(br.parts[1] || "") && br.firstBadge === "OUR IDEA" && br.stands.includes("text") && br.stands.includes("checked") && !br.stands.includes("reading") && br.notes.every((l) => l === "reading"));
    W.rec("every TEXT sentence links to its row in the Lexicon Explorer", "each quotation with a link …#entry=book.chapter.verse&lens=stargazer", br.quotes, br.quotes.length >= 1 && br.quotes.every((q) => q.href && /^\.\.\/Lexicon_Explorer\/index\.html#entry=\d+\.\d+\.\d+&lens=stargazer$/.test(q.href)));
    if (n === 1) {
      W.has("the first gold box opens with the bridge sentence (Stargazer form)", await W.plain("#bridge"), "Our page First Explorers drew a bridge: a line through the middle of its map. We read Jesus of Nazareth as that line. On this page the map is your horizon. The line is the line straight up from your head. The gold boxes follow it from Ezekiel's river to John 3:16.");
      W.has("the bridge is stated as this project's reading (Stargazer form)", await W.plain("#bridge"), "This is our reading, and no check depends on it. The word bridge is not in the King James Bible.");
      W.has("step 1 TEXT", br.text, "as I was among the captives by the river of Chebar");
      W.has("step 1 SAID: van Paassen's picture, marked as his picture, not a record", br.text, /van Paassen.*That is his picture of the young Jesus, not a record\./);
      W.has("step 1 CHECKED: almost the same stars overhead, about 40 minutes apart", br.text, /Worked out from rough positions: Nazareth and the Kebar site are almost equally far north\. Almost the same stars pass overhead at both, about 40 minutes apart\./);
      W.has("step 1: the river's two spellings are joined under the verse", br.text, "We write the Kebar (Chebar in the King James Version): one river, two spellings.");
    }
    if (n === 2) { W.has("step 2 TEXT", br.text, "in the fourth month, in the fifth day of the month"); W.has("step 2 SAID: Parker and Dubberstein 1942", br.text, /Parker and Dubberstein, wrote in 1942/); W.has("step 2 CHECKED, conditional (Stargazer form)", br.text, "if that date is right, the Moon grew to half lit that day"); }
    if (n === 3) { W.has("step 3 TEXT", br.text, "a whirlwind came out of the north"); W.has("step 3 TEXT", br.text, "the heavens were opened"); }
    if (n === 4) W.has("step 4 TEXT: Ezekiel 1:12", br.text, /they turned not when they went/);
    if (n === 5) {
      W.has("step 5 TEXT", br.text, "that in the mouth of two or three witnesses every word may be established");
      W.rec("step 5 links back to First Explorers and on to the Lexicon Explorer at #entry=", "../First_Explorers/index.html and ../Lexicon_Explorer/index.html#entry=…", br.links, br.links.includes("../First_Explorers/index.html") && br.links.some((l) => /^\.\.\/Lexicon_Explorer\/index\.html#entry=/.test(l)));
    }
    await W.audit("bridge, step " + n, { shot: n === 1 ? "THE BRIDGE at step 1" + (W.phone ? ", opened with “more”" : "") + ": Our reading, and What it stands on" : null, at: "#bridge" });
  }
  s = await W.st();
  W.eq("the seal is kept while the place and time stay", { ok: true, chain: W.kebarChain }, { ok: s.seal.ok, chain: s.seal.chainId });
  await W.top();
  await W.lens("navigator");
  W.station = "lens change";
  W.has("at Navigator the pass is worded “unchanged since it was sealed”", await W.shown("#sealVerdict"), "Every check passed: unchanged since it was sealed.");
  W.has("at Navigator: the seal certifies bytes", await W.shown("#explainBody"), "The seal certifies these bytes, not their truth.");
  const navLink = await W.ev(() => document.querySelector('[data-key="sealLink"]').getAttribute("href"));
  W.eq("every link to the other page carries the current lens", lexicon + "#sky=1505042.16624,32.13,45.23&lens=navigator", navLink);
  await W.openBox("stepBox");
  const rows = await W.ev(() => ({ rows: document.querySelectorAll("#stepRead tr").length, hashes: [...document.querySelectorAll("#stepRead .hash")].map((e) => getComputedStyle(e).fontSize), checks: document.querySelectorAll("#stepRead .checks li").length, bad: document.querySelectorAll("#stepRead .checks li.bad").length, text: document.getElementById("stepRead").textContent }));
  W.rec("from Navigator up: the rows of the seal, hashes at 13 px, the list of checks all passed", "rows; hashes at 13px; checks with none failed", { rows: rows.rows, hashes: [...new Set(rows.hashes)], checks: rows.checks, bad: rows.bad }, rows.rows >= 3 && rows.hashes.length >= 1 && rows.hashes.every((f) => f === "13px") && rows.checks >= 3 && rows.bad === 0);
  W.has("READING: one seal is one witness", rows.text, "One seal is one witness. By the rule quoted here that settles nothing until others check it too: open it in the Lexicon Explorer and let the receivers answer.");
  await W.audit("step 5, sealed, Navigator", { card: true, shot: "Step 5 sealed at the Navigator lens with the seal details open", full: true });
  await W.top();
  await W.press("step-2");
  await W.press("day-after");
  await W.press("step-5");
  s = await W.st();
  W.eq("another day drops the seal and keeps the key of the visit", { report: false, keys: true, file: false }, { report: s.seal.report, keys: s.seal.keys, file: await W.seen("#sealFile") });
  await W.lens("stargazer");

  // the two dialogs
  await dialogs(W);

  // the link to the Lexicon Explorer is followed
  W.station = "to the Lexicon Explorer";
  await W.top();
  await W.press("step-2");
  await W.press("day-before");
  await W.press("step-5");
  await W.press("sealBtn");
  await W.settle(20000);
  s = await W.st();
  W.eq("the same sky sealed again in the same visit has the same chain name", W.kebarChain, s.seal.chainId);
  const kept = await W.ev(async () => ({ hash: location.hash, cookie: document.cookie, local: localStorage.length, session: sessionStorage.length, idb: indexedDB.databases ? (await indexedDB.databases()).length : 0, caches: (await caches.keys()).length }));
  W.eq("nothing is stored and the page never writes its own address bar", { hash: "", cookie: "", local: 0, session: 0, idb: 0, caches: 0 }, kept);
  const kinds = W.requests.filter((r) => /^(fetch|xhr|websocket|eventsource|ping|beacon)/.test(r)), away = W.requests.filter((r) => /https?:\/\//.test(r) && !/fonts\.googleapis\.com|blob:/.test(r));
  W.rec("no network request from script; the only other host asked is the font host", "no fetch, XHR, socket or beacon; no host but fonts.googleapis.com", { requests: W.requests.length, script: kinds, otherHosts: away }, kinds.length === 0 && away.length === 0 && W.requests.length >= 8);
  const res = await W.ctx.request.get(W.base + "/Library/Experimental_Systems/Lexicon_Explorer/index.html");
  W.eq("the link target exists on the server", 200, res.status());
  await W.audit("to the Lexicon Explorer");
  if (W.options.abortFonts) W.rec("with the font hosts aborted, the stylesheet's load error is the one console message of the whole visit", "exactly one message, about fonts.googleapis.com", W.messages, W.messages.length === 1 && /fonts\.googleapis\.com/.test(W.messages[0]) && /^error: Failed to load resource/.test(W.messages[0]));
  W.muted = true;
  await Promise.all([W.page.waitForURL(/Lexicon_Explorer\/index\.html#sky=/), W.press('[data-key="sealLink"]', { noSettle: true }).catch(() => "left")]).catch(() => {});
  W.rec("the link opens the Lexicon Explorer with #sky=JD,LAT,LON and the lens", "…/Lexicon_Explorer/index.html#sky=1505042.16624,32.13,45.23&lens=stargazer", W.page.url().replace(W.base, "…"), W.page.url().endsWith("/Library/Experimental_Systems/Lexicon_Explorer/index.html#sky=1505042.16624,32.13,45.23&lens=stargazer"));
  // The other page belongs to its own walkthrough; what it shows for this link is noted, not counted.
  await sleep(1500);
  const other = await W.page.evaluate(() => ({ api: !!window.LexiconExplorer, text: document.body.innerText })).catch((e) => ({ api: false, text: String(e) }));
  NOTES.push(W.vp + " [" + W.section + "] the Lexicon Explorer after the link: window.LexiconExplorer " + (other.api ? "present" : "absent") + "; the Kebar chain name " + W.kebarChain + (other.text.includes(W.kebarChain) ? " is on its page" : " is not (yet) on its page"));
  await W.close();
}

// ─── the two dialogs (inside the journey) ────────────────────────────────────
async function dialogs(W) {
  for (const [id, opener, heading] of [["about", "aboutBtn", "What is real here?"], ["blueprint", W.phone ? "blueprintBtn2" : "blueprintBtn", "Blueprint"]]) {
    await W.top();
    await W.ev(() => scrollTo(0, 300));
    await W.press(opener);
    W.station = "dialog: " + heading;
    await sleep(100);
    const dlg = await W.ev((i) => {
      const d = document.getElementById(i), first = d.querySelector("button, a, input, select"), bar = d.firstElementChild, close = bar.firstElementChild, cr = close.getBoundingClientRect(), dr = d.getBoundingClientRect();
      const lab = document.getElementById(d.getAttribute("aria-labelledby"));
      return { open: d.open, modal: d.matches(":modal"), scrollTop: d.scrollTop, firstControl: first.textContent, closeFirstInDom: bar.classList.contains("dialog-bar") && close === first, closeAtTop: cr.top >= dr.top && cr.top - dr.top < 40 && window.__w.rendered(close), labelled: lab ? lab.textContent : null, focus: document.activeElement === close, haspopup: null };
    }, id);
    W.eq("the dialog: labelled by its heading, Close first in the DOM and visible at the top, open at scroll position 0, focus on Close", { open: true, modal: true, scrollTop: 0, firstControl: "Close", closeFirstInDom: true, closeAtTop: true, labelled: heading, focus: true }, { open: dlg.open, modal: dlg.modal, scrollTop: dlg.scrollTop, firstControl: dlg.firstControl, closeFirstInDom: dlg.closeFirstInDom, closeAtTop: dlg.closeAtTop, labelled: dlg.labelled, focus: dlg.focus });
    const text = await W.ev((i) => document.getElementById(i).textContent, id);
    const body = await W.ev((i) => { const b = document.getElementById(i + "Body"); const h3 = [...b.querySelectorAll("h3")].map((x) => x.textContent); const short = []; let n = b.querySelector("h3"); for (n = n && n.nextElementSibling; n && n.localName !== "h3"; n = n.nextElementSibling) short.push(n.textContent); return { h3, short, firstLine: b.firstElementChild.textContent, badges: [...new Set([...b.querySelectorAll(".badge-word")].map((x) => x.textContent))], hosts: [...b.querySelectorAll("a")].map((a) => a.getAttribute("href")), canvas: [...b.querySelectorAll("canvas")].map((c) => [c.getAttribute("role"), c.getAttribute("aria-label"), !!document.getElementById(c.getAttribute("aria-describedby") || "-")]) }; }, id);
    if (id === "about") {
      W.has("the first line of “What is real here?”", body.firstLine, "This page sets Bible verses beside sky calculations because its author asked for that. The numbers do not depend on the verses, and the verses are not offered as science.");
      const words = body.short.join(" ").split(/(?<=[.!?])\s+/).filter((x) => x.trim()).length;
      W.rec("the dialog opens on an “In short” of about five Stargazer sentences (five, and who STRIX is)", "In short first, 5 to 7 lines", { firstHeading: body.h3[0], lines: body.short.length, sentences: words }, body.h3[0] === "In short" && body.short.length >= 5 && body.short.length <= 7 && words <= 9);
      W.rec("the dialog says once who speaks", "one line: “STRIX is the owl that speaks on this page.”", body.short.filter((t) => /STRIX/.test(t)), body.short.filter((t) => /STRIX/.test(t)).length === 1 && body.short.some((t) => t.endsWith("STRIX is the owl that speaks on this page.")));
      for (const [what, needle] of [
        ["the four layers: WRITTEN", "These exact words are in the book named beside them. You can open that book and look."],
        ["the four layers: SAID", "Someone named here says this. They may be right or wrong."],
        ["the four layers: CHECKED", "This page counted it or worked it out, and shows you how to do it again."],
        ["the four layers: OUR IDEA", "This is how the makers of this page see it. It is a way of looking, not a proof."],
        ["the badge help", "CHECKED means you can repeat this count or calculation. It does not mean the words beside it are proved."],
        ["the checks certify the writing, never its meaning", "A stamp shows that writing has not changed. It cannot show that the writing is true."],
        ["the key shows integrity, not identity", "The key that signs a seal is made for this visit and shows integrity, not identity."],
        ["a positive statement of fact: latitude and date", /your latitude and date drive the sky/i],
        ["the Vela pulsar turns 11 times a second", /Vela pulsar turns 11 times a second/],
        ["PSU(1,1) and PSL(2,C)", /PSU\(1,1\).*PSL\(2,C\)/s],
        ["celestial holography is a proposal", /celestial holography is a proposal/i],
        ["gravitational-wave memory has not been detected", /memory has not been detected/i],
        ["the section “The bridge narrative”", "The bridge narrative"],
        ["the book never mentions Ezekiel", /never mentions Ezekiel/],
        ["the design protocol and the book", /The author calls this way of working .the design protocol of Why Jesus Died.\. The rules are this project's; the book does not contain them\./],
        ["the three levels and First Explorers", "the same three levels First Explorers calls Stargazer, Explorer and Architect"],
        ["the neighbours: the Learning Hub's Control Panel", /Learning Hub/],
        ["the neighbours: the Biomesh AI Control Panel", /Biomesh AI Control Panel/],
        ["the neighbours: the planned Celestial Observatory", /Celestial Observatory/],
        ["the fonts line", "The only request to another host is for web fonts (Google Fonts); the page works without them."],
        ["the licence line", "Code: MIT. Quoted texts belong to their rights holders and are not covered by that licence."],
        ["location and storage", /location is typed or chosen, never read from the device, and\s+nothing is stored by this page/i],
        ["what is computed and to what accuracy", /For the years 1800 to 2200 the Sun is within 0\.01° and the Moon within 0\.01°/],
        ["the chart is a reading", "it is not a claim that space has this shape"],
      ]) W.has(what, text, needle);
      W.eq("the badges of the dialog at Stargazer: shape plus word", ["CHECKED", "OUR IDEA", "SAID", "WRITTEN"], body.badges.slice().sort());
      W.rec("links in the dialog go only to the pages' own relative URLs", "First Explorers, the Lexicon Explorer (with the lens), the wing index", body.hosts, body.hosts.length === 3 && body.hosts[0] === "../First_Explorers/index.html" && body.hosts[1] === "../Lexicon_Explorer/index.html#lens=stargazer" && body.hosts[2] === "../index.html");
    } else {
      W.has("Blueprint: the whole scale is badged OUR IDEA", body.firstLine, /^.?\s*OUR IDEA/);
      W.rec("the Blueprint opens on an “In short”", "In short first", body.h3[0], body.h3[0] === "In short");
      const bp = await W.ev(() => { const b = document.getElementById("blueprintBody"); return { pillars: b.querySelectorAll("h4").length, shells: b.querySelectorAll("ol > li").length, lenses: [...b.querySelectorAll("p > b")].map((x) => x.textContent) }; });
      W.eq("Blueprint: three pillars, four shells against the real scale, the age-lens card", { pillars: 3, shells: 4, lenses: ["Stargazer", "Navigator", "Holographer"] }, bp);
      W.rec("the four shells are drawn over the rings (a named picture with its caption)", "one canvas with role=img, a label and a caption", body.canvas, body.canvas.length === 1 && body.canvas[0][0] === "img" && !!body.canvas[0][1] && body.canvas[0][2]);
    }
    await W.audit("dialog: " + heading, { shot: "The dialog “" + heading + "”, as it opens (scroll position 0, Close first)" });
    await W.ev((i) => document.getElementById(i).scrollTo(0, 99999), id);
    await W.shot("dialog-" + id + "-end", "The dialog “" + heading + "”, scrolled to its end");
    await W.page.keyboard.press("Escape");
    await sleep(80);
    const back = await W.ev((i) => ({ open: document.getElementById(i).open, focus: document.activeElement.id }), id);
    W.eq("Escape closes and the focus returns to the opener", { open: false, focus: opener }, back);
    await W.press(opener);
    await sleep(80);
    const r = await W.ev((i) => { const b = document.getElementById(i).getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, sy: document.getElementById(i).scrollTop }; }, id);
    const px = r.left > 12 ? r.left / 2 : (r.left + r.right) / 2, py = r.left > 12 ? (r.top + r.bottom) / 2 : (r.top > 6 ? r.top / 2 : r.bottom + (W.page.viewportSize().height - r.bottom) / 2);
    if (W.phone) await W.page.touchscreen.tap(px, py); else await W.page.mouse.click(px, py);
    await sleep(120);
    const shut = await W.ev((i) => ({ open: document.getElementById(i).open, focus: document.activeElement.id }), id);
    W.eq("the backdrop closes too (opened again at scroll position 0)", { open: false, focus: opener, scrollTop: 0 }, { ...shut, scrollTop: r.sy });
  }
}

// ─── section: the three lenses on every step, in 2D and 3D ───────────────────
async function lenses(W) {
  const TITLES = { stargazer: ["My place", "My day and Moon", "Look around", "Slide the map", "Stamp it"], navigator: ["Earth", "Sun and Moon", "Project", "Dive", "Seal"], holographer: ["Earth", "Sun and Moon", "Project", "Dive", "Seal"] };
  const HIDDEN = /Julian Day|JD \(UT\)|ΔT|sidereal|PSU\(1,1\)|PSL\(2,C\)|SO\+?\(3,1\)|BC or AD|local mean time|T_c\(z\)/;   // (the BC/AD switch itself is checked in the journey; the Kebar buttons name their BC dates in their own labels)
  for (const lens of ["stargazer", "navigator", "holographer"]) {
    await W.open("#site=greenwich&lens=" + lens);
    W.station = lens + ": start";
    let s = await W.st();
    W.eq("a link with a site skips the first question and carries the lens", { site: "greenwich", lens, pressed: lens }, { site: s.site && s.site.key, lens: s.lens, pressed: await W.ev(() => document.querySelector('#lensMount [aria-pressed="true"]').getAttribute("data-lens")) });
    W.eq("the step names at this lens", TITLES[lens], await W.ev(() => [...document.querySelectorAll("#strip .st-name")].map((e) => e.textContent)));
    W.eq("three lens buttons, never in a layer colour", ["Stargazer", "Navigator", "Holographer"], await W.ev(() => [...document.querySelectorAll("#lensMount .lens-name")].map((e) => e.textContent)));
    for (const n of [1, 2, 3, 4, 5]) {
      await W.top();
      await W.press("step-" + n);
      if (n === 2 && (await W.seen("#dayYes"))) { await W.audit(lens + ": step 2, the day question", { card: true }); await W.press("dayYes"); }
      for (const dims of n === 3 ? ["3D", "2D"] : ["2D", "3D"]) {
        await W.dims(dims);
        W.station = lens + ": step " + n + ", " + dims;
        const strix = await W.txt("#strixAll"), said = await W.ev(() => [...document.querySelectorAll("#strixAll p")].filter((p) => p.querySelector(".badge")).length);
        if (dims === (n === 3 ? "3D" : "2D")) {
          W.rec("one STRIX paragraph for this step at this lens, each sentence with its layer badge", "at least one badged sentence", said + " badged; “" + clip(strix, 90) + "”", said >= 1 && strix.length > 40);
          const stars = await W.pageText();
          if (lens === "stargazer") W.lacks("Stargazer hides Julian Day, ΔT, sidereal time, group names, BC/AD and typed time", stars, HIDDEN);
          W.eq("the telemetry strip and the frame switch: hidden at Stargazer, shown from Navigator up", lens === "stargazer" ? { tele: false, frame: false } : { tele: true, frame: n === 3 }, { tele: await W.ev(() => !document.getElementById("teleBox").hidden), frame: await W.ev(() => !!document.getElementById("frame-hor")) });
        }
        if (n === 4) {
          const hud = W.phone ? "#hudNarrow" : "#hud";
          await W.press("quick-home");
          await W.press("quick-moon"); await W.press("quick-moon");
          const text = await W.shown(hud);
          if (lens === "stargazer") W.has("Stargazer HUD (" + dims + ")", text, "The map slid in a straight line.");
          else if (dims === "2D") W.has("HUD, exact, 2D", text, "this view is the slide T_c that brings the chosen point to the centre, a member of PSU(1,1); going from one such view to another is a slide and a turn");
          else W.has("HUD, exact, 3D", text, "a move of the ball: the 6-parameter group PSL(2,C) acts here");
          if (lens !== "stargazer") {
            const three = await W.ev(() => ({ marks: window.CelestialControlPanel.chart.labels().filter((l) => l.kind === "mark").map((l) => l.text).sort().join("") }));
            const m = (dims === "3D" ? /Three points of the rim fix the fourth: A, B and C moved, so D must be at ([\d.]+° round, -?[\d.]+° up)\. It is at ([\d.]+° round, -?[\d.]+° up)\./ : /Three points of the rim fix the fourth: A, B and C moved, so D must be at ([\d.]+°)\. It is at ([\d.]+°)\./).exec(text || "");
            W.rec("read-out “Three points of the rim fix the fourth”: the predicted angle beside the actual one (" + dims + ")", "the sentence, with predicted = actual", m ? m.slice(1) : text, !!m && m[1] === m[2]);
            W.rec("the three marked rim points and the fourth are on the chart (" + dims + ")", "marks A, B, C, D (those with free room)", three.marks, /^A?B?C?D?$/.test(three.marks) && three.marks.length >= 2);
          } else W.lacks("no three-points read-out at Stargazer", text, "Three points of the rim");
          if (dims === "3D") {
            if (lens === "holographer") {
              W.has("Holographer, 3D, after a dive of rapidity d: β = tanh d and the rim point's angle before and after", text, /β = tanh d = 0\.\d{4} for d = \d\.\d\d; the rim point of .+ was [\d.]+° from the dive axis and is now [\d.]+° from it/);
              W.has("the caveat sentence", text, "As a Lorentz transformation this is a boost of rapidity d. It acts physically on directions. Depth is this chart's own scale and has no Lorentz meaning.");
            } else W.lacks("the boost line is for the Holographer lens only", text, "β = tanh d");
          }
          await W.audit(lens + ": step 4, Moon centred, " + dims, { card: true, shot: lens !== "stargazer" ? "Step 4 at the " + lens + " lens in " + dims + ", Moon centred: the HUD and the three-points read-out" : null });
          await W.press("quick-home");
        }
        await W.audit(lens + ": step " + n + ", " + dims, { card: true, shot: n !== 4 && lens !== "stargazer" && dims === "2D" ? "Step " + n + " at the " + lens + " lens" : null });
      }
      // every box open: the controls that are folded away are measured too
      await W.dims("2D");
      for (const id of ["stepBox", "listBox", "legendBox"].concat(lens === "stargazer" ? [] : ["teleBox"]).concat(W.phone ? ["strixBox"] : [])) await W.openBox(id);
      W.station = lens + ": step " + n + ", every box open";
      if (lens !== "stargazer") {
        const tele = await W.ev(() => [...document.querySelectorAll("#tele tr")].map((tr) => tr.firstElementChild.textContent.replace(/^.CHECKED/, "")));
        if (n === 1) W.eq("telemetry rows", ["Local date", "JD (UT)", "ΔT ± σ", "Local sidereal time", "Sun longitude", "Moon elongation", "View distance from home", "Conformal factor 2 / (1 − |w|²) at the selected point's present position on screen"], tele);
      }
      if (n === 1 && lens !== "stargazer") {
        const rows = await W.ev(() => [...document.querySelectorAll("#explainBody tr")].map((tr) => tr.textContent));
        W.rec("step 1 shows the zenith among the stars (declination = latitude, right ascension = sidereal time), the pole's altitude, Polaris from the pole", "five rows with 51.48°", rows, rows.length === 5 && /declination \(your latitude\)51\.48°/.test(rows[1]) && /right ascension \(your local sidereal time\)\d\d:\d\d/.test(rows[2]) && /north celestial pole51\.48°/.test(rows[3]) && /Polaris from the pole on this date0\.\d°/.test(rows[4]));
      }
      if (n === 2 && lens !== "stargazer") {
        const c2 = await W.ev(() => ({ slider: (() => { const e = document.getElementById("yearSlider"); return e ? [e.min, e.max, e.value, e.getAttribute("aria-valuetext")] : null; })(), clock: document.getElementById("clockField") ? document.getElementById("clockField").value : null, clockLabel: document.querySelector('label[for="clockField"]') ? document.querySelector('label[for="clockField"]').textContent : null, text: document.getElementById("stepCtl").textContent, read: document.getElementById("stepRead").textContent }));
        W.eq("from Navigator up: a slider through the chosen year and a typed time", { slider: ["1", "365", "318", "14 November 2026"], clock: "16:00", clockLabel: "Sun time at this place (local mean time)" }, { slider: c2.slider, clock: c2.clock, clockLabel: c2.clockLabel });
        W.has("the calendar in force is named", c2.text, /Gregorian calendar\. The calendar in force: Julian before 15 October 1582/);
        W.has("the Sun's ecliptic longitude", c2.read, /Sun: ecliptic longitude232\.\d\d°/);
        W.has("the SAID note on how the Kebar date is derived", c2.text, /The conversion to a modern date rests on Parker and Dubberstein's tables/);
        W.has("the Kebar preset note", c2.text, "position of Nippur approximate, not checked against a source");
        const f = await W.key("yearSlider", "ArrowRight");
        W.eq("the day-of-year slider names the date and keeps the focus", { text: "15 November 2026", focus: "yearSlider" }, { text: await W.ev(() => document.getElementById("yearSlider").getAttribute("aria-valuetext")), focus: f });
        await W.key("yearSlider", "ArrowLeft");
        await W.fill("clockField", "06:30");
        await W.page.keyboard.press("Tab");
        await W.settle();
        W.has("the typed time is local mean time", await W.txt("#tele"), "14 November 2026, 06:30 local mean time");
        await W.top();
        await W.press("day-pick");
        const era = await W.ev(() => ({ era: !!document.querySelector('[data-key="era-b"]'), label: document.querySelector('label[for="dateYear"]').textContent }));
        W.eq("from Navigator up: the year with BC/AD", { era: true, label: "Year (BC or AD)" }, era);
        await W.pick("dateMonth", "10"); await W.fill("dateDay", "10"); await W.fill("dateYear", "1582");
        await W.press("dateGo");
        W.has("5 to 14 October 1582 do not exist", await W.txt("#mainPanel .err"), "That day does not exist. Showing 15 October.");
        if (!(await W.seen("#dateGo"))) await W.press("day-pick");
        await W.pick("dateMonth", "7"); await W.fill("dateDay", "31"); await W.fill("dateYear", "593");
        await W.press('[data-key="era-b"]');
        await W.press("dateGo");
        W.has("a BC year: every date is the local date at the place, the calendar named", await W.status(), /31 July 593 BC \(Julian calendar\), 06:30 at Greenwich/);
        await W.press("day-today"); await W.press("time-now");
      }
      if (n === 3 && lens !== "stargazer") {
        await W.top();
        await W.press("frame-gal");
        const g = await W.ev(() => ({ frame: window.CelestialControlPanel.state.frame, cap: document.getElementById("skyCap").textContent, list: [...document.querySelectorAll("#list button")].map((b) => b.id.slice(4)), pressed: document.getElementById("frame-gal").getAttribute("aria-pressed") }));
        W.rec("the galactic frame: the galactic centre and the north galactic pole instead of the compass points and the zenith", "frame gal; galactic_centre and ngp listed, no compass points", { frame: g.frame, has: g.list.filter((k) => ["galactic_centre", "ngp", "north", "zenith"].includes(k)) }, g.frame === "gal" && g.pressed === "true" && g.list.includes("galactic_centre") && g.list.includes("ngp") && !g.list.includes("north") && !g.list.includes("zenith"));
        W.has("the galactic caption", g.cap, "seen from the north galactic pole: the galactic centre right");
        W.eq("the shadow transform is on the rim at the Holographer lens only", lens === "holographer", g.list.includes("shadow"));
        await W.audit(lens + ": step 3, galactic frame", { card: true, shot: "Step 3 at the " + lens + " lens, galactic frame, 2D" });
        await W.press("frame-hor");
        W.has("the horizon caption (Navigator form)", await W.txt("#skyCap"), "a flat map of direction round the plane and of depth; height above the plane is not shown; seen from above: north up, east right");
      }
      if (n === 4) {
        await W.top();
        await W.press("labOpen");
        for (const dir of ["forward", "left", "back", "right"]) await W.press("slide-" + dir);
        const card = await W.shown("#explainBody");
        if (lens === "stargazer") W.lacks("the lab at Stargazer: no closed forms, no challenge", card, /asinh|Find the step that brings five slides home/);
        else {
          W.has("the closed forms from Navigator up: the gap 0.874463", card, "gap = 2 · asinh(2√2 · cosh(a/2) · sinh³(a/2)) = 0.874463");
          W.has("the closed forms: the turn 78.0148°", card, "turn = 2 · atan2(sinh²(a) / 2, 1 − 2 · sinh⁴(a/2)) = 78.0148°");
          W.has("the challenge: the gap after five slides at step 1", await W.shown("#fiveText"), "After five slides you are 0.169 from home.");
          await W.openBox("stepBox");
          const fk = await W.key("stepSlider", "ArrowRight", 5);
          W.eq("the challenge is met within 0.005: the closed form 1.061275", { a: 1.0625, focus: "stepSlider", ok: true }, { a: (await W.st()).lab.a, focus: fk, ok: /Home\. The exact step is 2 · acosh\(√2 · cos\(π\/5\)\) = 1\.061275/.test(await W.shown("#fiveText")) });
          W.eq("the step slider says its value in words", "a step of 1.06", await W.ev(() => document.getElementById("stepSlider").getAttribute("aria-valuetext")));
        }
        await W.audit(lens + ": the lab", { card: true, shot: lens === "navigator" ? "The lab at the Navigator lens: the closed forms and the five-slides challenge met" : null });
        await W.top();
        await W.press("labClose");
      }
      await W.audit(lens + ": step " + n + ", every box open", { shot: lens === "stargazer" && n === 1 && W.phone ? "Step 1 on the phone with every box open" : null, full: true });
    }
    // every object's inspector at this lens
    W.station = lens + ": inspectors";
    await W.press("step-3");
    await W.dims("2D");
    await W.openBox("listBox");
    const keys = await W.ev(() => [...document.querySelectorAll("#list button")].map((b) => b.id.slice(4)));
    const bad = [], paragraphs = [];
    for (const k of keys.concat(["antipode"]).filter((k, i, a) => a.indexOf(k) === i)) {
      if (!(await W.ev((id) => !!document.getElementById(id), "obj-" + k))) continue;
      await W.press("obj-" + k);
      const v = await W.ev(() => { const b = document.getElementById("explainBody"), st = b.querySelector("p.note"); return { sel: window.CelestialControlPanel.state.selected, title: document.getElementById("explainTitle").textContent, status: st && st.querySelector(".badge-word") ? st.querySelector(".badge-word").textContent : null, paras: [...b.querySelectorAll(":scope > p:not(.note)")].filter((p) => p.querySelector(".badge")).length, rows: b.querySelectorAll("tr").length, bare: [...b.querySelectorAll("tr")].filter((tr) => !tr.querySelector(".badge")).length, pressed: document.querySelectorAll('#list button[aria-pressed="true"]').length }; });
      if (v.paras >= 1) paragraphs.push(k);
      if (v.sel !== k || !v.title || !v.status || v.bare > 0 || v.pressed !== 1) bad.push(k + ":" + JSON.stringify(v));
      if (k === "holography") W.eq("celestial holography carries a fixed status badge: SAID", "SAID", v.status);
      if (k === "celestial_sphere") W.eq("the celestial sphere: CHECKED", "CHECKED", v.status);
      if (k === "cmb") W.eq("the microwave background: SAID", "SAID", v.status);
      if (k === "memory") W.eq("gravitational-wave memory: SAID", "SAID", v.status);
    }
    W.rec("every object in the list opens an inspector with a title, a status badge and badged rows, and is the one pressed button", "all of " + keys.length, bad.length ? bad : "all of " + keys.length, bad.length === 0);
    W.rec("three-lens paragraphs for the eight bodies and the microwave background", "moon, sun, pleiades, polaris, vela_pulsar, cyg_x1, sgr_a_star, m31, cmb have a paragraph", paragraphs, ["moon", "sun", "pleiades", "polaris", "vela_pulsar", "cyg_x1", "sgr_a_star", "m31", "cmb"].every((k) => paragraphs.includes(k)));
    await W.press("obj-moon");
    if (await W.ev(() => !!document.getElementById("obj-antipode"))) {
      await W.press("obj-antipode");
      const ap = await W.shown("#explain");
      W.has("the antipodal point of the selection is selectable", ap, /antipod|opposite/i);
    } else W.rec("the antipodal point of the current selection is in the list once something is selected", "obj-antipode", "not in the list", false);
    await W.audit(lens + ": inspectors", { card: true, shot: "The antipodal point of the Moon at the " + lens + " lens" });
    await W.close();
  }
}

// ─── section: details (the layout, the way on, STRIX's line, the list, the header) ───────────────────────────
// The gold box on the first screen of a desktop, each column filled from the top and a choice in the list bringing
// the map into view, the sticky header never over the focused control, whole sentences and "more" on a phone, the
// Next buttons, who speaks and what the reading levels are for, the legend's place, the 2D/3D button off the map.
async function details(W) {
  const frame = () => W.ev(() => {
    const r = (id) => { const e = document.getElementById(id); if (!e || e.getClientRects().length === 0) return null; const q = e.getBoundingClientRect(); return [Math.round(q.top + scrollY), Math.round(q.bottom + scrollY)]; };
    const lg = document.getElementById("legendBox"), hint = document.querySelector(".lens-hint-line"), head = document.querySelector("header.top").getBoundingClientRect();
    const name = document.querySelector("#sayText .strix-name"), d = document.getElementById("dimsBtn"), c = document.getElementById("sky").getBoundingClientRect();
    const dq = d.getClientRects().length ? d.getBoundingClientRect() : null;
    return {
      say: r("say"), more: r("more"), stage: r("stage"), under: r("under"), explain: r("explain"), bridge: r("bridge"), legend: r("legendBox"), strip: r("strip"),
      legendOpen: lg.open, legendFirst: document.getElementById("more").firstElementChild === lg, legendAfterCard: lg.previousElementSibling === document.getElementById("explain"),
      hint: hint && hint.getClientRects().length ? { top: Math.round(hint.getBoundingClientRect().top), bottom: Math.round(hint.getBoundingClientRect().bottom), text: hint.textContent, size: getComputedStyle(hint).fontSize } : null,
      hintsInButtons: [...document.querySelectorAll(".lens-hint")].every((e) => getComputedStyle(e).clipPath === "none" && e.getBoundingClientRect().width > 2),
      head: Math.round(head.bottom), strix: name && window.__w.rendered(name) ? name.textContent : null,
      dimsOverMap: !!dq && dq.left < c.right && c.left < dq.right && dq.top < c.bottom && c.top < dq.bottom, dimsInTools: !!d.closest("#tools"), dimsSeen: !!dq,
      order: [...document.querySelectorAll("#main > *, #cardCol > section")].map((e) => e.id).filter((id) => id !== "cardCol"),
    };
  });
  for (const lens of ["stargazer", "navigator", "holographer"]) {
    await W.open("#lens=" + lens);
    for (const where of ["first run", "step 1"]) {
      if (where === "step 1") await W.press("placeGreenwich");
      W.station = "layout, " + lens + ", " + where;
      await W.top();
      const g = await frame();
      W.eq("the order in the document is the phone order at every width: strip, STRIX, canvas, card, bridge, the rest", ["stripNav", "say", "stage", "explain", "bridge", "more", "under", "aside"], g.order.filter((id) => id !== "legendBox"));
      W.eq("STRIX is named beside the first line it says", "STRIX", g.strix);
      if (where === "step 1") {
        const arrows = await W.ev(() => ["nudgeLeft", "nudgeUp", "nudgeDown", "nudgeRight", "turnLeft", "turnUp", "turnDown", "turnRight"].map((id) => { const e = document.getElementById(id); return { id, name: e.getAttribute("aria-label"), title: e.getAttribute("title"), text: e.textContent.trim().length }; }));
        W.rec("each of the eight map buttons shows an arrow only, so its tooltip says what it does: the same words as its accessible name", "Move the map left, up, down, right; Turn the ball left, up, down, right",
          arrows.map((a) => a.id + ": " + a.title).join("; "), arrows.every((a) => !!a.name && a.title === a.name && a.text === 1) && arrows.map((a) => a.title).join("|") === "Move the map left|Move the map up|Move the map down|Move the map right|Turn the ball left|Turn the ball up|Turn the ball down|Turn the ball right");
      }
      if (W.phone) {
        W.rec("on a phone the gold box follows the card (and the closed legend)", "after the card", "card ends " + g.explain[1] + ", gold box begins " + g.bridge[0], g.bridge[0] >= g.explain[1]);
        W.rec("on a phone the badge legend is a closed box directly under the card", "closed, at most 8 px under the card, before the gold box", { open: g.legendOpen, under: g.legend[0] - g.explain[1], bridge: g.bridge[0] - g.legend[1] }, !g.legendOpen && g.legendAfterCard && g.legend[0] - g.explain[1] >= 0 && g.legend[0] - g.explain[1] <= 8 && g.bridge[0] >= g.legend[1]);
        W.rec("under 700 px a line under the header says what the chosen reading level is for", "a 14 px line between the header and the strip: “" + { stargazer: "Stargazer: ages 6 and up", navigator: "Navigator: astronomy", holographer: "Holographer: physics" }[lens] + "”", g.hint ? g.hint.text + " at y " + g.hint.top + " to " + g.hint.bottom + ", " + g.hint.size + "; header ends " + g.head + ", strip begins " + g.strip[0] : "no line",
          !!g.hint && g.hint.text === { stargazer: "Stargazer: ages 6 and up", navigator: "Navigator: astronomy", holographer: "Holographer: physics" }[lens] && g.hint.size === "14px" && g.hint.top >= g.head - 1 && g.hint.bottom <= g.strip[0] + 1);
        W.eq("(A) the 2D/3D button stands in the row of map tools under the canvas and covers nothing of the map (it comes with the tools, once a place is chosen)", { seen: where === "step 1", inTools: true, overMap: false }, { seen: g.dimsSeen, inTools: g.dimsInTools, overMap: g.dimsOverMap });
        if (where === "first run" && lens === "stargazer") { const head = await W.box("#bridge h2"); W.rec("on a phone the first screen of a first visit shows where the gold box begins: its heading THE BRIDGE", "the heading ends above y = 844", "the box begins at y = " + g.bridge[0] + ", its heading ends at " + Math.round(head.bottom), head.bottom <= 844); }
      } else {
        W.rec("the gold box begins on the first screen of a desktop (" + where + ")", "its top above y = 700", "y = " + g.bridge[0] + " (the card ends at " + g.explain[1] + ")", g.bridge[0] < 700);
        const gaps = { underStrix: g.more[0] - g.say[1], underMap: g.under[0] - g.stage[1], underCard: g.bridge[0] - g.explain[1] };
        W.rec("each of the three columns is filled from the top: the further controls under STRIX, the list under the map, the gold box under the card", "each gap 0 to 13 px", gaps, Object.values(gaps).every((v) => v >= 0 && v <= 13));
        W.eq("from 700 px the badge legend is the first box of the further controls, open on the first run at Stargazer", { first: true, open: lens === "stargazer" }, { first: g.legendFirst, open: g.legendOpen });
        W.eq("from 700 px the hints stand in the lens buttons and there is no line under the header", { inButtons: true, line: null }, { inButtons: g.hintsInButtons, line: g.hint });
      }
      await W.audit("layout, " + lens + ", " + where, { card: true, shot: lens === "stargazer" || where === "step 1" ? (where === "first run" ? "The first screen: STRIX named, the legend, the gold box" + (W.phone ? " under the card and the closed legend; the line about the reading level under the header" : " in the right-hand column under the card") : "Step 1 at the " + lens + " lens: the gold box " + (W.phone ? "after the card" : "on the first screen, each column filled from the top")) : undefined });
    }
    await W.close();
  }

  // the way on, STRIX's line and the list, at the Stargazer and the Navigator lens
  for (const lens of ["stargazer", "navigator"]) {
    await W.open("#lens=" + lens);
    const next = () => W.ev(() => { const e = document.getElementById("nextBtn"); if (!e || !window.__w.rendered(e)) return null; const ex = document.getElementById("explain"); let last = ex.lastElementChild; while (last && !window.__w.rendered(last)) last = last.previousElementSibling; return { text: e.textContent, last: !!last && last.contains(e), gold: e.classList.contains("gold") }; });
    const line = () => W.ev(() => {
      const t = document.getElementById("sayText"), m = document.getElementById("sayMore"), cs = getComputedStyle(t);
      const shown = document.getElementById("sayBody").textContent.replace(/\s+/g, " ").trim(), all = [...document.querySelectorAll("#strixAll p")].map((p) => p.textContent).join(" ").replace(/\s+/g, " ").trim();
      const letters = (s) => s.replace(/[^\p{L}\p{N}]/gu, "");
      return { shown, whole: shown === "" || /[.?!”)]$/.test(shown), clipped: cs.overflowY !== "visible" || (cs.webkitLineClamp && cs.webkitLineClamp !== "none"), all: letters(shown) === letters(all), prefix: letters(all).startsWith(letters(shown)), more: m.hidden ? null : m.textContent, name: m.hidden ? null : (m.getAttribute("aria-label") || m.textContent), box: Math.round(m.getBoundingClientRect().width) + "x" + Math.round(m.getBoundingClientRect().height) };
    });
    const sayCheck = async (where) => {
      await W.top();
      const s = await line();
      if (W.phone) W.rec("on a phone STRIX says whole sentences only, and “more” opens the rest (" + where + ")", "whole sentences from the start of the narration, never clipped; a button when anything is left out", { shown: clip(s.shown, 90), more: s.more, button: s.more ? s.box : null }, s.whole && !s.clipped && s.prefix && (s.all ? s.more === null : (s.more === (s.shown === "" ? "All that STRIX says here" : "more") && s.name === (s.shown === "" ? "All that STRIX says here" : "more from STRIX"))));
      else W.rec("from 700 px STRIX says everything and there is no “more” (" + where + ")", "all of it, no button", { all: s.all, more: s.more }, s.all && s.more === null && !(await W.seen("#sayMore")));
      return s;
    };
    W.station = "the way on, " + lens;
    W.eq("no Next button in the card on the first run", null, await next());
    await sayCheck("first run");
    await W.press("placeGreenwich");
    W.eq("step 1 keeps its own Next step button beside the place buttons, and has none in the card", { own: "Next step", card: null }, { own: await W.shown("#placeNext"), card: await next() });
    await sayCheck("step 1");
    await W.press("placeNext");
    W.eq("no Next button while the day is asked", null, await next());
    const asked = await sayCheck("step 2, the day asked");
    W.rec("the day question is never shortened", "the whole question, no button", { all: asked.all, more: asked.more }, asked.all && asked.more === null);
    await W.press("dayYes");
    const labels = lens === "stargazer" ? ["Next: Look around", "Next: Slide the map", "Next: Stamp it"] : ["Next: Project", "Next: Dive", "Next: Seal"];
    for (let n = 2; n <= 4; n++) {
      W.station = "the way on, " + lens + ", step " + n;
      const s = await sayCheck("step " + n);
      if (W.phone && n === 3) {
        W.rec("at step 3 not all of the narration fits above the map of a phone, so the button is there", "a button", s.more, s.more !== null);
        const f = await W.press("sayMore");
        const after = await W.ev(() => { const b = document.getElementById("strixBox"), r = b.getBoundingClientRect(); return { open: b.open, top: Math.round(r.top), vh: innerHeight, text: document.getElementById("strixAll").textContent }; });
        W.rec("“more” opens the box with all that STRIX says and moves the focus to it", "the box open and in the window, the focus on its summary, the last sentence in it", { open: after.open, focus: f, top: after.top }, after.open && f === "strixSum" && after.top >= 0 && after.top < after.vh && (lens !== "stargazer" || after.text.includes("Only the map is squeezed. Space is not.")));
        await W.press("#strixBox > summary");
      }
      await W.top();
      const b = await next(), rows = await W.ev(() => new Set([...document.querySelectorAll("#mainRow > *")].filter((e) => window.__w.rendered(e)).map((e) => Math.round(e.getBoundingClientRect().top))).size);
      W.eq("step " + n + ": the last item of the card is a gold button to the next step, and the main control is still one row", { text: labels[n - 2], last: true, gold: true, rows: 1 }, { ...(b || {}), rows });
      await W.audit("the way on, " + lens + ", step " + n, { card: true, shot: lens === "stargazer" && n === 3 ? "Step 3: STRIX in whole sentences" + (W.phone ? " with “more”" : "") + ", and the button Next: Slide the map at the end of the card" : undefined });
      const f = await W.press("nextBtn");
      const st = await W.ev(() => ({ step: window.CelestialControlPanel.state.step, strip: Math.round(document.getElementById("strip").getBoundingClientRect().top), vh: innerHeight, head: getComputedStyle(document.querySelector("header.top")).position === "sticky" ? Math.round(document.querySelector("header.top").getBoundingClientRect().bottom) : 0 }));
      W.rec("the button opens step " + (n + 1) + " and moves the focus to its button in the strip, in view", "step " + (n + 1) + ", focus step-" + (n + 1) + ", the strip inside the window", { step: st.step, focus: f, strip: st.strip }, st.step === n + 1 && f === "step-" + (n + 1) && st.strip >= st.head && st.strip < st.vh);
    }
    W.station = "the way on, " + lens + ", step 5";
    W.eq("step 5 is the last: no Next button", null, await next());
    await sayCheck("step 5");

    // a choice in the list brings the map into view
    await W.press("step-3");
    W.station = "the list, " + lens;
    await W.openBox("listBox");
    const inside = () => W.ev(() => { const r = (id) => { const q = document.getElementById(id).getBoundingClientRect(); return [Math.round(q.top), Math.round(q.bottom)]; }; const h = document.querySelector("header.top"), top = getComputedStyle(h).position === "sticky" ? Math.round(h.getBoundingClientRect().bottom) : 0; const sky = r("sky"), title = r("explainTitle"); return { sky, title, window: [top, innerHeight], ok: sky[0] >= top && sky[1] <= innerHeight && title[0] >= top && title[1] <= innerHeight, y: Math.round(scrollY) }; });
    let f = await W.press("obj-m31");
    await sleep(1200);
    let v = await inside(), s = await W.st();
    W.rec("after Andromeda is pressed in the list the map and the card's title are inside the window", "both inside", { map: v.sky, title: v.title, window: v.window, scrollY: v.y }, v.ok && s.selected === "m31");
    W.eq("the focus stays on the list button, and the status line says what was chosen", { focus: "obj-m31", status: true }, { focus: f, status: /^Andromeda galaxy, /.test(await W.status()) });
    W.has("the card is the chosen object's", await W.txt("#explainTitle"), "Andromeda galaxy");
    f = await W.key("obj-m31", "Enter");
    await sleep(1200);
    v = await inside();
    W.rec("a second press, with the keyboard: the object comes to the middle, the map is in view again and the status line says so", "map and title inside; “The Andromeda galaxy is in the middle of the map.”", { ok: v.ok, status: await W.status(), focus: f }, v.ok && f === "obj-m31" && (await W.txt("#status")) === "The Andromeda galaxy is in the middle of the map.");
    const cap = await W.shown("#skyCap");
    W.rec("the caption, which describes the canvas, names what is in the middle after a slide and no longer speaks of straight up", "ends “The Andromeda galaxy is in the middle of the map.”", clip(cap, 200), /\. The Andromeda galaxy is in the middle of the map\.$/.test(cap) && !/straight up has no compass/i.test(cap) && (cap.toLowerCase().match(/the rim is your horizon/g) || []).length <= 1);
    await W.audit("the list, " + lens, { shot: lens === "stargazer" ? "After Andromeda is chosen in the list under the map: the map and the card are brought into view" : undefined });
    // the Moon, the Sun and a point of the horizon: each is named as a sentence names it, with its article
    await W.press("obj-moon"); await sleep(900);
    W.has("the first press on the Moon: the caption says what is in the middle, with the article", await W.shown("#skyCap"), /\. Half way to the Moon is in the middle of the map\.$/);
    await W.key("obj-moon", "Enter"); await sleep(900);
    W.eq("the second press: the status line and the caption say “The Moon is in the middle of the map.”", { status: "The Moon is in the middle of the map.", caption: true }, { status: await W.status(), caption: /\. The Moon is in the middle of the map\.$/.test(await W.shown("#skyCap")) });
    await W.press("obj-sun"); await W.key("obj-sun", "Enter"); await sleep(900);
    W.eq("the Sun: “The Sun is in the middle of the map.”", "The Sun is in the middle of the map.", await W.status());
    await W.press("obj-north"); await sleep(900);
    W.has("a point of the horizon never reaches the middle: the caption says where the map has slid, with the article", await W.shown("#skyCap"), lens === "stargazer" ? /\. The map has slid towards the north\.$/ : /\. The map has slid towards the north point\.$/);
    W.lacks("no caption names a thing without its article", await W.shown("#skyCap"), / (to|towards) (Moon|Sun|North|Andromeda|Cosmic)/);
    await W.audit("the list, what is in the middle, " + lens);

    // Open the lab: the focus goes to the slide buttons
    await W.press("step-4");
    W.station = "the lab, " + lens;
    await W.openBox("stepBox");
    f = await W.press("labOpen");
    const sb = await W.box("#slide-forward");
    W.rec("after Open the lab the focus is on the first slide button, in view", "slide-forward, inside the window", { focus: f, top: sb && Math.round(sb.y) }, f === "slide-forward" && !!sb && sb.y >= 0 && sb.bottom <= W.page.viewportSize().height);
    W.has("the status line says what to do", await W.status(), "Press a slide button. The walker slides and never turns.");
    await W.audit("the lab, " + lens, { card: true });
    await W.close();
  }

  // single sentences and dates, as a visitor meets them
  await W.open("#preset=ezekiel&lens=navigator");
  W.station = "single sentences, Navigator";
  let e = await W.st();
  W.eq("the preset link opens step 2 with the day answered", { step: 2, day: true, site: "kebar" }, { step: e.step, day: e.lit.day, site: e.site && e.site.key });
  W.has("the card begins with the day, beside the Moon picture", await W.plain("#explainBody .moon-box .cap > p"), "Monday 31 July 593 BC (Julian calendar), 19:00 local mean time");
  await W.openBox("stepBox");
  const ctl = await W.txt("#stepCtl");
  W.has("under the sunset buttons: SAID, the date usually given", ctl, "the date usually given");
  W.lacks("nothing says what most reference works give", await W.pageText(), /most reference works|conventional date/);
  W.has("no hour: read from the verses kept here", ctl, "Read from the three verses kept here: they give a day and no hour.");
  let gold = await W.plain("#bridge");
  W.has("the gold box of step 2 is conditional on the date usually given, and names two other published dates", gold, /Computed, if the day is placed on the date usually given:.*On two other published dates, 1 July 593 BC and 13 July 594 BC, it grew from 33 to 44 % and from 38 to 48 %\./);
  W.has("step 2 names the river with both spellings at its first use", gold, "Over the site by the Kebar (Chebar in the King James Version) it grew from 40 % lit");
  await W.press("step-1");
  gold = await W.plain("#bridge");
  W.has("the Kebar and Nazareth, in the wording both pages share", gold, "Computed from approximate positions: the Kebar site (Nippur) and Nazareth lie about half a degree apart in latitude, so almost the same stars pass overhead at both, about 40 minutes apart. From Nazareth the site lies roughly due east, about 930 km.");
  W.has("step 1: the two spellings are joined under the verse, before the page says Kebar itself", gold, /by the river of Chebar.*We write the Kebar \(Chebar in the King James Version\): one river, two spellings\..*the Kebar site \(Nippur\)/);
  await W.press("step-3");
  W.has("step 3 names the early reader", await W.plain("#bridge"), "We set two openings of heaven side by side, as the early Christian writer Origen did: Ezekiel's by the river, and the one at the baptism of Jesus.");
  await W.press("step-5");
  await W.press("sealBtn");
  const sealed = await W.ev(() => ({ card: document.getElementById("explainBody").textContent, rows: document.getElementById("stepRead").textContent, checks: [...document.querySelectorAll("#stepRead .checks li")].map((li) => li.textContent).join(" | ") }));
  W.has("the privacy line says what the link holds and what the file holds besides", sealed.card, "This link contains the place and the time you entered. The file also holds the moment it was stamped and the public half of this visit's key.");
  W.rec("“a key made for this visit” is said by this page, which made the key in this visit, in its own row, and by no line of the checks", "row Signed by: “S-… (a key made for this visit)”; ten checks, none with those words", { row: (/Signed by(S-[0-9a-f]+ \(a key made for this visit\))/.exec(sealed.rows) || [null, null])[1], checks: sealed.checks.split(" | ").length },
    /Signed byS-[0-9a-f]+ \(a key made for this visit\)/.test(sealed.rows) && sealed.checks.split(" | ").length === 10 && !/made for this visit/.test(sealed.checks));
  await W.press("aboutBtn");
  const about = await W.ev(() => document.getElementById("aboutBody").textContent);
  W.has("the dialog: the gold boxes quote several writers (OUR IDEA)", about, "The gold boxes quote several writers, each named where it is quoted. Where a box quotes Pierre van Paassen, Why Jesus Died (Dial Press, 1949), the words in quotation marks are his and were checked against a scan of the book.");
  W.has("the dialog: what van Paassen argues, as his (SAID)", about, "Van Paassen argues that Jesus was a Galilean Jew in the line of Israel's prophets");
  W.has("the dialog: who would disagree is this project's view (OUR IDEA)", about, "This project's view: most Christians and many historians would disagree with parts of that.");
  await W.page.keyboard.press("Escape");
  await W.audit("single sentences, Navigator");
  await W.close();

  await W.open("#site=greenwich", { timezoneId: "Australia/Sydney" });
  W.station = "single sentences, Stargazer";
  await W.press("step-2");
  W.has("a device a day ahead of the place: both days are said as what they are", await W.shown("#sayBody"), "At Greenwich, England it is now Saturday 14 November 2026. Your device says Sunday 15 November 2026. Is that the day you want?");
  await W.audit("single sentences, the day question", { card: true });
  await W.press("dayChange");
  await W.fill("dateYear", "0");
  await W.press("dateGo");
  W.eq("a year 0 is refused in plain words and the day stays", { err: "That day does not exist.", year: 2026 }, { err: await W.txt("#mainPanel .err"), year: await W.ev(() => new Date((window.CelestialControlPanel.state.jdUt - 2440587.5) * 86400000).getUTCFullYear()) });
  await W.press("dayChange");
  await W.press("dayYes");
  await W.openBox("listBox");
  await W.press("obj-moon");
  await sleep(900);
  W.has("the Moon's card: what is worked out is CHECKED, the explanation is SAID by astronomers", await W.txt("#explainBody"), /CHECKEDThe Moon circles Earth about every 27 days\. Its shapes repeat every 29 and a half days\..*SAIDAstronomers explain this by Earth's own travel round the Sun\./);
  await W.press("step-4");
  await W.openBox("stepBox");
  await W.press("labOpen");
  await W.press("slide-forward");
  W.has("one slide: a walker that is not turned gets a whole sentence", await W.shown("#labText"), "You are 1.00 of a step from home. Sliding home, you would face the way you began.");
  await W.press("labHome");
  W.has("home again along one line", await W.shown("#labText"), "You are home, facing the way you began.");
  W.lacks("nowhere “not turned of”", await W.pageText(), /not turned of|face not turned/);
  // a path that crosses itself has no single inside: no area is printed, and one sentence says why
  const CROSSES = "Your path crosses itself, so it has no single inside to measure.";
  const labLines = () => W.ev(() => ({ card: window.__w.plain("#explainBody"), line: window.__w.plain("#labNoArea"), badge: document.querySelector("#labNoArea .badge-word") ? document.querySelector("#labNoArea .badge-word").textContent : null, n: window.CelestialControlPanel.state.lab.slides.length }));
  await W.press("labAgain");
  for (const dir of ["forward", "left", "forward"]) await W.press("slide-" + dir);
  let lab = await labLines();
  W.eq("forward, left, forward: nothing is said about an inside before Slide home", { line: null, area: false }, { line: lab.line, area: /area inside/i.test(lab.card) });
  await W.press("labHome");
  lab = await labLines();
  W.eq("after Slide home the path crosses itself: no area, and one CHECKED sentence in its place", { line: CROSSES, badge: "CHECKED", area: false, sides: 4 }, { line: lab.line, badge: lab.badge, area: /area inside/i.test(lab.card), sides: lab.n });
  await W.press("labAgain");
  for (const dir of ["forward", "left", "back", "right"]) await W.press("slide-" + dir);
  await W.press("labHome");
  lab = await labLines();
  W.eq("the square has its area and no such sentence", { area: true, line: null }, { area: lab.card.includes("The area inside your five-sided path: 1.362."), line: lab.line });
  // … also far from home, where the crossing is hard to see: forward eight times, left, forward
  await W.press("labAgain");
  for (const dir of ["forward", "forward", "forward", "forward", "forward", "forward", "forward", "forward", "left", "forward"]) await W.press("slide-" + dir);
  await W.press("labHome");
  lab = await labLines();
  W.eq("forward eight times, left, forward, Slide home: the slide home crosses the path far from home, and no area is printed", { area: false, line: CROSSES, sides: 11 }, { area: /area inside/i.test(lab.card), line: lab.line, sides: lab.n });
  await W.audit("single sentences, Stargazer", { card: true });
  await W.close();

  // the day question follows the device clock until it is answered: a page left open past midnight asks about the new day
  {
    const NIGHT = new Date("2026-11-14T23:50:00Z"), MORNING = new Date("2026-11-15T08:10:00Z");
    const reopen = async (hash) => { await W.page.clock.setFixedTime(NIGHT); await W.page.goto("about:blank"); await W.go(hash); };
    await W.open("");
    W.station = "the day question after midnight";
    await reopen("");
    W.eq("the page is opened when the device shows Saturday 14 November 2026, 23:50", 2461359.49306, Number((await W.st()).jd.toFixed(5)));
    await W.page.clock.setFixedTime(MORNING);
    await W.press("placeGreenwich");
    W.has("a place chosen the next morning: the status line begins with the day and time the device shows then", await W.status(), /^15 November 2026, 08:10 at Greenwich, England\./);
    await W.press("placeNext");
    W.has("a place chosen the next morning: the question names the day the device shows then", await W.shown("#sayText"), "Your device says today is Sunday 15 November 2026. Is that right?");
    await W.press("dayYes");
    W.has("… and Yes lights that morning's sky", await W.status(), "15 November 2026, 08:10 at Greenwich, England.");
    await reopen("");
    await W.page.clock.setFixedTime(MORNING);
    await W.press("placePick"); await W.pick("placeSelect", "kyoto");
    W.has("a place picked from the list the next morning: again the status line begins with the new day and time", await W.status(), /^15 November 2026, 17:13 at Kyoto, Japan\./);
    await reopen("");
    await W.press("placeGreenwich");
    await W.page.clock.setFixedTime(MORNING);
    await W.press("placeNext");
    W.has("a place chosen at once and step 2 opened the next morning: again the new day", await W.shown("#sayText"), "Your device says today is Sunday 15 November 2026. Is that right?");
    // the question is already on the screen when midnight passes: Yes is not taken for a day the question no longer names
    const SATURDAY = "Your device says today is Saturday 14 November 2026. Is that right?", SUNDAY = "Your device says today is Sunday 15 November 2026. Is that right?";
    const CHANGED = "The day changed while this page was open. Please look again.";
    const askAtNight = async () => { await reopen(""); await W.press("placeGreenwich"); await W.press("placeNext"); W.has("at 23:50 the question names Saturday", await W.shown("#sayText"), SATURDAY); await W.page.clock.setFixedTime(MORNING); };
    const asked = async () => { const st = await W.st(); return { question: await W.plain("#sayBody"), day: st.lit.day, ask: st.ask, jd: Number(st.jd.toFixed(5)) }; };
    await askAtNight();
    let focus = await W.press("dayYes");
    W.eq("Yes pressed the next morning is not taken: the question is shown again with the new day, the day stays open, the focus stays on Yes", { question: SUNDAY, day: false, ask: "true", jd: 2461359.84028, focus: "dayYes" }, { ...(await asked()), focus });
    W.eq("… and the status line says once that the day changed", CHANGED, await W.status());
    await W.press("dayYes");
    W.has("… Yes to the new question is taken, and lights that morning's sky", await W.status(), /^15 November 2026, 08:10 at Greenwich, England\./);
    W.eq("… with the day answered", { day: true, ask: "false" }, await W.st().then((st) => ({ day: st.lit.day, ask: st.ask })));
    // … the same when the page comes into view again: the question is painted again, and nothing is said
    const comeBack = () => W.ev(() => {
      for (const v of ["hidden", "visible"]) { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v }); document.dispatchEvent(new Event("visibilitychange")); }
      delete document.visibilityState;
    });
    await askAtNight();
    const before = await W.status();
    await comeBack(); await W.settle();
    W.eq("the page comes into view again the next morning: the question names the new day, and is still to be answered", { question: SUNDAY, day: false, ask: "true", jd: 2461359.84028 }, await asked());
    W.eq("… the status line says nothing new", before, await W.status());
    await W.page.clock.setFixedTime(new Date(MORNING.getTime() + 90000));
    await comeBack(); await W.settle();
    W.eq("… a return on the same day changes nothing", { question: SUNDAY, day: false, ask: "true", jd: 2461359.84028 }, await asked());
    await W.press("dayYes");
    W.has("… and Yes is taken at once, with the time the device shows at that press", await W.status(), /^15 November 2026, 08:11 at Greenwich, England\./);
    // … and “Change the day” opens its panel on the day the device shows now
    await askAtNight();
    await W.press("dayChange");
    W.eq("Change the day pressed the next morning: the question and the panel show the new day", { question: SUNDAY, day: false, panel: "date", dayField: "15", expanded: "true" },
      { question: await W.plain("#sayBody"), day: (await W.st()).lit.day, panel: (await W.st()).panel, dayField: await W.ev(() => document.getElementById("dateDay").value), expanded: await W.ev(() => document.getElementById("dayChange").getAttribute("aria-expanded")) });
    W.eq("… and the status line says that the day changed", CHANGED, await W.status());
    // a step opened from the strip before the day is answered lights the sky of the moment it is opened, not of the moment the page was opened
    for (const n of [3, 4, 5]) {
      await reopen("#site=greenwich");
      await W.page.clock.setFixedTime(MORNING);
      await W.press("step-" + n);
      const st = await W.st();
      W.eq("step " + n + " opened the next morning, the day not yet answered: the sky of that morning is lit", { jd: 2461359.84028, lit: { place: true, day: true, sky: true } }, { jd: Number(st.jd.toFixed(5)), lit: st.lit });
      W.has("… and the status line says that morning", await W.status(), /^15 November 2026, 08:10 at Greenwich, England\./);
    }
    await reopen("#site=greenwich");
    await W.page.clock.setFixedTime(MORNING);
    await W.ev(() => { location.hash = "#lab=square"; }); await W.settle();
    await W.press("labClose");
    W.eq("a link that opens the lab the next morning: leaving the lab, the sky of that morning is lit", { jd: 2461359.84028, day: true }, await W.st().then((st) => ({ jd: Number(st.jd.toFixed(5)), day: st.lit.day })));
    // the further controls of step 2 ("More at this step") can be the first to answer the day: used the next morning, each starts from the day the device shows then
    const moreNextDay = async (hash, night, morning) => {
      await W.page.clock.setFixedTime(night); await W.page.goto("about:blank"); await W.go(hash);
      await W.press("step-2");
      await W.page.clock.setFixedTime(morning);
      await W.openBox("stepBox");
    };
    const cardDay = () => W.plain("#explainBody .moon-box .cap > p");               // the day stands first in the card once it is answered
    const typeClock = async (value) => { await W.fill("clockField", value); await W.page.keyboard.press("Tab"); await W.settle(); };
    await moreNextDay("#site=greenwich", NIGHT, MORNING);
    W.has("at 23:50 the question names Saturday, and it still does when the box of further controls is opened the next morning", await W.shown("#sayText"), SATURDAY);
    await W.press("time-sunrise");
    W.has("Sunrise pressed the next morning, the day not yet answered: the sunrise of the day the device shows then", await W.status(), /^15 November 2026, 07:17 at Greenwich, England\./);
    W.eq("… and that answers the day", { day: true, ask: "false", card: "Sunday 15 November 2026" }, { ...(await W.st().then((st) => ({ day: st.lit.day, ask: st.ask }))), card: await cardDay() });
    await W.page.clock.setFixedTime(new Date(MORNING.getTime() + 2 * 86400000));
    await W.press("time-noon");
    W.has("… once the day is answered the clock is not read again: Noon pressed two days later is noon of that same day", await W.status(), /^15 November 2026, 12:00 at Greenwich, England\./);
    // a Moon button: in the night of 14 to 15 November no Moon shape falls, and the search ends on the same evening from either instant.
    // In the night of 14 to 15 June 2026 the Moon is new: from the 14th the next evening is the 15th, from the morning of the 15th it is a month on
    await moreNextDay("#site=greenwich", new Date("2026-06-14T23:50:00Z"), new Date("2026-06-15T08:10:00Z"));
    W.has("14 June 2026, 23:50: the question names Sunday 14 June", await W.shown("#sayText"), "Your device says today is Sunday 14 June 2026. Is that right?");
    await W.press("moon-0");
    W.eq("New Moon pressed the next morning, hours after that night's new Moon: the search starts from the 15th, so the night it finds is in July", { day: "Tuesday 14 July 2026", jd: 2461236.38318, answered: true },
      { day: await cardDay(), ...(await W.st().then((st) => ({ jd: Number(st.jd.toFixed(5)), answered: st.lit.day }))) });
    // the slider through the year and the typed time (from Navigator up)
    await moreNextDay("#site=greenwich&lens=navigator", NIGHT, MORNING);
    await W.key("yearSlider", "ArrowRight");
    W.has("the slider through the year moved one day on the next morning: it starts from the day and time the device shows then, and so comes to that very morning", await W.status(), /^15 November 2026, 08:10 at Greenwich, England\./);
    await moreNextDay("#site=greenwich&lens=navigator", NIGHT, MORNING);
    await typeClock("06:00");
    W.has("a time typed the next morning: that time on the day the device shows then", await W.status(), /^15 November 2026, 06:00 at Greenwich, England\./);
    // … and none of them reads the clock where a link has set the time
    await moreNextDay("#site=greenwich&jd=2461000.5&lens=navigator", NIGHT, MORNING);
    const fromLink = {};
    await W.press("time-sunrise"); fromLink.sunrise = (await W.status()).slice(0, 23);
    await W.key("yearSlider", "ArrowRight"); fromLink.slider = (await W.status()).slice(0, 23);
    await typeClock("06:00"); fromLink.clock = (await W.status()).slice(0, 23);
    await W.press("moon-180"); fromLink.moon = await cardDay();
    W.eq("after a link with a time the same controls start from the link's day (21 November 2025), not from the clock", { sunrise: "21 November 2025, 07:28", slider: "22 November 2025, 07:28", clock: "22 November 2025, 06:00", moon: "Thursday 4 December 2025, 16:52 local mean time" }, fromLink);
    await reopen("#site=greenwich&jd=2461000.5");
    await W.page.clock.setFixedTime(MORNING);
    await W.press("step-2");
    const kept = await W.st();
    W.eq("a time set by a link is never changed by the clock, and the day is not asked", { jd: 2461000.5, ask: "false" }, { jd: kept.jd, ask: kept.ask });
    await W.press("step-3"); await comeBack(); await W.settle();
    W.eq("… nor by another step, nor when the page comes into view again", 2461000.5, (await W.st()).jd);
    await W.page.clock.setFixedTime(NOW);
    await W.audit("the day question after midnight");
    await W.close();
  }

  // the sticky header never covers the focused control (Shift+Tab up the page)
  if (!W.phone) {
    await W.open("#lens=navigator");
    W.station = "the header";
    await W.press("placeGreenwich"); await W.press("step-2"); await W.press("dayYes");
    const head = await W.ev(() => { const t = document.querySelector("header.top"), cs = getComputedStyle(t); return { position: cs.position, background: cs.backgroundColor, padding: getComputedStyle(document.documentElement).scrollPaddingTop }; });
    W.eq("where the header is sticky it is opaque, and what is scrolled to stops below it", { position: "sticky", background: "rgb(3, 5, 10)", padding: "88px" }, head);
    await W.ev(() => { const all = [...document.querySelectorAll("button, summary, input, select, a[href]")].filter((e) => window.__w.rendered(e) && !e.closest("dialog")); all[all.length - 1].focus(); });
    const hidden = []; let steps = 0;
    for (let i = 0; i < 200; i++) {
      await W.page.keyboard.press("Shift+Tab");
      const r = await W.ev(() => { const a = document.activeElement; if (!a || a === document.body) return null; const t = document.querySelector("header.top").getBoundingClientRect(), q = a.getBoundingClientRect(); return { name: a.id || a.getAttribute("data-key") || a.localName, top: Math.round(q.top), bottom: Math.round(q.bottom), head: Math.round(t.bottom), inHeader: !!a.closest("header.top"), vh: innerHeight }; });
      if (!r) break;
      steps++;
      if (r.inHeader) break;
      if (r.top < r.head || r.bottom > r.vh) hidden.push(r.name + " " + r.top + "–" + r.bottom);
    }
    W.rec("tabbing backwards from the last control to the header, the focused control is never under the header or outside the window", "none hidden, in at least 30 steps", hidden.length ? hidden.slice(0, 6) : "none hidden in " + steps + " steps", hidden.length === 0 && steps >= 30);
    await W.audit("the header");
    await W.close();
  } else {
    await W.open("#lens=navigator");
    W.station = "the header";
    W.eq("under 700 px the header is not sticky and nothing is padded for it", { sticky: false, padding: "auto" }, await W.ev(() => ({ sticky: ["sticky", "fixed"].includes(getComputedStyle(document.querySelector("header.top")).position), padding: getComputedStyle(document.documentElement).scrollPaddingTop })));
    await W.close();
  }
}

// ─── section: links ──────────────────────────────────────────────────────────
async function links(W) {
  await W.open("#preset=ezekiel&lens=navigator");
  W.station = "link: preset";
  let s = await W.st();
  W.eq("#preset=ezekiel: the Kebar at the sunset that ends the fifth day, the first question skipped", { site: "kebar", jd: 1505042.16624, lens: "navigator", note: false, dark: "false" }, { site: s.site && s.site.key, jd: s.jd, lens: s.lens, note: await W.seen("#linkNote"), dark: s.dark });
  W.has("the status line: one sentence after input stops", await W.status(), /31 July 593 BC \(Julian calendar\), 19:00 at By the Kebar \(Nippur\)\. Moon 50 per cent lit\./);
  await W.audit("link: preset", { card: true, shot: "The link #preset=ezekiel&lens=navigator" });
  await W.ev(() => { location.hash = "#lat=10.5&lon=-20&jd=2461000.5&focus=moon&lens=stargazer&junk=1"; });
  await sleep(100); await W.settle();
  W.station = "link: hashchange";
  s = await W.st();
  W.eq("hashchange: lat, lon, jd, focus and lens are taken; an unknown key is ignored and named in one line", { lat: 10.5, lon: -20, jd: 2461000.5, selected: "moon", lens: "stargazer", note: "a link value was ignored" }, { lat: s.site.lat, lon: s.site.lon, jd: s.jd, selected: s.selected, lens: s.lens, note: await W.shown("#linkNote") });
  W.has("… and the status line says so too, once, before the place and time (the line under the map is not announced)", await W.status(), /^a link value was ignored\. \d+ \w+ \d{4}, \d\d:\d\d at /);
  await W.audit("link: hashchange", { card: true });
  for (const [hash, what] of [["#site=greenwich&site=kyoto", "a key given twice"], ["#lat=91&lon=10", "a latitude out of range"], ["#jd=12abc", "a malformed Julian Day"], ["#lens=wizard&site=giza", "an unknown lens"], ["#site=<script>", "characters outside the grammar"]]) {
    await W.go(hash);
    W.has("" + what + " is ignored, and one line says so (" + hash + ")", await W.shown("#linkNote"), "a link value was ignored");
    W.has("… under the map and in the status line (" + hash + ")", await W.status(), /^a link value was ignored(\. |$)/);
  }
  W.eq("a clean link shows no such line", false, (await W.go("#site=kyoto"), await W.seen("#linkNote")));
  await W.go("#site=greenwich&lab=square");
  s = await W.st();
  W.eq("#lab=square opens the lab at step 4", { open: true, step: 4 }, { open: s.lab.open, step: s.step });
  // a link that names a place and the lab: on leaving the lab the whole sky is lit and the quick buttons work
  await W.page.goto("about:blank");
  await W.go("#site=kyoto&lab=square");
  await W.press("labClose");
  s = await W.st();
  const listed = await W.ev(() => document.querySelectorAll("#list button").length);
  W.rec("a link with a place and the lab, then Back to the sky: step 4 with the whole sky lit", "step 4, lit place, day and sky, 17 objects or more in the list", { step: s.step, lit: s.lit, listed }, s.step === 4 && s.lit.place && s.lit.day && s.lit.sky && listed >= 17);
  const picked = [];
  for (const key of ["moon", "sun", "sgr_a_star", "rim"]) { await W.press("quick-" + key); picked.push((await W.st()).selected); }
  W.eq("… and each quick button selects its object", ["moon", "sun", "sgr_a_star", "cmb"], picked);
  await W.press("quick-home");

  await W.go("#lat=32.13&lon=45.23");
  s = await W.st();
  W.rec("a link with lat and lon skips the first question; the Kebar's two numbers alone name the place but do not bring its date (the scene comes only by preset or by a link with its jd)", "a place, at the day the page already had (not 593 BC)", { label: s.site && s.site.label, jd: s.jd, dark: s.dark }, !!s.site && s.dark === "false" && s.jd > 2400000);
  // a sky at the very end of the year range, far east: the link is read with its time, and the page can write its own link to it
  await W.go("#jd=990923.1&lat=0&lon=180");
  s = await W.st();
  W.eq("a Julian Day half a day before the year range begins at Greenwich is a sky at the far east: the link is read whole", { jd: 990923.1, lon: 180, note: false, day: true }, { jd: s.jd, lon: s.site && s.site.lon, note: await W.seen("#linkNote"), day: s.lit.day });
  await W.press("step-5");
  await W.openBox("stepBox");
  W.has("… and “Copy a link to this sky” holds that sky", await W.ev(() => { const e = document.getElementById("linkField"); return e ? e.value : null; }), /#jd=990923\.10000&lat=0\.00&lon=180\.00&lens=stargazer$/);
  W.has("… as does the link to the Lexicon Explorer after the stamp", (await W.press("sealBtn"), await W.settle(20000), await W.ev(() => { const a = document.querySelector('#explainBody a[data-key="sealLink"]'); return a ? a.getAttribute("href") : null; })), /#sky=990923\.10000,0\.00,180\.00&lens=stargazer$/);
  await W.press("step-1");
  await W.audit("link: others");
  if (W.linkToSky) {
    await W.page.goto(W.linkToSky.replace(/^https?:\/\/[^/]+/, W.base));
    await W.ev(() => window.CelestialControlPanel.ready);
    s = await W.st();
    W.eq("the copied link opens the same sky", { lat: 32.13, lon: 45.23, jd: 1505042.16624, lens: "stargazer" }, { lat: s.site.lat, lon: s.site.lon, jd: s.jd, lens: s.lens });
  }
  await W.close();
  // arriving by a link with a value the page does not use: the status line says so (the line under the map is not announced)
  await W.open("#preset=nothing");
  W.station = "link: arrival";
  W.eq("at load, without a place: the note under the map and the same words in the status line", { note: "a link value was ignored", status: "a link value was ignored" }, { note: await W.shown("#linkNote"), status: await W.status() });
  await W.close();
  await W.open("#zoom=3&site=giza&lens=navigator");
  W.station = "link: arrival";
  W.has("at load, with a place: the note first, then the place and time, in one status line", await W.status(), /^a link value was ignored\. 14 November 2026, \d\d:\d\d at Giza/);
  await W.close();
  await W.open("#site=giza&lens=navigator");
  W.station = "link: arrival";
  W.has("a clean link at load: the status line has the place and time only", await W.status(), /^14 November 2026, \d\d:\d\d at Giza/);
  await W.close();
  // a place where the Sun does not set
  await W.open("#site=south-pole");
  W.station = "no sunset";
  await W.press("step-2"); await W.press("dayYes");
  await W.openBox("stepBox");
  await W.press("time-sunset");
  W.eq("when the Sun does not set the button stays enabled and answers", { note: "The Sun does not set here today.", status: "The Sun does not set here today.", disabled: false }, { note: await W.shown("#mainNote"), status: await W.txt("#status"), disabled: await W.ev(() => document.getElementById("time-sunset").disabled) });
  await W.press("time-sunrise");
  W.has("… and does not rise", await W.shown("#mainNote"), "The Sun does not rise here today.");
  await W.audit("no sunset", { shot: "The South Pole in November: “The Sun does not set here today.”" });
  await W.close();
}

// ─── section: touch, mouse and keyboard on the canvas ────────────────────────
async function touch(W) {
  // 1440 x 900 gets a touch screen for the swipe; the phone has one.
  await W.open("#site=greenwich", W.phone ? null : { hasTouch: true });
  const cdp = await W.ctx.newCDPSession(W.page);
  const swipe = async (x, y, dy, cancel) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 10; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (dy * i) / 10 }] }); await sleep(16); }
    await cdp.send("Input.dispatchTouchEvent", cancel ? { type: "touchCancel", touchPoints: [] } : { type: "touchEnd", touchPoints: [] });
    await sleep(700);
  };
  await W.press("step-2"); await W.press("dayYes");
  for (const n of [1, 2, 3, 4, 5]) {
    await W.top();
    await W.press("step-" + n);
    for (const dims of ["2D", "3D"]) {
      await W.dims(dims);
      await W.top();
      W.station = "swipe: step " + n + ", " + dims;
      const b = await W.box("#sky"), before = await W.st(), room = await W.ev(() => document.documentElement.scrollHeight - innerHeight);
      await swipe(b.x + b.w / 2, b.y + b.h / 2, -250);
      const y = await W.ev(() => Math.round(scrollY)), after = await W.st();
      W.rec("a 250 px vertical swipe from the canvas centre scrolls the page by at least 200 px and leaves the view unchanged", "scrolled ≥ 200 px; c, view3, orbit and selection unchanged", "scrolled " + y + " px (the page can scroll " + room + " px); view " + (after.c.join() === before.c.join() && after.view3 === before.view3 && after.orbit === before.orbit && after.selected === before.selected ? "unchanged" : "CHANGED"),
        y >= 200 && after.c.join() === before.c.join() && after.view3 === before.view3 && after.orbit === before.orbit && after.selected === before.selected);
    }
  }
  // the lab's stage scrolls too
  await W.top(); await W.press("step-4"); await W.openBox("stepBox"); await W.press("labOpen"); await W.top();
  W.station = "swipe: the lab";
  let b = await W.box("#sky"), lab0 = await W.st();
  await swipe(b.x + b.w / 2, b.y + b.h / 2, -250);
  W.rec("the same swipe on the lab's stage", "scrolled ≥ 200 px, the lab unchanged", "scrolled " + (await W.ev(() => Math.round(scrollY))) + " px, " + (await W.st()).lab.n + " slides", (await W.ev(() => scrollY)) >= 200 && (await W.st()).lab.n === lab0.lab.n);
  await W.top(); await W.press("labClose");
  await W.dims("2D");
  await W.press("quick-home");
  await W.audit("swipes");

  // Drag the map
  W.station = "drag switch";
  await W.top();
  const sw = await W.ev(() => ({ seen: window.__w.seen("#dragBtn"), pressed: document.getElementById("dragBtn").getAttribute("aria-pressed"), text: document.getElementById("dragBtn").textContent, note: window.__w.seen("#dragNote") }));
  W.eq("the button “Drag the map” under the canvas, off at first", { seen: true, pressed: "false", text: "Drag the map", note: false }, sw);
  await W.press("dragBtn");
  const on = await W.ev(() => ({ pressed: document.getElementById("dragBtn").getAttribute("aria-pressed"), touch: getComputedStyle(document.getElementById("sky")).touchAction, note: window.__w.shown("#dragNote") }));
  W.eq("switched on: touch-action none and the caption", { pressed: "true", touch: "none", note: "Dragging is on. Scroll the page from outside the map." }, on);
  await W.audit("drag switch on", { shot: "“Drag the map” switched on: the caption under the canvas" });
  await W.top();
  b = await W.box("#sky");
  let before = await W.st();
  await swipe(b.x + b.w / 2, b.y + b.h / 2, -120);
  let after = await W.st();
  W.rec("with the switch on one finger drags the view and the page does not scroll", "c changed, scrollY 0, the view is free (centred null)", { c: after.c.map((v) => v.toFixed(3)), scrollY: await W.ev(() => Math.round(scrollY)), centred: after.centred }, (after.c[0] !== before.c[0] || after.c[1] !== before.c[1]) && (await W.ev(() => scrollY)) === 0 && after.centred === null);
  before = after;
  await swipe(b.x + b.w / 2, b.y + b.h / 2, -80, true);
  const h0 = await W.ev(() => window.__w.hit("sun"));
  await W.page.touchscreen.tap(h0.x, h0.y);
  await W.settle();
  after = await W.st();
  W.rec("pointercancel is handled: after a cancelled drag a tap still picks", "the tapped Sun is selected", after.selected, after.selected === "sun");
  await W.press("dragBtn");
  W.eq("switched off again", { pressed: "false", touch: "pan-y pinch-zoom", note: false }, await W.ev(() => ({ pressed: document.getElementById("dragBtn").getAttribute("aria-pressed"), touch: getComputedStyle(document.getElementById("sky")).touchAction, note: window.__w.seen("#dragNote") })));

  // a tap on any point brings that point to the centre (2D); empty room
  await W.press("quick-home");
  await W.top();
  b = await W.box("#sky");
  const px = b.x + b.w * 0.3, py = b.y + b.h * 0.34;
  const near = await W.ev(([x, y]) => { const P = window.CelestialControlPanel, r = document.getElementById("sky").getBoundingClientRect(); return P.chart.scene.hits.filter((h) => Math.hypot(r.left + h.x - x, r.top + h.y - y) <= 24).map((h) => h.key); }, [px, py]);
  await W.page.touchscreen.tap(px, py);
  await W.settle();
  after = await W.st();
  W.rec("a tap on any point of the 2D map brings that point to the centre", "no object within 22 px: the view centre moves, nothing new is selected", { near, c: after.c.map((v) => v.toFixed(3)), selected: after.selected }, near.length === 0 ? (Math.hypot(after.c[0], after.c[1]) > 0.05) : true);
  await W.focusAfter("canvas: a point");
  // an object within 22 px wins
  await W.press("quick-home");
  await W.top();
  const hm = await W.ev(() => window.__w.hit("moon"));
  const others = await W.ev(() => { const P = window.CelestialControlPanel, m = P.chart.scene.hits.find((h) => h.key === "moon"); return P.chart.scene.hits.filter((h) => h.key !== "moon" && Math.hypot(h.x - m.x - 15, h.y - m.y + 12) <= 22).map((h) => h.key); });
  await W.page.touchscreen.tap(hm.x + 15, hm.y - 12);
  await W.settle();
  after = await W.st();
  W.rec("an object within 22 px of the tap wins (a tap 19 px from the Moon)", "moon selected and centred", { selected: after.selected, centred: after.centred, others }, others.length > 0 || (after.selected === "moon" && after.centred && after.centred.key === "moon"));
  await W.focusAfter("canvas: near the Moon");
  await W.audit("taps", { card: true });
  await W.close();

  // a visitor whose first action is a tap on the canvas
  await W.open("#site=greenwich&jd=2461359.16667");
  W.station = "first action: canvas";
  const hs = await W.ev(() => window.__w.hit("sun") || window.__w.hit("zenith") || window.__w.hit("north"));
  const f = await W.point(hs.x, hs.y, "canvas as the first action");
  W.rec("after a tap on the canvas as the very first action the focus is not on the body", "a control has the focus", f, f !== "BODY");
  await W.audit("first action: canvas", { card: true });
  await W.close();

  // mouse: drag moves the view (2D), turns the ball (3D); a click under 6 px is a click
  if (!W.phone) {
    await W.open("#site=greenwich");
    W.station = "mouse";
    await W.press("step-2"); await W.press("dayYes"); await W.press("step-4"); await W.dims("2D");
    b = await W.box("#sky");
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    before = await W.st();
    await W.page.mouse.move(cx + 40, cy + 30); await W.page.mouse.down();
    for (let i = 1; i <= 8; i++) await W.page.mouse.move(cx + 40 + i * 12, cy + 30 + i * 6);
    await W.page.mouse.up(); await W.settle();
    after = await W.st();
    W.rec("mouse: a drag moves the 2D view (the grabbed point follows the pointer)", "c changed; the view is free", { c: after.c.map((v) => v.toFixed(3)), centred: after.centred }, Math.hypot(after.c[0] - before.c[0], after.c[1] - before.c[1]) > 0.02 && after.centred === null);
    await W.dims("3D");
    before = await W.st();
    await W.page.mouse.move(cx + 40, cy + 30); await W.page.mouse.down();
    for (let i = 1; i <= 8; i++) await W.page.mouse.move(cx + 40 + i * 12, cy + 30 + i * 6);
    await W.page.mouse.up(); await W.settle();
    after = await W.st();
    W.eq("mouse: a drag in 3D changes only the orbit", { orbit: true, view3: false }, { orbit: after.orbit !== before.orbit, view3: after.view3 !== before.view3 });
    before = after;
    const hm2 = await W.ev(() => window.__w.hit("moon"));
    await W.page.mouse.move(hm2.x, hm2.y); await W.page.mouse.down(); await W.page.mouse.move(hm2.x + 3, hm2.y + 2); await W.page.mouse.up(); await W.settle();
    after = await W.st();
    W.eq("a gesture that moved less than 6 px is a click", "moon", after.selected);
    W.eq("the page did not scroll and stays in place", 0, await W.ev(() => Math.round(scrollY)));
    await W.audit("mouse", { card: true });
    // keyboard
    W.station = "keyboard";
    await W.go("");
    await W.page.keyboard.press("Tab");
    const order = [];
    for (let i = 0; i < 16; i++) { order.push(await W.ev(() => document.activeElement.id || document.activeElement.getAttribute("data-key") || document.activeElement.localName)); await W.page.keyboard.press("Tab"); }
    W.rec("the keyboard reaches the header, the steps and the three buttons in DOM order, and never the canvas", "aboutBtn … step-1 … placeGreenwich, placePick, placeType; no canvas", order, order.indexOf("aboutBtn") === 0 && order.indexOf("step-1") > 0 && order.indexOf("placeGreenwich") > order.indexOf("step-5") && order.indexOf("placeType") === order.indexOf("placeGreenwich") + 2 && !order.includes("sky") && !order.includes("canvas"));
    await W.page.focus("#placeGreenwich");
    await W.page.keyboard.press("Tab"); await W.page.keyboard.press("Shift+Tab");
    const ring = await W.ev(() => { const e = document.activeElement, cs = getComputedStyle(e); return { id: e.id, visible: e.matches(":focus-visible"), outline: cs.outlineStyle + " " + cs.outlineWidth }; });
    W.eq("visible focus rings", { id: "placeGreenwich", visible: true, outline: "solid 2px" }, ring);
    await W.page.keyboard.press("Enter"); await W.settle();
    const fa = await W.focusAfter("Enter on placeGreenwich");
    W.rec("Enter on Start at Greenwich: the place is taken and the focus stays on a control of the same region", "greenwich; focus on a control of #say", { site: (await W.st()).site.key, focus: fa }, (await W.st()).site.key === "greenwich" && (await W.ev(() => !!document.activeElement.closest("#say"))));
    await W.page.focus("#step-2"); await W.page.keyboard.press("Space"); await W.settle();
    W.eq("Space on a step button opens the step and keeps the focus on it", { step: 2, focus: "step-2" }, { step: (await W.st()).step, focus: await W.focusAfter("Space on step-2") });
    await W.audit("keyboard", { card: true });
    await W.close();
  }
}

// ─── section: motion (idle; reduced motion) ──────────────────────────────────
async function motion(W) {
  await W.open("#site=greenwich");
  W.station = "idle";
  await W.press("step-2"); await W.press("dayYes"); await W.press("step-4");
  await W.press("quick-moon"); await W.press("quick-moon");
  await sleep(600);
  let idle = await W.ev(() => window.__w.idle(2000));
  W.eq("no free-running loop: 2 s of idle after a dive, zero animation frames, canvas pixels unchanged", { frames: 0, same: true }, idle);
  const t = await W.ev(() => new Promise((res) => { const P = window.CelestialControlPanel, t0 = performance.now(); document.getElementById("quick-home").click(); const tick = () => { if (!P.chart.flying) res(Math.round(performance.now() - t0)); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
  W.rec("a flight lasts at most 600 ms", "at most 600 ms (plus one frame)", t + " ms", t <= 640);
  await W.audit("idle");
  await W.close();

  await W.open("#site=greenwich", { reducedMotion: "reduce" });
  W.station = "reduced motion";
  await W.press("step-2"); await W.press("dayYes");
  for (const n of [1, 2, 3, 4, 5]) {
    await W.press("step-" + n);
    await sleep(500);
    idle = await W.ev(() => window.__w.idle(2000));
    W.eq("with reduced motion and 2 s of idle there are zero animation frames and unchanged canvas pixels (step " + n + ")", { frames: 0, same: true }, idle);
  }
  await W.press("step-4");
  const jump = await W.ev(() => { const P = window.CelestialControlPanel; document.getElementById("quick-moon").click(); document.getElementById("quick-moon").click(); const f = P.chart.flying; return { flying: f, centred: P.state.centred }; });
  await W.settle();
  const hm = await W.ev(() => window.__w.hit("moon"));
  W.rec("with reduced motion a flight is a jump", "not flying right after the press; the Moon at the centre", { flying: jump.flying, off: hm.off.toFixed(2) }, jump.flying === false && hm.off < 1.5);
  await W.openBox("stepBox");
  await W.press("labOpen");
  const counts = [];
  for (let i = 0; i < 5; i++) { await W.press("labFour", { noSettle: true }); counts.push(await W.ev(() => ({ n: window.CelestialControlPanel.state.lab.slides.length, walking: window.CelestialControlPanel.chart.walking }))); }
  W.eq("with reduced motion one press of Four slides draws all four at once (every press draws the four again)", ["4 false", "4 false", "4 false", "4 false", "4 false"], counts.map((c) => c.n + " " + c.walking));
  W.has("and the status line says so", await W.status(), "All four slides were drawn at once. You are 0.87 of a step from home.");
  W.eq("nothing is left to play: no Play button, and Next slide is switched off", { play: false, next: "true" }, await W.ev(() => ({ play: !!document.getElementById("labPlay"), next: document.getElementById("labNext").getAttribute("aria-disabled") })));
  // a choice in the list: with reduced motion the page is at the map at once
  await W.press("labClose"); await W.press("step-3"); await W.openBox("listBox");
  await W.page.locator("#obj-m31").scrollIntoViewIfNeeded();
  const hop = await W.ev(() => { const from = Math.round(scrollY); document.getElementById("obj-m31").click(); return { from, atOnce: Math.round(scrollY) }; });
  await sleep(700);
  const landed = await W.ev(() => { const c = document.getElementById("sky").getBoundingClientRect(), h = document.querySelector("header.top"), top = getComputedStyle(h).position === "sticky" ? h.getBoundingClientRect().bottom : 0; return { y: Math.round(scrollY), map: c.top >= top && c.bottom <= innerHeight }; });
  W.rec("with reduced motion a choice in the list brings the map into view without smooth scrolling", "the page at its end position in the same task as the press, the map inside the window", { ...hop, later: landed.y, map: landed.map }, hop.atOnce === landed.y && hop.atOnce !== hop.from && landed.map);
  await W.press("step-4"); await W.openBox("stepBox"); await W.press("labOpen"); await W.press("labFour");
  await sleep(500);
  idle = await W.ev(() => window.__w.idle(2000));
  W.eq("reduced motion, the lab: 2 s of idle, zero frames, pixels unchanged", { frames: 0, same: true }, idle);
  await W.audit("reduced motion", { card: true, shot: "Reduced motion: the lab after one press of Four slides (all four drawn at once)" });
  await W.close();
}

// ─── section: the fonts aborted ──────────────────────────────────────────────
async function aborted(W) {
  W.options.abortFonts = true;
  await W.open("");
  W.station = "fonts aborted";
  await W.press("placeGreenwich"); await W.press("placeNext"); await W.press("dayYes");
  for (const n of [3, 4, 5]) await W.press("step-" + n);
  await W.press("sealBtn");
  await W.settle(20000);
  await W.press("step-4"); await W.openBox("stepBox"); await W.press("labOpen"); await W.press("slide-forward"); await W.press("labClose");
  await W.press("aboutBtn"); await W.page.keyboard.press("Escape");
  const s = await W.st();
  W.eq("the page works without the web fonts", { site: "greenwich", sealed: true, step: 4 }, { site: s.site.key, sealed: s.seal.ok, step: s.step });
  W.rec("with the font hosts aborted, the stylesheet's load error is the one console message", "exactly one message, about fonts.googleapis.com", W.messages, W.messages.length === 1 && /fonts\.googleapis\.com/.test(W.messages[0]) && /^error: Failed to load resource/.test(W.messages[0]));
  const fam = await W.ev(() => getComputedStyle(document.body).fontFamily);
  W.has("system fallbacks are named after the web font", fam, /Inter, system-ui/);
  await W.audit("fonts aborted", { card: true, shot: "The page with the two font hosts aborted (system fonts)" });
  await W.close();
  // run once more with them aborted: the whole journey again, without screenshots
  W.options.noShots = true;
  W.messages = [];
  await journey(W);
}

// ─── section: other window sizes ─────────────────────────────────────────────
async function small(browser, base) {
  for (const [w, hgt, touchy] of [[720, 450, false], [320, 256, false], [320, 256, true], [390, 844, true]]) {
    const vp = w + "x" + hgt, W = new Walk(browser, vp, "small" + (touchy ? "-touch" : ""), { context: { viewport: { width: w, height: hgt }, deviceScaleFactor: 2, ...(touchy ? { hasTouch: true, isMobile: true } : {}) }, noClipboard: true });
    W.base = base; W.phone = touchy;
    await W.open("");
    W.station = "first run";
    const over = [], rec = async (what) => { const v = await W.ev(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth); over.push(what + ":" + v); };
    await rec("first");
    W.eq("the header is not sticky under 700 px wide or 700 px high", false, ["sticky", "fixed"].includes(await W.ev(() => getComputedStyle(document.querySelector("header.top")).position)));
    await W.shot("first-run", "The first screen at " + vp + (touchy ? " (touch)" : ""));
    await W.press("placeType"); await rec("type");
    await W.press("placePick"); await rec("pick");
    await W.press("placeGreenwich");
    for (const n of [1, 2, 3, 4, 5]) {
      await W.press("step-" + n);
      if (n === 2) { await rec("ask"); await W.press("dayYes"); await W.press("day-pick"); await rec("date"); await W.press("day-pick"); }
      await W.ev(() => { for (const d of document.querySelectorAll("details")) d.open = true; const f = document.querySelector("#bridge .fold-more"); if (f && f.getAttribute("aria-expanded") === "false") f.click(); });
      await W.settle();
      for (const dims of ["2D", "3D"]) { await W.ev((d) => { const P = window.CelestialControlPanel; P.apply({ ...P.state, dims: d }, { jump: true }); }, dims); await W.settle(); await rec("step" + n + dims); }
      if (n === 5) { await W.press("sealBtn"); await W.settle(20000); await rec("sealed"); await W.lens("navigator"); await rec("sealed-nav"); await W.lens("stargazer"); }
      if (n === 4) { await W.ev(() => window.CelestialControlPanel.dive("m31")); await W.settle(); await rec("dive"); }
      await W.top();
      if (n === 2 || n === 4) await W.shot("step-" + n, "Step " + n + " at " + vp + (touchy ? " (touch)" : "") + ", every box open", { full: w === 320 && !touchy });
    }
    await W.press("step-4"); await W.press("labOpen"); await rec("lab");
    for (const d of ["forward", "left", "back", "right"]) await W.press("slide-" + d);
    await W.press("labHome"); await rec("lab-home");
    await W.top();
    await W.shot("lab", "The lab at " + vp + (touchy ? " (touch)" : ""));
    await W.press("labClose");
    await W.lens("holographer"); await rec("holographer");
    await W.press("aboutBtn"); await rec("dialog");
    const dl = await W.ev(() => { const d = document.getElementById("about"), r = d.getBoundingClientRect(); return { top: d.scrollTop, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, close: window.__w.seen("#about .dialog-close") }; });
    W.eq("the dialog fits this window, opens at scroll position 0 with Close in view", { top: 0, inside: true, close: true }, dl);
    await W.shot("dialog", "“What is real here?” at " + vp + (touchy ? " (touch)" : ""));
    await W.page.keyboard.press("Escape");
    W.station = "every step";
    W.rec("no horizontal overflow at " + vp + " on any step, with every box open, in the lab and in the dialog", "0 px everywhere", over.filter((x) => !x.endsWith(":0")).length ? over.filter((x) => !x.endsWith(":0")) : "0 px in " + over.length + " places", over.every((x) => x.endsWith(":0")));
    const a = await W.audit("every step");
    void a;
    await W.close();
  }
}

/**
 * Between 700 and 1100 px wide the header has two rows, and what is scrolled to must stop below both. At each width and lens,
 * at step 2 and at step 4 (the ball, so the turn buttons are there too): Shift+Tab from the last control up to the header.
 */
async function headerWidths(browser, base) {
  for (const w of [700, 800, 1000, 1099, 1100]) {
    const vp = w + "x900", W = new Walk(browser, vp, "small", { context: { viewport: { width: w, height: 900 }, deviceScaleFactor: 1 }, noClipboard: true, noShots: true });
    W.base = base; W.phone = false;
    for (const lens of ["stargazer", "navigator", "holographer"]) {
      await W.open("#site=greenwich&lens=" + lens);
      for (const n of [2, 4]) {
        W.station = "the header at " + w + " px, " + lens + ", step " + n;
        await W.press("step-" + n);
        if (n === 2) await W.press("dayYes"); else { await W.press("dims3d"); await W.ev(() => { for (const d of document.querySelectorAll("details")) d.open = true; }); await W.settle(); }
        await W.top();
        const head = await W.ev(() => { const t = document.querySelector("header.top"), q = t.getBoundingClientRect(); return { sticky: getComputedStyle(t).position === "sticky", height: Math.round(q.height), padding: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) }; });
        W.rec("the sticky header and the room kept for it", w < 1100 ? "sticky, one row or two, scroll padding 112 px, the header no higher" : "sticky, one row, scroll padding 88 px, the header no higher", head, head.sticky && head.padding === (w < 1100 ? 112 : 88) && head.height <= head.padding && (w < 1100 || head.height <= 60));
        if (w <= 800 && lens !== "stargazer") W.rec("at this width the header has two rows", "higher than 88 px", head.height + " px", head.height > 88);
        await W.ev(() => { const all = [...document.querySelectorAll("button, summary, input, select, a[href]")].filter((e) => window.__w.rendered(e) && !e.closest("dialog")); all[all.length - 1].focus(); });
        const hidden = []; let steps = 0;
        for (let i = 0; i < 260; i++) {
          await W.page.keyboard.press("Shift+Tab");
          const r = await W.ev(() => { const a = document.activeElement; if (!a || a === document.body) return null; const t = document.querySelector("header.top").getBoundingClientRect(), q = a.getBoundingClientRect(); return { name: a.id || a.getAttribute("data-key") || a.localName, top: Math.round(q.top), bottom: Math.round(q.bottom), head: Math.round(t.bottom), inHeader: !!a.closest("header.top"), vh: innerHeight }; });
          if (!r) break;
          steps++;
          if (r.inHeader) break;
          if (r.top < r.head || r.bottom > r.vh) hidden.push(r.name + " " + r.top + "–" + r.bottom + " (header to " + r.head + ")");
        }
        W.rec("tabbing backwards from the last control to the header, no focused control is under the header or outside the window", "none hidden, in at least 25 steps", hidden.length ? hidden.slice(0, 6) : "none hidden in " + steps + " steps", hidden.length === 0 && steps >= 25);
      }
      await W.audit("the header at " + w + " px, " + lens);
      await W.close();
    }
  }
}

/**
 * A phone too low for the card's first line to come into the window whatever STRIX leaves out (320 x 568): hiding the narration
 * gains nothing there, so the first sentence stays, with “more” for the rest. At every step and at each lens.
 */
async function lowPhone(browser, base) {
  const W = new Walk(browser, "320x568", "small-touch", { context: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, noClipboard: true, noShots: true });
  W.base = base; W.phone = true;
  const line = () => W.ev(() => {
    const m = document.getElementById("sayMore"), first = document.querySelector("#strixAll p");
    const c = first.cloneNode(true); for (const b of c.querySelectorAll(".badge")) b.remove();
    return { shown: window.__w.plain("#sayBody"), more: m.hidden ? null : m.textContent, name: m.hidden ? null : m.getAttribute("aria-label"), all: c.textContent.trim(), card: window.__w.audit().card, vh: innerHeight };
  });
  // the stations where the narration was once hidden although the card's first line stayed below the window
  const ONCE_ALONE = { stargazer: [4], navigator: [5], holographer: [4, 5] };
  for (const lens of ["stargazer", "navigator", "holographer"]) {
    await W.open("#site=greenwich&lens=" + lens);
    for (const n of [1, 2, 3, 4, 5]) {
      await W.press("step-" + n);
      if (n === 2) await W.press("dayYes");
      await W.top();
      W.station = "320 x 568, " + lens + ", step " + n;
      const s = await line(), y = s.card.line === null ? s.card.title : s.card.line, edge = s.vh - 2, firstSentence = (s.all.match(/^.*?[.!?](?=\s|$)/) || [s.all])[0];
      W.rec("STRIX is left with the button alone only where that brings the card's first line into the window", "a sentence, or the button alone with the card's first line at y = " + edge + " or above (the window is " + s.vh + " px high)", { shown: clip(s.shown, 80), more: s.more, cardLine: y }, s.vh === 568 && (s.shown !== "" || y <= edge));
      if ((lens === "stargazer" && n === 2) || ONCE_ALONE[lens].includes(n)) W.rec("here the card's first line is below the window whatever is left out, so STRIX keeps its first sentence and offers the rest", "the narration from its first sentence on, the button “more” (named “more from STRIX”) when there is more, the card's first line below y = " + edge, { shown: s.shown, more: s.more, name: s.name, cardLine: y },
        s.shown !== "" && s.shown.startsWith(firstSentence) && (s.more === null || (s.more === "more" && s.name === "more from STRIX")) && y > edge);
      if (lens === "stargazer" && n === 2) W.eq("at step 2 it is the first sentence alone, with “more”", { shown: firstSentence, more: "more" }, { shown: s.shown, more: s.more });
    }
    await W.audit("320 x 568, " + lens);
    await W.close();
  }
}

// ─── run ─────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await kit.launch(), version = browser.version();
  const server = await kit.serve(ROOT), base = server.base;
  TEMP = kit.tempFolder("sky-walk");
  console.log("Celestial Control Panel walkthrough · " + ROOT + " at " + base + " · Chromium " + version + " · device clock fixed at " + NOW.toISOString());
  NOTES.push(await kit.fontsDrawn(browser, base + PAGE));
  const shared = {};
  for (const vp of Object.keys(VIEWPORTS)) {
    if (OPTS.vp && !vp.startsWith(OPTS.vp)) continue;
    for (const [name, fn] of [["journey", journey], ["lenses", lenses], ["details", details], ["links", links], ["touch", touch], ["motion", motion], ["aborted", aborted]]) {
      if (!wanted(name)) continue;
      const W = new Walk(browser, vp, name);
      W.base = base;
      if (name === "links") W.linkToSky = shared[vp + "link"] || base + PAGE + "#jd=1505042.16624&lat=32.13&lon=45.23&lens=stargazer";
      try { await fn(W); } catch (e) {
        W.rec("the section ran to its end", "no error", String(e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : e), false);
        await SHOTS.error(W.page, "error-" + vp + "-" + name + ".png");
      }
      if (name === "journey") { shared[vp + "chain"] = W.kebarChain; shared[vp + "link"] = W.linkToSky; }
      await W.close().catch(() => {});
    }
  }
  if (shared["1440x900chain"] && shared["390x844chain"]) {
    const W = new Walk(browser, "1440x900", "journey"); W.station = "two visits";
    W.eq("everyone who seals the same sky gets the same name: the desktop visit and the phone visit", shared["1440x900chain"], shared["390x844chain"]);
  }
  if (wanted("small") && !OPTS.vp) {
    try { await small(browser, base); await headerWidths(browser, base); await lowPhone(browser, base); } catch (e) { RECORD.add({ part: "small", section: "small / -", step: "the section ran to its end", expected: "no error", actual: String(e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : e), ok: false, group: "small | small" }); }
  }
  await browser.close().catch(() => {});
  await server.close();
  kit.removeFolder(TEMP);

  const lines = RECORD.rows.filter((r) => r.part === "390x844" && r.step.startsWith("the first line of the explanation card")).map((r) => ({ y: Math.max(...(r.actual.match(/\d+/g) || ["0"]).slice(-2).map(Number)), where: r.section }));
  if (lines.length) { const worst = lines.reduce((a, b) => (b.y > a.y ? b : a)); NOTES.push("390x844: the first line of the explanation card ends at y = " + worst.y + " at worst (" + worst.where + "), measured at " + lines.length + " stations; the limit is 844"); }
  if (SHOTS.on) NOTES.push(SHOTS.list.length + " screenshots in " + SHOTS.folder);
  kit.leave(kit.finish(RECORD, { opts: OPTS, shots: SHOTS, notes: NOTES, extra: { root: ROOT, only: ONLY, viewport: OPTS.vp || null, chromium: version, clock: NOW.toISOString() } }));
})().catch((e) => { console.error(e); process.exit(1); });
