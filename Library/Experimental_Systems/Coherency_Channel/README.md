# Coherency Channel — a benchmark-proofed adaptation of the 3-D coherency channel

The original design ("Designing a 3-D Coherency Channel with 3-Phase/Dimension Frequencies")
was a tutorial: it *described* seven subsystems but asserted their properties rather than
measuring them. This adaptation keeps **all seven systems** and turns each claim into a
**measured number checked against theory** — the repo's "build the verified reference"
discipline — plus a faithful interactive page that computes those numbers live.

## What gets proofed (every claim measured — `coherency_channel.py`)

| # | Subsystem | Claim | Measured vs theory |
|---|-----------|-------|--------------------|
| 0 | 3-PSK symbols | phases `{0°,120°,240°}` are the cube roots of unity, `1+ω+ω²=0` | **exact** in ℚ[√3] |
| 0 | LUT | 27 = 3³ semantic triplets ↔ 5-bit index, bijective | **exact** round-trip, 26 < 32 |
| 1 | 3-PSK decode | SEP tracks the nearest-neighbour MPSK law `2·Q(√(2·Es/N0)·sin π/3)` | within ~15% over 2–8 dB |
| 2 | Orthogonal FDM | integer-bin carrier spacing → zero crosstalk | **~1e-16**; half-bin leaks (0.64) |
| 3 | Return-to-baseline | drift/diffusion is AR(1)/OU; `σ² = noise_var/(1−(1−drift)²)` | measured σ² matches to <2% |
| 4/5 | Quaternion-Δ packing | 16-bit Δq (rotation-vector quantization), ~8× vs float32 | **0.27° closed-loop error**, 8× |
| 6 | Contextual stream | RLE(states) + Δ(quaternions) vs raw per-frame | **7.7×** compression |
| 7 | Attractor compression | a learned trajectory's per-step entropy ≪ `log₂27 ≈ 4.75` | **1.27 b** (p=0.15), **0.22 b** (p=0.02) |

All nine checks **PASS**. Output captured in `coherency_channel_output.txt`.

### Notes on the honest parts

- **3-PSK ≠ a free lunch.** Its error rate is the standard MPSK law; the cube-root constellation
  is elegant (and ties to the rest of the repo) but obeys the same SNR–reliability trade-off as
  any 3-ary PSK. We measure it, we don't beat it.
- **The 16-bit Δq is lossy but bounded.** Rotation-vector (log-map) quantization is the right tool
  for *near-identity* deltas — "smallest-three" over `[-1/√2, 1/√2]` would be far too coarse and
  gives multi-degree error. Under bounded angular velocity (±0.15 rad/component/frame) the
  closed-loop orientation error stays sub-degree. This is exactly the `Engram_Codec` offload,
  delivered as a packet field.
- **"Attractor compression" is just conditional entropy.** A structured (low-transition-entropy)
  path compresses; a uniform random walk does not. We measure `H(next|current)` for both — the
  same lesson as the Polycentria router/oracle: *structure is compressibility*.

## The structural tie-in

- The **3-PSK constellation is the cube roots of unity** — `1+ω+ω²=0`, the very identity that
  zeroes the `Trefoil_Streams` emergent phase. Three balanced phasors summing to zero is the
  recurring motif of this whole track.
- The **quaternion-delta fusion** is the `Engram_Codec` quaternion offload.
- As a **Polycentria cell**: the exact phase-quantize + LUT decoder is **Helix B** (the certifier);
  the FFT bank that flags which bins are active is **Helix A** (the heuristic oracle). The decoded
  result is always exact, whatever the bank proposed.

## Run

```bash
python3 coherency_channel.py     # ~8 s; Monte-Carlo + exact checks; prints the scorecard
```

Pure standard library. Open `index.html` for the live bench: the scorecard recomputes every number
in-page (and matches the Python), the 3-PSK constellation/spectrum animates the return-to-baseline,
a live BER-vs-SNR curve overlays measured points on the MPSK theory line, and the 3-sequence
attractor sim runs the trajectory. The trajectory sim uses D3 (CDN) and degrades gracefully if it's
blocked — every benchmark number is computed without it. The embedded measurement JS is validated
against the Python reference.

## Where this sits

`ECDLP_Hardness` → `Helix_Factorization` (ε≤0) → `Helix_Router` (ε≫0) → `Engram_Codec` →
`Helix_Benchmark` → `Trefoil_Streams` → **`Coherency_Channel`** (the RF/semantic carrier, every
subsystem measured against theory). See `../POLYCENTRIA.md`.
