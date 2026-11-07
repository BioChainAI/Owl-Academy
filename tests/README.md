# Tests

Static and unit checks for the shared browser code. They need only Node (22 or later)
and no packages. Run them from the repository root:

```sh
node --test "tests/**/*.test.mjs"
```

| File | What it checks |
| --- | --- |
| `tests/static/escape.test.mjs` | `scripts/ui/escape.js`: `escapeHtml`, `escapeAttr`, `jsArg`, `safeUrl` and `textEl` turn any value into inert text, attribute values, handler arguments or safe URLs. |
| `tests/static/sinks.test.mjs` | In the pages that render records, other users' data or loaded files (every `mage_tower/` page and script, `index.html`, `login.html`, `Learning-Hub.html`, `Independent_Learning.html`, `Engram_Mind_Eye.html`, everything under `Proofs/`, the Ontology Department import tools) and every script under `scripts/`, HTML built from template literals or assigned to `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write` passes every interpolated value through an escaper (record fields render as text). Variables are followed within their own scope, function parameters to the calls of that function, and local helpers to their return values. Constants, numbers and reviewed markup are listed with the reason in `tests/static/sinks-reviewed.json`. The rules are listed at the top of the file. |
| `tests/static/mathjax.test.mjs` | Every page that loads MathJax pins an exact version and loads its `ui/safe` extension (TeX links, classes, ids and styles are filtered). |
| `tests/static/storage-policy.test.mjs` | No code calls `localStorage.clear()` or `sessionStorage.clear()` (the origin is shared with other apps); every storage key Owl writes is listed in `scripts/auth-logout.js`; new keys use the `owl.` prefix; logout removes Owl's keys and keeps saved work and other apps' data. |

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
