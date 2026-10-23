# Minor Tome Memory Vault

This is a proposed personal memory palace, not a new home for the existing `users/{uid}/minorTomes` signing keys. Hierarchy: library → shelf → book → chapter → memory node. Each level has an immutable owner UID and may link canon metadata without copying institutional progression.

Inputs: validated text notes, safe media references, knowledge-node IDs, optional canon IDs. Outputs: owner-scoped read models for web/graph/scene views. Do not store privateJwk, Ledger Seed, authentication tokens, or executable HTML.

Next slice: emulator-backed create/read/update for a single book and chapter, enforcing same-owner parent and bounded node counts. Then add revisioned saves, archive/reparent policy, export and recovery. Semantic organization and AI assistance remain future features requiring explicit data-sharing design.
