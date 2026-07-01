# Ontological Codex — quaternion delta-chain memory offload (the five papers, applied)

The SHD-CCP Ontological Codex: a **three-scale quaternionic delta chain** that compresses a stream
of unit quaternions down a `720 → 72 → 10` gear hierarchy and logs the deltas so the structure can be
**re-created**. It is the executable realization of the design grounded in the five research papers —
applied where each one actually fits, and kept honest where it doesn't.

## How each paper is applied (and the reasoning)

The five papers split along the curvature axis the catalog is organized by — and that split decides
how each is used:

| Paper | Role here | Reasoning |
|---|---|---|
| **Torsional Markov Memory-Offload Pump** | **The blueprint** | Constructive and *locally proven*. The codex *is* its three gears: outer 720 (12-pt), middle 72 *inverse* (10-pt), inner 10 (8-pt); coarse = ordered delta products; fine = SLERP lifts. |
| **Hyperbolic Sparsemax Pump** | **The source + the split** | Fully proven. Its rational kernel emits the unit-quaternion stream; its octet-residual quarantine tells us to keep the rational forward path exact and confine SLERP/holonomy to the offline decoder. |
| **Golden Strassen-Clifford** | **Governance only** | Dual-Helix: centroid = untrusted summary (Helix A), delta chain = exact reconstruction (Helix B). Its factoring *speedup* is conditional (stays in Helix_Factorization, ε ≤ 0). |
| **TQF Operator Embedding** | **Vocabulary only — claim rejected** | The 64-voxel "generative kernel weaving a toroid" is used; its **sub-linear jump-ahead is the conceded overreach** (no group law for `x²+c`; `jump_ahead.py` measured the degree-2ⁱ wall). |
| **Harmonic Feature Embedding** | **Already built, measured** | Its roots-of-unity geometry is the `1+ω+ω²=0` motif; its factoring oracle is `harmonic_oracle.py` (R²≈0.9999 path-length, but ε ≈ −7.8e-3 — no positive bias). |

The principle: **apply the two constructive Pump papers literally; apply the three factoring papers'
*discipline* but not their *acceleration claims*.** A compression system has no business importing a
factoring speedup, and two of those claims are conceded/measured-negative anyway.

## What it does (measured — `ontological_codex.py`)

- **Prop 2 (telescoping) is exact.** Each middle block is the ordered product of its 10 outer deltas,
  which telescopes to `q_{10m+10} q_{10m}^{-1}`. With the **rational Sparsemax source the offload
  telescopes to *exactly zero* error** (parity-safe, by the rational/transcendental split); generic
  float sources telescope to ~1e-30 on 10-delta blocks.
- **Prop 3 (partition):** the `72 → 10` down-sampling splits into blocks of size **7 or 8**, covering 0..71.
- **Prop 4 (SLERP):** `(q^{1/N})^N = q` on the principal branch (reconstruction angle 0).
- **Rate–distortion dial** — "compress to a centroid AND re-create the structure" is not one number, it's
  a dial over *which scale you store*:

  | stored scale | bits | vs full | reconstruction RMSE (sparsemax / smooth / random) |
  |---|---|---|---|
  | outer 720 | 46080 | 1× | **lossless** (telescoping) |
  | middle 72 | 4608 | **10×** | 0.113 / **0.001** / 0.44 rad |
  | inner 10 | 640 | **72×** | 1.38 / 1.89 / 2.25 rad |

  Storing the outer chain is lossless; coarser scales are compact but SLERP-approximate the interior —
  near-perfect for smooth/structured streams, useless for noise. That *is* the honest compression story.
- **Holonomy control.** `H = Q8·Q10·Q12` is measured (~2–4 rad raw) and **closes to ~0** when the
  residual is absorbed into the inner equilibrium gear (the paper's §11 renormalization).
- **Centroid.** Reported as the order-independent projected mean — the lossy Helix-A summary, distinct
  from the exact delta-replay (Helix B).
- **Packet.** The 64-bit Einstein-tile FP8 core round-trips at ~2.4° error (lossy); the deltas are
  already rational, so **exact-rational storage is lossless and parity-safe** — FP8 is only a fixed-width
  wire format when size is capped.

## Sources (both, selectable)

- **`sparsemax`** — rational unit-quaternion increments from the 64-voxel `(ℤ/4ℤ)³` sparsemax kernel
  walk (parity-safe, exact telescoping). The on-architecture source.
- **`smooth` / `random`** — generic float streams, demonstrating the codex accepts *any* unit-quaternion
  stream (the kernel is optional).

## Run

```bash
python3 ontological_codex.py     # exact telescoping, the rate–distortion dial, holonomy close
```

Pure standard library; output in `ontological_codex_output.txt`. Open `index.html` for the interactive
bench: pick the source, turn the store-scale dial, watch the original (cyan) vs reconstructed (gold)
windings overlap or diverge, and read the **replayable delta-chain log** — the archive that re-creates
the structure. Auto-rotate off by default with a toggle; graceful WebGL fallback; embedded JS validated
in Node against the reference.

## Text front-end — `text_to_codex.py` / `converter.html`

A conversion program that builds on this codex: paste text → each token becomes a 64-bit SHD-CCP
packet → placed at node `(i mod 72)` on toroid `(i // 72)` → fed into the offload. **Two recovery
channels, both exact-or-honest:**

- **TEXT** — recovered from the **key stream** (token ids). Exact, independent of geometry precision.
- **CHAIN** — the quaternion deltas. Precision is the **Form-ID** choice (the master-switch diagrams):
  - **Form 0–2 (default, lossy)** — FP8 quaternion; ~3–5° per packet that **decays over the chain**
    (measured ~0.13–0.26 rad RMSE, ~0.5 rad final drift) — the diagrams' "signal decay" warning, real.
  - **Form 3 (corrected, lossless)** — FP8 + a corrective offset (the residual) → **RMSE ~1e-9**.

  v1 shows **both** so the decay is visible before defaulting to Form 3 / exact-rational.

**Feature source** is selectable: **TTMPT crystallization** (default — per-character XOR crystal →
bounded quaternion position), **generic** hash embedding, or **sparsemax** lattice spinor. Honest
caveat the program measures and states: crystallization/hashing is avalanche-like, so the deltas are
high-entropy — the **outer scale stays lossless**, but middle/inner SLERP reconstruction is lossy (the
random-source regime). Locally-correlated embeddings would compress the geometry better; the key stream
keeps the text exact either way. The packet parity bit is checked on every decode.

```bash
python3 text_to_codex.py        # text→packets→codex; text-exact, lossy-vs-corrected, the dial
```
Open `converter.html` for the live tool (paste text, pick the source, inspect each packet's 64 bits,
watch the original / lossy / corrected windings, read the recovered text). Embedded JS validated in Node.

## Where this sits

Flat / Euclidean track. `Engram_Codec` is the single-scale delta codec; the **Ontological Codex** is its
three-scale (720→72→10) generalization with the inverse middle gear, holonomy control, and the Sparsemax
source. See `../POLYCENTRIA.md` and `Hyperbolic_Softmax/` for the kernel, `../../Proofs/Pump-Verification/`
for the verified lemmas it reuses.
