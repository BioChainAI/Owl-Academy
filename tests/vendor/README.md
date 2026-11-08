# Vendored test data

Files the tests use that are owned by other repositories. Each is a byte-for-byte copy
(or, for the compat texts, generated data), pinned by SHA-256 in `VENDOR.json`, which also
records the source repository, commit and licence.

| Folder | From | Used by |
| --- | --- | --- |
| `biomesh-compat-v1/` | BioChainAI/Ebayednoob, the Hyperbolic Lexicon's `reference/golden/biomesh_compat_v1.json` and the 13 texts it pins | `tests/unit/biomesh-core.test.mjs`: the texts must give the pinned chainId, Merkle root, value and record SHA-256, engrams off and on |

Notices: `biomesh-compat-v1/texts/11-verb-00.txt` and `12-verb-01.txt` are WordNet 3.0 glosses,
WordNet 3.0 Copyright 2006 by Princeton University, under the licence in
`biomesh-compat-v1/LICENSE-WORDNET.txt`. `biomesh_compat_v1.json` and the eleven generated
texts are relicensed MIT for Owl-Academy by their holder, Ebayednoob (2026-11-08); in
BioChainAI/Ebayednoob they remain GPL-3.0. They hold expected values and generated test data only.

Checks:

```sh
node --test tests/unit/vendor.test.mjs        # offline: every file listed, every SHA-256 matches
node tests/vendor/check-upstream.mjs           # network: notes where upstream has a newer copy (never fails)
node tests/vendor/check-upstream.mjs --local biomesh-compat-v1=../Ebayednoob
```

To refresh a source: copy the new files, update their `sha256` (and the source's `commit`) in
`VENDOR.json`, and run the tests listed under `usedBy`. `.gitattributes` keeps these files'
bytes as they are (no line-ending conversion).
