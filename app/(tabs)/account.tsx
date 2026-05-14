import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/context/AuthContext";
import { submitIDRequest, logoutUser } from "@/lib/firebase";

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  primary:       "#1A56C4",
  primaryLight:  "#EBF2FF",
  primaryDark:   "#0F3A8A",
  accent:        "#F59E0B",
  danger:        "#DC2626",
  dangerLight:   "#FEF2F2",
  success:       "#059669",
  successLight:  "#ECFDF5",
  warning:       "#D97706",
  warningLight:  "#FFFBEB",
  bg:            "#F0F4FB",
  card:          "#FFFFFF",
  text:          "#111827",
  textSub:       "#4B5563",
  textMuted:     "#9CA3AF",
  border:        "#E5E7EB",
  shadow:        "#1A56C4",
};

// ─── Info row component ───────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={row.wrap}>
      <View style={row.iconBox}>
        <Ionicons name={icon} size={22} color={C.primary} />
      </View>
      <View style={row.text}>
        <Text style={row.label}>{label}</Text>
        <Text style={row.value}>{value || "—"}</Text>
      </View>
    </View>
  );
}

const row = StyleSheet.create({
  wrap: {
    flexDirection:  "row",
    alignItems:     "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconBox: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: C.primaryLight,
    alignItems:      "center",
    justifyContent:  "center",
    marginRight:     14,
  },
  text:  { flex: 1 },
  label: { fontSize: 13, color: C.textMuted, fontWeight: "600", marginBottom: 2 },
  value: { fontSize: 17, color: C.text,     fontWeight: "700", lineHeight: 22 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function Account() {
  const { fontScale, t } = useSettings();
  const { user, refreshUser, clearUser } = useAuth();
  const router = useRouter();

  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Physical ID Request
  const [idModalVisible, setIdModalVisible] = useState(false);
  const [idReason,       setIdReason]       = useState("");
  const [idSubmitting,   setIdSubmitting]   = useState(false);
  const [idSubmitted,    setIdSubmitted]    = useState(false);

  // Notification panel
  const [notifications, setNotifications] = useState<any[]>([]);
  const [joinedEvents,  setJoinedEvents]  = useState<any[]>([]);
  const [showNotif,     setShowNotif]     = useState(false);
  const screenWidth = Dimensions.get("window").width;
  const slideAnim   = useState(new Animated.Value(screenWidth))[0];

  const toggleNotification = () => {
    if (showNotif) {
      Animated.timing(slideAnim, { toValue: screenWidth, duration: 280, useNativeDriver: true })
        .start(() => setShowNotif(false));
    } else {
      setShowNotif(true);
      Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    }
  };

  const loadNotifications = async () => {
    const stored = await AsyncStorage.getItem("notifications");
    setNotifications(stored ? JSON.parse(stored) : []);
  };

  const loadProfileImage = useCallback(async () => {
    const img = await AsyncStorage.getItem("profileImage");
    if (img) setProfileImage(img);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfileImage();
      loadNotifications();
      refreshUser();
    }, [loadProfileImage]),
  );

  // ── Profile image ────────────────────────────────────────────────────────
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { alert("Permission required to access gallery"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      const uri      = result.assets[0].uri;
      const filename = uri.split("/").pop();
      const newUri   = FileSystem.documentDirectory + filename;
      await FileSystem.copyAsync({ from: uri, to: newUri });
      setProfileImage(newUri);
      await AsyncStorage.setItem("profileImage", newUri);
    }
  };

  const deleteProfileImage = () => {
    if (!profileImage) return;
    Alert.alert("Remove Photo", "Remove your profile picture?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await FileSystem.deleteAsync(profileImage, { idempotent: true });
            await AsyncStorage.removeItem("profileImage");
            setProfileImage(null);
          } catch {}
        },
      },
    ]);
  };

  // ── ID Request ────────────────────────────────────────────────────────────
  const submitIDRequestHandler = async () => {
    if (!user) return;
    setIdSubmitting(true);
    try {
      await submitIDRequest({
        seniorName:    `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Senior",
        seniorId:      user.idNumber || "N/A",
        address:       user.address  || "",
        contactNumber: user.conNumber || "",
        reason:        idReason || "Replacement / First-time request",
      });
      setIdSubmitted(true);
      setIdModalVisible(false);
      Alert.alert("✅ Request Submitted", "Your physical Senior Citizen ID request has been sent to the admin.");
    } catch {
      Alert.alert("Error", "Failed to submit. Please check your connection.");
    } finally {
      setIdSubmitting(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
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

  const isVerified  = user?.isVerified === true;
  const displayName = user
    ? `${user.firstName ?? ""} ${user.midName ?? ""} ${user.lastName ?? ""}`.replace(/\s+/g, " ").trim()
    : "—";

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <View style={s.topBar}>
        <Text style={s.topBarTitle}>My Profile</Text>
        <View style={s.topBarActions}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/settings")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="settings-outline" size={26} color={C.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={toggleNotification}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="notifications-outline" size={26} color={C.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, s.logoutBtn]} onPress={handleLogout}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="log-out-outline" size={24} color={C.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero card: photo + name + badge ─────────────────────────── */}
        <View style={s.heroCard}>
          {/* Profile photo */}
          <View style={s.photoWrapper}>
            <TouchableOpacity onPress={pickImage} activeOpacity={0.85}>
              <Image
                source={
                  profileImage
                    ? { uri: profileImage }
                    : require("../../assets/images/default-profile.png")
                }
                style={s.photo}
                onError={() => setProfileImage(null)}
              />
              {/* Camera overlay */}
              <View style={s.cameraOverlay}>
                <Ionicons name="camera" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
            {profileImage && (
              <TouchableOpacity style={s.removePhotoBtn} onPress={deleteProfileImage}>
                <Text style={s.removePhotoText}>Remove photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Name */}
          <Text style={s.heroName}>{displayName}</Text>
          <Text style={s.heroIdNumber}>
            ID: {user?.idNumber || "Not yet assigned"}
          </Text>

          {/* Verified / Pending badge */}
          {isVerified ? (
            <View style={[s.badge, s.badgeVerified]}>
              <Ionicons name="checkmark-circle" size={18} color={C.success} />
              <Text style={[s.badgeText, { color: C.success }]}>Verified Account</Text>
            </View>
          ) : (
            <View style={[s.badge, s.badgePending]}>
              <Ionicons name="time-outline" size={18} color={C.warning} />
              <Text style={[s.badgeText, { color: C.warning }]}>Pending Verification</Text>
            </View>
          )}

          {/* Pending explanation */}
          {!isVerified && (
            <View style={s.pendingNote}>
              <Text style={s.pendingNoteText}>
                Your account is awaiting admin verification. You'll get full access once approved.
              </Text>
            </View>
          )}
        </View>

        {/* ── Personal information card ────────────────────────────────── */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="person-circle-outline" size={22} color={C.primary} />
            <Text style={s.sectionTitle}>Personal Information</Text>
          </View>

          <InfoRow icon="person-outline"    label="Full Name"       value={displayName} />
          <InfoRow icon="location-outline"  label="Address"        value={user?.address   || ""} />
          <InfoRow icon="call-outline"      label="Contact Number" value={user?.conNumber || ""} />
          <InfoRow icon="calendar-outline"  label="Date of Birth"  value={user?.dob       || ""} />
          <InfoRow
            icon="male-female-outline"
            label="Gender"
            value={user?.gender || ""}
          />
        </View>

        {/* ── Physical ID request card ─────────────────────────────────── */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="card-outline" size={22} color={C.primary} />
            <Text style={s.sectionTitle}>Physical Senior Citizen ID</Text>
          </View>

          <Text style={s.idDescription}>
            Request your official physical ID card from the Valenzuela City OSCA.
            Your request will be reviewed by the admin.
          </Text>

          {idSubmitted ? (
            <View style={s.submittedBox}>
              <Ionicons name="checkmark-circle" size={24} color={C.success} />
              <Text style={s.submittedText}>Request already submitted</Text>
            </View>
          ) : (
            <TouchableOpacity style={s.idRequestBtn} onPress={() => setIdModalVisible(true)} activeOpacity={0.85}>
              <Ionicons name="send-outline" size={20} color="#fff" />
              <Text style={s.idRequestBtnText}>Request Physical ID</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Quick actions ────────────────────────────────────────────── */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="grid-outline" size={22} color={C.primary} />
            <Text style={s.sectionTitle}>Quick Actions</Text>
          </View>

          <TouchableOpacity style={s.quickAction} onPress={() => router.push("/settings")} activeOpacity={0.8}>
            <View style={[s.quickIconBox, { backgroundColor: "#EBF2FF" }]}>
              <Ionicons name="settings-outline" size={24} color={C.primary} />
            </View>
            <View style={s.quickText}>
              <Text style={s.quickTitle}>Settings</Text>
              <Text style={s.quickSub}>Font size, language, accessibility</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={s.quickAction} onPress={toggleNotification} activeOpacity={0.8}>
            <View style={[s.quickIconBox, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="notifications-outline" size={24} color={C.accent} />
            </View>
            <View style={s.quickText}>
              <Text style={s.quickTitle}>Notifications</Text>
              <Text style={s.quickSub}>Events & system alerts</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.quickAction, { borderBottomWidth: 0 }]} onPress={handleLogout} activeOpacity={0.8}>
            <View style={[s.quickIconBox, { backgroundColor: C.dangerLight }]}>
              <Ionicons name="log-out-outline" size={24} color={C.danger} />
            </View>
            <View style={s.quickText}>
              <Text style={[s.quickTitle, { color: C.danger }]}>Log Out</Text>
              <Text style={s.quickSub}>Sign out of your account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── ID Request modal ─────────────────────────────────────────────── */}
      <Modal visible={idModalVisible} animationType="slide" transparent>
        <View style={m.overlay}>
          <View style={m.box}>
            <View style={m.handle} />
            <Text style={m.title}>Request Physical ID</Text>
            <Text style={m.sub}>
              This request will be sent to the Super Admin for processing.
            </Text>

            <Text style={m.label}>Reason (optional)</Text>
            <TextInput
              placeholder="e.g. First-time request, Lost ID…"
              placeholderTextColor={C.textMuted}
              value={idReason}
              onChangeText={setIdReason}
              style={m.input}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[m.submitBtn, idSubmitting && { opacity: 0.65 }]}
              onPress={submitIDRequestHandler}
              disabled={idSubmitting}
              activeOpacity={0.85}
            >
              {idSubmitting
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="send-outline" size={20} color="#fff" />
                    <Text style={m.submitText}>Submit Request</Text>
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={m.cancelBtn}
              onPress={() => setIdModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Notification panel ───────────────────────────────────────────── */}
      {showNotif && (
        <>
          <TouchableOpacity style={n.backdrop} activeOpacity={1} onPress={toggleNotification} />
          <Animated.View style={[n.panel, { transform: [{ translateX: slideAnim }] }]}>
            <View style={n.panelHeader}>
              <Text style={n.panelTitle}>Notifications</Text>
              <TouchableOpacity onPress={toggleNotification}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={30} color={C.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={n.sectionLabel}>Joined Events</Text>
              {joinedEvents.length === 0 ? (
                <View style={n.emptyBox}>
                  <Ionicons name="calendar-outline" size={32} color={C.textMuted} />
                  <Text style={n.emptyText}>No joined events yet</Text>
                </View>
              ) : (
                joinedEvents.map((e) => (
                  <View key={e.id} style={n.notifCard}>
                    <Text style={n.notifCardTitle}>📌 {e.title}</Text>
                    <Text style={n.notifCardSub}>🗓 {new Date(e.date).toLocaleString()}</Text>
                    <Text style={n.notifCardSub}>📍 {e.location}</Text>
                  </View>
                ))
              )}

              <Text style={n.sectionLabel}>System Alerts</Text>
              {notifications.length === 0 ? (
                <View style={n.emptyBox}>
                  <Ionicons name="notifications-off-outline" size={32} color={C.textMuted} />
                  <Text style={n.emptyText}>No alerts yet</Text>
                </View>
              ) : (
                notifications.map((notif) => (
                  <View key={notif.id}
                    style={[n.notifCard, { backgroundColor: notif.type === "SOS" ? C.dangerLight : C.primaryLight }]}>
                    <Text style={n.notifCardTitle}>
                      {notif.type === "SOS" ? "🚨 Emergency Alert" : "🔔 Notification"}
                    </Text>
                    <Text style={n.notifCardSub}>{notif.message}</Text>
                    <Text style={n.notifCardTime}>{new Date(notif.timestamp).toLocaleString()}</Text>
                  </View>
                ))
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Top bar
  topBar: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  topBarTitle: { fontSize: 20, fontWeight: "800", color: C.text },
  topBarActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: { padding: 6, borderRadius: 10 },
  logoutBtn: { marginLeft: 4 },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },

  // Hero card
  heroCard: {
    backgroundColor: C.card,
    borderRadius:    24,
    padding:         24,
    alignItems:      "center",
    elevation: 3,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  photoWrapper: { alignItems: "center", marginBottom: 16 },
  photo: {
    width:        110,
    height:       110,
    borderRadius: 55,
    borderWidth:  3,
    borderColor:  C.primary,
  },
  cameraOverlay: {
    position:        "absolute",
    bottom:          0,
    right:           0,
    backgroundColor: C.primary,
    width:           32,
    height:          32,
    borderRadius:    16,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     2,
    borderColor:     "#fff",
  },
  removePhotoBtn: { marginTop: 8 },
  removePhotoText: { color: C.danger, fontSize: 13, fontWeight: "600" },

  heroName: {
    fontSize:   24,
    fontWeight: "800",
    color:      C.text,
    textAlign:  "center",
    marginBottom: 4,
  },
  heroIdNumber: {
    fontSize:   15,
    color:      C.textSub,
    fontWeight: "600",
    marginBottom: 14,
  },

  // Badge
  badge: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      999,
    gap:               6,
  },
  badgeVerified: { backgroundColor: C.successLight },
  badgePending:  { backgroundColor: C.warningLight },
  badgeText:     { fontSize: 14, fontWeight: "700" },

  // Pending note
  pendingNote: {
    marginTop:         12,
    backgroundColor:   C.warningLight,
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingVertical:   10,
    borderLeftWidth:   3,
    borderLeftColor:   C.accent,
  },
  pendingNoteText: { fontSize: 13, color: C.warning, lineHeight: 19, fontWeight: "500" },

  // Section card
  sectionCard: {
    backgroundColor: C.card,
    borderRadius:    20,
    padding:         20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  sectionHeader: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            10,
    marginBottom:   16,
    paddingBottom:  12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: C.text },

  // ID description
  idDescription: {
    fontSize:   15,
    color:      C.textSub,
    lineHeight: 22,
    marginBottom: 18,
  },
  idRequestBtn: {
    backgroundColor: C.primary,
    borderRadius:    14,
    paddingVertical: 16,
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             10,
    elevation: 3,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  idRequestBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  submittedBox: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               8,
    backgroundColor:   C.successLight,
    borderRadius:      12,
    paddingVertical:   14,
  },
  submittedText: { fontSize: 15, fontWeight: "700", color: C.success },

  // Quick actions
  quickAction: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap:               14,
  },
  quickIconBox: {
    width:          50,
    height:         50,
    borderRadius:   14,
    alignItems:     "center",
    justifyContent: "center",
  },
  quickText:  { flex: 1 },
  quickTitle: { fontSize: 16, fontWeight: "700", color: C.text,    marginBottom: 2 },
  quickSub:   { fontSize: 13, color: C.textSub },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: {
    flex:            1,
    justifyContent:  "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  box: {
    backgroundColor:    C.card,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    padding:            24,
    paddingBottom:      44,
  },
  handle: {
    width:           40,
    height:          4,
    backgroundColor: C.border,
    borderRadius:    2,
    alignSelf:       "center",
    marginBottom:    20,
  },
  title: { fontSize: 22, fontWeight: "800", color: C.text,    textAlign: "center", marginBottom: 6 },
  sub:   { fontSize: 14, color: C.textSub, textAlign: "center", marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 8 },
  input: {
    borderWidth:     1.5,
    borderColor:     C.border,
    borderRadius:    12,
    padding:         14,
    fontSize:        15,
    color:           C.text,
    backgroundColor: "#FAFAFA",
    marginBottom:    20,
    minHeight:       80,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius:    14,
    paddingVertical: 16,
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             10,
    marginBottom:    12,
    elevation: 3,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  cancelBtn:  { alignItems: "center", paddingVertical: 12 },
  cancelText: { color: C.danger, fontSize: 16, fontWeight: "700" },
});

// ─── Notification panel styles ────────────────────────────────────────────────
const n = StyleSheet.create({
  backdrop: {
    position:        "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  panel: {
    position:              "absolute",
    top: 0, right: 0,
    height:                "100%",
    width:                 "82%",
    backgroundColor:       C.card,
    borderTopLeftRadius:   28,
    borderBottomLeftRadius:28,
    padding:               20,
    paddingTop:            52,
    elevation:             12,
    shadowColor:           "#000",
    shadowOffset:          { width: -3, height: 0 },
    shadowOpacity:         0.15,
    shadowRadius:          12,
  },
  panelHeader: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   20,
  },
  panelTitle: { fontSize: 22, fontWeight: "800", color: C.text },
  sectionLabel: {
    fontSize:      12,
    fontWeight:    "700",
    color:         C.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom:  10,
    marginTop:     6,
  },
  emptyBox: {
    alignItems:   "center",
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: { fontSize: 14, color: C.textMuted },
  notifCard: {
    backgroundColor: C.primaryLight,
    borderRadius:    12,
    padding:         14,
    marginBottom:    10,
  },
  notifCardTitle: { fontSize: 15, fontWeight: "700", color: C.text,    marginBottom: 4 },
  notifCardSub:   { fontSize: 13, color: C.textSub,  marginBottom: 2 },
  notifCardTime:  { fontSize: 11, color: C.textMuted, marginTop: 4 },
});
