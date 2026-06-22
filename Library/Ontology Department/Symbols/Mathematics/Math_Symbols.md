# Comprehensive List of Mathematical Symbols

A categorized reference of mathematical symbols, their LaTeX codes, and practical examples, organized by mathematical domain.

---

## 1. Constants

### 1.1 Key Mathematical Numbers

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $0$ — Zero, additive identity | `0` | $3 + 0 = 3$ |
| $1$ — One, multiplicative identity | `1` | $5 \times 1 = 5$ |
| $\sqrt{2}$ — Square root of 2 | `\sqrt{2}` | $(\sqrt{2}+1)^{2} = 3+2\sqrt{2}$ |
| $e$ — Euler's constant | `e` | $\ln(e^{2}) = 2$ |
| $\pi$ — Pi, Archimedes' constant | `\pi` | $\frac{\pi^{2}}{6} = \frac{1}{1^{2}}+\frac{1}{2^{2}}+\dots$ |
| $\varphi$ — Phi, golden ratio | `\varphi` | $\varphi = \frac{1+\sqrt{5}}{2}$ |
| $i$ — Imaginary unit | `i` | $(1+i)^{2} = 2i$ |

### 1.2 Key Mathematical Sets

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\emptyset$ — Empty set | `\varnothing` or `\emptyset` | $\|\emptyset\| = 0$ |
| $\mathbb{N}$ — Natural numbers | `\mathbb{N}` | $\forall x, y \in \mathbb{N}, x+y \in \mathbb{N}$ |
| $\mathbb{Z}$ — Integers | `\mathbb{Z}` | $\mathbb{N} \subseteq \mathbb{Z}$ |
| $\mathbb{Z}_+$ — Positive integers | `\mathbb{Z}_+` | $3 \in \mathbb{Z}_{+}$ |
| $\mathbb{Q}$ — Rational numbers | `\mathbb{Q}` | $\sqrt{2} \notin \mathbb{Q}$ |
| $\mathbb{R}$ — Real numbers | `\mathbb{R}` | $\forall x \in \mathbb{R}(x^{2} \ge 0)$ |
| $\mathbb{R}_{+}$ — Positive reals | `\mathbb{R}_+` | $\forall x,y \in \mathbb{R}_{+}(xy \in \mathbb{R}_{+})$ |
| $\mathbb{C}$ — Complex numbers | `\mathbb{C}` | $\exists z \in \mathbb{C}(z^{2}+1 = 0)$ |
| $\mathbb{Z}_n$ — Integers modulo n | `\mathbb{Z}_n` | In $\mathbb{Z}_{2}$, $1+1=0$ |
| $\mathbb{R}^3$ — 3D Euclidean space | `\mathbb{R}^3` | $(5,1,2) \in \mathbb{R}^{3}$ |

### 1.3 Key Mathematical Infinities

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\aleph_0$ — Cardinality of natural numbers | `\aleph_0` | $\aleph_{0} + 5 = \aleph_{0}$ |
| $\mathfrak{c}$ — Cardinality of real numbers | `\mathfrak{c}` | $\mathfrak{c} = 2^{\aleph_{0}}$ |
| $\omega$ — Smallest infinite ordinal | `\omega` | $\forall n \in \mathbb{N}(n < \omega)$ |

### 1.4 Other Key Mathematical Objects

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\mathbf{0}$ — Zero vector | `\mathbf{0}` | $\forall v \in V, v + \mathbf{0} = v$ |
| $e$ — Identity element of a group | `e` | $e \circ e = e$ |
| $I$ — Identity matrix | `I` | $AI = IA = A$ |
| $C$ — Constant of integration | `C` | $\int 1 \, dx = x + C$ |
| $\top$ — Tautology | `\top` | $P \land \top \equiv P$ |
| $\bot$ — Contradiction | `\bot` | $P \land \neg P \equiv \bot$ |
| $Z$ — Standard normal distribution | `Z` | $Z \sim N(0,1)$ |

---

## 2. Variables

