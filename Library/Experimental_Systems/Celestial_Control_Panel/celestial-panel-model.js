// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Celestial Control Panel: the model. Everything the page needs that is not drawing and not DOM: the copy tables,
// the lists, the link grammar and every pure function of the page's state. No document, no window, nothing
// stored. celestial-chart.js draws from it; celestial-control-panel.js (the shell) builds the page from it.
// Tested by tests/unit/celestial-panel-model.test.mjs. Each export has a one-line description above it.
//
// MAP OF THE MODULE (section: what it exports)
//   1  helpers      lensOf, forLens, sentencesOf, numberWord, latitudeWords, longitudeWords, placeWords,
//                   distanceWords, weekdayOf
//   2  lists        PAGE, PAGE_YEAR, STRIX, LENS_HINTS, STEP_KEYS, OVERLAYS, FRAME_CHOICES, DIMS, QUICK, TIME_BUTTONS,
//                   DAY_BUTTONS, CONTROLS, MOON_NAMES, moonWords, siteOf, siteChoices
//   3  links        HASH_GRAMMAR, LEXICON_PAGE_GRAMMAR, IGNORED_NOTE, parseHash, formatHash, skyLinkHref,
//                   lexiconSkyHref, entryHref, firstExplorersHref
//   4  state        DEFAULT_ORBIT, EZEKIEL_PRESET, initialState, applyHash, skyOf, chooseSite, typePlace, readClock,
//                   confirmDay, askDayAgain, answerDay, setJd, stepDay, pickDate, pickEraDate, timeButton, setDayOfYear, setClock,
//                   findMoon,
//                   ezekielChoices, ezekielSky, setLens, setDims, setFrame, setStep, toggleOverlay, select,
//                   dateView, dayQuestion, seasonLine, statusSentence, nextStep
//   5  objects      OBJECTS, objectOf, objectVisible, objectDirection, objectRho, objectPoint, objectList,
//                   inspector, telemetry, placeReadout, dayReadout
//   6  view         VIEW, geometryOf, viewMatrix, screenPoint, viewDistance, targetOf, dive, goHome, retarget,
//                   flightPlan, dragView, nudgeView, orbitDrag, orbitTurn, hud, threePoints, aberrationReadout
//   7  scene        LABEL, placeLabels, sceneCaption, centreWords, chartCaption, scene, sceneHit, tapView
//   8  Moon         MOON_COPY, moonFigure, moonButtons
//   9  lab          LAB, LAB_COPY, labStart, openLab, closeLab, labSlide, labNext, labFour, labTile, labFrames, labHome,
//                   labSetA, labReset, labToggleTiling, labArea, labNoArea, labReadout, fiveSlides, labPose, labScene
//   10 seal         packageFileName, sealSky, CERTIFIED, CERTIFIED_STARGAZER, SEAL_COPY, epochLine, sealView
//   11 copy         COPY_FACTS, verseSlice, BRIDGE_TITLE, BRIDGE_PARTS, BRIDGE_OPENING, FIRST_RUN, STEPS, stepView,
//                   visibleSteps, EZEKIEL_COPY, MESSAGES
//   12 dialogs      DIALOG, BLUEPRINT
//   13 all ages     stargazerStrings
//
// CONVENTIONS
//   State     plain data made by initialState(): { lens, dims ("2D" | "3D"), frame ("hor" | "gal"), step (1..5),
//             site: null | { key | null, label, lat, lonEast, note }, jdUt, selected, rimOf, centred: null |
//             { key, half }, c ([x, y]: the disc point brought to the centre in 2D), view3 (3D: a Lorentz matrix),
//             orbit (3D rotation), flight, lit: { place, day, sky }, overlays: { rings, horizon, equator,
//             ecliptic, galactic, sightLines }, lab: { open, a, slides, home, tiling }, seal, busy, notes }.
//             The functions here return new states; nothing is stored anywhere.
//   Layers    every sentence is { layer, text }, layer one of text, said, checked, reading. A TEXT sentence is cut
//             out of a verse row of ../Lexicon_Explorer/ezekiel-1.js by verseSlice(); it is never typed here.
//   Angles    celestial-core.js works in degrees and hyperbolic-moves.js in radians. Here a name ending in Deg is
//             in degrees; every other angle is in radians.
//   Chart     chart points are hyperboloid points [x, y, z, t] in the chosen frame ("hor": x east, y north, z up;
//             "gal": x to the galactic centre, z to the north galactic pole). The 2D chart keeps the direction
//             round the frame's plane and the depth; height above the plane is not shown.
//   Screen    scene() gives CSS pixels from the canvas's top left corner, x right and y down.
//   Lit       the sky lights up as the questions are answered: lit.place (a place is chosen: the compass points
//             and the straight-up dot), lit.day (the day is confirmed or changed: the Sun and the Moon), lit.sky
//             ("Look around": the stars, the rings and the rim). objectVisible() is the one rule for what is shown.
//             The steps may be visited in any order: at step 3 and later the whole sky is lit as soon as there is
//             a place, whichever came first, the step or the place (setStep and the functions that set a place).
//   Presses   dive(state, key) is a press on a quick button or a list entry: the first centres the midpoint between
//             home and the object, the second the object. tapView() is a tap on the canvas: the object comes to
//             the centre at once. A state says where the view ends; flightPlan(from, to) gives the way there.
//   Lab       the lab has its own stage: while state.lab.open the shell shows labScene(state.lab, size), not
//             scene(). The lab needs no place and no sky.
//   Strings   nothing here turns a value of a link or of a package into a URL, an id, a class or an object key.

import {
  IDENT, lmul, linv, lapply, originOf, toBall, hypDist, rotX, rotY, rotZ, boostAlong, boostX,
  makeEntry, buildLexiconBundle, issueCertificate, makeHyperpack, newSessionKeys,
} from "../../../scripts/strix-overwatch.js";
import {
  fromBall, centreOn, skyImage, aberrate, dragCentre, mobiusFromThree, slidePath, homecoming, squareWalkGap,
  squareWalkTurn, rightAngledPolygonSide, tilingConstants, generateTiling, conformalFactor,
} from "../../../scripts/hyperbolic-moves.js";
import {
  SITES, ANCHORS, CMB, RINGS, BODIES, EZEKIEL_DATES, EZEKIEL_DATES_NOTE, PHASE_TARGETS, LIMITS, DEPTH,
  DEPTH_WORDING, CHART_WORDING, MONTH_NAMES, YEAR_MIN, YEAR_MAX, LIGHT_SECONDS_PER_LY, LIGHT_SECONDS_PER_AU,
  skyState, skyInputsValid, roundSkyInputs, formatSkyInputs, skyLexiconRows, siteForCoordinates, bearingAndDistance,
  bodyDirection, bodyLightSeconds, depthRho, chartPoint, circleDirections, circleNodes, frameMatrix,
  rotate, anglesFromDir, horFromDir, jdFromUnixMs, jdFromLocalMean, partsFromJd, partsFromDayOfYear,
  dayOfYear, daysInYear, daysInMonth, formatDate, formatClock, eraYear, sunEventOnLocalDay, nearestSeasonJd,
  phaseEveningJd, nextPhaseTime, limbClockHour, compassPoint, norm360, moonPosition, jdeFromJdUt, jdFromParts,
} from "../../../scripts/celestial-core.js";
import {
  LINKS, LENSES, LAYER_META, BADGE_HELP, HASH_PATTERNS, hashNumber, hashOneOf, hashTuple, parseHashWith,
  formatHashWith, cutLabel,
} from "../explorer-kit.js";
import { ROWS } from "../Lexicon_Explorer/ezekiel-1.js";

// ─── 1. helpers ──────────────────────────────────────────────────────────────

const freeze = Object.freeze;
const T = (layer, text) => freeze({ layer, text });
const RAD = Math.PI / 180;
const ORIGIN = freeze([0, 0, 0, 1]);
const LENS_IDS = freeze(LENSES.map((l) => l.id));
const fixed = (x, n) => { const s = x.toFixed(n); return Number(s) === 0 ? (0).toFixed(n) : s; };   // never "-0.0"
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const perLens = (stargazer, navigator, holographer) => freeze({ stargazer, navigator, holographer: holographer === undefined ? navigator : holographer });
const list = (...items) => freeze(items);
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** lensOf(lens) -> a lens id; anything unknown is "stargazer". */
export const lensOf = (lens) => (LENS_IDS.includes(lens) ? lens : "stargazer");
/** forLens(perLens, lens) -> the member of a { stargazer, navigator, holographer } record for a lens. */
export const forLens = (record, lens) => record[lensOf(lens)];
/** sentencesOf(text) -> the sentences of a text (a split after . ! ? and an optional closing quote or bracket). */
export function sentencesOf(text) {
  return String(text).split(/(?<=[.!?]["”)]?)\s+(?=[A-Z0-9("“'‘])/u).filter((s) => s !== "");
}
const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
/** numberWord(n) -> "four" for 0..12, otherwise the digits. */
export const numberWord = (n) => (Number.isInteger(n) && n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n));
/** latitudeWords(lat, digits = 0) -> "32 degrees north" ("on the equator" for a rounded 0): the slider's value in words. */
export function latitudeWords(lat, digits = 0) {
  const v = fixed(Math.abs(lat), digits);
  return Number(v) === 0 ? "on the equator" : v + " degrees " + (lat < 0 ? "south" : "north");
}
/** longitudeWords(lon, digits = 0) -> "45 degrees east" ("on the line of Greenwich" for a rounded 0). */
export function longitudeWords(lon, digits = 0) {
  const v = fixed(Math.abs(lon), digits);
  return Number(v) === 0 ? "on the line of Greenwich" : v + " degrees " + (lon < 0 ? "west" : "east");
}
/** placeWords(site) -> "32.13° north, 45.23° east": the two numbers of a place as text. */
export const placeWords = (site) => fixed(Math.abs(site.lat), 2) + "° " + (site.lat < 0 ? "south" : "north") + ", " + fixed(Math.abs(site.lonEast), 2) + "° " + (site.lonEast < 0 ? "west" : "east");
const grouped = (n) => { const s = String(Math.round(n)); let out = ""; for (let i = 0; i < s.length; i++) out += (i > 0 && (s.length - i) % 3 === 0 ? "," : "") + s[i]; return out; };
const sig3 = (x) => { let p = 1; while (x / p >= 1000) p *= 10; return Math.round(x / p) * p; };
/** distanceWords(lightSeconds) -> "1.35 light-seconds", "8.2 light-minutes", "444 light-years", "2.48 million light-years". */
export function distanceWords(lightSeconds) {
  if (!isNum(lightSeconds) || lightSeconds <= 0) return "";
  if (lightSeconds < 60) return fixed(lightSeconds, 2) + " light-seconds";
  if (lightSeconds < 3600) return fixed(lightSeconds / 60, 1) + " light-minutes";
  const ly = lightSeconds / LIGHT_SECONDS_PER_LY;
  if (ly < 0.1) return fixed(lightSeconds / 3600, 1) + " light-hours";
  if (ly >= 1e9) return fixed(ly / 1e9, 1) + " billion light-years";
  if (ly >= 1e6) return fixed(ly / 1e6, 2) + " million light-years";
  return grouped(sig3(ly)) + " light-years";
}
const WEEKDAYS = freeze(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
/** weekdayOf(jd) -> "Saturday": the day of the week of the civil day that holds a Julian Day (give it a local one). */
export const weekdayOf = (jd) => WEEKDAYS[((Math.floor(jd + 1.5) % 7) + 7) % 7];

// ─── 2. lists ────────────────────────────────────────────────────────────────

/** PAGE: the title and subtitle of the page. */
export const PAGE = freeze({ title: "Celestial Control Panel", subtitle: "Celestial Holography: a Poincaré ball explorer" });
/** PAGE_YEAR: the year this page was written (for "about 2,600 years apart"). */
export const PAGE_YEAR = 2026;
/** STRIX: the narrator of this page: its name (the label beside the first line it says), who it is (one sentence of the dialog's "In short") and the name of the box that holds all it says at a step. */
export const STRIX = freeze({ name: "STRIX", who: "STRIX is the owl that speaks on this page.", all: "All that STRIX says here", more: "more", moreFrom: "more from STRIX" });
/** LENS_HINTS: the hint under each lens button on this page. */
export const LENS_HINTS = freeze({ stargazer: "ages 6 and up", navigator: "astronomy", holographer: "physics" });
/** STEP_KEYS: the five steps, in order; a step's number is its place here plus one. */
export const STEP_KEYS = freeze(["earth", "sun-moon", "project", "dive", "seal"]);
/** OVERLAYS: the switches of the chart: { key, label, stargazer (label), circle (the frame whose great circle it draws) | null, words (2D crossing label) }. */
export const OVERLAYS = freeze([
  freeze({ key: "rings", label: "Depth rings", stargazer: "Distance rings", circle: null, words: null }),
  freeze({ key: "horizon", label: "Horizon", stargazer: "Where sky meets ground", circle: "hor", words: "your horizon crosses this map here" }),
  freeze({ key: "equator", label: "Celestial equator", stargazer: "The sky's middle line", circle: "equ", words: "the celestial equator crosses this map here" }),
  freeze({ key: "ecliptic", label: "Ecliptic", stargazer: "The Sun's path", circle: "ecl", words: "the Sun's path crosses this map here" }),
  freeze({ key: "galactic", label: "Galactic plane", stargazer: "The Milky Way's line", circle: "gal", words: "the plane of the Milky Way crosses this map here" }),
  freeze({ key: "sightLines", label: "Sight lines", stargazer: "Lines from you", circle: null, words: null }),
]);
/** FRAME_CHOICES: the frame selector (from Navigator up): { key, label, own (the name of the frame's own circle, which is the rim in 2D), caption (the 2D caption), stargazer (the 2D caption at the Stargazer lens) }. */
export const FRAME_CHOICES = freeze([
  freeze({ key: "hor", label: "Horizon", own: "your horizon", caption: "a flat map of direction round the plane and of depth; height above the plane is not shown; seen from above: north up, east right",
    stargazer: "This is a flat map, seen from above. North is up and east is right. How high a thing stands is not shown." }),
  freeze({ key: "gal", label: "Galactic", own: "the galactic plane", caption: "a flat map of direction round the plane and of depth; height above the plane is not shown; seen from the north galactic pole: the galactic centre right",
    stargazer: "This is a flat map of our galaxy's disc, seen from above. Its middle is to the right." }),
]);
/** DIMS: the two ways the chart is drawn. */
export const DIMS = freeze(["2D", "3D"]);
/** QUICK: the quick buttons of the Dive step: { key (an object key, "home" or "rim"), label, stargazer }. */
export const QUICK = freeze([
  freeze({ key: "home", label: "Home", stargazer: "Home" }),
  freeze({ key: "moon", label: "Moon", stargazer: "Moon" }),
  freeze({ key: "sun", label: "Sun", stargazer: "Sun" }),
  freeze({ key: "sgr_a_star", label: "Sagittarius A*", stargazer: "Middle of our galaxy" }),
  freeze({ key: "rim", label: "The rim", stargazer: "The edge" }),
]);
/** TIME_BUTTONS: the five time buttons of the Sun and Moon step. */
export const TIME_BUTTONS = freeze([
  freeze({ key: "now", label: "Now" }), freeze({ key: "sunrise", label: "Sunrise" }), freeze({ key: "noon", label: "Noon" }),
  freeze({ key: "sunset", label: "Sunset" }), freeze({ key: "midnight", label: "Midnight" }),
]);
/** DAY_BUTTONS: the day controls at the Stargazer lens (Today is the device clock, as "Now" is). */
export const DAY_BUTTONS = freeze([
  freeze({ key: "today", label: "Today" }), freeze({ key: "before", label: "Day before" }), freeze({ key: "after", label: "Day after" }), freeze({ key: "pick", label: "Pick another day" }),
]);
/** CONTROLS: the labels of the controls that have no table of their own, each per lens: dims, frame, place, day, nudge and turn buttons, the object list, the inspector, the telemetry. */
export const CONTROLS = freeze({
  dims: freeze({ "2D": perLens("Flat map", "2D"), "3D": perLens("Ball", "3D") }),
  dimsLabel: perLens("Flat map or ball", "Chart in 2D or 3D"),
  frame: perLens("", "Frame"),
  place: perLens("My place", "Place"),
  presets: perLens("Pick a place", "Presets"),
  latitude: perLens("How far north or south", "Latitude"), longitude: perLens("How far east or west", "Longitude"),
  day: perLens("My day", "Local date"),
  year: perLens("Year", "Year (BC or AD)"),
  dayOfYear: perLens("", "Day of the year"),
  clock: perLens("", "Sun time at this place (local mean time)"),
  nudge: freeze({ up: "Move the map up", down: "Move the map down", left: "Move the map left", right: "Move the map right" }),
  turn: freeze({ up: "Turn the ball up", down: "Turn the ball down", left: "Turn the ball left", right: "Turn the ball right" }),
  list: perLens("Everything on the map", "Objects on the chart"),
  inspector: perLens("About this", "Inspector"),
  telemetry: perLens("", "Telemetry"),
  overlays: perLens("Lines to draw", "Great circles and rings"),
  nothingSelected: perLens("Tap anything on the map to read about it.", "Select an object to inspect it."),
  blueprint: "Blueprint",
  real: "What is real here?",
});
/** MOON_NAMES: the Stargazer name of each of the eight phase names of the core ("growing" or "shrinking" is said beside it). */
export const MOON_NAMES = freeze({
  "New Moon": "new Moon",
  "Waxing Crescent": "thin Moon",
  "First Quarter": "half Moon (astronomers say First Quarter: a quarter of the way round its month)",
  "Waxing Gibbous": "nearly full Moon",
  "Full Moon": "full Moon",
  "Waning Gibbous": "nearly full Moon",
  "Last Quarter": "half Moon (astronomers say Last Quarter: three quarters of the way round its month)",
  "Waning Crescent": "thin Moon",
});
const MOON_TURNS = freeze(["New Moon", "Full Moon"]);
/** moonWords(name, lens, long) -> a phase name for a lens: the core's name from Navigator up; at Stargazer "thin Moon, growing" (long: with the astronomers' name where there is one). */
export function moonWords(name, lens, long) {
  if (lensOf(lens) !== "stargazer" || !MOON_NAMES[name]) return name;
  const base = long ? MOON_NAMES[name] : MOON_NAMES[name].replace(/ \(astronomers.*\)$/, "");
  return MOON_TURNS.includes(name) ? base : base + (name.startsWith("Wax") || name === "First Quarter" ? ", growing" : ", shrinking");
}
const SITE_BY_KEY = new Map(SITES.map((s) => [s.key, s]));
/** siteOf(key) -> the preset of that key, or null. */
export const siteOf = (key) => SITE_BY_KEY.get(key) || null;
/** siteChoices() -> the presets of "Pick a place", each with its country in the label; the Kebar is not among them (preset or link only). */
export const siteChoices = () => SITES.filter((s) => s.key !== "kebar");

// ─── 3. links: the one grammar (#key=value&key=value) ────────────────────────
// This page reads preset, site, jd, lat, lon, focus, lab and lens. It writes links to itself ("Copy a link to this
// sky": jd, lat, lon, lens) and to the Lexicon Explorer (sky=JD,LAT,LON or entry=ADDRESS, always with the lens).
// The year range is a range of local dates, so the Julian Day that is still inside it depends on the longitude: by
// half a day either way. The rule for the key jd therefore lets through every Julian Day that is a sky at some
// longitude (it is one at the far west or the far east when it is one anywhere), and applyHash() judges it at the
// place the link names, or at Greenwich when it names none.

const OBJECT_KEYS = [];                          // filled in section 5; the focus rule reads it when a link is parsed
const jdRule = (text) => { const n = hashNumber(HASH_PATTERNS.jd, 0, 9999999)(text); return n !== undefined && (skyInputsValid(n, 0, -180) || skyInputsValid(n, 0, 180)) ? n : undefined; };
/** HASH_GRAMMAR: the keys this page reads, in the order it writes them. */
export const HASH_GRAMMAR = freeze([
  freeze(["preset", freeze(["ezekiel"])]),
  freeze(["site", hashOneOf(SITES.map((s) => s.key))]),
  freeze(["jd", jdRule]),
  freeze(["lat", hashNumber(HASH_PATTERNS.lat, -90, 90)]),
  freeze(["lon", hashNumber(HASH_PATTERNS.lon, -180, 180)]),
  freeze(["focus", (text) => (OBJECT_KEYS.includes(text) ? text : undefined)]),
  freeze(["lab", freeze(["square"])]),
  freeze(["lens", hashOneOf(LENS_IDS)]),
]);
const SKY_TUPLE = hashTuple(hashNumber(HASH_PATTERNS.jd, 0, 9999999), hashNumber(HASH_PATTERNS.lat, -90, 90), hashNumber(HASH_PATTERNS.lon, -180, 180));
/** LEXICON_PAGE_GRAMMAR: the keys of the links this page writes to the Lexicon Explorer. */
export const LEXICON_PAGE_GRAMMAR = freeze([
  freeze(["sky", (text) => { const t = SKY_TUPLE(text); return t && skyInputsValid(t[0], t[1], t[2]) ? t : undefined; }]),
  freeze(["entry", HASH_PATTERNS.address]),
  freeze(["lens", hashOneOf(LENS_IDS)]),
]);
/** IGNORED_NOTE: the line shown when a link carried something this page did not use. */
export const IGNORED_NOTE = "a link value was ignored";

/** parseHash(hash) -> { values: { preset, site, jd, lat, lon, focus, lab, lens } (only valid keys), ignored (count), note ("" or IGNORED_NOTE) }; never throws. */
export function parseHash(hash) {
  const { values, ignored } = parseHashWith(HASH_GRAMMAR, hash);
  return { values, ignored, note: ignored > 0 ? IGNORED_NOTE : "" };
}
/** formatHash({ preset, site, jd, lat, lon, focus, lab, lens }) -> "#jd=…&lat=…&lon=…&lens=…" or ""; numbers are rounded as a sealed sky is (jd 5 decimals, lat and lon 2); throws on a value parseHash would refuse. */
export function formatHash(obj) {
  const o = { ...(obj || {}) };
  if (isNum(o.jd)) o.jd = o.jd.toFixed(5);
  if (isNum(o.lat)) o.lat = fixed(o.lat, 2);
  if (isNum(o.lon)) o.lon = fixed(o.lon, 2);
  return formatHashWith(HASH_GRAMMAR, o);
}
// The three numbers a link carries for the state's sky, rounded as a sealed sky is (jd to 5 decimals, latitude and longitude to 2),
// or null when the state has no sky. Within a second or two of either end of the year range the rounding can carry a sky across
// the end; a link then carries the nearest instant of 5 decimals that is still a sky at the rounded place.
function linkNumbers(state) {
  if (!state || !state.site || !isNum(state.jdUt) || !skyInputsValid(state.jdUt, state.site.lat, state.site.lonEast)) return null;
  const q = roundSkyInputs(state.jdUt, state.site.lat, state.site.lonEast);
  if (skyInputsValid(q.jdUt, q.lat, q.lonEast)) return q;
  for (let k = 1; k <= 4; k++) for (const way of [-1, 1]) {
    const jdUt = Number((q.jdUt + way * k * 1e-5).toFixed(5));
    if (skyInputsValid(jdUt, q.lat, q.lonEast)) return { ...q, jdUt };
  }
  return null;
}
/** skyLinkHref(state) -> this page's own URL with the place, the time and the lens ("Copy a link to this sky"); "" before a place is chosen and for a state that has no sky. It never throws: at the very ends of the year range, where the rounded instant would fall outside it, the link carries the nearest instant of 5 decimals inside it. */
export function skyLinkHref(state) {
  const q = linkNumbers(state);
  return q ? LINKS.celestialControlPanel + formatHash({ jd: q.jdUt, lat: q.lat, lon: q.lonEast, lens: lensOf(state.lens) }) : "";
}
/** lexiconSkyHref(state) -> the Lexicon Explorer's URL with sky=JD,LAT,LON (the same three rounded numbers as skyLinkHref) and the lens; "" before a place is chosen and for a state that has no sky. It never throws. */
export function lexiconSkyHref(state) {
  const q = linkNumbers(state);
  if (!q) return "";
  const s = formatSkyInputs(q.jdUt, q.lat, q.lonEast);
  return LINKS.lexiconExplorer + formatHashWith(LEXICON_PAGE_GRAMMAR, { sky: [s.jd, s.lat, s.lon], lens: lensOf(state.lens) });
}
/** entryHref(address, lens) -> the Lexicon Explorer's URL for one entry (every TEXT sentence links to its row). */
export const entryHref = (address, lens) => LINKS.lexiconExplorer + formatHashWith(LEXICON_PAGE_GRAMMAR, { entry: address, lens: lensOf(lens) });
/** firstExplorersHref() -> the URL of First Explorers. */
export const firstExplorersHref = () => LINKS.firstExplorers;

// ─── 4. state ────────────────────────────────────────────────────────────────

/** DEFAULT_ORBIT: the 3D rotation the ball starts with. */
export const DEFAULT_ORBIT = freeze(rotX(-1.15));
const KEBAR = siteOf("kebar");
const sunsetAt = (parts, site) => sunEventOnLocalDay(parts, site.lat, site.lonEast, "set");
/** EZEKIEL_PRESET: what the link preset=ezekiel opens: { site: "kebar", date (key of EZEKIEL_DATES), which: "ends", jdUt (rounded to 5 decimals) }. */
export const EZEKIEL_PRESET = freeze({ site: "kebar", date: EZEKIEL_DATES[0].key, which: "ends", jdUt: Number(sunsetAt(EZEKIEL_DATES[0].endsDay, KEBAR).toFixed(5)) });

const SKY_CACHE = { key: "", sky: null };
/** skyOf(state) -> the core's snapshot for the state's place and time (cached for the last one asked), or null before a place is chosen. */
export function skyOf(state) {
  if (!state || !state.site || !isNum(state.jdUt)) return null;
  const key = state.jdUt + "," + state.site.lat + "," + state.site.lonEast;
  if (SKY_CACHE.key !== key) {
    if (!skyInputsValid(state.jdUt, state.site.lat, state.site.lonEast)) return null;
    SKY_CACHE.sky = skyState(state.jdUt, state.site.lat, state.site.lonEast);
    SKY_CACHE.key = key;
  }
  return SKY_CACHE.sky;
}

/** initialState({ hash, nowMs }) -> the first-run state (Stargazer, 2D, horizon frame, step 1, no place, the device clock, nothing selected, all overlays off), then the link applied. */
export function initialState(options = {}) {
  const nowMs = isNum(options.nowMs) ? options.nowMs : 0;
  const state = {
    lens: "stargazer", dims: "2D", frame: "hor", step: 1,
    site: null, jdUt: jdFromUnixMs(nowMs),
    selected: null, rimOf: "zenith", centred: null,
    c: [0, 0], view3: IDENT.slice(), orbit: DEFAULT_ORBIT.slice(), flight: null,
    lit: { place: false, day: false, sky: false },
    overlays: { rings: false, horizon: false, equator: false, ecliptic: false, galactic: false, sightLines: false },
    lab: labStart(),
    seal: { keys: null, bundle: null, certificate: null, report: null, wire: null },
    busy: false, notes: { link: "", date: "", time: "", moon: "", place: "" },
  };
  return options.hash ? applyHash(state, options.hash) : state;
}
const withNotes = (state, notes) => ({ ...state, notes: { ...state.notes, ...notes } });
const withTime = (state, jdUt) => retarget({ ...state, jdUt, lit: { ...state.lit, day: true }, notes: { ...state.notes, date: "", time: "", moon: "" } });
const jdValidFor = (state, jdUt) => isNum(jdUt) && (state.site ? skyInputsValid(jdUt, state.site.lat, state.site.lonEast) : skyInputsValid(jdUt, 0, 0));

/** applyHash(state, hash) -> the state with a link applied: preset first (it opens step 2, with the day already answered, so that the date and the Moon are on show), then site, lat and lon (both or neither), jd (judged at the place the link names or the page has, at Greenwich without one; a jd that is no sky there is an ignored value), focus (selected and brought to the centre; it needs a place), lab (it opens step 4 as setStep does, so the sky is lit when the lab is left), lens; notes.link says when a value was ignored. Runs at load and on hashchange. */
export function applyHash(state, hash) {
  const { values, ignored } = parseHash(hash);
  let s = state, dropped = ignored;
  if (values.preset === "ezekiel") s = setStep(ezekielSky(s, EZEKIEL_PRESET.date, EZEKIEL_PRESET.which), 2);
  if (values.site !== undefined) s = chooseSite(s, values.site);
  const hasLat = values.lat !== undefined, hasLon = values.lon !== undefined;
  if (hasLat && hasLon) s = typePlace(s, values.lat, values.lon).state;
  else if (hasLat || hasLon) dropped += 1;
  if (values.jd !== undefined) {
    if (jdValidFor(s, values.jd)) s = withTime(s, values.jd);
    else dropped += 1;
  }
  if (values.lens !== undefined) s = setLens(s, values.lens);
  if (values.focus !== undefined && s.site) {
    const shown = { ...s, lit: { place: true, day: true, sky: true } };
    if (objectVisible(shown, values.focus)) s = retarget({ ...select(shown, values.focus), centred: objectOf(values.focus).kind === "ring" ? null : { key: values.focus, half: false } });
    else dropped += 1;
  } else if (values.focus !== undefined) dropped += 1;
  if (values.lab === "square") s = openLab(setStep(s, 4));
  return withNotes(s, { link: dropped > 0 ? IGNORED_NOTE : "" });
}

// The lighting rule of the steps, whichever comes first, the step or the place: at step 3 and later the whole sky is lit
// once a place is chosen, and step 3 opens in 3D the first time. At steps 1 and 2 the day question is still asked.
const lightUp = (state) => {
  if (state.step < 3 || !state.site) return state;
  const first = !state.lit.sky, next = { ...state, lit: { place: true, day: true, sky: true } };
  return state.step === 3 && first ? setDims(next, "3D") : next;
};
const placed = (state, site) => {
  let jdUt = state.jdUt;
  if (!skyInputsValid(jdUt, site.lat, site.lonEast)) jdUt = state.jdUt + (lonOf(state) - site.lonEast) / 360;   // only at the very ends of the year range: keep the local time
  return retarget(lightUp({ ...state, site, jdUt, lit: { ...state.lit, place: true }, notes: { ...state.notes, place: "" } }));
};
/** chooseSite(state, key) -> the state at a preset place (unknown keys change nothing); at step 3 and later the whole sky lights up with it. */
export function chooseSite(state, key) {
  const site = siteOf(key);
  return site ? placed(state, site) : state;
}
/** typePlace(state, lat, lonEast) -> { state, message }: the state at a typed place (two decimals), or the same state and a plain message when a number is out of range. */
export function typePlace(state, lat, lonEast) {
  if (!isNum(lat) || lat < -90 || lat > 90) return { state: withNotes(state, { place: MESSAGES.badLatitude }), message: MESSAGES.badLatitude };
  if (!isNum(lonEast) || lonEast < -180 || lonEast > 180) return { state: withNotes(state, { place: MESSAGES.badLongitude }), message: MESSAGES.badLongitude };
  return { state: placed(state, siteForCoordinates(lat, lonEast)), message: "" };
}
/**
 * readClock(state, nowMs) -> the state with its instant taken from the device clock again (nowMs: the clock's milliseconds), while the
 * day is not yet answered (lit.day is false): the same state otherwise, and for a clock outside the year range. The shell calls it when a
 * place is chosen, at every change of step, when a link changes, before one of the day's further controls under "More at this step" at
 * step 2 acts (the times of day, the slider through the year, the typed time, the Moon shapes), and, through askDayAgain, at "Yes", at
 * "Change the day" and when the page comes into view again, so that the day question names the day the device shows then, not the day
 * the page was opened, and a step that lights the sky lights the sky of that moment.
 * A time set by a link, a preset or the visitor is never changed by it: each of those answers the day.
 */
export function readClock(state, nowMs) {
  if (state.lit.day || !isNum(nowMs)) return state;
  const jdUt = jdFromUnixMs(nowMs);
  return jdUt === state.jdUt || !jdValidFor(state, jdUt) ? state : retarget({ ...state, jdUt });
}
/** confirmDay(state) -> the state after "Yes" to the day question: the Sun and the Moon light up. */
export const confirmDay = (state) => ({ ...state, lit: { ...state.lit, day: true } });
/**
 * askDayAgain(state, nowMs, deviceOf) -> { state, changed }: the device clock read again (readClock, so only while the day is not
 * answered), and whether the day question now reads otherwise than it did. deviceOf(state) gives the calendar date the device shows for
 * a state's instant, as dayQuestion() takes it. A question can stand on the screen for hours; changed is true when its day, the place's
 * or the device's, is no longer the day it named.
 */
export function askDayAgain(state, nowMs, deviceOf) {
  const device = (s) => (typeof deviceOf === "function" ? deviceOf(s) : undefined);
  const now = readClock(state, nowMs);
  return { state: now, changed: now !== state && dayQuestion(now, device(now)).text !== dayQuestion(state, device(state)).text };
}
/**
 * answerDay(state, nowMs, deviceOf) -> { state, taken, message }: a press on "Yes" under the day question, with the clock read again
 * first (askDayAgain). If the question is no longer the one that was asked (the day changed while it stood there), the answer is not
 * taken: the state has the new instant, the day is still to be answered, and message is MESSAGES.dayChanged. Otherwise the day is
 * answered at the instant just read, and message is "".
 */
export function answerDay(state, nowMs, deviceOf) {
  const again = askDayAgain(state, nowMs, deviceOf);
  return again.changed ? { state: again.state, taken: false, message: MESSAGES.dayChanged } : { state: confirmDay(again.state), taken: true, message: "" };
}
/** setJd(state, jdUt) -> the state at another instant (unchanged when the instant is outside the year range). */
export const setJd = (state, jdUt) => (jdValidFor(state, jdUt) ? withTime(state, jdUt) : state);
/** stepDay(state, n) -> { state, message }: n days later (or earlier), same clock time. */
export function stepDay(state, n) {
  const jdUt = state.jdUt + n;
  if (!jdValidFor(state, jdUt)) return { state: withNotes(state, { date: MESSAGES.yearRange }), message: MESSAGES.yearRange };
  return { state: withTime(state, jdUt), message: "" };
}
const lonOf = (state) => (state.site ? state.site.lonEast : 0);
const localParts = (state) => partsFromJd(state.jdUt + lonOf(state) / 360);
const localHours = (state) => { const d = state.jdUt + 0.5 + lonOf(state) / 360; return (d - Math.floor(d)) * 24; };
/** pickDate(state, { year, month, day }) -> { state, message }: that local date at the same clock time. An impossible date gives a plain message and the next day that exists ("That day does not exist. Showing 1 March."), never a silent roll-over. */
export function pickDate(state, date) {
  const fail = (message) => ({ state: withNotes(state, { date: message }), message });
  const { year, month, day } = date || {};
  if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) return fail(MESSAGES.yearRange);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) return fail(MESSAGES.noSuchDay);
  let use = { year, month, day }, message = "";
  const gap = year === 1582 && month === 10 && day > 4 && day < 15;
  if (gap) use = { year, month: 10, day: 15 };
  else if (day > daysInMonth(year, month)) use = month === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: month + 1, day: 1 };
  if (use.year > YEAR_MAX) return fail(MESSAGES.yearRange);
  if (use.day !== day || use.month !== month) message = MESSAGES.noSuchDay + " Showing " + use.day + " " + MONTH_NAMES[use.month - 1] + ".";
  let jdUt;
  try { jdUt = jdFromLocalMean(use, Math.min(localHours(state), 23.9999), lonOf(state)); } catch { return fail(MESSAGES.noSuchDay); }
  if (!jdValidFor(state, jdUt)) return fail(MESSAGES.yearRange);
  const next = withTime(state, jdUt);
  return { state: withNotes(next, { date: message }), message };
}
/** pickEraDate(state, { n, bc, month, day }) -> { state, message }: pickDate for a year typed as it is written, a whole number from 1 up with BC or AD. There is no year 0 and no year below it: such a year gives the message "That day does not exist." and the state stays. */
export function pickEraDate(state, date) {
  const { n, bc, month, day } = date || {};
  if (Number.isInteger(n) && n < 1) return { state: withNotes(state, { date: MESSAGES.noSuchDay }), message: MESSAGES.noSuchDay };
  return pickDate(state, { year: bc ? 1 - n : n, month, day });
}
/** timeButton(state, which, nowMs) -> { state, message }: "now" (the device clock; "today" is the same), "sunrise", "noon", "sunset" or "midnight" on the local date; when the Sun does not rise or set that day the state stays and the message says so. */
export function timeButton(state, which, nowMs) {
  const fail = (message) => ({ state: withNotes(state, { time: message }), message });
  if (which === "now" || which === "today") { const jd = jdFromUnixMs(isNum(nowMs) ? nowMs : 0); return jdValidFor(state, jd) ? { state: withTime(state, jd), message: "" } : fail(MESSAGES.yearRange); }
  if (!state.site) return fail(MESSAGES.needPlace);
  const parts = localParts(state), { lat, lonEast } = state.site;
  let jdUt = null;
  if (which === "noon" || which === "midnight") jdUt = jdFromLocalMean(parts, which === "noon" ? 12 : 0, lonEast);
  else if (which === "sunrise" || which === "sunset") {
    jdUt = sunEventOnLocalDay(parts, lat, lonEast, which === "sunrise" ? "rise" : "set");
    if (jdUt === null) return fail(which === "sunrise" ? MESSAGES.noSunrise : MESSAGES.noSunset);
  } else return fail("");
  return jdValidFor(state, jdUt) ? { state: withTime(state, jdUt), message: "" } : fail(MESSAGES.yearRange);
}
/** setDayOfYear(state, n) -> the state on day n (1..365 or 366) of the local year, same clock time (the slider through the year). */
export function setDayOfYear(state, n) {
  const p = localParts(state);
  if (!Number.isInteger(n) || n < 1 || n > daysInYear(p.year)) return state;
  const jdUt = jdFromLocalMean(partsFromDayOfYear(p.year, n), Math.min(localHours(state), 23.9999), lonOf(state));
  return jdValidFor(state, jdUt) ? withTime(state, jdUt) : state;
}
/** setClock(state, hours) -> the state at that local mean time (0 up to 24) on the same local date ("Sun time at this place"). */
export function setClock(state, hours) {
  if (!isNum(hours) || hours < 0 || hours >= 24) return state;
  const jdUt = jdFromLocalMean(localParts(state), hours, lonOf(state));
  return jdValidFor(state, jdUt) ? withTime(state, jdUt) : state;
}
/** findMoon(state, target) -> { state, note, lines }: "Find the next night with this Moon" for a target of PHASE_TARGETS; never an earlier night; the time becomes one hour after sunset that evening. lines: whole sentences, "This changes the day.", the computed name and percentage ("Full Moon, 100 per cent lit.") and, when the name differs from the button's, "Nearest evening: 0.4 day after Full Moon."; note: the lines joined by spaces. */
export function findMoon(state, target) {
  const button = PHASE_TARGETS.find((p) => p.target === target);
  if (!state.site || !button) return { state: withNotes(state, { moon: MESSAGES.needPlace }), note: MESSAGES.needPlace, lines: [] };
  const r = phaseEveningJd(state.jdUt, target, state.site.lat, state.site.lonEast);
  if (!jdValidFor(state, r.jdUt)) return { state: withNotes(state, { moon: MESSAGES.yearRange }), note: MESSAGES.yearRange, lines: [] };
  const next = withTime(state, r.jdUt), sky = skyOf(next);
  const lines = [MESSAGES.changesDay, capital(moonWords(sky.phase.name, state.lens)) + ", " + Math.round(100 * sky.phase.illuminatedFraction) + " per cent lit."];
  if (sky.phase.name !== button.name) {
    const d = r.jdUt - r.phaseJd;
    lines.push("Nearest evening: " + fixed(Math.abs(d), 1) + " day " + (d >= 0 ? "after " : "before ") + moonWords(button.name, state.lens) + ".");
  }
  const note = lines.join(" ");
  return { state: withNotes(next, { moon: note }), note, lines };
}

