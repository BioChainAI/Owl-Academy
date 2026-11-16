// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// The Celestial Control Panel and the Lexicon Explorer together. The other tests cover one piece each: the astronomy
// core, the Overwatch core, the two page models, the lexicon data. This file joins them:
//   1  rows       every row scripts/celestial-core.js writes for a sky is one LEX/1 entry of scripts/strix-overwatch.js,
//                 and the whole text is one LEXICON/2 lexicon (unique addresses, depth-first order), for six named places
//                 and dates and for sixty random ones;
//   2  chain      a sky sealed twice from the same three rounded numbers has the same chain id; one that differs in the
//                 last kept digit of the Julian Day, the latitude or the longitude has another;
//   3  identity   the promise of the button "Open this sky in the Lexicon Explorer": the chain name the sky page gives a
//                 sealed sky is the chain name the Lexicon Explorer gives after it reads the link #sky=JD,LAT,LON and
//                 seals what it recomputed; the downloaded package and the four receivers agree;
//   4  links      every link either page writes is read by the other page (or by itself) without a note and means there
//                 what it meant here; a sky opened in the Lexicon Explorer leads back to the same sky on the sky page;
//                 each page's copy of the other's grammar reads what the other reads; hostile and malformed links are
//                 refused by both without throwing;
//   5  facts      the one fenced `facts` block of STRIX_OVERWATCH.md and of CELESTIAL_CONTROL_PANEL.md: every line is
//                 `name = value`, every value is recomputed here from the code and compared as text;
//   6  agreement  where the two pages, the documents and First Explorers overlap they say the same thing: the four
//                 layers and their badge words, the four receivers, the numbers and the sentences both pages state,
//                 what the sky page says the Lexicon Explorer will do with a sealed sky, the link keys the documents list.
// One known fault is kept as a test marked todo (section 4): at the very ends of the year range, at a longitude far from
// Greenwich, a sky's link to the sky page loses its time, and the sky page cannot write its own link.
// Nothing is written and no network is used. OWL_TEST_ROOT=<dir> runs the file against another checkout.
// Run: node --test tests/unit/explorers-integration.test.mjs   (about 15 seconds)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.env.OWL_TEST_ROOT || path.resolve(import.meta.dirname, "../..");
const WING = "Library/Experimental_Systems/";
const load = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const OW = await load("scripts/strix-overwatch.js");
const H = await load("scripts/hyperbolic-moves.js");
const K = await load("scripts/celestial-core.js");
const KIT = await load(WING + "explorer-kit.js");
const LEX = await load(WING + "Lexicon_Explorer/ezekiel-1.js");
const SUP = await load(WING + "Lexicon_Explorer/passage-as-supplied.js");
const G = await load(WING + "Lexicon_Explorer/lexicon-explorer-model.js");        // the Lexicon Explorer's model
const P = await load(WING + "Celestial_Control_Panel/celestial-panel-model.js");  // the Celestial Control Panel's model

// ─── shared helpers ──────────────────────────────────────────────────────────

const LENSES = ["stargazer", "navigator", "holographer"];
const AT = "2026-11-15T00:00:00.000Z";          // the time stamp the sky page seals with in this file
const AT_LATER = "2031-02-03T04:05:06.000Z";    // another one, for the Lexicon Explorer: a time stamp is not in a chain id
const CHAIN_ID = /^BC-[0-9a-f]{24}$/;
const utf8Bytes = (s) => new TextEncoder().encode(s).length;
const once = (make) => { let made; return () => (made ||= make()); };
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
/** The fragment of a link ("#…", or "" when it has none) and the page it leads to. */
const fragment = (href) => (href.includes("#") ? href.slice(href.indexOf("#")) : "");
const pageOf = (href) => (href.includes("#") ? href.slice(0, href.indexOf("#")) : href);
/** Every string a module exports, however deep (arrays, records and Maps; functions are not called). */
function stringsOf(module) {
  const out = [], seen = new Set();
  const walk = (v) => {
    if (typeof v === "string") out.push(v);
    else if (v && typeof v === "object" && !seen.has(v)) {
      seen.add(v);
      if (v instanceof Map) for (const [k, x] of v) { walk(k); walk(x); }
      else for (const k of Object.keys(v)) walk(v[k]);
    }
  };
  for (const k of Object.keys(module)) walk(module[k]);
  return out;
}
/** Every { layer, text } a module exports, however deep. */
function sentencesOf(module) {
  const out = [], seen = new Set();
  const walk = (v) => {
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (v instanceof Map) { for (const x of v.values()) walk(x); return; }
    if (typeof v.layer === "string" && typeof v.text === "string") out.push(v);
    for (const k of Object.keys(v)) walk(v[k]);
  };
  for (const k of Object.keys(module)) walk(module[k]);
  return out;
}
/** The largest n in lo..hi for which the test holds; the test must hold at lo and fail at hi (so the answer is not the edge of the search). */
async function largest(lo, hi, holds, what) {
  assert.ok(await holds(lo), `${what}: must hold at ${lo}`);
  assert.ok(!(await holds(hi)), `${what}: must fail at ${hi}`);
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (await holds(mid)) lo = mid; else hi = mid; }
  return lo;
}
const throws = (make) => { try { make(); return false; } catch { return true; } };

// ─── the skies: six places and dates, each reached the way a visitor reaches it ─────────────────────────────

const typed = (lat, lon, jd, lens) => {
  const placed = P.typePlace(P.initialState(), lat, lon);
  assert.equal(placed.message, "", "the typed place is accepted");
  const state = P.setLens(P.setJd(placed.state, jd), lens);
  assert.equal(state.jdUt, jd, "the instant is accepted");
  return state;
};
const SKIES = [
  { name: "Greenwich on 14 November 2026 (Start at Greenwich, the device clock)", lens: "stargazer",
    state: () => P.confirmDay(P.chooseSite(P.initialState({ nowMs: Date.UTC(2026, 10, 14, 21, 30, 17) }), "greenwich")) },
  { name: "the Kebar preset: Nippur at the sunset of 31 July 593 BC", lens: "navigator",
    state: () => P.initialState({ hash: "#preset=ezekiel&lens=navigator" }) },
  { name: "the South Pole at midwinter 2026", lens: "holographer",
    state: () => P.setLens(P.confirmDay(P.chooseSite(P.initialState({ nowMs: Date.UTC(2026, 5, 21, 3, 4, 5) }), "south-pole")), "holographer") },
  { name: "Sydney, typed with four decimals, on 2 January 1999", lens: "navigator",
    state: () => typed(-33.8688, 151.2093, K.jdFromCalendar(1999, 1, 2.627835648, "gregorian"), "navigator") },
  { name: "a typed place at 78° north in 1000 BC", lens: "holographer",
    state: () => typed(78.2232, 15.6267, K.jdFromCalendar(-999, 3, 1.123456, "julian"), "holographer") },
  { name: "a typed place a hair south of the equator and east of the date line in AD 2999", lens: "stargazer",
    state: () => typed(-0.004, -179.996, K.jdFromCalendar(2999, 12, 30.987654321, "gregorian"), "stargazer") },
].map((s) => ({ ...s, state: once(s.state) }));
/** The three numbers a sky is sealed from, as the core rounds them. */
const roundedOf = (state) => K.roundSkyInputs(state.jdUt, state.site.lat, state.site.lonEast);
/** The rows of a sky as the core writes them for three rounded numbers, and the same as entries. */
const rowsFor = (q) => K.skyLexiconRows(K.skyState(q.jdUt, q.lat, q.lonEast));
const entriesFor = (q) => rowsFor(q).map((r) => OW.makeEntry(...r));
/** The sky page seals each of the six skies once (with its own lens and the time stamp AT); every test below reuses that. */
const sealedOn = new Map();
const sealedOnSkyPage = (sky) => {
  if (!sealedOn.has(sky.name)) sealedOn.set(sky.name, P.sealSky(sky.state(), { at: AT }));
  return sealedOn.get(sky.name);
};
/** What the Lexicon Explorer makes of the link a sealed sky carries: its state after reading the link, and its own seal. */
const openedIn = new Map();
const openedInLexiconExplorer = (sky) => {
  if (!openedIn.has(sky.name)) openedIn.set(sky.name, (async () => {
    const seal = await sealedOnSkyPage(sky);
    const state = G.initialState(fragment(seal.link));
    return { state, seal: await G.sealLexicon(state.lexicon, { at: AT_LATER }) };
  })());
  return openedIn.get(sky.name);
};

// A second reading of the order rule of LEXICON/2, written without the core: the text is the depth-first listing of
// one tree with children in increasing index order exactly when every address is new, comes after the one before it
// (index by index as numbers, a prefix first) and has its parent somewhere above it.
const indicesOf = (address) => address.split(".").map(Number);
function comesBefore(a, b) {
  const x = indicesOf(a), y = indicesOf(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] < y[i];
  return x.length < y.length;
}
function orderFaults(addresses) {
  const seen = new Set(), faults = [];
  addresses.forEach((a, i) => {
    if (seen.has(a)) faults.push(`${a} is given twice`);
    const parent = a.includes(".") ? a.slice(0, a.lastIndexOf(".")) : "";
    if (parent !== "" && !seen.has(parent)) faults.push(`${a} comes before its parent ${parent}`);
    if (i > 0 && !comesBefore(addresses[i - 1], a)) faults.push(`${a} does not come after ${addresses[i - 1]}`);
    seen.add(a);
  });
  return faults;
}
/** Everything section 1 asks of one sky: returns the entries. */
function checkSkyRows(rows, what) {
  assert.ok(Array.isArray(rows) && rows.length > 0, `${what}: rows`);
  const entries = rows.map((row, i) => {
    assert.ok(Array.isArray(row) && row.length === 5 && row.every((x) => typeof x === "string"), `${what}: row ${i + 1} is five strings`);
    let entry = null;
    assert.doesNotThrow(() => { entry = OW.makeEntry(...row); }, `${what}: row ${row[0]} is accepted by makeEntry`);
    assert.deepEqual([entry.address, entry.layer, entry.kind, entry.name, entry.text], row, `${what}: row ${row[0]} is kept as written (already NFC)`);
    assert.equal(OW.parseEntry(entry.line).line, entry.line, `${what}: the line of ${row[0]} reads back`);
    assert.ok(OW.LAYERS.includes(entry.layer), `${what}: ${row[0]} has one of the four layers`);
    return entry;
  });
  const text = OW.lexiconText(entries);
  let parsed = null;
  assert.doesNotThrow(() => { parsed = OW.parseLexiconText(text); }, `${what}: the whole text is accepted by parseLexiconText`);
  assert.deepEqual(parsed.map((e) => e.line), entries.map((e) => e.line), `${what}: the text reads back to the same entries`);
  assert.deepEqual(orderFaults(entries.map((e) => e.address)), [], `${what}: addresses are unique and in depth-first order`);
  assert.ok(utf8Bytes(text) <= OW.MAX_LEXICON_BYTES && entries.length <= OW.MAX_ENTRIES, `${what}: within the limits of a lexicon`);
  const epochs = OW.treeEpochTexts(entries);
  assert.equal(epochs.length, entries.filter((e) => !e.address.includes(".")).length, `${what}: one epoch for each top-level entry`);
  assert.ok(epochs.length <= OW.MAX_EPOCHS, `${what}: no more epochs than a lexicon may have`);
  assert.equal(epochs.at(-1), text, `${what}: the last epoch is the whole text`);
  return entries;
}

// ─── 1. the rows of a sky are a lexicon ──────────────────────────────────────

test("For six places and dates every row of the sky lexicon is one LEX/1 entry, and the text is one LEXICON/2 lexicon with unique addresses in depth-first order", async () => {
  for (const sky of SKIES) {
    const state = sky.state(), q = roundedOf(state);
    assert.ok(K.skyInputsValid(q.jdUt, q.lat, q.lonEast), `${sky.name}: the rounded numbers are a sky`);
    const rows = rowsFor(q);
    const entries = checkSkyRows(rows, sky.name);
    assert.deepEqual(rowsFor(q), rows, `${sky.name}: the same three numbers give the same rows again`);
    assert.deepEqual(K.skyLexiconRows(K.skyState(state.jdUt, state.site.lat, state.site.lonEast)), rows, `${sky.name}: the unrounded state gives the rows of its rounded numbers`);
    // the three numbers are written into the rows with the decimals a link carries
    const link = K.formatSkyInputs(state.jdUt, state.site.lat, state.site.lonEast);
    const row = (address) => entries.find((e) => e.address === address);
    assert.ok(row("1.2").text.includes("Julian Day " + link.jd + " "), `${sky.name}: row 1.2 states the Julian Day to five decimals`);
    assert.ok(row("1.1").text.startsWith("Latitude " + link.lat.replace("-", "") + "° "), `${sky.name}: row 1.1 states the latitude to two decimals`);
    assert.ok(row("1.1").text.includes("longitude " + link.lon.replace("-", "") + "° "), `${sky.name}: row 1.1 states the longitude to two decimals`);
    assert.equal(row("1.1").name, K.siteForCoordinates(q.lat, q.lonEast).label, `${sky.name}: the place is named as the core names those two numbers`);
    // and these are the rows the sky page seals
    const seal = await sealedOnSkyPage(sky);
    assert.equal(seal.ok, true, `${sky.name}: the sky page seals it`);
    assert.deepEqual(seal.rows, rows, `${sky.name}: the sky page seals exactly these rows`);
    assert.deepEqual(seal.inputs, link, `${sky.name}: and reports the three numbers as the link writes them`);
  }
  const south = SKIES.filter((s) => s.state().site.lat < 0).length, ancient = SKIES.filter((s) => K.decimalYear(s.state().jdUt) < 0).length;
  assert.ok(south >= 2 && ancient >= 2 && SKIES.some((s) => s.state().site.lat === -90), "the six skies include southern places, a pole and dates before the common era");
});

test("Sixty random skies over the whole range of years and the whole globe give rows the Overwatch core accepts", () => {
  const rnd = seeded(20261115), [lo, hi] = K.RANGES.localJd;
  let made = 0;
  while (made < 60) {
    const lat = made % 10 === 0 ? (made % 20 === 0 ? 90 : -90) : -90 + 180 * rnd();
    const lon = made % 15 === 7 ? 180 : -180 + 360 * rnd();
    const jd = lo + (hi - lo) * rnd() - lon / 360;
    if (!K.skyInputsValid(jd, lat, lon)) continue;
    const q = K.roundSkyInputs(jd, lat, lon);
    if (!K.skyInputsValid(q.jdUt, q.lat, q.lonEast)) continue;
    const entries = checkSkyRows(rowsFor(q), `random sky ${made + 1} (JD ${q.jdUt}, ${q.lat}, ${q.lonEast})`);
    assert.equal(entries.length, P.COPY_FACTS.seal.rows, "every sky has the number of rows the sky page states");
    made += 1;
  }
});

// ─── 2. the chain id is a function of the three rounded numbers ──────────────

test("A sky sealed twice from the same three rounded numbers has the same chain id, whatever the time stamp, the key and the digits beyond the ones kept", async () => {
  for (const sky of SKIES) {
    const state = sky.state(), q = roundedOf(state), first = await sealedOnSkyPage(sky);
    assert.match(first.chainId, CHAIN_ID, `${sky.name}: a chain id`);
    // the core, twice, with two time stamps
    const a = await OW.buildLexiconBundle(entriesFor(q), { at: AT }), b = await OW.buildLexiconBundle(entriesFor(q), { at: AT_LATER });
    assert.equal(a.chain.chainId, b.chain.chainId, `${sky.name}: the core gives the same chain id twice`);
    assert.equal(a.chain.chainId, first.chainId, `${sky.name}: and it is the one the sky page shows`);
    assert.deepEqual(a.lineage, b.lineage, `${sky.name}: the same lineage`);
    assert.notDeepEqual(a.trace, b.trace, `${sky.name}: the ledgers differ, because they carry the time stamp`);
    assert.equal(OW.treeLineage(OW.treeEpochTexts(entriesFor(q))).at(-1).chainId, first.chainId, `${sky.name}: the lineage computed from the text ends in that chain id`);
    // the sky page again: another visit (another key, another time), and a state that differs below the kept digits
    const again = await P.sealSky(state, { at: AT_LATER });
    assert.equal(again.chainId, first.chainId, `${sky.name}: the sky page gives the same chain id on another visit`);
    assert.notEqual(again.certificate.sealId, first.certificate.sealId, `${sky.name}: under another key`);
    const nudge = (x, d, min, max) => (x + d > max || x + d < min ? x - d : x + d);
    const near = { ...state, jdUt: q.jdUt + 0.000004, site: { ...state.site, lat: nudge(q.lat, 0.004, -90, 90), lonEast: nudge(q.lonEast, -0.004, -180, 180) } };
    assert.deepEqual(roundedOf(near), q, `${sky.name}: the nudged state rounds to the same three numbers`);
    assert.notDeepEqual([near.jdUt, near.site.lat, near.site.lonEast], [q.jdUt, q.lat, q.lonEast], `${sky.name}: though it is not the same state`);
    assert.equal((await P.sealSky(near, { at: AT })).chainId, first.chainId, `${sky.name}: digits beyond the kept ones do not change the chain id`);
  }
});

