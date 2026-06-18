/**
 * Sigil Renderer — deterministic familiar + composite user sigil generation.
 * All output is seeded from cosmologicalId so the same seed always produces
 * the same familiar and sigil SVG.
 *
 * Slot system: each echo purchase consumes the next PRNG draw.
 *   slot 0 = genesis familiar (always unlocked)
 *   slot 1 = first echo (+1 PRNG draw)
 *   slot N = Nth echo (+N PRNG draws burned before selection)
 * Max 6 slots (slots 0–5).
 */

// ── PRNG ──────────────────────────────────────────────────────────────────────
function xmur3(str) {
  for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    var t = (a + b) | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    d = d + 1 | 0;
    t = t + d | 0;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function makeRand(seed) {
  const h = xmur3(seed);
  return sfc32(h(), h(), h(), h());
}

// ── Familiar archetypes ───────────────────────────────────────────────────────
export const FAMILIARS = [
  {
    id: 'FELIS',
    name: 'Felis Arcana',
    title: 'The Observer',
    color: '#00f0ff',
    colorName: 'cyan',
    svg: `<path stroke="currentColor" stroke-width="1" fill="none" d="M50,85 L25,60 L45,50 Z M50,85 L75,60 L55,50 Z M45,50 L55,50 M25,60 L15,15 L40,35 L50,25 L60,35 L85,15 L75,60 M15,15 L50,85 L85,15"/>
          <path stroke="white" stroke-width="1.5" fill="none" d="M50,35 L45,42 L50,50 L55,42 Z"/>
          <path stroke="currentColor" stroke-width="0.75" fill="none" d="M25,60 L5,55 M28,68 L10,70 M75,60 L95,55 M72,68 L90,70"/>
          <g fill="white"><circle cx="50" cy="85" r="2"/><circle cx="25" cy="60" r="2"/><circle cx="75" cy="60" r="2"/><circle cx="15" cy="15" r="2"/><circle cx="85" cy="15" r="2"/><circle cx="40" cy="35" r="1.5"/><circle cx="60" cy="35" r="1.5"/><circle cx="50" cy="25" r="2.5"/><circle cx="45" cy="50" r="1.5"/><circle cx="55" cy="50" r="1.5"/></g>`,
  },
  {
    id: 'CANIS',
    name: 'Canis Aegis',
    title: 'The Guardian',
    color: '#d4af37',
    colorName: 'gold',
    svg: `<path stroke="currentColor" stroke-width="1.5" fill="none" d="M35,90 L65,90 L80,65 L70,25 L60,35 L50,25 L40,35 L30,25 L20,65 Z"/>
          <path stroke="currentColor" stroke-width="1" fill="none" d="M35,90 L40,70 L60,70 L65,90 M40,70 L50,55 L60,70 M20,65 L40,50 L60,50 L80,65 M30,25 L45,45 M70,25 L55,45 M45,45 L55,45"/>
          <path stroke="white" stroke-width="1.5" fill="none" d="M50,30 L45,35 L50,42 L55,35 Z"/>
          <g fill="white"><circle cx="35" cy="90" r="2.5"/><circle cx="65" cy="90" r="2.5"/><circle cx="80" cy="65" r="2"/><circle cx="20" cy="65" r="2"/><circle cx="70" cy="25" r="2"/><circle cx="30" cy="25" r="2"/><circle cx="50" cy="25" r="2"/><circle cx="60" cy="35" r="1.5"/><circle cx="40" cy="35" r="1.5"/><circle cx="50" cy="55" r="2"/><circle cx="40" cy="70" r="1.5"/><circle cx="60" cy="70" r="1.5"/></g>`,
  },
  {
    id: 'STRIX',
    name: 'Strix Lumin',
    title: 'The Scholar',
    color: '#b026ff',
    colorName: 'amethyst',
    svg: `<path stroke="currentColor" stroke-width="1" fill="none" d="M50,15 L75,35 L85,65 L50,90 L15,65 L25,35 Z M50,15 L50,35 M85,65 L65,65 M15,65 L35,65"/>
          <path stroke="white" stroke-width="1.5" fill="none" d="M35,45 L45,50 L35,55 Z M65,45 L55,50 L65,55 Z"/>
          <path stroke="currentColor" stroke-width="0.75" fill="none" d="M50,55 L45,70 L55,70 Z M50,35 L35,45 L35,65 L50,90 L65,65 L65,45 Z"/>
          <g fill="white"><circle cx="50" cy="15" r="2"/><circle cx="75" cy="35" r="2"/><circle cx="85" cy="65" r="2"/><circle cx="50" cy="90" r="2"/><circle cx="15" cy="65" r="2"/><circle cx="25" cy="35" r="2"/><circle cx="50" cy="35" r="1.5"/><circle cx="35" cy="65" r="1.5"/><circle cx="65" cy="65" r="1.5"/><circle cx="45" cy="50" r="2"/><circle cx="55" cy="50" r="2"/><circle cx="50" cy="55" r="1.5"/></g>`,
  },
  {
    id: 'SERP',
    name: 'Ouroboros Hex',
    title: 'The Weaver',
    color: '#00ff66',
    colorName: 'emerald',
    svg: `<path stroke="currentColor" stroke-width="1.5" fill="none" d="M50,15 L75,25 L85,50 L65,70 L50,55 L35,70 L50,90 L75,80 M50,15 L25,25 L15,50 L35,70 L50,55 M25,25 L35,35 L65,35 L75,25"/>
          <path stroke="white" stroke-width="1.5" fill="none" d="M45,25 L50,20 L55,25 Z"/>
          <path stroke="currentColor" stroke-width="1" fill="none" d="M15,50 L30,50 M85,50 L70,50"/>
          <g fill="white"><circle cx="50" cy="15" r="2"/><circle cx="75" cy="25" r="2"/><circle cx="85" cy="50" r="2"/><circle cx="65" cy="70" r="2"/><circle cx="50" cy="55" r="2"/><circle cx="35" cy="70" r="2"/><circle cx="50" cy="90" r="2"/><circle cx="75" cy="80" r="1.5"/><circle cx="25" cy="25" r="2"/><circle cx="15" cy="50" r="2"/><circle cx="50" cy="20" r="1.5"/></g>`,
  },
  {
    id: 'VULP',
    name: 'Vulpes Cinder',
    title: 'The Seeker',
    color: '#ff3366',
    colorName: 'crimson',
    svg: `<path stroke="currentColor" stroke-width="1.2" fill="none" d="M50,85 L20,40 L30,15 L45,35 L50,30 L55,35 L70,15 L80,40 Z"/>
          <path stroke="currentColor" stroke-width="1" fill="none" d="M50,85 L35,55 L65,55 Z M30,15 L40,40 M70,15 L60,40 M20,40 L45,55 M80,40 L55,55"/>
          <path stroke="white" stroke-width="1.5" fill="none" d="M40,55 L45,50 L50,55 L45,60 Z M60,55 L55,50 L50,55 L55,60 Z"/>
          <g fill="white"><circle cx="50" cy="85" r="2"/><circle cx="20" cy="40" r="2"/><circle cx="30" cy="15" r="2"/><circle cx="45" cy="35" r="1.5"/><circle cx="50" cy="30" r="1.5"/><circle cx="55" cy="35" r="1.5"/><circle cx="70" cy="15" r="2"/><circle cx="80" cy="40" r="2"/><circle cx="35" cy="55" r="1.5"/><circle cx="65" cy="55" r="1.5"/><circle cx="45" cy="55" r="2"/><circle cx="55" cy="55" r="2"/></g>`,
  },
];

export const MAX_FAMILIAR_SLOTS = 6;

// ── Slot-aware familiar lookup ────────────────────────────────────────────────

/**
 * Returns the familiar archetype for a given slot number.
 * slot 0 = genesis (first PRNG draw)
 * slot N = Nth echo (N+1th PRNG draw, burning N draws first)
 */
export function getFamiliarForSlot(cosmologicalId, slotNumber = 0) {
  if (!cosmologicalId) return FAMILIARS[2]; // STRIX default
  const rand = makeRand(String(cosmologicalId));
  let idx;
  for (let i = 0; i <= slotNumber; i++) {
    idx = Math.floor(rand() * FAMILIARS.length);
  }
  return FAMILIARS[idx];
}

// Backwards-compatible wrapper
export function getFamiliarFromCosmologicalId(cosmologicalId) {
  const familiar = getFamiliarForSlot(cosmologicalId, 0);
  return { familiar, rand: makeRand(String(cosmologicalId || 'default')) };
}

// ── Hilbert Manifold SVG ──────────────────────────────────────────────────────
// Ported from SHD-CCP_Generator_v3. Generates nested string-art manifold geometry.

const FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

/**
 * Generates the Hilbert manifold (nested polygon string art).
 * @param {number} n  - Points / symmetry (3–64)
 * @param {number} k  - String multiplier (1–64)
 * @param {number} t  - Nested tiers (1–6)
 * @param {number} [maxRadius=45] - Radius in viewBox units
 * @returns {string} SVG path markup (no outer <svg> wrapper)
 */
export function generateManifoldSVG(n, k, t, maxRadius = 45) {
  n = Math.max(3, Math.min(64, parseInt(n) || 12));
  k = Math.max(1, Math.min(64, parseInt(k) || 5));
  t = Math.max(1, Math.min(6,  parseInt(t) || 4));
  const center = { x: 50, y: 50 };
  const baseFibIndex = Math.min(t + 3, FIB.length - 1);
  let svg = '';

  for (let layer = 0; layer < t; layer++) {
    const fibIdx = Math.max(0, baseFibIndex - layer);
    const scale = FIB[fibIdx] / FIB[baseFibIndex];
    const radius = maxRadius * scale;

    const coords = [];
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      coords.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      });
    }

    let pathData = '';
    for (let i = 0; i < n; i++) {
      const s = coords[i];
      const e = coords[(i * k) % n];
      pathData += `M${s.x.toFixed(1)},${s.y.toFixed(1)} L${e.x.toFixed(1)},${e.y.toFixed(1)} `;
    }

    let perimData = `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)} `;
    for (let i = 1; i <= n; i++) {
      const c = coords[i % n];
      perimData += `L${c.x.toFixed(1)},${c.y.toFixed(1)} `;
    }

    const opacity  = layer === 0 ? 0.9 : (0.9 - layer * 0.15);
    const sw       = layer === 0 ? 0.5 : 0.3;
    const dash     = layer === 0 ? '' : 'stroke-dasharray="1 2"';

    svg += `<path d="${pathData}" stroke="currentColor" stroke-width="${sw}" fill="none" opacity="${opacity}" ${dash}/>`;
    if (layer === 0) {
      svg += `<path d="${perimData}" stroke="currentColor" stroke-width="0.4" fill="none" opacity="0.35"/>`;
    }

    // Node dots on outermost layer only
    if (layer === 0) {
      let nodes = '';
      for (let i = 0; i < n; i++) {
        nodes += `<circle cx="${coords[i].x.toFixed(1)}" cy="${coords[i].y.toFixed(1)}" r="0.7" fill="currentColor" opacity="0.7"/>`;
      }
      svg += `<g>${nodes}</g>`;
    }
  }

  return svg;
}

