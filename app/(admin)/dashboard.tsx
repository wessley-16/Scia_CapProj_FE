import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useCallback, useState } from "react";

import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Medicine } from "../../interfaces/interfaces";

export default function Home() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tabBarHeight = useBottomTabBarHeight();

  const [nextMedicine, setNextMedicine] = useState<Medicine | null>(null);

  /* ---------------- NAVIGATION ---------------- */
  const goToChat = () => router.push("/(tabs)/chatbot");
  const goToVoice = () => router.push("/(tabs)/voice");
  const goToMedicine = () => router.push("/(tabs)/medicine");
  const goToAppointment = () => router.push("/(tabs)/appointment");
  const goToEmergency = () => router.push("/(tabs)/emergency");
  const goToDocs = () => router.push("/(tabs)/govdocs");

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

  useFocusEffect(
    useCallback(() => {
      loadNextMedicine();
    }, [loadNextMedicine])
  );

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

  const avatarSource =
    typeof params.image === "string"
      ? { uri: params.image }
      : { uri: "https://via.placeholder.com/150" };

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: tabBarHeight + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Image source={avatarSource} style={styles.avatar} />

          <View style={styles.headerText}>
            <Text style={styles.greeting}>Magandang Araw,</Text>
            <Text style={styles.name}>
              {params.name ?? "Juan Dela Cruz"}
            </Text>

            <View style={styles.idRow}>
              <Ionicons
                name="shield-checkmark"
                size={14}
                color="#FBBF24"
              />
              <Text style={styles.idText}>
                {params.idNumber ?? "No ID"}
              </Text>
            </View>
          </View>

          <Ionicons name="notifications" size={26} color="#2356E1" />
        </View>

        {/* REMINDER */}
        <View style={styles.reminder}>
          <View style={{ flex: 1 }}>
            <Text style={styles.reminderLabel}>Reminder</Text>

            {nextMedicine ? (
              <>
                <Text style={styles.reminderTitle}>
                  Take {nextMedicine.name}
                </Text>
                <Text style={styles.reminderSub}>
                  {nextMedicine.dosage} {nextMedicine.dosageUnit}
                </Text>
                <Text style={styles.reminderTime}>
                  {getNextDoseTime(nextMedicine)}
                </Text>
              </>
            ) : (
              <Text style={styles.reminderTitle}>
                No medicine reminders today
              </Text>
            )}
          </View>

          <MaterialCommunityIcons
            name={nextMedicine ? "pill" : "heart-outline"}
            size={50}
            color="#2356E1"
          />
        </View>

        {/* CHAT ASSISTANT */}
        <TouchableOpacity style={styles.assistant} onPress={goToChat}>
          <MaterialCommunityIcons
            name="robot-outline"
            size={36}
            color="#2563EB"
          />

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.assistantTitle}>Ask Assistant</Text>
            <Text style={styles.assistantSub}>
              How can I help you today?
            </Text>
          </View>

          <Ionicons
            name="chatbubble-ellipses"
            size={22}
            color="#2356E1"
          />
        </TouchableOpacity>

        {/* VOICE ASSISTANT */}
        <TouchableOpacity style={styles.assistant} onPress={goToVoice}>
          <MaterialCommunityIcons
            name="microphone-outline"
            size={36}
            color="#2563EB"
          />

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.assistantTitle}>Voice Assistant</Text>
            <Text style={styles.assistantSub}>
              Speak and get help instantly
            </Text>
          </View>

          <Ionicons name="volume-high" size={22} color="#2356E1" />
        </TouchableOpacity>

        {/* BUTTONS */}
        <ActionButton
          title="SOS EMERGENCY"
          subtitle="Tap for help"
          icon="alarm-light"
          color="#CE2029"
          onPress={goToEmergency}
        />

        <ActionButton
          title="SET APPOINTMENT"
          subtitle="Book your visit"
          icon="calendar-check"
          color="#2356E1"
          onPress={goToAppointment}
        />

        <ActionButton
          title="MEDICINES"
          subtitle="Manage meds"
          icon="pill"
          color="#2356E1"
          onPress={goToMedicine}
        />

        <ActionButton
          title="DOCUMENTS"
          subtitle="View records"
          icon="file-document"
          color="#2356E1"
          onPress={goToDocs}
        />
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
}: any) {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <MaterialCommunityIcons name={icon} size={28} color="#fff" />

      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={styles.buttonTitle}>{title}</Text>
        <Text style={styles.buttonSub}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={22} color="#fff" />
    </TouchableOpacity>
  );
}

/* STYLES */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F6F9" },

  container: { padding: 20 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },

  headerText: {
    flex: 1,
    marginLeft: 12,
  },

  greeting: { fontSize: 16, color: "#6B7280" },

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

  reminder: {
    flexDirection: "row",
    backgroundColor: "#FACC15",
    padding: 18,
    borderRadius: 18,
    marginBottom: 20,
    alignItems: "center",
  },

  reminderLabel: { fontSize: 14 },

  reminderTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },

  reminderSub: { fontSize: 14 },

  reminderTime: {
    fontSize: 20,
    fontWeight: "bold",
  },

  assistant: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 18,
    marginBottom: 20,
    elevation: 3,
  },

  assistantTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },

  assistantSub: {
    fontSize: 14,
    color: "#6B7280",
  },

  button: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 18,
    marginBottom: 14,
    elevation: 4,
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
    backgroundColor: "#2356E1",
    padding: 16,
    borderRadius: 30,
  },
});