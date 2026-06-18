import { getRankProgress, getTotalXP } from "../services/arts.service.js";

const ART_LABELS = {
  mathematics:    "Mathematics",
  geometry:       "Geometry",
  sacred_sciences:"Sacred Sciences",
  biochain:       "Biochain",
  computation:    "Computation",
};

const ART_COLORS = {
  mathematics:    "#D4AF37",
  geometry:       "#00d4ff",
  sacred_sciences:"#8A2BE2",
  biochain:       "#00ff88",
  computation:    "#ff6b35",
};

export const renderHubProfile = (user, profile) => {
  const bar = document.getElementById("hub-profile-bar");
  if (!bar) return;
  // Hide the static fallback sign-out once the full profile bar renders
  document.getElementById("hub-static-signout")?.remove();

  const totalXP = getTotalXP(profile.arts);
  const progress = getRankProgress(profile.arts);

  bar.innerHTML = `
    <div class="flex items-center gap-4 flex-wrap">
      <img src="${profile.avatarUrl || 'storage/logos/main/owl-placeholder.svg'}"
           alt="Avatar"
           class="w-10 h-10 rounded-full border-2 border-yellow-500/60 object-cover"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%23D4AF37%22 opacity=%220.3%22/><text x=%2250%%22 y=%2255%%22 text-anchor=%22middle%22 fill=%22%23D4AF37%22 font-size=%2218%22>⬡</text></svg>'">
      <div class="flex flex-col min-w-0">
        <span class="text-white font-semibold text-sm truncate">${profile.displayName}</span>
        <span class="text-yellow-500/80 text-xs mystical-font tracking-widest">${profile.rank ?? "Initiate"} · ${profile.school ?? "Unaffiliated"}</span>
      </div>
      <div class="flex items-center gap-3 ml-auto flex-wrap">
        <div class="flex items-center gap-1.5 text-xs text-cyan-400">
          <span class="font-mono font-bold">${totalXP}</span>
          <span class="text-slate-400">XP</span>
        </div>
        <div class="flex items-center gap-1.5 text-xs text-yellow-400">
          <span class="font-mono font-bold">${profile.vis ?? 0}</span>
          <span class="text-slate-400">Vis</span>
        </div>
        <div class="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden" title="Rank progress: ${progress}%">
          <div class="h-full bg-gradient-to-r from-yellow-600 to-yellow-300 rounded-full transition-all duration-700"
               style="width: ${progress}%"></div>
        </div>
        <button id="btn-signout"
                class="text-[10px] text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest ml-2 cursor-pointer">
          Sign Out
        </button>
      </div>
    </div>
    <div id="arts-bar" class="mt-3 flex gap-2 flex-wrap">
      ${renderArtsBar(profile.arts)}
    </div>
  `;
};

export const renderArtsBar = (arts = {}) =>
  Object.entries(ART_LABELS).map(([key, label]) => {
    const xp = arts[key] ?? 0;
    const color = ART_COLORS[key];
    return `
      <div class="flex items-center gap-1.5 text-[10px] text-slate-400 group" title="${label}: ${xp} XP">
        <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${color}; box-shadow: 0 0 6px ${color}80"></span>
        <span class="hidden sm:inline">${label}</span>
        <span class="font-mono" style="color:${color}">${xp}</span>
      </div>
    `;
  }).join("");

export const renderQuestPanel = (quests = []) => {
  const panel = document.getElementById("hub-quest-panel");
  if (!panel) return;

  if (quests.length === 0) {
    panel.innerHTML = `<p class="text-xs text-slate-500 italic">All quests complete. More incoming.</p>`;
    return;
  }

  panel.innerHTML = quests.map((q) => `
    <div class="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
      <div class="w-5 h-5 rounded border border-yellow-600/40 flex-shrink-0 mt-0.5 flex items-center justify-center">
        <span class="text-[8px] text-yellow-500">⬡</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs text-white font-medium">${q.title}</p>
        <p class="text-[10px] text-slate-400 leading-relaxed">${q.description}</p>
        <p class="text-[10px] text-yellow-600/80 mt-1">+${q.reward.xp} XP · +${q.reward.vis} Vis</p>
      </div>
    </div>
  `).join("");
};

export const showToast = (message, type = "info") => {
  const colors = {
    info:    "border-yellow-600/40 text-yellow-300",
    success: "border-green-500/40 text-green-300",
    error:   "border-red-500/40 text-red-300",
  };
  const toast = document.createElement("div");
  toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] glass-panel px-6 py-3 rounded-full text-xs tracking-widest uppercase font-mono border ${colors[type] ?? colors.info} shadow-xl transition-all duration-500 opacity-0`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = "1"; });
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, 3500);
};
