import TorsionalPump.Algebra
import TorsionalPump.Quaternion

namespace TorsionalPump.Holonomy

variable {G : Type*} [Group G]

def cycle (inner middle outer : G) : G := inner * middle * outer

/-- A residual can always be closed exactly by one left correction. -/
theorem close_inner (inner middle outer : G) :
    cycle ((cycle inner middle outer)⁻¹ * inner) middle outer = 1 := by
  simp only [cycle]
  group

/-- Distributed corrections must be transported into a common reference frame.
Their product must equal the inverse residual. This theorem proves exact closure
for arbitrary noncommuting layers and arbitrary allocated correction factors. -/
theorem close_distributed (inner middle outer c₈ c₁₀ c₁₂ : G)
    (hc : c₈ * c₁₀ * c₁₂ = (cycle inner middle outer)⁻¹) :
    cycle (c₈ * inner)
      (inner⁻¹ * c₁₀ * inner * middle)
      ((inner * middle)⁻¹ * c₁₂ * (inner * middle) * outer) = 1 := by
  have heq : cycle (c₈ * inner)
      (inner⁻¹ * c₁₀ * inner * middle)
      ((inner * middle)⁻¹ * c₁₂ * (inner * middle) * outer) =
        (c₈ * c₁₀ * c₁₂) * cycle inner middle outer := by
    simp only [cycle]
    group
  rw [heq, hc, inv_mul_cancel]

/-- Approximate closure is a measurable condition, not an automatic consequence
of allocating scalar weights. A caller chooses and proves its tolerance. -/
def Within {M : Type*} [PseudoMetricSpace M] [One M] (H : M) (ε : ℝ) : Prop :=
  dist H 1 ≤ ε

theorem exact_within {M : Type*} [PseudoMetricSpace M] [One M]
    (H : M) (hH : H = 1) {ε : ℝ} (hε : 0 ≤ ε) : Within H ε := by
  simp [Within, hH, hε]

open QuaternionModel

/-- Scalar allocation weights yield inverse-residual factors along one fixed
logarithm branch. The transport in `close_distributed` is still necessary. -/
theorem allocated_factors (H : UnitQuaternion) (a b c : ℝ)
    (hsum : a + b + c = 1) :
    lift H (-a) * lift H (-b) * lift H (-c) = H⁻¹ := by
  rw [← lift_add, ← lift_add]
  have h : -a + -b + -c = -(1 : ℝ) := by linarith
  rw [h, lift_neg, lift_one]

theorem close_weighted (inner middle outer : UnitQuaternion) (a b c : ℝ)
    (hsum : a + b + c = 1) :
    let H := cycle inner middle outer
    cycle (lift H (-a) * inner)
      (inner⁻¹ * lift H (-b) * inner * middle)
      ((inner * middle)⁻¹ * lift H (-c) * (inner * middle) * outer) = 1 := by
  exact close_distributed inner middle outer _ _ _ (allocated_factors _ a b c hsum)

end TorsionalPump.Holonomy
