# SHD-CCP Pump Verification Suite

A small, dependency-free verification layer for the two pump papers in this repo —
the **Torsional Markov Memory-Offload Pump** and the **Hyperbolic Sparsemax Pump** —
plus the **Golden Strassen Clifford Toroid** geometry note.

Both pump papers are careful to mark their boundary between *theorem* and *engineering
design*. This suite turns the items they flagged as "next steps" into **runnable
witnesses**: it constructs the objects explicitly and checks the claims, exactly over
the rationals wherever the claim is algebraic, and in clearly-labelled floating point
only where the mathematics is genuinely transcendental (SLERP, equidistration).

> Honesty note. This suite verifies what the pump papers actually claim — a quaternion
> multi-resolution memory and a rational hyperbolic attention kernel with a directed
> stationary current. It has **nothing to do** with breaking elliptic-curve cryptography;
> none of these results bear on ECDLP, and no part of this code attempts key recovery.

## Run it

```bash
python3 run_all.py            # everything (~35s, dominated by the exact 64x64 solve)
python3 verify_cycle_current.py
python3 verify_sparsemax_kernel.py
python3 verify_slerp_drift.py
python3 verify_clifford_winding.py
```

Pure Python 3 standard library (`fractions`, `math`, `random`). No numpy/sympy.
`RESULTS.txt` holds a captured run for reference.

## What each module establishes

### `verify_cycle_current.py` — the torsional cycle current (exact)
Constructs an explicit row-stochastic `K` on the three gear states `{12, 10, 8}`,
solves the stationary `pi` **exactly over Q**, and computes the three edge currents.

- **Lemma 5** (the three edge currents coincide at stationarity) holds exactly — shown
  for a non-uniform `pi = (257/891, 406/891, 76/297)`, so it is not an artifact of symmetry.
- The **pump condition `J > 0`** holds for the forward-biased witness (`J = 3/20`).
- The sign of `J` is governed exactly by the **Kolmogorov cycle criterion**:
  `J > 0  ⟺  K[12→10]K[10→8]K[8→12] > K[12→8]K[8→10]K[10→12]`
  (verified for forward-biased, balanced → `J = 0`, and reverse-biased cases).

This is the paper's "explicit `K`, `pi` realizing a prescribed cycle affinity," made concrete.

### `verify_sparsemax_kernel.py` — the Sparsemax kernel + Remark 22 (exact)
Builds the kernel on the 64-voxel lattice `(Z/4Z)^3` with rational annular spinors, the
square-root-free Lorentz lift, rational hyperbolic quadrance, exact sparsemax rows, a
symmetric base walk, and the reverse valve. Re-verifies **Thms 2, 5, 11, 16, 17** and
**Cor 19** exactly over Q.

It then settles the one item the paper explicitly leaves open (**Remark 22**: whether the
kernel `K̂` sustains a current under its *own* stationary measure `π̂`). Computing `π̂`
exactly and measuring loop circulation shows `K̂` is **not reversible w.r.t. `π̂`**, with
a strictly positive circulation around an explicit toroidal loop:

- **Chirality-only base walk** (`W = 1`): `π̂` uniform, **no** circulation around any
  contractible square, and `J_C = 1/192 > 0` around every axis wrap-around loop — a clean
  global toroidal drift.
- **Quadrance-weighted base walk** (`W = S_ij + S_ji`): the hyperbolic geometry shapes
  `π̂` into a non-uniform measure (20 distinct values) and induces local eddies as well as
  the drift; `J_C ≈ 0.0052087 > 0`. All exact (≈850-digit rationals).

### `verify_slerp_drift.py` — offload reconstruction (exact endpoints, bounded interior)
Implements the telescoping coarse product and the SLERP fractional-power lift.

- **Endpoint exactness** (Prop 4): `δ^B = ΔQ` and reconstructed block endpoints match the
  truth to ~1e-15 (chordal metric); coarse-chain endpoints **telescope without accumulating**.
- **Drift bound** (the paper's requested "quantitative reconstruction-error bound"):
  `D_k ≤ Σ_{n≤k} d(Δq_n, δ)`, proved from bi-invariance + the triangle inequality and
  confirmed with **zero violations over 5000 random blocks**.
- The two genuine drift sources are exhibited separately: **increment non-uniformity** and
  **principal-branch aliasing** (uniform steps still drift once the block's net rotation
  wraps past π — the paper's "exact only on a single principal-branch increment" caveat).

### `verify_clifford_winding.py` — the golden Clifford torus (exact) + winding
Of the geometry note, this verifies the parts that are correct classical mathematics.

- **Golden radii, exact in `Q[φ]`**: `r₁ = φ r₂`, `r₁² + r₂² = 1`, `φ² = φ + 1` give
  `r₂² = (3−φ)/5`, `r₁² = (φ+2)/5`, with `r₁²+r₂² = 1` and `(r₁/r₂)² = φ²` checked exactly.
- The embedding lies on **S³** and is **intrinsically flat** (first fundamental form has
  constant `E, G` and `F = 0` → Gaussian curvature 0).
- **Ergodic winding**: a rational frequency ratio closes onto a curve (uneven, saturating);
  an irrational ratio fills the torus uniformly. The **golden ratio** attains the lowest
  star-discrepancy of the irrationals tested, with three-gap ratio exactly `φ`.
- **Flagged overreach**: the note's closing "ideal O(1) lookup manifold." Equidistribution
  is uniform *coverage*, not constant-time *lookup*; locating the time landing near a target
  is inhomogeneous Diophantine approximation. The winding is an excellent low-discrepancy
  sampler (the right way to choose the pumps' incommensurate gear ratios) — not an oracle.

## Files

| file | role |
|------|------|
| `shd_pump.py` | shared exact-rational primitives (quaternions over Q, Lorentz lift, quadrance, exact linear solve & stationary distribution) |
| `verify_cycle_current.py` | Lemma 1 — torsional 3-state cycle current |
| `verify_sparsemax_kernel.py` | Lemma 2 — Sparsemax kernel + Remark 22 |
| `verify_slerp_drift.py` | Lemma 3 — SLERP offload exactness + drift bound |
| `verify_clifford_winding.py` | Lemma 4 — golden Clifford torus + winding |
| `run_all.py` | run the whole suite |
| `pump_lab.html` | faithful, honestly-labelled interactive demo |
| `RESULTS.txt` | captured reference output |
