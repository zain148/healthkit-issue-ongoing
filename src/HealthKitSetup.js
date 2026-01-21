/**
 * HealthKitSetup.js
 * 
 * MVP Solution for HealthKit subscriptions
 * 
 * CRITICAL: This file sets up subscriptions OUTSIDE React lifecycle
 * as per Robert Herber's recommendation. Must be called in index.js
 * BEFORE registerRootComponent().
 * 
 * Tracks: Heart Rate, Calories (Active Energy), Workouts
 */

import { AppState, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import * as HealthKit from '@kingstinct/react-native-healthkit';

// HealthKit Data Types
const HEART_RATE_TYPE = 'HKQuantityTypeIdentifierHeartRate';
const ACTIVE_ENERGY_TYPE = 'HKQuantityTypeIdentifierActiveEnergyBurned';
const BASAL_ENERGY_TYPE = 'HKQuantityTypeIdentifierBasalEnergyBurned';
const WORKOUT_TYPE = 'HKWorkoutTypeIdentifier';

// All types we want to read
const READ_TYPES = [
  HEART_RATE_TYPE,
  ACTIVE_ENERGY_TYPE,
  BASAL_ENERGY_TYPE,
  WORKOUT_TYPE,
];

// Helper to convert HealthKit timestamps (may be seconds or ISO string)
const parseHealthKitDate = (dateValue) => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'string') return new Date(dateValue);
  // HealthKit often returns seconds, not milliseconds
  if (typeof dateValue === 'number') {
    return new Date(dateValue < 1e12 ? dateValue * 1000 : dateValue);
  }
  return null;
};

// Simple event emitter for React/non-React state sharing
class HealthKitStore {
  constructor() {
    this.listeners = new Set();
    this.state = {
      // Heart Rate
      heartRate: null,
      lastHeartRateUpdate: null,
      
      // Calories
      activeCalories: null,
      lastCaloriesUpdate: null,
      
      // Recent Activities (last 5 with HR + Calories)
      recentActivities: [],
      
      // Status
      subscriptionActive: false,
      isAuthorized: false,
      error: null,
      updateCount: 0,
    };
    this._unsubscribers = [];
    this._isInitialized = false;
    this._initPromise = null;
    this._fetchingActivities = false; // Debounce flag
    this._lastActivityFetch = 0; // Timestamp for debounce
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState() {
    return this.state;
  }

  _setState(partial) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(listener => listener(this.state));
  }

  async initialize() {
    if (this._initPromise) {
      return this._initPromise;
    }
    this._initPromise = this._doInitialize();
    return this._initPromise;
  }

  async _doInitialize() {
    if (Platform.OS !== 'ios') {
      console.log('[HealthKitSetup] Not iOS, skipping initialization');
      return;
    }

    if (this._isInitialized) {
      console.log('[HealthKitSetup] Already initialized');
      return;
    }

    try {
      console.log('[HealthKitSetup] 🚀 Initializing (OUTSIDE React lifecycle)...');

      // 1. Check availability
      const isAvailable = await HealthKit.isHealthDataAvailable();
      if (!isAvailable) {
        this._setState({ error: 'HealthKit not available on this device' });
        return;
      }

      // 2. Request authorization for ALL types
      console.log('[HealthKitSetup] 📋 Requesting authorization for HR + Calories + Workouts...');
      await HealthKit.requestAuthorization({ toRead: READ_TYPES });
      
      const authStatus = await HealthKit.getRequestStatusForAuthorization({ toRead: READ_TYPES });
      console.log('[HealthKitSetup] 📋 Auth status:', authStatus);

      this._setState({ isAuthorized: true });

      // 3. Enable background delivery for each type
      console.log('[HealthKitSetup] 🔔 Enabling background delivery...');
      for (const type of [HEART_RATE_TYPE, ACTIVE_ENERGY_TYPE]) {
        try {
          await HealthKit.enableBackgroundDelivery(type, HealthKit.UpdateFrequency.immediate);
          console.log(`[HealthKitSetup] ✅ Background delivery enabled for ${type.split('Identifier')[1]}`);
        } catch (bgError) {
          console.warn(`[HealthKitSetup] ⚠️ Background delivery error for ${type}:`, bgError.message);
        }
      }

      // 4. Set up subscriptions
      console.log('[HealthKitSetup] 📡 Setting up subscriptions...');
      this._setupSubscriptions();

      // 5. Get initial data
      await this._fetchAllData();

      // 6. Listen for app state changes
      this._setupAppStateListener();

      this._isInitialized = true;
      console.log('[HealthKitSetup] ✅ Initialization complete!');

    } catch (error) {
      console.error('[HealthKitSetup] ❌ Initialization failed:', error);
      this._setState({ error: error.message });
    }
  }

