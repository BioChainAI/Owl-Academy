#!/usr/bin/env python3
"""
Spire Mesh — reference implementation of a decentralized validation-node network
for the Owl Academy seal / canon system.

Adapted from the system mechanics of NeuroMesh (github.com/NeuroMesh-ai/neuromesh,
MIT, archived 2026): P2P nodes, gossip state sync, signature-based peer identity,
web-of-trust vouching, and contribution-scored sharing quotas — re-grounded in the
Academy's own objects:

    Cosmological ID  (spire-registrar.js)  -> node + operator identity
    Minor Tome seal  (seal-crypto.js)      -> node signing instrument (ECDSA P-256)
    Genesis cert     (genesis-registrar.js)-> web of trust (upgraded HMAC -> ECDSA)
    Major Tome canon (major-tome.js)       -> replicated immutable G-Set
    2-of-2 unlock    (seal-crypto.js)      -> the validation workload of the mesh
    firestore.rules                        -> each node's exact validation processor

Polycentria framing: every peer that gossips a record is Helix A (an untrusted
oracle that *proposes*); every node's validation processor is Helix B (an exact
certifier that *decides*). Correctness never depends on the honesty of a peer.

Pure standard library. Deterministic (seeded). Runs headless:

    python3 spire_mesh.py     # captured in spire_mesh_output.txt
"""

import hashlib
import hmac as hmac_mod
import json
import random
import time

RNG = random.Random(0x0417)          # deterministic simulation
TICK_TOKEN = "SCHU.sim-window-0.7.83.2"   # Schumann oracle: deterministic offline fallback


# ────────────────────────────────────────────────────────────────────────────
# 1. ECDSA P-256 — pure-python port of the primitive seal-crypto.js uses.
#    Same curve as the production Minor Tome seals (WebCrypto ECDSA P-256),
#    so a mesh node and a browser seal verify each other's signatures.
#    Nonce k is derived deterministically (RFC-6979 flavoured HMAC) so the
#    whole simulation is reproducible.
# ────────────────────────────────────────────────────────────────────────────

P  = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff
NO = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551
A  = P - 3
B  = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b
G  = (0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296,
      0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5)


def _inv(x, m):
    return pow(x, -1, m)


def _pt_add(p1, p2):
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    (x1, y1), (x2, y2) = p1, p2
    if x1 == x2 and (y1 + y2) % P == 0:
        return None
    if p1 == p2:
        lam = (3 * x1 * x1 + A) * _inv(2 * y1, P) % P
    else:
        lam = (y2 - y1) * _inv(x2 - x1, P) % P
    x3 = (lam * lam - x1 - x2) % P
    return (x3, (lam * (x1 - x3) - y1) % P)


def _pt_mul(k, pt):
    acc = None
    while k:
        if k & 1:
            acc = _pt_add(acc, pt)
        pt = _pt_add(pt, pt)
        k >>= 1
    return acc


def sha256_hex(s):
    return hashlib.sha256(s.encode() if isinstance(s, str) else s).hexdigest()


def keypair(seed_material):
    """Deterministic keypair from seed material (sim only — prod uses CSPRNG)."""
    d = int.from_bytes(hashlib.sha256(b"spire-mesh-key|" + seed_material.encode()).digest(), "big") % (NO - 1) + 1
    Q = _pt_mul(d, G)
    return d, Q


def ecdsa_sign(d, payload):
    z = int.from_bytes(hashlib.sha256(payload.encode()).digest(), "big") % NO
    ctr = 0
    while True:
        kb = hmac_mod.new(d.to_bytes(32, "big"),
                          payload.encode() + ctr.to_bytes(4, "big"), hashlib.sha256).digest()
        k = int.from_bytes(kb, "big") % NO
        ctr += 1
        if k == 0:
            continue
        pt = _pt_mul(k, G)
        r = pt[0] % NO
        if r == 0:
            continue
        s = _inv(k, NO) * (z + r * d) % NO
        if s == 0:
            continue
        return "%064x%064x" % (r, s)


