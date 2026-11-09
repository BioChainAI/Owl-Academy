# Vendored test data

Files the tests use that are owned by other repositories. Each is a byte-for-byte copy
(or, for the compat texts, generated data), pinned by SHA-256 in `VENDOR.json`, which also
records the source repository, commit and licence.

| Folder | From | Used by |
| --- | --- | --- |
| `biomesh-compat-v1/` | BioChainAI/Ebayednoob, the Hyperbolic Lexicon's `reference/golden/biomesh_compat_v1.json` and the 13 texts it pins | `tests/unit/biomesh-core.test.mjs`: the texts must give the pinned chainId, Merkle root, value and record SHA-256, engrams off and on |
| `shdccp2-contract/` | BioChainAI/SHD-CCP-core, `contract_vectors/suites/` and `contract_vectors/LICENSE`: the seven RFC 07 suites of main at 150a50f (source `shdccp2-contract`), and six added after it (source `shdccp2-contract-s2`), copied from SHD-CCP-core's commit eaea3ba, not yet merged: `shdccp2_limits`, `engram1_keys`, `rng_mulberry32`, `merkle_rules_same_bytes`, `shdccp2_tamper` and `shdccp2_tamper_open`, all normative (RFC 07 section 17's option (a) for the first failing checks of `shdccp2_tamper_open`). `rfc6962_lists`, `attest1_profile` and the draft `attest1_profile_open` are not copied: `biomesh-core.js` implements none of them | `tests/unit/contract-vectors.test.mjs` (every case through `scripts/biomesh-core.js`) and `tests/unit/biomesh-strict.test.mjs` (the strict verifier accepts every record vector; the leaves through `sha256HexSync`; the tamper vectors' streams through the lax parser); the 24 hypot cases of `shdccp2_arith` are also copied, as values, into `scripts/biomesh-engine-check.js` (the strict audit's engine check), and `tests/unit/weave-engines.test.mjs` checks the copy |

Notices: `biomesh-compat-v1/texts/11-verb-00.txt` and `12-verb-01.txt` are WordNet 3.0 glosses,
WordNet 3.0 Copyright 2006 by Princeton University, under the licence in
`biomesh-compat-v1/LICENSE-WORDNET.txt`. `biomesh_compat_v1.json` and the eleven generated
texts are relicensed MIT for Owl-Academy by their holder, Ebayednoob (2026-11-08); in
BioChainAI/Ebayednoob they remain GPL-3.0. They hold expected values and generated test data only.
`shdccp2-contract/` is CC0-1.0 (its `LICENSE`, decision D5c); only the vector files are copied, none
of SHD-CCP-core's GPL-3.0 code.

Checks:

```sh
node --test tests/unit/vendor.test.mjs        # offline: every file listed, every SHA-256 matches
node tests/vendor/check-upstream.mjs           # network: notes where upstream has a newer copy (never fails)
node tests/vendor/check-upstream.mjs --local biomesh-compat-v1=../Ebayednoob
node tests/vendor/check-upstream.mjs --local shdccp2-contract=../SHD-CCP-core --local shdccp2-contract-s2=../SHD-CCP-core
```

To refresh a source: copy the new files, update their `sha256` (and the source's `commit`) in
`VENDOR.json`, and run the tests listed under `usedBy`. `.gitattributes` keeps these files'
bytes as they are (no line-ending conversion).
