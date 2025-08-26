import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  Button,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import * as HealthKit from "@kingstinct/react-native-healthkit";
import HealthKitObserver, { HealthKitTypes } from "./src/HealthKitObserver";

export default function App() {
  const [authStatus, setAuthStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [heartRate, setHeartRate] = useState(null);
  const [error, setError] = useState(null);
  const [useObserver, setUseObserver] = useState(true);
  const [observerStatus, setObserverStatus] = useState("inactive");
  const [updateCount, setUpdateCount] = useState(0);
  const unsubscribeRef = useRef(null);

  // Request HealthKit permissions
  const requestPermissions = async () => {
    try {
      setLoading(true);
      const permissions = {
        permissions: {
          read: [HealthKit.HKQuantityTypeIdentifier.heartRate],
          write: [],
        },
      };

      const auth = await HealthKit.requestAuthorization(permissions);
      setAuthStatus(auth);
      
      if (auth) {
        console.log("✅ HealthKit permissions granted");
        // Enable background delivery
        await HealthKit.enableBackgroundDelivery(
          HealthKitTypes.HeartRate,
          HealthKit.UpdateFrequency.immediate
        );
      }
    } catch (err) {
      console.error("❌ Permission request failed:", err);
      setError("Failed to get permissions: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Setup observer-based subscription
  const setupObserverSubscription = async () => {
    if (!authStatus) return;

    try {
      setObserverStatus("connecting");
      console.log("🚀 Setting up HealthKit Observer...");

      // Subscribe to heart rate updates
      const unsubscribe = await HealthKitObserver.subscribe(
        HealthKitTypes.HeartRate,
        (data) => {
          if (data.error) {
            console.error("❌ Observer error:", data.message);
            setObserverStatus("error");
            setError(data.message);
            return;
          }

          setObserverStatus("active");
          setUpdateCount(prev => prev + 1);
          
          // Process the latest sample
          if (data.samples && data.samples.length > 0) {
            const latestSample = data.samples[0];
            console.log("💓 New heart rate via Observer:", latestSample.quantity, "BPM");
            
            setHeartRate({
              quantity: latestSample.quantity,
              unit: latestSample.unit,
              startDate: latestSample.startDate,
              endDate: latestSample.endDate,
              sourceRevision: {
                source: latestSample.source
              },
              device: latestSample.device
            });
            setError(null);
          }
        },
        {
          limit: 1,
          ascending: false
        }
      );

      unsubscribeRef.current = unsubscribe;
      console.log("✅ Observer subscription active");
      
      // Fetch initial data
      await getLatestHeartRate();
    } catch (err) {
      console.error("❌ Failed to setup observer:", err);
      setObserverStatus("error");
      setError("Observer setup failed: " + err.message);
    }
  };

  // Get the latest heart rate (for initial load and manual refresh)
  const getLatestHeartRate = async () => {
    try {
      setLoading(true);
      setError(null);

      const mostRecentHeartRate = await HealthKit.getMostRecentQuantitySample(
        HealthKitTypes.HeartRate,
        "count/min"
      );

      if (mostRecentHeartRate) {
        console.log("📊 Fetched heart rate:", mostRecentHeartRate.quantity, "BPM");
        setHeartRate(mostRecentHeartRate);
      } else {
        console.log("No heart rate data found");
        setHeartRate(null);
        setError("No heart rate data available. Start a workout on your Apple Watch.");
      }
      setLoading(false);
    } catch (err) {
      console.error("Error getting heart rate:", err);
      setError("Failed to get heart rate: " + err.message);
      setLoading(false);
    }
  };

  // Toggle between observer and polling modes
  const toggleMode = async () => {
    if (useObserver && unsubscribeRef.current) {
      // Switch to polling mode
      console.log("🔄 Switching to polling mode");
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      setObserverStatus("inactive");
    } else if (!useObserver) {
      // Switch to observer mode
      console.log("🔄 Switching to observer mode");
      await setupObserverSubscription();
    }
    setUseObserver(!useObserver);
  };

  // Setup subscription when auth status changes
  useEffect(() => {
    if (authStatus && useObserver) {
      setupObserverSubscription();
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [authStatus, useObserver]);

  // Check HealthKit availability
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const isAvailable = await HealthKit.isHealthDataAvailable();
        if (!isAvailable) {
          setError("HealthKit is not available on this device");
        }
      } catch (err) {
        setError("Error checking HealthKit availability: " + err.message);
      }
    };

    checkAvailability();
  }, []);

  const getStatusColor = () => {
    switch (observerStatus) {
      case "active": return "#4CAF50";
      case "connecting": return "#2196F3";
      case "error": return "#F44336";
      default: return "#9E9E9E";
    }
  };

  const getStatusText = () => {
    switch (observerStatus) {
      case "active": return "Observer Active - Real-time Updates";
      case "connecting": return "Connecting to Observer...";
      case "error": return "Observer Error - Check Logs";
      default: return "Observer Inactive";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>HealthKit Observer Demo</Text>
        
        {!authStatus ? (
          <Button
            title="Request HealthKit Permissions"
            onPress={requestPermissions}
            disabled={loading}
          />
        ) : (
          <>
            {/* Mode Toggle */}
            <View style={styles.modeContainer}>
              <Text style={styles.modeText}>Use Observer Mode:</Text>
              <Switch
                value={useObserver}
                onValueChange={toggleMode}
                trackColor={{ false: "#767577", true: "#81b0ff" }}
                thumbColor={useObserver ? "#2196F3" : "#f4f3f4"}
              />
            </View>

            {/* Observer Status */}
            {useObserver && (
              <View style={styles.statusContainer}>
                <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
                <Text style={styles.statusText}>{getStatusText()}</Text>
              </View>
            )}

            {/* Update Counter */}
            {useObserver && observerStatus === "active" && (
              <Text style={styles.updateCounter}>
                Live Updates Received: {updateCount}
              </Text>
            )}

            <Text style={styles.subtitle}>Heart Rate Data</Text>
            
            {loading ? (
              <ActivityIndicator size="large" color="#0000ff" />
            ) : heartRate ? (
              <View style={styles.dataContainer}>
                <Text style={styles.heartRateValue}>
                  {heartRate?.quantity?.toFixed(0) ?? 0} BPM
                </Text>
                <Text style={styles.dateText}>
                  Measured: {new Date(heartRate.startDate).toLocaleString()}
                </Text>
                <Text style={styles.sourceText}>
                  Source: {heartRate.sourceRevision?.source?.name || "Unknown"}
                </Text>
                {heartRate.device && (
                  <Text style={styles.deviceText}>
                    Device: {heartRate.device.name || "Unknown"}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.noData}>No heart rate data available</Text>
            )}

            <Button
              title="Manual Refresh"
              onPress={getLatestHeartRate}
              disabled={loading}
              style={styles.refreshButton}
            />

            {/* Debug Info */}
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>Debug Information:</Text>
              <Text style={styles.debugText}>
                Mode: {useObserver ? "Observer" : "Manual"}
              </Text>
              <Text style={styles.debugText}>
                Observer Status: {observerStatus}
              </Text>
              <Text style={styles.debugText}>
                Active Subscriptions: {useObserver && observerStatus === "active" ? "1" : "0"}
              </Text>
            </View>
          </>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <StatusBar style="auto" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 10,
  },
  modeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  modeText: {
    fontSize: 16,
    marginRight: 10,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: "#666",
  },
  updateCounter: {
    fontSize: 14,
    color: "#4CAF50",
    marginBottom: 10,
  },
  dataContainer: {
    alignItems: "center",
    marginVertical: 20,
    padding: 20,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    width: "100%",
  },
  heartRateValue: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#e53935",
  },
  dateText: {
    fontSize: 14,
    color: "#666",
    marginTop: 10,
  },
  sourceText: {
    fontSize: 12,
    color: "#888",
    marginTop: 5,
  },
  deviceText: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  noData: {
    fontSize: 16,
    color: "#999",
    marginVertical: 20,
  },
  refreshButton: {
    marginTop: 20,
  },
  debugContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    width: "100%",
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: "#666",
    marginVertical: 2,
  },
  errorText: {
    color: "red",
    marginTop: 20,
    textAlign: "center",
  },
});