def ecdsa_verify(Q, payload, sig_hex):
    try:
        r, s = int(sig_hex[:64], 16), int(sig_hex[64:], 16)
    except (ValueError, TypeError):
        return False
    if not (0 < r < NO and 0 < s < NO) or Q is None:
        return False
    z = int.from_bytes(hashlib.sha256(payload.encode()).digest(), "big") % NO
    w = _inv(s, NO)
    pt = _pt_add(_pt_mul(z * w % NO, G), _pt_mul(r * w % NO, Q))
    return pt is not None and pt[0] % NO == r


# ────────────────────────────────────────────────────────────────────────────
# 2. Cosmological ID — faithful port of the spire-registrar.js pipeline:
#    ledgerSeed → SHA-256 → holographic inverse (byte ‖ ¬byte, 32→64)
#    → SHD-CCP 4×4×4 φ-fold → 64-bit geoVector → XOR uid-hash → ID.
# ────────────────────────────────────────────────────────────────────────────

def _expand_holographic(b32):
    return bytes(b32) + bytes(0xFF ^ v for v in b32)


def _shdccp_fold(b64):
    acc = 0
    for x in range(4):
        for y in range(4):
            for z in range(4):
                v = b64[x * 16 + y * 4 + z]
                acc = (acc * 31 + v * (x + 1) * (y + 1) * (z + 1)) & 0xFFFFFFFFFFFFFFFF
    return "%016X" % acc


def cosmological_id(ledger_seed, uid):
    geo = _shdccp_fold(_expand_holographic(hashlib.sha256(ledger_seed.encode()).digest()))
    uid8 = hashlib.sha256(uid.encode()).digest()[:8].hex().upper()
    return "0x%016X" % (int(geo, 16) ^ int(uid8, 16))


# ────────────────────────────────────────────────────────────────────────────
# 3. Canonical payloads — byte-identical to scripts/seal-crypto.js, so records
#    signed by a browser Minor Tome verify unchanged on a mesh node.
#    CERT/2 is the one mesh upgrade: genesis-registrar.js signs certificates
#    with HMAC keyed by the issuer's *public* Cosmological ID — fine when
#    Firestore rules backstop who may write, forgeable-by-anyone on an open
#    network. CERT/2 keeps the exact field layout but the signature becomes
#    ECDSA by the issuer's seal.
# ────────────────────────────────────────────────────────────────────────────

def seal_id_from_pub(Q):
    return "S-" + sha256_hex("%x|%x" % Q)[:24]


def unlock_request_payload(major_tome_id, student_seal_id, tick):
    return "|".join(["UNLOCK-REQ/1", major_tome_id, student_seal_id, tick])


def unlock_grant_payload(major_tome_id, student_seal_id, student_sig, tick):
    return "|".join(["UNLOCK-GRANT/1", major_tome_id, student_seal_id, student_sig, tick])


def cert_payload(issuer, tier, plane, subject, issued_at):
    return "|".join(["CERT/2", issuer, tier, plane, subject, issued_at])


def canon_payload(rec):
    return "|".join(["CANON/1", rec["canonId"], str(rec["globalIndex"]),
                     rec["dept"], rec["artifact"], rec["title"]])


def record_id(kind, body):
    return kind[:2].upper() + "-" + sha256_hex(kind + "|" + json.dumps(body, sort_keys=True))[:20]


TIER_RANK = {"ACOLYTE": 0, "INSTRUCTOR": 1, "ARCHON": 2}
DEPTS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]


# ────────────────────────────────────────────────────────────────────────────
# 4. Identity — an operator (person) and their node share a Genesis identity;
#    the node's Minor Tome seal is its signing instrument.
# ────────────────────────────────────────────────────────────────────────────

class Operator:
    def __init__(self, name, tier="ACOLYTE"):
        self.name = name
        self.uid = "uid-" + name.lower()
        self.genesis_id = cosmological_id("ledger seed of " + name, self.uid)
        self.tier = tier
        self.priv, self.pub = keypair(name)
        self.seal_id = seal_id_from_pub(self.pub)

    def seal_record(self):
        return {
            "sealId": self.seal_id,
            "pubX": "%x" % self.pub[0], "pubY": "%x" % self.pub[1],
            "genesisId": self.genesis_id, "ownerUid": self.uid,
            "status": "active", "lamport": 1, "tickToken": TICK_TOKEN,
        }

    def sign(self, payload):
        return ecdsa_sign(self.priv, payload)


