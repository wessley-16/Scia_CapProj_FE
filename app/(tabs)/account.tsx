import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from 'expo-file-system';
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Animated, Dimensions, Image, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "../../context/SettingsContext";

  const background = require("../../assets/images/Monochrome.jpg");

export default function account() {
  const { fontScale, t } = useSettings();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const params = useLocalSearchParams();
  const router = useRouter();

  const [events, setEvents] = useState<any[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  
  const [notifications, setNotifications] = useState<any[]>([]);

  const loadProfileImage = useCallback(async () => {
    const img = await AsyncStorage.getItem("profileImage");
    if (img) {
      setProfileImage(img);
    }
  }, []);

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
  
    /* ---------------- LOAD NOTIFICATION ---------------- */
    const loadNotifications = async () => {
      const stored = await AsyncStorage.getItem("notifications");
      setNotifications(stored ? JSON.parse(stored) : []);
    };

   /* ---------------- IMAGE PICKER ---------------- */
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      alert("Permission required to access gallery");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;

      // Check if documentDirectory is available
      if (!FileSystem.documentDirectory) {
        alert("Unable to access app directory");
        return;
      }

      // Copy the image to app's document directory for persistence
      const filename = uri.split('/').pop();
      const newUri = FileSystem.documentDirectory + filename;
      const sourceFile = new File(uri);
      const destinationFile = new File(newUri);
      await sourceFile.copy(destinationFile);

      setProfileImage(newUri);

      // Save to storage
      await AsyncStorage.setItem("profileImage", newUri);
    }
  };

  /* ---------------- IMAGE REMOVER ---------------- */
  const deleteProfileImage = async () => {
  if (!profileImage) return;
    Alert.alert(
      "Remove Profile Picture",
      "Are you sure you want to delete your profile picture?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // delete file from storage
              await FileSystem.deleteAsync(profileImage, { idempotent: true });

              // remove from AsyncStorage
              await AsyncStorage.removeItem("profileImage");

              // reset state
              setProfileImage(null);
            } catch (error) {
              console.log("Delete error:", error);
            }
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadProfileImage();
      loadNotifications();
    }, [loadProfileImage])
  );

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
            <Text style={[styles.headerTitle, { fontSize: 24 * fontScale }]}>{t("profilePage")}</Text>

            <View style={styles.headerIcons}>
              <TouchableOpacity onPress={() => router.push("/settings")} style={styles.iconButton}>
                <Ionicons name="settings" size={26} color="#2356E1" />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleNotification} style={styles.iconButton}>
                <Ionicons
                  name={showNotif ? "close" : "notifications"}
                  size={26}
                  color="#2356E1"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.topSection}>
            {/* DETAILS */}
            <View style={styles.detailsContainer}>
              <Text style={[styles.label, { fontSize: 20 * fontScale }]}>{t("nameLabel")}</Text>
              <Text style={styles.value}>{params.firstName} {params.midName} {params.lastName || "N/A"}</Text>

              <Text style={[styles.label, { fontSize: 20 * fontScale }]}>{t("seniorCitizenId")}</Text>
              <Text style={styles.value}>{params.idNumber || "N/A"}</Text>

              <Text style={[styles.label, { fontSize: 20 * fontScale }]}>{t("addressLabel")}</Text>
              <Text style={styles.value}>{params.address || "N/A"}</Text>

              <Text style={[styles.label, { fontSize: 20 * fontScale }]}>{t("contactNumber")}</Text>
              <Text style={styles.value}>{params.conNumber || "N/A"}</Text>

              <Text style={[styles.label, { fontSize: 20 * fontScale }]}>{t("dobLabel")}</Text>
              <Text style={styles.value}>{params.dob || "N/A"}</Text>

              <Text style={[styles.label, { fontSize: 20 * fontScale }]}>{t("genderLabel")}</Text>
              <Text style={styles.value}>{params.gender || "N/A"}</Text>
            </View>

            {/* PROFILE IMAGE */}
            <View style={styles.imageContainer}>
              <TouchableOpacity onPress={pickImage}>
                <Image
                  source={
                    profileImage
                      ? { uri: profileImage }
                      : require("../../assets/images/default-profile.png")
                  }
                  style={styles.profileImage}
                  onError={() => setProfileImage(null)}
                />
              </TouchableOpacity>

              <Text style={{ fontSize: 16 * fontScale, marginTop: 10, color: "#000" }}>
                {t("changePicture")}
              </Text>

              {/* ✅ DELETE BUTTON */}
              {profileImage && (
                <TouchableOpacity onPress={deleteProfileImage}>
                  <Text style={[styles.deleteText, { fontSize: 16 * fontScale }]}>{t("removePicture")}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* QR CODE SECTION */}
          <View style={styles.qrCodeSection}>
            <Text style={[styles.qrCodeTitle, { fontSize: 24 * fontScale }]}>{t("qrCodeTitle")}</Text>
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
      
             <View style={{ marginTop: 50 }}>
                <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>
                  {t("notifications")}
                </Text>
             
                {/* EVENTS NOTIFICATIONS */}
                <Text style={{ color: "#6B7280", marginBottom: 5 }}>
                   Your Joined Events
                </Text>
             
                {joinedEvents.length === 0 ? (
                  <Text>No joined events yet</Text>
                ) : (
                  joinedEvents.map((event) => (
                    <View
                      key={event.id}
                      style={{
                        backgroundColor: "#F3F4F6",
                        padding: 12,
                        borderRadius: 12,
                        marginBottom: 10,
                      }}
                    >
                      <Text style={{ fontWeight: "bold" }}>
                        📌 {event.title}
                      </Text>
             
                      <Text>
                        🗓 {new Date(event.date).toLocaleString()}
                      </Text>
             
                      <Text>
                        📍 {event.location}
                      </Text>
                    </View>
                  ))
                )}
             
                {/* SYSTEM NOTIFICATIONS */}
                <Text style={{ color: "#6B7280", marginTop: 15, marginBottom: 5 }}>
                  System Alerts
                </Text>
             
                {notifications.length === 0 ? (
                  <Text>No alerts yet</Text>
                  ) : (
                    notifications.map((notif) => (
                    <View
                      key={notif.id}
                      style={{
                        backgroundColor: notif.type === "SOS" ? "#FEE2E2" : "#E0F2FE",
                        padding: 12,
                        borderRadius: 12,
                        marginBottom: 10,
                      }}
                    >
                    <Text style={{ fontWeight: "bold" }}>
                       {notif.type === "SOS" ? "Emergency Alert" : "Notification"}
                     </Text>
             
                     <Text>{notif.message}</Text>
             
                      <Text style={{ fontSize: 14, color: "gray" }}>
                         {new Date(notif.timestamp).toLocaleString()}
                      </Text>
                    </View>
                  ))
                )}
              </View>
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
  },

  headerIcons: {
    flexDirection: "row",
    gap: 12,
  },

  iconButton: {
    padding: 8,
  },

  topSection: {
    flexDirection: "row",
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
    marginHorizontal: 20,
  },

  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    padding: 20,
  },

  deleteText: {
    marginTop: 16,
    fontSize: 16,
    color: "#DC2626",
    fontWeight: "600",
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
