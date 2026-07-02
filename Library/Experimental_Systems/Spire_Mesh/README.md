# Spire Mesh — participant-hosted validation nodes for the Owl Academy

An adaptation study: take the system mechanics of **NeuroMesh**
([github.com/NeuroMesh-ai/neuromesh](https://github.com/NeuroMesh-ai/neuromesh), MIT,
archived 2026-05) — a lightweight P2P AI network with no central server — and re-ground
them in the Academy's own objects (**Major Tome canon, Minor Tome seals, Artifacts, the
S.P.I.R.E. engine**) so that participants can host their own **validation nodes** and the
seal/canon system can come off GitHub Pages + Firebase into a live decentralized network.

This is a design + measured reference implementation, not a deployment. Everything
claimed below is exercised by `spire_mesh.py` (pure stdlib, deterministic, ~37 s) and
captured in `spire_mesh_output.txt`. An interactive walkthrough lives in `index.html`.

---

## 1. What NeuroMesh actually is (analysis)

NeuroMesh is a Python P2P mesh for sharing LLM inference. Its mechanics, stripped of the
AI payload:

| NeuroMesh mechanic | How it works there |
|---|---|
| **Peer identity** | Ed25519 keypair per node; HMAC request signing via a shared `p2p_secret` |
| **Web of Trust** | PGP-like peer vouching — peers sign each other's keys |
| **State sync** | CRDT memory + vector clocks, propagated by a gossip protocol; no single authority |
| **Sharing quota** | Contribution score gates usage: model-hosting 40 % · memory-chunks 30 % · uptime 20 % · reputation 10 %; score `<10 → 1 q/min` … `≥80 → 200 q/min` |
| **Specialist router** | Requests classified into 12 specialties and routed to the best-suited peer |
| **Participant vs private mode** | A node chooses whether its resources join the mesh or stay sovereign-local |

The load-bearing insight: **none of these mechanics care that the payload is AI
inference.** They are a generic recipe for *many untrusted peers converging on shared
state, with contribution-gated access*. The Academy already has the harder half built —
real ECDSA P-256 signatures (`scripts/seal-crypto.js`), an immutable canon
(`scripts/major-tome.js`), a certificate web of trust (`scripts/genesis-registrar.js`),
and a tri-layer consensus model (the S.P.I.R.E. manual). What it lacks is exactly what
NeuroMesh supplies: the *transport and replication layer* that removes the central
server.

## 2. The mapping — NeuroMesh mechanic → Academy object

| NeuroMesh | Spire Mesh adaptation | Existing code it reuses |
|---|---|---|
| Ed25519 node identity | **Minor Tome seal** (ECDSA P-256) as the node's signing instrument; the operator's **Cosmological ID** as its persistent identity | `seal-crypto.js`, `spire-registrar.js` |
| `p2p_secret` HMAC handshake | **CERT/2 certificate chain to a trust anchor** — no shared secret; a peer is admitted to validated gossip if its operator's certificate chain walks back to a genesis Archon | `genesis-registrar.js` (upgraded, see §4) |
| Web of Trust (peer vouching) | The **Genesis Authority tier chain is already a web of trust**: Archon → Instructor certificates, plane-scoped. Vouches feed the reputation term of the score | `GENESIS_AUTHORITY_SYSTEM.md` |
| CRDT memory + vector clocks | **The canon is the easiest CRDT in existence**: `majorTomes` is immutable, so it replicates as a grow-only set (G-Set). Seal `status` is the *only* mutable field → an owner-signed last-writer-wins register (Lamport-stamped). Requests/grants/chronicles are append-only | `major-tome.js`, `minor-tome.js` |
| Gossip protocol | **Hypersim layer**: anti-entropy rounds over content-addressed record digests (fanout 2). Measured: 12 nodes, 160 records, full convergence in **2 rounds** | new (`spire_mesh.py §7`) |
| Sharing quota (40/30/20/10) | **Contribution score**: canon-hosting 40 · validation-work 30 · uptime 20 · web-of-trust reputation 10 → read-quota tiers (endpoints kept from NeuroMesh: `<10 → 1 q/min`, `≥80 → 200 q/min`) | new (`spire_mesh.py §5`) |
| Specialist router (12 schemas) | **Plane router**: unlock/completion requests route to nodes whose operators hold a certificate covering that tome's department (`dept-IV` request → `dept-IV` or `*` certified validators) | `certifiedPlanes` in the registrar |
| Participant vs private mode | **The tri-layer S.P.I.R.E. model, verbatim**: SPIRE Core = the validated replica (participant), Biostrata = sovereign node-local state (private), Hypersim = the sync substrate between them | `Library/SPIRE/SPIRE_Manual.html` |

