# Owl Academy — Biomesh AI System

## Overview

The **Biomesh AI Control Panel** is the school-system deployment of the BioChain
Enterprise engram machinery (`BioChain-AI/BioChain_Enterprise/`): students and staff
**grow** biochains in the Biostrata substrate, **certify** them with their minor-tome
seals, **send/receive them for free**, and rate them in a **marketplace** whose success
score is grounded in measured properties. Archons get a monitoring console over all of
it. Everything is traceable by construction: certifications are recallable seals,
transfers are seal-signed records that are never deleted, and every event is chronicled.

> **Relationship to the experimental stack:** the grow cell (order-2 rank coder,
> 720-byte chunks, kernel-packet crystallization, chiral+mirror weave) is the same
> measured predict-then-correct cell as `codex_engine.py` / `engram_shard.py`, run
> in-browser. The Firestore layer adds identity, ownership, and the marketplace.

---

## Object types

| Object | Collection | Mutability | Who creates | Purpose |
|---|---|---|---|---|
| **Biochain** | `biochains/{chainId}` | listing fields only; ownership moves via accepted transfer | any signed-in user (grower) | the grown chain: one framed SHD-CCP `stream` + leaf-commitment vector + Merkle root + chiral/mirror weave + GROWN/1 certification |
| **Transfer** | `biochainTransfers/{id}` | recipient resolves status once | current owner | free, seal-signed BIOMESH-XFER/1; the lineage spine — never deleted |
| **Codex** | `biomeshCodices/{codexHash}` | **immutable** | any signed-in user | content-addressed personalization seed (GEAR/PRIME/HALT packet program), CODEX/1-sealed; paired to chains via PAIR/1 |
| **Rating** | `biochainRatings/{chainId}_{uid}` | rater may revise own | any signed-in user | utility stars + recreated-ok verdict; one per user per chain (doc-id enforced) |
| **Chronicle** | `chronicles` | append-only | services | audit trail for every grow/list/send/accept/rate |

## Body storage — the SHD-CCP stream (`streamVersion: "shdccp/2"`)

The grown body is **one self-describing SHD-CCP data stream**, not parallel
per-chunk arrays. Each chunk contributes a frame:

```
crystal packet (16 hex = one 64-bit SHD-CCP word) │ residual length (4 bytes) │ residual (rank-coded)
└ form 9 · payload = chunk length · parity bit     └ uint32                     └ variable
```

concatenated into a single `stream` string. The chunk length lives in each
packet's `payload` field, so there is no separate `chunkLens` array to keep
index-aligned, and no array-of-arrays for Firestore to reject. The `crystallize`
packet is **byte-identical to `BioChain-AI/BioChain_Enterprise/shdccp_kernel.py`**
(verified: `crystallize(0..59) = 9841D88D8B003CEA` on both the browser and the
Python reference), so a node and a browser read the same wire format. Only the
`leafHashes` commitment vector remains a flat array — it must stay independently
addressable so a validator can spot-check one chunk's leaf against the Merkle
root without decoding the rest. `verifyIntegrity` recreates the chunks from the
stream and checks, in order: **per-packet parity → per-chunk leaf → rebuilt
Merkle root → chiral weave**. A legacy read path still verifies any older
`streams`/`chunkLens` record.

## Growing a chain further — GROWTH/1 epochs

Published chains are frozen by the rules, so growth mints a **new epoch**:
`extendBiochain(parent, newText)` first recreates the parent **losslessly**
(proving the grower holds the real body, not just its hashes), appends the new
text, and regrows — producing a child chain with `parentChainId`,
`parentMerkleRoot`, `epoch`, `addedBytes`. On publish the grower's seal signs a
second commitment binding parent → child:

```
GROWTH/1 | parentChainId | childChainId | parentMerkleRoot | childMerkleRoot | addedBytes
```

Growth is deterministic (same parent + same added text → same child chainId),
the parent stays frozen and tradable, and `verifyGrowth` checks the epoch seal.
Anyone may extend a public chain — the GROWTH record and lineage make
owner-extensions and third-party forks equally traceable, which is the point.

