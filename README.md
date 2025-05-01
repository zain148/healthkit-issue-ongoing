# HealthKit Heart Rate Monitor App

A simple React Native app with Expo that demonstrates how to properly use Apple HealthKit to monitor and display heart rate data.

## Features

- Request HealthKit permissions for heart rate data
- Display the most recent heart rate reading with source information
- Subscribe to heart rate data changes with proper observer pattern
- Refresh heart rate data on demand
- Proper resource cleanup and error handling

## Prerequisites

- iOS device (HealthKit is only available on iOS)
- Physical device for testing (HealthKit cannot be fully tested on the iOS simulator)
- Xcode 13.0 or higher
- React Native development environment set up

## Setup & Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Run the app:
   ```
   npm run ios
   ```

## How to Use

1. Launch the app on a physical iOS device
2. Tap the "Request HealthKit Permissions" button
3. Grant permission when iOS prompts for HealthKit access
4. The app will display your most recent heart rate reading if available
5. Tap "Refresh Heart Rate" to fetch the latest data

## Implementation Details

This app uses `@kingstinct/react-native-healthkit` to integrate with Apple HealthKit. The main components include:

- Proper permission requests using `requestAuthorization`
- Efficient heart rate retrieval using `getMostRecentQuantitySample`
- Subscription to heart rate data changes with `subscribeToChanges`
- Clean unsubscription when component unmounts
- Simple UI to display the heart rate data with source information

## Key HealthKit Concepts

- **Permissions**: We request read-only access to heart rate data
- **Quantity Types**: Heart rate is a quantity type in HealthKit
- **Subscriptions**: Uses observer pattern to get real-time updates
- **Cleanup**: Properly unsubscribes from observers when not needed

## Troubleshooting

- Make sure you're testing on a physical iOS device
- Ensure HealthKit permissions are granted in the device Settings
- If no heart rate data appears, try recording some heart rate data in the Health app or with an Apple Watch
- Check console logs for any errors related to HealthKit permissions or data queries
- Remember that HealthKit data access can be revoked by the user at any time in the Health app
