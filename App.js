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
import { useEffect, useState } from "react";
import * as HealthKit from "@kingstinct/react-native-healthkit";

export default function App() {
  const [authStatus, setAuthStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [heartRate, setHeartRate] = useState(null);
  const [error, setError] = useState(null);

  // Request HealthKit permissions for heart rate
  const requestPermissions = async () => {
    try {
      setLoading(true);
      // Request authorization for reading heart rate
      const result = await HealthKit.requestAuthorization([
        HealthKit.HKQuantityTypeIdentifier.heartRate,
      ]);
      setAuthStatus(result);
      setLoading(false);
    } catch (err) {
      setError("Failed to request permissions: " + err.message);
      setLoading(false);
    }
  };

  // Get the latest heart rate data
  const getLatestHeartRate = async () => {
    try {
      setLoading(true);
      // Query the most recent heart rate sample
      const mostRecentHeartRate = await HealthKit.getMostRecentQuantitySample(
        HealthKit.HKQuantityTypeIdentifier.heartRate
      );

      if (mostRecentHeartRate) {
        console.log("mostRecentHeartRate", mostRecentHeartRate.quantity);
        setHeartRate(mostRecentHeartRate);
      } else {
        setHeartRate(null);
      }
      setLoading(false);
    } catch (err) {
      setError("Failed to get heart rate: " + err.message);
      setLoading(false);
    }
  };

  // Set up HealthKit heart rate changes observer
  const setupHeartRateObserver = async () => {
    try {
      // Subscribe to heart rate changes
      const unsubscribe = HealthKit.subscribeToChanges(
        HealthKit.HKQuantityTypeIdentifier.heartRate,
        () => {
          console.log("Heart rate data changed");
          getLatestHeartRate();
        }
      );

      // Get initial heart rate data
      getLatestHeartRate();

      // Return clean up function
      return unsubscribe;
    } catch (err) {
      setError("Failed to set up observer: " + err.message);
      return () => {};
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

  // Set up HealthKit when authorized
  useEffect(() => {
    if (authStatus) {
      const unsubscribe = setupHeartRateObserver();
      return () => {
        // Clean up subscription when component unmounts
        unsubscribe.then((unsub) => unsub());
      };
    }
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
