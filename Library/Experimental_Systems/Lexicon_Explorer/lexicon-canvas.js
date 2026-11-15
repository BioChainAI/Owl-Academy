// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Lexicon Explorer: the canvases (specification 8.1, 8.4, 8.2 station 7; rules 1.5 and 1.6).
// Drawing and pointer handling only. Every number, name and colour that is drawn comes from plain data made by
// lexicon-explorer-model.js; picks and drags are reported through callbacks. This module keeps no page state:
// a tree canvas keeps its view ({ focus, local }, the orbit) and a running flight, the other canvases keep the
// last data they were told to draw. Nothing runs by itself: a canvas is redrawn when it is told something new,
// when its box changes size, when a web font arrives, and frame by frame while a flight or a walk is running
// (at most FLIGHT_MS for a flight; with reduced motion both are jumps). No text is written into the page.
//
// THE INTERFACE (three makers; the shell calls nothing else)
//
// Every canvas must be sized by CSS (the tree takes the kit's class "chart"; give the others a width and a
// height or an aspect-ratio). The module sets the bitmap to the CSS box times the device pixel ratio and draws
// in CSS pixels. A canvas that is not laid out (display: none) is skipped and drawn when it gets a box.
// The tree keeps everything inside its disc, so its canvas may be clipped round (border-radius: 50%). The wheel
// needs a box of about 300 px to keep its names apart; under that show the "square" view (1.6, phone order).
// There is no canvas for the Send station: its four receivers are rows of the page.
// The module does not call describeCanvas: the shell gives each canvas its label and caption (role=img,
// aria-label, aria-describedby). attachPointer of the kit is used on every canvas, so the touch rules of 1.6
// hold: a finger scrolls the page, a tap picks, and a finger drags only while "Drag the map" is on.
// Callback coordinates x, y are CSS pixels from the canvas corner.
//
// 1. createTreeCanvas(canvas, options) -> tree                               (8.1; the tree in 2D and 3D)
//    options (all optional):
//      lexicon       a lexicon of the model (makeLexicon, EZEKIEL, skyLexicon(...).lexicon); without one the
//                    canvas shows an empty disc
//      dims          "2D" (cells, walls, layer marks) or "3D" (dots and edges only); default "2D"
//      view          { focus, local } to start from; default homeView(lexicon)
//      orbit         a 4 x 4 matrix (16 numbers) for 3D; default DEFAULT_ORBIT of the model
//      selected      the address of the selected entry, or null: it gets a halo, and in 2D its cell is tinted
//      filter        null, or { text, said, checked, reading }: a layer set to false is drawn faint
//      byLayer       true (default): an entry is marked with its layer's shape in its layer's colour (for a
//                    lexicon of origin "outside" the shape is outlined, never filled: its labels are its
//                    sender's); false: every entry is a plain grey dot
//      countWord     the word after the number when a centred entry has too many children to label
//                    (default "entries"; the model's Stargazer copy says "things")
//      dragSwitch, dragCaption, place   passed to attachPointer (the kit makes and places the "Drag the map"
//                    switch after the canvas unless the shell passes its own elements or place: false)
//      onPick(address, info)   a tap chose an entry. address may be "" (the root's cell). info is
//                    { x, y, pointerType, via: "label" | "cell" | "dot" }. The canvas has ALREADY started the
//                    flight that brings the entry to the centre; the shell selects it. Calling
//                    tree.flyTo(address) again for the same target is harmless.
//      onScene(scene)          the picture changed in a way a caption or a list shows: called after a draw when
//                    dims, the centred entry, its number of children or the number of entries too near the rim
//                    differs from the last call. scene is the treeScene(...) value just drawn; pass it to
//                    treeCaption(lexicon, scene, lens). scene.focus is the entry at the centre (it changes
//                    during a flight and a drag).
//      onArrive(address)       a flight or a walk ended on that entry (also called when it was a jump; not
//                    called when flyTo finds the view already there).
//    tree (the returned object):
//      setLexicon(lexicon, address)   show another lexicon, centred on address (default: its home); no flight
//      set({ dims, selected, filter, byLayer, countWord, orbit })   change any of these and redraw once;
//                    changing dims keeps the centred entry and resets local to the identity
//      flyTo(address, { walk, jump }) -> boolean   fly along the tree to that entry and end in its own frame
//                    (parent on the left). false if the lexicon has no such place. A flight lasts 300 ms plus
//                    100 ms per edge and at most FLIGHT_MS; { walk: true } takes WALK_STEP_MS per edge (at most WALK_MS_MAX) for the
//                    Place station's "fly along the path"; { jump: true } and reduced motion go there at once.
//      jumpTo(address) -> boolean    the same as flyTo(address, { jump: true })
//      home()                        flyTo(lexicon.home)
//      nudge("left" | "right" | "up" | "down")    one press of a nudge button (nudgeView of the model)
//      turn("left" | "right" | "up" | "down")     one press of a turn button in 3D (orbitTurn of the model)
//      stop()                        end a running flight where it is
//      redraw()                      ask for one frame
//      view      (getter) a copy of { focus, local };  orbit (getter) a copy;  dims, lexicon, flying (getters)
//      scene     (getter) the treeScene value of the present view (made on demand)
//      labels()  the label boxes of the last draw (a label that found no free room is not in it): [{ address, text, x, y, w, h, size, at: { x, y } }], box in
//                CSS pixels, size the font size in px (13 or 14), at the entry's label point inside its cell
//      marks()   the markers of the last draw: [{ address, x, y, r, relation }], in paint order
//      pointer   what attachPointer returned: { dragSwitch, dragCaption, dragging, setDragging(on) }
//      destroy() detach everything
//    Hit rules. A tap inside a drawn label picks that label's entry. Otherwise in 2D the tap picks the entry
//    whose cell holds the point (treeHit: a neighbour's whole cell is its hit area) and in 3D the marker
//    painted last under the point, or else the one painted last within 22 px (focus, parent, children and
//    the entries two edges out; far dots cannot be picked). A drag with a mouse or pen (or a finger while the switch is on) moves the 2D view (dragView) or
//    turns the 3D ball (orbitDrag) and ends any flight.
//
// 2. createWordWheel(canvas, options) -> wheel                               (8.4; the wheel and the 8 x 8 square)
//    options: view ("wheel" default, or "square"), word, sector, onPick
//      onPick({ sector, ring, i, row, col, view, x, y, pointerType })   a tap on a light or on the hex digit
//                    beside it. sector 0..15 is the hex digit; ring, i, row, col are null for a tap on a digit.
//                    The wheel is the picture, not the control: the shell opens the sector's four buttons.
//    wheel:
//      set({ word, view, sector })   word is a wheelView(...) value of the model (cells, digits and flips are
//                    read); sector is the selected hex digit (0..15) or null
//      redraw(), destroy(), pointer
//      geometry()    of the last draw: wheel { view: "wheel", cx, cy, r } or square { view: "square", x, y, cell }
//
// 3. createFigure(canvas, kind, options) -> figure                           (8.2 station 7, figures a to e)
//    kind and the data its set() takes (each the unchanged value of the model function named):
//      "three"    (or "a")  threeSquares(points): the grid, the triangle, the three squared distances.
//                 options.onPoints(points, index): a drag of a point (mouse, pen, or a finger with the switch
//                 on) or a tap (the nearest point goes to the tapped grid point) asks for new points; the shell
//                 answers with figure.set(threeSquares(points)). Until it does, the numbers are not drawn.
//      "mirror"   (or "b")  mirrorFigure(seed, { hidden, wrongBit }); set(data, { stage }) with stage 1, 2 or 3
//                 (the 2 x 2 seed, the 4 x 4 corner, all 64; default 3).
//                 options.onPick({ part: "seed", index 0..3 } | { part: "fourth", index 0..15 } |
//                 { part: "cell", i }, each with row, col, x, y, pointerType)
//      "quarters" (or "c")  quarterFigure(hex)
//      "squares"  (or "d")  squaresFigure()
//      "corners"  (or "e")  cornersFigure()
//    figure: set(data, extra), redraw(), destroy(), pointer, kind
//
// Also exported: LABEL_PX (13), FOCUS_LABEL_PX (14), MARK_MIN (4), WALK_STEP_MS, WALK_MS_MAX, FIGURE_KINDS.
import { attachPointer, invalidator, animate, prefersReducedMotion, hitTest, cutLabel, FLIGHT_MS, HIT_REACH, LABEL_POINTS } from "../explorer-kit.js";
import {
  treeScene, treeHit, flightPlan, nudgeView, dragView, orbitDrag, orbitTurn, viewAt, homeView, hasPlace, DEFAULT_ORBIT,
  wheelHit, squareHit, fieldArcs, quadrantArcs, WORD_FIELDS, tqfSnap, tqfPlace, tqfNearest,
} from "./lexicon-explorer-model.js";

