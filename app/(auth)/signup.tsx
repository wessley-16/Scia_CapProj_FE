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
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
// 🔥 Firebase — replaces http://10.174.101.153:3000/api/users/register
import { registerUser } from "@/lib/firebase";

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
  const [dobDate, setDobDate] = useState(new Date());
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);

  const pickIdImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      base64: true,
    });
    if (!result.canceled) {
      setIdImage(result.assets[0]);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString();
  };

  const handleSignup = async () => {
    if (!idImage) {
      Alert.alert("Error", "Please upload ID.");
      return;
    }
    if (!firstName || !midName || !lastName || !address || !conNumber || !dob || !gender || !idNumber || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      // 🔥 Write directly to Firestore "users" collection.
      // Admin UserManagement will see this as a new PENDING user.
      const user = await registerUser({
        firstName, midName, lastName, address, conNumber,
        gender, dob, idNumber, password,
        imageBase64: idImage.base64,
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Create Account</Text>

        <TextInput placeholder="First Name" style={styles.input} value={firstName} onChangeText={setFirstName} />
        <TextInput placeholder="Middle Name" style={styles.input} value={midName} onChangeText={setMidName} />
        <TextInput placeholder="Last Name" style={styles.input} value={lastName} onChangeText={setLastName} />
        <TextInput placeholder="Address" style={styles.input} value={address} onChangeText={setAddress} />
        <TextInput placeholder="Contact Number" style={styles.input} value={conNumber} onChangeText={setConNumber} />

        <View style={styles.dropdowns}>
          <TouchableOpacity style={styles.ddInput} onPress={() => setShowDobPicker(true)}>
            <Text>{dob ? dob : "Select Date of Birth"}</Text>
          </TouchableOpacity>
          {showDobPicker && (
            <DateTimePicker
              value={dobDate} mode="date" display="default"
              onChange={(event, selectedDate) => {
                setShowDobPicker(false);
                if (selectedDate) { setDobDate(selectedDate); setDob(formatDate(selectedDate)); }
              }}
            />
          )}
          <View style={styles.ddInput}>
            <Picker selectedValue={gender} onValueChange={(itemValue) => setGender(itemValue)}>
              <Picker.Item label="Select Gender" value="" />
              <Picker.Item label="Male" value="Male" />
              <Picker.Item label="Female" value="Female" />
            </Picker>
          </View>
        </View>

        <TextInput placeholder="ID Number" style={styles.input} value={idNumber} onChangeText={setIdNumber} />
        <TextInput placeholder="Password" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />

        <TouchableOpacity style={styles.card} onPress={pickIdImage}>
          <Text style={styles.text}>Upload ID</Text>
          {idImage && <Image source={{ uri: idImage.uri }} style={styles.image} />}
        </TouchableOpacity>

        <View style={styles.noIdRow}>
          <Text style={styles.noIdText}>Don't have an ID yet?</Text>
          <TouchableOpacity style={styles.noIdButton} onPress={() => Linking.openURL("https://www.ncsc.gov.ph/")}>
            <Text style={styles.noIdButtonText}>Go Register</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "bold", fontSize: 18 }}>Create Account</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  container: { flex: 1, padding: 15, justifyContent: "center" },
  title: { fontSize: 32, marginBottom: 20, textAlign: "center" },
  card: { backgroundColor: "#eee", padding: 15, borderRadius: 10, marginBottom: 15, alignItems: "center" },
  text: { fontSize: 24 },
  image: { width: 160, height: 120, marginTop: 10, borderRadius: 10 },
  input: { borderWidth: 1, padding: 12, marginBottom: 10, borderRadius: 8 },
  dropdowns: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  ddInput: { flex: 1, borderWidth: 1, padding: 12, borderRadius: 8, marginRight: 5, justifyContent: "center" },
  button: { backgroundColor: "#2563EB", padding: 15, borderRadius: 10, alignItems: "center" },
  noIdRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", margin: 20 },
  noIdText: { fontSize: 18, color: "#333", textDecorationLine: "underline" },
  noIdButton: { backgroundColor: "#2563EB", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  noIdButtonText: { color: "white", fontSize: 18, fontWeight: "600" },
});
