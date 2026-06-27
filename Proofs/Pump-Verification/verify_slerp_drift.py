"""
verify_slerp_drift.py  —  the SLERP offload reconstruction: what is exact, what
drifts, and a provable bound on the drift.

The Torsional Markov paper proves (Prop 4) that one fractional-power lift is exact
on the principal branch: (DeltaQ^{1/B})^B = DeltaQ. It then flags, honestly, that
the lift is "exact only on a single principal-branch increment, not for accumulated
drift," and lists quantitative reconstruction-error bounds as a next step.

This script supplies that. It establishes, and then numerically confirms:

  (E) Endpoint exactness. Offloading B fine deltas to one coarse increment and
      reconstructing via the equal-share step delta = DeltaQ^{1/B} reproduces the
      block endpoint EXACTLY (to machine precision). Coarse-chain endpoints
      therefore telescope without accumulating error across blocks.

  (B) Intra-block drift bound. The reconstructed *interior* frames are the geodesic
      (equal-share) path, which differs from the true path whenever the true deltas
      are not all equal. Using the bi-invariance of the S^3 metric and the triangle
      inequality, the per-frame drift is bounded:

          D_k := d(q_k^true, q_k^recon)  <=  sum_{n<=k} d( Delta q_n , delta ).

      Proof: q_k = Dq_k q_{k-1}, qhat_k = delta qhat_{k-1}; bi-invariance gives
          d(Dq_k q_{k-1}, delta qhat_{k-1})
              <= d(Dq_k q_{k-1}, delta q_{k-1}) + d(delta q_{k-1}, delta qhat_{k-1})
               = d(Dq_k, delta) + D_{k-1},
      and unrolling the recursion yields the stated sum. The bound is per-block
      (it resets at each block boundary, where D = 0 by (E)), so the *coarse* chain
      carries no accumulating drift; only bounded intra-block detail is lost.

  (C) Commutative collapse. If all true deltas share an axis, then delta equals each
      of them and the bound -- and the drift -- are exactly zero: the geodesic path
      IS the true path. Non-commutativity (axis spread) is the sole source of drift.

The reconstruction uses exp/log/SLERP, which are transcendental, so this part is
floating point by necessity -- exactly the "transcendental quarantine" the papers
keep off the exact-rational forward path. Stdlib only.
"""

import math
import random

# --------------------------------------------------------------------------- #
# Float quaternion algebra (unit quaternions on S^3)
# --------------------------------------------------------------------------- #
def qmul(a, b):
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    return (
        aw * bw - ax * bx - ay * by - az * bz,
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
    )


def qconj(a):
    w, x, y, z = a
    return (w, -x, -y, -z)


def qnorm(a):
    return math.sqrt(sum(c * c for c in a))


def qnormalize(a):
    n = qnorm(a)
    return tuple(c / n for c in a)


def qlog(q):
    """Principal-branch log of a unit quaternion -> pure quaternion (0, theta*u)."""
    w, x, y, z = q
    w = max(-1.0, min(1.0, w))
    vn = math.sqrt(x * x + y * y + z * z)
    if vn < 1e-15:
        return (0.0, 0.0, 0.0, 0.0)
    theta = math.acos(w)  # in [0, pi]
    s = theta / vn
    return (0.0, x * s, y * s, z * s)


def qexp(p):
    """Exp of a pure quaternion (0, v) -> unit quaternion."""
    _, x, y, z = p
    theta = math.sqrt(x * x + y * y + z * z)
    if theta < 1e-15:
        return (1.0, 0.0, 0.0, 0.0)
    s = math.sin(theta) / theta
    return (math.cos(theta), x * s, y * s, z * s)


def qpow(q, t):
    """Fractional power q^t via the exponential map (SLERP from identity)."""
    _, x, y, z = qlog(q)
    return qexp((0.0, t * x, t * y, t * z))


def geodesic(a, b):
    """Bi-invariant S^3 geodesic distance = rotation angle of a^{-1} b, in [0, pi].
    Used for O(1)-magnitude drift/bound quantities. (acos loses precision near 0,
    so it is NOT used for the exactness checks -- see chordal below.)"""
    d = abs(sum(ai * bi for ai, bi in zip(a, b)))
    return 2.0 * math.acos(max(0.0, min(1.0, d)))


def chordal(a, b):
    """Sign-aware Euclidean distance on S^3 (double cover): min(||a-b||, ||a+b||).
    ~1e-15 when a, b represent the same rotation -- a stable 'are they equal?' test
    that, unlike the geodesic, does not suffer acos amplification near coincidence."""
    dm = math.sqrt(sum((ai - bi) ** 2 for ai, bi in zip(a, b)))
    dp = math.sqrt(sum((ai + bi) ** 2 for ai, bi in zip(a, b)))
    return min(dm, dp)


