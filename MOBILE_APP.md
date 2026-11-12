# Rocket Wheel MediPulse — Mobile App & PWA Guide

Rocket Wheel MediPulse is configured both as an **Installable Progressive Web App (PWA)** and a **Native Android App powered by Capacitor** (`com.rocketwheel.medipulse`), connecting to the live Render backend (`https://medipulse-backend-veca.onrender.com/api`).

---

## 1. Installable PWA (Instant Install on Android, iOS, Windows & macOS)

When deployed to `https://rocketwheelmedpuls.onrender.com`, users can install the app directly from their browser:
- **Android (Chrome / Edge):** Tap the in-app **Install** banner or browser menu → **Install app** / **Add to Home screen**.
- **iOS (Safari):** Tap the **Share** icon → **Add to Home Screen**.
- **Desktop (Chrome / Edge):** Click the install icon in the address bar.

---

## 2. Build Android APK via GitHub Actions (No Local Android Studio Needed)

A GitHub Actions workflow is configured at `.github/workflows/android-apk.yml`:
1. Push your changes to `main` or `master` (or open **Actions → Build Android APK → Run workflow** on GitHub).
2. Once the workflow finishes, download the **`RocketWheel-MediPulse-debug-apk`** artifact (`app-debug.apk`).
3. Transfer `app-debug.apk` to an Android phone and install it.

---

## 3. Build Android APK / AAB Locally (With Android Studio)

Prerequisites:
- Node.js `>= 22`
- Java JDK `21`
- Android Studio with Android SDK installed

Commands from the project root (`op/`):

```bash
# Build production app bundle (pointing to Render backend) and sync into Android project
npm run cap:sync

# Open the Android project in Android Studio to run on emulator/device or build signed APK/AAB
npm run cap:open
```

To build a debug APK directly from the terminal once Android SDK & JDK 21 are configured:

```bash
cd frontend
npm run cap:sync
cd android
./gradlew assembleDebug
```

The generated APK will be at:
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 4. App Configuration Files

- **Capacitor Config:** `frontend/capacitor.config.ts` (`appId: com.rocketwheel.medipulse`, `appName: Rocket Wheel`)
- **App Environment (Live Render API):** `frontend/.env.app`
- **App Icons & Splash Assets:** `frontend/assets/`, `frontend/public/icons/`, and `frontend/android/app/src/main/res/`
- **PWA Manifest & Service Worker:** Configured in `frontend/vite.config.ts` and `frontend/src/main.tsx`
- **Native Bridges (Back button, Status bar, Splash screen, File save/share, Offline banner):**
  - `frontend/src/utils/platform.ts`
  - `frontend/src/utils/nativeApp.ts`
  - `frontend/src/utils/fileDownload.ts`
  - `frontend/src/components/common/NetworkStatusBanner.tsx`
  - `frontend/src/components/common/PwaInstallPrompt.tsx`
