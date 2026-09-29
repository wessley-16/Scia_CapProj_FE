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
  writeBatch,
  FieldValue,
} from "@react-native-firebase/firestore";
import { getStorage } from "@react-native-firebase/storage";
import { initAppCheck } from "./appCheck";

export const auth = getAuth();
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
  DIGITAL_IDS: "digital_ids",
  NCSC_REGISTRATIONS: "ncsc_registrations",
  ID_VERIFICATIONS: "id_verifications",
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
  district: string;
  barangay: string;
  street: string;
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
      district: data.district,
      barangay: data.barangay,
      street: data.street,
      address: data.address,
      conNumber: data.conNumber,
      gender: data.gender,
      dob: data.dob,
      idNumber: effectiveIdNumber,
      hasTempId: effectiveIdNumber.startsWith("TEMP"),
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

  // A photo of the physical card was sent with a real OSCA ID number: queue it
  // for the admin's ID Management page. (No number = temporary ID, nothing for
  // the admin to check yet; the senior can submit the card later from Account.)
  if (data.imageBase64 && !effectiveIdNumber.startsWith("TEMP")) {
    try {
      await writeIdVerification({
        uid,
        idNumber: effectiveIdNumber,
        imageBase64: data.imageBase64,
        fullName: `${data.firstName} ${data.midName} ${data.lastName}`.replace(/\s+/g, " ").trim(),
        barangay: data.barangay,
        address: data.address,
        dob: data.dob,
        sex: data.gender,
        contactNumber: data.conNumber,
      });
    } catch (e) {
      // The account exists already; the senior can resubmit from Account.
      console.warn("Could not queue the ID photo for verification:", e);
    }
  }

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
// A single field in an event's admin-defined signup form — e.g. for a
// medical checkup event the admin might add a "Current medications" text
// field, or for an ayuda distribution a "Household size" number field.
export interface EventFormField {
  id: string; // stable key — used as the answer's key in formResponses
  label: string;
  type: "text" | "number" | "textarea" | "select";
  options?: string[]; // required when type === "select"
  required?: boolean;
}

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
  // Present only on events the admin marked as joinable (e.g. medical
  // checkup, free medicine, ayuda). Absent/empty = a plain announcement
  // with no signup — Join just shows an instant RSVP, no form. Simple
  // announcements (from the ANNOUNCEMENTS collection) never have this.
  formFields?: EventFormField[];
  FormFields?: EventFormField[]; // tolerate either casing from the admin app
  isJoinable?: boolean;
}

// Firestore's serverTimestamp() comes back as a Timestamp object (with
// .toMillis()) from a live snapshot, but can also arrive as a plain
// {seconds, nanoseconds} shape in some cached/offline cases — this handles
// both, and treats a missing timestamp as "oldest" rather than throwing.
function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

import { adminBarangayName, canonicalBarangay } from "@/constants/valenzuelaDistricts";

function normalizeDistrict(d: string | null | undefined): string | null {
  if (!d) return null;
  return d.trim().toUpperCase().replace(/\s+/g, "_"); // "District 1" -> "DISTRICT_1"
}

function filterEvents(docs: any[], barangay?: string | null, district?: string | null): Event[] {
  const now = new Date();
  const myDistrict = normalizeDistrict(district);
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
      if (audience === "DISTRICT_1" && myDistrict === "DISTRICT_1") return true;
      if (audience === "DISTRICT_2" && myDistrict === "DISTRICT_2") return true;
      // Two different apps' barangay dropdowns can disagree on the exact
      // spelling of the same barangay (e.g. "Gen. T. de Leon" vs "General
      // T. de Leon"), so this resolves both sides to one canonical name
      // instead of comparing the raw strings.
      if (audience === "BARANGAY" && canonicalBarangay(barangay) === canonicalBarangay(event.barangay)) return true;
      return false;
    })
    // Merging two collections means Firestore's own per-query ordering no
    // longer guarantees a globally sorted result — re-sort explicitly so
    // announcements and joinable events interleave correctly by recency.
    .sort((a, b) => toMillis((b as any).createdAt) - toMillis((a as any).createdAt));
}

