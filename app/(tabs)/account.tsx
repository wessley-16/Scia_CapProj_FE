import { Palette } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import ReadAloudRoot from "@/components/ReadAloudRoot";
import { Text } from "@/components/ReadAloudText";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/context/AuthContext";
import GuestAccount from "@/components/GuestAccount";
import IdVerificationCard from "@/components/IdVerificationCard";
import IdRequestTracker, { isFinishedIdRequest } from "@/components/IdRequestTracker";
import PickupModal from "@/components/PickupModal";
import PickupPicker, { OfficeStatusBanner } from "@/components/PickupPicker";
import { useOffice } from "@/hooks/useOffice";
import { bookIdPickup, bookableDates, formatPickup, PickupError } from "@/lib/pickup";
import SafetyMonitoringCard from "@/components/SafetyMonitoringCard";
import {
  submitIDRequest,
  logoutUser,
  buildUserQRPayload,
  subscribeToMyIdRequest,
  MyIdRequest,
} from "@/lib/firebase";

// Colour tokens
const makeColors = (p: Palette) => ({
  primary: p.info,
  primaryLight: p.surfaceSoft,
  primaryDark: p.primaryDark,
  accent: p.warning,
  danger: p.danger,
  dangerLight: p.dangerSoft,
  success: p.success,
  successLight: p.successSoft,
  warning: p.warning,
  warningLight: p.warningSoft,
  bg: p.bg,
  card: p.surface,
  text: p.text,
  textSub: p.textSecondary,
  textMuted: p.textMuted,
  border: p.border,
  shadow: p.primary,
  outline: p.cardBorder,
});
type Colors = ReturnType<typeof makeColors>;

// Info row component
function InfoRow({ icon, label, value, fontScale }: { icon: any; label: string; value: string; fontScale: number }) {
  const { colors: palette } = useSettings();
  const C = useMemo(() => makeColors(palette), [palette]);
  const row = useMemo(() => makeRow(C), [C]);
  const { t } = useSettings();
  return (
    <View style={row.wrap}>
      <View style={row.iconBox}>
        <Ionicons name={icon} size={22} color={C.primary} />
      </View>
      <View style={row.text}>
        <Text style={[row.label, { fontSize: 14 * fontScale }]}>{label}</Text>
        <Text style={[row.value, { fontSize: 18 * fontScale }]}>{value || t("acNotSet")}</Text>
      </View>
    </View>
  );
}

const makeRow = (C: Colors) => StyleSheet.create({
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
  label: { fontSize: 14, color: C.textMuted, fontWeight: "600", marginBottom: 2 },
  value: { fontSize: 17, color: C.text,     fontWeight: "700", lineHeight: 22 },
});

