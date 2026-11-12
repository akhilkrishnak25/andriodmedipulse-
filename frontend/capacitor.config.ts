import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rocketwheel.medipulse',
  appName: 'Rocket Wheel',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'medipulse-backend-veca.onrender.com',
      'checkout.razorpay.com',
      '*.razorpay.com',
    ],
  },
  android: {
    backgroundColor: '#1E20E0',
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: false,
      backgroundColor: '#1E20E0',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#15179f',
    },
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
  },
};

export default config;
