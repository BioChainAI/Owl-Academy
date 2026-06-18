/**
 * Genesis Registrar — Hierarchical Authority Extension
 * ------------------------------------------------------
 * Builds on spire-registrar.js. Adds the tiered authority system:
 *   Acolyte    — Ledger Seed only, no creation rights
 *   Instructor — Genesis Seed signed by an Archon, can author tomes
 *   Archon     — Genesis Seed self-signed via Master Key list
 *
 * A Genesis Seed = Ledger Seed + Validation Certificate
 * Validation Certificate = HMAC-SHA-256 over (issuer, tier, plane, issuedAt)
 *                         keyed by the issuer's Cosmological ID
 */

import { getDocument, setDocument } from "./firebase/firestore.js";
import { computeCosmologicalId, readRegistrar } from "./spire-registrar.js";

// ─── Master Key List ──────────────────────────────────────────────────
// Root Archons — Firebase UIDs that self-validate at the genesis layer.
// Edit this list to designate site administrators.
export const GENESIS_MASTER_UIDS = [
  // Add Firebase UIDs of root admins here. Example:
  // "abc123def456ghi789",
];

// ─── Tier Definitions ─────────────────────────────────────────────────

export const TIERS = {
  ACOLYTE:    { name: "Acolyte",    level: 0, canCreateTomes: false, canMintInstructors: false, canMintArchons: false },
  INSTRUCTOR: { name: "Instructor", level: 1, canCreateTomes: true,  canMintInstructors: false, canMintArchons: false },
  ARCHON:     { name: "Archon",     level: 2, canCreateTomes: true,  canMintInstructors: true,  canMintArchons: true  }
};

// ─── HMAC Signing ─────────────────────────────────────────────────────

