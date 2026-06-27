"""Run the whole SHD-CCP pump verification suite and report pass/fail.

    python3 run_all.py

Each module is self-contained and exits nonzero on any failed assertion, so a clean
run here means every stated lemma checked out. No third-party dependencies.
"""

import importlib
import sys
import time

MODULES = [
    ("verify_cycle_current",    "Lemma 1 — explicit (K, pi) with cycle current J > 0"),
    ("verify_sparsemax_kernel", "Lemma 2 — Sparsemax kernel; Remark 22 stationary circulation"),
    ("verify_slerp_drift",      "Lemma 3 — SLERP offload: exactness + drift bound"),
    ("verify_clifford_winding", "Lemma 4 — golden Clifford torus + ergodic winding"),
]


def main():
    failures = 0
    for name, desc in MODULES:
        print("\n" + "#" * 78)
        print(f"# {desc}")
        print("#" * 78)
        t0 = time.process_time()
        try:
            mod = importlib.import_module(name)
            mod.main()
            print(f"[{name}] OK in {time.process_time() - t0:.1f}s")
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(f"[{name}] FAILED: {exc!r}")
    print("\n" + "=" * 78)
    print("ALL MODULES PASSED" if failures == 0 else f"{failures} MODULE(S) FAILED")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
