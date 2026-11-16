// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Celestial Control Panel: the shell (specification section 7; rules 1.1, 1.4, 1.5 and 1.6).
// It builds the page from the model (celestial-panel-model.js: every sentence, list and number), draws through
// celestial-chart.js (the sky chart and the lab's stage on one canvas, the Moon pictures, the shells of the
// Blueprint) and uses the shared kit for the DOM, the badges, the dialogs, the busy flag, the status line and the
// focus. It holds one state, a value of the model that is replaced, never changed in place: every control does
// apply(modelFunction(state)). Nothing is stored and nothing is requested from another host by this module.
//
// REGIONS (ids in index.html, in the DOM order that is the phone order of 1.6)
//   strip        the five steps (buttons step-1 … step-5)
//   lensHint     under 700 px, the line under the header that says what the chosen reading level is for
//   say          STRIX's line (sayText: the name STRIX, the narration in sayBody and, under 700 px, the button
//                sayMore when not all of it is shown), the one main control of the step (mainRow, mainRow2), the
//                panel a main button opens (mainPanel: pick a place, type a place, pick a day), a message (mainNote)
//   stage        the canvas sky (the chart, or the lab's stage), nudge and turn buttons, "Drag the map", under
//                700 px the 2D/3D button (dimsBtn), the caption skyCap, the HUD on wide screens (hud), the line
//                about an ignored link value (linkNote)
//   cardCol      explain and bridge (from 1100 px the right-hand column; no box of its own below that):
//   explain      the card under the canvas: the inspector of the selected object, or the card of the step (the
//                day and the Moon picture of that day, the lab's results, the seal); under 700 px the HUD is its
//                last part but one (hudNarrow); last, at steps 2 to 4, the button to the next step (explainNext)
//   bridge       the gold box of the step: "Our reading", then "What it stands on"
//   more         legendBox (the four badges: the first box here from 700 px; under 700 px it is moved to stand
//                directly under the card), stepBox (stepCtl: the step's further controls; stepRead: its
//                read-outs), strixBox (all that STRIX says, phone only)
//   under        listBox: every object on the chart as a button (obj-KEY, aria-pressed); it is made again
//                whenever what it lists changes (the rings come and go with their switch and with the view)
//   aside        teleBox (telemetry, from Navigator up), the second Blueprint button
//   status       the one status line; about and blueprint: the two dialogs
//
// A region is rebuilt only when what it shows has changed (each has a signature), and never while a field inside
// it has the focus; sliders and typed fields update their own words in place.
//
// FOR THE WALKTHROUGH   window.CelestialControlPanel = { state (getter: the state now), ready, chart, ui,
//   apply(next, options), setStep(n), dive(key) }. Fixed ids of the controls this module makes:
//   steps        step-1 … step-5
//   place        placeGreenwich, placePick, placeType, placeNext; placeSelect; latField, lonField, placeGo;
//                latSlider, lonSlider
//   day, Moon    dayYes, dayChange; day-today, day-before, day-after, day-pick; dateMonth, dateDay, dateYear,
//                dateGo; time-now, time-sunrise, time-noon, time-sunset, time-midnight; yearSlider, clockField;
//                moon-TARGET (0, 45, … 315); ezk-0 … ezk-3
//   chart        ov-KEY (the switches of OVERLAYS), frame-hor, frame-gal, quick-KEY (home, moon, sun,
//                sgr_a_star, rim), obj-KEY (the list)
//   lab          labOpen, slide-forward, slide-left, slide-back, slide-right, labFour, labHome, labAgain,
//                labClose, labPlay, labNext, labTiling, labTile, stepSlider; labText, fiveText (results)
//   seal         sealBtn, sealFile, sealVerdict, linkField, copyBtn
//   the way on   nextBtn (the last button of the card at steps 2 to 4), sayMore (opens strixBox)
import {
  $, h, setText, badge, layerLegend, checkList, downloadText, describeCanvas, wireDialog, nextPaint, withBusy,
  keepFocus, statusLine, lensSwitch, foldBox, prefersReducedMotion, formatHashWith, LINKS,
} from "../explorer-kit.js";
import * as M from "./celestial-panel-model.js";
import { createSkyChart, createMoonPicture, createShellsFigure } from "./celestial-chart.js";
import { RINGS, jdFromUnixMs } from "../../../scripts/celestial-core.js";

// ─── words of the shell itself (interface chrome; every other sentence is the model's) ──────────────────────