// Both the joinable-events collection (editorial_health) and the simple
// announcements collection (announcements) use the same field shape —
// Title/Body/Location/Date/Audience/etc — so they can be merged directly.
// Only editorial_health documents will ever have formFields/isJoinable set;
// plain announcements simply won't, and the UI already treats an event with
// no formFields as a no-signup announcement.
export async function fetchEvents(
  barangay?: string | null,
  district?: string | null,
): Promise<Event[]> {
  try {
    const [eventsSnap, announcementsSnap] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.EVENTS), orderBy("createdAt", "desc"))),
      getDocs(query(collection(db, COLLECTIONS.ANNOUNCEMENTS), orderBy("createdAt", "desc"))),
    ]);
    const eventDocs = eventsSnap?.docs ?? [];
    const announcementDocs = announcementsSnap?.docs ?? [];
    return filterEvents([...eventDocs, ...announcementDocs], barangay, district);
  } catch (error) {
    console.error("fetchEvents error:", error);
    return [];
  }
}

export function subscribeToEvents(
  barangay: string | null,
  district: string | null,
  callback: (events: Event[]) => void,
) {
  let unsubEventsSnapshot: (() => void) | null = null;
  let unsubAnnouncementsSnapshot: (() => void) | null = null;

  // Each collection's listener only knows about ITS OWN docs — we keep the
  // latest snapshot from each side and re-merge/re-filter/re-emit whenever
  // either one fires, so a change in either collection updates the list.
  let latestEventDocs: any[] = [];
  let latestAnnouncementDocs: any[] = [];

  const emit = () => {
    callback(filterEvents([...latestEventDocs, ...latestAnnouncementDocs], barangay, district));
  };

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    unsubEventsSnapshot?.();
    unsubAnnouncementsSnapshot?.();
    unsubEventsSnapshot = null;
    unsubAnnouncementsSnapshot = null;
    latestEventDocs = [];
    latestAnnouncementDocs = [];

    if (!user) return;

    unsubEventsSnapshot = onSnapshot(
      query(collection(db, COLLECTIONS.EVENTS), orderBy("createdAt", "desc")),
      (snapshot) => {
        if (!snapshot) return;
        latestEventDocs = snapshot.docs ?? [];
        emit();
      },
      (error) => {
        console.warn("subscribeToEvents: events listener error:", error);
      },
    );

    unsubAnnouncementsSnapshot = onSnapshot(
      query(collection(db, COLLECTIONS.ANNOUNCEMENTS), orderBy("createdAt", "desc")),
      (snapshot) => {
        if (!snapshot) return;
        latestAnnouncementDocs = snapshot.docs ?? [];
        emit();
      },
      (error) => {
        console.warn("subscribeToEvents: announcements listener error:", error);
      },
    );
  });

  return () => {
    unsubscribeAuth();
    unsubEventsSnapshot?.();
    unsubAnnouncementsSnapshot?.();
  };
}

// ── EVENT ATTENDANCE / QR CHECK-IN ──────────────────────────────────────────
//
// How this connects to the QR code shown on the senior's profile:
//   1. Signing in gives every senior a stable identity (their Firebase uid).
//      Their profile screen renders that identity as a QR code (see
//      buildUserQRPayload below) — it's the SAME code every time, not
//      regenerated per event.
//   2. Tapping "Join" on an event writes a record under that event marking
//      this senior as a registered attendee (joinEvent below).
//   3. At the event, an admin scans the senior's QR code with the SCIA Admin
//      app (separate repo). It reads the uid out of the payload, looks up
//      editorial_health/{eventId}/attendees/{uid}, confirms they're
//      registered, and marks checkedIn true.
// The QR code itself never changes — it's just "who is this person". The
// event-specific part lives entirely in Firestore, keyed by uid.
//
// NOTE: attendance/joining only makes sense for editorial_health documents
// (the ones with formFields/isJoinable) — plain announcements have no
// attendees subcollection, so joinEvent should only ever be called for
// events that came from COLLECTIONS.EVENTS, not COLLECTIONS.ANNOUNCEMENTS.

