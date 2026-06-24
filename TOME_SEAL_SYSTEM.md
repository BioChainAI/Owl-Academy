# Owl Academy — Tome Seal & Canon System

## Overview

The Tome Seal System adds three things on top of the [Genesis Authority System](./GENESIS_AUTHORITY_SYSTEM.md) and the [Tome & Artifact Mastery System](./TOME_SYSTEM.md):

1. **Minor Tomes** — personal, recallable cryptographic *seals* any user can mint and use to sign lessons, documents, requests, or anything else. Every seal traces back to the owner's Genesis identity.
2. **The Major Tome** — the centralized, **immutable** canon of the **145** department tomes, issued by the root Archon. Each carries a deterministic procedural visual generated from seed data ("store the seed, not the asset").
3. **A request → combine → unlock flow** — students request access to (or claim completion of) a Major Tome; an Instructor/Archon combines seals in a genuine **2‑of‑2** signature and signs it off.

Design pillars: **store the seed not the asset** (procedural, reproducible), **sign don't trust** (real ECDSA signatures, publicly verifiable), and **immutable canon / recallable seals**.

---

## Relationship to existing systems

| System | Provides | This system adds |
|---|---|---|
| [Genesis Authority](./GENESIS_AUTHORITY_SYSTEM.md) | Cosmological ID, tiers (Acolyte/Instructor/Archon), HMAC certificates | the *signing instruments* (minor tomes) and who may unlock/validate |
| [Tome System](./TOME_SYSTEM.md) | the 145‑tome curriculum, Artifacts, XP | the *immutable canon* records + seal‑based unlock/completion |
| `tomes/{id}` (community) | author‑created supplementary tomes (priority) | unchanged — the canon is the **separate** `majorTomes/{id}` collection |

---

## Object types

| Object | Collection | Mutability | Who creates | Purpose |
|---|---|---|---|---|
| **Minor Tome** | `users/{uid}/minorTomes/{sealId}` | recallable (owner) | any tier | personal ECDSA signing instrument (holds the **private** key) |
| **Seal (public)** | `seals/{sealId}` | status‑only (owner) | any tier | verification mirror (holds the **public** key); never deletable |
| **Major Tome** | `majorTomes/{id}` | **immutable** | Archon only | a canonical course record (one of the 145) |
| **Unlock Request** | `unlockRequests/{id}` | status‑only (Instructor+) | student | an access request or completion claim (`kind`) |
| **Unlock Grant** | `tomeUnlocks/{id}` | **immutable** (Archon‑revoke) | Instructor/Archon | the combined 2‑of‑2 sign‑off |

---

## 1. Minor Tomes — the personal seal

A minor tome (`scripts/minor-tome.js`) is the "pen" every user mints in the **Seal Forge** (`mage_tower/Seal_Forge.html`). It exposes three controllable aspects:

1. **Hilbert‑space params** — lattice (`E8` / `R8` / `R24`) + dimension/modulus.
2. **Manifold** — `clifford` / `s3` / `trefoil` + `coherency` (0–1) + `torsion` (0–1).
3. **Schumann timing** — the issuance tick from the oracle (§2).

On mint, an **ECDSA P‑256 keypair** is generated:

- the **private key** is written only to the owner‑only `users/{uid}/minorTomes/{sealId}` doc;
- the **public key** is mirrored to the signed‑in‑readable `seals/{sealId}` registry, alongside the geometric **seal vector** (`deriveSealVector` — an SHD‑CCP fold of `cosmologicalId ‖ params ‖ tick`).

This split is what makes seals **publicly verifiable yet unforgeable**.

**Lifecycle:** `mintMinorTome` → `recallMinorTome` / `archiveMinorTome`. Recall/archive flips the registry `status`, which **instantly invalidates every seal that minor tome ever signed**.

### Signing anything

```
signWithMinorTome(uid, sealId, content) →
  {
    "format": "owl-seal/1",
    "sealId": "S-…",            "genesisId": "0x…",   "ownerUid": "…",
    "sealVector": "…",          "tickToken": "SCHU.…",
    "contentHash": "sha256…",   "sig": "ecdsa…",      "signedAt": "ISO"
  }
```

The signed payload is `SEAL/1 | sealId | sealVector | contentHash | tickToken`.

### Verifying / tracing

`verifySealBlock(block)` (or `verifySealAgainstContent(block, content)`):
1. reads `seals/{sealId}` → public key + status;
2. rejects if status ≠ `active` ("validity recalled");
3. ECDSA‑verifies the signature;
4. returns **who signed it** — `genesisId`, `ownerUid`, `tier`.

---

## 2. The Schumann Oracle — timing

`scripts/schumann-oracle.js` is the timing source for all seals. NOAA does **not** expose a Schumann‑resonance API, so we drive a nominal **7.83 Hz** base and modulate it with NOAA SWPC's real, browser‑fetchable **planetary K‑index**:

