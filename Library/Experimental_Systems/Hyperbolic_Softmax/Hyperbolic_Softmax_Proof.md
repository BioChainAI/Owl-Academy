# Formal Proof: The Hyperbolic Sparsemax Pump on the SHD-CCP 4×4×4 Lattice

**Owl Academy — BioChain AI · Experimental Systems**
**Companion to:** [`kernel_spec.md`](kernel_spec.md) · [`Hyperbolic_Softmax_Design.md`](Hyperbolic_Softmax_Design.md)
**Upstream theorem:** [TTMPT](../../../Proofs/Torsional-Trefoil-Markov-Pump/TTMPT-Formal-Proof.pdf)

---

## Abstract

We formalize a deterministic, **rational** transition kernel — the *hyperbolic sparsemax kernel* — over the $64$-voxel SHD-CCP cubic packet, and prove it is the parity-safe executable member of a two-layer family whose analytic limit is the Torsional Trefoil Markov Pump (TTMPT). We prove: (T1) the $S^3$ spinor admits a **closed rational Lorentz lift** to the hyperboloid $\mathbb H^3$; (T2) the induced hyperbolic Quadrance $Q_h$ is rational, symmetric, nonnegative, and vanishes only on the diagonal; (T3) the sparsemax row is rational, row-stochastic, and sparse; (T4) the executable pipeline is closed in $\mathbb Q$, hence preserves the SHD-CCP `%7` parity invariant; (T5) a rational reverse-valve breaks detailed balance and yields a **strictly positive forward current** with respect to the base measure, while the analytic exponential valve reproduces the TTMPT current theorem verbatim; (T6) the escape-valve scalar $w$ confines the system to a Derrick-stable rational annulus; (T7) the $10$-step macro-cycle resets the modular phase. The synthesis (§9) is the **Hyperbolic Sparsemax Pump Theorem**.

---

## Notation

| Symbol | Meaning |
|---|---|
| $V=\{0,1,2,3\}^3$ | $64$ voxels; core $C=\{1,2\}^3$ (8), mantle $M=V\setminus C$ (56) |
| $q_i=(w_i,\mathbf m_i)\in S^3\cap\mathbb Q^4$ | rational unit-quaternion spinor; $w_i\in[w_{\min},w_{\max}]\subset(0,1)$ |
| $\langle a,b\rangle_{\mathbb L}=a_0b_0-\mathbf a\!\cdot\!\mathbf b$ | Minkowski form |
| $\tilde q_i=\Phi(q_i)\in\mathbb H^3$ | Lorentz lift; $\langle\tilde q_i,\tilde q_i\rangle_{\mathbb L}=1$, $\tilde w_i>0$ |
| $Q_h(i,j)=\langle\tilde q_i,\tilde q_j\rangle_{\mathbb L}^2-1$ | hyperbolic Quadrance |
| $\beta_i=\tfrac{1-w_i}{w_i}$ | inverse temperature (rational) |
| $A_{ij}=A_0 s_{ij}\chi_{ij}$ | torsional resistance; $\chi_{ij}\in\{0,1\}$ chirality, $s_{ij}\in\mathbb Q\cap[0,1]$ |
| $E^+$ | forward (with-winding) oriented edge set, $E^+\ne\varnothing$ |
| $z_{i\to j}=-\beta_iQ_h(i,j)-\lambda A_{ij}$ | executable rational logit, $\lambda\in\mathbb Q_{>0}$ |
| $K_{ij}=[z_{i\to j}-\tau_i]_+$ | sparsemax row |
| $\rho_{ij}=\tfrac{1}{1+\lambda A_{ij}}$ | rational reverse-valve, $0<\rho_{ij}\le1$ |
| $[x]_+=\max(x,0)$ | rectifier |

---

## 1. Standing assumptions (the locked design)

