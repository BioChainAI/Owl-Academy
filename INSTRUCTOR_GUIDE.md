# Owl Academy — Instructor & Archon Guide

Practical walkthrough for using the Genesis Authority System. For the full
architecture and trust model, see [`GENESIS_AUTHORITY_SYSTEM.md`](./GENESIS_AUTHORITY_SYSTEM.md).

---

## Quickstart

### 1. Sign in & forge your Cosmological ID

1. Sign in via the standard login flow
2. Visit `Registrar.html`
3. Inscribe a ledger seed phrase, pick a lattice space (`ℝ²⁴` recommended)
4. Click **Preview** → **Seal**

You now have an immutable Cosmological ID. By default your tier is **Acolyte**.

### 2. Become an Archon (first-time operator only)

This is the bootstrap path used **once** to designate the first site
administrator. After that, all promotions flow through the Genesis Forge.

1. Open `scripts/genesis-registrar.js`
2. Find your Firebase UID:
   - Open `Codex.html` while logged in
   - Open browser DevTools → Application → IndexedDB → `firebaseLocalStorageDb`
     (or just check `auth.currentUser.uid` in the console)
3. Add your UID to the `GENESIS_MASTER_UIDS` array:
   ```javascript
   export const GENESIS_MASTER_UIDS = [
     "your-firebase-uid-here"
   ];
   ```
4. Commit and deploy
5. Visit `Genesis_Forge.html` → click **Self-Sign Archon Certificate**

You are now an Archon. Your sigil will display the triple-ring crown.

### 3. Mint an Instructor

1. Ask the new Instructor to forge their Cosmological ID via `Registrar.html`
2. They share their Cosmological ID with you (e.g., screenshot from `Codex.html`)
3. You visit `Genesis_Forge.html` and fill out:
   - **Subject Cosmological ID** — their `0x...` ID
   - **Target Tier** — `Instructor`
   - **Dimensional Plane** — e.g. `dept-IV` (Hyperbolic Systems)
4. Click **Forge Certificate**
5. **Download** the certificate JSON or **Copy** it
6. Send the certificate file to the recipient (email, Signal, encrypted gist, etc.)

### 4. Apply a received certificate (recipient)

1. Open `Codex.html`
2. Expand the **Apply Genesis Certificate** panel
3. Paste the certificate JSON
4. Click **Apply**

The page reloads. Your tier updates, your sigil gains the Instructor ring,
and the `→ Instructor Console` link appears.

### 5. Author a tome

1. Open `Instructor_Console.html`
2. Tab: **+ New Tome**
3. Fill in title, description, plane (must match your certified plane),
   body, and status
4. Click **Inscribe Tome to Ledger**

Your tome is now in Firestore at `tomes/{newId}`, stamped with priority
`validated` (Instructor) or `canonical` (Archon).

### 6. Author an artifact

1. First inscribe the constituent tomes (steps 5 above)
2. Tab: **+ New Artifact**
3. Provide the artifact name, domain, plane, and paste the comma-separated
   list of tome IDs that are required
4. Click **Mint Artifact**

---

## Cheat Sheet — Page Map

| You want to… | Open |
|---|---|
| Sign up / log in | `login.html` |
| Forge your Cosmological ID (first-time setup) | `Registrar.html` |
| View your sigil, tier, and progress | `Codex.html` |
| Apply a certificate you received | `Codex.html` → Apply Genesis Certificate |
| Mint a new Instructor or Archon | `Genesis_Forge.html` (Archon-only) |
| Self-bootstrap as Archon (Master Key UID only) | `Genesis_Forge.html` |
| Author tomes & artifacts | `Instructor_Console.html` |
| Browse the public library | `Library/Grand_Archives.html` |

---

## Certificate Delivery Recommendations

Certificates contain:
- The recipient's Cosmological ID (public)
- The HMAC signature (sensitive — anyone holding it can grant the tier to the named subject)

**Delivery channels (best → worst):**
1. In-person device handoff
2. End-to-end encrypted messenger (Signal, etc.)
3. Encrypted email
4. Password-protected ZIP via standard email

Do **not** post certificates in public chat channels, paste them on
forums, or commit them to git. A leaked certificate could be replayed
to elevate the named subject without the issuer's intent — though it
can only ever elevate the **specific subject** whose ID it names.

---

## Revocation

The current implementation has **no built-in revocation mechanism**.
A signed certificate is valid forever for its subject.

If you need to demote an Instructor:

1. Issue a new certificate to the same subject with `tier: "ACOLYTE"` *(not yet
   supported by `applyCertificate` — would require an extension)*
2. Or, as a manual override, edit the user's `registrar/main` document
   directly in the Firebase console to remove the `certificate` and
   `certifiedPlanes` fields. The Firestore rules permit the owner to update
   these fields, so this requires Firebase admin access.

A first-class revocation list is a planned enhancement.

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `Registrar not found` | User hasn't forged Cosmological ID yet | Visit `Registrar.html` first |
| `Certificate subject does not match your Cosmological ID` | Certificate was minted for a different user | Re-issue from Genesis Forge |
| `Issuer cannot mint Instructors` | Acting user is not an Archon | Get Archon certificate first |
| `Your Genesis certificate does not authorize authorship on dept-X` | Plane mismatch | Get a new certificate scoped to that plane |
| `Self-signed certificates only permitted for Master Key UIDs` | Tried to bootstrap without being in the list | Add UID to `GENESIS_MASTER_UIDS` |

---

## What Acolytes Can Still Do

Acolytes are not blocked from learning — they retain full read access to all
tomes (canonical, validated, experimental) and complete the full tome-mastery
path normally. They simply cannot **author** new content.

If an Acolyte wishes to publish their own tome (e.g., as a learning exercise),
that's reserved for a future "Biostrata Submission" feature: it will allow
Acolytes to write `experimental` tomes that are visible but XP-neutral and
clearly marked as un-validated. The tome-authoring module already
priority-stamps content correctly — a future submission UI would simply
expose that path.

---

## See Also

- [`TOME_SYSTEM.md`](./TOME_SYSTEM.md) — The 145-tome mastery progression
- [`GENESIS_AUTHORITY_SYSTEM.md`](./GENESIS_AUTHORITY_SYSTEM.md) — Full trust model and architecture
- [`SPIRE/SPIRE_Manual.html`](./Library/SPIRE/SPIRE_Manual.html) — S.P.I.R.E. Engine documentation

---

*Last updated: 2026-06-18*