### 2.1 Variables for Numbers

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $m, n, p, q$ — Integers and natural numbers | `m, n, p, q` | $m+n-q = 1$ |
| $a, b, c$ — Coefficients | `a, b, c` | $ax+by = 0$ |
| $x, y, z$ — Unknowns | `x, y, z` | If $2x+5=3$, then $x=-1$ |
| $\Delta$ — Discriminant | `\Delta` | $\Delta = b^{2}-4ac$ |
| $i, j, k$ — Index variables | `i, j, k` | $\sum_{i=1}^{10}i = 55$ |
| $t$ — Time variable | `t` | At $t=5$, velocity is $v(5)=32$ |
| $z$ — Complex numbers | `z` | $z\bar{z} = \|z\|^{2}$ |

### 2.2 Variables in Geometry

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $P, Q, R, S$ — Vertices | `P, Q, R, S` | $\overline{PQ} \perp \overline{QR}$ |
| $\ell$ — Lines | `\ell` | $\ell_{1} \parallel \ell_{2}$ |
| $\alpha, \beta, \gamma, \theta$ — Angles | `\alpha, \beta, \gamma, \theta` | $\alpha+\beta+\theta = 180^{\circ}$ |

### 2.3 Variables in Calculus

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $f(x), g(x,y), h(z)$ — Functions | `f(x), g(x,y), h(z)` | $f(2) = g(3,1)+5$ |
| $a_n, b_n, c_n$ — Sequences | `a_n, b_n, c_n` | $a_{n} = \frac{3}{n+2}$ |
| $h, \Delta x$ — Limiting variables | `h, \Delta x` | $\lim_{h \to 0}\frac{e^{h}-e^{0}}{h}=1$ |
| $\delta, \varepsilon$ — Small quantities for proofs | `\delta, \varepsilon` | If $\|x\| < \delta$ then $\|2x\| < \varepsilon$ |
| $F(x), G(x)$ — Antiderivatives | `F(x), G(x)` | $F^{\prime}(x) = f(x)$ |

### 2.4 Variables in Linear Algebra

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\mathbf{u}, \mathbf{v}, \mathbf{w}$ — Vectors | `\mathbf{u}, \mathbf{v}, \mathbf{w}` | $3\mathbf{u} + 4\mathbf{v} = \mathbf{w}$ |
| $A, B, C$ — Matrices | `A, B, C` | $AX = B$ |
| $\lambda$ — Eigenvalues | `\lambda` | $A\mathbf{v} = \lambda \mathbf{v}$ |

### 2.5 Variables in Set Theory and Logic

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $A, B, C$ — Sets | `A, B, C` | $A \subseteq B \cup C$ |
| $a, b, c$ — Elements | `a, b, c` | $a \in A$ |
| $P, Q, R$ — Propositions | `P, Q, R` | $P \vee \neg P \equiv \top$ |

### 2.6 Variables in Probability and Statistics

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $X, Y, Z$ — Random variables | `X, Y, Z` | $E(X+Y) = E(X)+E(Y)$ |
| $\mu$ — Population mean | `\mu` | $H_{0}:\mu=5$ |
| $\sigma$ — Population standard deviation | `\sigma` | $\sigma_{1}=\sigma_{2}$ |
| $s$ — Sample standard deviation | `s` | $s \ne \sigma$ |
| $n$ — Sample size | `n` | For $n \ge 30$, use normal dist. |
| $\rho$ — Population correlation | `\rho` | $H_{a}:\rho < 0$ |
| $r$ — Sample correlation | `r` | If $r=0.75$ then $r^{2}=0.5625$ |
| $p, \pi$ — Proportions | `p, \pi` | $p = \frac{X}{n}$, $\pi = 0.5$ |

---

## 3. Delimiters

### 3.1 Common Delimiters

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| `.` — Decimal separator | `.` | $25.9703$ |
| `:` — Ratio indicator | `:` | $1:4:9 = 3:12:27$ |
| `,` — Object separator | `,` | $(3,5,12)$ |
| `()`, `[]`, `{}` — Order of operations | `(), [], \{ \}` | $(a+b)\times c$ |
| `()`, `[]` — Interval indicators | `(), []` | $3 \notin (3,4]$, $4 \in (3,4]$ |