```
getTick() → { base: 7.83, freq, kp, amplitude, phase, windowId, token, source, ts }
token = "SCHU.<windowId>.<freq>.<kp>"     // 3-hour SWPC windows; deterministic offline fallback
```

Seals minted in the same geomagnetic window share a `token`, so timing is a shared, auditable cohort. Tick math (`computeTick`, `parseLatestKp`) is pure and unit‑tested.

---

## 3. The Major Tome — immutable 145 canon

The canon (`scripts/major-tome.js`, `majorTomes/{id}`) is **Archon‑create‑only and never editable or deletable**. Structure (sums to 145):

```
Departments I–IX  →  9 tomes each (1 Artifact of 9)   =  81
Department X      →  64 tomes      (4 Artifacts of 16) =  64
                                                  TOTAL = 145
```

### How the Archon issues all 145

The canon is authored as seed data in [`canon/canon.manifest.json`](./canon/canon.manifest.json) and validated by [`canon/canon.schema.json`](./canon/canon.schema.json). The Archon clicks **"Inscribe canon manifest"** in the Unlock Console:

```
inscribeCanon(uid, manifest) →
  validates the manifest (tome-procgen.validateManifest)
  lists existing majorTomes, skips canonIds already present   // idempotent
  createMajorTome(...) for each missing record                 // Archon-stamped, immutable
```

Tooling:
- `tools/scaffold-canon.mjs` — idempotently fills the manifest to 145 with **stable placeholder canonIds** (you fill in *titles* only — the canonId is the immutable seed anchor).
- `tools/validate-canon.mjs` + `.github/workflows/validate-canon.yml` — CI validates the manifest (ajv against the schema, plus uniqueness / dept‑agreement / ≤145 checks) on every push touching `canon/**`.

### Canon record (authored seed data)

```jsonc
{
  "canonId": "dept-III/kinematics-of-the-triple-quad-frame", // STABLE immutable anchor
  "globalIndex": 21,            // 1..145, center→rim seat
  "title": "Kinematics of the Triple-Quad Frame",
  "dept": "III", "artifact": "artifact-III-1", "clusterIndex": 2,
  "requiredTier": "ACOLYTE", "status": "active",
  "prereqs": [], "contentPath": "Library/Department III/.../Kinematics_TQF.html",
  "lattice": "E8", "manifold": "trefoil", "seedOverride": null
}
```

---

## 4. Procedural visuals — store the seed, not the asset