test("A sky that differs in the last kept digit of the Julian Day, the latitude or the longitude has a different chain id", async () => {
  for (const sky of SKIES) {
    const q = roundedOf(sky.state()), base = (await sealedOnSkyPage(sky)).chainId;
    const neighbours = [
      ["the Julian Day one step later", { ...q, jdUt: Number((q.jdUt + 0.00001).toFixed(5)) }],
      ["the Julian Day one step earlier", { ...q, jdUt: Number((q.jdUt - 0.00001).toFixed(5)) }],
      ["the latitude one step north", { ...q, lat: Number((q.lat + 0.01).toFixed(2)) }],
      ["the latitude one step south", { ...q, lat: Number((q.lat - 0.01).toFixed(2)) }],
      ["the longitude one step east", { ...q, lonEast: Number((q.lonEast + 0.01).toFixed(2)) }],
      ["the longitude one step west", { ...q, lonEast: Number((q.lonEast - 0.01).toFixed(2)) }],
    ].filter(([, n]) => K.skyInputsValid(n.jdUt, n.lat, n.lonEast));
    assert.ok(neighbours.length >= 4 && ["Julian", "latitude", "longitude"].every((w) => neighbours.some(([what]) => what.includes(w))), `${sky.name}: each of the three numbers has a neighbour`);
    const ids = new Set([base]);
    for (const [what, n] of neighbours) {
      assert.deepEqual(K.roundSkyInputs(n.jdUt, n.lat, n.lonEast), n, `${sky.name}, ${what}: is itself a rounded triple`);
      const id = (await OW.buildLexiconBundle(entriesFor(n), { at: AT })).chain.chainId;
      assert.notEqual(id, base, `${sky.name}, ${what}: another chain id`);
      ids.add(id);
    }
    assert.equal(ids.size, neighbours.length + 1, `${sky.name}: the sky and its neighbours all have different chain ids`);
  }
  // the model: one step of the last digit in a link is another sky and another seal
  const kebar = P.initialState({ hash: "#preset=ezekiel" });
  const stepped = P.applyHash(P.initialState(), fragment(P.skyLinkHref(kebar)).replace(/jd=(\d+\.\d{4})(\d)/, (m, head, last) => "jd=" + head + ((Number(last) + 1) % 10)));
  assert.notEqual(stepped.jdUt, kebar.jdUt, "the link was changed in its last digit");
  assert.notEqual((await P.sealSky(stepped, { at: AT })).chainId, (await P.sealSky(kebar, { at: AT })).chainId, "and the sky page gives it another chain id");
});

// ─── 3. cross-page identity: the promise of "Open this sky in the Lexicon Explorer" ─────────────────────────

/** What differs between the sky the sky page sealed and the one the Lexicon Explorer recomputed and sealed: [] when nothing does. */
function skyDifferences(mine, theirState, theirs) {
  const out = [];
  if (!theirState.sky) return ["the Lexicon Explorer did not open a sky from the link (" + JSON.stringify(theirState.notes) + ")"];
  if (JSON.stringify(mine.inputs) !== JSON.stringify(theirState.sky)) out.push(`the three numbers: the sky page sealed ${JSON.stringify(mine.inputs)}, the Lexicon Explorer read ${JSON.stringify(theirState.sky)}`);
  const a = mine.entries, b = theirState.lexicon.entries;
  if (a.length !== b.length) out.push(`the number of rows: ${a.length} sealed on the sky page, ${b.length} recomputed`);
  if (a.map((e) => e.address).join(" ") !== b.map((e) => e.address).join(" ")) out.push(`the order or the addresses of the rows: ${a.map((e) => e.address).join(" ")} against ${b.map((e) => e.address).join(" ")}`);
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const field = ["address", "layer", "kind", "name", "text"].find((f) => a[i][f] !== b[i][f]);
    if (field) { out.push(`row ${a[i].address}, ${field}: ${JSON.stringify(a[i][field])} on the sky page, ${JSON.stringify(b[i][field])} in the Lexicon Explorer`); break; }
  }
  if (theirs.bundle && mine.bundle.lineage.length !== theirs.bundle.lineage.length) out.push(`the epochs: ${mine.bundle.lineage.length} against ${theirs.bundle.lineage.length}`);
  if (theirs.bundle && mine.bundle.lexicon.root !== theirs.bundle.lexicon.root) out.push("the lexicon root");
  if (theirs.bundle && mine.bundle.chain.merkleRoot !== theirs.bundle.chain.merkleRoot) out.push("the Merkle root");
  return out;
}
const rowOf = (view, key) => (view.rows.find((r) => r.key === key) || { value: undefined }).value;

test("The chain name the sky page gives a sealed sky is the chain name the Lexicon Explorer gives after it reads the link the sky page emits and seals what it recomputed", async () => {
  for (const sky of SKIES) {
    const mine = await sealedOnSkyPage(sky);
    // the link under the button: the shell uses lexiconSkyHref(state), or the sealed link
    assert.equal(mine.link, P.lexiconSkyHref(sky.state()), `${sky.name}: the seal's link is the link the button carries`);
    assert.equal(mine.link, KIT.LINKS.lexiconExplorer + "#sky=" + [mine.inputs.jd, mine.inputs.lat, mine.inputs.lon].join(",") + "&lens=" + sky.lens, `${sky.name}: it is #sky=JD,LAT,LON with the lens`);
    assert.equal(P.sealView(mine, sky.lens).link, mine.link, `${sky.name}: the Seal step prints that link`);
    const { state: there, seal: theirs } = await openedInLexiconExplorer(sky);
    assert.deepEqual(there.notes, [], `${sky.name}: the Lexicon Explorer reads the link without a note`);
    assert.equal(there.lexicon.origin, "page", `${sky.name}: and shows the sky as a lexicon of its own`);
    assert.equal(there.lens, sky.lens, `${sky.name}: at the lens the sky page was read at`);
    assert.equal(theirs.ok, true, `${sky.name}: the Lexicon Explorer seals it`);
    const differences = skyDifferences(mine, there, theirs);
    assert.equal(theirs.chainId, mine.chainId, `${sky.name}: the two pages give different chain names. What differs: ${differences.join("; ") || "nothing this test compares (the rows, their order and the three numbers are equal)"}`);
    assert.deepEqual(differences, [], `${sky.name}: nothing else differs either`);
    assert.deepEqual(theirs.bundle.lineage, mine.bundle.lineage, `${sky.name}: the same lineage, epoch by epoch`);
    assert.notEqual(theirs.at, mine.at, `${sky.name}: although the two seals were made at different times`);
    assert.notEqual(theirs.certificate.sealId, mine.certificate.sealId, `${sky.name}: and with different keys`);
    // what each page prints
    assert.equal(rowOf(P.sealView(mine, "navigator"), "chain"), mine.chainId, `${sky.name}: the sky page prints that chain id`);
    assert.equal(rowOf(G.sealView(theirs, "navigator"), "chain"), mine.chainId, `${sky.name}: the Lexicon Explorer prints the same`);
    assert.equal(rowOf(G.sealView(theirs, "navigator"), "entries"), rowOf(P.sealView(mine, "navigator"), "entries"), `${sky.name}: both print the same number of entries`);
    assert.equal(rowOf(G.sealView(theirs, "navigator"), "epochs"), rowOf(P.sealView(mine, "navigator"), "epochs"), `${sky.name}: and of epochs`);
    assert.equal(theirs.fileName, mine.fileName, `${sky.name}: and both offer the package under the same file name`);
  }
  const kebar = await sealedOnSkyPage(SKIES[1]);
  assert.equal(kebar.kebar, true, "the preset is recognised as the sky by the Kebar");
  for (const lens of LENSES) assert.equal(P.sealView(kebar, lens).chainName, kebar.chainId, `the Kebar sky's chain name is shown large at the ${lens} lens`);
});

test("The same promise holds for twenty random places and times, typed in with more digits than a link keeps", async () => {
  const rnd = seeded(593), [lo, hi] = K.RANGES.localJd;
  let made = 0;
  while (made < 20) {
    const lat = Number((-90 + 180 * rnd()).toFixed(4)), lon = Number((-180 + 360 * rnd()).toFixed(4)), jd = lo + 1 + (hi - lo - 2) * rnd() - lon / 360;
    const placed = P.typePlace(P.initialState(), lat, lon);
    if (placed.message !== "") continue;
    const state = P.setLens(P.setJd(placed.state, jd), LENSES[made % 3]);
    if (state.jdUt !== jd) continue;
    const what = `random sky ${made + 1} (JD ${jd}, ${lat}, ${lon})`;
    const mine = await P.sealSky(state, { at: AT });
    assert.equal(mine.ok, true, `${what}: the sky page seals it`);
    const there = G.initialState(fragment(mine.link));
    const theirs = await G.sealLexicon(there.lexicon, { at: AT_LATER });
    assert.equal(theirs.chainId, mine.chainId, `${what}: different chain names. What differs: ${skyDifferences(mine, there, theirs).join("; ")}`);
    assert.equal(there.lens, state.lens, `${what}: the lens is carried`);
    made += 1;
  }
});

test("The package the sky page offers for download is read by the Lexicon Explorer's front door as the same rows under the same chain name, shown as its sender's", async () => {
  for (const sky of SKIES.slice(0, 3)) {
    const mine = await sealedOnSkyPage(sky);
    assert.equal(mine.fileName, "hyperpack-" + mine.chainId + ".json", `${sky.name}: the file is named after the chain`);
    assert.match(mine.fileName, KIT.DOWNLOAD_NAME, `${sky.name}: a name the kit will download`);
    assert.equal(G.packageFileName(mine.chainId), mine.fileName, `${sky.name}: the Lexicon Explorer names it the same way`);
    assert.ok(G.fileAllowed(utf8Bytes(mine.wire)), `${sky.name}: the file is small enough to be loaded`);
    const loaded = await G.readOutside(mine.wire);
    assert.equal(loaded.ok, true, `${sky.name}: every check of the front door passes`);
    assert.equal(loaded.lexicon.origin, "outside", `${sky.name}: it is shown as a lexicon from outside`);
    assert.equal(loaded.banner, G.OUTSIDE_BANNER, `${sky.name}: under the banner`);
    assert.deepEqual(loaded.lexicon.entries.map((e) => e.line), mine.entries.map((e) => e.line), `${sky.name}: with the rows that were sealed`);
    assert.equal(loaded.covered.chainId, mine.chainId, `${sky.name}: and the chain name the sky page showed`);
    assert.equal(loaded.covered.entries, mine.entries.length, `${sky.name}: and its number of entries`);
    assert.equal((await G.readOutside(G.noisyWire(mine.wire))).ok, false, `${sky.name}: one changed digit of the file is refused`);
  }
});

// ─── 4. links ────────────────────────────────────────────────────────────────

const grammarKeys = (grammar) => grammar.map(([key]) => key);
// Values to try under each key of a link, sorted by SPEC 7.2: `yes` must be read, `no` must be ignored. They stand at
// the edges of every rule: the year range (as a local Julian Day), the poles, the date line, the count of decimals.
const [JD_LO, JD_HI] = K.RANGES.localJd;
const LINK_VALUES = {
  sky: {
    yes: ["1505042.16624,32.13,45.23", "2461359.39603,51.48,0.00", "2461212.62784,-90.00,0.00", "2451545,0,0", "2451545.123456,89.9999,-179.9999",
      JD_LO + ",0,0", (JD_HI - 0.1) + ",0,0", (JD_LO - 0.4) + ",0,180", (JD_HI + 0.4) + ",0,-180", "2451545,90,180", "2451545,-90,-180", "2451545,0,-0", "2451545,-0,0", "2451545,00,000"],
    no: [(JD_LO - 0.1) + ",0,0", (JD_HI + 0.1) + ",0,0", (JD_HI - 0.4) + ",0,180", (JD_LO + 0.4) + ",0,-180", "2451545,90.0001,0", "2451545,0,180.0001", "2451545,-90.01,0", "2451545,0,-180.01",
      "2451545.1234567,0,0", "2451545,0.12345,0", "2451545,0,0.12345", "2451545,0", "2451545,0,0,0", ",,", "2451545,,0", "2451545,0,", "1e6,0,0", "+2451545,0,0", "02451545,0,0", "2451545,.5,0", "2451545,5.,0",
      "NaN,0,0", "Infinity,0,0", "0x10,0,0", "12345678,0,0", "2451545,100,0", "2451545,0,1000", "2451545,0,0 "],
  },
  entry: { yes: ["0", "26.1", "26.1.1.2.3", "43.3.16", "100.10", "9999", "1.2.3.4.5.6.7.8"], no: ["10000", "01", "1.2.3.4.5.6.7.8.9", "1..2", ".1", "1.", "-1", "1,2", "a", "26.1.x"] },
  lens: { yes: ["stargazer", "navigator", "holographer"], no: ["Stargazer", "explorer", "architect", "stargazer,navigator", "0"] },
  preset: { yes: ["ezekiel"], no: ["Ezekiel", "kebar", "ezekiel,ezekiel"] },
  lab: { yes: ["square"], no: ["Square", "circle", "1"] },
  // The sky page's own keys for a place and a time, which the Lexicon Explorer writes for a sky on show. `copyOnly`:
  // what the Lexicon Explorer's copy of the rule would let through and the sky page refuses. There is one such thing:
  // the copy does not know the year range, which the sky page judges (at Greenwich when it reads the link).
  jd: { yes: ["1505042.16624", "2461359.39603", "2451545", "2451545.123456", String(JD_LO), String(JD_HI - 0.1)],
    no: ["2451545.1234567", "12345678", "1e6", "+2451545", "-5", "NaN", "2451545.", ".5", "0x10", "2451545,0"],
    copyOnly: [String(JD_LO - 0.1), String(JD_HI + 0.1), "1", "9999999"] },
  lat: { yes: ["0", "32.13", "-33.8688", "90", "-90", "89.9999", "-0", "00"], no: ["90.0001", "-90.01", "91", "0.12345", ".5", "5.", "+5", "1e1", "NaN", "100", "5,5"] },
  lon: { yes: ["0", "45.23", "-179.9999", "180", "-180", "151.2093", "000"], no: ["180.0001", "-180.01", "181", "0.12345", "1000", "1e2", "+5", "5.", "NaN"] },
};

