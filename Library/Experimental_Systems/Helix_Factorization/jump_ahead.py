"""
jump_ahead.py  —  the precise crux of the Dual-Helix reconstruction claim.

All three supporting mechanisms (Prime-Triplet Indexing, telescoping quaternion
chains, Halo/Ghost lookup) need exactly ONE thing to beat baseline rho: a way to
compute the i-th iterate

        x_i = f^{(i)}(x_0),   f(x) = x^2 + c  (mod N)

in fewer than ~i operations — random access ("jump-ahead") into the orbit.

This script shows, runnably, the sharp dichotomy:

  * For AFFINE / linear dynamics the jump-ahead EXISTS and is fast. x -> a x + b is a
    fixed group action; its i-fold composition is a 2x2 matrix power, computable in
    O(log i) by fast exponentiation — exact, no iteration. (This is exactly the
    "coordinate_i = closed-form(i)" step the QCC / SHD-CCP papers rely on, and it is
    perfectly valid HERE.)

  * For the QUADRATIC map x -> x^2 + c there is no such closed form. The i-fold
    composition is a polynomial of degree 2^i; its coefficients explode. There is no
    fixed-size algebraic function of i that yields x_i. (Even the most structured
    quadratic, x^2 - 2 / Chebyshev, still costs Theta(i).)

So the papers prove the right theorem about the wrong map: their O(1)/sublinear
reconstruction is real for fixed-group-action dynamics on a torus/honeycomb, and
inapplicable to x^2+c — which is precisely the map Pollard chose BECAUSE it has no
jump-ahead (that absence is what forces the sqrt(p) birthday cost, and a fast
jump-ahead for x^2+c would be a major breakthrough far beyond this setting).

certify_reconstructor() below is the open door: hand it any concrete jumpAhead(i,...)
— e.g. one derived from the Einstein-Tile procedural parameters — and it reports,
honestly, whether the output equals the true x_i and whether its cost grows sub-linearly.

Pure Python 3 standard library.  python3 jump_ahead.py
"""

import time
from fractions import Fraction


# --------------------------------------------------------------------------- #
# The maps
# --------------------------------------------------------------------------- #
def iterate_affine(a, b, x0, i, N):
    x = x0 % N
    for _ in range(i):
        x = (a * x + b) % N
    return x


def iterate_quadratic(c, x0, i, N):
    x = x0 % N
    for _ in range(i):
        x = (x * x + c) % N
    return x


# --------------------------------------------------------------------------- #
# Affine jump-ahead: x_i in O(log i) via 2x2 matrix power  [[a,b],[0,1]]
# --------------------------------------------------------------------------- #
def matmul(A, B, N):
    return [[(A[0][0]*B[0][0] + A[0][1]*B[1][0]) % N, (A[0][0]*B[0][1] + A[0][1]*B[1][1]) % N],
            [(A[1][0]*B[0][0] + A[1][1]*B[1][0]) % N, (A[1][0]*B[0][1] + A[1][1]*B[1][1]) % N]]


def affine_jump(a, b, x0, i, N):
    """x_i = (M^i · [x0,1])[0],  M = [[a,b],[0,1]].  O(log i) matrix mults — exact."""
    M = [[a % N, b % N], [0, 1]]
    R = [[1, 0], [0, 1]]
    mults = 0
    e = i
    while e > 0:
        if e & 1:
            R = matmul(R, M, N); mults += 1
        M = matmul(M, M, N); mults += 1
        e >>= 1
    return (R[0][0] * (x0 % N) + R[0][1]) % N, mults


# --------------------------------------------------------------------------- #
# Quadratic composition degree: f^{(i)} has degree 2^i (coeffs explode)
# --------------------------------------------------------------------------- #
def compose_quadratic_symbolic(c, i):
    """Compose p_{k+1}(x) = p_k(x)^2 + c over the integers (exact coeffs).
    Returns (degree, #nonzero terms, max |coeff|) to expose the blow-up."""
    p = [Fraction(0), Fraction(1)]   # p_0(x) = x   (coeff list, low->high)
    for _ in range(i):
        # square the polynomial
        sq = [Fraction(0)] * (2 * len(p) - 1)
        for u, cu in enumerate(p):
            if cu == 0:
                continue
            for v, cv in enumerate(p):
                sq[u + v] += cu * cv
        sq[0] += c
        p = sq
    deg = len(p) - 1
    nz = sum(1 for t in p if t != 0)
    mx = max(abs(t.numerator) for t in p)
    return deg, nz, mx


# --------------------------------------------------------------------------- #
# Chebyshev near-miss: x -> x^2 - 2 has a "closed form" 2cos(2^i θ),
# but evaluating it mod N still costs Theta(i) squarings — no shortcut.
# --------------------------------------------------------------------------- #
def chebyshev_jump_cost(x0, i, N):
    """x_i for c=-2 via the doubling identity T_{2^i}: still i squarings."""
    x = x0 % N
    squarings = 0
    for _ in range(i):       # T_{2k}(x) = T_k(x)^2 - 2  → reaching index i needs i steps
        x = (x * x - 2) % N
        squarings += 1
    return x, squarings


