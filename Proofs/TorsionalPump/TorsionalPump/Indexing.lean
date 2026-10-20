import Mathlib.Algebra.BigOperators.Group.Finset.Basic
import Mathlib.Data.Finset.Union
import Mathlib.Data.Fintype.Card
import Mathlib.Data.Rat.Init
import Lean.Elab.Tactic.Omega

/-!
# Finite frame addresses and the two offload partitions

The frame counts in Sections 2–8 are literal finite types.  Projections are
integer floor maps, and lifts select the first frame in each projection fibre.
All computations in this file are checked by Lean's kernel.
-/

open scoped BigOperators

namespace TorsionalPump.Indexing

abbrev Outer := Fin 720
abbrev Middle := Fin 72
abbrev Inner := Fin 10

/-- The outer tooth and the frame within that tooth, as in Section 3. -/
def outerTooth (n : Outer) : Fin 12 := ⟨n.val % 12, Nat.mod_lt _ (by decide)⟩

def outerLocalFrame (n : Outer) : Fin 60 := ⟨n.val / 12, by omega⟩

/-- Reassemble a tooth address, using the paper's interleaved convention. -/
def outerOfAddress (a : Fin 12) (r : Fin 60) : Outer :=
  ⟨a.val + 12 * r.val, by omega⟩

@[simp] theorem outerOfAddress_address (n : Outer) :
    outerOfAddress (outerTooth n) (outerLocalFrame n) = n := by
  apply Fin.ext
  dsimp [outerOfAddress, outerTooth, outerLocalFrame]
  omega

@[simp] theorem outerTooth_ofAddress (a : Fin 12) (r : Fin 60) :
    outerTooth (outerOfAddress a r) = a := by
  apply Fin.ext
  dsimp [outerOfAddress, outerTooth]
  omega

@[simp] theorem outerLocalFrame_ofAddress (a : Fin 12) (r : Fin 60) :
    outerLocalFrame (outerOfAddress a r) = r := by
  apply Fin.ext
  dsimp [outerOfAddress, outerLocalFrame]
  omega

/-- Every outer frame has exactly one of the 12 × 60 tooth addresses. -/
def outerAddressEquiv : Outer ≃ Fin 12 × Fin 60 where
  toFun n := (outerTooth n, outerLocalFrame n)
  invFun ar := outerOfAddress ar.1 ar.2
  left_inv := outerOfAddress_address
  right_inv := by intro ar; simp

/-- The middle and inner tooth addresses from Sections 4 and 5. -/
def middleTooth (m : Middle) : Fin 10 := ⟨m.val % 10, Nat.mod_lt _ (by decide)⟩

def innerTooth (l : Inner) : Fin 8 := ⟨l.val % 8, Nat.mod_lt _ (by decide)⟩

/-- Exact rational phases, with values in the half-open unit interval. -/
def middlePhase (m : Middle) : ℚ := (m.val : ℚ) / 72

def innerPhase (l : Inner) : ℚ := (l.val : ℚ) / 10

theorem middlePhase_range (m : Middle) : 0 ≤ middlePhase m ∧ middlePhase m < 1 := by
  have h : ∀ x : Middle, 0 ≤ middlePhase x ∧ middlePhase x < 1 := by decide +kernel
  exact h m

theorem innerPhase_range (l : Inner) : 0 ≤ innerPhase l ∧ innerPhase l < 1 := by
  have h : ∀ x : Inner, 0 ≤ innerPhase x ∧ innerPhase x < 1 := by decide +kernel
  exact h l

/-- First downward projection: ten outer increments form a middle increment. -/
def outerToMiddle (n : Outer) : Middle := ⟨n.val / 10, by omega⟩

/-- Second downward projection, with its nonuniform fibre lengths. -/
def middleToInner (m : Middle) : Inner := ⟨10 * m.val / 72, by omega⟩

/-- Choose the first outer frame of a middle block. -/
def middleToOuter (m : Middle) : Outer := ⟨10 * m.val, by omega⟩

/-- Integer ceiling of 72i/10.  The +9 implements the ceiling exactly. -/
def boundary (i : ℕ) : ℕ := (72 * i + 9) / 10

