// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ebayednoob
//
// The D7 measurement (RFC 07 section 8.7): the shdccp/2 weaves of seeded shards, and Math.hypot on seeded
// four-argument inputs, computed in Chromium, Firefox and WebKit (Playwright) and compared with Node (V8), whose
// Math.hypot RFC 07 pins as hypotV8. Writes a JSON report with the mismatch rate per engine.
//
// CI only: .github/workflows/weave-engines.yml runs it by hand (workflow_dispatch) after installing the browsers.
//
//   node tests/engines/weave-engines.mjs [--shards 1000] [--hypot 10000] [--seed 20261108] [--out weave-engines.json]
//                                        [--engines chromium,firefox,webkit] [--node-only]
//
// --node-only computes the Node side and writes it without starting a browser (Playwright is not imported).
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { shards, hypotInputs, f64hex } from "./shards.mjs";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const int = (name, dflt, max) => {
  const v = Number(opt(name, dflt));
  if (!Number.isInteger(v) || v < 0 || v > max) throw new Error(`--${name} must be an integer 0..${max}`);
  return v;
};
const N = int("shards", 1000, 100000), H = int("hypot", 10000, 1000000), SEED = int("seed", 20261108, 2 ** 31 - 1);
const OUT = opt("out", "weave-engines.json");
const ENGINES = String(opt("engines", "chromium,firefox,webkit")).split(",").filter(Boolean);
for (const e of ENGINES) if (!["chromium", "firefox", "webkit"].includes(e)) throw new Error(`unknown engine ${e}`);

const { chainWeaves } = await import(pathToFileURL(join(ROOT, "scripts/biomesh-core.js")).href);
const nodeWeaves = shards(SEED, N).map((chunks) => chainWeaves(chunks));
const nodeHypot = hypotInputs(SEED, H).map((a) => f64hex(Math.hypot(...a)));

const report = {
  format: "owl-weave-engines/1",
  generatedAt: new Date().toISOString(),
  what: "shdccp/2 weaves (chainWeaves, scripts/biomesh-core.js) of seeded shards and Math.hypot on seeded four-argument inputs, per engine, against Node (V8); RFC 07 section 8.7, decision D7",
  seed: SEED, shards: N, hypotInputs: H,
  node: { version: process.version, v8: process.versions.v8 },
  engines: {},
};

// Static files from the repository root, for the browsers (127.0.0.1 only, GET only, no directory listings).
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json" };
function serve() {
  const server = createServer(async (req, res) => {
    try {
      const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
      const file = resolve(ROOT, path);
      if (req.method !== "GET" || !(file + sep).startsWith(ROOT + sep) || !TYPES[extname(file)]) { res.writeHead(404).end(); return; }
      res.writeHead(200, { "content-type": TYPES[extname(file)], "cache-control": "no-store" }).end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

async function measure(name, pw, base) {
  const browser = await pw[name].launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/tests/engines/weave-engines.html?seed=${SEED}&shards=${N}&hypot=${H}`);
    await page.waitForFunction(() => window.__result || window.__error, null, { timeout: 600000 });
    const err = await page.evaluate(() => window.__error || null);
    if (err) throw new Error(`${name}: ${err}`);
    const got = await page.evaluate(() => window.__result);
    const weaveMiss = [], hypotMiss = [];
    got.weaves.forEach((w, i) => {
      const want = nodeWeaves[i];
      if (w.weaveChiral !== want.weaveChiral || w.weaveMirror !== want.weaveMirror) weaveMiss.push({ shard: i, node: want, engine: w });
    });
    got.hypot.forEach((h, i) => { if (h !== nodeHypot[i]) hypotMiss.push({ input: i, node: nodeHypot[i], engine: h }); });
    return {
      browserVersion: browser.version(), userAgent: got.userAgent,
      weaveMismatches: weaveMiss.length, weaveMismatchRate: weaveMiss.length / N,
      hypotMismatches: hypotMiss.length, hypotMismatchRate: H ? hypotMiss.length / H : 0,
      weaveExamples: weaveMiss.slice(0, 20), hypotExamples: hypotMiss.slice(0, 20),
    };
  } finally { await browser.close(); }
}

if (args.includes("--node-only")) {
  report.nodeOnly = true;
  report.nodeWeavesSha = (await import("node:crypto")).createHash("sha256").update(JSON.stringify(nodeWeaves)).digest("hex");
} else {
  const pw = await import("playwright");
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const name of ENGINES) {
      report.engines[name] = await measure(name, pw, base);
      const e = report.engines[name];
      console.log(`${name} ${e.browserVersion}: weaves ${e.weaveMismatches}/${N} differ (${(100 * e.weaveMismatchRate).toFixed(2)} %), ` +
        `Math.hypot ${e.hypotMismatches}/${H} differ (${(100 * e.hypotMismatchRate).toFixed(2)} %)`);
    }
  } finally { server.close(); }
}
await writeFile(OUT, JSON.stringify(report, null, 1) + "\n");
console.log(`wrote ${OUT}`);
