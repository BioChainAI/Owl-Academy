/**
 * S.P.I.R.E. Geometric Registrar
 * --------------------------------
 * Generates a user's immutable Cosmological ID from a ledger seed.
 *
 * Pipeline:
 *   ledgerSeed  → SHD-CCP 4×4×4 compression → geoVector[64]
 *   uid         → SHA-256 hash              → uidVector[64]
 *   CosmologicalID = geoVector ⊕ uidVector  (bitwise XOR blend)
 *
 * The Cosmological ID is the geometric fingerprint that signs the user's
 * Codex (tomes, artifacts, XP). Once registered, it is immutable.
 */

import { getDocument, setDocument } from "./firebase/firestore.js";

const LATTICE_SPACES = {
  E8:  { name: "E8 Lie Algebra",   modulus: 240, phi: 1.618033988749 },
  R8:  { name: "ℝ⁸ Octonionic",     modulus: 128, phi: 2.618033988749 },
  R24: { name: "ℝ²⁴ Leech Grid",    modulus: 196560, phi: 4.236067977499 }
};

const LOCAL_KEY = "owlAcademy_codex";

// ─── Hashing ──────────────────────────────────────────────────────────

async function sha256Bytes(input) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(buf); // 32 bytes
}

// Expand 32 bytes → 64 bytes by mirroring the holographic inverse:
// every byte is paired with its bitwise complement.
function expandToHolographicInverse(bytes32) {
  const out = new Uint8Array(64);
  for (let i = 0; i < 32; i++) {
    out[i] = bytes32[i];
    out[i + 32] = 0xff ^ bytes32[i];
  }
  return out;
}

// ─── SHD-CCP 4×4×4 Compression ────────────────────────────────────────

/**
 * Projects 64 bytes onto a 4×4×4 cubic voxel grid, folds along the three
 * primary axes with a φ-scaled rotation, and emits a deterministic 64-bit
 * geometric vector plus hyperbolic (x, y, z) coordinates.
 */
function shdccpCompress(bytes64, latticeKey) {
  const lattice = LATTICE_SPACES[latticeKey] || LATTICE_SPACES.E8;
  const phi = lattice.phi;
  const cube = [];

  for (let x = 0; x < 4; x++) {
    cube[x] = [];
    for (let y = 0; y < 4; y++) {
      cube[x][y] = [];
      for (let z = 0; z < 4; z++) {
        const idx = x * 16 + y * 4 + z;
        cube[x][y][z] = bytes64[idx];
      }
    }
  }

  // Fold along the three axes with φ-scaling
  let acc = 0n;
  let cx = 0, cy = 0, cz = 0;
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 4; y++) {
      for (let z = 0; z < 4; z++) {
        const v = cube[x][y][z];
        const weight = (x + 1) * (y + 1) * (z + 1);
        acc = (acc * 31n + BigInt(v * weight)) & 0xffffffffffffffffn;
        cx += v * Math.cos((x * phi) % (2 * Math.PI));
        cy += v * Math.sin((y * phi) % (2 * Math.PI));
        cz += v * Math.cos((z * phi * phi) % (2 * Math.PI));
      }
    }
  }

  // Normalize coordinates to a unit hyperbolic neighborhood
  const norm = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
  const coords = {
    x: +(cx / norm * phi).toFixed(6),
    y: +(cy / norm * phi).toFixed(6),
    z: +(cz / norm * phi).toFixed(6)
  };

  // Topological entropy estimate (bits)
  const entropy = +(Math.log2(Number(acc & 0xffffffn) + 1) * phi / 24).toFixed(4);

  return {
    vector64: acc.toString(16).toUpperCase().padStart(16, "0"),
    coords,
    entropy,
    lattice: latticeKey
  };
}

// ─── XOR Blend ────────────────────────────────────────────────────────