export interface EventAttendee {
  uid: string;
  name: string;
  barangay?: string | null;
  idNumber?: string | null;
  joinedAt?: any;
  checkedIn: boolean;
  checkedInAt?: any;
  // Answers to the event's admin-defined signup form, if it has one — keyed
  // by EventFormField.id. Empty/absent for events with no form.
  formResponses?: Record<string, string>;
}

// Called when a senior taps "Join" on an event. Writes two records in one
// atomic batch:
//   • editorial_health/{eventId}/attendees/{uid} — what the admin scanner
//     looks up when it scans this senior's QR code at the event. Includes
//     their signup form answers, if the event had a form.
//   • users/{uid}/joinedEvents/{eventId} — a fast local mirror so the app
//     itself can show "Joined ✅" without a collection-group query.
export async function joinEvent(
  eventId: string,
  profile: { uid: string; name: string; barangay?: string | null; idNumber?: string | null },
  formResponses?: Record<string, string>,
): Promise<void> {
  const batch = writeBatch(db);

  const attendeeRef = doc(db, COLLECTIONS.EVENTS, eventId, "attendees", profile.uid);
  batch.set(attendeeRef, {
    uid: profile.uid,
    name: profile.name,
    barangay: profile.barangay ?? null,
    idNumber: profile.idNumber ?? null,
    joinedAt: serverTimestamp(),
    checkedIn: false,
    formResponses: formResponses ?? {},
  });

  const mirrorRef = doc(db, COLLECTIONS.USERS, profile.uid, "joinedEvents", eventId);
  batch.set(mirrorRef, { joinedAt: serverTimestamp() });

  await batch.commit();
}

// Which events has this senior already joined? Used on Home screen mount so
// the button shows "Joined ✅" instead of "Join" for events already RSVP'd.
//
// Guarded against firing before Firebase Auth has finished restoring its
// session (or with a stale cached uid that no longer matches the live
// session) — the security rule requires request.auth.uid == userId, and
// during that restore window request.auth is still null server-side even
// though targetUid looks valid here in JS, which produces the
// permission-denied you saw in the log.
export async function fetchJoinedEventIds(uid?: string): Promise<string[]> {
  const targetUid = uid || auth.currentUser?.uid;

  if (!targetUid || !auth.currentUser || auth.currentUser.uid !== targetUid) {
    return [];
  }

  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.USERS, targetUid, "joinedEvents"));
    return (snapshot?.docs ?? []).map((d) => d.id);
  } catch (error) {
    console.error("fetchJoinedEventIds error:", error);
    return [];
  }
}

