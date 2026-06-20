/**
 * Owl Academy — Proof Cartridge System
 * ------------------------------------------------------------------
 * Shared schema + loader/boot logic for the Proofs Workshop emulators
 * and cartridge makers. A "proof cartridge" is a self-describing JSON
 * artifact that an emulator (C64 / Amiga proof machine) can boot.
 *
 * Security posture (woven in):
 *   • Cartridges carry a tamper-evident `seal` (FNV-1a over canonical
 *     content). The emulator recomputes it and refuses to trust a
 *     mismatched cartridge.
 *   • Payload bodies are rendered as ESCAPED text — never injected as
 *     raw HTML — and any `payload.program` is NOT evaluated (sandbox
 *     reserved for a future Cloud-Function-gated runtime).
 *   • Authorship is stamped with the maker's Genesis ID + tier so the
 *     Authority System's priority rules (canonical/validated/experimental)
 *     travel with the cartridge.
 *
 * This module has NO Firebase dependency so emulators can boot offline.
 */

export const CART_FORMAT = "owl-proof-cartridge";
export const CART_VERSION = 1;

// ── Machine profiles (retro chrome) ──────────────────────────────────────────
export const MACHINES = {
  c64: {
    id: "c64",
    name: "PROOF-64",
    long: "Owl Academy PROOF-64",
    palette: { bg: "#4338b8", fg: "#b1a7f4", border: "#8b7ff0", accent: "#f5f0ff" },
    font: '"Fira Code", "Courier New", monospace',
    boot: [
      "    **** OWL ACADEMY PROOF-64 BASIC V2 ****",
      " 64K RAM SYSTEM  38911 LATTICE BYTES FREE",
      "",
      "READY.",
    ],
  },
  amiga: {
    id: "amiga",
    name: "PROOF-AMIGA",
    long: "Owl Academy Proof Workbench",
    palette: { bg: "#0a0f2c", fg: "#c9d4ff", border: "#ff8a1e", accent: "#ffffff" },
    font: '"Fira Code", "Courier New", monospace',
    boot: [
      "Owl Amiga Proof Workbench 1.3",
      "Topology.library v33  ·  Trefoil.device v33",
      "",
      "Insert proof cartridge ▸",
    ],
  },
};

export const PRIORITY_META = {
  canonical:    { label: "Canonical",    color: "#D4AF37", note: "Archon-sealed" },
  validated:    { label: "Validated",    color: "#22d3ee", note: "Instructor-sealed" },
  experimental: { label: "Experimental", color: "#f472b6", note: "Acolyte / unsealed" },
};

// ── Integrity seal (FNV-1a 32-bit, synchronous, deterministic) ────────────────
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
}

// Canonical content used for the seal (everything except the seal itself).
function canonicalContent(cart) {
  const c = {
    format: CART_FORMAT, version: CART_VERSION,
    machine: cart.machine, id: cart.id, title: cart.title,
    abstract: cart.abstract || "", tags: cart.tags || [],
    author: cart.author || null, priority: cart.priority || "experimental",
    payload: cart.payload || {},
  };
  return JSON.stringify(c);
}

export function sealCartridge(cart) {
  return { ...cart, seal: fnv1a(canonicalContent(cart)) };
}

export function verifySeal(cart) {
  if (!cart || typeof cart.seal !== "string") return false;
  return cart.seal === fnv1a(canonicalContent(cart));
}

// ── Authoring helpers ─────────────────────────────────────────────────────────
export function emptyCartridge(machine = "c64") {
  return {
    format: CART_FORMAT, version: CART_VERSION, machine,
    id: "", title: "", abstract: "", tags: [],
    author: { genesisId: null, tier: "ACOLYTE" },
    priority: "experimental",
    createdAt: new Date().toISOString(),
    payload: { kind: "proof", body: "", program: "" },
  };
}

export function serializeCartridge(cart) {
  return JSON.stringify(sealCartridge(cart), null, 2);
}

export function parseCartridge(text) {
  const obj = JSON.parse(text); // throws on malformed JSON
  return obj;
}

