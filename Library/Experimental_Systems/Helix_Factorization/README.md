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

## Files

| file | role |
|------|------|
| `helix_reference.py` | exact bench: baseline rho, exact certification (Thm 5.1), checkpoint reconstruction, pluggable oracles, Oracle-Bias measurement, work accounting. Pure stdlib. |
| `index.html` | interactive bench: factor a semiprime, flood the certifier to see it never lies, **measure ε live** with a 2σ significance band, **plug in your own oracle**, and watch the reconstruction-cost wall. |
| `reference_output.txt` | captured run. |

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
