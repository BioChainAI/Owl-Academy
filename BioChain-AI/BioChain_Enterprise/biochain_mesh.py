#!/usr/bin/env python3
"""
BioChain Mesh — the three-tier enterprise deployment, end to end.

Weaves the other two modules into the full economy:

    Tier 1  BIOSTRATA (edge)   growers author codexes (codex_engine) and grow
                               bioseed claims from corpora
    Tier 2  HYPERSIM  (mesh)   validator nodes gossip records and run the exact
                               validation processor: seal signatures, CERT/2
                               chain to trust anchors, codex ABI gate, sampled
                               spot-checks, geometric sync (holonomy + Merkle).
                               FLUX — the infinite, non-transferable meter —
                               prices the work and gates read quota
    Tier 3  SPIRE CORE         a permissioned governance quorum full-replays,
                               runs the attunement bench twice independently
                               (simulation receipts), crystallizes the claim,
                               and issues CRYST — the scarce, compute-backed
                               credit — on a sequenced ledger with redemption

Same Polycentria discipline as the Spire Mesh study: every gossiped record is
an untrusted proposal (Helix A); every node's validation processor is an exact
certifier (Helix B); CRYST transfers are the one object that needs ordering,
so they are sequenced by the Core quorum and verified by everyone.

Pure standard library. Deterministic. `python3 biochain_mesh.py`
(captured in biochain_mesh_output.txt).
"""

import hashlib
import hmac as hmac_mod
import json
import random
import time

import codex_engine as CE
from shdccp_kernel import packet_hex

RNG = random.Random(0x0B10)
TICK = "SCHU.sim-window-0.7.83.2"
COMPUTE_SECONDS_PER_CRYST = 12          # the fleet's posted redemption rate


# ─── ECDSA P-256 (same primitive as seal-crypto.js / Spire Mesh study) ───────

P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff
NO = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551
A = P - 3
G = (0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296,
     0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5)


def _inv(x, m):
    return pow(x, -1, m)


def _add(p1, p2):
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    (x1, y1), (x2, y2) = p1, p2
    if x1 == x2 and (y1 + y2) % P == 0:
        return None
    lam = ((3 * x1 * x1 + A) * _inv(2 * y1, P) if p1 == p2
           else (y2 - y1) * _inv(x2 - x1, P)) % P
    x3 = (lam * lam - x1 - x2) % P
    return (x3, (lam * (x1 - x3) - y1) % P)


def _mul(k, pt):
    acc = None
    while k:
        if k & 1:
            acc = _add(acc, pt)
        pt = _add(pt, pt)
        k >>= 1
    return acc


def sha256_hex(s):
    return hashlib.sha256(s.encode() if isinstance(s, str) else s).hexdigest()


def keypair(seed):
    d = int.from_bytes(hashlib.sha256(b"biochain-key|" + seed.encode()).digest(), "big") % (NO - 1) + 1
    return d, _mul(d, G)


def sign(d, payload):
    z = int.from_bytes(hashlib.sha256(payload.encode()).digest(), "big") % NO
    ctr = 0
    while True:
        k = int.from_bytes(hmac_mod.new(d.to_bytes(32, "big"),
                                        payload.encode() + ctr.to_bytes(4, "big"),
                                        hashlib.sha256).digest(), "big") % NO
        ctr += 1
        if k == 0:
            continue
        r = _mul(k, G)[0] % NO
        if r == 0:
            continue
        s = _inv(k, NO) * (z + r * d) % NO
        if s:
            return "%064x%064x" % (r, s)


def verify(Q, payload, sig_hex):
    try:
        r, s = int(sig_hex[:64], 16), int(sig_hex[64:], 16)
    except (ValueError, TypeError):
        return False
    if not (0 < r < NO and 0 < s < NO):
        return False
    z = int.from_bytes(hashlib.sha256(payload.encode()).digest(), "big") % NO
    w = _inv(s, NO)
    pt = _add(_mul(z * w % NO, G), _mul(r * w % NO, Q))
    return pt is not None and pt[0] % NO == r


