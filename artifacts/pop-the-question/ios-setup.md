# Pop The Question — iOS / Capacitor Setup

This artifact is configured as a Capacitor 8 project that wraps the existing
poptq.com web app as a native iOS app for App Store submission.

The JS/TS side of the integration is fully wired up here. The `ios/` Xcode
project itself **must be generated on macOS** (Capacitor's `cap add ios`
shells out to CocoaPods and Xcode tooling). This file documents the steps
that need to happen there.

## App identity

| Field | Value |
| --- | --- |
| App name | Pop The Question |
| Bundle ID | `com.poptq.app` |
| Apple Team ID | `R8V7H2K646` |
| Web origin | `https://poptq.com` |
| Build output | `artifacts/pop-the-question/dist/public` |

## One-time bootstrap (macOS)

```bash
cd artifacts/pop-the-question

# 1. Install JS deps (the lockfile already has all Capacitor packages).
pnpm install

# 2. Build the bundle with relative asset paths.
pnpm build:ios

# 3. Generate the Xcode project.
pnpm cap:add:ios       # -> creates ios/App/App.xcodeproj

# 4. Copy the latest web bundle + native config into ios/.
pnpm cap:sync

# 5. Open the workspace in Xcode.
pnpm cap:open
```

## Xcode configuration (one-time)

In `ios/App/App.xcodeproj` under **Signing & Capabilities**:

1. **Team:** select Apple Team `R8V7H2K646`.
2. **Bundle Identifier:** confirm `com.poptq.app`.
3. **Capabilities to enable:**
   - Sign in with Apple
   - Push Notifications
   - Associated Domains → add `applinks:poptq.com`
4. **Info.plist additions:**
   - `DisallowOverscroll` = `YES` (kills WKWebView rubber-band scroll).
   - `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` — only if
     a future feature needs them; not required today.
   - URL Types → add scheme `com.poptq.app` for the custom-scheme fallback
     deep link (the JS in `src/lib/native.ts` already handles it).
5. **Drop in `GoogleService-Info.plist`** at `ios/App/App/GoogleService-Info.plist`
   (download from the Firebase console for the iOS app registered against
   bundle ID `com.poptq.app`).

## Universal Links (AASA)

Serve the following from `https://poptq.com/.well-known/apple-app-site-association`
with `Content-Type: application/json` and **no redirects**:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "R8V7H2K646.com.poptq.app",
        "paths": [
          "/join/*",
          "/daily/*",
          "/game/*",
          "/read-the-room/*"
        ]
      }
    ]
  }
}
```

`src/lib/native.ts` handles the in-app routing for these paths via the
`@capacitor/app` `appUrlOpen` listener, so taps on `poptq.com/join/ABCD`
from elsewhere on iOS open inside the app rather than Safari.

## Icons & splash

The repo doesn't include the rendered iOS asset catalog yet. Easiest path
on the Mac:

```bash
# In artifacts/pop-the-question, with a 1024x1024 icon.png and 2732x2732
# splash.png placed in resources/:
pnpm dlx @capacitor/assets generate --ios
```

That populates `ios/App/App/Assets.xcassets/AppIcon.appiconset` and the
splash screen storyboard. The splash background is already pinned to the
app's cream `#FFF8E7` via `capacitor.config.ts`.

## How the server URL works

`capacitor.config.ts` sets `server.url = process.env.CAP_SERVER_URL ?? "https://poptq.com"`.

- **Production / TestFlight builds:** leave `CAP_SERVER_URL` unset → the
  app loads the live site. The local bundle in `dist/public` is still
  shipped inside the IPA so the asset catalog, splash, and Info.plist are
  present even though the WebView points at the network.
- **Staging:** `CAP_SERVER_URL=https://staging.poptq.com pnpm cap:sync`.
- **Fully offline / bundle-only build:** remove the `server.url` line in
  `capacitor.config.ts` before `cap:sync`. Capacitor will then load
  `index.html` from `dist/public` inside the app.

> ⚠️ Apple Guideline 4.2 risk: a pure web wrapper can be rejected. The
> integrations already wired here (native Apple + Google sign-in via
> `@capacitor-firebase/authentication`, native haptics for correct/wrong
> answer feedback, native share sheet, push-notification entitlement,
> Universal Links into specific routes, splash + status bar) are the
> standard set used to clear 4.2. Keep at least these active.

## Auth flow on iOS

`src/lib/firebase.ts` branches on `Capacitor.isNativePlatform()`:

| Provider | Web | Native iOS |
| --- | --- | --- |
| Google | `signInWithPopup(GoogleAuthProvider)` | `FirebaseAuthentication.signInWithGoogle()` → `signInWithCredential` on JS SDK |
| Apple | `signInWithPopup(OAuthProvider("apple.com"))` | `FirebaseAuthentication.signInWithApple()` → `signInWithCredential` on JS SDK |
| Email/password | unchanged | unchanged |

Because the native flow mirrors the credential back into the JS SDK, the
existing `onAuthStateChanged` listener in `AuthContext` and the ID-token
fetcher used by the API client continue to work without changes.

**Sign in with Apple is required** by Apple Guideline 4.8 whenever a
third-party login (Google, in our case) is offered. The Apple button in
`AuthModal.tsx` is placed above the Google button per the HIG.

## Push notifications

`@capacitor/push-notifications` is installed but no JS-side registration
code ships yet. When adding the daily-puzzle reminder feature:

1. Enable the Push Notifications capability in Xcode (above).
2. Upload an APNs key to the Firebase console.
3. In JS, call `PushNotifications.requestPermissions()` + `register()` on a
   user action (not at app launch — Apple rejects unsolicited prompts).

## Day-to-day workflow

```bash
# After any change to web app source:
pnpm cap:sync       # rebuilds dist/public with BASE_PATH=./ and runs `cap sync ios`

# Open Xcode to run on simulator/device:
pnpm cap:open

# Or run directly from CLI (needs a connected device or default simulator):
pnpm cap:run
```

## Files added/changed for the wrapper

```
artifacts/pop-the-question/
├── capacitor.config.ts                # NEW
├── ios-setup.md                       # NEW (this file)
├── src/
│   ├── main.tsx                       # calls initNativePlatform()
│   ├── lib/
│   │   ├── firebase.ts                # native Google + Apple branches
│   │   ├── haptics.ts                 # native Haptics plugin when available
│   │   └── native.ts                  # NEW: status bar, splash, deep links
│   ├── contexts/AuthContext.tsx       # signInWithApple exposed
│   └── components/auth/AuthModal.tsx  # Apple Sign-In button
└── package.json                       # build:ios + cap:* scripts, Capacitor 8 deps
```
