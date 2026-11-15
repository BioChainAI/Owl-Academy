// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Lexicon Explorer: the shell (specification section 8; rules 1.1, 1.4, 1.5 and 1.6).
// It builds the page from the model (lexicon-explorer-model.js: every sentence, list and number), draws through
// lexicon-canvas.js (the tree, the word wheel, the figures) and uses the shared kit for the DOM, the badges, the
// dialog, the busy flag, the status line and the focus. It holds one state object, made by the model's
// initialState() and changed only with the model's own functions or by plain assignment of page choices.
//
// REGIONS (ids in index.html, in the DOM order that is the phone order of 1.6)
//   strip        the stations (buttons st-KEY)
//   say          STRIX's sentence, the station's main control (stationMain), the open verse (verseBox, phone only)
//   stage        the tree canvas, nudge and turn buttons, "Drag the map", the caption treeCap
//   explain      the tabs (tabBtn-KEY) and their bodies tabEntry, tabWheel, tabChain, tabOverwatch, tabWitnesses
//   bridge       the gold box of the station
//   more         stationBox (the rest of the station), readerBox (the nine verses), legendBox (the four badges)
//   under        Home, Up, previous and next sibling; listBox with the neighbourhood list (role=tree, items e-ADDRESS)
//   aside        loadBox (the one file input, from Navigator up)
//   status       the one status line; about: the dialog "What is real here?"
//
// FOR THE WALKTHROUGH   window.LexiconExplorer = { state, ready, tree, select, setStation, showLexicon }.
//   A term button carries data-address (data-key vterm-ADDRESS in the open verse, rterm-ADDRESS in the reader).
//
// Strings of a lexicon that came from a file are the sender's: they pass through outsideText() (own() below), are
// never put into an id, a class, a URL or an object key, and their badges are outlined.
import {
  $, h, setText, outsideText, inlineButton, badge, layerLegend, checkList, downloadText, describeCanvas, wireDialog,
  nextPaint, withBusy, keepFocus, statusLine, lensSwitch, foldBox, AUTHOR_NOTE_WORD, LAYER_META,
} from "../explorer-kit.js";
import * as M from "./lexicon-explorer-model.js";
import { createTreeCanvas, createWordWheel, createFigure } from "./lexicon-canvas.js";

// ─── state and small helpers ─────────────────────────────────────────────────

const state = M.initialState(location.hash);
const HOME_PLACE = { ...state.place };   // the two entries the Place station opens with, as the model gives them
state.noise = false;          // the noise switch of the Send station
state.sendNote = "";          // what Send says when it needs an earlier station
let listFocus = state.view.focus;   // the entry the neighbourhood list is centred on
let lastHash = location.hash;
let tree = null, wheel = null, wheelBlock = null, wheelParts = null, fourth = null, lens = null, say = null;
let moreOpenFor = null;       // the entry whose "More for older readers" is open

const lex = () => state.lexicon;
const isStar = () => state.lens === "stargazer";
const isBuiltin = () => state.lexicon.origin === "builtin";
const isOutside = () => state.lexicon.origin === "outside";
const isSealed = () => !!state.seal && state.seal.ok === true;
const ui = (key) => M.uiLabel(key, state.lens);
const wide = () => typeof matchMedia === "function" && matchMedia("(min-width: 700px)").matches;
const stationNow = () => (state.station ? M.stationView(state.station, state.lens, lex()) : null);
/** A string of the lexicon on show: the sender's own element when the lexicon came from a file. */
const own = (value) => (isOutside() ? outsideText(value) : String(value));
/** The badge of a sentence of the page's own copy. */
const tag = (layer) => badge(layer, { lens: state.lens });
/** The badge of an entry, from the model's badgeView: outlined for a lexicon from outside. */
function mark(view) {
  if (!view || !view.layer) return null;
  return badge(view.layer, { outline: view.outline, lens: view.outline ? "navigator" : state.lens, word: view.authorNote ? AUTHOR_NOTE_WORD : "" });
}
/** One sentence of the page's copy with its badge. */
const line = (item) => h("p", null, tag(item.layer), item.text);
const note = (text) => h("p", { class: "note" }, text);
/** fill(el, ...kids): replaces the children of an element; kids are nodes, strings or lists of those, null is skipped (as in h()). */
const fill = (el, ...kids) => el.replaceChildren(...h("div", null, kids).childNodes);
const listOf = (items) => (items.length < 2 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1]);

/** Runs a handler and keeps the focus: on the same control, on its replacement (data-key), or on the first control of its region. */
function act(fn) {
  return (e) => {
    const from = e && e.currentTarget instanceof Element ? e.currentTarget : null;
    const region = from ? from.closest("section, nav, details, header, dialog") : null;
    keepFocus(() => fn(e));
    holdFocus(region);
  };
}
function holdFocus(region) {
  const a = document.activeElement;
  if (a && a !== document.body && a !== document.documentElement) return;
  const next = region && region.isConnected
    ? Array.from(region.querySelectorAll("button, [role=button], summary, a[href]")).find((el) => el.getClientRects().length > 0 && !el.disabled) : null;
  (next || $("aboutBtn")).focus({ preventScroll: true });
}
const button = (label, onPress, attrs) => h("button", { type: "button", class: "btn", ...(attrs || {}), onclick: act(onPress) }, label);

// ─── the link: read at load, written on each entry change ────────────────────

function hashNow() {
  const sky = state.sky ? [state.sky.jd, state.sky.lat, state.sky.lon] : null;
  const entry = !isOutside() && state.selected ? state.selected : null;
  try { return M.formatHash({ sky, entry, lens: state.lens }); } catch { return ""; }
}
function writeUrl(push) {
  const next = hashNow();
  if (next === "" || next === location.hash) return;
  try {
    if (push) history.pushState(null, "", next); else history.replaceState(null, "", next);
    lastHash = location.hash;
  } catch { /* a page opened from a file may not rewrite its address */ }
}
function onHash() {
  if (location.hash === lastHash) return;
  lastHash = location.hash;
  const before = lex(), parsed = M.parseHash(location.hash);
  Object.assign(state, M.applyHash(state, parsed));
  if (parsed.values.entry === undefined && !isOutside()) state.selected = null;
  if (lex() !== before) { resetForLexicon(); tree.setLexicon(lex(), state.selected || lex().home); }
  lens.set(state.lens);
  tree.set({ selected: state.selected, countWord: isStar() ? "things" : "entries" });
  tree.flyTo(state.selected === null ? lex().home : state.selected);
  listFocus = state.selected === null ? lex().home : state.selected;
  keepFocus(renderAll);
  say(M.statusFor(lex(), state.selected, state.lens));
}

// ─── choosing: an entry, a station, a lens, 2D or 3D ─────────────────────────

