// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Celestial Control Panel: the canvases (specification 7.2, 7.3, 7.4; rules 1.5 and 1.6).
// Drawing and pointer handling only. Every place, name and number that is drawn comes from plain data made by
// celestial-panel-model.js (scene, labScene, moonFigure); taps and drags are answered with the model's own
// functions (tapView, dragView) and reported through callbacks. This module keeps no page state: the chart
// keeps the last state it was given, the view that is on the canvas while a flight runs, and how far a walk of
// the lab has come; a Moon picture keeps the last figure it was told to draw. Nothing runs by itself: a canvas
// is redrawn when it is told something new, when its box changes size, when a web font arrives, and frame by
// frame while a flight (at most FLIGHT_MS) or a walk of the lab is running. With reduced motion both are
// jumps. No text is written into the page.
//
// THE INTERFACE (three makers; the shell calls nothing else)
//
// Every canvas must be sized by CSS (the chart takes the kit's class "chart"; give a Moon picture a width and
// a height or an aspect-ratio). The module sets the bitmap to the CSS box times the device pixel ratio and draws
// in CSS pixels. A canvas that is not laid out (display: none) is skipped and drawn when it gets a box.
// The module does not call describeCanvas: the shell gives each canvas its label and its visible caption
// (role=img, aria-label, aria-describedby; sceneCaption(state), LAB.caption and moonFigure(state).label are the
// model's words for them). The chart draws up to its corners (the name of the rim is written outside the disc):
// do not clip it round.
//
// 1. createSkyChart(canvas, options) -> chart          (the sky chart in 2D and 3D, and the lab's stage)
//    One canvas shows the chart, or, while state.lab.open, the lab's stage (a plain disc, the floor, the path
//    and the walker): "Open the lab" clears the sky and leaving the lab restores it.
//    options (all optional):
//      state         a state of the model (initialState(...)); without one the canvas shows an empty dark disc
//      dragSwitch, dragCaption, place   passed to attachPointer of the kit (it makes the "Drag the map" switch
//                    and its caption and puts them after the canvas unless the shell passes its own elements or
//                    place: false). The touch rules of 1.6 are the kit's: a finger scrolls the page, a tap
//                    picks, and a finger drags only while the switch is on.
//      onChange(next, info)   the pointer changed the state. next is a new state of the model; the chart has
//                    ALREADY taken it, and after a tap it starts the flight as soon as this callback returns:
//                    the shell stores next as its state and re-renders its own regions. Calling chart.set(next)
//                    (or chart.set of a state made from next) inside the callback is harmless: the chart then
//                    flies where the shell said. onChange always comes before the onArrive of its flight.
//                    info: { cause: "tap" | "drag", key, x, y, pointerType, end }
//                      tap:  key is the object that was picked and selected (within 22 px of the tap, or its
//                            drawn label), "home" (the home marker or its label: goHome), or null (2D: the
//                            tapped point of the map was brought to the centre). Not called when a tap changes
//                            nothing (outside the disc; empty room in 3D; the dark first screen).
//                      drag: called for every pointer move (mouse, pen, or a finger with the switch on) with
//                            end: false, and once more with end: true when the drag is over. 2D: the grabbed
//                            point follows the pointer (dragView) and the view is free (centred: null). 3D:
//                            only state.orbit changes.
//                    x, y are CSS pixels from the canvas corner.
//      onArrive(state)        a flight or a walk of the lab came to its end (with reduced motion at once, inside
//                    the call that started it). Not called for a jump the shell asked for, nor when nothing moved.
//      onSlide({ index, of }) the walker of the lab finished slide number index (1-based) of the of slides of
//                    state.lab.slides.
//      onScene(scene, kind)   the picture changed in a way a caption or a control shows: called after a draw
//                    when kind ("sky" | "lab"), dims, frame, dark, diving, rimLabel or centreCaption differs
//                    from the last call (so at most twice in a flight). scene is the value of the
//                    model's scene(...) or labScene(...) that was just drawn. scene.centreCaption ("straight up
//                    has no compass direction") and scene.rimLabel belong in the caption under the canvas: the
//                    canvas writes them too, but only where there is free room.
//    chart (the returned object):
//      set(state, { jump, walk, walkMs })   show this state. Sky: when the view of the state (c in 2D, view3 in 3D)
//                    differs from the view on the canvas, the chart flies there along flightPlan(...) of the
//                    model (at most FLIGHT_MS); { jump: true } goes at once (pass it for a slider that is being
//                    moved). A change of dims, of frame, into or out of the lab, and reduced motion are jumps.
//                    The orbit is never animated. Lab (state.lab.open): when state.lab.slides continues the
//                    slides on the stage (one more slide, "Slide home"), the walker slides along each new one,
//                    walkMs milliseconds a slide (default WALK_MS; pass LAB.slideMs for "Four slides"; never
//                    more than WALK_MS_MAX for all of them). Any other change of the slides is drawn at once
//                    (the step slider, "Start again"), unless { walk: true } is passed: then the walker
//                    starts again from where the new path leaves the old one ("Four slides" and "Slide round
//                    one tile" pressed when a path is already there). { jump: true }, reduced motion and
//                    opening the lab draw the path at once. To walk a path again that is already on the stage,
//                    set the lab without slides first (labReset) and then the path.
//      finish()      a running flight or walk jumps to its end (onArrive is called)
//      pause(), resume()             hold and continue a running walk of the lab ("Pause", "Play")
//      redraw()      ask for one frame
//      destroy()     detach everything
//      state         (getter) the state last given or made
//      view          (getter) a copy of the view on the canvas now: { c, view3, orbit }
//      flying, walking, paused       (getters) a flight is running; a walk is running or paused; it is paused
//      size          (getter) { w, h }: the CSS box (labSetA(lab, a, small) wants small = size.w under
//                    LAB.smallCanvas)
//      scene         (getter) the model's scene(...) for the view on the canvas now (null in the lab), made
//                    on demand with the canvas's own text measure
//      labels()      the text boxes of the last draw (after a set() that is one frame later), none overlapping
//                    another:
//                    [{ key, kind, text, x, y, w, h }] in CSS pixels. kind: "home", "object" (key an object
//                    key), "ring" and "tick" (keys as in scene.labels), "detail" (the detail line of a near
//                    object, key its object), "circle" (3D: the name of a great circle), "mark" (A to D),
//                    "cluster" (a count), "caption" (the centre caption), "rim" (the name of the rim, written
//                    along it: the box is its bounding box and may cross others), "lab" (the word home).
//      pointer       what attachPointer returned: { dragSwitch, dragCaption, dragging, setDragging(on) }.
//                    Nothing can be dragged in the lab: the shell may hide pointer.dragSwitch there.
//    What the shell does itself, with the model: nudge buttons (chart.set(nudgeView(state, dir))), turn buttons
//    (chart.set({ ...state, orbit: orbitTurn(state.orbit, dir) })), quick buttons and the list (chart.set(
//    dive(state, key))), every other control (chart.set(next)), the HUD, the caption, the status line.
//    What is drawn. 2D: the disc; depth rings; the rays where a switched-on great circle crosses the map's
//    plane, each with a tick on the rim; sight lines; the objects in the model's paint order (a body is a
//    dot, hollow when it is below the frame's plane; a compass point is a tick on the rim; a rim object is a
//    diamond, hollow when it has no bearing in the flat map); the home marker; the rim points A to D; one count
//    for dots that sit together; the labels. 3D: the outline; the far halves of the great circles at 35 %
//    opacity; rings; rays, objects and home sorted by depth; the near halves; the labels. A label is the
//    object's glyph and the name the model chose (the short name far from the centre, the full name and one
//    detail line within the model's VIEW.near). Labels are LABEL_PX and never scale. Only the selected object
//    has a glow. Colours: none of the four layer colours is used on a canvas. No box of text lies over another
//    object's dot or over a mark A to D: the model places the names so, and the boxes made here (detail lines,
//    circle names, counts) keep the same rule. A name that must be shown and found no free place is the one
//    exception: the dots under its plate are painted again, over the plate.
//
// 2. createMoonPicture(canvas, options) -> picture     (the Moon as it looks from the place; also the small
//    pictures of the eight Moon-shape buttons)
//    options: figure (see set), mark (true: a tick and the word "up" above the disc when the canvas is at
//      least 120 px; pass false for the small pictures)
//    picture: set(figure), redraw(), destroy(), figure (getter)
//      figure is moonFigure(state) of the model, one entry of moonButtons(state), or null (an empty outline).
//      Read: terminator (or fraction), limbDeg, below. The bright limb is drawn towards limbDeg (degrees from
//      "up" towards the right); below: true dims the picture.
//
// 3. createShellsFigure(canvas, options) -> figure     (the Blueprint dialog: the four shells drawn over the rings)
//    options: shells, rings (see set)
//    figure: set({ shells, rings }), redraw(), destroy()
//      shells is BLUEPRINT.shells of the model: each { from, to } is a share of the disc's radius (0 to 1; from
//      equal to to is a point, drawn as a dot at the centre). rings is a list of such shares, one a depth ring
//      (Math.tanh(rho / 2) for each of the core's RINGS), drawn as thin circles. The shells are bands of two
//      alternating tints, numbered 1, 2, 3, ... in the order given; the names belong in a numbered list beside
//      the canvas (the figure writes only the numbers). Give the canvas a square box of 160 px or more.
//
// Also exported: LABEL_PX (13), WALK_MS (600), WALK_MS_MAX (8000).
import { attachPointer, invalidator, animate, HIT_REACH, FLIGHT_MS } from "../explorer-kit.js";
import { scene as skyScene, labScene, tapView, dragView, flightPlan, select, retarget, goHome, LABEL } from "./celestial-panel-model.js";

