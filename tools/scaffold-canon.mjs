#!/usr/bin/env node
/**
 * Scaffold the canon manifest to a full 145 records.
 * ---------------------------------------------------------------------------
 * Idempotent: preserves existing records, only adds missing (dept, artifact,
 * clusterIndex) slots with STABLE placeholder canonIds (fill in titles only —
 * the canonId is the immutable seed anchor). Reassigns globalIndex by the
 * center→rim order (Dept I innermost … Dept X outer rim).
 *
 * Structure: Depts I–IX = 9 tomes each (1 artifact); Dept X = 64 (4×16) = 145.
 *
 *   node tools/scaffold-canon.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PATH = fileURLToPath(new URL("../canon/canon.manifest.json", import.meta.url));
const m = JSON.parse(readFileSync(PATH, "utf8"));
const existing = m.tomes;
const has = (dept, artifact, ci) => existing.some((t) => t.dept === dept && t.artifact === artifact && t.clusterIndex === ci);

const LOWER = { I:"i", II:"ii", III:"iii", IV:"iv", V:"v", VI:"vi", VII:"vii", VIII:"viii", IX:"ix", X:"x" };
const THEME = {
  I:"Sacred Geometry", II:"Cryptographic Sigils", III:"Celestial Kinematics", IV:"Hyperbolic Systems",
  V:"Fractal Processing", VI:"Seed Protocol", VII:"Human Consciousness", VIII:"Soul-Mind Projection", IX:"AI-Human Integration",
};
const CYC = ["clifford", "s3", "trefoil"];
const ORDER = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];
const pad2 = (n) => String(n).padStart(2, "0");
const X_ARTIFACTS = [["transcription","Transcription"],["translation","Translation"],["replication","Replication"],["expression","Expression"]];

const added = [];

// Depts I–IX → 9 tomes each (artifact-<D>-1, clusterIndex 0..8)
for (const dept of ["I","II","III","IV","V","VI","VII","VIII","IX"]) {
  const art = `artifact-${dept}-1`;
  const sealed = ["VII","VIII","IX"].includes(dept);
  for (let ci = 0; ci < 9; ci++) {
    if (has(dept, art, ci)) continue;
    const n = ci + 1;
    added.push({
      canonId: `dept-${dept}/${LOWER[dept]}-${pad2(n)}`, globalIndex: 0,
      title: `${THEME[dept]} Tome ${n}`, dept, artifact: art, clusterIndex: ci,
      requiredTier: "ACOLYTE", status: sealed ? "sealed" : "manuscript",
      prereqs: sealed ? ["artifact-X-1","artifact-X-2","artifact-X-3","artifact-X-4"] : [],
      contentPath: null, lattice: sealed ? "R8" : "E8", manifold: CYC[ci % 3], seedOverride: null,
    });
  }
}

// Dept X → 4 artifacts × 16 = 64 (clusterIndex 0..15 within each)
X_ARTIFACTS.forEach(([slug, name], ai) => {
  const art = `artifact-X-${ai + 1}`;
  for (let ci = 0; ci < 16; ci++) {
    if (has("X", art, ci)) continue;
    const n = ci + 1;
    added.push({
      canonId: `dept-X/${slug}-${pad2(n)}`, globalIndex: 0,
      title: `${name} Tome ${n}`, dept: "X", artifact: art, clusterIndex: ci,
      requiredTier: "ACOLYTE", status: "manuscript", prereqs: [],
      contentPath: null, lattice: "R24", manifold: CYC[ci % 3], seedOverride: null,
    });
  }
});

const all = existing.concat(added);
all.sort((a, b) =>
  (ORDER.indexOf(a.dept) - ORDER.indexOf(b.dept)) ||
  String(a.artifact).localeCompare(String(b.artifact)) ||
  ((a.clusterIndex ?? 0) - (b.clusterIndex ?? 0)) ||
  String(a.canonId).localeCompare(String(b.canonId))
);
all.forEach((r, i) => { r.globalIndex = i + 1; });

m.tomes = all;
m._note = "Full canon (145). Depts I–IX = 9 tomes each (1 artifact); Dept X = 64 (4 artifacts of 16). Foundation titles from TOME_SYSTEM.md; placeholder canonIds are STABLE seed anchors — fill in titles only. globalIndex = center→rim (Dept I innermost, Dept X outer rim).";
writeFileSync(PATH, JSON.stringify(m, null, 2) + "\n");
console.log(`canon: ${all.length} tomes total (added ${added.length}). Per-dept:`,
  ORDER.map((d) => `${d}:${all.filter((t) => t.dept === d).length}`).join(" "));
