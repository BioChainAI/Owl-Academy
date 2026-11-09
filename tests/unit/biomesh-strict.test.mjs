// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// The strict verifier of scripts/biomesh-core.js (RFC 07 section 12, in BioChainAI/SHD-CCP-core) and what it relies
// on. Run from the repository root:
//   node --test tests/unit/biomesh-strict.test.mjs
//
// - sha256HexSync (FIPS 180-4 in plain JS) equals Web Crypto SHA-256 on the FIPS 180-4 examples, on every length
//   0..300, on non-ASCII text, and on every leaf of the RFC 07 record vectors (tests/vendor/shdccp2-contract/).
// - engramGrid builds each letter's grid once (F15) and gives the same grid as its 7f45f35 text on 10,000 seeded
//   tokens (the 7f45f35 text is checked against the fixture's SHA-256).
// - parseBiochainStreamStrict reads the frames of RFC 07 section 4.3 in hex digits of either case (the strict verifier
//   reports the case at canonical or crystal) and nothing else. parseBiochainStream, the lax parser,
//   throws on a negative residual length (with a length of -12 or less its 7f45f35 text never returned:
//   shdccp2_tamper/length_negative) and gives what its 7f45f35 text gives on every other stream (the tamper vectors'
//   streams and 3,000 fuzzed ones).
// - verifyIntegrityStrict accepts every honest record (the record vectors, among them 0x80 crystal bytes and a leading
//   U+FEFF) and rejects each tamper case of tests/unit/support/tamper.mjs at its expected first failing check; it is
//   synchronous and uses the hash it is given. Ill-formed UTF-8 fails at the first check its change leaves wrong
//   (crystal, leaves or weaves), and at derived when every other field comes from the same bytes (RFC 07 section 17,
//   option (a)). verifyIntegrity, the self-consistency check, keeps its text: it still accepts T1, T2, T8 and T9.
// - KINDS and validateKind. publishBiochain refuses a record that fails the strict check, an unknown kind and a bad
//   crystCost before it signs or writes anything (biomesh.js imported with the Firebase SDK stubbed); STRICT_ENFORCE
//   is false and biomesh.js's extendBiochain passes it to the core's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sha256 } from "./support/declarations.mjs";
import { stubFirebase } from "./support/firebase-stub.mjs";
import { flipPacketBit, refixParity, tamperCases } from "./support/tamper.mjs";

const ROOT = resolve(process.env.OWL_TEST_ROOT || fileURLToPath(new URL("../..", import.meta.url)));
const C = await import(pathToFileURL(join(ROOT, "scripts/biomesh-core.js")).href);
const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/biomesh-7f45f35.json", import.meta.url), "utf8"));
const SUITES = join(ROOT, "tests/vendor/shdccp2-contract/suites");
const RECORDS = JSON.parse(readFileSync(join(SUITES, "shdccp2_record.json"), "utf8"));
const webSha = async (s) => Buffer.from(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)))).toString("hex");

/** The text of a record vector: `text`, or the concatenation of `text_parts` (strings and {repeat, length}). */
export const vectorText = (input) => ("text" in input ? input.text
  : input.text_parts.map((p) => (typeof p === "string" ? p : p.repeat.repeat(Math.ceil(p.length / p.repeat.length)).slice(0, p.length))).join(""));
/** The record of a vector, grown again when the vector gives a long field by its SHA-256 (checked against it). */
async function vectorRecord(c) {
  const e = c.expect;
  if (!("stream_sha256" in e) && !("engramStream_sha256" in e)) return { ...e };
  const rec = await C.growBiochain(vectorText(c.input), { engrams: c.input.engrams });
  for (const f of ["stream", "engramStream"]) {
    if (`${f}_sha256` in e) { assert.equal(sha256(rec[f]), e[`${f}_sha256`], `${c.id}: ${f}`); assert.equal(rec[f].length, e[`${f}_length`]); }
    else if (f in e) assert.equal(rec[f], e[f], `${c.id}: ${f}`);
  }
  for (const [k, v] of Object.entries(e)) if (!/_(sha256|length)$/.test(k)) assert.deepEqual(rec[k], v, `${c.id}: ${k}`);
  return rec;
}
const honestVectors = RECORDS.cases.filter((c) => !("error" in c.expect));