/** LABEL_PX: the size of every canvas label. It is never scaled with the geometry. */
export const LABEL_PX = LABEL.font;
/** WALK_MS: how long the walker of the lab takes for one slide unless set() is told otherwise. */
export const WALK_MS = 600;
/** WALK_MS_MAX: the longest a walk may take in all (the "Four slides" animation: at most 8 s). */
export const WALK_MS_MAX = 8000;

// ─── the look ────────────────────────────────────────────────────────────────
// None of these is one of the four layer colours.
const INK = "#e2e8f0", DIM = "#94a3b8", DARK = "#020617", ACCENT = "#38bdf8", ACCENT_INK = "#bae6fd", RIM_INK = "#d8b4fe";
const GROUND = "#050b18", GROUND_MID = "#0b1730", NIGHT = "#03060d", PLATE = "rgba(2, 6, 23, 0.84)";
const MOON_LIT = "#dbe3ee", MOON_DARK = "#1b2536";
const line = (alpha) => "rgba(148, 163, 184, " + alpha.toFixed(3) + ")";
const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", "Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", sans-serif';
const font = (px, weight) => (weight || 400) + " " + px + "px " + SANS;
const TAU = 2 * Math.PI;
// The four great circles: a colour and a dash each, and always a name beside them.
const CIRCLE_LOOK = new Map([
  ["horizon", { colour: "#34d399", dash: [] }],
  ["equator", { colour: "#38bdf8", dash: [7, 4] }],
  ["ecliptic", { colour: "#fb7185", dash: [2, 3] }],
  ["galactic", { colour: "#c084fc", dash: [10, 3, 2, 3] }],
]);
const PLAIN_LOOK = { colour: DIM, dash: [] };
const lookOf = (key) => CIRCLE_LOOK.get(String(key).replace(/-\d+$/, "")) || PLAIN_LOOK;
const OWN_CIRCLE = new Map([["hor", "horizon"], ["gal", "galactic"]]);      // the circle that is the rim of each frame
const GLYPH_ROOM = 18;            // px kept before a name for the object's glyph
const LINE_H = LABEL.height, PAD = LABEL.pad;

const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);
const clamp = (v, lo, hi) => (hi < lo ? lo : Math.min(hi, Math.max(lo, v)));
const finite = (...v) => v.every(Number.isFinite);
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
const ease = (t) => t * t * (3 - 2 * t);
const isMatrix = (m) => Array.isArray(m) && m.length === 16 && m.every(Number.isFinite);
const isState = (s) => !!s && typeof s === "object" && Array.isArray(s.c) && finite(s.c[0], s.c[1]) && isMatrix(s.view3) && isMatrix(s.orbit) && !!s.lab && Array.isArray(s.lab.slides);
const viewOf = (s) => ({ c: [s.c[0], s.c[1]], view3: s.view3.slice() });
const sameView = (a, b) => Math.abs(a.c[0] - b.c[0]) < 1e-12 && Math.abs(a.c[1] - b.c[1]) < 1e-12 && a.view3.every((v, i) => Math.abs(v - b.view3[i]) < 1e-12);
const sameSlide = (a, b) => !!a && !!b && a.angle === b.angle && a.dist === b.dist;
const isWord = (text) => /^[\p{L}\p{N}]+$/u.test(text);

// ─── one canvas: its bitmap, its one frame per change ────────────────────────

