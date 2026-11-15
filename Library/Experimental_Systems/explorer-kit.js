// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
// Explorer kit: the helpers the Celestial Control Panel and the Lexicon Explorer share. Its look is in
// explorer-kit.css, which both pages link. A page that builds its DOM with h(), marks its layers with badge(),
// takes its pointer input through attachPointer() and opens its dialogs through wireDialog() keeps these rules
// without writing them again:
//
//   Layers      A badge is a shape and a word, both as text; the shape is hidden from screen readers. Filled
//               badges carry dark text. A lexicon that came from outside gets the outlined form, "labelled TEXT by
//               its sender". At the Stargazer lens the words are WRITTEN, SAID, CHECKED and OUR IDEA.
//   Text        Every string becomes a text node (textContent). Nothing here parses markup.
//   URLs        h() sets href, src, action and the like only to a value of LINKS, optionally followed by "#" and a
//               fragment in the link alphabet, or to a blob: URL. Anything else throws. An attribute whose name
//               begins with "on" must be a function and is attached as a listener, never written as an attribute.
//               Any other attribute whose name begins with "src" (srcdoc, srcset) is refused.
//   Outside     A string from a loaded package goes through outsideText(): its own element, dir="auto", isolated.
//   Pointer     A click is a gesture that moved less than 6 px in total (the sum of every movement). Mouse and pen
//               drag. A finger taps; it drags only after the visitor switches on "Drag the map", because the canvas
//               keeps touch-action: pan-y pinch-zoom until then, so a swipe that starts on the map scrolls the page.
//   Dialogs     Close is first in the DOM and stays at the top; a dialog opens at scroll position 0; Escape and the
//               backdrop close it; the focus goes back to the control that opened it.
//   Focus       keepFocus() and withBusy() put the focus back after a re-render or a job. A control locked by a
//               running job keeps the focus: it is marked aria-disabled and its clicks are swallowed, because a
//               browser moves the focus to the body when the focused control is really disabled.
//   Motion      Nothing here runs unless something changed. animate() jumps to its end when the visitor asked for
//               reduced motion; invalidator() schedules at most one frame.
//
// The module touches the document only inside its functions, so the DOM-free model modules and their node tests
// can import the pure parts: LINKS, LENSES, LAYER_META, parseHashWith, formatHashWith, hashNumber, hashTuple,
// hashOneOf, cutLabel, isAllowedUrl, hitTest, nextPaint.
//
// Event objects. onClick({ x, y, pointerType }); onDrag({ x, y, dx, dy, startX, startY, pointerType, first });
// onDragEnd({ x, y, pointerType, cancelled }); onWheel({ x, y, deltaX, deltaY, ctrlKey, shiftKey }). x and y are
// CSS pixels from the canvas's top left corner. The page scrolls on a wheel event unless onWheel returns true.

// ─── constants ───────────────────────────────────────────────────────────────

// The pages' own relative URLs. The two page folders are siblings, so one value serves from either of them.
export const LINKS = Object.freeze({
  firstExplorers: "../First_Explorers/index.html",
  celestialControlPanel: "../Celestial_Control_Panel/index.html",
  lexiconExplorer: "../Lexicon_Explorer/index.html",
  wingIndex: "../index.html",
});

export const LENSES = Object.freeze([
  Object.freeze({ id: "stargazer", label: "Stargazer" }),
  Object.freeze({ id: "navigator", label: "Navigator" }),
  Object.freeze({ id: "holographer", label: "Holographer" }),
]);

// The four layers, in the order of the core's LAYERS. `shape` is drawn before the word and marks an entry on the
// tree; `colour` belongs to the layer alone; `meaning` is the one-line definition; `legend` is the sentence of the
// legend (the same at every lens).
export const LAYER_META = Object.freeze([
  Object.freeze({
    id: "text", word: "TEXT", stargazerWord: "WRITTEN", shape: "■", colour: "#f1f5f9",
    meaning: "Words quoted from a named source text. Anyone can check them by reading.",
    legend: "These exact words are in the book named beside them. You can open that book and look.",
  }),
  Object.freeze({
    id: "said", word: "SAID", stargazerWord: "SAID", shape: "●", colour: "#60a5fa",
    meaning: "What a named person, tradition, catalogue, paper or search says, measured or found. Always attributed; never in the page's own voice.",
    legend: "Someone named here says this. They may be right or wrong.",
  }),
  Object.freeze({
    id: "checked", word: "CHECKED", stargazerWord: "CHECKED", shape: "✓", colour: "#86efac",
    meaning: "Something this code computes or tests and a visitor can repeat here.",
    legend: "This page counted it or worked it out, and shows you how to do it again.",
  }),
  Object.freeze({
    id: "reading", word: "READING", stargazerWord: "OUR IDEA", shape: "◆", colour: "#fbbf24",
    meaning: "This project's interpretation or choice: the author's notes, the bridge, the arrangement, the depth scale.",
    legend: "This is how the makers of this page see it. It is a way of looking, not a proof.",
  }),
]);
export const AUTHOR_NOTE_WORD = "AUTHOR'S NOTE";
export const BADGE_HELP = "CHECKED means you can repeat this count or calculation. It does not mean the words beside it are proved.";

