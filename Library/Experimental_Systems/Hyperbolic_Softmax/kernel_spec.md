# Hyperbolic Sparsemax Kernel — Specification (`kernel_spec.md`)

**System:** Hyperbolic Softmax on a Torsional Markov Chain
**Substrate:** SHD-CCP 4×4×4 (64-voxel) cubic packet
**Status:** Locked v1 — invariants frozen for implementation
**Companions:** [`Hyperbolic_Softmax_Design.md`](Hyperbolic_Softmax_Design.md) · [`Hyperbolic_Softmax_Proof.md`](Hyperbolic_Softmax_Proof.md)
**Upstream law:** [TTMPT formal proof](../../../Proofs/Torsional-Trefoil-Markov-Pump/TTMPT-Formal-Proof.pdf)

> **Naming lock.** The *executable, on-chain* normalizer is **hyperbolic sparsemax** (α‑entmax, α = 2). The word *softmax* is reserved for the **analytic Axiom‑II limit** (Gibbs). "Hyperbolic Softmax" names the *family*; the deterministic member is sparsemax.

---

## 0. Two-layer contract

| Layer | Axiom | Normalizer | Valve | Arithmetic | Role |
|---|---|---|---|---|---|
| **Executable** | I (Micro) | sparsemax (α=2) | rational $\rho_{ij}=\tfrac{1}{1+\lambda A_{ij}}$ / additive $-\lambda A_{ij}$ | exact $\mathbb{Q}$ | on-chain transitions, parity-safe |
| **Analytic** | II (Sieve) | Gibbs / softmax | exponential $e^{-\lambda A_{ij}}$ | $\mathbb{R}$ | TTMPT current proof, continuous limit |

The executable layer is what runs inside the handshake; the analytic layer is where the pump theorem is proven. Irrational values live **only** in the analytic layer and the Octet buffer (§8) — never in the 64-state executable kernel.

---

## 1. State set

$$V=\{0,1,2,3\}^3,\qquad |V|=64,\qquad v=(a,b,c).$$

- **Inner Core** $C=\{1,2\}^3$, $|C|=8$ — the active state index (where mass is allowed to collapse).
- **Outer Mantle** $M=V\setminus C$, $|M|=56$ — cryptographic topology / context (the query side).

Each voxel indexes one bit of the 64-bit packet; the executable kernel is a row-stochastic $K\in\mathbb{Q}^{64\times64}$.

---

## 2. Spinor state ($S^3$)

Each voxel carries a **rational** unit quaternion (the orientation/topology object):

$$q_i=(w_i,x_i,y_i,z_i)=(w_i,\mathbf m_i)\in S^3\cap\mathbb{Q}^4,\qquad w_i^2+\lVert\mathbf m_i\rVert^2=1.$$

**Safe annulus (Derrick lock, §7):** $0<w_{\min}\le w_i\le w_{\max}<1$, with $w_{\min},w_{\max}\in\mathbb{Q}$.

**Exact rational construction** (so $q_i\in S^3\cap\mathbb{Q}^4$ is guaranteed): pick a Lipschitz integer quaternion $g_i\in\mathbb{Z}^4$ with dominant scalar ($g_{i,0}^2>g_{i,1}^2+g_{i,2}^2+g_{i,3}^2$), then

$$q_i=\frac{g_i^{\,2}}{N(g_i)},\qquad N(g_i)=g_{i,0}^2+g_{i,1}^2+g_{i,2}^2+g_{i,3}^2.$$

Since $N(g_i^{\,2})=N(g_i)^2$, this is an exact rational unit quaternion with $w_i>0$.

---

## 3. Lorentz lift ($S^3 \to \mathbb{H}^3$) — **distinct from the spinor**

The hyperboloid model: $\mathbb{H}^3=\{\tilde q:\langle\tilde q,\tilde q\rangle_{\mathbb L}=1,\ \tilde w>0\}$ with the Minkowski form

$$\langle a,b\rangle_{\mathbb L}=a_0b_0-(a_1b_1+a_2b_2+a_3b_3).$$

**Closed rational lift** (derived in the proof, T1):

$$\boxed{\;\tilde q_i=\Phi(q_i)=\frac{1}{w_i}\,(1,\;x_i,\;y_i,\;z_i),\qquad \tilde w_i=\frac{1}{w_i}>0.\;}$$

