/**
 * index.js
 * 
 * CRITICAL FIX: Initialize HealthKit subscriptions HERE, before React mounts!
 * 
 * As per Robert Herber (react-native-healthkit maintainer):
 * "The background subscriptions should be set up in index.js"
 * "This is a no-go for true background updates (but still works when the app 
 *  UI is alive although in the background)"
 * 
 * By calling healthKitStore.initialize() here, we ensure:
 * 1. Subscriptions are registered at app launch
 * 2. Background delivery callbacks work correctly
 * 3. Foreground updates fire properly
 */

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';

// CRITICAL: Import and initialize HealthKit BEFORE React mounts
import { healthKitStore } from './src/HealthKitSetup';

// Initialize HealthKit on iOS immediately at app launch
if (Platform.OS === 'ios') {
  console.log('[index.js] 🏥 Initializing HealthKit before React...');
  
  healthKitStore.initialize()
    .then(() => {
      console.log('[index.js] ✅ HealthKit initialized successfully');
    })
    .catch((error) => {
      console.error('[index.js] ❌ HealthKit initialization error:', error);
    });
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
