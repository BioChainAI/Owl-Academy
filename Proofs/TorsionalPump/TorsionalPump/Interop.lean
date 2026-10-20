import Mathlib.Algebra.Quaternion
import Mathlib.Algebra.Algebra.Rat
import Mathlib.Data.Real.Basic
import Mathlib.Data.Rat.Cast.Order
import Mathlib.Algebra.Order.BigOperators.Group.Finset
import Mathlib.Algebra.BigOperators.Ring.Finset

/-!
# Rational forward execution and offline reconstruction (Section 14)

The companion sparsemax paper is not part of the supplied specification.  Its
rational kernel, parity map, and rational unit-spinor lattice are consequently
explicit input data, with their advertised properties recorded as hypotheses.
Nothing here claims to derive that companion algorithm or its 64 voxel geometry.

This interface proves the properties needed to couple any such kernel to the
memory hierarchy: real embedding preserves quaternion algebra and unit norm,
emitted increments are unit, finite-step transitions remain stochastic and
parity safe, and offline reconstruction cannot change executable transition
weights.  Reentry requires a rational lattice target, an error certificate, and
an admissible forward edge.
-/

noncomputable section

namespace TorsionalPump.Interop

open scoped BigOperators Quaternion

/-- Componentwise application of `algebraMap ℚ ℝ` to a rational quaternion. -/
def embed (q : ℍ[ℚ]) : ℍ[ℝ] :=
  ⟨algebraMap ℚ ℝ q.re, algebraMap ℚ ℝ q.imI,
    algebraMap ℚ ℝ q.imJ, algebraMap ℚ ℝ q.imK⟩

@[simp] theorem embed_one : embed 1 = 1 := by
  ext <;> simp [embed]

@[simp] theorem embed_mul (p q : ℍ[ℚ]) : embed (p * q) = embed p * embed q := by
  ext <;> simp [embed]

@[simp] theorem embed_star (q : ℍ[ℚ]) : embed (star q) = star (embed q) := by
  ext <;> simp [embed]