# ────────────────────────────────────────────────────────────────────────────
# 5. The Spire Node — tri-layer, per the S.P.I.R.E. manual:
#      • SPIRE Core  — the validated replica (only records Helix B accepted)
#      • Hypersim    — the transport: content-addressed gossip (G-Set CRDT
#                      union for immutable records; owner-signed Lamport LWW
#                      for the one mutable field, seal status)
#      • Biostrata   — node-local sovereign state (quarantine, chronicle,
#                      contribution counters) — never gossiped
# ────────────────────────────────────────────────────────────────────────────

class SpireNode:
    def __init__(self, name, operator, trust_anchors, uptime=1.0):
        self.name = name
        self.op = operator
        self.trust_anchors = set(trust_anchors)   # genesis IDs from the genesis snapshot
        self.core = {}          # rid -> validated record        (SPIRE Core)
        self.seals = {}         # sealId -> latest seal record
        self.quarantine = []    # (rid, reason)                  (Biostrata)
        self.chronicle = []     # append-only local audit log    (Biostrata)
        self.validations = 0    # contribution counter
        self.uptime = uptime

    # ─── Helix B: the exact validation processor (firestore.rules as code) ──
    def _seal_pub(self, seal_id, require_active=True):
        s = self.seals.get(seal_id)
        if not s:
            return None, "unknown seal"
        if require_active and s["status"] != "active":
            return None, "seal status=%s (validity recalled)" % s["status"]
        return (int(s["pubX"], 16), int(s["pubY"], 16)), None

    def resolve_tier(self, genesis_id, _depth=0):
        """Walk the CERT/2 web of trust back to a genesis-snapshot anchor."""
        if genesis_id in self.trust_anchors:
            return "ARCHON"
        if _depth > 8:
            return "ACOLYTE"
        best = "ACOLYTE"
        for rec in self.core.values():
            if rec["kind"] != "cert" or rec["body"]["subject"] != genesis_id:
                continue
            if self.resolve_tier(rec["body"]["issuer"], _depth + 1) == "ARCHON":
                if TIER_RANK[rec["body"]["tier"]] > TIER_RANK[best]:
                    best = rec["body"]["tier"]
        return best

    def _plane_covers(self, genesis_id, dept):
        if genesis_id in self.trust_anchors:
            return True
        for rec in self.core.values():
            if rec["kind"] == "cert" and rec["body"]["subject"] == genesis_id:
                if rec["body"]["plane"] in ("*", "dept-" + dept):
                    if self.resolve_tier(rec["body"]["issuer"]) == "ARCHON":
                        return True
        return False

    def validate(self, rec):
        """Exact accept/reject. Mirrors firestore.rules semantics, rule by rule."""
        kind, body = rec["kind"], rec["body"]

        if kind == "seal":
            if body["sealId"] != seal_id_from_pub((int(body["pubX"], 16), int(body["pubY"], 16))):
                return False, "sealId is not the public-key fingerprint"
            prev = self.seals.get(body["sealId"])
            if prev:   # status flip: LWW, must be signed by the seal's own key
                if body["lamport"] <= prev["lamport"]:
                    return False, "stale seal version"
                pub = (int(prev["pubX"], 16), int(prev["pubY"], 16))
                pay = "SEAL-STATUS/1|%s|%s|%d" % (body["sealId"], body["status"], body["lamport"])
                if not ecdsa_verify(pub, pay, rec.get("sig", "")):
                    return False, "status flip not signed by seal owner"
            return True, "seal registered" if not prev else "seal status → " + body["status"]

        if kind == "cert":
            pub, err = self._seal_pub(body["issuerSealId"])
            if err:
                return False, "issuer seal: " + err
            pay = cert_payload(body["issuer"], body["tier"], body["plane"],
                               body["subject"], body["issuedAt"])
            if not ecdsa_verify(pub, pay, rec["sig"]):
                return False, "CERT/2 signature invalid"
            if self.seals[body["issuerSealId"]]["genesisId"] != body["issuer"]:
                return False, "issuer seal does not belong to issuer genesis"
            if self.resolve_tier(body["issuer"]) != "ARCHON":
                return False, "issuer does not resolve to ARCHON via trust anchors"
            return True, "cert accepted: %s → %s (%s)" % (body["issuer"][:8], body["tier"], body["plane"])

        if kind == "canon":
            for r in self.core.values():   # immutability: canonId is the anchor
                if r["kind"] == "canon" and r["body"]["canonId"] == body["canonId"]:
                    return False, "immutable canon conflict on " + body["canonId"]
            if not body["canonId"].startswith("dept-%s/" % body["dept"]):
                return False, "canonId/dept prefix disagreement"
            if not 1 <= body["globalIndex"] <= 145:
                return False, "globalIndex out of 1..145"
            pub, err = self._seal_pub(body["archonSealId"])
            if err:
                return False, "archon seal: " + err
            if not ecdsa_verify(pub, canon_payload(body), rec["sig"]):
                return False, "CANON/1 signature invalid"
            if self.resolve_tier(self.seals[body["archonSealId"]]["genesisId"]) != "ARCHON":
                return False, "canon issuer is not an Archon"
            return True, "canon " + body["canonId"]

        if kind == "unlock_req":
            pub, err = self._seal_pub(body["studentSealId"])
            if err:
                return False, "student seal: " + err
            pay = unlock_request_payload(body["majorTomeId"], body["studentSealId"], body["tickToken"])
            if not ecdsa_verify(pub, pay, body["studentSig"]):
                return False, "UNLOCK-REQ/1 signature invalid"
            return True, "request (%s) by %s" % (body["kind"], body["studentSealId"][:10])

        if kind == "unlock_grant":
            spub, err = self._seal_pub(body["studentSealId"])
            if err:
                return False, "student seal: " + err
            ipub, err = self._seal_pub(body["issuerSealId"])
            if err:
                return False, "issuer seal: " + err
            req_ok = ecdsa_verify(spub, unlock_request_payload(
                body["majorTomeId"], body["studentSealId"], body["tickToken"]), body["studentSig"])
            grant_ok = ecdsa_verify(ipub, unlock_grant_payload(
                body["majorTomeId"], body["studentSealId"], body["studentSig"], body["tickToken"]),
                body["grantSig"])
            if not (req_ok and grant_ok):
                return False, "2-of-2 failed (req=%s grant=%s)" % (req_ok, grant_ok)
            issuer_gen = self.seals[body["issuerSealId"]]["genesisId"]
            if TIER_RANK[self.resolve_tier(issuer_gen)] < TIER_RANK["INSTRUCTOR"]:
                return False, "grant issuer lacks Instructor authority"
            tome = next((r["body"] for r in self.core.values()
                         if r["kind"] == "canon" and r["body"]["canonId"] == body["majorTomeId"]), None)
            if tome and not self._plane_covers(issuer_gen, tome["dept"]):
                return False, "issuer not certified for dept-" + tome["dept"]
            return True, "2-of-2 grant verified (%s)" % body["kind"]

        return False, "unknown record kind"

    # ─── Hypersim: ingest (proposals from untrusted peers = Helix A) ────────
    def ingest(self, rec):
        rid = rec["rid"]
        if rid in self.core:
            return False
        ok, why = self.validate(rec)
        self.validations += 1
        if ok:
            self.core[rid] = rec
            if rec["kind"] == "seal":
                self.seals[rec["body"]["sealId"]] = rec["body"]
                if rec["body"]["status"] != "active":
                    self._audit_recall(rec["body"]["sealId"])
            self.chronicle.append(("accept", rid, why))
            return True
        self.quarantine.append((rid, why))
        self.chronicle.append(("reject", rid, why))
        return False

    def _audit_recall(self, seal_id):
        """Recall propagation: a recalled pen invalidates everything it signed."""
        for rid, rec in list(self.core.items()):
            b = rec["body"]
            if rec["kind"] in ("unlock_req", "unlock_grant") and \
               seal_id in (b.get("studentSealId"), b.get("issuerSealId")):
                rec["localStatus"] = "invalidated (seal recalled)"
                self.chronicle.append(("invalidate", rid, "seal %s recalled" % seal_id[:10]))

    def grant_status(self, grant_rid):
        rec = self.core.get(grant_rid)
        if not rec:
            return "absent"
        return rec.get("localStatus", "granted")

    # ─── contribution score (NeuroMesh sharing-quota weights, re-based) ─────
    def score(self, validation_target):
        canon_held = sum(1 for r in self.core.values() if r["kind"] == "canon")
        rep = {"ARCHON": 1.0, "INSTRUCTOR": 0.8, "ACOLYTE": 0.5}[
            self.resolve_tier(self.op.genesis_id)]
        return (40.0 * canon_held / 145.0
                + 30.0 * min(1.0, self.validations / max(1, validation_target))
                + 20.0 * self.uptime
                + 10.0 * rep)


