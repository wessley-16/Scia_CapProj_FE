import { useEffect, useState } from "react";
import { getAuth } from "@react-native-firebase/auth";
import { doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";

// Shape of the document the admin creates at digital_ids/{uid}
export interface DigitalId {
  fullName: string;
  idNumber: string;
  role?: string; // e.g. "Member", "Senior Citizen", "Patient"
  organization?: string; // e.g. "SCIA"
  photoUrl?: string;
  validUntil?: any; // Firestore Timestamp or ISO string
  status?: "active" | "suspended" | "expired";
  themeColor?: string; // card background, e.g. "#1E3A8A"
  accentColor?: string; // badge / stripe, e.g. "#FACC15"
}

export function useDigitalId(uidOverride?: string) {
  const [data, setData] = useState<DigitalId | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = uidOverride ?? getAuth().currentUser?.uid;
    if (!uid) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(getFirestore(), "digital_ids", uid);

    // Live listener: if the admin edits the ID, the card updates instantly
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? (snap.data() as DigitalId) : null);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [uidOverride]);

  return { data, loading, error };
}
