#!/usr/bin/env node
/**
 * Scaffold the 10 department landing pages ("Halls").
 * ---------------------------------------------------------------------------
 * Each Library/<folder>/Dept<ROMAN>_Hall.html is a thin, themed shell that
 * defers to scripts/ui/department-hall.js (shared renderer). Idempotent.
 *
 *   node tools/scaffold-dept-halls.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

const DEPTS = [
  { roman: "I",    folder: "DepartmentI",     name: "Sacred Geometry & Topology",      color: "#D4AF37" },
  { roman: "II",   folder: "DepartmentII",    name: "Cryptography & Sigils",           color: "#a855f7" },
  { roman: "III",  folder: "Department III",  name: "Celestial Topology & Kinematics", color: "#3b82f6" },
  { roman: "IV",   folder: "Department IV",   name: "Hyperbolic Systems",              color: "#f43f5e" },
  { roman: "V",    folder: "Department V",    name: "Fractal Processing",              color: "#10b981" },
  { roman: "VI",   folder: "Department VI",   name: "Seed Protocols",                  color: "#f59e0b" },
  { roman: "VII",  folder: "Department VII",  name: "Human Consciousness",             color: "#a855f7" },
  { roman: "VIII", folder: "Department VIII", name: "Soul-Mind Projection",            color: "#14b8a6" },
  { roman: "IX",   folder: "Department IX",   name: "AI-Human Integration",            color: "#3b82f6" },
  { roman: "X",    folder: "Department X",    name: "BioChain Substrate",              color: "#00ff88" },
];

const css = (C) => `
    :root { --color-void:#05030a; --color-primary:${C}; }
    * { box-sizing:border-box; }
    body { background-color:var(--color-void); color:#e2e8f0; font-family:'Inter',sans-serif; min-height:100vh;
           background:radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--color-primary) 8%, var(--color-void)), var(--color-void) 60%); }
    h1,h2,h3,.mystical-font { font-family:'Cinzel',serif; }
    .mono { font-family:'Fira Code',ui-monospace,monospace; }
    .secbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:.55rem 1.1rem;
              background:rgba(8,12,22,.85); border-bottom:1px solid color-mix(in srgb,var(--color-primary) 30%,transparent);
              position:sticky; top:0; z-index:30; backdrop-filter:blur(8px); }
    .seal { display:flex; align-items:center; gap:.5rem; font-size:.64rem; letter-spacing:.16em; text-transform:uppercase; color:var(--color-primary); }
    .seal .g { width:20px; height:20px; border:1px solid var(--color-primary); border-radius:50%; display:flex; align-items:center; justify-content:center; }
    .logout { background:transparent; border:1px solid color-mix(in srgb,var(--color-primary) 45%,transparent); color:var(--color-primary);
              border-radius:6px; padding:.3rem .7rem; font-size:.6rem; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; font-family:inherit; }
    .glass-panel { background:rgba(10,8,20,.5); backdrop-filter:blur(12px); border:1px solid color-mix(in srgb,var(--color-primary) 25%,transparent); box-shadow:0 8px 32px 0 rgba(0,0,0,.6); }
    .module-link { display:flex; align-items:center; gap:.75rem; padding:.85rem 1rem; border:1px solid rgba(255,255,255,.08); border-radius:.5rem;
                   background:rgba(0,0,0,.3); text-decoration:none; color:#e2e8f0; transition:all .2s ease; }
    .module-link:hover { border-color:var(--color-primary); background:color-mix(in srgb,var(--color-primary) 8%,transparent); transform:translateX(4px); }
    .module-link .arrow { margin-left:auto; opacity:.4; transition:all .2s; } .module-link:hover .arrow { opacity:1; transform:translateX(4px); }
    .stub-tag { font-size:9px; letter-spacing:.2em; text-transform:uppercase; padding:2px 8px; border-radius:999px; border:1px solid rgba(255,255,255,.15); color:#94a3b8; white-space:nowrap; }
    .live-tag { border-color:color-mix(in srgb,var(--color-primary) 60%,transparent); color:var(--color-primary); background:color-mix(in srgb,var(--color-primary) 12%,transparent); }
    .course-card { border:1px solid rgba(255,255,255,.08); border-radius:.6rem; background:rgba(0,0,0,.3); padding:.8rem .9rem; }
    .state { font-size:.5rem; letter-spacing:.1em; text-transform:uppercase; border:1px solid; border-radius:999px; padding:.15em .55em; white-space:nowrap; }
    .state.unlocked { color:#34d399; border-color:#34d399; } .state.pending { color:#22d3ee; border-color:#22d3ee; } .state.locked { color:#fbbf24; border-color:#fbbf24; }
    .hall-btn { background:color-mix(in srgb,var(--color-primary) 16%,transparent); color:var(--color-primary); border:1px solid color-mix(in srgb,var(--color-primary) 45%,transparent);
                border-radius:6px; padding:.3rem .7rem; font-size:.62rem; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; font-family:inherit; }
    .hall-btn:hover { background:color-mix(in srgb,var(--color-primary) 28%,transparent); } .hall-btn:disabled { opacity:.4; cursor:not-allowed; }`;

const page = (d) => `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Owl Academy | Dept ${d.roman}: ${d.name}</title>

    <!-- SECURITY: Genesis auth gate -->
    <script type="module" src="../../scripts/auth-guard.js"></script>

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
    <style>${css(d.color)}
    </style>
</head>
<body class="antialiased">
    <div class="secbar">
      <div class="seal"><span class="g">♛</span> Genesis-Sealed</div>
      <div class="mono" id="secWho" style="font-size:.62rem;color:rgba(255,255,255,.42)">authenticating…</div>
      <button class="logout" onclick="globalLogout()">Log out</button>
    </div>

    <main id="hall-root" class="max-w-5xl mx-auto px-6 py-12">
      <div class="text-center text-gray-500 text-sm py-20">Loading Department ${d.roman}…</div>
    </main>

    <script type="module">
      import { renderDepartmentHall } from "../../scripts/ui/department-hall.js";
      renderDepartmentHall("${d.roman}");
    </script>
</body>
</html>
`;

for (const d of DEPTS) {
  const dir = ROOT + "Library/" + d.folder;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/Dept${d.roman}_Hall.html`, page(d));
}
console.log(`wrote ${DEPTS.length} department halls: ${DEPTS.map((d) => "Dept" + d.roman + "_Hall").join(", ")}`);