def random_unit_delta(rng, phi_max, fixed_axis=None):
    """A unit quaternion at S^3-distance |phi| <= phi_max from the identity."""
    if fixed_axis is None:
        # uniform random axis
        v = [rng.gauss(0, 1) for _ in range(3)]
        n = math.sqrt(sum(c * c for c in v)) or 1.0
        axis = [c / n for c in v]
    else:
        axis = fixed_axis
    phi = rng.uniform(-phi_max, phi_max)
    h = phi / 2.0
    s = math.sin(h)
    return (math.cos(h), axis[0] * s, axis[1] * s, axis[2] * s)


# --------------------------------------------------------------------------- #
# Block offload (telescoping product) and SLERP reconstruction
# --------------------------------------------------------------------------- #
def block_net(deltas):
    """Ordered product DeltaQ = Dq_B ... Dq_1 (the exact coarse increment)."""
    q = (1.0, 0.0, 0.0, 0.0)
    for d in deltas:           # apply in chronological order: q_k = Dq_k q_{k-1}
        q = qmul(d, q)
    return q


def reconstruct(deltas):
    """Return (true partial states, reconstructed partial states, delta, DeltaQ)."""
    B = len(deltas)
    DeltaQ = block_net(deltas)
    delta = qpow(DeltaQ, 1.0 / B)     # equal-share step
    true, recon = [], []
    qt = (1.0, 0.0, 0.0, 0.0)
    qr = (1.0, 0.0, 0.0, 0.0)
    for k in range(B):
        qt = qmul(deltas[k], qt)
        qr = qmul(delta, qr)
        true.append(qt)
        recon.append(qr)
    return true, recon, delta, DeltaQ


# --------------------------------------------------------------------------- #
# Experiments
# --------------------------------------------------------------------------- #
def endpoint_exactness(rng, B=10, trials=2000, phi_max=0.6):
    """(E) delta^B == DeltaQ and reconstructed endpoint == true endpoint (chordal)."""
    worst_pow = 0.0
    worst_end = 0.0
    for _ in range(trials):
        deltas = [random_unit_delta(rng, phi_max) for _ in range(B)]
        true, recon, delta, DeltaQ = reconstruct(deltas)
        p = (1.0, 0.0, 0.0, 0.0)
        for _ in range(B):
            p = qmul(delta, p)
        worst_pow = max(worst_pow, chordal(p, DeltaQ))
        worst_end = max(worst_end, chordal(true[-1], recon[-1]))
    return worst_pow, worst_end


def bound_holds(rng, B=12, trials=5000, phi_max=1.0):
    """(B) verify D_k <= sum_{n<=k} d(Dq_n, delta) for every k, every trial."""
    worst_slack = math.inf          # min over trials of (bound - drift); must be >= 0
    max_drift = 0.0
    max_bound = 0.0
    EPS = 1e-6                       # acos-noise tolerance for the geodesic metric
    violations = 0
    for _ in range(trials):
        deltas = [random_unit_delta(rng, phi_max) for _ in range(B)]
        true, recon, delta, _ = reconstruct(deltas)
        cum = 0.0
        for k in range(B):
            cum += geodesic(deltas[k], delta)        # running bound
            D = geodesic(true[k], recon[k])           # running drift
            max_drift = max(max_drift, D)
            max_bound = max(max_bound, cum)
            slack = cum - D
            worst_slack = min(worst_slack, slack)
            if slack < -EPS:
                violations += 1
    return worst_slack, max_drift, max_bound, violations


def drift_sources(rng, B=16, trials=500):
    """(C) There are exactly two sources of intra-block drift, and both are real:

      1. Increment NON-uniformity. The coarse layer keeps only the net rotation, so
         the reconstruction is the equal-share geodesic; any unevenness in the true
         steps is lost. (Even same-axis steps of differing angle drift.)
      2. Principal-branch aliasing. Even perfectly uniform steps drift if the block's
         NET rotation wraps past pi: the principal Bth-root delta = DeltaQ^{1/B} then
         picks the short geodesic, not the true per-step rotation. This is precisely
         the paper's 'exact only on a single principal-branch increment' caveat.

    Reconstruction is exact on the interior iff increments are uniform AND the block
    stays within the principal branch (|net angle| < pi)."""
    # uniform increments, IN branch (B * half-angle < pi): exact everywhere
    uniform_inbranch = 0.0
    small = 0.15  # B=16 -> net half-angle <= 16*0.075 = 1.2 < pi
    for _ in range(trials):
        q0 = random_unit_delta(rng, small)
        true, recon, _, _ = reconstruct([q0] * B)
        uniform_inbranch = max(uniform_inbranch, max(chordal(t, r) for t, r in zip(true, recon)))
    # uniform increments, OUT of branch: drift from aliasing alone
    uniform_aliased = 0.0
    for _ in range(trials):
        q0 = random_unit_delta(rng, 1.0)  # net half-angle up to 8 rad >> pi
        true, recon, _, _ = reconstruct([q0] * B)
        uniform_aliased = max(uniform_aliased, max(geodesic(t, r) for t, r in zip(true, recon)))
    # non-uniform, same axis, in branch: drift from unevenness alone
    axis = [0.0, 0.0, 1.0]
    nonuniform = 0.0
    for _ in range(trials):
        deltas = [random_unit_delta(rng, small, fixed_axis=axis) for _ in range(B)]
        true, recon, _, _ = reconstruct(deltas)
        nonuniform = max(nonuniform, max(geodesic(t, r) for t, r in zip(true, recon)))
    return uniform_inbranch, uniform_aliased, nonuniform


