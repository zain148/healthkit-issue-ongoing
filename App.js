/**
 * App.js - MVP Heart Rate & Calories Monitor
 * 
 * Features:
 * - Live Heart Rate updates
 * - Calories tracking (Active Energy)
 * - Last 5 workout activities with HR & Calories summary
 */

import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  Button,
  SafeAreaView,
  ScrollView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useCallback, useState } from 'react';
import { 
  useHealthKitStore, 
  healthKitStore, 
  HEART_RATE_TYPE,
  ACTIVE_ENERGY_TYPE,
  parseHealthKitDate,
} from './src/HealthKitSetup';
import * as HealthKit from '@kingstinct/react-native-healthkit';

export default function App() {
  const healthState = useHealthKitStore();
  const { 
    heartRate, 
    lastHeartRateUpdate, 
    activeCalories,
    lastCaloriesUpdate,
    recentActivities,
    subscriptionActive, 
    isAuthorized, 
    error, 
    updateCount 
  } = healthState;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await healthKitStore.refresh();
    setRefreshing(false);
  }, []);

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await healthKitStore.refresh();
    setLoading(false);
  }, []);

  // Request permissions
  const handleRequestPermissions = useCallback(async () => {
    setLoading(true);
    try {
      await healthKitStore.initialize();
    } catch (err) {
      console.error('Permission request failed:', err);
    }
    setLoading(false);
  }, []);

  // Format HealthKit date
  const formatDate = (dateValue) => {
    const date = parseHealthKitDate(dateValue);
    if (!date) return 'Unknown';
    return date.toLocaleString();
  };

  // Format time ago
  const getTimeAgo = (date) => {
    if (!date) return '';
    const dateObj = date instanceof Date ? date : parseHealthKitDate(date);
    if (!dateObj) return '';
    const seconds = Math.floor((Date.now() - dateObj.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins % 60}m`;
    }
    return `${mins}m`;
  };

  // Format workout type (v13: type is a number enum, not a string)
  const formatWorkoutType = (type) => {
    // v13 WorkoutActivityType enum values
    const workoutNames = {
      1: 'American Football', 2: 'Archery', 3: 'Australian Football',
      4: 'Badminton', 5: 'Baseball', 6: 'Basketball', 7: 'Bowling',
      8: 'Boxing', 9: 'Climbing', 10: 'Cricket', 11: 'Cross Training',
      12: 'Curling', 13: 'Cycling', 14: 'Dance', 15: 'Dance Training',
      16: 'Elliptical', 17: 'Equestrian', 18: 'Fencing', 19: 'Fishing',
      20: 'Strength Training', 21: 'Golf', 22: 'Gymnastics', 23: 'Handball',
      24: 'Hiking', 25: 'Hockey', 26: 'Hunting', 27: 'Lacrosse',
      28: 'Martial Arts', 29: 'Mind & Body', 30: 'Mixed Cardio',
      31: 'Paddle Sports', 32: 'Play', 33: 'Recovery', 34: 'Racquetball',
      35: 'Rowing', 36: 'Rugby', 37: 'Running', 38: 'Sailing',
      39: 'Skating', 40: 'Snow Sports', 41: 'Soccer', 42: 'Softball',
      43: 'Squash', 44: 'Stair Climbing', 45: 'Surfing', 46: 'Swimming',
      47: 'Table Tennis', 48: 'Tennis', 49: 'Track & Field',
      50: 'Traditional Strength', 51: 'Volleyball', 52: 'Walking',
      53: 'Water Fitness', 54: 'Water Polo', 55: 'Water Sports',
      56: 'Wrestling', 57: 'Yoga', 58: 'Barre', 59: 'Core Training',
      60: 'Cross Country Skiing', 61: 'Downhill Skiing', 62: 'Flexibility',
      63: 'HIIT', 64: 'Jump Rope', 65: 'Kickboxing', 66: 'Pilates',
      67: 'Snowboarding', 68: 'Stairs', 69: 'Step Training',
      70: 'Wheelchair Walk', 71: 'Wheelchair Run', 72: 'Tai Chi',
      73: 'Mixed Cardio', 74: 'Hand Cycling', 75: 'Disc Sports',
      76: 'Fitness Gaming', 77: 'Cardio Dance', 78: 'Social Dance',
      79: 'Pickleball', 80: 'Cooldown', 82: 'Swim Bike Run',
      83: 'Transition', 84: 'Underwater Diving', 3000: 'Other',
    };
    
    if (typeof type === 'number') {
      return workoutNames[type] || `Workout (${type})`;
    }
    if (typeof type === 'string') {
      // Fallback for string format
      return type.replace('HKWorkoutActivityType', '').replace(/([A-Z])/g, ' $1').trim() || 'Workout';
    }
    return 'Workout';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>💓 Health Monitor</Text>
        <Text style={styles.subtitle}>Heart Rate + Calories + Activities</Text>

        {/* Status Indicator */}
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: subscriptionActive ? '#4CAF50' : '#FFC107' }
          ]} />
          <Text style={styles.statusText}>
            {subscriptionActive 
              ? `Live Updates Active (${updateCount} events)` 
              : 'Waiting for updates...'}
          </Text>
        </View>

        {!isAuthorized ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>
              HealthKit permissions required for:
            </Text>
            <Text style={styles.permissionList}>• Heart Rate</Text>
            <Text style={styles.permissionList}>• Active Energy (Calories)</Text>
            <Text style={styles.permissionList}>• Workouts</Text>
            <View style={{ marginTop: 15 }}>
              <Button
                title="Grant Permissions"
                onPress={handleRequestPermissions}
                disabled={loading}
              />
            </View>
          </View>
        ) : (
          <>
            {/* Current Stats Row */}
            <View style={styles.statsRow}>
              {/* Heart Rate Card */}
              <View style={[styles.statCard, styles.hrCard]}>
                <Text style={styles.statIcon}>💓</Text>
                <Text style={styles.statValue}>
                  {heartRate?.quantity?.toFixed(0) || '--'}
                </Text>
                <Text style={styles.statUnit}>BPM</Text>
                {lastHeartRateUpdate && (
                  <Text style={styles.statTime}>{getTimeAgo(lastHeartRateUpdate)}</Text>
                )}
              </View>

              {/* Calories Card */}
              <View style={[styles.statCard, styles.calCard]}>
                <Text style={styles.statIcon}>🔥</Text>
                <Text style={styles.statValue}>
                  {activeCalories?.quantity?.toFixed(0) || '--'}
                </Text>
                <Text style={styles.statUnit}>kcal</Text>
                {lastCaloriesUpdate && (
                  <Text style={styles.statTime}>{getTimeAgo(lastCaloriesUpdate)}</Text>
                )}
              </View>
            </View>

            {/* Refresh Button */}
            <View style={styles.buttonContainer}>
              <Button
                title={loading ? "Refreshing..." : "🔄 Refresh Data"}
                onPress={handleRefresh}
                disabled={loading}
              />
            </View>

            {/* Recent Activities */}
            <View style={styles.activitiesContainer}>
              <Text style={styles.sectionTitle}>📊 Recent Activities (Last 5)</Text>
              
              {recentActivities.length === 0 ? (
                <View style={styles.noActivities}>
                  <Text style={styles.noActivitiesText}>No recent workouts found</Text>
                  <Text style={styles.noActivitiesHint}>
                    Complete a workout on your Apple Watch to see it here
                  </Text>
                </View>
              ) : (
                recentActivities.map((activity, index) => (
                  <View key={activity.id || index} style={styles.activityCard}>
                    <View style={styles.activityHeader}>
                      <Text style={styles.activityType}>
                        {formatWorkoutType(activity.workoutType)}
                      </Text>
                      <Text style={styles.activityDate}>
                        {getTimeAgo(activity.startDate)}
                      </Text>
                    </View>
                    
                    <View style={styles.activityStats}>
                      <View style={styles.activityStat}>
                        <Text style={styles.activityStatLabel}>Duration</Text>
                        <Text style={styles.activityStatValue}>
                          {formatDuration(activity.duration)}
                        </Text>
                      </View>
                      
                      <View style={styles.activityStat}>
                        <Text style={styles.activityStatLabel}>Calories</Text>
                        <Text style={[styles.activityStatValue, styles.caloriesText]}>
                          {activity.totalEnergyBurned?.toFixed(0) || '--'} kcal
                        </Text>
                      </View>
                      
                      <View style={styles.activityStat}>
                        <Text style={styles.activityStatLabel}>Avg HR</Text>
                        <Text style={[styles.activityStatValue, styles.hrText]}>
                          {activity.avgHeartRate || '--'} BPM
                        </Text>
                      </View>
                      
                      <View style={styles.activityStat}>
                        <Text style={styles.activityStatLabel}>Max HR</Text>
                        <Text style={[styles.activityStatValue, styles.hrText]}>
                          {activity.maxHeartRate || '--'} BPM
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={styles.activitySource}>
                      📱 {activity.source}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* Debug Toggle */}
            <View style={styles.buttonContainer}>
              <Button
                title={showDebug ? "Hide Debug Info" : "Show Debug Info"}
                onPress={() => setShowDebug(!showDebug)}
                color="#666"
              />
            </View>

            {/* Debug Info */}
            {showDebug && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>🔧 Debug Info</Text>
                <Text style={styles.debugText}>HR Type: {HEART_RATE_TYPE}</Text>
                <Text style={styles.debugText}>Cal Type: {ACTIVE_ENERGY_TYPE}</Text>
                <Text style={styles.debugText}>Authorized: {isAuthorized ? '✅' : '❌'}</Text>
                <Text style={styles.debugText}>Subscription: {subscriptionActive ? '✅' : '❌'}</Text>
                <Text style={styles.debugText}>Update Events: {updateCount}</Text>
                <Text style={styles.debugText}>Activities: {recentActivities.length}</Text>
                <Text style={styles.debugText}>
                  Last HR: {lastHeartRateUpdate?.toLocaleString() || 'Never'}
                </Text>
                <Text style={styles.debugText}>
                  Last Cal: {lastCaloriesUpdate?.toLocaleString() || 'Never'}
                </Text>
                <Text style={styles.debugHint}>
                  💡 Check Xcode/Metro console for [HealthKitSetup] logs
                </Text>
              </View>
            )}
          </>
        )}

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>❌ {error}</Text>
          </View>
        )}

        <StatusBar style="auto" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 16,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 13,
    color: '#333',
  },
  permissionBox: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
  },
  permissionText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  permissionList: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hrCard: {
    backgroundColor: '#ffe8e8',
  },
  calCard: {
    backgroundColor: '#fff3e0',
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
  },
  statUnit: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statTime: {
    fontSize: 11,
    color: '#888',
    marginTop: 6,
  },
  buttonContainer: {
    marginBottom: 12,
  },
  activitiesContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  noActivities: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
  },
  noActivitiesText: {
    fontSize: 16,
    color: '#666',
  },
  noActivitiesHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  activityDate: {
    fontSize: 12,
    color: '#888',
  },
  activityStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  activityStat: {
    width: '48%',
    marginBottom: 10,
  },
  activityStatLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
  },
  activityStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  hrText: {
    color: '#e53935',
  },
  caloriesText: {
    color: '#ff6d00',
  },
  activitySource: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
  },
  debugContainer: {
    padding: 16,
    backgroundColor: '#e8e8e8',
    borderRadius: 12,
    marginTop: 8,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  debugText: {
    fontSize: 11,
    color: '#555',
    marginBottom: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  debugHint: {
    fontSize: 10,
    color: '#888',
    marginTop: 10,
    fontStyle: 'italic',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 12,
    marginTop: 12,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
});
