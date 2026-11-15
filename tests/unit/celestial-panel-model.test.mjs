// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
// Library/Experimental_Systems/Celestial_Control_Panel/celestial-panel-model.js (the DOM-free model of the Celestial
// Control Panel). What is checked:
//   - the module: header, no document or window, every export documented in one line and listed in the module map;
//   - copy: all three lenses present and non-empty for every step and every object that needs them; every sentence has
//     a layer; every TEXT sentence is a slice of a verse row of ezekiel-1.js and links to that row; the voice rules;
//   - every object key stands on something that exists in scripts/celestial-core.js;
//   - every CHECKED number in the copy, recomputed here from the cores;
//   - the Stargazer strings keep the rules of 1.6 (16 words a sentence, none of the hard words);
//   - links: parseHash accepts every link the Lexicon Explorer emits and refuses junk; the links this page writes;
//   - state: the first run, the place, the day and time controls with their messages, the Moon buttons, the preset;
//   - the chart: projection, rings, great circles, dives, labels that never overlap, disclosure, hits, drags, flights,
//     the read-outs "three points fix the fourth" and the aberration line; random orders of actions;
//   - the Moon picture, the lab ("they turned not when they went"), the seal, the two dialogs.
// The Lexicon Explorer's model is loaded when it is there, so that each page's links are tried on the other's parser.
// Run: node --test tests/unit/celestial-panel-model.test.mjs   (about 2 seconds)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.env.OWL_TEST_ROOT || path.resolve(import.meta.dirname, "../..");
const load = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const MODEL = "Library/Experimental_Systems/Celestial_Control_Panel/celestial-panel-model.js";
const M = await load(MODEL);
const C = await load("scripts/celestial-core.js");
const H = await load("scripts/hyperbolic-moves.js");
const S = await load("scripts/strix-overwatch.js");
const KIT = await load("Library/Experimental_Systems/explorer-kit.js");
const LEX = await load("Library/Experimental_Systems/Lexicon_Explorer/ezekiel-1.js");
const SOURCE = readFileSync(path.join(ROOT, MODEL), "utf8");
// The other page's model, when it is there: its links are tried against this page's parser and the other way round.
const OTHER_PATH = "Library/Experimental_Systems/Lexicon_Explorer/lexicon-explorer-model.js";
const OTHER = existsSync(path.join(ROOT, OTHER_PATH)) ? await load(OTHER_PATH).catch(() => null) : null;

// ─── helpers ─────────────────────────────────────────────────────────────────

const LENSES = ["stargazer", "navigator", "holographer"];
const LAYERS = ["text", "said", "checked", "reading"];
const RAD = Math.PI / 180;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || "value"}: ${a} is not within ${tol} of ${b}`);
const isSentence = (x) => x !== null && typeof x === "object" && LAYERS.includes(x.layer) && typeof x.text === "string" && x.text.trim() !== "";
const NOW_MS = Date.UTC(2026, 10, 14, 18, 0, 0);
const SIZE = { w: 400, h: 400 };
const fresh = () => M.initialState({ nowMs: NOW_MS });
const atGreenwich = () => M.confirmDay(M.chooseSite(fresh(), "greenwich"));
const lit = (lens = "stargazer", dims = "2D") => M.setDims(M.setLens(M.setStep(atGreenwich(), 3), lens), dims);
const kebar = (lens = "navigator") => M.initialState({ hash: "#preset=ezekiel&lens=" + lens, nowMs: NOW_MS });
const VERSES = new Map(LEX.ROWS.filter((r) => r[1] === "text" && r[2] === "verse").map((r) => [r[0], r]));
const unquoted = (s) => s.replace(/“[^”]*”/g, "“”");
/** A small seeded generator, so that a failure can be repeated. */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Every { layer, text } of the copy tables, with a name for messages. */
function allSentences() {
  const out = [], add = (where, x) => out.push({ where, ...x });
  for (const s of M.STEPS) {
    for (const l of LENSES) {
      s.say[l].forEach((p, i) => add(`${s.key} say ${l} ${i}`, p));
      add(`${s.key} reading ${l}`, s.bridge.reading[l]);
      if (s.bridge.opening) add(`${s.key} opening ${l}`, s.bridge.opening[l]);
    }
    s.bridge.stands.forEach((x, i) => { add(`${s.key} stand ${i}`, { layer: x.layer, text: x.text }); if (x.stargazer) add(`${s.key} stand ${i} stargazer`, { layer: x.layer, text: x.stargazer }); if (x.note) add(`${s.key} stand ${i} note`, x.note); });
  }
  for (const o of M.OBJECTS) if (o.text) for (const l of LENSES) o.text[l].forEach((p, i) => add(`object ${o.key} ${l} ${i}`, p));
  for (const l of LENSES) { add(`first run say ${l}`, M.FIRST_RUN.say[l]); add(`moon check ${l}`, M.MOON_COPY.check[l]); add(`seal witness ${l}`, M.SEAL_COPY.witness[l]); add(`seal about ${l}`, M.SEAL_COPY.about[l]); add(`opening ${l}`, M.BRIDGE_OPENING[l]); }
  add("first run questions", M.FIRST_RUN.threeQuestions); add("first run card", M.FIRST_RUN.card); add("first run after", M.FIRST_RUN.afterDefault);
  add("moon computed", M.MOON_COPY.computed); add("seal privacy", M.SEAL_COPY.privacy); add("seal kebar", M.SEAL_COPY.kebar);
  M.CERTIFIED.forEach((p, i) => add(`certified ${i}`, p)); add("certified stargazer", M.CERTIFIED_STARGAZER);
  for (const k of ["site", "derived", "older", "noHour", "stargazer"]) add(`ezekiel ${k}`, M.EZEKIEL_COPY[k]);
  add("dialog first", M.DIALOG.first); M.DIALOG.inShort.forEach((p, i) => add(`dialog short ${i}`, p));
  for (const sec of M.DIALOG.sections) sec.items.forEach((p, i) => add(`dialog ${sec.heading} ${i}`, p));
  add("blueprint badge", M.BLUEPRINT.badge);
  M.BLUEPRINT.pillars.forEach((p, i) => add(`pillar ${i}`, p.text)); M.BLUEPRINT.shells.forEach((p, i) => add(`shell ${i}`, p.text)); M.BLUEPRINT.lenses.forEach((p, i) => add(`lens card ${i}`, p.text));
  return out;
}
const copyText = (where) => { const s = allSentences().find((x) => x.where === where); assert.ok(s, `no sentence called ${where}`); return s.text; };

// ─── the module ──────────────────────────────────────────────────────────────

test("module: header, DOM-free, every export documented and mapped", () => {
  const lines = SOURCE.split("\n");
  assert.equal(lines[0], "// SPDX-License-Identifier: MIT");
  assert.equal(lines[1], "// Copyright (c) 2026 Ebayednoob");
  assert.ok(!SOURCE.includes("`"), "no template literal at all (so none can hold markup)");
  const code = lines.filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join("\n");
  assert.ok(!/\b(document|window|navigator|globalThis)\s*\./.test(code), "no document, window or navigator");
  for (const name of ["esc", "escapeHtml", "escapeAttr", "escHtml", "escAttr", "escapeHTML", "jsArg"]) assert.ok(!new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(code), name);
  // the imports: the three cores, the kit and the verse rows; nothing else
  const imports = [...SOURCE.matchAll(/from "([^"]+)";/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["../../../scripts/strix-overwatch.js", "../../../scripts/hyperbolic-moves.js", "../../../scripts/celestial-core.js", "../explorer-kit.js", "../Lexicon_Explorer/ezekiel-1.js"]);
  // every export has a doc comment right above it, and stands in the map at the top
  const map = SOURCE.slice(0, SOURCE.indexOf("// CONVENTIONS"));
  const names = [];
  lines.forEach((line, i) => {
    const m = /^export (?:async )?(?:const|function) ([A-Za-z_$][\w$]*)/.exec(line);
    if (!m) return;
    names.push(m[1]);
    assert.ok(/\*\/\s*$/.test(lines[i - 1]), `export ${m[1]} has no doc comment above it`);
    assert.ok(new RegExp(`(?<![\\w$])${m[1]}(?![\\w$])`).test(map), `export ${m[1]} is not in the module map`);
  });
  assert.deepEqual([...names].sort(), Object.keys(M).sort(), "the exports found in the source are the module's exports");
  assert.ok(names.length >= 120);
});

test("lists: page, lenses, steps, overlays, places", () => {
  assert.deepEqual({ ...M.PAGE }, { title: "Celestial Control Panel", subtitle: "Celestial Holography: a Poincaré ball explorer" });
  assert.deepEqual({ ...M.LENS_HINTS }, { stargazer: "ages 6 and up", navigator: "astronomy", holographer: "physics" });
  assert.deepEqual(M.visibleSteps("stargazer").map((s) => s.title), ["My place", "My day and Moon", "Look around", "Slide the map", "Stamp it"]);
  assert.deepEqual(M.visibleSteps("navigator").map((s) => s.title), ["Earth", "Sun and Moon", "Project", "Dive", "Seal"]);
  assert.deepEqual(M.STEPS.map((s) => s.key), [...M.STEP_KEYS]);
  assert.deepEqual(M.STEPS.map((s) => s.n), [1, 2, 3, 4, 5]);
  assert.deepEqual(M.OVERLAYS.map((o) => o.key), ["rings", "horizon", "equator", "ecliptic", "galactic", "sightLines"]);
  for (const o of M.OVERLAYS) if (o.circle) assert.ok(C.FRAMES.includes(o.circle) && typeof o.words === "string" && o.words.includes("crosses"));
  assert.equal(M.OVERLAYS.find((o) => o.key === "ecliptic").words, "the Sun's path crosses this map here");
  assert.deepEqual(M.FRAME_CHOICES.map((f) => f.key), ["hor", "gal"]);
  assert.ok(M.FRAME_CHOICES[0].caption.startsWith("a flat map of direction round the plane and of depth; height above the plane is not shown; seen from above: north up, east right"));
  assert.deepEqual(M.QUICK.map((q) => q.key), ["home", "moon", "sun", "sgr_a_star", "rim"]);
  assert.deepEqual(M.TIME_BUTTONS.map((b) => b.label), ["Now", "Sunrise", "Noon", "Sunset", "Midnight"]);
  // the Kebar is reached by preset or link only; every other preset is offered, with its country in the label
  const choices = M.siteChoices();
  assert.equal(choices.length, C.SITES.length - 1);
  assert.ok(!choices.some((s) => s.key === "kebar"));
  for (const s of choices) assert.ok(s.label.includes(","), s.label);
  assert.equal(M.siteOf("kebar").lat, 32.13);
  assert.equal(M.siteOf("nowhere"), null);
  assert.equal(M.FIRST_RUN.defaultSite, "greenwich");
  assert.ok(M.siteOf(M.FIRST_RUN.defaultSite));
});

// ─── copy ────────────────────────────────────────────────────────────────────

test("copy: every sentence has a layer and words; all three lenses for every step and every object that needs them", () => {
  for (const s of allSentences()) assert.ok(isSentence(s), `${s.where} is not a { layer, text }`);
  for (const s of M.STEPS) {
    assert.ok(s.title && s.stargazerTitle, s.key);
    for (const l of LENSES) {
      assert.ok(typeof s.question[l] === "string" && s.question[l].endsWith("?"), `${s.key} question ${l}`);
      assert.ok(Array.isArray(s.say[l]) && s.say[l].length >= 1, `${s.key} say ${l}`);
      assert.equal(s.bridge.reading[l].layer, "reading");
      const view = M.stepView(s.key, l);
      assert.ok(view && view.say.length >= 1 && isSentence(view.bridge.reading) && view.bridge.stands.length >= 2, `${s.key} ${l}`);
      assert.deepEqual(M.stepView(s.n, l), view);
    }
    // the Stargazer paragraph is its own, not the Navigator's
    assert.notEqual(s.say.stargazer.map((p) => p.text).join(" "), s.say.navigator.map((p) => p.text).join(" "));
    assert.notEqual(s.bridge.reading.stargazer.text, s.bridge.reading.navigator.text);
    assert.notEqual(s.bridge.reading.navigator.text, s.bridge.reading.holographer.text);
    // "What it stands on" holds TEXT, SAID and CHECKED sentences only
    for (const x of s.bridge.stands) assert.ok(["text", "said", "checked"].includes(x.layer), `${s.key}: a ${x.layer} stand`);
    assert.ok(s.bridge.stands.some((x) => x.layer === "text") && s.bridge.stands.some((x) => x.layer === "checked"), s.key);
  }
  assert.equal(M.stepView("nowhere", "stargazer"), null);
  assert.equal(M.stepView(6, "stargazer"), null);
  // three-lens paragraphs for the eight bodies and for the microwave background
  const needs = ["moon", "sun", "pleiades", "polaris", "vela_pulsar", "cyg_x1", "sgr_a_star", "m31", "cmb"];
  for (const key of needs) {
    const o = M.objectOf(key);
    assert.ok(o && o.text, key);
    for (const l of LENSES) assert.ok(o.text[l].length >= 1 && o.text[l].every(isSentence), `${key} ${l}`);
    assert.notEqual(o.text.stargazer[0].text, o.text.navigator[0].text, key);
    assert.notEqual(o.text.navigator.map((p) => p.text).join(" "), o.text.holographer.map((p) => p.text).join(" "), key);
  }
  assert.deepEqual(M.OBJECTS.filter((o) => o.kind === "body").map((o) => o.key), needs.slice(0, 8));
  // the rim objects, each with its fixed status badge
  const status = (key) => { const o = M.objectOf(key); return o.status.layer + ": " + o.status.note; };
  assert.equal(status("celestial_sphere"), "checked: geometry");
  assert.equal(status("antipode"), "checked: geometry");
  assert.equal(status("holography"), "said: a proposal");
  assert.equal(status("shadow"), "said: a proposal");
  assert.equal(status("memory"), "said: predicted, not detected");
  assert.equal(status("cmb"), "said: measured");
  assert.equal(M.objectOf("shadow").minLens, "holographer");
  assert.ok(M.objectOf("antipode").text.navigator.some((p) => p.layer === "said" && p.text.startsWith("Strominger (2017, section 2.4) writes: “If we take a light ray which crosses Minkowski space")));
  // the rim rows are the core's own sentences
  const rows = new Map(C.skyLexiconRows(C.skyState(M.EZEKIEL_PRESET.jdUt, 32.13, 45.23)).map((r) => [r[0], r[4]]));
  assert.equal(M.objectOf("celestial_sphere").text.navigator[0].text, rows.get("4.2"));
  assert.equal(M.objectOf("holography").text.navigator[0].text, rows.get("4.3"));
  assert.equal(M.objectOf("memory").text.navigator[0].text, rows.get("4.4"));
  assert.ok(rows.get("4.3").includes("proposes a duality") && rows.get("4.4").startsWith("Predicted, not detected."));
});

test("copy: every TEXT sentence is a slice of a verse row, never re-typed, and links to its row", () => {
  const want = new Map([
    ["earth", ["as I was among the captives by the river of Chebar"]],
    ["sun-moon", ["in the fourth month, in the fifth day of the month"]],
    ["project", ["a whirlwind came out of the north", "the heavens were opened", "lo, the heavens were opened unto him", "Hereafter ye shall see heaven open, and the angels of God ascending and descending upon the Son of man."]],
    ["dive", [VERSES.get("26.1.12")[4]]],
    ["seal", ["that in the mouth of two or three witnesses every word may be established."]],
  ]);
  let count = 0;
  for (const s of M.STEPS) {
    const texts = s.bridge.stands.filter((x) => x.layer === "text");
    assert.deepEqual(texts.map((x) => x.text), want.get(s.key), s.key);
    for (const x of texts) {
      count += 1;
      const row = VERSES.get(x.source);
      assert.ok(row, `${s.key}: ${x.source} is not a verse row`);
      assert.ok(x.text.length >= 12 && row[4].includes(x.text), `${s.key}: not a substring of ${x.source}`);
      assert.ok(x.name.endsWith(", King James Version") && x.name.startsWith(row[3].replace(/ \((context|opening words)\)$/, "")), x.name);
      assert.equal(x.stargazer, null);
    }
    for (const l of LENSES) for (const v of M.stepView(s.key, l).bridge.stands.filter((x) => x.layer === "text")) {
      assert.equal(v.href, "../Lexicon_Explorer/index.html#entry=" + v.source + "&lens=" + l);
      assert.ok(KIT.isAllowedUrl(v.href));
    }
  }
  assert.equal(count, 8);
  // no TEXT sentence anywhere else in the copy, except the legend's line about the TEXT layer
  for (const s of allSentences()) if (s.layer === "text") assert.ok(/ stand \d+$/.test(s.where) || s.where === "dialog The four layers 0", s.where);
  // verseSlice cuts and never invents
  assert.equal(M.verseSlice("26.1.9", "they turned", "went"), "they turned not when they went");
  assert.equal(M.verseSlice("26.1.9"), VERSES.get("26.1.9")[4]);
  assert.equal(M.verseSlice("26.1.9", "no such words", "went"), VERSES.get("26.1.9")[4]);
  assert.equal(M.verseSlice("26.1.1.5"), "", "a term row is not a verse");
  assert.equal(M.verseSlice("99.1.1"), "");
  // the source never holds a verse: the longest run of a verse row's words in the module is short
  for (const [address, row] of VERSES) {
    const words = row[4].split(" ");
    for (let i = 0; i + 8 <= words.length; i++) assert.ok(!SOURCE.includes(words.slice(i, i + 8).join(" ")), `eight words of ${address} are typed in the module`);
  }
  // SAID sentences taken from lexicon rows are those rows' words
  const row = (a) => LEX.ROWS.find((r) => r[0] === a)[4];
  assert.ok(row("26.1.1.5.8").startsWith(copyText("project stand 4")));
  assert.ok(copyText("project stand 4").startsWith("A search of the Project Gutenberg King James e-text made for this project (November 2026) found"));
  assert.equal(copyText("project stand 5"), row("26.1.1.5.9"));
  assert.ok(copyText("project stand 5").startsWith("A Christian reading of a Jewish prophet's book: Origen, in his first homily on Ezekiel (section 4), sets"));
  assert.equal(M.EZEKIEL_COPY.derived.text, row("26.1.1.2.4"));
  assert.equal(M.EZEKIEL_COPY.older.text, C.EZEKIEL_DATES_NOTE);
  assert.equal(M.EZEKIEL_COPY.noHour.text, "The book gives no hour.");
  assert.equal(M.EZEKIEL_COPY.site.text, C.SITES[0].note);
});

