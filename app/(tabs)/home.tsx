import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";

import { SafeAreaView } from "react-native-safe-area-context";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Home() {
  // Data for the grid menu to keep the JSX clean
  const menuItems = [
    {
      id: 1,
      name: "Health Services",
      icon: "stethoscope",
      type: "mci",
      bgColor: "#E0E7FF",
      iconColor: "#3B82F6",
    },
    {
      id: 2,
      name: "Medicine\nAllocation",
      icon: "pill",
      type: "mci",
      bgColor: "#D1FAE5",
      iconColor: "#10B981",
    },
    {
      id: 3,
      name: "Senior Digital ID",
      icon: "card-account-details-outline",
      type: "mci",
      bgColor: "#DBEAFE",
      iconColor: "#2563EB",
    },
    {
      id: 4,
      name: "Discount Booklet",
      icon: "ticket-percent-outline",
      type: "mci",
      bgColor: "#FFE4E6",
      iconColor: "#E11D48",
    },
    {
      id: 5,
      name: "ID Registration",
      icon: "calendar-account-outline",
      type: "mci",
      bgColor: "#FEF3C7",
      iconColor: "#D97706",
      isNew: true,
    },
    {
      id: 6,
      name: "Other\nGovernment IDs",
      icon: "smart-card-outline",
      type: "mci",
      bgColor: "#E0F2FE",
      iconColor: "#0284C7",
    },
    {
      id: 7,
      name: "Emergency\nContacts",
      icon: "contacts",
      type: "mci",
      bgColor: "#F3E8FF",
      iconColor: "#9333EA",
    },
    {
      id: 8,
      name: "Accessibility\nSettings",
      icon: "cog-outline",
      type: "mci",
      bgColor: "#FFEDD5",
      iconColor: "#EA580C",
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER SECTION */}
        <View style={styles.header}>
          <Image
            source={{ uri: "https://randomuser.me/api/portraits/women/68.jpg" }} // Placeholder avatar
            style={styles.avatar}
          />
          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>Good Day,</Text>
            <Text style={styles.userName}>Maria Santos</Text>
            <View style={styles.idBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#FBBF24" />
              <Text style={styles.idText}>Senior Citizen ID: SC-458210</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.bellButton}>
            <Ionicons name="notifications" size={28} color="#2563EB" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        {/* SOS EMERGENCY BUTTON */}
        <TouchableOpacity style={styles.sosCard} activeOpacity={0.8}>
          <View style={styles.sosIconWrapper}>
            <MaterialCommunityIcons
              name="alarm-light"
              size={32}
              color="#E11D48"
            />
          </View>
          <View style={styles.sosTextWrapper}>
            <Text style={styles.sosTitle}>SOS EMERGENCY</Text>
            <Text style={styles.sosSubtitle}>Tap in case of emergency</Text>
          </View>
          <View style={styles.sosChevron}>
            <Ionicons name="chevron-forward" size={20} color="#E11D48" />
          </View>
        </TouchableOpacity>

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

        {/* GRID MENU */}
        <View style={styles.gridContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity key={item.id} style={styles.gridItem}>
              <View
                style={[
                  styles.gridIconContainer,
                  { backgroundColor: item.bgColor },
                ]}
              >
                {item.type === "mci" ? (
                  <MaterialCommunityIcons
                    name={item.icon as any}
                    size={28}
                    color={item.iconColor}
                  />
                ) : (
                  <Ionicons
                    name={item.icon as any}
                    size={28}
                    color={item.iconColor}
                  />
                )}
                {item.isNew && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>New</Text>
                  </View>
                )}
              </View>
              <Text style={styles.gridItemText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
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
              color="#60A5FA"
            />
            <MaterialCommunityIcons
              name="pill"
              size={24}
              color="#10B981"
              style={{ position: "absolute", bottom: -5, left: -5 }}
            />
          </View>
        </View>

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
    backgroundColor: "#EF4444",
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#F4F6F9",
  },
  // SOS
  sosCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF4444",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#EF4444",
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
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
  },
  sosChevron: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 4,
    borderRadius: 20,
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
    backgroundColor: "#3B82F6",
    padding: 10,
    borderRadius: 12,
  },
  chatButton: {
    backgroundColor: "#FBBF24",
    padding: 10,
    borderRadius: 12,
  },
  // GRID
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  gridItem: {
    width: "23%", // Fits 4 items per row comfortably
    alignItems: "center",
    marginBottom: 20,
  },
  gridIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    position: "relative",
  },
  newBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "white",
  },
  newBadgeText: {
    color: "white",
    fontSize: 9,
    fontWeight: "bold",
  },
  gridItemText: {
    fontSize: 11,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 14,
  },
  // ANNOUNCEMENT CARD
  announcementCard: {
    backgroundColor: "#FFF7ED", // Light orange tint
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
    color: "#4B5563",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 13,
    color: "#6B7280",
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
    fontSize: 12,
    color: "#D97706",
    marginLeft: 4,
    fontWeight: "500",
  },
  // REMINDER CARD
  reminderCard: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF", // Light blue tint
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
    color: "#1E3A8A",
    marginVertical: 4,
  },
  reminderTime: {
    fontSize: 13,
    color: "#6B7280",
  },
  reminderIllustration: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
});