/** select(address, { fly, push }): the entry is selected, the tree slides to it, the Entry shows it, the link names it. */
function select(address, options) {
  const { fly = true, push = true } = options || {};
  if (!M.hasPlace(lex(), address)) return false;
  Object.assign(state, M.selectEntry(state, address));
  state.tab = M.tabFor(state);
  tree.set({ selected: address });
  if (fly) tree.flyTo(address);
  listFocus = address;
  if (push) writeUrl(true);
  render("say", "reader", "explain", "list", "nav");
  say(M.statusFor(lex(), address, state.lens));
  return true;
}
function startCount(words, word) {
  state.counting = { words: words.slice(), word: word || null };
  const hit = M.countMarks(words).find((v) => v.times > 0);
  if (hit) state.verse = hit.address;
  $("readerBox").open = true;
}
function setStation(key) {
  state.station = key;
  state.station = M.stationFor(state);
  state.counting = null;
  state.sendNote = "";
  if (state.station === "count") startCount(["four"], "four");
  if (state.station === "layers") $("legendBox").open = true;
  if (wide() || state.station === "fourth") $("stationBox").open = true;
  render("strip", "say", "bridge", "station", "reader", "explain");
  const sv = stationNow();
  if (sv) say(sv.title + ". " + sv.say[0].text);
}
function goNext() {
  const sv = stationNow();
  if (!sv || !sv.next) return;
  const next = sv.next;
  setStation(next.station);
  if (next.word) { startCount([next.word], next.word); render("say", "reader"); }
  const target = $("st-" + state.station);
  if (target) target.focus({ preventScroll: true });
}
function setLens(id) {
  Object.assign(state, M.setLens(state, id));
  lens.set(state.lens);
  tree.set({ countWord: isStar() ? "things" : "entries" });
  writeUrl(false);
  renderAll();
  say((isStar() ? "Stargazer" : state.lens === "navigator" ? "Navigator" : "Holographer") + ": " + M.LENS_HINTS[state.lens] + ".");
}
function setDims(dims) {
  state.dims = dims === "3D" ? "3D" : "2D";
  tree.set({ dims: state.dims });
  render("tools", "say");
}
function resetForLexicon() {
  state.place = isBuiltin() ? { ...HOME_PLACE } : { from: lex().home, to: lex().addresses[lex().addresses.length - 1] || "" };
  state.square.packet = 0;
  state.sendNote = "";
  moreOpenFor = null;
}
/** showLexicon(lexicon, origin): the one way another lexicon comes on show ("builtin", "page" or "outside"). */
function showLexicon(lexicon, origin) {
  if (!lexicon || lexicon.origin !== origin) return false;
  Object.assign(state, {
    lexicon, selected: null, view: M.homeView(lexicon), seal: null, tampers: {}, send: null, counting: null,
    wheel: { packet: 0, flips: [], view: state.wheel.view, sector: null },
  });
  if (origin === "builtin") { state.sky = null; state.outside = null; }
  if (origin === "outside" && state.outside) state.outside.shown = true;
  state.station = M.stationFor(state);
  state.tab = M.tabFor(state);
  resetForLexicon();
  tree.setLexicon(lexicon);
  tree.set({ selected: null });
  listFocus = lexicon.home;
  if (origin === "builtin") writeUrl(false);
  renderAll();
  return true;
}
const backButton = () => button(ui("ezekiel"), () => { showLexicon(M.EZEKIEL, "builtin"); say("The Ezekiel lexicon is shown again."); }, { class: "btn", id: "backBtn", "data-key": "back" });

// ─── region: the station strip ───────────────────────────────────────────────

function renderStrip() {
  const shown = M.visibleStations(state.lens, lex().origin);
  $("stripNav").hidden = shown.length === 0;
  $("strip").classList.toggle("many", shown.length > 4);
  fill($("strip"), ...shown.map((s, i) => h("li", null, h("button", {
    type: "button", id: "st-" + s.key, "data-key": "st-" + s.key, "aria-current": s.key === state.station ? "step" : null,
    onclick: act(() => setStation(s.key)),
  }, h("span", { class: "st-n" }, String(i + 1)), " ", h("span", { class: "st-name" }, isStar() ? s.stargazerTitle : s.title)))));
}

// ─── region: STRIX, the station's main control, the open verse ───────────────

function sayItems(sv) { return sv ? sv.say.concat(sv.notes) : []; }

function renderSay() {
  const sv = stationNow(), items = sayItems(sv), banner = $("banner");
  $("say").setAttribute("data-station", state.station || "none");
  $("say").setAttribute("data-origin", isBuiltin() ? "builtin" : isOutside() ? "outside" : "page");
  if (isOutside()) fill(banner, h("p", null, M.OUTSIDE_BANNER), h("p", { class: "gap" }, backButton()));
  // Under 700 px the note about the link stands in the station's box, so that the Entry begins on the first screen.
  else if (!isBuiltin()) fill(banner, h("p", null, lex().title), h("p", { class: "note only-wide" }, M.SKY_PRIVACY), h("p", { class: "gap" }, backButton()));
  else fill(banner);
  banner.hidden = isBuiltin();
  fill($("strix"), ...(items.length === 0 ? [] : [
    h("p", { id: "strixLine" }, h("span", { class: "label violet strix-name only-wide" }, "STRIX"), tag(items[0].layer), items[0].text),
    items.length > 1 ? h("div", { class: "only-wide stack", id: "strixRest" }, items.slice(1).map(line)) : null,
  ]));
  fill($("stationMain"), ...stationMain());
  renderVerse();
}

function termButton(span, prefix) {
  return inlineButton(span.text, act(() => select(span.term)), {
    "data-key": prefix + "term-" + span.term, "data-address": span.term, "aria-pressed": String(state.selected === span.term),
  });
}
/** What the count has lit: one sentence, the verses named. */
function countLine() {
  const c = state.counting, marks = M.countMarks(c.words), total = marks.reduce((n, v) => n + v.times, 0);
  const verses = marks.filter((v) => v.times > 0).map((v) => String(v.number));
  const where = verses.length === 0 ? "" : " · " + (verses.length === 1 ? "verse " : "verses ") + verses.join(", ");
  return h("p", { class: "note count-line" }, c.words.map(M.quoted).join(", ") + ": " + M.timesWord(total) + where);
}
function renderVerse() {
  const box = $("verseBox"), counting = state.counting;
  const show = isBuiltin() && (state.station === "read" || state.station === "count" || !!counting);
  box.hidden = !show;
  if (!show) { fill(box); return; }
  const v = M.verseView(state.verse, counting ? "kjv" : M.wordingFor(state)), i = M.READER_VERSES.indexOf(state.verse);
  const step = (d) => { state.verse = M.READER_VERSES[(i + d + M.READER_VERSES.length) % M.READER_VERSES.length]; renderVerse(); };
  const words = counting
    ? (M.countMarks(counting.words).find((m) => m.address === state.verse) || { spans: [] }).spans.map((s) => (s.hit ? h("mark", null, s.text) : s.text))
    : v.spans.map((s) => (s.term ? termButton(s, "v") : s.text));
  const stepper = counting ? "btn ghost" : "btn ghost only-wide";   // on a phone the map is the way to another verse; while counting, these are
  fill(box,
    h("div", { class: "row verse-head" },
      h("h2", { id: "verseTitle" }, v.name + ", " + (v.wording === "supplied" ? "NIV" : "King James")),
      button("‹", () => step(-1), { class: stepper, "data-key": "verse-prev", "aria-label": "The verse before" }),
      button("›", () => step(1), { class: stepper, "data-key": "verse-next", "aria-label": "The next verse" })),
    h("p", { class: counting ? "read" : "verse", id: "openVerse" }, words),
    counting ? countLine() : null,
    counting && state.station !== "count" ? h("p", null, button("Show the words again", () => { state.counting = null; render("say", "reader"); }, { "data-key": "count-done" })) : null);
}

