/**
 * Sigil Renderer — deterministic familiar + composite user sigil generation.
 * All output is seeded from cosmologicalId so the same seed always produces
 * the same familiar and sigil SVG.
 */

// ── PRNG (mirrors the familiars protocol exactly) ─────────────────────────────
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

// ── Familiar lookup from cosmologicalId ───────────────────────────────────────
export function getFamiliarFromCosmologicalId(cosmologicalId) {
  if (!cosmologicalId) return { familiar: FAMILIARS[2], rand: makeRand('default') };
  const seed = String(cosmologicalId);
  const rand = makeRand(seed);
  // Use first random value to select archetype
  const idx = Math.floor(rand() * FAMILIARS.length);
  return { familiar: FAMILIARS[idx], rand };
}

// ── Tier ring colors ──────────────────────────────────────────────────────────
const TIER_COLORS = {
  ARCHON:     '#D4AF37',
  INSTRUCTOR: '#00d4ff',
  ACOLYTE:    '#94a3b8',
};

// ── Guild marker colors ───────────────────────────────────────────────────────
const GUILD_COLORS = ['#00f0ff', '#d4af37', '#b026ff', '#00ff66', '#ff3366'];

// ── Dept 7/8/9 colors ────────────────────────────────────────────────────────
const DEPT_COLORS = { 7: '#ffffff', 8: '#b026ff', 9: '#00ff66' };

/**
 * Renders the composite user sigil as an SVG string.
 *
 * @param {object} opts
 * @param {string} opts.cosmologicalId
 * @param {string} opts.tier          — "ARCHON" | "INSTRUCTOR" | "ACOLYTE"
 * @param {string[]} opts.guilds      — array of guild IDs (up to 3)
 * @param {object} opts.orbitals      — { tomes, minorTomes, artifacts, dept7, dept8, dept9 }
 * @param {number} [opts.size=120]    — outer pixel size of the SVG
 * @param {boolean} [opts.animated=true]
 * @returns {string} SVG element string
 */
export function renderUserSigil({ cosmologicalId, tier = 'ACOLYTE', guilds = [], orbitals = {}, size = 120, animated = true }) {
  const { familiar } = getFamiliarFromCosmologicalId(cosmologicalId);
  const tierColor = TIER_COLORS[tier] || TIER_COLORS.ACOLYTE;
  const cx = 50, cy = 50;

  // Rings (viewBox 0 0 100 100)
  const r = { core: 28, tier: 36, achievement: 43, guild: 48, border: 50 };

  // Tier ring — dashed for ACOLYTE, solid for INSTRUCTOR, doubled for ARCHON
  const tierDash = tier === 'ACOLYTE' ? 'stroke-dasharray="3 2"' : '';
  const tierStroke = tier === 'ARCHON' ? 1.5 : 1;
  const tierRingExtra = tier === 'ARCHON'
    ? `<circle cx="${cx}" cy="${cy}" r="${r.tier - 2}" fill="none" stroke="${tierColor}" stroke-width="0.5" opacity="0.5"/>`
    : '';

  // Achievement pips — dept 7/8/9 if unlocked
  const deptPips = [7, 8, 9]
    .filter(d => orbitals[`dept${d}`] > 0)
    .map((d, i, arr) => {
      const angle = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
      const px = cx + r.achievement * Math.cos(angle);
      const py = cy + r.achievement * Math.sin(angle);
      return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.5" fill="${DEPT_COLORS[d]}" opacity="0.9"/>`;
    })
    .join('');

  // Guild arc markers
  const guildMarkers = (guilds || []).slice(0, 4).map((_, i, arr) => {
    const angle = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
    const px = cx + r.guild * Math.cos(angle);
    const py = cy + r.guild * Math.sin(angle);
    return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2" fill="${GUILD_COLORS[i % GUILD_COLORS.length]}" opacity="0.85"/>`;
  }).join('');

  // Orbital count notches on border ring (up to 8 ticks for tomes + artifacts)
  const tomeCount = Math.min((orbitals.tomes || 0) + (orbitals.minorTomes || 0), 16);
  const ticks = Array.from({ length: tomeCount }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2;
    const r1 = r.border - 0.5, r2 = r.border + 0.5;
    const x1 = (cx + r1 * Math.cos(angle)).toFixed(1);
    const y1 = (cy + r1 * Math.sin(angle)).toFixed(1);
    const x2 = (cx + r2 * Math.cos(angle)).toFixed(1);
    const y2 = (cy + r2 * Math.sin(angle)).toFixed(1);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8A2BE2" stroke-width="1.2" opacity="0.7"/>`;
  }).join('');

  const animClass = animated ? 'sigil-draw' : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"
               style="filter:drop-shadow(0 0 6px ${familiar.color}88)">
    <!-- Outer border ring -->
    <circle cx="${cx}" cy="${cy}" r="${r.border}" fill="none" stroke="${familiar.color}" stroke-width="0.4" opacity="0.4"/>
    ${ticks}

    <!-- Guild ring -->
    <circle cx="${cx}" cy="${cy}" r="${r.guild}" fill="none" stroke="${familiar.color}" stroke-width="0.3" stroke-dasharray="1 3" opacity="0.35"/>
    ${guildMarkers}

    <!-- Achievement ring -->
    <circle cx="${cx}" cy="${cy}" r="${r.achievement}" fill="none" stroke="${tierColor}" stroke-width="0.3" opacity="0.25"/>
    ${deptPips}

    <!-- Tier ring -->
    ${tierRingExtra}
    <circle cx="${cx}" cy="${cy}" r="${r.tier}" fill="none" stroke="${tierColor}" stroke-width="${tierStroke}" ${tierDash} opacity="0.8"/>

    <!-- Familiar core (scaled to fit r.core) -->
    <g transform="translate(${cx - r.core}, ${cy - r.core}) scale(${(r.core * 2) / 100})"
       color="${familiar.color}" style="color:${familiar.color}">
      <circle cx="50" cy="50" r="49" fill="#05030a" opacity="0.85"/>
      ${familiar.svg}
    </g>
  </svg>`;
}