## Token engrams — the Mind Eye face of a chain

Alongside the lossless archive stream, `growBiochain` crystallizes the text as
**token engrams**: each word token → the TTMPT XOR crystallization from
`Library/Experimental_Systems/Engram_Mind_Eye.html`, ported **verbatim**
(Mulberry32 PRNG, per-character panmagic 8×8 grid seeded `seed*31+charCode`,
XOR accumulation, LSB-first byte packing). A chain's engram packet for a token
is **bit-identical** to `crystallize(token)` on that page (verified in tests:
`GEODESIC → 5c896a4801c9c24c` on both), so `engramStream` can pre-seed the Mind
Eye's Hamming-distance matcher directly — the chain *is* a memory pack for the
familiar. Fields: `engramStream` (16 hex/token), `engramCount`, `engramMeanJ`
(mean torsion flow). The engram layer is derived data: `verifyIntegrity`
recomputes it from the recreated text and rejects any mismatch.

## Codex pairing — CODEX/1 + PAIR/1

A **codex** is the personalization seed for hyperbolic AI systems: the chain's
learned expectations distilled into a packet program in the same closed
instruction set as `BioChain-AI/BioChain_Enterprise/codex_engine.py` — one GEAR
header, top-N **PRIME** entries (order-2 context → byte, count), one HALT.
`deriveCodex(text)` distills it; `parseCodexStream` is the ABI gate (parity +
opcode discipline, enforced before any write). Codices are content-addressed
(`CX-…`), immutable, and sealed:

```
CODEX/1 | codexHash | order | entryCount        (creator signs on publish)
PAIR/1  | chainId   | codexHash                 (chain owner signs to pair)
```

Pairing lives on the chain doc (`pairedCodexHash` + `pairSeal`, owner-updatable
by rule), so **chain + codex travel together through every transfer** — the
recipient gets the memory (engrams) and the personality prior (codex) in one
traceable unit. `verifyPair` checks the pairing seal.

## The Mind Eye — biochains as language seeds (`Biomesh_Mind_Eye.html`)

The familiar is a **retrieval** engine, not a generator (this is the honest
answer to "the BERT system can't give legible responses"). `crystallize(query)`
→ Hamming-nearest key → that key's text. In the original Engram Mind Eye the
keys are a fixed concept library with hand-written responses; here the keys come
from **the user's own biochains**, so the familiar recalls *real recorded
language* — legible by construction, because it was written by a human and
stored losslessly, not generated by a model that hasn't learned to speak.

`biochainToSeeds(chain)` recreates the chain's text and splits it into passages,
each becoming a seed `{ key engram, grid, text, j }`; `matchSeeds(query, seeds)`
returns the Hamming-nearest passages with similarity scores. Three response
modes on the admin page:

- **None (pure retrieval, free/local):** return the nearest recalled passage(s)
  verbatim. Legible because it's the user's real text.
- **API (bring-your-own-AI):** the top-K recalled passages are injected as
  `{{context}}` and the query as `{{query}}` into a fully configurable request
  (endpoint · headers · body template · response dot-path; presets for OpenAI /
  Anthropic / Ollama). The LLM **synthesizes over recalled context** — RAG with
  the biochain as the corpus and engrams as the index. API keys stay in the
  browser, never Firestore.
- **STRIX default:** with no seed loaded, the built-in concept library answers
  by resonance, exactly like the original Mind Eye.

The query field is the **quarantine zone**: input is crystallized and *matched*,
never executed. Honest limit: XOR-of-letters engrams are a coarse bag-of-letters
key — strong for near-duplicate recall, weak for semantics (measured distances
cluster near 32/64 = random). So pure retrieval is best-effort recall; the API
mode is where legible synthesis happens, and the retrieval quality improves as a
grower accumulates more, better-segmented biochains. The engram packets are
bit-identical to `Engram_Mind_Eye.html`, so seeds are portable between the two.

## Certification — GROWN/1

On publish, the grower signs the commitment with their **minor-tome seal**
(`signWithMinorTome`):

