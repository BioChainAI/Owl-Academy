// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// The RFC 07 contract vectors (BioChainAI/SHD-CCP-core contract_vectors/, CC0-1.0, vendored in
// tests/vendor/shdccp2-contract/ and pinned in tests/vendor/VENDOR.json) run against scripts/biomesh-core.js. All
// thirteen suites are normative upstream (two independent implementations agreed on every case); each case's expected
// value must come out of Owl's code bit for bit. Run from the repository root:
//   node --test tests/unit/contract-vectors.test.mjs
//
//   shdccp2_packet   crystallize(chunk): packet, crystal32, signed crystal codes, fields; never the kernel-normalised
//                    packet where that differs (0x80 crystal bytes stay raw, RFC 07 section 5.4)
//   shdccp2_chunk    encodeChunk, the frame, the leaf, and decodeChunk back
//   shdccp2_merkle   merkleRootSync
//   shdccp2_arith    Math.hypot (V8), qn, qmul, qconj, toFixed(12) through quatHex, toFixed(4) read back
//   shdccp2_weave    crystalQuat per chunk, every chiral and mirror step, chainWeaves; the chunks grown as a record
//                    (0x80 crystal bytes) pass the strict check
//   engram1          tokens, grids, J numerators, engram stream, count and mean J, mulberry32 draws
//   shdccp2_record   growBiochain, the two input errors, and verifyIntegrityStrict on every grown record
//   shdccp2_limits   encodeChunk at the coder's largest codes (code lengths read from RFC 07 section 6 here), and
//                    grown records of 1 to 60,000 bytes of a high-cost text, within the section 4.4 bound (informative)
//   merkle_rules_same_bytes   Owl's leaves and root (the shdccp2 rule) of each text; the BIOSEED/1 and RFC 6962 roots
//                    of the same chunks differ and fail the strict check at leaves
//   engram1_keys     engramHex / engramOf of a string: the letters after full Unicode upper-casing, the key
//   rng_mulberry32   mulberry32 draws; for the letter seeds, the draws above 2^31 are the letter's engram grid
//   shdccp2_tamper   verifyIntegrityStrict: ok and the first failing check for each value (honest records accepted,
//                    every altered value rejected at its expected check), with either hash; the legacy flag and the
//                    label (informative);
//                    and verifyIntegrity returns on every value (run in a worker with a memory limit and a time limit)
//                    with the self-consistency verdict the suite records
//   shdccp2_tamper_open   the same for hex digits in the wrong case and ill-formed UTF-8: every value is rejected at
//                    its expected check, the first failing check of RFC 07 section 17's option (a) (the Hyperbolic
//                    Lexicon's verifier, section 12.5's table)
//
// Not vendored: rfc6962_lists and attest1_profile; biomesh-core.js implements neither (tests/vendor/VENDOR.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { sha256 } from "./support/declarations.mjs";

const ROOT = resolve(process.env.OWL_TEST_ROOT || fileURLToPath(new URL("../..", import.meta.url)));
const CORE_URL = pathToFileURL(join(ROOT, "scripts/biomesh-core.js")).href;
const C = await import(CORE_URL);
const DIR = join(ROOT, "tests/vendor/shdccp2-contract/suites");
const suite = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf8"));
const NORMATIVE = ["engram1", "engram1_keys", "merkle_rules_same_bytes", "rng_mulberry32", "shdccp2_arith", "shdccp2_chunk",
  "shdccp2_limits", "shdccp2_merkle", "shdccp2_packet", "shdccp2_record", "shdccp2_tamper", "shdccp2_tamper_open", "shdccp2_weave"];
const SUITES = [...NORMATIVE].sort();