The last row is why this adaptation is natural rather than forced: the S.P.I.R.E. manual
already describes a three-layer model where a globally verified crystal matrix (Core)
coexists with sovereign local experimentation (Biostrata) over a bidirectional sync
substrate (Hypersim). NeuroMesh's participant/private split is the same shape. We are
not importing a foreign architecture — we are implementing the one the manual promised.

## 3. Anatomy of a Spire Node

```
┌───────────────────────────────────────────────────────────┐
│ SPIRE NODE  (any participant, any tier)                   │
│                                                           │
│  Biostrata (sovereign, never gossiped)                    │
│    quarantine ledger · local chronicle · counters         │
│                                                           │
│  Helix B — VALIDATION PROCESSOR (exact certifier)         │
│    firestore.rules re-expressed as pure functions:        │
│    1 schema check      4 authority check (cert-chain walk │
│    2 signature check     to trust anchor + plane scope)   │
│    3 immutability /    5 seal-status check (recall)       │
│      referential check 6 accept→Core | reject→quarantine  │
│                                                           │
│  SPIRE Core (the validated replica)                       │
│    canon G-Set · seal registry (LWW) · req/grant log      │
│                                                           │
│  Hypersim (transport)                                     │
│    content-addressed gossip · fanout 2 · anti-entropy     │
└───────────────────────────────────────────────────────────┘
```

**Polycentria compliance.** Every record arriving from a peer is a proposal from
**Helix A** — untrusted, possibly hostile. The node's validation processor is
**Helix B** — exact, deterministic, locally authoritative. A record enters SPIRE Core
only after *this node* verified every signature and walked the certificate chain itself.
No node ever trusts another node's verdict; a mesh of such nodes is polycentric
governance in the literal Ostrom sense — many centers, each locally authoritative,
composed into a whole. Quorum here is **verification redundancy, not voting**: 12/12
nodes accept the honest grant because each independently proved it, not because they
counted each other.

**The key structural move: `firestore.rules` is already the validation processor.**
Today the rules file is a declarative gatekeeper in front of one database. Each rule
translates line-for-line into a pure check any node can run:

| firestore.rules today | Spire Mesh validation processor |
|---|---|
| `majorTomes`: create Archon-only, update/delete `false` | canon record must be ECDSA-signed by a seal resolving to ARCHON; conflicting `canonId` → reject (immutable G-Set) |
| `seals`: owner may flip `status` only, no delete | status flip must be signed by the seal's own key, Lamport-newer; recall gossips and invalidates dependent grants everywhere |
| `unlockRequests` / `tomeUnlocks`: tier-gated resolution | 2-of-2 signature check (`UNLOCK-REQ/1`, `UNLOCK-GRANT/1`, byte-identical payload formats) + issuer must resolve to INSTRUCTOR+ on the tome's plane |
| `chronicles`: append-only audit | per-node local chronicle (Biostrata) |
| Firebase Auth + `GENESIS_MASTER_UIDS` | trust-anchor genesis IDs baked into the content-addressed genesis snapshot |

## 4. What must change to survive decentralization (honest findings)

1. **HMAC certificates are forgeable on an open network.** `genesis-registrar.js` signs
   certificates with HMAC-SHA-256 *keyed by the issuer's Cosmological ID* — which is
   public. Today that's safe only because Firestore rules control who may write. On a
   mesh, anyone could mint an "Archon" cert. **Fix (implemented): CERT/2** — identical
   field layout, but the signature becomes ECDSA by the issuer's Minor Tome seal. The
   web of trust becomes cryptographically real. (`spire_mesh.py`, red-owl tests a/b.)
2. **The root of trust moves from a JS file to the genesis snapshot.**
   `GENESIS_MASTER_UIDS` is an array in a GitHub-hosted file — trust currently roots in
   repo write access. In the mesh, the trust-anchor genesis IDs are baked into the
   content-addressed genesis snapshot every node boots from (hash printed in the run
   output). Changing the root is then a visible hard fork, not a quiet commit.
3. **CI validation becomes every node's job.** `validate-canon.mjs` runs in GitHub
   Actions today; the same manifest checks (dept-prefix agreement, `globalIndex` 1..145,
   uniqueness) run inside every node's validation processor instead. GitHub stops being
   the verifier and becomes just one mirror of the content.
