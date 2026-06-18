/**
 * Sanctum UI — renders the Mage Tower dashboard panels.
 * Each render* function is independent so panels can be refreshed in isolation.
 */
import { getRankProgress } from "../services/arts.service.js";
import { getTotalXP } from "../services/user.service.js";
import { resolveTier } from "../genesis-registrar.js";
import { renderUserSigil } from "../sigil-renderer.js";
import { getDocument } from "../firebase/firestore.js";

const GENESIS_TIER_META = {
  ARCHON:     { symbol: "♛", label: "Archon",     color: "#D4AF37", glow: "rgba(212,175,55,0.55)" },
  INSTRUCTOR: { symbol: "⬢", label: "Instructor", color: "#00d4ff", glow: "rgba(0,212,255,0.45)" },
  ACOLYTE:    { symbol: "◯", label: "Acolyte",    color: "#94a3b8", glow: "rgba(148,163,184,0.25)" },
};

// ── Configuration: easy to extend with new departments/tools ──────────────────
const LIBRARY_DEPARTMENTS = [
  { id: "dept-1", title: "Department I",   subtitle: "Foundations",      icon: "✦", path: "Library/DepartmentI/",        color: "#D4AF37" },
  { id: "dept-2", title: "Department II",  subtitle: "Geometric Theory", icon: "✧", path: "Library/DepartmentII/",       color: "#00d4ff" },
  { id: "dept-3", title: "Department III", subtitle: "Topology",         icon: "❖", path: "Library/Department III/",     color: "#8A2BE2" },
  { id: "dept-4", title: "Department IV",  subtitle: "Analysis",         icon: "✺", path: "Library/Department IV/",      color: "#00ff88" },
  { id: "dept-5", title: "Department V",   subtitle: "Computation",      icon: "❉", path: "Library/Department V/",       color: "#ff6b35" },
  { id: "dept-6", title: "Department VI",  subtitle: "Sacred Sciences",  icon: "❋", path: "Library/Department VI/",      color: "#FFF8DC" },
];

const ACADEMY_TOOLS = [
  { id: "spire",     title: "SPIRE Manual",        desc: "Sacred Protocol Interface Reference Engine",  path: "Library/SPIRE/SPIRE_Manual.html",                color: "#D4AF37" },
  { id: "shd-ccp",   title: "SHD-CCP Introduction", desc: "Sequential Hyperdimensional DNA Protocol",   path: "Library/SHD-CCP/SHD-CCP_Introduction.html",      color: "#00d4ff" },
  { id: "biochain",  title: "BioChain Integration", desc: "Living architecture interface for SPIRE",    path: "BioChain-AI/BioChain_SPIRE/integration.html",    color: "#00ff88" },
  { id: "archives",  title: "Grand Archives",       desc: "Master library map and index",               path: "Library/Grand_Archives.html",                    color: "#FFF8DC" },
  { id: "hyperbolic", title: "Hyperbolic Systems",  desc: "Advanced reading pathways for topologists",  path: "Library/Hyperbolic_Systems_Learning/",           color: "#8A2BE2" },
  { id: "proofs",    title: "Proof Workshop",       desc: "Trefoil pump and topological proofs",        path: "Proofs/Torsional-Trefoil-Markov-Pump/",          color: "#ff6b35" },
  { id: "constellation", title: "Constellation Map", desc: "Live 3D map of all Genesis seeds on the SPIRE manifold", path: "mage_tower/Constellation_Map.html", color: "#8A2BE2" },
  { id: "familiars",    title: "Familiar Selection", desc: "Bind your genesis seed to a familiar archetype and generate your User Sigil", path: "mage_tower/Familiars.html", color: "#b026ff" },
  { id: "store",        title: "Mage Tower Store",   desc: "Exchange Vis tokens for familiars, cosmetics, and academy privileges",       path: "mage_tower/Store.html",    color: "#D4AF37" },
];

const TIER_PATHS = [
  { tier: 1, art: "mathematics", label: "Foundational Literacy" },
  { tier: 2, art: "computation", label: "SHD-CCP Protocol" },
  { tier: 3, art: "biochain",    label: "Biochain AI Systems" },
  { tier: 4, art: "geometry",    label: "Advanced Topologies" },
];

