"""
verify_clifford_winding.py  —  the Golden Strassen Clifford Toroid, checked.

The "Introduction to 4D Coordinate Geometry" note is, unlike the ECDLP material, made
almost entirely of correct classical mathematics. This script verifies the parts that
are true and is explicit about the one line that overreaches.

VERIFIED TRUE (and useful to the pump project):
  1. Golden radii. With r1 = phi*r2 and r1^2 + r2^2 = 1, the identity phi^2 = phi + 1
     forces  r2^2 = 1/(phi+2),  r1^2 = phi^2/(phi+2).  We check this EXACTLY in the
     ring Z[phi] = Q(sqrt 5): r1^2 + r2^2 = 1 and (r1/r2)^2 = phi^2, with no rounding.
  2. The torus sits on the unit 3-sphere S^3 (x1^2+y1^2+x2^2+y2^2 = r1^2+r2^2 = 1).
  3. Intrinsic flatness. The first fundamental form of the embedding is
     ds^2 = r1^2 dtheta^2 + r2^2 dgamma^2 -- constant coefficients, F = 0 -> Gaussian
     curvature K = 0 everywhere. (A 3D torus of revolution does NOT have this.)
  4. Ergodic winding. A line theta = a t, gamma = b t closes iff a/b is rational; for
     irrational a/b it equidistributes (Weyl). The golden ratio is the *most badly
     approximable* irrational (continued fraction [1;1,1,...]), so golden winding has
     the lowest discrepancy of all -- the most uniform coverage. We measure this.

OVERREACH (flagged, not endorsed):
  The note's closing phrase "providing an ideal O(1) lookup manifold." Ergodic winding
  gives uniform *coverage*; it does not give *constant-time lookup*. Locating the time t
  whose winding point lands near a target is itself a nontrivial inverse problem (an
  inhomogeneous Diophantine approximation), not an O(1) address. Equidistribution makes
  the winding an excellent low-discrepancy *sampler* of the torus -- which is exactly
  why it is the right way to choose the pumps' incommensurate gear ratios -- but a
  sampler is not an oracle.

Relevance to the pumps: unit quaternions live on S^3, of which the Clifford torus is a
flat slice (Hopf coordinates); and the Torsional pump's deliberately non-aligning gear
ratio (72/10 = 7.2 frames per tooth) is precisely a winding chosen so the phases do not
recur -- the rational cousin of this golden construction.

Exact part uses Q[phi]; the equidistribution measurements are ordinary floating point.
Stdlib only.
"""

import math
from fractions import Fraction as F

PHI = (1 + 5 ** 0.5) / 2


# --------------------------------------------------------------------------- #
# Exact arithmetic in Q[phi] = Q(sqrt 5),  phi^2 = phi + 1
# --------------------------------------------------------------------------- #
class QPhi:
    """a + b*phi with a, b in Q. Closed field arithmetic; phi^2 reduces to phi+1."""
    __slots__ = ("a", "b")

    def __init__(self, a, b=0):
        self.a, self.b = F(a), F(b)

    def __add__(s, o): return QPhi(s.a + o.a, s.b + o.b)
    def __sub__(s, o): return QPhi(s.a - o.a, s.b - o.b)

    def __mul__(s, o):
        # (a+b phi)(c+d phi) = ac + (ad+bc) phi + bd phi^2 = (ac+bd) + (ad+bc+bd) phi
        return QPhi(s.a * o.a + s.b * o.b, s.a * o.b + s.b * o.a + s.b * o.b)

    def inverse(s):
        # conjugate uses phi_bar = 1 - phi; norm = a^2 + ab - b^2  (rational)
        norm = s.a * s.a + s.a * s.b - s.b * s.b
        assert norm != 0, "non-invertible element of Q[phi]"
        return QPhi((s.a + s.b) / norm, -s.b / norm)

    def __truediv__(s, o): return s * o.inverse()
    def __eq__(s, o): return s.a == o.a and s.b == o.b
    def value(s): return float(s.a) + float(s.b) * PHI
    def __repr__(s): return f"({s.a} + {s.b}·phi)"


