// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Lexicon Explorer: the model. Everything the page needs that is not drawing and not DOM: the copy tables, the
// lists, the link grammar and every pure function of the page's state. No document, no window, nothing stored.
// lexicon-canvas.js draws from it; lexicon-explorer.js (the shell) builds the page from it.
// Tested by tests/unit/lexicon-explorer-model.test.mjs. Each export has a one-line description above it.
//
// MAP OF THE MODULE (section: what it exports)
//   1  helpers       numberWord, timesWord, sentencesOf
//   2  lexicons      PAGE, HOME, READER_VERSES, MAX_FILE_BYTES, makeLexicon, EZEKIEL, entryOf, hasPlace, childrenOf,
//                    lexiconTextOf, packetsOf, lineShaOf, layoutOf, layerCountsOf, topLevelOf, skyLexicon
//   3  links         HASH_GRAMMAR, SKY_PAGE_GRAMMAR, IGNORED_NOTE, UNKNOWN_ENTRY_NOTE, parseHash, formatHash, entryHref,
//                    skyPageHref, firstExplorersHref
//   4  names         ROOT_NAME, nameOf, displayName, crumbOf, pathOf, pathCaption, shortLabel, isAuthorLine, badgeView, AUTHOR_LABEL,
//                    LINE8_FRAMING, LINE8_FRAMING_STARGAZER, LINE8_RESTATED, quoted
//   5  reader        SUPPLIED, WORDINGS, WORDINGS_NOTE, suppliedAvailable, defaultWording, wordingFor, spansOf, termsOfVerse,
//                    verseView, TRADITION_LINK, readerHead, readerView, verseOfTerm
//   6  counting      wordMatches, markSpans, countTable, countMarks, COUNT_NOTE, countWithMe
//   7  entry         ENTRY_PROMPT, MORE_LABEL, BROKEN_LINK, ENTRY_GROUPS, OUTSIDE_ROWS_HEADING, ENTRY_LEADS, NOTES_INVITE,
//                    POINTER_ADDRESSES, pointerOf, pointedFrom, rowView, firstFacet, entryView, statusFor
//   8  list and keys LIST_KEYS, neighbourhood, treeNav, treeKey
//   9  state         DEFAULT_ORBIT, homeView, viewAt, initialState, applyHash, selectEntry, setLens, setWording,
//                    stationFor, tabFor
//   10 tree          RIM_CUT, LABEL_CHILDREN_MAX, TREE_LABEL, treeScene, treeHit, treeCaption, TREE_PRICE, flightPlan,
//                    VIEW_REACH, rebaseView, NUDGE_STEP, nudgeView, dragView, orbitDrag, orbitTurn, PLACE_LABELS, placeNumbers
//   11 word wheel    WHEEL_RHO, WHEEL_RINGS, WHEEL_RADII, WHEEL_CELL_AREA, WORD_FIELDS, GUARD_LIGHT, ringBounds, lightName,
//                    wheelCells, wheelHit, squareHit, fieldArcs, quadrantArcs, flipLights, toggleFlip, packetOfEntry, wheelView,
//                    sectorLights, WHEEL_COPY, wheelAuthorLine
//   12 fourth square TQF_GRID, TQF_PRESETS, threeSquares, tqfSnap, tqfPlace, tqfNearest, TQF_MOVES, tqfStep, nextWrongBit,
//                    MIRROR_STARGAZER, MIRROR_BOX, mirrorCaptionStargazer, FOURTH_LINE, mirrorFigure, mirrorWords,
//                    quarterFigure, squaresFigure, cornersFigure, CERTIFIED, CERTIFIED_TEXT, CERTIFIED_STARGAZER
//   13 flows (async) epochRows, epochLine, packageFileName, sealLexicon, PASS_WORDING, CHAIN_NAME_LABEL, OWN_KEY_NOTE, sealView,
//                    RESEAL_TEXT, TAMPER_COPY, tamperRows, tamperSentence, runTamper, RECEIVERS, NOISY_ROAD, WITNESS_MARKS,
//                    makeReceivers, noisyWire, QUORUM_LIMIT, quorumSentence, handshakeCount, SEND_READING, sendToReceivers
//   14 outside       OUTSIDE_NOTICE, OUTSIDE_BANNER, OUTSIDE_SHORT, OUTSIDE_LEGEND, SHOW_IT, LOAD_COPY, CHECK_SENTENCES, fileAllowed,
//                    LEDGER_POINTS, LEDGER_CUT_NOTE, LEDGER_ROWS, readOutside
//   15 copy          verseSlice, COPY_FACTS, KEBAR_NAZARETH, LENS_HINTS, FIRST_LINE, BRIDGE_TITLE, BRIDGE_PARTS, BRIDGE_OPENING,
//                    STATIONS, FOURTH_PARTS, FOURTH_VERSE, TABS, visibleStations, visibleTabs, BRIDGE_GO, BRIDGE_FLY,
//                    FIRST_EXPLORERS_LINK, bridgeView, stationView, UI, uiLabel, SKY_BANNER, MORE_LEVELS, moreLevelsFor, SKY_PRIVACY
//   16 dialog        DIALOG
//   17 all ages      stargazerStrings
//
// CONVENTIONS
//   Lexicon   a frozen record { origin, title, home, entries, byAddress (Map), children (Map), addresses }.
//             origin is "builtin" (EZEKIEL), "page" (a sky recomputed from a link) or "outside" (a package file).
//             The root "" is a place of the tree and can be the focus or the selection; it is not an entry.
//   State     plain data made by initialState(): { lens, dims, station, lexicon, sky, verse, selected, view: { focus,
//             local }, orbit, flight, wording, wordingChosen, tab, marks, filter, counting, wheel: { packet, flips, view,
//             sector }, square: { points, seed, hidden, wrongBit, packet }, place: { from, to }, seal, tampers, send,
//             outside, busy, notes }. The functions here return new states; nothing is stored anywhere.
//   Layers    every sentence is { layer, text }, layer one of text, said, checked, reading. A TEXT sentence is cut
//             out of a verse row of ezekiel-1.js by verseSlice(); it is never typed here.
//   Tree      scene positions are points of the unit disc or ball, x right and y UP: draw at (cx + R·x, cy − R·y).
//             The view is { focus, local }. To go to an entry: plan = flightPlan(lexicon, dims, view, target), draw
//             treeScene(lexicon, plan.at(t), dims) for t from 0 to 1, then keep plan.to (with reduced motion: plan.to at
//             once). After a drag or a nudge keep what dragView / nudgeView return (they re-base the view).
//             A tap: the node within reach wins (hit test of the kit over scene.nodes), else treeHit() gives the cell.
//   Wheel     wheel positions are measured from the wheel's centre in units of its radius, x right and y DOWN.
//   Names     an entry's own name (entry.name, nameOf) is what is sealed. What a lens shows is displayName(lexicon, address, lens):
//             every view here that takes a lens (entryView, rowView, neighbourhood, statusFor, treeCaption, pointerOf, and
//             treeScene with the option lens) gives the name as shown, so the shell and the canvas print what they are given.
//   Strings   a string from a lexicon of origin "outside" is the sender's: the shell puts it through outsideText().
//             Nothing here turns a lexicon string into a URL, an id, a class or an object key (Map lookups only).
//   Flows     sealLexicon, runTamper, makeReceivers, sendToReceivers and readOutside are async and never throw on what a
//             package or a link contains; wrap each in withBusy() of the kit and paint in onEpoch / onAnswer.
//   Supplied  the functions of the reader take the supplied-passage module as a record (default SUPPLIED), so both
//             of its states can be tested: with verses, and emptied to {} (then there is no wording switch).

import {
  IDENT, lmul, linv, lapply, originOf, toBall, rotX, rotY, boostAlong, geodesic,
  CROSSROADS, PACKET_FIELDS, decodePacket, flipBit, newSessionKeys, issueCertificate, makeHyperpack, answerHyperpack,
  makeEntry, lexiconText, parentOf, depthOf, childrenIndex, layerCounts, countWord, profileOf, treeLexiconOf,
  buildLexiconBundle, lexiconPackets, entryPacketIndex, entriesOfPack, readHyperpack,
  glyphCells, seedMirror, squareQuarters, fourthFromThree, quarterParities, witnessQuorum, LEXICON_TAMPERS,
} from "../../../scripts/strix-overwatch.js";
import {
  fromBall, centreOn, equalAreaRings, discRadius, cellArea, treeLayout, relativeFrame, relativeFrames, cellWall, treePath,
  cellAt, gramTqf, squareNumbersNext, lambertAngle, tilingConstants,
} from "../../../scripts/hyperbolic-moves.js";
import { skyState, skyLexiconRows, skyInputsValid, roundSkyInputs, formatSkyInputs, bearingAndDistance, SITES } from "../../../scripts/celestial-core.js";
import { sealIdFromPublic } from "../../../scripts/seal-crypto.js";
import {
  LINKS, LENSES, LAYER_META, AUTHOR_NOTE_WORD, BADGE_HELP, HASH_PATTERNS, hashNumber, hashOneOf, hashTuple,
  parseHashWith, formatHashWith, cutLabel,
} from "../explorer-kit.js";
import { TITLE, ROWS, HANDLES, COUNT_WORDS } from "./ezekiel-1.js";
import { SUPPLIED_NOTICE, SUPPLIED_NOTE, SUPPLIED_VERSES, SUPPLIED_TERMS } from "./passage-as-supplied.js";

// ─── 1. small helpers ────────────────────────────────────────────────────────

const freeze = Object.freeze;
const LENS_IDS = freeze(LENSES.map((l) => l.id));
const lensOf = (lens) => (LENS_IDS.includes(lens) ? lens : "stargazer");
const LAYER_BY_ID = new Map(LAYER_META.map((m) => [m.id, m]));
const NUMBER_WORDS = freeze(["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"]);
/** numberWord(n) -> "five" for 0..16, the digits otherwise. */
export const numberWord = (n) => (Number.isInteger(n) && n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n));
/** timesWord(n) -> "once", "twice", "three times", "not at all" for 0. */
export const timesWord = (n) => (n === 0 ? "not at all" : n === 1 ? "once" : n === 2 ? "twice" : numberWord(n) + " times");
const plural = (n, one, many) => (n === 1 ? "1 " + one : n + " " + many);