export const CLICK_SLOP = 6;      // px: a gesture that moved less than this in total is a click
export const HIT_REACH = 22;      // px: an object this near a tap wins
export const FLIGHT_MS = 600;     // the longest a flight may last
export const LABEL_POINTS = 32;   // code points of a canvas label
export const DOWNLOAD_NAME = /^(hyperpack|handshake)-BC-[0-9a-f]{24}\.json$/;
export const DRAG_SWITCH_LABEL = "Drag the map";
export const DRAG_CAPTION = "Dragging is on. Scroll the page from outside the map.";

// The value patterns of the one link grammar (#key=value&key=value). The ranges are added with hashNumber().
export const HASH_PATTERNS = Object.freeze({
  jd: /^\d{1,7}(\.\d{1,6})?$/,
  lat: /^-?\d{1,2}(\.\d{1,4})?$/,
  lon: /^-?\d{1,3}(\.\d{1,4})?$/,
  address: /^(0|[1-9]\d{0,3})(\.(0|[1-9]\d{0,3})){0,7}$/,
});

const LINK_VALUES = Object.freeze(Object.values(LINKS));
const LINK_FRAGMENT = /^#[A-Za-z0-9._,=&-]*$/;
const HASH_KEY = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const HASH_VALUE = /^[A-Za-z0-9._,-]+$/;
const HASH_MAX = 2048;
const TAG_NAME = /^[a-z][a-z0-9]*$/;
const ATTR_NAME = /^[a-z_:][a-z0-9_:.-]*$/;
const NO_TAGS = new Set(["script", "iframe", "frame", "frameset", "object", "embed", "applet", "base", "meta", "link", "style"]);
const URL_ATTRS = new Set(["href", "src", "action", "formaction", "xlink:href", "poster", "ping", "background", "data", "cite", "manifest"]);
const NO_ATTRS = new Set(["http-equiv"]);
const UNSAFE_STYLE = /url\s*\(|@import|expression\s*\(|javascript:/i;
const CHECK_NAME = /^[a-z][a-z0-9-]{0,31}$/;
const PLAIN_DETAIL = /^[ -~]{0,160}$/;
const TYPING = new Set(["text", "search", "number", "email", "tel", "url", "password", "date", "time", "month", "week", "datetime-local"]);
const TOUCH_SCROLLS = "pan-y pinch-zoom";

const isElement = (x) => typeof Element !== "undefined" && x instanceof Element;
const isNode = (x) => typeof Node !== "undefined" && x instanceof Node;
const call = (fn, arg) => (typeof fn === "function" ? fn(arg) : undefined);
let serial = 0;
const freshId = (prefix) => prefix + "-" + (++serial);

// ─── building the DOM ────────────────────────────────────────────────────────

// True for a value h() may put in href or src: a LINKS value, a LINKS value followed by "#" and a fragment in the
// link alphabet (what formatHashWith writes), or a blob: URL.
export function isAllowedUrl(value) {
  if (typeof value !== "string") return false;
  if (value.startsWith("blob:")) return !/[\s"'<>\\]/.test(value);
  for (const link of LINK_VALUES) {
    if (value === link) return true;
    if (value.startsWith(link) && LINK_FRAGMENT.test(value.slice(link.length))) return true;
  }
  return false;
}

export const $ = (id) => document.getElementById(id);

// h("p", { class: "note" }, "text", child, [more]). An attribute that is null, undefined or false is left out; true
// writes the bare attribute; "class" and "style" set className and the style text (style may also be an object of
// properties); a name that begins with "on" takes a function. Children are nodes, strings, numbers or lists of
// those; null and booleans are skipped. The messages of the errors never contain the value that was refused.
export function h(tag, attrs, ...kids) {
  if (typeof tag !== "string" || !TAG_NAME.test(tag) || NO_TAGS.has(tag)) throw new Error("h(): this tag is not allowed");
  const el = document.createElement(tag);
  if (attrs != null) {
    if (typeof attrs !== "object" || Array.isArray(attrs) || isNode(attrs)) throw new TypeError("h(): the second argument is the attributes object, or null");
    for (const [key, value] of Object.entries(attrs)) setAttr(el, key, value);
  }
  appendKids(el, kids);
  return el;
}
function setAttr(el, key, value) {
  const name = String(key).toLowerCase();
  if (!ATTR_NAME.test(name)) throw new Error("h(): this attribute name is not allowed");
  if (value == null || value === false) return;
  if (name.startsWith("on")) {
    if (typeof value !== "function") throw new Error("h(): an attribute that begins with on takes a function");
    el.addEventListener(name.slice(2), value);
    return;
  }
  if (URL_ATTRS.has(name)) {
    if (!isAllowedUrl(value)) throw new Error("h(): this URL is not a LINKS value and not a blob: URL");
    el.setAttribute(name, value);
    return;
  }
  if (name.startsWith("src") || NO_ATTRS.has(name)) throw new Error("h(): this attribute is not allowed");
  if (name === "style") { setStyle(el, value); return; }
  if (value === true) { el.setAttribute(name, ""); return; }
  if (typeof value !== "string" && typeof value !== "number") throw new TypeError("h(): an attribute value is a string, a number or a boolean");
  if (name === "class") el.className = String(value);
  else el.setAttribute(name, String(value));
}
function setStyle(el, value) {
  if (typeof value === "string") {
    if (UNSAFE_STYLE.test(value)) throw new Error("h(): this style text is not allowed");
    el.style.cssText = value;
    return;
  }
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError("h(): style is a string or an object of properties");
  for (const [prop, v] of Object.entries(value)) {
    if (v == null || v === false) continue;
    if (!/^(--)?[a-z][a-z0-9-]*$/.test(prop) || UNSAFE_STYLE.test(String(v)) || /[;{}]/.test(String(v))) throw new Error("h(): this style text is not allowed");
    el.style.setProperty(prop, String(v));
  }
}
function appendKids(el, kids) {
  for (const kid of kids) {
    if (kid == null || kid === false || kid === true) continue;
    if (Array.isArray(kid)) { appendKids(el, kid); continue; }
    if (typeof kid === "string" || typeof kid === "number" || typeof kid === "bigint") {
      const node = document.createTextNode("");
      node.textContent = String(kid);
      el.append(node);
      continue;
    }
    if (isNode(kid)) { el.append(kid); continue; }
    throw new TypeError("h(): a child is a node, a string, a number or a list of those");
  }
}

// Writes text only when it changed (HUD lines, captions, the status line).
export function setText(el, text) {
  const s = String(text);
  if (el.textContent !== s) el.textContent = s;
  return el;
}

// A string that came from a loaded package: its own element, dir="auto", isolated from the text around it.
export function outsideText(value, tag = "span") {
  return h(tag, { class: "outside", dir: "auto" }, String(value));
}

// A button that can break across lines like the words around it (a term inside a verse). A real <button> is one
// box and cannot; this is a span with role=button that takes Enter, Space and clicks, and can carry aria-pressed.
export function inlineButton(kids, onPress, attrs) {
  const el = h("span", { ...(attrs || {}), role: "button", tabindex: "0" }, kids);
  el.addEventListener("click", (e) => { if (el.getAttribute("aria-disabled") !== "true") call(onPress, e); });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); el.click(); }
    else if (e.key === " ") e.preventDefault();   // Space acts when it is released, and must not scroll the page
  });
  el.addEventListener("keyup", (e) => { if (e.key === " ") { e.preventDefault(); el.click(); } });
  return el;
}

