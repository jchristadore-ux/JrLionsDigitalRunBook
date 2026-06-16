// =============================================================================
// firebase.js — Firebase app + Auth initialization
// -----------------------------------------------------------------------------
// If config.js still holds placeholder values, the app runs in LOCAL mode
// (saved to this browser). Fill in config.js to switch to CLOUD mode.
// =============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig } from "./config.js";

function looksConfigured(cfg) {
  return !!(cfg && cfg.apiKey && !cfg.apiKey.startsWith("YOUR_") &&
    cfg.projectId && !cfg.projectId.startsWith("YOUR_"));
}

export const isConfigured = looksConfigured(firebaseConfig);

export let app = null;
export let auth = null;
export let db = null;
export let provider = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    try {
      db = initializeFirestore(app, { cacheSizeBytes: CACHE_SIZE_UNLIMITED });
    } catch {
      db = getFirestore(app);
    }
  } catch (err) {
    console.error("Firebase init failed; falling back to local mode.", err);
  }
}

export async function signIn() {
  if (!auth) throw new Error("Sign-in needs Firebase. Add your settings in config.js.");
  const res = await signInWithPopup(auth, provider);
  return res.user;
}
export async function signOutUser() {
  if (!auth) return;
  await signOut(auth);
}
export function onAuth(cb) {
  if (!auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, cb);
}
