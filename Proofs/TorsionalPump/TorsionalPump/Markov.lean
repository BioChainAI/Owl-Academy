import Mathlib.Algebra.BigOperators.Fin
import Mathlib.Algebra.BigOperators.Field
import Mathlib.Algebra.Order.BigOperators.Group.Finset
import Mathlib.Data.Fin.VecNotation
import Mathlib.Data.Real.Basic
import Mathlib.Tactic.FinCases
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.NormNum
import Mathlib.Tactic.Positivity.Basic
import Mathlib.Tactic.Ring

/-!
# The three-state Markov circulation

States `0`, `1`, and `2` denote the outer (12), middle (10), and inner (8)
gears. All claims in this file are over exact real arithmetic. No
irreducibility assumption is needed for the stationary-current identity.
-/

namespace TorsionalPump.Markov

noncomputable section

abbrev State := Fin 3
abbrev Kernel := State → State → ℝ
abbrev Probability := State → ℝ

/-- A nonnegative kernel whose rows sum to one. -/
def Stochastic (K : Kernel) : Prop :=
  (∀ i j, 0 ≤ K i j) ∧ ∀ i, ∑ j, K i j = 1

/-- A normalized, nonnegative distribution. -/
def Distribution (π : Probability) : Prop :=
  (∀ i, 0 ≤ π i) ∧ ∑ i, π i = 1

/-- Row-vector convention: `π K = π`. -/
def Stationary (K : Kernel) (π : Probability) : Prop :=
  ∀ j, ∑ i, π i * K i j = π j

/-- One step of the discrete Markov evolution. -/
def advance (K : Kernel) (π : Probability) : Probability :=
  fun j => ∑ i, π i * K i j

/-- A stochastic step preserves a normalized probability distribution. -/
theorem advance_distribution (K : Kernel) (π : Probability)
    (hK : Stochastic K) (hπ : Distribution π) : Distribution (advance K π) := by
  constructor
  · intro j
    exact Finset.sum_nonneg (fun i _ => mul_nonneg (hπ.1 i) (hK.1 i j))
  · unfold advance
    rw [Finset.sum_comm]
    calc
      ∑ i, ∑ j, π i * K i j = ∑ i, π i := by
        apply Finset.sum_congr rfl
        intro i _
        rw [← Finset.mul_sum, hK.2 i, mul_one]
      _ = 1 := hπ.2

/-- Repeated Markov updates, including the initial distribution at time zero. -/
def evolve (K : Kernel) (π : Probability) : ℕ → Probability
  | 0 => π
  | n + 1 => advance K (evolve K π n)

theorem evolve_distribution (K : Kernel) (π : Probability)
    (hK : Stochastic K) (hπ : Distribution π) (n : ℕ) :
    Distribution (evolve K π n) := by
  induction n with
  | zero => exact hπ
  | succ n ih => exact advance_distribution K _ hK ih

/-- Stationarity means invariance under every finite number of pump updates. -/
theorem evolve_stationary (K : Kernel) (π : Probability)
    (hπ : Stationary K π) (n : ℕ) : evolve K π n = π := by
  induction n with
  | zero => rfl
  | succ n ih =>
    simp only [evolve, ih]
    exact funext hπ

/-- Directed probability flux minus the reverse flux. -/
def current (K : Kernel) (π : Probability) (i j : State) : ℝ :=
  π i * K i j - π j * K j i

/-- The paper's directed cycle is outer → middle → inner → outer. -/
def Pump (K : Kernel) (π : Probability) : Prop :=
  0 < current K π 0 1 + current K π 1 2 + current K π 2 0

/-- Detailed balance with respect to the stated distribution. -/
def DetailedBalance (K : Kernel) (π : Probability) : Prop :=
  ∀ i j, π i * K i j = π j * K j i

lemma sum_three (f : State → ℝ) : ∑ i, f i = f 0 + f 1 + f 2 := by
  simp [Fin.sum_univ_succ, add_assoc]

lemma stochastic_row (K : Kernel) (hK : Stochastic K) (i : State) :
    K i 0 + K i 1 + K i 2 = 1 := by
  simpa [sum_three] using hK.2 i

lemma stationary_column (K : Kernel) (π : Probability)
    (hπ : Stationary K π) (j : State) :
    π 0 * K 0 j + π 1 * K 1 j + π 2 * K 2 j = π j := by
  simpa [sum_three] using hπ j