/** sentencesOf(text) -> the sentences of a text (a split after . ! ? and an optional closing quote or bracket). */
export function sentencesOf(text) {
  return String(text).split(/(?<=[.!?]["”)]?)\s+(?=[A-Z0-9("“'‘])/u).filter((s) => s !== "");
}

// ─── 2. lexicons: the built-in one, a sky, one from outside ──────────────────
// A lexicon here is a frozen record { origin, title, home, entries, byAddress, children, addresses }.
//   origin  "builtin" (the Ezekiel lexicon shipped with the page), "page" (a sky this page recomputed from three
//           numbers of a link) or "outside" (read from a package file: its words and labels are its sender's).
//   home    the entry "Home" means: 26.1 for the built-in lexicon, the root "" for every other.
// The root "" is a place of the tree (its children are the top-level entries) but it is not an entry.

/** PAGE: the title of the page and the line under it (stargazerSubtitle at the Stargazer lens: "hyperbolic" is not a Stargazer word). */
export const PAGE = freeze({ title: "Lexicon Explorer", subtitle: "Ezekiel 1:1-9 in hyperbolic space", stargazerSubtitle: "Ezekiel 1:1-9 on a curved map" });
/** HOME: the address the built-in lexicon opens on and "Home" returns to. */
export const HOME = "26.1";
/** READER_VERSES: the addresses of the nine verses of the reader, in order. */
export const READER_VERSES = freeze(["26.1.1", "26.1.2", "26.1.3", "26.1.4", "26.1.5", "26.1.6", "26.1.7", "26.1.8", "26.1.9"]);
/** MAX_FILE_BYTES: a package file larger than this is not read. */
export const MAX_FILE_BYTES = 4500000;

const LAYOUTS = new WeakMap(), TEXTS = new WeakMap(), PACKETS = new WeakMap(), LINE_SHAS = new WeakMap();

/** makeLexicon(entries, origin, title, home) -> a frozen lexicon record (entries are makeEntry results in canonical order). */
export function makeLexicon(entries, origin, title, home) {
  const list = freeze(entries.slice());
  const byAddress = new Map(list.map((e) => [e.address, e]));
  return freeze({
    origin, title: String(title), home: home === "" || byAddress.has(home) ? home : "",
    entries: list, byAddress, children: childrenIndex(list), addresses: freeze(list.map((e) => e.address)),
  });
}
/** EZEKIEL: the built-in lexicon, built from ROWS when the module loads (origin "builtin", home 26.1). */
export const EZEKIEL = makeLexicon(ROWS.map((r) => makeEntry(...r)), "builtin", TITLE, HOME);

/** entryOf(lexicon, address) -> the entry, or null (Map lookup; "" and unknown addresses give null). */
export const entryOf = (lexicon, address) => lexicon.byAddress.get(address) || null;
/** hasPlace(lexicon, address) -> true for an entry's address and for the root "". */
export const hasPlace = (lexicon, address) => address === "" || lexicon.byAddress.has(address);
/** childrenOf(lexicon, address) -> the child addresses in canonical order ([] for a leaf or an unknown address). */
export const childrenOf = (lexicon, address) => lexicon.children.get(address) || [];
/** lexiconTextOf(lexicon) -> the LEXICON/2 text (cached). */
export function lexiconTextOf(lexicon) {
  if (!TEXTS.has(lexicon)) TEXTS.set(lexicon, lexiconText(lexicon.entries));
  return TEXTS.get(lexicon);
}
/** packetsOf(lexicon) -> the 16-hex-digit packet of every 720-byte chunk of the text (cached; works before sealing). */
export function packetsOf(lexicon) {
  if (!PACKETS.has(lexicon)) PACKETS.set(lexicon, freeze(lexiconPackets(lexiconTextOf(lexicon))));
  return PACKETS.get(lexicon);
}
/** lineShaOf(lexicon, address) -> the SHA-256 of the entry's LEX/1 line, or null. */
export function lineShaOf(lexicon, address) {
  if (!LINE_SHAS.has(lexicon)) LINE_SHAS.set(lexicon, new Map(treeLexiconOf(lexicon.entries).entries.map((e) => [e.address, e.lineSha])));
  return LINE_SHAS.get(lexicon).get(address) || null;
}
/** layoutOf(lexicon, dims) -> the treeLayout Map for "2D" or "3D" (cached per lexicon). */
export function layoutOf(lexicon, dims) {
  const d = dims === "3D" ? "3D" : "2D";
  let both = LAYOUTS.get(lexicon);
  if (!both) { both = {}; LAYOUTS.set(lexicon, both); }
  if (!both[d]) both[d] = treeLayout(lexicon.addresses, d);
  return both[d];
}
/** layerCountsOf(lexicon) -> { text, said, checked, reading, total }. */
export function layerCountsOf(lexicon) {
  const c = layerCounts(lexicon.entries);
  return { ...c, total: lexicon.entries.length };
}
/** topLevelOf(lexicon) -> the top-level entries (one growth epoch each). */
export const topLevelOf = (lexicon) => childrenOf(lexicon, "").map((a) => lexicon.byAddress.get(a));

// Three numbers are judged as both pages use them: rounded (roundSkyInputs) and then inside the range of the core.
const skyRounded = (jd, lat, lon) => { try { const r = roundSkyInputs(jd, lat, lon); return skyInputsValid(r.jdUt, r.lat, r.lonEast); } catch { return false; } };
/** skyLexicon([jd, lat, lon]) -> { ok, lexicon, sky: { jd, lat, lon } (link text), why }: the sky lexicon recomputed from three numbers. */
export function skyLexicon(sky) {
  const bad = (why) => ({ ok: false, lexicon: null, sky: null, why });
  if (!Array.isArray(sky) || sky.length !== 3 || !sky.every((n) => typeof n === "number")) return bad("A sky is three numbers: a Julian Day, a latitude and a longitude.");
  const [jd, lat, lon] = sky;
  if (!skyRounded(jd, lat, lon)) return bad("These three numbers are outside what this page can work out.");
  try {
    const rows = skyLexiconRows(skyState(jd, lat, lon));
    const entries = rows.map((r) => makeEntry(...r));
    const title = "A sky: " + rows[1][3] + ", " + rows[2][3];
    return { ok: true, lexicon: makeLexicon(entries, "page", title, ""), sky: formatSkyInputs(jd, lat, lon), why: null };
  } catch { return bad("This sky could not be worked out."); }
}

// ─── 3. links: the one grammar (#key=value&key=value) ────────────────────────
// This page reads sky (three numbers), entry (an address) and lens. It emits links to the Celestial Control
// Panel with preset=ezekiel or lab=square, or with the place and time of the sky on show (jd, lat, lon: that page's own
// keys), always with the lens.

const SKY_TUPLE = hashTuple(hashNumber(HASH_PATTERNS.jd, 0, 9999999), hashNumber(HASH_PATTERNS.lat, -90, 90), hashNumber(HASH_PATTERNS.lon, -180, 180));
const skyRule = (text) => { const t = SKY_TUPLE(text); return t && skyRounded(t[0], t[1], t[2]) ? t : undefined; };
/** HASH_GRAMMAR: the keys this page reads: sky=JD,LAT,LON, entry=ADDRESS, lens. */
export const HASH_GRAMMAR = freeze([freeze(["sky", skyRule]), freeze(["entry", HASH_PATTERNS.address]), freeze(["lens", hashOneOf(LENS_IDS)])]);
// The sky page's own rule for the key jd, the same in effect: the text fits the pattern, the number lies between 0 and 9999999, and the
// core accepts it at some longitude (a place is at most half a day from Greenwich, east or west). The place is judged with the sky itself.
const skyPageJd = (text) => { const n = hashNumber(HASH_PATTERNS.jd, 0, 9999999)(text); return n !== undefined && (skyInputsValid(n, 0, -180) || skyInputsValid(n, 0, 180)) ? n : undefined; };
/** SKY_PAGE_GRAMMAR: the keys of the links this page writes to the Celestial Control Panel. */
export const SKY_PAGE_GRAMMAR = freeze([freeze(["preset", freeze(["ezekiel"])]),
  freeze(["jd", skyPageJd]), freeze(["lat", hashNumber(HASH_PATTERNS.lat, -90, 90)]), freeze(["lon", hashNumber(HASH_PATTERNS.lon, -180, 180)]),
  freeze(["lab", freeze(["square"])]), freeze(["lens", hashOneOf(LENS_IDS)])]);
/** IGNORED_NOTE: the line shown when a link carried something this page did not use. */
export const IGNORED_NOTE = "a link value was ignored";
/** UNKNOWN_ENTRY_NOTE: the line shown when a link names an address this lexicon does not have. */
export const UNKNOWN_ENTRY_NOTE = "That link names an entry this lexicon does not have.";

/** parseHash(hash) -> { values: { sky: [jd, lat, lon], entry, lens } (only valid keys), ignored (count), note ("" or IGNORED_NOTE) }; never throws. */
export function parseHash(hash) {
  const { values, ignored } = parseHashWith(HASH_GRAMMAR, hash);
  return { values, ignored, note: ignored > 0 ? IGNORED_NOTE : "" };
}
/** formatHash({ sky, entry, lens }) -> "#sky=…&entry=…&lens=…" or ""; sky is [jd, lat, lon] as numbers (rounded here) or as link text; throws on a value parseHash would refuse. */
export function formatHash(obj) {
  const o = { ...(obj || {}) };
  if (Array.isArray(o.sky) && o.sky.length === 3 && o.sky.every((n) => typeof n === "number")) {
    const s = formatSkyInputs(o.sky[0], o.sky[1], o.sky[2]);
    o.sky = [s.jd, s.lat, s.lon];
  }
  return formatHashWith(HASH_GRAMMAR, o);
}
/** entryHref(address, lens, sky) -> this page's own URL with the fragment for an entry (for "copy a link" and for history). */
export const entryHref = (address, lens, sky) => LINKS.lexiconExplorer + formatHash({ sky: sky || null, entry: address || null, lens: lensOf(lens) });
/** skyPageHref("date" | "lab" | "home" | "sky", lens, sky) -> the Celestial Control Panel's URL with preset=ezekiel, lab=square, the lens alone,
 *  or ("sky") the place and time of a sky as that page reads them (sky is the state's { jd, lat, lon }, link text; without one, or with a
 *  value that page would not read: the lens alone). No stamp and no name is ever put into a link. Never throws. */
export function skyPageHref(what, lens, sky) {
  let o = what === "date" ? { preset: "ezekiel" } : what === "lab" ? { lab: "square" } : {};
  if (what === "sky" && sky && [sky.jd, sky.lat, sky.lon].every((x) => typeof x === "string" || typeof x === "number")) o = { jd: String(sky.jd), lat: String(sky.lat), lon: String(sky.lon) };
  try { return LINKS.celestialControlPanel + formatHashWith(SKY_PAGE_GRAMMAR, { ...o, lens: lensOf(lens) }); }
  catch { return LINKS.celestialControlPanel + formatHashWith(SKY_PAGE_GRAMMAR, { lens: lensOf(lens) }); }
}
/** firstExplorersHref() -> the URL of First Explorers. */
export const firstExplorersHref = () => LINKS.firstExplorers;

// ─── 4. names, paths and badges ──────────────────────────────────────────────

const lastIndexOf = (address) => address.slice(address.lastIndexOf(".") + 1);
const STRUCTURE_KINDS = new Set(["book", "chapter", "verse", "term"]);
/** ROOT_NAME: what the root "" is called in lists and captions. */
export const ROOT_NAME = "The whole lexicon";

/** nameOf(lexicon, address) -> the entry's name, ROOT_NAME for "", "" for an unknown address. */
export const nameOf = (lexicon, address) => (address === "" ? ROOT_NAME : (entryOf(lexicon, address) || { name: "" }).name);
// Five entries of the built-in lexicon carry a name written for older readers: the four verse rows named "… (context)" and entry 0.1.
// At Stargazer they are shown under another name. No row and no seal changes: the name is chosen where the model builds what a lens shows.
const STARGAZER_NAMES = new Map([["0.1", "How this lexicon is sorted"]]);
const CONTEXT_NAME = / \(context\)$/, NEARBY_NAME = " (a verse nearby)";
/** displayName(lexicon, address, lens) -> the name an entry is shown under at that lens: its own name (nameOf), except at Stargazer in the
 *  built-in lexicon for entry 0.1 ("How this lexicon is sorted") and for a verse named "… (context)" ("Ezekiel 1:10 (a verse nearby)").
 *  Every list row, card title, row, link, Go-to button, caption and canvas label this module builds for a lens takes its name from here;
 *  the sealed name (nameOf, entry.name) is what is sealed, sent and written in a package. Without a lens: the entry's own name. */
export function displayName(lexicon, address, lens) {
  const name = nameOf(lexicon, address), e = entryOf(lexicon, address);
  if (lens !== "stargazer" || lexicon.origin !== "builtin" || !e) return name;
  return STARGAZER_NAMES.get(address) || (e.kind === "verse" ? name.replace(CONTEXT_NAME, NEARBY_NAME) : name);
}
/** crumbOf(lexicon, address, lens) -> the short word for an entry in a path: "chapter 1", "verse 4", otherwise its name (displayName). */
export function crumbOf(lexicon, address, lens) {
  const e = entryOf(lexicon, address);
  if (!e) return address === "" ? ROOT_NAME : "";
  if (lexicon.origin === "builtin" && e.kind === "chapter") return "chapter " + lastIndexOf(address);
  if (lexicon.origin === "builtin" && e.kind === "verse") return "verse " + lastIndexOf(address);
  return displayName(lexicon, address, lens);
}
/** pathOf(lexicon, address, lens) -> [{ address, name, crumb }] from the top-level ancestor down to the entry (names as displayName gives them). */
export function pathOf(lexicon, address, lens) {
  const out = [];
  for (let a = address; a !== "" && lexicon.byAddress.has(a); a = parentOf(a)) out.unshift({ address: a, name: displayName(lexicon, a, lens), crumb: crumbOf(lexicon, a, lens) });
  return out;
}
/** pathCaption(lexicon, address, lens) -> "Ezekiel > chapter 1 > verse 1 > the river of Chebar". For a lexicon from outside the caption is made of
 *  addresses ("26 > 26.1 > 26.1.1"): its names are its sender's and are shown one by one from pathOf(), never inside a sentence of the page. */
export const pathCaption = (lexicon, address, lens) => (address === "" ? ROOT_NAME : pathOf(lexicon, address, lens).map((p) => (lexicon.origin === "outside" ? p.address : p.crumb)).join(" > "));
/** shortLabel(lexicon, address, lens) -> the label drawn on the canvas: "1:4" for a verse, otherwise the first 18 code points of the name (displayName). */
export function shortLabel(lexicon, address, lens) {
  const e = entryOf(lexicon, address);
  if (!e) return address === "" ? "All" : "";
  if (lexicon.origin === "builtin" && e.kind === "verse" && depthOf(address) === 3) { const p = address.split("."); return p[1] + ":" + p[2]; }
  return cutLabel(displayName(lexicon, address, lens), 18);
}
/** isAuthorLine(lexicon, address) -> true for the rows 100.1 to 100.10 of the built-in lexicon (the author's ten lines). */
export function isAuthorLine(lexicon, address) {
  const e = entryOf(lexicon, address);
  return !!e && lexicon.origin === "builtin" && parentOf(address) === HANDLES.notes && /^Line \d+$/.test(e.name);
}
/** badgeView(lexicon, address | layer, lens) -> { layer, word, shape, colour, outline, by, authorNote }: what badge() of the kit is given. */
export function badgeView(lexicon, addressOrLayer, lens) {
  const e = entryOf(lexicon, addressOrLayer);
  const layer = e ? e.layer : addressOrLayer, meta = LAYER_BY_ID.get(layer) || null, l = lensOf(lens);
  if (!meta) return { layer: null, word: "", shape: "", colour: "", outline: lexicon.origin === "outside", by: "", authorNote: false };
  const outline = lexicon.origin === "outside", authorNote = !!e && isAuthorLine(lexicon, e.address);
  return {
    layer, shape: meta.shape, colour: meta.colour, outline, authorNote,
    word: authorNote ? AUTHOR_NOTE_WORD : l === "stargazer" ? meta.stargazerWord : meta.word,
    by: outline ? "labelled " + meta.word + " by its sender" : "",
  };
}
/** AUTHOR_LABEL: the label over an author's line, per lens. */
export const AUTHOR_LABEL = freeze({ stargazer: "OUR IDEA · the author's note", navigator: "READING · the author's note", holographer: "READING · the author's note" });
/** LINE8_FRAMING: the sentence always shown with the author's line 8 (layer reading). */
export const LINE8_FRAMING = "The author's own words, in the style of the courtroom oath: a warning against leading people away from the truth. The page quotes them. It is not saying them to you.";
/** LINE8_FRAMING_STARGAZER: the same framing in Stargazer sentences. */
export const LINE8_FRAMING_STARGAZER = "These are the author's own words, in the style of a courtroom oath. They warn against leading people away from the truth. The page quotes them. It is not saying them to you.";
/** LINE8_RESTATED: the rows under line 8 that say what the framing says. A card that shows the framing does not list them a second time. */
export const LINE8_RESTATED = freeze(["100.8.1", "100.8.2", "100.8.6"]);
/** quoted(text) -> the text in quotation marks, as an author's line is shown. */
export const quoted = (text) => "“" + text + "”";

// ─── 5. the reader: nine verses, two wordings, terms as buttons ──────────────
// The supplied wording is passed in as { notice, note, verses, terms } so that both states of the module (with
// verses, and emptied to {}) can be tested; the default is what passage-as-supplied.js exports.

/** SUPPLIED: the supplied-passage module as one record { notice, note, verses, terms }. */
export const SUPPLIED = freeze({ notice: SUPPLIED_NOTICE, note: SUPPLIED_NOTE, verses: SUPPLIED_VERSES, terms: SUPPLIED_TERMS });
/** WORDINGS: the two wordings of the reader with the labels of the switch and the name of each translation. */
export const WORDINGS = freeze({
  supplied: freeze({ key: "supplied", label: "The author's passage (NIV)", translation: "New International Version, as the author supplied it" }),
  kjv: freeze({ key: "kjv", label: "King James", translation: "King James Version" }),
});
/** WORDINGS_NOTE: the Stargazer sentences under the wording switch: why there are two wordings and two spellings of the river (layer reading). */
export const WORDINGS_NOTE = freeze({ layer: "reading", text: "The Bible has been put into English many times. Here are two: the one the author sent, and the King James. Kebar and Chebar are one river." });
/** suppliedAvailable(supplied) -> true when the supplied module holds verses (the wording switch is hidden otherwise). */
export const suppliedAvailable = (supplied = SUPPLIED) => !!supplied && !!supplied.verses && READER_VERSES.some((a) => typeof supplied.verses[a] === "string" && supplied.verses[a] !== "");
/** defaultWording(lens, supplied) -> "supplied" at Stargazer when there is a supplied passage, "kjv" otherwise. */
export const defaultWording = (lens, supplied = SUPPLIED) => (lensOf(lens) === "stargazer" && suppliedAvailable(supplied) ? "supplied" : "kjv");
/** wordingFor(state, supplied) -> the wording to show: the visitor's choice once made, else the default of the lens; never "supplied" when there is none. */
export function wordingFor(state, supplied = SUPPLIED) {
  const want = state && state.wordingChosen ? state.wording : defaultWording(state ? state.lens : "stargazer", supplied);
  return want === "supplied" && suppliedAvailable(supplied) ? "supplied" : "kjv";
}

/** spansOf(text, terms) -> { spans: [{ text, term }], unplaced: [address] }: the text cut at the first place each phrase stands
 *  (case-sensitive; terms = [{ address, phrase }]); term is null for plain text. A phrase that is missing or overlaps an earlier one is unplaced. */
export function spansOf(text, terms) {
  const found = [], unplaced = [];
  for (const t of terms) {
    const at = typeof t.phrase === "string" && t.phrase !== "" ? text.indexOf(t.phrase) : -1;
    if (at < 0) unplaced.push(t.address); else found.push({ at, end: at + t.phrase.length, address: t.address });
  }
  found.sort((a, b) => a.at - b.at || a.end - b.end);
  const spans = [];
  let pos = 0;
  for (const f of found) {
    if (f.at < pos) { unplaced.push(f.address); continue; }
    if (f.at > pos) spans.push({ text: text.slice(pos, f.at), term: null });
    spans.push({ text: text.slice(f.at, f.end), term: f.address });
    pos = f.end;
  }
  if (pos < text.length) spans.push({ text: text.slice(pos), term: null });
  return { spans, unplaced };
}
/** termsOfVerse(lexicon, verse) -> the term entries directly under a verse. */
export const termsOfVerse = (lexicon, verse) => childrenOf(lexicon, verse).map((a) => lexicon.byAddress.get(a)).filter((e) => e.kind === "term");
/** verseView(verse, wording, supplied) -> { address, number, name, wording, translation, layer, text, spans, unplaced } for one reader verse. */
export function verseView(verse, wording, supplied = SUPPLIED) {
  const e = entryOf(EZEKIEL, verse);
  if (!e) return null;
  const useSupplied = wording === "supplied" && suppliedAvailable(supplied) && typeof supplied.verses[verse] === "string";
  const terms = termsOfVerse(EZEKIEL, verse);
  const text = useSupplied ? supplied.verses[verse] : e.text;
  const phrases = terms.map((t) => ({ address: t.address, phrase: useSupplied ? (supplied.terms || {})[t.address] : t.name }));
  const w = useSupplied ? WORDINGS.supplied : WORDINGS.kjv;
  return { address: verse, number: Number(lastIndexOf(verse)), name: e.name, wording: w.key, translation: w.translation, layer: "text", text, ...spansOf(text, phrases) };
}
/** TRADITION_LINK: the label of the link from the line above the reader to row 0.3, where the attributed sentences stand. */
export const TRADITION_LINK = "What Jewish tradition says about this chapter";
/** readerHead() -> { layer, source, name, first, last, text, link: { address, label } }: the first and the closing sentences of row 0.3, shown
 *  above the reader. The excerpt leaves out the sentences that name the row's speakers, so it is shown as this project's own framing
 *  (layer reading), and the link leads to the row itself. */
export function readerHead() {
  const e = entryOf(EZEKIEL, HANDLES.tradition);
  if (!e) return null;
  const s = sentencesOf(e.text);
  // a closing sentence that begins "It" needs the sentence before it to say what "it" is
  const first = s[0] || "", tail = s.length > 2 && /^It /.test(s[s.length - 1]) ? s.slice(-2) : s.slice(-1);
  const last = s.length > 1 ? tail.join(" ") : "";
  return { layer: "reading", source: e.address, name: e.name, first, last, text: last ? first + " " + last : first, link: { address: e.address, label: TRADITION_LINK } };
}
/** readerView(wording, supplied) -> { wording, canSwitch, switch: [{ key, label, pressed }], switchNote (WORDINGS_NOTE, shown at Stargazer) | null,
 *  head, verses: [verseView], foot: { notice, note } | null }. */
export function readerView(wording, supplied = SUPPLIED) {
  const can = suppliedAvailable(supplied), w = wording === "supplied" && can ? "supplied" : "kjv";
  return {
    wording: w, canSwitch: can,
    switch: can ? [WORDINGS.supplied, WORDINGS.kjv].map((x) => ({ key: x.key, label: x.label, pressed: x.key === w })) : [],
    switchNote: can ? WORDINGS_NOTE : null,
    head: readerHead(),
    verses: READER_VERSES.map((a) => verseView(a, w, supplied)).filter(Boolean),
    foot: w === "supplied" ? { notice: supplied.notice, note: supplied.note } : null,
  };
}
/** verseOfTerm(address) -> the reader verse a term (or one of its facets) stands under, or null. */
export function verseOfTerm(address) {
  if (typeof address !== "string") return null;
  return READER_VERSES.find((v) => address === v || address.startsWith(v + ".")) || null;
}

// ─── 6. counting ─────────────────────────────────────────────────────────────

/** wordMatches(text, word) -> [[start, end]]: where countWord counts the word (whole words, case-insensitive, after NFC). */
export function wordMatches(text, word) {
  const t = String(text).normalize("NFC"), w = String(word).normalize("NFC"), out = [];
  if (w === "") return out;
  const find = new RegExp(w.replace(/[\\^$.*+?()[\]{}|\/]/g, "\\$&") + "(?![\\p{L}\\p{M}])", "giu");
  for (let m = find.exec(t); m !== null; m = find.exec(t)) {
    if (!/[\p{L}\p{M}]$/u.test(t.slice(Math.max(0, m.index - 2), m.index))) out.push([m.index, m.index + m[0].length]);
    else find.lastIndex = m.index + (t.codePointAt(m.index) > 0xffff ? 2 : 1);
  }
  return out;
}
/** markSpans(text, words) -> [{ text, hit }]: the text cut where any of the words stands as a whole word. */
export function markSpans(text, words) {
  const marks = [];
  for (const w of words) for (const m of wordMatches(text, w)) marks.push(m);
  marks.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const spans = [];
  let pos = 0;
  for (const [a, b] of marks) {
    if (a < pos) continue;
    if (a > pos) spans.push({ text: text.slice(pos, a), hit: false });
    spans.push({ text: text.slice(a, b), hit: true });
    pos = b;
  }
  if (pos < text.length) spans.push({ text: text.slice(pos), hit: false });
  return spans;
}
/** countTable() -> [{ word, times, timesWord, verses: [number], perVerse: [{ address, number, times }], numbers: [{ verse, number, words }], agrees }]:
 *  the Count station, counted now with countWord over the nine King James verse rows. */
export function countTable() {
  return COUNT_WORDS.map((c) => {
    const perVerse = READER_VERSES.map((a) => ({ address: a, number: Number(lastIndexOf(a)), times: countWord(entryOf(EZEKIEL, a).text, c.word) }));
    const times = perVerse.reduce((s, v) => s + v.times, 0);
    return {
      word: c.word, times, timesWord: timesWord(times), verses: perVerse.filter((v) => v.times > 0).map((v) => v.number), perVerse,
      numbers: c.numbers.map((n) => ({ verse: n.verse, number: Number(lastIndexOf(n.verse)), words: n.words })),
      agrees: c.numbers.length === times,
    };
  });
}
/** countMarks(words) -> [{ address, number, spans: [{ text, hit }], times }] over the nine King James verses: what "Count with me" lights. */
export function countMarks(words) {
  const list = Array.isArray(words) ? words : [words];
  return READER_VERSES.map((a) => {
    const text = entryOf(EZEKIEL, a).text, spans = markSpans(text, list);
    return { address: a, number: Number(lastIndexOf(a)), spans, times: spans.filter((s) => s.hit).length };
  });
}
/** COUNT_NOTE: the line shown while words are lit: counting is done in the King James wording. */
export const COUNT_NOTE = "The count is made in the King James words, the ones this page seals.";

// The count rows whose words stand in the reader: address -> the words lit by "Count with me".
const COUNT_WITH_ME = new Map([
  ["26.1.1.5.7", ["the heavens were opened"]], ["26.1.2.1.3", ["fifth"]], ["26.1.3.1.2", ["LORD"]], ["26.1.3.4.2", ["hand", "hands"]],
  ["26.1.4.2.2", ["north", "south", "east", "west", "right", "left"]], ["26.1.5.1.4", ["four"]], ["26.1.5.2.3", ["likeness"]],
  ["26.1.6.2.2", ["wings"]], ["26.1.7.1.2", ["straight"]], ["26.1.8.1.2", ["of a man"]], ["26.1.8.2.3", ["their four sides"]],
  ["26.1.8.3.2", ["they four"]], ["26.1.9.1.2", ["one"]], ["26.1.9.2.6", ["they turned not when they went"]],
  ["26.1.9.3.3", ["straight forward"]], ["100.9.4", ["they turned not when they went"]],
]);
/** countWithMe(lexicon, address) -> null, or { address, words, marks (countMarks), inReader, perWord: [{ word, times }], others: [{ address, name, times }] }
 *  for a count row of the built-in lexicon whose words stand in the reader; others are verse rows outside the reader holding the words. */
export function countWithMe(lexicon, address) {
  const e = entryOf(lexicon, address), words = COUNT_WITH_ME.get(address);
  if (!e || lexicon.origin !== "builtin" || e.kind !== "count" || !words) return null;
  const marks = countMarks(words);
  const others = lexicon.entries.filter((v) => v.kind === "verse" && !READER_VERSES.includes(v.address))
    .map((v) => ({ address: v.address, name: v.name, times: words.reduce((s, w) => s + countWord(v.text, w), 0) })).filter((v) => v.times > 0);
  const perWord = words.map((w) => ({ word: w, times: READER_VERSES.reduce((s, a) => s + countWord(entryOf(EZEKIEL, a).text, w), 0) }));
  return { address, words: words.slice(), marks, inReader: marks.reduce((s, v) => s + v.times, 0), perWord, others };
}

// ─── 7. the Entry: what is shown for one entry at each lens ──────────────────

/** ENTRY_PROMPT: what the Entry says while nothing is selected. */
export const ENTRY_PROMPT = "Tap a shining word";
/** MORE_LABEL: the Stargazer fold that opens the fuller rows of an entry. */
export const MORE_LABEL = "More for older readers";
/** BROKEN_LINK: what a link row shows when its target is not in the lexicon. */
export const BROKEN_LINK = "broken link";
/** ENTRY_GROUPS: the fixed order of an entry's children, with the heading of each group. */
export const ENTRY_GROUPS = freeze([
  freeze({ key: "plain", heading: "In short" }),
  freeze({ key: "written", heading: "Verses set beside it" }),
  freeze({ key: "parts", heading: "Under this entry" }),
  freeze({ key: "text", heading: "Quoted" }),
  freeze({ key: "checked", heading: "Checked" }),
  freeze({ key: "said", heading: "Said" }),
  freeze({ key: "reading", heading: "Our reading" }),
]);
const GROUP_RANK = new Map(ENTRY_GROUPS.map((g, i) => [g.key, i]));
/** OUTSIDE_ROWS_HEADING: the one heading over the rows of an entry of a lexicon from outside (no group heading of this page stands over a sender's rows). */
export const OUTSIDE_ROWS_HEADING = "Entries under this one, as their sender labelled them";
/** ENTRY_LEADS: address -> { layer, text }: seven entries of the built-in lexicon whose own text is written for older readers ("About this
 *  lexicon", the five entries under it, and the author's notes). At Stargazer the Entry shows this one sentence first and the entry's own
 *  text behind MORE_LABEL. Each lead wears the layer of its row, and a SAID lead names its speaker. The rows themselves are not changed. */
export const ENTRY_LEADS = new Map([
  ["0", freeze({ layer: "reading", text: "This page lists words and where they come from." })],
  ["0.1", freeze({ layer: "reading", text: "We sort every piece into four kinds and give each piece a place of its own." })],
  ["0.2", freeze({ layer: "said", text: "The Bible words kept here are the King James Version, from the Project Gutenberg e-text." })],
  ["0.3", freeze({ layer: "said", text: "The Jewish Encyclopedia says Jewish teachers explained this chapter to one wise pupil at a time." })],
  // the book's own writer speaks, about every book of this kind: his argument is not given here, as fact or as this project's view
  ["0.4", freeze({ layer: "said", text: "Its writer, Pierre van Paassen, says no life of Jesus can be written without taking sides." })],
  ["0.5", freeze({ layer: "reading", text: "We read Jesus of Nazareth as a bridge: a line through the middle of our map." })],
  ["100", freeze({ layer: "reading", text: "Ten lines the author wrote under the passage." })],
]);

/** NOTES_INVITE: the one sentence and the one button of the card shown while nothing is chosen (built-in lexicon, every lens): where the
 *  author's ten lines are. The button opens the list of the lines (entry 100); it quotes nothing. `short` is the button beside the card's
 *  title under 700 px, where the sentence itself stands below the legend (the legend must begin on the first screen of a phone): there the
 *  button alone carries the sentence's fact, the number of the lines. */
export const NOTES_INVITE = freeze({ layer: "reading", text: "The author wrote ten lines under this passage.", label: "Open the author's notes", short: "The author's ten lines", address: HANDLES.notes });

// Where a row's closing words point ("See it at The fourth square.", "Open the Wheel tab.", "Press Seal and watch.", "Try the three tampers at
// Seal."): the place on this page, or on the sky page, that the words name. figure is a part of station 7 (FOURTH_PARTS); the mirror word (b) is also in "Stamp it" at Stargazer.
const POINTER_ROWS = new Map([
  ["100.2.5", freeze({ place: "wheel" })],
  ["100.5.3", freeze({ place: "figure", figure: "b" })],
  ["100.5.4", freeze({ place: "station", station: "seal" })],
  ["100.6.8", freeze({ place: "figure", figure: "a" })],
  ["100.6.9", freeze({ place: "figure", figure: "b" })],
  ["100.6.10", freeze({ place: "wheel" })],
  ["100.6.11", freeze({ place: "sky", what: "lab", label: "See it on the sky page" })],
  ["100.6.12", freeze({ place: "figure", figure: "d" })],
  ["100.6.14", freeze({ place: "entries", entries: freeze(["5.19.15", "40.18.16"]) })],
  ["100.7.6", freeze({ place: "station", station: "seal" })],
  ["100.9.4", freeze({ place: "entries", entries: freeze(["26.1.9", "26.1.12", "26.1.17"]) })],
  ["100.9.5", freeze({ place: "sky", what: "lab", label: "Try it in the lab" })],
  ["100.10.6", freeze({ place: "figure", figure: "b" })],
  ["100.10.7", freeze({ place: "wheel" })],
  ["100.10.8", freeze({ place: "station", station: "seal" })],
  ["100.11.5", freeze({ place: "wheel" })],
]);
// At Stargazer the author's lines 5 and 6 themselves carry a button to the mirror word, which that lens has inside "Stamp it".
const POINTER_LINES = new Map([
  ["100.5", freeze({ place: "figure", figure: "b", label: "See the mirror pictures" })],
  ["100.6", freeze({ place: "figure", figure: "b", label: "See three corners give the fourth" })],
]);
/** POINTER_ADDRESSES: the rows of the built-in lexicon whose closing words name a place the page can open (see pointerOf). */
export const POINTER_ADDRESSES = freeze([...POINTER_ROWS.keys()]);
/** pointerOf(lexicon, address, lens) -> null, or the place a row's closing words name, as a button for that lens:
 *  { place: "figure" | "station" | "wheel" | "sky" | "entries", label, station (the station to open, or null), figure ("a".."e" or null),
 *    tab ("wheel" or null), href (the sky page, or null), entries: [{ address, name, label }] }.
 *  A place the lens does not have gives null: at Stargazer only the mirror word (figure b, inside "Stamp it"), the wheel (inside "Stamp it"),
 *  the Seal station, the sky page and other entries can be opened. Lines 5 and 6 have a pointer of their own at Stargazer only. */
export function pointerOf(lexicon, address, lens) {
  if (lexicon.origin !== "builtin" || !lexicon.byAddress.has(address)) return null;
  const l = lensOf(lens), star = l === "stargazer";
  const p = POINTER_ROWS.get(address) || (star ? POINTER_LINES.get(address) : null);
  if (!p) return null;
  const out = { place: p.place, label: p.label || "", station: null, figure: null, tab: null, href: null, entries: [] };
  const shown = (key) => visibleStations(l, "builtin").some((s) => s.key === key);
  if (p.place === "figure") {
    const part = FOURTH_PARTS.find((f) => f.key === p.figure);
    if (!part) return null;
    if (star) { if (p.figure !== "b" || !shown("seal")) return null; return { ...out, station: "seal", figure: "b", label: p.label || "See the mirror picture" }; }
    if (!shown("fourth")) return null;
    return { ...out, station: "fourth", figure: p.figure, label: "See the figure: " + part.title };
  }
  if (p.place === "station") return shown(p.station) ? { ...out, station: p.station, label: star ? "Go to " + STATION_BY_KEY.get(p.station).stargazerTitle : "Go to the " + STATION_BY_KEY.get(p.station).title + " station" } : null;
  if (p.place === "wheel") return star ? (shown("seal") ? { ...out, station: "seal", label: "Go to the word wheel" } : null) : { ...out, tab: "wheel", label: "Open the Wheel tab" };
  if (p.place === "sky") return { ...out, href: skyPageHref(p.what, l) };
  const entries = p.entries.filter((a) => lexicon.byAddress.has(a)).map((a) => ({ address: a, name: displayName(lexicon, a, l), label: "Go to " + displayName(lexicon, a, l) }));
  return entries.length ? { ...out, entries } : null;
}
/** pointedFrom(lexicon, address, lens) -> [{ address, name, label }]: the author's lines and the outline (entries under the author's notes) that hold
 *  a link row to this entry, in the lexicon's order. Shown as Go-to buttons on the Entry of John 3:16 (built-in lexicon only). */
export function pointedFrom(lexicon, address, lens) {
  if (lexicon.origin !== "builtin" || address !== HANDLES.john316) return [];
  const out = [];
  for (const e of lexicon.entries) {
    const parent = parentOf(e.address);
    if (e.kind === "link" && e.text === address && parent.startsWith(HANDLES.notes + ".") && !out.some((x) => x.address === parent)) out.push({ address: parent, name: displayName(lexicon, parent, lens), label: "Go to " + displayName(lexicon, parent, lens) });
  }
  return out;
}

function linkView(lexicon, entry, lens) {
  if (entry.kind !== "link") return null;
  const t = entryOf(lexicon, entry.text);
  if (!t) return { exists: false, target: null, name: BROKEN_LINK, layer: null, kind: null, text: "", badge: null };
  // a verse row of the built-in lexicon is King James: a verse reached through a link names its translation after its citation
  const translation = lexicon.origin === "builtin" && t.kind === "verse" && t.layer === "text" ? WORDINGS.kjv.translation : null;
  return { exists: true, target: t.address, name: displayName(lexicon, t.address, lensOf(lens)), layer: t.layer, kind: t.kind, text: t.text, badge: badgeView(lexicon, t.address, lens), translation };
}
function groupOf(lexicon, entry, link) {
  if (entry.kind === "plain") return "plain";
  if (link) return link.exists && link.layer === "text" ? "written" : "reading";
  if (STRUCTURE_KINDS.has(entry.kind) || childrenOf(lexicon, entry.address).length > 0) return "parts";
  return GROUP_RANK.has(entry.layer) ? entry.layer : "reading";
}
/** rowView(lexicon, address, lens) -> one child row of an entry as the Entry lists it (name: the name shown at that lens, displayName):
 *  { address, layer, kind, name, text, badge, group, link, author, quoted, children, countWithMe, pointer (pointerOf) }. */
export function rowView(lexicon, address, lens) {
  const e = entryOf(lexicon, address);
  if (!e) return null;
  const link = linkView(lexicon, e, lens), author = isAuthorLine(lexicon, address);
  return {
    address, layer: e.layer, kind: e.kind, name: displayName(lexicon, address, lensOf(lens)), text: e.text, badge: badgeView(lexicon, address, lens),
    group: groupOf(lexicon, e, link), link, author, quoted: author ? quoted(e.text) : null,
    children: childrenOf(lexicon, address).length, countWithMe: countWithMe(lexicon, address) !== null,
    pointer: pointerOf(lexicon, address, lens),
  };
}
/** firstFacet(lexicon, address) -> the address of the first child whose layer is said or checked (shown with an author's line), or null. */
export function firstFacet(lexicon, address) {
  return childrenOf(lexicon, address).find((a) => { const l = lexicon.byAddress.get(a).layer; return l === "said" || l === "checked"; }) || null;
}

/**
 * entryView(lexicon, address, lens, { wording, supplied }) -> what the Entry tab shows, as plain data:
 *   { empty, prompt, invite (NOTES_INVITE for the built-in lexicon, else null) } when nothing is selected; { missing: true } for an unknown address; otherwise
 *   { address, root, origin, name (the name shown at this lens: displayName), layer, kind, text, badge,
 *     show: { address, kind, path, hash }      what this lens shows beside the words
 *     path: [{ address, name, crumb }], caption,
 *     words: [{ text, translation, primary }]  for a verse or a term: the wording(s) to print, the first being the main one
 *     foot: { notice, note } | null            the supplied-passage notice, when supplied words are shown
 *     author: null | { label, line, quoted, framing, before: [rowView], facet: rowView | null }
 *              an author's line is shown with its first said or checked row (facet); the plain rows that stand before
 *              that row in the lexicon keep their place and are shown before it (before)
 *     link: null | { exists, target, name, layer, kind, text, badge, translation }
 *     lead: null | { layer, text }             Stargazer, seven entries (ENTRY_LEADS): shown first; the entry's own text goes behind MORE_LABEL
 *     rows: [rowView] in the fixed order; first: the rows shown at once; more: the rows behind MORE_LABEL
 *     hidden: [address]                        rows not listed because the card already says the same (LINE8_RESTATED under line 8)
 *     from: [{ address, name, label }]         the author's lines that point to this entry (pointedFrom; John 3:16 only)
 *     moreLabel, actions: [{ key, label, href | null, pointer | null }], line, lineSha (Holographer only, else null) }
 */
export function entryView(lexicon, address, lens, options = {}) {
  const l = lensOf(lens), supplied = options.supplied || SUPPLIED;
  if (address === null || address === undefined) return { empty: true, prompt: ENTRY_PROMPT, invite: lexicon.origin === "builtin" ? NOTES_INVITE : null };
  if (!hasPlace(lexicon, address)) return { empty: false, missing: true, note: UNKNOWN_ENTRY_NOTE };
  const e = entryOf(lexicon, address), root = address === "";
  const builtin = lexicon.origin === "builtin", star = l === "stargazer";
  const wording = options.wording === "supplied" && suppliedAvailable(supplied) ? "supplied" : "kjv";
  const author = !root && isAuthorLine(lexicon, address);
  const facetAddress = author ? firstFacet(lexicon, address) : null, kids = childrenOf(lexicon, address);
  // line 8: the framing stands once, under the quotation; the rows that say the same are not listed again
  const hidden = author && address === "100.8" ? LINE8_RESTATED.filter((a) => kids.includes(a)) : [];
  // the plain rows that stand before the facet are shown with the line, in their own order, before the facet
  const before = facetAddress === null ? [] : kids.slice(0, kids.indexOf(facetAddress)).filter((a) => !hidden.includes(a) && lexicon.byAddress.get(a).kind === "plain");
  const rows = kids.map((a) => rowView(lexicon, a, l));
  rows.sort((a, b) => GROUP_RANK.get(a.group) - GROUP_RANK.get(b.group));      // a stable sort: canonical order inside a group
  const listed = rows.filter((r) => r.address !== facetAddress && !before.includes(r.address) && !hidden.includes(r.address));
  const first = star ? listed.filter((r) => r.group === "plain" || r.group === "parts") : listed;
  const more = star ? listed.filter((r) => r.group !== "plain" && r.group !== "parts") : [];

  // a verse of the reader or one of its terms: the wording(s) to print
  let words = [], foot = null;
  if (builtin && e && (e.kind === "verse" || e.kind === "term")) {
    const kjv = e.kind === "verse" ? e.text : e.name;
    const sup = !suppliedAvailable(supplied) ? null : e.kind === "verse" ? supplied.verses[address] : (supplied.terms || {})[address];
    const hasSup = typeof sup === "string" && sup !== "";
    // Stargazer: the wording the reader is in (a term shows its King James words as well); from Navigator up: both, the reader's first
    const supFirst = hasSup && wording === "supplied", showSup = hasSup && (supFirst || !star), showKjv = !star || !supFirst || e.kind === "term";
    const supWords = { text: sup, translation: WORDINGS.supplied.translation, wording: "supplied" };
    if (supFirst) words.push(supWords);
    if (showKjv) words.push({ text: kjv, translation: WORDINGS.kjv.translation, wording: "kjv" });
    if (showSup && !supFirst) words.push(supWords);
    words = words.map((w, i) => ({ ...w, primary: i === 0 }));
    if (showSup) foot = { notice: supplied.notice, note: supplied.note };
  }

  const actions = [];
  if (builtin && address === HANDLES.dateTerm) actions.push({ key: "sky-date", label: star ? "Open that day on the sky page" : "Open that date in the Celestial Control Panel", href: skyPageHref("date", l) });
  if (builtin && address === HANDLES.notTurning) actions.push({ key: "lab", label: "Try it in the lab", href: skyPageHref("lab", l) });
  if (e && countWithMe(lexicon, address) !== null) actions.push({ key: "count", label: "Count with me", href: null });
  // the place this entry's own closing words name (and, at Stargazer, the mirror word for lines 5 and 6)
  const pointer = e ? pointerOf(lexicon, address, l) : null;
  if (pointer && pointer.place !== "entries") actions.push({ key: "pointer", label: pointer.label, href: pointer.href, pointer });

  const facet = facetAddress ? rowView(lexicon, facetAddress, l) : null;
  return {
    empty: false, missing: false, address, root, origin: lexicon.origin,
    name: root ? (builtin ? ROOT_NAME : lexicon.title) : displayName(lexicon, address, l), layer: root ? null : e.layer, kind: root ? null : e.kind, text: root ? "" : e.text,
    badge: root ? null : badgeView(lexicon, address, l),
    show: { address: !star && !root, kind: !star && !root, path: !star, hash: l === "holographer" && !root },
    path: pathOf(lexicon, address, l), caption: pathCaption(lexicon, address, l),
    words, foot,
    author: author ? {
      label: AUTHOR_LABEL[l], line: Number(e.name.slice(5)), quoted: quoted(e.text), framing: address !== "100.8" ? null : star ? LINE8_FRAMING_STARGAZER : LINE8_FRAMING,
      before: before.map((a) => rowView(lexicon, a, l)), facet,
    } : null,
    link: root ? null : linkView(lexicon, e, l),
    lead: star && builtin && !root ? ENTRY_LEADS.get(address) || null : null,
    rows, first, more, hidden, from: root ? [] : pointedFrom(lexicon, address, l), moreLabel: MORE_LABEL, actions,
    line: l === "holographer" && !root ? e.line : null, lineSha: l === "holographer" && !root ? lineShaOf(lexicon, address) : null,
  };
}

/** statusFor(lexicon, address, lens) -> the one sentence for the status line after a selection (for a lexicon from outside it names the address, not the sender's name). */
export function statusFor(lexicon, address, lens) {
  if (address === null || address === undefined || !hasPlace(lexicon, address)) return "Nothing is chosen.";
  const n = childrenOf(lexicon, address).length, name = lexicon.origin === "outside" && address !== "" ? "Entry " + address : nameOf(lexicon, address);
  if (lexicon.origin === "outside") return name + " of the loaded lexicon: " + plural(n, "entry", "entries") + " under it.";
  if (lensOf(lens) === "stargazer") return displayName(lexicon, address, "stargazer") + ". " + (n === 0 ? "Nothing more under it." : plural(n, "thing", "things") + " under it.");
  return (address === "" ? "" : address + ", ") + name + ": " + plural(n, "entry", "entries") + " under it.";
}

// ─── 8. the neighbourhood list (the keyboard tree) and the navigation buttons ─

/** LIST_KEYS: what the arrow keys do in the neighbourhood list (the list's description, for a keyboard and a screen reader): { stargazer, other }. */
export const LIST_KEYS = freeze({
  stargazer: "Keys in this list. Up and Down: the thing before and the next one on the same level. Left: the thing above. Right: the first thing under it. Home: back to the start.",
  other: "Keys in this list. Up and Down: the entry before and the next one on the same level. Left: the entry above. Right: the first entry under it. Home: the home entry.",
});
/** neighbourhood(lexicon, focus, lens) -> [{ address, name, label, level, relation, expanded, layer, kind, children, badge }]: the root, the
 *  ancestors, the focused entry and its children, as tree items (name and label as that lens shows them: displayName; level = depth + 1; relation "ancestor" | "focus" | "child";
 *  expanded is true for the root, the ancestors and the focused entry when their children are in the list, false for the focused entry
 *  without children, and null for a child, whose own children are not shown). */
export function neighbourhood(lexicon, focus, lens) {
  const at = hasPlace(lexicon, focus) ? focus : lexicon.home, l = lensOf(lens);
  const item = (address, relation) => {
    const e = entryOf(lexicon, address);
    return {
      address, name: displayName(lexicon, address, l), label: shortLabel(lexicon, address, l), level: depthOf(address) + 1, relation,
      expanded: relation === "child" ? null : childrenOf(lexicon, address).length > 0,
      layer: e ? e.layer : null, kind: e ? e.kind : null, children: childrenOf(lexicon, address).length,
      badge: e ? badgeView(lexicon, address, lens) : null,
    };
  };
  const out = [];
  if (at !== "") out.push(item("", "ancestor"));
  for (const p of pathOf(lexicon, at).slice(0, -1)) out.push(item(p.address, "ancestor"));
  out.push(item(at, "focus"));
  for (const c of childrenOf(lexicon, at)) out.push(item(c, "child"));
  return out;
}
/** treeNav(lexicon, address) -> { home, up, prev, next, first }: where Home, Up, previous sibling, next sibling and first child lead (null when there is none). */
export function treeNav(lexicon, address) {
  const at = hasPlace(lexicon, address) ? address : lexicon.home;
  if (at === "") return { home: lexicon.home === "" ? null : lexicon.home, up: null, prev: null, next: null, first: childrenOf(lexicon, "")[0] || null };
  const parent = parentOf(at), siblings = childrenOf(lexicon, parent), i = siblings.indexOf(at);
  return {
    home: lexicon.home === at ? null : lexicon.home, up: parent,
    prev: i > 0 ? siblings[i - 1] : null, next: i >= 0 && i < siblings.length - 1 ? siblings[i + 1] : null,
    first: childrenOf(lexicon, at)[0] || null,
  };
}
/** treeKey(lexicon, address, key) -> the address a key leads to in the neighbourhood list (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home), or null. */
export function treeKey(lexicon, address, key) {
  const nav = treeNav(lexicon, address);
  if (key === "ArrowUp") return nav.prev;
  if (key === "ArrowDown") return nav.next;
  if (key === "ArrowLeft") return nav.up;
  if (key === "ArrowRight") return nav.first;
  if (key === "Home") return lexicon.home;
  return null;
}

// ─── 9. page state (plain data; nothing is stored) ───────────────────────────

/** DEFAULT_ORBIT: the 3D rotation the tree opens with. */
export const DEFAULT_ORBIT = freeze(rotX(-0.35));
/** homeView(lexicon) -> { focus, local }: the view centred on the lexicon's home entry. */
export const homeView = (lexicon) => ({ focus: lexicon.home, local: IDENT.slice() });
/** viewAt(lexicon, address) -> { focus, local }: the view centred on an entry (the home entry for an unknown address). */
export const viewAt = (lexicon, address) => ({ focus: hasPlace(lexicon, address) ? address : lexicon.home, local: IDENT.slice() });

/** initialState(hash, supplied) -> the page's first state: Stargazer, 2D, station Read, verse 1 open, the tree on 26.1, nothing selected; then the link is applied. */
export function initialState(hash = "", supplied = SUPPLIED) {
  const state = {
    lens: "stargazer", dims: "2D", station: "read", lexicon: EZEKIEL, sky: null, verse: READER_VERSES[0], selected: null,
    view: homeView(EZEKIEL), orbit: DEFAULT_ORBIT.slice(), flight: null,
    wording: defaultWording("stargazer", supplied), wordingChosen: false, tab: "entry",
    marks: false, filter: { text: true, said: true, checked: true, reading: true }, counting: null,
    wheel: { packet: 0, flips: [], view: "wheel", sector: null },
    square: { points: TQF_PRESETS[0].points.map((p) => p.slice()), seed: [1, 0, 0, 1], hidden: false, wrongBit: null, packet: 0 },
    place: { from: HANDLES.place, to: HANDLES.john316 },
    seal: null, tampers: {}, send: null, outside: null, busy: false, notes: [],
  };
  return applyHash(state, hash, { supplied });
}
/** applyHash(state, hash, { own, supplied }) -> a new state after a link (at load, on hashchange and on popstate): lens, sky, entry; notes lists
 *  what was ignored. hash is the fragment, or what parseHash() gave for it. A typed or pasted link sets the reading level it names. With
 *  own: true the fragment is one this page wrote into the history itself (Back and Forward): its sky and its entry are brought back and the
 *  level on show is kept, whatever level the fragment names; the station and the tab then stay too, where the lexicon still has them. */
export function applyHash(state, hash, options = {}) {
  const own = !!options && options.own === true, supplied = (options && options.supplied) || SUPPLIED;
  const parsed = typeof hash === "string" ? parseHash(hash) : hash;
  const next = { ...state, notes: [] };
  if (parsed.note) next.notes.push(parsed.note);
  const v = parsed.values;
  if (v.lens && !own) Object.assign(next, setLens(next, v.lens, supplied));
  if (v.sky) {
    const made = skyLexicon(v.sky);
    const same = made.ok && next.sky && next.lexicon.origin === "page" && next.sky.jd === made.sky.jd && next.sky.lat === made.sky.lat && next.sky.lon === made.sky.lon;
    if (made.ok && !same) Object.assign(next, { lexicon: made.lexicon, sky: made.sky, selected: null, view: homeView(made.lexicon), seal: null, tampers: {}, send: null, outside: null, counting: null, wheel: { packet: 0, flips: [], view: "wheel", sector: null } });
    if (!made.ok) next.notes.push(made.why);
  } else if (next.lexicon.origin === "page") {
    Object.assign(next, { lexicon: EZEKIEL, sky: null, selected: null, view: homeView(EZEKIEL), seal: null, tampers: {}, send: null, counting: null, wheel: { packet: 0, flips: [], view: "wheel", sector: null } });
  }
  if (v.entry !== undefined) {
    if (next.lexicon.byAddress.has(v.entry)) Object.assign(next, selectEntry(next, v.entry), { view: viewAt(next.lexicon, v.entry) });
    else next.notes.push(UNKNOWN_ENTRY_NOTE);
  }
  next.station = stationFor(next);
  next.tab = tabFor(next);
  return next;
}
/** selectEntry(state, address) -> a new state with the entry selected: the open verse follows it, the wheel shows its packet, the lit count is cleared. The view is moved by the caller (flightPlan). */
export function selectEntry(state, address) {
  if (!hasPlace(state.lexicon, address)) return { ...state };
  const verse = state.lexicon.origin === "builtin" ? verseOfTerm(address) : null;
  const packet = address === "" ? 0 : Math.max(0, entryPacketIndex(state.lexicon.entries, address));
  return { ...state, selected: address, verse: verse || state.verse, counting: null, wheel: { ...state.wheel, packet, flips: [], sector: null } };
}
/** setLens(state, lens, supplied) -> a new state at that lens: the wording follows the lens until the visitor has chosen one; a hidden station or tab is left. */
export function setLens(state, lens, supplied = SUPPLIED) {
  const l = lensOf(lens);
  const next = { ...state, lens: l };
  next.wording = wordingFor(next, supplied);
  next.station = stationFor(next);
  next.tab = tabFor(next);
  return next;
}
/** setWording(state, wording, supplied) -> a new state with the visitor's choice of wording, which then holds. */
export function setWording(state, wording, supplied = SUPPLIED) {
  const w = wording === "supplied" && suppliedAvailable(supplied) ? "supplied" : "kjv";
  return { ...state, wording: w, wordingChosen: true };
}
/** stationFor(state) -> the station to show: the state's own when this lens and lexicon show it, else the first that is shown (null for an outside lexicon). */
export function stationFor(state) {
  const shown = visibleStations(state.lens, state.lexicon.origin);
  if (shown.length === 0) return null;
  return shown.some((s) => s.key === state.station) ? state.station : shown[0].key;
}
/** tabFor(state) -> the tab to show: the state's own when it is shown, else "entry". */
export function tabFor(state) {
  const shown = visibleTabs(state.lens, { origin: state.lexicon.origin, sealed: !!state.seal, sent: !!state.send });
  return shown.some((t) => t.key === state.tab) ? state.tab : "entry";
}

// ─── 10. the tree: scene, hit test and moves of the view ─────────────────────
// Coordinates. Every position of a scene is a point of the unit disc (2D) or the unit ball (3D), x to the right
// and y UP: the canvas draws it at (cx + R·x, cy − R·y). The view is { focus, local }: the entry at the centre
// and a small matrix; an entry's screen frame is local · (its frame seen from the focus), and in 3D the orbit
// is applied on top. Nothing here multiplies by an absolute frame.

/** RIM_CUT: an entry whose centre lies beyond this fraction of the rim radius is not drawn (the focus, its parent and its children always are). */
export const RIM_CUT = 0.985;
/** LABEL_CHILDREN_MAX: with more children than this the canvas shows cells and a count, and no child labels. */
export const LABEL_CHILDREN_MAX = 16;
/** TREE_LABEL: the accessible name of the tree canvas (from Navigator up; uiLabel("treeLabel", lens) gives it with its Stargazer form). */
export const TREE_LABEL = "The entries of this lexicon as a tree on a curved map";

const viewOf = (lexicon, layout, view) => ({
  focus: view && layout.has(view.focus) ? view.focus : lexicon.home,
  local: view && Array.isArray(view.local) && view.local.length === 16 && view.local.every(Number.isFinite) ? view.local : IDENT,
});

/**
 * treeScene(lexicon, view, dims, { orbit, filter, selected, lens }) -> the tree as plain data for the canvas (with lens: names and labels as
 * that lens shows them, displayName; without it the entries' own names):
 *   { dims, focus, count, crowded, hidden, total, gateRadius, nodes, walls, edges }
 *   nodes  [{ address, x, y, z, k, radius, steps, relation ("focus" | "parent" | "child" | "near" | "far"), layer, kind, name,
 *            shape, colour, label, labelAt: [x, y], gate: [x, y] | null, filtered, selected, children }], far ones first (paint order);
 *            label is null for everything but the focus, its parent and (unless crowded) its children; k = 1 + 0.25·z scales a 3D dot.
 *   walls  2D only: [{ address, ofFocus, points: [[x, y]] }], the wall between an entry and its parent, for entries within two edges.
 *   edges  [{ from, to, points: [[x, y, z]] }], the straight line from an entry to its parent (3D draws dots and edges only).
 *   hidden how many entries are not drawn because they are too near the rim (or beyond what was walked).
 */
export function treeScene(lexicon, view, dims = "2D", options = {}) {
  const d = dims === "3D" ? "3D" : "2D", layout = layoutOf(lexicon, d);
  const { focus, local } = viewOf(lexicon, layout, view);
  const orbit = d === "3D" && Array.isArray(options.orbit) && options.orbit.length === 16 ? options.orbit : null;
  const base = orbit ? lmul(orbit, local) : local, filter = options.filter || null, selected = options.selected;
  const frames = relativeFrames(layout, focus), focusNode = layout.get(focus);
  const kids = childrenOf(lexicon, focus), crowded = kids.length > LABEL_CHILDREN_MAX;
  const point = (M, p) => { const b = toBall(lapply(M, p)); return d === "3D" ? b : [b[0], b[1], 0]; };
  const nodes = [], walls = [], edges = [], origins = new Map();
  let drawn = 0;
  for (const [address, F] of frames) {
    const M = lmul(base, F), o = originOf(M), b = point(M, [0, 0, 0, 1]), radius = Math.hypot(b[0], b[1], b[2]);
    const steps = treePath(focus, address).length - 1;
    if (steps > 1 && !(radius <= RIM_CUT)) continue;
    const e = entryOf(lexicon, address), node = layout.get(address);
    const relation = steps === 0 ? "focus" : steps === 1 ? (address === focusNode.parent ? "parent" : "child") : steps === 2 ? "near" : "far";
    const meta = e ? LAYER_BY_ID.get(e.layer) : null;
    let label = null, labelAt = [b[0], b[1]], gate = null;
    if (relation === "focus") label = shortLabel(lexicon, address, options.lens);
    else if (relation === "parent") {
      label = shortLabel(lexicon, address, options.lens);
      if (d === "2D") { const s = focusNode.r + node.r * 0.3, p = point(base, [-Math.sinh(s), 0, 0, Math.cosh(s)]); labelAt = [p[0], p[1]]; }
    } else if (relation === "child") {
      if (!crowded) label = shortLabel(lexicon, address, options.lens);
      if (d === "2D") {
        const g = point(M, [-Math.sinh(node.r), 0, 0, Math.cosh(node.r)]), p = point(M, [-Math.sinh(node.r * 0.7), 0, 0, Math.cosh(node.r * 0.7)]);
        gate = [g[0], g[1]]; labelAt = [p[0], p[1]];
      }
    }
    origins.set(address, o);
    if (address !== "") drawn += 1;
    nodes.push({
      address, x: b[0], y: b[1], z: b[2], k: 1 + 0.25 * b[2], radius, steps, relation,
      layer: e ? e.layer : null, kind: e ? e.kind : null, name: displayName(lexicon, address, options.lens),
      shape: meta ? meta.shape : "", colour: meta ? meta.colour : "", label, labelAt, gate,
      filtered: !!(e && filter && filter[e.layer] === false), selected: address === selected, children: childrenOf(lexicon, address).length,
    });
    if (d === "2D" && address !== "" && steps <= 2) {
      walls.push({ address, ofFocus: address === focus || relation === "child", points: cellWall(layout, address).map((p) => { const q = point(M, p); return [q[0], q[1]]; }) });
    }
  }
  for (const n of nodes) {
    if (n.address === "") continue;
    const parent = layout.get(n.address).parent;
    if (!origins.has(parent)) continue;
    edges.push({ from: n.address, to: parent, points: geodesic(origins.get(n.address), origins.get(parent), 8).map((h) => point(IDENT, h)) });
  }
  nodes.sort((a, b) => (d === "3D" ? a.z - b.z : b.steps - a.steps));
  return {
    dims: d, focus, count: kids.length, crowded, hidden: lexicon.entries.length - drawn, total: lexicon.entries.length,
    gateRadius: Math.tanh(focusNode.r / 2), nodes, walls, edges,
  };
}

/** treeHit(lexicon, view, x, y) -> the address of the entry whose cell holds the 2D point (x, y) of the unit disc (y up), "" for the root's cell,
 *  null outside the disc. A neighbour's whole cell is its hit area (cellAt, two edges deep). */
export function treeHit(lexicon, view, x, y) {
  const layout = layoutOf(lexicon, "2D"), v = viewOf(lexicon, layout, view);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(x * x + y * y < 0.998)) return null;
  return cellAt(layout, v.focus, lapply(linv(v.local), fromBall([x, y, 0])), 2);
}

/** treeCaption(lexicon, scene, lens) -> the visible caption of the tree canvas: the centred entry (with its address from Navigator up), its path,
 *  its number of children and how many entries are too near the rim to draw. For a lexicon from outside the path is given by addresses. */
export function treeCaption(lexicon, scene, lens) {
  const star = lensOf(lens) === "stargazer" && lexicon.origin !== "outside", a = scene.focus, n = scene.count;
  const head = lexicon.origin === "outside" ? pathCaption(lexicon, a) + "." : (star || a === "" ? "" : a + " · ") + pathCaption(lexicon, a, star ? "stargazer" : undefined) + ".";
  const under = star
    ? (n === 0 ? " Nothing under it." : " " + plural(n, "thing", "things") + " under it.")
    : " " + plural(n, "entry", "entries") + " under it" + (scene.crowded ? ", too many to label: use the list." : ".");
  const rim = scene.hidden === 0 ? "" : star
    ? " " + scene.hidden + " more are too near the edge to draw."
    : " " + plural(scene.hidden, "entry is", "entries are") + " too near the rim to draw.";
  return head + under + rim;
}
/** TREE_PRICE: the sentence the page states about the layout (layer reading). */
export const TREE_PRICE = freeze({ layer: "reading", text: "Every entry owns a cell and no two cells overlap. The price: a centred entry's children sit near the rim and its grandchildren on it." });

/** VIEW_REACH: the farthest the centre of the view may lie from the focused entry (hyperbolic length); beyond it nothing is drawn anyway. */
export const VIEW_REACH = 8;
// Rounding errors in a product of two large Lorentz matrices are not small, and they grow from product to product.
// So every matrix a view keeps is rebuilt exactly: a rotation is made orthonormal again, and a general matrix is
// split into the slide that carries its origin and the rotation that is left.
function exactRotation(M, dims) {
  if (dims === "2D") { const n = Math.hypot(M[0], M[4]) || 1, c = M[0] / n, s = M[4] / n; return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  let a = [M[0], M[1], M[2]], b = [M[4], M[5], M[6]];
  const na = Math.hypot(a[0], a[1], a[2]) || 1;
  a = a.map((v) => v / na);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  b = b.map((v, i) => v - dot * a[i]);
  const nb = Math.hypot(b[0], b[1], b[2]) || 1;
  b = b.map((v) => v / nb);
  return [a[0], a[1], a[2], 0, b[0], b[1], b[2], 0, a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0], 0, 0, 0, 0, 1];
}
function exactLorentz(M, dims, reach = Infinity) {
  const o = originOf(M), z = dims === "2D" ? 0 : o[2], n = Math.hypot(o[0], o[1], z);
  if (!(n > 1e-12)) return exactRotation(M, dims);
  const u = [o[0] / n, o[1] / n, z / n], dist = Math.asinh(n);
  return lmul(boostAlong(u, Math.min(dist, reach)), exactRotation(lmul(boostAlong(u, -dist), M), dims));
}
/** A rotation matrix raised to the power −p: the same axis, the angle times −p. */
function unwind(R, p) {
  const tr = R[0] + R[5] + R[10], angle = Math.acos(Math.min(1, Math.max(-1, (tr - 1) / 2)));
  if (!(angle > 1e-9)) return IDENT.slice();
  let ax = [R[9] - R[6], R[2] - R[8], R[4] - R[1]], n = Math.hypot(ax[0], ax[1], ax[2]);
  if (n < 1e-9) {                                   // a half-turn: the axis is the eigenvector of 1
    ax = [Math.sqrt(Math.max(0, (R[0] + 1) / 2)), Math.sqrt(Math.max(0, (R[5] + 1) / 2)), Math.sqrt(Math.max(0, (R[10] + 1) / 2))];
    if (R[1] < 0) ax[1] = -ax[1];
    if (R[2] < 0) ax[2] = -ax[2];
    n = Math.hypot(ax[0], ax[1], ax[2]) || 1;
  }
  const [x, y, z] = ax.map((v) => v / n), a = -p * angle, c = Math.cos(a), s = Math.sin(a), k = 1 - c;
  return [c + k * x * x, k * x * y - s * z, k * x * z + s * y, 0, k * y * x + s * z, c + k * y * y, k * y * z - s * x, 0,
    k * z * x - s * y, k * z * y + s * x, c + k * z * z, 0, 0, 0, 0, 1];
}
const smooth = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

/**
 * flightPlan(lexicon, dims, view, target, { settle = true }) -> { from, to, path, steps, distance, at(t) }.
 * The flight from the present view to the view centred on the target, along the tree: one straight slide per edge of
 * treePath(focus, target) (after one slide that centres the present focus). at(t), t from 0 to 1, gives the view at
 * that moment; at(1) is `to`. With settle the picture is also turned, evenly over the flight, so that it ends in the
 * target's own frame (local = identity: the parent on the left); without it no leg turns anything and `to.local`
 * is the rotation the slides leave. `distance` is the length slid, `steps` the number of edges.
 */
export function flightPlan(lexicon, dims, view, target, options = {}) {
  const d = dims === "3D" ? "3D" : "2D", layout = layoutOf(lexicon, d), settle = options.settle !== false;
  const from = viewOf(lexicon, layout, view), goal = layout.has(target) ? target : lexicon.home;
  const path = treePath(from.focus, goal), legs = [];
  let at = from.focus, local = exactLorentz(from.local, d), total = 0;
  const slide = (M, next) => {                       // the slide that brings the origin of M to the centre
    const o = originOf(M), n = Math.hypot(o[0], o[1], o[2]), dist = Math.asinh(n);
    const u = n > 1e-12 ? [-o[0] / n, -o[1] / n, -o[2] / n] : [1, 0, 0];
    const end = exactRotation(lmul(boostAlong(u, dist), M), d);
    if (dist > 1e-9) { legs.push({ focus: at, local, u, dist, start: total }); total += dist; }
    at = next; local = end;
  };
  slide(local, at);
  for (let i = 1; i < path.length; i++) slide(lmul(local, relativeFrame(layout, at, path[i])), path[i]);
  const rest = local, to = { focus: goal, local: settle ? IDENT.slice() : rest };
  const turned = (p, M) => (settle ? lmul(unwind(rest, p), M) : M);
  return {
    from: { focus: from.focus, local: from.local.slice() }, to, path, steps: path.length - 1, distance: total,
    at(t) {
      const p = smooth(t);
      if (p >= 1) return { focus: to.focus, local: to.local.slice() };
      if (legs.length === 0) return { focus: goal, local: turned(p, rest) };
      const s = p * total;
      let leg = legs[legs.length - 1];
      for (const l of legs) if (s < l.start + l.dist) { leg = l; break; }
      return { focus: leg.focus, local: turned(p, lmul(boostAlong(leg.u, Math.min(leg.dist, Math.max(0, s - leg.start))), leg.local)) };
    },
  };
}

/** rebaseView(lexicon, dims, view) -> the same picture as { focus, local } with the focus on the entry whose cell holds the centre; local is
 *  rebuilt as an exact Lorentz matrix and its slide is held within VIEW_REACH ("this is as far as the map goes"). */
export function rebaseView(lexicon, dims, view) {
  const d = dims === "3D" ? "3D" : "2D", layout = layoutOf(lexicon, d), v = viewOf(lexicon, layout, view);
  let focus = v.focus, local = exactLorentz(v.local, d, VIEW_REACH);
  for (let i = 0; i < 24; i++) {
    const a = cellAt(layout, focus, lapply(linv(local), [0, 0, 0, 1]), 2);
    if (a === focus) break;
    local = exactLorentz(lmul(local, relativeFrame(layout, focus, a)), d); focus = a;
  }
  return { focus, local };
}
/** NUDGE_STEP: how far one press of a nudge button slides the view (hyperbolic length). */
export const NUDGE_STEP = 0.4;
/** nudgeView(lexicon, dims, view, "left" | "right" | "up" | "down", step) -> the view after one nudge: what lies on that side comes towards the centre. */
export function nudgeView(lexicon, dims, view, direction, step = NUDGE_STEP) {
  const d = dims === "3D" ? "3D" : "2D", v = viewOf(lexicon, layoutOf(lexicon, d), view);
  const u = direction === "left" ? [1, 0, 0] : direction === "right" ? [-1, 0, 0] : direction === "up" ? [0, -1, 0] : direction === "down" ? [0, 1, 0] : null;
  if (!u) return { focus: v.focus, local: v.local.slice() };
  return rebaseView(lexicon, d, { focus: v.focus, local: lmul(boostAlong(u, step), v.local) });
}
/** dragView(lexicon, view, from, to) -> the 2D view after a drag that takes the disc point `from` to `to` ([x, y], y up; both kept inside 0.95). */
export function dragView(lexicon, view, from, to) {
  const v = viewOf(lexicon, layoutOf(lexicon, "2D"), view);
  const inside = (p) => { const r = Math.hypot(p[0], p[1]); return r > 0.95 ? [p[0] * 0.95 / r, p[1] * 0.95 / r, 0] : [p[0], p[1], 0]; };
  if (![from, to].every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))) return { focus: v.focus, local: v.local.slice() };
  const M = lmul(linv(centreOn(inside(to))), centreOn(inside(from)));
  return rebaseView(lexicon, "2D", { focus: v.focus, local: lmul(M, v.local) });
}
/** orbitDrag(orbit, dx, dy) -> the 3D orbit after a drag of dx, dy pixels (a drag in 3D changes only the orbit). */
export const orbitDrag = (orbit, dx, dy) => lmul(lmul(rotY(dx * 0.01), rotX(dy * 0.01)), orbit);
/** orbitTurn(orbit, "left" | "right" | "up" | "down", step) -> the orbit after one press of a turn button. */
export function orbitTurn(orbit, direction, step = 0.3) {
  const R = direction === "left" ? rotY(-step) : direction === "right" ? rotY(step) : direction === "up" ? rotX(-step) : direction === "down" ? rotX(step) : IDENT;
  return lmul(R, orbit);
}

