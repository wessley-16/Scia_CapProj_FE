import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Signup() {
  const router = useRouter();
  const cameraRef = useRef<any>(null);

  const [idImage, setIdImage] = useState<any>(null);
  const [faceImage, setFaceImage] = useState<any>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const [password, setPassword] = useState("");
  const [idNumber, setIdNumber] = useState("");

  const [loading, setLoading] = useState(false);

  // -------------------------
  // Upload ID Image
  // -------------------------
  const pickIdImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setIdImage(result.assets[0]);
    }
  };

  // -------------------------
  // Capture Face
  // -------------------------
  const takePicture = async (camera: any) => {
    try {
      const photo = await camera.takePictureAsync({
        quality: 0.5, // compress image
        base64: false,
        skipProcessing: true,
      });

      // Further compress if needed
      const compressed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [],
        {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      setFaceImage(compressed);
      setShowCamera(false);
    } catch (error) {
      console.log("Camera error:", error);
    }
  };

  // -------------------------
  // Submit to backend
  // -------------------------
  const handleSignup = async () => {
    if (!idImage || !faceImage) {
      Alert.alert("Error", "Please upload ID and capture your face.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("image1", {
        uri: idImage.uri,
        name: "id.jpg",
        type: "image/jpeg",
      } as any);

      formData.append("image2", {
        uri: faceImage.uri,
        name: "face.jpg",
        type: "image/jpeg",
      } as any);

      const response = await fetch(
        "http://10.174.101.153:3000/api/face/compare",
        {
          method: "POST",
          body: formData,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const data = await response.json();

      // -------------------------
      // MATCH RESULT
      // -------------------------
      if (!data.isMatch) {
        Alert.alert(
          "Face Not Matched",
          "Please ensure a clear ID photo and try again.",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Retry",
              onPress: () => {
                setFaceImage(null);
                setShowCamera(true);
              },
            },
          ]
        );
        return;
      }

      // -------------------------
      // MOCK OCR DATA (replace later)
      // -------------------------
      const extractedData = {
        name: "Juan Dela Cruz",
        address: "Valenzuela City",
        dob: "January 1, 1950",
        sex: "Male",
        idNumber: idNumber,
        issued: "2020",
        image: faceImage.uri,
      };

      // Navigate to account page with data
      router.replace({
        pathname: "/account",
        params: extractedData,
      });
    } catch (error) {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // CAMERA VIEW
  // -------------------------
  if (showCamera) {
    if (!permission?.granted) {
      requestPermission();
    }

    return (
      <View style={{ flex: 1 }}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="front" // ✅ FRONT CAMERA
        />
        <TouchableOpacity
          style={styles.captureBtn}
          onPress={() => {
            if (cameraRef.current) {
              takePicture(cameraRef.current);
            }
          }}
        >
          <Text style={{ color: "white" }}>Capture</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // -------------------------
  // MAIN UI
  // -------------------------
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      {/* ID Upload */}
      <TouchableOpacity style={styles.card} onPress={pickIdImage}>
        <Text style={styles.text}>Upload ID</Text>
        {idImage && (
          <Image source={{ uri: idImage.uri }} style={styles.image} />
        )}
      </TouchableOpacity>

      {/* Face Capture */}
      <TouchableOpacity
        style={styles.card}
        onPress={() => setShowCamera(true)}
      >
        <Text style={styles.text}>Capture Face</Text>
        {faceImage && (
          <Image source={{ uri: faceImage.uri }} style={styles.image} />
        )}
      </TouchableOpacity>

      {/* Inputs */}
      <TextInput
        placeholder="ID Number"
        style={styles.input}
        value={idNumber}
        onChangeText={setIdNumber}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      {/* Submit */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleSignup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: "white" }}>Verify & Register</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 32, marginBottom: 20, textAlign: "center" },

  card: {
    backgroundColor: "#eee",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: "center",
  },

  text: {
    fontSize: 24,
  },

  image: {
    width: 160,
    height: 120,
    marginTop: 10,
    borderRadius: 10,
  },

  input: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
  },

  button: {
    backgroundColor: "#2563EB",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  captureBtn: {
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    backgroundColor: "#2563EB",
    padding: 20,
    borderRadius: 50,
  },
});