def verify_golden_radii():
    phi = QPhi(0, 1)
    one = QPhi(1, 0)

    # the defining identity, exactly
    assert phi * phi == phi + one, "phi^2 = phi + 1 failed"

    # r2^2 = 1/(phi+2),  r1^2 = phi^2 * r2^2  (from r1 = phi r2)
    r2sq = (phi + QPhi(2)).inverse()
    r1sq = (phi * phi) * r2sq

    # closed forms (rationalized): r2^2 = (3-phi)/5, r1^2 = (phi+2)/5
    assert r2sq == QPhi(F(3, 5), F(-1, 5)), "r2^2 closed form mismatch"
    assert r1sq == QPhi(F(2, 5), F(1, 5)), "r1^2 closed form mismatch"

    # the two structural constraints, exact
    assert r1sq + r2sq == one, "r1^2 + r2^2 = 1 failed exactly"
    assert r1sq * r2sq.inverse() == phi * phi, "(r1/r2)^2 = phi^2 failed exactly"

    return r1sq, r2sq


def verify_on_s3_and_flat(r1sq, r2sq, samples=24):
    """The torus lies on S^3, and its first fundamental form has constant coefficients
    (E=r1^2, F=0, G=r2^2) -> intrinsically flat (Gaussian curvature 0)."""
    r1 = math.sqrt(r1sq.value())
    r2 = math.sqrt(r2sq.value())

    def P(th, ga):
        return (r1 * math.cos(th), r1 * math.sin(th), r2 * math.cos(ga), r2 * math.sin(ga))

    def dP_dth(th, ga):
        return (-r1 * math.sin(th), r1 * math.cos(th), 0.0, 0.0)

    def dP_dga(th, ga):
        return (0.0, 0.0, -r2 * math.sin(ga), r2 * math.cos(ga))

    def dot(u, v): return sum(a * b for a, b in zip(u, v))

    max_s3_err = 0.0
    E_vals, F_vals, G_vals = [], [], []
    for i in range(samples):
        for j in range(samples):
            th = 2 * math.pi * i / samples
            ga = 2 * math.pi * j / samples
            p = P(th, ga)
            max_s3_err = max(max_s3_err, abs(dot(p, p) - 1.0))
            tt, tg = dP_dth(th, ga), dP_dga(th, ga)
            E_vals.append(dot(tt, tt))   # should be constant r1^2
            F_vals.append(dot(tt, tg))   # should be 0
            G_vals.append(dot(tg, tg))   # should be constant r2^2
    spreadE = max(E_vals) - min(E_vals)
    spreadG = max(G_vals) - min(G_vals)
    maxF = max(abs(v) for v in F_vals)
    return max_s3_err, spreadE, spreadG, maxF, r1sq.value(), r2sq.value()


# --------------------------------------------------------------------------- #
# Ergodic winding and equidistribution
# --------------------------------------------------------------------------- #
def line_points(ratio, n, dt=0.004):
    """Finely sample the continuous winding line theta = t, gamma = ratio*t (the object
    the note actually describes). Its image is dense in the torus iff `ratio` is
    irrational; for rational ratio = p/q it is the closed (p,q) curve and merely
    retraces. (Note: a *sampled* Kronecker set {k*alpha},{k*beta} would instead require
    1, alpha, beta rationally independent -- which two elements of Q(phi) can never be,
    since Q(phi) is 2-dimensional over Q. So this is the right object to sample.)"""
    return [((k * dt) % 1.0, (ratio * k * dt) % 1.0) for k in range(n)]


def cell_coverage(points, m):
    """Fraction of an m x m torus grid visited, and max deviation from uniform density."""
    counts = {}
    for (u, v) in points:
        c = (int(u * m) % m, int(v * m) % m)
        counts[c] = counts.get(c, 0) + 1
    visited = len(counts) / (m * m)
    n = len(points)
    max_dev = max(abs(counts.get((i, j), 0) / n - 1.0 / (m * m))
                  for i in range(m) for j in range(m))
    return visited, max_dev


def three_gap_ratio(alpha, n):
    """For the 1D Kronecker sequence {k*alpha}, the three-distance theorem says the
    points cut the circle into gaps of at most 3 lengths. The max/min gap ratio is a
    sharp uniformity measure; the golden ratio minimizes it. Returns that ratio."""
    xs = sorted((k * alpha) % 1.0 for k in range(n))
    gaps = [xs[i + 1] - xs[i] for i in range(len(xs) - 1)] + [1.0 - xs[-1] + xs[0]]
    gaps = [g for g in gaps if g > 1e-12]
    return max(gaps) / min(gaps)


def star_discrepancy_1d(alpha, n):
    """Exact 1D star discrepancy of {k*alpha}_{k=0..n-1} (Niederreiter form):
        D*_n = 1/(2n) + max_{1<=i<=n} | x_(i) - (2i-1)/(2n) |,
    evaluated at the sorted points themselves (not on a coarse grid)."""
    xs = sorted((k * alpha) % 1.0 for k in range(n))
    m = max(abs(xs[i] - (2 * i + 1) / (2 * n)) for i in range(n))
    return 1.0 / (2 * n) + m


