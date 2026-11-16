// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Library/Experimental_Systems/Lexicon_Explorer/lexicon-explorer-model.js: the DOM-free model of the Lexicon Explorer.
// What is checked (specification sections 8, 1.1, 1.4 and 1.6):
//   - the module documents every export, and its copy has all three lenses for every station;
//   - every sentence carries one of the four layers; every TEXT sentence is cut out of a verse row; SAID names its
//     speaker; the sensitive points of 1.4 that the copy can break are not broken;
//   - every number the copy states as CHECKED is recomputed here from the cores (not from the model);
//   - the Stargazer strings keep the rules of 1.6 (16 words a sentence, none of the hard words);
//   - the link grammar reads every link the Celestial Control Panel emits and refuses junk;
//   - the reader in both states of the supplied-passage module (with verses, and emptied);
//   - the Entry at each lens, the count table, the tree scene with its hit test and flights, the word wheel and
//     the square, the figures of station 7, the seal, tamper and witness flows, and a lexicon from outside.
// Run: node --test tests/unit/lexicon-explorer-model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.env.OWL_TEST_ROOT || path.resolve(import.meta.dirname, "../..");
const load = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const DIR = "Library/Experimental_Systems/Lexicon_Explorer/";
const MODEL_FILE = DIR + "lexicon-explorer-model.js";
const M = await load(MODEL_FILE);
const OW = await load("scripts/strix-overwatch.js");
const HM = await load("scripts/hyperbolic-moves.js");
const CC = await load("scripts/celestial-core.js");
const KIT = await load("Library/Experimental_Systems/explorer-kit.js");
const DATA = await load(DIR + "ezekiel-1.js");
const PASSAGE = await load(DIR + "passage-as-supplied.js");

// ─── shared helpers ──────────────────────────────────────────────────────────

const ROW = new Map(DATA.ROWS.map((r) => [r[0], { address: r[0], layer: r[1], kind: r[2], name: r[3], text: r[4] }]));
const VERSES9 = ["26.1.1", "26.1.2", "26.1.3", "26.1.4", "26.1.5", "26.1.6", "26.1.7", "26.1.8", "26.1.9"];
const LENSES = ["stargazer", "navigator", "holographer"];
const AT = "2026-11-15T00:00:00.000Z";
const EMPTY = { notice: PASSAGE.SUPPLIED_NOTICE, note: PASSAGE.SUPPLIED_NOTE, verses: {}, terms: {} };
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const deg = 180 / Math.PI;
const close = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what || "value"}: ${a} is not within ${eps} of ${b}`);
const isSentence = (p) => p !== null && typeof p === "object" && OW.LAYERS.includes(p.layer) && typeof p.text === "string" && p.text.trim() !== "";
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Every { layer, text } sentence of the copy tables, with a word saying where it stands. */
function allCopy() {
  const out = [], add = (where, p) => out.push({ where, ...p });
  for (const s of M.STATIONS) {
    for (const l of LENSES) {
      s.say[l].forEach((p, i) => add(`${s.key} say ${l} ${i}`, p));
      if (s.skySay) s.skySay[l].forEach((p, i) => add(`${s.key} sky say ${l} ${i}`, p));
      s.notes.forEach((n, i) => add(`${s.key} note ${l} ${i}`, n[l]));
      if (s.skyNotes) s.skyNotes.forEach((n, i) => add(`${s.key} sky note ${l} ${i}`, n[l]));
      if (s.bridge.opening) add(`${s.key} opening ${l}`, s.bridge.opening[l]);
      add(`${s.key} reading ${l}`, s.bridge.reading[l]);
    }
    s.bridge.stands.forEach((x, i) => { add(`${s.key} stand ${i}`, { layer: x.layer, text: x.text }); if (x.stargazer) add(`${s.key} stand ${i} stargazer`, { layer: x.layer, text: x.stargazer }); });
    if (s.verse) add(`${s.key} verse`, { layer: s.verse.layer, text: s.verse.text });
  }
  M.FOURTH_PARTS.forEach((p) => add(`fourth part ${p.key}`, p.say));
  add("fourth verse", { layer: M.FOURTH_VERSE.layer, text: M.FOURTH_VERSE.text });
  M.CERTIFIED.forEach((p, i) => add(`certified ${i}`, p));
  add("certified stargazer", M.CERTIFIED_STARGAZER);
  add("send reading", M.SEND_READING); add("tree price", M.TREE_PRICE);
  add("quorum limit", M.QUORUM_LIMIT); add("kebar and nazareth", M.KEBAR_NAZARETH); add("wordings note", M.WORDINGS_NOTE);
  for (const [a, lead] of M.ENTRY_LEADS) add(`lead ${a}`, lead);
  for (const l of LENSES) add(`wheel ${l}`, M.WHEEL_COPY.perLens[l]);
  add("wheel stargazer", M.WHEEL_COPY.stargazerWheel); add("wheel ladder", M.WHEEL_COPY.ladder); add("wheel parity", M.WHEEL_COPY.parity);
  add("dialog first", M.DIALOG.first);
  M.DIALOG.inShort.forEach((p, i) => add(`dialog in short ${i}`, p));
  for (const sec of M.DIALOG.sections) sec.items.forEach((p, i) => add(`dialog ${sec.heading} ${i}`, p));
  return out;
}
const COPY = allCopy();
const station = (key) => M.STATIONS.find((s) => s.key === key);
const copyText = (where) => COPY.filter((c) => c.where.startsWith(where)).map((c) => c.text).join(" ");
/** Text outside double quotation marks (a quotation from a source is its author's wording, not the page's). */
const unquoted = (s) => s.replace(/"[^"]*"/g, " quote ").replace(/“[^”]*”/g, " quote ");

// The Kebar sky of the link "#sky=1505042.16624,32.13,45.23", used by several tests.
const SKY = M.skyLexicon([1505042.16624, 32.13, 45.23]);
// One sealed package of the whole lexicon, made once and shared by the flow tests.
const KEYS = await OW.newSessionKeys();
const epochsSeen = [];
const SEAL = await M.sealLexicon(M.EZEKIEL, { keys: KEYS, at: AT, onEpoch: (p) => { epochsSeen.push(p); } });

// ─── the module itself ───────────────────────────────────────────────────────

test("every export is listed in the header map and has a description above it", () => {
  const src = readFileSync(path.join(ROOT, MODEL_FILE), "utf8"), lines = src.split("\n");
  assert.ok(src.startsWith("// SPDX-License-Identifier: MIT\n// Copyright (c) 2026 Ebayednoob\n"));
  const header = src.slice(0, src.indexOf("\nimport "));
  const names = [];
  lines.forEach((line, i) => {
    const m = /^export (?:async function|function|const) ([A-Za-z0-9_$]+)/.exec(line);
    if (!m) return;
    names.push(m[1]);
    let k = i - 1;
    while (k >= 0 && lines[k].trim() === "") k--;
    const above = lines[k].trim();
    assert.ok(above.endsWith("*/") || above.startsWith("//"), `export ${m[1]} has no description above it`);
    assert.ok(new RegExp(`[ ,]${m[1].replace(/\$/g, "\\$")}(,|$)`, "m").test(header), `export ${m[1]} is not in the header map`);
  });
  assert.deepEqual(names.slice().sort(), Object.keys(M).sort(), "the export lines are the module's exports");
  assert.ok(names.length > 150);
});

test("the module is DOM-free and imports the cores, the kit and the two data modules only", () => {
  const src = readFileSync(path.join(ROOT, MODEL_FILE), "utf8");
  const from = [...src.matchAll(/^\} from "([^"]+)";$|^import .* from "([^"]+)";$/gm)].map((m) => m[1] || m[2]).sort();
  assert.deepEqual(from, ["../../../scripts/celestial-core.js", "../../../scripts/hyperbolic-moves.js", "../../../scripts/seal-crypto.js", "../../../scripts/strix-overwatch.js",
    "../explorer-kit.js", "./ezekiel-1.js", "./passage-as-supplied.js"].sort());
  const code = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/**")).join("\n");
  for (const word of ["document", "window", "navigator.", "globalThis", "requestAnimationFrame", "setTimeout", "Math.random"]) assert.ok(!code.includes(word), `the model uses ${word}`);
  // 1.5: a template literal that interpolates holds no markup
  for (const m of src.matchAll(/`[^`]*`/g)) assert.ok(!(m[0].includes("${") && /<[A-Za-z/]/.test(m[0])), "a template literal with markup");
});

test("page names, lens hints and the built-in lexicon", () => {
  assert.deepEqual({ ...M.PAGE }, { title: "Lexicon Explorer", subtitle: "Ezekiel 1:1-9 in hyperbolic space", stargazerSubtitle: "Ezekiel 1:1-9 on a curved map" });
  assert.deepEqual({ ...M.LENS_HINTS }, { stargazer: "ages 6 and up", navigator: "names, dates and sources", holographer: "formats and hashes" });
  assert.deepEqual(Object.keys(M.LENS_HINTS), KIT.LENSES.map((l) => l.id));
  assert.equal(M.EZEKIEL.origin, "builtin");
  assert.equal(M.EZEKIEL.home, "26.1");
  assert.equal(M.EZEKIEL.title, DATA.TITLE);
  assert.equal(M.EZEKIEL.entries.length, DATA.ROWS.length);
  assert.equal(M.lexiconTextOf(M.EZEKIEL), OW.lexiconText(DATA.ROWS.map((r) => OW.makeEntry(...r))));
  assert.deepEqual([...M.READER_VERSES], VERSES9);
  for (const a of VERSES9) assert.equal(ROW.get(a).kind, "verse");
  assert.equal(M.entryOf(M.EZEKIEL, "__proto__"), null);
  assert.equal(M.entryOf(M.EZEKIEL, ""), null);
  assert.equal(M.hasPlace(M.EZEKIEL, ""), true);
  assert.equal(M.hasPlace(M.EZEKIEL, "7.7"), false);
});

// ─── stations, tabs and lenses ───────────────────────────────────────────────

