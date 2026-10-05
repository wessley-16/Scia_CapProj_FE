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
import { canonicalBarangay } from '../../constants/valenzuelaDistricts';
import { barangayFromBoundaries } from '../../constants/barangayBoundaries';

const HOLD_DURATION_MS = 5000;
const COOLDOWN_MS = 5 * 60 * 1000;

// Google's free embed endpoint, no API key needed.
const buildGoogleMapsEmbedUrl = (lat: number, lng: number) =>
  `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;

// Wraps the embed URL in a real iframe, since a WebView loads a URL as the
// top-level document and Google's embed endpoint rejects that directly.
const buildGoogleMapsEmbedHtml = (lat: number, lng: number) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        html, body, iframe { margin: 0; padding: 0; width: 100%; height: 100%; border: 0; }
      </style>
    </head>
    <body>
      <iframe
        src="${buildGoogleMapsEmbedUrl(lat, lng)}"
        allowfullscreen
        loading="lazy"
      ></iframe>
    </body>
  </html>
`;

const buildGoogleMapsAppUrl = (lat: number, lng: number) =>
  Platform.OS === 'ios'
    ? `maps:0,0?q=${lat},${lng}`
    : `geo:${lat},${lng}?q=${lat},${lng}(SOS+Location)`;

const buildGoogleMapsWebUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