/** ezekielChoices() -> the buttons of the preset "Ezekiel by the Kebar": [{ date (key), which ("ends" | "begins"), label, said, isDefault }]. */
export function ezekielChoices() {
  const first = EZEKIEL_DATES[0];
  const out = [
    { date: first.key, which: "ends", label: "The sunset that ends the fifth day (" + first.label + ")", said: first.said, isDefault: true },
    { date: first.key, which: "begins", label: "The sunset that begins it (" + first.beginsDay.day + " " + MONTH_NAMES[first.beginsDay.month - 1] + ")", said: first.said, isDefault: false },
  ];
  for (const d of EZEKIEL_DATES.slice(1)) out.push({ date: d.key, which: "ends", label: d.label, said: d.said, isDefault: false });
  return out;
}
/** ezekielSky(state, date, which) -> the state at the Kebar site at the sunset that ends (or begins) the fifth day on one of the published dates. */
export function ezekielSky(state, date, which) {
  const d = EZEKIEL_DATES.find((x) => x.key === date);
  if (!d) return state;
  const jdUt = Number(sunsetAt(which === "begins" ? d.beginsDay : d.endsDay, KEBAR).toFixed(5));
  return withTime(placed(state, KEBAR), jdUt);
}

/** setLens(state, lens) -> the state at a lens; an object only the Holographer sees is unselected on the way down, and Stargazer returns to the horizon frame (then "The edge" aims straight up again, as after setFrame). */
export function setLens(state, lens) {
  const next = { ...state, lens: lensOf(lens) };
  if (next.lens === "stargazer" && next.frame !== "hor") next.frame = "hor";
  if (next.selected && !objectVisible(next, next.selected)) { next.selected = null; next.centred = null; }
  if (state.site && !objectVisible(next, next.rimOf)) next.rimOf = next.frame === "hor" ? "zenith" : "ngp";
  return retarget(next);
}
/** setDims(state, dims) -> the state drawn in "2D" or "3D"; a centred object stays centred. */
export function setDims(state, dims) {
  if (!DIMS.includes(dims) || dims === state.dims) return state;
  const next = { ...state, dims };
  if (!state.centred) {
    if (dims === "3D") next.view3 = centreOn([state.c[0], state.c[1], 0]);
    else { const p = toBall(lapply(linv(state.view3), ORIGIN)); next.c = [p[0], p[1]]; }
  }
  return retarget(next);
}
/** setFrame(state, frame) -> the state in the "hor" or "gal" frame (the galactic frame from Navigator up); an object the new frame does not show is unselected. */
export function setFrame(state, frame) {
  if (!FRAME_CHOICES.some((f) => f.key === frame) || frame === state.frame) return state;
  if (frame !== "hor" && lensOf(state.lens) === "stargazer") return state;      // the frame switch is for the Navigator and up
  const next = { ...state, frame };
  if (next.selected && !objectVisible(next, next.selected)) { next.selected = null; next.centred = null; }
  if (!objectVisible(next, next.rimOf)) next.rimOf = frame === "hor" ? "zenith" : "ngp";
  if (!next.centred) { next.c = [0, 0]; next.view3 = IDENT.slice(); }
  return retarget(next);
}
/** setStep(state, n) -> the state at step 1..5 (free order). Step 3 and later light the whole sky once a place is chosen; step 3 opens in 3D the first time. */
export function setStep(state, n) {
  if (!Number.isInteger(n) || n < 1 || n > STEP_KEYS.length) return state;
  let next = { ...state, step: n };
  if (n !== 4 && next.lab.open) next = closeLab(next);
  return lightUp(next);
}
const tidy = (state) => (state.selected && !objectVisible(state, state.selected) ? { ...state, selected: null } : state);   // a thing no longer shown is no longer selected
/** toggleOverlay(state, key) -> the state with one switch of OVERLAYS flipped. */
export function toggleOverlay(state, key) {
  if (!OVERLAYS.some((o) => o.key === key)) return state;
  return tidy({ ...state, overlays: { ...state.overlays, [key]: !state.overlays[key] } });
}
/** select(state, key) -> the state with an object selected (null unselects); the view does not move (dive() moves it). */
export function select(state, key) {
  if (key === null || key === undefined) return { ...state, selected: null };
  const o = objectOf(key);
  if (!o || !objectVisible(state, key)) return state;
  const next = { ...state, selected: key };
  if (o.kind === "body" || o.kind === "direction") next.rimOf = key;
  return next;
}

/** dateView(state) -> what the day controls show: { text ("31 July 593 BC (Julian calendar)"), weekday, clock ("19:00"), parts (local), era: { n, era }, calendar, calendarNote, dayOfYear, daysInYear, hours }. Every date is the local date at the site. */
export function dateView(state) {
  const parts = localParts(state), hours = localHours(state);
  return {
    text: formatDate(parts), weekday: weekdayOf(state.jdUt + lonOf(state) / 360), clock: formatClock(Math.min(hours, 23.9999)), parts,
    era: eraYear(parts.year), calendar: parts.calendar,
    calendarNote: parts.calendar === "julian" ? "Julian calendar (in force before 15 October 1582)" : "Gregorian calendar",
    dayOfYear: dayOfYear(parts), daysInYear: daysInYear(parts.year), hours,
  };
}
const plainDate = (text) => text.replace(/ \((Julian|Gregorian) calendar\)$/, "");
const placePhrase = (site) => (!site ? "" : site.key === null ? "At your place" : /^(At|By|In|On) /.test(site.label) ? site.label : "At " + site.label);
/**
 * dayQuestion(state, device) -> { text, yes, change, same }: question 2, answered from the device clock and shown for confirmation.
 * device: { year, month, day }, the calendar date the device itself shows for the state's instant (the shell reads it from its clock).
 * Every date of this page is the local date at the place, and that can be the day before or after the device's own. Where the two
 * are the same day: "Your device says today is Saturday 14 November 2026. Is that right?". Where they differ, each is said as what
 * it is: "At Sydney, Australia it is now Sunday 15 November 2026. Your device says Saturday 14 November 2026. Is that the day you want?".
 * Without a device date nothing is said about the device: "At Greenwich, England it is now Saturday 14 November 2026. Is that the day you want?".
 */
export function dayQuestion(state, device) {
  const d = dateView(state), local = d.weekday + " " + plainDate(d.text), buttons = { yes: "Yes", change: "Change the day" };
  const v = device || {};
  let theirs = null;
  if (Number.isInteger(v.year) && Number.isInteger(v.month) && Number.isInteger(v.day)) {
    try { theirs = weekdayOf(jdFromParts({ year: v.year, month: v.month, day: v.day, hour: 12 })) + " " + plainDate(formatDate({ year: v.year, month: v.month, day: v.day })); } catch { theirs = null; }
  }
  if (theirs !== null && v.year === d.parts.year && v.month === d.parts.month && v.day === d.parts.day) return { text: "Your device says today is " + local + ". Is that right?", ...buttons, same: true };
  const here = (placePhrase(state.site) || "Here") + " it is now " + local + ".";
  return { text: here + (theirs !== null ? " Your device says " + theirs + "." : "") + " Is that the day you want?", ...buttons, same: false };
}
const SEASON_NAMES = freeze({ "march-equinox": "the March equinox", "june-solstice": "the June solstice", "september-equinox": "the September equinox", "december-solstice": "the December solstice" });
const SEASON_PLAIN = freeze({ "march-equinox": "the March day when day and night are about equal", "september-equinox": "the September day when day and night are about equal" });
// A solstice in plain words. "The shortest day" holds where that time of year has days and nights of unequal length: between the polar
// circles and away from the equator. Elsewhere the words say what holds at every place: how far north or south the Sun stands.
const SHORT_DAY = freeze({ from: 1, to: 66 });
function seasonPlain(key, lat) {
  if (SEASON_PLAIN[key]) return SEASON_PLAIN[key];
  const december = key === "december-solstice", a = isNum(lat) ? Math.abs(lat) : 0;
  if (a >= SHORT_DAY.from && a <= SHORT_DAY.to) return december === lat > 0 ? "the shortest day" : "the longest day";
  return "the day the Sun is farthest " + (december ? "south" : "north");
}
/** seasonLine(state) -> { key, days, text ("12 days after the June solstice") }: the days from the nearest equinox or solstice. At the Stargazer lens the four are named in plain words for the place ("37 days before the shortest day"; north of the equator that is the December solstice, south of it the June one). */
export function seasonLine(state) {
  const s = nearestSeasonJd(state.jdUt), d = state.jdUt - s.jdUt, days = Math.round(Math.abs(d));
  const plain = lensOf(state.lens) === "stargazer", name = plain ? seasonPlain(s.key, state.site ? state.site.lat : null) : SEASON_NAMES[s.key];
  const text = days === 0 ? (plain ? name : "the day of " + name) : days + (days === 1 ? " day " : " days ") + (d >= 0 ? "after " : "before ") + name;
  return { key: s.key, days, text };
}
/** nextStep(state) -> { n, label ("Next: Look around") } | null: the step the last button of the card leads on to. It is offered at steps 2 to 4 once the step has something to show: a place is chosen, the lab is closed and, at step 2, the day is answered. (Step 1 has its own button beside the place buttons.) */
export function nextStep(state) {
  if (!state.site || state.lab.open || state.step < 2 || state.step > 4 || (state.step === 2 && !state.lit.day)) return null;
  const s = visibleSteps(state.lens)[state.step];
  return { n: s.n, label: "Next: " + s.title };
}
/** statusSentence(state) -> the one sentence for the status line ("31 July 593 BC, 19:00 at By the Kebar (Nippur). Moon 50 per cent lit."); "" before a place is chosen. */
export function statusSentence(state) {
  const sky = skyOf(state);
  if (!sky) return "";
  const d = dateView(state);
  return d.text + ", " + d.clock + " at " + state.site.label + ". Moon " + Math.round(100 * sky.phase.illuminatedFraction) + " per cent lit" + (sky.moon.alt < 0 ? ", below the horizon." : ".");
}