function xorBlendHex(hexA, hexB) {
  const a = BigInt("0x" + hexA);
  const b = BigInt("0x" + hexB);
  return (a ^ b).toString(16).toUpperCase().padStart(16, "0");
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Compute a geometric vector from a ledger seed alone.
 * Used for live preview before commit.
 */
export async function computeGeoVector(ledgerSeed, latticeKey = "E8") {
  const trimmed = (ledgerSeed || "").trim();
  if (!trimmed) throw new Error("Ledger seed is empty");
  const hash32 = await sha256Bytes(trimmed);
  const bytes64 = expandToHolographicInverse(hash32);
  return shdccpCompress(bytes64, latticeKey);
}

/**
 * Compute the final Cosmological ID by XOR-blending the seed's geo vector
 * with the user's Firebase UID hash.
 */
export async function computeCosmologicalId(ledgerSeed, uid, latticeKey = "E8") {
  const geo = await computeGeoVector(ledgerSeed, latticeKey);
  const uidHash = await sha256Bytes(uid);
  // Take first 8 bytes of UID hash as a 64-bit hex string
  let uidHex = "";
  for (let i = 0; i < 8; i++) uidHex += uidHash[i].toString(16).padStart(2, "0");
  const cosmologicalId = "0x" + xorBlendHex(geo.vector64, uidHex.toUpperCase());
  return { cosmologicalId, geoVector: geo };
}

/**
 * Write the registrar to Firestore. Refuses to overwrite if already present.
 * The ledger seed is immutable once committed.
 */
export async function writeRegistrar(uid, ledgerSeed, latticeKey = "E8") {
  const existing = await getDocument(`users/${uid}/registrar/main`);
  if (existing && existing.cosmologicalId) {
    throw new Error("Registrar already sealed. Cosmological ID cannot be regenerated.");
  }
  const result = await computeCosmologicalId(ledgerSeed, uid, latticeKey);
  const payload = {
    ledgerSeed,
    cosmologicalId: result.cosmologicalId,
    geoVector: result.geoVector.vector64,
    coords: result.geoVector.coords,
    entropy: result.geoVector.entropy,
    latticeSpace: latticeKey,
    registeredAt: new Date().toISOString(),
    sealed: true
  };
  await setDocument(`users/${uid}/registrar/main`, payload);
  saveLocalBackup(uid, payload, null);
  return payload;
}

/**
 * Read the registrar from Firestore.
 */
export async function readRegistrar(uid) {
  return getDocument(`users/${uid}/registrar/main`);
}

// ─── Local Backup ─────────────────────────────────────────────────────

export function saveLocalBackup(uid, registrar, codex) {
  if (!registrar) return;
  const payload = {
    version: 1,
    uid,
    cosmologicalId: registrar.cosmologicalId,
    ledgerSeed: registrar.ledgerSeed,
    coords: registrar.coords,
    latticeSpace: registrar.latticeSpace,
    registeredAt: registrar.registeredAt,
    codex: codex || { rank: "Initiate", xp: 0, tomes: {}, artifacts: [] },
    syncedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("[Registrar] localStorage write failed:", err);
  }
  return payload;
}

export function readLocalBackup() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function exportLocalBackup() {
  const backup = readLocalBackup();
  if (!backup) return null;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `owl-academy-codex-${backup.cosmologicalId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return backup;
}

// ─── Sigil Renderer ───────────────────────────────────────────────────

/**
 * Render the Cosmological ID as a procedural SVG sigil.
 * The sigil is determined entirely by the hex ID, so identical IDs
 * always produce identical sigils.
 */
export function renderSigil(cosmologicalId, size = 200) {
  const hex = cosmologicalId.replace(/^0x/, "").padStart(16, "0");
  const nodes = [];
  const cx = size / 2, cy = size / 2;
  const ringR = size * 0.42;

  for (let i = 0; i < 8; i++) {
    const byte = parseInt(hex.substr(i * 2, 2), 16);
    const angle = (byte / 256) * Math.PI * 2;
    const radius = ringR * (0.4 + (byte % 16) / 32);
    nodes.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      r: 2 + (byte % 5)
    });
  }

  let paths = "";
  // Connect each node to every other to form the sigil weave
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      paths += `<line x1="${nodes[i].x}" y1="${nodes[i].y}" x2="${nodes[j].x}" y2="${nodes[j].y}" stroke="#D4AF37" stroke-width="0.4" opacity="0.35"/>`;
    }
  }
  const dots = nodes.map(n =>
    `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="#FFF8DC" stroke="#D4AF37" stroke-width="0.8"/>`
  ).join("");

  return `
    <svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" class="sigil-svg">
      <circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="#D4AF37" stroke-width="0.6" opacity="0.5"/>
      <circle cx="${cx}" cy="${cy}" r="${ringR * 0.7}" fill="none" stroke="#00d4ff" stroke-width="0.4" stroke-dasharray="2 3" opacity="0.4"/>
      ${paths}
      ${dots}
      <circle cx="${cx}" cy="${cy}" r="3" fill="#D4AF37"/>
    </svg>
  `;
}

export { LATTICE_SPACES };
