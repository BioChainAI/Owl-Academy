# Future expansion

## Renderers and worlds

Keep scene state independent from Three.js objects. Store IDs, units, transforms, semantic references, schemaVersion and deterministic simulation seed. Rendering adapters own canvas lifetime, GPU resources, camera controls and input; domain services own data validation. Web pages, graph views and future React Three Fiber scenes consume the same access-filtered records. WebGPU is a later capability check with a WebGL/text fallback, not an initial requirement.

Celestial Observatory may evaluate Stellarium Web Engine after licensing and embedding review. Use an authoritative astronomical catalog with version, epoch, frame, units, uncertainty and license. The existing Genesis Constellation Map must never be interpreted as sky coordinates. No ephemeris engine is implemented here.

## Search and AI

Initial search is lexical over public canon metadata. Graph traversal exists as a domain primitive; semantic search needs a separately approved embedding service/index and ACL-aware filtering. Do not send private notes, Ledger Seeds, seal keys, user email, or entire profiles to an AI provider. AI-generated worlds are untrusted proposals: schema validation, size limits, human approval, provenance and sandboxed assets are mandatory before publishing. Never execute generated JavaScript as a scene.

## Persistent collaboration

Prefer per-user draft state first. Before multiplayer, specify server authority, collision/interaction semantics, deterministic tick behavior, conflict resolution, rate limits, presence TTL, abuse handling and deletion/export. Shared education actions (granting access/completion) remain separate from multiplayer movement or personal simulations. Guild membership alone does not confer institutional teaching authority.

## Continuing implementation

Start from the module registry, JSON Schema examples, API operation IDs, source-path evidence, and permission matrix. Implement one vertical slice through emulator persistence, service validation, UI and tests. Update the roadmap status only when the acceptance gate is met. Preserve the legacy site until each integration step is approved.