// ─── 5. objects on the chart ─────────────────────────────────────────────────
// Kinds: "body" (a direction and a depth), "direction" (a direction only), "rim" (a point of the rim, or the
// microwave-background shell) and "ring" (a depth ring). The member core names what the object stands on in
// scripts/celestial-core.js: a key of BODIES, a frame and one of its axes, a key of RINGS, or the selection.

const ANCHOR_BY_KEY = new Map(ANCHORS.map((a) => [a.key, a]));
const anchor = (key) => ANCHOR_BY_KEY.get(key);
const RIM_ROWS = new Map(skyLexiconRows(skyState(EZEKIEL_PRESET.jdUt, KEBAR.lat, KEBAR.lonEast)).filter((r) => r[0].startsWith("4.")).map((r) => [r[0], r[4]]));
const rimRow = (address) => RIM_ROWS.get(address) || "";
const CMB_RING = RINGS[RINGS.length - 1];
const CMB_NOTE = sentencesOf(CMB.note);
const positionLine = (key) => T("said", "J2000 position from " + anchor(key).positionSource + ".");
const PLACED = T("checked", "Computed for your place and time: precession and nutation are applied to that position; star aberration (0.006°) and proper motion are neglected.");
const STATUS = freeze({
  computed: freeze({ layer: "checked", note: "computed", stargazer: "worked out" }),
  measured: freeze({ layer: "said", note: "measured", stargazer: "measured" }),
  geometry: freeze({ layer: "checked", note: "geometry", stargazer: "worked out" }),
  proposal: freeze({ layer: "said", note: "a proposal", stargazer: "an idea, not proved" }),
  predicted: freeze({ layer: "said", note: "predicted, not detected", stargazer: "expected, not seen yet" }),
  scale: freeze({ layer: "reading", note: "this chart's scale", stargazer: "our way of drawing" }),
});
const body = (key, glyph, label, short, stargazer, lit, status, text) =>
  freeze({ key, kind: "body", glyph, label, short, stargazer, core: freeze({ body: key }), frames: null, minLens: null, lit, status, text });
const direction = (key, glyph, label, short, stargazer, core, frames, text) =>
  freeze({ key, kind: "direction", glyph, label, short, stargazer, core: freeze(core), frames: freeze(frames), minLens: null, lit: "place", status: STATUS.computed, text });
const rim = (key, glyph, label, short, stargazer, core, minLens, status, text) =>
  freeze({ key, kind: "rim", glyph, label, short, stargazer, core: freeze(core), frames: null, minLens, lit: "sky", status, text });

/**
 * OBJECTS: everything the chart can show, in list order. Each is
 *   { key, kind ("body" | "direction" | "rim" | "ring"), glyph, label, short (canvas name), stargazer (name at the
 *     Stargazer lens), core, frames (null: both), minLens (null | "holographer"), lit ("place" | "day" | "sky": the
 *     question that brings it), status: { layer, note } (the fixed badge), text: { stargazer, navigator,
 *     holographer } (each a list of { layer, text }) }.
 * status.note is the word beside the badge ("measured", "a proposal", "predicted, not detected"); status.stargazer is its Stargazer form.
 */
export const OBJECTS = freeze([
  body("moon", "☾", "Moon", "Moon", "Moon", "day", STATUS.computed, perLens(
    list(T("checked", "The Moon circles Earth about every 27 days. Its shapes repeat every 29 and a half days."), T("said", "Astronomers explain this by Earth's own travel round the Sun.")),
    list(T("checked", "The angle between the Sun and the Moon makes crescent, half and full Moons. The phases repeat every 29.53 days on average; the Moon goes once round the sky in 27.32 days. The numbers below are computed for your place and time.")),
    list(T("checked", "Lit fraction (1 + cos i)/2, with i the phase angle. The altitude in the table is topocentric: the Moon's parallax is applied. The direction on the chart is geocentric.")))),
  body("sun", "☉", "Sun", "Sun", "Sun", "day", STATUS.computed, perLens(
    list(T("checked", "The Sun is our star. Its light takes about 8 minutes to reach us. Through the year it seems to glide once round the sky.")),
    list(T("checked", "The Sun's path among the stars is the ecliptic, the plane of Earth's orbit, tilted 23.4° to the celestial equator. Its longitude along that path is 0° at the March equinox and grows by about 1° a day.")),
    list(T("checked", "Apparent geocentric longitude of the true equinox of date, by the low-accuracy method of Meeus (1991): within 0.01° of PyEphem for 1800 to 2200. Its distance is computed too; one astronomical unit is 499 light-seconds.")))),
  body("pleiades", "⁂", "Pleiades", "Pleiades", "Pleiades", "sky", STATUS.measured, perLens(
    list(T("said", "The Pleiades are a family of young blue stars. Astronomers (Stauffer and others, 1998) give them an age of about 125 million years.")),
    list(T("said", anchor("pleiades").distanceNote), T("checked", "Computed: the position shown, that of Alcyone, lies 4° north of the ecliptic, so the Moon can pass close by.")),
    list(positionLine("pleiades"), PLACED))),
  body("polaris", "★", "Polaris", "Polaris", "Polaris", "sky", STATUS.measured, perLens(
    list(T("checked", "Polaris sits close to the point the whole sky seems to turn around. Today it is less than 1 degree from that point. About 2,600 years ago it was 15 degrees away.")),
    list(T("checked", "Computed: Polaris is 0.6° from the north celestial pole today and was 15.0° from it in 593 BC, when it marked no pole. The table gives its distance from the pole on your date."), T("said", anchor("polaris").distanceNote)),
    list(positionLine("polaris"), PLACED))),
  body("vela_pulsar", "↻", "Vela pulsar", "Vela", "Vela pulsar", "sky", STATUS.measured, perLens(
    list(T("said", "This is a small, heavy star left by a giant star's explosion, astronomers say. It spins 11 times every second, faster than you can count.")),
    list(T("said", anchor("vela_pulsar").extra.said), T("said", anchor("vela_pulsar").distanceNote)),
    list(T("said", "Lorimer (2008) writes: “pulsars are rapidly rotating, highly magnetised neutron stars formed during the supernova explosions of massive stars.”"), positionLine("vela_pulsar"), PLACED))),
  body("cyg_x1", "✕", "Cygnus X-1", "Cyg X-1", "Cygnus X-1", "sky", STATUS.measured, perLens(
    list(T("said", "A blue giant star and a black hole circle each other here, astronomers say. One trip takes 5.6 days.")),
    list(T("said", "Miller-Jones and others (2021) write that it “contains a black hole in a 5.6-day orbit with a more massive supergiant donor star, of spectral type O.”"), T("said", anchor("cyg_x1").distanceNote)),
    list(positionLine("cyg_x1"), PLACED))),
  body("sgr_a_star", "◉", "Sagittarius A*", "Sgr A*", "The middle of our galaxy", "sky", STATUS.measured, perLens(
    list(T("said", "At the centre of our galaxy sits a black hole, astronomers say. It is 4 million times heavier than our Sun. Everything in our galaxy circles around the galaxy's centre. That is where this black hole sits.")),
    list(T("said", "The GRAVITY collaboration (2021) reports a mass of 4.30 million Suns for this black hole."), T("said", anchor("sgr_a_star").distanceNote),
      T("checked", "Computed: it lies at galactic longitude 359.94°, latitude −0.05°, 4 arcminutes from the zero point of the galactic frame.")),
    list(T("said", "The Event Horizon Telescope collaboration (2022) reports an image “consistent with the expected appearance of a Kerr black hole with mass ∼4 × 10⁶ M⊙”."), positionLine("sgr_a_star"), PLACED))),
  body("m31", "⊛", "Andromeda galaxy", "Andromeda", "Andromeda galaxy", "sky", STATUS.measured, perLens(
    list(T("said", "The Andromeda galaxy lies far outside our own galaxy. Astronomers say its light takes about two and a half million years to reach us.")),
    list(T("said", anchor("m31").distanceNote), T("checked", "Computed: that is 2.48 million light-years, 93 times the distance to the centre of our own galaxy.")),
    list(positionLine("m31"), PLACED))),

  direction("zenith", "▲", "Zenith", "Zenith", "Straight up", { body: "zenith" }, ["hor"], perLens(
    list(T("checked", "This is the line straight up from your head; from above it looks like a dot.")),
    list(T("checked", "The point of the sky directly overhead. Its declination equals your latitude, and its right ascension equals your local sidereal time. Straight up has no compass direction.")),
    list(T("checked", "The unit vector (0, 0, 1) of the horizon frame: a point of the flat chart, a line of the ball."),
      T("reading", "Read as physics: your 4-velocity plus the unit vector to the zenith is a null vector, which marks one point on the celestial sphere.")))),
  direction("north", "N", "North point", "N", "North", { frame: "hor", axis: [0, 1, 0] }, ["hor"], null),
  direction("east", "E", "East point", "E", "East", { frame: "hor", axis: [1, 0, 0] }, ["hor"], null),
  direction("south", "S", "South point", "S", "South", { frame: "hor", axis: [0, -1, 0] }, ["hor"], null),
  direction("west", "W", "West point", "W", "West", { frame: "hor", axis: [-1, 0, 0] }, ["hor"], null),
  direction("galactic_centre", "⊕", "Galactic centre (longitude 0°)", "GC", "Towards the galaxy's middle", { frame: "gal", axis: [1, 0, 0] }, ["gal"], null),
  direction("ngp", "⊗", "North galactic pole", "NGP", "North galactic pole", { body: "ngp" }, ["gal"], perLens(
    list(T("checked", "This is the line straight up from the flat disc of our galaxy.")),
    list(T("said", "The pole of the galactic frame: " + anchor("ngp").positionSource + ". It has no direction round the galactic plane.")),
    list(T("said", "The pole of the galactic frame: " + anchor("ngp").positionSource + ".")))),

  rim("celestial_sphere", "○", "The celestial sphere", "celestial sphere", "The sky of directions", { body: "zenith" }, null, STATUS.geometry, perLens(
    list(T("checked", "The edge of this map is the sky of directions. Every way you can look ends at one point of the edge."), T("checked", "The edge can never reach the middle. This is as far as the map goes.")),
    list(T("checked", rimRow("4.2"))),
    list(T("checked", rimRow("4.2")), T("said", "Strominger (2017, section 3) writes: “The four-dimensional Lorentz symmetry is SL(2,ℂ), which acts on 𝒞𝒮² as z → (az+b)/(cz+d), ad−bc = 1.”")))),
  rim("antipode", "⇄", "The opposite point", "opposite point", "The opposite point", { selection: true, opposite: true }, null, STATUS.geometry, perLens(
    list(T("checked", "This is the point of the edge exactly opposite the one you chose."), T("said", "A light beam crossing empty flat space comes in at one point of the sky. It goes out through the exactly opposite point, a physicist, Strominger, writes.")),
    list(T("checked", "Computed: the point of the rim exactly opposite the one you chose. A straight line through the centre joins the two."),
      T("said", "Strominger (2017, section 2.4) writes: “If we take a light ray which crosses Minkowski space, then the value of z at which it starts in advanced coordinates will be the same as the value of z at which it ends in retarded coordinates.”")),
    undefined)),
  rim("holography", "▣", "Celestial holography", "holography", "A bold idea about the edge", { body: "nep" }, null, STATUS.proposal, perLens(
    list(T("said", "Some physicists are testing a bold idea. Everything that happens inside space might be written on its edge. Nobody knows yet whether our universe works like that.")),
    list(T("said", rimRow("4.3")), T("reading", "This chart sets the proposal at the north pole of the ecliptic, a place on the rim chosen by this project.")),
    list(T("said", rimRow("4.3")),
      T("said", "Strominger (2017, section 3) writes: “The four-dimensional Minkowski S-matrix for any theory can be rewritten as a two-dimensional correlator on the celestial sphere”, and of a two-dimensional theory that would produce it: “More ambitiously, one may attempt to find a two-dimensional CFT whose correlators on 𝒞𝒮² reproduce the S-matrix of a four-dimensional quantum theory of gravity.”"),
      T("reading", "This chart sets the proposal at the north pole of the ecliptic, a place on the rim chosen by this project.")))),
  rim("shadow", "◐", "The shadow transform", "shadow transform", "The shadow transform", { body: "nep", opposite: true }, "holographer", STATUS.proposal, perLens(
    list(), list(),
    list(T("said", "Pasterski (2021, section 4.1) writes of operators “related by the conformal shadow transform”: it takes the weights (Δ, J) to (2 − Δ, −J) by an integral over the whole celestial sphere. Pasterski and Shao (2017) call the shadow “a non-local operator”."),
      T("reading", "The opposite point and the shadow transform are different operations. This chart sets the transform at the south pole of the ecliptic, opposite the proposal it belongs to.")))),
  rim("memory", "≈", "Gravitational-wave memory", "memory", "A ripple that stays", { body: "ngp", opposite: true }, null, STATUS.predicted, perLens(
    list(T("said", "Einstein's theory predicts something about crashing black holes. Their ripples should leave things a tiny bit further apart for ever. Scientists are still trying to catch this.")),
    list(T("said", rimRow("4.4")), T("reading", "This chart sets the prediction at the south pole of the galactic frame, a place on the rim chosen by this project.")),
    list(T("said", rimRow("4.4")),
      T("said", "Strominger (2017, section 6) writes: “the soft theorem is the Ward identity of supertranslation symmetry”."),
      T("reading", "This chart sets the prediction at the south pole of the galactic frame, a place on the rim chosen by this project.")))),
  rim("cmb", "≋", "Cosmic microwave background", "microwave background", "The oldest light", { ring: CMB_RING.key, selection: true }, null, STATUS.measured, perLens(
    list(T("said", "The teams who measured this faint glow say it is very old light. It set out when the universe was a newborn, only 380,000 years old.")),
    list(T("said", "The WMAP team (2003) wrote: “Decoupling was 379+8-7 kyr after the Big Bang at a redshift of 1089 +/- 1.”"), T("said", CMB_NOTE.slice(0, 2).join(" ")),
      T("reading", "The ring on this chart uses the present distance: 45.3 billion light-years.")),
    list(T("said", "The Planck collaboration (2018) describes “a power-law spectrum of adiabatic scalar perturbations”. BICEP/Keck (2021) report “the constraint r_0.05 < 0.036 at 95% confidence”: primordial tensor modes have not been detected."),
      T("reading", "This chart puts that shell on its outermost ring by choice. The shell is not the rim: the rim is the sphere of directions.")))),

  ...RINGS.slice(0, -1).map((r) => freeze({
    key: r.key, kind: "ring", glyph: "◌", label: r.label, short: r.label, stargazer: r.label, core: freeze({ ring: r.key }), frames: null, minLens: null,
    lit: "sky", status: STATUS.scale, text: null,
  })),
]);
for (const o of OBJECTS) OBJECT_KEYS.push(o.key);
freeze(OBJECT_KEYS);
const OBJECT_BY_KEY = new Map(OBJECTS.map((o) => [o.key, o]));
const RING_BY_KEY = new Map(RINGS.map((r) => [r.key, r]));

/** objectOf(key) -> the object of that key, or null. */
export const objectOf = (key) => OBJECT_BY_KEY.get(key) || null;
/** objectVisible(state, key) -> whether the chart shows that object now: its question is answered, its frame and its lens fit, and (for the opposite point) something is selected; rings need their switch. */
export function objectVisible(state, key) {
  const o = objectOf(key);
  if (!o || !state.site || !state.lit[o.lit]) return false;
  if (o.frames && !o.frames.includes(state.frame)) return false;
  if (o.minLens && lensOf(state.lens) !== o.minLens) return false;
  if (o.kind === "ring") return !!state.overlays.rings || !!state.centred || viewDistance(state) > 1e-9;
  if (o.key === "antipode") return !!state.selected && state.selected !== "cmb" && objectOf(state.selected).kind !== "ring";
  return true;
}
const neg = (v) => [-v[0], -v[1], -v[2]];
/** objectDirection(state, key) -> the unit vector of an object in the state's frame, or null (rings, and before a place is chosen). */
export function objectDirection(state, key) {
  const o = objectOf(key), sky = skyOf(state);
  if (!o || !sky || o.kind === "ring") return null;
  const c = o.core;
  let v;
  if (c.selection) {
    const of = objectOf(state.rimOf) && state.rimOf !== key && !objectOf(state.rimOf).core.selection ? state.rimOf : "zenith";
    v = objectDirection(state, of);
  } else if (c.body) v = bodyDirection(sky, c.body, state.frame);
  else v = rotate(frameMatrix(c.frame, state.frame, sky), c.axis);
  return v && c.opposite ? neg(v) : v;
}
/** objectRho(state, key) -> the depth of an object on the chart (hyperbolic distance from home): finite for bodies, rings and the microwave background, Infinity for directions and points of the rim. */
export function objectRho(state, key) {
  const o = objectOf(key), sky = skyOf(state);
  if (!o || !sky) return NaN;
  if (o.core.ring) return RING_BY_KEY.get(o.core.ring).rho;
  if (o.kind !== "body") return Infinity;
  return depthRho(bodyLightSeconds(sky, o.core.body));
}
/**
 * objectPoint(state, key) -> where an object is on the chart in the state's dims, or null:
 *   { dir (unit vector on the chart: in 2D flattened into the frame's plane), rho, point (hyperboloid point, or null on the rim),
 *     atRim, centreDot (2D: a direction with no bearing is the dot at the centre), nominal (2D: a rim object with no bearing is
 *     drawn at the top of the rim), below (its latitude in the frame is negative; for the Moon in the horizon frame: its altitude
 *     as seen from the place, parallax applied, is below zero, which is what the list, the status line and the Moon picture say) }.
 */
export function objectPoint(state, key) {
  const o = objectOf(key), v = objectDirection(state, key);
  if (!o || !v) return null;
  const rho = objectRho(state, key), flat = state.dims === "2D", h = Math.hypot(v[0], v[1]);
  let dir = v, centreDot = false, nominal = false;
  if (flat) {
    if (h >= 1e-9) dir = [v[0] / h, v[1] / h, 0];
    else if (o.kind === "direction") centreDot = true;
    else { dir = [0, 1, 0]; nominal = true; }
  }
  const atRim = !centreDot && !Number.isFinite(rho);
  const point = centreDot ? ORIGIN.slice() : atRim ? null : chartPoint(dir, rho);
  const sky = skyOf(state), below = key === "moon" && state.frame === "hor" && sky ? sky.moon.alt < 0 : v[2] < 0;
  return { dir, rho, point, atRim, centreDot, nominal, below };
}

const percent = (fraction) => Math.round(100 * fraction);
const whereWords = (state, key, sky) => {
  const v = objectDirection(state, key);
  if (!v) return "";
  if (state.frame !== "hor") { const a = anglesFromDir(v); return "galactic longitude " + fixed(a.lon, 0) + "°, latitude " + fixed(a.lat, 0) + "°"; }
  const o = objectOf(key);
  const alt = key === "moon" ? sky.moon.alt : horFromDir(v).alt, az = horFromDir(v).az;
  if (o.kind === "direction" && Math.hypot(v[0], v[1]) < 1e-9) return lensOf(state.lens) === "stargazer" ? "above your head" : "straight up";
  if (o.kind === "direction" && Math.abs(alt) < 1e-6) return "on the horizon";
  return (alt < 0 ? "below the horizon, " : "up, ") + compassPoint(az);
};
/** objectList(state) -> the list of buttons beside the canvas: [{ key, kind, glyph, label, state ("25 per cent lit, up, south-west"), name ("Moon, 25 per cent lit, up, south-west"), pressed, below }] for every object the chart shows now. */
export function objectList(state) {
  const sky = skyOf(state), stargazer = lensOf(state.lens) === "stargazer", out = [];
  if (!sky) return out;
  for (const o of OBJECTS) {
    if (!objectVisible(state, o.key)) continue;
    const label = stargazer ? o.stargazer : o.label, parts = [];
    if (o.key === "moon") parts.push(percent(sky.phase.illuminatedFraction) + " per cent lit");
    if (o.kind === "body" || o.kind === "direction") parts.push(whereWords(state, o.key, sky));
    else if (o.kind === "ring") parts.push("a ring of the map");
    else if (stargazer) parts.push(o.status.stargazer + (o.key === "cmb" ? ", near the edge of the map" : ", on the edge of the map"));
    else parts.push(o.status.note + (o.key === "cmb" ? ", the outermost ring" : ", on the rim"));
    const text = parts.filter((p) => p !== "").join(", ");
    const p = objectPoint(state, o.key);
    out.push({ key: o.key, kind: o.kind, glyph: o.glyph, label, state: text, name: label + ", " + text, pressed: state.selected === o.key, below: !!p && p.below && o.kind === "body" });
  }
  return out;
}

const row = (layer, label, value) => ({ layer, label, value });
// the paragraph of an object that has no three-lens text: a compass point, the galactic centre, a depth ring
const plainParagraph = (o, stargazer) => {
  if (o.kind === "ring") return list(T("reading", stargazer ? "A ring of this map. A thing " + o.label + " away is drawn on it. Where the rings sit is our choice."
    : "A ring of this chart's depth scale: a thing " + o.label + " away is drawn on it. The scale is this project's choice."));
  if (o.core.frame === "gal") return list(T("checked", "The zero of galactic longitude: the direction towards the centre of the galaxy, a point on the rim of the galactic map."));
  return list(T("checked", stargazer ? "This is " + o.stargazer.toLowerCase() + " on your horizon: a mark on the edge of the flat map." : "The " + o.label.toLowerCase() + " of your horizon: a tick on the rim of the flat map."));
};
/**
 * inspector(state, key) -> what the inspector shows for an object, or null:
 *   { key, kind, title, glyph, status: { layer, note }, paragraph: [{ layer, text }] (for the state's lens),
 *     rows: [{ layer, label, value }] (computed position; measured distance with source and range; chart depth as READING),
 *     note (the uncertainty sentence when its badge is due, else "") }.
 */