const MONTHS = Object.freeze(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
const UI = Object.freeze({
  next: "Next step", choose: "Choose a place", showPlace: "Show this place", showDay: "Show this day",
  month: "Month", dayOfMonth: "Day", bc: "BC", ad: "AD", time: "Time of day", copy: "Copy",
  more: "more", less: "less", aboutBridge: "about the bridge", inShort: "In short",
  moreAt: "More at this step", lab: "The lab", goKebar: "Go to this sky",
  entry: "see this entry in the Lexicon Explorer", skyCanvas: "The map of the sky", labCanvas: "The curved map by itself",
  shells: "The four shells", shellsLabel: "The four shells drawn over the rings of the map",
  shellsCap: "The numbers are the four shells in the list below. The thin circles are the rings of the map.",
  prototype: "in the first sketch: ", holds: "It holds: ", levels: "Three reading levels", pages: "Other pages",
  firstExplorers: "First Explorers", lexiconExplorer: "Lexicon Explorer", wing: "Experimental Systems",
  stepWords: "a step of ",
});

// ─── state and small helpers ─────────────────────────────────────────────────

let state = M.initialState({ hash: location.hash, nowMs: Date.now() });
const NO_SEAL = Object.freeze({ keys: null, bundle: null, certificate: null, report: null, wire: null });
const jobs = { busy: false };                 // the one busy flag (withBusy writes it)
const ui = {
  panel: null,                                // "pick" | "type" | "date": the panel a main button opened
  typed: null,                                // what is in the fields of "Type my place"
  picked: null,                               // what is in the fields of "Pick another day"
  four: null,                                 // { paused } while "Four slides" is shown slide by slide
  progress: "", sealNote: "",                 // the Seal step: "epoch 3 of 4", "Choose a place first…"
  scene: { rimLabel: "", centreCaption: "" }, // what the chart last said belongs in the caption
};
let chart = null, lens = null, say = null;

const isStar = () => state.lens === "stargazer";
const L = (record) => M.forLens(record, state.lens);
const wide = () => typeof matchMedia === "function" && matchMedia("(min-width: 700px)").matches;
const asking = () => !!state.site && state.step === 2 && !state.lit.day && !state.lab.open;
const small = () => !!chart && chart.size.w < M.LAB.smallCanvas;
/** The calendar date this device's own clock shows for the instant of the state. Question 2 sets it beside the date at the place: the two can be a day apart. */
function deviceDay() {
  const d = new Date(Math.round((state.jdUt - jdFromUnixMs(0)) * 86400000));
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}
/** The badge of a sentence of the page's copy, in the words of the lens. */
const tag = (layer) => badge(layer, { lens: state.lens });
/** One sentence of the copy with its badge. */
const line = (item, attrs) => h("p", attrs || null, item.layer ? tag(item.layer) : null, item.text);
const note = (text, attrs) => h("p", { class: "note", ...(attrs || {}) }, text);
/** fill(el, ...kids): replaces the children of an element; kids as in h(). */
const fill = (el, ...kids) => el.replaceChildren(...h("div", null, kids).childNodes);
const join = (...parts) => parts.join("|");

/** Runs a handler and keeps the focus: on the same control, on its replacement (data-key), or on the first control of its region. */
function act(fn) {
  return (e) => {
    const from = e && e.currentTarget instanceof Element ? e.currentTarget : null;
    const home = from ? from.closest("section, nav, details, header, dialog") : null;
    keepFocus(() => fn(e));
    holdFocus(home);
  };
}
/** True when a control can take the focus now: enabled, laid out, and not inside a closed box (a closed box still gives its content a size). */
function canFocus(el) {
  if (!el || el.disabled || el.getClientRects().length === 0) return false;
  for (let box = el.closest("details:not([open])"); box; box = box.parentElement ? box.parentElement.closest("details:not([open])") : null) {
    if (!(el.localName === "summary" && el.parentElement === box)) return false;
  }
  return true;
}
function holdFocus(home) {
  const a = document.activeElement;
  if (a && a !== document.body && a !== document.documentElement) return;
  const next = home && home.isConnected ? Array.from(home.querySelectorAll("button:not(.say-more), summary, a[href], select, input")).find(canFocus) : null;   // not the "more" of STRIX's line, which comes and goes with the room
  (next || $("aboutBtn")).focus({ preventScroll: true });
}
/** After a tap or a drag on the canvas (which is not focusable) the focus is never left on the body: it goes to the list button of the selected object when that is on show, else to the first control of the canvas panel. */
function focusAfterPointer() {
  const a = document.activeElement;
  if (a && a !== document.body && a !== document.documentElement) return;
  const item = state.selected ? document.getElementById("obj-" + state.selected) : null;
  if (canFocus(item)) item.focus({ preventScroll: true });
  else holdFocus($("stage"));
}
/** A button of the page. attrs.id is also its data-key, so that the focus finds it again after a rebuild. */
function btn(label, onPress, attrs) {
  const a = { type: "button", class: "btn", ...(attrs || {}) };
  if (a.id && !a["data-key"]) a["data-key"] = a.id;
  return h("button", { ...a, onclick: act(onPress) }, label);
}
/** Two buttons of which one is pressed (North | South). get() is true for the second. */
function pair(first, second, get, set, key) {
  const a = h("button", { type: "button", "data-key": key + "-a" }, first), b = h("button", { type: "button", "data-key": key + "-b" }, second);
  const show = () => { a.setAttribute("aria-pressed", String(!get())); b.setAttribute("aria-pressed", String(get())); };
  a.addEventListener("click", () => { set(false); show(); });
  b.addEventListener("click", () => { set(true); show(); });
  show();
  return h("div", { class: "seg", role: "group", "aria-label": first + " or " + second }, a, b);
}
/** A slider with its value in words beside it and as aria-valuetext; onInput(value) may return the words. */
function slider(id, label, min, max, step, value, words, onInput) {
  const out = h("span", { class: "note" }, words(value));
  const input = h("input", { type: "range", id, "data-key": id, min: String(min), max: String(max), step: String(step), value: String(value), "aria-valuetext": words(value) });
  input.addEventListener("input", () => {
    const v = Number(input.value), said = onInput(v), text = typeof said === "string" ? said : words(v);
    input.setAttribute("aria-valuetext", text);
    setText(out, text);
  });
  return h("div", { class: "field" }, h("label", { for: id }, label), input, out);
}
/** Rows { layer, label, value } as a table: the badge and the label, then the value. */
const rowsTable = (rows) => (rows.length === 0 ? null
  : h("table", { class: "rows" }, h("tbody", null, rows.map((r) => h("tr", null, h("th", { scope: "row" }, tag(r.layer), r.label), h("td", null, r.value))))));

// ─── regions: rebuilt only when their signature changed ──────────────────────

const regions = new Map();
const region = (name, host, sig, build) => regions.set(name, { host, sig, build, last: null });
function fieldHasFocus(host) {
  const a = document.activeElement;
  return !!a && a.localName === "input" && host.contains(a);
}
function render(...names) {
  keepFocus(() => {
    for (const name of names.length ? names : regions.keys()) {
      const r = regions.get(name), s = r.sig();
      if (s === r.last) continue;
      if (fieldHasFocus(r.host)) { r.last = null; continue; }   // a field that has the focus is never made again; its region is made again at the next change after the focus has left
      r.last = s;
      r.build();
    }
    updateCaption();
    updateHud();
    fitSay();
  });
}
const siteSig = () => (state.site ? join(state.site.key, state.site.lat, state.site.lonEast) : "-");
const skySig = () => join(state.jdUt, siteSig());
const litSig = () => [state.lit.place, state.lit.day, state.lit.sky].map(Number).join("");
const labSig = () => (state.lab.open ? join(state.lab.a, state.lab.home, state.lab.tiling, state.lab.slides.length, state.lab.slides.map((s) => s.angle.toFixed(4) + ":" + s.dist.toFixed(5)).join(",")) : "");
const fourSig = () => (ui.four ? (ui.four.paused ? "paused" : "playing") : "-") + (M.labNext(state.lab) || "");
const sealSig = () => join(state.seal.report ? state.seal.chainId : "-", ui.progress, ui.sealNote);

// ─── changing the state ──────────────────────────────────────────────────────

/**
 * apply(next, { jump, walk, walkMs, quiet, fromPanel }): the page takes a new state of the model. The chart flies (or jumps,
 * or walks the lab's new slides), the regions that show something else are rebuilt, and the status line gets its
 * one sentence. A seal belongs to one place and time: it is dropped when either changes (the key of the visit stays).
 */
function apply(next, options) {
  const o = options || {}, prev = state;
  if (!next || next === prev) { render(); return; }
  if (prev.seal.report && (next.jdUt !== prev.jdUt || next.site !== prev.site)) next = { ...next, seal: { ...NO_SEAL, keys: prev.seal.keys } };
  if (next.jdUt !== prev.jdUt) {                      // the day was changed: the day panel shows the new day, or closes
    ui.picked = null;
    if (ui.panel === "date" && !o.fromPanel) ui.panel = null;
  }
  if (next.site !== prev.site) ui.typed = null;
  state = next;
  chart.set(state, { jump: !!o.jump, walk: !!o.walk, walkMs: o.walkMs });
  render();
  if (!o.quiet) announce(prev);
}
/** One sentence for the status line: the lab's result, the thing just selected, or the place and time. */
function announce(prev) {
  if (state.lab.open) {
    if (state.lab !== prev.lab) say(M.labReadout(state.lab, state.lens).text);
    return;
  }
  if (state.selected && state.selected !== prev.selected) {
    const item = M.objectList(state).find((x) => x.key === state.selected);
    if (item) { say(item.name); return; }
  }
  if (state.jdUt !== prev.jdUt || state.site !== prev.site || state.lit.day !== prev.lit.day) {
    const s = M.statusSentence(state);
    if (s) say(s);
  }
}
/** A result { state, message } of the model: the state is taken and the message, if any, is said at once. */
function applyResult(r, options) {
  apply(r.state, options);
  if (r.message) say.now(r.message);
}
function setStep(n) {
  ui.panel = null;
  ui.four = null;
  apply(M.setStep(state, n));
}
const dive = (key) => apply(M.dive(state, key));
const setDims = (dims) => apply(M.setDims(state, dims));

// ─── the frame: attributes, the tools under the canvas, fixed labels ─────────

function buildFrame() {
  const body = document.body, dark = !state.site, lab = state.lab.open, ball = state.dims === "3D";
  body.setAttribute("data-lens", state.lens);
  body.setAttribute("data-dims", state.dims);
  body.setAttribute("data-dark", String(dark));
  body.setAttribute("data-ask", String(asking()));
  $("tools").hidden = dark || lab;               // the row of map tools, and under 700 px the 2D/3D button in it: a dark disc has nothing to move or to turn
  $("turns").hidden = !ball;
  $("dimsBtn").hidden = lab;
  if (lab && chart && chart.pointer.dragging) chart.pointer.setDragging(false);
  setText($("dims2d"), L(M.CONTROLS.dims["2D"]));
  setText($("dims3d"), L(M.CONTROLS.dims["3D"]));
  $("dims2d").setAttribute("aria-pressed", String(!ball));
  $("dims3d").setAttribute("aria-pressed", String(ball));
  $("dimsSeg").setAttribute("aria-label", L(M.CONTROLS.dimsLabel));
  setText($("dimsBtn"), L(M.CONTROLS.dims["3D"]));
  $("dimsBtn").setAttribute("aria-pressed", String(ball));
  setText($("listSum"), L(M.CONTROLS.list));
  setText($("teleSum"), L(M.CONTROLS.telemetry) || M.CONTROLS.telemetry.navigator);
  $("teleBox").hidden = isStar() || dark;
  setText($("linkNote"), state.notes.link);
  $("linkNote").hidden = !state.notes.link;
}

// ─── the strip ───────────────────────────────────────────────────────────────

function buildStrip() {
  fill($("strip"), M.visibleSteps(state.lens).map((s) => h("li", null,
    h("button", { type: "button", id: "step-" + s.n, "data-key": "step-" + s.n, "aria-current": s.n === state.step ? "step" : null, onclick: act(() => setStep(s.n)) },
      h("span", { class: "st-n" }, String(s.n)), " ", h("span", { class: "st-name" }, s.title)))));
}

// ─── STRIX's sentence ────────────────────────────────────────────────────────

/** What STRIX says now: the lab's verse and what the walk shows, the first question, the day question, or the step's narration. */
function sayItems() {
  if (state.lab.open) {
    const t = M.LAB_COPY.title;
    return [{ layer: t.layer, text: "“" + t.text + "” (" + t.name + ")." }, ...M.stepView(4, state.lens).bridge.stands.filter((x) => x.layer === "checked")];
  }
  if (!state.site) return [L(M.FIRST_RUN.say)];
  if (asking()) return [{ layer: null, text: M.dayQuestion(state, deviceDay()).text }];
  const items = M.stepView(state.step, state.lens).say;
  return state.step === 1 && state.site.key === M.FIRST_RUN.defaultSite ? [M.FIRST_RUN.afterDefault, ...items] : items;
}
function buildSay() {
  const items = sayItems(), view = M.stepView(state.step, state.lens);
  setText($("sayQ"), state.lab.open ? UI.lab : view.question);
  sayParts = items.flatMap((it) => M.sentencesOf(it.text).map((text, i) => ({ layer: i === 0 ? it.layer : null, text })));
  showSay(sayParts.length);
  fill($("strixAll"), h("h3", null, state.lab.open ? UI.lab : view.question), items.map((it) => line(it)));
}

// Under 700 px STRIX speaks above the map in whole sentences, never in a cut one: as many as leave the first line of the
// card on the first screen of a phone (rule 1.6: above y = 844 at 390 x 844; on a taller screen, above its own height). It
// is measured here after every change of the page, because the room depends on what stands above the card: the rows of
// map tools, the caption, the buttons of the step. A panel the visitor opened (pick a place, type a place, pick a day)
// is not counted: it closes again. When anything is left out, the button "more" at the end of the line opens the box that
// holds all of it and moves the focus there; when not even the first sentence fits, the button alone stands there and
// names the box. On the first screen (no place yet) and while the day is asked, everything is said: those lines are
// questions. From 700 px everything is shown.
const FIRST_SCREEN = 844;
let sayParts = [], sayShown = -1;
function showSay(n) {
  const body = $("sayBody"), more = $("sayMore"), focused = document.activeElement === more;
  fill(body, sayParts.slice(0, n).map((p) => [p.layer ? tag(p.layer) : null, p.text, " "]));
  more.hidden = n === sayParts.length;
  setText(more, n === 0 ? M.STRIX.all : M.STRIX.more);
  if (n === 0) more.removeAttribute("aria-label"); else more.setAttribute("aria-label", M.STRIX.moreFrom);
  if (focused && more.hidden) holdFocus($("say"));       // the button went while it had the focus: the main control of the step takes it
  sayShown = n;
}
/** Where the first line of the card ends, in page coordinates: its title and the first line of text under it. */
function cardLine() {
  let y = $("explainTitle").getBoundingClientRect().bottom;
  const walker = document.createTreeWalker($("explainBody"), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode;
    if (!t.nodeValue.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(t);
    const rects = range.getClientRects();
    if (rects.length) { y = Math.max(y, rects[0].bottom); break; }
  }
  return y + scrollY;
}
function fitSay() {
  const total = sayParts.length;
  if (wide() || !state.site || asking() || total === 0) { if (sayShown !== total) showSay(total); return; }
  const limit = Math.max(FIRST_SCREEN, innerHeight) - 2;
  const opened = () => [$("mainPanel"), $("mainNote")].reduce((sum, el) => sum + (el.hidden ? 0 : el.getBoundingClientRect().height + parseFloat(getComputedStyle(el).marginTop)), 0);
  const fits = () => cardLine() - opened() <= limit;
  if (sayShown === total && fits()) return;
  let n = total;
  showSay(n);
  while (n > 0 && !fits()) showSay(--n);
}
function openStrix() {
  $("strixBox").open = true;
  $("strixSum").focus();                          // the browser scrolls the box into view
}

// ─── the one main control of the step, and the panel it may open ─────────────

function togglePanel(name) {
  ui.panel = ui.panel === name ? null : name;
  render("main");
}
function buildMain() {
  const row = [], row2 = [], C = M.FIRST_RUN.buttons;
  const placeButtons = (first) => [
    btn(C.pick, () => togglePanel("pick"), { id: "placePick", "aria-expanded": String(ui.panel === "pick"), class: first ? "btn" : "btn ghost" }),
    btn(C.type, () => togglePanel("type"), { id: "placeType", "aria-expanded": String(ui.panel === "type"), class: first ? "btn" : "btn ghost" }),
  ];
  if (state.lab.open) {
    for (const d of M.LAB.four) row.push(btn(M.LAB_COPY.slide[d], () => labAct((lab) => M.labSlide(lab, d)), { id: "slide-" + d }));
    row2.push(
      btn(M.LAB_COPY.four, fourPress, { id: "labFour" }),
      btn(M.LAB_COPY.home, () => labAct(M.labHome), { id: "labHome" }),
      btn(M.LAB_COPY.again, () => labAct(M.labReset, { jump: true }), { id: "labAgain", class: "btn ghost" }),
      btn(L(M.LAB_COPY.close), () => { ui.four = null; apply(M.closeLab(state)); }, { id: "labClose", class: "btn ghost" }));
  } else if (!state.site) {
    row.push(btn(C.greenwich, () => { ui.panel = null; apply(M.chooseSite(state, M.FIRST_RUN.defaultSite)); }, { id: "placeGreenwich", class: "btn gold" }), ...placeButtons(true));
  } else if (state.step === 1) {
    row.push(...placeButtons(true), btn(UI.next, () => setStep(2), { id: "placeNext", class: "btn gold" }));
  } else if (state.step === 2 && asking()) {
    const q = M.dayQuestion(state, deviceDay());
    row.push(btn(q.yes, () => apply(M.confirmDay(state)), { id: "dayYes", class: "btn gold" }), btn(q.change, () => togglePanel("date"), { id: "dayChange", "aria-expanded": String(ui.panel === "date") }));
  } else if (state.step === 2) {
    for (const b of M.DAY_BUTTONS) {
      if (b.key === "pick") row.push(btn(b.label, () => togglePanel("date"), { id: "day-pick", "aria-expanded": String(ui.panel === "date") }));
      else row.push(btn(b.label, () => applyResult(b.key === "today" ? M.timeButton(state, "today", Date.now()) : M.stepDay(state, b.key === "before" ? -1 : 1)), { id: "day-" + b.key }));
    }
  } else if (state.step === 3) {
    for (const o of M.OVERLAYS.filter((x) => !x.circle)) row.push(overlayButton(o));
  } else if (state.step === 4) {
    for (const q of M.QUICK) row.push(btn(isStar() ? q.stargazer : q.label, () => dive(q.key), { id: "quick-" + q.key }));
  } else {
    row.push(btn(L(M.SEAL_COPY.buttons.seal), sealPress, { id: "sealBtn", class: "btn gold", "data-busy-lock": true }));
    if (state.seal.ok && state.seal.wire) row.push(btn(L(M.SEAL_COPY.buttons.file), () => { downloadText(state.seal.fileName, state.seal.wire); }, { id: "sealFile" }));
  }
  fill($("mainRow"), row);
  fill($("mainRow2"), row2);
  $("mainRow2").hidden = row2.length === 0;
  const panel = state.lab.open ? null
    : ui.panel === "pick" && (state.step === 1 || !state.site) ? pickPanel()
    : ui.panel === "type" && (state.step === 1 || !state.site) ? typePanel()
    : ui.panel === "date" && state.site && state.step === 2 ? datePanel() : null;
  fill($("mainPanel"), panel);
  $("mainPanel").hidden = !panel;
  const message = state.site && state.step === 2 && !state.lab.open ? [ui.panel === "date" ? "" : state.notes.date, state.notes.time].filter((t) => t).join(" ") : "";
  setText($("mainNote"), message);
  $("mainNote").hidden = !message;
}
const overlayButton = (o) => btn(isStar() ? o.stargazer : o.label, () => apply(M.toggleOverlay(state, o.key)), { id: "ov-" + o.key, "aria-pressed": String(!!state.overlays[o.key]) });

function pickPanel() {
  const choose = (e) => {
    const key = e.currentTarget.value;
    if (!M.siteOf(key)) return;
    ui.panel = null;
    ui.typed = null;
    apply(M.chooseSite(state, key));
  };
  const select = h("select", { id: "placeSelect", "data-key": "placeSelect", onchange: act(choose) },
    h("option", { value: "" }, UI.choose),
    M.siteChoices().map((s) => h("option", { value: s.key, selected: !!state.site && state.site.key === s.key }, s.label)));
  return h("div", { class: "field" }, h("label", { for: "placeSelect" }, L(M.CONTROLS.presets)), select);
}
function typedNow() {
  const s = state.site;
  return s ? { lat: Math.abs(s.lat).toFixed(2), south: s.lat < 0, lon: Math.abs(s.lonEast).toFixed(2), west: s.lonEast < 0 } : { lat: "", south: false, lon: "", west: false };
}
function typePanel() {
  const t = ui.typed || (ui.typed = typedNow()), W = M.FIRST_RUN.typeLabels;
  const err = h("p", { class: "err" }, state.notes.place);
  const go = btn(UI.showPlace, () => {
    const num = (text) => (String(text).trim() === "" ? NaN : Number(text));
    const la = num(t.lat), lo = num(t.lon);
    const r = M.typePlace(state, la >= 0 ? (t.south ? -la : la) : NaN, lo >= 0 ? (t.west ? -lo : lo) : NaN);
    if (r.message) { setText(err, r.message); say.now(r.message); return; }
    ui.panel = null;
    ui.typed = null;
    apply(r.state);
  }, { id: "placeGo", class: "btn gold" });
  const onEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); go.focus(); go.click(); } };
  const field = (id, label, max, key) => h("div", { class: "field" }, h("label", { for: id }, label),
    h("input", { type: "number", id, "data-key": id, min: "0", max: String(max), step: "0.01", inputmode: "decimal", value: t[key], oninput: (e) => { t[key] = e.currentTarget.value; }, onkeydown: onEnter }));
  return h("div", { class: "stack" },
    h("div", { class: "field-row" }, field("latField", W.lat, 90, "lat"), pair(W.north, W.south, () => t.south, (v) => { t.south = v; }, "lat-side")),
    h("div", { class: "field-row" }, field("lonField", W.lon, 180, "lon"), pair(W.east, W.west, () => t.west, (v) => { t.west = v; }, "lon-side")),
    note(M.FIRST_RUN.typeHelp), h("div", { class: "row" }, go), err);
}
function datePanel() {
  const d = M.dateView(state), era = !isStar() || d.era.era === "BC";
  const p = ui.picked || (ui.picked = { month: d.parts.month, day: String(d.parts.day), year: String(era ? d.era.n : d.parts.year), bc: d.era.era === "BC" });
  const go = btn(UI.showDay, () => {
    const n = String(p.year).trim() === "" ? NaN : Number(p.year), before = state.jdUt;
    const r = M.pickEraDate(state, { n, bc: era && p.bc, month: Number(p.month), day: String(p.day).trim() === "" ? NaN : Number(p.day) });   // there is no year 0: the model says so
    if (r.state.jdUt !== before) ui.picked = null;
    if (!r.message) ui.panel = null;
    applyResult(r, { fromPanel: true });
  }, { id: "dateGo", class: "btn gold" });
  const onEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); go.focus(); go.click(); } };
  const month = h("select", { id: "dateMonth", "data-key": "dateMonth", onchange: (e) => { p.month = Number(e.currentTarget.value); } },
    MONTHS.map((name, i) => h("option", { value: String(i + 1), selected: p.month === i + 1 }, name)));
  const number = (id, label, max, key) => h("div", { class: "field" }, h("label", { for: id }, label),
    h("input", { type: "number", id, "data-key": id, min: "1", max: String(max), step: "1", inputmode: "numeric", value: p[key], oninput: (e) => { p[key] = e.currentTarget.value; }, onkeydown: onEnter }));
  return h("div", { class: "stack" },
    h("div", { class: "field-row" }, h("div", { class: "field" }, h("label", { for: "dateMonth" }, UI.month), month), number("dateDay", UI.dayOfMonth, 31, "day")),
    h("div", { class: "field-row" }, number("dateYear", L(M.CONTROLS.year), 3000, "year"), era ? pair(UI.ad, UI.bc, () => p.bc, (v) => { p.bc = v; }, "era") : null),
    h("div", { class: "row" }, go), h("p", { class: "err" }, state.notes.date));
}

