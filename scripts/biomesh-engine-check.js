// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
/**
 * Does this JavaScript engine compute Biomesh weaves as V8 does?
 * ----------------------------------------------------------------------------
 * RFC 07 (BioChainAI/SHD-CCP-core) section 8.3 defines the weaves with V8's
 * Math.hypot, which qn calls; section 8.7 and decision D7 leave the other
 * engines to be measured. A page that recomputes weaves (the strict audit,
 * mage_tower/Biomesh_Audit.html) runs engineCheck() first and records the
 * result, so that a weave that does not reproduce can be told apart from a
 * difference in the auditing browser.
 *
 * HYPOT_V8: the 24 hypot cases of the contract-vector suite shdccp2_arith
 * (SHD-CCP-core contract_vectors/, CC0-1.0, normative; vendored here as
 * tests/vendor/shdccp2-contract/suites/shdccp2_arith.json): id, the four
 * arguments and V8's result, each a binary64 bit pattern in hex. The
 * hypot_differs_* inputs are ones on which sqrt of the plain sum of squares
 * gives another double.
 * WEAVE_V8: the bit patterns of the chiral and mirror weave quaternions
 * (before the 12-digit text form) of WEAVE_CHUNKS chunks of 720 bytes drawn
 * from mulberry32(WEAVE_SEED), computed in Node (V8).
 * tests/unit/weave-engines.test.mjs checks both tables: HYPOT_V8 against the
 * vendored suite, WEAVE_V8 against Node and against RFC 07's hypotV8.
 *
 * Firebase-free; imports only from biomesh-core.js.
 */

import { qmul, qconj, qn, crystalQuat, mulberry32 } from "./biomesh-core.js";

export const HYPOT_V8 = Object.freeze([
  ["hypot_unit", ["3ff0000000000000", "0000000000000000", "0000000000000000", "0000000000000000"], "3ff0000000000000"],
  ["hypot_zero", ["0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000"], "0000000000000000"],
  ["hypot_negzero", ["8000000000000000", "8000000000000000", "8000000000000000", "8000000000000000"], "0000000000000000"],
  ["hypot_half", ["3fe0000000000000", "3fe0000000000000", "3fe0000000000000", "3fe0000000000000"], "3ff0000000000000"],
  ["hypot_crystal_min", ["bf70204081020400", "bff0204081020408", "bff0204081020408", "bff0204081020408"], "3ffbee5c3f403bfe"],
  ["hypot_crystal_max", ["3ff0000000000000", "3ff0000000000000", "3ff0000000000000", "3ff0000000000000"], "4000000000000000"],
  ["hypot_tiny", ["01a56e1fc2f8f359", "01b56e1fc2f8f359", "01c01297d23ab683", "01c56e1fc2f8f359"], "01cd582f4cb7d79b"],
  ["hypot_huge", ["7e37e43c8800759c", "7e37e43c8800759c", "7e37e43c8800759c", "7e37e43c8800759c"], "7e47e43c8800759c"],
  ["hypot_agrees_00", ["3fb0204081020408", "bfe264c993264c99", "bfea74e9d3a74e9d", "3fd0204081020408"], "3ff0a375515cc932"],
  ["hypot_agrees_01", ["3fcc3870e1c3870e", "bfd72e5cb972e5cc", "3fc0204081020408", "bfc93264c993264d"], "3fdefcac4f7eb7be"],
  ["hypot_agrees_02", ["3fe0408102040810", "3fee3c78f1e3c78f", "bfd83060c183060c", "bfe2244891224489"], "3ff4554bff29ae07"],
  ["hypot_agrees_03", ["3fea74e9d3a74e9d", "3fe0204081020408", "3fcc3870e1c3870e", "bfe4a952a54a952a"], "3ff2f3a4d022287c"],
  ["hypot_differs_00", ["3fe9b366cd9b366d", "3fc0204081020408", "bfe5ab56ad5ab56b", "bfcb366cd9b366ce"], "3ff14467117acc15"],
  ["hypot_differs_01", ["3fde7cf9f3e7cf9f", "bfed3a74e9d3a74f", "3fdc3870e1c3870e", "bfe6ad5ab56ad5ab"], "3ff536a091485c75"],
  ["hypot_differs_02", ["3f80204081020400", "3fe72e5cb972e5cc", "bfe1224489122449", "3fb0204081020408"], "3fece5bb8fa8a5f7"],
  ["hypot_differs_03", ["3fb42850a142850c", "3fc52a54a952a54b", "bfd52a54a952a54b", "bfd3264c993264ca"], "3fdedb087f08ac47"],
  ["hypot_differs_04", ["3fd5ebd7af5ebd7b", "bfd62c58b162c58b", "3fa42850a142850a", "3fe162c58b162c59"], "3fe762cd8923317a"],
  ["hypot_differs_05", ["3fe68d1a3468d1a3", "3fee7cf9f3e7cf9f", "3fd1224489122449", "bfcd3a74e9d3a74f"], "3ff3c77b65a288c8"],
  ["hypot_differs_06", ["3fd972e5cb972e5d", "3fe2244891224489", "bfe3264c993264ca", "bfb42850a142850a"], "3fed6538a4bad05c"],
  ["hypot_differs_07", ["3fe3468d1a3468d2", "3fec3870e1c3870e", "3fdfbf7efdfbf7f0", "3fe83060c183060c"], "3ff66388be6898ff"],
  ["hypot_differs_08", ["3fc0204081020408", "bff0204081020408", "bfc52a54a952a54b", "bfd0a142850a1428"], "3ff0fb70e157429f"],
  ["hypot_differs_09", ["3fbc3870e1c38710", "bfde3c78f1e3c78f", "3fd72e5cb972e5cc", "3fe62c58b162c58b"], "3fed71dbc23140e7"],
  ["hypot_differs_10", ["3fd3264c993264ca", "3fd52a54a952a54b", "bfe83060c183060c", "bfb62c58b162c58b"], "3fec38ba99658ca3"],
  ["hypot_differs_11", ["3fe9d3a74e9d3a75", "bfe1a3468d1a3469", "bfc72e5cb972e5cc", "bfd83060c183060c"], "3ff103b7b4cec335"],
].map(Object.freeze));

