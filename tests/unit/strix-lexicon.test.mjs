// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// scripts/strix-overwatch.js, the tree lexicon (drafts LEX/1 and LEXICON/2).
// Step 0 (the first half of this file): one entry is one canonical LEX/1 line and the line reads back to it; every line that
// is not canonical is refused; a LEXICON/2 text is the one depth-first listing of its tree, within the limits;
// the helpers parentOf, depthOf, childrenIndex, layerCounts and countWord.
// The random tests compare the core with a second reading of the rules, written here without the core's
// regular expressions, so a slip in either one shows.
// Phase 1 (the second half of this file): the lexicon's format picks a profile; a tree grows one real shdccp/2
// epoch per top-level entry and passes every Overwatch check; the lineage computed once from the last text equals
// regrowing every epoch; certificate, HYPERPACK/1 and HANDSHAKE/1 are the journey's; a relabelled entry is refused
// at lexicon, trace, commitment or signature and passes only as a new package under a new key; the table of
// tampers; the front door readHyperpack on hostile texts; the word as wheel and square (glyphCells, seedMirror,
// squareQuarters, fourthFromThree, quarterParities); packets without sealing; the witness quorum.
// Run: node --test tests/unit/strix-lexicon.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.env.OWL_TEST_ROOT || path.resolve(import.meta.dirname, "../..");
const load = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const OW = await load("scripts/strix-overwatch.js");

// ─── shared helpers ──────────────────────────────────────────────────────────

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
const pickFrom = (rnd, list) => list[Math.floor(rnd() * list.length)];
const utf8Bytes = (s) => new TextEncoder().encode(s).length;
/** Printable form of a string for assertion messages (everything outside ASCII as \u escapes). */
const show = (s) => JSON.stringify(s).replace(/[^ -~]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
const tryMake = (...args) => { try { return { ok: true, entry: OW.makeEntry(...args) }; } catch (e) { return { ok: false, error: e }; } };
const tryParse = (line) => { try { return { ok: true, entry: OW.parseEntry(line) }; } catch (e) { return { ok: false, error: e }; } };
/** Every error of step 0 is an Error with a fixed plain sentence: printable ASCII, short enough to be shown
 *  behind "line 3000: " within 160 characters, and never a copy of the input. */
const PLAIN = /^[ -~]{1,149}$/;
function refused(fn, what, pattern) {
  let error = null;
  try { fn(); } catch (e) { error = e; }
  assert.ok(error instanceof Error, `${what}: must be refused`);
  assert.match(error.message, PLAIN, `${what}: a plain message`);
  if (pattern) assert.match(error.message, pattern, what);
  return error.message;
}

// ─── a second reading of SPEC 5.2, without the core's regular expressions ────

const isIndex = (s) => s.length >= 1 && s.length <= 4 && [...s].every((c) => c >= "0" && c <= "9") && (s === "0" || s[0] !== "0");
const refAddress = (a) => { const p = a.split("."); return p.length >= 1 && p.length <= 8 && p.every(isIndex); };
const lower = (c) => c >= "a" && c <= "z", digit = (c) => c >= "0" && c <= "9";
const refKind = (k) => k.length >= 1 && k.length <= 16 && lower(k[0]) && [...k].every((c) => lower(c) || digit(c) || c === "-");
const IS_LMNPS = /^[\p{L}\p{M}\p{N}\p{P}\p{S}]$/u, IS_MARK = /^\p{M}$/u, IS_IGNORABLE = /^\p{Default_Ignorable_Code_Point}$/u;
const charOk = (c) => IS_LMNPS.test(c) && !IS_IGNORABLE.test(c);
function refName(n) {                 // n in NFC
  const cps = [...n];
  if (cps.length < 1 || cps.length > 96) return false;
  if (cps[0] === " " || cps[cps.length - 1] === " " || IS_MARK.test(cps[0])) return false;
  return cps.every((c, i) => (c === " " ? cps[i + 1] !== " " : charOk(c)));
}
function refText(t) {                 // t in NFC
  const cps = [...t];
  return cps.length <= 1200 && cps.every((c) => c === " " || c === "\n" || charOk(c));
}
const refWrite = (s) => [...s].map((c) => (c === "%" ? "%25" : c === "|" ? "%7C" : c === "\n" ? "%0A" : c)).join("");
/** The entry SPEC 5.2 gives for five arguments, or null where it must be refused. */
function refEntry(address, layer, kind, name, text) {
  if (![address, layer, kind, name, text].every((v) => typeof v === "string")) return null;
  if (!refAddress(address) || !["text", "said", "checked", "reading"].includes(layer) || !refKind(kind)) return null;
  const n = name.normalize("NFC"), t = text.normalize("NFC");
  if (!refName(n) || !refText(t)) return null;
  const line = "LEX/1|" + address + "|" + layer + "|" + kind + "|" + refWrite(n) + "|" + refWrite(t);
  return line.normalize("NFC") === line ? { address, layer, kind, name: n, text: t, line } : null;
}
/** The entry a string is the canonical line of, or null. Only the three escapes a canonical line can hold are read. */
function refLine(line) {
  if (typeof line !== "string" || line.includes("\n")) return null;
  const p = line.split("|");
  if (p.length !== 6 || p[0] !== "LEX/1") return null;
  if (/%(?!25|7C)/.test(p[4]) || /%(?!25|7C|0A)/.test(p[5])) return null;
  const read = (s) => s.replace(/%(25|7C|0A)/g, (_, h) => (h === "25" ? "%" : h === "7C" ? "|" : "\n"));
  const e = refEntry(p[1], p[2], p[3], read(p[4]), read(p[5]));
  return e !== null && e.line === line ? e : null;
}

// ─── Step 0: LEX/1 ───────────────────────────────────────────────────────────

// [address, layer, kind, name, text, line]. Everything outside ASCII is written as an escape. The words of
// John 18:36 are the King James Version's, as the specification gives them for that row; lines 1 and 4 are two of
// the author's notes; the rest is made up for the test.
const VECTORS = [
  ["0", "text", "a", "a", "", "LEX/1|0|text|a|a|"],
  ["0", "reading", "about", "What this lexicon is", "Words, translations and sources.", "LEX/1|0|reading|about|What this lexicon is|Words, translations and sources."],
  ["26.1.1.4", "text", "term", "the river of Chebar", "", "LEX/1|26.1.1.4|text|term|the river of Chebar|"],
  ["43.18.36", "text", "verse", "John 18:36 (opening words)", "Jesus answered, My kingdom is not of this world",
    "LEX/1|43.18.36|text|verse|John 18:36 (opening words)|Jesus answered, My kingdom is not of this world"],
  ["100.1", "reading", "note", "Line 1", "Jesus is the O.G. \"Alien\" <3", "LEX/1|100.1|reading|note|Line 1|Jesus is the O.G. \"Alien\" <3"],
  ["100.4", "reading", "note", "Line 4", "Book of John [4:(Matt Mark Luke):1] <-- Being a Whole (3)",
    "LEX/1|100.4|reading|note|Line 4|Book of John [4:(Matt Mark Luke):1] <-- Being a Whole (3)"],
  ["3.12", "said", "note", "a|b%c", "owl | 100%\nwise", "LEX/1|3.12|said|note|a%7Cb%25c|owl %7C 100%25%0Awise"],
  ["7", "checked", "code", "%", "%|\n", "LEX/1|7|checked|code|%25|%25%7C%0A"],
  ["8", "checked", "code", "%41", "%7C %0A %25 %zz %", "LEX/1|8|checked|code|%2541|%257C %250A %2525 %25zz %25"],
  ["9999.9999.9999.9999.9999.9999.9999.9999", "checked", "a234567890123456", "n", "",
    "LEX/1|9999.9999.9999.9999.9999.9999.9999.9999|checked|a234567890123456|n|"],
  ["1.0", "said", "x-ray-2", "n", "t", "LEX/1|1.0|said|x-ray-2|n|t"],
  ["2", "said", "note", "n", " two  spaces \n", "LEX/1|2|said|note|n| two  spaces %0A"],
  ["4", "said", "note", "n", "\u{0301}", "LEX/1|4|said|note|n|\u{0301}"],
  ["5", "said", "note", "100%\u{0301}", "x", "LEX/1|5|said|note|100%25\u{0301}|x"],
  ["26.1.4.5", "said", "lexicon", "\u{1e25}ashmal (\u{05d7}\u{05b7}\u{05e9}\u{05b0}\u{05c1}\u{05de}\u{05b7}\u{05dc})", "\u{1f24}\u{03bb}\u{03b5}\u{03ba}\u{03c4}\u{03c1}\u{03bf}\u{03bd}",
    "LEX/1|26.1.4.5|said|lexicon|\u{1e25}ashmal (\u{05d7}\u{05b7}\u{05e9}\u{05b0}\u{05c1}\u{05de}\u{05b7}\u{05dc})|\u{1f24}\u{03bb}\u{03b5}\u{03ba}\u{03c4}\u{03c1}\u{03bf}\u{03bd}"],
  ["2.1", "checked", "body", "Sagittarius A*", "34.6\u{00b0} \u{00b1} 0.3, longitude \u{2212}67.75", "LEX/1|2.1|checked|body|Sagittarius A*|34.6\u{00b0} \u{00b1} 0.3, longitude \u{2212}67.75"],
  ["100.6.1", "said", "spec", "T_c(z) = (z \u{2212} c)/(1 \u{2212} c\u{0304}z)", "A = (Q\u{2081} + Q\u{2082} + Q\u{2083})\u{00b2} \u{2212} 2(Q\u{2081}\u{00b2} + Q\u{2082}\u{00b2} + Q\u{2083}\u{00b2})",
    "LEX/1|100.6.1|said|spec|T_c(z) = (z \u{2212} c)/(1 \u{2212} c\u{0304}z)|A = (Q\u{2081} + Q\u{2082} + Q\u{2083})\u{00b2} \u{2212} 2(Q\u{2081}\u{00b2} + Q\u{2082}\u{00b2} + Q\u{2083}\u{00b2})"],
  ["0.2", "said", "notice", "NIV\u{00ae}, \u{00a9} 1973", "{4,5} tiling; 1/2 + 1/4 + 1/8 + 1/16 + \u{2026}", "LEX/1|0.2|said|notice|NIV\u{00ae}, \u{00a9} 1973|{4,5} tiling; 1/2 + 1/4 + 1/8 + 1/16 + \u{2026}"],
  ["6", "reading", "note", "\u{1f989} owl", "\u{1d538}", "LEX/1|6|reading|note|\u{1f989} owl|\u{1d538}"],
];

test("LEX/1: fixed vectors: one entry has one canonical line, and the line reads back to the entry", () => {
  assert.deepEqual([...OW.LAYERS], ["text", "said", "checked", "reading"]);
  assert.ok(Object.isFrozen(OW.LAYERS));
  for (const [address, layer, kind, name, text, line] of VECTORS) {
    const e = OW.makeEntry(address, layer, kind, name, text);
    assert.deepEqual(e, { address, layer, kind, name, text, line }, line);
    assert.deepEqual(Object.keys(e), ["address", "layer", "kind", "name", "text", "line"], "member order");
    assert.ok(Object.isFrozen(e), "an entry is frozen");
    assert.equal(e.line.normalize("NFC"), e.line, "a line is NFC");
    assert.equal(e.line.split("|").length, 6, "six parts");
    assert.ok(!/[\n\r]/.test(e.line), "a line holds no raw newline");
    const back = OW.parseEntry(line);
    assert.deepEqual(back, e, "reads back");
    assert.ok(Object.isFrozen(back));
    assert.deepEqual(refEntry(address, layer, kind, name, text), { ...e }, "the second reading agrees");
    assert.deepEqual(refLine(line), { ...e });
  }
  assert.throws(() => { OW.makeEntry("0", "text", "a", "a", "").name = "b"; }, TypeError, "a frozen entry cannot be changed");
  // the smallest line, and the longest (every code point of name and text takes three UTF-16 units, or four bytes)
  assert.equal(OW.makeEntry("0", "text", "a", "a", "").line.length, 17);
  const widest = ["9999.9999.9999.9999.9999.9999.9999.9999", "reading", "a234567890123456"];
  const longest = OW.makeEntry(...widest, "%".repeat(96), "%".repeat(1200));
  assert.equal(longest.line.length, 3960);
  assert.deepEqual(OW.parseEntry(longest.line), longest, "the longest line in UTF-16 units reads back");
  const heaviest = OW.makeEntry(...widest, "\u{1f989}".repeat(96), "\u{1f989}".repeat(1200));
  assert.equal(utf8Bytes(heaviest.line), 5256);
  assert.deepEqual(OW.parseEntry(heaviest.line), heaviest, "the longest line in bytes reads back");
  refused(() => OW.parseEntry(longest.line + "%25"), "a line longer than any canonical line", /longer than the line of any entry/);
  refused(() => OW.parseEntry("LEX/1|0|text|a|" + "a|".repeat(100000)), "a hundred thousand parts", /longer than the line of any entry/);
});

test("LEX/1: NFD input gives the NFC line, and limits count code points after NFC", () => {
  const cases = [
    // [name given, name kept, text given, text kept]
    ["Poincare\u{0301} ball", "Poincar\u{00e9} ball", "cafe\u{0301}", "caf\u{00e9}"],
    ["\u{05e9}\u{05c1}\u{05b0}", "\u{05e9}\u{05b0}\u{05c1}", "\u{05d7}\u{05b7}\u{05e9}\u{05c1}\u{05b0}\u{05de}\u{05b7}\u{05dc}", "\u{05d7}\u{05b7}\u{05e9}\u{05b0}\u{05c1}\u{05de}\u{05b7}\u{05dc}"],   // marks reordered
    ["\u{1112}\u{1161}\u{11ab}", "\u{d55c}", "\u{1100}\u{1161}", "\u{ac00}"],                                                                                           // Hangul jamo
    ["\u{212a} \u{212b} \u{2126}", "K \u{00c5} \u{03a9}", "A\u{030a}", "\u{00c5}"],                                                                                     // singletons
    ["\u{0958}", "\u{0915}\u{093c}", "q\u{0323}\u{0307}", "q\u{0323}\u{0307}"],                                                                                         // one grows; one stays
  ];
  for (const [nameIn, name, textIn, text] of cases) {
    const e = OW.makeEntry("0", "said", "note", nameIn, textIn);
    assert.deepEqual([e.name, e.text], [name, text], show(nameIn));
    assert.equal(e.line, `LEX/1|0|said|note|${name}|${text}`);
    assert.deepEqual(OW.parseEntry(e.line), e);
    assert.deepEqual(OW.makeEntry("0", "said", "note", name, text), e, "NFC input gives the same entry");
  }
  // a line spelled in NFD is not the canonical line
  assert.deepEqual(OW.parseEntry("LEX/1|0|said|note|Poincar\u{00e9} ball|x").name, "Poincar\u{00e9} ball");
  refused(() => OW.parseEntry("LEX/1|0|said|note|Poincare\u{0301} ball|x"), "NFD name in a line", /canonical/);
  refused(() => OW.parseEntry("LEX/1|0|said|note|n|cafe\u{0301}"), "NFD text in a line", /canonical/);
  // 96 and 1200 are counted after NFC, in code points
  assert.equal(OW.makeEntry("0", "text", "a", "e\u{0301}".repeat(96), "e\u{0301}".repeat(1200)).name, "\u{00e9}".repeat(96));
  refused(() => OW.makeEntry("0", "text", "a", "e\u{0301}".repeat(97), ""), "97 composed code points", /1 to 96/);
  refused(() => OW.makeEntry("0", "text", "a", "\u{0958}".repeat(49), ""), "49 code points that become 98", /1 to 96/);
  assert.equal([...OW.makeEntry("0", "text", "a", "\u{0958}".repeat(48), "").name].length, 96);
});

test("LEX/1: every address, layer and kind outside the rule is refused", () => {
  const ok = (address, layer = "text", kind = "verse") => OW.makeEntry(address, layer, kind, "n", "t");
  for (const a of ["0", "9", "10", "9999", "0.0", "26.1.10", "43.3.16", "1.2.3.4.5.6.7.8", "9999.0.9999.0.9999.0.9999.0"]) assert.equal(ok(a).address, a);
  const badAddresses = [
    "10000", "99999", "1.10000",                                   // an index over 9999
    "00", "01", "0001", "1.01", "26.1.04", "007",                  // a leading zero
    "1.2.3.4.5.6.7.8.9", "0.0.0.0.0.0.0.0.0",                      // nine indices
    "", ".", "1.", ".1", "1..2", "..",                             // an empty part
    "-1", "+1", "1.-2", " 1", "1 ", "1. 2", "1,2", "1/2", "1e3", "0x1", "1.5e1", "a", "1.a", "\u{0661}", "\u{ff11}", "1\n", "\n1", "1.2\n", "1|2", "%31",
  ];
  for (const a of badAddresses) refused(() => ok(a), "address " + show(a), /^an address is/);
  for (const l of OW.LAYERS) assert.equal(ok("0", l).layer, l);
  for (const l of ["", "TEXT", "Text", "text ", " text", "note", "written", "author", "constructor", "__proto__", "toString", "0", "text\n", "text|said"])
    refused(() => ok("0", l), "layer " + show(l), /^a layer is/);
  for (const k of ["a", "z9", "verse", "x-ray-2", "a---------------", "a234567890123456", "constructor", "tostring"]) assert.equal(ok("0", "text", k).kind, k);
  const badKinds = ["", "Verse", "VERSE", "1a", "9", "-a", "a_b", "a b", "a.b", " a", "a ", "a2345678901234567", "ver|se", "v%", "\u{00e9}", "a\u{00e9}", "a\n", "\na", "a\u{0301}"];
  for (const k of badKinds) refused(() => ok("0", "text", k), "kind " + show(k), /^a kind is/);
});

// Names that draw nothing, carry spaces where none may be, reorder what is drawn beside them, begin with a mark,
// or hold a control, an unassigned or private-use code point or half of a surrogate pair.
const BAD_NAMES = {
  "empty": "",
  "zero width space only": "\u{200b}", "no-break space only": "\u{00a0}", "ideographic space only": "\u{3000}", "a space only": " ", "two spaces": "  ",
  "Hangul filler (a letter that draws nothing)": "\u{3164}", "Hangul choseong filler": "\u{115f}", "halfwidth Hangul filler": "\u{ffa0}",
  "soft hyphen": "Eze\u{00ad}kiel", "byte order mark": "a\u{feff}b", "tag characters": "x\u{e0041}\u{e0042}", "variation selector 16": "\u{2764}\u{fe0f}",
  "variation selector 17": "a\u{e0100}", "combining grapheme joiner": "a\u{034f}b", "word joiner": "a\u{2060}b", "zero width joiner": "a\u{200d}b",
  "zero width non-joiner": "a\u{200c}b", "invisible times": "2\u{2062}x", "Mongolian vowel separator": "a\u{180e}b", "Khmer inherent vowel": "\u{1780}\u{17b4}",
  "leading space": " Ezekiel 1:4", "trailing space": "Ezekiel 1:4 ", "double space": "Ezekiel  1:4", "leading tab": "\tx", "tab inside": "a\tb",
  "leading no-break space": "\u{00a0}Ezekiel 1:4", "trailing no-break space": "Ezekiel 1:4\u{00a0}", "no-break space inside": "Ezekiel\u{00a0}1:4",
  "thin space": "a\u{2009}b", "narrow no-break space": "a\u{202f}b", "ideographic space inside": "a\u{3000}b", "en quad": "a\u{2000}b",
  "right-to-left override": "Ezekiel 1:4 \u{202e}gnidaer", "isolates": "\u{2066}x\u{2069}", "left-to-right mark": "a\u{200e}b", "right-to-left mark": "a\u{200f}b",
  "Arabic letter mark": "a\u{061c}b", "left-to-right embedding": "a\u{202a}b", "pop directional formatting": "a\u{202c}b", "right-to-left isolate": "a\u{2067}b",
  "first strong isolate": "a\u{2068}b",
  "leading combining acute": "\u{0301}x", "leading Hebrew point": "\u{05b7}a", "leading spacing mark": "\u{0903}a", "leading enclosing mark": "\u{20dd}a",
  "NUL": "a\u{0000}b", "newline": "a\nb", "carriage return": "a\rb", "unit separator": "a\u{001f}b", "DEL": "a\u{007f}b", "C1 PAD": "a\u{0080}b",
  "C1 NEL": "a\u{0085}b", "C1 APC": "a\u{009f}b", "line separator": "a\u{2028}b", "paragraph separator": "a\u{2029}b",
  "noncharacter U+FFFE": "a\u{fffe}b", "noncharacter U+FFFF": "\u{ffff}", "noncharacter U+10FFFF": "a\u{10ffff}", "private use": "\u{e000}", "private use, plane 15": "a\u{f0000}",
  "unassigned (plane 5)": "a\u{50000}", "interlinear annotation": "a\u{fff9}b\u{fffa}c\u{fffb}", "unassigned and default-ignorable U+FFF0": "a\u{fff0}",
  "lone high surrogate": "a\u{d800}b", "lone low surrogate": "a\u{dc00}b", "high surrogate only": "\u{d800}", "surrogates reversed": "\u{dc00}\u{d800}",
  "97 letters": "a".repeat(97), "97 astral symbols": "\u{1f989}".repeat(97),
};

test("LEX/1: names that are invisible, spaced, bidi-controlled, begin with a mark or hold controls or lone surrogates are refused", () => {
  for (const [what, name] of Object.entries(BAD_NAMES)) {
    refused(() => OW.makeEntry("0", "text", "verse", name, "x"), "name: " + what, /^a name /);
    assert.equal(refName(name.normalize("NFC")), false, "the second reading refuses it too: " + what);
  }
  refused(() => OW.makeEntry("0", "text", "verse", "", "x"), "an empty name", /1 to 96/);
  // each default-ignorable code point that is a letter or a mark is caught by its own sentence
  for (const name of ["\u{3164}", "a\u{034f}b", "\u{2764}\u{fe0f}", "a\u{e0100}"]) refused(() => OW.makeEntry("0", "text", "verse", name, "x"), show(name), /invisible/);
  // what a lexicon needs is accepted: single spaces inside, marks after their letter, any script, symbols
  const good = ["a", "Ezekiel 1:4", "As supplied (NIV)", "king Jehoiachin's captivity", "Cygnus X-1", "31 July 593 BC", "<-- Being a Whole (3)",
    "\u{201c}Alien\u{201d} <3", "x\u{0301}", "a \u{0301}", "a".repeat(96), "\u{1f989}".repeat(96), "a b c d e f", "%", "|", "% |", "-", "_", "\u{05d0}\u{05b7}"];
  for (const name of good) {
    const e = OW.makeEntry("0", "text", "verse", name, "");
    assert.equal(e.name, name, show(name));
    assert.deepEqual(OW.parseEntry(e.line), e);
  }
});

test("LEX/1: text may be empty, hold newlines and any spaces of U+0020, and nothing invisible or out of range", () => {
  const good = ["", " ", "  two  spaces  ", "\n", "\n\n", "a\nb\n", " \n ", "\u{0301}", "\u{0301}\n", "x".repeat(1200), "\u{1f989}".repeat(1200), "\n".repeat(1200), "%|\n".repeat(400)];
  for (const text of good) {
    const e = OW.makeEntry("0", "said", "note", "n", text);
    assert.equal(e.text, text, show(text.slice(0, 20)));
    assert.deepEqual(OW.parseEntry(e.line), e);
  }
  refused(() => OW.makeEntry("0", "said", "note", "n", "x".repeat(1201)), "1201 letters", /at most 1200/);
  refused(() => OW.makeEntry("0", "said", "note", "n", "\u{1f989}".repeat(1201)), "1201 astral symbols", /at most 1200/);
  refused(() => OW.makeEntry("0", "said", "note", "n", "\n".repeat(1201)), "1201 newlines", /at most 1200/);
  const bad = {
    "tab": "a\tb", "carriage return": "a\rb", "CRLF": "a\r\nb", "NUL": "a\u{0000}b", "form feed": "\f", "DEL": "a\u{007f}b", "C1 NEL": "a\u{0085}b", "C1 APC": "\u{009f}",
    "line separator": "a\u{2028}b", "paragraph separator": "a\u{2029}b", "no-break space": "a\u{00a0}b", "thin space": "a\u{2009}b", "ideographic space": "\u{3000}",
    "zero width space": "a\u{200b}b", "soft hyphen": "Eze\u{00ad}kiel", "right-to-left override": "\u{202e}", "isolates": "\u{2066}x\u{2069}", "byte order mark": "\u{feff}x",
    "Hangul filler": "\u{3164}", "variation selector 16": "\u{2764}\u{fe0f}", "combining grapheme joiner": "a\u{034f}b", "tag characters": "x\u{e0041}",
    "private use": "\u{e000}", "unassigned (plane 5)": "\u{50000}", "noncharacter": "\u{fffe}", "interlinear annotation": "a\u{fff9}b",
    "lone high surrogate": "a\u{d800}", "lone low surrogate": "\u{dc00}b", "surrogates reversed": "\u{dc00}\u{d800}",
  };
  for (const [what, text] of Object.entries(bad)) {
    refused(() => OW.makeEntry("0", "said", "note", "n", text), "text: " + what, /^entry text /);
    assert.equal(refText(text.normalize("NFC")), false, "the second reading refuses it too: " + what);
  }
});

test("LEX/1: arguments that are not strings are refused, in every place", () => {
  const good = ["26.1", "text", "verse", "n", "t"];
  assert.equal(OW.makeEntry(...good).line, "LEX/1|26.1|text|verse|n|t");
  const stringy = { toString: () => "26" };
  const others = [undefined, null, 26, 0, 1.5, NaN, true, false, 26n, Symbol("26"), ["26"], [], {}, stringy, new String("26"), () => "26"];
  for (let at = 0; at < 5; at++) for (const v of others) {
    const args = good.slice(); args[at] = v;
    refused(() => OW.makeEntry(...args), `argument ${at + 1} of makeEntry as ${typeof v}`, /five strings/);
  }
  refused(() => OW.makeEntry(), "no arguments", /five strings/);
  refused(() => OW.makeEntry("0", "text", "verse", "n"), "four arguments", /five strings/);
  for (const v of [...others, ["LEX/1|0|text|a|a|"], new String("LEX/1|0|text|a|a|")]) refused(() => OW.parseEntry(v), `parseEntry of ${typeof v}`, /a LEX\/1 line is a string/);
  refused(() => OW.parseEntry(), "parseEntry of nothing", /a LEX\/1 line is a string/);
});

test("LEX/1: parseEntry refuses escapes that are not canonical, raw separators and any other number of parts", () => {
  const P = "LEX/1|0|said|note|";
  // the three canonical escapes, in name and text
  assert.deepEqual([OW.parseEntry(P + "a%25b|x").name, OW.parseEntry(P + "a%7Cb|x").name], ["a%b", "a|b"]);
  assert.deepEqual([OW.parseEntry(P + "n|a%25b").text, OW.parseEntry(P + "n|a%7Cb").text, OW.parseEntry(P + "n|a%0Ab").text], ["a%b", "a|b", "a\nb"]);
  assert.equal(OW.parseEntry(P + "n|a%2541b").text, "a%41b", "an escaped percent sign is not read twice");
  assert.equal(OW.parseEntry(P + "n|%25%2525").text, "%%25");
  assert.equal(OW.parseEntry(P + "n|").text, "", "empty text");
  const bad = {
    "%7c (lower-case hex)": P + "n|a%7cb", "%41 (a letter needs no escape)": P + "n|a%41b", "%zz": P + "n|a%zzb", "a trailing %": P + "n|a%",
    "% and one digit": P + "n|a%2", "%0a (lower-case hex)": P + "n|a%0ab", "%80": P + "n|a%80b", "%7F": P + "n|a%7Fb", "raw U+007F": P + "n|a\u{007f}b",
    "%00": P + "n|a%00b", "%09 (tab)": P + "n|a%09b", "%0D": P + "n|a%0Db", "%20 (a space needs no escape)": P + "n|a%20b", "%E9": P + "n|caf%E9",
    "%C3%A9 (UTF-8 bytes)": P + "n|caf%C3%A9", "a raw % before text": P + "n|100% sure", "%u0041": P + "n|%u0041",
    "%7c in a name": P + "a%7cb|x", "%41 in a name": P + "%41|x", "a trailing % in a name": P + "100%|x", "%0A in a name": P + "a%0Ab|x", "%20 in a name": P + "a%20b|x",
    "a raw | in a name (seven parts)": P + "a|b|x", "a raw | in text (seven parts)": P + "n|a|b", "a trailing | (seven parts)": P + "n|x|",
    "five parts": "LEX/1|0|said|note|n", "five parts, no kind": "LEX/1|0|said|n|x", "four parts": "LEX/1|0|said|note", "one part": "LEX/1", "empty": "",
    "eight parts": P + "n|x|y|z", "only separators": "|||||",
    "tag LEX/2": "LEX/2|0|said|note|n|x", "tag lex/1": "lex/1|0|said|note|n|x", "tag OBS/1": "OBS/1|0|said|note|n|x", "tag LEX/1 with a space": " LEX/1|0|said|note|n|x",
    "tag LEXICON/2": "LEXICON/2|0|said|note|n|x", "a byte order mark first": "\u{feff}LEX/1|0|said|note|n|x", "no tag": "0|said|note|n|x|y",
    "a trailing newline": P + "n|x\n", "a raw newline in text": P + "n|a\nb", "a trailing carriage return": P + "n|x\r", "a leading newline": "\n" + P + "n|x",
    "an empty name": P + "|x", "an empty address": "LEX/1||said|note|n|x", "an empty layer": "LEX/1|0||note|n|x", "an empty kind": "LEX/1|0|said||n|x",
    "address 01": "LEX/1|01|said|note|n|x", "address 10000": "LEX/1|10000|said|note|n|x", "layer SAID": "LEX/1|0|SAID|note|n|x", "kind Note": "LEX/1|0|said|Note|n|x",
    "an escaped address": "LEX/1|%30|said|note|n|x", "an escaped layer": "LEX/1|0|sai%64|note|n|x",
    "a lone surrogate in text": P + "n|a\u{d800}", "a zero width space in a name": P + "a\u{200b}b|x", "a name with a trailing space": P + "n |x",
  };
  for (const [what, line] of Object.entries(bad)) {
    refused(() => OW.parseEntry(line), what);
    assert.equal(refLine(line), null, "the second reading refuses it too: " + what);
  }
  // the count of parts is its own refusal, before anything is read from them
  for (const line of [P + "n|a|b", P + "a|b|x", P + "n|x|", P + "n|x|y|z", "LEX/1|0|said|note|n", "LEX/1|0|said|note", "LEX/1", "", "LEX/2|0|said|note|n|x"])
    refused(() => OW.parseEntry(line), show(line), /^not a LEX\/1 line: the tag LEX\/1 and five more parts/);
  // an OBS/1 line is not a LEX/1 line, and a LEX/1 line is not an observation
  refused(() => OW.parseEntry("OBS/1|symbol|owl|text=owl %7C 100%25%0Awise"), "an OBS/1 line");
  assert.throws(() => OW.parseObservation("LEX/1|0|said|note|n|x"));
});

test("LEX/1: the whole line is NFC: a mark that would join the escape of | or of a newline is refused", () => {
  // "%7C" + cedilla would compose to "%7" + C-cedilla, "%0A" + acute to "%0" + A-acute: such a line could not be read back
  refused(() => OW.makeEntry("0", "said", "note", "a|\u{0327}b", "x"), "a cedilla after | in a name", /NFC/);
  refused(() => OW.makeEntry("0", "said", "note", "n", "a|\u{0327}b"), "a cedilla after | in text", /NFC/);
  refused(() => OW.makeEntry("0", "said", "note", "n", "\n\u{0301}"), "an acute after a newline", /NFC/);
  refused(() => OW.parseEntry("LEX/1|0|said|note|n|%0A\u{0301}"), "the same, as a line");
  refused(() => OW.parseEntry("LEX/1|0|said|note|n|%0\u{00c1}"), "its NFC form");
  refused(() => OW.parseEntry("LEX/1|0|said|note|a%7\u{00c7}b|x"), "the NFC form of the name case");
  // marks that join nothing are fine: after "%" (written %25: no digit composes), after a space, first in a text
  for (const [name, text] of [["100%\u{0301}", "x"], ["n", "%\u{0327}"], ["n", "\u{0327}"], ["n", "a|\u{0308}b"], ["n", "\n\u{0327}"], ["n", " \u{0301}"]]) {
    const e = OW.makeEntry("0", "said", "note", name, text);
    assert.equal(e.line.normalize("NFC"), e.line);
    assert.deepEqual(OW.parseEntry(e.line), e, show(e.line));
  }
});

test("LEX/1: errors are fixed plain sentences and never carry the input", () => {
  const MARK = "ZQXJ";                       // a marker no fixed sentence contains
  const attempts = [
    () => OW.makeEntry(MARK, "text", "verse", "n", "t"), () => OW.makeEntry("0", MARK, "verse", "n", "t"), () => OW.makeEntry("0", "text", MARK, "n", "t"),
    () => OW.makeEntry("0", "text", "verse", MARK + "\u{202e}", "t"), () => OW.makeEntry("0", "text", "verse", MARK + "\u{3164}", "t"),
    () => OW.makeEntry("0", "text", "verse", MARK.repeat(30), "t"), () => OW.makeEntry("0", "text", "verse", "n", MARK + "\t"),
    () => OW.makeEntry("0", "text", "verse", "n", MARK + "\u{fe0f}"), () => OW.makeEntry("0", "text", "verse", "n", MARK.repeat(400)),
    () => OW.makeEntry("0", "text", "verse", "n", MARK + "\n\u{0301}"), () => OW.makeEntry(MARK, MARK, MARK, 5, MARK),
    () => OW.parseEntry(MARK), () => OW.parseEntry("LEX/1|0|text|verse|n|" + MARK + "%41"), () => OW.parseEntry("LEX/1|" + MARK + "|text|verse|n|t"),
    () => OW.parseLexiconText(MARK), () => OW.parseLexiconText(MARK + "\n"), () => OW.parseLexiconText("LEX/1|0|text|verse|n|t\nLEX/1|0.1|text|" + MARK + "|n|t\n"),
    () => OW.parseLexiconText("LEX/1|1.1|text|verse|" + MARK + "|t\n"), () => OW.parseLexiconText("LEX/1|1|text|verse|" + MARK + "|t\nLEX/1|1|text|verse|" + MARK + "|t\n"),
    () => OW.lexiconText([{ line: 5, name: MARK }]), () => OW.parentOf([MARK]), () => OW.depthOf({ MARK }), () => OW.countWord(MARK, 5), () => OW.childrenIndex(MARK), () => OW.layerCounts(MARK),
  ];
  const seen = new Set();
  for (const [i, attempt] of attempts.entries()) {
    const message = refused(attempt, "attempt " + (i + 1));
    assert.ok(!message.includes(MARK), "attempt " + (i + 1) + ": the message does not repeat the input");
    seen.add(message.replace(/^line \d+: /, ""));
  }
  assert.ok(seen.size >= 15, "the different refusals have different sentences");
  // the same mistake gives the same sentence whatever the input was
  const sentence = (name) => refused(() => OW.makeEntry("0", "text", "verse", name, "t"), show(name));
  assert.equal(sentence(" a"), sentence("b\tc"));
  assert.equal(sentence("a\u{d800}"), sentence("\u{202e}x"));
});

test("LEX/1: 20,000 random entries round trip with distinct lines, and makeEntry agrees with the second reading on every attempt", () => {
  const rnd = seeded(20261114);
  const GOOD = ["a", "B", "z", "7", "0", " ", ".", ",", ":", "-", "'", "\"", "(", ")", "<", "3", "=", "+", "/", "*", "\u{00e9}", "\u{00c5}", "\u{00df}", "\u{03c3}",
    "\u{05d7}", "\u{05b7}", "\u{0301}", "\u{0327}", "\u{030a}", "\u{0308}", "\u{1f989}", "\u{1d538}", "\u{2081}", "\u{00b0}", "\u{2212}", "%", "|", "C", "A", "5", "2", "e\u{0301}",
    "\u{1100}", "\u{1161}", "%7C", "%25", "%0A", "\u{fb01}", "\u{212b}"];
  const BAD = ["\t", "\u{0000}", "\u{007f}", "\u{0085}", "\u{00a0}", "\u{200b}", "\u{202e}", "\u{feff}", "\u{3164}", "\u{fe0f}", "\u{d800}", "\u{dc00}", "\u{2028}", "\u{e000}", "\u{50000}", "\r"];
  const INDEX = ["0", "1", "2", "9", "10", "26", "43", "100", "999", "9999"], BAD_INDEX = ["10000", "01", "", "-1", "1e1"];
  const KINDS = ["verse", "term", "note", "plain", "k0", "x-ray", "a234567890123456"], BAD_KINDS = ["", "Verse", "1a", "a_b", "a2345678901234567"];
  const field = (min, max, newline) => {
    let s = "";
    for (let i = min + Math.floor(rnd() * (max - min + 1)); i > 0; i--) s += rnd() < 0.985 ? (newline && rnd() < 0.06 ? "\n" : pickFrom(rnd, GOOD)) : pickFrom(rnd, BAD);
    return s;
  };
  const address = () => {
    const parts = [];
    for (let i = 1 + Math.floor(rnd() * rnd() * 8) + (rnd() < 0.01 ? 8 : 0); i > 0; i--) parts.push(rnd() < 0.99 ? pickFrom(rnd, INDEX) : pickFrom(rnd, BAD_INDEX));
    return parts.join(".");
  };
  const lines = new Map();            // line → the entry that gave it
  let made = 0, refusedCount = 0, attempts = 0;
  while (made < 20000) {
    assert.ok(++attempts <= 200000, "the generator makes enough valid entries");
    const args = [address(), rnd() < 0.99 ? pickFrom(rnd, OW.LAYERS) : pickFrom(rnd, ["TEXT", "note", ""]), rnd() < 0.99 ? pickFrom(rnd, KINDS) : pickFrom(rnd, BAD_KINDS),
      field(1, 6, false), field(0, 10, true)];
    const want = refEntry(...args), got = tryMake(...args);
    if (want === null) {
      assert.equal(got.ok, false, "must be refused: " + show(args));
      assert.match(got.error.message, PLAIN);
      refusedCount++;
      continue;
    }
    assert.equal(got.ok, true, "must be accepted: " + show(args));
    made++;
    const e = got.entry;
    assert.deepEqual(e, want, show(args));
    assert.deepEqual(OW.parseEntry(e.line), e, "round trip: " + show(e.line));
    const key = JSON.stringify([e.address, e.layer, e.kind, e.name, e.text]);
    if (lines.has(e.line)) assert.equal(lines.get(e.line), key, "two entries with one line: " + show(e.line));
    lines.set(e.line, key);
  }
  assert.equal(new Set(lines.values()).size, lines.size, "distinct entries have distinct lines");
  const joined = [...lines.keys()].join("\n") + "\n";
  assert.equal(joined.normalize("NFC"), joined, "lines joined by newlines are NFC as a whole");
  assert.equal(joined.split("\n").length, lines.size + 1, "and a newline never falls inside a line");
  assert.ok(lines.size > 19000, `a wide sample (${lines.size} distinct entries)`);
  assert.ok(refusedCount > 3000, `the refusals are sampled too (${refusedCount})`);
});

test("LEX/1: 20,000 one-character mutations of canonical lines: every accepted mutant is its own canonical line", () => {
  const rnd = seeded(593);
  const PARTS = ["a", "B", " ", "%", "|", "\u{00e9}", "\u{05d7}\u{05b7}", "\u{1f989}", "7", "C", "A", "5", "2", "0", "x\u{0301}", ".", "-", "\n"];
  const INDEX = ["0", "1", "9", "10", "26", "100", "9999"];
  const POOL = ["a", "B", " ", "|", "%", "\n", "\t", "\u{0000}", "\u{007f}", "\u{0085}", "\u{00e9}", "\u{0301}", "\u{0327}", "\u{00c5}", "\u{1f989}", "\u{05b7}", "\u{00a0}", "7", "C", "A",
    "c", "2", "5", "0", "1", ".", "-", "x", "\u{200b}", "\u{d800}", "\u{dc00}", "L", "/"];
  const some = (min, max, newline) => { let s = ""; for (let i = min + Math.floor(rnd() * (max - min + 1)); i > 0; i--) { const p = pickFrom(rnd, PARTS); s += p === "\n" && !newline ? "n" : p; } return s; };
  const canonical = [];
  while (canonical.length < 2000) {
    const address = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pickFrom(rnd, INDEX)).join(".");
    const got = tryMake(address, pickFrom(rnd, OW.LAYERS), pickFrom(rnd, ["verse", "note", "k-9"]), some(1, 5, false), some(0, 8, true));
    if (got.ok) canonical.push(got.entry.line);
  }
  let accepted = 0, refusedCount = 0;
  for (const line of canonical) for (let j = 0; j < 10; j++) {
    let mutant = line;
    while (mutant === line) {
      const at = Math.floor(rnd() * (line.length + 1)), how = rnd();
      if (how < 0.4) mutant = line.slice(0, at) + pickFrom(rnd, POOL) + line.slice(at);                      // one character more
      else if (how < 0.7) mutant = line.slice(0, at) + line.slice(at + 1);                                   // one less
      else mutant = line.slice(0, at) + pickFrom(rnd, POOL) + line.slice(at + 1);                            // one changed
    }
    const want = refLine(mutant), got = tryParse(mutant);
    assert.equal(got.ok, want !== null, (want ? "must be accepted: " : "must be refused: ") + show(mutant) + " from " + show(line));
    if (!got.ok) { assert.match(got.error.message, PLAIN); refusedCount++; continue; }
    accepted++;
    const e = got.entry;
    assert.equal(e.line, mutant, "an accepted line is the line of its entry");
    assert.deepEqual(e, want, show(mutant));
    assert.equal(OW.makeEntry(e.address, e.layer, e.kind, e.name, e.text).line, mutant, "and its entry writes it again");
    assert.equal(mutant.normalize("NFC"), mutant);
  }
  assert.equal(accepted + refusedCount, 20000);
  assert.ok(accepted > 3000 && refusedCount > 3000, `both outcomes are sampled (${accepted} accepted, ${refusedCount} refused)`);
});

