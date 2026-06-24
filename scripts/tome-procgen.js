/**
 * Tome ProcGen — headless, dependency-free procedural engine for the 145-tome canon.
 * ----------------------------------------------------------------------------
 * "Store the seed, not the asset." A tiny authored record deterministically
 * generates a 64-bit vector, an SHD-CCP packet, constellation indices, and a
 * 3-tier SVG visual. 100% pure: no Firebase, no DOM, no Math.random / Date.
 * BigInt-free (32-bit Math.imul hash) so it ports verbatim to C#/Python/C++.
 *
 * This is the single contract shared by:
 *   • the Sigil Generator admin tool (visuals),
 *   • canon.schema.json (validation),
 *   • major-tome.js (immutable canon inscription).
 *
 * NOTE: the tome-visual hash here is the fast imul hash used by the generator.
 * It is intentionally distinct from the SHA-256 Cosmological-ID hash in
 * spire-registrar.js — two deterministic engines, two purposes (identity vs.
 * tome visuals). Bump GEN_VERSION to intentionally re-skin all 145.
 */

export const GEN_VERSION   = "owl-procgen/2";
export const CANON_FORMAT  = "owl-canon/1";

export const DEPTS    = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
// Center → rim ordering for globalIndex (Dept I innermost, Dept X outer rim).
export const DEPT_ORDER = DEPTS;
export const MANIFOLDS = ["clifford", "s3", "trefoil"];
export const LATTICES  = ["E8", "R8", "R24"];
export const TIERS     = ["ACOLYTE", "INSTRUCTOR", "ARCHON"];
export const STATUSES  = ["active", "manuscript", "reference", "sealed"];

export const DEPT_PALETTE = {
  "I": "#D4AF37", "II": "#a855f7", "III": "#3b82f6", "IV": "#f43f5e", "V": "#10b981",
  "VI": "#f59e0b", "VII": "#a855f7", "VIII": "#14b8a6", "IX": "#3b82f6", "X": "#00ff88",
};
export const HEX_NODE_COLORS = ["#ff0000","#00ff00","#0000ff","#ffff00","#00ffff","#ff00ff","#ff8000","#0080ff","#80ff00","#8000ff","#ff0080","#00ff80"];
export const CUBE_AXIS_LABELS = ["+X Axis","-X Axis","+Y Axis","-Y Axis","+Z Axis","-Z Axis"];
const CUBE_AXES = [{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:-1,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}];
const LATTICE_VECTORS = [
  {x:1,y:1,z:0},{x:-1,y:1,z:0},{x:1,y:-1,z:0},{x:-1,y:-1,z:0},
  {x:1,y:0,z:1},{x:-1,y:0,z:1},{x:1,y:0,z:-1},{x:-1,y:0,z:-1},
  {x:0,y:1,z:1},{x:0,y:-1,z:1},{x:0,y:1,z:-1},{x:0,y:-1,z:-1},
].map(v => { const l = Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z); return {x:v.x/l,y:v.y/l,z:v.z/l}; });

// ─── Pure procedural core (ports verbatim to other languages) ──────────────────

/** 1. String → deterministic 64-bit hex (xmur3-style, BigInt-free). */
export function generateDeterministicVector64(seed) {
  let h1 = 0xdeadbeef ^ seed.length, h2 = 0x41c6ce57 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const toHex = (n) => (n >>> 0).toString(16).padStart(8, "0").toUpperCase();
  return toHex(h1) + toHex(h2);
}

/** 2. Split the 64-bit vector into a quaternion + 5 SHD-CCP metadata bands. */
export function extractSHDCCP(vector64) {
  const hi = parseInt(vector64.slice(0, 8), 16);
  const lo = parseInt(vector64.slice(8, 16), 16);
  const norm = (v) => (v / 255.0) * 2.0 - 1.0;
  return {
    quat: { w: norm((hi >>> 24) & 0xFF), x: norm((hi >>> 16) & 0xFF), y: norm((hi >>> 8) & 0xFF), z: norm(hi & 0xFF) },
    freq: lo & 0x1F, spin: (lo >>> 5) & 0x7, amp: (lo >>> 8) & 0xF, struct: (lo >>> 12) & 0xF, payload: (lo >>> 16) & 0xFFFF,
  };
}