test("Each page's copy of the other page's link grammar reads every value exactly as the other page reads it", () => {
  const pairs = [
    ["the sky page's copy of the Lexicon Explorer's grammar", P.LEXICON_PAGE_GRAMMAR, G.HASH_GRAMMAR, G.parseHash],
    ["the Lexicon Explorer's copy of the sky page's grammar", G.SKY_PAGE_GRAMMAR, P.HASH_GRAMMAR, P.parseHash],
  ];
  for (const [what, copy, own, parse] of pairs) {
    for (const key of grammarKeys(copy)) {
      assert.ok(grammarKeys(own).includes(key), `${what}: the key ${key} is a key the other page reads`);
      assert.ok(LINK_VALUES[key] && LINK_VALUES[key].yes.length >= 1 && LINK_VALUES[key].no.length >= 3, `${what}: this test has values to try for the key ${key}`);
      for (const [value, wanted] of [...LINK_VALUES[key].yes.map((v) => [v, true]), ...LINK_VALUES[key].no.map((v) => [v, false])]) {
        const hash = "#" + key + "=" + value;
        const here = KIT.parseHashWith(copy, hash), there = parse(hash);
        assert.deepEqual({ ...here.values }, { ...there.values }, `${what}: ${hash} is read the same way by both`);
        assert.equal(here.ignored, there.ignored, `${what}: ${hash} is ignored by both or by neither`);
        assert.equal(Object.hasOwn(there.values, key), wanted, `${what}: ${hash} ${wanted ? "is read" : "is ignored"} by the page that owns the key`);
        if (wanted) assert.equal(KIT.formatHashWith(copy, { [key]: value.split(",").length > 1 ? value.split(",") : value }), hash, `${what}: ${hash} can be written`);
        else assert.ok(throws(() => KIT.formatHashWith(copy, { [key]: value })), `${what}: ${hash} cannot be written`);
      }
      for (const value of LINK_VALUES[key].copyOnly || []) {
        const hash = "#" + key + "=" + value;
        assert.equal(Object.hasOwn(KIT.parseHashWith(copy, hash).values, key), true, `${what}: ${hash} is let through by the copy`);
        assert.deepEqual([Object.hasOwn(parse(hash).values, key), parse(hash).ignored], [false, 1], `${what}: ${hash} is refused by the page that owns the key`);
        assert.ok(!K.skyInputsValid(Number(value), 0, 0), `${what}: ${hash} is refused for one reason, the year range`);
      }
    }
  }
  assert.deepEqual(Object.keys(LINK_VALUES).filter((key) => LINK_VALUES[key].copyOnly), ["jd"], "in one place a copy is laxer than the page that owns the key: the Lexicon Explorer's copy of jd does not know the year range");
  assert.deepEqual(grammarKeys(G.HASH_GRAMMAR), ["sky", "entry", "lens"], "the Lexicon Explorer reads three keys");
  assert.deepEqual(grammarKeys(P.HASH_GRAMMAR), ["preset", "site", "jd", "lat", "lon", "focus", "lab", "lens"], "the sky page reads eight keys");
  assert.deepEqual(grammarKeys(P.LEXICON_PAGE_GRAMMAR), grammarKeys(G.HASH_GRAMMAR), "the sky page can write every key the Lexicon Explorer reads");
  assert.deepEqual(grammarKeys(G.SKY_PAGE_GRAMMAR), ["preset", "jd", "lat", "lon", "lab", "lens"], "the Lexicon Explorer writes six of the sky page's keys, in the sky page's order");
  assert.deepEqual(grammarKeys(P.HASH_GRAMMAR).filter((key) => grammarKeys(G.SKY_PAGE_GRAMMAR).includes(key)), grammarKeys(G.SKY_PAGE_GRAMMAR), "that order is the order of the sky page's own grammar");
  assert.equal(P.IGNORED_NOTE, G.IGNORED_NOTE, "both pages say the same line when a link value was ignored");
  // the alphabet of a value (A-Z a-z 0-9 . _ - ,) is kept by the reader and the writer themselves, whatever a rule would let through
  const anything = [["x", /^[^]*$/]];
  assert.deepEqual({ ...KIT.parseHashWith(anything, "#x=A-z_0.9,").values }, { x: "A-z_0.9," }, "a value made of the link alphabet is read");
  for (const value of ["a b", "a%20b", "<b>", "a/b", "a:b", "a;b", "a+b", "a=b", "a#b", "é", "a\n", "\"a\"", "a'b", "a\\b", "(a)", "a*", "a?b"]) {
    assert.deepEqual([Object.keys(KIT.parseHashWith(anything, "#x=" + value).values), KIT.parseHashWith(anything, "#x=" + value).ignored], [[], 1], `a value with a character outside the alphabet is ignored: ${JSON.stringify(value)}`);
    assert.ok(throws(() => KIT.formatHashWith(anything, { x: value })), `and cannot be written: ${JSON.stringify(value)}`);
  }
});

/** Every link the Celestial Control Panel's model writes: [{ what, href, lens, to, ... }]. */
function skyPageLinks() {
  const out = [];
  for (const lens of LENSES) {
    for (const step of P.STEPS) {
      const view = P.stepView(step.key, lens);
      view.bridge.stands.forEach((x, i) => { if (x.href) out.push({ what: `step ${step.key}, sentence ${i + 1}, ${lens}`, href: x.href, lens, to: "entry", address: x.source, sentence: x }); });
      view.bridge.links.forEach((k, i) => out.push({ what: `step ${step.key}, button ${i + 1} (${k.label}), ${lens}`, href: k.href, lens, to: pageOf(k.href) === KIT.LINKS.firstExplorers ? "firstExplorers" : "entry", address: fragment(k.href) ? G.parseHash(fragment(k.href)).values.entry : null, sentence: null }));
    }
    out.push({ what: `the verse over the lab, ${lens}`, href: P.entryHref(P.LAB_COPY.title.source, lens), lens, to: "entry", address: P.LAB_COPY.title.source, sentence: P.LAB_COPY.title });
    // the dialog's button to the Lexicon Explorer: the page and the lens alone (the shell writes it with the model's grammar)
    out.push({ what: `the dialog's button, ${lens}`, href: KIT.LINKS.lexiconExplorer + KIT.formatHashWith(P.LEXICON_PAGE_GRAMMAR, { lens }), lens, to: "home" });
  }
  for (const sky of SKIES) {
    for (const lens of LENSES) out.push({ what: `the sky link of ${sky.name}, ${lens}`, href: P.lexiconSkyHref(P.setLens(sky.state(), lens)), lens, to: "sky", sky });
  }
  out.push({ what: "the dialog's button to First Explorers", href: P.firstExplorersHref(), lens: null, to: "firstExplorers" });
  return out;
}

test("Every link the Celestial Control Panel writes to the Lexicon Explorer is read there without a note and opens the entry, the sky and the lens it was written for", () => {
  const links = skyPageLinks(), entries = new Set();
  for (const link of links) {
    assert.ok(KIT.isAllowedUrl(link.href), `${link.what}: ${link.href} is a URL the kit sets`);
    if (link.to === "firstExplorers") { assert.equal(link.href, KIT.LINKS.firstExplorers, `${link.what}: the kit's link to First Explorers, with no fragment`); continue; }
    assert.equal(pageOf(link.href), KIT.LINKS.lexiconExplorer, `${link.what}: leads to the Lexicon Explorer`);
    const parsed = G.parseHash(fragment(link.href));
    assert.equal(parsed.ignored, 0, `${link.what}: ${link.href} has nothing the Lexicon Explorer ignores`);
    assert.equal(parsed.values.lens, link.lens, `${link.what}: carries the lens`);
    const there = G.initialState(fragment(link.href));
    assert.deepEqual(there.notes, [], `${link.what}: opens without a note`);
    assert.equal(there.lens, link.lens, `${link.what}: opens at the same lens`);
    if (link.to === "home") {
      assert.equal(there.lexicon, G.EZEKIEL, `${link.what}: opens the built-in lexicon`);
      assert.equal(there.selected, null, `${link.what}: with nothing selected`);
    } else if (link.to === "entry") {
      entries.add(link.address);
      const entry = G.entryOf(G.EZEKIEL, link.address);
      assert.ok(entry, `${link.what}: ${link.address} is an entry of the built-in lexicon`);
      assert.equal(there.lexicon, G.EZEKIEL, `${link.what}: opens the built-in lexicon`);
      assert.equal(there.selected, link.address, `${link.what}: selects ${link.address}`);
      assert.equal(there.view.focus, link.address, `${link.what}: and centres it`);
      assert.equal(G.entryView(G.EZEKIEL, link.address, link.lens).address, link.address, `${link.what}: the Entry tab shows it`);
      if (link.sentence) {
        assert.equal(entry.layer, link.sentence.layer, `${link.what}: the row has the layer the sentence is shown with (${link.sentence.layer})`);
        if (link.sentence.layer === "text") {
          assert.ok(entry.text.includes(link.sentence.text), `${link.what}: the words quoted on the sky page stand in the row it links to`);
          assert.equal(entry.kind, "verse", `${link.what}: and that row is a verse`);
          assert.ok(link.sentence.name.startsWith(entry.name.replace(/ \(.*\)$/, "") + ", "), `${link.what}: named as the row is named (${entry.name})`);
        } else if (link.lens !== "stargazer") {
          assert.ok(entry.text.includes(link.sentence.text), `${link.what}: the SAID sentence is the row's own text`);
        }
      }
    } else {
      const q = roundedOf(link.sky.state());
      assert.deepEqual(parsed.values.sky, [q.jdUt, q.lat, q.lonEast], `${link.what}: carries the three rounded numbers`);
      assert.equal(there.lexicon.origin, "page", `${link.what}: opens a sky`);
      assert.deepEqual(there.sky, K.formatSkyInputs(q.jdUt, q.lat, q.lonEast), `${link.what}: that sky`);
      assert.deepEqual(there.lexicon.entries.map((e) => e.line), entriesFor(q).map((e) => e.line), `${link.what}: with the rows of those three numbers`);
      assert.equal(there.selected, null, `${link.what}: with nothing selected`);
    }
  }
  assert.ok(entries.size >= 9, `the sky page links to at least nine different rows (${entries.size})`);
  assert.ok(entries.has(LEX.HANDLES.john316), "one of them is John 3:16, where the last step sends the visitor on");
  assert.equal(links.filter((l) => l.to === "sky").length, SKIES.length * 3, "a sky link was tried for every sky at every lens");
  assert.equal(P.lexiconSkyHref(P.initialState()), "", "before a place is chosen there is no sky link");
  assert.equal(P.skyLinkHref(P.initialState()), "", "and no link to copy");
});

test("Every link the Lexicon Explorer writes to the Celestial Control Panel is read there without a note and opens the preset, the lab and the lens it was written for", () => {
  const term = (address) => G.entryOf(G.EZEKIEL, address);
  for (const lens of LENSES) {
    const actions = [];
    for (const e of G.EZEKIEL.entries) for (const a of G.entryView(G.EZEKIEL, e.address, lens).actions) if (a.href) actions.push({ ...a, address: e.address });
    // the rows whose closing words send the reader to the sky page carry a link of their own (the model's pointers)
    const pointers = G.POINTER_ADDRESSES.filter((address) => { const p = G.pointerOf(G.EZEKIEL, address, lens); return p && p.href; });
    assert.deepEqual(pointers.map((address) => OW.parentOf(address)), [LEX.HANDLES.fourthSquare, "100.9"], `${lens}: one row under the author's line 6 and one under line 9 point to the sky page`);
    assert.deepEqual(actions.map((a) => a.key + " on " + a.address), ["sky-date on " + LEX.HANDLES.dateTerm, "lab on " + LEX.HANDLES.notTurning, ...pointers.map((address) => "pointer on " + address)], `${lens}: four entries link to the sky page`);
    for (const address of pointers) {
      const shown = G.entryView(G.EZEKIEL, OW.parentOf(address), lens);
      const row = [...shown.rows, ...shown.more, ...(shown.author ? [...shown.author.before, shown.author.facet] : [])].find((r) => r && r.address === address);
      assert.ok(row && row.pointer && row.pointer.href === actions.find((a) => a.address === address).href, `${lens}: the row ${address}, listed under its line, carries the same link as its own card`);
    }
    for (const a of actions) {
      assert.ok(KIT.isAllowedUrl(a.href), `${lens}, ${a.key}: ${a.href} is a URL the kit sets`);
      assert.equal(pageOf(a.href), KIT.LINKS.celestialControlPanel, `${lens}, ${a.key}: leads to the sky page`);
      const parsed = P.parseHash(fragment(a.href));
      assert.equal(parsed.ignored, 0, `${lens}, ${a.key}: ${a.href} has nothing the sky page ignores`);
      const there = P.initialState({ hash: fragment(a.href), nowMs: Date.UTC(2026, 10, 14) });
      assert.equal(there.notes.link, "", `${lens}, ${a.key}: opens without a note`);
      assert.equal(there.lens, lens, `${lens}, ${a.key}: opens at the same lens`);
      if (a.key === "sky-date") {
        // the term "in the fourth month, in the fifth day of the month" opens the sky of that day at that river
        assert.equal(there.site.key, "kebar", `${lens}: the date term opens the Kebar site`);
        assert.equal(there.jdUt, P.EZEKIEL_PRESET.jdUt, `${lens}: at the instant of the preset`);
        assert.ok(P.dateView(there).text.startsWith(K.EZEKIEL_DATES[0].label), `${lens}: on ${K.EZEKIEL_DATES[0].label}`);
        assert.equal(there.lab.open, false, `${lens}: not in the lab`);
        // the visitor lands where that day and its Moon are on show: the second step, with the day answered
        assert.deepEqual([there.step, P.STEPS[there.step - 1].key, there.lit.day], [2, "sun-moon", true], `${lens}: the date term opens the Sun and Moon step with the day answered`);
        assert.ok(P.dayQuestion(there, { year: 2026, month: 11, day: 14 }).text.includes(K.EZEKIEL_DATES[0].label), `${lens}: and the day question there names that date`);
        assert.equal(P.stepView("sun-moon", lens).bridge.stands[0].text, term(a.address).name, `${lens}: the term that opens that date is the phrase the sky page quotes at its Sun and Moon step`);
        const moon = G.EZEKIEL.entries.find((e) => OW.parentOf(e.address) === a.address && e.layer === "checked" && e.kind === "sky");
        assert.ok(moon && moon.text.includes("sunset on " + K.EZEKIEL_DATES[0].label), `${lens}: and the lexicon's own row under that term names the same date`);
      } else {
        // the term "they turned not when they went", and the two rows that end "See it on the sky page." and
        // "Try it in the lab.", open the lab that stands under the same words
        assert.equal(there.lab.open, true, `${lens}, ${a.key} on ${a.address}: opens the lab`);
        assert.equal(there.step, 4, `${lens}, ${a.key} on ${a.address}: at the Dive step`);
        assert.equal(there.site, null, `${lens}, ${a.key} on ${a.address}: the lab needs no place`);
        if (a.key === "lab") {
          assert.equal(P.LAB_COPY.title.text, term(a.address).name, `${lens}: the lab's verse is the term's own words`);
          assert.equal(P.LAB_COPY.title.source, OW.parentOf(a.address), `${lens}: and links back to the term's verse`);
        } else {
          assert.equal(a.key, "pointer", `${lens}: the other links to the lab are pointers of rows`);
          assert.ok(term(a.address).text.endsWith(" " + a.label + "."), `${lens}: the button of row ${a.address} is the row's own closing sentence (${a.label})`);
          assert.match(a.label, /sky page|lab/, `${lens}: and that sentence names the sky page or its lab`);
        }
      }
    }
    const home = G.skyPageHref("home", lens);
    assert.equal(home, KIT.LINKS.celestialControlPanel + "#lens=" + lens, `${lens}: the plain link to the sky page carries the lens alone`);
    const first = P.initialState({ hash: fragment(home) });
    assert.deepEqual([first.site, first.lens, first.notes.link, first.step], [null, lens, "", 1], `${lens}: and opens the first-run screen at that lens`);
    // the gold boxes: the Send station's sentence about the Kebar ends in that plain link, the first box links to First Explorers
    const boxes = G.visibleStations(lens).map((st) => [st.key, G.stationView(st.key, lens).bridge]);
    const stood = boxes.flatMap(([key, b]) => b.stands.filter((x) => x.link).map((x) => [key, x.link.href, x.layer]));
    assert.deepEqual(stood, lens === "stargazer" ? [] : [["send", home, "checked"]], `${lens}: one sentence of a gold box carries a link, the Kebar sentence of the Send station, and it is the plain link to the sky page`);
    assert.deepEqual(boxes.flatMap(([key, b]) => b.links.map((k) => [key, k.href])), [["read", KIT.LINKS.firstExplorers]], `${lens}: one gold box has a link under it, the first, to First Explorers`);
  }
  assert.equal(G.firstExplorersHref(), KIT.LINKS.firstExplorers, "the Lexicon Explorer's link to First Explorers is the kit's");
  // the dialog's last section: the three other pages, each the kit's link with no fragment, each opened by its page as a first visit
  assert.deepEqual(G.DIALOG.pages.map((x) => [x.key, x.href]), [["firstExplorers", KIT.LINKS.firstExplorers], ["celestialControlPanel", KIT.LINKS.celestialControlPanel], ["wingIndex", KIT.LINKS.wingIndex]], "the dialog's other pages are First Explorers, the sky page and the wing index");
  for (const x of G.DIALOG.pages) assert.ok(KIT.isAllowedUrl(x.href) && fragment(x.href) === "", `the dialog's link to ${x.label} is a URL the kit sets, with no fragment`);
  assert.equal(read(WING + "Lexicon_Explorer/index.html").includes(`id="wingLink" href="${KIT.LINKS.wingIndex}"`), true, "the header's link to the wing index is the kit's link");
  // a sky lexicon is not the built-in passage: it has no links to the sky page of its own
  const sky = G.initialState("#sky=1505042.16624,32.13,45.23&lens=navigator").lexicon;
  for (const e of sky.entries) assert.deepEqual(G.entryView(sky, e.address, "navigator").actions.filter((a) => a.href), [], `the sky entry ${e.address} carries no link`);
});