// ─── the caption and the HUD (written only when their words change) ──────────

function updateCaption() {
  const lab = state.lab.open;
  const text = lab ? M.LAB.caption : M.chartCaption(state, ui.scene);
  setText($("skyCap"), text);
  const label = lab ? UI.labCanvas : UI.skyCanvas;
  if ($("sky").getAttribute("aria-label") !== label) $("sky").setAttribute("aria-label", label);
}
let hudShown = null;
function updateHud() {
  const lines = !state.site || state.lab.open ? [] : M.hud(state).lines.slice();
  if (state.site && !state.lab.open && state.step === 4) {
    const three = M.threePoints(state);
    if (three) lines.push({ layer: three.layer, text: three.text });
  }
  const sig = state.lens + "|" + lines.map((l) => l.layer + ":" + l.text).join("|");
  if (sig === hudShown) return;
  hudShown = sig;
  for (const host of [$("hud"), $("hudNarrow")]) fill(host, lines.map((l) => line(l)));
}

// ─── the explanation card ────────────────────────────────────────────────────

const moonCanvas = h("canvas", { class: "moon-pic" });
const moonPicture = createMoonPicture(moonCanvas, {});
/** The Moon as it looks from the place, its lines in words, and the third question as a check. day: a row of the day's read-out, written first beside the picture (the card of step 2: the day, and the Moon of that day). */
function moonBlock(day) {
  const f = M.moonFigure(state);
  if (!f) return null;
  moonPicture.set(f);
  const cap = h("div", { class: "cap" }, day ? h("p", { class: "cap" }, tag(day.layer), day.value) : null, f.lines.map((t) => h("p", { class: "cap" }, t)));
  describeCanvas(moonCanvas, f.label, cap);
  return [h("div", { class: "moon-box" }, moonCanvas, cap), f.question ? line(f.question) : null];
}
/** The uncertainty sentence of the Sun and the Moon; at the Stargazer lens in the model's short words for it. */
function unsure(text) {
  const short = isStar() ? M.dayReadout(state).find((r) => r.layer === "reading") : null;
  return short ? short.value : text;
}
function inspectorCard(key) {
  const v = M.inspector(state, key);
  if (!v) return null;
  return [
    h("p", { class: "note" }, tag(v.status.layer), isStar() ? v.status.stargazer : v.status.note),
    v.paragraph.map((x) => line(x)),
    key === "moon" ? moonBlock() : null,
    rowsTable(v.rows),
    v.note ? h("p", { class: "note" }, tag("reading"), unsure(v.note)) : null,
  ];
}
function labCard() {
  const r = M.labReadout(state.lab, state.lens), out = [h("p", { id: "labText" }, tag(r.layer), r.text)];
  if (r.flat) out.push(h("p", null, tag("checked"), r.flat));
  if (r.area) out.push(h("p", null, tag("checked"), r.area.text));
  if (r.tile) out.push(h("p", null, tag("checked"), r.tile));
  for (const c of r.closed) out.push(h("p", { class: "note mono" }, c));
  if (state.lab.tiling) out.push(line(M.LAB_COPY.tileNote));
  if (!isStar()) {
    const five = M.fiveSlides(state.lab.a);
    out.push(h("div", { class: "block" }, h("h3", null, M.LAB_COPY.challenge), h("p", { id: "fiveText" }, tag(five.layer), five.text)));
  }
  return out;
}
function sealCard() {
  const v = M.sealView(state.seal, state.lens), out = [];
  if (ui.progress) out.push(note(ui.progress));
  if (ui.sealNote) out.push(h("p", { class: "err" }, ui.sealNote));
  if (!v) { out.push(line(L(M.SEAL_COPY.about))); return out; }
  out.push(h("p", { id: "sealVerdict" }, tag("checked"), v.verdict));
  const chain = v.rows.find((r) => r.key === "chain");
  if (v.chainName) out.push(h("p", { class: "chain-name" }, v.chainName), line(M.SEAL_COPY.kebar));
  else if (chain) out.push(h("p", { class: "note" }, chain.label + ": ", h("span", { class: isStar() ? "mono" : "hash" }, chain.value)));
  out.push(line(L(M.SEAL_COPY.about)));
  const href = M.lexiconSkyHref(state) || v.link;
  if (v.ok && href) out.push(h("div", { class: "wrap-row" }, h("a", { class: "btn", "data-key": "sealLink", href }, M.SEAL_COPY.buttons.open)));
  out.push(line(L(M.SEAL_COPY.privacy)));
  return out;
}
/** The way on: the next step opens and the focus goes to its button in the strip, which brings the top of the step into view. */
function goNext() {
  const next = M.nextStep(state);
  if (!next) return;
  setStep(next.n);
  const target = document.getElementById("step-" + next.n);
  if (target) target.focus();
}
function buildExplain() {
  explainCard();
  const next = M.nextStep(state);
  fill($("explainNext"), next ? btn(next.label, goNext, { id: "nextBtn", class: "btn gold" }) : null);
}
function explainCard() {
  const title = $("explainTitle"), body = $("explainBody");
  const selected = state.selected && !state.lab.open ? inspectorCard(state.selected) : null;
  const o = selected ? M.inspector(state, state.selected) : null;
  if (state.lab.open) { fill(title, UI.lab); fill(body, labCard()); return; }
  if (!state.site) { fill(title, L(M.CONTROLS.inspector)); fill(body, line(M.FIRST_RUN.card), state.step === 5 ? sealCard() : null); return; }
  if (state.step === 5) {
    fill(title, M.stepView(5, state.lens).title);
    fill(body, sealCard(), selected ? h("div", { class: "block" }, h("h3", null, h("span", { class: "glyph", "aria-hidden": "true" }, o.glyph), o.title), selected) : null);
    return;
  }
  if (selected) { fill(title, h("span", { class: "glyph", "aria-hidden": "true" }, o.glyph), o.title); fill(body, selected); return; }
  fill(title, L(M.CONTROLS.inspector));
  if (state.step === 1) fill(body, line(M.FIRST_RUN.card), rowsTable(M.placeReadout(state)));
  else if (state.step === 2 && state.lit.day) fill(body, moonBlock(M.dayReadout(state)[0]), note(L(M.CONTROLS.nothingSelected)));   // the day, and the Moon of that day
  else fill(body, h("p", null, L(M.CONTROLS.nothingSelected)));
}