This satisfies $\langle\tilde q_i,\tilde q_i\rangle_{\mathbb L}=\dfrac{1-\lVert\mathbf m_i\rVert^2}{w_i^2}=\dfrac{w_i^2}{w_i^2}=1$ exactly, is rational whenever $q_i$ is, and requires only $w_i>0$ (guaranteed by §2). **The $S^3$ spinor $q_i$ and the hyperboloid point $\tilde q_i$ are different objects** — $q_i$ for local orientation, $\tilde q_i$ for hyperbolic scoring.

---

## 4. Hyperbolic Quadrance

$$\langle\tilde q_i,\tilde q_j\rangle_{\mathbb L}=\frac{1-\mathbf m_i\cdot\mathbf m_j}{w_iw_j}\;\ge 1,\qquad
\boxed{\;Q_h(i,j)=\langle\tilde q_i,\tilde q_j\rangle_{\mathbb L}^2-1\;\in\mathbb{Q}_{\ge0}.\;}$$

Properties (proof T2): **rational**, **symmetric**, $Q_h(i,j)=0\iff i=j$, square-root-free. ($Q_h=\sinh^2 d_{ij}$, but the geodesic distance $d_{ij}$ — irrational — is never evaluated on-chain.)

---

## 5. Channels, chirality, torsional resistance

**12-channel map (locked):** arms $\alpha\!\leftrightarrow\! x,\ \beta\!\leftrightarrow\! y,\ \gamma\!\leftrightarrow\! z$; phases $r\in\{0,1,2,3\}$ = coordinate value along the arm. $3\ \text{arms}\times 4\ \text{phases}=12$.

> **Adjacency note (locked):** the cube contributes **6 signed local directions** $\pm e_x,\pm e_y,\pm e_z$. Torsional **chirality + phase-lifting** resolve these into the **12-channel coupling space**. We do *not* claim the cube has 12 neighbor directions.

**Chirality** $\chi_{ij}\in\{0,1\}$: $\chi_{ij}=0$ if $i\to j$ runs *with* the trefoil winding (forward), $\chi_{ij}=1$ if *against* (reverse). Forward/reverse partition the oriented edges; the forward set is $E^+=\{(i,j):\chi_{ij}=0,\ j\ \text{a face-neighbor of}\ i\}\ne\varnothing$.

**Spread** $s_{ij}\in\mathbb{Q}\cap[0,1]$ — rational-trigonometry spread between coupled arms; Frame‑5 baseline lock $s=\sin^2(2\pi/3)=\tfrac34$.

**Torsional resistance (rational):**

$$\boxed{\;A_{ij}=A_0\,s_{ij}\,\chi_{ij}\ \in\ \mathbb{Q}_{\ge0},\qquad A_0\in\mathbb{Q}_{>0}.\;}$$

So forward edges have $A_{ij}=0$; reverse edges have $A_{ij}=A_0 s_{ij}>0$.

---

## 6. Logits and the sparsemax row

**Inverse temperature (from the escape-valve scalar):**

$$\beta_i=\frac{1-w_i}{w_i}\in\mathbb{Q}_{>0},\qquad \kappa_i=\frac1{\beta_i}=\frac{w_i}{1-w_i}.$$

**Executable rational logit:**

$$\boxed{\;z_{i\to j}=-\,\beta_i\,Q_h(i,j)\;-\;\lambda\,A_{ij}\ \in\ \mathbb{Q},\qquad \lambda\in\mathbb{Q}_{>0}.\;}$$

**Candidate set** $\mathcal N_i$: the face-neighbors of $i$ **plus** the self-index $i$ (with $Q_h(i,i)=0$, $A_{ii}=0$, so the self-logit is maximal — this guarantees a nonempty active set and row-stochasticity at corners/edges).

**Sparsemax row** (α‑entmax, α = 2):

$$\boxed{\;K_{ij}=\big[\,z_{i\to j}-\tau_i\,\big]_+,\qquad \sum_{j}K_{ij}=1.\;}$$

with the active set $S_i$ and threshold determined by the standard sort rule: sort $\{z_{i\to j}\}_{j\in\mathcal N_i}$ descending as $z_{(1)}\ge z_{(2)}\ge\cdots$, let $k(i)=\max\{k: 1+k\,z_{(k)}>\sum_{r\le k}z_{(r)}\}$, $S_i=\{$top $k(i)\}$, and

$$\boxed{\;\tau_i=\frac{\big(\sum_{j\in S_i}z_{i\to j}\big)-1}{|S_i|}\ \in\ \mathbb{Q}.\;}$$

**Rationality (proof T3):** $z\in\mathbb{Q}\Rightarrow\tau_i\in\mathbb{Q}\Rightarrow K_{ij}\in\mathbb{Q}$. **Sparsity:** $K_{ij}>0\iff j\in S_i$ (exact geometric collapse, not a statistical smear).

