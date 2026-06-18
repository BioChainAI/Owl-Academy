# Owl Academy — Genesis Authority System

## Overview

The Genesis Authority System is a three-tier hierarchical extension of the
[Cosmological Registrar](./TOME_SYSTEM.md). It governs **who may author tomes
and artifacts**, and how the resulting content is **validated and prioritized**
when displayed to readers.

It builds on the S.P.I.R.E. Engine's tri-layer model:

- **S.P.I.R.E. (Consensus)** → Canonical content from Archons
- **Hypersim (Substrate)**   → Validated content from Instructors
- **Biostrata (Sovereign)**  → Experimental content from Acolytes

---

## The Three Tiers

| Tier | Symbol | Creation Rights | Bootstrap |
|---|---|---|---|
| **Acolyte** | (none) | Read-only progression | Default tier after Cosmological ID forge |
| **Instructor** | ⬢ | Author tomes/artifacts on certified planes | Requires Archon-issued certificate |
| **Archon** | ♛ | Mint Instructors and Archons; author anywhere | Self-bootstrapped via Master Key list |

Each tier extends the previous — an Archon is also an Instructor and an Acolyte.

---

## Ledger Seed vs Genesis Seed

| Attribute | Ledger Seed | Genesis Seed |
|---|---|---|
| Required for | Any user (Acolyte) | Instructors and Archons |
| Composition | User-chosen phrase | Ledger Seed **+ Validation Certificate** |
| Produces | Cosmological ID | Cosmological ID + tier + authoring rights |
| Immutability | Sealed once forged | Tier may be elevated, never demoted |

The Cosmological ID **does not change** when a user is promoted. Only the
`certificate` and `tier` fields on the registrar are added.

---

## The Validation Certificate

A certificate is a JSON object cryptographically signed by the issuer's
Cosmological ID via HMAC-SHA-256:

```json
{
  "issuer":   "0xD4AF37F00BA4C0DE",
  "subject":  "0x9F00CAFEDEADBEEF",
  "tier":     "INSTRUCTOR",
  "plane":    "dept-IV",
  "issuedAt": "2026-06-18T00:00:00.000Z",
  "signature": "a1b2c3...e9f0"
}
```

### Fields

| Field | Meaning |
|---|---|
| `issuer` | Cosmological ID of the issuing Archon |
| `subject` | Cosmological ID of the recipient |
| `tier` | `"INSTRUCTOR"` or `"ARCHON"` |
| `plane` | Authoring scope: a department code (`dept-IV`), `custom`, or `*` (universal) |
| `issuedAt` | ISO-8601 timestamp |
| `signature` | HMAC-SHA-256 over `issuer|tier|plane|subject|issuedAt`, keyed by `issuer` |
| `selfSigned` | (optional, bool) — present only on root Archon bootstrap certificates |

### Verification

```
HMAC-SHA-256(issuer, "issuer|tier|plane|subject|issuedAt") == signature
```

If verification fails, the certificate is rejected and the user's effective
tier collapses to `ACOLYTE`.

---

## Bootstrap: Designating Root Archons

The system has a single bootstrap mechanism: the **Genesis Master Key List**.

Edit `scripts/genesis-registrar.js`:

```javascript
export const GENESIS_MASTER_UIDS = [
  "abc123def456ghi789",    // ← your Firebase UID
  "another-archon-uid"
];
```

A user whose Firebase UID appears in this list may visit the
**Genesis Forge** and click **Self-Sign Archon Certificate** to bootstrap
themselves to Archon tier. This is the only path to mint the first Archon —
all subsequent Instructors and Archons inherit their certificate through the
signature chain.

---

## Dimensional Planes

A "plane" is the namespace within which an Instructor can author content.
The built-in planes match the Academy's department structure:

| Plane code | Department |
|---|---|
| `dept-I` | Sacred Geometry & Topology |
| `dept-II` | Cryptography & Sigils |
| `dept-III` | Celestial Topology |
| `dept-IV` | Hyperbolic Systems |
| `dept-V` | Fractal Processing |
| `dept-VI` | Seed Protocols |
| `dept-VII` | Human Consciousness |
| `dept-VIII` | Soul-Mind Projection |
| `dept-IX` | AI-Human Integration |
| `dept-X` | BioChain Substrate |
| `custom` | User-defined parallel plane |
| `*` | Universal (all planes) |

An Instructor certified for `dept-IV` cannot author content on `dept-X`. An
Archon certified with `*` may author anywhere.

---

## Priority Stamping

Every tome and artifact is stamped with a `priority` field at creation time,
derived from the author's tier:

| Author Tier | Priority | Color | UI Behaviour |
|---|---|---|---|
| Archon | `canonical` | Gold | Renders first; awards XP; absolute consensus |
| Instructor | `validated` | Cyan | Renders second; awards XP |
| Acolyte | `experimental` | Magenta | Renders last; **does not** award XP |

When two tomes occupy the same conceptual slot (e.g. a canonical
`Clifford_Torus_Proof` and an experimental fan-written alternative),
the canonical version wins display priority — but both remain visible.

---

## Files

| File | Role |
|---|---|
| `scripts/spire-registrar.js` | Base Cosmological ID forge (Acolyte tier) |
| `scripts/genesis-registrar.js` | Tier resolution, certificate issuance & verification |
| `scripts/tome-authoring.js` | Tome/Artifact CRUD with priority stamping |
| `Registrar.html` | First-time Cosmological ID forge |
| `Codex.html` | View sigil, tier, certificate, apply received certificates |
| `Genesis_Forge.html` | Archon-only console: mint Instructor/Archon certificates |
| `Instructor_Console.html` | Author tomes and artifacts on certified planes |
| `firestore.rules` | Enforces write-once registrar identity + tome/artifact ownership |

---

## Firestore Schema

```
users/{uid}/
  registrar/main
    ledgerSeed          // string, immutable
    cosmologicalId      // 0x... 64-bit hex, immutable
    geoVector, coords, entropy, latticeSpace
    sealed              // true
    tier                // "ACOLYTE" | "INSTRUCTOR" | "ARCHON"
    certificate         // validation certificate (if tier > ACOLYTE)
    certifiedPlanes     // ["dept-IV"] or ["*"]
    certifiedAt         // ISO timestamp

  codex/main
    rank, xp, tomes{}, artifacts[]

tomes/{tomeId}
  title, description, body, dept, plane, status
  creatorUid, creatorGenesisId, creatorTier
  priority             // "canonical" | "validated" | "experimental"
  certificateHash      // first 16 chars of the signing certificate
  createdAt, updatedAt

artifacts/{artifactId}
  name, description, domain, dept, plane
  requiredTomes[]
  creatorUid, creatorGenesisId, creatorTier
  priority
  createdAt
```

---

## Trust Model

This system is **client-side cryptographic** with **Firestore Rules** as the
backstop. The trust chain:

1. Master Key UIDs are hardcoded — only Firebase Auth-verified users on
   that list may self-sign as Archons.
2. Every certificate carries an HMAC signature; tampering breaks verification.
3. Firestore Rules prevent users from rewriting their `cosmologicalId` or
   `ledgerSeed`, so a tier downgrade cannot fake a different identity.
4. Tome and Artifact ownership is enforced by `creatorUid == auth.uid`.

A determined attacker who controls a client could forge any tier on their
local view, but they cannot forge a valid certificate signed by an issuer
they don't possess the key for — and they cannot write content under a
different `creatorUid`. The priority stamping is therefore reliable
**relative to the chain of certificates**, not relative to the client's
honesty.

For a stronger guarantee, port the certificate verification into a Cloud
Function that gates Firestore writes. The current architecture is ready
for that upgrade — the certificate format and verification logic are
already side-effect-free.

---

*Last updated: 2026-06-18*
