/**
 * Auth Guard — include as <script type="module"> on any protected page.
 * Hides the body until Firebase resolves auth state, then either
 * reveals the page (logged in) or redirects to login.html (not logged in).
 */
import { auth } from "./firebase/config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// Resolve login.html relative to the current page. Pages in mage_tower/
// need one step up; all other pages live at the project root alongside it.
function loginUrl() {
  return window.location.pathname.includes("/mage_tower/")
    ? "../login.html"
    : "login.html";
}

// Expose a global logout for inline `onclick="globalLogout()"` buttons across legacy pages
window.globalLogout = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("[Owl Academy] signOut failed:", err);
  }
  window.location.replace(loginUrl());
};

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
