"""
verify_cycle_current.py  —  Lemma: explicit (K, pi) with a strictly positive
torsional cycle current, and the exact criterion that governs its sign.

This closes the "explicit K, pi realizing a prescribed cycle affinity" item that
the Torsional Markov Memory-Offload Pump paper lists in its Scope & Outlook, and
gives a constructive, exact witness for Lemma 5 (the three edge currents coincide)
and the pump condition J12,10 + J10,8 + J8,12 > 0.

The Markov chain lives on the three gear layers  X in {12, 10, 8}, with the
forward cycle  12 -> 10 -> 8 -> 12.  For an irreducible chain on a single 3-cycle,
Kirchhoff/Kolmogorov theory gives the *exact* sign law:

    stationary cycle current J > 0   <=>   (forward product) > (reverse product)
            K[12->10] K[10->8] K[8->12]  >  K[12->8] K[8->10] K[10->12].

Everything below is computed exactly over Q (no floating point).
"""

from fractions import Fraction as F
from shd_pump import stationary, is_row_stochastic

S = ["12", "10", "8"]  # state order: index 0=12, 1=10, 2=8
I12, I10, I8 = 0, 1, 2


def build_K(fwd, rev):
    """Row-stochastic K on {12,10,8}.

    fwd = (a, b, c): forward rates 12->10, 10->8, 8->12.
    rev = (d, e, g): reverse rates 12->8,  10->12, 8->10.
    Remaining mass stays on the diagonal (self-loop), so each row sums to 1.
    """
    a, b, c = fwd
    d, e, g = rev
    K = [
        # to:   12            10            8
        [1 - a - d,         a,            d        ],  # from 12
        [e,                 1 - b - e,    b        ],  # from 10
        [c,                 g,            1 - c - g],  # from 8
    ]
    return K


def edge_currents(K, pi):
    """The three directed edge currents on the forward cycle 12->10->8->12."""
    J_12_10 = pi[I12] * K[I12][I10] - pi[I10] * K[I10][I12]
    J_10_8  = pi[I10] * K[I10][I8]  - pi[I8]  * K[I8][I10]
    J_8_12  = pi[I8]  * K[I8][I12]  - pi[I12] * K[I12][I8]
    return J_12_10, J_10_8, J_8_12


def kolmogorov_products(fwd, rev):
    a, b, c = fwd
    d, e, g = rev
    return a * b * c, d * e * g  # (forward, reverse)


def analyze(label, fwd, rev):
    K = build_K(fwd, rev)
    assert is_row_stochastic(K), f"{label}: K is not row-stochastic"
    pi = stationary(K)
    assert pi is not None, f"{label}: no unique stationary distribution"
    assert sum(pi) == 1
    # verify pi K = pi exactly
    for j in range(3):
        assert sum(pi[i] * K[i][j] for i in range(3)) == pi[j]

    j1, j2, j3 = edge_currents(K, pi)
    fprod, rprod = kolmogorov_products(fwd, rev)

    print(f"\n=== {label} ===")
    print("  K (exact rows):")
    for i, row in enumerate(K):
        print(f"    from {S[i]:>2}: " + "  ".join(f"{S[j]}->{str(row[j]):>7}" for j in range(3)))
    print("  stationary pi:        " + ", ".join(f"{S[i]}={pi[i]} (~{float(pi[i]):.4f})" for i in range(3)))
    print(f"  edge currents:        J(12->10)={j1}  J(10->8)={j2}  J(8->12)={j3}")
    print(f"  Lemma 5 (coincide):   {j1 == j2 == j3}   common J = {j1}  (~{float(j1):+.6f})")
    print(f"  Kolmogorov products:  forward={fprod} ({float(fprod):.5f})  reverse={rprod} ({float(rprod):.5f})")
    print(f"  sign law holds:       sign(J) matches sign(fwd-rev) = {sign(j1) == sign(fprod - rprod)}")
    return j1, fprod, rprod


def sign(x):
    return (x > 0) - (x < 0)


def main():
    print("Torsional cycle current  —  exact construction of (K, pi) with J > 0")
    print("=" * 70)

    # (1) Forward-biased pump: strong 12->10->8->12 circulation, weak reverse.
    fwd = (F(1, 2), F(1, 2), F(1, 2))      # a,b,c
    rev = (F(1, 20), F(1, 20), F(1, 20))   # d,e,g
    Jpos, fp, rp = analyze("Forward-biased pump (expect J > 0)", fwd, rev)
    assert Jpos > 0, "expected strictly positive pump current"
    assert fp > rp

    # (2) Kolmogorov-balanced: forward product == reverse product => J == 0,
    #     even though individual rates are asymmetric. (Detailed balance achievable.)
    fwd2 = (F(1, 2), F(1, 5), F(1, 3))
    rev2 = (F(1, 3), F(1, 2), F(1, 5))     # same multiset of rates, product equal
    Jzero, fp2, rp2 = analyze("Kolmogorov-balanced (expect J = 0)", fwd2, rev2)
    assert fp2 == rp2
    assert Jzero == 0, "balanced products must give zero stationary current"

    # (3) Reverse-biased: current runs the other way (J < 0).
    fwd3 = (F(1, 20), F(1, 20), F(1, 20))
    rev3 = (F(1, 2), F(1, 2), F(1, 2))
    Jneg, fp3, rp3 = analyze("Reverse-biased pump (expect J < 0)", fwd3, rev3)
    assert Jneg < 0

    # (4) Asymmetric forward pump: distinct rates on every edge, so the stationary
    #     pi is genuinely NON-uniform -- showing Lemma 5 (the three currents
    #     coincide) is not an artifact of cyclic symmetry. J is still > 0.
    fwd4 = (F(3, 5), F(2, 5), F(7, 10))
    rev4 = (F(1, 10), F(1, 20), F(1, 8))
    Jasym, fp4, rp4 = analyze("Asymmetric forward pump (non-uniform pi, expect J > 0)", fwd4, rev4)
    assert Jasym > 0
    pi4 = stationary(build_K(fwd4, rev4))
    assert len(set(pi4)) == 3, "expected a genuinely non-uniform stationary distribution"

    print("\n" + "=" * 70)
    print("RESULT: Lemma 5 verified exactly in every case (J12,10 = J10,8 = J8,12).")
    print("        Pump condition J > 0 holds for the forward-biased witness.")
    print("        Sign of J is governed exactly by the Kolmogorov cycle criterion:")
    print("            J > 0  <=>  K[12->10]K[10->8]K[8->12] > K[12->8]K[8->10]K[10->12].")
    print("All assertions passed.")


if __name__ == "__main__":
    main()