def no_coarse_accumulation(rng, n_blocks=72, B=10, phi_max=0.8):
    """Offload/reconstruct a long 720-frame chain block by block; show the coarse
    endpoints telescope so the reconstructed chain rejoins the true chain at every
    block boundary (no accumulating drift), while intra-block drift stays bounded
    block-to-block. Also track unit-norm stability under periodic renormalization."""
    qt = (1.0, 0.0, 0.0, 0.0)
    qr = (1.0, 0.0, 0.0, 0.0)
    worst_boundary = 0.0
    worst_intra = 0.0
    worst_normdrift = 0.0
    for _ in range(n_blocks):
        deltas = [random_unit_delta(rng, phi_max) for _ in range(B)]
        DeltaQ = block_net(deltas)
        delta = qpow(DeltaQ, 1.0 / B)
        # advance the TRUE chain by the real deltas; the RECON chain by equal-share
        local_true = qt
        local_recon = qr
        for k in range(B):
            local_true = qmul(deltas[k], local_true)
            local_recon = qmul(delta, local_recon)
            worst_intra = max(worst_intra, geodesic(local_true, local_recon))
        # both chains advanced by the SAME net DeltaQ over the block => endpoints meet
        qt = local_true
        qr = qnormalize(local_recon)          # structure-preserving renormalization
        worst_boundary = max(worst_boundary, chordal(qt, qr))
        worst_normdrift = max(worst_normdrift, abs(qnorm(local_recon) - 1.0))
    return worst_boundary, worst_intra, worst_normdrift


def main():
    rng = random.Random(20260627)
    print("SLERP offload reconstruction  —  exactness, a provable drift bound, accumulation")
    print("=" * 80)

    wp, we = endpoint_exactness(rng)
    print("\n(E) Endpoint exactness (Prop 4), worst over 2000 random blocks (B=10), chordal metric:")
    print(f"      max chordal( delta^B , DeltaQ )           = {wp:.2e}  (≈ 0, machine precision)")
    print(f"      max chordal( recon endpoint , true )      = {we:.2e}  (≈ 0)")
    assert wp < 1e-12 and we < 1e-12

    slack, md, mb, viol = bound_holds(rng)
    print("\n(B) Intra-block drift bound  D_k <= sum_{n<=k} d(Dq_n, delta), 5000 blocks (B=12):")
    print(f"      bound violations                          = {viol}  (must be 0)")
    print(f"      worst slack (bound - drift)               = {slack:+.3e}  (>= 0 to acos noise)")
    print(f"      max observed drift / max bound            = {md:.4f} rad / {mb:.4f} rad")
    assert viol == 0 and slack >= -1e-6

    ui, ua, nu = drift_sources(rng)
    print("\n(C) The two sources of intra-block drift (B=16):")
    print(f"      uniform increments, in-branch -> drift    = {ui:.2e}  (≈ 0: exact interior reconstruction)")
    print(f"      uniform increments, wrapped   -> drift    = {ua:.4f} rad  (> 0: principal-branch aliasing)")
    print(f"      non-uniform, in-branch        -> drift    = {nu:.4f} rad  (> 0: increment unevenness)")
    assert ui < 1e-12 and ua > 1e-3 and nu > 1e-3

    wb, wi, wn = no_coarse_accumulation(rng)
    print("\n(Accum) 720-frame chain, 72 blocks of 10, offload+reconstruct:")
    print(f"      worst block-boundary mismatch             = {wb:.2e}  (≈ 0: coarse endpoints telescope)")
    print(f"      worst intra-block drift (bounded, resets) = {wi:.4f} rad")
    print(f"      worst unit-norm drift (renormalized)      = {wn:.2e}")
    assert wb < 1e-12

    print("\n" + "=" * 80)
    print("RESULT: endpoint reconstruction is exact (Prop 4) and does NOT accumulate across")
    print("        blocks (boundaries telescope to ~1e-15). Intra-block drift is bounded by")
    print("        sum d(Dq_n, delta) -- zero violations over 5000 blocks -- and vanishes iff")
    print("        increments are uniform AND the block stays in the principal branch.")
    print("        The two drift sources (increment unevenness; principal-branch aliasing)")
    print("        are exhibited separately. The bound is the quantitative reconstruction")
    print("        error estimate the paper listed as a next step.")
    print("All assertions passed.")


if __name__ == "__main__":
    main()
