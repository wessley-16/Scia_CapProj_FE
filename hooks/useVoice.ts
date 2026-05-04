import { Audio } from "expo-av";
import { VOICE_API_URL } from "@/constants/constants";

export const useVoice = () => {
  const playVoice = async (text: string) => {
    try {
      const response = await fetch(VOICE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        console.error("Voice API error:", response.status);
        return;
      }

      const blob = await response.blob();
      const uri = URL.createObjectURL(blob);

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();

      // Unload sound when done
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (error) {
      console.error("Voice error:", error);
    }
  };

  return { playVoice };
};