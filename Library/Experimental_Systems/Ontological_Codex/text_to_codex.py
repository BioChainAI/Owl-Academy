"""
text_to_codex.py — convert low-dimensional data (text tokens) into SHD-CCP quaternion
chains, the front-end to the Ontological Codex.

Pipeline (text -> packets -> 72-node toroids -> codex offload -> re-creatable chain):

  text → tokenize → keys[]          (token ids — the EXACT, lossless SYMBOL channel)
       → per token: feature → unit quaternion q_token  (the GEOMETRY channel)
       → chain deltas Δq_n = q_n q_{n-1}^{-1}
       → pack each into a 64-bit SHD-CCP "Einstein-tile" packet (Form ID master switch)
       → place token n at node (n mod 72) on toroid (n // 72)
       → feed states[] into the Ontological Codex offload (720→72→10)

Two recovery targets, kept as SEPARATE channels (the key design decision):
  • TEXT  — recovered from keys[] (token ids). Exact, independent of geometry precision.
  • CHAIN — recovered from the quaternion deltas. Precision is the Form-ID choice.

Packet forms (matching the SHD-CCP master-switch diagrams):
  • Form 0–2  Default Scaling (LOSSY): quaternion stored as 4×FP8(E4M3); decode is
              truncated → ~2.4°/packet, and it DECAYS over a sequential chain.
  • Form 3    High-Precision Correction (LOSSLESS): FP8 + a corrective offset (the
              residual) → perfect reconstruction. The FP-world form of the codex's
              exact-rational deltas.
  v1 shows BOTH so the lossy decay is visible, then defaults to Form 3 / rational.

Feature sources (selectable):
  • 'ttmpt'     XOR-crystallization of the token's characters → 64-bit crystal (default)
  • 'generic'   deterministic hash embedding of the token id
  • 'sparsemax' the 64-voxel (Z/4Z)^3 lattice spinor at (token id mod 64) — on-architecture

Pure Python 3 standard library.   python3 text_to_codex.py
"""

import math, re
from fractions import Fraction as F

SAMPLE = ("the quaternion codex compresses language into a winding chain of rotations "
          "where every token becomes a node on a golden toroid and the deltas telescope "
          "so the structure can be re created and processed by other systems the codex "
          "keeps the text exact through keys while the geometry rides the rotation chain "
          "the quaternion codex compresses language into a winding chain of rotations")

# --------------------------------------------------------------------------- #
# quaternion ops (float; mirrors ontological_codex.py)
# --------------------------------------------------------------------------- #
def qmul(a, b):
    w1,x1,y1,z1=a; w2,x2,y2,z2=b
    return (w1*w2-x1*x2-y1*y2-z1*z2, w1*x2+x1*w2+y1*z2-z1*y2,
            w1*y2-x1*z2+y1*w2+z1*x2, w1*z2+x1*y2-y1*x2+z1*w2)
def qconj(a): w,x,y,z=a; return (w,-x,-y,-z)
def qinv(a):  return qconj(a)
def qnorm(a):
    n=math.sqrt(sum(c*c for c in a)) or 1.0
    return tuple(c/n for c in a)
def geo_angle(a,b):
    d=abs(sum(p*q for p,q in zip(a,b)))
    return 2*math.acos(max(-1.0,min(1.0,d)))
def qf(a): return tuple(float(c) for c in a)

# --------------------------------------------------------------------------- #
# tokenizer + vocabulary  (the SYMBOL channel)
# --------------------------------------------------------------------------- #
def tokenize(text):
    toks = re.findall(r"[A-Za-z0-9']+|[^\sA-Za-z0-9]", text.lower())
    vocab = {}
    keys = []
    for t in toks:
        if t not in vocab: vocab[t] = len(vocab)
        keys.append(vocab[t])
    inv = {i: t for t, i in vocab.items()}
    return toks, keys, vocab, inv

def detokenize(keys, inv):
    return " ".join(inv[k] for k in keys)

# --------------------------------------------------------------------------- #
# feature sources  (token -> 3-vector -> unit quaternion position on S^3)
# --------------------------------------------------------------------------- #
SPREAD = 0.55       # keeps token positions in an annulus (w bounded away from 0)

def _mix(seed):
    s = seed & 0xffffffff
    s = (s + 0x6D2B79F5) & 0xffffffff
    t = (s ^ (s >> 15)) * (1 | s) & 0xffffffff
    t = (t + ((t ^ (t >> 7)) * (61 | t) & 0xffffffff)) ^ t & 0xffffffff
    return (t ^ (t >> 14)) & 0xffffffff