// ─── the gold box ────────────────────────────────────────────────────────────

function standLine(x) {
  const kids = [tag(x.layer), x.layer === "text" ? "“" + x.text + "”" : x.text];
  if (x.href) kids.push(" ", h("a", { href: x.href }, x.name || UI.entry));
  else if (x.name) kids.push(" " + x.name);
  const p = x.layer === "text" ? h("blockquote", null, kids) : h("p", null, kids);
  return x.note ? [p, h("p", { class: "note" }, tag(x.note.layer), x.note.text)] : p;
}
function buildBridge() {
  const b = M.stepView(state.step, state.lens).bridge;
  const lead = b.opening || b.reading, sentences = M.sentencesOf(lead.text);
  const first = [h("p", { class: "label gold" }, M.BRIDGE_PARTS.reading), h("p", null, tag(lead.layer), sentences[0])];
  const rest = [
    sentences.length > 1 ? h("p", null, sentences.slice(1).join(" ")) : null,
    b.opening ? line(b.reading) : null,
    h("div", { class: "bridge-stands" }, h("p", { class: "label" }, M.BRIDGE_PARTS.stands), b.stands.map(standLine)),
    b.links.length ? h("div", { class: "wrap-row" }, b.links.map((k, i) => h("a", { class: "btn ghost", "data-key": "bridge-link-" + i, href: k.href }, k.label))) : null,
  ];
  fill($("bridge"), h("h2", { class: "label gold" }, M.BRIDGE_TITLE), foldBox(first, rest, { more: UI.more, less: UI.less, about: UI.aboutBridge }));
}