def quota(score):
    """Adapted from NeuroMesh's published endpoints (<10 → 1 q/min, ≥80 → 200 q/min);
    interior steps are ours."""
    for cut, q in ((80, 200), (60, 60), (40, 30), (20, 10), (10, 4)):
        if score >= cut:
            return q
    return 1


# ────────────────────────────────────────────────────────────────────────────
# 6. Record constructors
# ────────────────────────────────────────────────────────────────────────────

def make_record(kind, body, sig=None):
    return {"rid": record_id(kind, body), "kind": kind, "body": body, "sig": sig}


def build_canon_manifest():
    """145 records in the exact Major Tome shape: Depts I–IX 9 tomes / 1 artifact
    each cluster of 9; Dept X 64 tomes / 4 artifacts of 16. 145 is prime."""
    records, gi = [], 0
    for d in DEPTS[:9]:
        for i in range(9):
            gi += 1
            records.append({
                "canonId": "dept-%s/tome-%02d" % (d, i + 1), "globalIndex": gi,
                "title": "Department %s Tome %d" % (d, i + 1), "dept": d,
                "artifact": "artifact-%s-1" % d, "clusterIndex": i,
                "requiredTier": "ACOLYTE", "status": "active",
            })
    for a in range(4):
        for i in range(16):
            gi += 1
            records.append({
                "canonId": "dept-X/a%d-tome-%02d" % (a + 1, i + 1), "globalIndex": gi,
                "title": "Substrate Artifact %d Tome %d" % (a + 1, i + 1), "dept": "X",
                "artifact": "artifact-X-%d" % (a + 1), "clusterIndex": i,
                "requiredTier": "ACOLYTE", "status": "active",
            })
    assert len(records) == 145 and gi == 145
    return records