/** PLACE_LABELS: the names of the two numbers of the Place station (neither is called "the distance"). */
export const PLACE_LABELS = freeze({ steps: "steps along the tree", straight: "straight distance in the chart" });
/** placeNumbers(lexicon, dims, a, b) -> { ok, steps, straight, path: [{ address, name }], sentence }: the two numbers between two entries. */
export function placeNumbers(lexicon, dims, a, b) {
  if (!hasPlace(lexicon, a) || !hasPlace(lexicon, b)) return { ok: false, steps: null, straight: null, path: [], sentence: "Choose two entries of this lexicon." };
  const layout = layoutOf(lexicon, dims), path = treePath(a, b), steps = path.length - 1;
  const straight = Math.acosh(Math.max(1, relativeFrame(layout, a, b)[15]));
  const call = (x) => (lexicon.origin === "outside" ? (x === "" ? ROOT_NAME : "entry " + x) : nameOf(lexicon, x));
  return {
    ok: true, steps, straight, path: path.map((p) => ({ address: p, name: nameOf(lexicon, p) })),
    sentence: "From " + call(a) + " to " + call(b) + ": " + steps + " " + PLACE_LABELS.steps + ", " + straight.toFixed(2) + " " + PLACE_LABELS.straight + ".",
  };
}

// ─── 11. the word wheel and the 8 × 8 square ─────────────────────────────────
// A word is 16 hex digits, 64 lights. On the wheel a light is { sector (0..15, one hex digit), ring (0 the outer
// ring, the digit's 8; 3 the inner ring, its 1) }; on the square it is { row, col } (row-major, one row per byte).
// Wheel coordinates are screen coordinates measured from the wheel's centre in units of its radius: x to the
// right, y DOWN. Angles a0, a1 are measured clockwise from the top (12 o'clock); a canvas arc angle is a − π/2.

