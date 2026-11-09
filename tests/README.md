# Tests

Unit, static and rules checks for the shared browser code and `firestore.rules`. The unit
and static tests need only Node (22 or later) and no packages. Run them from the repository
root:

```sh
node --test "tests/**/*.test.mjs"
```

The rules tests also need the packages in `tests/package.json` (devDependencies only; Owl has
no build) and Java 21 for the Firestore emulator:

```sh
cd tests && npm ci && npm run test:rules
```

`.github/workflows/biomesh-ci.yml` runs the three groups on pull requests and pushes to main
that touch code, pages, the rules or the tests (`unit`, `rules`, `static`); nightly it runs the
static checks again and compares the vendored files with upstream.

| File | What it checks |
| --- | --- |
| `tests/static/escape.test.mjs` | `scripts/ui/escape.js`: `escapeHtml`, `escapeAttr`, `jsArg`, `safeUrl` and `textEl` turn any value into inert text, attribute values, handler arguments or safe URLs. |
| `tests/static/sinks.test.mjs` | In the pages that render records, other users' data or loaded files (every `mage_tower/` page and script, `index.html`, `login.html`, `Learning-Hub.html`, `Independent_Learning.html`, `Engram_Mind_Eye.html`, everything under `Proofs/`, the Ontology Department import tools) and every script under `scripts/`, HTML built from template literals or assigned to `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write` passes every interpolated value through an escaper (record fields render as text). Variables are followed within their own scope, function parameters to the calls of that function, and local helpers to their return values. Constants, numbers and reviewed markup are listed with the reason in `tests/static/sinks-reviewed.json`. The rules are listed at the top of the file. |
| `tests/static/mathjax.test.mjs` | Every page that loads MathJax pins an exact version and loads its `ui/safe` extension (TeX links, classes, ids and styles are filtered). |
| `tests/static/storage-policy.test.mjs` | No code calls `localStorage.clear()` or `sessionStorage.clear()` (the origin is shared with other apps); every storage key Owl writes is listed in `scripts/auth-logout.js`; new keys use the `owl.` prefix; logout removes Owl's keys and keeps saved work and other apps' data. |
| `tests/unit/biomesh-core.test.mjs` | `scripts/biomesh-core.js`, the Firebase-free half of `scripts/biomesh.js`: every function moved from `biomesh.js` has its text at 7f45f35 (`tests/unit/fixtures/biomesh-7f45f35.json`, rebuilt from git history when the commit is present), the core imports only `sha256Hex` from `seal-crypto.js`, `biomesh.js` still exports everything it exported (the core's names as the same objects); `crystallizeGolden()` is `9841D88D8B003CEA` and the GEODESIC engram key `5C896A4801C9C24C`; grow and recreate round trips, growth epochs, codices, seeds; and the 13 texts of the Hyperbolic Lexicon's `biomesh_compat_v1.json` give its pinned records (chain id, Merkle root, value and the SHA-256 of the whole record), engrams off and on. About a minute. |
| `tests/unit/biomesh-strict.test.mjs` | The strict verifier (RFC 07 section 12): `sha256HexSync` (FIPS 180-4 in plain JS) equals Web Crypto on the FIPS 180-4 examples, every length 0..300, non-ASCII text and every leaf of the record vectors; `engramGrid` gives the same grid as its 7f45f35 text on 10,000 seeded tokens (each letter's grid is now built once); `parseBiochainStreamStrict` reads only the form of RFC 07 section 4.3; `parseBiochainStream` (the lax parser) throws on a negative residual length and otherwise gives what its 7f45f35 text gives (the tamper vectors' streams and 3,000 fuzzed ones); `verifyIntegrityStrict` accepts every record vector, synchronously and with either hash, and rejects each case of `tests/unit/support/tamper.mjs` at its expected first check, while `verifyIntegrity` (self-consistency, unchanged) still accepts T1, T2, T8 and T9; ill-formed UTF-8 fails at canonical also when the change leaves the crystal, the leaves or the weaves wrong; `KINDS` and `validateKind`; `publishBiochain` refuses a record that fails the strict check, an unknown kind or a bad `crystCost` before it signs or writes; `STRICT_ENFORCE` is false and `biomesh.js`'s `extendBiochain` passes it. |
| `tests/unit/contract-vectors.test.mjs` | The 13 RFC 07 contract-vector suites vendored from BioChainAI/SHD-CCP-core (`tests/vendor/shdccp2-contract/`; 12 normative upstream, `shdccp2_tamper_open` draft) against `scripts/biomesh-core.js`, bit for bit: packets (0x80 crystal bytes raw, never the kernel-normalised packet), chunks, Merkle roots, the binary64 arithmetic, weaves, engrams, mulberry32 draws, whole records, the coder's largest codes and the stream bound, the engram key of a string, and the shdccp/2 root beside the BIOSEED/1 and RFC 6962 roots of the same chunks. Every honest vector passes the strict check (the 0x80 weave chunks grown as records among them); every `shdccp2_tamper` value gets its expected verdict (ok, first failing check, legacy) with either hash, and `verifyIntegrity` returns on each (in a worker with memory and time limits) with the self-consistency verdict the suite records. |
| `tests/unit/weave-engines.test.mjs` | The set-up of the D7 measurement, offline: `.github/workflows/weave-engines.yml` runs only when dispatched, read-only, actions pinned; Playwright pinned by version and lockfile in `tests/engines/`; the seeded shards are deterministic; the weaves the harness compares are the ones `growBiochain` writes. The strict audit's engine check (`scripts/biomesh-engine-check.js`): its hypot table is `shdccp2_arith`'s 24 hypot cases, Node and RFC 07's `hypotV8` reproduce it and its seeded weave, and a `Math.hypot` computed another way is reported as not V8's. |
| `tests/unit/biomesh-services.test.mjs` | The Firestore reads, against an in-memory Firestore (`tests/unit/support/firestore-fake.mjs`): `getDocument`, `queryCollection` and `watchDocument` set `id` to the document id even when the data has an `id` field; `listBiochainsPage` pages by the snapshot's document ids (30 records in pages of 25, each read once, whatever `id` field a record carries, which it reports); `traceBiochain` returns `verifyIntegrity`'s own result as `selfCheck`, so with `STRICT_ENFORCE` on (`biomesh.js` loaded with the flag set) the trace still reads "self-consistent only, failed at <check>". |
| `tests/unit/vendor.test.mjs` | `tests/vendor/VENDOR.json`: every vendored file is listed with its source commit and SHA-256, and matches it. |
| `tests/unit/rules-requests.test.mjs` | `tests/rules/client-requests.json`, offline: well formed; each allowed step names the client function that makes it, and that function uses the step's collection and every field the step sends; every function of `scripts/biomesh.js` and `scripts/minor-tome.js` that writes to Firestore has an allowed step; every collection the client writes refuses a signed-out visitor. |
| `tests/rules/rules.test.mjs` | `firestore.rules` in the Firestore emulator: the steps of `tests/rules/client-requests.json`, in order, with their expected verdicts (skipped without the emulator). |

`tests/engines/` holds the D7 measurement (decision D7, RFC 07 section 8.7): `weave-engines.mjs` computes the weaves of
1,000 seeded shards and `Math.hypot` on 10,000 seeded inputs in Chromium, Firefox and WebKit through Playwright and
compares them with Node (V8), writing the mismatch rate per engine. It downloads three browsers, so only
`.github/workflows/weave-engines.yml` runs it, by hand (Actions → Weave engines → Run workflow); the report is the
run's artifact. `node tests/engines/weave-engines.mjs --node-only` computes the Node side alone.

To run a check against another checkout, set `OWL_TEST_ROOT`:

```sh
OWL_TEST_ROOT=/path/to/other/checkout node --test tests/static/sinks.test.mjs
```

## Writing HTML from data

Import the helpers in a module script:

```js
import { escapeHtml, escapeAttr, jsArg, safeUrl, textEl } from "../scripts/ui/escape.js";

el.innerHTML = `<option value="${escapeAttr(rec.id)}">${escapeHtml(rec.title)}</option>`;
el.innerHTML = `<a href="${escapeAttr(safeUrl(rec.url))}">${escapeHtml(rec.label)}</a>`;
el.innerHTML = `<button onclick="openItem(${jsArg(rec.id)})">Open</button>`;
list.appendChild(textEl("li", rec.title, { className: "item" }));
```

The check follows a variable to its assignments in the same scope, a function parameter to
the calls of that function in the same file, and a local helper to its return values. Only
code it cannot follow is trusted by name: an imported `render*()`, `*Html()` or `*Svg()`
function, or a property named `html`, `*Html` or `*Svg`. A page that cannot import
`scripts/ui/escape.js` (a classic script) may define its own `escapeHtml` / `jsArg`; the test
runs such a definition on markup and fails if anything is left unescaped.

When a value is a constant or a number the check cannot see as one, add it to
`tests/static/sinks-reviewed.json` under the file, with the exact expression and the reason.
An entry that no longer matches anything fails the test.

Pages that load MathJax put `loader: { load: ['ui/safe'] }` in their `window.MathJax`
configuration, before the MathJax script tag, and use an exact version
(`mathjax@3.2.2`).

## Storage keys

Owl's browser-storage keys are listed in `scripts/auth-logout.js`. A new key gets the
`owl.` prefix and goes into `OWL_LOCAL_KEYS` (removed on logout) or `OWL_KEPT_KEYS`
(saved work, kept on logout). Every "Log out" button calls `owlLogout()` from that file.

## Biomesh code

The pure biochain functions (grow, recreate, verify, engrams, seeds, codex derivation and the
commitment strings) live in `scripts/biomesh-core.js`, which imports only `sha256Hex` from
`scripts/seal-crypto.js` and so runs in Node. `scripts/biomesh.js` re-exports it
(`export * from "./biomesh-core.js"`) and keeps the Firestore services; pages keep importing
`scripts/biomesh.js`. A new pure function goes into the core; anything that reads or writes
Firestore, or verifies a seal block against the registry, stays in `biomesh.js`.

`verifyIntegrity` checks self-consistency only; `verifyIntegrityStrict` checks RFC 07's validity
predicate (BioChainAI/SHD-CCP-core `rfcs/07_shdccp2_contract.md`, section 12) and reports the
first failing check (parity, canonical, crystal, leaves, weaves, derived). It is synchronous and
takes the hash as `{ sha256 }` (default `sha256HexSync`), so a generated copy of the core can run
it unchanged. `STRICT_ENFORCE` in `biomesh.js` is false (shadow mode): `publishBiochain` refuses
a record that fails the strict check either way; accept, extend, trace and the pages compute and
show the verdict and refuse on it only when the flag is true. A record's `kind` must be one of
`KINDS` (`validateKind`).

`tests/unit/support/firebase-stub.mjs` lets a test import `scripts/biomesh.js` in Node: the
Firebase SDK URLs load stubs that export the imported names and throw if called.

## Rules cases

`tests/rules/client-requests.json` (format `owl-rules/1`) lists Firestore requests for the
registrar, minor tomes and seals, and the Biomesh collections, grouped by collection, each with
the account it runs as (`null` is a signed-out visitor) and the verdict `firestore.rules` gives
it. The steps run in file order against one empty emulator database, so a later step can rely on
the documents an earlier one wrote. An allowed step is a request the client makes and names the
function in `scripts/` that makes it (`"client": "scripts/biomesh.js sendBiochain"`); its
`method` is the helper that function calls (`setDocument`, `updateDocument`,
`addToCollection`, which add `updatedAt` or `createdAt` as `scripts/firebase/firestore.js`
does) or a plain `get`, `list` or `delete`. A refused step is the same kind of request from
another account or a signed-out visitor, or a change the rules do not permit.

When the client gains a Firestore write, add an allowed step for it (the offline test asks for
one); when the rules change, every allowed step must still pass.

## Vendored files

`tests/vendor/` holds files owned by other repositories, pinned by SHA-256 in
`tests/vendor/VENDOR.json` (source repository, commit, licence). See `tests/vendor/README.md`.