/-- Choose the first middle frame of an inner block. -/
def innerToMiddle (l : Inner) : Middle := ⟨boundary l.val, by
  dsimp [boundary]
  omega⟩

@[simp] theorem outerToMiddle_lift (m : Middle) :
    outerToMiddle (middleToOuter m) = m := by
  apply Fin.ext
  dsimp [outerToMiddle, middleToOuter]
  omega

@[simp] theorem middleToInner_lift (l : Inner) :
    middleToInner (innerToMiddle l) = l := by
  apply Fin.ext
  dsimp [middleToInner, innerToMiddle, boundary]
  omega

theorem outerToMiddle_monotone : Monotone outerToMiddle := by
  intro a b hab
  change a.val / 10 ≤ b.val / 10
  have hv : a.val ≤ b.val := hab
  omega

theorem middleToInner_monotone : Monotone middleToInner := by
  intro a b hab
  change 10 * a.val / 72 ≤ 10 * b.val / 72
  have hv : a.val ≤ b.val := hab
  omega

theorem outerToMiddle_surjective : Function.Surjective outerToMiddle :=
  fun m => ⟨middleToOuter m, outerToMiddle_lift m⟩

theorem middleToInner_surjective : Function.Surjective middleToInner :=
  fun l => ⟨innerToMiddle l, middleToInner_lift l⟩

theorem middleToOuter_injective : Function.Injective middleToOuter := by
  intro m n h
  have := congrArg outerToMiddle h
  simpa using this

theorem innerToMiddle_injective : Function.Injective innerToMiddle := by
  intro l k h
  have := congrArg middleToInner h
  simpa using this

/-- The full 720 → 72 → 10 downsampling pipeline. -/
def outerToInner (n : Outer) : Inner := middleToInner (outerToMiddle n)

/-- Its canonical 10 → 72 → 720 lift. -/
def innerToOuter (l : Inner) : Outer := middleToOuter (innerToMiddle l)

@[simp] theorem outerToInner_lift (l : Inner) :
    outerToInner (innerToOuter l) = l := by
  simp [outerToInner, innerToOuter]

theorem outerToInner_surjective : Function.Surjective outerToInner :=
  fun l => ⟨innerToOuter l, outerToInner_lift l⟩

/-- The uniform first offload partition. -/
def outerBlock (m : Middle) : Finset Outer :=
  Finset.univ.filter (fun n => outerToMiddle n = m)

/-- Aₗ from Section 8: fibres of floor(10m/72). -/
def middleBlock (l : Inner) : Finset Middle :=
  Finset.univ.filter (fun m => middleToInner m = l)

@[simp] theorem mem_outerBlock (n : Outer) (m : Middle) :
    n ∈ outerBlock m ↔ outerToMiddle n = m := by
  simp [outerBlock]

@[simp] theorem mem_middleBlock (m : Middle) (l : Inner) :
    m ∈ middleBlock l ↔ middleToInner m = l := by
  simp [middleBlock]

/-- Uniform blocks are exactly the consecutive intervals [10m, 10m+10). -/
theorem mem_outerBlock_iff (n : Outer) (m : Middle) :
    n ∈ outerBlock m ↔ 10 * m.val ≤ n.val ∧ n.val < 10 * (m.val + 1) := by
  rw [mem_outerBlock, Fin.ext_iff]
  dsimp [outerToMiddle]
  omega

/-- The nonuniform blocks are exactly intervals between ceiling boundaries. -/
theorem mem_middleBlock_iff (m : Middle) (l : Inner) :
    m ∈ middleBlock l ↔ boundary l.val ≤ m.val ∧ m.val < boundary (l.val + 1) := by
  rw [mem_middleBlock, Fin.ext_iff]
  dsimp [middleToInner, boundary]
  omega

/-- Both lifts really choose members of their corresponding blocks. -/
theorem middleToOuter_mem (m : Middle) : middleToOuter m ∈ outerBlock m := by simp

theorem innerToMiddle_mem (l : Inner) : innerToMiddle l ∈ middleBlock l := by simp