```
GROWN/1 | chainId | merkleRoot | weaveChiral | weaveMirror | origBytes
```

Verification (`verifyGrown`) re-derives the commitment from the record itself and
checks the seal block against the public `seals/` registry — so certification is
publicly verifiable, traces to a Genesis identity and tier, and is **recallable**:
recalling the seal invalidates the certification everywhere, instantly (the Tome Seal
System's "send out, then recall validity", applied to grown chains).

## Free transfers — BIOMESH-XFER/1

```
sender  · sendBiochain   → seal-signs  BIOMESH-XFER/1|chainId|fromGenesis|toUid|tick
                           creates transfer doc (status pending, price 0 — RULE-enforced)
recipient · acceptBiochain → verifies the sender's seal block
                           flips transfer to accepted
                           moves ownership + appends the lineage event
```

Rules enforce: only the current owner may create a transfer; `price == 0` always;
only the addressed recipient may resolve it; ownership may only be written **to the
caller** and only with a matching **accepted** transfer for that exact chain
(`lastTransferId` is joined in the rule via `get()`); nothing in these collections is
ever deletable. The transfer collection **is** the lineage — `traceBiochain()` replays
certification + every hop's seal + a full client-side recreation (leaves, Merkle,
chiral weave) in one call.

## The success score (marketplace rating)

```
success = 40 · min(1, value/2)              measured at grow time (compression value)
        + 25 · verified/ratings             raters who actually recreated the chain
        + 25 · tier-weighted stars / 5      Archon ×3 · Instructor ×2 · Acolyte ×1
        + 10 · min(1, accepted transfers/5) adoption
```

Automatic components (value, integrity) cannot be talked up — they are recomputed
from the record; social components (stars) are tier-weighted and capped at half the
score. Verifying before rating is one click (`verifyIntegrity` runs the full
recreation in the browser).

## The Archon console

`mage_tower/Biomesh_Console.html` — auth-guarded (existing `auth-guard.js`), then
tier-gated: the page resolves the caller's tier via `resolveTier()` and only renders
for **ARCHON** (same client-side pattern as the Genesis Forge, with Firestore rules as
the write backstop). Tabs: **Overview** (mesh stats, certification census, recent
transfers) · **Marketplace** (success-scored chain cards, verify-and-rate, list/unlist)
· **Grow** (Biostrata grow + certify + publish) · **Transfers** (free send, incoming
accept/decline) · **Trace** (full lineage: GROWN/1 + every hop seal-verified +
recreation).

Students participate through the same collections (rules allow any signed-in user to
grow, transfer, and rate); a student-facing marketplace page can reuse
`scripts/biomesh.js` unchanged.

## Files

| File | Role |
|---|---|
| `scripts/biomesh.js` | grow cell (pure) + certify/publish/send/accept/rate/trace services |
| `mage_tower/Biomesh_Console.html` | the Archon-only control panel |
| `firestore.rules` | `biochains` / `biochainTransfers` / `biochainRatings` blocks |
| `BioChain-AI/BioChain_Enterprise/` | the measured reference stack this deploys |

## Trust model

Client-side crypto with Firestore rules as the backstop — the Academy's standing
posture. Rules pin: grower/owner identity on create, free-only transfers, recipient-only
resolution, ownership-moves-only-via-accepted-transfer (joined server-side via `get()`),
and no deletes anywhere. Signatures are real ECDSA minor-tome seals, publicly verifiable
against `seals/`. A dishonest client can lie to itself; it cannot forge a certification,
cannot move ownership without an accepted transfer addressed to it, and cannot erase
history. For stronger guarantees the verification functions are side-effect-free and
ready to port into a Cloud Function gate, matching the note in the Genesis Authority
System.

## Deploy

1. `firebase deploy --only firestore:rules` (adds the three Biomesh collections).
2. Open **Biomesh Console** as an Archon; grow → certify → list.
3. Send a chain to any student UID — free; they accept from any page using
   `acceptBiochain` (or a future student marketplace page).

*Last updated: 2026-07-03*
