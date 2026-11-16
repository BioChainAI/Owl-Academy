// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Browser walkthrough of the Lexicon Explorer (Library/Experimental_Systems/Lexicon_Explorer/). Optional, run by
// hand; it is not part of node --test. It opens the real page in headless Chromium, uses every station and control
// as a visitor would (taps on a phone, the mouse and the keyboard on a wide screen), and records what the page
// shows against what it should show.
//
//   node tests/browser/lexicon-explorer.cjs                 every part, about ten minutes
//   node tests/browser/lexicon-explorer.cjs --part=phone    one part or several: phone (390 x 844, touch),
//                                                           desk (1440 x 900, mouse), small (720 x 450 and
//                                                           320 x 256; the map as a ball at 320 x 568),
//                                                           fonts (the two font hosts aborted)
//   node tests/browser/lexicon-explorer.cjs --only=S06,S07  some sections, at phone and desk unless --part says otherwise
//   --root=<folder>    walk a copy of the repository in another folder
//   --shots=<folder>   write the screenshots (PNG, two device pixels per CSS pixel) and manifest.json there
//   --json=<file>      write every check with expected and actual
//   --verbose          print every check, not only the failures and one line per section
//
// Sections: S01 first screen, S02 the first minute by pointer, S03 the first minute by keyboard alone, S04 the
// reader in both wordings, S05 counting, S06 the tree (tap, list, keys, buttons), S07 touch and pointer on the
// canvas, S08 layers, S09 seal and tamper, S10 send to the four receivers, S11 the fourth square, S12 wheel and
// square, S13 the three lenses at every station and tab, S14 the dialog, S15 loading a package file, S16 links,
// S17 reduced motion, S18 place, S19 the author's notes, John 3:16, pointers and links out, S20 the layout, the
// list, the banner that stays and a sky from a link, S21 the keyboard, what is announced, Stargazer words, S22 the
// names a young reader is shown, the pointers of lines 2 and 7, a long ledger from a file, flights that are seen,
// taps on markers, and what is scrolled to between 700 and 1100 px wide. S19 to S21 also open the page at 320 x 568,
// 375 x 667 and 699 x 900: where the focus is after "Switch to Navigator", and what STRIX shows in a low phone window.
// At every station it asserts: visible text is 17 or 14 px (13 px only for hashes), every enabled control is at
// least 44 x 44 px for a finger and 32 x 32 px for the mouse, nothing scrolls sideways, on the phone the first line
// of the explanation card ends above y = 844, the focus is never left on the body and never under the sticky
// header, and the console stays clean.
//
// It needs Playwright with Chromium (see tests/browser/README.md). It serves the repository itself on 127.0.0.1 and
// a free port, answers the two font hosts with empty 200 responses (aborts them in the part "fonts"), refuses any
// other request that would leave this computer, drives the page through its fixed ids and
// window.LexiconExplorer, and writes nothing into the repository. Exit code 0 only when every check passed.
const kit = require("./lib/walk-kit.cjs");
const L = require("./lib/lexicon-page.cjs");
const { E, state, settle, idle, sleep, swipe, same, fs, path } = L;

const USAGE = "node tests/browser/lexicon-explorer.cjs [--part=phone,desk,small,fonts] [--only=S06,S07] [--root=<folder>] [--shots=<folder>] [--json=<file>] [--verbose]";
const OPTS = kit.options(__dirname, USAGE, ["part", "only"]);
const ROOT = OPTS.root;
kit.needFile(ROOT, L.PAGE_PATH.slice(1));
const PARTS = kit.listOption(OPTS.part, ["phone", "desk", "small", "fonts"], "part") || (OPTS.only === undefined ? ["phone", "desk", "small", "fonts"] : ["phone", "desk"]);
const SHOTS = new kit.Shots(OPTS.shots, "Screenshots of the Lexicon Explorer walkthrough (tests/browser/lexicon-explorer.cjs). PNG, two device pixels per CSS pixel.");
let FILES = null;                                                    // the temporary folder of this run: two package files to load, and what the page downloads

const STAR_STATIONS = ["read", "count", "layers", "seal"], ALL_STATIONS = ["read", "count", "place", "layers", "seal", "send", "fourth"];
const LEGEND = ["These exact words are in the book named beside them. You can open that book and look.", "Someone named here says this. They may be right or wrong.",
  "This page counted it or worked it out, and shows you how to do it again.", "This is how the makers of this page see it. It is a way of looking, not a proof."];
const BADGE_HELP = "CHECKED means you can repeat this count or calculation. It does not mean the words beside it are proved.";
const STRIX_FIRST = "The book of Ezekiel begins with a place and a day. Tap a shining word to see what we know about it.";
const OUTSIDE_NOTICE = "This lexicon was not made by this page. Its words and its labels are its sender's. The checks below show only that the lexicon, its labels and the ledger up to the signed point have not changed since some key signed them.";
const OUTSIDE_SHORT = "Not made by this page. Its words and labels are its sender's.";
const SKY_BANNER = "This sky was built from a link: a place and a time. Stamp it here. The same place and time always get the same name.";
const MORE_LEVELS = "The Navigator level shows more: the chain, the Overwatch checks and four receivers. It also shows the path to John 3:16 and the fourth square.";
const SKY_LEVELS = "The Navigator level shows more: the chain, the Overwatch checks and four receivers.";
const TWO_NOTES = "a link value was ignored. That link names an entry this lexicon does not have.";   // two notes of one link, joined
const OWN_TITLE = "Lexicon Explorer · Ezekiel 1:1-9 in hyperbolic space";
const JOHN_STAR = "We read John 3:16 as the bridge, in the Gospel's own words. It is love from its source to the world. You may see it another way.";
const WING = "Library/Experimental_Systems/";
/** The sentence of the banner that is on show (the whole notice from 700 px, one line under it). */
const bannerNow = () => { const p = Array.from(document.querySelectorAll("#banner p")).find((x) => window.__W.shown(x)); return window.__W.shown(document.getElementById("banner")) && p ? p.textContent : null; };
const LAYER_COLOURS = ["rgb(241, 245, 249)", "rgb(96, 165, 250)", "rgb(134, 239, 172)", "rgb(251, 191, 36)"];
const FILE_NAME = /^hyperpack-BC-[0-9a-f]{24}\.json$/;

/** One open page with the gestures of one viewport and the record. */
class Walk {
  constructor(rec, vp, o) { Object.assign(this, o); this.rec = rec; this.vp = vp; this.phone = vp.phone; this.acts = 0; this.focusBad = []; this.covered = []; this.min = vp.phone ? 44 : 32; }
  check(step, expected, actual, ok) { return this.rec.check(step, expected, actual, ok); }
  ev(fn, arg) { return E(this.page, fn, arg); }
  async afterAct(what) {
    await sleep(110); this.acts++;
    const f = await this.ev(() => { const a = document.activeElement, hd = document.getElementById("topWrap"); let under = false;
      if (a && a !== document.body && getComputedStyle(hd).position === "sticky" && !hd.contains(a) && !a.closest("dialog")) { const r = a.getBoundingClientRect(), b = hd.getBoundingClientRect().bottom; under = r.height > 0 && r.bottom > 0 && r.top < b - 4 && r.bottom < b + 8; }
      return { f: window.__W.focus(), under }; });
    if (f.f === "body") this.focusBad.push(what);
    if (f.under) this.covered.push(what + " -> " + f.f);
  }
  /** Activates a control the way a visitor does: a tap on a phone, a click with the mouse. */
  async tap(sel) {
    const el = this.page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    if (this.phone) await el.tap(); else await el.click();
    await this.afterAct(sel);
  }
  async tapAt(x, y, what) { if (this.phone) await this.page.touchscreen.tap(x, y); else await this.page.mouse.click(x, y); await this.afterAct(what || "point " + Math.round(x) + "," + Math.round(y)); }
  async key(k, what) { await this.page.keyboard.press(k); await this.afterAct(what || "key " + k); }
  async openBox(id) { if (!(await this.ev((i) => document.getElementById(i).open, id))) await this.tap("#" + id + " > summary"); }
  async lens(id) { if ((await state(this.page, "lens")) !== id) await this.tap('[data-lens="' + id + '"]'); }
  async station(key) { await this.tap("#st-" + key); }
  focusReport(label) { this.check("focus after every activation is not the body" + (label ? " (" + label + ")" : "") + ": " + this.acts + " activations", [], this.focusBad);
    if (!this.phone) this.check("the focused control is never hidden under the sticky header" + (label ? " (" + label + ")" : ""), [], this.covered);
    this.acts = 0; this.focusBad = []; this.covered = []; }
  /** The assertions of 1.6 that hold on every station: text sizes, control sizes, no sideways scroll, the card's first line. */
  async sweep(label, { card = true } = {}) {
    const t = await this.ev(() => window.__W.text());
    this.check(label + ": visible text is 17 or 14 px (13 px only in the hash class)", 0, t.n, t.n === 0 ? true : (this.check(label + ": the offenders", [], t.bad), false));
    const c = await this.ev((m) => window.__W.controls(m), this.min);
    this.check(label + ": every enabled control is at least " + this.min + " x " + this.min + " px (" + c.measured + " measured, " + c.exempt + " term words in verses exempt)", [], c.bad);
    const o = await this.ev(() => window.__W.overflow());
    this.check(label + ": no horizontal overflow", "0 or less", o.over, o.over <= 0 || (console.log("       " + JSON.stringify(o.who)), false));
    if (card && this.phone) {
      const y0 = await this.ev(() => scrollY), k = await this.ev(() => window.__W.card());
      await this.ev((y) => scrollTo(0, y), y0);
      this.check(label + ": the first line of the explanation card ends above y = 844 (tabs row or title, and the title)", "under 844", k, k.title > 0 && k.title < 844 && k.firstChildLine > 0 && k.firstChildLine < 844);
    }
  }
  async contrast(label) { const c = await this.ev(() => window.__W.contrast()); this.check(label + ": text contrast at least 4.5 to 1, no faded text (" + c.measured + " measured)", [], c.bad); }
  async shot(name, what, { full = false } = {}) {
    await SHOTS.take(this.page, "lex-" + this.vp.name + "-" + name + ".png", { viewport: this.vp.name, shows: what }, { fullPage: full });
  }
  async close() { await this.ctx.close(); }
}

async function fresh(rec, browser, base, vp, options) { const w = new Walk(rec, vp, await L.open(browser, base, vp, options)); w.browser = browser; w.base = base; return w; }
/** Waits until the page has stopped scrolling (a smooth scroll may still run after an activation). */
async function still(w) { let y = null; for (let i = 0; i < 50; i++) { const now = await w.ev(() => Math.round(scrollY)); if (now === y) return; y = now; await sleep(130); } }
/** Where an element stands against the top of the window (below the header and banner where they stay): "at the top", or its place. */
const atTop = (w, id) => w.ev((i) => { const r = document.getElementById(i).getBoundingClientRect(), bar = document.getElementById("topWrap"), edge = getComputedStyle(bar).position === "sticky" ? bar.getBoundingClientRect().bottom : 0; return r.top >= edge - 1 && r.top <= edge + 60 ? "at the top" : "y " + Math.round(r.top) + " (the window begins at " + Math.round(edge) + ")"; }, id);
/** The focused element, and whether it lies inside the window (below the header where that stays): true, or its place. */
const focusPlace = (w) => w.ev(() => { const a = document.activeElement, bar = document.getElementById("topWrap"), edge = getComputedStyle(bar).position === "sticky" ? bar.getBoundingClientRect().bottom : 0;
  if (!a || a === document.body || a === document.documentElement) return { focus: "body", inWindow: false };
  const r = a.getBoundingClientRect(); return { focus: a.id || a.localName, inWindow: (r.height > 0 && r.top >= edge - 1 && r.bottom <= innerHeight + 1) || "y " + Math.round(r.top) + " to " + Math.round(r.bottom) + " (the window: " + Math.round(edge) + " to " + innerHeight + ")" }; });
/** In a window of another size, at Stargazer: "Switch to Navigator" is pressed with the keyboard at a station; the lens and where the focus is once the page has stopped
 *  (with `scroll`: the lens, the focused element and how far the page has scrolled). */
async function switchInWindow(w, viewport, hash, station, scroll) {
  const n = await fresh(w.rec, w.browser, w.base, w.vp, { viewport, hash });
  await n.station(station);
  await n.ev((id) => document.getElementById(id).focus(), viewport.width < 700 ? "levelsBtnBox" : "levelsBtn"); await sleep(300);
  await n.key("Enter", "Enter on Switch to Navigator"); await sleep(200); await still(n);
  const place = await focusPlace(n);
  const out = scroll ? { lens: await state(n.page, "lens"), focus: place.focus, scrollY: await n.ev(() => Math.round(scrollY)), console: n.messages }
    : { lens: await state(n.page, "lens"), ...place, console: n.messages };
  await n.close();
  return out;
}
/** A phone window lower than the first screen (844 px): at every station of the three lenses, as the page opens and again sealed and
 *  sent, what STRIX shows above the map, where the card's first line ends and, for a sky, where the sentences about the link stand. */
async function lowWindow(w, viewport, hash) {
  const low = await fresh(w.rec, w.browser, w.base, w.vp, { viewport, hash }), rows = [];
  const pass = async (when) => {
    for (const lens of ["stargazer", "navigator", "holographer"]) {
      await low.lens(lens);
      for (const st of await low.ev(() => Array.from(document.querySelectorAll("#strip button")).map((b) => b.id.slice(3)))) {
        await low.station(st); await sleep(200);
        rows.push(await low.ev((at) => { scrollTo(0, 0);
          const M = window.__M, x = window.LexiconExplorer.state, t = document.querySelector("#explain .explain-body:not([hidden]) h2"), r = t.getClientRects()[0] || t.getBoundingClientRect(), sn = document.getElementById("skyNotice");
          return { at, text: (document.getElementById("strixText") || {}).textContent || "", first: M.sentencesOf(M.stationView(x.station, x.lens, x.lexicon).say[0].text)[0], card: Math.round(r.top + Math.min(r.height, parseFloat(getComputedStyle(t).lineHeight) || 22)), bottom: innerHeight, notice: sn ? (window.__W.shown(sn) ? "banner" : "box") : null }; }, lens + ", " + st + ", " + when));
      }
    }
  };
  await pass("as it opens");
  await low.lens("navigator"); await low.station("seal"); await low.tap("#sealBtn"); await idle(low.page);
  await low.station("send"); await low.tap("#sendBtn"); await idle(low.page);
  await pass("sealed and sent");
  const messages = low.messages.slice();
  await low.close();
  return { rows, below: rows.filter((r) => r.card > r.bottom - 2), messages };
}
const SECTIONS = [];
const section = (id, title, fn) => SECTIONS.push({ id, title, fn });

// ─── S01 the first screen ────────────────────────────────────────────────────
section("S01", "first screen", async (w) => {
  const s = await w.ev(() => { const x = window.LexiconExplorer.state; return { station: x.station, verse: x.verse, selected: x.selected, focus: window.LexiconExplorer.tree.view.focus, lens: x.lens, dims: x.dims }; });
  w.check("initial state: station Read, verse 1 open, tree centred on 26.1, nothing selected, Stargazer, 2D", { station: "read", verse: "26.1.1", selected: null, focus: "26.1", lens: "stargazer", dims: "2D" }, s);
  w.check("page title and heading", ["Lexicon Explorer · Ezekiel 1:1-9 in hyperbolic space", "Lexicon Explorer"], await w.ev(() => [document.title, document.querySelector("h1").textContent]));
  w.check("the Entry says", "Tap a shining word", await w.ev(() => document.getElementById("entryTitle").textContent));
  const strix = await w.ev(() => ({ text: document.getElementById("strixText").textContent, label: window.__W.shown(document.querySelector("#strixLine .strix-name")), more: window.__W.shown(document.getElementById("strixMore")) }));
  w.check("STRIX's first line: both sentences whole on the first run, the name STRIX before them, no more button", { text: STRIX_FIRST, label: true, more: false }, strix);
  w.check("Stargazer station names", ["1 Read", "2 Count", "3 Kinds of sentence", "4 Stamp it"], await w.ev(() => Array.from(document.querySelectorAll("#strip button")).map((b) => b.textContent.trim())));
  w.check("lens buttons and their hints", ["Stargazer ages 6 and up", "Navigator names, dates and sources", "Holographer formats and hashes"],
    await w.ev(() => Array.from(document.querySelectorAll("button[data-lens]")).map((b) => Array.from(b.childNodes).map((n) => n.textContent.trim()).filter(Boolean).join(" "))));
  const lensColours = await w.ev(() => Array.from(document.querySelectorAll("button[data-lens]")).flatMap((b) => { const c = getComputedStyle(b); return [c.backgroundColor, c.color, c.borderTopColor]; }));
  w.check("no lens button is drawn in a layer colour", [], lensColours.filter((c) => LAYER_COLOURS.includes(c)));
  w.check("open verse: Ezekiel 1:1 in the author's wording, with its six term buttons", { title: "Ezekiel 1:1, NIV", terms: 6, textSame: true },
    await w.ev(() => { const M = window.__M, v = M.verseView("26.1.1", "supplied"); return { title: document.getElementById("verseTitle").textContent, terms: document.querySelectorAll("#verseBox [role=button][data-address]").length, textSame: document.getElementById("openVerse").textContent === v.text }; }));
  const legend = await w.ev(() => ({ text: document.getElementById("entryLegend").textContent, words: Array.from(document.querySelectorAll("#entryLegend .badge")).map((b) => b.textContent.replace(/[^A-Z ]/g, "").trim()) }));
  w.check("the legend in the Entry: four badges as shape plus word", ["WRITTEN", "SAID", "CHECKED", "OUR IDEA"], legend.words);
  w.check("the legend's four sentences and the badge help (Stargazer)", true, LEGEND.every((x) => legend.text.includes(x)) && legend.text.includes(BADGE_HELP));
  w.check("a badge is a shape hidden from screen readers plus a word; filled badges carry dark text", { shapeHidden: true, colour: "rgb(2, 6, 23)" },
    await w.ev(() => { const b = document.querySelector("#entryLegend .badge"); const sh = b.querySelector("[aria-hidden=true]"); return { shapeHidden: !!sh && sh.textContent.trim().length === 1, colour: getComputedStyle(b).color }; }));
  const canvas = await w.ev(() => { const c = document.getElementById("tree"), cap = document.getElementById(c.getAttribute("aria-describedby")); return { role: c.getAttribute("role"), label: c.getAttribute("aria-label"), capShown: !!cap && window.__W.shown(cap) && cap.textContent.length > 10, tabindex: c.getAttribute("tabindex"), tabIndex: c.tabIndex, touch: getComputedStyle(c).touchAction }; });
  w.check("the tree canvas: role img, a label, described by its visible caption, not focusable, touch-action pan-y pinch-zoom", { role: "img", label: true, capShown: true, focusable: false, touch: "pan-y pinch-zoom" },
    { role: canvas.role, label: !!canvas.label && canvas.label.length > 5, capShown: canvas.capShown, focusable: canvas.tabIndex >= 0, touch: canvas.touch });
  const cap = await w.ev(() => document.getElementById("treeCap").textContent);
  w.check("caption names the centred entry, its children and what is too near the rim", "Ezekiel > chapter 1. 13 things under it. N more are too near the edge to draw.", cap, /^Ezekiel > chapter 1\. 13 things under it\. \d+ more are too near the edge to draw\.$/.test(cap));
  w.check("one status line (role=status) outside every region with controls, and no other live region", { live: 1, id: "status", parent: "body", controls: 0 },
    await w.ev(() => { const l = document.querySelectorAll("[role=status], [role=alert], [role=log], [aria-live]"); return { live: l.length, id: l[0] && l[0].id, parent: l[0] && l[0].parentElement.localName, controls: l[0] ? l[0].querySelectorAll("button, input, a").length : -1 }; }));
  w.check("no user-select: none on anything that holds text", [], await w.ev(() => Array.from(document.querySelectorAll("body *")).filter((el) => el.textContent.trim() && getComputedStyle(el).userSelect === "none").map((el) => el.localName + "#" + el.id).slice(0, 5)));
  w.check("no element uses the CSS order property", [], await w.ev(() => Array.from(document.querySelectorAll("body *")).filter((el) => getComputedStyle(el).order !== "0").map((el) => el.localName + "#" + el.id).slice(0, 5)));
  w.check("no request went to another host except for the fonts", [], w.outside.filter((u) => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)));
  const head = await w.ev(() => { const hd = document.querySelector("header"), r = hd.getBoundingClientRect(); const mids = Array.from(hd.querySelectorAll("button, h1")).filter((e) => window.__W.shown(e)).map((e) => { const q = e.getBoundingClientRect(); return (q.top + q.bottom) / 2; }).sort((a, b) => a - b); let rows = mids.length ? 1 : 0; for (let i = 1; i < mids.length; i++) if (mids[i] - mids[i - 1] > 22) rows++; return { h: Math.round(r.height), position: getComputedStyle(document.getElementById("topWrap")).position === "sticky" ? "sticky" : getComputedStyle(hd).position, rows }; });
  if (w.phone) {
    w.check("header: at most two rows and 112 px, not sticky", "h <= 112, rows <= 2, not sticky", head, head.h <= 112 && head.rows <= 2 && head.position !== "sticky");
    const order = await w.ev(() => ["stripNav", "say", "stage", "explain", "bridge", "more", "under"].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { id, top: Math.round(r.top + scrollY), left: Math.round(r.left), w: Math.round(r.width) }; }));
    w.check("phone order: one column in DOM order (stations, STRIX and verse, canvas, Entry, bridge, the rest)", "tops increase, one column", order, order.every((o, i) => i === 0 || o.top > order[i - 1].top) && order.every((o) => o.left <= 16 && o.w >= 340));
    const first = await w.ev(() => { const b = (id) => Math.round(document.getElementById(id).getBoundingClientRect().bottom); const c = document.getElementById("tree").getBoundingClientRect(); return { verse: b("verseBox"), terms: Math.max(...Array.from(document.querySelectorAll("#verseBox [role=button]")).map((e) => Math.round(e.getBoundingClientRect().bottom))), canvasBottom: Math.round(c.bottom), side: Math.round(c.width * 10) / 10, vh27: Math.round(innerHeight * 0.27 * 10) / 10, dims: window.__W.shown(document.getElementById("dimsBtn")), dimsWide: window.__W.shown(document.getElementById("dims2d")) }; });
    w.check("first phone screen holds the open verse with its term buttons and the whole canvas", "all above y = 844", first, first.verse <= 844 && first.terms <= 844 && first.canvasBottom <= 844);
    w.check("the canvas is square with side 27vh; the 2D/3D button is on show (in the header, off the map)", { side: first.vh27, dims: true, dimsWide: false }, { side: first.side, dims: first.dims, dimsWide: first.dimsWide }, Math.abs(first.side - first.vh27) <= 1 && first.dims && !first.dimsWide);
    w.check("the legend begins on the first phone screen (its first badge and sentence start above y = 844; the rest is one scroll below)", "under 844", await w.ev(() => Math.round(document.querySelector("#entryLegend .badge").getBoundingClientRect().bottom)), (await w.ev(() => document.querySelector("#entryLegend .badge").getBoundingClientRect().bottom)) < 844);
    w.check("the lists below are closed boxes on a phone (reader, list, station)", [false, false, false], await w.ev(() => ["readerBox", "listBox", "stationBox"].map((id) => document.getElementById(id).open)));
  } else {
    w.check("header at 1440 x 900: sticky, with title, question button, lens switch and 2D/3D", { position: "sticky", about: "What is real here?", dims: ["Flat map", "Ball"] },
      { position: head.position, about: await w.ev(() => document.getElementById("aboutBtn").textContent.replace("?", "?").trim().replace(/\?\?$/, "?")), dims: await w.ev(() => [document.getElementById("dims2d").textContent, document.getElementById("dims3d").textContent]) });
    const cols = await w.ev(() => ["say", "stage", "explain"].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().left)));
    w.check("three columns: STRIX and reader, the canvas, the Entry", "three increasing lefts", cols, cols[0] < cols[1] && cols[1] < cols[2]);
    w.check("the reader, the list and the station box are open on a wide window", [true, true], await w.ev(() => ["readerBox", "listBox"].map((id) => document.getElementById(id).open)));
  }
  await w.sweep("first screen");
  await w.contrast("first screen");
  await w.shot("01-first-screen", "The first screen at Stargazer: station Read, verse 1 open, the tree centred on Ezekiel 1 (26.1), the Entry saying Tap a shining word.");
});