export function inspector(state, key) {
  const o = objectOf(key), sky = skyOf(state);
  if (!o || !sky || !objectVisible(state, key)) return null;
  const lens = lensOf(state.lens), stargazer = lens === "stargazer", rows = [];
  const v = objectDirection(state, key), rho = objectRho(state, key);
  if (v && (o.kind === "body" || o.kind === "direction")) {
    if (stargazer) rows.push(row("checked", "Where to look", whereWords(state, key, sky)));
    else if (state.frame === "hor") {
      const hz = horFromDir(v), alt = key === "moon" ? sky.moon.alt : hz.alt;
      rows.push(row("checked", key === "moon" ? "Altitude (seen from your place)" : "Altitude", fixed(alt, 1) + "°" + (alt < 0 ? " (below the horizon)" : "")));
      if (Math.hypot(v[0], v[1]) >= 1e-9) rows.push(row("checked", "Direction round the horizon", fixed(hz.az, 1) + "° from north through east (" + compassPoint(hz.az) + ")"));
      else rows.push(row("checked", "Direction round the horizon", "straight up has no compass direction"));
    } else {
      const a = anglesFromDir(v);
      rows.push(row("checked", "Galactic longitude", fixed(a.lon, 2) + "°"), row("checked", "Galactic latitude", fixed(a.lat, 2) + "°"));
    }
  }
  if (key === "moon") {
    rows.push(row("checked", "Shape", moonWords(sky.phase.name, lens) + ", " + percent(sky.phase.illuminatedFraction) + " per cent lit"));
    rows.push(row("checked", "Age", fixed(sky.phase.ageDays, 1) + " days after new Moon"));
    if (!stargazer) rows.push(row("checked", "Elongation from the Sun", fixed(sky.phase.elongation, 1) + "°"));
    rows.push(row("checked", stargazer ? "How far" : "Distance", grouped(sky.moon.distanceKm) + " km (" + distanceWords(sky.moon.lightSeconds) + ")"));
  } else if (key === "sun") {
    if (!stargazer) rows.push(row("checked", "Ecliptic longitude", fixed(sky.sun.lambda, 2) + "°"));
    rows.push(row("checked", stargazer ? "The Sun's year" : "Season", seasonLine(state).text));
    rows.push(row("checked", stargazer ? "How far" : "Distance", distanceWords(sky.sun.lightSeconds) + (stargazer ? "" : " (" + fixed(sky.sun.distanceAu, 4) + " au)")));
  } else if (o.kind === "body") {
    const a = anchor(key);
    rows.push(row("said", stargazer ? "How far" : "Distance", "about " + distanceWords(a.distanceLy * LIGHT_SECONDS_PER_LY) + (stargazer ? "" : " (range used here: " + grouped(a.distanceRangeLy[0]) + " to " + grouped(a.distanceRangeLy[1]) + " light-years)")));
    if (key === "polaris") {
      const pd = sky.anchors.polaris.poleDistance;
      if (stargazer) rows.push(row("checked", "From the sky's turning point", fixed(pd, 1) + " degrees on this day"));
      else rows.push(row("checked", "Distance from the north celestial pole on this date", fixed(pd, 1) + "°" + (pd > 2 ? " (no pole star on this date)" : " (the pole star)")));
    }
  } else if (key === "cmb") {
    rows.push(row("said", stargazer ? "How far its source is now" : "Present distance of the matter that sent the light", fixed(CMB.comovingGly, 1) + " billion light-years"));
    if (!stargazer) rows.push(row("said", "Redshift", String(CMB.z)), row("said", "Time the light has travelled", fixed(CMB.lightTravelGyr, 2) + " billion years"));
  } else if (o.kind === "ring") {
    rows.push(row("reading", "Ring at", o.label));
  }
  if (Number.isFinite(rho) && !stargazer) rows.push(row("reading", "Depth on this chart", "disc radius " + fixed(Math.tanh(rho / 2), 2) + " (ρ = " + fixed(rho, 2) + ")"));
  else if (Number.isFinite(rho)) rows.push(row("reading", "On this map", Math.round(100 * Math.tanh(rho / 2)) + " per cent of the way to the edge"));
  else if (o.kind === "rim") rows.push(row("reading", stargazer ? "On this map" : "On this chart", stargazer ? "a point of the edge" : "a point of the rim"));
  const paragraph = o.text ? forLens(o.text, lens) : plainParagraph(o, stargazer);
  const badge = sky.uncertainty.badge && (key === "moon" || key === "sun");
  return { key, kind: o.kind, title: stargazer ? o.stargazer : o.label, glyph: o.glyph, status: o.status, paragraph, rows, note: badge ? sky.uncertainty.note : "" };
}

/** telemetry(state, size) -> the telemetry strip (Navigator and Holographer; [] at Stargazer and before a place is chosen): [{ key, layer, label, value }]. */
export function telemetry(state, size) {
  const sky = skyOf(state);
  if (!sky || lensOf(state.lens) === "stargazer") return [];
  const d = dateView(state), out = [];
  const add = (key, layer, label, value) => out.push({ key, layer, label, value });
  add("date", "checked", "Local date", d.text + ", " + d.clock + " local mean time");
  add("jd", "checked", "JD (UT)", fixed(state.jdUt, 5));
  add("deltaT", "checked", "ΔT ± σ", grouped(sky.deltaT) + " s ± " + fixed(sky.deltaTSigma, sky.deltaTSigma < 20 ? 1 : 0) + " s (the allowance is this project's)");
  add("lst", "checked", "Local sidereal time", formatClock(Math.min(sky.last / 15, 23.9999)));
  add("sun", "checked", "Sun longitude", fixed(sky.sun.lambda, 2) + "°");
  add("moon", "checked", "Moon elongation", fixed(sky.phase.elongation, 2) + "°");
  const dist = viewDistance(state);
  add("view", "checked", "View distance from home", fixed(dist, 2) + " (disc radius " + fixed(Math.tanh(dist / 2), 3) + ")");
  let factor = "nothing selected";
  if (state.selected && objectVisible(state, state.selected)) {
    const p = objectPoint(state, state.selected);
    if (p && p.point) { const s = screenPoint(state, geometryOf(size || { w: 400, h: 400 }, state.dims), p.point); factor = fixed(conformalFactor(s.ball), 2); }
    else factor = "without bound (a point of the rim)";
  }
  add("conformal", "checked", "Conformal factor 2 / (1 − |w|²) at the selected point's present position on screen", factor);
  return out;
}

/** placeReadout(state) -> what the Earth step shows, as rows { layer, label, value } for the state's lens ([] before a place is chosen): the zenith's place among the stars (declination = latitude, right ascension = local sidereal time), the pole's altitude, Polaris's distance from the pole on that date. */
export function placeReadout(state) {
  const sky = skyOf(state);
  if (!sky) return [];
  const pd = sky.anchors.polaris.poleDistance, south = state.site.lat < 0;
  if (lensOf(state.lens) === "stargazer") return [
    row("checked", "Your place", state.site.label),
    row("checked", "The sky turns round a point", "It is " + fixed(Math.abs(sky.poleAltitude), 0) + " degrees up, in the " + (south ? "south." : "north.")),
    row("checked", "Polaris", south ? "It is near the other turning point, below your ground." : "It is " + fixed(pd, 1) + " degrees from that point on this day."),
  ];
  return [
    row("checked", "Place", state.site.label + " (" + placeWords(state.site) + ")"),
    row("checked", "Zenith: declination (your latitude)", fixed(sky.zenith.dec, 2) + "°"),
    row("checked", "Zenith: right ascension (your local sidereal time)", formatClock(Math.min(sky.zenith.ra / 15, 23.9999)) + " (" + fixed(sky.zenith.ra, 2) + "°)"),
    row("checked", "Altitude of the north celestial pole", fixed(sky.poleAltitude, 2) + "°"),
    row("checked", "Polaris from the pole on this date", fixed(pd, 1) + "°" + (pd > 2 ? " (no pole star on this date)" : "")),
  ];
}
/** dayReadout(state) -> what the Sun and Moon step shows about the day, as rows { layer, label, value } for the state's lens ([] before a place is chosen): the local date, the Sun's ecliptic longitude (Navigator up), the days from the nearest equinox or solstice, and the uncertainty note when its badge is due. */
export function dayReadout(state) {
  const sky = skyOf(state);
  if (!sky) return [];
  const d = dateView(state), stargazer = lensOf(state.lens) === "stargazer", out = [];
  out.push(row("checked", stargazer ? "The day at your place" : "Local date", d.weekday + " " + d.text + (stargazer ? "" : ", " + d.clock + " local mean time")));
  if (!stargazer) out.push(row("checked", "Sun: ecliptic longitude", fixed(sky.sun.lambda, 2) + "°"));
  out.push(row("checked", stargazer ? "The Sun's year" : "Season", seasonLine(state).text));
  if (sky.uncertainty.badge) out.push(row("reading", stargazer ? "How sure" : "Uncertainty", stargazer ? "So long ago, the Moon's place is a little unsure." : sky.uncertainty.note));
  return out;
}

// ─── 6. the view: projection, dives, flights, drags ──────────────────────────

/** VIEW: constants of the view: margin (px round the disc), ball (R3 / R), near (labels and detail within this hyperbolic distance), rimCut (centres beyond this share of the radius are not labelled), maxC (how far a drag may take the 2D view), nudge (one press), rimRho (as far as a dive goes), flightMs. */
export const VIEW = freeze({ margin: 18, ball: 0.92, near: 1.5, rimCut: 0.985, maxC: 0.97, nudge: 0.4, rimRho: CMB_RING.rho, flightMs: 600 });
/** geometryOf(size, dims) -> { w, h, cx, cy, R, R3 }: the disc on a canvas of CSS size { w, h }; R3 = 0.92 R is the outline of the ball in 3D. */
export function geometryOf(size, dims) {
  const w = isNum(size && size.w) && size.w > 0 ? size.w : 400, h = isNum(size && size.h) && size.h > 0 ? size.h : w;
  const R = Math.max(10, Math.min(w, h) / 2 - VIEW.margin);
  return { w, h, cx: w / 2, cy: h / 2, R, R3: VIEW.ball * R, r: dims === "3D" ? VIEW.ball * R : R };
}
/** viewMatrix(state) -> the Lorentz matrix of the view: centreOn(c) in 2D, orbit · view3 in 3D. */
export const viewMatrix = (state) => (state.dims === "3D" ? lmul(state.orbit, state.view3) : centreOn([state.c[0], state.c[1], 0]));
const project = (M, g, flat, hp) => {
  const b = toBall(lapply(M, hp));
  return flat ? { x: g.cx + g.R * b[0], y: g.cy - g.R * b[1], z: 0, k: 1, ball: [b[0], b[1], 0] }
    : { x: g.cx + g.R3 * b[0], y: g.cy - g.R3 * b[1], z: b[2], k: 1 + 0.25 * b[2], ball: b };
};
const projectRim = (M, g, flat, n) => {
  const b = skyImage(M, n).n;
  return flat ? { x: g.cx + g.R * b[0], y: g.cy - g.R * b[1], z: 0, k: 1, ball: [b[0], b[1], 0] }
    : { x: g.cx + g.R3 * b[0], y: g.cy - g.R3 * b[1], z: b[2], k: 1 + 0.25 * b[2], ball: b };
};
/** screenPoint(state, geometry, hp) -> { x, y, z, k, ball }: a chart point on the canvas (2D: z = 0, k = 1; 3D: orthographic, k = 1 + 0.25 z scales dot size and opacity). */
export const screenPoint = (state, g, hp) => project(viewMatrix(state), g, state.dims !== "3D", hp);
const viewCentre = (state) => (state.dims === "3D" ? lapply(linv(state.view3), ORIGIN) : fromBall([state.c[0], state.c[1], 0]));
/** viewDistance(state) -> the hyperbolic distance of the view's centre from home. */
export const viewDistance = (state) => hypDist(viewCentre(state), ORIGIN);
/** targetOf(state, key, half) -> the chart point a dive brings to the centre: the object (or the midpoint between home and it when half); a point of the rim is approached as far as the microwave-background shell; null when the object is not shown. */
export function targetOf(state, key, half) {
  if (!objectVisible(state, key)) return null;
  const p = objectPoint(state, key);
  if (!p) return null;
  if (p.centreDot) return ORIGIN.slice();
  const rho = Number.isFinite(p.rho) ? p.rho : VIEW.rimRho;
  return chartPoint(p.dir, half ? rho / 2 : rho);
}
const centredOn = (state, hp) => {
  const b = toBall(hp);
  return state.dims === "3D" ? { ...state, view3: centreOn(b) } : { ...state, c: [b[0], b[1]] };
};
/** retarget(state) -> the state with its view following the centred object (after the time, the place, the frame or the dims changed); a free view stays. */
export function retarget(state) {
  if (!state.centred) return state;
  const hp = targetOf(state, state.centred.key, state.centred.half);
  if (!hp) return tidy({ ...state, centred: null, c: [0, 0], view3: IDENT.slice() });
  return centredOn(state, hp);
}
/** goHome(state) -> the state with home at the centre. */
export const goHome = (state) => tidy({ ...state, centred: null, c: [0, 0], view3: IDENT.slice() });
/** dive(state, key) -> the state after one press: the first press on an object selects it and centres the midpoint between home and it ("half way"), the second centres the object. key may be "home" or "rim" (the microwave-background shell towards the selection, or towards the zenith). */
export function dive(state, key) {
  if (key === "home") return goHome(state);
  const k = key === "rim" ? "cmb" : key, o = objectOf(k);
  if (!o || o.kind === "ring" || !objectVisible(state, k)) return state;
  const same = state.centred && state.centred.key === k;
  const next = { ...select(state, k), centred: { key: k, half: same ? false : true } };
  return retarget(next);
}
const geodesicPoint = (a, b, t) => {
  const d = hypDist(a, b);
  if (d < 1e-9) return b.slice();
  const sd = Math.sinh(d), wa = Math.sinh((1 - t) * d) / sd, wb = Math.sinh(t * d) / sd;
  return [0, 1, 2, 3].map((i) => wa * a[i] + wb * b[i]);
};
/** flightPlan(from, to) -> { ms, distance, at(t) -> { c, view3 } }: the flight between two states' views along the straight line of the curved map (t from 0 to 1; at most 600 ms; ms 0 when the dims differ or nothing moves). Draw scene({ ...to, ...plan.at(t) }). */
export function flightPlan(from, to) {
  const a = viewCentre(from), b = viewCentre(to), distance = hypDist(a, b);
  const jump = from.dims !== to.dims || distance < 1e-9;
  const at = (t) => {
    const u = clamp(t, 0, 1), e = u * u * (3 - 2 * u);                 // ease in and out
    const p = toBall(jump || u >= 1 ? b : geodesicPoint(a, b, e));
    return to.dims === "3D" ? { c: to.c, view3: u >= 1 ? to.view3 : centreOn(p) } : { c: u >= 1 ? to.c : [p[0], p[1]], view3: to.view3 };
  };
  return { ms: jump ? 0 : Math.round(Math.min(VIEW.flightMs, 240 + 140 * distance)), distance, at };
}
/** orbitDrag(orbit, dx, dy) -> the 3D rotation after a drag of dx, dy pixels (a drag in 3D changes only the orbit). */
export const orbitDrag = (orbit, dx, dy) => lmul(lmul(rotY(dx * 0.01), rotX(dy * 0.01)), orbit);
/** orbitTurn(orbit, direction, step = 0.3) -> the 3D rotation after one press of a turn button ("left" | "right" | "up" | "down"). */
export function orbitTurn(orbit, direction, step = 0.3) {
  const R = direction === "left" ? rotY(-step) : direction === "right" ? rotY(step) : direction === "up" ? rotX(-step) : direction === "down" ? rotX(step) : IDENT;
  return lmul(R, orbit);
}
/** dragView(state, size, from, to) -> the state after a drag from one canvas point to another ({ x, y } in CSS pixels): in 2D the grabbed point of the map follows the pointer exactly and the view never turns; in 3D only the orbit changes. */
export function dragView(state, size, from, to) {
  if (state.dims === "3D") return { ...state, orbit: orbitDrag(state.orbit, to.x - from.x, to.y - from.y) };
  const g = geometryOf(size, "2D");
  const unit = (p, cap) => { let x = (p.x - g.cx) / g.R, y = -(p.y - g.cy) / g.R; const r = Math.hypot(x, y); if (r > cap) { x *= cap / r; y *= cap / r; } return [x, y]; };
  const s0 = unit(from, 0.95), s1 = unit(to, 0.95);
  const z = toBall(lapply(linv(viewMatrix(state)), fromBall([s0[0], s0[1], 0])));
  let c = dragCentre([z[0], z[1]], s1);
  const r = Math.hypot(c[0], c[1]);
  if (!(r < 1)) return state;
  if (r > VIEW.maxC) c = [c[0] * VIEW.maxC / r, c[1] * VIEW.maxC / r];
  return { ...state, c, centred: null };
}
const NUDGES = freeze({ up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] });
/** nudgeView(state, direction, step = 0.4) -> the state with the view moved one step "up" | "down" | "left" | "right" on the screen (the four nudge buttons: the view moves without dragging). */
export function nudgeView(state, direction, step = VIEW.nudge) {
  const u = NUDGES[direction];
  if (!u) return state;
  if (state.dims === "3D") {
    const w = lapply(linv(state.orbit), [u[0], u[1], 0, 0]);
    return { ...state, centred: null, view3: lmul(boostAlong([-w[0], -w[1], -w[2]], step), state.view3) };
  }
  const M = lmul(boostAlong([-u[0], -u[1], 0], step), viewMatrix(state));
  let c = toBall(lapply(linv(M), ORIGIN));
  const r = Math.hypot(c[0], c[1]);
  if (r > VIEW.maxC) c = [c[0] * VIEW.maxC / r, c[1] * VIEW.maxC / r];
  return { ...state, centred: null, c: [c[0], c[1]] };
}

const HUD_COPY = freeze({
  stargazer: T("checked", "The map slid in a straight line."),
  rim: T("checked", "The edge can never reach the middle. This is as far as the map goes."),
  flat: T("checked", "this view is the slide T_c that brings the chosen point to the centre, a member of PSU(1,1); going from one such view to another is a slide and a turn"),
  ball: T("checked", "a move of the ball: the 6-parameter group PSL(2,C) acts here"),
  boost: T("reading", "As a Lorentz transformation this is a boost of rapidity d. It acts physically on directions. Depth is this chart's own scale and has no Lorentz meaning."),
  halfWay: T("checked", "half way"),
});
/** hud(state) -> { lines: [{ layer, text }], distance, halfWay }: the HUD of the chart for the state's lens and dims (exact wording of the Dive step). */
export function hud(state) {
  const lens = lensOf(state.lens), distance = viewDistance(state), lines = [];
  const halfWay = !!state.centred && state.centred.half;
  if (halfWay) lines.push(HUD_COPY.halfWay);
  if (lens === "stargazer") {
    if (distance > 1e-9) lines.push(HUD_COPY.stargazer);
    const o = state.centred && !state.centred.half ? objectOf(state.centred.key) : null;
    if (o && (o.kind === "rim" || o.kind === "direction") && distance > 1e-9) lines.push(HUD_COPY.rim);
    return { lines, distance, halfWay };
  }
  lines.push(state.dims === "3D" ? HUD_COPY.ball : HUD_COPY.flat);
  lines.push(T("checked", "the view's centre is " + fixed(distance, 2) + " from home (disc radius " + fixed(Math.tanh(distance / 2), 3) + ")"));
  const ab = aberrationReadout(state);
  if (ab) lines.push(T("checked", ab.text), HUD_COPY.boost);
  return { lines, distance, halfWay };
}
const MARK_ANGLES_DEG = freeze([20, 140, 260, 75]);
const toZeta = (n, south) => (south ? [n[0] / (1 + n[2]), -n[1] / (1 + n[2])] : [n[0] / (1 - n[2]), n[1] / (1 - n[2])]);
const fromZeta = (z, south) => { const m = z[0] * z[0] + z[1] * z[1]; return south ? [2 * z[0] / (1 + m), -2 * z[1] / (1 + m), (1 - m) / (1 + m)] : [2 * z[0] / (m + 1), 2 * z[1] / (m + 1), (m - 1) / (m + 1)]; };
/**
 * threePoints(state) -> the read-out "Three points of the rim fix the fourth" (Navigator and Holographer; null at Stargazer):
 *   { marks: [{ label, fromDeg, to (unit vector after the view) }] (three marked rim points and a fourth), predicted and actual
 *     ({ lonDeg, latDeg } of the fourth after the view: predicted by mobiusFromThree from the other three), errorDeg, layer, text }.
 * The rim is read as the complex plane (stereographic); a view acts on it as a Möbius map.
 */