**(A1)** Every spinor is a rational unit quaternion with positive, annulus-bounded scalar: $q_i\in S^3\cap\mathbb Q^4$, $0<w_{\min}\le w_i\le w_{\max}<1$.
**(A2)** $s_{ij},A_0,\lambda,\beta_i\in\mathbb Q$ with $A_0,\lambda>0$; resistance $A_{ij}=A_0 s_{ij}\chi_{ij}$ with $\chi_{ij}=0$ on forward edges and $\chi_{ij}=1$ on reverse edges.
**(A3)** Face-adjacency is symmetric and the candidate set $\mathcal N_i$ is the face-neighbors of $i$ together with $i$ itself.
**(A4)** No transcendental function ($\exp,\log,\sqrt{\,\cdot\,}$, trig) is evaluated in the executable path; analytic-layer residuals are routed to the Octet buffer and never re-enter the kernel before rationalization.

---

## 2. The Rational Lorentz Lift

> **Theorem T1 (Closed rational lift).** Under (A1) the map
> $$\Phi(q_i)=\tilde q_i:=\frac{1}{w_i}\,(1,\,x_i,\,y_i,\,z_i)$$
> is a well-defined point of the hyperboloid $\mathbb H^3=\{\tilde q:\langle\tilde q,\tilde q\rangle_{\mathbb L}=1,\ \tilde w>0\}$, has rational coordinates, and is the inverse-stereographic image of $q_i$. In particular $\tilde w_i=1/w_i>0$ and the lift is **distinct** from the $S^3$ spinor.

**Proof.** *Construction.* Stereographically project the spinor from the south pole $(-1,\mathbf 0)\in S^3$ into the open unit ball,
$$\mathbf b_i=\frac{\mathbf m_i}{1+w_i}\in\mathbb Q^3,\qquad \lVert\mathbf b_i\rVert^2=\frac{\lVert\mathbf m_i\rVert^2}{(1+w_i)^2}=\frac{1-w_i^2}{(1+w_i)^2}=\frac{1-w_i}{1+w_i}<1,$$
using $\lVert\mathbf m_i\rVert^2=1-w_i^2$ from (A1). The standard inverse-stereographic lift from the Poincaré ball to the hyperboloid is
$$\tilde w_i=\frac{1+\lVert\mathbf b_i\rVert^2}{1-\lVert\mathbf b_i\rVert^2},\qquad \tilde{\mathbf v}_i=\frac{2\mathbf b_i}{1-\lVert\mathbf b_i\rVert^2}.$$
Substituting $1-\lVert\mathbf b_i\rVert^2=\dfrac{2w_i}{1+w_i}$ and $1+\lVert\mathbf b_i\rVert^2=\dfrac{2}{1+w_i}$ gives
$$\tilde w_i=\frac{2/(1+w_i)}{2w_i/(1+w_i)}=\frac{1}{w_i},\qquad \tilde{\mathbf v}_i=\frac{2\,\mathbf m_i/(1+w_i)}{2w_i/(1+w_i)}=\frac{\mathbf m_i}{w_i}.$$
Hence $\tilde q_i=\tfrac1{w_i}(1,\mathbf m_i)$.

*Verification.* $\langle\tilde q_i,\tilde q_i\rangle_{\mathbb L}=\tilde w_i^2-\lVert\tilde{\mathbf v}_i\rVert^2=\dfrac{1-\lVert\mathbf m_i\rVert^2}{w_i^2}=\dfrac{1-(1-w_i^2)}{w_i^2}=\dfrac{w_i^2}{w_i^2}=1.$ Since $w_i>0$, $\tilde w_i=1/w_i>0$, so $\tilde q_i$ lies on the forward sheet. All operations are field operations on $\mathbb Q$, so $\tilde q_i\in\mathbb Q^4$. Finally $\langle\tilde q_i,\tilde q_i\rangle_{\mathbb L}=1\ne w_i^2+\lVert\mathbf m_i\rVert^2=1$ as *quadratic forms*: the $S^3$ constraint is Euclidean while the $\mathbb H^3$ constraint is Lorentzian, so $q_i\mapsto\tilde q_i$ is a genuine change of geometry, not the identity. $\qquad\blacksquare$

---

## 3. The Hyperbolic Quadrance

> **Theorem T2 (Quadrance is a rational metric kernel).** For all $i,j$,
> $$\langle\tilde q_i,\tilde q_j\rangle_{\mathbb L}=\frac{1-\mathbf m_i\!\cdot\!\mathbf m_j}{w_iw_j}\ \ge\ 1,\qquad Q_h(i,j)=\langle\tilde q_i,\tilde q_j\rangle_{\mathbb L}^2-1\ \in\ \mathbb Q_{\ge0},$$
> and $Q_h$ is symmetric with $Q_h(i,j)=0\iff q_i=q_j$.