// ---------------------------------------------------------------- sha256HexSync

test("sha256HexSync: the FIPS 180-4 examples, and Web Crypto on the same messages", async () => {
  const fips = [
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
    ["abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
      "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1"],
    ["a".repeat(1000000), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"],
  ];
  for (const [msg, want] of fips) {
    assert.equal(C.sha256HexSync(msg), want, `FIPS 180-4, ${msg.length} bytes`);
    assert.equal(await webSha(msg), want);
  }
});

test("sha256HexSync equals Web Crypto on every length 0..300 and on non-ASCII text", async () => {
  let x = 0x9e3779b9;
  const next = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; };
  for (let n = 0; n <= 300; n++) {
    const s = String.fromCharCode(...Array.from({ length: n }, () => next() & 0xff));   // Latin-1, as leaves hash
    assert.equal(C.sha256HexSync(s), await webSha(s), `length ${n}`);
  }
  for (const s of ["café", "中文", "\u{1F989} owl", "﻿GEODESIC", "a\uD800b", "Straße", 42, null]) {
    assert.equal(C.sha256HexSync(s), await webSha(s), JSON.stringify(s));
  }
});

test("sha256HexSync equals Web Crypto on every leaf of the record vectors, and gives their leafHashes and root", async () => {
  let leaves = 0;
  for (const c of honestVectors) {
    const bytes = [...new TextEncoder().encode(vectorText(c.input))];
    const got = [];
    for (let i = 0, at = 0; at < bytes.length; i++, at += 720) {
      const chunk = bytes.slice(at, at + 720), latin1 = String.fromCharCode(...chunk);
      assert.equal(C.sha256HexSync(latin1), await webSha(latin1), `${c.id}: chunk ${i}`);
      const leaf = C.leafHashSync(i, chunk);
      assert.equal(leaf, await webSha(i + "|" + await webSha(latin1)), `${c.id}: leaf ${i}`);
      got.push(leaf);
    }
    assert.deepEqual(got, c.expect.leafHashes, `${c.id}: leafHashes`);
    assert.equal(C.merkleRootSync(got), c.expect.merkleRoot, `${c.id}: merkleRoot`);
    leaves += got.length;
  }
  assert.ok(leaves >= 100, `${leaves} leaves checked`);
});

// ---------------------------------------------------------------- the engramGrid hoist (F15)

const OLD = {   // the 7f45f35 texts, checked against tests/unit/fixtures/biomesh-7f45f35.json
  mulberry32: "function mulberry32(seed) {\n  return function () {\n    seed |= 0; seed = seed + 0x6D2B79F5 | 0;\n    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);\n    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;\n    return ((t ^ t >>> 14) >>> 0) / 4294967296;\n  };\n}",
  engramCharGrid: "function engramCharGrid(ch) {\n  let seed = 0;\n  for (let i = 0; i < ch.length; i++) seed = (seed * 31 + ch.charCodeAt(i)) & 0xffffffff;\n  const rng = mulberry32(seed);\n  return Array.from({ length: 64 }, () => rng() > 0.5 ? 1 : 0);\n}",
  engramGrid: "function engramGrid(token) {\n  let acc = new Array(64).fill(0);\n  for (const ch of token.toUpperCase()) {\n    if (!/[A-Z]/.test(ch)) continue;\n    acc = acc.map((b, i) => b ^ engramCharGrid(ch)[i]);\n  }\n  return acc;\n}",
};

