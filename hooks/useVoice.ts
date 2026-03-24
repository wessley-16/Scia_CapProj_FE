import { Audio } from "expo-av";

export const useVoice = () => {
  const playVoice = async (text: string) => {
    try {
      const response = await fetch("http://YOUR_IP:3000/api/voice", {
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