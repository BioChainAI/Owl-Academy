# BioChain Enterprise — the three-tier engram economy

The full system, woven together and runnable: a **64-bit SHD-CCP kernel protocol**
("pseudo-FPGA" packet ABI), **user-authored codexes** (unfolding logic as a closed
instruction set, never code), **generative growth of data manifolds** (predict-then-correct,
lossless by construction), and a **three-tier decentralized mesh** with a two-token economy —
FLUX (the infinite meter) and CRYST (the scarce, compute-backed credit).

It composes three earlier bodies of work: the NeuroMesh adaptation study
(`Library/Experimental_Systems/Spire_Mesh/`), the quaternion delta-chain codecs
(`Engram_Codec`, `Ontological_Codex`), and the Polycentria governance discipline
(oracle proposes / certifier decides — `Library/Experimental_Systems/POLYCENTRIA.md`).

Everything claimed below is exercised by the three modules and captured in their
`*_output.txt` files. `index.html` is the interactive console (kernel designer grid,
live grow→unfold demo, the token loop).

## Run it

```bash
python3 shdccp_kernel.py     # the 64-bit packet ABI          →  8/8 checks
python3 codex_engine.py      # codex VM + growth + scoring    → 11/11 checks
python3 biochain_mesh.py     # the 3-tier economy end to end  → 11/11 checks (~3 s)
python3 pump_clock.py        # pump timing + chiral layer     → 13/13 checks
```

Pure standard library, deterministic, no dependencies. Each module imports the one
below it — kernel → codex → mesh — so the mesh run is the whole system.

## The stack

```
Tier 1  BIOSTRATA (edge — any participant)
        personalized growth: data → SHD-CCP packets → quaternion crystals →
        toroidal chunk placement → bioseed chain + rank-coded residual
        module: codex_engine.py  (grow / unfold)

Tier 2  HYPERSIM (mesh — participant-hosted validation nodes)
        gossip; every node's exact validation processor: seal signatures,
        CERT/2 chain to trust anchors, codex ABI gate, sampled spot-checks,
        geometric sync (holonomy word + Merkle root), value recomputation.
        FLUX meters the work and gates read quota.
        module: biochain_mesh.py  (Node.validate — Helix B)

Tier 3  SPIRE CORE (permissioned governance quorum)
        full lossless replay; twin attunement bench (independent simulation
        receipts that must agree bit-for-bit); crystallization by multi-sig;
        CRYST issuance; the sequenced exchange + compute redemption.
```

## 1. The kernel protocol (`shdccp_kernel.py`)

One packet = one 64-bit word. Field layout fixed by the Kernel Group Design
(Total Allocation: 64 / 64 bits):

| field | width | class | role |
|---|---|---|---|
| Structural Form ID | 4 | HALO | opcode / seed form |
| Parity | 1 | HALO | even parity over the other 63 bits |
| Spin Class | 3 | STANDARD | model order / spin selector |
| Comp. Quaternion | 32 | CORE | 4 × 8-bit exact fixed point (`code/127`) |
| Payload Scale | 16 | STANDARD | uint16 (FP16 view for display only) |
| Frequency ID | 5 | STANDARD | propulsion / selector |
| Amplitude ID | 3 | STANDARD | propulsion / selector |

Determinism rules are protocol law: quaternions are exact fixed-point (no free floats
on the wire; code −128 is forbidden), consensus logic reads the raw integers, and the
parity bit invalidates any single flipped bit (measured: 64/64 caught). A **golden ABI
hash** is printed by the self-test — pin it; any drift in the ABI changes that line.

`crystallize(chunk)` folds any byte chunk into one packet (XOR/rotate, φ-derived
constant) — the bioseed-chain element.

## 2. The codex engine (`codex_engine.py`)

**A codex is a program written in packets** — Form ID is the opcode, and the
instruction set is closed:

| opcode | meaning |
|---|---|
| `FORM 1 GEAR` | chunk size (64..4096) + model order (1..3) |
| `FORM 2 PRIME` | one pretrained model entry — how a codex ships crystallized knowledge |
| `FORM 0 HALT` | end |

No jumps exist → **every codex halts by construction**; predictor work is fuel-metered
on top. Malformed codexes (flipped parity bit, order outside the clamp, unknown opcode)
are rejected at parse, before anything runs — "unfolding logic is configuration, not code."

**Growth is predict-then-correct.** The codex's model predicts each next byte as a
ranked expectation; the shipped residual is the rank stream (Elias-gamma coded).
Unfolding replays the same model — lossless by construction, verified by the holonomy
word (cumulative XOR of the bioseed chain) and the Merkle root. Chunks encode with a
fresh model each (primed only from PRIME entries), so any chunk spot-checks independently.

**Measured** (`codex_engine_output.txt`):

| test | result |
|---|---|
| wiki-structured corpus, prose codex (order 2 / chunk 720) | **value 1.47**, lossless |
| same corpus, generic codex (order 1 / chunk 240) | value 1.07 — customization is measurable |
| entropy corpus | value 0.87 — **no unfolding logic beats entropy** |
| Goodhart attack (dump the corpus into PRIME packets) | value 0.97 < 1.47 — counting seed+codex+residual+chain prices the attack out |
| attunement (400 distilled PRIME entries) on held-out same-domain data | **ε = +56.5 %** residual reduction; amortized value 3.29 over 50 growths |
| attunement on entropy | ε ≈ −0.001 — honest null |
| tampered residual | caught by spot-check and full unfold |
| independent growth runs | bit-identical (golden claim hash) |

The two scoring laws, encoded in `value_score()`:

```
value     = recreated bytes / (seed + codex + residual + bioseed chain)
stability = bit-identical replay across independent runs
```