theorem outer_blocks_disjoint {m k : Middle} (h : m ≠ k) :
    Disjoint (outerBlock m) (outerBlock k) := by
  rw [Finset.disjoint_left]
  intro n hm hk
  exact h (((mem_outerBlock n m).mp hm).symm.trans ((mem_outerBlock n k).mp hk))

theorem middle_blocks_disjoint {l k : Inner} (h : l ≠ k) :
    Disjoint (middleBlock l) (middleBlock k) := by
  rw [Finset.disjoint_left]
  intro m hl hk
  exact h (((mem_middleBlock m l).mp hl).symm.trans ((mem_middleBlock m k).mp hk))

theorem outer_blocks_cover :
    Finset.univ.biUnion outerBlock = (Finset.univ : Finset Outer) := by
  ext n
  simp only [Finset.mem_biUnion, Finset.mem_univ, true_and, iff_true]
  exact ⟨outerToMiddle n, by simp⟩

theorem middle_blocks_cover :
    Finset.univ.biUnion middleBlock = (Finset.univ : Finset Middle) := by
  ext m
  simp only [Finset.mem_biUnion, Finset.mem_univ, true_and, iff_true]
  exact ⟨middleToInner m, by simp⟩

theorem unique_outer_block (n : Outer) : ∃! m : Middle, n ∈ outerBlock m := by
  refine ⟨outerToMiddle n, by simp, ?_⟩
  intro m hm
  exact ((mem_outerBlock n m).mp hm).symm

theorem unique_middle_block (m : Middle) : ∃! l : Inner, m ∈ middleBlock l := by
  refine ⟨middleToInner m, by simp, ?_⟩
  intro l hl
  exact ((mem_middleBlock m l).mp hl).symm

/-- A block consists of its ten consecutive local frame addresses. -/
def outerBlockFrame (m : Middle) (r : Fin 10) : Outer :=
  ⟨10 * m.val + r.val, by omega⟩

theorem outerBlockFrame_injective (m : Middle) :
    Function.Injective (outerBlockFrame m) := by
  intro a b h
  apply Fin.ext
  have hv := congrArg Fin.val h
  dsimp [outerBlockFrame] at hv
  omega

theorem outerBlock_eq_image (m : Middle) :
    outerBlock m = Finset.univ.image (outerBlockFrame m) := by
  ext n
  rw [mem_outerBlock_iff]
  simp only [Finset.mem_image, Finset.mem_univ, true_and]
  constructor
  · intro h
    refine ⟨⟨n.val - 10 * m.val, by omega⟩, ?_⟩
    apply Fin.ext
    dsimp [outerBlockFrame]
    omega
  · rintro ⟨r, rfl⟩
    dsimp [outerBlockFrame]
    omega

theorem outer_block_card (m : Middle) : (outerBlock m).card = 10 := by
  rw [outerBlock_eq_image, Finset.card_image_of_injective _ (outerBlockFrame_injective m)]
  simp

theorem outer_block_card_sum : ∑ m : Middle, (outerBlock m).card = 720 := by
  simp [outer_block_card]

/-- Concrete boundaries; 0 and 72 are included as the two endpoints. -/
theorem boundaries_exact :
    (List.range 11).map boundary = [0, 8, 15, 22, 29, 36, 44, 51, 58, 65, 72] := by
  decide +kernel

/-- The two longer middle blocks occur at indices 0 and 5. -/
theorem middle_block_cardinalities :
    (List.finRange 10).map (fun l => (middleBlock l).card) =
      [8, 7, 7, 7, 7, 8, 7, 7, 7, 7] := by
  decide +kernel

theorem middle_block_card (l : Inner) :
    (middleBlock l).card = if l.val = 0 ∨ l.val = 5 then 8 else 7 := by
  have h : ∀ x : Inner, (middleBlock x).card =
      if x.val = 0 ∨ x.val = 5 then 8 else 7 := by decide +kernel
  exact h l

theorem middle_block_card_seven_or_eight (l : Inner) :
    (middleBlock l).card = 7 ∨ (middleBlock l).card = 8 := by
  rw [middle_block_card]
  split <;> simp

theorem middle_block_card_sum : ∑ l : Inner, (middleBlock l).card = 72 := by
  decide +kernel

end TorsionalPump.Indexing
