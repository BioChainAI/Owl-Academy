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
