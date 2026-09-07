import { useState } from "react";
import Constants from "expo-constants";

const manifest = Constants.expoConfig || (Constants as any).manifest;
const host = manifest?.hostUri ? manifest.hostUri.split(":")[0] : "localhost";
const API_URL = `http://${host}:3000/api/reminder`;

export interface MedicationReminder {
  id?: string;
  medicationName?: string;
  description?: string;
  body?: string;
  dose?: string;
  intervalHours?: number;
  notificationTimes?: string[];
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

export const useMedAi = () => {
  const [reminders, setReminders] = useState<MedicationReminder[]>([]);
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
          uri,
          name: `med_${index}.jpg`,
          type: "image/jpeg",
        } as any;

        formData.append("images", imageFile);
      });

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
        suggestion?: { reminders?: MedicationReminder[] };
      };

      // Handle backend errors
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze medication");
      }

      // Save the clean JSON array to state
      const newReminders = data.suggestion?.reminders ?? [];
      setReminders(newReminders);

      return newReminders;
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