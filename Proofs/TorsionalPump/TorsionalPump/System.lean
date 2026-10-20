import TorsionalPump.Algebra
import TorsionalPump.Indexing
import TorsionalPump.Quaternion
import TorsionalPump.Markov
import TorsionalPump.Drift
import TorsionalPump.Holonomy
import TorsionalPump.Interop

/-!
# End-to-end corrected torsional memory pump

The raw memory and its holonomy controller are distinct. Offload preserves raw
ordered block products. The controller closes the cycle without claiming that
its corrected layer is still the unchanged offload output. Uniform lifts recover
block endpoints; residuals are available if all fine frames must be recovered.
-/

noncomputable section

namespace TorsionalPump.System

open QuaternionModel

/-- 720 increments require 721 boundary states. -/
abbrev History := Fin 721 → UnitQuaternion

/-- Extend the finite input only to use the generic chain lemmas. All defined
offload outputs depend solely on its first 721 entries. -/
def state (q : History) (k : ℕ) : UnitQuaternion :=
  if h : k < 721 then q ⟨k, h⟩ else 1

@[simp] theorem state_at (q : History) (k : Fin 721) : state q k.val = q k := by
  simp [state, k.isLt]

def outerDelta (q : History) : ℕ → UnitQuaternion := Algebra.delta (state q)

def middleDelta (q : History) : ℕ → UnitQuaternion := Algebra.middle (outerDelta q)

def innerSize (l : ℕ) : ℕ := Indexing.boundary (l + 1) - Indexing.boundary l

def innerDelta (q : History) (l : ℕ) : UnitQuaternion :=
  Algebra.block (middleDelta q) (Indexing.boundary l) (innerSize l)

theorem boundary_monotone : Monotone Indexing.boundary := by
  intro a b hab
  dsimp [Indexing.boundary]
  omega

theorem innerSize_positive (l : ℕ) : 0 < innerSize l := by
  dsimp [innerSize, Indexing.boundary]
  omega

/-- Correct first upward map: the stored middle inverse is undone before rooting. -/
def outerLift (q : History) (m : ℕ) : UnitQuaternion :=
  lift ((middleDelta q m)⁻¹) (1 / 10)

/-- Nonuniform blocks receive the reciprocal of their actual length, not 1/7.2. -/
def middleLift (q : History) (l : ℕ) : UnitQuaternion :=
  lift (innerDelta q l) (1 / (innerSize l : ℝ))

theorem middle_exact (q : History) (m : ℕ) :
    middleDelta q m =
      (state q (10 * m + 10) * (state q (10 * m))⁻¹)⁻¹ := by
  exact Algebra.outer_to_middle (state q) m

theorem outer_lift_exact (q : History) (m : ℕ) :
    outerLift q m ^ 10 = Algebra.block (outerDelta q) (10 * m) 10 := by
  calc
    outerLift q m ^ 10 = (middleDelta q m)⁻¹ := by
      simpa only [outerLift, Nat.cast_ofNat] using
        lift_reconstruct ((middleDelta q m)⁻¹) 10 (by decide)
    _ = _ := Algebra.decode_middle (outerDelta q) m

theorem inner_lift_exact (q : History) (l : ℕ) :
    middleLift q l ^ innerSize l = innerDelta q l := by
  exact lift_reconstruct _ _ (innerSize_positive l)

theorem outer_endpoint_exact (q : History) (m : ℕ) :
    Algebra.run (fun _ => outerLift q m) (state q (10 * m)) 10 =
      state q (10 * m + 10) := by
  rw [Algebra.run, Algebra.uniform_block, outer_lift_exact]
  rw [show outerDelta q = Algebra.delta (state q) from rfl, Algebra.telescope]
  simp [mul_assoc]

theorem middle_endpoint_exact (q : History) (l : ℕ) (initial : UnitQuaternion) :
    Algebra.run (fun _ => middleLift q l) initial (innerSize l) =
      innerDelta q l * initial := by
  simp only [Algebra.run, Algebra.uniform_block, inner_lift_exact]

