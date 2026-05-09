// ─────────────────────────────────────────────────────────────────────────────
// lib/firebase.ts
// Uses the JS Firebase Web SDK (already in package.json as "firebase": "^12")
// This works in ANY Expo build — no native linking required.
// ─────────────────────────────────────────────────────────────────────────────

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged as _onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ── Firebase config ───────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC0pThdE1nLlSN_8G132qKMdR9-KMAsDLk",
  authDomain: "scia-b5440.firebaseapp.com",
  databaseURL: "https://scia-b5440-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "scia-b5440",
  storageBucket: "scia-b5440.firebasestorage.app",
  messagingSenderId: "244279971713",
  appId: "1:244279971713:android:c8f3a04684059cd593a280",
};

// Guard against double-init on hot reload
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ── Helper: build a synthetic email from idNumber ────────────────────────────
export const idToEmail = (idNumber: string) =>
  `${idNumber.trim().toLowerCase()}@scia.app`;

// ── Helper: strip undefined so Firestore doesn't complain ────────────────────
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

// ── Collection names ──────────────────────────────────────────────────────────
export const COLLECTIONS = {
  USERS: "users",
  EVENTS: "editorial_health",
  EMERGENCIES: "emergencies",
  APPOINTMENTS: "appointments",
  ID_REQUESTS: "id_requests",
  ANNOUNCEMENTS: "announcements",
  HEALTH_CENTERS: "health_centers",
};

// ── AUTH STATE ────────────────────────────────────────────────────────────────
export function subscribeToAuthState(callback: (user: any | null) => void) {
  return _onAuthStateChanged(auth, callback);
}

export async function logoutUser() {
  await signOut(auth);
}

// ── USER REGISTRATION ─────────────────────────────────────────────────────────
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
  const isVerified = false;
  const status = "PENDING";

  const effectiveIdNumber =
    data.idNumber && data.idNumber.trim().length > 0
      ? data.idNumber.trim()
      : `TEMP-${Date.now()}`;

  const email = idToEmail(effectiveIdNumber);
  const cred = await createUserWithEmailAndPassword(auth, email, data.password);
  const uid = cred.user.uid;

  await setDoc(
    doc(db, COLLECTIONS.USERS, uid),
    stripUndefined({
      firstName: data.firstName,
      midName: data.midName,
      lastName: data.lastName,
      address: data.address,
      conNumber: data.conNumber,
      gender: data.gender,
      dob: data.dob,
      idNumber: effectiveIdNumber,
      imageBase64: data.imageBase64,
      status,
      isVerified,
      role: "SENIOR_CITIZEN",
      uid,
      createdAt: serverTimestamp(),
    })
  );

  return { id: uid, ...data, idNumber: effectiveIdNumber, status, isVerified };
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
export async function loginUser(idNumber: string, password: string) {
  const email = idToEmail(idNumber);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  if (!userDoc.exists()) throw new Error("User profile not found.");
  return { id: userDoc.id, ...userDoc.data() };
}

// ── EVENTS ────────────────────────────────────────────────────────────────────
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

function filterEvents(
  docs: any[],
  barangay?: string | null,
  district?: string | null
): Event[] {
  const now = new Date();
  return docs
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

export async function fetchEvents(
  barangay?: string | null,
  district?: string | null
): Promise<Event[]> {
  const q = query(
    collection(db, COLLECTIONS.EVENTS),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return filterEvents(snapshot.docs, barangay, district);
}

// ✅ Guards the listener — only attaches after user is confirmed authenticated
export function subscribeToEvents(
  barangay: string | null,
  district: string | null,
  callback: (events: Event[]) => void
) {
  let unsubscribeSnapshot: (() => void) | null = null;

  const unsubscribeAuth = _onAuthStateChanged(auth, (user) => {
    // Tear down any existing snapshot listener first
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    if (!user) return; // not authenticated — don't attach

    const q = query(
      collection(db, COLLECTIONS.EVENTS),
      orderBy("createdAt", "desc")
    );
    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      callback(filterEvents(snapshot.docs, barangay, district));
    });
  });

  // Return a cleanup that kills both listeners
  return () => {
    unsubscribeAuth();
    if (unsubscribeSnapshot) unsubscribeSnapshot();
  };
}

// ── SOS / EMERGENCY ───────────────────────────────────────────────────────────
export interface EmergencyAlert {
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  barangay: string;
  emergencyType: string;
}

export async function sendSOSAlert(data: EmergencyAlert) {
  const uid = auth.currentUser?.uid ?? "anonymous";
  const docRef = await addDoc(collection(db, COLLECTIONS.EMERGENCIES), {
    ...data,
    uid,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// ── APPOINTMENTS ──────────────────────────────────────────────────────────────
export interface AppointmentRequest {
  seniorName: string;
  seniorId: string;
  date: string;
  time: string;
  type: string;
  notes?: string;
}

export async function submitAppointment(data: AppointmentRequest) {
  const uid = auth.currentUser?.uid ?? "anonymous";
  const docRef = await addDoc(
    collection(db, COLLECTIONS.APPOINTMENTS),
    stripUndefined({
      ...data,
      uid,
      center: "3S Center Valenzuela",
      status: "pending",
      createdAt: serverTimestamp(),
    })
  );
  return docRef.id;
}

// ── APPOINTMENTS LISTENER (auth-gated) ───────────────────────────────────────
export function subscribeToUserAppointments(
  callback: (appointments: any[]) => void
) {
  let unsubscribeSnapshot: (() => void) | null = null;

  const unsubscribeAuth = _onAuthStateChanged(auth, (user) => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    if (!user) return;

    const q = query(
      collection(db, COLLECTIONS.APPOINTMENTS),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  });

  return () => {
    unsubscribeAuth();
    if (unsubscribeSnapshot) unsubscribeSnapshot();
  };
}

// ── HEALTH CENTERS ────────────────────────────────────────────────────────────
export interface HealthCenter {
  id: string;
  name: string;
  address?: string;
  barangay?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  hours?: string;
}

export async function fetchHealthCenters(): Promise<HealthCenter[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.HEALTH_CENTERS));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as HealthCenter));
}

// ✅ health_centers is public to all authenticated users — still guard auth
export function subscribeToHealthCenters(
  callback: (centers: HealthCenter[]) => void
) {
  let unsubscribeSnapshot: (() => void) | null = null;

  const unsubscribeAuth = _onAuthStateChanged(auth, (user) => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    if (!user) return;

    unsubscribeSnapshot = onSnapshot(
      collection(db, COLLECTIONS.HEALTH_CENTERS),
      (snapshot) => {
        callback(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as HealthCenter))
        );
      }
    );
  });

  return () => {
    unsubscribeAuth();
    if (unsubscribeSnapshot) unsubscribeSnapshot();
  };
}

// ── PHYSICAL ID REQUEST ───────────────────────────────────────────────────────
export interface IDRequest {
  seniorName: string;
  seniorId: string;
  address: string;
  contactNumber: string;
  reason?: string;
  imageBase64?: string;
}

export async function submitIDRequest(data: IDRequest) {
  const uid = auth.currentUser?.uid ?? "anonymous";
  const docRef = await addDoc(
    collection(db, COLLECTIONS.ID_REQUESTS),
    stripUndefined({
      ...data,
      uid,
      status: "pending",
      createdAt: serverTimestamp(),
    })
  );
  return docRef.id;
}
