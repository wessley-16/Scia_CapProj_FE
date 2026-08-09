// lib/appCheck.ts
//
// Firebase AI Logic (Gemini — used by the chatbot and voice assistant, via
// the Vertex AI backend in lib/firebaseAI.ts) now requires App Check to be
// configured. Firebase started enforcing this for AI Logic in July 2026 —
// without it, Gemini calls get rejected even if everything else is correct.
//
// SETUP STILL NEEDED (console steps only you can do — see the walkthrough):
//   1. npm install @react-native-firebase/app-check
//      (already added to package.json here — just run npm install)
//   2. Firebase Console → your project → Project Settings (gear icon) →
//      App Check → Apps tab → find your debug app → "Manage debug token" →
//      generate one → paste it below as APP_CHECK_DEBUG_TOKEN.
//   3. For Android PRODUCTION builds (not needed for dev/testing), also
//      register your release keystore's SHA-256 fingerprint under
//      App Check → Apps → your app → Play Integrity.
//
// Until step 2 is done, this quietly skips activation (see the __DEV__
// check below) — the rest of the app keeps working, but Gemini calls will
// keep failing with the "Could not connect to HealthAI" fallback message
// until a debug token is added.

import appCheck from "@react-native-firebase/app-check";

// TODO: paste your debug token here once you've generated one in the
// Firebase console (see step 2 above). Leave blank until then.
const APP_CHECK_DEBUG_TOKEN = "";

export function initAppCheck() {
  if (__DEV__ && !APP_CHECK_DEBUG_TOKEN) {
    console.warn(
      "[AppCheck] No debug token set in lib/appCheck.ts yet — Gemini/AI " +
        "calls will fail until one is added. See the Firebase setup guide.",
    );
    return;
  }

  try {
    const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: {
        provider: __DEV__ ? "debug" : "playIntegrity",
        debugToken: APP_CHECK_DEBUG_TOKEN,
      },
      apple: {
        provider: __DEV__ ? "debug" : "appAttest",
        debugToken: APP_CHECK_DEBUG_TOKEN,
      },
    });

    appCheck().initializeAppCheck({
      provider,
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    // Never let App Check setup crash the app — worst case, AI calls fail
    // with a clear error and everything else keeps working.
    console.warn("[AppCheck] Failed to initialize:", e);
  }
}