export function threePoints(state) {
  if (lensOf(state.lens) === "stargazer") return null;
  const M = state.dims === "3D" ? state.view3 : centreOn([state.c[0], state.c[1], 0]);
  const from = MARK_ANGLES_DEG.map((a) => [Math.cos(a * RAD), Math.sin(a * RAD), 0]);
  const to = from.map((n) => skyImage(M, n).n);
  const south = to.some((n) => n[2] > 0.9);
  const zs = from.map((n) => toZeta(n, true)), ws = to.map((n) => toZeta(n, south));
  let predicted;
  try { predicted = fromZeta(mobiusFromThree(zs.slice(0, 3), ws.slice(0, 3))(zs[3]), south); } catch { return null; }
  const angles = (n) => { const a = anglesFromDir(n); return { lonDeg: a.lon, latDeg: a.lat }; };
  const a = predicted, b = to[3], cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const errorDeg = Math.atan2(Math.hypot(cross[0], cross[1], cross[2]), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / RAD;
  const p = angles(predicted), q = angles(to[3]);
  const say = (a) => fixed(a.lonDeg, 1) + "°" + (state.dims === "3D" ? " round, " + fixed(a.latDeg, 1) + "° up" : "");
  return {
    marks: from.map((n, i) => ({ label: "ABCD"[i], fromDeg: MARK_ANGLES_DEG[i], to: to[i] })),
    predicted: p, actual: q, errorDeg, layer: "checked",
    text: "Three points of the rim fix the fourth: A, B and C moved, so D must be at " + say(p) + ". It is at " + say(q) + ".",
  };
}
/**
 * aberrationReadout(state) -> at the Holographer lens in 3D after a dive of rapidity d (else null):
 *   { d, beta (tanh d), of (the object whose rim point is followed: the selection, or a pole or axis of the frame when the selection is the point dived to),
 *     beforeDeg, afterDeg (the angle of that rim point from the dive axis before and after, from aberrate), layer, text }.
 */
export function aberrationReadout(state) {
  if (lensOf(state.lens) !== "holographer" || state.dims !== "3D") return null;
  const p = toBall(viewCentre(state)), r = Math.hypot(p[0], p[1], p[2]), d = 2 * Math.atanh(r);
  if (!(d > 1e-6)) return null;
  const u = [p[0] / r, p[1] / r, p[2] / r];
  const angleFrom = (n) => Math.acos(clamp(n[0] * u[0] + n[1] * u[1] + n[2] * u[2], -1, 1));
  // the selected rim point; when that is the point dived to (angle 0 before and after), the frame's pole or its first axis instead
  const tries = [state.selected, state.rimOf, state.frame === "hor" ? "zenith" : "ngp", state.frame === "hor" ? "north" : "galactic_centre"];
  const key = tries.find((k) => { const n = k && objectOf(k) ? objectDirection(state, k) : null; return !!n && angleFrom(n) > 1e-3; });
  if (!key) return null;
  const n = objectDirection(state, key), before = angleFrom(n);
  const after = Math.PI - aberrate(Math.PI - before, d);
  const beta = Math.tanh(d);
  return {
    d, beta, of: key, beforeDeg: before / RAD, afterDeg: after / RAD, layer: "checked",
    text: "β = tanh d = " + fixed(beta, 4) + " for d = " + fixed(d, 2) + "; the rim point of " + objectOf(key).label + " was " + fixed(before / RAD, 1) + "° from the dive axis and is now " + fixed(after / RAD, 1) + "° from it",
  };
}

// ─── 7. the scene: the drawables of the chart, as plain data ─────────────────

/** LABEL: constants of label placement: clear (px between a new label's dot and every labelled dot), height, pad, gap, charWidth (the estimate used when no measure function is given), cluster (px), font (px, never scaled with the geometry), markRoom (px kept free round a mark A to D, for the mark and its letter). */
export const LABEL = freeze({ clear: 28, height: 18, pad: 4, gap: 6, charWidth: 7.4, cluster: 22, font: 13, markRoom: 12 });
const overlap = (a, b) => a.x < b.x + b.w + 2 && b.x < a.x + a.w + 2 && a.y < b.y + b.h + 2 && b.y < a.y + a.h + 2;
/**
 * placeLabels(items, options) -> { labels, dots }. items: [{ key, text, x, y, r, forced }] in order of priority (forced ones first:
 * the centred object and home are always labelled). A label is placed only if its dot is at least options.clear px (28) from every dot
 * already labelled, its box overlaps no box already placed, and its box covers no other item's dot and no point of options.avoid;
 * it is tried to the right, left, above and below its dot (a forced one at the four corners too). A forced label that finds no such
 * place takes the one, free of other boxes, that covers the fewest dots: it alone may lie over a dot, and it is listed in covering.
 * The rest are dots.
 * options: { w, h (canvas size), clear, measure(text) -> px, avoid: [{ x, y, r }] (points no box may cover: the marks A to D) }.
 * labels: [{ key, text, x, y, w, h, ax, ay }] (box corner and anchor); covering: keys of the forced labels that lie over a dot.
 */
export function placeLabels(items, options = {}) {
  const W = isNum(options.w) ? options.w : Infinity, H = isNum(options.h) ? options.h : Infinity;
  const clear = isNum(options.clear) ? options.clear : LABEL.clear;
  const measure = typeof options.measure === "function" ? options.measure : (text) => [...text].length * LABEL.charWidth;
  const labels = [], dots = [], covering = [];
  const points = [];                                                    // every drawn dot (an item with a radius) and every point to keep clear
  for (const it of items) if (it && isNum(it.x) && isNum(it.y) && isNum(it.r) && it.r > 0) points.push({ key: it.key, x: it.x, y: it.y, m: it.r + 1 });
  for (const a of Array.isArray(options.avoid) ? options.avoid : []) if (a && isNum(a.x) && isNum(a.y)) points.push({ key: null, x: a.x, y: a.y, m: (isNum(a.r) ? a.r : 4) + 1 });
  const covered = (b, own) => points.filter((d) => (d.key === null || d.key !== own) && d.x > b.x - d.m && d.x < b.x + b.w + d.m && d.y > b.y - d.m && d.y < b.y + b.h + d.m).length;
  for (const it of items) {
    if (!it || typeof it.text !== "string" || it.text === "" || !isNum(it.x) || !isNum(it.y)) { if (it && it.key) dots.push(it.key); continue; }
    const text = cutLabel(it.text), w = Math.ceil(measure(text)) + 2 * LABEL.pad, h = LABEL.height, r = isNum(it.r) ? it.r : 4;
    const far = it.forced || labels.every((l) => Math.hypot(l.ax - it.x, l.ay - it.y) >= clear);
    let box = null, over = false;
    if (far) {
      const right = it.x + r + LABEL.gap, left = it.x - r - LABEL.gap - w, above = it.y - r - LABEL.gap - h, under = it.y + r + LABEL.gap;
      const sides = [[right, it.y - h / 2], [left, it.y - h / 2], [it.x - w / 2, above], [it.x - w / 2, under]];
      if (it.forced) sides.push([right, above], [right, under], [left, above], [left, under]);          // a label that must be shown also tries the four corners
      const tries = sides.map(([tx, ty]) => ({ x: clamp(tx, 2, Math.max(2, W - w - 2)), y: clamp(ty, 2, Math.max(2, H - h - 2)), w, h }))
        .filter((b) => labels.every((l) => !overlap(l, b)));
      box = tries.find((b) => covered(b, it.key) === 0) || null;
      if (!box && it.forced && tries.length > 0) { box = tries.reduce((best, b) => (covered(b, it.key) < covered(best, it.key) ? b : best)); over = true; }   // then the place that covers fewest
    }
    if (box) { labels.push({ key: it.key, text, x: box.x, y: box.y, w, h, ax: it.x, ay: it.y }); if (over) covering.push(it.key); }
    else dots.push(it.key);
  }
  return { labels, dots, covering };
}

const RAY_RHOS = freeze(Array.from({ length: 33 }, (_, i) => i * 0.25));
const detailOf = (state, o, sky) => {
  if (o.key === "moon") return percent(sky.phase.illuminatedFraction) + " per cent lit";
  if (o.key === "sun") return seasonLine(state).text;
  if (o.kind === "body") return "about " + distanceWords(anchor(o.key).distanceLy * LIGHT_SECONDS_PER_LY);
  if (o.key === "cmb") return fixed(CMB.comovingGly, 1) + " billion light-years";
  return o.kind === "rim" ? o.status.note : "";
};
const finite = (p) => isNum(p.x) && isNum(p.y) && isNum(p.z);

/** sceneCaption(state) -> the visible caption under the chart for the state's lens, frame and dims (the canvas is described by it). */
export function sceneCaption(state) {
  if (!state.site) return "The map is dark: one dot, where you stand. Choose a place to light it.";
  const frame = FRAME_CHOICES.find((f) => f.key === state.frame), stargazer = lensOf(state.lens) === "stargazer";
  if (state.dims === "3D") return stargazer ? "This is the same map as a ball, seen from outside. Straight up is a line. The edge is the sky of directions."
    : "the same chart as a ball seen from outside: each great circle is drawn on it, and straight up is a line; the rim is the sphere of directions";
  return stargazer ? frame.stargazer : frame.caption + "; the rim is " + frame.own;
}
// How each object is named inside a sentence: [at the Stargazer lens, from Navigator up]. The list names have no article ("Moon",
// "North point"); a sentence needs one where English does ("the Moon", "the north point"), and a small first letter for a common name.
const SPOKEN = freeze({
  moon: list("the Moon", "the Moon"), sun: list("the Sun", "the Sun"), pleiades: list("the Pleiades", "the Pleiades"), polaris: list("Polaris", "Polaris"),
  vela_pulsar: list("the Vela pulsar", "the Vela pulsar"), cyg_x1: list("Cygnus X-1", "Cygnus X-1"), sgr_a_star: list("the middle of our galaxy", "Sagittarius A*"),
  m31: list("the Andromeda galaxy", "the Andromeda galaxy"),
  zenith: list("the point straight up", "the zenith"), north: list("the north", "the north point"), east: list("the east", "the east point"),
  south: list("the south", "the south point"), west: list("the west", "the west point"),
  galactic_centre: list("the galaxy's middle", "the galactic centre (longitude 0°)"), ngp: list("the north galactic pole", "the north galactic pole"),
  celestial_sphere: list("the sky of directions", "the celestial sphere"), antipode: list("the opposite point", "the opposite point"),
  holography: list("a bold idea about the edge", "celestial holography"), shadow: list("the shadow transform", "the shadow transform"),
  memory: list("a ripple that stays", "gravitational-wave memory"), cmb: list("the oldest light", "the cosmic microwave background"),
});
const SPOKEN_PLURAL = freeze(["pleiades"]);                               // "The Pleiades are …"
const spoken = (o, lens) => {
  const forms = SPOKEN[o.key], stargazer = lensOf(lens) === "stargazer";
  return forms ? forms[stargazer ? 0 : 1] : (stargazer ? o.stargazer : o.label).replace(/^(The|A) /, (m) => m.toLowerCase());
};
/** centreWords(state) -> one sentence about the middle of the map once the view has left home, "" at home: "The Andromeda galaxy is in the middle of the map." (a thing with a depth, brought to the centre), "Half way to the Moon is in the middle of the map." (the first press), "The map has slid towards the north." (a direction or a point of the rim, which never reaches the middle), "The map has slid: home is no longer in the middle." (a nudge, a drag or a tap on an empty point). Each object is named as a sentence names it: with its article where English needs one. */
export function centreWords(state) {
  if (!state.site || state.lab.open || viewDistance(state) < 1e-9) return "";
  const o = state.centred ? objectOf(state.centred.key) : null;
  if (!o) return "The map has slid: home is no longer in the middle.";
  const name = spoken(o, state.lens);
  if (o.kind !== "body" && o.key !== "cmb") return "The map has slid towards " + name + ".";
  return state.centred.half ? "Half way to " + name + " is in the middle of the map." : capital(name) + (SPOKEN_PLURAL.includes(o.key) ? " are" : " is") + " in the middle of the map.";
}
/**
 * chartCaption(state, said) -> the whole caption under the chart, which is also the canvas's description: sceneCaption(state), then what
 * the chart last reported ({ rimLabel, centreCaption } of scene()), then centreWords(state). A part the caption already holds is not said
 * twice (the 2D caption of Navigator names the rim itself), and each part ends with a full stop.
 */
export function chartCaption(state, said = {}) {
  let text = sceneCaption(state);
  if (!state.site) return text;
  for (const extra of [said.rimLabel, said.centreCaption, centreWords(state)]) {
    if (typeof extra !== "string") continue;
    const bare = extra.replace(/[.\s]+$/, "");
    if (bare === "" || text.toLowerCase().includes(bare.toLowerCase())) continue;
    text = text.replace(/[.\s]+$/, "") + ". " + capital(bare) + ".";
  }
  return text;
}

/**
 * scene(state, size, options) -> the drawables of the chart for the state's frame, dims and view, as plain data in CSS pixels:
 *   { w, h, cx, cy, R, R3, r (the radius of the outline), dims, frame, dark (no place yet), diving,
 *     outline: { x, y, r }, rimLabel (2D: the frame's own circle is the rim),
 *     rings:   [{ key, label, rho, points: [{ x, y, z }] }]             closed curves; in 3D each is its circle in the frame's plane
 *     circles: [{ key, label, own, points: [{ x, y, z }] }]             3D: great circles on the rim, 96 points each (z < 0 is the far half)
 *     rays:    [{ key, kind ("crossing" | "sight" | "axis"), label, points: [{ x, y, z }] }]
 *     ticks:   [{ key, label, x, y, z }]                                2D: where another great circle crosses the map's plane, on the rim
 *     bodies:  [{ key, kind, glyph, label, short, detail, x, y, z, k, r, hollow, below, selected, centred, near, atRim, centreDot, nominal, edge, layer, dist }] in paint order
 *     marks:   [{ label, x, y, z }]                                     the four rim points of threePoints() (Dive step, Navigator up)
 *     home: { x, y, z, k }, labels, dots (keys without a label), clusters: [{ x, y, count, keys }], hits: [{ key, x, y, r }] (paint order),
 *     caption, centreCaption ("straight up has no compass direction" when the dot at the centre of the screen is a direction: only while the
 *     view is at home; after a slide another thing is at the centre), covering (keys of the forced labels that lie over another dot: the chart
 *     paints those dots again, over the plates), skipped (objects with no finite place) }.
 * options: { measure(text) -> px } for label widths. Paint order in 3D: outline; far halves of circles at 35 % opacity; rings; rays and
 * bodies (sorted by z ascending); near halves; labels.
 */
export function scene(state, size, options = {}) {
  const g = geometryOf(size, state.dims), flat = state.dims !== "3D", M = viewMatrix(state), sky = skyOf(state);
  const lens = lensOf(state.lens), stargazer = lens === "stargazer";
  const at = (hp) => project(M, g, flat, hp), atRim = (n) => projectRim(M, g, flat, n);
  const home = at(ORIGIN), diving = viewDistance(state) > 1e-9;
  const out = {
    ...g, dims: state.dims, frame: state.frame, dark: !sky || !state.lit.place, diving,
    outline: { x: g.cx, y: g.cy, r: g.r }, rimLabel: "", rings: [], circles: [], rays: [], ticks: [], bodies: [], marks: [],
    home: { x: home.x, y: home.y, z: home.z, k: home.k }, labels: [], dots: [], clusters: [], hits: [],
    caption: sceneCaption(state), centreCaption: "", covering: [], skipped: 0,
  };
  const candidates = [{ key: "home", text: stargazer ? "You" : "Home", x: home.x, y: home.y, r: 5, forced: true }];
  if (out.dark) { const placedDark = placeLabels(candidates, { w: g.w, h: g.h, measure: options.measure }); out.labels = placedDark.labels; return out; }

  // depth rings
  for (const ring of RINGS) {
    const key = ring.key === CMB_RING.key ? "cmb" : ring.key;
    const shown = key === "cmb" ? objectVisible(state, "cmb") && (state.overlays.rings || !!state.centred || diving || state.selected === "cmb") : objectVisible(state, key);
    if (!shown) continue;
    const points = [];
    for (let i = 0; i < 96; i++) { const a = (2 * Math.PI * i) / 96, p = at(chartPoint([Math.cos(a), Math.sin(a), 0], ring.rho)); points.push({ x: p.x, y: p.y, z: p.z }); }
    out.rings.push({ key: ring.key, label: ring.label, rho: ring.rho, points });
  }
  // great circles
  for (const ov of OVERLAYS) {
    if (!ov.circle || !state.overlays[ov.key]) continue;
    const label = stargazer ? ov.stargazer : ov.label;
    if (!flat) {
      out.circles.push({ key: ov.key, label, own: ov.circle === state.frame, points: circleDirections(ov.circle, state.frame, sky, 96).map((n) => { const p = atRim(n); return { x: p.x, y: p.y, z: p.z }; }) });
    } else if (ov.circle === state.frame) {
      out.rimLabel = "the rim is " + FRAME_CHOICES.find((f) => f.key === state.frame).own;
    } else {
      const nodes = circleNodes(ov.circle, state.frame, sky);
      if (!nodes) continue;
      nodes.forEach((n, i) => {
        out.rays.push({ key: ov.key + "-" + i, kind: "crossing", label, points: RAY_RHOS.map((rho) => { const p = at(chartPoint(n, rho)); return { x: p.x, y: p.y, z: p.z }; }) });
        const t = atRim(n);
        out.ticks.push({ key: ov.key + "-" + i, label: ov.words, x: t.x, y: t.y, z: t.z });
      });
    }
  }
  // objects
  const items = [];
  for (const o of OBJECTS) {
    if (o.kind === "ring" || !objectVisible(state, o.key)) continue;
    const p = objectPoint(state, o.key);
    if (!p) continue;
    const s = p.point ? at(p.point) : atRim(p.dir);
    if (!finite(s)) { out.skipped += 1; continue; }
    const dist = p.point ? hypDist(lapply(M, p.point), ORIGIN) : Infinity;
    const near = dist <= VIEW.near, selected = state.selected === o.key;
    const centred = !!state.centred && state.centred.key === o.key && !state.centred.half;
    const edge = !!p.point && Math.hypot(s.ball[0], s.ball[1], s.ball[2]) > VIEW.rimCut;
    const base = o.kind === "body" ? 5 : o.kind === "rim" ? 5 : 4;
    const name = stargazer ? o.stargazer : o.label;
    items.push({
      key: o.key, kind: o.kind, glyph: o.glyph, label: near || selected ? name : o.short, short: o.short, detail: near ? detailOf(state, o, sky) : "",
      x: s.x, y: s.y, z: s.z, k: s.k, r: (base + (selected ? 2 : 0)) * s.k, hollow: p.below && o.kind === "body", below: p.below, selected, centred, near,
      atRim: p.atRim, centreDot: p.centreDot, nominal: p.nominal, edge, layer: o.status.layer, dist,
    });
    if (p.centreDot && !diving) out.centreCaption = state.frame === "hor" ? "straight up has no compass direction" : "the pole has no direction round the plane";
    // straight up is a line of the ball; so is the pole of the galactic frame
    if (!flat && o.kind === "direction" && o.core.body) out.rays.push({ key: o.key + "-axis", kind: "axis", label: name, points: RAY_RHOS.map((rho) => { const q = at(chartPoint(p.dir, rho)); return { x: q.x, y: q.y, z: q.z }; }) });
    // sight lines: all bodies when switched on; during a dive always the one to the selected object
    const sight = (o.kind === "body" && state.overlays.sightLines) || (selected && diving && !p.centreDot);
    if (sight) {
      const reach = Number.isFinite(p.rho) ? p.rho : 8, n = Math.max(2, Math.ceil(reach / 0.25));
      out.rays.push({ key: o.key + "-sight", kind: "sight", label: name, points: Array.from({ length: n + 1 }, (_, i) => { const q = at(chartPoint(p.dir, (reach * i) / n)); return { x: q.x, y: q.y, z: q.z }; }) });
    }
  }
  const rank = { rim: 0, direction: 1, body: 2 };
  items.sort(flat ? (a, b) => rank[a.kind] - rank[b.kind] || b.dist - a.dist : (a, b) => a.z - b.z);
  out.bodies = items;
  out.hits = items.map((b) => ({ key: b.key, x: b.x, y: b.y, r: Math.max(6, b.r) }));
  // the four rim points of the read-out
  if (state.step === 4 && !stargazer) {
    const tp = threePoints(state);
    if (tp) out.marks = tp.marks.map((m) => { const n = flat ? m.to : skyImage(state.orbit, m.to).n; return { label: m.label, x: g.cx + g.r * n[0], y: g.cy - g.r * n[1], z: flat ? 0 : n[2] }; });
  }
  // labels: home and the centred (or selected) object always; the others by nearness to the centre
  const fromCentre = (b) => Math.hypot(b.x - g.cx, b.y - g.cy);
  const forced = items.filter((b) => b.centred || b.selected), others = items.filter((b) => !b.centred && !b.selected && !b.edge).sort((a, b) => fromCentre(a) - fromCentre(b));
  for (const b of forced) candidates.push({ key: b.key, text: b.label, x: b.x, y: b.y, r: b.r, forced: true });
  for (const b of others) candidates.push({ key: b.key, text: b.label, x: b.x, y: b.y, r: b.r, forced: false });
  for (const ring of out.rings) { const p = ring.points[12]; candidates.push({ key: "ring:" + ring.key, text: ring.label, x: p.x, y: p.y, r: 0, forced: false }); }
  for (const t of out.ticks) candidates.push({ key: "tick:" + t.key, text: t.label, x: t.x, y: t.y, r: 3, forced: false });
  // no plate may lie over another object's dot, nor over a mark A to D or the room for its letter
  const placedLabels = placeLabels(candidates, { w: g.w, h: g.h, measure: options.measure, avoid: out.marks.map((m) => ({ x: m.x, y: m.y, r: LABEL.markRoom })) });
  out.labels = placedLabels.labels;
  out.covering = placedLabels.covering;
  const objectKeys = new Set(items.map((b) => b.key));
  out.dots = [...placedLabels.dots.filter((k) => objectKeys.has(k)), ...items.filter((b) => b.edge && !b.centred && !b.selected).map((b) => b.key)];
  // clusters: dots that sit together get one count
  const loose = items.filter((b) => out.dots.includes(b.key)), used = new Set();
  for (const b of loose) {
    if (used.has(b.key)) continue;
    const group = loose.filter((q) => !used.has(q.key) && Math.hypot(q.x - b.x, q.y - b.y) <= LABEL.cluster);
    if (group.length < 2) continue;
    for (const q of group) used.add(q.key);
    out.clusters.push({ x: group.reduce((s, q) => s + q.x, 0) / group.length, y: group.reduce((s, q) => s + q.y, 0) / group.length, count: group.length, keys: group.map((q) => q.key) });
  }
  return out;
}

/**
 * sceneHit(scene, x, y, reach = 22) -> the key of the object a point picks, or null. A point inside drawn dots picks the
 * one painted last (hit-test in reverse paint order). A point that is on no dot picks the nearest object within reach
 * (an object within 22 px wins); of two equally near, the one painted last. So a tap on the Moon picks the Moon, also
 * where another object is drawn a few pixels away and in front of it.
 */
export function sceneHit(sc, x, y, reach = 22) {
  let near = null, best = Infinity;
  for (let i = sc.hits.length - 1; i >= 0; i--) {
    const hit = sc.hits[i], d = Math.hypot(hit.x - x, hit.y - y);
    if (d <= hit.r) return hit.key;
    if (d <= reach && d < best) { near = hit.key; best = d; }
  }
  return near;
}
/** tapView(state, size, x, y) -> { state, key }: a tap on the chart. An object within 22 px is selected and brought to the centre; otherwise, in 2D, the tapped point of the map comes to the centre; a tap outside the disc changes nothing. */
export function tapView(state, size, x, y) {
  const sc = scene(state, size), key = sceneHit(sc, x, y);
  if (key) return { state: retarget({ ...select(state, key), centred: { key, half: false } }), key };
  if (state.dims === "3D" || sc.dark) return { state, key: null };
  const sx = (x - sc.cx) / sc.R, sy = -(y - sc.cy) / sc.R;
  if (Math.hypot(sx, sy) >= 0.98) return { state, key: null };
  let c = toBall(lapply(linv(viewMatrix(state)), fromBall([sx, sy, 0])));
  const r = Math.hypot(c[0], c[1]);
  if (r > VIEW.maxC) c = [c[0] * VIEW.maxC / r, c[1] * VIEW.maxC / r];
  return { state: { ...state, centred: null, c: [c[0], c[1]] }, key: null };
}

// ─── 8. the Moon picture ─────────────────────────────────────────────────────

/** MOON_COPY: the fixed sentences round the Moon picture: check (the third question as a check, per lens), below, changesDay, findLabel. */
export const MOON_COPY = freeze({
  check: perLens(
    T("checked", "Does my Moon look like yours? If not, check three things in this order. First the place: north or south of the equator turns it over. Then the day. Then the time."),
    T("checked", "Does my Moon look like yours? If not, check three things in this order: the place (north or south of the equator turns it over), the day, the time.")),
  below: "The Moon is below the ground right now",
  changesDay: "This changes the day.",
  findLabel: "Find the next night with this Moon",
  computed: T("checked", "The Moon is computed from the date; you look up and check it."),
});
const leanWords = (deg) => "bright side towards " + limbClockHour(deg) + " o'clock";
/**
 * moonFigure(state) -> the Moon as it looks from the place, or null before the day is lit:
 *   { fraction (0..1 lit), percent, waxing, name (the phase name for the lens), ageDays, limbDeg (the middle of the bright limb, degrees from
 *     "up" towards the right; draw it at canvas offset (sin, −cos)), terminator (2·fraction − 1: the half-width of the terminator's ellipse
 *     along that direction, negative for a crescent), clock (1..12), lean ("bright side towards 4 o'clock" | ""), below (the Moon's
 *     altitude is below zero: dim the picture), label (for role=img), lines: [text], question: { layer, text } | null (not asked when below) }.
 */
export function moonFigure(state) {
  const sky = skyOf(state);
  if (!sky || !state.lit.day) return null;
  const lens = lensOf(state.lens), ph = sky.phase, pct = percent(ph.illuminatedFraction), below = sky.moon.alt < 0;
  const thin = ph.illuminatedFraction < 0.02 || ph.illuminatedFraction > 0.98;
  const lean = thin ? "" : leanWords(ph.brightLimbFromZenith);
  const name = moonWords(ph.name, lens, true);
  const lines = lens === "stargazer" ? [capital(name) + ".", pct + " per cent lit.", fixed(ph.ageDays, 1) + " days after new Moon."] : [name + ", " + pct + " per cent lit.", fixed(ph.ageDays, 1) + " days after new Moon."];
  if (lean) lines.push(capital(lean) + ".");
  if (below) lines.push(MOON_COPY.below + ".");
  return {
    fraction: ph.illuminatedFraction, percent: pct, waxing: ph.waxing, name, ageDays: ph.ageDays,
    limbDeg: ph.brightLimbFromZenith, terminator: 2 * ph.illuminatedFraction - 1, clock: limbClockHour(ph.brightLimbFromZenith), lean, below,
    label: below ? "The Moon now: below the horizon" : "The Moon now: " + pct + " per cent lit, " + (ph.waxing ? "growing" : "shrinking") + (lean ? ", " + lean : ""),
    lines, question: below ? null : forLens(MOON_COPY.check, lens),
  };
}
/** moonButtons(state) -> the eight Moon-shape buttons: [{ target, name, label (for the lens), fraction, terminator, waxing, limbDeg }]; the small pictures lean the same way as the large one. */
export function moonButtons(state) {
  const sky = skyOf(state), lens = lensOf(state.lens);
  const now = sky ? sky.phase.brightLimbFromZenith : 90, growing = sky ? norm360(now + (sky.phase.waxing ? 0 : 180)) : 90;
  return PHASE_TARGETS.map((p) => {
    const fraction = (1 - Math.cos(p.target * RAD)) / 2, waxing = p.target < 180;
    return { target: p.target, name: p.name, label: capital(moonWords(p.name, lens)), fraction, terminator: 2 * fraction - 1, waxing, limbDeg: waxing ? growing : norm360(growing + 180) };
  });
}

// ─── 9. the lab: "they turned not when they went" ────────────────────────────
// A walker that slides and never turns, on the curved map by itself (not the sky). A slide is { angle, dist }: the
// angle is in the walker's own fixed axes (forward 0, left π/2, back π, right −π/2).

const TILE = tilingConstants(4, 5);
function verseSliceOf(address, from, to) {                              // as verseSlice() of section 11, usable before that section is evaluated
  const r = ROWS.find((x) => x[0] === address && x[1] === "text" && x[2] === "verse");
  if (!r) return "";
  const a = r[4].indexOf(from), b = a < 0 ? -1 : r[4].indexOf(to, a);
  return a < 0 || b < 0 ? r[4] : r[4].slice(a, b + to.length);
}
/** LAB: constants of the lab: aMin, aMax, aMaxSmall (canvases under smallCanvas px), aDefault, directions (angle of each slide button), four (the order of "Four slides"), slideMs (one slide of the animation; four make at most 8 s), tile (the side of a {4,5} square), tileHeadingsDeg, five (the order of the challenge), fiveSide (rightAngledPolygonSide(5)), fiveTolerance, caption. */
export const LAB = freeze({
  aMin: 0.25, aMax: 1.5, aMaxSmall: 1.25, smallCanvas: 400, aDefault: 1,
  directions: freeze({ forward: 0, left: Math.PI / 2, back: Math.PI, right: -Math.PI / 2 }),
  four: freeze(["forward", "left", "back", "right"]), slideMs: 2000,
  tile: TILE.side, tileHeadingsDeg: freeze([0, 108, 216, 324]),
  five: freeze(["forward", "left", "back", "right", "forward"]), fiveSide: rightAngledPolygonSide(5), fiveTolerance: 0.005,
  caption: "This is the curved map by itself. It is not the sky.",
});
const LAB_VERSE = freeze({ layer: "text", text: verseSliceOf("26.1.9", "they turned", "went"), source: "26.1.9", name: "Ezekiel 1:9, King James Version" });
/** LAB_COPY: the words of the lab: title (TEXT: the lab is named with words of Ezekiel 1:9), open, close, slide (the four buttons), four, fourAtOnce (said in the status line where motion is reduced: one press draws all four), play, pause, next, home, again, step, tiling, tile, tileNote, challenge, flat, crosses (said in place of the area, after "Slide home", for a path that crosses itself). */
export const LAB_COPY = freeze({
  title: LAB_VERSE,
  open: "Open the lab", close: perLens("Back to the sky", "Leave the lab"),
  slide: freeze({ forward: "Slide forward", left: "Slide left", back: "Slide back", right: "Slide right" }),
  four: "Four slides", fourAtOnce: "All four slides were drawn at once.", play: "Play", pause: "Pause", next: "Next slide", home: "Slide home", again: "Start again",
  step: perLens("How long one step is", "Step length a"),
  tiling: perLens("Draw a floor of squares", "Draw the {4,5} tiling as the floor"),
  tile: "Slide round one tile",
  tileNote: T("checked", "On this floor five squares meet at every corner."),
  challenge: "Find the step that brings five slides home",
  flat: T("checked", "On a flat floor, forward, left, back and right bring you back home, not turned."),
  crosses: "Your path crosses itself, so it has no single inside to measure.",
});
/** labStart(a = 1) -> a fresh lab: { open: false, a, slides: [], home: false, tiling: false }. */
export function labStart(a = LAB.aDefault) {
  return { open: false, a: clamp(isNum(a) ? a : LAB.aDefault, LAB.aMin, LAB.aMax), slides: [], home: false, tiling: false };
}
/** openLab(state) -> the state with the lab's stage open (the sky objects and rings are cleared from view; the chart comes back on leaving). */
export const openLab = (state) => ({ ...state, lab: { ...state.lab, open: true } });
/** closeLab(state) -> the state with the chart restored. */
export const closeLab = (state) => ({ ...state, lab: { ...state.lab, open: false } });
/** labSlide(lab, direction) -> the lab after one slide of length a ("forward" | "left" | "back" | "right"); after "Slide home" a new slide starts a new path. */
export function labSlide(lab, direction) {
  const angle = LAB.directions[direction];
  if (angle === undefined) return lab;
  const slides = lab.home ? [] : lab.slides;
  return { ...lab, home: false, slides: [...slides, { angle, dist: lab.a, unit: true }] };
}
/** labNext(lab) -> the next direction of "Four slides" ("Next slide"), or null when the four are done or the path is another one. */
export function labNext(lab) {
  if (lab.home) return LAB.four[0];
  const n = lab.slides.length;
  if (n >= LAB.four.length) return null;
  return lab.slides.every((s, i) => s.unit && s.angle === LAB.directions[LAB.four[i]]) ? LAB.four[n] : null;
}
/** labFour(lab) -> the lab after all four slides (forward, left, back, right) from home. */
export const labFour = (lab) => LAB.four.reduce((l, d) => labSlide(l, d), { ...lab, slides: [], home: false });
/** labTile(lab) -> the lab after "Slide round one tile": four slides of 1.253739 at headings 0°, 108°, 216°, 324°, with the {4,5} floor switched on. */
export const labTile = (lab) => ({ ...lab, home: false, tiling: true, slides: LAB.tileHeadingsDeg.map((d) => ({ angle: d * RAD, dist: LAB.tile, unit: false })) });
/** labFrames(lab) -> the frames of the walker: slidePath(lab.slides), starting with the identity. */
export const labFrames = (lab) => slidePath(lab.slides);
/** labHome(lab) -> the lab after "Slide home": one straight slide back to the start (nothing is added when the walker is already home). */
export function labHome(lab) {
  if (lab.home) return lab;
  const frames = labFrames(lab), F = frames[frames.length - 1], hc = homecoming(F);
  if (hc.distance < 1e-9) return { ...lab, home: true };
  const w = lapply(linv(F), ORIGIN);                                   // home, seen in the walker's own axes
  return { ...lab, home: true, slides: [...lab.slides, { angle: Math.atan2(w[1], w[0]), dist: hc.distance, unit: false, home: true }] };
}
/** labSetA(lab, a, small) -> the lab with another step length (0.25 to 1.5; to 1.25 on a canvas under 400 px); slides made with the buttons are rescaled and a slide home is taken back. */
export function labSetA(lab, a, small) {
  const v = clamp(isNum(a) ? a : lab.a, LAB.aMin, small ? LAB.aMaxSmall : LAB.aMax);
  return { ...lab, a: v, home: false, slides: lab.slides.filter((s) => !s.home).map((s) => (s.unit ? { ...s, dist: v } : s)) };
}
/** labReset(lab) -> "Start again": no slides, the same step and floor. */
export const labReset = (lab) => ({ ...lab, slides: [], home: false });
/** labToggleTiling(lab) -> the lab with the {4,5} floor switched on or off. */
export const labToggleTiling = (lab) => ({ ...lab, tiling: !lab.tiling });
const ZERO_TURN = 0.05 * RAD;                                            // a turn under 0.05 degrees is no turn (rounding leaves about 1e-9)
const unturned = (clockwise) => clockwise < ZERO_TURN || clockwise > 2 * Math.PI - ZERO_TURN;
const turnWords = (clockwise) => {
  const deg = clockwise / RAD;
  return deg <= 180 ? fixed(deg, 0) + " degrees to the right" : fixed(360 - deg, 0) + " degrees to the left";
};
const AREA_REACH = 12;                                                   // as for the turn: farther out binary64 has too few digits left
const AREA_EPS = 1e-9;                                                   // an angle (its sine) under this is no angle; also the slack of "between", in Klein units
const AREA_NOISE = 1e-14;                                                // the share of rounding in a corner's place (see pathInside; measured against 70 digits: under 7e-16)
// Is the path closed, near enough, with one inside? -> { value, signed, sides } or { none: "open" | "far" | "line" | "crosses" | "touches" }.
// sides: the sides of the shape whose inside is measured, that is the corners left once a stretch walked out and back the same way and
// the corners that are no corners (the path went straight on there) are taken out.
function pathInside(lab) {
  const full = labFrames(lab);
  if (full.length < 4) return { none: "open" };                           // three slides at least
  if (full.some((F) => !(hypDist(originOf(F), ORIGIN) <= AREA_REACH))) return { none: "far" };
  if (!(homecoming(full[full.length - 1]).distance < 1e-6)) return { none: "open" };   // and home again
  // A slide straight back undoes the slide before it: out and back the same way has no inside. Such pairs are taken out of the
  // list of slides, not out of the corners afterwards, so that the path that is judged has no corner that rounding has doubled.
  const slides = [];
  for (const s of lab.slides) {
    const last = slides[slides.length - 1];
    if (last && !s.home && !last.home && s.dist === last.dist && Math.abs(Math.abs(s.angle - last.angle) - Math.PI) < 1e-12) slides.pop();
    else slides.push(s);
  }
  const frames = slides.length === lab.slides.length ? full : slidePath(slides);
  if (frames.length < 4) return { none: "line" };
  const corners = frames.slice(0, -1).map((F) => originOf(F));           // home first; the last frame is home again
  const disc = corners.map((p) => toBall(p));
  let signed = 0;
  for (let i = 1; i + 1 < disc.length; i++) { const a = disc[i], b = disc[i + 1]; signed += 2 * Math.atan2(a[0] * b[1] - a[1] * b[0], 1 - a[0] * b[0] - a[1] * b[1]); }
  // Has the path one inside? In the Klein picture (x / t, y / t) its sides are straight, so this is a question about a plain polygon.
  // Which side of the line a-b the point c lies on is read from the sine of the angle at a, not from the bare product of the
  // differences: towards the rim the Klein picture shrinks (a side of length 1 is 1e-10 long near a distance of 12), and a product
  // of two such lengths would fall under any fixed bound, so that real corners were taken for points on one line. The sine does not
  // shrink. It counts as 0 where rounding alone could have given it its sign: then the three points are taken to lie on one line,
  // and a pair of sides judged with such a 0 is never said to cross, and is said to be apart only where another test shows it.
  // How sure a corner is: each product of frames rounds in proportion to its entries (t of the corner reached so far), and the
  // slides that follow carry that error on, magnified by cosh of the distance still to go. So corner n is sure, in Klein
  // coordinates, to about AREA_NOISE · Σ t(k) · cosh(distance from corner k to corner n) / t(n), the sum over the corners before it.
  // A path that goes far out and comes back is therefore less sure near home than one that stayed there.
  const doubt = corners.map((p, n) => {
    let sum = 0;
    for (let k = 0; k <= n; k++) { const q = corners[k]; sum += q[3] * Math.max(1, q[3] * p[3] - q[0] * p[0] - q[1] * p[1]); }
    return AREA_NOISE * sum / p[3];
  });
  const poly = corners.map((p, i) => [p[0] / p[3], p[1] / p[3], doubt[i]]);
  const orient = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], wx = c[0] - a[0], wy = c[1] - a[1], u = Math.hypot(ux, uy), w = Math.hypot(wx, wy), cross = ux * wy - uy * wx;
    const slack = 3 * Math.max(a[2], b[2], c[2]);
    return u > slack && w > slack && Math.abs(cross) > slack * (u + w) ? cross / (u * w) : 0;
  };
  const flat = (v) => Math.abs(v) <= AREA_EPS;
  // a corner on the line of its two neighbours is no corner: the path went straight on there, or back the way it came
  for (let i = 0; poly.length >= 3 && i < poly.length;) {
    const m = poly.length, a = poly[(i + m - 1) % m], b = poly[i], c = poly[(i + 1) % m];
    if (flat(orient(a, b, c))) { poly.splice(i, 1); i = 0; } else i += 1;
  }
  if (poly.length < 3) return { none: "line" };
  const between = (a, b, c) => Math.min(a[0], b[0]) - AREA_EPS <= c[0] && c[0] <= Math.max(a[0], b[0]) + AREA_EPS && Math.min(a[1], b[1]) - AREA_EPS <= c[1] && c[1] <= Math.max(a[1], b[1]) + AREA_EPS;
  // Two sides: 2 when they cross (each has its ends on both sides of the other, beyond doubt), 1 when they touch or are too
  // near to tell, 0 when they are apart.
  const meet = (a, b, c, d) => {
    const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
    if (flat(o1) && between(a, b, c)) return 1;
    if (flat(o2) && between(a, b, d)) return 1;
    if (flat(o3) && between(c, d, a)) return 1;
    if (flat(o4) && between(c, d, b)) return 1;
    const s1 = flat(o1) ? 0 : Math.sign(o1), s2 = flat(o2) ? 0 : Math.sign(o2), s3 = flat(o3) ? 0 : Math.sign(o3), s4 = flat(o4) ? 0 : Math.sign(o4);
    if (s1 * s2 > 0 || s3 * s4 > 0) return 0;                             // one side lies wholly on one side of the other
    if (s1 !== 0 && s2 !== 0 && s3 !== 0 && s4 !== 0) return 2;
    return s1 === 0 && s2 === 0 && s3 === 0 && s4 === 0 ? 0 : 1;           // on one line and apart; otherwise an end too near the other side's line
  };
  const m = poly.length;
  let touches = false;
  for (let i = 0; i < m; i++) for (let j = i + 2; j < m; j++) {
    if (i === 0 && j === m - 1) continue;                                 // neighbours round the end
    const met = meet(poly[i], poly[(i + 1) % m], poly[j], poly[(j + 1) % m]);
    if (met === 2) return { none: "crosses" };
    if (met === 1) touches = true;
  }
  if (touches) return { none: "touches" };
  const value = Math.abs(signed);
  return value > 1e-9 ? { value, signed, sides: m } : { none: "line" };
}
/**
 * labArea(lab) -> the area inside the closed path of the lab, worked out from the path itself and not from the turn, or null:
 *   { value (its size, in radians: the area of the curved map is measured as an angle), signed (positive for a path that runs anticlockwise),
 *     sides (the sides of the shape that has this inside: a slide straight on adds none, and a stretch walked out and back the same way adds none) }.
 * The signed areas of the triangles (home, corner i, corner i + 1) are added: for disc points a and b that area is 2 · arg(1 − a · conj(b)).
 * null when the path is not closed (no "Slide home" yet), when a corner is farther than 12 from home, when the path has no inside (its corners
 * lie on one line, or it only goes out and back the same way) and when it crosses or touches itself (then it has no single inside).
 * labNoArea(lab) says which of these it was.
 */
