# Firebase boundary

The npm Firebase SDK is installed but not imported/initialized by this scaffold. There is no firebase.json, project alias, credential file, production variable, or deploy script in this subtree. Existing Academy Firebase configuration is not duplicated.

`firestore.rules.draft` is a deny-all design safety boundary, not a complete replacement for root rules. `firestore.indexes.draft.json` proposes isolated-namespace indexes for future owner-scoped queries. Do not deploy either over production as part of scaffolding.

Before implementing persistence, use an explicitly configured emulator project, run authenticated/unauthenticated and cross-user tests, validate immutable owner/plane fields and parent references, and reject writes on missing emulator configuration. Add Storage rules and media validation separately. Then review rules/index composition alongside the existing collections. Schema validation in tests is not a substitute for rules.