/** LABEL_PX: the size of every canvas label. It is never scaled with the geometry. */
export const LABEL_PX = 13;
/** FOCUS_LABEL_PX: the size of the centred entry's label. */
export const FOCUS_LABEL_PX = 14;
/** MARK_MIN: the smallest radius of a marker, in CSS pixels. */
export const MARK_MIN = 4;
/** WALK_STEP_MS, WALK_MS_MAX: a walk along a path takes this long per edge, and at most this long in all. */
export const WALK_STEP_MS = 450;
export const WALK_MS_MAX = 3000;
/** FIGURE_KINDS: the five figures of station 7, in the author's order. */
export const FIGURE_KINDS = Object.freeze(["three", "mirror", "quarters", "squares", "corners"]);

// ─── the look ────────────────────────────────────────────────────────────────
// None of these is one of the four layer colours: those are drawn only as an entry's mark.
const INK = "#e2e8f0", DIM = "#94a3b8", DARK = "#020617", ACCENT = "#38bdf8", GUARD = "#a855f7", GUARD_INK = "#d8b4fe", WRONG = "#fb7185";
const GROUND = "#050b18", PLATE = "rgba(2, 6, 23, 0.82)", LIGHT_ON = "#cbd5e1", LIGHT_OFF = "#1e293b";
const line = (alpha) => "rgba(148, 163, 184, " + alpha.toFixed(3) + ")";
const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
const font = (px, weight, family) => (weight || 400) + " " + px + "px " + (family || SANS);
const TAU = 2 * Math.PI;

const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);
// A finger's tap is answered at pointerup. The browser then makes a click of its own at the same place on the
// screen, and by then the pick may have moved the page under the finger: that click would land on whatever is
// there now (a word of the open verse, one of the four lights of a slice). Ending the touch with preventDefault
// keeps the browser from making it. A scroll is not affected: its touchend cannot be cancelled.
function swallowTapClick(canvas) {
  const end = (e) => { if (e.cancelable) e.preventDefault(); };
  canvas.addEventListener("touchend", end, { passive: false });
  return () => canvas.removeEventListener("touchend", end);
}
const clamp = (v, lo, hi) => (hi < lo ? lo : Math.min(hi, Math.max(lo, v)));
const finite = (...v) => v.every(Number.isFinite);
const isMatrix = (m) => Array.isArray(m) && m.length === 16 && m.every(Number.isFinite);
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

// A name as a canvas may draw it: control characters and the marks that override the direction of writing are
// taken out (a name from a loaded package could carry them), spaces are single, and it is cut by code point.
const UNDRAWN = /[\u0000-\u001F\u007F-\u009F\u061C\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFB]/g;
const drawable = (text, points = LABEL_POINTS) => cutLabel(String(text).replace(UNDRAWN, " ").replace(/\s+/g, " ").trim(), points);

// ─── one canvas: its bitmap, its one frame per change ────────────────────────

// surface(canvas, paint) -> { invalidate, draw, destroy }. paint(ctx, w, h) draws in CSS pixels.
function surface(canvas, paint) {
  if (!canvas || typeof canvas.getContext !== "function") throw new TypeError("a canvas element is needed");
  const ctx = canvas.getContext("2d");
  let dead = false;
  function draw() {
    if (dead) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!(w > 0 && h > 0)) return;
    const ratio = clamp(Number(window.devicePixelRatio) || 1, 1, 3);
    const bw = Math.max(1, Math.round(w * ratio)), bh = Math.max(1, Math.round(h * ratio));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
      // A canvas with no CSS size takes its box from its bitmap and would grow with every draw: pin the box.
      if (canvas.clientWidth !== w || canvas.clientHeight !== h) {
        canvas.style.width = w.toFixed(0) + "px";
        canvas.style.height = h.toFixed(0) + "px";
      }
    }
    ctx.setTransform(bw / w, 0, 0, bh / h, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    paint(ctx, w, h);
  }
  const invalidate = invalidator(draw);
  const again = () => { if (!dead) invalidate(); };
  const watcher = typeof ResizeObserver === "function" ? new ResizeObserver(again) : null;
  if (watcher) watcher.observe(canvas);
  const fonts = typeof document !== "undefined" && document.fonts && typeof document.fonts.addEventListener === "function" ? document.fonts : null;
  if (fonts) fonts.addEventListener("loadingdone", again);
  invalidate();
  return {
    ctx, invalidate: again, draw,
    destroy() {
      dead = true;
      if (watcher) watcher.disconnect();
      if (fonts) fonts.removeEventListener("loadingdone", again);
    },
  };
}

// ─── small drawing helpers ───────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function plainText(ctx, text, x, y, options = {}) {
  ctx.font = options.font || font(LABEL_PX);
  ctx.textAlign = options.align || "center";
  ctx.textBaseline = options.baseline || "middle";
  ctx.fillStyle = options.colour || INK;
  ctx.fillText(text, x, y);
}

// A word on a dark plate, centred on (x, y). Returns its box.
function plateText(ctx, text, x, y, options = {}) {
  const px = options.size || LABEL_PX;
  ctx.font = font(px, options.weight, options.family);
  const w = Math.ceil(ctx.measureText(text).width) + 8, h = px + 6;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 4);
  ctx.fillStyle = PLATE;
  ctx.fill();
  plainText(ctx, text, x, y + 0.5, { font: font(px, options.weight, options.family), colour: options.colour });
  return { x: x - w / 2, y: y - h / 2, w, h };
}

// Text along a circle of radius r round (cx, cy), centred on the angle mid (clockwise from the top). In the
// lower half the letters are turned so that the word still reads from left to right.
function arcText(ctx, text, cx, cy, r, mid, options = {}) {
  ctx.font = options.font || font(LABEL_PX);
  ctx.fillStyle = options.colour || INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chars = Array.from(text), widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  const m = ((mid % TAU) + TAU) % TAU, under = m > Math.PI / 2 && m < 3 * Math.PI / 2, dir = under ? -1 : 1;
  let at = m - dir * total / (2 * r);
  chars.forEach((c, k) => {
    const a = at + dir * widths[k] / (2 * r);
    ctx.save();
    ctx.translate(cx + r * Math.sin(a), cy - r * Math.cos(a));
    ctx.rotate(under ? a + Math.PI : a);
    ctx.fillText(c, 0, 0);
    ctx.restore();
    at += dir * widths[k] / r;
  });
  return total / r;   // the angle the word takes
}