export function labArea(lab) {
  const inside = pathInside(lab);
  return inside.none ? null : inside;
}
/** labNoArea(lab) -> why labArea(lab) gives no area: "open" (the path is not closed), "far" (a corner farther than 12 from home), "line" (no inside: its corners lie on one line, or it goes out and back the same way), "crosses" (two of its sides cross, beyond doubt), "touches" (it touches itself, or two sides pass too near each other to tell); "" when labArea(lab) gives one. */
export const labNoArea = (lab) => pathInside(lab).none || "";
const isFour = (lab) => { const s = lab.slides.filter((x) => !x.home); return s.length === 4 && s.every((x, i) => x.unit && x.angle === LAB.directions[LAB.four[i]]); };
const isTile = (lab) => { const s = lab.slides.filter((x) => !x.home); return s.length === 4 && s.every((x, i) => !x.unit && Math.abs(x.dist - LAB.tile) < 1e-12 && Math.abs(x.angle - LAB.tileHeadingsDeg[i] * RAD) < 1e-12); };
/**
 * labReadout(lab, lens) -> the lab's results as text:
 *   { slides (count), distance (from home), steps (distance / a), turnClockwise (radians; null far from home), turnDeg, home,
 *     text ("You are 0.87 of a step from home. Sliding home, you face 78 degrees to the right of where you began."; a walker that is
 *     not turned gets whole sentences of its own: "Sliding home, you would face the way you began.", "You are home, facing the way you began."),
 *     flat (what a flat floor gives), area: { value, sides, text } | null (only after "Slide home", from labArea(): "the area inside your five-sided
 *     path: 1.362"; the sides are those of the shape that is measured, so forward, forward, back, left and home is a three-sided path; where the
 *     area is the turn itself the text says so, and where they differ by whole turns it says that),
 *     noArea: { why: "crosses", text } | null (after "Slide home", in place of the area, for a path that crosses itself: LAB_COPY.crosses;
 *     a path along one line gets neither),
 *     closed: [text] (the closed forms, from Navigator up, for the four slides), tile (text, for "Slide round one tile") | null, layer }.
 */
export function labReadout(lab, lens) {
  const frames = labFrames(lab), F = frames[frames.length - 1], hc = homecoming(F), n = lab.slides.length;
  const steps = hc.distance / lab.a, upper = lensOf(lens) !== "stargazer";
  const flatSum = lab.slides.filter((s) => !s.home).reduce((v, s) => [v[0] + s.dist * Math.cos(s.angle), v[1] + s.dist * Math.sin(s.angle)], [0, 0]);
  const flatGap = Math.hypot(flatSum[0], flatSum[1]);
  const flat = n === 0 ? "" : flatGap < 1e-9 ? "On a flat floor these slides would bring you back home, not turned."
    : "On a flat floor you would be " + fixed(flatGap / lab.a, 2) + " of a step from home, not turned.";
  let text;
  if (n === 0) text = "Press a slide button. The walker slides and never turns.";
  else if (hc.turnClockwise === null) text = "You are " + fixed(steps, 2) + " of a step from home: too far for this page to work out the turn.";
  else if (lab.home || hc.distance < 1e-9) text = unturned(hc.turnClockwise) ? "You are home, facing the way you began." : "You are home. You face " + turnWords(hc.turnClockwise) + " of where you began. No slide turned you.";
  else text = "You are " + fixed(steps, 2) + " of a step from home. " + (unturned(hc.turnClockwise) ? "Sliding home, you would face the way you began." : "Sliding home, you face " + turnWords(hc.turnClockwise) + " of where you began.");
  const asked = lab.home && n >= 3 && hc.turnClockwise !== null, inside = asked ? labArea(lab) : null, sides = inside ? numberWord(inside.sides) : "";
  const noArea = asked && !inside && labNoArea(lab) === "crosses" ? { why: "crosses", text: LAB_COPY.crosses } : null;
  // the turn is the area up to whole turns: it is the area itself while the path goes round less than half a turn's worth
  const isTurn = !!inside && Math.abs(inside.value - Math.min(hc.turnClockwise, 2 * Math.PI - hc.turnClockwise)) < 1e-6;
  const area = !inside ? null : upper
    ? { value: inside.value, sides: inside.sides, text: "the area inside your " + sides + "-sided path: " + fixed(inside.value, 3) + (isTurn ? " (the turn, measured in radians)" : ", measured in radians. The turn matches it, give or take whole turns.") }
    : { value: inside.value, sides: inside.sides, text: "The area inside your " + sides + "-sided path: " + fixed(inside.value, 3) + "." };   // the Stargazer lens has no radians
  const closed = [];
  if (upper && isFour(lab)) {
    closed.push("gap = 2 · asinh(2√2 · cosh(a/2) · sinh³(a/2)) = " + fixed(squareWalkGap(lab.a), 6));
    closed.push("turn = 2 · atan2(sinh²(a) / 2, 1 − 2 · sinh⁴(a/2)) = " + fixed(squareWalkTurn(lab.a) / RAD, 4) + "°");
  }
  const tile = isTile(lab) && upper ? "home again, turned " + fixed(hc.turnClockwise / RAD, 0) + "° clockwise, the area of the tile" : null;   // at the Stargazer lens the sentence above says it
  return { slides: n, distance: hc.distance, steps, turnClockwise: hc.turnClockwise, turnDeg: hc.turnClockwise === null ? null : hc.turnClockwise / RAD, home: lab.home || (n > 0 && hc.distance < 1e-9), text, flat, area, noArea, closed, tile, layer: "checked" };
}
/** fiveSlides(a) -> the challenge "Find the step that brings five slides home" (forward, left, back, right, forward): { a, gap, success (gap within 0.005), closedForm (1.061275), text }. */
export function fiveSlides(a) {
  const frames = slidePath(LAB.five.map((d) => ({ angle: LAB.directions[d], dist: a }))), gap = homecoming(frames[frames.length - 1]).distance;
  const success = gap <= LAB.fiveTolerance;
  return { a, gap, success, closedForm: LAB.fiveSide, layer: "checked",
    text: success ? "Home. The exact step is 2 · acosh(√2 · cos(π/5)) = " + fixed(LAB.fiveSide, 6) + ": five right-angled corners close up." : "After five slides you are " + fixed(gap, 3) + " from home." };
}
/** labPose(lab, k, f) -> the walker during slide k (0-based) at fraction f of it: the frame (a Lorentz matrix); labPose(lab) is the frame after the last slide. */
export function labPose(lab, k, f) {
  const frames = labFrames(lab);
  if (!Number.isInteger(k) || k < 0 || k >= lab.slides.length) return frames[frames.length - 1];
  const s = lab.slides[k];
  return lmul(frames[k], boostAlong([Math.cos(s.angle), Math.sin(s.angle), 0], s.dist * clamp(isNum(f) ? f : 1, 0, 1)));
}
let TILING_CACHE = null;
function tilingPolygons() {
  if (TILING_CACHE) return TILING_CACHE;
  const corner = (j) => lapply(lmul(rotZ(Math.PI / 4 + (j * Math.PI) / 2), boostX(TILE.R)), ORIGIN);
  // put one corner of the central square at home with one of its edges along the walker's forward axis
  // (five edges leave that corner, 72° apart, so the floor looks the same whichever of them is chosen)
  const G1 = centreOn(toBall(corner(0))), next = lapply(G1, corner(1));
  const G = lmul(rotZ(-Math.atan2(next[1], next[0])), G1);
  const polygons = [];
  for (const t of generateTiling(4, 5, 4).tiles) {
    const F = lmul(G, t.M), c = toBall(originOf(F));
    if (Math.hypot(c[0], c[1]) > 0.975) continue;                      // culled: too near the rim to see
    const corners = [0, 1, 2, 3].map((j) => lapply(F, corner(j))), points = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) { const b = toBall(geodesicPoint(corners[j], corners[(j + 1) % 4], i / 6)); points.push([b[0], b[1]]); }
    polygons.push(points);
  }
  TILING_CACHE = polygons;
  return polygons;
}
/**
 * labScene(lab, size, pose) -> the drawables of the lab's stage in CSS pixels (home stays at the centre):
 *   { w, h, cx, cy, R, outline: { x, y, r }, caption, home: { x, y }, path: [{ home (the slide home), points: [{ x, y }] }],
 *     walker: { x, y, tipX, tipY, hx, hy (unit heading on the screen) }, tiles: [[{ x, y }]] (the {4,5} floor when switched on) }.
 * pose: a frame from labPose() while a slide is being drawn; without it the walker stands at the end of the path.
 */
export function labScene(lab, size, pose) {
  const g = geometryOf(size, "2D"), frames = labFrames(lab);
  const px = (hp) => { const b = toBall(hp); return { x: g.cx + g.R * b[0], y: g.cy - g.R * b[1] }; };
  const path = lab.slides.map((s, k) => {
    const u = [Math.cos(s.angle), Math.sin(s.angle), 0], n = Math.max(2, Math.ceil(s.dist / 0.1));
    return { home: !!s.home, points: Array.from({ length: n + 1 }, (_, i) => px(originOf(lmul(frames[k], boostAlong(u, (s.dist * i) / n))))) };
  });
  const F = pose || frames[frames.length - 1], at = px(originOf(F)), tip = px(lapply(F, [Math.sinh(0.3), 0, 0, Math.cosh(0.3)]));
  const len = Math.hypot(tip.x - at.x, tip.y - at.y) || 1;
  return {
    ...g, outline: { x: g.cx, y: g.cy, r: g.R }, caption: LAB.caption, home: { x: g.cx, y: g.cy }, path,
    walker: { x: at.x, y: at.y, tipX: tip.x, tipY: tip.y, hx: (tip.x - at.x) / len, hy: (tip.y - at.y) / len },
    tiles: lab.tiling ? tilingPolygons().map((poly) => poly.map(([x, y]) => ({ x: g.cx + g.R * x, y: g.cy - g.R * y }))) : [],
  };
}

// ─── 10. the seal: this sky as a lexicon ─────────────────────────────────────
// sealSky is async and does the heavy work; the shell wraps it in withBusy() and paints in onEpoch.

/** packageFileName(chainId) -> "hyperpack-BC-….json", or null when the chain id is not of that form. */
export const packageFileName = (chainId) => (typeof chainId === "string" && /^BC-[0-9a-f]{24}$/.test(chainId) ? "hyperpack-" + chainId + ".json" : null);
/**
 * sealSky(state, { keys, at, onEpoch }) -> { ok, inputs: { jd, lat, lon } (the three rounded numbers as link text), rows, entries, keys, at,
 *   bundle, certificate, report, pack, wire, chainId, fileName, link (the Lexicon Explorer's URL with sky=JD,LAT,LON), kebar }.
 * The rows come from skyLexiconRows on rounded inputs (jd to 5 decimals, latitude and longitude to 2), so the Lexicon Explorer, given the
 * same three numbers, builds the same rows and the same chain. The three numbers are those of the page's two links (lexiconSkyHref,
 * skyLinkHref): within a second or two of either end of the year range, where the rounded instant would fall outside it, they are the
 * nearest instant of 5 decimals inside it. So every sky the page can show can be sealed, and link is the link the page writes.
 * The certificate is signed once, with a key made for this visit.
 */