// ─── S02 the first minute, by pointer ────────────────────────────────────────
section("S02", "first minute by " + "pointer", async (w) => {
  await w.ev(() => { const t = window.LexiconExplorer.tree; window.__ft = null; let t0 = null; const iv = setInterval(() => { if (t.flying && t0 === null) t0 = performance.now(); if (!t.flying && t0 !== null) { window.__ft = performance.now() - t0; clearInterval(iv); } }, 4); });
  await w.tap('#verseBox [data-address="26.1.1.4"]');
  await settle(w.page);
  w.check("(2) a tap on the river phrase of verse 1 selects 26.1.1.4", "26.1.1.4", await state(w.page, "selected"));
  const e = await w.ev(() => { const M = window.__M, v = M.entryView(M.EZEKIEL, "26.1.1.4", "stargazer", { wording: "supplied" }); const rows = Array.from(document.querySelectorAll("#tabEntry > p.entry-row")).filter((p) => p.querySelector(".badge")); return { title: document.getElementById("entryTitle").textContent, rows: rows.map((p) => ({ badges: p.querySelectorAll(".badge").length, words: p.textContent.split(/\s+/).length })), first: v.first.length, modelTexts: v.first.every((r) => document.getElementById("tabEntry").textContent.includes(r.text)) }; });
  w.check("(3) the Entry shows two or three short sentences, one per badge", "2 or 3 rows with one badge each, the model's plain rows", e, e.rows.length >= 2 && e.rows.length <= 3 && e.rows.every((r) => r.badges === 1) && e.rows.length === e.first && e.modelTexts);
  w.check("the Entry's title is the phrase as shown in the verse", "the Kebar River", e.title);
  const t = await w.ev(() => ({ focus: window.LexiconExplorer.tree.view.focus, cap: document.getElementById("treeCap").textContent, hash: location.hash, ft: window.__ft, mark: window.__W.markAt("26.1.1.4") }));
  w.check("(4) the tree slid to that word", "26.1.1.4 at the centre of the canvas", { focus: t.focus, off: t.mark && [Math.round(t.mark.cx), Math.round(t.mark.cy)] }, t.focus === "26.1.1.4" && t.mark && Math.abs(t.mark.cx) < 2 && Math.abs(t.mark.cy) < 2);
  w.check("(4) the caption reads", "Ezekiel > chapter 1 > verse 1 > the river of Chebar", t.cap, t.cap.startsWith("Ezekiel > chapter 1 > verse 1 > the river of Chebar"));
  w.check("the flight lasted at most 600 ms", "600 ms or less", Math.round(t.ft), t.ft !== null && t.ft <= 640);
  w.check("the link names the entry", "#entry=26.1.1.4 (and the lens)", t.hash, /^#entry=26\.1\.1\.4(&lens=stargazer)?$/.test(t.hash));
  w.check("the Entry of a supplied phrase carries the notice of the supplied wording at its foot", true, await w.ev(() => { const f = document.getElementById("entryFoot"); return !!f && f.textContent === window.__M.SUPPLIED.notice && getComputedStyle(f).fontSize === "14px"; }));
  await sleep(500);
  const status = await w.ev(() => document.getElementById("status").textContent);
  w.check("the status line received one sentence after input stopped", "a sentence", status, status.length > 10 && /[.!?]$/.test(status));
  await w.sweep("the river phrase selected");
  await w.shot("02-first-minute-chebar", "First minute, step 4: the river phrase of verse 1 selected, the tree slid to it, the Entry with one sentence per badge.");
  await w.tap("#nextBtn");
  const c = await w.ev(() => ({ station: window.LexiconExplorer.state.station, marks: Array.from(document.querySelectorAll("#reader mark")).map((m) => m.textContent), box: document.querySelectorAll("#verseBox mark").length, verse: document.getElementById("verseTitle").textContent, readerOpen: document.getElementById("readerBox").open }));
  w.check("(5) Next: count the fours opens Count with four lit five times in the passage", { station: "count", marks: ["four", "four", "four", "four", "four"], readerOpen: true }, { station: c.station, marks: c.marks, readerOpen: c.readerOpen });
  w.check("the open verse is the first verse with a four, in King James, with the word lit", { verse: "Ezekiel 1:5, King James", lit: true }, { verse: c.verse, lit: c.box >= 1 });
  await w.sweep("Count after the first minute");
  await w.shot("03-first-minute-count", "First minute, step 5: Count opened by the Next button, four lit five times.");
  w.focusReport("first minute");
});

// ─── S03 the first minute, by keyboard alone ─────────────────────────────────
section("S03", "first minute by keyboard alone", async (w) => {
  let found = false, n = 0;
  for (; n < 60 && !found; n++) { await w.page.keyboard.press("Tab"); found = await w.ev(() => document.activeElement.getAttribute("data-address") === "26.1.1.4" && !!document.activeElement.closest("#verseBox")); }
  w.check("Tab reaches the river phrase in the open verse", true, found);
  const ring = await w.ev(() => { const c = getComputedStyle(document.activeElement); return { outline: c.outlineStyle + " " + c.outlineWidth, shadow: c.boxShadow !== "none" }; });
  w.check("the focused word shows a focus ring", "an outline or a ring", ring, (ring.outline.indexOf("none") < 0 && parseFloat(ring.outline.split(" ")[1]) >= 1) || ring.shadow);
  await w.key("Enter");
  await settle(w.page);
  w.check("Enter selects it and the focus stays on the word", { selected: "26.1.1.4", focus: "26.1.1.4" }, await w.ev(() => ({ selected: window.LexiconExplorer.state.selected, focus: document.activeElement.getAttribute("data-address") })));
  const t = await w.ev(() => ({ focus: window.LexiconExplorer.tree.view.focus, cap: document.getElementById("treeCap").textContent, rows: document.querySelectorAll("#tabEntry > p.entry-row .badge").length }));
  w.check("the tree slid there, the caption reads the path, the Entry has its sentences", { focus: "26.1.1.4", cap: true, rows: true }, { focus: t.focus, cap: t.cap.startsWith("Ezekiel > chapter 1 > verse 1 > the river of Chebar"), rows: t.rows >= 2 && t.rows <= 3 });
  found = false;
  for (n = 0; n < 80 && !found; n++) { await w.page.keyboard.press("Tab"); found = await w.ev(() => document.activeElement.id === "nextBtn"); }
  w.check("Tab reaches Next: count the fours", true, found);
  await w.key("Enter");
  await sleep(150);
  w.check("Enter opens Count with four lit five times; the focus is on the Count station", { station: "count", marks: 5, focus: "st-count" }, await w.ev(() => ({ station: window.LexiconExplorer.state.station, marks: document.querySelectorAll("#reader mark").length, focus: document.activeElement.id })));
  w.focusReport("keyboard");
});

// ─── S04 the reader in both wordings ─────────────────────────────────────────
section("S04", "reader, both wordings", async (w) => {
  await w.openBox("readerBox");
  const r0 = await w.ev(() => { const M = window.__M, r = M.readerView("supplied"), ps = Array.from(document.querySelectorAll("#reader p.reader-verse")); return {
    pressed: Array.from(document.querySelectorAll('#reader [data-key^="wording-"]')).map((b) => b.textContent + ":" + b.getAttribute("aria-pressed")), n: ps.length,
    same: ps.every((p, i) => p.textContent === String(r.verses[i].number) + r.verses[i].text), terms: document.querySelectorAll('#reader [data-key^="rterm-"]').length, nums: document.querySelectorAll('#reader [data-key^="rverse-"]').length,
    head: document.getElementById("readerHead").textContent, headModel: M.readerHead().first + " " + M.readerHead().last, bracket: document.getElementById("reader").textContent.includes("[a]"),
    notice: document.getElementById("reader").textContent.split(M.SUPPLIED.notice).length - 1, note: document.getElementById("reader").textContent.split(M.SUPPLIED.note).length - 1,
    noteSize: Array.from(document.querySelectorAll("#reader p.note")).map((p) => getComputedStyle(p).fontSize), headAbove: document.getElementById("readerHead").getBoundingClientRect().top < ps[0].getBoundingClientRect().top }; });
  w.check("Stargazer default: the author's passage (NIV) is pressed", ["The author's passage (NIV):true", "King James:false"], r0.pressed);
  w.check("nine verses, letter for letter the supplied module's text, 29 term buttons and 9 verse buttons", { n: 9, same: true, terms: 29, nums: 9 }, { n: r0.n, same: r0.same, terms: r0.terms, nums: r0.nums });
  w.check("above the verses: the first and last sentences of row 0.3, with a badge", true, r0.head.includes(r0.headModel) && r0.head.endsWith("What Jewish tradition says about this chapter") && r0.headAbove, r0.head.includes(r0.headModel) && r0.headAbove);
  w.check("the footnote mark [a] is not displayed; the notice and the note stand once at the foot, at 14 px", { bracket: false, notice: 1, note: 1, sizes: true }, { bracket: r0.bracket, notice: r0.notice, note: r0.note, sizes: r0.noteSize.every((s) => s === "14px") });
  await w.shot("04-reader-supplied", "The reader in the author's supplied wording (NIV), with the notice and the note at its foot.");
  await w.tap('#reader [data-key="wording-kjv"]');
  const r1 = await w.ev(() => { const M = window.__M, r = M.readerView("kjv"), ps = Array.from(document.querySelectorAll("#reader p.reader-verse")), txt = document.getElementById("reader").textContent; return {
    pressed: document.querySelector('#reader [data-key="wording-kjv"]').getAttribute("aria-pressed"), same: ps.length === 9 && ps.every((p, i) => p.textContent === String(r.verses[i].number) + r.verses[i].text), terms: document.querySelectorAll('#reader [data-key^="rterm-"]').length,
    notice: txt.includes(M.SUPPLIED.notice), names: txt.includes("King James Version"), verse: document.getElementById("verseTitle") ? document.getElementById("verseTitle").textContent : null, wording: window.LexiconExplorer.state.wording }; });
  w.check("King James chosen: nine verses letter for letter, 29 terms, the translation named, no NIV notice", { pressed: "true", same: true, terms: 29, notice: false, names: true }, { pressed: r1.pressed, same: r1.same, terms: r1.terms, notice: r1.notice, names: r1.names });
  w.check("the open verse follows the wording", "Ezekiel 1:1, King James", r1.verse);
  await w.shot("05-reader-kjv", "The reader in the King James wording.");
  await w.lens("navigator"); await w.lens("stargazer");
  w.check("the choice holds across a change of lens", "true", await w.ev(() => document.querySelector('#reader [data-key="wording-kjv"]').getAttribute("aria-pressed")));
  await w.openBox("readerBox");
  await w.tap('#reader [data-key="wording-supplied"]');
  await w.lens("navigator");
  w.check("the author's passage, once chosen, holds at Navigator", "true", await w.ev(() => document.querySelector('#reader [data-key="wording-supplied"]').getAttribute("aria-pressed")));
  await w.tap('#reader [data-key="rterm-26.1.5.1"]');
  await settle(w.page);
  w.check("a term button in the reader selects its entry (supplied phrase: four living creatures)", { selected: "26.1.5.1", title: "four living creatures", pressed: "true" },
    await w.ev(() => ({ selected: window.LexiconExplorer.state.selected, title: document.getElementById("entryTitle").textContent, pressed: document.querySelector('#reader [data-key="rterm-26.1.5.1"]').getAttribute("aria-pressed") })));
  await w.ev(() => document.querySelector('#reader [data-key="rterm-26.1.6.1"]').focus());
  await w.key(" ", "Space on a term"); await settle(w.page);
  w.check("a term that has the focus answers the Space key as well as Enter", "26.1.6.1", await state(w.page, "selected"));
  await w.tap('#reader [data-key="rverse-26.1.1"]');
  await settle(w.page);
  const both = await w.ev(() => { const M = window.__M, q = Array.from(document.querySelectorAll("#tabEntry blockquote.words")); return { selected: window.LexiconExplorer.state.selected, n: q.length, kjv: q.some((b) => b.textContent.includes(M.verseView("26.1.1", "kjv").text)), niv: q.some((b) => b.textContent.includes(M.verseView("26.1.1", "supplied").text)),
    named: q.every((b) => /King James Version|New International Version/.test(b.textContent)), foot: !!document.getElementById("entryFoot") && document.getElementById("entryFoot").textContent === M.SUPPLIED.notice, meta: document.getElementById("entryMeta") ? document.getElementById("entryMeta").textContent : null, crumbs: document.querySelectorAll("#tabEntry .crumbs button").length }; });
  w.check("a verse number selects the verse; at Navigator its Entry shows both wordings, each named, the supplied one over its notice", { selected: "26.1.1", n: 2, kjv: true, niv: true, named: true, foot: true }, { selected: both.selected, n: both.n, kjv: both.kjv, niv: both.niv, named: both.named, foot: both.foot });
  w.check("Navigator Entry: address, kind and the path as breadcrumbs", { meta: "26.1.1 · verse", crumbs: 2 }, { meta: both.meta, crumbs: both.crumbs });
  await w.sweep("verse 1 at Navigator, both wordings");
  await w.shot("06-entry-verse-both-wordings", "Navigator: the Entry of Ezekiel 1:1 with both wordings, address, kind and breadcrumbs.");
  if (!w.phone) {
    await w.station("read");
    await w.tap('[data-key="verse-next"]');
    w.check("the open verse steps to the next verse", "Ezekiel 1:2", await w.ev(() => document.getElementById("verseTitle").textContent.split(",")[0]));
    await w.tap('[data-key="verse-prev"]');
    w.check("and back", "Ezekiel 1:1", await w.ev(() => document.getElementById("verseTitle").textContent.split(",")[0]));
  }
  w.focusReport("reader");
  const nav = await fresh(w.rec, w.browser, w.base, w.vp, { hash: "#lens=navigator" });
  w.check("opened at Navigator by link: King James is the default wording", { lens: "navigator", verse: "Ezekiel 1:1, King James", pressed: "true" },
    await nav.ev(() => ({ lens: window.LexiconExplorer.state.lens, verse: document.getElementById("verseTitle").textContent, pressed: document.querySelector('#reader [data-key="wording-kjv"]').getAttribute("aria-pressed") })));
  await nav.close();
});

// ─── S05 counting ────────────────────────────────────────────────────────────
section("S05", "counting", async (w) => {
  await w.station("count");
  const table = await w.ev(() => window.__M.countTable().map((r) => ({ word: r.word, times: r.times, verses: r.verses, numbers: r.numbers.map((n) => n.words).join("; ") })));
  w.check("the number words, counted from the committed verses", [["thirtieth", 1], ["fourth", 1], ["fifth", 3], ["four", 5]], table.map((r) => [r.word, r.times]));
  w.check("Count opens with four lit", { pressed: "true", marks: 5 }, await w.ev(() => ({ pressed: document.querySelector('[data-key="count-four"]').getAttribute("aria-pressed"), marks: document.querySelectorAll("#reader mark").length })));
  for (const r of table) {
    if ((await w.ev((k) => document.querySelector('[data-key="count-' + k + '"]').getAttribute("aria-pressed"), r.word)) !== "true") await w.tap('[data-key="count-' + r.word + '"]');
    const got = await w.ev(() => ({ marks: Array.from(document.querySelectorAll("#reader mark")).map((m) => m.textContent.toLowerCase()), verses: Array.from(new Set(Array.from(document.querySelectorAll("#reader mark")).map((m) => Number(m.closest("p").querySelector(".vnum").textContent)))), line: document.querySelector("#say .count-line") ? document.querySelector("#say .count-line").textContent : null, open: document.getElementById("verseTitle").textContent, lit: document.querySelectorAll("#verseBox mark").length, kjv: document.getElementById("reader").textContent.includes("King James Version") }));
    w.check("the word " + r.word + " is lit " + r.times + " time(s), in verse(s) " + r.verses.join(", ") + ", in King James; the open verse is the first with it", { marks: Array(r.times).fill(r.word), verses: r.verses, open: "Ezekiel 1:" + r.verses[0] + ", King James", lit: true, kjv: true }, { marks: got.marks, verses: got.verses, open: got.open, lit: got.lit >= 1, kjv: got.kjv });
  }
  await w.shot("07-count-four", "Station Count with the word four lit five times in the nine verses.");
  await w.tap('[data-key="count-four"]');
  w.check("pressing the lit word again puts the words back", { marks: 0, pressed: "false" }, await w.ev(() => ({ marks: document.querySelectorAll("#reader mark").length, pressed: document.querySelector('[data-key="count-four"]').getAttribute("aria-pressed") })));
  await w.openBox("stationBox");
  const rows = await w.ev(() => Array.from(document.querySelectorAll("#stationBody table tbody tr")).map((tr) => Array.from(tr.cells).map((c) => c.textContent)));
  w.check("the count table: word, times, verses, what it numbers", table.map((r) => [r.word, String(r.times), r.verses.join(", "), r.numbers]), rows);
  await w.sweep("Count, the table open", { card: false });
  // Count with me, on a count row of an entry
  await w.lens("navigator");
  await w.ev(() => window.LexiconExplorer.select("26.1.5.1"));
  await settle(w.page);
  const cw = await w.ev(() => { const M = window.__M, b = document.querySelector('#tabEntry [data-key^="cwm-"]'); const a = b ? b.getAttribute("data-key").slice(4) : null; return { key: a, model: a ? M.countWithMe(M.EZEKIEL, a) : null }; });
  w.check("the entry four living creatures has a count row with a Count with me button", true, !!cw.key, !!cw.key);
  if (cw.key) {
    await w.station("read");
    await w.tap('#tabEntry [data-key="cwm-' + cw.key + '"]');
    const lit = await w.ev(() => ({ marks: document.querySelectorAll("#reader mark").length, done: !!document.querySelector('[data-key="count-done"]'), readerOpen: document.getElementById("readerBox").open }));
    w.check("Count with me lights the counted words in the reader (" + cw.model.words.join(", ") + ")", { marks: cw.model.inReader, done: true, readerOpen: true }, lit);
    await w.tap('[data-key="count-done"]');
    w.check("Show the words again clears the count", 0, await w.ev(() => document.querySelectorAll("#reader mark").length));
  }
  w.focusReport("count");
});

// ─── S06 the tree: tap, list, keys, buttons ──────────────────────────────────
async function centre(w, address) { await w.ev((a) => { window.LexiconExplorer.select(a); }, address); await settle(w.page); await w.ev(() => scrollTo(0, 0)); await sleep(60); }
async function labelCheck(w, address, name, strict) {
  await centre(w, address);
  const l = await w.ev(() => window.__W.labels());
  if (strict) w.check("with " + name + " centred: every canvas label is 13 px or more and no two label boxes overlap (" + l.n + " labels)", { min: "13 or more", pairs: [] }, { min: l.min, pairs: l.pairs }, l.n > 0 && l.min >= 13 && l.pairs.length === 0);
  else w.check("with " + name + " centred: every canvas label is 13 px or more and no two label texts overlap (" + l.n + " labels; plates that touch by a corner: " + l.pairs.length + ")", { min: "13 or more", textPairs: [] }, { min: l.min, textPairs: l.textPairs }, l.n > 0 && l.min >= 13 && l.textPairs.length === 0);
  return l;
}
section("S06", "tree: tap, list, keys, buttons", async (w) => {
  const home = await labelCheck(w, "26.1", "26.1 (Ezekiel 1)", true);
  w.check("with 26.1 centred the nine verse labels are drawn", ["1:1", "1:2", "1:3", "1:4", "1:5", "1:6", "1:7", "1:8", "1:9"], ["1:1", "1:2", "1:3", "1:4", "1:5", "1:6", "1:7", "1:8", "1:9"].filter((t) => home.texts.includes(t)));
  const sizes = await w.ev(() => window.LexiconExplorer.tree.labels().filter((l) => /^1:[1-9]$/.test(l.text)).map((l) => l.size));
  w.check("the nine verse labels are at least 13 px", 9, sizes.filter((s) => s >= 13).length);
  const marks = await w.ev(() => window.LexiconExplorer.tree.marks().filter((m) => m.relation !== "far").map((m) => m.r));
  w.check("shaped markers have a radius of at least 4 px", "4 or more", Math.min(...marks), Math.min(...marks) >= 4);
  await w.shot("10-tree-26.1", "The tree centred on 26.1 (Ezekiel 1) with its verse labels.");
  const picked = [];
  for (let v = 1; v <= 9; v++) {
    await w.tap("#navHome"); await settle(w.page, 80); await w.ev(() => scrollTo(0, 0));
    const p = await w.ev((a) => window.__W.markAt(a), "26.1." + v);
    await w.tapAt(p.x, p.y, "verse cell " + v);
    await settle(w.page, 80);
    const got = await w.ev((a) => { const m = window.__W.markAt(a); return { selected: window.LexiconExplorer.state.selected, focus: window.LexiconExplorer.tree.view.focus, centred: !!m && Math.abs(m.cx) < 2 && Math.abs(m.cy) < 2 }; }, "26.1." + v);
    picked.push(got.selected === "26.1." + v && got.focus === "26.1." + v && got.centred ? "26.1." + v : JSON.stringify(got));
  }
  w.check("a tap at the middle of each of the nine verse cells selects that verse and brings it to the centre", ["26.1.1", "26.1.2", "26.1.3", "26.1.4", "26.1.5", "26.1.6", "26.1.7", "26.1.8", "26.1.9"], picked);
  await w.tap("#navHome"); await settle(w.page, 80);
  await w.ev(() => { scrollTo(0, 0); document.activeElement.blur(); });
  const pv = await w.ev(() => window.__W.markAt("26.1.5"));
  await w.tapAt(pv.x, pv.y, "verse cell 5 again"); await settle(w.page, 80);
  w.check("after a tap on the canvas with the focus nowhere, the focus goes to the Entry's title", "h2#entryTitle", await w.ev(() => window.__W.focus()));
  // navigation buttons
  await w.tap("#navHome"); await settle(w.page);
  w.check("Home selects and centres the lexicon's home entry", ["26.1", "26.1"], await w.ev(() => [window.LexiconExplorer.state.selected, window.LexiconExplorer.tree.view.focus]));
  await w.tap("#navUp"); await settle(w.page);
  w.check("Up goes to the parent", "26", await state(w.page, "selected"));
  await centre(w, "26.1.2");
  await w.tap("#navNext"); await settle(w.page);
  w.check("Next goes to the next sibling", "26.1.3", await state(w.page, "selected"));
  await w.tap("#navPrev"); await settle(w.page);
  w.check("Previous goes to the previous sibling", "26.1.2", await state(w.page, "selected"));
  // nudge
  await w.tap("#navHome"); await settle(w.page);
  const v0 = await w.ev(() => JSON.stringify(window.LexiconExplorer.tree.view.local));
  const moved = [];
  for (const id of ["nudgeLeft", "nudgeRight", "nudgeUp", "nudgeDown"]) {
    const a = await w.ev(() => JSON.stringify(window.LexiconExplorer.tree.view));
    await w.tap("#" + id); await settle(w.page, 60);
    moved.push((await w.ev(() => JSON.stringify(window.LexiconExplorer.tree.view))) !== a);
  }
  w.check("the four nudge buttons move the view without dragging; each has a name", { moved: [true, true, true, true], names: ["Slide the map left", "Slide the map right", "Slide the map up", "Slide the map down"] },
    { moved, names: await w.ev(() => ["nudgeLeft", "nudgeRight", "nudgeUp", "nudgeDown"].map((id) => document.getElementById(id).getAttribute("aria-label"))) });
  w.check("a nudge selects nothing new", "26.1", await state(w.page, "selected"));
  void v0;
  // the list
  await w.tap("#navHome"); await settle(w.page);
  await w.openBox("listBox");
  const list = await w.ev(() => { const ul = document.getElementById("list"), items = Array.from(ul.querySelectorAll("[role=treeitem]")); return { role: ul.getAttribute("role"), n: items.length, levels: items.every((b) => /^\d+$/.test(b.getAttribute("aria-level"))), buttons: items.every((b) => b.localName === "button"), current: (ul.querySelector('[aria-current="location"]') || {}).id, names: items.slice(0, 4).map((b) => b.textContent.trim().slice(0, 14)) }; });
  w.check("the neighbourhood list is a tree of buttons: role=tree, treeitems with aria-level, the centred entry marked", { role: "tree", levels: true, buttons: true, current: "e-26.1" }, { role: list.role, levels: list.levels, buttons: list.buttons, current: list.current });
  await w.tap("#e-26\\.1\\.3"); await settle(w.page);
  w.check("a list button selects and centres its entry and keeps the focus", { selected: "26.1.3", focus: "26.1.3", active: "e-26.1.3", aria: "true" }, await w.ev(() => ({ selected: window.LexiconExplorer.state.selected, focus: window.LexiconExplorer.tree.view.focus, active: document.activeElement.id, aria: document.getElementById("e-26.1.3").getAttribute("aria-selected") })));
  // keys
  await w.tap("#navHome"); await settle(w.page);
  await w.ev(() => document.getElementById("e-26.1").focus());
  const keys = [];
  for (const k of ["ArrowRight", "ArrowDown", "ArrowDown", "ArrowUp"]) { await w.key(k); await settle(w.page, 60); keys.push(await w.ev(() => document.activeElement.id + "@" + window.LexiconExplorer.tree.view.focus)); }
  w.check("in the list: Right goes to the first child, Down and Up to the next and previous sibling, and the map follows", ["e-26.1.1@26.1.1", "e-26.1.2@26.1.2", "e-26.1.3@26.1.3", "e-26.1.2@26.1.2"], keys);
  w.check("the arrow keys move the centre without selecting", "26.1", await state(w.page, "selected"));
  await w.key("Enter"); await settle(w.page);
  w.check("Enter selects the focused entry", "26.1.2", await state(w.page, "selected"));
  await w.key("ArrowLeft"); await settle(w.page, 60);
  const left = await w.ev(() => document.activeElement.id);
  await w.ev(() => { window.LexiconExplorer.select("100.3"); }); await settle(w.page);
  await w.ev(() => document.getElementById("e-100.3").focus());
  await w.key("Home"); await settle(w.page, 60);
  w.check("Left goes to the parent; Home goes to the lexicon's home entry", ["e-26.1", "e-26.1"], [left, await w.ev(() => document.activeElement.id)]);
  await w.ev(() => document.getElementById("st-read").focus());
  const before = await w.ev(() => JSON.stringify(window.LexiconExplorer.tree.view));
  await w.page.keyboard.press("ArrowRight"); await w.page.keyboard.press("ArrowDown"); await sleep(150);
  w.check("the arrow keys do nothing to the map while the focus is outside the list", before, await w.ev(() => JSON.stringify(window.LexiconExplorer.tree.view)));
  // other centres
  await labelCheck(w, "100", "100 (the author's notes)");
  await w.shot("11-tree-100", "The tree centred on 100, the author's notes.");
  const root = await labelCheck(w, "26", "26 (Ezekiel)");
  void root;
  await w.ev(() => { window.LexiconExplorer.select(""); }); await settle(w.page);
  const rootScene = await w.ev(() => { const s = window.LexiconExplorer.tree.scene, l = window.__W.labels(); return { focus: s.focus, count: s.count, crowded: s.crowded, labels: l.n, min: l.min, pairs: l.pairs, textPairs: l.textPairs, cap: document.getElementById("treeCap").textContent }; });
  w.check("with the root centred (14 top-level entries): labels 13 px or more, no label text on another, the caption gives the count", "14 children in the caption, no text overlap", { labels: rootScene.labels, min: rootScene.min, textPairs: rootScene.textPairs, cap: rootScene.cap }, rootScene.textPairs.length === 0 && rootScene.min >= 13 && /14/.test(rootScene.cap));
  await w.shot("12-tree-root", "The tree centred on the root with the fourteen top-level entries.");
  const crowd = await w.ev(() => { const M = window.__M, lx = M.EZEKIEL; let best = null; for (const a of [""].concat(lx.addresses)) { const n = M.childrenOf(lx, a).length; if (!best || n > best.n) best = { a, n }; } return best; });
  w.check("the entry with the most children has more than 16 (line 6 of the author, 17 facets)", { a: "100.6", n: 17 }, crowd);
  await w.lens("navigator");
  await centre(w, crowd.a);
  const cr = await w.ev((a) => { const s = window.LexiconExplorer.tree.scene, ls = window.LexiconExplorer.tree.labels(); return { crowded: s.crowded, count: s.count, childLabels: ls.filter((l) => l.address.startsWith(a + ".")).length, cap: document.getElementById("treeCap").textContent, listOpen: document.getElementById("listBox").open, items: Array.from(document.querySelectorAll("#list [role=treeitem]")).filter((b) => b.getAttribute("data-address").startsWith(a + ".")).length }; }, crowd.a);
  w.check("with more than 16 children the canvas shows cells without labels and a count; the caption says the list is the way in, and the list has them all", { crowded: true, count: 17, childLabels: 0, cap: true, items: 17 }, { crowded: cr.crowded, count: cr.count, childLabels: cr.childLabels, cap: /17 entries under it, too many to label: use the list\./.test(cr.cap), items: cr.items });
  await w.shot("12b-tree-crowded", "The tree centred on the author's line 6 (17 facets): cells without labels and a count.");
  await w.lens("stargazer");
  for (const a of ["26.1.1", "43.3.16", "0"]) await labelCheck(w, a, a);
  // 3D
  await centre(w, "26.1");
  await w.tap(w.phone ? "#dimsBtn" : "#dims3d"); await sleep(250);
  const d3 = await w.ev(() => ({ dims: window.LexiconExplorer.state.dims, turns: ["turnUp", "turnLeft", "turnRight", "turnDown"].map((id) => window.__W.shown(document.getElementById(id))), names: ["turnUp", "turnLeft", "turnRight", "turnDown"].map((id) => document.getElementById(id).getAttribute("aria-label")), pressed: (document.getElementById("dims3d").getAttribute("aria-pressed")), l: window.__W.labels() }));
  w.check("3D: the ball is shown and four turn buttons appear, each named", { dims: "3D", turns: [true, true, true, true], names: ["Turn the ball up", "Turn the ball left", "Turn the ball right", "Turn the ball down"] }, { dims: d3.dims, turns: d3.turns, names: d3.names });
  w.check("3D: labels are 13 px or more", "13 or more", d3.l.min, d3.l.min >= 13);
  const turned = [];
  for (const id of ["turnLeft", "turnUp", "turnRight", "turnDown"]) { const o = await w.ev(() => JSON.stringify(window.LexiconExplorer.tree.orbit)); await w.tap("#" + id); await sleep(80); turned.push((await w.ev(() => JSON.stringify(window.LexiconExplorer.tree.orbit))) !== o); }
  w.check("3D: each turn button turns the ball", [true, true, true, true], turned);
  await w.sweep("3D");
  await w.shot("13-tree-3d", "The tree as a ball (3D) centred on 26.1, with the four turn buttons.");
  await w.ev(() => scrollTo(0, 0));
  const p3 = await w.ev(() => window.__W.markAt("26.1.5"));
  await w.tapAt(p3.x, p3.y, "3D dot of verse 5"); await settle(w.page);
  w.check("3D: a tap on a dot selects it and brings it to the centre", ["26.1.5", "26.1.5"], await w.ev(() => [window.LexiconExplorer.state.selected, window.LexiconExplorer.tree.view.focus]));
  await w.tap(w.phone ? "#dimsBtn" : "#dims2d"); await sleep(200);
  w.check("back to the flat map", "2D", await state(w.page, "dims"));
  w.focusReport("tree");
});

// ─── S07 touch and pointer ───────────────────────────────────────────────────
section("S07", "touch and pointer on the canvas", async (w) => {
  await centre(w, "26.1");
  const box = await w.ev(() => window.__W.treeBox()), cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const snap = () => w.ev(() => ({ view: JSON.stringify(window.LexiconExplorer.tree.view), selected: window.LexiconExplorer.state.selected, y: Math.round(scrollY) }));
  if (w.phone) {
    const a = await snap();
    await swipe(w.cdp, { x: cx, y: cy }, { x: cx, y: cy - 250 });
    const b = await snap();
    w.check("a 250 px vertical swipe starting at the canvas centre scrolls the page by at least 200 px and leaves the view unchanged", { scrolled: "200 or more", view: "unchanged", selected: a.selected }, { scrolled: b.y - a.y, view: b.view === a.view ? "unchanged" : "changed", selected: b.selected }, b.y - a.y >= 200 && b.view === a.view && b.selected === a.selected);
    await w.ev(() => scrollTo(0, 0)); await sleep(100);
    await w.tap("#dragBtn");
    const on = await w.ev(() => ({ pressed: document.getElementById("dragBtn").getAttribute("aria-pressed"), touch: getComputedStyle(document.getElementById("tree")).touchAction, cap: window.__W.shown(document.getElementById("dragNote")) ? document.getElementById("dragNote").textContent : "" }));
    w.check("Drag the map switched on: pressed, touch-action none, the caption says so", { pressed: "true", touch: "none", cap: "Dragging is on. Scroll the page from outside the map." }, on);
    const c0 = await snap();
    await swipe(w.cdp, { x: cx - 20, y: cy + 10 }, { x: cx + 40, y: cy - 50 });
    const c1 = await snap();
    w.check("with the switch on, one finger drags the view and the page stays", { scrolled: 0, view: "changed" }, { scrolled: c1.y - c0.y, view: c1.view === c0.view ? "unchanged" : "changed" });
    await w.shot("14-drag-on", "Drag the map switched on, after a one-finger drag of the view.");
    await w.tap("#dragBtn");
    const off = await w.ev(() => ({ pressed: document.getElementById("dragBtn").getAttribute("aria-pressed"), touch: getComputedStyle(document.getElementById("tree")).touchAction, cap: window.__W.shown(document.getElementById("dragNote")) ? document.getElementById("dragNote").textContent : "" }));
    w.check("switched off again: touch-action pan-y pinch-zoom, no caption", { pressed: "false", touch: "pan-y pinch-zoom", cap: "" }, off);
    await centre(w, "26.1");
    const d0 = await snap();
    await swipe(w.cdp, { x: cx, y: cy }, { x: cx + 3, y: cy + 3 }, { steps: 2, cancel: true });
    const d1 = await snap();
    w.check("a cancelled touch (pointercancel) picks nothing and moves nothing", d0, d1);
    const m = await w.ev(() => window.__W.markAt("26.1.4"));
    await w.tapAt(m.x, m.y, "tap after a cancelled touch"); await settle(w.page);
    w.check("the next tap still works after a cancelled touch", "26.1.4", await state(w.page, "selected"));
  } else {
    const a = await snap();
    await w.page.mouse.move(cx + 40, cy + 30); await w.page.mouse.down();
    for (let i = 1; i <= 8; i++) { await w.page.mouse.move(cx + 40 + i * 12, cy + 30 + i * 5); await sleep(16); }
    await w.page.mouse.up(); await sleep(250);
    const b = await snap();
    w.check("a mouse drag moves the view and selects nothing", { view: "changed", selected: a.selected }, { view: b.view === a.view ? "unchanged" : "changed", selected: b.selected });
    await centre(w, "26.1");
    const m = await w.ev(() => window.__W.markAt("26.1.6"));
    await w.page.mouse.move(m.x, m.y); await w.page.mouse.down(); await w.page.mouse.move(m.x + 3, m.y + 2); await w.page.mouse.up(); await settle(w.page);
    w.check("a press that moved less than 6 px is a click and selects", "26.1.6", await state(w.page, "selected"));
    w.check("the Drag the map switch is for touch only: not shown with a mouse", false, await w.ev(() => window.__W.shown(document.getElementById("dragBtn"))));
    await centre(w, "26.1");
    const y0 = await w.ev(() => scrollY);
    await w.page.mouse.move(cx, cy); await w.page.mouse.wheel(0, 300); await sleep(250);
    const wh = await w.ev(() => ({ y: scrollY, focus: window.LexiconExplorer.tree.view.focus }));
    w.check("the mouse wheel over the canvas does not trap the page", "the page scrolls or the view stays on 26.1", { scrolled: wh.y - y0, focus: wh.focus }, wh.y - y0 > 0 || wh.focus === "26.1");
  }
  // no free-running loop: two seconds of idle
  await centre(w, "26.1"); await sleep(700);
  const f0 = await w.ev(() => ({ raf: window.__raf, sum: window.__W.canvasSum("tree") })); await sleep(2000);
  const f1 = await w.ev(() => ({ raf: window.__raf, sum: window.__W.canvasSum("tree") }));
  w.check("no free-running loop: in 2 s of idle zero animation frames and unchanged canvas pixels", { frames: 0, pixels: "unchanged" }, { frames: f1.raf - f0.raf, pixels: f1.sum === f0.sum ? "unchanged" : "changed" });
  w.focusReport("touch and pointer");
});

// ─── S08 layers ──────────────────────────────────────────────────────────────
section("S08", "layers", async (w) => {
  await centre(w, "26.1");
  await w.station("layers");
  const s0 = await w.ev(() => ({ station: window.LexiconExplorer.state.station, name: document.getElementById("st-layers").textContent.trim(), legendOpen: document.getElementById("legendBox").open, legend: document.getElementById("legend").textContent, marks: window.LexiconExplorer.state.marks, sum: window.__W.canvasSum("tree") }));
  w.check("station Kinds of sentence opens the legend", { station: "layers", name: "3 Kinds of sentence", legendOpen: true, legend: true }, { station: s0.station, name: s0.name, legendOpen: s0.legendOpen, legend: LEGEND.every((x) => s0.legend.includes(x)) });
  w.check("the badge help is shown once at Stargazer (in the empty Entry, not again in the legend box)", false, s0.legend.includes(BADGE_HELP));
  await w.tap("#marksBtn"); await sleep(150);
  const s1 = await w.ev(() => ({ marks: window.LexiconExplorer.state.marks, pressed: document.getElementById("marksBtn").getAttribute("aria-pressed"), sum: window.__W.canvasSum("tree") }));
  w.check("Show the kinds on the map: pressed, and the canvas is redrawn with layer shapes", { marks: true, pressed: "true", canvas: "changed" }, { marks: s1.marks, pressed: s1.pressed, canvas: s1.sum === s0.sum ? "unchanged" : "changed" });
  const f = await w.ev(() => { const M = window.__M, c = M.layerCountsOf(M.EZEKIEL); return { counts: c, buttons: ["text", "said", "checked", "reading"].map((k) => { const b = document.querySelector('[data-key="filter-' + k + '"]'); return { word: b.querySelector(".badge").textContent.replace(/[^A-Z ]/g, "").trim(), n: Number(b.textContent.replace(/\D/g, "")), pressed: b.getAttribute("aria-pressed") }; }) }; });
  w.check("four labelled filter buttons with the count per layer", [["WRITTEN", f.counts.text], ["SAID", f.counts.said], ["CHECKED", f.counts.checked], ["OUR IDEA", f.counts.reading]], f.buttons.map((b) => [b.word, b.n]));
  w.check("the four counts add up to the number of entries", f.counts.total, f.buttons.reduce((n, b) => n + b.n, 0));
  await w.shot("15-layers-marked", "Station Kinds of sentence: the tree marked by layer (shape and colour), the four filter buttons with counts.");
  await w.tap('[data-key="filter-said"]'); await sleep(150);
  const s2 = await w.ev(() => ({ said: window.LexiconExplorer.state.filter.said, pressed: document.querySelector('[data-key="filter-said"]').getAttribute("aria-pressed"), sum: window.__W.canvasSum("tree") }));
  w.check("SAID switched off: not pressed, drawn faint on the canvas", { said: false, pressed: "false", canvas: "changed" }, { said: s2.said, pressed: s2.pressed, canvas: s2.sum === s1.sum ? "unchanged" : "changed" });
  await w.shot("16-layers-filtered", "The SAID layer filtered out: its entries are drawn faint.");
  await w.tap('[data-key="filter-said"]'); await sleep(120);
  w.check("SAID switched on again: the canvas is as before", { pressed: "true", canvas: "same" }, await w.ev((sum) => ({ pressed: document.querySelector('[data-key="filter-said"]').getAttribute("aria-pressed"), canvas: window.__W.canvasSum("tree") === sum ? "same" : "different" }), s1.sum));
  await w.sweep("Kinds of sentence");
  await w.lens("navigator");
  const txt = await w.ev(() => ({ t: document.getElementById("say").textContent + document.getElementById("stationBody").textContent, name: document.getElementById("st-layers").textContent.trim(), words: Array.from(document.querySelectorAll('[data-key^="filter-"] .badge')).map((b) => b.textContent.replace(/[^A-Z ]/g, "").trim()) }));
  w.check("Navigator: the station is Layers, the badges read TEXT, SAID, CHECKED, READING", { name: "4 Layers", words: ["TEXT", "SAID", "CHECKED", "READING"] }, { name: txt.name, words: txt.words });
  w.check("the station says", "The label is part of the sealed line: change it and the seal no longer fits. The seal does not judge the label.", txt.t.includes("The label is part of the sealed line: change it and the seal no longer fits. The seal does not judge the label.") ? "The label is part of the sealed line: change it and the seal no longer fits. The seal does not judge the label." : txt.t.slice(0, 300));
  await w.tap("#marksBtn");
  w.check("marking switched off again", false, await state(w.page, "marks"));
  w.focusReport("layers");
});

// ─── S09 seal and tamper ─────────────────────────────────────────────────────
async function sealNow(w, expectedLines) {
  await w.ev(() => { window.__W.onWatch = () => { const b = document.getElementById("sealBtn"), all = Array.from(document.querySelectorAll("[data-busy-lock]")); if (b) b.click(); return { busy: all.every((x) => x.getAttribute("aria-busy") === "true"), locked: all.every((x) => x.disabled || x.getAttribute("aria-disabled") === "true"), n: all.length, stateBusy: window.LexiconExplorer.state.busy }; }; window.__watch = window.__W.watch("say", "#sealProgress"); });
  await w.tap("#sealBtn");
  await idle(w.page);
  const got = await w.ev(() => { window.__watch.stop(); return { seen: window.__watch.seen, extra: window.__watch.extra }; });
  w.check("sealing shows its progress epoch by epoch, all fourteen", expectedLines, got.seen);
  w.check("while sealing, Seal, the tampers and Load are locked and aria-busy is set; a second press of Seal during the job starts nothing (jobs never overlap)", "busy and locked at each of the 14 steps", got.extra.slice(0, 2), got.extra.length === 14 && got.extra.every((x) => x && x.busy && x.locked && x.stateBusy && x.n >= 2));
  w.check("after sealing the buttons are free again and the focus is not on the body", { disabled: false, busy: 0, focus: true }, await w.ev(() => ({ disabled: document.getElementById("sealBtn").disabled, busy: document.querySelectorAll("[aria-busy=true]").length, focus: window.__W.focus() !== "body" })));
}
async function tamper(w, key) {
  await w.tap("#tamper-" + key);
  await idle(w.page);
  return w.ev((k) => { const t = window.LexiconExplorer.state.tampers[k] || {}, p = document.querySelector('[data-tamper="' + k + '"]'); return { expected: t.expected, got: t.got, asDeclared: t.asDeclared, accepted: t.accepted, verdict: t.verdict, shown: p ? p.textContent : null, focus: window.__W.focus() }; }, key);
}
section("S09", "seal and tamper", async (w) => {
  await w.station("seal");
  w.check("Stargazer: the station is called Stamp it and the button says Stamp it", ["4 Stamp it", "Stamp it"], await w.ev(() => [document.getElementById("st-seal").textContent.trim(), document.getElementById("sealBtn").textContent]));
  await w.openBox("stationBox");
  w.check("Stargazer shows three tamper buttons (a thing, not an entry)", ["Change a word", "Drop a thing", "Add a thing"], await w.ev(() => Array.from(document.querySelectorAll("#stationBody .tamper > button")).map((b) => b.textContent)));
  await w.tap("#tamper-word"); await idle(w.page);
  w.check("a tamper before sealing says what is needed first", "Stamp it first.", await w.ev(() => document.querySelector('[data-tamper="word"]').textContent));
  await w.ev(() => scrollTo(0, 0));
  await sealNow(w, Array.from({ length: 14 }, (_, i) => "Stamping: part " + (i + 1) + " of 14"));
  const v = await w.ev(() => ({ verdict: document.getElementById("sealVerdict").textContent, ok: window.LexiconExplorer.state.seal.ok, tabs: window.__W.shown(document.getElementById("tabs")), hashes: Array.from(document.querySelectorAll(".hash")).filter((x) => window.__W.shown(x)).length, epochs: window.LexiconExplorer.state.seal.bundle.lineage.length }));
  w.check("the stamp fits (Stargazer wording), fourteen epochs in the chain", { ok: true, verdict: "The stamp fits: this exact writing is unchanged since it was stamped.", epochs: 14 }, { ok: v.ok, verdict: v.verdict.replace(/^[^A-Za-z]*CHECKED\s*/, ""), epochs: v.epochs });
  const chainLine = await w.ev(() => document.getElementById("sealChain").textContent);
  w.check("Stargazer shows no tab but Entry, and one hash: the name of this stamp under the verdict", { tabs: false, hashes: 1, name: true }, { tabs: v.tabs, hashes: v.hashes, name: /^The name of this stamp: BC-[0-9a-f]{24}$/.test(chainLine) || chainLine });
  const said = await w.ev(() => document.getElementById("say").textContent + " " + document.getElementById("stationBody").textContent);
  w.check("the Stargazer seal sentence", "A seal is a stamp on the exact writing. Change one letter and the stamp no longer fits, and anyone can see that. It does not say the writing is true, and it does not say who made it.", said.includes("A seal is a stamp on the exact writing. Change one letter and the stamp no longer fits, and anyone can see that. It does not say the writing is true, and it does not say who made it.") ? "A seal is a stamp on the exact writing. Change one letter and the stamp no longer fits, and anyone can see that. It does not say the writing is true, and it does not say who made it." : said.slice(0, 400));
  await w.openBox("stationBox");
  for (const key of ["word", "drop", "add"]) {
    const t = await tamper(w, key), copy = await w.ev((k) => window.__M.TAMPER_COPY[k].noticedStargazer, key);
    w.check("Stargazer tamper " + key + ": refused at its declared check, with the Stargazer sentence", { got: t.expected, asDeclared: true, verdict: "REFUSED", sentence: copy }, { got: t.got, asDeclared: t.asDeclared, verdict: t.verdict, sentence: t.shown && t.shown.includes(copy) ? copy : t.shown });
  }
  const sw = await w.ev(() => ({ wheel: !!document.querySelector("#stationBody #wheelCanvas") && window.__W.shown(document.getElementById("wheelCanvas")), text: document.getElementById("stationBody").textContent.includes("One message made of 64 lights: 16 slices of 4."), cap: document.getElementById("wheelCap").textContent, hex: window.__W.shown(document.getElementById("wheelHex")) }));
  w.check("Stargazer: the word wheel is inside Stamp it, with its Stargazer sentence and caption, and no hex", { wheel: true, text: true, cap: "On this curved map the thin outer lights are as big as the wide inner ones.", hex: false }, sw);
  await w.tap('#stationBody [data-key="bit-4"]');
  const g = await w.ev(() => ({ name: document.querySelector('[data-key="bit-4"]').getAttribute("aria-label"), readout: document.getElementById("wheelReadout").textContent }));
  w.check("flipping the guard light: the button is named and the readout says the guard notices", "Light 5 of 64, the guard, on|off; the guard notices", g, /^Light 5 of 64, the guard, (on|off)$/.test(g.name) && /guard notices/.test(g.readout));
  await w.sweep("Stamp it, sealed, three tampers run", { card: false });
  await w.ev(() => document.getElementById("stationBox").scrollIntoView());
  await w.shot("20-stamp-it-stargazer", "Stargazer, Stamp it: the three tampers refused and the word wheel inside the station.");
  await w.tap("#wheelReset");
  // Navigator: seal again and run all eight tampers
  await w.lens("navigator");
  w.check("Navigator: before a new seal the old one still stands; tabs Chain and Overwatch have something in them", ["Entry", "Wheel", "Chain", "Overwatch"], await w.ev(() => Array.from(document.querySelectorAll("#tabs button")).map((b) => b.textContent)));
  await w.ev(() => scrollTo(0, 0));
  await sealNow(w, Array.from({ length: 14 }, (_, i) => "Sealing: epoch " + (i + 1) + " of 14"));
  w.check("Navigator verdict", "Every check passed: unchanged since it was sealed.", (await w.ev(() => document.getElementById("sealVerdict").textContent)).replace(/^[^A-Za-z]*CHECKED\s*/, ""));
  w.check("the note on the station", "Epochs follow address order. The author's notes are sealed last because 100 is the largest index, not because they continue the Bible.", (await w.ev(() => (document.getElementById("say").textContent + document.getElementById("stationBody").textContent).includes("Epochs follow address order. The author's notes are sealed last because 100 is the largest index, not because they continue the Bible."))) ? "Epochs follow address order. The author's notes are sealed last because 100 is the largest index, not because they continue the Bible." : "missing");
  await w.openBox("stationBox");
  const rows = await w.ev(() => window.__M.tamperRows("navigator"));
  w.check("Navigator shows the eight tampers of the table", rows.map((r) => r.label), await w.ev(() => Array.from(document.querySelectorAll("#stationBody .tamper > button")).map((b) => b.textContent)));
  for (const r of rows) {
    const t = await tamper(w, r.key), copy = await w.ev((k) => window.__M.TAMPER_COPY[k].noticed, r.key);
    const want = r.expected === "accepted" ? { got: "accepted", asDeclared: true, verdict: "ACCEPTED", sentence: copy, names: true } : { got: r.expected, asDeclared: true, verdict: "REFUSED", sentence: copy, names: true };
    w.check("tamper " + r.key + " (" + r.label + "): " + (r.expected === "accepted" ? "ACCEPTED, with the wording about different bytes under a different key" : "refused at the check called " + r.expected + ", and the page names that check"), want,
      { got: t.got, asDeclared: t.asDeclared, verdict: t.verdict, sentence: t.shown && t.shown.includes(copy) ? copy : t.shown, names: r.expected === "accepted" ? /Signed by key S-/.test(t.shown || "") : (t.shown || "").includes("Refused at the check called " + r.expected + ".") });
    if (t.focus === "body") w.focusBad.push("after tamper " + r.key);
  }
  w.check("the seal itself is untouched by the tampers", true, await w.ev(() => window.LexiconExplorer.state.seal.ok === true && document.getElementById("sealVerdict").textContent.includes("Every check passed")));
  await w.sweep("Seal, all tampers run", { card: false });
  await w.ev(() => document.querySelector('[data-tamper="relabel"]').scrollIntoView({ block: "center" }));
  await w.shot("21-tampers-navigator", "Navigator, Seal: the tampers with the check that refuses each, and the last one ACCEPTED under a new key.");
  // Chain and Overwatch
  await w.tap("#tabBtn-chain");
  const chain = await w.ev(() => { const M = window.__M, t = document.querySelectorAll("#tabChain table"); const ep = Array.from(t[0].querySelectorAll("tbody tr")).map((tr) => Array.from(tr.cells).map((c) => c.textContent)); return { tab: window.LexiconExplorer.state.tab, pressed: document.getElementById("tabBtn-chain").getAttribute("aria-pressed"), role: document.getElementById("tabBtn-chain").getAttribute("role"), epochs: ep.length, order: ep.map((r) => r[1].split(" ")[0]), model: M.epochRows(M.EZEKIEL).map((r) => r.address), ids: ep.every((r) => /^BC-[0-9a-f]+/.test(r[2]) || r[2].length > 8), ledger: t[1].querySelectorAll("tbody tr").length, text: document.getElementById("tabChain").textContent }; });
  w.check("Chain tab (a plain button with aria-pressed): fourteen epochs in address order, each with its chain name, and the ledger", { tab: "chain", pressed: "true", role: null, epochs: 14, order: chain.model, ids: true, ledger: "1 or more" }, { tab: chain.tab, pressed: chain.pressed, role: chain.role, epochs: chain.epochs, order: chain.order, ids: chain.ids, ledger: chain.ledger >= 1 ? "1 or more" : 0 });
  w.check("Chain tab carries the two limits", true, chain.text.includes("They are not a record of when or in what order anything was written.") && chain.text.includes("not that its times are true."));
  await w.sweep("Chain tab");
  await w.ev(() => document.getElementById("explain").scrollIntoView());
  await w.shot("22-tab-chain", "The Chain tab after sealing: fourteen epochs and the ledger.");
  await w.tap("#tabBtn-overwatch");
  const ow = await w.ev(() => { const M = window.__M, lis = Array.from(document.querySelectorAll("#tabOverwatch .checks li")); return { n: lis.length, text: document.getElementById("tabOverwatch").textContent, cert: M.CERTIFIED.every((c) => document.getElementById("tabOverwatch").textContent.includes(c.text)), failed: window.LexiconExplorer.state.seal.report ? window.LexiconExplorer.state.seal.report.failed : "?", allOk: M.sealView(window.LexiconExplorer.state.seal, "navigator").checks.every((c) => c.ok), nChecks: M.sealView(window.LexiconExplorer.state.seal, "navigator").checks.length }; });
  w.check("Overwatch tab: every check listed and passed, the certificate, and what it does and does not certify", { listed: ow.nChecks, allOk: true, cert: true, key: true, drawings: true }, { listed: ow.n, allOk: ow.allOk, cert: ow.cert, key: /Signed by key\s*S-[0-9a-f]+ \(a key made for this visit\)/.test(ow.text), drawings: ow.text.includes("The drawings are not signed.") });
  await w.sweep("Overwatch tab");
  await w.ev(() => document.getElementById("explain").scrollIntoView());
  await w.shot("23-tab-overwatch", "The Overwatch tab: the checks, the certificate and what it covers.");
  const [dl] = await Promise.all([w.page.waitForEvent("download", { timeout: 15000 }), w.tap('#tabOverwatch [data-download="package"]')]);
  const file = path.join(FILES, "sealed-" + w.vp.name + ".json");
  await dl.saveAs(file);
  const wire = await w.ev(() => window.LexiconExplorer.state.seal.wire);
  w.check("Download the package saves a file named after the chain, holding the sealed bytes", { name: true, same: true }, { name: FILE_NAME.test(dl.suggestedFilename()), same: fs.readFileSync(file, "utf8") === wire });
  w.check("nothing of the supplied passage is in the package", [], await w.ev((x) => { const M = window.__M; return M.READER_VERSES.map((a) => M.verseView(a, "supplied").text).filter((t) => x.includes(t)).concat(x.includes("New International") ? ["NIV named"] : []); }, wire));
  w.focusReport("seal and tamper");
});

// ─── S10 send ────────────────────────────────────────────────────────────────
section("S10", "send to the four receivers", async (w) => {
  // continues from S09: sealed, Navigator
  await w.lens("navigator");
  await w.station("send");
  const pre = await w.ev(() => ({ sealed: !!window.LexiconExplorer.state.seal, noise: document.getElementById("noiseBtn").getAttribute("aria-pressed"), label: document.getElementById("noiseBtn").textContent }));
  w.check("the noise switch is off at first", { noise: "false", label: "Add noise on the road to Athens and Rome" }, { noise: pre.noise, label: pre.label });
  await w.ev(() => { window.__W.onWatch = () => { const b = document.getElementById("sendBtn"); return b.disabled || b.getAttribute("aria-disabled") === "true"; }; window.__watch = window.__W.watch("say", "#sendProgress"); });
  await w.tap("#sendBtn"); await idle(w.page);
  const prog = await w.ev(() => { window.__watch.stop(); return { seen: window.__watch.seen, locked: window.__watch.extra }; });
  w.check("the four receivers answer one after another, each shown as it answers, while Send is locked", { seen: ["Antioch: accepted (1 of 4)", "Alexandria: accepted (2 of 4)", "Athens: accepted (3 of 4)", "Rome: accepted (4 of 4)"], locked: [true, true, true, true] }, prog);
  if (w.phone) await w.openBox("stationBox");
  const clear = await w.ev(() => ({ rows: Array.from(document.querySelectorAll("#sendRows li, #sendRowsBox li")).filter((li) => window.__W.shown(li)).map((li) => li.textContent), count: document.getElementById("sendCount").textContent.replace(/^[^0-9]*/, ""), marks: Array.from(document.querySelectorAll(".send-marks li")).filter((li) => window.__W.shown(li)).map((li) => li.textContent), k: window.LexiconExplorer.state.send.k, keys: new Set(window.LexiconExplorer.state.send.rows.map((r) => r.sealId)).size, sealKey: window.LexiconExplorer.state.seal.certificate.sealId, rowKeys: window.LexiconExplorer.state.send.rows.map((r) => r.sealId) }));
  w.check("without noise: all four accept", ["Antioch: accepted", "Alexandria: accepted", "Athens: accepted", "Rome: accepted"], clear.rows);
  w.check("4 of 4 handshakes in this page, and both marks of the two-witness rule are met", { count: "4 of 4 handshakes in this page", marks: ["✓ two: enough for the rule of Deuteronomy 19:15, as a demonstration", "✓ three: the stricter count in the same verse"] }, { count: clear.count, marks: clear.marks });
  w.check("each receiver signed with its own key, none with the sealer's", { keys: 4, own: true }, { keys: clear.keys, own: !clear.rowKeys.includes(clear.sealKey) });
  await w.tap("#tabBtn-witnesses");
  const wt = await w.ev(() => ({ rows: Array.from(document.querySelectorAll("#tabWitnesses table tbody tr")).map((tr) => Array.from(tr.cells).slice(0, 4).map((c) => c.textContent).join("|")), text: document.getElementById("tabWitnesses").textContent, count: document.getElementById("witnessCount").textContent.replace(/^[^0-9]*/, ""), badge: document.querySelectorAll("#witnessCount .badge").length }));
  w.check("Witnesses tab: the same count line, with its badge", { count: "4 of 4 handshakes in this page", badge: 1 }, { count: wt.count, badge: wt.badge });
  w.check("Witnesses tab: four rows", ["Antioch|clear|accepted|yes", "Alexandria|clear|accepted|yes", "Athens|clear|accepted|yes", "Rome|clear|accepted|yes"], wt.rows);
  const CH = "4 of the four receivers accepted. All four run inside this page, with the same code, each with a key made a moment ago. This shows how a two-witness rule is checked. It does not show that independent parties have looked.";
  const RD = "The page borrows a number from the rule of Deuteronomy 19:15 and nothing more. That rule is about people giving evidence.";
  w.check("the CHECKED wording about simulated receivers", CH, wt.text.includes(CH) ? CH : wt.text.slice(-500));
  w.check("the READING wording about the rule", RD, wt.text.includes(RD) ? RD : "missing");
  await w.sweep("Send, four of four; Witnesses tab");
  await w.ev(() => scrollTo(0, 0));
  await w.shot("24-send-4-of-4", "Station Send without noise: four of four handshakes, both marks met.");
  await w.tap("#noiseBtn");
  w.check("the noise switch is pressed", "true", await w.ev(() => document.getElementById("noiseBtn").getAttribute("aria-pressed")));
  await w.tap("#sendBtn"); await idle(w.page);
  if (w.phone) await w.openBox("stationBox");
  const noisy = await w.ev(() => ({ rows: Array.from(document.querySelectorAll("#sendRows li, #sendRowsBox li")).filter((li) => window.__W.shown(li)).map((li) => li.textContent), count: document.getElementById("sendCount").textContent.replace(/^[^0-9]*/, ""), marks: Array.from(document.querySelectorAll(".send-marks li")).filter((li) => window.__W.shown(li)).map((li) => li.textContent), focus: window.__W.focus() }));
  w.check("with noise on the road to Athens and Rome: those two refuse, the other two accept", ["Antioch: accepted", "Alexandria: accepted", "Athens: refused", "Rome: refused"], noisy.rows.map((r) => r.replace(/ at the check called .*$/, "")), noisy.rows.length === 4 && /^Antioch: accepted$/.test(noisy.rows[0]) && /^Alexandria: accepted$/.test(noisy.rows[1]) && /^Athens: refused at the check called \S+ \(noise on its road\)$/.test(noisy.rows[2]) && /^Rome: refused at the check called \S+ \(noise on its road\)$/.test(noisy.rows[3]));
  w.check("2 of 4 handshakes in this page: the mark two is met, the mark three is not", { count: "2 of 4 handshakes in this page", marks: ["✓ two: enough for the rule of Deuteronomy 19:15, as a demonstration", "· three: the stricter count in the same verse (not met)"] }, { count: noisy.count, marks: noisy.marks });
  await w.openBox("stationBox");
  const verse = await w.ev(() => document.getElementById("stationBody").textContent);
  w.check("the verse of the rule is shown as TEXT, with its translation named", true, verse.includes("at the mouth of two witnesses, or at the mouth of three witnesses, shall the matter be established") && verse.includes("Deuteronomy 19:15, King James Version"));
  await w.tap("#tabBtn-witnesses");
  await w.sweep("Send with noise; Witnesses tab");
  await w.ev(() => scrollTo(0, 0));
  await w.shot("25-send-noise-2-of-4", "Station Send with noise on two roads: two of four handshakes, the mark three not met.");
  await w.ev(() => document.getElementById("explain").scrollIntoView());
  await w.shot("26-tab-witnesses", "The Witnesses tab after a noisy send.");
  w.focusReport("send");
  const cold = await fresh(w.rec, w.browser, w.base, w.vp, { hash: "#lens=navigator" });
  await cold.station("send"); await cold.tap("#sendBtn"); await sleep(200);
  w.check("Send before Seal says what is needed first", "Seal the lexicon first: the Seal station makes the package that is sent.", await cold.ev(() => (document.querySelector("#stationMain p.note") || {}).textContent));
  cold.focusReport("send before seal");
  await cold.close();
});

// ─── S11 the fourth square ───────────────────────────────────────────────────
section("S11", "station 7, the fourth square", async (w) => {
  await w.lens("navigator");
  await w.station("fourth");
  const s = await w.ev(() => ({ open: document.getElementById("stationBox").open, parts: Array.from(document.querySelectorAll("#fourthBlock section.fig-part h3")).map((x) => x.textContent), figs: Array.from(document.querySelectorAll("#fourthBlock canvas.fig")).map((c) => { const cap = document.getElementById(c.getAttribute("aria-describedby")); return c.getAttribute("role") === "img" && !!c.getAttribute("aria-label") && !!cap && cap.textContent.length > 10 && c.tabIndex < 0 && getComputedStyle(c).touchAction === "pan-y pinch-zoom" && c.width > 0; }) }));
  w.check("The fourth square opens its five figures in the author's order", { open: true, parts: ["Three squared distances", "The mirror word", "Three quarters and the fourth", "1, 4, 9, then 16", "A corner, flat and curved"] }, { open: s.open, parts: s.parts });
  w.check("each figure is a drawn canvas with role img, a label, a caption, and the touch rule", [true, true, true, true, true], s.figs);
  const cap = (i) => w.ev((k) => document.querySelectorAll("#fourthBlock canvas.fig")[k].parentElement.querySelector(".cap").textContent, i);
  const model = await w.ev(() => { const M = window.__M; return { p: M.TQF_PRESETS.map((p) => ({ key: p.key, sentence: M.threeSquares(p.points).sentence, A: M.threeSquares(p.points).A })), d: M.squaresFigure().sentence, e: M.cornersFigure().flat.sentence + " " + M.cornersFigure().curved.sentence, n: M.packetsOf(M.EZEKIEL).length }; });
  for (const p of model.p) {
    await w.tap('[data-key="preset-' + p.key + '"]');
    w.check("(a) preset " + p.key + ": the three squared distances and the area, from the model (A = " + p.A + ")", p.sentence, await cap(0));
  }
  w.check("(a) three points in a line give zero", true, /zero|A = 0/.test(model.p[1].sentence));
  const fa = await w.ev(() => { const c = document.querySelector("#fourthBlock canvas.fig-a"), r = c.getBoundingClientRect(), M = window.__M; c.scrollIntoView({ block: "center" }); const r2 = c.getBoundingClientRect(); const side = Math.max(40, Math.min(r2.width, r2.height) - 52), at = (p) => { const [u, v] = M.tqfPlace(p); return { x: r2.left + (r2.width - side) / 2 + u * side, y: r2.top + (r2.height - side) / 2 + v * side }; }; return { from: at([2, 5]), to: at([5, 5]), pts: window.LexiconExplorer.state.square.points, w: r.width }; });
  if (w.phone) {
    await w.tapAt(fa.to.x, fa.to.y, "figure a, a grid point");
    const pts = await w.ev(() => window.LexiconExplorer.state.square.points);
    w.check("(a) on a phone a tap moves the nearest point to the tapped grid point, and the numbers follow", "a point at [5,5]; caption from the model", { pts, cap: await cap(0) }, pts.some((p) => p[0] === 5 && p[1] === 5) && (await cap(0)) === (await w.ev(() => window.__M.threeSquares(window.LexiconExplorer.state.square.points).sentence)));
    const sw = "#fourthBlock .drag-switch";
    w.check("(a) has its own switch for a finger, named for what it drags", { shown: true, label: "Drag the points", pressed: "false" }, await w.ev((q) => { const b = document.querySelector(q); return { shown: !!b && window.__W.shown(b), label: b.textContent, pressed: b.getAttribute("aria-pressed") }; }, sw));
    await w.tap(sw);
    const fb = await w.ev(() => { const c = document.querySelector("#fourthBlock canvas.fig-a"); c.scrollIntoView({ block: "center" }); const r = c.getBoundingClientRect(), M = window.__M, side = Math.max(40, Math.min(r.width, r.height) - 52), at = (p) => { const [u, v] = M.tqfPlace(p); return { x: r.left + (r.width - side) / 2 + u * side, y: r.top + (r.height - side) / 2 + v * side }; }; return { from: at([5, 5]), to: at([5, 2]), y: scrollY, touch: getComputedStyle(c).touchAction, cap: document.querySelector("#fourthBlock .drag-caption").textContent, capShown: window.__W.shown(document.querySelector("#fourthBlock .drag-caption")) }; });
    w.check("(a) with the switch on: touch-action none and the caption says so", { touch: "none", cap: "Dragging is on. Scroll the page from outside the figure.", capShown: true }, { touch: fb.touch, cap: fb.cap, capShown: fb.capShown });
    await swipe(w.cdp, fb.from, fb.to);
    const fc = await w.ev(() => ({ pts: window.LexiconExplorer.state.square.points, y: scrollY, capOk: document.querySelector("#fourthBlock canvas.fig-a").parentElement.querySelector(".cap").textContent === window.__M.threeSquares(window.LexiconExplorer.state.square.points).sentence }));
    w.check("(a) with the switch on a finger drags a point from [5,5] to [5,2]; the page stays and the numbers follow", "a point at [5,2], none at [5,5], no scroll", fc, fc.pts.some((p) => p[0] === 5 && p[1] === 2) && !fc.pts.some((p) => p[0] === 5 && p[1] === 5) && fc.y === fb.y && fc.capOk);
    await w.tap(sw);
    w.check("(a) switched off again: a finger scrolls the page", "pan-y pinch-zoom", await w.ev(() => getComputedStyle(document.querySelector("#fourthBlock canvas.fig-a")).touchAction));
  } else {
    await w.page.mouse.move(fa.from.x, fa.from.y); await w.page.mouse.down();
    for (let i = 1; i <= 6; i++) { await w.page.mouse.move(fa.from.x + ((fa.to.x - fa.from.x) * i) / 6, fa.from.y + ((fa.to.y - fa.from.y) * i) / 6); await sleep(16); }
    await w.page.mouse.up(); await sleep(150);
    const pts = await w.ev(() => window.LexiconExplorer.state.square.points);
    w.check("(a) a point is dragged with the mouse from [2,5] to [5,5] and the numbers follow", "a point at [5,5], none at [2,5]; caption from the model", { pts, cap: await cap(0) }, pts.some((p) => p[0] === 5 && p[1] === 5) && !pts.some((p) => p[0] === 2 && p[1] === 5) && (await cap(0)) === (await w.ev(() => window.__M.threeSquares(window.LexiconExplorer.state.square.points).sentence)));
  }
  // (b) the mirror word
  const mb = async () => w.ev(() => { const M = window.__M, sq = window.LexiconExplorer.state.square, d = M.mirrorFigure(sq.seed, { hidden: sq.hidden, wrongBit: sq.wrongBit }); return { seed: sq.seed.slice(), hidden: sq.hidden, wrongBit: sq.wrongBit, capOk: document.querySelector("#fourthBlock canvas.fig-b").parentElement.querySelector(".cap").textContent === d.sentences.map((x) => x.text).join(" "), ones: d.ones, restored: d.restored, caught: d.caught, pressed: [0, 1, 2, 3].map((k) => document.querySelector('[data-key="seed-' + k + '"]').getAttribute("aria-pressed")), hide: document.querySelector('[data-key="mirror-hide"]').textContent }; });
  const b0 = await mb();
  await w.tap('[data-key="seed-0"]');
  const b1 = await mb();
  w.check("(b) a seed light flips: the button shows it and all 64 lights are filled again by mirrors", { flipped: true, pressed: String(b1.seed[0] === 1), ones: b1.seed.reduce((n, x) => n + x, 0) * 16, cap: true }, { flipped: b1.seed[0] !== b0.seed[0], pressed: b1.pressed[0], ones: b1.ones, cap: b1.capOk });
  await w.tap('[data-key="mirror-hide"]');
  const b2 = await mb();
  w.check("(b) the fourth corner is hidden and the other three give it back", { hidden: true, restored: true, button: "Show the fourth corner", cap: true }, { hidden: b2.hidden, restored: b2.restored, button: b2.hide, cap: b2.capOk });
  await w.ev(() => document.querySelector("#fourthBlock canvas.fig-b").scrollIntoView({ block: "center" }));
  await w.shot("30-fourth-mirror-hidden", "Station 7, figure (b): the mirror word with the fourth corner hidden and given back by the other three.");
  await w.tap('[data-key="mirror-wrong"]');
  const b3 = await mb();
  w.check("(b) one light flipped in the fourth corner is caught", { wrongBit: "set", caught: true, cap: true }, { wrongBit: b3.wrongBit === null ? "null" : "set", caught: b3.caught, cap: b3.capOk });
  await w.tap('[data-key="mirror-wrong"]');
  const cb = await w.ev(() => { const c = document.querySelector("#fourthBlock canvas.fig-b"); c.scrollIntoView({ block: "center" }); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
  const sq0 = await state(w.page, "square");
  await w.tapAt(cb.x - cb.w * 0.4, cb.y - cb.w * 0.4, "figure b, the seed corner");
  const sq1 = await state(w.page, "square");
  w.check("(b) a tap on the mirror figure itself changes it (a seed light, or the hidden corner)", "changed", same(sq0, sq1) ? "unchanged" : "changed");
  // (c)
  const c0 = await w.ev(() => document.querySelector('[data-key="quarter-prev"]').parentElement.querySelector(".note").textContent);
  await w.tap('[data-key="quarter-next"]');
  const c1 = await w.ev(() => { const M = window.__M, i = window.LexiconExplorer.state.square.packet; return { label: document.querySelector('[data-key="quarter-prev"]').parentElement.querySelector(".note").textContent, capOk: document.querySelector("#fourthBlock canvas.fig-c").parentElement.querySelector(".cap").textContent === M.quarterFigure(M.packetsOf(M.EZEKIEL)[i]).sentence, fits: M.quarterFigure(M.packetsOf(M.EZEKIEL)[i]).fits }; });
  w.check("(c) the packet stepper moves through the " + model.n + " packets; three quarter parities fix the fourth", { from: "Packet 1 of " + model.n, to: "Packet 2 of " + model.n, cap: true, fits: true }, { from: c0, to: c1.label, cap: c1.capOk, fits: c1.fits });
  await w.tap('[data-key="quarter-prev"]');
  w.check("(d) the squares 1, 4, 9 and then 16", model.d, await cap(3));
  w.check("(e) the flat corner and the {4,5} corner, one sentence each", model.e, await cap(4));
  const tail = await w.ev(() => { const M = window.__M, t = document.getElementById("fourthBlock").textContent; return { verse: t.includes(M.FOURTH_VERSE.text) && t.includes(M.FOURTH_VERSE.name), name: M.FOURTH_VERSE.name, cert: M.CERTIFIED.map((c) => t.includes(c.text)) }; });
  w.check("then John 1:14 as TEXT with its translation, and the wording on what is certified", { verse: true, name: "John 1:14, King James Version", cert: [true, true, true, true] }, tail);
  await w.sweep("The fourth square, five figures", { card: false });
  await w.ev(() => document.getElementById("fourthBlock").scrollIntoView());
  await w.shot("31-fourth-three-squares", "Station 7, figure (a): three squared distances and the area.");
  await w.ev(() => document.querySelector("#fourthBlock canvas.fig-c").scrollIntoView({ block: "start" }));
  await w.shot("32-fourth-quarters-squares-corners", "Station 7, figures (c), (d) and (e): three quarters and the fourth, the squares 1, 4, 9 and 16, a corner flat and curved.");
  await w.ev(() => document.querySelector("#fourthBlock > div.fig-part").scrollIntoView({ block: "start" }));
  await w.shot("33-fourth-certified", "Station 7, its end: John 1:14 as TEXT and what a certificate covers.");
  w.focusReport("fourth square");
});

// ─── S12 the word wheel and the square ───────────────────────────────────────
section("S12", "wheel and square", async (w) => {
  await w.lens("navigator");
  await w.ev(() => { window.LexiconExplorer.select("100.10"); }); await settle(w.page);
  await w.tap("#tabBtn-wheel");
  const g = await w.ev(() => { const c = document.getElementById("wheelCanvas"), r = c.getBoundingClientRect(), cap = document.getElementById(c.getAttribute("aria-describedby")); const M = window.__M; return { tab: window.LexiconExplorer.state.tab, w: Math.round(r.width), h: Math.round(r.height), role: c.getAttribute("role"), label: c.getAttribute("aria-label"), cap: cap ? cap.textContent : null, focusable: c.tabIndex >= 0, touch: getComputedStyle(c).touchAction, views: Array.from(document.querySelectorAll("#wheelBlock [data-view]")).map((b) => b.textContent + ":" + b.getAttribute("aria-pressed")), packet: document.getElementById("wheelPacket").textContent, n: M.packetsOf(M.EZEKIEL).length, hex: document.getElementById("wheelHex").textContent, first: M.packetsOf(M.EZEKIEL)[window.LexiconExplorer.state.wheel.packet] }; });
  w.check("Wheel tab: the wheel is drawn at least 300 px across, with role img, its label and its caption", { tab: "wheel", size: "300 or more, square", role: "img", label: "The word wheel: one packet of 64 lights", cap: "Sixteen sectors of four rings: each sector is one hex digit, and on this curved map all 64 cells have the same area.", focusable: false, touch: "pan-y pinch-zoom" }, { tab: g.tab, size: g.w >= 300 && g.w === g.h ? "300 or more, square" : g.w + " x " + g.h, role: g.role, label: g.label, cap: g.cap, focusable: g.focusable, touch: g.touch });
  w.check("two views, Wheel pressed; the packet is one of " + g.n + " and its hex is shown", { views: ["Wheel:true", "Square 8 × 8:false"], hex: g.first }, { views: g.views, hex: g.hex });
  const bits = await w.ev(() => { const M = window.__M, v = M.wheelView(M.EZEKIEL, window.LexiconExplorer.state.wheel, "navigator"), bs = Array.from(document.querySelectorAll('#wheelBlock .bitgrid button')); return { n: bs.length, names: bs.every((b, i) => b.getAttribute("aria-label") === v.cells[i].name), guard: bs.filter((b) => /the guard/.test(b.getAttribute("aria-label"))).map((b) => b.getAttribute("aria-label")), state: bs.every((b, i) => b.getAttribute("aria-pressed") === String(v.cells[i].on) && b.textContent === (v.cells[i].on ? "1" : "0")), rows: new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size }; });
  w.check("under the wheel the same word is an 8 x 8 grid of 64 real buttons, one row per byte, each named, one of them the guard", { n: 64, names: true, guard: 1, state: true, rows: 8 }, { n: bits.n, names: bits.names, guard: bits.guard.length, state: bits.state, rows: bits.rows });
  w.check("a light is named like", "Light 5 of 64, the guard, on|off", bits.guard[0], /^Light 5 of 64, the guard, (on|off)$/.test(bits.guard[0] || ""));
  const author = await w.ev(() => { const M = window.__M, a = M.wheelAuthorLine(M.EZEKIEL, "navigator"), t = document.getElementById("wheelAuthor").textContent, all = document.getElementById("tabWheel").textContent; const l2 = M.entryView(M.EZEKIEL, "100.2", "navigator", {}).author; return { label: t.includes("READING · the author's note"), quoted: t.includes(a.quoted), facet: t.includes(a.facet.text), badge: Array.from(document.querySelectorAll("#wheelAuthor .badge")).map((b) => b.textContent.replace(/[^A-Z ]/g, "").trim()), line2: all.includes(l2.quoted) }; });
  w.check("the author's line 10 stands here in quotation marks under READING · the author's note, with its first CHECKED facet; line 2 does not appear", { label: true, quoted: true, facet: true, badge: ["CHECKED"], line2: false }, author);
  const caps = await w.ev(() => document.getElementById("wheelCaptions").textContent);
  w.check("the ladder and the parity captions", true, caps.includes("1 → 4 → 16 → 64: bit, sector, quarter, word") && caps.includes("Parity catches one flipped bit, or any odd number. Two flips cancel: parity holds again although the word has changed; the crystal check catches that."));
  await w.ev(() => document.getElementById("wheelCanvas").scrollIntoView({ block: "center" }));
  const r = await w.ev(() => { const b = document.getElementById("wheelCanvas").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width }; });
  await w.tapAt(r.x + r.w * 0.22, r.y - r.w * 0.12, "a slice of the wheel");
  const sec = await w.ev(() => { const s = window.LexiconExplorer.state.wheel.sector, bs = Array.from(document.querySelectorAll("#wheelSector button")); return { sector: s, labels: bs.map((b) => b.textContent.replace(/\s+/g, " ").trim()), sizes: bs.map((b) => { const q = b.getBoundingClientRect(); return Math.min(q.width, q.height); }), pressed: bs.map((b) => b.getAttribute("aria-pressed")), note: document.querySelector("#wheelSector .note") ? document.querySelector("#wheelSector .note").textContent : "", focus: document.activeElement.closest("#wheelSector") ? "in the four lights" : window.__W.focus() }; });
  w.check("a tap on a slice selects that hex digit and opens its four lights as four buttons of at least 44 px, labelled 8, 4, 2, 1 with on or off; the focus goes to them", "sector 0..15; 8, 4, 2, 1; 44 px; focus in the four lights", sec, sec.sector !== null && sec.labels.length === 4 && sec.labels.every((t, i) => new RegExp("^" + [8, 4, 2, 1][i] + "\\b.*\\b(on|off)$").test(t)) && sec.sizes.every((x) => x >= 43.5) && /^Slice \d+ of 16, the letter [0-9A-Fa-f]:$/.test(sec.note) && sec.focus === "in the four lights");
  w.check("the tap on the wheel flipped no light (the wheel is the picture, not the control)", 0, await w.ev(() => window.LexiconExplorer.state.wheel.flips.length));
  await w.shot("40-wheel-sector", "The Wheel tab: the word wheel of the packet that holds line 10, one slice opened as four lights.");
  const flip = async (sel) => { await w.tap(sel); return w.ev(() => { const M = window.__M, v = M.wheelView(M.EZEKIEL, window.LexiconExplorer.state.wheel, "navigator"); return { hex: document.getElementById("wheelHex").textContent, changed: v.changed, parityOk: v.parityOk, equalsCrystal: v.equalsCrystal, readout: document.getElementById("wheelReadout").textContent, readoutModel: v.readout.every((x) => document.getElementById("wheelReadout").textContent.includes(x.text)), flips: v.flips.length }; }); };
  const f1 = await flip("#wheelSector button");
  w.check("one light flipped: the new hex is shown beside the old, parity fails, the word no longer equals the crystal packet", { was: true, parityOk: false, equalsCrystal: false, readout: true, flips: 1 }, { was: /^[0-9A-F]{16}\s+\(was [0-9A-F]{16}\)$/.test(f1.hex) || f1.hex, parityOk: f1.parityOk, equalsCrystal: f1.equalsCrystal, readout: f1.readoutModel, flips: f1.flips });
  const other = await w.ev(() => { const on = window.LexiconExplorer.state.wheel.flips[0]; return "bit-" + (on === 20 ? 21 : 20); });
  const f2 = await flip('#wheelBlock [data-key="' + other + '"]');
  w.check("a second light flipped in the 8 x 8 grid: parity holds again although the word has changed; the crystal check catches it", { parityOk: true, equalsCrystal: false, readout: true, flips: 2 }, { parityOk: f2.parityOk, equalsCrystal: f2.equalsCrystal, readout: f2.readoutModel, flips: f2.flips });
  await w.ev(() => document.getElementById("wheelReadout").scrollIntoView({ block: "center" }));
  await w.shot("41-wheel-two-flips", "The 8 x 8 grid of light buttons after two flips: parity holds, the crystal check does not.");
  await w.tap("#wheelReset");
  w.check("Reset the word puts the lights back", { flips: 0, hex: g.first }, await w.ev(() => ({ flips: window.LexiconExplorer.state.wheel.flips.length, hex: document.getElementById("wheelHex").textContent })));
  await w.tap('#wheelBlock [data-view="square"]');
  const sqv = await w.ev(() => ({ view: window.LexiconExplorer.state.wheel.view, label: document.getElementById("wheelCanvas").getAttribute("aria-label"), pressed: document.querySelector('#wheelBlock [data-view="square"]').getAttribute("aria-pressed") }));
  w.check("the second view, Square 8 x 8, of the same word", { view: "square", label: "The same word as a square, 8 by 8", pressed: "true" }, sqv);
  await w.ev(() => document.getElementById("wheelCanvas").scrollIntoView({ block: "center" }));
  const r2 = await w.ev(() => { const b = document.getElementById("wheelCanvas").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width }; });
  await w.tapAt(r2.x - r2.w * 0.2, r2.y - r2.w * 0.2, "a cell of the square");
  w.check("a tap on the square opens a slice as well", "a sector and four lights", await w.ev(() => ({ sector: window.LexiconExplorer.state.wheel.sector, lights: document.querySelectorAll("#wheelSector button").length })), await w.ev(() => window.LexiconExplorer.state.wheel.sector !== null && document.querySelectorAll("#wheelSector button").length === 4));
  await w.shot("42-wheel-square", "The same word as a square, 8 by 8.");
  await w.tap('#wheelBlock [data-view="wheel"]');
  await w.tap('#wheelBlock [data-key="packet-next"]');
  const p1 = await w.ev(() => document.getElementById("wheelPacket").textContent);
  await w.tap('#wheelBlock [data-key="packet-prev"]');
  await w.tap('#wheelBlock [data-key="packet-prev"]');
  const p2 = await w.ev(() => document.getElementById("wheelPacket").textContent);
  await w.tap('#wheelBlock [data-key="packet-entry"]');
  const p3 = await w.ev(() => { const M = window.__M; return { label: document.getElementById("wheelPacket").textContent, want: "Packet " + (M.packetOfEntry(M.EZEKIEL, "100.10") + 1) + " of " + M.packetsOf(M.EZEKIEL).length }; });
  w.check("the packet stepper goes forward and back (round the end), and Of the chosen entry returns to the packet holding the selected entry's line", { step: true, entry: p3.want }, { step: p1 !== p2 && /^Packet \d+ of \d+$/.test(p1) && /^Packet \d+ of \d+$/.test(p2), entry: p3.label });
  await w.sweep("Wheel tab");
  await w.lens("holographer");
  w.check("Holographer caption of the wheel", "Ring radii from equalAreaRings(1.5, 4): 64 cells of hyperbolic area 0.1328 each. Sector = i >> 2, ring = i & 3, bit = 63 − i.", await w.ev(() => document.getElementById("wheelCap").textContent));
  await w.sweep("Wheel tab, Holographer");
  w.focusReport("wheel");
});

// ─── S13 the three lenses on every station and tab ───────────────────────────
section("S13", "three lenses, every station and tab", async (w) => {
  // continues from a sealed and sent page
  const hasSeal = await w.ev(() => !!window.LexiconExplorer.state.seal && !!window.LexiconExplorer.state.send);
  w.check("this part runs on a page that has sealed and sent", true, hasSeal);
  await w.ev(() => { window.LexiconExplorer.select("26.1.1.4"); }); await settle(w.page);
  for (const lens of ["stargazer", "navigator", "holographer"]) {
    await w.ev(() => scrollTo(0, 0));
    await w.lens(lens);
    const shown = await w.ev(() => ({ stations: Array.from(document.querySelectorAll("#strip button")).map((b) => b.id.slice(3)), tabs: window.__W.shown(document.getElementById("tabs")) ? Array.from(document.querySelectorAll("#tabs button")).map((b) => b.textContent) : [], load: window.__W.shown(document.getElementById("loadBox")), hashes: Array.from(document.querySelectorAll(".hash")).filter((x) => window.__W.shown(x)).length, meta: !!document.getElementById("entryMeta"), crumbs: document.querySelectorAll("#tabEntry .crumbs").length, more: (document.querySelector("#tabEntry details.more-rows > summary") || {}).textContent || null, body: document.body.getAttribute("data-lens"), pressed: Array.from(document.querySelectorAll("button[data-lens]")).map((b) => b.getAttribute("aria-pressed")).join() }));
    if (lens === "stargazer") w.check("Stargazer shows four stations, no tab but Entry, no Load control, no address, kind, breadcrumb or hash; the rest of an entry is behind More for older readers", { stations: STAR_STATIONS, tabs: [], load: false, hashes: 0, meta: false, crumbs: 0, more: "More for older readers" }, { stations: shown.stations, tabs: shown.tabs, load: shown.load, hashes: shown.hashes, meta: shown.meta, crumbs: shown.crumbs, more: shown.more });
    else w.check(lens + " shows seven stations, the five tabs (each has something in it now), the Load control, address, kind and breadcrumbs", { stations: ALL_STATIONS, tabs: ["Entry", "Wheel", "Chain", "Overwatch", "Witnesses"], load: true, meta: true, crumbs: 1 }, { stations: shown.stations, tabs: shown.tabs, load: shown.load, meta: shown.meta, crumbs: shown.crumbs });
    for (const key of shown.stations) {
      await w.ev(() => scrollTo(0, 0));
      await w.station(key);
      const st = await w.ev(() => ({ station: window.LexiconExplorer.state.station, current: (document.querySelector("#strip [aria-current]") || {}).id, say: document.getElementById("strixLine") ? document.getElementById("strixLine").querySelectorAll(".badge").length : 0, bridge: window.__W.shown(document.getElementById("bridge")) ? document.querySelectorAll("#bridge .badge").length : -1, tab: window.LexiconExplorer.state.tab }));
      w.check(lens + ", station " + key + ": open, marked in the strip; STRIX's sentence carries a badge; the gold box carries badges", { station: key, current: "st-" + key, say: 1, bridge: "1 or more" }, { station: st.station, current: st.current, say: st.say, bridge: st.bridge >= 1 ? "1 or more" : st.bridge });
      if (st.tab !== "entry") await w.tap("#tabBtn-entry");
      await w.sweep(lens + ", station " + key);
      const y = await w.ev(() => { const b = document.getElementById("stationBox"); return window.__W.shown(b); });
      if (y) { await w.openBox("stationBox"); await w.sweep(lens + ", station " + key + ", its box open", { card: false }); }
      if (lens !== "stargazer" || key === "read") await w.contrast(lens + ", station " + key);
      await w.ev(() => scrollTo(0, 0));
      await w.shot("5" + ["stargazer", "navigator", "holographer"].indexOf(lens) + "-" + lens + "-" + (ALL_STATIONS.indexOf(key) + 1) + "-" + key, "The " + lens + " lens at station " + key + " with the river phrase of verse 1 selected (after sealing and sending).");
    }
    if (lens !== "stargazer") for (const tab of ["wheel", "chain", "overwatch", "witnesses", "entry"]) {
      await w.tap("#tabBtn-" + tab);
      w.check(lens + ", tab " + tab + ": pressed and shown", { tab, pressed: "true", shown: true }, await w.ev((t) => ({ tab: window.LexiconExplorer.state.tab, pressed: document.getElementById("tabBtn-" + t).getAttribute("aria-pressed"), shown: window.__W.shown(document.getElementById("tab" + t[0].toUpperCase() + t.slice(1))) }), tab));
      await w.sweep(lens + ", tab " + tab);
      if (lens === "holographer") await w.contrast(lens + ", tab " + tab);
    }
  }
  // the Entry's parts: groups in the fixed order, breadcrumbs, rows that open, More for older readers
  await w.lens("navigator"); await w.station("read");
  await w.ev(() => { window.LexiconExplorer.select("26.1.1.4"); }); await settle(w.page);
  const grp = await w.ev(() => { const M = window.__M, order = M.ENTRY_GROUPS.map((g) => g.heading), seen = Array.from(document.querySelectorAll("#tabEntry h3")).map((x) => x.textContent).filter((t) => order.includes(t)); const v = M.entryView(M.EZEKIEL, "26.1.1.4", "navigator", {}); return { seen, order, rows: v.first.length + v.more.length, shown: document.querySelectorAll("#tabEntry .entry-row .badge").length }; });
  const idx = grp.seen.map((t) => grp.order.indexOf(t));
  w.check("Navigator Entry: the children stand under headings in the fixed order (plain rows, written, parts, TEXT, CHECKED, SAID, READING)", "headings in the order of the model's groups, each once", grp.seen, grp.seen.length >= 2 && idx.every((x, i) => i === 0 || x > idx[i - 1]));
  await w.tap('#tabEntry [data-key="crumb-26.1.1"]'); await settle(w.page);
  w.check("a breadcrumb selects the ancestor it names", "26.1.1", await state(w.page, "selected"));
  await w.tap('#tabEntry [data-key="row-26.1.1.4"]'); await settle(w.page);
  w.check("a row that has parts is a button that opens it", "26.1.1.4", await state(w.page, "selected"));
  await w.lens("stargazer");
  const more0 = await w.ev(() => { const M = window.__M, v = M.entryView(M.EZEKIEL, "26.1.1.4", "stargazer", { wording: "supplied" }), d = document.querySelector("#tabEntry details.more-rows"); return { open: d.open, first: v.first.length, more: v.more.length, visibleRows: Array.from(document.querySelectorAll("#tabEntry .entry-row .badge")).filter((b) => window.__W.shown(b)).length }; });
  w.check("Stargazer Entry: the words, then the plain rows with their badges; the rest is closed behind More for older readers", { open: false, visibleRows: more0.first }, { open: more0.open, visibleRows: more0.visibleRows });
  await w.tap("#tabEntry details.more-rows > summary");
  const more1 = await w.ev(() => { const d = document.querySelector("#tabEntry details.more-rows"); return { open: d.open, rows: Array.from(d.querySelectorAll(".entry-row .badge")).filter((b) => window.__W.shown(b)).length }; });
  w.check("More for older readers opens the rest", { open: true, rows: "some" }, { open: more1.open, rows: more1.rows >= 1 ? "some" : 0 });
  await w.sweep("Stargazer, More for older readers open");
  await w.station("seal"); await w.openBox("stationBox");
  w.check("Stargazer, after stamping: Save the parcel as a file is offered in the station", "Save the parcel as a file", await w.ev(() => (document.querySelector('#stationBody [data-download="package"]') || {}).textContent));
  // Holographer: the line and its SHA-256
  await w.lens("holographer");
  await w.ev(() => { window.LexiconExplorer.select("26.1.1.4"); }); await settle(w.page);
  const holo = await w.ev(async () => { const M = window.__M, hs = Array.from(document.querySelectorAll("#tabEntry .hash")).map((x) => x.textContent), v = M.entryView(M.EZEKIEL, "26.1.1.4", "holographer", {}); const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.line)); const hex = Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join(""); return { n: hs.length, line: hs[0] === v.line, sha: hs[1] === v.lineSha, recomputed: hex === v.lineSha, size: getComputedStyle(document.querySelector("#tabEntry .hash")).fontSize }; });
  w.check("Holographer: the Entry shows the line itself and its SHA-256 (recomputed here from the line), at 13 px", { n: 2, line: true, sha: true, recomputed: true, size: "13px" }, holo);
  await w.ev(() => document.getElementById("explain").scrollIntoView());
  await w.shot("60-holographer-entry-line", "Holographer: the Entry with the canonical line and its SHA-256.");
  // the author's lines and the sensitive entries
  await w.lens("navigator");
  await w.ev(() => { window.LexiconExplorer.select("100.8"); }); await settle(w.page);
  const l8 = await w.ev(() => { const M = window.__M, a = M.entryView(M.EZEKIEL, "100.8", "navigator", {}).author, t = document.getElementById("tabEntry").textContent; return { label: t.includes("READING · the author's note"), quoted: t.includes(a.quoted) && /^“.*”$/.test(a.quoted), framing: t.includes(M.LINE8_FRAMING), facet: t.includes(a.facet.text), order: t.indexOf(a.quoted) < t.indexOf(M.LINE8_FRAMING) && t.indexOf(M.LINE8_FRAMING) < t.indexOf(a.facet.text), strix: document.getElementById("say").textContent.includes("So help you God"), status: document.getElementById("status").textContent.includes("So help you God") }; });
  w.check("line 8 is shown in quotation marks under READING · the author's note, with its framing and its first SAID facet, and never in STRIX's voice", { label: true, quoted: true, framing: true, facet: true, order: true, strix: false }, { label: l8.label, quoted: l8.quoted, framing: l8.framing, facet: l8.facet, order: l8.order, strix: l8.strix });
  await w.sweep("line 8, Navigator");
  await w.ev(() => document.getElementById("explain").scrollIntoView());
  await w.shot("61-authors-line-8", "The author's line 8 as the Entry shows it: quoted, framed, with its first facet.");
  await w.ev(() => { window.LexiconExplorer.select("100"); }); await settle(w.page);
  const l100 = await w.ev(() => { const M = window.__M, t = document.getElementById("tabEntry").textContent; const kids = M.childrenOf(M.EZEKIEL, "100").filter((a) => M.isAuthorLine(M.EZEKIEL, a)); const quotes = kids.map((a) => M.entryView(M.EZEKIEL, a, "navigator", {}).author.quoted); let last = -1, ordered = true; for (const q of quotes) { const i = t.indexOf(q); if (i < 0 || i < last) ordered = false; last = i; } return { n: kids.length, ordered, corrected: t.includes("spelling corrected in two places"), facets: kids.every((a) => t.includes(M.entryView(M.EZEKIEL, a, "navigator", {}).author.facet.text)) }; });
  w.check("entry 100 shows the author's ten lines in the author's order, each with its first facet, and says spelling corrected in two places", { n: 10, ordered: true, corrected: true, facets: true }, l100);
  await w.ev(() => { window.LexiconExplorer.select("26.1.1.2"); }); await settle(w.page);
  const act1 = await w.ev(() => Array.from(document.querySelectorAll('#tabEntry a.btn')).map((a) => a.textContent + " -> " + a.getAttribute("href")));
  await w.ev(() => { window.LexiconExplorer.select("26.1.9.2"); }); await settle(w.page);
  const act2 = await w.ev(() => Array.from(document.querySelectorAll('#tabEntry a.btn')).map((a) => a.textContent + " -> " + a.getAttribute("href")));
  w.check("the date term links to the sky page's Ezekiel preset and the not-turning term to its lab", ["Open that date in the Celestial Control Panel -> ../Celestial_Control_Panel/index.html#preset=ezekiel&lens=navigator", "Try it in the lab -> ../Celestial_Control_Panel/index.html#lab=square&lens=navigator"], act1.concat(act2));
  const target = await w.page.request.get(w.base + "/Library/Experimental_Systems/Celestial_Control_Panel/index.html");
  w.check("the linked page exists", 200, target.status());
  // a link row: a button that flies to its target
  await w.ev(() => { window.LexiconExplorer.select("100.1"); }); await settle(w.page);
  const go = await w.ev(() => { const b = document.querySelector('#tabEntry [data-key^="go-"]'); return b ? { key: b.getAttribute("data-key"), tag: b.localName, target: b.getAttribute("data-address") } : null; });
  w.check("line 1 (the author's wordplay) shows links as buttons", "a button with a target", go, !!go && go.tag === "button");
  if (go) { await w.openBox("stationBox").catch(() => {}); await w.tap('#tabEntry [data-key="' + go.key + '"]'); await settle(w.page); w.check("a link button flies to its target and selects it", [go.target, go.target], await w.ev(() => [window.LexiconExplorer.state.selected, window.LexiconExplorer.tree.view.focus])); }
  const l1 = await w.ev(() => { const M = window.__M, t = M.EZEKIEL.entries.filter((e) => e.address === "100.1" || e.address.startsWith("100.1.")).map((e) => e.text).join(" ") + " " + document.body.textContent; return { calls: /Bible calls Jesus an alien/i.test(t), versus: /alien[^.]{0,40}\bJew\b/i.test(t) }; });
  w.check("line 1: the page never writes that the Bible calls Jesus an alien and never sets alien against Jew", { calls: false, versus: false }, l1);
  // the gold box
  await w.station("read");
  const br = await w.ev(() => { const b = document.getElementById("bridge"), more = b.querySelector(".fold-more"); return { first: document.getElementById("bridgeFirst").textContent, more: more ? more.textContent : null, text: b.textContent }; });
  w.check("the first gold box shows its first sentence and a button for more", "a first sentence and a more button", { first: br.first, more: br.more }, br.first.length > 20 && (!w.phone || br.more === "more"));
  if (w.phone) await w.tap("#bridge .fold-more");
  const br2 = await w.ev(() => document.getElementById("bridge").textContent);
  w.check("the first gold box states the bridge once, with its disclaimer", true, br2.includes("The gold boxes follow that line from Ezekiel's river to John 3:16. This is our reading; no check depends on it, and the word bridge is not in the King James Bible.") && br2.split("the word bridge is not in the King James Bible").length === 2);
  await w.ev(() => document.getElementById("bridge").scrollIntoView());
  await w.shot("62-gold-box-read", "The gold box of station Read, opened: this project's reading and what it stands on.");
  const stand = await w.ev(() => { const b = document.querySelector('#bridge [data-key^="stand-"]'); return b ? b.getAttribute("data-address") : null; });
  if (stand) { await w.tap('#bridge [data-key="stand-' + stand + '"]'); await settle(w.page); w.check("a source under the gold box opens its entry", stand, await state(w.page, "selected")); }
  w.focusReport("lenses, stations, tabs");
});