/** WHEEL_RHO: the hyperbolic radius of the wheel. */
export const WHEEL_RHO = 1.5;
/** WHEEL_RINGS: the four hyperbolic radii that cut the wheel into rings of equal area (equalAreaRings(1.5, 4)). */
export const WHEEL_RINGS = freeze(equalAreaRings(WHEEL_RHO, 4));
/** WHEEL_RADII: the same four radii as fractions of the wheel's radius on screen (the last is 1). */
export const WHEEL_RADII = freeze(WHEEL_RINGS.map((r) => discRadius(r) / discRadius(WHEEL_RHO)));
/** WHEEL_CELL_AREA: the hyperbolic area of each of the 64 cells (0.1328). */
export const WHEEL_CELL_AREA = cellArea(WHEEL_RINGS, 0, 16);
const SECTOR_ANGLE = Math.PI / 8;

/** WORD_FIELDS: the fields of the word in reading order: { key, label, about, first, last (light numbers i), bits, shade (0..1 on one neutral ramp), guard }. */
export const WORD_FIELDS = freeze(PACKET_FIELDS.map((f, n) => {
  const names = {
    form: ["form", "kind of packet (9 = crystal)"], parity: ["guard", "guard bit over the other 63"], spin: ["spin", "unused in a crystal packet (0)"],
    quat32: ["crystal", "the crystal: four signed bytes"], payload16: ["length", "length of the chunk in bytes"],
    freq: ["checksum", "byte-sum checksum, high 5 bits"], amp: ["checksum, low bits", "byte-sum checksum, low 3 bits"],
  }[f.key] || [f.key, f.key];
  return freeze({ key: f.key, label: names[0], about: names[1], first: 63 - f.hi, last: 63 - f.lo, bits: f.hi - f.lo + 1, shade: (n + 1) / (PACKET_FIELDS.length + 1), guard: f.key === "parity" });
}));
const FIELD_BY_KEY = new Map(WORD_FIELDS.map((f) => [f.key, f]));
/** GUARD_LIGHT: the light number (i = 4, bit 59) of the guard. */
export const GUARD_LIGHT = FIELD_BY_KEY.get("parity").first;

/** ringBounds(ring) -> [inner, outer] radius of a ring as fractions of the wheel radius (ring 0 is the outer one). */
export const ringBounds = (ring) => [ring === 3 ? 0 : WHEEL_RADII[2 - ring], WHEEL_RADII[3 - ring]];
/** lightName(cell, lens) -> the accessible name of a light: "Light 5 of 64, the guard, on". At Stargazer only the guard is named
 *  ("Light 57 of 64, on"): the other field names are not Stargazer words. */
export function lightName(cell, lens) {
  const f = FIELD_BY_KEY.get(cell.field), guard = !!f && f.guard;
  if (lens === "stargazer") return "Light " + (cell.i + 1) + " of 64, " + (guard ? "the guard, " : "") + (cell.on ? "on" : "off");
  return "Light " + (cell.i + 1) + " of 64, " + (guard ? "the guard" : f ? f.label : "a light") + ", " + (cell.on ? "on" : "off");
}
/** wheelCells(hex, lens) -> the 64 lights with their place on the wheel: glyphCells plus { r0, r1, a0, a1, weight (8, 4, 2 or 1), guard, name }. */
export function wheelCells(hex, lens) {
  return glyphCells(hex).map((c) => {
    const [r0, r1] = ringBounds(c.ring);
    return { ...c, r0, r1, a0: c.sector * SECTOR_ANGLE, a1: (c.sector + 1) * SECTOR_ANGLE, weight: 8 >> c.ring, guard: c.i === GUARD_LIGHT, name: lightName(c, lens) };
  });
}
/** wheelHit(x, y) -> { sector, ring, i } of the light under a point of the wheel (centre 0, radius 1, y down), or null outside it. */
export function wheelHit(x, y) {
  const r = Math.hypot(x, y);
  if (!Number.isFinite(r) || r > 1) return null;
  let a = Math.atan2(x, -y);
  if (a < 0) a += 2 * Math.PI;
  const sector = Math.min(15, Math.floor(a / SECTOR_ANGLE));
  let ring = 0;
  while (ring < 3 && r < ringBounds(ring)[0]) ring++;
  return { sector, ring, i: sector * 4 + ring };
}
/** squareHit(u, v) -> { row, col, i } of the light under a point of the 8 × 8 square (u, v from 0 to 1 from its top left corner), or null outside it. */
export function squareHit(u, v) {
  if (!(u >= 0 && u < 1 && v >= 0 && v < 1)) return null;
  const col = Math.floor(u * 8), row = Math.floor(v * 8);
  return { row, col, i: row * 8 + col };
}
/** fieldArcs() -> [{ key, label, guard, a0, a1 }]: the angle each field's label spans round the wheel (from its first to its last sector). */
export const fieldArcs = () => WORD_FIELDS.map((f) => ({ key: f.key, label: f.label, guard: f.guard, a0: (f.first >> 2) * SECTOR_ANGLE, a1: ((f.last >> 2) + 1) * SECTOR_ANGLE }));
/** quadrantArcs() -> [{ quadrant, a0, a1 }]: the four quarters of the word (sixteen bits, four sectors each) as angles, for their outlines. */
export const quadrantArcs = () => [0, 1, 2, 3].map((q) => ({ quadrant: q, a0: q * 4 * SECTOR_ANGLE, a1: (q + 1) * 4 * SECTOR_ANGLE }));
/** flipLights(hex, lights) -> the word with each listed light (i = 0..63) flipped once. */
export function flipLights(hex, lights) {
  let out = hex.toUpperCase();
  for (const i of lights || []) if (Number.isInteger(i) && i >= 0 && i < 64) out = flipBit(out, 63 - i);
  return out;
}
/** toggleFlip(flips, i) -> the list of flipped lights after one more press on light i (a second press takes it back). */
export const toggleFlip = (flips, i) => (flips.includes(i) ? flips.filter((k) => k !== i) : [...flips, i]);
/** packetOfEntry(lexicon, address) -> the index of the packet that holds the first byte of the entry's line (0 for the root or an unknown address). */
export const packetOfEntry = (lexicon, address) => Math.max(0, address ? entryPacketIndex(lexicon.entries, address) : 0);

