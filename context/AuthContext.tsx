// context/AuthContext.tsx
import { COLLECTIONS } from "@/lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import { getFirestore } from "@react-native-firebase/firestore";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export interface UserProfile {
  id: string;
  firstName: string;
  midName: string;
  lastName: string;
  address: string;
  conNumber: string;
  gender: string;
  dob: string;
  idNumber: string;
  status: string;
  isVerified: boolean;
  role: string;
  uid: string;
  imageBase64?: string;
  barangay?: string;
  district?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isGuest: boolean;
  refreshUser: () => Promise<void>;
  clearUser: () => void;
  enterGuestMode: () => Promise<void>;
}

// All AsyncStorage keys that cache data belonging to a specific signed-in
// account. These must be wiped whenever we sign out or switch to Guest mode,
// otherwise the next person to use the device (or Guest mode itself) can see
// the previous user's cached name/barangay/medicines/etc.
const USER_CACHE_KEYS = [
  "user",
  "userId",
  "userName",
  "userBarangay",
  "userDistrict",
  "profileImage",
  "notifications",
  "medicines",
  "joinedEvents",
];

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

interface Props {
  children: ReactNode;
}

const authInstance = getAuth();
const db = getFirestore();

export const AuthProvider: React.FC<Props> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const userDoc = await db
        .collection(COLLECTIONS.USERS)
        .doc(uid)
        .get();
      if (userDoc.exists) {
        const data = { id: userDoc.id, ...userDoc.data() } as UserProfile;
        await AsyncStorage.setItem("user", JSON.stringify(data));
        await AsyncStorage.setItem("userId", data.id);
        await AsyncStorage.setItem(
          "userName",
          `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim(),
        );
        await AsyncStorage.setItem(
          "userBarangay",
          data.barangay ?? data.address ?? "",
        );
        await AsyncStorage.setItem("userDistrict", data.district ?? "");
        return data;
      }
    } catch (e) {
      console.error("fetchUserProfile error:", e);
    }
    return null;
  };

  const refreshUser = async () => {
    const currentUser = authInstance.currentUser;
    if (currentUser) {
      const profile = await fetchUserProfile(currentUser.uid);
      setUser(profile);
    }
  };

  const clearUser = () => {
    setUser(null);
    setIsGuest(false);
    AsyncStorage.multiRemove(USER_CACHE_KEYS);
  };

  // Explicitly enter Guest mode. This is only ever safe to call when there is
  // no active Firebase session (callers must check `user` first) — it wipes
  // any leftover cached profile data so Guest mode never shows a previous
  // account's name, barangay, medicines, etc.
  const enterGuestMode = async () => {
    setUser(null);
    setIsGuest(true);
    await AsyncStorage.multiRemove(USER_CACHE_KEYS);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser) => {
      if (firebaseUser) {
        // A real account is authenticated with Firebase — Guest mode can't
        // coexist with a signed-in session.
        setIsGuest(false);
        const profile = await fetchUserProfile(firebaseUser.uid);
        setUser(profile);
      } else {
        // Firebase says nobody is authenticated. Previously this fell back to
        // whatever profile happened to still be cached in AsyncStorage, which
        // is what caused Guest mode (and a fresh sign-out) to incorrectly show
        // the last logged-in account. There is no session, so there is no
        // user — full stop.
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, isGuest, refreshUser, clearUser, enterGuestMode }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
