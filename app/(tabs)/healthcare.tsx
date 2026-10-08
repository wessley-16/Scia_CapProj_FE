import BackBar from "@/components/BackBar";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AntDesign from "@expo/vector-icons/AntDesign";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar } from "react-native-calendars";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { Palette } from "@/constants/theme";
import { useRequireLogin } from "@/context/LoginPromptContext";
import { useSettings } from "@/context/SettingsContext";
import { canonicalBarangay } from "@/constants/valenzuelaDistricts";
import { Medicine } from "@/interfaces/interfaces";
import { submitAppointment, subscribeToUserAppointments } from "@/lib/firebase";
import AppointmentStatusTracker, {
  APPOINTMENT_STATUS_LABEL,
  normalizeAppointmentStatus,
  type AppointmentStatus,
} from "@/components/AppointmentStatusTracker";

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type AppointmentType = {
  id?: string;
  date: string;
  time: string;
  type: string;
  notes?: string;
  status?: AppointmentStatus | string;
};

type ActiveTab = "medicine" | "appointment";

export default function Healthcare() {
  const { colors: c } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { fontScale, t } = useSettings();
  const { requireLogin } = useRequireLogin();
  const { user } = useAuth();
  // Booked automatically at the 3S Center of the barangay filled in at sign-up.
  const myBarangay = canonicalBarangay(user?.barangay);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("medicine");

  // Medicine State
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medicineModalVisible, setMedicineModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [medicineName, setMedicineName] = useState("");
  const [description, setDescription] = useState("");
  const [dosage, setDosage] = useState("");
  const [dosageUnit, setDosageUnit] = useState<"ml" | "mg" | "capsule">("mg");
  const [interval, setInterval] = useState("8");
  const [medStartHour, setMedStartHour] = useState("");
  const [medStartMinute, setMedStartMinute] = useState("");
  const [medStartAmPm, setMedStartAmPm] = useState<"AM" | "PM">("AM");
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const notificationsGranted = useRef(true);

  // Appointment State
  const [selectedDate, setSelectedDate] = useState("");
  const [appointModalVisible, setAppointModalVisible] = useState(false);
  const [apptHour, setApptHour] = useState("");
  const [apptMinute, setApptMinute] = useState("");
  const [apptAmPm, setApptAmPm] = useState<"AM" | "PM">("AM");
  const [apptType, setApptType] = useState("General Check-up");
  const [apptNotes, setApptNotes] = useState("");
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [apptError, setApptError] = useState("");
  const [submittingAppt, setSubmittingAppt] = useState(false);
  // Booking is four short steps: type, time, notes, then a check.
  const [apptStep, setApptStep] = useState(0);
  const APPT_STEPS = 4;
  const [apptsLoading, setApptsLoading] = useState(true);
  const [apptsLoadError, setApptsLoadError] = useState(false);

  // Load Data
  useFocusEffect(
    useCallback(() => {
      loadMedicines();
    }, [])
  );

  // Appointments come straight from Firestore, scoped to the signed-in
  // uid both by this query and by firestore.rules (`isOwner()` checks
  // `resource.data.uid == request.auth.uid`), so one account can never
  // see another account's bookings — past or upcoming. This replaces the
  // old on-device cache, which (a) was wiped/rebuilt independently of the
  // real record and (b) actively deleted any appointment once its date
  // passed, so there was never a real history to show.
  useEffect(() => {
    const unsubscribe = subscribeToUserAppointments(
      (data) => {
        setAppointments(data as AppointmentType[]);
        setApptsLoading(false);
        setApptsLoadError(false);
      },
      () => {
        setApptsLoading(false);
        setApptsLoadError(true);
      },
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    registerNotifications();
    notifListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});
    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  const registerNotifications = async () => {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });

        // Dedicated channel for medication reminders — Android ties sound
        // to the CHANNEL, not the individual notification, so a distinct
        // alarm-style tone needs its own channel rather than reusing
        // "default". If you ever swap the sound file, bump this ID (e.g.
        // "medication-reminders-v2") since an existing channel's sound
        // can't be changed except by recreating it under a new ID.
        await Notifications.setNotificationChannelAsync("medication-reminders-v2", {
          name: "Medication Reminders",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 400, 200, 400, 200, 400],
          lightColor: c.danger,
          sound: "alarm.wav",
        });
      }
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      notificationsGranted.current = finalStatus === "granted";
      if (!notificationsGranted.current) {
        Alert.alert(
          t("hcNotifDisabledTitle"),
          t("hcNotifDisabledBody1"),
          [
            { text: t("hcNotNow"), style: "cancel" },
            { text: t("emOpenSettings"), onPress: () => Linking.openSettings() },
          ],
        );
      }
    } catch (e) {
      console.log("Notif permission error:", e);
    }
  };

  // Medicine Functions
  const loadMedicines = async () => {
    try {
      const stored = await AsyncStorage.getItem("medicines");
      if (stored) setMedicines(JSON.parse(stored));
    } catch (e) {
      console.log("Error loading medicines:", e);
    }
  };

  const saveMedicines = async (updated: Medicine[]) => {
    try {
      await AsyncStorage.setItem("medicines", JSON.stringify(updated));
      setMedicines(updated);
    } catch (e) {
      console.log("Error saving medicines:", e);
    }
  };

  // Converts the 12-hour picker fields the user filled in (hour 1-12 +
  // AM/PM) into a 24-hour hour value.
  const to24Hour = (hour12: number, ampm: "AM" | "PM") => {
    let h = hour12 % 12;
    if (ampm === "PM") h += 12;
    return h;
  };

  // Builds the list of clock times (hour/minute) the alarm should ring at
  // every day, starting at the user's chosen start time and stepping by
  // `intervalHours` until it has covered a full 24-hour day. e.g. a start
  // of 7:00 with an 8-hour interval produces 7:00, 15:00, 23:00 — every day,
  // forever — instead of counting `intervalHours` forward from whatever
  // moment the user happened to press Save.
  const computeDailyTimes = (
    startHour24: number,
    startMinute: number,
    intervalHours: number,
  ) => {
    const count = Math.max(1, Math.round(24 / intervalHours));
    const times: { hour: number; minute: number }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < count; i++) {
      const totalMinutes =
        (startHour24 * 60 + startMinute + i * intervalHours * 60) % (24 * 60);
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      const key = `${hour}:${minute}`;
      // Intervals that don't evenly divide 24 (e.g. 5h) can otherwise
      // produce a duplicate time once the rounding wraps back around.
      if (!seen.has(key)) {
        seen.add(key);
        times.push({ hour, minute });
      }
    }
    return times;
  };

  // Schedules a notification that rings every day at a fixed hour/minute
  // (an expo-notifications DAILY trigger), rather than a fixed number of
  // seconds from "now". This is what lets the alarm be anchored to a real
  // clock time the user picked, and keep firing at that same time every
  // day indefinitely.
  const scheduleDailyNotification = async (
    name: string,
    hour: number,
    minute: number,
  ) => {
    if (!notificationsGranted.current) {
      Alert.alert(
        t("hcNotifDisabledTitle"),
        t("hcNotifDisabledBody2"),
      );
      return undefined;
    }
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: t("hcNotifTitle"),
          body: t("hcNotifBody", { name }),
          // iOS reads sound off the notification itself; Android reads it
          // off the channel (registered above) and just needs channelId
          // pointing at the dedicated one.
          sound: "alarm.wav",
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: Platform.OS === "android" ? "medication-reminders-v2" : undefined,
        },
      });
      return id;
    } catch (e) {
      console.log("Notif schedule error:", e);
      Alert.alert(
        t("hcReminderNotSetTitle"),
        t("hcReminderNotSetBody"),
      );
      return undefined;
    }
  };

  const addMedicine = async () => {
    if (!medicineName || !dosage || !interval || !medStartHour || !medStartMinute) {
      Alert.alert(t("hcMissingTitle"), t("hcMissingBody"));
      return;
    }
    const intervalNum = parseInt(interval);
    if (isNaN(intervalNum) || intervalNum < 1) {
      Alert.alert(t("hcBadIntervalTitle"), t("hcBadIntervalBody"));
      return;
    }
    const hour12 = parseInt(medStartHour);
    const startMinute = parseInt(medStartMinute);
    if (isNaN(hour12) || hour12 < 1 || hour12 > 12 || isNaN(startMinute) || startMinute < 0 || startMinute > 59) {
      Alert.alert(t("hcBadTimeTitle"), t("hcBadTimeBody"));
      return;
    }

    const startHour24 = to24Hour(hour12, medStartAmPm);
    const dailyTimes = computeDailyTimes(startHour24, startMinute, intervalNum);
    const notificationIds: string[] = [];
    for (const slot of dailyTimes) {
      const id = await scheduleDailyNotification(medicineName, slot.hour, slot.minute);
      if (id) notificationIds.push(id);
    }

    const newMedicine: Medicine = {
      id: Date.now().toString(),
      name: medicineName,
      description,
      dosage,
      dosageUnit,
      interval: intervalNum,
      notificationTimes: dailyTimes,
      notificationIds,
      startTime: Date.now(),
      lastTakenTime: Date.now(),
      createdAt: Date.now(),
    };
    await saveMedicines([...medicines, newMedicine]);
    resetMedicineForm();
    setMedicineModalVisible(false);
  };

  const deleteMedicine = async (id: string, notifIds?: string[]) => {
    if (notifIds?.length) {
      await Promise.all(
        notifIds.map((nid) => Notifications.cancelScheduledNotificationAsync(nid)),
      );
    }
    await saveMedicines(medicines.filter((m) => m.id !== id));
    if (selectedMedicine?.id === id) setDetailsModalVisible(false);
  };

  // The daily alarms already ring at fixed clock times regardless of when
  // the user taps this, so "taken now" only needs to record that moment
  // for display — it must NOT touch or reschedule the notifications,
  // otherwise every "taken" tap would shift the whole daily schedule
  // forward from the current moment again (the exact bug being fixed).
  const takeMedicineNow = async () => {
    if (!selectedMedicine) return;
    const updatedMed = { ...selectedMedicine, lastTakenTime: Date.now() };
    await saveMedicines(medicines.map((m) => (m.id === updatedMed.id ? updatedMed : m)));
    setSelectedMedicine(updatedMed);
    Alert.alert(t("done"), t("hcTakenBody"));
  };

  const resetMedicineForm = () => {
    setMedicineName("");
    setDescription("");
    setDosage("");
    setDosageUnit("mg");
    setInterval("8");
    setMedStartHour("");
    setMedStartMinute("");
    setMedStartAmPm("AM");
  };

  const formatDosage = (d: string, u: string) =>
    `${d} ${u === "capsule" ? (d === "1" ? t("hcCapsule") : t("hcCapsules")) : u}`;

  const getNextDoseTime = (med: Medicine) => {
    // Preferred path: medicines created with the fixed daily alarm times.
    if (med.notificationTimes && med.notificationTimes.length > 0) {
      const now = new Date();
      let best: Date | null = null;
      for (const slot of med.notificationTimes) {
        const candidate = new Date(now);
        candidate.setHours(slot.hour, slot.minute, 0, 0);
        if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1);
        if (!best || candidate.getTime() < best.getTime()) best = candidate;
      }
      if (best) {
        const diff = best.getTime() - now.getTime();
        const h = best.getHours().toString().padStart(2, "0");
        const m = best.getMinutes().toString().padStart(2, "0");
        const hr = Math.floor(diff / (1000 * 60 * 60));
        const mn = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return t("hcInHM", { time: `${h}:${m}`, h: hr, m: mn });
      }
    }
    // Fallback for medicines saved before fixed-time alarms existed.
    const nextTime = med.lastTakenTime + med.interval * 60 * 60 * 1000;
    const diff = nextTime - Date.now();
    if (diff <= 0) return t("hcNowOverdue");
    const date = new Date(nextTime);
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    const hr = Math.floor(diff / (1000 * 60 * 60));
    const mn = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return t("hcInHM", { time: `${h}:${m}`, h: hr, m: mn });
  };

  // Appointment Functions
  const timeProblem = (): string => {
    if (!apptHour || !apptMinute) return t("hcApptFillAll");
    const h = parseInt(apptHour);
    const m = parseInt(apptMinute);
    if (isNaN(h) || isNaN(m) || h < 1 || h > 12 || m < 0 || m > 59) return t("hcApptBadTime");
    return "";
  };

  const apptNext = () => {
    if (apptStep === 0 && !selectedDate) {
      setApptError(t("hcSelectDateFirst"));
      return;
    }
    if (apptStep === 1) {
      const problem = timeProblem();
      if (problem) {
        setApptError(problem);
        return;
      }
    }
    setApptError("");
    setApptStep((n) => Math.min(n + 1, APPT_STEPS - 1));
  };

  const apptBack = () => {
    setApptError("");
    setApptStep((n) => Math.max(n - 1, 0));
  };

  const submitAppointmentHandler = async () => {
    if (!requireLogin(t("featAppointment"))) return;
    if (!selectedDate || !apptHour || !apptMinute || !apptType) {
      setApptError(t("hcApptFillAll"));
      return;
    }
    const h = parseInt(apptHour);
    const m = parseInt(apptMinute);
    if (isNaN(h) || isNaN(m) || h < 1 || h > 12 || m < 0 || m > 59) {
      setApptStep(1);
      setApptError(t("hcApptBadTime"));
      return;
    }
    const formattedTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${apptAmPm}`;
    setSubmittingAppt(true);
    setApptError("");
    try {
      const seniorName = (await AsyncStorage.getItem("userName")) || "Senior";
      const seniorId = (await AsyncStorage.getItem("userId")) || "N/A";
      // Submit to Firebase; the sub-admin receives this. The appointment
      // list is a live Firestore subscription (see the useEffect above),
      // so the new booking appears automatically once it's written —
      // no separate local save needed.
      await submitAppointment({
        seniorName,
        seniorId,
        date: selectedDate,
        time: formattedTime,
        type: apptType,
        notes: apptNotes,
      });
      setAppointModalVisible(false);
      setApptHour("");
      setApptMinute("");
      setApptAmPm("AM");
      setApptType("General Check-up");
      setApptNotes("");
      Alert.alert(
        t("hcApptSubmittedTitle"),
        myBarangay
          ? t("hcApptSubmittedBody1", { barangay: myBarangay })
          : t("hcApptSubmittedBody2")
      );
    } catch (e) {
      setApptError(t("hcApptSubmitFail"));
      console.log("Appointment submission error:", e);
    } finally {
      setSubmittingAppt(false);
    }
  };

  const getMarkedDates = () => {
    const marked: { [key: string]: any } = {};
    appointments.forEach((a) => {
      marked[a.date] = { marked: true, dotColor: c.primary };
    });
    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: c.primary,
        selectedTextColor: c.onColor,
      };
    }
    return marked;
  };

  // Stored/sent to the admin panel in English; only the label shown here is translated.
  const APPT_TYPE_KEY: Record<string, string> = {
    "General Check-up": "general",
    "Blood Pressure Monitoring": "bp",
    "Diabetes Consultation": "diabetes",
    "Physical Therapy": "physio",
    "Social Services": "social",
    "Nutrition Counseling": "nutrition",
    "Mental Health Support": "mental",
    "Eye Check-up": "eye",
    "Dental Consultation": "dental",
    "Vaccination": "vaccine",
  };
  const apptTypeLabel = (v: string) =>
    APPT_TYPE_KEY[v] ? t("apptType_" + APPT_TYPE_KEY[v]) : v;

  const appointmentTypes = [
    "General Check-up",
    "Blood Pressure Monitoring",
    "Diabetes Consultation",
    "Physical Therapy",
    "Social Services",
    "Nutrition Counseling",
    "Mental Health Support",
    "Eye Check-up",
    "Dental Consultation",
    "Vaccination",
  ];

  // Render
  return (
    <SafeAreaView style={styles.safeArea}>
      <BackBar />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <MaterialCommunityIcons name="hospital-box-outline" size={26} color={c.text} />
          <Text style={[styles.headerTitle, { fontSize: 24 * fontScale }]}>
            {t("hcTitle")}
          </Text>
        </View>
        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "medicine" && styles.tabBtnActive]}
            onPress={() => setActiveTab("medicine")}
          >
            <MaterialCommunityIcons
              name="pill"
              size={18}
              color={activeTab === "medicine" ? c.onColor : c.primary}
            />
            <Text style={[styles.tabBtnText, activeTab === "medicine" && styles.tabBtnTextActive, { fontSize: 15 * fontScale }]}>
              {t("hcTabMedicine")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "appointment" && styles.tabBtnActive]}
            onPress={() => setActiveTab("appointment")}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={activeTab === "appointment" ? c.onColor : c.primary}
            />
            <Text style={[styles.tabBtnText, activeTab === "appointment" && styles.tabBtnTextActive, { fontSize: 15 * fontScale }]}>
              {t("hcTabAppointment")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Medicine Tab */}
      {activeTab === "medicine" && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.tabContent}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setMedicineModalVisible(true)}
          >
            <MaterialCommunityIcons name="plus" size={22} color={c.onColor} />
            <Text style={[styles.primaryBtnText, { fontSize: 17 * fontScale }]}>
              {t("hcAddMedicineBtn")}
            </Text>
          </TouchableOpacity>

          {medicines.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="pill" size={60} color={c.border} />
              <Text style={[styles.emptyText, { fontSize: 18 * fontScale }]}>{t("hcNoMedicines")}</Text>
              <Text style={[styles.emptySubText, { fontSize: 15 * fontScale }]}>
                {t("hcNoMedicinesSub")}
              </Text>
            </View>
          ) : (
            medicines.map((med) => (
              <TouchableOpacity
                key={med.id}
                style={styles.card}
                onPress={() => { setSelectedMedicine(med); setDetailsModalVisible(true); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { fontSize: 19 * fontScale }]}>{med.name}</Text>
                  <Text style={[styles.cardSub, { fontSize: 15 * fontScale }]}>{formatDosage(med.dosage, med.dosageUnit)}</Text>
                  <Text style={[styles.cardNext, { fontSize: 14 * fontScale }]}>
                    {t("hcNext", { time: getNextDoseTime(med) })}
                  </Text>
                  <Text style={[styles.cardSub, { fontSize: 14 * fontScale, color: c.textMuted }]}>
                    {t("hcEveryShort", { n: med.interval })}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(t("hcDeleteTitle"), t("hcDeleteConfirm"), [
                      { text: t("cancel"), style: "cancel" },
                      {
                        text: t("hcDelete"),
                        style: "destructive",
                        onPress: () => deleteMedicine(med.id, med.notificationIds),
                      },
                    ])
                  }
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={24} color={c.danger} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Appointment Tab */}
      {activeTab === "appointment" && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.tabContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={c.primaryDark} />
            <Text style={[styles.infoText, { fontSize: 14 * fontScale }]}>
              {myBarangay
                ? t("hcApptInfo1", { barangay: myBarangay })
                : t("hcApptInfo2")}
            </Text>
          </View>

          <View style={styles.calendarWrapper}>
            <Calendar
              minDate={new Date().toISOString().split("T")[0]}
              onDayPress={(day: any) => {
                setSelectedDate(day.dateString);
                setApptError("");
              }}
              markedDates={getMarkedDates()}
              theme={{
                selectedDayBackgroundColor: c.primary,
                todayTextColor: c.primary,
                dotColor: c.primary,
              }}
            />
          </View>

          {selectedDate ? (
            <View style={styles.selectedDateBox}>
              <Text style={[{ fontSize: 16 * fontScale, color: c.textStrong }]}>{t("hcSelectedDate")}</Text>
              <Text style={[{ fontSize: 17 * fontScale, fontWeight: "bold", color: c.primaryDark }]}>
                {selectedDate}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 12 }]}
            onPress={() => { setApptStep(0); setAppointModalVisible(true); setApptError(""); }}
          >
            <Ionicons name="calendar" size={20} color={c.onColor} />
            <Text style={[styles.primaryBtnText, { fontSize: 17 * fontScale }]}>
              {t("hcBookAtCenter")}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { fontSize: 16 * fontScale }]}>{t("hcYourAppts")}</Text>

          {apptsLoading ? (
            <Text style={[styles.apptSub, { fontSize: 14 * fontScale }]}>{t("hcApptsLoading")}</Text>
          ) : apptsLoadError ? (
            <Text style={[styles.apptSub, { fontSize: 14 * fontScale, color: c.danger }]}>
              {t("hcApptsLoadError")}
            </Text>
          ) : appointments.length === 0 ? (
            <Text style={[styles.apptSub, { fontSize: 14 * fontScale, color: c.textMuted }]}>
              {t("hcApptsNone")}
            </Text>
          ) : (
            appointments.map((appt, idx) => {
              const status = normalizeAppointmentStatus(appt.status);
              return (
                <View
                  key={appt.id || idx}
                  style={[
                    styles.apptCard,
                    status === "confirmed" && styles.apptConfirmed,
                    status === "completed" && styles.apptConfirmed,
                    status === "cancelled" && styles.apptCancelled,
                  ]}
                >
                  <View style={styles.apptRow}>
                    <Text style={[styles.apptType, { fontSize: 17 * fontScale }]}>{apptTypeLabel(appt.type)}</Text>
                    <View
                      style={[
                        styles.badge,
                        (status === "confirmed" || status === "completed") && styles.badgeConfirmed,
                        status === "cancelled" && styles.badgeCancelled,
                      ]}
                    >
                      <Text style={styles.badgeText}>{t("apptStatus_" + status)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.apptSub, { fontSize: 14 * fontScale }]}>
                    {t("hcApptAt", { date: appt.date, time: appt.time })}
                  </Text>
                  {appt.notes ? (
                    <Text style={[styles.apptSub, { fontSize: 14 * fontScale, color: c.textMuted }]}>
                      {appt.notes}
                    </Text>
                  ) : null}

                  <AppointmentStatusTracker status={status} fontScale={fontScale} />

                  {status === "pending" && (
                    <Text style={styles.apptCancelHint}>
                      {t("hcApptCancelHint")}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Camera FAB */}
      <View style={styles.fab}>
        <TouchableOpacity
          style={styles.fabBtn}
          onPress={() => router.push("/screen/camera")}
        >
          <AntDesign name="camera" size={26} color={c.onColor} />
        </TouchableOpacity>
      </View>

      {/* Add Medicine Modal */}
      <Modal visible={medicineModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { fontSize: 22 * fontScale }]}>{t("hcAddMedTitle")}</Text>

              <Text style={styles.label}>{t("hcMedName")}</Text>
              <TextInput
                placeholder={t("hcMedNamePh")}
                placeholderTextColor={c.textMuted}
                value={medicineName}
                onChangeText={setMedicineName}
                style={styles.input}
              />

              <Text style={styles.label}>{t("hcMedPurpose")}</Text>
              <TextInput
                placeholder={t("hcMedPurposePh")}
                placeholderTextColor={c.textMuted}
                value={description}
                onChangeText={setDescription}
                style={styles.input}
              />

              <Text style={styles.label}>{t("hcDosageAmount")}</Text>
              <TextInput
                placeholder={t("hcDosageAmountPh")}
                placeholderTextColor={c.textMuted}
                value={dosage}
                onChangeText={setDosage}
                keyboardType="decimal-pad"
                style={styles.input}
              />

              <Text style={styles.label}>{t("hcUnit")}</Text>
              <View style={styles.pickerBox}>
                <Picker
                  selectedValue={dosageUnit}
                  onValueChange={(v) => setDosageUnit(v)}
                  style={{ height: 50 }}
                >
                  <Picker.Item label={t("hcUnitMg")} value="mg" />
                  <Picker.Item label={t("hcUnitMl")} value="ml" />
                  <Picker.Item label={t("hcUnitCapsule")} value="capsule" />
                </Picker>
              </View>

              <Text style={styles.label}>{t("hcInterval")}</Text>
              <TextInput
                placeholder={t("hcIntervalPh")}
                placeholderTextColor={c.textMuted}
                value={interval}
                onChangeText={setInterval}
                keyboardType="number-pad"
                style={styles.input}
              />

              <Text style={styles.label}>{t("hcFirstAlarm")}</Text>
              <View style={styles.timeRow}>
                <TextInput
                  placeholder="HH"
                  placeholderTextColor={c.textMuted}
                  value={medStartHour}
                  onChangeText={(v) => setMedStartHour(v.replace(/[^0-9]/g, ""))}
                  style={[styles.input, styles.timeInput]}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.timeSep}>:</Text>
                <TextInput
                  placeholder="MM"
                  placeholderTextColor={c.textMuted}
                  value={medStartMinute}
                  onChangeText={(v) => setMedStartMinute(v.replace(/[^0-9]/g, ""))}
                  style={[styles.input, styles.timeInput]}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <View style={styles.amPmRow}>
                  {(["AM", "PM"] as const).map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.amPmBtn, medStartAmPm === v && styles.amPmBtnActive]}
                      onPress={() => setMedStartAmPm(v)}
                    >
                      <Text style={[styles.amPmTxt, medStartAmPm === v && styles.amPmTxtActive]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Text style={styles.hintText}>
                The alarm will repeat every {interval || "_"} hour(s) starting from this time, every day.
              </Text>

              <TouchableOpacity style={styles.saveBtn} onPress={addMedicine}>
                <Text style={[styles.saveBtnText, { fontSize: 17 * fontScale }]}>{t("hcSaveAlarm")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelLink}
                onPress={() => { setMedicineModalVisible(false); resetMedicineForm(); }}
              >
                <Text style={styles.cancelLinkText}>{t("cancel")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Medicine Details Modal */}
      <Modal visible={detailsModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {selectedMedicine && (
              <>
                <Text style={[styles.modalTitle, { fontSize: 22 * fontScale }]}>{selectedMedicine.name}</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t("hcDetailDescription")}</Text>
                  <Text style={styles.detailVal}>{selectedMedicine.description || t("hcNotSet")}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t("hcDetailDosage")}</Text>
                  <Text style={styles.detailVal}>{formatDosage(selectedMedicine.dosage, selectedMedicine.dosageUnit)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t("hcDetailAlarm")}</Text>
                  <Text style={styles.detailVal}>{t("hcEveryLong", { n: selectedMedicine.interval })}</Text>
                </View>
                <View style={[styles.detailRow, styles.nextDoseHighlight]}>
                  <Text style={[styles.detailLabel, { color: c.primary }]}>{t("hcDetailNextDose")}</Text>
                  <Text style={[styles.detailVal, { color: c.primaryDark, fontWeight: "bold" }]}>
                    {getNextDoseTime(selectedMedicine)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: c.success, marginTop: 20 }]}
                  onPress={takeMedicineNow}
                >
                  <Text style={[styles.saveBtnText, { fontSize: 17 * fontScale }]}>{t("hcMarkTaken")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelLink}
                  onPress={() => setDetailsModalVisible(false)}
                >
                  <Text style={styles.cancelLinkText}>{t("close")}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Book Appointment Modal */}
      <Modal visible={appointModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { fontSize: 22 * fontScale }]}>
                {t("hcBookTitle")}
              </Text>
              <Text style={[styles.apptCenter, { fontSize: 15 * fontScale }]}>
                {t("hcCenterName")}
              </Text>

              {selectedDate ? (
                <View style={styles.selectedDateBox}>
                  <Text style={{ fontSize: 15 * fontScale, color: c.textStrong }}>{t("hcDateSelected")}</Text>
                  <Text style={{ fontWeight: "bold", color: c.primaryDark, fontSize: 16 * fontScale }}>
                    {selectedDate}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: c.danger, marginBottom: 8, fontSize: 14 * fontScale }}>
                  {t("hcSelectDateFirst")}
                </Text>
              )}

              <Text style={[styles.stepText, { fontSize: 16 * fontScale }]}>
                {t("suStepOf", { n: apptStep + 1, total: APPT_STEPS })}
              </Text>
              <View style={styles.stepTrack}>
                <View style={[styles.stepFill, { width: `${((apptStep + 1) / APPT_STEPS) * 100}%` }]} />
              </View>

              {apptStep === 0 && (
                <>
                  <Text style={styles.label}>{t("hcApptType")}</Text>
                  <View style={styles.pickerBox}>
                    <Picker
                      selectedValue={apptType}
                      onValueChange={(v) => setApptType(v)}
                      style={{ height: 50 }}
                    >
                      {appointmentTypes.map((tName) => (
                        <Picker.Item key={tName} label={apptTypeLabel(tName)} value={tName} />
                      ))}
                    </Picker>
                  </View>
                </>
              )}

              {apptStep === 1 && (
                <>
                  <Text style={styles.label}>{t("hcTime")}</Text>
                  <View style={styles.timeRow}>
                    <TextInput
                      placeholder="HH"
                      placeholderTextColor={c.textMuted}
                      value={apptHour}
                      onChangeText={(v) => setApptHour(v.replace(/[^0-9]/g, ""))}
                      style={[styles.input, styles.timeInput]}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <Text style={styles.timeSep}>:</Text>
                    <TextInput
                      placeholder="MM"
                      placeholderTextColor={c.textMuted}
                      value={apptMinute}
                      onChangeText={(v) => setApptMinute(v.replace(/[^0-9]/g, ""))}
                      style={[styles.input, styles.timeInput]}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <View style={styles.amPmRow}>
                      {(["AM", "PM"] as const).map((v) => (
                        <TouchableOpacity
                          key={v}
                          style={[styles.amPmBtn, apptAmPm === v && styles.amPmBtnActive]}
                          onPress={() => setApptAmPm(v)}
                        >
                          <Text style={[styles.amPmTxt, apptAmPm === v && styles.amPmTxtActive]}>{v}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {apptStep === 2 && (
                <>
                  <Text style={styles.label}>{t("hcNotes")}</Text>
                  <TextInput
                    placeholder={t("hcNotesPh")}
                    placeholderTextColor={c.textMuted}
                    value={apptNotes}
                    onChangeText={setApptNotes}
                    style={[styles.input, { height: 70 }]}
                    multiline
                  />
                </>
              )}

              {apptStep === 3 && (
                <>
                  <Text style={[styles.reviewTitle, { fontSize: 22 * fontScale }]}>{t("suReviewTitle")}</Text>
                  <Text style={[styles.apptCenter, { fontSize: 15 * fontScale, textAlign: "left" }]}>{t("suReviewHint")}</Text>
                  {[
                    { label: t("hcApptType"), value: apptTypeLabel(apptType), to: 0 },
                    {
                      label: t("hcTime"),
                      value: apptHour && apptMinute
                        ? `${apptHour.padStart(2, "0")}:${apptMinute.padStart(2, "0")} ${apptAmPm}`
                        : "",
                      to: 1,
                    },
                    { label: t("hcNotes"), value: apptNotes.trim() || t("acRvNoReason"), to: 2 },
                  ].map((row) => (
                    <View key={row.label} style={styles.reviewRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.reviewLabel, { fontSize: 14 * fontScale }]}>{row.label}</Text>
                        <Text style={[styles.reviewValue, { fontSize: 18 * fontScale }]}>{row.value}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.reviewEdit}
                        onPress={() => setApptStep(row.to)}
                        accessibilityRole="button"
                        accessibilityLabel={`${t("suEdit")}: ${row.label}`}
                      >
                        <Text style={[styles.reviewEditText, { fontSize: 16 * fontScale }]}>{t("suEdit")}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {apptError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{apptError}</Text>
                </View>
              ) : null}

              {apptStep === APPT_STEPS - 1 && (
                <TouchableOpacity
                  style={[styles.saveBtn, submittingAppt && { opacity: 0.7 }]}
                  onPress={submitAppointmentHandler}
                  disabled={submittingAppt}
                >
                  {submittingAppt ? (
                    <ActivityIndicator color={c.onColor} />
                  ) : (
                    <Text style={[styles.saveBtnText, { fontSize: 17 * fontScale }]}>
                      {t("hcSubmit")}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              <View style={styles.stepNavRow}>
                {apptStep > 0 && (
                  <TouchableOpacity style={styles.stepBack} onPress={apptBack} disabled={submittingAppt} accessibilityRole="button">
                    <Text style={[styles.stepBackText, { fontSize: 18 * fontScale }]}>{t("backBtn")}</Text>
                  </TouchableOpacity>
                )}
                {apptStep < APPT_STEPS - 1 && (
                  <TouchableOpacity style={styles.stepNext} onPress={apptNext} accessibilityRole="button">
                    <Text style={[styles.stepNextText, { fontSize: 18 * fontScale }]}>{t("suNext")}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.cancelLink}
                onPress={() => setAppointModalVisible(false)}
              >
                <Text style={styles.cancelLinkText}>{t("cancel")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: c.bg,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: c.text,
  },
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: c.border,
    borderRadius: 12,
    padding: 4,
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    minHeight: 44,
  },
  tabBtnActive: { backgroundColor: c.primary },
  tabBtnText: { fontSize: 15, color: c.primary, fontWeight: "600" },
  tabBtnTextActive: { color: c.onColor },
  scrollView: { flex: 1 },
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 160,
  },
  primaryBtn: {
    backgroundColor: c.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
    minHeight: 52,
  },
  primaryBtnText: { color: c.onColor, fontWeight: "bold", fontSize: 17 },
  card: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardTitle: { fontSize: 19, fontWeight: "bold", color: c.text, marginBottom: 3 },
  cardSub: { fontSize: 15, color: c.textStrong, marginBottom: 2 },
  cardNext: { fontSize: 14, color: c.primary, fontWeight: "600", marginTop: 2 },
  emptyState: { alignItems: "center", paddingVertical: 50 },
  emptyText: { fontSize: 18, fontWeight: "bold", color: c.textMuted, marginTop: 14 },
  emptySubText: { fontSize: 15, color: c.textMuted, marginTop: 6 },
  infoBox: {
    borderWidth: 1.5,
    borderColor: c.border,
    flexDirection: "row",
    backgroundColor: c.surfaceSoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 8,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 14, color: c.primaryDark, lineHeight: 20 },
  calendarWrapper: {
    borderWidth: 1.5,
    borderColor: c.cardBorder,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: c.surface,
    elevation: 3,
    marginBottom: 14,
  },
  selectedDateBox: {
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surfaceSoft,
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: c.textStrong,
    marginTop: 20,
    marginBottom: 10,
  },
  apptCard: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: c.border,
  },
  apptConfirmed: { borderColor: c.success, backgroundColor: c.successSoft },
  apptCancelled: { borderColor: c.danger, backgroundColor: c.dangerSoft },
  apptRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  apptType: { fontSize: 17, fontWeight: "bold", color: c.text, flex: 1 },
  apptSub: { fontSize: 14, color: c.textStrong, marginTop: 2 },
  apptCenter: { color: c.primary, fontWeight: "600", marginBottom: 14, textAlign: "center", fontSize: 15 },
  badge: { backgroundColor: c.warningSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeConfirmed: { backgroundColor: c.successSoft },
  badgeCancelled: { backgroundColor: c.dangerSoft },
  badgeText: { fontSize: 14, fontWeight: "bold", color: c.textStrong },
  apptCancelHint: {
    fontSize: 14,
    color: c.textMuted,
    marginTop: 8,
    fontStyle: "italic",
  },
  fab: { position: "absolute", bottom: 100, right: 20 },
  fabBtn: {
    backgroundColor: c.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalBox: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "92%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: c.text,
    marginBottom: 16,
    textAlign: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: c.textStrong,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    fontSize: 17,
    backgroundColor: c.surfaceAlt,
    minHeight: 50,
  },
  pickerBox: {
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 10,
    marginBottom: 14,
    overflow: "hidden",
    backgroundColor: c.surfaceAlt,
  },
  saveBtn: {
    backgroundColor: c.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
    minHeight: 52,
    justifyContent: "center",
  },
  saveBtnText: { color: c.onColor, fontWeight: "bold", fontSize: 17 },
  cancelLink: { marginTop: 12, alignItems: "center", padding: 12 },
  cancelLinkText: { color: c.danger, fontWeight: "bold", fontSize: 17 },
  detailRow: { marginBottom: 12 },
  detailLabel: { fontSize: 15, color: c.textMuted, marginBottom: 2 },
  detailVal: { fontSize: 18, color: c.text, fontWeight: "500" },
  nextDoseHighlight: {
    backgroundColor: c.surfaceSoft,
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  timeRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  timeInput: { flex: 1, textAlign: "center", marginBottom: 0 },
  timeSep: { marginHorizontal: 8, fontSize: 20, fontWeight: "bold" },
  amPmRow: { flexDirection: "row", marginLeft: 8 },
  amPmBtn: {
    borderWidth: 1.5,
    borderColor: c.textMuted,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginLeft: 4,
    backgroundColor: c.surfaceAlt,
    minHeight: 44,
    justifyContent: "center",
  },
  amPmBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
  amPmTxt: { color: c.textStrong, fontWeight: "bold", fontSize: 15 },
  amPmTxtActive: { color: c.onColor },
  hintText: { fontSize: 14, color: c.textMuted, marginTop: 4, marginBottom: 16, fontStyle: "italic" },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: c.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: c.danger, fontWeight: "bold", textAlign: "center", fontSize: 15 },
  // Step-by-step booking
  stepText: { fontSize: 16, fontWeight: "700", color: c.textStrong, textAlign: "center", marginBottom: 8 },
  stepTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
    overflow: "hidden",
    marginBottom: 18,
  },
  stepFill: { height: "100%", backgroundColor: c.primary },
  stepNavRow: { flexDirection: "row", gap: 12, marginTop: 4, marginBottom: 4 },
  stepBack: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBackText: { color: c.primary, fontSize: 18, fontWeight: "800" },
  stepNext: {
    flex: 2,
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNextText: { color: c.onColor, fontSize: 18, fontWeight: "800" },
  reviewTitle: { fontSize: 22, fontWeight: "800", color: c.text, marginBottom: 6 },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  reviewLabel: { fontSize: 14, fontWeight: "700", color: c.textMuted, marginBottom: 2 },
  reviewValue: { fontSize: 18, fontWeight: "700", color: c.text, lineHeight: 24 },
  reviewEdit: {
    minHeight: 48,
    minWidth: 84,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  reviewEditText: { fontSize: 16, fontWeight: "800", color: c.primary },
});