test("engramGrid gives the same grid as its 7f45f35 text on 10,000 seeded tokens", () => {
  for (const [n, text] of Object.entries(OLD)) assert.equal(sha256(text), FIXTURE.declarations[n].sha256, `${n}: the 7f45f35 text`);
  const oldGrid = new Function(`"use strict";\n${OLD.mulberry32}\n${OLD.engramCharGrid}\nreturn ${OLD.engramGrid};`)();
  const alphabet = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'ßéÿΩЖ中\u{1F989}ﬀ- ");
  let x = 20261108;
  const next = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x; };
  const seen = new Set();
  for (let k = 0; k < 10000; k++) {
    const len = 1 + (next() % 24);
    const token = Array.from({ length: len }, () => alphabet[next() % alphabet.length]).join("");
    const want = oldGrid(token), got = C.engramGrid(token);
    assert.deepEqual(got, want, `token ${JSON.stringify(token)}`);
    seen.add(C.engramHex(token));
  }
  assert.ok(seen.size > 9000, "the tokens are varied");
  assert.equal(C.engramHex("GEODESIC"), "5C896A4801C9C24C");
});

// ---------------------------------------------------------------- the strict parser

test("parseBiochainStreamStrict reads RFC 07 section 4.3's frames in hex digits of either case, and nothing else", async () => {
  const rec = await C.growBiochain("The owl reads the tome. ".repeat(40), { engrams: false });
  const frames = C.parseBiochainStreamStrict(rec.stream);
  assert.deepEqual(frames.map((f) => f.packet + f.residualBytes.toString(16).padStart(8, "0") + f.residual).join(""), rec.stream);
  assert.deepEqual(frames.map((f) => f.chunkLen), [720, 240]);
  assert.ok(frames.every((f) => f.parityOk && f.form === 9));
  for (const [bad, why] of [
    ["", /no frame/], [rec.stream + "0", /truncated frame header/], [rec.stream.slice(0, -2), /shorter than its length/],
    [rec.stream.slice(0, 15) + "G" + rec.stream.slice(16), /16 hex digits/],
    [rec.stream.slice(0, 16) + " 0000" + rec.stream.slice(21), /8 hex digits/],
    [rec.stream.slice(0, 24) + "Z" + rec.stream.slice(25), /not hex/],
  ]) assert.throws(() => C.parseBiochainStreamStrict(bad), why);
  assert.throws(() => C.parseBiochainStreamStrict(null), /not a string/);
  // Hex digits of either case parse to the same frames (RFC 07 section 17, option (a)); the strict verifier then reports
  // a packet not in upper case at crystal, and a residual or a length not in lower case at canonical.
  const at = 24 + 2 * frames[0].residualBytes, head = rec.stream.slice(0, at), { packet, residual } = frames[1];
  const len = rec.stream.slice(at + 16, at + 24);
  assert.ok(/[A-F]/.test(packet) && /[a-f]/.test(len) && /[a-f]/.test(residual), "the last frame has hex letters to change");
  for (const [stream, failed] of [[head + packet.toLowerCase() + len + residual, "crystal"],
    [head + packet + len.toUpperCase() + residual, "canonical"], [head + packet + len + residual.toUpperCase(), "canonical"]]) {
    const got = C.parseBiochainStreamStrict(stream);
    assert.deepEqual(got.map(({ packet, residual, ...f }) => f), frames.map(({ packet, residual, ...f }) => f));
    assert.equal(C.verifyIntegrityStrict({ ...rec, stream }).failed, failed);
  }
});

// ---------------------------------------------------------------- the lax parser

// parseBiochainStream's text at 7f45f35, checked against tests/unit/fixtures/biomesh-7f45f35.json
const OLD_PARSE = "function parseBiochainStream(streamHex) {\n  const frames = []; let p = 0;\n  while (p < streamHex.length) {\n    const packet = streamHex.slice(p, p + 16); p += 16;\n    const rbytes = parseInt(streamHex.slice(p, p + 8), 16); p += 8;\n    if (!Number.isFinite(rbytes)) throw new Error(\"malformed stream frame\");\n    const residual = streamHex.slice(p, p + rbytes * 2); p += rbytes * 2;\n    frames.push({ packet, residual, ...unpackPacket(packet) });\n  }\n  return frames;\n}";

