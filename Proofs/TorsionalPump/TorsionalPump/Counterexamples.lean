import Mathlib.Algebra.Quaternion
import Mathlib.Tactic.NormNum.Eq
import Mathlib.Tactic.NormNum.Pow

/-!
# Exact counterexamples to stronger readings of the paper

These are exact rational quaternions, not numerical experiments.  Their squared
norms are one.  They explain why inverse-chain ordering, transported holonomy
corrections, and the distinction between endpoint and history recovery are needed.
-/

namespace TorsionalPump.Counterexamples

abbrev Q := Quaternion ℚ

def qi : Q := ⟨0, 1, 0, 0⟩
def qj : Q := ⟨0, 0, 1, 0⟩
def qk : Q := ⟨0, 0, 0, 1⟩

/-- Rational rotations with nonzero scalar part avoid antipodal ambiguity. -/
def qx : Q := ⟨3 / 5, 4 / 5, 0, 0⟩
def qy : Q := ⟨3 / 5, 0, 4 / 5, 0⟩

theorem basis_unit :
    Quaternion.normSq qi = 1 ∧ Quaternion.normSq qj = 1 ∧
      Quaternion.normSq qk = 1 := by
  norm_num [qi, qj, qk, Quaternion.normSq_def']

theorem rational_rotations_unit :
    Quaternion.normSq qx = 1 ∧ Quaternion.normSq qy = 1 := by
  norm_num [qx, qy, Quaternion.normSq_def']

@[simp] theorem qi_mul_qj : qi * qj = qk := by
  ext <;> norm_num [qi, qj, qk]

@[simp] theorem qj_mul_qi : qj * qi = -qk := by
  ext <;> norm_num [qi, qj, qk]

@[simp] theorem qi_inv : qi⁻¹ = -qi := by
  ext <;> norm_num [qi, Quaternion.inv_def, Quaternion.normSq_def']

@[simp] theorem qj_inv : qj⁻¹ = -qj := by
  ext <;> norm_num [qj, Quaternion.inv_def, Quaternion.normSq_def']

@[simp] theorem qk_inv : qk⁻¹ = -qk := by
  ext <;> norm_num [qk, Quaternion.inv_def, Quaternion.normSq_def']

/-- With inverse deltas `D₁ = i`, `D₂ = j`, the genuine state is `-k`. -/
theorem inverse_delta_true_endpoint : qj⁻¹ * qi⁻¹ = -qk := by
  simp only [qi_inv, qj_inv, neg_mul_neg, qj_mul_qi]

/-- Inverting the reverse chronological product gives `k`, the wrong sign. -/
theorem inverse_delta_paper_endpoint : (qj * qi)⁻¹ = qk := by
  ext <;> norm_num [qi, qj, qk, Quaternion.inv_def, Quaternion.normSq_def']

theorem inverse_delta_order_counterexample :
    (qj * qi)⁻¹ ≠ qj⁻¹ * qi⁻¹ := by
  rw [inverse_delta_paper_endpoint, inverse_delta_true_endpoint]
  intro h
  have hk := congrArg (fun a : Q => a.imK) h
  norm_num [qk] at hk

/-- The ordering problem remains even after identifying antipodal quaternions
as the same spatial rotation: these two outputs are neither equal nor opposite. -/
theorem inverse_delta_order_fails_modulo_sign :
    (qy * qx)⁻¹ ≠ qy⁻¹ * qx⁻¹ ∧
      (qy * qx)⁻¹ ≠ -(qy⁻¹ * qx⁻¹) := by
  constructor
  · intro h
    have hk := congrArg (fun a : Q => a.imK) h
    norm_num [qx, qy, Quaternion.inv_def, Quaternion.normSq_def'] at hk
  · intro h
    have hr := congrArg (fun a : Q => a.re) h
    norm_num [qx, qy, Quaternion.inv_def, Quaternion.normSq_def'] at hr

/-- The same order issue prevents inverses of local blocks from automatically
forming the inverse of their global chronological product. -/
theorem local_inverses_do_not_invert_global_product :
    qj⁻¹ * qi⁻¹ ≠ (qj * qi)⁻¹ :=
  Ne.symm inverse_delta_order_counterexample

/-- Naively assign all the correction to the middle gear, with weights `(0,1,0)`.
Here outer `A=1`, middle `B=j`, inner `C=i`, and holonomy `H=CBA=k`.
The untransported correction `B' = H⁻¹ B` gives `CB'A=-1`, not the identity. -/
def naiveMiddleCorrectedHolonomy : Q :=
  qi * ((qi * qj)⁻¹ * qj) * 1

theorem naive_middle_correction_yields_negative_one :
    naiveMiddleCorrectedHolonomy = -1 := by
  simp only [naiveMiddleCorrectedHolonomy, qi_mul_qj, qk_inv, mul_one]
  ext <;> norm_num [qi, qj, qk]

theorem naive_middle_correction_does_not_close :
    naiveMiddleCorrectedHolonomy ≠ 1 := by
  rw [naive_middle_correction_yields_negative_one]
  intro h
  have hr := congrArg (fun a : Q => a.re) h
  norm_num at hr

/-- A stronger holonomy counterexample that also fails closure as an SO(3)
rotation.  Its scalar part is neither `1` nor `-1`. -/
def naiveRationalCorrectedHolonomy : Q := qx * ((qx * qy)⁻¹ * qy)

theorem naive_rational_correction_scalar :
    naiveRationalCorrectedHolonomy.re = 113 / 625 := by
  norm_num [naiveRationalCorrectedHolonomy, qx, qy,
    Quaternion.inv_def, Quaternion.normSq_def']

theorem naive_rational_correction_fails_modulo_sign :
    naiveRationalCorrectedHolonomy ≠ 1 ∧
      naiveRationalCorrectedHolonomy ≠ -1 := by
  constructor
  · intro h
    have hr := congrArg (fun a : Q => a.re) h
    dsimp only at hr
    rw [naive_rational_correction_scalar] at hr
    norm_num at hr
  · intro h
    have hr := congrArg (fun a : Q => a.re) h
    dsimp only at hr
    rw [naive_rational_correction_scalar] at hr
    norm_num at hr

/-- The paper additionally applies a gear's allocated correction to *each*
delta.  Even with commuting data this overcounts the allocation: take raw nets
`A=-i`, `B=i`, `C=i`, hence `H=i`, and put all weight on the 72 middle deltas.
The 72 correction factors cancel, so the nontrivial holonomy is unchanged.
These raw nets are consistent with the stated offload maps: the first outer
block is `-i`, its stored inverse is `i`, and the remaining blocks are identity. -/
def perDeltaCorrectedHolonomy : Q :=
  qi * (((qi * qi * (-qi))⁻¹) ^ 72 * qi) * (-qi)

theorem per_delta_middle_correction_has_no_effect :
    perDeltaCorrectedHolonomy = qi := by
  have hH : qi * qi * (-qi) = qi := by
    ext <;> norm_num [qi]
  have hfour : (-qi) ^ 4 = (1 : Q) := by
    ext <;> norm_num [qi, pow_succ]
  have h72 : (-qi) ^ 72 = (1 : Q) := by
    calc
      (-qi) ^ 72 = (-qi) ^ (4 * 18) := by norm_num
      _ = ((-qi) ^ 4) ^ 18 := pow_mul _ _ _
      _ = 1 := by rw [hfour]; simp
  simp only [perDeltaCorrectedHolonomy, hH, qi_inv, h72, one_mul]

theorem per_delta_middle_correction_does_not_close :
    perDeltaCorrectedHolonomy ≠ 1 ∧ perDeltaCorrectedHolonomy ≠ -1 := by
  rw [per_delta_middle_correction_has_no_effect]
  constructor
  · intro h
    have hr := congrArg (fun a : Q => a.re) h
    norm_num [qi] at hr
  · intro h
    have hr := congrArg (fun a : Q => a.re) h
    norm_num [qi] at hr

/-- Two different unit-increment histories have the same chronological net.
Consequently a coarse net alone cannot encode every intermediate frame. -/
theorem fine_history_compression_collision :
    ∃ a b c d : Q,
      Quaternion.normSq a = 1 ∧ Quaternion.normSq b = 1 ∧
      Quaternion.normSq c = 1 ∧ Quaternion.normSq d = 1 ∧
      a ≠ c ∧ b * a = d * c := by
  refine ⟨qi, -qi, 1, 1, ?_, ?_, ?_, ?_, ?_, ?_⟩
  · exact basis_unit.1
  · simpa only [Quaternion.normSq_neg] using basis_unit.1
  · norm_num
  · norm_num
  · intro h
    have hr := congrArg (fun a : Q => a.re) h
    norm_num [qi] at hr
  · ext <;> norm_num [qi]

/-- No decoder of a net quaternion can recover the first frame of every
two-increment unit-quaternion history.  Retaining residual information is necessary. -/
theorem no_exact_first_frame_decoder :
    ¬ ∃ decode : Q → Q, ∀ a b : Q,
      Quaternion.normSq a = 1 → Quaternion.normSq b = 1 →
        decode (b * a) = a := by
  rintro ⟨decode, hdecode⟩
  obtain ⟨a, b, c, d, ha, hb, hc, hd, hne, hnet⟩ :=
    fine_history_compression_collision
  apply hne
  calc
    a = decode (b * a) := (hdecode a b ha hb).symm
    _ = decode (d * c) := congrArg decode hnet
    _ = c := hdecode c d hc hd

end TorsionalPump.Counterexamples
