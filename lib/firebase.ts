import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

// No initializeApp() needed — native SDK auto-initializes from
// google-services.json (Android) / GoogleService-Info.plist (iOS)

export { auth, firestore, storage };

// ── Helper: build a synthetic email from idNumber ───────────────────────────
export const idToEmail = (idNumber: string) =>
  `${idNumber.trim().toLowerCase()}@scia.app`;

// ── Helper: remove undefined fields ─────────────────────────────────────────
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

// ── Collection names ─────────────────────────────────────────────────────────
export const COLLECTIONS = {
  USERS: "users",
  EVENTS: "editorial_health",
  EMERGENCIES: "emergencies",
  APPOINTMENTS: "appointments",
  ID_REQUESTS: "id_requests",
  ANNOUNCEMENTS: "announcements",
  HEALTH_CENTERS: "health_centers",
};

// ── AUTH STATE ───────────────────────────────────────────────────────────────
export function subscribeToAuthState(
  callback: (user: FirebaseAuthTypes.User | null) => void
) {
  return auth().onAuthStateChanged(callback);
}

export async function logoutUser() {
  await auth().signOut();
}

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
  const isVerified = false;
  const status = "PENDING";

  const effectiveIdNumber =
    data.idNumber && data.idNumber.trim().length > 0
      ? data.idNumber.trim()
      : `TEMP-${Date.now()}`;

  const email = idToEmail(effectiveIdNumber);

  const cred = await auth().createUserWithEmailAndPassword(email, data.password);
  const uid = cred.user.uid;

  await firestore()
    .collection(COLLECTIONS.USERS)
    .doc(uid)
    .set(
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
        createdAt: firestore.FieldValue.serverTimestamp(),
      })
    );

  return { id: uid, ...data, idNumber: effectiveIdNumber, status, isVerified };
}

// ── LOGIN ────────────────────────────────────────────────────────────────────
export async function loginUser(idNumber: string, password: string) {
  const email = idToEmail(idNumber);
  const cred = await auth().signInWithEmailAndPassword(email, password);
  const uid = cred.user.uid;

  const userDoc = await firestore().collection(COLLECTIONS.USERS).doc(uid).get();
  if (!userDoc.exists) throw new Error("User profile not found.");
  return { id: userDoc.id, ...userDoc.data() };
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

export async function fetchEvents(
  barangay?: string | null,
  district?: string | null
): Promise<Event[]> {
  const snapshot = await firestore()
    .collection(COLLECTIONS.EVENTS)
    .orderBy("createdAt", "desc")
    .get();

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
  return firestore()
    .collection(COLLECTIONS.EVENTS)
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
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
  const uid = auth().currentUser?.uid ?? "anonymous";
  const docRef = await firestore()
    .collection(COLLECTIONS.EMERGENCIES)
    .add({
      ...data,
      uid,
      status: "pending",
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
  return docRef.id;
}

// ── APPOINTMENTS ─────────────────────────────────────────────────────────────
export interface AppointmentRequest {
  seniorName: string;
  seniorId: string;
  date: string;
  time: string;
  type: string;
  notes?: string;
}

export async function submitAppointment(data: AppointmentRequest) {
  const uid = auth().currentUser?.uid ?? "anonymous";
  const docRef = await firestore()
    .collection(COLLECTIONS.APPOINTMENTS)
    .add(
      stripUndefined({
        ...data,
        uid,
        center: "3S Center Valenzuela",
        status: "pending",
        createdAt: firestore.FieldValue.serverTimestamp(),
      })
    );
  return docRef.id;
}

// ── HEALTH CENTERS ───────────────────────────────────────────────────────────
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
  const snapshot = await firestore().collection(COLLECTIONS.HEALTH_CENTERS).get();
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as HealthCenter));
}

export function subscribeToHealthCenters(
  callback: (centers: HealthCenter[]) => void
) {
  return firestore()
    .collection(COLLECTIONS.HEALTH_CENTERS)
    .onSnapshot((snapshot) => {
      const centers = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() } as HealthCenter)
      );
      callback(centers);
    });
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
  const uid = auth().currentUser?.uid ?? "anonymous";
  const docRef = await firestore()
    .collection(COLLECTIONS.ID_REQUESTS)
    .add(
      stripUndefined({
        ...data,
        uid,
        status: "pending",
        createdAt: firestore.FieldValue.serverTimestamp(),
      })
    );
  return docRef.id;
}