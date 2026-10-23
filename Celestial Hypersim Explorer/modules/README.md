# Module registry and contracts

`registry.ts` is the machine-readable navigation/extension registry. IDs are stable; titles follow Owl Academy vocabulary. Only Grand Archives has a working read-only dashboard; other entries are explicitly planned.

| Module | Owner boundary and inputs | Outputs / next slice | Acceptance before enabling |
|---|---|---|---|
| Grand Archives | archive-engine; file canon projection, future approved archive entries | Search results, source references, module navigation | Search/department filtering, no claims about unlock/completion from file data |
| Minor Tome Memory Vault | memory-vault; verified UID, private hierarchy, optional canon references | Versioned notes/media/graph links | Owner isolation, valid parents, no private seal key ingestion, export/recovery |
| Tome Knowledge Graph | knowledge-graph; visible nodes/edges, canon prerequisites | Bounded traversal and graph/constellation/archive-map read models | ACL-filter every endpoint, cycle-safe traversal, no private-edge leakage |
| Celestial Observatory | observatory; vetted sky catalog, epoch/frame, user observations | Celestial sphere, object detail linked to research | Catalog license, coordinate validation, clear numerical precision and privacy defaults |
| Sacred Geometry & Topology | geometry; bounded typed parameters and Academy references | Pure geometry results, renderer-neutral meshes/metrics | Determinism, units, resource limits and textual alternative; no eval |
| Hyper-Sim Chambers | simulation-engine; scene descriptor, domain data, verified save ownership | Independent scenes, shared read models, versioned personal saves | Revision conflicts, cleanup, deterministic replay, paused/unmounted behavior |

Register new modules with unique ID, name, phase, status, purpose, source and data dependencies. A registry entry is not an entitlement: future launch operations independently check session/resource policy. Module lifecycle will be load → validate → mount → pause → dispose; no module may keep subscriptions or GPU resources after disposal.

Shared contracts are in `schemas/`, future network operations in `api/`, cross-system adapters in `integrations/`, and UI-only state in `ui/store.ts`. No engine should directly import production Registrar signing functions.