// ─── the step's further controls ─────────────────────────────────────────────

const smallMoons = M.moonButtons(state).map(() => {
  const canvas = h("canvas", { class: "moon-small" });
  return { canvas, picture: createMoonPicture(canvas, { mark: false }) };
});
function placeControls() {
  const lat = state.site ? Math.round(state.site.lat) : 0, lon = state.site ? Math.round(state.site.lonEast) : 0;
  const move = (la, lo) => { ui.typed = null; apply(M.typePlace(state, la, lo).state, { jump: true }); };
  return [
    slider("latSlider", L(M.CONTROLS.latitude), -90, 90, 1, lat, (v) => M.latitudeWords(v), (v) => move(v, state.site ? state.site.lonEast : 0)),
    slider("lonSlider", L(M.CONTROLS.longitude), -180, 180, 1, lon, (v) => M.longitudeWords(v), (v) => move(state.site ? state.site.lat : 0, v)),
  ];
}
function dayControls() {
  const d = M.dateView(state), out = [];
  out.push(h("div", { class: "field" }, h("span", { class: "note" }, UI.time),
    h("div", { class: "wrap-row" }, M.TIME_BUTTONS.map((b) => btn(b.label, () => applyResult(M.timeButton(state, b.key, Date.now())), { id: "time-" + b.key })))));
  if (!isStar()) {
    out.push(note(d.calendarNote + ". " + M.MESSAGES.calendar));
    out.push(slider("yearSlider", L(M.CONTROLS.dayOfYear), 1, d.daysInYear, 1, d.dayOfYear, () => M.dateView(state).text, (v) => { apply(M.setDayOfYear(state, v), { jump: true }); return M.dateView(state).text; }));
    const clock = h("input", { type: "time", id: "clockField", "data-key": "clockField", value: d.clock });
    clock.addEventListener("change", () => {
      const m = /^(\d{1,2}):(\d{2})/.exec(clock.value);
      if (m) apply(M.setClock(state, Number(m[1]) + Number(m[2]) / 60));
    });
    out.push(h("div", { class: "field" }, h("label", { for: "clockField" }, L(M.CONTROLS.clock)), clock));
  }
  const moons = M.moonButtons(state);
  out.push(h("div", { class: "block" }, h("h3", null, M.MOON_COPY.findLabel), note(M.MOON_COPY.changesDay),
    h("div", { class: "moon-buttons" }, moons.map((b, i) => {
      const name = h("span", null, b.label);
      smallMoons[i].picture.set(b);
      describeCanvas(smallMoons[i].canvas, b.label, name);
      return btn([smallMoons[i].canvas, name], () => { const r = M.findMoon(state, b.target); apply(r.state, { quiet: true }); say(r.note); }, { id: "moon-" + b.target, "aria-label": b.label });
    }))));
  out.push(ezekielBlock());
  return out;
}
function ezekielBlock() {
  const E = M.EZEKIEL_COPY, there = !!state.site && state.site.key === M.EZEKIEL_PRESET.site;
  return h("div", { class: "block" }, h("h3", null, E.title),
    isStar() ? line(E.stargazer) : [line(E.site), line(E.derived)],
    h("div", { class: "stack" }, M.ezekielChoices().map((c, i) => {
      const on = there && Math.abs(M.ezekielSky(state, c.date, c.which).jdUt - state.jdUt) < 1e-6;
      return [btn(c.label, () => apply(M.ezekielSky(state, c.date, c.which)), { id: "ezk-" + i, "aria-pressed": String(on) }),
        isStar() ? null : h("p", { class: "note" }, tag("said"), c.said)];
    })),
    line(E.noHour));
}
function projectControls() {
  const out = [h("div", { class: "field" }, h("span", { class: "note" }, L(M.CONTROLS.overlays)), h("div", { class: "wrap-row" }, M.OVERLAYS.filter((o) => o.circle).map(overlayButton)))];
  if (!isStar()) {
    out.push(h("div", { class: "field" }, h("span", { class: "note" }, L(M.CONTROLS.frame)),
      h("div", { class: "seg", role: "group", "aria-label": L(M.CONTROLS.frame) }, M.FRAME_CHOICES.map((f) =>
        h("button", { type: "button", id: "frame-" + f.key, "data-key": "frame-" + f.key, "aria-pressed": String(state.frame === f.key), onclick: act(() => apply(M.setFrame(state, f.key))) }, f.label)))));
  }
  return out;
}
function labControls() {
  const t = M.LAB_COPY.title, verse = h("p", null, tag(t.layer), "“" + t.text + "” ", h("a", { href: M.entryHref(t.source, state.lens) }, t.name));
  if (!state.lab.open) return [verse, h("div", { class: "row" }, btn(M.LAB_COPY.open, () => { apply(M.openLab(state)); const first = document.getElementById("slide-" + M.LAB.four[0]); if (first) first.focus(); }, { id: "labOpen", class: "btn gold" }))];
  const max = small() ? M.LAB.aMaxSmall : M.LAB.aMax, words = (v) => UI.stepWords + Number(v).toFixed(2);
  const out = [verse];
  const row = [];
  if (ui.four) row.push(btn(ui.four.paused ? M.LAB_COPY.play : M.LAB_COPY.pause, fourPlayPause, { id: "labPlay" }));
  row.push(btn(M.LAB_COPY.next, fourNext, { id: "labNext", "aria-disabled": M.labNext(state.lab) || (chart && chart.walking) ? null : "true" }));
  row.push(btn(L(M.LAB_COPY.tiling), () => labAct(M.labToggleTiling, { jump: true }), { id: "labTiling", "aria-pressed": String(state.lab.tiling) }));
  row.push(btn(M.LAB_COPY.tile, () => labAct(M.labTile, { walk: true }), { id: "labTile" }));
  out.push(h("div", { class: "wrap-row" }, row));
  out.push(slider("stepSlider", L(M.LAB_COPY.step), M.LAB.aMin, max, 0.0125, Math.min(state.lab.a, max), words, (v) => { ui.four = null; apply({ ...state, lab: M.labSetA(state.lab, v, small()) }, { jump: true }); }));
  out.push(line(M.LAB_COPY.flat));
  return out;
}
function linkControls() {
  const href = M.skyLinkHref(state);
  if (!href) return [note(M.SEAL_COPY.needPlace)];
  const url = location.href.split("#")[0] + href.slice(href.indexOf("#"));
  const field = h("input", { type: "text", id: "linkField", "data-key": "linkField", readonly: true, value: url });
  const told = note("");
  const done = (ok) => {
    const text = ok ? M.MESSAGES.copied : M.MESSAGES.copyHelp;
    setText(told, text);
    say.now(text);
    if (!ok) field.select();
  };
  const press = () => {
    try { navigator.clipboard.writeText(url).then(() => done(true), () => done(false)); } catch { done(false); }
  };
  return [h("div", { class: "field" }, h("label", { for: "linkField" }, M.SEAL_COPY.buttons.copy), h("div", { class: "copy-row" }, field, btn(UI.copy, press, { id: "copyBtn" }))), told, line(L(M.SEAL_COPY.privacy))];
}
function buildStepCtl() {
  const view = M.stepView(state.step, state.lens);
  setText($("stepSum"), UI.moreAt + ": " + view.title);
  let kids;
  if (state.step === 1) kids = placeControls();
  else if (state.step === 4) kids = labControls();
  else if (!state.site) kids = [note(M.MESSAGES.needPlace)];
  else if (state.step === 2) kids = dayControls();
  else if (state.step === 3) kids = projectControls();
  else kids = linkControls();
  fill($("stepCtl"), h("div", { class: "stack" }, kids));
}
function buildStepRead() {
  let kids = [];
  if (!state.site) kids = [];
  else if (state.step === 1) {
    kids = [state.selected ? rowsTable(M.placeReadout(state)) : null];   // with nothing selected the card under the canvas shows these rows
    if (state.site.key === M.EZEKIEL_PRESET.site) kids.push(line(M.EZEKIEL_COPY.site));
    else if (!isStar() && state.site.note) kids.push(note(state.site.note));
  } else if (state.step === 2) {
    const rows = M.dayReadout(state), inCard = state.lit.day && !state.selected;   // with the day answered and nothing selected the card under the canvas shows the day itself
    kids = [rowsTable(inCard ? rows.slice(1) : rows), state.notes.moon ? h("p", null, tag("checked"), state.notes.moon) : null, line(M.MOON_COPY.computed)];
  } else if (state.step === 5) {
    const v = M.sealView(state.seal, state.lens);
    if (v && isStar()) kids = [line(M.CERTIFIED_STARGAZER), line(L(M.SEAL_COPY.witness))];
    else if (v) {
      kids = [
        h("table", { class: "rows" }, h("tbody", null, v.rows.map((r) => h("tr", null, h("th", { scope: "row" }, r.label), h("td", null, r.hash ? h("span", { class: "hash" }, r.value) : r.value))))),
        checkList(v.checks), M.CERTIFIED.map((x) => line(x)), line(L(M.SEAL_COPY.witness)),
      ];
    } else kids = [line(isStar() ? M.CERTIFIED_STARGAZER : M.CERTIFIED[0]), isStar() ? null : line(M.CERTIFIED[1]), line(L(M.SEAL_COPY.witness))];
  }
  fill($("stepRead"), h("div", { class: "stack gap" }, kids));
}