test("copy: the bridge, the voice of each kind of box, and the sensitive points", () => {
  assert.equal(M.BRIDGE_TITLE, "THE BRIDGE");
  assert.deepEqual({ ...M.BRIDGE_PARTS }, { reading: "Our reading", stands: "What it stands on" });
  const opening = "First Explorers drew its bridge as the line through the zero point at right angles to the map of peoples, and read Jesus of Nazareth as that line. On this page the map is your horizon and that line is your straight-up line. Ezekiel, among the captives, writes that the heavens were opened over the place where he stood. The gold boxes follow that line from his river to John 3:16. This is our reading; no check depends on it, and the word bridge is not in the King James Bible.";
  assert.equal(M.BRIDGE_OPENING.navigator.text, opening);
  assert.equal(M.BRIDGE_OPENING.holographer.text, opening);
  assert.ok(M.BRIDGE_OPENING.stargazer.text.endsWith("This is our reading, and no check depends on it. The word bridge is not in the King James Bible."));
  // the bridge is stated once: only the first box opens with it
  assert.deepEqual(M.STEPS.map((s) => !!s.bridge.opening), [true, false, false, false, false]);
  assert.equal(M.stepView(1, "navigator").bridge.opening.text, opening);
  assert.equal(M.stepView(2, "navigator").bridge.opening, null);
  for (const s of M.STEPS) {
    for (const l of LENSES) {
      const r = s.bridge.reading[l].text;
      // OUR IDEA: a named subject, no instruction to the visitor, room left for another view
      assert.match(r, /^(We |One seal )/, `${s.key} ${l}`);
      assert.ok(r.endsWith("You may see it another way."), `${s.key} ${l} leaves room`);
      assert.ok(M.sentencesOf(r).length <= (l === "stargazer" ? 3 : 5), `${s.key} ${l} is short`);
    }
    for (const x of s.bridge.stands) {
      // CHECKED: the verb first, then an invitation where the visitor can repeat it
      if (x.layer === "checked") {
        assert.match(x.text, /^(Computed|Counted|Certified)[:,]/, `${s.key}: ${x.text.slice(0, 40)}`);
        if (x.stargazer) assert.match(x.stargazer, /^(Worked out|Counted|Slide forward|The stamp shows)/, `${s.key}: ${x.stargazer.slice(0, 40)}`);
      }
      // SAID: a named speaker who says, writes, reports or found; none of the arguing words in the page's own voice
      if (x.layer === "said") for (const t of [x.text, x.stargazer].filter(Boolean)) {
        assert.match(t, /\b(writes?|wrote|sets?|found|pictured|says?|reports?)\b/, t.slice(0, 50));
        assert.ok(!/\b(but|however|in fact|actually)\b/i.test(unquoted(t)), t.slice(0, 50));
      }
    }
  }
  // every SAID sentence of the objects names its speaker or its source
  for (const o of M.OBJECTS) if (o.text) for (const l of LENSES) for (const p of o.text[l]) if (p.layer === "said") {
    assert.match(p.text, /\b(19|20)\d\d\b|astronomers|physicist|teams|Astronomers|Einstein's theory|The pole of the galactic frame|J2000 position from/, `${o.key} ${l}: ${p.text.slice(0, 50)}`);
    assert.ok(!/\b(however|in fact|actually)\b/i.test(unquoted(p.text)), `${o.key} ${l}`);
  }
  // van Paassen: the sentence as the scan has it, marked as his picture and not a record
  const vp = M.STEPS[0].bridge.stands[1];
  assert.ok(vp.text.includes("“Lying awake at night on the roof of his father’s house in Nazareth, looking up at the stars running in their appointed courses”"));
  assert.ok(vp.text.startsWith("Pierre van Paassen, in Why Jesus Died (1949), writes of the young Jesus:"));
  assert.deepEqual({ ...vp.note }, { layer: "reading", text: "That is his picture of the young Jesus, not a record." });
  assert.ok(M.STEPS[1].bridge.stands[1].text.includes("“lunar months, which began when the thin crescent of the new moon was first visible in the sky at sunset”"));
  // step 5 links back to First Explorers and on to the Lexicon Explorer
  const links = M.stepView(5, "holographer").bridge.links;
  assert.deepEqual(links.map((k) => k.href), ["../First_Explorers/index.html", "../Lexicon_Explorer/index.html#entry=43.3.16&lens=holographer"]);
  for (const k of links) assert.ok(KIT.isAllowedUrl(k.href));
  assert.equal(LEX.HANDLES.john316, "43.3.16");
  // things the page never says
  const everything = allSentences().map((s) => s.text).join("\n") + "\n" + M.stargazerStrings().map((s) => s.text).join("\n");
  for (const banned of ["delivered to the Jews", "space shrinks", "Space shrinks", "orbits it", "pole star in 593", "kitchen blender", "Millisecond Timing", "the vision happened", "proves", "nursery"]) assert.ok(!everything.includes(banned), banned);
  assert.ok(!/\bJews\b/.test(everything.replace("the Jewish people", "")), "no sentence about the Jews as a group");
  assert.ok(!/these bytes/.test(M.stargazerStrings().map((s) => s.text).join("\n")), "never \"these bytes\" at Stargazer");
  // every date sentence about the fifth day is conditional or attributed
  assert.ok(copyText("sun-moon stand 2").startsWith("Computed, if the day is placed on the conventional date:"));
  assert.ok(copyText("sun-moon stand 2 stargazer").startsWith("Worked out: if that date is right,"));
  // proposals stay proposals
  assert.ok(M.objectOf("holography").text.stargazer[0].text.includes("Nobody knows yet"));
  assert.ok(M.objectOf("memory").text.stargazer[0].text.includes("still trying to catch this"));
});

test("objects: every key stands on something in celestial-core.js", () => {
  const keys = M.OBJECTS.map((o) => o.key);
  assert.equal(new Set(keys).size, keys.length);
  const anchors = C.ANCHORS.map((a) => a.key), rings = C.RINGS.map((r) => r.key);
  for (const o of M.OBJECTS) {
    assert.ok(["body", "direction", "rim", "ring"].includes(o.kind), o.key);
    assert.ok(typeof o.glyph === "string" && [...o.glyph].length === 1 && !"■●✓◆".includes(o.glyph), `${o.key}: a glyph that is not a layer shape`);
    assert.ok(o.label && o.short && o.stargazer, o.key);
    assert.match(o.key, /^[A-Za-z0-9._-]+$/, "a key fits the link alphabet");
    const c = o.core;
    if (o.kind === "body") { assert.equal(c.body, o.key); assert.ok(C.BODIES.includes(o.key) && (o.key === "sun" || o.key === "moon" || anchors.includes(o.key)), o.key); }
    if (c.body) assert.ok(C.BODIES.includes(c.body), `${o.key}: ${c.body}`);
    if (c.frame) { assert.ok(C.FRAMES.includes(c.frame)); near(Math.hypot(...c.axis), 1, 1e-12); }
    if (c.ring) assert.ok(rings.includes(c.ring), `${o.key}: ${c.ring}`);
    assert.ok(c.body || c.frame || c.ring || c.selection, `${o.key} stands on nothing`);
    if (o.frames) for (const f of o.frames) assert.ok(C.FRAMES.includes(f));
    assert.ok(["place", "day", "sky"].includes(o.lit));
  }
  // the bodies with a distance are exactly the core's, and the rings are the core's rings
  assert.deepEqual(M.OBJECTS.filter((o) => o.kind === "body").map((o) => o.key).sort(), C.BODIES.filter((k) => C.bodyLightSeconds(C.skyState(2461000, 0, 0), k) !== null).sort());
  assert.deepEqual(M.OBJECTS.filter((o) => o.kind === "ring").map((o) => o.key), rings.slice(0, -1));
  assert.equal(M.objectOf("cmb").core.ring, rings[rings.length - 1]);
  assert.deepEqual(M.OBJECTS.filter((o) => o.kind === "direction" && o.frames.includes("hor")).map((o) => o.key), ["zenith", "north", "east", "south", "west"]);
  assert.deepEqual(M.OBJECTS.filter((o) => o.kind === "direction" && o.frames.includes("gal")).map((o) => o.key), ["galactic_centre", "ngp"]);
  assert.deepEqual(M.OBJECTS.filter((o) => o.kind === "rim").map((o) => o.key), ["celestial_sphere", "antipode", "holography", "shadow", "memory", "cmb"]);
  // labels are the core's labels for the anchors
  for (const a of C.ANCHORS) if (a.distanceLy !== null) assert.equal(M.objectOf(a.key).label, a.label);
  // directions are what the core computes
  const st = lit("navigator"), sky = M.skyOf(st);
  for (const key of ["moon", "sun", "polaris", "m31"]) assert.deepEqual(M.objectDirection(st, key), C.bodyDirection(sky, key, "hor"));
  M.objectDirection(st, "north").forEach((x, i) => near(x, [0, 1, 0][i], 1e-12));
  M.objectDirection(st, "east").forEach((x, i) => near(x, [1, 0, 0][i], 1e-12));
  near(M.objectDirection(st, "zenith")[2], 1, 1e-12);
  const nep = C.bodyDirection(sky, "nep", "hor"), ngp = C.bodyDirection(sky, "ngp", "hor");
  assert.deepEqual(M.objectDirection(st, "holography"), nep);
  assert.deepEqual(M.objectDirection(st, "memory"), ngp.map((x) => -x));
  assert.deepEqual(M.objectDirection(M.setLens(st, "holographer"), "shadow"), nep.map((x) => -x));
  for (const key of ["moon", "sun", "pleiades", "m31"]) near(M.objectRho(st, key), C.depthRho(C.bodyLightSeconds(sky, key)), 1e-12, key);
  assert.equal(M.objectRho(st, "north"), Infinity);
  assert.equal(M.objectRho(st, "cmb"), C.RINGS[C.RINGS.length - 1].rho);
});

test("checked numbers: every one in the copy is recomputed from the cores", () => {
  const F = M.COPY_FACTS;
  const site = (k) => C.SITES.find((s) => s.key === k), keb = site("kebar"), naz = site("nazareth");
  // the Kebar and Nazareth
  const bd = C.bearingAndDistance(naz.lat, naz.lonEast, keb.lat, keb.lonEast);
  assert.deepEqual({ ...F.kebar }, { latitudeApart: 0.57, minutesApart: 40, bearing: 91, km: 934 });
  near(Math.abs(keb.lat - naz.lat), 0.57, 1e-9); near((keb.lonEast - naz.lonEast) * 4, 40, 0.5); near(bd.bearing, 91, 0.5); near(bd.km, 934, 0.5);
  // the sidereal clock agrees: the same star crosses the two meridians 39.6 minutes apart
  near(((keb.lonEast - naz.lonEast) / 360) * 23.9344696 * 60, 40, 0.5);
  const s1 = copyText("earth stand 2");
  for (const piece of ["0.57° apart in latitude", "40 minutes apart", "bearing 91°, 934 km"]) assert.ok(s1.includes(piece), piece);
  assert.ok(copyText("earth stand 2 stargazer").includes("40 minutes apart"));
  // the Moon on the published dates
  const litAt = (parts) => 100 * C.skyState(C.sunEventOnLocalDay(parts, keb.lat, keb.lonEast, "set"), keb.lat, keb.lonEast).phase.illuminatedFraction;
  const expect = [[40, 50], [33, 44], [38, 48]];
  C.EZEKIEL_DATES.forEach((d, i) => {
    assert.equal(Math.round(litAt(d.beginsDay)), expect[i][0], d.key);
    assert.equal(Math.round(litAt(d.endsDay)), expect[i][1], d.key);
    assert.deepEqual([F.moon[i].begins, F.moon[i].ends], expect[i]);
  });
  const sunset = C.sunEventOnLocalDay(C.EZEKIEL_DATES[0].endsDay, keb.lat, keb.lonEast, "set");
  const firstQuarter = C.nextPhaseTime(sunset - 2, 90);
  near((sunset - firstQuarter) * 1440, 11.9, 0.5, "first quarter before sunset, minutes");
  assert.equal(F.firstQuarterMinutes, 12);
  near(C.deltaTSigma(C.decimalYear(sunset)) / 60, 8, 0.5, "the clock allowance, minutes");
  assert.equal(F.clockMinutes, 8);
  const s2 = copyText("sun-moon stand 2");
  for (const piece of ["from 40 % lit at the sunset that began the day (30 July 593 BC) to 50 % at the sunset that ended it (31 July)", "about 12 minutes before that second sunset, give or take 8 minutes for the clock and a day for the calendar tables", "from 33 to 44 % and from 38 to 48 %"]) assert.ok(s2.includes(piece), piece);
  assert.equal(F.yearsApart, 2600);
  near(M.PAGE_YEAR - C.EZEKIEL_DATES[0].endsDay.year, 2600, 50);
  for (const l of LENSES) assert.ok(M.STEPS[1].bridge.reading[l].text.includes("2,600 years"), l);
  // four slides, the tile, five slides
  const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const four = H.homecoming(H.slidePath(dirs.map((angle) => ({ angle, dist: 1 })))[4]);
  near(four.distance, 0.874463, 1e-6); near(four.turnClockwise / RAD, 78.0148, 1e-4);
  near(H.squareWalkGap(1), four.distance, 1e-12); near(H.squareWalkTurn(1), four.turnClockwise, 1e-12);
  assert.deepEqual({ ...F.slides }, { gap: 0.87, turnDeg: 78 });
  assert.equal(copyText("dive stand 1 stargazer"), "Slide forward, left, back and right, one step each, and never turn. On a flat floor you would be home. Here you end 0.87 of a step from home. Slide straight home. Now you face almost a quarter turn to the right (78 degrees). No slide turned you. This is true of the curved map, not of the sky.");
  assert.ok(copyText("dive stand 1").includes("ends 0.87 from home, and the slide home leaves the walker turned 78° to the right"));
  const t45 = H.tilingConstants(4, 5);
  near(t45.side, 1.253739, 5e-7); assert.equal(F.tile.side, 1.253739); assert.equal(M.LAB.tile, t45.side);
  const round = H.homecoming(H.slidePath([0, 108, 216, 324].map((d) => ({ angle: d * RAD, dist: t45.side })))[4]);
  assert.ok(round.distance < 1e-9); near(round.turnClockwise / RAD, 72, 1e-6); near(round.turnClockwise, t45.area, 1e-9);
  assert.deepEqual({ ...F.tile }, { side: 1.253739, turnDeg: 72, meet: 5 });
  near(H.rightAngledPolygonSide(5), 1.061275, 5e-7); assert.equal(F.fiveSide, 1.061275);
  // the squeezed map
  const year = Array.from({ length: 73 }, (_, i) => C.skyState(C.jdFromParts({ year: 2026, month: 1, day: 1 }) + 5 * i, 0, 0));
  const ratios = year.map((s) => s.sun.lightSeconds / s.moon.lightSeconds), mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  assert.ok(mean > 350 && mean < 450, `the Sun is about 400 times farther than the Moon (mean ${mean})`);
  assert.equal(F.sunMoonRatio, 400);
  for (const s of year) assert.ok(Math.tanh(C.depthRho(s.sun.lightSeconds) / 2) / Math.tanh(C.depthRho(s.moon.lightSeconds) / 2) < 2, "drawn less than twice as far out");
  assert.ok(F.drawnRatio < 2 && F.drawnRatio > 1);
  assert.equal(copyText("project say stargazer 1"), "The Sun is about 400 times farther than the Moon. Yet it is drawn less than twice as far out.");
  assert.deepEqual(M.STEPS[2].say.stargazer.map((p) => p.text).join(" "), "This is a squeezed map. Near things sit near the middle, far things near the edge. The Sun is about 400 times farther than the Moon. Yet it is drawn less than twice as far out. Only the map is squeezed. Space is not.");
  // the disc radii of 4.3
  const sky0 = C.skyState(sunset, keb.lat, keb.lonEast);
  const want = { moon: 0.25, sun: 0.41, pleiades: 0.73, polaris: 0.73, vela_pulsar: 0.74, cyg_x1: 0.77, sgr_a_star: 0.78, m31: 0.83, cmb: 0.90 };
  for (const [k, r] of Object.entries(want)) {
    const rho = k === "cmb" ? C.RINGS[C.RINGS.length - 1].rho : C.depthRho(C.bodyLightSeconds(sky0, k));
    near(Math.tanh(rho / 2), r, 0.005, k); assert.equal(F.radii[k], r, k);
  }
  assert.ok(copyText("project say holographer 0").startsWith("Depth is ρ = 0.5 + 0.135 · log10(distance in light-seconds), drawn at disc radius tanh(ρ/2). " + C.DEPTH_WORDING));
  assert.equal(C.DEPTH.rho0, 0.5); assert.equal(C.DEPTH.kappa, 0.135);
  assert.equal(copyText("project say navigator 0"), C.CHART_WORDING);
  // Polaris
  const now = C.skyState(C.jdFromParts({ year: 2026, month: 7, day: 1 }), 51.4769, 0);
  near(now.anchors.polaris.poleDistance, 0.6, 0.05); near(sky0.anchors.polaris.poleDistance, 15.0, 0.05);
  assert.deepEqual({ ...F.polaris }, { now: 0.6, then: 15 });
  assert.ok(copyText("object polaris navigator 0").includes("0.6° from the north celestial pole today and was 15.0° from it in 593 BC"));
  assert.ok(copyText("object polaris stargazer 0").includes("less than 1 degree") && copyText("object polaris stargazer 0").includes("15 degrees away"));
  // the Moon's two months
  let t = C.nextPhaseTime(2451550.1, 0); const first = t;
  for (let i = 0; i < 223; i++) t = C.nextPhaseTime(t + 1, 0);
  near((t - first) / 223, 29.53, 0.005, "the month of the phases");
  const lam = (jd) => C.moonPosition(C.jdeFromJdUt(jd)).lambda;
  let turns = 0, last = lam(2451550.1), sum = 0;                       // follow the Moon round the sky for ten years, half a day at a time
  for (let jd = 2451550.6; jd <= 2451550.1 + 3652.5; jd += 0.5) { const l = lam(jd); sum += ((l - last + 540) % 360) - 180; last = l; turns += 1; }
  near(360 / (sum / (turns * 0.5)), 27.32, 0.005, "once round the sky");
  assert.deepEqual({ ...F.months }, { synodic: 29.53, sidereal: 27.32 });
  assert.ok(copyText("object moon navigator 0").includes("repeat every 29.53 days on average; the Moon goes once round the sky in 27.32 days"));
  assert.ok(copyText("object moon stargazer 0").includes("about every 27 days") && copyText("object moon stargazer 0").includes("29 and a half days"));
  // the Sun
  near(now.obliquity, 23.4, 0.05); assert.equal(F.obliquity, 23.4);
  assert.ok(copyText("object sun navigator 0").includes("tilted 23.4° to the celestial equator"));
  const dLambda = C.norm180(C.skyState(now.jdUt + 1, 51.4769, 0).sun.lambda - now.sun.lambda);
  near(dLambda, 1, 0.06, "about 1° a day");
  near(C.LIGHT_SECONDS_PER_AU, 499, 0.5); near(C.LIGHT_SECONDS_PER_AU / 60, 8, 0.5);
  assert.equal(F.auLightSeconds, 499); assert.equal(F.sunLightMinutes, 8);
  assert.ok(copyText("object sun stargazer 0").includes("about 8 minutes") && copyText("object sun holographer 0").includes("499 light-seconds"));
  // Sagittarius A*, Andromeda, the Pleiades, Vela
  const g = now.anchors.sgr_a_star;
  near(g.galL, 359.94, 0.005); near(g.galB, -0.05, 0.005); near(60 * Math.hypot(g.galL - 360, g.galB), 4, 0.5);
  assert.ok(copyText("object sgr_a_star navigator 2").includes("galactic longitude 359.94°, latitude −0.05°, 4 arcminutes"));
  const anchor = (k) => C.ANCHORS.find((a) => a.key === k);
  near(anchor("m31").distanceLy / 1e6, 2.48, 0.005); near(anchor("m31").distanceLy / anchor("sgr_a_star").distanceLy, 93, 0.5);
  assert.ok(copyText("object m31 navigator 1").includes("2.48 million light-years, 93 times"));
  near(now.anchors.pleiades.eclLat, 4, 0.5);
  let widest = 0;                                                      // the Moon strays this far north of the ecliptic: far enough to reach the Pleiades
  for (let jd = 2451545; jd < 2451545 + 6800; jd += 2) widest = Math.max(widest, C.moonPosition(C.jdeFromJdUt(jd)).beta);
  assert.ok(widest > now.anchors.pleiades.eclLat && widest < 5.4, `the Moon reaches ${widest}° north`);
  assert.ok(copyText("object pleiades navigator 1").includes("lies 4° north of the ecliptic"));
  assert.equal(anchor("vela_pulsar").extra.turnsPerSecond, 11); assert.equal(F.velaTurns, 11);
  assert.ok(copyText("object vela_pulsar stargazer 0").includes("11 times every second"));
  assert.equal(copyText("object vela_pulsar navigator 0"), anchor("vela_pulsar").extra.said);
  for (const k of ["pleiades", "cyg_x1", "sgr_a_star", "m31", "vela_pulsar", "polaris"]) assert.ok(M.objectOf(k).text.navigator.some((p) => p.text === anchor(k).distanceNote), `${k}: the core's distance note`);
  near(C.CMB.comovingGly, 45.3, 1e-9);
  assert.ok(copyText("object cmb navigator 2").includes("45.3 billion light-years"));
  // the words counted in the lexicon's rows
  const rows = [...VERSES.values()].filter((r) => r[4].includes("the heavens were opened"));
  assert.deepEqual(rows.map((r) => r[3]), ["Ezekiel 1:1", "Matthew 3:16"]);
  assert.deepEqual({ rows: F.heavens.rows, names: [...F.heavens.names] }, { rows: 2, names: ["Ezekiel 1:1", "Matthew 3:16"] });
  assert.ok(copyText("project stand 3").includes("stand in two of the lexicon's verse rows: Ezekiel 1:1 and Matthew 3:16"));
  // the sealed sky
  const sealRows = C.skyLexiconRows(sky0);
  assert.equal(sealRows.length, 25); assert.equal(sealRows.filter((r) => !r[0].includes(".")).length, 4);
  assert.deepEqual({ ...F.seal }, { rows: 25, epochs: 4 });
  assert.ok(copyText("seal say navigator 0").includes("the 25 rows of this sky") && copyText("seal say holographer 0").includes("one epoch per top-level entry (four)"));
  // the limits of 4.6 stand in the dialog as the core words them
  const limits = M.DIALOG.sections.find((s) => s.heading === "What is computed, and how well").items.map((p) => p.text);
  for (const l of C.LIMITS) assert.ok(limits.includes(l), l.slice(0, 40));
  assert.equal(C.LIMITS.length, 7);
});

// ─── Stargazer strings (1.6) ─────────────────────────────────────────────────

test("Stargazer strings: no sentence over 16 words and none of the hard words", () => {
  const strings = M.stargazerStrings();
  assert.ok(strings.length >= 150, `only ${strings.length} strings`);
  const hard = /\b(ecliptic|azimuth|geodesics?|isometr(y|ies)|hyperbolic|lorentz|parity|hash(es)?|epochs?|certificates?|logarithmic)\b/i;
  const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  for (const { where, text } of strings) {
    assert.ok(!hard.test(text), `${where}: a hard word in "${text}"`);
    for (const sentence of unquoted(text).split(/(?<=[.!?])\s+/)) assert.ok(words(sentence) <= 16, `${where}: ${words(sentence)} words in "${sentence}"`);
  }
  // the strings are the ones a Stargazer is shown
  const have = new Set(strings.map((s) => s.text));
  for (const s of M.STEPS) {
    const view = M.stepView(s.key, "stargazer");
    assert.ok(have.has(view.title) && have.has(view.question), s.key);
    for (const p of [...view.say, view.bridge.reading, ...view.bridge.stands.filter((x) => x.layer !== "text")]) assert.ok(have.has(p.text), `${s.key}: "${p.text.slice(0, 40)}" is not listed`);
    if (view.bridge.opening) assert.ok(have.has(view.bridge.opening.text));
  }
  for (const o of M.OBJECTS) if (o.text && !o.minLens && (!o.frames || o.frames.includes("hor"))) for (const p of o.text.stargazer) assert.ok(have.has(p.text), o.key);
  const st = lit("stargazer");
  for (const o of M.objectList(st)) { const ins = M.inspector(st, o.key); assert.ok(ins.paragraph.every((p) => have.has(p.text) || !M.objectOf(o.key).text), o.key); }
  // the sentences section 1.6 gives
  for (const sentence of [
    "Three questions tell me where we are under the sky. Where on Earth are you standing? What day is it? What shape is the Moon tonight? You answer the first two. I work out the Moon, and you look up and check me.",
    "Tap anything and the whole map slides until it sits in the middle. It is the same map, seen from a new middle. Nothing is added and nothing is lost. What you left behind is squeezed towards the edge.",
    "Slide forward, left, back and right, one step each, and never turn. On a flat floor you would be home. Here you end 0.87 of a step from home. Slide straight home. Now you face almost a quarter turn to the right (78 degrees). No slide turned you. This is true of the curved map, not of the sky.",
    "A seal is a stamp on the exact writing. Change one letter and the stamp no longer fits, and anyone can see that. It does not say the writing is true, and it does not say who made it.",
    "It is dark. Three questions will light the sky. First: where on Earth are you standing?",
    "I cannot see where you are, and I never ask your device.",
    "We start at Greenwich in England. Change the place any time to see your own sky.",
    "The map slid in a straight line.",
    "The edge can never reach the middle. This is as far as the map goes.",
    "The stamp is about this exact writing, not whether it is true.",
    "This is the line straight up from your head; from above it looks like a dot.",
    "half Moon (astronomers say First Quarter: a quarter of the way round its month), growing",
    "This is the curved map by itself. It is not the sky.",
  ]) assert.ok(have.has(sentence), sentence.slice(0, 50));
  for (const s of ["This is a squeezed map. Near things sit near the middle, far things near the edge.", "Only the map is squeezed. Space is not."]) assert.ok(have.has(s));
  // every control label and step name has a Stargazer form
  for (const o of M.OVERLAYS) assert.ok(have.has(o.stargazer));
  for (const q of M.QUICK) assert.ok(have.has(q.stargazer));
  assert.equal(M.DIALOG.inShort.length, 5);
  for (const p of M.DIALOG.inShort) assert.ok(have.has(p.text));
  // the Holographer's 3D line is the one of 1.6, and it is not a Stargazer string
  const caveat = "As a Lorentz transformation this is a boost of rapidity d. It acts physically on directions. Depth is this chart's own scale and has no Lorentz meaning.";
  assert.ok(!have.has(caveat));
  const deep = M.dive(M.dive(lit("holographer", "3D"), "m31"), "m31");
  assert.ok(M.hud(deep).lines.some((l) => l.text === caveat && l.layer === "reading"));
});

// ─── links ───────────────────────────────────────────────────────────────────

test("links: parseHash accepts every link the Lexicon Explorer emits and refuses junk", () => {
  // the links of section 8.3, with every lens
  for (const l of LENSES) {
    assert.deepEqual({ ...M.parseHash("#preset=ezekiel&lens=" + l).values }, { preset: "ezekiel", lens: l });
    assert.deepEqual({ ...M.parseHash("#lab=square&lens=" + l).values }, { lab: "square", lens: l });
    assert.deepEqual({ ...M.parseHash("#lens=" + l).values }, { lens: l });
    for (const h of ["#preset=ezekiel&lens=" + l, "#lab=square&lens=" + l, "#lens=" + l]) { const r = M.parseHash(h); assert.equal(r.ignored, 0); assert.equal(r.note, ""); }
  }
  assert.deepEqual({ ...M.parseHash("#preset=ezekiel").values }, { preset: "ezekiel" });
  assert.deepEqual({ ...M.parseHash("#lab=square").values }, { lab: "square" });
  // the other page's own link builder, when its model is there
  if (OTHER && typeof OTHER.skyPageHref === "function") {
    for (const l of LENSES) for (const what of ["date", "lab", "home"]) {
      const href = OTHER.skyPageHref(what, l);
      assert.ok(href.startsWith(KIT.LINKS.celestialControlPanel), href);
      const r = M.parseHash(href.slice(KIT.LINKS.celestialControlPanel.length));
      assert.equal(r.ignored, 0, href);
      assert.equal(r.values.lens, l);
      if (what === "date") assert.equal(r.values.preset, "ezekiel");
      if (what === "lab") assert.equal(r.values.lab, "square");
    }
  }
  // every key of the grammar of 7.2
  const full = M.parseHash("#site=kyoto&jd=2461359.25&lat=-33.87&lon=151.21&focus=moon&lens=holographer");
  assert.equal(full.ignored, 0);
  assert.deepEqual({ ...full.values }, { site: "kyoto", jd: 2461359.25, lat: -33.87, lon: 151.21, focus: "moon", lens: "holographer" });
  assert.equal(Object.getPrototypeOf(full.values), null, "the values carry no prototype");
  for (const s of C.SITES) assert.equal(M.parseHash("#site=" + s.key).values.site, s.key);
  for (const o of M.OBJECTS) assert.equal(M.parseHash("#focus=" + o.key).values.focus, o.key);
  assert.equal(M.parseHash("").ignored, 0);
  assert.equal(M.parseHash("#").ignored, 0);
  assert.deepEqual({ ...M.parseHash(undefined).values }, {});
  // junk: an unknown key, a key given twice, an invalid value; each is ignored and counted
  const junk = [
    "#entry=26.1.1", "#sky=2461359.25,51.48,0.00", "#zoom=3", "#__proto__=1", "#constructor=x", "#toString=1",
    "#lens=expert", "#lens=Stargazer", "#preset=other", "#lab=circle", "#site=atlantis", "#site=Kebar", "#focus=pluto", "#focus=home",
    "#lat=91", "#lat=-90.5", "#lat=12.34567", "#lat=1e1", "#lat=+5", "#lon=181", "#lon=-180.1", "#lon=0x10", "#lon=",
    "#jd=abc", "#jd=-5", "#jd=12345678", "#jd=1.1234567", "#jd=9999999", "#jd=100", "#jd=2461359,5",
    "#lens", "#=stargazer", "#lens=stargazer%20", "#lens=star gazer", "#focus=<script>", "#site=kebar#x", "#lat=5;lon=5",
  ];
  for (const h of junk) { const r = M.parseHash(h); assert.equal(Object.keys(r.values).length, 0, h); assert.ok(r.ignored >= 1, h); assert.equal(r.note, "a link value was ignored"); }
  const twice = M.parseHash("#lens=navigator&lens=holographer&focus=sun");
  assert.deepEqual({ ...twice.values }, { focus: "sun" });
  assert.equal(twice.ignored, 2);
  const mixed = M.parseHash("#preset=ezekiel&colour=red&lens=navigator");
  assert.deepEqual({ ...mixed.values }, { preset: "ezekiel", lens: "navigator" });
  assert.equal(mixed.ignored, 1);
  assert.equal(M.IGNORED_NOTE, "a link value was ignored");
  assert.equal(M.parseHash("#" + "lens=stargazer&".repeat(400)).values.lens, undefined, "a very long link is not read");
  // the year range of jd
  assert.equal(M.parseHash("#jd=990924").values.jd, 990924);
  assert.equal(M.parseHash("#jd=990900").values.jd, undefined);
  assert.equal(M.parseHash("#jd=2817151.9").values.jd, 2817151.9);
  assert.equal(M.parseHash("#jd=2817200").values.jd, undefined);
  // never throws, whatever the text
  const r = rng(7), alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFXYZ0123456789#&=.,_-%<>\"' é‮";
  for (let i = 0; i < 600; i++) {
    let s = "#"; const n = Math.floor(r() * 40);
    for (let k = 0; k < n; k++) s += alphabet[Math.floor(r() * alphabet.length)];
    const p = M.parseHash(s);
    assert.ok(p && typeof p.ignored === "number");
    for (const k of Object.keys(p.values)) assert.ok(["preset", "site", "jd", "lat", "lon", "focus", "lab", "lens"].includes(k));
    assert.doesNotThrow(() => M.applyHash(fresh(), s));
  }
  for (const odd of [null, 5, {}, [], "#&&&", "#=", "#a=b=c"]) assert.doesNotThrow(() => M.parseHash(odd));
});

test("links: what this page writes, and what a link does to the state", () => {
  const k = kebar("navigator");
  assert.equal(M.skyLinkHref(k), "../Celestial_Control_Panel/index.html#jd=1505042.16624&lat=32.13&lon=45.23&lens=navigator");
  assert.equal(M.lexiconSkyHref(k), "../Lexicon_Explorer/index.html#sky=1505042.16624,32.13,45.23&lens=navigator");
  assert.equal(M.entryHref("26.1.9", "stargazer"), "../Lexicon_Explorer/index.html#entry=26.1.9&lens=stargazer");
  assert.equal(M.firstExplorersHref(), KIT.LINKS.firstExplorers);
  for (const href of [M.skyLinkHref(k), M.lexiconSkyHref(k), M.entryHref("26.1.9", "stargazer"), M.firstExplorersHref()]) assert.ok(KIT.isAllowedUrl(href), href);
  assert.equal(M.skyLinkHref(fresh()), "");
  assert.equal(M.lexiconSkyHref(fresh()), "");
  // the page reads back its own link: the same place and time to the rounding of a sealed sky
  const r = rng(11);
  for (let i = 0; i < 200; i++) {
    const lat = Number((r() * 180 - 90).toFixed(4)), lon = Number((r() * 360 - 180).toFixed(4)), jd = 1000000 + r() * 1800000;
    const st = M.setJd(M.typePlace(fresh(), lat, lon).state, jd), href = M.skyLinkHref(st);
    const back = M.initialState({ hash: href.slice(KIT.LINKS.celestialControlPanel.length), nowMs: 0 });
    assert.equal(back.notes.link, "");
    near(back.site.lat, lat, 0.005 + 1e-9); near(back.site.lonEast, lon, 0.005 + 1e-9); near(back.jdUt, jd, 0.000005 + 1e-9);
    assert.equal(M.skyLinkHref(back), href, "a link read and written again is the same link");
    // the other page's parser accepts the links this page writes to it
    const sky = KIT.parseHashWith(M.LEXICON_PAGE_GRAMMAR, M.lexiconSkyHref(st).slice(KIT.LINKS.lexiconExplorer.length));
    assert.equal(sky.ignored, 0);
    assert.equal(sky.values.sky.length, 3);
    if (OTHER && typeof OTHER.parseHash === "function" && i < 40) {
      const o = OTHER.parseHash(M.lexiconSkyHref(st).slice(KIT.LINKS.lexiconExplorer.length));
      assert.equal(o.ignored, 0);
      assert.deepEqual([...o.values.sky], [...sky.values.sky]);
    }
  }
  if (OTHER && typeof OTHER.parseHash === "function") for (const s of M.STEPS) for (const l of LENSES) for (const x of M.stepView(s.key, l).bridge.stands) if (x.href) {
    const o = OTHER.parseHash(x.href.slice(KIT.LINKS.lexiconExplorer.length));
    assert.equal(o.ignored, 0, x.href); assert.equal(o.values.entry, x.source); assert.equal(o.values.lens, l);
  }
  // formatHash never writes what parseHash would refuse
  assert.equal(M.formatHash({}), "");
  assert.equal(M.formatHash({ lens: "navigator", preset: "ezekiel" }), "#preset=ezekiel&lens=navigator");
  assert.equal(M.formatHash({ lat: -0.001, lon: 0, jd: 2461359.123456789 }), "#jd=2461359.12346&lat=0.00&lon=0.00");
  for (const bad of [{ lat: 91 }, { lon: 200 }, { lens: "expert" }, { zoom: 1 }, { jd: 5 }, { site: "atlantis" }, { focus: "pluto" }]) assert.throws(() => M.formatHash(bad), /link grammar/);
  // applyHash: the preset first, then what the other keys say
  assert.equal(k.site.key, "kebar"); assert.equal(k.jdUt, 1505042.16624); assert.equal(k.lens, "navigator");
  assert.deepEqual({ ...k.lit }, { place: true, day: true, sky: false });
  assert.equal(k.step, 1);
  assert.deepEqual({ ...M.EZEKIEL_PRESET }, { site: "kebar", date: "593-07-31", which: "ends", jdUt: 1505042.16624 });
  const over = M.initialState({ hash: "#preset=ezekiel&site=giza&jd=2461359.25", nowMs: 0 });
  assert.equal(over.site.key, "giza"); assert.equal(over.jdUt, 2461359.25);
  const typed = M.initialState({ hash: "#site=giza&lat=10.5&lon=-20.25", nowMs: NOW_MS });
  assert.equal(typed.site.key, null); assert.equal(typed.site.lat, 10.5); assert.equal(typed.site.lonEast, -20.25);
  assert.ok(typed.lit.place && !typed.lit.day, "a place in the link skips the first question only");
  near(typed.jdUt, C.jdFromUnixMs(NOW_MS), 1e-9);
  const half = M.initialState({ hash: "#lat=10.5&lens=navigator", nowMs: NOW_MS });
  assert.equal(half.site, null); assert.equal(half.lens, "navigator"); assert.equal(half.notes.link, "a link value was ignored");
  const lab = M.initialState({ hash: "#lab=square&lens=holographer", nowMs: NOW_MS });
  assert.ok(lab.lab.open); assert.equal(lab.step, 4); assert.equal(lab.site, null);
  const focus = M.initialState({ hash: "#site=greenwich&focus=m31", nowMs: NOW_MS });
  assert.equal(focus.selected, "m31"); assert.ok(focus.lit.sky && focus.lit.day); assert.equal(focus.notes.link, "");
  assert.deepEqual(focus.centred, { key: "m31", half: false }, "focus brings the object to the centre");
  { const b = M.scene(focus, SIZE).bodies.find((x) => x.key === "m31"); near(b.x, 200, 1e-6); near(b.y, 200, 1e-6); }
  // focus needs a place, and an object the lens shows; otherwise the value is ignored and said so
  const lost = M.initialState({ hash: "#focus=m31", nowMs: NOW_MS });
  assert.equal(lost.selected, null); assert.equal(lost.notes.link, "a link value was ignored");
  assert.equal(M.initialState({ hash: "#site=giza&focus=shadow", nowMs: NOW_MS }).notes.link, "a link value was ignored");
  assert.equal(M.initialState({ hash: "#site=giza&focus=shadow&lens=holographer", nowMs: NOW_MS }).selected, "shadow");
  assert.equal(M.initialState({ hash: "#site=giza&focus=light-year", nowMs: NOW_MS }).centred, null, "a ring is selected, not dived to");
  // on hashchange the same function runs on the state as it is
  const later = M.applyHash(M.setStep(atGreenwich(), 3), "#lens=holographer&junk=1");
  assert.equal(later.lens, "holographer"); assert.equal(later.site.key, "greenwich"); assert.equal(later.step, 3); assert.equal(later.notes.link, "a link value was ignored");
  assert.equal(M.applyHash(later, "#lens=navigator").notes.link, "");
});

// ─── state ───────────────────────────────────────────────────────────────────

test("state: the first run, the three questions, the place", () => {
  const s = fresh();
  assert.equal(s.lens, "stargazer"); assert.equal(s.dims, "2D"); assert.equal(s.frame, "hor"); assert.equal(s.step, 1);
  assert.equal(s.site, null); assert.equal(s.selected, null); assert.equal(s.busy, false);
  near(s.jdUt, C.jdFromUnixMs(NOW_MS), 1e-12);
  assert.deepEqual({ ...s.overlays }, { rings: false, horizon: false, equator: false, ecliptic: false, galactic: false, sightLines: false });
  assert.deepEqual({ ...s.lit }, { place: false, day: false, sky: false });
  assert.deepEqual(s.c, [0, 0]); assert.deepEqual(s.view3, [...S.IDENT]); assert.deepEqual(s.orbit, S.rotX(-1.15));
  assert.deepEqual(Object.keys(s.seal), ["keys", "bundle", "certificate", "report", "wire"]);
  assert.equal(M.skyOf(s), null); assert.deepEqual(M.objectList(s), []); assert.equal(M.statusSentence(s), ""); assert.equal(M.moonFigure(s), null);
  // the first screen: the dark disc with one dot
  const dark = M.scene(s, SIZE);
  assert.ok(dark.dark); assert.equal(dark.bodies.length, 0); assert.equal(dark.rings.length, 0);
  assert.deepEqual(dark.labels.map((l) => l.key), ["home"]);
  near(dark.home.x, 200, 1e-9); near(dark.home.y, 200, 1e-9);
  assert.deepEqual({ ...M.FIRST_RUN.buttons }, { greenwich: "Start at Greenwich", pick: "Pick a place", type: "Type my place" });
  assert.equal(M.FIRST_RUN.typeHelp, "Ask a grown-up: a maps app shows these two numbers");
  // question 1: the place brings the compass points and the straight-up dot
  const p = M.chooseSite(s, "greenwich");
  assert.equal(p.site.label, "Greenwich, England");
  assert.deepEqual(M.objectList(p).map((o) => o.key), ["zenith", "north", "east", "south", "west"]);
  assert.equal(M.moonFigure(p), null, "the Moon waits for the day");
  assert.equal(M.chooseSite(s, "atlantis"), s);
  // question 2: answered from the device clock and shown for confirmation
  assert.deepEqual(M.dayQuestion(p), { text: "Your device says today is Saturday 14 November 2026. Is that right?", yes: "Yes", change: "Change the day" });
  const d = M.confirmDay(p);
  assert.deepEqual(M.objectList(d).map((o) => o.key), ["moon", "sun", "zenith", "north", "east", "south", "west"]);
  // "Look around" brings the stars, the rings and the rim, and opens in 3D the first time
  const all = M.setStep(d, 3);
  assert.equal(all.dims, "3D");
  const keys = M.objectList(all).map((o) => o.key);
  for (const key of ["pleiades", "polaris", "vela_pulsar", "cyg_x1", "sgr_a_star", "m31", "celestial_sphere", "holography", "memory", "cmb"]) assert.ok(keys.includes(key), key);
  assert.ok(!keys.includes("shadow"), "the shadow transform is for the Holographer");
  assert.ok(M.objectList(M.setLens(all, "holographer")).some((o) => o.key === "shadow"));
  assert.equal(M.setStep(M.setDims(all, "2D"), 3).dims, "2D", "only the first visit switches to 3D");
  assert.equal(M.setStep(s, 3).lit.sky, false, "without a place the sky stays dark");
  assert.equal(M.setStep(s, 9), s); assert.equal(M.setStep(s, 0), s);
  // typed places: two decimals, plain messages, no location service
  const t = M.typePlace(s, 48.8566, 2.3522);
  assert.equal(t.message, ""); assert.equal(t.state.site.lat, 48.86); assert.equal(t.state.site.lonEast, 2.35); assert.equal(t.state.site.key, null);
  assert.equal(t.state.site.label, "A place at 48.86° north, 2.35° east");
  assert.equal(M.typePlace(s, 91, 0).message, "A latitude is a number from 0 to 90, north or south.");
  assert.equal(M.typePlace(s, 10, -181).message, "A longitude is a number from 0 to 180, east or west.");
  assert.equal(M.typePlace(s, NaN, 0).state.site, null);
  assert.equal(M.typePlace(s, 32.13, 45.23).state.site.key, "kebar", "the same two numbers are the same place");
  assert.equal(M.latitudeWords(32.4), "32 degrees north"); assert.equal(M.latitudeWords(-33.87, 2), "33.87 degrees south"); assert.equal(M.latitudeWords(0.2), "on the equator");
  assert.equal(M.longitudeWords(-155.47), "155 degrees west"); assert.equal(M.longitudeWords(0), "on the line of Greenwich");
  assert.equal(M.placeWords(C.SITES[0]), "32.13° north, 45.23° east");
  // lens, dims, frame
  assert.equal(M.setLens(d, "expert").lens, "stargazer");
  const gal = M.setFrame(M.setLens(all, "navigator"), "gal");
  assert.equal(gal.frame, "gal");
  assert.ok(M.objectList(gal).some((o) => o.key === "galactic_centre") && !M.objectList(gal).some((o) => o.key === "north"));
  assert.equal(M.setLens(gal, "stargazer").frame, "hor", "Stargazer has no frame switch");
  assert.equal(M.setFrame(all, "equ"), all);
  assert.equal(M.select(M.select(all, "north"), null).selected, null);
  assert.equal(M.setFrame(M.setLens(M.select(all, "north"), "navigator"), "gal").selected, null, "an object the frame does not show is unselected");
  assert.equal(M.select(all, "pluto"), all);
  assert.ok(M.toggleOverlay(all, "rings").overlays.rings); assert.equal(M.toggleOverlay(all, "glow"), all);
  // nothing here changes the state it is given
  const frozen = JSON.stringify(d);
  M.setStep(d, 3); M.dive(d, "moon"); M.setLens(d, "navigator"); M.stepDay(d, 1); M.select(d, "moon"); M.toggleOverlay(d, "rings");
  assert.equal(JSON.stringify(d), frozen);
});

test("state: the day and time controls, their messages, the Moon buttons, the Kebar preset", () => {
  const g = atGreenwich(), sky = M.skyOf(g);
  assert.deepEqual(sky, C.skyState(g.jdUt, 51.4769, 0));
  const dv = M.dateView(g);
  assert.equal(dv.text, "14 November 2026"); assert.equal(dv.weekday, "Saturday"); assert.equal(dv.clock, "18:00"); assert.equal(dv.dayOfYear, 318); assert.equal(dv.daysInYear, 365);
  assert.deepEqual(dv.era, { n: 2026, era: "AD" }); assert.equal(dv.calendarNote, "Gregorian calendar");
  // every date is the local date at the site
  const kyoto = M.chooseSite(g, "kyoto");
  assert.equal(M.dateView(kyoto).text, "15 November 2026"); assert.equal(M.dateView(kyoto).clock, "03:03");
  // day before, day after
  assert.equal(M.dateView(M.stepDay(g, 1).state).text, "15 November 2026");
  assert.equal(M.dateView(M.stepDay(g, -14).state).text, "31 October 2026");
  // pick another day: the same clock time; impossible dates give a plain message and never roll over silently
  const picked = M.pickDate(g, { year: 2031, month: 3, day: 9 });
  assert.equal(picked.message, ""); assert.equal(M.dateView(picked.state).text, "9 March 2031"); assert.equal(M.dateView(picked.state).clock, "18:00");
  const cases = [
    [{ year: 2027, month: 2, day: 29 }, "That day does not exist. Showing 1 March.", "1 March 2027"],
    [{ year: 2028, month: 2, day: 30 }, "That day does not exist. Showing 1 March.", "1 March 2028"],
    [{ year: 2026, month: 4, day: 31 }, "That day does not exist. Showing 1 May.", "1 May 2026"],
    [{ year: 2026, month: 11, day: 31 }, "That day does not exist. Showing 1 December.", "1 December 2026"],
    [{ year: 1582, month: 10, day: 10 }, "That day does not exist. Showing 15 October.", "15 October 1582"],
    [{ year: 1900, month: 2, day: 29 }, "That day does not exist. Showing 1 March.", "1 March 1900"],
  ];
  for (const [date, message, shown] of cases) { const r = M.pickDate(g, date); assert.equal(r.message, message); assert.equal(M.dateView(r.state).text, shown); assert.equal(r.state.notes.date, message); }
  assert.equal(M.dateView(M.pickDate(g, { year: 2028, month: 2, day: 29 }).state).text, "29 February 2028");
  assert.equal(M.dateView(M.pickDate(g, { year: 1500, month: 2, day: 29 }).state).text, "29 February 1500 (Julian calendar)", "1500 is a leap year in the calendar then in force");
  assert.equal(M.dateView(M.pickDate(g, { year: -592, month: 7, day: 31 }).state).text, "31 July 593 BC (Julian calendar)");
  for (const bad of [{ year: 3001, month: 1, day: 1 }, { year: -2000, month: 1, day: 1 }, { year: 2026.5, month: 1, day: 1 }]) { const r = M.pickDate(g, bad); assert.equal(r.message, "This page works for the years 2000 BC to AD 3000."); assert.equal(r.state.jdUt, g.jdUt); }
  for (const bad of [{ year: 2026, month: 13, day: 1 }, { year: 2026, month: 0, day: 1 }, { year: 2026, month: 5, day: 32 }, { year: 2026, month: 5, day: 0 }, null]) { const r = M.pickDate(g, bad); assert.ok(r.message !== ""); assert.equal(r.state.jdUt, g.jdUt); }
  assert.equal(M.pickDate(g, { year: 3000, month: 12, day: 32 }).state.jdUt, g.jdUt);
  // the five time buttons
  near(M.timeButton(g, "noon").state.jdUt, C.jdFromLocalMean(sky.localDate, 12, 0), 1e-12);
  assert.equal(M.dateView(M.timeButton(kyoto, "noon").state).clock, "12:00");
  assert.equal(M.dateView(M.timeButton(kyoto, "midnight").state).clock, "00:00");
  assert.equal(M.dateView(M.timeButton(kyoto, "midnight").state).text, "15 November 2026", "midnight of the same local date");
  near(M.timeButton(g, "sunset").state.jdUt, C.sunEventOnLocalDay(sky.localDate, 51.4769, 0, "set"), 1e-12);
  near(M.timeButton(g, "sunrise").state.jdUt, C.sunEventOnLocalDay(sky.localDate, 51.4769, 0, "rise"), 1e-12);
  near(M.skyOf(M.timeButton(g, "sunset").state).sun.alt, -0.8333, 1e-3, "the Sun at sunset");
  near(M.timeButton(M.stepDay(g, 40).state, "now", NOW_MS).state.jdUt, g.jdUt, 1e-12);
  near(M.timeButton(M.stepDay(g, -3).state, "today", NOW_MS).state.jdUt, g.jdUt, 1e-12);
  assert.equal(M.timeButton(g, "teatime").state.jdUt, g.jdUt);
  const pole = M.pickDate(M.chooseSite(g, "south-pole"), { year: 2026, month: 6, day: 21 }).state;
  for (const [which, message] of [["sunset", "The Sun does not set here today."], ["sunrise", "The Sun does not rise here today."]]) {
    const r = M.timeButton(pole, which); assert.equal(r.message, message); assert.equal(r.state.jdUt, pole.jdUt); assert.equal(r.state.notes.time, message);
  }
  assert.equal(M.timeButton(fresh(), "sunset").message, "Choose a place first.");
  // the slider through the year and the typed time
  assert.equal(M.dateView(M.setDayOfYear(g, 1)).text, "1 January 2026"); assert.equal(M.dateView(M.setDayOfYear(g, 365)).text, "31 December 2026");
  assert.equal(M.setDayOfYear(g, 366), g); assert.equal(M.setDayOfYear(g, 0), g);
  assert.equal(M.dateView(M.setClock(kyoto, 6.5)).clock, "06:30"); assert.equal(M.setClock(g, 24), g);
  assert.equal(M.MESSAGES.timeLabel, "Sun time at this place (local mean time)");
  assert.deepEqual(M.DAY_BUTTONS.map((b) => b.label), ["Today", "Day before", "Day after", "Pick another day"]);
  assert.equal(M.CONTROLS.clock.navigator, M.MESSAGES.timeLabel); assert.equal(M.CONTROLS.clock.stargazer, "", "no typed time at Stargazer");
  assert.equal(M.CONTROLS.frame.stargazer, "", "no frame switch at Stargazer"); assert.equal(M.CONTROLS.telemetry.stargazer, "");
  assert.deepEqual(Object.keys(M.CONTROLS.nudge), ["up", "down", "left", "right"]); assert.deepEqual(Object.keys(M.CONTROLS.turn), ["up", "down", "left", "right"]);
  assert.equal(M.CONTROLS.dims["3D"].stargazer, "Ball"); assert.equal(M.CONTROLS.real, M.DIALOG.title); assert.equal(M.CONTROLS.blueprint, M.BLUEPRINT.title);
  // what the Earth step shows: the zenith among the stars, the pole's altitude, Polaris from the pole on that date
  const place = M.placeReadout(M.setLens(kyoto, "navigator")), ksky = M.skyOf(kyoto);
  assert.deepEqual(place.map((x) => x.label), ["Place", "Zenith: declination (your latitude)", "Zenith: right ascension (your local sidereal time)", "Altitude of the north celestial pole", "Polaris from the pole on this date"]);
  assert.equal(place[0].value, "Kyoto, Japan (35.01° north, 135.76° east)");
  assert.equal(place[1].value, "35.01°"); assert.equal(place[3].value, "35.01°");
  assert.equal(place[2].value, C.formatClock(ksky.last / 15) + " (" + ksky.last.toFixed(2) + "°)");
  assert.equal(place[4].value, ksky.anchors.polaris.poleDistance.toFixed(1) + "°");
  assert.equal(M.placeReadout(M.setLens(kebar(), "navigator"))[4].value, "15.0° (no pole star on this date)");
  assert.deepEqual(M.placeReadout(g).map((x) => x.value), ["Greenwich, England", "It is 51 degrees up, in the north.", "It is 0.6 degrees from that point on this day."]);
  assert.deepEqual(M.placeReadout(M.chooseSite(g, "sydney")).slice(1).map((x) => x.value), ["It is 34 degrees up, in the south.", "It is near the other turning point, below your ground."]);
  assert.ok(M.skyOf(M.chooseSite(g, "sydney")).anchors.polaris.alt < 0, "Polaris is below the ground at Sydney");
  assert.deepEqual(M.placeReadout(fresh()), []); assert.deepEqual(M.dayReadout(fresh()), []);
  // what the Sun and Moon step shows about the day
  const day = M.dayReadout(M.setLens(g, "navigator"));
  assert.deepEqual(day.map((x) => x.label), ["Local date", "Sun: ecliptic longitude", "Season"]);
  assert.equal(day[0].value, "Saturday 14 November 2026, 18:00 local mean time"); assert.equal(day[1].value, sky.sun.lambda.toFixed(2) + "°");
  assert.equal(day[2].value, M.seasonLine(g).text);
  assert.deepEqual(M.dayReadout(g).map((x) => x.label), ["The day at your place", "The Sun's year"]);
  const old = M.dayReadout(kebar());
  assert.equal(old[3].label, "Uncertainty"); assert.equal(old[3].value, M.skyOf(kebar()).uncertainty.note); assert.equal(old[3].layer, "reading");
  assert.ok(M.skyOf(kebar()).uncertainty.badge && !sky.uncertainty.badge);
  // the season line
  const season = M.seasonLine(kebar());
  assert.equal(season.key, "june-solstice"); assert.equal(season.text, "32 days after the June solstice");
  near(C.nearestSeasonJd(1505042.16624).jdUt, 1505042.16624 - 32, 1, "the June solstice of 593 BC, on 29 June");
  // "Find the next night with this Moon"
  for (const p of C.PHASE_TARGETS) {
    const r = M.findMoon(g, p.target), want = C.phaseEveningJd(g.jdUt, p.target, 51.4769, 0);
    assert.equal(r.state.jdUt, want.jdUt);
    assert.ok(r.state.jdUt >= g.jdUt, "never an earlier night");
    const set = C.sunEventOnLocalDay(M.skyOf(r.state).localDate, 51.4769, 0, "set");
    near(r.state.jdUt, set + 1 / 24, 1e-9, "one hour after sunset that evening");
    assert.equal(r.lines[0], "this changes the day");
    const got = M.skyOf(r.state).phase;
    assert.ok(r.lines[1].endsWith(Math.round(100 * got.illuminatedFraction) + " per cent lit."));
    assert.equal(r.lines.length, got.name === p.name ? 2 : 3);
    if (got.name !== p.name) assert.match(r.lines[2], /^nearest evening: \d\.\d day (after|before) /);
    assert.equal(r.state.notes.moon, r.note);
  }
  // when the computed name differs from the button's, a third line says how far the evening is from the phase
  const december = M.stepDay(g, 24).state;
  assert.equal(M.dateView(december).text, "8 December 2026");
  assert.deepEqual(M.findMoon(M.setLens(december, "navigator"), 0).lines, ["this changes the day", "Waxing Crescent, 1 per cent lit.", "nearest evening: 0.7 day after New Moon"]);
  assert.deepEqual(M.findMoon(december, 0).lines, ["this changes the day", "thin Moon, growing, 1 per cent lit.", "nearest evening: 0.7 day after new Moon"]);
  assert.equal(M.findMoon(g, 33).note, "Choose a place first.");
  assert.equal(M.findMoon(fresh(), 90).state.site, null);
  assert.equal(M.moonWords("First Quarter", "navigator"), "First Quarter");
  assert.equal(M.moonWords("Waning Crescent", "stargazer"), "thin Moon, shrinking");
  assert.equal(M.moonWords("Last Quarter", "stargazer", true), "half Moon (astronomers say Last Quarter: three quarters of the way round its month), shrinking");
  assert.equal(M.moonWords("Full Moon", "stargazer"), "full Moon");
  assert.deepEqual(Object.keys(M.MOON_NAMES), C.PHASE_TARGETS.map((p) => p.name));
  // the preset "Ezekiel by the Kebar"
  const choices = M.ezekielChoices();
  assert.deepEqual(choices.map((c) => c.label), ["the sunset that ends the fifth day (31 July 593 BC)", "the sunset that begins it (30 July)", "1 July 593 BC", "13 July 594 BC"]);
  assert.deepEqual(choices.map((c) => c.isDefault), [true, false, false, false]);
  assert.deepEqual(choices.map((c) => c.said), [C.EZEKIEL_DATES[0].said, C.EZEKIEL_DATES[0].said, C.EZEKIEL_DATES[1].said, C.EZEKIEL_DATES[2].said]);
  const k = kebar();
  assert.deepEqual(M.ezekielSky(fresh(), "593-07-31", "ends").jdUt, k.jdUt);
  assert.equal(M.statusSentence(k), "31 July 593 BC (Julian calendar), 19:00 at By the Kebar (Nippur). Moon 50 per cent lit.");
  assert.equal(M.dateView(k).calendarNote, "Julian calendar (in force before 15 October 1582)");
  assert.deepEqual(M.dateView(k).era, { n: 593, era: "BC" });
  assert.equal(M.dateView(M.ezekielSky(fresh(), "593-07-31", "begins")).text, "30 July 593 BC (Julian calendar)");
  assert.equal(M.dateView(M.ezekielSky(fresh(), "594-07-13", "ends")).text, "13 July 594 BC (Julian calendar)");
  assert.equal(M.ezekielSky(g, "600-01-01", "ends"), g);
  near(M.skyOf(k).sun.alt, -0.8333, 2e-3, "the preset is a sunset");
  assert.ok(M.inspector(M.setStep(k, 3), "moon").note.startsWith("For this year:"), "the uncertainty note is shown for 593 BC");
  assert.equal(M.inspector(lit("navigator"), "moon").note, "");
  assert.equal(M.weekdayOf(2451545), "Saturday", "1 January 2000");
  assert.equal(M.distanceWords(1.3), "1.30 light-seconds"); assert.equal(M.distanceWords(499), "8.3 light-minutes");
  assert.equal(M.distanceWords(444 * C.LIGHT_SECONDS_PER_LY), "444 light-years"); assert.equal(M.distanceWords(2480000 * C.LIGHT_SECONDS_PER_LY), "2.48 million light-years");
  assert.equal(M.distanceWords(26673 * C.LIGHT_SECONDS_PER_LY), "26,700 light-years"); assert.equal(M.distanceWords(-1), "");
});

// ─── the chart ───────────────────────────────────────────────────────────────

test("chart: the projection of 7.2 and the 2D rules of 7.3", () => {
  const st = lit("navigator"), g = M.geometryOf(SIZE, "2D");
  assert.equal(g.cx, 200); assert.equal(g.R, 182); near(g.R3, 0.92 * 182, 1e-12);
  // screen(hp) in 2D and in 3D, on random points and views
  const r = rng(3);
  for (let i = 0; i < 200; i++) {
    const dir = (() => { const z = 2 * r() - 1, a = 2 * Math.PI * r(), q = Math.sqrt(1 - z * z); return [q * Math.cos(a), q * Math.sin(a), z]; })();
    const hp = C.chartPoint(dir, 3 * r()), c = [0.6 * (r() - 0.5), 0.6 * (r() - 0.5)];
    const flat = { ...st, dims: "2D", c }, b2 = S.toBall(S.lapply(H.centreOn([c[0], c[1], 0]), hp)), p2 = M.screenPoint(flat, g, hp);
    near(p2.x, g.cx + g.R * b2[0], 1e-9); near(p2.y, g.cy - g.R * b2[1], 1e-9);
    const view3 = H.centreOn([0.5 * (r() - 0.5), 0.5 * (r() - 0.5), 0.5 * (r() - 0.5)]), orbit = S.lmul(S.rotY(r()), S.rotX(r()));
    const ball = { ...st, dims: "3D", view3, orbit }, b3 = S.toBall(S.lapply(S.lmul(orbit, view3), hp)), p3 = M.screenPoint(ball, g, hp);
    near(p3.x, g.cx + g.R3 * b3[0], 1e-9); near(p3.y, g.cy - g.R3 * b3[1], 1e-9); near(p3.z, b3[2], 1e-12); near(p3.k, 1 + 0.25 * b3[2], 1e-12);
    // in the disc the view is exactly T_c
    const z = [0.9 * (r() - 0.5), 0.9 * (r() - 0.5)], w = H.mobius(c, z), q = M.screenPoint(flat, g, H.fromBall([z[0], z[1], 0]));
    near(q.x, g.cx + g.R * w[0], 1e-8); near(q.y, g.cy - g.R * w[1], 1e-8);
  }
  assert.deepEqual(M.viewMatrix(st), H.centreOn([0, 0, 0]));
  // the slide keeps every distance of the curved map
  for (let i = 0; i < 50; i++) {
    const a = H.fromBall([0.8 * (r() - 0.5), 0.8 * (r() - 0.5), 0]), b = H.fromBall([0.8 * (r() - 0.5), 0.8 * (r() - 0.5), 0]), V = M.viewMatrix({ ...st, c: [0.9 * (r() - 0.5), 0.9 * (r() - 0.5)] });
    near(S.hypDist(S.lapply(V, a), S.lapply(V, b)), S.hypDist(a, b), 1e-9);
  }
  assert.deepEqual(M.viewMatrix({ ...st, dims: "3D" }), S.lmul(st.orbit, st.view3));
  // the flat horizon chart: north up, east right, straight up a dot at the centre with its caption
  const sc = M.scene(st, SIZE), by = new Map(sc.bodies.map((b) => [b.key, b]));
  near(by.get("north").x, 200, 1e-9); near(by.get("north").y, 200 - 182, 1e-9);
  near(by.get("east").x, 200 + 182, 1e-9); near(by.get("east").y, 200, 1e-9);
  near(by.get("south").y, 200 + 182, 1e-9); near(by.get("west").x, 200 - 182, 1e-9);
  assert.ok(by.get("zenith").centreDot); near(by.get("zenith").x, 200, 1e-9); near(by.get("zenith").y, 200, 1e-9);
  assert.equal(sc.centreCaption, "straight up has no compass direction");
  assert.equal(sc.caption, "a flat map of direction round the plane and of depth; height above the plane is not shown; seen from above: north up, east right; the rim is your horizon");
  assert.equal(M.sceneCaption(st), sc.caption);
  assert.equal(M.sceneCaption(M.setLens(st, "stargazer")), "This is a flat map, seen from above. North is up and east is right. How high a thing stands is not shown.");
  assert.equal(M.sceneCaption(fresh()), "The map is dark: one dot, where you stand. Choose a place to light it.");
  // bodies: direction round the horizon and depth; below the horizon they are hollow and listed so
  const sky = M.skyOf(st), list = new Map(M.objectList(st).map((o) => [o.key, o]));
  for (const key of ["moon", "sun", "pleiades", "polaris", "vela_pulsar", "cyg_x1", "sgr_a_star", "m31"]) {
    const b = by.get(key), hz = C.horFromDir(C.bodyDirection(sky, key, "hor")), rr = Math.tanh(C.depthRho(C.bodyLightSeconds(sky, key)) / 2);
    near(b.x, 200 + 182 * rr * Math.sin(hz.az * RAD), 1e-6, key); near(b.y, 200 - 182 * rr * Math.cos(hz.az * RAD), 1e-6, key);
    assert.equal(b.hollow, hz.alt < 0, key); assert.equal(list.get(key).below, hz.alt < 0, key);
    assert.equal(list.get(key).state.includes("below the horizon"), hz.alt < 0, key);
    assert.equal(list.get(key).name, list.get(key).label + ", " + list.get(key).state);
  }
  assert.ok(sc.bodies.some((b) => b.hollow) && sc.bodies.some((b) => b.kind === "body" && !b.hollow));
  assert.equal(list.get("moon").name, "Moon, 25 per cent lit, up, south-west");
  assert.equal(list.get("zenith").name, "Zenith, straight up");
  assert.equal(M.objectList(lit("stargazer")).find((o) => o.key === "zenith").name, "Straight up, above your head");
  assert.equal(list.get("holography").name, "Celestial holography, a proposal, on the rim");
  assert.equal(list.get("memory").name, "Gravitational-wave memory, predicted, not detected, on the rim");
  assert.equal(list.get("cmb").name, "Cosmic microwave background, measured, the outermost ring");
  assert.equal(M.objectList(lit("stargazer")).find((o) => o.key === "holography").name, "A bold idea about the edge, an idea, not proved, on the edge of the map");
  assert.equal(M.objectList(lit("stargazer")).find((o) => o.key === "memory").name, "A ripple that stays, expected, not seen yet, on the edge of the map");
  // every object of the scene is in the list beside the canvas, and nothing else
  assert.deepEqual(sc.bodies.map((b) => b.key).sort(), M.objectList(st).filter((o) => o.kind !== "ring").map((o) => o.key).sort());
  assert.equal(M.objectList({ ...st, selected: "moon" }).filter((o) => o.pressed).length, 1);
  // rings: the eight of the core, at their radii, each 96 points
  const ringed = M.scene(M.toggleOverlay(st, "rings"), SIZE);
  assert.deepEqual(ringed.rings.map((x) => x.key), C.RINGS.map((x) => x.key));
  for (const ring of ringed.rings) { assert.equal(ring.points.length, 96); for (const p of ring.points) near(Math.hypot(p.x - 200, p.y - 200), 182 * Math.tanh(ring.rho / 2), 1e-9, ring.key); }
  assert.equal(sc.rings.length, 0);
  assert.ok(ringed.labels.some((l) => l.key.startsWith("ring:")), "rings carry labels");
  // a great circle other than the frame's own: its two crossing points, as rays and as labelled ticks on the rim
  const ecl = M.scene(M.toggleOverlay(st, "ecliptic"), SIZE);
  assert.equal(ecl.rays.length, 2); assert.equal(ecl.ticks.length, 2);
  for (const ray of ecl.rays) { assert.equal(ray.kind, "crossing"); assert.equal(ray.points.length, 33); near(ray.points[0].x, 200, 1e-9); }
  const nodes = C.circleNodes("ecl", "hor", sky);
  ecl.ticks.forEach((t, i) => { near(t.x, 200 + 182 * nodes[i][0], 1e-9); near(t.y, 200 - 182 * nodes[i][1], 1e-9); assert.equal(t.label, "the Sun's path crosses this map here"); });
  near(ecl.ticks[0].x + ecl.ticks[1].x, 400, 1e-9, "the two crossing points are opposite");
  // the last point of a ray is chartPoint(dir, 8)
  { const p = M.screenPoint(st, g, C.chartPoint(nodes[0], 8)); near(ecl.rays[0].points[32].x, p.x, 1e-9); }
  const own = M.scene(M.toggleOverlay(st, "horizon"), SIZE);
  assert.equal(own.rays.length, 0); assert.equal(own.rimLabel, "the rim is your horizon");
  // the galactic frame
  const gal = M.scene(M.setFrame(st, "gal"), SIZE), gby = new Map(gal.bodies.map((b) => [b.key, b]));
  near(gby.get("galactic_centre").x, 382, 1e-6); near(gby.get("galactic_centre").y, 200, 1e-6);
  assert.ok(gby.get("ngp").centreDot); assert.equal(gal.centreCaption, "the pole has no direction round the plane");
  near(Math.hypot(gby.get("sgr_a_star").x - 200, gby.get("sgr_a_star").y - 200), 182 * 0.7837, 0.1);
  assert.ok(gby.get("sgr_a_star").x > 340 && Math.abs(gby.get("sgr_a_star").y - 200) < 1, "Sagittarius A* lies towards the galactic centre");
  assert.ok(!gby.has("north") && !gby.has("zenith"));
});

test("chart: the ball in 3D", () => {
  const st = lit("navigator", "3D"), g = M.geometryOf(SIZE, "3D"), sc = M.scene(st, SIZE);
  assert.equal(sc.outline.r, g.R3);
  assert.equal(sc.caption, "the same chart as a ball seen from outside: each great circle is drawn on it, and straight up is a line; the rim is the sphere of directions");
  // bodies are sorted by z ascending (far first), and every one is inside the outline
  for (let i = 1; i < sc.bodies.length; i++) assert.ok(sc.bodies[i].z >= sc.bodies[i - 1].z);
  for (const b of sc.bodies) { assert.ok(Math.hypot(b.x - 200, b.y - 200) <= g.R3 + 1e-9, b.key); near(b.k, 1 + 0.25 * b.z, 1e-12); }
  assert.deepEqual(sc.hits.map((h) => h.key), sc.bodies.map((b) => b.key), "hits are in paint order");
  // straight up is a line of the ball: 33 points from home to the rim
  const axis = sc.rays.find((x) => x.key === "zenith-axis");
  assert.ok(axis && axis.kind === "axis" && axis.points.length === 33);
  near(axis.points[0].x, sc.home.x, 1e-9); near(axis.points[0].y, sc.home.y, 1e-9);
  const zen = sc.bodies.find((b) => b.key === "zenith");
  assert.ok(Math.hypot(axis.points[32].x - zen.x, axis.points[32].y - zen.y) < 0.2, "the line ends at the zenith's point of the rim");
  assert.ok(!zen.centreDot && zen.atRim); assert.equal(sc.centreCaption, "");
  // a circle on the rim is 96 directions, each mapped by skyImage and then by the orbit
  const all = M.scene(["horizon", "equator", "ecliptic", "galactic"].reduce((s, k) => M.toggleOverlay(s, k), st), SIZE);
  assert.deepEqual(all.circles.map((c) => c.key), ["horizon", "equator", "ecliptic", "galactic"]);
  assert.deepEqual(all.circles.map((c) => c.own), [true, false, false, false]);
  const sky = M.skyOf(st), dirs = C.circleDirections("ecl", "hor", sky, 96), circle = all.circles[2];
  assert.equal(circle.points.length, 96);
  circle.points.forEach((p, i) => {
    const n = H.skyImage(st.orbit, H.skyImage(st.view3, dirs[i]).n).n;
    near(p.x, 200 + g.R3 * n[0], 1e-9); near(p.y, 200 - g.R3 * n[1], 1e-9); near(p.z, n[2], 1e-12);
    near(Math.hypot((p.x - 200) / g.R3, (p.y - 200) / g.R3, p.z), 1, 1e-9, "on the rim");
  });
  assert.ok(circle.points.some((p) => p.z < 0) && circle.points.some((p) => p.z > 0), "a far half and a near half");
  assert.equal(all.rays.filter((x) => x.kind === "crossing").length, 0);
  // a depth ring in 3D is its circle in the frame's plane
  const ringed = M.scene(M.toggleOverlay(st, "rings"), SIZE), ring = ringed.rings[3];
  ring.points.forEach((p, i) => { const a = (2 * Math.PI * i) / 96, q = M.screenPoint(st, g, C.chartPoint([Math.cos(a), Math.sin(a), 0], ring.rho)); near(p.x, q.x, 1e-9); near(p.z, q.z, 1e-12); });
  // a drag in 3D changes only the orbit; the turn buttons too
  const dragged = M.dragView(st, SIZE, { x: 100, y: 100 }, { x: 140, y: 90 });
  assert.deepEqual(dragged.view3, st.view3); assert.deepEqual(dragged.c, st.c); assert.notDeepEqual(dragged.orbit, st.orbit);
  assert.deepEqual(dragged.orbit, M.orbitDrag(st.orbit, 40, -10));
  for (const d of ["left", "right", "up", "down"]) { const o = M.orbitTurn(st.orbit, d), I = S.lmul(o, S.linv(o)); for (let i = 0; i < 16; i++) near(I[i], S.IDENT[i], 1e-12); assert.notDeepEqual(o, st.orbit); }
  assert.deepEqual(M.orbitTurn(st.orbit, "sideways"), S.lmul(S.IDENT, st.orbit));
  // 2D and 3D show the same objects
  assert.deepEqual(sc.bodies.map((b) => b.key).sort(), M.scene(M.setDims(st, "2D"), SIZE).bodies.map((b) => b.key).sort());
});

test("chart: dives, disclosure, flights, taps, drags and nudges", () => {
  const st = lit("stargazer"), g = M.geometryOf(SIZE, "2D");
  // the first press centres the midpoint between home and the object, the second the object
  const half = M.dive(st, "m31");
  assert.equal(half.selected, "m31"); assert.deepEqual(half.centred, { key: "m31", half: true });
  const rho = M.objectRho(st, "m31");
  near(M.viewDistance(half), rho / 2, 1e-9, "half way");
  assert.ok(M.hud(half).halfWay && M.hud(half).lines[0].text === "half way");
  const full = M.dive(half, "m31");
  assert.deepEqual(full.centred, { key: "m31", half: false });
  near(M.viewDistance(full), rho, 1e-9);
  const sc = M.scene(full, SIZE), m31 = sc.bodies.find((b) => b.key === "m31");
  near(m31.x, 200, 1e-6); near(m31.y, 200, 1e-6); assert.ok(m31.centred && m31.selected && m31.near);
  assert.deepEqual(M.dive(full, "m31").c, full.c, "a third press stays");
  // during a dive the rings, the home marker and the sight line to the selected body are always drawn
  assert.equal(sc.rings.length, 8); assert.ok(sc.diving);
  assert.ok(Math.hypot(sc.home.x - 200, sc.home.y - 200) > 100);
  near(Math.hypot(sc.home.x - 200, sc.home.y - 200), 182 * Math.tanh(rho / 2), 1e-6, "home is as far from the middle as Andromeda was");
  const sight = sc.rays.find((x) => x.key === "m31-sight");
  assert.ok(sight && sight.kind === "sight");
  near(sight.points[0].x, sc.home.x, 1e-9); near(sight.points[sight.points.length - 1].x, 200, 1e-6);
  assert.equal(M.scene(st, SIZE).rays.length, 0);
  assert.equal(M.scene(M.nudgeView(st, "left"), SIZE).rings.length, 8, "the rings are drawn whenever the view has left home");
  assert.equal(M.scene(M.toggleOverlay(st, "sightLines"), SIZE).rays.filter((x) => x.kind === "sight").length, 8, "the switch draws a line to every body");
  // the Stargazer HUD
  assert.deepEqual(M.hud(full).lines.map((l) => l.text), ["The map slid in a straight line."]);
  assert.deepEqual(M.hud(st).lines, []);
  // Home, and "the rim": the microwave-background shell towards the selection (or the zenith)
  assert.deepEqual(M.dive(full, "home").c, [0, 0]); assert.equal(M.dive(full, "home").centred, null);
  assert.equal(M.goHome(full).selected, "m31");
  const rim = M.dive(M.dive(full, "rim"), "rim");
  assert.equal(rim.selected, "cmb"); near(M.viewDistance(rim), M.VIEW.rimRho, 1e-9);
  const dirM31 = M.objectPoint(st, "m31").dir, cRim = Math.tanh(M.VIEW.rimRho / 2);
  near(rim.c[0], cRim * dirM31[0], 1e-9); near(rim.c[1], cRim * dirM31[1], 1e-9);
  const rimNorth = M.dive(M.dive(st, "rim"), "rim");
  near(rimNorth.c[0], 0, 1e-9); near(rimNorth.c[1], cRim, 1e-9); assert.ok(M.objectPoint(st, "cmb").nominal, "with nothing chosen the rim is met at the top of the map");
  // a point of the rim is approached as far as the map goes, and the Stargazer is told
  const north = M.dive(M.dive(st, "north"), "north");
  near(M.viewDistance(north), M.VIEW.rimRho, 1e-9);
  assert.deepEqual(M.hud(north).lines.map((l) => l.text), ["The map slid in a straight line.", "The edge can never reach the middle. This is as far as the map goes."]);
  near(M.viewDistance(M.dive(M.dive(st, "zenith"), "zenith")), 0, 1e-12, "straight up is the dot at the centre");
  assert.equal(M.dive(st, "pluto"), st); assert.equal(M.dive(st, "light-year"), st);
  // the view follows the centred object when the time changes, and in 3D
  const later = M.stepDay(full, 3).state, m2 = M.scene(later, SIZE).bodies.find((b) => b.key === "m31");
  near(m2.x, 200, 1e-6); near(m2.y, 200, 1e-6);
  const ball = M.setDims(full, "3D"), m3 = M.scene(ball, SIZE).bodies.find((b) => b.key === "m31");
  near(m3.x, 200, 1e-6); near(m3.y, 200, 1e-6); near(M.viewDistance(ball), rho, 1e-9);
  // the Navigator's and the Holographer's HUD, word for word
  assert.equal(M.hud(M.setLens(full, "navigator")).lines[0].text, "this view is the slide T_c that brings the chosen point to the centre, a member of PSU(1,1); going from one such view to another is a slide and a turn");
  assert.equal(M.hud(M.setLens(ball, "navigator")).lines[0].text, "a move of the ball: the 6-parameter group PSL(2,C) acts here");
  assert.ok(M.hud(M.setLens(full, "navigator")).lines[1].text.startsWith("the view's centre is 2.38 from home (disc radius 0.830)"));
  // disclosure: a detail label only within hyperbolic distance 1.5 of the view's centre; elsewhere the short name
  const nav = M.setLens(st, "navigator"), home = M.scene(nav, SIZE);
  for (const b of home.bodies) {
    const p = M.objectPoint(nav, b.key), d = p.point ? S.hypDist(p.point, [0, 0, 0, 1]) : Infinity;
    if (Number.isFinite(d)) near(b.dist, d, 1e-9, b.key); else assert.equal(b.dist, Infinity, b.key);
    assert.equal(b.near, d <= 1.5, b.key);
    const o = M.objectOf(b.key);
    assert.equal(b.label, b.near ? o.label : o.short, b.key);
    if (!b.near) assert.equal(b.detail, "", b.key);
  }
  assert.deepEqual(home.bodies.filter((b) => b.near && b.kind === "body").map((b) => b.key).sort(), ["moon", "sun"]);
  assert.equal(home.bodies.find((b) => b.key === "moon").detail, "25 per cent lit");
  assert.equal(M.scene(M.setLens(full, "navigator"), SIZE).bodies.find((b) => b.key === "m31").detail, "about 2.48 million light-years");
  assert.equal(M.VIEW.near, 1.5);
  // flights: at most 600 ms, along the straight line of the curved map
  const plan = M.flightPlan(st, full);
  assert.ok(plan.ms > 0 && plan.ms <= 600); near(plan.distance, rho, 1e-9);
  assert.deepEqual(plan.at(0).c, [0, 0]); assert.deepEqual(plan.at(1).c, full.c); assert.deepEqual(plan.at(2).c, full.c);
  let last = 0;
  for (let i = 1; i <= 10; i++) {
    const c = plan.at(i / 10).c, d = 2 * Math.atanh(Math.hypot(c[0], c[1]));
    assert.ok(d >= last - 1e-12, "the flight never turns back"); last = d;
    near(Math.atan2(c[1], c[0]), Math.atan2(full.c[1], full.c[0]), 1e-9, "on the line from home to the object");
  }
  const between = M.flightPlan(M.dive(M.dive(st, "moon"), "moon"), full);
  for (const t of [0.25, 0.5, 0.75]) {
    const c = between.at(t).c, P = H.fromBall([c[0], c[1], 0]), A = H.fromBall([between.at(0).c[0], between.at(0).c[1], 0]), B = H.fromBall([full.c[0], full.c[1], 0]);
    near(S.hypDist(A, P) + S.hypDist(P, B), S.hypDist(A, B), 1e-9, "a point of the flight lies on the straight line");
  }
  assert.equal(M.flightPlan(full, full).ms, 0); assert.equal(M.flightPlan(st, ball).ms, 0, "a change of dims is a jump");
  const plan3 = M.flightPlan(M.setDims(st, "3D"), ball);
  assert.ok(plan3.ms <= 600); assert.deepEqual(plan3.at(1).view3, ball.view3);
  near(S.hypDist(S.lapply(S.linv(plan3.at(0.5).view3), [0, 0, 0, 1]), [0, 0, 0, 1]), rho / 2, 1e-9);
  assert.equal(M.VIEW.flightMs, 600);
  // a tap on the Moon centres it; a tap on the map brings that point to the centre; a tap outside changes nothing
  const moon = M.scene(st, SIZE).bodies.find((b) => b.key === "moon");
  assert.equal(M.sceneHit(M.scene(st, SIZE), moon.x + 10, moon.y - 10), "moon");
  assert.equal(M.sceneHit(M.scene(st, SIZE), 5, 5), null);
  const tapped = M.tapView(st, SIZE, moon.x + 3, moon.y + 3);
  assert.equal(tapped.key, "moon"); assert.equal(tapped.state.selected, "moon");
  const after = M.scene(tapped.state, SIZE).bodies.find((b) => b.key === "moon");
  near(after.x, 200, 1e-6); near(after.y, 200, 1e-6);
  const free = M.tapView(st, SIZE, 260, 300);
  assert.equal(free.key, null); assert.equal(free.state.centred, null);
  near(free.state.c[0], 60 / 182, 1e-9); near(free.state.c[1], -100 / 182, 1e-9);
  assert.equal(M.tapView(st, SIZE, 398, 2).state, st);
  assert.equal(M.tapView(fresh(), SIZE, 200, 200).state.site, null);
  // hit-test in reverse paint order: of two objects at one place the one painted last wins
  const two = M.scene(lit("navigator", "3D"), SIZE), zi = two.hits.findIndex((h) => h.key === "zenith"), ci = two.hits.findIndex((h) => h.key === "celestial_sphere");
  near(two.hits[zi].x, two.hits[ci].x, 1e-9);
  assert.equal(M.sceneHit(two, two.hits[zi].x, two.hits[zi].y), two.hits[Math.max(zi, ci)].key);
  // off every dot the nearest object within 22 px wins, whatever the paint order; on a dot, the one painted last
  const pair = { hits: [{ key: "under", x: 100, y: 100, r: 6 }, { key: "over", x: 113, y: 100, r: 6 }] };
  assert.equal(M.sceneHit(pair, 100, 100), "under", "a tap on a dot picks that dot, not a neighbour painted later");
  assert.equal(M.sceneHit(pair, 92, 100), "under"); assert.equal(M.sceneHit(pair, 120, 100), "over");
  assert.equal(M.sceneHit(pair, 106.5, 100), "over", "equally near (and on both dots): the one painted last");
  assert.equal(M.sceneHit(pair, 107, 100), "over"); assert.equal(M.sceneHit(pair, 106, 100), "under");
  assert.equal(M.sceneHit(pair, 100, 123), null); assert.equal(M.sceneHit(pair, 100, 121.5), "under");
  assert.equal(M.sceneHit({ hits: [{ key: "a", x: 50, y: 50, r: 6 }, { key: "b", x: 50, y: 50, r: 6 }] }, 60, 50), "b", "equally near off the dots: the one painted last");
  // a drag: the grabbed point of the map follows the pointer, and the view never turns
  const r = rng(5);
  for (let i = 0; i < 100; i++) {
    const from = { x: 200 + 150 * (r() - 0.5), y: 200 + 150 * (r() - 0.5) }, to = { x: 200 + 150 * (r() - 0.5), y: 200 + 150 * (r() - 0.5) };
    const start = { ...st, c: [0.5 * (r() - 0.5), 0.5 * (r() - 0.5)] };
    const z = S.toBall(S.lapply(S.linv(M.viewMatrix(start)), H.fromBall([(from.x - 200) / 182, -(from.y - 200) / 182, 0])));
    const moved = M.dragView(start, SIZE, from, to);
    if (Math.hypot(moved.c[0], moved.c[1]) >= M.VIEW.maxC - 1e-9) continue;
    const p = M.screenPoint(moved, g, H.fromBall(z));
    near(p.x, to.x, 1e-6); near(p.y, to.y, 1e-6);
    assert.equal(moved.centred, null);
  }
  assert.ok(Math.hypot(...M.dragView(st, SIZE, { x: 200, y: 200 }, { x: -4000, y: 200 }).c) < 1, "a drag never leaves the disc");
  // the four nudge buttons move the view without dragging
  for (const [dir, sx, sy] of [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]]) {
    const n = M.nudgeView(st, dir);
    near(M.viewDistance(n), 0.4, 1e-9, dir);
    const h = M.scene(n, SIZE).home;
    assert.ok(Math.sign(h.x - 200) === -sx && Math.sign(Math.round(h.y - 200)) === -sy, `${dir}: the map moves the other way`);
    near(M.viewDistance(M.nudgeView(M.setDims(st, "3D"), dir)), 0.4, 1e-9, dir + " in 3D");
  }
  assert.equal(M.nudgeView(st, "north"), st);
  let far = st; for (let i = 0; i < 40; i++) far = M.nudgeView(far, "left");
  assert.ok(Math.hypot(...far.c) <= M.VIEW.maxC + 1e-12);
});

