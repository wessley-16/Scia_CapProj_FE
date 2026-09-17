import { useState } from "react";
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "@/context/SettingsContext";

type AppointmentStatus = "scheduled" | "done" | "cancelled";

type AppointmentType = {
  date: string;
  hospital: string;
  time: string;
  type: string;
  status: AppointmentStatus;
};

export default function Appointment() {
  const { fontScale, t } = useSettings();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [hospital, setHospital] = useState<string>("");
  const [hour, setHour] = useState<string>("");
  const [minute, setMinute] = useState<string>("");
  const [amPm, setAmPm] = useState<"AM" | "PM">("AM");
  const [type, setType] = useState<string>("");
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const addAppointment = () => {
    if (!selectedDate || !hospital.trim() || !hour.trim() || !minute.trim() || !type.trim()) {
      setErrorMessage("Please fill all details: hospital, time, type, and date.");
      return;
    }

    const hourValue = parseInt(hour, 10);
    const minuteValue = parseInt(minute, 10);

    if (isNaN(hourValue) || isNaN(minuteValue) || hourValue < 1 || hourValue > 12 || minuteValue < 0 || minuteValue > 59) {
      setErrorMessage("Time must be valid numbers (hour 1-12, minute 0-59).");
      return;
    }

    const formattedTime = `${hourValue.toString().padStart(2, "0")}:${minuteValue
      .toString()
      .padStart(2, "0")} ${amPm}`;

    const newAppointment: AppointmentType = {
      date: selectedDate,
      hospital: hospital.trim(),
      time: formattedTime,
      type: type.trim(),
      status: "scheduled",
    };

    setAppointments([...appointments, newAppointment]);
    setHospital("");
    setHour("");
    setMinute("");
    setAmPm("AM");
    setType("");
    setErrorMessage("");
    setModalVisible(false);
  };

  const getMarkedDates = () => {
    const marked: { [date: string]: any } = {};

    appointments.forEach((appointment) => {
      marked[appointment.date] = {
        ...marked[appointment.date],
        marked: true,
        dotColor: "#2563EB",
      };
    });

    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: "#2563EB",
        selectedTextColor: "white",
      };
    }

    return marked;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.headerTitle, { fontSize: 26 * fontScale }]}>{t("scheduleAppointment")}</Text>

        <View style={styles.calendarWrapper}>
          <Calendar
            minDate={new Date().toISOString().split("T")[0]}
            onDayPress={(day: any) => {
              setSelectedDate(day.dateString);
              setErrorMessage("");
            }}
            markedDates={getMarkedDates()}
          />
        </View>

        {selectedDate ? (
          <View style={styles.selectedDateContainer}>
            <Text style={[styles.selectedDateLabel, { fontSize: 20 * fontScale }]}>{t("selectedDate")}</Text>
            <Text style={[styles.selectedDateText, { fontSize: 20 * fontScale }]}>{selectedDate}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setModalVisible(true);
            setErrorMessage("");
          }}
        >
          <Text style={[styles.addButtonText, { fontSize: 20 * fontScale }]}>{t("bookAppointment")}</Text>
        </TouchableOpacity>

        {appointments.map((item, index) => (
          <View
            key={`${item.date}-${index}-${item.status}`}
            style={[
              styles.appointmentCard,
              item.status === "done" && styles.appointmentDone,
              item.status === "cancelled" && styles.appointmentCancelled,
            ]}
          >
            <View style={styles.appointmentHeader}>
              <Text style={[styles.appointmentText, item.status === "done" && styles.appointmentTextDone, { fontSize: 20 * fontScale }]}>
                {item.type}
              </Text>
              {item.status === "done" ? <Text style={[styles.doneIcon, { fontSize: 22 * fontScale }]}>✓</Text> : null}
            </View>

            <Text style={styles.appointmentSub}>
              {item.hospital} • {item.time}
            </Text>
            <Text style={styles.appointmentDate}>{item.date}</Text>

            <View style={styles.appointmentButtons}>
              <TouchableOpacity
                style={[styles.smallButton, styles.doneButton]}
                onPress={() => {
                  const updated = [...appointments];
                  updated[index] = { ...updated[index], status: "done" };
                  setAppointments(updated);
                }}
              >
                <Text style={styles.smallButtonText}>{t("done")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.smallButton, styles.cancelApptButton]}
                onPress={() => {
                  const updated = [...appointments];
                  updated[index] = { ...updated[index], status: "cancelled" };
                  setAppointments(updated);
                }}
              >
                <Text style={styles.smallButtonText}>{t("cancel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalBackground}>
            <View style={styles.modalContainer}>
              <Text style={[styles.modalTitle, { fontSize: 20 * fontScale }]}>{t("newAppointment")}</Text>

              <TextInput
                placeholder={t("hospitalClinic")}
                placeholderTextColor="#6B7280"
                value={hospital}
                onChangeText={setHospital}
                style={styles.input}
              />

              <View style={styles.timeRow}>
                <TextInput
                  placeholder={t("hhPlaceholder")}
                  placeholderTextColor="#6B7280"
                  value={hour}
                  onChangeText={(text) => setHour(text.replace(/[^0-9]/g, ""))}
                  style={[styles.input, styles.timeInput]}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={[styles.timeSeparator, { fontSize: 20 * fontScale }]}>:</Text>
                <TextInput
                  placeholder={t("mmPlaceholder")}
                  placeholderTextColor="#6B7280"
                  value={minute}
                  onChangeText={(text) => setMinute(text.replace(/[^0-9]/g, ""))}
                  style={[styles.input, styles.timeInput]}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <View style={styles.amPmWrapper}>
                  <TouchableOpacity
                    style={[styles.amPmButton, amPm === "AM" && styles.amPmButtonActive]}
                    onPress={() => setAmPm("AM")}
                  >
                    <Text style={[styles.amPmText, amPm === "AM" && styles.amPmTextActive]}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.amPmButton, amPm === "PM" && styles.amPmButtonActive]}
                    onPress={() => setAmPm("PM")}
                  >
                    <Text style={[styles.amPmText, amPm === "PM" && styles.amPmTextActive]}>PM</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                placeholder={t("typePlaceholder")}
                placeholderTextColor="#6B7280"
                value={type}
                onChangeText={setType}
                style={styles.input}
              />

              {errorMessage ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={styles.saveButton} onPress={addAppointment}>
                <Text style={styles.saveButtonText}>{t("saveAppointment")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F6F9",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 20,
  },
  calendarWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "white",
    elevation: 3,
    paddingBottom: 10,
  },
  selectedDateContainer: {
    marginTop: 24,
    backgroundColor: "#EFF6FF",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  selectedDateLabel: {
    fontSize: 18,
    color: "#374151",
  },
  selectedDateText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  addButton: {
    marginTop: 20,
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  addButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  appointmentCard: {
    marginTop: 15,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  appointmentText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  appointmentSub: {
    marginTop: 4,
    color: "#374151",
    fontSize: 15,
  },
  appointmentDate: {
    marginTop: 6,
    color: "#2563EB",
    fontWeight: "bold",
    fontSize: 15,
  },
  appointmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  doneIcon: {
    fontSize: 22,
    color: "#10B981",
    fontWeight: "bold",
  },
  appointmentDone: {
    borderColor: "#10B981",
    borderWidth: 1,
    backgroundColor: "#ECFDF5",
  },
  appointmentCancelled: {
    borderColor: "#F87171",
    borderWidth: 1,
    backgroundColor: "#FEF2F2",
  },
  appointmentTextDone: {
    textDecorationLine: "line-through",
    color: "#6B7280",
  },
  appointmentButtons: {
    flexDirection: "row",
    marginTop: 10,
    justifyContent: "flex-end",
    gap: 10,
  },
  smallButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 40,
    justifyContent: "center",
  },
  doneButton: {
    backgroundColor: "#10B981",
  },
  cancelApptButton: {
    backgroundColor: "#EF4444",
  },
  smallButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 15,
  },
  modalBackground: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    minHeight: 50,
  },
  saveButton: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  saveButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 17,
  },
  cancelButton: {
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: "#EF4444",
    fontWeight: "bold",
    fontSize: 16,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 180,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  timeInput: {
    flex: 1,
    textAlign: "center",
  },
  timeSeparator: {
    marginHorizontal: 8,
    fontSize: 18,
    fontWeight: "bold",
  },
  amPmWrapper: {
    flexDirection: "row",
    marginLeft: 10,
  },
  amPmButton: {
    borderWidth: 1.5,
    borderColor: "#9CA3AF",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginLeft: 4,
    backgroundColor: "#F9FAFB",
    minHeight: 44,
    justifyContent: "center",
  },
  amPmButtonActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  amPmText: {
    color: "#374151",
    fontWeight: "bold",
    fontSize: 15,
  },
  amPmTextActive: {
    color: "white",
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  errorText: {
    color: "#B91C1C",
    fontWeight: "bold",
    fontSize: 15,
  },
});
