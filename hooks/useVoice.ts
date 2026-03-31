import Constants from "expo-constants";
import { Audio } from "expo-av";

// ✅ ADD THIS (same as your other hooks)
const manifest = Constants.expoConfig || Constants.manifest;
const host = manifest?.hostUri ? manifest.hostUri.split(":")[0] : "localhost";

export const useVoice = () => {
  const playVoice = async (text: string) => {
    try {
      const response = await fetch(`http://${host}:3000/api/voice`, { // ✅ changed here
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      const blob = await response.blob();
      const uri = URL.createObjectURL(blob);

      const { sound } = await Audio.Sound.createAsync({ uri });

      await sound.playAsync();
    } catch (error) {
      console.error("Voice error:", error);
    }
  };

  return { playVoice };
};