test("chart: labels never overlap; home and the centred object are always labelled", () => {
  const boxesOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const check = (sc, what) => {
    for (let i = 0; i < sc.labels.length; i++) for (let j = i + 1; j < sc.labels.length; j++) assert.ok(!boxesOverlap(sc.labels[i], sc.labels[j]), `${what}: ${sc.labels[i].key} and ${sc.labels[j].key} overlap`);
    for (const l of sc.labels) { assert.ok(l.x >= 0 && l.y >= 0 && l.x + l.w <= sc.w && l.y + l.h <= sc.h, `${what}: ${l.key} leaves the canvas`); assert.ok([...l.text].length <= 32); assert.equal(l.h, M.LABEL.height); }
    assert.ok(sc.labels.some((l) => l.key === "home"), `${what}: home is labelled`);
    const labelled = new Set(sc.labels.map((l) => l.key));
    for (const b of sc.bodies) assert.ok(labelled.has(b.key) !== sc.dots.includes(b.key), `${what}: ${b.key} is a label or a dot, not both`);
    for (const c of sc.clusters) { assert.ok(c.count >= 2 && c.keys.length === c.count); for (const k of c.keys) assert.ok(sc.dots.includes(k)); }
  };
  // with Andromeda centred, at the phone's and the desktop's canvas sizes, in 2D and 3D, at every lens
  for (const l of LENSES) for (const dims of ["2D", "3D"]) for (const side of [358, 420, 700]) {
    const st = M.dive(M.dive(M.toggleOverlay(lit(l, dims), "rings"), "m31"), "m31"), sc = M.scene(st, { w: side, h: side });
    check(sc, `${l} ${dims} ${side}`);
    assert.ok(sc.labels.some((x) => x.key === "m31"), "the centred object is labelled");
  }
  // and on random skies, views and switches
  const r = rng(21), sites = C.SITES.map((s) => s.key), objects = ["moon", "sun", "pleiades", "polaris", "vela_pulsar", "cyg_x1", "sgr_a_star", "m31", "north", "cmb", "holography", "memory"];
  for (let i = 0; i < 150; i++) {
    let st = M.setStep(M.setJd(M.chooseSite(fresh(), sites[Math.floor(r() * sites.length)]), 2400000 + r() * 80000), 3);
    st = M.setDims(M.setLens(st, LENSES[i % 3]), i % 2 ? "3D" : "2D");
    if (st.lens !== "stargazer" && r() < 0.4) st = M.setFrame(st, "gal");
    for (const o of M.OVERLAYS) if (r() < 0.4) st = M.toggleOverlay(st, o.key);
    const key = objects[Math.floor(r() * objects.length)];
    if (r() < 0.7) st = M.dive(st, key);
    if (r() < 0.5) st = M.dive(st, key);
    const sc = M.scene(st, { w: 320 + Math.floor(r() * 500), h: 320 + Math.floor(r() * 400) });
    check(sc, `random ${i}`);
    for (const b of sc.bodies) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y) && b.r > 0, b.key);
    if (st.centred && !st.centred.half && M.objectVisible(st, st.centred.key)) assert.ok(sc.labels.some((x) => x.key === st.centred.key), `random ${i}: the centred object is labelled`);
  }
  // the rule itself: forced labels first; another label only if its dot is 28 px clear of every labelled dot
  const items = [
    { key: "a", text: "Alpha", x: 100, y: 100, r: 5, forced: true }, { key: "b", text: "Beta", x: 110, y: 104, r: 5, forced: false },
    { key: "c", text: "Gamma", x: 100, y: 140, r: 5, forced: false }, { key: "d", text: "", x: 300, y: 300, r: 5, forced: false },
    { key: "e", text: "Epsilon", x: NaN, y: 0, r: 5, forced: false }, { key: "f", text: "A very long label that goes on and on and on", x: 250, y: 250, r: 5, forced: false },
  ];
  const placed = M.placeLabels(items, { w: 400, h: 400 });
  assert.deepEqual(placed.labels.map((l) => l.key), ["a", "c", "f"]); assert.deepEqual(placed.dots, ["b", "d", "e"]);
  assert.equal([...placed.labels[2].text].length, 32, "a canvas label is cut to 32 code points");
  assert.equal(M.LABEL.clear, 28); assert.ok(M.LABEL.font >= 13);
  // a measure function from the canvas decides the widths
  const wide = M.placeLabels(items, { w: 400, h: 400, measure: (t) => 20 * [...t].length });
  assert.equal(wide.labels[0].w, 20 * 5 + 2 * M.LABEL.pad);
  // two forced labels at one place do not overlap either
  const same = M.placeLabels([{ key: "home", text: "Home", x: 200, y: 200, r: 5, forced: true }, { key: "zenith", text: "Zenith", x: 200, y: 200, r: 6, forced: true }], { w: 400, h: 400 });
  assert.equal(same.labels.length, 2); assert.ok(!boxesOverlap(same.labels[0], same.labels[1]));
});

