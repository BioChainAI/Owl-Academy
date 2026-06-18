import { onAuthChange, signInWithGoogle, signOutUser } from "./firebase/auth.js";
import { getOrCreateProfile, watchProfile } from "./services/user.service.js";
import { getActiveQuests } from "./services/quest.service.js";
import { checkAndAwardLevelUp } from "./services/vis.service.js";
import { renderHubProfile, renderQuestPanel, showToast } from "./ui/hub.ui.js";
import { promptSchoolSelection } from "./ui/profile.ui.js";
import { renderSanctum, renderAthenaeumFull, renderAtelierFull } from "./ui/sanctum.ui.js";
import { initHubTabs } from "./ui/tabs.ui.js";

let profileUnsubscribe = null;

const initHub = async (user) => {
  try {
    // First load — create profile doc if it doesn't exist yet
    const profile = await getOrCreateProfile(user);

    // Prompt new users to pick their school
    if (!profile.school) {
      promptSchoolSelection(user.uid);
    }

    // Check for level-up and award Vis (fire-and-forget, never blocks UI)
    if (profile.arts) checkAndAwardLevelUp(user.uid, profile.arts).catch(() => {});

    // Render initial state across all panels
    renderHubProfile(user, profile);
    renderSanctum(user, profile);
    renderAthenaeumFull();
    renderAtelierFull();

    // Initialize tab navigation (Sanctum is default)
    initHubTabs("sanctum");

    // Load active quests
    const quests = await getActiveQuests(user.uid);
    renderQuestPanel(quests);

    // Live-sync profile changes (rank-ups, XP, Vis) across all panels without reload
    if (profileUnsubscribe) profileUnsubscribe();
    profileUnsubscribe = watchProfile(user.uid, (updatedProfile) => {
      if (updatedProfile) {
        renderHubProfile(user, updatedProfile);
        renderSanctum(user, updatedProfile);
      }
    });

    // Wire sign-out (button rendered inside hub.ui.js, so listen via delegation)
    document.addEventListener("click", async (e) => {
      if (e.target.id === "btn-signout") {
        if (profileUnsubscribe) profileUnsubscribe();
        await signOutUser();
        showToast("Resonance closed. Farewell, Scholar.", "info");
      }
    }, { once: false });

    showToast(`Welcome back, ${profile.rank ?? "Initiate"} ${user.displayName?.split(" ")[0] ?? "Scholar"}`, "success");
  } catch (err) {
    console.error("[Owl Academy] initHub failed:", err);
    showToast(`Error loading hub: ${err.message}`, "error");
    // Show a minimal recovery UI in the profile bar
    const bar = document.getElementById("hub-profile-bar");
    if (bar) {
      bar.innerHTML = `
        <div class="glass-panel rounded-xl px-6 py-3 border border-red-600/30 flex items-center justify-between gap-4">
          <span class="text-xs text-red-400 font-mono">Resonance disrupted — could not load profile.</span>
          <button id="btn-signout" class="text-[10px] text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest cursor-pointer">Sign Out</button>
        </div>`;
    }
  }
};

// ── Auth State Machine ────────────────────────────────────────────────────────
onAuthChange(async (user) => {
  if (user) {
    await initHub(user);
  } else {
    // Not signed in — redirect to login preserving destination
    const destination = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`login.html?redirect=${destination}`);
  }
});
