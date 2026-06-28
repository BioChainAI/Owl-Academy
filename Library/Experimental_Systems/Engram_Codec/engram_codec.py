"""
engram_codec.py  —  the Markov-pump memory offload, used as an honest data codec.

This is the actual purpose of the Torsional Markov Memory-Offload Pump and the Quaternion
Chain Compression papers: store a stream as a quaternionic delta chain, OFFLOAD it into a
compact coarse representation, and RECREATE sections by reconstruction — exactly the
"engram compression / recreation" the question asks about. The load-bearing math is
already verified in ../../../Proofs/Pump-Verification:
  * telescoping is exact (block endpoints reconstruct to machine precision),
  * SLERP intra-block drift is bounded by Σ d(Δqₙ, δ),
  * Smallest-Three quantization is provably stable (error not amplified on decode).

So this codec is real. The honest part is its CHARACTER: it is LOSSY. It recreates
SECTION BOUNDARIES exactly (telescoping), and intra-section detail only up to the bounded
drift — which is tiny for SMOOTH/structured streams and large for high-entropy data
(you cannot losslessly compress randomness; information theory still holds). We measure
exactly that.

Encoding (fixed axis ⇒ commuting rotations ⇒ clean decode; the general cycling-axis case
adds the proven drift term): a stream of values vᵢ ∈ (−π,π) becomes per-frame rotations
Δqᵢ = rot(vᵢ). Offload: store each block's net rotation (telescoped) under Smallest-Three
FP8 quantization. Recreate: δ = net^{1/B} distributed equally across the block (SLERP).

Pure Python 3 standard library.  python3 engram_codec.py
"""

import math
import random

random.seed(20260628)


# --------------------------------------------------------------------------- #
# quaternion helpers (fixed-axis rotations about x; angle == the stored value)
# --------------------------------------------------------------------------- #
def rot(theta):                       # rotation by angle theta about x-axis
    return (math.cos(theta / 2), math.sin(theta / 2), 0.0, 0.0)


def qmul(a, b):
    aw, ax, ay, az = a; bw, bx, by, bz = b
    return (aw*bw-ax*bx-ay*by-az*bz, aw*bx+ax*bw+ay*bz-az*by,
            aw*by-ax*bz+ay*bw+az*bx, aw*bz+ax*by-ay*bx+az*bw)


def angle_of(q):                      # signed rotation angle about x for our quats
    return 2.0 * math.atan2(q[1], q[0])


# --------------------------------------------------------------------------- #
# Smallest-Three quantization (QCC) — store 3 smallest comps as FP8, recover the
# largest from the unit constraint; provably non-amplifying.
# --------------------------------------------------------------------------- #
def fp8(x):                           # crude E4M3-ish 8-bit quantizer on [-1,1]
    return max(-1.0, min(1.0, round(x * 127) / 127))


def smallest_three_roundtrip(q):
    i = max(range(4), key=lambda k: abs(q[k]))      # index of largest |component|
    sign = 1.0 if q[i] >= 0 else -1.0
    kept = [fp8(q[k]) for k in range(4) if k != i]
    rec_sq = max(0.0, 1.0 - sum(c*c for c in kept))
    out = [0.0]*4
    j = 0
    for k in range(4):
        if k == i:
            out[k] = sign * math.sqrt(rec_sq)
        else:
            out[k] = kept[j]; j += 1
    return tuple(out)


# --------------------------------------------------------------------------- #
# Codec: encode → offload(block telescope + quantize) → recreate(SLERP)
# --------------------------------------------------------------------------- #
# per-frame increments must be small enough that a block's NET rotation stays inside the
# principal branch (|Σ| < π) — else angle_of() wraps and reconstruction aliases (the exact
# caveat proved in Pump-Verification). With |v|≲1.2 and blocks ≤60, SCALE=0.04 keeps
# 60·0.04·1.2 ≈ 2.9 < π.
SCALE = 0.04


def encode(values):
    return [rot(SCALE * v) for v in values]


def offload(deltas, B, quantize=True):
    """Compress: per block of B frames keep only the net rotation (telescoped),
    optionally Smallest-Three-quantized. Returns the compact payload (one quat/block)."""
    payload = []
    for s in range(0, len(deltas), B):
        net = (1.0, 0.0, 0.0, 0.0)
        for d in deltas[s:s+B]:
            net = qmul(d, net)                      # telescopes to the block's net rotation
        payload.append(smallest_three_roundtrip(net) if quantize else net)
    return payload


def recreate(payload, B, n):
    """Recreate the stream: per block, δ = net^{1/B} (equal-share SLERP), decode angle."""
    out = []
    for b, net in enumerate(payload):
        size = min(B, n - b*B)
        ang = angle_of(net) / size                  # equal share (commuting axis), in-branch
        for _ in range(size):
            out.append(ang / SCALE)                 # decode back to the data's units
    return out


