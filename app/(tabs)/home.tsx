import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Animated, BackHandler, Dimensions, Image, ImageBackground, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettings } from "@/context/SettingsContext";
// 🔥 Firebase — events, join/check-in, and everything else now go through
// Firestore directly (previously joining hit a hardcoded local dev backend
// at http://10.142.254.160:3000 that no longer exists)
import { subscribeToEvents, Event as FirebaseEvent, logoutUser, joinEvent, fetchJoinedEventIds, subscribeToAuthState, subscribeToMyNotifications, markNotificationRead, AppNotification } from "@/lib/firebase";
import EventCarousel from "@/components/home/EventCarousel";
import EventJoinFormModal from "@/components/home/EventJoinFormModal";
import { useAuth } from "@/context/AuthContext";
import { Medicine } from "@/interfaces/interfaces";
import DigitalIDCard from "@/components/DigitalIDCard";


const background = require("../../assets/images/Foreground.png");

export default function Home() {
  const router = useRouter();
  const { user, isGuest, clearUser } = useAuth();
  const name = user ? (`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Sa inyo") : "Sa inyo";
  const idNumber = user?.idNumber ?? "No ID";
  const insets = useSafeAreaInsets();
  const tabBarHeight = insets.bottom + 60; // 60 ≈ typical tab bar height, adjust if yours differs
  const { fontScale, t } = useSettings();
  const [refreshing, setRefreshing] = useState(false);

  const loadProfileImage = useCallback(async () => {
    const img = await AsyncStorage.getItem("profileImage");

    if (img) {
      setAvatarSource({ uri: img });
    }
  }, []);

  const [events, setEvents] = useState<any[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);

  // Every medicine reminder the senior created (Healthcare tab), not just one.
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [showMedicines, setShowMedicines] = useState(false);
  // Ticks every minute so "in 2h 15m" stays current while Home is open.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
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
    loadEvents();
  };

  /* ---------------- LOAD EVENT ---------------- */
  // Real-time subscription to Firestore announcements, scoped to the
  // signed-in user's own barangay/district (already loaded on `user` —
  // no need for a separate AsyncStorage read that could lag behind it).
  const loadEvents = useCallback(() => {
    setLoadingEvents(true);
    const unsub = subscribeToEvents(user?.barangay ?? null, user?.district ?? null, (newEvents) => {
      setEvents(newEvents as any[]);
      setLoadingEvents(false);
    });
    return unsub;
  }, [user]);

  /* ---------------- JOIN EVENT ---------------- */
  const [joinFormEvent, setJoinFormEvent] = useState<FirebaseEvent | null>(null);
  const [joining, setJoining] = useState(false);

  // Tapping "Join" on a card always opens the details screen first, so the
  // senior sees exactly what the admin posted (date, location, description)
  // before confirming — whether or not the event has extra signup fields.
  // EventCarousel only ever calls this for items with isJoinable === true,
  // so plain announcements never reach here.
  const handleJoinPress = (event: FirebaseEvent) => {
    if (!user || isGuest) {
      Alert.alert(
        "Log In Required",
        "Please log in with your account to join events — this is what links your QR code to event check-in.",
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
  // Tracks Firebase Auth's own restored session, separately from
  // AuthContext's `user`. AuthContext may hydrate from AsyncStorage a beat
  // before the native Firebase Auth SDK finishes restoring its session —
  // during that gap request.auth is still null on the server, so any
  // Firestore read gated on auth.uid (like joinedEvents) gets rejected with
  // permission-denied even though `user` already looks populated here.
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((fbUser) => {
      setFirebaseUid(fbUser?.uid ?? null);
    });
    return unsubscribe;
  }, []);

  /* ---------------- LOAD JOINED EVENTS ---------------- */
  // Re-derives from Firestore whenever the confirmed Firebase identity or
  // the event list changes — guests never have joined events (no stable
  // identity to check in with), and this only fires once Firebase Auth has
  // actually confirmed the session, matching what the security rules check.
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
      const list: Medicine[] = stored ? JSON.parse(stored) : [];
      setMedicines(Array.isArray(list) ? list : []);
    } catch (error) {
      console.log(error);
      setMedicines([]);
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

  // Next time this medicine is due (ms). Same rule as the Healthcare tab:
  // fixed daily alarm times when the medicine has them, otherwise
  // last-taken + interval for older medicines.
  const getNextDoseTimestamp = (med: Medicine, now: number): number => {
    if (med.notificationTimes && med.notificationTimes.length > 0) {
      let best: number | null = null;
      for (const slot of med.notificationTimes) {
        const c = new Date(now);
        c.setHours(slot.hour, slot.minute, 0, 0);
        if (c.getTime() <= now) c.setDate(c.getDate() + 1);
        if (best === null || c.getTime() < best) best = c.getTime();
      }
      if (best !== null) return best;
    }
    return (med.lastTakenTime || now) + med.interval * 60 * 60 * 1000;
  };

  const describeNextDose = (timestamp: number, now: number) => {
    const diff = timestamp - now;
    if (diff <= 0) return `${formatTime(timestamp)} (${t("overdueLabel")})`;
    const hr = Math.floor(diff / 3600000);
    const mn = Math.floor((diff % 3600000) / 60000);
    return `${formatTime(timestamp)} (${hr}h ${mn}m)`;
  };

  // All medicines, soonest dose first.
  const sortedMedicines = useMemo(
    () =>
      medicines
        .map((med) => ({ med, next: getNextDoseTimestamp(med, nowTick) }))
        .sort((a, b) => a.next - b.next),
    [medicines, nowTick]
  );
  const nextMedicine = sortedMedicines[0]?.med ?? null;

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

  /* ---------------- NOTIFICATION STATUS (read / closed) + LINKS ---------------- */
  // Notifications come from two places: the local list above and Cloud Functions
  // (ID request updates, in Firestore). "Read" and "closed" are remembered on this
  // device; server ones are also marked read in Firestore.
  const NOTIF_STATE_KEY = "notif_state_v1";
  const [serverNotifs, setServerNotifs] = useState<AppNotification[]>([]);
  const [notifState, setNotifState] = useState<{ read: Record<string, number>; closed: Record<string, number> }>({
    read: {},
    closed: {},
  });

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_STATE_KEY)
      .then((raw) => {
        if (raw) setNotifState(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.uid || isGuest) {
      setServerNotifs([]);
      return;
    }
    const unsub = subscribeToMyNotifications(user.uid, setServerNotifs);
    return () => unsub();
  }, [user?.uid, isGuest]);

  const updateNotifState = (fn: (prev: typeof notifState) => typeof notifState) => {
    setNotifState((prev) => {
      const next = fn(prev);
      AsyncStorage.setItem(NOTIF_STATE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  type PanelNotif = {
    id: string;
    type: string;
    title: string;
    body: string;
    ts: number;
    link: string | null;
    server: boolean;
    readRemote: boolean;
  };

  // Where a notification takes the senior. An explicit `link` wins; otherwise by type.
  const linkFor = (type: string, link?: string): string | null => {
    if (link && link.startsWith("/")) return link;
    if (type === "id_request_status") return "/(tabs)/account";
    if (type === "SOS") return "/(tabs)/emergency";
    return null;
  };

  const panelNotifs: PanelNotif[] = useMemo(() => {
    const local = notifications.map((n: any) => ({
      id: `local:${n.id}`,
      type: n.type || "notification",
      title: n.type === "SOS" ? "Emergency Alert" : "Notification",
      body: n.message || "",
      ts: new Date(n.timestamp).getTime() || 0,
      link: linkFor(n.type, n.link),
      server: false,
      readRemote: false,
    }));
    const remote = serverNotifs.map((n) => ({
      id: `server:${n.id}`,
      type: n.type,
      title: n.title || "Notification",
      body: n.body || "",
      ts: n.createdAt?.toMillis?.() ?? 0,
      link: linkFor(n.type, n.link),
      server: true,
      readRemote: n.read === true,
    }));
    return [...local, ...remote]
      .filter((n) => !notifState.closed[n.id])
      .sort((a, b) => b.ts - a.ts);
  }, [notifications, serverNotifs, notifState.closed]);

  const isNotifRead = (n: PanelNotif) => n.readRemote || !!notifState.read[n.id];
  const unreadCount = panelNotifs.filter((n) => !isNotifRead(n)).length;

  const markNotifRead = (n: PanelNotif) => {
    updateNotifState((p) => ({ ...p, read: { ...p.read, [n.id]: Date.now() } }));
    if (n.server) markNotificationRead(n.id.replace("server:", "")).catch(() => {});
  };
  const markAllNotifsRead = () => panelNotifs.filter((n) => !isNotifRead(n)).forEach(markNotifRead);
  const closeNotif = (n: PanelNotif) =>
    updateNotifState((p) => ({
      read: { ...p.read, [n.id]: p.read[n.id] ?? Date.now() },
      closed: { ...p.closed, [n.id]: Date.now() },
    }));
  const openNotif = (n: PanelNotif) => {
    markNotifRead(n);
    if (!n.link) return;
    toggleNotification(); // slide the panel away, then go to the page
    router.push(n.link as any);
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
  // Home is the app's root screen — pressing back here would otherwise close
  // SCIA immediately with no chance to log out first. Android only; iOS has
  // no hardware back button so this listener simply never fires there.
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
                // Do nothing to the session — Firebase keeps it persisted so
                // the account is still there ("Welcome back") next launch.
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
              <Text style={[styles.idText, { fontSize: 13 * fontScale }]}>
                {idNumber}
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={toggleNotification} accessibilityLabel="Notifications">
            <Ionicons
              name={showNotif ? "close" : "notifications"}
              size={26}
              color="#2356E1"
            />
            {!showNotif && unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* DIGITAL ID — only rendered (and only unlocked) once the admin has
            verified the senior actually holds a physical Senior Citizen ID
            card; DigitalIdCard itself handles the verified/pending states. */}
        <View style={styles.digitalIdContainer}>
          <DigitalIDCard uid={user?.uid} />
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
              <EventCarousel
                events={events}
                joinedEventIds={joinedEvents.map((e) => e.id)}
                fontScale={fontScale}
                onJoinPress={handleJoinPress}
              />
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
          
          {/* REMINDER — tap to see every medicine in a scrollable pop-up */}
          <TouchableOpacity
            style={styles.reminder}
            activeOpacity={nextMedicine ? 0.8 : 1}
            disabled={!nextMedicine}
            onPress={() => setShowMedicines(true)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.reminderLabel, { fontSize: 18 * fontScale }]}>{t("reminder")}</Text>

              {nextMedicine ? (
                <>
                  <Text style={[styles.reminderTitle, { fontSize: 16 * fontScale }]}>
                    {t("takeLabel")} {nextMedicine.dosage} {nextMedicine.dosageUnit} {nextMedicine.name}
                  </Text>
                  <Text style={[styles.reminderTime, { fontSize: 16 * fontScale }]}>
                    {t("timeLabel")} {describeNextDose(sortedMedicines[0].next, nowTick)}
                  </Text>
                  {sortedMedicines.length > 1 ? (
                    <Text style={[styles.reminderMore, { fontSize: 15 * fontScale }]}>
                      +{sortedMedicines.length - 1} {t("moreMedicines")} · {t("tapToViewAll")}
                    </Text>
                  ) : (
                    <Text style={[styles.reminderMore, { fontSize: 15 * fontScale }]}>
                      {t("tapToViewAll")}
                    </Text>
                  )}
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
          </TouchableOpacity>

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

      {/* MEDICINE REMINDERS POP-UP */}
      <Modal
        visible={showMedicines}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMedicines(false)}
      >
        <View style={styles.medOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowMedicines(false)}
          />
          <View style={styles.medSheet}>
            <View style={styles.medHandle} />
            <View style={styles.medHeader}>
              <Text style={[styles.medTitle, { fontSize: 22 * fontScale }]}>
                {t("myMedicineReminders")} ({sortedMedicines.length})
              </Text>
              <TouchableOpacity
                onPress={() => setShowMedicines(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.medList}
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator
            >
              {sortedMedicines.map(({ med, next }, index) => (
                <View key={med.id ?? String(index)} style={styles.medItem}>
                  <View style={styles.medItemIcon}>
                    <MaterialCommunityIcons name="pill" size={28} color="#2356E1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.medName, { fontSize: 18 * fontScale }]}>{med.name}</Text>
                    <Text style={[styles.medLine, { fontSize: 15 * fontScale }]}>
                      {med.dosage} {med.dosageUnit} · {t("everyHours").replace("{n}", String(med.interval))}
                    </Text>
                    <Text style={[styles.medLine, { fontSize: 15 * fontScale }]}>
                      {t("timeLabel")} {describeNextDose(next, nowTick)}
                    </Text>
                    {!!med.description && (
                      <Text style={[styles.medLine, { fontSize: 15 * fontScale }]}>
                        {t("noteLabel")} {med.description}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.medManageBtn}
              activeOpacity={0.85}
              onPress={() => {
                setShowMedicines(false);
                goToMedicine();
              }}
            >
              <Text style={[styles.medManageText, { fontSize: 17 * fontScale }]}>{t("manageMedicines")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              <View style={styles.notifHeaderRow}>
                <Text style={{ color: "#6B7280" }}>System Alerts</Text>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={markAllNotifsRead}>
                    <Text style={styles.notifActionText}>Mark all as read</Text>
                  </TouchableOpacity>
                )}
              </View>

              {panelNotifs.length === 0 ? (
                <Text>No alerts yet</Text>
              ) : (
                panelNotifs.map((n) => {
                  const read = isNotifRead(n);
                  return (
                    <View
                      key={n.id}
                      style={[
                        styles.notifCard,
                        { backgroundColor: n.type === "SOS" ? "#FEE2E2" : "#E0F2FE" },
                        read && styles.notifCardRead,
                      ]}
                    >
                      <View style={styles.notifTitleRow}>
                        {!read && <View style={styles.notifDot} />}
                        <Text style={{ fontWeight: read ? "600" : "800", flex: 1 }}>{n.title}</Text>
                        <TouchableOpacity
                          onPress={() => closeNotif(n)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          accessibilityLabel="Close notification"
                        >
                          <Ionicons name="close" size={20} color="#4B5563" />
                        </TouchableOpacity>
                      </View>

                      {!!n.body && <Text>{n.body}</Text>}

                      {n.ts > 0 && (
                        <Text style={{ fontSize: 14, color: "gray" }}>
                          {new Date(n.ts).toLocaleString()}
                        </Text>
                      )}

                      <View style={styles.notifActions}>
                        {!!n.link && (
                          <TouchableOpacity onPress={() => openNotif(n)}>
                            <Text style={styles.notifActionText}>Open</Text>
                          </TouchableOpacity>
                        )}
                        {!read && (
                          <TouchableOpacity onPress={() => markNotifRead(n)}>
                            <Text style={styles.notifActionText}>Mark as read</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
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

  digitalIdContainer: {
    marginHorizontal: 10,
    marginTop: 16,
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

  reminderMore: { fontWeight: "700", color: "#1D4ED8", marginTop: 4 },

  medOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  medSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: "75%",
  },
  medHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    marginBottom: 12,
  },
  medHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  medTitle: { fontWeight: "800", color: "#111827", flex: 1, paddingRight: 12 },
  medList: { flexGrow: 0 },
  medItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#F3F6FF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  medItemIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  medName: { fontWeight: "800", color: "#111827" },
  medLine: { color: "#4B5563", marginTop: 2, lineHeight: 21 },
  medManageBtn: {
    backgroundColor: "#1D4ED8",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  medManageText: { color: "#fff", fontWeight: "800" },

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

  notifBadge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: { color: "white", fontSize: 11, fontWeight: "800" },
  notifHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
    marginBottom: 5,
  },
  notifCard: { padding: 12, borderRadius: 12, marginBottom: 10, gap: 4 },
  notifCardRead: { opacity: 0.65 },
  notifTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  notifDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#2356E1" },
  notifActions: { flexDirection: "row", gap: 18, marginTop: 6 },
  notifActionText: { color: "#1D4ED8", fontWeight: "700", textDecorationLine: "underline" },
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