// surface(canvas, paint) -> { ctx, invalidate, destroy }. paint(ctx, w, h) draws in CSS pixels.
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
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
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
    ctx, invalidate: again,
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
function plate(ctx, box) {
  roundRect(ctx, box.x, box.y, box.w, box.h, 4);
  ctx.fillStyle = PLATE;
  ctx.fill();
}
function words(ctx, text, x, y, colour, weight, align) {
  ctx.font = font(LABEL_PX, weight || 500);
  ctx.textAlign = align || "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
}
// A run of points as one path. A point that is not finite breaks the line.
function trace(ctx, points, closed) {
  let pen = false, first = null;
  ctx.beginPath();
  for (const p of points) {
    if (!p || !finite(p.x, p.y)) { pen = false; continue; }
    if (pen) ctx.lineTo(p.x, p.y);
    else { ctx.moveTo(p.x, p.y); pen = true; if (!first) first = p; }
  }
  if (closed && pen && first && points.length > 2 && finite(points[0].x, points[0].y)) ctx.closePath();
}
// A closed curve through sampled points, with its corners rounded (each point is the control point of a short
// curve between the middles of its two sides). Falls back to straight pieces when a point is not finite.
function traceRound(ctx, points) {
  const n = points.length;
  if (n < 4 || points.some((p) => !p || !finite(p.x, p.y))) { trace(ctx, points, true); return; }
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(points[n - 1], points[0]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < n; i++) {
    const m = mid(points[i], points[(i + 1) % n]);
    ctx.quadraticCurveTo(points[i].x, points[i].y, m.x, m.y);
  }
  ctx.closePath();
}
// In the flat map a depth ring is a true circle wherever the view stands. It is drawn as one, through three of
// its points, when the other points agree; otherwise as the rounded curve through all of them.
function traceRing(ctx, points, flat) {
  const n = points.length;
  if (flat && n >= 12 && points.every((p) => p && finite(p.x, p.y))) {
    const a = points[0], b = points[Math.floor(n / 3)], c = points[Math.floor((2 * n) / 3)];
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) > 1e-6) {
      const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
      const x = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d, y = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
      const r = Math.hypot(a.x - x, a.y - y);
      if (finite(x, y, r) && r > 0 && points.every((p) => Math.abs(Math.hypot(p.x - x, p.y - y) - r) < 0.75)) { disc(ctx, x, y, r); return; }
    }
  }
  traceRound(ctx, points);
}
// A great circle of the rim is a circle of the sphere under every view, but after a dive the model's 96
// directions crowd to one side of it and the other side showed corners. The same circle (the plane through
// three of its points, when all the others lie in it) is sampled again at even steps; otherwise the points are
// returned as they came.
const EVEN_STEPS = 192;
function evenCircle(points, sc) {
  const n = points.length;
  if (n < 12 || !(sc.R3 > 0) || points.some((p) => !p || !finite(p.x, p.y, p.z))) return points;
  const v = points.map((p) => [(p.x - sc.cx) / sc.R3, -(p.y - sc.cy) / sc.R3, p.z]);
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]], dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const a = v[0];
  let b = a, c = a, far = 0, wide = 0;
  for (const q of v) { const d = dot(sub(q, a), sub(q, a)); if (d > far) { far = d; b = q; } }
  for (const q of v) { const k = cross(sub(b, a), sub(q, a)), d = dot(k, k); if (d > wide) { wide = d; c = q; } }
  if (!(wide > 1e-12)) return points;
  let m = cross(sub(b, a), sub(c, a));
  const len = Math.sqrt(dot(m, m));
  m = [m[0] / len, m[1] / len, m[2] / len];
  const d = dot(m, a), r = Math.sqrt(Math.max(0, 1 - d * d));
  if (!(r > 1e-6) || v.some((q) => Math.abs(dot(m, q) - d) > 1e-6)) return points;
  const centre = [m[0] * d, m[1] * d, m[2] * d], e1 = sub(a, centre).map((x) => x / r), e2 = cross(m, e1);
  const out = [];
  for (let i = 0; i < EVEN_STEPS; i++) {
    const t = (TAU * i) / EVEN_STEPS, co = r * Math.cos(t), si = r * Math.sin(t);
    const q = [centre[0] + co * e1[0] + si * e2[0], centre[1] + co * e1[1] + si * e2[1], centre[2] + co * e1[2] + si * e2[2]];
    out.push({ x: sc.cx + sc.R3 * q[0], y: sc.cy - sc.R3 * q[1], z: q[2] });
  }
  return out;
}
// The far (z < 0) or the near half of a closed curve of the ball, as one path of separate pieces.
function traceHalf(ctx, points, near) {
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (!finite(a.x, a.y, a.z, b.x, b.y, b.z) || ((a.z + b.z) / 2 >= 0) !== near) { pen = false; continue; }
    if (!pen) ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    pen = true;
  }
}
function stroke(ctx, colour, width, dash) {
  ctx.setLineDash(dash || []);
  ctx.lineWidth = width;
  ctx.strokeStyle = colour;
  ctx.stroke();
  ctx.setLineDash([]);
}
// Text along a circle of radius r round (cx, cy), centred on the angle mid (clockwise from the top). In the
// lower half the letters are turned so that the words still read from left to right. Returns the angle taken.
function arcText(ctx, text, cx, cy, r, mid, colour) {
  ctx.font = font(LABEL_PX, 500);
  ctx.fillStyle = colour;
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
  return total / r;
}
function disc(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}
function diamond(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.25);
  ctx.lineTo(x + r * 1.25, y);
  ctx.lineTo(x, y + r * 1.25);
  ctx.lineTo(x - r * 1.25, y);
  ctx.closePath();
}

// ─── the sky chart ───────────────────────────────────────────────────────────

function skyGround(ctx, sc) {
  const { x, y, r } = sc.outline;
  if (!finite(x, y, r) || !(r > 0)) return false;
  disc(ctx, x, y, r);
  if (sc.dark) ctx.fillStyle = NIGHT;
  else {
    const flat = sc.dims !== "3D";
    const g = flat ? ctx.createRadialGradient(x, y, 0, x, y, r) : ctx.createRadialGradient(x - 0.35 * r, y - 0.4 * r, 0.05 * r, x, y, r);
    g.addColorStop(0, flat ? GROUND_MID : "#12224a");
    g.addColorStop(1, GROUND);
    ctx.fillStyle = g;
  }
  ctx.fill();
  const own = sc.rimLabel ? lookOf(OWN_CIRCLE.get(sc.frame)) : null;
  disc(ctx, x, y, r);
  stroke(ctx, own ? own.colour : line(sc.dark ? 0.3 : 0.55), own ? 2 : 1.5);
  return true;
}

function homeMark(ctx, home, alpha) {
  if (!finite(home.x, home.y)) return;
  ctx.globalAlpha = alpha;
  disc(ctx, home.x, home.y, 6.5);
  stroke(ctx, DARK, 4);
  disc(ctx, home.x, home.y, 6.5);
  stroke(ctx, ACCENT, 2);
  disc(ctx, home.x, home.y, 2.2);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.globalAlpha = 1;
}

const depthAlpha = (k) => clamp(0.75 + (k - 1), 0.45, 1);      // 3D: the far side of the ball is fainter

function drawObject(ctx, b, sc) {
  if (!finite(b.x, b.y, b.r) || !(b.r > 0)) return;
  const flat = sc.dims !== "3D", r = b.r;
  ctx.globalAlpha = flat ? 1 : depthAlpha(b.k);
  if (b.selected) {                       // the one glow of the picture
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 12;
    disc(ctx, b.x, b.y, r + 5);
    stroke(ctx, ACCENT, 2);
    ctx.shadowBlur = 0;
  }
  if (b.kind === "body") {
    disc(ctx, b.x, b.y, r);
    if (b.hollow) {
      ctx.fillStyle = GROUND;
      ctx.fill();
      stroke(ctx, DARK, 3.5);
      disc(ctx, b.x, b.y, r);
      stroke(ctx, INK, 1.75);
    } else {
      ctx.fillStyle = INK;
      ctx.fill();
      stroke(ctx, DARK, 1.25);
    }
  } else if (b.kind === "direction" && flat && b.atRim) {      // a compass point: a tick across the rim
    const dx = b.x - sc.cx, dy = b.y - sc.cy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    ctx.beginPath();
    ctx.moveTo(b.x - 9 * ux, b.y - 9 * uy);
    ctx.lineTo(b.x + 4 * ux, b.y + 4 * uy);
    stroke(ctx, DARK, 5);
    ctx.beginPath();
    ctx.moveTo(b.x - 9 * ux, b.y - 9 * uy);
    ctx.lineTo(b.x + 4 * ux, b.y + 4 * uy);
    stroke(ctx, ACCENT_INK, 2.5);
  } else if (b.kind === "direction") {
    disc(ctx, b.x, b.y, r);
    ctx.fillStyle = ACCENT_INK;
    ctx.fill();
    stroke(ctx, DARK, 1.25);
  } else {                                                      // a point of the rim, or of the outermost shell
    diamond(ctx, b.x, b.y, r);
    if (b.nominal) {
      ctx.fillStyle = GROUND;
      ctx.fill();
      stroke(ctx, RIM_INK, 1.75);
    } else {
      ctx.fillStyle = RIM_INK;
      ctx.fill();
      stroke(ctx, DARK, 1.25);
    }
  }
  ctx.globalAlpha = 1;
}

