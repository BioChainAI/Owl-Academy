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
| `tests/unit/vendor.test.mjs` | `tests/vendor/VENDOR.json`: every vendored file is listed with its source commit and SHA-256, and matches it. |
| `tests/unit/rules-requests.test.mjs` | `tests/rules/client-requests.json`, offline: well formed; each allowed step names the client function that makes it, and that function uses the step's collection and every field the step sends; every function of `scripts/biomesh.js` and `scripts/minor-tome.js` that writes to Firestore has an allowed step; every collection the client writes refuses a signed-out visitor. |
| `tests/rules/rules.test.mjs` | `firestore.rules` in the Firestore emulator: the steps of `tests/rules/client-requests.json`, in order, with their expected verdicts (skipped without the emulator). |

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