const bytesOf = (hex) => Array.from({ length: hex.length / 2 }, (_, i) => parseInt(hex.slice(2 * i, 2 * i + 2), 16));
/** IEEE-754 binary64 from / to 16 hex digits (big-endian bit pattern). */
const f64 = (hex) => { const v = new DataView(new ArrayBuffer(8)); v.setBigUint64(0, BigInt("0x" + hex)); return v.getFloat64(0); };
const hex64 = (x) => { const v = new DataView(new ArrayBuffer(8)); v.setFloat64(0, x); return v.getBigUint64(0).toString(16).padStart(16, "0"); };
const vectorText = (input) => ("text" in input ? input.text
  : input.text_parts.map((p) => (typeof p === "string" ? p : p.repeat.repeat(Math.ceil(p.length / p.repeat.length)).slice(0, p.length))).join(""));

test("the thirteen suites are vendored: all normative, RFC 07 shdccp/2, CC0", () => {
  assert.deepEqual(readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort(), SUITES);
  for (const name of SUITES) {
    const s = suite(name);
    assert.equal(s.suite, name);
    assert.equal(s.status, "normative", `${name}: ${s.status}`);
    assert.equal(s.rfc, "07");
    assert.equal(s.wire, "shdccp/2");
    assert.equal(s.license, "CC0-1.0");
    assert.ok(s.cases.length > 0);
  }
});

test("shdccp2_packet: crystallize gives every packet, with 0x80 crystal bytes raw", () => {
  let x80 = 0;
  for (const c of suite("shdccp2_packet").cases) {
    const chunk = bytesOf(c.input.chunk_hex), packet = C.crystallize(chunk), e = c.expect;
    assert.equal(packet, e.packet, c.id);
    assert.equal(packet.slice(2, 10), e.crystal32, `${c.id}: crystal32 is bits 55..24`);
    assert.deepEqual(bytesOf(e.crystal32).map((b) => (b >= 128 ? b - 256 : b)), e.crystal_codes, `${c.id}: codes`);
    const [f] = C.parseBiochainStreamStrict(packet + "00000000");
    const parity = Number((BigInt("0x" + packet) >> 59n) & 1n);
    assert.deepEqual({ form: f.form, parity, spin: f.spin, payload16: f.payload16, freq: f.freq, amp: f.amp }, e.fields, `${c.id}: fields`);
    assert.equal(f.parityOk, true, `${c.id}: even parity`);
    if (c.informative && c.informative.kernel_normalized_differs) {
      assert.notEqual(packet, c.informative.kernel_normalized_packet, `${c.id}: not the kernel-normalised packet`);
      x80++;
    }
  }
  assert.ok(x80 >= 46, `${x80} chunks with a 0x80 crystal byte`);
});

test("shdccp2_chunk: residual, frame and leaf of each chunk, and the residual decodes back", () => {
  for (const c of suite("shdccp2_chunk").cases) {
    const chunk = bytesOf(c.input.chunk_hex), e = c.expect;
    const residual = C.encodeChunk(chunk);
    assert.equal(residual, e.residual, `${c.id}: residual`);
    assert.equal(residual.length / 2, e.residual_bytes, `${c.id}: residual bytes`);
    assert.equal(C.crystallize(chunk), e.packet, `${c.id}: packet`);
    assert.equal(C.frameStream([e.packet], [residual]), e.frame, `${c.id}: frame`);
    assert.equal(C.leafHashSync(c.input.index, chunk), e.leaf, `${c.id}: leaf`);
    assert.deepEqual(C.decodeChunk(residual, chunk.length), chunk, `${c.id}: decodes back`);
  }
});

test("shdccp2_merkle: the root of K leaves", () => {
  for (const c of suite("shdccp2_merkle").cases) assert.equal(C.merkleRootSync(c.input.leaves), c.expect.root, c.id);
});

