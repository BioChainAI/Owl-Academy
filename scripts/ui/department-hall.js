/**
 * Department Hall — shared renderer for the 10 department landing pages.
 * ----------------------------------------------------------------------------
 * Each Dept<N>_Hall.html is a thin shell that calls renderDepartmentHall("<N>").
 * The hall lists that department's canon courses (from the Major Tome canon),
 * shows lock / unlock / completion state, and wires request-unlock + claim-
 * completion inline. Until the Archon inscribes the canon, it shows placeholder
 * slots ("awaiting inscription") — ready to populate with the 145 courses.
 */
import { auth } from "../firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { resolveTier } from "../genesis-registrar.js";
import { listMinorTomes } from "../minor-tome.js";
import {
  listMajorTomes, listGrantsForStudent, listMyRequests,
  requestUnlock, claimCompletion,
} from "../major-tome.js";
import { renderTomeSVG } from "../tome-procgen.js";

export const DEPARTMENTS = {
  I:    { roman: "I",    name: "Sacred Geometry & Topology", sub: "Foundations",          color: "#D4AF37", count: 9,  featured: { href: "Sacred_Geometry/SG_Main.html",            label: "Sacred Geometry — Main Hall" } },
  II:   { roman: "II",   name: "Cryptography & Sigils",      sub: "Geometric Theory",      color: "#a855f7", count: 9,  featured: { href: "Cryptography/Cryptography_main.html",      label: "Cryptography — Main" } },
  III:  { roman: "III",  name: "Celestial Topology & Kinematics", sub: "Topology",         color: "#3b82f6", count: 9,  featured: null },
  IV:   { roman: "IV",   name: "Hyperbolic Systems",         sub: "Analysis",              color: "#f43f5e", count: 9,  featured: { href: "DeptIV_Main.html",                        label: "Hyperbolic Systems — Curriculum" } },
  V:    { roman: "V",    name: "Fractal Processing",         sub: "Computation",           color: "#10b981", count: 9,  featured: { href: "Fractal_Processing/Structural_intro.html", label: "Fractal Processing — Intro" } },
  VI:   { roman: "VI",   name: "Seed Protocols",             sub: "Sacred Sciences",       color: "#f59e0b", count: 9,  featured: { href: "Seed-Protocols/SHD-CCP-Seed.html",         label: "SHD-CCP Seed Protocol" } },
  VII:  { roman: "VII",  name: "Human Consciousness",        sub: "Consciousness Triad · sealed", color: "#a855f7", count: 9, sealed: true, featured: null },
  VIII: { roman: "VIII", name: "Soul-Mind Projection",       sub: "Consciousness Triad · sealed", color: "#14b8a6", count: 9, sealed: true, featured: null },
  IX:   { roman: "IX",   name: "AI-Human Integration",       sub: "Consciousness Triad · sealed", color: "#3b82f6", count: 9, sealed: true, featured: null },
  X:    { roman: "X",    name: "BioChain Substrate",         sub: "Substrate · Master Key", color: "#00ff88", count: 64, featured: { href: "DeptX_Sanctum.html", label: "BioChain Substrate — Sanctum" } },
};

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function renderDepartmentHall(deptCode) {
  const meta = DEPARTMENTS[deptCode];
  const root = document.getElementById("hall-root");
  if (!meta || !root) return;
  let UID = null;

  onAuthStateChanged(auth, async (user) => {
    if (!user) return; // auth-guard handles redirect
    UID = user.uid;
    let tier = "ACOLYTE"; try { tier = await resolveTier(user.uid); } catch {}
    const sym = tier === "ARCHON" ? "♛" : tier === "INSTRUCTOR" ? "⬢" : "◯";
    const who = document.getElementById("secWho");
    if (who) who.textContent = `${sym} ${tier} · ${user.uid.slice(0, 10)}…`;
    await load();
  });

  async function load() {
    const [majors, mine, grants, reqs] = await Promise.all([
      listMajorTomes().catch(() => []), listMinorTomes(UID).catch(() => []),
      listGrantsForStudent(UID).catch(() => []), listMyRequests(UID).catch(() => []),
    ]);
    const tomes = majors.filter((m) => m.dept === meta.roman).sort((a, b) => (a.globalIndex || 0) - (b.globalIndex || 0));
    const active = mine.filter((t) => t.status === "active");
    const accessReq = {}, compReq = {}, accessGrant = {}, compGrant = {};
    reqs.forEach((r) => { if ((r.kind || "access") === "completion") compReq[r.majorTomeId] = r.status; else accessReq[r.majorTomeId] = r.status; });
    grants.forEach((g) => { if (g.status === "granted") (g.kind === "completion" ? compGrant : accessGrant)[g.majorTomeId] = g; });

    const signSel = active.length
      ? `<select id="signtome" class="bg-black/60 border border-white/15 rounded px-2 py-1 text-xs">${active.map((t) => `<option value="${esc(t.sealId)}">${esc(t.label)} · ${esc(t.sealId.slice(0, 12))}…</option>`).join("")}</select>`
      : `<span class="text-xs text-gray-500">no active minor tomes — <a class="underline" style="color:${meta.color}" href="../../mage_tower/Seal_Forge.html">forge one</a></span>`;

    let body;
    if (tomes.length) {
      body = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">` + tomes.map((t) => courseCard(t, { accessReq, compReq, accessGrant, compGrant })).join("") + `</div>`;
    } else {
      // placeholder slots — ready to be inscribed with the official courses
      let slots = "";
      for (let i = 0; i < meta.count; i++) slots += `<div class="module-link opacity-50 cursor-not-allowed"><span>⬡</span><span class="flex-grow text-gray-500">Course slot ${i + 1}</span><span class="stub-tag">${meta.sealed ? "Sealed" : "Awaiting inscription"}</span></div>`;
      body = `<div class="text-xs text-gray-500 mb-4">No canon inscribed for this department yet. The ${meta.count} official course${meta.count === 1 ? "" : "s"} appear here once an Archon runs <span class="font-mono" style="color:${meta.color}">Inscribe canon manifest</span> in the Unlock Console.</div><div class="space-y-2">${slots}</div>`;
    }

    root.innerHTML = `
      <header class="text-center mb-10">
        <div class="text-[10px] tracking-[0.3em] uppercase mb-3" style="color:${meta.color}">Department ${meta.roman}${meta.sealed ? " · Sealed" : ""}</div>
        <h1 class="text-4xl md:text-5xl font-bold tracking-[0.1em] text-white mystical-font mb-4">${esc(meta.name)}</h1>
        <p class="text-gray-400 font-light max-w-2xl mx-auto">${esc(meta.sub)} — placeholder hall, ready to be populated with this department's official courses from the 145-tome canon.</p>
      </header>

      <section class="glass-panel rounded-xl p-6 md:p-8 mb-6">
        <div class="flex items-center justify-between mb-5 pb-2 border-b border-white/10 gap-3 flex-wrap">
          <h2 class="text-xs tracking-[0.2em] font-bold uppercase" style="color:${meta.color}">Canon Courses · ${tomes.length}/${meta.count}</h2>
          <div class="flex items-center gap-2 text-xs"><span class="text-gray-500">request with</span> ${signSel}</div>
        </div>
        <div id="hall-msg" class="text-xs mb-3"></div>
        ${body}
      </section>

      <section class="glass-panel rounded-xl p-5 md:p-6 mb-6">
        <h2 class="text-xs tracking-[0.2em] font-bold uppercase mb-4" style="color:${meta.color}">Hall Resources</h2>
        <div class="space-y-2">
          ${meta.featured ? `<a href="${esc(meta.featured.href)}" class="module-link"><span style="color:${meta.color}">⬡</span><span class="flex-grow">${esc(meta.featured.label)}</span><span class="live-tag stub-tag">Available</span><span class="arrow" style="color:${meta.color}">→</span></a>` : ""}
          <a href="../../mage_tower/Major_Tome.html" class="module-link"><span style="color:${meta.color}">◈</span><span class="flex-grow">Major Tome Library — request unlock &amp; claim completion</span><span class="arrow" style="color:${meta.color}">→</span></a>
          <a href="../../mage_tower/Seal_Forge.html" class="module-link"><span style="color:${meta.color}">♜</span><span class="flex-grow">Seal Forge — mint a minor tome</span><span class="arrow" style="color:${meta.color}">→</span></a>
        </div>
      </section>

      <div class="text-center mt-8"><a href="../Grand_Archives.html" class="text-xs text-gray-500 hover:text-white uppercase tracking-widest">← Back to Grand Archives</a></div>`;

    root.querySelectorAll("[data-req]").forEach((b) => b.onclick = () => act(b, "access"));
    root.querySelectorAll("[data-claim]").forEach((b) => b.onclick = () => act(b, "completion"));
  }

  function courseCard(t, m) {
    const aGrant = m.accessGrant[t.id], cGrant = m.compGrant[t.id];
    let chip, action = "";
    if (aGrant) {
      chip = `<span class="state unlocked">Unlocked</span>`;
      if (cGrant) action = `<span class="text-[10px] text-emerald-300">✓ completed · validated by ${esc((cGrant.issuerGenesisId || "").slice(0, 14))}…</span>`;
      else if (m.compReq[t.id] === "pending") action = `<span class="text-[10px] text-gray-400">completion claimed — pending validation</span>`;
      else action = `<button class="hall-btn" data-claim="${esc(t.id)}">Claim completion</button>`;
    } else if (m.accessReq[t.id] === "pending") {
      chip = `<span class="state pending">Requested</span>`;
      action = `<span class="text-[10px] text-gray-400">awaiting instructor</span>`;
    } else {
      chip = `<span class="state locked">Locked</span>`;
      action = `<button class="hall-btn" data-req="${esc(t.id)}">Request unlock</button>`;
    }
    let sigil = ""; try { if (t.canonId && t.dept) sigil = renderTomeSVG(t, 52); } catch {}
    return `<div class="course-card">
      <div class="flex gap-3 items-start">
        ${sigil ? `<div style="width:52px;height:52px;flex-shrink:0;line-height:0">${sigil}</div>` : ""}
        <div class="min-w-0 flex-grow">
          <div class="flex items-center justify-between gap-2"><span class="text-sm text-white truncate">${esc(t.title)}</span>${chip}</div>
          <div class="text-[10px] text-gray-500 font-mono mt-0.5">${esc(t.canonId || "")}${t.globalIndex ? ` · seat ${t.globalIndex}/145` : ""}</div>
          <div class="mt-2">${action}</div>
        </div>
      </div></div>`;
  }

  async function act(btn, kind) {
    const id = btn.dataset.req || btn.dataset.claim;
    const sel = document.getElementById("signtome");
    const msg = document.getElementById("hall-msg");
    if (!sel || !sel.value) { if (msg) { msg.className = "text-xs mb-3 text-rose-400"; msg.textContent = "Forge an active minor tome first (Seal Forge)."; } return; }
    btn.disabled = true;
    if (msg) { msg.className = "text-xs mb-3 text-gray-400"; msg.textContent = kind === "completion" ? "Sealing completion claim…" : "Signing unlock request…"; }
    try {
      if (kind === "completion") await claimCompletion(UID, id, sel.value);
      else await requestUnlock(UID, id, sel.value);
      if (msg) { msg.className = "text-xs mb-3 text-emerald-300"; msg.textContent = kind === "completion" ? "Completion claimed — an Instructor/Archon will validate it." : "Request sent — an Instructor will combine seals to unlock."; }
      await load();
    } catch (e) { if (msg) { msg.className = "text-xs mb-3 text-rose-400"; msg.textContent = e.message; } btn.disabled = false; }
  }
}
