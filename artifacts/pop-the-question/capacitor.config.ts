import type { CapacitorConfig } from "@capacitor/cli";

// Override at build time to point at a TestFlight/staging origin, e.g.
//   CAP_SERVER_URL=https://staging.poptq.com pnpm cap sync ios
// Leave unset to ship a bundle-only build (loads dist/public from the IPA).
const serverUrl = process.env.CAP_SERVER_URL ?? "https://poptq.com";

const config: CapacitorConfig = {
  appId: "com.poptq.app",
  appName: "Pop The Question",
  webDir: "dist/public",
  bundledWebRuntime: false,

  server: {
    url: serverUrl,
    // WKWebView origin Capacitor uses when loading the bundle locally.
    // Keeping it on the live host means storage/cookies are shared whether
    // the app loads from server.url or falls back to the local bundle.
    hostname: "poptq.com",
    iosScheme: "https",
    // Origins the WebView is allowed to navigate to without bouncing out
    // to Safari. Covers OAuth round-trips and the API/socket host.
    allowNavigation: [
      "poptq.com",
      "*.poptq.com",
      "*.firebaseapp.com",
      "*.googleapis.com",
      "accounts.google.com",
      "appleid.apple.com",
    ],
    cleartext: false,
  },

  ios: {
    // Edge-to-edge with manual safe-area handling via env(safe-area-inset-*).
    contentInset: "never",
    // Disable rubber-band scroll. Also requires DisallowOverscroll=true in
    // Info.plist — set during Xcode configuration on macOS.
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
    preferredContentMode: "mobile",
    // Universal Links: poptq.com/join/:code, /daily/*, /game/* are handled
    // in-app via the App plugin's appUrlOpen listener (see src/lib/native.ts).
    handleApplicationNotifications: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#FFF8E7",
      showSpinner: false,
      iosSpinnerStyle: "small",
      splashFullScreen: true,
      splashImmersive: true,
    },

    StatusBar: {
      // "Light" in Capacitor's enum = dark icons/text for use on a light
      // background. This is what the user asked for as "dark style".
      style: "LIGHT",
      backgroundColor: "#FFF8E7",
      overlaysWebView: true,
    },

    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },

    FirebaseAuthentication: {
      // Only enable the providers we ship; skip the ones we don't use.
      skipNativeAuth: false,
      providers: ["apple.com", "google.com", "password"],
    },
  },
};

export default config;
