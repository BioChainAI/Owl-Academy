# Existing-system integration report

## Template terminology mapped to Owl Academy

| Template name | Academy implementation / Explorer decision |
|---|---|
| Grand Archive Library / master dashboard | Grand Archives (`Library/Grand_Archives.html`); Explorer Grand Archives module |
| Student / teacher / administrator | Acolyte learning activity / Instructor / Archon; Admin Console also admits Instructors |
| Account ID | Firebase UID; Cosmological ID remains an additional Registrar identity |
| User profile / class | `users/{uid}/profile/main`; school is a learning specialization, department a curriculum plane |
| Courses / lessons | Major Tomes, department halls, canon contentPath; mutable authored `tomes` remain distinct |
| Memory Vault | Minor Tome Memory Vault (new private memory organization, not the existing key-bearing Minor Tome collection) |
| Graph | Tome Knowledge Graph with canonId references; not a second curriculum |
| Observatory constellations | New `skyConstellations`; existing `constellations/{uid}` is the Genesis map |
| Geometry Explorer | Sacred Geometry & Topology; Hyperbolic Systems and research tools are source references |
| Simulation Engine | Hyper-Sim Chambers; Hyper-Sim Topologist is an existing school, not a new privilege |
| roles / permissions collections | Future server-owned authority projection/policy; never duplicate owner-editable Registrar authority |

## Reuse candidates

Build-time read-only canon projection is implemented now. Stable canonId/globalIndex/artifact links retain Academy identity. The Explorer does not assert that a manifest seat has been inscribed into Firestore: the generated Firestore document ID and canonId must be reconciled by a future adapter.

Auth reuse should occur through a reviewed adapter using the existing Firebase project only after approval. Do not bundle-import CDN ES modules from `scripts/firebase/*` into Next.js, initialize a second conflicting app on the same page, or copy hardcoded client configuration into a new environment automatically. A future npm Firebase adapter should use `getApps`/`getApp`, observe actual Auth state, and project the signed-in UID. Same-origin Pages builds can potentially share Firebase persistence; a different host does not automatically share browser sessions. Verify this in a real browser.

Profile reuse is selective: displayName, school, and public-safe learning summaries may be projected with consent. Exclude email unless needed, Ledger Seed, privateJwk, certificate issuance credentials, and raw exported backups. An adapter must cancel subscriptions and clear private state on sign-out or UID change.

Do not reuse `resolveTier` as an authorization source while the documented Registrar weakness remains. Preserve tier vocabulary but gate trusted functions with server-owned authority after separate remediation. The interface `AcademyReadAdapter` deliberately exposes no write methods; its disconnected implementation rejects live reads.

## Curriculum and panel boundaries

Grand Archives archiveIndex, mutable tomes, immutable majorTomes, and the file manifest have different identity and lifecycle semantics. An archive entry records its source type and stable source ID. Importing a lesson must not mark it unlocked or mastered, award Vis/XP, or issue certificates.

New memory books/chapters/nodes refer to canonId without copying or mutating Major Tomes. A memory node can link a concept or observation, but a personal note is not an official completion. Seal signing is a future opt-in operation through a trusted approval service, not an automatic effect of saving notes.

The Explorer shows source paths for the existing Codex, Instructor, Admin, and Unlock panels. It does not iframe them, add navigation links to the Academy, or bypass their guards. Any future deep link must preserve base path, encode spaces, validate the destination, and leave final authorization with the target resource.

## Approval and compatibility

The requested modular target takes precedence over the old single-file guide inside this new subtree. The existing static application is unchanged. Next.js is configured for static export because Pages cannot run server handlers. A live API would need a separately approved Firebase Functions or other service deployment.

See `integrations/IntegrationStrategy.md` for phases, gates, and rollback. No production rules, data migration, account changes, hosting changes, or external writes are part of this scaffold.