// ─── Step 0: LEXICON/2 text, its order and its limits ────────────────────────

const entryAt = (address, text = "t") => OW.makeEntry(address, "said", "note", "n " + address, text);
const textOf = (addresses) => addresses.map((a) => entryAt(a).line + "\n").join("");
const addressesOf = (text) => OW.parseLexiconText(text).map((e) => e.address);
/** Depth-first order with children in increasing index order: indices compared as numbers, a parent before its children. */
const byAddress = (a, b) => {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
};
// A small tree with the shape of the Ezekiel lexicon: sparse indices, and 26.1.1 a string prefix of 26.1.10 and 26.1.16.
const TREE = [
  ["0", "reading", "about"], ["0.1", "reading", "rule"], ["0.2", "said", "notice"],
  ["5", "reading", "book"], ["5.19", "reading", "chapter"], ["5.19.15", "text", "verse"],
  ["26", "reading", "book"], ["26.1", "reading", "chapter"], ["26.1.1", "text", "verse"], ["26.1.1.1", "text", "term"], ["26.1.1.4", "text", "term"],
  ["26.1.1.4.1", "said", "plain"], ["26.1.1.4.2", "checked", "count"], ["26.1.4", "text", "verse"], ["26.1.9", "text", "verse"],
  ["26.1.10", "text", "verse"], ["26.1.16", "text", "verse"], ["26.1.16.1", "text", "term"],
  ["43", "reading", "book"], ["43.3", "reading", "chapter"], ["43.3.16", "text", "verse"],
  ["100", "reading", "note"], ["100.1", "reading", "note"], ["100.1.1", "said", "search"], ["100.11", "reading", "note"],
].map(([address, layer, kind]) => OW.makeEntry(address, layer, kind, "name of " + address, "text of " + address + "\nsecond line | 100%"));

test("LEXICON/2: the text is every line followed by a newline, and reads back to the same entries", () => {
  assert.deepEqual([OW.MAX_LEXICON_BYTES, OW.MAX_ENTRIES, OW.MAX_EPOCHS], [60000, 3000, 16]);
  const text = OW.lexiconText(TREE);
  assert.equal(text, TREE.map((e) => e.line).join("\n") + "\n");
  assert.equal(text.split("\n").length, TREE.length + 1, "escaped newlines never split a line");
  const back = OW.parseLexiconText(text);
  assert.deepEqual(back, TREE);
  assert.ok(Array.isArray(back) && back.every((e) => Object.isFrozen(e)));
  assert.equal(OW.lexiconText(back), text);
  assert.deepEqual(addressesOf(OW.lexiconText(TREE.slice(0, 1))), ["0"], "one entry is a lexicon");
  assert.equal(OW.lexiconText([]), "");
  refused(() => OW.parseLexiconText(""), "no entries", /at least one entry/);
  refused(() => OW.parseLexiconText(text.slice(0, -1)), "no final newline", /ends with a newline/);
  refused(() => OW.parseLexiconText(text + "\n"), "an empty last line", /^line 26: not a LEX\/1 line/);
  refused(() => OW.parseLexiconText("\n" + text), "an empty first line", /^line 1: not a LEX\/1 line/);
  refused(() => OW.parseLexiconText(text.replace("\n", "\n\n")), "an empty line inside", /^line 2: /);
  refused(() => OW.parseLexiconText(text.replaceAll("\n", "\r\n")), "CRLF line ends", /^line 1: /);
  refused(() => OW.parseLexiconText("\u{feff}" + text), "a byte order mark first", /^line 1: not a LEX\/1 line/);
  refused(() => OW.parseLexiconText(text.replace("LEX/1|5|", "LEX/1|05|")), "one bad line", /^line 4: an address is/);
  refused(() => OW.parseLexiconText(text.replace("second line %7C 100%25", "second line %7c 100%25")), "one line that is not canonical", /^line 1: not the canonical line/);
  refused(() => OW.parseLexiconText(OW.journeyText([OW.makeObservation("sound", { hz: 432, ms: 400 }, "tone")])), "a journey", /^line 1: not a LEX\/1 line/);
  assert.throws(() => OW.parseJourney(text), "a lexicon text is not a journey");
  for (const v of [undefined, null, 5, ["LEX/1|0|text|a|a|\n"], { text }, new String(text)]) refused(() => OW.parseLexiconText(v), `a ${typeof v}`, /a lexicon text is a string/);
  for (const v of [undefined, null, "LEX/1|0|text|a|a|", { line: "x" }, [null], ["LEX/1|0|text|a|a|"], [{ line: 5 }], [["0", "text", "a", "a", ""]]])
    refused(() => OW.lexiconText(v), "lexiconText of " + show(v ?? null), /lexiconText needs/);
});

