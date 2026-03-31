import { Audio } from "expo-av";

const API_URL = "http://YOUR_IP:3000/api/voice"; //  change this

export const useVoice = () => {
  let sound: Audio.Sound | null = null;

  const playVoice = async (text: string) => {
    if (!text) return;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) return;

    // 🔥 Get base64 directly from backend response
    const arrayBuffer = await response.arrayBuffer();

    const base64Audio = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    // ✅ Direct audio URI (NO FILE SYSTEM)
    const audioUri = `data:audio/wav;base64,${base64Audio}`;

    if (sound) {
      await sound.unloadAsync();
    }

    const { sound: newSound } = await Audio.Sound.createAsync({
      uri: audioUri,
    });

    sound = newSound;

    await sound.playAsync();
  };

  return { playVoice };
};