test("chart: three points of the rim fix the fourth; the aberration line; the inspector and the telemetry", () => {
  assert.equal(M.threePoints(lit("stargazer")), null);
  const r = rng(9);
  for (let i = 0; i < 120; i++) {
    const flat = i % 2 === 0, base = lit(i % 4 < 2 ? "navigator" : "holographer", flat ? "2D" : "3D");
    const st = flat ? { ...base, c: [1.6 * (r() - 0.5), 1.6 * (r() - 0.5)].map((x) => x * 0.55) } : { ...base, view3: S.lmul(H.centreOn([0.8 * (r() - 0.5), 0.8 * (r() - 0.5), 0.8 * (r() - 0.5)]), S.rotZ(r())) };
    const tp = M.threePoints(st);
    assert.ok(tp, "a read-out"); assert.equal(tp.layer, "checked"); assert.equal(tp.marks.length, 4);
    assert.ok(tp.errorDeg < 1e-6, `predicted and actual agree (${tp.errorDeg})`);
    const Mx = flat ? H.centreOn([st.c[0], st.c[1], 0]) : st.view3;
    tp.marks.forEach((m) => { const n = H.skyImage(Mx, [Math.cos(m.fromDeg * RAD), Math.sin(m.fromDeg * RAD), 0]).n; for (let k = 0; k < 3; k++) near(m.to[k], n[k], 1e-12); });
    if (flat) near(tp.actual.latDeg, 0, 1e-9);
    assert.ok(tp.text.startsWith("Three points of the rim fix the fourth:"));
  }
  // the marks are drawn in the Dive step only
  const diveStep = M.setStep(lit("navigator"), 4);
  assert.equal(M.scene(diveStep, SIZE).marks.length, 4); assert.equal(M.scene(lit("navigator"), SIZE).marks.length, 0); assert.equal(M.scene(M.setLens(diveStep, "stargazer"), SIZE).marks.length, 0);
  for (const m of M.scene(diveStep, SIZE).marks) near(Math.hypot(m.x - 200, m.y - 200), 182, 1e-9, "a mark is on the rim");
  // aberration: only for the Holographer in 3D after a dive; the angles are those skyImage gives
  assert.equal(M.aberrationReadout(lit("holographer", "3D")), null);
  assert.equal(M.aberrationReadout(M.dive(lit("navigator", "3D"), "m31")), null);
  assert.equal(M.aberrationReadout(M.dive(lit("holographer", "2D"), "m31")), null);
  for (const key of ["m31", "moon", "sgr_a_star", "polaris"]) for (const of of [key, "sun", "zenith"]) {
    const st = M.select(M.dive(M.dive(lit("holographer", "3D"), key), key), of), ab = M.aberrationReadout({ ...st, centred: { key, half: false } });
    const d = M.objectRho(st, key), u = M.objectDirection(st, key);
    near(ab.d, d, 1e-9); near(ab.beta, Math.tanh(d), 1e-12);
    const n = M.objectDirection(st, ab.of), image = H.skyImage(H.centreOn(S.toBall(C.chartPoint(u, d))), n).n;
    const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / RAD;
    near(ab.beforeDeg, angle(n, u), 1e-7, `${key} ${of} before`); near(ab.afterDeg, angle(image, u), 1e-6, `${key} ${of} after`);
    assert.ok(ab.afterDeg > ab.beforeDeg, "the rim flees from the point dived to");
    assert.ok(ab.beforeDeg > 0.05, "the point followed is not the one dived to");
    assert.ok(ab.text.startsWith("β = tanh d = " + Math.tanh(d).toFixed(4)));
  }
  // the inspector: title, glyph, status, one paragraph for the lens, rows each with a layer
  const nav = lit("navigator"), sky = M.skyOf(nav);
  for (const o of M.objectList(M.select(nav, "moon"))) {
    const ins = M.inspector(M.select(nav, "moon"), o.key);
    assert.ok(ins && ins.title && ins.glyph && LAYERS.includes(ins.status.layer) && ins.paragraph.every(isSentence), o.key);
    for (const row of ins.rows) assert.ok(LAYERS.includes(row.layer) && row.label && row.value, `${o.key}: ${row.label}`);
    if (o.kind === "body") assert.deepEqual(ins.rows.map((x) => x.layer).filter((x, i, a) => a.indexOf(x) === i).sort().includes("reading"), true, "chart depth is READING");
  }
  const moon = M.inspector(nav, "moon"), rowOf = (ins, label) => ins.rows.find((x) => x.label.startsWith(label));
  assert.equal(rowOf(moon, "Altitude").value, sky.moon.alt.toFixed(1) + "°");
  assert.equal(rowOf(moon, "Altitude").label, "Altitude (seen from your place)");
  assert.ok(rowOf(moon, "Direction round the horizon").value.startsWith(sky.moon.az.toFixed(1) + "° from north through east"));
  assert.ok(!moon.rows.some((x) => /azimuth/i.test(x.label)));
  assert.equal(rowOf(moon, "Shape").value, "Waxing Crescent, 25 per cent lit");
  assert.equal(rowOf(moon, "Depth on this chart").layer, "reading");
  const pl = M.inspector(nav, "pleiades");
  assert.equal(rowOf(pl, "Distance").layer, "said"); assert.equal(rowOf(pl, "Distance").value, "about 444 light-years (range used here: 434 to 450 light-years)");
  assert.equal(rowOf(pl, "Depth on this chart").value, "disc radius 0.73 (ρ = 1.87)");
  assert.equal(rowOf(M.inspector(nav, "sun"), "Season").value, M.seasonLine(nav).text);
  // Polaris: the pole distance of date; never called the pole star when that exceeds 2 degrees
  assert.equal(rowOf(M.inspector(nav, "polaris"), "Distance from the north celestial pole").value, "0.6° (the pole star)");
  assert.equal(rowOf(M.inspector(M.setStep(kebar(), 3), "polaris"), "Distance from the north celestial pole").value, "15.0° (no pole star on this date)");
  assert.equal(rowOf(M.inspector(nav, "zenith"), "Direction round the horizon").value, "straight up has no compass direction");
  // objects without a three-lens text still say what they are
  assert.equal(M.inspector(nav, "north").paragraph[0].text, "The north point of your horizon: a tick on the rim of the flat map.");
  assert.equal(M.inspector(lit("stargazer"), "east").paragraph[0].text, "This is east on your horizon: a mark on the edge of the flat map.");
  const ringView = M.inspector(M.toggleOverlay(nav, "rings"), "light-year");
  assert.deepEqual({ ...ringView.paragraph[0] }, { layer: "reading", text: "A ring of this chart's depth scale: a thing 1 light-year away is drawn on it. The scale is this project's choice." });
  assert.equal(ringView.status.layer, "reading"); assert.equal(M.inspector(nav, "light-year"), null, "a ring is there when the rings are drawn");
  assert.ok(M.inspector(M.setFrame(nav, "gal"), "galactic_centre").paragraph[0].text.startsWith("The zero of galactic longitude"));
  assert.equal(M.inspector(nav, "pluto"), null); assert.equal(M.inspector(nav, "shadow"), null); assert.equal(M.inspector(fresh(), "moon"), null);
  assert.equal(M.inspector(lit("stargazer"), "moon").title, "Moon");
  assert.equal(rowOf(M.inspector(lit("stargazer"), "moon"), "Where to look").value, "up, south-west");
  assert.deepEqual(M.inspector(lit("stargazer"), "polaris").rows.map((x) => x.label + ": " + x.value), ["Where to look: up, north", "How far: about 434 light-years", "From the sky's turning point: 0.6 degrees on this day", "On this map: 73 per cent of the way to the edge"]);
  assert.deepEqual(M.inspector(lit("stargazer"), "holography").rows.map((x) => x.label + ": " + x.value), ["On this map: a point of the edge"]);
  assert.equal(M.inspector(lit("stargazer"), "holography").paragraph[0].text, M.objectOf("holography").text.stargazer[0].text);
  for (const o of M.objectList(lit("stargazer"))) for (const x of M.inspector(lit("stargazer"), o.key).rows) assert.ok(!/°|ρ|declination|celestial pole/.test(x.label + x.value), `${o.key}: ${x.label}`);
  assert.equal(M.inspector(M.setFrame(nav, "gal"), "sgr_a_star").rows[0].label, "Galactic longitude");
  // the telemetry: hidden from the Stargazer; the conformal factor at the selected point's place on screen
  assert.deepEqual(M.telemetry(lit("stargazer"), SIZE), []); assert.deepEqual(M.telemetry(fresh(), SIZE), []);
  const tel = M.telemetry(M.select(nav, "moon"), SIZE), value = (k) => tel.find((x) => x.key === k).value;
  assert.deepEqual(tel.map((x) => x.key), ["date", "jd", "deltaT", "lst", "sun", "moon", "view", "conformal"]);
  assert.equal(value("date"), "14 November 2026, 18:00 local mean time"); assert.equal(value("jd"), nav.jdUt.toFixed(5));
  assert.ok(value("deltaT").startsWith(Math.round(sky.deltaT) + " s ± " + sky.deltaTSigma.toFixed(1) + " s"));
  assert.equal(value("lst"), C.formatClock(sky.last / 15)); assert.equal(value("sun"), sky.sun.lambda.toFixed(2) + "°"); assert.equal(value("moon"), sky.phase.elongation.toFixed(2) + "°");
  const mp = M.screenPoint(nav, M.geometryOf(SIZE, "2D"), M.objectPoint(nav, "moon").point);
  assert.equal(value("conformal"), H.conformalFactor(mp.ball).toFixed(2));
  assert.equal(tel.find((x) => x.key === "conformal").label, "Conformal factor 2 / (1 − |w|²) at the selected point's present position on screen");
  assert.equal(M.telemetry(M.dive(M.dive(nav, "moon"), "moon"), SIZE).find((x) => x.key === "conformal").value, "2.00", "2 at the centre");
  assert.equal(M.telemetry(nav, SIZE).find((x) => x.key === "conformal").value, "nothing selected");
  assert.equal(M.telemetry(M.select(nav, "north"), SIZE).find((x) => x.key === "conformal").value, "without bound (a point of the rim)");
  // the opposite point: exactly opposite the selection, on the rim
  const sel = M.select(nav, "moon"), sc = M.scene(sel, SIZE), anti = sc.bodies.find((b) => b.key === "antipode"), m = sc.bodies.find((b) => b.key === "moon");
  assert.ok(anti && anti.atRim); near(Math.hypot(anti.x - 200, anti.y - 200), 182, 1e-9);
  near(Math.atan2(anti.y - 200, anti.x - 200), Math.atan2(200 - m.y, 200 - m.x), 1e-9);
  assert.ok(!M.scene(nav, SIZE).bodies.some((b) => b.key === "antipode"), "nothing selected, no opposite point");
  assert.deepEqual(M.objectDirection(sel, "antipode"), M.objectDirection(sel, "moon").map((x) => -x));
});