@[simp] theorem normSq_embed (q : ℍ[ℚ]) :
    Quaternion.normSq (embed q) = algebraMap ℚ ℝ (Quaternion.normSq q) := by
  simp [Quaternion.normSq_def', embed]

/-- A rational unit spinor remains a unit spinor in the real reconstruction layer. -/
theorem embed_unit (q : ℍ[ℚ]) (hq : Quaternion.normSq q = 1) :
    Quaternion.normSq (embed q) = 1 := by
  simp [hq]

variable {S : Type*} [Fintype S]

/-- The hypotheses required of the exact rational forward kernel. -/
structure RationalKernel (S : Type*) [Fintype S] (parity : S → Bool) where
  weight : S → S → ℚ
  nonneg : ∀ i j, 0 ≤ weight i j
  stochastic : ∀ i, ∑ j, weight i j = 1
  parity_safe : ∀ i j, parity i ≠ parity j → weight i j = 0

namespace RationalKernel

variable {parity : S → Bool} (K : RationalKernel S parity)

/-- Viewing exact weights in the real reconstruction layer does not renormalize them. -/
def realWeight (i j : S) : ℝ := algebraMap ℚ ℝ (K.weight i j)

theorem realWeight_nonneg (i j : S) : 0 ≤ K.realWeight i j := by
  change 0 ≤ (K.weight i j : ℝ)
  exact Rat.cast_nonneg.mpr (K.nonneg i j)

theorem realWeight_stochastic (i : S) : ∑ j, K.realWeight i j = 1 := by
  simp only [realWeight, ← map_sum, K.stochastic, map_one]

theorem realWeight_parity_safe (i j : S) (h : parity i ≠ parity j) :
    K.realWeight i j = 0 := by
  simp [realWeight, K.parity_safe i j h]

/-- The same broken-detailed-balance primitive as on the coarse gears. -/
def current (mass : S → ℚ) (i j : S) : ℚ :=
  mass i * K.weight i j - mass j * K.weight j i

theorem current_antisymm (mass : S → ℚ) (i j : S) :
    K.current mass i j = -K.current mass j i := by
  unfold current
  exact (neg_sub _ _).symm

/-- Embedding does not change the definition or sign convention of the current. -/
theorem real_current (mass : S → ℚ) (i j : S) :
    algebraMap ℚ ℝ (K.current mass i j) =
      algebraMap ℚ ℝ (mass i) * K.realWeight i j -
      algebraMap ℚ ℝ (mass j) * K.realWeight j i := by
  simp [current, realWeight]

/-- Transition weights after exactly `n` steps, computed entirely in `ℚ`. -/
noncomputable def steps (n : ℕ) : S → S → ℚ := by
  classical
  exact Nat.rec (fun i j => if i = j then 1 else 0)
    (fun _ previous i j => ∑ k, previous i k * K.weight k j) n

theorem steps_nonneg (n : ℕ) (i j : S) : 0 ≤ K.steps n i j := by
  classical
  induction n generalizing i j with
  | zero =>
    change 0 ≤ if i = j then (1 : ℚ) else 0
    split
    · exact zero_le_one
    · exact le_rfl
  | succ n ih =>
    change 0 ≤ ∑ k, K.steps n i k * K.weight k j
    exact Finset.sum_nonneg fun k _ => mul_nonneg (ih i k) (K.nonneg k j)

theorem steps_stochastic (n : ℕ) (i : S) : ∑ j, K.steps n i j = 1 := by
  classical
  induction n with
  | zero => simp [steps]
  | succ n ih =>
    change (∑ j, ∑ k, K.steps n i k * K.weight k j) = 1
    rw [Finset.sum_comm]
    simp_rw [← Finset.mul_sum, K.stochastic, mul_one]
    exact ih

theorem real_steps_stochastic (n : ℕ) (i : S) :
    (∑ j, algebraMap ℚ ℝ (K.steps n i j)) = 1 := by
  simp only [← map_sum, K.steps_stochastic, map_one]

theorem steps_parity_safe (n : ℕ) (i j : S) (h : parity i ≠ parity j) :
    K.steps n i j = 0 := by
  classical
  induction n generalizing i j with
  | zero =>
    have hij : i ≠ j := fun hij => h (congrArg parity hij)
    simp [steps, hij]
  | succ n ih =>
    change (∑ k, K.steps n i k * K.weight k j) = 0
    apply Finset.sum_eq_zero
    intro k _
    by_cases hik : parity i = parity k
    · have hkj : parity k ≠ parity j := fun hkj => h (hik.trans hkj)
      rw [K.parity_safe k j hkj, mul_zero]
    · rw [ih i k hik, zero_mul]

/-- Any positive-probability multistep transition preserves the parity label. -/
theorem steps_positive_preserves_parity (n : ℕ) (i j : S)
    (h : 0 < K.steps n i j) : parity i = parity j := by
  by_contra hparity
  rw [K.steps_parity_safe n i j hparity] at h
  exact (lt_irrefl 0) h

/-- The same parity guarantee applies to a single executable edge. -/
theorem positive_preserves_parity (i j : S) (h : 0 < K.weight i j) :
    parity i = parity j := by
  by_contra hparity
  rw [K.parity_safe i j hparity] at h
  exact (lt_irrefl 0) h

/-- An actual finite execution trace, including a zero-step execution. -/
inductive Path : ℕ → S → S → Prop
  | refl (i : S) : Path 0 i i
  | next {n : ℕ} {i j k : S} : Path n i j → 0 < K.weight j k → Path (n + 1) i k

theorem path_preserves_parity {n : ℕ} {i j : S} (h : K.Path n i j) :
    parity i = parity j := by
  induction h with
  | refl _ => rfl
  | @next n i j k _ hedge ih =>
    exact ih.trans (K.positive_preserves_parity j k hedge)

/-- A permitted trace contributes a strictly positive term to the finite-step kernel. -/
theorem path_positive {n : ℕ} {i j : S} (h : K.Path n i j) :
    0 < K.steps n i j := by
  classical
  induction h with
  | refl i => simp [steps]
  | @next n i j k _ hedge ih =>
    change 0 < ∑ a, K.steps n i a * K.weight a k
    exact Finset.sum_pos'
      (fun a _ => mul_nonneg (K.steps_nonneg n i a) (K.nonneg a k))
      ⟨j, Finset.mem_univ j, mul_pos ih hedge⟩

end RationalKernel

/-- A rational-spinor lattice.  Its geometry and indexing are explicit parameters. -/
structure RationalLattice (S : Type*) where
  spinor : S → ℍ[ℚ]
  unit : ∀ i, Quaternion.normSq (spinor i) = 1

namespace RationalLattice

variable (L : RationalLattice S)

/-- The quaternion increment emitted by the transition `i → j`. -/
def delta (i j : S) : ℍ[ℚ] := L.spinor j * star (L.spinor i)

theorem delta_unit (i j : S) : Quaternion.normSq (L.delta i j) = 1 := by
  simp [delta, map_mul, L.unit]

theorem embedded_delta_unit (i j : S) :
    Quaternion.normSq (embed (L.delta i j)) = 1 := by
  exact embed_unit _ (L.delta_unit i j)

/-- Acting with an emitted increment exactly reaches the next stored spinor. -/
theorem delta_action (i j : S) : L.delta i j * L.spinor i = L.spinor j := by
  rw [delta, mul_assoc, Quaternion.star_mul_self, L.unit]
  simp

/-- A product of emitted increments remains in the rational unit sphere. -/
theorem history_unit (history : List (S × S)) :
    Quaternion.normSq ((history.map fun edge => L.delta edge.1 edge.2).prod) = 1 := by
  induction history with
  | nil => simp
  | cons edge history ih => simp [map_mul, L.delta_unit, ih]

end RationalLattice

/-- Executable data and offline reconstructed memory occupy different fields. -/
structure CoupledState (S : Type*) [Fintype S] (parity : S → Bool) where
  kernel : RationalKernel S parity
  current : S
  memory : List (ℍ[ℝ])

namespace CoupledState

variable {parity : S → Bool} (s : CoupledState S parity)

/-- An arbitrary offline reconstruction can only replace offline memory. -/
def reconstruct (f : List (ℍ[ℝ]) → List (ℍ[ℝ])) : CoupledState S parity :=
  { s with memory := f s.memory }

@[simp] theorem reconstruct_kernel (f : List (ℍ[ℝ]) → List (ℍ[ℝ])) :
    (s.reconstruct f).kernel = s.kernel := rfl

@[simp] theorem reconstruct_current (f : List (ℍ[ℝ]) → List (ℍ[ℝ])) :
    (s.reconstruct f).current = s.current := rfl

/-- Even arbitrary real reconstruction leaves every executable weight unchanged. -/
theorem reconstruct_preserves_weights (f : List (ℍ[ℝ]) → List (ℍ[ℝ])) (i j : S) :
    (s.reconstruct f).kernel.weight i j = s.kernel.weight i j := rfl

/-- A forward step stores its unit increment and leaves the kernel immutable. -/
def forward (L : RationalLattice S) (target : S)
    (_admissible : 0 < s.kernel.weight s.current target) : CoupledState S parity :=
  { s with current := target, memory := s.memory ++ [embed (L.delta s.current target)] }

@[simp] theorem forward_kernel (L : RationalLattice S) (target : S)
    (h : 0 < s.kernel.weight s.current target) :
    (s.forward L target h).kernel = s.kernel := rfl

theorem forward_parity (L : RationalLattice S) (target : S)
    (h : 0 < s.kernel.weight s.current target) :
    parity (s.forward L target h).current = parity s.current := by
  exact (s.kernel.positive_preserves_parity s.current target h).symm

/-- A reconstruction does not itself authorize entry into the rational lattice.
The caller supplies a rational lattice point, an explicit tolerance, an error
bound, and an executable transition to that point.  No rationalization algorithm
or universal small-error approximation claim is assumed. -/
structure ReentryCertificate (L : RationalLattice S) (reconstructed : ℍ[ℝ]) where
  target : S
  tolerance : ℝ
  tolerance_nonneg : 0 ≤ tolerance
  error_bound : Quaternion.normSq (embed (L.spinor target) - reconstructed) ≤ tolerance ^ 2
  admissible : 0 < s.kernel.weight s.current target

/-- Reentry uses the certified rational target; the reconstructed real quaternion
never becomes a coefficient of the forward kernel. -/
def reenter (L : RationalLattice S) (q : ℍ[ℝ])
    (certificate : s.ReentryCertificate L q) : CoupledState S parity :=
  s.forward L certificate.target certificate.admissible

@[simp] theorem reenter_kernel (L : RationalLattice S) (q : ℍ[ℝ])
    (certificate : s.ReentryCertificate L q) :
    (s.reenter L q certificate).kernel = s.kernel := rfl

theorem reenter_parity (L : RationalLattice S) (q : ℍ[ℝ])
    (certificate : s.ReentryCertificate L q) :
    parity (s.reenter L q certificate).current = parity s.current :=
  s.forward_parity L certificate.target certificate.admissible

theorem reenter_unit (L : RationalLattice S) (q : ℍ[ℝ])
    (certificate : s.ReentryCertificate L q) :
    Quaternion.normSq (L.spinor (s.reenter L q certificate).current) = 1 :=
  L.unit certificate.target

theorem reenter_error (L : RationalLattice S) (q : ℍ[ℝ])
    (certificate : s.ReentryCertificate L q) :
    Quaternion.normSq (embed (L.spinor (s.reenter L q certificate).current) - q) ≤
      certificate.tolerance ^ 2 :=
  certificate.error_bound

/-- Unit norm, stochasticity, and parity survive the entire reconstruction/reentry
interface, provided that the explicitly required certificate is supplied. -/
theorem reentry_contract (L : RationalLattice S) (q : ℍ[ℝ])
    (certificate : s.ReentryCertificate L q) :
    (s.reenter L q certificate).kernel = s.kernel ∧
    (∀ i, ∑ j, (s.reenter L q certificate).kernel.weight i j = 1) ∧
    parity (s.reenter L q certificate).current = parity s.current ∧
    Quaternion.normSq (L.spinor (s.reenter L q certificate).current) = 1 := by
  exact ⟨rfl, s.kernel.stochastic, s.reenter_parity L q certificate,
    s.reenter_unit L q certificate⟩

end CoupledState

/-- The dimensions advertised for the companion construction.  Supplying this
structure requires the actual companion implementation and its certificates;
the torsional paper alone does not specify its weights or channel assignment.
The common `Fin 12` index is the proposed identification with the outer gear. -/
structure SparsemaxInterface where
  parity : Fin 64 → Bool
  lattice : RationalLattice (Fin 64)
  kernel : RationalKernel (Fin 64) parity
  channel : Fin 64 → Fin 64 → Fin 12

end TorsionalPump.Interop
