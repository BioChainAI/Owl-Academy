# Owl Academy: Ontology JSON Import/Export Guide

**Structural Schema and Formatting Rules for the Root Ontology Creator**

- **Target System:** Owl Academy Root Ontology Creator / Lexicon
- **File Format:** `.json`

---

## 1. Top-Level Structure

The imported/exported JSON file must consist of a single root JavaScript Object (`{}`). The keys of this object serve as the unique identifiers (IDs) for each engram, and the values are the nested Engram Objects.

```json
{
  "unique_engram_id_1": {
    // Engram Data
  },
  "unique_engram_id_2": {
    // Engram Data
  }
}
```

---

## 2. Engram Object Schema

Each Engram Object must strictly adhere to the following key-value structure representing the 4-tier semiotic descent and its classical/holographic translations.

| Key | Type | Description | Example |
|-----|------|-------------|---------|
| `id` | String | Must perfectly match the parent key. | `"alpha_tutorial"` |
| `origin` | String | Sets the system tag. Must be exactly `"root"` or `"personal"`. | `"root"` |
| `category` | String | **Tier 1:** The overarching macro-domain (e.g., Mathematics, Physics, Philosophy). | `"Philosophy"` |
| `field` | String | **Tier 2:** The specific field of study or discipline. | `"Ontological Genesis"` |
| `subtitle` | String | **Tier 3:** The conceptual mechanism of action. | `"The Primary Initializer"` |
| `symbol` | String | **Tier 4:** The specific unicode character or symbol representing the engram. | `"α"` |
| `name` | String | **Tier 4:** The plaintext name of the operator. | `"Alpha"` |
| `primary_equation` | String | The core mathematical formulation. (See LaTeX Rules below.) | `"\\alpha_0 = \\lim_{t \\to 0} \\mathcal{M}(t)"` |
| `visMode` | String | Defines the 3D Holographic Projection engine to use. (See valid modes below.) | `"RIPPLES"` |
| `holographic` | String | The SHD-CCP lore description. HTML tags like `<strong>` are permitted. | `"The absolute beginning of the topological sequence..."` |
| `euclidean` | String | Translation into Euclidean Geometry contexts. | `"The starting angle or origin point."` |
| `linear` | String | Translation into Linear Algebra contexts. | `"The initial state vector."` |
| `hyperbolic` | String | Translation into Hyperbolic Geometry contexts. | `"The origin of the Poincare disk."` |

---

## 3. Critical Formatting Rules

### Rule A: Strict LaTeX Double-Escaping

Because the data is stored as a raw JSON string, the MathJax renderer requires all LaTeX backslashes (`\`) to be double-escaped (`\\`). If you fail to double-escape, the JSON will either fail to parse or the math will break.

| | Example |
|---|---------|
| **Incorrect** | `"\lim_{t \to 0}"` |
| **Correct** | `"\\lim_{t \\to 0}"` |

> Do not wrap the `primary_equation` string in `$$` or `$`. The system's UI automatically wraps the equation in the appropriate display mode during render.

### Rule B: Valid `visMode` Variables

The 3D Holographic Projector can only interpret the following exact string values for the `visMode` parameter:

| Value | Use Case |
|-------|----------|
| `"FUNNEL"` | Singularity / Gradient / Resistance |
| `"TREFOIL_SPIN"` | Torsion / Knot / Spin |
| `"RIPPLES"` | Waves / Interference / Superposition |
| `"TETRAHEDRON"` | Compression / Expansion |
| `"HEX_CIRCLE"` | Packing / Limits / Boundaries |
| `"BRAID"` | Entanglement / Entropy / Summation |
| `"EVENT_HORIZON"` | Absolute Bounds / Black Holes |
| `"GOLDEN_SPIRAL"` | Recursive Scaling / Growth |
| `"LATTICE_WEB"` | Scaffolding / Graphs / Products |
| `"MOBIUS"` | Infinity / Looping |
| `"WORMHOLE"` | Countable Infinity / Bridges |
| `"VOID_RING"` | Vacuum / Empty Sets |
| `"SLICE_PLANE"` | Dimensional Slicing / Derivatives |
| `"ORTHOGONAL_PHASE"` | Imaginary / Orthogonal Shifts |
| `"VECTOR_FIELD"` | Flow / Integrals |

---

## 4. Complete Valid JSON Example

```json
{
    "alpha_tutorial": {
        "id": "alpha_tutorial",
        "category": "Philosophy",
        "field": "Ontological Genesis",
        "symbol": "α",
        "name": "Alpha",
        "subtitle": "The Primary Initializer",
        "primary_equation": "\\alpha_0 = \\lim_{t \\to 0} \\mathcal{M}(t)",
        "holographic": "The Alpha engram represents the absolute beginning of the topological sequence. It is the initial spark that ignites the Markov Pump, transforming static space into a breathing manifold.",
        "visMode": "RIPPLES",
        "euclidean": "The starting angle or origin point.",
        "linear": "The initial state vector.",
        "hyperbolic": "The origin of the Poincare disk.",
        "origin": "root"
    },
    "nabla_operator": {
        "id": "nabla_operator",
        "category": "Physics",
        "field": "Fluid Dynamics",
        "symbol": "∇",
        "name": "Nabla",
        "subtitle": "Vector Flow Gradient",
        "primary_equation": "\\nabla \\times \\mathbf{v} = \\mathbf{0}",
        "holographic": "$\\nabla$ acts as the <strong>Vector Flow Gradient</strong>. In the SHD-CCP, it measures the exact directional pressure pushing a 64-bit packet toward the Zero-Point singularity.",
        "visMode": "FUNNEL",
        "euclidean": "A vector differential operator ($\\nabla$) defining the slope and direction of the steepest ascent on a surface.",
        "linear": "Used to calculate the Divergence ($\\nabla \\cdot \\mathbf{v}$) or Curl ($\\nabla \\times \\mathbf{v}$) of a matrix or vector field.",
        "hyperbolic": "The Levi-Civita connection denoting covariant derivatives on curved spaces.",
        "origin": "personal"
    }
}
```
