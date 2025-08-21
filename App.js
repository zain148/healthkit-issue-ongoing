import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  Button,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
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
  const anchorRef = useRef(null);
  const ANCHOR_STORAGE_KEY = "hk_anchor_heartRate";

  // const loadAnchor = async () => {
  //   try {
  //     const v = await AsyncStorage.getItem(ANCHOR_STORAGE_KEY);
  //     return v || null;
  //   } catch (_e) {
  //     return null;
  //   }
  // };

  // const saveAnchor = async (anchor) => {
  //   try {
  //     if (anchor) {
  //       await AsyncStorage.setItem(ANCHOR_STORAGE_KEY, anchor);
  //     }
  //   } catch (_e) {}
  // };

  // const resetAnchor = async () => {
  //   try {
  //     anchorRef.current = null;
  //     await AsyncStorage.removeItem(ANCHOR_STORAGE_KEY);
  //     console.log("🔁 Anchor reset. Next query will fetch from beginning.");
  //   } catch (_e) {}
  // };

  // // Anchor-based delta fetch
  // const fetchHeartRateDeltas = async () => {
  //   try {
  //     const { newAnchor, samples } = await HealthKit.queryQuantitySamplesWithAnchor(heartRateType, {
  //       limit: 0,
  //       // anchor: anchorRef.current || undefined,
  //       filter: {
  //         from: new Date(Date.now() - 1000 * 60 * 60 * 24),
  //       },
  //     });

  //     if (newAnchor && newAnchor !== anchorRef.current) {
  //       anchorRef.current = newAnchor;
  //       await saveAnchor(newAnchor);
  //     }

  //     if (samples && samples.length > 0) {
  //       // Samples are returned newest-first in this lib; if not, sort by startDate desc
  //       const latest = samples[samples.length - 1];
  //       setHeartRate(latest);
  //       console.log(
  //         `📥 Received ${samples.length} new samples. Latest: ${latest.quantity} BPM at
  //           ${latest.startDate}`
  //       );
  //     } else {
  //       console.log("📭 No new samples since last anchor");
  //     }
  //   } catch (e) {
  //     console.error("Anchor query failed:", e);
  //   }
  // };

  // Request HealthKit permissions for heart rate
  const requestPermissions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the string identifier directly (library exports types, not enums)

      console.log("Using heart rate type:", heartRateType);

      // Request authorization for reading heart rate
      const authResult = await HealthKit.requestAuthorization([], [heartRateType]);
      console.log("Authorization result:", authResult);

      // Check if we actually got permission
      const authStatus = await HealthKit.getRequestStatusForAuthorization([], [heartRateType]);
      console.log("Auth status:", authStatus);

      // Try to read a sample to verify permissions
      try {
        const sample = await HealthKit.getMostRecentQuantitySample(heartRateType, "count/min");
        console.log("Initial sample:", sample);
        if (sample) {
          setHeartRate(sample);
        }
      } catch (sampleError) {
        console.log("Could not read initial sample:", sampleError.message);
      }

      setAuthStatus(true);
      setLoading(false);
    } catch (err) {
      console.error("Permission error:", err);
      setError("Failed to request permissions: " + err.message);
      setLoading(false);
    }
  };

  // Get the latest heart rate data
  const getLatestHeartRate = async () => {
    try {
      setLoading(true);
      setError(null);

      // Query the most recent heart rate sample
      const mostRecentHeartRate = await HealthKit.getMostRecentQuantitySample(
        heartRateType,
        "count/min"
      );

      if (mostRecentHeartRate) {
        console.log(
          "mostRecentHeartRate",
          mostRecentHeartRate.quantity,
          "at",
          new Date(mostRecentHeartRate.startDate)
        );
        setHeartRate(mostRecentHeartRate);
      } else {
        console.log("No heart rate data found");
        setHeartRate(null);
      }
      setLoading(false);
    } catch (err) {
      console.error("Error getting heart rate:", err);
      setError("Failed to get heart rate: " + err.message);
      setLoading(false);
    }
  };

  // useEffect(() => {
  //   let timer;
  //   if (authStatus) {
  //     timer = setInterval(() => fetchHeartRateDeltas(), 5000);
  //   }
  //   return () => clearInterval(timer);
  // }, [authStatus]);

  // One-shot: load persisted anchor after auth
  // useEffect(() => {
  //   (async () => {
  //     if (!authStatus) return;
  //     const stored = await loadAnchor();
  //     anchorRef.current = stored;
  //     console.log("🔗 Loaded anchor:", stored ? stored.substring(0, 12) + "..." : "<none>");
  //     // Kick an initial delta fetch
  //     fetchHeartRateDeltas();
  //   })();
  // }, [authStatus]);

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

  useEffect(() => {
    let unsub = null;

    (async () => {
      if (!authStatus) return;

      try {
        console.log("Setting up background delivery...");

        // CRITICAL: Enable background delivery FIRST before subscribing
        const bgDeliveryResult = await HealthKit.enableBackgroundDelivery(
          heartRateType,
          HealthKit.UpdateFrequency.immediate
        );
        console.log("Background delivery result:", bgDeliveryResult);
        console.log("Background delivery enabled --- Setting up subscription...");

        // Now set up the subscription
        unsub = HealthKit.subscribeToChanges(heartRateType, () => {
          console.log("*** Heart rate data changed! Fetching deltas via anchor ***", new Date());
          // fetchHeartRateDeltas();
          getLatestHeartRate();
        });
        console.log("Subscription set up successfully");

        // Get initial data
        getLatestHeartRate();
      } catch (error) {
        console.error("Error setting up HealthKit subscription:", error);
        setError("Failed to set up heart rate monitoring: " + error.message);
      }
    })();

    return () => {
      if (typeof unsub === "function") {
        console.log("Cleaning up subscription...");
        unsub();
      }
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
              </View>
            ) : (
              <Text style={styles.noData}>No heart rate data available</Text>
            )}

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

            {/* <Button title="Reset Anchor" onPress={resetAnchor} disabled={loading} color="#B00020" /> */}
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
