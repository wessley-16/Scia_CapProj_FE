import { useEffect, useState } from "react";
import { getAuth } from "@react-native-firebase/auth";
import { doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";

// Shape of senior_records/{uid}, written ONLY by the admin Cloud Function
// verifyAndIssueSeniorRecord (OSCA Valenzuela local registry). The senior can read it,
// never write it (see firestore.rules).
export interface SeniorRecord {
  uid: string;
  recordNo: string; // VAL-OSCA-2026-000001
  status: "active" | "revoked";
  fullName: string;
  dob?: string;
  sex?: string;
  address?: string;
  barangay?: string;
  qrValue: string; // same as recordNo; what the admin Scan tab reads
  issuedAt?: any; // Firestore Timestamp
  revokeReason?: string;
}

export function useSeniorRecord(uidOverride?: string) {
  const [record, setRecord] = useState<SeniorRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = uidOverride ?? getAuth().currentUser?.uid;
    if (!uid) {
      setRecord(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Live listener: the card appears by itself the moment OSCA verifies the senior.
    return onSnapshot(
      doc(getFirestore(), "senior_records", uid),
      (snap) => {
        setRecord(snap.exists() ? (snap.data() as SeniorRecord) : null);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [uidOverride]);

  return { record, loading, error };
}
