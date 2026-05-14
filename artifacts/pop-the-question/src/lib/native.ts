import { Capacitor } from "@capacitor/core";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

// Hosts we treat as in-app when handed to us via Universal Links / custom
// scheme. Anything else falls back to opening externally.
const IN_APP_HOSTS = new Set(["poptq.com", "www.poptq.com"]);

function navigateInApp(path: string) {
  // Wouter (and the rest of the app) listens to popstate. Push the new path,
  // then dispatch popstate so any active <Router> picks it up.
  if (!path.startsWith("/")) path = `/${path}`;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function handleUrlOpen(event: URLOpenListenerEvent) {
  try {
    const url = new URL(event.url);
    // Custom scheme form: com.poptq.app://join/ABCD
    if (url.protocol === "com.poptq.app:") {
      navigateInApp(`${url.hostname ? `/${url.hostname}` : ""}${url.pathname}${url.search}`);
      return;
    }
    if (IN_APP_HOSTS.has(url.hostname)) {
      navigateInApp(`${url.pathname}${url.search}`);
    }
  } catch {
    // Malformed URL — ignore.
  }
}

let initialized = false;

export async function initNativePlatform(): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (!Capacitor.isNativePlatform()) return;

  // Status bar: dark icons/text on the cream app background.
  await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  if (Capacitor.getPlatform() === "android") {
    await StatusBar.setBackgroundColor({ color: "#FFF8E7" }).catch(() => {});
  }
  await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});

  // Disable WKWebView rubber-band by CSS (works alongside Info.plist's
  // DisallowOverscroll). Applied here so it ships with the bundled JS even
  // if the Xcode-side Info.plist key gets lost in a future regen.
  const style = document.createElement("style");
  style.textContent = `
    html, body { overscroll-behavior: none; -webkit-overflow-scrolling: auto; }
    body { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
  `;
  document.head.appendChild(style);

  // Cold-start deep link.
  const launch = await App.getLaunchUrl().catch(() => null);
  if (launch?.url) {
    handleUrlOpen({ url: launch.url } as URLOpenListenerEvent);
  }

  // Warm deep links (Universal Links + custom scheme).
  App.addListener("appUrlOpen", handleUrlOpen);

  // Hide the splash once React is mounted enough to paint a real frame.
  requestAnimationFrame(() => {
    SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
  });
}
