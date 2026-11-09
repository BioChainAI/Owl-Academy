// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Altered copies of honest shdccp/2 records, each with the first strict check (RFC 07 section 12.3) it must fail
// and, where it is part of what the case shows, the verdict of the self-consistency check verifyIntegrity (`laxOk`).
// Used by tests/unit/biomesh-strict.test.mjs. SHD-CCP-core's shdccp2_tamper suite started from this list; its vendored
// copy (tests/vendor/shdccp2-contract/) runs in tests/unit/contract-vectors.test.mjs.
//
//   tamperCases(core, { honest, honestNoEngrams, x80 }) -> [{ id, note, record, failed, legacy, laxOk? }]
//
// core: scripts/biomesh-core.js. honest: a grown record with engrams and at least three chunks, the first two of 720
// bytes and different; honestNoEngrams: the same text grown without engrams; x80: a grown record one of whose packets
// has a 0x80 crystal byte.

const clone = (v) => JSON.parse(JSON.stringify(v));

/** A packet with its parity bit (59) set again so that the word has an even number of one bits. */
export function refixParity(hex) {
  let w = BigInt("0x" + hex) & ~(1n << 59n), c = 0n;
  for (let b = w; b; b >>= 1n) c ^= b & 1n;
  return (w | (c << 59n)).toString(16).toUpperCase().padStart(16, "0");
}
/** A packet with bit `bit` (0 = least significant) flipped, parity not fixed. */
export const flipPacketBit = (hex, bit) => (BigInt("0x" + hex) ^ (1n << BigInt(bit))).toString(16).toUpperCase().padStart(16, "0");
/** A hex string with bit `bit` flipped, bit 0 being the most significant bit of the first byte. */
export function flipHexBit(hex, bit) {
  const at = bit >> 3, v = parseInt(hex.slice(at * 2, at * 2 + 2), 16) ^ (0x80 >> (bit & 7));
  return hex.slice(0, at * 2) + v.toString(16).padStart(2, "0") + hex.slice(at * 2 + 2);
}

const framesOf = (core, stream) => core.parseBiochainStreamStrict(stream).map((f) => ({ packet: f.packet, residual: f.residual }));
const streamOf = (core, frames) => core.frameStream(frames.map((f) => f.packet), frames.map((f) => f.residual));
/** The frame text (packet, length, residual) without the strict parser's checks: for streams it must not accept. */
const rawFrame = (packet, lenHex, residual) => packet + lenHex + residual;
const lenHexOf = (residual) => (residual.length / 2).toString(16).padStart(8, "0");

/** Single-bit flips of one residual that decode to the same chunk: [{ bit, residual, lastByte }]. */
export function silentFlips(core, record, frameIndex) {
  const f = core.parseBiochainStreamStrict(record.stream)[frameIndex];
  const want = core.decodeChunk(f.residual, f.chunkLen);
  const out = [];
  for (let bit = 0; bit < f.residual.length * 4; bit++) {
    const residual = flipHexBit(f.residual, bit);
    let got;
    try { got = core.decodeChunk(residual, f.chunkLen); } catch { continue; }
    if (got.length === want.length && got.every((b, i) => b === want[i])) out.push({ bit, residual, lastByte: bit >= (f.residual.length / 2 - 1) * 8 });
  }
  return out;
}

