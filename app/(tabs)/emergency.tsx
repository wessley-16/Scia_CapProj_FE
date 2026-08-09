import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { sendSOSAlert, subscribeToSOSAlert } from '../../lib/firebase';

const HOLD_DURATION_MS = 5000;
const COOLDOWN_MS = 5 * 60 * 1000;

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

// Google's own free "embed" endpoint — no API key needed. It's a single,
// self-contained page from Google's own servers, unlike the old Leaflet
// setup which had to separately load leaflet.js, leaflet.css, tile images,
// and marker-icon images from three different third-party CDNs (unpkg,
// OpenStreetMap, GitHub, cdnjs) — if any one of those failed to load on a
// spotty connection, the marker or the whole map showed up as a broken image.
const buildGoogleMapsEmbedUrl = (lat: number, lng: number) =>
  `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;

const buildGoogleMapsAppUrl = (lat: number, lng: number) =>
  Platform.OS === 'ios'
    ? `maps:0,0?q=${lat},${lng}`
    : `geo:${lat},${lng}?q=${lat},${lng}(SOS+Location)`;

const buildGoogleMapsWebUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export default function EmergencyScreen() {
  const { fontScale, t } = useSettings();
  const { user } = useAuth();

  const [location, setLocation] = useState<any>(null);
  const [name, setName] = useState('');
  const [fullAddress, setFullAddress] = useState('Fetching...');
  const [barangay, setBarangay] = useState('');

  const [isHolding, setIsHolding] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);

  const progress = useRef(new Animated.Value(0)).current;
  const countdownInterval = useRef<any>(null);
  const animRef = useRef<any>(null);

  const [lastSOS, setLastSOS] = useState<number | null>(null);
  const [cooldownActive, setCooldownActive] = useState(false);

  const [activeSosId, setActiveSosId] = useState<string | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const sosUnsubRef = useRef<(() => void) | null>(null);

  const [mapKey, setMapKey] = useState(0);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);

  useEffect(() => {
    fetchLocation();
    return () => { sosUnsubRef.current?.(); };
  }, []);

  useEffect(() => {
    if (user) {
      setName(`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown');
    } else {
      AsyncStorage.getItem('userName').then(stored => { setName(stored || 'Unknown'); });
    }
  }, [user]);

  useEffect(() => {
    if (!activeSosId) return;
    sosUnsubRef.current?.();
    sosUnsubRef.current = subscribeToSOSAlert(activeSosId, (data) => {
      if (data.status && data.status !== 'pending') setDispatchStatus(data.status);
    });
    return () => sosUnsubRef.current?.();
  }, [activeSosId]);

  const fetchLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location access is required to send SOS alerts.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setLocation(coords);
    setMapLoadFailed(false);
    setMapKey(k => k + 1);

    const geo = await Location.reverseGeocodeAsync(loc.coords);
    if (geo.length > 0) {
      const place: any = geo[0];
      setFullAddress(`${place.street || ''}, ${place.city || ''}`);
      setBarangay(getBarangayFromCoords(coords.latitude, coords.longitude));
    }
  };

  const handleRetryMap = () => {
    setMapLoadFailed(false);
    setMapKey(k => k + 1);
  };

  const openInMapsApp = () => {
    if (!location) return;
    const appUrl = buildGoogleMapsAppUrl(location.latitude, location.longitude);
    Linking.openURL(appUrl).catch(() => {
      Linking.openURL(buildGoogleMapsWebUrl(location.latitude, location.longitude));
    });
  };

  const startHold = () => {
    setIsHolding(true);
    setSecondsLeft(5);
    countdownInterval.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === 1) { clearInterval(countdownInterval.current); triggerSOS(); return 0; }
        return prev - 1;
      });
    }, 1000);
    animRef.current = Animated.timing(progress, {
      toValue: 1, duration: HOLD_DURATION_MS, useNativeDriver: true,
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
      const docId = await sendSOSAlert({
        name, latitude: location.latitude, longitude: location.longitude,
        address: fullAddress, barangay,
      });
      setActiveSosId(docId);
      setDispatchStatus(null);
      setLastSOS(now);
      setCooldownActive(true);
      setTimeout(() => setCooldownActive(false), COOLDOWN_MS);
      Alert.alert('SOS Sent', 'Your location has been shared with responders. You will be notified when a responder is dispatched.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to send SOS. Please try again.');
    }
  };

  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const isDispatched = dispatchStatus && dispatchStatus !== 'pending';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top bar — centered title, no settings button */}
      <View style={styles.topBar}>
        <Ionicons name="alert-circle" size={22} color="#fff" style={styles.topBarIcon} />
        <Text style={[styles.topBarTitle, { fontSize: 20 * fontScale }]}>EMERGENCY</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* SOS button */}
        <View style={styles.sosArea}>
          <Text style={[styles.sosLabel, { fontSize: 15 * fontScale }]}>
            Press and hold for <Text style={styles.sosLabelBold}>5 seconds</Text> to send an alert
          </Text>
          <View style={styles.sosOuter}>
            <View style={styles.sosDashedRing} />
            <Animated.View style={[styles.sosSpinRing, { transform: [{ rotate }] }]} />
            <Pressable
              onPressIn={startHold}
              onPressOut={stopHold}
              disabled={cooldownActive}
              style={[styles.sosButton, { opacity: cooldownActive ? 0.75 : 1 }]}
              accessibilityLabel="SOS button"
              accessibilityHint="Hold for 5 seconds to send an emergency alert"
            >
              <Ionicons name="alert-circle-outline" size={38} color="#fff" style={{ marginBottom: 4 }} />
              <Text style={[styles.sosText, { fontSize: 24 * fontScale }]}>
                {cooldownActive ? 'SENT' : isHolding ? String(secondsLeft) : 'HOLD'}
              </Text>
              <Text style={[styles.sosSubText, { fontSize: 12 * fontScale }]}>
                {cooldownActive ? 'Alert sent' : '5 seconds'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Status banners */}
        {isDispatched && (
          <View style={[styles.banner, styles.bannerDispatched]}>
            <Ionicons name="checkmark-circle" size={24} color="#065F46" style={styles.bannerIcon} />
            <View style={styles.bannerTextWrap}>
              <Text style={[styles.bannerTitle, styles.bannerTitleDispatched, { fontSize: 15 * fontScale }]}>
                Responder dispatched
              </Text>
              <Text style={[styles.bannerBody, styles.bannerBodyDispatched, { fontSize: 14 * fontScale }]}>
                A responder has been sent to your location. Stay calm and stay where you are.
              </Text>
            </View>
          </View>
        )}

        {cooldownActive && !isDispatched && (
          <View style={[styles.banner, styles.bannerWaiting]}>
            <Ionicons name="time-outline" size={24} color="#D97706" style={styles.bannerIcon} />
            <View style={styles.bannerTextWrap}>
              <Text style={[styles.bannerTitle, styles.bannerTitleWaiting, { fontSize: 15 * fontScale }]}>
                Alert sent — waiting for responder
              </Text>
              <Text style={[styles.bannerBody, styles.bannerBodyWaiting, { fontSize: 14 * fontScale }]}>
                Your location has been shared. A responder will be assigned shortly.
              </Text>
            </View>
          </View>
        )}

        {/* Map */}
        <View style={styles.mapSection}>
          <Text style={[styles.sectionLabel, { fontSize: 13 * fontScale }]}>
            <Ionicons name="location-outline" size={14} color="#C0181F" /> Your pinned location
          </Text>
          <View style={styles.mapWrapper}>
            {mapLoadFailed ? (
              <View style={styles.mapPlaceholder}>
                <Ionicons name="cloud-offline-outline" size={36} color="#C0181F" style={{ opacity: 0.5, marginBottom: 8 }} />
                <Text style={[styles.mapPlaceholderText, { fontSize: 14 * fontScale, textAlign: 'center', paddingHorizontal: 16 }]}>
                  {t('mapLoadFailed')}
                </Text>
                <View style={styles.mapRetryRow}>
                  <TouchableOpacity style={styles.mapRetryBtn} onPress={handleRetryMap}>
                    <Ionicons name="refresh" size={16} color="#C0181F" />
                    <Text style={[styles.mapRetryBtnText, { fontSize: 13 * fontScale }]}>{t('retry')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.mapRetryBtn} onPress={openInMapsApp}>
                    <Ionicons name="open-outline" size={16} color="#C0181F" />
                    <Text style={[styles.mapRetryBtnText, { fontSize: 13 * fontScale }]}>{t('openInMaps')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : location ? (
              <WebView
                key={mapKey}
                source={{ uri: buildGoogleMapsEmbedUrl(location.latitude, location.longitude) }}
                style={styles.map}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                scrollEnabled={false}
                overScrollMode="never"
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.mapPlaceholder}>
                    <ActivityIndicator color="#C0181F" />
                  </View>
                )}
                onError={() => setMapLoadFailed(true)}
                onHttpError={() => setMapLoadFailed(true)}
              />
            ) : (
              <View style={styles.mapPlaceholder}>
                <Ionicons name="map-outline" size={40} color="#C0181F" style={{ opacity: 0.4, marginBottom: 8 }} />
                <Text style={[styles.mapPlaceholderText, { fontSize: 14 * fontScale }]}>Fetching location…</Text>
              </View>
            )}
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchLocation} accessibilityLabel="Refresh location">
              <Ionicons name="locate" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={[styles.infoCardTitle, { fontSize: 13 * fontScale }]}>Alert details</Text>

          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color="#C0181F" style={styles.infoIcon} />
            <View style={styles.infoField}>
              <Text style={[styles.infoKey, { fontSize: 12 * fontScale }]}>Name</Text>
              <Text style={[styles.infoVal, { fontSize: 16 * fontScale }]}>{name}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="home-outline" size={20} color="#C0181F" style={styles.infoIcon} />
            <View style={styles.infoField}>
              <Text style={[styles.infoKey, { fontSize: 12 * fontScale }]}>Address</Text>
              <Text style={[styles.infoVal, { fontSize: 16 * fontScale }]}>{fullAddress}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={20} color="#C0181F" style={styles.infoIcon} />
            <View style={styles.infoField}>
              <Text style={[styles.infoKey, { fontSize: 12 * fontScale }]}>Barangay</Text>
              <Text style={[styles.infoVal, { fontSize: 16 * fontScale }]}>{barangay}</Text>
            </View>
          </View>

          {activeSosId && (
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Ionicons name="radio-outline" size={20} color="#C0181F" style={styles.infoIcon} />
              <View style={styles.infoField}>
                <Text style={[styles.infoKey, { fontSize: 12 * fontScale }]}>Status</Text>
                <View style={[
                  styles.statusPill,
                  isDispatched ? styles.statusPillDispatched : styles.statusPillPending,
                ]}>
                  <Text style={[
                    styles.statusPillText,
                    isDispatched ? styles.statusPillTextDispatched : styles.statusPillTextPending,
                    { fontSize: 13 * fontScale },
                  ]}>
                    {isDispatched
                      ? dispatchStatus!.charAt(0).toUpperCase() + dispatchStatus!.slice(1)
                      : 'Pending'}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Instruction */}
        <View style={styles.instructionCard}>
          <Ionicons name="information-circle-outline" size={20} color="#EA580C" style={{ marginRight: 10, marginTop: 1 }} />
          <Text style={[styles.instructionText, { fontSize: 14 * fontScale }]}>
            Hold the red button for 5 seconds to send an emergency alert. Your pinned location will be shared with responders immediately.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:             { flex: 1, backgroundColor: '#F8F9FA' },

  // Top bar — centered, no settings button
  topBar:               { backgroundColor: '#C0181F', paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  topBarIcon:           { marginRight: 8 },
  topBarTitle:          { color: '#fff', fontSize: 20, fontWeight: '600', letterSpacing: 0.5 },

  scroll:               { padding: 20, paddingBottom: 120 },

  // SOS area
  sosArea:              { alignItems: 'center', paddingVertical: 24 },
  sosLabel:             { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  sosLabelBold:         { fontWeight: '700', color: '#C0181F' },
  sosOuter:             { width: 210, height: 210, borderRadius: 105, backgroundColor: '#FFE5E5', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#E08080' },
  sosDashedRing:        { position: 'absolute', inset: -12, width: 234, height: 234, borderRadius: 117, borderWidth: 2, borderStyle: 'dashed', borderColor: '#C0181F', opacity: 0.35 },
  sosSpinRing:          { position: 'absolute', width: 230, height: 230, borderRadius: 115, borderWidth: 3, borderTopColor: '#C0181F', borderRightColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent' },
  sosButton:            { width: 180, height: 180, borderRadius: 90, backgroundColor: '#C0181F', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#C0181F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10 },
  sosText:              { color: '#fff', fontSize: 24, fontWeight: '700', letterSpacing: 1 },
  sosSubText:           { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 3 },

  // Banners
  banner:               { borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1.5 },
  bannerWaiting:        { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
  bannerDispatched:     { backgroundColor: '#ECFDF5', borderColor: '#34D399' },
  bannerIcon:           { marginRight: 12, marginTop: 1 },
  bannerTextWrap:       { flex: 1 },
  bannerTitle:          { fontWeight: '600', marginBottom: 3 },
  bannerTitleWaiting:   { color: '#92400E' },
  bannerTitleDispatched:{ color: '#065F46' },
  bannerBody:           { lineHeight: 20 },
  bannerBodyWaiting:    { color: '#78350F' },
  bannerBodyDispatched: { color: '#047857' },

  // Map
  mapSection:           { marginBottom: 16 },
  sectionLabel:         { fontSize: 13, color: '#888', marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  mapWrapper:           { height: 200, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#C0181F' },
  map:                  { flex: 1 },
  mapPlaceholder:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  mapPlaceholderText:   { color: '#9CA3AF', fontSize: 14 },
  mapRetryRow:          { flexDirection: 'row', marginTop: 12, gap: 10 },
  mapRetryBtn:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#C0181F', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, gap: 6 },
  mapRetryBtnText:      { color: '#C0181F', fontWeight: '700' },
  refreshBtn:           { position: 'absolute', bottom: 10, right: 10, backgroundColor: '#C0181F', borderRadius: 22, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', elevation: 4 },

  // Info card
  infoCard:             { backgroundColor: '#fff', borderRadius: 16, borderWidth: 0.5, borderColor: '#E5E7EB', padding: 16, marginBottom: 16 },
  infoCardTitle:        { fontSize: 13, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  infoRow:              { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  infoRowLast:          { borderBottomWidth: 0 },
  infoIcon:             { marginRight: 12, marginTop: 2 },
  infoField:            { flex: 1 },
  infoKey:              { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  infoVal:              { fontSize: 16, color: '#111827', fontWeight: '600' },
  statusPill:           { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 20 },
  statusPillPending:    { backgroundColor: '#FEF3C7' },
  statusPillDispatched: { backgroundColor: '#D1FAE5' },
  statusPillText:       { fontSize: 13, fontWeight: '600' },
  statusPillTextPending:    { color: '#92400E' },
  statusPillTextDispatched: { color: '#065F46' },

  // Instruction
  instructionCard:      { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FED7AA', flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  instructionText:      { color: '#9A3412', fontSize: 14, lineHeight: 22, flex: 1 },
});