/** 3. Rotate a vector by a quaternion. */
export function applyQuaternion(v, q) {
  const ix = q.w*v.x + q.y*v.z - q.z*v.y, iy = q.w*v.y + q.z*v.x - q.x*v.z,
        iz = q.w*v.z + q.x*v.y - q.y*v.x, iw = -q.x*v.x - q.y*v.y - q.z*v.z;
  return {
    x: ix*q.w + iw*-q.x + iy*-q.z - iz*-q.y,
    y: iy*q.w + iw*-q.y + iz*-q.x - ix*-q.z,
    z: iz*q.w + iw*-q.z + ix*-q.y - iy*-q.x,
  };
}

/** 4. Constellation placement: which hex-zone (1-12) and cube-ring (1-6). */
export function calculateSHDCCPIndices(shdPacket) {
  const q = shdPacket.quat;
  const len = Math.sqrt(q.x**2 + q.y**2 + q.z**2);
  const spinAxis = len > 0.0001 ? { x: q.x/len, y: q.y/len, z: q.z/len } : { x: 0, y: 1, z: 0 };
  const qLen = Math.sqrt(q.w**2 + q.x**2 + q.y**2 + q.z**2) || 1;
  const qNorm = { w: q.w/qLen, x: q.x/qLen, y: q.y/qLen, z: q.z/qLen };
  const dir = applyQuaternion(spinAxis, qNorm);
  let maxH = -Infinity, activeHexIndex = -1;
  LATTICE_VECTORS.forEach((v, i) => { const d = dir.x*v.x + dir.y*v.y + dir.z*v.z; if (d > maxH) { maxH = d; activeHexIndex = i; } });
  let maxS = -Infinity, activeSquareIndex = -1;
  CUBE_AXES.forEach((v, i) => { const d = dir.x*v.x + dir.y*v.y + dir.z*v.z; if (d > maxS) { maxS = d; activeSquareIndex = i; } });
  return { activeHexIndex, activeSquareIndex };
}

/** 5. d → (x,y) on a discrete Hilbert curve of order n. */
export function hilbertD2XY(n, d) {
  let x = 0, y = 0, t = d;
  for (let s = 1; s < n; s *= 2) {
    const rx = 1 & Math.floor(t / 2);
    const ry = 1 & (t ^ rx);
    if (ry === 0) { if (rx === 1) { x = s-1-x; y = s-1-y; } const tmp = x; x = y; y = tmp; }
    x += s * rx; y += s * ry; t = Math.floor(t / 4);
  }
  return { x, y };
}

// ─── Seed + derivation (the contract) ──────────────────────────────────────────

const pad2 = (n) => String(n ?? 0).padStart(2, "0");

/** The canonical seed string — curriculum position IS the seed. */
export function buildSeed(record) {
  if (record.seedOverride && String(record.seedOverride).trim()) return String(record.seedOverride);
  return `OWL-TOME/1|${record.dept}|${record.artifact}|${pad2(record.clusterIndex)}|${record.canonId}`;
}

/** Full derivation from an authored record (never stored; regenerated everywhere). */
export function deriveTome(record) {
  const seed = buildSeed(record);
  const vector64 = generateDeterministicVector64(seed);
  const shdPacket = extractSHDCCP(vector64);
  const idx = calculateSHDCCPIndices(shdPacket);
  const baseColor = DEPT_PALETTE[record.dept] || "#888888";
  const accentHue = Math.round((parseInt(vector64.slice(0, 4), 16) / 0xFFFF) * 360);
  return { seed, vector64, shdPacket, ...idx, baseColor, accentHue, accentColor: `hsl(${accentHue}, 80%, 60%)` };
}

/** Center→rim golden-angle seat for a constellation overview (bonus map helper). */
export function goldenSpiralSeat(globalIndex, total = 145, radius = 1) {
  const GA = Math.PI * (3 - Math.sqrt(5));          // golden angle
  const i = Math.max(0, (globalIndex || 1) - 1);
  const r = radius * Math.sqrt((i + 0.5) / total);  // I at center, X at rim
  const theta = i * GA;
  return { x: r * Math.cos(theta), y: r * Math.sin(theta), r, theta };
}

