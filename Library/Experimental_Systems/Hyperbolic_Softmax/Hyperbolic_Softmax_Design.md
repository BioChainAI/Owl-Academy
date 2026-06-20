# Hyperbolic Softmax on a Torsional Markov Chain — Design

**Owl Academy — BioChain AI · Experimental Systems**
**Reads:** [`kernel_spec.md`](kernel_spec.md) (invariants) · [`Hyperbolic_Softmax_Proof.md`](Hyperbolic_Softmax_Proof.md) (theorems) · [`sim/`](sim/) (demo)
**Anchored to:** [TTMPT](../../../Proofs/Torsional-Trefoil-Markov-Pump/TTMPT-Formal-Proof.pdf) · SHD-CCP 4×4×4 packet · the SHD-CCP handshake & Three Axioms

---

## 1. The problem, and why a vanilla softmax is the wrong shape

We want a transition mechanism for the SHD-CCP $4\times4\times4$ (64-voxel) packet that exploits hyperbolic geometry and drives a **torsional Markov pump**. A textbook softmax $p_i=e^{z_i}/\sum_j e^{z_j}$ fails the substrate in four concrete ways:

1. **Transcendental ⇒ breaks the handshake.** $e^{x}$ is irrational/float-dependent, so two nodes disagree in low bits and fail `torusWinding(mantle) % 7 == core` → `ENTROPIC_COLLAPSE`. A floating-point softmax literally cannot complete the SHD-CCP handshake.
2. **Statistical ⇒ violates the substrate thesis.** The breathing substrate *"abandons statistical approximation in favor of algebraic inverse kinematics — exact topological resolution."* A dense probabilistic smear is what it rejects.
3. **Reversible ⇒ cannot pump.** A softmax built from a symmetric similarity is detailed-balanced; the torsional pump *requires broken detailed balance* for net current $J>0$.
4. **Euclidean & scalar ⇒ Derrick-unstable.** A flat scalar logit field collapses (to `argmax`) or diffuses flat; there is no escape valve.

**Conclusion.** "Hyperbolic softmax" here is a normalizer redesigned to be **hyperbolic** (geometry), **asymmetric** (pump), **rational** (determinism), and **$w$-stabilized** (Derrick). The deterministic member is **sparsemax**; "softmax" is reserved for its analytic limit.

---

## 2. Locked decisions (this revision)

| # | Decision | Lock |
|---|---|---|
| 1 | Hyperbolic model | **Lorentz/hyperboloid**, with the $S^3$ spinor $q_i$ kept **distinct** from the Lorentz-lifted point $\tilde q_i$; lift has a closed rational form $\tilde q_i=\frac1{w_i}(1,\mathbf m_i)$. |
| 2 | Normalizer | **sparsemax (α-entmax, α=2)** for the executable kernel; **softmax/Gibbs** only for the Axiom-II analytic proof. Name the executable layer *hyperbolic sparsemax*. |
| 3 | Valve | **Analytic:** exponential $e^{-\lambda A_{ij}}$. **Executable:** rational $\rho_{ij}=\frac{1}{1+\lambda A_{ij}}\in(0,1)$. Never an exponential on-chain. |
| 4 | 12↔64 map | **3 arms = axes $x,y,z$; 4 phases = coordinate positions**. The cube gives **6 signed directions**; chirality + phase-lifting resolve them into the **12-channel** coupling space. |
| 5 | Residuals | **Octet quarantine** — irrational residuals may be recorded/visualized in the Octet(8) but **cannot perturb the 64-node rational kernel** before rationalization. |
| 6 | Folder/casing | `Library/Experimental_Systems/Hyperbolic_Softmax/`. |
| — | Temperature | rational $\beta_i=\frac{1-w_i}{w_i}$, $\kappa_i=1/\beta_i$, on a Derrick-safe annulus $w\in[w_{\min},w_{\max}]\subset(0,1)$; "escape valve" = bounded rational relaxation of $\kappa_i$, *not* leaving $S^3$. |

---

## 3. The pipeline

```
 spinor q_i ∈ S³∩ℚ⁴ ──Φ──► Lorentz lift  q̃_i = (1/w_i)(1, m_i) ∈ ℍ³      [T1]
                                   │
        neighbor q̃_j (6 dirs)     ▼
                         Q_h(i,j) = ⟨q̃_i,q̃_j⟩_L² − 1  ∈ ℚ_{≥0}            [T2]
                                   │
   z_{i→j} = −β_i·Q_h(i,j) − λ·A_ij     (A_ij = A₀·s_ij·χ_ij, rational)     [valve, locks 3-4]
                                   │
                 sparsemax:  K_ij = [z_{i→j} − τ_i]_+ ,  Σ_j K_ij = 1       [T3]  (executable, ℚ)
                                   │           ╲  exp-Gibbs limit  K∝e^{z}    [Axiom II, ℝ]
            irrational residual ε_ij  ──►  Octet(8)  (never re-enters)       [lock 5, T4]
                                   ▼
        torsional Markov pump  K(t) ─► π, J(t) ─► B(t₇)>B(t₅), Θ₁₀≡Θ₀        [T5–T7]
```

---

## 4. State space and the 12-channel identification (lock 4)

$V=\{0,1,2,3\}^3$, $|V|=64$. **Core** $C=\{1,2\}^3$ (8 voxels) is the active index where mass may collapse; **Mantle** (56 voxels) is the query/cryptographic context.

Arms↔axes: $\alpha\!\leftrightarrow\! x,\ \beta\!\leftrightarrow\! y,\ \gamma\!\leftrightarrow\! z$. Phases↔positions: $r\in\{0,1,2,3\}$. The cube exposes **6 signed face directions** $\pm e_x,\pm e_y,\pm e_z$ per voxel; **chirality** $\chi$ (with-winding vs against) and phase-lifting resolve these into the **12 torsional channels** ($3\times4$). The forward set $E^+$ (with-winding edges) is nonempty — the pump's oriented skeleton.

