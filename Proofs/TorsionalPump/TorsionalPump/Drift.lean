import TorsionalPump.Quaternion

/-!
# Quantitative reconstruction bounds

The paper's fractional lift preserves a block product. It does not recover the
individual increments of an arbitrary fine history. This file distinguishes
these claims and bounds accumulated reconstruction error in a group with a
bi-invariant metric. Both invariance properties are explicit hypotheses.
-/

noncomputable section

namespace TorsionalPump.Drift

section Algebra

variable {G : Type*} [Monoid G]

/-- Left-acting evolution: the newest increment is multiplied on the left. -/
def run (d : ℕ → G) (q₀ : G) : ℕ → G
  | 0 => q₀
  | n + 1 => d n * run d q₀ n

@[simp] theorem run_zero (d : ℕ → G) (q₀ : G) : run d q₀ 0 = q₀ := rfl

@[simp] theorem run_succ (d : ℕ → G) (q₀ : G) (n : ℕ) :
    run d q₀ (n + 1) = d n * run d q₀ n := rfl

/-- Splitting a history at an arbitrary frame preserves multiplication order. -/
theorem run_add (d : ℕ → G) (q₀ : G) (s n : ℕ) :
    run d q₀ (s + n) = run (fun k => d (s + k)) (run d q₀ s) n := by
  induction n with
  | zero => simp
  | succ n ih => simpa only [Nat.add_succ, run_succ, ih]

/-- Equal ordered block products give equal endpoints from a common start. -/
theorem endpoint_of_product_eq (d e : ℕ → G) (q₀ : G) (n : ℕ)
    (h : run d 1 n = run e 1 n) : run d q₀ n = run e q₀ n := by
  have hmul (f : ℕ → G) : ∀ k, run f q₀ k = run f 1 k * q₀ := by
    intro k
    induction k with
    | zero => simp
    | succ k ih => simp only [run_succ, ih, mul_assoc]
  rw [hmul d n, hmul e n, h]