test("A sky opened in the Lexicon Explorer links back to the Celestial Control Panel with its own place and time, and from there the same link leads to the Lexicon Explorer again", async () => {
  const roundTrip = (sky, lens, what) => {
    // sky is the Lexicon Explorer's { jd, lat, lon } (link text) of the sky on show
    const href = G.skyPageHref("sky", lens, sky);
    assert.ok(KIT.isAllowedUrl(href) && pageOf(href) === KIT.LINKS.celestialControlPanel, `${what}: ${href} leads to the sky page`);
    assert.equal(fragment(href), "#jd=" + sky.jd + "&lat=" + sky.lat + "&lon=" + sky.lon + "&lens=" + lens, `${what}: the place and the time in the sky page's own keys, and the lens`);
    assert.ok(!/BC-|S-[0-9a-f]/.test(href), `${what}: no chain name and no seal id is put into the link`);
    const parsed = P.parseHash(fragment(href));
    assert.deepEqual([{ ...parsed.values }, parsed.ignored], [{ jd: Number(sky.jd), lat: Number(sky.lat), lon: Number(sky.lon), lens }, 0], `${what}: the sky page reads all of it`);
    const back = P.initialState({ hash: fragment(href), nowMs: 1 });
    assert.equal(back.notes.link, "", `${what}: the sky page opens it without a note`);
    assert.deepEqual(K.formatSkyInputs(back.jdUt, back.site.lat, back.site.lonEast), { ...sky }, `${what}: at the same three rounded numbers`);
    assert.equal(back.lens, lens, `${what}: at the same lens`);
    assert.equal(P.skyLinkHref(back), href, `${what}: it is the very link the sky page writes for that sky ("Copy a link to this sky")`);
    // and on from there: the sky page's button leads to the sky the visitor came from
    const again = G.initialState(fragment(P.lexiconSkyHref(back)));
    assert.deepEqual([{ ...again.sky }, again.lens, again.notes], [{ ...sky }, lens, []], `${what}: the sky page's link to the Lexicon Explorer opens the same sky again`);
    return back;
  };
  for (const sky of SKIES) {
    const { state: there } = await openedInLexiconExplorer(sky);
    for (const lens of LENSES) {
      const back = roundTrip(there.sky, lens, `${sky.name}, ${lens}`);
      assert.equal(back.site.label, sky.state().site.label, `${sky.name}, ${lens}: the sky page names the place as before`);
    }
    assert.equal((await P.sealSky(P.initialState({ hash: fragment(G.skyPageHref("sky", sky.lens, there.sky)) }), { at: AT_LATER })).chainId, (await sealedOnSkyPage(sky)).chainId, `${sky.name}: sealed again after the round trip, the sky has the chain name it had`);
  }
  const rnd = seeded(31), [lo, hi] = K.RANGES.localJd;
  for (let made = 0; made < 40; made++) {
    const lon = Number((-180 + 360 * rnd()).toFixed(2)), lat = Number((-90 + 180 * rnd()).toFixed(2)), jd = Number((lo + 1 + (hi - lo - 2) * rnd() - lon / 360).toFixed(5));
    const there = G.initialState("#sky=" + jd.toFixed(5) + "," + lat.toFixed(2) + "," + lon.toFixed(2) + "&lens=" + LENSES[made % 3]);
    assert.ok(there.sky && there.notes.length === 0, `random sky ${made + 1} (JD ${jd}, ${lat}, ${lon}): the Lexicon Explorer opens it`);
    roundTrip(there.sky, there.lens, `random sky ${made + 1} (JD ${jd}, ${lat}, ${lon})`);
  }
  // with no sky on show there is no place and no time to carry: the lens alone
  for (const lens of LENSES) for (const none of [undefined, null, {}, { jd: "1505042.16624" }]) assert.equal(G.skyPageHref("sky", lens, none), KIT.LINKS.celestialControlPanel + "#lens=" + lens, `${lens}: without a whole sky the link carries the lens alone`);
});

// A known fault, kept as a test that runs. The sky page judges the Julian Day of a link at Greenwich when it reads the
// link (its rule for jd) and at the place afterwards. A sky within half a day of either end of the year range, at a
// longitude far from Greenwich, is a sky for both pages and for the core, but its jd is refused by that rule. So the
// Lexicon Explorer's link back to the sky page opens the place at the present day, with the note, and the sky page
// itself cannot write "Copy a link to this sky" for it (skyLinkHref throws). When the rule is changed, take the todo away
// and move to `yes` the values of LINK_VALUES.jd.copyOnly that the sky page then reads.
test("At the very ends of the year range, too, a sky opened in the Lexicon Explorer links back to the same sky, and the sky page can write its own link", { todo: "the sky page judges the Julian Day of a link at Greenwich: within half a day of either end of the year range a sky far east or west loses its time" }, () => {
  for (const [jd, lat, lon] of [[JD_LO - 0.4, 0, 180], [JD_HI + 0.4, 0, -180], [JD_LO - 0.2, 32.13, 135.76], [JD_HI + 0.2, -33.87, -120]]) {
    const what = `the sky of JD ${jd}, ${lat}, ${lon}`;
    assert.ok(K.skyInputsValid(jd, lat, lon), `${what}: is a sky for the core`);
    const there = G.initialState("#sky=" + jd + "," + lat + "," + lon + "&lens=navigator");
    assert.ok(there.sky && there.notes.length === 0, `${what}: is a sky for the Lexicon Explorer`);
    const typedThere = P.setJd(P.typePlace(P.initialState(), lat, lon).state, jd);
    assert.equal(typedThere.jdUt, jd, `${what}: is a sky for the sky page`);
    const back = P.initialState({ hash: fragment(G.skyPageHref("sky", "navigator", there.sky)), nowMs: 1 });
    assert.equal(back.notes.link, "", `${what}: the Lexicon Explorer's link is read by the sky page with the note ${JSON.stringify(back.notes.link)}`);
    assert.deepEqual(K.formatSkyInputs(back.jdUt, back.site.lat, back.site.lonEast), { ...there.sky }, `${what}: the sky page opens another sky`);
    assert.doesNotThrow(() => P.skyLinkHref(typedThere), `${what}: the sky page cannot write its own link to it`);
  }
});

test("A link a page writes to itself comes back to the same sky, the same entry and the same lens", async () => {
  // the sky page: "Copy a link to this sky"
  for (const sky of SKIES) {
    for (const lens of LENSES) {
      const state = P.setLens(sky.state(), lens), href = P.skyLinkHref(state), q = roundedOf(state);
      assert.ok(KIT.isAllowedUrl(href) && pageOf(href) === KIT.LINKS.celestialControlPanel, `${sky.name}, ${lens}: ${href} is the sky page's own address`);
      assert.equal(fragment(href), "#jd=" + q.jdUt.toFixed(5) + "&lat=" + K.formatSkyInputs(q.jdUt, q.lat, q.lonEast).lat + "&lon=" + K.formatSkyInputs(q.jdUt, q.lat, q.lonEast).lon + "&lens=" + lens, `${sky.name}, ${lens}: jd, lat, lon and lens, rounded as a sealed sky is`);
      const parsed = P.parseHash(fragment(href));
      assert.deepEqual({ ...parsed.values }, { jd: q.jdUt, lat: q.lat, lon: q.lonEast, lens }, `${sky.name}, ${lens}: the sky page reads its own link`);
      const back = P.initialState({ hash: fragment(href), nowMs: 1 });
      assert.equal(back.notes.link, "", `${sky.name}, ${lens}: without a note`);
      assert.deepEqual(roundedOf(back), q, `${sky.name}, ${lens}: the same three rounded numbers`);
      assert.equal(back.site.label, state.site.label, `${sky.name}, ${lens}: the same place name`);
      assert.equal(back.lens, lens, `${sky.name}, ${lens}: the same lens`);
      assert.equal(P.lexiconSkyHref(back), P.lexiconSkyHref(state), `${sky.name}, ${lens}: and the same link on to the Lexicon Explorer`);
      assert.deepEqual([{ ...G.parseHash(fragment(href)).values }, G.parseHash(fragment(href)).ignored], [{ lens }, 3], `${sky.name}, ${lens}: the Lexicon Explorer would read the lens of it and ignore jd, lat and lon: a sky travels there as sky=`);
    }
    const copied = P.initialState({ hash: fragment(P.skyLinkHref(sky.state())) });
    assert.equal((await P.sealSky(copied, { at: AT_LATER })).chainId, (await sealedOnSkyPage(sky)).chainId, `${sky.name}: whoever opens the copied link seals the same chain`);
  }
  // the Lexicon Explorer: the address it writes for every entry, of the built-in lexicon and of a sky
  for (const lens of LENSES) {
    for (const address of G.EZEKIEL.addresses) {
      const href = G.entryHref(address, lens);
      assert.equal(href, KIT.LINKS.lexiconExplorer + "#entry=" + address + "&lens=" + lens, `${address}, ${lens}: entry and lens`);
      const back = G.initialState(fragment(href));
      assert.deepEqual([back.selected, back.view.focus, back.lens, back.notes.length, back.lexicon === G.EZEKIEL], [address, address, lens, 0, true], `${address}, ${lens}: the Lexicon Explorer opens its own link on that entry`);
      assert.equal(P.parseHash(fragment(href)).values.lens, lens, `${address}, ${lens}: the sky page would read the lens of it and nothing else`);
    }
  }
  assert.equal(G.entryHref("", "navigator"), KIT.LINKS.lexiconExplorer + "#lens=navigator", "with nothing selected the address carries the lens alone");
  for (const sky of SKIES) {
    const { state: there } = await openedInLexiconExplorer(sky);
    for (const address of there.lexicon.addresses) {
      const href = G.entryHref(address, there.lens, [there.sky.jd, there.sky.lat, there.sky.lon]);
      assert.equal(href, KIT.LINKS.lexiconExplorer + "#sky=" + there.sky.jd + "," + there.sky.lat + "," + there.sky.lon + "&entry=" + address + "&lens=" + there.lens, `${sky.name}, ${address}: sky, entry and lens`);
      const back = G.initialState(fragment(href));
      assert.deepEqual([back.selected, back.lens, back.notes.length, back.lexicon.origin], [address, there.lens, 0, "page"], `${sky.name}, ${address}: opens on that entry of that sky`);
      assert.deepEqual(back.lexicon.entries.map((e) => e.line), there.lexicon.entries.map((e) => e.line), `${sky.name}, ${address}: the same sky`);
    }
    // an entry of the built-in lexicon that the sky does not have is said, not guessed
    assert.deepEqual(G.initialState(fragment(G.entryHref(there.lexicon.addresses[0], "navigator", [there.sky.jd, there.sky.lat, there.sky.lon])).replace("entry=1", "entry=26.1.1")).notes, [G.UNKNOWN_ENTRY_NOTE], `${sky.name}: an address the sky lacks gets the note`);
  }
});

test("A focus link the sky page can write selects that object once a place is known, or is dropped with the note; the Lexicon Explorer neither reads nor writes one", () => {
  const selected = new Set();
  for (const lens of LENSES) {
    for (const object of P.OBJECTS) {
      const hash = P.formatHash({ preset: "ezekiel", focus: object.key, lens });
      assert.equal(hash, "#preset=ezekiel&focus=" + object.key + "&lens=" + lens, `${object.key}, ${lens}: the link as written`);
      const parsed = P.parseHash(hash);
      assert.deepEqual({ ...parsed.values }, { preset: "ezekiel", focus: object.key, lens }, `${object.key}, ${lens}: read back`);
      const there = P.initialState({ hash });
      if (there.selected === object.key) { selected.add(object.key + " " + lens); assert.equal(there.notes.link, "", `${object.key}, ${lens}: selected without a note`); }
      else { assert.equal(there.selected, null, `${object.key}, ${lens}: nothing else is selected in its place`); assert.equal(there.notes.link, P.IGNORED_NOTE, `${object.key}, ${lens}: dropped with the note`); }
      assert.equal(there.site.key, "kebar", `${object.key}, ${lens}: the preset still opens`);
      // without a place a focus means nothing
      const nowhere = P.initialState({ hash: "#focus=" + object.key + "&lens=" + lens });
      assert.deepEqual([nowhere.selected, nowhere.site, nowhere.notes.link], [null, null, P.IGNORED_NOTE], `${object.key}, ${lens}: ignored before a place is chosen`);
      // the other page
      assert.deepEqual({ ...G.parseHash(hash).values }, { lens }, `${object.key}, ${lens}: the Lexicon Explorer reads only the lens of such a link`);
      assert.equal(G.parseHash(hash).note, G.IGNORED_NOTE, `${object.key}, ${lens}: and says so`);
    }
    for (const object of P.OBJECTS.filter((o) => o.kind === "body")) assert.ok(selected.has(object.key + " " + lens), `${lens}: the body ${object.key} can be opened by a link`);
    assert.ok(selected.has("zenith " + lens), `${lens}: the straight-up point can be opened by a link`);
    // What is dropped, exactly, as CELESTIAL_CONTROL_PANEL.md lists it under the key focus: the depth rings (no link
    // key draws them), the two directions of the galactic frame (no link key sets that frame), the opposite point
    // (it needs a selection of its own) and, below the Holographer lens, the shadow transform.
    const dropped = P.OBJECTS.filter((o) => !selected.has(o.key + " " + lens)).map((o) => o.key);
    const expected = P.OBJECTS.filter((o) => o.kind === "ring" || o.key === "galactic_centre" || o.key === "ngp" || o.key === "antipode" || (o.key === "shadow" && lens !== "holographer")).map((o) => o.key);
    assert.deepEqual(dropped, expected, `${lens}: the objects a focus link cannot open are the ones the document lists`);
  }
  assert.equal(P.OBJECTS.filter((o) => o.kind === "ring").length, 7, "seven depth rings are objects (the eighth ring is the microwave background, which a link can open)");
  assert.ok(throws(() => KIT.formatHashWith(G.SKY_PAGE_GRAMMAR, { focus: "moon" })), "the Lexicon Explorer cannot write a focus link");
  assert.ok(throws(() => P.formatHash({ focus: "ezekiel" })), "the sky page cannot write a focus on something that is not an object");
});

test("The link functions of both models are the ones listed here, the links without a fragment are the kit's, and every page they name is a file", () => {
  const hrefs = (module) => Object.keys(module).filter((k) => /Href$/.test(k)).sort();
  assert.deepEqual(hrefs(P), ["entryHref", "firstExplorersHref", "lexiconSkyHref", "skyLinkHref"], "the sky page's model writes links with these four functions (a new one must be tried in this file)");
  assert.deepEqual(hrefs(G), ["entryHref", "firstExplorersHref", "skyPageHref"], "the Lexicon Explorer's model writes links with these three functions (a new one must be tried in this file)");
  assert.deepEqual(Object.keys(KIT.LINKS).sort(), ["celestialControlPanel", "firstExplorers", "lexiconExplorer", "wingIndex"], "the kit knows four pages");
  for (const folder of ["Celestial_Control_Panel", "Lexicon_Explorer"]) {
    for (const [name, link] of Object.entries(KIT.LINKS)) assert.ok(existsSync(path.join(ROOT, WING, folder, link)), `${name}: ${link} leads from ${folder} to a file that exists`);
  }
  // the wing index opens both pages and First Explorers
  const wing = read(WING + "index.html");
  for (const page of ["Celestial_Control_Panel/index.html", "Lexicon_Explorer/index.html", "First_Explorers/index.html"]) {
    assert.ok(wing.includes(`<a class="module-link" href="${page}">`), `the wing index has an entry that opens ${page}`);
    assert.ok(existsSync(path.join(ROOT, WING, page)), `${page} exists`);
  }
  // The shells (DOM modules, not importable here) set an href only from the model's link functions, from a view the
  // model resolved (x.href), or from a page of the kit's LINKS; the one fragment a shell writes itself is the lens.
  // (x.link.href is the link of a gold-box sentence, a.href and p.href the link of an entry action and of a pointer,
  // k.href a link under a gold box, p.href a page of the dialog: each was tried above.)
  const allowed = [/^[a-z]\.href$/, /^[a-z]\.link\.href$/, /^M\.(entryHref|lexiconSkyHref|skyLinkHref|skyPageHref|firstExplorersHref)\(/, /^LINKS\.(firstExplorers|wingIndex)$/,
    /^LINKS\.lexiconExplorer \+ formatHashWith\(M\.LEXICON_PAGE_GRAMMAR$/];
  const shells = { "Celestial_Control_Panel/celestial-control-panel.js": 0, "Celestial_Control_Panel/celestial-chart.js": 0, "Lexicon_Explorer/lexicon-explorer.js": 0, "Lexicon_Explorer/lexicon-canvas.js": 0 };
  for (const file of Object.keys(shells)) {
    const source = read(WING + file);
    const written = [...source.matchAll(/\bhref: ([^,}]+)/g), ...source.matchAll(/\bconst href = ([^;]+);/g)].map((m) => m[1].trim());
    for (const expression of written) assert.ok(allowed.some((re) => re.test(expression)), `${file} sets an href from "${expression}": a link this test has not tried on the other page`);
    for (const m of source.matchAll(/\bLINKS\.([A-Za-z]+)/g)) assert.ok(Object.hasOwn(KIT.LINKS, m[1]), `${file}: LINKS.${m[1]} is a page of the kit`);
    for (const m of source.matchAll(/\bformatHash(?:With)?\(([^;\n]*)/g)) {
      assert.ok(/^M\.LEXICON_PAGE_GRAMMAR, \{ lens: state\.lens \}\)/.test(m[1]) || /^\{ sky, entry, lens: state\.lens \}\)/.test(m[1]),
        `${file} writes a fragment with formatHash(${m[1]}: a link this test has not tried`);
    }
    shells[file] = written.length;
  }
  assert.ok(shells["Celestial_Control_Panel/celestial-control-panel.js"] >= 6, "the sky page's shell sets the links this file tried");
  assert.ok(shells["Lexicon_Explorer/lexicon-explorer.js"] >= 6, "the Lexicon Explorer's shell sets the links this file tried: a sky's link back, a pointer, an entry action, a gold-box sentence, a gold-box link, a page of the dialog");
  assert.match(read(WING + "Lexicon_Explorer/lexicon-explorer.js"), /href: M\.skyPageHref\("sky", state\.lens, state\.sky\)/, "the banner over a sky links to the sky page with the sky on show and the lens on show");
});

