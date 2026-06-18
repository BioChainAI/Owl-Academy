# Owl Academy Familiar Protocol
### SHD-CCP Familiar Binding System — v1.0

---

## Overview

Every Owl Academy user is deterministically bound to one of five **familiar archetypes** — persistent geometric entities projected from the SPIRE hyperbolic manifold. The familiar is not chosen; it is *revealed* from the user's **genesis seed** (`cosmologicalId`), ensuring that each identity is unique, reproducible, and structurally grounded in the academy's mathematics.

The familiar forms the core of the **User Sigil**: a composite SVG identification system that encodes tier, guild affiliations, and departmental achievements in concentric rings around the familiar's inner geometry.

---

## PRNG Specification

The familiar archetype is selected using the `xmur3 + sfc32` PRNG chain — a 128-bit seeded algorithm from the SHD-CCP protocol:

```javascript
function xmur3(str) { /* string → seed state */ }
function sfc32(a, b, c, d) { /* 4-state → [0,1) float stream */ }

function makeRand(cosmologicalId) {
  const h = xmur3(cosmologicalId);
  return sfc32(h(), h(), h(), h());
}
```

The `cosmologicalId` is the sole entropy source. The same ID always produces the same familiar. This is cryptographic-quality seeding (SFC32 passes BigCrush tests) applied to identity rather than security.

**Selection formula:**

```
archetype_index = floor(rand() * 5)
```

Where `rand` is the first output of the seeded PRNG stream.

---

## The Five Archetypes

| ID | Name | Title | Color | Resonance |
|---|---|---|---|---|
| FELIS | Felis Arcana | The Observer | Cyan `#00f0ff` | Pattern recognition, liminal awareness, emergent intelligence |
| CANIS | Canis Aegis | The Guardian | Gold `#d4af37` | Structural discipline, foundational mastery, protective architecture |
| STRIX | Strix Lumin | The Scholar | Amethyst `#b026ff` | Deep cognition, cross-domain synthesis, luminous understanding |
| SERP | Ouroboros Hex | The Weaver | Emerald `#00ff66` | Recursive systems, cyclic logic, entangled pathways |
| VULP | Vulpes Cinder | The Seeker | Crimson `#ff3366` | Adaptive navigation, rapid iteration, relentless discovery |

Each archetype has a deterministic SVG geometry composed of three layers:
- **Layer 1** — the outer silhouette structure (primary stroke)
- **Layer 2** — inner Hilbert-esque routing paths (secondary stroke)
- **Layer 3** — core white accent geometry (diamond, cross, or triangle)

---

## Composite Sigil Structure

The User Sigil is rendered as a 100×100 viewBox SVG with five concentric layers:

```
r=50  ── Outer Border Ring     (purple tick marks = tome count, up to 16)
r=48  ── Guild Ring            (color-coded pips per guild affiliation)
r=43  ── Achievement Ring      (Dept 7/8/9 unlock pips)
r=36  ── Tier Ring             (ARCHON=double, INSTRUCTOR=solid, ACOLYTE=dashed)
r=28  ── Familiar Core         (the archetype SVG, scaled to fit)
```

### Layer 1 · Familiar Core (r=28)

The familiar's SVG is translated and scaled to occupy a 56px diameter circle at the center. A dark background fill (`#05030a`) separates it from the outer rings. The familiar's color is applied via CSS `currentColor`.

### Layer 2 · Tier Ring (r=36)

| Tier | Style |
|---|---|
| ARCHON | Double ring (full + inner at r=34), gold, solid |
| INSTRUCTOR | Single ring, cyan, solid |
| ACOLYTE | Single ring, slate, dashed (3 2) |

### Layer 3 · Achievement Ring (r=43)

When a user has unlocked Department 7, 8, or 9 (field `deptXUnlocked: true` in the registrar), a corresponding pip appears on this ring:

| Dept | Color |
|---|---|
| Dept 7 | White `#ffffff` |
| Dept 8 | Amethyst `#b026ff` |
| Dept 9 | Emerald `#00ff66` |

Pips are spaced at equal angular intervals among those present (e.g., 120° apart if all three are present).

### Layer 4 · Guild Ring (r=48)

One pip per guild affiliation from `profile.guilds[]`, up to four. Colors cycle through the familiar archetype palette: cyan → gold → amethyst → emerald. Angular spacing is equal.

### Layer 5 · Outer Border (r=50)

Tick marks at equal angular positions encode tome + minor-tome count (clamped to 16). Each tick is a radial line segment in purple (`#8A2BE2`). A faint ring at r=50 provides the border.

---

## Genesis Seed Link

The `cosmologicalId` is stored in `registrar/main` in Firestore (set during SPIRE registration / Constellation Map registration). It is derived from the user's genesis position in the SPIRE hyperbolic toroid manifold using the `genesisToPosition()` function:

```javascript
function genesisToPosition(cosmologicalId) {
  const hex = cosmologicalId.replace(/-/g, "").substring(0, 12);
  const x = (parseInt(hex.slice(0,4), 16) / 0xffff) * 1400 - 700;
  const y = (parseInt(hex.slice(4,8), 16) / 0xffff) * 700  - 350;
  const z = (parseInt(hex.slice(8,12),16) / 0xffff) * 1400 - 700;
  return new THREE.Vector3(x, y, z);
}
```

The first 12 hex characters of the ID map to a unique point on the manifold, and the full ID is used as the PRNG seed for familiar selection.

---

## Integration Points

| Surface | Usage |
|---|---|
| `Sanctum` welcome banner | 80–96px sigil replacing the initial letter |
| `Learning Hub` sidebar | 40px sigil next to user name/rank |
| `Constellation Map` | Orbital rings + tier display per node |
| `Familiars.html` | Full 160px sigil + archetype browser |
| Future: Guild Hall | Guild ring pips on member profiles |

---

## Renderer API

```javascript
import { getFamiliarFromCosmologicalId, renderUserSigil, FAMILIARS } from './scripts/sigil-renderer.js';

// Get the familiar archetype object
const { familiar } = getFamiliarFromCosmologicalId(cosmologicalId);
// familiar = { id, name, title, color, colorName, svg }

// Render the full composite sigil as an SVG string
const svgString = renderUserSigil({
  cosmologicalId,   // string — the genesis seed
  tier,             // 'ARCHON' | 'INSTRUCTOR' | 'ACOLYTE'
  guilds,           // string[] — guild IDs
  orbitals,         // { tomes, minorTomes, artifacts, dept7, dept8, dept9 }
  size,             // number — pixel size (default 120)
  animated,         // boolean (default true)
});
```

---

*Owl Academy · BioChain AI · SHD-CCP Protocol v1.0*