// ── Public API ────────────────────────────────────────────────────────────────
export const renderSanctum = (user, profile) => {
  renderWelcome(profile, user);
  renderOrrery(profile);
  renderGrimoires(profile);
  renderChronicle(profile);
  renderAthenaeum();
  renderAtelier();
};

// ── Welcome Banner (top of Sanctum) ───────────────────────────────────────────
const renderWelcome = (profile, user) => {
  const el = document.getElementById("sanctum-welcome");
  if (!el) return;

  const initial = (profile.displayName ?? "Scholar").trim().charAt(0).toUpperCase() || "?";
  const totalXP = getTotalXP(profile.arts);
  const progress = getRankProgress(profile.arts);

  // Placeholder sigil using initial letter — replaced async once cosmologicalId loads
  const placeholderSigil = `<div class="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-yellow-500/60
                    flex items-center justify-center text-3xl mystical-font text-yellow-300
                    bg-gradient-to-br from-yellow-500/10 to-purple-500/10"
             style="text-shadow: 0 0 18px rgba(212,175,55,0.6); box-shadow: inset 0 0 18px rgba(212,175,55,0.15)">
          ${initial}
        </div>`;

  el.innerHTML = `
    <div class="flex items-center gap-6 flex-wrap">
      <div class="flex-shrink-0 relative" id="sanctum-sigil-wrap">
        ${placeholderSigil}
        <div class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#05030a] border border-yellow-500
                    flex items-center justify-center text-[10px] text-yellow-400 font-mono">
          ${totalXP > 999 ? Math.floor(totalXP/1000) + "k" : totalXP}
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[10px] text-yellow-500/80 mystical-font tracking-[0.3em] uppercase mb-1">Sanctum of the</p>
        <h2 class="text-2xl md:text-3xl mystical-font gold-gradient tracking-wide mb-1">${escape(profile.rank ?? "Initiate")}</h2>
        <p class="text-sm text-slate-300">${escape(profile.displayName ?? "Scholar")} <span class="text-slate-500">·</span> <span class="text-yellow-400/80">${escape(profile.school ?? "Unaffiliated")}</span></p>
        <div id="sanctum-genesis-tier" class="mt-2 flex flex-wrap items-center gap-2"></div>
        <div class="mt-3 max-w-md">
          <div class="flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-widest mb-1">
            <span>Resonance toward next rank</span>
            <span class="text-yellow-400 font-mono">${progress}%</span>
          </div>
          <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-yellow-600 to-yellow-300 transition-all duration-700" style="width: ${progress}%"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Async: resolve Genesis tier and inject badge + Admin link
  if (user && user.uid) {
    resolveTier(user.uid).then(async tier => {
      const meta = GENESIS_TIER_META[tier] || GENESIS_TIER_META.ACOLYTE;
      const badgeEl = document.getElementById("sanctum-genesis-tier");
      if (!badgeEl) return;
      const isAdmin = tier === "INSTRUCTOR" || tier === "ARCHON";
      badgeEl.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-widest"
              style="border:1px solid ${meta.color}55; background:${meta.color}12; color:${meta.color}; text-shadow:0 0 8px ${meta.glow};">
          <span style="font-size:14px;line-height:1;">${meta.symbol}</span> ${meta.label}
        </span>
        ${isAdmin ? `
          <a href="mage_tower/Admin_Console.html"
             class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-widest transition hover:opacity-80"
             style="border:1px solid #D4AF3755; background:#D4AF3712; color:#D4AF37; text-shadow:0 0 8px rgba(212,175,55,0.45);">
            ♛ Open Admin Console →
          </a>
          <a href="mage_tower/Instructor_Console.html"
             class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-widest transition hover:opacity-80"
             style="border:1px solid #00d4ff55; background:#00d4ff12; color:#00d4ff;">
            ⬢ Authoring
          </a>
        ` : `
          <a href="mage_tower/Codex.html"
             class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-widest transition hover:opacity-80"
             style="border:1px solid #94a3b855; background:#94a3b812; color:#cbd5e1;">
            View Codex →
          </a>
        `}
        <a href="mage_tower/Familiars.html"
           class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-widest transition hover:opacity-80"
           style="border:1px solid #b026ff55; background:#b026ff12; color:#b026ff;">
          ✦ Familiar
        </a>
      `;

      // Async: load cosmologicalId and replace placeholder with real sigil
      try {
        const [registrar, constDoc] = await Promise.all([
          getDocument(`users/${user.uid}/registrar/main`),
          getDocument(`constellations/${user.uid}`).catch(() => null),
        ]);
        const cosmologicalId = registrar?.cosmologicalId || user.uid;
        const orbitals = constDoc?.orbitals || {};
        const guilds = profile?.guilds || [];
        const sigilSvg = renderUserSigil({ cosmologicalId, tier, guilds, orbitals, size: 96 });
        const wrap = document.getElementById("sanctum-sigil-wrap");
        if (wrap) wrap.innerHTML = `
          <a href="mage_tower/Familiars.html" title="View your familiar" style="display:block;line-height:0;">
            ${sigilSvg}
          </a>
          <div class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#05030a] border border-yellow-500
                      flex items-center justify-center text-[10px] text-yellow-400 font-mono">
            ${totalXP > 999 ? Math.floor(totalXP/1000) + "k" : totalXP}
          </div>`;
      } catch(_) {}
    }).catch(() => {});
  }
};

