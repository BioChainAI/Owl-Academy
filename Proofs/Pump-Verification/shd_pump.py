"""
shd_pump.py — shared exact-rational primitives for the SHD-CCP pump verification suite.

Everything in this module is EXACT: it uses Python's fractions.Fraction, so no result
here depends on floating-point rounding. That matters because the pump papers make
*algebraic* claims (rationality, row-stochasticity, J > 0, metric properties) that are
only meaningful if you never leave the field Q. We honour that here.

Contents
--------
- Quaternion algebra over Q (multiply, conjugate, squared norm).
- Rational unit quaternions via inverse stereographic projection from Q^3
  (gives exact points on S^3 with no square roots — the trick the Sparsemax paper
  uses to stay inside Q).
- The square-root-free Lorentz lift S^3 -> H^3 and the rational hyperbolic quadrance.
- Exact Gaussian elimination and an exact stationary-distribution solver for
  row-stochastic matrices.

No third-party dependencies. Runs on a bare python3.
"""

from fractions import Fraction as F
from typing import List, Optional, Sequence, Tuple

Quat = Tuple[F, F, F, F]  # (w, x, y, z)


# --------------------------------------------------------------------------- #
# Quaternion algebra over Q
# --------------------------------------------------------------------------- #
def q_mul(a: Quat, b: Quat) -> Quat:
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    return (
        aw * bw - ax * bx - ay * by - az * bz,
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
    )


def q_conj(a: Quat) -> Quat:
    w, x, y, z = a
    return (w, -x, -y, -z)


def q_norm2(a: Quat) -> F:
    w, x, y, z = a
    return w * w + x * x + y * y + z * z


def is_unit(a: Quat) -> bool:
    return q_norm2(a) == 1


# --------------------------------------------------------------------------- #
# Rational unit quaternions (exact points on S^3, no square roots)
# --------------------------------------------------------------------------- #
def rational_unit_quat(v: Sequence[F]) -> Quat:
    """Inverse stereographic projection of v in Q^3 onto S^3 in Q^4.

    For v = (a, b, c), s = a^2 + b^2 + c^2:
        q = ( (s-1)/(s+1),  2a/(s+1),  2b/(s+1),  2c/(s+1) ).
    One checks ((s-1)^2 + 4s) / (s+1)^2 = 1 exactly, so q is a *rational* unit
    quaternion. The scalar part w = (s-1)/(s+1) lies in (0,1) iff s > 1, and
    increases monotonically toward 1 as s -> infinity, which is exactly the
    bounded "annular spinor" condition (Assumption A1) the Sparsemax paper needs.
    """
    a, b, c = (F(x) for x in v)
    s = a * a + b * b + c * c
    den = s + 1
    q = ((s - 1) / den, 2 * a / den, 2 * b / den, 2 * c / den)
    assert is_unit(q), "rational_unit_quat produced a non-unit quaternion"
    return q


# --------------------------------------------------------------------------- #
# Square-root-free Lorentz lift S^3 -> H^3 and rational hyperbolic quadrance
# --------------------------------------------------------------------------- #
def lorentz_lift(q: Quat) -> Quat:
    """Phi(q) = (1/w)(1, m). Lands on the positive sheet of the hyperboloid H^3:
    <q~, q~>_L = 1, with q~_0 = 1/w > 0. Exact because w is a nonzero rational."""
    w, x, y, z = q
    assert w != 0, "Lorentz lift requires w != 0 (annular spinor)"
    return (F(1) / w, x / w, y / w, z / w)


def mink_inner(a: Quat, b: Quat) -> F:
    """Minkowski bilinear form <a,b>_L = a0 b0 - a.b."""
    a0, a1, a2, a3 = a
    b0, b1, b2, b3 = b
    return a0 * b0 - a1 * b1 - a2 * b2 - a3 * b3


def hyperbolic_quadrance(qi: Quat, qj: Quat) -> F:
    """Q_h(i,j) = <q~_i, q~_j>_L^2 - 1, a rational surrogate for sinh^2(d_H)."""
    li, lj = lorentz_lift(qi), lorentz_lift(qj)
    ip = mink_inner(li, lj)
    return ip * ip - 1


# --------------------------------------------------------------------------- #
# Exact linear algebra over Q
# --------------------------------------------------------------------------- #
def solve_linear(A: List[List[F]], b: List[F]) -> Optional[List[F]]:
    """Solve A x = b exactly over Q. Returns None if A is singular.

    Plain Gauss-Jordan with exact pivot search (any nonzero pivot works because
    arithmetic is exact — there is no numerical-stability concern)."""
    n = len(A)
    M = [[A[i][j] for j in range(n)] + [b[i]] for i in range(n)]
    for col in range(n):
        piv = next((r for r in range(col, n) if M[r][col] != 0), None)
        if piv is None:
            return None
        M[col], M[piv] = M[piv], M[col]
        pv = M[col][col]
        M[col] = [v / pv for v in M[col]]
        for r in range(n):
            if r != col and M[r][col] != 0:
                f = M[r][col]
                M[r] = [M[r][k] - f * M[col][k] for k in range(n + 1)]
    return [M[i][n] for i in range(n)]


def stationary(K: List[List[F]]) -> Optional[List[F]]:
    """Exact stationary distribution pi of a row-stochastic matrix K (pi K = pi,
    sum pi = 1). Solves M pi = e_0 with M's first row replaced by the
    normalization constraint. Returns None if the linear system is singular
    (e.g. K reducible with a non-unique stationary measure)."""
    n = len(K)
    # Equation for column j: sum_i pi_i (K[i][j] - delta_ij) = 0.
    M = [[K[i][j] - (F(1) if i == j else F(0)) for i in range(n)] for j in range(n)]
    b = [F(0)] * n
    M[0] = [F(1)] * n  # replace one balance equation with sum pi = 1
    b[0] = F(1)
    return solve_linear(M, b)


def is_row_stochastic(K: List[List[F]]) -> bool:
    return all(
        all(v >= 0 for v in row) and sum(row) == 1
        for row in K
    )