/**
 * wheelView(lexicon, { packet, flips }, lens) -> the Wheel tab as plain data:
 *   { index, count, crystal, hex, digits, changed, flips, parityOk, equalsCrystal, cells (wheelCells, named for the lens), plain (true at
 *     Stargazer: the canvas then names only the guard), fields: [{ ...WORD_FIELDS, value }],
 *     readout: [{ layer, text }] }
 * crystal is the packet of the chunk (lexiconPackets, so it works before sealing); hex is that word after the flips.
 */
export function wheelView(lexicon, wheel, lens) {
  const packets = packetsOf(lexicon), count = packets.length;
  const index = Math.min(count - 1, Math.max(0, Number.isInteger(wheel && wheel.packet) ? wheel.packet : 0));
  const crystal = packets[index], flips = (wheel && Array.isArray(wheel.flips) ? wheel.flips : []).filter((i) => Number.isInteger(i) && i >= 0 && i < 64);
  const hex = flipLights(crystal, flips), d = decodePacket(hex), star = lensOf(lens) === "stargazer";
  const equalsCrystal = hex === crystal;
  const readout = [];
  readout.push({ layer: "checked", text: star ? "The word now reads " + hex + "." : "Word " + (index + 1) + " of " + count + " reads " + hex + "." });
  readout.push({ layer: "checked", text: d.parityOk ? (star ? "The guard light agrees with the other 63." : "Parity holds: the guard bit is the XOR of the other 63.")
    : (star ? "The guard notices: a light was flipped." : "Parity fails: an odd number of bits was flipped.") });
  readout.push({ layer: "checked", text: equalsCrystal ? (star ? "It is still the word of its piece of text." : "It still equals the crystal packet of its chunk.")
    : (star ? "It is no longer the word of its piece of text." : "It no longer equals the crystal packet of its chunk: the crystal check refuses it.") });
  return {
    index, count, crystal, hex, digits: hex.split(""), changed: !equalsCrystal, flips, parityOk: d.parityOk, equalsCrystal, plain: star,
    cells: wheelCells(hex, lensOf(lens)), fields: WORD_FIELDS.map((f) => ({ ...f, value: d[f.key] })), readout,
  };
}
/** sectorLights(hex, sector) -> the four lights of one hex digit as buttons: [{ i, weight, on, label ("8, on"), name }]. */
export function sectorLights(hex, sector) {
  return wheelCells(hex).filter((c) => c.sector === sector).map((c) => ({ i: c.i, weight: c.weight, on: c.on, label: c.weight + ", " + (c.on ? "on" : "off"), name: c.name }));
}
/** WHEEL_COPY: the captions of the Wheel tab, each with its layer: perLens (one caption per lens), ladder, parity, stargazerWheel. */
export const WHEEL_COPY = freeze({
  label: "The word wheel: one packet of 64 lights",
  squareLabel: "The same word as a square, 8 by 8",
  views: freeze([freeze({ key: "wheel", label: "Wheel" }), freeze({ key: "square", label: "Square 8 × 8" })]),
  perLens: freeze({
    stargazer: freeze({ layer: "checked", text: "On this curved map the thin outer lights are as big as the wide inner ones." }),
    navigator: freeze({ layer: "checked", text: "Sixteen sectors of four rings: each sector is one hex digit, and on this curved map all 64 cells have the same area." }),
    holographer: freeze({ layer: "checked", text: "Ring radii from equalAreaRings(1.5, 4): 64 cells of hyperbolic area " + WHEEL_CELL_AREA.toFixed(4) + " each. Sector = i >> 2, ring = i & 3, bit = 63 − i." }),
  }),
  stargazerWheel: freeze({ layer: "checked", text: "One message made of 64 lights: 16 slices of 4. One slice is one letter of the code. One light is the guard: flip any one light and the guard notices. Flip two and it is fooled, which is why the chain keeps stronger checks too." }),
  ladder: freeze({ layer: "checked", text: "1 → 4 → 16 → 64: bit, sector, quarter, word" }),
  parity: freeze({ layer: "checked", text: "Parity catches one flipped bit, or any odd number. Two flips cancel: parity holds again although the word has changed; the crystal check catches that." }),
  pick: "Tap a slice to open its four lights.",
});
/** wheelAuthorLine(lexicon, lens) -> { label, quoted, source, facet: rowView } for the author's line 10 on the Wheel tab (null unless the built-in lexicon has it). */
export function wheelAuthorLine(lexicon, lens) {
  const a = HANDLES.sixteenth;
  if (lexicon.origin !== "builtin" || !isAuthorLine(lexicon, a)) return null;
  const f = firstFacet(lexicon, a);
  return f ? { label: AUTHOR_LABEL[lensOf(lens)], quoted: quoted(entryOf(lexicon, a).text), source: a, facet: rowView(lexicon, f, lens) } : null;
}

// ─── 12. the fourth square: the figures of station 7 ─────────────────────────

/** TQF_GRID: the small integer grid of figure (a): coordinates 0..6 on both axes. */
export const TQF_GRID = freeze({ min: 0, max: 6 });
/** TQF_PRESETS: three ready sets of three points for figure (a). */
export const TQF_PRESETS = freeze([
  freeze({ key: "345", label: "Sides 3, 4 and 5", points: freeze([freeze([0, 0]), freeze([3, 0]), freeze([0, 4])]) }),
  freeze({ key: "line", label: "Three in a line", points: freeze([freeze([0, 0]), freeze([2, 2]), freeze([4, 4])]) }),
  freeze({ key: "wide", label: "A wide triangle", points: freeze([freeze([0, 1]), freeze([6, 0]), freeze([2, 5])]) }),
]);
const trim = (n) => String(Number(n.toFixed(3)));
/** threeSquares(points) -> { ok, points, squares: [Q1, Q2, Q3], A (decimal text of the exact BigInt), area, areaSquared, collinear, sentence, layer }
 *  for three integer points [x, y]: the squared distances and A = (Q1 + Q2 + Q3)² − 2(Q1² + Q2² + Q3²) = 16 · area² (gramTqf). */
export function threeSquares(points) {
  const fine = Array.isArray(points) && points.length === 3 && points.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isSafeInteger));
  if (!fine) return { ok: false, points: [], squares: [], A: "", area: null, areaSquared: null, collinear: false, sentence: "Three points with whole-number coordinates are needed.", layer: "checked" };
  const q = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const [p1, p2, p3] = points, squares = [q(p2, p3), q(p1, p3), q(p1, p2)];
  const A = gramTqf(p1, p2, p3), areaSquared = Number(A) / 16, area = Math.sqrt(areaSquared), collinear = A === 0n;
  const up = squares.slice().sort((a, b) => a - b);
  const sentence = "Computed: the squared distances are " + up[0] + ", " + up[1] + " and " + up[2] + ". A = " + A.toString()
    + (collinear ? ": zero, so the three points are in line." : " = 16 × " + trim(areaSquared) + ", sixteen times the squared area. The area is " + trim(area) + ".");
  return { ok: true, points: points.map((p) => p.slice()), squares, A: A.toString(), area, areaSquared, collinear, sentence, layer: "checked" };
}
/** tqfSnap(u, v) -> [x, y]: the grid point nearest a point of the figure (u, v from 0 to 1 from its top left corner; y runs up). */
export function tqfSnap(u, v) {
  const span = TQF_GRID.max - TQF_GRID.min, c = (t) => Math.min(TQF_GRID.max, Math.max(TQF_GRID.min, Math.round(TQF_GRID.min + t * span)));
  return [c(u), c(1 - v)];
}
/** tqfPlace([x, y]) -> [u, v]: where a grid point is drawn in the figure (the inverse of tqfSnap). */
export const tqfPlace = (p) => { const span = TQF_GRID.max - TQF_GRID.min; return [(p[0] - TQF_GRID.min) / span, 1 - (p[1] - TQF_GRID.min) / span]; };
/** tqfNearest(points, u, v) -> the index (0, 1, 2) of the point nearest a pointer position: the one a drag takes hold of. */
export function tqfNearest(points, u, v) {
  let best = 0, bestD = Infinity;
  points.forEach((p, i) => { const [pu, pv] = tqfPlace(p), dd = (pu - u) ** 2 + (pv - v) ** 2; if (dd < bestD) { bestD = dd; best = i; } });
  return best;
}

/** TQF_MOVES: the four moves of one point of figure (a) by one grid step, for the buttons under the figure: { key, label, dx, dy }. */
export const TQF_MOVES = freeze([
  freeze({ key: "left", label: "Left", dx: -1, dy: 0 }), freeze({ key: "right", label: "Right", dx: 1, dy: 0 }),
  freeze({ key: "up", label: "Up", dx: 0, dy: 1 }), freeze({ key: "down", label: "Down", dx: 0, dy: -1 }),
]);
/** tqfStep(points, index, key) -> new points with point `index` moved one grid step (a TQF_MOVES key), kept inside TQF_GRID; the same
 *  points (copied) for an unknown index or key. What a drag does with a pointer, a button does with this. */
export function tqfStep(points, index, key) {
  const m = TQF_MOVES.find((x) => x.key === key), c = (v) => Math.min(TQF_GRID.max, Math.max(TQF_GRID.min, v));
  return points.map((p, i) => (m && i === index ? [c(p[0] + m.dx), c(p[1] + m.dy)] : p.slice()));
}
/** nextWrongBit(current) -> the light of the fourth corner (0..15) that "Flip one light" flips after one more press: it starts at light 6
 *  (index 5), steps through all sixteen and then puts the corner back (null). A tap on the figure flips any light directly. */
export function nextWrongBit(current) {
  if (!Number.isInteger(current) || current < 0 || current > 15) return 5;
  const next = (current + 1) % 16;
  return next === 5 ? null : next;
}
/** MIRROR_STARGAZER: the caption of the mirror word where Stargazer has it (a closed box inside "Stamp it"); MIRROR_BOX is the box's name. */
export const MIRROR_STARGAZER = freeze({ layer: "checked", text: "Built: four lights in one corner fill all 64 by mirrors. Hide the last corner. The other three give it back." });
/** MIRROR_BOX: the name of the closed box that holds the mirror word inside "Stamp it" at Stargazer. */
export const MIRROR_BOX = "Three corners give the fourth";
/** mirrorCaptionStargazer({ hidden, wrongBit, caught }) -> the caption under that picture, in Stargazer words, for what is shown now (takes a mirrorFigure value). */
export function mirrorCaptionStargazer(figure) {
  const f = figure || {};
  if (f.hidden) return "The last corner is hidden. The picture shows what the other three corners give.";
  if (f.wrongBit !== null && f.wrongBit !== undefined) return f.caught ? "One light in the last corner was flipped. It no longer fits the other three." : "One light was flipped.";
  return "All four corners are shown. Each one is a mirror picture of the others.";
}
/** FOURTH_LINE: the address of the author's line 6, which station 7 runs (the station links to it). */
export const FOURTH_LINE = HANDLES.fourthSquare;

/** mirrorFigure(seed, { hidden, wrongBit }) -> figure (b): four seed bits fill all 64 by the mirror rule, and three corner squares give the fourth.
 *  { seed, hex, cells, steps: [{ size, bits }] (2 × 2, 4 × 4, 8 × 8), quarters: [topLeft, topRight, bottomLeft, bottomRight],
 *    predicted (from each of the three), agree, restored, hidden, fourth (the bottom-right square as shown: predicted while hidden),
 *    wrongBit, caught, parityOk, ones, sentences: [{ layer, text }] } */
export function mirrorFigure(seed, options = {}) {
  const s = Array.isArray(seed) && seed.length === 4 ? seed.map((b) => (b ? 1 : 0)) : [1, 0, 0, 1];
  const hex = seedMirror(s), cells = glyphCells(hex), quarters = squareQuarters(hex);
  const predicted = fourthFromThree(quarters[0], quarters[1], quarters[2]);
  const restored = predicted.agree && predicted.fromTopLeft.every((b, k) => b === quarters[3][k]);
  const wrongBit = Number.isInteger(options.wrongBit) && options.wrongBit >= 0 && options.wrongBit < 16 ? options.wrongBit : null;
  const actual = quarters[3].map((b, k) => (k === wrongBit ? 1 - b : b));
  const caught = wrongBit !== null && actual.some((b, k) => b !== predicted.fromTopLeft[k]);
  const hidden = !!options.hidden, ones = cells.filter((c) => c.on).length;
  const sentences = [
    { layer: "checked", text: "Built: four lights, one sixteenth of the square, fill all 64 by mirrors: 2 × 2, then 4 × 4, then 8 × 8. This word is " + hex + "." },
    { layer: "checked", text: restored ? "Tested: each of the three other corner squares gives the fourth, bit for bit." : "Tested: the three corner squares do not agree on the fourth." },
  ];
  if (wrongBit !== null) sentences.push({ layer: "checked", text: caught ? "Tested: one flipped light in the fourth square is caught: it no longer matches what the other three give." : "Tested: the flipped light was not caught." });
  return {
    seed: s, hex, cells, steps: [{ size: 2, bits: s.slice() }, { size: 4, bits: quarters[0].slice() }, { size: 8, bits: cells.map((c) => (c.on ? 1 : 0)) }],
    quarters, predicted, agree: predicted.agree, restored, hidden, fourth: hidden ? predicted.fromTopLeft.slice() : actual,
    wrongBit, caught, parityOk: decodePacket(hex).parityOk, ones, sentences,
  };
}
/** mirrorWords() -> the 16 words the mirror rule can make: [{ seed, hex, parityOk, ones }]. */
export function mirrorWords() {
  const out = [];
  for (let n = 0; n < 16; n++) {
    const seed = [n & 1, (n >> 1) & 1, (n >> 2) & 1, (n >> 3) & 1], hex = seedMirror(seed);
    out.push({ seed, hex, parityOk: decodePacket(hex).parityOk, ones: glyphCells(hex).filter((c) => c.on).length });
  }
  return out;
}
/** quarterFigure(hex) -> figure (c): { hex, parities: [p0, p1, p2, p3], predicted (p0 ^ p1 ^ p2), actual (p3), fits, parityOk, sentence, layer }. */
export function quarterFigure(hex) {
  const parities = quarterParities(hex), predicted = parities[0] ^ parities[1] ^ parities[2], actual = parities[3], ok = decodePacket(hex).parityOk;
  const word = (p) => (p ? "odd" : "even");
  return {
    hex: hex.toUpperCase(), parities, predicted, actual, fits: predicted === actual, parityOk: ok, layer: "checked",
    sentence: "Tested: the first three quarters are " + word(parities[0]) + ", " + word(parities[1]) + " and " + word(parities[2]) + ", so the fourth must be " + word(predicted)
      + ". It is " + word(actual) + (predicted === actual ? ": the guard holds." : ": the guard fails."),
  };
}
/** squaresFigure() -> figure (d): { squares: [1, 4, 9], next: 16, formula, sentence, layer }, from squareNumbersNext. */
export function squaresFigure() {
  const next = squareNumbersNext(1, 4, 9);
  return { squares: [1, 4, 9], next, formula: "3 × 9 − 3 × 4 + 1 = " + next, layer: "checked",
    sentence: "Counted: the first three squares are 1, 4 and 9, and three squares in a row fix the next: 3 × 9 − 3 × 4 + 1 = " + next + "." };
}
/** cornersFigure() -> figure (e): { flat: { meet, angle, sentence }, curved: { meet, angle, lambert, sentence }, layer }; angles in degrees. */
export function cornersFigure() {
  const t = tilingConstants(4, 5), deg = 180 / Math.PI, meet = Math.round(2 * Math.PI / t.angle), lambert = lambertAngle(0.5, 0.5) * deg;
  return {
    layer: "checked",
    flat: { meet: 4, angle: 90, sentence: "On flat paper four squares meet at a corner, so three leave room for exactly one." },
    curved: { meet, angle: t.angle * deg, lambert,
      sentence: "On the curved map a four-cornered figure with three right angles has a fourth angle smaller than a right angle, and in the {4,5} tiling " + numberWord(meet) + " squares meet at each corner." },
  };
}
/** CERTIFIED: the wording of what a certificate covers, sentence by sentence with layers; CERTIFIED_TEXT joins them. */
export const CERTIFIED = freeze([
  freeze({ layer: "checked", text: "Certified: these bytes, their order, their addresses, the label each entry was given, the lineage and the ledger, unchanged since they were sealed with this key." }),
  freeze({ layer: "checked", text: "Not certified: that a TEXT entry matches its source, that a SAID entry is faithful, that a CHECKED number is right, that any READING is true, or who sealed it." }),
  freeze({ layer: "reading", text: "A TEXT row is checked by reading the source it names, a CHECKED row by running the code, a SAID row by opening the work cited." }),
  freeze({ layer: "said", text: "This project reports: its tests compared the verse entries with the Project Gutenberg King James files (November 2026), and its builders compared each quotation with the source named. That review, not the seal, is the reason to trust the labels; you can repeat it by opening the sources." }),
]);
/** CERTIFIED_TEXT: the four sentences of CERTIFIED as one paragraph. */
export const CERTIFIED_TEXT = CERTIFIED.map((s) => s.text).join(" ");
/** CERTIFIED_STARGAZER: the same in Stargazer words. */
export const CERTIFIED_STARGAZER = freeze({ layer: "checked", text: "The stamp shows this exact writing has not changed since it was stamped. It does not show that the writing is true. It does not show who stamped it." });

// ─── 13. seal, tamper and send: flows over the core ──────────────────────────
// These are async and do the heavy work (growing the chain, signing, verifying). The shell wraps each in
// withBusy() and paints in the callbacks. A time `at` and keys can be passed in so that a test is deterministic.

/** epochRows(lexicon) -> [{ epoch, address, name }]: the top-level entries, one growth epoch each, in address order. */
export const epochRows = (lexicon) => topLevelOf(lexicon).map((e, i) => ({ epoch: i + 1, address: e.address, name: e.name }));
/** epochLine({ epoch, epochs }, lens) -> "epoch 3 of 14" ("part 3 of 14" at Stargazer). */
export const epochLine = (p, lens) => (lensOf(lens) === "stargazer" ? "part " : "epoch ") + p.epoch + " of " + p.epochs;
/** packageFileName(chainId) -> "hyperpack-BC-….json", or null when the chain id is not of that form. */
export const packageFileName = (chainId) => (typeof chainId === "string" && /^BC-[0-9a-f]{24}$/.test(chainId) ? "hyperpack-" + chainId + ".json" : null);

/**
 * sealLexicon(lexicon, { keys, at, onEpoch }) -> { ok, keys, at, bundle, certificate, report, pack, wire, chainId, fileName }.
 * Grows the chain epoch by epoch (awaiting onEpoch({ epoch, epochs, chain, addedBytes }) after each), inspects it and signs the
 * certificate once, and writes the wire: JSON.stringify(makeHyperpack(...)). ok is false, with the report, when a check fails.
 * A lexicon from outside is not sealed here (ok false).
 */
export async function sealLexicon(lexicon, options = {}) {
  const at = typeof options.at === "string" ? options.at : new Date().toISOString();
  if (lexicon.origin === "outside") return { ok: false, keys: null, at, bundle: null, certificate: null, report: null, pack: null, wire: null, chainId: null, fileName: null };
  const keys = options.keys || await newSessionKeys();
  const bundle = await buildLexiconBundle(lexicon.entries, { at, onEpoch: options.onEpoch });
  const { certificate, report } = await issueCertificate(bundle, keys, at);
  if (!certificate) return { ok: false, keys, at, bundle, certificate: null, report, pack: null, wire: null, chainId: bundle.chain.chainId, fileName: null };
  const pack = makeHyperpack({ ...bundle, certificate }), wire = JSON.stringify(pack);
  return { ok: true, keys, at, bundle, certificate, report, pack, wire, chainId: bundle.chain.chainId, fileName: packageFileName(bundle.chain.chainId) };
}
/** PASS_WORDING: how a pass is worded (never "all checks pass" alone). */
export const PASS_WORDING = freeze({ stargazer: "The stamp fits: this exact writing is unchanged since it was stamped.", navigator: "Every check passed: unchanged since it was sealed.", holographer: "Every check passed: unchanged since it was sealed." });
/** CHAIN_NAME_LABEL: what the chain name is called under the verdict of the Seal station: the sky page's words at Stargazer. */
export const CHAIN_NAME_LABEL = freeze({ stargazer: "The name of this stamp", navigator: "Chain name", holographer: "Chain name" });
/** OWN_KEY_NOTE: the words this page puts after the name of a key it made itself in this visit. Never shown for a package from a file:
 *  that key was made by whoever sealed the file, at a time this page cannot know. */
export const OWN_KEY_NOTE = "(a key made for this visit)";
/** sealView(seal, lens) -> { ok, verdict, chain: { label, value } | null, rows: [{ key, label, value, hash }], checks, fileName }: what the Seal
 *  station and the Chain tab print for a package this page sealed in this visit. chain is the chain name, shown under the verdict at every lens. */