---

## 5. The geometry (locks 1–2)

- **Two roles, two objects.** $q_i\in S^3$ carries local orientation/topology; $\tilde q_i\in\mathbb H^3$ carries hyperbolic *score*. They are not the same point — the Euclidean $S^3$ constraint and the Lorentzian $\mathbb H^3$ constraint are different quadratic forms.
- **Closed rational lift.** Stereographic projection $S^3\to$ ball followed by the inverse lift to the hyperboloid collapses to $\tilde q_i=\frac1{w_i}(1,\mathbf m_i)$, with $\langle\tilde q_i,\tilde q_i\rangle_{\mathbb L}=1$ exactly (proof T1). This is why the Lorentz model was chosen over the Poincaré ball: **the score is a polynomial in rational coordinates** — no roots, no $\operatorname{arcosh}$.
- **Quadrance.** $Q_h(i,j)=\big(\frac{1-\mathbf m_i\cdot\mathbf m_j}{w_iw_j}\big)^2-1\ge0$, rational and symmetric, $=0$ iff $q_i=q_j$ (proof T2). It is the rational-trigonometry-native replacement for distance ($Q_h=\sinh^2 d$, but $d$ is never formed).

---

## 6. The normalizer and the valve (locks 2–3)

**Executable (Axiom I, on-chain).** Sparsemax over the candidate set $\mathcal N_i=\{\text{face-neighbors}\}\cup\{i\}$:
$$z_{i\to j}=-\beta_iQ_h(i,j)-\lambda A_{ij},\qquad K_{ij}=[z_{i\to j}-\tau_i]_+,\qquad \tau_i=\frac{\sum_{j\in S_i}z_{i\to j}-1}{|S_i|}.$$
Rational, row-stochastic, sparse (proof T3). Sparsity *is* the "geometric collapse." The self-index has the maximal logit ($Q_h(i,i)=0$), guaranteeing a nonempty support at corners.

**The valve.** Forward edges carry $A_{ij}=0$, reverse edges $A_{ij}=A_0 s_{ij}>0$. The executable kernel uses the **rational** reverse attenuation $\rho_{ij}=\frac1{1+\lambda A_{ij}}<1$ (proof §6.2 builds $K$ as a symmetric sparse base + directed $\rho$-valve with rejected mass to the diagonal). The analytic kernel uses $e^{-\lambda A_{ij}}$ and reproduces the TTMPT current exactly (proof T5a).

**Why both.** The analytic exponential gives the clean TTMPT theorem $J(t)>0$; the rational valve gives an **exact** positive base-referenced current $J_0=\sum_{E^+}\frac{W_{ij}}{D}(1-\rho_{ji})>0$ (proof T5b) that is parity-safe.

---

## 7. Stability and determinism (locks 5, temperature)

- **Derrick / escape valve.** $w_i$ sets $\beta_i=\frac{1-w_i}{w_i}$. The closed annulus $w\in[w_{\min},w_{\max}]\subset(0,1)$ excludes both delta-collapse ($w\to0$) and uniform diffusion ($w\to1$); ties are broken by a **bounded rational relaxation** of $\kappa_i$, never by leaving $S^3$ (proof T6).
- **Octet boundary.** Any analytic metric produces $\varepsilon_{ij}=Q_h^{\text{analytic}}-Q_h^{\text{rat}}$, routed to the Octet(8) for recording/visualization only. The 64-node kernel sees rationals exclusively, so the `%7` parity survives every transition (proof T4).

---

## 8. Conformance to the locked SHD-CCP template

| Handshake | Hyperbolic sparsemax binding |
|---|---|
| **ALIGN** | sync the curvature lattice $\{\kappa_i\}$ + the prime modulus for `%7` |
| **DECLARE** $B_{max}$ | authorize a safe subset: cap $\beta_i$ / active-set size $|S_i|$ |
| **INJECT** $SK_\ell$ | chiral depth gate: $SK_1$→1 arm (Axiom I) … $SK_3$→3 arms (Axiom III) |
| **EXECUTE** | lazy per-row unfolding of $K_{i\cdot}$ on visited voxels |

**Axiom I** = on-chain sparsemax in $Q_h,s$. **Axiom II** = the Gibbs limit used for $\pi(t),J(t)$ calculus. **Axiom III** = full multi-arm chiral-gated kernel.

---

## 9. Folder contents (this experiment)

```
Hyperbolic_Softmax/
├─ index.html                     ← themed overview (this design, rendered)
├─ Hyperbolic_Softmax_Design.md   ← this file
├─ kernel_spec.md                 ← frozen invariants for implementation
├─ Hyperbolic_Softmax_Proof.md    ← theorems T1–T7 + Main Theorem
└─ sim/
   └─ index.html                  ← exact-rational 4×4×4 demo: logits → K → J₀
```

---

## 10. Open items / future work

- **Spread model $s_{ij}$.** Currently the Frame-5 baseline $s=3/4$; a richer per-arm spread schedule (time-parameterized $s_{ij}(u(t),v(t))$) would tie the valve to the double-toroidal collapse phase.
- **Chiral key depth.** Wire $SK_\ell\to$ number of active arms through the real handshake layer rather than as a static parameter.
- **Octet dynamics.** Promote the residual buffer from a passive sink to a balanced 8-node parity rotor (closing the 72-node toroid).
- **Core-collapse policy.** Formalize when sparsemax mass is allowed to land in the inner $2\times2\times2$ core vs. remain in the mantle.