test("LEXICON/2 order rule: sparse increasing indices are accepted; a missing parent, a repeated or decreasing index, a line out of depth-first order are refused", () => {
  const good = [
    ["0"], ["9999"], ["9", "10"], ["0", "9999"],
    ["5", "26", "26.1", "26.1.4", "26.1.4.0", "26.1.9", "43", "43.3", "43.3.16", "100"],
    ["26", "26.1", "26.1.1", "26.1.1.1", "26.1.1.4", "26.1.10", "26.1.16", "26.1.16.1"],
    ["1", "1.1", "1.1.0", "1.10", "1.10.0"], ["1", "1.0", "10", "10.0"],
    ["3", "3.3", "3.3.3", "3.3.3.3", "3.3.3.3.3", "3.3.3.3.3.3", "3.3.3.3.3.3.3", "3.3.3.3.3.3.3.3", "3.4", "4"],
    ["0", "0.0", "0.0.0", "0.1", "0.1.0", "1", "1.0", "1.0.0", "1.0.0.0", "1.0.1", "2"],
  ];
  for (const seq of good) assert.deepEqual(addressesOf(textOf(seq)), seq, seq.join(" "));
  const FIRST = /^line \d+: the first entry of a lexicon is a top-level entry$/, ORDER = /^line \d+: out of depth-first order/, INDEX = /^line \d+: the index is not greater/;
  const bad = [
    [["0.0"], FIRST, 1, "a first line 0.0"], [["26.1.4"], FIRST, 1, "a first line three deep"],
    [["0", "1.0"], ORDER, 2, "a missing parent (1.0 after 0)"], [["1", "1.2.3"], ORDER, 2, "a skipped level"], [["1", "2", "2.0", "2.0.0", "3.0"], ORDER, 5, "a missing parent after a full branch"],
    [["0", "0"], INDEX, 2, "a repeated top-level index"], [["0", "0.3", "0.3"], INDEX, 3, "a repeated index"], [["0", "0.3", "0.3.1", "0.3"], INDEX, 4, "a repeated entry after its child"],
    [["5", "3"], INDEX, 2, "a decreasing top-level index"], [["1", "1.5", "1.2"], INDEX, 3, "a decreasing index"], [["10", "9"], INDEX, 2, "10 then 9 (numbers, not strings)"],
    [["2", "10", "9"], INDEX, 3, "9 after 10"], [["1", "1.10", "1.9"], INDEX, 3, "1.9 after 1.10"], [["1", "1.0", "1.5", "1.0"], INDEX, 4, "back to an earlier sibling"],
    [["1", "1.0", "2", "1.1"], ORDER, 4, "a child after its parent's later sibling started"], [["1", "1.0", "1.5", "1.0.0"], ORDER, 4, "a grandchild after its uncle"],
    [["1", "10", "10.0", "1.0"], ORDER, 4, "1, 10, 10.0, 1.0 (1 is a string prefix of 10, not its ancestor)"],
    [["1", "1.1", "1.10", "1.10.0", "1.1.0"], ORDER, 5, "1, 1.1, 1.10, 1.10.0, 1.1.0"],
    [["26", "26.1", "26.1.1", "26.1.10", "26.1.1.5"], ORDER, 5, "26.1.1.5 after 26.1.10"], [["26", "26.1", "26.1.1", "26.1.10.1"], ORDER, 4, "26.1.10.1 after 26.1.1"],
    [["0", "0.1", "1", "0.2"], ORDER, 4, "a top-level entry between two children"], [["1", "2", "1"], INDEX, 3, "a top-level entry again"],
  ];
  for (const [seq, pattern, lineNumber, what] of bad) {
    const message = refused(() => OW.parseLexiconText(textOf(seq)), what, pattern);
    assert.equal(message.split(":")[0], "line " + lineNumber, what + ": the line that breaks the rule is named");
  }
});

test("LEXICON/2 order rule: of all orderings of a tree exactly one is accepted, the depth-first listing in index order", () => {
  const rnd = seeded(7);
  const INDEX = [0, 1, 2, 9, 10, 11, 19, 100, 101, 9999];            // sparse, with string prefixes that collide (1, 10, 100, 101, 19)
  const randomTree = (n) => {                                         // a set of addresses closed under parent
    const set = new Set();
    while (set.size < n) {
      const parents = ["", ...set].filter((a) => a === "" || a.split(".").length < 8);
      const p = pickFrom(rnd, parents);
      set.add((p === "" ? "" : p + ".") + pickFrom(rnd, INDEX));
    }
    return [...set];
  };
  function* orderings(a, n = a.length) {                              // Heap's algorithm
    if (n <= 1) { yield a.slice(); return; }
    for (let i = 0; i < n; i++) { yield* orderings(a, n - 1); const j = n % 2 ? 0 : i; [a[j], a[n - 1]] = [a[n - 1], a[j]]; }
  }
  const lineOf = new Map(), lineFor = (a) => lineOf.get(a) ?? (lineOf.set(a, entryAt(a).line + "\n"), lineOf.get(a));
  const acceptsOrder = (seq) => { try { OW.parseLexiconText(seq.map(lineFor).join("")); return true; } catch { return false; } };
  let tried = 0;
  for (let t = 0; t < 150; t++) {
    const tree = randomTree(2 + Math.floor(rnd() * 5)), want = tree.slice().sort(byAddress).join(" ");
    const ok = [];
    for (const p of orderings(tree.slice())) { tried++; if (acceptsOrder(p)) ok.push(p.join(" ")); }
    assert.deepEqual(ok, [want], "tree " + tree.join(" "));
  }
  assert.ok(tried > 15000, `orderings tried: ${tried}`);
  // longer sequences, some damaged: accepted exactly when they are the sorted listing of a set closed under parent, without repeats
  let acceptedCount = 0, refusedCount = 0;
  for (let t = 0; t < 6000; t++) {
    const seq = randomTree(1 + Math.floor(rnd() * 12)).sort(byAddress), n = seq.length, how = rnd();
    if (how < 0.3) { const i = Math.floor(rnd() * n), j = Math.floor(rnd() * n); [seq[i], seq[j]] = [seq[j], seq[i]]; }
    else if (how < 0.45) seq.splice(Math.floor(rnd() * n), 1);
    else if (how < 0.55) seq.splice(Math.floor(rnd() * n), 0, seq[Math.floor(rnd() * n)]);
    if (!seq.length) continue;
    const set = new Set(seq), closed = seq.every((a) => !a.includes(".") || set.has(a.slice(0, a.lastIndexOf("."))));
    const want = set.size === seq.length && closed && seq.join(" ") === seq.slice().sort(byAddress).join(" ");
    assert.equal(acceptsOrder(seq), want, seq.join(" "));
    if (want) acceptedCount++; else refusedCount++;
  }
  assert.ok(acceptedCount > 1500 && refusedCount > 1500, `both outcomes are sampled (${acceptedCount} accepted, ${refusedCount} refused)`);
});

test("LEXICON/2 limits: 16 top-level entries, 60,000 bytes of UTF-8, 3,000 lines", () => {
  const tops = Array.from({ length: 17 }, (_, i) => String(i * 7));
  assert.equal(addressesOf(textOf(tops.slice(0, 16))).length, 16);
  refused(() => OW.parseLexiconText(textOf(tops)), "17 top-level entries", /^line 17: a lexicon holds at most 16 top-level entries$/);
  const deep = ["0", ...Array.from({ length: 40 }, (_, i) => "0." + i), ...tops.slice(1, 16)];
  assert.equal(addressesOf(textOf(deep)).length, 56, "the limit counts top-level entries only");
  refused(() => OW.parseLexiconText(textOf([...deep, "9999"])), "a 17th top-level entry after children", /^line 57: a lexicon holds at most 16 top-level entries$/);

  /** A canonical lexicon text of exactly `bytes` UTF-8 bytes: one top-level entry and children whose texts repeat `filler`. */
  const sized = (bytes, filler = "x") => {
    const per = utf8Bytes(filler), lines = [entryAt("0", "").line + "\n"];
    let left = bytes - utf8Bytes(lines[0]);
    for (let i = 0; left > 0; i++) {
      const overhead = utf8Bytes(entryAt("0." + i, "").line) + 1, room = left - overhead;
      assert.ok(room >= 0, "the builder never leaves less than one line");
      const last = room <= 1100 * per;                                            // the last child takes all that is left
      const count = last ? Math.floor(room / per) : 1000;
      const pad = last ? "y".repeat(room - count * per) : "";                     // ASCII, to reach a size the filler cannot
      lines.push(entryAt("0." + i, filler.repeat(count) + pad).line + "\n");
      left -= overhead + count * per + pad.length;
    }
    assert.equal(left, 0);
    return lines.join("");
  };
  const full = sized(60000);
  assert.equal(utf8Bytes(full), 60000);
  assert.equal(OW.lexiconText(OW.parseLexiconText(full)), full, "exactly 60,000 bytes is accepted");
  const over = sized(60001);
  assert.equal(utf8Bytes(over), 60001);
  refused(() => OW.parseLexiconText(over), "60,001 bytes", /^a lexicon text is at most 60000 bytes of UTF-8$/);
  // bytes, not UTF-16 units: the same limit for two-byte and four-byte characters
  for (const filler of ["\u{00e9}", "\u{1f989}"]) {
    const wideFull = sized(60000, filler), wideOver = sized(60001, filler);
    assert.ok(wideOver.length < 40000, "far fewer than 60,000 UTF-16 units");
    assert.deepEqual([utf8Bytes(wideFull), utf8Bytes(wideOver)], [60000, 60001]);
    assert.equal(OW.lexiconText(OW.parseLexiconText(wideFull)), wideFull);
    refused(() => OW.parseLexiconText(wideOver), "60,001 bytes of " + show(filler), /at most 60000 bytes/);
  }
  refused(() => OW.parseLexiconText("x".repeat(60001)), "60,001 characters with no newline", /at most 60000 bytes/);
  refused(() => OW.parseLexiconText(over.repeat(40)), "2.4 million bytes", /at most 60000 bytes/);
  // lines are counted before any line is read; no canonical text can reach the count (its smallest line is 18 bytes,
  // and only 16 lines can be top-level), so the byte limit binds first for real lexicons
  refused(() => OW.parseLexiconText("\n".repeat(3001)), "3,001 lines", /^a lexicon holds at most 3000 entries$/);
  refused(() => OW.parseLexiconText("\n".repeat(3000)), "3,000 empty lines", /^line 1: not a LEX\/1 line/);
  assert.equal(utf8Bytes(OW.makeEntry("0", "text", "a", "a", "").line + "\n"), 18);
});

// ─── Step 0: helpers ─────────────────────────────────────────────────────────

test("helpers: parentOf, depthOf, childrenIndex and layerCounts", () => {
  assert.deepEqual(["26", "26.1", "26.1.10", "26.1.1.4.2", "0", ""].map(OW.parentOf), ["", "26", "26.1", "26.1.1.4", "", ""]);
  assert.deepEqual(["", "26", "26.1", "26.1.1.4", "9999.9999.9999.9999.9999.9999.9999.9999"].map(OW.depthOf), [0, 1, 2, 4, 8]);
  for (const e of TREE) {
    assert.equal(OW.depthOf(e.address), OW.depthOf(OW.parentOf(e.address)) + 1);
    assert.ok(e.address.startsWith(OW.parentOf(e.address)));
  }
  for (const v of [undefined, null, 26, ["26"], { address: "26" }, new String("26")]) {
    refused(() => OW.parentOf(v), `parentOf of a ${typeof v}`, /an address is a string/);
    refused(() => OW.depthOf(v), `depthOf of a ${typeof v}`, /an address is a string/);
  }

  const index = OW.childrenIndex(TREE);
  assert.ok(index instanceof Map);
  assert.deepEqual([...index.keys()], ["", ...TREE.map((e) => e.address)], "the root and every entry have a list, in canonical order");
  assert.deepEqual(index.get(""), ["0", "5", "26", "43", "100"]);
  assert.deepEqual(index.get("26.1"), ["26.1.1", "26.1.4", "26.1.9", "26.1.10", "26.1.16"]);
  assert.deepEqual(index.get("26.1.1"), ["26.1.1.1", "26.1.1.4"], "26.1.10 and 26.1.16 are not children of 26.1.1");
  assert.deepEqual(index.get("100"), ["100.1", "100.11"]);
  assert.deepEqual(index.get("43.3.16"), [], "a leaf has an empty list");
  assert.equal(index.get("26.1.2"), undefined, "an address that is no entry has none");
  const walk = (a) => [a, ...index.get(a).flatMap(walk)];
  assert.deepEqual(walk("").slice(1), TREE.map((e) => e.address), "walking the index depth-first gives the canonical order");
  for (const [parent, children] of index) for (const c of children) assert.equal(OW.parentOf(c), parent);
  assert.deepEqual([...OW.childrenIndex([])], [["", []]]);
  // the entries of a lexicon object (address and layer, no line) serve as well
  const bare = TREE.map((e) => ({ address: e.address, layer: e.layer }));
  assert.deepEqual([...OW.childrenIndex(bare)], [...index]);

  assert.deepEqual(OW.layerCounts(TREE), { text: 10, said: 3, checked: 1, reading: 11 });
  assert.deepEqual(Object.keys(OW.layerCounts(TREE)), ["text", "said", "checked", "reading"], "member order");
  assert.deepEqual(OW.layerCounts(bare), OW.layerCounts(TREE));
  assert.deepEqual(OW.layerCounts([]), { text: 0, said: 0, checked: 0, reading: 0 });
  assert.equal(Object.values(OW.layerCounts(TREE)).reduce((a, b) => a + b, 0), TREE.length);
  assert.deepEqual(OW.layerCounts([{ layer: "text" }, { layer: "constructor" }, { layer: "__proto__" }, { layer: "TEXT" }, {}]), { text: 1, said: 0, checked: 0, reading: 0 },
    "only the four layers are counted");
  for (const v of [undefined, null, "x", { length: 1 }, [null], ["0"]]) {
    refused(() => OW.childrenIndex(v), "childrenIndex of " + show(v ?? null), /childrenIndex needs/);
    refused(() => OW.layerCounts(v), "layerCounts of " + show(v ?? null), /layerCounts needs/);
  }
  refused(() => OW.childrenIndex([{ layer: "text" }]), "an entry without an address", /childrenIndex needs/);

  // on random trees: every entry is listed once, under its parent, in order
  const rnd = seeded(43316);
  for (let t = 0; t < 200; t++) {
    const set = new Set();
    for (let n = 1 + Math.floor(rnd() * 40); set.size < n;) {
      const parents = ["", ...set].filter((a) => a === "" ? [...set].filter((x) => !x.includes(".")).length < 16 : a.split(".").length < 8);
      const p = pickFrom(rnd, parents);
      set.add((p === "" ? "" : p + ".") + Math.floor(rnd() * 30));
    }
    const entries = OW.parseLexiconText(textOf([...set].sort(byAddress)));
    const idx = OW.childrenIndex(entries);
    assert.equal(idx.size, entries.length + 1);
    assert.deepEqual([...idx.values()].flat().sort(byAddress), entries.map((e) => e.address), "every entry is some entry's child, once");
    for (const [parent, children] of idx) {
      assert.deepEqual(children.slice().sort(byAddress), children, "children in index order");
      assert.ok(children.every((c) => OW.parentOf(c) === parent && OW.depthOf(c) === OW.depthOf(parent) + 1));
    }
  }
});

test("countWord: whole words only, whatever their case, both strings in NFC", () => {
  assert.equal(OW.countWord("four fourth FOUR, four.", "four"), 3);
  assert.equal(OW.countWord("four fourth FOUR, four.", "FOUR"), 3);
  assert.equal(OW.countWord("four fourth FOUR, four.", "fourth"), 1);
  assert.equal(OW.countWord("four fourth FOUR, four.", "fou"), 0);
  assert.equal(OW.countWord("Four. four; (four) \"four\" four's four-fold four4 4four\nfour", "four"), 9, "anything that is not a letter bounds a word");
  assert.equal(OW.countWord("fourfour xfour fours fourteen", "four"), 0, "a letter on either side does not");
  assert.equal(OW.countWord("", "four"), 0);
  assert.equal(OW.countWord("four", ""), 0, "an empty word is found nowhere");
  assert.equal(OW.countWord(". four .", ""), 0, "not even between two characters that are not letters");
  assert.equal(OW.countWord("four", "four"), 1);
  // phrases
  const twice = "they turned not when they went; and they turned not when they went.";
  assert.equal(OW.countWord(twice, "they turned not when they went"), 2);
  assert.equal(OW.countWord(twice, "they"), 4);
  assert.equal(OW.countWord(twice, "turned not"), 2);
  assert.equal(OW.countWord("a a a", "a a"), 1, "matches do not overlap");
  assert.equal(OW.countWord("ba a a", "a a"), 1, "a match may begin inside a stretch that was passed over");
  assert.equal(OW.countWord("-a--a-", "-a-"), 2);
  // NFC: composed and decomposed spellings are the same word, and an accented letter is another letter
  assert.equal(OW.countWord("cafe\u{0301} CAF\u{00c9} caf\u{00e9}", "caf\u{00e9}"), 3);
  assert.equal(OW.countWord("cafe\u{0301} CAF\u{00c9} caf\u{00e9}", "cafe\u{0301}"), 3);
  assert.equal(OW.countWord("caf\u{00e9} cafe\u{0301}", "cafe"), 0);
  assert.equal(OW.countWord("four\u{0308} four x\u{0327}four", "four"), 1, "a combining mark belongs to its letter, with or without a composed form");
  // every character of the word is read literally
  assert.equal(OW.countWord("a.c abc a.c", "a.c"), 2);
  for (const w of ["(3)", "[a]", "{4,5}", "1+1", "a|b", "x*y", "why?", "^start", "end$", "back\\slash", "1/16", "a-b", "<3", "<--"]) {
    assert.equal(OW.countWord(`${w} = ${w}; ${w}`, w), 3, w);
    assert.equal(OW.countWord("abc", w), 0, w);
  }
  // code points outside the BMP count as one character
  assert.equal(OW.countWord("\u{1d538}\u{1d538} \u{1d538} x\u{1d538}", "\u{1d538}"), 1, "astral letters bound a word like any letter");
  assert.equal(OW.countWord("\u{1f989}\u{1f989} \u{1f989}", "\u{1f989}"), 3, "astral symbols are not letters");
  assert.equal(OW.countWord("a\u{1d538}b \u{1f989}four\u{1f989}", "four"), 1);
  for (const [text, word] of [[undefined, "four"], ["four", undefined], [null, null], [4, "4"], [["four"], "four"], ["four", /four/]])
    refused(() => OW.countWord(text, word), "countWord of " + typeof text + " and " + typeof word, /countWord needs/);
});

// ─── Phase 1: shared fixtures ────────────────────────────────────────────────

const BM = await load("scripts/biomesh-core.js");
const SC = await load("scripts/seal-crypto.js");
const AT = "2026-01-01T00:00:00.000Z";
const clone = (v) => JSON.parse(JSON.stringify(v));
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");      // a second SHA-256, not the core's
async function refusedAsync(fn, what, pattern) {
  let error = null;
  try { await fn(); } catch (e) { error = e; }
  assert.ok(error instanceof Error, `${what}: must be refused`);
  assert.match(error.message, PLAIN, `${what}: a plain message`);
  if (pattern) assert.match(error.message, pattern, what);
  return error.message;
}

// A small tree with four top-level entries (four epochs). The verse texts are made up for the test.
const SMALL = [
  ["0", "reading", "about", "What this lexicon is", "Words, translations and sources."],
  ["0.1", "reading", "rule", "The four layers", "text | said | checked | reading: 100%\nof the entries carry one"],
  ["26", "reading", "book", "Ezekiel", ""],
  ["26.1", "reading", "chapter", "Ezekiel 1", ""],
  ["26.1.4", "text", "verse", "Ezekiel 1:4", "a made-up verse for the test, with four words four times: four, four"],
  ["26.1.4.1", "text", "term", "a made-up term", ""],
  ["26.1.4.1.1", "said", "plain", "Plain words", "Someone named here says this."],
  ["26.1.4.1.2", "checked", "count", "Counted", "Counted: four appears four times. Count with me."],
  ["43", "reading", "book", "John", ""],
  ["43.3", "reading", "chapter", "John 3", ""],
  ["43.3.16", "text", "verse", "John 3:16 (stand-in)", "another made-up verse, \u{1e25}ashmal \u{05d7}\u{05b7}\u{05e9}\u{05b0}\u{05c1}\u{05de}\u{05b7}\u{05dc} \u{1f989}"],
  ["100", "reading", "note", "The author's notes", ""],
  ["100.1", "reading", "note", "Line 1", "a note"],
  ["100.1.1", "said", "search", "A search", "A search made for this test found nothing."],
].map((r) => OW.makeEntry(...r));
const TOPS = ["0", "26", "43", "100"];

/** A sealed package of a tree lexicon, with everything that made it. */
async function sealed(entries = SMALL, at = AT, route = undefined) {
  const bundle = await OW.buildLexiconBundle(entries, { at }), keys = await OW.newSessionKeys();
  const { certificate, report } = await OW.issueCertificate(bundle, keys, at);
  const pack = OW.makeHyperpack({ ...bundle, certificate }, route), wire = JSON.stringify(pack);
  return { entries, bundle, keys, certificate, report, pack, wire };
}
let smallOnce = null;
const small = () => (smallOnce ??= sealed());               // built once, never changed: tests work on clones

