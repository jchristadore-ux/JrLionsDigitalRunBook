// =============================================================================
// firebase.js — Firebase app + Auth initialization
// -----------------------------------------------------------------------------
// If config.js still holds placeholder values, the app runs in LOCAL mode
// (saved to this browser). Fill in config.js to switch to CLOUD mode.
//
// Sign-in stays first-party on the hosted site. authDomain in config.js is the
// Firebase project host. Everywhere except loopback, the app uses the page's
// own host instead, and vercel.json proxies /__/auth/* to that Firebase host.
// That is Firebase's fix for browsers that partition third-party storage.
// =============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig } from "./config.js";

const REDIRECT_FLAG = "jrlions_auth_redirect";
const AUTH_READY_MS = 8000;

let authProblem = null;

export function consumeAuthProblem() {
  const problem = authProblem;
  authProblem = null;
  return problem;
}

function rememberProblem(message) {
  authProblem = message || "Sign-in did not finish. Try again.";
}

function authMessage(err) {
  if (err && err.code === "auth/timeout") return "Sign-in is taking too long. Try again.";
  if (err && err.message) return err.message;
  return "Sign-in did not finish. Try again.";
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error("Sign-in is taking too long. Try again.");
      err.code = "auth/timeout";
      reject(err);
    }, ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

function looksConfigured(cfg) {
  return !!(cfg && cfg.apiKey && !cfg.apiKey.startsWith("YOUR_") &&
    cfg.projectId && !cfg.projectId.startsWith("YOUR_"));
}

export function isLoopbackHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
}

// The hosted site (https://jrlionsrunbook.vercel.app) uses its own host so the
// Google handler is same-origin. Loopback keeps the Firebase host: popup works
// there, and there is no /__/auth proxy on a local static server.
export function resolveAuthDomain(cfg, loc) {
  const fallback = (cfg && cfg.authDomain) || "";
  if (!loc || !loc.hostname || isLoopbackHost(loc.hostname)) return fallback;
  return loc.host || loc.hostname || fallback;
}

export const isConfigured = looksConfigured(firebaseConfig);
export const authDomain = resolveAuthDomain(firebaseConfig, globalThis.location);

export let app = null;
export let auth = null;
export let db = null;
export let provider = null;

if (isConfigured) {
  try {
    app = initializeApp({ ...firebaseConfig, authDomain });
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

let settlePromise = null;
let signingIn = false;
let redirectStarted = false;

function readFlag() {
  try { return sessionStorage.getItem(REDIRECT_FLAG) === "1"; } catch { return false; }
}
function writeFlag(on) {
  try {
    if (on) sessionStorage.setItem(REDIRECT_FLAG, "1");
    else sessionStorage.removeItem(REDIRECT_FLAG);
  } catch { /* private mode */ }
}

function isIos() {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  const platform = navigator.platform || "";
  const points = navigator.maxTouchPoints || 0;
  return platform === "MacIntel" && points > 1;
}

// Popup first. One full-page redirect only when the browser refuses the popup.
// A desktop visitor who closes the popup is not sent anywhere.
function shouldRedirect(err) {
  const code = err && err.code;
  if (code === "auth/popup-blocked" ||
      code === "auth/operation-not-supported-in-this-environment" ||
      code === "auth/web-storage-unsupported") return true;
  if (code === "auth/popup-closed-by-user" && isIos()) return true;
  return false;
}

function canRedirect() {
  return !!(globalThis.location && globalThis.location.hostname && !isLoopbackHost(globalThis.location.hostname));
}

async function settleAuth() {
  let user = null;
  const hadRedirect = readFlag();
  const pendingResult = getRedirectResult(auth);
  // A hang must not become an unhandled rejection after the timeout wins.
  pendingResult.catch(() => {});
  try {
    const result = await withTimeout(pendingResult, AUTH_READY_MS);
    if (result && result.user) user = result.user;
    else if (hadRedirect) rememberProblem("Sign-in did not finish. Try again.");
  } catch (err) {
    console.error("Redirect sign-in did not finish.", err);
    rememberProblem(authMessage(err));
  } finally {
    writeFlag(false);
  }
  if (user || (auth && auth.currentUser)) return user || auth.currentUser;
  // The redirect result already failed or timed out. Don't wait another full
  // interval before showing the sign-in button.
  if (authProblem) return waitForUser(1500);
  return waitForUser(AUTH_READY_MS);
}

function waitForUser(waitMs) {
  return new Promise((resolve) => {
    let settled = false;
    let unsub = () => {};
    let timer = 0;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      queueMicrotask(() => { try { unsub(); } catch { /* already removed */ } });
      resolve(value || null);
    };
    timer = setTimeout(() => finish(auth.currentUser), waitMs);
    // A synchronous first callback only schedules the unsubscribe, so `unsub`
    // is the real listener by the time that microtask runs.
    unsub = onAuthStateChanged(auth, (next) => finish(next), () => finish(auth.currentUser));
  });
}

// Resolves after getRedirectResult and the first auth state. Sign-in waits on
// this same promise so a returning page cannot start a second redirect.
export function whenAuthReady() {
  if (!auth) return Promise.resolve(null);
  if (!settlePromise) settlePromise = settleAuth();
  return settlePromise;
}

export async function signIn() {
  if (!auth || !provider) throw new Error("Sign-in needs Firebase. Add your settings in config.js.");
  if (signingIn || redirectStarted || readFlag()) {
    throw new Error("Sign-in is already in progress. If nothing happens, reload the page.");
  }
  signingIn = true;
  try {
    const readyUser = await whenAuthReady();
    if (auth.currentUser) return auth.currentUser;
    if (readyUser) return readyUser;
    if (redirectStarted || readFlag()) {
      throw new Error("Sign-in is already in progress. If nothing happens, reload the page.");
    }
    try {
      const res = await signInWithPopup(auth, provider);
      return res.user;
    } catch (err) {
      if (!shouldRedirect(err) || !canRedirect()) throw err;
      redirectStarted = true;
      writeFlag(true);
      try {
        await signInWithRedirect(auth, provider);
      } catch (redirectErr) {
        redirectStarted = false;
        writeFlag(false);
        throw redirectErr;
      }
      return null;
    }
  } finally {
    signingIn = false;
  }
}

export async function signOutUser() {
  redirectStarted = false;
  writeFlag(false);
  if (!auth) return;
  await signOut(auth);
}

export function onAuth(cb) {
  if (!auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, cb);
}
