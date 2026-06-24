#!/usr/bin/env node
/**
 * Validate canon/canon.manifest.json for CI.
 * ---------------------------------------------------------------------------
 * Uses ajv to validate against canon.schema.json when available; otherwise
 * runs built-in structural checks so it still produces a verdict offline.
 * Adds cross-field checks JSON Schema can't express (uniqueness, dept/canonId
 * agreement, ≤145 / completeness). Exits non-zero on any error.
 *
 *   node tools/validate-canon.mjs
 *   # CI: npm i --no-save ajv ajv-formats && node tools/validate-canon.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../canon/", import.meta.url));
const schema = JSON.parse(readFileSync(dir + "canon.schema.json", "utf8"));
const manifest = JSON.parse(readFileSync(dir + "canon.manifest.json", "utf8"));

const errors = [], warnings = [];
let mode = "built-in checks";

try {
  const { default: Ajv } = await import("ajv");
  let addFormats = null;
  try { ({ default: addFormats } = await import("ajv-formats")); } catch { /* optional */ }
  const ajv = new Ajv({ allErrors: true, strict: false });
  if (addFormats) addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(manifest)) (validate.errors || []).forEach((e) => errors.push(`${e.instancePath || "/"} ${e.message}`));
  mode = "ajv schema-validated";
} catch {
  warnings.push("ajv not installed — built-in structural checks only (CI installs ajv for full schema validation).");
  const DEPTS = ["I","II","III","IV","V","VI","VII","VIII","IX","X"], TIERS = ["ACOLYTE","INSTRUCTOR","ARCHON"];
  const STATUS = ["active","manuscript","reference","sealed"], LAT = ["E8","R8","R24"], MAN = ["clifford","s3","trefoil"];
  const reCanon = /^dept-(I|II|III|IV|V|VI|VII|VIII|IX|X)\/[a-z0-9][a-z0-9-]*$/;
  const reArt = /^artifact-(I|II|III|IV|V|VI|VII|VIII|IX|X)-[0-9]+$/;
  if (manifest.format !== "owl-canon/1") errors.push("format must be owl-canon/1");
  (manifest.tomes || []).forEach((r, i) => {
    const at = `[${i}] `;
    if (!reCanon.test(r.canonId || "")) errors.push(at + "bad canonId " + JSON.stringify(r.canonId));
    if (!DEPTS.includes(r.dept)) errors.push(at + "bad dept");
    if (!reArt.test(r.artifact || "")) errors.push(at + "bad artifact");
    if (!(Number.isInteger(r.globalIndex) && r.globalIndex >= 1 && r.globalIndex <= 145)) errors.push(at + "bad globalIndex");
    if (!(Number.isInteger(r.clusterIndex) && r.clusterIndex >= 0 && r.clusterIndex <= 15)) errors.push(at + "bad clusterIndex");
    if (!r.title) errors.push(at + "missing title");
    if (!TIERS.includes(r.requiredTier)) errors.push(at + "bad requiredTier");
    if (!STATUS.includes(r.status)) errors.push(at + "bad status");
    if (!LAT.includes(r.lattice)) errors.push(at + "bad lattice");
    if (!MAN.includes(r.manifold)) errors.push(at + "bad manifold");
  });
}

// Cross-field checks (beyond JSON Schema)
const tomes = manifest.tomes || [];
const ids = new Set(), idx = new Set();
tomes.forEach((r, i) => {
  if (ids.has(r.canonId)) errors.push(`duplicate canonId ${r.canonId}`); ids.add(r.canonId);
  if (idx.has(r.globalIndex)) errors.push(`duplicate globalIndex ${r.globalIndex}`); idx.add(r.globalIndex);
  if (r.canonId && r.dept && !String(r.canonId).startsWith(`dept-${r.dept}/`)) errors.push(`[${i}] canonId/dept mismatch ${r.canonId}`);
});
if (tomes.length > 145) errors.push(`too many tomes: ${tomes.length} (max 145)`);
if (tomes.length < 145) warnings.push(`partial canon: ${tomes.length}/145`);

console.log(`canon: ${tomes.length} tomes — ${mode}`);
warnings.forEach((w) => console.log("  ⚠ " + w));
if (errors.length) {
  console.error(`✗ ${errors.length} error(s):`);
  errors.slice(0, 40).forEach((e) => console.error("  - " + e));
  process.exit(1);
}
console.log("✓ canon.manifest.json valid");