export function sealView(seal, lens) {
  const l = lensOf(lens);
  if (!seal || !seal.ok) return { ok: false, verdict: seal && seal.report ? "A check failed: " + seal.report.failed + "." : "Not sealed yet.", chain: null, rows: [], checks: seal && seal.report ? seal.report.checks : [], fileName: null };
  const c = seal.bundle.chain, cert = seal.certificate, rows = [];
  if (l !== "stargazer") {
    rows.push({ key: "chain", label: "Chain name", value: c.chainId, hash: true });
    rows.push({ key: "epochs", label: "Epochs", value: String(c.epoch || 1), hash: false });
    rows.push({ key: "entries", label: "Entries", value: String(seal.bundle.lexicon.entries.length), hash: false });
    rows.push({ key: "merkle", label: "Merkle root", value: c.merkleRoot, hash: true });
    rows.push({ key: "lexicon", label: "Lexicon root", value: seal.bundle.lexicon.root, hash: true });
    rows.push({ key: "seal", label: "Signed by key", value: cert.sealId + " " + OWN_KEY_NOTE, hash: true });
    if (l === "holographer") rows.push({ key: "line", label: "The signed line", value: cert.commitment, hash: true });
  }
  return { ok: true, verdict: PASS_WORDING[l], chain: { label: CHAIN_NAME_LABEL[l], value: c.chainId }, rows, checks: seal.report.checks, fileName: seal.fileName };
}

/** RESEAL_TEXT: what the page says when the resealed, relabelled package is accepted. */
export const RESEAL_TEXT = "These are different bytes under a different key. A seal protects what was sealed. It cannot tell you that a label is deserved or whose key it is.";
/** TAMPER_COPY: per tamper key { stargazer (shown at Stargazer), noticed, noticedStargazer }: the sentence of a refusal. */
export const TAMPER_COPY = freeze({
  word: freeze({ stargazer: true, noticed: "The seal noticed that a word was changed.", noticedStargazer: "The stamp no longer fits. A word was changed." }),
  drop: freeze({ stargazer: true, noticed: "The seal noticed that an entry is missing.", noticedStargazer: "The stamp no longer fits. Something is missing." }),
  add: freeze({ stargazer: true, noticed: "The seal noticed an entry that was not sealed.", noticedStargazer: "The stamp no longer fits. Something was added." }),
  move: freeze({ stargazer: false, noticed: "The seal noticed that two addresses were exchanged.", noticedStargazer: "The stamp no longer fits. Two places were swapped." }),
  relabel: freeze({ stargazer: false, noticed: "The seal noticed that a label was changed.", noticedStargazer: "The stamp no longer fits. A badge was changed." }),
  ledger: freeze({ stargazer: false, noticed: "The seal noticed that an entry of the ledger is missing.", noticedStargazer: "The stamp no longer fits. A line of the record is missing." }),
  signature: freeze({ stargazer: false, noticed: "The signature no longer fits the signed line.", noticedStargazer: "The stamp no longer fits. The signing was changed." }),
  reseal: freeze({ stargazer: false, noticed: RESEAL_TEXT, noticedStargazer: RESEAL_TEXT }),
});
/** tamperRows(lens) -> [{ key, label, expected }]: the tamper buttons this lens shows (three at Stargazer, all eight otherwise), from LEXICON_TAMPERS;
 *  at Stargazer "an entry" in a label reads "a thing". */
export function tamperRows(lens) {
  const star = lensOf(lens) === "stargazer";
  // "entry" is not a Stargazer word: that lens says "thing", as its list and its status line do
  return LEXICON_TAMPERS.filter((r) => !star || (TAMPER_COPY[r.key] && TAMPER_COPY[r.key].stargazer)).map((r) => ({ key: r.key, label: star ? r.label.replace(/\ban entry\b/, "a thing") : r.label, expected: r.expected }));
}
/** tamperSentence(result, lens) -> the sentence for a result of runTamper, worded for that lens. The page keeps the result (the facts) and
 *  words it each time it is shown, so that a change of lens changes the wording too. From Navigator up a refusal names the check. */
export function tamperSentence(result, lens) {
  const star = lensOf(lens) === "stargazer";
  if (!result || result.ran !== true) return result && result.why === "unmade" ? "This change could not be made on this package." : star ? "Stamp it first." : "Seal the lexicon first.";
  if (result.accepted) return result.expected === "accepted" ? RESEAL_TEXT : "This change was not noticed.";
  // a refusal is worded as a refusal also where the table expected an acceptance (the reseal row's own copy is about being accepted)
  const copy = Object.hasOwn(TAMPER_COPY, result.key) && result.expected !== "accepted" ? TAMPER_COPY[result.key] : { noticed: "", noticedStargazer: "The stamp no longer fits." };
  return star ? copy.noticedStargazer : ("Refused at the check called " + result.got + ". " + copy.noticed).trim();
}
/**
 * runTamper(seal, key, { newKeys, at, lens, rows }) -> { ran, why, key, label, expected, got, asDeclared, accepted, checks, verdict, sentence, sealId }.
 * Applies one row of LEXICON_TAMPERS to a copy of the sealed package and sends the result through the front door
 * (readHyperpack). got is the check that refused it, or "accepted"; the verdict word is the front door's answer, never the
 * table's expectation. The sealed package itself is left as it was. For a tamper that ran, sentence is tamperSentence(result, lens).
 * why says why nothing ran: "unsealed" or "unmade". rows replaces the table (a seam for the unit test).
 */
export async function runTamper(seal, key, options = {}) {
  const table = Array.isArray(options.rows) ? options.rows : LEXICON_TAMPERS, lens = options.lens;
  const row = table.find((r) => r.key === key);
  const none = { ran: false, why: "unsealed", key, label: row ? row.label : "", expected: row ? row.expected : null, got: null, asDeclared: false, accepted: false, checks: [], verdict: "", sentence: "Seal the lexicon first.", sealId: null };
  if (!row || !seal || !seal.ok) return none;
  let changed;
  try { changed = await row.apply(JSON.parse(seal.wire), { newKeys: options.newKeys || newSessionKeys, at: typeof options.at === "string" ? options.at : seal.at }); }
  catch { return { ...none, why: "unmade", sentence: "This change could not be made on this package." }; }
  const verdict = await readHyperpack(JSON.stringify(changed));
  const got = verdict.ok ? "accepted" : verdict.failed;
  const result = {
    ran: true, why: null, key, label: row.label, expected: row.expected, got, asDeclared: got === row.expected, accepted: verdict.ok === true, checks: verdict.checks,
    verdict: verdict.ok ? "ACCEPTED" : "REFUSED", sentence: "", sealId: verdict.ok && verdict.pack ? verdict.pack.certificate.sealId : null,
  };
  return { ...result, sentence: tamperSentence(result, lens) };
}

/** RECEIVERS: the four crossroads receivers of First Explorers: [{ id, city }]. */
export const RECEIVERS = freeze(CROSSROADS.map((c) => freeze({ id: c.id, city: c.city })));
/** NOISY_ROAD: the receivers whose copy is damaged when the noise switch is on (Athens and Rome share a road). */
export const NOISY_ROAD = freeze(["athens", "rome"]);
/** WITNESS_MARKS: the two marks on the count of handshakes. */
export const WITNESS_MARKS = freeze([
  freeze({ need: 2, label: "two: enough for the rule of Deuteronomy 19:15, as a demonstration" }),
  freeze({ need: 3, label: "three: the stricter count in the same verse" }),
]);
/** makeReceivers(newKeys) -> [{ id, city, keys, sealId }]: a separate key pair for each receiver (a key that seals never answers). */
export async function makeReceivers(newKeys = newSessionKeys) {
  const out = [];
  for (const r of RECEIVERS) { const keys = await newKeys(); out.push({ id: r.id, city: r.city, keys, sealId: await sealIdFromPublic(keys.publicJwk) }); }
  return out;
}
/** noisyWire(wire, n) -> the wire with one hex digit of the chain's stream changed (what noise on the road does). */
export function noisyWire(wire, n = 0) {
  const at = wire.indexOf('"stream":"');
  const i = at < 0 ? Math.floor(wire.length / 2) : at + 13 + ((n * 7) % 12);
  return wire.slice(0, i) + (wire[i] === "0" ? "1" : "0") + wire.slice(i + 1);
}
/** QUORUM_LIMIT: what the count of handshakes shows and what it does not (layer checked). It closes quorumSentence and stands directly under the count. */
export const QUORUM_LIMIT = freeze({ layer: "checked", text: "This shows how a two-witness rule is checked. It does not show that independent parties have looked." });
/** quorumSentence(k, n) -> the CHECKED wording of the Send station for k of n receivers. */
export function quorumSentence(k, n = 4) {
  const all = n === 4 ? "four" : numberWord(n);
  return k + " of the " + all + " receivers accepted. All " + all + " run inside this page, with the same code, each with a key made a moment ago. " + QUORUM_LIMIT.text;
}
/** handshakeCount(k, of) -> "4 of 4 handshakes in this page": the count line of the Send station and of the Witnesses tab (layer checked).
 *  The count never stands without saying where the handshakes happened; QUORUM_LIMIT follows it. */
export const handshakeCount = (k, of) => k + " of " + of + " handshakes in this page";
/** SEND_READING: the READING sentence of the Send station. It names the rule itself: a sky has no verse and no gold box above it. */
export const SEND_READING = freeze({ layer: "reading", text: "The page borrows a number from the rule of Deuteronomy 19:15 and nothing more. That rule is about people giving evidence." });
/**
 * sendToReceivers(seal, receivers, { noise, at, onAnswer }) -> { rows, k, of, marks: [{ need, label, met }], sentence, stargazer, answers }.
 * Each receiver in turn is handed the wire (damaged for the receivers named by noise: true means NOISY_ROAD, or a list of ids),
 * verifies everything itself and signs a HANDSHAKE/1 answer with its own key; onAnswer(row, index) is awaited after each so the page can paint.
 * Then witnessQuorum counts the answers twice (need 2 and need 3) against the wire that was sent; the sealer's key never counts.
 * rows: [{ id, city, noise, accepted, failed, counted, sealId }].
 */
export async function sendToReceivers(seal, receivers, options = {}) {
  if (!seal || !seal.ok) return { rows: [], k: 0, of: 0, marks: WITNESS_MARKS.map((m) => ({ ...m, met: false })), sentence: "Seal the lexicon first.", stargazer: "Stamp it first.", answers: [] };
  const at = typeof options.at === "string" ? options.at : seal.at;
  const noisy = options.noise === true ? NOISY_ROAD : Array.isArray(options.noise) ? options.noise : [];
  const rows = [], answers = [];
  for (let i = 0; i < receivers.length; i++) {
    const r = receivers[i], noise = noisy.includes(r.id);
    let verdict = { ok: false, failed: "parse" }, answer = null;
    try { ({ verdict, answer } = await answerHyperpack(noise ? noisyWire(seal.wire, i) : seal.wire, r.keys, at)); } catch { /* the receiver could not read it: no answer */ }
    const row = { id: r.id, city: r.city, noise, accepted: verdict.ok === true, failed: verdict.ok ? null : verdict.failed, counted: false, sealId: r.sealId };
    rows.push(row); answers.push(answer);
    if (typeof options.onAnswer === "function") await options.onAnswer(row, i);
  }
  const known = receivers.map((r) => r.sealId), exclude = [seal.certificate.sealId];
  const two = await witnessQuorum(answers, seal.wire, { need: 2, known, exclude });
  const three = await witnessQuorum(answers, seal.wire, { need: 3, known, exclude });
  for (const row of rows) row.counted = two.accepted.includes(row.sealId);
  const k = two.accepted.length;
  return {
    rows, k, of: receivers.length, answers,
    marks: [{ ...WITNESS_MARKS[0], met: two.met }, { ...WITNESS_MARKS[1], met: three.met }],
    sentence: quorumSentence(k, receivers.length),
    stargazer: k >= 2 ? numberWord(k).replace(/^./, (c) => c.toUpperCase()) + " receivers checked the stamp and agreed, so the parcel arrived unchanged. They are pretend receivers inside this page."
      : "Fewer than two receivers agreed. They are pretend receivers inside this page.",
  };
}

// ─── 14. a lexicon from outside ──────────────────────────────────────────────

/** OUTSIDE_NOTICE: shown before anything of a loaded package is drawn; the visitor presses SHOW_IT. Its first two sentences are OUTSIDE_BANNER. */
export const OUTSIDE_NOTICE = "This lexicon was not made by this page. Its words and its labels are its sender's. The checks below show only that the lexicon, its labels and the ledger up to the signed point have not changed since some key signed them.";
/** OUTSIDE_BANNER: the first two sentences of OUTSIDE_NOTICE: the short form for the status line and the load box. The banner over a lexicon from outside carries all of OUTSIDE_NOTICE. */
export const OUTSIDE_BANNER = "This lexicon was not made by this page. Its words and its labels are its sender's.";
/** OUTSIDE_SHORT: the one line of the banner under 700 px, where the banner stays at the top of the window (the whole notice stands under it once). */
export const OUTSIDE_SHORT = "Not made by this page. Its words and labels are its sender's.";
/** OUTSIDE_LEGEND: the line that heads the legend of the badges while a lexicon from outside is shown. */
export const OUTSIDE_LEGEND = "What these labels would mean on this page's own lexicon. Here they are the sender's claims.";
/** SHOW_IT: the button under OUTSIDE_NOTICE. */
export const SHOW_IT = "Show it";
/** LOAD_COPY: the words of the Load control and its refusals. */
export const LOAD_COPY = freeze({
  label: "Load a package file",
  tooLarge: "That file is too large to be a package.",
  refused: "This package did not pass. Nothing of it is shown beyond the check that refused it.",
  journey: "This is a First Explorers journey.",
  notCovered: "Not covered by the signature",
});
/** CHECK_SENTENCES: the page's own sentence for each check name (a Map, for checkList of the kit). */
export const CHECK_SENTENCES = new Map([
  ["parse", "The text is a package in wire form."],
  ["parity", "Every packet's guard bit holds."],
  ["canonical", "Every chunk of the text is stored in its one canonical form."],
  ["crystal", "Every packet is the crystal of its chunk of the text."],
  ["leaves", "The leaf hashes and the Merkle root are the ones the text gives."],
  ["weaves", "The weaves, the segments and the chain name are the ones the text gives."],
  ["derived", "The sizes and the value are the ones the text gives."],
  ["meaning", "Every line of the text is a canonical line of its format."],
  ["lexicon", "The lexicon is exactly the one the lines give: addresses, labels, names and line hashes."],
  ["lineage", "Every epoch, recomputed from the text, is the one the lineage lists."],
  ["trace", "The ledger's links are whole and every epoch is recorded in it."],
  ["commitment", "The certificate's line is the one this evidence gives."],
  ["signature", "The signature fits that line and the key shown."],
]);
/** fileAllowed(size) -> true when a file of that many bytes may be read (at most MAX_FILE_BYTES). */
export const fileAllowed = (size) => Number.isFinite(size) && size >= 0 && size <= MAX_FILE_BYTES;
const PLAIN = /^[ -~]{0,160}$/;
const plainText = (v) => (typeof v === "string" && PLAIN.test(v) ? v : null);
/** LEDGER_POINTS: a string of a ledger entry of a package from outside is shown up to this many code points. */
export const LEDGER_POINTS = 96;
/** LEDGER_CUT_NOTE: the page's line under a ledger in which a string was cut. */
export const LEDGER_CUT_NOTE = "A string that ends in … was longer: this page shows its first " + (LEDGER_POINTS - 1) + " characters.";
// One field of a ledger entry as it is handed to the shell: a number as it is, a string cut to LEDGER_POINTS, anything else "".
const ledgerField = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" ? cutLabel(v, LEDGER_POINTS) : "");
const wasCut = (v) => typeof v === "string" && ledgerField(v) !== v;
/** LEDGER_ROWS: of the covered ledger entries of a package from outside the first this many are listed; the page says how many were left out. */
export const LEDGER_ROWS = 200;

/**
 * readOutside(text) -> the view model of a package that did not originate in this page (always through readHyperpack):
 *   { ok, failed, checks, kind ("tree" | "journey" | null), lexicon (origin "outside") | null, notice, banner, line,
 *     covered: { chainId, merkleRoot, epoch, entries, lexiconRoot, lineage: [{ epoch, chainId, merkleRoot }],
 *                ledger: [{ n, actor, event, detail, at, cut }] (the first LEDGER_ROWS covered entries at most),
 *                ledgerTotal (the exact number of covered entries), ledgerMore (how many of them are not listed, 0 when all are),
 *                ledgerMoreLine ("and 2752 more ledger entries, not listed", "" when all are listed),
 *                ledgerCut (true when a string of a listed entry was cut), commitment, sealId } | null,
 *     signature ("signed by key S-…; this page cannot know whose key that is"), notCovered: { heading, items: [{ label, value }] } | null }
 * A package that fails gives only ok, failed and checks. Every string under lexicon, covered.ledger and notCovered is the sender's.
 * A string of the ledger may be of any length in the file: here each is cut to LEDGER_POINTS code points (the cut one ends in …), so
 * that the full value never reaches the page. A ledger may hold thousands of entries: the page lists the first LEDGER_ROWS of the covered
 * ones (a ledger this page writes itself is far shorter) and prints ledgerMoreLine under them. Nothing here says the key was made in this visit:
 * it was made by whoever sealed the file.
 */
export async function readOutside(text) {
  const verdict = await readHyperpack(text);
  const base = { ok: verdict.ok, failed: verdict.failed, checks: verdict.checks, kind: null, lexicon: null, notice: OUTSIDE_NOTICE, banner: OUTSIDE_BANNER, line: "", covered: null, signature: "", notCovered: null };
  if (!verdict.ok || !verdict.pack) return { ...base, ok: false, line: LOAD_COPY.refused };
  const pack = verdict.pack, tree = profileOf(pack.lexicon).format === "LEXICON/2";
  let lexicon = null;
  if (tree) {
    try { lexicon = makeLexicon(entriesOfPack(pack), "outside", "A lexicon from outside", ""); }
    catch { return { ...base, ok: false, failed: "parse", line: LOAD_COPY.refused }; }
  }
  const cert = pack.certificate, trace = Array.isArray(pack.trace) ? pack.trace : [];
  const head = trace.findIndex((e) => e && e.hash === cert.traceHead), upTo = head < 0 ? trace.length : head + 1;
  const more = Math.max(0, upTo - LEDGER_ROWS);
  const ledger = trace.slice(0, upTo - more).map((e) => ({
    n: ledgerField(e.n), actor: ledgerField(e.actor), event: ledgerField(e.event), detail: ledgerField(e.detail), at: ledgerField(e.at),
    cut: [e.actor, e.event, e.at].some(wasCut),      // of the strings the page shows (the detail is not shown for a package from outside)
  }));
  const items = [];
  if (plainText(cert.issuedAt) !== null) items.push({ label: "issued at", value: cert.issuedAt });
  if (pack.route && plainText(pack.route.from) !== null) items.push({ label: "route, from", value: pack.route.from });
  if (pack.route && plainText(pack.route.to) !== null) items.push({ label: "route, to", value: pack.route.to });
  if (trace.length > upTo) items.push({ label: "ledger entries after the certified head", value: String(trace.length - upTo) });
  return {
    ...base, kind: tree ? "tree" : "journey", lexicon, line: tree ? "" : LOAD_COPY.journey,
    covered: {
      chainId: pack.chain.chainId, merkleRoot: pack.chain.merkleRoot, epoch: pack.chain.epoch || 1, entries: pack.lexicon.entries.length, lexiconRoot: pack.lexicon.root,
      lineage: pack.lineage.map((r) => ({ epoch: r.epoch, chainId: r.chainId, merkleRoot: r.merkleRoot })), ledger,
      ledgerTotal: upTo, ledgerMore: more, ledgerMoreLine: more > 0 ? "and " + plural(more, "more ledger entry", "more ledger entries") + ", not listed" : "",
      ledgerCut: ledger.some((e) => e.cut),
      commitment: cert.commitment, sealId: cert.sealId,
    },
    signature: "signed by key " + cert.sealId + "; this page cannot know whose key that is",
    notCovered: { heading: LOAD_COPY.notCovered, items },
  };
}

// ─── 15. copy: stations, tabs, STRIX and the bridge boxes ────────────────────
// Every sentence a visitor reads carries a layer: { layer, text }. A TEXT sentence is cut out of a verse row of
// ezekiel-1.js by verseSlice() and is never typed here: only the first and last words of the cut are.
// Numbers in CHECKED sentences are computed when the module loads (COPY_FACTS) and recomputed by the unit test.

const T = (layer, text) => freeze({ layer, text });

/** verseSlice(address, from, to) -> the words of a verse row from the first `from` to the end of the next `to` (the whole verse when either is
 *  missing or not given); "" when the lexicon has no such row. */
export function verseSlice(address, from, to) {
  const e = entryOf(EZEKIEL, address);
  if (!e) return "";
  if (!from || !to) return e.text;
  const a = e.text.indexOf(from), b = a < 0 ? -1 : e.text.indexOf(to, a);
  return a < 0 || b < 0 ? e.text : e.text.slice(a, b + to.length);
}
/** A TEXT sentence of a bridge box: the slice, the row it is cut from and the name of the verse with its translation. */
function written(address, from, to) {
  const e = entryOf(EZEKIEL, address);
  return freeze({ layer: "text", text: verseSlice(address, from, to), source: address, name: (e ? e.name.replace(/ \((context|opening words)\)$/, "") : address) + ", King James Version" });
}
/** A SAID or CHECKED sentence of a bridge box, with its Stargazer form where the sentence is hard. */
const stand = (layer, text, stargazer, source, link) => freeze({ layer, text, stargazer: stargazer || null, source: source || null, link: link || null });
const rowSentence = (address, n, fallback) => { const e = entryOf(EZEKIEL, address), s = e ? sentencesOf(e.text) : []; return s[n] || fallback; };

