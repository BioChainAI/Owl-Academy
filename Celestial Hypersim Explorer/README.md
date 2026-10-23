# Owl Academy · Celestial Hypersim Explorer

An isolated research, architecture, and runnable dashboard scaffold for the Grand Archives, Major Tome canon, Minor Tome Memory Vault, Tome Knowledge Graph, Celestial Observatory, Sacred Geometry & Topology, and future Hyper-Sim Chambers.

The directory uses the user's requested name with spaces. The attached template's `Celestial-Hypersim-Explorer` refers to this same subsystem. Package identifiers use lowercase hyphens; Academy roles remain `ACOLYTE`, `INSTRUCTOR`, and `ARCHON`.

## Run locally

Requires Node >=20.9 (validated on Node 24) and npm. From the repository root:

```bash
cd 'Celestial Hypersim Explorer'
npm ci --cache /workspace/.cache/npm
npm run dev
```

The development server listens on loopback port 3100. Use local HTTP requests for readiness. `npm run build` creates a static export in `out/`; `npm run typecheck` checks TypeScript, and `npm test` checks policy boundaries, the registry, canon search, graph traversal, schema examples, and the disconnected adapter.

For browser checks, keep the dev server running (or serve `out/` on port 3100 with `python3 -m http.server 3100 --bind 127.0.0.1 --directory out`) and run `npm run test:browser` in a second terminal. Playwright needs a Chromium installation: use `npx playwright install chromium` on your own machine, or set `EXPLORER_CHROMIUM_PATH` to an existing browser. This cloud machine uses `/usr/bin/chromium`. The smoke test only accepts loopback URLs and checks real interaction, mobile overflow, runtime errors, and absence of external network requests. In this cloud sandbox, installation artifact checks, tsx's local IPC socket, listeners, Chromium, and Next's detached TypeScript subprocess may require tool execution permission. The successful validation used that permission; no installation verification or test assertions were disabled.

The build-time catalog loader reads `../canon/canon.manifest.json` from this working directory. Keep this folder inside the Academy checkout. It projects public curriculum metadata only; it does not import Firebase configuration or any user's data. Restart/rebuild after canon edits.

## What works now

- Search and department filtering over the real 145-tome canon, with source records and prerequisites.
- Six-module registry with explicit scaffold/planned states and Academy source references.
- Read-only control panel map using actual Codex, Instructor Console, Admin Console, and Unlock Console names.
- Typed integration boundary, draft permission policy, bounded graph traversal, example documents, JSON Schemas, API contract, and complete implementation roadmap.

This is not an authenticated replacement for the Academy. There is no live Firebase session, write capability, memory persistence, 3D renderer, semantic search, multiplayer, or AI endpoint. Firebase, Three.js, React Three Fiber, and Zustand are installed for the requested stack; only Zustand is used by the initial dashboard. Planned features are documented rather than represented as complete.

## Deployment boundary

No existing source, rule, curriculum, navigation, or workflow is changed. No Firebase deployment is configured. The current Pages workflow uploads the whole checkout, so new committed source files may be publicly served even before navigation is integrated. Isolation here means no execution hooks or production data connections; it is not source confidentiality. Never commit secrets or private fixture data.

Next.js requires a build before Pages can run this app. The current workflow will not automatically build it. After integration approval, build with the agreed Pages base path, then stage **only** `out/` under the chosen site path and keep the Academy's existing static site intact. For the requested folder URL the proposed setting is:

```bash
NEXT_PUBLIC_BASE_PATH='/Owl-Academy/Celestial%20Hypersim%20Explorer' npm run build
```

The default local export uses no base path. No Pages workflow or deployed site was updated in this task. A hosting/subpath smoke test is required before production integration.

## Read first

1. [Architecture report](docs/ArchitectureReport.md) and [repository inventory](docs/RepositoryInventory.md)
2. [Security analysis](docs/SecurityAnalysisReport.md)
3. [Existing-system integration report](docs/OwlAcademyIntegrationReport.md)
4. [Systems overview](SystemsOverview.md), [database design](DatabaseSchema.md), [roadmap](Roadmap.md)
5. [Dependency map](architecture/DependencyMap.md), [permission model](architecture/PermissionModel.md), [integration strategy](integrations/IntegrationStrategy.md)
6. [API design](api/README.md), [module contracts](modules/README.md), [future expansion](FutureExpansion.md)
7. [Validation record](docs/ValidationReport.md)

Research reflects checked-in source at commit `c7428f87990061cd9b9ebde4b2ca9459dfc9072f`. Deployed Firebase rules, console settings, authorized OAuth domains, indexes, and private production data were not inspected. Source findings do not prove deployed exploitation.