test("shdccp2_arith: Math.hypot, qn, qmul, qconj and toFixed, bit for bit", () => {
  for (const c of suite("shdccp2_arith").cases) {
    const i = c.input, e = c.expect;
    switch (i.op) {
      case "hypot": assert.equal(hex64(Math.hypot(...i.args.map(f64))), e.result, c.id); break;
      case "qn": assert.deepEqual(C.qn(i.args.map(f64)).map(hex64), e.result, c.id); break;
      case "qmul": assert.deepEqual(C.qmul(i.a.map(f64), i.b.map(f64)).map(hex64), e.result, c.id); break;
      case "qconj": assert.deepEqual(C.qconj(i.a.map(f64)).map(hex64), e.result, c.id); break;
      case "toFixed":
        if (i.digits === 12) assert.equal(C.quatHex([f64(i.x)]), e.text, c.id);
        else assert.equal(f64(i.x).toFixed(i.digits), e.text, c.id);
        if ("number" in e) assert.equal(hex64(+f64(i.x).toFixed(i.digits)), e.number, `${c.id}: read back`);
        break;
      default: assert.fail(`${c.id}: unknown op ${i.op}`);
    }
  }
});

test("shdccp2_weave: crystalQuat, every chiral and mirror step, and the weave strings", () => {
  for (const c of suite("shdccp2_weave").cases) {
    const chunks = c.input.chunks_hex.map(bytesOf), e = c.expect;
    assert.deepEqual(chunks.map((ch) => C.crystallize(ch).slice(2, 10)), e.crystal32, `${c.id}: crystal32`);
    const quats = chunks.map((ch) => C.crystalQuat(ch));
    assert.deepEqual(quats.map((q) => q.map(hex64)), e.crystal_quat, `${c.id}: crystalQuat`);
    let wf = [1, 0, 0, 0], wm = [1, 0, 0, 0];
    const chiral = [], mirror = [];
    for (const q of quats) { wf = C.qn(C.qmul(q, wf)); chiral.push(wf.map(hex64)); }
    for (let k = quats.length - 1; k >= 0; k--) { wm = C.qn(C.qmul(C.qconj(quats[k]), wm)); mirror.push(wm.map(hex64)); }
    assert.deepEqual(chiral, e.chiral_steps, `${c.id}: chiral steps`);
    assert.deepEqual(mirror, e.mirror_steps, `${c.id}: mirror steps`);
    assert.deepEqual(C.chainWeaves(chunks), { weaveChiral: e.weaveChiral, weaveMirror: e.weaveMirror }, `${c.id}: weaves`);
  }
});

test("engram1: tokens, grids, J numerators, stream, count, mean J and mulberry32 draws", () => {
  for (const c of suite("engram1").cases) {
    const e = c.expect;
    if ("mulberry32_seed" in c.input) {
      const rng = C.mulberry32(c.input.mulberry32_seed);
      assert.deepEqual(Array.from({ length: c.input.draws }, () => rng() * 4294967296), e.u32, c.id);
      continue;
    }
    const tokens = C.tokenizeEngrams(c.input.text);
    assert.deepEqual(tokens, e.tokens, `${c.id}: tokens`);
    assert.deepEqual(tokens.map(C.engramHex), e.grids_hex, `${c.id}: grids`);
    assert.deepEqual(tokens.map((t) => C.engramJ(C.engramGrid(t)) * 32), e.j_num, `${c.id}: J numerators`);
    const s = C.engramStreamFromText(c.input.text);
    assert.deepEqual({ engramStream: s.stream, engramCount: s.count, engramMeanJ: s.meanJ },
      { engramStream: e.engramStream, engramCount: e.engramCount, engramMeanJ: e.engramMeanJ }, `${c.id}: stream`);
  }
});