  _setupSubscriptions() {
    // Heart Rate subscription
    try {
      const hrUnsub = HealthKit.subscribeToChanges(HEART_RATE_TYPE, () => {
        console.log(`[HealthKitSetup] 🔔 HEART RATE UPDATE! ${new Date().toLocaleTimeString()}`);
        this._setState({ 
          subscriptionActive: true,
          updateCount: this.state.updateCount + 1,
        });
        this._fetchLatestHeartRate();
      });
      this._unsubscribers.push(hrUnsub);
      console.log('[HealthKitSetup] ✅ Heart rate subscription ready');
    } catch (e) {
      console.error('[HealthKitSetup] ❌ HR subscription failed:', e);
    }

    // Calories subscription
    try {
      const calUnsub = HealthKit.subscribeToChanges(ACTIVE_ENERGY_TYPE, () => {
        console.log(`[HealthKitSetup] 🔥 CALORIES UPDATE! ${new Date().toLocaleTimeString()}`);
        this._setState({ 
          subscriptionActive: true,
          updateCount: this.state.updateCount + 1,
        });
        this._fetchLatestCalories();
        this._fetchRecentActivities(); // Also refresh activities when calories update
      });
      this._unsubscribers.push(calUnsub);
      console.log('[HealthKitSetup] ✅ Calories subscription ready');
    } catch (e) {
      console.error('[HealthKitSetup] ❌ Calories subscription failed:', e);
    }
  }

  async _fetchAllData() {
    await Promise.all([
      this._fetchLatestHeartRate(),
      this._fetchLatestCalories(),
      this._fetchRecentActivities(),
    ]);
  }

  async _fetchLatestHeartRate() {
    try {
      const sample = await HealthKit.getMostRecentQuantitySample(HEART_RATE_TYPE);
      
      if (sample) {
        const sampleDate = parseHealthKitDate(sample.startDate);
        const lastDate = this.state.lastHeartRateUpdate;

        if (!lastDate || !sampleDate || sampleDate.getTime() !== lastDate.getTime()) {
          console.log(`[HealthKitSetup] 💓 New HR: ${sample.quantity?.toFixed(0)} BPM @ ${sampleDate?.toLocaleTimeString() || 'unknown'}`);
          
          this._setState({
            heartRate: sample,
            lastHeartRateUpdate: sampleDate,
          });
        } else {
          console.log('[HealthKitSetup] ⏸️ No new HR data');
        }
      }
    } catch (error) {
      console.error('[HealthKitSetup] ❌ Error fetching heart rate:', error);
    }
  }

  async _fetchLatestCalories() {
    try {
      const sample = await HealthKit.getMostRecentQuantitySample(ACTIVE_ENERGY_TYPE);
      
      if (sample) {
        const sampleDate = parseHealthKitDate(sample.startDate);
        console.log(`[HealthKitSetup] 🔥 Calories: ${sample.quantity?.toFixed(0)} kcal @ ${sampleDate?.toLocaleTimeString() || 'unknown'}`);
        
        this._setState({
          activeCalories: sample,
          lastCaloriesUpdate: sampleDate,
        });
      }
    } catch (error) {
      console.error('[HealthKitSetup] ❌ Error fetching calories:', error);
    }
  }

