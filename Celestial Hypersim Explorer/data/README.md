# Example data

`examples.json` contains 19 synthetic design examples: 15 future records plus users, profile, role and permission projections. It is test input, not a production seed or actual logged-in session. Sirius and sky groupings are illustrative, with explicit provenance labels.

The dashboard reads the actual public canon from the Academy file at build time instead of using these examples. User memory, real UIDs, email, private seal keys and Ledger Seeds are never imported. Proposed relationship IDs are local fixture IDs; reference integrity is checked in tests where a corresponding record is required.