test("shdccp2_record: growBiochain gives every record, refuses the two errors, and each record passes the strict check", async () => {
  const ERRORS = { "empty-input": /Nothing to grow/, "input-too-large": /capped/ };
  for (const c of suite("shdccp2_record").cases) {
    const text = vectorText(c.input), e = c.expect;
    if ("error" in e) { await assert.rejects(C.growBiochain(text, { engrams: c.input.engrams }), ERRORS[e.error], c.id); continue; }
    const rec = await C.growBiochain(text, { engrams: c.input.engrams });
    const want = {};
    for (const [k, v] of Object.entries(e)) {
      const m = /^(stream|engramStream)_(sha256|length)$/.exec(k);
      if (!m) want[k] = v;
      else if (m[2] === "sha256") assert.equal(sha256(rec[m[1]]), v, `${c.id}: ${m[1]} SHA-256`);
      else assert.equal(rec[m[1]].length, v, `${c.id}: ${m[1]} length`);
    }
    for (const [k, v] of Object.entries(want)) assert.deepEqual(rec[k], v, `${c.id}: ${k}`);
    assert.deepEqual(Object.keys(rec).sort(), Object.keys(e).map((k) => k.replace(/_(sha256|length)$/, "")).filter((k, i, a) => a.indexOf(k) === i).sort(),
      `${c.id}: the same fields`);
    const v = C.verifyIntegrityStrict(rec);
    assert.equal(v.ok, true, `${c.id}: strict, failed at ${v.failed}`);
  }
});

const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const hexOf = (bytes) => bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
/** The chunks a strict parse of a record's stream decodes to. */
const chunksOf = (rec) => C.parseBiochainStreamStrict(rec.stream).map((f) => C.decodeChunk(f.residual, f.chunkLen));
/** A crystal32 (8 hex digits) holds a crystal byte 0x80. */
const hasX80 = (crystal32) => [0, 2, 4, 6].some((i) => crystal32.slice(i, i + 2) === "80");

function assertStrictOk(rec, what) {
  const v = C.verifyIntegrityStrict(rec);
  assert.equal(v.ok, true, `${what}: strict, failed at ${v.failed}: ${C.failedCheck(v)?.detail}`);
  assert.equal(C.verifyIntegrityStrict(rec, { sha256: (s) => sha256(String(s)) }).ok, true, `${what}: strict with node:crypto`);
}

test("shdccp2_weave: the chunks, grown as one text, give the vector's packets and weaves and pass the strict check (0x80 crystal bytes)", async () => {
  let x80 = 0;
  for (const c of suite("shdccp2_weave").cases) {
    const e = c.expect, text = STRICT_UTF8.decode(new Uint8Array(c.input.chunks_hex.flatMap(bytesOf)));
    const rec = await C.growBiochain(text);
    assert.deepEqual(chunksOf(rec).map(hexOf), c.input.chunks_hex, `${c.id}: the 720-byte cut gives the vector's chunks`);
    const packets = C.parseBiochainStreamStrict(rec.stream).map((f) => f.packet);
    assert.deepEqual(packets.map((p) => p.slice(2, 10)), e.crystal32, `${c.id}: crystal32, raw`);
    assert.deepEqual({ weaveChiral: rec.weaveChiral, weaveMirror: rec.weaveMirror }, { weaveChiral: e.weaveChiral, weaveMirror: e.weaveMirror }, `${c.id}: weaves`);
    assertStrictOk(rec, c.id);
    assert.equal((await C.verifyIntegrity(rec)).ok, true, `${c.id}: self-consistent`);
    x80 += e.crystal32.filter(hasX80).length;
  }
  assert.ok(x80 >= 14, `${x80} packets with a 0x80 crystal byte`);
});

// ---------------------------------------------------------------- shdccp2_limits (RFC 07 sections 4.4 and 6.6)

/** Bits of each code the rank coder writes for these bytes, read from RFC 07 sections 6.1-6.3: the context is the
 *  two previous bytes, (0, 0) at the start; its candidates are the bytes seen after it, by count descending, then
 *  byte value ascending; a byte among them costs gamma(rank + 1), any other gamma(candidates + 1) + 8 bits. */