function drawRay(ctx, ray) {
  trace(ctx, ray.points, false);
  if (ray.kind === "crossing") { const look = lookOf(ray.key); stroke(ctx, look.colour, 1.5, look.dash); }
  else if (ray.kind === "axis") stroke(ctx, ACCENT_INK, 1.5);
  else stroke(ctx, line(0.5), 1, [2, 4]);
}

// Paints one scene of the model and returns the text boxes it drew.
function paintSky(ctx, sc, selected) {
  const boxes = [], flat = sc.dims !== "3D", W = sc.w, H = sc.h;
  if (!skyGround(ctx, sc)) return boxes;
  const measure = (text, weight) => { ctx.font = font(LABEL_PX, weight || 600); return Math.ceil(ctx.measureText(text).width); };
  const free = (box, but) => box.x >= 1 && box.y >= 1 && box.x + box.w <= W - 1 && box.y + box.h <= H - 1 && boxes.every((b) => b === but || b.kind === "rim" || !overlaps(b, box));
  // a box of text keeps clear of every other object's dot, and of the marks A to D with the room for their letters
  const onDot = (box, but) => sc.bodies.some((b) => b !== but && finite(b.x, b.y) && inside({ x: box.x - 4, y: box.y - 4, w: box.w + 8, h: box.h + 8 }, b.x, b.y))
    || sc.marks.some((m) => finite(m.x, m.y) && inside({ x: box.x - LABEL.markRoom, y: box.y - LABEL.markRoom, w: box.w + 2 * LABEL.markRoom, h: box.h + 2 * LABEL.markRoom }, m.x, m.y));

  if (!sc.dark) {
    if (!flat) for (const c of sc.circles) {                    // far halves
      const look = lookOf(c.key);
      ctx.globalAlpha = 0.35;
      traceHalf(ctx, evenCircle(c.points, sc), false);
      stroke(ctx, look.colour, 1.5, look.dash);
      ctx.globalAlpha = 1;
    }
    for (const ring of sc.rings) {
      traceRing(ctx, ring.points, flat);
      if (ring.key === selected) stroke(ctx, ACCENT, 2);
      else stroke(ctx, line(0.26), 1);
    }
    if (flat) {
      for (const ray of sc.rays) drawRay(ctx, ray);
      for (const t of sc.ticks) {
        if (!finite(t.x, t.y)) continue;
        const dx = t.x - sc.cx, dy = t.y - sc.cy, d = Math.hypot(dx, dy) || 1;
        ctx.beginPath();
        ctx.moveTo(t.x - 7 * dx / d, t.y - 7 * dy / d);
        ctx.lineTo(t.x + 5 * dx / d, t.y + 5 * dy / d);
        stroke(ctx, lookOf(t.key).colour, 3);
      }
      for (const b of sc.bodies) drawObject(ctx, b, sc);
      homeMark(ctx, sc.home, 1);
    } else {
      const meanZ = (points) => { let s = 0, n = 0; for (const p of points) if (Number.isFinite(p.z)) { s += p.z; n += 1; } return n ? s / n : 0; };
      const items = [
        ...sc.rays.map((ray) => ({ z: meanZ(ray.points), ray })),
        ...sc.bodies.map((body) => ({ z: body.z, body })),
        { z: sc.home.z, home: true },
      ].sort((a, b) => a.z - b.z);
      for (const it of items) {
        if (it.ray) drawRay(ctx, it.ray);
        else if (it.body) drawObject(ctx, it.body, sc);
        else homeMark(ctx, sc.home, Math.max(0.85, depthAlpha(sc.home.k)));
      }
      for (const c of sc.circles) {                             // near halves
        const look = lookOf(c.key);
        traceHalf(ctx, evenCircle(c.points, sc), true);
        stroke(ctx, look.colour, c.own ? 2 : 1.5, look.dash);
      }
    }
    for (const c of sc.clusters) {
      if (!finite(c.x, c.y)) continue;
      disc(ctx, c.x, c.y, 15);
      stroke(ctx, line(0.6), 1, [3, 3]);
    }
  } else homeMark(ctx, sc.home, 1);

  // ── the labels of the model: the name it chose, in the box it kept free ──
  const bodyOf = new Map(sc.bodies.map((b) => [b.key, b]));
  const fullOf = new Map([...sc.rings.map((r) => ["ring:" + r.key, r.label]), ...sc.ticks.map((t) => ["tick:" + t.key, t.label]), ...sc.bodies.map((b) => [b.key, b.label])]);
  const kept = sc.labels.map((l) => ({ x: l.x, y: l.y, w: l.w, h: l.h }));
  const drawn = [];
  sc.labels.forEach((l, i) => {
    if (!finite(l.x, l.y, l.w, l.h, l.ax, l.ay)) return;
    const b = bodyOf.get(l.key) || null;
    const kind = l.key === "home" ? "home" : b ? "object" : l.key.startsWith("ring:") ? "ring" : l.key.startsWith("tick:") ? "tick" : "other";
    const glyph = b && typeof b.glyph === "string" && b.glyph !== "" && !isWord(b.glyph) ? b.glyph : "";
    const lead = glyph ? GLYPH_ROOM : 0;
    const left = l.x + l.w <= l.ax + 1, over = !left && l.x < l.ax && l.x + l.w > l.ax;     // which side of its dot the box is on
    const fit = (text) => {
      const w = lead + measure(text) + 2 * PAD;
      const x = left ? l.x + l.w - w : over ? clamp(l.x + (l.w - w) / 2, 2, Math.max(2, W - w - 2)) : l.x;
      return { x, y: l.y, w, h: l.h };
    };
    let text = l.text, box = fit(text);
    // The model cuts a name at 32 signs. Where the whole name has room, it is written whole.
    const full = fullOf.get(l.key);
    if (typeof full === "string" && full !== text && text.endsWith("…")) {
      const wide = fit(full);
      const clear = wide.x >= 2 && wide.x + wide.w <= W - 2 && kept.every((k, j) => j === i || !overlaps(k, wide)) && drawn.every((d) => !overlaps(d.box, wide)) && !onDot(wide, b);
      if (clear) { text = full; box = wide; kept[i] = wide; }
      else {                                    // "name: more" that has no room is written as its name, not cut in a word
        const head = full.split(": ")[0];
        if (head !== "" && head !== full && Array.from(head).length < Array.from(text).length) { text = head; box = fit(head); }
      }
    }
    if (box.w > l.w + 0.5 && text !== full) box = { x: l.x, y: l.y, w: l.w, h: l.h };       // never wider than the room that was kept
    // The model keeps a box inside the canvas by pushing it sideways, and that can push it over its own dot.
    // Then the name goes to the left of the dot, above it or below it, wherever nothing else is; failing that
    // it gives up its glyph to stay clear.
    const reach = (b && Number.isFinite(b.r) ? b.r : 5) + 2;
    const covers = (q) => l.ax > q.x - reach && l.ax < q.x + q.w + reach && l.ay > q.y - 2 && l.ay < q.y + q.h + 2;
    let shown = glyph, room = lead;
    if (covers(box)) {
      const w = box.w, h = box.h, off = reach + LABEL.gap - 2;
      const spots = [[l.ax - off - w, l.ay - h / 2], [l.ax - w / 2, l.ay - off - h], [l.ax - w / 2, l.ay + off], [l.ax + off, l.ay - h / 2]];
      const spot = spots.map(([x, y]) => ({ x, y, w, h })).find((q) => q.x >= 2 && q.y >= 2 && q.x + q.w <= W - 2 && q.y + q.h <= H - 2
        && kept.every((k, j) => j === i || !overlaps(k, q)) && drawn.every((d) => !overlaps(d.box, q)) && !onDot(q, null));
      if (spot) { box = spot; kept[i] = spot; }
      else if (glyph) { shown = ""; room = 0; box = { x: l.ax < box.x + box.w / 2 ? box.x + lead : box.x, y: box.y, w: box.w - lead, h: box.h }; }
    }
    if (box.x < 0 || box.y < 0 || box.x + box.w > W || box.y + box.h > H) return;             // a canvas too small for this name: the object stays a dot
    drawn.push({ key: l.key, kind, text, glyph: shown, lead: room, box, body: b, own: null });
  });
  for (const d of drawn) {
    const b = d.body, strong = !!b && (b.selected || b.centred);
    const colour = d.kind === "home" ? ACCENT_INK : d.kind === "ring" ? DIM : d.kind === "tick" ? lookOf(d.key.slice(5)).colour : strong ? "#ffffff" : INK;
    plate(ctx, d.box);
    const mid = d.box.y + d.box.h / 2 + 0.5;
    if (d.glyph) words(ctx, d.glyph, d.box.x + PAD + (GLYPH_ROOM - 4) / 2, mid, d.kind === "object" && b.kind === "rim" ? RIM_INK : colour, 500, "center");
    words(ctx, d.text, d.box.x + PAD + d.lead, mid, colour, strong ? 600 : 500);
    d.own = { key: d.key, kind: d.kind, text: d.text, x: d.box.x, y: d.box.y, w: d.box.w, h: d.box.h };
    boxes.push(d.own);
  }
  if (sc.dark) return boxes;
  // The model keeps every plate clear of the other dots. Only a name that must be shown (home, the centred or the selected
  // object) may have found no such place, deep in a dive where everything near home sits on home: a dot under a plate
  // that is not its own is painted again, over the plate, so that no object is hidden.
  for (const b of sc.bodies) {
    if (finite(b.x, b.y) && drawn.some((d) => d.body !== b && inside({ x: d.box.x - 2, y: d.box.y - 2, w: d.box.w + 4, h: d.box.h + 4 }, b.x, b.y))) drawObject(ctx, b, sc);
  }
  if (finite(sc.home.x, sc.home.y) && drawn.some((d) => d.kind !== "home" && inside(d.box, sc.home.x, sc.home.y))) homeMark(ctx, sc.home, flat ? 1 : Math.max(0.85, depthAlpha(sc.home.k)));

  // ── one detail line under (or over) the name of each near object ──
  for (const d of drawn) {
    const b = d.body;
    if (!b || typeof b.detail !== "string" || b.detail === "") continue;
    const own = d.own, w = measure(b.detail, 400) + 2 * PAD;
    const x = clamp(own.x, 2, Math.max(2, W - w - 2));
    for (const y of [own.y + own.h, own.y - LINE_H]) {
      const box = { key: b.key, kind: "detail", text: b.detail, x, y, w, h: LINE_H };
      if (!free(box, own) || onDot(box, null)) continue;
      plate(ctx, box);
      words(ctx, b.detail, x + PAD, y + LINE_H / 2 + 0.5, DIM, 400);
      boxes.push(box);
      break;
    }
  }

  // ── 3D: the name of each great circle, on its near half ──
  if (!flat) for (const c of sc.circles) {
    if (typeof c.label !== "string" || c.label === "") continue;
    const w = measure(c.label) + 2 * PAD, look = lookOf(c.key);
    const front = c.points.filter((p) => finite(p.x, p.y, p.z) && p.z > 0.15).sort((a, b) => b.z - a.z);
    for (let k = 0; k < front.length; k += 4) {
      const p = front[k], box = { key: c.key, kind: "circle", text: c.label, x: p.x - w / 2, y: p.y - LINE_H / 2, w, h: LINE_H };
      if (!free(box, null) || onDot(box, null)) continue;
      plate(ctx, box);
      words(ctx, c.label, box.x + PAD, p.y + 0.5, look.colour, 500);
      boxes.push(box);
      break;
    }
  }

  // ── the rim points A to D of the read-out ──
  for (const m of sc.marks) {
    if (!finite(m.x, m.y)) continue;
    const dx = m.x - sc.cx, dy = m.y - sc.cy, d = Math.hypot(dx, dy), ux = d > 1 ? dx / d : 0, uy = d > 1 ? dy / d : -1;
    ctx.globalAlpha = flat || !(m.z < 0) ? 1 : 0.45;
    ctx.fillStyle = INK;
    ctx.fillRect(m.x - 3, m.y - 3, 6, 6);
    ctx.lineWidth = 1;
    ctx.strokeStyle = DARK;
    ctx.strokeRect(m.x - 3, m.y - 3, 6, 6);
    const w = measure(m.label, 700) + 4;
    for (const out of [10, -12]) {
      const box = { key: m.label, kind: "mark", text: m.label, x: m.x + out * ux - w / 2, y: m.y + out * uy - 8, w, h: 16 };
      if (!free(box, null)) continue;
      words(ctx, m.label, m.x + out * ux, m.y + out * uy + 0.5, INK, 700, "center");
      boxes.push(box);
      break;
    }
    ctx.globalAlpha = 1;
  }

  // ── how many dots sit together ──
  for (const c of sc.clusters) {
    if (!finite(c.x, c.y)) continue;
    const text = String(c.count), w = measure(text, 700) + 2 * PAD;
    for (const dy of [-15 - LINE_H, 15]) {
      const box = { key: c.keys.join(","), kind: "cluster", text, x: c.x - w / 2, y: c.y + dy, w, h: LINE_H };
      if (!free(box, null) || onDot(box, null)) continue;
      plate(ctx, box);
      words(ctx, text, c.x, box.y + LINE_H / 2 + 0.5, INK, 700, "center");
      boxes.push(box);
      break;
    }
  }

  // ── the dot at the centre that is a direction: its caption, when it is the selected thing ──
  const centre = sc.bodies.find((b) => b.centreDot && b.selected);
  if (sc.centreCaption && centre && finite(centre.x, centre.y)) {
    const w = measure(sc.centreCaption, 400) + 2 * PAD;
    for (const dy of [14, -14 - LINE_H, 14 + LINE_H, -14 - 2 * LINE_H]) {
      const box = { key: centre.key, kind: "caption", text: sc.centreCaption, x: clamp(centre.x - w / 2, 2, Math.max(2, W - w - 2)), y: centre.y + dy, w, h: LINE_H };
      if (!free(box, null) || onDot(box, centre)) continue;
      plate(ctx, box);
      words(ctx, sc.centreCaption, box.x + PAD, box.y + LINE_H / 2 + 0.5, DIM, 400);
      boxes.push(box);
      break;
    }
  }

  // ── 2D: the frame's own circle is the rim; its name is written along it, outside the disc ──
  if (flat && sc.rimLabel) {
    const r = sc.outline.r + 9, span = measure(sc.rimLabel, 500) / r;
    const clearAt = (mid) => {
      for (let a = mid - span / 2 - 0.03; a <= mid + span / 2 + 0.03; a += 8 / r) {
        const x = sc.cx + r * Math.sin(a), y = sc.cy - r * Math.cos(a), box = { x: x - 8, y: y - 8, w: 16, h: 16 };
        if (boxes.some((b) => overlaps(b, box)) || sc.bodies.some((b) => Math.hypot(b.x - x, b.y - y) < 18) || sc.ticks.some((t) => Math.hypot(t.x - x, t.y - y) < 13)) return false;
      }
      return true;
    };
    if (span < 1.5) for (const deg of [225, 135, 315, 45, 200, 160, 250, 110, 290, 70, 340, 20]) {
      const mid = (deg * Math.PI) / 180;
      if (!clearAt(mid)) continue;
      arcText(ctx, sc.rimLabel, sc.cx, sc.cy, r, mid, lookOf(OWN_CIRCLE.get(sc.frame)).colour);
      const xs = [], ys = [];
      for (const a of [mid - span / 2, mid, mid + span / 2]) { xs.push(sc.cx + r * Math.sin(a)); ys.push(sc.cy - r * Math.cos(a)); }
      const x0 = Math.min(...xs) - 8, y0 = Math.min(...ys) - 8;
      boxes.push({ key: "rim", kind: "rim", text: sc.rimLabel, x: x0, y: y0, w: Math.max(...xs) + 8 - x0, h: Math.max(...ys) + 8 - y0 });
      break;
    }
  }
  return boxes;
}