def ttmpt_crystal(token):
    """Faithful-compact TTMPT XOR crystallization: per-character 64-bit boolean grid
    (Mulberry-streamed from the char code), XOR-accumulated into a 64-bit crystal."""
    acc = 0
    for ch in token:
        s = (ord(ch) * 2654435761) & 0xffffffff
        grid = 0
        for b in range(64):
            s = _mix(s)
            grid |= ((s >> 11) & 1) << b
        acc ^= grid
    return acc & ((1 << 64) - 1)

def _vec_from_bits(v64):
    """64-bit value -> signed 3-vector in [-SPREAD, SPREAD]^3."""
    a = (v64 & 0x1FFFFF) / 0x1FFFFF
    b = ((v64 >> 21) & 0x1FFFFF) / 0x1FFFFF
    c = ((v64 >> 42) & 0x3FFFFF) / 0x3FFFFF
    return ((a*2-1)*SPREAD, (b*2-1)*SPREAD, (c*2-1)*SPREAD)

def _cayley(v):
    """Inverse stereographic R^3 -> S^3 unit quaternion (w in annulus for |v|<1)."""
    vx, vy, vz = v
    n = 1 + vx*vx + vy*vy + vz*vz
    return ((1-(vx*vx+vy*vy+vz*vz))/n, 2*vx/n, 2*vy/n, 2*vz/n)

# 64-voxel lattice for the sparsemax source
def _rquatV(vx, vy, vz):
    n = 1 + vx*vx + vy*vy + vz*vz
    return ((1-(vx*vx+vy*vy+vz*vz))/n, 2*vx/n, 2*vy/n, 2*vz/n)