**Proof.** By T1, $\langle\tilde q_i,\tilde q_j\rangle_{\mathbb L}=\tilde w_i\tilde w_j-\tilde{\mathbf v}_i\!\cdot\!\tilde{\mathbf v}_j=\dfrac{1}{w_iw_j}-\dfrac{\mathbf m_i\cdot\mathbf m_j}{w_iw_j}=\dfrac{1-\mathbf m_i\cdot\mathbf m_j}{w_iw_j}$, which is rational and symmetric in $(i,j)$.

For the lower bound, apply Cauchy–Schwarz to the two **unit** vectors $q_i,q_j\in\mathbb R^4$:
$$q_i\!\cdot\! q_j=w_iw_j+\mathbf m_i\!\cdot\!\mathbf m_j\ \le\ \lVert q_i\rVert\,\lVert q_j\rVert=1,$$
so $1-\mathbf m_i\cdot\mathbf m_j\ge w_iw_j>0$, giving $\langle\tilde q_i,\tilde q_j\rangle_{\mathbb L}\ge1$. Therefore $Q_h(i,j)=\langle\tilde q_i,\tilde q_j\rangle_{\mathbb L}^2-1\ge0$, and being a product/difference of rationals, $Q_h\in\mathbb Q_{\ge0}$. Equality $q_i\cdot q_j=1$ holds iff $q_i=q_j$ (equality in Cauchy–Schwarz for unit vectors), i.e. $\langle\tilde q_i,\tilde q_j\rangle_{\mathbb L}=1\iff q_i=q_j\iff Q_h(i,j)=0$. No square root is taken: $Q_h=\sinh^2 d_{ij}$ but the geodesic distance $d_{ij}$ is never formed. $\qquad\blacksquare$

---

## 4. The Sparsemax Row

> **Theorem T3 (Rational row-stochastic sparsity).** Fix a source $i$ and rational logits $\{z_{i\to j}\}_{j\in\mathcal N_i}$. The Euclidean projection onto the simplex
> $$K_{i\cdot}=\arg\min_{p\in\Delta}\lVert p-z_{i\cdot}\rVert_2^2$$
> has the closed form $K_{ij}=[z_{i\to j}-\tau_i]_+$ with active set $S_i$ and threshold $\tau_i=\big(\sum_{j\in S_i}z_{i\to j}-1\big)/|S_i|$. Then: **(i)** $\tau_i\in\mathbb Q$ and $K_{ij}\in\mathbb Q$; **(ii)** $K_{ij}\ge0$ and $\sum_j K_{ij}=1$; **(iii)** $K_{ij}>0\iff j\in S_i$, and $i\in S_i$, so the support is nonempty.

**Proof.** *(i) Rationality.* Sort the logits descending, $z_{(1)}\ge\cdots\ge z_{(|\mathcal N_i|)}$; sorting is decided by rational comparisons only. The active size is
$$k(i)=\max\Big\{k:\ 1+k\,z_{(k)}>\textstyle\sum_{r\le k}z_{(r)}\Big\},$$
again a finite set of rational inequalities, so $k(i)$ and $S_i=\{(1),\dots,(k(i))\}$ are determined exactly. Then $\tau_i=\big(\sum_{j\in S_i}z_{i\to j}-1\big)/|S_i|$ is an integer-denominator combination of rationals, hence $\tau_i\in\mathbb Q$, and $K_{ij}=\max(0,z_{i\to j}-\tau_i)\in\mathbb Q$.

*(ii) Row-stochasticity.* For $j\in S_i$ the threshold rule guarantees $z_{i\to j}>\tau_i$, so $K_{ij}=z_{i\to j}-\tau_i>0$; for $j\notin S_i$, $K_{ij}=0$. Summing over the active set,
$$\sum_{j}K_{ij}=\sum_{j\in S_i}(z_{i\to j}-\tau_i)=\Big(\sum_{j\in S_i}z_{i\to j}\Big)-|S_i|\,\tau_i=\Big(\sum_{j\in S_i}z_{i\to j}\Big)-\Big(\sum_{j\in S_i}z_{i\to j}-1\Big)=1.$$

