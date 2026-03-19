import Constants from "expo-constants";
import { useState } from "react";

const manifest = Constants.expoConfig || Constants.manifest;
const host = manifest?.hostUri ? manifest.hostUri.split(":")[0] : "localhost";
const API_URL = `http://${host}:3000/api/reminder`;

type Reminder = Record<string, unknown>;

export const useMedAi = () => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeImage = async (imageUris: string[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();

      // Loop through the URIs and add them all to the form
      imageUris.forEach((uri, index) => {
        const imageFile = {
          // Must match upload.array("images")
          uri,
          name: `med_${index}.jpg`,
          type: "image/jpeg",
        } as any;

        formData.append("images", imageFile);
      });

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      const data = await response.json() as {
        success: boolean;
        error?: string;
        suggestion?: { reminders?: Reminder[] };
      };

      // 3. Handle backend errors
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze medication");
      }

      // 4. Save the clean JSON array to state
      const newReminders = data.suggestion?.reminders ?? [];
      setReminders(newReminders);

      return newReminders; // Return it just in case you need it immediately
    } catch (err) {
      console.error("useMedAi Error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const clearReminders = () => setReminders([]);

  return {
    analyzeImage,
    reminders,
    isLoading,
    error,
    clearReminders,
  };
};
