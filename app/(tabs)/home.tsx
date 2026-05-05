import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Animated, Dimensions, Image, ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "@/context/SettingsContext";
// 🔥 Firebase — replaces http://10.142.254.160:3000/api/events
import { subscribeToEvents, Event as FirebaseEvent } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Medicine } from "@/interfaces/interfaces";

const background = require("../../assets/images/Foreground.png");

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
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
  const goToChat = () => router.push("/(tabs)/chatbot");
  const goToVoice = () => router.push("/(tabs)/voice");
  const goToMedicine = () => router.push("/(tabs)/healthcare");
  const goToAppointment = () => router.push("/(tabs)/healthcare");
  const goToEmergency = () => router.push("/(tabs)/emergency");
  const goToDocs = () => router.push("/(tabs)/govdocs");

  /* ---------------- PROGRAM ---------------- */
  const [isProgramOpen, setIsProgramOpen] = useState(false);
  const animatedHeight = useState(new Animated.Value(0))[0];
  const animatedOpacity = useState(new Animated.Value(0))[0];
  const rotateAnim = useState(new Animated.Value(0))[0];

  const toggleProgram = () => {
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: isProgramOpen ? 0 : 150,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(animatedOpacity, {
        toValue: isProgramOpen ? 0 : 1,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(rotateAnim, {
        toValue: isProgramOpen ? 0 : 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    setIsProgramOpen(!isProgramOpen);
  };

  /* ---------------- FETCH EVENTS ---------------- */
  const fetchEvents = async () => {
    // kept for manual refresh — delegates to loadEvents which uses Firebase
    loadEvents();
  };

  /* ---------------- LOAD EVENT ---------------- */
  // 🔥 Real-time subscription to Firestore announcements
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
  const handleJoinEvent = async (eventId: string) => {
    try {
      const name = await AsyncStorage.getItem("userName");
      const address = await AsyncStorage.getItem("userBarangay");
      const userId = await AsyncStorage.getItem("userId");

      const res = await fetch(
        // Join is still handled via backend for attendance tracking
        `http://10.142.254.160:3000/api/events/${eventId}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            address,
            userId,
            age: 60, // temporary (later compute from DOB)
          }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        const updated = [...joinedEvents, event];

        setJoinedEvents(updated);
        await AsyncStorage.setItem("joinedEvents", JSON.stringify(updated));

        alert("Joined successfully!");
      }

    } catch (err) {
      alert("Failed to join");
    }
  };

  /* ---------------- LOAD JOINED EVENTS ---------------- */
  const loadJoinedEvents = async () => {
    try {
      const stored = await AsyncStorage.getItem("joinedEvents");
      if (stored) {
        setJoinedEvents(JSON.parse(stored));
      }
    } catch (err) {
      console.log("Failed to load joined events");
    }
  };

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
    await fetchEvents();

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
      fetchEvents();
      loadEvents();
      loadJoinedEvents();
      loadNotifications();
    }, [loadProfileImage, loadNextMedicine, loadEvents])
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
              <Text style={[styles.idText, { fontSize: 13 * fontScale }]}>
                {idNumber}
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={toggleNotification}>
            <Ionicons
              name={showNotif ? "close" : "notifications"}
              size={26}
              color="#2356E1"
            />
          </TouchableOpacity>
        </View>

        {/* PROGRAMS */}
        <BlurView intensity={40} tint="dark" style={styles.programContainer}>
          {/* HEADER (clickable) */}
          <TouchableOpacity onPress={toggleProgram} style={styles.programHeader}>
            <Text style={[styles.programTitle, { fontSize: 24 * fontScale }]}>{t("programUpdates")}</Text>

            <Animated.View
              style={{
                transform: [
                  {
                    rotate: rotateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "180deg"],
                    }),
                  },
                ],
              }}
            >
              <Ionicons name="chevron-down" size={20} color="#fff" />
            </Animated.View>
          </TouchableOpacity>

          {/* COLLAPSIBLE CONTENT */}
          <Animated.View
            style={{
              height: animatedHeight,
              opacity: animatedOpacity,
              overflow: "hidden",
            }}
          >

            <View>
              {events.length === 0 ? (
                <Text style={[styles.programLabel, { fontSize: 16 * fontScale }]}>
                  No events available
                </Text>
              ) : (
                events.map((event) => (
                  <View key={event.id} style={{ marginBottom: 15 }}>
                    <Text style={[styles.programLabel, { fontSize: 20 * fontScale }]}>
                      What: {event.title}
                    </Text>

                    <Text style={[styles.programLabel, { fontSize: 20 * fontScale }]}>
                      When: {new Date(event.date).toLocaleString()}
                    </Text>

                    <Text style={[styles.programLabel, { fontSize: 20 * fontScale }]}>
                      Where: {event.location}
                    </Text>

                    <Text style={[styles.programLabel, { fontSize: 16 * fontScale }]}>
                      {event.description}
                    </Text>

                    <View style={styles.joinFunction}>
                      {joinedEvents.some(e => e.id === event.id) ? (
                        <Text style={{ color: "#22C55E", fontSize: 16 * fontScale }}>
                          Joined ✅
                        </Text>
                      ) : (
                        <TouchableOpacity
                          style={styles.joinButton}
                          onPress={() => handleJoinEvent(event.id)}
                        >
                          <Text style={{ fontSize: 18 * fontScale, color: "white" }}>
                            Join
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>

          </Animated.View>
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
              <Text style={[styles.assistantSub, { fontSize: 12 * fontScale }]}>
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
              <Text style={[styles.assistantSub, { fontSize: 12 * fontScale }]}>
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
                  <Text style={[styles.reminderTitle, { fontSize: 16 * fontScale }]}>
                    {t("takeLabel")} {nextMedicine.dosage} {nextMedicine.dosageUnit} {nextMedicine.name}\
                  </Text>
                  <Text style={[styles.reminderTime, { fontSize: 16 * fontScale }]}>
                    {t("timeLabel")} {getNextDoseTime(nextMedicine)}\
                  </Text>
                  <Text style={[styles.reminderTime, { fontSize: 16 * fontScale }]}>
                    {t("noteLabel")} {nextMedicine.description ? `${nextMedicine.description}` : "---"}\
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
              <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>
                {t("notifications")}
              </Text>

              {/* EVENTS NOTIFICATIONS */}
              <Text style={{ color: "#6B7280", marginBottom: 5 }}>
                Your Joined Events
              </Text>

              {joinedEvents.length === 0 ? (
                <Text>No joined events yet</Text>
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
                    <Text style={{ fontWeight: "bold" }}>
                      📌 {event.title}
                    </Text>

                    <Text>
                      🗓 {new Date(event.date).toLocaleString()}
                    </Text>

                    <Text>
                      📍 {event.location}
                    </Text>
                  </View>
                ))
              )}

              {/* SYSTEM NOTIFICATIONS */}
              <Text style={{ color: "#6B7280", marginTop: 15, marginBottom: 5 }}>
                System Alerts
              </Text>

              {notifications.length === 0 ? (
                <Text>No alerts yet</Text>
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
                    <Text style={{ fontWeight: "bold" }}>
                      {notif.type === "SOS" ? "Emergency Alert" : "Notification"}
                    </Text>

                    <Text>{notif.message}</Text>

                    <Text style={{ fontSize: 14, color: "gray" }}>
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

  notifBtn: {
    position: "absolute",
    top: 20,
    right: 15,
    zIndex: 11,
  },

  programHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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

  joinFunction: {
    alignItems: "flex-end",
    marginTop: 10,
  },

  joinButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
});