# --------------------------------------------------------------------------- #
# The open door: certify ANY candidate jump-ahead reconstruction.
# --------------------------------------------------------------------------- #
def certify_reconstructor(jump_fn, c, x0, N, indices, name="candidate"):
    """jump_fn(i, x0, c, N) -> claimed x_i. Reports correctness and timing scaling.
    A reconstruction that is BOTH exact on every index AND sub-linear in i would
    break the wall (and would be a result far bigger than this bench)."""
    print(f"    testing reconstructor: {name}")
    all_ok = True
    times = []
    for i in indices:
        truth = iterate_quadratic(c, x0, i, N)
        t0 = time.process_time()
        try:
            got = jump_fn(i, x0, c, N) % N
        except Exception as e:                       # noqa: BLE001
            print(f"      i={i}: ERROR {e!r}")
            all_ok = False
            continue
        dt = time.process_time() - t0
        ok = (got == truth)
        all_ok &= ok
        times.append((i, dt))
        print(f"      i={i:<8} correct={ok}   time={dt*1e3:.3f} ms")
    # crude scaling estimate: does time grow ~linearly with i?
    if len(times) >= 2 and times[-1][1] > 0:
        (i0, t_lo), (i1, t_hi) = times[0], times[-1]
        ratio_i = i1 / max(1, i0)
        ratio_t = t_hi / max(1e-12, t_lo)
        verdict = "sub-linear (!)" if ratio_t < ratio_i * 0.5 else "~linear (no win)"
        print(f"      index ×{ratio_i:.0f} → time ×{ratio_t:.1f}  ⇒ {verdict}")
    print(f"      EXACT on all tested indices: {all_ok}")
    return all_ok


# --------------------------------------------------------------------------- #
def main():
    N = 2_000_003 * 1_999_993        # a ~42-bit semiprime
    print("Jump-ahead: when can you reach x_i without walking 0..i?")
    print("=" * 74)

    print("\n[A] AFFINE map x -> a·x + b (mod N): jump-ahead EXISTS, O(log i), exact.")
    a, b, x0 = 1103515245, 12345, 7
    for i in (1000, 100000, 10_000_000):
        jx, mults = affine_jump(a, b, x0, i, N)
        nx = iterate_affine(a, b, x0, i, N)
        print(f"      i={i:>9}:  jump={jx}  iterate={nx}  match={jx==nx}   "
              f"matrix-mults={mults} (vs {i} naive steps)")
    print("      → this IS the QCC/SHD-CCP 'coordinate_i = closed-form(i)' step. Valid for a")
    print("        fixed group action: the i-fold map is a matrix power, O(log i).")

    print("\n[B] QUADRATIC map x -> x^2 + c (mod N): the i-fold composition is degree 2^i.")
    c = 1
    print(f"      {'i':>3} {'degree = 2^i':>16} {'nonzero terms':>14} {'max|coeff| digits':>18}")
    for i in range(0, 9):
        deg, nz, mx = compose_quadratic_symbolic(c, i)
        print(f"      {i:>3} {deg:>16} {nz:>14} {len(str(mx)):>18}")
    print("      → no fixed-size algebraic function of i yields x_i; the closed form does")
    print("        not exist. The ONLY general way to get x_i is to apply f about i times.")

    print("\n[C] CHEBYSHEV near-miss x -> x^2 - 2 (the most structured quadratic):")
    x, sq = chebyshev_jump_cost(5, 200000, N)
    print(f"      reaching i=200000 via the doubling identity still took {sq} squarings —")
    print("      Θ(i), the same as naive iteration. The 2cos(2^i θ) form can't be evaluated")
    print("      mod N without i steps (no arccos mod N). Even here: no sub-linear win.")

    print("\n[D] The open door — plug in a concrete reconstructor and we test it:")
    # (i) a deliberately WRONG closed-form guess — caught immediately
    bad = lambda i, x0, c, N: (pow(x0, pow(2, i, N - 1), N) + c) % N
    certify_reconstructor(bad, c, 7, N, [10, 100, 1000], name="naive 'x0^(2^i)+c' guess (wrong)")
    # (ii) the honest baseline: actually iterating — correct but linear (no win)
    honest = lambda i, x0, c, N: iterate_quadratic(c, x0, i, N)
    certify_reconstructor(honest, c, 7, N, [1000, 10000, 100000],
                          name="iterate (correct, but ~linear — the wall)")

    print("\n" + "=" * 74)
    print("CONCLUSION (demonstrated, not asserted):")
    print(" • Jump-ahead is real and fast for AFFINE/linear dynamics — and the supporting")
    print("   papers' O(1)-coordinate step is valid there. [A] shows it working exactly.")
    print(" • For x^2+c it cannot exist as a closed form: degree 2^i blow-up [B], and even")
    print("   the Chebyshev-special quadratic stays Θ(i) [C]. This is the very property that")
    print("   makes x^2+c the right engine for Pollard rho and ties it to factoring hardness.")
    print(" • The three citations supply the framework but never a concrete x_i = g(i, seed).")
    print("   certify_reconstructor() is the test any such g must pass — exact AND sub-linear.")
    print("   Provide that 10-line procedure and this harness will measure it honestly.")


if __name__ == "__main__":
    main()
