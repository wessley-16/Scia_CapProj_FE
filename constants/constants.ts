import Constants from "expo-constants";

// Resolve the local dev server host automatically
const debuggerHost =
  Constants.expoConfig?.hostUri ||
  Constants.manifest2?.extra?.expoGo?.debuggerHost ||
  null;

const localhost = debuggerHost?.split(":")[0] ?? null;

export const BASE_URL = localhost
  ? `http://${localhost}:3000`
  : "https://your-production-api.com";

// Auth
export const LOGIN_API_URL = `${BASE_URL}/api/auth/login`;
export const REGISTER_API_URL = `${BASE_URL}/api/users/register`;

// Chat
export const CHATBOT_API_URL = `${BASE_URL}/api/chat`;
export const CHATBOT_STORAGE_KEY = "@scia/chatbot/conversation";
export const MAX_CHATBOT_MESSAGES = 60;

// Emergency
export const EMERGENCY_SMS_URL = `${BASE_URL}/api/emergency/send-sms`;

// Med AI
export const MED_AI_API_URL = `${BASE_URL}/api/reminder`;

// Voice
export const VOICE_API_URL = `${BASE_URL}/api/voice`;

// Live Voice (Gemini)
export const LIVE_TOKEN_API_URL = `${BASE_URL}/api/live/token`;
export const LIVE_WS_BASE_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";
export const LIVE_MODEL = "models/gemini-2.0-flash-live-preview";

export default BASE_URL;