/** Assign globalIndex 1..N by the canonical dept → artifact → clusterIndex order. */
export function assignGlobalIndices(records) {
  const sorted = [...records].sort((a, b) =>
    (DEPT_ORDER.indexOf(a.dept) - DEPT_ORDER.indexOf(b.dept)) ||
    String(a.artifact).localeCompare(String(b.artifact)) ||
    ((a.clusterIndex ?? 0) - (b.clusterIndex ?? 0)) ||
    String(a.canonId).localeCompare(String(b.canonId))
  );
  return sorted.map((r, i) => ({ ...r, globalIndex: i + 1 }));
}

// ─── Validation (dependency-free headless validator; mirrors canon.schema.json) ──

const reCanon = /^dept-(I|II|III|IV|V|VI|VII|VIII|IX|X)\/[a-z0-9][a-z0-9-]*$/;

export function validateRecord(r, i = null) {
  const e = [], at = i == null ? "" : `[${i}] `;
  if (!r || typeof r !== "object") return [`${at}not an object`];
  if (!reCanon.test(r.canonId || "")) e.push(`${at}canonId must match dept-<I..X>/<kebab> (got ${JSON.stringify(r.canonId)})`);
  if (!DEPTS.includes(r.dept)) e.push(`${at}dept must be one of ${DEPTS.join("/")}`);
  if (r.canonId && r.dept && !String(r.canonId).startsWith(`dept-${r.dept}/`)) e.push(`${at}canonId dept prefix must equal dept (${r.dept})`);
  if (!Number.isInteger(r.globalIndex) || r.globalIndex < 1 || r.globalIndex > 145) e.push(`${at}globalIndex must be an integer 1..145`);
  if (!r.title) e.push(`${at}title required`);
  if (!r.artifact) e.push(`${at}artifact required`);
  if (!Number.isInteger(r.clusterIndex) || r.clusterIndex < 0) e.push(`${at}clusterIndex must be a non-negative integer`);
  if (!TIERS.includes(r.requiredTier)) e.push(`${at}requiredTier must be one of ${TIERS.join("/")}`);
  if (!STATUSES.includes(r.status)) e.push(`${at}status must be one of ${STATUSES.join("/")}`);
  if (!LATTICES.includes(r.lattice)) e.push(`${at}lattice must be one of ${LATTICES.join("/")}`);
  if (!MANIFOLDS.includes(r.manifold)) e.push(`${at}manifold must be one of ${MANIFOLDS.join("/")}`);
  if (r.prereqs != null && !Array.isArray(r.prereqs)) e.push(`${at}prereqs must be an array`);
  if (r.seedOverride != null && typeof r.seedOverride !== "string") e.push(`${at}seedOverride must be a string or null`);
  return e;
}

export function validateManifest(manifest) {
  const errors = [], warnings = [];
  if (!manifest || typeof manifest !== "object") return { ok: false, errors: ["manifest not an object"], warnings, count: 0 };
  if (manifest.format !== CANON_FORMAT) errors.push(`format must be "${CANON_FORMAT}"`);
  if (manifest.genVersion !== GEN_VERSION) warnings.push(`genVersion is ${JSON.stringify(manifest.genVersion)}; engine is ${GEN_VERSION}`);
  const tomes = Array.isArray(manifest.tomes) ? manifest.tomes : null;
  if (!tomes) return { ok: false, errors: [...errors, "tomes must be an array"], warnings, count: 0 };
  if (tomes.length > 145) errors.push(`too many tomes: ${tomes.length} (max 145)`);
  if (tomes.length < 145) warnings.push(`partial canon: ${tomes.length}/145 inscribed`);
  const seenId = new Set(), seenIdx = new Set();
  tomes.forEach((r, i) => {
    validateRecord(r, i).forEach((m) => errors.push(m));
    if (r && r.canonId) { if (seenId.has(r.canonId)) errors.push(`[${i}] duplicate canonId ${r.canonId}`); seenId.add(r.canonId); }
    if (r && r.globalIndex != null) { if (seenIdx.has(r.globalIndex)) errors.push(`[${i}] duplicate globalIndex ${r.globalIndex}`); seenIdx.add(r.globalIndex); }
  });
  return { ok: errors.length === 0, errors, warnings, count: tomes.length };
}

// ─── Vanilla 3-tier SVG renderer (no React — drop straight into the HTML consoles) ─

const f = (n) => Math.round(n * 100) / 100;