export async function tamperCases(core, { honest, honestNoEngrams, x80 }) {
  const cases = [];
  const add = (id, note, record, failed, extra = {}) => cases.push({ id, note, record, failed, legacy: false, ...extra });
  const h = () => clone(honest);
  const fr = framesOf(core, honest.stream);
  const K = fr.length;
  if (K < 3 || fr[0].residual === fr[1].residual) throw new Error("the honest record needs three chunks, the first two different");
  const withFrames = (frames, base = h()) => ({ ...base, stream: streamOf(core, frames) });
  const withStream = (stream, base = h()) => ({ ...base, stream });

  // ---- parity: not a record, legacy records, the strict stream form, packet parity
  add("not_a_record_null", "null instead of a record", null, "parity");
  add("not_a_record_array", "an array instead of a record", [], "parity");
  {
    const legacy = h();
    delete legacy.stream; delete legacy.streamVersion;
    const chunks = core.recreateChunks(honest);
    legacy.streams = fr.map((f) => f.residual);
    legacy.chunkLens = chunks.map((c) => c.length);
    add("legacy_streams", "a pre-stream record: parallel streams and chunkLens, no stream or streamVersion", legacy, "parity", { legacy: true, laxOk: true });
  }
  { const r = h(); delete r.streamVersion; add("streamversion_missing", "streamVersion removed", r, "parity", { legacy: true, laxOk: true }); }
  add("streamversion_unknown", "streamVersion shdccp/3", { ...h(), streamVersion: "shdccp/3" }, "parity", { legacy: true, laxOk: true });
  { const r = h(); delete r.stream; add("stream_missing", "stream removed, streamVersion kept", r, "parity", { legacy: true }); }
  add("stream_empty", "an empty stream", withStream(""), "parity");
  add("stream_truncated", "the last residual byte cut off the stream", withStream(honest.stream.slice(0, -2)), "parity");
  add("trailing_bytes", "one byte after the last frame", withStream(honest.stream + "00"), "parity");
  {
    const f = fr[0], i = f.residual.search(/[0-9a-f]/);
    const residual = f.residual.slice(0, i) + "g" + f.residual.slice(i + 1);
    const stream = rawFrame(f.packet, lenHexOf(f.residual), residual) + streamOf(core, fr.slice(1));
    add("residual_not_hex", "a residual character that is not a hex digit", withStream(stream), "parity");
  }
  // hex case (RFC 07 section 4.3): the strict parse reads either case, and the case fails at canonical (a residual or
  // its length) or at crystal (a packet), where the Hyperbolic Lexicon's verifier reports it (section 17, option (a))
  {
    const stream = rawFrame(fr[0].packet.toLowerCase(), lenHexOf(fr[0].residual), fr[0].residual) + streamOf(core, fr.slice(1));
    add("packet_lower_case", "packet 0 in lower-case hex (RFC 07 section 4.3 requires upper case)", withStream(stream), "crystal");
  }
  {
    const j = fr.findIndex((f) => /[a-f]/.test(f.residual));
    const frames = fr.map((f, i) => (i === j ? rawFrame(f.packet, lenHexOf(f.residual), f.residual.toUpperCase()) : rawFrame(f.packet, lenHexOf(f.residual), f.residual)));
    add("residual_upper_case", "a residual in upper-case hex (section 4.3 requires lower case)", withStream(frames.join("")), "canonical");
  }
  {
    const j = fr.findIndex((f) => /[a-f]/.test(lenHexOf(f.residual)));
    if (j >= 0) {
      const frames = fr.map((f, i) => rawFrame(f.packet, i === j ? lenHexOf(f.residual).toUpperCase() : lenHexOf(f.residual), f.residual));
      add("length_upper_case", "a residual length in upper-case hex (section 4.3 requires lower case)", withStream(frames.join("")), "canonical");
    }
  }
  {
    const frames = clone(fr);
    frames[1].packet = flipPacketBit(frames[1].packet, 59);
    add("parity_broken", "packet 1 with its parity bit flipped", withFrames(frames), "parity", { laxOk: false });
  }

  // ---- canonical: the 720-byte cut, the 60,000-byte limit, canonical residuals
  const text720 = "The owl keeps the tome; the fox keeps the lantern. ".repeat(20);
  const one = async (text) => framesOf(core, (await core.growBiochain(text, { engrams: false })).stream)[0];
  const a720 = await one(text720.slice(0, 720)), b719 = await one(text720.slice(1, 720)), c50 = await one(text720.slice(0, 50));
  add("cut_719_middle", "frames of 720, 719 and 50 bytes: a middle frame shorter than 720", withFrames([a720, b719, c50]), "canonical");
  add("over_60000_bytes", "84 frames of 720 bytes: 60,480 bytes", withFrames(Array.from({ length: 84 }, () => a720)), "canonical");
  {
    const flips = silentFlips(core, honest, 0);
    const escape = flips.find((x) => !x.lastByte), padding = [...flips].reverse().find((x) => x.lastByte);
    for (const [id, x] of [["T9_escape_flip", escape], ["T9_padding_flip", padding]]) {
      if (!x) continue;
      const frames = clone(fr); frames[0].residual = x.residual;
      add(id, `T9: residual 0 with bit ${x.bit} flipped, which decodes to the same chunk (${id.includes("padding") ? "a padding bit" : "inside a code"})`,
        withFrames(frames), "canonical", { laxOk: true });
    }
  }
  { const frames = clone(fr); frames[K - 1].residual += "00"; add("residual_extra_byte", "a zero byte after the last code of the last residual, its length raised", withFrames(frames), "canonical", { laxOk: true }); }
  { const frames = clone(fr); frames[K - 1].residual = frames[K - 1].residual.slice(0, -2); add("residual_short", "the last residual one byte short, its length lowered", withFrames(frames), "canonical"); }
  {
    const frames = clone(fr), w = BigInt("0x" + frames[K - 1].packet), n = Number((w >> 8n) & 0xFFFFn);
    frames[K - 1].packet = refixParity(((w & ~(0xFFFFn << 8n)) | (BigInt(n - 1) << 8n)).toString(16).toUpperCase().padStart(16, "0"));
    add("payload_one_less", "the last packet's payload16 one less than its chunk, parity fixed", withFrames(frames), "canonical", { laxOk: false });
  }
  {
    const split = framesOf(core, (await core.growBiochain("a".repeat(719) + "é", { engrams: false })).stream)[0];
    // well-formed UTF-8 is checked at the start of derived, so this fails at the first later check it leaves wrong
    add("utf8_ill_formed", "one 720-byte chunk ending in 0xC3, the first byte of a two-byte character; the leaves are the honest record's",
      withFrames([split]), "leaves");
  }

  // ---- crystal: each packet against crystallize(chunk)
  {
    const frames = clone(fr); frames[1].packet = refixParity(flipPacketBit(frames[1].packet, 30));
    add("T2_crystal_changed", "T2: a crystal bit of packet 1 flipped, parity fixed", withFrames(frames), "crystal", { laxOk: true });
  }
  {
    const frames = clone(fr); frames[0].packet = refixParity(flipPacketBit(frames[0].packet, 0));
    add("csum_changed", "the checksum bits of packet 0 changed, parity fixed", withFrames(frames), "crystal", { laxOk: true });
  }
  {
    const frames = clone(fr); [frames[0].packet, frames[1].packet] = [frames[1].packet, frames[0].packet];
    add("packets_swapped", "the packets of frames 0 and 1 swapped, residuals in place", withFrames(frames), "crystal", { laxOk: true });
  }
  {
    const xf = framesOf(core, x80.stream);
    const j = xf.findIndex((f) => [2, 4, 6, 8].some((d) => f.packet.slice(d, d + 2) === "80"));
    if (j < 0) throw new Error("the x80 record has no 0x80 crystal byte");
    const d = [2, 4, 6, 8].find((k) => xf[j].packet.slice(k, k + 2) === "80");
    xf[j].packet = refixParity(xf[j].packet.slice(0, d) + "81" + xf[j].packet.slice(d + 2));
    add("kernel_normalized_0x80", "a 0x80 crystal byte written as 0x81 (the Python kernel's normalisation), parity fixed",
      { ...clone(x80), stream: streamOf(core, xf) }, "crystal", { laxOk: true });
  }

  // ---- leaves: mandatory, K entries, each equal, the root
  { const r = h(); delete r.leafHashes; delete r.merkleRoot; add("T1_no_leaves_no_root", "T1: leafHashes and merkleRoot removed", r, "leaves", { laxOk: true }); }
  { const r = h(); delete r.leafHashes; add("leafhashes_missing", "leafHashes removed", r, "leaves", { laxOk: true }); }
  { const r = h(); delete r.merkleRoot; add("merkleroot_missing", "merkleRoot removed", r, "leaves", { laxOk: true }); }
  { const r = h(); r.leafHashes.push(r.leafHashes[K - 1]); add("extra_leaf", "the last leaf repeated at the end of leafHashes", r, "leaves", { laxOk: true }); }
  { const r = h(); r.leafHashes[1] = (r.leafHashes[1][0] === "0" ? "1" : "0") + r.leafHashes[1].slice(1); add("leaf_changed", "leaf 1 changed", r, "leaves", { laxOk: false }); }
  { const r = h(); r.merkleRoot = (r.merkleRoot[0] === "0" ? "1" : "0") + r.merkleRoot.slice(1); add("merkleroot_changed", "merkleRoot changed", r, "leaves", { laxOk: false }); }
  { const frames = clone(fr); [frames[0], frames[1]] = [frames[1], frames[0]]; add("frames_swapped", "frames 0 and 1 swapped", withFrames(frames), "leaves", { laxOk: false }); }

  // ---- weaves: weaveChiral, weaveMirror, segCuts, segments, chainId
  add("T8_chainid_changed", "T8: chainId changed", { ...h(), chainId: "BC-" + "0".repeat(24) }, "weaves", { laxOk: true });
  add("weavemirror_changed", "weaveMirror changed", { ...h(), weaveMirror: honest.weaveMirror.replace(/\d$/, (x) => String((+x + 1) % 10)) }, "weaves", { laxOk: true });
  add("weavechiral_changed", "weaveChiral changed", { ...h(), weaveChiral: honest.weaveChiral.replace(/\d$/, (x) => String((+x + 1) % 10)) }, "weaves", { laxOk: false });
  { const r = h(); r.segCuts[7] += 1; add("segcuts_changed", "the last segment cut moved", r, "weaves", { laxOk: true }); }
  add("segcuts_strings", "segCuts as strings", { ...h(), segCuts: honest.segCuts.map(String) }, "weaves", { laxOk: true });
  add("segments_changed", "segments 8", { ...h(), segments: 8 }, "weaves", { laxOk: true });
  add("segments_string", "segments as the string \"7\"", { ...h(), segments: "7" }, "weaves", { laxOk: true });

  // ---- derived: the engram fields, origBytes, shippedBytes, value
  add("engramstream_changed", "one engram key changed", { ...h(), engramStream: (honest.engramStream[0] === "0" ? "1" : "0") + honest.engramStream.slice(1) }, "derived", { laxOk: false });
  add("engramcount_changed", "engramCount + 1", { ...h(), engramCount: honest.engramCount + 1 }, "derived", { laxOk: true });
  add("engrammeanj_changed", "engramMeanJ changed", { ...h(), engramMeanJ: honest.engramMeanJ + 0.0001 }, "derived", { laxOk: true });
  { const r = h(); delete r.engramStream; add("engramstream_missing", "engramStream removed, engramCount and engramMeanJ kept", r, "derived", { laxOk: true }); }
  add("engram_field_added", "engramCount 0 added to a record grown without engrams", { ...clone(honestNoEngrams), engramCount: 0 }, "derived", { laxOk: true });
  add("origbytes_changed", "origBytes + 1", { ...h(), origBytes: honest.origBytes + 1 }, "derived", { laxOk: true });
  add("shippedbytes_changed", "shippedBytes − 1", { ...h(), shippedBytes: honest.shippedBytes - 1 }, "derived", { laxOk: true });
  add("value_changed", "value + 0.0001", { ...h(), value: honest.value + 0.0001 }, "derived", { laxOk: true });
  add("value_string", "value as a string", { ...h(), value: String(honest.value) }, "derived", { laxOk: true });
  return cases;
}
