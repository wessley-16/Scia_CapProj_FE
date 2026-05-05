import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AntDesign from "@expo/vector-icons/AntDesign";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar } from "react-native-calendars";
import { useFocusEffect } from "expo-router";
import { useSettings } from "@/context/SettingsContext";
import { Medicine } from "@/interfaces/interfaces";
import { submitAppointment } from "@/lib/firebase";
import AsyncStorageLib from "@react-native-async-storage/async-storage";

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type AppointmentStatus = "pending" | "confirmed" | "cancelled";

type AppointmentType = {
  id?: string;
  date: string;
  time: string;
  type: string;
  notes: string;
  status: AppointmentStatus;
  submittedToFirebase?: boolean;
};

type ActiveTab = "medicine" | "appointment";

export default function Healthcare() {
  const { fontScale, t } = useSettings();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("medicine");

  // ─── MEDICINE STATE ───────────────────────────────────────────────────────
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medicineModalVisible, setMedicineModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [medicineName, setMedicineName] = useState("");
  const [description, setDescription] = useState("");
  const [dosage, setDosage] = useState("");
  const [dosageUnit, setDosageUnit] = useState<"ml" | "mg" | "capsule">("mg");
  const [interval, setInterval] = useState("8");
  const notifListener = useRef<any>();
  const responseListener = useRef<any>();

  // ─── APPOINTMENT STATE ────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState("");
  const [appointModalVisible, setAppointModalVisible] = useState(false);
  const [apptTime, setApptTime] = useState("");
  const [apptHour, setApptHour] = useState("");
  const [apptMinute, setApptMinute] = useState("");
  const [apptAmPm, setApptAmPm] = useState<"AM" | "PM">("AM");
  const [apptType, setApptType] = useState("General Check-up");
  const [apptNotes, setApptNotes] = useState("");
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [apptError, setApptError] = useState("");
  const [submittingAppt, setSubmittingAppt] = useState(false);

  // ─── LOAD DATA ────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      loadMedicines();
      loadAppointments();
    }, [])
  );

  useEffect(() => {
    registerNotifications();
    notifListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});
    return () => {
      if (notifListener.current) Notifications.removeNotificationSubscription(notifListener.current);
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
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
      }
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing !== "granted") {
        await Notifications.requestPermissionsAsync();
      }
    } catch (e) {
      console.log("Notif permission error:", e);
    }
  };

  // ─── MEDICINE FUNCTIONS ───────────────────────────────────────────────────
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

  const scheduleNotification = async (name: string, intervalHours: number) => {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "💊 Medicine Reminder",
          body: `Time to take ${name}!`,
          sound: true,
        },
        trigger: {
          seconds: intervalHours * 3600,
          repeats: true,
        } as any,
      });
      return id;
    } catch (e) {
      console.log("Notif schedule error:", e);
      return undefined;
    }
  };

  const addMedicine = async () => {
    if (!medicineName || !dosage || !interval) {
      Alert.alert("Missing Fields", "Please fill in all fields.");
      return;
    }
    const intervalNum = parseInt(interval);
    const notificationId = await scheduleNotification(medicineName, intervalNum);
    const newMedicine: Medicine = {
      id: Date.now().toString(),
      name: medicineName,
      description,
      dosage,
      dosageUnit,
      interval: intervalNum,
      startTime: Date.now(),
      lastTakenTime: Date.now(),
      createdAt: Date.now(),
      notificationId,
    };
    await saveMedicines([...medicines, newMedicine]);
    resetMedicineForm();
    setMedicineModalVisible(false);
  };

  const deleteMedicine = async (id: string, notifId?: string) => {
    if (notifId) await Notifications.cancelScheduledNotificationAsync(notifId);
    await saveMedicines(medicines.filter((m) => m.id !== id));
    if (selectedMedicine?.id === id) setDetailsModalVisible(false);
  };

  const takeMedicineNow = async () => {
    if (!selectedMedicine) return;
    const updatedMed = { ...selectedMedicine, lastTakenTime: Date.now() };
    if (selectedMedicine.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(selectedMedicine.notificationId);
    }
    const newNotifId = await scheduleNotification(updatedMed.name, updatedMed.interval);
    updatedMed.notificationId = newNotifId;
    await saveMedicines(medicines.map((m) => (m.id === updatedMed.id ? updatedMed : m)));
    setSelectedMedicine(updatedMed);
    Alert.alert("✅ Done", "Medicine marked as taken!");
  };

  const resetMedicineForm = () => {
    setMedicineName("");
    setDescription("");
    setDosage("");
    setDosageUnit("mg");
    setInterval("8");
  };

  const formatDosage = (d: string, u: string) =>
    `${d} ${u === "capsule" ? (d === "1" ? "capsule" : "capsules") : u}`;

  const getNextDoseTime = (med: Medicine) => {
    const nextTime = med.lastTakenTime + med.interval * 60 * 60 * 1000;
    const diff = nextTime - Date.now();
    if (diff <= 0) return "Now (Overdue)";
    const date = new Date(nextTime);
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    const hr = Math.floor(diff / (1000 * 60 * 60));
    const mn = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}:${m} (in ${hr}h ${mn}m)`;
  };

  // ─── APPOINTMENT FUNCTIONS ────────────────────────────────────────────────
  const loadAppointments = async () => {
    try {
      const stored = await AsyncStorage.getItem("appointments_local");
      if (stored) setAppointments(JSON.parse(stored));
    } catch (e) {
      console.log("Error loading appointments:", e);
    }
  };

  const saveAppointmentsLocal = async (updated: AppointmentType[]) => {
    try {
      await AsyncStorage.setItem("appointments_local", JSON.stringify(updated));
      setAppointments(updated);
    } catch (e) {
      console.log("Error saving appointments:", e);
    }
  };

  const submitAppointmentHandler = async () => {
    if (!selectedDate || !apptHour || !apptMinute || !apptType) {
      setApptError("Please fill in date, time and appointment type.");
      return;
    }
    const h = parseInt(apptHour);
    const m = parseInt(apptMinute);
    if (isNaN(h) || isNaN(m) || h < 1 || h > 12 || m < 0 || m > 59) {
      setApptError("Time must be valid (hour 1-12, minute 0-59).");
      return;
    }
    const formattedTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${apptAmPm}`;
    setSubmittingAppt(true);
    setApptError("");
    try {
      // Get senior info from storage
      const seniorName = (await AsyncStorageLib.getItem("userName")) || "Senior";
      const seniorId = (await AsyncStorageLib.getItem("userId")) || "N/A";
      // Submit to Firebase — sub-admin receives this
      await submitAppointment({
        seniorName,
        seniorId,
        date: selectedDate,
        time: formattedTime,
        type: apptType,
        notes: apptNotes,
      });
      // Also save locally
      const newAppt: AppointmentType = {
        id: Date.now().toString(),
        date: selectedDate,
        time: formattedTime,
        type: apptType,
        notes: apptNotes,
        status: "pending",
        submittedToFirebase: true,
      };
      await saveAppointmentsLocal([...appointments, newAppt]);
      setAppointModalVisible(false);
      setApptHour("");
      setApptMinute("");
      setApptAmPm("AM");
      setApptType("General Check-up");
      setApptNotes("");
      Alert.alert(
        "✅ Appointment Submitted",
        "Your appointment request has been sent to the 3S Center. Please wait for confirmation."
      );
    } catch (e) {
      setApptError("Failed to submit. Please check your connection.");
      console.log("Appointment submission error:", e);
    } finally {
      setSubmittingAppt(false);
    }
  };

  const getMarkedDates = () => {
    const marked: { [key: string]: any } = {};
    appointments.forEach((a) => {
      marked[a.date] = { marked: true, dotColor: "#2563EB" };
    });
    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: "#2356E1",
        selectedTextColor: "white",
      };
    }
    return marked;
  };

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

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { fontSize: 22 * fontScale }]}>
          🏥 Healthcare
        </Text>
        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "medicine" && styles.tabBtnActive]}
            onPress={() => setActiveTab("medicine")}
          >
            <MaterialCommunityIcons
              name="pill"
              size={18}
              color={activeTab === "medicine" ? "white" : "#2356E1"}
            />
            <Text style={[styles.tabBtnText, activeTab === "medicine" && styles.tabBtnTextActive, { fontSize: 13 * fontScale }]}>
              Medicine
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "appointment" && styles.tabBtnActive]}
            onPress={() => setActiveTab("appointment")}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={activeTab === "appointment" ? "white" : "#2356E1"}
            />
            <Text style={[styles.tabBtnText, activeTab === "appointment" && styles.tabBtnTextActive, { fontSize: 13 * fontScale }]}>
              Appointment
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── MEDICINE TAB ── */}
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
            <MaterialCommunityIcons name="plus" size={22} color="white" />
            <Text style={[styles.primaryBtnText, { fontSize: 15 * fontScale }]}>
              Add Medicine & Set Alarm
            </Text>
          </TouchableOpacity>

          {medicines.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="pill" size={60} color="#D1D5DB" />
              <Text style={[styles.emptyText, { fontSize: 16 * fontScale }]}>No medicines added yet</Text>
              <Text style={[styles.emptySubText, { fontSize: 13 * fontScale }]}>
                Add your first medicine to get reminders
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
                  <Text style={[styles.cardTitle, { fontSize: 17 * fontScale }]}>{med.name}</Text>
                  <Text style={[styles.cardSub, { fontSize: 13 * fontScale }]}>{formatDosage(med.dosage, med.dosageUnit)}</Text>
                  <Text style={[styles.cardNext, { fontSize: 12 * fontScale }]}>
                    ⏰ Next: {getNextDoseTime(med)}
                  </Text>
                  <Text style={[styles.cardSub, { fontSize: 11 * fontScale, color: "#9CA3AF" }]}>
                    Every {med.interval}h
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert("Delete Medicine", "Are you sure?", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => deleteMedicine(med.id, med.notificationId),
                      },
                    ])
                  }
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={24} color="#EF4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* ── APPOINTMENT TAB ── */}
      {activeTab === "appointment" && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.tabContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color="#1E40AF" />
            <Text style={[styles.infoText, { fontSize: 12 * fontScale }]}>
              Appointments are sent to the 3S Senior Center in Valenzuela. Sub-admin will confirm your booking.
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
                selectedDayBackgroundColor: "#2356E1",
                todayTextColor: "#2356E1",
                dotColor: "#2356E1",
              }}
            />
          </View>

          {selectedDate ? (
            <View style={styles.selectedDateBox}>
              <Text style={[{ fontSize: 14 * fontScale, color: "#4B5563" }]}>Selected Date:</Text>
              <Text style={[{ fontSize: 15 * fontScale, fontWeight: "bold", color: "#1E3A8A" }]}>
                {selectedDate}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 12 }]}
            onPress={() => { setAppointModalVisible(true); setApptError(""); }}
          >
            <Ionicons name="calendar" size={20} color="white" />
            <Text style={[styles.primaryBtnText, { fontSize: 15 * fontScale }]}>
              Book Appointment at 3S Center
            </Text>
          </TouchableOpacity>

          {appointments.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { fontSize: 14 * fontScale }]}>Your Appointments</Text>
              {appointments.map((appt, idx) => (
                <View
                  key={appt.id || idx}
                  style={[
                    styles.apptCard,
                    appt.status === "confirmed" && styles.apptConfirmed,
                    appt.status === "cancelled" && styles.apptCancelled,
                  ]}
                >
                  <View style={styles.apptRow}>
                    <Text style={[styles.apptType, { fontSize: 15 * fontScale }]}>{appt.type}</Text>
                    <View style={[styles.badge,
                      appt.status === "confirmed" && styles.badgeConfirmed,
                      appt.status === "cancelled" && styles.badgeCancelled,
                    ]}>
                      <Text style={styles.badgeText}>
                        {appt.status === "pending" ? "⏳ Pending" :
                         appt.status === "confirmed" ? "✅ Confirmed" : "❌ Cancelled"}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.apptSub, { fontSize: 12 * fontScale }]}>
                    📅 {appt.date} at {appt.time}
                  </Text>
                  {appt.notes ? (
                    <Text style={[styles.apptSub, { fontSize: 12 * fontScale, color: "#9CA3AF" }]}>
                      📝 {appt.notes}
                    </Text>
                  ) : null}
                  {appt.submittedToFirebase && (
                    <Text style={[{ fontSize: 11 * fontScale, color: "#10B981", marginTop: 4 }]}>
                      ✔ Sent to 3S Center
                    </Text>
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* ── ADD MEDICINE MODAL ── */}
      <Modal visible={medicineModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { fontSize: 20 * fontScale }]}>Add Medicine & Set Alarm</Text>

              <Text style={styles.label}>Medicine Name</Text>
              <TextInput
                placeholder="e.g. Metformin"
                value={medicineName}
                onChangeText={setMedicineName}
                style={styles.input}
              />

              <Text style={styles.label}>Description / Purpose</Text>
              <TextInput
                placeholder="e.g. For blood sugar"
                value={description}
                onChangeText={setDescription}
                style={styles.input}
              />

              <Text style={styles.label}>Dosage Amount</Text>
              <TextInput
                placeholder="e.g. 500"
                value={dosage}
                onChangeText={setDosage}
                keyboardType="decimal-pad"
                style={styles.input}
              />

              <Text style={styles.label}>Unit</Text>
              <View style={styles.pickerBox}>
                <Picker
                  selectedValue={dosageUnit}
                  onValueChange={(v) => setDosageUnit(v)}
                  style={{ height: 50 }}
                >
                  <Picker.Item label="mg (milligrams)" value="mg" />
                  <Picker.Item label="ml (milliliters)" value="ml" />
                  <Picker.Item label="Capsule" value="capsule" />
                </Picker>
              </View>

              <Text style={styles.label}>Alarm Interval (hours)</Text>
              <TextInput
                placeholder="e.g. 8 (every 8 hours)"
                value={interval}
                onChangeText={setInterval}
                keyboardType="number-pad"
                style={styles.input}
              />

              <TouchableOpacity style={styles.saveBtn} onPress={addMedicine}>
                <Text style={[styles.saveBtnText, { fontSize: 15 * fontScale }]}>💊 Save & Set Alarm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelLink}
                onPress={() => { setMedicineModalVisible(false); resetMedicineForm(); }}
              >
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MEDICINE DETAILS MODAL ── */}
      <Modal visible={detailsModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {selectedMedicine && (
              <>
                <Text style={[styles.modalTitle, { fontSize: 20 * fontScale }]}>{selectedMedicine.name}</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailVal}>{selectedMedicine.description || "—"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Dosage</Text>
                  <Text style={styles.detailVal}>{formatDosage(selectedMedicine.dosage, selectedMedicine.dosageUnit)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Alarm</Text>
                  <Text style={styles.detailVal}>Every {selectedMedicine.interval} hours</Text>
                </View>
                <View style={[styles.detailRow, styles.nextDoseHighlight]}>
                  <Text style={[styles.detailLabel, { color: "#2563EB" }]}>Next Dose</Text>
                  <Text style={[styles.detailVal, { color: "#1E40AF", fontWeight: "bold" }]}>
                    {getNextDoseTime(selectedMedicine)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: "#10B981", marginTop: 20 }]}
                  onPress={takeMedicineNow}
                >
                  <Text style={[styles.saveBtnText, { fontSize: 15 * fontScale }]}>✅ Mark as Taken Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelLink}
                  onPress={() => setDetailsModalVisible(false)}
                >
                  <Text style={styles.cancelLinkText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── BOOK APPOINTMENT MODAL ── */}
      <Modal visible={appointModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { fontSize: 20 * fontScale }]}>
                📋 Book Appointment
              </Text>
              <Text style={[styles.apptCenter, { fontSize: 13 * fontScale }]}>
                3S Senior Citizens Center — Valenzuela City
              </Text>

              {selectedDate ? (
                <View style={styles.selectedDateBox}>
                  <Text style={{ fontSize: 13 * fontScale, color: "#4B5563" }}>Date selected:</Text>
                  <Text style={{ fontWeight: "bold", color: "#1E3A8A", fontSize: 14 * fontScale }}>
                    {selectedDate}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: "#EF4444", marginBottom: 8, fontSize: 12 * fontScale }}>
                  ⚠ Please go back and select a date from the calendar first.
                </Text>
              )}

              <Text style={styles.label}>Appointment Type</Text>
              <View style={styles.pickerBox}>
                <Picker
                  selectedValue={apptType}
                  onValueChange={(v) => setApptType(v)}
                  style={{ height: 50 }}
                >
                  {appointmentTypes.map((t) => (
                    <Picker.Item key={t} label={t} value={t} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Time</Text>
              <View style={styles.timeRow}>
                <TextInput
                  placeholder="HH"
                  value={apptHour}
                  onChangeText={(v) => setApptHour(v.replace(/[^0-9]/g, ""))}
                  style={[styles.input, styles.timeInput]}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.timeSep}>:</Text>
                <TextInput
                  placeholder="MM"
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

              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                placeholder="Any special concerns?"
                value={apptNotes}
                onChangeText={setApptNotes}
                style={[styles.input, { height: 70 }]}
                multiline
              />

              {apptError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{apptError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, submittingAppt && { opacity: 0.7 }]}
                onPress={submitAppointmentHandler}
                disabled={submittingAppt}
              >
                {submittingAppt ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={[styles.saveBtnText, { fontSize: 15 * fontScale }]}>
                    📤 Submit to 3S Center
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelLink}
                onPress={() => setAppointModalVisible(false)}
              >
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F6F9" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#F4F6F9",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 12,
  },
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    padding: 4,
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  tabBtnActive: { backgroundColor: "#2356E1" },
  tabBtnText: { fontSize: 13, color: "#2356E1", fontWeight: "600" },
  tabBtnTextActive: { color: "white" },
  scrollView: { flex: 1 },
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 160,
  },
  primaryBtn: {
    backgroundColor: "#2356E1",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  primaryBtnText: { color: "white", fontWeight: "bold", fontSize: 15 },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: { fontSize: 17, fontWeight: "bold", color: "#1F2937", marginBottom: 3 },
  cardSub: { fontSize: 13, color: "#4B5563", marginBottom: 2 },
  cardNext: { fontSize: 12, color: "#2563EB", fontWeight: "600", marginTop: 2 },
  emptyState: { alignItems: "center", paddingVertical: 50 },
  emptyText: { fontSize: 16, fontWeight: "bold", color: "#6B7280", marginTop: 14 },
  emptySubText: { fontSize: 13, color: "#9CA3AF", marginTop: 6 },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 8,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 12, color: "#1E40AF", lineHeight: 18 },
  calendarWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "white",
    elevation: 3,
    marginBottom: 14,
  },
  selectedDateBox: {
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
    marginTop: 20,
    marginBottom: 10,
  },
  apptCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  apptConfirmed: { borderColor: "#10B981", backgroundColor: "#ECFDF5" },
  apptCancelled: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  apptRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  apptType: { fontSize: 15, fontWeight: "bold", color: "#1F2937", flex: 1 },
  apptSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  apptCenter: { color: "#2356E1", fontWeight: "600", marginBottom: 14, textAlign: "center" },
  badge: { backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeConfirmed: { backgroundColor: "#D1FAE5" },
  badgeCancelled: { backgroundColor: "#FEE2E2" },
  badgeText: { fontSize: 11, fontWeight: "bold", color: "#374151" },
  fab: { position: "absolute", bottom: 100, right: 20 },
  fabBtn: {
    backgroundColor: "#2356E1",
    width: 56,
    height: 56,
    borderRadius: 28,
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
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "92%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
    textAlign: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    fontSize: 15,
    backgroundColor: "#F9FAFB",
  },
  pickerBox: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    marginBottom: 14,
    overflow: "hidden",
    backgroundColor: "#F9FAFB",
  },
  saveBtn: {
    backgroundColor: "#2356E1",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  saveBtnText: { color: "white", fontWeight: "bold", fontSize: 15 },
  cancelLink: { marginTop: 12, alignItems: "center", padding: 10 },
  cancelLinkText: { color: "#EF4444", fontWeight: "bold", fontSize: 15 },
  detailRow: { marginBottom: 12 },
  detailLabel: { fontSize: 13, color: "#6B7280", marginBottom: 2 },
  detailVal: { fontSize: 17, color: "#1F2937", fontWeight: "500" },
  nextDoseHighlight: {
    backgroundColor: "#EFF6FF",
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  timeRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  timeInput: { flex: 1, textAlign: "center", marginBottom: 0 },
  timeSep: { marginHorizontal: 8, fontSize: 18, fontWeight: "bold" },
  amPmRow: { flexDirection: "row", marginLeft: 8 },
  amPmBtn: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 8,
    marginLeft: 4,
    backgroundColor: "#F9FAFB",
  },
  amPmBtnActive: { backgroundColor: "#2356E1", borderColor: "#2356E1" },
  amPmTxt: { color: "#374151", fontWeight: "bold", fontSize: 13 },
  amPmTxtActive: { color: "white" },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { color: "#B91C1C", fontWeight: "bold", textAlign: "center" },
});
