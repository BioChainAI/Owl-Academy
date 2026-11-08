// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// stubFirebase(root): register ./firebase-stub-hooks.mjs for this process, with the names each Firebase SDK URL
// must export, read from the import statements of every .js file under <root>/scripts. Call it before the first
// import() of a module that reaches scripts/firebase/.
import { register } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SDK_IMPORT = /import\s*\{([^}]*)\}\s*from\s*["'](https:\/\/www\.gstatic\.com\/firebasejs\/[^"']+)["']/g;

function jsFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...jsFiles(p));
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

/** The names imported from each Firebase SDK URL by the .js files under <root>/scripts: { url: [names] }. */
export function sdkImports(root) {
  const modules = {};
  for (const f of jsFiles(join(root, "scripts"))) {
    for (const m of readFileSync(f, "utf8").matchAll(SDK_IMPORT)) {
      const names = m[1].split(",").map((s) => s.trim()).filter(Boolean).map((s) => s.split(/\s+as\s+/)[0]);
      modules[m[2]] = [...new Set([...(modules[m[2]] || []), ...names])].sort();
    }
  }
  return modules;
}

export function stubFirebase(root) {
  register(new URL("./firebase-stub-hooks.mjs", import.meta.url), { data: { modules: sdkImports(root) } });
}
