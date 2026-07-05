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

## BioChain Language Growing — biochains as language seeds (`Biomesh_Language_Growing.html`)

*(formerly "Biomesh Mind Eye" — renamed because the page's real purpose is
growing quality language-based seeds from a grower's own biochains, not just
housing a familiar. Ported from and still sibling to
`Library/Experimental_Systems/Engram_Mind_Eye.html`, which keeps its original
name as the standalone reference implementation.)*

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
- **BART (in-browser, `Xenova/bert-base-uncased` via Transformers.js):**
  masked-language-model fill-mask synthesis over the recalled context, run
  entirely client-side. Always logged as **attested**, never reproducible —
  a masked-LM sample is not guaranteed bit-identical on replay.
- **API (bring-your-own-AI):** the top-K recalled passages are injected as
  `{{context}}` and the query as `{{query}}` into a fully configurable request
  (endpoint · headers · body template · response dot-path; presets for OpenAI /
  Anthropic / Ollama). The LLM **synthesizes over recalled context** — RAG with
  the biochain as the corpus and engrams as the index. API keys stay in the
  browser, never Firestore. Also always **attested**.
- **STRIX default:** with no seed loaded, the built-in concept library answers
  by resonance, exactly like the original Mind Eye.

The query field is the **quarantine zone**: input is crystallized and *matched*,
never executed. Honest limit: XOR-of-letters engrams are a coarse bag-of-letters
key — strong for near-duplicate recall, weak for semantics (measured distances
cluster near 32/64 = random). So pure retrieval is best-effort recall; BART and
API modes are where legible synthesis happens, and the retrieval quality
improves as a grower accumulates more, better-segmented biochains. The engram
packets are bit-identical to `Engram_Mind_Eye.html`, so seeds are portable
between the two.

### Auditable chain of thought

Every turn — retrieval, BART, or API — is logged to an in-page **audit ledger**
and hash-chained: each turn's `contentHash` (SHA-256 of query + engine + class
+ context + response) folds into a running `sessionParity` (seeded `0x53484443`
= "SHDC") via `fold32Hex`/`rotl32`, the same lineage pattern as
`Engram_Mind_Eye.html`'s `codexParity`/`packetChain`. Turns are classified
**reproducible** (pure retrieval — bit-for-bit re-derivable on replay) or
**attested** (BART/API — faithfully recorded and hash-chained, but not provably
re-derivable) — this distinction is never blurred. If an operator seal is
selected, every turn is additionally signed (`COT/1|index|contentHash|parity`
via `signWithMinorTome`), so the chain of thought is cryptographically
attributable, not just internally consistent.

- **Export engram** — dumps the full session log (with hashes/signatures) to a
  local JSON file.
- **Crystallize session** — publishes the session as a biochain via
  `publishBiochain`, titled `"Language Growing session " + timestamp`.
- **Verify replay** — re-walks the ledger, recomputing every `contentHash` and
  refolding `sessionParity` from scratch, and flags any turn whose recorded
  hash doesn't match — tamper detection independent of the seal signatures.
- **🔥 Burn session** — destructively clears the local, unexported working
  session (irrecoverable by design — this is a deliberate reset, not a bug).
  Reconciling that with "everything is logged": burning does not erase the
  *fact* that a burn happened. `logSessionBurn(uid, turnCount, parityHex)`
  writes a `biomesh.session_burned` event to the append-only `chronicles`
  collection recording who burned, how many turns, and the final parity hash —
  never the turn content itself. The confirm prompt is strengthened when the
  session has unsaved (unexported/uncrystallized) turns.

### Operator seals as familiars

Any minor-tome seal minted in the Seal Forge can be selected as the page's
**operator seal**. Each seal renders as a unique SHD-CCP sigil
(`renderSealSigil`, `scripts/sigil-renderer.js`) — the same familiar-rendering
engine used for cosmological IDs elsewhere, keyed instead by the seal's own
`sealId` and folded from its `sealVector` into a manifold
(`sealManifoldFromVector`), so every seal a user forges looks visually
distinct. A recalled/archived seal renders with a red broken-ring + strike
overlay, mirroring the Tome Seal System's "recall invalidates everywhere"
guarantee visually. A bottom-right "?" button opens an in-page walkthrough for
minting one, with a link out to the full companion guide,
`Biomesh_Language_Growing_Guide.html`.

## The Mind's Eye — a 3D SHD-CCP lattice forge (`Biomesh_Mind_Eye_3D.html`)