function rfcCodeBits(bytes) {
  const gammaBits = (m) => 2 * (31 - Math.clz32(m)) + 1;
  const table = new Map(), bits = [];
  let c1 = 0, c2 = 0;
  for (const b of bytes) {
    const key = c1 * 256 + c2;
    let counts = table.get(key);
    if (!counts) table.set(key, (counts = new Map()));
    const cands = [...counts].sort((x, y) => y[1] - x[1] || x[0] - y[0]).map(([v]) => v);
    const rank = cands.indexOf(b);
    bits.push(rank >= 0 ? gammaBits(rank + 1) : gammaBits(cands.length + 1) + 8);
    counts.set(b, (counts.get(b) || 0) + 1);
    [c1, c2] = [c2, b];
  }
  return bits;
}
/** RFC 07 section 4.4: the bound for an input of n bytes, from the 720-byte cut and 25 bits per byte. */
function streamBound(n) {
  const K = Math.ceil(n / 720), lens = Array.from({ length: K }, (_, i) => Math.min(720, n - 720 * i));
  const maxRes = (len) => Math.ceil(25 * len / 8);
  return { chunks: K, last_chunk_bytes: lens[K - 1], max_bits_per_byte: 25, max_residual_bytes_full_chunk: maxRes(720),
    max_stream_hex: lens.reduce((a, l) => a + 16 + 8 + 2 * maxRes(l), 0), cap_hex: K * (16 + 8 + 2 * maxRes(720)) };
}
/** n bytes of printable ASCII that cost the coder much: the first 720 characters of the order-3 de Bruijn sequence
 *  over a..i, repeated (the text of shdccp2_limits/grow_de_bruijn_60000). */
function highCostText(n) {
  const k = 9, seq = [], a = new Array(3 * k).fill(0);
  (function db(t, p) {
    if (t > 3) { if (3 % p === 0) for (let j = 1; j <= p; j++) seq.push(a[j]); return; }
    a[t] = a[t - p]; db(t + 1, p);
    for (let j = a[t - p] + 1; j < k; j++) { a[t] = j; db(t + 1, t); }
  })(1, 1);
  const s = seq.map((d) => String.fromCharCode(97 + d)).join("").slice(0, 720);
  return s.repeat(Math.ceil(n / s.length)).slice(0, n);
}

test("shdccp2_limits: encodeChunk at the coder's largest codes, and grown records within the section 4.4 bound", async () => {
  const ids = [];
  for (const c of suite("shdccp2_limits").cases) {
    const i = c.input, e = c.expect, inf = c.informative || {};
    ids.push(c.id);
    if ("coder_input_hex" in i) {
      const bytes = bytesOf(i.coder_input_hex), residual = C.encodeChunk(bytes);
      assert.equal(residual, e.residual, `${c.id}: residual`);
      assert.equal(residual.length / 2, e.residual_bytes, `${c.id}: residual bytes`);
      assert.deepEqual(C.decodeChunk(residual, bytes.length), bytes, `${c.id}: decodes back`);
      const bits = rfcCodeBits(bytes), used = bits.reduce((a, b) => a + b, 0), max = Math.max(...bits);
      assert.deepEqual({ used_bits: used, max_code_bits: max, max_code_index: bits.indexOf(max) },
        { used_bits: e.used_bits, max_code_bits: e.max_code_bits, max_code_index: e.max_code_index }, `${c.id}: code lengths`);
      assert.equal(Math.ceil(used / 8), e.residual_bytes, `${c.id}: the codes fill the residual`);
      const pad = BigInt(residual.length * 4 - used);
      assert.equal(BigInt("0x" + residual) & ((1n << pad) - 1n), 0n, `${c.id}: zero padding`);
      assert.ok(max <= 25 && (bytes.length > 720 || max <= 23), `${c.id}: ${max} bits (RFC 07 section 6.6)`);
    } else {
      const text = vectorText(i), n = new TextEncoder().encode(text).length;
      assert.equal(text, highCostText(n), `${c.id}: the de Bruijn text`);
      const rec = await C.growBiochain(text);
      const frames = C.parseBiochainStreamStrict(rec.stream);
      assert.equal(frames.length, e.chunks, `${c.id}: chunks`);
      assert.deepEqual(frames.map((f) => f.residualBytes), e.residual_bytes, `${c.id}: residual bytes`);
      assert.equal(rec.stream.length, e.stream_length, `${c.id}: stream length`);
      assert.equal(sha256(rec.stream), e.stream_sha256, `${c.id}: stream SHA-256`);
      assert.deepEqual(streamBound(n), inf.stream_bound, `${c.id}: the section 4.4 bound (informative)`);
      assert.ok(rec.stream.length <= streamBound(n).max_stream_hex, `${c.id}: within the bound`);
      assertStrictOk(rec, c.id);
    }
  }
  for (const id of ["coder_escape_after_255_candidates", "coder_hit_at_rank_256", "chunk_hub_720", "grow_de_bruijn_00001", "grow_de_bruijn_60000"])
    assert.ok(ids.includes(id), id);
  assert.equal(C.MAX_GROW_BYTES, 60000);
  assert.equal(streamBound(60000).cap_hex, 380016, "84 frames of at most 4,524 hex digits");
});

