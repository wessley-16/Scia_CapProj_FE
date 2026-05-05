import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from 'expo-file-system';
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Animated, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "@/context/SettingsContext";
import { submitIDRequest } from "@/lib/firebase";


export default function account() {
  const { fontScale, t } = useSettings();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const params = useLocalSearchParams();
  const router = useRouter();

  // ── Physical ID Request state ──
  const [idModalVisible, setIdModalVisible] = useState(false);
  const [idReason, setIdReason] = useState("");
  const [idSubmitting, setIdSubmitting] = useState(false);
  const [idSubmitted, setIdSubmitted] = useState(false);

  const submitIDRequestHandler = async () => {
    setIdSubmitting(true);
    try {
      const seniorName = `${params.firstName || ""} ${params.lastName || ""}`.trim() || "Senior";
      const seniorId = (params.idNumber as string) || "N/A";
      const address = (params.address as string) || "";
      const contactNumber = (params.conNumber as string) || "";
      await submitIDRequest({
        seniorName,
        seniorId,
        address,
        contactNumber,
        reason: idReason || "Replacement / First-time request",
      });
      setIdSubmitted(true);
      setIdModalVisible(false);
      Alert.alert(
        "✅ Request Submitted",
        "Your physical Senior Citizen ID request has been sent to the Super Admin for processing."
      );
    } catch (e) {
      Alert.alert("Error", "Failed to submit request. Check your connection.");
    } finally {
      setIdSubmitting(false);
    }
  };

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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* BLUE HEADER */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { fontSize: 22 * fontScale }]}>{t("profilePage")}</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={() => router.push("/settings")} style={styles.iconButton}>
              <Ionicons name="settings" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleNotification} style={styles.iconButton}>
              <Ionicons
                name={showNotif ? "close" : "notifications"}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* BLUE TOP — details + avatar */}
        <View style={styles.topSection}>
          <View style={styles.detailsContainer}>
            <Text style={[styles.label, { fontSize: 11 * fontScale }]}>{t("nameLabel")}</Text>
            <Text style={[styles.value, { fontSize: 15 * fontScale }]}>{params.firstName} {params.midName} {params.lastName || "N/A"}</Text>

            <Text style={[styles.label, { fontSize: 11 * fontScale }]}>{t("seniorCitizenId")}</Text>
            <Text style={[styles.value, { fontSize: 15 * fontScale }]}>{params.idNumber || "N/A"}</Text>

            <Text style={[styles.label, { fontSize: 11 * fontScale }]}>{t("addressLabel")}</Text>
            <Text style={[styles.value, { fontSize: 15 * fontScale }]}>{params.address || "N/A"}</Text>

            <Text style={[styles.label, { fontSize: 11 * fontScale }]}>{t("contactNumber")}</Text>
            <Text style={[styles.value, { fontSize: 15 * fontScale }]}>{params.conNumber || "N/A"}</Text>

            <Text style={[styles.label, { fontSize: 11 * fontScale }]}>{t("dobLabel")}</Text>
            <Text style={[styles.value, { fontSize: 15 * fontScale }]}>{params.dob || "N/A"}</Text>

            <Text style={[styles.label, { fontSize: 11 * fontScale }]}>{t("genderLabel")}</Text>
            <Text style={[styles.value, { fontSize: 15 * fontScale }]}>{params.gender || "N/A"}</Text>
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
            <Text style={{ fontSize: 12 * fontScale, marginTop: 8, color: "#F5C842", fontWeight: "600" }}>
              {t("changePicture")}
            </Text>
            {profileImage && (
              <TouchableOpacity onPress={deleteProfileImage}>
                <Text style={[styles.deleteText, { fontSize: 12 * fontScale }]}>{t("removePicture")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* WHITE CARD BODY */}
        <View style={styles.cardBody}>
          {/* QR CODE SECTION */}
          <View style={styles.qrCodeSection}>
            <Text style={[styles.qrCodeTitle, { fontSize: 16 * fontScale }]}>{t("qrCodeTitle")}</Text>
            <Image
              source={{ uri: "https://via.placeholder.com/250x250?text=QR+Code+Placeholder" }}
              style={styles.qrCodeImage}
            />
          </View>

          {/* PHYSICAL ID REQUEST */}
          <View style={styles.idRequestSection}>
            <Text style={[styles.idRequestTitle, { fontSize: 15 * fontScale }]}>
              🪪 Physical Senior Citizen ID
            </Text>
            <Text style={[styles.idRequestSub, { fontSize: 12 * fontScale }]}>
              Request your physical ID card from the Valenzuela City OSCA.
              Your request will be reviewed by the Super Admin.
            </Text>
            {idSubmitted ? (
              <View style={styles.idSubmittedBadge}>
                <Text style={{ color: "#065F46", fontWeight: "bold", fontSize: 13 * fontScale }}>
                  ✅ Request already submitted
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.idRequestBtn}
                onPress={() => setIdModalVisible(true)}
              >
                <Ionicons name="card-outline" size={20} color="white" />
                <Text style={[styles.idRequestBtnText, { fontSize: 14 * fontScale }]}>
                  Request Physical ID
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* PHYSICAL ID REQUEST MODAL */}
      <Modal visible={idModalVisible} animationType="slide" transparent>
        <View style={styles.idModalOverlay}>
          <View style={styles.idModalBox}>
            <Text style={[styles.idModalTitle, { fontSize: 19 * fontScale }]}>
              📋 Physical ID Request
            </Text>
            <Text style={[{ fontSize: 13 * fontScale, color: "#4B5563", marginBottom: 16, textAlign: "center" }]}>
              This request will be sent to the Super Admin for processing. Your senior citizen ID will be prepared by the Valenzuela OSCA.
            </Text>
            <Text style={styles.idLabel}>Reason for request (optional)</Text>
            <TextInput
              placeholder="e.g. First-time request, Lost ID, etc."
              value={idReason}
              onChangeText={setIdReason}
              style={styles.idInput}
              multiline
            />
            <TouchableOpacity
              style={[styles.idSubmitBtn, idSubmitting && { opacity: 0.7 }]}
              onPress={submitIDRequestHandler}
              disabled={idSubmitting}
            >
              {idSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={[styles.idSubmitBtnText, { fontSize: 15 * fontScale }]}>
                  📤 Submit to Super Admin
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginTop: 12, alignItems: "center" }}
              onPress={() => setIdModalVisible(false)}
            >
              <Text style={{ color: "#EF4444", fontWeight: "bold", fontSize: 15 * fontScale }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#2356E1",
  },

  backgroundImage: { flex: 1 },

  scrollView: {
    flex: 1,
  },

  contentContainer: {
    padding: 0,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#2356E1",
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },

  headerIcons: {
    flexDirection: "row",
    gap: 12,
  },

  iconButton: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
  },

  topSection: {
    flexDirection: "row",
    backgroundColor: "#2356E1",
    paddingHorizontal: 20,
    paddingBottom: 32,
    alignItems: "center",
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
    marginRight: 12,
  },

  label: {
    fontSize: 13,
    fontWeight: "bold",
    color: "rgba(255,255,255,0.75)",
    marginTop: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  value: {
    fontSize: 15,
    color: "#FFFFFF",
    marginBottom: 2,
    fontWeight: "500",
  },

  imageContainer: {
    alignItems: "center",
  },

  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#F5C842",
  },

  deleteText: {
    marginTop: 8,
    fontSize: 12,
    color: "#FCA5A5",
    fontWeight: "600",
  },

  // White card body (sits below the blue header)
  cardBody: {
    backgroundColor: "#F0F4FF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    paddingTop: 20,
    paddingHorizontal: 16,
  },

  qrCodeSection: {
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 20,
    marginBottom: 16,
    padding: 20,
    elevation: 3,
    shadowColor: "#2356E1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  qrCodeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2356E1",
    marginBottom: 12,
  },

  qrCodeImage: {
    width: 220,
    height: 220,
    backgroundColor: "#E5EDFF",
    borderRadius: 12,
  },

  idRequestSection: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    elevation: 2,
    marginBottom: 20,
    shadowColor: "#2356E1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  idRequestTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 6,
  },
  idRequestSub: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 14,
  },
  idRequestBtn: {
    backgroundColor: "#2356E1",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  idRequestBtnText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  idSubmittedBadge: {
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  idModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  idModalBox: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  idModalTitle: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 10,
    textAlign: "center",
  },
  idLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  idInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
    backgroundColor: "#F9FAFB",
    minHeight: 70,
  },
  idSubmitBtn: {
    backgroundColor: "#2356E1",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  idSubmitBtnText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 15,
  },
});
