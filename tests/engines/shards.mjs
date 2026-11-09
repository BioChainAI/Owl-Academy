// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Seeded inputs for the weave-engines measurement (decision D7, RFC 07 section 8.7): the same shards and the same
// Math.hypot arguments in Node and in each browser. Imported by weave-engines.mjs (Node) and weave-engines.html.

/** mulberry32 as unsigned 32-bit draws (the generator of RFC 07 section 9.2). */
export function draws(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

const WORDS = ("owl tome lantern spire weave chiral mirror crystal packet chunk leaf root merkle residual frame engram " +
  "geodesic lattice seal epoch growth codex familiar tower rain stars fox café naïve 中文 \u{1F989} Straße").split(" ");

/** Shard i of a seed: 1 to 6,000 bytes cut into 720-byte chunks (arrays of byte values). Even shards are random
 *  bytes, odd shards UTF-8 text built from WORDS. */
export function shard(seed, i) {
  const r = draws((seed ^ Math.imul(i + 1, 0x9E3779B1)) | 0);
  const n = 1 + (r() % 6000);
  let bytes;
  if (i % 2 === 0) bytes = Array.from({ length: n }, () => r() & 0xff);
  else {
    const enc = new TextEncoder(), out = [];
    while (out.length < n) out.push(...enc.encode(WORDS[r() % WORDS.length] + (r() % 7 === 0 ? ". " : " ")));
    bytes = out.slice(0, n);
  }
  const chunks = [];
  for (let at = 0; at < bytes.length; at += 720) chunks.push(bytes.slice(at, at + 720));
  return chunks;
}
export const shards = (seed, n) => Array.from({ length: n }, (_, i) => shard(seed, i));

/** n four-argument Math.hypot inputs like the ones qn sees (components of about -1.6 .. 1.6), plus a few far
 *  smaller or larger magnitudes. */
export function hypotInputs(seed, n) {
  const r = draws(seed ^ 0x5bd1e995);
  const u = () => (r() / 4294967296) * 3.2 - 1.6;
  return Array.from({ length: n }, (_, k) => {
    const q = [u(), u(), u(), u()];
    if (k % 50 === 0) return q.map((x) => x * 2 ** -500);
    if (k % 50 === 1) return q.map((x) => x * 2 ** 500);
    return q;
  });
}

/** 16 hex digits of a double's IEEE-754 bit pattern. */
export function f64hex(x) {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, x);
  return v.getUint32(0).toString(16).padStart(8, "0") + v.getUint32(4).toString(16).padStart(8, "0");
}