LATTICE = [ _rquatV(F(2*(i//16%4)-3,8), F(2*(i//4%4)-3,8), F(2*(i%4)-3,8)) for i in range(64) ]

def token_quat(source, token_str, token_id):
    if source == 'ttmpt':
        return _cayley(_vec_from_bits(ttmpt_crystal(token_str)))
    if source == 'generic':
        return _cayley(_vec_from_bits(_mix(token_id*2654435761) |
                                      (_mix(token_id*40503) << 32)))
    if source == 'sparsemax':
        return qf(LATTICE[token_id % 64])
    raise ValueError(source)

# --------------------------------------------------------------------------- #
# 64-bit SHD-CCP packet (Einstein-tile layout from the diagrams)
#   63-48 Payload Scaler FP16 | 47-43 Freq(5) | 42-40 Spin(3) | 39-36 Form(4)
#   35-33 Amp(3) | 32 Parity(1) | 31-24 W | 23-16 X | 15-8 Y | 7-0 Z   (FP8 E4M3)
# --------------------------------------------------------------------------- #
def f32_e4m3(f):
    if f == 0: return 0
    sign = 1 if f < 0 else 0; f = abs(f)
    e = max(-6, min(8, math.floor(math.log2(f))))
    m = max(0, min(7, round((f/(2**e) - 1)*8)))
    return (sign << 7) | (((e+7) & 0xF) << 3) | m
def e4m3_f32(b):
    sign = -1 if (b >> 7) & 1 else 1; e = ((b >> 3) & 0xF) - 7; m = b & 0x7
    if ((b >> 3) & 0xF) == 0: return sign * (2**-6) * (m/8)
    return sign * (2**e) * (1 + m/8)
def f16(f):
    if f == 0: return 0
    sign = 0x8000 if f < 0 else 0; f = abs(f)
    e = max(-14, min(15, math.floor(math.log2(f))))
    m = max(0, min(1023, round((f/(2**e) - 1)*1024)))
    return sign | (((e+15) & 0x1F) << 10) | m
def f16_f(h):
    sign = -1 if h & 0x8000 else 1; e = ((h >> 10) & 0x1F) - 15; m = h & 0x3FF
    if ((h >> 10) & 0x1F) == 0: return sign * (2**-14) * (m/1024)
    return sign * (2**e) * (1 + m/1024)

def pack(q, scaler=1.0, form=0, freq=0, spin=0, amp=0):
    qn = qf(q)
    w,x,y,z = (f32_e4m3(c) for c in qn)
    par = (bin(w ^ x ^ y ^ z).count('1')) & 1
    p = ((f16(scaler) & 0xFFFF) << 48) | ((freq & 0x1F) << 43) | ((spin & 0x7) << 40) \
        | ((form & 0xF) << 36) | ((amp & 0x7) << 33) | (par << 32) \
        | (w << 24) | (x << 16) | (y << 8) | z
    return p

def unpack(p):
    form = (p >> 36) & 0xF; par = (p >> 32) & 1
    w,x,y,z = (p >> 24) & 0xFF, (p >> 16) & 0xFF, (p >> 8) & 0xFF, p & 0xFF
    par_ok = ((bin(w ^ x ^ y ^ z).count('1')) & 1) == par
    q = (e4m3_f32(w), e4m3_f32(x), e4m3_f32(y), e4m3_f32(z))
    return qnorm(q), form, par_ok

def correction(q):
    """Form-3 corrective offset: residual between the true quaternion and its FP8
    truncation. Adding it back on decode gives perfect reconstruction (image 3)."""
    qn = qf(q)
    trunc = (e4m3_f32(f32_e4m3(c)) for c in qn)
    return tuple(c - t for c, t in zip(qn, trunc))

def decode_corrected(p, corr):
    qn = (e4m3_f32((p >> 24) & 0xFF), e4m3_f32((p >> 16) & 0xFF),
          e4m3_f32((p >> 8) & 0xFF), e4m3_f32(p & 0xFF))
    return qnorm(tuple(t + c for t, c in zip(qn, corr)))

# --------------------------------------------------------------------------- #
# codex offload (720->72->10), compact mirror of ontological_codex.py
# --------------------------------------------------------------------------- #
GROUP = 10
def outer_deltas(states): return [qmul(states[n], qinv(states[n-1])) for n in range(1, len(states))]
def middle_blocks(o):
    nmid = len(o) // GROUP; b = []
    for m in range(nmid):
        net = o[GROUP*m]
        for r in range(1, GROUP): net = qmul(o[GROUP*m+r], net)
        b.append(net)
    return b
def qpow(a, t):
    vn = math.sqrt(a[1]**2+a[2]**2+a[3]**2)
    if vn < 1e-15: return (1.0,0,0,0)
    th = math.atan2(vn, max(-1,min(1,a[0]))); s = math.sin(t*th)
    return (math.cos(t*th), s*a[1]/vn, s*a[2]/vn, s*a[3]/vn)
def recon_outer(s, o):
    r=[s[0]]
    for d in o: r.append(qmul(d, r[-1]))
    return r
def recon_middle(s, blocks):
    r=[s[0]]
    for b in blocks:
        step = qpow(b, 1.0/GROUP)
        for _ in range(GROUP): r.append(qmul(step, r[-1]))
    return r[:len(s)]
def rmse(a, b):
    n = min(len(a), len(b))
    return math.sqrt(sum(geo_angle(a[i], b[i])**2 for i in range(n)) / n)

# --------------------------------------------------------------------------- #
# the conversion + measurements
# --------------------------------------------------------------------------- #
def convert(text, source):
    toks, keys, vocab, inv = tokenize(text)
    states = [token_quat(source, toks[i], keys[i]) for i in range(len(toks))]
    deltas = outer_deltas(states)               # Δq_n, n=1..K-1
    # pack each delta two ways
    packets = [pack(d, form=0) for d in deltas]                 # Form 0-2 default (lossy)
    corrs   = [correction(d) for d in deltas]                   # Form 3 corrective offsets
    # --- decode lossy (Form 0-2) and compose -> chain decay ---
    dl = [unpack(p)[0] for p in packets]
    states_lossy = recon_outer(states, dl)
    # --- decode corrected (Form 3) and compose -> lossless ---
    dc = [decode_corrected(packets[i], corrs[i]) for i in range(len(packets))]
    states_corr = recon_outer(states, dc)
    return dict(toks=toks, keys=keys, vocab=vocab, inv=inv, states=states,
                deltas=deltas, packets=packets, corrs=corrs,
                states_lossy=states_lossy, states_corr=states_corr)

def main():
    print("Text → SHD-CCP Quaternion Codex — low-dim data into quaternion chains")
    print("=" * 78)
    text = SAMPLE
    print(f"  input: {len(text)} chars; sample text ({len(text.split())} words)")

    for source in ('ttmpt', 'generic', 'sparsemax'):
        r = convert(text, source)
        K = len(r['toks']); V = len(r['vocab'])

        # ---- TEXT channel: exact recovery from keys ----
        back = detokenize(r['keys'], r['inv'])
        # compare token sequences (detok inserts spaces; compare token lists)
        text_exact = (r['keys'] == [ {t:i for i,t in r['inv'].items()}[w] for w in back.split() ])
        toks_match = all(r['inv'][r['keys'][i]] == r['toks'][i] for i in range(K))

        # ---- per-packet FP8 round-trip (single packet, lossy) ----
        e_single = max(geo_angle(r['deltas'][i], unpack(r['packets'][i])[0]) for i in range(len(r['deltas']))) \
                   if r['deltas'] else 0.0

        # ---- composed chain: lossy decay vs corrected lossless ----
        e_lossy = rmse(r['states'], r['states_lossy'])
        e_corr  = rmse(r['states'], r['states_corr'])
        drift_lossy = geo_angle(r['states'][-1], r['states_lossy'][-1])
        drift_corr  = geo_angle(r['states'][-1], r['states_corr'][-1])

        # ---- parity integrity ----
        par_ok = all(unpack(p)[2] for p in r['packets'])

        print(f"\n  ── source: {source} ──   tokens={K}, vocab={V}")
        print(f"    TEXT recovery (keys → tokens) ....... {'EXACT ✓' if (text_exact and toks_match) else 'FAIL'}")
        print(f"    packet parity-bit integrity ......... {'ok ✓' if par_ok else 'FAIL'}")
        print(f"    single-packet FP8 error ............. {math.degrees(e_single):.2f}°  (lossy)")
        print(f"    CHAIN Form 0-2 (lossy)  RMSE/finaldrift {e_lossy:.3f} / {drift_lossy:.3f} rad  ← decays")
        print(f"    CHAIN Form 3 (corrected) RMSE/drift ..  {e_corr:.2e} / {drift_corr:.2e} rad  ← lossless")

        # ---- codex rate–distortion dial on complete 10-blocks ----
        ncomplete = (len(r['deltas']) // GROUP) * GROUP
        if ncomplete >= GROUP:
            o = r['deltas'][:ncomplete]; st = r['states'][:ncomplete+1]
            blocks = middle_blocks(o)
            e_o = rmse(st, recon_outer(st, o))
            e_m = rmse(st, recon_middle(st, blocks))
            print(f"    codex dial: store outer(720-style)={e_o:.1e} rad (exact) · "
                  f"store middle(10×)={e_m:.3f} rad")

        # ---- compression accounting (BOTH channels) ----
        keybits = K * max(1, math.ceil(math.log2(max(2, V))))
        geo_outer = len(r['deltas']) * 64
        raw = len(text) * 8
        print(f"    storage: keys {keybits} b + outer-geometry {geo_outer} b  "
              f"(raw text {raw} b → key stream alone is {raw/max(1,keybits):.1f}× SMALLER than raw text)")

        # ---- 72-node placement (first few) ----
        place = ", ".join(f"{r['toks'][i]}→n{i%72}/t{i//72}" for i in range(min(6, K)))
        print(f"    placement (node = i mod 72, toroid = i // 72): {place} …")

    print("\n" + "=" * 78)
    print("FINDINGS (measured):")
    print(" • TWO channels, both recovered: TEXT is exact from the key stream (token ids),")
    print("   independent of geometry precision; the geometric CHAIN is the quaternion deltas.")
    print(" • The default lossy packet (Form 0-2) DECAYS over the chain (the diagram's warning,")
    print("   measured: ~2-3° per packet compounding to radians of final drift). Form 3's")
    print("   corrective offset reconstructs the chain LOSSLESSLY (RMSE ~1e-9).")
    print(" • TTMPT crystallization gives hash-like (avalanche) token positions, so consecutive")
    print("   deltas are high-entropy: the OUTER scale is lossless, but middle/inner SLERP")
    print("   reconstruction is lossy — exactly as measured for the random source in the codex.")
    print("   A locally-correlated embedding would compress the geometry better; the key stream")
    print("   keeps the text exact regardless. (Honest: hashing does not create compressibility.)")
    print(" • Each token packs into a 64-bit Einstein-tile packet (Form-ID master switch) and")
    print("   places at node (i mod 72) on toroid (i // 72), feeding the Ontological Codex offload.")


if __name__ == "__main__":
    main()
