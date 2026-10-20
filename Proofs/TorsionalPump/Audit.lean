import TorsionalPump
import Lean.Util.CollectAxioms

/-!
Audit every declaration in this development, not only the headline theorem.
The only admitted logical foundations are Lean/Mathlib's standard extensionality,
classical choice, and quotient soundness. In particular `sorryAx` and any local
postulated physics, root, normalization, or convergence law cause failure.
-/

run_cmd do
  let env ← Lean.getEnv
  let mut count := 0
  let mut roots : Array Lean.Name := #[]
  for (name, info) in env.constants.toList do
    if (`TorsionalPump).isPrefixOf name then
      match info with
      | .axiomInfo _ => throwError "Local axiom is forbidden: {name}"
      | .thmInfo _ => count := count + 1
      | _ => pure ()
      roots := roots.push name
  -- Share the visited set across declarations so Mathlib dependencies are
  -- traversed once, while retaining the same audit of every project root.
  let collectAll : Lean.CollectAxioms.M Unit := do
    for name in roots do
      Lean.CollectAxioms.collect name
  let (_, audit) := (collectAll.run env).run {}
  for ax in audit.axioms do
    unless ax == ``propext || ax == ``Classical.choice || ax == ``Quot.sound do
      throwError "Unexpected axiom in the project dependency graph: {ax}"
  if count == 0 then throwError "No project theorems were audited"
  Lean.logInfo m!"Audited {count} project theorems; only standard logical axioms are used."

#print axioms TorsionalPump.System.full_system_correct
#print axioms TorsionalPump.QuaternionModel.lift_reconstruct
#print axioms TorsionalPump.Holonomy.close_weighted