export const WEAVE_SEED = 20261108;
export const WEAVE_CHUNKS = 64;
export const WEAVE_V8 = Object.freeze({
  chiral: Object.freeze(["bfeb08cf907e56f6", "3fcbbb65785ef5cb", "3fdcbbe4230a2906", "3fc8df4099d0dcc2"]),
  mirror: Object.freeze(["bfeb08cf907e56f5", "bfcbbb65785ef5b3", "bfdcbbe4230a290f", "bfc8df4099d0dcca"]),
});

/** 16 hex digits of a double's IEEE-754 bit pattern, and back. */
export function f64hex(x) {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, x);
  return v.getUint32(0).toString(16).padStart(8, "0") + v.getUint32(4).toString(16).padStart(8, "0");
}
export function hexf64(h) {
  const v = new DataView(new ArrayBuffer(8));
  v.setUint32(0, parseInt(h.slice(0, 8), 16));
  v.setUint32(4, parseInt(h.slice(8, 16), 16));
  return v.getFloat64(0);
}

/** The weave quaternions of the seeded chunks with this engine's arithmetic, as
 *  bit patterns: { chiral: [4 hex], mirror: [4 hex] } (RFC 07 section 8.4). */
export function seededWeaves(seed = WEAVE_SEED, count = WEAVE_CHUNKS) {
  const r = mulberry32(seed);
  const quats = Array.from({ length: count }, () =>
    crystalQuat(Array.from({ length: 720 }, () => Math.floor(r() * 256))));
  let wf = [1, 0, 0, 0], wm = [1, 0, 0, 0];
  for (const q of quats) wf = qn(qmul(q, wf));
  for (let i = quats.length - 1; i >= 0; i--) wm = qn(qmul(qconj(quats[i]), wm));
  return { chiral: wf.map(f64hex), mirror: wm.map(f64hex) };
}

/** Compare this engine with V8 on HYPOT_V8 and WEAVE_V8.
 *  → { matchesV8, hypotCases, hypotMismatches: [ids], weaveMatches } */
export function engineCheck() {
  const hypotMismatches = HYPOT_V8
    .filter(([, args, want]) => f64hex(Math.hypot(...args.map(hexf64))) !== want)
    .map(([id]) => id);
  const w = seededWeaves();
  const weaveMatches = w.chiral.join() === WEAVE_V8.chiral.join() && w.mirror.join() === WEAVE_V8.mirror.join();
  return { matchesV8: hypotMismatches.length === 0 && weaveMatches, hypotCases: HYPOT_V8.length, hypotMismatches, weaveMatches };
}
