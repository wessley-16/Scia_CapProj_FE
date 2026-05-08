import AsyncStorage from '@react-native-async-storage/async-storage';
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
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { sendSOSAlert } from '../../lib/firebase';

// MapViewDirections removed — requires valid Google Maps API key
// If you add a real key, re-import MapViewDirections and uncomment the component below

const HOLD_DURATION_MS = 5000;

const valenzuelaBarangays = [
  { name: 'Bagbaguin',           lat: 14.7365, lng: 120.9920 },
  { name: 'Balangkas',           lat: 14.7015, lng: 120.9790 },
  { name: 'Bignay',              lat: 14.7250, lng: 120.9980 },
  { name: 'Bisig',               lat: 14.7160, lng: 120.9785 },
  { name: 'Canumay East',        lat: 14.7095, lng: 120.9925 },
  { name: 'Canumay West',        lat: 14.7065, lng: 120.9880 },
  { name: 'Coloong',             lat: 14.7205, lng: 120.9780 },
  { name: 'Dalandanan',          lat: 14.7035, lng: 120.9825 },
  { name: 'Gen. T. de Leon',     lat: 14.7120, lng: 120.9870 },
  { name: 'Gen. Pio Valenzuela', lat: 14.7040, lng: 120.9850 },
  { name: 'Isla',                lat: 14.6945, lng: 120.9950 },
  { name: 'Karuhatan',           lat: 14.7055, lng: 120.9890 },
  { name: 'Lawang Bato',         lat: 14.7155, lng: 120.9975 },
  { name: 'Lingunan',            lat: 14.7060, lng: 120.9830 },
  { name: 'Mabolo',              lat: 14.6995, lng: 120.9905 },
  { name: 'Malanday',            lat: 14.7190, lng: 120.9820 },
  { name: 'Malinta',             lat: 14.7045, lng: 120.9785 },
  { name: 'Mapulang Lupa',       lat: 14.7135, lng: 120.9965 },
  { name: 'Marulas',             lat: 14.7145, lng: 120.9915 },
  { name: 'Maysan',              lat: 14.7195, lng: 120.9950 },
  { name: 'Palasan',             lat: 14.7005, lng: 120.9915 },
  { name: 'Parada',              lat: 14.7085, lng: 120.9805 },
  { name: 'Pariancillo Villa',   lat: 14.7030, lng: 120.9865 },
  { name: 'Paso de Blas',        lat: 14.7290, lng: 120.9930 },
  { name: 'Pasolo',              lat: 14.7110, lng: 120.9795 },
  { name: 'Poblacion',           lat: 14.7080, lng: 120.9860 },
  { name: 'Polo',                lat: 14.7245, lng: 120.9835 },
  { name: 'Punturin',            lat: 14.7270, lng: 120.9875 },
  { name: 'Rincon',              lat: 14.7095, lng: 120.9795 },
  { name: 'Tagalag',             lat: 14.7320, lng: 120.9880 },
  { name: 'Ugong',               lat: 14.7205, lng: 120.9935 },
  { name: 'Veinte Reales',       lat: 14.7075, lng: 120.9895 },
  { name: 'Wawang Pulo',         lat: 14.7185, lng: 120.9845 },
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
  const { fontScale, t } = useSettings();
  const { user } = useAuth();
  const [location, setLocation] = useState<any>(null);

  const [name, setName] = useState('');
  const [fullAddress, setFullAddress] = useState('Fetching...');
  const [barangay, setBarangay] = useState('');

  const [selectedEmergency, setSelectedEmergency] = useState('Fall');
  const [otherEmergency, setOtherEmergency] = useState('');

  const [isHolding, setIsHolding] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);

  const progress = useRef(new Animated.Value(0)).current;
  const countdownInterval = useRef<any>(null);
  const animRef = useRef<any>(null);

  const [lastSOS, setLastSOS] = useState<number | null>(null);
  const [cooldownActive, setCooldownActive] = useState(false);

  useEffect(() => {
    fetchLocation();
  }, []);

  // Load user name from AuthContext or AsyncStorage fallback
  useEffect(() => {
    if (user) {
      setName(`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown');
    } else {
      AsyncStorage.getItem('userName').then(stored => {
        setName(stored || 'Unknown');
      });
    }
  }, [user]);

  const fetchLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location access is required to send SOS alerts.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setLocation(coords);

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

    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_DURATION_MS,
      useNativeDriver: true,
    });
    animRef.current.start();
  };

  const stopHold = () => {
    setIsHolding(false);
    progress.setValue(0);
    setSecondsLeft(5);
    clearInterval(countdownInterval.current);
    animRef.current?.stop();
  };

  const COOLDOWN_MS = 5 * 60 * 1000;

  const triggerSOS = async () => {
    if (!location) {
      Alert.alert('Location unavailable', 'Still fetching your location. Please wait a moment.');
      return;
    }
    const now = Date.now();
    if (lastSOS && now - lastSOS < COOLDOWN_MS) {
      Alert.alert('Cooldown Active', 'Please wait 5 minutes before sending another SOS.');
      return;
    }

    try {
      await sendSOSAlert({
        name,
        latitude:      location.latitude,
        longitude:     location.longitude,
        address:       fullAddress,
        barangay,
        emergencyType: selectedEmergency === 'Other' ? otherEmergency : selectedEmergency,
      });
      setLastSOS(now);
      setCooldownActive(true);
      setTimeout(() => setCooldownActive(false), COOLDOWN_MS);
      Alert.alert('🚨 SOS Sent', 'Emergency alert has been sent. Help is on the way!');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to send SOS. Please try again.');
    }
  };

  const rotate = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.header, { fontSize: 28 * fontScale }]}>EMERGENCY</Text>

        {/* SOS BUTTON */}
        <View style={styles.sosWrapper}>
          <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
          <Pressable
            onPressIn={startHold}
            onPressOut={stopHold}
            disabled={cooldownActive}
            style={[styles.sosButton, { opacity: cooldownActive ? 0.75 : 1 }]}
          >
            <Text style={[styles.sosText, { fontSize: 26 * fontScale }]}>
              {cooldownActive ? 'SENT' : isHolding ? secondsLeft : 'HOLD'}
            </Text>
          </Pressable>
        </View>

        {cooldownActive && (
          <View style={styles.cooldownBanner}>
            <Text style={styles.cooldownText}>✅ SOS alert was sent. Cooldown active (5 min).</Text>
          </View>
        )}

        {/* MAP */}
        <View style={styles.mapWrapper}>
          {location ? (
            <MapView
              style={styles.map}
              mapType="none"
              region={{
                latitude:      location.latitude,
                longitude:     location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <UrlTile
                urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
                flipY={false}
                tileSize={256}
                shouldReplaceMapContent
              />
              <Marker coordinate={location} title="Your Location" pinColor="red" />
            </MapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapPlaceholderText}>Fetching location...</Text>
            </View>
          )}
          {/* Refresh location button */}
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchLocation}>
            <Ionicons name="locate" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* DROPDOWN */}
        <Text style={[styles.label, { fontSize: 16 * fontScale }]}>{t('emergencyType')}</Text>
        <View style={styles.dropdown}>
          <Picker selectedValue={selectedEmergency} onValueChange={(val) => setSelectedEmergency(val)}>
            <Picker.Item label={t('fall')}        value="Fall" />
            <Picker.Item label={t('heartAttack')} value="Heart Attack" />
            <Picker.Item label={t('stroke')}      value="Stroke" />
            <Picker.Item label={t('other')}       value="Other" />
          </Picker>
        </View>

        {selectedEmergency === 'Other' && (
          <TextInput
            placeholder={t('typeEmergency')}
            value={otherEmergency}
            onChangeText={setOtherEmergency}
            style={styles.input}
          />
        )}

        {/* INFO CARD */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📋 Alert Details</Text>
          <Text style={styles.infoRow}>{t('infoName')} <Text style={styles.infoValue}>{name}</Text></Text>
          <Text style={styles.infoRow}>{t('infoAddress')} <Text style={styles.infoValue}>{fullAddress}</Text></Text>
          <Text style={styles.infoRow}>{t('infoBarangay')} <Text style={styles.infoValue}>{barangay}</Text></Text>
          <Text style={styles.infoRow}>
            {t('infoEmergency')} <Text style={styles.infoValue}>{selectedEmergency === 'Other' ? otherEmergency : selectedEmergency}</Text>
          </Text>
        </View>

        <View style={styles.instructionCard}>
          <Text style={styles.instructionText}>
            🆘 Hold the red button for 5 seconds to send an emergency alert to responders.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:           { flex: 1, backgroundColor: '#F9FAFB' },
  scroll:             { padding: 20, paddingBottom: 120 },
  header:             { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#CE2029', marginBottom: 20 },
  sosWrapper:         { alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  ring:               { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 5, borderTopColor: '#CE2029', borderColor: 'transparent' },
  sosButton:          { width: 200, height: 200, borderRadius: 100, backgroundColor: '#CE2029', justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#CE2029', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8 },
  sosText:            { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  cooldownBanner:     { backgroundColor: '#D1FAE5', borderRadius: 12, padding: 12, marginBottom: 12, alignItems: 'center' },
  cooldownText:       { color: '#065F46', fontWeight: '600', fontSize: 14 },
  mapWrapper:         { height: 250, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#CE2029', marginBottom: 20 },
  map:                { flex: 1 },
  mapPlaceholder:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  mapPlaceholderText: { color: '#9ca3af', fontSize: 14 },
  refreshBtn:         { position: 'absolute', bottom: 10, right: 10, backgroundColor: '#CE2029', borderRadius: 20, padding: 8, elevation: 4 },
  dropdown:           { backgroundColor: '#fff', borderRadius: 10, marginBottom: 10 },
  input:              { backgroundColor: '#fff', padding: 10, marginTop: 10, borderRadius: 8 },
  infoCard:           { backgroundColor: '#fff', padding: 16, marginTop: 16, borderRadius: 14, elevation: 2 },
  infoTitle:          { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 10 },
  infoRow:            { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  infoValue:          { color: '#111827', fontWeight: '600' },
  label:              { fontSize: 16, fontWeight: 'bold', marginBottom: 6, color: '#374151' },
  instructionCard:    { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: '#F59E0B' },
  instructionText:    { color: '#92400E', fontSize: 14, lineHeight: 20 },
});