// ─── the lab's stage ─────────────────────────────────────────────────────────

function arrow(ctx, x, y, tx, ty, colour, width, dash) {
  let dx = tx - x, dy = ty - y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0) || !finite(len)) return;
  dx /= len;
  dy /= len;
  const reach = Math.max(len, 12), ex = x + reach * dx, ey = y + reach * dy, head = Math.min(8, reach * 0.55);
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    if (!dash) {
      ctx.moveTo(ex - head * (dx * 0.82 - dy * 0.57), ey - head * (dy * 0.82 + dx * 0.57));
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex - head * (dx * 0.82 + dy * 0.57), ey - head * (dy * 0.82 - dx * 0.57));
    }
  };
  ctx.lineCap = "round";
  if (!dash) { shape(); stroke(ctx, DARK, width + 3); }
  shape();
  stroke(ctx, colour, width, dash);
  ctx.lineCap = "butt";
}

// Paints one labScene of the model and returns the text boxes it drew.
function paintLab(ctx, ls) {
  const boxes = [], { x, y, r } = ls.outline;
  if (!finite(x, y, r) || !(r > 0)) return boxes;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "#162033");
  g.addColorStop(1, "#0a101c");
  disc(ctx, x, y, r);
  ctx.fillStyle = g;
  ctx.fill();
  if (ls.tiles.length > 0) {                                     // the floor: one path for all its squares
    ctx.save();
    disc(ctx, x, y, r);
    ctx.clip();
    ctx.beginPath();
    for (const poly of ls.tiles) {
      let pen = false;
      for (const p of poly) {
        if (!finite(p.x, p.y)) { pen = false; continue; }
        if (pen) ctx.lineTo(p.x, p.y);
        else { ctx.moveTo(p.x, p.y); pen = true; }
      }
      if (pen) ctx.closePath();
    }
    stroke(ctx, line(0.3), 1);
    ctx.restore();
  }
  disc(ctx, x, y, r);
  stroke(ctx, line(0.55), 1.5);

  // where the walker began, and the way it faced then
  const home = ls.home, unit = r * Math.tanh(0.15);
  arrow(ctx, home.x, home.y, home.x + unit, home.y, DIM, 1.5, [4, 4]);
  disc(ctx, home.x, home.y, 6.5);
  stroke(ctx, DARK, 4);
  disc(ctx, home.x, home.y, 6.5);
  stroke(ctx, DIM, 2);

  // the path: one line a slide, the slide home dashed
  ctx.lineCap = "round";
  for (const part of ls.path) {
    trace(ctx, part.points, false);
    stroke(ctx, DARK, 5);
    trace(ctx, part.points, false);
    if (part.home) stroke(ctx, RIM_INK, 2.5, [6, 5]);
    else stroke(ctx, ACCENT, 2.5);
  }
  ctx.lineCap = "butt";
  for (const part of ls.path) {
    const end = part.points[part.points.length - 1];
    if (!end || !finite(end.x, end.y)) continue;
    disc(ctx, end.x, end.y, 3);
    ctx.fillStyle = part.home ? RIM_INK : ACCENT;
    ctx.fill();
    stroke(ctx, DARK, 1);
  }

  // the word "home", where it covers neither the path nor the walker
  const wk = ls.walker;
  ctx.font = font(LABEL_PX, 500);
  const w = Math.ceil(ctx.measureText("home").width) + 2 * PAD;
  const busy = (box) => {
    const grown = { x: box.x - 3, y: box.y - 3, w: box.w + 6, h: box.h + 6 };
    if (finite(wk.x, wk.y) && (inside({ x: grown.x - 9, y: grown.y - 9, w: grown.w + 18, h: grown.h + 18 }, wk.x, wk.y) || inside(grown, wk.tipX, wk.tipY))) return true;
    return ls.path.some((part) => part.points.some((p) => inside(grown, p.x, p.y))) || inside(grown, home.x + unit, home.y);
  };
  for (const [dx, dy] of [[-w / 2, 11], [-w - 10, -LINE_H / 2], [-w / 2, -11 - LINE_H], [10 + unit, -LINE_H / 2]]) {
    const box = { key: "home", kind: "lab", text: "home", x: home.x + dx, y: home.y + dy, w, h: LINE_H };
    if (busy(box)) continue;
    plate(ctx, box);
    words(ctx, "home", box.x + PAD, box.y + LINE_H / 2 + 0.5, DIM, 500);
    boxes.push(box);
    break;
  }

  // the walker and the way it faces
  if (finite(wk.x, wk.y, wk.tipX, wk.tipY)) {
    arrow(ctx, wk.x, wk.y, wk.tipX, wk.tipY, INK, 3, null);
    disc(ctx, wk.x, wk.y, 7);
    ctx.fillStyle = INK;
    ctx.fill();
    stroke(ctx, DARK, 2);
    disc(ctx, wk.x, wk.y, 2.5);
    ctx.fillStyle = DARK;
    ctx.fill();
  }
  return boxes;
}