/** Streams with frames in many forms, none with a negative residual length: packets of either case, lengths as
 *  lower- or upper-case hex, with a 0x or + prefix, leading spaces, a trailing non-hex digit or no digit at all,
 *  residuals shorter or longer than their length, and cuts at any point. */
function fuzzStreams(count, seed) {
  let x = seed >>> 0;
  const next = () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0);
  const pick = (chars) => chars[next() % chars.length];
  const run = (n, chars) => Array.from({ length: Math.max(0, n) }, () => pick(chars)).join("");
  const LENGTHS = [(r) => r.toString(16).padStart(8, "0"), (r) => r.toString(16).toUpperCase().padStart(8, "0"),
    (r) => "0x" + r.toString(16).padStart(6, "0"), (r) => "+" + r.toString(16).padStart(7, "0"),
    (r) => "  " + r.toString(16).padStart(6, "0"), (r) => r.toString(16).padStart(7, "0") + "g", () => "zzzzzzzz"];
  const out = [];
  for (let k = 0; k < count; k++) {
    let s = "";
    for (let f = 1 + (next() % 4); f > 0; f--) {
      const r = next() % 40;
      s += run(16, "0123456789ABCDEFabcdef") + LENGTHS[next() % LENGTHS.length](r) + run(2 * r + (next() % 7) - 3, "0123456789abcdefABCG");
    }
    out.push(next() % 4 ? s : s.slice(0, next() % (s.length + 1)));
  }
  return out;
}

test("parseBiochainStream throws on a negative residual length and otherwise gives what its 7f45f35 text gives", async () => {
  assert.equal(sha256(OLD_PARSE), FIXTURE.declarations.parseBiochainStream.sha256, "the 7f45f35 text");
  const src = readFileSync(join(ROOT, "scripts/biomesh-core.js"), "utf8");
  const now = Function.prototype.toString.call(C.parseBiochainStream);
  assert.equal(src.split(now).length, 2, "the current text, once");
  assert.equal(now.replace(" || rbytes < 0", ""), OLD_PARSE, "the one change");
  // The same module with the 7f45f35 text of parseBiochainStream.
  const sealUrl = pathToFileURL(join(ROOT, "scripts/seal-crypto.js")).href;
  const oldSrc = src.replace(now, () => OLD_PARSE).replace('from "./seal-crypto.js"', () => `from ${JSON.stringify(sealUrl)}`);
  const Old = await import("data:text/javascript;base64," + Buffer.from(oldSrc).toString("base64"));
  const run = (f, s) => { try { return f(s); } catch (e) { return `throws: ${e.message}`; } };
  // The 7f45f35 text does not return on a length of -12 or less, so no stream given to it has a negative length.
  const tamper = ["shdccp2_tamper", "shdccp2_tamper_open"].flatMap((n) => JSON.parse(readFileSync(join(SUITES, `${n}.json`), "utf8")).cases);
  const vectorStreams = tamper.filter((c) => c.id !== "length_negative" && typeof c.input.record?.stream === "string").map((c) => c.input.record.stream);
  assert.ok(vectorStreams.length >= 70);
  const streams = [...vectorStreams, ...fuzzStreams(3000, 20261108)];
  assert.ok(streams.every((s) => !s.includes("-")));
  const outcomes = new Set();
  for (const s of streams) {
    const got = run(C.parseBiochainStream, s);
    assert.deepEqual(got, run(Old.parseBiochainStream, s), JSON.stringify(s.slice(0, 80)));
    outcomes.add(typeof got === "string" ? got : "frames");
  }
  for (const o of ["frames", "throws: malformed stream frame"]) assert.ok(outcomes.has(o), `the streams include one that gives ${o}`);
  // A negative length now throws, and verifyIntegrity, recreateText and extendBiochain return.
  const rec = await C.growBiochain("The owl reads the tome. ".repeat(40), { engrams: false });
  for (const len of ["-000000c", "-0000018", "-fffffff", "-0000001", " -00000c"]) {
    const bad = { ...rec, stream: rec.stream.slice(0, 16) + len + rec.stream.slice(24) };
    assert.throws(() => C.parseBiochainStream(bad.stream), /^Error: malformed stream frame$/, len);
    assert.deepEqual(await C.verifyIntegrity(bad), { ok: false, reasons: ["decode failure: malformed stream frame"] }, len);
    assert.throws(() => C.recreateText(bad), /malformed stream frame/, len);
    await assert.rejects(C.extendBiochain(bad, " more"), /Parent chain fails integrity: decode failure: malformed stream frame/, len);
    assert.equal(C.verifyIntegrityStrict(bad).failed, "parity", len);
  }
});

