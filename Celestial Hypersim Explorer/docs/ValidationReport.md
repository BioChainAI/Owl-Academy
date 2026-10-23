# Validation record

Validated in the supplied cloud checkout with Node 24.19.0, npm, Python 3.12.14 as a local static server, and the system Chromium through Playwright. The new source lives exclusively in `Celestial Hypersim Explorer/`. No production Firebase calls, data writes, rule deployment, Pages publication, or account actions were performed.

| Check | Outcome |
|---|---|
| Initial dependency install | Passed; exact versions and integrity data saved in package-lock.json |
| Clean frozen install | `npm ci --cache /workspace/.cache/npm --offline --no-audit --no-fund` passed, installing 147 packages from local cache |
| Domain/contract tests | 13 passed, 0 failed/skipped; policy, canon projection/search, registry, cyclic traversal, all 19 schema examples, malformed payload rejection, fixture reference integrity, API references and disconnected integration |
| TypeScript | `npm run typecheck` passed |
| Production static build | `npm run build` passed, including Next's TypeScript check and static export |
| Exported-site browser test | Passed against local `out/`: 145-tome initial catalog, case-insensitive search, Department X's 64 seats, empty result state, Observatory module selection, 390px mobile layout without horizontal overflow |
| Browser boundary check | No page runtime exceptions or external/production requests during the smoke test |
| Repository isolation | Existing tracked-file diff empty; only the new top-level folder is untracked. node_modules, .next, out and build-info files are ignored |

The browser test command used the system browser:

```bash
EXPLORER_CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Start the local static or dev server first, as described in README. No user-facing localhost preview is published. A mobile screenshot was inspected during validation; it is a temporary diagnostic artifact, not a production asset.

## Failures investigated and resolved

The environment's process sandbox changed during work. It blocked local listeners, Chromium sockets, tsx IPC, esbuild's binary verification and capture of Next's TypeScript subprocess output. The same scoped commands passed with approved tool execution permissions. TLS, package integrity and binary checks remained enabled; no dependency scripts or assertions were bypassed.

The first browser smoke run exposed an ambiguous department select accessible label. The select now has an explicit label, and the interaction/mobile checks passed after rebuilding. The frozen-install verification was followed by tests/typecheck/build to confirm the package lock is reproducible on the current machine.

## Existing-source limitations

The source canon's checked-in validator imports Ajv's default schema dialect while canon.schema.json uses Draft 2020-12, causing fallback to structural checks. A full Draft 2020-12 check rejects the manifest root `_note` property. This is an existing source defect, not a failure of the Explorer's 19 example schemas. The Explorer uses a public metadata projection and does not repair or certify the existing curriculum schema.

Security findings in SecurityAnalysisReport are source analysis, not live exploit results. Firebase authentication/persistence, deployed rules/indexes/Storage, real unlock approvals, private memory persistence, 3D/astronomical computation, AI, and multiplayer were not exercised. No existing research Python/Lean suite was expanded for this isolated frontend change.

The default no-base-path export was tested locally. The proposed encoded GitHub Pages subpath and production hosting/navigation integration remain future approval/validation work; no production-readiness claim is made.
