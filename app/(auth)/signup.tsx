import { Palette } from "@/constants/theme";
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
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
  const { colors: c } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
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
  // One question per screen: the form is split into steps (see STEP_COUNT).
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
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

  // Steps: 0 ID question, 1 name, 2 birthday + gender, 3 phone, 4 address,
  // 5 guardian, 6 password (+ ID number and photo), 7 review.
  const STEP_COUNT = 8;
  const LAST_STEP = STEP_COUNT - 1;

  const STEP_FIELDS: Record<number, string[]> = {
    1: ["firstName", "midName", "lastName"],
    2: ["dob", "gender"],
    3: ["conNumber"],
    4: ["district", "barangay", "street"],
    5: ["guardianName", "guardianPhone", "guardianRelation"],
    6: ["idNumber", "password"],
  };

  // Checks one step with the same validators as before. Sets the inline
  // field errors and returns an alert (title + message) or null when fine.
  const validateStep = (n: number): { title: string; msg: string } | null => {
    if (n === 0) {
      return hasSciaId === null ? { title: t("suStatusTitle"), msg: t("suStatusBody") } : null;
    }
    const fields = STEP_FIELDS[n];
    if (!fields) return null;
    const e: Record<string, string> = {};
    const add = (field: string, msg: string) => {
      if (msg) e[field] = msg;
    };
    if (n === 1) {
      add("firstName", validate("name", firstName));
      add("midName", validate("name", midName));
      add("lastName", validate("name", lastName));
    } else if (n === 2) {
      add("gender", validateGender(gender));
    } else if (n === 3) {
      add("conNumber", validate("phone", conNumber));
    } else if (n === 4) {
      add("district", validateOption(district, DISTRICTS, "district"));
      add("barangay", validateOption(barangay, barangayOptions, "barangay"));
      add("street", validate("address", street));
    } else if (n === 5) {
      add("guardianName", validate("name", guardianName));
      add("guardianPhone", validate("phone", guardianPhone));
      add("guardianRelation", validate("relation", guardianRelation, { required: false }));
    } else if (n === 6) {
      add("idNumber", validate("idNumber", idNumber, { required: hasSciaId === true }));
      add("password", validatePassword(password));
    }
    setErrors((prev) => {
      const next = { ...prev };
      fields.forEach((f) => delete next[f]);
      return { ...next, ...e };
    });
    if (n === 2 && !dob) {
      setDobTextError(t("suDobBad"));
      return { title: t("suCheckEntries"), msg: t("suDobBad") };
    }
    const first = Object.values(e)[0];
    if (first) return { title: t("suCheckEntries"), msg: first };
    if (n === 5 && !isPhMobile(guardianPhone.trim())) {
      return { title: t("suCheckNumberTitle"), msg: t("suCheckNumberBody") };
    }
    if (n === 6 && hasSciaId === true && !idImage) {
      return { title: t("suIdPhotoTitle"), msg: t("suIdPhotoBody") };
    }
    return null;
  };

  const goNext = () => {
    const problem = validateStep(step);
    if (problem) {
      Alert.alert(problem.title, problem.msg);
      return;
    }
    setStep((n) => Math.min(n + 1, LAST_STEP));
  };

  const goBack = () => setStep((n) => Math.max(n - 1, 0));

  // First step that still has a problem, so the final check can jump to it.
  const firstInvalidStep = (): number | null => {
    for (let n = 0; n < LAST_STEP; n++) {
      if (validateStep(n)) return n;
    }
    return null;
  };

  // Scroll back to the top whenever the step changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  // Phone back button goes to the previous step instead of leaving sign-up.
  useEffect(() => {
    if (step === 0) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setStep((n) => Math.max(n - 1, 0));
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const handleSignup = async () => {
    if (user) {
      Alert.alert(
        t("alreadySignedInTitle"),
        `${t("alreadySignedInPrefix")} ${`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.idNumber}. ${t("pleaseLogOutFirst")}`,
      );
      return;
    }
    const badStep = firstInvalidStep();
    if (badStep !== null) {
      setStep(badStep);
      const problem = validateStep(badStep);
      if (problem) Alert.alert(problem.title, problem.msg);
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
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step > 0 && (
          <View style={styles.progressWrap}>
            <Text style={styles.progressText}>{t("suStepOf", { n: step + 1, total: STEP_COUNT })}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${((step + 1) / STEP_COUNT) * 100}%` }]} />
            </View>
          </View>
        )}

        {step === 0 && (
        <>
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

        </>
        )}

        {step === 1 && (
        <>
        <Text style={styles.stepTitle}>{t("suStepNameTitle")}</Text>
        <View style={styles.inputGroup}>
          <TextInput
            placeholder={t("suFirstName")}
            placeholderTextColor={c.textMuted}
            style={inputStyle("firstName")}
            value={firstName}
            onChangeText={(v) => onText("firstName", "name", v, setFirstName)}
          />
          {fieldError("firstName")}
          <TextInput
            placeholder={t("suMiddleName")}
            placeholderTextColor={c.textMuted}
            style={inputStyle("midName")}
            value={midName}
            onChangeText={(v) => onText("midName", "name", v, setMidName)}
          />
          {fieldError("midName")}
          <TextInput
            placeholder={t("suLastName")}
            placeholderTextColor={c.textMuted}
            style={inputStyle("lastName")}
            value={lastName}
            onChangeText={(v) => onText("lastName", "name", v, setLastName)}
          />
          {fieldError("lastName")}
        </View>
        </>
        )}

        {step === 2 && (
        <>
        <Text style={styles.stepTitle}>{t("suStepBirthTitle")}</Text>
        <Text style={styles.sectionLabel}>{t("suDob")}</Text>
        <TextInput
          placeholder={t("suDobTypePh")}
          placeholderTextColor={c.textSecondary}
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

        </>
        )}

        {step === 3 && (
        <>
        <Text style={styles.stepTitle}>{t("suStepPhoneTitle")}</Text>
        <View style={styles.inputGroup}>
          <TextInput
            placeholder={t("suContact")}
            placeholderTextColor={c.textMuted}
            style={inputStyle("conNumber")}
            value={conNumber}
            onChangeText={(v) => onText("conNumber", "phone", v, setConNumber)}
            keyboardType="phone-pad"
          />
          {fieldError("conNumber")}
        </View>

        </>
        )}

        {step === 4 && (
        <>
        <Text style={styles.stepTitle}>{t("suStepAddressTitle")}</Text>
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
          placeholderTextColor={c.textMuted}
          style={inputStyle("street")}
          value={street}
          onChangeText={(v) => onText("street", "address", v, setStreet)}
        />
        {fieldError("street")}

        </>
        )}

        {step === 5 && (
        <>
        <Text style={styles.stepTitle}>{t("suStepGuardianTitle")}</Text>
        <Text style={styles.sectionHint}>
          {t("suGuardianHint")}
        </Text>
        <View style={styles.inputGroup}>
          <TextInput
            placeholder={t("suGuardianName")}
            placeholderTextColor={c.textMuted}
            style={inputStyle("guardianName")}
            value={guardianName}
            onChangeText={(v) => onText("guardianName", "name", v, setGuardianName)}
          />
          {fieldError("guardianName")}
          <TextInput
            placeholder={t("suGuardianPhone")}
            placeholderTextColor={c.textMuted}
            style={inputStyle("guardianPhone")}
            value={guardianPhone}
            onChangeText={(v) => onText("guardianPhone", "phone", v, setGuardianPhone)}
            keyboardType="phone-pad"
          />
          {fieldError("guardianPhone")}
          <TextInput
            placeholder={t("suGuardianRelation")}
            placeholderTextColor={c.textMuted}
            style={inputStyle("guardianRelation")}
            value={guardianRelation}
            onChangeText={(v) => onText("guardianRelation", "relation", v, setGuardianRelation)}
          />
          {fieldError("guardianRelation")}
        </View>

        </>
        )}

        {step === 6 && (
        <>
        <Text style={styles.stepTitle}>{t("suStepAccountTitle")}</Text>
        <View style={styles.inputGroup}>
          <View style={styles.optionalWrapper}>
            <TextInput
              placeholder={
                hasSciaId === true
                  ? t("suIdNumberReq")
                  : t("suIdNumberOpt")
              }
              placeholderTextColor={c.textMuted}
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
            placeholderTextColor={c.textMuted}
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

        </>
        )}

        {step === LAST_STEP && (
        <>
        <Text style={styles.stepTitle}>{t("suReviewTitle")}</Text>
        <Text style={styles.sectionHint}>{t("suReviewHint")}</Text>
        {[
          { label: t("suRvName"), value: `${firstName} ${midName} ${lastName}`.replace(/\s+/g, " ").trim(), to: 1 },
          { label: t("suDob"), value: dob ? formatDisplayDate(dobDate) : "", to: 2 },
          { label: t("suGender"), value: gender === "Male" ? t("genderMale") : gender === "Female" ? t("genderFemale") : "", to: 2 },
          { label: t("suContact"), value: conNumber, to: 3 },
          { label: t("suRvAddress"), value: fullAddress, to: 4 },
          {
            label: t("suGuardianSection"),
            value: [guardianName, guardianPhone, guardianRelation].filter((v) => v.trim()).join(" - "),
            to: 5,
          },
          ...(idNumber.trim() ? [{ label: t("suRvId"), value: idNumber.trim(), to: 6 }] : []),
          ...(hasSciaId === true && idImage ? [{ label: t("suRvIdPhoto"), value: t("suRvAttached"), to: 6 }] : []),
        ].map((row) => (
          <View key={row.label} style={styles.reviewRow}>
            <View style={styles.reviewText}>
              <Text style={styles.reviewLabel}>{row.label}</Text>
              <Text style={styles.reviewValue}>{row.value}</Text>
            </View>
            <TouchableOpacity
              style={styles.reviewEdit}
              onPress={() => setStep(row.to)}
              accessibilityRole="button"
              accessibilityLabel={`${t("suEdit")}: ${row.label}`}
            >
              <Text style={styles.reviewEditText}>{t("suEdit")}</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={c.onColor} size="small" />
          ) : (
            <Text style={styles.createButtonText}>{t("suCreate")}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.navBackFull} onPress={goBack} accessibilityRole="button" disabled={loading}>
          <Text style={styles.navBackText}>{t("backBtn")}</Text>
        </TouchableOpacity>
        </>
        )}

        {step < LAST_STEP && (
          <View style={styles.navRow}>
            {step > 0 && (
              <TouchableOpacity style={styles.navBack} onPress={goBack} accessibilityRole="button">
                <Text style={styles.navBackText}>{t("backBtn")}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.navNext} onPress={goNext} accessibilityRole="button">
              <Text style={styles.navNextText}>{t("suNext")}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: c.surfaceAlt },
  scrollView: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  headerSection: { alignItems: "center", marginBottom: 24, paddingTop: 8 },
  headerAccent: {
    width: 50,
    height: 5,
    backgroundColor: c.primary,
    borderRadius: 3,
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: c.text,
    letterSpacing: 0.3,
  },
  subtitle: { fontSize: 16, color: c.textSecondary, marginTop: 4 },
  pendingNotice: {
    backgroundColor: c.warningSoft,
    borderRadius: 10,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: c.warning,
  },
  pendingNoticeText: {
    fontSize: 15,
    color: c.warningText,
    textAlign: "center",
    lineHeight: 21,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: c.primaryStrong,
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 22,
  },
  sectionHint: { fontSize: 14, color: c.textSecondary, marginBottom: 10, lineHeight: 20 },
  inputGroup: { gap: 12 },
  inputError: { borderColor: c.danger, backgroundColor: c.dangerSoft },
  errorText: { color: c.danger, fontSize: 14, lineHeight: 20, marginTop: -4 },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    fontSize: 17,
    color: c.text,
    minHeight: 52,
  },
  pickerBox: {
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
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
  optionalBadgeText: { fontSize: 14, color: c.textMuted, fontStyle: "italic" },
  dobOr: { fontSize: 15, color: c.textSecondary, marginTop: 10, marginBottom: 6 },
  dobButton: {
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
  },
  dobButtonText: { fontSize: 17, color: c.text },
  placeholder: { color: c.textMuted },
  dobChevron: { fontSize: 24, color: c.textMuted, lineHeight: 26 },
  dobConfirmButton: {
    backgroundColor: c.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  dobConfirmText: { color: c.onColor, fontWeight: "700", fontSize: 15 },
  genderRow: { flexDirection: "row", gap: 12 },
  genderOption: {
    flex: 1,
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  genderOptionActive: { borderColor: c.primaryStrong, backgroundColor: c.surfaceSoft },
  genderText: { fontSize: 17, color: c.textStrong, fontWeight: "600" },
  genderTextActive: { color: c.primaryStrong },
  uploadCard: {
    backgroundColor: c.surface,
    borderWidth: 2,
    borderColor: c.textMuted,
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
    backgroundColor: c.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  uploadIconText: {
    fontSize: 15,
    fontWeight: "800",
    color: c.primaryStrong,
    letterSpacing: 1,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: c.textStrong,
    marginBottom: 4,
  },
  uploadHint: { fontSize: 15, color: c.textMuted, textAlign: "center" },
  idPreview: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    resizeMode: "cover",
  },
  uploadChangeText: {
    fontSize: 15,
    color: c.primaryStrong,
    marginTop: 8,
    fontWeight: "600",
  },
  noIdSection: {
    marginBottom: 8,
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
  },
  noIdQuestion: {
    fontSize: 17,
    fontWeight: "800",
    color: c.textStrong,
    textAlign: "center",
    marginBottom: 4,
  },
  noIdSubtitle: {
    fontSize: 15,
    color: c.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },
  idAnswerRow: { flexDirection: "row", gap: 12, width: "100%" },
  idAnswerYes: {
    flex: 1,
    backgroundColor: c.surfaceSoft,
    borderWidth: 1.5,
    borderColor: c.primaryStrong,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  idAnswerNo: {
    flex: 1,
    backgroundColor: c.dangerSoft,
    borderWidth: 1.5,
    borderColor: c.danger,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  idAnswerYesText: { fontSize: 15, fontWeight: "700", color: c.primaryStrong },
  idAnswerNoText: { fontSize: 15, fontWeight: "700", color: c.danger },
  idActionCard: { alignItems: "center", gap: 12, width: "100%" },
  idActionText: {
    fontSize: 15,
    color: c.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  reasonInput: {
    width: "100%",
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    color: c.text,
    minHeight: 90,
  },
  requestIdButton: {
    backgroundColor: c.primaryStrong,
    borderRadius: 12,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  requestIdButtonText: { color: c.onColor, fontWeight: "700", fontSize: 17 },
  oscaButton: {
    backgroundColor: c.success,
    borderRadius: 12,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  oscaButtonText: { color: c.onColor, fontWeight: "700", fontSize: 17 },
  changeAnswerText: {
    fontSize: 14,
    color: c.textSecondary,
    textDecorationLine: "underline",
  },
  createButton: {
    backgroundColor: c.primaryStrong,
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
    color: c.onColor,
    fontWeight: "800",
    fontSize: 19,
    letterSpacing: 0.3,
  },

  // Step-by-step form
  progressWrap: { marginBottom: 20 },
  progressText: { fontSize: 18, fontWeight: "700", color: c.textStrong, marginBottom: 8 },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: c.primary },
  stepTitle: { fontSize: 26, fontWeight: "800", color: c.text, marginBottom: 16, lineHeight: 34 },
  navRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  navBack: {
    flex: 1,
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: c.primary,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  navBackFull: {
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: c.primary,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  navBackText: { fontSize: 20, fontWeight: "800", color: c.primary },
  navNext: {
    flex: 2,
    minHeight: 60,
    borderRadius: 16,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  navNextText: { fontSize: 20, fontWeight: "800", color: c.onColor },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  reviewText: { flex: 1 },
  reviewLabel: { fontSize: 15, fontWeight: "700", color: c.textMuted, marginBottom: 2 },
  reviewValue: { fontSize: 19, fontWeight: "700", color: c.text, lineHeight: 26 },
  reviewEdit: {
    minHeight: 48,
    minWidth: 84,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  reviewEditText: { fontSize: 17, fontWeight: "800", color: c.primary },
});