*(iii) Nonempty support.* By T2, $Q_h(i,i)=0$ and $A_{ii}=0$, so $z_{i\to i}=0\ge z_{i\to j}$ for all $j$ (every other logit is $\le0$). Thus $i$ attains the maximum and $i\in S_i$; the support is never empty, and rows for boundary/corner voxels remain stochastic. $\qquad\blacksquare$

**Remark (collapse vs. smear).** Sparsity means most neighbors receive *exactly* zero mass — the "exact topological resolution / geometric collapse" demanded by the breathing substrate, as opposed to a dense statistical distribution.

---

## 5. Determinism and Parity Safety

> **Theorem T4 (Closure in $\mathbb Q$ ⇒ parity preserved).** Under (A1)–(A4) every quantity on the executable path — $\tilde q_i,\,Q_h,\,\beta_i,\,A_{ij},\,z_{i\to j},\,\tau_i,\,K_{ij}$ — lies in $\mathbb Q$ and is computed by a fixed finite expression in $\{+,-,\times,\div,\,\text{compare},[\,\cdot\,]_+\}$. Consequently two nodes sharing a seed compute bitwise-identical core/mantle states, and the SHD-CCP invariant $\texttt{torusWinding(mantle)}\bmod 7=\texttt{core}$ is preserved.

**Proof.** $\mathbb Q$ is a field: it is closed under $+,-,\times,\div$ (nonzero denominators are guaranteed — $w_i\ge w_{\min}>0$ by (A1), and $|S_i|\ge1$ by T3(iii)). The rectifier $[\,\cdot\,]_+$ and comparisons are order operations preserving $\mathbb Q$. By T1–T3 the entire executable chain is a finite composition of these, so each output is an exact rational, reducible to lowest terms canonically. A canonical reduced fraction has a unique representation independent of hardware floating-point, so any two conforming nodes obtain identical numerators/denominators, hence identical packed bits. The parity check `torusWinding(mantle) % 7 == core` is an integer function of those bits; identical bits ⇒ identical (and, by seed validity, satisfied) parity. By contrast the analytic $\exp$ is transcendental and rounding-dependent, which is exactly why (A4) forbids it on-chain; (A4) keeps all residuals $\varepsilon_{ij}=Q_h^{\text{analytic}}-Q_h^{\text{rat}}$ inside the Octet buffer, where they cannot perturb the rational kernel. $\qquad\blacksquare$

---

## 6. The Torsional Valve, Broken Detailed Balance, and the Pump Current

We separate the **analytic** guarantee (full TTMPT current) from the **executable** guarantee (exact rational positive current).

### 6.1 Analytic layer (Axiom II)

> **Theorem T5a (Analytic pump).** Let $K^{\mathrm{an}}_{ij}=e^{z_{i\to j}}/Z_i$ be the Gibbs kernel of the logits $z$, and impose on each $(i,j)\in E^+$ the Tesla-valve relation $K^{\mathrm{an}}_{ji}=K^{\mathrm{an}}_{ij}\,e^{-\lambda A_{ij}}$ together with $\pi_i>\pi_j e^{-\lambda A_{ij}}$. Then the hypotheses of [TTMPT Theorem 4.1] hold, so the forward current $J(t)=\sum_{E^+}(\pi_iK^{\mathrm{an}}_{ij}-\pi_jK^{\mathrm{an}}_{ji})>0$, detailed balance fails, and integrating $\dot B=J$ over $[t_5,t_7]$ gives $B(t_7)>B(t_5)$.

**Proof.** The logits, the valve relation, and the structural inequality are precisely the premises of TTMPT Lemma 2.1 / Theorem 4.1; the cited proof gives, for each forward edge, $\pi_iK^{\mathrm{an}}_{ij}-\pi_jK^{\mathrm{an}}_{ji}=K^{\mathrm{an}}_{ij}\big(\pi_i-\pi_j e^{-\lambda A_{ij}}\big)>0$. Summation over the nonempty $E^+$ and integration of the strictly positive continuous $J$ over $t_7>t_5$ yields the claim. $\qquad\blacksquare$

### 6.2 Executable layer (Axiom I) — exact rational current