// Cuts a label to n code points (not UTF-16 units), ending in an ellipsis when something was cut.
export function cutLabel(text, n = LABEL_POINTS) {
  const points = Array.from(String(text));
  const max = Math.max(1, Math.floor(Number(n)) || 1);
  return points.length <= max ? points.join("") : points.slice(0, max - 1).join("") + "…";
}

// ─── layers ──────────────────────────────────────────────────────────────────

const LAYER_BY_ID = new Map(LAYER_META.map((m) => [m.id, m]));
export function layerMeta(id) { return LAYER_BY_ID.get(id) || null; }
export function isLens(id) { return LENSES.some((l) => l.id === id); }

// badge("checked") is the filled badge. { lens } chooses the Stargazer words (the default lens is stargazer);
// { word } replaces the word (AUTHOR_NOTE_WORD for the author's lines); { outline: true } or { by: "its sender" }
// gives the outlined form for a lexicon this page did not make: "labelled TEXT by its sender".
export function badge(layer, options) {
  const meta = layerMeta(layer);
  if (!meta) throw new Error("badge(): unknown layer");
  const { outline = false, by = "", lens = "stargazer", word = "" } = options || {};
  const shown = word ? String(word) : lens === "stargazer" ? meta.stargazerWord : meta.word;
  const outside = Boolean(outline) || Boolean(by);
  const label = outside ? "labelled " + shown + " by " + (by ? String(by) : "its sender") : shown;
  return h("span", { class: outside ? "badge outline" : "badge", "data-layer": meta.id },
    h("span", { class: "badge-shape", "aria-hidden": "true" }, meta.shape),
    h("span", { class: "badge-word" }, label));
}

// The legend: the four badges with their sentences and, unless { help: false }, the badge help under them.
export function layerLegend(options) {
  const { lens = "stargazer", help = true } = options || {};
  return h("div", { class: "legend" },
    h("dl", null, LAYER_META.map((m) => [h("dt", null, badge(m.id, { lens })), h("dd", null, m.legend)])),
    help ? h("p", { class: "legend-help" }, BADGE_HELP) : null);
}

// ─── check lists ─────────────────────────────────────────────────────────────

