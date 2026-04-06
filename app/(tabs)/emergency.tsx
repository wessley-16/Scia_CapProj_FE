import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

const HOLD_DURATION_MS = 5000;

// List of Valenzuela barangays
const valenzuelaBarangays = [
  { name: 'Bagbaguin', lat: 14.7046, lng: 120.9946 },
  { name: 'Bignay', lat: 14.7068, lng: 120.9925 },
  { name: 'Bisig', lat: 14.7170, lng: 120.9810 },
  { name: 'Canumay East', lat: 14.6935, lng: 120.9795 },
  { name: 'Canumay West', lat: 14.6929, lng: 120.9764 },
  { name: 'Casisang', lat: 14.7240, lng: 120.9945 },
  { name: 'Col. Jose W. Diokno', lat: 14.7063, lng: 120.9908 },
  { name: 'Gen. T. de Leon', lat: 14.7057, lng: 120.9863 },
  { name: 'Genova', lat: 14.7028, lng: 120.9749 },
  { name: 'Isla', lat: 14.6931, lng: 120.9972 },
  { name: 'Karuhatan', lat: 14.7029, lng: 120.9984 },
  { name: 'Lawang Bato', lat: 14.7058, lng: 120.9981 },
  { name: 'Lingunan', lat: 14.7033, lng: 120.9841 },
  { name: 'Loma de Gato', lat: 14.7154, lng: 120.9875 },
  { name: 'Malinta', lat: 14.7014, lng: 120.9769 },
  { name: 'Mapulang Lupa', lat: 14.7074, lng: 120.9973 },
  { name: 'Marulas', lat: 14.7164, lng: 120.9911 },
  { name: 'Maysan', lat: 14.7198, lng: 120.9969 },
  { name: 'Northbay Blvd North', lat: 14.7301, lng: 120.9761 },
  { name: 'Northbay Blvd South', lat: 14.7245, lng: 120.9778 },
  { name: 'Panghulo', lat: 14.7228, lng: 120.9969 },
  { name: 'Pariancillo Villa', lat: 14.7005, lng: 120.9877 },
  { name: 'Paso de Blas', lat: 14.7302, lng: 120.9910 },
  { name: 'Poblacion', lat: 14.7007, lng: 120.9859 },
  { name: 'Polo', lat: 14.7256, lng: 120.9824 },
  { name: 'Punturin', lat: 14.7284, lng: 120.9866 },
  { name: 'Reservoir Hills', lat: 14.7201, lng: 120.9994 },
  { name: 'Tagalag', lat: 14.7308, lng: 120.9872 },
  { name: 'Ugong', lat: 14.7200, lng: 120.9947 },
  { name: 'Veinte Reales', lat: 14.7061, lng: 120.9882 },
  { name: 'Wawang Pulo', lat: 14.7177, lng: 120.9854 },
  { name: 'Alfonso', lat: 14.7012, lng: 120.9874 },
];

const getBarangayFromCoords = (lat: number, lng: number): string => {
  if (isNaN(lat) || isNaN(lng)) return 'Unknown Barangay';
  let closest = { name: 'Unknown Barangay', dist: Number.MAX_VALUE };
  for (const b of valenzuelaBarangays) {
    const d = Math.hypot(lat - b.lat, lng - b.lng);
    if (d < closest.dist) closest = { name: b.name, dist: d };
  }
  return closest.dist < 0.03 ? closest.name : 'Unknown Barangay';
};

