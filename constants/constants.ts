  import Constants from "expo-constants";

  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    null;
  const localhost = debuggerHost?.split(":")[0];

  const BASE_URL = localhost
    ? `http://${localhost}:3000`
    : "https://your-production-api.com";

  export const CHATBOT_API_URL = `${BASE_URL}/api/chat`;
  export const CHATBOT_STORAGE_KEY = "@scia/chatbot/conversation";
  export const MAX_CHATBOT_MESSAGES = 60;

  export const LIVE_TOKEN_API_URL = `${BASE_URL}/api/live/token`;
  export const LIVE_WS_BASE_URL =
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";
  export const LIVE_MODEL = "models/gemini-3.1-flash-live-preview";

  export default BASE_URL;