// ── The Orrery (per-Art XP visualization) ─────────────────────────────────────
const renderOrrery = (profile) => {
  const el = document.getElementById("sanctum-orrery");
  if (!el) return;

  const arts = profile.arts ?? {};
  const max = Math.max(50, ...Object.values(arts));
  const ART_META = {
    mathematics:     { label: "Mathematics",     color: "#D4AF37" },
    geometry:        { label: "Geometry",        color: "#00d4ff" },
    sacred_sciences: { label: "Sacred Sciences", color: "#8A2BE2" },
    biochain:        { label: "Biochain",        color: "#00ff88" },
    computation:     { label: "Computation",     color: "#ff6b35" },
  };

  el.innerHTML = Object.entries(ART_META).map(([key, meta]) => {
    const xp = arts[key] ?? 0;
    const pct = Math.round((xp / max) * 100);
    return `
      <div class="mb-3 last:mb-0">
        <div class="flex justify-between items-baseline mb-1">
          <span class="text-xs text-slate-300 mystical-font tracking-wide">${meta.label}</span>
          <span class="text-xs font-mono" style="color:${meta.color}">${xp} XP</span>
        </div>
        <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full transition-all duration-700"
               style="width: ${pct}%; background: linear-gradient(90deg, ${meta.color}80, ${meta.color}); box-shadow: 0 0 8px ${meta.color}60"></div>
        </div>
      </div>
    `;
  }).join("");
};

// ── Active Grimoires (in-progress tomes) ──────────────────────────────────────
const renderGrimoires = (profile) => {
  const el = document.getElementById("sanctum-grimoires");
  if (!el) return;

  const tomes = Object.entries(profile.tomes ?? {})
    .filter(([_, t]) => t && t.status === "reading")
    .slice(0, 4);

  if (tomes.length === 0) {
    el.innerHTML = `
      <div class="text-center py-6">
        <p class="text-slate-500 text-sm italic mb-3">No tomes currently open</p>
        <a href="#" data-hub-tab-link="curriculum"
           class="inline-block text-yellow-500 hover:text-yellow-300 text-xs uppercase tracking-widest border-b border-yellow-500/40 hover:border-yellow-300 pb-0.5 transition">
          Open Your First Tome →
        </a>
      </div>`;
    return;
  }

  el.innerHTML = tomes.map(([id, t]) => `
    <div class="py-3 border-b border-white/5 last:border-0">
      <div class="flex justify-between items-start gap-2 mb-1.5">
        <p class="text-sm text-white font-medium">${escape(id)}</p>
        <span class="text-[10px] text-slate-500 whitespace-nowrap">${Math.round((t.progress ?? 0) * 100)}%</span>
      </div>
      <div class="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div class="h-full bg-gradient-to-r from-yellow-600 to-yellow-300" style="width: ${(t.progress ?? 0) * 100}%"></div>
      </div>
    </div>
  `).join("");
};

