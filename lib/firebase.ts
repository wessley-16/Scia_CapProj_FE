import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  FieldValue,
} from "@react-native-firebase/firestore";
import { getStorage } from "@react-native-firebase/storage";
import { initAppCheck } from "./appCheck";

const auth = getAuth();
const db = getFirestore();
export const storage = getStorage();

// Must run before any AI Logic (Gemini) call — see lib/appCheck.ts for the
// remaining console-side setup this still needs.
initAppCheck();

// ── Helper: build a synthetic email from idNumber ────────────────────────────
export const idToEmail = (idNumber: string) => {
  const cleaned = idNumber.trim().replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `${cleaned}@scia.app`;
};

// ── Helper: strip undefined so Firestore doesn't complain ────────────────────
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
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
  USER_LOOKUP: "user_lookup",
};

// ── AUTH STATE ────────────────────────────────────────────────────────────────
export function subscribeToAuthState(
  callback: (user: FirebaseAuthTypes.User | null) => void,
) {
  return onAuthStateChanged(auth, callback);
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
      : `TEMP${Math.floor(100000 + Math.random() * 900000)}`;

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
    }),
  );

  // ── Write lookup entries (public) so loginByIdentifier can find this user ──
  // Keys: 6-digit ID or TEMP######, phone number, full name, first+last name
  const fullName =
    `${data.firstName} ${data.midName} ${data.lastName}`.trim().toLowerCase().replace(/\s+/g, "_");
  const firstLast =
    `${data.firstName} ${data.lastName}`.trim().toLowerCase().replace(/\s+/g, "_");

  const lookupKeys = [
    effectiveIdNumber.toLowerCase(),  // "123456" or "temp123456"
    data.conNumber.trim(),            // "09955015206"
    fullName,                         // "juan_santos_cruz"
    firstLast,                        // "juan_cruz"
  ];

  // Deduplicate in case any keys are identical
  const uniqueKeys = [...new Set(lookupKeys)];

  await Promise.all(
    uniqueKeys.map((key) =>
      setDoc(doc(db, COLLECTIONS.USER_LOOKUP, key), {
        idNumber: effectiveIdNumber,
        uid,
      })
    )
  );

  return { id: uid, ...data, idNumber: effectiveIdNumber, status, isVerified };
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
export async function loginUser(idNumber: string, password: string) {
  const email = idToEmail(idNumber);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  if (!userDoc.exists) throw new Error("User profile not found.");
  return { id: userDoc.id, ...userDoc.data() };
}

export async function loginByIdentifier(identifier: string, password: string) {
  const trimmed = identifier.trim();

  // Build lookup keys to try — same normalization used during registration
  const isNameInput = /\s/.test(trimmed); // contains spaces → likely a name

  const keysToTry: string[] = [];

  if (isNameInput) {
    const parts = trimmed.split(/\s+/);
    // Full name (all parts joined)
    keysToTry.push(trimmed.toLowerCase().replace(/\s+/g, "_"));
    // First + last only (drop middle)
    if (parts.length >= 3) {
      keysToTry.push(
        `${parts[0]}_${parts[parts.length - 1]}`.toLowerCase()
      );
    }
  } else {
    // ID number (6-digit or TEMP######) or phone number
    keysToTry.push(trimmed.toLowerCase());
  }

  // Try each key against the public user_lookup collection
  let idNumber: string | null = null;

  for (const key of keysToTry) {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.USER_LOOKUP, key));
      if (snap.exists()) {
        idNumber = snap.data().idNumber as string;
        break;
      }
    } catch (_) {
      // key not found — try next
    }
  }

  // If no lookup hit, treat the input itself as the ID number directly
  // (covers TEMP IDs and 6-digit IDs for users registered before lookup existed)
  if (!idNumber) {
    idNumber = trimmed;
  }

  const email = idToEmail(idNumber);

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    if (!userDoc.exists()) throw new Error("User profile not found.");
    return { id: userDoc.id, ...userDoc.data() };
  } catch (err: any) {
    if (
      err.code === "auth/user-not-found" ||
      err.code === "auth/wrong-password" ||
      err.code === "auth/invalid-credential"
    ) {
      throw new Error(
        "No account found for that ID, phone number, or name. Please check your credentials.",
      );
    }
    throw err;
  }
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

function filterEvents(docs: any[], barangay?: string | null, district?: string | null): Event[] {
  const now = new Date();
  return docs
    .map((d) => ({ id: d.id, ...d.data() }) as Event)
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
  district?: string | null,
): Promise<Event[]> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.EVENTS), orderBy("createdAt", "desc")),
  );
  return filterEvents(snapshot.docs, barangay, district);
}

export function subscribeToEvents(
  barangay: string | null,
  district: string | null,
  callback: (events: Event[]) => void,
) {
  let unsubscribeSnapshot: (() => void) | null = null;

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    if (!user) return;

    unsubscribeSnapshot = onSnapshot(
      query(collection(db, COLLECTIONS.EVENTS), orderBy("createdAt", "desc")),
      (snapshot) => {
        callback(filterEvents(snapshot.docs, barangay, district));
      },
    );
  });

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

export function subscribeToSOSAlert(
  docId: string,
  callback: (data: any) => void,
) {
  return onSnapshot(doc(db, COLLECTIONS.EMERGENCIES, docId), (snap) => {
    if (snap.exists) callback({ id: snap.id, ...snap.data() });
  });
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
    }),
  );
  return docRef.id;
}

export function subscribeToUserAppointments(
  callback: (appointments: any[]) => void,
) {
  let unsubscribeSnapshot: (() => void) | null = null;

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    if (!user) return;

    unsubscribeSnapshot = onSnapshot(
      query(
        collection(db, COLLECTIONS.APPOINTMENTS),
        where("uid", "==", user.uid),
        orderBy("createdAt", "desc"),
      ),
      (snapshot) => {
        callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
    );
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
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as HealthCenter);
}

export function subscribeToHealthCenters(
  callback: (centers: HealthCenter[]) => void,
) {
  let unsubscribeSnapshot: (() => void) | null = null;

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    if (!user) return;

    unsubscribeSnapshot = onSnapshot(
      collection(db, COLLECTIONS.HEALTH_CENTERS),
      (snapshot) => {
        callback(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as HealthCenter),
        );
      },
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
    }),
  );
  return docRef.id;
}