/-- Repeating a single increment follows its natural powers. -/
theorem run_constant (r q₀ : G) (n : ℕ) :
    run (fun _ => r) q₀ n = r ^ n * q₀ := by
  induction n with
  | zero => simp
  | succ n ih => simp only [run_succ, ih, pow_succ', mul_assoc]

/-- A chosen Nth root reconstructs its coarse increment exactly at the endpoint.

The root identity is an explicit algebraic premise. This theorem does not
assume that a fractional lift reconstructs arbitrary lost intermediate data.
-/
theorem uniform_reconstruction (r coarse q₀ : G) (N : ℕ)
    (hroot : r ^ N = coarse) :
    run (fun _ => r) q₀ N = coarse * q₀ := by
  rw [run_constant, hroot]

/-- Uniform lifting of a compressed block preserves that block's endpoint. -/
theorem uniform_block_endpoint (d : ℕ → G) (r q₀ : G) (N : ℕ)
    (hroot : r ^ N = run d 1 N) :
    run (fun _ => r) q₀ N = run d q₀ N := by
  apply endpoint_of_product_eq
  simpa only [run_constant, mul_one] using hroot

end Algebra

section Metric

variable {G : Type*} [Group G] [MetricSpace G]

/- Two-sided metric invariance is the exact extra structure needed below. -/
variable
  (hleft : ∀ a b c : G, dist (a * b) (a * c) = dist b c)
  (hright : ∀ a b c : G, dist (a * c) (b * c) = dist a b)

include hleft hright

/-- One update adds at most the error in its increment. -/
theorem one_step_bound (a b x y : G) :
    dist (a * x) (b * y) ≤ dist a b + dist x y := by
  calc
    dist (a * x) (b * y) ≤ dist (a * x) (b * x) + dist (b * x) (b * y) :=
      dist_triangle _ _ _
    _ = dist a b + dist x y := by rw [hright, hleft]

/-- A finite reconstruction's error is bounded by its initial error plus
the sum of all increment errors. -/
theorem cumulative_bound (d e : ℕ → G) (p₀ q₀ : G) (n : ℕ) :
    dist (run d p₀ n) (run e q₀ n) ≤
      dist p₀ q₀ + ∑ k ∈ Finset.range n, dist (d k) (e k) := by
  induction n with
  | zero => simp
  | succ n ih =>
    calc
      dist (run d p₀ (n + 1)) (run e q₀ (n + 1)) ≤
          dist (d n) (e n) + dist (run d p₀ n) (run e q₀ n) :=
        one_step_bound hleft hright _ _ _ _
      _ ≤ dist (d n) (e n) +
          (dist p₀ q₀ + ∑ k ∈ Finset.range n, dist (d k) (e k)) :=
        add_le_add_left ih _
      _ = dist p₀ q₀ + ∑ k ∈ Finset.range (n + 1), dist (d k) (e k) := by
        rw [Finset.sum_range_succ]
        ring

/-- With a common initial state, only the increment errors accumulate. -/
theorem common_start_bound (d e : ℕ → G) (q₀ : G) (n : ℕ) :
    dist (run d q₀ n) (run e q₀ n) ≤
      ∑ k ∈ Finset.range n, dist (d k) (e k) := by
  simpa only [dist_self, zero_add] using cumulative_bound hleft hright d e q₀ q₀ n

/-- After an exact block endpoint, the error bound restarts at zero. Thus
endpoint preservation prevents earlier block errors from accumulating onward. -/
theorem reset_bound (d e : ℕ → G) (p₀ q₀ : G) (s n : ℕ)
    (hreset : run d p₀ s = run e q₀ s) :
    dist (run d p₀ (s + n)) (run e q₀ (s + n)) ≤
      ∑ k ∈ Finset.range n, dist (d (s + k)) (e (s + k)) := by
  rw [run_add, run_add, ← hreset]
  exact common_start_bound hleft hright _ _ _ n

/-- Exact prefix block products supply the endpoint reset hypothesis. -/
theorem reset_of_product_eq (d e : ℕ → G) (q₀ : G) (s n : ℕ)
    (hproducts : run d 1 s = run e 1 s) :
    dist (run d q₀ (s + n)) (run e q₀ (s + n)) ≤
      ∑ k ∈ Finset.range n, dist (d (s + k)) (e (s + k)) :=
  reset_bound hleft hright d e q₀ q₀ s n
    (endpoint_of_product_eq d e q₀ s hproducts)

/-- A uniform per-frame error budget gives a linear finite-horizon bound. -/
theorem uniform_error_bound (d e : ℕ → G) (q₀ : G) (n : ℕ) (ε : ℝ)
    (hε : ∀ k < n, dist (d k) (e k) ≤ ε) :
    dist (run d q₀ n) (run e q₀ n) ≤ (n : ℝ) * ε := by
  calc
    dist (run d q₀ n) (run e q₀ n) ≤
        ∑ k ∈ Finset.range n, dist (d k) (e k) :=
      common_start_bound hleft hright _ _ _ _
    _ ≤ ∑ _k ∈ Finset.range n, ε :=
      Finset.sum_le_sum (fun k hk => hε k (Finset.mem_range.mp hk))
    _ = (n : ℝ) * ε := by simp [nsmul_eq_mul]

/-- An exact root lift has zero error against the prescribed coarse endpoint. -/
theorem uniform_endpoint_error_zero (r coarse q₀ : G) (N : ℕ)
    (hroot : r ^ N = coarse) :
    dist (run (fun _ => r) q₀ N) (coarse * q₀) = 0 := by
  rw [uniform_reconstruction r coarse q₀ N hroot, dist_self]

end Metric

section Quaternion

open QuaternionModel

/-- Pull back the real quaternion metric along the faithful value map. -/
def quaternionMetric : MetricSpace UnitQuaternion :=
  MetricSpace.induced value value_injective inferInstance

local instance : MetricSpace UnitQuaternion := quaternionMetric

theorem quaternion_dist_eq (p q : UnitQuaternion) :
    dist p q = ‖value p - value q‖ := by
  change dist (value p) (value q) = _
  exact dist_eq_norm _ _

/-- The chordal quaternion metric is left invariant because the multiplier
has norm one; this is proved, rather than assumed for the quaternion model. -/
theorem quaternion_left_invariant (a b c : UnitQuaternion) :
    dist (a * b) (a * c) = dist b c := by
  simp only [quaternion_dist_eq, value_mul]
  rw [← mul_sub, norm_mul, value_norm, one_mul]

/-- Right invariance also holds despite noncommutative multiplication. -/
theorem quaternion_right_invariant (a b c : UnitQuaternion) :
    dist (a * c) (b * c) = dist a b := by
  simp only [quaternion_dist_eq, value_mul]
  rw [← sub_mul, norm_mul, value_norm, mul_one]

/-- An unconditional, finite-horizon bound for actual unit quaternions. -/
theorem quaternion_cumulative_bound (d e : ℕ → UnitQuaternion)
    (p₀ q₀ : UnitQuaternion) (n : ℕ) :
    ‖value (run d p₀ n) - value (run e q₀ n)‖ ≤
      ‖value p₀ - value q₀‖ +
        ∑ k ∈ Finset.range n, ‖value (d k) - value (e k)‖ := by
  simpa only [quaternion_dist_eq] using
    cumulative_bound quaternion_left_invariant quaternion_right_invariant d e p₀ q₀ n

/-- Once quaternion block endpoints agree, the following block's error budget
starts afresh; no unproved global drift cancellation is used. -/
theorem quaternion_reset_bound (d e : ℕ → UnitQuaternion)
    (p₀ q₀ : UnitQuaternion) (s n : ℕ)
    (hreset : run d p₀ s = run e q₀ s) :
    ‖value (run d p₀ (s + n)) - value (run e q₀ (s + n))‖ ≤
      ∑ k ∈ Finset.range n, ‖value (d (s + k)) - value (e (s + k))‖ := by
  simpa only [quaternion_dist_eq] using
    reset_bound quaternion_left_invariant quaternion_right_invariant d e p₀ q₀ s n hreset

/-- The actual axis-angle fractional lift reaches the exact coarse endpoint. -/
theorem quaternion_fractional_endpoint (u : Axis) (t : ℝ)
    (q₀ : UnitQuaternion) (N : ℕ) (hN : 0 < N) :
    run (fun _ => fractionalLift u t (1 / (N : ℝ))) q₀ N = axisAngle u t * q₀ :=
  uniform_reconstruction _ _ _ _ (fractionalLift_reconstruct u t N hN)

/-- Applied to a compressed fine block, quaternion SLERP exactly preserves its
endpoint. Its intermediate path can differ from the original fine history. -/
theorem quaternion_reconstruct_block (d : ℕ → UnitQuaternion)
    (u : Axis) (t : ℝ) (q₀ : UnitQuaternion) (N : ℕ) (hN : 0 < N)
    (hcoarse : axisAngle u t = run d 1 N) :
    run (fun _ => fractionalLift u t (1 / (N : ℝ))) q₀ N = run d q₀ N := by
  apply uniform_block_endpoint
  rw [fractionalLift_reconstruct u t N hN, hcoarse]

/-- Every unit-quaternion coarse increment has an exact uniform lifted endpoint,
using the concrete `exp(w log q)` operation and its proved branch choice. -/
theorem quaternion_lift_endpoint (coarse q₀ : UnitQuaternion)
    (N : ℕ) (hN : 0 < N) :
    run (fun _ => lift coarse (1 / (N : ℝ))) q₀ N = coarse * q₀ :=
  uniform_reconstruction _ _ _ _ (lift_reconstruct coarse N hN)

/-- Every compressed fine block admits uniform quaternion reconstruction with
the exact original endpoint, without any additional root-existence premise. -/
theorem quaternion_lift_block_endpoint (d : ℕ → UnitQuaternion)
    (q₀ : UnitQuaternion) (N : ℕ) (hN : 0 < N) :
    run (fun _ => lift (run d 1 N) (1 / (N : ℝ))) q₀ N = run d q₀ N :=
  uniform_block_endpoint _ _ _ _ (lift_reconstruct (run d 1 N) N hN)

end Quaternion

end TorsionalPump.Drift