// ─── the list, the telemetry, the legend ─────────────────────────────────────

/**
 * A choice in the list: the object is selected and the map slides (a ring cannot be centred: it is selected and its card shown). The
 * list stands under the map, so the map or the card may be outside the window: then the map is scrolled into view, at once
 * where motion is reduced. The status line says the name of what was chosen, or, at a second press, what is in the middle now.
 */
function choose(o) {
  const before = state.selected;
  if (o.kind === "ring") apply(M.select(state, o.key)); else dive(o.key);
  if (state.selected === before) say(M.centreWords(state) || o.name);
  const head = document.querySelector("header.top"), top = getComputedStyle(head).position === "sticky" ? head.getBoundingClientRect().bottom : 0;
  const outside = (el) => { const r = el.getBoundingClientRect(); return r.top < top || r.bottom > innerHeight; };
  if (outside($("sky")) || outside($("explainTitle"))) $("stage").scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}
function buildList() {
  const items = M.objectList(state);
  fill($("list"), items.length === 0 ? h("li", null, M.MESSAGES.needPlace) : items.map((o) => h("li", null,
    h("button", { type: "button", id: "obj-" + o.key, "data-key": "obj-" + o.key, class: o.below ? "below" : null, "aria-pressed": String(o.pressed), onclick: act(() => choose(o)) },
      h("span", { class: "glyph", "aria-hidden": "true" }, o.glyph), o.name))));
}
const teleRows = () => (chart ? M.telemetry(state, chart.size) : []);
function buildTele() { fill($("tele"), rowsTable(teleRows())); }
function buildLegend() { fill($("legend"), layerLegend({ lens: state.lens, help: true })); }