def reconstructedDelta (q : History) (k : ℕ) : UnitQuaternion := outerLift q (k / 10)

theorem reconstructed_block (q : History) (m : ℕ) :
    Algebra.block (reconstructedDelta q) (10 * m) 10 =
      Algebra.block (outerDelta q) (10 * m) 10 := by
  calc
    _ = Algebra.block (fun _ => outerLift q m) (10 * m) 10 := by
      apply Algebra.block_congr
      intro k hk
      dsimp [reconstructedDelta]
      congr 1
      omega
    _ = _ := by rw [Algebra.uniform_block, outer_lift_exact]

/-- The entire lifted 720-increment chain rejoins the original chain at every
ten-frame boundary. No unproved reset condition is assumed here. -/
theorem all_outer_boundaries_exact (q : History) (m : ℕ) :
    Algebra.run (reconstructedDelta q) (state q 0) (10 * m) = state q (10 * m) := by
  induction m with
  | zero => simp
  | succ m ih =>
    rw [Nat.mul_succ, Algebra.run_add, reconstructed_block, ih]
    rw [outerDelta, Algebra.telescope]
    simp [mul_assoc]

/-- Keep this residual if every fine frame, rather than only block endpoints,
must be recovered. The theorem does not assert that residuals are small. -/
def fineResidual (q : History) := Algebra.residual (outerDelta q) (reconstructedDelta q)

theorem all_fine_states_with_residual (q : History) (n : ℕ) :
    Algebra.run (fun k => fineResidual q k * reconstructedDelta q k) (state q 0) n =
      state q n := by
  rw [show fineResidual q = Algebra.residual (outerDelta q) (reconstructedDelta q) from rfl,
    Algebra.residual_decode]
  exact Algebra.reconstruct (state q) n

/-- Every middle increment appears once, in the correct noncommutative order. -/
theorem second_offload_total (q : History) :
    Algebra.block (innerDelta q) 0 10 = Algebra.block (middleDelta q) 0 72 := by
  simpa [innerDelta, innerSize, Indexing.boundary] using
    Algebra.reblock (middleDelta q) Indexing.boundary boundary_monotone 10

def outerNet (q : History) := Algebra.block (outerDelta q) 0 720
def middleNet (q : History) := Algebra.block (middleDelta q) 0 72
def innerNet (q : History) := Algebra.block (innerDelta q) 0 10
def rawHolonomy (q : History) := Holonomy.cycle (innerNet q) (middleNet q) (outerNet q)

/-- The controller is recorded separately from the raw inner compressed data. -/
def controller (q : History) : UnitQuaternion := (rawHolonomy q)⁻¹
def controlledInnerNet (q : History) := controller q * innerNet q

/-- Apply the entire net correction once, at the final inner increment. -/
def controlledInnerDelta (q : History) (l : ℕ) : UnitQuaternion :=
  if l = 9 then controller q * innerDelta q l else innerDelta q l

theorem controlled_inner_realized (q : History) :
    Algebra.block (controlledInnerDelta q) 0 10 = controlledInnerNet q := by
  simpa [controlledInnerDelta, controlledInnerNet, innerNet] using
    Algebra.correct_last (innerDelta q) (controller q) 0 9

theorem controlled_closure (q : History) :
    Holonomy.cycle (controlledInnerNet q) (middleNet q) (outerNet q) = 1 :=
  Holonomy.close_inner _ _ _

theorem controlled_chain_closure (q : History) :
    Holonomy.cycle (Algebra.block (controlledInnerDelta q) 0 10)
      (middleNet q) (outerNet q) = 1 := by
  rw [controlled_inner_realized, controlled_closure]

theorem raw_holonomy_formula (q : History) :
    rawHolonomy q = middleNet q * middleNet q * outerNet q := by
  unfold rawHolonomy Holonomy.cycle innerNet middleNet
  rw [second_offload_total]

def orientation (i : Fin 3) : ℤ := if i.val = 1 then -1 else 1

theorem folding_signs : orientation 0 = 1 ∧ orientation 1 = -1 ∧ orientation 2 = 1 := by
  norm_num [orientation]