// Main screen
function AccountInner() {
  const { colors: palette } = useSettings();
  const C = useMemo(() => makeColors(palette), [palette]);
  const s = useMemo(() => makeS(C), [C]);
  const m = useMemo(() => makeM(C), [C]);
  const n = useMemo(() => makeN(C), [C]);
  const { fontScale, t } = useSettings();
  const { user, refreshUser, clearUser } = useAuth();
  const router = useRouter();

  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Physical ID Request
  const [idModalVisible, setIdModalVisible] = useState(false);
  const [idReason,       setIdReason]       = useState("");
  const [idSubmitting,   setIdSubmitting]   = useState(false);
  // The request form is three short steps: reason, pickup time, then a check.
  const [idStep, setIdStep] = useState(0);
  const ID_STEPS = 3;
  // Live status of the senior's latest request, straight from Firestore, so the
  // progress survives app restarts and follows what OSCA / the barangay do.
  const [idRequest,      setIdRequest]      = useState<MyIdRequest | null>(null);
  // City Hall pickup: the senior picks ONE day + time when requesting, and can
  // change it later from the tracker. `office` is OSCA's live status + hours.
  const office = useOffice();
  const [idPickup,        setIdPickup]       = useState<{ date: string; time: string } | null>(null);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setIdRequest(null);
      return undefined;
    }
    return subscribeToMyIdRequest(user.uid, setIdRequest);
  }, [user?.uid]);

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

  // Profile image
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert(t("acPhotoPermission")); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      const uri      = result.assets[0].uri;
      const filename = uri.split("/").pop() || `avatar_${Date.now()}.jpg`;
      const baseDir  = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
      const newUri   = `${baseDir}${filename}`;
      await FileSystem.copyAsync({ from: uri, to: newUri });
      setProfileImage(newUri);
      await AsyncStorage.setItem("profileImage", newUri);
    }
  };

  const deleteProfileImage = () => {
    if (!profileImage) return;
    Alert.alert(t("acRemovePhotoTitle"), t("acRemovePhotoBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("acRemove"),
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

  const idNextStep = () => {
    // Same rule as the final submit: pick a time whenever OSCA has days open.
    if (idStep === 1 && bookableDates(office, 1).length > 0 && !(idPickup?.date && idPickup?.time)) {
      Alert.alert(t("pkChoose"), t("pkPickFirst"));
      return;
    }
    setIdStep((n) => Math.min(n + 1, ID_STEPS - 1));
  };

  // ID Request
  const submitIDRequestHandler = async () => {
    if (!user) return;
    // A time is required whenever OSCA has days open; if none are open, the
    // senior can still send the request and pick a time later.
    if (bookableDates(office, 1).length > 0 && !(idPickup?.date && idPickup?.time)) {
      Alert.alert(t("pkChoose"), t("pkPickFirst"));
      return;
    }
    setIdSubmitting(true);
    try {
      const requestId = await submitIDRequest({
        seniorName:    `${user.firstName || ""} ${user.lastName || ""}`.trim() || t("acSenior"),
        seniorId:      user.idNumber || "N/A",
        address:       user.address  || "",
        barangay:      user.barangay,
        district:      user.district,
        contactNumber: user.conNumber || "",
        reason:        idReason || "Replacement / First-time request", // kept in English: read by the admin panel
      });
      setIdReason("");
      setIdModalVisible(false);

      // Book the City Hall slot. The request already exists at this point, so if
      // the time was just taken the senior simply picks another one in the tracker.
      let booked = false;
      if (idPickup?.date && idPickup?.time) {
        try {
          await bookIdPickup(requestId, idPickup.date, idPickup.time);
          booked = true;
        } catch (bookErr: any) {
          const key = bookErr instanceof PickupError ? bookErr.messageKey : "pkErrGeneric";
          Alert.alert(t("acIdSubmittedTitle"), `${t("pkRequestNoTime")}\n\n${t(key)}`);
        }
      }
      if (booked) {
        Alert.alert(t("acIdSubmittedTitle"), t("pkSubmittedWithTime", { when: formatPickup(idPickup) }));
      } else if (!idPickup) {
        Alert.alert(t("acIdSubmittedTitle"), t("acIdSubmittedBody"));
      }
      setIdPickup(null);
    } catch (e: any) {
      const inProgress = /already have a physical id request/i.test(e?.message ?? "");
      Alert.alert(
        inProgress ? t("acIdInProgressTitle") : t("errorTitle"),
        inProgress ? t("acIdInProgressBody") : t("acIdFail"),
      );
    } finally {
      setIdSubmitting(false);
    }
  };

  // Logout
  const handleLogout = () => {
    Alert.alert(t("acLogOutTitle"), t("acLogOutBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("acLogOutTitle"),
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
    : t("acNotSet");

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={[s.topBarTitle, { fontSize: 20 * fontScale }]}>{t("acTitle")}</Text>
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

        {/* Hero card: photo, name, badge */}
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
              <TouchableOpacity style={s.removePhotoBtn} onPress={deleteProfileImage} hitSlop={8}>
                <Text style={[s.removePhotoText, { fontSize: 15 * fontScale }]}>{t("acRemovePhotoLink")}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Name */}
          <Text style={[s.heroName, { fontSize: 24 * fontScale }]}>{displayName}</Text>
          <Text style={[s.heroIdNumber, { fontSize: 15 * fontScale }]}>
            ID: {user?.idNumber || "Not yet assigned"}
          </Text>

          {/* Verified / Pending badge */}
          {isVerified ? (
            <View style={[s.badge, s.badgeVerified]}>
              <Ionicons name="checkmark-circle" size={18} color={C.success} />
              <Text style={[s.badgeText, { color: C.success, fontSize: 14 * fontScale }]}>{t("acVerified")}</Text>
            </View>
          ) : (
            <View style={[s.badge, s.badgePending]}>
              <Ionicons name="time-outline" size={18} color={C.warning} />
              <Text style={[s.badgeText, { color: C.warning, fontSize: 14 * fontScale }]}>{t("acPendingVerification")}</Text>
            </View>
          )}

          {/* Pending explanation */}
          {!isVerified && (
            <View style={s.pendingNote}>
              <Text style={[s.pendingNoteText, { fontSize: 14 * fontScale }]}>
                {t("acPendingNote")}
              </Text>
            </View>
          )}
        </View>

        {/* Physical OSCA ID → admin verifies → real ID number + Digital ID */}
        <IdVerificationCard />

        {/* QR code card: identity for event check-in */}
        {user && (
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <Ionicons name="qr-code-outline" size={22} color={C.primary} />
              <Text style={[s.sectionTitle, { fontSize: 17 * fontScale }]}>{t("acQrTitle")}</Text>
            </View>

            <Text style={[s.qrDescription, { fontSize: 15 * fontScale }]}>
              {t("acQrDesc")}
            </Text>

            <View style={s.qrWrapper}>
              <QRCode
                value={buildUserQRPayload({ uid: user.uid, idNumber: user.idNumber })}
                size={180}
                backgroundColor="#ffffff"
                color={C.text}
              />
            </View>

            <Text style={[s.qrIdLabel, { fontSize: 14 * fontScale }]}>ID: {user.idNumber || "Not yet assigned"}</Text>
          </View>
        )}

        {/* Personal information card */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="person-circle-outline" size={22} color={C.primary} />
            <Text style={[s.sectionTitle, { fontSize: 17 * fontScale }]}>{t("acPersonalInfo")}</Text>
          </View>

          <InfoRow icon="person-outline"    label={t("acFullName")} value={displayName} fontScale={fontScale} />
          <InfoRow icon="location-outline"  label={t("acAddress")} value={user?.address   || ""} fontScale={fontScale} />
          <InfoRow icon="call-outline"      label={t("acContact")} value={user?.conNumber || ""} fontScale={fontScale} />
          <InfoRow icon="calendar-outline"  label={t("acDob")} value={user?.dob       || ""} fontScale={fontScale} />
          <InfoRow
            icon="male-female-outline"
            label={t("acGender")}
            value={user?.gender === "Male" ? t("genderMale") : user?.gender === "Female" ? t("genderFemale") : (user?.gender || "")}
            fontScale={fontScale}
          />
        </View>

        {/* Physical ID request card */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="card-outline" size={22} color={C.primary} />
            <Text style={[s.sectionTitle, { fontSize: 17 * fontScale }]}>{t("acPhysicalIdTitle")}</Text>
          </View>

          <Text style={[s.idDescription, { fontSize: 15 * fontScale }]}>
            {t("acPhysicalIdDesc")}
          </Text>

          <OfficeStatusBanner office={office} fontScale={fontScale} />

          {idRequest && (
            <View style={s.idTrackerBox}>
              <IdRequestTracker
                request={idRequest}
                fontScale={fontScale}
                office={office}
                onEditPickup={() => setPickupModalOpen(true)}
              />
            </View>
          )}

          {(!idRequest || isFinishedIdRequest(idRequest.status)) && (
            <TouchableOpacity style={s.idRequestBtn} onPress={() => { setIdStep(0); setIdModalVisible(true); }} activeOpacity={0.85}>
              <Ionicons name="send-outline" size={20} color="#fff" />
              <Text style={[s.idRequestBtnText, { fontSize: 17 * fontScale }]}>
                {idRequest ? t("acRequestAnother") : t("acRequestPhysical")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <SafetyMonitoringCard fontScale={fontScale} />

        {/* Quick actions */}
        <View style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <Ionicons name="grid-outline" size={22} color={C.primary} />
            <Text style={[s.sectionTitle, { fontSize: 17 * fontScale }]}>{t("acQuickActions")}</Text>
          </View>

          <TouchableOpacity style={s.quickAction} onPress={() => router.push("/settings")} activeOpacity={0.8}>
            <View style={[s.quickIconBox, { backgroundColor: C.primaryLight }]}>
              <Ionicons name="settings-outline" size={24} color={C.primary} />
            </View>
            <View style={s.quickText}>
              <Text style={[s.quickTitle, { fontSize: 16 * fontScale }]}>{t("acSettings")}</Text>
              <Text style={[s.quickSub, { fontSize: 14 * fontScale }]}>{t("acSettingsSub")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={s.quickAction} onPress={() => router.push("/(tabs)/help" as any)} activeOpacity={0.8}>
            <View style={[s.quickIconBox, { backgroundColor: C.primaryLight }]}>
              <Ionicons name="call-outline" size={24} color={C.primary} />
            </View>
            <View style={s.quickText}>
              <Text style={[s.quickTitle, { fontSize: 16 * fontScale }]}>{t("tileHelp")}</Text>
              <Text style={[s.quickSub, { fontSize: 14 * fontScale }]}>{t("tileHelpSub")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={s.quickAction} onPress={toggleNotification} activeOpacity={0.8}>
            <View style={[s.quickIconBox, { backgroundColor: C.warningLight }]}>
              <Ionicons name="notifications-outline" size={24} color={C.accent} />
            </View>
            <View style={s.quickText}>
              <Text style={[s.quickTitle, { fontSize: 16 * fontScale }]}>{t("acNotifs")}</Text>
              <Text style={[s.quickSub, { fontSize: 14 * fontScale }]}>{t("acNotifsSub")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.quickAction, { borderBottomWidth: 0 }]} onPress={handleLogout} activeOpacity={0.8}>
            <View style={[s.quickIconBox, { backgroundColor: C.dangerLight }]}>
              <Ionicons name="log-out-outline" size={24} color={C.danger} />
            </View>
            <View style={s.quickText}>
              <Text style={[s.quickTitle, { color: C.danger, fontSize: 16 * fontScale }]}>{t("acLogOutTitle")}</Text>
              <Text style={[s.quickSub, { fontSize: 14 * fontScale }]}>{t("acLogOutSub")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ID Request modal */}
      <Modal visible={idModalVisible} animationType="slide" transparent>
<ReadAloudRoot>
        <View style={m.overlay}>
          <View style={[m.box, { maxHeight: "92%" }]}>
            <View style={m.handle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[m.title, { fontSize: 22 * fontScale }]}>{t("acModalTitle")}</Text>
            <Text style={[m.stepText, { fontSize: 16 * fontScale }]}>
              {t("suStepOf", { n: idStep + 1, total: ID_STEPS })}
            </Text>
            <View style={m.track}>
              <View style={[m.fill, { width: `${((idStep + 1) / ID_STEPS) * 100}%` }]} />
            </View>

            {idStep === 0 && (
              <>
                <Text style={[m.sub, { fontSize: 15 * fontScale }]}>
                  {t("acModalSub")}
                </Text>

                <Text style={[m.label, { fontSize: 15 * fontScale }]}>{t("acReason")}</Text>
                <TextInput
                  placeholder={t("acReasonPh")}
                  placeholderTextColor={C.textMuted}
                  value={idReason}
                  onChangeText={setIdReason}
                  style={[m.input, { fontSize: 16 * fontScale }]}
                  multiline
                  numberOfLines={3}
                />
              </>
            )}

            {idStep === 1 && (
              <>
                <Text style={[m.label, { fontSize: 15 * fontScale }]}>{t("pkChooseTitle")}</Text>
                <Text style={[m.sub, { fontSize: 14 * fontScale, textAlign: "left", marginBottom: 12 }]}>{t("pkChooseSub")}</Text>
                <OfficeStatusBanner office={office} fontScale={fontScale} />
                <View style={{ marginBottom: 20 }}>
                  <PickupPicker office={office} value={idPickup} onChange={setIdPickup} fontScale={fontScale} />
                </View>
              </>
            )}

            {idStep === 2 && (
              <>
                <Text style={[m.reviewTitle, { fontSize: 22 * fontScale }]}>{t("suReviewTitle")}</Text>
                <Text style={[m.sub, { fontSize: 15 * fontScale, textAlign: "left" }]}>{t("suReviewHint")}</Text>
                <View style={m.reviewRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[m.reviewLabel, { fontSize: 14 * fontScale }]}>{t("acReason")}</Text>
                    <Text style={[m.reviewValue, { fontSize: 18 * fontScale }]}>{idReason.trim() || t("acRvNoReason")}</Text>
                  </View>
                  <TouchableOpacity style={m.reviewEdit} onPress={() => setIdStep(0)} accessibilityRole="button">
                    <Text style={[m.reviewEditText, { fontSize: 16 * fontScale }]}>{t("suEdit")}</Text>
                  </TouchableOpacity>
                </View>
                <View style={m.reviewRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[m.reviewLabel, { fontSize: 14 * fontScale }]}>{t("acRvTime")}</Text>
                    <Text style={[m.reviewValue, { fontSize: 18 * fontScale }]}>
                      {idPickup?.date && idPickup?.time ? formatPickup(idPickup) : t("acRvNoTime")}
                    </Text>
                  </View>
                  <TouchableOpacity style={m.reviewEdit} onPress={() => setIdStep(1)} accessibilityRole="button">
                    <Text style={[m.reviewEditText, { fontSize: 16 * fontScale }]}>{t("suEdit")}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[m.submitBtn, { marginTop: 8 }, idSubmitting && { opacity: 0.65 }]}
                  onPress={submitIDRequestHandler}
                  disabled={idSubmitting}
                  activeOpacity={0.85}
                >
                  {idSubmitting
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="send-outline" size={20} color="#fff" />
                        <Text style={[m.submitText, { fontSize: 17 * fontScale }]}>{t("acSubmitRequest")}</Text>
                      </>
                  }
                </TouchableOpacity>
              </>
            )}

            <View style={m.navRow}>
              {idStep > 0 && (
                <TouchableOpacity
                  style={m.navBack}
                  onPress={() => setIdStep((n) => Math.max(n - 1, 0))}
                  disabled={idSubmitting}
                  accessibilityRole="button"
                >
                  <Text style={[m.navBackText, { fontSize: 18 * fontScale }]}>{t("backBtn")}</Text>
                </TouchableOpacity>
              )}
              {idStep < ID_STEPS - 1 && (
                <TouchableOpacity style={m.navNext} onPress={idNextStep} accessibilityRole="button">
                  <Text style={[m.navNextText, { fontSize: 18 * fontScale }]}>{t("suNext")}</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={m.cancelBtn}
              onPress={() => setIdModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={[m.cancelText, { fontSize: 16 * fontScale }]}>{t("cancel")}</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </ReadAloudRoot>
</Modal>

      {/* Change the City Hall pickup time of the current request */}
      {idRequest && (
        <PickupModal
          visible={pickupModalOpen}
          onClose={() => setPickupModalOpen(false)}
          requestId={idRequest.id}
          current={idRequest.pickup}
          office={office}
          fontScale={fontScale}
        />
      )}

      {/* Notification panel */}
      {showNotif && (
        <>
          <TouchableOpacity style={n.backdrop} activeOpacity={1} onPress={toggleNotification} />
          <Animated.View style={[n.panel, { transform: [{ translateX: slideAnim }] }]}>
            <View style={n.panelHeader}>
              <Text style={[n.panelTitle, { fontSize: 22 * fontScale }]}>{t("acNotifs")}</Text>
              <TouchableOpacity onPress={toggleNotification}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={30} color={C.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[n.sectionLabel, { fontSize: 14 * fontScale }]}>{t("acJoinedEvents")}</Text>
              {joinedEvents.length === 0 ? (
                <View style={n.emptyBox}>
                  <Ionicons name="calendar-outline" size={32} color={C.textMuted} />
                  <Text style={[n.emptyText, { fontSize: 15 * fontScale }]}>{t("acNoJoined")}</Text>
                </View>
              ) : (
                joinedEvents.map((e) => (
                  <View key={e.id} style={n.notifCard}>
                    <Text style={[n.notifCardTitle, { fontSize: 16 * fontScale }]}>{e.title}</Text>
                    <View style={n.notifCardMetaRow}>
                      <Ionicons name="calendar-outline" size={15} color={C.textSub} />
                      <Text style={[n.notifCardSub, { fontSize: 14 * fontScale }]}>{new Date(e.date).toLocaleString()}</Text>
                    </View>
                    <View style={n.notifCardMetaRow}>
                      <Ionicons name="location-outline" size={15} color={C.textSub} />
                      <Text style={[n.notifCardSub, { fontSize: 14 * fontScale }]}>{e.location}</Text>
                    </View>
                  </View>
                ))
              )}

              <Text style={[n.sectionLabel, { fontSize: 14 * fontScale }]}>{t("acSystemAlerts")}</Text>
              {notifications.length === 0 ? (
                <View style={n.emptyBox}>
                  <Ionicons name="notifications-off-outline" size={32} color={C.textMuted} />
                  <Text style={[n.emptyText, { fontSize: 15 * fontScale }]}>{t("acNoAlerts")}</Text>
                </View>
              ) : (
                notifications.map((notif) => (
                  <View key={notif.id}
                    style={[n.notifCard, { backgroundColor: notif.type === "SOS" ? C.dangerLight : C.primaryLight }]}>
                    <View style={n.notifCardMetaRow}>
                      <Ionicons
                        name={notif.type === "SOS" ? "warning" : "notifications"}
                        size={16}
                        color={notif.type === "SOS" ? C.danger : C.primary}
                      />
                      <Text style={[n.notifCardTitle, { fontSize: 16 * fontScale }]}>
                        {notif.type === "SOS" ? t("acEmergencyAlert") : t("acNotification")}
                      </Text>
                    </View>
                    <Text style={[n.notifCardSub, { fontSize: 14 * fontScale }]}>{notif.message}</Text>
                    <Text style={[n.notifCardTime, { fontSize: 14 * fontScale }]}>{new Date(notif.timestamp).toLocaleString()}</Text>
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

// Styles

const makeS = (C: Colors) => StyleSheet.create({
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
  iconBtn: { padding: 10, borderRadius: 10, minWidth: 52, minHeight: 52, alignItems: "center", justifyContent: "center" },
  logoutBtn: { marginLeft: 4 },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },

  // Hero card
  heroCard: {
    borderWidth: 1.5,
    borderColor: C.outline,
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
  removePhotoText: { color: C.danger, fontSize: 14, fontWeight: "600" },

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
  pendingNoteText: { fontSize: 14, color: C.warning, lineHeight: 19, fontWeight: "500" },

  // Section card
  sectionCard: {
    borderWidth: 1.5,
    borderColor: C.outline,
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

  // QR code card
  qrDescription: {
    fontSize:   15,
    color:      C.textSub,
    lineHeight: 22,
    marginBottom: 18,
  },
  qrWrapper: {
    alignSelf: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  qrIdLabel: {
    textAlign: "center",
    marginTop: 14,
    fontSize: 14,
    fontWeight: "700",
    color: C.textSub,
    letterSpacing: 0.5,
  },

  // ID description
  idDescription: {
    fontSize:   15,
    color:      C.textSub,
    lineHeight: 22,
    marginBottom: 18,
  },
  idTrackerBox: { marginTop: 4, marginBottom: 12 },
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
  quickSub:   { fontSize: 14, color: C.textSub },
});

// Modal styles
const makeM = (C: Colors) => StyleSheet.create({
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

  // Step-by-step request form
  stepText: { fontSize: 16, fontWeight: "700", color: C.textSub, textAlign: "center", marginBottom: 8 },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: C.border,
    overflow: "hidden",
    marginBottom: 18,
  },
  fill: { height: "100%", backgroundColor: C.primary },
  navRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  navBack: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  navBackText: { color: C.primary, fontSize: 18, fontWeight: "800" },
  navNext: {
    flex: 2,
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  navNextText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  reviewTitle: { fontSize: 22, fontWeight: "800", color: C.text, marginBottom: 6 },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  reviewLabel: { fontSize: 14, fontWeight: "700", color: C.textMuted, marginBottom: 2 },
  reviewValue: { fontSize: 18, fontWeight: "700", color: C.text, lineHeight: 24 },
  reviewEdit: {
    minHeight: 48,
    minWidth: 84,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  reviewEditText: { fontSize: 16, fontWeight: "800", color: C.primary },
});

// Notification panel styles
const makeN = (C: Colors) => StyleSheet.create({
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
    fontSize: 14,
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
  notifCardMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  notifCardTitle: { fontSize: 16, fontWeight: "700", color: C.text,    marginBottom: 4 },
  notifCardSub:   { fontSize: 14, color: C.textSub,  marginBottom: 2 },
  notifCardTime:  { fontSize: 14, color: C.textMuted, marginTop: 4 },
});

// Guests ("Bisita") get a friendly login/sign-up card instead of an empty profile.
export default function Account() {
  const { user, isGuest } = useAuth();
  if (!user || isGuest) return <GuestAccount />;
  return <AccountInner />;
}
