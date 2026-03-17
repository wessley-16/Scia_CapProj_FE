import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import React, { useState, useRef } from "react";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { AntDesign, FontAwesome } from "@expo/vector-icons";
import { useMedAi } from "@/hooks/useMedAi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const CameraScreen = () => {
  const { analyzeImage, reminders, isLoading, error, clearReminders } =
    useMedAi();

  // Array state for batch scanning!
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  // --- Action 1: Snap Picture from Live Camera ---
  const handleTakePicture = async () => {
    if (imageUris.length >= 5) {
      Alert.alert("Limit Reached", "You can only analyze up to 5 images.");
      return;
    }

    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      if (photo?.uri) {
        setImageUris((prev) => [...prev, photo.uri]); // Store locally
      }
    }
  };

  const handleFinish = async () => {
    if (imageUris.length === 0) return;
    setIsReviewing(true); // Switch to results view
    await analyzeImage(imageUris); // Analyze all
  }; // End of handleFinish

  // --- Action 2: Save to Pill Box ---
  const saveToPillBox = async () => {
    try {
      const stored = await AsyncStorage.getItem("medicines");
      const existingMeds = stored ? JSON.parse(stored) : [];

      const newMeds = reminders.map((med, index) => {
        // Keep the full dose string if it's complex, or just use what AI gave
        const finalDosage = med.dose || "1";

        return {
          id: med.id || (Date.now() + index).toString(),
          name: med.medicationName || "Unknown Med",
          description: med.description || med.body || "",
          dosage: finalDosage,
          dosageUnit: "capsule",
          interval: med.intervalHours || 8, // Default fallback
          notificationTimes: med.notificationTimes, // Keep array if present
          startDate: med.startDate,
          endDate: med.endDate,
          startTime: Date.now(),
          lastTakenTime: Date.now(),
          createdAt: Date.now(),
        };
      });

      await AsyncStorage.setItem(
        "medicines",
        JSON.stringify([...existingMeds, ...newMeds]),
      );
      Alert.alert("Success!", "Medications added to your Pill Box.");
      router.back();
    } catch (err) {
      console.error("Error saving meds:", err);
      Alert.alert("Error", "Could not save to Pill Box.");
    }
  };

  // --- Action 3: Open Gallery ---
  const handleOpenGallery = async () => {
    const galleryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!galleryPerm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.5,
    });

    if (!result.canceled) {
      const uris = result.assets.map((asset) => asset.uri);
      if (imageUris.length + uris.length > 5) {
        Alert.alert("Limit Reached", "Total images cannot exceed 5.");
        return;
      }
      setImageUris((prev) => [...prev, ...uris]);
    }
  };

  // --- Action 4: Reset ---
  const handleReset = () => {
    setImageUris([]);
    setIsReviewing(false);
    clearReminders();
  };

  // --- Permissions UI ---
  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={{ textAlign: "center", marginBottom: 20 }}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity style={styles.saveButton} onPress={requestPermission}>
          <Text style={styles.saveButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ==========================================
  // VIEW 1: RESULTS MODE (Image Taken)
  // ==========================================
  // FIXED: Check isReviewing and imageUris
  if (isReviewing && imageUris && imageUris.length > 0) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.contentArea}>
          {/* Scroll view for all taken images in result mode too */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 20 }}
          >
            {imageUris.map((uri, index) => (
              <Image
                key={index}
                source={{ uri }}
                style={[styles.previewImage, { width: 300, marginRight: 10 }]}
              />
            ))}
          </ScrollView>

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2356E1" />
              <Text style={styles.loadingText}>Analyzing medication...</Text>
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          {reminders && reminders.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsHeader}>Medications Found:</Text>
              {reminders.map((med, index) => (
                <View key={index} style={styles.medCard}>
                  <Text style={styles.medTitle}>{med.medicationName}</Text>
                  <Text style={styles.medBody}>{med.body}</Text>
                  <Text style={styles.medDose}>Dose: {med.dose}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={{ padding: 20, paddingBottom: 40, gap: 10 }}>
          {reminders && reminders.length > 0 && (
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: "#10B981" }]}
              onPress={saveToPillBox}
            >
              <Text style={styles.saveButtonText}>Add All to Pill Box</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: "#6B7280" }]}
            onPress={handleReset}
            disabled={isLoading}
          >
            <Text style={styles.saveButtonText}>Scan Another</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ==========================================
  // VIEW 2: LIVE CAMERA MODE
  // ==========================================
  return (
    <View style={styles.container}>
      {/* FIXED: CameraView is now self-closing and has no children! */}
      <CameraView style={styles.camera} facing="back" ref={cameraRef} />

      {/* FIXED: Overlay is placed outside and uses absolute positioning to float on top */}
      <View style={[styles.cameraOverlay, StyleSheet.absoluteFillObject]}>
        {/* PREVIEW STRIP */}
        {imageUris.length > 0 && (
          <View style={styles.thumbnailContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {imageUris.map((uri, index) => (
                <Image key={index} source={{ uri }} style={styles.thumbnail} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.galleryButton]}
            onPress={handleOpenGallery}
          >
            <FontAwesome name="photo" size={24} color="#2356E1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.cameraButton]}
            onPress={handleTakePicture}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          {imageUris.length > 0 ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.doneButton]}
              onPress={handleFinish}
            >
              <AntDesign name="check" size={32} color="white" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 50 }} />
          )}
        </View>
      </View>
    </View>
  );
};

export default CameraScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  camera: { flex: 1 },
  cameraOverlay: {
    // This makes the overlay sit safely on top of the camera view
    justifyContent: "flex-end",
    zIndex: 10,
  },
  contentArea: { flex: 1, padding: 20 },
  previewImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    marginBottom: 20,
    resizeMode: "cover",
  },
  loadingContainer: { marginTop: 40, alignItems: "center" },
  loadingText: { marginTop: 10, color: "#666", fontSize: 16 },
  errorText: { color: "red", textAlign: "center", marginTop: 20 },
  resultsContainer: { paddingBottom: 40 },
  resultsHeader: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  medCard: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
  },
  medTitle: { fontSize: 18, fontWeight: "bold", color: "#2356E1" },
  medBody: { fontSize: 14, color: "#444", marginTop: 5 },
  medDose: { fontSize: 14, color: "#888", marginTop: 5, fontStyle: "italic" },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingBottom: 50,
  },
  actionButton: {
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  cameraButton: {
    backgroundColor: "rgba(255,255,255,0.3)",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "white",
  },
  shutterInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "white",
  },
  galleryButton: {
    backgroundColor: "white",
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  saveButton: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveButtonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  thumbnailContainer: {
    position: "absolute",
    bottom: 150,
    left: 0,
    right: 0,
    height: 80,
    paddingHorizontal: 20,
  },
  thumbnail: {
    width: 60,
    height: 80,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 2,
    borderColor: "white",
  },
  doneButton: {
    backgroundColor: "#10B981",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
