import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { registerUser, submitIDRequest } from "@/lib/firebase";
import { DISTRICT_1_BARANGAYS, DISTRICT_2_BARANGAYS } from "@/constants/barangays";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Signup() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { t } = useSettings();

  // Block signup if a user is already logged in (can be reached via deep link).
  useEffect(() => {
    if (user) {
      Alert.alert(
        t("alreadySignedInTitle"),
        `${t("alreadySignedInPrefix")} ${`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.idNumber}. ${t("pleaseLogOutFirst")}`,
      );
      router.replace("/");
    }
  }, [user]);

  const [idImage, setIdImage] = useState<any>(null);
  const [firstName, setFirstName] = useState("");
  const [midName, setMidName] = useState("");
  const [lastName, setLastName] = useState("");
  const [district, setDistrict] = useState("");
  const [barangay, setBarangay] = useState("");
  const [street, setStreet] = useState("");
  const [conNumber, setConNumber] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [dobDate, setDobDate] = useState(new Date(1960, 0, 1));
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);

  const [hasSciaId, setHasSciaId] = useState<null | boolean>(null);
  const [idRequestLoading, setIdRequestLoading] = useState(false);
  const [idRequestReason, setIdRequestReason] = useState("");

  const barangayOptions =
    district === "District 1" ? DISTRICT_1_BARANGAYS
    : district === "District 2" ? DISTRICT_2_BARANGAYS
    : [];

  const fullAddress = street && barangay
    ? `${street}, Brgy. ${barangay}, Valenzuela City`
    : "";

  const pickIdImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (!result.canceled) {
      setIdImage(result.assets[0]);
    }
  };

  const formatDisplayDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const formatStoredDate = (date: Date) => date.toLocaleDateString();

  const handleSignup = async () => {
    if (user) {
      Alert.alert(
        t("alreadySignedInTitle"),
        `${t("alreadySignedInPrefix")} ${`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.idNumber}. ${t("pleaseLogOutFirst")}`,
      );
      return;
    }
    if (
      !firstName ||
      !midName ||
      !lastName ||
      !district ||
      !barangay ||
      !street ||
      !conNumber ||
      !dob ||
      !gender ||
      !password
    ) {
      Alert.alert("Missing Fields", "Please fill in all required fields.");
      return;
    }
    setLoading(true);
    try {
      await registerUser({
        firstName,
        midName,
        lastName,
        district,
        barangay,
        street,
        address: fullAddress,
        conNumber,
        gender,
        dob,
        idNumber: idNumber || "",
        password,
        imageBase64: idImage?.base64 ?? undefined,
      });
      await refreshUser();
      router.replace("/(tabs)/home");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestId = async () => {
    if (!idRequestReason.trim()) {
      Alert.alert(
        "Reason Required",
        "Please enter the reason for requesting a physical ID.",
      );
      return;
    }
    setIdRequestLoading(true);
    try {
      await submitIDRequest({
        seniorName: `${firstName} ${midName} ${lastName}`.trim(),
        seniorId: idNumber || "Not yet assigned",
        address: fullAddress,
        contactNumber: conNumber,
        reason: idRequestReason.trim(),
        imageBase64: idImage?.base64,
      });
      Alert.alert(
        "Request Submitted",
        "Your Senior Citizen ID request has been sent to the admin.",
        [{ text: "OK" }],
      );
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Could not submit ID request.");
    } finally {
      setIdRequestLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerSection}>
          <View style={styles.headerAccent} />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Register as a Senior Citizen</Text>
          <View style={styles.pendingNotice}>
            <Text style={styles.pendingNoticeText}>
              All new accounts require admin verification before full access is
              granted.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Personal Information</Text>
        <View style={styles.inputGroup}>
          <TextInput
            placeholder="First Name *"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            placeholder="Middle Name *"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={midName}
            onChangeText={setMidName}
          />
          <TextInput
            placeholder="Last Name *"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
          />
          <TextInput
            placeholder="Contact Number *"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={conNumber}
            onChangeText={setConNumber}
            keyboardType="phone-pad"
          />
        </View>

        <Text style={styles.sectionLabel}>District *</Text>
        <View style={styles.genderRow}>
          {["District 1", "District 2"].map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.genderOption, district === d && styles.genderOptionActive]}
              onPress={() => { setDistrict(d); setBarangay(""); }}
            >
              <Text style={[styles.genderText, district === d && styles.genderTextActive]}>
                {d}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Barangay *</Text>
        <View style={styles.pickerBox}>
          <Picker
            selectedValue={barangay}
            onValueChange={setBarangay}
            enabled={district.length > 0}
            style={{ height: 56 }}
          >
            <Picker.Item
              label={district ? "Select barangay" : "Select a district first"}
              value=""
            />
            {barangayOptions.map((b: string) => (
              <Picker.Item key={b} label={b} value={b} />
            ))}
          </Picker>
        </View>

        <Text style={styles.sectionLabel}>Street / House No. *</Text>
        <TextInput
          placeholder="e.g. 123 Rizal St."
          placeholderTextColor="#6B7280"
          style={styles.input}
          value={street}
          onChangeText={setStreet}
        />

        <Text style={styles.sectionLabel}>Date of Birth *</Text>
        <TouchableOpacity
          style={styles.dobButton}
          onPress={() => setShowDobPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.dobButtonText, !dob && styles.placeholder]}>
            {dob ? formatDisplayDate(dobDate) : "Select your date of birth"}
          </Text>
          <Text style={styles.dobChevron}>›</Text>
        </TouchableOpacity>

        {showDobPicker && (
          <DateTimePicker
            value={dobDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
            minimumDate={new Date(1920, 0, 1)}
            onChange={(event, selectedDate) => {
              if (Platform.OS === "android") setShowDobPicker(false);
              if (selectedDate) {
                setDobDate(selectedDate);
                setDob(formatStoredDate(selectedDate));
              }
            }}
          />
        )}
        {Platform.OS === "ios" && showDobPicker && (
          <TouchableOpacity
            style={styles.dobConfirmButton}
            onPress={() => setShowDobPicker(false)}
          >
            <Text style={styles.dobConfirmText}>Confirm Date</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>Gender *</Text>
        <View style={styles.genderRow}>
          {["Male", "Female"].map((g) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.genderOption,
                gender === g && styles.genderOptionActive,
              ]}
              onPress={() => setGender(g)}
            >
              <Text
                style={[
                  styles.genderText,
                  gender === g && styles.genderTextActive,
                ]}
              >
                {g}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Account Details</Text>
        <View style={styles.inputGroup}>
          <View style={styles.optionalWrapper}>
            <TextInput
              placeholder="Senior Citizen ID Number"
              placeholderTextColor="#6B7280"
              style={[styles.input, { paddingRight: 90 }]}
              value={idNumber}
              onChangeText={setIdNumber}
            />
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalBadgeText}>Optional</Text>
            </View>
          </View>
          <TextInput
            placeholder="Password *"
            placeholderTextColor="#6B7280"
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <Text style={styles.sectionLabel}>Upload Senior Citizen ID Photo</Text>
        <TouchableOpacity
          style={styles.uploadCard}
          onPress={pickIdImage}
          activeOpacity={0.7}
        >
          {idImage ? (
            <>
              <Image source={{ uri: idImage.uri }} style={styles.idPreview} />
              <Text style={styles.uploadChangeText}>Tap to change photo</Text>
            </>
          ) : (
            <>
              <View style={styles.uploadIconBox}>
                <Text style={styles.uploadIconText}>ID</Text>
              </View>
              <Text style={styles.uploadTitle}>Upload ID Photo</Text>
              <Text style={styles.uploadHint}>
                Only ID photos accepted. Tap to select.
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.noIdSection}>
          <Text style={styles.noIdQuestion}>
            Don't have a Senior Citizen ID yet?
          </Text>
          <Text style={styles.noIdSubtitle}>
            Are you already registered with OSCA?
          </Text>

          {hasSciaId === null && (
            <View style={styles.idAnswerRow}>
              <TouchableOpacity
                style={styles.idAnswerYes}
                onPress={() => setHasSciaId(true)}
              >
                <Text style={styles.idAnswerYesText}>Yes, I'm registered</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.idAnswerNo}
                onPress={() => setHasSciaId(false)}
              >
                <Text style={styles.idAnswerNoText}>No, I'm not</Text>
              </TouchableOpacity>
            </View>
          )}

          {hasSciaId === true && (
            <View style={styles.idActionCard}>
              <Text style={styles.idActionText}>
                You can request your Senior Citizen ID from the admin.
              </Text>
              <TextInput
                placeholder="Reason for requesting physical ID *"
                placeholderTextColor="#6B7280"
                style={styles.reasonInput}
                value={idRequestReason}
                onChangeText={setIdRequestReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={styles.requestIdButton}
                onPress={handleRequestId}
                disabled={idRequestLoading}
                activeOpacity={0.8}
              >
                {idRequestLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.requestIdButtonText}>
                    Request ID from Admin
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHasSciaId(null)}>
                <Text style={styles.changeAnswerText}>Change answer</Text>
              </TouchableOpacity>
            </View>
          )}

          {hasSciaId === false && (
            <View style={styles.idActionCard}>
              <Text style={styles.idActionText}>
                You can still create an account, but it will be unverified until
                the admin approves you.
              </Text>
              <TouchableOpacity
                style={styles.oscaButton}
                onPress={() => Linking.openURL("https://www.osca.gov.ph/")}
                activeOpacity={0.8}
              >
                <Text style={styles.oscaButtonText}>Register at OSCA</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHasSciaId(null)}>
                <Text style={styles.changeAnswerText}>Change answer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.createButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F3F4F6" },
  scrollView: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  headerSection: { alignItems: "center", marginBottom: 24, paddingTop: 8 },
  headerAccent: {
    width: 50,
    height: 5,
    backgroundColor: "#2356E1",
    borderRadius: 3,
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 0.3,
  },
  subtitle: { fontSize: 16, color: "#4B5563", marginTop: 4 },
  pendingNotice: {
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  pendingNoticeText: {
    fontSize: 15,
    color: "#7A3B00",
    textAlign: "center",
    lineHeight: 21,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1D4ED8",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 22,
  },
  inputGroup: { gap: 12 },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    fontSize: 17,
    color: "#111827",
    minHeight: 52,
  },
  pickerBox: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 4,
  },
  optionalWrapper: { position: "relative" },
  optionalBadge: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  optionalBadgeText: { fontSize: 13, color: "#6B7280", fontStyle: "italic" },
  dobButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
  },
  dobButtonText: { fontSize: 17, color: "#111827" },
  placeholder: { color: "#6B7280" },
  dobChevron: { fontSize: 24, color: "#6B7280", lineHeight: 26 },
  dobConfirmButton: {
    backgroundColor: "#2356E1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  dobConfirmText: { color: "white", fontWeight: "700", fontSize: 15 },
  genderRow: { flexDirection: "row", gap: 12 },
  genderOption: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  genderOptionActive: { borderColor: "#1D4ED8", backgroundColor: "#EEF2FF" },
  genderText: { fontSize: 17, color: "#374151", fontWeight: "600" },
  genderTextActive: { color: "#1D4ED8" },
  uploadCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#9CA3AF",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 140,
  },
  uploadIconBox: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  uploadIconText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1D4ED8",
    letterSpacing: 1,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  uploadHint: { fontSize: 15, color: "#6B7280", textAlign: "center" },
  idPreview: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    resizeMode: "cover",
  },
  uploadChangeText: {
    fontSize: 15,
    color: "#1D4ED8",
    marginTop: 8,
    fontWeight: "600",
  },
  noIdSection: {
    marginTop: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
  },
  noIdQuestion: {
    fontSize: 17,
    fontWeight: "800",
    color: "#374151",
    textAlign: "center",
    marginBottom: 4,
  },
  noIdSubtitle: {
    fontSize: 15,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 16,
  },
  idAnswerRow: { flexDirection: "row", gap: 12, width: "100%" },
  idAnswerYes: {
    flex: 1,
    backgroundColor: "#EEF2FF",
    borderWidth: 1.5,
    borderColor: "#1D4ED8",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  idAnswerNo: {
    flex: 1,
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#DC2626",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  idAnswerYesText: { fontSize: 15, fontWeight: "700", color: "#1D4ED8" },
  idAnswerNoText: { fontSize: 15, fontWeight: "700", color: "#DC2626" },
  idActionCard: { alignItems: "center", gap: 12, width: "100%" },
  idActionText: {
    fontSize: 15,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 21,
  },
  reasonInput: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    color: "#111827",
    minHeight: 90,
  },
  requestIdButton: {
    backgroundColor: "#1D4ED8",
    borderRadius: 12,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  requestIdButtonText: { color: "white", fontWeight: "700", fontSize: 17 },
  oscaButton: {
    backgroundColor: "#047857",
    borderRadius: 12,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  oscaButtonText: { color: "white", fontWeight: "700", fontSize: 17 },
  changeAnswerText: {
    fontSize: 14,
    color: "#4B5563",
    textDecorationLine: "underline",
  },
  createButton: {
    backgroundColor: "#1D4ED8",
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
    minHeight: 56,
    justifyContent: "center",
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  createButtonDisabled: { opacity: 0.6 },
  createButtonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 19,
    letterSpacing: 0.3,
  },
});
