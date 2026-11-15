// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// The Ezekiel lexicon: Library/Experimental_Systems/Lexicon_Explorer/ezekiel-1.js and passage-as-supplied.js.
//
// What is checked here:
//   shape     the exports; every row accepted by makeEntry; parseLexiconText(lexiconText(rows)) gives the rows back;
//             at most 58,000 bytes; fourteen top-level entries; kinds, layers, book, chapter and verse rows; links;
//             the 34 terms; the handles; the ten lines; plain rows; the order of the facets under a line.
//   wording   no banned word under 100; search rows in their fixed form; every SAID row names a speaker from the
//             list kept here; the hedges and the sensitive points that can be searched for; van Paassen quoted at
//             most eight times; every quotation in a SAID row is one of QUOTATIONS (the list compared with the
//             sources in November 2026: a new or changed quotation fails until it is compared and listed).
//   counts    countWord over the nine verses; COUNT_WORDS; and CHECKED_FACTS: every row of layer checked has one
//             recomputation, made of a pattern that reads the numbers out of the row text and a core function (or
//             the committed rows) that yields them. Some facts also name the unit test that pins them.
//   supplied  the supplied passage: header, notice, verses, term phrases; no run of five supplied words in a row;
//             the share of supplied words.
//   chain     the bundle grows fourteen epochs and passes Overwatch; each LEXICON_TAMPERS row behaves as declared
//             on this lexicon's package; ROWS_SHA256.
//   e-text    only when OWL_KJV_DIR names a folder holding the 66 per-book Project Gutenberg King James files
//             (…bib0110.txt … bib6610.txt, with or without a prefix and a .plain ending): every verse row is
//             compared with it and the searches of the SAID/search rows are run again. Skipped otherwise.
//
// The checks certify bytes and counts. They do not show that a SAID row's source is right.
// Run: node --test tests/unit/ezekiel-lexicon.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.env.OWL_TEST_ROOT || path.resolve(import.meta.dirname, "../..");
const load = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const OW = await load("scripts/strix-overwatch.js");
const H = await load("scripts/hyperbolic-moves.js");
const K = await load("scripts/celestial-core.js");
const LEX_FILE = "Library/Experimental_Systems/Lexicon_Explorer/ezekiel-1.js";
const SUP_FILE = "Library/Experimental_Systems/Lexicon_Explorer/passage-as-supplied.js";
const LEX = await load(LEX_FILE);
const SUP = await load(SUP_FILE);
const { ROWS, HANDLES, COUNT_WORDS, ROWS_SHA256, TITLE } = LEX;
const { makeEntry, lexiconText, parseLexiconText, parentOf, childrenIndex, countWord, layerCounts } = OW;

// ─── shared helpers ──────────────────────────────────────────────────────────