Define the executable kernel by a symmetric rational base plus a directed rational valve:

1. **Symmetric base affinity** (rational, sparse): for $j\in\mathcal N_i$, with a global rational $\beta,\theta$,
$$W_{ij}=[\,-\beta\,Q_h(i,j)-\theta\,]_+,\qquad W_{ij}=W_{ji}\ \ (\text{by T2 and (A3)}).$$
2. **Reversible base walk:** $d_i=\sum_{k}W_{ik}\in\mathbb Q_{>0}$, $P^0_{ij}=W_{ij}/d_i$, stationary $\pi^0_i=d_i/D$, $D=\sum_m d_m$. Reversibility: $\pi^0_iP^0_{ij}=W_{ij}/D=W_{ji}/D=\pi^0_jP^0_{ji}$.
3. **Valved kernel** (forward accepted, reverse attenuated by $\rho_{ij}=\frac{1}{1+\lambda A_{ij}}$, rejected mass to the diagonal):
$$K_{ij}=\begin{cases}P^0_{ij}, & (i,j)\in E^+,\\[2pt] P^0_{ij}\,\rho_{ij}, & (i,j)\ \text{reverse},\\[2pt] P^0_{ii}+\displaystyle\sum_{k:\,(i,k)\,\text{reverse}}P^0_{ik}\,(1-\rho_{ik}), & j=i.\end{cases}$$

> **Theorem T5b (Executable broken balance & positive current).** $K$ is rational and row-stochastic, and for every forward edge $(i,j)\in E^+$ with $W_{ij}>0$,
> $$\pi^0_iK_{ij}-\pi^0_jK_{ji}=\frac{W_{ij}}{D}\,\big(1-\rho_{ji}\big)>0.$$
> Hence the base-referenced executable current $J_0=\sum_{(i,j)\in E^+}\big(\pi^0_iK_{ij}-\pi^0_jK_{ji}\big)>0$, so detailed balance fails. If $W$ is regular ($d_i\equiv d$, so $\pi^0\equiv1/64$), then $J_0=\frac{1}{64}\sum_{E^+}(K_{ij}-K_{ji})>0$.

**Proof.** *Rational & row-stochastic.* Each $W_{ij},d_i,P^0_{ij},\rho_{ij}$ is rational (T2, T3, field closure), so $K_{ij}\in\mathbb Q$. For row $i$, $\sum_j K_{ij}=\sum_{\text{fwd }j}P^0_{ij}+\sum_{\text{rev }j}P^0_{ij}\rho_{ij}+P^0_{ii}+\sum_{\text{rev }k}P^0_{ik}(1-\rho_{ik})=\sum_{j}P^0_{ij}=1$, the rejected reverse mass $\sum_{\text{rev}}P^0_{ik}(1-\rho_{ik})$ being returned exactly to the diagonal.

*Positive current.* Fix $(i,j)\in E^+$. The reverse edge is $(j,i)$ with $A_{ji}=A_0 s_{ji}>0$, hence $\rho_{ji}=\frac1{1+\lambda A_{ji}}<1$. Forward acceptance gives $K_{ij}=P^0_{ij}$; reverse attenuation gives $K_{ji}=P^0_{ji}\rho_{ji}$. Therefore
$$\pi^0_iK_{ij}-\pi^0_jK_{ji}=\pi^0_iP^0_{ij}-\pi^0_jP^0_{ji}\rho_{ji}\overset{\text{(reversibility)}}{=}\pi^0_iP^0_{ij}(1-\rho_{ji})=\frac{W_{ij}}{D}(1-\rho_{ji})>0,$$
since $W_{ij}>0$, $D>0$, $0<\rho_{ji}<1$. Summing over the nonempty $E^+$ gives $J_0>0$; a single nonzero forward term already forces $\pi^0_iK_{ij}\ne\pi^0_jK_{ji}$, so detailed balance fails. The regular-$W$ case substitutes $\pi^0\equiv1/64$. $\qquad\blacksquare$

**Reconciliation.** The per-row sparsemax of `kernel_spec.md` §6 furnishes the rational affinity layer ($W$ is its global-threshold form); the multiplicative valve $\rho$ realizes the locked executable relation $K^{\text{exec}}_{ji}=K^{\text{exec}}_{ij}\rho_{ij}$. Replacing $\rho_{ij}\leftarrow e^{-\lambda A_{ij}}$ recovers §6.1 — the two layers differ only in the valve transcendence, as locked.

