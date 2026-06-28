# Helix Router — the Dual-Helix architecture where it actually works

The same oracle-proposes / certifier-verifies pattern as the factorization bench, but
pointed at a problem the SHD-CCP geometry is genuinely *suited* to: **learned-heuristic
routing/sequence optimization** over a structured 720-node toroidal manifold. No curves,
no keys — a legitimate combinatorial-optimization engine (beam/policy-guided search with
an exact objective).

## Why this works when factoring didn't

The factorization Oracle Bias was ε ≤ 0 because the embedding couldn't see the hidden
mod-p structure. Here the objective ("best route") **is** a function of the geometric
features the embedding computes — so geometric proximity is a real, useful candidate
filter. Measured (`helix_router.py`):

- **720 "codon voxel packets"** = 12 nested layers × 60, placed on the verified golden
  Clifford torus (exact radii `r1²=(φ+2)/5`, `r2²=(3-φ)/5`); travel cost = quadrance.
- **Routing Oracle Bias ε ≈ +12.4** (many σ) — the geometric oracle decisively beats
  uniform-random route search at equal exact-evaluation budget.
- **Helix B certifies every route value exactly** — the oracle is never trusted blindly
  (same safety discipline as the factoring bench, now to a constructive end).

## On the "compressed past data" (honest)

A visit-frequency **prior distilled from past routes**, stored at 12× compression
(top-48 nodes + 12 layer means), was measured too. Result: **not a significant lift** —
it stays within the 2σ band at every observation level. It shows a clean monotonic trend
(mildly negative when all rewards are seen, rising toward positive as observation gets
sparse), consistent with the principle that a prior only helps when present data is
missing — but it does not clear significance in this regime. Honest read: **the geometry
is the real, large win; the stored history is marginal here** and would need much sparser
observation (or stronger past↔present correlation) to contribute significantly.

## Run

```bash
python3 helix_router.py     # ~16 s; prints ε, the noise/observation sweep, captured in helix_router_output.txt
```

Pure standard library. An interactive visualization of the manifold and the search is a
natural follow-up (not yet built).