def main():
    print("Golden Strassen Clifford Toroid  —  verifying the geometry that is real")
    print("=" * 74)

    r1sq, r2sq = verify_golden_radii()
    print("\n(1) Golden radii, EXACT in Q[phi]:")
    print(f"      r1^2 = {r1sq} = (phi+2)/5 ≈ {r1sq.value():.6f}")
    print(f"      r2^2 = {r2sq} = (3-phi)/5 ≈ {r2sq.value():.6f}")
    print(f"      r1^2 + r2^2 = 1            : VERIFIED exactly")
    print(f"      (r1/r2)^2 = phi^2 = phi+1  : VERIFIED exactly")

    s3, dE, dG, mF, r1v, r2v = verify_on_s3_and_flat(r1sq, r2sq)
    print("\n(2) On the unit 3-sphere, and (3) intrinsically flat:")
    print(f"      max |x1^2+y1^2+x2^2+y2^2 - 1|   = {s3:.2e}   (lies on S^3)")
    print(f"      first fundamental form: E spread={dE:.2e}, G spread={dG:.2e}, max|F|={mF:.2e}")
    print(f"      -> E=r1^2, G=r2^2 constant, F=0  ->  Gaussian curvature K = 0 (flat)")

    print("\n(4) Winding line: rational ratio closes (uneven, saturates) vs irrational fills")
    print("    (uniform). Coverage at 5k vs 20k samples shows saturation; 24x24 grid:")
    cov, dev_ = {}, {}
    for name, ratio in [("ratio 3/2  (rational)", 1.5),
                        ("ratio 8/5  (rational)", 1.6),
                        ("ratio phi  (golden)",  PHI),
                        ("ratio sqrt(2)",        2 ** 0.5)]:
        v5, _ = cell_coverage(line_points(ratio, 5000), 24)
        v20, d20 = cell_coverage(line_points(ratio, 20000), 24)
        cov[name], dev_[name] = v20, d20
        print(f"      {name:<22} coverage 5k->20k = {v5*100:5.1f}% -> {v20*100:5.1f}%   "
              f"density dev={d20:.2e}")
    # irrational lines fill the whole torus; rational lines retrace a closed curve and
    # are far less uniform (higher density deviation) no matter how long you sample.
    assert cov["ratio phi  (golden)"] > 0.95 and cov["ratio sqrt(2)"] > 0.95
    irr_dev = max(dev_["ratio phi  (golden)"], dev_["ratio sqrt(2)"])
    rat_dev = min(dev_["ratio 3/2  (rational)"], dev_["ratio 8/5  (rational)"])
    assert irr_dev < rat_dev, "irrational winding should be more uniform than rational"

    print("\n(5) Why golden is special — 1D star-discrepancy of {k·alpha}, n=4181 (Fibonacci #):")
    n1 = 4181
    rows = [("golden 1/phi", 1 / PHI), ("sqrt(2)-1", 2 ** 0.5 - 1),
            ("e-2", math.e - 2), ("pi-3", math.pi - 3), ("rational 3/5", 0.6)]
    disc = {}
    for name, a in rows:
        d = star_discrepancy_1d(a, n1)
        disc[name] = d
        print(f"      {name:<14} three-gap ratio={three_gap_ratio(a, n1):6.3f}   star-discrepancy={d:.3e}")
    # golden gives the lowest star-discrepancy of the set (badly-approximable optimum)
    assert all(disc["golden 1/phi"] <= disc[k] + 1e-12 for k in disc), \
        "golden should give the lowest star-discrepancy"
    print(f"      -> golden's three-gap ratio is exactly phi ({three_gap_ratio(1/PHI, n1):.4f}), the")
    print(f"         optimum among irrationals; and it attains the lowest star-discrepancy.")

    print("\n  HONEST LIMIT: equidistribution gives uniform COVERAGE, not O(1) LOOKUP.")
    print("  Finding the time t landing near a target is inhomogeneous Diophantine")
    print("  approximation -- a sampler, not an oracle. The note's closing 'O(1) lookup")
    print("  manifold' is the one unsupported line; everything above it is correct.")

    print("\n" + "=" * 74)
    print("RESULT: golden flat-torus radii verified exactly in Q[phi]; embedding lies on")
    print("        S^3 and is intrinsically flat; golden winding equidistributes with the")
    print("        lowest discrepancy. The geometry is sound; only the O(1) claim is not.")
    print("All assertions passed.")


if __name__ == "__main__":
    main()