function stationMain() {
  const key = state.station;
  if (key === "count" && isBuiltin()) {
    const c = state.counting;
    return [h("div", { class: "row", role: "group", "aria-label": "The number words" }, M.countTable().map((r) => button(r.word, () => {
      if (c && c.word === r.word) state.counting = null; else startCount([r.word], r.word);
      render("say", "reader");
    }, { "data-key": "count-" + r.word, "aria-pressed": String(!!c && c.word === r.word) }))),
    ];
  }
  if (key === "place") {
    const p = M.placeNumbers(lex(), state.dims, state.place.from, state.place.to);
    return [h("p", { id: "placeLine" }, tag("checked"), p.sentence),
      h("div", { class: "row" },
        button(ui("fly"), () => { if (p.ok) { tree.jumpTo(state.place.from); tree.flyTo(state.place.to, { walk: true }); listFocus = state.place.to; } }, { id: "flyBtn", "data-key": "fly" }))];
  }
  if (key === "layers") {
    const counts = M.layerCountsOf(lex());
    return [h("div", { class: "row" }, button(ui("marks"), () => { state.marks = !state.marks; tree.set({ byLayer: state.marks }); render("say"); },
      { id: "marksBtn", "data-key": "marks", "aria-pressed": String(state.marks) })),
    h("div", { class: "row", role: "group", "aria-label": ui("filter") }, LAYER_META.map((m) => button([badge(m.id, { lens: state.lens }), String(counts[m.id])], () => {
      state.filter = { ...state.filter, [m.id]: state.filter[m.id] === false };
      state.marks = true;
      tree.set({ byLayer: true, filter: state.filter });
      render("say");
    }, { class: "btn ghost layer-btn", "data-key": "filter-" + m.id, "aria-pressed": String(state.filter[m.id] !== false) })))];
  }
  if (key === "seal") {
    return [h("div", { class: "row" },
      h("button", { type: "button", class: "btn gold", id: "sealBtn", "data-key": "seal", "data-busy-lock": true, onclick: () => { doSeal(); } }, ui("seal")),
      h("span", { class: "note", id: "sealProgress" }, "")),
    state.seal ? h("p", { id: "sealVerdict" }, tag("checked"), M.sealView(state.seal, state.lens).verdict) : null];
  }
  if (key === "send") {
    const s = state.send;
    return [h("div", { class: "row" },
      button(ui("noise"), () => { state.noise = !state.noise; render("say"); }, { class: "btn ghost", id: "noiseBtn", "data-key": "noise", "aria-pressed": String(state.noise) }),
      h("button", { type: "button", class: "btn gold", id: "sendBtn", "data-key": "send", "data-busy-lock": true, onclick: () => { doSend(); } }, ui("send")),
      h("span", { class: "note", id: "sendProgress" }, "")),
    state.sendNote ? note(state.sendNote) : null,
    // Under 700 px only the count stands above the map (the Entry must begin on the first screen): the four
    // answers and the two marks are in the station's box below and in the Witnesses tab.
    h("ul", { class: "marks-list only-wide", id: "sendRows" }, s ? s.rows.map(receiverLine) : null),
    s ? h("p", { id: "sendCount" }, tag("checked"), s.k + " of " + s.of + " handshakes") : null,
    s ? h("div", { class: "only-wide" }, markList(s)) : null];
  }
  return [];
}
const receiverLine = (row) => h("li", null, row.city + ": " + (row.accepted ? "accepted" : "refused at the check called " + row.failed) + (row.noise ? " (noise on its road)" : ""));
const markList = (s) => h("ul", { class: "marks-list send-marks" }, s.marks.map((m) => h("li", null, (m.met ? "✓ " : "· ") + m.label + (m.met ? "" : " (not met)"))));

// ─── region: the reader (nine verses, two wordings) ──────────────────────────

function renderReader() {
  const box = $("readerBox");
  box.hidden = !isBuiltin();
  if (!isBuiltin()) { fill($("reader")); return; }
  setText($("readerSum"), ui("reader"));
  const counting = state.counting, r = M.readerView(counting ? "kjv" : M.wordingFor(state)), chosen = M.wordingFor(state);
  const marks = counting ? M.countMarks(counting.words) : null;
  fill($("reader"), 
    r.head ? h("p", { id: "readerHead" }, tag(r.head.layer), r.head.text) : null,
    r.canSwitch ? h("div", { class: "seg gap", role: "group", "aria-label": "Which wording" }, [M.WORDINGS.supplied, M.WORDINGS.kjv].map((w) => h("button", {
      type: "button", "data-key": "wording-" + w.key, "aria-pressed": String(w.key === chosen),
      onclick: act(() => { Object.assign(state, M.setWording(state, w.key)); render("say", "reader", "explain"); }),
    }, w.label))) : null,
    counting ? h("div", { class: "gap" }, line({ layer: "checked", text: "Counted: " + M.timesWord(marks.reduce((n, v) => n + v.times, 0)) + " in these nine verses. Count with me." }), countLine(), note(M.COUNT_NOTE)) : null,
    r.verses.map((v, n) => h("p", { class: "verse reader-verse" },
      inlineButton(String(v.number), act(() => select(v.address)), { class: "vnum", "data-key": "rverse-" + v.address, "data-address": v.address, "aria-label": v.name, "aria-pressed": String(state.selected === v.address) }),
      marks ? marks[n].spans.map((s) => (s.hit ? h("mark", null, s.text) : s.text)) : v.spans.map((s) => (s.term ? termButton(s, "r") : s.text)))),
    note(counting ? M.WORDINGS.kjv.translation : M.WORDINGS[r.wording].translation),
    r.foot && !counting ? [note(r.foot.notice), note(r.foot.note)] : null);
}

// ─── region: the tree's tools, caption, list and navigation ──────────────────

const NUDGES = [["nudgeLeft", "left", "nudgeLeft"], ["nudgeRight", "right", "nudgeRight"], ["nudgeUp", "up", "nudgeUp"], ["nudgeDown", "down", "nudgeDown"]];
const TURNS = [["turnUp", "up", "turnUp"], ["turnLeft", "left", "turnLeft"], ["turnRight", "right", "turnRight"], ["turnDown", "down", "turnDown"]];
const NAVS = [["navHome", "home"], ["navUp", "up"], ["navPrev", "prev"], ["navNext", "next"]];
const idOf = new Map();   // the static controls, looked up once
function staticControls() {
  idOf.set("nudgeUp", $("nudgeUp")); idOf.set("nudgeLeft", $("nudgeLeft")); idOf.set("nudgeRight", $("nudgeRight")); idOf.set("nudgeDown", $("nudgeDown"));
  idOf.set("turnUp", $("turnUp")); idOf.set("turnLeft", $("turnLeft")); idOf.set("turnRight", $("turnRight")); idOf.set("turnDown", $("turnDown"));
  idOf.set("navHome", $("navHome")); idOf.set("navUp", $("navUp")); idOf.set("navPrev", $("navPrev")); idOf.set("navNext", $("navNext"));
  idOf.set("entry", $("tabEntry")); idOf.set("wheel", $("tabWheel")); idOf.set("chain", $("tabChain")); idOf.set("overwatch", $("tabOverwatch")); idOf.set("witnesses", $("tabWitnesses"));
}
function renderTools() {
  const ball = state.dims === "3D";
  for (const [id, , key] of NUDGES) idOf.get(id).setAttribute("aria-label", ui(key));
  for (const [id, , key] of TURNS) { const b = idOf.get(id); b.setAttribute("aria-label", ui(key)); b.hidden = !ball; }
  $("dims2d").setAttribute("aria-pressed", String(!ball));
  $("dims3d").setAttribute("aria-pressed", String(ball));
  setText($("dims2d"), ui("flat"));
  setText($("dims3d"), ui("ball"));
  const corner = $("dimsBtn");
  corner.setAttribute("aria-pressed", String(ball));
  setText(corner, ui("ball"));
  const notes = state.notes || [];
  $("linkNote").hidden = notes.length === 0;
  setText($("linkNote"), notes.join(" "));
  showCaption();
}
function showCaption() { if (tree) setText($("treeCap"), M.treeCaption(lex(), tree.scene, state.lens)); }
function renderNav() {
  const nav = M.treeNav(lex(), tree ? tree.view.focus : lex().home);
  for (const [id, key] of NAVS) {
    const b = idOf.get(id);
    setText(b, ui(key));
    // Home always works: it brings the home entry back to the middle, also after a nudge or a drag.
    if (key !== "home" && nav[key] === null) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
  }
}
function renderList() {
  const items = M.neighbourhood(lex(), listFocus, state.lens);
  setText($("listSum"), ui("list"));
  $("list").setAttribute("aria-label", ui("list"));
  fill($("list"), ...items.map((it) => h("li", { role: "none", style: { "padding-left": (Math.min(it.level - 1, 6) * 10).toFixed(0) + "px" } }, h("button", {
    type: "button", role: "treeitem", id: "e-" + it.address, "data-key": "e-" + it.address, "data-address": it.address,
    "aria-level": String(it.level), "aria-selected": String(state.selected === it.address), "aria-current": it.relation === "focus" ? "location" : null,
    class: it.relation === "focus" ? "centre" : null,
    onclick: act(() => { select(it.address); const again = document.getElementById("e-" + it.address); if (again) again.focus({ preventScroll: true }); }),
  }, mark(it.badge), h("span", null, own(it.name)),
  (!isStar() || isOutside()) && it.address !== "" ? h("span", { class: "note" }, it.address + (it.children ? " · " + it.children : "")) : null))));
}
/** The keys of the keyboard tree: they act only while the focus is in the list. */
function onListKey(e) {
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home"].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
  const item = e.target instanceof Element ? e.target.closest("[data-address]") : null;
  if (!item) return;
  e.preventDefault();
  const target = M.treeKey(lex(), item.getAttribute("data-address"), e.key);
  if (target === null || !M.hasPlace(lex(), target)) return;
  tree.flyTo(target);
  listFocus = target;
  renderList();
  renderNav();
  const next = document.getElementById("e-" + target);
  if (next) next.focus({ preventScroll: true });
  say(M.statusFor(lex(), target, state.lens));
}

