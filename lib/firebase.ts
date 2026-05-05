// Firebase SDK — same project as the Admin panel
import { initializeApp } from "firebase/app";
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ── Same config as SCIA_Admin_Firebase ──────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCUgV0Y6W5UedzmjIltFIoa8AY-mKYAfTU",
  authDomain: "scia-b5440.firebaseapp.com",
  projectId: "scia-b5440",
  storageBucket: "scia-b5440.firebasestorage.app",
  messagingSenderId: "244279971713",
  appId: "1:244279971713:web:8a4cba18f0ba528e93a280",
  measurementId: "G-GXDFVSFJME",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ── Helper: remove undefined fields so Firestore never rejects them ──────────
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

// ── Collection names (must match admin) ─────────────────────────────────────
export const COLLECTIONS = {
  USERS: "users",
  EVENTS: "editorial_health",
  EMERGENCIES: "emergencies",
  APPOINTMENTS: "appointments",       // Sub-admin receives these
  ID_REQUESTS: "id_requests",         // Super-admin receives these
};

// ── USER REGISTRATION ────────────────────────────────────────────────────────
export interface UserRegistration {
  firstName: string;
  midName: string;
  lastName: string;
  address: string;
  conNumber: string;
  gender: string;
  dob: string;
  idNumber?: string;
  password: string;
  imageBase64?: string;
}

export async function registerUser(data: UserRegistration) {
  const docRef = await addDoc(collection(db, COLLECTIONS.USERS), stripUndefined({
    ...data,
    status: "PENDING",
    role: "SENIOR_CITIZEN",
    createdAt: serverTimestamp(),
  }));
  return { id: docRef.id, ...data };
}

export async function loginUser(idNumber: string, password: string) {
  const q = query(
    collection(db, COLLECTIONS.USERS),
    where("idNumber", "==", idNumber),
    where("password", "==", password)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) throw new Error("Invalid credentials");
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

// ── ANNOUNCEMENTS / EVENTS ───────────────────────────────────────────────────
export interface Event {
  id: string;
  Title?: string;
  title?: string;
  Body?: string;
  description?: string;
  Location?: string;
  location?: string;
  Date?: string;
  date?: string;
  Audience?: string;
  audience?: string;
  barangay?: string;
  expiration?: string | null;
  createdAt?: any;
  Status?: string;
}

export async function fetchEvents(barangay?: string | null, district?: string | null): Promise<Event[]> {
  const q = query(
    collection(db, COLLECTIONS.EVENTS),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  const now = new Date();

  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as Event))
    .filter((event) => {
      if (event.expiration) {
        try {
          if (new Date(event.expiration) <= now) return false;
        } catch (_) {}
      }
      const audience = event.Audience || event.audience || "ALL";
      if (audience === "ALL") return true;
      if (audience === "DISTRICT_1" && district === "DISTRICT_1") return true;
      if (audience === "DISTRICT_2" && district === "DISTRICT_2") return true;
      if (audience === "BARANGAY" && barangay === event.barangay) return true;
      return false;
    });
}

export function subscribeToEvents(
  barangay: string | null,
  district: string | null,
  callback: (events: Event[]) => void
) {
  const q = query(
    collection(db, COLLECTIONS.EVENTS),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const now = new Date();
    const events = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() } as Event))
      .filter((event) => {
        if (event.expiration) {
          try {
            if (new Date(event.expiration) <= now) return false;
          } catch (_) {}
        }
        const audience = event.Audience || event.audience || "ALL";
        if (audience === "ALL") return true;
        if (audience === "DISTRICT_1" && district === "DISTRICT_1") return true;
        if (audience === "DISTRICT_2" && district === "DISTRICT_2") return true;
        if (audience === "BARANGAY" && barangay === event.barangay) return true;
        return false;
      });
    callback(events);
  });
}

// ── SOS / EMERGENCY ──────────────────────────────────────────────────────────
export interface EmergencyAlert {
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  barangay: string;
  emergencyType: string;
}

export async function sendSOSAlert(data: EmergencyAlert) {
  const docRef = await addDoc(collection(db, COLLECTIONS.EMERGENCIES), {
    ...data,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// ── APPOINTMENTS (Sub-admin receives) ────────────────────────────────────────
export interface AppointmentRequest {
  seniorName: string;
  seniorId: string;
  date: string;
  time: string;
  type: string;
  notes?: string;
}

export async function submitAppointment(data: AppointmentRequest) {
  const docRef = await addDoc(collection(db, COLLECTIONS.APPOINTMENTS), stripUndefined({
    ...data,
    center: "3S Center Valenzuela",
    status: "pending",
    createdAt: serverTimestamp(),
  }));
  return docRef.id;
}

// ── PHYSICAL ID REQUEST (Super-admin receives) ────────────────────────────────
export interface IDRequest {
  seniorName: string;
  seniorId: string;
  address: string;
  contactNumber: string;
  reason?: string;
  imageBase64?: string;
}

export async function submitIDRequest(data: IDRequest) {
  const docRef = await addDoc(collection(db, COLLECTIONS.ID_REQUESTS), stripUndefined({
    ...data,
    status: "pending",
    createdAt: serverTimestamp(),
  }));
  return docRef.id;
}

export default app;