// ─── 1. createSkyChart ───────────────────────────────────────────────────────

export function createSkyChart(canvas, options = {}) {
  const on = { change: options.onChange, arrive: options.onArrive, slide: options.onSlide, scene: options.onScene };
  let state = isState(options.state) ? options.state : null;
  let shown = state ? viewOf(state) : null;        // the view on the canvas: the state's own, or a point of a flight
  let flight = null;                               // { stop, target }: target is the view it is flying to
  let walk = null;                                 // { ms, stop, paused }
  let labDone = state ? state.lab.slides.length : 0, labPart = 0;      // slides fully drawn, and the share of the next one
  let boxes = [], reported = "", dragged = false;

  const labOpen = () => !!state && !!state.lab.open;
  const sizeNow = () => ({ w: canvas.clientWidth || 0, h: canvas.clientHeight || 0 });
  const drawState = () => ({ ...state, c: shown.c, view3: shown.view3 });
  const measure = (text) => { surf.ctx.font = font(LABEL_PX, 600); return surf.ctx.measureText(text).width + GLYPH_ROOM; };
  const makeScene = (size) => skyScene(drawState(), size, { measure });
  function labNow(size) {
    const lab = state.lab, n = Math.min(labDone, lab.slides.length);
    const slides = lab.slides.slice(0, n);
    if (labPart > 0 && n < lab.slides.length) slides.push({ ...lab.slides[n], dist: lab.slides[n].dist * labPart });
    return labScene({ ...lab, slides }, size);
  }
  function report(sc, kind) {
    const mark = kind === "lab" ? "lab" : [sc.dims, sc.frame, sc.dark, sc.diving, sc.rimLabel, sc.centreCaption].join("|");
    if (mark === reported) return;
    reported = mark;
    call(on.scene, sc, kind);
  }
  function paint(ctx, w, h) {
    if (!state) {
      const r = Math.min(w, h) / 2 - 18;
      if (r > 0) { disc(ctx, w / 2, h / 2, r); ctx.fillStyle = NIGHT; ctx.fill(); stroke(ctx, line(0.3), 1.5); }
      boxes = [];
      return;
    }
    if (labOpen()) {
      const ls = labNow({ w, h });
      boxes = paintLab(ctx, ls);
      report(ls, "lab");
      return;
    }
    const sc = makeScene({ w, h });
    boxes = paintSky(ctx, sc, state.selected);
    report(sc, "sky");
  }
  const surf = surface(canvas, paint);

  // ── flights ──
  function stopFlight() {
    if (!flight) return;
    flight.stop();
    flight = null;
  }
  // Brings the canvas from the view it shows (as part of the state `from`) to the state that is now `state`.
  function go(from, jump) {
    const to = state, target = viewOf(to);
    const still = !from || jump || labOpen() || !!from.lab.open || from.dims !== to.dims || from.frame !== to.frame || !to.site;
    const plan = still ? null : flightPlan(from, to);
    if (!plan || !(plan.ms > 0)) {
      stopFlight();
      shown = target;
      surf.invalidate();
      return;
    }
    stopFlight();
    const mine = { stop: () => {}, target };
    flight = mine;
    const stop = animate(Math.min(plan.ms, FLIGHT_MS), (t) => {
      if (flight !== mine) return;
      const v = plan.at(t);
      shown = { c: [v.c[0], v.c[1]], view3: v.view3.slice() };
      surf.invalidate();
    }, () => {
      if (flight !== mine) return;
      flight = null;
      shown = viewOf(state);
      surf.invalidate();
      call(on.arrive, state);
    });
    if (flight === mine) mine.stop = stop;
  }

  // ── the walk of the lab ──
  function stopWalk() {
    if (!walk) return;
    walk.stop();
    walk = null;
  }
  function runSlide() {
    const mine = walk;
    if (!mine) return;
    if (labDone >= state.lab.slides.length) {
      walk = null;
      labPart = 0;
      surf.invalidate();
      call(on.arrive, state);
      return;
    }
    const f0 = labPart;
    const stop = animate(mine.ms * (1 - f0), (t) => {
      if (walk !== mine) return;
      labPart = f0 + (1 - f0) * ease(t);
      surf.invalidate();
    }, () => {
      if (walk !== mine) return;
      labDone += 1;
      labPart = 0;
      surf.invalidate();
      call(on.slide, { index: labDone, of: state.lab.slides.length });
      if (walk === mine) runSlide();
    });
    if (walk === mine) mine.stop = stop;
  }

  function set(next, opts = {}) {
    if (!isState(next)) return;
    const prev = state, from = prev && shown ? { ...prev, c: shown.c, view3: shown.view3 } : null;
    const wasLab = !!prev && !!prev.lab.open;
    state = next;
    if (next.lab.open) {
      // how many of the slides on the stage (the last of them perhaps half drawn) the new path begins with
      const slides = next.lab.slides, begun = wasLab ? labDone + (labPart > 0 ? 1 : 0) : 0;
      let agree = 0;
      while (agree < begun && agree < slides.length && sameSlide(prev.lab.slides[agree], slides[agree])) agree += 1;
      const goesOn = wasLab && !opts.jump && agree === begun;
      stopFlight();
      shown = viewOf(next);
      if (!goesOn && wasLab && !opts.jump && opts.walk) {      // another path, walked from where it leaves the old one
        stopWalk();
        labDone = Math.min(agree, labDone);
        labPart = 0;
      }
      if (!goesOn && !(wasLab && !opts.jump && opts.walk)) {
        stopWalk();
        labDone = slides.length;
        labPart = 0;
      } else if (slides.length > labDone && !walk) {
        const count = slides.length - labDone, ms = Number.isFinite(opts.walkMs) && opts.walkMs > 0 ? opts.walkMs : WALK_MS;
        walk = { ms: Math.min(ms, WALK_MS_MAX / count), stop: () => {}, paused: false };
        runSlide();
      }
      surf.invalidate();
      return;
    }
    stopWalk();
    labDone = next.lab.slides.length;
    labPart = 0;
    if (flight && !opts.jump && from && from.dims === next.dims && from.frame === next.frame && sameView(flight.target, viewOf(next))) { surf.invalidate(); return; }   // the same flight, new data
    go(from, !!opts.jump);
  }

  // ── the pointer ──
  // A tap made a new state: the chart takes it, tells the shell, and then flies there, unless the shell has
  // already sent it there (or somewhere else) from inside its callback.
  function take(next, base, info) {
    state = next;
    call(on.change, next, info);
    if (state !== next) return;
    const target = viewOf(next);
    if (flight ? sameView(flight.target, target) : sameView(shown, target)) { surf.invalidate(); return; }
    go(base, false);
  }
  function click(e) {
    if (!state || labOpen()) return;
    const base = drawState(), size = sizeNow();
    const tap = tapView(base, size, e.x, e.y);
    let key = tap.key, next = tap.state;
    if (!key) {
      const box = boxes.find((b) => (b.kind === "object" || b.kind === "home" || b.kind === "detail") && inside(b, e.x, e.y));
      const sc = !box && state.site ? makeScene(size) : null;
      if (box && box.kind !== "home") { key = box.key; next = retarget({ ...select(base, key), centred: { key, half: false } }); }
      else if (box || (sc && !sc.dark && Math.hypot(sc.home.x - e.x, sc.home.y - e.y) <= HIT_REACH)) { key = "home"; next = goHome(base); }
    }
    if (next === base) return;
    const same = sameView(base, next) && next.selected === base.selected && (next.centred ? next.centred.key : null) === (base.centred ? base.centred.key : null)
      && (next.centred ? next.centred.half : null) === (base.centred ? base.centred.half : null);
    if (same && !flight) return;
    take(next, base, { cause: "tap", key, x: e.x, y: e.y, pointerType: e.pointerType, end: true });
  }
  function drag(e) {
    if (!state || labOpen() || !state.site || !(state.lit && state.lit.place)) return;
    let frozen = false;
    if (e.first && flight && state.dims !== "3D") {          // a drag of the flat map ends a flight where it is
      stopFlight();
      state = drawState();
      frozen = true;
    }
    let next = dragView(state, sizeNow(), { x: e.x - e.dx, y: e.y - e.dy }, { x: e.x, y: e.y });
    if (next === state) {
      if (!frozen) return;
      next = { ...state, centred: null };          // the view stays where the flight was stopped, and is free
    }
    state = next;
    if (!flight) shown = viewOf(next);
    dragged = true;
    surf.invalidate();
    call(on.change, next, { cause: "drag", key: null, x: e.x, y: e.y, pointerType: e.pointerType, end: false });
  }
  function dragEnd(e) {
    if (!dragged) return;
    dragged = false;
    call(on.change, state, { cause: "drag", key: null, x: e.x, y: e.y, pointerType: e.pointerType, end: true });
  }
  const pointer = attachPointer(canvas, { onClick: click, onDrag: drag, onDragEnd: dragEnd, dragSwitch: options.dragSwitch, dragCaption: options.dragCaption, place: options.place });

  return {
    set,
    finish() {
      if (flight) {
        stopFlight();
        shown = viewOf(state);
        surf.invalidate();
        call(on.arrive, state);
      }
      if (walk) {
        stopWalk();
        labDone = state.lab.slides.length;
        labPart = 0;
        surf.invalidate();
        call(on.arrive, state);
      }
    },
    pause() {
      if (!walk || walk.paused) return;
      walk.stop();
      walk.stop = () => {};
      walk.paused = true;
    },
    resume() {
      if (!walk || !walk.paused) return;
      walk.paused = false;
      runSlide();
    },
    redraw: surf.invalidate,
    destroy() {
      stopFlight();
      stopWalk();
      pointer.detach();
      surf.destroy();
    },
    get state() { return state; },
    get view() { return state && shown ? { c: shown.c.slice(), view3: shown.view3.slice(), orbit: state.orbit.slice() } : null; },
    get flying() { return !!flight; },
    get walking() { return !!walk; },
    get paused() { return !!walk && walk.paused; },
    get size() { return sizeNow(); },
    get scene() { return state && !labOpen() ? makeScene(sizeNow()) : null; },
    labels: () => boxes.map((b) => ({ key: b.key, kind: b.kind, text: b.text, x: b.x, y: b.y, w: b.w, h: b.h })),
    pointer,
  };
}