// ─── the two dialogs ─────────────────────────────────────────────────────────

const shellsCanvas = h("canvas", { class: "shells-fig" });
createShellsFigure(shellsCanvas, { shells: M.BLUEPRINT.shells, rings: RINGS.map((r) => Math.tanh(r.rho / 2)) });
function buildDialogs() {
  const D = M.DIALOG, B = M.BLUEPRINT;
  fill($("aboutBody"),
    line(D.first),
    h("h3", null, UI.inShort), D.inShort.map((x) => line(x)),
    D.sections.map((s) => [h("h3", null, s.heading), s.items.map((x) => line(x))]),
    h("h3", null, UI.pages),
    h("div", { class: "wrap-row" },
      h("a", { class: "btn ghost", href: LINKS.firstExplorers }, UI.firstExplorers),
      h("a", { class: "btn ghost", href: LINKS.lexiconExplorer + formatHashWith(M.LEXICON_PAGE_GRAMMAR, { lens: state.lens }) }, UI.lexiconExplorer),
      h("a", { class: "btn ghost", href: LINKS.wingIndex }, UI.wing)));
  const cap = h("p", { class: "cap" }, UI.shellsCap);
  describeCanvas(shellsCanvas, UI.shellsLabel, cap);
  fill($("blueprintBody"),
    line(B.badge),
    h("h3", null, UI.inShort), M.stepView(3, "stargazer").say.map((x) => line(x)),
    h("h3", null, B.heading),
    B.pillars.map((p) => [h("h4", null, p.title), line(p.text)]),
    h("h3", null, UI.shells), shellsCanvas, cap,
    h("ol", null, B.shells.map((s) => h("li", null, h("b", null, s.name), " (" + UI.prototype + s.prototype + "). ", tag(s.text.layer), s.text.text, " " + UI.holds + s.holds.join(", ") + "."))),
    h("h3", null, UI.levels),
    B.lenses.map((l) => h("p", null, h("b", null, l.label), " (" + l.hint + "): ", tag(l.text.layer), l.text.text)));
}

// ─── the lab ─────────────────────────────────────────────────────────────────

