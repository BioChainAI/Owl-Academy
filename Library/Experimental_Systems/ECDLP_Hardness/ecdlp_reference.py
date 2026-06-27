"""
ecdlp_reference.py  —  the honest version of the "oracle".

This is a *real* elliptic-curve discrete-log solver. It builds a genuine curve
y^2 = x^3 + ax + b over a prime field F_p, plants a secret scalar k with Q = kG,
and recovers k two ways that actually work:

  * Baby-Step / Giant-Step (BSGS) -- deterministic, O(sqrt n) time AND space.
  * Pollard's rho                  -- randomized, O(sqrt n) time, O(1) space.

Both are the genuine state-of-the-art for a generic curve. Neither is O(1), and
no amount of "dimensional lifting" changes that: the work to recover k grows like
the square root of the group order n. We measure that law on real curves and then
extrapolate it to secp256k1 (n ~ 2^256), where sqrt(n) ~ 2^128 -- the wall.

Pure Python 3 standard library. Run:  python3 ecdlp_reference.py
"""

import math
import random
from dataclasses import dataclass

random.seed(20260627)  # reproducible


# --------------------------------------------------------------------------- #
# Field helpers
# --------------------------------------------------------------------------- #
def legendre(n, p):
    n %= p
    if n == 0:
        return 0
    return 1 if pow(n, (p - 1) // 2, p) == 1 else -1


def sqrt_mod(n, p):
    """Square root mod p for p = 3 (mod 4) (all curves below use such primes)."""
    assert p % 4 == 3, "sqrt_mod here assumes p = 3 (mod 4)"
    r = pow(n % p, (p + 1) // 4, p)
    return r if (r * r) % p == n % p else None


# --------------------------------------------------------------------------- #
# Elliptic curve  y^2 = x^3 + a x + b  over F_p.  Point at infinity = None.
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class Curve:
    a: int
    b: int
    p: int


def is_on(C, P):
    if P is None:
        return True
    x, y = P
    return (y * y - (x * x * x + C.a * x + C.b)) % C.p == 0


def add(C, P, Q):
    if P is None:
        return Q
    if Q is None:
        return P
    x1, y1 = P
    x2, y2 = Q
    p = C.p
    if x1 == x2 and (y1 + y2) % p == 0:
        return None  # P + (-P) = O
    if P == Q:
        m = (3 * x1 * x1 + C.a) * pow(2 * y1 % p, -1, p) % p
    else:
        m = (y2 - y1) * pow((x2 - x1) % p, -1, p) % p
    x3 = (m * m - x1 - x2) % p
    y3 = (m * (x1 - x3) - y1) % p
    return (x3, y3)


def mul(C, k, P):
    """Scalar multiplication by double-and-add (handles any non-negative k)."""
    R = None
    Q = P
    while k > 0:
        if k & 1:
            R = add(C, R, Q)
        Q = add(C, Q, Q)
        k >>= 1
    return R


# --------------------------------------------------------------------------- #
# Point counting and prime-order curve generation
# --------------------------------------------------------------------------- #
def count_points(C):
    """#E(F_p) = p + 1 + sum_x legendre(x^3+ax+b).  O(p) -- fine for p up to ~1e6."""
    p, a, b = C.p, C.a, C.b
    s = 0
    for x in range(p):
        s += legendre((x * x * x + a * x + b) % p, p)
    return p + 1 + s


def next_prime_3mod4(n):
    def is_prime(m):
        if m < 2:
            return False
        for d in range(2, int(m ** 0.5) + 1):
            if m % d == 0:
                return False
        return True
    while not (n % 4 == 3 and is_prime(n)):
        n += 1
    return n


def find_prime_order_curve(p):
    """Find (a, b) over F_p whose group order n is prime, plus a generator G.
    Prime order => every non-identity point generates the whole group."""
    for _ in range(4000):
        a = random.randrange(p)
        b = random.randrange(p)
        if (4 * a * a * a + 27 * b * b) % p == 0:   # singular
            continue
        C = Curve(a, b, p)
        n = count_points(C)
        if is_probable_prime(n):
            G = find_point(C)
            if G is not None:
                return C, G, n
    raise RuntimeError("no prime-order curve found near p=%d" % p)


def is_probable_prime(m):
    if m < 2:
        return False
    small = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]
    for q in small:
        if m % q == 0:
            return m == q
    d, r = m - 1, 0
    while d % 2 == 0:
        d //= 2
        r += 1
    for a in small:
        x = pow(a, d, m)
        if x in (1, m - 1):
            continue
        for _ in range(r - 1):
            x = x * x % m
            if x == m - 1:
                break
        else:
            return False
    return True


def find_point(C):
    for x in range(C.p):
        rhs = (x * x * x + C.a * x + C.b) % C.p
        if legendre(rhs, C.p) >= 0:
            y = sqrt_mod(rhs, C.p)
            if y is not None and (x, y) != (0, 0):
                return (x, y)
    return None


# --------------------------------------------------------------------------- #
# Solver 1: Baby-Step / Giant-Step   (O(sqrt n) time and space)
# --------------------------------------------------------------------------- #
def bsgs(C, G, Q, n):
    m = math.isqrt(n) + 1
    table = {}
    P = None  # 0*G
    for j in range(m):
        table.setdefault(P, j)
        P = add(C, P, G)          # P = (j+1) G
    mG = mul(C, m, G)
    factor = mul(C, n - 1, mG)    # = -mG  (since n*mG = O)
    gamma = Q
    for i in range(m):
        if gamma in table:
            return i * m + table[gamma], (i + m)   # k, work (steps)
        gamma = add(C, gamma, factor)
    return None, m + m


# --------------------------------------------------------------------------- #
# Solver 2: Pollard's rho   (O(sqrt n) time, O(1) space)
# --------------------------------------------------------------------------- #
def rho(C, G, Q, n, max_steps=None):
    if max_steps is None:
        max_steps = 100 * (math.isqrt(n) + 1)

    def step(X, a, b):
        if X is None:
            part = 0
        else:
            part = X[0] % 3
        if part == 0:
            return add(C, X, Q), a, (b + 1) % n
        elif part == 1:
            return add(C, X, X), (2 * a) % n, (2 * b) % n
        else:
            return add(C, X, G), (a + 1) % n, b

    for _ in range(20):  # retries with fresh random start on bad collisions
        a0, b0 = random.randrange(n), random.randrange(n)
        X = add(C, mul(C, a0, G), mul(C, b0, Q))
        ax, bx = a0, b0
        Y, ay, by = X, ax, bx
        for t in range(1, max_steps + 1):
            X, ax, bx = step(X, ax, bx)
            Y, ay, by = step(*step(Y, ay, by))
            if X == Y:
                db = (by - bx) % n
                if db == 0:
                    break  # degenerate; retry with new start
                k = (ax - ay) * pow(db, -1, n) % n
                return k, t
    return None, max_steps


# --------------------------------------------------------------------------- #
# Demo + scaling measurement
# --------------------------------------------------------------------------- #
def solve_once(p, label):
    C, G, n = find_prime_order_curve(p)
    k = random.randrange(2, n - 1)
    Q = mul(C, k, G)
    assert is_on(C, G) and is_on(C, Q)

    k_bsgs, w_bsgs = bsgs(C, G, Q, n)
    k_rho, w_rho = rho(C, G, Q, n)

    ok_bsgs = (k_bsgs is not None and mul(C, k_bsgs, G) == Q)
    ok_rho = (k_rho is not None and mul(C, k_rho, G) == Q)
    assert ok_bsgs and k_bsgs == k, f"BSGS failed: got {k_bsgs}, planted {k}"
    assert ok_rho and mul(C, k_rho, G) == Q, f"rho failed: got {k_rho}"

    rt = math.sqrt(n)
    print(f"  {label:>10}: p={C.p:<8} curve y^2=x^3+{C.a}x+{C.b}  n={n}  (~2^{math.log2(n):.1f})")
    print(f"             planted k={k}")
    print(f"             BSGS  -> k={k_bsgs}  ✓   steps={w_bsgs:<7} ({w_bsgs/rt:.2f}·√n)")
    print(f"             rho   -> k={k_rho}  ✓   steps={w_rho:<7} ({w_rho/rt:.2f}·√n)")
    return n, w_bsgs, w_rho


def main():
    print("Real ECDLP recovery on genuine prime-order curves over F_p")
    print("=" * 74)
    print("\n[1] Recover k two ways on a curve with p ≈ 10^4 (the requested size):")
    solve_once(next_prime_3mod4(10007), "p~1e4")

    print("\n[2] The O(√n) law — recover k on a family of growing curves:")
    data = []
    for target in [next_prime_3mod4(t) for t in (211, 1009, 10007, 100003, 1000003)]:
        data.append(solve_once(target, f"p~{target}"))

    print("\n[3] Scaling check: BSGS steps ≈ √n, rho steps = O(√n) (constant × √n):")
    print(f"      {'n':>12}  {'√n':>10}  {'BSGS/√n':>9}  {'rho/√n':>8}")
    for n, wb, wr in data:
        print(f"      {n:>12}  {math.sqrt(n):>10.1f}  {wb/math.sqrt(n):>9.2f}  {wr/math.sqrt(n):>8.2f}")

    print("\n[4] Extrapolating the SAME √n law to real key sizes — the wall:")
    print(f"      {'bits':>5}  {'group order n':>16}  {'ops ≈ √n':>14}  {'time @10^9 ops/s':>20}")
    AGE_UNIVERSE_S = 4.35e17
    for bits in (32, 64, 128, 160, 224, 256):
        ops = 2 ** (bits / 2)
        secs = ops / 1e9
        if secs < 1:
            t = f"{secs*1e3:.2f} ms"
        elif secs < 3.15e7:
            t = f"{secs/86400:.2f} days" if secs > 86400 else f"{secs:.2f} s"
        else:
            yrs = secs / 3.15e7
            t = f"{yrs:.2e} yr  ({yrs/(AGE_UNIVERSE_S/3.15e7):.1e}× age of universe)" if yrs > 1e6 else f"{yrs:.2e} yr"
        tag = "  <- secp256k1 / Bitcoin" if bits == 256 else ""
        print(f"      {bits:>5}  {f'~2^{bits}':>16}  {f'~2^{bits//2}':>14}  {t:>20}{tag}")

    print("\n" + "=" * 74)
    print("CONCLUSION: the discrete log is recoverable in O(√n) — and we did recover it.")
    print("The work grows as √n with NO sub-exponential shortcut on a generic curve.")
    print("At 256 bits, √n ≈ 2^128 ≈ 3.4e38 operations: even at 10^9 ops/s that is")
    print("~10^22 years, ~10^12 × the age of the universe. That gap is the wall —")
    print("not a missing trick, but the square-root law itself, extrapolated honestly.")
    print("All recoveries verified (recovered k satisfies kG = Q and equals the planted k).")


if __name__ == "__main__":
    main()