/** A journey of First Explorers, grown as that page grows it (the helper of tests/unit/strix-overwatch.test.mjs). */
async function journeyBundle(at = AT) {
  const obs = [OW.makeObservation("sound", { hz: 432, ms: 400 }, "tone-432"), OW.makeObservation("symbol", { text: "owl | 100%\nwise" }, "owl"), OW.makeObservation("number", { seq: [1, 1, 2, 3, 5, 8] }, "fib")];
  const trace = [], lineage = [];
  OW.traceAppend(trace, "system", "genesis", "darkness", at);
  let chain = null;
  for (const o of obs) { chain = await OW.growJourney(chain, o); lineage.push(OW.lineageRow(chain)); OW.traceAppend(trace, "strix", "chain.grown", OW.epochCommitment(chain), at); }
  return { obs, bundle: { chain, lexicon: OW.lexiconOf(obs), lineage, trace } };
}
const verdictOf = async (pack) => { const v = await OW.verifyHyperpack(typeof pack === "string" ? pack : JSON.stringify(pack)); return v.ok ? "accepted" : v.failed; };

/** A random canonical tree: `tops` top-level entries with children down to depth 4 and texts of ASCII or of two-, three-
 *  and four-byte characters. `size` scales the texts; once `budget` bytes are used the remaining texts are empty. */
function randomTree(rnd, tops, size, wide, budget = 50000) {
  const ASCII = "abcdefghij klmnopqrstuvwxyz ABCXYZ 0123456789 ,.;:'()<>=+-*/%|\n", WIDE = ["\u{00e9}", "\u{05d7}", "\u{05b7}", "\u{03c3}", "\u{2212}", "\u{20ac}", "\u{4e2d}", "\u{1f989}", "\u{1d538}", " ", "a", "\n", "|", "%"];
  const chars = (n) => { let s = ""; for (let i = 0; i < n; i++) s += wide ? pickFrom(rnd, WIDE) : ASCII[Math.floor(rnd() * ASCII.length)]; return s; };
  const rows = [];
  let used = 0;
  const add = (address, depth) => {
    const text = chars(Math.floor(rnd() * rnd() * size)), got = used < budget ? tryMake(address, pickFrom(rnd, OW.LAYERS), pickFrom(rnd, ["verse", "term", "note", "plain"]), "n " + address, text) : { ok: false };
    const entry = got.ok ? got.entry : OW.makeEntry(address, "said", "note", "n " + address, "");   // over the budget, or a text NFC would change: left empty
    rows.push(entry); used += utf8Bytes(entry.line) + 1;
    if (depth >= 4) return;
    let index = -1;
    for (let k = Math.floor(rnd() * (depth === 1 ? 5 : 3)); k > 0; k--) { index += 1 + Math.floor(rnd() * 12); add(address + "." + index, depth + 1); }
  };
  let top = -1;
  for (let t = 0; t < tops; t++) { top += 1 + Math.floor(rnd() * 40); add(String(top), 1); }
  return rows;
}

// ─── Phase 1: the lexicon object, the epochs and the chain of a tree ─────────

test("LEXICON/2 object: members in order, the root hashes address, layer, kind, name and line hash under its tag", () => {
  const lex = OW.treeLexiconOf(SMALL);
  assert.deepEqual(Object.keys(lex), ["format", "dims", "entries", "root"]);
  assert.deepEqual([lex.format, lex.dims], ["LEXICON/2", ["2D", "3D"]]);
  assert.equal(lex.entries.length, SMALL.length);
  lex.entries.forEach((e, i) => {
    assert.deepEqual(Object.keys(e), ["address", "layer", "kind", "name", "lineSha"]);
    assert.deepEqual(e, { address: SMALL[i].address, layer: SMALL[i].layer, kind: SMALL[i].kind, name: SMALL[i].name, lineSha: sha256(SMALL[i].line) });
  });
  const hashed = ["LEXICON/2|" + SMALL.length, ...SMALL.map((e) => e.address + "|" + e.layer + "|" + e.kind + "|" + e.name + "|" + sha256(e.line))].join("\n");
  assert.equal(lex.root, sha256(hashed));
  assert.ok(hashed.startsWith("LEXICON/2|14\n0|reading|about|What this lexicon is|"), "the hashed text begins with the format tag");
  assert.equal(OW.treeLexiconRoot(lex.entries), lex.root);
  assert.equal(JSON.stringify(OW.treeLexiconOf(OW.parseLexiconText(OW.lexiconText(SMALL)))), JSON.stringify(lex), "the same from the text read back");
  // the name is the entry's own (NFC, not escaped), whatever it holds
  const odd = [OW.makeEntry("7", "said", "note", "a|b%c", "x"), OW.makeEntry("8", "said", "note", "Poincare\u{0301} ball", "y")];
  assert.deepEqual(OW.treeLexiconOf(odd).entries.map((e) => e.name), ["a|b%c", "Poincar\u{00e9} ball"]);
  // every member of an entry is in the root: change any one and the root changes
  const roots = new Set([lex.root]);
  for (const [member, value] of [["address", "9"], ["layer", "text"], ["kind", "verse"], ["name", "What this lexicon was"], ["lineSha", sha256("x")]]) {
    const other = clone(lex.entries); other[0][member] = value;
    roots.add(OW.treeLexiconRoot(other));
  }
  roots.add(OW.treeLexiconRoot(lex.entries.slice(0, -1)));
  roots.add(OW.treeLexiconRoot([...lex.entries.slice(1), lex.entries[0]]));
  assert.equal(roots.size, 8, "the root commits to every member, to the number of entries and to their order");
  // the same rows under the journey's tag have another root, and the two lexicon objects are different formats
  assert.notEqual(OW.lexiconRoot(lex.entries.map((e) => ({ address: e.address, sense: e.kind, name: e.name, obsSha: e.lineSha }))), lex.root);
  assert.equal(OW.treeLexiconOf(SMALL.slice(0, 1)).entries.length, 1);
  for (const v of [undefined, null, "x", [null], [{ address: "0" }], [["0", "text", "a", "a", ""]]]) refused(() => OW.treeLexiconOf(v), "treeLexiconOf of " + show(v ?? null), /treeLexiconOf needs/);
  for (const v of [undefined, null, "x", [null], [5]]) refused(() => OW.treeLexiconRoot(v), "treeLexiconRoot of " + show(v ?? null), /treeLexiconRoot needs/);
});

test("LEXICON/2 epochs: one text per top-level entry, each the text up to the line before the next top-level entry", () => {
  const texts = OW.treeEpochTexts(SMALL), whole = OW.lexiconText(SMALL);
  assert.equal(texts.length, TOPS.length);
  assert.equal(texts[texts.length - 1], whole, "the last is the whole text");
  texts.forEach((t, i) => {
    const want = SMALL.filter((e) => TOPS.indexOf(e.address.split(".")[0]) <= i).map((e) => e.line + "\n").join("");
    assert.equal(t, want, "epoch " + (i + 1));
    assert.ok(whole.startsWith(t) && t.endsWith("\n"));
    assert.deepEqual(OW.parseLexiconText(t).map((e) => e.address), SMALL.slice(0, want.split("\n").length - 1).map((e) => e.address), "every epoch text is a lexicon text");
  });
  assert.deepEqual(OW.treeEpochTexts(SMALL.slice(0, 2)), [OW.lexiconText(SMALL.slice(0, 2))], "one top-level entry, one epoch");
  assert.deepEqual(OW.PROFILES["LEXICON/2"].epochs(SMALL), texts);
  refused(() => OW.treeEpochTexts([]), "no entries", /at least one entry/);
  for (const v of [undefined, null, "x", [null], [{ line: "x" }], [{ address: "0" }]]) refused(() => OW.treeEpochTexts(v), "treeEpochTexts of " + show(v ?? null), /treeEpochTexts needs/);
});

test("a small tree grows one real shdccp/2 epoch per top-level entry and passes every Overwatch check", async () => {
  const calls = [];
  let running = 0;
  const bundle = await OW.buildLexiconBundle(SMALL, {
    at: AT,
    onEpoch: async (e) => {                                // buildLexiconBundle waits for this before it grows the next epoch
      assert.equal(running, 0, "no epoch is grown while onEpoch is pending");
      running++;
      await new Promise((resolve) => setTimeout(resolve, 25));
      calls.push([e.epoch, e.epochs, e.addedBytes, e.chain.chainId, e.chain.epoch]);
      assert.deepEqual(Object.keys(e), ["epoch", "epochs", "chain", "addedBytes"]);
      running--;
    },
  });
  assert.deepEqual([calls.length, running], [4, 0], "the build has waited for every onEpoch, the last one too");
  assert.deepEqual(Object.keys(bundle), ["chain", "lexicon", "lineage", "trace"]);
  const { chain, lexicon, lineage, trace } = bundle, texts = OW.treeEpochTexts(SMALL);
  // the chain: an ordinary shdccp/2 record of the whole text, without the engram layer
  assert.equal(chain.streamVersion, "shdccp/2");
  assert.equal(chain.epoch, 4);
  assert.equal(BM.verifyIntegrityStrict(chain).ok, true);
  assert.equal(BM.recreateText(chain), OW.lexiconText(SMALL));
  assert.equal(chain.origBytes, utf8Bytes(OW.lexiconText(SMALL)));
  for (const member of ["engramStream", "engramCount", "engramMeanJ"]) assert.ok(!(member in chain), "no " + member);
  assert.deepEqual(Object.getOwnPropertyNames(chain), Object.keys(chain), "a plain record: nothing hidden");
  assert.equal(chain.chainId, (await BM.growBiochain(OW.lexiconText(SMALL), { engrams: false })).chainId, "the chain id is the one the whole text gives");
  assert.equal(chain.chainId, (await BM.growBiochain(OW.lexiconText(SMALL))).chainId, "with or without engrams");
  // onEpoch: once per epoch, in order, with the bytes each added
  assert.deepEqual(calls.map((c) => c.slice(0, 2)), [[1, 4], [2, 4], [3, 4], [4, 4]]);
  assert.deepEqual(calls.map((c) => c[2]), texts.map((t, i) => utf8Bytes(t) - (i ? utf8Bytes(texts[i - 1]) : 0)));
  assert.deepEqual(calls.map((c) => c[4]), [undefined, 2, 3, 4], "a chain of one epoch has no epoch member");
  // lexicon, lineage and ledger
  assert.deepEqual(lexicon, OW.treeLexiconOf(SMALL));
  assert.deepEqual(lineage, calls.map((c, i) => ({ epoch: i + 1, chainId: c[3], merkleRoot: lineage[i].merkleRoot })));
  assert.deepEqual(lineage[3], OW.lineageRow(chain));
  lineage.forEach((row) => assert.deepEqual(Object.keys(row), ["epoch", "chainId", "merkleRoot"]));
  assert.equal(new Set(lineage.map((r) => r.chainId)).size, 4);
  assert.equal(trace.length, 5);
  assert.deepEqual([trace[0].actor, trace[0].event, trace[0].detail, trace[0].at], ["system", "genesis", "LEXICON/2, 14 entries", AT]);
  assert.match(trace[1].detail, /^GROWN\/1\|BC-[0-9a-f]{24}\|/);
  trace.slice(1).forEach((e, i) => {
    assert.deepEqual([e.actor, e.event, e.at], ["strix", "chain.grown", AT]);
    assert.match(e.detail, i === 0 ? /^GROWN\/1\|/ : /^GROWTH\/1\|/);
    assert.ok(e.detail.includes(lineage[i].chainId) && e.detail.includes(lineage[i].merkleRoot));
  });
  assert.equal(trace[4].detail, OW.epochCommitment(chain));
  assert.equal(OW.verifyTrace(trace).ok, true);
  // every check passes, and says what it read
  const r = await OW.overwatchInspect(bundle);
  assert.deepEqual([r.ok, r.failed], [true, null]);
  assert.deepEqual(r.checks.map((c) => c.name), [...OW.OVERWATCH_CHECKS]);
  assert.ok(r.checks.every((c) => c.ok === true));
  const detail = (name, report = r) => report.checks.find((c) => c.name === name).detail;
  assert.deepEqual([detail("meaning"), detail("lexicon"), detail("lineage"), detail("trace")],
    ["14 canonical LEX/1 lines", "14 exact addresses, 2D and 3D", "4 epochs recomputed from the text", "5 linked entries, every epoch recorded"]);
  // for a given `at` the bundle is deterministic; another time changes the ledger only
  assert.deepEqual(await OW.buildLexiconBundle(SMALL, { at: AT }), bundle);
  const later = await OW.buildLexiconBundle(SMALL, { at: "2026-01-02T00:00:00.000Z" });
  assert.deepEqual([later.chain, later.lexicon, later.lineage], [chain, lexicon, lineage]);
  assert.notEqual(later.trace[4].hash, trace[4].hash);
  assert.match((await OW.buildLexiconBundle(SMALL.slice(0, 1))).trace[0].at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/, "without `at`: now, as an ISO time");
  // one top-level entry: one epoch, and a chain without epoch members
  const one = await OW.buildLexiconBundle(SMALL.slice(0, 2), { at: AT });
  assert.deepEqual([one.chain.epoch, one.chain.parentChainId, one.lineage.length, one.trace.length], [undefined, undefined, 1, 2]);
  assert.equal((await OW.overwatchInspect(one)).ok, true);
  assert.equal(detail("lineage", await OW.overwatchInspect(one)), "1 epoch recomputed from the text");
  // the lineage check of a tree, in its own words
  const fails = async (change) => { const b = clone(bundle); change(b); const v = await OW.overwatchInspect(b); return [v.failed, v.checks.find((c) => c.ok === false).detail]; };
  assert.deepEqual(await fails((b) => { b.lineage.pop(); }), ["lineage", "lineage does not list one epoch per top-level entry"]);
  assert.deepEqual(await fails((b) => { b.chain.epoch = 3; }), ["lineage", "the chain's epoch is not its number of top-level entries"]);
  assert.deepEqual(await fails((b) => { b.lineage[1].merkleRoot = b.lineage[0].merkleRoot; }), ["lineage", "epoch 2 recomputed from the text is not the one lineage lists"]);
  assert.deepEqual(await fails((b) => { b.lineage[0].epoch = "1"; }), ["lineage", "epoch 1 recomputed from the text is not the one lineage lists"]);
  assert.deepEqual(await fails((b) => { b.lineage[3].note = "x"; }), ["lineage", "epoch 4 recomputed from the text is not the one lineage lists"]);
  assert.deepEqual(await fails((b) => { b.chain.parentChainId = b.lineage[0].chainId; }), ["lineage", "the chain's parentChainId is not the recomputed one"]);
  assert.deepEqual(await fails((b) => { b.chain.addedBytes += 1; }), ["lineage", "the chain's addedBytes is not the recomputed one"]);
  assert.deepEqual(await fails((b) => { b.trace.splice(1, 1); }), ["trace", "the ledger's hash chain breaks at entry 1"]);
  assert.deepEqual(await fails((b) => { b.lexicon.dims = ["2D"]; }), ["lexicon", "the lexicon is not the one the entries give"]);
  assert.deepEqual(await fails((b) => { b.lexicon.title = "x"; }), ["lexicon", "the lexicon is not the one the entries give"]);
  assert.deepEqual(await fails((b) => { b.lexicon.root = sha256("x"); }), ["lexicon", "the lexicon root is not the one the entries give"]);
  // a ledger that records other chains: every epoch's own commitment must be there (GROWN/1 for the first, GROWTH/1 after)
  for (const at of [1, 2, 4]) {
    const b = clone(bundle), other = [];
    b.trace.forEach((e, i) => OW.traceAppend(other, e.actor, e.event, i === at ? e.detail.replace(/\d+$/, (n) => String(Number(n) + 1)) : e.detail, e.at));
    b.trace = other;
    const v = await OW.overwatchInspect(b);
    assert.deepEqual([v.failed, v.checks.find((c) => c.ok === false).detail], ["trace", "no chain.grown entry for epoch " + at]);
  }
});

test("buildLexiconBundle and growLexicon refuse what is not a canonical lexicon or a sound parent", async () => {
  const swapped = [SMALL[1], SMALL[0], ...SMALL.slice(2)];
  await refusedAsync(() => OW.buildLexiconBundle(swapped, { at: AT }), "entries out of order", /^line 1: the first entry of a lexicon is a top-level entry$/);
  await refusedAsync(() => OW.buildLexiconBundle([...SMALL, SMALL[3]], { at: AT }), "a line out of depth-first order", /^line 15: out of depth-first order/);
  await refusedAsync(() => OW.buildLexiconBundle(Array.from({ length: 17 }, (_, i) => entryAt(String(i))), { at: AT }), "17 top-level entries", /at most 16 top-level entries/);
  await refusedAsync(() => OW.buildLexiconBundle([], { at: AT }), "no entries", /at least one entry/);
  await refusedAsync(() => OW.buildLexiconBundle([{ ...SMALL[0], line: SMALL[0].line.replace("LEX/1|0|", "LEX/1|00|") }], { at: AT }), "an entry whose line is not canonical", /^line 1: an address is/);
  await refusedAsync(() => OW.buildLexiconBundle([{ ...SMALL[0], line: SMALL[0].line + "%7c" }], { at: AT }), "an entry whose line holds an escape that is not canonical", /^line 1: not the canonical line/);
  // the line is what is sealed: an object whose other members disagree with its line is read by its line
  const disguised = await OW.buildLexiconBundle([{ ...SMALL[0], layer: "text", name: "Another name" }, ...SMALL.slice(1)], { at: AT });
  assert.deepEqual(disguised, (await small()).bundle);
  const big = Array.from({ length: 60 }, (_, i) => entryAt(i ? "0." + i : "0", "x".repeat(1100)));
  await refusedAsync(() => OW.buildLexiconBundle(big, { at: AT }), "more than 60,000 bytes", /at most 60000 bytes/);
  for (const v of [undefined, null, "x", SMALL.map((e) => [e.address, e.layer, e.kind, e.name, e.text]), SMALL.map((e) => e.line)])
    await refusedAsync(() => OW.buildLexiconBundle(v, { at: AT }), "buildLexiconBundle of " + typeof v, /lexiconText needs/);
  await refusedAsync(() => OW.buildLexiconBundle(SMALL, { at: 5 }), "a time that is not a string", /at is a time/);
  await refusedAsync(() => OW.buildLexiconBundle(SMALL, { at: AT, onEpoch: "x" }), "onEpoch that is not a function", /onEpoch is a function/);
  await assert.rejects(OW.buildLexiconBundle(SMALL, { at: AT, onEpoch: () => { throw new Error("stop"); } }), /stop/, "an error in onEpoch stops the build");

  const texts = OW.treeEpochTexts(SMALL);
  const first = await OW.growLexicon(null, texts[0]);
  assert.deepEqual([first.epoch, first.origBytes, "engramStream" in first], [undefined, utf8Bytes(texts[0]), false]);
  const second = await OW.growLexicon(first, texts[1].slice(texts[0].length));
  assert.deepEqual([second.epoch, second.parentChainId, second.parentMerkleRoot, second.addedBytes], [2, first.chainId, first.merkleRoot, utf8Bytes(texts[1]) - utf8Bytes(texts[0])]);
  assert.deepEqual(Object.getOwnPropertyNames(second), Object.keys(second), "a plain record");
  assert.equal(BM.recreateText(second), texts[1]);
  for (const v of [undefined, null, "", 5, ["x"]]) await refusedAsync(() => OW.growLexicon(null, v), "growLexicon adding " + show(v ?? null), /growLexicon needs/);
  const forged = clone(first); forged.merkleRoot = sha256("x");
  await assert.rejects(OW.growLexicon(forged, "LEX/1|9|text|a|a|\n"), /strict check/, "a parent that fails the strict check is not extended");
});

// ─── Phase 1: profiles ───────────────────────────────────────────────────────

test("profiles: the lexicon's format picks how the text is read; anything unknown is read as a journey and fails", async () => {
  const JOURNEY = OW.PROFILES["LEXICON/1"], TREE = OW.PROFILES["LEXICON/2"];
  assert.deepEqual(Object.keys(OW.PROFILES), ["LEXICON/1", "LEXICON/2"]);
  assert.ok(Object.isFrozen(OW.PROFILES) && Object.isFrozen(JOURNEY) && Object.isFrozen(TREE));
  for (const [format, p] of Object.entries(OW.PROFILES)) {
    assert.equal(p.format, format);
    assert.equal(typeof p.unit, "string");
    for (const f of ["parse", "lexicon", "epochs", "lineage"]) assert.equal(typeof p[f], "function", format + "." + f);
  }
  assert.deepEqual([JOURNEY.unit, TREE.unit], ["observation", "top-level entry"]);
  assert.deepEqual([JOURNEY.parse, JOURNEY.lexicon, TREE.parse, TREE.lexicon, TREE.epochs], [OW.parseJourney, OW.lexiconOf, OW.parseLexiconText, OW.treeLexiconOf, OW.treeEpochTexts]);
  // profileOf: PROFILES[format] only for a string that is an own member of PROFILES
  assert.equal(OW.profileOf({ format: "LEXICON/2" }), TREE);
  assert.equal(OW.profileOf({ format: "LEXICON/1" }), JOURNEY);
  assert.equal(OW.profileOf(OW.treeLexiconOf(SMALL)), TREE);
  const UNKNOWN = ["LEXICON/9", "constructor", "__proto__", "toString", "hasOwnProperty", "valueOf", "", "LEXICON/2 ", "lexicon/2", "LEXICON/02", null, 2, 0, true, ["LEXICON/2"], { toString: () => "LEXICON/2" }, new String("LEXICON/2")];
  for (const format of UNKNOWN) assert.equal(OW.profileOf({ format }), JOURNEY, "format " + show(format ?? null));
  for (const lexicon of [undefined, null, {}, [], "LEXICON/2", 2, { Format: "LEXICON/2" }, ["LEXICON/2"]]) assert.equal(OW.profileOf(lexicon), JOURNEY, "lexicon " + show(lexicon ?? null));

  // on a sealed tree package: every format but its own fails, at meaning (the text is no journey)
  const { pack, certificate } = await small();
  assert.equal(await verdictOf(pack), "accepted");
  for (const format of ["LEXICON/1", "LEXICON/9", "constructor", "__proto__", "toString", "", null, 2, ["LEXICON/2"]]) {
    const p = clone(pack); p.lexicon.format = format;
    const v = await OW.verifyHyperpack(JSON.stringify(p));
    assert.deepEqual([v.ok, v.failed], [false, "meaning"], "format " + show(format));
    assert.match(v.checks.find((c) => c.name === "meaning").detail, /^line 1: not an OBS\/1 line$/);
  }
  { const p = clone(pack); delete p.lexicon.format; assert.equal(await verdictOf(p), "meaning", "a missing format member"); }
  { const p = clone(pack); p.lexicon = null; assert.equal(await verdictOf(p), "meaning", "no lexicon"); }
  { const p = clone(pack); delete p.lexicon; assert.equal(await verdictOf(p), "meaning", "a missing lexicon member"); }
  { const p = clone(pack); p.lexicon = "LEXICON/2"; assert.equal(await verdictOf(p), "meaning", "a lexicon that is a string"); }

  // a journey still passes, in the words it always had
  const { obs, bundle: jb } = await journeyBundle();
  const jr = await OW.overwatchInspect(jb);
  assert.equal(jr.ok, true);
  assert.deepEqual(jr.checks.slice(6).map((c) => c.detail), ["3 canonical OBS/1 lines", "3 exact addresses, 2D and 3D", "3 epochs regrown from the text", "4 linked entries, every epoch recorded"]);
  const jfail = async (change) => { const b = clone(jb); change(b); const v = await OW.overwatchInspect(b); return [v.failed, v.checks.find((c) => c.ok === false).detail]; };
  assert.deepEqual(await jfail((b) => { b.lineage.pop(); }), ["lineage", "lineage does not list one epoch per observation"]);
  assert.deepEqual(await jfail((b) => { b.chain.epoch = 2; }), ["lineage", "the chain's epoch is not its number of observations"]);
  assert.deepEqual(await jfail((b) => { b.lineage[1].chainId = b.lineage[0].chainId; }), ["lineage", "epoch 2 regrown from the text is not the one lineage lists"]);
  assert.deepEqual(await jfail((b) => { b.chain.addedBytes += 1; }), ["lineage", "the chain's addedBytes is not the regrown one"]);
  assert.deepEqual(await jfail((b) => { b.lexicon.root = sha256("x"); }), ["lexicon", "the lexicon root is not the one the observations give"]);
  assert.deepEqual(await jfail((b) => { b.lexicon.entries[0].name = "forged"; }), ["lexicon", "the lexicon is not the one the observations give"]);
  assert.deepEqual(await jfail((b) => { b.lexicon = null; }), ["lexicon", "no lexicon"]);
  assert.ok("engramStream" in jb.chain, "a journey chain keeps its engram layer");
  const keys = await OW.newSessionKeys();
  const jcert = (await OW.issueCertificate(jb, keys, AT)).certificate, jpack = OW.makeHyperpack({ ...jb, certificate: jcert });
  assert.equal(await verdictOf(jpack), "accepted");

  // a tree text presented as a journey and a journey presented as a tree fail at meaning
  { const p = clone(pack); p.lexicon.format = "LEXICON/1"; assert.equal(await verdictOf(p), "meaning", "tree text, journey format"); }
  { const p = clone(pack); p.lexicon = clone(jpack.lexicon); assert.equal(await verdictOf(p), "meaning", "tree chain with the journey's lexicon"); }
  { const p = clone(jpack); p.lexicon.format = "LEXICON/2"; const v = await OW.verifyHyperpack(p); assert.equal(v.failed, "meaning", "journey text, tree format");
    assert.match(v.checks.find((c) => c.name === "meaning").detail, /^line 1: not a LEX\/1 line/); }
  { const p = clone(jpack); p.lexicon = clone(pack.lexicon); assert.equal(await verdictOf(p), "meaning", "journey chain with the tree's lexicon"); }
  // a certificate does not move between packages
  { const p = clone(pack); p.certificate = clone(jcert); assert.equal(await verdictOf(p), "trace", "the journey's certificate on the tree package (its head is not in this ledger)"); }
  { const p = clone(jpack); p.certificate = clone(certificate); assert.equal(await verdictOf(p), "trace"); }
  { const p = clone(pack); p.certificate = { ...clone(jcert), traceHead: certificate.traceHead }; assert.equal(await verdictOf(p), "commitment"); }
  // no line reads both ways
  for (const e of SMALL) assert.throws(() => OW.parseObservation(e.line));
  for (const o of obs) assert.throws(() => OW.parseEntry(o.line));
});