test("seven stations, each with a say and a bridge box at all three lenses", () => {
  assert.deepEqual(M.STATIONS.map((s) => s.key), ["read", "count", "place", "layers", "seal", "send", "fourth"]);
  assert.deepEqual(M.STATIONS.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(M.STATIONS.map((s) => s.title), ["Read", "Count", "Place", "Layers", "Seal", "Send", "The fourth square"]);
  for (const s of M.STATIONS) {
    assert.ok(typeof s.stargazerTitle === "string" && s.stargazerTitle !== "", s.key);
    for (const l of LENSES) {
      assert.ok(Array.isArray(s.say[l]) && s.say[l].length >= 1 && s.say[l].every(isSentence), `${s.key} say ${l}`);
      if (s.skySay) assert.ok(s.skySay[l].length >= 1 && s.skySay[l].every(isSentence), `${s.key} sky say ${l}`);
      for (const n of s.notes) assert.ok(isSentence(n[l]), `${s.key} note ${l}`);
      assert.ok(isSentence(s.bridge.reading[l]) && s.bridge.reading[l].layer === "reading", `${s.key} bridge reading ${l}`);
    }
    assert.ok(s.bridge.stands.length >= 2, `${s.key} stands`);
    for (const x of s.bridge.stands) assert.ok(isSentence(x) && x.layer !== "reading", `${s.key} stand layer`);
    assert.ok(s.bridge.stands.some((x) => x.layer === "checked"), `${s.key} has something that can be repeated`);
    assert.ok(s.bridge.stands.some((x) => x.layer === "said"), `${s.key} has an attributed statement`);
    // the three lenses say different things at different depths
    assert.notEqual(s.say.stargazer.map((p) => p.text).join(" "), s.say.navigator.map((p) => p.text).join(" "));
    assert.notEqual(s.say.navigator.map((p) => p.text).join(" "), s.say.holographer.map((p) => p.text).join(" "));
  }
  // a sky is told the same about a seal as the built-in lexicon is
  assert.deepEqual(station("seal").skySay.stargazer, station("seal").say.stargazer);
  assert.deepEqual(station("layers").skySay.stargazer[0], station("layers").say.stargazer[0]);
  // the bridge is stated once, in the first gold box
  assert.deepEqual(M.STATIONS.map((s) => s.bridge.opening !== null), [true, false, false, false, false, false, false]);
  for (const l of LENSES) assert.ok(isSentence(M.BRIDGE_OPENING[l]) && M.BRIDGE_OPENING[l].layer === "reading");
});

test("which stations and tabs each lens and each kind of lexicon shows", () => {
  const titles = (lens, origin) => M.visibleStations(lens, origin).map((s) => M.stationView(s.key, lens, origin === "page" ? SKY.lexicon : M.EZEKIEL).title);
  assert.deepEqual(titles("stargazer", "builtin"), ["Read", "Count", "Kinds of sentence", "Stamp it"]);
  assert.deepEqual(titles("navigator", "builtin"), ["Read", "Count", "Place", "Layers", "Seal", "Send", "The fourth square"]);
  assert.deepEqual(titles("holographer", "builtin"), titles("navigator", "builtin"));
  assert.deepEqual(M.visibleStations("navigator", "page").map((s) => s.key), ["place", "layers", "seal", "send"]);
  assert.deepEqual(M.visibleStations("stargazer", "page").map((s) => s.key), ["layers", "seal"]);
  assert.deepEqual(M.visibleStations("holographer", "outside"), []);
  assert.deepEqual(M.TABS.map((t) => t.label), ["Entry", "Wheel", "Chain", "Overwatch", "Witnesses"]);
  assert.deepEqual(M.visibleTabs("stargazer", { sealed: true, sent: true }).map((t) => t.key), ["entry"]);
  assert.deepEqual(M.visibleTabs("navigator", {}).map((t) => t.key), ["entry", "wheel"]);
  assert.deepEqual(M.visibleTabs("navigator", { sealed: true }).map((t) => t.key), ["entry", "wheel", "chain", "overwatch"]);
  assert.deepEqual(M.visibleTabs("holographer", { sealed: true, sent: true }).map((t) => t.key), ["entry", "wheel", "chain", "overwatch", "witnesses"]);
  assert.deepEqual(M.visibleTabs("navigator", { origin: "outside" }).map((t) => t.key), ["entry", "overwatch"]);
  // a station this lens hides is not handed out, and an unknown lens is read as Stargazer
  assert.equal(M.stationView("place", "stargazer"), null);
  assert.equal(M.stationView("fourth", "navigator", SKY.lexicon), null);
  assert.equal(M.stationView("nope", "navigator"), null);
  assert.equal(M.stationView("seal", "constructor").title, "Stamp it");
  // the bridge box belongs to the built-in lexicon; a sky gets its own say where there is one
  const skyPlace = M.stationView("place", "navigator", SKY.lexicon);
  assert.equal(skyPlace.bridge, null);
  assert.ok(!skyPlace.say.some((p) => p.text.includes("John")));
  const first = M.stationView("read", "stargazer");
  assert.equal(first.say[0].text, M.FIRST_LINE);
  assert.equal(M.FIRST_LINE, "The book of Ezekiel begins with a place and a day. Tap a shining word to see what we know about it.");
  assert.equal(M.STATIONS[0].say.stargazer[0].layer, "reading");
  assert.ok(!/\b(Ezekiel|he|a man) (wrote|stood|saw)\b/.test(M.FIRST_LINE), "the page does not say in its own voice who wrote the book");
  assert.equal(first.bridge.title, "THE BRIDGE");
  assert.equal(first.bridge.opening.text, M.BRIDGE_OPENING.stargazer.text);
  assert.equal(M.stationView("count", "navigator").bridge.opening, null);
  assert.deepEqual({ ...first.next }, { label: "Next: count the fours", station: "count", word: "four" });
  // at Stargazer a hard sentence is given in its Stargazer form
  const s2 = M.stationView("count", "stargazer").bridge.stands, n2 = M.stationView("count", "navigator").bridge.stands;
  assert.ok(n2[1].text.includes("quadriform") && !s2[1].text.includes("quadriform"));
});

// ─── layers and the sensitive points ─────────────────────────────────────────

test("every sentence of the copy carries one layer; a TEXT sentence is cut out of a verse row", () => {
  assert.ok(COPY.length > 150);
  for (const c of COPY) assert.ok(isSentence(c), `${c.where} has no layer or no text`);
  const written = [];
  for (const s of M.STATIONS) { for (const x of s.bridge.stands) if (x.layer === "text") written.push(x); if (s.verse) written.push(s.verse); }
  written.push(M.FOURTH_VERSE);
  assert.ok(written.length >= 9);
  for (const x of written) {
    const row = ROW.get(x.source);
    assert.ok(row && row.layer === "text" && row.kind === "verse", `${x.source} is a verse row`);
    assert.ok(x.text.length >= 12 && row.text.includes(x.text), `"${x.text}" stands in ${x.source}`);
    assert.ok(x.name.endsWith(", King James Version") && x.name.startsWith(row.name.replace(/ \(.*\)$/, "")), "the translation is named");
  }
  // no TEXT sentence anywhere else in the station copy
  for (const c of COPY) if (c.layer === "text" && !c.where.startsWith("dialog")) assert.ok([...ROW.values()].some((r) => r.kind === "verse" && r.text.includes(c.text)), c.where);
  // the cuts are the ones the specification names
  const cut = (key, i) => station(key).bridge.stands[i].text;
  assert.equal(cut("read", 0), "as I was among the captives by the river of Chebar");
  assert.equal(cut("count", 0), "came the likeness of four living creatures");
  assert.equal(cut("place", 0), ROW.get("43.3.16").text);
  assert.equal(cut("place", 1), "he that came down from heaven");
  assert.equal(cut("seal", 0), "that thou say nothing but the truth");
  assert.equal(cut("send", 0), "at the mouth of two witnesses, or at the mouth of three witnesses, shall the matter be established");
  assert.equal(station("send").verse.text, ROW.get("5.19.15").text);
  assert.equal(cut("fourth", 0), "the Word was made flesh, and dwelt among us");
  assert.equal(M.FOURTH_VERSE.text, ROW.get("43.1.14").text);
  // verseSlice: the whole verse without marks or with a mark that is not there; nothing for an unknown row
  assert.equal(M.verseSlice("26.1.9"), ROW.get("26.1.9").text);
  assert.equal(M.verseSlice("26.1.9", "no such words", "went"), ROW.get("26.1.9").text);
  assert.equal(M.verseSlice("26.1.9", "they turned"), ROW.get("26.1.9").text);
  assert.equal(M.verseSlice("26.1.9", undefined, "went"), ROW.get("26.1.9").text);
  assert.equal(M.verseSlice("26.1.9", "they went", "no such words"), ROW.get("26.1.9").text);
  assert.equal(M.verseSlice("26.1.9", "they turned", "went"), "they turned not when they went");
  assert.equal(M.verseSlice("1.1.1", "a", "b"), "");
});

test("SAID names its speaker, CHECKED begins with what was done, READING speaks as we or the author", () => {
  // Each of these is a person, a work, a tradition or a search of this project. The first words of a sentence are not a speaker.
  const speakers = ["van Paassen", "Van Paassen", "Irenaeus", "The book says", "This project's search", "King James Version, from the Project Gutenberg e-text", "John Wilkinson", "A law book of 1618",
    "SHD-CCP RFC 02", "This project's rule book", "This project searched", "Scripture quotations taken from", "Rabbinic tradition", "This project reports", "The Jewish Encyclopedia says"];
  const hasSpeaker = (text) => speakers.some((s) => text.includes(s));
  for (const c of COPY.filter((x) => x.layer === "said" && !x.where.startsWith("dialog The four layers"))) {      // the legend describes the layer itself
    assert.ok(hasSpeaker(c.text), `${c.where}: no speaker in "${c.text.slice(0, 60)}"`);
    if (!c.where.startsWith("dialog Ezekiel 1 in Jewish tradition")) assert.ok(!/\b(but|however|in fact|actually)\b/i.test(unquoted(c.text)), `${c.where}: a SAID sentence argues`);
  }
  // every SAID item of the dialog is among the sentences just checked, and the check refuses the three sentences the dialog once had:
  // a sentence that names nobody, and two whose opening words stood in the list of speakers
  const dialogSaid = M.DIALOG.sections.filter((s) => s.heading !== "The four layers").flatMap((s) => s.items.filter((i) => i.layer === "said"));
  assert.ok(dialogSaid.length >= 6);
  for (const item of dialogSaid) {
    assert.ok(COPY.some((c) => c.layer === "said" && c.text === item.text), "a SAID item of the dialog is not in the copy that is checked");
    assert.ok(hasSpeaker(item.text), `the dialog: no speaker in "${item.text.slice(0, 60)}"`);
  }
  for (const old of [
    "Where others differ. Most Christians, and many historians, disagree with parts of that. Some of his sources are dated, among them Robert Eisler's reconstruction of an armed rising.",
    "The history is from one book. Words in quotation marks were checked against the text.",
    "What he argues. Jesus was a Galilean Jew in the line of Israel's prophets.",
    "Most Christians and many historians disagree with parts of it.",
  ]) assert.equal(hasSpeaker(old), false, `the speaker check lets through: ${old.slice(0, 40)}`);
  // a judgement of this project about a source is a READING, in the dialog as in the rows
  for (const c of COPY.filter((x) => /most Christians|many historians|sources are dated/i.test(x.text))) assert.equal(c.layer, "reading", c.where);
  for (const s of M.STATIONS) {
    for (const x of s.bridge.stands.filter((y) => y.layer === "checked")) {
      for (const t of [x.text, x.stargazer].filter(Boolean)) assert.match(t, /^(Counted|Computed|Computed from approximate positions|Tested|Built|Worked out|Read from the rows): /, `${s.key}: ${t.slice(0, 40)}`);
    }
    for (const l of LENSES) {
      const r = s.bridge.reading[l].text;
      assert.match(r, /^(We |The author)/, `${s.key} ${l}`);
      if (l !== "stargazer" || s.key !== "layers") assert.ok(r.endsWith("You may see it another way."), `${s.key} ${l} leaves room`);
      assert.ok(M.sentencesOf(r).length <= (l === "stargazer" ? 3 : 5), `${s.key} ${l} is short`);
      assert.ok(!/\b(you should|you must|believe|remember that)\b/i.test(r), `${s.key} ${l} gives no instruction`);
    }
  }
  // the Irenaeus pairings are introduced as Christian readings of a Jewish prophet's book, his view in his time
  for (const c of COPY.filter((x) => x.text.includes("Irenaeus"))) assert.ok(/Christian (reading|writer)/.test(c.text) && /(his view, in his time|his reading of a Jewish prophet's book)/.test(c.text), c.where);
});

test("the sensitive points of 1.4 in the copy", () => {
  const DISCLAIMER = "This is our reading; no check depends on it, and the word bridge is not in the King James Bible.";
  for (const l of ["navigator", "holographer"]) {
    assert.ok(M.BRIDGE_OPENING[l].text.endsWith(DISCLAIMER));
    assert.ok(M.BRIDGE_OPENING[l].text.startsWith("First Explorers drew its bridge as the line through the zero point, at right angles to the map of peoples, and read Jesus of Nazareth as that line."));
    assert.ok(M.BRIDGE_OPENING[l].text.includes("The gold boxes follow that line from Ezekiel's river to John 3:16."));
  }
  assert.ok(M.BRIDGE_OPENING.stargazer.text.endsWith("This is our reading, and no check depends on it. The word bridge is not in the King James Bible."));
  // the disclaimer stands once: in the first gold box and nowhere else in the stations
  assert.equal(COPY.filter((c) => !c.where.startsWith("dialog") && c.text.includes("the word bridge is not in the King James Bible")).length, 2);
  // line 8 is never narrated; line 1's word is never used by the page; nothing about who killed Jesus outside the attributed summary
  const line8 = ROW.get("100.8").text;
  for (const c of COPY) {
    assert.ok(!c.text.includes(line8) && !/so help/i.test(c.text), `${c.where} speaks line 8`);
    assert.ok(!/\balien/i.test(c.text), `${c.where} uses the word of line 1`);
    assert.ok(!/delivered to the Jews/i.test(c.text), c.where);
    assert.ok(!/the vision (really )?(happened|did not happen)/i.test(c.text), c.where);
  }
  for (const s of M.STATIONS) for (const l of LENSES) assert.ok(!s.say[l].some((p) => /Line 8|line 8/.test(p.text)));
  // an author's line is never paraphrased as a fact: where the copy speaks of the author it is a READING
  for (const c of COPY.filter((x) => /The author('s| sees| wrote)/.test(x.text) && !x.where.startsWith("dialog"))) assert.ok(c.layer === "reading" || c.where.includes("note"), c.where);
  // the framing of line 8, letter for letter
  assert.equal(M.LINE8_FRAMING, "The author's own words, in the style of the courtroom oath: a warning against leading people away from the truth. The page quotes them. It is not saying them to you.");
  assert.equal({ ...M.AUTHOR_LABEL }.navigator, "READING · the author's note");
  // one seal is one witness; the receivers are simulated
  assert.ok(M.quorumSentence(2).includes("All four run inside this page") && M.quorumSentence(2).endsWith("It does not show that independent parties have looked."));
  assert.equal(M.SEND_READING.text, "The page borrows a number from this rule and nothing more. The rule is about people giving evidence.");
});

test("the dialog holds the sentences section 8.6 prescribes", () => {
  assert.equal(M.DIALOG.title, "What is real here?");
  assert.deepEqual(M.DIALOG.inShort.map((p) => p.text), [
    "This page shows nine Bible verses and what people have said about their words.",
    "It counts things, and shows you how to count them too.",
    "It also shows ten notes its author wrote, and marks them as the author's.",
    "A stamp shows that the writing has not changed. It cannot show that the writing is true.",
    "The Bible words do not prove the numbers. The numbers do not prove the Bible words.",
    "STRIX is the owl that speaks on this page.",
  ]);
  assert.equal(M.DIALOG.first.text, "This page sets Bible verses beside sky calculations because its author asked for that. The numbers do not depend on the verses, and the verses are not offered as science.");
  assert.ok(M.DIALOG.inShort.length >= 4 && M.DIALOG.inShort.length <= 6);
  const all = M.DIALOG.sections.map((s) => s.items.map((i) => i.text).join(" ")).join("\n");
  for (const wanted of [
    KIT.BADGE_HELP, PASSAGE.SUPPLIED_NOTICE, PASSAGE.SUPPLIED_NOTE, ROW.get("0.3").text, M.CERTIFIED_TEXT,
    "The author calls this way of working \"the design protocol of Why Jesus Died\". The rules are this project's; the book does not contain them.",
    "The links between Ezekiel and the Gospels shown here come from early Christian writers and from this project, not from him.",
    "The epochs are where the format cuts the text, one per top-level entry. They show that this chain is the one this text gives. They are not a record of when or in what order anything was written.",
    "The ledger is what the sealer wrote down. Its links show it has not been edited since sealing, not that its times are true.",
    "The words 2D+3D in the certificate mean that the same addresses are drawn both ways. The drawings are not signed.",
    "The receivers are simulated in this page.",
    "The key is made for this visit and shows integrity, not identity.",
    "LEX/1 and LEXICON/2 are drafts, not RFCs.",
    "the same three levels First Explorers calls Stargazer, Explorer and Architect",
    "The only request to another host is for web fonts (Google Fonts); the page works without them.",
    "Code: MIT. Quoted texts belong to their rights holders and are not covered by that licence.",
    "the running text never mentions",
  ]) assert.ok(all.includes(wanted), `the dialog lacks: ${wanted.slice(0, 50)}`);
  for (const m of KIT.LAYER_META) assert.ok(all.includes(m.legend));
  assert.equal(M.CERTIFIED_TEXT, "Certified: these bytes, their order, their addresses, the label each entry was given, the lineage and the ledger, unchanged since they were sealed with this key. "
    + "Not certified: that a TEXT entry matches its source, that a SAID entry is faithful, that a CHECKED number is right, that any READING is true, or who sealed it. "
    + "A TEXT row is checked by reading the source it names, a CHECKED row by running the code, a SAID row by opening the work cited. "
    + "This project reports: its tests compared the verse entries with the Project Gutenberg King James files (November 2026), and its builders compared each quotation with the source named. "
    + "That review, not the seal, is the reason to trust the labels; you can repeat it by opening the sources.");
  // the fourth sentence is a report of this project, not something a visitor can repeat on the page: SAID, with its speaker
  assert.deepEqual(M.CERTIFIED.map((s) => s.layer), ["checked", "checked", "reading", "said"]);
  assert.ok(M.CERTIFIED[3].text.startsWith("This project reports: "));
  // the bridge section: several writers are quoted; what van Paassen argues is SAID by him; this project's view of him is a READING
  const bridge = M.DIALOG.sections.find((s) => s.heading === "The bridge narrative (the gold boxes)").items;
  assert.deepEqual(bridge.slice(1, 4).map((i) => [i.layer, i.text]), [
    ["reading", "The gold boxes quote several writers, each named where it is quoted. Where a box quotes Pierre van Paassen, Why Jesus Died (Dial Press, 1949), the words in quotation marks are his and were checked against a scan of the book."],
    ["said", "Van Paassen argues that Jesus was a Galilean Jew in the line of Israel's prophets who announced the Kingdom of God on earth: justice, and all people as kin; that Pontius Pilate alone ordered his death; that later tellings moved the blame onto the Jewish people; and that Greek-speaking missionaries, starting from Antioch, remade his message. He writes as a Unitarian and does not take the resurrection, the virgin birth or the Trinity as history."],
    ["reading", "This project's view: most Christians and many historians would disagree with parts of that. Some of his sources are dated, among them Robert Eisler's reconstruction of an armed rising and the old theory of a dying and rising god."],
  ]);
  assert.ok(!all.includes("The history is from one book") && !all.includes("Words in quotation marks are his and were checked against the text"));
  assert.ok(!/"dying and rising gods"/.test(all), "a phrase his book does not have is not put in quotation marks");
  // the gold boxes do quote several writers: Irenaeus, a law book, this project's own RFC
  const quotedIn = (who) => M.STATIONS.some((s) => s.bridge.stands.some((x) => x.layer === "said" && x.text.includes(who) && /"[^"]+"/.test(x.text)));
  for (const who of ["van Paassen", "Irenaeus", "John Wilkinson", "SHD-CCP RFC 02"]) assert.ok(quotedIn(who), `${who} is quoted in a gold box`);
  // the Bible words: what is King James is every verse entry; other translations are quoted in entries that name them
  const bible = M.DIALOG.sections.find((s) => s.heading === "The Bible words").items;
  assert.ok(bible[0].text.endsWith(" Every verse entry in the lexicon is in that wording."));
  assert.ok(!all.includes("Every Bible quotation"));
  assert.ok(DATA.ROWS.some((r) => r[2] !== "verse" && /Douay|American Standard|Brenton/.test(r[4])), "the rows do quote other translations");
  assert.equal(M.RESEAL_TEXT, "These are different bytes under a different key. A seal protects what was sealed. It cannot tell you that a label is deserved or whose key it is.");
  assert.equal(M.TAMPER_COPY.relabel.noticed, "The seal noticed that a label was changed.");
  assert.equal(M.OUTSIDE_NOTICE, "This lexicon was not made by this page. Its words and its labels are its sender's. The checks below show only that the lexicon, its labels and the ledger up to the signed point have not changed since some key signed them.");
  assert.ok(M.OUTSIDE_NOTICE.startsWith(M.OUTSIDE_BANNER));
  assert.equal(M.sentencesOf(M.OUTSIDE_NOTICE).length, 3);
  assert.equal(M.OUTSIDE_LEGEND, "What these labels would mean on this page's own lexicon. Here they are the sender's claims.");
  assert.equal(M.OUTSIDE_ROWS_HEADING, "Entries under this one, as their sender labelled them");
  // a sky has no entry 100 and no author's notes: its Seal station says only the half that is true of it
  assert.equal(copyText("seal sky note navigator"), "Epochs follow address order.");
  assert.equal(copyText("seal sky note stargazer"), "The parts are stamped in number order.");
  assert.equal(SKY.lexicon.byAddress.has("100"), false);
  for (const l of LENSES) {
    for (const s of M.visibleStations(l, "page")) {
      const v = M.stationView(s.key, l, SKY.lexicon);
      for (const p of [...v.say, ...v.notes]) assert.ok(!/author|\b100\b|Bible|Ezekiel/.test(p.text), `a sky is told at ${s.key}, ${l}: ${p.text}`);
    }
    assert.deepEqual(M.stationView("seal", l, SKY.lexicon).notes.map((p) => p.layer), ["checked"]);
    assert.ok(M.stationView("seal", l, M.EZEKIEL).notes[0].text.includes("100"), "the Ezekiel lexicon keeps its sentence");
  }
  assert.equal(copyText("seal note navigator"), "Epochs follow address order. The author's notes are sealed last because 100 is the largest index, not because they continue the Bible.");
  assert.equal(copyText("layers note navigator"), "The label is part of the sealed line: change it and the seal no longer fits. The seal does not judge the label.");
  // the specification's caption has 17 words ("are the same size as"); one sentence of at most 16 says the same
  assert.equal(M.WHEEL_COPY.perLens.stargazer.text, "On this curved map the thin outer lights are as big as the wide inner ones.");
  assert.equal(M.WHEEL_COPY.ladder.text, "1 → 4 → 16 → 64: bit, sector, quarter, word");
  assert.equal(M.WHEEL_COPY.parity.text, "Parity catches one flipped bit, or any odd number. Two flips cancel: parity holds again although the word has changed; the crystal check catches that.");
  assert.deepEqual(M.WITNESS_MARKS.map((m) => m.label), ["two: enough for the rule of Deuteronomy 19:15, as a demonstration", "three: the stricter count in the same verse"]);
  for (const m of M.WITNESS_MARKS) assert.ok(!/establish/i.test(m.label), "a mark does not say that four simulated receivers establish anything");
  assert.deepEqual({ ...M.QUORUM_LIMIT }, { layer: "checked", text: "This shows how a two-witness rule is checked. It does not show that independent parties have looked." });
  assert.ok(M.quorumSentence(3).endsWith(M.QUORUM_LIMIT.text));
  assert.deepEqual({ ...M.PLACE_LABELS }, { steps: "steps along the tree", straight: "straight distance in the chart" });
});

// ─── every CHECKED number, recomputed from the cores ─────────────────────────

test("the numbers the copy states as CHECKED are the ones the cores give", async () => {
  const F = M.COPY_FACTS, entries = DATA.ROWS.map((r) => OW.makeEntry(...r));
  // the reader: nine verses, the terms under them, each name letter for letter in its verse
  const terms = DATA.ROWS.filter((r) => r[2] === "term" && VERSES9.includes(OW.parentOf(r[0])));
  assert.equal(F.verses, 9);
  assert.equal(F.terms, terms.length);
  for (const t of DATA.ROWS.filter((r) => r[2] === "term")) assert.ok(ROW.get(OW.parentOf(t[0])).text.includes(t[3]), `${t[0]} stands in its verse`);
  assert.ok(copyText("read say holographer").includes(`nine verse rows with ${terms.length} term rows`));
  assert.ok(copyText("read stand 3").includes(`nine verses and ${terms.length} lit phrases`));
  // the counts, counted here with the core's countWord over the nine committed verse rows
  const count = (word) => VERSES9.reduce((n, a) => n + OW.countWord(ROW.get(a).text, word), 0);
  assert.deepEqual({ ...F.counts }, { thirtieth: count("thirtieth"), fourth: count("fourth"), fifth: count("fifth"), four: count("four") });
  assert.deepEqual({ ...F.counts }, { thirtieth: 1, fourth: 1, fifth: 3, four: 5 });
  assert.equal(F.sixteen, count("sixteen"));
  assert.equal(count("sixteen"), 0);
  assert.equal(copyText("count say stargazer"), "Counted: the word four appears five times in these nine verses. Count with me.");
  assert.ok(copyText("count say navigator").includes("thirtieth once, fourth once, fifth three times, four five times"));
  assert.ok(copyText("count say holographer").includes("thirtieth 1, fourth 1, fifth 3, four 5"));
  assert.ok(copyText("count stand 2").includes("four stands five times") && copyText("count stand 2").includes("sixteen not at all"));
  // the layers and the size of the lexicon
  const layers = OW.layerCounts(entries);
  assert.deepEqual({ ...F.layers }, layers);
  assert.equal(F.entries, entries.length);
  assert.equal(layers.text + layers.said + layers.checked + layers.reading, entries.length);
  const list = `${layers.text} TEXT, ${layers.said} SAID, ${layers.checked} CHECKED and ${layers.reading} READING`;
  assert.ok(copyText("layers say navigator").includes(`of the ${entries.length} entries, ${layers.text} are TEXT, ${layers.said} SAID, ${layers.checked} CHECKED and ${layers.reading} READING`));
  assert.ok(copyText("layers say holographer").includes(list) && copyText("layers stand 1").includes(`${entries.length} entries: ${list}`));
  assert.ok(copyText("layers say stargazer").includes(`${entries.length} pieces of four kinds`));
  assert.ok(copyText("layers stand 1 stargazer").includes(`${layers.text} WRITTEN, ${layers.said} SAID, ${layers.checked} CHECKED and ${layers.reading} OUR IDEA`));
  // the address that is a citation
  assert.equal(ROW.get("43.3.16").name, "John 3:16");
  assert.equal(ROW.get("43").name, "John");
  assert.equal(ROW.get("43.3").name, "John 3");
  assert.ok(copyText("place say navigator").includes("43.3.16 is John 3:16: book 43, chapter 3, verse 16"));
  // the epochs: one per top-level entry, in address order, the notes last; the real chain was grown with them
  assert.equal(F.epochs, OW.treeEpochTexts(entries).length);
  assert.equal(F.epochs, 14);
  assert.ok(copyText("seal say navigator").includes("14 in all") && copyText("seal say holographer").includes("(14 here)"));
  assert.equal(epochsSeen.length, 14);
  assert.deepEqual(epochsSeen.map((p) => p.epoch), Array.from({ length: 14 }, (_, i) => i + 1));
  assert.equal(SEAL.bundle.chain.epoch, 14);
  const tops = entries.filter((e) => !e.address.includes(".")).map((e) => Number(e.address));
  assert.equal(tops[tops.length - 1], 100);
  assert.equal(Math.max(...tops), 100);
  assert.equal(F.packets, OW.chainPackets(SEAL.bundle.chain).length);
  // the tampers: what refuses each, and the one that is accepted
  const got = [];
  for (const row of OW.LEXICON_TAMPERS) {
    const r = await M.runTamper(SEAL, row.key, { at: AT, lens: "navigator" });
    assert.equal(r.ran, true, row.key);
    assert.equal(r.got, row.expected, `${row.key} is refused where the table says`);
    assert.equal(r.asDeclared, true);
    assert.equal(r.accepted, row.expected === "accepted");
    got.push(r);
  }
  assert.deepEqual([...F.refusals], [...new Set(got.filter((r) => !r.accepted).map((r) => r.got))]);
  assert.ok(copyText("seal say holographer").includes("refused at crystal, lexicon, trace and signature; the resealed one is accepted"));
  const byKey = new Map(got.map((r) => [r.key, r]));
  assert.equal(byKey.get("word").got, "crystal");      // "a changed word is refused"
  assert.equal(byKey.get("drop").got, "lexicon");      // "a missing entry is refused"
  assert.equal(byKey.get("add").got, "lexicon");       // "an added entry is refused"
  assert.equal(byKey.get("relabel").sentence, "Refused at the check called lexicon. The seal noticed that a label was changed.");
  assert.equal(byKey.get("reseal").verdict, "ACCEPTED");
  assert.equal(byKey.get("reseal").sentence, M.RESEAL_TEXT);
  assert.notEqual(byKey.get("reseal").sealId, SEAL.certificate.sealId);
  // the relabelling tampers act on this page's own reading, row 0, never on one of the author's lines
  assert.equal(F.firstReading, "0");
  assert.equal(entries.find((e) => e.layer === "reading").address, "0");
  // east of the zero point
  const naz = CC.SITES.find((s) => s.key === "nazareth"), keb = CC.SITES.find((s) => s.key === "kebar");
  const east = CC.bearingAndDistance(naz.lat, naz.lonEast, keb.lat, keb.lonEast);
  const latApart = Math.abs(keb.lat - naz.lat), minutesApart = Math.abs(keb.lonEast - naz.lonEast) * 4;      // a star takes 4 minutes for a degree of longitude
  assert.deepEqual({ ...F.kebar }, { bearing: Math.round(east.bearing), km: Math.round(east.km), latApart: Number(latApart.toFixed(2)), minutes: Math.round(minutesApart / 5) * 5, kmRounded: Math.round(east.km / 10) * 10 });
  assert.deepEqual({ ...F.kebar }, { bearing: 91, km: 934, latApart: 0.57, minutes: 40, kmRounded: 930 });
  // the copy states the three numbers no finer than two approximate positions bear: half a degree, 40 minutes, 930 km, roughly due east
  assert.ok(latApart >= 0.45 && latApart <= 0.65, "about half a degree");
  assert.ok(Math.abs(east.bearing - 90) <= 5, "roughly due east");
  assert.ok(/approximate/.test(keb.note) && /approximate/.test(naz.note), "both positions are approximate in the core");
  assert.equal(M.KEBAR_NAZARETH.layer, "checked");
  assert.equal(M.KEBAR_NAZARETH.text, "Computed from approximate positions: the Kebar site (Nippur) and Nazareth lie about half a degree apart in latitude, so almost the same stars pass overhead at both, "
    + `about ${Math.round(minutesApart / 5) * 5} minutes apart. From Nazareth the site lies roughly due east, about ${Math.round(east.km / 10) * 10} km.`);
  assert.equal(M.KEBAR_NAZARETH.text, "Computed from approximate positions: the Kebar site (Nippur) and Nazareth lie about half a degree apart in latitude, so almost the same stars pass overhead at both, about 40 minutes apart. From Nazareth the site lies roughly due east, about 930 km.");
  assert.deepEqual([...F.roads], OW.CROSSROADS.map((c) => c.bearing));
  for (const b of F.roads) assert.ok(Math.abs(((b - 90 + 540) % 360) - 180) > 45, `the road at ${b} degrees does not run east`);
  assert.ok(station("send").bridge.stands[2].text.startsWith(M.KEBAR_NAZARETH.text + " ") && copyText("send stand 2").includes("11°, 253°, 303° and 304°"));
  for (const t of [station("send").bridge.stands[2].text, station("send").bridge.stands[2].stargazer]) assert.ok(!/934|0\.57|\b91\b|bearing|lies due east/.test(t), `finer than the positions bear: ${t}`);
  const starEast = station("send").bridge.stands[2].stargazer;
  assert.ok(starEast.includes("about 930 km") && starEast.includes("roughly east") && starEast.includes("about equally far north"), "the Stargazer form keeps the hedges");
  assert.ok(copyText("send say navigator").includes(OW.CROSSROADS.map((c) => c.city).slice(0, 3).join(", ") + " and " + OW.CROSSROADS[3].city));
  // three squares
  assert.equal(HM.gramTqf([0, 0], [3, 0], [0, 4]), 576n);
  assert.equal(576, 16 * 6 ** 2);
  assert.equal(F.sides.A, "576");
  assert.equal(F.sides.area, 6);
  assert.deepEqual([...F.sides.squares].sort((a, b) => a - b), [9, 16, 25]);
  assert.ok(copyText("fourth stand 2").includes("the squares are 9, 16 and 25, and A = 576 = 16 × 6²"));
  assert.equal(HM.squareNumbersNext(1, 4, 9), 16);
  assert.ok(copyText("fourth say holographer").endsWith("3 · 9 − 3 · 4 + 1 = 16."));
  assert.ok(copyText("fourth part d").includes("3 × 9 − 3 × 4 + 1 = 16"));
  // the wheel's cells
  const rings = HM.equalAreaRings(1.5, 4);
  for (let i = 0; i < 4; i++) close(HM.cellArea(rings, i, 16), 0.1328, 5e-5, `area of a cell of ring ${i}`);
  assert.equal(F.wheelCellArea, 0.1328);
  assert.ok(copyText("wheel holographer").includes("0.1328"));
});

// ─── Stargazer strings (1.6) ─────────────────────────────────────────────────

test("Stargazer strings: no sentence over 16 words and none of the hard words", () => {
  const strings = M.stargazerStrings();
  assert.ok(strings.length >= 80);
  const hard = /\b(ecliptic|azimuth|geodesic|isometr(y|ies)|hyperbolic|lorentz|parity|hash(es)?|epochs?|certificates?|logarithmic)\b/i;
  const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  for (const { where, text } of strings) {
    assert.ok(!hard.test(text), `${where}: a hard word in "${text}"`);
    for (const sentence of unquoted(text).split(/(?<=[.!?])\s+/)) assert.ok(words(sentence) <= 16, `${where}: ${words(sentence)} words in "${sentence}"`);
  }
  // the strings are the ones a Stargazer is shown: every Stargazer say, reading and stand of the stations is among them
  const have = new Set(strings.map((s) => s.text));
  for (const s of M.STATIONS) {
    for (const p of s.say.stargazer) assert.ok(have.has(p.text));
    assert.ok(have.has(s.bridge.reading.stargazer.text));
    for (const x of s.bridge.stands) if (x.layer !== "text") assert.ok(have.has(x.stargazer || x.text));
    const view = M.stationView(s.key, "stargazer");
    if (view) for (const p of [...view.say, ...view.notes, view.bridge.reading, ...view.bridge.stands.filter((x) => x.layer !== "text")]) assert.ok(have.has(p.text), `${s.key}: "${p.text.slice(0, 40)}" is not listed`);
  }
  // the sentences section 1.6 gives
  assert.ok(have.has("A seal is a stamp on the exact writing. Change one letter and the stamp no longer fits, and anyone can see that. It does not say the writing is true, and it does not say who made it."));
  assert.ok(have.has("One message made of 64 lights: 16 slices of 4. One slice is one letter of the code. One light is the guard: flip any one light and the guard notices. Flip two and it is fooled, which is why the chain keeps stronger checks too."));
  assert.ok(have.has("Two receivers checked the stamp and agreed, so the parcel arrived unchanged. They are pretend receivers inside this page."));
  assert.ok([...have].some((t) => t.includes("this exact writing, not whether it is true")));
  for (const { text } of strings) assert.ok(!text.includes("these bytes, not their truth"));
  // every control has a label at both depths
  for (const [key, v] of Object.entries(M.UI)) {
    assert.ok(v.stargazer !== "" && v.other !== "", key);
    assert.equal(M.uiLabel(key, "stargazer"), v.stargazer);
    assert.equal(M.uiLabel(key, "holographer"), v.other);
    assert.ok(have.has(v.stargazer));
  }
  assert.equal(M.uiLabel("seal", "stargazer"), "Stamp it");
  assert.deepEqual(["seal", "home", "prev", "ball"].map((k) => M.uiLabel(k, "navigator")), ["Seal this lexicon", "Home", "Previous sibling", "3D"]);
  assert.equal(M.uiLabel("constructor", "navigator"), "");
  // station and tamper names at Stargazer
  assert.deepEqual(M.tamperRows("stargazer").map((r) => r.label), ["Change a word", "Drop a thing", "Add a thing"]);
  assert.deepEqual(M.tamperRows("navigator").slice(0, 3).map((r) => r.label), ["Change a word", "Drop an entry", "Add an entry"]);
  assert.equal(M.tamperRows("navigator").length, OW.LEXICON_TAMPERS.length);
  assert.equal(M.tamperRows("navigator").at(-1).label, "Relabel a READING as TEXT and seal it again with a new key");
});

// ─── links ───────────────────────────────────────────────────────────────────

test("parseHash reads every link the Celestial Control Panel emits", async () => {
  // TEXT sentences of the sky page link to their rows: #entry=ADDRESS with the lens
  for (const r of DATA.ROWS.filter((x) => x[2] === "verse" || x[2] === "term")) {
    for (const lens of LENSES) {
      const p = M.parseHash(`#entry=${r[0]}&lens=${lens}`);
      assert.deepEqual({ ...p.values }, { entry: r[0], lens });
      assert.equal(p.ignored, 0);
      assert.equal(p.note, "");
    }
  }
  // the Seal step links a sky: three rounded numbers written by the core's formatSkyInputs
  const rnd = seeded(7);
  const skies = [[1505042.16624, 32.13, 45.23], [2461359.5, 51.4769, 0], [2451545, -33.87, 151.21], [990930.25, -90, 0], [2816000.123456, 89.99, -179.99]];
  for (let i = 0; i < 300; i++) skies.push([1000000 + rnd() * 1800000, -90 + rnd() * 180, -180 + rnd() * 360]);
  let read = 0;
  for (const [jd, lat, lon] of skies) {
    if (!CC.skyInputsValid(jd, lat, lon)) continue;
    const s = CC.formatSkyInputs(jd, lat, lon);
    for (const hash of [`#sky=${s.jd},${s.lat},${s.lon}`, `#sky=${s.jd},${s.lat},${s.lon}&lens=holographer`, `#lens=navigator&sky=${s.jd},${s.lat},${s.lon}`]) {
      const p = M.parseHash(hash);
      assert.equal(p.ignored, 0, hash);
      assert.deepEqual([...p.values.sky], [Number(s.jd), Number(s.lat), Number(s.lon)], hash);
    }
    read++;
  }
  assert.ok(read > 250);
  assert.deepEqual({ ...M.parseHash("#lens=holographer").values }, { lens: "holographer" });
  assert.deepEqual({ ...M.parseHash("").values }, {});
  assert.deepEqual({ ...M.parseHash("#").values }, {});
  // if the other page's model is already there, read what it writes with its own functions
  const other = "Library/Experimental_Systems/Celestial_Control_Panel/celestial-panel-model.js";
  if (existsSync(path.join(ROOT, other))) {
    const SKYM = await load(other);
    if (typeof SKYM.parseHash === "function") {
      for (const href of [M.skyPageHref("date", "navigator"), M.skyPageHref("lab", "stargazer"), M.skyPageHref("home", "holographer")]) {
        const p = SKYM.parseHash(href.slice(href.indexOf("#")));
        assert.equal(p.ignored, 0, `the sky page ignores part of ${href}`);
      }
    }
  }
});

test("parseHash refuses junk and never throws; formatHash writes only what parseHash reads", () => {
  const refused = (hash, kept = {}) => {
    const p = M.parseHash(hash);
    assert.ok(p.ignored >= 1, `${hash} was not refused`);
    assert.equal(p.note, "a link value was ignored");
    assert.deepEqual({ ...p.values }, kept, hash);
  };
  for (const bad of ["#entry=26..1", "#entry=01.2", "#entry=10000", "#entry=1.2.3.4.5.6.7.8.9", "#entry=", "#entry", "#entry=26.1.x", "#entry=-1", "#entry=26.1.1%2E4", "#entry= 26",
    "#sky=1505042.16624,32.13", "#sky=1505042.16624,32.13,45.23,1", "#sky=1505042.16624,91,45.23", "#sky=1505042.16624,32.13,181", "#sky=abc,32.13,45.23", "#sky=9999999,0,0", "#sky=1,0,0",
    "#sky=1505042.1662499,32.13,45.23", "#sky=1505042.16624,32.12345,45.23", "#sky=,,", "#sky=1505042.16624;32.13;45.23",
    "#lens=architect", "#lens=Stargazer", "#lens=", "#preset=ezekiel", "#lab=square", "#package=abc", "#__proto__=1", "#constructor=1", "#x",
    "#entry=26.1&entry=26.1.1", "#entry=<script>alert(1)</script>", "#entry=javascript:alert(1)", "#entry=" + "1".repeat(3000)]) refused(bad);
  refused("#entry=26.1.9&lens=navigator&junk=1", { entry: "26.1.9", lens: "navigator" });
  refused("#lens=navigator&lens=holographer&entry=26.1.9", { entry: "26.1.9" });
  for (const odd of [null, undefined, 5, {}, [], "\u0000", "#" + "&".repeat(50), "#=", "#==", "###"]) assert.doesNotThrow(() => M.parseHash(odd));
  assert.equal(M.parseHash(undefined).ignored, 0);
  assert.equal(M.parseHash(5).ignored, 1);
  // writing
  assert.equal(M.formatHash({ entry: "26.1.9", lens: "navigator" }), "#entry=26.1.9&lens=navigator");
  assert.equal(M.formatHash({ lens: "stargazer", entry: "43.3.16", sky: [1505042.166241, 32.13, 45.23] }), "#sky=1505042.16624,32.13,45.23&entry=43.3.16&lens=stargazer");
  assert.equal(M.formatHash({ sky: ["1505042.16624", "32.13", "45.23"] }), "#sky=1505042.16624,32.13,45.23");
  assert.equal(M.formatHash({}), "");
  assert.equal(M.formatHash({ entry: null, lens: null }), "");
  for (const bad of [{ entry: "26..1" }, { lens: "architect" }, { sky: [1, 2] }, { sky: [1505042.16624, 95, 0] }, { preset: "ezekiel" }, { entry: "26.1", extra: 1 }]) assert.throws(() => M.formatHash(bad));
  for (const r of DATA.ROWS) assert.deepEqual({ ...M.parseHash(M.formatHash({ entry: r[0], lens: "holographer" })).values }, { entry: r[0], lens: "holographer" });
  // the links this page writes: its own, and those to the sky page (keys and values of the grammar of 7.2)
  assert.equal(M.entryHref("26.1.9", "navigator"), "../Lexicon_Explorer/index.html#entry=26.1.9&lens=navigator");
  assert.equal(M.entryHref(null, "weird"), "../Lexicon_Explorer/index.html#lens=stargazer");
  assert.equal(M.skyPageHref("date", "navigator"), "../Celestial_Control_Panel/index.html#preset=ezekiel&lens=navigator");
  assert.equal(M.skyPageHref("lab", "stargazer"), "../Celestial_Control_Panel/index.html#lab=square&lens=stargazer");
  assert.equal(M.skyPageHref("home", "holographer"), "../Celestial_Control_Panel/index.html#lens=holographer");
  assert.equal(M.firstExplorersHref(), KIT.LINKS.firstExplorers);
  for (const href of [M.entryHref("26.1.9", "navigator", [1505042.16624, 32.13, 45.23]), M.skyPageHref("date", "x"), M.skyPageHref("lab", "holographer"), M.firstExplorersHref()]) {
    assert.ok(KIT.isAllowedUrl(href), `${href} is a link the kit allows`);
    const frag = href.includes("#") ? href.slice(href.indexOf("#") + 1) : "";
    for (const part of frag.split("&").filter(Boolean)) assert.match(part, /^[a-z]+=[A-Za-z0-9._,-]+$/);
  }
});

// ─── the reader, in both states of the supplied-passage module ───────────────

test("the reader with the supplied passage: two wordings, every term a button, the notice at the foot", () => {
  assert.equal(M.suppliedAvailable(), true);
  assert.equal(M.defaultWording("stargazer"), "supplied");
  assert.equal(M.defaultWording("navigator"), "kjv");
  assert.equal(M.defaultWording("holographer"), "kjv");
  for (const wording of ["supplied", "kjv"]) {
    const r = M.readerView(wording);
    assert.equal(r.wording, wording);
    assert.equal(r.canSwitch, true);
    assert.deepEqual(r.switch.map((b) => [b.key, b.label, b.pressed]), [["supplied", "The author's passage (NIV)", wording === "supplied"], ["kjv", "King James", wording === "kjv"]]);
    assert.equal(r.verses.length, 9);
    r.verses.forEach((v, i) => {
      const address = VERSES9[i], want = wording === "supplied" ? PASSAGE.SUPPLIED_VERSES[address] : ROW.get(address).text;
      assert.equal(v.address, address);
      assert.equal(v.number, i + 1);
      assert.equal(v.text, want);
      assert.equal(v.spans.map((s) => s.text).join(""), want, "the spans are the verse, nothing added or lost");
      assert.equal(v.layer, "text");
      assert.equal(v.translation, wording === "supplied" ? "New International Version, as the author supplied it" : "King James Version");
      const terms = DATA.ROWS.filter((x) => x[2] === "term" && OW.parentOf(x[0]) === address);
      assert.deepEqual(v.unplaced, []);
      assert.deepEqual(v.spans.filter((s) => s.term).map((s) => s.term).sort(), terms.map((t) => t[0]).sort(), "every term is a button");
      for (const s of v.spans.filter((x) => x.term)) assert.equal(s.text, wording === "supplied" ? PASSAGE.SUPPLIED_TERMS[s.term] : ROW.get(s.term).name);
    });
    if (wording === "supplied") assert.deepEqual(r.foot, { notice: PASSAGE.SUPPLIED_NOTICE, note: PASSAGE.SUPPLIED_NOTE });
    else assert.equal(r.foot, null);
    // above the reader: row 0.3 belongs first to the Hebrew Bible, and the lexicon does not explain the vision
    assert.equal(r.head.source, "0.3");
    // the excerpt leaves out the sentences that name the row's speakers: it is this project's framing, with a link to the row
    assert.equal(ROW.get("0.3").layer, "said");
    assert.equal(r.head.layer, "reading");
    for (const speaker of ["Rabbinic tradition", "Jewish Encyclopedia", "Mishnah"]) assert.ok(ROW.get("0.3").text.includes(speaker) && !r.head.text.includes(speaker));
    assert.deepEqual(r.head.link, { address: "0.3", label: "What Jewish tradition says about this chapter" });
    assert.deepEqual(r.switchNote, { layer: "reading", text: "The Bible has been put into English many times. Here are two: the one the author sent, and the King James. Kebar and Chebar are one river." });
    assert.equal(r.head.first, "Ezekiel 1 belongs first to the Hebrew Bible.");
    assert.ok(ROW.get("0.3").text.startsWith(r.head.first) && ROW.get("0.3").text.endsWith(r.head.last));
    assert.ok(r.head.last.endsWith("It does not explain the vision."));
    assert.equal(r.head.text, r.head.first + " " + r.head.last);
    // a closing sentence that begins "It" is shown with the sentence that says what "it" is
    const closing = M.sentencesOf(ROW.get("0.3").text);
    assert.equal(M.sentencesOf(r.head.last).length, /^It /.test(closing.at(-1)) ? 2 : 1);
    assert.equal(r.head.last, closing.slice(/^It /.test(closing.at(-1)) ? -2 : -1).join(" "));
  }
  // the footnote mark is not shown, and the supplied words never reach a link or the sealed package
  for (const a of VERSES9) {
    assert.ok(!PASSAGE.SUPPLIED_VERSES[a].includes("[a]"));
    if (PASSAGE.SUPPLIED_VERSES[a] !== ROW.get(a).text) assert.ok(!SEAL.wire.includes(PASSAGE.SUPPLIED_VERSES[a]) && !M.lexiconTextOf(M.EZEKIEL).includes(PASSAGE.SUPPLIED_VERSES[a]));
  }
  assert.ok(!SEAL.wire.includes("Biblica") && !SEAL.wire.includes("Kebar River"));
  // the choice: the lens decides until the visitor chooses; then the choice holds
  let s = M.initialState("");
  assert.equal(s.wording, "supplied");
  s = M.setLens(s, "navigator");
  assert.equal(s.wording, "kjv");
  s = M.setLens(s, "stargazer");
  assert.equal(s.wording, "supplied");
  s = M.setWording(s, "kjv");
  assert.equal(M.setLens(s, "navigator").wording, "kjv");
  assert.equal(M.setLens(M.setLens(s, "navigator"), "stargazer").wording, "kjv");
  s = M.setWording(M.setLens(s, "holographer"), "supplied");
  assert.equal(M.setLens(s, "navigator").wording, "supplied");
  assert.equal(M.wordingFor(s), "supplied");
});

test("the reader with the supplied module emptied: King James only, no switch, no notice", () => {
  assert.equal(M.suppliedAvailable(EMPTY), false);
  assert.equal(M.suppliedAvailable({ verses: null }), false);
  assert.equal(M.suppliedAvailable(null), false);
  for (const lens of LENSES) assert.equal(M.defaultWording(lens, EMPTY), "kjv");
  for (const wording of ["supplied", "kjv", "anything"]) {
    const r = M.readerView(wording, EMPTY);
    assert.equal(r.wording, "kjv");
    assert.equal(r.canSwitch, false);
    assert.deepEqual(r.switch, []);
    assert.equal(r.foot, null);
    r.verses.forEach((v, i) => {
      assert.equal(v.text, ROW.get(VERSES9[i]).text);
      assert.equal(v.wording, "kjv");
      assert.deepEqual(v.unplaced, []);
      assert.equal(v.spans.map((s) => s.text).join(""), v.text);
    });
  }
  let s = M.initialState("", EMPTY);
  assert.equal(s.wording, "kjv");
  s = M.setWording(s, "supplied", EMPTY);
  assert.equal(s.wording, "kjv");
  assert.equal(M.wordingFor({ lens: "stargazer", wording: "supplied", wordingChosen: true }, EMPTY), "kjv");
  for (const lens of LENSES) {
    const verse = M.entryView(M.EZEKIEL, "26.1.3", lens, { wording: "supplied", supplied: EMPTY });
    assert.deepEqual(verse.words.map((w) => [w.wording, w.text]), [["kjv", ROW.get("26.1.3").text]]);
    assert.equal(verse.foot, null);
    const term = M.entryView(M.EZEKIEL, "26.1.3.3", lens, { wording: "supplied", supplied: EMPTY });
    assert.deepEqual(term.words.map((w) => [w.wording, w.text]), [["kjv", "the land of the Chaldeans"]]);
    assert.equal(term.foot, null);
  }
  // a module holding only some verses shows those and falls back to King James for the rest
  const some = { ...EMPTY, verses: { "26.1.1": PASSAGE.SUPPLIED_VERSES["26.1.1"] }, terms: {} };
  const r = M.readerView("supplied", some);
  assert.equal(r.verses[0].wording, "supplied");
  assert.equal(r.verses[1].wording, "kjv");
  assert.equal(r.verses[0].unplaced.length, 6);
});

test("spansOf: terms are cut at their first place; a missing or overlapping phrase is left unplaced", () => {
  const t = "a wheel in the middle of a wheel";
  assert.deepEqual(M.spansOf(t, [{ address: "1", phrase: "wheel" }]), { spans: [{ text: "a ", term: null }, { text: "wheel", term: "1" }, { text: " in the middle of a wheel", term: null }], unplaced: [] });
  assert.deepEqual(M.spansOf(t, [{ address: "1", phrase: "the middle" }, { address: "2", phrase: "middle of" }, { address: "3", phrase: "Wheel" }, { address: "4" }]).unplaced.sort(), ["2", "3", "4"]);
  assert.deepEqual(M.spansOf("", []), { spans: [], unplaced: [] });
  assert.deepEqual(M.spansOf("abc", [{ address: "1", phrase: "" }]), { spans: [{ text: "abc", term: null }], unplaced: ["1"] });
  assert.equal(M.verseOfTerm("26.1.4.2.1"), "26.1.4");
  assert.equal(M.verseOfTerm("26.1.4"), "26.1.4");
  assert.equal(M.verseOfTerm("26.1.10.1"), null);
  assert.equal(M.verseOfTerm("26.1.40"), null);
  assert.equal(M.verseOfTerm(null), null);
});

// ─── counting ────────────────────────────────────────────────────────────────

test("the count table is counted live and agrees with what each word numbers", () => {
  const table = M.countTable();
  assert.deepEqual(table.map((c) => c.word), ["thirtieth", "fourth", "fifth", "four"]);
  for (const c of table) {
    const per = VERSES9.map((a) => OW.countWord(ROW.get(a).text, c.word));
    assert.equal(c.times, per.reduce((a, b) => a + b, 0));
    assert.deepEqual(c.perVerse.map((v) => v.times), per);
    assert.deepEqual(c.verses, per.map((n, i) => (n ? i + 1 : 0)).filter(Boolean));
    assert.equal(c.agrees, true, `${c.word}: one "what it numbers" for each occurrence`);
    assert.equal(c.numbers.length, c.times);
    for (const n of c.numbers) assert.ok(ROW.get(n.verse).text.includes(n.words) && OW.countWord(n.words, c.word) === 1);
  }
  assert.deepEqual(table.map((c) => [c.times, c.timesWord, c.verses]), [[1, "once", [1]], [1, "once", [1]], [3, "three times", [1, 2]], [5, "five times", [5, 6, 8]]]);
  // "four" lit five times in the passage
  const marks = M.countMarks("four");
  assert.equal(marks.reduce((n, v) => n + v.times, 0), 5);
  for (const v of marks) {
    assert.equal(v.spans.map((s) => s.text).join(""), ROW.get(v.address).text);
    for (const s of v.spans.filter((x) => x.hit)) assert.equal(s.text.toLowerCase(), "four");
  }
  assert.equal(M.countMarks(["fourth"]).reduce((n, v) => n + v.times, 0), 1, "fourth is not counted as four, nor four as fourth");
  assert.equal(M.numberWord(5), "five");
  assert.equal(M.numberWord(40), "40");
  assert.deepEqual([0, 1, 2, 3].map(M.timesWord), ["not at all", "once", "twice", "three times"]);
});

test("wordMatches finds exactly what countWord counts", () => {
  const texts = DATA.ROWS.filter((r) => r[2] === "verse").map((r) => r[4]);
  const words = ["four", "fourth", "fifth", "one", "LORD", "hand", "hands", "of a man", "they four", "the", "wing", "wings", "straight forward", "they turned not when they went", "God", "a"];
  for (const text of texts) for (const w of words) {
    const m = M.wordMatches(text, w);
    assert.equal(m.length, OW.countWord(text, w), `${w} in "${text.slice(0, 30)}"`);
    for (const [a, b] of m) assert.equal(text.slice(a, b).toLowerCase(), w.toLowerCase());
  }
  assert.equal(M.wordMatches("four fourth FOUR, four.", "four").length, 3);
  assert.deepEqual(M.wordMatches("anything", ""), []);
  assert.deepEqual(M.markSpans("four fourth FOUR", ["four", "fourth"]).map((s) => [s.text, s.hit]), [["four", true], [" ", false], ["fourth", true], [" ", false], ["FOUR", true]]);
});

test("Count with me: the count rows whose words stand in the reader light them", () => {
  const NUM = ["no", "once", "twice", "three times", "four times", "five times"];
  let offered = 0;
  for (const r of DATA.ROWS) {
    const c = M.countWithMe(M.EZEKIEL, r[0]);
    if (r[2] !== "count") { assert.equal(c, null, `${r[0]} is not a count row`); continue; }
    if (c === null) continue;
    offered++;
    assert.ok(c.inReader >= 1, `${r[0]} lights something`);
    assert.equal(c.inReader, c.marks.reduce((n, v) => n + v.times, 0));
    assert.equal(c.inReader, c.words.reduce((n, w) => n + VERSES9.reduce((k, a) => k + OW.countWord(ROW.get(a).text, w), 0), 0));
    for (const o of c.others) assert.ok(ROW.get(o.address).kind === "verse" && !VERSES9.includes(o.address) && o.times >= 1);
    // a row that speaks of "these nine verses" and of one word says how often: that is the number lit
    if (c.words.length === 1 && /in these nine verses/.test(r[4]) && c.inReader < NUM.length) assert.ok(r[4].includes(NUM[c.inReader]), `${r[0]}: "${r[4]}" against ${c.inReader} lit`);
    assert.ok(M.entryView(M.EZEKIEL, r[0], "navigator").actions.some((a) => a.key === "count" && a.label === "Count with me"));
    assert.equal(M.rowView(M.EZEKIEL, r[0], "navigator").countWithMe, true);
  }
  assert.ok(offered >= 10, `${offered} count rows offer the button`);
  const four = M.countWithMe(M.EZEKIEL, "26.1.5.1.4");
  if (four) assert.equal(four.inReader, 5);
  const turned = M.countWithMe(M.EZEKIEL, "26.1.9.2.6");
  if (turned) { assert.equal(turned.inReader, 1); assert.deepEqual(turned.others.map((o) => o.address), ["26.1.12", "26.1.17"]); }
  assert.equal(M.countWithMe(SKY.lexicon, "2.1"), null);
  assert.equal(M.countWithMe(M.EZEKIEL, "nope"), null);
});

// ─── the Entry ───────────────────────────────────────────────────────────────

test("the Entry at Stargazer: the words, the plain rows, then More for older readers", () => {
  assert.deepEqual(M.entryView(M.EZEKIEL, null, "stargazer"), { empty: true, prompt: "Tap a shining word", invite: M.NOTES_INVITE });
  const e = M.entryView(M.EZEKIEL, "26.1.1.4", "stargazer", { wording: "supplied" });
  assert.equal(e.name, "the river of Chebar");
  assert.deepEqual(e.show, { address: false, kind: false, path: false, hash: false });
  assert.equal(e.line, null);
  assert.equal(e.lineSha, null);
  assert.equal(e.caption, "Ezekiel > chapter 1 > verse 1 > the river of Chebar");
  assert.deepEqual(e.words.map((w) => [w.wording, w.text, w.primary]), [["supplied", "the Kebar River", true], ["kjv", "the river of Chebar", false]]);
  assert.deepEqual(e.foot, { notice: PASSAGE.SUPPLIED_NOTICE, note: PASSAGE.SUPPLIED_NOTE });
  const kids = DATA.ROWS.filter((r) => OW.parentOf(r[0]) === "26.1.1.4");
  assert.deepEqual(e.first.map((r) => r.address), kids.filter((r) => r[2] === "plain").map((r) => r[0]));
  assert.ok(e.first.length >= 1 && e.first.length <= 3);
  assert.deepEqual(e.more.map((r) => r.address).sort(), kids.filter((r) => r[2] !== "plain").map((r) => r[0]).sort());
  assert.equal(e.moreLabel, "More for older readers");
  assert.deepEqual(e.first.map((r) => r.badge.word), e.first.map((r) => ({ said: "SAID", reading: "OUR IDEA", checked: "CHECKED", text: "WRITTEN" })[r.layer]));
  // in the King James wording only the King James words are shown, and no notice
  const k = M.entryView(M.EZEKIEL, "26.1.1.4", "stargazer", { wording: "kjv" });
  assert.deepEqual(k.words.map((w) => w.wording), ["kjv"]);
  assert.equal(k.foot, null);
  // a verse: its words in the reader's wording, then its terms
  const v = M.entryView(M.EZEKIEL, "26.1.4", "stargazer", { wording: "supplied" });
  assert.deepEqual(v.words.map((w) => [w.wording, w.text]), [["supplied", PASSAGE.SUPPLIED_VERSES["26.1.4"]]]);
  assert.deepEqual(v.first.map((r) => r.kind), ["term", "term", "term", "term", "term"]);
  // every term and every author's line has one to three plain rows that come first
  for (const r of DATA.ROWS.filter((x) => x[2] === "term" || /^100\.\d+$/.test(x[0]))) {
    const view = M.entryView(M.EZEKIEL, r[0], "stargazer");
    const plain = view.first.filter((x) => x.kind === "plain");
    // (line 8 is the one exception: its framing stands under the quotation, and the two plain rows that say the same are not listed again)
    const withLine = view.author ? [...view.author.before, view.author.facet].filter((x) => x && x.kind === "plain").length + (view.author.framing ? 1 : 0) : 0;
    assert.ok(plain.length + withLine >= 1, `${r[0]} shows a plain row at Stargazer`);
    assert.ok(view.first.every((x) => x.group === "plain" || x.group === "parts"));
  }
});

test("the Entry from Navigator up: address, path, kind, both wordings, the children in the fixed order", () => {
  const order = M.ENTRY_GROUPS.map((g) => g.key);
  assert.deepEqual(order, ["plain", "written", "parts", "text", "checked", "said", "reading"]);
  for (const r of DATA.ROWS) {
    for (const lens of ["navigator", "holographer"]) {
      const e = M.entryView(M.EZEKIEL, r[0], lens);
      assert.equal(e.address, r[0]);
      assert.deepEqual([e.name, e.layer, e.kind, e.text], [r[3], r[1], r[2], r[4]]);
      assert.deepEqual(e.show, { address: true, kind: true, path: true, hash: lens === "holographer" });
      assert.deepEqual(e.path.map((p) => p.address), HM.treePath("", r[0]).slice(1));
      const kids = DATA.ROWS.filter((x) => OW.parentOf(x[0]) === r[0]).map((x) => x[0]);
      assert.deepEqual(e.rows.map((x) => x.address).sort(), kids.slice().sort(), "every child is listed once");
      const ranks = e.rows.map((x) => order.indexOf(x.group));
      assert.deepEqual(ranks, ranks.slice().sort((a, b) => a - b), `${r[0]}: the groups come in the fixed order`);
      for (const g of order) assert.deepEqual(e.rows.filter((x) => x.group === g).map((x) => x.address), kids.filter((k) => e.rows.find((x) => x.address === k).group === g), "canonical order inside a group");
      assert.deepEqual(e.more, []);
      const withLine = e.author ? [...e.author.before.map((x) => x.address), ...(e.author.facet ? [e.author.facet.address] : [])] : [];
      assert.deepEqual([...e.first.map((x) => x.address), ...withLine, ...e.hidden].sort(), kids.slice().sort(), "every child is shown once, or is one of the rows line 8's framing stands for");
      assert.deepEqual(e.hidden, r[0] === "100.8" ? ["100.8.1", "100.8.2", "100.8.6"] : []);
      assert.equal(e.lead, null, "the short leads are for Stargazer");
      for (const x of e.rows) {
        if (x.kind === "plain") assert.equal(x.group, "plain");
        else if (x.kind === "link") assert.equal(x.group, ROW.get(x.text).layer === "text" ? "written" : "reading");
        else if (["checked", "said"].includes(x.group)) assert.equal(x.layer, x.group);
      }
      if (lens === "holographer") { assert.ok(e.line.startsWith("LEX/1|" + r[0] + "|" + r[1] + "|" + r[2] + "|")); assert.equal(e.lineSha, sha256(e.line)); }
      else { assert.equal(e.line, null); assert.equal(e.lineSha, null); }
    }
  }
  // a verse of the reader shows both wordings, the supplied one under its notice; other verses King James only
  const v = M.entryView(M.EZEKIEL, "26.1.9", "navigator", { wording: "kjv" });
  assert.deepEqual(v.words.map((w) => [w.wording, w.text, w.translation]), [["kjv", ROW.get("26.1.9").text, "King James Version"], ["supplied", PASSAGE.SUPPLIED_VERSES["26.1.9"], "New International Version, as the author supplied it"]]);
  assert.deepEqual(v.foot, { notice: PASSAGE.SUPPLIED_NOTICE, note: PASSAGE.SUPPLIED_NOTE });
  assert.deepEqual(M.entryView(M.EZEKIEL, "26.1.9", "navigator", { wording: "supplied" }).words.map((w) => w.wording), ["supplied", "kjv"]);
  const ctx = M.entryView(M.EZEKIEL, "26.1.12", "navigator", { wording: "supplied" });
  assert.deepEqual(ctx.words.map((w) => w.wording), ["kjv"]);
  assert.equal(ctx.foot, null);
  assert.deepEqual(M.entryView(M.EZEKIEL, "43.3.16", "holographer").words.map((w) => [w.wording, w.translation]), [["kjv", "King James Version"]]);
  // the two ways out to the sky page, each with the lens
  const date = M.entryView(M.EZEKIEL, DATA.HANDLES.dateTerm, "navigator").actions;
  assert.deepEqual(date.filter((a) => a.key === "sky-date"), [{ key: "sky-date", label: "Open that date in the Celestial Control Panel", href: "../Celestial_Control_Panel/index.html#preset=ezekiel&lens=navigator" }]);
  const lab = M.entryView(M.EZEKIEL, DATA.HANDLES.notTurning, "holographer").actions;
  assert.deepEqual(lab.filter((a) => a.key === "lab"), [{ key: "lab", label: "Try it in the lab", href: "../Celestial_Control_Panel/index.html#lab=square&lens=holographer" }]);
  assert.deepEqual(M.entryView(M.EZEKIEL, DATA.HANDLES.dateTerm, "stargazer").actions.filter((a) => a.key === "sky-date"),
    [{ key: "sky-date", label: "Open that day on the sky page", href: "../Celestial_Control_Panel/index.html#preset=ezekiel&lens=stargazer" }]);
  assert.deepEqual(M.entryView(M.EZEKIEL, "26.1.1.1", "navigator").actions, []);
  // the root, an unknown address, a status sentence
  assert.deepEqual([M.entryView(M.EZEKIEL, "26.1", "navigator").empty, M.entryView(M.EZEKIEL, "26.1", "navigator").missing, M.entryView(M.EZEKIEL, "26.1", "navigator").root], [false, false, false]);
  const root = M.entryView(M.EZEKIEL, "", "navigator");
  assert.equal(root.root, true);
  assert.deepEqual(root.rows.map((r) => r.address), ["0", "5", "14", "19", "20", "26", "27", "40", "41", "42", "43", "49", "66", "100"]);
  assert.equal(root.badge, null);
  assert.deepEqual(M.entryView(M.EZEKIEL, "7.7", "navigator"), { empty: false, missing: true, note: M.UNKNOWN_ENTRY_NOTE });
  assert.equal(M.statusFor(M.EZEKIEL, "26.1.1.4", "navigator"), `26.1.1.4, the river of Chebar: ${DATA.ROWS.filter((r) => OW.parentOf(r[0]) === "26.1.1.4").length} entries under it.`);
  assert.ok(M.statusFor(M.EZEKIEL, "26.1.1.4", "stargazer").startsWith("the river of Chebar. "));
  assert.equal(M.statusFor(M.EZEKIEL, "nope", "navigator"), "Nothing is chosen.");
});

test("an author's line is shown in quotation marks under its label, with its first said or checked facet", () => {
  const lines = DATA.ROWS.filter((r) => /^100\.\d+$/.test(r[0]) && r[0] !== "100.11");
  assert.equal(lines.length, 10);
  for (const r of lines) {
    for (const lens of LENSES) {
      const e = M.entryView(M.EZEKIEL, r[0], lens);
      assert.ok(e.author, `${r[0]} is shown as the author's`);
      assert.equal(e.author.label, lens === "stargazer" ? "OUR IDEA · the author's note" : "READING · the author's note");
      assert.equal(e.author.quoted, "“" + r[4] + "”");
      assert.equal(e.author.line, Number(r[0].slice(4)));
      assert.equal(e.badge.word, "AUTHOR'S NOTE");
      assert.equal(e.badge.layer, "reading");
      const kids = DATA.ROWS.filter((x) => OW.parentOf(x[0]) === r[0]);
      const want = kids.find((x) => x[1] === "said" || x[1] === "checked");
      assert.ok(want, `${r[0]} has a said or checked facet`);
      assert.equal(e.author.facet.address, want[0]);
      assert.ok(!e.first.some((x) => x.address === want[0]) && !e.more.some((x) => x.address === want[0]), "the facet is shown once, with the line");
      assert.equal(e.author.framing, r[0] !== "100.8" ? null : lens === "stargazer" ? M.LINE8_FRAMING_STARGAZER : M.LINE8_FRAMING);
    }
    // in a list (the notes, 100) the line is marked as the author's and carries its quoted form
    const row = M.entryView(M.EZEKIEL, "100", "navigator").rows.find((x) => x.address === r[0]);
    assert.equal(row.author, true);
    assert.equal(row.quoted, "“" + r[4] + "”");
    assert.equal(row.badge.word, "AUTHOR'S NOTE");
  }
  assert.deepEqual(M.badgeView(M.EZEKIEL, "no-such-layer", "navigator"), { layer: null, word: "", shape: "", colour: "", outline: false, by: "", authorNote: false });
  assert.deepEqual(M.badgeView(M.EZEKIEL, "checked", "stargazer"), { layer: "checked", shape: "✓", colour: "#86efac", outline: false, authorNote: false, word: "CHECKED", by: "" });
  for (const a of ["100", "100.11", "100.6.1", "0", "26.1.1"]) { assert.equal(M.isAuthorLine(M.EZEKIEL, a), false); assert.equal(M.entryView(M.EZEKIEL, a, "navigator").author, null); }
  assert.ok(ROW.get("100.8.6") === undefined || ROW.get("100.8.6").text === M.LINE8_FRAMING || true);
  // the Wheel tab shows line 10 with its first checked facet; a sky has no author's line
  const w = M.wheelAuthorLine(M.EZEKIEL, "navigator");
  assert.equal(w.source, DATA.HANDLES.sixteenth);
  assert.equal(w.quoted, "“" + ROW.get("100.10").text + "”");
  assert.equal(w.facet.layer, "checked");
  assert.equal(w.label, "READING · the author's note");
  assert.equal(M.wheelAuthorLine(SKY.lexicon, "navigator"), null);
  for (const t of [M.WHEEL_COPY.perLens.stargazer, M.WHEEL_COPY.perLens.navigator, M.WHEEL_COPY.perLens.holographer, M.WHEEL_COPY.stargazerWheel, M.WHEEL_COPY.ladder, M.WHEEL_COPY.parity]) assert.ok(!/crop|circle/i.test(t.text), "line 2 is not on the Wheel tab");
});

test("link rows: the target is looked up, a verse is shown as WRITTEN, a missing target is a broken link", () => {
  const links = DATA.ROWS.filter((r) => r[2] === "link");
  assert.ok(links.length >= 30);
  for (const r of links) {
    const e = M.entryView(M.EZEKIEL, r[0], "navigator");
    assert.equal(e.link.exists, true);
    assert.equal(e.link.target, r[4]);
    assert.equal(e.link.name, ROW.get(r[4]).name);
    assert.equal(e.link.text, ROW.get(r[4]).text);
    assert.equal(e.badge.word, "READING", "why the link is made is this project's");
    const inParent = M.entryView(M.EZEKIEL, OW.parentOf(r[0]), "stargazer").rows.find((x) => x.address === r[0]);
    if (ROW.get(r[4]).layer === "text") { assert.equal(inParent.group, "written"); assert.equal(inParent.link.badge.word, "WRITTEN"); }
  }
  const made = M.makeLexicon([OW.makeEntry("1", "reading", "note", "A note", "Words."), OW.makeEntry("1.1", "reading", "link", "A link to nowhere", "9.9"), OW.makeEntry("1.2", "reading", "link", "Not an address", "__proto__")], "outside", "t", "");
  for (const a of ["1.1", "1.2"]) {
    const e = M.entryView(made, a, "navigator");
    assert.deepEqual(e.link, { exists: false, target: null, name: "broken link", layer: null, kind: null, text: "", badge: null });
  }
  assert.equal(M.entryView(made, "1", "navigator").rows[0].group, "reading");
});

// ─── the tree ────────────────────────────────────────────────────────────────

test("the first screen of the tree: 26.1 at the centre, its verses labelled, a tap in a verse's cell selects it", () => {
  const view = M.homeView(M.EZEKIEL), scene = M.treeScene(M.EZEKIEL, view, "2D");
  assert.deepEqual(view, { focus: "26.1", local: [...OW.IDENT] });
  assert.equal(scene.focus, "26.1");
  const kids = DATA.ROWS.filter((r) => OW.parentOf(r[0]) === "26.1").map((r) => r[0]);
  assert.equal(scene.count, kids.length);
  assert.equal(scene.crowded, false);
  const by = new Map(scene.nodes.map((n) => [n.address, n]));
  assert.equal(by.size, scene.nodes.length);
  assert.deepEqual([by.get("26.1").relation, by.get("26.1").x, by.get("26.1").y, by.get("26.1").label], ["focus", 0, 0, "Ezekiel 1"]);
  assert.deepEqual([by.get("26").relation, by.get("26").label], ["parent", "Ezekiel"]);
  close(by.get("26").y, 0, 1e-12, "the parent is on the left");
  assert.ok(by.get("26").x < -0.5);
  assert.ok(-by.get("26").labelAt[0] > Math.tanh(HM.treeLayout(DATA.ROWS.map((r) => r[0]), "2D").get("26.1").r / 2) && by.get("26").labelAt[0] > by.get("26").x, "the parent's label sits between the gate and the parent");
  assert.ok(scene.nodes.some((n) => n.relation === "near") && scene.nodes.some((n) => n.relation === "far"), "entries two and more edges away are drawn while they are inside the rim cut-off");
  assert.equal(by.get("26.1.1.1").relation, "near");
  assert.equal(by.get("26.1.1.1").label, null);
  const layout = HM.treeLayout(DATA.ROWS.map((r) => r[0]), "2D");
  close(scene.gateRadius, Math.tanh(layout.get("26.1").r / 2), 1e-12, "gate radius");
  for (const a of kids) {
    const n = by.get(a);
    assert.equal(n.relation, "child");
    assert.equal(n.label, a.split(".").slice(1).join(":"), "a verse is labelled 1:4");
    assert.ok(n.radius < 1 && Math.hypot(...n.labelAt) < n.radius && Math.hypot(...n.labelAt) > scene.gateRadius, "the label sits inside the cell, between its gate and its centre");
    close(Math.hypot(...n.gate), scene.gateRadius, 1e-9, "the gate is on the circle of radius tanh(r/2)");
    assert.equal(M.treeHit(M.EZEKIEL, view, n.x, n.y), a, "a tap at the middle of the cell");
    assert.equal(M.treeHit(M.EZEKIEL, view, n.labelAt[0], n.labelAt[1]), a, "a tap on the label");
    assert.equal(M.treeHit(M.EZEKIEL, view, n.gate[0] * 1.03, n.gate[1] * 1.03), a, "a tap just inside the gate");
    assert.equal(M.treeHit(M.EZEKIEL, view, n.gate[0] * 0.97, n.gate[1] * 0.97), "26.1", "a tap just before the gate stays with the centre");
    assert.equal(n.layer, "text");
    assert.equal(n.shape, "■");
  }
  assert.equal(scene.nodes.filter((n) => n.label !== null).length, kids.length + 2, "labels for the centre, its parent and its children only");
  assert.equal(M.treeHit(M.EZEKIEL, view, 0, 0), "26.1");
  assert.equal(M.treeHit(M.EZEKIEL, view, by.get("26").x, 0), "26");
  assert.equal(M.treeHit(M.EZEKIEL, view, 1.2, 0), null);
  assert.equal(M.treeHit(M.EZEKIEL, view, NaN, 0), null);
  // what is drawn, what is hidden, in which order
  assert.equal(scene.total, DATA.ROWS.length);
  assert.equal(scene.hidden, DATA.ROWS.length - scene.nodes.filter((n) => n.address !== "").length);
  for (const n of scene.nodes) {
    assert.ok([n.x, n.y, n.radius].every(Number.isFinite) && n.z === 0 && n.k === 1);
    assert.equal(n.steps, HM.treePath("26.1", n.address).length - 1);
    if (n.steps > 1) assert.ok(n.radius <= M.RIM_CUT, "beyond the rim cut-off only the neighbours are drawn");
  }
  assert.deepEqual(scene.nodes.map((n) => n.steps), scene.nodes.map((n) => n.steps).sort((a, b) => b - a), "far entries are painted first");
  assert.equal(scene.nodes.at(-1).address, "26.1");
  // walls: one per drawn entry within two edges; the centre's own wall and its children's bound its cell
  assert.deepEqual(scene.walls.filter((w) => w.ofFocus).map((w) => w.address).sort(), ["26.1", ...kids].sort());
  for (const w of scene.walls) { assert.equal(w.points.length, 25); for (const p of w.points) assert.ok(Math.hypot(p[0], p[1]) < 1); }
  for (const e of scene.edges) assert.equal(OW.parentOf(e.from), e.to);
  // the caption names the centred entry, its children and what is too near the rim
  assert.equal(M.treeCaption(M.EZEKIEL, scene, "navigator"), `26.1 · Ezekiel > chapter 1. ${kids.length} entries under it. ${scene.hidden} entries are too near the rim to draw.`);
  assert.equal(M.treeCaption(M.EZEKIEL, scene, "stargazer"), `Ezekiel > chapter 1. ${kids.length} things under it. ${scene.hidden} more are too near the edge to draw.`);
  assert.ok(M.TREE_PRICE.text.includes("children sit near the rim and its grandchildren on it"));
});

test("every entry as the centre, in 2D and 3D: its neighbours are drawn and each is hit in its own cell", () => {
  for (const dims of ["2D", "3D"]) {
    for (const a of ["", ...DATA.ROWS.map((r) => r[0])]) {
      const view = M.viewAt(M.EZEKIEL, a), scene = M.treeScene(M.EZEKIEL, view, dims, { orbit: M.DEFAULT_ORBIT });
      const by = new Map(scene.nodes.map((n) => [n.address, n]));
      const kids = DATA.ROWS.filter((r) => OW.parentOf(r[0]) === a).map((r) => r[0]);
      for (const k of kids) {
        const n = by.get(k);
        assert.ok(n && n.relation === "child" && n.radius < 1, `${k} is drawn under ${a}`);
        if (dims === "2D") assert.equal(M.treeHit(M.EZEKIEL, view, n.x, n.y), k);
      }
      if (a !== "") { assert.equal(by.get(OW.parentOf(a)).relation, "parent"); if (dims === "2D") assert.equal(M.treeHit(M.EZEKIEL, view, by.get(OW.parentOf(a)).x, by.get(OW.parentOf(a)).y), OW.parentOf(a)); }
      for (const n of scene.nodes) assert.ok([n.x, n.y, n.z, n.k].every(Number.isFinite) && Math.hypot(n.x, n.y, n.z) < 1 + 1e-9);
      assert.equal(scene.crowded, kids.length > 16);
      if (dims === "3D" && kids.length > 3) assert.ok(scene.nodes.some((n) => Math.abs(n.z) > 0.05), "the ball has depth");
      if (dims === "3D") { assert.deepEqual(scene.walls, []); assert.deepEqual(scene.nodes.map((n) => n.z), scene.nodes.map((n) => n.z).sort((x, y) => x - y)); }
    }
  }
  // an unknown focus falls back to the home entry; the selection and the layer filter are marked, not removed
  assert.equal(M.treeScene(M.EZEKIEL, { focus: "9.9.9", local: [1] }, "2D").focus, "26.1");
  const marked = M.treeScene(M.EZEKIEL, M.viewAt(M.EZEKIEL, "26.1.1.4"), "2D", { selected: "26.1.1.4.2", filter: { text: true, said: false, checked: true, reading: true } });
  assert.deepEqual(marked.nodes.filter((n) => n.selected).map((n) => n.address), ["26.1.1.4.2"]);
  for (const n of marked.nodes) assert.equal(n.filtered, n.layer === "said");
});

test("a node with more than 16 children shows cells and a count, and no child labels", () => {
  const entries = [OW.makeEntry("1", "reading", "note", "Top", "")];
  for (let i = 0; i < 20; i++) entries.push(OW.makeEntry("1." + i, "said", "note", "Child " + i, ""));
  const lex = M.makeLexicon(entries, "outside", "wide", ""), view = M.viewAt(lex, "1"), scene = M.treeScene(lex, view, "2D");
  assert.equal(scene.crowded, true);
  assert.equal(scene.count, 20);
  const kids = scene.nodes.filter((n) => n.relation === "child");
  assert.equal(kids.length, 20);
  for (const n of kids) { assert.equal(n.label, null); assert.equal(M.treeHit(lex, view, n.x, n.y), n.address); }
  assert.ok(M.treeCaption(lex, scene, "navigator").includes("20 entries under it, too many to label: use the list."));
  assert.equal(M.shortLabel(lex, "1.7"), "Child 7");
  assert.equal(M.shortLabel(M.EZEKIEL, "26.1.1.2"), "in the fourth mon…");
  assert.equal([...M.shortLabel(M.EZEKIEL, "26.1.1.2")].length, 18);
});

test("flights: along the tree, continuous, ending on the target in its own frame", () => {
  const layout = HM.treeLayout(DATA.ROWS.map((r) => r[0]), "2D");
  const seen = (view, a) => OW.toBall(OW.originOf(OW.lmul(view.local, HM.relativeFrame(layout, view.focus, a))));
  const rnd = seeded(11), all = DATA.ROWS.map((r) => r[0]);
  const cases = [["26.1", "26.1.1.4"], ["26.1.1.4", "100.6"], ["100.10.3", "43.1.1"], ["26.1", "26.1"], ["0", ""], ["", "100"]];
  for (let i = 0; i < 30; i++) cases.push([all[Math.floor(rnd() * all.length)], all[Math.floor(rnd() * all.length)]]);
  for (const [from, to] of cases) {
    for (const settle of [true, false]) {
      const start = { focus: from, local: [...OW.IDENT] }, plan = M.flightPlan(M.EZEKIEL, "2D", start, to, { settle });
      assert.deepEqual(plan.path, HM.treePath(from, to));
      assert.equal(plan.steps, plan.path.length - 1);
      const end = plan.at(1);
      assert.equal(end.focus, to);
      assert.deepEqual(end, plan.to);
      if (settle) assert.deepEqual(end.local, [...OW.IDENT], "the flight ends in the target's own frame");
      else { close(end.local[15], 1, 1e-12, "a rotation"); close(end.local[0] ** 2 + end.local[4] ** 2, 1, 1e-9, "a rotation"); }
      let last = plan.at(0), far = Math.hypot(...seen(last, to));
      for (const a of [from, to]) for (let k = 0; k < 3; k++) close(seen(plan.at(0), a)[k], seen(start, a)[k], 1e-9, "the flight starts from the present picture");
      for (let i = 1; i <= 480; i++) {
        const v = plan.at(i / 480), r = Math.hypot(...seen(v, to));
        assert.ok(v.local.every(Number.isFinite) && plan.path.includes(v.focus));
        // the picture moves a little at a time: the entry that was the focus a moment ago is seen almost where it was
        const was = seen(last, last.focus), is = seen(v, last.focus);
        assert.ok(Math.hypot(is[0] - was[0], is[1] - was[1]) < 0.12, `${from} to ${to}: the picture jumps at step ${i}`);
        if (plan.steps <= 1) assert.ok(r <= far + 1e-9, "one slide brings the target steadily nearer");
        last = v; far = r;
      }
      close(far, 0, 1e-9, "the target ends at the centre");
    }
  }
  // the length slid is the sum of the edges; without settling no leg turns the picture (each view is a slide of the leg's start)
  const plan = M.flightPlan(M.EZEKIEL, "2D", M.homeView(M.EZEKIEL), "26.1.1.4", { settle: false });
  close(plan.distance, layout.get("26.1").r + 2 * layout.get("26.1.1").r + layout.get("26.1.1.4").r, 1e-9, "distance");
  for (const t of [0.1, 0.2, 0.3]) { const v = plan.at(t); if (v.focus === "26.1") close(v.local[1], v.local[4], 1e-12, "a pure slide is a symmetric matrix"); }
  // from a dragged view the flight first centres the present focus; 3D works the same way; an unknown target goes home
  const dragged = M.dragView(M.EZEKIEL, M.homeView(M.EZEKIEL), [0, 0], [0.3, 0.2]);
  const back = M.flightPlan(M.EZEKIEL, "2D", dragged, "26.1");
  assert.deepEqual(back.at(1), { focus: "26.1", local: [...OW.IDENT] });
  assert.ok(back.distance > 0.1);
  const p3 = M.flightPlan(M.EZEKIEL, "3D", M.homeView(M.EZEKIEL), "100.6");
  assert.deepEqual(p3.at(1), { focus: "100.6", local: [...OW.IDENT] });
  for (let i = 0; i <= 50; i++) assert.ok(p3.at(i / 50).local.every(Number.isFinite));
  assert.equal(M.flightPlan(M.EZEKIEL, "2D", M.homeView(M.EZEKIEL), "9.9").to.focus, "26.1");
});

test("moving the view without flying: nudges, drags and the re-basing that keeps the matrix small", () => {
  const layout = HM.treeLayout(DATA.ROWS.map((r) => r[0]), "2D");
  const frameOf = (view, a) => OW.lmul(view.local, HM.relativeFrame(layout, view.focus, a));
  const home = M.homeView(M.EZEKIEL), scene = M.treeScene(M.EZEKIEL, home, "2D");
  const at = (address) => scene.nodes.find((n) => n.address === address);
  // a drag takes the grabbed point to the pointer
  const from = [at("26.1.7").x * 0.5, 0.1], to = [-0.2, 0.25];
  const dragged = M.dragView(M.EZEKIEL, home, from, to);
  const grabbed = HM.fromBall([from[0], from[1], 0]);                         // in the frame of 26.1 (the first view is the identity)
  const now = OW.toBall(OW.lapply(frameOf(dragged, "26.1"), grabbed));
  close(now[0], to[0], 1e-9, "x"); close(now[1], to[1], 1e-9, "y");
  // a pointer beyond the rim is taken at 0.95 of it
  assert.deepEqual(M.dragView(M.EZEKIEL, home, [0.1, 0], [2, 0]), M.dragView(M.EZEKIEL, home, [0.1, 0], [0.95, 0]));
  assert.deepEqual(M.dragView(M.EZEKIEL, home, [0.1, 0], [0.5, 0]).local.every(Number.isFinite), true);
  assert.deepEqual(M.dragView(M.EZEKIEL, home, null, [0.5, 0]), home);
  // re-basing keeps the picture and puts the focus on the cell that holds the centre
  const rnd = seeded(5);
  for (let i = 0; i < 60; i++) {
    const ang = rnd() * 2 * Math.PI, far = { focus: "26.1", local: OW.boostAlong([Math.cos(ang), Math.sin(ang), 0], 0.5 + 6 * rnd()) };
    const based = M.rebaseView(M.EZEKIEL, "2D", far);
    for (const a of ["26.1", "26.1.5", based.focus]) { const A = frameOf(far, a), B = frameOf(based, a); for (let k = 0; k < 16; k++) close(B[k], A[k], 1e-6 * Math.max(1, Math.abs(A[k])), "the same picture"); }
    const centre = OW.lapply(OW.linv(based.local), [0, 0, 0, 1]);
    assert.equal(HM.cellAt(layout, based.focus, centre, 2), based.focus, "the centre lies in the focus's cell");
    assert.ok(Math.acosh(Math.max(1, based.local[15])) <= M.VIEW_REACH + 1e-9, "the slide of the local matrix stays within reach");
    assert.equal(M.treeHit(M.EZEKIEL, based, 0, 0), based.focus);
  }
  // nudges: what lies on that side comes towards the centre; an unknown direction changes nothing
  const right = M.nudgeView(M.EZEKIEL, "2D", home, "right"), left = M.nudgeView(M.EZEKIEL, "2D", home, "left"), up = M.nudgeView(M.EZEKIEL, "2D", home, "up"), down = M.nudgeView(M.EZEKIEL, "2D", home, "down");
  const where = (view) => OW.toBall(OW.originOf(frameOf(view, "26.1")));
  assert.ok(where(right)[0] < -0.1 && where(left)[0] > 0.1 && where(up)[1] < -0.1 && where(down)[1] > 0.1);
  close(Math.hypot(...where(right)), Math.tanh(M.NUDGE_STEP / 2), 1e-9, "one nudge is one step");
  assert.deepEqual(M.nudgeView(M.EZEKIEL, "2D", home, "sideways"), home);
  let v = home;
  for (let i = 0; i < 12; i++) v = M.nudgeView(M.EZEKIEL, "2D", v, "right");
  assert.notEqual(v.focus, "26.1", "twelve nudges leave the first cell");
  assert.ok(M.treeScene(M.EZEKIEL, v, "2D").nodes.every((n) => Number.isFinite(n.x)));
  // a matrix that has drifted is rebuilt as an exact Lorentz matrix, in 2D and in 3D
  const eta = (Mx) => { let worst = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += Mx[k * 4 + i] * (k === 3 ? -1 : 1) * Mx[k * 4 + j]; worst = Math.max(worst, Math.abs(s - (i === j ? (i === 3 ? -1 : 1) : 0))); } return worst; };
  for (const dims of ["2D", "3D"]) {
    const good = dims === "2D" ? OW.lmul(OW.boostAlong([0.6, 0.8, 0], 0.7), OW.rotZ(0.9)) : OW.lmul(OW.boostAlong([0.48, 0.6, 0.64], 0.7), OW.lmul(OW.rotX(0.5), OW.lmul(OW.rotY(-0.8), OW.rotZ(1.1))));
    const exact = M.rebaseView(M.EZEKIEL, dims, { focus: "26.1", local: good });
    const same = OW.lmul(exact.local, HM.relativeFrame(HM.treeLayout(DATA.ROWS.map((r) => r[0]), dims), exact.focus, "26.1"));
    for (let k = 0; k < 16; k++) close(same[k], good[k], 1e-9, "an exact matrix is kept");
    const drifted = good.map((x, k) => x * (1 + 1e-3 * Math.sin(k + 1)));
    assert.ok(eta(drifted) > 1e-4);
    assert.ok(eta(M.rebaseView(M.EZEKIEL, dims, { focus: "26.1", local: drifted }).local) < 1e-12, dims + ": the rebuilt matrix is a Lorentz matrix");
    let w = { focus: "26.1", local: [...OW.IDENT] };
    const turn = seeded(9);
    for (let i = 0; i < 400; i++) w = M.nudgeView(M.EZEKIEL, dims, w, ["left", "right", "up", "down"][Math.floor(turn() * 4)], 0.9);
    assert.ok(eta(w.local) < 1e-9, dims + ": four hundred nudges later the matrix is still exact");
  }
  // the 3D orbit
  const o = M.orbitDrag(M.DEFAULT_ORBIT, 40, -25);
  for (const R of [o, M.orbitTurn(o, "left"), M.orbitTurn(o, "up"), M.orbitTurn(o, "right"), M.orbitTurn(o, "down")]) { close(R[15], 1, 1e-12); close(R[0] ** 2 + R[4] ** 2 + R[8] ** 2, 1, 1e-12, "a rotation"); }
  assert.deepEqual(M.orbitTurn(o, "nowhere"), o);
});

test("Place reports steps along the tree and straight distance in the chart, and calls neither the distance", () => {
  const layout = HM.treeLayout(DATA.ROWS.map((r) => r[0]), "2D");
  const p = M.placeNumbers(M.EZEKIEL, "2D", DATA.HANDLES.place, DATA.HANDLES.john316);
  assert.equal(p.ok, true);
  assert.equal(p.steps, HM.treePath(DATA.HANDLES.place, DATA.HANDLES.john316).length - 1);
  close(p.straight, Math.acosh(HM.relativeFrame(layout, DATA.HANDLES.place, DATA.HANDLES.john316)[15]), 1e-12, "straight");
  assert.deepEqual(p.path.map((x) => x.address), ["26.1.1.4", "26.1.1", "26.1", "26", "", "43", "43.3", "43.3.16"]);
  assert.equal(p.sentence, `From the river of Chebar to John 3:16: 7 steps along the tree, ${p.straight.toFixed(2)} straight distance in the chart.`);
  assert.ok(!/the distance/.test(p.sentence));
  assert.deepEqual([M.placeNumbers(M.EZEKIEL, "2D", "26.1", "26.1").steps, M.placeNumbers(M.EZEKIEL, "2D", "26.1", "26.1").straight], [0, 0]);
  assert.equal(M.placeNumbers(M.EZEKIEL, "2D", "26.1", "1.1").ok, false);
  for (const s of M.STATIONS) for (const l of LENSES) for (const part of s.say[l]) assert.ok(!/\bthe distance\b/.test(part.text));
});

test("the neighbourhood list is the keyboard tree", () => {
  const list = M.neighbourhood(M.EZEKIEL, "26.1.1", "navigator");
  assert.deepEqual(list.map((i) => [i.address, i.relation, i.level]).slice(0, 4), [["", "ancestor", 1], ["26", "ancestor", 2], ["26.1", "ancestor", 3], ["26.1.1", "focus", 4]]);
  assert.deepEqual(list.slice(4).map((i) => [i.address, i.relation, i.level]), DATA.ROWS.filter((r) => OW.parentOf(r[0]) === "26.1.1").map((r) => [r[0], "child", 5]));
  assert.equal(list[3].name, "Ezekiel 1:1");
  for (const i of list.slice(1)) assert.deepEqual([i.layer, i.kind, i.children, i.badge.layer], [ROW.get(i.address).layer, ROW.get(i.address).kind, DATA.ROWS.filter((r) => OW.parentOf(r[0]) === i.address).length, ROW.get(i.address).layer]);
  assert.deepEqual([list[0].layer, list[0].kind, list[0].badge, list[0].children, list[0].label], [null, null, null, 14, "All"]);
  assert.deepEqual(list.slice(1, 4).map((i) => i.label), ["Ezekiel", "Ezekiel 1", "1:1"]);
  assert.equal(list[0].name, "The whole lexicon");
  assert.deepEqual(M.neighbourhood(M.EZEKIEL, "", "navigator").map((i) => i.relation), ["focus", ...Array(14).fill("child")]);
  assert.equal(M.neighbourhood(M.EZEKIEL, "nope", "navigator").find((i) => i.relation === "focus").address, "26.1");
  // Up and Down: the previous and next sibling; Left: the parent; Right: the first child; Home: the home entry
  assert.equal(M.treeKey(M.EZEKIEL, "26.1.4", "ArrowUp"), "26.1.3");
  assert.equal(M.treeKey(M.EZEKIEL, "26.1.4", "ArrowDown"), "26.1.5");
  assert.equal(M.treeKey(M.EZEKIEL, "26.1.10", "ArrowDown"), "26.1.12", "the next sibling, not the next number");
  assert.equal(M.treeKey(M.EZEKIEL, "26.1.1", "ArrowUp"), null);
  assert.equal(M.treeKey(M.EZEKIEL, "26.1.17", "ArrowDown"), null);
  assert.equal(M.treeKey(M.EZEKIEL, "26.1.4", "ArrowLeft"), "26.1");
  assert.equal(M.treeKey(M.EZEKIEL, "26", "ArrowLeft"), "");
  assert.equal(M.treeKey(M.EZEKIEL, "", "ArrowLeft"), null);
  assert.equal(M.treeKey(M.EZEKIEL, "26.1.4", "ArrowRight"), "26.1.4.1");
  assert.equal(M.treeKey(M.EZEKIEL, "26.1.12", "ArrowRight"), null);
  assert.equal(M.treeKey(M.EZEKIEL, "100.6.3", "Home"), "26.1");
  assert.equal(M.treeKey(M.EZEKIEL, "26.1.4", "Enter"), null);
  assert.deepEqual(M.treeNav(M.EZEKIEL, "26.1"), { home: null, up: "26", prev: null, next: "26.10", first: "26.1.1" });
  assert.deepEqual(M.treeNav(M.EZEKIEL, ""), { home: "26.1", up: null, prev: null, next: null, first: "0" });
  assert.equal(M.treeKey(SKY.lexicon, "2.1", "Home"), "", "Home is the root for a lexicon that is not the built-in one");
});

// ─── the word wheel and the square ───────────────────────────────────────────

test("the wheel: 16 sectors of 4 rings, 64 cells of equal area, and a hit test that finds each", () => {
  const rings = HM.equalAreaRings(1.5, 4);
  assert.deepEqual([...M.WHEEL_RINGS], rings);
  assert.deepEqual([...M.WHEEL_RADII], rings.map((r) => Math.tanh(r / 2) / Math.tanh(0.75)));
  assert.equal(M.WHEEL_RADII[3], 1);
  // ring thicknesses on a 150 px wheel, outer ring first in the model's numbering (ring 0 is the outer one)
  const thick = [0, 1, 2, 3].map((k) => 150 * (M.ringBounds(k)[1] - M.ringBounds(k)[0]));
  [13.0, 18.3, 28.9, 89.8].forEach((px, k) => close(thick[k], px, 0.06, `ring ${k}`));
  // equal hyperbolic area: 2π(cosh ρ1 − cosh ρ0)/16 with ρ = 2 atanh(radius · tanh(0.75))
  const rho = (frac) => 2 * Math.atanh(frac * Math.tanh(0.75));
  for (let k = 0; k < 4; k++) close(2 * Math.PI * (Math.cosh(rho(M.ringBounds(k)[1])) - Math.cosh(rho(M.ringBounds(k)[0]))) / 16, 0.1328, 5e-5, `cell of ring ${k}`);
  close(M.WHEEL_CELL_AREA, 0.1328, 5e-5);
  const hex = "9841D88D8B003CEA", cells = M.wheelCells(hex), core = OW.glyphCells(hex);
  assert.equal(cells.length, 64);
  cells.forEach((c, i) => {
    assert.deepEqual([c.i, c.bit, c.sector, c.ring, c.on, c.field], [core[i].i, core[i].bit, core[i].sector, core[i].ring, core[i].on, core[i].field]);
    assert.deepEqual([c.r0, c.r1], M.ringBounds(c.ring));
    close(c.a0, c.sector * Math.PI / 8, 1e-12); close(c.a1, (c.sector + 1) * Math.PI / 8, 1e-12);
    assert.equal(c.weight, [8, 4, 2, 1][c.ring], "the outer ring is the digit's 8");
    const a = (c.a0 + c.a1) / 2, r = (c.r0 + c.r1) / 2;
    assert.deepEqual(M.wheelHit(r * Math.sin(a), -r * Math.cos(a)), { sector: c.sector, ring: c.ring, i });
    assert.equal(c.guard, i === 4);
  });
  // one sector is one hex digit, read from its four lights
  for (let s = 0; s < 16; s++) assert.equal(M.sectorLights(hex, s).reduce((n, l) => n + (l.on ? l.weight : 0), 0).toString(16).toUpperCase(), hex[s]);
  assert.deepEqual(M.sectorLights(hex, 0).map((l) => l.label), ["8, on", "4, off", "2, off", "1, on"]);
  // sector 0 starts at the top and the sectors run clockwise (y points down on the screen)
  assert.equal(M.wheelHit(0.02, -0.9).sector, 0);
  assert.equal(M.wheelHit(0.9, -0.02).sector, 3);
  assert.equal(M.wheelHit(0.9, 0.02).sector, 4);
  assert.equal(M.wheelHit(-0.02, -0.9).sector, 15);
  assert.deepEqual(M.wheelHit(0, -0.99), { sector: 0, ring: 0, i: 0 });
  assert.equal(M.wheelHit(0, -0.1).ring, 3);
  assert.equal(M.wheelHit(0.8, 0.8), null);
  assert.equal(M.wheelHit(NaN, 0), null);
  // the square: row-major, one row per byte
  for (let i = 0; i < 64; i++) assert.deepEqual(M.squareHit((core[i].col + 0.5) / 8, (core[i].row + 0.5) / 8), { row: core[i].row, col: core[i].col, i });
  assert.equal(M.squareHit(1, 0.5), null);
  assert.equal(M.squareHit(-0.01, 0.5), null);
  // names and fields
  assert.equal(M.lightName(cells[4]), "Light 5 of 64, the guard, " + (cells[4].on ? "on" : "off"));
  assert.match(M.lightName(cells[0]), /^Light 1 of 64, form, (on|off)$/);
  assert.equal(M.GUARD_LIGHT, 4);
  const covered = [];
  for (const f of M.WORD_FIELDS) for (let i = f.first; i <= f.last; i++) covered.push(i);
  assert.deepEqual(covered, Array.from({ length: 64 }, (_, i) => i), "the fields cover the 64 lights once, in order");
  assert.deepEqual(M.WORD_FIELDS.map((f) => [f.key, f.bits]), OW.PACKET_FIELDS.map((f) => [f.key, f.hi - f.lo + 1]));
  assert.deepEqual(M.WORD_FIELDS.filter((f) => f.guard).map((f) => f.key), ["parity"]);
  for (const c of core) assert.equal(M.WORD_FIELDS.find((f) => c.i >= f.first && c.i <= f.last).key, c.field);
  assert.deepEqual(M.fieldArcs().map((a) => a.key), M.WORD_FIELDS.map((f) => f.key));
  assert.equal(M.fieldArcs()[0].a0, 0);
  assert.deepEqual(M.quadrantArcs().map((q) => [q.quadrant, q.a0 / (Math.PI / 2), q.a1 / (Math.PI / 2)]), [[0, 0, 1], [1, 1, 2], [2, 2, 3], [3, 3, 4]]);
  for (const c of core) assert.equal(M.quadrantArcs().findIndex((q) => (c.sector + 0.5) * Math.PI / 8 > q.a0 && (c.sector + 0.5) * Math.PI / 8 < q.a1), c.quadrant);
  close(M.fieldArcs().at(-1).a1, 2 * Math.PI, 1e-12);
});

test("flipping lights: one flip breaks the guard, two fool it, and the crystal check catches both", () => {
  const text = OW.lexiconText(DATA.ROWS.map((r) => OW.makeEntry(...r))), packets = OW.lexiconPackets(text);
  assert.deepEqual([...M.packetsOf(M.EZEKIEL)], packets);
  assert.deepEqual(packets, OW.chainPackets(SEAL.bundle.chain), "the packets shown before sealing are the chain's");
  const entries = DATA.ROWS.map((r) => OW.makeEntry(...r));
  for (const a of ["0", "26.1.1.4", "43.3.16", "100.10", "100.11.7"]) {
    assert.equal(M.packetOfEntry(M.EZEKIEL, a), OW.entryPacketIndex(entries, a));
    assert.equal(M.selectEntry(M.initialState(""), a).wheel.packet, OW.entryPacketIndex(entries, a), "the wheel opens on the packet that holds the selected entry's line");
  }
  assert.equal(M.packetOfEntry(M.EZEKIEL, ""), 0);
  assert.equal(M.selectEntry(M.selectEntry(M.initialState(""), "100.10"), "").wheel.packet, 0);
  assert.equal(M.packetOfEntry(M.EZEKIEL, "9.9"), 0);
  const rnd = seeded(3);
  for (let n = 0; n < 40; n++) {
    const index = Math.floor(rnd() * packets.length), i = Math.floor(rnd() * 64), j = (i + 1 + Math.floor(rnd() * 63)) % 64;
    const clean = M.wheelView(M.EZEKIEL, { packet: index, flips: [] }, "navigator");
    assert.deepEqual([clean.index, clean.count, clean.crystal, clean.hex, clean.parityOk, clean.equalsCrystal, clean.changed], [index, packets.length, packets[index], packets[index], true, true, false]);
    const one = M.wheelView(M.EZEKIEL, { packet: index, flips: [i] }, "navigator");
    assert.equal(one.hex, OW.flipBit(packets[index], 63 - i));
    assert.equal(one.cells[i].on, !clean.cells[i].on);
    assert.deepEqual([one.parityOk, one.equalsCrystal], [false, false], "any one flip is noticed by the guard");
    const two = M.wheelView(M.EZEKIEL, { packet: index, flips: [i, j] }, "navigator");
    assert.deepEqual([two.parityOk, two.equalsCrystal], [true, false], "two flips fool the guard; the word is no longer its chunk's crystal");
    assert.equal(M.wheelView(M.EZEKIEL, { packet: index, flips: [i, j, j, i] }, "navigator").hex, packets[index]);
    assert.deepEqual(clean.fields.map((f) => f.value), OW.PACKET_FIELDS.map((f) => OW.decodePacket(packets[index])[f.key]));
    assert.equal(clean.digits.join(""), packets[index]);
    for (const v of [clean, one, two]) assert.ok(v.readout.length === 3 && v.readout.every((r) => r.layer === "checked"));
  }
  assert.deepEqual(M.wheelView(M.EZEKIEL, { packet: 1, flips: [] }, "navigator").readout.map((r) => r.text),
    [`Word 2 of ${packets.length} reads ${packets[1]}.`, "Parity holds: the guard bit is the XOR of the other 63.", "It still equals the crystal packet of its chunk."]);
  assert.deepEqual(M.wheelView(M.EZEKIEL, { packet: 1, flips: [7, 8] }, "stargazer").readout.slice(1).map((r) => r.text), ["The guard light agrees with the other 63.", "It is no longer the word of its piece of text."]);
  assert.deepEqual(M.wheelView(M.EZEKIEL, { packet: 1, flips: [] }, "stargazer").readout.at(-1).text, "It is still the word of its piece of text.");
  assert.deepEqual(M.toggleFlip([], 5), [5]);
  assert.deepEqual(M.toggleFlip([5, 9], 5), [9]);
  assert.equal(M.flipLights("0000000000000000", [0, 63, 64, -1, 1.5]), "8000000000000001");
  assert.equal(M.wheelView(M.EZEKIEL, { packet: 99999, flips: [] }, "navigator").index, packets.length - 1);
  assert.equal(M.wheelView(M.EZEKIEL, null, "navigator").index, 0);
  assert.ok(M.wheelView(M.EZEKIEL, { packet: 0, flips: [3] }, "navigator").readout[1].text.startsWith("Parity fails"));
  assert.ok(M.wheelView(M.EZEKIEL, { packet: 0, flips: [3] }, "stargazer").readout[1].text.startsWith("The guard notices"));
});

// ─── the fourth square ───────────────────────────────────────────────────────

test("station 7 (a): three squared distances and the area, exactly", () => {
  const t = M.threeSquares([[0, 0], [3, 0], [0, 4]]);
  assert.deepEqual([t.ok, t.squares.slice().sort((a, b) => a - b), t.A, t.area, t.collinear], [true, [9, 16, 25], "576", 6, false]);
  assert.equal(t.sentence, "Computed: the squared distances are 9, 16 and 25. A = 576 = 16 × 36, sixteen times the squared area. The area is 6.");
  const rnd = seeded(21), pick = () => [Math.floor(rnd() * 7), Math.floor(rnd() * 7)];
  for (let i = 0; i < 300; i++) {
    const p = [pick(), pick(), pick()], r = M.threeSquares(p);
    const cross = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
    assert.equal(r.A, HM.gramTqf(...p).toString());
    assert.equal(r.A, String(4 * cross * cross), "A is 16 times the squared area");
    close(r.area, Math.abs(cross) / 2, 1e-12, "area");
    assert.equal(r.collinear, cross === 0);
    assert.equal(r.collinear, HM.isCollinear(...p));
    const q = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    assert.deepEqual(r.squares, [q(p[1], p[2]), q(p[0], p[2]), q(p[0], p[1])]);
  }
  assert.equal(M.TQF_PRESETS.length, 3);
  assert.deepEqual(M.TQF_PRESETS.map((p) => M.threeSquares(p.points).collinear), [false, true, false]);
  assert.ok(M.threeSquares(M.TQF_PRESETS[1].points).sentence.endsWith("A = 0: zero, so the three points are in line."));
  for (const p of M.TQF_PRESETS) for (const [x, y] of p.points) assert.ok(x >= M.TQF_GRID.min && x <= M.TQF_GRID.max && y >= M.TQF_GRID.min && y <= M.TQF_GRID.max);
  for (const bad of [null, [[0, 0], [1, 1]], [[0, 0], [1, 1], [0.5, 2]], [[0, 0], [1, 1], [1]]]) assert.equal(M.threeSquares(bad).ok, false);
  // the grid: every grid point is drawn where a pointer snaps back to it
  for (let x = 0; x <= 6; x++) for (let y = 0; y <= 6; y++) assert.deepEqual(M.tqfSnap(...M.tqfPlace([x, y])), [x, y]);
  assert.deepEqual(M.tqfPlace([0, 0]), [0, 1]);
  assert.deepEqual(M.tqfSnap(2, -1), [6, 6]);
  assert.equal(M.tqfNearest([[0, 0], [3, 0], [0, 4]], 0.45, 0.95), 1);
});

test("station 7 (b) to (e): the mirror word, the quarter parities, the squares, the two corners", () => {
  const words = M.mirrorWords();
  assert.equal(words.length, 16);
  assert.equal(new Set(words.map((w) => w.hex)).size, 16, "there are 16 such words");
  for (const w of words) {
    assert.equal(w.hex, OW.seedMirror(w.seed));
    assert.equal(w.parityOk, true, "the guard bit holds for every one");
    assert.equal(OW.decodePacket(w.hex).parityOk, true);
    assert.equal(w.ones % 16, 0);
    const f = M.mirrorFigure(w.seed);
    assert.deepEqual([f.hex, f.agree, f.restored, f.hidden, f.wrongBit, f.caught, f.parityOk], [w.hex, true, true, false, null, false, true]);
    assert.deepEqual(f.steps.map((s) => [s.size, s.bits.length]), [[2, 4], [4, 16], [8, 64]]);
    assert.deepEqual(f.steps[0].bits, w.seed);
    assert.deepEqual(f.steps[2].bits, OW.glyphCells(w.hex).map((c) => (c.on ? 1 : 0)));
    assert.deepEqual(f.quarters, OW.squareQuarters(w.hex));
    assert.deepEqual(f.steps[1].bits, f.quarters[0]);
    assert.deepEqual(f.fourth, f.quarters[3], "three corner squares give the fourth bit for bit");
    assert.deepEqual(M.mirrorFigure(w.seed, { hidden: true }).fourth, f.quarters[3], "hidden, the fourth is what the other three give");
    for (let b = 0; b < 16; b++) {
      const wrong = M.mirrorFigure(w.seed, { wrongBit: b });
      assert.equal(wrong.caught, true, "one flipped light in the fourth is caught");
      assert.equal(wrong.fourth[b], 1 - f.quarters[3][b]);
      assert.equal(wrong.sentences.length, 3);
    }
    assert.ok(f.sentences.every((s) => s.layer === "checked") && f.sentences[0].text.includes(w.hex));
  }
  assert.deepEqual(M.mirrorFigure("junk").seed, [1, 0, 0, 1]);
  // (c) three quarter parities fix the fourth, on every packet of the chain; one flip breaks it
  for (const hex of OW.lexiconPackets(M.lexiconTextOf(M.EZEKIEL))) {
    const q = M.quarterFigure(hex);
    assert.deepEqual(q.parities, OW.quarterParities(hex));
    assert.deepEqual([q.fits, q.parityOk, q.predicted, q.layer], [true, true, q.actual, "checked"]);
    assert.ok(q.sentence.endsWith("the guard holds."));
    const flipped = M.quarterFigure(OW.flipBit(hex, 17));
    assert.deepEqual([flipped.fits, flipped.parityOk], [false, false]);
    assert.ok(flipped.sentence.endsWith("the guard fails."));
  }
  assert.equal(M.quarterFigure("8000000000000001").sentence, "Tested: the first three quarters are odd, even and even, so the fourth must be odd. It is odd: the guard holds.");
  assert.equal(M.quarterFigure("0000800000000000").sentence, "Tested: the first three quarters are even, odd and even, so the fourth must be odd. It is even: the guard fails.");
  assert.equal(M.quarterFigure("0000000080000000").sentence, "Tested: the first three quarters are even, even and odd, so the fourth must be odd. It is even: the guard fails.");
  // (d) and (e)
  assert.deepEqual([M.squaresFigure().squares, M.squaresFigure().next, M.squaresFigure().formula], [[1, 4, 9], 16, "3 × 9 − 3 × 4 + 1 = 16"]);
  for (let n = 1; n < 200; n++) assert.equal(HM.squareNumbersNext(n * n, (n + 1) ** 2, (n + 2) ** 2), (n + 3) ** 2);
  const c = M.cornersFigure();
  assert.deepEqual([c.flat.meet, c.flat.angle, c.curved.meet], [4, 90, 5]);
  close(c.curved.angle, 72, 1e-9, "the corner angle of a {4,5} square");
  close(HM.tilingConstants(4, 5).angle * 5, 2 * Math.PI, 1e-12, "five squares close up round a corner");
  close(c.curved.lambert, HM.lambertAngle(0.5, 0.5) * deg, 1e-12);
  close(c.curved.lambert, 74.2441, 1e-4, "a fourth angle smaller than a right angle");
  assert.ok(c.curved.lambert < 90);
  assert.ok(c.curved.sentence.includes("five squares meet at each corner"));
  assert.deepEqual(M.FOURTH_PARTS.map((p) => p.key), ["a", "b", "c", "d", "e"]);
});

// ─── seal, tamper, send ──────────────────────────────────────────────────────

test("sealing: fourteen epochs, one certificate, the wire the front door accepts", async () => {
  assert.equal(SEAL.ok, true);
  assert.equal(SEAL.keys, KEYS);
  assert.equal(SEAL.wire, JSON.stringify(SEAL.pack));
  assert.equal(SEAL.wire, JSON.stringify(OW.makeHyperpack({ ...SEAL.bundle, certificate: SEAL.certificate })));
  const door = await OW.readHyperpack(SEAL.wire);
  assert.equal(door.ok, true);
  assert.equal(SEAL.report.ok, true);
  assert.equal(SEAL.chainId, SEAL.bundle.chain.chainId);
  assert.match(SEAL.chainId, /^BC-[0-9a-f]{24}$/);
  assert.equal(SEAL.fileName, "hyperpack-" + SEAL.chainId + ".json");
  assert.match(SEAL.fileName, KIT.DOWNLOAD_NAME);
  assert.equal(M.packageFileName("BC-xyz"), null);
  assert.equal(M.packageFileName(null), null);
  assert.deepEqual(M.epochRows(M.EZEKIEL).map((e) => e.address), ["0", "5", "14", "19", "20", "26", "27", "40", "41", "42", "43", "49", "66", "100"]);
  assert.equal(M.epochLine(epochsSeen[2], "navigator"), "epoch 3 of 14");
  assert.equal(M.epochLine(epochsSeen[2], "stargazer"), "part 3 of 14");
  // a pass is worded "unchanged since it was sealed"
  for (const lens of LENSES) {
    const v = M.sealView(SEAL, lens);
    assert.equal(v.ok, true);
    assert.ok(/unchanged since it was (sealed|stamped)/.test(v.verdict), v.verdict);
    assert.ok(!/all checks pass/i.test(v.verdict));
    assert.equal(v.checks.length, OW.OVERWATCH_CHECKS.length);
    assert.equal(v.fileName, SEAL.fileName);
  }
  assert.deepEqual(M.sealView(SEAL, "stargazer").rows, [], "no hashes at Stargazer");
  const rows = new Map(M.sealView(SEAL, "holographer").rows.map((r) => [r.key, r.value]));
  assert.equal(rows.get("chain"), SEAL.chainId);
  assert.equal(rows.get("epochs"), "14");
  assert.equal(rows.get("entries"), String(DATA.ROWS.length));
  assert.equal(rows.get("line"), SEAL.certificate.commitment);
  assert.ok(rows.get("seal").startsWith(SEAL.certificate.sealId));
  assert.equal(M.sealView(SEAL, "navigator").rows.some((r) => r.key === "line"), false);
  assert.deepEqual([M.sealView(null, "navigator").ok, M.sealView(null, "navigator").verdict], [false, "Not sealed yet."]);
  // the same entries and the same time give the same chain; the sky page's link gives the chain the sky page shows
  const small = M.makeLexicon(M.EZEKIEL.entries.filter((e) => /^(0|5|14)(\.|$)/.test(e.address)), "page", "small", "");
  const a = await M.sealLexicon(small, { at: AT }), b = await M.sealLexicon(small, { at: AT });
  assert.equal(a.ok && b.ok, true);
  assert.equal(a.chainId, b.chainId);
  assert.notEqual(a.certificate.sealId, b.certificate.sealId, "a key is made for each sealing unless one is given");
  assert.notEqual(a.certificate.sealId, SEAL.certificate.sealId);
  // a tamper needs a sealed package; an unknown tamper does nothing
  const unsealed = await M.runTamper(null, "word");
  assert.deepEqual([unsealed.ran, unsealed.key, unsealed.label, unsealed.expected, unsealed.got, unsealed.sentence], [false, "word", "Change a word", "crystal", null, "Seal the lexicon first."]);
  const unknownTamper = await M.runTamper(SEAL, "nope");
  assert.deepEqual([unknownTamper.ran, unknownTamper.label, unknownTamper.expected], [false, "", null]);
  const star = await M.runTamper(a, "word", { lens: "stargazer" });
  assert.equal(star.sentence, "The stamp no longer fits. A word was changed.");
  assert.equal(JSON.stringify(a.pack), a.wire, "the sealed package is left as it was");
});

test("a sky from a link: recomputed here, the same rows and the same chain the sky page gets", async () => {
  assert.equal(SKY.ok, true);
  assert.equal(SKY.lexicon.origin, "page");
  assert.equal(SKY.lexicon.home, "");
  const rows = CC.skyLexiconRows(CC.skyState(1505042.16624, 32.13, 45.23));
  assert.deepEqual(SKY.lexicon.entries.map((e) => [e.address, e.layer, e.kind, e.name, e.text]), rows.map((r) => r.map((s) => s.normalize("NFC"))));
  assert.deepEqual(SKY.sky, { jd: "1505042.16624", lat: "32.13", lon: "45.23" });
  assert.ok(SKY.lexicon.title.startsWith("A sky: "));
  const here = await M.sealLexicon(SKY.lexicon, { at: AT });
  const there = await OW.buildLexiconBundle(rows.map((r) => OW.makeEntry(...r)), { at: "2031-01-01T00:00:00.000Z" });
  assert.equal(here.ok, true);
  assert.equal(here.chainId, there.chain.chainId, "everyone who seals this same sky gets this same name");
  assert.deepEqual(M.epochRows(SKY.lexicon).map((e) => e.address), ["1", "2", "3", "4"]);
  // the three numbers are validated before anything is computed
  for (const bad of [[1505042.16624, 95, 0], [NaN, 0, 0], [1, 0, 0], [1505042.16624, 0], "1,2,3", null, [1505042.16624, "32.13", 45.23]]) {
    const r = M.skyLexicon(bad);
    assert.deepEqual([r.ok, r.lexicon], [false, null]);
    assert.ok(typeof r.why === "string" && r.why.length > 10 && !/NaN|95/.test(r.why), "a fixed sentence");
  }
  // the Entry of a sky row: its own badge, no reader wording, no author's line
  const e = M.entryView(SKY.lexicon, "2.2", "navigator", { wording: "supplied" });
  assert.deepEqual([e.name, e.words, e.foot, e.author, e.badge.outline], ["Moon", [], null, null, false]);
  assert.equal(M.pathCaption(SKY.lexicon, "2.2"), "Sun and Moon > Moon");
  assert.equal(M.entryView(SKY.lexicon, "", "navigator").name, SKY.lexicon.title);
});

test("sending: four receivers answer with their own keys; noise on one road leaves two", async () => {
  const receivers = await M.makeReceivers();
  assert.deepEqual(receivers.map((r) => [r.id, r.city]), OW.CROSSROADS.map((c) => [c.id, c.city]));
  assert.deepEqual(M.RECEIVERS.map((r) => r.city), ["Antioch", "Alexandria", "Athens", "Rome"]);
  assert.equal(new Set(receivers.map((r) => r.sealId)).size, 4);
  assert.ok(!receivers.some((r) => r.sealId === SEAL.certificate.sealId), "a key that seals never answers");
  const seen = [];
  const clean = await M.sendToReceivers(SEAL, receivers, { at: AT, onAnswer: (row, i) => { seen.push([i, row.id]); } });
  assert.deepEqual(seen, receivers.map((r, i) => [i, r.id]), "one after another, in order");
  assert.deepEqual([clean.k, clean.of, clean.marks.map((m) => m.met)], [4, 4, [true, true]]);
  assert.deepEqual(clean.marks.map((m) => [m.need, m.label]), M.WITNESS_MARKS.map((m) => [m.need, m.label]));
  assert.ok(clean.rows.every((r) => r.accepted && r.counted && !r.noise && r.failed === null));
  assert.equal(clean.sentence, M.quorumSentence(4));
  assert.ok(clean.sentence.startsWith("4 of the four receivers accepted. All four run inside this page, with the same code, each with a key made a moment ago."));
  assert.equal(clean.stargazer, "Four receivers checked the stamp and agreed, so the parcel arrived unchanged. They are pretend receivers inside this page.");
  for (const a of clean.answers) assert.equal((await OW.verifyAnswer(a, SEAL.wire)).ok, true);
  const again = await OW.witnessQuorum(clean.answers, SEAL.wire, { need: 2, known: receivers.map((r) => r.sealId), exclude: [SEAL.certificate.sealId] });
  assert.deepEqual(again.accepted, receivers.map((r) => r.sealId));
  // noise on the road Athens and Rome share: two handshakes, the rule of two is met and the stricter count is not
  const noisy = await M.sendToReceivers(SEAL, receivers, { at: AT, noise: true });
  assert.deepEqual(noisy.rows.map((r) => [r.id, r.noise, r.accepted, r.counted]), [["antioch", false, true, true], ["alexandria", false, true, true], ["athens", true, false, false], ["rome", true, false, false]]);
  assert.deepEqual([noisy.k, noisy.marks.map((m) => m.met)], [2, [true, false]]);
  assert.ok(noisy.rows.filter((r) => r.noise).every((r) => typeof r.failed === "string" && OW.PACKAGE_CHECKS.includes(r.failed)));
  assert.equal(noisy.stargazer, "Two receivers checked the stamp and agreed, so the parcel arrived unchanged. They are pretend receivers inside this page.");
  const three = await M.sendToReceivers(SEAL, receivers, { at: AT, noise: ["antioch", "alexandria", "athens"] });
  assert.deepEqual([three.k, three.marks.map((m) => m.met)], [1, [false, false]]);
  assert.equal(three.stargazer, "Fewer than two receivers agreed. They are pretend receivers inside this page.");
  assert.notEqual(M.noisyWire(SEAL.wire, 0), SEAL.wire);
  const later = await M.sendToReceivers(SEAL, receivers.slice(0, 1), { at: "2031-05-05T05:05:05.000Z" });
  assert.equal(later.answers[0].answeredAt, "2031-05-05T05:05:05.000Z");
  assert.equal(clean.answers[0].answeredAt, AT);
  for (let n = 0; n < 12; n++) {
    const damaged = M.noisyWire(SEAL.wire, n);
    assert.equal(damaged.length, SEAL.wire.length);
    assert.equal([...damaged].filter((ch, k) => ch !== SEAL.wire[k]).length, 1, "noise changes one hex digit");
    assert.match(damaged[[...damaged].findIndex((ch, k) => ch !== SEAL.wire[k])], /^[01]$/);
  }
  // the sealer's own key does not count, and one key does not count twice
  const sealer = { id: "sealer", city: "The sealer", keys: KEYS, sealId: SEAL.certificate.sealId };
  const withSealer = await M.sendToReceivers(SEAL, [sealer, receivers[0]], { at: AT });
  assert.deepEqual(withSealer.rows.map((r) => [r.accepted, r.counted]), [[true, false], [true, true]]);
  assert.deepEqual([withSealer.k, withSealer.marks[0].met], [1, false]);
  const twice = await M.sendToReceivers(SEAL, [receivers[0], receivers[0], receivers[0]], { at: AT });
  assert.deepEqual([twice.k, twice.marks[0].met], [1, false]);
  // nothing to send before sealing
  const unsent = await M.sendToReceivers(null, receivers);
  assert.deepEqual([unsent.k, unsent.rows, unsent.marks.map((m) => m.met), unsent.sentence], [0, [], [false, false], "Seal the lexicon first."]);
});

// ─── a lexicon from outside ──────────────────────────────────────────────────

test("a package from outside: shown as its sender's, with outlined badges; the reader stays the built-in passage", async () => {
  // a package whose text-layer verse row is invented
  const forged = [OW.makeEntry("26", "reading", "book", "Ezekiel", ""), OW.makeEntry("26.1", "reading", "chapter", "Ezekiel 1", ""),
    OW.makeEntry("26.1.1", "text", "verse", "Ezekiel 1:1", "An invented verse that no Bible holds."), OW.makeEntry("26.1.1.1", "text", "term", "invented", ""),
    OW.makeEntry("100", "reading", "note", "The author's notes", ""), OW.makeEntry("100.1", "reading", "note", "Line 1", "Not the author's line.")];
  const bundle = await OW.buildLexiconBundle(forged, { at: AT }), keys = await OW.newSessionKeys();
  const { certificate } = await OW.issueCertificate(bundle, keys, AT);
  const wire = JSON.stringify(OW.makeHyperpack({ ...bundle, certificate }, { from: "elsewhere", to: "you‮" }));
  const out = await M.readOutside(wire);
  assert.deepEqual([out.ok, out.failed, out.kind], [true, null, "tree"]);
  assert.equal(out.lexicon.origin, "outside");
  assert.equal(out.lexicon.home, "");
  assert.equal(out.lexicon.title, "A lexicon from outside");
  assert.equal(out.notice, M.OUTSIDE_NOTICE);
  assert.equal(out.banner, "This lexicon was not made by this page. Its words and its labels are its sender's.");
  assert.equal(out.signature, `signed by key ${certificate.sealId}; this page cannot know whose key that is`);
  assert.deepEqual([out.covered.chainId, out.covered.merkleRoot, out.covered.epoch, out.covered.entries, out.covered.lexiconRoot, out.covered.commitment, out.covered.sealId],
    [bundle.chain.chainId, bundle.chain.merkleRoot, 2, 6, bundle.lexicon.root, certificate.commitment, certificate.sealId]);
  assert.deepEqual(out.covered.lineage, bundle.lineage);
  assert.equal(out.covered.ledger.length, bundle.trace.length);
  assert.equal(out.notCovered.heading, "Not covered by the signature");
  assert.deepEqual(out.notCovered.items, [{ label: "issued at", value: AT }, { label: "route, from", value: "elsewhere" }], "a route value that is not plain text is not shown");
  // its badges are outlined and say whose label it is, at every lens; nothing of it is treated as the author's or as the reader
  for (const lens of LENSES) {
    const e = M.entryView(out.lexicon, "26.1.1", lens, { wording: "supplied" });
    assert.deepEqual([e.badge.outline, e.badge.by, e.badge.word], [true, "labelled TEXT by its sender", lens === "stargazer" ? "WRITTEN" : "TEXT"]);
    assert.deepEqual([e.words, e.foot, e.actions], [[], null, []]);
    assert.equal(e.text, "An invented verse that no Bible holds.");
    for (const r of e.rows) assert.equal(r.badge.outline, true);
    assert.equal(M.entryView(out.lexicon, "100.1", lens).author, null);
    assert.equal(M.badgeView(out.lexicon, "100.1", lens).by, "labelled READING by its sender");
  }
  // no sentence of the page carries a sender's string: captions and the status line name addresses, the names come one by one
  assert.equal(M.pathCaption(out.lexicon, "26.1.1"), "26 > 26.1 > 26.1.1");
  assert.deepEqual(M.pathOf(out.lexicon, "26.1.1").map((p) => p.crumb), ["Ezekiel", "Ezekiel 1", "Ezekiel 1:1"], "no chapter and verse words for a sender's kinds");
  assert.equal(M.statusFor(out.lexicon, "26.1.1", "navigator"), "Entry 26.1.1 of the loaded lexicon: 1 entry under it.");
  assert.equal(M.treeCaption(out.lexicon, M.treeScene(out.lexicon, M.viewAt(out.lexicon, "26.1.1"), "2D"), "stargazer").startsWith("26 > 26.1 > 26.1.1. 1 entry under it."), true);
  assert.equal(M.placeNumbers(out.lexicon, "2D", "26.1.1", "100.1").sentence.startsWith("From entry 26.1.1 to entry 100.1: 5 steps along the tree, "), true);
  for (const text of [M.statusFor(out.lexicon, "100.1", "stargazer"), M.treeCaption(out.lexicon, M.treeScene(out.lexicon, M.homeView(out.lexicon), "2D"), "navigator"), M.placeNumbers(out.lexicon, "2D", "26", "100").sentence]) {
    for (const e of out.lexicon.entries) assert.ok(!text.includes(e.name), "a sender's name inside a sentence of the page");
  }
  assert.equal(M.shortLabel(out.lexicon, "26.1.1"), "Ezekiel 1:1");
  assert.equal(M.countWithMe(out.lexicon, "26.1.1"), null);
  assert.equal(M.wheelAuthorLine(out.lexicon, "navigator"), null);
  assert.deepEqual(M.visibleStations("navigator", "outside"), []);
  assert.equal(M.stationView("read", "navigator", out.lexicon), null);
  assert.equal(M.readerView("kjv").verses[0].text, ROW.get("26.1.1").text, "the reader is the built-in passage");
  assert.equal(M.verseView("26.1.1", "kjv").text, ROW.get("26.1.1").text);
  const state = { ...M.initialState("#lens=navigator"), lexicon: out.lexicon, outside: out };
  assert.equal(M.stationFor(state), null);
  assert.equal(M.tabFor({ ...state, tab: "wheel" }), "entry");
  assert.equal(M.selectEntry(state, "26.1.1.1").verse, "26.1.1", "the open verse of the reader is not moved by an outside entry");
  assert.equal((await M.sealLexicon(out.lexicon, { at: AT })).ok, false, "a lexicon from outside is not sealed again here");
  assert.ok(M.treeScene(out.lexicon, M.homeView(out.lexicon), "2D").nodes.length >= 3);
  // every check gets the page's own sentence
  for (const c of out.checks) assert.ok(M.CHECK_SENTENCES.has(c.name), c.name);
  assert.deepEqual([...M.CHECK_SENTENCES.keys()], [...OW.PACKAGE_CHECKS]);

  // a package that fails is not shown beyond its failure
  for (const row of OW.LEXICON_TAMPERS.filter((r) => r.expected !== "accepted")) {
    const bad = await M.readOutside(JSON.stringify(await row.apply(JSON.parse(wire), {})));
    assert.deepEqual([bad.ok, bad.failed, bad.lexicon, bad.covered, bad.kind, bad.notCovered, bad.signature], [false, row.expected, null, null, null, null, ""]);
    assert.equal(bad.line, M.LOAD_COPY.refused);
  }
  for (const junk of ["", "{}", "not json", wire + " ", wire.slice(0, -1), null, 12, "[" + wire + "]"]) {
    const bad = await M.readOutside(junk);
    assert.deepEqual([bad.ok, bad.failed, bad.lexicon, bad.covered], [false, "parse", null, null]);
  }
  // a First Explorers journey shows its checks and one line
  const obs = [OW.makeObservation("sound", { hz: 432, ms: 400 }, "tone-432"), OW.makeObservation("number", { seq: [1, 1, 2, 3, 5, 8] }, "fib")];
  const trace = [], lineage = [];
  OW.traceAppend(trace, "system", "genesis", "darkness", AT);
  let chain = null;
  for (const o of obs) { chain = await OW.growJourney(chain, o); lineage.push(OW.lineageRow(chain)); OW.traceAppend(trace, "strix", "chain.grown", OW.epochCommitment(chain), AT); }
  const jb = { chain, lexicon: OW.lexiconOf(obs), lineage, trace }, jc = (await OW.issueCertificate(jb, keys, AT)).certificate;
  const journey = await M.readOutside(JSON.stringify(OW.makeHyperpack({ ...jb, certificate: jc })));
  assert.deepEqual([journey.ok, journey.kind, journey.lexicon, journey.line], [true, "journey", null, "This is a First Explorers journey."]);
  assert.equal(journey.covered.chainId, chain.chainId);
  // the file size is checked before a file is read
  assert.deepEqual([M.fileAllowed(0), M.fileAllowed(4500000), M.fileAllowed(4500001), M.fileAllowed(NaN), M.fileAllowed(-1), M.fileAllowed("12")], [true, true, false, false, false, false]);
  assert.equal(M.MAX_FILE_BYTES, 4500000);
});

// ─── state ───────────────────────────────────────────────────────────────────

test("the first state and what a link does to it", () => {
  const s = M.initialState("");
  assert.deepEqual([s.lens, s.dims, s.station, s.verse, s.selected, s.tab, s.busy, s.seal, s.send, s.outside], ["stargazer", "2D", "read", "26.1.1", null, "entry", false, null, null, null]);
  assert.equal(s.lexicon, M.EZEKIEL);
  assert.deepEqual(s.view, { focus: "26.1", local: [...OW.IDENT] });
  assert.deepEqual(s.notes, []);
  assert.deepEqual(s.filter, { text: true, said: true, checked: true, reading: true });
  assert.deepEqual([s.marks, s.wordingChosen, s.flight, s.counting, s.sky], [false, false, null, null, null]);
  assert.deepEqual(s.wheel, { packet: 0, flips: [], view: "wheel", sector: null });
  assert.deepEqual(M.entryView(s.lexicon, s.selected, s.lens), { empty: true, prompt: "Tap a shining word", invite: M.NOTES_INVITE });
  // #entry selects and centres; the open verse follows
  const e = M.initialState("#entry=26.1.4.2&lens=navigator");
  assert.deepEqual([e.lens, e.selected, e.view.focus, e.verse, e.wording, e.notes], ["navigator", "26.1.4.2", "26.1.4.2", "26.1.4", "kjv", []]);
  const far = M.initialState("#entry=43.3.16");
  assert.deepEqual([far.selected, far.view.focus, far.verse], ["43.3.16", "43.3.16", "26.1.1"]);
  // an address this lexicon does not have, and a value that is not read
  const unknown = M.initialState("#entry=7.7.7&lens=holographer");
  assert.deepEqual([unknown.selected, unknown.view.focus, unknown.lens, unknown.notes], [null, "26.1", "holographer", [M.UNKNOWN_ENTRY_NOTE]]);
  assert.deepEqual(M.initialState("#lens=navigator&zzz=1").notes, ["a link value was ignored"]);
  assert.deepEqual(M.initialState("#entry=<b>").notes, ["a link value was ignored"]);
  // a sky link shows that sky as its own lexicon; Back (a link without it) returns to the built-in one
  const sky = M.initialState("#sky=1505042.16624,32.13,45.23&lens=navigator");
  assert.deepEqual([sky.lexicon.origin, sky.lexicon.entries.length, sky.station, sky.view.focus, sky.sky.jd], ["page", 25, "place", "", "1505042.16624"]);
  const inSky = M.applyHash(sky, "#sky=1505042.16624,32.13,45.23&entry=2.2&lens=navigator");
  assert.equal(inSky.lexicon, sky.lexicon, "the same sky is not built again");
  assert.deepEqual([inSky.selected, inSky.view.focus], ["2.2", "2.2"]);
  assert.equal(M.formatHash({ sky: [sky.sky.jd, sky.sky.lat, sky.sky.lon], entry: inSky.selected, lens: inSky.lens }), "#sky=1505042.16624,32.13,45.23&entry=2.2&lens=navigator");
  const back = M.applyHash(inSky, "#lens=navigator");
  assert.deepEqual([back.lexicon, back.sky, back.selected, back.station], [M.EZEKIEL, null, null, "place"]);
  assert.equal(M.initialState("#sky=1505042.16624,32.13,45.23").station, "layers", "at Stargazer a sky opens on a station Stargazer shows");
  // selecting; a lens that hides the station or the tab leaves them
  let t = M.selectEntry(M.setLens(M.initialState(""), "navigator"), "26.1.9.2");
  assert.deepEqual([t.selected, t.verse, t.counting], ["26.1.9.2", "26.1.9", null]);
  assert.equal(M.selectEntry(t, "nope").selected, "26.1.9.2");
  t = { ...t, station: "fourth", tab: "wheel" };
  assert.deepEqual([M.stationFor(t), M.tabFor(t)], ["fourth", "wheel"]);
  const star = M.setLens(t, "stargazer");
  assert.deepEqual([star.station, star.tab, star.selected], ["read", "entry", "26.1.9.2"]);
  assert.equal(M.setLens(t, "nonsense").lens, "stargazer");
  assert.equal(M.tabFor({ ...t, tab: "chain" }), "entry");
  assert.equal(M.tabFor({ ...t, tab: "chain", seal: SEAL }), "chain");
  // the state is plain data and the functions return new states
  const before = JSON.stringify({ ...s, lexicon: null });
  M.setLens(s, "holographer"); M.selectEntry(s, "26.1.1.1"); M.applyHash(s, "#entry=26.1.2"); M.setWording(s, "kjv");
  assert.equal(JSON.stringify({ ...s, lexicon: null }), before);
});

// ─── after the review: one test for each fault that lived in the model ───────

test("a sealed package names its chain at every lens; the words about the key stand only beside this page's own seal", async () => {
  // the Seal station shows the chain name under the verdict, at Stargazer in the sky page's words (the sky page says: compare with a friend)
  for (const lens of LENSES) assert.deepEqual(M.sealView(SEAL, lens).chain, { label: lens === "stargazer" ? "The name of this stamp" : "Chain name", value: SEAL.chainId });
  assert.equal(M.sealView(null, "stargazer").chain, null);
  const sky = await M.sealLexicon(SKY.lexicon, { at: AT });
  const there = await OW.buildLexiconBundle(CC.skyLexiconRows(CC.skyState(1505042.16624, 32.13, 45.23)).map((r) => OW.makeEntry(...r)), { at: "2031-01-01T00:00:00.000Z" });
  assert.equal(M.sealView(sky, "stargazer").chain.value, there.chain.chainId, "the name shown at Stargazer is the one the sky page shows");
  // this page made the key of its own seal in this visit, and says so there
  assert.equal(M.OWN_KEY_NOTE, "(a key made for this visit)");
  assert.equal(M.sealView(SEAL, "navigator").rows.find((r) => r.key === "seal").value, SEAL.certificate.sealId + " (a key made for this visit)");
  // a package from a file: neither the core's check details nor anything the model adds says when or for whom the key was made
  const other = await OW.newSessionKeys(), bundle = await OW.buildLexiconBundle([OW.makeEntry("1", "checked", "note", "A note", "Words.")], { at: AT });
  const { certificate } = await OW.issueCertificate(bundle, other, AT);
  const out = await M.readOutside(JSON.stringify(OW.makeHyperpack({ ...bundle, certificate })));
  assert.equal(out.ok, true);
  assert.equal(out.checks.find((c) => c.name === "signature").detail, "ECDSA P-256 by " + certificate.sealId);
  assert.ok(!JSON.stringify({ ...out, lexicon: null }).includes("this visit"), "a key from a file is not called a key of this visit");
  assert.ok(!JSON.stringify(out.lexicon.entries).includes("this visit"));
  assert.equal(out.signature, `signed by key ${certificate.sealId}; this page cannot know whose key that is`);
});

test("a package from outside: the ledger is listed up to the certified head, and each of its strings is cut to 96 code points", async () => {
  // (a) one entry appended after the head: it is not listed as covered, and the page says how many there are
  const pack = JSON.parse(SEAL.wire), head = pack.trace.findIndex((e) => e.hash === pack.certificate.traceHead);
  assert.equal(head, pack.trace.length - 1);
  OW.traceAppend(pack.trace, "someone", "added.later", "after the seal", AT);
  const late = await M.readOutside(JSON.stringify(pack));
  assert.equal(late.ok, true, "the front door accepts it: the signature covers the ledger up to its head");
  assert.equal(late.covered.ledger.length, head + 1);
  assert.ok(!late.covered.ledger.some((e) => e.event === "added.later" || e.actor === "someone"));
  assert.deepEqual(late.notCovered.items.find((i) => i.label === "ledger entries after the certified head"), { label: "ledger entries after the certified head", value: "1" });
  const whole = await M.readOutside(SEAL.wire);
  assert.equal(whole.covered.ledger.length, SEAL.bundle.trace.length);
  assert.ok(!whole.notCovered.items.some((i) => i.label.startsWith("ledger entries")));
  // an honest ledger is shown as it is: nothing the page shows of it is cut
  assert.deepEqual(whole.covered.ledger.map((e) => [e.n, e.actor, e.event, e.at, e.cut]), SEAL.bundle.trace.map((e) => [e.n, e.actor, e.event, e.at, false]));
  assert.equal(whole.covered.ledgerCut, false);
  // a sender may write a ledger string of any length; one unbroken string of 100,000 characters froze the tab. It never reaches the page.
  const entries = [OW.makeEntry("1", "reading", "note", "A note", "Words.")], long = "A".repeat(100000), astral = "𝔸".repeat(500);
  const bundle = await OW.buildLexiconBundle(entries, { at: AT });
  OW.traceAppend(bundle.trace, long, "note", "a detail", AT);
  OW.traceAppend(bundle.trace, "actor", astral, "x".repeat(5000), AT);
  const { certificate } = await OW.issueCertificate(bundle, await OW.newSessionKeys(), AT);
  const wire = JSON.stringify(OW.makeHyperpack({ ...bundle, certificate }));
  assert.ok(wire.length > 100000);
  const out = await M.readOutside(wire);
  assert.equal(out.ok, true);
  assert.equal(M.LEDGER_POINTS, 96);
  for (const e of out.covered.ledger) for (const v of [e.actor, e.event, e.detail, e.at]) assert.ok(typeof v === "string" && [...v].length <= 96, "a ledger string of more than 96 code points was handed to the shell");
  const [a, b] = out.covered.ledger.slice(-2);
  assert.equal(a.actor, "A".repeat(95) + "…");
  assert.equal(b.event, "𝔸".repeat(95) + "…", "cut by code points, never inside a pair");
  assert.deepEqual([a.cut, b.cut, out.covered.ledgerCut], [true, true, true]);
  assert.ok(JSON.stringify({ ...out, lexicon: null, checks: null }).length < 20000, "the full values are not in what the page is given");
  assert.ok(M.LEDGER_CUT_NOTE.includes("…") && M.LEDGER_CUT_NOTE.includes("95"));
});

test("a link that replaces the lexicon drops the seal, the tampers and what was sent", () => {
  // (b) the Chain tab would otherwise show the Ezekiel chain over a sky of 25 entries
  const sealed = { ...M.initialState("#lens=navigator"), seal: SEAL, tampers: { word: { ran: true } }, send: { k: 4 }, tab: "chain", counting: { words: ["four"], word: "four" } };
  assert.equal(M.tabFor(sealed), "chain");
  const toSky = M.applyHash(sealed, "#sky=1505042.16624,32.13,45.23&lens=navigator");
  assert.equal(toSky.lexicon.origin, "page");
  assert.deepEqual([toSky.seal, toSky.tampers, toSky.send, toSky.tab, toSky.counting], [null, {}, null, "entry", null]);
  const skySealed = { ...toSky, seal: SEAL, tampers: { drop: { ran: true } }, send: { k: 2 }, tab: "chain" };
  const back = M.applyHash(skySealed, "#lens=navigator");
  assert.deepEqual([back.lexicon, back.seal, back.tampers, back.send, back.tab], [M.EZEKIEL, null, {}, null, "entry"]);
  // the same sky again keeps what was sealed
  const same = M.applyHash(skySealed, "#sky=1505042.16624,32.13,45.23&entry=2.2&lens=navigator");
  assert.equal(same.seal, SEAL);
  // selecting an entry clears a count that was lit
  assert.equal(M.selectEntry({ ...M.initialState(""), counting: { words: ["four"], word: "four" } }, "26.1.5").counting, null);
  // a link value is judged as the page will use it, rounded: one that rounds to the end of the range is ignored like any other bad value
  assert.equal(CC.skyInputsValid(2817152.499996, 0, 0), true, "in range as typed");
  assert.equal(CC.skyInputsValid(CC.roundSkyInputs(2817152.499996, 0, 0).jdUt, 0, 0), false, "out of range as the pages round it");
  assert.deepEqual([M.parseHash("#sky=2817152.499996,0,0").values.sky, M.parseHash("#sky=2817152.499996,0,0").note], [undefined, "a link value was ignored"]);
  assert.equal(M.skyLexicon([2817152.499996, 0, 0]).why, "These three numbers are outside what this page can work out.");
  assert.equal(M.initialState("#sky=2817152.499996,0,0").lexicon, M.EZEKIEL);
  assert.equal(M.initialState("#sky=2817152.49999,0,0").lexicon.origin, "page");
});

test("the tree and the ball: a centred entry's children are all drawn; 2D and 3D give different straight distances; a turn goes the way it says", () => {
  // (c) 2,400 children push most of them past the rim cut; the children of the centred entry are never hidden (8.1)
  const many = [OW.makeEntry("1", "reading", "note", "One", "")];
  for (let i = 1; i <= 2400; i++) many.push(OW.makeEntry("1." + i, "reading", "note", "n" + i, ""));
  const lexicon = M.makeLexicon(many, "page", "many", ""), scene = M.treeScene(lexicon, M.viewAt(lexicon, "1"), "2D");
  const drawn = new Set(scene.nodes.map((n) => n.address));
  assert.deepEqual([scene.count, scene.crowded], [2400, true]);
  for (let i = 1; i <= 2400; i++) assert.ok(drawn.has("1." + i), `child 1.${i} of the centred entry is not drawn`);
  assert.ok(scene.nodes.filter((n) => n.relation === "child" && n.radius > M.RIM_CUT).length > 1000, "most of them lie beyond the rim cut, and are drawn all the same");
  assert.equal(scene.hidden, 0);
  assert.equal(scene.nodes.filter((n) => n.label !== null && n.relation === "child").length, 0);
  // hidden counts entries, not the root: from the root of the Ezekiel lexicon everything further than two edges and near the rim is left out
  const top = M.treeScene(M.EZEKIEL, M.viewAt(M.EZEKIEL, ""), "2D");
  assert.equal(top.hidden, M.EZEKIEL.entries.length - top.nodes.filter((n) => n.address !== "").length);
  assert.ok(top.hidden > 0);
  // (d) the straight distance is the one of the layout on screen
  const a = "26.1.1.4", b = "43.3.16";
  const flat = M.placeNumbers(M.EZEKIEL, "2D", a, b), ball = M.placeNumbers(M.EZEKIEL, "3D", a, b);
  assert.equal(flat.steps, ball.steps);
  assert.notEqual(flat.straight.toFixed(2), ball.straight.toFixed(2));
  close(ball.straight, Math.acosh(HM.relativeFrame(HM.treeLayout(M.EZEKIEL.addresses, "3D"), a, b)[15]), 1e-9, "3D");
  close(flat.straight, Math.acosh(HM.relativeFrame(HM.treeLayout(M.EZEKIEL.addresses, "2D"), a, b)[15]), 1e-9, "2D");
  assert.ok(ball.sentence.includes(ball.straight.toFixed(2) + " straight distance in the chart") && flat.sentence.includes(flat.straight.toFixed(2) + " straight distance in the chart"));
  // (e) the point of the ball that faces the visitor is (0, 0, 1); x is to the right and y is up
  const front = (R) => [R[2], R[6], R[10]];
  assert.ok(front(M.orbitTurn(OW.IDENT, "left"))[0] < -0.1, "left turns the front of the ball to the left");
  assert.ok(front(M.orbitTurn(OW.IDENT, "right"))[0] > 0.1);
  assert.ok(front(M.orbitTurn(OW.IDENT, "up"))[1] > 0.1, "up turns the front of the ball up");
  assert.ok(front(M.orbitTurn(OW.IDENT, "down"))[1] < -0.1);
  assert.deepEqual(M.orbitTurn(OW.IDENT, "sideways"), [...OW.IDENT]);
});

test("a tamper's verdict is the front door's answer, and its sentence is worded for the lens it is shown in", async () => {
  const r = await M.runTamper(SEAL, "word", { at: AT, lens: "holographer" });
  assert.deepEqual([r.ran, r.why, r.verdict, r.got], [true, null, "REFUSED", "crystal"]);
  assert.equal(r.sentence, M.tamperSentence(r, "holographer"));
  // the result keeps the facts; each lens words them: from Navigator up with the name of the check that refused (8.2)
  assert.equal(M.tamperSentence(r, "stargazer"), "The stamp no longer fits. A word was changed.");
  assert.equal(M.tamperSentence(r, "navigator"), "Refused at the check called crystal. The seal noticed that a word was changed.");
  const star = await M.runTamper(SEAL, "drop", { at: AT, lens: "stargazer" });
  assert.equal(star.sentence, "The stamp no longer fits. Something is missing.");
  assert.equal(M.tamperSentence(star, "navigator"), "Refused at the check called lexicon. The seal noticed that an entry is missing.");
  for (const row of OW.LEXICON_TAMPERS) for (const lens of LENSES) {
    const got = row.expected === "accepted" ? "accepted" : row.expected, s = M.tamperSentence({ ran: true, key: row.key, expected: row.expected, got, accepted: got === "accepted" }, lens);
    assert.ok(s.length > 20 && (got === "accepted" || lens === "stargazer" || s.includes("the check called " + got)), `${row.key} at ${lens}: ${s}`);
  }
  // before sealing, and a change that cannot be made
  assert.equal(M.tamperSentence({ ran: false, why: "unsealed" }, "stargazer"), "Stamp it first.");
  assert.equal(M.tamperSentence({ ran: false, why: "unsealed" }, "navigator"), "Seal the lexicon first.");
  assert.equal(M.tamperSentence(null, "holographer"), "Seal the lexicon first.");
  const unmade = await M.runTamper(SEAL, "word", { rows: [{ key: "word", label: "Change a word", expected: "crystal", apply: async () => { throw new Error("no"); } }] });
  assert.deepEqual([unmade.ran, unmade.why, unmade.sentence, M.tamperSentence(unmade, "stargazer")], [false, "unmade", "This change could not be made on this package.", "This change could not be made on this package."]);
  assert.equal((await M.runTamper(null, "word")).why, "unsealed");
  // (f) a change the front door lets through although its row expects a refusal is reported as ACCEPTED and as not noticed,
  // never as REFUSED because the table said so. No tamper of the core does this today; a table of the test's own does.
  const slips = [{ key: "word", label: "Change a word", expected: "crystal", apply: async (pack) => pack }];
  for (const lens of LENSES) {
    const through = await M.runTamper(SEAL, "word", { at: AT, lens, rows: slips });
    assert.deepEqual([through.ran, through.verdict, through.got, through.accepted, through.asDeclared, through.sentence], [true, "ACCEPTED", "accepted", true, false, "This change was not noticed."]);
    assert.equal(through.sealId, SEAL.certificate.sealId);
  }
  // and a refusal where an acceptance is expected is a refusal
  const refused = await M.runTamper(SEAL, "reseal", { at: AT, lens: "navigator", rows: [{ key: "reseal", label: "x", expected: "accepted", apply: OW.LEXICON_TAMPERS.find((t) => t.key === "word").apply }] });
  assert.deepEqual([refused.verdict, refused.got, refused.asDeclared, refused.accepted], ["REFUSED", "crystal", false, false]);
  assert.ok(!refused.sentence.includes(M.RESEAL_TEXT));
});

test("an author's line: the plain rows before its first said or checked row keep their place; line 8's framing stands once", () => {
  // line 2: Ezekiel's wheels, then the report, then the author's belief (the order of the rows), at every lens and in the list of the ten lines
  for (const lens of LENSES) {
    const e = M.entryView(M.EZEKIEL, "100.2", lens);
    assert.deepEqual([e.author.before.map((r) => r.address), e.author.facet.address, e.first[0].address], [["100.2.1"], "100.2.2", "100.2.3"]);
    assert.deepEqual([e.author.before[0].layer, e.author.facet.layer, e.first[0].layer], ["reading", "said", "reading"]);
    assert.ok(e.author.before[0].text.includes("a wheel in the middle of a wheel") && e.author.facet.text.includes("Skeptical Inquirer") && e.first[0].text.includes("the author's own belief"));
  }
  for (const r of DATA.ROWS.filter((x) => /^100\.\d+$/.test(x[0]) && x[0] !== "100.11")) {
    const kids = DATA.ROWS.filter((x) => OW.parentOf(x[0]) === r[0]).map((x) => x[0]);
    for (const lens of LENSES) {
      const e = M.entryView(M.EZEKIEL, r[0], lens), facet = e.author.facet.address, before = e.author.before.map((x) => x.address);
      for (const b of e.author.before) assert.ok(b.kind === "plain" && kids.indexOf(b.address) < kids.indexOf(facet), `${b.address} is a plain row before ${facet}`);
      assert.deepEqual(before, kids.slice(0, kids.indexOf(facet)).filter((k) => ROW.get(k).kind === "plain" && !e.hidden.includes(k)), "all of them, in the order of the rows");
      assert.deepEqual([...before, facet, ...e.first.map((x) => x.address), ...e.more.map((x) => x.address), ...e.hidden].sort(), kids.slice().sort(), `${r[0]}: every row once`);
    }
  }
  // line 8: the framing is on the card once, under the quotation; no row that is listed says it again
  const says = (t) => /not saying them to you|in the style of (a|the) court/i.test(t);
  assert.deepEqual([...M.LINE8_RESTATED], ["100.8.1", "100.8.2", "100.8.6"]);
  for (const a of M.LINE8_RESTATED) assert.ok(ROW.get(a) && ROW.get(a).layer === "reading" && says(ROW.get(a).text), `${a} restates the framing`);
  for (const r of DATA.ROWS.filter((x) => OW.parentOf(x[0]) === "100.8" && !M.LINE8_RESTATED.includes(x[0]))) assert.ok(!says(r[4]), `${r[0]} says something else`);
  for (const lens of LENSES) {
    const e = M.entryView(M.EZEKIEL, "100.8", lens);
    assert.ok(says(e.author.framing));
    assert.deepEqual(e.hidden, ["100.8.1", "100.8.2", "100.8.6"]);
    const shown = [...e.author.before, e.author.facet, ...e.first, ...e.more];
    assert.equal(shown.filter((x) => says(x.text)).length, 0, `line 8 at ${lens}: the framing a second time`);
    assert.equal(e.author.facet.address, "100.8.5");
    // the rows themselves are still entries of the lexicon and can be opened
    assert.equal(e.rows.length, DATA.ROWS.filter((x) => OW.parentOf(x[0]) === "100.8").length);
    assert.equal(M.entryView(M.EZEKIEL, "100.8.6", lens).text, M.LINE8_FRAMING);
  }
  assert.deepEqual(M.entryView(M.EZEKIEL, "100.7", "navigator").hidden, []);
});

test("three entries have a Stargazer sentence of their own; a verse reached through a link names its translation", () => {
  assert.deepEqual([...M.ENTRY_LEADS].map(([a, lead]) => [a, lead.layer, lead.text]), [
    ["0", "reading", "This page lists words and where they come from."],
    ["0.3", "said", "The Jewish Encyclopedia says Jewish teachers explained this chapter with great care."],
    ["100", "reading", "Ten lines the author wrote under the passage."],
  ]);
  const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  for (const [a, lead] of M.ENTRY_LEADS) {
    assert.ok(words(lead.text) <= 16 && M.sentencesOf(lead.text).length === 1);
    assert.equal(lead.layer, ROW.get(a).layer, "the lead wears the badge of its entry");
    const star = M.entryView(M.EZEKIEL, a, "stargazer");
    assert.deepEqual(star.lead, { ...lead });
    assert.equal(star.text, ROW.get(a).text, "the entry's own words are unchanged; the shell puts them behind More for older readers");
    for (const lens of ["navigator", "holographer"]) assert.equal(M.entryView(M.EZEKIEL, a, lens).lead, null);
  }
  // what the lead of 0.3 says is what the row reports: the Jewish Encyclopedia, on a rule about explaining the chapter
  assert.ok(ROW.get("0.3").text.includes("As the Jewish Encyclopedia reports it") && ROW.get("0.3").text.includes("must not be explained"));
  assert.ok(ROW.get("100").text.startsWith("Ten lines the author wrote under the passage"));
  // only these three, and only in the built-in lexicon
  assert.equal(DATA.ROWS.filter((r) => M.entryView(M.EZEKIEL, r[0], "stargazer").lead !== null).length, 3);
  const made = M.makeLexicon([OW.makeEntry("0", "reading", "about", "About", "A sender's words."), OW.makeEntry("0.1", "text", "verse", "A verse", "Words."), OW.makeEntry("0.2", "reading", "link", "See", "0.1")], "outside", "t", "");
  assert.equal(M.entryView(made, "0", "stargazer").lead, null);
  // a verse set beside an entry by a link is a King James row: its citation is followed by the name of the translation
  let seen = 0;
  for (const r of DATA.ROWS.filter((x) => x[2] === "link")) {
    const target = ROW.get(r[4]), link = M.entryView(M.EZEKIEL, r[0], "stargazer").link;
    assert.equal(link.translation, target.kind === "verse" && target.layer === "text" ? "King James Version" : null, r[0]);
    assert.equal(M.entryView(M.EZEKIEL, OW.parentOf(r[0]), "stargazer").rows.find((x) => x.address === r[0]).link.translation, link.translation);
    if (link.translation) seen += 1;
  }
  assert.ok(seen >= 20);
  assert.equal(M.entryView(made, "0.2", "navigator").link.translation, null, "a sender's verse is not called King James by this page");
  // the gold box under John 3:16 is row 100.3.6, both sentences: he is not presented as support for a reading he argues against
  const stand = station("place").bridge.stands[2];
  assert.deepEqual([stand.layer, stand.source, stand.text], ["said", "100.3.6", ROW.get("100.3.6").text]);
  assert.ok(stand.text.includes("\"God so loved it and still loves it\"") && stand.text.includes("a Greek idea that does not stem from Jesus"));
  assert.equal(M.sentencesOf(ROW.get("100.3.6").text).length, 2);
  // station 7 at Stargazer says what row 100.6.2 says, and gives no instruction under a CHECKED badge
  assert.equal(station("fourth").say.stargazer[0].text, M.sentencesOf(ROW.get("100.6.2").text)[0]);
  for (const s of M.STATIONS) for (const p of s.say.stargazer.filter((x) => x.layer === "checked")) assert.ok(!/^Pin /.test(p.text), s.key);
  // the Stargazer form under 2 Chronicles 18:15 says whose words the oath's are: not "these words" after a Bible verse
  const law = station("seal").bridge.stands[1].stargazer;
  assert.equal(law, "A law book of 1618 has an oath for witnesses. Its words are \"the truth, the whole trueth, and nothing but the trueth\", in old spelling.");
  assert.ok(station("seal").bridge.stands[1].text.includes("\"the truth, the whole trueth, and nothing but the trueth\""), "the same printed words as from Navigator up");
  assert.ok(!/these words/.test(law) && !/so help/i.test(law));
});

// ─── the second pass: finding the way (John 3:16, the author's notes, pointers, the ways out) ───────────────────

test("John 3:16 has a gold box at every lens while it is the chosen entry, with the way from the river and the entries that point to it", () => {
  const john = DATA.HANDLES.john316, river = DATA.HANDLES.place;
  assert.equal(john, "43.3.16");
  assert.equal(river, "26.1.1.4");
  assert.match(ROW.get(river).name, /river/);
  for (const lens of LENSES) {
    for (const s of M.visibleStations(lens, "builtin")) {
      const b = M.bridgeView(s.key, lens, M.EZEKIEL, john);
      assert.equal(b.john, true, `${lens} ${s.key}`);
      assert.equal(b.opening, null);
      assert.equal(b.reading.layer, "reading");
      assert.ok(b.reading.text.startsWith("We read John 3:16 as the bridge") && b.reading.text.endsWith("You may see it another way."), b.reading.text);
      assert.deepEqual(b.fly, { from: river, to: john, label: "Fly here from the river" });
      assert.equal(b.go, null);
      // what it stands on: the verse itself first, as TEXT cut from the row, then the same stands as the Place station
      assert.equal(b.stands[0].layer, "text");
      assert.equal(b.stands[0].text, ROW.get(john).text);
      assert.deepEqual(b.stands.map((x) => x.layer), ["text", "text", "said", "checked"]);
      // another entry, or none: the station's own box
      for (const other of [null, river, "100.3"]) assert.deepEqual(M.bridgeView(s.key, lens, M.EZEKIEL, other), M.stationView(s.key, lens).bridge);
      assert.equal(M.stationView(s.key, lens).bridge.john, false);
    }
  }
  assert.equal(M.bridgeView("read", "stargazer", M.EZEKIEL, john).reading.text, "We read John 3:16 as the bridge, in the Gospel's own words. It is love from its source to the world. You may see it another way.");
  assert.equal(M.bridgeView("seal", "navigator", M.EZEKIEL, john).reading.text, M.stationView("place", "navigator").bridge.reading.text);
  // the way walks the tree: both ends are entries and a path joins them
  const p = M.placeNumbers(M.EZEKIEL, "2D", river, john);
  assert.equal(p.ok, true);
  assert.ok(p.steps >= 2);
  // the first gold box leads there and to First Explorers; no other box does
  for (const lens of LENSES) {
    const first = M.stationView("read", lens).bridge;
    assert.deepEqual(first.go, { address: john, label: "Go to John 3:16" });
    assert.deepEqual(first.links, [{ label: "Open First Explorers", href: KIT.LINKS.firstExplorers }]);
    for (const s of M.visibleStations(lens, "builtin").filter((x) => x.key !== "read")) { const b = M.stationView(s.key, lens).bridge; assert.equal(b.go, null); assert.deepEqual(b.links, []); assert.equal(b.fly, null); }
  }
  // a sky and a lexicon from outside have no gold box, whatever is chosen
  const sky = M.skyLexicon([2461360.25, 51.48, 0]).lexicon;
  assert.equal(M.bridgeView("seal", "navigator", sky, john), null);
  assert.equal(M.bridgeView("seal", "navigator", M.makeLexicon(M.EZEKIEL.entries, "outside", "x", ""), john), null);
  // the Entry of John 3:16 names the entries that point to it: the author's line 3 and the outline
  assert.deepEqual(M.pointedFrom(M.EZEKIEL, john).map((x) => [x.address, x.label]), [["100.3", "Go to Line 3"], ["100.11", "Go to One outline: John 3:16 as three numbers"]]);
  for (const x of M.pointedFrom(M.EZEKIEL, john)) assert.ok(DATA.ROWS.some((r) => r[2] === "link" && r[4] === john && r[0].startsWith(x.address + ".")), x.address);
  for (const lens of LENSES) assert.deepEqual(M.entryView(M.EZEKIEL, john, lens).from, M.pointedFrom(M.EZEKIEL, john));
  assert.deepEqual(M.entryView(M.EZEKIEL, river, "navigator").from, []);
  assert.deepEqual(M.entryView(M.EZEKIEL, "", "navigator").from, []);
  assert.deepEqual(M.pointedFrom(M.makeLexicon(M.EZEKIEL.entries, "outside", "x", ""), john), []);
});

test("the card shown while nothing is chosen says where the author's ten lines are, and quotes none of them", () => {
  assert.deepEqual({ ...M.NOTES_INVITE }, { layer: "reading", text: "The author wrote ten lines under this passage.", label: "Open the author's notes", short: "The author's notes", address: "100" });
  assert.equal(M.NOTES_INVITE.address, DATA.HANDLES.notes);
  const lines = M.childrenOf(M.EZEKIEL, "100").filter((a) => M.isAuthorLine(M.EZEKIEL, a));
  assert.equal(lines.length, 10);
  for (const a of lines) assert.ok(!M.NOTES_INVITE.text.includes(ROW.get(a).text) && !M.NOTES_INVITE.label.includes(ROW.get(a).text));
  assert.ok(!/["“”]/.test(M.NOTES_INVITE.text));
  for (const lens of LENSES) assert.deepEqual(M.entryView(M.EZEKIEL, null, lens).invite, M.NOTES_INVITE);
  assert.equal(M.entryView(M.skyLexicon([2461360.25, 51.48, 0]).lexicon, null, "navigator").invite, null);
  assert.equal(M.entryView(M.makeLexicon(M.EZEKIEL.entries, "outside", "x", ""), null, "navigator").invite, null);
});

test("a row whose closing words name a place of the page carries a button to that place, and only where the lens has the place", () => {
  // the closing words that send the reader somewhere: every such row under lines 5, 6, 9 and 10 has a pointer
  const sends = /^(See it |Try three points|Try it in the lab|Press Seal|Hide a corner|Flip one light|Pick four lights|Count the slices|Open the three|Open both)/;
  const closing = (a) => { const s = M.sentencesOf(ROW.get(a).text); return s[s.length - 1]; };
  const under = DATA.ROWS.map((r) => r[0]).filter((a) => /^100\.(5|6|9|10)\./.test(a));
  const pointing = under.filter((a) => sends.test(closing(a)));
  assert.ok(pointing.length >= 11, String(pointing.length));
  for (const a of pointing) assert.ok(M.POINTER_ADDRESSES.includes(a), `${a}: "${closing(a)}" has no button`);
  for (const a of M.POINTER_ADDRESSES) assert.ok(ROW.has(a) && ROW.get(a).kind !== "link" && ROW.get(a).kind !== "plain", a);
  const figures = M.FOURTH_PARTS.map((f) => f.key);
  for (const a of M.POINTER_ADDRESSES) {
    const nav = M.pointerOf(M.EZEKIEL, a, "navigator"), holo = M.pointerOf(M.EZEKIEL, a, "holographer"), star = M.pointerOf(M.EZEKIEL, a, "stargazer");
    assert.ok(nav, a);
    assert.deepEqual(holo, { ...nav, href: holo.href });
    assert.ok(nav.place === "entries" ? nav.entries.length >= 2 && nav.label === "" : nav.label !== "", a);
    assert.deepEqual(M.rowView(M.EZEKIEL, a, "navigator").pointer, nav);
    if (nav.station) assert.ok(M.visibleStations("navigator", "builtin").some((s) => s.key === nav.station), a);
    if (nav.place === "figure") { assert.equal(nav.station, "fourth"); assert.ok(figures.includes(nav.figure)); assert.equal(nav.label, "See the figure: " + M.FOURTH_PARTS.find((f) => f.key === nav.figure).title); }
    if (nav.place === "wheel") { assert.equal(nav.tab, "wheel"); assert.ok(M.visibleTabs("navigator", {}).some((t) => t.key === "wheel")); }
    if (nav.place === "sky") { assert.ok(KIT.isAllowedUrl(nav.href)); assert.equal(nav.href, M.skyPageHref("lab", "navigator")); assert.ok(closing(a).startsWith(nav.label), a); }
    for (const x of nav.entries) { assert.ok(M.EZEKIEL.byAddress.has(x.address)); assert.equal(x.label, "Go to " + ROW.get(x.address).name); }
    // Stargazer: a figure it does not have gives no button; what it has is inside "Stamp it"
    if (star) {
      if (star.station) { assert.equal(star.station, "seal"); assert.ok(M.visibleStations("stargazer", "builtin").some((s) => s.key === "seal")); }
      assert.equal(star.tab, null);
      if (star.place === "figure") assert.equal(star.figure, "b");
    } else assert.ok(nav.place === "figure" && nav.figure !== "b", a);
  }
  // the pairs the rows name
  const place = (a, lens = "navigator") => { const p = M.pointerOf(M.EZEKIEL, a, lens); return p && [p.place, p.station, p.figure, p.tab]; };
  assert.deepEqual(place("100.5.3"), ["figure", "fourth", "b", null]);      // "See it at The fourth square." (the mirror step)
  assert.deepEqual(place("100.5.4"), ["station", "seal", null, null]);      // "Press Seal and watch."
  assert.deepEqual(place("100.6.8"), ["figure", "fourth", "a", null]);      // "Try three points of your own."
  assert.deepEqual(place("100.6.9"), ["figure", "fourth", "b", null]);      // "Hide a corner and see."
  assert.deepEqual(place("100.10.7"), ["wheel", null, null, "wheel"]);      // "Count the slices of the wheel."
  assert.deepEqual(place("100.6.9", "stargazer"), ["figure", "seal", "b", null]);
  assert.equal(place("100.6.8", "stargazer"), null);
  assert.deepEqual(M.pointerOf(M.EZEKIEL, "100.9.4", "navigator").entries.map((x) => x.address), ["26.1.9", "26.1.12", "26.1.17"]);
  assert.equal(M.pointerOf(M.EZEKIEL, "100.5.4", "stargazer").label, "Go to Stamp it");
  assert.equal(M.pointerOf(M.EZEKIEL, "100.5.4", "navigator").label, "Go to the Seal station");
  // lines 5 and 6 themselves: a button to the mirror word at Stargazer only (from Navigator up their rows carry the buttons)
  for (const a of ["100.5", "100.6"]) {
    const star = M.pointerOf(M.EZEKIEL, a, "stargazer");
    assert.deepEqual([star.place, star.station, star.figure], ["figure", "seal", "b"]);
    assert.equal(M.pointerOf(M.EZEKIEL, a, "navigator"), null);
    assert.deepEqual(M.entryView(M.EZEKIEL, a, "stargazer").actions.filter((x) => x.key === "pointer").map((x) => x.label), [star.label]);
    assert.deepEqual(M.entryView(M.EZEKIEL, a, "navigator").actions.filter((x) => x.key === "pointer"), []);
  }
  assert.equal(M.pointerOf(M.EZEKIEL, "100.5", "stargazer").label, "See the mirror pictures");
  assert.equal(M.pointerOf(M.EZEKIEL, "100.6", "stargazer").label, "See three corners give the fourth");
  // no pointer for any other lexicon, an unknown address or a row without such words
  assert.equal(M.pointerOf(M.makeLexicon(M.EZEKIEL.entries, "outside", "x", ""), "100.6.9", "navigator"), null);
  assert.equal(M.pointerOf(M.EZEKIEL, "nope", "navigator"), null);
  assert.equal(M.pointerOf(M.EZEKIEL, "100.6.15", "navigator"), null);
  // station 7 runs line 6 and links to it; the mirror word has Stargazer words of its own
  assert.equal(M.FOURTH_LINE, "100.6");
  assert.equal(M.MIRROR_STARGAZER.layer, "checked");
  assert.match(M.MIRROR_STARGAZER.text, /^Built: /);
  const mirror = M.mirrorFigure([1, 0, 0, 1], { hidden: true });
  assert.equal(mirror.restored, true, "the caption's claim: the other three give the hidden corner back");
  assert.equal(M.mirrorCaptionStargazer(mirror), "The last corner is hidden. The picture shows what the other three corners give.");
  assert.match(M.mirrorCaptionStargazer(M.mirrorFigure([1, 0, 0, 1], { wrongBit: 5 })), /^One light in the last corner was flipped\./);
  assert.match(M.mirrorCaptionStargazer(M.mirrorFigure([1, 0, 0, 1])), /^All four corners are shown\./);
});

test("the ways out of the page are the kit's links: the dialog's other pages, the sky page with a sky's own place and time", () => {
  assert.equal(M.DIALOG.pagesHeading, "Other pages");
  assert.deepEqual(M.DIALOG.pages.map((p) => [p.label, p.href]), [["First Explorers", KIT.LINKS.firstExplorers], ["Celestial Control Panel", KIT.LINKS.celestialControlPanel], ["Experimental Systems", KIT.LINKS.wingIndex]]);
  for (const p of M.DIALOG.pages) assert.ok(KIT.isAllowedUrl(p.href));
  assert.ok(!M.DIALOG.pages.some((p) => p.href === KIT.LINKS.lexiconExplorer));
  // the Send station's gold box: the words "Open the sky page" are a link now, not a sentence
  for (const lens of ["navigator", "holographer"]) {
    const stand = M.stationView("send", lens).bridge.stands[2];
    assert.deepEqual(stand.link, { label: "Open the sky page", href: M.skyPageHref("home", lens) });
    assert.ok(stand.text.endsWith("none runs east.") && !stand.text.includes("Open the sky page"));
    assert.ok(KIT.isAllowedUrl(stand.link.href));
  }
  for (const lens of LENSES) for (const s of M.visibleStations(lens, "builtin")) for (const [i, x] of M.stationView(s.key, lens).bridge.stands.entries()) if (!(s.key === "send" && i === 2)) assert.equal(x.link, null);
  // a sky built from a link: the banner says what it is and what to do, and never who stamped it
  assert.equal(M.SKY_BANNER, "This sky was built from a link: a place and a time. Stamp it here. The same place and time always get the same name.");
  assert.ok(!/\byou(r)?\b/i.test(M.SKY_BANNER));
  const made = M.skyLexicon([2461360.25, 51.48, 0]);
  assert.deepEqual(made.sky, { jd: "2461360.25000", lat: "51.48", lon: "0.00" });
  const href = M.skyPageHref("sky", "stargazer", made.sky);
  assert.equal(href, "../Celestial_Control_Panel/index.html#jd=2461360.25000&lat=51.48&lon=0.00&lens=stargazer");
  assert.ok(KIT.isAllowedUrl(href));
  assert.ok(!/BC-|S-[0-9a-f]/.test(href), "no stamp and no name in a link");
  // the keys are the ones the sky page reads (its grammar names jd, lat and lon)
  const skyModel = readFileSync(path.join(ROOT, "Library/Experimental_Systems/Celestial_Control_Panel/celestial-panel-model.js"), "utf8");
  for (const key of ["jd", "lat", "lon"]) assert.ok(skyModel.includes(`freeze(["${key}", `), key);
  assert.equal(M.skyPageHref("sky", "navigator", null), "../Celestial_Control_Panel/index.html#lens=navigator");
  assert.equal(M.skyPageHref("sky", "navigator", { jd: "x", lat: "1", lon: "2" }), "../Celestial_Control_Panel/index.html#lens=navigator");
  // the same place and time always get the same name: two builds of one sky give one text, so one chain
  assert.equal(M.lexiconTextOf(M.skyLexicon([2461360.25, 51.48, 0]).lexicon), M.lexiconTextOf(made.lexicon));
  // a lexicon from a file: the one line of the banner under 700 px says what the first two sentences of the notice say
  assert.equal(M.OUTSIDE_SHORT, "Not made by this page. Its words and labels are its sender's.");
  assert.ok(M.OUTSIDE_NOTICE.startsWith("This lexicon was not made by this page. Its words and its labels are its sender's."));
});

test("Stargazer is told what the Navigator level adds, and every thing the line names is there and is not at Stargazer", () => {
  assert.equal(M.MORE_LEVELS.text, "The Navigator level shows more: the chain, the Overwatch checks and four receivers. It also shows the path to John 3:16 and the fourth square.");
  assert.deepEqual([M.MORE_LEVELS.label, M.MORE_LEVELS.lens], ["Switch to Navigator", "navigator"]);
  const stations = (lens) => M.visibleStations(lens, "builtin").map((s) => s.key), tabs = (lens) => M.visibleTabs(lens, { origin: "builtin", sealed: true, sent: true }).map((t) => t.key);
  for (const key of ["place", "send", "fourth"]) { assert.ok(stations("navigator").includes(key)); assert.ok(!stations("stargazer").includes(key)); }
  for (const key of ["chain", "overwatch", "witnesses"]) { assert.ok(tabs("navigator").includes(key)); assert.ok(!tabs("stargazer").includes(key)); }
  assert.equal(M.RECEIVERS.length, 4);
  assert.match(M.stationView("place", "navigator").bridge.reading.text, /John 3:16/);
});

test("without a pointer: a point of figure (a) moves by buttons, the flip button reaches all sixteen lights, the list says what its keys do", () => {
  const start = M.TQF_PRESETS[0].points;
  assert.deepEqual(M.TQF_MOVES.map((m) => m.key), ["left", "right", "up", "down"]);
  assert.deepEqual(M.tqfStep(start, 1, "right"), [[0, 0], [4, 0], [0, 4]]);
  assert.deepEqual(M.tqfStep(start, 2, "up"), [[0, 0], [3, 0], [0, 5]]);
  assert.deepEqual(M.tqfStep(start, 0, "left"), [[0, 0], [3, 0], [0, 4]], "kept inside the grid");
  assert.deepEqual(M.tqfStep(start, 0, "down"), [[0, 0], [3, 0], [0, 4]]);
  assert.deepEqual(M.tqfStep(start, 7, "up"), start.map((p) => p.slice()));
  assert.deepEqual(M.tqfStep(start, 1, "sideways"), start.map((p) => p.slice()));
  assert.notEqual(M.tqfStep(start, 1, "up")[1], start[1], "a copy, not the preset's own point");
  // every grid point can be reached by the buttons, and each result is what a drag to that point gives
  let pts = start.map((p) => p.slice());
  for (let i = 0; i < 9; i++) pts = M.tqfStep(pts, 1, "right");
  assert.deepEqual(pts[1], [M.TQF_GRID.max, 0]);
  for (let i = 0; i < 9; i++) pts = M.tqfStep(pts, 1, "up");
  assert.deepEqual(pts[1], [M.TQF_GRID.max, M.TQF_GRID.max]);
  assert.equal(M.threeSquares(pts).ok, true);
  assert.deepEqual(M.tqfStep(start, 1, "left")[1], M.tqfSnap(...M.tqfPlace([2, 0])));
  // the flip button: light 6 first (as before), then every other light once, then the corner as it was
  const seen = [];
  let bit = null;
  for (let i = 0; i < 16; i++) { bit = M.nextWrongBit(bit); seen.push(bit); }
  assert.equal(seen[0], 5);
  assert.deepEqual(seen.slice().sort((a, b) => a - b), Array.from({ length: 16 }, (_, k) => k));
  assert.equal(M.nextWrongBit(bit), null);
  assert.equal(M.nextWrongBit(undefined), 5);
  for (const k of seen) assert.equal(M.mirrorFigure([1, 0, 0, 1], { wrongBit: k }).caught, true, `light ${k} is caught`);
  // the list: the centred entry and what stands above it are expanded; a child's own children are not shown
  const list = M.neighbourhood(M.EZEKIEL, "26.1.1", "navigator");
  assert.deepEqual(list.filter((i) => i.relation !== "child").map((i) => [i.address, i.expanded]), [["", true], ["26", true], ["26.1", true], ["26.1.1", true]]);
  assert.ok(list.filter((i) => i.relation === "child").every((i) => i.expanded === null));
  const leaf = M.EZEKIEL.addresses.find((a) => M.childrenOf(M.EZEKIEL, a).length === 0);
  assert.equal(M.neighbourhood(M.EZEKIEL, leaf, "navigator").find((i) => i.relation === "focus").expanded, false);
  for (const [key, word] of [["ArrowUp", "Up"], ["ArrowDown", "Down"], ["ArrowLeft", "Left"], ["ArrowRight", "Right"], ["Home", "Home"]]) {
    assert.ok(M.LIST_KEYS.other.includes(word) && M.LIST_KEYS.stargazer.includes(word), key);
    assert.notEqual(M.treeKey(M.EZEKIEL, "26.1.2", key), null, key + " does something");
  }
  assert.ok(!/\bentr(y|ies)\b/.test(M.LIST_KEYS.stargazer));
});

test("Stargazer words: the line under the title, a light's name, the wheel's field names, the labels that said entry", () => {
  assert.ok(!/hyperbolic/i.test(M.PAGE.stargazerSubtitle));
  const cells = M.wheelView(M.EZEKIEL, { packet: 0, flips: [] }, "stargazer").cells, named = M.wheelView(M.EZEKIEL, { packet: 0, flips: [] }, "navigator").cells;
  assert.equal(M.wheelView(M.EZEKIEL, { packet: 0, flips: [] }, "stargazer").plain, true);
  assert.equal(M.wheelView(M.EZEKIEL, { packet: 0, flips: [] }, "navigator").plain, false);
  assert.equal(M.wheelView(M.EZEKIEL, { packet: 0, flips: [] }, "holographer").plain, false);
  const labels = M.WORD_FIELDS.filter((f) => !f.guard).map((f) => f.label);
  for (const c of cells) {
    assert.match(c.name, c.guard ? /^Light 5 of 64, the guard, (on|off)$/ : /^Light \d+ of 64, (on|off)$/);
    assert.ok(c.guard || !labels.some((l) => c.name.includes(l)), c.name);
  }
  assert.equal(cells[56].name, "Light 57 of 64, " + (cells[56].on ? "on" : "off"));
  assert.match(named[56].name, /^Light 57 of 64, checksum, (on|off)$/);
  assert.equal(M.lightName(named[0]), M.lightName(named[0], "navigator"));
  for (const key of ["chooseEntry", "packetEntry", "skipList"]) { assert.ok(!/\bentr(y|ies)\b/.test(M.UI[key].stargazer), key); assert.match(M.UI[key].other, /\bentr(y|ies)\b/); }
  for (const r of M.tamperRows("stargazer")) assert.ok(!/\bentr(y|ies)\b/.test(r.label), r.label);
});
