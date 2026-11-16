# Owl-Academy.Github.io
The one stop shop for Geometric emergence knowledge. FREE for all

## System docs
- [Genesis Authority System](./GENESIS_AUTHORITY_SYSTEM.md) — identity, tiers, certificates
- [Tome & Artifact Mastery System](./TOME_SYSTEM.md) — the 145-tome curriculum & artifacts
- [Tome Seal & Canon System](./TOME_SEAL_SYSTEM.md) — minor-tome seals, immutable canon, unlock & completion sign-off
- [Biomesh AI System](./BIOMESH_SYSTEM.md) — grow/certify/trade biochains, free seal-signed transfers, marketplace success scores, Archon console
- [First Explorers & STRIX Overwatch](./STRIX_OVERWATCH.md) — the from-darkness introduction: signal → geometry → SHD-CCP packet → traced biochain → Overwatch certificate (draft 0)
- [Lexicon Explorer](./STRIX_OVERWATCH.md#the-lexicon-explorer-page) — Ezekiel 1:1-9 as a tree lexicon in hyperbolic space: read it, count in it, seal it, send it; the formats LEX/1 and LEXICON/2 (drafts)
- [Celestial Control Panel](./CELESTIAL_CONTROL_PANEL.md) — a Poincaré ball sky explorer: the Sun, the Moon and eight anchors computed for a place and a day, on a depth chart that is this project's reading; a sky can be sealed and rebuilt (draft)

## Checking the Bible quotations
The verse entries of the Lexicon Explorer are King James rows. The repository does not ship the King James text, so the letter-for-letter comparison of those rows with their source is run by hand:

```sh
OWL_KJV_DIR=<folder> node --test tests/unit/ezekiel-lexicon.test.mjs
```

`<folder>` must hold the 66 per-book Project Gutenberg King James files, eBooks #8001 to #8066: one file per book, its name ending in `bibNN10.txt` (`bib0110.txt` to `bib6610.txt`). Without `OWL_KJV_DIR` that one test is skipped with a message and every other test runs. See [STRIX_OVERWATCH.md](./STRIX_OVERWATCH.md#how-the-search-counts-were-made) for the files and the method, and [tests/README.md](./tests/README.md) for the other tests.

## Licence
Code: MIT. Quoted texts belong to their rights holders and are not covered by that licence.
