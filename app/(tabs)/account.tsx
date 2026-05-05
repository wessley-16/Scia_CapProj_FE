import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/context/AuthContext";
import { submitIDRequest, logoutUser } from "@/lib/firebase";

const background = require("../../assets/images/Monochrome.jpg");

export default function Account() {
  const { fontScale, t } = useSettings();
  const { user, refreshUser, clearUser } = useAuth();
  const router = useRouter();

  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Physical ID Request state
  const [idModalVisible, setIdModalVisible] = useState(false);
  const [idReason, setIdReason] = useState("");
  const [idSubmitting, setIdSubmitting] = useState(false);
  const [idSubmitted, setIdSubmitted] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<any[]>([]);

  /* ---------- Notification panel ---------- */
  const [showNotif, setShowNotif] = useState(false);
  const screenWidth = Dimensions.get("window").width;
  const slideAnim = useState(new Animated.Value(screenWidth))[0];

  const toggleNotification = () => {
    if (showNotif) {
      Animated.timing(slideAnim, { toValue: screenWidth, duration: 300, useNativeDriver: true }).start(() => setShowNotif(false));
    } else {
      setShowNotif(true);
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  };

  const loadNotifications = async () => {
    const stored = await AsyncStorage.getItem("notifications");
    setNotifications(stored ? JSON.parse(stored) : []);
  };

  /* ---------- Profile image ---------- */
  const loadProfileImage = useCallback(async () => {
    const img = await AsyncStorage.getItem("profileImage");
    if (img) setProfileImage(img);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfileImage();
      loadNotifications();
      // Refresh user data from Firestore every time we visit this page
      refreshUser();
    }, [loadProfileImage])
  );

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
      if (!FileSystem.documentDirectory) {
        alert("Unable to access app directory");
        return;
      }
      const filename = uri.split("/").pop();
      const newUri = FileSystem.documentDirectory + filename;
      await FileSystem.copyAsync({ from: uri, to: newUri });
      setProfileImage(newUri);
      await AsyncStorage.setItem("profileImage", newUri);
    }
  };

  const deleteProfileImage = async () => {
    if (!profileImage) return;
    Alert.alert("Remove Profile Picture", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await FileSystem.deleteAsync(profileImage, { idempotent: true });
            await AsyncStorage.removeItem("profileImage");
            setProfileImage(null);
          } catch (error) {
            console.log("Delete error:", error);
          }
        },
      },
    ]);
  };

  /* ---------- ID Request ---------- */
  const submitIDRequestHandler = async () => {
    if (!user) return;
    setIdSubmitting(true);
    try {
      const seniorName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Senior";
      await submitIDRequest({
        seniorName,
        seniorId: user.idNumber || "N/A",
        address: user.address || "",
        contactNumber: user.conNumber || "",
        reason: idReason || "Replacement / First-time request",
      });
      setIdSubmitted(true);
      setIdModalVisible(false);
      Alert.alert("✅ Request Submitted", "Your physical Senior Citizen ID request has been sent to the Super Admin.");
    } catch (e) {
      Alert.alert("Error", "Failed to submit request. Check your connection.");
    } finally {
      setIdSubmitting(false);
    }
  };

  /* ---------- Logout ---------- */
  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logoutUser();
          clearUser();
          router.replace("/");
        },
      },
    ]);
  };

  const isVerified = user?.isVerified === true;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground source={background} style={styles.backgroundImage} resizeMode="cover">
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

          {/* HEADER */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { fontSize: 24 * fontScale }]}>{t("profilePage")}</Text>
            <View style={styles.headerIcons}>
              <TouchableOpacity onPress={() => router.push("/settings")} style={styles.iconButton}>
                <Ionicons name="settings" size={26} color="#2356E1" />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleNotification} style={styles.iconButton}>
                <Ionicons name={showNotif ? "close" : "notifications"} size={26} color="#2356E1" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
                <Ionicons name="log-out-outline" size={26} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

          {/* VERIFICATION BANNER */}
          {!isVerified ? (
            <View style={styles.unverifiedBanner}>
              <Ionicons name="alert-circle-outline" size={20} color="#92400E" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.unverifiedTitle}>Account Pending Verification</Text>
                <Text style={styles.unverifiedSubtitle}>
                  Your account is awaiting admin verification. You'll get full access once approved.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.verifiedBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#065F46" style={{ marginRight: 8 }} />
              <Text style={styles.verifiedTitle}>Verified Account ✓</Text>
            </View>
          )}

          {/* DETAILS + IMAGE */}
          <View style={styles.topSection}>
            <View style={styles.detailsContainer}>
              <Text style={[styles.label, { fontSize: 20 * fontScale }]}>{t("nameLabel")}</Text>
              <Text style={styles.value}>
                {user ? `${user.firstName} ${user.midName} ${user.lastName}` : "N/A"}
              </Text>

              <Text style={[styles.label, { fontSize: 20 * fontScale }]}>{t("seniorCitizenId")}</Text>
              <Text style={styles.value}>{user?.idNumber || "Not yet provided"}</Text>

              <Text style={[styles.label, { fontSize: 20 * fontScale }]}>{t("addressLabel")}</Text>
              <Text style={styles.value}>{user?.address || "N/A"}</Text>

              <Text style={[styles.label, { fontSize: 20 * fontScale }]}>{t("contactNumber")}</Text>
              <Text style={styles.value}>{user?.conNumber || "N/A"}</Text>

              <Text style={[styles.label, { fontSize: 20 * fontScale }]}>{t("dobLabel")}</Text>
              <Text style={styles.value}>{user?.dob || "N/A"}</Text>

              <Text style={[styles.label, { fontSize: 20 * fontScale }]}>{t("genderLabel")}</Text>
              <Text style={styles.value}>{user?.gender || "N/A"}</Text>
            </View>

            {/* PROFILE IMAGE */}
            <View style={styles.imageContainer}>
              <TouchableOpacity onPress={pickImage}>
                <Image
                  source={profileImage ? { uri: profileImage } : require("../../assets/images/default-profile.png")}
                  style={styles.profileImage}
                  onError={() => setProfileImage(null)}
                />
              </TouchableOpacity>
              <Text style={{ fontSize: 16 * fontScale, marginTop: 10, color: "#000" }}>{t("changePicture")}</Text>
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

          {/* PHYSICAL ID REQUEST */}
          <View style={styles.idRequestSection}>
            <Text style={[styles.idRequestTitle, { fontSize: 17 * fontScale }]}>🪪 Physical Senior Citizen ID</Text>
            <Text style={[styles.idRequestSub, { fontSize: 13 * fontScale }]}>
              Request your physical ID card from the Valenzuela City OSCA. Your request will be reviewed by the Super Admin.
            </Text>
            {idSubmitted ? (
              <View style={styles.idSubmittedBadge}>
                <Text style={{ color: "#065F46", fontWeight: "bold", fontSize: 13 * fontScale }}>✅ Request already submitted</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.idRequestBtn} onPress={() => setIdModalVisible(true)}>
                <Ionicons name="card-outline" size={20} color="white" />
                <Text style={[styles.idRequestBtnText, { fontSize: 14 * fontScale }]}>Request Physical ID</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* PHYSICAL ID REQUEST MODAL */}
        <Modal visible={idModalVisible} animationType="slide" transparent>
          <View style={styles.idModalOverlay}>
            <View style={styles.idModalBox}>
              <Text style={[styles.idModalTitle, { fontSize: 19 * fontScale }]}>📋 Physical ID Request</Text>
              <Text style={{ fontSize: 13 * fontScale, color: "#4B5563", marginBottom: 16, textAlign: "center" }}>
                This request will be sent to the Super Admin for processing.
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
                {idSubmitting ? <ActivityIndicator color="white" /> : <Text style={[styles.idSubmitBtnText, { fontSize: 15 * fontScale }]}>📤 Submit to Super Admin</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 12, alignItems: "center" }} onPress={() => setIdModalVisible(false)}>
                <Text style={{ color: "#EF4444", fontWeight: "bold", fontSize: 15 * fontScale }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* NOTIFICATION PANEL */}
        {showNotif && (
          <>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={toggleNotification} />
            <Animated.View style={[styles.notificationPanel, { transform: [{ translateX: slideAnim }] }]}>
              <TouchableOpacity style={styles.notifBtn} onPress={toggleNotification}>
                <Ionicons name="close" size={28} color="#2356E1" />
              </TouchableOpacity>
              <View style={{ marginTop: 50 }}>
                <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>{t("notifications")}</Text>
                <Text style={{ color: "#6B7280", marginBottom: 5 }}>Your Joined Events</Text>
                {joinedEvents.length === 0 ? (
                  <Text>No joined events yet</Text>
                ) : (
                  joinedEvents.map((event) => (
                    <View key={event.id} style={{ backgroundColor: "#F3F4F6", padding: 12, borderRadius: 12, marginBottom: 10 }}>
                      <Text style={{ fontWeight: "bold" }}>📌 {event.title}</Text>
                      <Text>🗓 {new Date(event.date).toLocaleString()}</Text>
                      <Text>📍 {event.location}</Text>
                    </View>
                  ))
                )}
                <Text style={{ color: "#6B7280", marginTop: 15, marginBottom: 5 }}>System Alerts</Text>
                {notifications.length === 0 ? (
                  <Text>No alerts yet</Text>
                ) : (
                  notifications.map((notif) => (
                    <View key={notif.id} style={{ backgroundColor: notif.type === "SOS" ? "#FEE2E2" : "#E0F2FE", padding: 12, borderRadius: 12, marginBottom: 10 }}>
                      <Text style={{ fontWeight: "bold" }}>{notif.type === "SOS" ? "Emergency Alert" : "Notification"}</Text>
                      <Text>{notif.message}</Text>
                      <Text style={{ fontSize: 14, color: "gray" }}>{new Date(notif.timestamp).toLocaleString()}</Text>
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
  safeArea: { flex: 1, backgroundColor: "#F4F6F9" },
  backgroundImage: { flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: { padding: 0 },
  unverifiedBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEF3C7", borderColor: "#F59E0B", borderWidth: 1, borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 12 },
  unverifiedTitle: { fontWeight: "700", color: "#92400E", fontSize: 13 },
  unverifiedSubtitle: { color: "#92400E", fontSize: 12, marginTop: 2 },
  verifiedBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#D1FAE5", borderColor: "#10B981", borderWidth: 1, borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 12 },
  verifiedTitle: { fontWeight: "700", color: "#065F46", fontSize: 13 },
  header: { flexDirection: "row", justifyContent: "space-between", padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#1F2937" },
  headerIcons: { flexDirection: "row", gap: 12 },
  iconButton: { padding: 8 },
  topSection: { flexDirection: "row" },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.3)" },
  notificationPanel: { position: "absolute", top: 0, right: 0, height: "100%", width: "80%", backgroundColor: "#fff", borderTopLeftRadius: 30, padding: 20, elevation: 10, zIndex: 10 },
  notifBtn: { position: "absolute", top: 20, right: 15, zIndex: 11 },
  detailsContainer: { flex: 1, marginRight: 20, padding: 20 },
  label: { fontSize: 20, fontWeight: "bold", color: "#1F2937", marginTop: 10 },
  value: { fontSize: 20, color: "#4B5563", marginBottom: 10 },
  imageContainer: { alignItems: "center", marginHorizontal: 20 },
  profileImage: { width: 150, height: 150, borderRadius: 75, padding: 20 },
  deleteText: { marginTop: 16, fontSize: 16, color: "#DC2626", fontWeight: "600" },
  qrCodeSection: { alignItems: "center", backgroundColor: "white", borderRadius: 30, marginTop: 20, padding: 12, elevation: 3 },
  qrCodeTitle: { fontSize: 24, fontWeight: "bold", color: "#1F2937", marginBottom: 10 },
  qrCodeImage: { width: 300, height: 300, backgroundColor: "#D1D5DB", marginBottom: 100 },
  idRequestSection: { margin: 20, marginTop: 0, backgroundColor: "white", borderRadius: 16, padding: 20, elevation: 2, marginBottom: 120 },
  idRequestTitle: { fontSize: 17, fontWeight: "bold", color: "#1F2937", marginBottom: 8 },
  idRequestSub: { fontSize: 13, color: "#6B7280", lineHeight: 20, marginBottom: 14 },
  idRequestBtn: { backgroundColor: "#2356E1", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  idRequestBtnText: { color: "white", fontWeight: "bold", fontSize: 14 },
  idSubmittedBadge: { backgroundColor: "#ECFDF5", borderRadius: 10, padding: 12, alignItems: "center" },
  idModalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  idModalBox: { backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  idModalTitle: { fontSize: 19, fontWeight: "bold", color: "#1F2937", marginBottom: 10, textAlign: "center" },
  idLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  idInput: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 14, backgroundColor: "#F9FAFB", minHeight: 70 },
  idSubmitBtn: { backgroundColor: "#2356E1", padding: 14, borderRadius: 12, alignItems: "center" },
  idSubmitBtnText: { color: "white", fontWeight: "bold", fontSize: 15 },
});