export default function EmergencyScreen() {
  const [profileName, setProfileName] = useState('Maria S. Santos');
  const [location, setLocation] = useState<any>(null);
  const [fullAddress, setFullAddress] = useState('Unknown Address');
  const [barangay, setBarangay] = useState('Unknown Barangay');

  const [selectedEmergency, setSelectedEmergency] = useState('Fall');
  const [otherEmergency, setOtherEmergency] = useState('');

  const [isHolding, setIsHolding] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);

  const progress = useRef(new Animated.Value(0)).current;
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchLocation();
    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      if (notificationTimeout.current) clearTimeout(notificationTimeout.current);
    };
  }, []);

  const fetchLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Enable location to use this feature.');
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});
    setLocation({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });

    try {
      const geo = await Location.reverseGeocodeAsync(loc.coords);
      if (geo.length > 0) {
        const place: any = geo[0];
        const address = `${place.street || ''}, ${getBarangayFromCoords(
          loc.coords.latitude,
          loc.coords.longitude
        )}, ${place.city || ''}`;
        setFullAddress(address);
        setBarangay(getBarangayFromCoords(loc.coords.latitude, loc.coords.longitude));
      }
    } catch {
      setFullAddress('Unable to fetch address');
    }
  };

  const startHold = () => {
    setIsHolding(true);
    setSecondsLeft(5);

    countdownInterval.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === 1) {
          clearInterval(countdownInterval.current!);
          countdownInterval.current = null;
          triggerSOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_DURATION_MS,
      useNativeDriver: true,
    }).start();
  };

  const stopHold = () => {
    setIsHolding(false);
    progress.setValue(0);
    setSecondsLeft(5);
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
  };

  const triggerSOS = () => {
    Alert.alert('SOS Sent', 'Your emergency alert has been sent!');
    notificationTimeout.current = setTimeout(() => {
      Alert.alert('Responder Update', 'A responder is coming to your location!');
    }, 30000);
  };

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>🚨 EMERGENCY</Text>

        {/* SOS BUTTON */}
        <View style={styles.sosWrapper}>
          <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
          <Pressable
            onPressIn={startHold}
            onPressOut={stopHold}
            style={styles.sosButton}
          >
            <Text style={styles.sosText}>
              {isHolding ? `${secondsLeft}` : "HOLD"}
            </Text>
          </Pressable>
        </View>

        {/* MAP */}
        <View style={styles.mapWrapper}>
          {location && (
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              region={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker coordinate={location} title="You are here" pinColor="red" />
            </MapView>
          )}
        </View>

        {/* DROPDOWN */}
        <Text style={styles.label}>Type of Emergency</Text>
        <View style={styles.dropdown}>
          <Picker
            selectedValue={selectedEmergency}
            onValueChange={(itemValue) => setSelectedEmergency(itemValue)}
          >
            <Picker.Item label="Fall" value="Fall" />
            <Picker.Item label="Stroke" value="Stroke" />
            <Picker.Item label="Heart Attack" value="Heart Attack" />
            <Picker.Item label="Breathing Problem" value="Breathing Problem" />
            <Picker.Item label="Fracture" value="Fracture" />
            <Picker.Item label="Seizure" value="Seizure" />
            <Picker.Item label="Burn" value="Burn" />
            <Picker.Item label="Bleeding" value="Bleeding" />
            <Picker.Item label="Unconscious" value="Unconscious" />
            <Picker.Item label="Other" value="Other" />
          </Picker>
        </View>

        {selectedEmergency === 'Other' && (
          <TextInput
            placeholder="Type emergency..."
            value={otherEmergency}
            onChangeText={setOtherEmergency}
            style={styles.input}
          />
        )}

        {/* INFO CARD */}
        <View style={styles.infoCard}>
          <Text style={styles.info}>Name: {profileName}</Text>
          <Text style={styles.info}>Address: {fullAddress}</Text>
          <Text style={styles.info}>
            Coordinates: {location ? `${location.latitude}, ${location.longitude}` : 'Loading...'}
          </Text>
          <Text style={styles.info}>
            Barangay: {barangay}
          </Text>
          <Text style={styles.info}>
            Emergency: {selectedEmergency === 'Other' ? otherEmergency : selectedEmergency}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20, paddingBottom: 120 },
  header: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#CE2029', marginBottom: 20 },
  sosWrapper: { alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  ring: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 5, borderTopColor: '#CE2029', borderColor: 'transparent' },
  sosButton: { width: 200, height: 200, borderRadius: 100, backgroundColor: '#CE2029', justifyContent: 'center', alignItems: 'center', elevation: 10 },
  sosText: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  mapWrapper: { height: 250, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#CE2029', marginBottom: 20 },
  map: { flex: 1 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  dropdown: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, overflow: 'hidden' },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  infoCard: { backgroundColor: '#fff', padding: 20, borderRadius: 18, elevation: 3, marginBottom: 30 },
  info: { fontSize: 16, marginBottom: 8 },
});