// ─── region: the tabs and the Entry ──────────────────────────────────────────

function renderExplain() {
  const tabs = M.visibleTabs(state.lens, { origin: lex().origin, sealed: !!state.seal, sent: !!state.send });
  if (!tabs.some((t) => t.key === state.tab)) state.tab = "entry";
  $("tabs").hidden = tabs.length < 2;
  fill($("tabs"), ...tabs.map((t) => h("button", {
    type: "button", id: "tabBtn-" + t.key, "data-key": "tab-" + t.key, "aria-pressed": String(t.key === state.tab),
    onclick: act(() => { state.tab = t.key; renderExplain(); }),
  }, t.label)));
  for (const t of M.TABS) idOf.get(t.key).hidden = t.key !== state.tab;
  if (state.tab === "entry") renderEntry();
  else if (state.tab === "wheel") renderWheel();
  else if (state.tab === "chain") renderChain();
  else if (state.tab === "overwatch") renderOverwatch();
  else if (state.tab === "witnesses") renderWitnesses();
  if (isStar() && state.station === "seal") renderWheel();
}

const HEADINGS = new Map(M.ENTRY_GROUPS.map((g) => [g.key, g.heading]));
function authorNodes(a) {
  if (!a) return [];
  return [h("p", { class: "label gold" }, a.label), h("blockquote", null, a.quoted),
    a.framing ? h("p", null, tag("reading"), a.framing) : null,
    a.facet ? h("p", { class: "entry-row" }, mark(a.facet.badge), isStar() ? null : [h("b", null, a.facet.name), " "], a.facet.text) : null];
}
function linkNodes(link, name) {
  if (!link) return [];
  if (!link.exists) return [h("p", { class: "entry-row" }, name ? [own(name), " "] : null, h("span", { class: "note" }, M.BROKEN_LINK))];
  return [name ? h("p", { class: "entry-row" }, own(name)) : null,
    link.layer === "text" && link.text ? h("blockquote", null, mark(link.badge), isOutside() ? own(link.text) : M.quoted(link.text), h("span", { class: "note" }, " ", own(link.name))) : null,
    h("p", null, mark(link.layer === "text" ? null : link.badge), button(["Go to ", own(link.name)], () => select(link.target), { class: "btn ghost", "data-key": "go-" + link.target, "data-address": link.target }))];
}
function countWith(address) {
  const c = M.countWithMe(lex(), address);
  if (!c) return;
  startCount(c.words, null);
  render("say", "reader");
  say("Counted: " + M.timesWord(c.inReader) + " in these nine verses.");
}
function rowNode(r) {
  if (r.author) return h("div", { class: "entry-row" }, authorNodes(M.entryView(lex(), r.address, state.lens).author),
    h("p", null, button("Open " + r.name, () => select(r.address), { class: "btn ghost", "data-key": "row-" + r.address, "data-address": r.address })));
  if (r.link) return h("div", { class: "entry-row" }, h("p", null, mark(r.badge), own(r.name)), linkNodes(r.link, null));
  const opens = r.children > 0 || r.group === "parts", plain = r.group === "plain";
  const kids = [mark(r.badge)];
  if (opens) kids.push(button([own(r.name), isOutside() ? " " + r.address : null], () => select(r.address), { class: "btn ghost", "data-key": "row-" + r.address, "data-address": r.address }));
  else if (!(plain && isStar())) kids.push(h("b", null, own(r.name)), isOutside() ? " " + r.address : null, " ");
  if (r.text && !(opens && isStar())) kids.push(own(r.text));
  if (r.countWithMe) kids.push(" ", button("Count with me", () => countWith(r.address), { "data-key": "cwm-" + r.address }));
  return h("p", { class: "entry-row" }, kids);
}
function groupNodes(rows, headings) {
  const out = [];
  let last = null;
  for (const r of rows) {
    if (headings && r.group !== last) { out.push(h("h3", null, HEADINGS.get(r.group) || "")); last = r.group; }
    out.push(rowNode(r));
  }
  return out;
}
function entryNodes(v) {
  const out = [], term = v.kind === "term" && v.words.length > 0;
  out.push(h("h2", { id: "entryTitle", tabindex: "-1" }, own(term ? v.words[0].text : v.name)));
  if (!v.root && (v.show.address || isOutside())) out.push(h("p", { class: "note", id: "entryMeta" }, v.address, v.show.kind || isOutside() ? [" · ", own(v.kind)] : null));
  if ((v.show.path || isOutside()) && v.path.length > 1) out.push(h("nav", { class: "crumbs", "aria-label": "The path from the top" }, v.path.slice(0, -1).map((p) =>
    button(own(p.crumb), () => select(p.address), { class: "btn ghost", "data-key": "crumb-" + p.address, "data-address": p.address }))));
  if (v.author) out.push(...authorNodes(v.author));
  else if (v.words.length) out.push(...v.words.map((w, i) => h("blockquote", { class: "words" }, i === 0 ? mark(v.badge) : null, M.quoted(w.text), h("span", { class: "note" }, w.translation))));
  else if (v.link) out.push(h("p", null, mark(v.badge)), ...linkNodes(v.link, null));
  else if (v.badge) out.push(h("p", { id: "entryText" }, mark(v.badge), v.text ? own(v.text) : null));
  out.push(...groupNodes(v.first, !isStar()));
  if (v.more.length) {
    const more = h("details", { class: "more more-rows" }, h("summary", { "data-key": "more-rows" }, v.moreLabel), h("div", { class: "more-body" }, groupNodes(v.more, true)));
    more.open = moreOpenFor === v.address;
    more.addEventListener("toggle", () => { moreOpenFor = more.open ? v.address : moreOpenFor === v.address ? null : moreOpenFor; });
    out.push(more);
  }
  if (v.actions.length) out.push(h("p", { class: "entry-row" }, v.actions.map((a) => (a.href
    ? h("a", { class: "btn", href: a.href, "data-key": "act-" + a.key }, a.label)
    : button(a.label, () => countWith(v.address), { "data-key": "act-" + a.key })))));
  if (v.line) out.push(h("h3", null, "The line and its SHA-256"), h("p", { class: "hash" }, own(v.line)), h("p", { class: "hash" }, v.lineSha));
  return out;
}
function renderEntry() {
  const v = M.entryView(lex(), state.selected, state.lens, { wording: M.wordingFor(state) }), kids = [];
  if (v.empty) kids.push(h("h2", { id: "entryTitle", tabindex: "-1" }, isBuiltin() ? v.prompt : "Choose an entry on the map or in the list"),
    isOutside() ? null : h("div", { class: "gap", id: "entryLegend" }, layerLegend({ lens: state.lens, help: isStar() })));
  else if (v.missing) kids.push(h("h2", { id: "entryTitle", tabindex: "-1" }, "Entry"), h("p", null, v.note));
  else kids.push(...entryNodes(v));
  const sv = stationNow();
  if (sv && sv.next) kids.push(h("p", { class: "entry-row" }, button(sv.next.label, goNext, { class: "btn gold", id: "nextBtn", "data-key": "next" })));
  if (v.foot) kids.push(h("p", { class: "note gap", id: "entryFoot" }, v.foot.notice), note(v.foot.note));
  fill(idOf.get("entry"), ...kids);
}