const CHECK_MARK = { ok: "✓", bad: "✕", skip: "·" };
const CHECK_WORD = { ok: "passed", bad: "failed", skip: "not run" };

// checks = [{ name, ok, detail }] as the verifiers return them. { sentences } is a Map from a check name to the
// page's own sentence for it. With { outside: true } (a package this page did not make) an unknown name is shown
// only when it is a plain check name, and a detail only when it is printable ASCII of at most 160 characters.
export function checkList(checks, options) {
  const { sentences = null, outside = false } = options || {};
  const rows = Array.isArray(checks) ? checks : [];
  return h("ul", { class: "checks" }, rows.map((c) => {
    const state = c && c.ok === true ? "ok" : c && c.ok === false ? "bad" : "skip";
    const name = c && typeof c.name === "string" ? c.name : "";
    const own = sentences instanceof Map ? sentences.get(name) : undefined;
    const label = typeof own === "string" ? own : !outside || CHECK_NAME.test(name) ? name : "a check";
    const detail = c && typeof c.detail === "string" && (!outside || PLAIN_DETAIL.test(c.detail)) ? c.detail : "";
    return h("li", { class: state },
      h("b", { "aria-hidden": "true" }, CHECK_MARK[state]),
      h("span", { class: "sr-only" }, CHECK_WORD[state] + ": "),
      h("em", null, label),
      detail ? h("span", { class: outside ? "detail outside" : "detail", dir: outside ? "auto" : null }, detail) : null);
  }));
}

// ─── downloads ───────────────────────────────────────────────────────────────