test("chart: any order of actions leaves a state every view can draw", () => {
  const r = rng(77), pick = (a) => a[Math.floor(r() * a.length)];
  const keys = [...M.OBJECTS.map((o) => o.key), "home", "rim", "pluto"], sites = C.SITES.map((s) => s.key);
  const actions = [
    (s) => M.chooseSite(s, pick(sites)), (s) => M.typePlace(s, 180 * r() - 90, 360 * r() - 180).state, (s) => M.confirmDay(s),
    (s) => M.setJd(s, 1000000 + 1800000 * r()), (s) => M.stepDay(s, Math.round(60 * r() - 30)).state, (s) => M.timeButton(s, pick(["now", "sunrise", "noon", "sunset", "midnight"]), NOW_MS).state,
    (s) => M.pickDate(s, { year: Math.round(5000 * r() - 2000), month: 1 + Math.floor(12 * r()), day: 1 + Math.floor(31 * r()) }).state,
    (s) => M.setDayOfYear(s, 1 + Math.floor(366 * r())), (s) => M.setClock(s, 24 * r()), (s) => M.findMoon(s, pick(C.PHASE_TARGETS).target).state,
    (s) => M.ezekielSky(s, pick(C.EZEKIEL_DATES).key, pick(["ends", "begins"])), (s) => M.setLens(s, pick(LENSES)), (s) => M.setDims(s, pick(["2D", "3D"])),
    (s) => M.setFrame(s, pick(["hor", "gal"])), (s) => M.setStep(s, 1 + Math.floor(5 * r())), (s) => M.toggleOverlay(s, pick(M.OVERLAYS).key),
    (s) => M.select(s, pick(keys)), (s) => M.dive(s, pick(keys)), (s) => M.dive(s, pick(keys)), (s) => M.goHome(s),
    (s) => M.nudgeView(s, pick(["up", "down", "left", "right"])), (s) => M.dragView(s, SIZE, { x: 400 * r(), y: 400 * r() }, { x: 400 * r(), y: 400 * r() }),
    (s) => M.tapView(s, SIZE, 400 * r(), 400 * r()).state, (s) => ({ ...s, orbit: M.orbitTurn(s.orbit, pick(["up", "down", "left", "right"])) }),
    (s) => M.applyHash(s, pick(["#preset=ezekiel", "#lab=square", "#focus=" + pick(keys), "#site=" + pick(sites) + "&lens=" + pick(LENSES), "#lat=12.5&lon=-70.25&jd=2460000.5", "#junk=1"])),
    (s) => M.openLab(s), (s) => M.closeLab(s), (s) => ({ ...s, lab: M.labSlide(s.lab, pick(M.LAB.four)) }), (s) => ({ ...s, lab: M.labHome(s.lab) }), (s) => ({ ...s, lab: M.labSetA(s.lab, 2 * r(), r() < 0.5) }),
  ];
  for (let run = 0; run < 200; run++) {
    let st = fresh();
    for (let step = 0; step < 25; step++) {
      st = pick(actions)(st);
      assert.ok(LENSES.includes(st.lens) && ["2D", "3D"].includes(st.dims) && ["hor", "gal"].includes(st.frame) && st.step >= 1 && st.step <= 5);
      assert.ok(Number.isFinite(st.jdUt) && Math.hypot(st.c[0], st.c[1]) < 1 && st.view3.every(Number.isFinite) && st.orbit.every(Number.isFinite), `run ${run} step ${step}`);
      if (st.site) assert.ok(C.skyInputsValid(st.jdUt, st.site.lat, st.site.lonEast), "the sky of a state can always be computed");
      if (st.lens === "stargazer") assert.equal(st.frame, "hor");
      if (st.selected) assert.ok(M.objectVisible(st, st.selected), `run ${run} step ${step}: the selection ${st.selected} is shown`);
    }
    const size = { w: 300 + Math.floor(500 * r()), h: 300 + Math.floor(400 * r()) }, sc = M.scene(st, size);
    for (const b of sc.bodies) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z) && b.r > 0 && typeof b.label === "string" && b.label !== "", `run ${run}: ${b.key}`);
    for (const group of [sc.rings, sc.circles, sc.rays]) for (const g of group) for (const p of g.points) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `run ${run}: ${g.key}`);
    assert.deepEqual(sc.bodies.map((b) => b.key).sort(), M.objectList(st).filter((o) => o.kind !== "ring").map((o) => o.key).sort());
    for (const o of M.objectList(st)) { const ins = M.inspector(st, o.key); assert.ok(ins && ins.paragraph.length >= 1 && ins.paragraph.every(isSentence), `run ${run}: ${o.key}`); }
    for (const fn of [() => M.telemetry(st, size), () => M.hud(st), () => M.moonFigure(st), () => M.moonButtons(st), () => M.threePoints(st), () => M.aberrationReadout(st), () => M.statusSentence(st),
      () => M.dateView(st), () => M.dayQuestion(st), () => M.seasonLine(st), () => M.placeReadout(st), () => M.dayReadout(st), () => M.skyLinkHref(st), () => M.lexiconSkyHref(st), () => M.sceneCaption(st),
      () => M.labScene(st.lab, size), () => M.labReadout(st.lab, st.lens), () => M.stepView(st.step, st.lens)]) assert.doesNotThrow(fn, `run ${run}`);
    // the link of a state brings back its place, its time and its lens
    if (st.site) {
      const back = M.initialState({ hash: M.skyLinkHref(st).slice(KIT.LINKS.celestialControlPanel.length), nowMs: 0 });
      assert.equal(back.notes.link, "", `run ${run}`); assert.equal(back.lens, st.lens); near(back.jdUt, st.jdUt, 0.000006, `run ${run}`);
    }
  }
});

