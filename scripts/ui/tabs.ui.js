/**
 * Hub Tab Manager — controls switching between dashboard views in Learning-Hub.
 *
 * Markup contract:
 *   - Buttons: <button data-hub-tab="sanctum">...</button>
 *   - Panels:  <div data-hub-content="sanctum">...</div>
 *   - Sidebar items: <div data-sidebar-tab="curriculum,athenaeum">...</div>
 *     (comma-separated list of tabs where this sidebar item should be visible)
 */

const ACTIVE_CLASS = "active-tab";

const setTab = (target) => {
  document.querySelectorAll("[data-hub-tab]").forEach((btn) =>
    btn.classList.toggle(ACTIVE_CLASS, btn.dataset.hubTab === target)
  );

  document.querySelectorAll("[data-hub-content]").forEach((panel) =>
    panel.classList.toggle("hidden", panel.dataset.hubContent !== target)
  );

  // Conditionally show sidebar blocks based on active tab
  document.querySelectorAll("[data-sidebar-tab]").forEach((item) => {
    const allowed = item.dataset.sidebarTab.split(",").map((s) => s.trim());
    item.classList.toggle("hidden", !allowed.includes(target));
  });

  // Persist for next visit
  try { localStorage.setItem("owl_hub_tab", target); } catch (e) { /* ignore */ }
};

export const switchHubTab = setTab;

export const initHubTabs = (defaultTab = "sanctum") => {
  document.querySelectorAll("[data-hub-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.hubTab));
  });

  // Any link/button with `data-hub-tab-link` switches tabs when clicked
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-hub-tab-link]");
    if (trigger) {
      e.preventDefault();
      setTab(trigger.dataset.hubTabLink);
      // If trigger has an anchor target, scroll after switching
      const anchor = trigger.dataset.hubTabAnchor;
      if (anchor) {
        setTimeout(() => {
          document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  });

  let initial = defaultTab;
  try {
    const saved = localStorage.getItem("owl_hub_tab");
    if (saved && document.querySelector(`[data-hub-tab="${saved}"]`)) initial = saved;
  } catch (e) { /* ignore */ }

  setTab(initial);
};