// ---------------------------------------------------------------- the strict verifier

test("verifyIntegrityStrict accepts every record vector, synchronously, with either hash", async () => {
  for (const c of honestVectors) {
    const rec = await vectorRecord(c);
    const v = C.verifyIntegrityStrict(rec);
    assert.equal(v instanceof Promise, false, "synchronous");
    assert.equal(v.ok, true, `${c.id}: failed at ${v.failed}: ${C.failedCheck(v)?.detail}`);
    assert.deepEqual(v.checks.map((x) => x.name), [...C.STRICT_CHECKS]);
    assert.equal(v.failed, null);
    assert.equal(v.legacy, false);
    assert.equal(C.strictLabel(v), "strict ok");
    const viaNode = C.verifyIntegrityStrict(rec, { sha256: (s) => sha256(String(s)) });
    assert.equal(viaNode.ok, true, `${c.id}: with node:crypto`);
    assert.equal((await C.verifyIntegrity(rec)).ok, true, `${c.id}: self-consistent`);
  }
  const ids = honestVectors.map((c) => c.id);
  for (const id of ["leading_bom", "x80_single_chunk", "x80_three_chunks", "split_4byte_at_720", "max_60000_repeat"]) assert.ok(ids.includes(id), id);
});

test("verifyIntegrityStrict uses the hash it is given", async () => {
  const rec = await C.growBiochain("GEODESIC", {});
  const v = C.verifyIntegrityStrict(rec, { sha256: () => "0".repeat(64) });
  assert.equal(v.failed, "leaves");
});

const TEXT = ("The owl keeps the tome by lamplight; café, naïve, 中文 and \u{1F989} share the shelf. Rain on the tower, " +
  "stars over the spire; the fox keeps the lantern. ").repeat(14);

