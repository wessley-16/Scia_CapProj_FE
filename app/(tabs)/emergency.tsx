import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";

const HOLD_DURATION_MS = 5000;
const BUTTON_SIZE = 300;
const RING_SIZE = 320;
const RING_STROKE = 6;

export default function EmergencyScreen() {
  const [profileName, setProfileName] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(true);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(HOLD_DURATION_MS / 1000);

  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Placeholder: replace with real profile fetch logic.
    setProfileName('Your Name');

    // Auto-fetch phone GPS location when screen opens.
    fetchLocation();

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      animationRef.current?.stop();
    };
  }, []);

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
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setIsFetchingLocation(false);
        },
        () => {
          setLocation(null);
          setIsFetchingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
      );
    } catch {
      setLocation(null);
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
        fetchLocation();
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
          <Text style={styles.headerTitle}>Emergency Button</Text>
          <Text style={styles.subheaderTitle}>( HOLD FOR 5 SECONDS TO CALL RESCUE )</Text>
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

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>Name: {profileName ?? 'Unknown'}</Text>
          <Text style={styles.infoText}>
            Location:{' '}
            {isFetchingLocation
              ? 'Fetching location...'
              : location
              ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
              : 'Unavailable'}
          </Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={fetchLocation}
            accessibilityLabel="Refresh location"
          >
            <Text style={styles.refreshButtonText}>Refresh Location</Text>
          </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "black",
    marginBottom: 10,
  },
  subheaderTitle: {
    fontSize: 20,
    color: "black",
    marginBottom: 40,
  },
  buttonWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_STROKE,
    borderTopColor: '#CE2029',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#CE2029',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 52,
    fontWeight: '600',
    textTransform: 'uppercase',
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
