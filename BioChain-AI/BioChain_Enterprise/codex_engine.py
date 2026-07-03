#!/usr/bin/env python3
"""
Codex Engine — user-authored unfolding logic as a closed, deterministic,
metered instruction set over SHD-CCP kernel packets.

The generative-compression cell of BioChain Enterprise:

  • A CODEX is a program written *in packets* — Structural Form ID is the
    opcode. No jumps exist, so every codex halts by construction; predictor
    work is fuel-metered on top.
  • GROWTH (compression) is predict-then-correct: the codex's model predicts
    each next byte as a ranked expectation; the shipped "residual" is the
    stream of ranks (Elias-gamma coded) — how far reality deviated. Recreation
    (UNFOLDING) replays the same model and is lossless by construction.
  • Every chunk also crystallizes into one kernel packet — the BIOSEED CHAIN —
    whose cumulative XOR is the chain's holonomy word: the cheap geometric
    synchronization check between tiers.
  • VALUE counts *everything shipped* (seed + codex + residual + chain)
    against the bytes recreated; STABILITY is bit-identical replay. Both are
    hard numbers, not judgments.

Opcode set (closed — anything else is an invalid codex):

  FORM 0  HALT
  FORM 1  GEAR   payload16 = chunk size (64..4096) · spin = model order (1..3)
  FORM 2  PRIME  one pretrained model entry: payload16 = context,
                 quat slots = (byte>>4, byte&15, count, 0) — this is how a
                 codex ships "crystallized knowledge" (attunement), and also
                 exactly where a Goodhart attacker tries to hide the corpus —
                 which the value formula prices correctly.

Chunks are encoded with a FRESH model per chunk (initialized only from PRIME
entries), so any chunk can be spot-checked independently — that is what makes
cheap sampled verification possible on the mesh.

Pure standard library. `python3 codex_engine.py` (captured in
codex_engine_output.txt).
"""

import hashlib
import random

from shdccp_kernel import pack, unpack, packet_hex, crystallize

FUEL_PER_BYTE = 200          # metered predictor budget
CHUNK_MIN, CHUNK_MAX = 64, 4096
ORDER_MIN, ORDER_MAX = 1, 3


# ─── bit I/O + Elias gamma ───────────────────────────────────────────────────

class BitWriter:
    def __init__(self):
        self.bits = []

    def write(self, value, width):
        for i in range(width - 1, -1, -1):
            self.bits.append((value >> i) & 1)

    def gamma(self, n):                      # n ≥ 1
        width = n.bit_length()
        self.write(0, width - 1)
        self.write(n, width)

    def bytes(self):
        out = bytearray()
        for i in range(0, len(self.bits), 8):
            b = 0
            for bit in self.bits[i:i + 8]:
                b = (b << 1) | bit
            b <<= (8 - min(8, len(self.bits) - i))
            out.append(b & 0xFF)
        return bytes(out)


class BitReader:
    def __init__(self, data):
        self.data = data
        self.pos = 0

    def read(self, width):
        v = 0
        for _ in range(width):
            byte = self.data[self.pos >> 3]
            v = (v << 1) | ((byte >> (7 - (self.pos & 7))) & 1)
            self.pos += 1
        return v

    def gamma(self):
        zeros = 0
        while self.read(1) == 0:
            zeros += 1
        return (1 << zeros) | (self.read(zeros) if zeros else 0)


# ─── the rank coder (the predict-then-correct model) ─────────────────────────

class RankCoder:
    """Adaptive order-k byte model. Prediction = candidates ranked by
    (count desc, byte asc); the emitted rank IS the residual channel."""

    def __init__(self, order, primed=None):
        self.order = order
        self.tables = {}
        self.fuel = 0
        if primed:
            for ctx, byte, count in primed:
                self.tables.setdefault(ctx, {})[byte] = \
                    self.tables.get(ctx, {}).get(byte, 0) + count

    def _cands(self, ctx):
        t = self.tables.get(ctx)
        return sorted(t, key=lambda b: (-t[b], b)) if t else []

    def _update(self, ctx, byte):
        t = self.tables.setdefault(ctx, {})
        t[byte] = t.get(byte, 0) + 1
        self.fuel += 1

    def encode(self, data, bw):
        ctx = b"\x00" * self.order
        for byte in data:
            cands = self._cands(ctx)
            self.fuel += 1 + len(cands)
            if byte in cands:
                bw.gamma(cands.index(byte) + 1)
            else:
                bw.gamma(len(cands) + 1)         # escape
                bw.write(byte, 8)
            self._update(ctx, byte)
            ctx = (ctx + bytes([byte]))[-self.order:]

    def decode(self, br, length):
        out = bytearray()
        ctx = b"\x00" * self.order
        for _ in range(length):
            cands = self._cands(ctx)
            self.fuel += 1 + len(cands)
            n = br.gamma()
            byte = cands[n - 1] if n - 1 < len(cands) else br.read(8)
            out.append(byte)
            self._update(ctx, byte)
            ctx = (ctx + bytes([byte]))[-self.order:]
        return bytes(out)