// ---------------------------------------------------------------- merkle_rules_same_bytes (RFC 07 section 7)

test("merkle_rules_same_bytes: Owl's leaves and root; the BIOSEED/1 and RFC 6962 roots of the same chunks differ and fail the strict check", async () => {
  for (const c of suite("merkle_rules_same_bytes").cases) {
    const e = c.expect, rec = await C.growBiochain(vectorText(c.input));
    assert.equal(rec.leafHashes.length, e.chunks, `${c.id}: chunks`);
    assert.deepEqual({ leafHashes: rec.leafHashes, merkleRoot: rec.merkleRoot }, e.shdccp2, `${c.id}: the shdccp2 rule`);
    assert.deepEqual(chunksOf(rec).map((ch, k) => C.leafHashSync(k, ch)), e.shdccp2.leafHashes, `${c.id}: leafHashSync`);
    assertStrictOk(rec, c.id);
    const other = { bioseed1: { leaves: e.bioseed1.leafHashes, root: e.bioseed1.merkleRoot }, rfc6962: { leaves: e.rfc6962.leafHashes, root: e.rfc6962.root } };
    assert.equal(new Set([e.shdccp2.merkleRoot, other.bioseed1.root, other.rfc6962.root]).size, 3, `${c.id}: three roots`);
    for (const [rule, o] of Object.entries(other)) {
      const rootOnly = C.verifyIntegrityStrict({ ...rec, merkleRoot: o.root });
      assert.deepEqual([rootOnly.failed, C.failedCheck(rootOnly).fields], ["leaves", ["merkleRoot"]], `${c.id}: the ${rule} root`);
      const both = C.verifyIntegrityStrict({ ...rec, leafHashes: o.leaves, merkleRoot: o.root });
      assert.deepEqual([both.failed, C.failedCheck(both).fields], ["leaves", ["leafHashes"]], `${c.id}: the ${rule} leaves and root`);
      assert.equal((await C.verifyIntegrity({ ...rec, merkleRoot: o.root })).ok, false, `${c.id}: verifyIntegrity, the ${rule} root`);
    }
  }
});

// ---------------------------------------------------------------- engram1_keys and rng_mulberry32 (RFC 07 section 9)

test("engram1_keys: the key of a string is the grid of its letters A-Z after full Unicode upper-casing, in upper-case hex", () => {
  const ids = [];
  for (const c of suite("engram1_keys").cases) {
    const text = c.input.key_text, e = c.expect;
    ids.push(c.id);
    assert.match(e.key_hex, /^[0-9A-F]{16}$/, `${c.id}: canonical form`);
    assert.equal(C.engramHex(text), e.key_hex, `${c.id}: engramHex`);
    assert.deepEqual(C.engramOf(text), C.engramGrid(text), `${c.id}: engramOf is the grid`);
    assert.equal([...text.toUpperCase()].filter((ch) => /^[A-Z]$/.test(ch)).join(""), e.letters, `${c.id}: letters`);
    assert.equal(C.engramHex(e.letters), e.key_hex, `${c.id}: the key of its letters`);
  }
  for (const id of ["geodesic_upper", "strasse_sharp_s", "ligature_fi", "dotless_i", "owl_emoji"]) assert.ok(ids.includes(id), id);
  assert.equal(C.engramHex("GEODESIC"), "5C896A4801C9C24C");
});

