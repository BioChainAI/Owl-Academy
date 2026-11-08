/**
 * Auth Guard — include as <script type="module"> on any protected page.
 * Hides the body until Firebase resolves auth state, then either
 * reveals the page (logged in) or redirects to login.html (not logged in).
 */
import { auth } from "./firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { owlLogout } from "./auth-logout.js";

// Resolve login.html relative to THIS module's own URL (always
// <root>/scripts/auth-guard.js), so the redirect lands on <root>/login.html
// from any page depth — root, mage_tower/, Proofs/emulators/, etc.
function loginUrl() {
  return new URL("../login.html", import.meta.url).href;
}

// Expose a global logout for inline `onclick="globalLogout()"` buttons across legacy pages.
// scripts/auth-logout.js signs out, removes Owl's own storage keys and redirects to login.html.
window.globalLogout = () => owlLogout({ redirect: loginUrl() });

// Immediately hide body to prevent flash of protected content
document.documentElement.style.visibility = "hidden";

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.documentElement.style.visibility = "visible";
  } else {
    const destination = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`${loginUrl()}?redirect=${destination}`);
  }
});