// ─── Phase 1: lineage without regrowing ──────────────────────────────────────

/** The rows a lineage lists, by regrowing every epoch text (as the journey profile does). */
async function regrownRows(texts) {
  const rows = [];
  for (let i = 0; i < texts.length; i++) {
    const grown = await BM.growBiochain(texts[i], { engrams: false });
    rows.push(OW.lineageRow(i === 0 ? grown : { ...grown, epoch: i + 1 }));
  }
  return rows;
}

test("treeLineage equals regrowing every epoch on 30 random lexicons (ASCII and multi-byte, 1 to 16 epochs)", async () => {
  const rnd = seeded(26001);
  const epochCounts = new Set();
  let multiChunk = 0, bytesSeen = 0, largest = 0;
  for (let t = 0; t < 30; t++) {
    const tops = t < 16 ? t + 1 : 1 + Math.floor(rnd() * 16), wide = t % 2 === 1, grownToo = t % 5 === 0, large = t === 13 || t === 14;
    const entries = randomTree(rnd, tops, large ? 1200 : 400, wide, large ? 56000 : grownToo ? 5000 : 9000), texts = OW.treeEpochTexts(entries);
    assert.equal(texts.length, tops);
    epochCounts.add(tops);
    const bytes = utf8Bytes(texts[texts.length - 1]);
    assert.ok(bytes <= 60000, "the generator stays within the limit");
    bytesSeen += bytes; if (bytes > 1440) multiChunk++; largest = Math.max(largest, bytes);
    const fast = OW.treeLineage(texts);
    fast.forEach((row, i) => assert.deepEqual(Object.keys(row), ["epoch", "chainId", "merkleRoot"], "member order of row " + i));
    assert.deepEqual(fast, await regrownRows(texts), `lexicon ${t}: ${tops} epochs, ${bytes} bytes${wide ? ", multi-byte" : ""}`);
    assert.deepEqual(OW.lexiconPackets(texts[texts.length - 1]).length, Math.ceil(bytes / 720));
    if (grownToo) {                                          // and the chain really grown epoch by epoch lists the same rows and passes
      const bundle = await OW.buildLexiconBundle(entries, { at: AT });
      assert.deepEqual(bundle.lineage, fast, `lexicon ${t}: the rows of the chain as it grew`);
      assert.deepEqual(OW.chainPackets(bundle.chain), OW.lexiconPackets(texts[texts.length - 1]));
      const r = await OW.overwatchInspect(bundle);           // the trace check compares every epoch's commitment with the grown ones
      assert.deepEqual([r.ok, r.failed], [true, null], `lexicon ${t} passes`);
    }
  }
  assert.equal(epochCounts.size, 16, "every number of epochs from 1 to 16");
  assert.ok(multiChunk >= 20 && bytesSeen > 150000, `texts of several chunks are sampled (${multiChunk} of 30, ${bytesSeen} bytes)`);
  assert.ok(largest > 40000, `and one of more than 40,000 bytes (${largest})`);
  if (process.env.OWL_TEST_VERBOSE) console.log(`treeLineage: ${multiChunk} of 30 texts over two chunks, ${bytesSeen} bytes in all, the largest ${largest}`);
});

test("treeLineage: epochs that end exactly on a 720-byte chunk, and what it refuses", async () => {
  // entries padded so that the epochs end at 720 (one whole chunk), 2,160 (three), 2,190, 2,880 (four) and 4,320 bytes (six)
  const padded = (address, bytes) => { const bare = utf8Bytes(entryAt(address, "").line) + 1; return entryAt(address, "x".repeat(bytes - bare)); };
  const entries = [padded("1", 720), padded("2", 720), padded("2.5", 720), padded("3", 30), padded("4", 690), padded("5", 720), padded("5.1", 720)];
  const texts = OW.treeEpochTexts(entries);
  assert.deepEqual(texts.map(utf8Bytes), [720, 2160, 2190, 2880, 4320], "the sizes the test means to hit");
  assert.deepEqual(OW.treeLineage(texts), await regrownRows(texts));
  const whole720 = [padded("1", 690), padded("2", 30), padded("3", 720)], t720 = OW.treeEpochTexts(whole720);
  assert.deepEqual(t720.map(utf8Bytes), [690, 720, 1440]);
  assert.deepEqual(OW.treeLineage(t720), await regrownRows(t720));
  const bundle = await OW.buildLexiconBundle(entries, { at: AT });
  assert.deepEqual(bundle.lineage, OW.treeLineage(texts));
  assert.equal((await OW.overwatchInspect(bundle)).ok, true);
  // one text is one epoch; a text in pieces that are no entries is still hashed as text (the rows are about bytes)
  assert.deepEqual(OW.treeLineage(["abc"]), await regrownRows(["abc"]));
  assert.deepEqual(OW.treeLineage(["a", "ab", "abc\u{1f989}"]), await regrownRows(["a", "ab", "abc\u{1f989}"]));

  const NEEDS = /^a lineage needs the text of every epoch/;
  for (const v of [undefined, null, "abc", [], [5], [null], ["a", 5], [""], ["a", ""], ["a\u{d800}"], ["a\u{d83e}", "a\u{1f989}"]]) refused(() => OW.treeLineage(v), "treeLineage of " + show(v ?? null), NEEDS);
  refused(() => OW.treeLineage(["ab", "ac"]), "a text that is no beginning of the last", /a beginning of the last one/);
  refused(() => OW.treeLineage(["abc", "ab"]), "a longer text first", /a beginning of the last one/);
  refused(() => OW.treeLineage(["ab", "ab"]), "an epoch that adds nothing", /adds text/);
  refused(() => OW.treeLineage(["a", "a" + "x".repeat(60000)]), "more than 60,000 bytes", /at most 60000 bytes/);
  assert.equal(OW.treeLineage(["x".repeat(60000)]).length, 1, "exactly 60,000 bytes is the most a chain holds");
});

// ─── Phase 1: certificate, HYPERPACK/1 from the wire, HANDSHAKE/1 ────────────

test("a tree lexicon is certified, packaged and answered with the formats a journey uses", async () => {
  const { bundle, keys, certificate, report, pack, wire } = await small();
  assert.equal(report.ok, true);
  // the OVERWATCH/1 line: unchanged in form; the lexicon root (which hashes the format tag) is in it
  assert.equal(certificate.commitment, ["OVERWATCH/1", bundle.chain.chainId, bundle.chain.merkleRoot, "4", bundle.lexicon.root, "2D+3D", bundle.trace[4].hash, "strict+meaning+lexicon+lineage+trace"].join("|"));
  assert.deepEqual(Object.keys(certificate), ["format", "commitment", "traceHead", "issuedAt", "sealId", "publicJwk", "sig"]);
  assert.equal(certificate.sealId, await SC.sealIdFromPublic(keys.publicJwk));
  assert.equal(await SC.verifyPayload(keys.publicJwk, certificate.commitment, certificate.sig), true);
  const cv = await OW.verifyCertificate(certificate, bundle);
  assert.deepEqual([cv.ok, cv.failed], [true, null]);
  // nothing is issued for a bundle that fails
  const bad = clone(bundle); bad.lexicon.entries[0].layer = "text";
  const no = await OW.issueCertificate(bad, keys, AT);
  assert.deepEqual([no.certificate, no.report.failed], [null, "lexicon"]);

  // HYPERPACK/1: the wire is JSON.stringify(makeHyperpack(...)), its members in this order
  assert.deepEqual(Object.keys(pack), ["format", "route", "chain", "lexicon", "lineage", "trace", "certificate"]);
  assert.deepEqual([pack.format, pack.route], ["HYPERPACK/1", { from: "origin", to: "receiver" }]);
  assert.equal(JSON.stringify(JSON.parse(wire)), wire);
  assert.ok(wire.isWellFormed() && !/[\n\r]/.test(wire) && !wire.includes(": ") && !wire.includes(", \""), "one line, no indentation");
  const v = await OW.verifyHyperpack(wire);
  assert.deepEqual([v.ok, v.failed], [true, null]);
  assert.deepEqual(v.checks.map((c) => c.name), [...OW.PACKAGE_CHECKS]);
  assert.ok(v.checks.every((c) => c.ok === true));
  const read = await OW.readHyperpack(wire);
  assert.deepEqual(Object.keys(read), ["ok", "failed", "checks", "pack"]);
  assert.deepEqual([read.ok, read.failed, read.checks], [true, null, v.checks]);
  assert.deepEqual(read.pack, pack);
  // the entries come back from the package's own chain
  assert.deepEqual(OW.entriesOfPack(read.pack), SMALL);
  assert.ok(OW.entriesOfPack(read.pack).every((e) => Object.isFrozen(e)));
  for (const x of [undefined, null, "x", [], {}, { chain: "x" }]) refused(() => OW.entriesOfPack(x), "entriesOfPack of " + show(x ?? null), /entriesOfPack needs/);

  // the wire has no member named d (the private half of a key), anywhere
  assert.equal(typeof keys.privateJwk.d, "string");
  assert.ok(!wire.includes(keys.privateJwk.d), "the private number is not in the wire");
  const names = new Set();
  JSON.parse(wire, (k, value) => { names.add(k); return value; });
  assert.ok(names.has("x") && names.has("y") && names.has("sig"), "the walk sees every member name");
  assert.ok(!names.has("d"), "no member is named d");
  assert.ok(!wire.includes('"d":'));

  // HANDSHAKE/1: a receiver with its own key reads the wire, repeats every check and signs what it decided
  const theirs = await OW.newSessionKeys();
  const { verdict, answer } = await OW.answerHyperpack(wire, theirs, AT);
  assert.equal(verdict.ok, true);
  assert.equal(answer.line, ["HANDSHAKE/1", sha256(wire), bundle.chain.chainId, "accepted", "-"].join("|"));
  const done = await OW.verifyAnswer(answer, wire);
  assert.deepEqual([done.ok, done.failed, done.checks.map((c) => c.ok)], [true, null, [true, true, true]]);
  // the echo binds the whole wire: one label changed, or the format tag, and the answer is for another text
  assert.equal((await OW.verifyAnswer(answer, wire.replace('"layer":"reading"', '"layer":"text"'))).failed, "echo");
  assert.equal((await OW.verifyAnswer(answer, wire.replace("LEXICON/2", "LEXICON/1"))).failed, "echo");
  // a receiver given a relabelled wire refuses it at lexicon, and says so under its signature
  const relabelled = wire.replace('"layer":"reading"', '"layer":"text"');
  assert.notEqual(relabelled, wire);
  const far = await OW.answerHyperpack(relabelled, theirs, AT);
  assert.equal(far.answer.line, ["HANDSHAKE/1", sha256(relabelled), bundle.chain.chainId, "refused", "lexicon"].join("|"));
  assert.equal((await OW.verifyAnswer(far.answer, relabelled)).failed, "refused");
  assert.equal((await OW.verifyAnswer(far.answer, wire)).failed, "echo");
});

// ─── Phase 1: relabelling ────────────────────────────────────────────────────

test("relabelling a READING as TEXT: refused at lexicon, trace, commitment and signature; accepted only as a new package under a new key", async () => {
  const { bundle, certificate, pack } = await small();
  const second = await OW.newSessionKeys();
  for (const address of ["0", "26.1", "100.1"]) {          // in the first epoch, in the middle, in the last
    const at = SMALL.findIndex((e) => e.address === address);
    assert.equal(SMALL[at].layer, "reading");
    const relabelled = SMALL.map((e, i) => (i === at ? OW.makeEntry(e.address, "text", e.kind, e.name, e.text) : e));
    // 1. the lexicon object only (with or without the root those entries give)
    { const p = clone(pack); p.lexicon.entries[at].layer = "text"; assert.equal(await verdictOf(p), "lexicon", address + ": the object only"); }
    { const p = clone(pack); p.lexicon.entries[at].layer = "text"; p.lexicon.root = OW.treeLexiconRoot(p.lexicon.entries); assert.equal(await verdictOf(p), "lexicon", address + ": the object and its root"); }
    // 2. the text, the chain, the lexicon and the lineage rebuilt; the ledger and the certificate untouched
    const fb = await OW.buildLexiconBundle(relabelled, { at: AT });
    assert.notEqual(fb.chain.chainId, bundle.chain.chainId);
    assert.notEqual(fb.lexicon.root, bundle.lexicon.root);
    assert.equal((await OW.overwatchInspect(fb)).ok, true, "the rebuilt bundle is sound in itself");
    const changedFrom = fb.lineage.findIndex((r, i) => r.chainId !== bundle.lineage[i].chainId) + 1;
    assert.equal(changedFrom, TOPS.indexOf(address.split(".")[0]) + 1, "every epoch from the relabelled entry's on is another chain");
    { const p = OW.makeHyperpack({ ...fb, trace: bundle.trace, certificate });
      const v = await OW.verifyHyperpack(p);
      assert.deepEqual([v.failed, v.checks.find((c) => c.ok === false).detail], ["trace", "no chain.grown entry for epoch " + changedFrom], address + ": the old ledger does not record these epochs"); }
    // 3. the ledger rebuilt too, and the certificate pointed at its head
    const head = fb.trace[fb.trace.length - 1].hash;
    assert.notEqual(head, certificate.traceHead);
    { const p = OW.makeHyperpack({ ...fb, certificate: { ...certificate, traceHead: head } }); assert.equal(await verdictOf(p), "commitment", address + ": the signed line is another line"); }
    { const p = OW.makeHyperpack({ ...fb, certificate }); assert.equal(await verdictOf(p), "trace", address + ": the certified head is not in the new ledger"); }
    // 4. the commitment rewritten as well: the signature is for the old line
    const line = OW.overwatchCommitment({ chain: fb.chain, lexicon: fb.lexicon, traceHead: head });
    { const p = OW.makeHyperpack({ ...fb, certificate: { ...certificate, traceHead: head, commitment: line } }); assert.equal(await verdictOf(p), "signature", address + ": the old signature under the new line"); }
    // 5. everything rebuilt and sealed with a second key: a different package under a different seal id, and it passes
    const resealed = (await OW.issueCertificate(fb, second, AT)).certificate;
    const p = OW.makeHyperpack({ ...fb, certificate: resealed });
    assert.equal(await verdictOf(p), "accepted", address + ": sealed again");
    assert.notEqual(resealed.sealId, certificate.sealId);
    assert.notEqual(resealed.commitment, certificate.commitment);
    assert.equal(OW.entriesOfPack(p)[at].layer, "text", "the label the new package certifies is the changed one");
  }
});

// ─── Phase 1: tampers in one table ───────────────────────────────────────────

const TAMPERS_EXPECTED = { word: "crystal", drop: "lexicon", add: "lexicon", move: "lexicon", relabel: "lexicon", ledger: "trace", signature: "signature", reseal: "accepted" };

