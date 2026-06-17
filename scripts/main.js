import { onAuthChange, signInWithGoogle, signOutUser } from "./firebase/auth.js";
import { getOrCreateProfile, watchProfile } from "./services/user.service.js";
import { getActiveQuests } from "./services/quest.service.js";
import { renderHubProfile, renderQuestPanel, showToast } from "./ui/hub.ui.js";
import { promptSchoolSelection } from "./ui/profile.ui.js";

let profileUnsubscribe = null;

const initHub = async (user) => {
  // First load — create profile doc if it doesn't exist yet
  const profile = await getOrCreateProfile(user);

  // Prompt new users to pick their school
  if (!profile.school) {
    promptSchoolSelection(user.uid);
  }

  // Render initial state
  renderHubProfile(user, profile);

  // Load active quests
  const quests = await getActiveQuests(user.uid);
  renderQuestPanel(quests);

  // Live-sync profile changes (rank-ups, XP, Vis) without page reload
  if (profileUnsubscribe) profileUnsubscribe();
  profileUnsubscribe = watchProfile(user.uid, (updatedProfile) => {
    if (updatedProfile) renderHubProfile(user, updatedProfile);
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