**Analytic limit (Axiom II only):** $K^{\mathrm{an}}_{ij}=e^{z_{i\to j}}/Z_i$, $Z_i=\sum_{j}e^{z_{i\to j}}$.

---

## 7. Derrick stability (scalar $w$)

- Keep $w_i\in[w_{\min},w_{\max}]\subset(0,1)$ ⇒ $\beta_i,\ \tilde q_i$ finite and rational; neither uniform-diffusion ($w\to1$) nor delta-collapse ($w\to0$) is reachable.
- **Bounded relaxation mode (escape valve):** on an active-set tie ($z_{(k)}=z_{(k+1)}$, contradiction), increase $\kappa_i$ by one rational step (decrease $\beta_i$) within the annulus to break the tie. The **projected executable state stays parity-valid**; $w_i$ does **not** leave the bounded annulus. (We do *not* claim $q$ leaves $S^3$.)

---

## 8. Residual quarantine (Octet boundary) — **hard rule**

The deterministic 64-skeleton sees only rationals $Q_h^{\mathrm{rat}},z^{\mathrm{rat}},K^{\mathrm{rat}}$. Any analytic/visualization metric produces a residual

$$\varepsilon_{ij}=Q_h^{\mathrm{analytic}}(i,j)-Q_h^{\mathrm{rat}}(i,j)\ \longmapsto\ O_m,\quad m\in\{0,\dots,7\}.$$

**Rule (locked):** the Octet(8) may *record, balance, or visualize* $\varepsilon$, but **must not feed any irrational value back into the 64-node kernel before rationalization.** This protects the parity invariant (§9).

---

## 9. Determinism / parity invariant

All on-chain quantities are exact rationals reduced to lowest terms; partition denominators are reduced mod the prime sieve so two nodes agree bit-for-bit. The packet remains valid under the SHD-CCP seed check

$$\texttt{calculateTorusWinding(mantle)} \bmod 7 \;=\; \texttt{core},$$

else `THROW_ENTROPIC_COLLAPSE`. Because no $\exp$, root, or transcendental touches the executable kernel, the `%7` parity is preserved across nodes (proof T4).

---

## 10. Handshake binding (locked template)

| Step | Binds to |
|---|---|
| **ALIGN** | sync curvature lattice $\{\kappa_i\}$ + prime modulus for the `%7` check |
| **DECLARE** $B_{max}$ | cap on $\beta_i$ / active-set size $|S_i|$ the node may evaluate (authorized safe subset) |
| **INJECT** $SK_\ell$ | chiral depth: $SK_1\!\to\!1$ arm (Axiom I), …, $SK_3\!\to\!$ all 3 arms (Axiom III) |
| **EXECUTE** | lazy per-row unfolding of $K_{i\cdot}$ on visited voxels |

---

## 11. Pump binding (TTMPT)

The executable kernel feeds the 10-step macro-cycle. Forward current

$$J(t)=\sum_{(i,j)\in E^+}\big(\pi_i(t)K_{ij}(t)-\pi_j(t)K_{ji}(t)\big),$$

is **strictly positive** in the analytic layer (TTMPT Thm 4.1) and **forward-biased edge-wise** in the executable layer; if the valveless base is doubly stochastic ($\pi\equiv 1/64$) then $J^{\mathrm{exec}}>0$ exactly (proof T5). Scalar field advances $B(t_7)>B(t_5)$; phase resets $\Theta_{10}\equiv\Theta_0\ (\mathrm{mod}\ 2\pi)$.

---

## 12. Frozen invariants (implementation MUST satisfy)

1. `q_i ∈ S³ ∩ ℚ⁴`, `w_min ≤ w_i ≤ w_max`, `0 < w_min`, `w_max < 1`.
2. `⟨q̃_i,q̃_i⟩_L = 1` exactly; `q̃_i = (1/w_i)(1, m_i)`.
3. `Q_h(i,j) ∈ ℚ_{≥0}`, symmetric, `=0 ⇔ i=j`.
4. `z_{i→j} ∈ ℚ`; `τ_i ∈ ℚ`; `K_ij ∈ ℚ`; `Σ_j K_ij = 1`; `K_ij ≥ 0`.
5. forward edges `A_ij = 0`, reverse `A_ij > 0` ⇒ `z_{i→j} > z_{j→i}` on active pairs.
6. no `exp`/`√`/transcendental in the executable path; residuals only in Octet(8).
7. `torusWinding(mantle) % 7 == core` holds after every transition.