/-- Paper Lemma 5. Row normalization and stationarity suffice, even for
reducible chains and without assuming strictly positive probabilities. -/
theorem stationary_cycle_currents (K : Kernel) (π : Probability)
    (hK : Stochastic K) (hπ : Stationary K π) :
    current K π 0 1 = current K π 1 2 ∧
    current K π 1 2 = current K π 2 0 := by
  have r0 := stochastic_row K hK 0
  have r1 := stochastic_row K hK 1
  have c0 := stationary_column K π hπ 0
  have c1 := stationary_column K π hπ 1
  have m0 := congrArg (fun x : ℝ => π 0 * x) r0
  have m1 := congrArg (fun x : ℝ => π 1 * x) r1
  dsimp [current]
  constructor <;> nlinarith [m0, m1]

/-- At stationarity, the sum of the three currents is three times any one. -/
theorem stationary_total_current (K : Kernel) (π : Probability)
    (hK : Stochastic K) (hπ : Stationary K π) :
    current K π 0 1 + current K π 1 2 + current K π 2 0 =
      3 * current K π 0 1 := by
  obtain ⟨h01, h12⟩ := stationary_cycle_currents K π hK hπ
  linarith

/-- Paper Lemma 5's equivalence between its two pump criteria. -/
theorem pump_iff_positive_current (K : Kernel) (π : Probability)
    (hK : Stochastic K) (hπ : Stationary K π) :
    Pump K π ↔ 0 < current K π 0 1 := by
  unfold Pump
  rw [stationary_total_current K π hK hπ]
  constructor <;> intro h <;> linarith

lemma current_antisymm (K : Kernel) (π : Probability) (i j : State) :
    current K π i j = -current K π j i := by
  unfold current
  ring

lemma current_self (K : Kernel) (π : Probability) (i : State) :
    current K π i i = 0 := by
  simp [current]

lemma detailedBalance_iff_zero_currents (K : Kernel) (π : Probability) :
    DetailedBalance K π ↔ ∀ i j, current K π i j = 0 := by
  simp only [DetailedBalance, current, sub_eq_zero]

/-- Directed circulation cannot satisfy detailed balance. -/
theorem pump_not_detailedBalance (K : Kernel) (π : Probability)
    (hp : Pump K π) : ¬DetailedBalance K π := by
  intro hd
  have hz := (detailedBalance_iff_zero_currents K π).mp hd
  unfold Pump at hp
  rw [hz 0 1, hz 1 2, hz 2 0] at hp
  linarith

/-- For three states stationarity also gives the converse: one zero cycle
current forces detailed balance on every pair. -/
theorem stationary_detailedBalance_iff (K : Kernel) (π : Probability)
    (hK : Stochastic K) (hπ : Stationary K π) :
    DetailedBalance K π ↔ current K π 0 1 = 0 := by
  constructor
  · intro h
    exact (detailedBalance_iff_zero_currents K π).mp h 0 1
  · intro h
    obtain ⟨h01, h12⟩ := stationary_cycle_currents K π hK hπ
    have hz12 : current K π 1 2 = 0 := by linarith
    have hz20 : current K π 2 0 = 0 := by linarith
    have hz10 : current K π 1 0 = 0 := by rw [current_antisymm, h]; simp
    have hz02 : current K π 0 2 = 0 := by rw [current_antisymm, hz20]; simp
    have hz21 : current K π 2 1 = 0 := by rw [current_antisymm, hz12]; simp
    apply (detailedBalance_iff_zero_currents K π).mpr
    intro i j
    fin_cases i <;> fin_cases j <;> first | assumption | exact current_self _ _ _

/-- Net current out of a state cannot exceed the probability at that state. -/
lemma current_le_probability (K : Kernel) (π : Probability)
    (hK : Stochastic K) (hπ : Distribution π) (i j : State) :
    current K π i j ≤ π i := by
  have hentry : K i j ≤ ∑ k, K i k :=
    Finset.single_le_sum (fun k _ => hK.1 i k) (Finset.mem_univ j)
  have hbound : K i j ≤ 1 := by rwa [hK.2 i] at hentry
  have hforward := mul_le_mul_of_nonneg_left hbound (hπ.1 i)
  have hreverse := mul_nonneg (hπ.1 j) (hK.1 j i)
  unfold current
  nlinarith

lemma neg_probability_le_current (K : Kernel) (π : Probability)
    (hK : Stochastic K) (hπ : Distribution π) (i j : State) :
    -π j ≤ current K π i j := by
  have h := current_le_probability K π hK hπ j i
  rw [current_antisymm K π j i] at h
  linarith

/-- Every normalized stationary three-state chain has cycle current in the
closed interval `[-1/3,1/3]`. The family below attains every point. -/
theorem stationary_current_bounds (K : Kernel) (π : Probability)
    (hK : Stochastic K) (hπ : Distribution π) (hs : Stationary K π) :
    -(1 / 3 : ℝ) ≤ current K π 0 1 ∧ current K π 0 1 ≤ 1 / 3 := by
  obtain ⟨h01, h12⟩ := stationary_cycle_currents K π hK hs
  have hsum : π 0 + π 1 + π 2 = 1 := by simpa [sum_three] using hπ.2
  have u0 := current_le_probability K π hK hπ 0 1
  have u1 := current_le_probability K π hK hπ 1 2
  have u2 := current_le_probability K π hK hπ 2 0
  have l0 := neg_probability_le_current K π hK hπ 0 1
  have l1 := neg_probability_le_current K π hK hπ 1 2
  have l2 := neg_probability_le_current K π hK hπ 2 0
  constructor <;> linarith

