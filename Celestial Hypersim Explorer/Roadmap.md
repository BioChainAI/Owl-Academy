# Roadmap

| Phase | Deliverable | Acceptance gate | State |
|---|---|---|---|
| 1 · Web dashboard | Real canon search/filter, module/control panel map, domain contracts and reports | Install, tests, typecheck, static build and functional browser smoke; no production coupling | Scaffold implemented; see validation report for checks |
| 2 · Tome Knowledge Graph | Project canon prerequisites + curated relationships; graph/constellation/archive-map views | Cycle-safe bounded traversal, missing-reference handling, keyboard alternative, access-filtered queries | Traversal primitive and design only |
| 3 · Minor Tome Memory Vault | Libraries → shelves → books → chapters → nodes; notes/media references | Emulator-tested ownership, parent integrity, versioned saves, exports and safe media; search respects privacy | Schema/design only |
| 4 · Celestial Observatory | Celestial sphere, vetted star catalog, coordinates/time/site, observations | Catalog license/provenance, numerical tests and accuracy labels, local-only coordinates by default | Design only |
| 5 · Sacred Geometry & Topology | Platonic solids, tessellations, lattices and parameterized computation | Validated bounds, deterministic math, performance budgets, accessible textual results | Design only |
| 6 · 3D archive / Hyper-Sim Chambers | Scene adapters for rooms, observatory and geometric learning | Shared data contracts, no renderer authority, disposal/unmount tests, mobile fallback, schema-versioned saves | Design only |
| 7 · Persistent shared exploration | Opt-in presence, collaboration and reviewed AI-generated proposals | Trusted authority service, conflict/replay/rate controls, privacy, moderation, rollback and operational monitoring | Future |

Before any live role-dependent integration, resolve the documented authority weaknesses in a separately reviewed change. Build and package success alone does not establish a secure production deployment.
