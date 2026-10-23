# Domain contracts

`domain.ts` contains the actual Academy tier/department vocabulary, canon projection, draft principal/resource scope and knowledge graph types. `entities.schema.json` describes 15 proposed record types and four safe identity/policy projections using JSON Schema Draft 2020-12, not draft-07.

Every example in `data/examples.json` is synthetic. JSON boundary times are RFC 3339 strings; Firestore Timestamp conversion belongs in an adapter. Additional properties are rejected to prevent accidental key/credential ingestion. Schema validity does not establish authorization, reference existence, parent ownership, numerical scientific accuracy, or safe media contents. Those checks belong in future trusted services/rules and their tests.