### 3.2 Other Delimiters

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $()$, $[]$ — Vector/Matrix markers | `\begin{pmatrix} \end{pmatrix}` | $\begin{pmatrix} 1 & 4 \\ 3 & 6 \end{pmatrix}$ |
| $\{ \}$ — Set builder | `\{ \}` | $\{ \pi, e, i \}$ |
| $\mid$, `:` — "Such that" markers | `\mid, :` | $\{x \mid x > 0\}$ |
| $\langle \rangle$ — Inner product | `\langle \rangle` | $\langle ka,b \rangle = k\langle a,b \rangle$ |
| $\lceil \rceil$ — Ceiling | `\lceil \rceil` | $\lceil 2.476 \rceil = 3$ |
| $\lfloor \rfloor$ — Floor | `\lfloor \rfloor` | $\lfloor \pi \rfloor = 3$ |
| $\begin{cases}\end{cases}$ — Piecewise marker | `\begin{cases} \end{cases}` | $f(x) = \begin{cases} 1 & x \ge 0 \\ 0 & x < 0 \end{cases}$ |

---

## 4. Operators

### 4.1 Common Operators

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $x+y$ — Sum | `x+y` | $2a+3a=5a$ |
| $x-y$ — Difference | `x-y` | $11-5=6$ |
| $-x$ — Additive inverse | `-x` | $-3+3=0$ |
| $x \times y$, $x \cdot y$, $xy$ — Product | `\times, \cdot` | $(m+1)n = mn+n$ |
| $x \div y$, $x/y$ — Quotient | `\div, /` | $152 \div 3 = 50.6\overline{6}$ |
| $\frac{x}{y}$ — Fraction | `\frac{x}{y}` | $\frac{53+5}{6} = \frac{53}{6}+\frac{5}{6}$ |
| $x^y$ — Power | `x^y` | $3^{4}=81$ |
| $x \pm y$ — Plus and minus | `\pm` | $\frac{-b \pm \sqrt{\Delta}}{2a}$ |
| $\sqrt{x}$ — Square root | `\sqrt{x}` | $\sqrt{2} \approx 1.414$ |
| $\|x\|$ — Absolute value | `|x|` | $\|-5\| = 5$ |
| $x\%$ — Percent | `\%` | $x\% = \frac{x}{100}$ |

### 4.2 Function-related Operators

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\mathrm{dom}\, f$ — Domain | `\mathrm{dom}\, f` | $\mathrm{dom}(\ln x) = \mathbb{R}_{+}$ |
| $\mathrm{ran}\, f$ — Range | `\mathrm{ran}\, f` | $\mathrm{ran}(\sin y) = [-1,1]$ |
| $f(x)$ — Image of an element | `f(x)` | $g(5) = g(4)+3$ |
| $f(X)$ — Image of a set | `f(X)` | $f(A \cap B) \subseteq f(A) \cap f(B)$ |
| $f \circ g$ — Composite function | `f \circ g` | $(f \circ g)(3) = 8$ |

### 4.3 Elementary Functions

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $k_n x^n + \dots$ — Polynomial | `k_n x^n + \dots` | $x^{3}+2x^{2}+3$ |
| $e^x$, $\exp(x)$ — Natural exponential | `e^x, \exp(x)` | $e^{x+y} = e^{x} \cdot e^{y}$ |
| $b^x$ — General exponential | `b^x` | $2^{x} > x^{2}$ |
| $\ln x$ — Natural logarithm | `\ln x` | $\ln(x^{2}) = 2\ln x$ |
| $\log x$ — Common logarithm | `\log x` | $\log 10000 = 4$ |
| $\log_b x$ — General logarithm | `\log_b x` | $\log_{2} x = \frac{\ln x}{\ln 2}$ |
| $\sin x, \cos x, \tan x$ — Trig functions | `\sin, \cos, \tan` | $\tan x = \frac{\sin x}{\cos x}$ |