/-- The seven algorithm steps, tied to a single finite input history. The
finite address and partition theorems are in `Indexing`; the drift theorem is
over the actual norm-one quaternion metric in `Drift`. -/
structure Correct (q : History) : Prop where
  store : ∀ n, Algebra.run (outerDelta q) (state q 0) n = state q n
  offload₁ : ∀ m, middleDelta q m =
    (state q (10 * m + 10) * (state q (10 * m))⁻¹)⁻¹
  offload₂ : Algebra.block (innerDelta q) 0 10 = Algebra.block (middleDelta q) 0 72
  stochastic : Markov.Stochastic Markov.forwardPump
  distribution : Markov.Distribution Markov.uniform
  stationary : Markov.Stationary Markov.forwardPump Markov.uniform
  pumping : Markov.Pump Markov.forwardPump Markov.uniform
  current : Markov.current Markov.forwardPump Markov.uniform 0 1 = 3 / 20
  closure : Holonomy.cycle (controlledInnerNet q) (middleNet q) (outerNet q) = 1
  normalize : ∀ p : UnitQuaternion,
    QuaternionModel.normalize (value p) (by intro h; simpa [h] using value_norm p) = p
  upward₁ : ∀ m, Algebra.run (fun _ => outerLift q m) (state q (10 * m)) 10 =
    state q (10 * m + 10)
  upward₂ : ∀ l initial, Algebra.run (fun _ => middleLift q l) initial (innerSize l) =
    innerDelta q l * initial
  all_boundaries : ∀ m, Algebra.run (reconstructedDelta q) (state q 0) (10 * m) =
    state q (10 * m)
  lossless_with_residual : ∀ n,
    Algebra.run (fun k => fineResidual q k * reconstructedDelta q k) (state q 0) n = state q n

/-- End-to-end theorem for every 720-increment unit-quaternion history.
No ideal reconstruction, stationarity, root, or closure law is assumed. -/
theorem full_system_correct (q : History) : Correct q where
  store := Algebra.reconstruct (state q)
  offload₁ := middle_exact q
  offload₂ := second_offload_total q
  stochastic := Markov.forwardPump_stochastic
  distribution := Markov.uniform_distribution
  stationary := Markov.forwardPump_stationary
  pumping := Markov.forwardPump_pumps
  current := Markov.forwardPump_current
  closure := controlled_closure q
  normalize := QuaternionModel.normalize_unit
  upward₁ := outer_endpoint_exact q
  upward₂ := middle_endpoint_exact q
  all_boundaries := all_outer_boundaries_exact q
  lossless_with_residual := all_fine_states_with_residual q

/-- Exact rational leaf data enter the actual unit-quaternion memory type. -/
def rationalUnit (q : Quaternion ℚ) (hq : Quaternion.normSq q = 1) : UnitQuaternion :=
  ofNormOne (Interop.embed q) (norm_eq_one_of_normSq (Interop.embed_unit q hq))

@[simp] theorem rationalUnit_value (q : Quaternion ℚ) (hq : Quaternion.normSq q = 1) :
    value (rationalUnit q hq) = Interop.embed q := rfl

/-- Fractional weights may vary within a block, provided they sum to one.
The same chosen branch is used throughout that block. -/
theorem weighted_lift_block (q : UnitQuaternion) (w : ℕ → ℝ) (n : ℕ) :
    Algebra.block (fun k => lift q (w k)) 0 n =
      lift q (∑ k ∈ Finset.range n, w k) := by
  induction n with
  | zero => simp
  | succ n ih =>
    rw [Algebra.block_succ, Nat.zero_add, ih, Finset.sum_range_succ]
    rw [add_comm, lift_add]

theorem weighted_lift_endpoint (q : UnitQuaternion) (w : ℕ → ℝ) (n : ℕ)
    (hw : ∑ k ∈ Finset.range n, w k = 1) :
    Algebra.block (fun k => lift q (w k)) 0 n = q := by
  rw [weighted_lift_block, hw, lift_one]

end TorsionalPump.System