// ── Ring / tier colors ────────────────────────────────────────────────────────
const TIER_COLORS = {
  ARCHON:     '#D4AF37',
  INSTRUCTOR: '#00d4ff',
  ACOLYTE:    '#94a3b8',
};
const GUILD_COLORS = ['#00f0ff', '#d4af37', '#b026ff', '#00ff66', '#ff3366'];
const DEPT_COLORS  = { 7: '#ffffff', 8: '#b026ff', 9: '#00ff66' };

// ── Composite sigil renderer ──────────────────────────────────────────────────

/**
 * Renders the composite user sigil as an SVG string.
 *
 * @param {object} opts
 * @param {string}  opts.cosmologicalId
 * @param {number}  [opts.activeSlot=0]        — which familiar slot is active
 * @param {object}  [opts.manifoldConfig=null]  — { n, k, t } for Hilbert manifold background
 * @param {string}  [opts.tier='ACOLYTE']
 * @param {string[]} [opts.guilds=[]]
 * @param {object}  [opts.orbitals={}]          — { tomes, minorTomes, artifacts, dept7, dept8, dept9 }
 * @param {number}  [opts.size=120]
 * @param {boolean} [opts.animated=true]
 * @returns {string} SVG element string
 */
export function renderUserSigil({
  cosmologicalId,
  activeSlot = 0,
  manifoldConfig = null,
  tier = 'ACOLYTE',
  guilds = [],
  orbitals = {},
  size = 120,
  animated = true,
}) {
  const familiar   = getFamiliarForSlot(cosmologicalId, activeSlot);
  const tierColor  = TIER_COLORS[tier] || TIER_COLORS.ACOLYTE;
  const cx = 50, cy = 50;
  const r = { core: 28, tier: 36, achievement: 43, guild: 48, border: 50 };

  // Tier ring style
  const tierDash  = tier === 'ACOLYTE' ? 'stroke-dasharray="3 2"' : '';
  const tierStroke = tier === 'ARCHON' ? 1.5 : 1;
  const tierExtra  = tier === 'ARCHON'
    ? `<circle cx="${cx}" cy="${cy}" r="${r.tier - 2}" fill="none" stroke="${tierColor}" stroke-width="0.5" opacity="0.5"/>`
    : '';

  // Dept achievement pips
  const deptPips = [7, 8, 9]
    .filter(d => orbitals[`dept${d}`] > 0)
    .map((d, i, arr) => {
      const angle = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
      return `<circle cx="${(cx + r.achievement * Math.cos(angle)).toFixed(1)}" cy="${(cy + r.achievement * Math.sin(angle)).toFixed(1)}" r="2.5" fill="${DEPT_COLORS[d]}" opacity="0.9"/>`;
    }).join('');

  // Guild ring pips
  const guildMarkers = (guilds || []).slice(0, 4).map((_, i, arr) => {
    const angle = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
    return `<circle cx="${(cx + r.guild * Math.cos(angle)).toFixed(1)}" cy="${(cy + r.guild * Math.sin(angle)).toFixed(1)}" r="2" fill="${GUILD_COLORS[i % GUILD_COLORS.length]}" opacity="0.85"/>`;
  }).join('');

  // Tome count ticks on outer border
  const tomeCount = Math.min((orbitals.tomes || 0) + (orbitals.minorTomes || 0), 16);
  const ticks = Array.from({ length: tomeCount }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2;
    return `<line x1="${(cx + (r.border - 0.5) * Math.cos(angle)).toFixed(1)}" y1="${(cy + (r.border - 0.5) * Math.sin(angle)).toFixed(1)}" x2="${(cx + (r.border + 0.5) * Math.cos(angle)).toFixed(1)}" y2="${(cy + (r.border + 0.5) * Math.sin(angle)).toFixed(1)}" stroke="#8A2BE2" stroke-width="1.2" opacity="0.7"/>`;
  }).join('');

  // Hilbert manifold background (if configured, renders inside familiar core)
  const manifoldLayer = manifoldConfig
    ? `<g transform="translate(${cx - r.core}, ${cy - r.core}) scale(${(r.core * 2) / 100})"
          color="${familiar.color}" style="color:${familiar.color};opacity:0.22">
         ${generateManifoldSVG(manifoldConfig.n, manifoldConfig.k, manifoldConfig.t, 45)}
       </g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"
               style="filter:drop-shadow(0 0 6px ${familiar.color}88)">
    <circle cx="${cx}" cy="${cy}" r="${r.border}" fill="none" stroke="${familiar.color}" stroke-width="0.4" opacity="0.4"/>
    ${ticks}
    <circle cx="${cx}" cy="${cy}" r="${r.guild}" fill="none" stroke="${familiar.color}" stroke-width="0.3" stroke-dasharray="1 3" opacity="0.35"/>
    ${guildMarkers}
    <circle cx="${cx}" cy="${cy}" r="${r.achievement}" fill="none" stroke="${tierColor}" stroke-width="0.3" opacity="0.25"/>
    ${deptPips}
    ${tierExtra}
    <circle cx="${cx}" cy="${cy}" r="${r.tier}" fill="none" stroke="${tierColor}" stroke-width="${tierStroke}" ${tierDash} opacity="0.8"/>
    <g transform="translate(${cx - r.core}, ${cy - r.core}) scale(${(r.core * 2) / 100})"
       color="${familiar.color}" style="color:${familiar.color}">
      <circle cx="50" cy="50" r="49" fill="#05030a" opacity="0.85"/>
      ${manifoldLayer ? '' : ''}
    </g>
    ${manifoldLayer}
    <g transform="translate(${cx - r.core}, ${cy - r.core}) scale(${(r.core * 2) / 100})"
       color="${familiar.color}" style="color:${familiar.color}">
      ${familiar.svg}
    </g>
  </svg>`;
}
