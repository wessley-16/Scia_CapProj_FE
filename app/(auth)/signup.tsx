import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
// Note: @react-native-picker/picker no longer used (replaced with tap-to-select gender buttons)
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
// 🔥 Firebase — replaces http://10.174.101.153:3000/api/users/register
import { registerUser, submitIDRequest } from "@/lib/firebase";

export default function Signup() {
  const router = useRouter();

  const [idImage, setIdImage] = useState<any>(null);
  const [firstName, setFirstName] = useState("");
  const [midName, setMidName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [conNumber, setConNumber] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [dobDate, setDobDate] = useState(new Date(1960, 0, 1));
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);

  // ID registration flow
  const [hasSciaId, setHasSciaId] = useState<null | boolean>(null);
  const [idRequestLoading, setIdRequestLoading] = useState(false);

  const pickIdImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library to upload an ID.");
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

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatStoredDate = (date: Date) => {
    return date.toLocaleDateString();
  };

  const handleSignup = async () => {
    if (!firstName || !midName || !lastName || !address || !conNumber || !dob || !gender || !password) {
      Alert.alert("Missing Fields", "Please fill in all required fields.");
      return;
    }
    setLoading(true);
    try {
      const user = await registerUser({
        firstName,
        midName,
        lastName,
        address,
        conNumber,
        gender,
        dob,
        idNumber: idNumber || "",
        password,
        imageBase64: idImage?.base64 ?? undefined,
      });
      router.replace({
        pathname: "/account",
        params: { ...user, name: `${firstName} ${lastName}` },
      });
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestId = async () => {
    setIdRequestLoading(true);
    try {
      await submitIDRequest({
        seniorName: `${firstName} ${midName} ${lastName}`.trim(),
        seniorId: idNumber || "Not yet assigned",
        address,
        contactNumber: conNumber,
        reason: "Requesting Senior Citizen ID card from admin",
        imageBase64: idImage?.base64,
      });
      Alert.alert(
        "Request Submitted ✓",
        "Your Senior Citizen ID request has been sent to the admin. They will contact you shortly.",
        [{ text: "OK" }]
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
        {/* Header */}
        <View style={styles.headerSection}>
          <View style={styles.headerAccent} />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Register as a Senior Citizen</Text>
        </View>

        {/* Personal Info */}
        <Text style={styles.sectionLabel}>Personal Information</Text>
        <View style={styles.inputGroup}>
          <TextInput
            placeholder="First Name *"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            placeholder="Middle Name *"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={midName}
            onChangeText={setMidName}
          />
          <TextInput
            placeholder="Last Name *"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
          />
          <TextInput
            placeholder="Address *"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={address}
            onChangeText={setAddress}
          />
          <TextInput
            placeholder="Contact Number *"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={conNumber}
            onChangeText={setConNumber}
            keyboardType="phone-pad"
          />
        </View>

        {/* Date of Birth */}
        <Text style={styles.sectionLabel}>Date of Birth *</Text>
        <TouchableOpacity
          style={styles.dobButton}
          onPress={() => setShowDobPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.dobButtonText, !dob && styles.placeholder]}>
            {dob ? formatDisplayDate(dobDate) : "Select your date of birth"}
          </Text>
          <Text style={styles.dobIcon}>📅</Text>
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

        {/* Gender */}
        <Text style={styles.sectionLabel}>Gender *</Text>
        <View style={styles.genderRow}>
          {["Male", "Female"].map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.genderOption, gender === g && styles.genderOptionActive]}
              onPress={() => setGender(g)}
            >
              <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                {g === "Male" ? "👨 Male" : "👩 Female"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Account Details */}
        <Text style={styles.sectionLabel}>Account Details</Text>
        <View style={styles.inputGroup}>
          <View style={styles.optionalWrapper}>
            <TextInput
              placeholder="Senior Citizen ID Number"
              placeholderTextColor="#9CA3AF"
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
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {/* Upload ID Photo */}
        <Text style={styles.sectionLabel}>Upload Senior Citizen ID Photo</Text>
        <TouchableOpacity style={styles.uploadCard} onPress={pickIdImage} activeOpacity={0.7}>
          {idImage ? (
            <>
              <Image source={{ uri: idImage.uri }} style={styles.idPreview} />
              <Text style={styles.uploadChangeText}>Tap to change photo</Text>
            </>
          ) : (
            <>
              <Text style={styles.uploadIcon}>🪪</Text>
              <Text style={styles.uploadTitle}>Upload ID Photo</Text>
              <Text style={styles.uploadHint}>Only ID photos accepted — tap to select</Text>
            </>
          )}
        </TouchableOpacity>

        {/* No ID Section */}
        <View style={styles.noIdSection}>
          <Text style={styles.noIdQuestion}>Don't have a Senior Citizen ID yet?</Text>
          <Text style={styles.noIdSubtitle}>Are you already registered with OSCA?</Text>

          {hasSciaId === null && (
            <View style={styles.idAnswerRow}>
              <TouchableOpacity
                style={styles.idAnswerYes}
                onPress={() => setHasSciaId(true)}
              >
                <Text style={styles.idAnswerYesText}>✅  Yes, I'm registered</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.idAnswerNo}
                onPress={() => setHasSciaId(false)}
              >
                <Text style={styles.idAnswerNoText}>❌  No, I'm not</Text>
              </TouchableOpacity>
            </View>
          )}

          {hasSciaId === true && (
            <View style={styles.idActionCard}>
              <Text style={styles.idActionText}>
                Great! You can request your Senior Citizen ID from the admin. Fill in your details above and tap below.
              </Text>
              <TouchableOpacity
                style={styles.requestIdButton}
                onPress={handleRequestId}
                disabled={idRequestLoading}
                activeOpacity={0.8}
              >
                {idRequestLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.requestIdButtonText}>📋  Request ID from Admin</Text>
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
                No problem! You can still create an account, but it will be unverified until you get your Senior Citizen ID. You can register with OSCA below.
              </Text>
              <TouchableOpacity
                style={styles.oscaButton}
                onPress={() => Linking.openURL("https://www.osca.gov.ph/")}
                activeOpacity={0.8}
              >
                <Text style={styles.oscaButtonText}>🏛️  Register at OSCA Now</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHasSciaId(null)}>
                <Text style={styles.changeAnswerText}>Change answer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Create Account Button */}
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
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  scrollView: { flex: 1 },
  container: {
    padding: 20,
    paddingBottom: 40,
  },

  // Header
  headerSection: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 8,
  },
  headerAccent: {
    width: 50,
    height: 5,
    backgroundColor: "#2356E1",
    borderRadius: 3,
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },

  // Section Labels
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2356E1",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 20,
  },

  // Inputs
  inputGroup: { gap: 10 },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 15,
    color: "#111827",
  },
  optionalWrapper: { position: "relative" },
  optionalBadge: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  optionalBadgeText: {
    fontSize: 11,
    color: "#9CA3AF",
    fontStyle: "italic",
  },

  // DOB
  dobButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dobButtonText: { fontSize: 15, color: "#111827" },
  placeholder: { color: "#9CA3AF" },
  dobIcon: { fontSize: 18 },
  dobConfirmButton: {
    backgroundColor: "#2356E1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  dobConfirmText: { color: "white", fontWeight: "700", fontSize: 15 },

  // Gender
  genderRow: { flexDirection: "row", gap: 12 },
  genderOption: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  genderOptionActive: {
    borderColor: "#2356E1",
    backgroundColor: "#EEF2FF",
  },
  genderText: { fontSize: 15, color: "#6B7280", fontWeight: "600" },
  genderTextActive: { color: "#2356E1" },

  // Upload
  uploadCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 130,
  },
  uploadIcon: { fontSize: 40, marginBottom: 8 },
  uploadTitle: { fontSize: 16, fontWeight: "700", color: "#374151", marginBottom: 4 },
  uploadHint: { fontSize: 13, color: "#9CA3AF" },
  idPreview: { width: "100%", height: 160, borderRadius: 10, resizeMode: "cover" },
  uploadChangeText: { fontSize: 13, color: "#2356E1", marginTop: 8, fontWeight: "600" },

  // No ID Section
  noIdSection: {
    marginTop: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  noIdQuestion: {
    fontSize: 15,
    fontWeight: "800",
    color: "#374151",
    textAlign: "center",
    marginBottom: 4,
  },
  noIdSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  idAnswerRow: { flexDirection: "row", gap: 12, width: "100%" },
  idAnswerYes: {
    flex: 1,
    backgroundColor: "#EEF2FF",
    borderWidth: 1.5,
    borderColor: "#2356E1",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  idAnswerNo: {
    flex: 1,
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#EF4444",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  idAnswerYesText: { fontSize: 13, fontWeight: "700", color: "#2356E1" },
  idAnswerNoText: { fontSize: 13, fontWeight: "700", color: "#EF4444" },

  idActionCard: { alignItems: "center", gap: 12, width: "100%" },
  idActionText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  requestIdButton: {
    backgroundColor: "#2356E1",
    borderRadius: 12,
    paddingVertical: 13,
    width: "100%",
    alignItems: "center",
  },
  requestIdButtonText: { color: "white", fontWeight: "700", fontSize: 15 },
  oscaButton: {
    backgroundColor: "#059669",
    borderRadius: 12,
    paddingVertical: 13,
    width: "100%",
    alignItems: "center",
  },
  oscaButtonText: { color: "white", fontWeight: "700", fontSize: 15 },
  changeAnswerText: {
    fontSize: 12,
    color: "#9CA3AF",
    textDecorationLine: "underline",
  },

  // Create Button
  createButton: {
    backgroundColor: "#2356E1",
    padding: 17,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#2356E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  createButtonDisabled: { opacity: 0.6 },
  createButtonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: 0.3,
  },
});