export async function sealSky(state, options = {}) {
  const at = typeof options.at === "string" ? options.at : new Date().toISOString();
  const none = { ok: false, inputs: null, rows: null, entries: null, keys: null, at, bundle: null, certificate: null, report: null, pack: null, wire: null, chainId: null, fileName: null, link: "", kebar: false };
  const q = linkNumbers(state);
  if (!q) return none;
  const inputs = formatSkyInputs(q.jdUt, q.lat, q.lonEast);
  const rows = skyLexiconRows(skyState(q.jdUt, q.lat, q.lonEast)), entries = rows.map((r) => makeEntry(...r));
  const keys = options.keys || await newSessionKeys();
  const bundle = await buildLexiconBundle(entries, { at, onEpoch: options.onEpoch });
  const { certificate, report } = await issueCertificate(bundle, keys, at);
  const chainId = bundle.chain.chainId, link = lexiconSkyHref(state);
  const kebar = q.lat === KEBAR.lat && q.lonEast === KEBAR.lonEast && q.jdUt === EZEKIEL_PRESET.jdUt;
  if (!certificate) return { ...none, inputs, rows, entries, keys, bundle, report, chainId, link, kebar };
  const pack = makeHyperpack({ ...bundle, certificate }), wire = JSON.stringify(pack);
  return { ok: true, inputs, rows, entries, keys, at, bundle, certificate, report, pack, wire, chainId, fileName: packageFileName(chainId), link, kebar };
}
/** CERTIFIED: what the seal covers, sentence by sentence with layers (the wording of the Lexicon Explorer's last station). */
export const CERTIFIED = freeze([
  T("checked", "Certified: these bytes, their order, their addresses, the label each entry was given, the lineage and the ledger, unchanged since they were sealed with this key."),
  T("checked", "Not certified: that a TEXT entry matches its source, that a SAID entry is faithful, that a CHECKED number is right, that any READING is true, or who sealed it."),
]);
/** CERTIFIED_STARGAZER: the same in Stargazer words. */
export const CERTIFIED_STARGAZER = T("checked", "The stamp shows this exact writing has not changed since it was stamped. It does not show that the writing is true. It does not show who stamped it.");
/** SEAL_COPY: the fixed sentences of the Seal step: pass (per lens; never "all checks pass" alone), fail, about, privacy (per lens: what the link holds, and what the file holds besides), witness (READING), kebar, needPlace, buttons. */
export const SEAL_COPY = freeze({
  pass: perLens("The stamp fits: this exact writing is unchanged since it was stamped.", "Every check passed: unchanged since it was sealed."),
  fail: perLens("The stamp does not fit: something was changed.", "A check failed: this is not the sky that was sealed."),
  about: perLens(T("checked", "The stamp is about this exact writing, not whether it is true."), T("checked", "The seal certifies these bytes, not their truth.")),
  privacy: perLens(
    T("checked", "This link holds the place and the time you entered. The parcel also holds the moment it was stamped. It holds a number that lets others check the stamp."),
    T("checked", "This link contains the place and the time you entered. The file also holds the moment it was stamped and the public half of this visit's key.")),
  witness: perLens(
    T("reading", "One stamp is one witness. The rule in the verse asks for two or three. In the Lexicon Explorer, the Navigator level shows pretend receivers checking it too."),
    T("reading", "One seal is one witness. By the rule quoted here that settles nothing until others check it too: open it in the Lexicon Explorer and let the receivers answer.")),
  kebar: T("checked", "Everyone who seals this same sky gets this same name. Compare with a friend."),
  needPlace: "Choose a place first: a sky needs a place and a time.",
  buttons: freeze({ seal: perLens("Stamp this sky", "Seal this sky"), file: perLens("Save the parcel as a file", "Download the package"), open: "Open this sky in the Lexicon Explorer", copy: "Copy a link to this sky" }),
});
/** epochLine({ epoch, epochs }, lens) -> "epoch 3 of 4" ("part 3 of 4" at Stargazer): the progress line while the chain grows. */
export const epochLine = (p, lens) => (lensOf(lens) === "stargazer" ? "part " : "epoch ") + p.epoch + " of " + p.epochs;
/** sealView(seal, lens) -> what the Seal step prints: { ok, verdict, chainName (shown large for the Kebar preset), rows: [{ key, label, value, hash }], checks (the report's), fileName, link, notes: [{ layer, text }] }; null before sealing. */
export function sealView(seal, lens) {
  if (!seal || !seal.report) return null;
  const l = lensOf(lens), stargazer = l === "stargazer", rows = [];
  const add = (key, label, value, hash) => rows.push({ key, label, value, hash: !!hash });
  add("chain", stargazer ? "The name of this stamp" : "Chain id", seal.chainId, true);
  if (!stargazer) {
    add("inputs", "The three numbers", "JD " + seal.inputs.jd + ", latitude " + seal.inputs.lat + ", longitude " + seal.inputs.lon, false);
    add("entries", "Entries", String(seal.entries.length), false);
    add("epochs", "Epochs", String(seal.bundle.lineage.length), false);
    if (seal.certificate) add("key", "Signed by", seal.certificate.sealId + " (a key made for this visit)", true);
  }
  if (l === "holographer" && seal.certificate) add("commitment", "OVERWATCH/1 line", seal.certificate.commitment, true);
  const notes = [forLens(SEAL_COPY.privacy, l), forLens(SEAL_COPY.witness, l)];
  if (seal.kebar) notes.push(SEAL_COPY.kebar);
  return { ok: seal.ok, verdict: forLens(seal.ok ? SEAL_COPY.pass : SEAL_COPY.fail, l), chainName: seal.kebar ? seal.chainId : null, rows, checks: seal.report.checks, fileName: seal.fileName, link: seal.link, notes };
}

// ─── 11. copy: steps, STRIX and the bridge boxes ─────────────────────────────
// Every sentence a visitor reads carries a layer: { layer, text }. A TEXT sentence is cut out of a verse row of
// ezekiel-1.js by verseSlice() and is never typed here: only the first and last words of the cut are.
// Numbers in CHECKED sentences are computed when the module loads (COPY_FACTS) and recomputed by the unit test.

const ROW_BY_ADDRESS = new Map(ROWS.map((r) => [r[0], r]));
const rowText = (address) => (ROW_BY_ADDRESS.get(address) || ["", "", "", "", ""])[4];
const rowSentence = (address, n) => sentencesOf(rowText(address))[n] || "";
/** verseSlice(address, from, to) -> the words of a verse row from the first occurrence of from to the end of the next to (the whole verse when either is missing or not found); "" when the lexicon has no such verse row. */
export function verseSlice(address, from, to) {
  const r = ROW_BY_ADDRESS.get(address);
  if (!r || r[1] !== "text" || r[2] !== "verse") return "";
  if (!from || !to) return r[4];
  const a = r[4].indexOf(from), b = a < 0 ? -1 : r[4].indexOf(to, a);
  return a < 0 || b < 0 ? r[4] : r[4].slice(a, b + to.length);
}
const written = (address, from, to) => {
  const r = ROW_BY_ADDRESS.get(address);
  return freeze({ layer: "text", text: verseSlice(address, from, to), stargazer: null, source: address, name: (r ? r[3].replace(/ \((context|opening words)\)$/, "") : address) + ", King James Version", note: null });
};
const stand = (layer, text, stargazer, source, note) => freeze({ layer, text, stargazer: stargazer || null, source: source || null, name: null, note: note || null });

const NAZARETH = siteOf("nazareth");
const EAST = bearingAndDistance(NAZARETH.lat, NAZARETH.lonEast, KEBAR.lat, KEBAR.lonEast);
const kebarSky = (parts) => skyState(sunsetAt(parts, KEBAR), KEBAR.lat, KEBAR.lonEast);
const litPercent = (parts) => Math.round(100 * kebarSky(parts).phase.illuminatedFraction);
const SUNSET_0 = sunsetAt(EZEKIEL_DATES[0].endsDay, KEBAR), SKY_0 = skyState(SUNSET_0, KEBAR.lat, KEBAR.lonEast);
const FOUR_HOME = homecoming(slidePath(LAB.four.map((d) => ({ angle: LAB.directions[d], dist: 1 })))[4]);
const TILE_HOME = homecoming(slidePath(LAB.tileHeadingsDeg.map((d) => ({ angle: d * RAD, dist: LAB.tile })))[4]);
const SKY_NOW = skyState(jdFromParts({ year: PAGE_YEAR, month: 7, day: 1 }), 51.4769, 0);   // the middle of PAGE_YEAR, at Greenwich
const YEAR_RATIOS = Array.from({ length: 24 }, (_, i) => { const s = skyState(jdFromParts({ year: PAGE_YEAR, month: 1, day: 1 }) + i * 15.3, 0, 0); return s.sun.lightSeconds / s.moon.lightSeconds; });
const HEAVENS = ROWS.filter((r) => r[1] === "text" && r[2] === "verse" && r[4].includes("the heavens were opened"));
const SEAL_ROWS = skyLexiconRows(SKY_0);
const radiusOf = (lightSeconds) => Math.tanh(depthRho(lightSeconds) / 2);
function moonMonths() {
  const t0 = 2451550.1, first = nextPhaseTime(t0, 0), LUNATIONS = 223;  // one saros: the Moon's and the Sun's uneven speeds average out
  let t = first;
  for (let i = 0; i < LUNATIONS; i++) t = nextPhaseTime(t + 1, 0);
  const span = 2732.2, turns = 100;                                     // about a hundred trips round the sky
  const lam = (jd) => moonPosition(jdeFromJdUt(jd)).lambda;
  const extra = ((lam(t0 + span) - lam(t0) + 540) % 360) - 180;
  return { synodic: (t - first) / LUNATIONS, sidereal: (span * 360) / (360 * turns + extra) };
}
const MONTHS = moonMonths();

/** COPY_FACTS: every number the copy states as CHECKED, as computed when the module loaded (the unit test recomputes each from the cores). */
export const COPY_FACTS = freeze({
  kebar: freeze({ latitudeApart: Number(Math.abs(KEBAR.lat - NAZARETH.lat).toFixed(2)), minutesApart: Math.round(Math.abs(KEBAR.lonEast - NAZARETH.lonEast) * 4), bearing: Math.round(EAST.bearing), km: Math.round(EAST.km) }),
  moon: freeze(EZEKIEL_DATES.map((d) => freeze({ key: d.key, label: d.label, begins: litPercent(d.beginsDay), ends: litPercent(d.endsDay) }))),
  firstQuarterMinutes: Math.round((SUNSET_0 - nextPhaseTime(SUNSET_0 - 2, 90)) * 1440),
  clockMinutes: Math.round(SKY_0.deltaTSigma / 60),
  yearsApart: Math.round((PAGE_YEAR - EZEKIEL_DATES[0].endsDay.year) / 100) * 100,
  slides: freeze({ gap: Number(FOUR_HOME.distance.toFixed(2)), turnDeg: Math.round(FOUR_HOME.turnClockwise / RAD) }),
  tile: freeze({ side: Number(LAB.tile.toFixed(6)), turnDeg: Math.round(TILE_HOME.turnClockwise / RAD), meet: Math.round((2 * Math.PI) / TILE.angle) }),
  fiveSide: Number(LAB.fiveSide.toFixed(6)),
  sunMoonRatio: Math.round(YEAR_RATIOS.reduce((a, b) => a + b, 0) / YEAR_RATIOS.length / 100) * 100,
  drawnRatio: Number((radiusOf(SKY_NOW.sun.lightSeconds) / radiusOf(SKY_NOW.moon.lightSeconds)).toFixed(1)),
  polaris: freeze({ now: Number(SKY_NOW.anchors.polaris.poleDistance.toFixed(1)), then: Number(SKY_0.anchors.polaris.poleDistance.toFixed(1)) }),
  months: freeze({ synodic: Number(MONTHS.synodic.toFixed(2)), sidereal: Number(MONTHS.sidereal.toFixed(2)) }),
  obliquity: Number(SKY_NOW.obliquity.toFixed(1)),
  sunLightMinutes: Math.round(LIGHT_SECONDS_PER_AU / 60),
  auLightSeconds: Math.round(LIGHT_SECONDS_PER_AU),
  sgr: freeze({ galL: Number(SKY_NOW.anchors.sgr_a_star.galL.toFixed(2)), galB: Number(SKY_NOW.anchors.sgr_a_star.galB.toFixed(2)), arcminutes: Math.round(60 * Math.hypot(SKY_NOW.anchors.sgr_a_star.galL - 360, SKY_NOW.anchors.sgr_a_star.galB)) }),
  m31: freeze({ millionLy: Number((anchor("m31").distanceLy / 1e6).toFixed(2)), timesGalacticCentre: Math.round(anchor("m31").distanceLy / anchor("sgr_a_star").distanceLy) }),
  pleiadesEclLat: Math.round(SKY_NOW.anchors.pleiades.eclLat),
  velaTurns: anchor("vela_pulsar").extra.turnsPerSecond,
  heavens: freeze({ rows: HEAVENS.length, names: freeze(HEAVENS.map((r) => r[3])) }),
  seal: freeze({ rows: SEAL_ROWS.length, epochs: SEAL_ROWS.filter((r) => !r[0].includes(".")).length }),
  radii: freeze(Object.fromEntries(BODIES.filter((k) => bodyLightSeconds(SKY_0, k) !== null).map((k) => [k, Number(radiusOf(bodyLightSeconds(SKY_0, k)).toFixed(2))]).concat([["cmb", Number(Math.tanh(CMB_RING.rho / 2).toFixed(2))]]))),
});
const F = COPY_FACTS;
const M0 = F.moon[0], M1 = F.moon[1], M2 = F.moon[2];
// The Kebar site and Nazareth, in the wording both pages share (the Lexicon Explorer's KEBAR_NAZARETH): no finer than two approximate
// positions bear. Minutes to the nearest 5, kilometres to the nearest 10; the unit test recomputes each rounded form.
const KEBAR_MINUTES = Math.round(Math.abs(KEBAR.lonEast - NAZARETH.lonEast) * 4 / 5) * 5, KEBAR_KM = Math.round(EAST.km / 10) * 10;
const KEBAR_NAZARETH = "Computed from approximate positions: the Kebar site (Nippur) and Nazareth lie "
  + (F.kebar.latitudeApart >= 0.45 && F.kebar.latitudeApart <= 0.65 ? "about half a degree" : "about " + fixed(F.kebar.latitudeApart, 1) + "°")
  + " apart in latitude, so almost the same stars pass overhead at both, about " + KEBAR_MINUTES + " minutes apart. From Nazareth the site lies roughly due east, about " + KEBAR_KM + " km.";

/** BRIDGE_TITLE: the heading of a bridge box. */
export const BRIDGE_TITLE = "THE BRIDGE";
/** BRIDGE_PARTS: the names of the two parts of a bridge box. */
export const BRIDGE_PARTS = freeze({ reading: "Our reading", stands: "What it stands on" });
const OPENING = "First Explorers drew its bridge as the line through the zero point at right angles to the map of peoples, and read Jesus of Nazareth as that line. On this page the map is your horizon and that line is your straight-up line. Ezekiel, among the captives, writes that the heavens were opened over the place where he stood. The gold boxes follow that line from his river to John 3:16. This is our reading; no check depends on it, and the word bridge is not in the King James Bible.";
/** BRIDGE_OPENING: the paragraph that opens the page's first gold box (the bridge stated once, with its disclaimer), per lens. */
export const BRIDGE_OPENING = perLens(
  T("reading", "Our page First Explorers drew a bridge: a line through the middle of its map. We read Jesus of Nazareth as that line. On this page the map is your horizon. The line is the line straight up from your head. The gold boxes follow it from Ezekiel's river to John 3:16. This is our reading, and no check depends on it. The word bridge is not in the King James Bible."),
  T("reading", OPENING));

/** FIRST_RUN: the first screen (the dark disc with one dot, STRIX's question and three buttons, the first one gold) and the lines round it. */
export const FIRST_RUN = freeze({
  say: perLens(
    T("reading", "It is dark. Three questions will light the sky. First: where on Earth are you standing?"),
    T("reading", "Three questions fix a sky: where on Earth, which day, and, as a check, which Moon. First: where on Earth are you standing?")),
  threeQuestions: T("reading", "Three questions tell me where we are under the sky. Where on Earth are you standing? What day is it? What shape is the Moon tonight? You answer the first two. I work out the Moon, and you look up and check me."),
  card: T("checked", "I cannot see where you are, and I never ask your device."),
  buttons: freeze({ greenwich: "Start at Greenwich", pick: "Pick a place", type: "Type my place" }),
  defaultSite: "greenwich",
  typeHelp: "Ask a grown-up: a maps app shows these two numbers",
  typeLabels: freeze({ lat: "Latitude", lon: "Longitude", north: "North", south: "South", east: "East", west: "West" }),
  afterDefault: T("reading", "We start at Greenwich in England. Change the place any time to see your own sky."),
});

const reading = (stargazer, navigator, holographer) => perLens(T("reading", stargazer), T("reading", navigator), T("reading", holographer === undefined ? navigator : holographer));
const says = (stargazer, navigator, holographer) => perLens(freeze(stargazer), freeze(navigator), freeze(holographer === undefined ? navigator : holographer));
const STAMP = "A seal is a stamp on the exact writing. Change one letter and the stamp no longer fits, and anyone can see that. It does not say the writing is true, and it does not say who made it.";
const FOUR_SLIDES = "Slide forward, left, back and right, one step each, and never turn. On a flat floor you would be home. Here you end " + fixed(F.slides.gap, 2) + " of a step from home. Slide straight home. Now you face almost a quarter turn to the right (" + F.slides.turnDeg + " degrees). No slide turned you. This is true of the curved map, not of the sky.";

/**
 * STEPS: the five steps, in order (they can be visited in any order). Each is
 *   { key, n, title, stargazerTitle, question: { stargazer, navigator, holographer },
 *     say: per lens a list of { layer, text } (STRIX's paragraph),
 *     bridge: { opening (first box only, per lens) | null, reading: per lens { layer, text },
 *               stands: [{ layer, text, stargazer, source (the lexicon row a TEXT or SAID sentence comes from), name, note }],
 *               links: [{ label, to ("firstExplorers" | "entry"), address }] } }.
 * Use stepView() to get one step resolved for a lens, with the links as URLs.
 */
export const STEPS = freeze([
  freeze({
    key: "earth", n: 1, title: "Earth", stargazerTitle: "My place",
    question: perLens("Where on Earth are you standing?", "Where am I standing on Earth?"),
    say: says(
      [FIRST_RUN.threeQuestions],
      [T("checked", "Computed from your latitude and the time: the point straight overhead has a declination equal to your latitude and a right ascension equal to your local sidereal time. The celestial pole stands as high above your horizon as your latitude."),
        T("checked", "The place is typed or chosen. This page never asks the device where it is.")],
      [T("checked", "Computed: the horizon frame (x east, y north, z up) is the equatorial frame of date turned by the local apparent sidereal time and by 90° minus the latitude. The zenith is the unit vector (0, 0, 1) of that frame."),
        T("checked", "The place is typed or chosen. This page never asks the device where it is.")]),
    bridge: freeze({
      opening: BRIDGE_OPENING,
      reading: reading(
        "We start where the book starts: a man says where he stands. You may see it another way.",
        "We read the first verse as a fix: before anything is seen, the writer says where he stood. This panel asks the same first. You may see it another way.",
        "We read the straight-up line as this panel's axis: one point of the flat chart, a whole line of the ball. You may see it another way."),
      stands: freeze([
        freeze({ ...written("26.1.1", "as I was", "Chebar"), note: T("reading", "We write the Kebar (Chebar in the King James Version): one river, two spellings.") }),
        stand("said", "Pierre van Paassen, in Why Jesus Died (1949), writes of the young Jesus: “Lying awake at night on the roof of his father’s house in Nazareth, looking up at the stars running in their appointed courses”.",
          "A writer, Pierre van Paassen, wrote about the young Jesus in 1949. He pictured him on a roof in Nazareth, looking up at the stars.", null,
          T("reading", "That is his picture of the young Jesus, not a record.")),
        stand("checked", KEBAR_NAZARETH + " Choose both places and compare.",
          "Worked out from rough positions: Nazareth and the Kebar site are almost equally far north. Almost the same stars pass overhead at both, about " + KEBAR_MINUTES + " minutes apart. Try both places."),
        stand("checked", "Computed: in the flat horizon chart your straight-up line is one point; in the ball it is a line. Switch to 3D to see it.",
          "Worked out: the line straight up from your head looks like a dot from above. In the ball you can see the whole line."),
      ]),
      links: freeze([]),
    }),
  }),
  freeze({
    key: "sun-moon", n: 2, title: "Sun and Moon", stargazerTitle: "My day and Moon",
    question: perLens("What day is it? What shape is the Moon tonight?", "What day of the year is it? What shape is the Moon tonight?"),
    say: says(
      [T("checked", "Worked out from your day and place: where the Sun is and the Moon's shape. Look up and check me.")],
      [T("checked", "Computed for the local date at your place: the Sun's ecliptic longitude and the days from the nearest equinox or solstice; the Moon's lit fraction, phase name and age, and the lean of its bright side as it looks from your place.")],
      [T("checked", "Computed with the formulas of Meeus (1991) and the ΔT of Espenak and Meeus (2006): apparent geocentric longitudes of the true equinox of date. The lit fraction is (1 + cos i)/2 with i the phase angle; the lean is the bright-limb angle measured from your zenith, for the Moon's topocentric place.")]),
    bridge: freeze({
      opening: null,
      reading: reading(
        "We ask the three questions the book answers first: where, which day, which Moon. We read Ezekiel's date as his answer to the second and third. The book and this page are about " + grouped(F.yearsApart) + " years apart. You may see it another way.",
        "We read the verse's date as an answer to this panel's second and third questions: the day, and with it the Moon. The same three questions, " + grouped(F.yearsApart) + " years apart. You may see it another way.",
        "We read a date as a point on two circles: the Sun's place in its year and the Moon's place in its month. The verse gives both, " + grouped(F.yearsApart) + " years before this panel asks. You may see it another way."),
      stands: freeze([
        written("26.1.1", "in the fourth month", "day of the month"),
        stand("said", "Parker and Dubberstein (1942) write of Babylonian “lunar months, which began when the thin crescent of the new moon was first visible in the sky at sunset”.",
          "Two scholars, Parker and Dubberstein, wrote in 1942 about months in Babylon. Each month began when the thin new Moon was first seen at sunset."),
        stand("checked", "Computed, if the day is placed on the date usually given: on the fifth day of such a month the Moon is a thick crescent growing towards half. Over the site by the Kebar (Chebar in the King James Version) it grew from " + M0.begins + " % lit at the sunset that began the day (30 July 593 BC) to " + M0.ends + " % at the sunset that ended it (31 July), reaching first quarter about " + F.firstQuarterMinutes
          + " minutes before that second sunset, give or take " + F.clockMinutes + " minutes for the clock and a day for the calendar tables. On two other published dates, " + M1.label + " and " + M2.label + ", it grew from " + M1.begins + " to " + M1.ends + " % and from " + M2.begins + " to " + M2.ends + " %. Open the preset and look.",
          "Worked out: if that date is right, the Moon grew to half lit that day. Open the sky by the Kebar (Chebar in the King James Version) and look."),
      ]),
      links: freeze([]),
    }),
  }),
  freeze({
    key: "project", n: 3, title: "Project", stargazerTitle: "Look around",
    question: perLens("What is around me, near and far?", "Which great circles and which depths frame this sky?"),
    say: says(
      [T("reading", "This is a squeezed map. Near things sit near the middle, far things near the edge."),
        T("checked", "The Sun is about " + F.sunMoonRatio + " times farther than the Moon. Yet it is drawn less than twice as far out."),
        T("reading", "Only the map is squeezed. Space is not.")],
      [T("reading", CHART_WORDING),
        T("checked", "Computed: each great circle (horizon, celestial equator, ecliptic, galactic plane) is drawn on the ball in 3D. On the flat map a circle is shown by the two points where it crosses the map's plane, and the map's own circle is the rim.")],
      [T("reading", "Depth is ρ = " + DEPTH.rho0 + " + " + DEPTH.kappa + " · log10(distance in light-seconds), drawn at disc radius tanh(ρ/2). " + DEPTH_WORDING),
        T("checked", "Computed: a body is the point (sinh ρ · d, cosh ρ) of the hyperboloid, with d its unit direction in the chosen frame; the screen shows the Poincaré ball image of that point.")]),
    bridge: freeze({
      opening: null,
      reading: reading(
        "We look where the book looks: up, and to the north. The book says the heavens were opened. We set two openings of heaven side by side: Ezekiel's, and one when Jesus was baptised. You may see it another way.",
        "We set two openings of heaven side by side, as the early Christian writer Origen did: Ezekiel's by the river, and the one at the baptism of Jesus. This panel draws the sky; it does not say what was seen. You may see it another way.",
        "We read “out of the north” as a direction on this chart and nothing more: the one compass word in the nine verses. You may see it another way."),
      stands: freeze([
        written("26.1.4", "a whirlwind", "the north"),
        written("26.1.1", "the heavens", "opened"),
        written("40.3.16", "lo, the heavens", "unto him"),
        stand("checked", "Counted: the words “the heavens were opened” stand in " + numberWord(F.heavens.rows) + " of the lexicon's verse rows: " + F.heavens.names.join(" and ") + ". Count with me in the Lexicon Explorer.",
          "Counted: these four words stand in " + numberWord(F.heavens.rows) + " of the verses kept here. Look for the other one."),
        stand("said", rowSentence("26.1.1.5.8", 0), "This project searched the whole King James Bible text. It found these four words in two verses.", "26.1.1.5.8"),
        stand("said", rowText("26.1.1.5.9"), "A Christian writer of long ago, Origen, set the two rivers side by side. That is a Christian reading of a Jewish prophet's book.", "26.1.1.5.9"),
        written("43.1.51", "Hereafter", "Son of man."),
      ]),
      links: freeze([]),
    }),
  }),
  freeze({
    key: "dive", n: 4, title: "Dive", stargazerTitle: "Slide the map",
    question: perLens("What comes to the middle when the map slides?", "What does the move T_c(z) = (z − c)/(1 − c̄z) bring to the centre?"),
    say: says(
      [T("checked", "Tap anything and the whole map slides until it sits in the middle. It is the same map, seen from a new middle. Nothing is added and nothing is lost. What you left behind is squeezed towards the edge.")],
      [T("checked", "Computed: the view is the slide T_c(z) = (z − c)/(1 − c̄z) that brings the chosen point c to the centre. It keeps every distance of the curved map; what you leave behind is drawn smaller, towards the rim.")],
      [T("checked", "In 2D " + HUD_COPY.flat.text + ". In 3D it is " + HUD_COPY.ball.text + ".")]),
    bridge: freeze({
      opening: null,
      reading: reading(
        "We read the verse beside the map: the creatures went straight and did not turn. One straight slide of this map turns nothing either. Keeping straight is true of each slide, not of a whole trip. You may see it another way.",
        "We set the verse beside one fact of the map: the move that brings the far to the centre turns nothing on its line. Holding a heading is a property of each step, not of the whole trip. You may see it another way.",
        "We read “they turned not when they went” beside the slide T_c: it has no rotation part, yet two slides in a row make a slide and a turn. Holding a heading is a property of each step. You may see it another way."),
      stands: freeze([
        written("26.1.12"),
        stand("checked", "Computed: one straight slide turns nothing along its line; a round trip comes home turned by the area it went round. Forward, left, back and right by 1 ends " + fixed(F.slides.gap, 2) + " from home, and the slide home leaves the walker turned " + F.slides.turnDeg + "° to the right. Try it in the lab.", FOUR_SLIDES),
      ]),
      links: freeze([]),
    }),
  }),
  freeze({
    key: "seal", n: 5, title: "Seal", stargazerTitle: "Stamp it",
    question: perLens("Can someone else check this sky?", "Can someone else rebuild this sky and get the same chain?"),
    say: says(
      [T("checked", STAMP)],
      [T("checked", "Built from three rounded numbers (the Julian Day to 5 decimals, the latitude and longitude to 2): the " + F.seal.rows + " rows of this sky, a chain grown from them, the checks, and a certificate signed with a key made for this visit. The Lexicon Explorer recomputes the same rows from the same three numbers and shows the same chain id.")],
      [T("checked", "Built: skyLexiconRows gives " + F.seal.rows + " LEX/1 lines, each LEX/1|address|layer|kind|name|text; buildLexiconBundle grows one epoch per top-level entry (" + numberWord(F.seal.epochs) + "); the certificate signs the OVERWATCH/1 commitment with ECDSA P-256; the package is HYPERPACK/1 wire text.")]),
    bridge: freeze({
      opening: null,
      reading: reading(
        "We read one stamp as one witness. The rule in the verse asks for two or three. First Explorers ends on its middle line; here that line is the line straight up. You may see it another way.",
        "One seal is one witness. By the rule quoted here that settles nothing until others check it too. First Explorers ends on the line through the zero point; in this panel that line is the zenith line. You may see it another way.",
        "We read the certificate as one witness's signed statement about bytes. The verse's rule asks for two or three; the Lexicon Explorer's receivers stand in for them, and they are simulated. In this panel the line through the zero point is the zenith line. You may see it another way."),
      stands: freeze([
        written("40.18.16", "that in the mouth", "established."),
        stand("checked", CERTIFIED.map((s) => s.text).join(" "), CERTIFIED_STARGAZER.text),
      ]),
      links: freeze([
        freeze({ label: "Back to First Explorers, where the bridge was drawn", to: "firstExplorers", address: null }),
        freeze({ label: "On to John 3:16 in the Lexicon Explorer", to: "entry", address: "43.3.16" }),
      ]),
    }),
  }),
]);
const STEP_BY_KEY = new Map(STEPS.map((s) => [s.key, s]));
/** visibleSteps(lens) -> the step strip: [{ key, n, title }] with the Stargazer names at the Stargazer lens. */
export const visibleSteps = (lens) => STEPS.map((s) => ({ key: s.key, n: s.n, title: lensOf(lens) === "stargazer" ? s.stargazerTitle : s.title }));
/**
 * stepView(step, lens) -> one step (by key or number) resolved for a lens, or null:
 *   { key, n, title, question, say: [{ layer, text }],
 *     bridge: { opening: { layer, text } | null, reading: { layer, text }, stands: [{ layer, text, source, name, href (a TEXT sentence links to its row), note }], links: [{ label, href }] } }.
 */
