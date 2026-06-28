# Engram Codec — the Markov pump as a memory-offload codec

This is the **honest, intended** use of the Torsional Markov Memory-Offload Pump and the
Quaternion Chain Compression papers: store a data stream as a quaternionic delta chain,
**offload** it into a compact coarse representation, and **recreate sections** by
reconstruction — i.e. exactly the "engram compression / recreation" idea. The load-bearing
math is already verified in `Proofs/Pump-Verification` (telescoping exact, SLERP drift
bounded, Smallest-Three quantization stable), so this codec stands on proven ground.

## What it is (and isn't)

It is a **lossy** multi-resolution codec. Measured (`engram_codec.py`, 720-frame streams):

- **Sections recreate exactly.** Block-boundary cumulative state telescopes to ~1e-15
  for *any* stream — so "reliably recreate sections" is literally true at the section
  (block) level, regardless of the data. That's the real, usable guarantee.
- **Intra-section detail is lossy and data-dependent** (normalized RMSE, 0≈perfect,
  1≈destroyed):

  | stream | 6× | 20× | 60× |
  |---|---|---|---|
  | smooth / structured | 0.06 | 0.06 | 0.16 |
  | random walk (mild structure) | 0.14 | 0.20 | 0.34 |
  | uniform random (high entropy) | 0.92 | 0.99 | 0.99 |

  Structured streams reconstruct well even at 60× compression; high-entropy data is
  essentially destroyed. This is information theory, not a defect — you can't losslessly
  compress randomness, and equal-share SLERP keeps only each block's net rotation.
- **Smallest-Three quantization is stable** (bounded round-trip error ≈ 0.01 at FP8).

## A real constraint it inherits

Each block's *net* rotation must stay within the principal branch (`|Σ| < π`) or the
angle wraps and reconstruction aliases — the exact caveat proved in the SLERP-drift
module. The codec keeps per-frame increments small (`SCALE`) so blocks stay in-branch;
that is why it suits **slowly-varying** streams.

## Use it for

Smooth embeddings, sensor/trajectory streams, slowly-varying context windows — a genuine
multi-resolution memory where coarse structure is preserved exactly and fine detail
degrades gracefully with the compression ratio. **Not** a general lossless store.

```bash
python3 engram_codec.py        # captured in engram_codec_output.txt
```
