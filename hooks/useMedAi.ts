import { useState } from "react";
import Constants from "expo-constants";

const manifest = Constants.expoConfig || Constants.manifest;
const host = manifest?.hostUri ? manifest.hostUri.split(":")[0] : "localhost";
const API_URL = `http://${host}:3000/api/reminder`;

export const useMedAi = () => {
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyzeImage = async (imageUris) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();

      // Loop through the URIs and add them all to the form
      imageUris.forEach((uri, index) => {
        formData.append("images", {
          // Must match upload.array("images")
          uri: uri,
          name: `med_${index}.jpg`,
          type: "image/jpeg",
        });
      });

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = await response.json();

      // 3. Handle backend errors
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze medication");
      }

      // 4. Save the clean JSON array to state
      const newReminders = data.suggestion.reminders || [];
      setReminders(newReminders);

      return newReminders; // Return it just in case you need it immediately
    } catch (err) {
      console.error("useMedAi Error:", err);
      setError(err.message);
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
