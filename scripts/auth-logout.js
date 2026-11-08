/**
 * Owl Academy logout: one implementation for every "Log out" button.
 *
 *   1. signs the Owl Academy Firebase session out (signOut(auth));
 *   2. removes only the browser-storage keys that Owl Academy itself writes
 *      (listed below), leaving other sites' and apps' data alone;
 *   3. redirects to login.html (or wherever the caller asks).
 *
 * Kept on logout, on purpose:
 *   - engram_mind_eye_v1         Engram Mind Eye saved session (saved work)
 *   - owl.platonic.progress.v1   lesson progress on this browser (saved work;
 *   - owl.noble.progress.v1        each lesson has its own reset button)
 *
 * New Owl keys get an "owl." prefix and are added to one of the lists here.
 *
 * Usage
 *   ES module:     import { owlLogout } from "<root>/scripts/auth-logout.js";
 *                  owlLogout();                      // sign out, clean, redirect
 *                  owlLogout({ redirect: false });   // stay on the page
 *   classic page:  import("<relative path>/scripts/auth-logout.js")
 *                    .then((m) => m.owlLogout());
 *
 * Firebase is imported lazily inside owlLogout, so the key lists and
 * removeOwlStorage() can be tested in Node without a browser.
 */

/** localStorage keys written by Owl Academy and removed on logout. */
export const OWL_LOCAL_KEYS = Object.freeze([
  "owlAcademy_codex",          // scripts/spire-registrar.js: registrar backup (re-synced by Codex.html)
  "owl_hub_tab",               // scripts/ui/tabs.ui.js: last Learning-Hub tab
  "owl_academy_session_token", // legacy key named in Security/Developer-Reference-Protocol.md
  "owl_academy_tomes",         // legacy key named in Security/Developer-Reference-Protocol.md
]);

/** sessionStorage key prefixes written by Owl Academy and removed on logout. */
export const OWL_SESSION_PREFIXES = Object.freeze([
  "tut_idx_",                  // mage_tower/tutorial_engine.js: tutorial slide position per page
]);

/** Owl keys that logout keeps (saved work). */
export const OWL_KEPT_KEYS = Object.freeze([
  "engram_mind_eye_v1",
  "owl.platonic.progress.v1",
  "owl.noble.progress.v1",
]);

function storageKeys(storage) {
  const keys = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k !== null) keys.push(k);
    }
  } catch (_) { /* storage blocked */ }
  return keys;
}

/**
 * Remove Owl's own keys from the given storages. Returns the removed keys.
 * Anything not listed above (other apps on the same origin, saved work) stays.
 */
function storageOf(name) {
  // Reading window.localStorage itself throws (SecurityError) where storage is blocked.
  try { return globalThis[name]; } catch (_) { return null; }
}

export function removeOwlStorage(local = storageOf("localStorage"), session = storageOf("sessionStorage")) {
  const removed = [];
  if (local) {
    for (const k of OWL_LOCAL_KEYS) {
      try {
        if (local.getItem(k) !== null) { local.removeItem(k); removed.push("local:" + k); }
      } catch (_) { /* storage blocked */ }
    }
  }
  if (session) {
    for (const k of storageKeys(session)) {
      if (OWL_SESSION_PREFIXES.some((p) => k.startsWith(p))) {
        try { session.removeItem(k); removed.push("session:" + k); } catch (_) { /* storage blocked */ }
      }
    }
  }
  return removed;
}

/** URL of Owl's login page, resolved from this module's own location. */
export function loginUrl() {
  return new URL("../login.html", import.meta.url).href;
}

const FIREBASE_AUTH = "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

/**
 * Sign out, remove Owl's keys, then redirect.
 * @param {object} [opts]
 * @param {string|false} [opts.redirect] URL to go to afterwards (default: login.html);
 *        false stays on the page.
 * @param {boolean} [opts.replace=true] use location.replace (no history entry).
 */
export async function owlLogout({ redirect, replace = true } = {}) {
  // Before and after signOut: listeners that run on sign-out may navigate away.
  // Storage cleanup never stops the sign-out.
  try { removeOwlStorage(); } catch (_) { /* storage blocked */ }
  try {
    const [{ auth }, { signOut }] = await Promise.all([
      import("./firebase/config.js"),
      import(FIREBASE_AUTH),
    ]);
    if (typeof auth.authStateReady === "function") await auth.authStateReady();
    await signOut(auth);
  } catch (err) {
    console.error("[Owl Academy] signOut failed:", err);
  }
  try { removeOwlStorage(); } catch (_) { /* storage blocked */ }
  if (redirect === false) return;
  const target = redirect || loginUrl();
  if (replace) window.location.replace(target);
  else window.location.href = target;
}

if (typeof window !== "undefined") window.owlLogout = owlLogout;