// The straight line of the curved map between two points of the unit disc, added to the current path (which
// stands at a): an arc of the circle that meets the rim at right angles, or a straight line through the centre.
function discLine(ctx, a, b, cx, cy, R) {
  const det = a[0] * b[1] - a[1] * b[0];
  if (Math.abs(det) < 1e-6) { ctx.lineTo(cx + R * b[0], cy - R * b[1]); return; }
  const ka = (1 + a[0] * a[0] + a[1] * a[1]) / 2, kb = (1 + b[0] * b[0] + b[1] * b[1]) / 2;
  const ox = (ka * b[1] - kb * a[1]) / det, oy = (a[0] * kb - b[0] * ka) / det, rr = Math.sqrt(Math.max(0, ox * ox + oy * oy - 1));
  // screen angles (y runs down)
  const a0 = Math.atan2(-(a[1] - oy), a[0] - ox), a1 = Math.atan2(-(b[1] - oy), b[0] - ox);
  const sweep = ((a1 - a0) % TAU + TAU) % TAU;
  ctx.arc(cx + R * ox, cy - R * oy, R * rr, a0, a1, sweep > Math.PI);
}

// The mark of an entry: the shape of its layer in the colour of its layer, or a plain dot. Outlined (hollow)
// for a lexicon from outside, whose labels are its sender's: the filled mark belongs to this page's own rows.
function drawMark(ctx, x, y, r, shape, colour, hollow) {
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = DARK;
  ctx.fillStyle = colour;
  if (shape === "✓") {             // the check mark: a stroke, with a dark stroke under it
    const path = () => { ctx.beginPath(); ctx.moveTo(x - r, y + r * 0.05); ctx.lineTo(x - r * 0.3, y + r * 0.75); ctx.lineTo(x + r, y - r * 0.75); };
    const width = hollow ? 1.5 : Math.max(2.5, r * 0.5);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    path(); ctx.lineWidth = width + 2.5; ctx.strokeStyle = DARK; ctx.stroke();
    path(); ctx.lineWidth = width; ctx.strokeStyle = colour; ctx.stroke();
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    return;
  }
  ctx.beginPath();
  if (shape === "■") ctx.rect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76);
  else if (shape === "◆") { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.15, y); ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r * 1.15, y); ctx.closePath(); }
  else ctx.arc(x, y, r, 0, TAU);
  if (hollow) {
    ctx.fillStyle = GROUND;
    ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = DARK; ctx.stroke();
    ctx.lineWidth = 1.75; ctx.strokeStyle = colour; ctx.stroke();
    return;
  }
  ctx.fill();
  ctx.stroke();
}

// ─── 1. the tree ─────────────────────────────────────────────────────────────

const MARK_RADIUS = { focus: 9, parent: 7, child: 7, near: 5 };
const FAR_DOT = 2.5, RIM_PAD = 3;
// Marks are a little smaller on a small canvas (never under MARK_MIN); labels are not scaled at all.
const markScale = (R) => clamp(R / 300, 0.7, 1);
const DIRECTIONS_3D = [[0, 1], [0, -1], [1, 0], [-1, 0]];