const utf8Bytes = (s) => new TextEncoder().encode(s).length;
const sha256Hex = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const deg = (r) => r * 180 / Math.PI;
/** The sentences of a text: cut after a full stop, a question mark or an exclamation mark that a space follows. */
const sentences = (t) => t.split(/(?<=[.!?])\s+/).filter((s) => s.trim() !== "");
const wordsIn = (s) => s.trim().split(/\s+/).filter(Boolean).length;
/** A text without what stands between double quotation marks. */
const outsideQuotes = (t) => t.replace(/"[^"]*"/g, " ");
const quotesOf = (t) => (t.match(/"[^"]*"/g) || []).map((q) => q.slice(1, -1));
const memo = (make) => { let value, made = false; return () => { if (!made) { value = make(); made = true; } return value; }; };
/** A seeded generator of numbers in [0, 1): the same sequence on every run. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The entries. If a row is refused here, the first test says which; the other tests then work on what was accepted.
const entries = [];
const refused = [];
for (const r of Array.isArray(ROWS) ? ROWS : []) { try { entries.push(makeEntry(...r)); } catch (e) { refused.push(`${r[0]}: ${e.message}`); } }
const by = new Map(entries.map((e) => [e.address, e]));
const kids = childrenIndex(entries);
const childrenOf = (a) => (kids.get(a) || []).map((c) => by.get(c));
const T = (a) => { assert.ok(by.has(a), `row ${a} exists`); return by.get(a).text; };
const text = lexiconText(entries);
const tops = entries.filter((e) => !e.address.includes(".")).map((e) => e.address);
const verses = entries.filter((e) => e.kind === "verse");
const terms = entries.filter((e) => e.kind === "term");
const NINE = Array.from({ length: 9 }, (_, i) => `26.1.${i + 1}`);
const nine = () => NINE.map((a) => T(a));
/** How often a word or phrase stands in each of the nine verses, and in all of them (countWord of the core). */
const perVerse = (w) => nine().map((v) => countWord(v, w));
const inNine = (w) => perVerse(w).reduce((a, b) => a + b, 0);
/** The addresses of the verse rows that hold a phrase (countWord of the core), in order. */
const verseRowsWith = (phrase) => verses.filter((v) => countWord(v.text, phrase) > 0).map((v) => v.address);
/** "Ezekiel 1:10" → the verse row with that name (a name's "(context)" or "(opening words)" is not part of the citation). */
const citation = (e) => e.name.replace(/ \((context|opening words)\)$/, "");
const verseNamed = (cite) => { const hit = verses.filter((v) => citation(v) === cite); assert.equal(hit.length, 1, `one verse row is named ${cite}`); return hit[0]; };
/** "Ezekiel 1:9 and 1:12 of the living creatures, 1:17 of the wheels" → ["Ezekiel 1:9", "Ezekiel 1:12", "Ezekiel 1:17"]:
 *  a chapter and verse without a book takes the book named last. */
function citedIn(listText) {
  const out = [];
  let book = null;
  for (const m of listText.matchAll(/(?:((?:[12] )?[A-Z][a-z]+) )?(\d+):(\d+)/g)) {
    if (m[1]) book = m[1];
    assert.ok(book, "a citation names its book: " + listText);
    out.push(`${book} ${m[2]}:${m[3]}`);
  }
  return out;
}
const NUMBER_WORDS = new Map(Object.entries({
  once: 1, twice: 2, "three times": 3, "four times": 4, "five times": 5,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8, nine: 9, sixteen: 16, "sixty-three": 63,
  first: 1, fourth: 4, sixteenth: 16, "sixty-fourth": 64, half: 50,
}));
/** A number written in words in a row ("twice", "five times", "sixteenth") → the number. */
const num = (w) => { const k = String(w).toLowerCase(); assert.ok(NUMBER_WORDS.has(k), `"${w}" is a number word this test knows`); return NUMBER_WORDS.get(k); };
/** "once in verse 6, twice in verse 8, once in verse 9" → the nine per-verse counts it states. */
function statedPerVerse(listText) {
  const per = Array(9).fill(0);
  for (const m of listText.matchAll(/(once|twice|\w+ times) in verse (\d)\b/g)) per[Number(m[2]) - 1] += num(m[1]);
  return per;
}
/** `four living creatures (verse 5), four faces, four wings (verse 6), four sides and "they four" (verse 8)` →
 *  [{ verse: 5, phrase: "four living creatures" }, { verse: 6, phrase: "four faces" }, …]. */
function statedPhrases(listText) {
  const out = [];
  for (const m of listText.matchAll(/(.+?) \(verse (\d)\)/g)) {
    for (const part of m[1].split(/, | and /)) {
      const phrase = part.replace(/^(and|,)\s*/, "").replace(/"/g, "").trim();
      if (phrase !== "") out.push({ verse: Number(m[2]), phrase });
    }
  }
  return out;
}
/** Where each word first stands as a whole word in a text (case-sensitive); -1 if it does not. */
const wordPositions = (verseText, words) => words.map((w) => verseText.search(new RegExp("\\b" + w + "\\b")));
const rising = (xs) => xs.every((x, i) => x >= 0 && (i === 0 || xs[i - 1] < x));

// ─── the module ──────────────────────────────────────────────────────────────

const LICENCE = "Code: MIT. Quoted texts belong to their rights holders and are not covered by that licence.";

test("ezekiel-1.js: header, exports, plain quoted strings, frozen tables, and ROWS_SHA256 is the SHA-256 of JSON.stringify(ROWS)", () => {
  const src = readFileSync(path.join(ROOT, LEX_FILE), "utf8");
  assert.ok(src.startsWith("// SPDX-License-Identifier: MIT\n// Copyright (c) 2026 Ebayednoob\n"), "the SPDX and copyright lines come first");
  assert.ok(src.includes(LICENCE), "the licence line of 1.3 is in the header");
  assert.ok(!src.includes("`"), "no template literal: the rows are plain quoted strings");
  assert.ok(!/^\s*import\b/m.test(src), "the data module imports nothing");
  assert.deepEqual(Object.keys(LEX).sort(), ["COUNT_WORDS", "HANDLES", "ROWS", "ROWS_SHA256", "TITLE"]);
  assert.equal(typeof TITLE, "string");
  assert.ok(TITLE.includes("King James"), "the title names the translation");
  assert.ok(Array.isArray(ROWS) && ROWS.length > 0);
  for (const r of ROWS) assert.ok(Array.isArray(r) && r.length === 5 && r.every((x) => typeof x === "string"), "a row is five strings: " + JSON.stringify(r).slice(0, 80));
  assert.ok(Object.isFrozen(ROWS) && ROWS.every(Object.isFrozen) && Object.isFrozen(HANDLES) && Object.isFrozen(COUNT_WORDS), "ROWS, its rows, HANDLES and COUNT_WORDS are frozen");
  assert.match(ROWS_SHA256, /^[0-9a-f]{64}$/);
  assert.equal(ROWS_SHA256, sha256Hex(JSON.stringify(ROWS)), "a row was changed and ROWS_SHA256 was not set again");
});

test("every row is accepted by makeEntry, the text reads back to the same rows, it has at most 58,000 bytes and fourteen top-level entries", () => {
  assert.deepEqual(refused, [], "rows refused by makeEntry");
  assert.equal(entries.length, ROWS.length);
  entries.forEach((e, i) => assert.deepEqual([e.address, e.layer, e.kind, e.name, e.text], [...ROWS[i]], "a row is stored as written (already in NFC)"));
  assert.equal(by.size, entries.length, "addresses are distinct");
  const back = parseLexiconText(text);
  assert.equal(back.length, entries.length);
  back.forEach((e, i) => assert.equal(e.line, entries[i].line));
  const size = utf8Bytes(text);
  assert.ok(size <= 58000, `the lexicon text has ${size} bytes; the limit of 6.1 is 58,000`);
  assert.ok(size <= OW.MAX_LEXICON_BYTES && entries.length <= OW.MAX_ENTRIES && tops.length <= OW.MAX_EPOCHS);
  assert.deepEqual(tops, ["0", "5", "14", "19", "20", "26", "27", "40", "41", "42", "43", "49", "66", "100"]);
  assert.equal(OW.treeEpochTexts(entries).length, 14, "fourteen epochs");
  const counts = layerCounts(entries);
  assert.equal(counts.text + counts.said + counts.checked + counts.reading, entries.length);
  for (const layer of OW.LAYERS) assert.ok(counts[layer] > 0, `the lexicon has rows of layer ${layer}`);
});

// ─── kinds, layers, books, chapters, verses ──────────────────────────────────

const KINDS = "about rule notice tradition history book chapter verse term plain lexicon search count geometry sky code spec note link".split(" ");
const BOOKS = { 5: "Deuteronomy", 14: "2 Chronicles", 19: "Psalms", 20: "Proverbs", 26: "Ezekiel", 27: "Daniel", 40: "Matthew", 41: "Mark", 42: "Luke", 43: "John", 49: "Ephesians", 66: "Revelation" };
const VERSES = ("5.19.15 14.18.15 19.69.8 19.69.9 20.30.18 26.1.1 26.1.2 26.1.3 26.1.4 26.1.5 26.1.6 26.1.7 26.1.8 26.1.9 26.1.10 26.1.12 26.1.16 26.1.17 26.10.20 " +
  "27.3.25 40.3.16 40.5.34 40.18.16 40.25.35 41.1.10 42.3.21 43.1.1 43.1.14 43.1.51 43.2.17 43.3.13 43.3.16 43.17.16 43.18.36 43.18.37 49.2.12 49.2.19 66.4.7").split(" ");
const CONTEXT_VERSES = ["26.1.10", "26.1.12", "26.1.16", "26.1.17"];

test("kinds are the nineteen of 6.1 and every kind sits in its layer", () => {
  for (const e of entries) {
    assert.ok(KINDS.includes(e.kind), `${e.address}: kind ${e.kind} is not one of 6.1`);
    if (e.layer === "text") assert.ok(e.kind === "verse" || e.kind === "term", `${e.address}: the text layer holds verses and terms only`);
    if (["verse", "term"].includes(e.kind)) assert.equal(e.layer, "text", `${e.address}: a ${e.kind} is layer text`);
    if (["search", "lexicon", "history", "tradition", "notice", "spec"].includes(e.kind)) assert.equal(e.layer, "said", `${e.address}: kind ${e.kind} is layer said`);
    if (["count", "geometry", "sky", "code"].includes(e.kind)) assert.equal(e.layer, "checked", `${e.address}: kind ${e.kind} is layer checked`);
    if (["about", "rule", "note", "link", "book", "chapter"].includes(e.kind)) assert.equal(e.layer, "reading", `${e.address}: kind ${e.kind} is layer reading`);
  }
  assert.deepEqual(new Set(entries.map((e) => e.kind)), new Set(KINDS), "every kind of 6.1 is used");
  assert.deepEqual(by.get("0") && [by.get("0").layer, by.get("0").kind], ["reading", "about"]);
  assert.deepEqual(by.get("0.1") && [by.get("0.1").layer, by.get("0.1").kind], ["reading", "rule"]);
  assert.deepEqual(by.get("0.2") && [by.get("0.2").layer, by.get("0.2").kind], ["said", "notice"]);
});

test("book, chapter and verse rows: the 38 verses of 6.2 under their books and chapters, named by citation, with the address as the citation", () => {
  assert.deepEqual(verses.map((e) => e.address), VERSES);
  assert.deepEqual(tops.filter((t) => t !== "0" && t !== "100").map((t) => `${t} ${by.get(t).kind} ${by.get(t).name}`), Object.entries(BOOKS).map(([n, name]) => `${n} book ${name}`));
  for (const e of entries) {
    const parts = e.address.split("."), top = parts[0], bookName = top === "19" ? "Psalm" : BOOKS[top];
    if (e.kind === "book") assert.ok(e.text === "" && parts.length === 1, `${e.address}: a book row is a top-level entry with no text`);
    if (e.kind === "chapter") {
      assert.ok(parts.length === 2 && e.text === "" && by.get(top)?.kind === "book", `${e.address}: a chapter row sits under its book and has no text`);
      assert.equal(e.name, `${bookName} ${parts[1]}`);
      assert.ok(childrenOf(e.address).length > 0 && childrenOf(e.address).every((c) => c.kind === "verse"), `${e.address}: a chapter holds verses and nothing else`);
    }
    if (e.kind === "verse") {
      assert.ok(parts.length === 3 && by.get(parentOf(e.address))?.kind === "chapter", `${e.address}: a verse row sits under its chapter`);
      const suffix = CONTEXT_VERSES.includes(e.address) ? " (context)" : e.address === "43.18.36" ? " (opening words)" : "";
      assert.equal(e.name, `${bookName} ${parts[1]}:${parts[2]}${suffix}`);
      assert.ok(e.text.length > 0 && !e.text.includes("\n") && e.text === e.text.trim() && !/ {2}/.test(e.text), `${e.address}: one line of text, single spaces`);
      if (Number(top) >= 40) assert.ok(!e.text.includes("LORD"), `${e.address}: no New Testament verse in which the e-text prints LORD in capitals (1.3)`);
      for (const c of childrenOf(e.address)) assert.equal(c.kind, "term", `${c.address}: only terms stand under a verse`);
    }
  }
  assert.equal(T("43.18.36"), "Jesus answered, My kingdom is not of this world", "John 18:36 holds its opening words only (1.4 item 1)");
  assert.ok(nine().join(" ").includes("LORD"), "the e-text's capitals are kept");
});

// ─── links ───────────────────────────────────────────────────────────────────

// Link names that quote King James words after "Book C:V: ": the words must stand in the verse the link leads to.
const LINK_QUOTES = [
  ["100.1.3", "an alien unto my mother's children"], ["100.1.5", "he that came down from heaven"], ["100.1.6", "not of the world"],
  ["100.1.7", "I was a stranger"], ["100.1.8", "no more strangers and foreigners"], ["100.1.9", "among the captives"],
  ["100.2.3", "a wheel in the middle of a wheel"], ["100.4.3", "the face of an eagle"], ["100.4.4", "the fourth beast was like a flying eagle"],
  ["100.6.5", "four men"], ["100.6.5", "the form of the fourth"], ["100.7.3", "nothing but the truth"], ["100.7.4", "bear witness unto the truth"],
  ["100.7.5", "Swear not at all"], ["100.9.3", "they turned not when they went"], ["100.10.3", "In the beginning was the Word"],
];

test("every link row is layer reading, has a name, and its text is exactly one other address that exists", () => {
  const links = entries.filter((e) => e.kind === "link");
  assert.ok(links.length >= 30, "the lexicon has its links");
  for (const e of links) {
    assert.equal(e.layer, "reading", `${e.address}: a link is this project's reading`);
    assert.ok(e.name.trim().length >= 8, `${e.address}: the name says why the link is made`);
    assert.match(e.text, /^\d+(\.\d+)*$/, `${e.address}: the text is one address`);
    assert.ok(by.has(e.text), `${e.address}: broken link to ${e.text}`);
    assert.ok(e.text !== e.address && !e.text.startsWith(e.address + ".") && e.text !== parentOf(e.address), `${e.address}: a link leads away from its own entry`);
    assert.equal(childrenOf(e.address).length, 0, `${e.address}: a link has no children`);
    const cited = /^((?:[12] )?[A-Z][a-z]+ \d+:\d+)\b/.exec(e.name);
    if (cited) assert.equal(citation(by.get(e.text)), cited[1], `${e.address}: the name cites ${cited[1]} and the link leads to it`);
  }
  for (const [address, words] of LINK_QUOTES) {
    const e = by.get(address);
    assert.ok(e && e.kind === "link", `${address} is a link`);
    assert.ok(e.name.includes(words), `${address}: the name holds the words "${words}"`);
    assert.ok(T(e.text).includes(words), `${address}: "${words}" stands in ${by.get(e.text).name}`);
  }
  // 6.3: the links each line must have
  const need = { "100.1": ["19.69.8", "43.3.13", "43.17.16", "40.25.35", "49.2.19", "26.1.1"], "100.2": ["26.1.16"], "100.3": ["43.3.16", "100.11"], "100.4": ["100.11"],
    "100.5": ["100.11"], "100.6": ["5.19.15", "40.18.16", "27.3.25", "20.30.18"], "100.7": ["14.18.15", "43.18.37", "40.5.34"], "100.8": ["100.9", "26.1.12"],
    "100.9": ["26.1.9"], "100.10": ["43.1.1", "100.11", "26.1.16"], "100.11": ["43.3.16"], "26.1.9.2": ["100.9"], "26.1.5.1": ["26.10.20"] };
  for (const [a, targets] of Object.entries(need)) {
    const have = childrenOf(a).filter((c) => c.kind === "link").map((c) => c.text);
    for (const t of targets) assert.ok(have.includes(t), `${a} links to ${t}`);
  }
});

// ─── terms and handles ───────────────────────────────────────────────────────

const TERMS = {
  "26.1.1": ["the thirtieth year", "in the fourth month, in the fifth day of the month", "among the captives", "the river of Chebar", "the heavens were opened", "visions of God"],
  "26.1.2": ["the fifth year of king Jehoiachin's captivity"],
  "26.1.3": ["The word of the LORD", "Ezekiel the priest, the son of Buzi", "the land of the Chaldeans", "the hand of the LORD"],
  "26.1.4": ["a whirlwind", "out of the north", "a great cloud", "a fire infolding itself", "the colour of amber"],
  "26.1.5": ["four living creatures", "the likeness of a man"],
  "26.1.6": ["four faces", "four wings"],
  "26.1.7": ["straight feet", "the sole of a calf's foot", "burnished brass"],
  "26.1.8": ["the hands of a man", "on their four sides", "they four"],
  "26.1.9": ["joined one to another", "they turned not when they went", "straight forward"],
  "26.1.10": ["the face of a man", "the face of a lion", "the face of an ox", "the face of an eagle"],
  "26.1.16": ["a wheel in the middle of a wheel"],
};

test("the 34 terms of 6.4, numbered from 1 in its order: each name is a case-sensitive substring of its verse and the text is empty", () => {
  const want = Object.entries(TERMS).flatMap(([v, names]) => names.map((n, i) => `${v}.${i + 1}|${n}`));
  assert.equal(want.length, 34);
  assert.deepEqual(terms.map((t) => `${t.address}|${t.name}`), want);
  for (const t of terms) {
    const verse = by.get(parentOf(t.address));
    assert.equal(verse?.kind, "verse", `${t.address}: a term stands under a verse`);
    assert.ok(verse.text.includes(t.name), `${t.address}: "${t.name}" is not in ${verse.name}, letter for letter`);
    assert.equal(t.text, "", `${t.address}: a term has no text of its own`);
  }
});

const WANT_HANDLES = { dateTerm: "26.1.1.2", place: "26.1.1.4", heavensOpened: "26.1.1.5", north: "26.1.4.2", notTurning: "26.1.9.2", wheel: "26.1.16.1", notes: "100",
  outline: "100.11", fourthSquare: "100.6", oath: "100.7", sixteenth: "100.10", john316: "43.3.16", tradition: "0.3", bridge: "0.5" };
const HANDLE_NAMES = { dateTerm: "in the fourth month, in the fifth day of the month", place: "the river of Chebar", heavensOpened: "the heavens were opened", north: "out of the north",
  notTurning: "they turned not when they went", wheel: "a wheel in the middle of a wheel", notes: "The author's notes", outline: "One outline: John 3:16 as three numbers",
  fourthSquare: "Line 6", oath: "Line 7", sixteenth: "Line 10", john316: "John 3:16", tradition: "Ezekiel 1 in Jewish tradition", bridge: "The bridge" };

test("HANDLES is the table of 6.5, member for member, and every handle exists with the expected name", () => {
  assert.deepEqual({ ...HANDLES }, WANT_HANDLES);
  assert.deepEqual(Object.keys(HANDLES), Object.keys(WANT_HANDLES));
  for (const [k, a] of Object.entries(WANT_HANDLES)) assert.equal(by.get(a)?.name, HANDLE_NAMES[k], `handle ${k} (${a})`);
});

// ─── the author's lines ──────────────────────────────────────────────────────

const LINES = ["Jesus is the O.G. \"Alien\" <3", "The Crop Circles are Directive Codes for messages of prophets.", "John: 3.16",
  "Book of John [4:(Matt Mark Luke):1] <-- Being a Whole (3)", "Chapter 3, Same procedure of building.", "3 squares, to imply certify the Fourth Square as Truth.",
  "Being the Whole Truth, and Nothing but the Truth.", "So help you God if you try to steer others away.", "They did not turn as they moved...",
  "Verse 16, the 1/16 of the Cubit M.C. Escher graphs point to. The beginning. It was the Word. The word was True. The word was Whole."];
const LINE_ADDRESSES = LINES.map((_, i) => `100.${i + 1}`);
const FRAME_OF_LINE_8 = "The author's own words, in the style of the courtroom oath: a warning against leading people away from the truth. The page quotes them. It is not saying them to you.";
// The facets under each line, as planned (layer/kind in order). A relabelled, moved, added or dropped facet shows here.
const PLAN = {
  "100.1": "said/plain reading/plain reading/link reading/link reading/link reading/link reading/link reading/link reading/link checked/count said/search said/history said/history reading/note reading/note",
  "100.2": "said/plain reading/plain reading/link checked/code checked/geometry said/history",
  "100.3": "reading/plain checked/plain reading/link reading/link checked/code said/history",
  "100.4": "checked/plain reading/plain reading/link reading/link reading/link checked/count checked/count said/history said/tradition said/tradition said/history",
  "100.5": "checked/plain reading/link checked/code checked/code",
  "100.6": "reading/plain checked/plain reading/link reading/link reading/link reading/link reading/link checked/geometry checked/code checked/code checked/geometry checked/geometry checked/geometry checked/count said/spec said/search said/lexicon",
  "100.7": "checked/plain said/plain reading/link reading/link reading/link checked/code said/history said/search",
  "100.8": "reading/plain reading/plain reading/link reading/link said/history reading/note",
  "100.9": "checked/plain checked/plain reading/link checked/count checked/geometry said/search reading/note reading/note",
  "100.10": "checked/plain said/plain reading/link reading/link reading/link checked/code checked/code checked/code said/spec said/spec said/history said/history said/history reading/note",
  "100.11": "reading/plain reading/link checked/count checked/count checked/code said/history reading/note",
};

test("row 100 and the ten lines: the author's words in the author's order, each reading/note named Line n", () => {
  const head = by.get("100");
  assert.deepEqual([head.layer, head.kind, head.name], ["reading", "note", "The author's notes"]);
  assert.ok(head.text.includes("in the author's order") && head.text.includes("spelling corrected in two places"), "row 100 says: spelling corrected in two places (1.4 item 9)");
  assert.deepEqual(childrenOf("100").map((e) => e.address), [...LINE_ADDRESSES, "100.11"]);
  LINES.forEach((line, i) => {
    const e = by.get(LINE_ADDRESSES[i]);
    assert.deepEqual([e.layer, e.kind, e.name, e.text], ["reading", "note", `Line ${i + 1}`, line]);
  });
  assert.deepEqual([by.get("100.11").layer, by.get("100.11").kind], ["reading", "note"]);
  // line 8 stands only in its own row, always with the framing line of 1.4 item 4
  for (const e of entries) if (e.address !== "100.8") assert.ok(!(e.name + " " + e.text).toLowerCase().includes("so help you god if"), `${e.address}: line 8 stands only in row 100.8`);
  assert.ok(childrenOf("100.8").some((e) => e.layer === "reading" && e.kind === "note" && e.text === FRAME_OF_LINE_8), "line 8 carries the framing line of 1.4 item 4, word for word");
  // line 9 is named as a quotation in the NIV wording (1.4 item 8)
  assert.ok(childrenOf("100.9").some((e) => e.layer === "reading" && e.text.includes("NIV")), "line 9: the translation the author quotes is named");
});

test("under every line and under 100.11: facets as planned, in the order plain, links, checked, said, reading, with at least one said or checked facet", () => {
  const group = (e) => (e.kind === "plain" ? 0 : e.kind === "link" ? 1 : e.layer === "checked" ? 2 : e.layer === "said" ? 3 : e.layer === "reading" ? 4 : 9);
  for (const a of [...LINE_ADDRESSES, "100.11"]) {
    const c = childrenOf(a), g = c.map(group);
    assert.equal(c.map((e) => `${e.layer}/${e.kind}`).join(" "), PLAN[a], `${a}: the facets and their layers are the planned ones`);
    for (const e of c) {
      if (e.kind !== "link") assert.ok(["reading", "said", "checked"].includes(e.layer), `${e.address}: a facet under a line is reading, said or checked`);
      assert.equal(childrenOf(e.address).length, 0, `${e.address}: a facet has no children`);
    }
    assert.ok(g.every((x, i) => x !== 9 && (i === 0 || g[i - 1] <= x)), `${a}: order plain, links, checked, said, reading`);
    assert.ok(c.some((e) => e.kind !== "link" && (e.layer === "said" || e.layer === "checked")), `${a}: at least one said or checked facet`);
    assert.ok(c.some((e) => e.kind !== "link" && e.kind !== "plain" && (e.layer === "said" || e.layer === "checked")), `${a}: at least one fuller said or checked facet`);
  }
});

const BANNED_UNDER_100 = ["however", "in fact", "actually", "the other way", "wrong", "mistaken", "merely"];

test("no row under 100 contains however, in fact, actually, the other way, wrong, mistaken or merely", () => {
  const under = entries.filter((e) => e.address === "100" || e.address.startsWith("100."));
  assert.ok(under.length > 100);
  for (const e of under) {
    const hay = (e.name + "\n" + e.text).toLowerCase();
    for (const w of BANNED_UNDER_100) assert.ok(!hay.includes(w), `${e.address} contains "${w}"`);
  }
});

// ─── plain rows ──────────────────────────────────────────────────────────────

test("every term and every line has one to three plain children, which come first; a plain row has at most two sentences of at most 15 words", () => {
  const owners = [...terms.map((t) => t.address), ...LINE_ADDRESSES, "100.11"];
  for (const a of owners) {
    const c = childrenOf(a), first = c.findIndex((e) => e.kind !== "plain"), n = first < 0 ? c.length : first;
    assert.ok(n >= 1 && n <= 3, `${a}: ${n} plain rows come first (one to three are wanted)`);
    assert.ok(c.slice(n).every((e) => e.kind !== "plain"), `${a}: a plain row stands after a fuller facet`);
  }
  const plain = entries.filter((e) => e.kind === "plain");
  for (const e of plain) {
    assert.ok(owners.includes(parentOf(e.address)), `${e.address}: a plain row stands under a term or a line`);
    assert.ok(["said", "checked", "reading"].includes(e.layer), `${e.address}: a plain row has the layer of what it says`);
    const ss = sentences(e.text);
    assert.ok(ss.length >= 1 && ss.length <= 2, `${e.address}: ${ss.length} sentences`);
    for (const s of ss) assert.ok(wordsIn(s) <= 15, `${e.address}: a sentence of ${wordsIn(s)} words: ${s}`);
    assert.match(e.text, /[.!?]$/, `${e.address}: a plain row ends its last sentence`);
    assert.ok(!/["()\[\];]/.test(e.text), `${e.address}: a plain row has no quotation marks, brackets or semicolons (so any sentence splitter reads it the same way)`);
  }
});

// ─── SAID rows: speakers, searches, hedges, quotations ───────────────────────

const SEARCH_FRAME_KJV = "A search of the Project Gutenberg King James e-text made for this project (November 2026) found ";
const SEARCH_FRAME_BOOK = "This project's search of two scans of the 1949 book found ";
// Speaker phrases. A SAID row must hold at least one of them in its text (the row name does not count).
const SPEAKERS = [
  SEARCH_FRAME_KJV.trim(), SEARCH_FRAME_BOOK.trim(), "This project's search of the King James Bible found",
  "King James Version, from the Project Gutenberg e-text", "Rabbinic tradition", "the Jewish Encyclopedia", "The Jewish Encyclopedia",
  "Pierre van Paassen", "Van Paassen",
  "The book says", "The book counts", "People who study", "A Hebrew dictionary of 1906", "The Hebrew lexicon of Brown, Driver and Briggs (1906)",
  "Davidson (1892)", "The scholar Davidson", "Kutsch (1985)", "Finegan (1950)", "H. V. Hilprecht",
  "American Standard Version (1901)", "Brenton's Septuagint in English (1844)", "the Douay Bible", "The King James says", "old translations say", "The old Greek translation",
  "Origen", "Irenaeus", "Jerome", "Augustine", "is usually given as", "is usually dated to", "as books on the language report",
  "Skeptical Inquirer", "SHD-CCP RFC 02", "The Catholic Encyclopedia (1912)", "H. W. Hoare (1902)", "A law book of 1618", "John Wilkinson", "Thomas Wilcox",
  "Owl Academy's Loom Weave", "STRIX_OVERWATCH.md", "D. Dunham (2003)",
];

test("every SAID row names a speaker in its text, and none says but, however, in fact or actually outside a quotation", () => {
  const said = entries.filter((e) => e.layer === "said");
  assert.ok(said.length > 60);
  const used = new Set();
  for (const e of said) {
    const hits = SPEAKERS.filter((p) => e.text.includes(p));
    assert.ok(hits.length > 0, `${e.address} ("${e.name}") names no speaker from the list: ${e.text.slice(0, 80)}`);
    hits.forEach((p) => used.add(p));
    assert.ok(!/\b(but|however|in fact|actually)\b/i.test(outsideQuotes(e.text)), `${e.address}: a SAID row has none of but, however, in fact, actually outside a quotation (1.6, Voice)`);
  }
  assert.deepEqual(SPEAKERS.filter((p) => !used.has(p)), [], "a speaker phrase no row uses should leave the list");
});

test("every search row is layer said, begins with one of the two fixed frames and ends with how to repeat the search", () => {
  const rows = entries.filter((e) => e.kind === "search");
  assert.deepEqual(rows.map((e) => e.address), ["0.4.1", "26.1.1.5.8", "26.1.16.1.3", "100.1.11", "100.6.16", "100.7.8", "100.9.6"]);
  for (const e of rows) {
    assert.equal(e.layer, "said", `${e.address}: a search of a text the page does not ship is SAID, never CHECKED`);
    const book = e.text.startsWith(SEARCH_FRAME_BOOK);
    assert.ok(book || e.text.startsWith(SEARCH_FRAME_KJV), `${e.address}: the fixed form of 1.1`);
    const last = sentences(e.text).at(-1);
    assert.match(last, book ? /^Search a scan of the book for this name\.$/ : /^Search the Project Gutenberg King James text for (this phrase|this word|"[^"]+")\.$/, `${e.address}: ends with how to repeat it`);
  }
  // nothing else speaks of the whole King James Bible or the whole book without that frame (1.1)
  for (const e of entries) {
    if (e.kind === "search" || e.kind === "verse") continue;
    if (/\b(whole|entire) (King James|Bible|e-text)\b/i.test(e.text) || /\bnowhere else\b/i.test(e.text)) assert.fail(`${e.address}: a statement about the whole Bible outside a search row`);
  }
  assert.match(T("100.1.1"), /^This project's search of the King James Bible found /, "the plain row of line 1 names the search as its speaker and says found");
});

// Every quotation in a SAID row, as compared with its source in November 2026 (the sources are named in the row; the
// scratch tables ezekiel-sources.tsv and notes-sources.tsv give file and line). King James phrases quoted in search rows
// are in the list too. To add or change a quotation: compare it with its source, then list it here.
const QUOTATIONS = new Map([
  ["0.3", ["work of the Chariot", "Ma'aseh Bereshit must not be explained before two, nor Ma'aseh Merkabah before one, unless he be wise and understands it by himself"]],
  ["0.4", ["As a Unitarian", "No really objective life of Jesus can be written."]],
  ["0.4.2", ["Jesus was not a visionary", "But there is no fulfillment here."]],
  ["26.1.1.1.4", ["Either of the age of Ezechiel; or, as others will have it, from the solemn covenant made in the eighteenth year of the reign of Josias."]],
  ["26.1.1.3.2", ["among the captives of his people at Tel-abib", "were settled"]],
  ["26.1.1.4.3", ["is doubtless identical with"]],
  ["26.1.1.4.4", ["The stream intended is undoubtedly the Kabaru", "not at present identified"]],
  ["26.1.1.5.8", ["I see the heavens opened"]],
  ["26.1.1.6.3", ["It was Ezechiel that saw the glorious vision, which was shewn him upon the chariot of cherubims."]],
  ["26.1.2.1.4", ["His captivity dates B.C. 597, and Ezekiel's call 592"]],
  ["26.1.3.2.3", ["God strengtheneth", "probably means"]],
  ["26.1.3.3.2", ["the land of the Chaldeans"]],
  ["26.1.4.1.2", ["tempest, storm-wind", "stormy wind", "sweeping wind"]],
  ["26.1.4.2.3", ["north", "as the hidden, dark"]],
  ["26.1.4.4.2", ["lit. taking hold of itself"]],
  ["26.1.4.5.2", ["evidently some shining substance"]],
  ["26.1.5.1.5", ["living thing, animal", "unfortunately rendered"]],
  ["26.1.5.2.4", ["likeness, similitude", "chiefly in Ezek."]],
  ["26.1.7.1.3", ["here means limbs", "means strictly", "legs were straight"]],
  ["26.1.7.2.2", ["their feet were winged, and there were sparks, like gleaming brass"]],
  ["26.1.7.3.2", ["burnished brass", "polished brass"]],
  ["26.1.10.1.2", ["on account of the genealogical table"]],
  ["26.1.10.2.2", ["on account of the voice of one crying in the desert"]],
  ["26.1.10.3.3", ["on account of the priesthood"]],
  ["26.1.10.4.4", ["like an eagle soars aloft"]],
  ["26.1.16.1.3", ["a wheel in the middle of a wheel"]],
  ["100.1.12", ["stated the contrast existing between what is and what should be"]],
  ["100.1.13", ["This was the chariot of God"]],
  ["100.3.6", ["God so loved it and still loves it"]],
  ["100.4.9", ["Afterwards, John", "composed a spiritual Gospel"]],
  ["100.4.11", ["the three synoptic gospels"]],
  ["100.6.15", ["A = (Q₁ + Q₂ + Q₃)² − 2(Q₁² + Q₂² + Q₃²) ( = 16 · area² ≥ 0 )", "The points are collinear iff A = 0."]],
  ["100.6.16", ["three witnesses"]],
  ["100.6.17", ["a son of the gods"]],
  ["100.7.7", ["the whole truth, and nothing but the truth", "the truth, the whole trueth, and nothing but the trueth, so helpe you God"]],
  ["100.7.8", ["nothing but the truth"]],
  ["100.8.5", ["so helpe you God"]],
  ["100.9.6", ["they turned not when they went", "they turned not as they went"]],
  ["100.10.9", ["1/16 M.C. ESCHER SYMMETRY"]],
  ["100.10.10", ["64-bit cubit", "is not defined anywhere in the specifications yet"]],
  ["100.10.13", ["Man is to be whole, perfect, absolute at all times and in all things."]],
]);
// The eight quotations of van Paassen (1.3 allows eight, each of at most two sentences).
const VAN_PAASSEN_ROWS = ["0.4", "0.4.2", "100.1.12", "100.3.6", "100.4.11", "100.10.13"];

test("quotations: every quotation in a SAID row is in the list compared with the sources; van Paassen is quoted at most eight times", () => {
  for (const e of entries) {
    if (e.layer !== "said") continue;
    assert.deepEqual(quotesOf(e.text), QUOTATIONS.get(e.address) || [], `${e.address} ("${e.name}"): a quotation that is not in the compared list (or one that left the row)`);
    assert.equal((e.text.match(/"/g) || []).length % 2, 0, `${e.address}: quotation marks come in pairs`);
  }
  for (const a of QUOTATIONS.keys()) assert.equal(by.get(a)?.layer, "said", `${a}: a listed quotation belongs to a SAID row`);
  // van Paassen: every row that names him or stands under 0.4 is counted
  const his = entries.filter((e) => /^0\.4(\.|$)/.test(e.address) || /van Paassen/i.test(e.text));
  const quoting = his.filter((e) => e.layer === "said" && quotesOf(e.text).length > 0).map((e) => e.address);
  assert.deepEqual(quoting, VAN_PAASSEN_ROWS);
  const quotes = VAN_PAASSEN_ROWS.flatMap((a) => quotesOf(T(a)));
  assert.ok(quotes.length <= 8, `van Paassen is quoted ${quotes.length} times; 1.3 allows eight`);
  for (const q of quotes) assert.ok(sentences(q).length <= 2, `a quotation of van Paassen has at most two sentences: ${q}`);
  for (const e of his) if (e.layer !== "said") assert.deepEqual(quotesOf(e.text).filter((q) => q !== "the design protocol of Why Jesus Died"), [], `${e.address}: van Paassen is quoted in SAID rows only`);
  // quotations in CHECKED rows are King James words of a committed verse
  for (const e of entries) {
    if (e.layer !== "checked") continue;
    for (const q of quotesOf(e.text)) assert.ok(verses.some((v) => v.text.toLowerCase().includes(q.toLowerCase())), `${e.address}: "${q}" stands in no committed verse`);
  }
  // King James phrases quoted in the search rows that stand in committed verses do stand there
  for (const [a, q] of [["26.1.16.1.3", "a wheel in the middle of a wheel"], ["100.6.16", "three witnesses"], ["100.7.8", "nothing but the truth"], ["100.9.6", "they turned not when they went"]])
    assert.ok(quotesOf(T(a)).includes(q) && verses.some((v) => v.text.includes(q)), `${a}: "${q}" stands in a committed verse`);
});

test("hedges and sensitive points that can be searched for (1.3, 1.4)", () => {
  const all = entries.map((e) => e.name + "\n" + e.text).join("\n");
  // never
  for (const s of ["delivered to the Jews", "is made to reject the oath", "[a]", "pathological", "space shrinks", "Both sources may be"]) assert.ok(!all.includes(s), `no row contains "${s}"`);
  for (const e of entries) {
    if (e.kind === "verse") continue;
    assert.ok(!/\bJews?\b/.test(e.name + " " + e.text), `${e.address}: no statement about "the Jews" outside the verses (1.4 item 1)`);
    assert.ok(!/calls? Jesus an alien/i.test(e.name + " " + e.text), `${e.address}: nothing is said to call Jesus an alien (1.4 item 5)`);
  }
  for (const v of verses) if (v.address.startsWith("43.8.")) assert.fail(`${v.address}: no verse of John 8:21-47 is committed (1.4 item 1)`);
  // row 0.3: Ezekiel 1 belongs first to the Hebrew Bible; first and last sentences are shown above the reader
  assert.ok(T("0.3").startsWith("Ezekiel 1 belongs first to the Hebrew Bible.") && T("0.3").endsWith("It does not explain the vision."));
  assert.ok(T("0.3").includes("As the Jewish Encyclopedia reports it") && T("0.3").includes("(The Mishnah itself was not opened for this project.)"));
  assert.ok(!/Buzi/.test(T("0.3")) && entries.filter((e) => /Buzi/.test(e.text)).every((e) => e.kind === "verse"), "no wordplay on Buzi (1.4 item 10)");
  // row 0.5: the bridge is this project's reading
  assert.equal(by.get("0.5").layer, "reading");
  assert.ok(T("0.5").endsWith("This is this project's reading; no check depends on it, and the word bridge is not in the King James Bible."));
  // row 0.1: the address is a filing convention
  assert.ok(T("0.1").includes("It is a filing convention and carries no meaning."));
  // row 0.4 and below: van Paassen as 1.4 item 14 words him
  assert.ok(T("0.4").includes("who writes \"As a Unitarian\" and argues his own reconstruction"));
  assert.ok(T("0.4.1").includes("the running text never mentions him"));
  assert.ok(T("0.4.2").endsWith("come from early Christian writers and from this project, not from him."));
  assert.deepEqual([by.get("0.4.3").layer, by.get("0.4.3").kind], ["reading", "note"], "what the book does not contain is this project's judgement: READING");
  assert.ok(T("0.4.3").includes("the rules are this project's, and the book does not contain them."));
  // the pairings of Irenaeus, Jerome, Augustine and Origen are introduced as Christian readings of a Jewish prophet's book
  const pairings = entries.filter((e) => e.kind === "tradition" && /\b(Irenaeus|Jerome|Augustine|Origen)\b/.test(e.text) && e.address !== "100.4.9");   // 100.4.9: the order of the Gospels, not a pairing
  assert.deepEqual(pairings.map((e) => e.address), ["26.1.1.5.9", "26.1.6.1.5", "26.1.10.1.2", "26.1.10.2.2", "26.1.10.3.3", "26.1.10.4.4", "100.4.10"]);
  for (const e of pairings) assert.match(e.text, /^(A Christian reading|Christian readings) of a Jewish prophet's book/, `${e.address}: introduced as a Christian reading of a Jewish prophet's book`);
  // Origen is paraphrased, never quoted
  for (const e of entries) if (/\bOrigen\b/.test(e.text)) assert.deepEqual(quotesOf(e.text), [], `${e.address}: Origen is paraphrased, never quoted`);
  assert.ok(T("26.1.1.5.9").includes("Origen, in his first homily on Ezekiel (section 4), sets "));
  // dates the reports have only as general knowledge carry their hedge
  for (const e of entries) {
    if (e.kind === "verse") continue;
    if (/AD 180/.test(e.text)) assert.match(e.text, /usually dated to about AD 180/, `${e.address}: Irenaeus's date is hedged`);
    if (/two centuries later/.test(e.text)) assert.match(e.text, /Jerome, usually dated about two centuries later/, `${e.address}: Jerome's date is hedged`);
    if (/31 July 593 BC/.test(e.text) && e.layer === "said") assert.match(e.text, /is usually given as 31 July 593 BC/, `${e.address}: the usual date is hedged`);
    if (/\b597 BC\b/.test(e.text)) assert.match(e.text, /is usually dated to 597 BC/, `${e.address}: the year of the captivity is hedged`);
    if (/1958 to 1960/.test(e.text)) assert.match(e.text, /the prints are usually dated 1958 to 1960/, `${e.address}: the dates of Escher's prints are hedged`);
    if (/spacecraft/.test(e.text)) assert.match(e.text, /is usually dated to books of 1968 and 1974/, `${e.address}: the spacecraft reading is dated with a hedge, and no scholar is said to support it`);
    if (/1770s/.test(e.text)) assert.match(e.text, /is usually dated to the 1770s/, `${e.address}: Griesbach's edition is dated with a hedge`);
    if (/electricity/.test(e.text)) assert.equal(e.text, "The same word is used for electricity in modern Hebrew, as books on the language report.", `${e.address}: the hedged sentence of 1.3`);
    if (/reference works/.test(e.text)) assert.equal(e.address, "26.1.1.2.3", `${e.address}: "reference works" stands only in the date row section 6.4 words`);
  }
  // the conditional date row keeps its condition and its last sentence
  assert.ok(T("26.1.1.2.3").startsWith("If the fifth day is placed where most reference works place it, ") && T("26.1.1.2.3").endsWith("The book gives no hour."));
  assert.ok(T("26.1.1.2.4").includes("Older books give 592 BC"));
  // Hebrew transliterations are this project's spelling
  const hebrew = entries.filter((e) => e.kind === "lexicon" && /^26\.1\.\d+\.\d+\.\d+$/.test(e.address) && /Hebrew lexicon|Davidson|Septuagint/.test(e.text) && !["26.1.1.3.2", "26.1.1.4.4"].includes(e.address));
  for (const e of hebrew) assert.match(e.text, /^This project's spelling of the Hebrew: /, `${e.address}: a Hebrew word is given as this project's spelling`);
  assert.ok(hebrew.length >= 10);
  // early printed sources are marked
  for (const a of ["26.1.1.1.4", "26.1.1.6.3", "100.7.7", "100.8.5"]) assert.ok(T(a).includes("(spelling as printed)"), `${a}: spelling as printed`);
  // Chebar (Kebar in the NIV) at the first fuller use; hashmal as 6.4 words it
  const firstChebar = entries.find((e) => !["verse", "term", "plain", "link"].includes(e.kind) && e.text.includes("Chebar"));
  assert.ok(firstChebar.text.includes("Chebar (Kebar in the NIV)"), `${firstChebar.address}: the first fuller row that says Chebar writes: Chebar (Kebar in the NIV)`);
  assert.ok(T("26.1.4.5.2").endsWith("The Jewish Encyclopedia reports a Talmudic story that warns against prying into this word. This row gives only what dictionaries and translations say."));
  // crop circles: the documented fact first, the author's belief as the author's
  assert.match(T("100.2.1"), /^Skeptical Inquirer reports that in 1991 two men said /);
  assert.equal(T("100.2.2"), "The line is the author's own belief. No check on this page depends on it.");
  // line 1: the author's wordplay; what alien means where it occurs
  assert.ok(T("100.1.11").includes("In each it means a foreigner or outsider; alienated and alienate are other words."));
  assert.ok(childrenOf("100.1").some((e) => e.layer === "reading" && /the author's (play on words|wordplay)/.test(e.text)));
  // the translation is always named where a wording other than King James is used
  for (const e of entries) if (/\bNIV\b/.test(e.text + e.name)) assert.ok(["26.1.1.4.3", "100.9.7"].includes(e.address), `${e.address}: NIV is named only in the Chebar row and under line 9`);
});

test("READING rows give no instruction to the visitor, and CHECKED rows begin with the verb (1.6, Voice)", () => {
  const VERBS = /^(Counted|Counted from the rows|Worked out|Computed|Computed, as a contrast|Computed on the curved map|Compared|Read|Read from the rows|Tried|Tested|Built|Built and read back)[:.] /;
  for (const e of entries) {
    if (e.layer === "reading" && !["link", "book", "chapter"].includes(e.kind)) {
      for (const s of sentences(e.text)) assert.ok(!/^(Open|Try|Count|Press|Pick|Flip|Hide|Slide|Look|Find|Search|Work|See|Read)\b/.test(s), `${e.address}: an OUR IDEA row gives no instruction: ${s}`);
    }
    if (e.layer !== "checked") continue;
    // two rows keep sentences the specification words itself: the conditional date row (6.4) and the Stargazer sentence of 1.6
    if (e.address === "26.1.1.2.3") assert.ok(e.text.startsWith("If the fifth day is placed"));
    else if (e.address === "100.6.2") assert.equal(e.text, "Pin three points on the rim of this map. Then the place of every other point is settled.");
    else assert.match(e.text, VERBS, `${e.address}: a CHECKED row puts the verb first`);
  }
});

// ─── counts over the nine verses ─────────────────────────────────────────────

test("countWord over the nine committed verses: four 5, fifth 3, fourth 1, thirtieth 1; COUNT_WORDS says what each occurrence numbers", () => {
  assert.equal(inNine("four"), 5);
  assert.equal(inNine("fifth"), 3);
  assert.equal(inNine("fourth"), 1);
  assert.equal(inNine("thirtieth"), 1);
  assert.deepEqual(perVerse("four"), [0, 0, 0, 0, 1, 2, 0, 2, 0]);
  assert.deepEqual(perVerse("fifth"), [1, 2, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(inNine("sixteen"), 0, "the word sixteen is not in these verses");
  assert.deepEqual(COUNT_WORDS.map((c) => c.word), ["thirtieth", "fourth", "fifth", "four"]);
  for (const c of COUNT_WORDS) {
    assert.deepEqual(Object.keys(c), ["word", "numbers"]);
    assert.equal(c.numbers.length, inNine(c.word), `COUNT_WORDS ${c.word}: one item per occurrence`);
    assert.deepEqual(c.numbers.map((n) => n.verse), NINE.flatMap((a, i) => Array(perVerse(c.word)[i]).fill(a)), `COUNT_WORDS ${c.word}: verse by verse in reading order`);
    let from = 0, last = null;
    for (const n of c.numbers) {
      assert.deepEqual(Object.keys(n), ["verse", "words"]);
      assert.equal(countWord(n.words, c.word), 1, `COUNT_WORDS ${c.word}: "${n.words}" holds the word once`);
      if (n.verse !== last) { from = 0; last = n.verse; }
      const at = T(n.verse).indexOf(n.words, from);
      assert.ok(at >= 0, `COUNT_WORDS ${c.word}: "${n.words}" stands in ${n.verse}, after the item before it`);
      from = at + 1;
    }
  }
});

// ─── CHECKED_FACTS: every row of layer checked, recomputed ───────────────────

const GOLDEN = "9841D88D8B003CEA";
const SEEDS = Array.from({ length: 16 }, (_, s) => [s & 1, (s >> 1) & 1, (s >> 2) & 1, (s >> 3) & 1]);
const AT = "2026-11-15T00:00:00.000Z";

/** The Moon over the Kebar preset at the sunsets that begin and end the fifth day, for the usual and the other date. */
const moon = memo(() => {
  const site = K.SITES.find((s) => s.key === "kebar");
  const sunset = (parts) => K.sunEventOnLocalDay(parts, site.lat, site.lonEast, "set");
  const lit = (jd) => 100 * K.skyState(jd, site.lat, site.lonEast).phase.illuminatedFraction;
  const [usual, other] = K.EZEKIEL_DATES;
  const begins = sunset(usual.beginsDay), ends = sunset(usual.endsDay), otherEnds = sunset(other.endsDay);
  return { site, usual, other, begins, ends, litBegins: lit(begins), litEnds: lit(ends), litOther: lit(otherEnds), firstQuarter: K.nextPhaseTime(begins, 90),
    waxing: K.skyState(ends, site.lat, site.lonEast).phase.waxing };
});
/** Forward, left, back, right by 1 without turning; one slide alone; the same loop with slides of 0.001 (the flat limit). */
const walk = memo(() => {
  const loop = (d) => H.slidePath([0, 1, 2, 3].map((k) => ({ angle: k * Math.PI / 2, dist: d })));
  const P = loop(1), home = H.homecoming(P[4]), one = H.homecoming(H.slidePath([{ angle: 0.3, dist: 1 }])[1]);
  const O = P.map((F) => OW.originOf(F)), d = (i, j) => OW.hypDist(O[i], O[j]);
  const area = H.triangleArea(d(0, 1), d(1, 2), d(0, 2)) + H.triangleArea(d(0, 2), d(2, 3), d(0, 3)) + H.triangleArea(d(0, 3), d(3, 4), d(0, 4));
  return { home, one, area, flat: H.homecoming(loop(0.001)[4]) };
});
/** One mirror step on a square of side n (row-major bits): the square beside its three mirror images, side 2n. */
function mirrorStep(bits, n) {
  const out = new Array(4 * n * n);
  for (let y = 0; y < 2 * n; y++) for (let x = 0; x < 2 * n; x++) out[y * 2 * n + x] = bits[(y < n ? y : 2 * n - 1 - y) * n + (x < n ? x : 2 * n - 1 - x)];
  return out;
}
const hexOfBits = (bits) => { let h = ""; for (let i = 0; i < 64; i += 4) h += ((bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3]).toString(16).toUpperCase(); return h; };
/** For all 16 seeds: 2 × 2, one step to 4 × 4, the same step to 8 × 8, and that is seedMirror(seed). */
const mirrorBuilds = () => SEEDS.every((s) => { const four = mirrorStep(s, 2), eight = mirrorStep(four, 4); return four.length === 16 && eight.length === 64 && hexOfBits(eight) === OW.seedMirror(s); });
const mirrorWords = memo(() => SEEDS.map((s) => OW.seedMirror(s)));
function circumcircle(a, b, c) {
  const s = (p) => p[0] * p[0] + p[1] * p[1];
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  const x = (s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / d;
  const y = (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d;
  return [x, y, Math.hypot(a[0] - x, a[1] - y)];
}
/** 40 seeded moves of the disc (a turn, then a slide in a seeded direction). */
const discMoves = memo(() => { const rnd = seeded(20261115); return Array.from({ length: 40 }, () => { const a = rnd() * 2 * Math.PI; return OW.lmul(OW.rotZ(rnd() * 2 * Math.PI), OW.boostAlong([Math.cos(a), Math.sin(a), 0], 0.2 + 1.6 * rnd())); }); });
/** A move of the sky is fixed by where it sends three points of the rim: the map through three images sends every fourth where the move does. */
function threeRimPointsFixTheFourth() {
  const rnd = seeded(316);
  let worst = 0;
  for (const M of discMoves()) {
    const angles = [0.3, 1.9, 4.0, 5.2].map((a) => a + rnd());
    const z = angles.map((a) => [Math.cos(a), Math.sin(a)]);
    const w = z.map((p) => { const s = H.skyImage(M, [p[0], p[1], 0]); return [s.n[0], s.n[1]]; });
    const got = H.mobiusFromThree(z.slice(0, 3), w.slice(0, 3))(z[3]);
    worst = Math.max(worst, Math.hypot(got[0] - w[3][0], got[1] - w[3][1]));
  }
  assert.ok(worst < 1e-9, `the fourth point follows from three (largest miss ${worst})`);
}
/** The whole lexicon, grown once: the bundle, its report, its sealed package and what each tamper row does to it. */
const sealed = memo(async () => {
  const seen = [];
  const bundle = await OW.buildLexiconBundle(entries, { at: AT, onEpoch: ({ epoch, epochs, addedBytes }) => { seen.push([epoch, epochs, addedBytes]); } });
  const report = await OW.overwatchInspect(bundle);
  const keys = await OW.newSessionKeys();
  const { certificate } = await OW.issueCertificate(bundle, keys, AT);
  const wire = JSON.stringify(OW.makeHyperpack({ ...bundle, certificate }));
  const clean = await OW.readHyperpack(wire);
  const verdicts = new Map();
  for (const row of OW.LEXICON_TAMPERS) {
    const changed = await row.apply(JSON.parse(wire), { newKeys: () => OW.newSessionKeys(), at: AT });
    const v = await OW.readHyperpack(JSON.stringify(changed));
    verdicts.set(row.key, { got: v.ok ? "accepted" : v.failed, pack: v.pack, changed });
  }
  return { seen, bundle, report, certificate, wire, clean, verdicts };
});
const packets = memo(() => OW.lexiconPackets(text));
const bookRows = () => ["40", "41", "42", "43"].map((a) => { assert.equal(by.get(a)?.kind, "book"); return by.get(a).name; });
/** The 64 cells of a word: 16 sectors of 4 cells, 4 quadrants of 16 cells, each sector inside one quadrant. */
function wheelArithmetic() {
  const c = OW.glyphCells(GOLDEN), count = (key, v) => c.filter((x) => x[key] === v).length;
  assert.equal(GOLDEN.length, 16);
  assert.equal(c.length, 64);
  for (let s = 0; s < 16; s++) assert.equal(count("sector", s), 4);
  for (let q = 0; q < 4; q++) assert.equal(count("quadrant", q), 16);
  assert.ok(c.every((x) => x.sector === (x.i >> 2) && x.quadrant === (x.i >> 4) && (x.sector >> 2) === x.quadrant));
}
const PHRASE_9 = "they turned not when they went";
/** The facts shared by the two rows that state the square walk (0.874 and 78.0°). */
function squareWalkFacts(gapText, turnText, step) {
  const s = walk();
  assert.equal(step, "1", "the slides are of length 1");
  assert.equal(H.squareWalkGap(1).toFixed(3), gapText);
  assert.equal(deg(H.squareWalkTurn(1)).toFixed(1), turnText);
  assert.equal(gapText, "0.874");
  assert.equal(turnText, "78.0");
  assert.equal(s.home.distance.toFixed(3), gapText, "the path of four slides ends this far from home");
  assert.equal(deg(s.home.turnClockwise).toFixed(1), turnText, "slid home, the walker is turned this much, clockwise");
  assert.ok(Math.abs(H.squareWalkGap(1) - s.home.distance) < 1e-12 && Math.abs(H.squareWalkTurn(1) - s.home.turnClockwise) < 1e-12);
  assert.equal(s.one.turn, 0, "one straight slide turns nothing");
  assert.ok(Math.abs(s.one.distance - 1) < 1e-12);
  assert.ok(s.flat.distance / 0.001 < 1e-6 && s.flat.turnClockwise < 2e-6, "on flat paper both are zero (the limit of small slides)");
}
const UNIT = "tests/unit/";
const PIN = {
  moon: [UNIT + "celestial-core.test.mjs", "31 July 593 BC over Nippur: the sunset that ends the fifth day, and the Moon at that sunset"],
  walk: [UNIT + "hyperbolic-moves.test.mjs", "slides: forward, left, back, right by 1 ends 0.874463 from home; slid home, the body is found turned 78.0148 degrees clockwise"],
  gram: [UNIT + "hyperbolic-moves.test.mjs", "gramTqf: the triangle (0,0), (3,0), (0,4) has squares 9, 16, 25 and A = 576 = 16 x 6²"],
  three: [UNIT + "hyperbolic-moves.test.mjs", "mobiusFromThree: three points of the rim fix where every fourth goes (200 random moves of the disc, 1e-9)"],
  squares: [UNIT + "hyperbolic-moves.test.mjs", "squareNumbersNext: three consecutive squares fix the next (1, 4, 9 give 16; holds for 1..1000)"],
  lambert: [UNIT + "hyperbolic-moves.test.mjs", "ported helpers: regular quadrilaterals, the Lambert angle (0.5, 0.5 gives 74.2441 degrees) and the two-slide turn of 24.109145 degrees"],
  tiling: [UNIT + "hyperbolic-moves.test.mjs", "tilings: the constants of {4,5}, {4,6} and {4,8}; a flat or spherical {p,q} is refused"],
  mirror: [UNIT + "strix-lexicon.test.mjs", "seedMirror: four cells fill all 64; for all 16 seeds the guard bit holds, and any three corner squares give the fourth"],
  quarters: [UNIT + "strix-lexicon.test.mjs", "quarterParities: on 2,000 crystallised packets the parities of three quarters fix the fourth"],
  glyph: [UNIT + "strix-lexicon.test.mjs", "glyphCells and glyphHex: 64 cells in reading order; sector, ring, quadrant, row and col; the word comes back"],
  tampers: [UNIT + "strix-lexicon.test.mjs", "LEXICON_TAMPERS: every row changes a copy of the package as it says and meets the verdict it declares"],
  epochs: [UNIT + "strix-lexicon.test.mjs", "a small tree grows one real shdccp/2 epoch per top-level entry and passes every Overwatch check"],
};

// address → { by, pattern, check, pinned }.
//   by       where the numbers come from: "the rows" (countWord and comparisons over committed rows) or the core functions
//   pattern  reads the numbers and words out of the row text; the row must match it
//   check    (m, row) recomputes them and compares; may be async
//   pinned   optional: the unit tests, by file and title, that pin the same fact more widely
const CHECKED_FACTS = new Map();
const fact = (address, by_, pattern, check, pinned = []) => { assert.ok(!CHECKED_FACTS.has(address), "one fact per row: " + address); CHECKED_FACTS.set(address, { by: by_, pattern, check, pinned }); };
const ROWS_BY = "the rows (countWord, strix-overwatch.js)";

// ── the terms ──
fact("26.1.1.1.2", ROWS_BY, /^Counted: verse (\d) has (\w+) (once|twice), (\w+) (once|twice) and (\w+) (once|twice)\. Count them yourself\.$/, (m) => {
  for (const i of [2, 4, 6]) assert.equal(countWord(T("26.1." + m[1]), m[i]), num(m[i + 1]), m[i]);
});
fact("26.1.1.2.2", "skyState, sunEventOnLocalDay, EZEKIEL_DATES, SITES (celestial-core.js)", /^Worked out: if that date is right, the Moon grew to (half) lit\. Open the sky page\.$/, (m) => {
  const s = moon();
  assert.equal(Math.round(s.litEnds), num(m[1]), "half lit is 50 per cent, to the nearest per cent");
  assert.ok(s.litBegins < s.litEnds && s.waxing, "the Moon grew during the day");
}, [PIN.moon]);
fact("26.1.1.2.3", "skyState, sunEventOnLocalDay, nextPhaseTime, EZEKIEL_DATES, SITES (celestial-core.js)",
  /^If the fifth day is placed where most reference works place it, it ran from sunset on (\d+) July to sunset on (\d+) July (\d+) BC\. Over Nippur the Moon grew during that day from (\d+) % to (\d+) % lit and reached first quarter as the day ended\. On the other published date, the day ending at sunset on (\d+) July (\d+) BC, it ended (\d+) % lit\. The book gives no hour\.$/, (m) => {
    const s = moon();
    assert.ok(s.site.label.includes("Nippur"));
    assert.ok(s.usual.said.includes("most reference works"), "EZEKIEL_DATES names who gives the first date");
    assert.deepEqual(s.usual.beginsDay, { year: 1 - Number(m[3]), month: 7, day: Number(m[1]), calendar: "julian" });
    assert.deepEqual(s.usual.endsDay, { year: 1 - Number(m[3]), month: 7, day: Number(m[2]), calendar: "julian" });
    assert.equal(s.usual.label, `${m[2]} July ${m[3]} BC`);
    assert.equal(String(Math.round(s.litBegins)), m[4]);
    assert.equal(String(Math.round(s.litEnds)), m[5]);
    assert.deepEqual([m[4], m[5], m[8]], ["40", "50", "44"]);
    assert.ok(s.litBegins < s.litEnds && s.waxing);
    assert.ok(s.firstQuarter > s.begins && Math.abs(s.firstQuarter - s.ends) < 1 / 24, "first quarter falls within an hour of the sunset that ends the day");
    assert.deepEqual(s.other.endsDay, { year: 1 - Number(m[7]), month: 7, day: Number(m[6]), calendar: "julian" });
    assert.equal(s.other.label, `${m[6]} July ${m[7]} BC`);
    assert.equal(String(Math.round(s.litOther)), m[8]);
  }, [PIN.moon]);
fact("26.1.1.5.2", ROWS_BY, /^Counted: these (\w+) words stand in (\w+) verses kept here\. Look for the other one\.$/, (m, row) => {
  const term = by.get(parentOf(row.address)).name;
  assert.equal(wordsIn(term), num(m[1]));
  assert.equal(verseRowsWith(term).length, num(m[2]));
});
fact("26.1.1.5.7", ROWS_BY, /^Counted: these (\w+) words stand in (\w+) of this lexicon's rows: (Ezekiel 1:1 and Matthew 3:16)\. The same baptism reads "([^"]+)" in (Mark 1:10) and "([^"]+)" in (Luke 3:21)\.$/, (m, row) => {
  const term = by.get(parentOf(row.address)).name;
  assert.equal(wordsIn(term), num(m[1]));
  assert.deepEqual(verseRowsWith(term), citedIn(m[3]).map((c) => verseNamed(c).address));
  assert.equal(verseRowsWith(term).length, num(m[2]));
  assert.ok(verseNamed(m[5]).text.includes(m[4]) && verseNamed(m[7]).text.includes(m[6]));
  assert.ok(verseNamed("Matthew 3:16").text.includes("baptized") && verseNamed(m[7]).text.includes("baptized"), "the verses tell of a baptism");
});
const perVerseFact = (m) => {
  assert.deepEqual(perVerse(m[1]), statedPerVerse(m[3]), `where "${m[1]}" stands, verse by verse`);
  assert.equal(inNine(m[1]), num(m[2]));
};
fact("26.1.2.1.3", ROWS_BY, /^Counted: the word (\w+) stands (\w+ times) in these nine verses: (once in verse \d, twice in verse \d)\.$/, perVerseFact);
const bothTimesFact = (m) => {
  const want = Array(9).fill(0); want[Number(m[3]) - 1] = num(m[2]);
  assert.deepEqual(perVerse(m[1]), want);
  assert.equal(nine().join(" ").split(m[1]).length - 1, num(m[2]), "the same count with the capitals as written");
};
fact("26.1.3.1.2", ROWS_BY, /^Counted: the word (LORD) stands (twice) in these nine verses, both times in verse (\d)\.$/, bothTimesFact);
fact("26.1.3.2.2", ROWS_BY, /^Counted: the name (\w+) appears (once) in these nine verses\. Find it in verse (\d)\.$/, (m) => {
  const want = Array(9).fill(0); want[Number(m[3]) - 1] = num(m[2]);
  assert.deepEqual(perVerse(m[1]), want);
});
fact("26.1.3.4.1", ROWS_BY, /^Compared: verse (\d) says (I saw), and verse (\d) says (upon him)\. Read both\.$/, (m) => {
  assert.ok(T("26.1." + m[1]).includes(m[2]) && T("26.1." + m[3]).includes(m[4]));
  assert.ok(!T("26.1." + m[3]).includes("upon me"));
});
fact("26.1.3.4.2", ROWS_BY, /^Counted: the word (\w+) stands (once) in these nine verses, in verse (\d); the word (\w+) (once), in verse (\d)\.$/, (m) => {
  for (const [w, n, v] of [[m[1], m[2], m[3]], [m[4], m[5], m[6]]]) { const want = Array(9).fill(0); want[Number(v) - 1] = num(n); assert.deepEqual(perVerse(w), want, w); }
});
fact("26.1.4.2.1", ROWS_BY, /^Counted: of (\w+), (\w+), (\w+) and (\w+), only (\w+) is in these nine verses\. Look for it\.$/, (m) => {
  assert.deepEqual(m.slice(1, 5), ["north", "south", "east", "west"]);
  for (const w of m.slice(1, 5)) assert.equal(inNine(w) > 0, w === m[5], w);
});
fact("26.1.4.2.2", ROWS_BY, /^Counted: of the words ([\w, ]+) and (\w+), only (\w+) occurs in these nine verses: (once), in verse (\d)\. Right and left first appear in verse (\d+)\.$/, (m) => {
  const words = [...m[1].split(", "), m[2]];
  assert.deepEqual(words, ["north", "south", "east", "west", "right", "left"]);
  for (const w of words) assert.equal(inNine(w), w === m[3] ? num(m[4]) : 0, w);
  assert.equal(perVerse(m[3])[Number(m[5]) - 1], 1);
  assert.equal(m[6], "10", "verse 10 is the verse after the nine");
  assert.ok(countWord(T("26.1." + m[6]), "right") > 0 && countWord(T("26.1." + m[6]), "left") > 0);
});
const appearsFact = (m) => assert.equal(inNine(m[1]), num(m[2]));
fact("26.1.5.1.1", ROWS_BY, /^Counted: the word (four) appears (\w+ times) in these nine verses\. Count them yourself\.$/, appearsFact);
/** "the word four stands five times …: four living creatures (verse 5), …": every phrase stands in its verse with the word once. */
const phrasesFact = (m) => {
  const stated = statedPhrases(m[3]), per = Array(9).fill(0);
  for (const { verse, phrase } of stated) {
    assert.ok(T("26.1." + verse).includes(phrase), `"${phrase}" stands in verse ${verse}`);
    assert.equal(countWord(phrase, m[1]), 1, `"${phrase}" holds "${m[1]}" once`);
    per[verse - 1] += 1;
  }
  assert.equal(new Set(stated.map((s) => s.verse + "|" + s.phrase)).size, stated.length, "no phrase is listed twice");
  assert.deepEqual(perVerse(m[1]), per);
  assert.equal(stated.length, num(m[2]));
};
fact("26.1.5.1.4", ROWS_BY, /^Counted: the word (four) stands (\w+ times) in these nine verses: (.+)\.$/, phrasesFact);
fact("26.1.5.2.3", ROWS_BY, /^Counted: the word (likeness) stands (twice) in these nine verses, both times in verse (\d)\.$/, bothTimesFact);
fact("26.1.6.1.1", ROWS_BY, /^Worked out: (\w+) creatures with (\w+) faces each make (\w+) faces\. The word (\w+) is not here\.$/, (m) => {
  assert.equal(num(m[1]) * num(m[2]), num(m[3]));
  assert.equal(m[4], m[3]);
  assert.equal(inNine(m[4]), 0);
  assert.ok(T("26.1.5").includes(m[1] + " living creatures") && T("26.1.6").includes(m[2] + " faces"));
});
fact("26.1.6.1.4", ROWS_BY, /^Worked out: (\w+) creatures with (\w+) faces each make (\w+) faces, and with (\w+) wings each (\w+) wings: (\d+) × (\d+) = (\d+)\. The word (\w+) does not stand in these nine verses\.$/, (m) => {
  assert.equal(num(m[1]) * num(m[2]), num(m[3]));
  assert.equal(num(m[1]) * num(m[4]), num(m[5]));
  assert.deepEqual([Number(m[6]), Number(m[7]), Number(m[6]) * Number(m[7])], [num(m[1]), num(m[2]), Number(m[8])]);
  assert.equal(Number(m[8]), num(m[9]));
  assert.equal(inNine(m[9]), 0);
  assert.ok(T("26.1.5").includes(m[1] + " living creatures") && T("26.1.6").includes(m[2] + " faces") && T("26.1.6").includes(m[4] + " wings"));
});
fact("26.1.6.2.1", ROWS_BY, /^Counted: the word (wings) appears (\w+ times) in these nine verses\. Count them yourself\.$/, appearsFact);
fact("26.1.6.2.2", ROWS_BY, /^Counted: the word (\w+) stands (\w+ times) in these nine verses: (once in verse \d, twice in verse \d, once in verse \d)\.$/, perVerseFact);
fact("26.1.7.1.2", ROWS_BY, /^Counted: the word (straight) stands (twice) in these nine verses: (.+)\.$/, phrasesFact);
fact("26.1.8.1.2", ROWS_BY, /^Counted: the words "(of a man)" stand (twice) in these nine verses: (.+)\.$/, phrasesFact);
/** `"x" stands in N of this lexicon's rows: <citations>`: exactly the cited verse rows hold the phrase. */
const rowsFact = (m) => {
  const cited = citedIn(m[3]).map((c) => verseNamed(c).address);
  assert.deepEqual(verseRowsWith(m[1]), cited);
  assert.equal(cited.length, num(m[2]));
  if (m[3].includes("of the wheels")) assert.ok(T("26.1.16").includes("wheels") && cited.includes("26.1.17"), "verse 17 follows the wheels of verse 16");
  if (m[3].includes("of the living creatures")) assert.ok(T("26.1.5").includes("living creatures"));
  if (cited.includes("26.1.12")) assert.ok(T("26.1.12").includes("they went every one straight forward") && T("26.1.9").includes("they went every one straight forward"), "verse 12 speaks of the same four as verse 9");
};
fact("26.1.8.2.3", ROWS_BY, /^Counted: "(their four sides)" stands in (\w+) of this lexicon's rows: (.+)\.$/, rowsFact);
fact("26.1.8.3.1", ROWS_BY, /^Counted: (they four) stands (once) in these nine verses\. Verse (\d+) has it (\w+ times)\.$/, (m) => {
  assert.deepEqual(perVerse(m[1]), [0, 0, 0, 0, 0, 0, 0, num(m[2]), 0]);
  assert.equal(countWord(T("26.1." + m[3]), m[1]), num(m[4]));
});
fact("26.1.8.3.2", ROWS_BY, /^Counted: "(they four)" stands (once) in these nine verses, in verse (\d); (\w+ times) in verse (\d+); and (once) in verse (\d+)\.$/, (m) => {
  const want = Array(9).fill(0); want[Number(m[3]) - 1] = num(m[2]);
  assert.deepEqual(perVerse(m[1]), want);
  assert.equal(countWord(T("26.1." + m[5]), m[1]), num(m[4]));
  assert.equal(countWord(T("26.1." + m[7]), m[1]), num(m[6]));
});
fact("26.1.9.1.2", ROWS_BY, /^Counted: the word (one) stands (\w+ times) in these nine verses: (twice in verse \d, twice in verse \d)\. (\w+) of the (\w+) are "([^"]+)"\.$/, (m) => {
  perVerseFact(m);
  assert.equal(inNine(m[6]), num(m[4]));
  assert.equal(num(m[5]), num(m[2]));
});
fact("26.1.9.2.1", ROWS_BY, /^Counted: these (\w+) words stand in (\w+) verses kept here: (\d+), (\d+) and (\d+)\.$/, (m, row) => {
  const term = by.get(parentOf(row.address)).name;
  assert.equal(term, PHRASE_9);
  assert.equal(wordsIn(term), num(m[1]));
  assert.deepEqual(verseRowsWith(term), [m[3], m[4], m[5]].map((v) => "26.1." + v));
  assert.equal(num(m[2]), 3);
});
fact("26.1.9.2.2", "slidePath, homecoming, squareWalkGap (hyperbolic-moves.js)", /^Tried: on the curved map, (four) straight slides do not bring you home\. Try it in the lab\.$/, (m) => {
  assert.equal(num(m[1]), 4);
  assert.ok(walk().home.distance > 0.8 && H.squareWalkGap(1) > 0.8, "the four slides end 0.874 from home");
  assert.ok(walk().flat.distance < 1e-8, "on flat paper they would");
}, [PIN.walk]);
fact("26.1.9.2.6", ROWS_BY, /^Counted: "(they turned not when they went)" stands in (\w+) of this lexicon's rows: (.+)\.$/, rowsFact);
fact("26.1.9.2.7", "squareWalkGap, squareWalkTurn, slidePath, homecoming (hyperbolic-moves.js)",
  /^Computed on the curved map: one straight slide turns nothing\. Forward, left, back, right by (\d+), never turning, ends (\d\.\d{3}) from home; slid home, the walker is turned (\d+\.\d)° clockwise\. On flat paper both are zero\.$/,
  (m) => squareWalkFacts(m[2], m[3], m[1]), [PIN.walk]);
fact("26.1.9.3.1", ROWS_BY, /^Counted: (straight forward) stands in (\w+) verses kept here, (\d+) and (\d+)\.$/, (m, row) => {
  assert.equal(by.get(parentOf(row.address)).name, m[1]);
  assert.deepEqual(verseRowsWith(m[1]), [m[3], m[4]].map((v) => "26.1." + v));
  assert.equal(num(m[2]), 2);
});
fact("26.1.9.3.3", ROWS_BY, /^Counted: "(straight forward)" stands in (\w+) of this lexicon's rows: (.+)\.$/, rowsFact);
const FACES = () => childrenOf("26.1.10").filter((e) => e.kind === "term").map((e) => e.name);
fact("26.1.10.1.1", ROWS_BY, /^Counted: verse (\d+) names (the face of a man) first of the (four)\.$/, (m) => {
  const names = FACES();
  assert.equal(names.length, num(m[3]));
  assert.ok(rising(names.map((n) => T("26.1." + m[1]).indexOf(n))), "the four faces stand in the verse in the order of the terms");
  assert.equal(names[0], m[2]);
});
fact("26.1.10.2.1", ROWS_BY, /^Read: verse (\d+) puts the (man) and the (lion) on the (right) side\.$/, (m) => {
  assert.ok(T("26.1." + m[1]).includes(`the face of a ${m[2]}, and the face of a ${m[3]}, on the ${m[4]} side`));
});
fact("26.1.10.3.1", ROWS_BY, /^Read: verse (\d+) puts (the face of an ox) on the (left) side\.$/, (m) => {
  assert.ok(T("26.1." + m[1]).includes(`${m[2]} on the ${m[3]} side`));
});
const eagleFourth = (ezekielList, revelationList) => {
  const e = T("26.1.10"), r = T("66.4.7");
  assert.ok(rising(wordPositions(e, ezekielList)) && rising(wordPositions(r, revelationList)), "the four stand in each verse in the order given");
  assert.equal(ezekielList.length, 4);
  assert.equal(revelationList.length, 4);
  assert.equal(ezekielList[3], "eagle");
  assert.equal(revelationList[3], "eagle");
  assert.ok(r.includes("the fourth beast was like a flying eagle"));
  assert.deepEqual(FACES().map((n) => n.split(" ").at(-1)), ezekielList, "the four faces named by the terms of verse 10");
};
fact("26.1.10.4.1", ROWS_BY, /^Counted: the (eagle) is named (fourth) in verse (10) and in (Revelation 4:7)\.$/, (m) => {
  assert.equal(num(m[2]), 4);
  assert.equal(verseNamed(m[4]).address, "66.4.7");
  eagleFourth(["man", "lion", "ox", "eagle"], ["lion", "calf", "man", "eagle"]);
});
fact("26.1.10.4.3", ROWS_BY, /^Counted: the (eagle) is named (fourth) in both lists kept here: ([\w, ]+) \((Ezekiel 1:10)\) and ([\w, ]+) \((Revelation 4:7)\)\.$/, (m) => {
  assert.equal(num(m[2]), 4);
  assert.deepEqual([verseNamed(m[4]).address, verseNamed(m[6]).address], ["26.1.10", "66.4.7"]);
  eagleFourth(m[3].split(", "), m[5].split(", "));
});

// ── line 1 ──
fact("100.1.10", ROWS_BY, /^Counted from the rows: "([^"]+)" stands in (Psalm 69:9) and in (John 2:17)\. Open both and see\.$/, (m) => {
  assert.deepEqual(verseRowsWith(m[1]), [verseNamed(m[2]).address, verseNamed(m[3]).address]);
  assert.ok(verseNamed(m[2]).text.includes(m[1]) && verseNamed(m[3]).text.includes(m[1]));
});
// ── line 2 ──
fact("100.2.4", "glyphCells, glyphHex, seedMirror (strix-overwatch.js)", /^Built and read back: the word wheel on this page is a circle that carries (\d+) bits\. That is a fact about this page's own figure, not about crop circles\. Open the Wheel tab\.$/, (m) => {
  for (const w of [GOLDEN, ...mirrorWords()]) {
    assert.equal(String(OW.glyphCells(w).length), m[1]);
    assert.equal(OW.glyphHex(OW.glyphCells(w)), w, "the word reads back");
  }
}, [PIN.glyph]);
fact("100.2.5", "moveBall, mobius (hyperbolic-moves.js); lmul, rotZ, boostAlong (strix-overwatch.js)", /^Computed: every move in these explorers sends circles to circles\. Slide the map and watch one\.$/, () => {
  const rnd = seeded(2);
  let worst = 0;
  for (const M of discMoves()) {
    const r = 0.05 + 0.4 * rnd(), reach = (0.95 - r) * rnd(), a = rnd() * 2 * Math.PI, c = [reach * Math.cos(a), reach * Math.sin(a)];
    const circle = Array.from({ length: 12 }, (_, k) => [c[0] + r * Math.cos(k * Math.PI / 6), c[1] + r * Math.sin(k * Math.PI / 6)]);
    // (1) the Lorentz move of the ball, (2) the move T_c(z) = (z − c)/(1 − c̄z) of the disc
    for (const image of [circle.map((p) => H.moveBall(M, [p[0], p[1], 0])), circle.map((p) => H.mobius([0.6 * c[0], 0.6 * c[1]], p))]) {
      const [cx, cy, radius] = circumcircle(image[0], image[4], image[8]);
      for (const p of image) worst = Math.max(worst, Math.abs(Math.hypot(p[0] - cx, p[1] - cy) - radius));
      if (image[0].length === 3) for (const p of image) assert.ok(Math.abs(p[2]) < 1e-12, "a move of the disc stays in the disc");
    }
  }
  assert.ok(worst < 1e-9, `twelve points of a circle land on one circle (largest miss ${worst})`);
});
// ── line 3 ──
fact("100.3.2", ROWS_BY, /^Counted: this page files that verse under an address ending in (\d+) and (\d+)\.$/, (m) => {
  const verse = by.get(HANDLES.john316);
  assert.equal(verse.name, "John 3:16");
  assert.deepEqual(verse.address.split(".").slice(1), [m[1], m[2]]);
  assert.ok(childrenOf("100.3").some((e) => e.kind === "link" && e.text === verse.address), "line 3 links to that verse");
});
fact("100.3.5", ROWS_BY, /^Read from the rows: in this lexicon the citation is the address\. (\d+)\.(\d+)\.(\d+) is John (\d+):(\d+): book (\d+), chapter (\d+), verse (\d+)\. Open it and compare\.$/, (m) => {
  const address = `${m[1]}.${m[2]}.${m[3]}`;
  assert.deepEqual([by.get(address).name, by.get(address).layer, by.get(address).kind], [`John ${m[4]}:${m[5]}`, "text", "verse"]);
  assert.deepEqual([m[2], m[3], m[1], m[2], m[3]], [m[4], m[5], m[6], m[7], m[8]]);
  assert.deepEqual([by.get(m[1]).name, by.get(`${m[1]}.${m[2]}`).name], ["John", "John " + m[2]]);
  for (const v of verses) { const p = v.address.split("."); assert.ok(citation(v).endsWith(` ${p[1]}:${p[2]}`), `${v.address}: every verse's address is its citation`); }
});
// ── line 4 ──
fact("100.4.1", ROWS_BY, /^Counted: (Matthew), (Mark) and (Luke) are (three) books here\. (John) is the (fourth)\.$/, (m) => {
  assert.deepEqual(bookRows(), [m[1], m[2], m[3], m[5]]);
  assert.deepEqual([num(m[4]), num(m[6])], [3, 4]);
});
fact("100.4.6", ROWS_BY, /^Counted: (Matthew), (Mark), (Luke) and (John) are books (\d+), (\d+), (\d+) and (\d+) here\. John is the (fourth) book after the (\d+) of the Old Testament: (\d+) \+ (\d+) = (\d+)\. Count the book rows\.$/, (m) => {
  m.slice(1, 5).forEach((name, i) => assert.deepEqual([by.get(m[5 + i]).kind, by.get(m[5 + i]).name], ["book", name]));
  assert.deepEqual(m.slice(5, 9).map(Number), [40, 41, 42, 43]);
  assert.equal(Number(m[11]) + Number(m[12]), Number(m[13]));
  assert.deepEqual([m[10], m[11], m[12], m[13]], ["39", "39", String(num(m[9])), m[8]]);
  assert.ok(tops.filter((t) => Number(t) >= 1 && Number(t) <= 39).every((t) => !["Matthew", "Mark", "Luke", "John"].includes(by.get(t).name)), "the books numbered up to 39 here are Old Testament books");
});
fact("100.4.7", ROWS_BY, /^Counted from the rows: the (eagle) is named (fourth) in (Ezekiel 1:10) and in (Revelation 4:7)\. Open both and see\.$/, (m) => {
  assert.equal(num(m[2]), 4);
  assert.deepEqual([verseNamed(m[3]).address, verseNamed(m[4]).address], ["26.1.10", "66.4.7"]);
  eagleFourth(["man", "lion", "ox", "eagle"], ["lion", "calf", "man", "eagle"]);
});
// ── line 5 ──
fact("100.5.1", "seedMirror (strix-overwatch.js)", /^Built: this page makes its squares with one step, used again and again\. Each square and its mirror pictures make the next\.$/, () => {
  assert.ok(mirrorBuilds(), "for all 16 seeds, two applications of one mirror step give seedMirror(seed)");
}, [PIN.mirror]);
fact("100.5.3", "seedMirror (strix-overwatch.js)", /^Built: a square is set beside its (three) mirror images to make the next square: (\d) × (\d), then (\d) × (\d), then (\d) × (\d)\. One step, used again and again\. See it at The fourth square\.$/, (m) => {
  assert.deepEqual(m.slice(2, 8).map(Number), [2, 2, 4, 4, 8, 8]);
  assert.equal(num(m[1]), 3, "a square and its three mirror images are four squares: the next has four times the cells");
  assert.equal(mirrorStep([1, 0, 0, 0], 2).length, 4 * 4);
  assert.ok(mirrorBuilds());
}, [PIN.mirror]);
fact("100.5.4", "buildLexiconBundle, treeEpochTexts (strix-overwatch.js)", /^Built: this page grows its chain by one procedure, repeated once for each top-level entry: grow, link to the parent, record in the ledger\. Press Seal and watch\.$/, async () => {
  const { bundle, seen } = await sealed();
  assert.equal(tops.length, 14);
  assert.equal(bundle.chain.epoch, tops.length, "one epoch per top-level entry: 14 epochs");
  assert.equal(seen.length, tops.length);
  assert.equal(bundle.lineage.length, tops.length);
  assert.equal(bundle.trace.filter((e) => e.event === "chain.grown").length, tops.length, "one ledger entry per epoch");
  assert.equal(bundle.chain.parentChainId, bundle.lineage[tops.length - 2].chainId, "the last epoch is linked to its parent");
}, [PIN.epochs]);
// ── line 6 ──
fact("100.6.2", "mobiusFromThree, skyImage (hyperbolic-moves.js)", /^Pin (three) points on the rim of this map\. Then the place of every other point is settled\.$/, (m) => {
  assert.equal(num(m[1]), 3);
  threeRimPointsFixTheFourth();
}, [PIN.three]);
fact("100.6.8", "gramTqf, isCollinear (hyperbolic-moves.js)", /^Computed: (three) squared distances give (sixteen) times the squared area of their triangle, and zero exactly when the three points are in line\. For sides (\d+), (\d+) and (\d+) the squares are (\d+), (\d+) and (\d+), and A = (\d+) = (\d+) × (\d+)²\. Try three points of your own\.$/, (m) => {
  const A = H.gramTqf([0, 0], [3, 0], [0, 4]);
  assert.equal(A, 576n);
  assert.equal(String(A), m[9]);
  assert.deepEqual(m.slice(3, 6).map(Number), [3, 4, 5]);
  assert.deepEqual(m.slice(6, 9).map(Number), [9, 16, 25]);
  assert.deepEqual(m.slice(3, 6).map((s) => Number(s) ** 2), m.slice(6, 9).map(Number));
  assert.equal((9 + 16 + 25) ** 2 - 2 * (9 ** 2 + 16 ** 2 + 25 ** 2), 576);
  assert.equal(Number(m[10]) * Number(m[11]) ** 2, 576);
  assert.equal(Number(m[10]), num(m[2]));
  assert.equal(Number(m[11]), 3 * 4 / 2, "the area of the 3-4-5 triangle is 6");
  assert.ok(H.isCollinear([0, 0], [1, 1], [2, 2]) && !H.isCollinear([0, 0], [3, 0], [0, 4]));
  assert.equal(H.gramTqf([0, 0], [1, 1], [2, 2]), 0n);
}, [PIN.gram]);
fact("100.6.9", "seedMirror, squareQuarters, fourthFromThree (strix-overwatch.js)", /^Tested: in a word filled by the mirror rule, any (three) corner squares give the (fourth) bit for bit, and one flipped bit in the fourth is caught\. Hide a corner and see\.$/, () => {
  for (const s of SEEDS) {
    const q = OW.squareQuarters(OW.seedMirror(s)), f = OW.fourthFromThree(q[0], q[1], q[2]);
    assert.ok(f.agree, "the three predictions agree");
    for (const guess of [f.fromTopLeft, f.fromTopRight, f.fromBottomLeft]) assert.deepEqual(guess, q[3], "each gives the fourth, bit for bit");
    for (let k = 0; k < 16; k++) { const bad = q[3].slice(); bad[k] ^= 1; assert.notDeepEqual(bad, f.fromTopLeft, "a flipped bit in the fourth is caught"); }
    // any three: the same holds whichever corner is the one left out (the word is its own mirror image both ways)
    const [tl, tr, bl, br] = q, flipLR = (c) => c.map((_, k) => c[(k & 12) + 3 - (k & 3)]), flipTB = (c) => c.map((_, k) => c[12 - (k & 12) + (k & 3)]);
    assert.deepEqual(flipLR(tr), tl);
    assert.deepEqual(flipTB(bl), tl);
    assert.deepEqual(flipTB(flipLR(br)), tl);
  }
}, [PIN.mirror]);
fact("100.6.10", "quarterParities, decodePacket, flipBit, glyphCells, lexiconPackets (strix-overwatch.js)", /^Tested: in every valid packet the parities of (three) quarters fix the parity of the (fourth), and (sixty-three) bits fix the (sixty-fourth)\. Flip one light and see\.$/, (m) => {
  assert.deepEqual([num(m[1]), num(m[2]), num(m[3]), num(m[4])], [3, 4, 63, 64]);
  const all = [...packets(), ...mirrorWords(), GOLDEN];
  assert.ok(packets().length > 60);
  for (const p of all) {
    const q = OW.quarterParities(p), cells = OW.glyphCells(p);
    assert.ok(OW.decodePacket(p).parityOk);
    assert.equal(q[0] ^ q[1] ^ q[2], q[3], "three quarter parities give the fourth");
    const others = cells.filter((c) => c.field !== "parity");
    assert.equal(others.length, 63);
    assert.equal(others.filter((c) => c.on).length & 1, Number(cells.find((c) => c.field === "parity").on), "the guard bit is fixed by the other sixty-three");
  }
  for (const p of all.slice(0, 8)) for (let b = 0; b < 64; b++) assert.equal(OW.decodePacket(OW.flipBit(p, b)).parityOk, false, "any one flipped bit is noticed");
}, [PIN.quarters]);
fact("100.6.11", "mobiusFromThree, skyImage (hyperbolic-moves.js)", /^Computed: a move of the sky is fixed by where it sends (three) points of the rim\. Where every (fourth) point goes then follows\. See it on the sky page\.$/, (m) => {
  assert.deepEqual([num(m[1]), num(m[2])], [3, 4]);
  threeRimPointsFixTheFourth();
}, [PIN.three]);
fact("100.6.12", "squareNumbersNext (hyperbolic-moves.js)", /^Counted: the first (three) squares are (\d+), (\d+) and (\d+), and the (fourth) is (\d+)\. Three squares in a row fix the next: (\d+) × (\d+) − (\d+) × (\d+) \+ (\d+) = (\d+)\. Work it out\.$/, (m) => {
  assert.deepEqual([m[2], m[3], m[4], m[6]].map(Number), [1, 2, 3, 4].map((n) => n * n));
  assert.equal(H.squareNumbersNext(Number(m[2]), Number(m[3]), Number(m[4])), Number(m[6]));
  assert.equal(Number(m[7]) * Number(m[8]) - Number(m[9]) * Number(m[10]) + Number(m[11]), Number(m[12]));
  assert.deepEqual([m[7], m[8], m[9], m[10], m[11], m[12]].map(Number), [3, 9, 3, 4, 1, 16]);
  for (let n = 1; n < 200; n++) assert.equal(H.squareNumbersNext(n * n, (n + 1) ** 2, (n + 2) ** 2), (n + 3) ** 2);
}, [PIN.squares]);
fact("100.6.13", "lambertAngle, tilingConstants (hyperbolic-moves.js)", /^Computed, as a contrast: on flat paper (four) squares meet at a corner, so (three) leave room for exactly one\. In the hyperbolic plane a four-cornered figure with three right angles has a fourth angle smaller than a right angle \(cos φ = sinh a · sinh b\), and in the \{(\d),(\d)\} tiling (five) squares meet at each corner\.$/, (m) => {
  assert.equal(num(m[1]) * 90, 360, "four right angles fill the corner on flat paper");
  assert.equal(num(m[1]) - num(m[2]), 1);
  const rnd = seeded(45);
  for (let i = 0; i < 50; i++) {
    const a = 0.05 + 0.8 * rnd(), b = 0.05 + 0.8 * rnd(), phi = H.lambertAngle(a, b);
    if (phi === null) { assert.ok(Math.sinh(a) * Math.sinh(b) >= 1); continue; }
    assert.ok(phi < Math.PI / 2, "the fourth angle is smaller than a right angle");
    assert.ok(Math.abs(Math.cos(phi) - Math.sinh(a) * Math.sinh(b)) < 1e-12, "cos φ = sinh a · sinh b");
  }
  assert.ok(Math.abs(deg(H.lambertAngle(0.5, 0.5)) - 74.2441) < 1e-4);
  const c = H.tilingConstants(Number(m[3]), Number(m[4]));
  assert.deepEqual([c.p, c.q], [4, 5]);
  assert.equal(c.q, num(m[5]));
  assert.ok(Math.abs(c.q * c.angle - 2 * Math.PI) < 1e-12, "five corners of 72 degrees fill the turn");
}, [PIN.lambert, PIN.tiling]);
fact("100.6.14", ROWS_BY, /^Counted from the rows: (Deuteronomy 19:15) and (Matthew 18:16) both say "(two)" and "(three witnesses)"\. Open both and see\.$/, (m) => {
  for (const cite of [m[1], m[2]]) {
    assert.ok(countWord(verseNamed(cite).text, m[3]) >= 1, `${cite} says ${m[3]}`);     // Matthew 18:16 says two twice
    assert.equal(countWord(verseNamed(cite).text, m[4]), 1, `${cite} says ${m[4]}`);
  }
});
// ── line 7 ──
const threeTampers = async () => {
  const { clean, verdicts } = await sealed();
  assert.equal(clean.ok, true, "the untouched package is accepted");
  for (const [key, what] of [["word", "a changed word"], ["drop", "a missing entry"], ["add", "an added entry"]]) {
    const row = OW.LEXICON_TAMPERS.find((t) => t.key === key);
    assert.notEqual(verdicts.get(key).got, "accepted", `${what} is refused`);
    assert.equal(verdicts.get(key).got, row.expected);
  }
};
fact("100.7.1", "LEXICON_TAMPERS word, drop, add; readHyperpack (strix-overwatch.js)", /^Tested: change a word, drop an entry or add one\. Each time the stamp no longer fits\.$/, threeTampers, [PIN.tampers]);
fact("100.7.6", "LEXICON_TAMPERS word, drop, add; readHyperpack (strix-overwatch.js)", /^Tested\. The truth: a changed word is refused\. The whole truth: a missing entry is refused\. Nothing but the truth: an added entry is refused\. What is sworn here is about bytes\. Try the three tampers at Seal\.$/, threeTampers, [PIN.tampers]);
// ── line 9 ──
fact("100.9.1", ROWS_BY, /^Counted: the King James words for this line stand in (three) verses kept here\.$/, (m) => {
  const link = childrenOf("100.9").find((e) => e.kind === "link");
  assert.equal(link.text, "26.1.9");
  assert.ok(link.name.includes(PHRASE_9) && by.get(HANDLES.notTurning).name === PHRASE_9);
  assert.equal(verseRowsWith(PHRASE_9).length, num(m[1]));
});
fact("100.9.2", "slidePath, homecoming (hyperbolic-moves.js)", /^Tried: one straight slide turns nothing\. After a loop of slides on this curved map you face a new way\.$/, () => {
  const s = walk();
  assert.equal(s.one.turn, 0);
  assert.ok(Math.abs(deg(s.home.turnClockwise) - 78.0148) < 1e-4, "after the loop of four slides the turn is 78 degrees, not zero");
}, [PIN.walk]);
fact("100.9.4", ROWS_BY, /^Counted: "(they turned not when they went)" stands in (three) of these rows: (.+)\. Open the three and see\.$/, rowsFact);
fact("100.9.5", "squareWalkGap, squareWalkTurn, slidePath, homecoming, triangleArea (hyperbolic-moves.js); hypDist, originOf (strix-overwatch.js)",
  /^Computed: one straight slide turns nothing along its line\. Forward, left, back, right by (\d+) without turning ends (\d\.\d{3}) from home; slid home, the walker is found turned (\d+\.\d)° clockwise\. The turn equals the area gone round\. On flat paper both are zero\. Try it in the lab\.$/, (m) => {
    squareWalkFacts(m[2], m[3], m[1]);
    const s = walk();
    assert.ok(Math.abs(s.area - s.home.turnClockwise) < 1e-9, `the area gone round (${s.area}) is the turn in radians (${s.home.turnClockwise})`);
  }, [PIN.walk]);
// ── line 10 ──
const sixteenWords = () => {
  const words = mirrorWords();
  assert.equal(new Set(words).size, 16);
  for (const [k, w] of words.entries()) {
    assert.ok(OW.decodePacket(w).parityOk, "the guard bit holds");
    for (const cell of OW.glyphCells(w)) {
      let rx = cell.col > 3 ? 7 - cell.col : cell.col; if (rx > 1) rx = 3 - rx;
      let ry = cell.row > 3 ? 7 - cell.row : cell.row; if (ry > 1) ry = 3 - ry;
      assert.equal(Number(cell.on), SEEDS[k][ry * 2 + rx], "every cell is the seed cell it mirrors");
    }
  }
};
fact("100.10.1", "seedMirror, glyphCells (strix-overwatch.js)", /^Built: (four) lights in one corner fill all (\d+) by mirrors\. Four is one (sixteenth) of (\d+)\.$/, (m) => {
  sixteenWords();
  assert.deepEqual([m[2], m[4]], ["64", "64"]);
  assert.equal(num(m[1]) * num(m[3]), Number(m[4]));
}, [PIN.mirror]);
fact("100.10.6", "seedMirror, decodePacket, glyphCells (strix-overwatch.js)", /^Built: (four) cells, one (sixteenth) of the (\d) × (\d) grid of (\d+) bits, fill all (\d+) by the mirror rule\. There are (\d+) such words and the guard bit holds for every one\. Pick four lights and see\.$/, (m) => {
  sixteenWords();
  assert.equal(Number(m[3]) * Number(m[4]), Number(m[5]));
  assert.deepEqual([m[5], m[6]], ["64", "64"]);
  assert.equal(num(m[1]) * num(m[2]), 64);
  assert.equal(String(mirrorWords().length), m[7]);
  assert.equal(2 ** num(m[1]), Number(m[7]), "four bits have 16 settings");
}, [PIN.mirror]);
fact("100.10.7", "glyphCells (strix-overwatch.js)", /^Counted: a (\d+)-bit word is (\d+) hex digits, and one sector of the word wheel is one (sixteenth) of the word\. (\d+) → (\d+) → (\d+) → (\d+): bit, sector, quarter, word\. Count the slices of the wheel\.$/, (m) => {
  wheelArithmetic();
  assert.deepEqual([m[1], m[2]].map(Number), [64, GOLDEN.length]);
  assert.equal(num(m[3]), 16);
  assert.deepEqual(m.slice(4, 8).map(Number), [1, 4, 16, 64]);
}, [PIN.glyph]);
fact("100.10.8", "decodePacket, lexiconPackets, buildLexiconBundle, overwatchInspect, OVERWATCH_CHECKS (strix-overwatch.js)", /^Tested: True and Whole as checks on this page: the guard bit holds, and every check passes with nothing missing\. Press Seal and read the checks\.$/, async () => {
  const { report } = await sealed();
  for (const p of packets()) assert.ok(OW.decodePacket(p).parityOk, "the guard bit holds in every packet of this lexicon");
  assert.equal(report.ok, true);
  assert.deepEqual(report.checks.map((c) => c.name), [...OW.OVERWATCH_CHECKS], "nothing missing: every check of OVERWATCH_CHECKS was run");
  assert.ok(report.checks.every((c) => c.ok === true));
});
// ── row 100.11 ──
fact("100.11.3", ROWS_BY, /^Counted: (John) is the (fourth) Gospel, (three) and (one): books (\d+), (\d+) and (\d+), then (\d+)\.$/, (m) => {
  assert.deepEqual(bookRows(), ["Matthew", "Mark", "Luke", m[1]]);
  assert.deepEqual(m.slice(5, 9).map(Number), [40, 41, 42, 43]);
  assert.equal(num(m[3]) + num(m[4]), num(m[2]));
});
fact("100.11.4", ROWS_BY, /^Counted: chapter (\d+); verse (\d+) = (\d+) × (\d+), the (fourth) square number\. Work it out\.$/, (m) => {
  assert.deepEqual(by.get(HANDLES.john316).address.split(".").slice(1), [m[1], m[2]]);
  assert.equal(Number(m[3]) * Number(m[4]), Number(m[2]));
  assert.equal(m[3], m[4]);
  assert.equal([1, 2, 3, 4].map((n) => n * n)[num(m[5]) - 1], Number(m[2]));
});
fact("100.11.5", "glyphCells (strix-overwatch.js)", /^Built: one rule used (three) times: (\d) × (\d) × (\d) = (\d+)\. (Four) bits make a sector, (four) sectors a quarter, (four) quarters the word\. Count the lights of the wheel\.$/, (m) => {
  wheelArithmetic();
  assert.equal(Number(m[2]) * Number(m[3]) * Number(m[4]), Number(m[5]));
  assert.deepEqual([m[2], m[3], m[4], m[5]].map(Number), [4, 4, 4, 64]);
  assert.deepEqual([num(m[6]), num(m[7]), num(m[8])], [4, 4, 4]);
  assert.equal(num(m[1]), 3);
}, [PIN.glyph]);

test("CHECKED_FACTS: every row of layer checked is in the map, and every count row is recomputed from committed rows", () => {
  const checked = entries.filter((e) => e.layer === "checked");
  assert.equal(checked.length, layerCounts(entries).checked);
  assert.ok(checked.length >= 60);
  assert.deepEqual(checked.filter((e) => !CHECKED_FACTS.has(e.address)).map((e) => `${e.address} ${e.name}`), [], "checked rows without a recomputation");
  assert.deepEqual([...CHECKED_FACTS.keys()].filter((a) => by.get(a)?.layer !== "checked"), [], "recomputations whose row is gone or is no longer layer checked");
  for (const e of entries) if (e.kind === "count") assert.equal(CHECKED_FACTS.get(e.address).by, ROWS_BY, `${e.address}: a count row is recounted from the committed rows`);
  for (const [a, f] of CHECKED_FACTS) {
    assert.ok(f.pattern instanceof RegExp && typeof f.check === "function" && typeof f.by === "string" && f.by.length > 0, a);
    assert.ok(f.pattern.source.startsWith("^") && f.pattern.source.endsWith("$"), `${a}: the pattern reads the whole row`);
  }
});

test("CHECKED_FACTS: the row text matches its pattern and the numbers it states are the numbers the core gives", async (t) => {
  for (const [address, f] of CHECKED_FACTS) {
    const row = by.get(address);
    if (!row) continue;                       // reported by the test above
    await t.test(`${address} ${row.layer}/${row.kind} "${row.name}" (${f.by})`, async () => {
      const m = f.pattern.exec(row.text);
      assert.ok(m, `the row text no longer matches the pattern of its recomputation: ${row.text}`);
      await f.check(m, row);
    });
  }
});

test("CHECKED_FACTS: the unit tests named as pinning a fact exist under those titles", () => {
  const sources = new Map();
  const named = [...CHECKED_FACTS].flatMap(([a, f]) => f.pinned.map((p) => [a, ...p]));
  assert.ok(named.length >= 15);
  for (const [address, file, title] of named) {
    if (!sources.has(file)) sources.set(file, readFileSync(path.join(ROOT, file), "utf8"));
    assert.ok(sources.get(file).includes("test(" + JSON.stringify(title)), `${address}: ${file} has no test titled "${title}"`);
  }
});

// ─── the supplied passage ────────────────────────────────────────────────────

const SUPPLIED_HEAD = "// Quotes Ezekiel 1:1-9 from the Holy Bible, New International Version, (c) Biblica, Inc., under the publisher's\n" +
  "// printed allowance for short quotations. NOT covered by this repository's MIT licence. Shown as a parallel\n" +
  "// reading only; never sealed, downloaded or placed in a link. To remove it, set SUPPLIED_VERSES to {}.\n";
const R = String.fromCodePoint(0xae), C = String.fromCodePoint(0xa9);
const SUPPLIED_NOTICE = `Scripture quotations taken from The Holy Bible, New International Version${R}, NIV${R}. Copyright ${C} 1973, 1978, 1984, 2011 by Biblica, Inc.${R} Used by permission. All rights reserved worldwide.`;
const SUPPLIED_NOTE = "Only Ezekiel 1:1-9 is shown in this wording, as the author supplied it; every other Bible quotation here is King James. No separate permission was asked: the quotation relies on the allowance printed in " +
  "NIV Bibles (up to 500 verses, less than a quarter of the quoting work), and this project has not confirmed the publisher's current online terms. The printed NIV has dashes in verses 2 and 4, prints LORD in small capitals " +
  "where this copy has Lord, and has a footnote at Babylonians.";
const suppliedVerses = Object.values(SUP.SUPPLIED_VERSES || {});
const hasSupplied = suppliedVerses.length > 0;
/** The words of a text, lower case: letters and digits, with an apostrophe inside a word kept. */
const tokens = (t) => (t.toLowerCase().normalize("NFC").match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []);
const runs = (t, n = 5) => { const w = tokens(t), out = []; for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(" ")); return out; };

test("passage-as-supplied.js: the header of 6.6, the four exports, the notice and the note letter for letter", () => {
  const src = readFileSync(path.join(ROOT, SUP_FILE), "utf8");
  assert.ok(src.startsWith(SUPPLIED_HEAD), "the three header lines of 6.6 come first");
  assert.ok(src.includes(LICENCE), "the licence line of 1.3 is in the header");
  assert.ok(!src.includes("SPDX-License-Identifier"), "the supplied passage is not offered under the MIT licence");
  assert.ok(!src.includes("`") && !/^\s*import\b/m.test(src), "no template literal, no import");
  assert.deepEqual(Object.keys(SUP).sort(), ["SUPPLIED_NOTE", "SUPPLIED_NOTICE", "SUPPLIED_TERMS", "SUPPLIED_VERSES"]);
  assert.equal(SUP.SUPPLIED_NOTICE, SUPPLIED_NOTICE);
  assert.equal(SUP.SUPPLIED_NOTE, SUPPLIED_NOTE);
  assert.ok(Object.isFrozen(SUP.SUPPLIED_VERSES) && Object.isFrozen(SUP.SUPPLIED_TERMS));
  for (const [k, v] of [...Object.entries(SUP.SUPPLIED_VERSES), ...Object.entries(SUP.SUPPLIED_TERMS)]) assert.ok(typeof k === "string" && typeof v === "string" && v.length > 0, k);
});

test("the supplied verses are keyed 26.1.1 to 26.1.9; every term of verses 1 to 9 has a phrase that is a case-sensitive substring of its supplied verse", (t) => {
  if (!hasSupplied) { t.skip("SUPPLIED_VERSES is empty: the supplied wording was removed, and SUPPLIED_TERMS is not used"); return; }
  assert.deepEqual(Object.keys(SUP.SUPPLIED_VERSES), NINE);
  for (const v of suppliedVerses) assert.ok(!v.includes("[a]") && !/\[\w\]/.test(v) && v === v.trim(), "the footnote mark is not shown");
  const want = terms.filter((x) => NINE.includes(parentOf(x.address))).map((x) => x.address);
  assert.equal(want.length, 29);
  assert.deepEqual(Object.keys(SUP.SUPPLIED_TERMS), want, "one phrase for every term of verses 1 to 9, and for nothing else");
  for (const [a, phrase] of Object.entries(SUP.SUPPLIED_TERMS)) assert.ok(SUP.SUPPLIED_VERSES[parentOf(a)].includes(phrase), `${a}: "${phrase}" is not in the supplied verse`);
  for (const a of NINE) {
    const v = SUP.SUPPLIED_VERSES[a];
    const spans = Object.entries(SUP.SUPPLIED_TERMS).filter(([k]) => parentOf(k) === a).map(([, p]) => [v.indexOf(p), v.indexOf(p) + p.length, v.indexOf(p, v.indexOf(p) + 1)]).sort((x, y) => x[0] - y[0]);
    assert.ok(spans.every((s, i) => s[2] < 0 && (i === 0 || spans[i - 1][1] <= s[0])), `${a}: each phrase stands once in the supplied verse and none overlap`);
  }
  for (const [a, p] of [["26.1.1.1", "my thirtieth year"], ["26.1.1.2", "in the fourth month on the fifth day"], ["26.1.3.1", "the word of the Lord"], ["26.1.7.1", "Their legs were straight"], ["26.1.8.3", "All four of them"]])
    assert.equal(SUP.SUPPLIED_TERMS[a], p, `${a}: the example of 6.6`);
  // the author's line 9 quotes seven words of the supplied verse 9
  const seven = T("100.9").replace(/\.+$/, "");
  assert.equal(wordsIn(seven), 7);
  assert.ok(SUP.SUPPLIED_VERSES["26.1.9"].toLowerCase().includes(seven.toLowerCase()), "line 9 is the end of the supplied verse 9");
});

test("no row holds five words in a row of the supplied passage that are not King James, except row 100.9; supplied words shown are under 15 % of the lexicon's words", (t) => {
  if (!hasSupplied) { t.skip("SUPPLIED_VERSES is empty: there is no supplied wording to keep out of the rows"); return; }
  const src = readFileSync(path.join(ROOT, LEX_FILE), "utf8");
  for (const v of suppliedVerses) assert.ok(!src.includes(v), "no supplied verse stands in ezekiel-1.js");
  const kjv = new Set(verses.flatMap((v) => runs(v.text)));
  const nivOnly = new Set([...suppliedVerses.flatMap((v) => runs(v)), ...runs(suppliedVerses.join(" "))].filter((g) => !kjv.has(g)));
  assert.ok(nivOnly.size > 100);
  for (const e of entries) {
    if (e.address === "100.9") continue;
    const hit = [e.name, e.text, e.name + " " + e.text].flatMap((part) => runs(part)).find((g) => nivOnly.has(g));
    assert.equal(hit, undefined, `${e.address} holds five supplied words in a row: "${hit}"`);
  }
  assert.ok(runs(T("100.9")).some((g) => nivOnly.has(g)), "row 100.9, the author's line, is the one exception");
  const nivWords = [...suppliedVerses, ...Object.values(SUP.SUPPLIED_TERMS)].reduce((n, x) => n + tokens(x).length, 0);
  const lexWords = entries.reduce((n, e) => n + tokens(e.name).length + (e.kind === "link" ? 0 : tokens(e.text).length), 0);
  assert.ok(nivWords < 0.15 * lexWords, `supplied words shown: ${nivWords}; words of the lexicon: ${lexWords}`);
  t.diagnostic(`supplied words shown ${nivWords}, words of the lexicon ${lexWords}, share ${(100 * nivWords / lexWords).toFixed(1)} %`);
});

// ─── the chain ───────────────────────────────────────────────────────────────

test("the bundle grows fourteen epochs, one per top-level entry, and passes every Overwatch check", async (t) => {
  const { seen, bundle, report, clean, wire } = await sealed();
  const perTop = new Map();
  for (const e of entries) { const top = e.address.split(".")[0]; perTop.set(top, (perTop.get(top) ?? 0) + utf8Bytes(e.line) + 1); }
  assert.deepEqual(seen.map(([epoch, epochs]) => [epoch, epochs]), tops.map((_, i) => [i + 1, 14]));
  assert.deepEqual(seen.map(([, , added]) => added), [...perTop.values()], "each epoch adds the bytes of its top-level entry");
  assert.equal(bundle.chain.epoch, 14);
  assert.equal(bundle.lineage.length, 14);
  assert.deepEqual(bundle.lineage, OW.treeLineage(OW.treeEpochTexts(entries)), "the lineage computed once from the last text");
  assert.equal(bundle.lexicon.format, "LEXICON/2");
  assert.deepEqual(bundle.lexicon, OW.treeLexiconOf(entries));
  assert.deepEqual(bundle.lexicon.entries.map((e) => [e.address, e.layer, e.kind, e.name]), entries.map((e) => [e.address, e.layer, e.kind, e.name]));
  assert.equal(report.ok, true);
  assert.equal(report.failed, null);
  assert.deepEqual(report.checks.map((c) => [c.name, c.ok]), OW.OVERWATCH_CHECKS.map((n) => [n, true]));
  assert.deepEqual(OW.chainPackets(bundle.chain), packets(), "the packets of the chain are the packets of the text");
  assert.equal(clean.ok, true, "the sealed package passes the front door");
  assert.deepEqual(OW.entriesOfPack(clean.pack).map((e) => e.line), entries.map((e) => e.line), "the package gives the rows back");
  assert.ok(wire.length <= OW.MAX_PACK_CHARS);
  for (const v of suppliedVerses) assert.ok(!wire.includes(v), "the supplied passage is not in the package");
  for (const p of Object.values(SUP.SUPPLIED_TERMS || {})) {
    const low = p.toLowerCase();
    if (tokens(p).length < 5 || verses.some((v) => v.text.toLowerCase().includes(low)) || T("100.9").toLowerCase().includes(low)) continue;   // King James words too, or the author's line 9
    assert.ok(!wire.toLowerCase().includes(low), `the supplied phrase "${p}" is not in the package`);
  }
  t.diagnostic(`epoch sizes in bytes: ${[...perTop].map(([a, n]) => `${a}: ${n}`).join(", ")}; text ${utf8Bytes(text)} bytes; ${packets().length} packets; wire ${wire.length} characters`);
});

test("the bundle is deterministic for a given time", async () => {
  const { bundle } = await sealed();
  const again = await OW.buildLexiconBundle(entries, { at: AT });
  assert.equal(JSON.stringify(again), JSON.stringify(bundle));
});

test("each LEXICON_TAMPERS row behaves as declared on this lexicon's package", async (t) => {
  const { verdicts, certificate, clean } = await sealed();
  assert.equal(clean.ok, true);
  assert.deepEqual(OW.LEXICON_TAMPERS.map((r) => r.key), ["word", "drop", "add", "move", "relabel", "ledger", "signature", "reseal"]);
  const DECLARED = { word: "crystal", drop: "lexicon", add: "lexicon", move: "lexicon", relabel: "lexicon", ledger: "trace", signature: "signature", reseal: "accepted" };
  for (const row of OW.LEXICON_TAMPERS) {
    await t.test(`${row.key}: ${row.label} → ${row.expected}`, () => {
      assert.equal(row.expected, DECLARED[row.key], "the table declares what 5.7 and the core's own test pin");
      assert.equal(verdicts.get(row.key).got, row.expected);
    });
  }
  // the documented limit: a relabelled lexicon sealed again with a new key is a new package under a new seal
  const resealed = verdicts.get("reseal");
  assert.notEqual(resealed.changed.certificate.sealId, certificate.sealId);
  const relabelled = OW.entriesOfPack(resealed.pack).filter((e, i) => e.layer !== entries[i].layer);
  assert.deepEqual(relabelled.map((e) => [e.address, e.layer]), [["0", "text"]], "the first READING row, row 0, was relabelled TEXT");
});

// ─── the King James e-text, when it is here ──────────────────────────────────

// The search rows and how each is run again. A row that searches the 1949 book cannot be run from the repository.
const BOOK_NAMES = new Map();   // filled from the e-text's own "Book NN  Name" lines
const KJV_SEARCHES = new Map([
  ["0.4.1", null],            // two scans of van Paassen's book: compared by hand (November 2026), not shipped
  ["26.1.1.5.8", (kjv, row) => {
    const m = /found these four words in two verses: (Ezekiel 1:1 and Matthew 3:16)\. Acts 7:56 has "([^"]+)"\./.exec(row.text);
    assert.ok(m);
    assert.deepEqual(kjv.find(/the heavens were opened/), kjv.cites(m[1]));
    assert.ok(kjv.verse("Acts 7:56").includes(m[2]));
  }],
  ["26.1.16.1.3", (kjv, row) => {
    const m = /found "([^"]+)" in one verse, (Ezekiel 1:16); the book's first wheel is in verse (\d+)\./.exec(row.text);
    assert.ok(m);
    assert.deepEqual(kjv.find(new RegExp(m[1])), kjv.cites(m[2]));
    assert.equal(kjv.find(/\bwheels?\b/).find((k) => k.startsWith("26.")), "26.1." + m[3]);
  }],
  ["100.1.1", (kjv, row) => {
    assert.ok(/found alien or aliens in eight verses\./.test(row.text));
    assert.equal(kjv.find(/\baliens?\b/i).length, 8);
  }],
  ["100.1.11", (kjv, row) => {
    const m = /found alien or aliens in eight verses, once in each: (.+?)\. In each it means/.exec(row.text);
    assert.ok(m);
    const hits = kjv.find(/\baliens?\b/i);
    assert.deepEqual(hits, kjv.cites(m[1]));
    assert.equal(hits.length, 8);
    for (const k of hits) assert.equal((kjv.all.get(k).match(/\baliens?\b/gi) || []).length, 1, "once in each");
    const other = kjv.find(/\balienated?\b/i);
    assert.ok(other.length > 0 && other.every((k) => !hits.includes(k)), "alienated and alienate are other words, in other verses");
    assert.deepEqual(kjv.find(/\balien/i).filter((k) => !hits.includes(k) && !other.includes(k)), [], "no further word begins with alien");
  }],
  ["100.6.16", (kjv, row) => {
    const m = /found the rule of two or three witnesses in six verses: (.+?)\. Search the Project Gutenberg King James text for "([^"]+)"\./.exec(row.text);
    assert.ok(m);
    const hits = kjv.find(new RegExp(m[2]));
    assert.deepEqual(hits, kjv.cites(m[1]));
    assert.equal(hits.length, 6);
    for (const k of hits) assert.match(kjv.all.get(k), /two( witnesses,)? or( at the mouth of)? three witnesses/, "each of the six gives the rule of two or three");
  }],
  ["100.7.8", (kjv, row) => {
    const m = /found "([^"]+)" once, in (2 Chronicles 18:15)\./.exec(row.text);
    assert.ok(m);
    assert.deepEqual(kjv.find(new RegExp(m[1], "i")), kjv.cites(m[2]));
  }],
  ["100.9.6", (kjv, row) => {
    const m = /found "([^"]+)" in three verses, (Ezekiel 1:9, 1:12 and 1:17), and nowhere else; (Ezekiel 10:11) has "([^"]+)" twice\./.exec(row.text);
    assert.ok(m);
    assert.deepEqual(kjv.find(new RegExp(m[1], "i")), kjv.cites(m[2]));
    assert.deepEqual(kjv.find(new RegExp(m[4], "i")), kjv.cites(m[3]));
    assert.equal(kjv.verse(m[3]).split(m[4]).length - 1, 2);
  }],
]);

