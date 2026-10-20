import Mathlib.Algebra.Group.Basic
import Mathlib.Tactic.Group
import Lean.Elab.Tactic.Omega

/-!
# Ordered memory chains and exact offload

All products act on the left. There are `N` increments and `N+1` states;
increment `k` goes from state `k` to state `k+1`. No negative frame is used.
The results hold in every group, hence in the group of unit quaternions.
-/

namespace TorsionalPump.Algebra

variable {G : Type*} [Group G]

/-- Chronological increments multiply from right to left. -/
def block (d : ℕ → G) (s : ℕ) : ℕ → G
  | 0 => 1
  | n + 1 => d (s + n) * block d s n

@[simp] theorem block_zero (d : ℕ → G) (s : ℕ) : block d s 0 = 1 := rfl

@[simp] theorem block_succ (d : ℕ → G) (s n : ℕ) :
    block d s (n + 1) = d (s + n) * block d s n := rfl

def delta (q : ℕ → G) (k : ℕ) : G := q (k + 1) * (q k)⁻¹

/-- Proposition 2, with a defined initial boundary state. -/
theorem telescope (q : ℕ → G) (s n : ℕ) :
    block (delta q) s n = q (s + n) * (q s)⁻¹ := by
  induction n with
  | zero => simp
  | succ n ih =>
    rw [block_succ, ih]
    simp only [delta, Nat.add_assoc, mul_assoc, inv_mul_cancel_left]

def run (d : ℕ → G) (q₀ : G) (n : ℕ) : G := block d 0 n * q₀

@[simp] theorem run_zero (d : ℕ → G) (q₀ : G) : run d q₀ 0 = q₀ := by
  simp [run]

@[simp] theorem run_succ (d : ℕ → G) (q₀ : G) (n : ℕ) :
    run d q₀ (n + 1) = d n * run d q₀ n := by
  simp [run, mul_assoc]

theorem reconstruct (q : ℕ → G) (n : ℕ) : run (delta q) (q 0) n = q n := by
  simp [run, telescope, mul_assoc]

@[simp] theorem delta_run (d : ℕ → G) (q₀ : G) (n : ℕ) :
    delta (run d q₀) n = d n := by
  simp [delta, mul_assoc]

theorem block_append (d : ℕ → G) (s a b : ℕ) :
    block d s (a + b) = block d (s + a) b * block d s a := by
  induction b with
  | zero => simp
  | succ b ih =>
    rw [Nat.add_succ, block_succ, ih, block_succ]
    simp only [Nat.add_assoc, mul_assoc]

theorem run_add (d : ℕ → G) (q₀ : G) (s n : ℕ) :
    run d q₀ (s + n) = block d s n * run d q₀ s := by
  simp only [run, block_append, Nat.zero_add, mul_assoc]

theorem block_congr (d e : ℕ → G) (s n : ℕ)
    (h : ∀ k < n, d (s + k) = e (s + k)) : block d s n = block e s n := by
  induction n with
  | zero => rfl
  | succ n ih =>
    rw [block_succ, block_succ, h n (Nat.lt_succ_self n)]
    rw [ih (fun k hk => h k (Nat.lt_succ_of_lt hk))]

/-- A net left correction is realized by correcting the final increment once. -/
theorem correct_last (d : ℕ → G) (c : G) (s n : ℕ) :
    block (fun k => if k = s + n then c * d k else d k) s (n + 1) =
      c * block d s (n + 1) := by
  rw [block_succ, if_pos rfl, block_succ]
  have h : block (fun k => if k = s + n then c * d k else d k) s n = block d s n := by
    apply block_congr
    intro k hk
    rw [if_neg (by omega)]
  rw [h, mul_assoc]

theorem block_run (d : ℕ → G) (q₀ : G) (s n : ℕ) :
    block d s n = run d q₀ (s + n) * (run d q₀ s)⁻¹ := by
  have hd : delta (run d q₀) = d := funext (delta_run d q₀)
  simpa only [hd] using telescope (run d q₀) s n

/-- Store each ten-increment outer net with inverse orientation. -/
def middle (d : ℕ → G) (m : ℕ) : G := (block d (10 * m) 10)⁻¹

theorem outer_to_middle (q : ℕ → G) (m : ℕ) :
    middle (delta q) m = (q (10 * m + 10) * (q (10 * m))⁻¹)⁻¹ := by
  unfold middle
  rw [telescope]

@[simp] theorem decode_middle (d : ℕ → G) (m : ℕ) :
    (middle d m)⁻¹ = block d (10 * m) 10 := by simp [middle]

/-- Exact inverse-oriented state update; order of inversion is explicit. -/
theorem inverse_delta_update (previous current : G) :
    (previous * current⁻¹)⁻¹ * previous = current := by group

theorem inverse_chain_reconstruct (q : ℕ → G) (n : ℕ) :
    run (fun k => (q k * (q (k + 1))⁻¹)⁻¹) (q 0) n = q n := by
  have h : (fun k => (q k * (q (k + 1))⁻¹)⁻¹) = delta q := by
    funext k
    simp [delta]
  rw [h, reconstruct]

/-- Reblock along any monotone boundary sequence; no commutativity is assumed. -/
theorem reblock (d : ℕ → G) (b : ℕ → ℕ)
    (hb : Monotone b) (n : ℕ) :
    block (fun k => block d (b k) (b (k + 1) - b k)) 0 n =
      block d (b 0) (b n - b 0) := by
  induction n with
  | zero => simp
  | succ n ih =>
    rw [block_succ, Nat.zero_add, ih]
    have h₀ : b 0 ≤ b n := hb (Nat.zero_le n)
    have h₁ : b n ≤ b (n + 1) := hb (Nat.le_succ n)
    have heq : b (n + 1) - b 0 = (b n - b 0) + (b (n + 1) - b n) := by omega
    rw [heq, block_append]
    have hstart : b 0 + (b n - b 0) = b n := by omega
    rw [hstart]

theorem uniform_block (x : G) (s n : ℕ) : block (fun _ => x) s n = x ^ n := by
  induction n with
  | zero => simp
  | succ n ih => simp [ih, pow_succ']

/-- A verified root reconstructs the block endpoint, not its unknown interior. -/
theorem root_endpoint (d : ℕ → G) (s n : ℕ) (r q₀ : G)
    (hr : r ^ n = block d s n) :
    run (fun _ => r) q₀ n = block d s n * q₀ := by
  simp [run, uniform_block, hr]

/-- Exact fine recovery is possible with the residual retained at every step. -/
def residual (d e : ℕ → G) (k : ℕ) : G := d k * (e k)⁻¹

theorem residual_decode (d e : ℕ → G) (q₀ : G) (n : ℕ) :
    run (fun k => residual d e k * e k) q₀ n = run d q₀ n := by
  simp [residual, mul_assoc]

/-- Block-only compression cannot be injective in a nontrivial group. -/
theorem two_step_collision (x : G) :
    block (fun k => if k = 0 then x else x⁻¹) 0 2 =
      block (fun _ => (1 : G)) 0 2 := by
  simp [block]

end TorsionalPump.Algebra