// ─── the Moon picture ────────────────────────────────────────────────────────

test("Moon: the picture as it looks from the place, its words, the eight buttons", () => {
  const k = kebar("navigator"), m = M.moonFigure(k), sky = M.skyOf(k);
  near(m.fraction, 0.502, 0.003); assert.equal(m.percent, 50); assert.ok(m.waxing); assert.equal(m.name, "First Quarter");
  near(m.limbDeg, 91.0, 0.5, "the lit side to the right, level"); assert.equal(m.clock, 3); assert.equal(m.lean, "bright side towards 3 o'clock");
  near(m.terminator, 2 * sky.phase.illuminatedFraction - 1, 1e-12); near(m.ageDays, 6.78, 0.02);
  assert.equal(m.limbDeg, sky.phase.brightLimbFromZenith);
  assert.equal(m.label, "The Moon now: 50 per cent lit, growing, bright side towards 3 o'clock");
  assert.deepEqual(m.lines, ["First Quarter, 50 per cent lit.", "6.8 days after new Moon.", "bright side towards 3 o'clock"]);
  assert.equal(m.question.text, "Does my Moon look like yours? If not, check three things in this order: the place (north or south of the equator turns it over), the day, the time.");
  assert.deepEqual(M.moonFigure(M.setLens(k, "stargazer")).lines.slice(0, 2), ["half Moon (astronomers say First Quarter: a quarter of the way round its month), growing.", "50 per cent lit."]);
  // the example of 1.6
  const g = atGreenwich();
  assert.equal(M.moonFigure(g).label, "The Moon now: 25 per cent lit, growing, bright side towards 4 o'clock");
  // below the horizon: dimmed, said, and the question is not asked
  const down = M.setClock(g, 6), md = M.moonFigure(down);
  assert.ok(M.skyOf(down).moon.alt < 0);
  assert.ok(md.below); assert.equal(md.label, "The Moon now: below the horizon"); assert.equal(md.question, null);
  assert.ok(md.lines.includes("The Moon is below the ground right now.")); assert.equal(M.MOON_COPY.below, "The Moon is below the ground right now");
  assert.ok(M.statusSentence(down).endsWith("below the horizon."));
  assert.ok(!m.below && m.question);
  // north or south of the equator turns it over
  const evening = C.jdFromParts({ year: 2025, month: 3, day: 6, hour: 18, minute: 30 });
  const north = M.moonFigure(M.confirmDay(M.setJd(M.chooseSite(fresh(), "greenwich"), evening)));
  const south = M.moonFigure(M.confirmDay(M.setJd(M.typePlace(fresh(), -33.45, -70.67).state, evening + 5 / 24)));
  assert.ok(north.limbDeg < 180 && south.limbDeg > 180);
  near(north.limbDeg, 105.35, 0.5);
  // a nearly new or nearly full Moon has no lean to speak of
  const full = M.moonFigure(M.findMoon(g, 180).state);
  assert.ok(full.percent >= 98); assert.equal(full.lean, ""); assert.ok(!full.label.includes("o'clock"));
  // the eight buttons: the shapes of the eight names, leaning as the large picture does
  const buttons = M.moonButtons(k);
  assert.deepEqual(buttons.map((b) => b.name), C.PHASE_TARGETS.map((p) => p.name));
  assert.deepEqual(buttons.map((b) => Math.round(100 * b.fraction)), [0, 15, 50, 85, 100, 85, 50, 15]);
  for (const b of buttons) { near(b.terminator, 2 * b.fraction - 1, 1e-12); assert.equal(b.waxing, b.target < 180); near(b.limbDeg, b.waxing ? m.limbDeg : (m.limbDeg + 180) % 360, 1e-9); }
  assert.deepEqual(M.moonButtons(M.setLens(k, "stargazer")).map((b) => b.label), ["new Moon", "thin Moon, growing", "half Moon, growing", "nearly full Moon, growing", "full Moon", "nearly full Moon, shrinking", "half Moon, shrinking", "thin Moon, shrinking"]);
  assert.equal(M.moonButtons(fresh()).length, 8);
  assert.equal(M.MOON_COPY.findLabel, "Find the next night with this Moon"); assert.equal(M.MOON_COPY.changesDay, "this changes the day");
});

