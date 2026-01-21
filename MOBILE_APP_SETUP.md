# Mobile App Setup Guide

## Overview
This guide shows how to convert your React web app into native iOS and Android apps using Capacitor.

## What You'll Get
- ✅ Native iOS app (.ipa file)
- ✅ Native Android app (.apk/.aab file)
- ✅ Access to native device features (camera, push notifications, etc.)
- ✅ App Store and Google Play ready
- ✅ Keep your existing React code (no rewriting needed!)

## Prerequisites

### For iOS Development:
- macOS computer
- Xcode (free from App Store)
- Apple Developer Account ($99/year for App Store distribution)

### For Android Development:
- Any computer (Windows, Mac, Linux)
- Android Studio (free)
- Google Play Developer Account ($25 one-time fee)

## Setup Steps

### 1. Install Capacitor
```bash
cd frontend
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
```

### 2. Initialize Capacitor
```bash
npx cap init "Sports Card Tracker" "com.scorecard.app"
```

### 3. Add Platforms
```bash
npx cap add ios
npx cap add android
```

### 4. Build Your Web App
```bash
npm run build
```

### 5. Sync to Native Projects
```bash
npx cap sync
```

### 6. Open in Native IDEs
```bash
# For iOS
npx cap open ios

# For Android
npx cap open android
```

## Configuration

### Update capacitor.config.json
```json
{
  "appId": "com.scorecard.app",
  "appName": "Sports Card Tracker",
  "webDir": "build",
  "server": {
    "url": "https://your-vercel-url.vercel.app",
    "cleartext": true
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "backgroundColor": "#000000"
    }
  }
}
```

## Building for Production

### iOS
1. Open Xcode: `npx cap open ios`
2. Select your device or simulator
3. Product → Archive
4. Upload to App Store Connect

### Android
1. Open Android Studio: `npx cap open android`
2. Build → Generate Signed Bundle / APK
3. Follow the wizard
4. Upload to Google Play Console

## Native Features Available
- Camera (already used in your TCDBBrowser!)
- Push Notifications
- Geolocation
- Biometric Authentication
- File System Access
- Share API
- Status Bar Control

## Notes
- Your backend API will work as-is (Railway deployment)
- Frontend deployed on Vercel will work
- No code changes needed in most cases
- The web app continues to work alongside native apps
