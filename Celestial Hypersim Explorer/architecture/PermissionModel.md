# Permission model draft

Existing authority vocabulary: `ACOLYTE` < `INSTRUCTOR` < `ARCHON`. Inheritance applies to learning capabilities, not blanket access to another user's private memory. There is no new “staff” or “admin” tier. XP rank Archon is never an authority source.

| Operation | Anonymous | Acolyte | Instructor | Archon |
|---|---|---|---|---|
| Read checked-in public canon scaffold | Yes | Yes | Yes | Yes |
| Read future private vault | No | Own only | Own only | Own only |
| Read academy-shared resource | No | Yes | Yes | Yes |
| Edit private memory/save | No | Own only | Own only | Own only |
| Author official educational resource | No | No | Certified plane | Certified plane / trusted wildcard |
| Publish immutable canon / manage authority | No | No | No | Certified plane / trusted wildcard |

The first row is static public content and is outside the draft `can()` function. `can()` evaluates authenticated resource actions only. Its `server-verified` input means a future trusted token-verification layer must create the context, not the browser, a profile field, a localStorage value, or the legacy Registrar. Client code can forge any object and cannot enforce this table by itself.

Future policy: verify Firebase token audience/issuer/expiry, resolve current server-owned tier and certified planes (or verified custom claims with revocation strategy), validate request schema, enforce owner/visibility/plane and field immutability, then execute. Firebase rules or a trusted service enforce this independently of the UI. Private vault access is never granted merely because a user is an Instructor/Archon. Explicit sharing is future work.

Role issuance and revocation require Archon authority, an auditable operation, concurrency control, and invalidation of stale contexts. Seal/grant verification includes active key status, issuer authority, bound learner and request context, and replay prevention. The scaffold implements none of these live issuance operations.