  /**
   * Fetch last 5 activities with heart rate and calories summary
   */
  async _fetchRecentActivities() {
    // Debounce: prevent multiple simultaneous fetches
    const now = Date.now();
    if (this._fetchingActivities || (now - this._lastActivityFetch) < 2000) {
      return;
    }
    this._fetchingActivities = true;
    this._lastActivityFetch = now;
    
    try {
      console.log('[HealthKitSetup] 📊 Fetching recent activities...');
      
      // Get recent workouts using v13 API: queryWorkoutSamples
      const workouts = await HealthKit.queryWorkoutSamples({
        limit: 5,
        ascending: false, // Most recent first
      });

      const workoutList = Array.isArray(workouts) ? workouts : [];
      
      // Process workouts to get activity summaries
      const activities = await Promise.all(
        workoutList.map(async (workout) => {
          const startDate = parseHealthKitDate(workout.startDate);
          const endDate = parseHealthKitDate(workout.endDate);
          
          // Get statistics from workout (v13 API has getStatistic method on WorkoutProxy)
          let avgHeartRate = null;
          let maxHeartRate = null;
          let totalCalories = null;
          
          try {
            // Get specific statistics (safer than getAllStatistics which may request unauthorized types)
            if (typeof workout.getStatistic === 'function') {
              // Get heart rate stats
              try {
                const hrStats = await workout.getStatistic(HEART_RATE_TYPE);
                if (hrStats) {
                  // Try different property paths (v13 structure may vary)
                  avgHeartRate = hrStats.average?.quantity ?? hrStats.averageQuantity?.quantity ?? hrStats.average ?? null;
                  maxHeartRate = hrStats.maximum?.quantity ?? hrStats.maximumQuantity?.quantity ?? hrStats.maximum ?? null;
                }
              } catch (hrErr) {
                // HR stats not available for this workout - this is normal for some workout types
              }
              
              // Get calorie stats
              try {
                const calStats = await workout.getStatistic(ACTIVE_ENERGY_TYPE);
                if (calStats) {
                  // Try different property paths
                  totalCalories = calStats.sum?.quantity ?? calStats.sumQuantity?.quantity ?? calStats.sum ?? null;
                }
              } catch (calErr) {
                // Calorie stats not available for this workout
              }
            }
          } catch (e) {
            // Silent fail - stats not available
          }
          
          // Fallback: query HR samples during workout time range
          if (avgHeartRate == null && startDate && endDate) {
            try {
              // Query HR samples within the workout time window
              const hrSamples = await HealthKit.queryQuantitySamples(HEART_RATE_TYPE, {
                limit: 200,
                from: startDate,
                to: endDate,
              });
              const hrList = Array.isArray(hrSamples) ? hrSamples : [];
              
              if (hrList.length > 0) {
                const hrValues = hrList.map(s => s.quantity).filter(v => v != null && !isNaN(v));
                if (hrValues.length > 0) {
                  avgHeartRate = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;
                  maxHeartRate = Math.max(...hrValues);
                }
              }
            } catch (e) {
              // Fallback query failed - this is okay, some workouts may not have HR data
            }
          }
          
          // Fallback for calories if not found in workout stats
          if (totalCalories == null && startDate && endDate) {
            try {
              const calSamples = await HealthKit.queryQuantitySamples(ACTIVE_ENERGY_TYPE, {
                limit: 50,
                from: startDate,
                to: endDate,
              });
              const calList = Array.isArray(calSamples) ? calSamples : [];
              
              if (calList.length > 0) {
                const calValues = calList.map(s => s.quantity).filter(v => v != null && !isNaN(v));
                if (calValues.length > 0) {
                  totalCalories = calValues.reduce((a, b) => a + b, 0);
                }
              }
            } catch (e) {
              // Fallback query failed
            }
          }

          // Duration is a Quantity object in v13
          const durationSeconds = workout.duration?.quantity || 
            (endDate && startDate ? (endDate - startDate) / 1000 : 0);

          return {
            id: workout.uuid || `${startDate?.getTime()}`,
            workoutType: workout.workoutActivityType,
            startDate,
            endDate,
            duration: durationSeconds,
            totalEnergyBurned: totalCalories || 0,
            totalDistance: 0, // Would need to query distance stats separately
            avgHeartRate: avgHeartRate ? Math.round(avgHeartRate) : null,
            maxHeartRate: maxHeartRate ? Math.round(maxHeartRate) : null,
            source: workout.sourceRevision?.source?.name || 'Unknown',
          };
        })
      );

      console.log(`[HealthKitSetup] ✅ Found ${activities.length} recent activities`);
      this._setState({ recentActivities: activities });
      
    } catch (error) {
      console.error('[HealthKitSetup] ❌ Error fetching activities:', error);
    } finally {
      this._fetchingActivities = false;
    }
  }

  _setupAppStateListener() {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[HealthKitSetup] 📱 App became active, fetching all data...');
        this._fetchAllData();
      }
    });
  }

  async refresh() {
    console.log('[HealthKitSetup] 🔄 Manual refresh requested');
    await this._fetchAllData();
  }

  async getRecentSamples(type = HEART_RATE_TYPE, limit = 10) {
    try {
      const result = await HealthKit.queryQuantitySamples(type, {
        limit,
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      return Array.isArray(result) ? result : (result?.samples || []);
    } catch (error) {
      console.error('[HealthKitSetup] ❌ Error querying samples:', error);
      return [];
    }
  }

  cleanup() {
    this._unsubscribers.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    this._unsubscribers = [];
    this.listeners.clear();
    this._isInitialized = false;
    this._initPromise = null;
  }
}

// Export singleton instance
export const healthKitStore = new HealthKitStore();

// Export type constants
export { 
  HEART_RATE_TYPE, 
  ACTIVE_ENERGY_TYPE, 
  BASAL_ENERGY_TYPE,
  WORKOUT_TYPE,
  parseHealthKitDate,
};

// React hook for consuming the store
export function useHealthKitStore() {
  const [state, setState] = useState(healthKitStore.getState());

  useEffect(() => {
    return healthKitStore.subscribe(setState);
  }, []);

  return state;
}

export default healthKitStore;