// ─── the word wheel (the Wheel tab; at Stargazer inside "Stamp it") ──────────

const wheelHostStar = h("div", { id: "wheelHostStar" });
function buildWheel() {
  const canvas = h("canvas", { class: "wheel-canvas", id: "wheelCanvas" });
  const p = {
    canvas, cap: h("p", { class: "cap", id: "wheelCap" }), hex: h("p", { class: "hash", id: "wheelHex" }), packet: h("span", { class: "note", id: "wheelPacket" }),
    sector: h("div", { class: "row", id: "wheelSector" }), readout: h("div", { id: "wheelReadout" }), captions: h("div", { id: "wheelCaptions" }),
    author: h("div", { id: "wheelAuthor" }), views: [], bits: [],
    reset: button(ui("reset"), () => { state.wheel = { ...state.wheel, flips: [] }; renderWheel(); }, { class: "btn ghost", id: "wheelReset", "data-key": "wheel-reset" }),
  };
  const step = (d) => () => { const n = M.packetsOf(lex()).length; state.wheel = { ...state.wheel, packet: (state.wheel.packet + d + n) % n, flips: [], sector: null }; renderWheel(); };
  p.views = M.WHEEL_COPY.views.map((v) => h("button", { type: "button", "data-key": "wheelview-" + v.key, "data-view": v.key, onclick: act(() => { state.wheel.view = v.key; renderWheel(); }) }, v.label));
  for (let i = 0; i < 64; i++) p.bits.push(h("button", { type: "button", "data-key": "bit-" + i, onclick: act(() => { state.wheel.flips = M.toggleFlip(state.wheel.flips, i); renderWheel(); }) }, "0"));
  wheelParts = p;
  wheelBlock = h("div", { class: "stack", id: "wheelBlock" },
    h("div", { class: "seg", role: "group", "aria-label": "Wheel or square" }, p.views),
    h("div", { class: "row" }, button("‹", step(-1), { class: "btn ghost", "data-key": "packet-prev", "aria-label": "The one before" }), p.packet,
      button("›", step(1), { class: "btn ghost", "data-key": "packet-next", "aria-label": "The next one" }),
      button("Of the chosen entry", () => { state.wheel = { ...state.wheel, packet: M.packetOfEntry(lex(), state.selected), flips: [], sector: null }; renderWheel(); }, { class: "btn ghost", "data-key": "packet-entry" })),
    canvas, p.cap, p.hex, note(M.WHEEL_COPY.pick), p.sector,
    h("div", { class: "bitgrid-wrap" }, h("div", { class: "bitgrid", role: "group", "aria-label": M.WHEEL_COPY.squareLabel }, p.bits)),
    p.readout, h("p", null, p.reset),
    p.captions, p.author);
  wheel = createWordWheel(canvas, { view: state.wheel.view, onPick: (hit) => {
    state.wheel.sector = hit.sector;
    renderWheel();
    const first = p.sector.querySelector("button");
    if (first) first.focus({ preventScroll: true });
  } });
}
function renderWheel() {
  if (!wheelBlock) buildWheel();
  const host = isStar() ? wheelHostStar : idOf.get("wheel");
  if (wheelBlock.parentNode !== host) host.append(wheelBlock);
  const p = wheelParts, w = M.wheelView(lex(), state.wheel, state.lens);
  const room = wheelBlock.clientWidth, view = room > 0 && room < 300 ? "square" : state.wheel.view === "square" ? "square" : "wheel";
  wheel.set({ word: w, view, sector: state.wheel.sector });
  describeCanvas(p.canvas, view === "square" ? M.WHEEL_COPY.squareLabel : M.WHEEL_COPY.label, p.cap);
  for (const b of p.views) b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === view));
  setText(p.packet, ui("packet") + " " + (w.index + 1) + " of " + w.count);
  setText(p.cap, M.WHEEL_COPY.perLens[state.lens].text);
  setText(p.hex, w.hex + (w.changed ? "  (was " + w.crystal + ")" : ""));
  p.hex.hidden = isStar();
  const s = state.wheel.sector;
  fill(p.sector, ...(s === null ? [] : [h("span", { class: "note" }, "Slice " + (s + 1) + " of 16, the letter " + w.digits[s] + ":"),
    ...M.sectorLights(w.hex, s).map((l) => button(l.label, () => { state.wheel.flips = M.toggleFlip(state.wheel.flips, l.i); renderWheel(); },
      { class: "btn light", "data-key": "light-" + l.i, "aria-pressed": String(l.on) }))]));
  w.cells.forEach((c) => {
    const b = p.bits[c.i];
    b.setAttribute("aria-pressed", String(c.on));
    b.setAttribute("aria-label", c.name);
    b.classList.toggle("guard", c.guard);
    setText(b, c.on ? "1" : "0");
  });
  fill(p.readout, ...w.readout.map(line));
  setText(p.reset, ui("reset"));
  fill(p.captions, ...(isStar() ? [line(M.WHEEL_COPY.stargazerWheel)] : [line(M.WHEEL_COPY.ladder), line(M.WHEEL_COPY.parity)]));
  const a = M.wheelAuthorLine(lex(), state.lens);
  fill(p.author, ...(a ? [h("p", { class: "label gold gap" }, a.label), h("blockquote", null, a.quoted),
    h("p", null, mark(a.facet.badge), isStar() ? null : [h("b", null, a.facet.name), " "], a.facet.text)] : []));
}

// ─── the Chain, Overwatch and Witnesses tabs ─────────────────────────────────

