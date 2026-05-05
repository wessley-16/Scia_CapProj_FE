import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
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
// 🔥 Firebase — registerUser + submitIDRequest
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

  // "Don't have an ID yet?" flow
  const [hasRegisteredScId, setHasRegisteredScId] = useState<null | boolean>(null);
  const [requestingId, setRequestingId] = useState(false);

  const pickIdImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library to upload an ID.");
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
    return date.toLocaleDateString("en-PH", {
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
        firstName, midName, lastName, address, conNumber,
        gender, dob,
        idNumber: idNumber.trim() || "UNVERIFIED",
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
    if (!firstName || !lastName || !address || !conNumber) {
      Alert.alert("Required", "Please fill in your name, address, and contact number first.");
      return;
    }
    setRequestingId(true);
    try {
      await submitIDRequest({
        seniorName: `${firstName} ${midName ? midName + " " : ""}${lastName}`,
        seniorId: "PENDING",
        address,
        contactNumber: conNumber,
        reason: "Senior Citizen ID Request via App",
        imageBase64: idImage?.base64 ?? undefined,
      });
      Alert.alert(
        "Request Submitted ✅",
        "Your ID request has been sent to the admin. You will be notified once it is processed.",
        [{ text: "OK" }]
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to submit request.");
    } finally {
      setRequestingId(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── HEADER ── */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Fill in your details to get started</Text>
        </View>

        {/* ── PERSONAL INFO CARD ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Personal Information</Text>

          <TextInput
            placeholder="First Name *"
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            placeholderTextColor="#9CA3AF"
          />
          <TextInput
            placeholder="Middle Name *"
            style={styles.input}
            value={midName}
            onChangeText={setMidName}
            autoCapitalize="words"
            placeholderTextColor="#9CA3AF"
          />
          <TextInput
            placeholder="Last Name *"
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            placeholderTextColor="#9CA3AF"
          />
          <TextInput
            placeholder="Address *"
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            autoCapitalize="words"
            placeholderTextColor="#9CA3AF"
          />
          <TextInput
            placeholder="Contact Number *"
            style={styles.input}
            value={conNumber}
            onChangeText={setConNumber}
            keyboardType="phone-pad"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* ── DATE OF BIRTH + GENDER CARD ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Birth Details</Text>

          {/* DATE OF BIRTH — improved UI */}
          <TouchableOpacity
            style={styles.dobButton}
            onPress={() => setShowDobPicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.dobIconBox}>
              <Text style={styles.dobIcon}>📅</Text>
            </View>
            <View style={styles.dobTextBox}>
              <Text style={styles.dobLabel}>Date of Birth *</Text>
              <Text style={[styles.dobValue, !dob && styles.dobPlaceholder]}>
                {dob ? formatDisplayDate(dobDate) : "Tap to select"}
              </Text>
            </View>
          </TouchableOpacity>

          {showDobPicker && (
            <DateTimePicker
              value={dobDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()}
              minimumDate={new Date(1920, 0, 1)}
              onChange={(event, selectedDate) => {
                setShowDobPicker(Platform.OS === "ios");
                if (selectedDate) {
                  setDobDate(selectedDate);
                  setDob(formatStoredDate(selectedDate));
                }
              }}
            />
          )}

          {/* GENDER PICKER */}
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={gender}
              onValueChange={(itemValue) => setGender(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Select Gender *" value="" color="#9CA3AF" />
              <Picker.Item label="Male" value="Male" />
              <Picker.Item label="Female" value="Female" />
            </Picker>
          </View>
        </View>

        {/* ── ACCOUNT SECURITY CARD ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Account Security</Text>

          <View style={styles.optionalRow}>
            <TextInput
              placeholder="Senior Citizen ID Number"
              style={[styles.input, styles.optionalInput]}
              value={idNumber}
              onChangeText={setIdNumber}
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalBadgeText}>Optional</Text>
            </View>
          </View>
          <Text style={styles.optionalHint}>
            You can register without an ID. Your account will be unverified until an ID is provided.
          </Text>

          <TextInput
            placeholder="Password *"
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* ── UPLOAD ID CARD ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Upload Government ID</Text>
          <Text style={styles.uploadHint}>Only valid government-issued IDs are accepted</Text>

          <TouchableOpacity style={styles.uploadBox} onPress={pickIdImage} activeOpacity={0.8}>
            {idImage ? (
              <>
                <Image source={{ uri: idImage.uri }} style={styles.idPreview} />
                <Text style={styles.retakeText}>Tap to change</Text>
              </>
            ) : (
              <>
                <Text style={styles.uploadIcon}>🪪</Text>
                <Text style={styles.uploadBoxText}>Tap to upload ID photo</Text>
                <Text style={styles.uploadBoxSub}>JPEG or PNG • Max 5MB</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── DON'T HAVE AN ID? SECTION ── */}
        <View style={styles.noIdCard}>
          <Text style={styles.noIdTitle}>Don't have an ID yet?</Text>

          {hasRegisteredScId === null && (
            <Text style={styles.noIdQuestion}>
              Have you already registered for a Senior Citizen ID at OSCA?
            </Text>
          )}

          {hasRegisteredScId === null && (
            <View style={styles.noIdButtons}>
              <TouchableOpacity
                style={[styles.noIdChoice, styles.noIdYes]}
                onPress={() => setHasRegisteredScId(true)}
              >
                <Text style={styles.noIdChoiceText}>✅  Yes, I have</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.noIdChoice, styles.noIdNo]}
                onPress={() => setHasRegisteredScId(false)}
              >
                <Text style={styles.noIdChoiceText}>❌  Not yet</Text>
              </TouchableOpacity>
            </View>
          )}

          {hasRegisteredScId === true && (
            <View style={styles.noIdAnswer}>
              <Text style={styles.noIdAnswerText}>
                Great! You can request your physical ID through the app. Admin will process it for you.
              </Text>
              <TouchableOpacity
                style={styles.requestIdButton}
                onPress={handleRequestId}
                disabled={requestingId}
              >
                {requestingId ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.requestIdText}>📨  Request ID from Admin</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHasRegisteredScId(null)}>
                <Text style={styles.changeAnswerText}>Change answer</Text>
              </TouchableOpacity>
            </View>
          )}

          {hasRegisteredScId === false && (
            <View style={styles.noIdAnswer}>
              <Text style={styles.noIdAnswerText}>
                You need to register at your local OSCA office first. Tap below to go to the official registration page.
              </Text>
              <TouchableOpacity
                style={styles.oscaButton}
                onPress={() => Linking.openURL("https://www.ncsc.gov.ph/")}
              >
                <Text style={styles.oscaButtonText}>🌐  Register at OSCA / NCSC</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHasRegisteredScId(null)}>
                <Text style={styles.changeAnswerText}>Change answer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── CREATE ACCOUNT BUTTON ── */}
        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="white" />
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
  scrollView: {
    flex: 1,
  },
  container: {
    padding: 16,
  },

  // Header
  headerContainer: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },

  // Cards
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2356E1",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // Inputs
  input: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
    fontSize: 15,
    backgroundColor: "#FAFAFA",
    color: "#111827",
  },

  // DOB
  dobButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FAFAFA",
    marginBottom: 10,
  },
  dobIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  dobIcon: {
    fontSize: 22,
  },
  dobTextBox: {
    flex: 1,
  },
  dobLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 2,
  },
  dobValue: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  dobPlaceholder: {
    color: "#9CA3AF",
    fontWeight: "400",
  },

  // Gender picker
  pickerWrapper: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    overflow: "hidden",
  },
  picker: {
    height: 52,
    color: "#111827",
  },

  // Optional ID
  optionalRow: {
    position: "relative",
  },
  optionalInput: {
    paddingRight: 85,
    marginBottom: 4,
  },
  optionalBadge: {
    position: "absolute",
    right: 10,
    top: 14,
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  optionalBadgeText: {
    fontSize: 11,
    color: "#92400E",
    fontWeight: "700",
  },
  optionalHint: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 10,
    lineHeight: 17,
  },

  // Upload
  uploadHint: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 10,
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  uploadIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  uploadBoxText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  uploadBoxSub: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  idPreview: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    resizeMode: "cover",
  },
  retakeText: {
    marginTop: 8,
    fontSize: 13,
    color: "#2356E1",
    fontWeight: "600",
  },

  // No-ID section
  noIdCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#FBBF24",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  noIdTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 10,
  },
  noIdQuestion: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 20,
  },
  noIdButtons: {
    flexDirection: "row",
    gap: 10,
  },
  noIdChoice: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  noIdYes: {
    backgroundColor: "#D1FAE5",
    borderWidth: 1.5,
    borderColor: "#34D399",
  },
  noIdNo: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1.5,
    borderColor: "#F87171",
  },
  noIdChoiceText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  noIdAnswer: {
    alignItems: "center",
  },
  noIdAnswerText: {
    fontSize: 13,
    color: "#374151",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 14,
  },
  requestIdButton: {
    backgroundColor: "#2356E1",
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 10,
    width: "100%",
    alignItems: "center",
  },
  requestIdText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },
  oscaButton: {
    backgroundColor: "#0E7490",
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 10,
    width: "100%",
    alignItems: "center",
  },
  oscaButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },
  changeAnswerText: {
    fontSize: 13,
    color: "#6B7280",
    textDecorationLine: "underline",
    marginTop: 4,
  },

  // Create Account button
  createButton: {
    backgroundColor: "#2356E1",
    padding: 17,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#2356E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: 0.3,
  },
});