// The payload encoded in the senior's profile QR code. Kept as a small,
// self-describing JSON string (rather than a bare uid) so the admin scanner
// can tell at a glance this is a SCIA check-in code and not something else,
// and has a human-readable idNumber alongside the authoritative uid for
// display/debugging on the admin side.
export function buildUserQRPayload(profile: { uid: string; idNumber?: string | null }): string {
  return JSON.stringify({
    type: "scia_checkin",
    uid: profile.uid,
    idNumber: profile.idNumber ?? null,
  });
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
  return onSnapshot(
    doc(db, COLLECTIONS.EMERGENCIES, docId),
    (snap) => {
      if (!snap) return;
      const exists = typeof snap.exists === "function" ? snap.exists() : (snap as any)?.exists;
      if (exists) callback({ id: snap.id, ...snap.data() });
    },
    (error) => {
      console.warn("subscribeToSOSAlert listener error:", error);
    },
  );
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
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");

  // The barangay is never asked again: it is the one the senior filled in at
  // sign-up. It decides which barangay's sub-admin receives (and can handle)
  // this appointment; the master admin sees every barangay's.
  const profile = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  const signedUpBarangay: string | undefined = profile.exists()
    ? (profile.data() as any).barangay
    : undefined;
  const barangay = adminBarangayName(signedUpBarangay);
  const barangayLabel = canonicalBarangay(signedUpBarangay);

  const docRef = await addDoc(
    collection(db, COLLECTIONS.APPOINTMENTS),
    stripUndefined({
      ...data,
      uid,
      barangay,
      center: barangayLabel ? `3S Center ${barangayLabel}` : "3S Center Valenzuela",
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
        if (!snapshot) return;
        callback((snapshot.docs ?? []).map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.warn("subscribeToUserAppointments listener error:", error);
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
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.HEALTH_CENTERS));
    return (snapshot?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }) as HealthCenter);
  } catch (error) {
    console.error("fetchHealthCenters error:", error);
    return [];
  }
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
        if (!snapshot) return;
        callback(
          (snapshot.docs ?? []).map((d) => ({ id: d.id, ...d.data() }) as HealthCenter),
        );
      },
      (error) => {
        console.warn("subscribeToHealthCenters listener error:", error);
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

// ── DIGITAL ID ────────────────────────────────────────────────────────────────
// The admin app (SCIA_Admin_Firebase) only ever writes a `digital_ids/{uid}`
// doc after OSCA has approved that senior's ID Verification AND the admin
// has clicked "Release Digital ID" — see src/pages/DigitalID.jsx there. So
// a doc existing here (with a non-invalidated/suspended status) is the
// single source of truth for "this senior has a real physical Senior
// Citizen ID and the admin has confirmed it." Firestore rules only let a
// signed-in user read their own doc at this path (or a super admin any).
export interface DigitalId {
  uid: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dob?: string;
  sex?: string;
  address?: string;
  barangay?: string;
  idNumber?: string;
  controlNumber?: string;
  idImageUrl?: string;
  // Admin sets "active" on release; older/other tooling may use "released"
  // or "valid" — all three mean the ID is currently good. "invalidated" and
  // "suspended" mean the admin has revoked it.
  status?: "active" | "released" | "valid" | "invalidated" | "suspended" | string;
  invalidatedReason?: string;
  // Firestore Timestamp (has a .toDate() method) — typed loosely here since
  // this file doesn't otherwise import FirebaseFirestoreTypes.
  releasedAt?: { toDate?: () => Date } | null;
}

export function subscribeToDigitalId(
  uid: string | null | undefined,
  callback: (digitalId: DigitalId | null) => void,
) {
  if (!uid) {
    callback(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, COLLECTIONS.DIGITAL_IDS, uid),
    (snap) => {
      if (!snap || !snap.exists()) {
        callback(null);
        return;
      }
      callback({ uid, ...snap.data() } as DigitalId);
    },
    (error) => {
      console.warn("subscribeToDigitalId error:", error);
      callback(null);
    },
  );
}


// ── ID VERIFICATION (photo of the physical OSCA ID) ──────────────────────────
// The senior sends the OSCA ID number and a photo of the card. The admin's ID
// Management page shows name + ID number + photo, checks it against OSCA's own
// list and presses Verify. The `approveIdVerification` Cloud Function then, in
// one step: counts the senior in ncsc_registrations (with this submittedAt and
// the approval time), replaces a TEMP ID with the real number, and issues
// digital_ids/{uid} from the photo. The app never writes any of that itself; it
// only creates the submission and listens for the result.
export type IdVerificationStatus = "pending" | "approved" | "rejected";

export interface MyIdVerification {
  id: string;
  status: IdVerificationStatus | string;
  idNumber?: string;
  submittedAt?: any;
  reviewedAt?: any;
}

interface NewIdVerification {
  uid: string;
  idNumber: string;
  imageBase64: string;
  fullName: string;
  barangay?: string;
  address?: string;
  dob?: string;
  sex?: string;
  contactNumber?: string;
}

async function writeIdVerification(v: NewIdVerification) {
  const ref = await addDoc(
    collection(db, COLLECTIONS.ID_VERIFICATIONS),
    stripUndefined({
      ...v,
      status: "pending",
      submittedAt: serverTimestamp(),
    }),
  );
  return ref.id;
}

export const isTempIdNumber = (idNumber?: string | null) =>
  /^TEMP/i.test((idNumber ?? "").trim());

/** For a signed-in senior: send the real OSCA ID number + card photo to OSCA. */
export async function submitIdVerification(input: {
  idNumber: string;
  imageBase64: string;
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");

  const idNumber = input.idNumber.trim().replace(/\s+/g, " ");
  if (!idNumber) throw new Error("Please enter the OSCA ID number on your card.");
  if (isTempIdNumber(idNumber)) {
    throw new Error("Enter the ID number printed on your physical OSCA card, not a temporary ID.");
  }
  if (!input.imageBase64) throw new Error("Please add a photo of your ID.");

  // Only one submission waits at a time, so the admin never sees duplicates.
  const mine = await getDocs(
    query(collection(db, COLLECTIONS.ID_VERIFICATIONS), where("uid", "==", uid)),
  );
  if (mine.docs.some((d) => d.data().status === "pending")) {
    throw new Error("Your ID is already waiting for OSCA to verify.");
  }

  const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  const u: any = userSnap.exists() ? userSnap.data() : {};
  return writeIdVerification({
    uid,
    idNumber,
    imageBase64: input.imageBase64,
    fullName: [u.firstName, u.midName, u.lastName].filter(Boolean).join(" "),
    barangay: u.barangay,
    address: u.address,
    dob: u.dob,
    sex: u.gender,
    contactNumber: u.conNumber,
  });
}

/** Live status of the senior's most recent submission (null if none). */
export function subscribeToMyIdVerification(
  uid: string | null | undefined,
  callback: (latest: MyIdVerification | null) => void,
) {
  if (!uid) {
    callback(null);
    return () => {};
  }
  // No orderBy on purpose: a where + orderBy on different fields needs a
  // composite index; a senior only ever has a few of these, so sort here.
  // A just-created doc has no server timestamp yet, so it counts as newest.
  const time = (v: any) => (v.submittedAt ? toMillis(v.submittedAt) : Number.MAX_SAFE_INTEGER);
  return onSnapshot(
    query(collection(db, COLLECTIONS.ID_VERIFICATIONS), where("uid", "==", uid)),
    (snap) => {
      const items = (snap?.docs ?? [])
        .map((d) => {
          // Leave the photo out: it is large and the screen never shows it.
          const { imageBase64, ...rest } = d.data() as any;
          return { id: d.id, ...rest } as MyIdVerification;
        })
        .sort((a, b) => time(b) - time(a));
      callback(items[0] ?? null);
    },
    (error) => {
      console.warn("subscribeToMyIdVerification error:", error);
      callback(null);
    },
  );
}

// ── NCSC REGISTRATION ─────────────────────────────────────────────────────────
// One doc per senior (doc id = uid) in ncsc_registrations. The senior may only
// move the status between started / cancelled / completed_claimed; an admin
// later sets verified / rejected. firestore.rules requires the FIRST write to
// be status "started", so a new doc is always created as "started" and then
// moved to the requested status.
export const NCSC_FORM_URL = "https://www.ncsc.gov.ph/seniorcitizensdataform";

export type NcscSeniorStatus = "started" | "cancelled" | "completed_claimed";

export async function saveNcscStatus(
  status: NcscSeniorStatus,
  extra: { barangay?: string; fullName?: string } = {},
) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");

  const ref = doc(db, COLLECTIONS.NCSC_REGISTRATIONS, uid);
  const base = stripUndefined({
    uid,
    barangay: extra.barangay ?? null,
    fullName: extra.fullName ?? null,
    source: "mobile_app",
  });

  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, {
      ...base,
      status: "started",
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (status === "started") return;
  }

  await setDoc(
    ref,
    {
      ...base,
      status,
      updatedAt: serverTimestamp(),
      ...(status === "cancelled" ? { cancelledAt: serverTimestamp() } : {}),
      ...(status === "completed_claimed" ? { claimedAt: serverTimestamp() } : {}),
    },
    { merge: true },
  );
}
