import Mathlib.Analysis.Quaternion
import Mathlib.Analysis.Normed.Algebra.QuaternionExponential
import Mathlib.Analysis.SpecialFunctions.Trigonometric.Inverse
import Mathlib.Tactic.FieldSimp
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.LinearCombination

/-!
# The quaternion state space and exact fractional-power lifts

This file uses actual real quaternions.  `UnitQuaternion` is a subgroup of the
invertible quaternions, with the norm-one condition built into its type.  An
`Axis` is a unit vector in the imaginary three-dimensional subspace.  Its
axis-angle parameter is the quaternion angle; the corresponding spatial
rotation angle is twice that parameter.

No global quaternion logarithm is postulated.  The root operation below is
defined on explicit axis-angle data, and a representation theorem proves that
such data exist for every unit quaternion, including the negative identity.
-/

noncomputable section

namespace TorsionalPump.QuaternionModel

abbrev Q := Quaternion ℝ

/-- Norm-one invertible real quaternions form an actual group. -/
def normOneSubgroup : Subgroup Qˣ where
  carrier := {u | ‖(u : Q)‖ = 1}
  one_mem' := by simp
  mul_mem' := by
    intro a b ha hb
    change ‖(a : Q) * (b : Q)‖ = 1
    rw [norm_mul, ha, hb, one_mul]
  inv_mem' := by
    intro a ha
    change ‖((a⁻¹ : Qˣ) : Q)‖ = 1
    rw [Units.val_inv_eq_inv_val, norm_inv, ha, inv_one]

abbrev UnitQuaternion := normOneSubgroup

/-- The underlying real quaternion, retaining no opaque formal group model. -/
def value (q : UnitQuaternion) : Q := (q.val : Q)

@[simp] theorem value_norm (q : UnitQuaternion) : ‖value q‖ = 1 := q.property
@[simp] theorem value_one : value 1 = 1 := rfl
@[simp] theorem value_mul (p q : UnitQuaternion) : value (p * q) = value p * value q := rfl
@[simp] theorem value_inv (q : UnitQuaternion) : value q⁻¹ = (value q)⁻¹ :=
  Units.val_inv_eq_inv_val _
@[simp] theorem value_pow (q : UnitQuaternion) (n : ℕ) : value (q ^ n) = value q ^ n := by
  induction n with
  | zero => rfl
  | succ n ih => simp [pow_succ, ih]

theorem value_injective : Function.Injective value := by
  intro a b h
  apply Subtype.ext
  exact Units.ext h

/-- Package a quaternion whose norm is known to be one. -/
def ofNormOne (q : Q) (h : ‖q‖ = 1) : UnitQuaternion :=
  ⟨Units.mk0 q (by intro hq; simpa [hq] using h), h⟩

@[simp] theorem value_ofNormOne (q : Q) (h : ‖q‖ = 1) :
    value (ofNormOne q h) = q := rfl

/-- Normalization is only defined for a nonzero quaternion. -/
def normalize (q : Q) (hq : q ≠ 0) : UnitQuaternion :=
  ofNormOne (‖q‖⁻¹ • q) (by
    rw [norm_smul, Real.norm_eq_abs, abs_of_nonneg (inv_nonneg.mpr (norm_nonneg q)),
      inv_mul_cancel₀ (norm_ne_zero_iff.mpr hq)])

@[simp] theorem value_normalize (q : Q) (hq : q ≠ 0) :
    value (normalize q hq) = ‖q‖⁻¹ • q := rfl

theorem value_normalize_eq_div (q : Q) (hq : q ≠ 0) :
    value (normalize q hq) = q / (‖q‖ : Q) := by
  rw [value_normalize, div_eq_mul_inv, ← Quaternion.coe_inv, Quaternion.mul_coe_eq_smul]

theorem normalize_unit (q : UnitQuaternion) :
    normalize (value q) (by intro h; simpa [h] using value_norm q) = q := by
  apply value_injective
  simp

theorem normSq_value (q : UnitQuaternion) : Quaternion.normSq (value q) = 1 := by
  rw [Quaternion.normSq_eq_norm_mul_self, value_norm, one_mul]

theorem norm_eq_one_of_normSq {q : Q} (h : Quaternion.normSq q = 1) : ‖q‖ = 1 := by
  have hn := norm_nonneg q
  rw [Quaternion.normSq_eq_norm_mul_self] at h
  nlinarith

/-- A concrete pure unit axis. -/
structure Axis where
  x : ℝ
  y : ℝ
  z : ℝ
  unit : x ^ 2 + y ^ 2 + z ^ 2 = 1

def Axis.quaternion (u : Axis) : Q := ⟨0, u.x, u.y, u.z⟩

@[simp] theorem Axis.pure (u : Axis) : u.quaternion.re = 0 := rfl