test("every row that reports a search has its way of being run again listed here", () => {
  const searching = entries.filter((e) => e.kind === "search" || (e.layer === "said" && /\bsearch of\b/.test(e.text)));
  assert.deepEqual(searching.map((e) => e.address), [...KJV_SEARCHES.keys()]);
});

/** The per-book files of the Project Gutenberg King James e-text in a folder → every verse, keyed "book.chapter.verse". */
function readKjv(dir) {
  const all = new Map();
  const files = readdirSync(dir);
  for (let b = 1; b <= 66; b++) {
    const tag = `bib${String(b).padStart(2, "0")}10.txt`;
    const name = files.find((f) => f.endsWith(tag + ".plain")) || files.find((f) => f.endsWith(tag));
    assert.ok(name, `the e-text folder has no file for book ${b} (a name ending in ${tag} or ${tag}.plain)`);
    let key = null;
    for (const line of readFileSync(path.join(dir, name), "utf8").replace(/\r/g, "").split("\n")) {
      const head = /^Book (\d\d)\s+(.+?)\s*$/.exec(line);
      if (head && Number(head[1]) === b && !BOOK_NAMES.has(b)) BOOK_NAMES.set(b, head[2]);
      const m = /^(\d\d):(\d\d\d):(\d\d\d) (.*)$/.exec(line);
      if (m) {
        assert.equal(Number(m[1]), b, `${name}: a verse of another book`);
        key = `${b}.${Number(m[2])}.${Number(m[3])}`;
        all.set(key, m[4].trim());
      } else if (key !== null && line.trim() === "") key = null;
      else if (key !== null) all.set(key, all.get(key) + " " + line.trim());
    }
  }
  const order = (k) => k.split(".").map(Number);
  const sorted = [...all.keys()].sort((x, y) => { const a = order(x), c = order(y); return a[0] - c[0] || a[1] - c[1] || a[2] - c[2]; });
  const number = (book) => { const n = [...BOOK_NAMES].find(([, name]) => name === book || name === book + "s"); assert.ok(n, `the e-text has a book named ${book}`); return n[0]; };
  const keyOf = (cite) => { const m = /^(.+) (\d+):(\d+)$/.exec(cite); return `${number(m[1])}.${m[2]}.${m[3]}`; };
  return { all, find: (re) => sorted.filter((k) => re.test(all.get(k))), cites: (listText) => citedIn(listText).map(keyOf), verse: (cite) => all.get(keyOf(cite)) };
}

