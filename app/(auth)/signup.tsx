import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import {
  NCSC_FORM_URL,
  NcscSeniorStatus,
  registerUser,
  saveNcscStatus,
} from "@/lib/firebase";
import { DISTRICT_1_BARANGAYS, DISTRICT_2_BARANGAYS } from "@/constants/barangays";
import BarangayPickerField from "@/components/BarangayPickerField";
import DateTimePicker from "@react-native-community/datetimepicker";
import { pickIdImage as pickIdPhoto, PickedIdImage } from "@/lib/idImage";
import {
  DISTRICTS,
  RULES,
  RuleKind,
  latestSeniorBirthDate,
  sanitize,
  validate,
  validateGender,
  validateOption,
  validatePassword,
} from "@/lib/validators";
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

  const [idImage, setIdImage] = useState<PickedIdImage | null>(null);
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
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("");
  // Field-level errors shown under each input (and a red border).
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);
  // Typing a birthday is easier than a spinner for many seniors (NN/g: "why won't they just let me type the time").
  const [dobText, setDobText] = useState("");
  const [dobTextError, setDobTextError] = useState("");

  const [hasSciaId, setHasSciaId] = useState<null | boolean>(null);
  // The user is not signed in yet on this screen, so the NCSC progress is
  // kept here and written to Firestore right after the account is created.
  const [ncscStatus, setNcscStatus] = useState<NcscSeniorStatus | null>(null);

  const barangayOptions =
    district === "District 1" ? DISTRICT_1_BARANGAYS
    : district === "District 2" ? DISTRICT_2_BARANGAYS
    : [];

  const fullAddress = street && barangay
    ? `${street}, Brgy. ${barangay}, Valenzuela City`
    : "";

  // Typing filter: characters the field does not allow are dropped and the
  // field shows why; a valid keystroke clears the message.
  const onText = (
    field: string,
    kind: RuleKind,
    raw: string,
    set: (v: string) => void,
  ) => {
    const { value, rejected } = sanitize(kind, raw);
    set(value);
    setErrors((prev) => {
      const next = { ...prev };
      if (rejected) next[field] = RULES[kind].hint;
      else delete next[field];
      return next;
    });
  };

  const inputStyle = (field: string, extra?: object) => [
    styles.input,
    extra,
    errors[field] ? styles.inputError : null,
  ];

  const fieldError = (field: string) =>
    errors[field] ? <Text style={styles.errorText}>{errors[field]}</Text> : null;

  // Full check on submit. Returns the first message so it can be shown in an alert.
  const validateAll = (): string => {
    const e: Record<string, string> = {};
    const add = (field: string, msg: string) => {
      if (msg) e[field] = msg;
    };
    add("firstName", validate("name", firstName));
    add("midName", validate("name", midName));
    add("lastName", validate("name", lastName));
    add("conNumber", validate("phone", conNumber));
    add("street", validate("address", street));
    add("guardianName", validate("name", guardianName));
    add("guardianPhone", validate("phone", guardianPhone));
    add("guardianRelation", validate("relation", guardianRelation, { required: false }));
    add("idNumber", validate("idNumber", idNumber, { required: hasSciaId === true }));
    add("district", validateOption(district, DISTRICTS, "district"));
    add("barangay", validateOption(barangay, barangayOptions, "barangay"));
    add("gender", validateGender(gender));
    add("password", validatePassword(password));
    setErrors(e);
    return Object.values(e)[0] ?? "";
  };

  const isPhMobile = (v: string) =>
    /^(09\d{9}|\+639\d{9})$/.test(v.replace(/[\s-]/g, ""));

  const onDobText = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    const shown =
      digits.length > 4 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
      : digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}`
      : digits;
    setDobText(shown);
    setDobTextError("");
    if (digits.length < 8) { setDob(""); return; }
    const mm = Number(digits.slice(0, 2)), dd = Number(digits.slice(2, 4)), yy = Number(digits.slice(4));
    const d = new Date(yy, mm - 1, dd);
    const real = d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd;
    if (!real || d < new Date(1920, 0, 1) || d > latestSeniorBirthDate()) {
      setDob("");
      setDobTextError(t("suDobBad"));
      return;
    }
    setDobDate(d);
    setDob(formatStoredDate(d));
  };

  const pickIdImage = async () => {
    try {
      const picked = await pickIdPhoto();
      if (picked) setIdImage(picked);
    } catch (e: any) {
      Alert.alert(
        t("ivPhotoTitle"),
        e?.code === "photo-permission"
          ? t("ivPhotoPermission")
          : e?.code === "photo-too-large"
            ? t("ivPhotoTooLarge")
            : t("ivPhotoFail"),
      );
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
      Alert.alert(t("suMissingTitle"), t("suMissingBody"));
      return;
    }
    const firstProblem = validateAll();
    if (firstProblem) {
      Alert.alert(t("suCheckEntries"), firstProblem);
      return;
    }
    if (!guardianName.trim() || !guardianPhone.trim()) {
      Alert.alert(
        t("suGuardianTitle"),
        t("suGuardianBody"),
      );
      return;
    }
    if (!isPhMobile(guardianPhone.trim())) {
      Alert.alert(
        t("suCheckNumberTitle"),
        t("suCheckNumberBody"),
      );
      return;
    }
    if (hasSciaId === null) {
      Alert.alert(
        t("suStatusTitle"),
        t("suStatusBody"),
      );
      return;
    }
    if (hasSciaId === true && !idNumber.trim()) {
      Alert.alert(
        t("suIdNumTitle"),
        t("suIdNumBody"),
      );
      return;
    }
    if (hasSciaId === true && !idImage) {
      Alert.alert(
        t("suIdPhotoTitle"),
        t("suIdPhotoBody"),
      );
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
        guardianName: guardianName.trim(),
        guardianPhone: guardianPhone.trim(),
        guardianRelation: guardianRelation.trim(),
        imageBase64: hasSciaId === true ? idImage?.base64 : undefined,
      });
      if (hasSciaId === false && ncscStatus) {
        try {
          await saveNcscStatus(ncscStatus, {
            barangay,
            fullName: `${firstName} ${midName} ${lastName}`.replace(/\s+/g, " ").trim(),
          });
        } catch (e) {
          console.warn("saveNcscStatus failed:", e);
        }
      }
      // "Yes, I'm registered": record it so OSCA sees it under NCSC
      // Registrations and can verify the ID number by hand.
      if (hasSciaId === true) {
        try {
          await saveNcscStatus("completed_claimed", {
            barangay,
            fullName: `${firstName} ${midName} ${lastName}`.replace(/\s+/g, " ").trim(),
            alreadyRegistered: true,
            idNumber: idNumber.trim(),
          });
        } catch (e) {
          console.warn("saveNcscStatus (already registered) failed:", e);
        }
      }
      await refreshUser();
      router.replace("/(tabs)/home");
    } catch (error: any) {
      Alert.alert(t("errorTitle"), t("suFail"));
    } finally {
      setLoading(false);
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
          <Text style={styles.title}>{t("suTitle")}</Text>
          <Text style={styles.subtitle}>{t("suSubtitle")}</Text>
          <View style={styles.pendingNotice}>
            <Text style={styles.pendingNoticeText}>
              {t("suPendingNotice")}
            </Text>
          </View>
        </View>

        <View style={styles.noIdSection}>
          <Text style={styles.noIdQuestion}>
            {t("suQuestion")}
          </Text>

          {hasSciaId === null && (
            <View style={styles.idAnswerRow}>
              <TouchableOpacity
                style={styles.idAnswerYes}
                onPress={() => setHasSciaId(true)}
              >
                <Text style={styles.idAnswerYesText}>{t("suYes")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.idAnswerNo}
                onPress={() => setHasSciaId(false)}
              >
                <Text style={styles.idAnswerNoText}>{t("suNotYet")}</Text>
              </TouchableOpacity>
            </View>
          )}

          {hasSciaId === true && (
            <View style={styles.idActionCard}>
              <Text style={styles.idActionText}>
                {t("suEnterId")}
              </Text>
              <TouchableOpacity onPress={() => setHasSciaId(null)}>
                <Text style={styles.changeAnswerText}>{t("suChangeAnswer")}</Text>
              </TouchableOpacity>
            </View>
          )}

          {hasSciaId === false && (
            <View style={styles.idActionCard}>
              {ncscStatus === "started" ? (
                <>
                  <Text style={styles.idActionText}>
                    {t("suNcscFinished")}
                  </Text>
                  <TouchableOpacity
                    style={styles.oscaButton}
                    onPress={() => setNcscStatus("completed_claimed")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.oscaButtonText}>{t("suYesFinished")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.idAnswerNo}
                    onPress={() => setNcscStatus("cancelled")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.idAnswerNoText}>{t("suCancelled")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => Linking.openURL(NCSC_FORM_URL)}>
                    <Text style={styles.changeAnswerText}>{t("suReopenForm")}</Text>
                  </TouchableOpacity>
                </>
              ) : ncscStatus === "completed_claimed" ? (
                <Text style={styles.idActionText}>
                  {t("suNcscThanks")}
                </Text>
              ) : (
                <>
                  <Text style={styles.idActionText}>
                    {t("suNcscOptional")}
                  </Text>
                  <TouchableOpacity
                    style={styles.oscaButton}
                    onPress={() => {
                      setNcscStatus("started");
                      Linking.openURL(NCSC_FORM_URL);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.oscaButtonText}>{t("suRegisterNcsc")}</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                onPress={() => {
                  setHasSciaId(null);
                  setNcscStatus(null);
                }}
              >
                <Text style={styles.changeAnswerText}>{t("suChangeAnswer")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>{t("suPersonalInfo")}</Text>
        <View style={styles.inputGroup}>
          <TextInput
            placeholder={t("suFirstName")}
            placeholderTextColor="#6B7280"
            style={inputStyle("firstName")}
            value={firstName}
            onChangeText={(v) => onText("firstName", "name", v, setFirstName)}
          />
          {fieldError("firstName")}
          <TextInput
            placeholder={t("suMiddleName")}
            placeholderTextColor="#6B7280"
            style={inputStyle("midName")}
            value={midName}
            onChangeText={(v) => onText("midName", "name", v, setMidName)}
          />
          {fieldError("midName")}
          <TextInput
            placeholder={t("suLastName")}
            placeholderTextColor="#6B7280"
            style={inputStyle("lastName")}
            value={lastName}
            onChangeText={(v) => onText("lastName", "name", v, setLastName)}
          />
          {fieldError("lastName")}
          <TextInput
            placeholder={t("suContact")}
            placeholderTextColor="#6B7280"
            style={inputStyle("conNumber")}
            value={conNumber}
            onChangeText={(v) => onText("conNumber", "phone", v, setConNumber)}
            keyboardType="phone-pad"
          />
          {fieldError("conNumber")}
        </View>

        <Text style={styles.sectionLabel}>{t("suGuardianSection")}</Text>
        <Text style={styles.sectionHint}>
          {t("suGuardianHint")}
        </Text>
        <View style={styles.inputGroup}>
          <TextInput
            placeholder={t("suGuardianName")}
            placeholderTextColor="#6B7280"
            style={inputStyle("guardianName")}
            value={guardianName}
            onChangeText={(v) => onText("guardianName", "name", v, setGuardianName)}
          />
          {fieldError("guardianName")}
          <TextInput
            placeholder={t("suGuardianPhone")}
            placeholderTextColor="#6B7280"
            style={inputStyle("guardianPhone")}
            value={guardianPhone}
            onChangeText={(v) => onText("guardianPhone", "phone", v, setGuardianPhone)}
            keyboardType="phone-pad"
          />
          {fieldError("guardianPhone")}
          <TextInput
            placeholder={t("suGuardianRelation")}
            placeholderTextColor="#6B7280"
            style={inputStyle("guardianRelation")}
            value={guardianRelation}
            onChangeText={(v) => onText("guardianRelation", "relation", v, setGuardianRelation)}
          />
          {fieldError("guardianRelation")}
        </View>

        <Text style={styles.sectionLabel}>{t("suDistrict")}</Text>
        <View style={styles.genderRow}>
          {["District 1", "District 2"].map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.genderOption, district === d && styles.genderOptionActive]}
              onPress={() => { setDistrict(d); setBarangay(""); }}
            >
              <Text style={[styles.genderText, district === d && styles.genderTextActive]}>
                {d === "District 1" ? t("suDistrict1") : t("suDistrict2")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t("suBarangay")}</Text>
        <BarangayPickerField
          value={barangay}
          options={barangayOptions}
          disabled={district.length === 0}
          placeholder={district ? t("suSelectBarangay") : t("suSelectDistrictFirst")}
          title={t("suPickBarangay")}
          hasError={!!errors.barangay}
          onSelect={setBarangay}
        />
        {fieldError("barangay")}

        <Text style={styles.sectionLabel}>{t("suStreet")}</Text>
        <TextInput
          placeholder={t("suStreetPh")}
          placeholderTextColor="#6B7280"
          style={inputStyle("street")}
          value={street}
          onChangeText={(v) => onText("street", "address", v, setStreet)}
        />
        {fieldError("street")}

        <Text style={styles.sectionLabel}>{t("suDob")}</Text>
        <TextInput
          placeholder={t("suDobTypePh")}
          placeholderTextColor="#4B5563"
          accessibilityLabel={t("suDobType")}
          style={[styles.input, dobTextError ? styles.inputError : null]}
          value={dobText}
          onChangeText={onDobText}
          keyboardType="number-pad"
          maxLength={10}
        />
        {dobTextError ? <Text style={styles.errorText}>{dobTextError}</Text> : null}
        <Text style={styles.dobOr}>{t("suDobOrPick")}</Text>
        <TouchableOpacity
          style={styles.dobButton}
          onPress={() => setShowDobPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.dobButtonText, !dob && styles.placeholder]}>
            {dob ? formatDisplayDate(dobDate) : t("suSelectDob")}
          </Text>
          <Text style={styles.dobChevron}>›</Text>
        </TouchableOpacity>

        {showDobPicker && (
          <DateTimePicker
            value={dobDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={latestSeniorBirthDate()}
            minimumDate={new Date(1920, 0, 1)}
            onChange={(event, selectedDate) => {
              if (Platform.OS === "android") setShowDobPicker(false);
              if (selectedDate) {
                setDobDate(selectedDate);
                setDob(formatStoredDate(selectedDate));
                setDobText(
                  `${String(selectedDate.getMonth() + 1).padStart(2, "0")}/${String(selectedDate.getDate()).padStart(2, "0")}/${selectedDate.getFullYear()}`,
                );
                setDobTextError("");
              }
            }}
          />
        )}
        {Platform.OS === "ios" && showDobPicker && (
          <TouchableOpacity
            style={styles.dobConfirmButton}
            onPress={() => setShowDobPicker(false)}
          >
            <Text style={styles.dobConfirmText}>{t("suConfirmDate")}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>{t("suGender")}</Text>
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
                {g === "Male" ? t("genderMale") : t("genderFemale")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t("suAccountDetails")}</Text>
        <View style={styles.inputGroup}>
          <View style={styles.optionalWrapper}>
            <TextInput
              placeholder={
                hasSciaId === true
                  ? t("suIdNumberReq")
                  : t("suIdNumberOpt")
              }
              placeholderTextColor="#6B7280"
              style={inputStyle("idNumber", { paddingRight: 90 })}
              value={idNumber}
              onChangeText={(v) => onText("idNumber", "idNumber", v, setIdNumber)}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalBadgeText}>
                {hasSciaId === true ? t("suRequired") : t("suOptional")}
              </Text>
            </View>
          </View>
          {fieldError("idNumber")}
          <TextInput
            placeholder={t("suPassword")}
            placeholderTextColor="#6B7280"
            secureTextEntry
            style={inputStyle("password")}
            value={password}
            onChangeText={(v) => {
              setPassword(v.slice(0, 64));
              setErrors((prev) => {
                const next = { ...prev };
                delete next.password;
                return next;
              });
            }}
            autoCapitalize="none"
          />
          {fieldError("password")}
        </View>

        {hasSciaId === true && (
        <>
        <Text style={styles.sectionLabel}>{t("suUploadLabel")}</Text>
        <TouchableOpacity
          style={styles.uploadCard}
          onPress={pickIdImage}
          activeOpacity={0.7}
        >
          {idImage ? (
            <>
              <Image source={{ uri: idImage.uri }} style={styles.idPreview} />
              <Text style={styles.uploadChangeText}>{t("suChangePhoto")}</Text>
            </>
          ) : (
            <>
              <View style={styles.uploadIconBox}>
                <Text style={styles.uploadIconText}>ID</Text>
              </View>
              <Text style={styles.uploadTitle}>{t("suUploadTitle")}</Text>
              <Text style={styles.uploadHint}>
                {t("suUploadHint")}
              </Text>
            </>
          )}
        </TouchableOpacity>
        </>
        )}

        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.createButtonText}>{t("suCreate")}</Text>
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
  sectionHint: { fontSize: 14, color: "#4B5563", marginBottom: 10, lineHeight: 20 },
  inputGroup: { gap: 12 },
  inputError: { borderColor: "#DC2626", backgroundColor: "#FEF2F2" },
  errorText: { color: "#B91C1C", fontSize: 14, lineHeight: 20, marginTop: -4 },
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
  optionalBadgeText: { fontSize: 14, color: "#6B7280", fontStyle: "italic" },
  dobOr: { fontSize: 15, color: "#4B5563", marginTop: 10, marginBottom: 6 },
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
    marginBottom: 8,
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