# ────────────────────────────────────────────────────────────────────────────
# 7. Gossip — anti-entropy rounds over content-addressed digests
# ────────────────────────────────────────────────────────────────────────────

def gossip_round(nodes, fanout=2):
    moved = 0
    for node in nodes:
        peers = RNG.sample([n for n in nodes if n is not node], fanout)
        for peer in peers:
            missing = [rid for rid in node.core if rid not in peer.core]
            # seals first, then certs, then the rest — so verification context
            # arrives before the records that need it (same round, no barrier)
            order = {"seal": 0, "cert": 1}
            for rid in sorted(missing, key=lambda r: order.get(node.core[r]["kind"], 2)):
                if peer.ingest(dict(node.core[rid])):
                    moved += 1
    return moved


def converged(nodes):
    ref = set(nodes[0].core)
    return all(set(n.core) == ref for n in nodes[1:])


# ────────────────────────────────────────────────────────────────────────────
# 8. The simulation
# ────────────────────────────────────────────────────────────────────────────

def main():
    t0 = time.time()
    section = lambda s: print("\n" + "─" * 74 + "\n%s\n" % s + "─" * 74)
    results = []

    def check(name, ok, detail=""):
        results.append((name, ok))
        print("  [%s] %s%s" % ("PASS" if ok else "FAIL", name, (" — " + detail) if detail else ""))

    section("SPIRE MESH — genesis")
    root = Operator("Aldrovanda", tier="ARCHON")           # root Archon (Genesis Master)
    anchors = [root.genesis_id]
    print("  root archon genesis id : %s" % root.genesis_id)
    print("  root seal              : %s" % root.seal_id)
    print("  trust anchors baked into the genesis snapshot replace GENESIS_MASTER_UIDS")

    # operators: 1 archon, 3 instructors, 8 acolytes — 12 nodes
    instructors = [Operator(n, "INSTRUCTOR") for n in ("Bavol", "Ceridwen", "Dagny")]
    acolytes = [Operator(n) for n in
                ("Edda", "Fionn", "Grier", "Hesper", "Iolo", "Jarek", "Kestrel", "Lyra")]
    ops = [root] + instructors + acolytes
    nodes = [SpireNode("node-%02d" % i, op, anchors, uptime=round(RNG.uniform(0.55, 1.0), 2))
             for i, op in enumerate(ops)]
    boot = nodes[0]   # the root archon's node originates the genesis records

    # seals for every operator
    for op in ops:
        boot.ingest(make_record("seal", op.seal_record()))

    # CERT/2 web of trust: root archon certifies the instructors (ECDSA, not HMAC)
    planes = ["dept-IV", "dept-I", "*"]
    for op, plane in zip(instructors, planes):
        body = {"issuer": root.genesis_id, "subject": op.genesis_id, "tier": "INSTRUCTOR",
                "plane": plane, "issuedAt": "2026-07-02T00:00:00Z", "issuerSealId": root.seal_id}
        sig = root.sign(cert_payload(body["issuer"], body["tier"], body["plane"],
                                     body["subject"], body["issuedAt"]))
        boot.ingest(make_record("cert", body, sig))
    print("  seals registered: %d · CERT/2 issued: %d" % (len(ops), len(instructors)))

    section("Inscribe the 145-tome canon (immutable G-Set)")
    manifest = build_canon_manifest()
    for rec in manifest:
        rec = dict(rec, archonSealId=root.seal_id)
        boot.ingest(make_record("canon", rec, root.sign(canon_payload(rec))))
    held = sum(1 for r in boot.core.values() if r["kind"] == "canon")
    check("canon inscribed at boot node", held == 145, "%d/145 records" % held)
    genesis_hash = sha256_hex(json.dumps(sorted(boot.core.keys())))
    print("  genesis snapshot hash  : %s…" % genesis_hash[:32])

    section("Gossip convergence (Hypersim anti-entropy, fanout 2)")
    rounds = 0
    while not converged(nodes):
        rounds += 1
        moved = gossip_round(nodes)
        print("  round %d: %4d records replicated" % (rounds, moved))
        if rounds > 20:
            break
    check("all 12 nodes converged on identical SPIRE Core", converged(nodes),
          "%d records each after %d rounds" % (len(nodes[0].core), rounds))

    section("The workload: request → combine → unlock, validated everywhere")
    student, instructor = acolytes[0], instructors[0]           # Edda, Bavol (dept-IV)
    tome_id = "dept-IV/tome-03"
    req_body = {"majorTomeId": tome_id, "studentSealId": student.seal_id,
                "kind": "completion", "tickToken": TICK_TOKEN,
                "studentSig": student.sign(unlock_request_payload(tome_id, student.seal_id, TICK_TOKEN))}
    req = make_record("unlock_req", req_body)
    grant_body = dict(req_body,
                      issuerSealId=instructor.seal_id,
                      grantSig=instructor.sign(unlock_grant_payload(
                          tome_id, student.seal_id, req_body["studentSig"], TICK_TOKEN)))
    grant = make_record("unlock_grant", grant_body)
    entry = RNG.choice(nodes)          # enters the mesh at an arbitrary node
    entry.ingest(req); entry.ingest(grant)
    while not converged(nodes):
        gossip_round(nodes)
    accepted = sum(1 for n in nodes if grant["rid"] in n.core)
    check("2-of-2 completion grant accepted by independent certifiers",
          accepted == len(nodes), "%d/%d nodes verified both signatures + authority" % (accepted, len(nodes)))

    section("Red-owl suite: every attack is proposed by Helix A, killed by Helix B")

    # (a) forged certificate — random signature bytes
    mallory = Operator("Mallory")
    for n in nodes:
        n.ingest(make_record("seal", mallory.seal_record()))
    body = {"issuer": root.genesis_id, "subject": mallory.genesis_id, "tier": "ARCHON",
            "plane": "*", "issuedAt": "2026-07-02T01:00:00Z", "issuerSealId": root.seal_id}
    forged = make_record("cert", body, "ab" * 64)
    rejected = sum(1 for n in nodes if not n.ingest(dict(forged)))
    check("forged-signature ARCHON cert rejected", rejected == len(nodes),
          "%d/%d nodes: 'CERT/2 signature invalid'" % (rejected, len(nodes)))

    # (b) self-promotion — validly signed, but the chain never reaches an anchor
    body = {"issuer": mallory.genesis_id, "subject": mallory.genesis_id, "tier": "INSTRUCTOR",
            "plane": "*", "issuedAt": "2026-07-02T01:05:00Z", "issuerSealId": mallory.seal_id}
    selfp = make_record("cert", body, mallory.sign(cert_payload(
        body["issuer"], body["tier"], body["plane"], body["subject"], body["issuedAt"])))
    rejected = sum(1 for n in nodes if not n.ingest(dict(selfp)))
    check("self-signed promotion rejected (no path to trust anchor)", rejected == len(nodes))

    # (c) acolyte tries to issue a grant — signatures are genuine, authority isn't
    g2 = dict(req_body, issuerSealId=mallory.seal_id,
              grantSig=mallory.sign(unlock_grant_payload(
                  tome_id, student.seal_id, req_body["studentSig"], TICK_TOKEN)))
    bad_grant = make_record("unlock_grant", g2)
    rejected = sum(1 for n in nodes if not n.ingest(dict(bad_grant)))
    check("acolyte-signed grant rejected (tier gate)", rejected == len(nodes))

    # (d) instructor grants outside their certified plane (Ceridwen: dept-I only)
    g3 = dict(req_body, issuerSealId=instructors[1].seal_id,
              grantSig=instructors[1].sign(unlock_grant_payload(
                  tome_id, student.seal_id, req_body["studentSig"], TICK_TOKEN)))
    off_plane = make_record("unlock_grant", g3)
    rejected = sum(1 for n in nodes if not n.ingest(dict(off_plane)))
    check("off-plane grant rejected (dept-I cert cannot sign dept-IV)", rejected == len(nodes))

    # (e) canon tampering — same canonId, altered title, replayed archon signature
    orig = manifest[20]
    tampered = dict(orig, title="Totally Legitimate Tome", archonSealId=root.seal_id)
    replay_sig = next(r["sig"] for r in boot.core.values()
                      if r["kind"] == "canon" and r["body"]["canonId"] == orig["canonId"])
    rejected = sum(1 for n in nodes if not n.ingest(make_record("canon", tampered, replay_sig)))
    check("tampered canon record rejected (immutability + signature)", rejected == len(nodes))

    # (f) seal recall propagates and invalidates history network-wide
    recall_body = dict(student.seal_record(), status="recalled", lamport=2)
    recall_sig = student.sign("SEAL-STATUS/1|%s|recalled|2" % student.seal_id)
    nodes[3].ingest(make_record("seal", recall_body, recall_sig))
    while not converged(nodes):
        gossip_round(nodes)
    invalidated = sum(1 for n in nodes if n.grant_status(grant["rid"]).startswith("invalidated"))
    check("seal recall invalidates the earlier grant on every node",
          invalidated == len(nodes), "%d/%d replicas flipped" % (invalidated, len(nodes)))

    section("Contribution scores → sharing quota (NeuroMesh 40/30/20/10, re-based)")
    target = max(n.validations for n in nodes)
    print("  weights: canon-hosting 40 · validation-work 30 · uptime 20 · web-of-trust rep 10\n")
    print("  %-8s %-10s %-11s %6s %8s %7s %8s %10s" %
          ("node", "operator", "tier", "canon", "checks", "uptime", "score", "quota/min"))
    for n in nodes:
        s = n.score(target)
        print("  %-8s %-10s %-11s %6d %8d %7.2f %8.1f %10d" %
              (n.name, n.op.name, n.resolve_tier(n.op.genesis_id),
               sum(1 for r in n.core.values() if r["kind"] == "canon"),
               n.validations, n.uptime, s, quota(s)))

    section("Verdict")
    passed = sum(1 for _, ok in results if ok)
    for name, ok in results:
        print("  %s %s" % ("✓" if ok else "✗", name))
    print("\n  %d/%d checks passed · %d nodes · %d records in SPIRE Core · %.1fs"
          % (passed, len(results), len(nodes), len(nodes[0].core), time.time() - t0))
    print("  quarantined proposals across the mesh: %d (all adversarial, all contained)"
          % sum(len(n.quarantine) for n in nodes))


if __name__ == "__main__":
    main()