/** One press in the lab that is not part of "Four slides": the lab changes and the walker follows. */
function labAct(change, options) {
  ui.four = null;
  if (chart.paused) chart.finish();          // a walk the visitor paused is ended first (the Play button goes with ui.four): the walker stands at the end of its path and walks on from there
  apply({ ...state, lab: change(state.lab) }, options);
}
/** "Four slides": forward, left, back and right, one slide after another (2 s each). With reduced motion there is no walk to watch: one press draws all four at once, and the status line says so. */
function fourPress() {
  if (prefersReducedMotion()) {
    ui.four = null;
    if (chart.paused) chart.finish();
    apply({ ...state, lab: M.labFour(state.lab) }, { jump: true, quiet: true });
    say(M.LAB_COPY.fourAtOnce + " " + M.labReadout(state.lab, state.lens).text);
    return;
  }
  if (ui.four && ui.four.paused) { fourPlayPause(); return; }   // paused by the visitor: go on playing
  ui.four = { paused: false };
  state = { ...state, lab: M.labReset(state.lab) };
  chart.set(state, { jump: true });
  fourStep(M.LAB.slideMs);
}
function fourStep(walkMs) {
  const d = M.labNext(state.lab);
  if (!d) { ui.four = null; render(); return; }
  apply({ ...state, lab: M.labSlide(state.lab, d) }, { walkMs });
  if (ui.four && !M.labNext(state.lab) && !chart.walking) { ui.four = null; render(); }
}
function fourPlayPause() {
  if (!ui.four) return;
  ui.four.paused = !ui.four.paused;
  if (ui.four.paused) chart.pause();
  else if (chart.walking) chart.resume();
  else fourStep(M.LAB.slideMs);
  render();
}
/** "Next slide": the slide that is being walked is finished at once; otherwise the next of the four is made. */
function fourNext() {
  if (chart.walking) { chart.finish(); return; }
  if (!M.labNext(state.lab)) return;
  if (!ui.four) ui.four = { paused: true };
  ui.four.paused = true;
  fourStep();
}
function onArrive() {
  if (!state.lab.open) return;
  if (ui.four && !M.labNext(state.lab)) ui.four = null;
  else if (ui.four && !ui.four.paused) { fourStep(M.LAB.slideMs); return; }
  render();
}

// ─── the seal ────────────────────────────────────────────────────────────────

async function sealPress() {
  if (!state.site) {
    ui.sealNote = M.SEAL_COPY.needPlace;
    render();
    say.now(ui.sealNote);
    return;
  }
  ui.sealNote = "";
  const from = state;
  const done = await withBusy(jobs, async () => M.sealSky(from, {
    keys: from.seal.keys || undefined,
    onEpoch: async (p) => { ui.progress = M.epochLine(p, state.lens); render("explain"); await nextPaint(); },
  }), (on) => { state = { ...state, busy: on }; });
  ui.progress = "";
  if (!done.ran) { render(); return; }
  const seal = done.value;
  if (state.jdUt === from.jdUt && state.site === from.site) state = { ...state, seal };   // the sky was not changed meanwhile
  render();
  const v = M.sealView(state.seal, state.lens);
  say.now(v ? v.verdict : L(M.SEAL_COPY.fail));
}

// ─── wiring ──────────────────────────────────────────────────────────────────

region("frame", $("stage"), () => join(state.lens, state.dims, !!state.site, state.lab.open, asking(), state.notes.link), buildFrame);
region("strip", $("strip"), () => join(state.lens, state.step), buildStrip);
region("say", $("sayBody"), () => join(state.lens, state.step, siteSig(), litSig(), state.lab.open, asking() ? M.dayQuestion(state, deviceDay()).text : ""), buildSay);
region("main", $("say"), () => join(state.lens, state.step, !!state.site, asking(), state.lab.open, ui.panel, state.overlays.rings, state.overlays.sightLines,
  state.seal.ok && state.seal.wire ? state.seal.chainId : "-", state.notes.date, state.notes.time, state.notes.place, ui.panel === "date" ? state.jdUt : "", ui.panel === "pick" ? siteSig() : ""), buildMain);
region("explain", $("explain"), () => join(state.lens, state.step, state.selected, skySig(), litSig(), state.frame, labSig(), sealSig()), buildExplain);
region("bridge", $("bridge"), () => join(state.lens, state.step), buildBridge);
region("stepCtl", $("stepCtl"), () => join(state.lens, state.step, skySig(), state.lab.open, state.lab.a, state.lab.tiling, fourSig(), !!chart && chart.walking, state.frame,
  M.OVERLAYS.map((o) => Number(!!state.overlays[o.key])).join(""), small()), buildStepCtl);
region("stepRead", $("stepRead"), () => join(state.lens, state.step, skySig(), litSig(), state.notes.moon, sealSig(), !!state.selected), buildStepRead);
region("list", $("list"), () => join(state.lens, M.objectList(state).map((o) => join(o.key, o.name, o.pressed, o.below)).join(";")), buildList);   // the list itself: its rings come and go with their switch and with the view
region("tele", $("tele"), () => state.lens + "|" + teleRows().map((r) => r.value).join("|"), buildTele);
region("legend", $("legend"), () => state.lens, buildLegend);
region("dialogs", $("aboutBody"), () => state.lens, buildDialogs);

say = statusLine($("status"));
lens = lensSwitch({ mount: $("lensMount"), lens: state.lens, hints: M.LENS_HINTS, onChange: (id) => apply(M.setLens(state, id)) });
$("lensHint").append(lens.hint);                // under 700 px, the line under the header (wider screens have the hints in the buttons)
/** The badge legend is the first box of the further controls from 700 px; under 700 px it stands directly under the card. It is one box, moved when the width changes. */
function placeLegend() {
  const box = $("legendBox");
  if (wide()) { if ($("more").firstElementChild !== box) $("more").prepend(box); }
  else if (box.previousElementSibling !== $("explain")) $("explain").after(box);
}
placeLegend();

chart = createSkyChart($("sky"), {
  state,
  dragSwitch: $("dragBtn"),
  dragCaption: $("dragNote"),
  onChange(next, info) {
    const prev = state;
    state = next;                                   // the chart has already taken it
    if (info.cause === "drag" && !info.end) { updateHud(); return; }
    render();
    announce(prev);
    focusAfterPointer();
  },
  onArrive,
  onScene(sc) {
    ui.scene = { rimLabel: (sc && sc.rimLabel) || "", centreCaption: (sc && sc.centreCaption) || "" };
    updateCaption();
    fitSay();
  },
});
describeCanvas($("sky"), UI.skyCanvas, $("skyCap"));

const arrows = [
  ["left", $("nudgeLeft"), $("turnLeft")], ["up", $("nudgeUp"), $("turnUp")],
  ["down", $("nudgeDown"), $("turnDown")], ["right", $("nudgeRight"), $("turnRight")],
];
for (const [dir, nudge, turn] of arrows) {
  nudge.setAttribute("aria-label", M.CONTROLS.nudge[dir]);
  turn.setAttribute("aria-label", M.CONTROLS.turn[dir]);
  nudge.addEventListener("click", act(() => apply(M.nudgeView(state, dir), { quiet: true })));
  turn.addEventListener("click", act(() => apply({ ...state, orbit: M.orbitTurn(state.orbit, dir) }, { quiet: true })));
}
setText($("sayName"), M.STRIX.name);
$("sayMore").addEventListener("click", act(openStrix));
$("dims2d").addEventListener("click", act(() => setDims("2D")));
$("dims3d").addEventListener("click", act(() => setDims("3D")));
$("dimsBtn").addEventListener("click", act(() => setDims(state.dims === "3D" ? "2D" : "3D")));
wireDialog($("about"), $("aboutBtn"));
wireDialog($("blueprint"), [$("blueprintBtn"), $("blueprintBtn2")]);
addEventListener("hashchange", () => {
  ui.panel = null;
  ui.four = null;
  apply(M.applyHash(state, location.hash));
  lens.set(state.lens);
});
addEventListener("resize", () => { placeLegend(); render(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitSay());   // other letters, other line breaks

if (wide()) {
  $("stepBox").open = true;
  $("listBox").open = true;
  $("teleBox").open = true;
  $("legendBox").open = isStar();
}
render();
{
  const first = M.statusSentence(state);
  if (first) say(first);
}

const ready = nextPaint().then(() => true);
window.CelestialControlPanel = {
  get state() { return state; },
  ready, chart, ui, apply, setStep, dive,
};