# ─── codex build / parse (the ABI validation gate) ───────────────────────────

def build_codex(order, chunk_size, primed=()):
    packets = [pack(1, order, (0, 0, 0, 0), chunk_size, 0, 0)]        # GEAR
    for ctx, byte, count in primed:
        ctx16 = int.from_bytes(ctx.rjust(2, b"\x00"), "big")
        packets.append(pack(2, len(ctx), (byte >> 4, byte & 15, min(count, 127), 0),
                            ctx16, 0, 0))                              # PRIME
    packets.append(pack(0, 0, (0, 0, 0, 0), 0, 0, 0))                  # HALT
    return packets


def codex_hash(packets):
    return hashlib.sha256(b"".join(w.to_bytes(8, "big") for w in packets)).hexdigest()


def parse_codex(packets, order_for_prime=None):
    """Validate + interpret. Raises ValueError on any ABI violation —
    this is the mesh's 'unfolding logic is configuration, not code' gate."""
    if not packets:
        raise ValueError("empty codex")
    fields = [unpack(w) for w in packets]              # parity-checks every word
    if fields[0]["form"] != 1:
        raise ValueError("codex must open with GEAR")
    if fields[-1]["form"] != 0:
        raise ValueError("codex must end with HALT")
    gear = fields[0]
    order, chunk = gear["spin"], gear["payload16"]
    if not ORDER_MIN <= order <= ORDER_MAX:
        raise ValueError("model order %d outside ABI clamp %d..%d" % (order, ORDER_MIN, ORDER_MAX))
    if not CHUNK_MIN <= chunk <= CHUNK_MAX:
        raise ValueError("chunk size %d outside ABI clamp %d..%d" % (chunk, CHUNK_MIN, CHUNK_MAX))
    primed = []
    for f in fields[1:-1]:
        if f["form"] != 2:
            raise ValueError("unknown opcode FORM %d — closed instruction set" % f["form"])
        hi, lo, count, _ = f["quat_codes"]
        ctx_len = f["spin"]
        ctx = f["payload16"].to_bytes(2, "big")[-ctx_len:] if ctx_len else b""
        ctx = ctx.rjust(min(order, ctx_len), b"\x00")[-order:] if ctx_len else b""
        primed.append((ctx.rjust(order, b"\x00") if ctx_len >= order else ctx,
                       (hi << 4) | lo, count))
    # PRIME contexts must match the model order to be usable
    primed = [(c, b, n) for c, b, n in primed if len(c) == order]
    return {"order": order, "chunk": chunk, "primed": primed}


# ─── grow (compress + commit) / unfold (recreate) ────────────────────────────

def _chunk_hash(idx, chunk):
    return hashlib.sha256(idx.to_bytes(4, "big") + hashlib.sha256(chunk).digest()).hexdigest()


def merkle_root(leaf_hashes):
    level = [bytes.fromhex(h) for h in leaf_hashes] or [b"\x00" * 32]
    while len(level) > 1:
        if len(level) & 1:
            level.append(level[-1])
        level = [hashlib.sha256(level[i] + level[i + 1]).digest()
                 for i in range(0, len(level), 2)]
    return level[0].hex()


