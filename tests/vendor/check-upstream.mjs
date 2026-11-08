// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// Compare the vendored files (VENDOR.json) with their upstream copies. Prints one line per file: "same", or a NOTE
// when upstream differs or cannot be read. Always exits 0: a newer upstream copy is a note for whoever refreshes the
// vendored files, never a failure.
//
//   node tests/vendor/check-upstream.mjs                        upstream on GitHub (the recorded ref, then main)
//   node tests/vendor/check-upstream.mjs --local <id>=<dir>     a local checkout for source <id> instead
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const VENDOR = JSON.parse(readFileSync(new URL("./VENDOR.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);
const local = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--local" && args[i + 1]) { const [id, dir] = args[++i].split("="); local[id] = resolve(dir); }
}
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const short = (h) => h.slice(0, 12) + "…";

async function fetchRaw(repository, ref, path) {
  const url = `https://raw.githubusercontent.com/${repository}/refs/heads/${ref}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

let notes = 0;
for (const src of VENDOR.sources) {
  for (const f of src.files) {
    if (!f.upstream) { console.log(`skip  ${f.path} (generated: ${f.generated ? "see VENDOR.json" : "no upstream file"})`); continue; }
    const want = f.sha256;
    let got = null, where = "";
    if (local[src.id]) {
      const p = join(local[src.id], f.upstream);
      where = p;
      got = existsSync(p) ? sha256(readFileSync(p)) : null;
      if (got === null) { notes++; console.log(`NOTE  ${f.path}: not found upstream at ${p}`); continue; }
    } else {
      const refs = [...new Set([src.ref, "main"].filter(Boolean))];
      const seen = [];
      for (const ref of refs) {
        try { seen.push({ ref, sha: sha256(await fetchRaw(src.repository, ref, f.upstream)) }); }
        catch (e) { seen.push({ ref, error: String(e.message || e) }); }
      }
      const differ = seen.filter((s) => s.sha && s.sha !== want);
      const same = seen.filter((s) => s.sha === want);
      for (const s of seen.filter((x) => x.error)) console.log(`NOTE  ${f.path}: ${src.repository}@${s.ref} not readable (${s.error})`);
      if (differ.length) {
        notes++;
        for (const s of differ) console.log(`NOTE  newer upstream available: ${f.path} (${src.repository}@${s.ref} ${short(s.sha)}, vendored ${short(want)})`);
      } else if (same.length) console.log(`same  ${f.path} (${same.map((s) => `${src.repository}@${s.ref}`).join(", ")})`);
      else notes++;
      continue;
    }
    if (got !== want) { notes++; console.log(`NOTE  newer upstream available: ${f.path} (${where} ${short(got)}, vendored ${short(want)})`); }
    else console.log(`same  ${f.path} (${where})`);
  }
}
console.log(`${notes} note${notes === 1 ? "" : "s"}; vendored files are checked offline by tests/unit/vendor.test.mjs`);
process.exit(0);