// ─── S14 the dialog ──────────────────────────────────────────────────────────
section("S14", "dialog: What is real here?", async (w) => {
  for (const lens of ["stargazer", "holographer"]) {
    await w.lens(lens);
    await w.ev(() => scrollTo(0, 700)); await sleep(80);
    const sticky = await w.ev(() => window.__W.shown(document.getElementById("aboutBtn")) && document.getElementById("aboutBtn").getBoundingClientRect().top >= 0);
    if (!sticky) await w.ev(() => scrollTo(0, 0));
    await w.tap("#aboutBtn"); await sleep(150);
    const d = await w.ev(() => { const dl = document.getElementById("about"), bar = dl.firstElementChild, close = bar.firstElementChild, head = document.getElementById(dl.getAttribute("aria-labelledby")), r = close.getBoundingClientRect(), dr = dl.getBoundingClientRect(); const firstControl = dl.querySelector("button, a, input, [tabindex]"); return { open: dl.open, modal: dl.matches(":modal"), top: dl.scrollTop, closeFirst: firstControl === close && close.textContent.trim() === "Close", closeVisible: r.top >= 0 && r.bottom <= innerHeight && r.top - dr.top < 80, heading: head ? head.textContent : null, focus: document.activeElement === close, inside: dr.left >= 0 && dr.right <= innerWidth + 0.5 && dr.bottom <= innerHeight + 0.5, text: dl.textContent }; });
    w.check(lens + ": the dialog opens at scroll position 0 with Close first in the DOM and visible at the top, labelled by its heading, the focus on Close", { open: true, modal: true, top: 0, closeFirst: true, closeVisible: true, heading: "What is real here?", focus: true, inside: true }, { open: d.open, modal: d.modal, top: d.top, closeFirst: d.closeFirst, closeVisible: d.closeVisible, heading: d.heading, focus: d.focus, inside: d.inside });
    const body = await w.ev(() => { const M = window.__M, ps = Array.from(document.querySelectorAll("#aboutBody > p, #aboutBody > h3, #aboutBody > section")); const t = document.getElementById("aboutBody").textContent; const first = ps[0].textContent; const hi = ps.findIndex((p) => p.localName === "h3" && p.textContent === "In short"); const inShort = []; for (let i = hi + 1; i < ps.length && ps[i].localName === "p"; i++) inShort.push(ps[i].textContent); return { first: first.includes(M.DIALOG.first.text), firstBadge: !!ps[0].querySelector(".badge"), inShortAt: hi, inShort: inShort.length, inShortModel: M.DIALOG.inShort.every((s, i) => inShort[i] && inShort[i].includes(s.text)), words: Math.max(...M.DIALOG.inShort.flatMap((s) => M.sentencesOf(s.text)).map((s) => s.split(/\s+/).length)), heads: Array.from(document.querySelectorAll("#aboutBody section > h3")).map((x) => x.textContent), unbadged: Array.from(document.querySelectorAll("#aboutBody p")).filter((p) => !p.querySelector(".badge")).length, t }; });
    w.check(lens + ": first line, then In short with six Stargazer sentences (none over 16 words), every sentence with a badge", { first: true, firstBadge: true, inShortAt: 1, inShort: 6, inShortModel: true, words: "16 or fewer", unbadged: 0 }, { first: body.first, firstBadge: body.firstBadge, inShortAt: body.inShortAt, inShort: body.inShort, inShortModel: body.inShortModel, words: body.words <= 16 ? "16 or fewer" : body.words, unbadged: body.unbadged });
    const NEED = ["CHECKED means you can repeat this count or calculation. It does not mean the words beside it are proved.", "the same three levels First Explorers calls Stargazer, Explorer and Architect", "The only request to another host is for web fonts (Google Fonts); the page works without them.",
      "Code: MIT. Quoted texts belong to their rights holders and are not covered by that licence.", "The rules are this project's; the book does not contain them.", "It is an interpretation, chosen by this project.", "No check, packet or certificate on this page depends on it.", "The gold boxes quote several writers, each named where it is quoted.", "Van Paassen argues that Jesus was a Galilean Jew", "This project's view: most Christians and many historians would disagree with parts of that.", "STRIX is the owl that speaks on this page.", "What is ours, not his.", "the running text never mentions him", "Ezekiel 1 belongs first to the Hebrew Bible.", "LEX/1 and LEXICON/2 are drafts, not RFCs.",
      "Certified: these bytes, their order, their addresses, the label each entry was given, the lineage and the ledger, unchanged since they were sealed with this key.", "They are not a record of when or in what order anything was written.", "Its links show it has not been edited since sealing, not that its times are true.", "The drawings are not signed.", "The receivers are simulated in this page.", "a key this page makes is made for this visit. a signature shows integrity, not identity"];
    const supplied = await w.ev(() => { const M = window.__M, t = document.getElementById("aboutBody").textContent; return t.includes(M.SUPPLIED.notice) && t.includes(M.SUPPLIED.note); });
    w.check(lens + ": the dialog holds the sentences it must", [], NEED.filter((x) => !body.t.toLowerCase().includes(x.toLowerCase())).concat(supplied ? [] : ["the notice and the note of the supplied wording"]));
    w.check(lens + ": the dialog's sections", ["The four layers", "The Bible words", "Where the facts come from", "The book", "The bridge narrative (the gold boxes)", "Ezekiel 1 in Jewish tradition", "What a certificate covers", "Limits to keep in mind", "This page", "Other pages"], body.heads);
    await w.sweep(lens + ", dialog open", { card: false });
    await w.contrast(lens + ", dialog open");
    if (lens === "stargazer") {
      await w.shot("70-dialog-top", "The dialog What is real here? as it opens: Close first, the first line, In short.");
      await w.page.keyboard.press("Escape"); await sleep(150);
      w.check("Escape closes the dialog and the focus returns to the opener", { open: false, focus: "aboutBtn" }, await w.ev(() => ({ open: document.getElementById("about").open, focus: document.activeElement.id })));
      await w.tap("#aboutBtn"); await sleep(120);
      await w.ev(() => { document.getElementById("about").scrollTop = 900; }); await sleep(60);
      await w.shot("71-dialog-scrolled", "The dialog scrolled down: the Close bar stays at the top.");
      w.check("the Close bar stays visible when the dialog is scrolled", true, await w.ev(() => { const c = document.querySelector("#about .dialog-bar button").getBoundingClientRect(); return c.top >= 0 && c.bottom <= innerHeight; }));
      await w.tap("#about .dialog-bar button"); await sleep(120);
      w.check("the Close button closes the dialog and the focus returns to the opener", { open: false, focus: "aboutBtn" }, await w.ev(() => ({ open: document.getElementById("about").open, focus: document.activeElement.id })));
      await w.tap("#aboutBtn"); await sleep(120);
      w.check("opened again it is at scroll position 0", 0, await w.ev(() => document.getElementById("about").scrollTop));
      const dr = await w.ev(() => { const r = document.getElementById("about").getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight }; });
      const out = dr.t > 6 ? { x: dr.w / 2, y: Math.max(1, dr.t / 2) } : dr.l > 6 ? { x: Math.max(1, dr.l / 2), y: dr.h / 2 } : dr.b < dr.h - 6 ? { x: dr.w / 2, y: (dr.b + dr.h) / 2 } : null;
      if (out) {
        if (w.phone) await w.page.touchscreen.tap(out.x, out.y); else await w.page.mouse.click(out.x, out.y);
        await sleep(200);
        w.check("a press on the backdrop closes the dialog and the focus returns to the opener", { open: false, focus: "aboutBtn" }, await w.ev(() => ({ open: document.getElementById("about").open, focus: document.activeElement.id })));
      } else {
        w.check("a press on the backdrop closes the dialog (the dialog leaves backdrop to press)", "some backdrop outside the dialog", dr, false);
        await w.page.keyboard.press("Escape");
      }
    } else {
      await w.page.keyboard.press("Escape"); await sleep(120);
      w.check(lens + ": closed, the focus back on the opener", { open: false, focus: "aboutBtn" }, await w.ev(() => ({ open: document.getElementById("about").open, focus: document.activeElement.id })));
    }
  }
  w.focusReport("dialog");
});

