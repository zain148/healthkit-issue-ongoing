/**
 * TypeScript definitions for HealthKitObserver
 */

export interface HealthKitSample {
  uuid: string;
  startDate: Date;
  endDate: Date;
  sampleType: string;
  source?: {
    name: string;
    bundleIdentifier: string;
  };
  device?: {
    name: string;
    model: string;
    manufacturer: string;
  };
  quantity?: number;
  unit?: string;
  value?: number;
  workoutActivityType?: number;
  duration?: number;
  totalEnergyBurned?: number | null;
  totalDistance?: number | null;
}

export interface HealthKitUpdateData {
  samples: HealthKitSample[];
  deletedCount: number;
  dataType: string;
  timestamp: Date;
}

export interface HealthKitErrorData {
  error: true;
  message: string;
  dataType: string;
}

export type HealthKitCallback = (data: HealthKitUpdateData | HealthKitErrorData) => void;

export interface SubscribeOptions {
  limit?: number;
  ascending?: boolean;
}

export interface Subscription {
  dataType: string;
  options: SubscribeOptions;
}

export declare class HealthKitObserver {
  /**
   * Subscribe to real-time updates for a specific HealthKit data type
   * @param dataType - The HealthKit data type identifier
   * @param callback - Function called when new data is available
   * @param options - Optional configuration for the subscription
   * @returns Unsubscribe function
   */
  subscribe(
    dataType: string,
    callback: HealthKitCallback,
    options?: SubscribeOptions
  ): Promise<() => void>;

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): Subscription[];

  /**
   * Check if a specific data type is being observed
   */
  isObserving(dataType: string): boolean;

  /**
   * Stop all observations
   */
  stopAll(): Promise<void>;
}

declare const healthKitObserver: HealthKitObserver;
export default healthKitObserver;

/**
 * Common HealthKit type identifiers
 */
export declare const HealthKitTypes: {
  // Vital Signs
  HeartRate: 'HKQuantityTypeIdentifierHeartRate';
  BloodPressureSystolic: 'HKQuantityTypeIdentifierBloodPressureSystolic';
  BloodPressureDiastolic: 'HKQuantityTypeIdentifierBloodPressureDiastolic';
  BodyTemperature: 'HKQuantityTypeIdentifierBodyTemperature';
  RespiratoryRate: 'HKQuantityTypeIdentifierRespiratoryRate';
  
  // Activity
  StepCount: 'HKQuantityTypeIdentifierStepCount';
  DistanceWalkingRunning: 'HKQuantityTypeIdentifierDistanceWalkingRunning';
  ActiveEnergyBurned: 'HKQuantityTypeIdentifierActiveEnergyBurned';
  BasalEnergyBurned: 'HKQuantityTypeIdentifierBasalEnergyBurned';
  FlightsClimbed: 'HKQuantityTypeIdentifierFlightsClimbed';
  
  // Body Measurements
  BodyMass: 'HKQuantityTypeIdentifierBodyMass';
  Height: 'HKQuantityTypeIdentifierHeight';
  BodyMassIndex: 'HKQuantityTypeIdentifierBodyMassIndex';
  BodyFatPercentage: 'HKQuantityTypeIdentifierBodyFatPercentage';
  
  // Workouts
  Workout: 'HKWorkoutTypeIdentifier';
};