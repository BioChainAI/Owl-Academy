"""
harmonic_oracle.py  —  the refined (and honest) Oracle Bias experiment.

This implements the candidate oracle from the new papers — Harmonic Feature Embedding,
Pseudogroup Law of Quadrance Dynamics, Golden Strassen-Clifford Geodesic — faithfully,
and runs THEIR validation protocol. The exactness overreach is gone; the live claim is:

    Oracle Bias Hypothesis: does a c-warped harmonic embedding rank candidate pairs
    (i,j) so that useful collisions (x_i ≡ x_j mod p) appear more often than under
    uniform random sampling — i.e. is ε = P[hit | oracle] − P[hit | uniform] > 0?

The oracle scores the ACTUAL window states (Helix B computes them via O(√L)
checkpointing anyway), via:
  * harmonic embedding  Ψ(x) = (cos 2πx/N, sin 2πx/N)        [modularly invariant]
  * c-warped metric     g_c = [[1, κ·cos(2πc/N)],[·,1]]       [Harmonic paper Def 2.2]
  * proximity score     warped quadrance between Ψ(x_i), Ψ(x_j)
  * radial variant      |F(x_i) − F(x_j)|, F = quadrance from the seed [Pseudogroup §2]

Validation protocol (Harmonic paper §6):
  (1) Path-Length Linearity: fit L(i)=a·i+b, report R²  (tests Heuristic Assumption 4.1)
  (2) Collision Prediction:  measure ε with a 2σ significance band
  (3) Cost: the conditional-acceleration inequality (Pseudogroup Thm 5.1)

Heuristic scoring is float (the papers' "continuous oracle"); certification stays exact.
    python3 harmonic_oracle.py
"""

import math
import random
from helix_reference import (gen_semiprime, build_window, is_useful,
                             useful_pairs_count_in_window, oracle_uniform)

random.seed(20260628)


# --------------------------------------------------------------------------- #
# The harmonic embedding and c-warped metric
# --------------------------------------------------------------------------- #
def embed(x, N):
    a = 2 * math.pi * (x / N)
    return (math.cos(a), math.sin(a))


def warped_quadrance(pi, pj, kc):
    """(Δ)^T g_c (Δ),  g_c = [[1,kc],[kc,1]],  kc = κ·cos(2πc/N) with |kc|<1."""
    dx, dy = pi[0] - pj[0], pi[1] - pj[1]
    return dx * dx + dy * dy + 2 * kc * dx * dy


def oracle_harmonic(window, N, c, K, kappa=0.5):
    """Rank pairs by smallest c-warped harmonic quadrance (near-neighbors in the
    embedding). Cheap proxy for all-pairs: sort by angle, score short spans, keep top-K."""
    kc = kappa * math.cos(2 * math.pi * (c / N))
    emb = [embed(x, N) for x in window]
    order = sorted(range(len(window)), key=lambda i: math.atan2(emb[i][1], emb[i][0]))
    cand = []
    for t in range(len(order) - 1):
        for d in range(1, 5):
            if t + d < len(order):
                i, j = order[t], order[t + d]
                cand.append((warped_quadrance(emb[i], emb[j], kc), (min(i, j), max(i, j))))
    cand.sort(key=lambda z: z[0])
    seen, out = set(), []
    for _, pr in cand:
        if pr not in seen:
            seen.add(pr); out.append(pr)
        if len(out) >= K:
            break
    return out


def oracle_radial(window, N, c, K, kappa=0.5):
    """Pseudogroup §2: F(x) = quadrance from the seed; rank pairs with similar F."""
    se = embed(window[0], N)
    F = []
    for x in window:
        e = embed(x, N)
        F.append((e[0] - se[0]) ** 2 + (e[1] - se[1]) ** 2)
    order = sorted(range(len(window)), key=lambda i: F[i])
    out = []
    for t in range(len(order) - 1):
        i, j = order[t], order[t + 1]
        out.append((min(i, j), max(i, j)))
        if len(out) >= K:
            break
    return out


# --------------------------------------------------------------------------- #
# Validation protocol
# --------------------------------------------------------------------------- #
def path_length_R2(window, N):
    """(1) Fit cumulative embedded arc-length L(i)=a·i+b; return R² and slope a."""
    pts = [embed(x, N) for x in window]
    L = [0.0]
    for k in range(1, len(pts)):
        dx, dy = pts[k][0] - pts[k-1][0], pts[k][1] - pts[k-1][1]
        L.append(L[-1] + math.hypot(dx, dy))
    n = len(L)
    xs = list(range(n))
    mx, my = sum(xs)/n, sum(L)/n
    sxx = sum((x-mx)**2 for x in xs)
    sxy = sum((x-mx)*(y-my) for x, y in zip(xs, L))
    a = sxy/sxx
    b = my - a*mx
    ss_res = sum((y-(a*x+b))**2 for x, y in zip(xs, L))
    ss_tot = sum((y-my)**2 for y in L)
    r2 = 1 - ss_res/ss_tot if ss_tot > 0 else 1.0
    return r2, a


