# HealthKit Observer Setup Guide

This guide explains how to integrate the new HealthKit Observer module to fix the subscription issues in your React Native app.

## Overview

The HealthKit Observer module provides a robust solution for real-time HealthKit data updates by implementing:
- Native observer queries with anchored object queries
- Background observer setup in `didFinishLaunchingWithOptions`
- Automatic error recovery and retry mechanisms
- Support for both old and new React Native architectures

## Installation Steps

### 1. Copy Native iOS Files

Copy the following files to your iOS project:

```bash
# Create the directory
mkdir -p ios/YourAppName/HealthKitObserver

# Copy the native files
cp ios/HealthKitObserver/RNHealthKitObserver.h ios/YourAppName/HealthKitObserver/
cp ios/HealthKitObserver/RNHealthKitObserver.m ios/YourAppName/HealthKitObserver/
cp ios/HealthKitObserver/AppDelegateExtension.m ios/YourAppName/HealthKitObserver/
```

### 2. Add Files to Xcode Project

1. Open your iOS project in Xcode
2. Right-click on your app folder and select "Add Files to..."
3. Navigate to the `HealthKitObserver` folder and add all three files
4. Make sure "Copy items if needed" is unchecked and your app target is selected

### 3. Update AppDelegate

Add the following import to your `AppDelegate.m` file:

```objc
#import "YourAppName/HealthKitObserver/AppDelegateExtension.m"
```

Or if you prefer manual setup without swizzling, add this to `didFinishLaunchingWithOptions`:

```objc
#import "YourAppName/HealthKitObserver/RNHealthKitObserver.h"

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
  // ... existing code ...
  
  // Setup HealthKit background observers
  [[RNHealthKitObserver sharedInstance] setupBackgroundObservers];
  
  return YES;
}
```

### 4. Update Info.plist

Add or update the following keys in your `Info.plist`:

```xml
<key>NSHealthShareUsageDescription</key>
<string>This app needs access to your health data to display heart rate information</string>
<key>NSHealthUpdateUsageDescription</key>
<string>This app needs to update your health data</string>
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>remote-notification</string>
</array>
```

### 5. Copy JavaScript Files

Copy the JavaScript wrapper and TypeScript definitions:

```bash
# Create the directory
mkdir -p src

# Copy the files
cp src/HealthKitObserver.js src/
cp src/HealthKitObserver.d.ts src/
```

### 6. Pod Install

Run pod install to link the native modules:

```bash
cd ios && pod install
```

## Usage

### Basic Example

```javascript
import HealthKitObserver, { HealthKitTypes } from './src/HealthKitObserver';

// Subscribe to heart rate updates
const unsubscribe = await HealthKitObserver.subscribe(
  HealthKitTypes.HeartRate,
  (data) => {
    if (data.error) {
      console.error('Observer error:', data.message);
      return;
    }
    
    // Process new samples
    data.samples.forEach(sample => {
      console.log('Heart rate:', sample.quantity, sample.unit);
    });
  },
  {
    limit: 1,        // Only get the latest sample
    ascending: false // Most recent first
  }
);

// Later: unsubscribe
unsubscribe();
```

### Advanced Usage

```javascript
// Check if observing
const isObserving = HealthKitObserver.isObserving(HealthKitTypes.HeartRate);

// Get all active subscriptions
const subscriptions = HealthKitObserver.getActiveSubscriptions();

// Stop all observations
await HealthKitObserver.stopAll();
```

## Migration from react-native-healthkit

### Before (with subscription issues):
```javascript
const unsub = HealthKit.subscribeToChanges(heartRateType, () => {
  // This callback might not fire reliably
  getLatestHeartRate();
});
```

### After (with HealthKit Observer):
```javascript
const unsubscribe = await HealthKitObserver.subscribe(
  HealthKitTypes.HeartRate,
  (data) => {
    // This callback will fire reliably with automatic error recovery
    if (!data.error && data.samples.length > 0) {
      setHeartRate(data.samples[0]);
    }
  }
);
```

## Debugging

### Enable Verbose Logging

The module includes comprehensive logging. View logs in Xcode console:

- 🏥 Module initialization
- 🚀 Background observer setup
- 📡 Starting observations
- 🔔 Update notifications
- 📊 Sample data received
- ❌ Errors and recovery attempts
- ✅ Successful operations

### Common Issues

1. **"Module not found" error**
   - Ensure files are properly added to Xcode project
   - Run `pod install` after adding native files
   - Clean and rebuild the project

2. **No updates received**
   - Check that background observers are set up in AppDelegate
   - Verify HealthKit permissions are granted
   - Ensure background modes are enabled in Info.plist

3. **Updates only work in background**
   - This is the exact issue our module fixes
   - Verify you're using HealthKitObserver, not the old subscribeToChanges

## Performance Considerations

- The module uses anchored queries to efficiently fetch only new data
- Background observers are set up once at app launch
- Automatic retry with exponential backoff prevents excessive API calls
- Multiple subscriptions to the same data type share a single observer

## Testing

Use the provided `AppWithObserver.js` to test the implementation:

1. Replace your existing App.js temporarily
2. Grant HealthKit permissions
3. Toggle between Observer and Manual modes
4. Monitor the status indicator and update counter
5. Check console logs for detailed debugging information

## Support

For issues or questions:
1. Check the console logs for detailed error messages
2. Ensure all setup steps were followed correctly
3. Refer to the original issue: https://github.com/kingstinct/react-native-healthkit/issues/207