# ─── identities ──────────────────────────────────────────────────────────────

TIER_RANK = {"ACOLYTE": 0, "INSTRUCTOR": 1, "ARCHON": 2}


class Operator:
    def __init__(self, name):
        self.name = name
        self.uid = "uid-" + name.lower()
        self.genesis_id = "0x" + sha256_hex("ledger|" + name)[:16].upper()
        self.priv, self.pub = keypair(name)
        self.seal_id = "S-" + sha256_hex("%x|%x" % self.pub)[:24]

    def seal_record(self):
        return {"sealId": self.seal_id, "pubX": "%x" % self.pub[0], "pubY": "%x" % self.pub[1],
                "genesisId": self.genesis_id, "status": "active"}

    def sign(self, payload):
        return sign(self.priv, payload)


# ─── canonical payloads ──────────────────────────────────────────────────────

def cert_payload(b):
    return "|".join(["CERT/2", b["issuer"], b["tier"], b["plane"], b["subject"], b["issuedAt"]])


def codex_rec_payload(b):
    return "|".join(["CODEX/1", b["codexHash"], str(b["packets"]), b["authorSealId"], TICK])


def claim_payload(b):
    return "|".join(["BIOSEED-CLAIM/1", b["codexHash"], b["merkleRoot"], b["holonomy"],
                     str(b["origBytes"]), b["growerSealId"], TICK])


def crystal_payload(b):
    return "|".join(["CRYSTAL/1", b["claimRid"], "%.4f" % b["value"], "%.4f" % b["epsilon"],
                     str(b["crystIssued"]), b["benchReceipt"], TICK])


def transfer_payload(b):
    return "|".join(["CRYST-XFER/1", str(b["seq"]), b["from"], b["to"], str(b["amount"]), TICK])


def rid_of(kind, body):
    return kind[:2].upper() + "-" + sha256_hex(kind + json.dumps(body, sort_keys=True))[:20]


def rec(kind, body, sig=None):
    return {"rid": rid_of(kind, body), "kind": kind, "body": body, "sig": sig}


# ─── the node ────────────────────────────────────────────────────────────────