4. **Vector clocks are overkill here — say so.** NeuroMesh needs them because its CRDT
   memory is arbitrarily mutable. The Academy's records are content-addressed and almost
   all immutable; a G-Set union plus one owner-signed LWW register (seal status) is the
   whole convergence story. Simpler object model → simpler CRDT.
5. **The Schumann tick needs a tolerance window.** Seals minted in the same 3-hour SWPC
   window share a `tickToken`; nodes must accept tokens from the current *and adjacent*
   window to absorb clock skew (the sim pins one window; production needs ±1).

## 5. Measured results (`spire_mesh_output.txt`)

- **Genesis:** root Archon forged (Cosmological ID via the exact `spire-registrar.js`
  pipeline: SHA-256 → holographic inverse → SHD-CCP 4×4×4 φ-fold → XOR), 12 operator
  seals, 3 plane-scoped CERT/2 certificates, 145-tome canon inscribed (9×9 + 4×16 —
  the real Department I–X / Artifact structure; 145 is prime, every tome required).
- **Convergence:** 12 nodes, fanout 2 → identical SPIRE Core in **2 gossip rounds**.
- **Workload:** a completion claim (student seal) countersigned by a dept-IV Instructor
  (2-of-2, byte-identical payload formats to `seal-crypto.js`) — accepted by **12/12
  independent certifiers**.
- **Red-owl suite, 6/6 contained at every node:** forged-signature Archon cert ·
  self-signed promotion (no path to anchor) · acolyte-signed grant (tier gate) ·
  off-plane grant (dept-I cert cannot sign dept-IV) · tampered canon record with a
  replayed Archon signature · **seal recall propagating and invalidating the earlier
  grant on all 12 replicas** ("send out, then recall validity" survives
  decentralization).
- **Scores/quotas:** in a 12-node full-replication sim every node hosts all 145 canon
  records and does equal validation work, so scores compress into the 86–94 band and
  everyone lands in the top quota tier. Honest read: the 40/30/20/10 rail only
  *differentiates* at scale — when nodes hold partial canon shards, drop offline, or
  freeload. The rail is there for that regime; this sim demonstrates the accounting,
  not the spread.

## 6. Migration path off GitHub/Firebase

| Phase | State | What moves |
|---|---|---|
| **0 (today)** | GitHub Pages + Firestore | rules enforce; CI validates canon |
| **1 — shadow mesh** | Firestore remains authoritative | volunteer nodes replicate `seals`/`majorTomes`/`tomeUnlocks` read-only and independently re-verify every record; discrepancies reported. Zero user-facing risk |
| **2 — dual-write** | writes go to both | browser seals already produce mesh-valid records (same payload formats); CERT/2 re-issuance of existing certificates by the root Archon; genesis snapshot published |
| **3 — mesh-authoritative** | Firestore demoted to one mirror node | quota rail activates; the Major Tome Library and Unlock Console read from any node the user trusts (or their own) |
| **4 — content off GitHub** | lesson HTML content-addressed | `contentPath` gains a content hash; nodes serve lesson bodies like canon records ("store the seed" extends to "store the hash") |

## 7. Honest limitations

- **Sybil resistance is inherited, not solved.** Anyone can spin up acolyte nodes, but
  tier authority comes only from the certificate chain — Sybils can gossip and host,
  never grant or inscribe. Quota scoring limits their read pressure; it does not stop
  identity multiplication. Same posture as NeuroMesh (reputation-weighted, not
  Sybil-proof).
- **No BFT consensus, by design.** Because canonical records are self-certifying
  (signatures + chain), nodes never need to agree on *ordering* — only set membership.
  The one ordering-sensitive object (seal status) is owner-signed LWW. If a future
  object needs global ordering (e.g. transferable artifacts), that's when a real
  consensus layer becomes unavoidable.
- **The sim's keys are deterministic** (seeded, for reproducibility) and its ECDSA is a
  clean-room pure-Python port — correct but not constant-time. Production nodes use the
  platform WebCrypto/PyNaCl primitives, exactly as `seal-crypto.js` does.
- **Artifacts are derived, not stored:** a node computes "Edda holds artifact-IV-1" by
  counting validated completion grants against the canon's cluster structure — 9 grants
  in the cluster → the artifact exists. No new record type needed; that's the Tome
  System's own rule, now checkable by anyone.

## Run

```bash
python3 spire_mesh.py     # ~37 s; deterministic; output captured in spire_mesh_output.txt
```

Pure standard library. `index.html` (open in a browser) walks the architecture and runs
a live in-browser gossip/validation simulation of the mesh.