Where Language Growing is the *flat* retrieval surface, the **Mind's Eye** is the
*spatial* one: a first-person, navigable 3D environment (Three.js, FPS +
orbit) rendered over a lattice of tens of thousands of null nodes. You fly the
lattice, click any vertex, and **program it into a real 64-bit SHD-CCP packet** —
the exact canonical word from the "Body storage" section above
(`form·parity·spin·quat32·payload16·freq·amp`), byte-identical to
`crystallize()`/`packWord()` in `scripts/biomesh.js` (the codec is inlined so
the page is a fully standalone mesh node, with the canonical definition still
living in `biomesh.js`). Form drives the vertex's shape, the quaternion its
color, amplitude a `φ^amp` scale, spin a `45°·spin` rotation — a packet you can
*see*.

**Chaining.** Chain mode links programmed packets into ordered paths that render
as glowing polylines and stay glued to their packets as the lattice flows. A
chain is what turns a scatter of vertices into a *lattice system*.

**Raw data → packets.** Any input — UTF-8 text or hex bytes — is chunked into
8-byte groups, each run through the canonical `crystallize()` (a real form-9
word with valid parity), and laid along consecutive vertices, optionally
auto-chained. Data crystallized here is bit-identical to what the Python kernel
would produce, so "any data becomes SHD-CCP packets" in a portable way.

**The seed.** The whole construction crystallizes into one compact, self-describing
**seed**: `{ v, shape, params, count, rngSeed, nodes:[{i,w}], chains:[[i,…]],
hash }`. It stores only what you *created* (programmed packets + chains), keyed
by vertex index — never the empty scaffold — so it stays tiny. Because Box /
Toroid / Cylinder generation is deterministic and the two knot shapes use the
stored `rngSeed`, regenerating `shape+params+count+rngSeed` reproduces the exact
vertex at every index, so index-keyed packets **regrow bit-for-bit**. A
`fold32` hash (SHDC-seeded) fingerprints the canonical serialization; **Verify**
recomputes it and checks every packet's parity, catching any single flipped
character.

**The shared standard / decentralized nodes.** Three layers make a seed portable:
the packet is the canonical 64-bit word; the seed is plain hash-stamped JSON
(Copy / Download `.latticeseed.json` / Load file — regrows offline on any node);
and **Publish** grows the seed string into a biochain via `growBiochain` +
`publishBiochain`, certified by the operator's seal, so it becomes tradable and
traceable like any other biochain — another node fetches it, `recreateText`s the
seed, and regrows the identical lattice. The build/chain/raw-data/seed/regrow
core is 100% offline; publishing is the optional bridge onto the mesh. A "?"
button and info link open the companion guide, `Biomesh_Mind_Eye_3D_Guide.html`.

### The synchronization pump — a torsional Markov "breath"

The Mind's Eye also carries a **synchronization pump** ported from Department V's
`Loom_Weave.html`: a torsional, Markov, one-way "zero-point pump" that drives the
whole substrate through a 720-frame cycle (or any length 12–4320) so **every
programmed SHD-CCP packet interacts with every other**. Each frame at cycle-time
`t = frame/frames`:

1. **Breath** — `breath = 1 + sin(π·t)·amp` pushes every packet radially out from
   the zero-point center and back (one inhale/exhale per cycle); a 4×4×4
   tessellation shell unfolds with it.
2. **Torsional one-way Markov pump** — charge is injected at the innermost packet
   and flows strictly outward, shell by shell (irreversible); inner shells rotate
   faster, twisting the substrate.
3. **Interaction (matrix field)** — any two packets within `reach` couple:
   `coupling = charge × affinity / (1 + Q)`, where `Q` is the quadrance (squared
   distance) and affinity is `1 − hamming(word_a, word_b)/64` over the two 64-bit
   SHD-CCP words. Each coupling adds to both packets' scalar.
4. **Implied-quadrance backprop** — the phase-conjugate return: each shell's scalar
   flows back inward, quadrance-weighted, concentrating toward the zero point
   (matrix field → scalar field).
5. **Render** — packets recolor by scalar, interaction links draw between coupled
   pairs, chains follow the breathing packets.

The cycle is a pure function of the packets + parameters (breath, torsion, reach,
backprop, frames), so it is deterministic: the same setup yields the same
interaction count and scalar field, and the pump emits a `cycleHash` (fold32 of
the scalar field + params) — replayable and verifiable like a seed. **Bake scalar
→ packets** writes the normalized scalar field into each packet's payload, so what
the substrate *learned* from breathing becomes part of the packet word and is
captured by the seed — a regrown lattice on another node already carries the
learned field. Playback is play/pause + deterministic frame scrubbing; the
interaction ledger is exportable. It layers on top of the standalone core (no
backend), reusing the same packets, chains, and 64-bit word codec.

### Codex environments — the FORM split, fold gates, and FLUX/CRYST