// ─── S15 loading a package file ──────────────────────────────────────────────
async function loadFile(w, file) {
  await w.openBox("loadBox");
  await w.page.setInputFiles("#loadInput", file);
  await w.page.waitForFunction(() => !window.LexiconExplorer.state.busy && document.getElementById("loadOut").childElementCount > 0, null, { timeout: 60000 });
  await sleep(200);
}
section("S15", "loading a package file", async (w) => {
  // continues from a sealed page
  w.check("at Stargazer the Load control is hidden", false, await (async () => { await w.lens("stargazer"); return w.ev(() => window.__W.shown(document.getElementById("loadBox"))); })());
  await w.lens("navigator");
  await w.ev(() => { window.LexiconExplorer.select("26.1.1"); }); await settle(w.page);
  const before = await w.ev(() => ({ reader: document.getElementById("reader").textContent, hash: location.hash, inputs: document.querySelectorAll("input").length, type: document.getElementById("loadInput").type, textareas: document.querySelectorAll("textarea").length }));
  w.check("one file input, no paste box", { inputs: 1, type: "file", textareas: 0 }, { inputs: before.inputs, type: before.type, textareas: before.textareas });
  const wire = await w.ev(() => window.LexiconExplorer.state.seal.wire), name = await w.ev(() => window.LexiconExplorer.state.seal.fileName);
  // accepted
  await loadFile(w, { name, mimeType: "application/json", buffer: Buffer.from(wire, "utf8") });
  const n1 = await w.ev(() => ({ notice: (document.getElementById("loadNotice") || {}).textContent, button: (document.getElementById("showItBtn") || {}).textContent, origin: window.LexiconExplorer.state.lexicon.origin, banner: window.__W.shown(document.getElementById("banner")), checks: document.querySelectorAll("#loadOut .checks li").length, focus: window.__W.focus() }));
  w.check("a package made by this page is accepted, and nothing of it is drawn until Show it is pressed on this notice", { notice: OUTSIDE_NOTICE, button: "Show it", origin: "builtin", banner: false, checks: "some" }, { notice: n1.notice, button: n1.button, origin: n1.origin, banner: n1.banner, checks: n1.checks > 3 ? "some" : n1.checks });
  await w.ev(() => document.getElementById("loadBox").scrollIntoView());
  await w.shot("80-load-notice", "A loaded package before Show it: the notice and the checks, nothing of it drawn.");
  await w.tap("#showItBtn"); await sleep(300); await settle(w.page);
  const o = await w.ev(() => ({ origin: window.LexiconExplorer.state.lexicon.origin, banner: (() => { const p = Array.from(document.querySelectorAll("#banner p")).find((x) => window.__W.shown(x)); return window.__W.shown(document.getElementById("banner")) && p ? p.textContent : null; })(), inBlock: document.getElementById("banner").parentElement.id, backIn: !!document.querySelector("#banner #backBtn"), strip: window.__W.shown(document.getElementById("stripNav")), strix: document.getElementById("strix").textContent, bridge: window.__W.shown(document.getElementById("bridge")), reader: window.__W.shown(document.getElementById("readerBox")), verse: window.__W.shown(document.getElementById("verseBox")), tabs: Array.from(document.querySelectorAll("#tabs button")).map((b) => b.textContent), hash: location.hash, title: document.getElementById("entryTitle").textContent, cap: document.getElementById("treeCap").textContent, focus: window.__W.focus() }));
  w.check("the banner is in the block that stays at the top, with the Back button in it", { inBlock: "topWrap", backIn: true }, { inBlock: o.inBlock, backIn: o.backIn });
  w.check("shown as a lexicon from outside: the banner (the whole notice from 700 px, one line under it) stays; no stations, no STRIX, no gold box, no reader; tabs Entry and Overwatch", { origin: "outside", banner: w.phone ? OUTSIDE_SHORT : OUTSIDE_NOTICE, strip: false, strix: "", bridge: false, reader: false, verse: false, tabs: ["Entry", "Overwatch"] }, { origin: o.origin, banner: o.banner, strip: o.strip, strix: o.strix, bridge: o.bridge, reader: o.reader, verse: o.verse, tabs: o.tabs });
  w.check("a lexicon from outside is never written into the link", false, /entry=|sky=/.test(o.hash) && o.hash !== before.hash);
  await w.ev(() => { window.LexiconExplorer.select("26.1.1"); }); await settle(w.page);
  await w.openBox("listBox");
  const ob = await w.ev(() => ({ outline: document.querySelectorAll("#tabEntry .badge.outline").length, filled: Array.from(document.querySelectorAll("main .badge:not(.outline)")).filter((b) => window.__W.shown(b) && !b.closest("#legend")).length, word: (document.querySelector("#tabEntry .badge.outline") || {}).textContent, meta: (document.getElementById("entryMeta") || {}).textContent, iso: Array.from(document.querySelectorAll("#tabEntry .outside, #list .outside")).every((e) => e.getAttribute("dir") === "auto" && getComputedStyle(e).unicodeBidi === "isolate" && getComputedStyle(e).overflowWrap === "anywhere"), n: document.querySelectorAll("#tabEntry .outside, #list .outside").length, hash: location.hash, bg: getComputedStyle(document.querySelector("#tabEntry .badge.outline")).backgroundColor }));
  w.check("its badges are drawn outlined with the words labelled TEXT by its sender, never filled; the address stands beside the name; every string of it is in its own isolated element", { outline: "some", filled: 0, word: true, meta: "26.1.1 · verse", iso: true, n: "some", transparent: true }, { outline: ob.outline > 0 ? "some" : 0, filled: ob.filled, word: /labelled TEXT by its sender/.test(ob.word || ""), meta: ob.meta, iso: ob.iso, n: ob.n > 0 ? "some" : 0, transparent: /rgba\(0, 0, 0, 0\)|transparent/.test(ob.bg) });
  w.check("selecting an entry of it writes no entry link", false, /entry=26\.1\.1\b/.test(ob.hash) && ob.hash !== before.hash);
  await w.sweep("an outside lexicon, an entry selected");
  await w.ev(() => scrollTo(0, 0));
  await w.shot("81-outside-shown", "A lexicon from outside on show: the banner, outlined marks on the tree, no stations, no reader.");
  await w.ev(() => document.getElementById("explain").scrollIntoView());
  await w.shot("82-outside-entry", "An entry of the outside lexicon: outlined badges with the words labelled ... by its sender.");
  await w.tap("#tabBtn-overwatch");
  const sig = await w.ev(() => ({ sig: (document.getElementById("outsideSignature") || {}).textContent, checks: document.querySelectorAll("#tabOverwatch .checks li").length, text: document.getElementById("tabOverwatch").textContent }));
  w.check("the signature row", "signed by key S-…; this page cannot know whose key that is", sig.sig, /^signed by key S-[0-9a-f]+; this page cannot know whose key that is$/i.test(sig.sig || ""));
  w.check("the check list of the package and what the signature does not cover", true, sig.checks > 3 && sig.text.includes("Not covered by the signature"));
  await w.sweep("an outside lexicon, its checks");
  await w.ev(() => document.getElementById("explain").scrollIntoView());
  await w.shot("83-outside-checks", "The checks of the loaded package and the signature row.");
  await w.ev(() => scrollTo(0, 0));
  await w.tap("#backBtn"); await sleep(200);
  const back = await w.ev(() => ({ origin: window.LexiconExplorer.state.lexicon.origin, reader: document.getElementById("reader").textContent, banner: window.__W.shown(document.getElementById("banner")), strip: window.__W.shown(document.getElementById("stripNav")) }));
  w.check("Back to the Ezekiel lexicon: the built-in lexicon, its stations and its reader are back, the reader letter for letter as before", { origin: "builtin", reader: "as before", banner: false, strip: true }, { origin: back.origin, reader: back.reader === before.reader ? "as before" : "different", banner: back.banner, strip: back.strip });
  // refused
  await loadFile(w, { name: "changed.json", mimeType: "application/json", buffer: Buffer.from(wire.replace("the river of Chebar", "the river of Chebat"), "utf8") });
  const r1 = await w.ev(() => ({ refused: (document.getElementById("loadRefused") || {}).textContent, show: !!document.getElementById("showItBtn"), origin: window.LexiconExplorer.state.lexicon.origin, lis: Array.from(document.querySelectorAll("#loadOut .checks li")).map((li) => li.className + "|" + li.textContent.slice(0, 50)), body: document.body.textContent.includes("Chebat") }));
  w.check("a package with one changed word is refused: only its failure is shown, up to the check that refused it; nothing of it is drawn", { refused: "This package did not pass. Nothing of it is shown beyond the check that refused it.", show: false, origin: "builtin", drawn: false, lastFails: true }, { refused: r1.refused, show: r1.show, origin: r1.origin, drawn: r1.body, lastFails: r1.lis.length >= 1 && /fail|bad|no/i.test(r1.lis[r1.lis.length - 1].split("|")[0] + r1.lis[r1.lis.length - 1]) });
  await w.ev(() => document.getElementById("loadBox").scrollIntoView());
  await w.shot("84-load-refused", "A package with one changed word: refused, with the check that refused it.");
  await loadFile(w, { name: "notjson.json", mimeType: "application/json", buffer: Buffer.from("<img src=x onerror=alert(1)> this is not a package", "utf8") });
  const r2 = await w.ev(() => ({ refused: (document.getElementById("loadRefused") || {}).textContent, show: !!document.getElementById("showItBtn"), img: document.querySelectorAll("img").length }));
  w.check("a file that is not a package is refused the same way, as text", { refused: "This package did not pass. Nothing of it is shown beyond the check that refused it.", show: false, img: 0 }, r2);
  await loadFile(w, { name: "big.json", mimeType: "application/json", buffer: Buffer.alloc(4600000, 0x20) });
  w.check("a file over the size limit is not read", "That file is too large to be a package.", await w.ev(() => document.querySelector("#loadOut p").textContent));
  // a journey
  await loadFile(w, path.join(FILES, "journey.json"));
  const j = await w.ev(() => ({ line: (document.getElementById("loadJourney") || {}).textContent, checks: document.querySelectorAll("#loadOut .checks li").length, show: !!document.getElementById("showItBtn"), origin: window.LexiconExplorer.state.lexicon.origin }));
  w.check("a First Explorers journey package shows its checks and one line, and nothing else", { line: "This is a First Explorers journey.", checks: "some", show: false, origin: "builtin" }, { line: j.line, checks: j.checks > 3 ? "some" : j.checks, show: j.show, origin: j.origin });
  // an invented verse
  await loadFile(w, path.join(FILES, "invented.json"));
  w.check("the package with an invented verse row passes its checks (they certify bytes) and waits behind the notice; nothing of it is drawn", { notice: true, drawn: false }, await w.ev(() => ({ notice: !!document.getElementById("showItBtn") && document.getElementById("loadNotice").textContent.startsWith("This lexicon was not made by this page."), drawn: document.body.textContent.includes("invented verse") })));
  await w.tap("#showItBtn"); await sleep(300); await settle(w.page);
  await w.ev(() => { window.LexiconExplorer.select("26.1.1"); }); await settle(w.page);
  const iv = await w.ev(() => ({ banner: (() => { const p = Array.from(document.querySelectorAll("#banner p")).find((x) => window.__W.shown(x)); return window.__W.shown(document.getElementById("banner")) && p ? p.textContent : null; })(), outline: document.querySelectorAll("#tabEntry .badge.outline").length, filled: Array.from(document.querySelectorAll("main .badge:not(.outline)")).filter((b) => window.__W.shown(b) && !b.closest("#legend")).length, word: (document.querySelector("#tabEntry .badge.outline") || {}).textContent, entry: document.getElementById("tabEntry").textContent.includes("An invented verse that is in no Bible."), reader: window.__W.shown(document.getElementById("readerBox")), readerText: document.getElementById("reader").textContent.includes("invented") || document.getElementById("verseBox").textContent.includes("invented"), strix: document.getElementById("strix").textContent, wording: document.querySelectorAll('[data-key^="wording-"]').length, img: document.querySelectorAll("img").length, links: document.querySelectorAll("main a").length, hash: location.hash, over: document.documentElement.scrollWidth - innerWidth }));
  w.check("the invented verse is shown only as its sender's: banner, outlined badge labelled TEXT by its sender, no filled badge", { banner: w.phone ? OUTSIDE_SHORT : OUTSIDE_NOTICE, outline: "some", filled: 0, word: true, entry: true }, { banner: iv.banner, outline: iv.outline > 0 ? "some" : 0, filled: iv.filled, word: /labelled TEXT by its sender/.test(iv.word || ""), entry: iv.entry });
  w.check("the reader stays the built-in passage's: nothing of the package reaches the reader, the open verse, the wording switch or STRIX (they are put away while it is shown)", { readerShown: false, packageInReader: false, strix: "", wordingSwitch: 0 }, { readerShown: iv.reader, packageInReader: iv.readerText, strix: iv.strix, wordingSwitch: iv.wording });
  w.check("markup and addresses inside the package are plain text: no image, no link, no script ran, no sideways scroll, no entry link", { img: 0, links: 0, dialogs: 0, over: true, hash: false }, { img: iv.img, links: iv.links, dialogs: w.dialogs(), over: iv.over <= 0, hash: /entry=/.test(iv.hash) && iv.hash !== before.hash });
  await w.ev(() => scrollTo(0, 0));
  await w.shot("85-invented-verse", "A package whose verse row is invented: the banner, outlined marks, the Entry with an outlined badge; no reader.");
  await w.ev(() => document.getElementById("explain").scrollIntoView());
  await w.shot("86-invented-verse-entry", "The invented verse in the Entry, as its sender's text with an outlined badge.");
  await w.ev(() => { window.LexiconExplorer.select("26.1.2"); }); await settle(w.page);
  w.check("a link row of the package with no target says broken link", true, await w.ev(() => document.getElementById("tabEntry").textContent.includes("broken link")));
  await w.sweep("the invented package on show");
  await w.ev(() => scrollTo(0, 0));
  await w.tap("#backBtn"); await sleep(200);
  w.check("after Back the reader is the built-in passage, letter for letter as before the loads", "as before", await w.ev((t) => (document.getElementById("reader").textContent === t ? "as before" : "different"), before.reader));
  w.focusReport("load");
});

