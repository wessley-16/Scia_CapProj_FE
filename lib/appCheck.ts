import appCheck from "@react-native-firebase/app-check";

// TODO: paste your debug token here once you've generated one in the
// Firebase console (see step 2 above). Leave blank until then.
const APP_CHECK_DEBUG_TOKEN = "E667E464-3DF8-49E1-9CA2-2324AE796CB3";

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