// Saves text as a file. The name is hyperpack-BC-….json or handshake-BC-….json and nothing else; the text is
// written as it is given (the wire string), as application/json.
export function downloadText(name, text) {
  if (typeof name !== "string" || !DOWNLOAD_NAME.test(name)) throw new Error("downloadText(): the file name is not a package or handshake name");
  if (typeof text !== "string") throw new TypeError("downloadText(): the text is a string");
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = h("a", { href: url, download: name, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}

// ─── pointer ─────────────────────────────────────────────────────────────────

function typingHasFocus() {
  const a = document.activeElement;
  if (!a) return false;
  if (a.localName === "textarea" || a.isContentEditable) return true;
  return a.localName === "input" && TYPING.has(a.type);
}

// Pointer input for a chart canvas, with capture. onClick for a gesture under 6 px in total; onDrag and onDragEnd
// for a mouse or a pen, and for a finger only while the "Drag the map" switch is on; onWheel if given. The switch
// and its caption are made here and put after the canvas, unless the page passes its own elements as
// { dragSwitch, dragCaption } or passes { place: false } and places the returned ones itself.
// Returns { dragSwitch, dragCaption, dragging, setDragging(on), detach() }.
export function attachPointer(canvas, handlers) {
  if (!isElement(canvas)) throw new TypeError("attachPointer(): the first argument is the canvas element");
  const { onClick, onDrag, onDragEnd, onWheel, place = true } = handlers || {};
  const madeSwitch = !isElement(handlers && handlers.dragSwitch), madeCaption = !isElement(handlers && handlers.dragCaption);
  const dragSwitch = madeSwitch ? h("button", { type: "button", class: "btn ghost" }, DRAG_SWITCH_LABEL) : handlers.dragSwitch;
  const dragCaption = madeCaption ? h("p", { class: "note" }) : handlers.dragCaption;
  let touchDrag = false, gesture = null;

  canvas.style.touchAction = TOUCH_SCROLLS;
  if (!canvas.hasAttribute("role")) canvas.setAttribute("role", "img");
  dragSwitch.classList.add("drag-switch");
  dragCaption.classList.add("drag-caption");
  if (!dragCaption.id) dragCaption.id = freshId("drag-caption");
  setText(dragCaption, DRAG_CAPTION);
  if (place) {
    if (madeSwitch && madeCaption) { if (canvas.parentNode) canvas.after(h("div", { class: "drag-row" }, dragSwitch, dragCaption)); }
    else if (madeCaption) dragSwitch.after(dragCaption);
    else if (madeSwitch) dragCaption.before(dragSwitch);
  }

  function setDragging(on) {
    touchDrag = Boolean(on);
    dragSwitch.setAttribute("aria-pressed", String(touchDrag));
    canvas.style.touchAction = touchDrag ? "none" : TOUCH_SCROLLS;
    canvas.classList.toggle("dragging", touchDrag);
    dragCaption.hidden = !touchDrag;
    if (touchDrag) dragSwitch.setAttribute("aria-describedby", dragCaption.id);
    else dragSwitch.removeAttribute("aria-describedby");
  }
  const at = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function finish(cancelled) {
    const g = gesture;
    gesture = null;
    if (g && g.dragging) call(onDragEnd, { x: g.x, y: g.y, pointerType: g.type, cancelled });
  }
  function down(e) {
    if (e.isPrimary === false) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (gesture) finish(true);   // an earlier gesture whose end never arrived
    const p = at(e), touch = e.pointerType === "touch";
    if (touch) dragSwitch.classList.add("touch-seen");
    gesture = { id: e.pointerId, type: e.pointerType || "mouse", startX: p.x, startY: p.y, x: p.x, y: p.y, moved: 0, dragging: false, mayDrag: !touch || touchDrag };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a pointer that is already gone */ }
    // Keep the focus where it was (a canvas is not focusable). A finger that leaves a typing field lets it go,
    // so that the on-screen keyboard closes.
    if (!(touch && typingHasFocus())) e.preventDefault();
  }
  function move(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    const p = at(e), dx = p.x - g.x, dy = p.y - g.y;
    if (dx === 0 && dy === 0) return;
    g.moved += Math.hypot(dx, dy);
    g.x = p.x;
    g.y = p.y;
    if (!g.mayDrag || typeof onDrag !== "function") return;
    const first = !g.dragging;
    if (first && g.moved < CLICK_SLOP) return;
    g.dragging = true;
    onDrag({ x: p.x, y: p.y, dx: first ? p.x - g.startX : dx, dy: first ? p.y - g.startY : dy, startX: g.startX, startY: g.startY, pointerType: g.type, first });
  }
  function up(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    const p = at(e);
    g.moved += Math.hypot(p.x - g.x, p.y - g.y);
    g.x = p.x;
    g.y = p.y;
    if (g.dragging) { finish(false); return; }
    gesture = null;
    if (g.moved < CLICK_SLOP) call(onClick, { x: p.x, y: p.y, pointerType: g.type });
  }
  function lost(e) { if (gesture && e.pointerId === gesture.id) finish(true); }
  function wheel(e) {
    const p = at(e), unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight || 400 : 1;
    const used = onWheel({ x: p.x, y: p.y, deltaX: e.deltaX * unit, deltaY: e.deltaY * unit, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey });
    if (used === true) e.preventDefault();
  }
  const toggle = () => setDragging(!touchDrag);

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", lost);
  canvas.addEventListener("lostpointercapture", lost);
  if (typeof onWheel === "function") canvas.addEventListener("wheel", wheel, { passive: false });
  dragSwitch.addEventListener("click", toggle);
  setDragging(false);

  return {
    dragSwitch,
    dragCaption,
    get dragging() { return touchDrag; },
    setDragging,
    detach() {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", lost);
      canvas.removeEventListener("lostpointercapture", lost);
      canvas.removeEventListener("wheel", wheel);
      dragSwitch.removeEventListener("click", toggle);
      gesture = null;
    },
  };
}

// hits = the objects drawn, in paint order, each { x, y } and optionally r (its drawn radius). Returns the one
// painted last among those the point (x, y) is inside or within `reach` of, or null.
export function hitTest(hits, x, y, reach = HIT_REACH) {
  if (!Array.isArray(hits)) return null;
  for (let i = hits.length - 1; i >= 0; i--) {
    const o = hits[i];
    if (!o || !Number.isFinite(o.x) || !Number.isFinite(o.y)) continue;
    const r = Number.isFinite(o.r) && o.r > reach ? o.r : reach;
    if (Math.hypot(o.x - x, o.y - y) <= r) return o;
  }
  return null;
}

// A canvas is a picture to assistive technology: role=img, a label, a visible caption that describes it, and no
// place in the tab order.
export function describeCanvas(canvas, label, caption) {
  if (!isElement(canvas)) throw new TypeError("describeCanvas(): the first argument is the canvas element");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", String(label));
  if (isElement(caption)) {
    if (!caption.id) caption.id = freshId("caption");
    canvas.setAttribute("aria-describedby", caption.id);
  }
  canvas.removeAttribute("tabindex");
  return canvas;
}

// ─── dialogs ─────────────────────────────────────────────────────────────────

// Wires a <dialog>. It needs a heading (h1 to h3), which names it. A bar is put first in the dialog: the Close
// button, then the heading; the bar stays at the top while the text scrolls. openButton is one element or a list.
// Returns { open(from), close(), closeButton }.
export function wireDialog(dialog, openButton) {
  if (!isElement(dialog) || dialog.localName !== "dialog") throw new TypeError("wireDialog(): the first argument is the dialog element");
  const heading = dialog.querySelector("h1, h2, h3");
  if (!heading) throw new Error("wireDialog(): the dialog needs a heading");
  if (!heading.id) heading.id = freshId("dialog-title");
  dialog.setAttribute("aria-labelledby", heading.id);

  let bar = dialog.firstElementChild;
  let closeButton = bar && bar.classList.contains("dialog-bar") ? bar.firstElementChild : null;
  if (!closeButton || closeButton.localName !== "button") {
    closeButton = h("button", { type: "button", class: "btn dialog-close" }, "Close");
    bar = h("div", { class: "dialog-bar" });
    dialog.prepend(bar);
    bar.append(closeButton, heading);
  }
  closeButton.classList.add("dialog-close");

  const openers = (Array.isArray(openButton) ? openButton : [openButton]).filter(isElement);
  let returnTo = null, pressedOutside = false;
  const outside = (e) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  function open(from) {
    if (dialog.open) return;
    if (isElement(from)) from.focus({ preventScroll: true });
    returnTo = focusMark() || (openers[0] ? { el: openers[0], key: null, id: "", start: null, end: null } : null);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    closeButton.focus({ preventScroll: true });
    dialog.scrollTop = 0;
  }
  function close() {
    if (!dialog.open) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }
  closeButton.addEventListener("click", close);
  dialog.addEventListener("close", () => {
    const mark = returnTo;
    returnTo = null;
    restoreFocus(mark, null, true);
  });
  dialog.addEventListener("pointerdown", (e) => { pressedOutside = e.target === dialog && outside(e); });
  dialog.addEventListener("click", (e) => {
    const shut = pressedOutside && e.target === dialog && outside(e);
    pressedOutside = false;
    if (shut) close();
  });
  for (const button of openers) {
    button.setAttribute("aria-haspopup", "dialog");
    button.addEventListener("click", () => open(button));
  }
  return { open, close, closeButton };
}

// ─── the link grammar: #key=value&key=value ──────────────────────────────────

function compileGrammar(grammar) {
  const pairs = grammar instanceof Map ? [...grammar] : Array.isArray(grammar) ? grammar : grammar && typeof grammar === "object" ? Object.entries(grammar) : null;
  if (!pairs) throw new TypeError("the link grammar is a Map, a list of [key, rule] pairs or an object of rules");
  const rules = new Map();
  for (const pair of pairs) {
    const [key, rule] = Array.isArray(pair) ? pair : [];
    if (typeof key !== "string" || !HASH_KEY.test(key) || rules.has(key)) throw new Error("the link grammar has a bad or repeated key");
    rules.set(key, compileRule(rule));
  }
  return rules;
}
function compileRule(rule) {
  if (rule instanceof RegExp) return (text) => { rule.lastIndex = 0; return rule.test(text) ? text : undefined; };
  if (Array.isArray(rule) || rule instanceof Set) { const set = new Set(rule); return (text) => (set.has(text) ? text : undefined); }
  if (typeof rule === "function") return (text) => { try { return rule(text); } catch { return undefined; } };
  throw new TypeError("a link rule is a RegExp, a list of words or a function");
}

// A rule for a number: the text must match the pattern and lie in [min, max]. The parsed value is the number.
export function hashNumber(pattern, min, max) {
  if (!(pattern instanceof RegExp) || !(min <= max)) throw new TypeError("hashNumber(pattern, min, max)");
  return (text) => {
    pattern.lastIndex = 0;
    if (!pattern.test(text)) return undefined;
    const n = Number(text);
    return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
  };
}
// A rule for one of a fixed set of words (keys of a table, object keys, lens ids).
export function hashOneOf(words) {
  const set = new Set(words);
  return (text) => (set.has(text) ? text : undefined);
}
// A rule for values joined by commas, one rule per place (sky=JD,LAT,LON). The parsed value is the list.
export function hashTuple(...rules) {
  const compiled = rules.map(compileRule);
  return (text) => {
    const parts = text.split(",");
    if (parts.length !== compiled.length) return undefined;
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const v = parts[i] === "" ? undefined : compiled[i](parts[i]);
      if (v === undefined) return undefined;
      out.push(v);
    }
    return out;
  };
}

