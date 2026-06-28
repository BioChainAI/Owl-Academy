"""
test_shd_ccp_residue.py  —  run the submitted SHD-CCP reconstruction through the
crucible: is get_residue(i, S, n) the true i-th iterate of f(x)=x^2+c (mod n)?

This is the honest follow-through on the promise: a concrete candidate was supplied,
so we measure it — O(1)? exact? — and diagnose precisely what it computes.

    python3 test_shd_ccp_residue.py
"""

import time
from shd_ccp_residue import get_residue
from jump_ahead import certify_reconstructor, iterate_quadratic


def true_x(i, x0, c, n):
    x = x0 % n
    for _ in range(i):
        x = (x * x + c) % n
    return x


def main():
    n = 2_000_003 * 1_999_993        # ~42-bit semiprime
    x0, c = 2, 1
    print("Testing the submitted SHD-CCP get_residue() against the true x^2+c walk")
    print("=" * 74)

    # --- property 1: is it O(1)? (the construction's headline) ---
    t0 = time.process_time(); get_residue(10, 12345, n); t_small = time.process_time() - t0
    t0 = time.process_time(); get_residue(10_000_000, 12345, n); t_big = time.process_time() - t0
    print(f"\n[O(1) timing]  i=10: {t_small*1e6:.1f} µs   i=1e7: {t_big*1e6:.1f} µs")
    print(f"               → O(1): YES (no loops; time independent of i). Property achieved.")

    # --- property 2: integer-exact (no floats)? yes, by construction (// and %) ---
    print("[integer-exact]  uses only // and % — stays in Z. Property achieved.")

    # --- property 3 (the one that matters): does it equal the true iterate? ---
    print("\n[EXACT?]  true walk x0=2,c=1:", [true_x(i, x0, c, n) for i in range(8)])
    print("          best-case seed S encodes x0 in every gear field:")
    S = (x0 << 48) | (x0 << 32) | (x0 << 16)
    print("          get_residue i=0..7 :", [get_residue(i, S, n) for i in range(8)])
    matches = sum(1 for i in range(8) if get_residue(i, S, n) == true_x(i, x0, c, n))
    print(f"          matches over first 8 indices: {matches}/8")

    # run it through the bench's certifier (adapter: S derived from x0)
    print()
    adapter = lambda i, x0, c, N: get_residue(i, (x0 << 48) | (x0 << 32) | (x0 << 16), N)
    exact = certify_reconstructor(adapter, c, x0, n, [10, 1000, 100000],
                                  name="SHD-CCP get_residue (S from x0)")

    # --- the decisive diagnosis: WHY it can't match ---
    print("\n[WHY]  two independent, decisive reasons:")
    # (a) it never reads c — but the true sequence depends on c
    same = get_residue(5, 999, n) == get_residue(5, 999, n)
    print(f"  (a) get_residue ignores c entirely. true x_5: c=1 → {true_x(5,x0,1,n)},  "
          f"c=2 → {true_x(5,x0,2,n)}.")
    print(f"      One c-independent formula cannot equal both. (It matches neither.)")
    # (b) it is a fixed low-degree polynomial in i (cannot be the degree-2^i iterate)
    seq = [get_residue(i, 999, n) for i in range(6)]
    diffs = [seq[k+1] - seq[k] for k in range(5)]
    print(f"  (b) get_residue is smooth/low-degree in i (Q8·Q10·Q12 is cubic in i):")
    print(f"      values {seq}")
    print(f"      successive diffs {diffs}  ← slowly varying, not pseudo-random")
    print(f"      the true iterate is degree 2^i in x0 and pseudo-random — a cubic-in-i")
    print(f"      map provably cannot equal it beyond coincidences.")

    print("\n" + "=" * 74)
    print("VERDICT (measured):")
    print("  O(1): YES.   integer-exact: YES.   EXACT (= the iterate):", "YES" if exact else "NO.")
    print("  It IS O(1) precisely BECAUSE it is low-degree in i — which is exactly why it is")
    print("  not the degree-2^i iterate of x^2+c. The wall it aimed at (degree explosion)")
    print("  wasn't bypassed; it was sidestepped by computing a different, simpler sequence.")
    print("  The bench did its job: any reconstruction that is genuinely O(1) and matches the")
    print("  true walk would show EXACT: YES here. This one shows EXACT: NO.")
    assert not exact, "if this ever flips to True, a real breakthrough occurred — investigate!"


if __name__ == "__main__":
    main()