// Fragments that must do nothing on either page. None of them may throw anywhere.
const HOSTILE = ["#&&&", "#=", "#a=b=c", "#__proto__=1", "#constructor=x&toString=y&valueOf=z", "#hasOwnProperty=1", "#lens=wizard", "#lens=stargazer&lens=navigator", "#LENS=navigator", "#lens",
  "#sky=1,2", "#sky=1e5,0,0", "#sky=NaN,0,0", "#sky=,,", "#sky=2451545,,0", "#sky=2451545,0,", "#sky=,0,0", "#sky=1505042.16624,32.13,45.23\n", "#sky=2461359.39603,91,0", "#sky=2461359.39603,0,181", "#sky=9999999,0,0", "#sky=2461359.39603,51.48,0.00,1", "#sky=2461359.3960312,51.48,0.00",
  "#sky=1505042.16624,32.13,45.23&sky=1505042.16624,32.13,45.23", "#sky=1505042.16624;32.13;45.23", "#sky=1505042.16624%2C32.13%2C45.23", "#sky=[1505042.16624,32.13,45.23]",
  "#entry=01", "#entry=1.2.3.4.5.6.7.8.9", "#entry=26.1&entry=26.2", "#entry=26..1", "#entry=10000", "#entry=-1", "#entry=26.1.1 ", "#entry=26.1\n", "#entry=٢٦", "#entry=26.1/../../x", "#entry=<img src=x onerror=alert(1)>",
  "#jd=99999999", "#jd=-5", "#jd=1e7", "#jd=2461359.3960312", "#lat=91&lon=181", "#lat=1e1&lon=0x10", "#lat=10&lat=20&lon=5&lon=6", "#preset=ezekiel%20", "#preset=EZEKIEL", "#preset=ezekiel&preset=ezekiel", "#site=atlantis", "#site=__proto__",
  "#focus=%3Cscript%3E", "#focus=<script>alert(1)</script>", "#focus=constructor", "#lab=circle", "#lab=square&lab=square", "#lens=stargazer\u0000", "#lens=navigator\u202e", "#lens=navigator\n",
  "#" + "a=1&".repeat(600), "#lens=" + "x".repeat(3000), "#lens=navigator&" + "y".repeat(2100), "javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "#\ud800", "##lens=navigator", "#?lens=navigator", "# lens=navigator"];

test("Hostile and malformed links are refused by both pages without throwing, and leave both pages as they were", () => {
  const skyKeys = grammarKeys(P.HASH_GRAMMAR), lexiconKeys = grammarKeys(G.HASH_GRAMMAR);
  const firstSky = P.initialState({ nowMs: 86400000 }), firstLexicon = G.initialState("");
  const sameSky = (s, what) => assert.deepEqual([s.site, s.jdUt, s.lens, s.selected, s.step, s.lab.open, s.dims, s.frame], [null, firstSky.jdUt, "stargazer", null, 1, false, "2D", "hor"], `${what}: the sky page is as it was`);
  const sameLexicon = (s, what) => assert.deepEqual([s.lexicon === G.EZEKIEL, s.sky, s.lens, s.selected, s.station, s.tab, s.view.focus], [true, null, "stargazer", null, firstLexicon.station, firstLexicon.tab, firstLexicon.view.focus], `${what}: the Lexicon Explorer is as it was`);
  for (const hash of HOSTILE) {
    const what = JSON.stringify(hash.length > 60 ? hash.slice(0, 60) + "…" : hash);
    let a = null, b = null, sky = null, lexicon = null, later = null;
    assert.doesNotThrow(() => { a = P.parseHash(hash); b = G.parseHash(hash); }, `${what}: neither parser throws`);
    for (const [parsed, page] of [[a, "the sky page"], [b, "the Lexicon Explorer"]]) {
      assert.equal(Object.getPrototypeOf(parsed.values), null, `${what}: ${page}'s values have no prototype`);
      assert.deepEqual(Object.keys(parsed.values), [], `${what}: ${page} takes no value from it`);
      assert.ok(parsed.ignored >= 1, `${what}: ${page} counts it as ignored`);
    }
    assert.deepEqual([a.note, b.note], [P.IGNORED_NOTE, G.IGNORED_NOTE], `${what}: both pages say that a link value was ignored`);
    assert.doesNotThrow(() => { sky = P.applyHash(firstSky, hash); lexicon = G.initialState(hash); later = G.applyHash(firstLexicon, hash); }, `${what}: neither page throws when the link is applied`);
    sameSky(sky, what); sameLexicon(lexicon, what); sameLexicon(later, what);
    assert.equal(sky.notes.link, P.IGNORED_NOTE, `${what}: the sky page shows the note`);
    assert.deepEqual(lexicon.notes, [G.IGNORED_NOTE], `${what}: the Lexicon Explorer shows the note`);
  }
  assert.equal(({}).polluted, undefined, "nothing reached Object.prototype");
  // what is not a string at all
  for (const value of [null, undefined, 42, 0, true, {}, [], ["#lens=navigator"], { lens: "navigator" }, Symbol.iterator, () => "#lens=navigator"]) {
    let a = null, b = null;
    assert.doesNotThrow(() => { a = P.parseHash(value); b = G.parseHash(value); sameSky(P.applyHash(firstSky, value), String(typeof value)); }, `a ${typeof value} is not a link, and nothing throws`);
    assert.deepEqual([Object.keys(a.values), Object.keys(b.values)], [[], []], `a ${typeof value} gives no value`);
  }
  // each page ignores the other page's keys, and half a place, and a thing that is not there
  for (const hash of ["#preset=ezekiel", "#site=greenwich", "#jd=2461359.39603", "#lat=51.48&lon=0.00", "#focus=moon", "#lab=square"]) {
    const there = G.initialState(hash);
    assert.deepEqual(Object.keys(G.parseHash(hash).values), [], `${hash}: the Lexicon Explorer reads none of the sky page's keys`);
    sameLexicon(there, hash);
    assert.deepEqual(there.notes, [G.IGNORED_NOTE], `${hash}: and says so`);
  }
  for (const hash of ["#sky=1505042.16624,32.13,45.23", "#entry=26.1.1"]) {
    const there = P.applyHash(firstSky, hash);
    assert.deepEqual(Object.keys(P.parseHash(hash).values), [], `${hash}: the sky page reads none of the Lexicon Explorer's keys`);
    sameSky(there, hash);
    assert.equal(there.notes.link, P.IGNORED_NOTE, `${hash}: and says so`);
  }
  for (const hash of ["#lat=10", "#lon=10", "#lat=91&lon=0", "#lat=0&lon=181", "#focus=moon", "#jd=1"]) { const there = P.applyHash(firstSky, hash); sameSky(there, hash); assert.equal(there.notes.link, P.IGNORED_NOTE, `${hash}: half a place, a focus without a place and an instant out of range are dropped with the note`); }
  const missing = G.initialState("#entry=999.999");
  sameLexicon(missing, "#entry=999.999");
  assert.deepEqual(missing.notes, [G.UNKNOWN_ENTRY_NOTE], "an address the lexicon does not have is said, and nothing is selected");
  // random fragments made of the pieces of real links and of characters that do not belong
  const rnd = seeded(2600), pick = (list) => list[Math.floor(rnd() * list.length)];
  const pieces = [...new Set([...skyKeys, ...lexiconKeys]), "=", "=", "&", "&", "#", ",", ".", "-", "_", "%", " ", "<", ">", "\"", "'", "\\", "/", "\u0000", "\u202e", "é", "ezekiel", "square", "navigator", "moon", "26.1", "1505042.16624", "32.13", "45.23", "__proto__", "9".repeat(9)];
  for (let i = 0; i < 400; i++) {
    const hash = "#" + Array.from({ length: 1 + Math.floor(rnd() * 9) }, () => pick(pieces)).join("");
    let a = null, b = null;
    assert.doesNotThrow(() => { a = P.parseHash(hash); b = G.parseHash(hash); P.applyHash(firstSky, hash); G.initialState(hash); }, `${JSON.stringify(hash)}: nothing throws`);
    assert.ok(Object.keys(a.values).every((k) => skyKeys.includes(k)) && Object.keys(b.values).every((k) => lexiconKeys.includes(k)), `${JSON.stringify(hash)}: only keys of the grammar are returned`);
    for (const v of [...Object.values(a.values), ...Object.values(b.values)]) assert.ok(typeof v === "string" || typeof v === "number" || (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number")), `${JSON.stringify(hash)}: a value is a word, a number or three numbers`);
  }
});

// ─── 5. the facts blocks of the two documents ────────────────────────────────

const FACT_LINE = /^([a-z]+(?:\.[a-z]+)*) = (\S(?:.*\S)?)$/;
/** The fenced blocks of a Markdown text: [{ info, line (1-based, of the opening fence), lines }], and the fence left open, if any. */
function fencedBlocks(markdown) {
  const lines = markdown.split(/\r?\n/), blocks = [];
  let open = null;
  lines.forEach((line, i) => {
    if (open === null) {
      const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (m) open = { mark: m[1][0], length: m[1].length, info: m[2].trim(), line: i + 1, lines: [] };
    } else if (new RegExp("^ {0,3}" + (open.mark === "`" ? "`" : "~") + "{" + open.length + ",}\\s*$").test(line)) { blocks.push(open); open = null; }
    else open.lines.push(line);
  });
  return { blocks, unclosed: open };
}
/** The facts of a document as a Map name -> value (both text). Fails on a missing block, a second block, a block left open, a line that is not `name = value` and a name given twice. */
function readFacts(markdown, document) {
  const { blocks, unclosed } = fencedBlocks(markdown);
  assert.equal(unclosed, null, `${document}: a fenced block is left open${unclosed ? " at line " + unclosed.line : ""}`);
  const facts = blocks.filter((b) => /^facts\b/i.test(b.info));
  assert.ok(facts.length >= 1, `${document}: there is no fenced block with the info string facts`);
  assert.equal(facts.length, 1, `${document}: there is more than one facts block (at lines ${facts.map((b) => b.line).join(" and ")})`);
  assert.equal(facts[0].info, "facts", `${document}: the info string is exactly facts`);
  assert.ok(facts[0].lines.length > 0, `${document}: the facts block is empty`);
  const out = new Map();
  facts[0].lines.forEach((line, i) => {
    const m = FACT_LINE.exec(line);
    assert.ok(m, `${document}, line ${facts[0].line + 1 + i}: ${JSON.stringify(line)} is not "name = value"`);
    assert.ok(!out.has(m[1]), `${document}, line ${facts[0].line + 1 + i}: the name ${m[1]} is given twice`);
    out.set(m[1], m[2]);
  });
  return out;
}
/** Compares a document's facts with the recomputed ones; returns one line for each thing that is wrong. */
function factProblems(stated, recomputed) {
  const problems = [];
  for (const [name, value] of stated) {
    if (!Object.hasOwn(recomputed, name)) problems.push(`${name}: the document states it, and this test does not know how to recompute it`);
    else if (String(recomputed[name]) !== value) problems.push(`${name}: the document says ${value}, the code gives ${recomputed[name]}`);
  }
  for (const name of Object.keys(recomputed)) if (!stated.has(name)) problems.push(`${name}: the code gives ${recomputed[name]}, and the document's block does not state it`);
  return problems;
}
/** How many tests a test file declares: its lines that begin with test( . */
const declaredTests = (file) => (read(file).match(/^test\(/gm) || []).length;
const distinct = (list) => new Set(list).size;

/** The Ezekiel lexicon, sealed once by the Lexicon Explorer's model (a second or two) and reused. */
const sealedEzekiel = once(() => G.sealLexicon(G.EZEKIEL, { at: AT }));

/** Every fact of STRIX_OVERWATCH.md, recomputed: name -> value. OW, G, LEX and SUP are the modules loaded above. */
async function strixFacts() {
  const entries = LEX.ROWS.map((r) => OW.makeEntry(...r));
  const text = OW.lexiconText(entries), layers = OW.layerCounts(entries);
  const ofKind = (kind) => entries.filter((e) => e.kind === kind).length;
  const nine = G.READER_VERSES.map((address) => entries.find((e) => e.address === address).text);
  const inNine = (word) => nine.reduce((n, verse) => n + OW.countWord(verse, word), 0);
  const epochTexts = OW.treeEpochTexts(entries);
  const packets = OW.lexiconPackets(text);
  const makes = (...args) => !throws(() => OW.makeEntry(...args));
  // a small sealed package, to find the limits of the front door by trying
  const small = [OW.makeEntry("1", "reading", "note", "One", "A first entry."), OW.makeEntry("1.1", "text", "note", "Two", "A child."), OW.makeEntry("2", "said", "note", "Three", "A second top-level entry.")];
  const bundle = await OW.buildLexiconBundle(small, { at: AT });
  const { certificate } = await OW.issueCertificate(bundle, await OW.newSessionKeys(), AT);
  const pack = OW.makeHyperpack({ ...bundle, certificate }), wire = JSON.stringify(pack);
  assert.equal((await OW.readHyperpack(wire)).ok, true, "the small package the limits are tried on is accepted as it is");
  const atDoor = async (change) => { const p = JSON.parse(wire); change(p); return (await OW.readHyperpack(JSON.stringify(p))).failed !== "parse"; };
  const nested = (k) => { let v = "x"; for (let i = 0; i < k; i++) v = { a: v }; return v; };
  const grown = (await sealedEzekiel()).bundle;
  assert.deepEqual(G.EZEKIEL.entries.map((e) => e.line), entries.map((e) => e.line), "the Lexicon Explorer's built-in lexicon is the rows of ezekiel-1.js");
  const cells = OW.glyphCells("9841D88D8B003CEA");
  const seeds = Array.from({ length: 16 }, (_, n) => [n & 1, (n >> 1) & 1, (n >> 2) & 1, (n >> 3) & 1]);
  return {
    "lex.layers": OW.LAYERS.length,
    "lex.address.indices.max": await largest(1, 64, (n) => makes(Array(n).fill("1").join("."), "text", "note", "a", ""), "indices of an address"),
    "lex.address.index.max": await largest(1, 100000, (n) => makes(String(n), "text", "note", "a", ""), "one index"),
    "lex.kind.characters.max": await largest(1, 256, (n) => makes("1", "text", "a".repeat(n), "a", ""), "characters of a kind"),
    "lex.name.codepoints.max": await largest(1, 4096, (n) => makes("1", "text", "note", "a".repeat(n), ""), "code points of a name"),
    "lex.text.codepoints.max": await largest(1, 65536, (n) => makes("1", "text", "note", "a", "a".repeat(n)), "code points of a text"),
    "lexicon.bytes.max": OW.MAX_LEXICON_BYTES,
    "lexicon.entries.max": OW.MAX_ENTRIES,
    "lexicon.epochs.max": OW.MAX_EPOCHS,
    "packet.chunk.bytes": await largest(1, 8192, (n) => OW.lexiconPackets("a".repeat(n)).length === 1, "bytes of one packet"),
    "pack.characters.max": OW.MAX_PACK_CHARS,
    "pack.members": Object.keys(pack).length,
    "pack.certificate.members": await (async () => {
      const members = Object.keys(pack.certificate);
      for (const member of members) assert.equal(await atDoor((p) => { delete p.certificate[member]; }), false, `a certificate without ${member} is refused at the door`);
      return members.length;
    })(),
    "pack.depth.max": 2 + await largest(1, 64, (k) => atDoor((p) => { p.route = { from: "origin", to: nested(k) }; }), "nesting of a package"),
    "pack.lineage.rows.max": await largest(1, 1024, (n) => atDoor((p) => { p.lineage = Array.from({ length: n }, () => ({ ...p.lineage[0] })); }), "lineage rows of a package"),
    "pack.ledger.entries.max": await largest(1, 5000, (n) => atDoor((p) => { p.trace = Array.from({ length: n }, () => ({ ...p.trace[0] })); }), "ledger entries of a package"),
    "pack.file.bytes.max": G.MAX_FILE_BYTES,
    "pack.ledger.string.characters.shown.max": await (async () => {
      // a package whose ledger holds one long string, read as a package from outside: how much of the string is shown
      const long = [OW.makeEntry("1", "reading", "note", "One", "A first entry.")];
      const b = await OW.buildLexiconBundle(long, { at: AT });
      for (const n of [95, 96, 97, 500]) OW.traceAppend(b.trace, "visitor", "note", "x".repeat(n), AT);
      const { certificate: c } = await OW.issueCertificate(b, await OW.newSessionKeys(), AT);
      const shown = await G.readOutside(JSON.stringify(OW.makeHyperpack({ ...b, certificate: c })));
      assert.equal(shown.ok, true, "the package with long ledger strings is accepted");
      const details = shown.covered.ledger.slice(-4).map((e) => e.detail);
      assert.deepEqual(details.map((t) => /^x+…?$/.test(t)), [true, true, true, true], "the four strings are shown");
      assert.deepEqual(details.slice(0, 2), ["x".repeat(95), "x".repeat(96)], "a string of up to that many characters is shown whole");
      assert.equal(details[2], details[3], "a longer one is cut to one length, whatever its own");
      assert.ok(details[3].endsWith("…"), "and ends in the mark that it was cut");
      assert.equal(Array.from(details[3]).length, G.LEDGER_POINTS, "that length is the model's LEDGER_POINTS");
      return Array.from(details[3]).length;
    })(),
    "overwatch.checks": OW.OVERWATCH_CHECKS.length,
    "package.checks": OW.PACKAGE_CHECKS.length,
    "witness.need.default": (await OW.witnessQuorum([], wire, { known: [] })).need,
    "witness.receivers": OW.CROSSROADS.length,
    "witness.marks": G.WITNESS_MARKS.map((m) => m.need).join(","),
    "tampers": OW.LEXICON_TAMPERS.length,
    "tampers.refused": OW.LEXICON_TAMPERS.filter((t) => t.expected !== "accepted").length,
    "tampers.accepted": OW.LEXICON_TAMPERS.filter((t) => t.expected === "accepted").length,
    "tampers.stargazer": G.tamperRows("stargazer").length,
    "word.bits": cells.length,
    "word.sectors": distinct(cells.map((c) => c.sector)),
    "word.rings": distinct(cells.map((c) => c.ring)),
    "word.quadrants": distinct(cells.map((c) => c.quadrant)),
    "word.rows": distinct(cells.map((c) => c.row)),
    "word.fields": OW.PACKET_FIELDS.length,
    "word.parity.bit": OW.PACKET_FIELDS.find((f) => f.key === "parity").hi,
    "word.mirror.words": distinct(seeds.map((seed) => OW.seedMirror(seed))),
    "word.wheel.cell.area": G.WHEEL_CELL_AREA.toFixed(4),
    "stations": G.STATIONS.length,
    "stations.stargazer": G.visibleStations("stargazer").length,
    "stations.sky.navigator": G.visibleStations("navigator", "page").length,
    "stations.sky.stargazer": G.visibleStations("stargazer", "page").length,
    "stations.outside": G.visibleStations("navigator", "outside").length,
    "tabs": G.TABS.length,
    "lexicon.rows": LEX.ROWS.length,
    "lexicon.bytes": utf8Bytes(text),
    "lexicon.epochs": grown.lineage.length,
    "lexicon.epoch.bytes": epochTexts.map((t, i) => utf8Bytes(t) - (i ? utf8Bytes(epochTexts[i - 1]) : 0)).join(","),
    "lexicon.packets": packets.length,
    "lexicon.packets.with.agreeing.corners": packets.filter((p) => { const [a, b, c] = OW.squareQuarters(p); return OW.fourthFromThree(a, b, c).agree; }).length,
    "lexicon.rows.text": layers.text,
    "lexicon.rows.said": layers.said,
    "lexicon.rows.checked": layers.checked,
    "lexicon.rows.reading": layers.reading,
    "lexicon.kinds": distinct(entries.map((e) => e.kind)),
    "lexicon.books": ofKind("book"),
    "lexicon.chapters": ofKind("chapter"),
    "lexicon.verses": ofKind("verse"),
    "lexicon.terms": ofKind("term"),
    "lexicon.plain": ofKind("plain"),
    "lexicon.links": ofKind("link"),
    "lexicon.counts": ofKind("count"),
    "lexicon.searches": ofKind("search"),
    "lexicon.author.lines": entries.filter((e) => /^100\.\d+$/.test(e.address) && /^Line \d+$/.test(e.name)).length,
    "lexicon.handles": Object.keys(LEX.HANDLES).length,
    "lexicon.chain.id": grown.chain.chainId,
    "lexicon.ledger.entries": grown.trace.length,
    "reader.verses": G.READER_VERSES.length,
    "reader.terms": entries.filter((e) => e.kind === "term" && G.READER_VERSES.includes(OW.parentOf(e.address))).length,
    "count.thirtieth": inNine("thirtieth"),
    "count.fourth": inNine("fourth"),
    "count.fifth": inNine("fifth"),
    "count.four": inNine("four"),
    "supplied.verses": Object.keys(SUP.SUPPLIED_VERSES).length,
    "supplied.terms": Object.keys(SUP.SUPPLIED_TERMS).length,
    "tests.strix.overwatch.declared": declaredTests("tests/unit/strix-overwatch.test.mjs"),
    "tests.strix.lexicon.declared": declaredTests("tests/unit/strix-lexicon.test.mjs"),
    "tests.ezekiel.lexicon.declared": declaredTests("tests/unit/ezekiel-lexicon.test.mjs"),
    "tests.lexicon.explorer.model.declared": declaredTests("tests/unit/lexicon-explorer-model.test.mjs"),
  };
}

/** Every fact of CELESTIAL_CONTROL_PANEL.md, recomputed: name -> value. */
async function skyFacts() {
  const FIX = JSON.parse(read("tests/unit/fixtures/celestial-vectors.json"));
  const within180 = (x) => ((x + 180) % 360 + 360) % 360 - 180;
  const jdOf = (v) => { const i = v.input; return K.jdFromCalendar(i.year, i.month, i.day + (i.hour + (i.minute + i.second / 60) / 60) / 24, i.calendar); };
  const modern = FIX.vectors.filter((v) => v.input.year >= 1800 && v.input.year <= 2200);
  const worst = (difference) => Math.max(...modern.map((v) => Math.abs(difference(K.sky(jdOf(v)), v))));
  const site = (key) => K.SITES.find((s) => s.key === key);
  const kebar = site("kebar"), nazareth = site("nazareth");
  assert.deepEqual([kebar.lat, kebar.lonEast], [32.13, 45.23], "the Kebar site stands where the document's expressions put it");
  const sunsetOn = (day) => K.sunEventOnLocalDay(day, 32.13, 45.23, "set");
  const litAt = (day) => Math.round(100 * K.skyState(sunsetOn(day), 32.13, 45.23).phase.illuminatedFraction);
  const at = sunsetOn(K.EZEKIEL_DATES[0].endsDay), then = K.skyState(at, 32.13, 45.23), year = K.decimalYear(at);
  const east = K.bearingAndDistance(nazareth.lat, nazareth.lonEast, kebar.lat, kebar.lonEast);
  const anchorRadius = (key) => { const a = K.ANCHORS.find((x) => x.key === key); return Math.tanh(K.depthRho(a.distanceLy * K.LIGHT_SECONDS_PER_LY) / 2).toFixed(2); };
  // the year at which the Moon's allowance crosses 0.01 degrees, by 60 steps of bisection between two years on either side of it
  const crossing = (lo, hi) => {
    const above = (y) => K.moonLongitudeSigmaDeg(y) >= 0.01;
    assert.notEqual(above(lo), above(hi), `the allowance crosses 0.01 degrees between the years ${lo} and ${hi}`);
    const left = above(lo);
    for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (above(mid) === left) lo = mid; else hi = mid; }
    return Math.round((lo + hi) / 2);
  };
  const four = H.homecoming(H.slidePath([0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle) => ({ angle, dist: 1 }))).at(-1));
  const tile = H.homecoming(H.slidePath(P.LAB.tileHeadingsDeg.map((d) => ({ angle: d * Math.PI / 180, dist: P.LAB.tile }))).at(-1));
  const degrees = (radians) => radians * 180 / Math.PI;
  const rows = K.skyLexiconRows(K.skyState(P.EZEKIEL_PRESET.jdUt, 32.13, 45.23));
  const epochs = OW.treeEpochTexts(rows.map((r) => OW.makeEntry(...r)));
  const stated = /The committed test runs ([\d,]+) checks/.exec(read("scripts/celestial-core.js"));
  assert.ok(stated, "the header of scripts/celestial-core.js says how many checks the committed test runs");
  const ofKind = (kind) => P.OBJECTS.filter((o) => o.kind === kind).length;
  return {
    "steps": P.STEPS.length,
    "lenses": Object.keys(P.LENS_HINTS).length,
    "sites": K.SITES.length,
    "sites.offered": P.siteChoices().length,
    "objects": P.OBJECTS.length,
    "objects.bodies": ofKind("body"),
    "objects.directions": ofKind("direction"),
    "objects.rim": ofKind("rim"),
    "objects.rings": ofKind("ring"),
    "anchors": K.ANCHORS.length,
    "anchors.with.distance": K.ANCHORS.filter((a) => a.distanceLy !== null).length,
    "year.min": K.YEAR_MIN,
    "year.max": K.YEAR_MAX,
    "vectors": FIX.vectors.length,
    "vectors.modern": modern.length,
    "vectors.ancient": FIX.vectors.filter((v) => v.era === "ancient").length,
    "vectors.checks": Number(stated[1].replace(/,/g, "")),
    "vectors.sun.events": 2 * FIX.extra.sun_events.length,
    "vectors.sun.events.tolerance.seconds": FIX.extra.sun_event_tolerance_seconds,
    "accuracy.sun.longitude.worst.deg": worst((o, v) => within180(o.sun.lambda - v.ephem.sun.lambda_deg)).toFixed(4),
    "accuracy.moon.longitude.worst.deg": worst((o, v) => within180(o.moon.lambda - v.ephem.moon.lambda_deg)).toFixed(4),
    "accuracy.moon.latitude.worst.deg": worst((o, v) => o.moon.beta - v.ephem.moon.beta_deg).toFixed(4),
    "allowance.moon.by.twentyonehundred.deg": K.moonLongitudeSigmaDeg(2100).toFixed(2),
    "allowance.moon.by.twentytwohundred.deg": K.moonLongitudeSigmaDeg(2200).toFixed(1),
    "allowance.moon.ezekiel.deg": K.moonLongitudeSigmaDeg(year).toFixed(2),
    "allowance.deltat.ezekiel.minutes": Math.round(K.deltaTSigma(year) / 60),
    "allowance.badge.before.year": crossing(0, 1200),
    "allowance.badge.after.year": crossing(2005, 2100),
    "sunset.altitude.deg": Math.abs(then.sun.alt).toFixed(2),
    "polaris.pole.distance.today.deg": K.skyState(K.jdFromParts({ year: 2026, month: 11, day: 14 }), 51.4769, 0).anchors.polaris.poleDistance.toFixed(1),
    "polaris.pole.distance.ezekiel.deg": then.anchors.polaris.poleDistance.toFixed(1),
    "depth.rho.zero": K.DEPTH.rho0,
    "depth.kappa": K.DEPTH.kappa,
    "rings": K.RINGS.length,
    "radius.moon": P.COPY_FACTS.radii.moon.toFixed(2),
    "radius.sun": P.COPY_FACTS.radii.sun.toFixed(2),
    "radius.pleiades": anchorRadius("pleiades"),
    "radius.polaris": anchorRadius("polaris"),
    "radius.vela": anchorRadius("vela_pulsar"),
    "radius.cygnus": anchorRadius("cyg_x1"),
    "radius.sagittarius": anchorRadius("sgr_a_star"),
    "radius.andromeda": anchorRadius("m31"),
    "radius.background": Math.tanh(K.RINGS.at(-1).rho / 2).toFixed(2),
    "sun.moon.distance.ratio": P.COPY_FACTS.sunMoonRatio,
    "sun.moon.drawn.ratio": P.COPY_FACTS.drawnRatio.toFixed(1),
    "view.near": P.VIEW.near,
    "view.flight.ms": P.VIEW.flightMs,
    "preset.ezekiel.jd": P.EZEKIEL_PRESET.jdUt.toFixed(5),
    "preset.ezekiel.latitude": kebar.lat.toFixed(2),
    "preset.ezekiel.longitude": kebar.lonEast.toFixed(2),
    "preset.ezekiel.local.time": K.formatClock(K.localMeanHours(at, 45.23)),
    "ezekiel.dates": K.EZEKIEL_DATES.length,
    "moon.lit.default.begins": litAt(K.EZEKIEL_DATES[0].beginsDay),
    "moon.lit.default.ends": litAt(K.EZEKIEL_DATES[0].endsDay),
    "moon.lit.first.alternative.begins": litAt(K.EZEKIEL_DATES[1].beginsDay),
    "moon.lit.first.alternative.ends": litAt(K.EZEKIEL_DATES[1].endsDay),
    "moon.lit.second.alternative.begins": litAt(K.EZEKIEL_DATES[2].beginsDay),
    "moon.lit.second.alternative.ends": litAt(K.EZEKIEL_DATES[2].endsDay),
    "moon.first.quarter.minutes.before.sunset": Math.round((at - K.previousPhaseTime(at, 90)) * 1440),
    "kebar.nazareth.latitude.apart.deg": Math.abs(kebar.lat - nazareth.lat).toFixed(2),
    "kebar.nazareth.minutes.apart": Math.round(Math.abs(kebar.lonEast - nazareth.lonEast) * 4),
    "kebar.bearing.deg": Math.round(east.bearing),
    "kebar.km": Math.round(east.km),
    "kebar.km.rounded": Math.round(east.km / 10) * 10,
    "lab.step.default": P.LAB.aDefault,
    "lab.step.min": P.LAB.aMin,
    "lab.step.max": P.LAB.aMax,
    "lab.step.max.small": P.LAB.aMaxSmall,
    "lab.small.canvas.px": P.LAB.smallCanvas,
    "lab.slide.ms": P.LAB.slideMs,
    "lab.four.gap": four.distance.toFixed(6),
    "lab.four.turn.deg": degrees(four.turnClockwise).toFixed(4),
    "lab.four.area": four.turnClockwise.toFixed(3),
    "lab.tile.side": P.LAB.tile.toFixed(6),
    "lab.tile.turn.deg": degrees(tile.turnClockwise).toFixed(0),
    "lab.tile.squares.at.corner": H.tilingConstants(4, 5).q,
    "lab.five.side": P.LAB.fiveSide.toFixed(6),
    "lab.five.tolerance": P.LAB.fiveTolerance,
    "seal.rows": rows.length,
    "seal.epochs": epochs.length,
    "seal.kebar.chain.id": OW.treeLineage(epochs).at(-1).chainId,
    "link.keys": P.HASH_GRAMMAR.length,
    "tests.celestial.core.declared": declaredTests("tests/unit/celestial-core.test.mjs"),
    "tests.hyperbolic.moves.declared": declaredTests("tests/unit/hyperbolic-moves.test.mjs"),
    "tests.celestial.panel.model.declared": declaredTests("tests/unit/celestial-panel-model.test.mjs"),
    "tests.explorers.policy.declared": declaredTests("tests/static/explorers-policy.test.mjs"),
  };
}

test("The reader of facts blocks used here refuses a missing block, a second block, a block left open, a line that is not name = value and a name given twice", () => {
  const good = "# A document\n\nText.\n\n```facts\none = 1\ntwo.words = a value with spaces\n```\n\n```sh\nnot = facts\n```\n";
  assert.deepEqual([...readFacts(good, "a good document")], [["one", "1"], ["two.words", "a value with spaces"]], "a good block is read, and other fenced blocks are not facts");
  const refused = (markdown, pattern, what) => assert.throws(() => readFacts(markdown, "a document"), (e) => e instanceof assert.AssertionError && pattern.test(e.message), what);
  refused("# A document\n\n```\none = 1\n```\n", /no fenced block/, "no facts block");
  refused("# A document\n\none = 1\n", /no fenced block/, "facts outside a block");
  refused(good + "\n```facts\nthree = 3\n```\n", /more than one facts block/, "a second block");
  refused("```facts\none = 1\n", /left open/, "a block left open");
  refused("```facts extra\none = 1\n```\n", /exactly facts/, "another info string");
  refused("```facts\n```\n", /empty/, "an empty block");
  for (const line of ["one: 1", "one=1", "one =", " one = 1", "one = 1 ", "One = 1", "one.2 = 1", "one..two = 1", ".one = 1", "", "# a comment", "o ne = 1", "one\t= 1"]) {
    refused("```facts\nzero = 0\n" + line + "\n```\n", /is not "name = value"/, `the line ${JSON.stringify(line)}`);
  }
  refused("```facts\none = 1\none = 2\n```\n", /given twice/, "a name given twice");
  assert.deepEqual(factProblems(new Map([["one", "1"], ["two", "2"]]), { one: 1, two: 2 }), [], "equal facts have no problem");
  assert.deepEqual(factProblems(new Map([["one", "1.0"], ["new", "5"]]), { one: 1, two: 2 }).map((p) => p.split(":")[0]), ["one", "new", "two"], "a value that differs as text, an unknown name and an unstated fact are each a problem");
});

for (const [document, facts] of [["STRIX_OVERWATCH.md", strixFacts], ["CELESTIAL_CONTROL_PANEL.md", skyFacts]]) {
  test(`${document} has exactly one facts block, and every line of it is recomputed from the code and equals the document as text`, async () => {
    assert.ok(existsSync(path.join(ROOT, document)), `${document} exists`);
    const stated = readFacts(read(document), document);
    const recomputed = await facts();
    assert.deepEqual(factProblems(stated, recomputed), [], `${document}: the facts block and the code disagree`);
    assert.equal(stated.size, Object.keys(recomputed).length, `${document}: as many facts stated as recomputed`);
  });
}

test("Facts the two documents share with each other and with the pages' own copy are the same", async () => {
  const strix = readFacts(read("STRIX_OVERWATCH.md"), "STRIX_OVERWATCH.md"), sky = readFacts(read("CELESTIAL_CONTROL_PANEL.md"), "CELESTIAL_CONTROL_PANEL.md");
  // the sealed Kebar sky: the document's chain id is the one both pages give
  const kebar = SKIES[1];
  assert.equal(sky.get("seal.kebar.chain.id"), (await sealedOnSkyPage(kebar)).chainId, "the document's chain id of the Kebar sky is the one the sky page seals");
  assert.equal(sky.get("seal.kebar.chain.id"), (await openedInLexiconExplorer(kebar)).seal.chainId, "and the one the Lexicon Explorer seals from the link");
  assert.equal(sky.get("preset.ezekiel.jd") + "," + sky.get("preset.ezekiel.latitude") + "," + sky.get("preset.ezekiel.longitude"), G.parseHash(fragment((await sealedOnSkyPage(kebar)).link)).values.sky.map((n, i) => n.toFixed(i ? 2 : 5)).join(","), "the document's three numbers of the preset are the ones the link carries");
  assert.equal(strix.get("lexicon.chain.id"), (await sealedEzekiel()).chainId, "the document's chain id of the Ezekiel lexicon is the one the Lexicon Explorer seals");
  // numbers that stand in both documents' worlds
  assert.equal(sky.get("lenses"), String(KIT.LENSES.length), "three lenses");
  assert.equal(strix.get("lex.layers"), String(KIT.LAYER_META.length), "four layers");
  assert.equal(strix.get("witness.receivers"), String(G.RECEIVERS.length), "four receivers");
  assert.equal(sky.get("seal.rows"), String(P.COPY_FACTS.seal.rows), "the rows of a sealed sky, as the sky page's copy states them");
  assert.equal(sky.get("kebar.bearing.deg") + "," + sky.get("kebar.km"), G.COPY_FACTS.kebar.bearing + "," + G.COPY_FACTS.kebar.km, "the bearing and distance of the Kebar, as the Lexicon Explorer's copy states them");
  assert.equal(sky.get("lab.tile.squares.at.corner"), String(G.cornersFigure().curved.meet), "five squares at a corner, as the Lexicon Explorer's fourth-square station states");
  assert.equal(sky.get("view.flight.ms"), String(KIT.FLIGHT_MS), "the longest flight, as the kit allows it");
});

// ─── 6. the pages agree where they overlap ───────────────────────────────────

// SPEC 1.1: the four layers, the badge word from Navigator up, the badge word at Stargazer, the shape.
const LAYER_TABLE = [["text", "TEXT", "WRITTEN", "■"], ["said", "SAID", "SAID", "●"], ["checked", "CHECKED", "CHECKED", "✓"], ["reading", "READING", "OUR IDEA", "◆"]];

test("The four layers have the same ids, badge words, shapes and legend in the Overwatch core, the kit and both models", async () => {
  assert.deepEqual([...OW.LAYERS], LAYER_TABLE.map((r) => r[0]), "the core's four layers, in order");
  assert.deepEqual(KIT.LAYER_META.map((m) => [m.id, m.word, m.stargazerWord, m.shape]), LAYER_TABLE, "the kit's ids, words and shapes");
  assert.equal(distinct(KIT.LAYER_META.map((m) => m.colour)), 4, "four different colours");
  // the Lexicon Explorer's badges, for a layer and for an entry of each layer, at every lens
  for (const [layer, word, stargazerWord, shape] of LAYER_TABLE) {
    const entry = G.EZEKIEL.entries.find((e) => e.layer === layer && !G.isAuthorLine(G.EZEKIEL, e.address));
    for (const lens of LENSES) {
      const want = lens === "stargazer" ? stargazerWord : word;
      for (const badge of [G.badgeView(G.EZEKIEL, layer, lens), G.badgeView(G.EZEKIEL, entry.address, lens)]) {
        assert.deepEqual([badge.layer, badge.word, badge.shape, badge.outline], [layer, want, shape, false], `the Lexicon Explorer's ${layer} badge at ${lens}`);
      }
    }
  }
  for (const lens of LENSES) assert.ok(G.AUTHOR_LABEL[lens].startsWith((lens === "stargazer" ? LAYER_TABLE[3][2] : LAYER_TABLE[3][1]) + " · "), `the label over an author's line begins with the READING word of the ${lens} lens`);
  // both dialogs give the kit's legend, in the kit's order, and then the badge help
  const legend = [...KIT.LAYER_META.map((m) => ({ layer: m.id, text: m.legend })), { layer: "checked", text: KIT.BADGE_HELP }];
  for (const [page, model] of [["the sky page", P], ["the Lexicon Explorer", G]]) {
    const section = model.DIALOG.sections.find((s) => s.heading === "The four layers");
    assert.ok(section, `${page}: the dialog has the section "The four layers"`);
    assert.deepEqual(section.items.map((x) => ({ layer: x.layer, text: x.text })), legend, `${page}: it is the kit's legend and the badge help`);
    const sentences = sentencesOf(model);
    assert.ok(sentences.length > 100, `${page}: the model's sentences were found (${sentences.length})`);
    for (const s of sentences) assert.ok(OW.LAYERS.includes(s.layer), `${page}: the sentence ${JSON.stringify(s.text.slice(0, 50))} has the layer ${JSON.stringify(s.layer)}, which is not one of the four`);
    for (const layer of OW.LAYERS) assert.ok(sentences.some((s) => s.layer === layer), `${page}: has sentences of the layer ${layer}`);
    // at the Stargazer lens a page never shows the other lenses' badge words
    for (const s of model.stargazerStrings()) assert.ok(!/\b(TEXT|READING)\b/.test(s.text), `${page}, Stargazer, ${s.where}: says ${JSON.stringify(s.text.slice(0, 60))} with a badge word of the other lenses (Stargazer says WRITTEN and OUR IDEA)`);
  }
  // every row either page seals is in one of the four layers, and a sealed sky keeps them through the other page
  for (const row of LEX.ROWS) assert.ok(OW.LAYERS.includes(row[1]), `the lexicon row ${row[0]} has one of the four layers`);
  for (const sky of SKIES.slice(0, 3)) {
    const mine = await sealedOnSkyPage(sky), { state: there } = await openedInLexiconExplorer(sky);
    assert.deepEqual(G.layerCountsOf(there.lexicon), { ...OW.layerCounts(mine.entries), total: mine.entries.length }, `${sky.name}: the Lexicon Explorer counts the layers of the sky as the sky page sealed them`);
    for (const e of mine.entries) assert.equal(G.badgeView(there.lexicon, e.address, "navigator").word, KIT.LAYER_META.find((m) => m.id === e.layer).word, `${sky.name}: the row ${e.address} wears the badge of the layer it was sealed with`);
  }
  // the three lenses
  assert.deepEqual(KIT.LENSES.map((l) => l.id), LENSES, "the kit's three lenses");
  assert.deepEqual([Object.keys(P.LENS_HINTS), Object.keys(G.LENS_HINTS)], [LENSES, LENSES], "both pages give a hint for each of them");
  for (const model of [P, G]) assert.equal(model.LENS_HINTS.stargazer, "ages 6 and up", "and the same hint for the Stargazer");
});

test("The four receivers of the Send station are the CROSSROADS of the Overwatch core, a sky opened from the sky page is sent to them, and First Explorers takes its receivers from the same list", async () => {
  assert.deepEqual(G.RECEIVERS.map((r) => ({ ...r })), OW.CROSSROADS.map((c) => ({ id: c.id, city: c.city })), "the receivers are the crossroads, in order");
  assert.equal(OW.CROSSROADS.length, 4, "four of them");
  assert.deepEqual([...G.COPY_FACTS.roads], OW.CROSSROADS.map((c) => c.bearing), "and the four roads of the copy are their bearings");
  const bearings = OW.CROSSROADS.map((c) => c.bearing + "°");
  assert.ok(read("STRIX_OVERWATCH.md").replace(/\s+/g, " ").includes("(" + bearings.join(", ") + "; north is +y)"), `STRIX_OVERWATCH.md gives the four bearings the core holds: ${bearings.join(", ")}`);
  assert.ok(sentencesOf(G).some((x) => x.layer === "checked" && x.text.includes("four roads run at " + bearings.slice(0, -1).join(", ") + " and " + bearings.at(-1))), "and the Send station states the same four");
  for (const id of G.NOISY_ROAD) assert.ok(OW.CROSSROADS.some((c) => c.id === id), `the noisy road ${id} leads to a crossroads`);
  const cities = OW.CROSSROADS.map((c) => c.city);
  assert.deepEqual(cities, ["Antioch", "Alexandria", "Athens", "Rome"], "they are the four crossroads of First Explorers (SPEC 8.2, station 6)");
  const named = cities.slice(0, -1).join(", ") + " and " + cities.at(-1);
  assert.ok(read(WING + "First_Explorers/index.html").includes(named + " stand for"), `First Explorers' own dialog names them: ${named}`);
  assert.ok(read("STRIX_OVERWATCH.md").replace(/\s+/g, " ").includes("receivers (" + named + ", as in First Explorers)"), `and so does STRIX_OVERWATCH.md where it describes the Send station`);
  assert.ok(G.stationView("send", "navigator").say.some((s) => s.text.includes("the four crossroads receivers of First Explorers: " + named + ".")), `the Send station names them: ${named}`);
  // First Explorers (a DOM module: read as text) draws its receiver buttons from the same list
  const firstExplorers = read(WING + "First_Explorers/first-explorers.js");
  assert.match(firstExplorers, /^import \* as OW from "\.\.\/\.\.\/\.\.\/scripts\/strix-overwatch\.js";$/m, "First Explorers imports the Overwatch core");
  assert.match(firstExplorers, /"Receiver"[^\n]*OW\.CROSSROADS\.map\(/, "and makes one receiver button for each of OW.CROSSROADS");
  // the flow the sky page points to: seal a sky, open it in the Lexicon Explorer, let the receivers answer
  const sky = SKIES[1], { state: there, seal: theirs } = await openedInLexiconExplorer(sky);
  assert.ok(G.visibleStations(sky.lens, there.lexicon.origin).some((s) => s.key === "send"), "a sky opened at the Navigator lens has the Send station");
  const receivers = await G.makeReceivers();
  assert.deepEqual(receivers.map((r) => [r.id, r.city]), OW.CROSSROADS.map((c) => [c.id, c.city]), "one receiver for each crossroads");
  assert.equal(distinct(receivers.map((r) => r.sealId).concat(theirs.certificate.sealId)), 5, "each with a key of its own, none the sealer's");
  const sent = await G.sendToReceivers(theirs, receivers, { at: AT_LATER });
  assert.deepEqual(sent.rows.map((r) => [r.id, r.accepted, r.counted]), OW.CROSSROADS.map((c) => [c.id, true, true]), "all four accept the sky and are counted");
  assert.deepEqual([sent.k, sent.of, sent.marks.map((m) => m.met)], [4, 4, [true, true]], "4 of 4: both marks are met");
  assert.ok(sent.sentence.startsWith("4 of the four receivers accepted."), "and the station says so");
  const noisy = await G.sendToReceivers(theirs, receivers, { at: AT_LATER, noise: true });
  assert.deepEqual(noisy.rows.map((r) => [r.id, r.accepted]), OW.CROSSROADS.map((c) => [c.id, !G.NOISY_ROAD.includes(c.id)]), "with noise on the shared road, its two receivers refuse");
  assert.deepEqual([noisy.k, noisy.marks.map((m) => m.met)], [2, [true, false]], "2 of 4: the mark of two is met, the mark of three is not");
  // the sky page's own seal object is the same kind of thing: the receivers accept the package it downloads
  const direct = await G.sendToReceivers(await sealedOnSkyPage(sky), receivers, { at: AT_LATER });
  assert.equal(direct.k, 4, "the package sealed on the sky page itself is accepted by all four");
});

// What the sky page's Seal step says about receivers must be true of the page its button opens. The button carries the
// lens. Where the sentence names a reading level ("the Navigator level shows pretend receivers checking it too", said
// at Stargazer), the receivers must be at that level; where it names none, they must be at the lens the link carries.
// (The Stargazer sentence once named no level, and the Lexicon Explorer shows a sky no Send station at Stargazer.)
test("What the sky page says the Lexicon Explorer will do with a sealed sky, the Lexicon Explorer does: at the level the sentence names, or else at the lens the link carries", async () => {
  const levels = new Map(KIT.LENSES.map((l) => [l.label, l.id]));
  assert.deepEqual([...levels], [["Stargazer", "stargazer"], ["Navigator", "navigator"], ["Holographer", "holographer"]], "the three levels, as the kit names them");
  let promises = 0;
  for (const lens of LENSES) {
    const promise = P.SEAL_COPY.witness[lens].text;
    assert.match(promise, /Lexicon Explorer/, `${lens}: the sentence sends the visitor on to the Lexicon Explorer`);
    if (!/receivers/.test(promise)) continue;
    promises += 1;
    const there = G.initialState(fragment(P.lexiconSkyHref(P.setLens(SKIES[1].state(), lens))));
    assert.deepEqual([there.lens, there.lexicon.origin, there.notes], [lens, "page", []], `${lens}: the link carries the lens and opens the sky`);
    const named = [...levels.keys()].filter((label) => new RegExp("\\bthe " + label + " level\\b").test(promise));
    assert.ok(named.length <= 1, `${lens}: the sentence names at most one level`);
    const at = named.length ? levels.get(named[0]) : there.lens;
    const stations = G.visibleStations(at, there.lexicon.origin).map((s) => s.key);
    assert.ok(stations.includes("send"), `${lens}: the sky page says ${JSON.stringify(promise)} but the Lexicon Explorer shows a sky, at the ${at} level, only the stations ${stations.join(", ")}`);
    // a level the sentence names is one the visitor is not at, and the Lexicon Explorer lets the visitor change to it
    if (named.length) {
      assert.notEqual(at, lens, `${lens}: the sentence names another level than the one it is read at`);
      assert.ok(!G.visibleStations(lens, there.lexicon.origin).some((s) => s.key === "send"), `${lens}: at its own level the sky has no Send station, which is why the sentence names another`);
      const switched = G.applyHash(there, "#sky=" + [there.sky.jd, there.sky.lat, there.sky.lon].join(",") + "&lens=" + at);
      assert.deepEqual([switched.lens, { ...switched.sky }], [at, { ...there.sky }], `${lens}: the same sky can be read at the ${at} level`);
    }
    assert.ok(G.stationView("send", at, there.lexicon), `${lens}: the Send station of the ${at} level opens for a sky`);
  }
  assert.equal(promises, LENSES.length, "at every lens the Seal step speaks of the receivers");
  // and what is promised happens there: the receivers answer for this sky
  const { seal } = await openedInLexiconExplorer(SKIES[1]);
  const sent = await G.sendToReceivers(seal, await G.makeReceivers(), { at: AT_LATER });
  assert.deepEqual([sent.k, sent.of], [G.RECEIVERS.length, G.RECEIVERS.length], "all the receivers check the sealed sky and accept it");
});

test("A number stated on both pages is the same number on both: the rows of a sky, the bearing of the Kebar, the walk on the curved map, the corner of five squares, the Moon of the fifth day", async () => {
  const sayings = (model, layer) => sentencesOf(model).filter((s) => s.layer === layer).map((s) => s.text);
  const rowsSaying = (pattern) => G.EZEKIEL.entries.filter((e) => e.layer === "checked" && pattern.test(e.text));
  // the rows and epochs of a sealed sky
  const kebar = await sealedOnSkyPage(SKIES[1]), { state: there } = await openedInLexiconExplorer(SKIES[1]);
  assert.deepEqual([P.COPY_FACTS.seal.rows, P.COPY_FACTS.seal.epochs], [there.lexicon.entries.length, G.epochRows(there.lexicon).length], "the sky page's copy states the rows and epochs the Lexicon Explorer shows for that sky");
  assert.deepEqual([kebar.entries.length, kebar.bundle.lineage.length], [P.COPY_FACTS.seal.rows, P.COPY_FACTS.seal.epochs], "and they are what the seal holds");
  assert.deepEqual(G.epochRows(there.lexicon).map((r) => r.name), kebar.rows.filter((r) => !r[0].includes(".")).map((r) => r[3]), "the Lexicon Explorer names the epochs after the sky's top-level rows");
  // the Kebar from Nazareth: computed once here, stated by both pages in a CHECKED sentence
  const nazareth = K.SITES.find((s) => s.key === "nazareth"), site = K.SITES.find((s) => s.key === "kebar");
  const east = K.bearingAndDistance(nazareth.lat, nazareth.lonEast, site.lat, site.lonEast);
  assert.deepEqual([P.COPY_FACTS.kebar.bearing, P.COPY_FACTS.kebar.km], [G.COPY_FACTS.kebar.bearing, G.COPY_FACTS.kebar.km], "both copies hold the same bearing and distance");
  assert.deepEqual([G.COPY_FACTS.kebar.bearing, G.COPY_FACTS.kebar.km], [Math.round(east.bearing), Math.round(east.km)], "and they are the core's, to the degree and the kilometre");
  // Both pages say it in one sentence, hedged because the position of Nippur is approximate. Its three numbers are
  // the computed ones after rounding: half a degree of latitude, minutes to the nearest 5, kilometres to the nearest 10.
  const shared = G.KEBAR_NAZARETH.text, apart = Math.abs(site.lat - nazareth.lat), minutes = Math.abs(site.lonEast - nazareth.lonEast) * 4;
  const said = /^Computed from approximate positions: the Kebar site \(Nippur\) and Nazareth lie about half a degree apart in latitude, so almost the same stars pass overhead at both, about (\d+) minutes apart\. From Nazareth the site lies roughly due east, about (\d+) km\.$/.exec(shared);
  assert.ok(said, `the shared sentence has the form this test reads its numbers from: ${JSON.stringify(shared)}`);
  assert.ok(apart > 0.45 && apart < 0.65, `"about half a degree": the two latitudes are ${apart.toFixed(2)}° apart`);
  assert.equal(Number(said[1]), Math.round(minutes / 5) * 5, `"about ${said[1]} minutes": the two longitudes are ${minutes.toFixed(1)} minutes of time apart`);
  assert.equal(Number(said[2]), Math.round(east.km / 10) * 10, `"about ${said[2]} km": the core gives ${east.km.toFixed(1)} km`);
  assert.ok(Math.abs(east.bearing - 90) < 5, `"roughly due east": the core gives a bearing of ${east.bearing.toFixed(1)}°`);
  assert.equal(G.KEBAR_NAZARETH.layer, "checked", "the sentence is CHECKED");
  for (const [page, model] of [["the sky page", P], ["the Lexicon Explorer", G]]) assert.ok(sayings(model, "checked").some((t) => t.startsWith(shared)), `${page} states the shared sentence about the Kebar and Nazareth in a CHECKED sentence`);
  for (const [page, model] of [["the sky page", P], ["the Lexicon Explorer", G]]) for (const t of sayings(model, "checked")) assert.ok(!/bearing \d+°, \d+ km|due east: /.test(t), `${page}: no CHECKED sentence gives the Kebar an exact bearing and distance: ${JSON.stringify(t.slice(0, 80))}`);
  assert.ok(!OW.CROSSROADS.some((c) => Math.abs(c.bearing - east.bearing) < 45), "and none of First Explorers' four roads runs that way, as the Send station says");
  // forward, left, back, right by 1 on the curved map: the gap and the turn
  const home = H.homecoming(H.slidePath([0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle) => ({ angle, dist: 1 }))).at(-1));
  const gap = home.distance, turn = home.turnClockwise * 180 / Math.PI;
  const walk = P.labFour(P.labStart());
  assert.ok(Math.abs(P.labReadout(walk, "navigator").distance - gap) < 1e-12 && Math.abs(P.labReadout(P.labHome(walk), "navigator").turnDeg - turn) < 1e-9, "the sky page's lab walks that walk");
  assert.ok(sayings(P, "checked").some((t) => t.includes(`ends ${gap.toFixed(2)} from home`) && t.includes(`turned ${turn.toFixed(0)}° to the right`)), `the sky page states ${gap.toFixed(2)} and ${turn.toFixed(0)}°`);
  const curved = rowsSaying(/from home/);
  assert.ok(curved.length >= 2, "the lexicon states the walk in at least two CHECKED rows");
  for (const e of curved) assert.ok(e.text.includes(`ends ${gap.toFixed(3)} from home`) && e.text.includes(`turned ${turn.toFixed(1)}° clockwise`), `the lexicon row ${e.address} states ${gap.toFixed(3)} and ${turn.toFixed(1)}°`);
  assert.equal(Number(gap.toFixed(3)).toFixed(2), gap.toFixed(2), "the two roundings are of one number");
  // five squares at a corner of the {4,5} tiling
  const tiling = H.tilingConstants(4, 5);
  assert.deepEqual([P.COPY_FACTS.tile.meet, G.cornersFigure().curved.meet], [tiling.q, tiling.q], "both pages take the corner from the tiling: five squares");
  assert.ok(P.LAB_COPY.tileNote.text.includes("five squares meet") && G.cornersFigure().curved.sentence.includes("five squares meet") && rowsSaying(/five squares meet/).length >= 1, "and the sky page, the Lexicon Explorer and the lexicon say five in words");
  assert.equal(G.cornersFigure().curved.angle, P.COPY_FACTS.tile.turnDeg, "the corner angle of that tiling is the turn of the walk round one tile");
  // the Moon of the fifth day: the sky page's numbers stand in the lexicon's row under the date term
  const moon = G.EZEKIEL.entries.find((e) => OW.parentOf(e.address) === LEX.HANDLES.dateTerm && e.layer === "checked" && e.kind === "sky");
  const [first, second] = P.COPY_FACTS.moon;
  assert.ok(moon.text.includes(`from ${first.begins} % to ${first.ends} % lit`), `the lexicon row ${moon.address} states the Moon of ${first.label} as the sky page computes it (${first.begins} to ${first.ends} %)`);
  assert.ok(moon.text.includes(second.label) && moon.text.includes(`it ended ${second.ends} % lit`), `and the Moon of ${second.label} (${second.ends} %)`);
  assert.ok(sayings(P, "checked").some((t) => t.includes(`from ${first.begins} % lit`) && t.includes(`to ${first.ends} %`) && t.includes(`to ${second.ends} %`)), "the sky page states the same percentages");
  const preset = K.skyState(P.EZEKIEL_PRESET.jdUt, site.lat, site.lonEast);
  assert.equal(Math.round(100 * preset.phase.illuminatedFraction), first.ends, "and the preset's own sky shows the last of them");
  // the kit's constants both pages draw with
  assert.equal(P.VIEW.flightMs, KIT.FLIGHT_MS, "a flight on the sky page lasts as long as the kit allows");
  assert.deepEqual([P.VIEW.rimCut, P.VIEW.nudge], [G.RIM_CUT, G.NUDGE_STEP], "both charts cut the rim and nudge the view by the same amounts");
});

test("The sentences both pages share are the same sentences: what a seal certifies, how a pass is worded, the bridge box, the dialog's opening and First Explorers' three levels", () => {
  assert.deepEqual(P.CERTIFIED.map((s) => ({ ...s })), G.CERTIFIED.slice(0, P.CERTIFIED.length).map((s) => ({ ...s })), "Certified and Not certified read the same on both pages");
  assert.ok(G.CERTIFIED_TEXT.startsWith(P.CERTIFIED.map((s) => s.text).join(" ")), "and the Lexicon Explorer's last station begins with them");
  assert.ok(P.stepView("seal", "navigator").bridge.stands.some((x) => x.layer === "checked" && x.text === P.CERTIFIED.map((s) => s.text).join(" ")), "the sky page's Seal step shows them");
  assert.deepEqual({ ...P.CERTIFIED_STARGAZER }, { ...G.CERTIFIED_STARGAZER }, "the Stargazer form is the same");
  assert.deepEqual({ ...P.SEAL_COPY.pass }, { ...G.PASS_WORDING }, "a pass is worded the same way at every lens");
  for (const lens of LENSES) assert.notEqual(P.SEAL_COPY.pass[lens].toLowerCase(), "all checks pass", `${lens}: never "all checks pass" alone`);
  assert.equal(P.BRIDGE_TITLE, G.BRIDGE_TITLE, "the bridge box has one title");
  assert.deepEqual({ ...P.BRIDGE_PARTS }, { ...G.BRIDGE_PARTS }, "and the same two parts");
  for (const lens of LENSES) for (const opening of [P.BRIDGE_OPENING[lens].text, G.BRIDGE_OPENING[lens].text]) {
    assert.ok(/First Explorers/.test(opening) && /John 3:16/.test(opening) && /no check depends on it/.test(opening) && /the word bridge is not in the King James Bible/i.test(opening), `${lens}: both first gold boxes name First Explorers and John 3:16 and carry the disclaimer`);
  }
  assert.deepEqual([P.DIALOG.title, { ...P.DIALOG.first }], [G.DIALOG.title, { ...G.DIALOG.first }], "both dialogs have the same title and the same first sentence");
  for (const lens of LENSES) for (const p of [{ epoch: 1, epochs: 4 }, { epoch: 14, epochs: 14 }]) assert.equal(P.epochLine(p, lens), G.epochLine(p, lens), `${lens}: the progress line of a growing chain reads the same`);
  for (const id of ["BC-" + "0".repeat(24), "BC-xyz", "", null, 7]) assert.equal(P.packageFileName(id), G.packageFileName(id), `both pages name the package of ${JSON.stringify(id)} the same way`);
  // the three levels: both dialogs say what First Explorers calls them, and First Explorers does call them that
  const levels = /the same three levels First Explorers calls (\w+), (\w+) and (\w+)\./;
  const firstExplorers = read(WING + "First_Explorers/index.html");
  const buttons = [...firstExplorers.matchAll(/<button data-lens="\d"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]);
  assert.equal(buttons.length, 3, "First Explorers has three level buttons");
  for (const [page, model] of [["the sky page", P], ["the Lexicon Explorer", G]]) {
    const said = stringsOf(model.DIALOG).map((t) => levels.exec(t)).filter(Boolean);
    assert.equal(said.length, 1, `${page}: the dialog says once what First Explorers calls the three levels`);
    assert.deepEqual(said[0].slice(1), buttons, `${page}: and names them as First Explorers' buttons do`);
  }
  assert.equal(buttons[0], KIT.LENSES[0].label, "the first level has the same name on all three pages");
});

test("The link keys each document lists are the keys the page reads", () => {
  // CELESTIAL_CONTROL_PANEL.md, section "The link grammar": a table whose first column holds the keys in backticks
  const sky = read("CELESTIAL_CONTROL_PANEL.md");
  const start = sky.indexOf("\n## The link grammar\n");
  assert.ok(start >= 0, "CELESTIAL_CONTROL_PANEL.md has the section The link grammar");
  const section = sky.slice(start + 1, sky.indexOf("\n## ", start + 1));
  const rows = section.split("\n").filter((l) => /^\| `/.test(l));
  const listed = rows.flatMap((l) => [...l.split("|")[1].matchAll(/`([a-z]+)`/g)].map((m) => m[1]));
  assert.deepEqual([...listed].sort(), grammarKeys(P.HASH_GRAMMAR).sort(), "its table lists exactly the keys of the sky page's grammar");
  assert.ok(section.replace(/\s+/g, " ").includes(`"${P.IGNORED_NOTE}"`), "and quotes the line the page says when a value is ignored");
  for (const written of ["`#sky=JD,LAT,LON`", "`#entry=ADDRESS`"]) assert.ok(section.includes(written), `it names the link ${written} that the page writes to the Lexicon Explorer`);
  // STRIX_OVERWATCH.md: the table of the Lexicon Explorer's three links, and the two it writes to the sky page
  const strix = read("STRIX_OVERWATCH.md");
  const table = strix.split("\n").filter((l) => /^\| `#[a-z]+=/.test(l)).map((l) => /^\| `#([a-z]+)=/.exec(l)[1]);
  assert.deepEqual([...table].sort(), grammarKeys(G.HASH_GRAMMAR).sort(), "STRIX_OVERWATCH.md lists exactly the keys of the Lexicon Explorer's grammar");
  for (const what of ["date", "lab"]) {
    const written = fragment(G.skyPageHref(what, "navigator")).replace("&lens=navigator", "");
    assert.ok(strix.includes("`" + written + "`"), `STRIX_OVERWATCH.md names the link ${written} that the page writes to the sky page`);
  }
  const place = fragment(G.skyPageHref("sky", "navigator", { jd: "JD", lat: "LAT", lon: "LON" }));
  assert.equal(place, "#lens=navigator", "(letters are not a place: the model writes numbers only)");
  const keys = grammarKeys(G.SKY_PAGE_GRAMMAR).filter((key) => !["preset", "lab", "lens"].includes(key));
  assert.ok(strix.includes("`#" + keys.map((key) => key + "=" + key.toUpperCase()).join("&") + "`"), `STRIX_OVERWATCH.md names the link #${keys.map((key) => key + "=" + key.toUpperCase()).join("&")} that the page writes from a sky to the sky page`);
  // the sky page's document says where the preset lands and what a focus link cannot open
  const row = (key) => rows.find((l) => l.split("|")[1].includes("`" + key + "`")) || "";
  assert.match(row("preset"), /opens at step 2\b/, "CELESTIAL_CONTROL_PANEL.md says the preset opens at step 2");
  assert.equal(P.initialState({ hash: "#preset=ezekiel" }).step, 2, "and it does");
  for (const words of ["depth rings", "galactic centre", "north galactic pole", "opposite point", "shadow transform", "no place"]) assert.ok(row("focus").includes(words), `CELESTIAL_CONTROL_PANEL.md says a focus link is ignored for: ${words}`);
});