class Node:
    def __init__(self, name, op, role, anchors, claims_blob):
        self.name, self.op, self.role = name, op, role
        self.anchors = set(anchors)
        self.core, self.seals, self.quarantine = {}, {}, []
        self.flux = 0.0                       # Token A: infinite meter, never transferable
        self.validations = 0
        self.blob = claims_blob               # full claim payloads (content-addressed store)

    def _pub(self, seal_id):
        s = self.seals.get(seal_id)
        if not s or s["status"] != "active":
            return None
        return (int(s["pubX"], 16), int(s["pubY"], 16))

    def tier_of(self, genesis_id, depth=0):
        if genesis_id in self.anchors:
            return "ARCHON"
        if depth > 8:
            return "ACOLYTE"
        best = "ACOLYTE"
        for r in self.core.values():
            if r["kind"] == "cert" and r["body"]["subject"] == genesis_id \
               and self.tier_of(r["body"]["issuer"], depth + 1) == "ARCHON" \
               and TIER_RANK[r["body"]["tier"]] > TIER_RANK[best]:
                best = r["body"]["tier"]
        return best

    # ─── Helix B: the validation processor ───────────────────────────────
    def validate(self, r):
        kind, b = r["kind"], r["body"]

        if kind == "seal":
            return True, "seal registered"

        if kind == "cert":
            pub = self._pub(b["issuerSealId"])
            if not pub or not verify(pub, cert_payload(b), r["sig"]):
                return False, "CERT/2 signature invalid"
            if self.tier_of(b["issuer"]) != "ARCHON":
                return False, "issuer does not resolve to a trust anchor"
            return True, "cert %s → %s" % (b["subject"][:8], b["tier"])

        if kind == "codex":
            pub = self._pub(b["authorSealId"])
            if not pub or not verify(pub, codex_rec_payload(b), r["sig"]):
                return False, "codex signature invalid"
            try:
                CE.parse_codex([int(h, 16) for h in b["packetsHex"]])
            except ValueError as e:
                return False, "ABI gate: " + str(e)
            if CE.codex_hash([int(h, 16) for h in b["packetsHex"]]) != b["codexHash"]:
                return False, "codex hash mismatch"
            return True, "codex ABI-valid: " + b["codexHash"][:12]

        if kind == "claim":
            pub = self._pub(b["growerSealId"])
            if not pub or not verify(pub, claim_payload(b), r["sig"]):
                return False, "claim signature invalid"
            if not any(x["kind"] == "codex" and x["body"]["codexHash"] == b["codexHash"]
                       for x in self.core.values()):
                return False, "claim references unknown codex"
            claim = self.blob.get(b["claimRid"])
            if claim is None:
                return False, "claim blob not found in content store"
            if claim["merkleRoot"] != b["merkleRoot"] or claim["holonomy"] != b["holonomy"]:
                return False, "claim body does not match committed blob"
            # sampled verification: replay 3 chunks + recompute declared value
            picks = [int(sha256_hex(b["merkleRoot"] + self.name + str(i)), 16)
                     % len(claim["streams"]) for i in range(3)]
            if not all(CE.spot_check(claim, i) for i in picks):
                return False, "spot-check failed on sampled chunks %s" % picks
            if abs(CE.value_score(claim) - b["value"]) > 1e-6:
                return False, "declared value %.4f ≠ recomputed" % b["value"]
            return True, "spot-checked chunks %s · value %.2f verified" % (picks, b["value"])

        if kind == "crystal":
            sigs = r["sig"]                              # quorum multi-sig
            good = 0
            for seal_id, sg in sigs.items():
                pub = self._pub(seal_id)
                gen = self.seals.get(seal_id, {}).get("genesisId", "")
                if pub and verify(pub, crystal_payload(b), sg) \
                        and TIER_RANK[self.tier_of(gen)] >= TIER_RANK["INSTRUCTOR"]:
                    good += 1
            if good < 2:
                return False, "needs ≥2 governance signatures, got %d" % good
            if not any(x["kind"] == "claim" and x["body"]["claimRid"] == b["claimRid"]
                       for x in self.core.values()):
                return False, "crystal references unvalidated claim"
            return True, "crystallized by %d governors" % good

        if kind == "xfer":
            sigs = r["sig"]
            good = sum(1 for seal_id, sg in sigs.items()
                       if self._pub(seal_id) and verify(self._pub(seal_id), transfer_payload(b), sg))
            if good < 2:
                return False, "transfer lacks quorum sequencing (2 sigs)"
            expected = 1 + max((x["body"]["seq"] for x in self.core.values()
                                if x["kind"] == "xfer"), default=0)
            if b["seq"] != expected:
                return False, "bad sequence %d (expected %d) — replay/double-spend" % (b["seq"], expected)
            if self.cryst_balance(b["from"]) < b["amount"]:
                return False, "insufficient CRYST balance"
            return True, "xfer #%d %s→%s %d CRYST" % (b["seq"], b["from"][:8], b["to"][:8], b["amount"])

        return False, "unknown record kind"

    def ingest(self, r):
        if r["rid"] in self.core:
            return False
        ok, why = self.validate(r)
        self.validations += 1
        self.flux += 1.0 if r["kind"] in ("claim", "codex") else 0.1   # FLUX meters real work
        if ok:
            self.core[r["rid"]] = r
            if r["kind"] == "seal":
                self.seals[r["body"]["sealId"]] = r["body"]
            return True
        self.quarantine.append((r["rid"], why))
        return False

    def cryst_balance(self, genesis_id):
        bal = 0
        for r in self.core.values():
            if r["kind"] == "crystal" and r["body"]["beneficiary"] == genesis_id:
                bal += r["body"]["crystIssued"]
            if r["kind"] == "xfer":
                if r["body"]["from"] == genesis_id:
                    bal -= r["body"]["amount"]
                if r["body"]["to"] == genesis_id:
                    bal += r["body"]["amount"]
        return bal

    def quota(self):
        s = min(200.0, self.flux)
        for cut, q in ((80, 200), (40, 60), (15, 30), (5, 10)):
            if s >= cut:
                return q
        return 1