// ─── 2. createMoonPicture ────────────────────────────────────────────────────

function paintMoon(ctx, w, h, figure, mark) {
  const side = Math.min(w, h), marked = mark && side >= 120;
  const r = side / 2 - (marked ? 20 : Math.max(1.5, side * 0.06)), cx = w / 2, cy = h / 2 + (marked ? 8 : 0);
  if (!(r > 0)) return;
  if (marked) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r - 4);
    ctx.lineTo(cx, cy - r - 10);
    stroke(ctx, DIM, 1.5);
    words(ctx, "up", cx, cy - r - 18, DIM, 500, "center");
  }
  const t = figure ? (Number.isFinite(figure.terminator) ? figure.terminator : Number.isFinite(figure.fraction) ? 2 * figure.fraction - 1 : NaN) : NaN;
  const limb = figure && Number.isFinite(figure.limbDeg) ? figure.limbDeg : 90;
  ctx.globalAlpha = figure && figure.below ? 0.35 : 1;
  disc(ctx, cx, cy, r);
  ctx.fillStyle = figure ? MOON_DARK : NIGHT;
  ctx.fill();
  if (Number.isFinite(t) && t > -0.999) {
    const k = clamp(t, -1, 1);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((limb - 90) * Math.PI) / 180);                 // the bright limb is now towards +x
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);        // the bright limb, from the top round to the bottom
    if (k >= 0) ctx.ellipse(0, 0, Math.max(0.001, k * r), r, 0, Math.PI / 2, 3 * Math.PI / 2, false);      // gibbous: back along the far side
    else ctx.ellipse(0, 0, Math.max(0.001, -k * r), r, 0, Math.PI / 2, -Math.PI / 2, true);                // crescent: back along the near side
    ctx.closePath();
    ctx.fillStyle = MOON_LIT;
    ctx.fill();
    ctx.restore();
  }
  disc(ctx, cx, cy, r);
  stroke(ctx, line(figure ? 0.7 : 0.35), side < 60 ? 1 : 1.5);
  ctx.globalAlpha = 1;
}