// Reads a fragment. Returns { values, ignored }: `values` has no prototype and holds the parsed value of every
// key that is in the grammar, given once and valid; `ignored` counts the parts that were not used (an unknown
// key, a key given twice, a value outside the alphabet A-Z a-z 0-9 . _ - , or refused by its rule). When
// ignored is above zero the page says "a link value was ignored". Never throws on what a link contains.
export function parseHashWith(grammar, hash) {
  const rules = compileGrammar(grammar);
  const values = Object.create(null);
  let ignored = 0;
  if (typeof hash !== "string") return { values: Object.freeze(values), ignored: hash == null ? 0 : 1 };
  const text = hash.startsWith("#") ? hash.slice(1) : hash;
  if (text === "") return { values: Object.freeze(values), ignored: 0 };
  if (text.length > HASH_MAX) return { values: Object.freeze(values), ignored: 1 };
  const seen = new Map();
  for (const part of text.split("&")) {
    const cut = part.indexOf("=");
    const key = cut < 0 ? part : part.slice(0, cut);
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  for (const part of text.split("&")) {
    const cut = part.indexOf("=");
    const key = cut < 0 ? "" : part.slice(0, cut), raw = cut < 0 ? "" : part.slice(cut + 1);
    const rule = rules.get(key);
    if (cut < 0 || !rule || seen.get(key) !== 1 || !HASH_VALUE.test(raw)) { ignored++; continue; }
    const value = rule(raw);
    if (value === undefined) { ignored++; continue; }
    values[key] = value;
  }
  return { values: Object.freeze(values), ignored };
}

// Writes a fragment: "#key=value&key=value" in the order of the grammar, or "" when there is nothing to write.
// A list is joined with commas. A key that is not in the grammar, or a value the grammar would not read back,
// throws: a page never emits a link the other page would ignore.
export function formatHashWith(grammar, obj) {
  const rules = compileGrammar(grammar);
  if (obj == null || typeof obj !== "object") throw new TypeError("formatHashWith(): the values are an object");
  for (const key of Object.keys(obj)) if (obj[key] != null && !rules.has(key)) throw new Error("formatHashWith(): a key is not in the link grammar");
  const parts = [];
  for (const [key, rule] of rules) {
    if (!Object.hasOwn(obj, key) || obj[key] == null) continue;
    const value = obj[key], text = Array.isArray(value) ? value.join(",") : String(value);
    if (!HASH_VALUE.test(text) || rule(text) === undefined) throw new Error("formatHashWith(): a value does not fit the link grammar");
    parts.push(key + "=" + text);
  }
  return parts.length ? "#" + parts.join("&") : "";
}

// ─── painting, jobs and motion ───────────────────────────────────────────────

// Resolves after the browser has painted: an animation frame, then a zero timer; 100 ms at the latest, so a tab
// in the background does not hang a job.
export function nextPaint() {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      resolve();
    };
    const fallback = setTimeout(finish, 100);
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(finish, 0));
    else setTimeout(finish, 0);
  });
}

