import appCheck from "@react-native-firebase/app-check";

// Debug token for development builds. It MUST also be registered in the
// Firebase console, exactly as written here:
//   Firebase console > App Check > Apps > (your Android app) > ⋮ menu >
//   Manage debug tokens > Add debug token.
// If it is not registered there, App Check rejects every token and Gemini
// calls fail with "401 Firebase App Check token is invalid".
const APP_CHECK_DEBUG_TOKEN = "C0071C18-3761-4F4B-8BF0-1D0C84B13742";

export function initAppCheck() {
  if (__DEV__ && !APP_CHECK_DEBUG_TOKEN) {
    console.warn(
      "[AppCheck] No debug token set in lib/appCheck.ts yet. Gemini/AI " +
        "calls will fail until one is added.",
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

    appCheck()
      .initializeAppCheck({
        provider,
        isTokenAutoRefreshEnabled: true,
      })
      .then(() => {
        if (!__DEV__) return;
        // Development-only diagnostic: ask for a token right away and print
        // the real result, so you can see in the Metro log whether App
        // Check itself works, instead of guessing from the AI 401.
        appCheck()
          .getToken(true)
          .then((r) =>
            console.log("[AppCheck] token OK (length " + r.token.length + ")"),
          )
          .catch((e) =>
            console.warn(
              "[AppCheck] token FAILED — the debug token is probably not " +
                "registered in the Firebase console, or App Check is " +
                "throttling after repeated failures:",
              e?.code,
              e?.message ?? e,
            ),
          );
        appCheck()
          .getLimitedUseToken()
          .then(() => console.log("[AppCheck] limited-use token OK"))
          .catch((e) =>
            console.warn(
              "[AppCheck] limited-use token FAILED:",
              e?.code,
              e?.message ?? e,
            ),
          );
      })
      .catch((e) => console.warn("[AppCheck] initializeAppCheck failed:", e));
  } catch (e) {
    // Never let App Check setup crash the app. Worst case, AI calls fail
    // with a clear error and everything else keeps working.
    console.warn("[AppCheck] Failed to initialize:", e);
  }
}