export function createMoonPicture(canvas, options = {}) {
  let figure = options.figure || null;
  const mark = options.mark !== false;
  const surf = surface(canvas, (ctx, w, h) => paintMoon(ctx, w, h, figure, mark));
  return {
    set(next) {
      figure = next || null;
      surf.invalidate();
    },
    redraw: surf.invalidate,
    destroy: surf.destroy,
    get figure() { return figure; },
  };
}

// ─── 3. createShellsFigure ───────────────────────────────────────────────────

const SHELL_TINTS = ["rgba(56, 189, 248, 0.20)", "rgba(168, 85, 247, 0.22)"];
function paintShells(ctx, w, h, data) {
  const R = Math.min(w, h) / 2 - 4, cx = w / 2, cy = h / 2;
  if (!(R > 0)) return;
  const share = (v) => (Number.isFinite(v) ? clamp(v, 0, 1) : NaN);
  disc(ctx, cx, cy, R);
  ctx.fillStyle = GROUND;
  ctx.fill();
  const shells = Array.isArray(data.shells) ? data.shells : [], numbers = [];
  shells.forEach((sh, i) => {
    const from = share(sh && sh.from), to = share(sh && sh.to);
    if (!finite(from, to)) return;
    if (to - from > 1e-9) {                                       // a band between two radii
      ctx.beginPath();
      ctx.arc(cx, cy, to * R, 0, TAU, false);
      ctx.arc(cx, cy, from * R, 0, TAU, true);
      ctx.fillStyle = SHELL_TINTS[i % SHELL_TINTS.length];
      ctx.fill("evenodd");
    } else {                                                      // a point
      disc(ctx, cx + from * R, cy, 4);
      ctx.fillStyle = ACCENT;
      ctx.fill();
    }
    numbers.push({ text: String(i + 1), at: ((from + to) / 2) * R, point: !(to - from > 1e-9) });
  });
  for (const v of Array.isArray(data.rings) ? data.rings : []) {
    const r = share(v) * R;
    if (!(r > 0)) continue;
    disc(ctx, cx, cy, r);
    stroke(ctx, line(0.4), 1);
  }
  disc(ctx, cx, cy, R);
  stroke(ctx, line(0.7), 1.5);
  // the numbers, along a line up and to the right, each on its band
  const ux = Math.cos(Math.PI / 5), uy = -Math.sin(Math.PI / 5);
  for (const n of numbers) {
    ctx.font = font(LABEL_PX, 700);
    const tw = Math.ceil(ctx.measureText(n.text).width) + 2 * PAD, x = n.point ? cx - tw - 8 : cx + n.at * ux - tw / 2, y = n.point ? cy - LINE_H / 2 : cy + n.at * uy - LINE_H / 2;
    plate(ctx, { x, y, w: tw, h: LINE_H });
    words(ctx, n.text, x + tw / 2, y + LINE_H / 2 + 0.5, INK, 700, "center");
  }
}

export function createShellsFigure(canvas, options = {}) {
  let data = { shells: options.shells || [], rings: options.rings || [] };
  const surf = surface(canvas, (ctx, w, h) => paintShells(ctx, w, h, data));
  return {
    set(next) {
      data = { shells: (next && next.shells) || [], rings: (next && next.rings) || [] };
      surf.invalidate();
    },
    redraw: surf.invalidate,
    destroy: surf.destroy,
  };
}
