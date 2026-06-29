# The Polycentria Dual-Helix System of Governance

**Rename.** What earlier papers called the *Schism* Dual-Helix is renamed the
**Polycentria Dual-Helix**. (The organization name *Schism Labs* is unchanged — only the
governance-model name moves.) "Polycentria" — many centers — is the better name precisely
because of the plan to **nest these systems inside each other**: polycentric governance,
in the Ostrom sense, is many overlapping decision centers, each locally authoritative,
composed into a whole. That is exactly the shape of nested Dual-Helices.

## One governance cell

Every cell is two strands:

- **Helix A — the oracle.** Heuristic, fast, geometric. It *proposes* candidates. It is
  never trusted, and it may be wrong.
- **Helix B — the certifier.** Exact, deterministic. It *decides* by an exact check
  (GCD, route value, parity, …). Its correctness does **not** depend on Helix A.

The invariant proved across this repo (the factoring bench's Thm 5.1, the router's exact
route value, the codec's exact section boundaries): **the certifier is exact and
independent of the oracle.** A reported result is always correct, whatever the oracle did.

## Why nesting is sound (and where it isn't)

Because each certifier is locally authoritative on its own exact check, cells compose
without ever putting correctness at risk:

- an **oracle can itself be a Polycentria cell** — a sub-helix that proposes candidates
  via its own oracle+certifier (e.g. the Router's oracle drawing on the Engram codec's
  compressed memory as an inner proposing system);
- a **certifier can contain sub-certifiers** — hierarchical exact checks, each authoritative
  on its level;
- the **benchmark** already composes the pieces (manifold → packet → memory → oracle →
  certifier); making each layer an explicit cell is the polycentric generalization.

Nesting **never** threatens correctness — errors stay quarantined in the untrusted oracle
strands; every certifier remains globally exact. That is the real payoff of the name.

**The honest caveat, from what we measured.** Nesting *amplifies genuine structure; it
does not manufacture it.* If an inner oracle has no real bias (factoring/ECDLP: measured
ε ≤ 0, because the geometry can't see the hidden mod-p structure), wrapping it in more
cells adds overhead, not power. Nesting compounds advantage only where each layer has real
signal (routing: measured ε ≫ 0, because the objective *is* geometric). So a Polycentria
stack is worth building exactly over problems where the geometry sees the objective — and
the certifier strand keeps it safe to try anywhere.

## Status in this repo

- `Helix_Factorization/` — a Polycentria cell over factoring; oracle bias measured ε ≤ 0 (honest negative).
- `Helix_Router/` — a Polycentria cell over routing; oracle bias ε ≫ 0 (the architecture working).
- `Engram_Codec/` — a memory strand a router-oracle can nest for compressed history.
- `Helix_Benchmark/` — the composed pipeline, step by step, with the live ε contrast.

A concrete *nested* example (Router oracle nesting the codec memory as an inner cell, with
the bias of the whole stack measured) is the natural next build.