test("rng_mulberry32: every draw; for the 26 letter seeds the draws above 2^31 are the letter's engram grid", () => {
  let letters = 0;
  for (const c of suite("rng_mulberry32").cases) {
    const rng = C.mulberry32(c.input.seed);
    const u32 = Array.from({ length: c.input.draws }, () => rng() * 4294967296);
    assert.deepEqual(u32, c.expect.u32, c.id);
    if (c.input.seed >= 65 && c.input.seed <= 90 && c.input.draws === 64) {
      assert.deepEqual(u32.map((u) => (u > 2 ** 31 ? 1 : 0)), C.engramGrid(String.fromCharCode(c.input.seed)), `${c.id}: grid`);
      letters++;
    }
  }
  assert.equal(letters, 26);
});

// ---------------------------------------------------------------- shdccp2_tamper (RFC 07 sections 12.3-12.5)

/** One tamper case against the strict verifier: { ok, failed } (expected), the checks that ran, and the legacy flag,
 *  fields and label (informative). */
function checkTamperCase(c) {
  const rec = c.input.record, e = c.expect, inf = c.informative || {};
  const v = C.verifyIntegrityStrict(rec);
  assert.equal(v instanceof Promise, false, "synchronous");
  assert.deepEqual({ ok: v.ok, failed: v.failed }, e, `${c.id}: verdict (${C.failedCheck(v)?.detail})`);
  const viaNode = C.verifyIntegrityStrict(rec, { sha256: (s) => sha256(String(s)) });
  assert.deepEqual({ ok: viaNode.ok, failed: viaNode.failed }, e, `${c.id}: verdict with node:crypto`);
  assert.equal(v.legacy, inf.legacy, `${c.id}: legacy (informative)`);
  assert.equal(viaNode.legacy, inf.legacy, `${c.id}: legacy with node:crypto (informative)`);
  const notRecord = rec === null || typeof rec !== "object" || Array.isArray(rec);
  const ran = e.ok ? C.STRICT_CHECKS.length : inf.legacy || notRecord ? 1 : C.STRICT_CHECKS.indexOf(e.failed) + 1;
  assert.deepEqual(v.checks.map((x) => x.name), C.STRICT_CHECKS.slice(0, ran), `${c.id}: the checks that ran`);
  assert.ok(v.checks.slice(0, e.ok ? ran : -1).every((x) => x.ok), `${c.id}: the earlier checks pass`);
  if (!e.ok) assert.deepEqual(C.failedCheck(v).fields, inf.owl_fields, `${c.id}: the fields named`);
  assert.equal(C.strictLabel(v, inf.self_consistent), inf.label, `${c.id}: label`);
  return v;
}

test("shdccp2_tamper: the honest records pass and every altered value fails at its expected check, with either hash", () => {
  const s = suite("shdccp2_tamper"), failedAt = new Set();
  let honest = 0;
  for (const c of s.cases) {
    const v = checkTamperCase(c);
    if (v.ok) honest++; else failedAt.add(v.failed);
  }
  assert.ok(s.cases.length >= 79, `${s.cases.length} values`);
  assert.ok(honest >= 5, `${honest} honest records`);
  assert.deepEqual([...failedAt].sort(), [...C.STRICT_CHECKS].sort(), "a case fails at each check");
  const ids = s.cases.map((c) => c.id);
  for (const id of ["T1_no_leaves_no_root", "T2_crystal_packet0_bit0", "T8_chainid_last_digit", "T9_escape_flip", "T9_padding_flip",
    "honest_x80_single_chunk", "honest_leading_bom", "kernel_normalized_0x80", "legacy_streams", "not_a_record_null", "length_negative",
    "cut_719_middle", "over_60000_bytes", "merkleroot_bioseed1"]) assert.ok(ids.includes(id), id);
});

