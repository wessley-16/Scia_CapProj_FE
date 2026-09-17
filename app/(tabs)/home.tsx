import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Animated, BackHandler, Dimensions, Image, ImageBackground, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "@/context/SettingsContext";
// Events, join/check-in, and everything else go through Firestore directly.
import { subscribeToEvents, Event as FirebaseEvent, logoutUser, joinEvent, fetchJoinedEventIds, subscribeToAuthState } from "@/lib/firebase";
import EventCarousel from "@/components/home/EventCarousel";
import EventJoinFormModal from "@/components/home/EventJoinFormModal";
import { useAuth } from "@/context/AuthContext";
import { Medicine } from "@/interfaces/interfaces";

const background = require("../../assets/images/Foreground.png");

export default function Home() {
  const router = useRouter();
  const { user, isGuest, clearUser } = useAuth();
  const name = user ? (`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Sa inyo") : "Sa inyo";
  const idNumber = user?.idNumber ?? "No ID";
  const tabBarHeight = useBottomTabBarHeight();
  const { fontScale, t } = useSettings();
  const [refreshing, setRefreshing] = useState(false);

  const loadProfileImage = async () => {
  const img = await AsyncStorage.getItem("profileImage");

    if (img) {
      setAvatarSource({ uri: img });
    }
  };

  const [events, setEvents] = useState<any[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);

  const [nextMedicine, setNextMedicine] = useState<Medicine | null>(null);
  const [avatarSource, setAvatarSource] = useState<any>(
    require("../../assets/images/default-profile.png")
  );

  /* ---------------- NAVIGATION ---------------- */
  const goToChat = () => router.push("/chatbot" as any);
  const goToVoice = () => router.push("/voice" as any);
  const goToMedicine = () => router.push("/(tabs)/healthcare");
  const goToAppointment = () => router.push("/(tabs)/healthcare");
  const goToEmergency = () => router.push("/(tabs)/emergency");
  const goToDocs = () => router.push("/(tabs)/govdocs");

  /* ---------------- FETCH EVENTS ---------------- */
  const fetchEvents = async () => {
    // Manual refresh delegates to loadEvents, which uses Firebase.
    loadEvents();
  };

  /* ---------------- LOAD EVENT ---------------- */
  // Real-time subscription to Firestore announcements.
  const loadEvents = useCallback(() => {
    let barangay: string | null = null;
    let district: string | null = null;

    const setup = async () => {
      barangay = await AsyncStorage.getItem("userBarangay");
      district = await AsyncStorage.getItem("userDistrict");

      setLoadingEvents(true);
      // subscribeToEvents returns an unsubscribe fn; React re-renders on each snapshot
      const unsub = subscribeToEvents(barangay, district, (newEvents) => {
        setEvents(newEvents as any[]);
        setLoadingEvents(false);
      });
      return unsub;
    };

    let cleanup: (() => void) | undefined;
    setup().then((unsub) => { cleanup = unsub; });
    return () => { if (cleanup) cleanup(); };
  }, []);

  /* ---------------- JOIN EVENT ---------------- */
  const [joinFormEvent, setJoinFormEvent] = useState<FirebaseEvent | null>(null);
  const [joining, setJoining] = useState(false);

  // Tapping "Join" always opens the details/signup form first, whether or
  // not the event has extra fields. EventCarousel only calls this for
  // joinable events, so plain announcements never reach here.
  const handleJoinPress = (event: FirebaseEvent) => {
    if (!user || isGuest) {
      Alert.alert(
        "Log In Required",
        "Please log in with your account to join events. This is what links your QR code to event check-in.",
      );
      return;
    }

    setJoinFormEvent(event);
  };

  // Does the actual Firestore write, whether it came from the instant-join
  // path or after submitting the signup form.
  const performJoin = async (event: FirebaseEvent, formResponses: Record<string, string>) => {
    if (!user) return;
    setJoining(true);
    try {
      await joinEvent(
        event.id,
        {
          uid: user.uid,
          name,
          barangay: user.barangay ?? null,
          idNumber: user.idNumber ?? null,
        },
        formResponses,
      );
      setJoinedEvents((prev) => [...prev, event]);
      setJoinFormEvent(null);
      Alert.alert("You're In!", `You've joined "${event.title ?? event.Title ?? "the event"}".`);
    } catch (err) {
      console.error("Failed to join event:", err);
      Alert.alert("Error", "Failed to join event. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  /* ---------------- FIREBASE AUTH READY STATE ---------------- */
  // Tracks Firebase Auth's own restored session, since AuthContext's `user`
  // can hydrate a beat before it, which would otherwise cause permission-
  // denied errors on auth-gated reads like joinedEvents.
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((fbUser) => {
      setFirebaseUid(fbUser?.uid ?? null);
    });
    return unsubscribe;
  }, []);

  /* ---------------- LOAD JOINED EVENTS ---------------- */
  // Re-derives from Firestore once Firebase Auth confirms the session.
  // Guests never have joined events, since they have no stable identity.
  useEffect(() => {
    let cancelled = false;
    if (!firebaseUid || isGuest) {
      setJoinedEvents([]);
      return;
    }
    fetchJoinedEventIds(firebaseUid)
      .then((joinedIds) => {
        if (!cancelled) {
          setJoinedEvents(events.filter((e) => joinedIds.includes(e.id)));
        }
      })
      .catch((err) => console.log("Failed to load joined events:", err));
    return () => {
      cancelled = true;
    };
  }, [firebaseUid, isGuest, events]);

  /* ---------------- LOAD MEDICINE ---------------- */
  const loadNextMedicine = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("medicines");
      if (!stored) return setNextMedicine(null);

      const medicines: Medicine[] = JSON.parse(stored);
      if (!medicines.length) return setNextMedicine(null);

      const upcoming = medicines
        .map((med) => ({
          ...med,
          nextDoseTime:
            (med.lastTakenTime || Date.now()) +
            med.interval * 60 * 60 * 1000,
        }))
        .sort((a, b) => a.nextDoseTime - b.nextDoseTime)[0];

      setNextMedicine(upcoming);
    } catch (error) {
      console.log(error);
      setNextMedicine(null);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    await loadProfileImage();
    await loadNextMedicine();
    await fetchEvents().catch((e) => console.error("fetchEvents error:", e));

    setRefreshing(false);
  }, [loadProfileImage, loadNextMedicine]);

  /* ---------------- HELPERS ---------------- */
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getNextDoseTime = (medicine: Medicine) => {
    return formatTime(
      (medicine.lastTakenTime || Date.now()) +
        medicine.interval * 60 * 60 * 1000
    );
  };

  /* ---------------- NOTIFICATION ---------------- */
  const [showNotif, setShowNotif] = useState(false);

  const screenWidth = Dimensions.get("window").width;
  const slideAnim = useState(new Animated.Value(screenWidth))[0];

  const toggleNotification = () => {
    if (showNotif) {
      // CLOSE
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowNotif(false));
    } else {
      setShowNotif(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  /* ---------------- LOAD NOTIFICATION ---------------- */
  const loadNotifications = async () => {
    const stored = await AsyncStorage.getItem("notifications");
    setNotifications(stored ? JSON.parse(stored) : []);
  };

  useFocusEffect(
    useCallback(() => {
      loadNextMedicine();
      loadProfileImage();
      fetchEvents().catch((e) => console.error("fetchEvents error:", e));
      loadEvents();
      loadNotifications();
    }, [loadProfileImage, loadNextMedicine, loadEvents])
  );

  /* ---------------- EXIT CONFIRMATION (hardware back button) ---------------- */
  // Prevents the hardware back button from closing SCIA instantly with no
  // chance to log out. Android only; iOS has no hardware back button.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;

      const onBackPress = () => {
        if (user && !isGuest) {
          Alert.alert(t("exitAppTitle"), t("exitAppMessageLoggedIn"), [
            { text: t("cancel"), style: "cancel" },
            {
              text: t("exitWithoutLogout"),
              style: "default",
              onPress: () => {
                // Session stays persisted; the account is still there next launch.
                BackHandler.exitApp();
              },
            },
            {
              text: t("logOutAndExit"),
              style: "destructive",
              onPress: async () => {
                await logoutUser();
                clearUser();
                BackHandler.exitApp();
              },
            },
          ]);
        } else {
          Alert.alert(t("exitAppTitle"), t("exitAppMessageGuest"), [
            { text: t("cancel"), style: "cancel" },
            {
              text: t("exitApp"),
              style: "destructive",
              onPress: () => BackHandler.exitApp(),
            },
          ]);
        }
        return true; // prevent default back behavior (which would exit silently)
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [user, isGuest])
  );

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ImageBackground
        source={background}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: tabBarHeight },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Image source={avatarSource} style={styles.avatar} onError={() => setAvatarSource(require("../../assets/images/default-profile.png"))} />

          <View style={styles.headerText}>
            <Text style={[styles.greeting, { fontSize: 18 * fontScale }]}>{t("greeting")}</Text>
            <Text style={[styles.name, { fontSize: 22 * fontScale }]}>
              {name}
            </Text>

            <View style={styles.idRow}>
              <Ionicons
                name="shield-checkmark"
                size={14}
                color="#FBBF24"
              />
              <Text style={[styles.idText, { fontSize: 15 * fontScale }]}>
                {idNumber}
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={toggleNotification} style={styles.notifBellBtn} hitSlop={10}>
            <Ionicons
              name={showNotif ? "close" : "notifications"}
              size={28}
              color="#2356E1"
            />
          </TouchableOpacity>
        </View>

        {/* PROGRAMS */}
        <BlurView intensity={40} tint="dark" style={styles.programContainer}>
          <Text style={[styles.programTitle, { fontSize: 24 * fontScale }]}>{t("programUpdates")}</Text>

          <EventCarousel
            events={events}
            joinedEventIds={joinedEvents.map((e) => e.id)}
            fontScale={fontScale}
            onJoinPress={handleJoinPress}
          />
        </BlurView>

        <View style={styles.assistantContainer}>
          {/* CHAT ASSISTANT */}
          <TouchableOpacity style={styles.assistant} onPress={goToChat}>
            <MaterialCommunityIcons
              name="robot-outline"
              size={36}
              color="#2563EB"
            />

            <View>
              <Text style={[styles.assistantTitle, { fontSize: 16 * fontScale }]}>{t("chatAssistant")}</Text>
              <Text style={[styles.assistantSub, { fontSize: 14 * fontScale }]}>
                {t("howCanIHelp")}
              </Text>
            </View>
          </TouchableOpacity>

          {/* VOICE ASSISTANT */}
          <TouchableOpacity style={styles.assistant} onPress={goToVoice}>
            <MaterialCommunityIcons
              name="microphone-outline"
              size={36}
              color="#2563EB"
            />

            <View>
              <Text style={[styles.assistantTitle, { fontSize: 16 * fontScale }]}>{t("voiceAssistant")}</Text>
              <Text style={[styles.assistantSub, { fontSize: 14 * fontScale }]}>
                {t("speakAndGetHelp")}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* BUTTONS */}
        <View style= {styles.moduleContainer}>
          
          {/* REMINDER */}
          <View style={styles.reminder}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.reminderLabel, { fontSize: 18 * fontScale }]}>{t("reminder")}</Text>

              {nextMedicine ? (
                <>
                  <Text style={[styles.reminderTitle, { fontSize: 17 * fontScale }]}>
                    {t("takeLabel")} {nextMedicine.dosage} {nextMedicine.dosageUnit} {nextMedicine.name}
                  </Text>
                  <Text style={[styles.reminderTime, { fontSize: 17 * fontScale }]}>
                    {t("timeLabel")} {getNextDoseTime(nextMedicine)}
                  </Text>
                  <Text style={[styles.reminderTime, { fontSize: 17 * fontScale }]}>
                    {t("noteLabel")} {nextMedicine.description ? `${nextMedicine.description}` : "Not set"}
                  </Text>
                </>
              ) : (
                <Text style={[styles.reminderTitle, { fontSize: 16 * fontScale }]}>
                  {t("noReminders")}
                </Text>
              )}
            </View>

            <MaterialCommunityIcons
              name={nextMedicine ? "pill" : "heart-outline"}
              size={50}
              color="#2356E1"
            />
          </View>

          <ActionButton
            title={t("sosEmergency")}
            subtitle={t("callForHelp")}
            icon="alarm-light"
            color="#CE2029"
            onPress={goToEmergency}
            fontScale={fontScale}
          />

          <ActionButton
            title="Healthcare"
            subtitle="Appointments & Medications"
            icon="medical-bag"
            color="#2356E1"
            onPress={() => router.push("/(tabs)/healthcare")}
            fontScale={fontScale}
          />

          <ActionButton
            title={t("governmentWebsites")}
            subtitle={t("visitOfficialSites")}
            icon="file-document"
            color="#2356E1"
            onPress={goToDocs}
            fontScale={fontScale}
          />
        </View>
      </ScrollView>

      <EventJoinFormModal
        visible={!!joinFormEvent}
        event={joinFormEvent}
        submitting={joining}
        fontScale={fontScale}
        onClose={() => setJoinFormEvent(null)}
        onSubmit={(responses) => {
          if (joinFormEvent) performJoin(joinFormEvent, responses);
        }}
      />

      {/* FLOATING CHAT */}
      <TouchableOpacity
        style={[
          styles.chat,
          { bottom: tabBarHeight + 20 },
        ]}
        onPress={goToChat}
      >
        <Ionicons name="chatbubble" size={26} color="#fff" />
      </TouchableOpacity>

      {showNotif && (
        <>
          {/* DARK OVERLAY */}
            <TouchableOpacity
              style={styles.overlay}
              activeOpacity={1}
              onPress={toggleNotification}
            />

          {/* SLIDING PANEL */}
          <Animated.View style={[ styles.notificationPanel,{ transform: [{ translateX: slideAnim }] },]}>
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={toggleNotification}
            >
              <Ionicons name="close" size={28} color="#2356E1" />
            </TouchableOpacity>

            <View style={{ marginTop: 50 }}>
              <Text style={{ fontSize: 22 * fontScale, fontWeight: "bold", color: "#111827", marginBottom: 10 }}>
                {t("notifications")}
              </Text>

              {/* EVENTS NOTIFICATIONS */}
              <Text style={{ fontSize: 15 * fontScale, color: "#4B5563", marginBottom: 5 }}>
                Your Joined Events
              </Text>

              {joinedEvents.length === 0 ? (
                <Text style={{ fontSize: 15 * fontScale, color: "#374151" }}>No joined events yet</Text>
              ) : (
                joinedEvents.map((event) => (
                  <View
                    key={event.id}
                    style={{
                      backgroundColor: "#F3F4F6",
                      padding: 12,
                      borderRadius: 12,
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ fontWeight: "bold", fontSize: 16 * fontScale, color: "#111827" }}>
                      {event.title}
                    </Text>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <Ionicons name="calendar-outline" size={16} color="#4B5563" />
                      <Text style={{ fontSize: 15 * fontScale, color: "#374151" }}>
                        {new Date(event.date).toLocaleString()}
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <Ionicons name="location-outline" size={16} color="#4B5563" />
                      <Text style={{ fontSize: 15 * fontScale, color: "#374151" }}>
                        {event.location}
                      </Text>
                    </View>
                  </View>
                ))
              )}

              {/* SYSTEM NOTIFICATIONS */}
              <Text style={{ fontSize: 15 * fontScale, color: "#4B5563", marginTop: 15, marginBottom: 5 }}>
                System Alerts
              </Text>

              {notifications.length === 0 ? (
                <Text style={{ fontSize: 15 * fontScale, color: "#374151" }}>No alerts yet</Text>
              ) : (
                notifications.map((notif) => (
                  <View
                    key={notif.id}
                    style={{
                      backgroundColor: notif.type === "SOS" ? "#FEE2E2" : "#E0F2FE",
                      padding: 12,
                      borderRadius: 12,
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ fontWeight: "bold", fontSize: 16 * fontScale, color: "#111827" }}>
                      {notif.type === "SOS" ? "Emergency Alert" : "Notification"}
                    </Text>

                    <Text style={{ fontSize: 15 * fontScale, color: "#374151" }}>{notif.message}</Text>

                    <Text style={{ fontSize: 14 * fontScale, color: "#6B7280" }}>
                      {new Date(notif.timestamp).toLocaleString()}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </Animated.View>
        </>
      )}
      </ImageBackground>
    </SafeAreaView>
  );
}

/* BUTTON COMPONENT */
function ActionButton({
  title,
  subtitle,
  icon,
  color,
  onPress,
  fontScale,
}: any) {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <MaterialCommunityIcons name={icon} size={28} color="#fff" />

      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={[styles.buttonTitle, { fontSize: 18 * fontScale }]}>{title}</Text>
        <Text style={[styles.buttonSub, { fontSize: 14 * fontScale }]}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={28} color="#fff" />
    </TouchableOpacity>
  );
}

/* STYLES */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F6F9" },

  backgroundImage: { flex: 1 },

  container: { padding: 0},

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 5,
    borderRadius: 40,
    marginHorizontal: 10,
    marginTop: 10,
  },

  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#cfcfcf",
  },

  headerText: {
    flex: 1,
    marginLeft: 12,
  },

  greeting: { fontSize: 18, color: "#000" },

  name: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
  },

  idRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  idText: {
    fontSize: 13,
    marginLeft: 4,
  },

  assistantContainer: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 10,
    marginTop: 20,
  },

  programContainer: {
    flexDirection: "column",
    padding: 16,
    marginHorizontal: 0,
    marginTop: 100,
  },

  moduleContainer: {
    backgroundColor: "white",
    borderRadius: 30,
    marginTop: 20,
    padding: 12,
    paddingBottom: 30,
  },

  reminder: {
    flexDirection: "row",
    backgroundColor: "#FACC15",
    padding: 12,
    borderRadius: 18,
    marginVertical: 7,
    alignItems: "center",
  },

  reminderLabel: { fontSize: 18, fontWeight: "bold" },

  reminderTitle: { fontSize: 16 },

  reminderTime: { fontSize: 16 },

  assistant: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 18,
    elevation: 3,
  },

  assistantTitle: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },

  assistantSub: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },

  button: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 18,
    marginVertical: 7,
  },

  buttonTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  buttonSub: {
    color: "#E5E7EB",
    fontSize: 14,
  },

  chat: {
    position: "absolute",
    right: 20,
    borderWidth: 3,
    borderColor: "white",
    backgroundColor: "#2356E1",
    padding: 15,
    borderRadius: 30,
  },

  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  notificationPanel: {
    position: "absolute",
    top: 0,
    right: 0,
    height: "100%",
    width: "80%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    padding: 20,
    elevation: 10,
    zIndex: 10,
  },

  notifBellBtn: {
    padding: 10,
    borderRadius: 24,
  },

  notifBtn: {
    position: "absolute",
    top: 20,
    right: 15,
    zIndex: 11,
    padding: 10,
  },

  programTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 6,
    // subtle glow for readability
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 3,
  },

  programLabel: {
    fontSize: 20,
    color: "#ffffff",
    marginBottom: 6,
    // subtle glow for readability
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 3,
  },

});