with codex amortization across the growths it serves (the shared-dictionary network
effect), and held-out evaluation for attunement (so memorization can't masquerade
as insight).

## 3. The mesh + the two tokens (`biochain_mesh.py`)

9 nodes across the three tiers (a root Archon + 2 governor Instructors at Core, 4
mesh validators, 2 edge growers — one hostile). Records: seals, CERT/2 certificates,
codexes, bioseed claims, crystals, transfers. Every gossiped record is an untrusted
proposal; every node certifies it independently.

**FLUX (Token A)** — infinite, non-transferable, a *meter*: increments for validation
work performed, maps to a read-quota tier. It never appears in any record body (the
run asserts this) — it cannot be traded, so it cannot be farmed.

**CRYST (Token B)** — scarce because its backing is scarce. Issuance =
`100 × value × ε`, where both factors are *measured*: value recomputed by every
validator, ε produced by **twin attunement benches run independently on two governor
nodes whose receipts must agree bit-for-bit**. Redemption burns CRYST for posted
compute-seconds. Transfers are the one object needing global order, so they carry a
sequence number signed by a 2-governor quorum — and everyone still verifies.

**Measured** (`biochain_mesh_output.txt`): claim verified 9/9 with per-node sampled
spot-checks in 2 gossip rounds · inflated-value claim, illegal-opcode codex rejected
everywhere · tampered residual caught by sampling at 2/9 nodes and by Tier-3 full
replay with certainty (the honest physics of sampling, printed not hidden) ·
ε = +25.0 % twin-receipt agreement · 36 CRYST issued · sequenced transfer settles
9/9 · double-spend replay and overdraft rejected · 3 s total.

## Honest limitations

- **The rank coder is a reference model**, not a state-of-the-art compressor — the
  point is the *protocol* (closed ISA, counted bytes, sampled verification, measured
  attunement), which is compressor-agnostic. A better predictor slots in as a new
  GEAR mode without touching the economics.
- **Sampling is probabilistic at a single node** (measured: 2/9 caught one tampered
  chunk). Mesh-wide screening plus Tier-3 full replay before crystallization is the
  actual guarantee; a fraud-proof gossip channel is the natural next build.
- **The quorum is permissioned by design** (enterprise posture). CRYST ordering
  trusts the governance tier for *sequencing only* — every node still verifies
  signatures, balances, and sequence numbers itself.
- **ε here is prediction uplift on held-out text.** The full vision's ε is uplift on
  real downstream task batteries run on neuromorphic hardware; this bench is the
  deterministic, receipt-verified template for that, not its replacement.
- **Sybil resistance is inherited from the certificate chain** (Sybils can host and
  meter FLUX at quota-bottom; they cannot crystallize or earn CRYST).

## 4. Pump timing + the chiral layer (`pump_clock.py`)

Logical time is **pump time** — gear counters, never wall clock (the executable
Sparsemax kernel is rational and bit-reproducible, so it is the only clock consensus
may read; the analytic Torsional Trefoil pump stays Biostrata-local). Token:
`PUMP.<cycle>.<sector 0-11>.<middle 0-71>.<inner 0-9>`.

**Measured** (`pump_clock_output.txt`): all 12 π/6 sector boundaries telescope
exactly (edge↔mesh handoffs every tick); the Prop-3 inner gear aligns only at the
half- and full-cycle (**mesh↔core crystallization at ticks 6 & 12**); handoff
detection separates a loaded window from idle noise by ~3×10⁷ ("silence is exact");
arbitrary frames recreate exactly from the nearest tick + ≤59 replay steps (the
Pseudogroup law: no jump-ahead exists, so timing = checkpoint + replay).

**The chiral authentication key system** (decentralization hardening, all measured):
the commutative XOR holonomy is provably **blind to chunk reordering** — the chiral
holonomy (ordered quaternion product) and its mirror catch the same reorder at
Δ 1.77 rad, so chains commit both hands. Handedness (L/R) derives from the *sealed*
Cosmological ID (digest parity — public, deterministic, unpickable after sealing);
the **pairing rule** requires ≥2 opposite-hand attesters (self-attestation is
impossible by type); the genesis snapshot bakes **dual chiral anchors** (an L and an
R party) so single-root capture is structurally impossible. Honest limits: chirality
is structure, not hardness (ECDSA remains the lock); Sybil resistance is still
inherited from the cert chain; two-anchor collusion remains a residual 2-party risk
mitigated by tick-12 anchor rotation and public chronicles.

Full visualization: `pump_timing.html` (gear clock, handoff windows, chiral demo).

## Files

| file | role |
|---|---|
| `shdccp_kernel.py` (+ output) | the 64-bit packet ABI + self-test |
| `codex_engine.py` (+ output) | codex VM, grow/unfold, scoring, attunement bench |
| `biochain_mesh.py` (+ output) | the 3-tier mesh, FLUX/CRYST, exchange |
| `pump_clock.py` (+ output) | pump time, π/6 handoff windows, chiral layer |
| `engram_shard.py` (+ output) | hyperbolic engram compressor sharded across self-sovereign nodes; spire weave; decoupled genesis linkage |
| `index.html` | interactive console: kernel grid, live grow demo, token loop |
| `biochain_console.html` | control panel: grow biochains, shard map, kill/tamper/recreate, prove genesis decoupling |
| `pump_timing.html` | gear clock, handoff windows, tick detection log |
| `chiral_mesh.html` | the chiral key system: chain attack lab, handedness derivation, crystallization chamber, attack gallery |

*Lineage: NeuroMesh (MIT, archived 2026) for the transport recipe · Spire Mesh study
for the validation-node anatomy · Engram Codec / Ontological Codex for the quaternion
delta-chain mathematics · POLYCENTRIA for the governance cell.*
