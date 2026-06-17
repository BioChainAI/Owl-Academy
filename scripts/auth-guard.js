/**
 * Auth Guard — include as <script type="module"> on any protected page.
 * Hides the body until Firebase resolves auth state, then either
 * reveals the page (logged in) or redirects to login.html (not logged in).
 */
import { auth } from "./firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// Immediately hide body to prevent flash of protected content
document.documentElement.style.visibility = "hidden";

onAuthStateChanged(auth, (user) => {
  if (user) {
    // Authenticated — reveal the page
    document.documentElement.style.visibility = "visible";
  } else {
    // Not authenticated — send to login, preserving intended destination
    const destination = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`login.html?redirect=${destination}`);
  }
});