// ─── S16 links ───────────────────────────────────────────────────────────────
section("S16", "links: #entry, #lens, #sky, Back", async (w) => {
  const o = (hash) => fresh(w.rec, w.browser, w.base, w.vp, { hash });
  let p = await o("#entry=100&lens=navigator");
  w.check("#entry=100&lens=navigator selects and centres entry 100 at Navigator", { selected: "100", focus: "100", lens: "navigator", title: true }, await p.ev(() => ({ selected: window.LexiconExplorer.state.selected, focus: window.LexiconExplorer.tree.view.focus, lens: window.LexiconExplorer.state.lens, title: document.getElementById("entryTitle").textContent.length > 3 })));
  await p.sweep("opened on entry 100");
  await p.shot("90-link-entry-100", "Opened by the link #entry=100: the tree centred on 100, the author's notes, at Navigator.");
  w.check("console clean", [], p.messages); await p.close();
  p = await o("#entry=26.1");
  w.check("#entry=26.1 selects and centres the chapter", { selected: "26.1", focus: "26.1" }, await p.ev(() => ({ selected: window.LexiconExplorer.state.selected, focus: window.LexiconExplorer.tree.view.focus })));
  await p.sweep("opened on entry 26.1");
  await p.shot("91-link-entry-26.1", "Opened by the link #entry=26.1: the tree centred on 26.1, Ezekiel 1, selected.");
  await p.close();
  p = await o("#entry=77.7&x=1&lens=wizard");
  const bad = await p.ev(() => ({ selected: window.LexiconExplorer.state.selected, lens: window.LexiconExplorer.state.lens, note: window.__W.shown(document.getElementById("linkNote")) ? document.getElementById("linkNote").textContent : null }));
  w.check("an unknown entry, an unknown key and an unknown lens are ignored with a note", { selected: null, lens: "stargazer", note: "That link names an entry this lexicon does not have. + a link value was ignored" }, bad, bad.selected === null && bad.lens === "stargazer" && !!bad.note && bad.note.includes("That link names an entry this lexicon does not have.") && bad.note.includes("a link value was ignored"));
  w.check("the two notes of one link stand under the map as two sentences", TWO_NOTES, bad.note);
  await p.shot("92-link-unknown-entry", "A link naming an entry the lexicon does not have: ignored, with a note under the map.");
  w.check("console clean", [], p.messages); await p.close();
  p = await o("#lens=holographer");
  w.check("#lens=holographer opens at Holographer", "holographer", await state(p.page, "lens")); await p.close();
  // history
  p = await o("");
  const len0 = await p.ev(() => history.length);
  await p.tap('#verseBox [data-address="26.1.1.4"]'); await settle(p.page);
  await p.tap('#verseBox [data-address="26.1.1.5"]'); await settle(p.page);
  const h2 = await p.ev(() => ({ hash: location.hash, len: history.length }));
  w.check("each entry change is written to the link with pushState", { hash: "#entry=26.1.1.5&lens=stargazer", grew: 2 }, { hash: h2.hash, grew: h2.len - len0 });
  await p.page.goBack(); await sleep(250); await settle(p.page);
  w.check("Back returns to the previous entry and centres it", { selected: "26.1.1.4", focus: "26.1.1.4", hash: "#entry=26.1.1.4&lens=stargazer" }, await p.ev(() => ({ selected: window.LexiconExplorer.state.selected, focus: window.LexiconExplorer.tree.view.focus, hash: location.hash })));
  await p.page.goBack(); await sleep(250); await settle(p.page);
  w.check("Back again returns to nothing selected, the tree at home", { selected: null, focus: "26.1", title: "Tap a shining word" }, await p.ev(() => ({ selected: window.LexiconExplorer.state.selected, focus: window.LexiconExplorer.tree.view.focus, title: document.getElementById("entryTitle").textContent })));
  await p.page.goForward(); await sleep(250); await settle(p.page);
  w.check("Forward restores the entry", "26.1.1.4", await state(p.page, "selected"));
  await p.ev(() => { location.hash = "#entry=43.3.16"; }); await sleep(300); await settle(p.page);
  w.check("a link typed into the address bar (hashchange) is followed", { selected: "43.3.16", focus: "43.3.16" }, await p.ev(() => ({ selected: window.LexiconExplorer.state.selected, focus: window.LexiconExplorer.tree.view.focus })));
  await p.lens("navigator");
  w.check("a change of lens is written into the link without a new history entry", "#entry=43.3.16&lens=navigator", await p.ev(() => location.hash));
  w.check("console clean", [], p.messages); p.focusReport("links"); await p.close();
  // a sky
  p = await o("#sky=1505000.5,32.1,45.2&lens=navigator");
  const s = await p.ev(() => ({ origin: window.LexiconExplorer.state.lexicon.origin, stations: Array.from(document.querySelectorAll("#strip button")).map((b) => b.id.slice(3)), reader: window.__W.shown(document.getElementById("readerBox")), verse: window.__W.shown(document.getElementById("verseBox")), banner: window.__W.shown(document.getElementById("skyBanner")) ? document.getElementById("skyBanner").textContent : null, cap: document.getElementById("treeCap").textContent, entries: window.LexiconExplorer.state.lexicon.addresses.length, hash: location.hash, tabs: Array.from(document.querySelectorAll("#tabs button")).map((b) => b.textContent) }));
  w.check("#sky=JD,LAT,LON shows that sky as the page's own lexicon: stations Place, Layers, Seal, Send; no reader, no Count, no station 1, 2 or 7", { origin: "page", stations: ["place", "layers", "seal", "send"], reader: false, verse: false, banner: true }, { origin: s.origin, stations: s.stations, reader: s.reader, verse: s.verse, banner: !!s.banner && s.banner.length > 10 });
  const kids = await p.ev(() => { const M = window.__M, lx = window.LexiconExplorer.state.lexicon; const a = M.childrenOf(lx, lx.home)[0] || lx.addresses[0]; return a; });
  await p.ev((a) => { window.LexiconExplorer.select(a); }, kids); await settle(p.page);
  const se = await p.ev(() => ({ selected: window.LexiconExplorer.state.selected, title: document.getElementById("entryTitle").textContent, filled: document.querySelectorAll("#tabEntry .badge:not(.outline)").length, hash: location.hash }));
  w.check("the sky's tree and Entry work; its badges are the page's own (filled); the link keeps the sky and names the entry", { selected: kids, filled: "some", hash: true }, { selected: se.selected, filled: se.filled > 0 ? "some" : 0, hash: /^#sky=1505000\.50*,32\.10*,45\.20*&entry=/.test(se.hash) && se.hash.includes("entry=" + kids) });
  await p.sweep("a sky lexicon, an entry selected");
  await p.shot("93-sky-lexicon", "Opened by a #sky= link: the sky of that place and moment as the page's own lexicon.");
  await p.station("seal");
  await p.tap("#sealBtn"); await idle(p.page);
  const ss = await p.ev(() => ({ ok: window.LexiconExplorer.state.seal.ok, verdict: document.getElementById("sealVerdict").textContent, epochs: window.LexiconExplorer.state.seal.bundle.lineage.length, top: window.__M.topLevelOf(window.LexiconExplorer.state.lexicon).length, file: window.LexiconExplorer.state.seal.fileName }));
  w.check("the sky lexicon seals: every check passes, one epoch per top-level entry", { ok: true, verdict: true, epochs: ss.top, file: true }, { ok: ss.ok, verdict: ss.verdict.includes("Every check passed"), epochs: ss.epochs, file: FILE_NAME.test(ss.file || "") });
  await p.station("send"); await p.tap("#sendBtn"); await idle(p.page);
  w.check("and is sent to the four receivers", "4 of 4 handshakes in this page", (await p.ev(() => document.getElementById("sendCount").textContent)).replace(/^[^0-9]*/, ""));
  await p.sweep("a sky lexicon, sealed and sent");
  await p.ev(() => scrollTo(0, 0));
  await p.tap("#backBtn"); await sleep(200);
  w.check("Back to the Ezekiel lexicon from a sky: the reader and the seven stations are back and the link drops the sky", { origin: "builtin", stations: 7, reader: true, sky: false }, await p.ev(() => ({ origin: window.LexiconExplorer.state.lexicon.origin, stations: document.querySelectorAll("#strip button").length, reader: window.__W.shown(document.getElementById("readerBox")), sky: location.hash.includes("sky=") })));
  w.check("console clean", [], p.messages); p.focusReport("sky"); await p.close();
  p = await o("#sky=1505000.5,32.1,45.2");
  w.check("a sky at Stargazer shows the two stations Kinds of sentence and Stamp it", ["layers", "seal"], await p.ev(() => Array.from(document.querySelectorAll("#strip button")).map((b) => b.id.slice(3))));
  await p.sweep("a sky lexicon at Stargazer"); await p.close();
  // the history: a link typed in the open tab sets its lens once and is the page's own entry from then on; while a lexicon
  // from a file is on show, Back over the page's own entries does not rewrite them
  const snap = (q) => q.ev(() => { const x = window.LexiconExplorer.state; return { lens: x.lens, station: x.station, selected: x.selected, origin: x.lexicon.origin, hash: location.hash }; });
  const pick = async (q, a) => { await q.ev((x) => { window.LexiconExplorer.select(x); }, a); await settle(q.page); };
  const typed = async (q, hash) => { await q.ev((x) => { location.hash = x; }, hash); await sleep(400); await settle(q.page); };
  const back = async (q) => { await q.page.goBack(); await sleep(350); await settle(q.page); return snap(q); };
  const forward = async (q) => { await q.page.goForward(); await sleep(350); await settle(q.page); return snap(q); };
  p = await o("#lens=navigator");
  await pick(p, "26.1.1.4");
  await typed(p, "#entry=26.1.5&lens=holographer");
  let hs = await snap(p);
  w.check("a link typed in the open tab sets the lens it names", { lens: "holographer", selected: "26.1.5" }, { lens: hs.lens, selected: hs.selected });
  await pick(p, "26.1.10"); await p.lens("navigator"); await p.station("place");
  hs = await back(p);
  w.check("Back to that typed entry brings its entry back and keeps the lens and the station of now; its link then names the lens that is shown", { lens: "navigator", station: "place", selected: "26.1.5", origin: "builtin", hash: "#entry=26.1.5&lens=navigator" }, hs);
  hs = await back(p);
  w.check("Back once more, to an entry the page wrote itself: the same", { lens: "navigator", station: "place", selected: "26.1.1.4", origin: "builtin", hash: "#entry=26.1.1.4&lens=navigator" }, hs);
  await forward(p); hs = await forward(p);
  w.check("Forward twice: the last entry, at the lens of now", { lens: "navigator", selected: "26.1.10" }, { lens: hs.lens, selected: hs.selected });
  await typed(p, "#sky=2451545,10,20&lens=holographer");
  hs = await snap(p);
  w.check("a sky link typed in the open tab builds the sky and sets its lens", { lens: "holographer", origin: "page", selected: null }, { lens: hs.lens, origin: hs.origin, selected: hs.selected });
  await sleep(450);
  const typedSky = await p.ev(() => ({ status: document.getElementById("status").textContent, title: document.getElementById("skyTitle").textContent }));
  w.check("and the status line then says that sky: it begins with the sky's title, the banner's first line", { sky: true, begins: true }, { sky: /^A sky: /.test(typedSky.title) || typedSky.title, begins: typedSky.status.startsWith(typedSky.title + ".") || typedSky.status });
  const skyKid = await p.ev(() => { const M = window.__M, lx = window.LexiconExplorer.state.lexicon; return M.childrenOf(lx, lx.home)[0] || lx.addresses[0]; });
  await pick(p, skyKid); await p.lens("navigator"); await p.station("send");
  hs = await back(p);
  w.check("Back to the typed sky link: the sky with nothing chosen, at the lens and the station of now", { lens: "navigator", station: "send", selected: null, origin: "page" }, { lens: hs.lens, station: hs.station, selected: hs.selected, origin: hs.origin });
  hs = await back(p);
  w.check("Back again leaves the sky: the Ezekiel lexicon and its entry, still at the lens of now", { lens: "navigator", selected: "26.1.10", origin: "builtin" }, { lens: hs.lens, selected: hs.selected, origin: hs.origin });
  w.check("console clean", [], p.messages); p.focusReport("history"); await p.close();
  p = await o("#lens=navigator");
  await pick(p, "26.1.1.4"); await pick(p, "26.1.1.2"); await pick(p, "43.3.16");
  await loadFile(p, path.join(FILES, "invented.json"));
  await p.tap("#showItBtn"); await sleep(300); await settle(p.page);
  const b1 = await back(p), b2 = await back(p);
  w.check("while a lexicon from a file is on show, Back over the page's own entries leaves their links as they were", { origin: "outside", links: ["#entry=26.1.1.2&lens=navigator", "#entry=26.1.1.4&lens=navigator"] }, { origin: b2.origin, links: [b1.hash, b2.hash] });
  await p.ev(() => scrollTo(0, 0));
  await p.tap("#backBtn"); await sleep(250);
  hs = await forward(p);
  w.check("after Back to the Ezekiel lexicon, Forward returns to the entry that follows", { origin: "builtin", selected: "26.1.1.2", hash: "#entry=26.1.1.2&lens=navigator" }, { origin: hs.origin, selected: hs.selected, hash: hs.hash });
  hs = await forward(p);
  w.check("and Forward again to the last one", { selected: "43.3.16", hash: "#entry=43.3.16&lens=navigator" }, { selected: hs.selected, hash: hs.hash });
  w.check("console clean", [], p.messages); await p.close();
  // a reading level chosen while a lexicon from a file is on show: the entry of the history keeps its address
  p = await o("#lens=navigator");
  await pick(p, "26.1.1.4");
  await loadFile(p, path.join(FILES, "invented.json"));
  await p.tap("#showItBtn"); await sleep(300); await settle(p.page);
  await typed(p, "#entry=26.1.2&lens=holographer");
  hs = await snap(p);
  w.check("a link typed while a lexicon from a file is on show sets its lens and chooses its entry there", { lens: "holographer", selected: "26.1.2", origin: "outside", hash: "#entry=26.1.2&lens=holographer" }, { lens: hs.lens, selected: hs.selected, origin: hs.origin, hash: hs.hash });
  await p.ev(() => scrollTo(0, 0));
  await p.lens("navigator"); await sleep(150);
  hs = await snap(p);
  w.check("a reading level chosen over that lexicon is shown, and the address of the history's entry stays as it was", { lens: "navigator", selected: "26.1.2", origin: "outside", hash: "#entry=26.1.2&lens=holographer" }, { lens: hs.lens, selected: hs.selected, origin: hs.origin, hash: hs.hash });
  const lensBack = await back(p), lensForward = await forward(p);
  w.check("Back and then Forward to that entry: its address is still the one that was typed, and its entry is chosen at the level of now", { back: "#entry=26.1.1.4&lens=navigator", hash: "#entry=26.1.2&lens=holographer", selected: "26.1.2", lens: "navigator", origin: "outside" }, { back: lensBack.hash, hash: lensForward.hash, selected: lensForward.selected, lens: lensForward.lens, origin: lensForward.origin });
  w.check("console clean", [], p.messages); await p.close();
  p = await o("#sky=1505000.5,132.1,45.2");
  const bs = await p.ev(() => ({ origin: window.LexiconExplorer.state.lexicon.origin, note: window.__W.shown(document.getElementById("linkNote")) ? document.getElementById("linkNote").textContent : null }));
  w.check("a sky with a latitude out of range is ignored with a note, and Ezekiel is shown", { origin: "builtin", note: "a link value was ignored" }, bs, bs.origin === "builtin" && !!bs.note && bs.note.includes("a link value was ignored"));
  await p.close();
  // a sky link with one faulty part: the note about the link is said first and then the sky's line, in one status line
  for (const [part, note] of [["&lens=bogus", "a link value was ignored."], ["&entry=9.9", "That link names an entry this lexicon does not have."], ["&foo=1", "a link value was ignored."]]) {
    p = await o("#sky=2461360.25000,51.48,0.00" + part);
    await sleep(650);
    const said = await p.ev(() => ({ origin: window.LexiconExplorer.state.lexicon.origin, status: document.getElementById("status").textContent }));
    w.check("#sky=2461360.25000,51.48,0.00" + part + ": the sky is built, and the status line says the note and then the sky's title, each once", { origin: "page", status: note + " A sky: Greenwich, England, 15 November 2026." }, said);
    await p.close();
  }
});

// ─── S17 reduced motion ──────────────────────────────────────────────────────
section("S17", "reduced motion", async (w) => {
  const p = await fresh(w.rec, w.browser, w.base, w.vp, { reducedMotion: "reduce" });
  w.check("the page sees prefers-reduced-motion", true, await p.ev(() => matchMedia("(prefers-reduced-motion: reduce)").matches));
  await p.ev(() => { window.__flew = 0; const t = window.LexiconExplorer.tree; window.__iv = setInterval(() => { if (t.flying) window.__flew++; }, 2); });
  await p.tap('#verseBox [data-address="26.1.1.4"]');
  const j = await p.ev(() => ({ focus: window.LexiconExplorer.tree.view.focus, flying: window.LexiconExplorer.tree.flying }));
  await sleep(300);
  const flew = await p.ev(() => { clearInterval(window.__iv); return window.__flew; });
  w.check("with reduced motion a flight is a jump: the entry is at the centre at once", { focus: "26.1.1.4", flying: false, seenFlying: 0 }, { focus: j.focus, flying: j.flying, seenFlying: flew });
  await p.station("seal"); await sleep(600);
  const a = await p.ev(() => ({ raf: window.__raf, sum: window.__W.canvasSum("tree") })); await sleep(2000);
  const b = await p.ev(() => ({ raf: window.__raf, sum: window.__W.canvasSum("tree") }));
  w.check("with reduced motion and 2 s of idle: zero animation frames and unchanged canvas pixels", { frames: 0, pixels: "unchanged" }, { frames: b.raf - a.raf, pixels: a.sum === b.sum ? "unchanged" : "changed" });
  await p.lens("navigator"); await p.station("place");
  await p.tap("#flyBtn"); await sleep(120);
  const fly = await p.ev(() => ({ focus: window.LexiconExplorer.tree.view.focus, flying: window.LexiconExplorer.tree.flying, to: window.LexiconExplorer.state.place.to }));
  w.check("with reduced motion the walk along a path is a jump too", { focus: fly.to, flying: false }, { focus: fly.focus, flying: fly.flying });
  w.check("console clean", [], p.messages); p.focusReport("reduced motion"); await p.close();
});

// ─── S18 place ───────────────────────────────────────────────────────────────
section("S18", "place", async (w) => {
  await w.lens("navigator");
  await w.station("place");
  const p0 = await w.ev(() => { const M = window.__M, pl = window.LexiconExplorer.state.place, p = M.placeNumbers(M.EZEKIEL, "2D", pl.from, pl.to); return { line: document.getElementById("placeLine").textContent, sentence: p.sentence, from: pl.from, to: pl.to, steps: p.steps, straight: p.straight, fly: document.getElementById("flyBtn").textContent }; });
  w.check("Place reports the two labelled numbers in one CHECKED sentence from the model, and calls neither the distance", { sentence: p0.sentence, steps: true, straight: true, noTheDistance: true }, { sentence: p0.line.endsWith(p0.sentence) ? p0.sentence : p0.line, steps: /steps along the tree/.test(p0.line), straight: /straight distance in the chart/.test(p0.line), noTheDistance: !/\bthe distance\b/i.test(p0.line) });
  await w.openBox("stationBox");
  const kv = await w.ev(() => ({ dt: Array.from(document.querySelectorAll("#stationBody dl.kv dt")).map((x) => x.textContent), dd: Array.from(document.querySelectorAll("#stationBody dl.kv dd")).map((x) => x.textContent), path: Array.from(document.querySelectorAll("#stationBody ol li")).length }));
  w.check("the station box lists the two numbers with their labels and the path between the two entries", { dt: ["steps along the tree", "straight distance in the chart"], dd: [String(p0.steps), p0.straight.toFixed(2)], path: p0.steps + 1 }, kv);
  await w.ev(() => scrollTo(0, 0));
  await w.ev(() => { const t = window.LexiconExplorer.tree; window.__seen = []; window.__iv = setInterval(() => { const f = t.view.focus; if (window.__seen[window.__seen.length - 1] !== f) window.__seen.push(f); }, 8); });
  const t0 = Date.now();
  await w.tap("#flyBtn");
  await settle(w.page);
  const fl = await w.ev(() => { clearInterval(window.__iv); return { seen: window.__seen, focus: window.LexiconExplorer.tree.view.focus, selected: window.LexiconExplorer.state.selected }; });
  w.check("Fly along the path walks from the first entry to the second through the entries between, and ends on the second", { ends: p0.to, passed: "3 or more entries" }, { ends: fl.focus, passed: fl.seen.length >= 3 ? "3 or more entries" : fl.seen }, fl.focus === p0.to && fl.seen.length >= 3);
  w.check("the walk takes at most 3 s", "3 s or less", Date.now() - t0, Date.now() - t0 <= 3600);
  await w.shot("27-place-flown", "Station Place after flying along the path to John 3:16: the two labelled numbers.");
  await w.ev(() => { window.LexiconExplorer.select("26.1.5"); }); await settle(w.page);
  await w.openBox("stationBox");
  await w.tap("#placeFrom");
  await w.ev(() => { window.LexiconExplorer.select("100.6"); }); await settle(w.page);
  await w.tap("#placeTo");
  const p1 = await w.ev(() => { const M = window.__M, pl = window.LexiconExplorer.state.place, p = M.placeNumbers(M.EZEKIEL, "2D", pl.from, pl.to); return { from: pl.from, to: pl.to, line: document.getElementById("placeLine").textContent.endsWith(p.sentence), steps: p.steps, dd: document.querySelector("#stationBody dl.kv dd").textContent }; });
  w.check("the two ends are set from the chosen entry and the numbers follow", { from: "26.1.5", to: "100.6", line: true, dd: String(p1.steps) }, { from: p1.from, to: p1.to, line: p1.line, dd: p1.dd });
  await w.sweep("Place, its box open", { card: false });
  const gold = await w.ev(() => document.getElementById("bridge").textContent);
  if (w.phone && !(gold.includes("For God so loved the world"))) await w.tap("#bridge .fold-more");
  const gold2 = await w.ev(() => document.getElementById("bridge").textContent);
  w.check("the gold box of Place stands on John 3:16 and John 3:13 as TEXT in King James, and states the reading in its own voice", true, /God so loved the world/.test(gold2) && /John 3:16, King James Version/.test(gold2) && /John 3:13, King James Version/.test(gold2) && gold2.includes("love from its source to the world"));
  w.focusReport("place");
});


// ─── the small windows: no sideways scrolling anywhere ───────────────────────
async function smallWindows(rec, browser, base) {
  for (const [name, viewport, touch] of [["720x450", { width: 720, height: 450 }, false], ["320x256", { width: 320, height: 256 }, true]]) {
    const vp = { name, phone: touch, opts: touch ? { viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport, deviceScaleFactor: 2 } };
    rec.at(name, "small window");
    const w = await fresh(rec, browser, base, vp);
    try {
      const over = async (label) => { const o = await w.ev(() => window.__W.overflow()); w.check(label + ": no horizontal overflow", "0 or less", o.over, o.over <= 0 || (console.log("       " + JSON.stringify(o.who)), false)); };
      const head = await w.ev(() => ({ position: getComputedStyle(document.querySelector("header")).position, entry: document.getElementById("entryTitle").textContent }));
      w.check("the page opens and the header is not sticky", { position: "not sticky", entry: "Tap a shining word" }, { position: head.position === "sticky" || head.position === "fixed" ? head.position : "not sticky", entry: head.entry });
      await over("first screen");
      await w.shot("01-first-screen", "The first screen in a window of " + name + ".");
      const t = await w.ev(() => window.__W.text());
      w.check("first screen: visible text is 17 or 14 px", [], t.bad);
      await w.tap('#verseBox [data-address="26.1.1.4"]'); await settle(w.page);
      w.check("a term of the open verse selects its entry", "26.1.1.4", await state(w.page, "selected"));
      await over("an entry selected");
      await w.lens("navigator");
      await w.station("seal"); await w.tap("#sealBtn"); await idle(w.page);
      await w.station("send"); await w.tap("#sendBtn"); await idle(w.page);
      w.check("sealed and sent in this window", { seal: true, send: 4 }, await w.ev(() => ({ seal: window.LexiconExplorer.state.seal.ok, send: window.LexiconExplorer.state.send.k })));
      for (const lens of ["stargazer", "navigator", "holographer"]) {
        await w.lens(lens);
        const stations = await w.ev(() => Array.from(document.querySelectorAll("#strip button")).map((b) => b.id.slice(3)));
        for (const key of stations) {
          await w.station(key);
          await w.ev(() => { for (const d of document.querySelectorAll("main details")) d.open = true; }); await sleep(120);
          await over(lens + ", station " + key + ", every box open");
        }
        if (lens !== "stargazer") for (const tab of ["wheel", "chain", "overwatch", "witnesses", "entry"]) { await w.tap("#tabBtn-" + tab); await sleep(60); await over(lens + ", tab " + tab); }
        const t2 = await w.ev(() => window.__W.text());
        w.check(lens + ", every box open: visible text is 17 or 14 px (13 px only in the hash class)", [], t2.bad);
      }
      const wheel = await w.ev(() => { const c = document.getElementById("wheelCanvas"); return c ? { w: Math.round(c.getBoundingClientRect().width), label: c.getAttribute("aria-label") } : null; });
      await w.tap("#tabBtn-wheel");
      const wh = await w.ev(() => { const c = document.getElementById("wheelCanvas"); return { w: Math.round(c.getBoundingClientRect().width), label: c.getAttribute("aria-label"), grid: document.querySelectorAll("#wheelBlock .bitgrid button").length }; });
      w.check("the wheel is at least 300 px across, or it is replaced by the 8 x 8 square; the grid of 64 buttons is there", "300 px or the square", wh, (wh.w >= 300 || wh.label === "The same word as a square, 8 by 8") && wh.grid === 64);
      void wheel;
      await w.ev(() => document.getElementById("explain").scrollIntoView());
      await w.shot("02-wheel-tab", "The Wheel tab in a window of " + name + ".");
      await w.ev(() => scrollTo(0, 0));
      await w.tap("#aboutBtn"); await sleep(150);
      const d = await w.ev(() => { const dl = document.getElementById("about"), c = dl.querySelector("button").getBoundingClientRect(), r = dl.getBoundingClientRect(); return { open: dl.open, top: dl.scrollTop, close: c.top >= 0 && c.bottom <= innerHeight && c.right <= innerWidth, fits: r.right <= innerWidth + 0.5 && r.left >= -0.5 }; });
      w.check("the dialog opens at scroll position 0 with Close visible, inside the window", { open: true, top: 0, close: true, fits: true }, d);
      await over("dialog open");
      await w.shot("03-dialog", "The dialog in a window of " + name + ".");
      await w.page.keyboard.press("Escape"); await sleep(100);
      await w.openBox("loadBox");
      await w.page.setInputFiles("#loadInput", path.join(FILES, "invented.json"));
      await w.page.waitForFunction(() => document.getElementById("showItBtn"), null, { timeout: 60000 });
      await w.tap("#showItBtn"); await sleep(250);
      await w.ev(() => { window.LexiconExplorer.select("26.1.1.1"); for (const d2 of document.querySelectorAll("main details")) d2.open = true; }); await settle(w.page);
      await over("an outside lexicon with a 120-letter word and a right-to-left name");
      await w.shot("04-outside", "An outside lexicon with a long unbroken word in a window of " + name + ".");
      w.focusReport("small window");
      w.check("console clean", [], w.messages);
    } catch (e) { rec.check("the part ran to its end", "no error", String((e && e.stack) || e), false); }
    await w.close();
  }
  // 320 x 568, the map as a ball: the names that are always kept (the centred entry, the author's notes on the root view) are drawn
  // even where every place for them touches a marker
  const vp = { name: "320x568", phone: true, opts: { viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } };
  rec.at(vp.name, "small window, the map as a ball");
  const w = await fresh(rec, browser, base, vp);
  try {
    await w.lens("navigator");
    await w.tap("#dimsBtn"); await sleep(300);
    const named = async (a) => { await w.ev((x) => { const X = window.LexiconExplorer; X.tree.stop(); X.tree.jumpTo(x); scrollTo(0, 0); }, a); await sleep(300); return w.ev(() => window.LexiconExplorer.tree.labels().map((l) => l.address)); };
    w.check("the 2D/3D button switches to the ball", "3D", await state(w.page, "dims"));
    w.check("the whole lexicon at the centre: the author's notes (100) keep their label", true, (await named("")).includes("100"));
    for (const a of ["26.1", "100"]) w.check("entry " + a + " at the centre has its name on the map", true, (await named(a)).includes(a));
    w.focusReport("the map as a ball");
    w.check("console clean", [], w.messages);
  } catch (e) { rec.check("the part ran to its end", "no error", String((e && e.stack) || e), false); }
  await w.close();
}

// ─── fonts aborted: the one console message allowed ──────────────────────────
async function fontsAborted(rec, browser, base) {
  for (const key of ["phone", "desk"]) {
    const vp = L.VIEWPORTS[key];
    rec.at(vp.name, "fonts aborted");
    const w = await fresh(rec, browser, base, vp, { fonts: "abort" });
    try {
      await w.tap('#verseBox [data-address="26.1.1.4"]'); await settle(w.page);
      await w.tap("#nextBtn"); await sleep(200);
      w.check("with the font hosts aborted the page works: the first minute runs", { station: "count", marks: 5 }, await w.ev(() => ({ station: window.LexiconExplorer.state.station, marks: document.querySelectorAll("#reader mark").length })));
      await w.sweep("fonts aborted, Count");
      w.check("the only console message is the stylesheet's load error", "one message, about the fonts stylesheet", w.messages, w.messages.length === 1 && /fonts\.googleapis\.com/.test(w.messages[0]) && /^error: Failed to load resource/.test(w.messages[0]));
      w.focusReport("fonts aborted");
    } catch (e) { rec.check("the part ran to its end", "no error", String((e && e.stack) || e), false); }
    await w.close();
  }
}

// ─── S19 finding the way: the author's notes, John 3:16, the pointers of lines 5, 6, 9 and 10, the ways out ───
section("S19", "finding the way: the notes, John 3:16, pointers, links out", async (w) => {
  const sel = () => state(w.page, "selected"), linkFile = (href) => fs.existsSync(path.join(ROOT, WING, "Lexicon_Explorer", href.split("#")[0]));
  // the card shown while nothing is chosen: where the author's ten lines are
  const inv = await w.ev(() => ({ text: document.getElementById("notesInvite").textContent, legendFirst: document.getElementById("entryLegend").getBoundingClientRect().top < document.getElementById("notesInvite").getBoundingClientRect().top, quotes: /[“”"]/.test(document.getElementById("notesInvite").textContent) }));
  w.check("first screen: the empty card says where the author's ten lines are, with one button and no quotation", { text: true, quotes: false }, { text: inv.text.includes("The author wrote ten lines under this passage.") && inv.text.endsWith("Open the author's notes") || inv.text, quotes: inv.quotes });
  if (w.phone) w.check("under 700 px a button to the author's notes stands beside the card's title, on the first screen, and names the number of the lines", { label: "The author's ten lines", onFirstScreen: true }, await w.ev(() => { const b = document.getElementById("notesBtnTop"), r = b.getBoundingClientRect(); return { label: b.textContent, onFirstScreen: window.__W.shown(b) && r.bottom + scrollY < 844 }; }));
  if (!w.phone) w.check("at 1440 x 900 the sentence and its button are on the first screen", "above 900", await w.ev(() => Math.round(document.getElementById("notesBtn").getBoundingClientRect().bottom)), (await w.ev(() => document.getElementById("notesBtn").getBoundingClientRect().bottom)) < 900);
  // Stargazer is told what the Navigator level adds
  const lv = await w.ev(() => ({ wide: window.__W.shown(document.getElementById("levels")), text: document.getElementById("levels").textContent }));
  if (w.phone) w.check("under 700 px the line about the Navigator level is not above the map", false, lv.wide);
  else w.check("beside the station strip: what the Navigator level adds, with its button", MORE_LEVELS + " Switch to Navigator", lv.text);
  await w.shot("70-first-screen-notes-and-levels", "First screen at Stargazer: the sentence and button for the author's notes in the card; from 700 px the line about the Navigator level beside the strip.");
  await w.tap(w.phone ? "#notesBtnTop" : "#notesBtn"); await settle(w.page);
  w.check("Open the author's notes selects entry 100, which lists the ten lines", { selected: "100", lines: 10 }, { selected: await sel(), lines: await w.ev(() => document.querySelectorAll('#tabEntry [data-key^="row-100."]').length) }, (await sel()) === "100" && (await w.ev(() => document.querySelectorAll('#tabEntry [data-key^="row-100."]').length)) >= 10);
  w.check("ten is the number of quoted lines the card then shows", 10, await w.ev(() => document.querySelectorAll("#tabEntry blockquote").length));
  // the opening gold box leads to John 3:16 and to First Explorers
  await w.ev(() => scrollTo(0, 0));
  await w.station("read");
  const fe = await w.ev(() => { const a = document.querySelector('#bridge a[data-key="bridge-link"]'); return a ? { href: a.getAttribute("href"), label: a.textContent } : null; });
  w.check("the opening gold box links to First Explorers (a file that exists)", { href: "../First_Explorers/index.html", label: "Open First Explorers", exists: true }, fe && { ...fe, exists: linkFile(fe.href) });
  await w.tap("#bridgeGo"); await settle(w.page);
  const jb = async () => w.ev(() => ({ first: document.getElementById("bridgeFirst").textContent, all: document.getElementById("bridge").textContent, fly: (document.getElementById("bridgeFly") || {}).textContent, go: !!document.getElementById("bridgeGo"), from: Array.from(document.querySelectorAll("#entryFrom button")).map((b) => b.textContent), title: document.getElementById("entryTitle").textContent }));
  let j = await jb();
  w.check("Go to John 3:16 selects 43.3.16; the gold box is the John 3:16 box in Stargazer words, with Fly here from the river", { selected: "43.3.16", title: "John 3:16", reading: true, another: true, fly: "Fly here from the river", go: false }, { selected: await sel(), title: j.title, reading: j.all.includes(JOHN_STAR.split(". ")[0]) && j.all.includes("It is love from its source to the world."), another: j.all.includes("You may see it another way."), fly: j.fly, go: j.go });
  w.check("the Entry of John 3:16 has Go-to buttons for the author's line 3 and the outline", ["Go to Line 3", "Go to One outline: John 3:16 as three numbers"], j.from);
  await w.sweep("John 3:16 chosen, Stargazer");
  await w.shot("71-john-316-gold-box", "John 3:16 chosen at Stargazer: the Entry with Go to Line 3 and the outline, and the John 3:16 gold box with Fly here from the river.");
  await w.ev(() => { const t = window.LexiconExplorer.tree; window.__seen = []; window.__iv = setInterval(() => { const f = t.view.focus; if (window.__seen[window.__seen.length - 1] !== f) window.__seen.push(f); }, 8); });
  await w.tap("#bridgeFly"); await sleep(120); await settle(w.page);
  const fl = await w.ev(() => { clearInterval(window.__iv); return { seen: window.__seen, focus: window.LexiconExplorer.tree.view.focus }; });
  w.check("Fly here from the river walks the tree from the river entry (26.1.1.4) and ends on John 3:16", { starts: true, ends: "43.3.16", passed: "3 or more entries" }, { starts: fl.seen.includes("26.1.1.4"), ends: fl.focus, passed: fl.seen.length >= 3 ? "3 or more entries" : fl.seen });
  for (const lens of ["navigator", "holographer"]) {
    await w.lens(lens); await sleep(150); j = await jb();
    w.check(lens + ": with John 3:16 chosen the gold box is still the John 3:16 box, at whatever station", { reading: true, fly: "Fly here from the river" }, { reading: j.all.includes("We read John 3:16 as the bridge stated in the Gospel's own words"), fly: j.fly });
  }
  await w.tap('[data-key="from-100.3"]'); await settle(w.page);
  w.check("Go to Line 3 selects the author's line 3, and the gold box is the station's own again", { selected: "100.3", john: false }, { selected: await sel(), john: await w.ev(() => !!document.getElementById("bridgeFly")) });
  // pointers: each closing sentence that names a place has a button that opens it (Navigator)
  await w.lens("navigator");
  const open = async (line, key) => { await w.ev((a) => { window.LexiconExplorer.select(a); }, line); await settle(w.page); await w.tap('[data-key="' + key + '"]'); await sleep(250); await settle(w.page); await still(w); return w.ev(() => ({ station: window.LexiconExplorer.state.station, tab: window.LexiconExplorer.state.tab, focus: (document.activeElement || {}).id || "", box: document.getElementById("stationBox").open })); };
  w.check("Line 6, Hide a corner and see: the button opens station 7 at the mirror word and puts the focus on its heading", { station: "fourth", focus: "fig-b", box: true }, await open("100.6", "ptr-100.6.9").then((x) => ({ station: x.station, focus: x.focus, box: x.box })));
  const figureSeen = (id) => w.ev((i) => { const c = document.getElementById(i).closest("section").querySelector("canvas").getBoundingClientRect(); return c.top < innerHeight - 100 && c.bottom > 0; }, id);
  w.check("the heading of the figure is at the top of the window (below the header where that stays), with the figure under it in the window", { heading: "at the top", figure: true }, { heading: await atTop(w, "fig-b"), figure: await figureSeen("fig-b") });
  w.check("Line 6, Try three points of your own: station 7 at the three squared distances", { station: "fourth", focus: "fig-a" }, await open("100.6", "ptr-100.6.8").then((x) => ({ station: x.station, focus: x.focus })));
  w.check("that heading is at the top of the window too, the first figure of the station under it", { heading: "at the top", figure: true }, { heading: await atTop(w, "fig-a"), figure: await figureSeen("fig-a") });
  w.check("Line 6, the squares: station 7 at its fourth figure, its heading at the top of the window", { station: "fourth", focus: "fig-d", heading: "at the top" }, await open("100.6", "ptr-100.6.12").then(async (x) => ({ station: x.station, focus: x.focus, heading: await atTop(w, "fig-d") })));
  await w.tap("#goLine6"); await settle(w.page);
  w.check("station 7 has a Go-to button to Line 6", "100.6", await sel());
  w.check("Line 5, Press Seal and watch: the Seal station", "seal", (await open("100.5", "ptr-100.5.4")).station);
  w.check("Line 10, Count the slices of the wheel: the Wheel tab", "wheel", (await open("100.10", "ptr-100.10.7")).tab);
  await w.tap("#tabBtn-entry");
  await w.ev(() => { window.LexiconExplorer.select("100.9"); }); await settle(w.page);
  const lab = await w.ev(() => { const a = document.querySelector('a[data-key="ptr-100.9.5"]'); return a ? { href: a.getAttribute("href"), label: a.textContent } : null; });
  w.check("Line 9, Try it in the lab: a link to the sky page's lab (a file that exists)", { href: "../Celestial_Control_Panel/index.html#lab=square&lens=navigator", label: "Try it in the lab", exists: true }, lab && { ...lab, exists: linkFile(lab.href) });
  w.check("Line 9, Open the three and see: three Go-to buttons", ["Go to Ezekiel 1:9", "Go to Ezekiel 1:12 (context)", "Go to Ezekiel 1:17 (context)"], await w.ev(() => Array.from(document.querySelectorAll('[data-key^="ptr-100.9.4-"]')).map((b) => b.textContent)));
  await w.sweep("Line 9 at Navigator, with its pointer buttons");
  // the Send station's gold box: Open the sky page is a link
  await w.station("send"); await w.ev(() => { const m = document.querySelector("#bridge .fold-more"); if (m && m.getAttribute("aria-expanded") === "false" && window.__W.shown(m)) m.click(); });
  const sky = await w.ev(() => { const a = document.querySelector('#bridge a[data-key="stand-link"]'); return a ? { href: a.getAttribute("href"), label: a.textContent } : null; });
  w.check("the Send gold box: Open the sky page is a link (a file that exists)", { href: "../Celestial_Control_Panel/index.html#lens=navigator", label: "Open the sky page", exists: true }, sky && { ...sky, exists: linkFile(sky.href) });
  // Stargazer: lines 5 and 6 open the mirror word inside Stamp it; a pointer to a figure Stargazer does not have is not shown
  await w.lens("stargazer");
  await w.ev(() => { window.LexiconExplorer.select("100.6"); }); await settle(w.page);
  const st6 = await w.ev(() => ({ act: (document.querySelector('#tabEntry [data-key="act-pointer"]') || {}).textContent, others: Array.from(document.querySelectorAll('#tabEntry [data-key^="ptr-"]')).map((b) => b.getAttribute("data-key")) }));
  w.check("Stargazer, Line 6: one button to the mirror word; no button to a figure this lens does not have", { act: "See three corners give the fourth", none: true }, { act: st6.act, none: !st6.others.includes("ptr-100.6.8") && !st6.others.includes("ptr-100.6.12") });
  await w.tap('#tabEntry [data-key="act-pointer"]'); await sleep(300);
  const mb = await w.ev(() => ({ station: window.LexiconExplorer.state.station, open: document.getElementById("mirrorBox").open, focus: (document.activeElement || {}).id, cap: document.getElementById("mirrorCap").textContent, say: document.querySelector("#mirrorBox .more-body p").textContent, canvas: window.__W.canvasSum("mirrorCanvas") !== "none" }));
  w.check("it opens Stamp it with the mirror word's box open and the focus on its name; the picture is drawn, with its Stargazer caption", { station: "seal", open: true, focus: "mirrorSum", cap: "All four corners are shown. Each one is a mirror picture of the others.", say: true, canvas: true }, { ...mb, say: mb.say.endsWith("Built: four lights in one corner fill all 64 by mirrors. Hide the last corner. The other three give it back.") });
  await w.tap("#mirrorHide"); await sleep(120);
  w.check("Hide the fourth corner: the caption says the picture shows what the other three give", "The last corner is hidden. The picture shows what the other three corners give.", await w.ev(() => document.getElementById("mirrorCap").textContent));
  await w.ev(() => document.getElementById("mirrorBox").scrollIntoView({ block: "center" })); await sleep(150);
  await w.shot("72-stargazer-mirror-word-in-stamp-it", "Stargazer, Stamp it: the closed box Three corners give the fourth opened from Line 6, the fourth corner hidden.");
  await w.tap("#mirrorHide");
  if (w.phone) {
    const lb = await w.ev(() => { const e = document.getElementById("levelsBox"); return { shown: window.__W.shown(e), text: e.textContent, inBox: !!e.closest("details"), next: (e.nextElementSibling || {}).id }; });
    w.check("under 700 px the line about the Navigator level stands directly before the station's box at Stamp it, inside no box that must be opened", { shown: true, text: MORE_LEVELS + " Switch to Navigator", inBox: false, next: "stationBox" }, lb);
    const met = [];
    for (const st of STAR_STATIONS) { await w.station(st); met.push(await w.ev(() => window.__W.shown(document.getElementById("levelsBox")) && document.getElementById("levelsBox").getBoundingClientRect().top > document.getElementById("explain").getBoundingClientRect().bottom)); }
    w.check("it is there at each of the four Stargazer stations, below the card", [true, true, true, true], met);
    await w.station("seal");
    await w.tap("#levelsBtnBox");
  } else { await w.ev(() => scrollTo(0, 0)); await sleep(80); await w.tap("#levelsBtn"); }
  await sleep(200);
  w.check("Switch to Navigator switches the lens; the focus is not lost", { lens: "navigator", focus: true }, { lens: await state(w.page, "lens"), focus: (await w.ev(() => window.__W.focus())) !== "body" });
  await still(w);
  if (w.phone) {
    w.check("390 x 844: the station strip is brought into view, and the station button that has the focus lies inside the window", { focus: "st-read", inWindow: true }, await focusPlace(w));
    w.check("320 x 568, the button pressed with the keyboard: the same", { lens: "navigator", focus: "st-read", inWindow: true, console: [] }, await switchInWindow(w, { width: 320, height: 568 }, "", "seal"));
  } else {
    w.check("1440 x 900: the button stands beside the strip, the focus goes to the first station button and nothing is scrolled", { focus: "st-read", inWindow: true, scrollY: 0 }, { ...(await focusPlace(w)), scrollY: await w.ev(() => Math.round(scrollY)) });
    w.check("699 x 900, the button pressed with the keyboard: the station strip is brought into view, and the station button that has the focus lies inside the window", { lens: "navigator", focus: "st-read", inWindow: true, console: [] }, await switchInWindow(w, { width: 699, height: 900 }, "", "seal"));
    w.check("1099 x 600, the button pressed with the keyboard: from 700 px wide nothing is scrolled", { lens: "navigator", focus: "st-read", scrollY: 0, console: [] }, await switchInWindow(w, { width: 1099, height: 600 }, "", "seal", true));
  }
  // the dialog's other pages, and the wing link of the header
  await w.ev(() => scrollTo(0, 0));
  await w.tap("#aboutBtn"); await sleep(150);
  const pages = await w.ev(() => Array.from(document.querySelectorAll("#aboutPages a")).map((a) => [a.textContent, a.getAttribute("href")]));
  w.check("the dialog ends with Other pages: First Explorers, Celestial Control Panel, Experimental Systems", [["First Explorers", "../First_Explorers/index.html"], ["Celestial Control Panel", "../Celestial_Control_Panel/index.html"], ["Experimental Systems", "../index.html"]], pages);
  w.check("each of the three is a file that exists", [true, true, true], pages.map((p) => linkFile(p[1])));
  await w.ev(() => document.getElementById("aboutPages").scrollIntoView()); await sleep(100);
  await w.shot("73-dialog-other-pages", "The dialog What is real here?, scrolled to its last section: Other pages.");
  await w.key("Escape", "Escape in the dialog");
  if (!w.phone) w.check("the header has a link to the wing index", { href: "../index.html", label: "Experimental Systems", shown: true }, await w.ev(() => { const a = document.getElementById("wingLink"); return { href: a.getAttribute("href"), label: a.textContent, shown: window.__W.shown(a) }; }));
  w.focusReport("S19");
});

// ─── S20 layout, the list, the banner that stays, a sky from a link ───
section("S20", "layout, list choice, sticky banner, a sky from a link", async (w) => {
  const box = (id) => w.ev((i) => { const r = document.getElementById(i).getBoundingClientRect(); return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY), left: Math.round(r.left), right: Math.round(r.right) }; }, id);
  const titleInView = () => w.ev(() => { const t = document.getElementById("entryTitle").getBoundingClientRect(), wrap = document.getElementById("topWrap"), stuck = getComputedStyle(wrap).position === "sticky"; const top = stuck ? wrap.getBoundingClientRect().bottom : window.__W.shown(document.getElementById("banner")) ? document.getElementById("banner").getBoundingClientRect().bottom : 0; return t.top >= top - 1 && t.bottom <= innerHeight ? "in the window" : "top " + Math.round(t.top) + " (edge " + Math.round(top) + ")"; });
  if (!w.phone) {
    const say = await box("say"), bridge = await box("bridge"), stage = await box("stage"), nav = await box("navRow"), more = await box("more"), under = await box("under"), strip = await box("stripNav"), card = await box("explain");
    w.check("1440 x 900: the strip spans the three columns", "from the left column to the right one", strip, strip.left <= say.left && strip.right >= card.right - 1);
    w.check("the gold box sits in the first column directly under STRIX's panel", "same column, 14 px or less below", { say, bridge }, bridge.left === say.left && bridge.top - say.bottom >= 0 && bridge.top - say.bottom <= 14);
    w.check("Home, Up and the list start directly below the map, on the first screen", "nav row 14 px or less below the map and above y = 868", { stage: stage.bottom, nav: nav.top }, nav.top - stage.bottom >= 0 && nav.top - stage.bottom <= 14 && nav.top <= 868);
    w.check("the tall boxes of the first column come after the gold box, beside the list", "below the gold box, left of the list", { more, under }, more.top >= bridge.bottom && more.left === say.left && under.left > more.right - 1 && Math.abs(more.top - under.top) <= 2);
    w.check("the gold box does not push the list down: it fills its row and scrolls by itself", "its own scroll", await w.ev(() => { const b = document.getElementById("bridge"); return { overflow: getComputedStyle(b).overflowY, scrolls: b.scrollHeight > b.clientHeight }; }), await w.ev(() => getComputedStyle(document.getElementById("bridge")).overflowY === "auto"));
    await w.ev(() => scrollTo(0, 500)); await sleep(120);
    w.check("the card stays in view while the page scrolls (sticky, under the header)", "top between the header and y = 140", await w.ev(() => Math.round(document.getElementById("explain").getBoundingClientRect().top)), await w.ev(() => { const t = document.getElementById("explain").getBoundingClientRect().top, hd = document.getElementById("topWrap").getBoundingClientRect().bottom; return t >= hd && t <= 140; }));
    for (const width of [1100, 1180, 1280]) {
      const n = await fresh(w.rec, w.browser, w.base, w.vp, { viewport: { width, height: 900 } });
      const t = await n.ev(async () => { scrollTo(0, 600); await new Promise((r) => requestAnimationFrame(r)); const v = { header: Math.round(document.getElementById("topWrap").getBoundingClientRect().bottom), card: Math.round(document.getElementById("explain").getBoundingClientRect().top), over: window.__W.overflow().over }; scrollTo(0, 0); return v; });
      n.check(width + " x 900, scrolled: the card stops below the header, and nothing overflows sideways", "card top at or below the header's bottom", t, t.card >= t.header && t.over <= 0);
      await n.close();
    }
    await w.shot("74-layout-scrolled", "1440 x 900 scrolled by 500 px: the list directly under the map, the passage beside it, the card still in view on the right.");
    await w.ev(() => scrollTo(0, 0));
    await w.lens("navigator"); await sleep(150);
    const names = await w.ev(() => Array.from(document.querySelectorAll("#strip button .st-name")).filter((n) => window.__W.shown(n) && n.getBoundingClientRect().width > 8).map((n) => n.textContent));
    w.check("Navigator at 1440 x 900: all seven stations show their names", ["Read", "Count", "Place", "Layers", "Seal", "Send", "The fourth square"], names);
    await w.shot("75-seven-stations-named", "Navigator at 1440 x 900: the station strip across the page with all seven names.");
    await w.lens("stargazer");
  } else {
    const names = await w.ev(() => { document.querySelector('[data-lens="navigator"]').click(); return 0; }); await sleep(200);
    w.check("under 700 px seven stations still show numbers, and the open one its name", 1, await w.ev(() => Array.from(document.querySelectorAll("#strip button .st-name")).filter((n) => n.getBoundingClientRect().width > 8).length));
    await w.lens("stargazer");
  }
  // a choice made in the list brings the card into view; the focus stays on the list
  await w.openBox("listBox");
  await w.tap('[id="e-"]'); await settle(w.page); await sleep(700);
  w.check("after choosing The whole lexicon in the list the card's title is inside the window", "in the window", await titleInView());
  await w.tap('[id="e-100"]'); await settle(w.page); await sleep(700);
  const after = await w.ev(() => ({ selected: window.LexiconExplorer.state.selected, focus: (document.activeElement || {}).id, status: document.getElementById("status").textContent, title: document.getElementById("entryTitle").textContent }));
  w.check("after choosing The author's notes in the list the card's title is inside the window", "in the window", await titleInView());
  w.check("the choice is made, the status line says it, and the focus stays on the list item", { selected: "100", focus: "e-100", status: "The author's notes. 11 things under it.", title: "The author's notes" }, after);
  await w.shot("76-after-list-choice", "After choosing The author's notes in the list: the card with its title is in the window.");
  // the list as a tree: expanded states and the key help
  await w.ev(() => { window.LexiconExplorer.select("26.1.1"); }); await settle(w.page);
  const tree = await w.ev(() => ({ expanded: Array.from(document.querySelectorAll("#list [role=treeitem]")).filter((b) => b.hasAttribute("aria-expanded")).map((b) => b.getAttribute("data-address") + ":" + b.getAttribute("aria-expanded")), described: document.getElementById("list").getAttribute("aria-describedby"), help: document.getElementById("listKeys").textContent }));
  w.check("the centred item and what stands above it carry aria-expanded; the children do not", [":true", "26:true", "26.1:true", "26.1.1:true"], tree.expanded);
  w.check("the list's description says what the arrow keys do (Stargazer words: thing)", { described: "listKeys", help: true }, { described: tree.described, help: /Up and Down: the thing before/.test(tree.help) && /Left: the thing above/.test(tree.help) || tree.help });
  // a lexicon from a file: the banner stays in view at every scroll position
  await w.ev(() => scrollTo(0, 0));
  await w.lens("navigator");
  await loadFile(w, path.join(FILES, "invented.json"));
  await w.tap("#showItBtn"); await sleep(300); await settle(w.page);
  await w.ev(() => { const l = window.LexiconExplorer.state.lexicon; window.LexiconExplorer.select(l.addresses[l.addresses.length - 1]); }); await settle(w.page);
  const blind = await w.ev(async () => {
    const max = document.documentElement.scrollHeight - innerHeight, rows = []; const wrap = document.getElementById("topWrap"), stuck = getComputedStyle(wrap).position === "sticky", hd = document.querySelector("header");
    for (let y = 0; y <= max + 49; y += 50) { scrollTo(0, Math.min(y, max)); await new Promise((r) => requestAnimationFrame(r));
      const p = Array.from(document.querySelectorAll("#banner p")).find((x) => window.__W.shown(x)), r = p ? p.getBoundingClientRect() : null, b = document.querySelector("#banner #backBtn").getBoundingClientRect(), edge = stuck ? hd.getBoundingClientRect().bottom : 0;
      const sender = Array.from(document.querySelectorAll(".outside")).some((e) => { const q = e.getBoundingClientRect(); return q.height > 0 && q.bottom > 0 && q.top < innerHeight; });
      rows.push({ y: Math.min(y, max), seen: !!r && r.top >= edge - 1 && r.bottom <= innerHeight && b.top >= edge - 1 && b.bottom <= innerHeight, sender }); }
    scrollTo(0, 0); return { n: rows.length, blind: rows.filter((x) => x.sender && !x.seen).map((x) => x.y), max };
  });
  w.check("a lexicon from a file: at every scroll position (step 50) that shows sender text, the banner's sentence and its Back button are in the window", [], blind.blind);
  w.check("the banner is opaque", "an opaque colour", await w.ev(() => getComputedStyle(document.getElementById("banner")).backgroundColor), /^rgb\(/.test(await w.ev(() => getComputedStyle(document.getElementById("banner")).backgroundColor)));
  if (w.phone) w.check("under 700 px the banner is one line and the whole notice stands once in the page", { short: OUTSIDE_SHORT, whole: OUTSIDE_NOTICE }, await w.ev(() => ({ short: document.getElementById("bannerShort").textContent, whole: window.__W.shown(document.getElementById("outsideNotice")) ? document.getElementById("outsideNotice").textContent : null })));
  await w.sweep("an outside lexicon under the banner that stays");
  await w.ev((y) => scrollTo(0, y), Math.round(blind.max * 0.6)); await sleep(150);
  await w.shot("77-outside-banner-stays", "A lexicon from a file, the page scrolled: the banner Not made by this page with Back still at the top.");
  await w.ev(() => scrollTo(0, 0));
  await w.tap("#backBtn"); await sleep(300);
  w.check("Back in the banner brings the Ezekiel lexicon back and the banner goes", { origin: "builtin", banner: false }, await w.ev(() => ({ origin: window.LexiconExplorer.state.lexicon.origin, banner: window.__W.shown(document.getElementById("banner")) })));
  w.focusReport("S20");
  // a sky from a link: what it is, what to do, the way to the sky page with the same place and time; the name after stamping
  const p = await fresh(w.rec, w.browser, w.base, w.vp, { hash: "#sky=2461360.25000,51.48,0.00&lens=stargazer" });
  const sb = await p.ev(() => ({ title: document.getElementById("skyTitle").textContent, notice: document.getElementById("skyNotice").textContent, where: window.__W.shown(document.getElementById("skyNotice")) ? "banner" : "box", back: !!document.querySelector("#skyBanner #backBtn"), href: document.getElementById("skyPageLink").getAttribute("href"), label: document.getElementById("skyPageLink").getAttribute("aria-label"), top: window.__W.shown(document.getElementById("banner")) }));
  p.check("a #sky= link: the banner names the sky, says it was built from a link and what to do, and never says who stamped it", { title: "A sky: Greenwich, England, 15 November 2026", notice: SKY_BANNER, where: "banner", back: true, you: false, top: false }, { title: sb.title, notice: sb.notice, where: sb.where, back: sb.back, you: /\byou\b/i.test(sb.notice), top: sb.top });
  p.check("Open the Celestial Control Panel carries the same place and time in that page's own keys, and no stamp or name", { href: "../Celestial_Control_Panel/index.html#jd=2461360.25000&lat=51.48&lon=0.00&lens=stargazer", label: "Open the Celestial Control Panel", exists: true }, { href: sb.href, label: sb.label, exists: fs.existsSync(path.join(ROOT, WING, "Celestial_Control_Panel/index.html")) });
  await sleep(450);
  const arrive = await p.ev(() => ({ status: document.getElementById("status").textContent, focus: window.__W.focus(), title: document.title, y: scrollY }));
  p.check("arriving by a #sky= link: the sky's title is said once in the status line, the focus is not moved, and the document's title names the sky", { status: "A sky: Greenwich, England, 15 November 2026.", focus: "body", title: "Lexicon Explorer · A sky: Greenwich, England, 15 November 2026", y: 0 }, arrive);
  const skyLevels = () => p.ev(() => { const e = document.getElementById(innerWidth < 700 ? "levelsBox" : "levels"); return { shown: window.__W.shown(e), text: e.textContent, inBox: !!e.closest("details") }; });
  p.check("a sky at Stargazer is told what the Navigator level adds: the first sentence alone (a sky has no path to John 3:16 and no fourth square), with the button", { shown: true, text: SKY_LEVELS + " Switch to Navigator", inBox: false }, await skyLevels());
  await p.sweep("a sky from a link, Stargazer, as it arrives");
  await p.shot("78-sky-from-a-link", "A sky opened by a #sky= link at Stargazer: the banner with Stamp it here, Back to Ezekiel and the link to the Celestial Control Panel.");
  await p.station("seal"); await p.tap("#sealBtn"); await idle(p.page);
  const name = await p.ev(() => ({ line: document.getElementById("sealChain").textContent, hash: location.hash, href: document.getElementById("skyPageLink").getAttribute("href") }));
  p.check("after stamping the name stands under the verdict; it is in no link", { line: true, inLinks: false }, { line: /^The name of this stamp: BC-[0-9a-f]{24}$/.test(name.line) || name.line, inLinks: /BC-/.test(name.hash + name.href) });
  await p.sweep("a sky from a link, stamped");
  for (const lens of ["navigator", "holographer"]) { await p.lens(lens); for (const st of ["place", "layers", "seal", "send"]) { await p.station(st); await p.sweep("a sky, " + lens + ", " + st); } }
  await p.station("layers"); await sleep(150);
  const moved = await p.ev(() => ({ banner: window.__W.shown(document.getElementById("skyNotice")), box: !document.getElementById("skyNoticeBox").hidden, text: document.getElementById("skyNoticeBox").textContent }));
  if (p.phone) p.check("under 700 px, where the banner's sentences would push the card off the first screen, they stand as the first line of the station's box", { banner: false, box: true, text: SKY_BANNER }, moved);
  await p.lens("stargazer"); await p.station("seal");
  p.check("the line is there at the sky's Stamp it station too", { shown: true, text: SKY_LEVELS + " Switch to Navigator", inBox: false }, await skyLevels());
  await p.tap(p.phone ? "#levelsBtnBox" : "#levelsBtn"); await sleep(200);
  p.check("its button switches to Navigator, where the sky has the Send station; the focus is not lost", { lens: "navigator", stations: ["place", "layers", "seal", "send"], focus: true }, { lens: await state(p.page, "lens"), stations: await p.ev(() => Array.from(document.querySelectorAll("#strip button")).map((b) => b.id.slice(3))), focus: (await p.ev(() => window.__W.focus())) !== "body" });
  await still(p);
  p.check("for a sky too the station button that has the focus lies inside the window after the press", { focus: "st-place", inWindow: true }, await focusPlace(p));
  const skyLow = p.phone ? { width: 320, height: 568 } : { width: 699, height: 900 };
  p.check("a sky at " + skyLow.width + " x " + skyLow.height + ", the button pressed with the keyboard: the same", { lens: "navigator", focus: "st-place", inWindow: true, console: [] }, await switchInWindow(p, skyLow, "#sky=2461360.25000,51.48,0.00&lens=stargazer", "seal"));
  await p.ev(() => scrollTo(0, 0));
  await p.tap("#backBtn"); await sleep(250);
  p.check("Back to the Ezekiel lexicon: the document's title is the page's own again", OWN_TITLE, await p.ev(() => document.title));
  p.check("no console error on the sky page", [], p.messages);
  p.focusReport("S20 sky");
  await p.close();
});

// ─── S21 reaching things without a pointer; what is announced; Stargazer words ───
section("S21", "keyboard, announcements, Stargazer words, STRIX in whole sentences", async (w) => {
  const status = async () => { await sleep(650); return w.ev(() => document.getElementById("status").textContent); };
  // Stargazer words in the header and on the first screen
  const hd = await w.ev(() => ({ sub: window.__W.shown(document.getElementById("sub")) ? document.getElementById("sub").textContent : null, lensLine: window.__W.shown(document.getElementById("lensLine")) ? document.getElementById("lensLine").textContent : null, strix: window.__W.shown(document.querySelector("#strixLine .strix-name")) }));
  const regionNames = () => w.ev(() => [document.getElementById("explain").getAttribute("aria-label"), document.getElementById("tree").getAttribute("aria-label")]);
  w.check("Stargazer: the card's section and the map are named with thing, not entry", ["About the chosen thing", "The things of this lexicon as a tree on a curved map"], await regionNames());
  if (w.phone) w.check("under 700 px: a line names the chosen level and its hint; the name STRIX stands before STRIX's line", { lensLine: "Stargazer: ages 6 and up", strix: true }, { lensLine: hd.lensLine, strix: hd.strix });
  else w.check("the line under the title at Stargazer has no hard word", "Ezekiel 1:1-9 on a curved map", hd.sub);
  if (w.phone) {
    const vn = await w.ev(() => ({ shown: window.__W.shown(document.getElementById("verseNote")), text: document.getElementById("verseNote").textContent, model: window.__M.readerHead().last, size: getComputedStyle(document.getElementById("verseNote")).fontSize }));
    w.check("under 700 px the closing words of row 0.3 stand under the open verse, read from the row", { shown: true, text: vn.model, size: "14px" }, { shown: vn.shown, text: vn.text, size: vn.size }, vn.shown && vn.text === vn.model && /does not explain the vision/.test(vn.text));
    const off = await w.ev(() => { const b = document.getElementById("dimsBtn").getBoundingClientRect(), c = document.getElementById("tree").getBoundingClientRect(); return { shown: window.__W.shown(document.getElementById("dimsBtn")), overMap: !(b.right <= c.left || b.left >= c.right || b.bottom <= c.top || b.top >= c.bottom), inHeader: !!document.getElementById("dimsBtn").closest("header") }; });
    w.check("the 2D/3D button is off the map (in the header): no entry or label lies under it", { shown: true, overMap: false, inHeader: true }, off);
    await centre(w, "");
    const c = await w.ev(() => { const r = document.getElementById("tree").getBoundingClientRect(); return { x: r.left + 30.9, y: r.top + 47.7 }; });
    await w.tapAt(c.x, c.y, "the canvas near its upper left"); await settle(w.page);
    w.check("a tap on the map near its upper left corner (where the button was) chooses an entry and does not switch to the ball", { dims: "2D", chosen: true }, { dims: await state(w.page, "dims"), chosen: (await state(w.page, "selected")) !== "" && (await state(w.page, "selected")) !== null });
    await centre(w, "");
    const lab = await w.ev(() => window.LexiconExplorer.tree.labels().map((l) => l.address));
    w.check("the whole lexicon on the phone's map: the author's notes (100) keep their label", true, lab.includes("100"), lab.includes("100"));
    await w.shot("79-root-with-notes-label", "The whole lexicon on the phone: the label of the author's notes is among those drawn.");
    await w.tap("#toolHome"); await settle(w.page);
    w.check("Home beside the map brings Ezekiel 1 back to the middle", "26.1", await w.ev(() => window.LexiconExplorer.tree.view.focus));
  }
  await w.ev(() => { window.LexiconExplorer.showLexicon(window.__M.EZEKIEL, "builtin"); scrollTo(0, 0); }); await sleep(200);
  // announcements: the verse stepper, the wording switch, a nudge
  if (!w.phone) {
    await w.tap('[data-key="verse-next"]');
    w.check("The next verse is announced", "Ezekiel 1:2, NIV", await status());
    await w.tap('[data-key="verse-prev"]');
    w.check("The verse before is announced", "Ezekiel 1:1, NIV", await status());
  }
  await w.openBox("readerBox");
  await w.tap('[data-key="wording-kjv"]');
  w.check("the wording switch is announced", "King James.", await status());
  await w.tap('[data-key="wording-supplied"]');
  await w.ev(() => scrollTo(0, 0));
  await w.tap("#nudgeLeft");
  const cap = await status();
  w.check("a nudge is announced once, with the caption of the map", true, cap === (await w.ev(() => document.getElementById("treeCap").textContent)) && cap.length > 10 || cap);
  await w.tap("#navHome"); await settle(w.page);
  // the turn buttons: arrows every phone carries
  const glyphs = await w.ev(() => ["turnLeft", "turnRight", "turnUp", "turnDown"].map((id) => { const b = document.getElementById(id); return { cp: b.textContent.codePointAt(0), label: b.getAttribute("aria-label") }; }));
  w.check("the four turn buttons use arrows of the basic Arrows block (U+2190 to U+21FF) and keep their names", ["Turn the ball left", "Turn the ball right", "Turn the ball up", "Turn the ball down"], glyphs.map((g) => (g.cp >= 0x2190 && g.cp <= 0x21ff ? g.label : "U+" + g.cp.toString(16))));
  // the skip link
  await w.ev(() => document.getElementById("skipList").focus()); await sleep(80);
  const sk = await w.ev(() => { const r = document.getElementById("skipList").getBoundingClientRect(); return { text: document.getElementById("skipList").textContent, seen: r.width >= 32 && r.height >= 32 }; });
  w.check("the skip link is the first control after the gold box, seen while it has the focus", { text: "Skip to the list of things", seen: true }, sk);
  await w.key("Enter", "Enter on the skip link"); await sleep(120);
  w.check("it moves the focus to the list of entries", "listSum", await w.ev(() => (document.activeElement || {}).id));
  await w.ev(() => { document.activeElement.blur(); scrollTo(0, 0); });
  // Navigator: STRIX in whole sentences; figure (a) and the flip button without a pointer
  await w.lens("navigator");
  w.check("from Navigator up they are named with entry", ["About the chosen entry", "The entries of this lexicon as a tree on a curved map"], await regionNames());
  const moreNames = [];
  for (const st of ALL_STATIONS) {
    await w.station(st); await sleep(120);
    const s = await w.ev(() => { const M = window.__M, x = window.LexiconExplorer.state, full = M.stationView(x.station, x.lens, x.lexicon).say[0].text, all = M.sentencesOf(full), t = document.getElementById("strixText").textContent; let n = -1; for (let k = 0; k <= all.length; k++) if (all.slice(0, k).join(" ") === t) n = k; return { n, of: all.length, items: M.stationView(x.station, x.lens, x.lexicon).say.length + M.stationView(x.station, x.lens, x.lexicon).notes.length, more: window.__W.shown(document.getElementById("strixMore")), clamp: getComputedStyle(document.getElementById("strixLine")).webkitLineClamp, label: document.getElementById("strixMore").textContent, aria: document.getElementById("strixMore").getAttribute("aria-label") }; });
    if (w.phone && s.more) moreNames.push({ st, none: s.n === 0, label: s.label, aria: s.aria });
    if (w.phone) w.check("navigator, " + st + ": STRIX's line holds whole sentences only (" + s.n + " of " + s.of + "), is not clamped, and has the more button exactly when something is left out", { whole: true, more: s.n < s.of || s.items > 1, clamp: "none" }, { whole: s.n >= 0, more: s.more, clamp: s.clamp });
    else w.check("navigator, " + st + ": from 700 px STRIX's first paragraph is whole and there is no more button", { n: s.of, more: false }, { n: s.n, more: s.more });
  }
  if (w.phone) {
    // the button's accessible name: its visible words where no sentence is shown, "more from STRIX" where it follows sentences
    w.check("where no sentence of STRIX fits, the button reads What STRIX says here and has no other name; after sentences it reads more and is named more from STRIX", [], moreNames.filter((m) => (m.none ? !(m.label === "What STRIX says here" && m.aria === null) : !(m.label === "more" && m.aria === "more from STRIX"))));
    w.check("both forms of the button occur among the seven stations", { withNone: true, afterSentences: true }, { withNone: moreNames.some((m) => m.none), afterSentences: moreNames.some((m) => !m.none) });
    await w.station("seal"); await w.ev(() => { document.getElementById("stationBox").open = false; scrollTo(0, 0); });
    await w.tap("#strixMore"); await sleep(200);
    const m = await w.ev(() => { const M = window.__M, x = window.LexiconExplorer.state, v = M.stationView(x.station, x.lens, x.lexicon), body = document.getElementById("stationBody").textContent; return { open: document.getElementById("stationBox").open, focus: (document.activeElement || {}).id, whole: v.say.concat(v.notes).every((p) => body.includes(p.text)), inView: document.getElementById("stationSum").getBoundingClientRect().top < innerHeight }; });
    w.check("more opens the box with the whole narration, in view, and moves the focus there", { open: true, focus: "stationSum", whole: true, inView: true }, m);
    await w.shot("80b-strix-more", "Navigator on the phone, Seal: STRIX's whole narration in the box that the more button opened.");
    await w.ev(() => scrollTo(0, 0));
    await w.shot("80c-strix-whole-sentences", "Navigator on the phone, Seal: STRIX's line above the map ends with a whole sentence and the more button.");
  }
  await w.station("fourth"); await w.openBox("stationBox");
  await w.tap('[data-key="preset-345"]');
  await w.tap('[data-key="point-1"]'); await w.tap('[data-key="move-right"]'); await w.tap('[data-key="move-up"]');
  const pts = await w.ev(() => ({ points: window.LexiconExplorer.state.square.points, pressed: document.querySelector('[data-key="point-1"]').getAttribute("aria-pressed"), cap: document.querySelector("#fourthBlock .fig-part .cap").textContent }));
  w.check("figure (a): Point 2, Right, Up move the second point one grid step each, and the numbers follow", { points: [[0, 0], [4, 1], [0, 4]], pressed: "true", cap: true }, { points: pts.points, pressed: pts.pressed, cap: /^Computed: the squared distances are /.test(pts.cap) });
  w.check("the move is announced", true, /^Computed: the squared distances are /.test(await status()));
  await w.tap('[data-key="preset-345"]');
  const bits = [];
  for (let i = 0; i < 3; i++) { await w.tap('[data-key="mirror-wrong"]'); bits.push(await w.ev(() => window.LexiconExplorer.state.square.wrongBit)); }
  w.check("Flip one light in the fourth corner steps through the lights on repeated presses", [5, 6, 7], bits);
  w.check("each flip is announced", "Light 8 of 16 in the fourth corner is flipped.", await status());
  await w.ev(() => { window.LexiconExplorer.state.square.wrongBit = null; });
  await w.sweep("The fourth square with the point buttons");
  // Stargazer: the wheel names only the guard
  await w.lens("stargazer"); await w.station("seal"); await w.openBox("stationBox");
  const wn = await w.ev(() => ({ names: Array.from(document.querySelectorAll("#wheelBlock .bitgrid button")).map((b) => b.getAttribute("aria-label")), of: document.querySelector('[data-key="packet-entry"]').textContent }));
  w.check("Stargazer: the 64 lights are named by number, and only the guard by what it is; the packet button says thing", { lights: 64, plain: true, guard: 1, of: "Of the chosen thing" }, { lights: wn.names.length, plain: wn.names.every((n) => /^Light \d+ of 64, (the guard, )?(on|off)$/.test(n)), guard: wn.names.filter((n) => /the guard/.test(n)).length, of: wn.of });
  await w.ev(() => document.getElementById("wheelCanvas").scrollIntoView({ block: "center" })); await sleep(200);
  await w.shot("81-stargazer-wheel-guard-only", "Stargazer, Stamp it: the word wheel with only the guard named.");
  await w.ev(() => scrollTo(0, 0));
  w.focusReport("S21");
  // arriving by a link to an entry: announced, the focus on the card's title, the John 3:16 box
  const p = await fresh(w.rec, w.browser, w.base, w.vp, { hash: "#entry=43.3.16" });
  await sleep(600);
  const ar = await p.ev(() => ({ status: document.getElementById("status").textContent, focus: (document.activeElement || {}).id, title: document.getElementById("entryTitle").textContent, bridge: document.getElementById("bridge").textContent.includes("We read John 3:16 as the bridge, in the Gospel's own words."), y: scrollY }));
  p.check("#entry=43.3.16: the arrival is announced, the focus is on the card's title, the page did not scroll, and the gold box is the John 3:16 box", { status: "John 3:16. Nothing more under it.", focus: "entryTitle", title: "John 3:16", bridge: true, y: 0 }, ar);
  await p.sweep("opened on John 3:16");
  await p.close();
  const q = await fresh(w.rec, w.browser, w.base, w.vp, { hash: "#entry=99.9.9" });
  await sleep(600);
  p.check("#entry=99.9.9: the note about the link is announced", "That link names an entry this lexicon does not have.", await q.ev(() => document.getElementById("status").textContent));
  await q.close();
  if (w.phone) {
    // a window too small for the card to reach the first screen: nothing is gained by leaving every sentence out
    const low = await fresh(w.rec, w.browser, w.base, w.vp, { viewport: { width: 320, height: 568 } });
    await low.station("count"); await sleep(250);
    const lc = await low.ev(() => { const M = window.__M, x = window.LexiconExplorer.state, all = M.sentencesOf(M.stationView(x.station, x.lens, x.lexicon).say[0].text), m = document.getElementById("strixMore"); scrollTo(0, 0); const t = document.querySelector("#explain .explain-body:not([hidden]) h2").getClientRects()[0]; return { text: document.getElementById("strixText").textContent, first: all[0], more: window.__W.shown(m) ? m.textContent : null, aria: m.getAttribute("aria-label"), card: Math.round(t.bottom), over: window.__W.overflow().over }; });
    low.check("320 x 568, Stargazer, Count: the card cannot reach the first screen whatever is left out, so STRIX's first sentence is shown, with the more button", { text: lc.first, more: "more", aria: "more from STRIX", cardBelow844: true, sideways: false }, { text: lc.text, more: lc.more, aria: lc.aria, cardBelow844: lc.card > 844, sideways: lc.over > 0 });
    low.check("no console error in that window", [], low.messages);
    await low.close();
    // phone windows lower than 844 px: an empty line of STRIX gains nothing where the card is below the window's bottom edge all the same
    for (const [width, height] of [[320, 568], [375, 667]]) for (const [what, hash, stations] of [["the Ezekiel lexicon", "", 36], ["a sky", "#sky=2461360.25000,51.48,0.00", 20]]) {
      const m = await lowWindow(w, { width, height }, hash), at = width + " x " + height + ", " + what;
      w.check(at + ": wherever the card's first line ends below the window's bottom edge, STRIX shows at least its first sentence (" + m.rows.length + " stations and lenses, as the page opens and sealed and sent; " + m.below.length + " with the card below the edge)", [],
        m.below.filter((r) => !(r.first && r.text.startsWith(r.first))).map((r) => r.at + ": " + JSON.stringify(r.text) + ", the card's first line at y " + r.card), m.rows.length === stations && m.below.length > 0 && m.below.every((r) => r.first && r.text.startsWith(r.first)));
      if (hash) w.check(at + ": the banner's sentences about the link are not moved into the station's box where the card stays below the window's bottom edge", [], m.below.filter((r) => r.notice !== "banner").map((r) => r.at + ": " + r.notice));
      w.check(at + ": no console error", [], m.messages);
    }
  }
});

// ─── S22 Stargazer names and leads, the pointers of lines 2 and 7, the focus after a Go-to button, a long ledger,
//     flights started below the map, taps on markers, the scroll offset from 700 to 1100 px ───
const LEADS = [["0.1", "OUR IDEA", "We sort every piece into four kinds and give each piece a place of its own."],
  ["0.2", "SAID", "The Bible words kept here are the King James Version, from the Project Gutenberg e-text."],
  ["0.3", "SAID", "The Jewish Encyclopedia says Jewish teachers explained this chapter to one wise pupil at a time."],
  ["0.4", "SAID", "Its writer, Pierre van Paassen, says no life of Jesus can be written without taking sides."],
  ["0.5", "OUR IDEA", "We read Jesus of Nazareth as a bridge: a line through the middle of our map."]];
/** Two packages that pass every check and carry a long ledger: 201 and 2,952 covered entries, each of three unbroken strings of 96 characters. */
async function makeLedgerFiles(root, folder) {
  const OW = await import(require("url").pathToFileURL(path.join(root, "scripts/strix-overwatch.js")).href), AT = "2026-11-15T10:00:00.000Z";
  for (const total of [201, 2952]) {
    const bundle = await OW.buildLexiconBundle([OW.makeEntry("1", "reading", "note", "A note", "Words.")], { at: AT });
    while (bundle.trace.length < total) OW.traceAppend(bundle.trace, "W".repeat(96), "M".repeat(96), "d", "W".repeat(96));
    const { certificate } = await OW.issueCertificate(bundle, await OW.newSessionKeys(), AT);
    fs.writeFileSync(path.join(folder, "ledger-" + total + ".json"), JSON.stringify(OW.makeHyperpack({ ...bundle, certificate })));
  }
}
/** Puts into the page a function that says whether the whole map is inside the window (below the header where that stays). */
const withMapSeen = (walk) => walk.ev(() => { window.__mapSeen = () => { const c = document.getElementById("tree").getBoundingClientRect(), bar = document.getElementById("topWrap"), edge = getComputedStyle(bar).position === "sticky" ? bar.getBoundingClientRect().bottom : 0; return c.top >= edge - 1 && c.bottom <= innerHeight + 1; }; });
section("S22", "names and leads, new pointers, focus, a long ledger, flights seen, markers, scroll offsets", async (w) => {
  const sel = async (a) => { await w.ev((x) => { window.LexiconExplorer.select(x); }, a); await settle(w.page); };
  const status = async () => { await sleep(650); return w.ev(() => document.getElementById("status").textContent); };
  // Stargazer: five entries are shown under a name a young reader can read; five cards open with a sentence of the page's own
  await sel("0");
  const n0 = await w.ev(() => ({ list: (document.getElementById("e-0.1") || {}).textContent || "", map: window.LexiconExplorer.tree.labels().filter((l) => l.address === "0.1").map((l) => l.text) }));
  w.check("Stargazer, About this lexicon: entry 0.1 is named How this lexicon is sorted in the list and on the map", { list: true, map: true }, { list: n0.list.endsWith("How this lexicon is sorted") || n0.list, map: (n0.map.length === 1 && /^How this/.test(n0.map[0])) || n0.map });
  const mapName = async (lens) => { await w.lens(lens); await sleep(300); return w.ev(() => window.LexiconExplorer.tree.labels().filter((l) => l.address === "0.1").map((l) => l.text)); };
  const asNav = await mapName("navigator"), asStar = await mapName("stargazer");
  w.check("with that entry still at the centre, the lens buttons change the name of 0.1 on the map: its own name at Navigator, the Stargazer name again at Stargazer", { navigator: true, stargazer: true }, { navigator: (asNav.length === 1 && /^Layers/.test(asNav[0])) || asNav, stargazer: (asStar.length === 1 && /^How this/.test(asStar[0])) || asStar });
  await w.ev(() => scrollTo(0, 0));
  await sel("0.1");
  w.check("its card's title and the status line use that name; its own name is not shown at this lens", { title: "How this lexicon is sorted", status: "How this lexicon is sorted. Nothing more under it.", own: false }, { title: await w.ev(() => document.getElementById("entryTitle").textContent), status: await status(), own: await w.ev(() => document.querySelector("main").textContent.includes("Layers and addresses")) });
  for (const [a, badge, lead] of LEADS) {
    await sel(a);
    const c = await w.ev((x) => { const M = window.__M, t = document.getElementById("entryText"), own = document.getElementById("entryOwn"), box = own ? own.closest("details") : null; return { lead: t.textContent.replace(/^[^A-Za-z]*/, ""), badges: t.querySelectorAll(".badge").length, own: !!own && own.textContent.includes(M.EZEKIEL.byAddress.get(x).text), behind: box ? box.querySelector("summary").textContent : null, open: box ? box.open : null }; }, a);
    w.check("Stargazer, entry " + a + ": the card opens with one sentence of the page's own under one badge (" + lead.split(/\s+/).length + " words); the entry's own words are behind More for older readers", { lead: badge + lead, badges: 1, own: true, behind: "More for older readers", open: false }, c);
  }
  await w.sweep("Stargazer, entry 0.5 with its opening sentence");
  await sel("26.1");
  const near = await w.ev(() => ({ names: ["26.1.10", "26.1.12", "26.1.16", "26.1.17"].map((a) => document.getElementById("e-" + a).textContent.replace(/^[^A-Za-z]*WRITTEN/, "")), context: document.querySelector("main").textContent.includes("(context)") }));
  w.check("Stargazer: the four verses kept for their surroundings are named a verse nearby, and the word context is nowhere", { names: ["Ezekiel 1:10 (a verse nearby)", "Ezekiel 1:12 (a verse nearby)", "Ezekiel 1:16 (a verse nearby)", "Ezekiel 1:17 (a verse nearby)"], context: false }, near);
  await sel("100.9");
  w.check("Stargazer, Line 9: the Go-to buttons use the same names", ["Go to Ezekiel 1:9", "Go to Ezekiel 1:12 (a verse nearby)", "Go to Ezekiel 1:17 (a verse nearby)"], await w.ev(() => Array.from(document.querySelectorAll('#tabEntry [data-key^="ptr-100.9.4-"]')).map((b) => b.textContent)));
  await w.lens("navigator"); await sel("26.1");
  w.check("from Navigator up those entries keep their own names", ["Ezekiel 1:10 (context)", "Layers and addresses"], [await w.ev(() => document.getElementById("e-26.1.10").textContent.replace(/^[^A-Za-z]*TEXT/, "").replace(/26\.1\.10.*$/, "")), await (async () => { await sel("0.1"); return w.ev(() => document.getElementById("entryTitle").textContent); })()]);
  // the pointers of lines 2 and 7, at three lenses
  const press = async (line, key) => { await sel(line); await w.ev(() => { for (const d of document.querySelectorAll("#tabEntry details")) d.open = true; }); const label = await w.ev((k) => (document.querySelector('#tabEntry [data-key="' + k + '"]') || {}).textContent || null, key);
    if (label === null) return { label };
    await w.tap('#tabEntry [data-key="' + key + '"]'); await sleep(250); await settle(w.page); await still(w);
    return w.ev((l) => { const a = document.activeElement || {}, x = window.LexiconExplorer.state; return { label: l, station: x.station, tab: x.tab, focus: a.id || (a.getAttribute && a.getAttribute("data-key")) || "", box: document.getElementById("stationBox").open }; }, label); };
  for (const lens of ["navigator", "holographer"]) {
    await w.lens(lens); await w.station("read");
    const p2 = await press("100.2", "ptr-100.2.5");
    w.check(lens + ", Line 2, Open the Wheel tab: a button that opens the Wheel tab and puts the focus on it", { label: "Open the Wheel tab", tab: "wheel", focus: "tabBtn-wheel" }, { label: p2.label, tab: p2.tab, focus: p2.focus });
    await w.tap("#tabBtn-entry");
    const p7 = await press("100.7", "ptr-100.7.6");
    w.check(lens + ", Line 7, Try the three tampers at Seal: a button that opens the Seal station", { label: "Go to the Seal station", station: "seal", focus: "st-seal" }, { label: p7.label, station: p7.station, focus: p7.focus });
    const tampers = await w.ev(() => Array.from(document.querySelectorAll('#stationBody [data-key^="tamper-"]')).map((b) => b.getAttribute("data-key").slice(7)));
    w.check(lens + ": the three tampers the row names are there (change a word, drop an entry, add one), among those this lens offers", ["word", "drop", "add"], ["word", "drop", "add"].filter((k) => tampers.includes(k)));
  }
  await w.lens("stargazer"); await w.station("read");
  const s2 = await press("100.2", "ptr-100.2.5");
  w.check("Stargazer, Line 2: the button goes to the word wheel inside Stamp it, opens its box and puts the focus on the wheel's first button", { label: "Go to the word wheel", station: "seal", box: true, focus: true }, { label: s2.label, station: s2.station, box: s2.box, focus: /^wheelview-/.test(s2.focus || "") || s2.focus });
  w.check("the wheel is brought to the top of the window", "at the top", await w.ev(() => { const r = document.activeElement.getBoundingClientRect(), bar = document.getElementById("topWrap"), edge = getComputedStyle(bar).position === "sticky" ? bar.getBoundingClientRect().bottom : 0; return r.top >= edge - 1 && r.top <= edge + 60 ? "at the top" : "y " + Math.round(r.top) + " (the window begins at " + Math.round(edge) + ")"; }));
  await w.ev(() => scrollTo(0, 0)); await w.station("read");
  const s7 = await press("100.7", "ptr-100.7.6");
  w.check("Stargazer, Line 7: the button goes to Stamp it, where the three tampers are", { label: "Go to Stamp it", station: "seal", focus: "st-seal", tampers: 3 }, { label: s7.label, station: s7.station, focus: s7.focus, tampers: await w.ev(() => document.querySelectorAll('#stationBody [data-key^="tamper-"]').length) });
  // the focus after a Go-to button of the card, pressed with the keyboard
  const goByKey = async (key) => { await sel("100.6"); await w.ev((k) => { for (const d of document.querySelectorAll("#tabEntry details")) d.open = true; document.querySelector('#tabEntry [data-key="' + k + '"]').focus(); }, key); await w.key("Enter", "Enter on " + key); await settle(w.page); await still(w);
    return w.ev(() => { const a = document.activeElement || {}, r = a.getBoundingClientRect ? a.getBoundingClientRect() : { top: -1, bottom: -1 }, bar = document.getElementById("topWrap"), edge = getComputedStyle(bar).position === "sticky" ? bar.getBoundingClientRect().bottom : 0; return { selected: window.LexiconExplorer.state.selected, focus: a.id || "", seen: r.top >= edge - 1 && r.bottom <= innerHeight + 1 }; }); };
  w.check("Stargazer: after Enter on a Go-to button inside More for older readers the new card's title has the focus and is in the window", { selected: "5.19.15", focus: "entryTitle", seen: true }, await goByKey("go-5.19.15"));
  w.check("the same after the button made from a row's closing words", { selected: "5.19.15", focus: "entryTitle", seen: true }, await goByKey("ptr-100.6.14-5.19.15"));
  await w.lens("navigator");
  const nk = await goByKey("go-5.19.15");
  w.check("from Navigator up the Entry tab receives the focus, as before", { selected: "5.19.15", focus: "tabBtn-entry" }, { selected: nk.selected, focus: nk.focus });
  w.focusReport("S22 names, pointers, focus");
  // a long ledger in a package from a file: 200 rows and one line of the page's own; the tab opens at once
  for (const [total, line] of [[201, "and 1 more ledger entry, not listed"], [2952, "and 2752 more ledger entries, not listed"]]) {
    await w.ev(() => scrollTo(0, 0));
    await loadFile(w, path.join(FILES, "ledger-" + total + ".json"));
    await w.tap("#showItBtn"); await sleep(300); await settle(w.page);
    const ms = await w.ev(async () => { const t = performance.now(); document.getElementById("tabBtn-overwatch").click(); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); return Math.round(performance.now() - t); });
    const led = await w.ev(() => { const m = document.getElementById("ledgerMore"), prev = m ? m.previousElementSibling : null; return { rows: document.querySelectorAll("#tabOverwatch .table-wrap tbody tr").length, line: m ? m.textContent : null, under: prev ? prev.className : null, size: m ? getComputedStyle(m).fontSize : null, outside: m ? m.querySelectorAll(".outside").length : null }; });
    w.check("a package whose ledger has " + total + " covered entries: the first 200 are listed and, under the table, one line of the page's own says how many are not", { rows: 200, line, under: "table-wrap", size: "14px", outside: 0 }, led);
    w.check("its Checks tab opens in under half a second", "under 500 ms", ms, ms < 500);
    if (total === 201) await w.sweep("a long ledger from a file, the Checks tab", { card: false });
    await w.ev(() => scrollTo(0, 0));
    await w.tap("#backBtn"); await sleep(250);
  }
  // taps on the map: a marker is found whatever name stands beside it, and no child's name lies on another entry's marker
  await w.lens("stargazer");
  const lay = async (a) => { await w.ev((x) => { const X = window.LexiconExplorer; X.tree.stop(); X.tree.jumpTo(x); scrollTo(0, 0); }, a); await sleep(220); };
  const onMarkers = [];
  for (const c of ["", "26.1", "100", "0", "26.1.5", "43.3.16", "66"]) {
    await lay(c);
    const hits = await w.ev(() => { const t = window.LexiconExplorer.tree, focus = t.view.focus, rel = new Map(t.scene.nodes.map((n) => [n.address, n.relation])), out = [];
      for (const l of t.labels()) { if (rel.get(l.address) !== "child" || l.address === "100") continue; for (const m of t.marks()) { if (m.address === l.address || m.address === focus) continue; if (l.x < m.x + m.r && l.x + l.w > m.x - m.r && l.y < m.y + m.r && l.y + l.h > m.y - m.r) out.push(l.text + " on the marker of " + m.address); } }
      return out; });
    if (hits.length) onMarkers.push((c || "the whole lexicon") + ": " + hits.join(", "));
  }
  w.check("at seven centres no child's name lies on the marker of another entry", [], onMarkers);
  await lay("");
  w.check("the whole lexicon centred: the author's notes (100) keep their label", true, await w.ev(() => window.LexiconExplorer.tree.labels().some((l) => l.address === "100")));
  const beside = await w.ev(() => window.LexiconExplorer.tree.marks().filter((m) => m.relation === "child").map((m) => m.address));
  const wrong = [];
  for (const a of beside) {
    await lay("");
    const at = await w.ev((x) => window.__W.markAt(x), a);
    await w.tapAt(at.x, at.y, "the marker of " + a); await sleep(120);
    const got = await state(w.page, "selected");
    if (got !== a) wrong.push("the marker of " + a + " chose " + got);
  }
  w.check("the whole lexicon centred: a tap on the marker of each top-level entry chooses that entry, whatever name stands beside it (" + beside.length + " markers, Psalms among them)", [], wrong, wrong.length === 0 && beside.includes("19") && beside.length >= 10);
  let over = null;
  for (const c of ["0.4.1", "0.4.2", "5.19", "14.18"]) {
    await sel("26.1"); await lay(c);
    over = await w.ev(() => { const t = window.LexiconExplorer.tree, box = document.getElementById("tree").getBoundingClientRect();
      for (const l of t.labels()) for (const m of t.marks()) { if (m.address === l.address) continue;
        for (let dx = -m.r + 0.5; dx <= m.r - 0.5; dx += 0.5) for (let dy = -m.r + 0.5; dy <= m.r - 0.5; dy += 0.5) { const x = m.x + dx, y = m.y + dy; if (Math.hypot(dx, dy) <= m.r - 0.5 && x > l.x + 0.5 && x < l.x + l.w - 0.5 && y > l.y + 0.5 && y < l.y + l.h - 0.5) return { label: l.address, mark: m.address, x: box.left + x, y: box.top + y }; } }
      return null; });
    if (over) { over.centre = c; break; }
  }
  if (over) {
    await w.tapAt(over.x, over.y, "a point inside a marker and inside a name"); await sleep(150);
    w.check("where a name does reach a marker (centre " + over.centre + ": the name of " + over.label + " on the marker of " + over.mark + "), a tap inside the marker chooses the marker's entry", over.mark, await state(w.page, "selected"));
  } else w.check("at four more centres no name reaches a marker in this window (nothing to tap)", null, over);
  await w.tap("#navHome"); await settle(w.page);
  w.focusReport("S22 markers");
  // the two buttons of the gold box start a flight: the map is in the window while it runs
  const f = await fresh(w.rec, w.browser, w.base, w.vp);
  await withMapSeen(f);
  const watch = () => f.ev(() => { const t = window.LexiconExplorer.tree, log = (window.__fl = { flying: 0, unseen: 0, path: [] });
    window.__iv = setInterval(() => { if (!t.flying) return; log.flying++; if (!window.__mapSeen()) log.unseen++; const a = t.view.focus; if (log.path[log.path.length - 1] !== a) log.path.push(a); }, 12); });
  const arrived = () => f.page.waitForFunction(() => { const t = window.LexiconExplorer.tree; return window.__fl.flying > 0 && !t.flying && t.view.focus === "43.3.16"; }, null, { timeout: 20000 });
  await f.ev(() => document.getElementById("bridgeGo").scrollIntoView({ block: "center" })); await sleep(250);
  const outside1 = !(await f.ev(() => window.__mapSeen()));
  if (f.phone) f.check("on the phone the gold box stands below the card: the map is outside the window when Go to John 3:16 is pressed", true, outside1);
  await watch();
  await f.tap("#bridgeGo"); await arrived(); await sleep(200);
  const g = await f.ev(() => { clearInterval(window.__iv); return { flew: window.__fl.flying > 0, unseen: window.__fl.unseen, seen: window.__mapSeen(), focus: (document.activeElement || {}).id, selected: window.LexiconExplorer.state.selected, title: document.getElementById("entryTitle").textContent }; });
  f.check("Go to John 3:16: the map is brought into the window first and is in it for the whole flight; the verse is chosen and the focus stays in the gold box", { flew: true, unseen: 0, seen: true, focus: "bridgeFly", selected: "43.3.16", title: "John 3:16" }, g);
  await f.ev(() => document.getElementById("bridgeFly").scrollIntoView({ block: "center" })); await sleep(250);
  const outside2 = !(await f.ev(() => window.__mapSeen()));
  await watch();
  await f.tap("#bridgeFly"); await arrived(); await sleep(200);
  const fl = await f.ev(() => { clearInterval(window.__iv); return { unseen: window.__fl.unseen, starts: window.__fl.path[0], passed: window.__fl.path.length, seen: window.__mapSeen(), focus: (document.activeElement || {}).id, ends: window.LexiconExplorer.tree.view.focus }; });
  f.check("Fly here from the river" + (outside2 ? ", pressed with the map outside the window" : "") + ": the road from the river entry to John 3:16 is flown inside the window; the focus stays on the button", { unseen: 0, starts: "26.1.1.4", passed: "3 or more entries", seen: true, focus: "bridgeFly", ends: "43.3.16" }, { ...fl, passed: fl.passed >= 3 ? "3 or more entries" : fl.passed });
  f.check("no console error on that page", [], f.messages); f.focusReport("S22 flights"); await f.close();
  const r = await fresh(w.rec, w.browser, w.base, w.vp, { reducedMotion: "reduce" });
  await withMapSeen(r);
  await r.ev(() => document.getElementById("bridgeGo").scrollIntoView({ block: "center" })); await sleep(250);
  await r.tap("#bridgeGo");
  r.check("with reduced motion the map is in the window at once and the verse is at the centre at once", { seen: true, at: "43.3.16", flying: false }, await r.ev(() => ({ seen: window.__mapSeen(), at: window.LexiconExplorer.tree.view.focus, flying: window.LexiconExplorer.tree.flying })));
  await r.close();
  // from 700 to 1100 px wide the header may have two rows: what is scrolled to stops below it, with and without the banner of a lexicon from a file
  if (!w.phone) {
    for (const width of [700, 768, 820, 1000, 1099, 1100]) for (const banner of [false, true]) {
      const n = await fresh(w.rec, w.browser, w.base, w.vp, { hash: "#lens=navigator", viewport: { width, height: 900 } }), what = width + " px wide" + (banner ? ", a lexicon from a file" : "");
      if (banner) { await loadFile(n, path.join(FILES, "invented.json")); await n.tap("#showItBtn"); await sleep(300); await settle(n.page); }
      const m = await n.ev(() => ({ block: Math.round(document.getElementById("topWrap").getBoundingClientRect().bottom), pad: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) }));
      n.check(what + ": the scroll offset is at least the height of the block that stays at the top", "pad >= block", m, m.pad >= m.block);
      await n.openBox("listBox");
      for (const which of ["first", "last"]) { await n.ev((x) => { const all = document.querySelectorAll("#list button"), b = x === "first" ? all[0] : all[all.length - 1]; b.scrollIntoView({ block: "center" }); b.focus({ preventScroll: true }); b.click(); }, which); await settle(n.page); await still(n); }
      const t = await n.ev(() => { const el = document.getElementById("entryTitle"), q = el.getBoundingClientRect(), edge = document.getElementById("topWrap").getBoundingClientRect().bottom, hit = document.elementFromPoint(q.left + 8, q.top + 3); return { top: Math.round(q.top), bottom: Math.round(q.bottom), edge: Math.round(edge), hit: !!hit && el.contains(hit), h: innerHeight }; });
      n.check(what + ": after a choice in the list the card's title is wholly below the header and inside the window", "top at or below the edge, nothing over it", t, t.top >= t.edge && t.bottom <= t.h && t.hit);
      if (banner ? [700, 1000].includes(width) : [700, 820, 1099].includes(width)) {
        await n.ev(() => { scrollTo(0, 0); const all = Array.from(document.querySelectorAll("button, summary, input, a[href], select, [tabindex='0']")).filter((e) => e.getClientRects().length && !e.closest("dialog") && !e.disabled); all[all.length - 1].focus(); });
        const hidden = []; let stops = 0;
        for (let i = 0; i < 260; i++) {
          await n.page.keyboard.press("Shift+Tab");
          const a = await n.ev(() => { const e = document.activeElement; if (!e || e === document.body) return null; const bar = document.getElementById("topWrap"), q = e.getBoundingClientRect(); return { name: e.id || e.getAttribute("data-key") || e.localName, top: Math.round(q.top), edge: Math.round(bar.getBoundingClientRect().bottom), inBar: bar.contains(e), w: q.width }; });
          if (!a) break;
          stops++;
          if (a.inBar) break;
          if (a.w >= 3 && a.top < a.edge - 1) hidden.push(a.name + " at y " + a.top + " under the edge at " + a.edge);
        }
        n.check(what + ": walking back with Shift+Tab from the last control to the header, no focused control is under the block (" + stops + " stops)", [], hidden, hidden.length === 0 && stops > 10);
      }
      n.check(what + ": no console error", [], n.messages);
      await n.close();
    }
  }
});

const PLAN = [["S01", "S02"], ["S03"], ["S04", "S05"], ["S06", "S07", "S08"], ["S09", "S10", "S18", "S11", "S12", "S13", "S14", "S15"], ["S16"], ["S17"], ["S19"], ["S20"], ["S21"], ["S22"]];
async function viewportPart(rec, browser, base, key, only) {
  const vp = L.VIEWPORTS[key], byId = new Map(SECTIONS.map((s) => [s.id, s]));
  for (const group of PLAN) {
    const ids = group.filter((id) => !only || only.includes(id));
    if (ids.length === 0) continue;
    rec.at(vp.name, "open");
    const w = await fresh(rec, browser, base, vp);
    if (only && group[0] === "S09" && !ids.includes("S09")) {      // these sections continue from a sealed and sent page
      await w.lens("navigator"); await w.station("seal"); await w.tap("#sealBtn"); await idle(w.page);
      await w.station("send"); await w.tap("#sendBtn"); await idle(w.page); w.acts = 0; w.focusBad = [];
    }
    for (const id of ids) {
      const s = byId.get(id);
      rec.at(vp.name, id + " " + s.title);
      try { await s.fn(w); } catch (e) { rec.check("the section ran to its end", "no error", String((e && e.stack) || e).slice(0, 700), false); }
    }
    rec.at(vp.name, "close (" + ids.join(", ") + ")");
    rec.check("no console error or warning and no page error on this page", [], w.messages);
    rec.check("no script dialog was raised", 0, w.dialogs());
    await w.close();
  }
}

(async () => {
  const only = kit.listOption(OPTS.only, SECTIONS.map((s) => s.id), "only");
  const browser = await kit.launch(), version = browser.version();
  const record = new kit.Record("Lexicon Explorer", { verbose: OPTS.verbose }), rec = new L.Steps(record);
  let server = null, fonts = "";
  FILES = kit.tempFolder("lexicon-walk");
  try {
    await L.makeFiles(ROOT, FILES);
    await makeLedgerFiles(ROOT, FILES);
    server = await kit.serve(ROOT);
    const base = server.base;
    fonts = await kit.fontsDrawn(browser, base + L.PAGE_PATH);
    console.log("Lexicon Explorer walkthrough · " + PARTS.join(", ") + (only ? " · " + only.join(",") : "") + " · " + ROOT + " at " + base + " · Chromium " + version);
    if (PARTS.includes("phone")) await viewportPart(rec, browser, base, "phone", only);
    if (PARTS.includes("desk")) await viewportPart(rec, browser, base, "desk", only);
    if (PARTS.includes("small")) await smallWindows(rec, browser, base);
    if (PARTS.includes("fonts")) await fontsAborted(rec, browser, base);
  } catch (e) { rec.at("run", "run"); rec.check("the run did not stop", "no error", String((e && e.stack) || e), false); }
  await browser.close().catch(() => {});
  if (server) await server.close();
  kit.removeFolder(FILES);
  kit.leave(kit.finish(record, { opts: OPTS, shots: SHOTS, notes: [fonts].concat(SHOTS.on ? [SHOTS.list.length + " screenshots in " + SHOTS.folder] : []).filter(Boolean), extra: { root: ROOT, parts: PARTS, only, chromium: version } }));
})();
