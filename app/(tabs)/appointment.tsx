import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";

type AppointmentType = {
  date: string;
  hospital: string;
  time: string;
  type: string;
};

export default function Appointment() {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [hospital, setHospital] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);

  const addAppointment = () => {
    const newAppointment: AppointmentType = {
      date: selectedDate,
      hospital,
      time,
      type,
    };

    setAppointments([...appointments, newAppointment]);
    setHospital("");
    setTime("");
    setType("");
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.headerTitle}>Schedule Appointment</Text>

        <View style={styles.calendarWrapper}>
          <Calendar
            minDate={new Date().toISOString().split("T")[0]}
            onDayPress={(day: any) => {
              setSelectedDate(day.dateString);
            }}
            markedDates={{
              [selectedDate]: {
                selected: true,
                selectedColor: "#2563EB",
                selectedTextColor: "white",
              },
            }}
          />
        </View>

        {selectedDate ? (
          <View style={styles.selectedDateContainer}>
            <Text style={styles.selectedDateLabel}>Selected Date:</Text>
            <Text style={styles.selectedDateText}>{selectedDate}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>Book Appointment</Text>
        </TouchableOpacity>

        {appointments.map((item, index) => (
          <View key={index} style={styles.appointmentCard}>
            <Text style={styles.appointmentText}>{item.type}</Text>
            <Text style={styles.appointmentSub}>
              {item.hospital} • {item.time}
            </Text>
            <Text style={styles.appointmentDate}>{item.date}</Text>
          </View>
        ))}

        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalBackground}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>New Appointment</Text>

              <TextInput
                placeholder="Hospital / Clinic"
                value={hospital}
                onChangeText={setHospital}
                style={styles.input}
              />

              <TextInput
                placeholder="Time (e.g. 2:30 PM)"
                value={time}
                onChangeText={setTime}
                style={styles.input}
              />

              <TextInput
                placeholder="Type (Check-up, Consultation, Lab Test)"
                value={type}
                onChangeText={setType}
                style={styles.input}
              />

              <TouchableOpacity style={styles.saveButton} onPress={addAppointment}>
                <Text style={styles.saveButtonText}>Save Appointment</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
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
    fontSize: 24,
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
    fontSize: 16,
    color: "#4B5563",
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  addButton: {
    marginTop: 20,
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  addButtonText: {
    color: "white",
    fontSize: 16,
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
    fontSize: 16,
    fontWeight: "bold",
  },
  appointmentSub: {
    marginTop: 4,
    color: "#6B7280",
  },
  appointmentDate: {
    marginTop: 6,
    color: "#2563EB",
    fontWeight: "bold",
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
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  cancelButton: {
    marginTop: 10,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#EF4444",
    fontWeight: "bold",
  },
});