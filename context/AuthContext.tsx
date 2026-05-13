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
  refreshUser: () => Promise<void>;
  clearUser: () => void;
}

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
    AsyncStorage.multiRemove([
      "user",
      "userId",
      "userName",
      "userBarangay",
      "userDistrict",
    ]);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await fetchUserProfile(firebaseUser.uid);
        setUser(profile);
      } else {
        const stored = await AsyncStorage.getItem("user");
        if (stored) {
          try {
            setUser(JSON.parse(stored));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, clearUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
