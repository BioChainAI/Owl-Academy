"""
shd_ccp_residue.py  —  the user-submitted SHD-CCP reconstruction, VERBATIM.

This is the concrete candidate jump-ahead proposed to close the reconstruction gap:
the claim is that it computes the i-th Pollard-rho residue x_i (for f(x)=x^2+c mod n)
in O(1), exactly, by routing through the four papers' machinery (Prime-Triplet
indexing → Einstein-Tile gear weights → Torsional-Markov quaternion product →
Rational Lorentz lift with the 945 normalizer → modular collapse).

It is reproduced unchanged so the test in test_shd_ccp_residue.py is faithful to what
was submitted. The verdict is in that test (and the captured output).
"""


def get_residue(i, S, n):
    # 1. Prime Triplet Indexing (Hyperbolic Oracle): spatial coordinate generators
    px, py, pz = i, i + 2, i + 6

    # 2. Einstein-Tile seed unpacking: 16-bit scalar weights for the three gears
    w8, w10, w12 = (S >> 48) & 0xFFFF, (S >> 32) & 0xFFFF, (S >> 16) & 0xFFFF

    Q8  = (w8, px, py, pz)
    Q10 = (w10, py, pz, px)
    Q12 = (w12, pz, px, py)

    q_mul = lambda a, b: (
        a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
        a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
        a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
        a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0],
    )

    # 3. Torsional Markov pump: ordered product Q8 · Q10 · Q12
    w, x, y, z = q_mul(q_mul(Q8, Q10), Q12)
    w = w if w != 0 else 1

    # 4. Rational Lorentz lift + 945 (Zeta) normalizer — stays in the integers
    x_lifted = (945 * x) // w
    y_lifted = (945 * y) // w
    z_lifted = (945 * z) // w

    # 5. Collapse to a modular residue
    return (x_lifted + y_lifted + z_lifted) % n