test("each tamper case fails at its expected check; verifyIntegrity still accepts T1, T2, T8 and T9", async () => {
  const honest = await C.growBiochain(TEXT, { engrams: true });
  const honestNoEngrams = await C.growBiochain(TEXT, { engrams: false });
  const x80 = await vectorRecord(honestVectors.find((c) => c.id === "x80_three_chunks"));
  assert.equal(C.verifyIntegrityStrict(honest).ok, true);
  assert.equal(C.verifyIntegrityStrict(honestNoEngrams).ok, true);
  const cases = await tamperCases(C, { honest, honestNoEngrams, x80 });
  assert.ok(cases.length >= 45, `${cases.length} cases`);
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length, "case ids are unique");
  for (const name of C.STRICT_CHECKS) assert.ok(cases.some((c) => c.failed === name), `a case fails at ${name}`);
  for (const id of ["T1_no_leaves_no_root", "T2_crystal_changed", "T8_chainid_changed", "T9_escape_flip", "T9_padding_flip"])
    assert.ok(cases.some((c) => c.id === id), id);
  for (const c of cases) {
    const v = C.verifyIntegrityStrict(c.record);
    assert.equal(v.ok, false, `${c.id}: rejected`);
    assert.equal(v.failed, c.failed, `${c.id}: fails at ${c.failed}, not ${v.failed} (${C.failedCheck(v)?.detail})`);
    assert.equal(v.legacy, c.legacy, `${c.id}: legacy`);
    const at = C.STRICT_CHECKS.indexOf(c.failed);
    assert.equal(v.checks.length, c.legacy || c.record === null || Array.isArray(c.record) ? 1 : at + 1, `${c.id}: checks run`);
    assert.ok(v.checks.slice(0, -1).every((x) => x.ok), `${c.id}: the earlier checks pass`);
    assert.equal(C.failedCheck(v).name, c.failed);
    assert.equal(C.strictLabel(v), c.legacy ? "legacy" : `failed at ${c.failed}`);
    if (c.laxOk !== undefined) assert.equal((await C.verifyIntegrity(c.record)).ok, c.laxOk, `${c.id}: verifyIntegrity says ${!c.laxOk}`);
  }
  // the chainId is recomputed from the recomputed weave, so a changed weaveChiral alone leaves it reproducible
  const weave = C.verifyIntegrityStrict(cases.find((c) => c.id === "weavechiral_changed").record);
  assert.deepEqual(C.failedCheck(weave).fields, ["weaveChiral"]);
  assert.equal(C.strictLabel(C.verifyIntegrityStrict(cases.find((c) => c.id === "T2_crystal_changed").record), true),
    "self-consistent only, failed at crystal");
});

test("ill-formed UTF-8 fails at the first check its change leaves wrong, at derived when the rest is from the same bytes", async () => {
  // The record of "a" with its residual replaced by the canonical residual of the byte 0xE9 (not UTF-8 on its own),
  // then also its packet, then also its leaves and root, then also its weaves and chainId, each recomputed for that
  // byte. Well-formed UTF-8 is checked at the start of derived (RFC 07 section 17, option (a)), so the first three fail
  // at crystal, leaves and weaves, and the fourth, whose every other field comes from the byte (engrams off), at
  // derived: the first failing check that the Hyperbolic Lexicon's verifier names (shdccp2_tamper_open).
  const rec = await C.growBiochain("a", { engrams: true }), off = await C.growBiochain("a", { engrams: false });
  assert.equal(rec.stream, "98BE8213A300016100000002b080");
  const bad = [0xE9], residual = C.encodeChunk(bad), packet = C.crystallize(bad), leaves = [C.leafHashSync(0, bad)];
  const root = C.merkleRootSync(leaves), weaves = C.chainWeaves([bad]);
  assert.equal(residual, "f480");
  const variants = {
    residual: [{ ...rec, stream: rec.stream.slice(0, 24) + residual }, "crystal"],
    packet_and_residual: [{ ...rec, stream: C.frameStream([packet], [residual]) }, "leaves"],
    leaves_and_root_too: [{ ...rec, stream: C.frameStream([packet], [residual]), leafHashes: leaves, merkleRoot: root }, "weaves"],
    every_other_field: [{ ...off, stream: C.frameStream([packet], [residual]), leafHashes: leaves, merkleRoot: root, ...weaves,
      chainId: "BC-" + C.sha256HexSync(root + "|" + weaves.weaveChiral).slice(0, 24) }, "derived"],
  };
  for (const [id, [r, failed]] of Object.entries(variants)) {
    const v = C.verifyIntegrityStrict(r), at = C.STRICT_CHECKS.indexOf(failed);
    assert.equal(v.failed, failed, `${id}: ${C.failedCheck(v)?.detail}`);
    assert.deepEqual(v.checks.map((c) => c.ok), [...Array(at).fill(true), false], id);
    if (failed === "derived") assert.equal(C.failedCheck(v).detail, "the chunks are not well-formed UTF-8", id);
  }
});

// ---------------------------------------------------------------- kinds, publish, shadow mode

