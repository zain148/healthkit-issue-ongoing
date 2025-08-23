# HealthKit Subscription Issue Fix

This implementation provides a comprehensive workaround for the subscription issue reported in [Issue #207](https://github.com/kingstinct/react-native-healthkit/issues/207) of the react-native-healthkit library.

## Problem Summary

The core issue is that `subscribeToChanges` doesn't reliably trigger updates for heart rate data when the app is in the foreground. The subscription callback only fires when:
- The app transitions from background to foreground
- A workout completes on the Apple Watch

## Solution Overview

This fix implements a hybrid approach that combines:
1. **Native HealthKit subscriptions** (for when they work)
2. **Intelligent polling fallback** (for when subscriptions fail)
3. **App state monitoring** (for foreground/background transitions)
4. **Visual feedback** (showing whether live updates or polling is active)

## Key Features

### 1. Subscription Status Detection
- Monitors whether the subscription is actually triggering updates
- Automatically falls back to polling if no updates received within 10 seconds
- Visual indicator shows current update mode (live vs polling)

### 2. Intelligent Polling Mechanism
- **Aggressive initial polling**: Every 5 seconds for the first minute
- **Regular polling**: Every 30 seconds after the initial period
- **App state aware**: Only polls when app is in foreground
- **Duplicate prevention**: Tracks last update time to avoid processing duplicate data

### 3. App State Handling
- Immediately fetches latest data when app comes to foreground
- Stops polling when app goes to background
- Maintains subscription even in background for potential updates

### 4. Visual Feedback
- Status indicator (green = live updates, yellow = polling mode)
- Shows time since last update
- Clear error messages for troubleshooting

## Implementation Details

### State Management
```javascript
const [subscriptionActive, setSubscriptionActive] = useState(false);
const [lastUpdateTime, setLastUpdateTime] = useState(null);
const pollingIntervalRef = useRef(null);
const appStateRef = useRef(AppState.currentState);
```

### Subscription Setup with Fallback
```javascript
// Set up subscription
unsub = HealthKit.subscribeToChanges(heartRateType, () => {
  setSubscriptionActive(true);
  getLatestHeartRate();
});

// Fallback to polling if no updates
subscriptionTimeout = setTimeout(() => {
  if (!subscriptionActive) {
    startIntelligentPolling();
  }
}, 10000);
```

### Polling Strategy
- Initial phase: 5-second intervals for quick response
- Long-term phase: 30-second intervals to conserve battery
- Automatically adjusts based on app state

## Benefits

1. **Reliability**: Works even when native subscriptions fail
2. **User Experience**: Visual feedback shows connection status
3. **Battery Efficiency**: Intelligent polling reduces unnecessary queries
4. **Flexibility**: Automatically adapts to different scenarios

## Future Improvements

While this solution provides a robust workaround, the ideal fix would be:
1. Native library update to implement observer queries in `didFinishLaunchingWithOptions`
2. Support for React Native's New Architecture
3. Better error handling and retry mechanisms in the native layer

## Testing

To test the implementation:
1. Launch the app and grant HealthKit permissions
2. Start a workout on Apple Watch to generate heart rate data
3. Observe the status indicator - it should show "Polling Mode" if subscriptions aren't working
4. Check that heart rate updates appear within 5-30 seconds
5. Background/foreground the app to test state transitions