export function createTreeCanvas(canvas, options = {}) {
  const on = { pick: options.onPick, scene: options.onScene, arrive: options.onArrive };
  let lexicon = options.lexicon || null;
  let dims = options.dims === "3D" ? "3D" : "2D";
  let view = lexicon ? (options.view && isMatrix(options.view.local) && hasPlace(lexicon, options.view.focus) ? { focus: options.view.focus, local: options.view.local.slice() } : homeView(lexicon)) : null;
  let orbit = isMatrix(options.orbit) ? options.orbit.slice() : DEFAULT_ORBIT.slice();
  let selected = options.selected === undefined ? null : options.selected;
  let filter = options.filter || null;
  let byLayer = options.byLayer !== false;
  let countWord = typeof options.countWord === "string" ? options.countWord : "entries";
  let scene = null, flight = null, reported = "", labels = [], marks = [];
  let geo = { cx: 0, cy: 0, R: 1, w: 0, h: 0 };

  const makeScene = () => (lexicon ? treeScene(lexicon, view, dims, { orbit, filter, selected }) : null);
  const px = (p) => [geo.cx + geo.R * p[0], geo.cy - geo.R * p[1]];
  const disc = (x, y) => [(x - geo.cx) / geo.R, -(y - geo.cy) / geo.R];

  // ── painting ──
  function ground(ctx) {
    const { cx, cy, R } = geo;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, "#0b1730");
    g.addColorStop(1, GROUND);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
  }
  function rim(ctx) {
    ctx.beginPath();
    ctx.arc(geo.cx, geo.cy, geo.R, 0, TAU);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = line(0.6);
    ctx.stroke();
  }
  function polyline(ctx, points) {
    let started = false;
    ctx.beginPath();
    for (const p of points) {
      if (!finite(p[0], p[1])) return false;
      const q = px(p);
      if (started) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); started = true; }
    }
    return started;
  }
  // The cell of an entry that is not at the centre: its wall, closed along the rim on the entry's side.
  function cellPath(ctx, wall, node) {
    const pts = wall.points;
    if (pts.length < 2 || !polyline(ctx, pts)) return false;
    const first = px(pts[0]), last = px(pts[pts.length - 1]), c = px([node.x, node.y]);
    const a0 = Math.atan2(last[1] - geo.cy, last[0] - geo.cx), a1 = Math.atan2(first[1] - geo.cy, first[0] - geo.cx);
    const ac = Math.atan2(c[1] - geo.cy, c[0] - geo.cx), norm = (a) => ((a % TAU) + TAU) % TAU;
    ctx.arc(geo.cx, geo.cy, geo.R, a0, a1, !(norm(ac - a0) < norm(a1 - a0)));
    ctx.closePath();
    return true;
  }

  function paintFlat(ctx, s) {
    const byAddress = new Map(s.nodes.map((n) => [n.address, n]));
    ctx.save();
    ctx.beginPath();
    ctx.arc(geo.cx, geo.cy, geo.R, 0, TAU);
    ctx.clip();
    // the selected entry's cell
    const chosen = selected === null ? null : byAddress.get(selected);
    if (chosen && (chosen.relation === "child" || chosen.relation === "near")) {
      const wall = s.walls.find((w) => w.address === chosen.address);
      if (wall && cellPath(ctx, wall, chosen)) { ctx.fillStyle = "rgba(56, 189, 248, 0.13)"; ctx.fill(); }
    }
    // edges, faint: the tree under the cells
    ctx.lineWidth = 1;
    ctx.strokeStyle = line(0.22);
    for (const e of s.edges) if (polyline(ctx, e.points)) ctx.stroke();
    // walls: those of the centred entry and its children are stronger
    for (const w of s.walls) {
      if (!polyline(ctx, w.points)) continue;
      ctx.lineWidth = w.ofFocus ? 1.6 : 1;
      ctx.strokeStyle = line(w.ofFocus ? 0.8 : 0.34);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintBall(ctx, s) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(geo.cx, geo.cy, geo.R, 0, TAU);
    ctx.clip();
    ctx.lineWidth = 1;
    for (const e of s.edges) {
      if (!polyline(ctx, e.points)) continue;
      const z = e.points.reduce((sum, p) => sum + (Number.isFinite(p[2]) ? p[2] : 0), 0) / e.points.length;
      ctx.strokeStyle = line(clamp(0.16 + 0.34 * (z + 1) / 2, 0.1, 0.6));
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintNodes(ctx, s) {
    for (const n of s.nodes) {
      if (!finite(n.x, n.y, n.k) || !(n.k > 0)) continue;
      const [x, y] = px([n.x, n.y]);
      ctx.globalAlpha = n.filtered ? 0.28 : 1;
      if (n.relation === "far") {
        const r = FAR_DOT * (s.dims === "3D" ? n.k : 1);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fillStyle = line(0.75);
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      const r = Math.max(MARK_MIN, (MARK_RADIUS[n.relation] || MARK_MIN) * markScale(geo.R) * (s.dims === "3D" ? n.k : 1));
      if (n.selected) {                     // the one object that may glow
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.shadowColor = ACCENT;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, TAU);
        ctx.lineWidth = 2;
        ctx.strokeStyle = ACCENT;
        ctx.stroke();
        ctx.restore();
      }
      if (n.layer === null || n.colour === "") {      // the root: a ring
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fillStyle = GROUND;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
      } else if (byLayer) drawMark(ctx, x, y, r, n.shape, n.colour, lexicon.origin === "outside");
      else drawMark(ctx, x, y, r, "", DIM, false);
      ctx.globalAlpha = 1;
      marks.push({ address: n.address, x, y, r, relation: n.relation });
    }
  }

  // Labels: the centred entry, its parent and its children, at a fixed size. A child's label sits on its
  // spoke between its gate and its mark. A label never covers its own mark and gives way to the labels placed
  // before it (the centred entry first, then its parent, then its children): it slides along its spoke, steps
  // aside, and is cut shorter. On a small canvas a name is cut to the room there is; the caption and the list
  // carry the full name. A label that would still lie on another one (by more than a corner) is left out.
  // A box is pulled towards the centre until its four corners are inside the rim (the page may clip the canvas round).
  function intoDisc(b) {
    for (let turn = 0; turn < 4; turn++) {
      const mx = b.x + b.w / 2 - geo.cx, my = b.y + b.h / 2 - geo.cy, m = Math.hypot(mx, my);
      const reach = Math.hypot(Math.abs(mx) + b.w / 2, Math.abs(my) + b.h / 2);
      if (reach <= geo.R || m < 0.5) break;
      const pull = Math.min(m, reach - geo.R + 0.5);
      b.x -= mx / m * pull;
      b.y -= my / m * pull;
    }
    return b;
  }
  function paintLabels(ctx, s) {
    const items = [], markOf = new Map(marks.map((m) => [m.address, m]));
    for (const n of s.nodes) {
      if (n.label === null || n.label === undefined || !markOf.has(n.address)) continue;
      const m = markOf.get(n.address), focus = n.relation === "focus", size = focus ? FOCUS_LABEL_PX : LABEL_PX;
      const at = finite(n.labelAt[0], n.labelAt[1]) ? px(n.labelAt) : [m.x, m.y];
      let dirs = DIRECTIONS_3D, far = 0;
      if (!focus && s.dims === "2D") {
        const dx = at[0] - m.x, dy = at[1] - m.y, d = Math.hypot(dx, dy);
        const u = d > 0.5 ? [dx / d, dy / d] : (() => { const ex = geo.cx - m.x, ey = geo.cy - m.y, e = Math.hypot(ex, ey) || 1; return [ex / e, ey / e]; })();
        dirs = [u]; far = d;
      }
      items.push({ node: n, mark: m, at, size, weight: focus ? 700 : 500, dirs, far, order: focus ? 0 : n.relation === "parent" ? 1 : 2,
        room: Math.min(geo.w - 4, focus ? Math.max(90, geo.w * 0.5) : clamp(geo.w * 0.36, 78, 260)) });
    }
    items.sort((a, b) => a.order - b.order);
    const placed = [], centre = markOf.get(s.focus);
    if (centre) placed.push({ x: centre.x - centre.r - 2, y: centre.y - centre.r - 2, w: 2 * centre.r + 4, h: 2 * centre.r + 4 });   // no label lies on the centred mark
    const cover = (b) => placed.reduce((sum, p) => sum + Math.max(0, Math.min(p.x + p.w, b.x + b.w) - Math.max(p.x, b.x)) * Math.max(0, Math.min(p.y + p.h, b.y + b.h) - Math.max(p.y, b.y)), 0);
    for (const it of items) {
      ctx.font = font(it.size, it.weight);
      let text = drawable(it.node.label), points = Array.from(text).length;
      while (points > 2 && ctx.measureText(text).width + 8 > it.room) { points -= 1; text = cutLabel(text, points); }
      const tries = [text];
      for (const n of [9, 6]) { const short = cutLabel(text, n); if (short !== tries[tries.length - 1]) tries.push(short); }
      let box = null, best = null, bestCover = Infinity;
      for (const t of tries) {
        const bw = Math.ceil(ctx.measureText(t).width) + 8, bh = it.size + 6;
        for (const extra of [0, 8, 16, 26, 38, 52]) {
          for (const u of it.dirs) {
            const need = it.mark.r + 3 + Math.abs(u[0]) * bw / 2 + Math.abs(u[1]) * bh / 2;
            const d = Math.max(u === it.dirs[0] ? it.far : 0, need) + extra;
            const step = 0.6 * (Math.abs(u[1]) * bw / 2 + Math.abs(u[0]) * bh);
            for (const side of [0, 1, -1]) {
              const b = intoDisc({
                x: clamp(it.mark.x + u[0] * d - side * u[1] * step - bw / 2, 1, geo.w - bw - 1),
                y: clamp(it.mark.y + u[1] * d + side * u[0] * step - bh / 2, 1, geo.h - bh - 1), w: bw, h: bh, text: t,
              });
              const c = cover(b);
              if (c === 0) { box = b; break; }
              if (c < bestCover) { bestCover = c; best = b; }
            }
            if (box) break;
          }
          if (box) break;
        }
        if (box) break;
      }
      if (!box && best && (it.order === 0 || bestCover <= 0.12 * best.w * best.h)) box = best;
      if (!box) continue;
      placed.push(box);
      ctx.globalAlpha = it.node.filtered ? 0.5 : 1;
      roundRect(ctx, box.x, box.y, box.w, box.h, 4);
      ctx.fillStyle = PLATE;
      ctx.fill();
      if (it.node.selected) { ctx.lineWidth = 1.5; ctx.strokeStyle = ACCENT; ctx.stroke(); }
      plainText(ctx, box.text, box.x + box.w / 2, box.y + box.h / 2 + 0.5, { font: font(it.size, it.weight) });
      ctx.globalAlpha = 1;
      labels.push({ address: it.node.address, text: box.text, x: box.x, y: box.y, w: box.w, h: box.h, size: it.size, at: { x: it.at[0], y: it.at[1] } });
    }
    if (s.crowded) {           // too many children to label: a count, and the list is the way in
      const m = markOf.get(s.focus), own = labels.find((l) => l.address === s.focus);
      const x = m ? m.x : geo.cx, y = own ? own.y + own.h + 12 : (m ? m.y : geo.cy) + 34;
      plateText(ctx, s.count + " " + countWord, clamp(x, 40, geo.w - 40), clamp(y, 12, geo.h - 12), { size: LABEL_PX });
    }
  }

  function paint(ctx, w, h) {
    geo = { cx: w / 2, cy: h / 2, R: Math.max(8, Math.min(w, h) / 2 - RIM_PAD), w, h };
    labels = [];
    marks = [];
    ground(ctx);
    if (lexicon) {
      scene = makeScene();
      if (scene.dims === "3D") paintBall(ctx, scene); else paintFlat(ctx, scene);
      rim(ctx);
      paintNodes(ctx, scene);
      paintLabels(ctx, scene);
      const key = scene.dims + "|" + scene.focus + "|" + scene.count + "|" + scene.hidden;
      if (key !== reported) { reported = key; call(on.scene, scene); }
    } else rim(ctx);
  }

  const surf = surface(canvas, paint);
  const touch = () => { scene = null; surf.invalidate(); };

  // ── flights ──
  function stop() {
    if (!flight) return;
    const f = flight;
    flight = null;
    call(f.halt);
  }
  function flyTo(address, how = {}) {
    if (!lexicon || typeof address !== "string" || !hasPlace(lexicon, address)) return false;
    if (flight && flight.target === address && !how.jump) return true;
    if (!flight && view.focus === address && view.local.every((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) < 1e-12)) return true;   // already there
    stop();
    const plan = flightPlan(lexicon, dims, view, address);
    const jump = how.jump === true || prefersReducedMotion();
    const ms = jump ? 0 : how.walk ? Math.min(WALK_MS_MAX, WALK_STEP_MS * Math.max(1, plan.steps)) : Math.min(FLIGHT_MS, 300 + 100 * plan.steps);
    const f = { target: address, halt: null };
    let inFrame = false;
    flight = f;
    f.halt = animate(ms, (t) => {
      if (flight !== f) return;
      view = plan.at(t);
      scene = null;
      if (inFrame) surf.draw(); else surf.invalidate();
    }, () => {
      if (flight !== f) return;
      flight = null;
      view = { focus: plan.to.focus, local: plan.to.local.slice() };
      touch();
      call(on.arrive, address);
    });
    inFrame = true;      // from here on the frames come from the animation itself
    return true;
  }

  // ── the pointer ──
  function click(e) {
    if (!lexicon) return;
    let address = null, via = "label";
    for (let i = labels.length - 1; i >= 0 && address === null; i--) if (inside(labels[i], e.x, e.y)) address = labels[i].address;
    if (address === null && dims === "2D") {
      const p = disc(e.x, e.y);
      address = treeHit(lexicon, view, p[0], p[1]);
      via = "cell";
    } else if (address === null) {
      const hit = hitTest(marks, e.x, e.y, 0) || hitTest(marks, e.x, e.y, HIT_REACH);
      address = hit ? hit.address : null;
      via = "dot";
    }
    if (address === null || address === undefined || !hasPlace(lexicon, address)) return;
    flyTo(address);
    call(on.pick, address, { x: e.x, y: e.y, pointerType: e.pointerType, via });
  }
  function drag(e) {
    if (!lexicon) return;
    stop();
    if (dims === "3D") orbit = orbitDrag(orbit, e.dx, e.dy);
    else view = dragView(lexicon, view, disc(e.x - e.dx, e.y - e.dy), disc(e.x, e.y));
    touch();
  }
  const pointer = attachPointer(canvas, { onClick: click, onDrag: drag, dragSwitch: options.dragSwitch, dragCaption: options.dragCaption, place: options.place !== false });
  const keepClick = swallowTapClick(canvas);

  return {
    setLexicon(next, address) {
      stop();
      lexicon = next || null;
      view = lexicon ? (typeof address === "string" ? viewAt(lexicon, address) : homeView(lexicon)) : null;
      reported = "";
      touch();
    },
    set(next = {}) {
      if (next.dims !== undefined) {
        const d = next.dims === "3D" ? "3D" : "2D";
        if (d !== dims) { stop(); dims = d; if (lexicon) view = viewAt(lexicon, view.focus); }
      }
      if (next.selected !== undefined) selected = next.selected;
      if (next.filter !== undefined) filter = next.filter || null;
      if (next.byLayer !== undefined) byLayer = next.byLayer !== false;
      if (typeof next.countWord === "string") countWord = next.countWord;
      if (isMatrix(next.orbit)) orbit = next.orbit.slice();
      touch();
    },
    flyTo,
    jumpTo: (address) => flyTo(address, { jump: true }),
    home: () => (lexicon ? flyTo(lexicon.home) : false),
    nudge(direction) {
      if (!lexicon) return;
      stop();
      view = nudgeView(lexicon, dims, view, direction);
      touch();
    },
    turn(direction) {
      orbit = orbitTurn(orbit, direction);
      touch();
    },
    stop,
    redraw: touch,
    get view() { return view ? { focus: view.focus, local: view.local.slice() } : null; },
    get orbit() { return orbit.slice(); },
    get dims() { return dims; },
    get lexicon() { return lexicon; },
    get flying() { return flight !== null; },
    get scene() { if (!scene) scene = makeScene(); return scene; },
    labels: () => labels.map((l) => ({ ...l, at: { ...l.at } })),
    marks: () => marks.map((m) => ({ ...m })),
    pointer,
    destroy() { stop(); pointer.detach(); keepClick(); surf.destroy(); },
  };
}

// ─── 2. the word wheel and the 8 × 8 square ──────────────────────────────────

const FIELD_OF = new Map(WORD_FIELDS.map((f) => [f.key, f]));
// one neutral ramp: a field is a step of lightness; a light that is on is light, one that is off is dark
const lightColour = (cell) => {
  const f = FIELD_OF.get(cell.field), shade = f ? f.shade : 0.5;
  if (cell.guard) return cell.on ? GUARD : "#2e1a47";
  return "hsl(215, 16%, " + (cell.on ? 50 + 38 * shade : 12 + 10 * shade).toFixed(1) + "%)";
};
const DIGIT_BAND = 11, TIER_1 = 27, TIER_2 = 42;      // px outside the wheel: hex digits, field names, the guard's name

export function createWordWheel(canvas, options = {}) {
  let view = options.view === "square" ? "square" : "wheel";
  let word = options.word || null;
  let sector = Number.isInteger(options.sector) ? options.sector : null;
  let geo = null;

  function paintWheel(ctx, w, h) {
    const r = Math.max(20, Math.min((w - 2 * (TIER_1 + 9)) / 2, (h - (TIER_2 + 9) - (TIER_1 + 9)) / 2));
    const cx = w / 2, cy = (TIER_2 + 9) + r + Math.max(0, (h - (TIER_2 + 9) - (TIER_1 + 9) - 2 * r) / 2);
    geo = { view: "wheel", cx, cy, r };
    const ang = (a) => a - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = GROUND;
    ctx.fill();
    if (!word) { ctx.lineWidth = 1.5; ctx.strokeStyle = line(0.6); ctx.stroke(); return; }
    const flipped = new Set(Array.isArray(word.flips) ? word.flips : []);
    for (const c of word.cells) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * c.r1, ang(c.a0), ang(c.a1));
      if (c.r0 > 0) ctx.arc(cx, cy, r * c.r0, ang(c.a1), ang(c.a0), true); else ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fillStyle = lightColour(c);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = GROUND;
      ctx.stroke();
      if (c.guard) { ctx.lineWidth = 2; ctx.strokeStyle = GUARD_INK; ctx.stroke(); }
      if (flipped.has(c.i)) {          // a light the visitor flipped carries a dot
        const rm = r * (c.r0 > 0 ? (c.r0 + c.r1) / 2 : c.r1 * 0.62), am = (c.a0 + c.a1) / 2;
        ctx.beginPath();
        ctx.arc(cx + rm * Math.sin(am), cy - rm * Math.cos(am), 2.6, 0, TAU);
        ctx.fillStyle = c.on ? DARK : INK;
        ctx.fill();
      }
    }
    // the four quarters, outlined
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    for (const q of quadrantArcs()) { ctx.moveTo(cx, cy); ctx.lineTo(cx + (r + 4) * Math.sin(q.a0), cy - (r + 4) * Math.cos(q.a0)); }
    ctx.stroke();
    // the chosen slice
    if (sector !== null) {
      const a0 = sector * TAU / 16, a1 = (sector + 1) * TAU / 16;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r + 2, ang(a0), ang(a1));
      ctx.closePath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = DARK;
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = ACCENT;
      ctx.stroke();
    }
    // the hex digit outside each sector
    const digits = Array.isArray(word.digits) ? word.digits : [];
    for (let s = 0; s < 16 && s < digits.length; s++) {
      const a = (s + 0.5) * TAU / 16, chosen = s === sector;
      plainText(ctx, String(digits[s]).slice(0, 1), cx + (r + DIGIT_BAND) * Math.sin(a), cy - (r + DIGIT_BAND) * Math.cos(a) + 0.5,
        { font: font(LABEL_PX, chosen ? 700 : 500, MONO), colour: chosen ? ACCENT : INK });
    }
    // the fields, named round the wheel; a field that shares its sector with another is named on the outer tier
    const taken = [];
    for (const f of fieldArcs()) {
      const mid = (f.a0 + f.a1) / 2, share = taken.some((t) => f.a0 < t.a1 - 1e-6 && t.a0 < f.a1 - 1e-6);
      const outer = f.guard || (share && !taken.some((t) => t.outer && f.a0 < t.a1 - 1e-6 && t.a0 < f.a1 - 1e-6));
      const tier = outer ? TIER_2 : TIER_1;
      if (!outer) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + DIGIT_BAND + 8.5, ang(f.a0 + 0.03), ang(f.a1 - 0.03));
        ctx.lineWidth = 1;
        ctx.strokeStyle = line(0.6);
        ctx.stroke();
      }
      arcText(ctx, f.label, cx, cy, r + tier, mid, { font: font(LABEL_PX, f.guard ? 700 : 500), colour: f.guard ? GUARD_INK : INK });
      taken.push({ a0: f.a0, a1: f.a1, outer });
    }
  }

  function paintSquare(ctx, w, h) {
    const left = 18, right = 40, top = 22, bottom = 22;
    const cell = Math.max(6, Math.floor(Math.min((w - left - right) / 8, (h - top - bottom) / 8)));
    const x0 = Math.round(left + (w - left - right - 8 * cell) / 2), y0 = Math.round(top + (h - top - bottom - 8 * cell) / 2);
    geo = { view: "square", x: x0, y: y0, cell };
    if (!word) { ctx.lineWidth = 1.5; ctx.strokeStyle = line(0.6); ctx.strokeRect(x0, y0, 8 * cell, 8 * cell); return; }
    const flipped = new Set(Array.isArray(word.flips) ? word.flips : []);
    for (const c of word.cells) {
      const x = x0 + c.col * cell, y = y0 + c.row * cell;
      ctx.fillStyle = lightColour(c);
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      if (c.guard) { ctx.lineWidth = 2; ctx.strokeStyle = GUARD_INK; ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4); }
      if (flipped.has(c.i)) { ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, 2.6, 0, TAU); ctx.fillStyle = c.on ? DARK : INK; ctx.fill(); }
    }
    // the four quarters: two rows each
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    for (let q = 0; q < 4; q++) ctx.strokeRect(x0, y0 + q * 2 * cell, 8 * cell, 2 * cell);
    // the chosen hex digit: half a row
    if (sector !== null) {
      const x = x0 + (sector & 1) * 4 * cell, y = y0 + (sector >> 1) * cell;
      ctx.lineWidth = 4; ctx.strokeStyle = DARK; ctx.strokeRect(x, y, 4 * cell, cell);
      ctx.lineWidth = 2; ctx.strokeStyle = ACCENT; ctx.strokeRect(x, y, 4 * cell, cell);
    }
    // one row per byte: its two hex digits at its two ends
    const digits = Array.isArray(word.digits) ? word.digits : [];
    for (let s = 0; s < 16 && s < digits.length; s++) {
      const chosen = s === sector, x = s & 1 ? x0 + 8 * cell + 9 : x0 - 9, y = y0 + (s >> 1) * cell + cell / 2 + 0.5;
      plainText(ctx, String(digits[s]).slice(0, 1), x, y, { font: font(LABEL_PX, chosen ? 700 : 500, MONO), colour: chosen ? ACCENT : INK });
    }
    // the fields: a name over, beside or under the lights it covers
    for (const f of WORD_FIELDS) {
      const r0 = f.first >> 3, r1 = f.last >> 3, colour = f.guard ? GUARD_INK : INK, weight = f.guard ? 700 : 500;
      ctx.font = font(LABEL_PX, weight);
      const tw = ctx.measureText(f.label).width;
      if (r0 === r1 && (r0 === 0 || r0 === 7)) {
        const c0 = f.first & 7, c1 = f.last & 7, mid = x0 + (c0 + c1 + 1) * cell / 2;
        const x = clamp(mid, 1 + tw / 2, w - 1 - tw / 2);
        plainText(ctx, f.label, r0 === 7 && c0 > 0 ? Math.min(w - 1 - tw / 2, Math.max(x, x0 + c0 * cell + tw / 2)) : x, r0 === 0 ? y0 - 11 : y0 + 8 * cell + 12, { font: font(LABEL_PX, weight), colour });
      } else {
        const xr = x0 + 8 * cell + 20, ya = y0 + r0 * cell + 3, yb = y0 + (r1 + 1) * cell - 3;
        ctx.beginPath(); ctx.moveTo(xr, ya); ctx.lineTo(xr, yb); ctx.lineWidth = 1; ctx.strokeStyle = line(0.6); ctx.stroke();
        ctx.save();
        ctx.translate(xr + 10, (ya + yb) / 2);
        ctx.rotate(Math.PI / 2);
        plainText(ctx, f.label, 0, 0, { font: font(LABEL_PX, weight), colour });
        ctx.restore();
      }
    }
  }

  const surf = surface(canvas, (ctx, w, h) => (view === "square" ? paintSquare(ctx, w, h) : paintWheel(ctx, w, h)));

  function click(e) {
    if (!geo) return;
    let hit = null;
    if (geo.view === "wheel") {
      const x = (e.x - geo.cx) / geo.r, y = (e.y - geo.cy) / geo.r, light = wheelHit(x, y);
      if (light) hit = { sector: light.sector, ring: light.ring, i: light.i, row: light.i >> 3, col: light.i & 7 };
      else if (Math.hypot(x, y) <= (geo.r + DIGIT_BAND + 10) / geo.r) {     // the digit outside its sector
        let a = Math.atan2(x, -y);
        if (a < 0) a += TAU;
        hit = { sector: Math.min(15, Math.floor(a / (TAU / 16))), ring: null, i: null, row: null, col: null };
      }
    } else {
      const u = (e.x - geo.x) / (8 * geo.cell), v = (e.y - geo.y) / (8 * geo.cell), light = squareHit(u, v);
      if (light) hit = { sector: light.i >> 2, ring: light.i & 3, i: light.i, row: light.row, col: light.col };
      else if (v >= 0 && v < 1 && u > -22 / (8 * geo.cell) && u < 1 + 22 / (8 * geo.cell)) {
        hit = { sector: Math.floor(v * 8) * 2 + (u < 0 ? 0 : 1), ring: null, i: null, row: null, col: null };
      }
    }
    if (hit) call(options.onPick, { ...hit, view: geo.view, x: e.x, y: e.y, pointerType: e.pointerType });
  }
  const pointer = attachPointer(canvas, { onClick: click, place: false });
  const keepClick = swallowTapClick(canvas);

  return {
    set(next = {}) {
      if (next.word !== undefined) word = next.word || null;
      if (next.view !== undefined) view = next.view === "square" ? "square" : "wheel";
      if (next.sector !== undefined) sector = Number.isInteger(next.sector) && next.sector >= 0 && next.sector < 16 ? next.sector : null;
      surf.invalidate();
    },
    redraw: surf.invalidate,
    geometry: () => (geo ? { ...geo } : null),
    get view() { return view; },
    pointer,
    destroy() { pointer.detach(); keepClick(); surf.destroy(); },
  };
}