The Mind's Eye also supports **codex environments**: small, pre-built starter
areas loaded as the default substrate instead of a blank 40k box, so biochains
grow into something structured (the "house" whose rooms give incoming data
streams a place to belong).

- **The 64-cell seed (the default manifold).** The page opens on the smallest
  possible substrate: one 64-bit SHD-CCP word unfolded into a 4×4×4 cube where
  vertex `i = z·16 + y·4 + x` maps to bit `i` of the seed (set → active Platonic
  solid, clear → 0D point), and every one of the 64 vertices is a full,
  parity-valid packet. It grows **fractally**: level `L` is a `4^L`-per-axis grid
  where a vertex is active only where the seed's pattern is set at every 4× scale
  (self-similar, Cantor-style — 33 set bits → 33² = 1089 active cells at level 2),
  with the rest left as free room; the 4×4×4 base gives four fractal steps to
  unfold from one seed. Re-seeding (or 🎲) re-derives the whole manifold
  deterministically; `fractalLevel` and `seedWord` travel in the seed/environment.
  This is the energy-frugal default — nobody's Mind's Eye is a giant blank box;
  you tessellate up or switch to a larger blank lattice only when a build needs
  the room.

- **FORM split (top bit).** The 4-bit form nibble is split by bit 3: clear →
  **geometry** (`0` 0D point · `1‑5` the five Platonic solids · `6` 4D hypercube
  · `7` 8D E8 lattice); set → **gate** (`8` HALT · `9` SEED · `10` ROT · `11`
  XFOLD · `12` MIRROR · `13` SPLIT · `14` MERGE · `15` LINK). Eight of each, no
  new field. A kernel data-crystal (`crystallize()` → form 9) is disambiguated
  from the SEED gate by a raw-word flag (persisted in the seed as `r:1`), so all
  eight gate slots stay usable and gate/geometry/crystal kinds survive a seed
  round-trip.
- **Fold programs = pseudo-quantum logic gates.** The ordered gate packets form a
  **fold program** run over the cubic expansion grammar `1 → 3 → 7 → 6 → 12 → 64`
  (singularity → axes → pivots → faces → edges → cube-cell, the inverse of the
  pump's collapse). SPLIT advances a tier and spawns children on the next shell
  (bounded by an energy cap); MERGE collapses the outer shell; ROT/XFOLD/MIRROR
  transform and LINK entangles the live cells to the frontier; HALT stops. The
  gate set is closed, bounded, and halting (no jumps), so a fold program always
  terminates with bounded energy — the same safety posture as the codex ABI it
  extends. `runFoldProgram()` is deterministic and emits a hash.
- **`ENVIRONMENT/1`.** One loadable object bundling `{ boundary (a LATTICE-SEED),
  codex (a CODEX/1 GEAR·PRIME·HALT prior), pump params, frontier (growth-edge
  vertex indices), hash }`. The **Boundary designer** authors it (energy-frugal
  size presets, frontier-marking mode, codex attach, build/export); loading it
  rebuilds the boundary, restores the frontier + pump params, and re-binds the
  codex — deterministic (wreck-and-reload reproduces the hash).
- **FLUX / CRYST.** Simulation runs on **FLUX** — the free, infinite meter (breathe,
  fold, iterate; cost is only time, all offline). **CRYST** — the scarce,
  compute-backed credit — is spent only to crystallize a good codex+biochain
  environment up the tiers, and the crystallize action is **gated to the pump's
  crystallization windows** (start / half / full cycle — the tri-gear sync points
  from `pump_clock.py`); outside a window it is refused. When signed in it grows
  the environment into a certified biochain via `publishBiochain`.

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
| `scripts/biomesh.js` | grow cell (pure) + certify/publish/send/accept/rate/trace/session-burn services |
| `scripts/sigil-renderer.js` | familiar SVG engine, extended with `renderSealSigil`/`sealManifoldFromVector` for operator seals |
| `mage_tower/Biomesh_Console.html` | the Archon-only control panel |
| `mage_tower/Biomesh_Language_Growing.html` | BART/biochain/API language-seed growing surface + auditable chain of thought |
| `mage_tower/Biomesh_Language_Growing_Guide.html` | companion how-to guide (seals, sources, engines, ledger, burn) |
| `mage_tower/Biomesh_Mind_Eye_3D.html` | 3D SHD-CCP lattice forge — program vertices, chain packets, crystallize a regrowable seed, and run the torsional Markov "breath" synchronization pump |
| `mage_tower/Biomesh_Mind_Eye_3D_Guide.html` | companion how-to guide (navigation, packet, chains, raw data, seed, shared standard) |
| `firestore.rules` | `biochains` / `biochainTransfers` / `biochainRatings` / `chronicles` blocks |
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