export function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// invalidate = invalidator(draw): however often invalidate() is called, draw runs once in the next frame.
export function invalidator(draw) {
  let queued = false;
  return function invalidate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame((time) => { queued = false; draw(time); });
  };
}

// Runs frame(t) with t going from 0 to 1 over ms milliseconds, then done(). With reduced motion, or ms of 0, it
// is a jump: frame(1) and done() at once. Returns a function that stops it. A flight passes FLIGHT_MS or less.
export function animate(ms, frame, done) {
  const length = Number(ms);
  if (!(length > 0) || prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
    frame(1);
    call(done);
    return () => {};
  }
  let stopped = false, start = null;
  const step = (now) => {
    if (stopped) return;
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / length);
    frame(t);
    if (t < 1) requestAnimationFrame(step);
    else call(done);
  };
  requestAnimationFrame(step);
  return () => { stopped = true; };
}

// One busy flag. While a job runs, every control marked data-busy-lock carries aria-busy and aria-disabled, and
// is disabled as well unless it holds the focus; a control that appears during the job is locked too. A second
// job does not start: withBusy returns { ran: false } at once. Otherwise it waits for a paint, runs the job and
// returns { ran: true, value }; an error of the job is passed on after the locks are released.
const softLocked = new WeakSet(), hardLocked = new WeakSet();
function lockControl(el) {
  el.setAttribute("aria-busy", "true");
  if (el.getAttribute("aria-disabled") !== "true") { el.setAttribute("aria-disabled", "true"); softLocked.add(el); }
  const active = document.activeElement;
  if (el !== active && !el.contains(active) && "disabled" in el && !el.disabled) { el.disabled = true; hardLocked.add(el); }
}
function unlockControl(el) {
  el.removeAttribute("aria-busy");
  if (softLocked.has(el)) { el.removeAttribute("aria-disabled"); softLocked.delete(el); }
  if (hardLocked.has(el)) { el.disabled = false; hardLocked.delete(el); }
}
function setLocks(busy) {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll("[data-busy-lock]")) (busy ? lockControl : unlockControl)(el);
}
export async function withBusy(state, job, onChange) {
  if (!state || typeof state !== "object" || typeof job !== "function") throw new TypeError("withBusy(state, job): a state object and a function");
  if (state.busy) return { ran: false, value: undefined };
  const mark = focusMark();
  let watch = null;
  state.busy = true;
  setLocks(true);
  if (typeof MutationObserver === "function" && typeof document !== "undefined" && document.body) {
    watch = new MutationObserver(() => setLocks(true));
    watch.observe(document.body, { childList: true, subtree: true });
  }
  try {
    call(onChange, true);
    await nextPaint();
    return { ran: true, value: await job() };
  } finally {
    if (watch) watch.disconnect();
    state.busy = false;
    setLocks(false);
    try { call(onChange, false); } finally { restoreFocus(mark); }
  }
}
// A control marked aria-disabled="true" does nothing when it is pressed.
function swallowDisabled(e) {
  const target = isElement(e.target) ? e.target.closest('[aria-disabled="true"]') : null;
  if (!target) return;
  e.preventDefault();
  e.stopImmediatePropagation();
}
if (typeof document !== "undefined") document.addEventListener("click", swallowDisabled, true);

// ─── focus and the status line ───────────────────────────────────────────────

