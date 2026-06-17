import { updateProfile, SCHOOLS } from "../services/user.service.js";
import { showToast } from "./hub.ui.js";

/**
 * Renders the school-selection modal when a new user hasn't chosen one yet.
 * Call this once after profile creation if profile.school is null.
 */
export const promptSchoolSelection = (uid) => {
  const existing = document.getElementById("school-modal");
  if (existing) return;

  const modal = document.createElement("div");
  modal.id = "school-modal";
  modal.className = "fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="glass-panel rounded-2xl p-8 max-w-lg w-full mx-4 border border-yellow-600/30">
      <h2 class="mystical-font text-2xl text-yellow-400 mb-2 text-center tracking-widest">Choose Your School</h2>
      <p class="text-slate-400 text-sm text-center mb-6">Your School of Study defines your primary Art and unlocks specialised tomes.</p>
      <div class="grid grid-cols-1 gap-3">
        ${SCHOOLS.map((school) => `
          <button data-school="${school}"
                  class="school-btn text-left px-5 py-3 rounded-lg border border-yellow-600/20 bg-yellow-600/5
                         hover:border-yellow-500/60 hover:bg-yellow-600/15 transition-all duration-200
                         text-sm text-slate-200 mystical-font tracking-wide cursor-pointer">
            ${school}
          </button>
        `).join("")}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll(".school-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const school = btn.dataset.school;
      await updateProfile(uid, { school });
      showToast(`School of ${school} chosen`, "success");
      modal.remove();
    });
  });
};