// ─── the lab ─────────────────────────────────────────────────────────────────

test("lab: they turned not when they went", () => {
  assert.equal(M.LAB.caption, "This is the curved map by itself. It is not the sky.");
  assert.deepEqual({ ...M.LAB_COPY.title }, { layer: "text", text: "they turned not when they went", source: "26.1.9", name: "Ezekiel 1:9, King James Version" });
  assert.ok(VERSES.get("26.1.9")[4].includes(M.LAB_COPY.title.text));
  assert.deepEqual({ ...M.LAB_COPY.slide }, { forward: "Slide forward", left: "Slide left", back: "Slide back", right: "Slide right" });
  assert.deepEqual(Object.keys(M.LAB_COPY.slide), [...M.LAB.four]);
  assert.deepEqual([M.LAB_COPY.open, M.LAB_COPY.four, M.LAB_COPY.next, M.LAB_COPY.home, M.LAB_COPY.again, M.LAB_COPY.tile, M.LAB_COPY.challenge], ["Open the lab", "Four slides", "Next slide", "Slide home", "Start again", "Slide round one tile", "Find the step that brings five slides home"]);
  assert.equal(M.LAB_COPY.tileNote.text, "On this floor five squares meet at every corner.");
  assert.equal(Math.round((2 * Math.PI) / H.tilingConstants(4, 5).angle), 5);
  assert.equal(M.verseSlice("26.1.9", "they turned", "went"), "they turned not when they went", "the lab's title is cut from Ezekiel 1:9");
  const lab = M.labStart();
  assert.deepEqual(lab, { open: false, a: 1, slides: [], home: false, tiling: false });
  assert.equal(M.labReadout(lab, "stargazer").text, "Press a slide button. The walker slides and never turns.");
  assert.equal(M.openLab(fresh()).lab.open, true); assert.equal(M.closeLab(M.openLab(fresh())).lab.open, false);
  assert.equal(M.setStep(M.openLab(M.setStep(atGreenwich(), 4)), 3).lab.open, false, "leaving the step leaves the lab");
  // the four slide buttons; "Next slide" walks through "Four slides"
  let l = lab; const order = [];
  for (let n = M.labNext(l); n; n = M.labNext(l)) { order.push(n); l = M.labSlide(l, n); }
  assert.deepEqual(order, ["forward", "left", "back", "right"]);
  assert.deepEqual(l, M.labFour(lab));
  assert.equal(M.labNext(M.labSlide(lab, "left")), null); assert.equal(M.labSlide(lab, "up"), lab);
  assert.ok(M.LAB.four.length * M.LAB.slideMs <= 8000, "the animation lasts at most 8 s");
  const frames = M.labFrames(l), walked = H.walk(1, Math.PI / 2, 4);
  assert.equal(frames.length, 5);
  near(S.hypDist(S.originOf(frames[4]), S.originOf(walked)), 0, 1e-9, "the slides end where the walker of the core ends");
  const out = M.labReadout(l, "stargazer");
  assert.equal(out.text, "You are 0.87 of a step from home. Sliding home, you face 78 degrees to the right of where you began.");
  assert.equal(out.flat, "On a flat floor these slides would bring you back home, not turned.");
  near(out.distance, H.squareWalkGap(1), 1e-12); near(out.turnClockwise, H.squareWalkTurn(1), 1e-12); near(out.turnDeg, 78.0148, 1e-4);
  assert.equal(out.area, null, "the area is shown only after Slide home"); assert.deepEqual(out.closed, [], "closed forms from Navigator up");
  assert.deepEqual(M.labReadout(l, "navigator").closed, ["gap = 2 · asinh(2√2 · cosh(a/2) · sinh³(a/2)) = 0.874463", "turn = 2 · atan2(sinh²(a) / 2, 1 − 2 · sinh⁴(a/2)) = 78.0148°"]);
  // "Slide home": one straight slide; the walker is home, turned by the area it went round
  const home = M.labHome(l), back = M.labReadout(home, "stargazer");
  assert.equal(home.slides.length, 5); assert.ok(home.home && home.slides[4].home);
  near(home.slides[4].dist, H.squareWalkGap(1), 1e-12);
  assert.ok(back.distance < 1e-9);
  assert.equal(back.text, "You are home. You face 78 degrees to the right of where you began. No slide turned you.");
  assert.equal(back.area.text, "the area inside your five-sided path: 1.362 (the turn, measured in radians)");
  near(back.area.value, H.squareWalkTurn(1), 1e-9);
  const last = M.labFrames(home)[5];
  near(Math.atan2(last[4], last[0]), -H.squareWalkTurn(1), 1e-9, "home, and turned to the right");
  assert.deepEqual(M.labHome(home), home);
  assert.equal(M.labSlide(home, "forward").slides.length, 1, "after Slide home a slide starts a new path");
  assert.equal(M.labHome(lab).slides.length, 0);
  // one straight slide turns nothing; there and back turns nothing
  assert.equal(M.labReadout(M.labHome(M.labSlide(lab, "forward")), "stargazer").text, "You are home. You face not turned.".replace("You face not turned.", "You face not turned."));
  near(M.labReadout(M.labSlide(M.labSlide(lab, "forward"), "back"), "navigator").turnClockwise, 0, 1e-12);
  near(M.labReadout(M.labSlide(lab, "forward"), "navigator").turnClockwise, 0, 1e-12);
  // forward then left is turned to the right; forward then right to the left
  near(M.labReadout(M.labSlide(M.labSlide(lab, "forward"), "left"), "navigator").turnDeg, 24.109145, 1e-5);
  assert.ok(M.labReadout(M.labSlide(M.labSlide(lab, "forward"), "right"), "navigator").text.includes("24 degrees to the left"));
  assert.equal(M.labReadout(M.labSlide(lab, "forward"), "stargazer").flat, "On a flat floor you would be 1.00 of a step from home, not turned.");
  // the step slider: 0.25 to 1.5 (to 1.25 on a small canvas), default 1; the slides follow it
  assert.equal(M.labSetA(l, 9, false).a, 1.5); assert.equal(M.labSetA(l, 9, true).a, 1.25); assert.equal(M.labSetA(l, 0, false).a, 0.25); assert.equal(M.LAB.aDefault, 1);
  const wide = M.labSetA(home, 1.5, false);
  assert.equal(wide.slides.length, 4); assert.ok(!wide.home && wide.slides.every((s) => s.dist === 1.5));
  near(M.labReadout(wide, "navigator").distance, H.squareWalkGap(1.5), 1e-12);
  near(M.labReadout(M.labSetA(l, 1.75, false), "navigator").distance, H.squareWalkGap(1.5), 1e-12);
  assert.deepEqual(M.labReset(home), lab);
  // the {4,5} floor and "Slide round one tile"
  const tile = M.labTile(lab), tr = M.labReadout(tile, "navigator");
  assert.ok(tile.tiling && tile.slides.length === 4);
  assert.deepEqual(tile.slides.map((s) => Math.round(s.angle / RAD)), [0, 108, 216, 324]);
  for (const s of tile.slides) near(s.dist, 1.253739, 5e-7);
  assert.ok(tr.distance < 1e-9); assert.equal(tr.tile, "home again, turned 72° clockwise, the area of the tile");
  near(tr.turnClockwise, H.tilingConstants(4, 5).area, 1e-9);
  assert.equal(M.labReadout(l, "navigator").tile, null);
  // the walker's corners are corners of the floor: five squares at every corner, one of them walked round
  const sc = M.labScene(tile, SIZE), corners = sc.path.map((p) => p.points[p.points.length - 1]);
  assert.ok(sc.tiles.length > 50 && sc.tiles.every((poly) => poly.length === 24));
  const isCorner = (p) => sc.tiles.some((poly) => [0, 6, 12, 18].some((i) => Math.hypot(poly[i].x - p.x, poly[i].y - p.y) < 1e-6));
  for (const p of [...corners, sc.home]) assert.ok(isCorner(p), "a corner of the path is a corner of a tile");
  assert.equal(sc.tiles.filter((poly) => [0, 6, 12, 18].some((i) => Math.hypot(poly[i].x - 200, poly[i].y - 200) < 1e-6)).length, 5, "five squares meet at home");
  assert.equal(sc.tiles.filter((poly) => [...corners, sc.home].every((p) => [0, 6, 12, 18].some((i) => Math.hypot(poly[i].x - p.x, poly[i].y - p.y) < 1e-6))).length, 1, "the path is the edge of one tile");
  assert.equal(M.labScene(l, SIZE).tiles.length, 0); assert.ok(M.labScene(M.labToggleTiling(l), SIZE).tiles.length > 50);
  for (const poly of sc.tiles) for (const p of poly) assert.ok(Math.hypot(p.x - 200, p.y - 200) < 182);
  // the stage: home in the middle, the path inside the disc, a walker with a heading
  const stage = M.labScene(l, SIZE);
  assert.equal(stage.caption, M.LAB.caption); assert.deepEqual(stage.home, { x: 200, y: 200 }); assert.equal(stage.outline.r, 182);
  assert.equal(stage.path.length, 4);
  near(stage.path[0].points[0].x, 200, 1e-9); near(stage.path[0].points[stage.path[0].points.length - 1].x, 200 + 182 * Math.tanh(0.5), 1e-9);
  for (const seg of stage.path) for (const p of seg.points) assert.ok(Math.hypot(p.x - 200, p.y - 200) < 182);
  near(Math.hypot(stage.walker.hx, stage.walker.hy), 1, 1e-12);
  { const b = S.toBall(S.originOf(frames[4])); near(stage.walker.x, 200 + 182 * b[0], 1e-9); near(stage.walker.y, 200 - 182 * b[1], 1e-9); }
  near(M.labScene(lab, SIZE).walker.hx, 1, 1e-12, "the walker starts facing forward");
  // a pose during a slide lies on that slide
  assert.deepEqual(M.labPose(l, 2, 0), frames[2]); for (let i = 0; i < 16; i++) near(M.labPose(l, 2, 1)[i], frames[3][i], 1e-12);
  assert.deepEqual(M.labPose(l), frames[4]); assert.deepEqual(M.labPose(l, 7, 0.5), frames[4]);
  const mid = S.originOf(M.labPose(l, 0, 0.5));
  near(S.hypDist(mid, [0, 0, 0, 1]), 0.5, 1e-12);
  { const p = M.labScene(l, SIZE, M.labPose(l, 0, 0.5)); near(p.walker.x, 200 + 182 * Math.tanh(0.25), 1e-9); }
  // the challenge: five slides come home at 2 · acosh(√2 · cos(π/5))
  assert.deepEqual([...M.LAB.five], ["forward", "left", "back", "right", "forward"]);
  assert.ok(M.fiveSlides(M.LAB.fiveSide).gap < 1e-9);
  assert.ok(M.fiveSlides(1.06).success && M.fiveSlides(1.0613).success && !M.fiveSlides(1.07).success && !M.fiveSlides(1.05).success && !M.fiveSlides(1).success);
  assert.equal(M.fiveSlides(1.06).text, "Home. The exact step is 2 · acosh(√2 · cos(π/5)) = 1.061275: five right-angled corners close up.");
  assert.equal(M.fiveSlides(1).text, "After five slides you are 0.169 from home.");
  near(M.fiveSlides(1).gap, H.homecoming(H.slidePath([0, Math.PI / 2, Math.PI, -Math.PI / 2, 0].map((angle) => ({ angle, dist: 1 })))[5]).distance, 1e-12);
  assert.equal(M.LAB.fiveTolerance, 0.005);
  // far from home the turn is not printed as a number
  let farLab = M.labSetA(lab, 1.5, false); for (let i = 0; i < 12; i++) farLab = M.labSlide(farLab, "forward");
  assert.equal(M.labReadout(farLab, "navigator").turnClockwise, null); assert.ok(M.labReadout(farLab, "navigator").text.includes("too far"));
});