// ── The Chronicle (recent activity, derived from profile state) ───────────────
const renderChronicle = (profile) => {
  const el = document.getElementById("sanctum-chronicle");
  if (!el) return;

  const events = [];

  if (profile.school) {
    events.push({ icon: "✦", text: `Sworn to the ${escape(profile.school)} School`, color: "#D4AF37" });
  }

  const totalXP = getTotalXP(profile.arts);
  if (totalXP > 0) {
    events.push({ icon: "★", text: `Total Resonance: <span class="font-mono text-cyan-400">${totalXP}</span> XP across all Arts`, color: "#00d4ff" });
  }

  const topArt = Object.entries(profile.arts ?? {})
    .sort(([, a], [, b]) => b - a)[0];
  if (topArt && topArt[1] > 0) {
    const artName = topArt[0].replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    events.push({ icon: "❖", text: `Strongest Art: <span class="text-purple-300">${artName}</span> at ${topArt[1]} XP`, color: "#8A2BE2" });
  }

  if ((profile.vis ?? 0) > 0) {
    events.push({ icon: "◆", text: `Treasury: <span class="font-mono text-yellow-400">${profile.vis}</span> Vis accumulated`, color: "#D4AF37" });
  }

  events.push({ icon: "⬡", text: `Rank: <span class="text-yellow-300">${escape(profile.rank ?? "Initiate")}</span>`, color: "#D4AF37" });

  if (events.length === 0) {
    el.innerHTML = `<p class="text-slate-500 text-sm italic text-center py-6">No chronicle entries yet</p>`;
    return;
  }

  el.innerHTML = events.map(e => `
    <div class="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
      <span class="text-sm flex-shrink-0 mt-0.5" style="color:${e.color}; text-shadow: 0 0 6px ${e.color}80">${e.icon}</span>
      <p class="text-xs text-slate-300 leading-relaxed flex-1">${e.text}</p>
    </div>
  `).join("");
};

// ── The Athenaeum (Library Department Tiles) ──────────────────────────────────
const renderAthenaeum = () => {
  const el = document.getElementById("sanctum-athenaeum");
  if (!el) return;

  el.innerHTML = LIBRARY_DEPARTMENTS.map(d => `
    <a href="${d.path}"
       class="group block p-4 rounded-lg border border-white/5 hover:border-yellow-500/40
              bg-black/20 hover:bg-yellow-500/5 transition-all duration-300
              hover:shadow-[0_0_20px_rgba(212,175,55,0.1)] hover:-translate-y-0.5">
      <div class="text-2xl mb-2 group-hover:scale-110 transition-transform"
           style="color: ${d.color}; text-shadow: 0 0 12px ${d.color}80">${d.icon}</div>
      <p class="text-sm text-white mystical-font tracking-wide mb-0.5">${d.title}</p>
      <p class="text-[10px] text-slate-400">${d.subtitle}</p>
    </a>
  `).join("");
};

// ── The Atelier (Tools & Protocols) ───────────────────────────────────────────
const renderAtelier = () => {
  const el = document.getElementById("sanctum-atelier");
  if (!el) return;

  el.innerHTML = ACADEMY_TOOLS.map(t => `
    <a href="${t.path}"
       class="group block p-5 rounded-lg border border-white/5 hover:border-cyan-500/40
              bg-black/20 hover:bg-cyan-500/5 transition-all duration-300
              hover:shadow-[0_0_20px_rgba(0,212,255,0.1)]">
      <div class="flex items-start gap-3">
        <span class="text-xl flex-shrink-0 mt-1" style="color:${t.color}">⬢</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm mystical-font tracking-wide mb-1" style="color: ${t.color}">${escape(t.title)}</p>
          <p class="text-[10px] text-slate-400 leading-relaxed">${escape(t.desc)}</p>
        </div>
        <svg class="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all flex-shrink-0"
             fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </div>
    </a>
  `).join("");
};