test("KINDS holds the seven kinds callers pass, and validateKind refuses anything else", () => {
  assert.deepEqual(Object.keys(C.KINDS), ["text", "language-session", "language-shard", "mindseye.lattice_seed",
    "mindseye.environment", "latticeforge.lattice_seed", "latticeforge.environment"]);
  assert.ok(Object.isFrozen(C.KINDS));
  for (const k of Object.keys(C.KINDS)) assert.equal(C.validateKind(k), k);
  for (const bad of ["", "TEXT", "mindseye", "__proto__", "toString", "constructor", null, undefined, 7, {}])
    assert.throws(() => C.validateKind(bad), /Unknown biochain kind/, String(bad));
});

test("publishBiochain checks the record, kind and crystCost before signing or writing; STRICT_ENFORCE is off", async () => {
  stubFirebase(ROOT);
  const BM = await import(pathToFileURL(join(ROOT, "scripts/biomesh.js")).href);
  assert.equal(BM.STRICT_ENFORCE, false);
  const honest = await C.growBiochain(TEXT, { engrams: true });
  const cases = await tamperCases(C, { honest, honestNoEngrams: await C.growBiochain(TEXT, { engrams: false }),
    x80: await vectorRecord(honestVectors.find((c) => c.id === "x80_three_chunks")) });
  const FIREBASE = /\(Firebase\) is not available in unit tests/;
  for (const id of ["T2_crystal_changed", "T1_no_leaves_no_root", "T8_chainid_changed", "T9_padding_flip", "legacy_streams"]) {
    const c = cases.find((x) => x.id === id);
    await assert.rejects(BM.publishBiochain("uid-A", "seal-1", c.record, {}), (e) => {
      assert.match(e.message, /^Not published: the record fails the strict check/);
      assert.doesNotMatch(e.message, FIREBASE);
      return true;
    }, id);
  }
  await assert.rejects(BM.publishBiochain("uid-A", "seal-1", honest, { kind: "bogus" }), /Unknown biochain kind/);
  for (const crystCost of [-1, "3", NaN, Infinity, null])
    await assert.rejects(BM.publishBiochain("uid-A", "seal-1", honest, { kind: "mindseye.environment", crystCost }), /crystCost/);
  // An honest record with a known kind gets past the checks to the first Firestore read (stubbed: it throws).
  for (const meta of [{}, { kind: "language-session" }, { kind: "mindseye.environment", crystCost: 12 }])
    await assert.rejects(BM.publishBiochain("uid-A", "seal-1", honest, meta), FIREBASE);
});

test("extendBiochain computes the parent's strict verdict and refuses on it only when asked", async () => {
  stubFirebase(ROOT);
  const BM = await import(pathToFileURL(join(ROOT, "scripts/biomesh.js")).href);
  const parent = await C.growBiochain(TEXT, { engrams: false });
  const frames = C.parseBiochainStreamStrict(parent.stream);
  frames[1].packet = refixParity(flipPacketBit(frames[1].packet, 30));            // T2
  const t2 = { ...parent, stream: C.frameStream(frames.map((f) => f.packet), frames.map((f) => f.residual)) };
  const ok = await BM.extendBiochain(parent, " More text.", { engrams: false });
  assert.equal(ok.parentStrict.ok, true);
  assert.ok(!Object.keys(ok).includes("parentStrict") && !JSON.stringify(ok).includes("parentStrict"), "not stored by publish");
  assert.equal(C.verifyIntegrityStrict(ok).ok, true, "the child passes");
  const shadow = await BM.extendBiochain(t2, " More text.", { engrams: false });   // STRICT_ENFORCE is false
  assert.equal(shadow.parentStrict.failed, "crystal");
  await assert.rejects(C.extendBiochain(t2, " More text.", { engrams: false, enforceStrict: true }), /Parent chain fails the strict check: failed at crystal/);
  await assert.rejects(BM.extendBiochain(t2, " More text.", { engrams: false, enforceStrict: true }).then(() => { throw new Error("resolved"); }),
    /resolved/, "biomesh.js passes its own STRICT_ENFORCE, not the caller's");
});