const COUNTS = countTable(), countOf = (word) => (COUNTS.find((c) => c.word === word) || { times: 0 }).times;
const LAYERS_NOW = layerCountsOf(EZEKIEL);
const NAZARETH = SITES.find((s) => s.key === "nazareth"), KEBAR = SITES.find((s) => s.key === "kebar");
const EAST = NAZARETH && KEBAR ? bearingAndDistance(NAZARETH.lat, NAZARETH.lonEast, KEBAR.lat, KEBAR.lonEast) : { bearing: NaN, km: NaN };
// How far apart the two sites are in latitude (degrees), and in the time a star takes from one meridian to the other (4 minutes a degree).
const APART = NAZARETH && KEBAR ? { lat: Math.abs(KEBAR.lat - NAZARETH.lat), minutes: Math.abs(KEBAR.lonEast - NAZARETH.lonEast) * 4 } : { lat: NaN, minutes: NaN };
const REFUSALS = [...new Set(LEXICON_TAMPERS.map((r) => r.expected).filter((x) => x !== "accepted"))];
const SIDES = threeSquares(TQF_PRESETS[0].points);
const listWords = (items) => (items.length < 2 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1]);

/** COPY_FACTS: every number the copy states as CHECKED, as computed when the module loaded (the unit test recomputes each from the cores). */
export const COPY_FACTS = freeze({
  verses: READER_VERSES.length,
  terms: READER_VERSES.reduce((n, v) => n + termsOfVerse(EZEKIEL, v).length, 0),
  counts: freeze(Object.fromEntries(COUNTS.map((c) => [c.word, c.times]))),
  sixteen: READER_VERSES.reduce((n, v) => n + countWord(entryOf(EZEKIEL, v).text, "sixteen"), 0),
  layers: freeze({ text: LAYERS_NOW.text, said: LAYERS_NOW.said, checked: LAYERS_NOW.checked, reading: LAYERS_NOW.reading }),
  entries: LAYERS_NOW.total,
  epochs: topLevelOf(EZEKIEL).length,
  packets: packetsOf(EZEKIEL).length,
  kebar: freeze({
    bearing: Math.round(EAST.bearing), km: Math.round(EAST.km),
    // as the copy states them, no finer than two approximate positions bear: degrees of latitude apart, minutes to the nearest 5, km to the nearest 10
    latApart: Number(APART.lat.toFixed(2)), minutes: Math.round(APART.minutes / 5) * 5, kmRounded: Math.round(EAST.km / 10) * 10,
  }),
  roads: freeze(CROSSROADS.map((c) => c.bearing)),
  refusals: freeze(REFUSALS),
  firstReading: (EZEKIEL.entries.find((e) => e.layer === "reading") || { address: "" }).address,
  sides: freeze({ squares: freeze(SIDES.squares.slice()), A: SIDES.A, area: SIDES.area }),
  wheelCellArea: Number(WHEEL_CELL_AREA.toFixed(4)),
});
const F = COPY_FACTS;
const COUNT_LIST = COUNTS.map((c) => c.word + " " + timesWord(c.times)).join(", ");
const LAYER_LIST = F.layers.text + " TEXT, " + F.layers.said + " SAID, " + F.layers.checked + " CHECKED and " + F.layers.reading + " READING";

/** KEBAR_NAZARETH: the Kebar site and Nazareth, computed from two approximate positions and worded no finer than they bear (layer checked).
 *  The Celestial Control Panel's first gold box has the same sentences, letter for letter. */
export const KEBAR_NAZARETH = T("checked", "Computed from approximate positions: the Kebar site (Nippur) and Nazareth lie "
  + (F.kebar.latApart >= 0.45 && F.kebar.latApart <= 0.65 ? "about half a degree" : "about " + F.kebar.latApart.toFixed(1) + "°")
  + " apart in latitude, so almost the same stars pass overhead at both, about " + F.kebar.minutes + " minutes apart. From Nazareth the site lies roughly due east, about " + F.kebar.kmRounded + " km.");
/** LENS_HINTS: the hint under each lens button on this page. */
export const LENS_HINTS = freeze({ stargazer: "ages 6 and up", navigator: "names, dates and sources", holographer: "formats and hashes" });
/** FIRST_LINE: STRIX's first line. */
export const FIRST_LINE = "The book of Ezekiel begins with a place and a day. Tap a shining word to see what we know about it.";
/** BRIDGE_TITLE: the heading of a bridge box. */
export const BRIDGE_TITLE = "THE BRIDGE";
/** BRIDGE_PARTS: the names of the two parts of a bridge box. */
export const BRIDGE_PARTS = freeze({ reading: "Our reading", stands: "What it stands on" });
const OPENING = "First Explorers drew its bridge as the line through the zero point, at right angles to the map of peoples, and read Jesus of Nazareth as that line. The gold boxes follow that line from Ezekiel's river to John 3:16. This is our reading; no check depends on it, and the word bridge is not in the King James Bible.";
/** BRIDGE_OPENING: the paragraph that opens the page's first gold box (the bridge stated once, with its disclaimer), per lens. */
export const BRIDGE_OPENING = freeze({
  stargazer: T("reading", "Our page First Explorers drew a bridge: a line through the middle of its map. We read Jesus of Nazareth as that line. The gold boxes follow it from Ezekiel's river to John 3:16. This is our reading, and no check depends on it. The word bridge is not in the King James Bible."),
  navigator: T("reading", OPENING),
  holographer: T("reading", OPENING),
});
const perLens = (stargazer, navigator, holographer) => freeze({ stargazer: freeze(stargazer), navigator: freeze(navigator), holographer: freeze(holographer || navigator) });
const reading = (stargazer, navigator, holographer) => freeze({ stargazer: T("reading", stargazer), navigator: T("reading", navigator), holographer: T("reading", holographer || navigator) });

/**
 * STATIONS: the seven stations, in order. Each is
 *   { key, n, title, stargazerTitle, stargazer (shown at the Stargazer lens), sky (shown for a sky lexicon),
 *     say: { stargazer, navigator, holographer } (each a list of { layer, text }),
 *     skySay (the same for a sky lexicon, or null), notes: [{ stargazer, navigator, holographer }] (each { layer, text }),
 *     skyNotes (the notes for a sky lexicon, where a note of the built-in lexicon would not be true of a sky; else absent),
 *     bridge: { opening (first box only, per lens) | null, reading: per lens { layer, text }, stands: [{ layer, text, stargazer, source, name, link }] } }
 * Use stationView() to get one station resolved for a lens and a lexicon.
 */
export const STATIONS = freeze([
  freeze({
    key: "read", n: 1, title: "Read", stargazerTitle: "Read", stargazer: true, sky: false,
    say: perLens(
      [T("reading", FIRST_LINE)],
      [T("said", "The book says where its writer stood and on what day: by the river of Chebar, in the fourth month, in the fifth day of the month."),
        T("reading", "Each lit phrase is an entry of this lexicon. Choose one: the tree slides to it, and the Entry lists what is written, said and checked about it.")],
      [T("checked", "Counted: " + numberWord(F.verses) + " verse rows with " + F.terms + " term rows under them, each one LEX/1 line: address|layer|kind|name|text."),
        T("checked", "Tested: the name of every term stands letter for letter in its verse. Its children are its facets, plain rows first.")]),
    skySay: null, notes: freeze([]),
    next: freeze({ label: "Next: count the fours", station: "count", word: "four" }),
    bridge: freeze({
      opening: BRIDGE_OPENING,
      reading: reading(
        "We begin where the book begins: with a place and a day. You may see it another way.",
        "We read the opening of the book as a fix: a place and a day, given before anything is seen. You may see it another way.",
        "We read the opening of the book as coordinates, and file every phrase of it at an address of its own. You may see it another way."),
      stands: freeze([
        written("26.1.1", "as I was", "Chebar"),
        stand("said", "Pierre van Paassen writes in Why Jesus Died (1949): \"Jesus was a latter-day prophet\".", "A writer, Pierre van Paassen, wrote in 1949: \"Jesus was a latter-day prophet\"."),
        stand("said", rowSentence("0.4.1", 0, "This project's search of two scans of the 1949 book found the name Ezekiel once, in the title of a book in a reading list; the running text never mentions him."),
          "This project searched his book. It found the name Ezekiel once, in a list of books.", "0.4.1"),
        stand("checked", "Counted: " + numberWord(F.verses) + " verses and " + F.terms + " lit phrases. Count with me."),
      ]),
    }),
  }),
  freeze({
    key: "count", n: 2, title: "Count", stargazerTitle: "Count", stargazer: true, sky: false,
    say: perLens(
      [T("checked", "Counted: the word four appears " + numberWord(countOf("four")) + " times in these nine verses. Count with me.")],
      [T("checked", "Counted now from the nine King James verse rows: " + COUNT_LIST + ". The table gives the verses and what each one numbers.")],
      [T("checked", "countWord(text, word) counts whole-word matches, case-insensitive, after NFC, over rows 26.1.1 to 26.1.9: " + COUNTS.map((c) => c.word + " " + c.times).join(", ") + ".")]),
    skySay: null, notes: freeze([]),
    bridge: freeze({
      opening: null,
      reading: reading(
        "The author's notes count threes and fours. We count the book's own number words first. You may see it another way.",
        "We count before we read. A count can be repeated; what a number means is a reading, ours or anyone's. You may see it another way.",
        "We keep a count and a meaning in different layers: the count is CHECKED, and any meaning given to 3, 4 or 16 is READING. You may see it another way."),
      stands: freeze([
        written("26.1.5", "came the likeness", "living creatures"),
        stand("said", "A Christian reading of a Jewish prophet's book: Irenaeus of Lyon, usually dated to about AD 180, writes: \"the living creatures are quadriform, and the Gospel is quadriform\". This is his view, in his time.",
          "A Christian writer of long ago, Irenaeus, set the four creatures beside the four Gospels. That is his reading of a Jewish prophet's book."),
        stand("checked", "Counted: the word four stands " + timesWord(countOf("four")) + " in these nine verses, and the word sixteen " + timesWord(F.sixteen) + ". Count with me.",
          "Counted: four stands " + timesWord(countOf("four")) + " in these nine verses. Sixteen stands in them " + timesWord(F.sixteen) + ". Count with me."),
      ]),
    }),
  }),
  freeze({
    key: "place", n: 3, title: "Place", stargazerTitle: "Place", stargazer: false, sky: true,
    say: perLens(
      [T("checked", "Read from the rows: John 3:16 is kept at 43.3.16. That is book 43, chapter 3, verse 16.")],
      [T("checked", "Read from the rows: every verse has an address that is its citation. 43.3.16 is John 3:16: book 43, chapter 3, verse 16."),
        T("reading", "Pick two entries and fly from one to the other. The page reports two numbers: steps along the tree, and straight distance in the chart.")],
      [T("checked", "Computed: each entry owns a cell; a child sits exactly r(parent) + r(child) from its parent, and no two cells overlap. Steps along the tree count edges; straight distance in the chart is acosh of the last entry of the relative frame.")]),
    skySay: perLens(
      [T("reading", "Every entry of this sky has a place on the map. Tap one and the map slides to it.")],
      [T("reading", "Every entry of this sky has an address in a tree. Pick two and fly from one to the other: the page reports steps along the tree and straight distance in the chart.")],
      [T("checked", "Computed: each entry owns a cell; a child sits exactly r(parent) + r(child) from its parent, and no two cells overlap.")]),
    notes: freeze([freeze({ stargazer: T("reading", "Every piece has a cell of its own. So the pieces under the middle one sit near the edge."), navigator: TREE_PRICE, holographer: TREE_PRICE })]),
    bridge: freeze({
      opening: null,
      reading: reading(
        "We read John 3:16 as the bridge, in the Gospel's own words. It is love from its source to the world. You may see it another way.",
        "We read John 3:16 as the bridge stated in the Gospel's own words: love from its source to the world. You may see it another way.",
        "We read John 3:16 as the bridge stated in the Gospel's own words: love from its source to the world. Its address, 43.3.16, is a filing convention and carries no meaning. You may see it another way."),
      stands: freeze([
        written("43.3.16"),
        written("43.3.13", "he that came down", "heaven"),
        // both sentences of row 100.3.6, so that the gold box and the row cannot drift: he is not quoting John 3:16
        stand("said", rowSentence("100.3.6", 0, "Pierre van Paassen (1949) writes of the world that \"God so loved it and still loves it\".") + " "
          + rowSentence("100.3.6", 1, "He writes as a Unitarian: elsewhere he says the teaching that God took on human form is a Greek idea that does not stem from Jesus."),
          "Pierre van Paassen wrote in 1949 that \"God so loved it and still loves it\". He also says the teaching that God became a man is a Greek idea.", "100.3.6"),
        stand("checked", "Read from the rows: 43.3.16 is John 3:16: book 43, chapter 3, verse 16. Open it and compare."),
      ]),
    }),
  }),
  freeze({
    key: "layers", n: 4, title: "Layers", stargazerTitle: "Kinds of sentence", stargazer: true, sky: true,
    say: perLens(
      [T("reading", "Every sentence here wears a badge. The badge says what kind of sentence it is."),
        T("checked", "Counted: this lexicon has " + F.entries + " pieces of four kinds. Tap a badge to light its kind.")],
      [T("checked", "Counted: of the " + F.entries + " entries, " + LAYER_LIST.replace(" TEXT", " are TEXT") + ". Mark the tree by layer, or filter it with the four buttons.")],
      [T("checked", "The layer is the second field of every LEX/1 line, so it is in the line's hash and in the lexicon root. Counted: " + LAYER_LIST + ".")]),
    skySay: perLens(
      [T("reading", "Every sentence here wears a badge. The badge says what kind of sentence it is.")],
      [T("reading", "Every entry of this sky carries one of four layers. Mark the tree by layer, or filter it with the four buttons.")],
      [T("checked", "The layer is the second field of every LEX/1 line, so it is in the line's hash and in the lexicon root.")]),
    notes: freeze([freeze({
      stargazer: T("checked", "The badge is stamped together with the words. Change a badge and the stamp no longer fits. The stamp cannot tell whether a badge is right."),
      navigator: T("checked", "The label is part of the sealed line: change it and the seal no longer fits. The seal does not judge the label."),
      holographer: T("checked", "The label is part of the sealed line: change it and the seal no longer fits. The seal does not judge the label."),
    })]),
    bridge: freeze({
      opening: null,
      reading: reading(
        "We keep four kinds of sentence apart. Then you can tell a quote from a count from an idea of ours.",
        "We keep four kinds of statement apart, so that a quotation, a report, a count and an idea of ours are never taken for one another. You may see it another way.",
        "We keep four kinds of statement apart. Which layer a row belongs to is this project's judgement; the seal carries the label and does not judge it. You may see it another way."),
      stands: freeze([
        stand("said", rowSentence("0.2", 0, "King James Version, from the Project Gutenberg e-text (public domain in the United States and in most countries)."),
          "The Bible words kept here are the King James Version, from the Project Gutenberg e-text.", "0.2"),
        stand("checked", "Counted: " + F.entries + " entries: " + LAYER_LIST + ". Count the badges.",
          "Counted: " + F.layers.text + " WRITTEN, " + F.layers.said + " SAID, " + F.layers.checked + " CHECKED and " + F.layers.reading + " OUR IDEA. Count the badges."),
      ]),
    }),
  }),
  freeze({
    key: "seal", n: 5, title: "Seal", stargazerTitle: "Stamp it", stargazer: true, sky: true,
    say: perLens(
      [T("checked", "A seal is a stamp on the exact writing. Change one letter and the stamp no longer fits, and anyone can see that. It does not say the writing is true, and it does not say who made it.")],
      [T("checked", "Sealing grows the chain one epoch for each top-level entry, " + F.epochs + " in all, repeats every check and signs one line with a key made for this visit. A pass means: unchanged since it was sealed."),
        T("reading", "Then try the tampers. Each button changes the sealed package in one way and shows which check refuses it.")],
      [T("checked", "buildLexiconBundle grows an shdccp/2 chain, one epoch per top-level entry (" + F.epochs + " here); issueCertificate signs the OVERWATCH/1 line over chain id, Merkle root, epoch, lexicon root, 2D+3D, ledger head and scope with ECDSA P-256. The tampers are refused at "
        + listWords(F.refusals) + "; the resealed one is accepted.")]),
    skySay: perLens(
      [T("checked", "A seal is a stamp on the exact writing. Change one letter and the stamp no longer fits, and anyone can see that. It does not say the writing is true, and it does not say who made it.")],
      [T("checked", "Sealing grows the chain one epoch for each top-level entry, repeats every check and signs one line with a key made for this visit. A pass means: unchanged since it was sealed.")],
      [T("checked", "buildLexiconBundle grows an shdccp/2 chain, one epoch per top-level entry; issueCertificate signs the OVERWATCH/1 line with ECDSA P-256. The same three numbers always give the same chain name.")]),
    notes: freeze([freeze({
      stargazer: T("checked", "The parts are stamped in number order. The author's notes come last because 100 is the biggest number."),
      navigator: T("checked", "Epochs follow address order. The author's notes are sealed last because 100 is the largest index, not because they continue the Bible."),
      holographer: T("checked", "Epochs follow address order. The author's notes are sealed last because 100 is the largest index, not because they continue the Bible."),
    })]),
    // a sky has no entry 100 and no author's notes: only the first half is true of it
    skyNotes: freeze([freeze({
      stargazer: T("checked", "The parts are stamped in number order."),
      navigator: T("checked", "Epochs follow address order."),
      holographer: T("checked", "Epochs follow address order."),
    })]),
    bridge: freeze({
      opening: null,
      reading: reading(
        "The author wrote of the whole truth. We show what a stamp can promise: this exact writing, not whether it is true. You may see it another way.",
        "The author's line 7 speaks of the whole truth and nothing but the truth. We answer with what a seal can swear to: these bytes, not their truth. You may see it another way.",
        "The author's line 7 speaks of the whole truth and nothing but the truth. We answer with what a seal can swear to: these bytes, not their truth. A key made for one visit shows integrity, not identity. You may see it another way."),
      stands: freeze([
        written("14.18.15", "that thou say", "the truth"),
        stand("said", "John Wilkinson's book for coroners (1618) prints an oath for witnesses with the words \"the truth, the whole trueth, and nothing but the trueth\" (spelling as printed).",
          "A law book of 1618 has an oath for witnesses. Its words are \"the truth, the whole trueth, and nothing but the trueth\", in old spelling."),
        stand("checked", "Tested: a changed word is refused, a missing entry is refused, an added entry is refused. What is sworn here is about bytes. Try the three tampers.",
          "Tested: change a word, drop an entry or add one. Each time the stamp no longer fits."),
      ]),
    }),
  }),
  freeze({
    key: "send", n: 6, title: "Send", stargazerTitle: "Send", stargazer: false, sky: true,
    say: perLens(
      [T("checked", "Send the stamped parcel to four pretend receivers inside this page. Each one checks the stamp for itself.")],
      [T("checked", "The package goes to the four crossroads receivers of First Explorers: " + listWords(CROSSROADS.map((c) => c.city)) + ". Each verifies everything itself and signs a HANDSHAKE/1 answer with its own key. All four run inside this page.")],
      [T("checked", "witnessQuorum counts an answer only if its signature verifies, it echoes the SHA-256 of the wire that was sent, it accepts, its key is one of the four made here and not the sealer's, and it was not counted before.")]),
    skySay: null, notes: freeze([freeze({ stargazer: SEND_READING, navigator: SEND_READING, holographer: SEND_READING })]),
    verse: written("5.19.15"),
    bridge: freeze({
      opening: null,
      reading: reading(
        "We send the parcel down the four roads of First Explorers. Four is how many roads that map has. You may see it another way.",
        "We send the lexicon down the four roads of First Explorers. One seal is one witness, and four receivers inside one page show how the rule is checked: they are not testimony. You may see it another way."),
      stands: freeze([
        written("5.19.15", "at the mouth of two", "established"),
        stand("said", "A Christian reading: Irenaeus of Lyon, usually dated to about AD 180, argues that the Gospels are four \"since there are four zones of the world in which we live, and four principal winds\". This is his view, in his time.",
          "Irenaeus, a Christian writer of long ago, wrote of four zones of the world. That is his view, in his time."),
        stand("checked", KEBAR_NAZARETH.text + " Nazareth is the zero point of First Explorers. That map's four roads run at " + listWords(F.roads.map((b) => b + "°")) + ": none runs east.",
          "Worked out: the Kebar site and Nazareth are about equally far north. From Nazareth the site lies roughly east, about " + F.kebar.kmRounded + " km away. None of the four roads runs east.",
          null, freeze({ label: "Open the sky page", what: "home" })),
      ]),
    }),
  }),
  freeze({
    key: "fourth", n: 7, title: "The fourth square", stargazerTitle: "The fourth square", stargazer: false, sky: false,
    say: perLens(
      [T("checked", rowSentence("100.6.2", 0, "Worked out: three points on the rim settle where every other point goes."))],
      [T("reading", "This station runs the author's line 6 in the author's order: three squares, then the fourth."),
        T("checked", "Each figure is computed here: three squared distances and an area, a word filled by mirrors, three quarter parities, the squares 1, 4, 9 and 16, and a corner on flat paper and on the curved map.")],
      [T("checked", "A = (Q1 + Q2 + Q3)² − 2(Q1² + Q2² + Q3²) = 16 · area², exact in BigInt; seedMirror fills 64 bits from 4; quarterParities gives p0 ^ p1 ^ p2 = p3 in a valid packet; 3 · 9 − 3 · 4 + 1 = " + squareNumbersNext(1, 4, 9) + ".")]),
    skySay: null, notes: freeze([]),
    bridge: freeze({
      opening: null,
      reading: reading(
        "The author sees three squares pointing to a fourth. We show places where three really do fix a fourth. You may see it another way.",
        "The author sees three squares certifying a fourth. We show where three do fix a fourth, and what a certificate on this page covers. You may see it another way."),
      stands: freeze([
        written("43.1.14", "the Word was made", "among us"),
        stand("said", "SHD-CCP RFC 02, section 3 (normative), in this project's own specification, says: \"The points are collinear iff A = 0.\"",
          "This project's rule book has a sum that is zero when three points line up."),
        stand("checked", "Computed: for sides 3, 4 and 5 the squares are " + listWords(F.sides.squares.slice().sort((a, b) => a - b).map(String)) + ", and A = " + F.sides.A + " = 16 × " + trim(F.sides.area) + "². Try three points of your own.",
          "Worked out: a triangle with sides 3, 4 and 5 has area " + trim(F.sides.area) + ". Three squares give it."),
      ]),
    }),
  }),
]);
const STATION_BY_KEY = new Map(STATIONS.map((s) => [s.key, s]));