// ── Full Athenaeum Tab (extended library view) ────────────────────────────────
export const renderAthenaeumFull = () => {
  const el = document.getElementById("athenaeum-full");
  if (!el) return;

  el.innerHTML = `
    <h2 class="mystical-font text-2xl gold-gradient tracking-wide mb-2">The Athenaeum</h2>
    <p class="text-slate-400 text-sm mb-8">The complete library archive — six Departments of Study, each holding its own tomes and proofs.</p>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
      ${LIBRARY_DEPARTMENTS.map(d => `
        <a href="${d.path}" class="group block p-6 rounded-xl border border-white/5 hover:border-yellow-500/40
                  bg-black/20 hover:bg-yellow-500/5 transition-all duration-300
                  hover:shadow-[0_0_25px_rgba(212,175,55,0.15)]">
          <div class="text-4xl mb-3" style="color: ${d.color}; text-shadow: 0 0 16px ${d.color}80">${d.icon}</div>
          <h3 class="text-base text-white mystical-font tracking-wide mb-1">${d.title}</h3>
          <p class="text-xs text-slate-400 mb-3">${d.subtitle}</p>
          <span class="text-[10px] text-yellow-500/80 uppercase tracking-widest group-hover:text-yellow-400">Enter Department →</span>
        </a>
      `).join("")}
    </div>

    <div class="border-t border-yellow-600/20 pt-6">
      <h3 class="mystical-font text-sm text-yellow-500 tracking-widest uppercase mb-4">Reading Pathways</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <a href="Library/Hyperbolic_Systems_Learning/" class="block p-4 rounded-lg border border-white/5 hover:border-purple-500/40 bg-black/20 hover:bg-purple-500/5 transition-all">
          <p class="text-sm mystical-font text-purple-300 mb-1">Hyperbolic Systems</p>
          <p class="text-[10px] text-slate-400">Beginner → Research-level reading pathways</p>
        </a>
        <a href="Library/Grand_Archives.html" class="block p-4 rounded-lg border border-white/5 hover:border-yellow-500/40 bg-black/20 hover:bg-yellow-500/5 transition-all">
          <p class="text-sm mystical-font text-yellow-300 mb-1">Grand Archives Map</p>
          <p class="text-[10px] text-slate-400">Master index of every tome in the academy</p>
        </a>
      </div>
    </div>
  `;
};

export const renderAtelierFull = () => {
  const el = document.getElementById("atelier-full");
  if (!el) return;

  el.innerHTML = `
    <h2 class="mystical-font text-2xl gold-gradient tracking-wide mb-2">The Atelier</h2>
    <p class="text-slate-400 text-sm mb-8">Specialized workshops and protocol references for advanced practitioners.</p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
      ${ACADEMY_TOOLS.map(t => `
        <a href="${t.path}" class="group block p-6 rounded-xl border border-white/5 hover:border-cyan-500/40
                  bg-black/20 hover:bg-cyan-500/5 transition-all duration-300
                  hover:shadow-[0_0_25px_rgba(0,212,255,0.15)]">
          <div class="flex items-start gap-3 mb-3">
            <span class="text-2xl" style="color:${t.color}; text-shadow: 0 0 12px ${t.color}80">⬢</span>
            <h3 class="text-base text-white mystical-font tracking-wide" style="color: ${t.color}">${escape(t.title)}</h3>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed mb-3">${escape(t.desc)}</p>
          <span class="text-[10px] uppercase tracking-widest group-hover:text-cyan-400 text-slate-500">Open Workspace →</span>
        </a>
      `).join("")}
    </div>

    <div class="border-t border-cyan-500/20 pt-6">
      <h3 class="mystical-font text-sm text-cyan-400 tracking-widest uppercase mb-4">Curriculum Tiers Quick-Jump</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        ${TIER_PATHS.map(t => `
          <a href="#" data-hub-tab-link="curriculum" data-hub-tab-anchor="tier-${t.tier}"
             class="block p-3 rounded-lg border border-white/5 hover:border-yellow-500/40 bg-black/20 hover:bg-yellow-500/5 transition-all text-center">
            <p class="text-xs text-yellow-500 mystical-font tracking-widest mb-1">TIER ${t.tier}</p>
            <p class="text-[10px] text-slate-400">${t.label}</p>
          </a>
        `).join("")}
      </div>
    </div>
  `;
};

// ── HTML escape helper ────────────────────────────────────────────────────────
const escape = (str = "") =>
  String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
