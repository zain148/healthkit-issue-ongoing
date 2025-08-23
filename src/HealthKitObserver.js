/**
 * HealthKitObserver.js
 * 
 * JavaScript wrapper for the native HealthKit observer module
 * Provides reliable real-time updates for HealthKit data
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-healthkit-observer' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

// Support for both old and new architecture
const HealthKitObserverModule = NativeModules.HealthKitObserver
  ? NativeModules.HealthKitObserver
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

class HealthKitObserver {
  constructor() {
    this.eventEmitter = new NativeEventEmitter(HealthKitObserverModule);
    this.subscriptions = new Map();
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
  }

  /**
   * Start observing a specific HealthKit data type
   * @param {string} dataType - The HealthKit data type identifier (e.g., 'HKQuantityTypeIdentifierHeartRate')
   * @param {function} callback - Callback function that receives updates
   * @param {object} options - Optional configuration
   * @returns {function} Unsubscribe function
   */
  async subscribe(dataType, callback, options = {}) {
    if (Platform.OS !== 'ios') {
      console.warn('HealthKitObserver: Only available on iOS');
      return () => {};
    }

    try {
      // Start native observation with retry logic
      await this._startObservationWithRetry(dataType, options);

      // Setup event listener
      const subscription = this.eventEmitter.addListener(
        'healthkit:observer:update',
        (data) => {
          if (data.type === dataType) {
            // Reset retry count on successful update
            this.retryAttempts.set(dataType, 0);
            
            // Process and deliver the update
            const processedData = this._processUpdate(data, options);
            callback(processedData);
          }
        }
      );

      // Setup error listener
      const errorSubscription = this.eventEmitter.addListener(
        'healthkit:observer:error',
        (error) => {
          if (error.type === dataType) {
            console.error(`HealthKitObserver error for ${dataType}:`, error.error);
            
            // Attempt to recover from error
            this._handleObservationError(dataType, options, callback);
          }
        }
      );

      // Store subscriptions
      const subscriptionKey = `${dataType}_${Date.now()}`;
      this.subscriptions.set(subscriptionKey, {
        dataSubscription: subscription,
        errorSubscription: errorSubscription,
        dataType: dataType,
        callback: callback,
        options: options
      });

      // Return unsubscribe function
      return () => {
        subscription.remove();
        errorSubscription.remove();
        this.subscriptions.delete(subscriptionKey);
        
        // Check if this was the last subscription for this type
        const hasMoreSubscriptions = Array.from(this.subscriptions.values())
          .some(sub => sub.dataType === dataType);
        
        if (!hasMoreSubscriptions) {
          HealthKitObserverModule.stopObservingType(dataType)
            .catch(err => console.error('Error stopping observation:', err));
        }
      };
    } catch (error) {
      console.error('Failed to start observation:', error);
      throw error;
    }
  }

  /**
   * Start observation with automatic retry on failure
   */
  async _startObservationWithRetry(dataType, options, attemptNumber = 1) {
    try {
      const result = await HealthKitObserverModule.startObservingType(dataType);
      console.log(`HealthKitObserver: Started observing ${dataType}`, result);
      return result;
    } catch (error) {
      if (attemptNumber >= this.maxRetries) {
        throw error;
      }

      console.warn(`HealthKitObserver: Retry attempt ${attemptNumber} for ${dataType}`);
      
      // Exponential backoff
      const delay = this.retryDelay * Math.pow(2, attemptNumber - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this._startObservationWithRetry(dataType, options, attemptNumber + 1);
    }
  }

  /**
   * Handle observation errors with recovery attempts
   */
  async _handleObservationError(dataType, options, callback) {
    const retryCount = this.retryAttempts.get(dataType) || 0;
    
    if (retryCount >= this.maxRetries) {
      console.error(`HealthKitObserver: Max retries exceeded for ${dataType}`);
      
      // Notify callback of persistent error
      callback({
        error: true,
        message: `Failed to observe ${dataType} after ${this.maxRetries} attempts`,
        dataType: dataType
      });
      return;
    }

    this.retryAttempts.set(dataType, retryCount + 1);
    
    // Wait before retrying
    const delay = this.retryDelay * Math.pow(2, retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      // Attempt to restart observation
      await HealthKitObserverModule.stopObservingType(dataType);
      await this._startObservationWithRetry(dataType, options);
      
      console.log(`HealthKitObserver: Successfully recovered ${dataType} observation`);
    } catch (error) {
      console.error(`HealthKitObserver: Failed to recover ${dataType} observation:`, error);
      
      // Recursively try again
      this._handleObservationError(dataType, options, callback);
    }
  }

  /**
   * Process raw update data
   */
  _processUpdate(data, options) {
    const { samples, deleted } = data;
    
    // Apply any filtering options
    let processedSamples = samples;
    
    if (options.limit) {
      processedSamples = samples.slice(0, options.limit);
    }
    
    if (options.ascending === false) {
      processedSamples = processedSamples.reverse();
    }
    
    // Convert timestamps
    processedSamples = processedSamples.map(sample => ({
      ...sample,
      startDate: new Date(sample.startDate),
      endDate: new Date(sample.endDate)
    }));
    
    return {
      samples: processedSamples,
      deletedCount: deleted,
      dataType: data.type,
      timestamp: new Date()
    };
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions() {
    return Array.from(this.subscriptions.values()).map(sub => ({
      dataType: sub.dataType,
      options: sub.options
    }));
  }

  /**
   * Check if a specific data type is being observed
   */
  isObserving(dataType) {
    return Array.from(this.subscriptions.values())
      .some(sub => sub.dataType === dataType);
  }

  /**
   * Stop all observations
   */
  async stopAll() {
    const dataTypes = new Set(
      Array.from(this.subscriptions.values()).map(sub => sub.dataType)
    );

    // Remove all listeners
    this.subscriptions.forEach(sub => {
      sub.dataSubscription.remove();
      sub.errorSubscription.remove();
    });
    this.subscriptions.clear();

    // Stop native observations
    const promises = Array.from(dataTypes).map(dataType =>
      HealthKitObserverModule.stopObservingType(dataType)
        .catch(err => console.error(`Error stopping ${dataType}:`, err))
    );

    await Promise.all(promises);
  }
}

// Export singleton instance
export default new HealthKitObserver();

// Also export the class for testing
export { HealthKitObserver };

// Export common HealthKit type identifiers
export const HealthKitTypes = {
  // Vital Signs
  HeartRate: 'HKQuantityTypeIdentifierHeartRate',
  BloodPressureSystolic: 'HKQuantityTypeIdentifierBloodPressureSystolic',
  BloodPressureDiastolic: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
  BodyTemperature: 'HKQuantityTypeIdentifierBodyTemperature',
  RespiratoryRate: 'HKQuantityTypeIdentifierRespiratoryRate',
  
  // Activity
  StepCount: 'HKQuantityTypeIdentifierStepCount',
  DistanceWalkingRunning: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
  ActiveEnergyBurned: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  BasalEnergyBurned: 'HKQuantityTypeIdentifierBasalEnergyBurned',
  FlightsClimbed: 'HKQuantityTypeIdentifierFlightsClimbed',
  
  // Body Measurements
  BodyMass: 'HKQuantityTypeIdentifierBodyMass',
  Height: 'HKQuantityTypeIdentifierHeight',
  BodyMassIndex: 'HKQuantityTypeIdentifierBodyMassIndex',
  BodyFatPercentage: 'HKQuantityTypeIdentifierBodyFatPercentage',
  
  // Workouts
  Workout: 'HKWorkoutTypeIdentifier'
};