// RFC 07 section 17, option (a): hex digits of either case pass parity, and well-formed UTF-8 is checked at the start of
// derived, so these values fail where the Hyperbolic Lexicon's verifier names them (section 12.5's table): a packet not
// in upper case at crystal, a residual or length not in lower case at canonical, and ill-formed UTF-8 at the first check
// its change leaves wrong, at derived when every other field comes from the same bytes. These are the suite's expected
// values; listing them here makes a refreshed copy that moves one of them fail this test.
const OPTION_A = { packet_lower_case: "crystal", packet_mixed_case: "crystal", residual_upper_case: "canonical",
  residual_mixed_case: "canonical", length_upper_case: "canonical", utf8_lead_byte_at_end: "derived", utf8_overlong: "derived",
  utf8_encoded_surrogate: "derived", utf8_lone_continuation: "derived", utf8_invalid_across_cut: "derived",
  utf8_residual_changed: "crystal", utf8_packet_and_residual_changed: "leaves", utf8_leaves_and_root_changed: "weaves" };

test("shdccp2_tamper_open: every value fails at its expected check, RFC 07 section 17's option (a), with either hash", () => {
  const s = suite("shdccp2_tamper_open");
  for (const [id, failed] of Object.entries(OPTION_A)) {
    const c = s.cases.find((x) => x.id === id);
    assert.ok(c, id);
    assert.deepEqual(c.expect, { ok: false, failed }, `${id}: the expected verdict`);
  }
  for (const c of s.cases) {
    assert.equal(c.expect.ok, false, `${c.id}: a value to reject`);
    checkTamperCase(c);
  }
  assert.ok(s.cases.length >= 13, `${s.cases.length} values`);
});

/** verifyIntegrity and recreateChunks on each value, in a worker with a memory limit and a time limit, so that a
 *  value on which they do not return fails this test instead of stopping the run. → { id: { lax, recreate } } */
function laxInWorker(cases, ms = 60000) {
  const src = `const { workerData, parentPort } = require("node:worker_threads");
import(workerData.url).then(async (C) => {
  const out = {};
  for (const { id, record } of workerData.cases) {
    const lax = await C.verifyIntegrity(record);
    let recreate;
    try { recreate = C.recreateChunks(record).length + " chunk(s)"; } catch (e) { recreate = "throws: " + e.message; }
    out[id] = { lax: lax.ok, reason: lax.reasons[0], recreate };
  }
  parentPort.postMessage(out);
});`;
  return new Promise((done, fail) => {
    const w = new Worker(src, { eval: true, workerData: { url: CORE_URL, cases }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
    const timer = setTimeout(() => { w.terminate(); fail(new Error(`verifyIntegrity did not return within ${ms} ms`)); }, ms);
    w.once("message", (m) => { clearTimeout(timer); w.terminate(); done(m); });
    w.once("error", (e) => { clearTimeout(timer); fail(e); });
  });
}

test("shdccp2_tamper: verifyIntegrity returns on every value, with the self-consistency verdict the vectors record", async () => {
  const cases = [...suite("shdccp2_tamper").cases, ...suite("shdccp2_tamper_open").cases];
  const got = await laxInWorker(cases.map((c) => ({ id: c.id, record: c.input.record })));
  let recorded = 0;
  for (const c of cases) {
    const inf = c.informative || {};
    if ("self_consistent" in inf) { assert.equal(got[c.id].lax, inf.self_consistent, `${c.id}: verifyIntegrity (${got[c.id].reason})`); recorded++; }
  }
  assert.equal(recorded, cases.length - 1, "every value but length_negative records it");
  // A residual length that a lenient parseInt reads as negative (-12): the lax parser refuses it.
  assert.deepEqual(got.length_negative, { lax: false, reason: "decode failure: malformed stream frame", recreate: "throws: malformed stream frame" });
  for (const id of ["T1_no_leaves_no_root", "T2_crystal_packet0_bit0", "T8_chainid_last_digit", "T9_escape_flip", "T9_padding_flip"])
    assert.equal(got[id].lax, true, `${id}: self-consistent only`);
});
