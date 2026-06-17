import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDTcxIO9w3cvXDPrNP7mmdCMKLGNAPf4SA",
  authDomain: "owl-academy-6bce2.firebaseapp.com",
  projectId: "owl-academy-6bce2",
  storageBucket: "owl-academy-6bce2.firebasestorage.app",
  messagingSenderId: "337762500287",
  appId: "1:337762500287:web:d024052bf39876947c100a"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
