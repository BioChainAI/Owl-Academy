# The Discrete-Log Wall — a real ECDLP solver

The honest counterpart to the "Hyperbolic Oracle" simulator. Instead of a movie of a
result, this **actually solves** the elliptic-curve discrete logarithm problem on real
curves — and then shows, by extrapolating the same measured law, exactly why doing it on
a 256-bit curve is infeasible.

## Contents

| file | what it is |
|------|------------|
| `ecdlp_reference.py` | exact, runnable reference: builds genuine prime-order curves over `F_p`, plants `k`, recovers it with **baby-step/giant-step** and **Pollard's rho**, verifies `kG = Q`, measures the `O(√n)` law, and extrapolates to 256-bit. |
| `index.html` | interactive page: the same algorithms in the browser (BigInt), live `k` recovery with step counts, a Pollard-ρ walk visualization, and a field-size slider that makes the √n blow-up visceral. |
| `reference_output.txt` | captured run of the reference. |

## Run the reference

```bash
python3 ecdlp_reference.py
```

Pure standard library, no dependencies (~12s; dominated by `O(p)` point counting at `p≈10⁶`).
It prints, among other things:

- recovery of `k` on a `p≈10⁴` curve by **both** solvers (recovered `k` equals the planted `k`);
- a family of curves from `n≈2⁸` to `n≈2²⁰`, with step counts confirming `steps ≈ c·√n`;
- the extrapolation table: at 256 bits, `√n ≈ 2¹²⁸ ≈ 3.4·10³⁸` operations ≈ **10²² years** at
  10⁹ ops/s — about **10¹² × the age of the universe**.

## The point

Both algorithms are the genuine state of the art for a *generic* curve, and both cost
`O(√n)` in the group order `n`. There is **no known sub-exponential shortcut** on a
well-chosen curve like secp256k1 — and "dimensional lifting", "hyperbolic oracles", or
prime-triplet indexing do not provide one. The wall isn't a missing trick; it's the
square-root law itself, extrapolated honestly. This demo lets you watch a toy version get
cracked in milliseconds and then slide the *same* method straight into impossibility.
