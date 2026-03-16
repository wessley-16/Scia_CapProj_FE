import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { Medicine } from "../../interfaces/interfaces";

export default function medicine() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [medicineName, setMedicineName] = useState("");
  const [dosage, setDosage] = useState("");
  const [dosageUnit, setDosageUnit] = useState<"ml" | "mg" | "capsule">("mg");
  const [interval, setInterval] = useState("8");

  useEffect(() => {
    loadMedicines();
  }, []);

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

  const addMedicine = () => {
    if (!medicineName || !dosage || !interval) {
      alert("Please fill in all fields");
      return;
    }

    const newMedicine: Medicine = {
      id: Date.now().toString(),
      name: medicineName,
      dosage,
      dosageUnit,
      interval: parseInt(interval),
      lastTakenTime: Date.now(),
      createdAt: Date.now(),
    };

    const updatedMedicines = [...medicines, newMedicine];
    saveMedicines(updatedMedicines);

    setMedicineName("");
    setDosage("");
    setDosageUnit("mg");
    setInterval("8");
    setModalVisible(false);
  };

  const deleteMedicine = (id: string) => {
    const updatedMedicines = medicines.filter((med) => med.id !== id);
    saveMedicines(updatedMedicines);
  };

  const formatDosage = (dosage: string, unit: string) => {
    const unitSymbol = unit === "capsule" ? (dosage === "1" ? "capsule" : "capsules") : unit;
    return `${dosage} ${unitSymbol}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Medicine Pill Box</Text>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <MaterialCommunityIcons name="plus" size={28} color="white" />
          <Text style={styles.addButtonText}>Add Medicine</Text>
        </TouchableOpacity>

        {medicines.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="pill"
              size={60}
              color="#D1D5DB"
            />
            <Text style={styles.emptyStateText}>No medicines added yet</Text>
            <Text style={styles.emptyStateSubText}>Add your first medicine to get started</Text>
          </View>
        ) : (
          medicines.map((medicine) => (
            <View key={medicine.id} style={styles.medicineCard}>
              <View style={styles.medicineContent}>
                <View style={styles.medicineLeft}>
                  <Text style={styles.medicineName}>{medicine.name}</Text>
                  <Text style={styles.medicineDetails}>
                    {formatDosage(medicine.dosage, medicine.dosageUnit)} • Every {medicine.interval}h
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteMedicine(medicine.id)}
              >
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={24}
                  color="#EF4444"
                />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Add Medicine</Text>

            <Text style={styles.label}>Medicine Name</Text>
            <TextInput
              placeholder="e.g., Blood Pressure Medicine"
              value={medicineName}
              onChangeText={setMedicineName}
              style={styles.input}
            />

            <Text style={styles.label}>Dosage</Text>
            <TextInput
              placeholder="e.g., 1, 500"
              value={dosage}
              onChangeText={setDosage}
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <Text style={styles.label}>Unit</Text>
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

            <Text style={styles.label}>Time Interval (hours between doses)</Text>
            <TextInput
              placeholder="e.g., 8"
              value={interval}
              onChangeText={setInterval}
              keyboardType="number-pad"
              style={styles.input}
            />

            <TouchableOpacity style={styles.saveButton} onPress={addMedicine}>
              <Text style={styles.saveButtonText}>Add Medicine</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  },
  medicineContent: {
    flex: 1,
    flexDirection: "row",
  },
  medicineLeft: {
    flex: 1,
  },
  medicineName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 6,
  },
  medicineDetails: {
    fontSize: 16,
    color: "black",
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
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#1F2937",
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
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    marginBottom: 16,
    overflow: "hidden",
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
})