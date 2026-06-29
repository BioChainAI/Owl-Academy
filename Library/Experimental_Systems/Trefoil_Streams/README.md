# Trefoil Streams — trefoil-knot data streams, an emergent 4th phase, and a Polycentria Dual-Helix around them

The next building block after `Helix_Router`. Same Polycentria discipline (Helix A
*proposes*, Helix B *certifies exactly*), now over a different carrier: three **(2,3)
torus-knot ("trefoil") data streams** wound around one **golden toroid** at the three
cube-root-of-unity phase offsets `0, 2π/3, 4π/3`. Each stream carries a primary winding
and its inverse — the SHD-CCP "primary stream + exact negative inverse." Their quaternion
centroid is an **emergent 4th phase**, and a Polycentria Dual-Helix governs all four.

This adapts the *triple-trefoil equilibrium* algorithm (Frenet-frame quaternion rotation
`P' = q·P·q⁻¹`, three twistor pairs, a centroid core) and adds the governance layer plus a
measured, honest account of what the structure actually does.

## The headline structure (measured)

Define the emergent phase as the running vector sum of the three pairs,
`Ψ₄(t) = Σₖ (Sₖ + Sₖ⁻¹)`. Measured against the torus **core circle**, its off-core
displacement collapses to a single complex number that is **constant in `t`**:

```
Z(s, ψ) = minorR · Σₖ sₖ · e^{i ψₖ}        ρ = ‖Z‖
```

where `sₖ` is stream `k`'s **quadrance scaling** (√quadrance / minorR) and `ψₖ` its phase
offset. `ρ` is exactly the magnitude of the **order-1 DFT bin** of the three stream
quadrance-roots.

- **Equilibrium = the zero point.** At balanced scalings and cube-root offsets the three
  minor-radius phasors cancel **exactly** — `1 + ω + ω² = 0` — so `ρ = 0` and the emergent
  phase falls onto the torus core. Verified exactly in `ℚ[√3]`; numerically `ρ ≈ 1e-16`.
- **Quadrance scaling re-grows it, linearly and calibrated.** A `δ` bump on one stream
  gives `ρ = minorR·δ` exactly — the emergent phase is a linear read-out of imbalance.
- **It's a topological parity channel.** `ρ = ‖Z‖` flags **that** a stream drifted; the
  argument `arg(Z)` points at **which** — **100% single-stream localization over 3000
  trials**, with no training.

## The golden toroid (exact)

The major:minor **quadrance** ratio is `R²/minorR² = φ²`, which is exactly the aspect of the
verified golden Clifford torus: `r1²/r2² = (φ+2)/(3-φ) = φ²` (checked exactly in `ℚ[√5]`).
So the trefoils wind the same golden geometry the rest of the repo is built on.

## The Polycentria Dual-Helix around the 4 phases

- **Helix A — the oracle.** Heuristic, geometric, fast. From the *noisily observed* stream
  states it proposes corrective configs using the phasor structure (push scalings toward
  balance, phases toward the cube-root offsets). Never trusted.
- **Helix B — the certifier.** Computes the **exact** emergent phasor `Z` and residual `ρ`
  for any proposed config. The reported equilibrium is always exact, whatever the oracle did.

Objective: restore equilibrium (minimize exact `ρ`) on a drifted, noisily observed 4-phase
system, at equal exact-evaluation budget `M`. Measured (`trefoil_streams.py`):

- **Oracle Bias ε = (random best ρ) − (oracle best ρ) ≈ +0.04, many σ.** The geometric
  oracle restores equilibrium faster than blind search — the same win as the Router,
  because here too **the objective *is* the geometry** (the opposite of the factoring case,
  where ε ≤ 0 because the hidden mod-p structure is invisible to the embedding).
- **Helix B stays exact and oracle-independent.** The chosen config's reported `ρ` is the
  exact one; the oracle's noise can only cost search efficiency, never corrupt the result.

## Run

```bash
python3 trefoil_streams.py     # exact ℚ[√d] checks, linearity table, parity %, governance ε
```

Pure standard library; output captured in `trefoil_streams_output.txt`.

Open `index.html` for the interactive bench: drag the three quadrance sliders and watch the
emergent phase bulge off the core and snap back to the zero point; read the parity dial
(`arg(Z)` → which stream); and run the governance trials to measure ε live. The 3D trefoil
view is an enhancement (Three.js via CDN) — every number on the page is computed in-page and
the bench is fully functional without WebGL (graceful `glReady` fallback). The embedded
governance JS is validated against the Python reference.

## Where this sits

`ECDLP_Hardness` (the wall) → `Helix_Factorization` (ε ≤ 0, honest negative) →
`Helix_Router` (ε ≫ 0, the architecture working) → `Engram_Codec` (memory strand) →
`Helix_Benchmark` (the composed pipeline) → **`Trefoil_Streams`** (a new geometric carrier:
the emergent 4th phase as an exact parity channel, governed by the same Dual-Helix). See
`../POLYCENTRIA.md` for why these cells nest safely.
