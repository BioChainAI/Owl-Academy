# Helix Factorization — the Dual-Helix Oracle Bench

A correctness-guaranteed test bench for the **Schism Dual-Helix** model from
*"Topological Optimization of Pollard's Rho via Quaternionic Lattices and Soliton
Collapse Manifolds."* It takes the paper's framing at face value and **measures** the
one quantity the whole acceleration claim hinges on — rather than asserting or
dismissing it.

## What the paper gets right (and this bench preserves)

- The exact recurrence `xₙ₊₁ = xₙ² + c (mod N)` stays authoritative.
- **Helix B certification is exact (Thm 5.1):** any factor it reports is a genuine
  factor of `N`, *regardless of how the candidate was proposed*. The bench confirms
  this empirically — fed thousands of arbitrary candidate pairs, it reports **zero**
  false factors.
- Acceleration is framed as *conditional* on a testable **Oracle Bias Hypothesis**
  (the oracle must enrich useful collisions by some `ε > 0`) plus a cost inequality
  (Thm 3.1). That is the right, falsifiable framing — so we test it.

## What it measures (results, not assumptions)

A pair `(i,j)` is a **useful collision** when `xᵢ ≡ xⱼ (mod p)` (so `gcd(xᵢ−xⱼ, N)`
reveals `p`). The bench builds a window of states and compares each oracle's top-K
candidates against a uniform-random baseline:

> **Oracle Bias  ε  =  hit-rate(oracle) − hit-rate(uniform)**

Measured over many semiprimes (run `helix_reference.py`):

- **uniform** sits at the baseline useful-pair density (as it must).
- **value-near** and the **TQF / quaternionic-quadrance** oracle both land at or
  *below* uniform — `ε ≤ 0`. The geometric features are functions of `xᵢ mod N`, which
  carries no information about `xᵢ mod p`; "close mod N" pairs differ by small amounts,
  almost never a multiple of `p`, so they are slightly *less* likely to be useful.

This is a **negative result for these oracles — not a proof of impossibility.**

## The two open gaps (stated honestly)

1. **Oracle Bias `ε > 0`.** No geometric score tested here beats random. If you have a
   candidate ranker that uses only `(window, N)` and achieves measured `ε > 0`, the
   bench will show it. The interactive page lets you paste one in directly.
2. **Sublinear reconstruction.** To certify `(i,j)` you must produce `xᵢ, xⱼ`. Building a
   length-`L` window already costs `L` walk-steps — about what baseline rho spends to
   find the collision outright. The paper's "prime-triplet indexing" does not supply a
   way to random-access `xᵢ` without walking `0…i`; no closed form for iterating
   `x²+c` is known (one would itself break factoring). Checkpointing (used here) trades
   memory for the walk but does not remove it. The bench's work accounting makes this
   wall explicit: with the current oracle Helix costs ~100× baseline.

## On the three supporting mechanisms (the reconstruction gap)

The supporting papers all aim at gap #2 — random access to `xᵢ`. Examined closely, each
proves a valid theorem about a *fixed group action / linear dynamics*, and that theorem
does not transfer to the nonlinear map `x→x²+c`. The single thing they all need is a
**jump-ahead**: compute `xᵢ` in `o(i)` time. `jump_ahead.py` demonstrates the dichotomy
runnably.

- **Telescoping quaternion chains** (*Torsional Markov Memory-Offload Pump*). The
  telescoping identity is real — I verified it exactly in `Proofs/Pump-Verification`. But
  it is an *identity that takes the sequence as input*: to form the deltas `Δqₙ` you must
  already know the states `qₙ, qₙ₋₁`. Aggregating `i` history-dependent rotations still
  costs `O(i)` unless they share closed-form structure (they don't, for `x²+c`). The pump
  paper itself only claims endpoint-exact reconstruction and explicitly disclaims
  sublinear *accumulated* reconstruction.
- **Prime-Triplet Indexing** (*The Hyperbolic Oracle*). Mapping an index `i` to a
  coordinate `(p, p+2, p+6)` is a *relabeling*; it does not compute the *value* `xᵢ`. The
  step "`coordinateᵢ = closed-form(i)` in O(1)" (SHD-CCP Thm 3, step 2) is valid only when
  the dynamics are a fixed group action with closed-form `i`-dependence — true for
  rotations / lattice translations / linear recurrences, **false** for `x²+c`.
- **Halo/Ghost regions** (*SHD-CCP Hyperbolic Lookup Protocol*). Ghost cells (a real HPC
  idea) let you do a *local update given already-known neighbor values*, and validate
  coherence by bitwise AND/XOR. They verify a single transition in O(1); they do not
  conjure states you haven't computed. This is exactly checkpoint + one step — O(stride),
  which the bench already does — not O(1) random access.

The unifying fact (`jump_ahead.py`): jump-ahead **exists and is fast** for `x→ax+b`
(the i-fold map is a 2×2 matrix power, O(log i) — shown reaching i=10⁷ in 32 mults,
exact). For `x→x²+c` the i-fold composition has **degree 2ⁱ** with exploding
coefficients — no closed form — and even the Chebyshev-special `x²−2` stays Θ(i). That
absence of jump-ahead is *why* `x²+c` is the engine of Pollard rho and is tied to the
hardness of factoring. So a sublinear reconstruction can't be cited as a lemma — it would
itself be the whole result.

**This is not a proof of impossibility, and it is not a refusal.** It is a precise
statement of what a working reconstruction must be: a concrete procedure
`xᵢ = g(i, seed)` that is *exact* and *sub-linear*. `certify_reconstructor()` (Python) and
the **reconstruction-oracle panel** (in `index.html`) will test any such `g` you supply —
correctness against the true iterate, and speed against the cost of actually walking.
Exact + sub-linear = the wall is broken. Bring the procedure; the harness will tell the truth.

## Files

| file | role |
|------|------|
| `helix_reference.py` | exact bench: baseline rho, exact certification (Thm 5.1), checkpoint reconstruction, pluggable oracles, Oracle-Bias measurement, work accounting. Pure stdlib. |
| `jump_ahead.py` | the reconstruction crux: jump-ahead works for affine maps (O(log i), exact), the quadratic composition is degree 2ⁱ, the Chebyshev near-miss stays Θ(i); plus `certify_reconstructor()` to test any candidate. |
| `index.html` | interactive bench: factor a semiprime, flood the certifier to see it never lies, **measure ε live** (2σ band), **plug in your own oracle**, watch the reconstruction-cost wall, and **test a reconstruction oracle** for exactness + sub-linearity. |
| `reference_output.txt`, `jump_ahead_output.txt` | captured runs. |

```bash
python3 helix_reference.py
```

## How to push it forward

The architecture is sound and safe; the question is purely empirical. To "proof out"
the optimization you need to move *one* of the two gaps:
- supply an oracle scoring function with **measured `ε > 0`** (paste it into the demo), or
- supply a construction that **reconstructs `xᵢ` in `o(i)`** without walking the prefix.

Either would be a genuine result, and this harness measures it without ever risking a
false factorization. Bring the idea; the bench will tell the truth about it.
