import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useCallback, useState } from "react";

import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Medicine } from "../../interfaces/interfaces";

const background = require("../../assets/images/Foreground.png");

export default function Home() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tabBarHeight = useBottomTabBarHeight();

  const loadProfileImage = async () => {
  const img = await AsyncStorage.getItem("profileImage");

    if (img) {
      setAvatarSource({ uri: img });
    }
  };

  const [nextMedicine, setNextMedicine] = useState<Medicine | null>(null);
  const [avatarSource, setAvatarSource] = useState<any>(
    require("../../assets/images/default-profile.png")
  );

  /* ---------------- NAVIGATION ---------------- */
  const goToChat = () => router.push("/(tabs)/chatbot");
  const goToVoice = () => router.push("/(tabs)/voice");
  const goToMedicine = () => router.push("/(tabs)/medicine");
  const goToAppointment = () => router.push("/(tabs)/appointment");
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
      loadProfileImage();
    }, [loadProfileImage, loadNextMedicine])
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
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Image source={avatarSource} style={styles.avatar} onError={() => setAvatarSource(require("../../assets/images/default-profile.png"))} />

          <View style={styles.headerText}>
            <Text style={styles.greeting}>Magandang Araw Po,</Text>
            <Text style={styles.name}>
              {params.name ?? "Sa inyo"}
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
            <Text style={styles.programTitle}>LGU Program Updates</Text>

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
              <Text style={styles.programLabel}>What : </Text>
              <Text style={styles.programLabel}>When : </Text>
              <Text style={styles.programLabel}>Where : </Text>

              <View style={styles.joinFunction}>
                <TouchableOpacity style={styles.joinButton}>
                  <Text style={{ fontSize: 18, color: "white" }}>Join</Text>
                </TouchableOpacity>
              </View>
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
              <Text style={styles.assistantTitle}>Chat Assistant</Text>
              <Text style={styles.assistantSub}>
                How can I help you today?
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
              <Text style={styles.assistantTitle}>Voice Assistant</Text>
              <Text style={styles.assistantSub}>
                Speak and get help instantly
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* BUTTONS */}
        <View style= {styles.moduleContainer}>
          
          {/* REMINDER */}
          <View style={styles.reminder}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reminderLabel}>Reminder</Text>

              {nextMedicine ? (
                <>
                  <Text style={styles.reminderTitle}>
                    Take : {nextMedicine.dosage} {nextMedicine.dosageUnit} {nextMedicine.name}
                  </Text>
                  <Text style={styles.reminderTime}>
                    Time : {getNextDoseTime(nextMedicine)}
                  </Text>
                  <Text style={styles.reminderTime}>
                    Note : {nextMedicine.description ? `${nextMedicine.description}` : "---"}
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

          <ActionButton
            title="SOS EMERGENCY"
            subtitle="Call for help"
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
            title="MEDICINE PILL BOX"
            subtitle="Manage medications"
            icon="pill"
            color="#2356E1"
            onPress={goToMedicine}
          />

          <ActionButton
            title="GOVERNMENT WEBSITES"
            subtitle="Visit official sites"
            icon="file-document"
            color="#2356E1"
            onPress={goToDocs}
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

            <Text style={{ fontSize: 20, fontWeight: "bold" }}>
              Notifications
            </Text>
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