const LIMITS = (M.DIALOG.sections.find((s) => s.heading === "Limits to keep in mind") || { items: [] }).items;
const kv = (rows) => h("dl", { class: "kv" }, rows.map((r) => [h("dt", null, r.label), h("dd", { class: r.hash ? "hash" : null }, r.value)]));
const table = (heads, rows) => h("div", { class: "table-wrap" }, h("table", null, h("thead", null, h("tr", null, heads.map((x) => h("th", { scope: "col" }, x)))), h("tbody", null, rows.map((r) => h("tr", null, r.map((c) => h("td", null, c)))))));
const hashCell = (text) => h("span", { class: "hash" }, text);
function downloadButton() {
  return h("p", { class: "entry-row" }, button(ui("download"), () => { if (isSealed() && state.seal.fileName) { downloadText(state.seal.fileName, state.seal.wire); say("The file " + state.seal.fileName + " was saved."); } },
    { "data-key": "download", "data-download": "package" }), state.sky ? h("span", { class: "note" }, M.SKY_PRIVACY) : null);
}
function renderChain() {
  const host = idOf.get("chain"), s = state.seal;
  if (!s || !s.ok) { fill(host, h("h2", null, "Chain"), h("p", null, M.sealView(s, state.lens).verdict)); return; }
  const v = M.sealView(s, state.lens), holo = state.lens === "holographer", lineage = s.bundle.lineage || [];
  fill(host, h("h2", null, "Chain"), line({ layer: "checked", text: v.verdict }), kv(v.rows),
    h("h3", null, "Epochs"), LIMITS[0] ? line(LIMITS[0]) : null,
    table(["Epoch", "Top-level entry", "Chain name"], M.epochRows(lex()).map((r, i) => [String(r.epoch), r.address + " " + r.name, hashCell(lineage[i] ? lineage[i].chainId : "")])),
    h("h3", null, "Ledger"), LIMITS[1] ? line(LIMITS[1]) : null,
    table(holo ? ["No.", "Actor", "Event", "Time", "Detail"] : ["No.", "Actor", "Event", "Time"],
      (s.bundle.trace || []).map((e) => [String(e.n), e.actor, e.event, e.at].concat(holo ? [hashCell(e.detail)] : []))));
}
function renderOverwatch() {
  const host = idOf.get("overwatch");
  if (isOutside()) { fill(host, ...outsideNodes()); return; }
  const s = state.seal, v = M.sealView(s, state.lens);
  if (!s || !s.ok) { fill(host, h("h2", null, "Overwatch"), h("p", null, v.verdict), checkList(v.checks, { sentences: M.CHECK_SENTENCES })); return; }
  const c = s.certificate;
  fill(host, h("h2", null, "Overwatch"), line({ layer: "checked", text: v.verdict }), checkList(v.checks, { sentences: M.CHECK_SENTENCES }),
    h("h3", null, "The certificate"),
    kv([{ label: "Format", value: c.format }, { label: "Signed by key", value: c.sealId + " (a key made for this visit)", hash: true }, { label: "Issued at", value: c.issuedAt },
      { label: "The signed line", value: c.commitment, hash: true }]),
    LIMITS[2] ? line(LIMITS[2]) : null, M.CERTIFIED.map(line), downloadButton());
}
function outsideNodes() {
  const o = state.outside && state.outside.result;
  if (!o || !o.covered) return [h("h2", null, "Checks")];
  const c = o.covered, text = (x) => outsideText(String(x));
  return [h("h2", null, "Checks on the loaded package"), h("p", null, o.notice), checkList(o.checks, { sentences: M.CHECK_SENTENCES, outside: true }),
    h("p", { class: "gap", id: "outsideSignature" }, text(o.signature)),
    h("h3", null, "Covered by the signature"),
    h("dl", { class: "kv" }, [["Chain name", c.chainId], ["Merkle root", c.merkleRoot], ["Epochs", c.epoch], ["Entries", c.entries], ["Lexicon root", c.lexiconRoot], ["The signed line", c.commitment]]
      .map(([k, x]) => [h("dt", null, k), h("dd", { class: "hash" }, text(x))])),
    h("h3", null, "Ledger, as its sender wrote it"),
    table(["No.", "Actor", "Event", "Time"], c.ledger.map((e) => [text(e.n), text(e.actor), text(e.event), text(e.at)])),
    h("h3", null, o.notCovered.heading),
    h("dl", { class: "kv" }, o.notCovered.items.map((it) => [h("dt", null, it.label), h("dd", null, text(it.value))]))];
}
function renderWitnesses() {
  const host = idOf.get("witnesses"), s = state.send;
  if (!s) { fill(host, h("h2", null, "Witnesses")); return; }
  fill(host, h("h2", null, "Witnesses"), h("p", null, tag("checked"), s.k + " of " + s.of + " handshakes"),
    table(["Receiver", "Road", "Answer", "Counted", "Its key"], s.rows.map((r) => [r.city, r.noise ? "noise" : "clear", r.accepted ? "accepted" : "refused at " + r.failed, r.counted ? "yes" : "no", hashCell(r.sealId)])),
    h("ul", { class: "marks-list" }, s.marks.map((m) => h("li", null, (m.met ? "✓ " : "· ") + m.label + (m.met ? "" : " (not met)")))),
    line({ layer: "checked", text: s.sentence }), line(M.SEND_READING));
}

// ─── region: the gold box ────────────────────────────────────────────────────

function standNode(x) {
  const open = x.source && M.hasPlace(lex(), x.source)
    ? button("Open " + M.nameOf(lex(), x.source), () => select(x.source), { class: "btn ghost", "data-key": "stand-" + x.source, "data-address": x.source }) : null;
  if (x.layer === "text") return h("p", { class: "entry-row" }, tag("text"), M.quoted(x.text), " ", h("span", { class: "note" }, x.name), " ", open);
  return h("p", { class: "entry-row" }, tag(x.layer), x.text, " ", open);
}
function renderBridge() {
  const sv = stationNow(), b = sv && sv.bridge, box = $("bridge");
  box.hidden = !b;
  if (!b) { fill(box); return; }
  const lead = b.opening || b.reading, s = M.sentencesOf(lead.text);
  fill(box, foldBox(
    [h("p", { class: "label gold" }, b.title + " · " + M.BRIDGE_PARTS.reading), h("p", { id: "bridgeFirst" }, tag(lead.layer), s[0])],
    [s.length > 1 ? h("p", null, s.slice(1).join(" ")) : null, b.opening ? h("p", { class: "gap" }, tag(b.reading.layer), b.reading.text) : null,
      h("div", { class: "bridge-stands" }, h("p", { class: "label" }, M.BRIDGE_PARTS.stands), b.stands.map(standNode))],
    { about: "about the bridge" }));
}

// ─── region: the rest of the station ─────────────────────────────────────────

const STATION_MORE = new Map([["read", "More from STRIX"], ["count", "The count table"], ["place", "The path between the two entries"], ["layers", "More about the kinds"],
  ["seal", "Try to change what was sealed"], ["send", "The rule and the receivers"], ["fourth", "The five figures"]]);
