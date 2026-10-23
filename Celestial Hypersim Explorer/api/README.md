# API design draft

There is no running API in this scaffold. `openapi.yaml` describes a future trusted service contract, not Next.js server routes. Static GitHub Pages cannot host these operations. Choose a reviewed backend (for example Firebase Functions) only during a later integration phase.

| Operation | Proposed endpoint | Policy / behavior |
|---|---|---|
| listCanon | GET /v1/canon | Authenticated academy view; bounded cursor pagination; stable canon IDs, no user fields |
| traverseGraph | GET /v1/graph/{nodeId} | Verify start-node read; maxDepth 0–20 and a total-result cap; filter every node/edge for access |
| createMemoryNode | POST /v1/memory-nodes | UID from verified token; owner-accessible chapter and all references; schema validation; idempotency key |
| saveSimulation | PUT /v1/simulation-states/{stateId} | Owner only; expected revision; deterministic bounded state; reject conflict with 409 |

All future calls use a verified Firebase ID token in Authorization: Bearer, not a Cosmological ID, HMAC certificate, localStorage token, or client tier. A future API must check token issuer/audience/expiry/revocation policy, derive the UID, look up trusted authority, and enforce `architecture/PermissionModel.md`. Firebase public client config is not an administrator credential.

Create/save input excludes ownerUid, tier, timestamps and authority fields. The service creates those from verified context and server time. Reject unknown fields, invalid JSON/content type, oversized bodies and unsafe references. Handle pagination, rate limits, CORS allowlisted origins, safe errors and a request ID. Idempotency keys are scoped to UID + operation and body digest; reusing a key with different content is a conflict. Never echo private notes or tokens into audit logs.

Status semantics: 401 missing/expired/invalid session; 403 denied capability; 404 missing or non-disclosable resource; 409 revision/idempotency conflict; 422 schema/reference failure; 429 rate limit. A successful write includes the authoritative record/revision. Rate limiting, trusted verification, audit persistence, and atomic writes are requirements, not implemented capabilities.
