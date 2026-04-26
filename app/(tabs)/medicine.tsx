import { MaterialCommunityIcons } from "@expo/vector-icons";
import AntDesign from "@expo/vector-icons/AntDesign";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import * as Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useFocusEffect, useRouter } from "expo-router";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "../../context/SettingsContext";
import { Medicine } from "../../interfaces/interfaces";

// Configure notifications behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function medicine() {
  const { fontScale, t } = useSettings();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(
    null,
  );

  // Form State
  const [medicineName, setMedicineName] = useState("");
  const [description, setDescription] = useState("");
  const [dosage, setDosage] = useState("");
  const [dosageUnit, setDosageUnit] = useState<"ml" | "mg" | "capsule">("mg");
  const [interval, setInterval] = useState("8");

  const router = useRouter();
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useFocusEffect(
    useCallback(() => {
      loadMedicines();
    }, []),
  );

  useEffect(() => {
    registerForPushNotificationsAsync();

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        // console.log(notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        // console.log(response);
      });

    return () => {
      // Clean up subscriptions
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current,
        );
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const registerForPushNotificationsAsync = async () => {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });
      }

      if (Constants.appOwnership === "expo") {
        // In Expo Go, we can't request full push permissions easily without error on Android sometimes
        // But local notifications should work without the full push dance if we just ask quietly.
        // However, scheduleNotificationAsync requires permissions on Android 13+.
        // We'll wrap this in a try-catch to be safe.
      }

      let existingStatus;
      try {
        const settings = await Notifications.getPermissionsAsync();
        existingStatus = settings.status;
      } catch (e) {
        existingStatus = "undetermined";
      }

      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        try {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        } catch (err) {
          console.log("Error requesting permissions:", err);
        }
      }
      if (finalStatus !== "granted") {
        // Alert.alert('Permission needed', 'Failed to get push token for push notification!');
        return;
      }
    } catch (error) {
      console.log("Notification permissions error (likely Expo Go):", error);
    }
  };

  const loadMedicines = async () => {
    try {
      const stored = await AsyncStorage.getItem("medicines");
      if (stored) setMedicines(JSON.parse(stored));
    } catch (error) {
      console.log("Error loading medicines:", error);
    }
  };

  const saveMedicines = async (updatedMedicines: Medicine[]) => {
    try {
      await AsyncStorage.setItem("medicines", JSON.stringify(updatedMedicines));
      setMedicines(updatedMedicines);
    } catch (error) {
      console.log("Error saving medicines:", error);
    }
  };

  const scheduleNotification = async (name: string, intervalHours: number) => {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Time to take your medicine!",
          body: `Don't forget to take ${name}.`,
          sound: true,
        },
        trigger: {
          seconds: intervalHours * 3600, // Convert hours to seconds
          repeats: true,
        } as any, // Type assertion for trigger
      });
      return id;
    } catch (error) {
      console.log("Error scheduling notification:", error);
      return undefined;
    }
  };

  const addMedicine = async () => {
    if (!medicineName || !dosage || !interval) {
      Alert.alert("Missing Fields", "Please fill in all fields");
      return;
    }

    const intervalNum = parseInt(interval);
    const notificationId = await scheduleNotification(
      medicineName,
      intervalNum,
    );

    const newMedicine: Medicine = {
      id: Date.now().toString(),
      name: medicineName,
      description: description,
      dosage,
      dosageUnit,
      interval: intervalNum,
      startTime: Date.now(),
      lastTakenTime: Date.now(),
      createdAt: Date.now(),
      notificationId: notificationId,
    };

    const updatedMedicines = [...medicines, newMedicine];
    await saveMedicines(updatedMedicines);

    resetForm();
    setModalVisible(false);
  };

  const deleteMedicine = async (id: string, notifId?: string) => {
    if (notifId) {
      await Notifications.cancelScheduledNotificationAsync(notifId);
    }
    const updatedMedicines = medicines.filter((med) => med.id !== id);
    await saveMedicines(updatedMedicines);
    if (selectedMedicine?.id === id) {
      setDetailsModalVisible(false);
    }
  };

  const resetForm = () => {
    setMedicineName("");
    setDescription("");
    setDosage("");
    setDosageUnit("mg");
    setInterval("8");
  };

  const handleMedicineClick = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setDetailsModalVisible(true);
  };

  const takeMedicineNow = async () => {
    if (!selectedMedicine) return;

    // Update last taken time
    const updatedMed = {
      ...selectedMedicine,
      lastTakenTime: Date.now(),
    };

    // Reschedule notification if needed (cancel old, start new timer from now)
    if (selectedMedicine.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(
        selectedMedicine.notificationId,
      );
    }
    const newNotifId = await scheduleNotification(
      updatedMed.name,
      updatedMed.interval,
    );
    updatedMed.notificationId = newNotifId;

    // Update list
    const updatedList = medicines.map((m) =>
      m.id === updatedMed.id ? updatedMed : m,
    );
    await saveMedicines(updatedList);

    setSelectedMedicine(updatedMed);
    Alert.alert("Success", "Medicine marked as taken!");
  };

  const formatDosage = (dosage: string, unit: string) => {
    const unitSymbol =
      unit === "capsule" ? (dosage === "1" ? "capsule" : "capsules") : unit;
    return `${dosage} ${unitSymbol}`;
  };

  // Helper to calculate next dose
  const getNextDoseTime = (med: Medicine) => {
    // 1. If we have explicit notification times (FIXED SCHEDULE)
    if (med.notificationTimes && med.notificationTimes.length > 0) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Sort times just in case
      const sortedTimes = [...med.notificationTimes].sort(
        (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
      );

      // Find next time today
      let next = sortedTimes.find(
        (t) =>
          t.hour > currentHour ||
          (t.hour === currentHour && t.minute > currentMinute),
      );

      // If no more times today, take the first one tomorrow
      if (!next) {
        next = sortedTimes[0];
      }

      // Format time
      const h = next.hour.toString().padStart(2, "0");
      const m = next.minute.toString().padStart(2, "0");
      return `${h}:${m}`;
    }

    // 2. Fallback to interval-based calculation
    const nextTime = med.lastTakenTime + med.interval * 60 * 60 * 1000;
    const now = Date.now();
    const diff = nextTime - now;

    if (diff <= 0) return "Now (Overdue)";

    // Format nicely
    const date = new Date(nextTime);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    // Calculate remaining hours/minutes
    const hoursRemaining = Math.floor(diff / (1000 * 60 * 60));
    const minutesRemaining = Math.floor(
      (diff % (1000 * 60 * 60)) / (1000 * 60),
    );

    return `${hours}:${minutes} (in ${hoursRemaining}h ${minutesRemaining}m)`;
  };

  const getDurationText = (med: Medicine) => {
    if (!med.endDate) return "Indefinite (Maintenance)";

    // Calculate days remaining
    const end = new Date(med.endDate).getTime();
    const now = Date.now();
    const diff = end - now;

    if (diff < 0) return "Schedule Ended";

    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return `${days} days left (Until ${new Date(med.endDate).toLocaleDateString()})`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headerTitle, { fontSize: 24 * fontScale }]}>Medicine Pill Box</Text>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <MaterialCommunityIcons name="plus" size={28} color="white" />
          <Text style={[styles.addButtonText, { fontSize: 16 * fontScale }]}>Add Medicine</Text>
        </TouchableOpacity>

        {medicines.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="pill" size={60} color="#D1D5DB" />
            <Text style={[styles.emptyStateText, { fontSize: 18 * fontScale }]}>No medicines added yet</Text>
            <Text style={[styles.emptyStateSubText, { fontSize: 14 * fontScale }]}>
              Add your first medicine to get started
            </Text>
          </View>
        ) : (
          medicines.map((medicine) => (
            <TouchableOpacity
              key={medicine.id}
              style={styles.medicineCard}
              onPress={() => handleMedicineClick(medicine)}
            >
              <View style={styles.medicineContent}>
                <View style={styles.medicineLeft}>
                  <Text style={[styles.medicineName, { fontSize: 20 * fontScale }]}>{medicine.name}</Text>
                  <Text style={[styles.medicineDetails, { fontSize: 14 * fontScale }]}>
                    {formatDosage(medicine.dosage, medicine.dosageUnit)}
                  </Text>
                  <Text style={[styles.nextDoseText, { fontSize: 12 * fontScale }]}>
                    Next: {getNextDoseTime(medicine)}
                  </Text>
                  <Text
                    style={[
                      styles.medicineDetails,
                      { fontSize: 12 * fontScale, marginTop: 4, color: "#666" },
                    ]}
                  >
                    {getDurationText(medicine)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() =>
                  Alert.alert(
                    "Delete Medicine",
                    "Are you sure you want to delete this medicine?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () =>
                          deleteMedicine(medicine.id, medicine.notificationId),
                      },
                    ],
                  )
                }
              >
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={24}
                  color="#EF4444"
                />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* ADD MEDICINE MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { fontSize: 22 * fontScale }]}>{t("addMedicine")}</Text>

              <Text style={[styles.label, { fontSize: 14 * fontScale }]}>{t("medicineName")}</Text>
              <TextInput
                placeholder={t("medicineNamePlaceholder")}
                value={medicineName}
                onChangeText={setMedicineName}
                style={styles.input}
              />

              <Text style={[styles.label, { fontSize: 14 * fontScale }]}>{t("descriptionPurpose")}</Text>
              <TextInput
                placeholder={t("descriptionPlaceholder")}
                value={description}
                onChangeText={setDescription}
                style={styles.input}
              />

              <Text style={[styles.label, { fontSize: 14 * fontScale }]}>{t("dosage")}</Text>
              <TextInput
                placeholder={t("dosagePlaceholder")}
                value={dosage}
                onChangeText={setDosage}
                keyboardType="decimal-pad"
                style={styles.input}
              />

              <Text style={[styles.label, { fontSize: 14 * fontScale }]}>{t("unit")}</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={dosageUnit}
                  onValueChange={(itemValue) => setDosageUnit(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="mg (milligrams)" value="mg" />
                  <Picker.Item label="ml (milliliters)" value="ml" />
                  <Picker.Item label="Capsule" value="capsule" />
                </Picker>
              </View>

              <Text style={[styles.label, { fontSize: 14 * fontScale }]}>{t("intervalHours")}</Text>
              <TextInput
                placeholder={t("intervalPlaceholder")}
                value={interval}
                onChangeText={setInterval}
                keyboardType="number-pad"
                style={styles.input}
              />

              <TouchableOpacity style={styles.saveButton} onPress={addMedicine}>
                <Text style={[styles.saveButtonText, { fontSize: 16 * fontScale }]}>{t("saveSchedule")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={[styles.cancelButtonText, { fontSize: 16 * fontScale }]}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DETAILS MODAL */}
      <Modal visible={detailsModalVisible} animationType="fade" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            {selectedMedicine && (
              <>
                <Text style={[styles.modalTitle, { fontSize: 22 * fontScale }]}>{selectedMedicine.name}</Text>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { fontSize: 14 * fontScale }]}>{t("descriptionLabel")}</Text>
                  <Text style={styles.detailValue}>
                    {selectedMedicine.description || t("noDescriptionProvided")}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { fontSize: 14 * fontScale }]}>{t("dosageLabel")}</Text>
                  <Text style={styles.detailValue}>
                    {formatDosage(
                      selectedMedicine.dosage,
                      selectedMedicine.dosageUnit,
                    )}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { fontSize: 14 * fontScale }]}>{t("scheduleLabel")}</Text>
                  <Text style={styles.detailValue}>
                    Every {selectedMedicine.interval} hours
                  </Text>
                </View>

                <View
                  style={[
                    styles.detailRow,
                    {
                      marginTop: 10,
                      backgroundColor: "#EFF6FF",
                      padding: 10,
                      borderRadius: 8,
                    },
                  ]}
                >
                  <Text style={[styles.detailLabel, { fontSize: 14 * fontScale, color: "#2563EB" }]}>
                    Next Dose:
                  </Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { fontWeight: "bold", color: "#1E40AF" },
                    ]}
                  >
                    {getNextDoseTime(selectedMedicine)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { marginTop: 24, backgroundColor: "#10B981" },
                  ]}
                  onPress={takeMedicineNow}
                >
                  <Text style={[styles.saveButtonText, { fontSize: 16 * fontScale }]}>{t("markTakenNow")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setDetailsModalVisible(false)}
                >
                  <Text style={[styles.cancelButtonText, { fontSize: 16 * fontScale }]}>{t("close")}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <View style={styles.floatingButton}>
        <TouchableOpacity
          style={styles.cameraButton}
          activeOpacity={0.8}
          onPress={() => router.push("/screen/camera")}
        >
          <AntDesign name="camera" size={28} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: "absolute",
    bottom: 100,
    right: 20,
  },
  cameraButton: {
    backgroundColor: "#2356E1",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F6F9",
  },
  scrollView: {
    flex: 1,
    marginBottom: 100,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  addButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  medicineCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  medicineContent: {
    flex: 1,
    flexDirection: "row",
  },
  medicineLeft: {
    flex: 1,
  },
  medicineName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  medicineDetails: {
    fontSize: 14,
    color: "#4B5563",
    marginBottom: 4,
  },
  nextDoseText: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "600",
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#6B7280",
    marginTop: 16,
  },
  emptyStateSubText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
  },
  modalBackground: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)", // Darker overlay for better focus
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "90%", // Limit height on smaller screens
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#1F2937",
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: "#F9FAFB", // Light gray background for inputs
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    marginBottom: 16,
    overflow: "hidden",
    backgroundColor: "#F9FAFB",
  },
  picker: {
    height: 50,
  },
  saveButton: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 12,
    alignItems: "center",
    padding: 12,
  },
  cancelButtonText: {
    color: "#EF4444",
    fontWeight: "bold",
    fontSize: 16,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 2,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 18,
    color: "#1F2937",
    fontWeight: "500",
  },
});