function tamperNodes() {
  return M.tamperRows(state.lens).map((r) => {
    const t = state.tampers[r.key];
    return h("div", { class: "tamper" },
      h("button", { type: "button", class: "btn warn", id: "tamper-" + r.key, "data-key": "tamper-" + r.key, "data-busy-lock": true, onclick: () => { doTamper(r.key); } }, r.label),
      t ? h("p", { "data-tamper": r.key }, t.verdict ? [tag("checked"), h("b", null, t.verdict + ". ")] : null, t.sentence,
        t.accepted && t.sealId && !isStar() ? h("span", { class: "hash" }, " Signed by key " + t.sealId + ".") : null) : null);
  });
}
function stationNodes() {
  const key = state.station;
  if (key === "count" && isBuiltin()) {
    return [table(["Word", "Times", "Verses", "What it numbers"], M.countTable().map((r) => [r.word, String(r.times), r.verses.join(", "), r.numbers.map((n) => n.words).join("; ")])), note(M.COUNT_NOTE)];
  }
  if (key === "place") {
    const p = M.placeNumbers(lex(), state.dims, state.place.from, state.place.to);
    const setEnd = (end) => () => {
      if (state.selected === null) { say("Choose an entry first."); return; }
      state.place = { ...state.place, [end]: state.selected };
      render("say", "station");
    };
    const ends = h("div", { class: "row" },
      button(ui("from") + ": use the chosen entry", setEnd("from"), { class: "btn ghost", id: "placeFrom", "data-key": "place-from" }),
      button(ui("to") + ": use the chosen entry", setEnd("to"), { class: "btn ghost", id: "placeTo", "data-key": "place-to" }));
    if (!p.ok) return [h("p", null, p.sentence), ends];
    return [ends, h("dl", { class: "kv gap" }, h("dt", null, M.PLACE_LABELS.steps), h("dd", null, String(p.steps)), h("dt", null, M.PLACE_LABELS.straight), h("dd", null, p.straight.toFixed(2))),
      h("h3", { class: "gap" }, "The path"), h("ol", null, p.path.map((x) => h("li", null, own(x.name), x.address ? h("span", { class: "note" }, " " + x.address) : null)))];
  }
  if (key === "seal") {
    return [isStar() && isSealed() ? line(M.CERTIFIED_STARGAZER) : null, isSealed() ? downloadButton() : null,
      h("h3", { class: "gap" }, isStar() ? "Try to change it" : "The tampers"), tamperNodes(), isStar() ? h("div", { class: "fig-part" }, h("h3", null, "The word wheel"), wheelHostStar) : null];
  }
  if (key === "send") {
    const sv = stationNow(), s = state.send;
    return [s ? h("div", { class: "only-narrow" }, h("ul", { class: "marks-list", id: "sendRowsBox" }, s.rows.map(receiverLine)), markList(s)) : null,
      sv && sv.verse ? h("p", null, tag("text"), M.quoted(sv.verse.text), " ", h("span", { class: "note" }, sv.verse.name)) : null,
      s ? line({ layer: "checked", text: s.sentence }) : null];
  }
  if (key === "fourth" && isBuiltin()) { if (!fourth) buildFourth(); showFourth(); return [fourth.block]; }
  return [];
}
function renderStation() {
  const sv = stationNow(), box = $("stationBox");
  if (!sv) { box.hidden = true; fill($("stationBody")); return; }
  const rest = sayItems(sv), nodes = stationNodes().filter((n) => n !== null);
  box.hidden = rest.length === 0 && nodes.length === 0;
  box.classList.toggle("only-narrow", nodes.length === 0);
  setText($("stationSum"), STATION_MORE.get(sv.key) || "More at this station");
  fill($("stationBody"), rest.length ? h("div", { class: "only-narrow stack" }, rest.map(line)) : "",
    state.sky && !isBuiltin() && !isOutside() ? h("p", { class: "note only-narrow" }, M.SKY_PRIVACY) : "", ...nodes);
  if (isStar() && state.station === "seal") renderWheel();
}

// ─── station 7: the five figures ─────────────────────────────────────────────

function buildFourth() {
  const parts = new Map(M.FOURTH_PARTS.map((p) => [p.key, p]));
  const make = (key, cls) => { const canvas = h("canvas", { class: "fig " + cls }), cap = h("p", { class: "cap" }); describeCanvas(canvas, parts.get(key).title, cap); return { canvas, cap }; };
  const a = make("a", "fig-a"), b = make("b", "fig-b"), c = make("c", "fig-c"), d = make("d", "fig-d"), e = make("e", "fig-e");
  const part = (key, ...kids) => h("section", { class: "fig-part", "aria-label": parts.get(key).title }, h("h3", null, parts.get(key).title), line(parts.get(key).say), kids);
  const sq = state.square;
  const figA = createFigure(a.canvas, "three", { onPoints: (points) => { sq.points = points; showFourth(); } });
  setText(figA.pointer.dragSwitch, "Drag the points");          // this switch drags the three points, not a map
  setText(figA.pointer.dragCaption, "Dragging is on. Scroll the page from outside the figure.");
  const figB = createFigure(b.canvas, "mirror", { onPick: (hit) => {
    if (hit.part === "seed") sq.seed = sq.seed.map((x, k) => (k === hit.index ? 1 - x : x));
    else if (hit.part === "fourth") { sq.hidden = false; sq.wrongBit = sq.wrongBit === hit.index ? null : hit.index; }
    else sq.hidden = !sq.hidden;
    showFourth();
  } });
  const figC = createFigure(c.canvas, "quarters"), figD = createFigure(d.canvas, "squares"), figE = createFigure(e.canvas, "corners");
  const seeds = [0, 1, 2, 3].map((k) => button("Light " + (k + 1), () => { sq.seed = sq.seed.map((x, j) => (j === k ? 1 - x : x)); showFourth(); }, { class: "btn ghost", "data-key": "seed-" + k }));
  const hide = button(ui("hide"), () => { sq.hidden = !sq.hidden; showFourth(); }, { class: "btn ghost", "data-key": "mirror-hide" });
  const wrong = button(ui("wrong"), () => { sq.hidden = false; sq.wrongBit = sq.wrongBit === null ? 5 : null; showFourth(); }, { class: "btn ghost", "data-key": "mirror-wrong" });
  const packet = h("span", { class: "note" });
  const stepC = (dd) => () => { const n = M.packetsOf(lex()).length; sq.packet = (sq.packet + dd + n) % n; showFourth(); };
  const block = h("div", { id: "fourthBlock" },
    part("a", a.canvas, h("div", { class: "row" }, figA.pointer.dragSwitch), figA.pointer.dragCaption, a.cap,
      h("div", { class: "row", role: "group", "aria-label": "Three ready sets of points" }, M.TQF_PRESETS.map((p) => button(p.label, () => { sq.points = p.points.map((q) => q.slice()); showFourth(); }, { class: "btn ghost", "data-key": "preset-" + p.key })))),
    part("b", b.canvas, b.cap, h("div", { class: "row", role: "group", "aria-label": "The four seed lights" }, seeds), h("div", { class: "row" }, hide, wrong)),
    part("c", h("div", { class: "row" }, button("‹", stepC(-1), { class: "btn ghost", "data-key": "quarter-prev", "aria-label": "The one before" }), packet,
      button("›", stepC(1), { class: "btn ghost", "data-key": "quarter-next", "aria-label": "The next one" })), c.canvas, c.cap),
    part("d", d.canvas, d.cap), part("e", e.canvas, e.cap),
    h("div", { class: "fig-part" }, h("p", null, tag("text"), M.quoted(M.FOURTH_VERSE.text), " ", h("span", { class: "note" }, M.FOURTH_VERSE.name)), M.CERTIFIED.map(line)));
  const dd = M.squaresFigure(), ee = M.cornersFigure();
  figD.set(dd); setText(d.cap, dd.sentence);
  figE.set(ee); setText(e.cap, ee.flat.sentence + " " + ee.curved.sentence);
  fourth = { block, figA, figB, figC, a, b, c, seeds, hide, packet };
}
function showFourth() {
  const f = fourth, sq = state.square;
  const da = M.threeSquares(sq.points);
  f.figA.set(da); setText(f.a.cap, da.sentence);
  const db = M.mirrorFigure(sq.seed, { hidden: sq.hidden, wrongBit: sq.wrongBit });
  f.figB.set(db, { stage: 3 }); setText(f.b.cap, db.sentences.map((s) => s.text).join(" "));
  f.seeds.forEach((b, k) => b.setAttribute("aria-pressed", String(db.seed[k] === 1)));
  setText(f.hide, sq.hidden ? ui("show") : ui("hide"));
  const packets = M.packetsOf(lex()), i = Math.min(packets.length - 1, Math.max(0, sq.packet)), dc = M.quarterFigure(packets[i]);
  f.figC.set(dc); setText(f.c.cap, dc.sentence);
  setText(f.packet, ui("packet") + " " + (i + 1) + " of " + packets.length);
}

// ─── jobs: seal, tamper, send, load (one busy flag; they never overlap) ──────