// ─── the seal ────────────────────────────────────────────────────────────────

test("seal: this sky as a lexicon, from three rounded numbers", async () => {
  assert.equal(M.sealView(null, "navigator"), null); assert.equal(M.sealView(fresh().seal, "navigator"), null);
  const none = await M.sealSky(fresh(), { at: "2026-11-15T00:00:00.000Z" });
  assert.equal(none.ok, false); assert.equal(none.wire, null);
  const k = kebar("navigator"), epochs = [];
  const seal = await M.sealSky(k, { at: "2026-11-15T00:00:00.000Z", onEpoch: (p) => { epochs.push(M.epochLine(p, "navigator")); } });
  assert.ok(seal.ok);
  assert.deepEqual(epochs, ["epoch 1 of 4", "epoch 2 of 4", "epoch 3 of 4", "epoch 4 of 4"]);
  assert.equal(M.epochLine({ epoch: 3, epochs: 4 }, "stargazer"), "part 3 of 4");
  assert.deepEqual(seal.inputs, { jd: "1505042.16624", lat: "32.13", lon: "45.23" });
  assert.deepEqual(seal.rows, C.skyLexiconRows(C.skyState(1505042.16624, 32.13, 45.23)));
  assert.equal(seal.entries.length, 25); assert.equal(seal.bundle.lineage.length, 4);
  assert.match(seal.chainId, /^BC-[0-9a-f]{24}$/);
  assert.equal(seal.fileName, "hyperpack-" + seal.chainId + ".json");
  assert.match(seal.fileName, KIT.DOWNLOAD_NAME);
  assert.equal(seal.link, "../Lexicon_Explorer/index.html#sky=1505042.16624,32.13,45.23&lens=navigator");
  assert.ok(KIT.isAllowedUrl(seal.link));
  assert.ok(seal.kebar);
  // the package is the wire text, and the front door accepts it
  assert.equal(seal.wire, JSON.stringify(seal.pack));
  assert.equal(seal.pack.format, "HYPERPACK/1"); assert.equal(seal.certificate.format, "OVERWATCH/1");
  assert.ok(seal.report.checks.every((c) => c.ok === true));
  for (const e of seal.entries) { assert.ok(e.line.startsWith("LEX/1|" + e.address + "|" + e.layer + "|" + e.kind + "|")); assert.equal(e.line.split("|").length, 6, "LEX/1|address|layer|kind|name|text"); }
  assert.ok(copyText("seal say holographer 0").includes("25 LEX/1 lines, each LEX/1|address|layer|kind|name|text"));
  const read = await S.readHyperpack(seal.wire);
  assert.ok(read.ok, read.failed);
  assert.deepEqual(S.entriesOfPack(read.pack).map((e) => e.line), seal.entries.map((e) => e.line));
  // everyone who seals this same sky gets this same name: another key, another moment, unrounded inputs
  const again = await M.sealSky(M.setJd(M.typePlace(fresh(), 32.1312, 45.2288).state, 1505042.166243), { at: "2031-01-01T00:00:00.000Z" });
  assert.equal(again.chainId, seal.chainId);
  assert.notEqual(again.certificate.sealId, seal.certificate.sealId, "a key made for this visit");
  assert.ok(again.kebar);
  // the Lexicon Explorer, given the same three numbers, builds the same rows
  if (OTHER && typeof OTHER.skyLexicon === "function") {
    const theirs = OTHER.skyLexicon([1505042.16624, 32.13, 45.23]);
    assert.ok(theirs.ok);
    assert.deepEqual(theirs.lexicon.entries.map((e) => e.line), seal.entries.map((e) => e.line));
  }
  // another sky, another name; and it is not the Kebar preset
  const other = await M.sealSky(atGreenwich(), { at: "2026-11-15T00:00:00.000Z" });
  assert.ok(other.ok); assert.notEqual(other.chainId, seal.chainId); assert.equal(other.kebar, false);
  assert.equal(other.link, M.lexiconSkyHref(atGreenwich()));
  // what the step prints: a pass is worded "unchanged since it was sealed"
  const view = M.sealView(seal, "navigator");
  assert.ok(view.ok); assert.equal(view.verdict, "Every check passed: unchanged since it was sealed.");
  assert.equal(view.chainName, seal.chainId, "the chain name is shown large for the Kebar preset");
  assert.equal(M.sealView(other, "navigator").chainName, null);
  assert.deepEqual(view.rows.map((x) => x.key), ["chain", "inputs", "entries", "epochs", "key"]);
  assert.ok(view.rows.find((x) => x.key === "key").value.startsWith(seal.certificate.sealId));
  assert.deepEqual(view.notes.map((n) => n.text), ["This link and this file contain the place and the time you entered.",
    "One seal is one witness. By the rule quoted here that settles nothing until others check it too: open it in the Lexicon Explorer and let the receivers answer.",
    "Everyone who seals this same sky gets this same name. Compare with a friend."]);
  assert.equal(view.notes[1].layer, "reading");
  assert.ok(view.checks.length >= 8 && view.checks.every((c) => c.ok === true));
  assert.deepEqual(M.sealView(seal, "holographer").rows.map((x) => x.key), ["chain", "inputs", "entries", "epochs", "key", "commitment"]);
  const sv = M.sealView(seal, "stargazer");
  assert.equal(sv.verdict, "The stamp fits: this exact writing is unchanged since it was stamped.");
  assert.deepEqual(sv.rows.map((x) => x.key), ["chain"]);
  assert.equal(M.sealView(other, "navigator").notes.length, 2);
  for (const l of LENSES) assert.ok(!/^all checks pass/i.test(M.SEAL_COPY.pass[l]));
  assert.equal(M.packageFileName("BC-0123456789abcdef01234567"), "hyperpack-BC-0123456789abcdef01234567.json");
  for (const bad of ["BC-XYZ", "../x", "BC-0123456789abcdef0123456", null, 5]) assert.equal(M.packageFileName(bad), null);
  // what the seal covers: the wording of the Lexicon Explorer's last station
  assert.equal(M.CERTIFIED.map((s) => s.text).join(" "), "Certified: these bytes, their order, their addresses, the label each entry was given, the lineage and the ledger, unchanged since they were sealed with this key. Not certified: that a TEXT entry matches its source, that a SAID entry is faithful, that a CHECKED number is right, that any READING is true, or who sealed it.");
  assert.equal(copyText("seal stand 1"), M.CERTIFIED.map((s) => s.text).join(" "));
  assert.equal(copyText("seal stand 1 stargazer"), M.CERTIFIED_STARGAZER.text);
  if (OTHER && OTHER.CERTIFIED_TEXT) assert.ok(OTHER.CERTIFIED_TEXT.startsWith(M.CERTIFIED.map((s) => s.text).join(" ")), "the same wording on both pages");
});

// ─── the dialogs ─────────────────────────────────────────────────────────────

test("dialogs: What is real here? and the Blueprint", () => {
  const D = M.DIALOG, all = D.sections.flatMap((s) => s.items.map((p) => p.text));
  assert.equal(D.title, "What is real here?");
  assert.equal(D.first.text, "This page sets Bible verses beside sky calculations because its author asked for that. The numbers do not depend on the verses, and the verses are not offered as science.");
  assert.deepEqual(D.sections.map((s) => s.heading), ["The four layers", "What is computed, and how well", "What others measured", "This project's chart", "The book", "The bridge narrative (the gold boxes)", "Neighbours of this page", "This page"]);
  // the four layers with the badge help
  const layers = D.sections[0].items;
  assert.deepEqual(layers.slice(0, 4).map((p) => p.layer), LAYERS);
  assert.deepEqual(layers.slice(0, 4).map((p) => p.text), KIT.LAYER_META.map((m) => m.legend));
  assert.equal(layers[4].text, "CHECKED means you can repeat this count or calculation. It does not mean the words beside it are proved.");
  for (const sentence of [
    C.CHART_WORDING, C.DEPTH_WORDING,
    "The author calls this way of working “the design protocol of Why Jesus Died”. The rules are this project's; the book does not contain them.",
    "The links between Ezekiel and the Gospels shown here come from early Christian writers and from this project, not from him.",
    "The three reading levels are the same three levels First Explorers calls Stargazer, Explorer and Architect.",
    "The only request to another host is for web fonts (Google Fonts); the page works without them.",
    "Location is typed or chosen, never read from the device, and nothing is stored by this page.",
    "Code: MIT. Quoted texts belong to their rights holders and are not covered by that licence.",
    "Sliding the disc is a move of PSU(1,1), the 3-parameter group of the disc. The 6-parameter group PSL(2,C) needs the ball.",
    "The Vela pulsar turns 11 times a second (Helfand and others 2001).",
    "Celestial holography is a proposal (Pasterski 2021; Raclariu 2021).",
    "Gravitational-wave memory has not been detected (the NANOGrav collaboration 2025).",
    "A Celestial Observatory is planned in the Celestial Hypersim Explorer. This page is a static sketch toward it.",
  ]) assert.ok(all.includes(sentence), sentence.slice(0, 50));
  assert.ok(all.some((t) => t.startsWith("Your latitude and date drive the sky")));
  assert.ok(all.some((t) => t.startsWith("Van Paassen writes “As a Unitarian” and argues his own reconstruction; the running text never mentions Ezekiel")));
  // the bridge narrative, taken over from First Explorers' dialog, plus the book never mentioning Ezekiel
  const bridge = D.sections.find((s) => s.heading.startsWith("The bridge narrative")).items;
  assert.equal(bridge.length, 6);
  assert.ok(bridge[0].layer === "reading" && bridge[0].text.startsWith("It is an interpretation, chosen by this project.") && bridge[0].text.endsWith("No check, packet or certificate on this page depends on it."));
  assert.ok(bridge[1].text.startsWith("The history is from one book: Pierre van Paassen, Why Jesus Died (Dial Press, 1949)."));
  assert.ok(bridge[2].text.startsWith("What he argues.") && bridge[3].text.startsWith("Where others differ.") && bridge[4].text.startsWith("What is ours, not his."));
  assert.equal(bridge[5].text, LEX.ROWS.find((r) => r[0] === "0.4.1")[4].split(/(?<=\.)\s/)[0]);
  assert.ok(bridge[5].text.includes("the running text never mentions him"));
  const fe = readFileSync(path.join(ROOT, "Library/Experimental_Systems/First_Explorers/index.html"), "utf8").replace(/<[^>]+>/g, "").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”");
  for (const piece of ["Jesus was a Galilean Jew in the line of Israel's prophets who announced the Kingdom of God on earth: justice, and all people as kin. Pontius Pilate alone ordered his death.", "Most Christians, and many historians, disagree with parts of that.", "He never calls Jesus a bridge and never uses the cross as a figure of two directions."]) {
    assert.ok(fe.includes(piece), "First Explorers says: " + piece.slice(0, 40)); assert.ok(bridge.some((p) => p.text.includes(piece)));
  }
  assert.equal(D.sections.find((s) => s.heading === "Neighbours of this page").items.length, 3);
  // the Blueprint: three pillars, four shells over the real scale, the age-lens card; the whole scale is READING
  const B = M.BLUEPRINT;
  assert.equal(B.title, "Blueprint"); assert.equal(B.badge.layer, "reading");
  assert.equal(B.pillars.length, 3); assert.equal(B.shells.length, 4); assert.equal(B.lenses.length, 3);
  for (const p of [...B.pillars, ...B.shells, ...B.lenses]) assert.equal(p.text.layer, "reading");
  assert.ok(B.pillars[1].text.text.includes("equal-sized things are drawn smaller and smaller toward the rim, so an endless amount of room fits inside the circle"));
  assert.ok(B.pillars[1].text.text.includes("T_c(z) = (z − c)/(1 − c̄z)"));
  assert.ok(B.pillars[0].text.text.includes("where on Earth am I standing, what day of the year is it, what shape is the Moon tonight"));
  assert.deepEqual(B.shells.map((s) => s.prototype), ["Observer Origin, r = 0.00", "Solar-Lunar Gate, r ≈ 0.42", "Galactic Scaffolds, r ≈ 0.76", "Celestial Hologram, r → 1.00"]);
  const ring = (k) => Number(Math.tanh(C.RINGS.find((x) => x.key === k).rho / 2).toFixed(2));
  assert.deepEqual(B.shells.map((s) => [s.from, s.to]), [[0, 0], [ring("light-second"), ring("light-hour")], [ring("light-year"), ring("million-light-years")], [ring("million-light-years"), 1]]);
  assert.deepEqual([...B.shells[1].holds], ["Moon", "Sun"]);
  assert.deepEqual([...B.shells[2].holds], ["Pleiades", "Polaris", "Vela pulsar", "Cygnus X-1", "Sagittarius A*"]);
  assert.deepEqual([...B.shells[3].holds], ["Andromeda galaxy", "Cosmic microwave background", "the points of the rim"]);
  for (const s of B.shells.slice(1)) for (const label of s.holds) { const o = M.OBJECTS.find((x) => x.label === label); if (o) { const rr = M.COPY_FACTS.radii[o.key]; assert.ok(rr >= s.from && rr < s.to, label); } }
  assert.ok(B.shells[1].text.text.includes("the Moon at 0.25 and the Sun at 0.41") && B.shells[3].text.text.includes("Andromeda at 0.83, the microwave background at 0.90"));
  assert.deepEqual(B.lenses.map((l) => [l.id, l.label, l.hint]), [["stargazer", "Stargazer", "ages 6 and up"], ["navigator", "Navigator", "astronomy"], ["holographer", "Holographer", "physics"]]);
  assert.ok(B.lenses[0].text.text.includes("nothing made false to keep it simple"));
});