/-- A circulant kernel: forward probability `p`, reverse probability `q`,
and holding probability `1-p-q`. -/
def circulant (p q : ℝ) : Kernel := fun i j =>
  if i = j then 1 - p - q else if (i.val + 1) % 3 = j.val then p else q

def uniform : Probability := fun _ => 1 / 3

lemma uniform_distribution : Distribution uniform := by
  constructor
  · intro i
    norm_num [uniform]
  · norm_num [sum_three, uniform]

theorem circulant_stochastic (p q : ℝ)
    (hp : 0 ≤ p) (hq : 0 ≤ q) (hpq : p + q ≤ 1) :
    Stochastic (circulant p q) := by
  constructor
  · intro i j
    fin_cases i <;> fin_cases j <;>
      simp [circulant] <;> linarith
  · intro i
    fin_cases i <;> simp [sum_three, circulant] <;> ring

/-- Uniform stationarity follows algebraically, independently of positivity. -/
theorem circulant_uniform_stationary (p q : ℝ) :
    Stationary (circulant p q) uniform := by
  intro j
  fin_cases j <;> simp [sum_three, uniform, circulant] <;> ring

lemma circulant_current (p q : ℝ) :
    current (circulant p q) uniform 0 1 = (p - q) / 3 := by
  simp [current, circulant, uniform]
  ring

/-- A forward-biased circulant chain has strictly directed circulation. -/
theorem circulant_pump_iff (p q : ℝ) :
    Pump (circulant p q) uniform ↔ q < p := by
  unfold Pump current
  simp [circulant, uniform]
  constructor <;> intro h <;> linarith

/-- An exact rational example filling the paper's requested existence gap:
holding probability `9/20`, forward `1/2`, reverse `1/20`. -/
def forwardPump : Kernel := circulant (1 / 2) (1 / 20)

lemma forwardPump_stochastic : Stochastic forwardPump := by
  apply circulant_stochastic <;> norm_num

lemma forwardPump_positive (i j : State) : 0 < forwardPump i j := by
  fin_cases i <;> fin_cases j <;> norm_num [forwardPump, circulant]

lemma forwardPump_holding (i : State) : forwardPump i i = 9 / 20 := by
  fin_cases i <;> norm_num [forwardPump, circulant]

lemma forwardPump_stationary : Stationary forwardPump uniform :=
  circulant_uniform_stationary _ _

lemma forwardPump_current : current forwardPump uniform 0 1 = 3 / 20 := by
  rw [forwardPump, circulant_current]
  norm_num

lemma forwardPump_pumps : Pump forwardPump uniform := by
  apply (pump_iff_positive_current _ _ forwardPump_stochastic forwardPump_stationary).mpr
  rw [forwardPump_current]
  norm_num

lemma forwardPump_nonreversible : ¬DetailedBalance forwardPump uniform :=
  pump_not_detailedBalance _ _ forwardPump_pumps

/-- A one-parameter family realizing every feasible three-state stationary
cycle current, with zero holding probability. -/
def kernelAtCurrent (J : ℝ) : Kernel :=
  circulant (1 / 2 + 3 * J / 2) (1 / 2 - 3 * J / 2)

theorem prescribed_current_stochastic (J : ℝ)
    (hlo : -(1 / 3 : ℝ) ≤ J) (hhi : J ≤ 1 / 3) :
    Stochastic (kernelAtCurrent J) := by
  apply circulant_stochastic <;> linarith

theorem prescribed_current_stationary (J : ℝ) :
    Stationary (kernelAtCurrent J) uniform :=
  circulant_uniform_stationary _ _

theorem prescribed_current_exact (J : ℝ) :
    current (kernelAtCurrent J) uniform 0 1 = J := by
  rw [kernelAtCurrent, circulant_current]
  ring

theorem prescribed_current_pumps_iff (J : ℝ) :
    Pump (kernelAtCurrent J) uniform ↔ 0 < J := by
  rw [kernelAtCurrent, circulant_pump_iff]
  constructor <;> intro h <;> linarith