`scripts/tome-procgen.js` is a **pure, dependency‑free, BigInt‑free** engine (ports verbatim to C#/Python). It turns a record into a deterministic visual — nothing rendered is ever stored.

```
seed   = seedOverride || "OWL-TOME/1|<dept>|<artifact>|<clusterIndex2>|<canonId>"
vector64 = generateDeterministicVector64(seed)        // e.g. "82E6800B9540CB87"
packet   = extractSHDCCP(vector64)                    // quaternion + freq/spin/amp/struct/payload
visual   = renderTomeSVG(record)                      // 3 tiers:
             • Tier 1 Hilbert  — globalIndex seat on a 16×16 Hilbert curve
             • Tier 2 Manifold — emergent polygon (struct=symmetry, spin=multiplier, amp=tiers)
             • Tier 3 Sigil    — 8-node weave from the raw bytes + dept palette
```

- **Deterministic & universal:** same record → byte‑identical SVG on any client.
- **Center→rim map:** `globalIndex` seats Dept I innermost … Dept X at the rim, so the constellation reads as difficulty/progression (`goldenSpiralSeat`). `assignGlobalIndices` renumbers in canonical order.
- **Engine version `owl-procgen/2`** — bump only to intentionally re‑skin all 145.

> The 145 share one engine with the admin **Sigil Generator** tool; both consume the same pure functions, so generator and site stay byte‑identical.

---

## 5. The flows — request → combine → unlock

The core mechanism: the student signs with **their** minor tome; an Instructor/Archon signs **over** the student's signature with **theirs**. A valid grant proves **both** combined and records the instructor as issuer. The same machinery serves two intents, distinguished by an immutable `kind` field.

### A. Access (`kind: "access"`) — open a locked tome
```
Student  · Major Tome Library : requestUnlock  → unlockRequests (pending)
Instructor · Unlock Console   : grantUnlock    → verifies student sig, signs over it → tomeUnlocks (granted)
                                isUnlockedFor() = true   →  "Unlocked ✓, signed off by <instructor>"
```

### B. Completion (`kind: "completion"`) — claim you finished a course
```
Student  · Major Tome Library : claimCompletion → unlockRequests (kind:completion, pending)
Instructor · Unlock Console   : "Validate completion" → tomeUnlocks (kind:completion)
                                isCompletedBy() = true  →  "completed — validated by <instructor>"
```

Signed payloads:
```
UNLOCK-REQ/1   | majorTomeId | studentSealId | tickToken            (student signs)
UNLOCK-GRANT/1 | majorTomeId | studentSealId | studentSig | tickToken  (instructor signs OVER it)
```
`verifyUnlockGrant` re‑checks both signatures against the public seal registry → `{ valid, reqOk, grantOk }`.

**Where students reach out:** the **Major Tome Library** is the student request surface; the **Unlock Console** is the Instructor/Archon validation queue (each pending item is chipped *access request* vs *completion claim*).

---

## 6. Firestore schema

```
users/{uid}/minorTomes/{sealId}   // owner-only — holds privateJwk + params + sealVector + tick
seals/{sealId}                    // signed-in read — publicJwk, sealVector, ownerUid, genesisId, status
majorTomes/{id}                   // immutable canon record (+ canonId/globalIndex/dept/artifact/…)
unlockRequests/{id}               // {majorTomeId, studentUid, studentSealId, studentSig, tickToken, status, kind}
tomeUnlocks/{id}                  // {majorTomeId, studentUid, studentSig, issuerUid, issuerGenesisId,
                                  //  issuerTier, grantSig, tickToken, status, kind}
chronicles/{id}                   // append-only audit log (create-only, no reads)
```

---

## 7. Trust model (enforced by `firestore.rules`)

- **Minor‑tome private keys** live only in the owner's space (`users/{uid}/…`).
- **`seals/`** is world‑readable (verification) but only the owner may flip `status` (recall/archive); **no deletes** — preserves traceability.
- **`majorTomes/`** — `create` requires Archon; `update`/`delete` are `false` (true immutability).
- **`unlockRequests/`** — created by the student; only Instructors/Archons may resolve, and only whitelisted status fields (`kind` and signatures cannot be altered after creation).
- **`tomeUnlocks/`** — created by Instructor/Archon; immutable except Archon revoke (status only).
- Signatures are real ECDSA (publicly verifiable); rules prevent writing under another identity or mutating frozen records. Client‑side crypto + Firestore rules backstop — same posture documented in the Genesis Authority System.

---

## 8. Files

| File | Role |
|---|---|
| `scripts/seal-crypto.js` | pure core — seal vector (SHD‑CCP), ECDSA sign/verify, 2‑of‑2 verify |
| `scripts/schumann-oracle.js` | NOAA‑driven 7.83 Hz timing tick |
| `scripts/minor-tome.js` | mint / recall / archive / sign / verify (Firestore I/O) |
| `scripts/major-tome.js` | canon + request / claim / grant / verify / isUnlockedFor / isCompletedBy / inscribeCanon |
| `scripts/tome-procgen.js` | deterministic engine + `renderTomeSVG` + `validateManifest` + `assignGlobalIndices` |
| `canon/canon.schema.json` | JSON Schema for the manifest |
| `canon/canon.manifest.json` | the 145 authored records |
| `tools/scaffold-canon.mjs` | idempotently scaffold the manifest to 145 |
| `tools/validate-canon.mjs` | headless / CI validator |
| `.github/workflows/validate-canon.yml` | CI validation on push |
| `mage_tower/Seal_Forge.html` | mint/recall minor tomes · sign · verify‑trace |
| `mage_tower/Major_Tome.html` | browse canon (with sigils) · request unlock · claim completion |
| `mage_tower/Unlock_Console.html` | Instructor/Archon: combine & sign off · Archon: inscribe canon |

---

## 9. Operating guide

1. **Fill in the 126 placeholder titles** in `canon/canon.manifest.json` (canonIds are frozen; `node tools/scaffold-canon.mjs` keeps it at 145; CI validates).
2. **Deploy the rules:** `firebase deploy --only firestore:rules` (until then the four seal‑system collections aren't governed in production).
3. **Archon inscribes the canon** from the Unlock Console (idempotent).
4. Acolytes mint a minor tome → request/unlock → finish a course → **claim completion** → instructor **validates** — every step seal‑signed and traceable.

---

## Caveats

- **Two deterministic hash engines, by design:** identity uses **SHA‑256** (Cosmological ID, `spire-registrar.js`); tome **visuals** use the generator's fast BigInt‑free **`imul`** hash (`tome-procgen.js`). Different purposes; both reproducible.
- **`lattice` / `manifold` are metadata** in the tome‑visual layer (the sigil is driven by the seed + `globalIndex` + dept palette). They *do* drive the minor‑tome **seal vector** (`seal-crypto.js`). Matches the Sigil Generator exactly.
- **Stronger guarantees:** the verification logic is side‑effect‑free and ready to port into a Cloud Function gate, as noted in the Genesis Authority trust model.

---

*Last updated: 2026-06-24*