export function stepView(step, lens) {
  const s = typeof step === "number" ? STEPS[step - 1] : STEP_BY_KEY.get(step);
  if (!s) return null;
  const l = lensOf(lens), stargazer = l === "stargazer";
  return {
    key: s.key, n: s.n, title: stargazer ? s.stargazerTitle : s.title, question: forLens(s.question, l), say: forLens(s.say, l),
    bridge: {
      opening: s.bridge.opening ? forLens(s.bridge.opening, l) : null,
      reading: forLens(s.bridge.reading, l),
      stands: s.bridge.stands.map((x) => ({
        layer: x.layer, text: stargazer && x.stargazer ? x.stargazer : x.text, source: x.source, name: x.name,
        href: x.source && (x.layer === "text" || x.layer === "said") ? entryHref(x.source, l) : null, note: x.note,
      })),
      links: s.bridge.links.map((k) => ({ label: k.label, href: k.to === "firstExplorers" ? firstExplorersHref() : entryHref(k.address, l) })),
    },
  };
}

/** EZEKIEL_COPY: the lines of the preset "Ezekiel by the Kebar": title, site (SAID: the place), derived (SAID: how the date is derived), noHour (CHECKED: read from the verse rows 26.1.1 to 26.1.3; the unit test reads them again), stargazer (one line at the Stargazer lens). */
export const EZEKIEL_COPY = freeze({
  title: "Ezekiel by the Kebar",
  site: T("said", KEBAR.note),
  derived: T("said", rowText("26.1.1.2.4")),
  older: T("said", EZEKIEL_DATES_NOTE),
  noHour: T("checked", "Read from the three verses kept here: they give a day and no hour."),
  stargazer: T("said", "This day is usually given as 31 July 593 BC. Other dates are in print too."),
});
/** MESSAGES: the plain messages under the controls. */
export const MESSAGES = freeze({
  badLatitude: "A latitude is a number from 0 to 90, north or south.",
  badLongitude: "A longitude is a number from 0 to 180, east or west.",
  yearRange: "This page works for the years " + eraYear(YEAR_MIN).n + " BC to AD " + YEAR_MAX + ".",
  noSuchDay: "That day does not exist.",
  noSunrise: "The Sun does not rise here today.",
  noSunset: "The Sun does not set here today.",
  needPlace: "Choose a place first.",
  dayChanged: "The day changed while this page was open. Please look again.",
  changesDay: MOON_COPY.changesDay,
  timeLabel: "Sun time at this place (local mean time)",
  calendar: "The calendar in force: Julian before 15 October 1582, Gregorian from that day on.",
  copied: "The link is copied.",
  copyHelp: "Select the link and copy it.",
  linkIgnored: IGNORED_NOTE,
});

// ─── 12. the dialogs ─────────────────────────────────────────────────────────

const LEGEND = freeze(LAYER_META.map((m) => T(m.id, m.legend)));
/** DIALOG: the "What is real here?" dialog: title, first (its first line), inShort (about five Stargazer sentences) and sections: [{ heading, items: [{ layer, text }] }]. */
export const DIALOG = freeze({
  title: "What is real here?",
  first: T("reading", "This page sets Bible verses beside sky calculations because its author asked for that. The numbers do not depend on the verses, and the verses are not offered as science."),
  inShort: freeze([
    T("checked", "This page works out the sky for your place and your day."),
    T("said", "Other people measured how far the stars are, and the page names them."),
    T("reading", "The squeezed map is our own way of drawing. Space is not squeezed."),
    T("reading", "The gold boxes hold our own idea about some Bible verses."),
    T("checked", "A stamp shows that writing has not changed. It cannot show that the writing is true."),
    T("reading", STRIX.who),
  ]),
  sections: freeze([
    freeze({ heading: "The four layers", items: freeze([...LEGEND, T("checked", BADGE_HELP)]) }),
    freeze({ heading: "What is computed, and how well", items: freeze([
      T("checked", "Your latitude and date drive the sky: the Sun, the Moon, the Moon's shape and lean, and where each star stands are computed for the place and time you give."),
      ...LIMITS.map((s) => T("checked", s)),
      T("reading", "The allowance for ΔT is this project's, not a measurement. The page shows an uncertainty badge whenever it moves the Moon by 0.01° or more: before about AD 915 and after about 2045."),
    ]) }),
    freeze({ heading: "What others measured", items: freeze([
      T("said", "The places and distances of the six objects beyond the Sun and Moon are those given by the sources named in each object's inspector."),
      T("checked", "This page works out only where each one stands in your sky."),
      T("said", "The Vela pulsar turns " + F.velaTurns + " times a second (Helfand and others 2001)."),
      T("said", CMB_NOTE[0]),
      T("said", "Celestial holography is a proposal (Pasterski 2021; Raclariu 2021)."),
      T("said", "Gravitational-wave memory has not been detected (the NANOGrav collaboration 2025)."),
    ]) }),
    freeze({ heading: "This project's chart", items: freeze([
      T("reading", CHART_WORDING),
      T("reading", DEPTH_WORDING),
      T("reading", "The places of the proposals on the rim (the poles of the ecliptic and of the galactic frame) and the four shells of the Blueprint are this project's choices."),
      T("checked", "Sliding the disc is a move of PSU(1,1), the 3-parameter group of the disc. The 6-parameter group PSL(2,C) needs the ball."),
    ]) }),
    freeze({ heading: "The book", items: freeze([
      T("reading", "The author calls this way of working “the design protocol of Why Jesus Died”. The rules are this project's; the book does not contain them."),
      T("said", "Van Paassen writes “As a Unitarian” and argues his own reconstruction; the running text never mentions Ezekiel (the name occurs once, in a reading list); he treats visions as experiences of the mind and rejects reading the prophets as predictions fulfilled in the Gospels."),
      T("reading", "The links between Ezekiel and the Gospels shown here come from early Christian writers and from this project, not from him."),
    ]) }),
    freeze({ heading: "The bridge narrative (the gold boxes)", items: freeze([
      T("reading", "It is an interpretation, chosen by this project. The gold boxes read Jesus of Nazareth as a bridge between the source of love and the world; on this page that bridge is the straight-up line, followed from Ezekiel's river to John 3:16. No check, packet or certificate on this page depends on it."),
      T("reading", "The gold boxes quote several writers, each named where it is quoted. Where a box quotes Pierre van Paassen, Why Jesus Died (Dial Press, 1949), the words in quotation marks are his and were checked against a scan of the book."),
      T("said", "Van Paassen argues that Jesus was a Galilean Jew in the line of Israel's prophets who announced the Kingdom of God on earth: justice, and all people as kin; that Pontius Pilate alone ordered his death; that later tellings moved the blame onto the Jewish people; and that Greek-speaking missionaries, starting from Antioch, remade his message. He writes as a Unitarian and does not take the resurrection, the virgin birth or the Trinity as history."),
      T("reading", "This project's view: most Christians and many historians would disagree with parts of that. Some of his sources are dated, among them Robert Eisler's reconstruction of an armed rising and the old theory of a dying and rising god."),
      T("reading", "What is ours, not his. He never calls Jesus a bridge and never uses the cross as a figure of two directions. The line through the zero point, and the reading of it as the straight-up line, are this project's."),
      T("said", rowSentence("0.4.1", 0)),
    ]) }),
    freeze({ heading: "Neighbours of this page", items: freeze([
      T("reading", "The Learning Hub has a page called “Control Panel”. This is another page, with another job."),
      T("reading", "The Biomesh AI Control Panel is another page of this site. This page controls nothing but its own chart."),
      T("reading", "A Celestial Observatory is planned in the Celestial Hypersim Explorer. This page is a static sketch toward it."),
    ]) }),
    freeze({ heading: "This page", items: freeze([
      T("reading", "The three reading levels are the same three levels First Explorers calls Stargazer, Explorer and Architect."),
      T("checked", "Location is typed or chosen, never read from the device, and nothing is stored by this page."),
      T("checked", "The only request to another host is for web fonts (Google Fonts); the page works without them."),
      T("checked", "The key that signs a seal is made for this visit and shows integrity, not identity."),
      T("reading", "Code: MIT. Quoted texts belong to their rights holders and are not covered by that licence."),
    ]) }),
  ]),
});

const ringRadius = (key) => Number(Math.tanh(RING_BY_KEY.get(key).rho / 2).toFixed(2));
const holds = (from, to) => OBJECTS.filter((o) => (o.kind === "body" || o.key === "cmb") && F.radii[o.key] >= from && F.radii[o.key] < to).map((o) => o.label);
/**
 * BLUEPRINT: the "Blueprint" dialog: title, badge (the whole scale is READING), pillars: [{ title, text: { layer, text } }] (the three pillars,
 * corrected wording), shells: [{ key, name, prototype (its name and radius in the prototype), from, to (disc radii on the real scale), holds: [labels],
 * text: { layer, text } }] (the four shells as named ranges over the rings) and lenses: [{ id, label, hint, text }] (the age-lens card).
 */
export const BLUEPRINT = freeze({
  title: "Blueprint",
  heading: "Three pillars and four shells",
  badge: T("reading", "The whole scale is this project's reading: a chosen way of drawing. It is not a claim about the shape of space."),
  pillars: freeze([
    freeze({ title: "Start from where you stand", text: T("reading", "Three questions come first: where on Earth am I standing, what day of the year is it, what shape is the Moon tonight. They put the centre of the map in something anyone can check by looking up.") }),
    freeze({ title: "Far things wait near the rim", text: T("reading", "In the Poincaré picture, equal-sized things are drawn smaller and smaller toward the rim, so an endless amount of room fits inside the circle. Deep material stays near the rim until the move T_c(z) = (z − c)/(1 − c̄z) brings it to the centre.") }),
    freeze({ title: "The same facts at three depths", text: T("reading", "One geometry is told in three vocabularies: Stargazer, Navigator, Holographer. The three are this project's analogy; a child's picture, an astronomer's great circle and a physicist's formula are not claimed to be one object.") }),
  ]),
  shells: freeze([
    freeze({ key: "origin", name: "Where you stand", prototype: "Observer Origin, r = 0.00", from: 0, to: 0, holds: freeze(["Home"]),
      text: T("reading", "The centre of the map: your place on Earth, with your straight-up line through it.") }),
    freeze({ key: "sun-moon", name: "Sun and Moon", prototype: "Solar-Lunar Gate, r ≈ 0.42", from: ringRadius("light-second"), to: ringRadius("light-hour"), holds: freeze(holds(ringRadius("light-second"), ringRadius("light-hour"))),
      text: T("reading", "Between the rings of one light-second and one light-hour: the Moon at " + fixed(F.radii.moon, 2) + " and the Sun at " + fixed(F.radii.sun, 2) + " of the radius.") }),
    freeze({ key: "galaxy", name: "The Galaxy", prototype: "Galactic Scaffolds, r ≈ 0.76", from: ringRadius("light-year"), to: ringRadius("million-light-years"), holds: freeze(holds(ringRadius("light-year"), ringRadius("million-light-years"))),
      text: T("reading", "Between the rings of one light-year and one million light-years: the stars and the black holes of our own galaxy, from " + fixed(F.radii.polaris, 2) + " to " + fixed(F.radii.sgr_a_star, 2) + " of the radius.") }),
    freeze({ key: "rim", name: "Beyond the Galaxy, and the rim", prototype: "Celestial Hologram, r → 1.00", from: ringRadius("million-light-years"), to: 1, holds: freeze([...holds(ringRadius("million-light-years"), 1), "the points of the rim"]),
      text: T("reading", "Outside the ring of one million light-years: Andromeda at " + fixed(F.radii.m31, 2) + ", the microwave background at " + fixed(F.radii.cmb, 2) + ", and the rim itself, where directions live and the proposals are set.") }),
  ]),
  lenses: freeze(LENSES.map((l) => freeze({ id: l.id, label: l.label, hint: LENS_HINTS[l.id], text: T("reading", {
    stargazer: "Short sentences and everyday words, with nothing made false to keep it simple.",
    navigator: "Names, dates and numbers with their units.",
    holographer: "Formulas, groups and formats.",
  }[l.id]) }))),
});

// ─── 13. every Stargazer string, for the all-ages test ───────────────────────

/** stargazerStrings() -> [{ where, text }]: every string of this module that a visitor at the Stargazer lens can read (TEXT quotations left out), with samples of the sentences the functions build. */
export function stargazerStrings() {
  const out = [], add = (where, text) => { if (typeof text === "string" && text !== "") out.push({ where, text }); };
  for (const s of STEPS) {
    add("step " + s.key + " title", s.stargazerTitle);
    add("step " + s.key + " question", s.question.stargazer);
    s.say.stargazer.forEach((p, i) => add("step " + s.key + " say " + i, p.text));
    if (s.bridge.opening) add("step " + s.key + " opening", s.bridge.opening.stargazer.text);
    add("step " + s.key + " reading", s.bridge.reading.stargazer.text);
    s.bridge.stands.forEach((x, i) => { if (x.layer !== "text") add("step " + s.key + " stand " + i, x.stargazer || x.text); if (x.note) add("step " + s.key + " stand " + i + " note", x.note.text); });
    s.bridge.links.forEach((k, i) => add("step " + s.key + " link " + i, k.label));
  }
  add("first run say", FIRST_RUN.say.stargazer.text); add("first run card", FIRST_RUN.card.text); add("first run after", FIRST_RUN.afterDefault.text);
  add("first run help", FIRST_RUN.typeHelp);
  for (const [k, v] of Object.entries(FIRST_RUN.buttons)) add("first run button " + k, v);
  for (const o of OBJECTS) {
    if (o.minLens || (o.frames && !o.frames.includes("hor"))) continue;
    add("object " + o.key + " name", o.stargazer);
    if (o.text) o.text.stargazer.forEach((p, i) => add("object " + o.key + " text " + i, p.text));
  }
  for (const o of OVERLAYS) add("overlay " + o.key, o.stargazer);
  for (const q of QUICK) add("quick " + q.key, q.stargazer);
  for (const b of TIME_BUTTONS) add("time " + b.key, b.label);
  for (const p of PHASE_TARGETS) add("moon name " + p.name, moonWords(p.name, "stargazer", true));
  add("moon check", MOON_COPY.check.stargazer.text); add("moon below", MOON_COPY.below); add("moon find", MOON_COPY.findLabel); add("moon computed", MOON_COPY.computed.text);
  add("hud slide", HUD_COPY.stargazer.text); add("hud rim", HUD_COPY.rim.text);
  add("lab caption", LAB.caption);
  for (const k of ["open", "four", "play", "pause", "next", "home", "again", "tile", "challenge"]) add("lab " + k, LAB_COPY[k]);
  for (const [k, v] of Object.entries(LAB_COPY.slide)) add("lab slide " + k, v);
  add("lab close", LAB_COPY.close.stargazer); add("lab step", LAB_COPY.step.stargazer); add("lab tiling", LAB_COPY.tiling.stargazer); add("lab tile note", LAB_COPY.tileNote.text); add("lab flat", LAB_COPY.flat.text);
  for (const b of DAY_BUTTONS) add("day " + b.key, b.label);
  for (const [k, v] of Object.entries(CONTROLS)) {
    if (typeof v === "string") add("control " + k, v);
    else if (typeof v.stargazer === "string") add("control " + k, v.stargazer);
    else for (const [k2, v2] of Object.entries(v)) add("control " + k + " " + k2, typeof v2 === "string" ? v2 : v2.stargazer);
  }
  add("seal pass", SEAL_COPY.pass.stargazer); add("seal fail", SEAL_COPY.fail.stargazer); add("seal about", SEAL_COPY.about.stargazer.text); add("seal privacy", SEAL_COPY.privacy.stargazer.text);
  add("seal witness", SEAL_COPY.witness.stargazer.text); add("seal kebar", SEAL_COPY.kebar.text); add("seal need", SEAL_COPY.needPlace);
  add("seal button", SEAL_COPY.buttons.seal.stargazer); add("seal file", SEAL_COPY.buttons.file.stargazer); add("seal open", SEAL_COPY.buttons.open); add("seal copy", SEAL_COPY.buttons.copy);
  add("certified", CERTIFIED_STARGAZER.text);
  add("ezekiel title", EZEKIEL_COPY.title); add("ezekiel line", EZEKIEL_COPY.stargazer.text); add("ezekiel hour", EZEKIEL_COPY.noHour.text);
  for (const [k, v] of Object.entries(MESSAGES)) if (k !== "timeLabel" && k !== "calendar") add("message " + k, v);
  add("dialog title", DIALOG.title); add("dialog first", DIALOG.first.text);
  DIALOG.inShort.forEach((p, i) => add("dialog in short " + i, p.text));
  LEGEND.forEach((p, i) => add("legend " + i, p.text));
  add("badge help", BADGE_HELP);
  // samples of what the functions build, at Greenwich on a modern evening and for the Kebar preset
  const samples = [
    setStep(confirmDay(chooseSite(initialState({ nowMs: Date.UTC(2026, 10, 14, 18, 0, 0) }), "greenwich")), 3),
    setStep(initialState({ hash: "#preset=ezekiel", nowMs: 0 }), 3),
  ];
  samples.forEach((st, n) => {
    const tag = "sample " + n + " ";
    const day = dateView(st).parts;                                  // the day question in its three forms: the device on the same day, on another day, not known
    add(tag + "day question", dayQuestion(st, day).text);
    add(tag + "day question other", dayQuestion(st, { year: 2026, month: 11, day: 13 }).text);
    add(tag + "day question alone", dayQuestion(st).text);
    add(tag + "status", statusSentence(st));
    add(tag + "caption", sceneCaption({ ...st, dims: "2D" })); add(tag + "caption 3D", sceneCaption({ ...st, dims: "3D" }));
    const m = moonFigure(st);
    add(tag + "moon label", m.label); m.lines.forEach((t, i) => add(tag + "moon line " + i, t));
    objectList(st).forEach((o) => add(tag + "list " + o.key, o.name));
    for (const o of OBJECTS) { const ins = inspector(toggleOverlay(st, "rings"), o.key); if (ins) { ins.rows.forEach((r, i) => add(tag + "inspector " + o.key + " row " + i, r.label + ": " + r.value)); if (!o.text) ins.paragraph.forEach((x) => add(tag + "inspector " + o.key + " text", x.text)); } }
    hud(dive(dive(st, "moon"), "moon")).lines.forEach((t, i) => add(tag + "hud " + i, t.text));
    add(tag + "find moon", findMoon(st, 180).note);
    placeReadout(st).forEach((r, i) => add(tag + "place row " + i, r.label + ": " + r.value));
    dayReadout(st).forEach((r, i) => add(tag + "day row " + i, r.label + ": " + r.value));
    add(tag + "next step", (nextStep(st) || { label: "" }).label);
    for (const key of ["moon", "m31", "sgr_a_star", "north", "holography", "cmb"]) {
      const half = dive(st, key), there = dive(half, key);
      add(tag + "centre half " + key, centreWords(half)); add(tag + "centre " + key, centreWords(there));
      add(tag + "caption centred " + key, chartCaption(there, { rimLabel: "", centreCaption: "" }));
    }
    add(tag + "centre free", centreWords(nudgeView(st, "left")));
    for (const lat of [51, -34, 0, 80, -80]) for (const month of [3, 6, 9, 12]) add(tag + "season " + lat + " " + month, seasonLine(pickDate(typePlace(st, lat, 10).state, { year: 2026, month, day: 12 }).state).text);
  });
  for (const n of [2, 3, 4]) add("next " + n, nextStep(setStep(samples[0], n)).label);
  add("strix name", STRIX.name); add("strix all", STRIX.all); add("strix more", STRIX.more); add("strix more from", STRIX.moreFrom);
  add("blueprint badge", BLUEPRINT.badge.text);
  add("lab four at once", LAB_COPY.fourAtOnce);
  add("lab tile home", labReadout(labHome(labTile(labStart())), "stargazer").text); add("lab tile area", labReadout(labHome(labTile(labStart())), "stargazer").area.text);
  add("lab start", labReadout(labStart(), "stargazer").text);
  const four = labFour(labStart());
  add("lab four", labReadout(four, "stargazer").text); add("lab four flat", labReadout(four, "stargazer").flat);
  const back = labReadout(labHome(four), "stargazer");
  add("lab home", back.text); add("lab area", back.area.text);
  const straight = labSlide(labStart(), "forward"), eight = ["forward", "forward", "left", "left", "back", "back", "right", "right"].reduce((l, d) => labSlide(l, d), labStart());
  add("lab straight", labReadout(straight, "stargazer").text); add("lab straight home", labReadout(labHome(straight), "stargazer").text);
  add("lab wide area", labReadout(labHome(eight), "stargazer").area.text);
  add("lab crosses", LAB_COPY.crosses);
  add("pick date", pickDate(samples[0], { year: 2027, month: 2, day: 29 }).message);
  add("epoch line", epochLine({ epoch: 3, epochs: 4 }, "stargazer"));
  return out;
}