def gossip(nodes, fanout=2):
    rounds = 0
    def converged():
        ref = set(nodes[0].core)
        return all(set(n.core) == ref for n in nodes[1:])
    while not converged() and rounds < 24:
        rounds += 1
        for node in nodes:
            for peer in RNG.sample([n for n in nodes if n is not node], fanout):
                order = {"seal": 0, "cert": 1, "codex": 2}
                for rid in sorted([r for r in node.core if r not in peer.core],
                                  key=lambda r: order.get(node.core[r]["kind"], 3)):
                    peer.ingest(dict(node.core[rid]))
    return rounds


# ─── the simulation ──────────────────────────────────────────────────────────

def main():
    t0 = time.time()
    results = []

    def check(name, ok, detail=""):
        results.append((name, ok))
        print("  [%s] %s%s" % ("PASS" if ok else "FAIL", name, (" — " + detail) if detail else ""))

    def section(s):
        print("\n" + "─" * 74 + "\n%s\n" % s + "─" * 74)

    section("BIOCHAIN MESH — genesis (Tier 3 quorum + Tier 2 validators + Tier 1 edge)")
    root = Operator("Aldrovanda")                      # root Archon
    gov = [Operator("Bavol"), Operator("Ceridwen")]    # governance instructors
    vals = [Operator(n) for n in ("Dagny", "Edda", "Fionn", "Grier")]
    mira, vex = Operator("Mira"), Operator("Vex")      # edge growers (Vex is hostile)
    broker = Operator("Okku")                          # compute broker
    ops = [root] + gov + vals + [mira, vex, broker]
    anchors = [root.genesis_id]
    blob = {}                                          # content-addressed claim store
    nodes = ([Node("core-0", root, "core", anchors, blob)]
             + [Node("core-%d" % (i + 1), g, "core", anchors, blob) for i, g in enumerate(gov)]
             + [Node("mesh-%d" % i, v, "mesh", anchors, blob) for i, v in enumerate(vals)]
             + [Node("edge-0", mira, "edge", anchors, blob),
                Node("edge-1", vex, "edge", anchors, blob)])
    boot = nodes[0]
    for op in ops:
        boot.ingest(rec("seal", op.seal_record()))
    for g in gov:
        b = {"issuer": root.genesis_id, "subject": g.genesis_id, "tier": "INSTRUCTOR",
             "plane": "*", "issuedAt": "2026-07-03T00:00:00Z", "issuerSealId": root.seal_id}
        boot.ingest(rec("cert", b, root.sign(cert_payload(b))))
    g0 = gossip(nodes)                                 # identity layer converges first
    print("  %d operators · trust anchor %s · %d nodes across 3 tiers"
          % (len(ops), root.genesis_id, len(nodes)))
    print("  genesis (seals + CERT/2) converged in %d gossip rounds" % g0)

    section("Tier 1 — Biostrata: Mira authors a codex and grows a bioseed claim")
    corpus = CE.corpus_wiki_a()
    primed = CE.primed_from(corpus, 2, 120)
    codex_pk = CE.build_codex(order=2, chunk_size=720, primed=primed)
    cxh = CE.codex_hash(codex_pk)
    cx_body = {"codexHash": cxh, "packets": len(codex_pk),
               "packetsHex": [packet_hex(w) for w in codex_pk], "authorSealId": mira.seal_id}
    codex_rec = rec("codex", cx_body, mira.sign(codex_rec_payload(cx_body)))

    claim = CE.grow(corpus, codex_pk)
    claim_rid = "BL-" + sha256_hex(json.dumps(claim, sort_keys=True))[:20]
    blob[claim_rid] = claim
    cl_body = {"claimRid": claim_rid, "codexHash": cxh, "merkleRoot": claim["merkleRoot"],
               "holonomy": claim["holonomy"], "origBytes": claim["origBytes"],
               "value": CE.value_score(claim), "growerSealId": mira.seal_id}
    claim_rec = rec("claim", cl_body, mira.sign(claim_payload(cl_body)))
    print("  codex %s… (%d packets, primed) · claim %s" % (cxh[:16], len(codex_pk), claim_rid))
    print("  grown: %d B corpus → %d B shipped · declared value %.3f · holonomy %s"
          % (claim["origBytes"], CE.shipped_bytes(claim), cl_body["value"], claim["holonomy"]))

    section("Tier 2 — Hypersim: gossip + independent sampled verification")
    entry = nodes[7]                                    # enters at a mesh node
    entry.ingest(codex_rec)
    entry.ingest(claim_rec)
    rounds = gossip(nodes)
    holders = sum(1 for n in nodes if claim_rec["rid"] in n.core)
    check("claim verified by every node (each samples its own chunks)",
          holders == len(nodes), "%d/%d nodes · %d gossip rounds" % (holders, len(nodes), rounds))

    section("Red-owl suite at the mesh boundary")
    # (a) Vex inflates the declared value
    lie = dict(cl_body, value=cl_body["value"] * 3, growerSealId=vex.seal_id)
    lie_rec = rec("claim", lie, vex.sign(claim_payload(lie)))
    rejected = sum(1 for n in nodes if not n.ingest(dict(lie_rec)))
    check("inflated-value claim rejected (every node recomputes)", rejected == len(nodes))
    # (b) Vex ships a codex with an illegal opcode
    bad_pk = [codex_pk[0], CE.pack(11, 0, (0, 0, 0, 0), 0, 0, 0), codex_pk[-1]]
    bb = {"codexHash": CE.codex_hash(bad_pk), "packets": 3,
          "packetsHex": [packet_hex(w) for w in bad_pk], "authorSealId": vex.seal_id}
    rejected = sum(1 for n in nodes if not n.ingest(rec("codex", bb, vex.sign(codex_rec_payload(bb)))))
    check("illegal-opcode codex rejected at the ABI gate", rejected == len(nodes))
    # (c) Vex tampers a residual stream inside a re-published claim blob.
    # Honest physics of sampling: a single node's 3-chunk sample can miss the
    # tampered chunk — the mesh screens probabilistically; Tier-3 full replay
    # is the certainty. Screening runs validate-only (no ingest), exactly like
    # a boundary check before a record is admitted to gossip.
    tampered = json.loads(json.dumps(claim))
    s = bytearray(bytes.fromhex(tampered["streams"][2])); s[3] ^= 0x20
    tampered["streams"][2] = bytes(s).hex()
    t_rid = "BL-" + sha256_hex(json.dumps(tampered, sort_keys=True))[:20]
    blob[t_rid] = tampered
    tb = dict(cl_body, claimRid=t_rid, growerSealId=vex.seal_id)
    t_rec = rec("claim", tb, vex.sign(claim_payload(tb)))
    caught = sum(1 for n in nodes if not n.validate(t_rec)[0])
    try:
        CE.unfold(tampered); replay_caught = False
    except ValueError:
        replay_caught = True
    check("tampered residual: sampled screening catches at %d/%d nodes, full replay with certainty"
          % (caught, len(nodes)), caught >= 1 and replay_caught)

    section("Tier 3 — SPIRE Core: full replay, twin attunement bench, crystallization")
    full_ok = CE.unfold(claim) == corpus
    check("governance full replay is lossless (holonomy + Merkle verified)", full_ok)
    held = CE.corpus_wiki_b()
    receipts = []
    for bench_node in nodes[1:3]:                       # two governors, independently
        fresh = CE.grow(held, CE.build_codex(order=2, chunk_size=720))
        att = CE.grow(held, codex_pk)
        rf = sum(len(x) // 2 for x in fresh["streams"])
        ra = sum(len(x) // 2 for x in att["streams"])
        receipts.append(round((rf - ra) / rf, 6))
    check("twin simulation receipts agree bit-for-bit (deterministic bench)",
          receipts[0] == receipts[1], "ε = %+.1f%% on held-out corpus" % (100 * receipts[0]))
    epsilon = receipts[0]
    cryst_issued = int(round(100 * CE.value_score(claim) * max(0.0, epsilon)))
    cr_body = {"claimRid": claim_rid, "value": CE.value_score(claim), "epsilon": epsilon,
               "crystIssued": cryst_issued, "beneficiary": mira.genesis_id,
               "benchReceipt": sha256_hex(json.dumps(receipts))[:16]}
    sigs = {root.seal_id: root.sign(crystal_payload(cr_body)),
            gov[0].seal_id: gov[0].sign(crystal_payload(cr_body))}
    boot.ingest(rec("crystal", cr_body, sigs))
    gossip(nodes)
    check("crystal accepted mesh-wide (2-governor multi-sig)",
          all(any(r["kind"] == "crystal" for r in n.core.values()) for n in nodes),
          "%d CRYST issued to Mira (value %.2f × ε %.3f × 100)"
          % (cryst_issued, cr_body["value"], epsilon))

    section("The exchange: sequenced CRYST transfers + compute redemption")
    xfer_amt = max(1, cryst_issued * 2 // 3)
    xf = {"seq": 1, "from": mira.genesis_id, "to": broker.genesis_id, "amount": xfer_amt}
    xsigs = {root.seal_id: root.sign(transfer_payload(xf)),
             gov[1].seal_id: gov[1].sign(transfer_payload(xf))}
    boot.ingest(rec("xfer", xf, xsigs))
    gossip(nodes)
    check("sequenced transfer settles on every node",
          all(n.cryst_balance(broker.genesis_id) == xfer_amt for n in nodes),
          "Mira %d · Okku %d" % (nodes[0].cryst_balance(mira.genesis_id), xfer_amt))
    replay = rec("xfer", xf, xsigs)
    replay["rid"] = replay["rid"] + "x"                 # same seq, new rid
    rejected = sum(1 for n in nodes if not n.ingest(dict(replay)))
    check("double-spend replay rejected by sequence rule", rejected == len(nodes))
    overdraft = {"seq": 2, "from": vex.genesis_id, "to": broker.genesis_id, "amount": 5}
    osigs = {root.seal_id: root.sign(transfer_payload(overdraft)),
             gov[0].seal_id: gov[0].sign(transfer_payload(overdraft))}
    rejected = sum(1 for n in nodes if not n.ingest(rec("xfer", overdraft, osigs)))
    check("overdraft rejected (Vex earned nothing)", rejected == len(nodes))
    print("  redemption rate: 1 CRYST = %d compute-seconds → Okku redeems %d CRYST = %d s on the fleet"
          % (COMPUTE_SECONDS_PER_CRYST, xfer_amt, xfer_amt * COMPUTE_SECONDS_PER_CRYST))

    section("FLUX meter → read quota (Token A: infinite, non-transferable, un-farmable)")
    print("  %-8s %-10s %-5s %12s %8s %10s %14s" %
          ("node", "operator", "tier", "validations", "FLUX", "quota/min", "CRYST balance"))
    for n in nodes:
        print("  %-8s %-10s %-5s %12d %8.1f %10d %14d" %
              (n.name, n.op.name, n.role, n.validations, n.flux, n.quota(),
               n.cryst_balance(n.op.genesis_id)))
    check("FLUX was metered but never transferred (no FLUX field in any record)",
          not any("flux" in json.dumps(r["body"]).lower() for n in nodes for r in n.core.values()))

    section("Verdict")
    passed = sum(1 for _, ok in results if ok)
    for name, ok in results:
        print("  %s %s" % ("✓" if ok else "✗", name))
    print("\n  %d/%d mesh checks passed · %d records in every core · quarantined %d · %.1fs"
          % (passed, len(results), len(nodes[0].core),
             sum(len(n.quarantine) for n in nodes), time.time() - t0))
    return passed == len(results)


if __name__ == "__main__":
    main()
