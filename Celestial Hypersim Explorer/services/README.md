# Service boundaries

`catalog.ts` is a pure read-only query over projected canon records. `permissions.ts` is a draft policy evaluator with explicit authenticated context and private ownership. Neither file connects to Firebase, performs a write, issues credentials, or enforces a deployed security boundary.

Future services validate request schemas and references, derive identity from a trusted adapter, apply resource policy, then call a persistence port. Do not scatter Firestore SDK calls across UI/scene modules. Distinguish permission failures, disconnected state, missing data and empty results. Privileged changes need authoritative audit and concurrency controls, independently of browser tests.