def grow(data, codex_packets):
    """The Biostrata step: data + codex → claim (everything a mesh node needs
    to verify and price the growth)."""
    cfg = parse_codex(codex_packets)
    chunks = [data[i:i + cfg["chunk"]] for i in range(0, len(data), cfg["chunk"])]
    streams, leaf_hashes, chain, fuel = [], [], [], 0
    holonomy = 0
    for idx, chunk in enumerate(chunks):
        coder = RankCoder(cfg["order"], cfg["primed"])   # fresh per chunk → spot-checkable
        bw = BitWriter()
        coder.encode(chunk, bw)
        fuel += coder.fuel
        if coder.fuel > FUEL_PER_BYTE * len(chunk) + 10000:
            raise ValueError("fuel exceeded on chunk %d" % idx)
        streams.append(bw.bytes().hex())
        leaf_hashes.append(_chunk_hash(idx, chunk))
        crystal = crystallize(chunk)
        chain.append(packet_hex(crystal))
        holonomy ^= crystal
    return {
        "format": "BIOSEED/1",
        "seed": chain[0] if chain else "0" * 16,          # chain origin
        "codex": [packet_hex(w) for w in codex_packets],
        "codexHash": codex_hash(codex_packets),
        "chunkLens": [len(c) for c in chunks],
        "streams": streams,
        "leafHashes": leaf_hashes,
        "merkleRoot": merkle_root(leaf_hashes),
        "chain": chain,
        "holonomy": "%016X" % holonomy,
        "origBytes": len(data),
        "fuel": fuel,
    }


def unfold_chunk(claim, idx):
    cfg = parse_codex([int(h, 16) for h in claim["codex"]])
    coder = RankCoder(cfg["order"], cfg["primed"])
    br = BitReader(bytes.fromhex(claim["streams"][idx]))
    try:
        return coder.decode(br, claim["chunkLens"][idx])
    except IndexError:
        raise ValueError("residual stream %d truncated or corrupt" % idx)


def unfold(claim):
    """Full recreation + geometric sync verification (holonomy + Merkle)."""
    out, holonomy, leafs = bytearray(), 0, []
    for idx in range(len(claim["streams"])):
        chunk = unfold_chunk(claim, idx)
        out.extend(chunk)
        leafs.append(_chunk_hash(idx, chunk))
        holonomy ^= int(packet_hex(crystallize(chunk)), 16)
    if "%016X" % holonomy != claim["holonomy"]:
        raise ValueError("holonomy word mismatch — chain out of sync")
    if merkle_root(leafs) != claim["merkleRoot"]:
        raise ValueError("merkle root mismatch — recreation is not the committed data")
    return bytes(out)


def spot_check(claim, idx):
    """The cheap Tier-2 check: replay ONE chunk, compare its committed leaf."""
    try:
        return _chunk_hash(idx, unfold_chunk(claim, idx)) == claim["leafHashes"][idx] \
            and merkle_root(claim["leafHashes"]) == claim["merkleRoot"]
    except (ValueError, IndexError):
        return False


