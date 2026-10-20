# Torsional Markov memory-offload pump in Lean 4

This project formalizes the mathematical system in Garrett Hoard's **The
Torsional Markov Memory-Offload Pump**, June 21, 2026, including its four local
results and a corrected end-to-end memory pipeline. It uses genuine real unit
quaternions and exact Lean mathematics, rather than floating point experiments.

The source is the PDF uploaded in this conversation (SHA-256
`5d5544494f2b626665b645df364b5d5f2cf122090169b0e4c3555856298d2990`).
The similarly named PDF already in the repository has different bytes; it is
not silently substituted for the supplied source.

**Validation status:** `bash scripts/check.sh` passes with Lean 4.24.0. All nine
proof modules compile, including `System.full_system_correct`. The axiom audit
checks 460 project theorem declarations (including generated declarations) and
finds only `propext`, `Classical.choice`, and `Quot.sound`, with no custom axioms
or unfinished proofs. The build emits non-failing style and unused-variable
warnings. Dependencies were built locally; fresh cache downloads still require
access to `lakecache.blob.core.windows.net`.

## Build and audit

Lean is pinned to `v4.24.0`, and Mathlib to commit
`f897ebcf72cd16f89ab4577d0c826cd14afaafc7` (Mathlib's `v4.24.0` release).
`lake-manifest.json` pins all transitive dependencies.

```bash
cd /workspace/Owl-Academy/Proofs/TorsionalPump
bash scripts/setup.sh
bash scripts/check.sh
```

The cloud setup uses `/workspace/.cache` for Elan and Mathlib. The existing
checkout is already isolated; a Git worktree is unnecessary. There are no servers,
credentials, GPUs, or Python packages required for this Lean project. On another
machine, set `ELAN_HOME` and `XDG_CACHE_HOME` to writable directories as needed.
The direct Lean installer in `setup.sh` targets Linux x86_64.

`check.sh` builds all nine proof modules and runs `Audit.lean`, which inspects
every declaration under the `TorsionalPump` namespace. It rejects local axioms and
any dependency on axioms other than Lean's standard `propext`, `Classical.choice`,
and `Quot.sound`. In particular unfinished proofs and compiler-trusted decision
procedures cannot silently pass this audit.

Network destinations are GitHub and its release assets, `raw.githubusercontent.com`,
and `lakecache.blob.core.windows.net`. The standard Elan installer also uses
`releases.lean-lang.org`; this setup can download the same official Lean release
directly from GitHub. TLS verification remains enabled.

## Every stage of the system

| Paper section | Lean module / main declarations | Formal content |
| --- | --- | --- |
| 1–2: states and scales | `Quaternion`, `Indexing`, `System.History` | An actual norm-one quaternion group; 720 outer increments represented by 721 boundary states; 72 middle and 10 inner increments. |
| 3: outer memory | `Algebra.delta`, `telescope`, `reconstruct`; `Indexing.outerAddressEquiv` | Left-acting ordered deltas recover the state exactly; 720 addresses correspond to 12 teeth × 60 local frames. |
| 4: inverse middle layer | `Algebra.inverse_delta_update`, `inverse_chain_reconstruct` | Inverse-oriented updates use the correct noncommutative order. Storing an inverse alone is not a physical cancellation theorem. |
| 5: inner addresses | `Indexing.innerTooth`, `innerPhase` | Finite tooth indices and exact rational phases. |
| 6: projections and lifts | `Indexing.outerToMiddle`, `middleToInner`, lift theorems | Floor projections, ceiling lifts, ranges, monotonicity, surjectivity, and retractions. |
| 7: first offload / Proposition 2 | `Algebra.outer_to_middle`; `System.middle_exact` | Every ten-increment product telescopes, then its inverse is stored. |
| 8: second offload / Proposition 3 | `Indexing.middle_blocks_*`, `middle_block_card*`; `Algebra.reblock`; `System.second_offload_total` | Disjoint covering blocks of sizes `[8,7,7,7,7,8,7,7,7,7]`; flattening preserves chronological noncommutative order. |
| 9: reconstruction / Proposition 4 | `Quaternion.lift_eq_exp`, `lift_reconstruct`; `System.outer_endpoint_exact`, `middle_endpoint_exact`; `Drift` | Actual quaternion exponential/logarithm, branch choice including −1, all positive-order root identities, endpoint recovery, and quantitative chordal error bounds. |
| 10: Markov pump / Lemma 5 | `Markov.stationary_cycle_currents`, `pump_iff_positive_current`, `forwardPump_*`, tree-weight theorems | Equal stationary currents; positive circulation; an exact stochastic witness; current sign via forward/reverse cycle products; finite evolution preserves probability. |
| 11: normalization and holonomy | `Quaternion.normalize_unit`; `Holonomy.close_inner`, `close_distributed`, `close_weighted`; `System.controlled_closure` | Nonzero normalization and unit preservation; exact corrected closure with transported factors. Raw offload data and controller corrections remain distinct. |
| 12: inward folding | `System.orientation`, `folding_signs`, typed pipeline | The documented finite sign pattern `(+,−,+)` is explicit. The schematic recursion supplies no unspecified infinite-scale dynamics. |
| 13: full procedure | `System.full_system_correct` | One certificate tying storage, both offloads, a stationary positive-current Markov witness, controlled closure, normalization, and upward block endpoints to each finite input. |
| 14: sparsemax interoperability | `Interop` | Rational quaternion embedding, rational stochastic/parity certificates, finite-step invariants, emitted deltas, a 64-state/12-channel interface, and certified reentry. Companion kernel formulas are explicit external inputs. |
| 15: scope and missing global claims | `Drift`, `Counterexamples`, this README | Exact local and end-to-end contracts; information-loss and holonomy counterexamples rule out unjustified stronger interpretations. |

Module names in this table are relative to `TorsionalPump`. The source files
give precise theorem signatures and hypotheses. Generic algebra results apply
to any group; `System` specializes them to actual unit quaternions.

## Corrections needed before a literal proof is possible

1. **Initial indexing.** The paper specifies states 0 through 719 but uses a
   delta at 0 that refers to frame −1. This development uses increments `k`
   from `q k` to `q (k+1)`. Block `m` spans states `10m` through `10m+10`.
   The physical range is `m<72`, with states through 720. The generic stream
   extension outside that range is only a proof convenience.
2. **Inverse order.** If `Dₘ=qₘ₋₁ qₘ⁻¹`, the reconstruction is
   `qₘ=Dₘ⁻¹ … D₁⁻¹ q₀=(D₁ … Dₘ)⁻¹q₀`. Inverting the opposite ordered
   product is generally false. `Counterexamples` contains exact witnesses.
3. **Upward orientation and weights.** The middle stores `Dₘ=Bₘ⁻¹`.
   Recovering an outer block therefore requires a root of `Dₘ⁻¹`.
   Inner blocks use the reciprocal of their actual size, 7 or 8. Endpoint
   exactness at each interface does not imply recovery of the original outer
   trajectory from only the ten inner aggregates.
4. **Information loss.** Two different fine histories can have the same
   ordered net rotation. `Counterexamples.no_exact_first_frame_decoder`
   proves that no decoder can recover all first frames from two-step net
   products. `Algebra.residual_decode` shows how retaining per-step residuals
   enables exact recovery. Without those residuals, `Drift` bounds error and
   proves exact block endpoints, not arbitrary interior frames.
5. **Holonomy correction.** Multiplying each gear by `exp(−λ log H)` does
   not generally close a noncommutative cycle, even when the weights sum to
   one. Correct factors must be transported into the reference frame of the
   layer receiving them. Applying a full correction to every delta also
   overcounts it. Exact rational counterexamples cover both failures.
6. **Raw data versus control.** The raw second offload preserves the middle
   net: `Q₈=Q₁₀`, hence raw `H=Q₁₀ Q₁₀ Q₁₂`. Closure is an additional
   control operation. `System` stores that correction separately instead of
   claiming that modified inner data remain the unchanged compression output.

The quaternion angle in `axisAngle u t` is `t`; the associated spatial rotation
angle is `2t`. Quaternion equality here distinguishes `q` and `−q`. The metric
in `Drift` is the chordal metric on the quaternion sphere, with two-sided
invariance proved from quaternion norm multiplicativity. It is not silently
replaced by a sign-quotiented spatial-rotation metric.

## What the global theorem means

For every finite input history, `System.full_system_correct` constructs a
certificate for the corrected mathematical pipeline. The Markov component uses
a proved concrete kernel with holding probability `9/20`, forward probability
`1/2`, reverse probability `1/20`, uniform stationary distribution, and common
current `3/20`. This is a valid circulation witness independent of the input
history. It is not a derivation of that Markov law from quaternion mechanics.

The interoperability module proves a contract for a supplied rational lattice
and kernel. Shared state space and current notation do not establish coarse
Markov lumpability, the companion sparsemax construction, hardware operation,
energy efficiency, or a physical memory capacity. No convergence of the paper's
unmodified holonomy controller is assumed or claimed. Real-valued lifts use
classical branch choice; this is a mathematical specification, not a certified
floating point implementation.
