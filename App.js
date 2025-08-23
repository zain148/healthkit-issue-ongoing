import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  Button,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  AppState,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import * as HealthKit from "@kingstinct/react-native-healthkit";
import AsyncStorage from "@react-native-async-storage/async-storage";

const heartRateType = "HKQuantityTypeIdentifierHeartRate";

export default function App() {
  const [authStatus, setAuthStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [heartRate, setHeartRate] = useState(null);
  const [error, setError] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState("Not started");
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const anchorRef = useRef(null);
  const subscriptionRef = useRef(null);
  const observerQueryRef = useRef(null);
  const ANCHOR_STORAGE_KEY = "hk_anchor_heartRate";

  const loadAnchor = async () => {
    try {
      const v = await AsyncStorage.getItem(ANCHOR_STORAGE_KEY);
      console.log("📎 Loaded anchor from storage:", v ? v.substring(0, 12) + "..." : "<none>");
      return v || null;
    } catch (_e) {
      console.error("Error loading anchor:", _e);
      return null;
    }
  };

  const saveAnchor = async (anchor) => {
    try {
      if (anchor) {
        await AsyncStorage.setItem(ANCHOR_STORAGE_KEY, anchor);
        console.log("💾 Saved anchor:", anchor.substring(0, 12) + "...");
      }
    } catch (_e) {
      console.error("Error saving anchor:", _e);
    }
  };

  const resetAnchor = async () => {
    try {
      anchorRef.current = null;
      await AsyncStorage.removeItem(ANCHOR_STORAGE_KEY);
      console.log("🔁 Anchor reset. Next query will fetch from beginning.");
    } catch (_e) {
      console.error("Error resetting anchor:", _e);
    }
  };

  // Enhanced anchor-based delta fetch with better error handling
  const fetchHeartRateDeltas = async () => {
    try {
      console.log("🔍 Fetching heart rate deltas with anchor:", anchorRef.current ? anchorRef.current.substring(0, 12) + "..." : "<none>");
      
      const { newAnchor, samples } = await HealthKit.queryQuantitySamplesWithAnchor(heartRateType, {
        limit: 0, // Get all new samples
        anchor: anchorRef.current || undefined,
        filter: {
          from: new Date(Date.now() - 1000 * 60 * 60 * 24), // Last 24 hours as fallback
        },
      });

      console.log(`📥 Delta query returned ${samples?.length || 0} samples`);

      if (newAnchor && newAnchor !== anchorRef.current) {
        anchorRef.current = newAnchor;
        await saveAnchor(newAnchor);
        console.log("🔗 Updated anchor to:", newAnchor.substring(0, 12) + "...");
      }

      if (samples && samples.length > 0) {
        // Sort samples by start date to get the most recent
        const sortedSamples = samples.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        const latest = sortedSamples[0];
        
        setHeartRate(latest);
        setLastUpdateTime(new Date());
        
        console.log(
          `💓 Received ${samples.length} new samples. Latest: ${latest.quantity} BPM at ${new Date(latest.startDate).toLocaleTimeString()}`
        );
        
        // Log all samples for debugging
        samples.forEach((sample, index) => {
          console.log(`Sample ${index}: ${sample.quantity} BPM at ${new Date(sample.startDate).toLocaleTimeString()}`);
        });
      } else {
        console.log("📭 No new samples since last anchor");
      }
    } catch (e) {
      console.error("❌ Anchor query failed:", e);
      setError("Delta fetch failed: " + e.message);
      
      // Fallback to regular query if anchor query fails
      try {
        console.log("🔄 Falling back to regular query...");
        await getLatestHeartRate();
      } catch (fallbackError) {
        console.error("❌ Fallback query also failed:", fallbackError);
      }
    }
  };

  // Request HealthKit permissions for heart rate
  const requestPermissions = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔐 Requesting HealthKit permissions for:", heartRateType);

      // Request authorization for reading heart rate
      const authResult = await HealthKit.requestAuthorization([], [heartRateType]);
      console.log("✅ Authorization result:", authResult);

      // Check if we actually got permission
      const authStatus = await HealthKit.getRequestStatusForAuthorization([], [heartRateType]);
      console.log("📋 Auth status:", authStatus);

      // Try to read a sample to verify permissions
      try {
        const sample = await HealthKit.getMostRecentQuantitySample(heartRateType, "count/min");
        console.log("🔍 Initial sample:", sample);
        if (sample) {
          setHeartRate(sample);
          setLastUpdateTime(new Date());
        }
      } catch (sampleError) {
        console.log("⚠️ Could not read initial sample:", sampleError.message);
      }

      setAuthStatus(true);
      setLoading(false);
    } catch (err) {
      console.error("❌ Permission error:", err);
      setError("Failed to request permissions: " + err.message);
      setLoading(false);
    }
  };

  // Get the latest heart rate data
  const getLatestHeartRate = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔍 Querying latest heart rate...");

      // Query the most recent heart rate sample
      const mostRecentHeartRate = await HealthKit.getMostRecentQuantitySample(
        heartRateType,
        "count/min"
      );

      if (mostRecentHeartRate) {
        console.log(
          "💓 Most recent heart rate:",
          mostRecentHeartRate.quantity,
          "BPM at",
          new Date(mostRecentHeartRate.startDate).toLocaleString()
        );
        setHeartRate(mostRecentHeartRate);
        setLastUpdateTime(new Date());
      } else {
        console.log("📭 No heart rate data found");
        setHeartRate(null);
      }
      setLoading(false);
    } catch (err) {
      console.error("❌ Error getting heart rate:", err);
      setError("Failed to get heart rate: " + err.message);
      setLoading(false);
    }
  };

  // Force sync with HealthKit (helps with Watch → iPhone sync delays)
  const forceSyncHealthKit = async () => {
    try {
      console.log("🔄 Forcing HealthKit sync...");
      setLoading(true);

      // Query multiple recent samples to force a sync
      const samples = await HealthKit.queryQuantitySamples(heartRateType, {
        limit: 10, // Get last 10 samples
        from: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      });

      console.log(`📊 Found ${samples?.samples?.length || 0} heart rate samples in last 24h`);

      if (samples?.samples?.length > 0) {
        // Show all recent samples for debugging
        samples.samples.forEach((sample, index) => {
          console.log(
            `Sample ${index}: ${sample.quantity} BPM at ${new Date(
              sample.startDate
            ).toLocaleTimeString()}`
          );
        });

        const latest = samples.samples[0];
        console.log(
          "✅ Latest from sync:",
          latest.quantity,
          "BPM at",
          new Date(latest.startDate).toLocaleString()
        );
        setHeartRate(latest);
      } else {
        console.log("⚠️ No heart rate samples found in last 24 hours");
        setError("No recent heart rate data found. Start a workout on your Apple Watch.");
      }

      setLoading(false);
    } catch (err) {
      console.error("❌ Error syncing HealthKit:", err);
      setError("Sync failed: " + err.message);
      setLoading(false);
    }
  };

  // Check Watch connectivity and sync status
  const checkWatchStatus = async () => {
    try {
      console.log("🔍 Checking HealthKit data sources...");

      // Get sources to see if Watch is contributing data
      const samples = await HealthKit.queryQuantitySamples(heartRateType, { limit: 5 });

      if (samples?.samples?.length > 0) {
        samples.samples.forEach((sample) => {
          const source = sample.sourceRevision?.source?.name || "Unknown";
          const device = sample.device?.name || "Unknown device";
          console.log(`📱 Source: ${source}, Device: ${device}`);
        });
      }
    } catch (err) {
      console.error("Error checking sources:", err);
    }
  };

  // Check if HealthKit is available when component mounts
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

  // Enhanced HealthKit subscription with observer queries
  const setupHealthKitSubscription = async () => {
    try {
      console.log("🔧 Setting up enhanced HealthKit subscription...");
      setSubscriptionStatus("Setting up...");

      // Clean up any existing subscription
      if (subscriptionRef.current && typeof subscriptionRef.current === "function") {
        console.log("🧹 Cleaning up existing subscription");
        subscriptionRef.current();
        subscriptionRef.current = null;
      }

      // Step 1: Enable background delivery with immediate frequency
      console.log("🔧 Enabling background delivery...");
      const bgDeliveryResult = await HealthKit.enableBackgroundDelivery(
        heartRateType,
        HealthKit.UpdateFrequency.immediate
      );
      console.log("✅ Background delivery result:", bgDeliveryResult);

      // Step 2: Load persisted anchor
      const storedAnchor = await loadAnchor();
      anchorRef.current = storedAnchor;

      // Step 3: Set up the subscription with enhanced callback
      console.log("🔧 Setting up subscription callback...");
      subscriptionRef.current = HealthKit.subscribeToChanges(heartRateType, (error) => {
        const timestamp = new Date().toLocaleTimeString();
        
        if (error) {
          console.error(`❌ [${timestamp}] Subscription error:`, error);
          setError("Subscription error: " + error.message);
          setSubscriptionStatus("Error: " + error.message);
          return;
        }

        console.log(`🔔 [${timestamp}] Heart rate data changed! Fetching deltas...`);
        setSubscriptionStatus(`Active - Last trigger: ${timestamp}`);
        
        // Use delta fetching for efficiency
        fetchHeartRateDeltas();
      });

      console.log("✅ Subscription set up successfully");
      setSubscriptionStatus("Active - Waiting for changes");

      // Step 4: Get initial data using delta fetch
      console.log("🔍 Fetching initial data...");
      await fetchHeartRateDeltas();

      return true;
    } catch (error) {
      console.error("❌ Error setting up HealthKit subscription:", error);
      setError("Failed to set up heart rate monitoring: " + error.message);
      setSubscriptionStatus("Failed: " + error.message);
      return false;
    }
  };

  // Handle app state changes to ensure subscription persists
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log(`📱 App state changed to: ${nextAppState}`);
      
      if (nextAppState === 'active' && authStatus) {
        console.log("🔄 App became active, refreshing heart rate data...");
        // Fetch latest data when app becomes active
        setTimeout(() => {
          fetchHeartRateDeltas();
        }, 1000); // Small delay to ensure the app is fully active
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [authStatus]);

  // Main subscription effect
  useEffect(() => {
    if (!authStatus) {
      setSubscriptionStatus("Not authorized");
      return;
    }

    setupHealthKitSubscription();

    // Cleanup function
    return () => {
      if (subscriptionRef.current && typeof subscriptionRef.current === "function") {
        console.log("🧹 Cleaning up subscription on unmount...");
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
      setSubscriptionStatus("Cleaned up");
    };
  }, [authStatus]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>HealthKit Heart Rate Monitor</Text>

        {!authStatus ? (
          <Button
            title="Request HealthKit Permissions"
            onPress={requestPermissions}
            disabled={loading}
          />
        ) : (
          <>
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
                {lastUpdateTime && (
                  <Text style={styles.updateText}>
                    Last updated: {lastUpdateTime.toLocaleTimeString()}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.noData}>No heart rate data available</Text>
            )}

            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Subscription Status:</Text>
              <Text style={styles.statusText}>{subscriptionStatus}</Text>
            </View>

            <Button
              title="Refresh Heart Rate"
              onPress={getLatestHeartRate}
              disabled={loading}
              style={styles.refreshButton}
            />

            <Button
              title="Force Sync from Watch"
              onPress={forceSyncHealthKit}
              disabled={loading}
              color="#FF6B35"
            />

            <Button
              title="Check Watch Status"
              onPress={checkWatchStatus}
              disabled={loading}
              color="#8A2BE2"
            />

            <Button
              title="Reset Anchor & Restart"
              onPress={async () => {
                await resetAnchor();
                await setupHealthKitSubscription();
              }}
              disabled={loading}
              color="#FF1744"
            />
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
  dataContainer: {
    alignItems: "center",
    marginVertical: 20,
    padding: 20,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    width: "100%",
  },
  heartRateValue: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#FF5733",
  },
  dateText: {
    marginTop: 10,
    color: "#666",
  },
  sourceText: {
    marginTop: 5,
    color: "#666",
    fontStyle: "italic",
  },
  updateText: {
    marginTop: 5,
    color: "#008000",
    fontSize: 12,
  },
  statusContainer: {
    marginVertical: 15,
    padding: 10,
    backgroundColor: "#e8f4f8",
    borderRadius: 8,
    width: "100%",
  },
  statusLabel: {
    fontWeight: "bold",
    marginBottom: 5,
  },
  statusText: {
    color: "#2196F3",
    fontSize: 12,
  },
  noData: {
    fontSize: 16,
    fontStyle: "italic",
    color: "#666",
    marginVertical: 20,
  },
  refreshButton: {
    marginTop: 20,
  },
  errorText: {
    color: "red",
    marginTop: 20,
    textAlign: "center",
  },
});