def measure(bits=16, L=2000, K=160, trials=40):
    oracles = {
        "uniform (baseline)": lambda w, N, c, K: oracle_uniform(w, K, random.Random(0)),
        "harmonic c-warped (proximity)": oracle_harmonic,
        "harmonic c-warped (radial)": oracle_radial,
    }
    agg = {k: [] for k in oracles}
    base_density, r2s = [], []
    for _ in range(trials):
        N, p, q = gen_semiprime(bits)
        c = random.randrange(1, N)
        window, _ck, _st = build_window(N, c, 2, L)
        upc = useful_pairs_count_in_window(window, p, N)
        base_density.append(upc / (L*(L-1)//2))
        r2, _a = path_length_R2(window, N)
        r2s.append(r2)
        for name, fn in oracles.items():
            cands = fn(window, N, c, K)
            agg[name].append(sum(1 for pr in cands if is_useful(window, p, N, pr)) / max(1, len(cands)))
    bd = sum(base_density)/trials
    r2m = sum(r2s)/trials
    uni = sum(agg["uniform (baseline)"])/trials
    print(f"  semiprimes p,q ~ {bits}-bit; window L={L}; top-K={K}; {trials} trials")
    print(f"\n(1) Path-Length Linearity (Heuristic Assumption 4.1):")
    print(f"      mean R² of L(i) ≈ a·i + b  = {r2m:.4f}")
    print(f"      → L(i) is essentially linear in i. The path-length feature is therefore")
    print(f"        ≈ the index itself; it carries almost no orbit-specific information.")
    print(f"\n(2) Collision Prediction — Oracle Bias ε  (baseline density {bd:.3e}):")
    print(f"      {'oracle':<34}{'hit-rate':>11}{'ε vs uniform (±2σ)':>26}")
    results = {}
    nS = K*trials
    for name in oracles:
        hr = sum(agg[name])/trials
        results[name] = hr
        if name.startswith("uniform"):
            print(f"      {name:<34}{hr:>11.3e}{'—':>26}")
        else:
            eps = hr - uni
            band = 2*math.sqrt(hr*(1-hr)/nS + uni*(1-uni)/nS)
            sig = "significant" if abs(eps) > band else "≈ 0 (within noise)"
            print(f"      {name:<34}{hr:>11.3e}   {eps:+.3e} ± {band:.1e}  {sig}")
    print(f"\n(3) Conditional acceleration (Pseudogroup Thm 5.1): even if ε>0, a net win needs")
    print(f"    ε·(useful pairs) to beat the O(√L) reconstruction + window overhead — see")
    print(f"    helix_reference.py work-accounting (currently ~100× against Helix).")
    return results, uni, bd, r2m


def main():
    print("Harmonic c-warped Oracle — running the papers' validation protocol")
    print("=" * 74)
    results, uni, bd, r2m = measure()

    print("\n" + "=" * 74)
    print("FINDINGS (measured):")
    sig = False
    for name, hr in results.items():
        if name.startswith("uniform"):
            continue
        eps = hr - uni
        band = 2*math.sqrt(hr*(1-hr)/(160*40) + uni*(1-uni)/(160*40))
        if eps > band:
            sig = True
    print(f" • Path-length linearizes (R²≈{r2m:.3f}) — so the geometric feature ≈ the index, and")
    print(f"   c only enters as a global constant warp (same for every pair). A global warp")
    print(f"   cannot align the embedding with the mod-p congruence structure of the orbit.")
    print(f" • Measured Oracle Bias ε is {'POSITIVE and significant — investigate!' if sig else 'within noise of 0 (no acceleration)'}.")
    print(f"   CRT view of WHY: x_i mod N ↔ (x_i mod p, x_i mod q). A useful collision needs")
    print(f"   x_i ≡ x_j mod p; such pairs differ by a multiple of p and are spread across")
    print(f"   [0,N) — NOT close in any value/harmonic metric. The embedding sees x_i mod N,")
    print(f"   which mixes both CRT parts, so proximity can't isolate the mod-p part.")
    print(" • The framework is sound and safe regardless: certification keeps every reported")
    print("   factor exact. This is the honest negative result for THIS embedding — and the")
    print("   bench will flip to POSITIVE the instant an embedding with real ε>0 is supplied.")


if __name__ == "__main__":
    main()
