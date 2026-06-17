# Owl Academy — Developer Reference Manual

> **Version 1.0.0** | System Architecture & Security Guidelines

This manual is the authoritative guide for building new modules, interactive canvases, and data tomes within the Owl Academy GitHub repository. All contributors — human or LLM — must follow these protocols to maintain security, consistency, and the Academy's distinct aesthetic.

---

## Table of Contents

1. [Core Architecture](#1-core-architecture)
2. [Security Protocol: The Client-Side Gate](#2-security-protocol-the-client-side-gate)
3. [The Grand Archives: Progression Tracking](#3-the-grand-archives-progression-tracking)
4. [Aesthetic & Thematic Guidelines](#4-aesthetic--thematic-guidelines)
5. [Required External Libraries](#5-required-external-libraries)
6. [Standard Page Blueprint](#6-standard-page-blueprint)

---

## 1. Core Architecture

Owl Academy is hosted exclusively on **GitHub Pages** — a fully static environment. There are no servers, no databases, and no backend processes of any kind.

### Key Constraints

| Constraint | Detail |
|---|---|
| **No backend server** | No Node.js, Python, or PHP |
| **No server-side database** | No SQL or MongoDB |
| **All logic is client-side** | JavaScript + `localStorage` only |

### The Single-File Mandate

Every complex interactive module (3D visualizers, data tomes, etc.) must be **self-contained in a single `.html` file**.

- **CSS** — use Tailwind utility classes or internal `<style>` blocks
- **JavaScript** — write in internal `<script>` blocks; external CDN libraries and `auth.js` are the only permitted external scripts

---

## 2. Security Protocol: The Client-Side Gate

Since server-side route protection is impossible, the Academy uses a unified guard script (`scripts/auth.js`) to control access.

### 2.1 The Guard Script (`auth.js`)

This script checks `localStorage` for `owl_academy_session_token`. If the token is absent and the user is not on `login.html`, they are **immediately redirected**.

**Every protected HTML file must include this as the very first tag inside `<head>`:**

```html
<!-- THE SECURITY GUARD -->
<!-- Note: Adjust the relative path depending on the file's location in the repo -->
<script src="scripts/auth.js"></script>
```

> ⚠️ **Critical:** This script tag must appear before any other scripts or stylesheets. Placing it anywhere else will create a security gap.

### 2.2 The Global Logout

Any protected page with an exit mechanism must call the `globalLogout()` function provided by `auth.js`:

```html
<button onclick="globalLogout()">Sever Connection</button>
```

Do **not** manually clear `localStorage` or redirect from custom logout logic — always delegate to `globalLogout()` for consistency.

---

## 3. The Grand Archives: Progression Tracking

`Grand_Archives.html` is the central learning hub. It reads a tome inventory array from `localStorage` under the key `owl_academy_tomes` to determine which modules a user has unlocked.

### Unlocking a Tome

When a user completes a puzzle or milestone in any module, trigger the following pattern to register their achievement:

```javascript
function onPuzzleComplete() {
    // 1. Retrieve the current inventory (default to empty array)
    let tomes = JSON.parse(localStorage.getItem("owl_academy_tomes")) || [];

    // 2. Add the tome ID — must match the data-tome-id attribute in Grand_Archives.html
    const newTomeId = "golden_ratio_projections";

    if (!tomes.includes(newTomeId)) {
        tomes.push(newTomeId);
        localStorage.setItem("owl_academy_tomes", JSON.stringify(tomes));
        alert("New Tome Decrypted. Return to the Archives.");
    }
}
```

### Rules for Tome IDs

- The `newTomeId` string **must exactly match** the `data-tome-id` attribute on the corresponding entry in `Grand_Archives.html`
- IDs should be lowercase with underscores (e.g., `golden_ratio_projections`)
- Always guard against duplicates with the `!tomes.includes(newTomeId)` check

---

## 4. Aesthetic & Thematic Guidelines

All pages must follow the **"Esoteric Terminal"** aesthetic — dark, arcane, and precise.

### 4.1 Color Palette (Tailwind Configuration)

Include this Tailwind config in the `<head>` of every new file:

```html
<script src="https://cdn.tailwindcss.com"></script>
<script>
    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    mystic: {
                        900: '#0a0a0f',   // Primary Void Background
                        800: '#141423',
                        700: '#23233e',
                        gold: '#d4af37',  // Primary Accent
                        accent: '#6b52ae' // Secondary Accent (Purple)
                    },
                    neon: {
                        orange: '#ff8c00',
                        cyan: '#00ffff',
                        copper: '#b87333'
                    }
                },
                fontFamily: {
                    sans: ['Inter', 'sans-serif'],
                    serif: ['Cinzel', 'serif'],           // Headings & Titles
                    mono: ['JetBrains Mono', 'monospace'] // Data & Terminal elements
                }
            }
        }
    }
</script>
```

### 4.2 Base Styling Rules

| Element | Rule |
|---|---|
| **Page background** | Always dark — `#05030a` or `#0a0a0f` |
| **UI panels** | Glassmorphism style (see below) |
| **Body text** | Light gray/slate — `#cbd5e1` |
| **Primary headings** | Cinzel serif font, gold or cyan accent color |
| **System/data output** | Monospace font (JetBrains Mono) |

**Glassmorphism panel CSS:**

```css
.glass-panel {
    background: rgba(10, 8, 20, 0.5);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(212, 175, 55, 0.2);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.6);
}
```

---

## 5. Required External Libraries

Import the appropriate libraries via CDN in `<head>` based on the module's needs.

### MathJax *(Mandatory for all mathematical content)*

All complex formulas must be rendered with LaTeX via MathJax. No plain-text math notation is permitted.

```html
<script>
    window.MathJax = {
        tex: {
            inlineMath: [['$', '$'], ['\\(', '\\)']],
            displayMath: [['$$', '$$'], ['\\[', '\\]']]
        }
    };
</script>
<script id="MathJax-script" async
    src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js">
</script>
```

### Three.js *(Required for 3D visualizations)*

Use for all 3D geometric visualizations, manifolds, and topological renders.

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
```

---

## 6. Standard Page Blueprint

Use this boilerplate when generating any new protected page for the Academy:

```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Owl Academy | [Module Name]</title>

    <!-- 1. SECURITY GUARD (Adjust path as needed) -->
    <script src="scripts/auth.js"></script>

    <!-- 2. TAILWIND + THEME CONFIG -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        mystic: {
                            900: '#0a0a0f',
                            800: '#141423',
                            700: '#23233e',
                            gold: '#d4af37',
                            accent: '#6b52ae'
                        },
                        neon: {
                            orange: '#ff8c00',
                            cyan: '#00ffff',
                            copper: '#b87333'
                        }
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        serif: ['Cinzel', 'serif'],
                        mono: ['JetBrains Mono', 'monospace']
                    }
                }
            }
        }
    </script>

    <!-- 3. FONTS -->
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

    <!-- 4. MATHJAX (include if module contains math) -->
    <script>
        window.MathJax = {
            tex: {
                inlineMath: [['$', '$'], ['\\(', '\\)']],
                displayMath: [['$$', '$$'], ['\\[', '\\]']]
            }
        };
    </script>
    <script id="MathJax-script" async
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js">
    </script>

    <!-- 5. INTERNAL STYLES -->
    <style>
        body {
            background-color: #05030a;
            color: #cbd5e1;
        }
        .glass-panel {
            background: rgba(10, 8, 20, 0.5);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(212, 175, 55, 0.2);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.6);
        }
    </style>
</head>
<body class="min-h-screen font-sans">

    <!-- PAGE CONTENT HERE -->

    <button onclick="globalLogout()">Sever Connection</button>

    <!-- INTERNAL SCRIPTS -->
    <script>
        // Module logic goes here
    </script>

</body>
</html>
```

---

*Owl Academy Developer Reference Protocol — v1.0.0*