test("LEXICON_TAMPERS: every row changes a copy of the package as it says and meets the verdict it declares", async () => {
  const T = OW.LEXICON_TAMPERS;
  assert.ok(Object.isFrozen(T) && T.every((row) => Object.isFrozen(row)));
  assert.deepEqual(T.map((row) => row.key), Object.keys(TAMPERS_EXPECTED));
  assert.deepEqual(Object.fromEntries(T.map((row) => [row.key, row.expected])), TAMPERS_EXPECTED);
  for (const row of T) {
    assert.deepEqual(Object.keys(row), ["key", "label", "expected", "apply"]);
    assert.match(row.label, /^[A-Z][A-Za-z ]{5,70}$/);
    assert.ok(row.expected === "accepted" || OW.PACKAGE_CHECKS.includes(row.expected));
    assert.equal(typeof row.apply, "function");
  }
  assert.equal(T[T.length - 1].label, "Relabel a READING as TEXT and seal it again with a new key");
  const byKey = Object.fromEntries(T.map((row) => [row.key, row]));

  // lexicons to try: the small tree; one of several chunks; one whose first names hold no ASCII letter; one with none at all
  const rnd = seeded(8), several = randomTree(rnd, 5, 900, false);
  assert.ok(utf8Bytes(OW.lexiconText(several)) > 3 * 720);
  several[0] = OW.makeEntry(several[0].address, "reading", "about", "n", "the page's own reading");
  const symbols = [OW.makeEntry("1", "said", "note", "%", "100% |"), OW.makeEntry("1.1", "reading", "note", "\u{05d7}\u{05b7}", "%7C stays"), OW.makeEntry("2", "text", "verse", "\u{1f989}", "")];
  const letterless = [OW.makeEntry("1", "reading", "note", "%", "| 100% \u{05d7}\u{05b7}\n"), OW.makeEntry("2", "text", "verse", "\u{1f989}", "")];
  for (const [what, entries] of [["the small tree", SMALL], ["a tree of several chunks", several], ["names without ASCII letters", symbols], ["no ASCII letter at all", letterless]]) {
    const s = entries === SMALL ? await small() : await sealed(entries, AT, { from: "origin", to: entries[1].address });   // a route of its own
    const tools = { newKeys: await OW.newSessionKeys(), at: "2026-02-02T00:00:00.000Z" };
    for (const row of T) {
      const given = JSON.parse(s.wire), changed = await row.apply(given, tools), label = `${what}, ${row.key}`;
      assert.deepEqual(given, s.pack, label + ": the package given is left as it was");
      assert.notEqual(JSON.stringify(changed), s.wire, label + ": something changed");
      assert.deepEqual(Object.keys(changed), Object.keys(s.pack), label + ": still a package");
      const v = await OW.readHyperpack(JSON.stringify(changed));
      assert.equal(v.ok ? "accepted" : v.failed, row.expected, label);
      assert.equal(await verdictOf(changed), row.expected, label + ": the same from verifyHyperpack");
      if (!v.ok) {
        const at = v.checks.findIndex((c) => c.name === row.expected);
        assert.ok(v.checks.slice(0, at).every((c) => c.ok === true) && v.checks.slice(at + 1).every((c) => c.ok === null), label + ": the checks stop there");
        assert.equal(v.pack, null, label + ": a refused package is not handed on");
      }
    }
    // what each row changed, and nothing else
    const apply = (key) => byKey[key].apply(JSON.parse(s.wire), tools);
    const but = (p, ...members) => { const q = clone(p), o = clone(s.pack); for (const m of members) { const path = m.split("."); let a = q, b = o; for (const k of path.slice(0, -1)) { a = a[k]; b = b[k]; } delete a[path[path.length - 1]]; delete b[path[path.length - 1]]; } return [q, o]; };
    const same = (p, ...members) => { const [q, o] = but(p, ...members); assert.deepEqual(q, o, `${what}: only ${members.join(", ")} changed`); };

    const word = await apply("word"); same(word, "chain.stream");
    const before = [...new TextEncoder().encode(BM.recreateText(s.pack.chain))], after = BM.recreateChunks(word.chain).flat();
    const differs = before.map((b, i) => (b === after[i] ? -1 : i)).filter((i) => i >= 0);
    assert.deepEqual([after.length, differs.length], [before.length, 1], what + ": one byte of the text changed");
    if (entries !== letterless) {
      const text = BM.recreateText(s.pack.chain), was = String.fromCharCode(before[differs[0]]), now = String.fromCharCode(after[differs[0]]);
      assert.match(was + now, /^(?:[a-yA-Y][b-zB-Z]|za|ZA)$/, what + ": a letter became the next letter");
      assert.equal(now.charCodeAt(0), /[zZ]/.test(was) ? was.charCodeAt(0) - 25 : was.charCodeAt(0) + 1);
      const line = text.slice(0, differs[0]).split("\n").pop();
      assert.ok(line.split("|").length >= 5, what + ": the letter is in a name or a text");
      assert.ok(!/%[0-9A-F]?$/.test(line), what + ": and is no digit of an escape");
      const lineOfFirstLetter = text.split("\n").findIndex((l) => /[A-Za-z]/.test(l.split("|").slice(4).join("|").replace(/%[0-9A-F]{2}/g, "")));
      assert.equal(text.slice(0, differs[0]).split("\n").length - 1, lineOfFirstLetter, what + ": in the first line that has one");
    } else assert.deepEqual([differs[0], after[0]], [0, before[0] + 1], what + ": without such a letter, the first byte");
    assert.deepEqual(BM.verifyIntegrityStrict(word.chain).failed, "crystal");

    const n = s.pack.lexicon.entries.length;
    const drop = await apply("drop"); same(drop, "lexicon.entries", "lexicon.root");
    assert.deepEqual(drop.lexicon.entries, s.pack.lexicon.entries.slice(0, -1));
    const add = await apply("add"); same(add, "lexicon.entries", "lexicon.root");
    assert.deepEqual(add.lexicon.entries.slice(0, -1), s.pack.lexicon.entries);
    const extra = add.lexicon.entries[n];
    assert.deepEqual(Object.keys(extra), ["address", "layer", "kind", "name", "lineSha"]);
    assert.ok(!s.pack.lexicon.entries.some((e) => e.address === extra.address), what + ": the added entry has an address of its own");
    assert.equal(extra.lineSha, sha256(OW.makeEntry(extra.address, extra.layer, extra.kind, extra.name, "This entry was added after sealing.").line));
    assert.doesNotThrow(() => OW.parseLexiconText(OW.lexiconText([...entries, OW.makeEntry(extra.address, extra.layer, extra.kind, extra.name, "")])), what + ": and it would be a canonical next entry");
    const move = await apply("move"); same(move, "lexicon.entries", "lexicon.root");
    assert.deepEqual(move.lexicon.entries.map((e) => e.address), [s.pack.lexicon.entries[1].address, s.pack.lexicon.entries[0].address, ...s.pack.lexicon.entries.slice(2).map((e) => e.address)]);
    assert.deepEqual(move.lexicon.entries.map((e) => e.lineSha), s.pack.lexicon.entries.map((e) => e.lineSha));
    const relabel = await apply("relabel"); same(relabel, "lexicon.entries", "lexicon.root");
    const first = entries.findIndex((e) => e.layer === "reading");
    assert.deepEqual(relabel.lexicon.entries, s.pack.lexicon.entries.map((e, i) => (i === first ? { ...e, layer: "text" } : e)), what + ": the first reading entry, and only its label");
    for (const p of [drop, add, move, relabel]) assert.equal(p.lexicon.root, OW.treeLexiconRoot(p.lexicon.entries), what + ": with the root those entries give");
    const ledger = await apply("ledger"); same(ledger, "trace");
    assert.deepEqual(ledger.trace, [s.pack.trace[0], ...s.pack.trace.slice(2)], what + ": the first chain.grown entry is gone");
    const signature = await apply("signature"); same(signature, "certificate.sig");
    assert.match(signature.certificate.sig, /^[0-9a-f]{128}$/);
    assert.equal(signature.certificate.sig.slice(0, -1), s.pack.certificate.sig.slice(0, -1));
    const reseal = await apply("reseal");
    assert.deepEqual(OW.entriesOfPack(reseal), entries.map((e, i) => (i === first ? OW.makeEntry(e.address, "text", e.kind, e.name, e.text) : e)), what + ": the same relabelling, in the text");
    assert.deepEqual([reseal.certificate.sealId, reseal.certificate.issuedAt, reseal.trace[0].at], [await SC.sealIdFromPublic(tools.newKeys.publicJwk), tools.at, tools.at]);
    assert.notEqual(reseal.certificate.sealId, s.certificate.sealId);
    assert.notEqual(reseal.chain.chainId, s.pack.chain.chainId);
    assert.deepEqual(reseal.route, s.pack.route, what + ": on the same route");
    assert.deepEqual(reseal.route, entries === SMALL ? { from: "origin", to: "receiver" } : { from: "origin", to: entries[1].address });
  }

  // the ledger row is refused also when entries were appended after the certified head
  const s = await small(), grown = clone(s.pack);
  OW.traceAppend(grown.trace, "overwatch", "certificate.issued", s.certificate.commitment, AT);
  assert.equal(await verdictOf(grown), "accepted");
  assert.equal(await verdictOf(await byKey.ledger.apply(grown)), "trace");
  // newKeys may be a function that gives a key pair
  const viaFunction = await byKey.reseal.apply(s.pack, { newKeys: OW.newSessionKeys, at: AT });
  assert.equal(await verdictOf(viaFunction), "accepted");
  // what a row cannot be applied to is refused in a fixed sentence
  for (const row of T) for (const x of [undefined, null, "x", [], {}, { lexicon: {} }, s.wire])
    await refusedAsync(async () => row.apply(x, { newKeys: s.keys, at: AT }), `${row.key} on ${show(typeof x === "string" ? "a string" : x ?? null)}`, /a tamper is applied to a parsed HYPERPACK\/1 package/);
  for (const tools of [undefined, null, {}, { at: AT }, { newKeys: s.keys }, { newKeys: {}, at: AT }, { newKeys: s.keys, at: 5 }, { newKeys: () => null, at: AT }])
    await refusedAsync(async () => byKey.reseal.apply(s.pack, tools), "reseal with tools " + show(tools === undefined ? "undefined" : tools && typeof tools.newKeys === "function" ? "a function giving null" : tools && tools.newKeys === s.keys ? "keys only" : tools), /the reseal tamper needs tools\.newKeys/);
  const { bundle: jb } = await journeyBundle(), jcert = (await OW.issueCertificate(jb, s.keys, AT)).certificate, jpack = OW.makeHyperpack({ ...jb, certificate: jcert });
  await refusedAsync(async () => byKey.reseal.apply(jpack, { newKeys: s.keys, at: AT }), "reseal on a journey", /needs the package of a tree lexicon/);
  await refusedAsync(async () => byKey.relabel.apply(jpack), "relabel on a journey", /no reading entry/);
  const noReading = await sealed([OW.makeEntry("1", "text", "verse", "n", "t"), OW.makeEntry("2", "said", "note", "n", "t")]);
  await refusedAsync(async () => byKey.relabel.apply(noReading.pack), "relabel without a reading entry", /no reading entry/);
  await refusedAsync(async () => byKey.reseal.apply(noReading.pack, { newKeys: s.keys, at: AT }), "reseal without a reading entry", /no reading entry/);
  const single = await sealed([OW.makeEntry("1", "reading", "note", "n", "t")]);
  await refusedAsync(async () => byKey.move.apply(single.pack), "move with one entry", /needs a lexicon with 2 entries/);
  for (const key of ["word", "drop", "add", "relabel", "ledger", "signature", "reseal"]) assert.equal(await verdictOf(await byKey[key].apply(single.pack, { newKeys: s.keys, at: AT })), TAMPERS_EXPECTED[key], "one entry, " + key);
});

// ─── Phase 1: the front door for outside text ────────────────────────────────

/** readHyperpack on a hostile input: it never rejects, answers within two seconds, and its verdict has the one shape. */
async function door(input, what) {
  const t0 = performance.now();
  let v;
  try { v = await OW.readHyperpack(input); } catch (e) { assert.fail(`${what}: readHyperpack rejected with ${e && e.constructor && e.constructor.name}`); }
  const ms = performance.now() - t0;
  assert.ok(ms < 2000, `${what}: a verdict in under 2 s (took ${Math.round(ms)} ms)`);
  assert.deepEqual(Object.keys(v), ["ok", "failed", "checks", "pack"], what);
  assert.deepEqual(v.checks.map((c) => c.name), [...OW.PACKAGE_CHECKS], what);
  assert.equal(v.ok, v.failed === null, what);
  if (!v.ok) assert.equal(v.pack, null, what + ": a refused package is not handed on");
  return v;
}
/** The same, for a text the door itself must refuse: failed "parse", a fixed plain sentence, no other check run. */
async function shut(input, what, pattern) {
  const v = await door(input, what);
  assert.deepEqual([v.ok, v.failed], [false, "parse"], what);
  assert.deepEqual(v.checks.map((c) => c.ok), [false, ...OW.PACKAGE_CHECKS.slice(1).map(() => null)], what + ": no check was run");
  assert.match(v.checks[0].detail, /^[ -~]{1,160}$/, what + ": a plain sentence");
  if (pattern) assert.match(v.checks[0].detail, pattern, what);
  return v.checks[0].detail;
}
const nest = (depth, open = "[", close = "]") => open.repeat(depth) + close.repeat(depth);

test("readHyperpack: what a package may hold is listed from real output, and a good wire passes", async () => {
  const { pack, wire, bundle } = await small();
  assert.equal(OW.MAX_PACK_CHARS, 1500000);
  const v = await door(wire, "the good wire");
  assert.deepEqual([v.ok, v.failed], [true, null]);
  assert.deepEqual(v.pack, pack);
  // the chain members the door knows are exactly those growBiochain returns, with and without the engram layer,
  // and those extendBiochain adds: a package holding every one of them passes, and one more is refused
  const withEngrams = await BM.growBiochain(OW.lexiconText(SMALL)), without = await BM.growBiochain(OW.lexiconText(SMALL), { engrams: false });
  const child = clone(await BM.extendBiochain(without, "LEX/1|9999|text|a|a|\n", { engrams: true }));
  const real = [...new Set([...Object.keys(withEngrams), ...Object.keys(without), ...Object.keys(child)])];
  assert.deepEqual(real.filter((k) => !Object.keys(without).includes(k)).sort(), ["addedBytes", "engramCount", "engramMeanJ", "engramStream", "epoch", "parentChainId", "parentMerkleRoot"]);
  assert.equal(real.length, 19);
  for (const member of real) {                               // each real member is let in: the verdict comes from a check, not from the door
    const p = clone(pack); if (!(member in p.chain)) p.chain[member] = member === "engramStream" ? "" : 0;
    const r = await door(JSON.stringify(p), "a chain with the member " + member);
    assert.notEqual(r.failed, "parse", member);
  }
  // a journey package with its engram layer goes through the same door
  const { bundle: jb } = await journeyBundle(), keys = await OW.newSessionKeys();
  const jwire = JSON.stringify(OW.makeHyperpack({ ...jb, certificate: (await OW.issueCertificate(jb, keys, AT)).certificate }));
  const jv = await door(jwire, "a journey package");
  assert.equal(jv.ok, true);
  assert.equal(OW.profileOf(jv.pack.lexicon).format, "LEXICON/1");
  assert.equal(OW.entriesOfPack(jv.pack).length, 3);
  // every member of the certificate and of a ledger entry that real output has is let in; nothing else is
  assert.deepEqual(Object.keys(pack.certificate), ["format", "commitment", "traceHead", "issuedAt", "sealId", "publicJwk", "sig"]);
  assert.deepEqual(Object.keys(pack.trace[0]), ["n", "actor", "event", "detail", "at", "prev", "hash"]);
  assert.equal(bundle.trace.length, 5);

  // a package that passes the door and fails a check: the verdict names the check, as verifyHyperpack does
  for (const [what, change, failed] of [
    ["a relabelled entry", (p) => { p.lexicon.entries[0].layer = "text"; }, "lexicon"],
    ["an unknown member in the lexicon", (p) => { p.lexicon.title = "certified"; }, "lexicon"],
    ["an unknown member in a lexicon entry", (p) => { p.lexicon.entries[3].note = "x"; }, "lexicon"],
    ["an unknown member in a lineage row", (p) => { p.lineage[0].note = "x"; }, "lineage"],
    ["a missing traceHead", (p) => { delete p.certificate.traceHead; }, "commitment"],
    ["a chain without its stream", (p) => { delete p.chain.stream; }, "parity"],
    ["lexicon.entries that is a string", (p) => { p.lexicon.entries = "x"; }, "lexicon"],
    ["a public key that is a string", (p) => { p.certificate.publicJwk = "x"; }, "signature"],
    ["a public key with a numeric x", (p) => { p.certificate.publicJwk.x = 1; }, "signature"],
    ["a signature that is an object", (p) => { p.certificate.sig = {}; }, "signature"],
    ["an epoch written as a string", (p) => { p.chain.epoch = "4"; }, "lineage"],
    ["a ledger entry changed", (p) => { p.trace[2].detail += " "; }, "trace"],
  ]) {
    const p = clone(pack); change(p);
    const r = await door(JSON.stringify(p), what);
    assert.deepEqual([r.ok, r.failed, r.pack], [false, failed, null], what);
    assert.equal((await OW.verifyHyperpack(JSON.stringify(p))).failed, failed, what + ": the same verdict as verifyHyperpack");
  }
  // what the signature does not cover may differ, and the package still passes: the route, issuedAt, entries after the head
  for (const [what, change] of [
    ["another route", (p) => { p.route = { from: "anywhere", to: "everyone", note: "not covered by the signature" }; }],
    ["an empty route", (p) => { p.route = {}; }],
    ["another issuedAt", (p) => { p.certificate.issuedAt = "1949-01-01T00:00:00.000Z"; }],
    ["a ledger entry appended after the certified head", (p) => { OW.traceAppend(p.trace, "anyone", "note", "appended after sealing", AT); }],
  ]) {
    const p = clone(pack); change(p);
    const r = await door(JSON.stringify(p), what);
    assert.equal(r.ok, true, what);
    assert.deepEqual(r.pack, p, what);
  }
});