---

## 7. Derrick Stability of the Escape-Valve Scalar

> **Theorem T6 (Annulus stability).** Under (A1) the inverse temperature and lift are uniformly bounded rationals,
> $$\beta_i\in\Big[\tfrac{1-w_{\max}}{w_{\max}},\,\tfrac{1-w_{\min}}{w_{\min}}\Big],\qquad \tilde w_i=\tfrac1{w_i}\in\Big[\tfrac1{w_{\max}},\tfrac1{w_{\min}}\Big],$$
> so neither the delta-collapse limit ($w\to0^+$, $\beta\to\infty$) nor the uniform-diffusion limit ($w\to1^-$, $\beta\to0$) is reachable. Moreover the bounded relaxation step $\beta_i\mapsto\beta_i'\in[\,\cdot\,]$ used to resolve an active-set tie keeps $K$ rational and row-stochastic (T3, T4), hence parity-valid.

**Proof.** $w\mapsto\frac{1-w}{w}$ and $w\mapsto\frac1w$ are continuous and strictly monotone on $(0,1)$, so on the closed annulus $[w_{\min},w_{\max}]$ they attain the stated finite rational bounds; the excluded endpoints are the two Derrick-unstable regimes. A tie $z_{(k)}=z_{(k+1)}$ is resolved by replacing $\beta_i$ with a strictly smaller rational $\beta_i'\ge\frac{1-w_{\max}}{w_{\max}}$ in the annulus; since $Q_h$ values are distinct off-diagonal (generic spinors), $\beta_i'$ strictly separates the tied logits, and recomputing T3 with the new rational $\beta_i'$ yields a rational row-stochastic $K$. The spinor $q_i$ is never required to leave $S^3$; only the rational scalar $\kappa_i=1/\beta_i$ relaxes. $\qquad\blacksquare$

---

## 8. Phase Closure

> **Theorem T7 (Modular reset).** With discrete phase update $\Theta_{k+1}=\Theta_k+\omega_k$ and the closure constraint $\sum_{k=0}^{9}\omega_k\equiv0\pmod{2\pi}$, one full $10$-step macro-cycle satisfies $\Theta_{10}\equiv\Theta_0\pmod{2\pi}$.

**Proof.** Iterating the update gives $\Theta_{10}=\Theta_0+\sum_{k=0}^9\omega_k$; the closure constraint reduces the sum to $0\bmod 2\pi$. This is TTMPT Phase IV applied to the channel phases of §5 of the spec. $\qquad\blacksquare$

---

## 9. Synthesis

> **Main Theorem (Hyperbolic Sparsemax Pump).** Under the locked assumptions (A1)–(A4), the executable hyperbolic sparsemax kernel $K$ on the $64$-voxel SHD-CCP packet is:
> 1. **well-posed and rational** — built from the closed rational Lorentz lift (T1) and rational Quadrance (T2);
> 2. **row-stochastic and sparse** (T3);
> 3. **parity-safe / deterministic** — closed in $\mathbb Q$, preserving `torusWinding(mantle) % 7 == core` (T4);
> 4. **detailed-balance-breaking with strictly positive forward current** with respect to its base measure (T5b), whose analytic limit is exactly the TTMPT pump (T5a);
> 5. **Derrick-stable** on a bounded rational annulus (T6);
>
> and therefore one macro-cycle advances the binding scalar $B(t_7)>B(t_5)$ while resetting the modular phase $\Theta_{10}\equiv\Theta_0\pmod{2\pi}$ (T7) — **without any irrational quantity entering the on-chain kernel.**

**Proof.** Combine T1–T7. T1–T2 give the geometry; T3 the normalizer; T4 determinism; T5a/T5b the pump in each layer; T6 stability; T7 the reset. The forbidden transcendental path is excluded by (A4), so the parity invariant of T4 holds throughout the cycle. $\qquad\blacksquare$

---

*End of Proof. The interactive demonstration in [`sim/`](sim/) instantiates (A1)–(A4) with exact `BigInt` rationals and reports $J_0>0$ numerically.*