### 4.4 Algebra-related Operators

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\gcd(x,y)$ — Greatest common factor | `\gcd(x,y)` | $\gcd(35,14) = 7$ |
| $\min(A), \max(A)$ — Minimum, Maximum | `\min(A), \max(A)` | $\max(A \cup B) \ge \max(A)$ |
| $x \bmod y$ — Modulo | `x \bmod y` | $36 \bmod 5 = 1$ |
| $\sum_{i=m}^n a_i$ — Summation | `\sum_{i=m}^n a_i` | $\sum_{i=1}^{5}i^{2} = 55$ |
| $\prod_{i=m}^n a_i$ — Product | `\prod_{i=m}^n a_i` | $\prod_{i=1}^{n}i = n!$ |
| $[a]$ — Equivalence class | `[a]` | $[a] = \{x \mid xRa\}$ |
| $\deg f$ — Degree of polynomial | `\deg f` | $\deg(2x^{2}+3x+5) = 2$ |
| $\bar{z}$ — Complex conjugate | `\bar{z}` | $\overline{5-8i} = 5+8i$ |
| $\arg z$ — Argument of complex number | `\arg z` | $\arg(1+i) = \frac{\pi}{4}+2\pi n$ |

### 4.5 Geometry-related Operators

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\angle ABC$ — Angle | `\angle ABC` | $\angle ABC = \angle CBA$ |
| $\measuredangle ABC$ — Measure of angle | `\measuredangle ABC` | $m\angle ABC = \angle A'B'C'$ |
| $\overleftrightarrow{AB}$ — Infinite line | `\overleftrightarrow{AB}` | $\overleftrightarrow{AB} = \overleftrightarrow{BA}$ |
| $\overline{AB}$ — Line segment | `\overline{AB}` | $\overline{AB} \ne \overline{AB'}$ |
| $\overrightarrow{AB}$ — Ray | `\overrightarrow{AB}` | $\overrightarrow{AB} \cong \overrightarrow{CD}$ |
| $\|AB\|$ — Distance between points | `|AB|` | $\|AB\| < \|A'B'\|$ |
| $\triangle ABC$ — Triangle | `\triangle ABC` | $\triangle ABC \cong \triangle A'B'C'$ |
| $\square ABCD$ — Quadrilateral | `\square ABCD` | $\square ABCD = \square DCBA$ |

### 4.6 Logic-related Operators

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\neg P$ — Negation | `\lnot P` | $\neg(1=2)$ |
| $P \land Q$ — Conjunction | `P \land Q` | $P \land Q \equiv Q \land P$ |
| $P \lor Q$ — Disjunction | `P \lor Q` | $\pi^e \in \mathbb{Q} \lor \pi^e \notin \mathbb{Q}$ |
| $P \to Q$ — Conditional | `P \to Q` | $P \to Q \equiv (\neg P \lor Q)$ |
| $P \leftrightarrow Q$ — Biconditional | `P \leftrightarrow Q` | $P \leftrightarrow Q \implies P \to Q$ |
| $\forall x P(x)$ — Universal statement | `\forall x P(x)` | $\forall y \in \mathbb{N} (y+1 \in \mathbb{N})$ |
| $\exists x P(x)$ — Existential statement | `\exists x P(x)` | $\exists z (z^2 = -\pi)$ |

### 4.7 Set-related Operators

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\overline{A}, A^c$ — Complement | `\overline{A}, A^c` | $\overline{\overline{A}} = A$ |
| $A \cap B$ — Intersection | `A \cap B` | $\{2,5\} \cap \{1,3\} = \emptyset$ |
| $A \cup B$ — Union | `A \cup B` | $\mathbb{N} \cup \mathbb{Z} = \mathbb{Z}$ |
| $A \setminus B$ — Set difference | `A \setminus B` | $A - B \ne B - A$ |
| $A \times B$ — Cartesian product | `A \times B` | $(11, -35) \in \mathbb{N} \times \mathbb{Z}$ |
| $\mathcal{P}(A)$ — Power set | `\mathcal{P}(A)` | $\mathcal{P}(\emptyset) = \{\emptyset\}$ |
| $\|A\|$ — Cardinality | `|A|` | $\|\{1,2,3\}\| = 3$ |

### 4.8 Vector-related Operators

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\|\mathbf{v}\|$ — Norm of vector | `|\mathbf{v}|` | $\|(3,4)\| = 5$ |
| $\mathbf{u} \cdot \mathbf{v}$ — Dot product | `\mathbf{u} \cdot \mathbf{v}` | $\mathbf{u} \cdot \mathbf{u} = \|\mathbf{u}\|^2$ |
| $\mathbf{u} \times \mathbf{v}$ — Cross product | `\mathbf{u} \times \mathbf{v}` | $\mathbf{u} \times \mathbf{u} = \mathbf{0}$ |
| $\mathrm{proj}_{\mathbf{v}} \mathbf{u}$ — Projection vector | `\mathrm{proj}_{\mathbf{v}} \mathbf{u}` | $\mathrm{proj}_{(0,1)} (5,4) = (0,4)$ |
| $\mathrm{span}(S)$ — Span of vectors | `\mathrm{span}(S)` | $\mathrm{span}(\{\mathbf{i}, \mathbf{j}\}) = \mathbb{R}^2$ |
| $\dim(V)$ — Dimension of vector space | `\dim(V)` | $\dim(\mathbb{R}^3) = 3$ |

### 4.9 Matrix-related Operators

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $A+B$ — Matrix sum | `A+B` | $A+X=B$ |
| $A-B$ — Matrix difference | `A-B` | $A-B \ne B-A$ |
| $-A$ — Additive inverse | `-A` | $B+(-B) = \mathbf{0}$ |
| $kA$ — Scalar product | `kA` | $(-1)A = -A$ |
| $AB$ — Matrix product | `AB` | $AI=IA=A$ |
| $A^T$ — Matrix transpose | `A^T` | $I^T=I$ |
| $A^{-1}$ — Matrix inverse | `A^{-1}` | $(AB)^{-1} = B^{-1}A^{-1}$ |
| $\mathrm{tr}(A)$ — Trace | `\mathrm{tr}(A)` | $\mathrm{tr}(A^T) = \mathrm{tr}(A)$ |
| $\det(A)$, $\|A\|$ — Determinant | `\det(A)` | $\det(AB) = \det(A)\det(B)$ |

### 4.10 Probability & Statistics Operators

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $n!$ — Factorial | `n!` | $4! = 4 \cdot 3 \cdot 2 \cdot 1$ |
| $nPr$ — Permutation | `nPr` | $5P3 = 5 \cdot 4 \cdot 3$ |
| $\binom{n}{r}$ — Combination | `\binom{n}{r}` | $\binom{5}{2} = \binom{5}{3}$ |
| $P(E)$ — Probability of event | `P(E)` | $P(A \cup B \cup C) = 0.\overline{3}$ |
| $P(A \mid B)$ — Conditional probability | `P(A \mid B)` | $P(A \mid B) = \frac{P(A \cap B)}{P(B)}$ |
| $E(X)$ — Expected value | `E(X)` | $E(X+Y) = E(X)+E(Y)$ |
| $V(X)$ — Variance | `V(X)` | $V(5X) = 25V(X)$ |
| $\overline{X}$ — Sample mean | `\overline{X}` | $\overline{3X} = 3\overline{X}$ |
| $s^2$ — Sample variance | `s^2` | $s^2 = \frac{\sum (X-\overline{X})^2}{n-1}$ |
| $\sigma^2$ — Population variance | `\sigma^2` | $\sigma^2 = \frac{\sum (X-\mu)^2}{n}$ |

### 4.11 Key Probability Distributions

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\text{Bin}(n, p)$ — Binomial | `\text{Bin}(n, p)` | $X \sim \text{Bin}(10, 0.5)$ |
| $\text{Geo}(p)$ — Geometric | `\text{Geo}(p)` | $Y \sim \text{Geo}(1/5) \implies E(Y)=5$ |
| $U(a,b)$ — Continuous uniform | `U(a,b)` | $X \sim U(3,7)$ |
| $N(\mu, \sigma^2)$ — Normal | `N(\mu, \sigma^2)` | $X \sim N(3, 5^2) \implies \frac{X-3}{5} \sim Z$ |
| $z_\alpha$ — Critical z-score | `z_\alpha` | $z_{0.05} \approx 1.645$ |
| $t_{\alpha,\nu}$ — Critical t-score | `t_{\alpha,\nu}` | $t_{0.05, 1000} \approx z_{0.05}$ |
| $\chi^2_{\alpha,\nu}$ — Chi-squared score | `\chi^2_{\alpha,\nu}` | $\chi^2_{0.05, 30} \approx 43.77$ |
| $F_{\alpha,\nu_1,\nu_2}$ — F-score | `F_{\alpha,\nu_1,\nu_2}` | $F_{0.05, 20, 20} \approx 2.1242$ |

### 4.12 Calculus-related Operators

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\lim_{n \to \infty} a_n$ — Limit of sequence | `\lim_{n \to \infty} a_n` | $\lim_{n \to \infty} \frac{n+3}{2n} = \frac{1}{2}$ |
| $\lim_{x \to c} f(x)$ — Limit of function | `\lim_{x \to c} f(x)` | $\lim_{x \to 3} \frac{\pi \sin x}{2} = \frac{\pi}{2} \lim_{x \to 3} \sin x$ |
| $\sup(A)$ — Supremum | `\sup(A)` | $\sup([-3,5)) = 5$ |
| $\inf(A)$ — Infimum | `\inf(A)` | $\inf(\{\frac{1}{1}, \frac{1}{2}, \dots\}) = 0$ |
| $f', f'', f^{(n)}$ — Derivative | `f', f^{(n)}` | $(\sin x)''' = -\cos x$ |
| $\int_a^b f(x) \, dx$ — Definite integral | `\int_a^b f(x) \, dx` | $\int_0^1 \frac{1}{1+x^2} \, dx = \frac{\pi}{4}$ |
| $\int f(x) \, dx$ — Indefinite integral | `\int f(x) \, dx` | $\int \ln x \, dx = x \ln x - x$ |
| $f_x$ — Partial derivative | `f_x, \frac{\partial f}{\partial x}` | $f(x,y)=x^2y^3 \implies f_x = 2xy^3$ |

---

## 5. Relational Symbols

### 5.1 Equality-based

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $=$ — Equal | `=` | $3x-x = 2x$ |
| $\ne$ — Not equal | `\ne` | $2 \ne 3$ |
| $\approx$ — Approximately equal | `\approx` | $\pi \approx 3.1416$ |
| $\sim$, $R$ — Related to | `\sim, R` | $x \sim y \iff \|x\|=\|y\|$ |
| $\equiv$ — Equivalent to | `\equiv` | $2 \equiv 101 \pmod{33}$ |
| $\propto$ — Proportional to | `\propto` | $V \propto r^3$ |

### 5.2 Comparison-based

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $<$ — Less than | `<` | $\sin x < 3$ |
| $>$ — Greater than | `>` | $\pi > e$ |
| $\le$ — Less than or equal | `\le` | $n! \le n^n$ |
| $\ge$ — Greater than or equal | `\ge` | $x^2 \ge 0$ |

### 5.3 Number-related

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\mid$ — Divisibility | `\mid` | $101 \mid 1111$ |
| $\perp$ — Coprime integers | `\perp` | $3 \perp 97$ |

### 5.4 Geometry-related

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\parallel$ — Parallel | `\parallel` | $\ell_1 \parallel \ell_2$ |
| $\perp$ — Perpendicular | `\perp` | $\overrightarrow{AB} \perp \overrightarrow{BC}$ |
| $\sim$ — Similar figures | `\sim` | $\triangle ABC \sim \triangle DEF$ |
| $\cong$ — Congruent figures | `\cong` | $\square ABCD \cong \square PQRS$ |

### 5.5 Set-related

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\in$ — Member of | `\in` | $\frac{2}{3} \in \mathbb{R}$ |
| $\notin$ — Not a member of | `\notin` | $\pi \notin \mathbb{Q}$ |
| $\subseteq$ — Subset of | `\subseteq` | $A \cap B \subseteq A$ |
| $=$ — Equal sets | `=` | If $A=B$, then $A \subseteq B$ |

### 5.6 Logic-related

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\implies$ — Implies | `\implies` | $x=4 \implies x \text{ is even}$ |
| $\impliedby$ — Implied by | `\impliedby` | $x=3 \impliedby 3x+2=11$ |
| $\iff$, $\equiv$ — If and only if | `\iff, \equiv` | $x \ne y \iff (x-y)^2 > 0$ |
| $\therefore$ — Therefore | `\therefore` | $i \in \mathbb{C} \therefore \exists z (z \in \mathbb{C})$ |
| $\because$ — Because | `\because` | $x = \frac{\pi}{2} \because \sin x=1 \land \cos x=0$ |

### 5.7 Probability/Calculus-related

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\perp$ — Independent events | `\perp` | $A \perp B \implies P(A \cap B) = P(A)P(B)$ |
| $\sim$ — Follows distribution | `\sim` | $Y \sim \text{Bin}(30, 0.4)$ |
| $\sim$ — Asymptotically equal | `\sim` | $\pi(x) \sim \frac{x}{\ln x}$ |
| $\in O(\dots)$ — Big-O notation | `\in O(...)` | $2x^2+3x+3 \in O(x^2)$ |

---

## 6. Notational Symbols

### 6.1 Common Notation

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $\dots, \cdots$ — Horizontal ellipsis | `\ldots, \cdots` | $1^2 + 2^2 + \dots + n^2$ |
| $\vdots, \ddots$ — Vertical ellipsis | `\vdots, \ddots` | Matrix rows/columns continuation |
| $f: A \to B$ — Domain/codomain | `f: A \to B` | $g: \mathbb{N} \to \mathbb{R}$ |
| $x \mapsto f(x)$ — Mapping rule | `x \mapsto f(x)` | $x \mapsto x^2$ |
| Q.E.D., $\blacksquare$ — End of proof | `Q.E.D., \blacksquare` | Thus the result is established. $\blacksquare$ |
| Q.E.A., $\bot$ — Contradiction | `Q.E.A., \bot` | $1=2 \ (\bot)$ |

### 6.2 Geometry, Trigonometry, and Calculus Notation

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| $^{\circ}$ — Degree | `^\circ` | $\cos(90^\circ) = 0$ |
| $'$ — Arcminute | `'` | $35' = \left(\frac{35}{60}\right)^\circ$ |
| $''$ — Arcsecond | `''` | $20'' = \left(\frac{20}{60}\right)'$ |
| $\mathrm{rad}$ — Radian | `\mathrm{rad}` | $\pi \text{ rad} = 180^\circ$ |
| $\mathrm{grad}$ — Gradian | `\mathrm{grad}` | $100 \text{ grad} = 90^\circ$ |
| $+\infty$ — Positive infinity | `+\infty` | $\frac{n^2+1}{n} \to +\infty$ |
| $-\infty$ — Negative infinity | `-\infty` | $\lim_{x \to -\infty} e^x = 0$ |
| $dx$ — Differential | `dx` | $dy = f'(x) dx$ |
| $\partial x$ — Partial differential | `\partial x` | $\frac{\partial f}{\partial x} dx$ |
| $df$ — Total differential | `df` | $dg(x,y) = \frac{\partial g}{\partial x}dx + \frac{\partial g}{\partial y}dy$ |

### 6.3 Probability and Statistics Notation

| Symbol | LaTeX Code | Example |
|--------|-----------|---------|
| i.i.d. — Independent and identically distributed | `\text{i.i.d.}` | Given $n$ i.i.d. random variables... |
| $H_0$ — Null hypothesis | `H_0` | $H_0: \mu = 23$ |
| $H_a$ — Alternative hypothesis | `H_a` | $H_a: \sigma_1^2 \ne \sigma_2^2$ |