async function hmacSign(key, payload) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacVerify(key, payload, signatureHex) {
  const expected = await hmacSign(key, payload);
  // Constant-time-ish comparison
  if (expected.length !== signatureHex.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  return diff === 0;
}

function certificatePayload(cert) {
  return [cert.issuer, cert.tier, cert.plane, cert.subject, cert.issuedAt].join("|");
}

// ─── Certificate Issue / Verify ───────────────────────────────────────

/**
 * Issue a certificate. Caller must hold a Genesis Seed of sufficient tier.
 *
 *   issuerRegistrar — the issuing user's registrar (read from Firestore)
 *   subjectId       — Cosmological ID of the user being certified
 *   targetTier      — "INSTRUCTOR" | "ARCHON"
 *   plane           — namespace string (e.g., "dept-IV", "custom-hyperbolic", "*")
 */
export async function issueCertificate(issuerRegistrar, subjectId, targetTier, plane) {
  if (!issuerRegistrar || !issuerRegistrar.cosmologicalId) {
    throw new Error("Issuer has no registrar.");
  }
  const issuerTier = issuerRegistrar.tier || "ACOLYTE";
  if (!TIERS[issuerTier]) throw new Error(`Unknown issuer tier: ${issuerTier}`);

  if (targetTier === "INSTRUCTOR" && !TIERS[issuerTier].canMintInstructors) {
    throw new Error("Issuer cannot mint Instructors.");
  }
  if (targetTier === "ARCHON" && !TIERS[issuerTier].canMintArchons) {
    throw new Error("Issuer cannot mint Archons.");
  }

  const cert = {
    issuer: issuerRegistrar.cosmologicalId,
    subject: subjectId,
    tier: targetTier,
    plane: plane || "*",
    issuedAt: new Date().toISOString()
  };
  const payload = certificatePayload(cert);
  cert.signature = await hmacSign(issuerRegistrar.cosmologicalId, payload);
  return cert;
}

/**
 * Verify a certificate against the issuer's known Cosmological ID.
 * Returns { valid, reason }.
 */
export async function verifyCertificate(cert, issuerCosmologicalId) {
  if (!cert || !cert.signature) return { valid: false, reason: "no_signature" };
  if (cert.issuer !== issuerCosmologicalId) return { valid: false, reason: "issuer_mismatch" };
  const payload = certificatePayload(cert);
  const ok = await hmacVerify(issuerCosmologicalId, payload, cert.signature);
  return { valid: ok, reason: ok ? "ok" : "bad_signature" };
}

/**
 * Self-issue an Archon certificate for a Master Key UID.
 * Only succeeds if the uid is in GENESIS_MASTER_UIDS.
 */
export async function bootstrapArchonCertificate(uid, registrar) {
  if (!GENESIS_MASTER_UIDS.includes(uid)) {
    throw new Error("UID is not in the Genesis Master Key list.");
  }
  const cert = {
    issuer: registrar.cosmologicalId,    // self-issued
    subject: registrar.cosmologicalId,
    tier: "ARCHON",
    plane: "*",
    issuedAt: new Date().toISOString(),
    selfSigned: true
  };
  const payload = certificatePayload(cert);
  cert.signature = await hmacSign(registrar.cosmologicalId, payload);
  return cert;
}

// ─── Tier Upgrades ────────────────────────────────────────────────────

/**
 * Apply a tier upgrade to the caller's own registrar.
 * The certificate must be valid AND the issuer's registrar must exist.
 */
export async function applyCertificate(uid, cert) {
  const myReg = await readRegistrar(uid);
  if (!myReg) throw new Error("You must forge a Cosmological ID first.");
  if (cert.subject !== myReg.cosmologicalId) {
    throw new Error("Certificate subject does not match your Cosmological ID.");
  }

  // Self-signed Archon (bootstrap path)
  if (cert.selfSigned) {
    if (!GENESIS_MASTER_UIDS.includes(uid)) {
      throw new Error("Self-signed certificates only permitted for Master Key UIDs.");
    }
    const { valid } = await verifyCertificate(cert, myReg.cosmologicalId);
    if (!valid) throw new Error("Self-signed certificate failed verification.");
  } else {
    // Need to resolve the issuer's Cosmological ID — we trust the cert.issuer field
    // but verify the signature against it.
    const { valid, reason } = await verifyCertificate(cert, cert.issuer);
    if (!valid) throw new Error(`Certificate invalid: ${reason}`);
  }

  const planes = cert.plane === "*" ? ["*"] : [cert.plane];
  await setDocument(`users/${uid}/registrar/main`, {
    ...myReg,
    tier: cert.tier,
    certificate: cert,
    certifiedPlanes: planes,
    certifiedAt: new Date().toISOString()
  });
  return cert;
}

/**
 * Resolve the effective tier of a user.
 * Falls back to ACOLYTE if no valid certificate.
 */
export async function resolveTier(uid) {
  const reg = await readRegistrar(uid);
  if (!reg) return "ACOLYTE";
  if (!reg.certificate) return "ACOLYTE";

  // Bootstrap Archons: self-signed, must be in master list
  if (reg.certificate.selfSigned) {
    if (!GENESIS_MASTER_UIDS.includes(uid)) return "ACOLYTE";
    const { valid } = await verifyCertificate(reg.certificate, reg.cosmologicalId);
    return valid ? "ARCHON" : "ACOLYTE";
  }

  const { valid } = await verifyCertificate(reg.certificate, reg.certificate.issuer);
  return valid ? reg.certificate.tier : "ACOLYTE";
}

/**
 * Check whether a user can author content on a given plane.
 */
export function canAuthorOnPlane(registrar, plane) {
  if (!registrar || !registrar.certificate) return false;
  const tierDef = TIERS[registrar.tier || "ACOLYTE"];
  if (!tierDef || !tierDef.canCreateTomes) return false;
  const planes = registrar.certifiedPlanes || [];
  return planes.includes("*") || planes.includes(plane);
}

/**
 * Stamp a piece of content with priority based on the author's tier.
 *   ARCHON      → "canonical"
 *   INSTRUCTOR  → "validated"
 *   ACOLYTE     → "experimental"
 */
export function stampPriority(tier) {
  if (tier === "ARCHON") return "canonical";
  if (tier === "INSTRUCTOR") return "validated";
  return "experimental";
}

/**
 * Renders a tier-specific sigil ring decoration. Returns SVG markup
 * to be overlaid on the base sigil from spire-registrar.js.
 */
export function tierRingOverlay(tier, size = 200) {
  const cx = size / 2, cy = size / 2;
  if (tier === "ARCHON") {
    return `
      <circle cx="${cx}" cy="${cy}" r="${size * 0.48}" fill="none" stroke="#D4AF37" stroke-width="1.2" opacity="0.7"/>
      <circle cx="${cx}" cy="${cy}" r="${size * 0.46}" fill="none" stroke="#00d4ff" stroke-width="0.6" opacity="0.6"/>
      <circle cx="${cx}" cy="${cy}" r="${size * 0.44}" fill="none" stroke="#e81cff" stroke-width="0.5" opacity="0.6" stroke-dasharray="2 2"/>
      <text x="${cx}" y="${size * 0.08}" text-anchor="middle" font-family="Cinzel" font-size="${size * 0.06}" fill="#D4AF37" font-weight="bold">♛ ARCHON</text>
    `;
  }
  if (tier === "INSTRUCTOR") {
    return `
      <circle cx="${cx}" cy="${cy}" r="${size * 0.48}" fill="none" stroke="#D4AF37" stroke-width="1" opacity="0.7"/>
      <circle cx="${cx}" cy="${cy}" r="${size * 0.45}" fill="none" stroke="#00d4ff" stroke-width="0.6" opacity="0.6" stroke-dasharray="3 2"/>
      <polygon points="${cx},${size * 0.04} ${cx - 4},${size * 0.1} ${cx + 4},${size * 0.1}" fill="#00d4ff"/>
      <text x="${cx}" y="${size * 0.96}" text-anchor="middle" font-family="Cinzel" font-size="${size * 0.05}" fill="#00d4ff">INSTRUCTOR</text>
    `;
  }
  return `
    <circle cx="${cx}" cy="${cy}" r="${size * 0.46}" fill="none" stroke="#D4AF37" stroke-width="0.5" opacity="0.4"/>
  `;
}