function focusMark() {
  if (typeof document === "undefined") return null;
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const mark = { el, key: el.getAttribute("data-key"), id: el.id || "", start: null, end: null };
  try {
    if (typeof el.selectionStart === "number") { mark.start = el.selectionStart; mark.end = el.selectionEnd; }
  } catch { /* this kind of input has no selection */ }
  return mark;
}
function restoreFocus(mark, root, always) {
  if (!mark || typeof document === "undefined") return;
  const now = document.activeElement;
  if (!always && now && now !== document.body && now !== document.documentElement) return;   // the focus is somewhere: leave it
  let target = mark.el.isConnected ? mark.el : null;
  if (!target && mark.key != null) {
    for (const el of (root || document).querySelectorAll("[data-key]")) {
      if (el.getAttribute("data-key") === mark.key) { target = el; break; }
    }
  }
  if (!target && mark.id) target = document.getElementById(mark.id);
  if (!target || typeof target.focus !== "function") return;
  target.focus({ preventScroll: true });
  if (target !== mark.el && mark.start !== null) {
    try { target.setSelectionRange(mark.start, mark.end); } catch { /* not a text field */ }
  }
}

// keepFocus(() => render()): if the render replaced or disabled the control that had the focus, the focus goes to
// the control with the same data-key (or the same id). A control the render kept is left alone.
export function keepFocus(render, root) {
  const mark = focusMark();
  const out = render();
  if (out && typeof out.then === "function") return out.then((value) => { restoreFocus(mark, root); return value; });
  restoreFocus(mark, root);
  return out;
}

// The page's one status line. say = statusLine(el): say("sentence") writes it 400 ms after the last call, so a
// screen reader hears one sentence when input stops; say.now("sentence") writes at once. The element gets
// role=status; keep it outside every region that holds controls.
export function statusLine(el, wait = 400) {
  if (!isElement(el)) throw new TypeError("statusLine(): the first argument is the status element");
  if (el.getAttribute("role") !== "status") el.setAttribute("role", "status");
  let timer = 0, pending = "";
  const say = (sentence) => {
    pending = String(sentence);
    clearTimeout(timer);
    timer = setTimeout(() => { timer = 0; setText(el, pending); }, wait);
  };
  say.now = (sentence) => {
    clearTimeout(timer);
    timer = 0;
    setText(el, String(sentence));
  };
  return say;
}

// ─── the lens switch and the fold ────────────────────────────────────────────

// Three plain buttons with aria-pressed, never in a layer colour. { mount } is an existing element to fill (or one
// is made); { lens } the first choice; { hints } a Map or an object from lens id to a few words ("ages 6 and up");
// { onChange(id) } runs when the visitor chooses another lens. Returns { el, hint, lens, set(id) }: `hint` is a
// line with the chosen lens's hint, for the page to place where there is room (the hints inside the buttons are
// kept for screen readers only under 700 px).
export function lensSwitch(options) {
  const { mount = null, hints = null, onChange = null, label = "Reading level" } = options || {};
  let current = options && isLens(options.lens) ? options.lens : LENSES[0].id;
  const hintOf = (id) => {
    const text = hints instanceof Map ? hints.get(id) : hints && typeof hints === "object" && Object.hasOwn(hints, id) ? hints[id] : "";
    return typeof text === "string" ? text : "";
  };
  const el = isElement(mount) ? mount : h("div", null);
  el.classList.add("seg", "lens-switch");
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", String(label));
  const hint = h("p", { class: "note lens-hint-line" });
  const buttons = LENSES.map((l) => h("button", { type: "button", "data-lens": l.id, "data-key": "lens-" + l.id, "aria-pressed": "false", onclick: () => choose(l.id) },
    h("span", { class: "lens-name" }, l.label),
    hintOf(l.id) ? h("span", { class: "lens-hint" }, hintOf(l.id)) : null));
  function show() {
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.getAttribute("data-lens") === current));
    const text = hintOf(current);
    setText(hint, text ? LENSES.find((l) => l.id === current).label + ": " + text : "");
    hint.hidden = !text;
  }
  function set(id) {
    if (!isLens(id)) return false;
    current = id;
    show();
    return true;
  }
  function choose(id) {
    if (id === current) return;
    set(id);
    call(onChange, id);
  }
  el.replaceChildren(...buttons);
  show();
  return { el, hint, set, get lens() { return current; } };
}

// A box that shows `first` and, under 700 px, keeps `rest` behind a "more" button (the bridge box on a phone).
// On a wider screen the style sheet shows everything and hides the button. { about } completes the button's
// name for screen readers ("more about the bridge").
export function foldBox(first, rest, options) {
  const { more = "more", less = "less", about = "", open = false } = options || {};
  const restBox = h("div", { class: "fold-rest", id: freshId("fold") }, rest);
  const button = h("button", { type: "button", class: "btn ghost fold-more", "aria-controls": restBox.id });
  const box = h("div", { class: "fold" }, h("div", { class: "fold-first" }, first), restBox, button);
  const set = (on) => {
    box.classList.toggle("open", on);
    button.setAttribute("aria-expanded", String(on));
    setText(button, on ? less : more);
    if (about) button.setAttribute("aria-label", (on ? less : more) + " " + about);
  };
  button.addEventListener("click", () => set(!box.classList.contains("open")));
  set(Boolean(open));
  return box;
}
