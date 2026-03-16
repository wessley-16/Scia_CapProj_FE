import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";

import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Home() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER SECTION */}
        <TouchableOpacity style={styles.header} onPress={() => router.push("/account")}>
          <Image
            source={{ uri: "https://randomuser.me/api/portraits/women/68.jpg" }} // Placeholder avatar
            style={styles.avatar}
          />
          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>Magandang Araw,</Text>
            <Text style={styles.userName}>Maria S. Santos</Text>
            <View style={styles.idBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#FBBF24" />
              <Text style={styles.idText}>Senior Citizen ID: SC-458210</Text>
            </View>
          </View>
          <View style={styles.bellButton}>
            <Ionicons name="notifications" size={28} color="#2356E1" />
            <View style={styles.notificationDot} />
          </View>
        </TouchableOpacity>

        {/* REMINDER CARD */}
        <View style={styles.reminderCard}>
          <View style={styles.reminderContent}>
            <Text style={styles.cardSubtitle}>Reminder:</Text>
            <Text style={styles.reminderTitle}>
              Take Blood Pressure Medicine
            </Text>
            <Text style={styles.reminderTime}>8:00 PM</Text>
          </View>
          {/* Approximate illustration placeholder using icons */}
          <View style={styles.reminderIllustration}>
            <MaterialCommunityIcons
              name="card-bulleted"
              size={50}
              color="#2356E1"
            />
            <MaterialCommunityIcons
              name="pill"
              size={24}
              color="#2356E1"
              style={{ position: "absolute", bottom: -5, left: -5 }}
            />
          </View>
        </View>

        {/* BARANGAY ANNOUNCEMENT */}
        <View style={styles.announcementCard}>
          <View style={styles.announcementHeader}>
            <MaterialCommunityIcons
              name="bullhorn-variant"
              size={28}
              color="#2563EB"
            />
            <View style={styles.announcementTextWrapper}>
              <Text style={styles.cardSubtitle}>Barangay Announcement</Text>
              <Text style={styles.cardTitle}>Free Medical Checkup</Text>
              <Text style={styles.cardDesc}>July 10, 2026</Text>
              <Text style={styles.cardDesc}>Barangay Health Center</Text>
            </View>
            <View style={styles.timeBadgeWrapper}>
              <View style={styles.timeBadge}>
                <Ionicons name="time-outline" size={14} color="#D97706" />
                <Text style={styles.timeBadgeText}>8:00 PM</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ASK ASSISTANT CARD */}
        <View style={styles.assistantCard}>
          <MaterialCommunityIcons
            name="robot-outline"
            size={40}
            color="#2563EB"
          />
          <View style={styles.assistantTextWrapper}>
            <Text style={styles.assistantTitle}>Ask Assistant</Text>
            <Text style={styles.assistantSubtitle}>
              How can I help you today?
            </Text>
          </View>
          <View style={styles.assistantActions}>
            <TouchableOpacity style={styles.micButton}>
              <Ionicons name="mic" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.chatButton}>
              <Ionicons name="chatbubble-ellipses" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* SOS EMERGENCY BUTTON */}
        <TouchableOpacity 
          style={styles.sosCard} 
          activeOpacity={0.8}
          onPress={() => router.push("/emergency")}
        >
          <View style={styles.sosIconWrapper}>
            <MaterialCommunityIcons
              name="alarm-light"
              size={32}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.sosTextWrapper}>
            <Text style={styles.sosTitle}>SOS EMERGENCY</Text>
            <Text style={styles.sosSubtitle}>Tap in case of emergency</Text>
          </View>

          <View style={styles.sosChevron}>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* APPOINTMENT CARD */}
        <TouchableOpacity
          style={styles.appCard}
          activeOpacity={0.8}
          onPress={() => router.push("/appointment")}
        >
          <View style={styles.appIconWrapper}>
            <MaterialCommunityIcons
              name="calendar-check"
              size={22}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.appTextWrapper}>
            <Text style={styles.appTitle}>SET APPOINTMENT</Text>
            <Text style={styles.appSubtitle}>
              Tap to schedule an appointment
            </Text>
          </View>

          <View style={styles.appChevron}>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* MEDICINES */}
        <TouchableOpacity 
          style={styles.medCard} 
          activeOpacity={0.8}
          onPress={() => router.push("/medicine")}
        >
          <View style={styles.medIconWrapper}>
            <MaterialCommunityIcons
                name="pill"
                size={22}
                color="#FFFFFF"
              />
          </View>

          <View style={styles.medTextWrapper}>
            <Text style={styles.medTitle}>MEDICINES</Text>
            <Text style={styles.medSubtitle}>Tap to manage medications</Text>
          </View>

          <View style={styles.medChevron}>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* GOVERNMENT DOCUMENTS */}
        <TouchableOpacity 
        style={styles.gdocCard} 
        activeOpacity={0.8}
        onPress={() => router.push("/govdocs")}
        >
          <View style={styles.gdocIconWrapper}>
            <MaterialCommunityIcons
                name="file-document"
                size={22}
                color="#FFFFFF"
              />
          </View>

          <View style={styles.gdocTextWrapper}>
            <Text style={styles.gdocTitle}>GOVERNMENT DOCUMENTS</Text>
            <Text style={styles.gdocSubtitle}>Tap to register documents</Text>
          </View>

          <View style={styles.gdocChevron}>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>


        {/* Bottom padding to account for the custom bottom tab bar from previous setup */}
        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F6F9", // Light app background
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  // HEADER
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#D1D5DB",
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  greeting: {
    fontSize: 14,
    color: "#4B5563",
    fontFamily: "Inter-Medium", // Assuming you are using Inter
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    fontFamily: "Inter-Bold",
  },
  idBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  idText: {
    fontSize: 12,
    color: "#4B5563",
    marginLeft: 4,
    fontWeight: "500",
  },
  bellButton: {
    position: "relative",
    padding: 4,
  },
  notificationDot: {
    position: "absolute",
    top: 4,
    right: 6,
    width: 10,
    height: 10,
    backgroundColor: "#CE2029",
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#F4F6F9",
  },
  // REMINDER CARD
  reminderCard: {
    flexDirection: "row",
    backgroundColor: "#F4D35E",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000000",
    marginVertical: 4,
  },
  reminderTime: {
    fontSize: 16,
    color: "#000000",
  },
  reminderIllustration: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  // ANNOUNCEMENT CARD
  announcementCard: {
    backgroundColor: "#F4D35E",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  announcementHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  announcementTextWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "black",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "black",
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 13,
    color: "black",
    marginBottom: 2,
  },
  timeBadgeWrapper: {
    alignItems: "flex-end",
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeBadgeText: {
    fontSize: 15,
    color: "black",
    marginLeft: 4,
    fontWeight: "500",
  },
  // ASSISTANT
  assistantCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  assistantTextWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  assistantTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
  },
  assistantSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  assistantActions: {
    flexDirection: "row",
    gap: 8,
  },
  micButton: {
    backgroundColor: "#2356E1",
    padding: 10,
    borderRadius: 12,
  },
  chatButton: {
    backgroundColor: "#FEA23A",
    padding: 10,
    borderRadius: 12,
  },
  // SOS
  sosCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#CE2029",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#CE2029",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  sosIconWrapper: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 8,
    borderRadius: 12,
  },
  sosTextWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  sosTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  sosSubtitle: {
    color: "white",
    fontSize: 15,
  },
  sosChevron: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 4,
    borderRadius: 20,
  },
  // APPOINTMENT
  appCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6488EA",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#6488EA",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  appIconWrapper: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 8,
    borderRadius: 12,
  },
  appTextWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  appTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  appSubtitle: {
    color: "white",
    fontSize: 15,
  },
  appChevron: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 4,
    borderRadius: 20,
  },
  // MEDICINES
  medCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6488EA",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#6488EA",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  medIconWrapper: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 8,
    borderRadius: 12,
  },
  medTextWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  medTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  medSubtitle: {
    color: "white",
    fontSize: 15,
  },
  medChevron: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 4,
    borderRadius: 20,
  },
  // GOVERNMENT DOCUMENTS
  gdocCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6488EA",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#6488EA",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  gdocIconWrapper: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 8,
    borderRadius: 12,
  },
  gdocTextWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  gdocTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  gdocSubtitle: {
    color: "white",
    fontSize: 15,
  },
  gdocChevron: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 4,
    borderRadius: 20,
  },
});
