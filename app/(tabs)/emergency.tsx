import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from "react-native-safe-area-context";

const HOLD_DURATION_MS = 5000;
const BUTTON_SIZE = 220;
const RING_SIZE = 240;
const RING_STROKE = 6;

export default function EmergencyScreen() {
  const [profileName, setProfileName] = useState<string | null>(null);
  const [barangay, setBarangay] = useState<string>('Unknown Barangay');
  const [street, setStreet] = useState<string>('Unknown Street');
  const [fullAddress, setFullAddress] = useState<string>('Unknown Address');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [emergencyLocation, setEmergencyLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<string | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(HOLD_DURATION_MS / 1000);

  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const loadProfileName = async () => {
      try {
        const savedName = await AsyncStorage.getItem('userName');
        const savedBarangay = await AsyncStorage.getItem('userBarangay');
        const savedStreet = await AsyncStorage.getItem('userStreet');
        const savedFullAddress = await AsyncStorage.getItem('userFullAddress');

        if (savedName) {
          setProfileName(savedName);
        } else {
          setProfileName('Maria S. Santos');
        }
        if (savedBarangay) {
          setBarangay(savedBarangay);
        }
        if (savedStreet) {
          setStreet(savedStreet);
        }
        if (savedFullAddress) {
          setFullAddress(savedFullAddress);
        } else if (savedStreet && savedBarangay) {
          setFullAddress(`${savedStreet}, ${savedBarangay}`);
        }
      } catch {
        setProfileName('Maria S. Santos');
      }
    };

    loadProfileName();

    // Auto-fetch phone GPS location when screen opens.
    if (!location) {
      fetchLocation();
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      animationRef.current?.stop();
    };
  }, []);

  const requestPermission = async () => {
    if (locationPermission === 'granted') {
      return true;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status);
    return status === 'granted';
  };

  const resetProgress = () => {
    progress.setValue(0);
    setIsHolding(false);
    setHasCompleted(false);
    setSecondsLeft(HOLD_DURATION_MS / 1000);
  };

  const startCountdown = () => {
    setSecondsLeft(HOLD_DURATION_MS / 1000);

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const fetchLocation = async () => {
    setIsFetchingLocation(true);
    setLocationError(null);

    const hasPermission = await requestPermission();
    if (!hasPermission) {
      setLocationError('Location permission denied. Please allow location to use this feature.');
      setLocation(null);
      setIsFetchingLocation(false);
      return;
    }

    try {
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const currentCoords = {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      };
      setLocation(currentCoords);
      if (!emergencyLocation) {
        setEmergencyLocation(currentCoords);
      }
      setIsFetchingLocation(false);
    } catch (error) {
      setLocation(null);
      setLocationError('Unable to fetch location. Please ensure location services are enabled.');
      setIsFetchingLocation(false);
    }
  };

  const startHoldAnimation = () => {
    setIsHolding(true);
    setHasCompleted(false);
    startCountdown();

    animationRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_DURATION_MS,
      useNativeDriver: true,
    });

    animationRef.current.start(({ finished }) => {
      if (finished) {
        setHasCompleted(true);
        setSecondsLeft(0);
      }
    });
  };

  const stopHoldAnimation = () => {
    setIsHolding(false);

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (animationRef.current) {
      animationRef.current.stop();
    }

    resetProgress();
  };

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isProgressVisible = isHolding || hasCompleted;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.bigHeader}>
          <Text style={styles.bigHeaderText}>EMERGENCY</Text>
        </View>
        <Text style={styles.headerTitle}>Emergency Button</Text>
        <Text style={styles.subheaderTitle}>Hold for 5 seconds to call rescue</Text>

        <View style={styles.buttonWrapper}>
          <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { transform: [{ rotate }], opacity: isProgressVisible ? 1 : 0 },
          ]}
          />

          <Pressable
            onPressIn={startHoldAnimation}
            onPressOut={stopHoldAnimation}
            style={styles.button}
            android_ripple={{ color: 'rgba(255,255,255,0.2)', radius: BUTTON_SIZE / 2 }}
          >
            <Text style={styles.buttonText}>
              {isHolding ? `${secondsLeft}s` : 'tap and hold'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.mapContainer}>
          {location ? (
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              region={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              showsUserLocation
              showsMyLocationButton
            >
              <Marker
                coordinate={emergencyLocation ?? location}
                title="Emergency Pin"
                description="This is the emergency location"
                pinColor="red"
              />
            </MapView>
          ) : (
            <View style={styles.noMapView}>
              <Text style={styles.infoText}>
                {isFetchingLocation ? 'Fetching location map...' : 'Location unavailable for map'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>Name: {profileName ?? 'Unknown'}</Text>
          <Text style={styles.infoText}>
            Coordinates:{' '}
            {isFetchingLocation
              ? 'Fetching location...'
              : location
              ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
              : locationError
              ? locationError
              : 'Unavailable'}
          </Text>
          <Text style={styles.infoText}>Barangay: {barangay}</Text>
          <Text style={styles.infoText}>Street: {street}</Text>
          <Text style={[styles.infoText, styles.fullAddressText]}>Full Address: {fullAddress}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F6F9",
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 100,
    backgroundColor: '#f8f8f8',
  },
  bigHeader: {
    width: '100%',
    height: 120,
    backgroundColor: '#2563EB',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  bigHeaderText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "black",
    marginBottom: 6,
  },
  subheaderTitle: {
    fontSize: 16,
    color: "#475569",
    marginBottom: 24,
  },
  buttonWrapper: {
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 6,
    borderTopColor: '#CE2029',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  button: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#CE2029',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  infoCard: {
    marginTop: 24,
    width: '95%',
    maxWidth: 500,
    padding: 18,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  infoText: {
    fontSize: 18,
    color: '#111827',
    marginBottom: 8,
  },
  fullAddressText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  profileInfo: {
    marginLeft: 12,
  },
  profileTitle: {
    fontSize: 14,
    color: '#475569',
  },
  mapContainer: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 16,
    marginTop: 12,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  noMapView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  refreshButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
