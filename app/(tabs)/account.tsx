import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function account() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* SCID SECTION */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Account Page</Text>

            <View style={styles.bellButton}>
              <Ionicons name="notifications" size={28} color="#2356E1" />
              <View style={styles.notificationDot} />
            </View>
          </View>

          <View style={styles.profileContainer}>
            <View style={styles.detailsContainer}>
              <Text style={styles.label}>Name:</Text>
              <Text style={styles.value}>Maria S. Santos</Text>

              <Text style={styles.label}>Senior Citizen ID:</Text>
              <Text style={styles.value}>SC-458210</Text>

              <Text style={styles.label}>Address:</Text>
              <Text style={styles.value}>123 Molave St., Malinta, Valenzuela City, Philippines</Text>

              <Text style={styles.label}>Date of Birth:</Text>
              <Text style={styles.value}>January 1, 1950</Text>

              <Text style={styles.label}>Sex:</Text>
              <Text style={styles.value}>Female</Text>

              <Text style={styles.label}>Date Issued:</Text>
              <Text style={styles.value}>January 1, 2020</Text>
            </View>
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: "https://randomuser.me/api/portraits/women/68.jpg" }}
                style={styles.profileImage}
              />
            </View>
          </View>

          {/* QR CODE SECTION */}
          <View style={styles.qrCodeSection}>
            <Text style={styles.qrCodeTitle}>Senior Citizen ID QR Code</Text>
            <Image
              source={{ uri: "https://via.placeholder.com/250x250?text=QR+Code+Placeholder" }}
              style={styles.qrCodeImage}
            />
          </View>
      </ScrollView>
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
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 20,
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
  profileContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderColor: "black",
    paddingBottom: 20,
  },
  detailsContainer: {
    flex: 1,
    marginRight: 20,
  },
  label: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginTop: 10,
  },
  value: {
    fontSize: 20,
    color: "#4B5563",
    marginBottom: 10,
  },
  imageContainer: {
    alignItems: "center",
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "black",
    backgroundColor: "#D1D5DB",
  },
  qrCodeSection: {
    alignItems: "center",
    marginTop: 30,
  },
  qrCodeTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 10,
  },
  qrCodeImage: {
    width: 300,
    height: 300,
    backgroundColor: "#D1D5DB",
    marginBottom: 100,
  },
});