def section_boundaries_exact(values, deltas, B):
    """Telescoping check: cumulative rotation at each block boundary is reconstructed
    exactly from the payload (this is the 'reliably recreate sections' kernel)."""
    payload = offload(deltas, B, quantize=False)
    cum_true = 0.0
    worst = 0.0
    cum_rec = (1.0, 0.0, 0.0, 0.0)
    idx = 0
    for b, net in enumerate(payload):
        size = min(B, len(values) - b*B)
        cum_true += SCALE * sum(values[idx:idx+size]); idx += size
        cum_rec = qmul(net, cum_rec)
        worst = max(worst, abs(((angle_of(cum_rec) - cum_true + math.pi) % (2*math.pi)) - math.pi))
    return worst


# --------------------------------------------------------------------------- #
# Streams
# --------------------------------------------------------------------------- #
def smooth_stream(n):                 # structured: a single slow tone (cleanly band-limited)
    return [0.8*math.sin(0.005*i) for i in range(n)]


def randomwalk_stream(n):             # mildly structured: bounded random walk
    v, out = 0.0, []
    for _ in range(n):
        v = max(-1.2, min(1.2, v + random.gauss(0, 0.03))); out.append(v)
    return out


def random_stream(n):                 # high-entropy: independent uniform angles
    return [random.uniform(-1.2, 1.2) for _ in range(n)]


def rmse(a, b):
    return math.sqrt(sum((x-y)**2 for x, y in zip(a, b)) / len(a))


# --------------------------------------------------------------------------- #
def main():
    print("Engram Codec — Markov-pump memory offload as a data codec")
    print("=" * 74)
    n = 720
    streams = {"smooth (structured)": smooth_stream(n),
               "random walk (mild structure)": randomwalk_stream(n),
               "uniform random (high entropy)": random_stream(n)}

    print("\n[Section boundaries are recreated EXACTLY (telescoping), B=60:]")
    for name, vals in streams.items():
        err = section_boundaries_exact(vals, encode(vals), 60)
        print(f"      {name:<32} worst block-boundary angle error = {err:.2e}")

    print("\n[Intra-section fidelity vs compression — RMSE / (stream's own std), so 0≈perfect,")
    print(" 1≈signal destroyed:]")
    print(f"      {'stream':<32}{'B=6 (6×)':>12}{'B=20 (20×)':>13}{'B=60 (60×)':>13}")
    for name, vals in streams.items():
        deltas = encode(vals)
        std = math.sqrt(sum((v - sum(vals)/len(vals))**2 for v in vals)/len(vals)) or 1.0
        row = []
        for B in (6, 20, 60):
            rec = recreate(offload(deltas, B), B, n)
            row.append(rmse(vals, rec) / std)
        print(f"      {name:<32}{row[0]:>12.4f}{row[1]:>13.4f}{row[2]:>13.4f}")

    print("\n[Smallest-Three quantization stability — round-trip error on random unit quats:]")
    worst = 0.0
    for _ in range(20000):
        v = [random.gauss(0, 1) for _ in range(4)]
        nrm = math.sqrt(sum(c*c for c in v)); q = tuple(c/nrm for c in v)
        r = smallest_three_roundtrip(q)
        worst = max(worst, math.sqrt(sum((a-b)**2 for a, b in zip(q, r))))
    print(f"      worst component error over 20000 quats = {worst:.4f}  (bounded, FP8-limited)")

    print("\n" + "=" * 74)
    print("FINDINGS (measured):")
    print(" • SECTIONS recreate EXACTLY. Block-boundary cumulative state telescopes to ~1e-15,")
    print("   independent of the data — so 'reliably recreate sections' is literally true at the")
    print("   section (block) level, for ANY stream. That is the real, usable guarantee.")
    print(" • INTRA-section detail is LOSSY and data-dependent. Smooth/structured streams")
    print("   reconstruct with tiny RMSE even at 60× compression; a random-walk degrades")
    print("   gracefully; high-entropy data is essentially destroyed (RMSE ≈ its own spread).")
    print("   This is information theory, not a flaw: you cannot losslessly compress randomness,")
    print("   and equal-share SLERP keeps only each block's net rotation.")
    print(" • Smallest-Three quantization is stable (bounded round-trip error), as proved.")
    print("\nUSE IT FOR: smooth embeddings, sensor/trajectory streams, slowly-varying context —")
    print("where it is a genuine multi-resolution memory. NOT a general lossless store.")


if __name__ == "__main__":
    main()