test("OWL_KJV_DIR: every verse row is the e-text's verse, letter for letter, and the searches of the SAID/search rows give what the rows say", (t) => {
  const dir = process.env.OWL_KJV_DIR;
  if (!dir) { t.skip("set OWL_KJV_DIR to the folder of the 66 per-book Project Gutenberg King James files (bib0110.txt … bib6610.txt) to compare the verse rows and run the searches again"); return; }
  assert.ok(existsSync(dir), "OWL_KJV_DIR names a folder that exists");
  const kjv = readKjv(dir);
  assert.equal(kjv.all.size, 31102, "the e-text has 31,102 verses");
  assert.equal(BOOK_NAMES.size, 66);
  for (const v of verses) {
    const got = kjv.all.get(v.address);
    assert.ok(got, `${v.address}: the e-text has this verse`);
    if (v.address === "43.18.36") assert.ok(got.startsWith(v.text + ":"), "43.18.36: the opening words of the verse, up to its first colon");
    else assert.equal(v.text, got, `${v.address} (${v.name})`);
  }
  // the books: the name of each book row is the e-text's; the first index is the number of the book's file; 39 books come before Matthew
  for (const e of entries) if (e.kind === "book") assert.equal(e.name, BOOK_NAMES.get(Number(e.address)), `${e.address}: the book's name in the e-text`);
  assert.deepEqual([BOOK_NAMES.get(39), BOOK_NAMES.get(40), BOOK_NAMES.get(43)], ["Malachi", "Matthew", "John"]);
  assert.ok(kjv.all.get("43.3.16") === T("43.3.16") && /^43:003:016 /m.test(readFileSync(path.join(dir, readdirSync(dir).find((f) => /bib4310\.txt(\.plain)?$/.test(f))), "utf8")), "the label the e-text prints before John 3:16 is 43:003:016 (row 0.1)");
  // the searches
  for (const [address, run] of KJV_SEARCHES) if (run) run(kjv, by.get(address));
  // what the rows say was not found, or found once
  assert.deepEqual(kjv.find(/\bbridges?\b/i), [], "row 0.5: the word bridge is not in the King James e-text");
  assert.deepEqual(kjv.find(/\b(hashmal|sixteenth)\b/i).filter((k) => k.startsWith("26.1.")), []);
  assert.deepEqual(kjv.find(/polished brass/), ["27.10.6"], "row 26.1.7.3.2: Daniel 10:6 has polished brass");
  assert.ok(kjv.all.get("19.69.9").includes("zeal of thine house hath eaten me up") && kjv.all.get("43.2.17").includes("zeal of thine house hath eaten me up"), "row 100.1.15: John 2:17 quotes the next line of the psalm");
});
