import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Animated, Dimensions, Image, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

  const background = require("../../assets/images/Monochrome.jpg");

export default function account() {
  const params = useLocalSearchParams();

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
  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground
        source={background}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* SCID SECTION */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile Page</Text>

            <TouchableOpacity onPress={toggleNotification}>
                <Ionicons
                  name={showNotif ? "close" : "notifications"}
                  size={26}
                  color="#2356E1"
                />
            </TouchableOpacity>
          </View>
          
          <View style={styles.detailsContainer}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{params.firstName} {params.midName} {params.lastName || "N/A"}</Text>

            <Text style={styles.label}>Senior Citizen ID:</Text>
            <Text style={styles.value}>{params.idNumber || "N/A"}</Text>

            <Text style={styles.label}>Address:</Text>
            <Text style={styles.value}>{params.address || "N/A"}</Text>

            <Text style={styles.label}>Contact Number:</Text>
            <Text style={styles.value}>{params.conNumber || "N/A"}</Text>

            <Text style={styles.label}>Date of Birth:</Text>
            <Text style={styles.value}>{params.dob || "N/A"}</Text>

            <Text style={styles.label}>Gender:</Text>
            <Text style={styles.value}>{params.gender || "N/A"}</Text>

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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F6F9",
  },

  backgroundImage: { flex: 1 },

  scrollView: {
    flex: 1,
  },

  contentContainer: {
    padding: 0,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 20,
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

  detailsContainer: {
    flex: 1,
    marginRight: 20,
    padding: 20,
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
    backgroundColor: "white",
    borderRadius: 30,
    marginTop: 20,
    padding: 12,
    elevation: 3,
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
