import { useEffect, useState } from "react";
import { getAuth } from "@react-native-firebase/auth";
import { doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";

// Shape of the document the admin portal creates at digital_ids/{uid}
// (fullName/idNumber are always present; the rest is optional).
export interface DigitalId {
  fullName: string;
  idNumber: string;
  // Fields printed on the physical OSCA ID, so the card can mirror it
  controlNumber?: string;
  dob?: string;
  sex?: string;
  address?: string;
  barangay?: string;
  releasedAt?: any; // Firestore Timestamp — the "Date Issued"
  role?: string; // e.g. "Member", "Senior Citizen", "Patient"
  organization?: string; // e.g. "SCIA"
  photoUrl?: string;
  photoURL?: string; // the admin portal writes this spelling
  // Written by the admin's approveIdVerification: the verified ID photo the
  // senior uploaded (Storage URL, or base64 when it was sent from the app).
  idImageUrl?: string;
  idImageBase64?: string;
  isVerified?: boolean;
  validUntil?: any; // Firestore Timestamp or ISO string
  status?: "active" | "suspended" | "expired" | "invalidated";
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

// Outcome of the senior's "Claim" tap (digital_id_requests/{uid}), written by
// the onDigitalIdRequested Cloud Function.
export interface DigitalIdRequest {
  status: "requested" | "issued" | "denied";
  code?: string;
  message?: string;
}

export function useDigitalIdRequest(uidOverride?: string) {
  const [request, setRequest] = useState<DigitalIdRequest | null>(null);

  useEffect(() => {
    const uid = uidOverride ?? getAuth().currentUser?.uid;
    if (!uid) {
      setRequest(null);
      return;
    }
    return onSnapshot(
      doc(getFirestore(), "digital_id_requests", uid),
      (snap) => setRequest(snap.exists() ? (snap.data() as DigitalIdRequest) : null),
      () => setRequest(null),
    );
  }, [uidOverride]);

  return request;
}