// ─── 3. the figures of station 7 ─────────────────────────────────────────────

const KIND_ALIAS = new Map([["a", "three"], ["b", "mirror"], ["c", "quarters"], ["d", "squares"], ["e", "corners"]]);
// the 64 lights of a word in reading order, from its 16 hex digits (a drawing helper: the first digit holds lights 0 to 3)
const lightsOfHex = (hex) => {
  const out = [];
  for (let i = 0; i < 64; i++) { const d = parseInt(String(hex).charAt(i >> 2), 16); out.push(Number.isFinite(d) ? (d >> (3 - (i & 3))) & 1 : 0); }
  return out;
};
function light(ctx, x, y, size, on, hollow) {
  if (hollow) {
    ctx.fillStyle = LIGHT_OFF;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    if (on) { ctx.lineWidth = 2; ctx.strokeStyle = LIGHT_ON; ctx.strokeRect(x + 4, y + 4, size - 8, size - 8); }
    return;
  }
  ctx.fillStyle = on ? LIGHT_ON : LIGHT_OFF;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
}

export function createFigure(canvas, kind, options = {}) {
  const what = KIND_ALIAS.get(kind) || kind;
  if (!FIGURE_KINDS.includes(what)) throw new Error("unknown figure");
  let data = options.data || null, extra = options.extra || {}, geo = null;
  let points = data && Array.isArray(data.points) ? data.points.map((p) => p.slice()) : null, stale = false, held = null;

  // (a) three squared distances
  function paintThree(ctx, w, h) {
    const pad = 26, side = Math.max(40, Math.min(w, h) - 2 * pad), x0 = (w - side) / 2, y0 = (h - side) / 2;
    geo = { x0, y0, side };
    const at = (p) => { const [u, v] = tqfPlace(p); return [x0 + u * side, y0 + v * side]; };
    const steps = Math.round(1 / (tqfPlace([1, 0])[0] - tqfPlace([0, 0])[0]));
    ctx.lineWidth = 1;
    ctx.strokeStyle = line(0.22);
    ctx.beginPath();
    for (let k = 0; k <= steps; k++) {
      const t = k * side / steps;
      ctx.moveTo(x0 + t, y0); ctx.lineTo(x0 + t, y0 + side);
      ctx.moveTo(x0, y0 + t); ctx.lineTo(x0 + side, y0 + t);
    }
    ctx.stroke();
    ctx.fillStyle = line(0.7);
    for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps; j++) { ctx.beginPath(); ctx.arc(x0 + i * side / steps, y0 + j * side / steps, 1.6, 0, TAU); ctx.fill(); }
    if (!points || points.length !== 3) return;
    const P = points.map(at), centre = [(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3];
    const flat = data && data.collinear && !stale;
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]); ctx.lineTo(P[1][0], P[1][1]); ctx.lineTo(P[2][0], P[2][1]); ctx.closePath();
    if (!flat) { ctx.fillStyle = line(0.16); ctx.fill(); }
    ctx.lineWidth = 2;
    ctx.strokeStyle = LIGHT_ON;
    ctx.setLineDash(flat ? [6, 5] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    // each squared distance beside its side: squares[k] is the side opposite point k
    if (!stale && data && Array.isArray(data.squares) && data.squares.length === 3) {
      for (let k = 0; k < 3; k++) {
        const a = P[(k + 1) % 3], b = P[(k + 2) % 3], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1) continue;
        let ox = mx - centre[0], oy = my - centre[1];
        const o = Math.hypot(ox, oy);
        if (o < 1) { ox = -(b[1] - a[1]); oy = b[0] - a[0]; }
        const n = Math.hypot(ox, oy) || 1;
        plateText(ctx, String(data.squares[k]), clamp(mx + 13 * ox / n, 14, w - 14), clamp(my + 13 * oy / n, 11, h - 11), { weight: 600 });
      }
    }
    P.forEach((p, k) => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 10, 0, TAU);
      ctx.fillStyle = k === held ? ACCENT : LIGHT_ON;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = DARK;
      ctx.stroke();
      plainText(ctx, String(k + 1), p[0], p[1] + 0.5, { font: font(LABEL_PX, 700), colour: DARK });
    });
  }
  function movePoint(index, e) {
    if (!geo || !points) return;
    const p = tqfSnap((e.x - geo.x0) / geo.side, (e.y - geo.y0) / geo.side);
    if (p[0] === points[index][0] && p[1] === points[index][1]) return;
    points = points.map((q, k) => (k === index ? p : q.slice()));
    stale = true;
    surf.invalidate();
    call(options.onPoints, points.map((q) => q.slice()), index);
  }

  // (b) the mirror word
  function paintMirror(ctx, w, h) {
    const cell = Math.max(6, Math.floor((Math.min(w, h) - 8) / 8)), x0 = Math.round((w - 8 * cell) / 2), y0 = Math.round((h - 8 * cell) / 2);
    geo = { x0, y0, cell };
    const stage = extra.stage === 1 || extra.stage === 2 ? extra.stage : 3, shown = stage === 1 ? 2 : stage === 2 ? 4 : 8;
    const cells = data && Array.isArray(data.cells) ? data.cells : [];
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const x = x0 + col * cell, y = y0 + row * cell, c = cells[row * 8 + col];
      if (!c || row >= shown || col >= shown) { ctx.lineWidth = 1; ctx.strokeStyle = line(0.25); ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3); continue; }
      const fourth = row >= 4 && col >= 4, k = (row - 4) * 4 + (col - 4);
      const lit = fourth && Array.isArray(data.fourth) ? data.fourth[k] === 1 : c.on;
      light(ctx, x, y, cell, lit, fourth && data.hidden);
      if (fourth && data.wrongBit === k) { ctx.lineWidth = 2.5; ctx.strokeStyle = WRONG; ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4); }
    }
    // the four corner squares, the first corner, and the seed: one sixteenth
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = line(0.8);
    ctx.beginPath();
    ctx.moveTo(x0 + 4 * cell, y0); ctx.lineTo(x0 + 4 * cell, y0 + 8 * cell);
    ctx.moveTo(x0, y0 + 4 * cell); ctx.lineTo(x0 + 8 * cell, y0 + 4 * cell);
    ctx.stroke();
    ctx.strokeRect(x0, y0, 8 * cell, 8 * cell);
    if (data && data.hidden && stage === 3) { ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.strokeRect(x0 + 4 * cell + 2, y0 + 4 * cell + 2, 4 * cell - 4, 4 * cell - 4); ctx.setLineDash([]); }
    ctx.lineWidth = 4; ctx.strokeStyle = DARK; ctx.strokeRect(x0, y0, 2 * cell, 2 * cell);
    ctx.lineWidth = 2; ctx.strokeStyle = ACCENT; ctx.strokeRect(x0, y0, 2 * cell, 2 * cell);
  }

  // (c) three quarters and the fourth
  function paintQuarters(ctx, w, h) {
    geo = null;
    if (!data || typeof data.hex !== "string") return;
    const bits = lightsOfHex(data.hex), gap = 14, cell = Math.max(5, Math.floor(Math.min((w - 3 * gap - 8) / 16, (h - 30) / 4)));
    const total = 16 * cell + 3 * gap, x0 = Math.round((w - total) / 2), y0 = Math.round((h - 4 * cell - 24) / 2);
    for (let q = 0; q < 4; q++) {
      const bx = x0 + q * (4 * cell + gap);
      for (let k = 0; k < 16; k++) light(ctx, bx + (k & 3) * cell, y0 + (k >> 2) * cell, cell, bits[q * 16 + k] === 1, false);
      const last = q === 3, fits = data.fits !== false;
      ctx.lineWidth = last ? 2 : 1.5;
      ctx.strokeStyle = last ? (fits ? ACCENT : WRONG) : line(0.8);
      ctx.setLineDash(last ? [5, 4] : []);
      ctx.strokeRect(bx - 1, y0 - 1, 4 * cell + 2, 4 * cell + 2);
      ctx.setLineDash([]);
      const parity = Array.isArray(data.parities) ? data.parities[q] : null;
      plainText(ctx, parity === 1 ? "odd" : parity === 0 ? "even" : "", bx + 2 * cell, y0 + 4 * cell + 13, { font: font(LABEL_PX, last ? 700 : 500) });
    }
  }

  // (d) 1, 4, 9, then 16
  function paintSquares(ctx, w, h) {
    geo = null;
    if (!data || !Array.isArray(data.squares)) return;
    const values = [...data.squares, data.next].filter((v) => Number.isInteger(v) && v > 0 && v <= 400), sides = values.map((v) => Math.round(Math.sqrt(v)));
    const gap = 16, units = sides.reduce((a, b) => a + b, 0), tall = Math.max(1, ...sides);
    const cell = Math.max(5, Math.floor(Math.min((w - 8 - gap * (sides.length - 1)) / units, (h - 30) / tall)));
    const total = units * cell + gap * (sides.length - 1), base = Math.round((h - tall * cell - 24) / 2) + tall * cell;
    let x = Math.round((w - total) / 2);
    sides.forEach((n, k) => {
      const last = k === sides.length - 1 && values[k] === data.next, top = base - n * cell;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) light(ctx, x + i * cell, top + j * cell, cell, true, last);
      if (last) { ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.strokeStyle = ACCENT; ctx.strokeRect(x - 1, top - 1, n * cell + 2, n * cell + 2); ctx.setLineDash([]); }
      plainText(ctx, String(values[k]), x + n * cell / 2, base + 13, { font: font(LABEL_PX, last ? 700 : 500) });
      x += n * cell + gap;
    });
  }

  // (e) a corner, flat and curved: three of the figures that meet there are filled, the rest are outlined
  function paintCorners(ctx, w, h) {
    geo = null;
    if (!data || !data.flat || !data.curved) return;
    const half = w / 2, r = Math.max(20, Math.min(half / 2 - 10, (h - 30) / 2 - 4)), cy = (h - 22) / 2;
    // flat paper
    const fx = half / 2, nFlat = clamp(Math.round(data.flat.meet) || 4, 3, 8), aFlat = TAU / nFlat, s = r * 0.66;
    for (let k = 0; k < nFlat; k++) {
      const a0 = -Math.PI / 2 + k * aFlat, a1 = a0 + aFlat, am = a0 + aFlat / 2, far = s / Math.cos(aFlat / 2);
      ctx.beginPath();
      ctx.moveTo(fx, cy);
      ctx.lineTo(fx + s * Math.cos(a0), cy + s * Math.sin(a0));
      ctx.lineTo(fx + far * Math.cos(am), cy + far * Math.sin(am));
      ctx.lineTo(fx + s * Math.cos(a1), cy + s * Math.sin(a1));
      ctx.closePath();
      if (k < 3) { ctx.fillStyle = line(0.3); ctx.fill(); }
      ctx.lineWidth = 1.5; ctx.strokeStyle = k < 3 ? LIGHT_ON : ACCENT; ctx.setLineDash(k < 3 ? [] : [5, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    plainText(ctx, "flat: " + nFlat + " meet", fx, h - 12, { font: font(LABEL_PX, 500) });
    // the curved map: regular four-sided figures, q of them round the centre of a disc
    const dx = half + half / 2, q = clamp(Math.round(data.curved.meet) || 5, 5, 12), aq = TAU / q;
    const edge = Math.tanh(Math.acosh(Math.SQRT1_2 / Math.sin(Math.PI / q))), across = Math.tanh(Math.acosh(1 / Math.tan(Math.PI / q)));
    ctx.beginPath(); ctx.arc(dx, cy, r, 0, TAU); ctx.fillStyle = GROUND; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = line(0.6); ctx.stroke();
    for (let k = 0; k < q; k++) {
      const a0 = Math.PI / 2 - k * aq, a1 = a0 - aq, am = a0 - aq / 2;
      const A = [edge * Math.cos(a0), edge * Math.sin(a0)], B = [edge * Math.cos(a1), edge * Math.sin(a1)], C = [across * Math.cos(am), across * Math.sin(am)];
      ctx.beginPath();
      ctx.moveTo(dx, cy);
      ctx.lineTo(dx + r * A[0], cy - r * A[1]);
      discLine(ctx, A, C, dx, cy, r);
      discLine(ctx, C, B, dx, cy, r);
      ctx.closePath();
      if (k < 3) { ctx.fillStyle = line(0.3); ctx.fill(); }
      ctx.lineWidth = 1.5; ctx.strokeStyle = k < 3 ? LIGHT_ON : ACCENT; ctx.setLineDash(k < 3 ? [] : [5, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    plainText(ctx, "curved: " + q + " meet", dx, h - 12, { font: font(LABEL_PX, 500) });
  }

  const painters = { three: paintThree, mirror: paintMirror, quarters: paintQuarters, squares: paintSquares, corners: paintCorners };
  const surf = surface(canvas, painters[what]);

  function click(e) {
    if (!geo) return;
    if (what === "three" && points) {
      movePoint(tqfNearest(points, (e.x - geo.x0) / geo.side, (e.y - geo.y0) / geo.side), e);
    } else if (what === "mirror") {
      const col = Math.floor((e.x - geo.x0) / geo.cell), row = Math.floor((e.y - geo.y0) / geo.cell);
      if (row < 0 || row > 7 || col < 0 || col > 7) return;
      const at = { row, col, x: e.x, y: e.y, pointerType: e.pointerType };
      if (row < 2 && col < 2) call(options.onPick, { part: "seed", index: row * 2 + col, ...at });
      else if (row >= 4 && col >= 4) call(options.onPick, { part: "fourth", index: (row - 4) * 4 + (col - 4), ...at });
      else call(options.onPick, { part: "cell", i: row * 8 + col, ...at });
    }
  }
  function drag(e) {
    if (what !== "three" || !geo || !points) return;
    if (e.first || held === null) held = tqfNearest(points, (e.startX - geo.x0) / geo.side, (e.startY - geo.y0) / geo.side);
    movePoint(held, e);
    surf.invalidate();
  }
  function dragEnd() { if (held !== null) { held = null; surf.invalidate(); } }
  const pointer = attachPointer(canvas, what === "three"
    ? { onClick: click, onDrag: drag, onDragEnd: dragEnd, dragSwitch: options.dragSwitch, dragCaption: options.dragCaption, place: false }
    : { onClick: click, place: false });
  const keepClick = swallowTapClick(canvas);

  return {
    kind: what,
    set(next, more) {
      data = next || null;
      if (more !== undefined) extra = more || {};
      if (what === "three") { points = data && Array.isArray(data.points) && data.points.length === 3 ? data.points.map((p) => p.slice()) : null; stale = false; }
      surf.invalidate();
    },
    redraw: surf.invalidate,
    pointer,
    destroy() { pointer.detach(); keepClick(); surf.destroy(); },
  };
}
