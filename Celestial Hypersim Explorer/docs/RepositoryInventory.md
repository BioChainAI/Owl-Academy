# Repository inventory and research scope

`repository-inventory.json` records the pre-existing tracked checkout at commit `c7428f87990061cd9b9ebde4b2ca9459dfc9072f`: 324 files, 137 HTML routes, and 26 shared browser JavaScript modules. It includes extension counts, top-level entries, route paths, basic guard/inline-script detection, and shared-module imports/exports.

33 HTML files directly reference `auth-guard.js`. Other pages may observe Firebase inline or have no shared guard. These are static source observations, not a deployed access test: a detected guard does not protect downloadable Pages assets, and absent detection does not establish database permissions. Import/export extraction is a source-text index, not a full JavaScript parser or call graph.

Repository areas reviewed:

| Area | Role in the system | Treatment |
|---|---|---|
| Root HTML + scripts | Login, Learning Hub, shared Auth/Firestore services, progression and UI | Runtime/data-flow analysis |
| Library | Grand Archives, department halls, public lessons, research and geometry modules | Route inventory; representative lesson/hall implementation and catalog analysis |
| mage_tower | Registrar, Codex, certificates, Instructor/Admin/Unlock/Seal consoles, Biomesh and Genesis map | Role, data and navigation mapping |
| canon | 145-tome curriculum and schema | Build-time projection; source-schema caveat in validation report |
| firestore.rules | Database access model | Full checked-in rule review; no live deployment inspection |
| BioChain-AI | Enterprise/reference Python and browser demonstrations | Separate research subsystem; no new execution or coupling |
| Proofs | Python verification, emulators/cartridges and Lean formalization | Independent toolchains; not a website backend |
| storage | Templates and static assets | No assumed private Storage policy |
| Security + system guides | Documented conventions and historical architecture | Compared against current code; stale auth/manual guidance documented |
| .github/workflows | Static Pages artifact and canon validation | Hosting/dependency boundary analysis; unchanged |

This is an architecture and integration investigation, not a line-by-line correctness proof of every simulation, cryptography paper, or research program. The existing systems are described with their actual names and source paths so future implementation can follow the boundary without re-discovering the core application.