/-- Exact characterization of which cycle currents can be prescribed for a
normalized, stochastic three-state stationary model. -/
theorem prescribed_current_exists_iff (J : ℝ) :
    (∃ K π, Stochastic K ∧ Distribution π ∧ Stationary K π ∧
      current K π 0 1 = J) ↔ -(1 / 3 : ℝ) ≤ J ∧ J ≤ 1 / 3 := by
  constructor
  · rintro ⟨K, π, hK, hπ, hs, hJ⟩
    rw [← hJ]
    exact stationary_current_bounds K π hK hπ hs
  · rintro ⟨hlo, hhi⟩
    exact ⟨kernelAtCurrent J, uniform, prescribed_current_stochastic J hlo hhi,
      uniform_distribution, prescribed_current_stationary J, prescribed_current_exact J⟩

/-- Directed spanning-tree weights for roots outer, middle, and inner.
Each term is one of the three directed trees pointing toward its root. -/
def treeWeights (K : Kernel) : Probability := fun i =>
  match i.val with
  | 0 => K 1 0 * K 2 0 + K 1 0 * K 2 1 + K 1 2 * K 2 0
  | 1 => K 0 1 * K 2 1 + K 0 1 * K 2 0 + K 0 2 * K 2 1
  | _ => K 0 2 * K 1 2 + K 0 1 * K 1 2 + K 0 2 * K 1 0

def treeTotal (K : Kernel) : ℝ := ∑ i, treeWeights K i

def treeStationary (K : Kernel) : Probability :=
  fun i => treeWeights K i / treeTotal K

/-- The elementary three-state instance of the Markov chain tree identity. -/
theorem treeWeights_stationary (K : Kernel) (hK : Stochastic K) (j : State) :
    ∑ i, treeWeights K i * K i j = treeWeights K j := by
  have r0 := stochastic_row K hK 0
  have r1 := stochastic_row K hK 1
  have r2 := stochastic_row K hK 2
  have d0 : K 0 0 = 1 - K 0 1 - K 0 2 := by linarith
  have d1 : K 1 1 = 1 - K 1 0 - K 1 2 := by linarith
  have d2 : K 2 2 = 1 - K 2 0 - K 2 1 := by linarith
  fin_cases j <;> simp [sum_three, treeWeights, d0, d1, d2] <;> ring

lemma treeWeights_nonnegative (K : Kernel) (hK : Stochastic K) (i : State) :
    0 ≤ treeWeights K i := by
  have h01 := hK.1 0 1
  have h02 := hK.1 0 2
  have h10 := hK.1 1 0
  have h12 := hK.1 1 2
  have h20 := hK.1 2 0
  have h21 := hK.1 2 1
  fin_cases i <;> simp [treeWeights] <;> positivity

/-- Normalization requires positive total tree weight. This condition is
explicit rather than hiding an irreducibility hypothesis. -/
theorem treeStationary_distribution (K : Kernel) (hK : Stochastic K)
    (hT : 0 < treeTotal K) : Distribution (treeStationary K) := by
  constructor
  · intro i
    exact div_nonneg (treeWeights_nonnegative K hK i) (le_of_lt hT)
  · unfold treeStationary
    rw [← Finset.sum_div]
    exact div_self (ne_of_gt hT)

theorem treeStationary_stationary (K : Kernel) (hK : Stochastic K) :
    Stationary K (treeStationary K) := by
  intro j
  simp only [treeStationary, div_mul_eq_mul_div, ← Finset.sum_div]
  rw [treeWeights_stationary K hK j]

/-- The numerator is the forward cycle product minus the reverse product. -/
theorem treeStationary_cycle_current (K : Kernel) :
    current K (treeStationary K) 0 1 =
      (K 0 1 * K 1 2 * K 2 0 - K 0 2 * K 2 1 * K 1 0) / treeTotal K := by
  simp [current, treeStationary, treeWeights]
  ring

/-- For positive total tree weight, the pump condition is exactly a strict
forward-versus-reverse cycle-product inequality. No logarithm is needed. -/
theorem treeStationary_pump_iff (K : Kernel) (hK : Stochastic K)
    (hT : 0 < treeTotal K) :
    Pump K (treeStationary K) ↔
      K 0 2 * K 2 1 * K 1 0 < K 0 1 * K 1 2 * K 2 0 := by
  rw [pump_iff_positive_current K _ hK (treeStationary_stationary K hK),
    treeStationary_cycle_current, div_pos_iff_of_pos_right hT, sub_pos]

/-- Two positive transitions to the same root guarantee positive tree mass. -/
theorem treeTotal_pos (K : Kernel) (hK : Stochastic K)
    (h10 : 0 < K 1 0) (h20 : 0 < K 2 0) : 0 < treeTotal K := by
  have h01 := hK.1 0 1
  have h02 := hK.1 0 2
  have h12 := hK.1 1 2
  have h21 := hK.1 2 1
  simp [treeTotal, sum_three, treeWeights]
  positivity

end

end TorsionalPump.Markov