async function doSeal() {
  const sealing = lex();
  const done = await withBusy(state, () => M.sealLexicon(sealing, { onEpoch: async (p) => {
    const where = $("sealProgress");
    if (where) setText(where, ui("sealing") + ": " + M.epochLine(p, state.lens));
    await nextPaint();
  } }));
  if (!done.ran || lex() !== sealing) return;
  Object.assign(state, { seal: done.value, tampers: {}, send: null, sendNote: "" });
  state.tab = M.tabFor(state);
  keepFocus(() => render("say", "station", "explain"));
  holdFocus($("say"));
  say(M.sealView(state.seal, state.lens).verdict);
}
async function doTamper(key) {
  if (!isSealed()) {
    state.tampers[key] = { verdict: "", sentence: isStar() ? "Stamp it first." : "Seal the lexicon first.", accepted: false, sealId: null };
    keepFocus(renderStation);
    say(state.tampers[key].sentence);
    return;
  }
  const done = await withBusy(state, () => M.runTamper(state.seal, key, { lens: state.lens }));
  if (!done.ran) return;
  state.tampers[key] = done.value;
  keepFocus(renderStation);
  holdFocus($("stationBox"));
  say(done.value.verdict + ". " + done.value.sentence);
}
async function doSend() {
  if (!isSealed()) { state.sendNote = "Seal the lexicon first: the Seal station makes the package that is sent."; keepFocus(() => render("say")); say(state.sendNote); return; }
  const seal = state.seal;
  const done = await withBusy(state, async () => {
    const receivers = await M.makeReceivers(), rows = $("sendRows");
    if (rows) fill(rows);
    let n = 0;
    return M.sendToReceivers(seal, receivers, { noise: state.noise, onAnswer: async (row) => {
      n += 1;
      if (rows) rows.append(receiverLine(row));
      const where = $("sendProgress");
      if (where) setText(where, row.city + ": " + (row.accepted ? "accepted" : "refused") + " (" + n + " of " + receivers.length + ")");
      await nextPaint();
    } });
  });
  if (!done.ran || state.seal !== seal) return;
  state.send = done.value;
  state.sendNote = "";
  state.tab = M.tabFor(state);
  keepFocus(() => render("say", "station", "explain"));
  holdFocus($("say"));
  say(state.send.k + " of " + state.send.of + " receivers accepted.");
}
async function onLoad(e) {
  const input = e.currentTarget, file = input.files && input.files[0];
  if (!file) return;
  if (isOutside()) showLexicon(M.EZEKIEL, "builtin");
  if (!M.fileAllowed(file.size)) { state.outside = { result: null, shown: false, note: M.LOAD_COPY.tooLarge }; input.value = ""; renderAside(); say(M.LOAD_COPY.tooLarge); return; }
  const done = await withBusy(state, async () => {
    let text = null;
    try { text = await file.text(); } catch { return null; }
    return M.readOutside(text);
  });
  input.value = "";
  if (!done.ran) return;
  state.outside = done.value ? { result: done.value, shown: false, note: "" } : { result: null, shown: false, note: "That file could not be read." };
  renderAside();
  say(done.value && done.value.ok ? "The package passed its checks. It is not shown yet." : M.LOAD_COPY.refused);
}
function renderAside() {
  $("loadBox").hidden = isStar() && !isOutside() && !state.outside;
  const o = state.outside, out = [];
  if (o && o.note) out.push(h("p", null, o.note));
  if (o && o.result) {
    const r = o.result, options = { sentences: M.CHECK_SENTENCES, outside: true };
    if (!r.ok) {
      const at = r.checks.findIndex((c) => c.ok === false);
      out.push(h("p", { id: "loadRefused" }, r.line), checkList(at < 0 ? r.checks : r.checks.slice(0, at + 1), options));
    } else if (r.kind === "journey") out.push(checkList(r.checks, options), h("p", { id: "loadJourney" }, r.line));
    else if (!o.shown) out.push(h("p", { id: "loadNotice" }, r.notice), checkList(r.checks, options),
      h("p", { class: "gap" }, button(M.SHOW_IT, () => { showLexicon(r.lexicon, "outside"); say(M.OUTSIDE_BANNER); }, { id: "showItBtn", "data-key": "show-it" })));
    else out.push(h("p", null, r.banner));
  }
  fill($("loadOut"), ...out);
}

// ─── the legend and the dialog ───────────────────────────────────────────────

// The badge help is shown once at the Stargazer lens (in the empty Entry) and always in the dialog.
function renderLegend() { fill($("legend"), layerLegend({ lens: state.lens, help: !isStar() })); }
function renderAbout() {
  const d = M.DIALOG;
  fill($("aboutBody"), line(d.first), h("h3", null, "In short"), ...d.inShort.map(line),
    ...d.sections.map((s) => h("section", null, h("h3", null, s.heading), s.items.map(line))));
}

// ─── rendering by region ─────────────────────────────────────────────────────

const REGIONS = new Map([["strip", renderStrip], ["say", renderSay], ["reader", renderReader], ["tools", renderTools], ["nav", renderNav], ["list", renderList],
  ["explain", renderExplain], ["bridge", renderBridge], ["station", renderStation], ["aside", renderAside], ["legend", renderLegend]]);
/** render("say", "explain", …): rebuilds the named regions only. */
function render(...names) { for (const name of names) REGIONS.get(name)(); }
function renderAll() { document.body.setAttribute("data-lens", state.lens); render(...REGIONS.keys()); }

// ─── start ───────────────────────────────────────────────────────────────────

staticControls();
say = statusLine($("status"));
lens = lensSwitch({ mount: $("lensMount"), lens: state.lens, hints: M.LENS_HINTS, onChange: (id) => keepFocus(() => setLens(id)) });
resetForLexicon();
tree = createTreeCanvas($("tree"), {
  lexicon: lex(), dims: state.dims, view: state.view, orbit: state.orbit, selected: state.selected, filter: state.filter, byLayer: state.marks,
  countWord: isStar() ? "things" : "entries", dragSwitch: $("dragBtn"), dragCaption: $("dragNote"),
  onPick(address) {
    keepFocus(() => select(address, { fly: false }));
    const a = document.activeElement;
    if (!a || a === document.body) { const title = $("entryTitle"); if (title) title.focus({ preventScroll: true }); }
  },
  onScene(scene) {
    setText($("treeCap"), M.treeCaption(lex(), scene, state.lens));
    if (!tree || tree.flying || scene.focus === listFocus) return;
    listFocus = scene.focus;
    keepFocus(() => render("list", "nav"));
  },
  onArrive(address) {
    state.view = tree.view;
    state.orbit = tree.orbit;
    if (address !== listFocus) { listFocus = address; keepFocus(() => render("list")); }
    renderNav();
  },
});
describeCanvas($("tree"), M.TREE_LABEL, $("treeCap"));

for (const [id, direction] of NUDGES) idOf.get(id).addEventListener("click", () => tree.nudge(direction));
for (const [id, direction] of TURNS) idOf.get(id).addEventListener("click", () => tree.turn(direction));
for (const [id, key] of NAVS) idOf.get(id).addEventListener("click", act(() => {
  const target = key === "home" ? lex().home : M.treeNav(lex(), tree.view.focus)[key];
  if (target !== null) select(target);
}));
$("dims2d").addEventListener("click", act(() => setDims("2D")));
$("dims3d").addEventListener("click", act(() => setDims("3D")));
$("dimsBtn").addEventListener("click", act(() => setDims(state.dims === "3D" ? "2D" : "3D")));
$("list").addEventListener("keydown", onListKey);
$("loadInput").addEventListener("change", (e) => { onLoad(e); });
$("aboutBtn").addEventListener("click", renderAbout);
wireDialog($("about"), $("aboutBtn"));
addEventListener("popstate", onHash);
addEventListener("hashchange", onHash);
addEventListener("resize", () => { if (wheelBlock && wheelBlock.isConnected) renderWheel(); });

if (wide()) { $("readerBox").open = true; $("listBox").open = true; $("stationBox").open = true; }
renderAbout();
renderAll();

const ready = nextPaint().then(() => true);
window.LexiconExplorer = { state, ready, tree, select, setStation, showLexicon };
