# Grand Archives archive engine

Current slice: `integrations/owl-academy/catalog.ts` reads the real canon at build time; `services/catalog.ts` implements lexical search and department filtering. The dashboard exposes source records without visiting or editing lessons.

Next: introduce an ArchiveEntry read model whose sourceType is canon, authored-tome, or research, with stable sourceId and provenance. Preserve distinct lifecycle semantics: file canon seats, immutable Firestore Major Tomes and mutable authored tomes are not interchangeable. Index only permitted public/academy metadata. Private memory search remains owner-scoped. No search result awards XP or proves an unlock.

Acceptance: stable IDs across rebuilds, source changes reflected after rebuild, pagination for network-backed sources, accessible empty/error states, and no swallowed permission errors.