export function validateCartridge(cart) {
  const e = [];
  if (!cart || typeof cart !== "object") return { ok: false, errors: ["not an object"] };
  if (cart.format !== CART_FORMAT) e.push(`format must be "${CART_FORMAT}"`);
  if (cart.version !== CART_VERSION) e.push(`version must be ${CART_VERSION}`);
  if (!MACHINES[cart.machine]) e.push(`unknown machine "${cart.machine}"`);
  if (!cart.id || !/^[a-z0-9][a-z0-9-]*$/.test(cart.id)) e.push("id must be kebab-case");
  if (!cart.title) e.push("title required");
  if (!cart.payload || typeof cart.payload.body !== "string") e.push("payload.body required");
  return { ok: e.length === 0, errors: e };
}

// ── Rendering / boot ──────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Very small, safe markdown subset → escaped HTML (headings, **bold**, `code`, lists, math left literal).
function miniMarkdown(src) {
  const lines = esc(src).split("\n");
  let html = "", inList = false;
  for (let raw of lines) {
    let line = raw
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
    if (/^\s*[-*]\s+/.test(raw)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += "<li>" + line.replace(/^\s*[-*]\s+/, "") + "</li>";
      continue;
    }
    if (inList) { html += "</ul>"; inList = false; }
    if (/^###\s+/.test(raw)) html += "<h4>" + line.replace(/^###\s+/, "") + "</h4>";
    else if (/^##\s+/.test(raw)) html += "<h3>" + line.replace(/^##\s+/, "") + "</h3>";
    else if (/^#\s+/.test(raw)) html += "<h2>" + line.replace(/^#\s+/, "") + "</h2>";
    else if (line.trim() === "") html += "<br>";
    else html += "<p>" + line + "</p>";
  }
  if (inList) html += "</ul>";
  return html;
}

/**
 * Boot a cartridge into a screen element.
 * @param {object} opts {cart, screenEl, machine}
 * Returns {ok, status} where status describes the security verdict.
 */
export function bootCartridge({ cart, screenEl, machine }) {
  const m = MACHINES[machine] || MACHINES.c64;
  if (!cart) {
    screenEl.innerHTML =
      `<pre class="boot">${esc(m.boot.join("\n"))}\n\n` +
      `<span class="blink">▌</span> NO CARTRIDGE INSERTED — load a .crt.json or build one in the Cartridge Maker.</pre>`;
    return { ok: false, status: "empty" };
  }
  const v = validateCartridge(cart);
  if (!v.ok) {
    screenEl.innerHTML = `<pre class="boot err">?CARTRIDGE ERROR\n  ${esc(v.errors.join("\n  "))}\nREADY.</pre>`;
    return { ok: false, status: "invalid", errors: v.errors };
  }
  const sealOk = verifySeal(cart);
  const prio = PRIORITY_META[cart.priority] || PRIORITY_META.experimental;
  const author = cart.author && cart.author.genesisId ? cart.author.genesisId : "unregistered";
  const sealLine = sealOk
    ? `SEAL OK  ${esc(cart.seal)}  ·  ${prio.label} (${prio.note})`
    : `⚠ SEAL MISMATCH — cartridge content was altered after signing. Loading in QUARANTINE (read-only).`;

  screenEl.innerHTML =
    `<pre class="boot">${esc(m.boot.join("\n"))}\nLOADING "${esc(cart.title.toUpperCase())}" ...\n` +
    `<span class="${sealOk ? "ok" : "err"}">${sealLine}</span>\nRUN.</pre>` +
    `<div class="cart-view">` +
      `<div class="cart-head"><span class="cart-id">${esc(cart.id)}</span>` +
      `<span class="cart-prio" style="color:${prio.color};border-color:${prio.color}">${prio.label}</span></div>` +
      `<h1 class="cart-title">${esc(cart.title)}</h1>` +
      (cart.abstract ? `<p class="cart-abstract">${esc(cart.abstract)}</p>` : "") +
      `<div class="cart-body">${miniMarkdown(cart.payload.body || "")}</div>` +
      (cart.payload.program
        ? `<div class="cart-note">⛒ This cartridge carries an interactive program. Execution is sandboxed off until the gated runtime ships — body shown read-only.</div>`
        : "") +
      `<div class="cart-foot">author: ${esc(author)} · sealed: ${esc(cart.seal || "—")} · ${esc(cart.createdAt || "")}</div>` +
    `</div>`;
  return { ok: true, status: sealOk ? "trusted" : "quarantine" };
}