@[simp] theorem Axis.normSq (u : Axis) : Quaternion.normSq u.quaternion = 1 := by
  simpa [Axis.quaternion, Quaternion.normSq_def'] using u.unit

@[simp] theorem Axis.norm (u : Axis) : ‖u.quaternion‖ = 1 :=
  norm_eq_one_of_normSq u.normSq

theorem Axis.square (u : Axis) : u.quaternion ^ 2 = -1 := by
  rw [Quaternion.sq_eq_neg_normSq.mpr u.pure, u.normSq]
  rfl

/-- The positive first coordinate axis, also the explicit branch choice at `-1`. -/
def xAxis : Axis := ⟨1, 0, 0, by norm_num⟩

/-- `cos t + sin t * u`, with `t` the quaternion angle. -/
def axisAngleRaw (u : Axis) (t : ℝ) : Q :=
  ⟨Real.cos t, Real.sin t * u.x, Real.sin t * u.y, Real.sin t * u.z⟩

theorem axisAngleRaw_normSq (u : Axis) (t : ℝ) :
    Quaternion.normSq (axisAngleRaw u t) = 1 := by
  simp only [axisAngleRaw, Quaternion.normSq_def']
  calc
    Real.cos t ^ 2 + (Real.sin t * u.x) ^ 2 + (Real.sin t * u.y) ^ 2 +
        (Real.sin t * u.z) ^ 2 =
        Real.cos t ^ 2 + Real.sin t ^ 2 * (u.x ^ 2 + u.y ^ 2 + u.z ^ 2) := by ring
    _ = 1 := by rw [u.unit, mul_one, Real.cos_sq_add_sin_sq]

def axisAngle (u : Axis) (t : ℝ) : UnitQuaternion :=
  ofNormOne (axisAngleRaw u t) (norm_eq_one_of_normSq (axisAngleRaw_normSq u t))

@[simp] theorem value_axisAngle (u : Axis) (t : ℝ) :
    value (axisAngle u t) = axisAngleRaw u t := rfl

@[simp] theorem axisAngle_zero (u : Axis) : axisAngle u 0 = 1 := by
  apply value_injective
  ext <;> simp [axisAngleRaw]

/-- Fixed-axis rotations add their quaternion angles. -/
theorem axisAngle_add (u : Axis) (s t : ℝ) :
    axisAngle u (s + t) = axisAngle u s * axisAngle u t := by
  apply value_injective
  simp only [value_axisAngle, value_mul]
  ext <;> simp [axisAngleRaw, Real.cos_add, Real.sin_add]
  · linear_combination (Real.sin s * Real.sin t) * u.unit
  all_goals ring

theorem axisAngle_pow (u : Axis) (t : ℝ) (n : ℕ) :
    axisAngle u t ^ n = axisAngle u ((n : ℝ) * t) := by
  induction n with
  | zero => simp
  | succ n ih =>
    rw [pow_succ, ih, ← axisAngle_add]
    congr 1
    push_cast
    ring

theorem axisAngle_neg (u : Axis) (t : ℝ) :
    axisAngle u (-t) = (axisAngle u t)⁻¹ := by
  apply eq_inv_of_mul_eq_one_left
  rw [← axisAngle_add, neg_add_cancel, axisAngle_zero]

theorem axisAngle_commute (u : Axis) (s t : ℝ) :
    Commute (axisAngle u s) (axisAngle u t) := by
  show axisAngle u s * axisAngle u t = axisAngle u t * axisAngle u s
  rw [← axisAngle_add, ← axisAngle_add, add_comm]

/-- A fractional lift with an explicit axis-angle branch. -/
def fractionalLift (u : Axis) (t w : ℝ) : UnitQuaternion := axisAngle u (w * t)

/-- The actual pure quaternion logarithm supplied by the chosen axis branch.
Its norm is the quaternion angle, not the corresponding spatial angle. -/
def branchLog (u : Axis) (t : ℝ) : Q := t • u.quaternion

@[simp] theorem branchLog_pure (u : Axis) (t : ℝ) : (branchLog u t).re = 0 := by
  simp [branchLog]

theorem branchLog_norm (u : Axis) (t : ℝ) : ‖branchLog u t‖ = |t| := by
  simp [branchLog, norm_smul, Real.norm_eq_abs]

/-- The trigonometric definition agrees with the genuine quaternion exponential. -/
theorem exp_branchLog (u : Axis) (t : ℝ) :
    NormedSpace.exp ℝ (branchLog u t) = value (axisAngle u t) := by
  rw [Quaternion.exp_of_re_eq_zero _ (branchLog_pure u t), branchLog_norm]
  have hs : Real.sin |t| / |t| * t = Real.sin t := by
    by_cases ht : t = 0
    · simp [ht]
    rcases le_total 0 t with ht' | ht'
    · rw [abs_of_nonneg ht']
      exact div_mul_cancel₀ _ ht
    · rw [abs_of_nonpos ht', Real.sin_neg]
      field_simp [ht] <;> ring
  ext <;> simp [axisAngleRaw, branchLog, Axis.quaternion, Real.cos_abs,
    ← mul_assoc, hs]

theorem fractionalLift_eq_exp (u : Axis) (t w : ℝ) :
    value (fractionalLift u t w) = NormedSpace.exp ℝ (w • branchLog u t) := by
  rw [fractionalLift, branchLog, smul_smul, ← exp_branchLog]
  rfl

/-- Proposition 4: `N` repeated equal fractional lifts recover the coarse increment.
The proof needs `N > 0`, but needs no angle restriction once an axis is fixed. -/
theorem fractionalLift_reconstruct (u : Axis) (t : ℝ) (N : ℕ) (hN : 0 < N) :
    fractionalLift u t (1 / (N : ℝ)) ^ N = axisAngle u t := by
  rw [fractionalLift, axisAngle_pow]
  congr 1
  have hN' : (N : ℝ) ≠ 0 := by exact_mod_cast Nat.ne_of_gt hN
  field_simp [hN'] <;> ring

/-- Every positive integral root is realized inside the actual unit quaternion group. -/
theorem axisAngle_has_root (u : Axis) (t : ℝ) (N : ℕ) (hN : 0 < N) :
    ∃ r : UnitQuaternion, r ^ N = axisAngle u t :=
  ⟨fractionalLift u t (1 / (N : ℝ)), fractionalLift_reconstruct u t N hN⟩

/-- Every unit quaternion admits a concrete axis-angle representative.  The
quaternion angle lies in `[0, π]`; this theorem includes `-1` rather than
silently discarding the logarithm's ambiguous-axis endpoint. -/
theorem exists_axisAngle (q : UnitQuaternion) :
    ∃ (u : Axis) (t : ℝ), 0 ≤ t ∧ t ≤ Real.pi ∧ q = axisAngle u t := by
  let a := value q
  have ha : a.re ^ 2 + a.imI ^ 2 + a.imJ ^ 2 + a.imK ^ 2 = 1 := by
    simpa [Quaternion.normSq_def'] using normSq_value q
  have hlow : -1 ≤ a.re := by
    nlinarith [sq_nonneg a.imI, sq_nonneg a.imJ, sq_nonneg a.imK]
  have hhigh : a.re ≤ 1 := by
    nlinarith [sq_nonneg a.imI, sq_nonneg a.imJ, sq_nonneg a.imK]
  let t := Real.arccos a.re
  have hc : Real.cos t = a.re := Real.cos_arccos hlow hhigh
  have hsquare : Real.sin t ^ 2 = a.imI ^ 2 + a.imJ ^ 2 + a.imK ^ 2 := by
    have ht := Real.sin_sq_add_cos_sq t
    rw [hc] at ht
    linarith
  by_cases hs : Real.sin t = 0
  · have hx : a.imI = 0 := by
      rw [hs] at hsquare
      nlinarith [sq_nonneg a.imJ, sq_nonneg a.imK]
    have hy : a.imJ = 0 := by
      rw [hs] at hsquare
      nlinarith [sq_nonneg a.imI, sq_nonneg a.imK]
    have hz : a.imK = 0 := by
      rw [hs] at hsquare
      nlinarith [sq_nonneg a.imI, sq_nonneg a.imJ]
    refine ⟨xAxis, t, Real.arccos_nonneg _, Real.arccos_le_pi _, ?_⟩
    apply value_injective
    change a = axisAngleRaw xAxis t
    ext <;> simp [axisAngleRaw, xAxis, hc, hs, hx, hy, hz]
  · let u : Axis :=
      ⟨a.imI / Real.sin t, a.imJ / Real.sin t, a.imK / Real.sin t, by
        field_simp [hs]
        nlinarith [hsquare]⟩
    refine ⟨u, t, Real.arccos_nonneg _, Real.arccos_le_pi _, ?_⟩
    apply value_injective
    change a = axisAngleRaw u t
    ext <;> simp [axisAngleRaw, u, hc] <;> field_simp [hs]

/-- Proposition 4 extends to every unit quaternion once an axis branch is chosen. -/
theorem unitQuaternion_has_root (q : UnitQuaternion) (N : ℕ) (hN : 0 < N) :
    ∃ r : UnitQuaternion, r ^ N = q := by
  obtain ⟨u, t, _, _, hq⟩ := exists_axisAngle q
  rw [hq]
  exact axisAngle_has_root u t N hN

/-- Complete axis-angle data, with a branch bounded by the quaternion half-turn. -/
structure Representation (q : UnitQuaternion) where
  axis : Axis
  angle : ℝ
  nonneg : 0 ≤ angle
  le_pi : angle ≤ Real.pi
  represents : q = axisAngle axis angle

theorem representation_nonempty (q : UnitQuaternion) : Nonempty (Representation q) := by
  obtain ⟨u, t, ht, ht', hq⟩ := exists_axisAngle q
  exact ⟨⟨u, t, ht, ht', hq⟩⟩

/-- A mathematical branch choice; no algorithmic claim is made about real arithmetic. -/
def representation (q : UnitQuaternion) : Representation q :=
  Classical.choice (representation_nonempty q)

/-- A genuine pure quaternion logarithm, with the axis chosen at ambiguous endpoints. -/
def quaternionLog (q : UnitQuaternion) : Q :=
  branchLog (representation q).axis (representation q).angle

theorem representation_angle (q : UnitQuaternion) :
    (representation q).angle = Real.arccos (value q).re := by
  have h := congrArg (fun p : UnitQuaternion => (value p).re)
    (representation q).represents
  change (value q).re = Real.cos (representation q).angle at h
  rw [h, Real.arccos_cos (representation q).nonneg (representation q).le_pi]

theorem quaternionLog_norm (q : UnitQuaternion) :
    ‖quaternionLog q‖ = Real.arccos (value q).re := by
  rw [quaternionLog, branchLog_norm, abs_of_nonneg (representation q).nonneg,
    representation_angle]

@[simp] theorem quaternionLog_pure (q : UnitQuaternion) : (quaternionLog q).re = 0 := by
  simp [quaternionLog]

theorem quaternionLog_norm_le_pi (q : UnitQuaternion) : ‖quaternionLog q‖ ≤ Real.pi := by
  rw [quaternionLog, branchLog_norm, abs_of_nonneg (representation q).nonneg]
  exact (representation q).le_pi

theorem exp_quaternionLog (q : UnitQuaternion) :
    NormedSpace.exp ℝ (quaternionLog q) = value q := by
  rw [quaternionLog, exp_branchLog, ← (representation q).represents]

@[simp] theorem quaternionLog_one : quaternionLog 1 = 0 := by
  apply norm_eq_zero.mp
  simp [quaternionLog_norm]

/-- Exact zero residual is equivalent to exact cycle closure. -/
theorem quaternionLog_norm_zero_iff (q : UnitQuaternion) :
    ‖quaternionLog q‖ = 0 ↔ q = 1 := by
  constructor
  · intro h
    apply value_injective
    rw [← exp_quaternionLog, norm_eq_zero.mp h, NormedSpace.exp_zero, value_one]
  · rintro rfl
    simp

/-- The paper's `exp(w log q)` lift, now defined for every genuine unit quaternion. -/
def lift (q : UnitQuaternion) (w : ℝ) : UnitQuaternion :=
  fractionalLift (representation q).axis (representation q).angle w

theorem lift_eq_exp (q : UnitQuaternion) (w : ℝ) :
    value (lift q w) = NormedSpace.exp ℝ (w • quaternionLog q) :=
  fractionalLift_eq_exp _ _ _

theorem lift_reconstruct (q : UnitQuaternion) (N : ℕ) (hN : 0 < N) :
    lift q (1 / (N : ℝ)) ^ N = q := by
  rw [lift, fractionalLift_reconstruct _ _ N hN, ← (representation q).represents]

theorem lift_add (q : UnitQuaternion) (s t : ℝ) :
    lift q (s + t) = lift q s * lift q t := by
  change axisAngle _ ((s + t) * (representation q).angle) =
    axisAngle _ (s * (representation q).angle) * axisAngle _ (t * (representation q).angle)
  rw [add_mul, axisAngle_add]

theorem lift_neg (q : UnitQuaternion) (w : ℝ) : lift q (-w) = (lift q w)⁻¹ := by
  change axisAngle _ ((-w) * (representation q).angle) =
    (axisAngle _ (w * (representation q).angle))⁻¹
  rw [neg_mul, axisAngle_neg]

@[simp] theorem lift_zero (q : UnitQuaternion) : lift q 0 = 1 := by
  simp [lift, fractionalLift]

@[simp] theorem lift_one (q : UnitQuaternion) : lift q 1 = q := by
  simp [lift, fractionalLift, ← (representation q).represents]

@[simp] theorem axisAngle_pi (u : Axis) : value (axisAngle u Real.pi) = -1 := by
  ext <;> simp [axisAngleRaw]

/-- A fully specified root at the principal logarithm's ambiguous endpoint. -/
theorem negative_one_explicit_root (N : ℕ) (hN : 0 < N) :
    value (fractionalLift xAxis Real.pi (1 / (N : ℝ)) ^ N) = -1 := by
  rw [fractionalLift_reconstruct xAxis Real.pi N hN, axisAngle_pi]

end TorsionalPump.QuaternionModel