def shipped_bytes(claim):
    return (8                                             # seed
            + 8 * len(claim["codex"])                      # codex packets
            + sum(len(s) // 2 for s in claim["streams"])   # residual (rank streams)
            + 8 * len(claim["chain"]))                     # bioseed chain


def value_score(claim, amortize_codex_over=1):
    """value = recreated bytes / shipped bytes. The codex may amortize across
    the number of growths it serves; one-shot value uses amortize=1."""
    ship = (8 + 8 * len(claim["codex"]) / amortize_codex_over
            + sum(len(s) // 2 for s in claim["streams"]) + 8 * len(claim["chain"]))
    return claim["origBytes"] / ship


# ─── deterministic corpora (structured vs held-out vs entropy) ───────────────

_WORDS = ("torsion pump quaternion toroid lattice spire codex engram manifold seed "
          "crystal parity gossip archon instructor acolyte quorum resonance golden "
          "helix fold chain packet kernel halo spin frequency amplitude payload").split()


def _article(rng, title):
    lines = ["== %s ==" % title,
             "{{Infobox system", "| name = %s" % title,
             "| class = geometric", "| tier = %d" % rng.randrange(1, 4), "}}"]
    for _ in range(rng.randrange(6, 10)):
        n = rng.randrange(8, 14)
        words = [rng.choice(_WORDS) for _ in range(n)]
        lines.append("The %s aligns the %s through the %s. " % (words[0], words[1], words[2])
                     + " ".join(words[3:]) + ".")
    lines.append("[[Category:BioChain]] [[Category:%s]]" % title.split()[0])
    return "\n".join(lines)


def corpus_wiki_a():
    rng = random.Random(101)
    return ("\n\n".join(_article(rng, t) for t in
            ("Torsional Pump", "Quaternion Chain", "Spire Engine", "Kernel Halo",
             "Golden Toroid", "Parity Channel"))).encode()


def corpus_wiki_b():                                       # held-out, same domain
    rng = random.Random(202)
    return ("\n\n".join(_article(rng, t) for t in
            ("Codex Lattice", "Engram Crystal", "Resonance Fold", "Archon Quorum",
             "Gossip Manifold"))).encode()


def corpus_random():
    rng = random.Random(303)
    return bytes(rng.randrange(256) for _ in range(3000))


def primed_from(data, order, top_n):
    """Distill a corpus into PRIME entries — the 'crystallized knowledge seed'."""
    counts = {}
    ctx = b"\x00" * order
    for byte in data:
        counts[(ctx, byte)] = counts.get((ctx, byte), 0) + 1
        ctx = (ctx + bytes([byte]))[-order:]
    best = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:top_n]
    return [(ctx, byte, count) for (ctx, byte), count in best]


# ─── the bench ───────────────────────────────────────────────────────────────

def main():
    results = []

    def check(name, ok, detail=""):
        results.append((name, ok))
        print("  [%s] %s%s" % ("PASS" if ok else "FAIL", name, (" — " + detail) if detail else ""))

    def section(s):
        print("\n" + "─" * 74 + "\n%s\n" % s + "─" * 74)

    wiki_a, wiki_b, noise = corpus_wiki_a(), corpus_wiki_b(), corpus_random()

    section("CODEX ENGINE — two user-authored unfolding logics")
    prose = build_codex(order=2, chunk_size=720)
    generic = build_codex(order=1, chunk_size=240)
    print("  prose codex   : order 2 · chunk 720 · %d packets · %s…"
          % (len(prose), codex_hash(prose)[:16]))
    print("  generic codex : order 1 · chunk 240 · %d packets · %s…"
          % (len(generic), codex_hash(generic)[:16]))

    section("Grow → unfold: lossless by construction, priced by residual")
    print("  %-22s %-9s %9s %9s %8s %9s" %
          ("corpus", "codex", "orig B", "shipped B", "value", "lossless"))
    rows = {}
    for cname, corpus in (("wiki (structured)", wiki_a), ("noise (entropy)", noise)):
        for xname, codex in (("prose", prose), ("generic", generic)):
            claim = grow(corpus, codex)
            ok = unfold(claim) == corpus
            rows[(cname, xname)] = claim
            print("  %-22s %-9s %9d %9d %8.2f %9s" %
                  (cname, xname, claim["origBytes"], shipped_bytes(claim),
                   value_score(claim), "yes" if ok else "NO"))
    check("all four grow→unfold round-trips are lossless",
          all(unfold(c) == (wiki_a if "wiki" in k[0] else noise) for k, c in rows.items()))
    best = rows[("wiki (structured)", "prose")]
    check("structured data grows at value > 1 (prose codex)",
          value_score(best) > 1, "value %.2f" % value_score(best))
    check("entropy is priced honestly (value < 1 on noise)",
          value_score(rows[("noise (entropy)", "prose")]) < 1,
          "value %.2f — no unfolding logic beats entropy"
          % value_score(rows[("noise (entropy)", "prose")]))
    check("customization is measurable (prose ≠ generic value on wiki)",
          abs(value_score(best) - value_score(rows[("wiki (structured)", "generic")])) > 0.05)

    section("Geometric synchronization + sampled verification (Tier-2 economics)")
    rng = random.Random(7)
    sample = [rng.randrange(len(best["streams"])) for _ in range(5)]
    check("spot-check: 5 sampled chunks replay to committed leaves",
          all(spot_check(best, i) for i in sample), "chunks %s" % sample)
    tampered = dict(best, streams=list(best["streams"]))
    s = bytearray(bytes.fromhex(tampered["streams"][1])); s[4] ^= 0x40
    tampered["streams"][1] = bytes(s).hex()
    caught = not spot_check(tampered, 1)
    try:
        unfold(tampered); full_caught = False
    except ValueError as e:
        full_caught = True
        reason = str(e)
    check("tampered residual caught by spot-check AND full unfold",
          caught and full_caught, reason if full_caught else "")
    print("  bioseed chain: %d packets · holonomy word %s (cumulative XOR closes the chain)"
          % (len(best["chain"]), best["holonomy"]))

    section("The Goodhart attack, priced: hide the corpus in the codex")
    dump = build_codex(order=2, chunk_size=720,
                       primed=primed_from(wiki_a, 2, 10 ** 9))     # dump EVERYTHING
    dump_claim = grow(wiki_a, dump)
    honest_v, dump_v = value_score(best), value_score(dump_claim)
    print("  honest codex : %5d packets → value %.2f" % (len(best["codex"]), honest_v))
    print("  dump codex   : %5d packets → value %.2f  (residual shrinks, codex explodes)"
          % (len(dump_claim["codex"]), dump_v))
    check("value formula prices the dump below the honest codex", dump_v < honest_v,
          "%.2f < %.2f — counting seed+codex+residual+chain closes the loophole" % (dump_v, honest_v))

    section("Attunement: crystallized knowledge as a prior (measured, not assumed)")
    primed = primed_from(wiki_a, 2, 400)
    attuned = build_codex(order=2, chunk_size=720, primed=primed)
    fresh_b, att_b = grow(wiki_b, prose), grow(wiki_b, attuned)
    res_fresh = sum(len(s) // 2 for s in fresh_b["streams"])
    res_att = sum(len(s) // 2 for s in att_b["streams"])
    eps = (res_fresh - res_att) / res_fresh
    print("  held-out wiki_b residual: fresh %d B → attuned %d B  (ε = %+.1f%% prediction uplift)"
          % (res_fresh, res_att, 100 * eps))
    print("  one-shot value: fresh %.2f vs attuned %.2f (attuned pays its %d-packet codex once)"
          % (value_score(fresh_b), value_score(att_b), len(att_b["codex"])))
    print("  amortized over 50 growths: attuned value %.2f" % value_score(att_b, 50))
    check("attunement uplift on same-domain held-out data is positive", eps > 0,
          "ε = %+.3f" % eps)
    fresh_n, att_n = grow(noise, prose), grow(noise, attuned)
    eps_n = (sum(len(s) // 2 for s in fresh_n["streams"])
             - sum(len(s) // 2 for s in att_n["streams"])) / sum(len(s) // 2 for s in fresh_n["streams"])
    check("attunement gives ~no uplift on entropy (honest null)", abs(eps_n) < 0.02,
          "ε = %+.3f" % eps_n)

    section("ABI gate: malformed unfolding logic never runs")
    bad_parity = [prose[0] ^ (1 << 33)] + prose[1:]
    bad_order = [pack(1, 7, (0, 0, 0, 0), 720, 0, 0), prose[-1]]
    bad_op = [prose[0], pack(11, 0, (0, 0, 0, 0), 0, 0, 0), prose[-1]]
    outcomes = []
    for name, cx in (("flipped bit (parity)", bad_parity),
                     ("order 7 (clamp)", bad_order),
                     ("unknown opcode FORM 11", bad_op)):
        try:
            parse_codex(cx); outcomes.append((name, False, ""))
        except ValueError as e:
            outcomes.append((name, True, str(e)))
    for name, ok, why in outcomes:
        print("    · %-26s → %s" % (name, why if ok else "ACCEPTED (bug!)"))
    check("all three malformed codexes rejected at parse", all(o[1] for o in outcomes))
    print("  halting: no jump opcodes exist — every codex halts by construction;")
    print("  fuel spent on honest wiki growth: %d (budget %d)"
          % (best["fuel"], FUEL_PER_BYTE * best["origBytes"] + 10000))

    section("Stability: bit-identical replay (the consensus requirement)")
    again = grow(wiki_a, prose)
    h1 = hashlib.sha256(repr(best).encode()).hexdigest()
    h2 = hashlib.sha256(repr(again).encode()).hexdigest()
    check("independent growth runs are bit-identical", h1 == h2)
    print("  golden claim hash: %s…" % h1[:32])

    section("Verdict")
    passed = sum(1 for _, ok in results if ok)
    for name, ok in results:
        print("  %s %s" % ("✓" if ok else "✗", name))
    print("\n  %d/%d codex-engine checks passed" % (passed, len(results)))
    return passed == len(results)


if __name__ == "__main__":
    main()