function hilbertLayer(globalIndex, color) {
  const g = 16, cell = 200 / g, clamped = Math.min(255, Math.max(0, (globalIndex || 1) - 1));
  let dDim = "", dActive = "";
  for (let i = 0; i < g * g - 1; i++) {
    const p1 = hilbertD2XY(g, i), p2 = hilbertD2XY(g, i + 1);
    const x1 = p1.x*cell+cell/2, y1 = p1.y*cell+cell/2, x2 = p2.x*cell+cell/2, y2 = p2.y*cell+cell/2;
    dDim += `M${f(x1)},${f(y1)} L${f(x2)},${f(y2)} `;
    if (i < clamped) dActive += `M${f(x1)},${f(y1)} L${f(x2)},${f(y2)} `;
  }
  const s = hilbertD2XY(g, clamped), sx = s.x*cell+cell/2, sy = s.y*cell+cell/2;
  return `<g><path d="${dDim}" stroke="#374151" stroke-width="0.5" fill="none" opacity="0.3"/>`
    + `<path d="${dActive}" stroke="${color}" stroke-width="1.2" fill="none" opacity="0.6"/>`
    + `<circle cx="${f(sx)}" cy="${f(sy)}" r="3" fill="${color}"/>`
    + `<circle cx="${f(sx)}" cy="${f(sy)}" r="6" fill="none" stroke="${color}" opacity="0.5"/></g>`;
}
function manifoldLayer(struct, spin, amp, color) {
  const n = (struct % 12) + 3, k = (spin % 5) + 2, tiers = (amp % 4) + 1, maxR = 90; let g = "";
  for (let layer = 0; layer < tiers; layer++) {
    const radius = maxR - layer * 15, c = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI - Math.PI/2; c.push({ x: 100 + radius*Math.cos(a), y: 100 + radius*Math.sin(a) }); }
    let d = ""; for (let i = 0; i < n; i++) { const s = c[i], e = c[(i*k)%n]; d += `M${f(s.x)},${f(s.y)} L${f(e.x)},${f(e.y)} `; }
    g += `<path d="${d}" stroke="${color}" stroke-width="${layer===0?0.8:0.4}" fill="none" opacity="${layer===0?0.6:0.3}"/>`;
  }
  return `<g>${g}</g>`;
}
function sigilLayer(vector64, dept, color) {
  const bytes = []; for (let i = 0; i < 16; i += 2) bytes.push(parseInt(vector64.slice(i, i+2), 16));
  const di = Math.max(0, DEPTS.indexOf(dept));
  const nodes = bytes.map((b, i) => { const a = (i/8)*Math.PI*2, r = 15 + (b % (10 + di*2)); return { x: 100 + r*Math.cos(a), y: 100 + r*Math.sin(a) }; });
  const curved = di % 2 !== 0; let p = "";
  bytes.forEach((b, i) => {
    const t = (i + (b % 3) + 2) % 8, n1 = nodes[i], n2 = nodes[t];
    if (curved) { const cx = 100 + (n1.x-100)*0.5, cy = 100 + (n1.y-100)*0.5;
      p += `<path d="M${f(n1.x)},${f(n1.y)} Q${f(cx)},${f(cy)} ${f(n2.x)},${f(n2.y)}" stroke="${color}" stroke-width="1.5" fill="none" opacity="0.8"/>`; }
    else p += `<path d="M${f(n1.x)},${f(n1.y)} L${f(n2.x)},${f(n2.y)}" stroke="${color}" stroke-width="1.5" fill="none" opacity="0.8"/>`;
  });
  const dots = nodes.map((nd, i) => `<circle cx="${f(nd.x)}" cy="${f(nd.y)}" r="${bytes[i]%3+1}" fill="#FFF"/>`).join("");
  return `<g><circle cx="100" cy="100" r="${40+di}" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.4" stroke-dasharray="2 4"/>${p}${dots}<circle cx="100" cy="100" r="3" fill="#FFF"/></g>`;
}

/** The full 3-tier tome visual as a standalone SVG string. */
export function renderTomeSVG(record, size = 200) {
  const d = deriveTome(record);
  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`
    + hilbertLayer(record.globalIndex, d.baseColor)
    + manifoldLayer(d.shdPacket.struct, d.shdPacket.spin, d.shdPacket.amp, "#a855f7")
    + sigilLayer(d.vector64, record.dept, d.accentColor)
    + `</svg>`;
}