// How long we let the GPS try for its best (BestForNavigation) fix before
// giving up and settling for a faster, lower-accuracy one. Indoors or with a
// weak signal a high-accuracy fix can take a while (or never lock), and an
// SOS button can't just hang — it's better to send a slightly-less-precise
// location than none at all.
const HIGH_ACCURACY_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Location request timed out')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export default function EmergencyScreen() {
  const { fontScale, t } = useSettings();
  const { user } = useAuth();

  const [location, setLocation] = useState<any>(null);
  const [name, setName] = useState('');
  const [fullAddress, setFullAddress] = useState(t('emFetching'));
  const [barangay, setBarangay] = useState('');
  const [barangaySource, setBarangaySource] = useState<'boundary' | 'geocoder' | 'outside'>('boundary');
  const [accuracy, setAccuracy] = useState<number | null>(null);

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

  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

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
    setLocationError(null);
    setIsFetchingLocation(true);
    try {
      // Signup already asked for this once (see app/(auth)/signup.tsx), so on
      // a normal visit this is just a status check — no dialog, no delay.
      // Only fall through to an actual request if the user somehow reached
      // this screen without ever being asked (e.g. an account created before
      // that flow existed).
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        ({ status } = await Location.requestForegroundPermissionsAsync());
      }
      if (status !== 'granted') {
        setLocationError(t('emLocDeniedErr'));
        Alert.alert(
          t('emLocAccessTitle'),
          t('emLocAccessBody'),
          [
            { text: t('cancel'), style: 'cancel' },
            { text: t('emOpenSettings'), onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      // Permission can be "granted" while the device's location/GPS toggle is
      // off entirely (common on Android). Catch that up front instead of
      // letting getCurrentPositionAsync hang or throw a confusing error.
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationError(t('emLocOffErr'));
        Alert.alert(
          t('emLocOffTitle'),
          t('emLocOffBody'),
        );
        return;
      }

      // Ask for the most precise fix the device can give (real GPS lock, not
      // just cell/Wi-Fi triangulation) since a responder needs to find the
      // exact spot, not just the general area. Indoors or with a weak signal
      // that can take a while or never resolve, so we cap the wait and fall
      // back to a faster, still-reasonable fix rather than leaving the SOS
      // screen stuck with no location at all.
      let loc: Location.LocationObject;
      try {
        loc = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }),
          HIGH_ACCURACY_TIMEOUT_MS,
        );
      } catch {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }

      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setLocation(coords);
      setAccuracy(loc.coords.accuracy ?? null);
      setMapLoadFailed(false);
      setMapKey((k) => k + 1);

      // Barangay: decided by the real boundary polygons (offline, instant,
      // exact). No nearest-point guessing and no extra API needed.
      const hit = barangayFromBoundaries(coords.latitude, coords.longitude);
      if (hit) {
        setBarangay(hit.name);
        setBarangaySource('boundary');
      } else {
        setBarangay('');
        setBarangaySource('outside');
      }

      // Street/city text only, for the address line. Needs network, so it must
      // never block the SOS: on failure fall back to the raw coordinates.
      try {
        const geo = await Location.reverseGeocodeAsync(loc.coords);
        const place: any = geo[0];
        if (place) {
          const streetLine = [place.streetNumber, place.street].filter(Boolean).join(' ');
          setFullAddress([streetLine, place.city].filter(Boolean).join(', ') || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
          if (!hit && place.district) {
            // Outside Valenzuela: keep what the phone says so the alert still names the area.
            setBarangay(canonicalBarangay(place.district) ?? place.district);
          }
        } else {
          setFullAddress(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
        }
      } catch {
        setFullAddress(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
      }
    } catch (error: any) {
      setLocationError(t('emLocErrFallback'));
      Alert.alert(
        t('emLocErrTitle'),
        t('emLocErrBody'),
      );
    } finally {
      setIsFetchingLocation(false);
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
      Alert.alert(
        locationError ? t('emLocUnavailable') : t('emPleaseWait'),
        locationError ? t('emNoLocBody') : t('emStillFetching'),
      );
      return;
    }
    const now = Date.now();
    if (lastSOS && now - lastSOS < COOLDOWN_MS) {
      Alert.alert(t('emCooldownTitle'), t('emCooldownBody'));
      return;
    }
    try {
      const docId = await sendSOSAlert({
        name, latitude: location.latitude, longitude: location.longitude,
        address: fullAddress, barangay, barangaySource, accuracy,
        homeAddress: user?.address || '',
        homeBarangay: user?.barangay || '',
      });
      setActiveSosId(docId);
      setDispatchStatus(null);
      setLastSOS(now);
      setCooldownActive(true);
      setTimeout(() => setCooldownActive(false), COOLDOWN_MS);
      Alert.alert(t('emSosSentTitle'), t('emSosSentBody'));
    } catch (error: any) {
      Alert.alert(t('errorTitle'), t('emSosFailed'));
    }
  };

  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const isDispatched = dispatchStatus && dispatchStatus !== 'pending';
  // "Press and hold for {seconds} ..." with the seconds part rendered in bold.
  const [holdBefore, holdAfter] = t('emHoldLabel', { seconds: '|' }).split('|');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top bar, centered title, no settings button */}
      <View style={styles.topBar}>
        <Ionicons name="alert-circle" size={22} color="#fff" style={styles.topBarIcon} />
        <Text style={[styles.topBarTitle, { fontSize: 22 * fontScale }]}>{t('emTitle')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* SOS button */}
        <View style={styles.sosArea}>
          <Text style={[styles.sosLabel, { fontSize: 17 * fontScale }]}>
            {holdBefore}<Text style={styles.sosLabelBold}>{t('emFiveSeconds')}</Text>{holdAfter}
          </Text>
          <View style={styles.sosOuter}>
            <View style={styles.sosDashedRing} />
            <Animated.View style={[styles.sosSpinRing, { transform: [{ rotate }] }]} />
            <Pressable
              onPressIn={startHold}
              onPressOut={stopHold}
              disabled={cooldownActive}
              style={[styles.sosButton, { opacity: cooldownActive ? 0.75 : 1 }]}
              accessibilityLabel={t('emA11yButton')}
              accessibilityHint={t('emA11yHint')}
            >
              <Ionicons name="alert-circle-outline" size={38} color="#fff" style={{ marginBottom: 4 }} />
              <Text style={[styles.sosText, { fontSize: 24 * fontScale }]}>
                {cooldownActive ? t('emSent') : isHolding ? String(secondsLeft) : t('emHold')}
              </Text>
              <Text style={[styles.sosSubText, { fontSize: 16 * fontScale }]}>
                {cooldownActive ? t('emAlertSent') : t('emFiveSeconds')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Status banners */}
        {isDispatched && (
          <View style={[styles.banner, styles.bannerDispatched]}>
            <Ionicons name="checkmark-circle" size={24} color="#065F46" style={styles.bannerIcon} />
            <View style={styles.bannerTextWrap}>
              <Text style={[styles.bannerTitle, styles.bannerTitleDispatched, { fontSize: 17 * fontScale }]}>
                {t('emDispatchedTitle')}
              </Text>
              <Text style={[styles.bannerBody, styles.bannerBodyDispatched, { fontSize: 16 * fontScale }]}>
                {t('emDispatchedBody')}
              </Text>
            </View>
          </View>
        )}

        {cooldownActive && !isDispatched && (
          <View style={[styles.banner, styles.bannerWaiting]}>
            <Ionicons name="time-outline" size={24} color="#D97706" style={styles.bannerIcon} />
            <View style={styles.bannerTextWrap}>
              <Text style={[styles.bannerTitle, styles.bannerTitleWaiting, { fontSize: 17 * fontScale }]}>
                {t('emWaitingTitle')}
              </Text>
              <Text style={[styles.bannerBody, styles.bannerBodyWaiting, { fontSize: 16 * fontScale }]}>
                {t('emWaitingBody')}
              </Text>
            </View>
          </View>
        )}

        {/* Map */}
        <View style={styles.mapSection}>
          <Text style={[styles.sectionLabel, { fontSize: 15 * fontScale }]}>
            <Ionicons name="location-outline" size={14} color="#C0181F" /> Your pinned location
          </Text>
          <View style={styles.mapWrapper}>
            {mapLoadFailed ? (
              <View style={styles.mapPlaceholder}>
                <Ionicons name="cloud-offline-outline" size={36} color="#C0181F" style={{ opacity: 0.5, marginBottom: 8 }} />
                <Text style={[styles.mapPlaceholderText, { fontSize: 16 * fontScale, textAlign: 'center', paddingHorizontal: 16 }]}>
                  {t('mapLoadFailed')}
                </Text>
                <View style={styles.mapRetryRow}>
                  <TouchableOpacity style={styles.mapRetryBtn} onPress={handleRetryMap}>
                    <Ionicons name="refresh" size={16} color="#C0181F" />
                    <Text style={[styles.mapRetryBtnText, { fontSize: 15 * fontScale }]}>{t('retry')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.mapRetryBtn} onPress={openInMapsApp}>
                    <Ionicons name="open-outline" size={16} color="#C0181F" />
                    <Text style={[styles.mapRetryBtnText, { fontSize: 15 * fontScale }]}>{t('openInMaps')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : location ? (
              <WebView
                key={mapKey}
                source={{ html: buildGoogleMapsEmbedHtml(location.latitude, location.longitude) }}
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
            ) : locationError ? (
              <View style={styles.mapPlaceholder}>
                <Ionicons name="warning-outline" size={36} color="#C0181F" style={{ opacity: 0.6, marginBottom: 8 }} />
                <Text style={[styles.mapPlaceholderText, { fontSize: 16 * fontScale, textAlign: 'center', paddingHorizontal: 16 }]}>
                  {locationError}
                </Text>
                <View style={styles.mapRetryRow}>
                  <TouchableOpacity style={styles.mapRetryBtn} onPress={fetchLocation}>
                    <Ionicons name="refresh" size={16} color="#C0181F" />
                    <Text style={[styles.mapRetryBtnText, { fontSize: 15 * fontScale }]}>{t('retry')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.mapPlaceholder}>
                {isFetchingLocation ? (
                  <ActivityIndicator color="#C0181F" style={{ marginBottom: 8 }} />
                ) : (
                  <Ionicons name="map-outline" size={40} color="#C0181F" style={{ opacity: 0.4, marginBottom: 8 }} />
                )}
                <Text style={[styles.mapPlaceholderText, { fontSize: 16 * fontScale }]}>Fetching location…</Text>
              </View>
            )}
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchLocation} accessibilityLabel="Refresh location">
              <Ionicons name="locate" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={[styles.infoCardTitle, { fontSize: 15 * fontScale }]}>Alert details</Text>

          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color="#C0181F" style={styles.infoIcon} />
            <View style={styles.infoField}>
              <Text style={[styles.infoKey, { fontSize: 16 * fontScale }]}>Name</Text>
              <Text style={[styles.infoVal, { fontSize: 18 * fontScale }]}>{name}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="home-outline" size={20} color="#C0181F" style={styles.infoIcon} />
            <View style={styles.infoField}>
              <Text style={[styles.infoKey, { fontSize: 16 * fontScale }]}>Registered address (home)</Text>
              <Text style={[styles.infoVal, { fontSize: 18 * fontScale }]}>{user?.address || 'Not set'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={20} color="#C0181F" style={styles.infoIcon} />
            <View style={styles.infoField}>
              <Text style={[styles.infoKey, { fontSize: 16 * fontScale }]}>Current location (where you are now)</Text>
              <Text style={[styles.infoVal, { fontSize: 18 * fontScale }]}>
                {barangay ? t('emBrgy', { name: barangay }) : ''}{fullAddress}
              </Text>
            </View>
          </View>

          {activeSosId && (
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Ionicons name="radio-outline" size={20} color="#C0181F" style={styles.infoIcon} />
              <View style={styles.infoField}>
                <Text style={[styles.infoKey, { fontSize: 16 * fontScale }]}>{t('emStatus')}</Text>
                <View style={[
                  styles.statusPill,
                  isDispatched ? styles.statusPillDispatched : styles.statusPillPending,
                ]}>
                  <Text style={[
                    styles.statusPillText,
                    isDispatched ? styles.statusPillTextDispatched : styles.statusPillTextPending,
                    { fontSize: 15 * fontScale },
                  ]}>
                    {isDispatched
                      ? dispatchStatus!.charAt(0).toUpperCase() + dispatchStatus!.slice(1)
                      : t('emPending')}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Instruction */}
        <View style={styles.instructionCard}>
          <Ionicons name="information-circle-outline" size={20} color="#EA580C" style={{ marginRight: 10, marginTop: 1 }} />
          <Text style={[styles.instructionText, { fontSize: 16 * fontScale }]}>
            {t('emInstruction')}
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:             { flex: 1, backgroundColor: '#F8F9FA' },

  // Top bar, centered, no settings button
  topBar:               { backgroundColor: '#C0181F', paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  topBarIcon:           { marginRight: 8 },
  topBarTitle:          { color: '#fff', fontSize: 20, fontWeight: '600', letterSpacing: 0.5 },

  scroll:               { padding: 20, paddingBottom: 120 },

  // SOS area
  sosArea:              { alignItems: 'center', paddingVertical: 24 },
  sosLabel:             { fontSize: 17, color: '#374151', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  sosLabelBold:         { fontWeight: '700', color: '#C0181F' },
  sosOuter:             { width: 210, height: 210, borderRadius: 105, backgroundColor: '#FFE5E5', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#E08080' },
  sosDashedRing:        { position: 'absolute', inset: -12, width: 234, height: 234, borderRadius: 117, borderWidth: 2, borderStyle: 'dashed', borderColor: '#C0181F', opacity: 0.35 },
  sosSpinRing:          { position: 'absolute', width: 230, height: 230, borderRadius: 115, borderWidth: 3, borderTopColor: '#C0181F', borderRightColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent' },
  sosButton:            { width: 180, height: 180, borderRadius: 90, backgroundColor: '#C0181F', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#C0181F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10 },
  sosText:              { color: '#fff', fontSize: 24, fontWeight: '700', letterSpacing: 1 },
  sosSubText:           { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 3 },

  // Banners
  banner:               { borderRadius: 14, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1.5 },
  bannerWaiting:        { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
  bannerDispatched:     { backgroundColor: '#ECFDF5', borderColor: '#34D399' },
  bannerIcon:           { marginRight: 12, marginTop: 1 },
  bannerTextWrap:       { flex: 1 },
  bannerTitle:          { fontWeight: '600', marginBottom: 3, fontSize: 17 },
  bannerTitleWaiting:   { color: '#92400E' },
  bannerTitleDispatched:{ color: '#065F46' },
  bannerBody:           { lineHeight: 22, fontSize: 16 },
  bannerBodyWaiting:    { color: '#78350F' },
  bannerBodyDispatched: { color: '#047857' },

  // Map
  mapSection:           { marginBottom: 16 },
  sectionLabel:         { fontSize: 15, color: '#4B5563', marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  mapWrapper:           { height: 200, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#C0181F' },
  map:                  { flex: 1 },
  mapPlaceholder:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  mapPlaceholderText:   { color: '#4B5563', fontSize: 16 },
  mapRetryRow:          { flexDirection: 'row', marginTop: 12, gap: 10 },
  mapRetryBtn:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#C0181F', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, gap: 6, minHeight: 44 },
  mapRetryBtnText:      { color: '#C0181F', fontWeight: '700', fontSize: 15 },
  refreshBtn:           { position: 'absolute', bottom: 10, right: 10, backgroundColor: '#C0181F', borderRadius: 24, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', elevation: 4 },

  // Info card
  infoCard:             { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#D1D5DB', padding: 16, marginBottom: 16 },
  infoCardTitle:        { fontSize: 15, fontWeight: '600', color: '#6B7280', letterSpacing: 0.4, marginBottom: 12 },
  infoRow:              { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  infoRowLast:          { borderBottomWidth: 0 },
  infoIcon:             { marginRight: 12, marginTop: 2 },
  infoField:            { flex: 1 },
  infoKey:              { fontSize: 14, color: '#6B7280', marginBottom: 2 },
  infoVal:              { fontSize: 18, color: '#111827', fontWeight: '600' },
  statusPill:           { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusPillPending:    { backgroundColor: '#FEF3C7' },
  statusPillDispatched: { backgroundColor: '#D1FAE5' },
  statusPillText:       { fontSize: 15, fontWeight: '600' },
  statusPillTextPending:    { color: '#92400E' },
  statusPillTextDispatched: { color: '#065F46' },

  // Instruction
  instructionCard:      { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FED7AA', flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  instructionText:      { color: '#7C2D12', fontSize: 16, lineHeight: 24, flex: 1 },
});
