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
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { SafeAreaView } from 'react-native-safe-area-context';

const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY"; // 🔴 PUT YOUR KEY HERE
const HOLD_DURATION_MS = 5000;

// Barangays (same as yours)
const valenzuelaBarangays = [
  { name: 'Bagbaguin', lat: 14.7046, lng: 120.9946 },
  { name: 'Balangkas', lat: 14.6945, lng: 120.9820 },
  { name: 'Bignay', lat: 14.7068, lng: 120.9925 },
  { name: 'Bisig', lat: 14.7170, lng: 120.9810 },
  { name: 'Canumay East', lat: 14.6935, lng: 120.9795 },
  { name: 'Canumay West', lat: 14.6929, lng: 120.9764 },
  { name: 'Coloong', lat: 14.7190, lng: 120.9802 },
  { name: 'Dalandanan', lat: 14.7010, lng: 120.9835 },
  { name: 'Gen. T. de Leon', lat: 14.7057, lng: 120.9863 },
  { name: 'Gen. Pio Valenzuela', lat: 14.7008, lng: 120.9825 },
  { name: 'Isla', lat: 14.6931, lng: 120.9972 },
  { name: 'Karuhatan', lat: 14.7029, lng: 120.9984 },
  { name: 'Lawang Bato', lat: 14.7058, lng: 120.9981 },
  { name: 'Lingunan', lat: 14.7033, lng: 120.9841 },
  { name: 'Mabolo', lat: 14.6958, lng: 120.9900 },
  { name: 'Malanday', lat: 14.7165, lng: 120.9830 },
  { name: 'Malinta', lat: 14.7014, lng: 120.9769 },
  { name: 'Mapulang Lupa', lat: 14.7074, lng: 120.9973 },
  { name: 'Marulas', lat: 14.7164, lng: 120.9911 },
  { name: 'Maysan', lat: 14.7198, lng: 120.9969 },
  { name: 'Palasan', lat: 14.6985, lng: 120.9905 },
  { name: 'Parada', lat: 14.7050, lng: 120.9790 },
  { name: 'Pariancillo Villa', lat: 14.7005, lng: 120.9877 },
  { name: 'Paso de Blas', lat: 14.7302, lng: 120.9910 },
  { name: 'Pasolo', lat: 14.7125, lng: 120.9785 },
  { name: 'Poblacion', lat: 14.7007, lng: 120.9859 },
  { name: 'Polo', lat: 14.7256, lng: 120.9824 },
  { name: 'Punturin', lat: 14.7284, lng: 120.9866 },
  { name: 'Rincon', lat: 14.7085, lng: 120.9788 },
  { name: 'Tagalag', lat: 14.7308, lng: 120.9872 },
  { name: 'Ugong', lat: 14.7200, lng: 120.9947 },
  { name: 'Veinte Reales', lat: 14.7061, lng: 120.9882 },
  { name: 'Wawang Pulo', lat: 14.7177, lng: 120.9854 },
];

const getBarangayFromCoords = (lat: number, lng: number): string => {
  let closest = { name: 'Unknown Barangay', dist: Number.MAX_VALUE };
  for (const b of valenzuelaBarangays) {
    const d = Math.hypot(lat - b.lat, lng - b.lng);
    if (d < closest.dist) closest = { name: b.name, dist: d };
  }
  return closest.name;
};

export default function EmergencyScreen() {
  const [location, setLocation] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);

  const [fullAddress, setFullAddress] = useState('Fetching...');
  const [barangay, setBarangay] = useState('');

  const [selectedEmergency, setSelectedEmergency] = useState('Fall');
  const [otherEmergency, setOtherEmergency] = useState('');

  const [isHolding, setIsHolding] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);

  const progress = useRef(new Animated.Value(0)).current;
  const countdownInterval = useRef<any>(null);

  useEffect(() => {
    fetchLocation();
  }, []);

  // 🚑 Simulate responder moving toward user
  useEffect(() => {
    let interval: any;

    if (location && destination) {
      interval = setInterval(() => {
        setDestination((prev: any) => ({
          latitude: prev.latitude + (location.latitude - prev.latitude) * 0.05,
          longitude: prev.longitude + (location.longitude - prev.longitude) * 0.05,
        }));
      }, 2000);
    }

    return () => clearInterval(interval);
  }, [location, destination]);

  const fetchLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied');
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});
    const coords = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };

    setLocation(coords);

    // 🚑 Set initial responder (far away)
    setDestination({
      latitude: coords.latitude + 0.02,
      longitude: coords.longitude + 0.02,
    });

    const geo = await Location.reverseGeocodeAsync(loc.coords);
    if (geo.length > 0) {
      const place: any = geo[0];
      setFullAddress(`${place.street || ''}, ${place.city || ''}`);
      setBarangay(getBarangayFromCoords(coords.latitude, coords.longitude));
    }
  };

  const startHold = () => {
    setIsHolding(true);
    setSecondsLeft(5);

    countdownInterval.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === 1) {
          clearInterval(countdownInterval.current);
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
    clearInterval(countdownInterval.current);
  };

  const triggerSOS = () => {
    Alert.alert('SOS Sent', 'Responder is on the way!');
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
          <Pressable onPressIn={startHold} onPressOut={stopHold} style={styles.sosButton}>
            <Text style={styles.sosText}>
              {isHolding ? secondsLeft : "HOLD"}
            </Text>
          </Pressable>
        </View>

        {/* MAP */}
        <View style={styles.mapWrapper}>
          {location && (
            <MapView
              style={styles.map}
              region={{
                ...location,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker coordinate={location} title="You" pinColor="red" />

              {destination && (
                <Marker coordinate={destination} title="Responder" pinColor="blue" />
              )}

              {/* 🧭 ROUTE LINE */}
              {destination && (
                <MapViewDirections
                  origin={destination}
                  destination={location}
                  apikey={GOOGLE_MAPS_API_KEY}
                  strokeWidth={5}
                  strokeColor="blue"
                />
              )}
            </MapView>
          )}
        </View>

        {/* DROPDOWN */}
        <Text style={styles.label}>Emergency Type</Text>
        <View style={styles.dropdown}>
          <Picker
            selectedValue={selectedEmergency}
            onValueChange={(val) => setSelectedEmergency(val)}
          >
            <Picker.Item label="Fall" value="Fall" />
            <Picker.Item label="Heart Attack" value="Heart Attack" />
            <Picker.Item label="Stroke" value="Stroke" />
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

        {/* INFO */}
        <View style={styles.infoCard}>
          <Text>Name: Maria S. Santos</Text>
          <Text>Address: {fullAddress}</Text>
          <Text>Barangay: {barangay}</Text>
          <Text>
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
  sosWrapper: { alignItems: 'center', marginVertical: 20 },
  ring: { position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 5, borderTopColor: '#CE2029', borderColor: 'transparent' },
  sosButton: { width: 200, height: 200, borderRadius: 100, backgroundColor: '#CE2029', justifyContent: 'center', alignItems: 'center', elevation: 10 },
  sosText: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  mapWrapper: { height: 250, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#CE2029', marginBottom: 20 },
  map: { flex: 1 },

  dropdown: { backgroundColor: '#fff', borderRadius: 10 },
  input: { backgroundColor: '#fff', padding: 10, marginTop: 10 },

  infoCard: { backgroundColor: '#fff', padding: 15, marginTop: 20 },

  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },

});