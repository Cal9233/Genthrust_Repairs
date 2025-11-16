import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.genthrust.repairs',
  appName: 'GenThrust Repairs',
  webDir: 'dist',
  server: {
    // For production, use your deployed backend URL
    // For development, use localhost
    // url: 'http://localhost:5173', // Uncomment for live reload during development
    cleartext: true // Allow HTTP in development
  },
  ios: {
    contentInset: 'always',
    scrollEnabled: true,
    backgroundColor: '#ffffff'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1e40af',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#ffffff',
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