test("readHyperpack: hostile texts get a verdict, never an exception, each in under two seconds", async () => {
  const { pack, wire } = await small();
  const member = (name, json) => { const at = wire.indexOf(`"${name}":`); assert.ok(at > 0); return wire.slice(0, at) + `"${name}":${json},"x${name}":` + wire.slice(at + name.length + 3); };

  // not a string
  for (const x of [undefined, null, 5, true, pack, [wire], new String(wire), { toString: () => wire }, Buffer.from(wire), () => wire]) await shut(x, "a " + (x === null ? "null" : typeof x), /^not a text$/);

  // nesting: 20,000 deep, wherever it is put, and 200,000 deep
  await shut(nest(20000), "the whole text an array nested 20,000 deep");
  await shut(nest(200000), "the whole text an array nested 200,000 deep");
  await shut('{"a":'.repeat(20000) + "1" + "}".repeat(20000), "the whole text an object nested 20,000 deep");
  for (const name of ["route", "chain", "lexicon", "lineage", "trace", "certificate"]) {
    await shut(member(name, nest(20000)), `${name} replaced by an array nested 20,000 deep`);
    const p = clone(pack); p[name] = JSON.parse(nest(13));
    await shut(JSON.stringify(p), `${name} replaced by an array nested 13 deep`);
  }
  for (const [what, text] of [
    ["lexicon.dims nested 20,000 deep", wire.replace('"dims":["2D","3D"]', '"dims":' + nest(20000))],
    ["lexicon.entries nested 20,000 deep", wire.replace('"entries":[', '"entries":' + nest(20000) + ',"xentries":[')],
    ["a lineage row replaced by an array nested 20,000 deep", wire.replace('"lineage":[', '"lineage":[' + nest(20000) + ",")],
    ["chain.segCuts nested 20,000 deep", wire.replace('"segCuts":', '"segCuts":' + nest(20000) + ',"xsegCuts":')],
    ["chain.parentChainId nested 20,000 deep", wire.replace(/"parentChainId":"[^"]*"/, '"parentChainId":' + nest(20000))],
    ["a ledger entry that is an object nested 20,000 deep", wire.replace('"trace":[', '"trace":[' + '{"a":'.repeat(20000) + "1" + "}".repeat(20000) + ",")],
    ["the public key nested 20,000 deep", wire.replace(/"publicJwk":\{[^}]*\}/, '"publicJwk":' + nest(20000, '{"a":', "}").replace('{"a":}', '{"a":1}'))],
  ]) { assert.notEqual(text, wire, what); await shut(text, what); }
  // the limit itself: twelve levels pass (the route is not covered by the signature), thirteen do not
  const routeOfDepth = (levels) => { let r = {}; for (let i = 2; i < levels; i++) r = { a: r }; return r; };   // the package is level 1, the route level 2
  { const p = clone(pack); p.route = routeOfDepth(12); assert.equal((await door(JSON.stringify(p), "a route down to level 12")).ok, true); }
  { const p = clone(pack); p.route = routeOfDepth(13); await shut(JSON.stringify(p), "a route down to level 13", /nested deeper than 12 levels/); }
  { const p = clone(pack); p.route = { a: JSON.parse(nest(10)) }; assert.equal((await door(JSON.stringify(p), "arrays down to level 12")).ok, true); }
  { const p = clone(pack); p.route = { a: JSON.parse(nest(11)) }; await shut(JSON.stringify(p), "arrays down to level 13", /nested deeper than 12 levels/); }

  // size: 1,500,000 characters are read, one more is refused before anything is parsed
  const padTo = (length) => { const p = clone(pack); p.route = { pad: "" }; p.route.pad = "A".repeat(length - JSON.stringify(p).length); return JSON.stringify(p); };
  const full = padTo(1500000), over = padTo(1500001);
  assert.deepEqual([full.length, over.length], [1500000, 1500001]);
  assert.equal((await door(full, "a package of exactly 1,500,000 characters")).ok, true);
  await shut(over, "a package of 1,500,001 characters", /^longer than 1500000 characters$/);
  await shut(wire + " ".repeat(1500001 - wire.length), "a good wire padded to 1,500,001 characters", /^longer than 1500000 characters$/);
  await shut("[".repeat(1500001), "1,500,001 opening brackets", /^longer than 1500000 characters$/);
  await shut("x".repeat(40000000), "forty million characters", /^longer than 1500000 characters$/);

  // not JSON
  for (const [what, text] of [["an empty text", ""], ["a word", "hyperpack"], ["a cut-off wire", wire.slice(0, -1)], ["a wire with a comma too many", wire.slice(0, -1) + ",}"], ["two values", wire + wire],
    ["a byte order mark first", "\u{feff}" + wire], ["single quotes", wire.replaceAll('"', "'")], ["an unclosed bracket", "["], ["1,500,000 opening brackets", "[".repeat(1500000)]]) await shut(text, what, /^not JSON$/);

  // not in wire form: the same value, written another way
  const WIRE_FORM = /^not in wire form/;
  await shut(JSON.stringify(pack, null, 1), "indented with one space", WIRE_FORM);
  await shut(JSON.stringify(pack, null, "\t"), "indented with tabs", WIRE_FORM);
  await shut(wire + "\n", "a newline after the wire", WIRE_FORM);
  await shut(" " + wire, "a space before the wire", WIRE_FORM);
  await shut(wire.replace('"format":"HYPERPACK/1"', '"format": "HYPERPACK/1"'), "one space after a colon", WIRE_FORM);
  await shut(wire.replace('"HYPERPACK/1"', '"HYPERPACK\\/1"'), "an escape that is not needed", WIRE_FORM);
  await shut(wire.replace('"HYPERPACK/1"', '"\\u0048YPERPACK/1"'), "a letter written as an escape", WIRE_FORM);
  await shut(wire.replace(/"epoch":4/, '"epoch":4.0'), "a number written 4.0", WIRE_FORM);
  await shut(wire.replace(/"epoch":4/, '"epoch":4e0'), "a number written 4e0", WIRE_FORM);
  await shut(wire.replace(/"segments":7/, '"segments":07'), "a number with a leading zero", /^not JSON$/);
  // members named twice (JSON.parse keeps the last, so the text is not the text of its value)
  await shut(wire.replace('"format":"HYPERPACK/1"', '"format":"HYPERPACK/1","format":"HYPERPACK/1"'), "the format member twice", WIRE_FORM);
  await shut(wire.replace('"chain":', '"chain":1,"chain":'), "the chain member twice, the first a number", WIRE_FORM);
  await shut(wire.replace('"sig":', '"sig":"00","sig":'), "the signature twice", WIRE_FORM);
  await shut(wire.replace('"root":', '"root":"00","root":'), "the lexicon root twice", WIRE_FORM);
  await shut(wire.replace(/"stream":"/, '"stream":"","stream":"'), "the stream twice", WIRE_FORM);

  // not the members of a package
  const MEMBERS = /^not a package: its members are not format, route, chain, lexicon, lineage, trace and certificate, in that order$/;
  for (const text of ["null", "[]", "1", '"x"', "true", "[" + wire + "]"]) await shut(text, "the text " + text.slice(0, 12), /^not a package: the text is not a JSON object$/);
  await shut("{}", "an empty object", MEMBERS);
  for (const name of Object.keys(pack)) { const p = clone(pack); delete p[name]; await shut(JSON.stringify(p), "without " + name, MEMBERS); }
  { const p = clone(pack); p.endorsement = "TRUE"; await shut(JSON.stringify(p), "an unknown member on the package", MEMBERS); }
  { const { route, ...rest } = clone(pack); await shut(JSON.stringify({ ...rest, route }), "the route last", MEMBERS); }
  { const p = clone(pack); await shut(JSON.stringify({ certificate: p.certificate, trace: p.trace, lineage: p.lineage, lexicon: p.lexicon, chain: p.chain, route: p.route, format: p.format }), "the members in reverse order", MEMBERS); }
  await shut(wire.replace("{", '{"__proto__":{"format":"HYPERPACK/1"},'), "a __proto__ member on the package", MEMBERS);
  await shut(wire.replace("{", '{"0":0,'), "a member named 0 first", /^not/);
  for (const format of ["HYPERPACK/2", "hyperpack/1", "", 1, null, ["HYPERPACK/1"]]) { const p = clone(pack); p.format = format; await shut(JSON.stringify(p), "format " + show(format), /^not a HYPERPACK\/1$/); }
  const TYPES = /^not a package: route, chain, lexicon and certificate are objects, lineage and trace are lists$/;
  for (const name of ["route", "chain", "lexicon", "certificate"]) for (const value of ["x", 1, null, [], [{}], true]) { const p = clone(pack); p[name] = value; await shut(JSON.stringify(p), `${name} as ${show(value)}`, TYPES); }
  for (const name of ["lineage", "trace"]) for (const value of ["x", 1, null, {}, { length: 3 }, true]) { const p = clone(pack); p[name] = value; await shut(JSON.stringify(p), `${name} as ${show(value)}`, TYPES); }

  // a member this format does not know: in the chain, the certificate, a ledger entry
  { const p = clone(pack); p.chain.title = "King James Bible, certified"; await shut(JSON.stringify(p), "an unknown member in the chain", /^the chain has a member this format does not know$/); }
  { const p = clone(pack); p.chain.parentStrict = { ok: true }; await shut(JSON.stringify(p), "parentStrict in the chain", /^the chain has a member/); }
  await shut(wire.replace('"chain":{', '"chain":{"__proto__":{},'), "__proto__ in the chain", /^the chain has a member/);
  { const p = clone(pack); p.certificate.issuer = "Owl Academy Overwatch"; await shut(JSON.stringify(p), "an unknown member in the certificate", /^the certificate has a member this format does not know$/); }
  { const p = clone(pack); p.certificate.d = "x"; await shut(JSON.stringify(p), "a member named d in the certificate", /^the certificate has a member/); }
  const LEDGER = /^a ledger entry is not an object, or has a member this format does not know$/;
  { const p = clone(pack); p.trace[1].note = "reviewed by scholars"; await shut(JSON.stringify(p), "an unknown member in a ledger entry", LEDGER); }
  { const p = clone(pack); p.trace.push({ note: "x" }); await shut(JSON.stringify(p), "an appended ledger entry with an unknown member", LEDGER); }
  for (const value of [null, 1, "x", [], [pack.trace[0]]]) { const p = clone(pack); p.trace.splice(1, 0, value); await shut(JSON.stringify(p), "a ledger entry that is " + show(value).slice(0, 12), LEDGER); }

  // too many: ledger entries, lineage rows, lexicon entries
  const long = clone(pack);
  while (long.trace.length < 4096) OW.traceAppend(long.trace, "anyone", "note", "", AT);
  const most = JSON.stringify(long);
  assert.ok(most.length < 1500000, "4,096 ledger entries fit in the text limit");
  assert.equal((await door(most, "4,096 ledger entries")).ok, true, "entries after the certified head are not covered, and are allowed up to the limit");
  OW.traceAppend(long.trace, "anyone", "note", "", AT);
  await shut(JSON.stringify(long), "4,097 ledger entries", /^the ledger holds more than 4096 entries$/);
  const flood = clone(pack);
  for (let i = 0; i < 200000; i++) OW.traceAppend(flood.trace, "x", "y", "z", AT);
  const floodWire = JSON.stringify(flood);
  assert.ok(floodWire.length > 40000000, `200,000 appended ledger entries make ${floodWire.length} characters`);
  await shut(floodWire, "200,000 appended ledger entries", /^longer than 1500000 characters$/);
  const many = clone(pack); many.trace.push(...Array.from({ length: 6000 }, (_, i) => ({ n: i })));
  assert.ok(JSON.stringify(many).length < 1500000);
  await shut(JSON.stringify(many), "6,000 short ledger entries", /^the ledger holds more than 4096 entries$/);
  { const p = clone(pack); while (p.lineage.length < 65) p.lineage.push(clone(p.lineage[0])); await shut(JSON.stringify(p), "65 lineage rows", /^the lineage lists more than 64 epochs$/); }
  { const p = clone(pack); while (p.lineage.length < 64) p.lineage.push(clone(p.lineage[0])); assert.equal((await door(JSON.stringify(p), "64 lineage rows")).failed, "lineage"); }
  { const p = clone(pack); while (p.lexicon.entries.length < 3001) p.lexicon.entries.push({ address: "0" }); await shut(JSON.stringify(p), "3,001 lexicon entries", /^the lexicon lists more than 3000 entries$/); }
  { const p = clone(pack); while (p.lexicon.entries.length < 3000) p.lexicon.entries.push({ address: "0" }); assert.equal((await door(JSON.stringify(p), "3,000 lexicon entries")).failed, "lexicon"); }

  // strings that are not well-formed Unicode: written as an escape (the parsed string holds half a pair) or raw
  const ILL = /^a string in the package is not well-formed Unicode$/;
  { const p = clone(pack); OW.traceAppend(p.trace, "anyone", "note", "a\u{d800}b", AT); const text = JSON.stringify(p);
    assert.ok(text.isWellFormed() && text.includes("a\\ud800b"), "JSON writes half a pair as an escape: the text is well formed, the string it stands for is not");
    assert.equal((await OW.verifyHyperpack(text)).ok, true, "verifyHyperpack alone lets it through");
    await shut(text, "a lone surrogate in a ledger entry after the head", ILL); }
  { const p = clone(pack); p.route.to = "\u{dc00}"; await shut(JSON.stringify(p), "a lone low surrogate in the route", ILL); }
  { const p = clone(pack); p.route["\u{d83e}"] = 1; await shut(JSON.stringify(p), "a lone surrogate as a member name", ILL); }
  { const p = clone(pack); p.route.to = ["x", { deep: ["\u{d800}\u{d800}"] }]; await shut(JSON.stringify(p), "a lone surrogate nested in the route", ILL); }
  { const p = clone(pack); p.lexicon.entries[2].name = "Ezekiel\u{d800}"; await shut(JSON.stringify(p), "a lone surrogate in a lexicon name", ILL); }
  { const p = clone(pack); p.route.to = "\u{1f989}"; assert.equal((await door(JSON.stringify(p), "a whole pair in the route")).ok, true); }
  await shut(wire.replace('"origin"', '"ori\u{d800}gin"'), "a raw lone surrogate in the text", ILL);

  // 1,500 random one-token changes of the wire: always a verdict; what still passes differs only where no signature reaches
  const rnd = seeded(99), JUNK = ["null", "[]", "{}", '""', "0", "-1", "1e999", "true", '"__proto__"', '{"length":1}', "[[]]", '"\\ud800"', '"x"', "4", '"LEXICON/1"', '"reading"'];
  const tokens = [...wire.matchAll(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:e-?\d+)?/g)];
  const outcomes = {};
  let passed = 0;
  for (let i = 0; i < 1500; i++) {
    const m = pickFrom(rnd, tokens), junk = pickFrom(rnd, JUNK);
    if (m[0] === junk) continue;
    const mutant = wire.slice(0, m.index) + junk + wire.slice(m.index + m[0].length);
    const v = await door(mutant, "token " + show(m[0].slice(0, 24)) + " replaced by " + junk);
    outcomes[v.ok ? "accepted" : v.failed] = (outcomes[v.ok ? "accepted" : v.failed] || 0) + 1;
    if (!v.ok) continue;
    passed++;
    const got = clone(v.pack), jwk = got.certificate.publicJwk;
    assert.deepEqual([jwk.kty, jwk.crv, jwk.x, jwk.y], ["EC", "P-256", pack.certificate.publicJwk.x, pack.certificate.publicJwk.y], "the key itself is the same");
    got.route = pack.route; got.certificate.issuedAt = pack.certificate.issuedAt; got.certificate.publicJwk = pack.certificate.publicJwk;
    assert.deepEqual(got, pack, "a mutant that passes differs only in the route, in issuedAt or in what the key's record says beside the key: " + show(m[0].slice(0, 24)) + " replaced by " + junk);
  }
  assert.ok(Object.keys(outcomes).length >= 8, "the mutants fail at many different checks: " + JSON.stringify(outcomes));
  assert.ok(passed >= 1 && passed <= 150, `only a few pass (${passed})`);
  // and no detail of the door repeats what it was given
  const MARK = "ZQXJ";
  for (const text of [MARK, `{"${MARK}":1}`, wire.replace("origin", MARK + "\\ud800"), wire.replace('"route":', `"${MARK}":`), wire.replace('"chain":{', `"chain":{"${MARK}":1,`)]) {
    const detail = await shut(text, "a text with a marker");
    assert.ok(!detail.includes(MARK), "the detail does not repeat the input");
  }
});

// ─── Phase 1: words: the wheel, the square, the mirror ───────────────────────

const GOLDEN = "9841D88D8B003CEA";
/** The PACKET_FIELDS key that holds a bit, from the field map written out again (RFC 07 section 5). */
const fieldOfBit = (bit) => (bit >= 60 ? "form" : bit === 59 ? "parity" : bit >= 56 ? "spin" : bit >= 24 ? "quat32" : bit >= 8 ? "payload16" : bit >= 3 ? "freq" : "amp");
const randomHex = (rnd) => Array.from({ length: 16 }, () => "0123456789ABCDEF"[Math.floor(rnd() * 16)]).join("");
const randomBytes = (rnd, n) => Array.from({ length: n }, () => Math.floor(rnd() * 256));

test("glyphCells and glyphHex: 64 cells in reading order; sector, ring, quadrant, row and col; the word comes back", () => {
  assert.equal(BM.crystallizeGolden(), GOLDEN);
  const cells = OW.glyphCells(GOLDEN), packet = OW.decodePacket(GOLDEN), word = BigInt("0x" + GOLDEN);
  assert.equal(cells.length, 64);
  cells.forEach((c, i) => {
    assert.deepEqual(Object.keys(c), ["i", "bit", "sector", "ring", "quadrant", "row", "col", "on", "field"]);
    assert.deepEqual([c.i, c.bit], [i, 63 - i]);
    assert.deepEqual([c.sector, c.ring, c.quadrant, c.row, c.col], [Math.floor(i / 4), i % 4, Math.floor(i / 16), Math.floor(i / 8), i % 8]);
    assert.equal(c.on, ((word >> BigInt(c.bit)) & 1n) === 1n, "cell " + i + " is bit " + c.bit + " of the word");
    assert.equal(c.on, packet.bits[i] === "1");
    assert.equal(c.field, fieldOfBit(c.bit));
    assert.ok(OW.PACKET_FIELDS.some((f) => f.key === c.field && c.bit <= f.hi && c.bit >= f.lo));
  });
  // 1 -> 4 -> 16 -> 64: bit, sector, quarter, word
  for (let s = 0; s < 16; s++) {
    const sector = cells.filter((c) => c.sector === s);
    assert.deepEqual(sector.map((c) => c.ring), [0, 1, 2, 3], "a sector is four cells, outer ring first");
    const digit = sector.reduce((v, c) => v + (c.on ? 8 >> c.ring : 0), 0);          // ring 0 is the digit's 8, ring 3 its 1
    assert.equal(digit.toString(16).toUpperCase(), GOLDEN[s], "sector " + s + " is hex digit " + s + ": one sixteenth of the word");
    assert.equal(new Set(sector.map((c) => c.quadrant)).size, 1);
  }
  for (let q = 0; q < 4; q++) {
    const quadrant = cells.filter((c) => c.quadrant === q);
    assert.equal(quadrant.length, 16);
    assert.deepEqual([...new Set(quadrant.map((c) => c.sector))], [4 * q, 4 * q + 1, 4 * q + 2, 4 * q + 3], "a quadrant is four sectors");
    assert.deepEqual([...new Set(quadrant.map((c) => c.row))], [2 * q, 2 * q + 1], "and two rows of the square");
  }
  for (let r = 0; r < 8; r++) assert.deepEqual(cells.filter((c) => c.row === r).map((c) => c.col), [0, 1, 2, 3, 4, 5, 6, 7], "row " + r + " of the 8 x 8 square, row-major");
  for (let ring = 0; ring < 4; ring++) assert.equal(cells.filter((c) => c.ring === ring).length, 16, "a ring is sixteen cells");
  // the first sector is the form field, and every field reads back from its cells
  assert.deepEqual(cells.slice(0, 4).map((c) => c.field), ["form", "form", "form", "form"]);
  assert.deepEqual(cells.filter((c) => c.field === "parity").map((c) => [c.i, c.bit, c.sector, c.ring, c.row, c.col]), [[4, 59, 1, 0, 0, 4]], "the guard bit: the outer cell of the second sector");
  const counts = {};
  for (const c of cells) counts[c.field] = (counts[c.field] || 0) + 1;
  assert.deepEqual(counts, { form: 4, parity: 1, spin: 3, quat32: 32, payload16: 16, freq: 5, amp: 3 });
  for (const f of OW.PACKET_FIELDS) {
    const value = cells.filter((c) => c.field === f.key).reduce((v, c) => v * 2 + (c.on ? 1 : 0), 0);
    assert.equal(value, packet[f.key], "field " + f.key);
  }
  assert.equal(packet.form, 9);
  // the word comes back, in upper case, whatever case it was given in
  assert.equal(OW.glyphHex(cells), GOLDEN);
  assert.equal(OW.glyphHex(OW.glyphCells(GOLDEN.toLowerCase())), GOLDEN);
  assert.equal(OW.glyphHex(cells.map((c) => ({ on: c.on }))), GOLDEN, "only on is read");
  assert.equal(OW.glyphHex(OW.glyphCells("0000000000000000")), "0000000000000000");
  assert.equal(OW.glyphHex(OW.glyphCells("FFFFFFFFFFFFFFFF")), "FFFFFFFFFFFFFFFF");
  assert.equal(OW.glyphCells("8000000000000000").filter((c) => c.on).map((c) => c.i).join(), "0");
  assert.equal(OW.glyphCells("0000000000000001").filter((c) => c.on).map((c) => c.i).join(), "63");
  const rnd = seeded(64);
  for (let n = 0; n < 500; n++) {
    const hex = randomHex(rnd), got = OW.glyphCells(hex);
    assert.equal(OW.glyphHex(got), hex);
    assert.equal(got.map((c) => (c.on ? "1" : "0")).join(""), OW.decodePacket(hex).bits);
  }
  // every single flip breaks parity, every double flip keeps it (in a word whose parity holds)
  const flipped = (word64, ...at) => OW.glyphHex(OW.glyphCells(word64).map((c) => (at.includes(c.i) ? { ...c, on: !c.on } : c)));
  const words = [GOLDEN, BM.crystallize([...new TextEncoder().encode("LEX/1|0|text|a|a|\n")]), BM.crystallize(randomBytes(rnd, 720)), OW.seedMirror([1, 0, 0, 1])];
  for (const hex of words) {
    assert.equal(OW.decodePacket(hex).parityOk, true, hex);
    for (let i = 0; i < 64; i++) {
      const one = flipped(hex, i);
      assert.equal(one, OW.flipBit(hex, 63 - i), "cell " + i + " is bit " + (63 - i));
      assert.equal(OW.decodePacket(one).parityOk, false, hex + ": cell " + i + " flipped breaks parity");
      for (let j = i + 1; j < 64; j++) {
        const two = flipped(hex, i, j);
        assert.notEqual(two, hex);
        assert.equal(OW.decodePacket(two).parityOk, true, hex + ": cells " + i + " and " + j + " flipped keep parity");
      }
    }
    // sixty-three bits fix the sixty-fourth: the guard bit is the XOR of the others
    const others = OW.glyphCells(hex).filter((c) => c.field !== "parity").reduce((p, c) => p ^ (c.on ? 1 : 0), 0);
    assert.equal(others, OW.decodePacket(hex).parity);
  }
  const PACKET = /^a packet is 16 hex digits$/;
  for (const x of [undefined, null, 5, "", "9841D88D8B003CE", GOLDEN + "A", "9841D88D8B003CEG", " " + GOLDEN.slice(1), GOLDEN + "\n", [GOLDEN], 0x9841d88d8b003cean]) {
    refused(() => OW.glyphCells(x), "glyphCells of " + show(typeof x === "bigint" ? "a bigint" : x ?? null), PACKET);
    refused(() => OW.squareQuarters(x), "squareQuarters", PACKET);
    refused(() => OW.quarterParities(x), "quarterParities", PACKET);
  }
  const NEEDS = /^glyphHex needs the 64 cells of a word in order, each on or off$/;
  for (const x of [undefined, null, GOLDEN, [], cells.slice(1), [...cells, cells[0]], cells.map((c) => c.on), cells.map((c) => ({ ...c, on: c.on ? 1 : 0 })), cells.map((c, i) => (i === 9 ? null : c)),
    cells.slice().reverse(), [cells[1], cells[0], ...cells.slice(2)]]) refused(() => OW.glyphHex(x), "glyphHex", NEEDS);
});

/** The author's mirror rule as the Loom Weave page runs it (Library/Department V/Fractal_Processing/Loom_Weave.html,
 *  the "1/16 M.C. ESCHER SYMMETRY" button), on a 64-cell seed grid, here copied for the test. */
function loomWeaveMirror(seedState) {
  const s = seedState.slice();
  const m00 = s[0], m10 = s[1], m01 = s[8], m11 = s[9];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    let rx = x > 3 ? 7 - x : x; if (rx > 1) rx = 3 - rx;
    let ry = y > 3 ? 7 - y : y; if (ry > 1) ry = 3 - ry;
    let val = 0;
    if (rx === 0 && ry === 0) val = m00;
    if (rx === 1 && ry === 0) val = m10;
    if (rx === 0 && ry === 1) val = m01;
    if (rx === 1 && ry === 1) val = m11;
    s[y * 8 + x] = val;
  }
  return s;
}

