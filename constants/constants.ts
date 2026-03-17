import Constants from "expo-constants";

const debuggerHost =
  Constants.expoConfig.hostUri ||
  Constants.manifest2?.extra?.expoGo?.debuggerHost ||
  null;
const localhost = debuggerHost?.split(":")[0];

const BASE_URL = localhost
  ? `http://${localhost}:3000`
  : "https://your-production-api.com";

export default BASE_URL;