/** FOURTH_PARTS: the five figures of station 7 in the author's order, each with its title and one CHECKED sentence; then the verse and the certificate wording. */
export const FOURTH_PARTS = freeze([
  freeze({ key: "a", title: "Three squared distances", say: T("checked", "Computed: three squared distances give sixteen times the squared area of their triangle, and zero exactly when the three points are in line. Move the three points.") }),
  freeze({ key: "b", title: "The mirror word", say: T("checked", "Built: four lights in one corner fill all 64 by mirrors. Hide the fourth corner square and the other three give it back.") }),
  freeze({ key: "c", title: "Three quarters and the fourth", say: T("checked", "Tested: in every valid packet the parities of three quarters fix the parity of the fourth. Choose a packet.") }),
  freeze({ key: "d", title: "1, 4, 9, then 16", say: T("checked", squaresFigure().sentence + " Work it out.") }),
  freeze({ key: "e", title: "A corner, flat and curved", say: T("checked", "Computed: " + cornersFigure().flat.sentence + " " + cornersFigure().curved.sentence) }),
]);
/** FOURTH_VERSE: John 1:14 as TEXT, shown after the five figures. */
export const FOURTH_VERSE = written("43.1.14");

/** TABS: the five tabs of the right column. */
export const TABS = freeze([
  freeze({ key: "entry", label: "Entry" }), freeze({ key: "wheel", label: "Wheel" }), freeze({ key: "chain", label: "Chain" }),
  freeze({ key: "overwatch", label: "Overwatch" }), freeze({ key: "witnesses", label: "Witnesses" }),
]);
/** visibleStations(lens, origin) -> the stations shown: four at Stargazer; Place, Layers, Seal and Send for a sky; none for a lexicon from outside. */
export function visibleStations(lens, origin = "builtin") {
  if (origin === "outside") return [];
  const star = lensOf(lens) === "stargazer";
  return STATIONS.filter((s) => (!star || s.stargazer) && (origin !== "page" || s.sky));
}
/** visibleTabs(lens, { origin, sealed, sent }) -> the tabs shown: Entry alone at Stargazer; a tab appears once it has something in it. */
export function visibleTabs(lens, has = {}) {
  if (has.origin === "outside") return TABS.filter((t) => t.key === "entry" || t.key === "overwatch");
  if (lensOf(lens) === "stargazer") return TABS.filter((t) => t.key === "entry");
  return TABS.filter((t) => t.key === "entry" || t.key === "wheel" || ((t.key === "chain" || t.key === "overwatch") && has.sealed) || (t.key === "witnesses" && has.sent));
}
/** BRIDGE_GO: the button of the opening gold box that leads to where the gold boxes end. */
export const BRIDGE_GO = freeze({ address: HANDLES.john316, label: "Go to John 3:16" });
/** BRIDGE_FLY: the button of the John 3:16 box that walks the tree from the river entry to the verse. */
export const BRIDGE_FLY = freeze({ from: HANDLES.place, to: HANDLES.john316, label: "Fly here from the river" });
/** FIRST_EXPLORERS_LINK: the label of the link in the opening gold box. */
export const FIRST_EXPLORERS_LINK = "Open First Explorers";
// One station's gold box, resolved for a lens. The opening box (station 1) carries the button to John 3:16 and the link to First Explorers.
function bridgeOf(s, l) {
  const opening = s.bridge.opening ? s.bridge.opening[l] : null;
  return {
    title: BRIDGE_TITLE, opening, reading: s.bridge.reading[l],
    stands: s.bridge.stands.filter((x) => x.text !== "").map((x) => ({
      layer: x.layer, text: l === "stargazer" && x.stargazer ? x.stargazer : x.text, source: x.source || null, name: x.name || null,
      link: x.link ? { label: x.link.label, href: skyPageHref(x.link.what, l) } : null,
    })),
    go: opening ? BRIDGE_GO : null, links: opening ? [{ label: FIRST_EXPLORERS_LINK, href: firstExplorersHref() }] : [], fly: null, john: false,
  };
}
/** bridgeView(key, lens, lexicon, selected) -> the gold box to show: the station's own (stationView(...).bridge), except that while John 3:16
 *  is the chosen entry of the built-in lexicon the box is the John 3:16 box at every lens and station (the Place station's box, which the
 *  Stargazer lens has no station for), with the button BRIDGE_FLY. null where there is no gold box (a sky, a lexicon from outside).
 *  { title, opening, reading, stands: [{ layer, text, source, name, link: { label, href } | null }], go: { address, label } | null,
 *    links: [{ label, href }], fly: { from, to, label } | null, john } */
export function bridgeView(key, lens, lexicon = EZEKIEL, selected = null) {
  const l = lensOf(lens);
  if (lexicon.origin !== "builtin") return null;
  if (selected === HANDLES.john316 && lexicon.byAddress.has(selected)) return { ...bridgeOf(STATION_BY_KEY.get("place"), l), opening: null, go: null, links: [], fly: BRIDGE_FLY, john: true };
  const view = stationView(key, l, lexicon);
  return view ? view.bridge : null;
}
/** stationView(key, lens, lexicon) -> one station resolved: { key, n, title, say: [{ layer, text }], notes: [{ layer, text }],
 *  bridge: null | { title, opening, reading, stands: [{ layer, text, source, name, link }], go, links, fly, john }, next, verse }; null when this lens
 *  or lexicon does not show it. The bridge box belongs to the built-in lexicon only. */
export function stationView(key, lens, lexicon = EZEKIEL) {
  const s = STATION_BY_KEY.get(key), l = lensOf(lens), origin = lexicon.origin;
  if (!s || !visibleStations(l, origin).includes(s)) return null;
  const say = origin === "page" && s.skySay ? s.skySay[l] : s.say[l];
  const bridge = origin !== "builtin" ? null : bridgeOf(s, l);
  return {
    key: s.key, n: s.n, title: l === "stargazer" ? s.stargazerTitle : s.title, say: say.slice(), notes: (origin === "page" && s.skyNotes ? s.skyNotes : s.notes).map((n) => n[l]),
    bridge, next: origin === "builtin" && s.next ? s.next : null, verse: origin === "builtin" && s.verse ? s.verse : null,
  };
}

const two = (stargazer, other) => freeze({ stargazer, other: other || stargazer });
/** UI: the labels of the page's controls, each with its Stargazer form: { key: { stargazer, other } }. Read one with uiLabel(key, lens). */
export const UI = freeze({
  reader: two("The passage", "Ezekiel 1:1-9"),
  list: two("Things near the middle", "Entries around the centre"),
  home: two("Home"), up: two("Up"), prev: two("The one before", "Previous sibling"), next: two("The next one", "Next sibling"),
  nudgeLeft: two("Slide the map left"), nudgeRight: two("Slide the map right"), nudgeUp: two("Slide the map up"), nudgeDown: two("Slide the map down"),
  turnLeft: two("Turn the ball left"), turnRight: two("Turn the ball right"), turnUp: two("Turn the ball up"), turnDown: two("Turn the ball down"),
  flat: two("Flat map", "2D"), ball: two("Ball", "3D"),
  marks: two("Show the kinds on the map", "Mark the tree by layer"), filter: two("Show these kinds", "Filter by layer"),
  seal: two("Stamp it", "Seal this lexicon"), sealing: two("Stamping", "Sealing"), download: two("Save the parcel as a file", "Download the package"),
  send: two("Send the parcel", "Send the package"), noise: two("Add noise on one road", "Add noise on the road to Athens and Rome"),
  from: two("From", "From entry"), to: two("To", "To entry"), fly: two("Fly there", "Fly along the path"),
  packet: two("Which piece of text", "Packet"), flip: two("Flip this light"), reset: two("Put the lights back", "Reset the word"),
  hide: two("Hide the fourth corner"), show: two("Show the fourth corner"), wrong: two("Flip one light in the fourth corner"),
  copyLink: two("Copy a link to this", "Copy a link to this entry"), ezekiel: two("Back to Ezekiel", "Back to the Ezekiel lexicon"),
  about: two("What is real here?"), close: two("Close"),
  chooseEntry: two("Choose a thing on the map or in the list", "Choose an entry on the map or in the list"), packetEntry: two("Of the chosen thing", "Of the chosen entry"),
  aboutChosen: two("About the chosen thing", "About the chosen entry"),      // the name of the section that holds the tabs and the Entry
  treeLabel: two("The things of this lexicon as a tree on a curved map", TREE_LABEL),      // the accessible name of the tree canvas
  more: two("more"), strixAll: two("What STRIX says here"), skipList: two("Skip to the list of things", "Skip to the list of entries"), aboutWords: two("About these words"),
  skyPage: two("Open the Celestial Control Panel"), skyPageShort: two("Sky page"), goLine6: two("Go to Line 6"),
  point: two("Point"), movePoint: two("Move the chosen point"),
});
/** uiLabel(key, lens) -> the label of a control at that lens ("" for an unknown key). */
export const uiLabel = (key, lens) => (Object.hasOwn(UI, key) ? (lensOf(lens) === "stargazer" ? UI[key].stargazer : UI[key].other) : "");
/** SKY_BANNER: the banner over a sky that was built from a #sky= link. Such a link may come from anyone, so the banner does not say who
 *  stamped it; the stamp and its name are never in a link, and the same three numbers always give the same chain name. */
export const SKY_BANNER = "This sky was built from a link: a place and a time. Stamp it here. The same place and time always get the same name.";
const LEVELS_FIRST = "The Navigator level shows more: the chain, the Overwatch checks and four receivers.";
/** MORE_LEVELS: the line the Stargazer lens shows about what the next level adds, with its button (the lens hides stations and tabs and says so here).
 *  sky is the line for a sky: the first sentence alone, since a sky has no path to John 3:16 and no fourth square. Read it with moreLevelsFor(). */
export const MORE_LEVELS = freeze({
  text: LEVELS_FIRST + " It also shows the path to John 3:16 and the fourth square.",
  sky: LEVELS_FIRST,
  label: "Switch to Navigator", lens: "navigator",
});
/** moreLevelsFor(lens, origin) -> null, or { text, label, lens }: the line and its button as the Stargazer lens shows them for a lexicon of that
 *  origin: MORE_LEVELS.text for the built-in lexicon, MORE_LEVELS.sky for a sky ("page"); null at the other lenses and for a lexicon from outside. */
export function moreLevelsFor(lens, origin = "builtin") {
  if (lensOf(lens) !== "stargazer" || (origin !== "builtin" && origin !== "page")) return null;
  return { text: origin === "page" ? MORE_LEVELS.sky : MORE_LEVELS.text, label: MORE_LEVELS.label, lens: MORE_LEVELS.lens };
}
/** SKY_PRIVACY: shown beside the download and the link of a sealed sky. */
export const SKY_PRIVACY = "This link and this file contain the place and the time that were entered.";

// ─── 16. the dialog "What is real here?" ─────────────────────────────────────

const LEGEND = LAYER_META.map((m) => freeze({ layer: m.id, text: m.legend }));
/** DIALOG: the dialog as data: { title, first, inShort: [{ layer, text }], sections: [{ heading, items: [{ layer, text }] }],
 *  pagesHeading, pages: [{ key, label, href }] (the other pages of the wing) }. */
export const DIALOG = freeze({
  title: "What is real here?",
  first: T("reading", "This page sets Bible verses beside sky calculations because its author asked for that. The numbers do not depend on the verses, and the verses are not offered as science."),
  inShort: freeze([
    T("reading", "This page shows nine Bible verses and what people have said about their words."),
    T("checked", "It counts things, and shows you how to count them too."),
    T("reading", "It also shows ten notes its author wrote, and marks them as the author's."),
    T("checked", "A stamp shows that the writing has not changed. It cannot show that the writing is true."),
    T("reading", "The Bible words do not prove the numbers. The numbers do not prove the Bible words."),
    T("reading", "STRIX is the owl that speaks on this page."),
  ]),
  // the ways out of this page: the kit's LINKS, nothing else
  pagesHeading: "Other pages",
  pages: freeze([
    freeze({ key: "firstExplorers", label: "First Explorers", href: LINKS.firstExplorers }),
    freeze({ key: "celestialControlPanel", label: "Celestial Control Panel", href: LINKS.celestialControlPanel }),
    freeze({ key: "wingIndex", label: "Experimental Systems", href: LINKS.wingIndex }),
  ]),
  sections: freeze([
    freeze({ heading: "The four layers", items: freeze([...LEGEND, T("checked", BADGE_HELP)]) }),
    freeze({ heading: "The Bible words", items: freeze([
      T("said", rowSentence("0.2", 0, "King James Version, from the Project Gutenberg e-text (public domain in the United States and in most countries).") + " Every verse entry in the lexicon is in that wording."),
      T("reading", "Ezekiel 1:1-9 is also shown in the wording the author supplied (New International Version). That wording is shown beside the King James verses only; it is never sealed, downloaded or placed in a link."),
      T("said", SUPPLIED_NOTICE),
      T("reading", SUPPLIED_NOTE),
    ]) }),
    freeze({ heading: "Where the facts come from", items: freeze([
      T("reading", "The lexicon's facts come from named sources, and each entry names its own. A SAID entry says who says it; a CHECKED entry can be repeated here; a READING is this project's."),
    ]) }),
    freeze({ heading: "The book", items: freeze([
      T("reading", "The author calls this way of working \"the design protocol of Why Jesus Died\". The rules are this project's; the book does not contain them."),
      T("said", "Van Paassen writes \"As a Unitarian\" and argues his own reconstruction; the running text never mentions Ezekiel (the name occurs once, in a reading list); he treats visions as experiences of the mind and rejects reading the prophets as predictions fulfilled in the Gospels."),
      T("reading", "The links between Ezekiel and the Gospels shown here come from early Christian writers and from this project, not from him."),
    ]) }),
    freeze({ heading: "The bridge narrative (the gold boxes)", items: freeze([
      T("reading", "It is an interpretation, chosen by this project. The gold boxes read Jesus of Nazareth as a bridge between the source of love and the world, and follow that line from Ezekiel's river to John 3:16. No check, packet or certificate on this page depends on it."),
      T("reading", "The gold boxes quote several writers, each named where it is quoted. Where a box quotes Pierre van Paassen, Why Jesus Died (Dial Press, 1949), the words in quotation marks are his and were checked against a scan of the book."),
      T("said", "Van Paassen argues that Jesus was a Galilean Jew in the line of Israel's prophets who announced the Kingdom of God on earth: justice, and all people as kin; that Pontius Pilate alone ordered his death; that later tellings moved the blame onto the Jewish people; and that Greek-speaking missionaries, starting from Antioch, remade his message. He writes as a Unitarian and does not take the resurrection, the virgin birth or the Trinity as history."),
      T("reading", "This project's view: most Christians and many historians would disagree with parts of that. Some of his sources are dated, among them Robert Eisler's reconstruction of an armed rising and the old theory of a dying and rising god."),
      T("reading", "What is ours, not his. He never calls Jesus a bridge and never uses the cross as a figure of two directions. The line through the zero point, and the reading of it, are this project's."),
      T("said", rowSentence("0.4.1", 0, "This project's search of two scans of the 1949 book found the name Ezekiel once, in the title of a book in a reading list; the running text never mentions him.")),
    ]) }),
    freeze({ heading: "Ezekiel 1 in Jewish tradition", items: freeze([T("said", (entryOf(EZEKIEL, HANDLES.tradition) || { text: "" }).text)]) }),
    freeze({ heading: "What a certificate covers", items: CERTIFIED }),
    freeze({ heading: "Limits to keep in mind", items: freeze([
      T("checked", "The epochs are where the format cuts the text, one per top-level entry. They show that this chain is the one this text gives. They are not a record of when or in what order anything was written."),
      T("checked", "The ledger is what the sealer wrote down. Its links show it has not been edited since sealing, not that its times are true."),
      T("checked", "The words 2D+3D in the certificate mean that the same addresses are drawn both ways. The drawings are not signed."),
      T("checked", "The receivers are simulated in this page."),
      T("checked", "A key this page makes is made for this visit. A signature shows integrity, not identity."),
      T("reading", "LEX/1 and LEXICON/2 are drafts, not RFCs. The Hyperbolic Lexicon in Ebayednoob has its own address format and this is not it: an entry's rank among its siblings at each level converts to a Hyperbolic Lexicon word by its rule L3; the sparse citation address itself is not that path."),
    ]) }),
    freeze({ heading: "This page", items: freeze([
      T("reading", "The three reading levels are the same three levels First Explorers calls Stargazer, Explorer and Architect."),
      T("checked", "The only request to another host is for web fonts (Google Fonts); the page works without them."),
      T("checked", "Nothing is stored by this page, and a package enters it only as a file you choose."),
      T("reading", "Code: MIT. Quoted texts belong to their rights holders and are not covered by that licence."),
    ]) }),
  ]),
});

// ─── 17. every Stargazer string, for the all-ages test ───────────────────────

/** stargazerStrings() -> [{ where, text }]: every string of this module that a visitor at the Stargazer lens can read (TEXT quotations left out). */
export function stargazerStrings() {
  const out = [], add = (where, text) => { if (typeof text === "string" && text !== "") out.push({ where, text }); };
  for (const s of STATIONS) {
    add("station " + s.key + " title", s.stargazerTitle);
    s.say.stargazer.forEach((p, i) => add("station " + s.key + " say " + i, p.text));
    if (s.skySay) s.skySay.stargazer.forEach((p, i) => add("station " + s.key + " sky say " + i, p.text));
    s.notes.forEach((n, i) => add("station " + s.key + " note " + i, n.stargazer.text));
    if (s.skyNotes) s.skyNotes.forEach((n, i) => add("station " + s.key + " sky note " + i, n.stargazer.text));
    if (s.bridge.opening) add("station " + s.key + " bridge opening", s.bridge.opening.stargazer.text);
    add("station " + s.key + " bridge reading", s.bridge.reading.stargazer.text);
    s.bridge.stands.forEach((x, i) => { if (x.layer !== "text") add("station " + s.key + " stand " + i, x.stargazer || x.text); });
    if (s.next) add("station " + s.key + " next", s.next.label);
  }
  add("lens hint", LENS_HINTS.stargazer);
  add("first line", FIRST_LINE); add("entry prompt", ENTRY_PROMPT); add("more", MORE_LABEL); add("author label", AUTHOR_LABEL.stargazer);
  add("line 8 framing", LINE8_FRAMING_STARGAZER); add("count note", COUNT_NOTE); add("broken link", BROKEN_LINK);
  add("wheel caption", WHEEL_COPY.perLens.stargazer.text); add("wheel", WHEEL_COPY.stargazerWheel.text); add("wheel pick", WHEEL_COPY.pick);
  for (const [k, v] of Object.entries(TAMPER_COPY)) if (v.stargazer) add("tamper " + k, v.noticedStargazer);
  for (const r of tamperRows("stargazer")) add("tamper label " + r.key, r.label);
  add("pass", PASS_WORDING.stargazer); add("certified", CERTIFIED_STARGAZER.text); add("chain name", CHAIN_NAME_LABEL.stargazer);
  add("wordings note", WORDINGS_NOTE.text); add("tradition link", TRADITION_LINK);
  for (const [a, lead] of ENTRY_LEADS) add("lead " + a, lead.text);
  for (const e of EZEKIEL.entries) { const shown = displayName(EZEKIEL, e.address, "stargazer"); if (shown !== e.name) add("name " + e.address, shown); }
  add("tamper, not sealed", tamperSentence(null, "stargazer"));
  DIALOG.inShort.forEach((p, i) => add("in short " + i, p.text));
  for (const m of LAYER_META) add("legend " + m.id, m.legend);
  for (const w of Object.values(WORDINGS)) add("wording " + w.key, w.label);
  for (const g of ENTRY_GROUPS) add("group " + g.key, g.heading);
  for (const [k, v] of Object.entries(UI)) add("control " + k, v.stargazer);
  add("privacy", SKY_PRIVACY);
  add("status", statusFor(EZEKIEL, HANDLES.place, "stargazer")); add("status none", statusFor(EZEKIEL, null, "stargazer"));
  add("caption", treeCaption(EZEKIEL, treeScene(EZEKIEL, homeView(EZEKIEL), "2D"), "stargazer"));
  add("epoch line", epochLine({ epoch: 3, epochs: 14 }, "stargazer"));
  add("send, two", "Two receivers checked the stamp and agreed, so the parcel arrived unchanged. They are pretend receivers inside this page.");
  add("send, none", "Fewer than two receivers agreed. They are pretend receivers inside this page.");
  add("wheel readout", wheelView(EZEKIEL, { packet: 0, flips: [4] }, "stargazer").readout.map((r) => r.text).join(" "));
  add("wheel readout clean", wheelView(EZEKIEL, { packet: 0, flips: [] }, "stargazer").readout.map((r) => r.text).join(" "));
  add("subtitle", PAGE.stargazerSubtitle); add("notes invite", NOTES_INVITE.text); add("notes button", NOTES_INVITE.label); add("notes button, short", NOTES_INVITE.short);
  add("sky banner", SKY_BANNER); add("more levels", MORE_LEVELS.text); add("more levels, sky", MORE_LEVELS.sky); add("more levels button", MORE_LEVELS.label);
  add("mirror caption", MIRROR_STARGAZER.text); add("mirror box", MIRROR_BOX); add("list keys", LIST_KEYS.stargazer);
  add("bridge go", BRIDGE_GO.label); add("bridge fly", BRIDGE_FLY.label); add("first explorers link", FIRST_EXPLORERS_LINK);
  for (const a of [...POINTER_ADDRESSES, ...POINTER_LINES.keys()]) { const p = pointerOf(EZEKIEL, a, "stargazer"); if (p) { add("pointer " + a, p.label); p.entries.forEach((x) => add("pointer " + a + " entry", x.label)); } }
  for (const x of pointedFrom(EZEKIEL, HANDLES.john316)) add("pointed from " + x.address, x.label);
  for (const s of STATIONS) s.bridge.stands.forEach((x, i) => { if (x.link) add("station " + s.key + " stand link " + i, x.link.label); });
  for (const m of TQF_MOVES) add("move " + m.key, m.label);
  add("light name", lightName({ i: 56, field: "amp", on: true }, "stargazer"));
  for (const f of [{ hidden: true }, { hidden: false, wrongBit: 5, caught: true }, { hidden: false, wrongBit: 5, caught: false }, { hidden: false, wrongBit: null }]) add("mirror state", mirrorCaptionStargazer(f));
  return out;
}