test("seedMirror: four cells fill all 64; for all 16 seeds the guard bit holds, and any three corner squares give the fourth", () => {
  const gridHex = (g) => { let s = ""; for (let i = 0; i < 64; i += 4) s += parseInt(g.slice(i, i + 4).join(""), 2).toString(16).toUpperCase(); return s; };
  const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  /** One mirror step: a square of side n becomes the square of side 2n made of it and its three mirror images. */
  const step = (sq, n) => { const o = new Array(4 * n * n); for (let y = 0; y < 2 * n; y++) for (let x = 0; x < 2 * n; x++) o[y * 2 * n + x] = sq[(y < n ? y : 2 * n - 1 - y) * n + (x < n ? x : 2 * n - 1 - x)]; return o; };
  const words = new Set();
  for (let seed = 0; seed < 16; seed++) {
    const four = [(seed >> 3) & 1, (seed >> 2) & 1, (seed >> 1) & 1, seed & 1], hex = OW.seedMirror(four), what = "seed " + four.join("");
    assert.match(hex, /^[0-9A-F]{16}$/);
    // the author's rule, run as the Loom Weave page runs it, from a grid that is noise outside the four seed cells
    const grid = Array.from({ length: 64 }, (_, i) => (i * 7 + seed) % 2);
    [grid[0], grid[1], grid[8], grid[9]] = four;
    const filled = loomWeaveMirror(grid);
    assert.equal(hex, gridHex(filled), what + ": the Loom Weave rule");
    const cells = OW.glyphCells(hex);
    assert.deepEqual(cells.map((c) => (c.on ? 1 : 0)), filled);
    // the seed is four cells of the 64, one sixteenth of the word: (0,0), (1,0), (0,1), (1,1)
    assert.deepEqual([[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => (cells.find((c) => c.col === x && c.row === y).on ? 1 : 0)), four, what);
    for (const c of cells) {                                 // every cell is the seed cell its row and column fold onto
      const fold = (v) => { const r = v > 3 ? 7 - v : v; return r > 1 ? 3 - r : r; };
      assert.equal(c.on ? 1 : 0, four[fold(c.row) * 2 + fold(c.col)]);
    }
    // the guard bit holds, and the ones are a multiple of 16
    assert.equal(OW.decodePacket(hex).parityOk, true, what + ": parity holds");
    const ones = cells.filter((c) => c.on).length;
    assert.equal(ones, 16 * four.reduce((a, b) => a + b, 0), what + ": each seed bit is copied sixteen times");
    assert.deepEqual(OW.quarterParities(hex), [0, 0, 0, 0], what + ": every quarter holds an even number of ones");
    // three corner squares give the fourth, bit for bit
    const [a, b, c, d] = OW.squareQuarters(hex);
    const got = OW.fourthFromThree(a, b, c);
    assert.deepEqual(Object.keys(got), ["fromTopLeft", "fromTopRight", "fromBottomLeft", "agree"]);
    assert.deepEqual([got.fromTopLeft, got.fromTopRight, got.fromBottomLeft, got.agree], [d, d, d, true], what + ": each of the three predicts the fourth");
    // one wrong bit in the fourth square is caught by each of the three, whichever bit it is
    for (let k = 0; k < 16; k++) {
      const row = 4 + (k >> 2), col = 4 + (k & 3), damaged = OW.glyphHex(cells.map((x) => (x.row === row && x.col === col ? { ...x, on: !x.on } : x)));
      const [a2, b2, c2, d2] = OW.squareQuarters(damaged), again = OW.fourthFromThree(a2, b2, c2);
      assert.deepEqual([a2, b2, c2], [a, b, c]);
      assert.equal(again.agree, true, "the three still agree with each other");
      assert.ok(!eq(again.fromTopLeft, d2) && !eq(again.fromTopRight, d2) && !eq(again.fromBottomLeft, d2), what + ": bit " + k + " of the fourth square flipped is caught");
      assert.equal(again.fromTopLeft.filter((v, i) => v !== d2[i]).length, 1, "and the one wrong bit is found");
      assert.equal(OW.decodePacket(damaged).parityOk, false);
    }
    // one wrong bit in one of the three: they no longer agree
    for (const at of [0, 5, 27, 32, 59]) {                  // cells of the top-left, top-right and bottom-left squares
      const [a3, b3, c3] = OW.squareQuarters(OW.glyphHex(cells.map((x) => (x.i === at ? { ...x, on: !x.on } : x))));
      assert.equal(OW.fourthFromThree(a3, b3, c3).agree, false, what + ": cell " + at + " flipped");
    }
    // the same procedure twice: 2 x 2 -> 4 x 4 -> 8 x 8, each step a square and its three mirror images
    const s4 = step(four, 2), s8 = step(s4, 4);
    assert.deepEqual(s4, a, what + ": one step gives the top-left square");
    assert.equal(gridHex(s8), hex, what + ": two steps rebuild the word");
    assert.equal(OW.seedMirror(four.map(Boolean)), hex, "booleans are bits");
    words.add(hex);
  }
  assert.equal(words.size, 16, "sixteen seeds, sixteen words");
  assert.deepEqual([[0, 0, 0, 0], [1, 1, 1, 1], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [1, 0, 0, 1]].map(OW.seedMirror),
    ["0000000000000000", "FFFFFFFFFFFFFFFF", "9900009999000099", "6600006666000066", "0099990000999900", "0066660000666600", "9966669999666699"]);

  // squareQuarters on any word: the four squares are the word, row-major; a word that is no mirror word does not agree
  const rnd = seeded(16);
  for (const hex of [GOLDEN, ...Array.from({ length: 200 }, () => randomHex(rnd))]) {
    const cells = OW.glyphCells(hex), quarters = OW.squareQuarters(hex);
    assert.deepEqual(quarters.map((q) => q.length), [16, 16, 16, 16]);
    quarters.forEach((q, n) => q.forEach((bit, k) => {
      const row = (n >> 1) * 4 + (k >> 2), col = (n & 1) * 4 + (k & 3);                // 0 top left, 1 top right, 2 bottom left, 3 bottom right
      assert.equal(bit, cells[row * 8 + col].on ? 1 : 0);
    }));
  }
  const [ga, gb, gc, gd] = OW.squareQuarters(GOLDEN), g = OW.fourthFromThree(ga, gb, gc);
  assert.deepEqual([ga, gb], [[1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1]], "9841D88D: rows 98, 41, D8, 8D, left and right halves");
  assert.equal(g.agree, false);
  assert.ok(!eq(g.fromTopRight, gd));
  // the mirrors: left-right from the bottom-left square, top-bottom from the top-right, both from the top-left
  const rows = (q) => [0, 4, 8, 12].map((r) => q.slice(r, r + 4).join(""));
  const probe = OW.fourthFromThree([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  assert.deepEqual([rows(probe.fromTopLeft), rows(probe.fromTopRight), rows(probe.fromBottomLeft), probe.agree], [["0000", "0000", "0000", "0001"], ["0000", "0000", "0000", "1111"], ["0001", "0001", "0001", "0001"], false]);

  const SEED = /^a seed is four bits/;
  for (const x of [undefined, null, 5, "1001", [], [1, 0, 0], [1, 0, 0, 1, 0], [1, 0, 0, 2], [1, 0, 0, "1"], [1, 0, 0, null], [1, 0, 0, 0.5], [[1], 0, 0, 0]]) refused(() => OW.seedMirror(x), "seedMirror of " + show(x ?? null), SEED);
  const THREE = /^fourthFromThree needs three corner squares of 16 bits each$/;
  for (const args of [[], [ga], [ga, gb], [ga, gb, "x"], [ga, gb, gc.slice(1)], [ga, gb, [...gc, 0]], [ga, gb, gc.map(Boolean)], [ga, gb, gc.map((v) => v * 2)], [null, gb, gc], [GOLDEN, GOLDEN, GOLDEN]])
    refused(() => OW.fourthFromThree(...args), "fourthFromThree with " + args.length + " arguments", THREE);
});

test("quarterParities: on 2,000 crystallised packets the parities of three quarters fix the fourth", () => {
  assert.deepEqual(OW.quarterParities(GOLDEN), [1, 0, 0, 1], "9841 has five ones, D88D eight, 8B00 four, 3CEA nine");
  assert.deepEqual(OW.quarterParities(GOLDEN.toLowerCase()), [1, 0, 0, 1]);
  const rnd = seeded(2000);
  const seen = new Set();
  for (let n = 0; n < 2000; n++) {
    const bytes = n % 4 === 0 ? [...new TextEncoder().encode(entryAt(String(n), "x".repeat(n % 97)).line + "\n")] : randomBytes(rnd, n % 3 === 0 ? 720 : 1 + Math.floor(rnd() * 720));
    const hex = BM.crystallize(bytes), packet = OW.decodePacket(hex), p = OW.quarterParities(hex);
    assert.equal(packet.parityOk, true);
    assert.equal(hex[0], "9", "the first sector, the form field, is 9 for every crystal packet");
    assert.equal(packet.payload16, bytes.length);
    const cells = OW.glyphCells(hex);
    assert.deepEqual(p, [0, 1, 2, 3].map((q) => cells.filter((c) => c.quadrant === q && c.on).length % 2), "each is the parity of its sixteen cells");
    assert.equal(p[0] ^ p[1] ^ p[2], p[3], hex + ": three quarters give the fourth");
    for (const lost of [0, 1, 2, 3]) assert.equal(p.filter((_, q) => q !== lost).reduce((a, b) => a ^ b, 0), p[lost], "whichever quarter is the fourth");
    // one flipped cell breaks the rule, in whichever quarter it lies; two flipped cells mend it
    const i = Math.floor(rnd() * 64), j = (i + 1 + Math.floor(rnd() * 63)) % 64;
    const one = OW.quarterParities(OW.flipBit(hex, 63 - i)), two = OW.quarterParities(OW.flipBit(OW.flipBit(hex, 63 - i), 63 - j));
    assert.equal(one[0] ^ one[1] ^ one[2] ^ one[3], 1);
    assert.deepEqual(one.map((v, q) => v ^ p[q]), [0, 1, 2, 3].map((q) => (q === i >> 4 ? 1 : 0)), "only the quarter of the flipped cell changes");
    assert.equal(two[0] ^ two[1] ^ two[2] ^ two[3], 0);
    seen.add(p.join(""));
  }
  assert.equal(seen.size, 8, "all eight patterns of even overall parity occur, and no other");
  // a word whose parity does not hold breaks the rule
  assert.deepEqual(OW.quarterParities("8000000000000000"), [1, 0, 0, 0]);
  assert.equal(OW.decodePacket("8000000000000000").parityOk, false);
});

// ─── Phase 1: packets without sealing ────────────────────────────────────────

test("lexiconPackets equals chainPackets, and entryPacketIndex names the packet that holds an entry's line", async () => {
  const rnd = seeded(720);
  const cases = [["the small tree", SMALL], ["a tree of several chunks", randomTree(rnd, 6, 1000, false)], ["a multi-byte tree", randomTree(rnd, 9, 800, true)]];
  for (const [what, entries] of cases) {
    const text = OW.lexiconText(entries), bytes = new TextEncoder().encode(text), packets = OW.lexiconPackets(text);
    const bundle = await OW.buildLexiconBundle(entries, { at: AT });
    assert.deepEqual(packets, OW.chainPackets(bundle.chain), what + ": the packets of the chain that was grown");
    assert.equal(packets.length, Math.ceil(bytes.length / 720));
    assert.equal(packets.length, bundle.chain.leafHashes.length);
    packets.forEach((hex, k) => {
      const packet = OW.decodePacket(hex), chunk = bytes.slice(k * 720, (k + 1) * 720);
      assert.match(hex, /^[0-9A-F]{16}$/);
      assert.deepEqual([packet.parityOk, packet.form, packet.payload16], [true, 9, chunk.length], what + ": packet " + k);
      assert.equal(hex, BM.crystallize([...chunk]));
    });
    assert.equal(bundle.chain.stream.slice(0, 16), packets[0], "the stream begins with the first packet");
    // every entry: the packet that holds the first byte of its line
    let offset = 0;
    for (const e of entries) {
      const index = OW.entryPacketIndex(entries, e.address);
      assert.equal(index, Math.floor(offset / 720), what + ": " + e.address);
      assert.ok(index >= 0 && index < packets.length);
      const from = offset % 720, lineBytes = new TextEncoder().encode(e.line), chunk = bytes.slice(index * 720, (index + 1) * 720);
      assert.deepEqual([...chunk.slice(from, from + 6)], [...lineBytes.slice(0, Math.min(6, 720 - from))], "the line begins in that chunk");
      offset += lineBytes.length + 1;
    }
    assert.equal(offset, bytes.length);
    assert.equal(OW.entryPacketIndex(entries, entries[0].address), 0);
    assert.equal(OW.entryPacketIndex(entries, entries[entries.length - 1].address), Math.floor((bytes.length - utf8Bytes(entries[entries.length - 1].line) - 1) / 720));
    assert.equal(OW.entryPacketIndex(entries, "9999.9"), -1, "an address that is no entry");
    assert.equal(OW.entryPacketIndex(entries, ""), -1);
    if (entries !== SMALL) assert.ok(new Set(entries.map((e) => OW.entryPacketIndex(entries, e.address))).size > 3, what + ": entries lie in different packets");
  }
  // packets before any sealing: of any text, cut every 720 bytes of UTF-8
  assert.deepEqual(OW.lexiconPackets(""), []);
  assert.deepEqual(OW.lexiconPackets("x".repeat(720)).length, 1);
  assert.deepEqual(OW.lexiconPackets("x".repeat(721)).map((h) => OW.decodePacket(h).payload16), [720, 1]);
  assert.deepEqual(OW.lexiconPackets("\u{1f989}".repeat(200)).map((h) => OW.decodePacket(h).payload16), [720, 80], "bytes, not characters");
  assert.equal(OW.lexiconPackets(String.fromCharCode(...Array.from({ length: 60 }, (_, i) => i)))[0], GOLDEN, "the golden packet: bytes 0 to 59");
  for (const x of [undefined, null, 5, ["x"], new String("x")]) refused(() => OW.lexiconPackets(x), "lexiconPackets of a " + typeof x, /^lexiconPackets needs a text$/);
  for (const x of [undefined, null, "x", [], 5]) refused(() => OW.chainPackets(x), "chainPackets of " + show(x ?? null), /^chainPackets needs a chain record$/);
  assert.throws(() => OW.chainPackets({}), Error, "a record without a stream");
  assert.throws(() => OW.chainPackets({ stream: "9841" }), Error, "a stream that is no stream");
  for (const args of [[undefined, "0"], [null, "0"], ["x", "0"], [SMALL, 0], [SMALL, undefined], [SMALL.map((e) => e.line), "0"], [[{ address: "0" }], "0"], [[{ line: "x" }], "0"]])
    refused(() => OW.entryPacketIndex(...args), "entryPacketIndex", /^entryPacketIndex needs/);
});

// ─── Phase 1: witnesses ──────────────────────────────────────────────────────

test("witnessQuorum: two known receivers meet need 2; a repeat, a respelled key, an unknown key, the sealer, another wire and a refusal do not count", async () => {
  const { wire, keys: sealer, certificate } = await small();
  const receivers = [await OW.newSessionKeys(), await OW.newSessionKeys(), await OW.newSessionKeys(), await OW.newSessionKeys()];
  const ids = await Promise.all(receivers.map((k) => SC.sealIdFromPublic(k.publicJwk)));
  const answers = [];
  for (const k of receivers) answers.push((await OW.answerHyperpack(wire, k, AT)).answer);
  assert.deepEqual(answers.map((a) => a.sealId), ids);
  const quorum = (list, options) => OW.witnessQuorum(list, wire, { known: ids, exclude: [certificate.sealId], ...options });

  // two known receivers meet need 2 (the default); three meet 3; one does not meet 2
  const two = await quorum(answers.slice(0, 2));
  assert.deepEqual(two, { met: true, need: 2, accepted: [ids[0], ids[1]], rejected: [] });
  assert.deepEqual(Object.keys(two), ["met", "need", "accepted", "rejected"]);
  assert.deepEqual(await quorum(answers.slice(0, 3), { need: 3 }), { met: true, need: 3, accepted: ids.slice(0, 3), rejected: [] });
  assert.deepEqual(await quorum(answers), { met: true, need: 2, accepted: ids, rejected: [] });
  assert.deepEqual(await quorum(answers.slice(0, 1)), { met: false, need: 2, accepted: [ids[0]], rejected: [] });
  assert.deepEqual(await quorum(answers.slice(0, 1), { need: 1 }), { met: true, need: 1, accepted: [ids[0]], rejected: [] });
  assert.deepEqual(await quorum(answers.slice(0, 2), { need: 3 }), { met: false, need: 3, accepted: ids.slice(0, 2), rejected: [] });
  assert.deepEqual(await quorum([]), { met: false, need: 2, accepted: [], rejected: [] });
  assert.deepEqual(await OW.witnessQuorum(answers.slice(0, 2), wire, { known: new Set(ids) }), two, "known may be a Set; exclude and need have defaults");

  // the same answer twice is one witness
  assert.deepEqual(await quorum([answers[0], answers[0]]), { met: false, need: 2, accepted: [ids[0]], rejected: [{ index: 1, failed: "repeat" }] });
  assert.deepEqual(await quorum([answers[0], clone(answers[0]), { ...answers[0], answeredAt: "2099-01-01T00:00:00.000Z" }]), { met: false, need: 2, accepted: [ids[0]], rejected: [{ index: 1, failed: "repeat" }, { index: 2, failed: "repeat" }] });
  // a second answer by the same key (signed again) is still the same witness
  const again = (await OW.answerHyperpack(wire, receivers[0], "2026-03-03T00:00:00.000Z")).answer;
  assert.notEqual(again.sig, answers[0].sig);
  assert.deepEqual((await quorum([answers[0], again])).rejected, [{ index: 1, failed: "repeat" }]);

  // one key respelled: base64url leaves two unused bits in the last of 43 characters; the seal id is a hash of the
  // spelling, so one key could appear under several seal ids. Such an answer never counts, even when its id is "known".
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let respelledThatVerify = 0;
  for (const field of ["x", "y"]) for (const low of [1, 2, 3]) {
    const s = answers[0].publicJwk[field], last = B64.indexOf(s[42]);
    assert.equal(s.length, 43);
    assert.equal(last & 3, 0, "a key as the engine writes it ends in a character with two zero bits");
    const publicJwk = { ...answers[0].publicJwk, [field]: s.slice(0, 42) + B64[last | low] };
    const respelled = { ...answers[0], publicJwk, sealId: await SC.sealIdFromPublic(publicJwk) };
    assert.notEqual(respelled.sealId, ids[0], "another spelling, another seal id");
    const alone = await OW.verifyAnswer(respelled, wire);
    if (alone.ok) respelledThatVerify++;                     // this engine reads the respelled coordinate as the same key
    const q = await OW.witnessQuorum([respelled, answers[1]], wire, { known: [...ids, respelled.sealId] });
    assert.deepEqual(q, { met: false, need: 2, accepted: [ids[1]], rejected: [{ index: 0, failed: alone.ok ? "form" : "signature" }] }, `${field} respelled`);
    assert.deepEqual((await quorum([answers[0], respelled])).accepted, [ids[0]], "one key, one witness");
  }
  assert.ok(respelledThatVerify === 0 || respelledThatVerify === 6, `respelled keys verify alike in one engine (${respelledThatVerify} of 6 here)`);
  // other spellings of a key or a signature that Web Crypto reads as the same: padding, other alphabet, upper-case hex
  const spellings = [
    ["the signature in upper case", { ...answers[0], sig: answers[0].sig.toUpperCase() }],
    ["the signature with separators", { ...answers[0], sig: answers[0].sig.replace(/(..)/g, "$1:") }],
    ["the signature with a space first", { ...answers[0], sig: " " + answers[0].sig }],
    ["the signature with junk after it", { ...answers[0], sig: answers[0].sig + "zz" }],
  ];
  for (const [what, a] of spellings) {
    assert.equal((await OW.verifyAnswer(a, wire)).ok, true, what + ": verifyAnswer alone reads it as the same signature");
    assert.deepEqual(await quorum([a]), { met: false, need: 2, accepted: [], rejected: [{ index: 0, failed: "form" }] }, what);
  }
  for (const [what, change] of [["a key type that is not EC", (j) => { j.kty = "OKP"; }], ["a curve that is not P-256", (j) => { j.crv = "P-384"; }], ["no curve", (j) => { delete j.crv; }]]) {
    const publicJwk = clone(answers[0].publicJwk); change(publicJwk);
    const q = await OW.witnessQuorum([{ ...answers[0], publicJwk }], wire, { known: ids });
    assert.deepEqual([q.accepted, q.rejected.length], [[], 1], what);
    assert.ok(["form", "signature"].includes(q.rejected[0].failed), what);
  }

  // an unknown key: a good answer by a key the caller does not hold
  const stranger = (await OW.answerHyperpack(wire, await OW.newSessionKeys(), AT)).answer;
  assert.equal((await OW.verifyAnswer(stranger, wire)).ok, true);
  assert.deepEqual(await quorum([answers[0], stranger]), { met: false, need: 2, accepted: [ids[0]], rejected: [{ index: 1, failed: "unknown" }] });
  assert.deepEqual(await OW.witnessQuorum(answers, wire, { known: [] }), { met: false, need: 2, accepted: [], rejected: [0, 1, 2, 3].map((index) => ({ index, failed: "unknown" })) }, "with nothing known, nothing counts");
  // ten keys made in one loop are ten strangers
  const crowd = [];
  for (let i = 0; i < 10; i++) crowd.push((await OW.answerHyperpack(wire, await OW.newSessionKeys(), AT)).answer);
  assert.deepEqual((await quorum(crowd, { need: 1 })).accepted, []);

  // the sealer's own key never witnesses its own package, even if the caller lists it as known
  const own = (await OW.answerHyperpack(wire, sealer, AT)).answer;
  assert.equal(own.sealId, certificate.sealId);
  assert.equal((await OW.verifyAnswer(own, wire)).ok, true);
  assert.deepEqual(await OW.witnessQuorum([own, answers[0]], wire, { known: [...ids, certificate.sealId], exclude: [certificate.sealId] }),
    { met: false, need: 2, accepted: [ids[0]], rejected: [{ index: 0, failed: "sealer" }] });
  assert.deepEqual(await OW.witnessQuorum([own, answers[0]], wire, { known: ids, exclude: new Set([certificate.sealId]) }), { met: false, need: 2, accepted: [ids[0]], rejected: [{ index: 0, failed: "sealer" }] });
  assert.deepEqual((await OW.witnessQuorum([own, answers[0]], wire, { known: ids })).rejected, [{ index: 0, failed: "unknown" }], "without exclude it is one more unknown key");

  // an answer to another wire, and a refused answer
  const other = wire.replace('"to":"receiver"', '"to":"elsewhere"');
  assert.notEqual(other, wire);
  const elsewhere = (await OW.answerHyperpack(other, receivers[1], AT)).answer;
  assert.equal((await OW.verifyAnswer(elsewhere, other)).ok, true, "a good answer, to the other wire");
  assert.deepEqual(await quorum([answers[0], elsewhere]), { met: false, need: 2, accepted: [ids[0]], rejected: [{ index: 1, failed: "echo" }] });
  const damaged = wire.replace('"layer":"reading"', '"layer":"text"');
  const refusal = (await OW.answerHyperpack(damaged, receivers[1], AT)).answer;
  assert.match(refusal.line, /\|refused\|lexicon$/);
  assert.deepEqual(await OW.witnessQuorum([answers[0], refusal], damaged, { known: ids }), { met: false, need: 2, accepted: [], rejected: [{ index: 0, failed: "echo" }, { index: 1, failed: "refused" }] });
  // an edited answer, and things that are no answers
  const edited = { ...refusal, line: refusal.line.replace("|refused|lexicon", "|accepted|-") };
  assert.deepEqual((await OW.witnessQuorum([edited], damaged, { known: ids })).rejected, [{ index: 0, failed: "signature" }]);
  const junk = [null, undefined, {}, "x", 5, [], { format: "HANDSHAKE/1" }, { ...answers[0], publicJwk: null }, { ...answers[0], sig: 5 }, { ...answers[0], sealId: ids[1] }];
  assert.deepEqual(await quorum(junk), { met: false, need: 2, accepted: [], rejected: junk.map((_, index) => ({ index, failed: "signature" })) });
  // all of it at once: each answer is judged on its own, in order
  const mixed = await quorum([stranger, answers[2], own, elsewhere, answers[2], null, answers[3]], { need: 2 });
  assert.deepEqual(mixed, { met: true, need: 2, accepted: [ids[2], ids[3]],
    rejected: [{ index: 0, failed: "unknown" }, { index: 2, failed: "sealer" }, { index: 3, failed: "echo" }, { index: 4, failed: "repeat" }, { index: 5, failed: "signature" }] });

  // bad arguments throw, in fixed sentences
  for (const need of [0, -1, 1.5, "2", NaN, Infinity, null, [2], 2n]) await refusedAsync(() => quorum(answers, { need }), "need " + String(need), /^need is a whole number of at least 1$/);
  for (const known of [undefined, null, "S-x", 5, {}, [5], [ids[0], null], new Set([5]), new Map()])
    await refusedAsync(() => OW.witnessQuorum(answers, wire, { known }), "known " + String(known), /^known is the list of seal ids the caller already holds$/);
  await refusedAsync(() => OW.witnessQuorum(answers, wire), "no options", /^known is the list/);
  for (const options of [2, null, "x", [ids]]) await refusedAsync(() => OW.witnessQuorum(answers, wire, options), "options that are " + show(options), /^known is the list/);
  for (const exclude of [null, "S-x", 5, {}, [5]]) await refusedAsync(() => OW.witnessQuorum(answers, wire, { known: ids, exclude }), "exclude " + String(exclude), /^exclude is a list of seal ids$/);
  for (const list of [undefined, null, answers[0], "x", { length: 2 }]) await refusedAsync(() => OW.witnessQuorum(list, wire, { known: ids }), "answers " + String(list), /^answers is a list of HANDSHAKE\/1 answers$/);
  for (const sent of [undefined, null, JSON.parse(wire), [wire], new String(wire)]) await refusedAsync(() => OW.witnessQuorum(answers, sent, { known: ids }), "a wire that is a " + typeof sent, /^the wire that was sent is a string$/);
});

// ─── Phase 1: errors ─────────────────────────────────────────────────────────

test("Phase 1: every error thrown is a fixed plain sentence and never carries the input", async () => {
  const MARK = "ZQXJ", { pack, keys } = await small();
  const marked = OW.makeEntry("1", "said", "note", MARK, MARK);
  const attempts = [
    () => OW.treeLexiconOf(MARK), () => OW.treeLexiconOf([{ line: 5, name: MARK }]), () => OW.treeLexiconRoot(MARK), () => OW.treeEpochTexts([{ line: MARK }]), () => OW.treeEpochTexts(MARK),
    () => OW.treeLineage(MARK), () => OW.treeLineage([MARK, "x" + MARK]), () => OW.treeLineage([MARK, MARK]), () => OW.treeLineage([MARK + "\u{d800}"]), () => OW.treeLineage([MARK.repeat(20000)]),
    () => OW.growLexicon(null, [MARK]), () => OW.buildLexiconBundle(MARK), () => OW.buildLexiconBundle([marked, marked]), () => OW.buildLexiconBundle([marked], { at: [MARK] }),
    () => OW.buildLexiconBundle([marked], { onEpoch: MARK }), () => OW.buildLexiconBundle([{ line: MARK }]),
    () => OW.lexiconPackets([MARK]), () => OW.chainPackets(MARK), () => OW.chainPackets({ stream: MARK }), () => OW.chainPackets({ stream: [MARK] }), () => OW.entryPacketIndex(MARK, MARK), () => OW.entryPacketIndex([marked], [MARK]),
    () => OW.entriesOfPack(MARK), () => OW.entriesOfPack({ chain: MARK }),
    () => OW.glyphCells(MARK), () => OW.glyphHex(MARK), () => OW.glyphHex([{ on: MARK }]), () => OW.seedMirror(MARK), () => OW.seedMirror([MARK, 0, 0, 0]), () => OW.squareQuarters(MARK), () => OW.quarterParities(MARK.repeat(4)),
    () => OW.fourthFromThree(MARK, MARK, MARK),
    () => OW.witnessQuorum(MARK, MARK, { known: [] }), () => OW.witnessQuorum([], MARK, { known: MARK }), () => OW.witnessQuorum([], MARK, { known: [], need: MARK }), () => OW.witnessQuorum([], [MARK], { known: [] }),
    () => OW.witnessQuorum([], MARK, { known: [], exclude: MARK }),
    ...OW.LEXICON_TAMPERS.map((row) => () => row.apply(MARK, { newKeys: keys, at: AT })),
    () => OW.LEXICON_TAMPERS.at(-1).apply(pack, { newKeys: MARK, at: MARK }), () => OW.LEXICON_TAMPERS.at(-1).apply(pack, { newKeys: keys, at: [MARK] }),
  ];
  const seen = new Set();
  for (const [i, attempt] of attempts.entries()) {
    const message = await refusedAsync(async () => attempt(), "attempt " + (i + 1));
    assert.ok(!message.includes(MARK), "attempt " + (i + 1) + ": the message does not repeat the input");
    seen.add(message.replace(/^line \d+: /, "").replace(/^frame \d+: /, ""));
  }
  assert.ok(seen.size >= 22, `the different refusals have different sentences (${seen.size})`);
  // the verdicts of readHyperpack never carry the input either, whatever was refused
  for (const text of [MARK, `["${MARK}"]`, JSON.stringify({ ...pack, [MARK]: 1 }), JSON.stringify({ ...pack, chain: { ...pack.chain, [MARK]: MARK } }), JSON.stringify({ ...pack, route: { [MARK]: "\u{d800}" } })]) {
    const v = await OW.readHyperpack(text);
    assert.equal(v.failed, "parse");
    assert.ok(v.checks.every((c) => !c.detail.includes(MARK)));
  }
});
