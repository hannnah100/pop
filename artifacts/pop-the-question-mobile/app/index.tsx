import React, {
  useCallback,
  useRef,
  useState,
  type ComponentType,
  type Ref,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  WebView as WebViewClass,
  type WebViewNavigation,
  type WebViewProps,
} from "react-native-webview";

const WEB_APP_URL = "https://popthequestion.replit.app";

type WebViewHandle = InstanceType<typeof WebViewClass>;
const WebView = WebViewClass as unknown as ComponentType<
  WebViewProps & { ref?: Ref<WebViewHandle> }
>;

export default function WebViewScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebViewHandle>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;

      const onBackPress = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, [canGoBack]),
  );

  const onNavStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  }, []);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* @ts-ignore — iframe is valid in web React Native */}
        <iframe
          src={WEB_APP_URL}
          style={styles.iframe}
          onLoad={() => setLoading(false)}
        />
        {loading && (
          <View style={styles.spinnerOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#FF1493" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={onNavStateChange}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        bounces
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
      />
      {loading && (
        <View style={styles.spinnerOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#FF1493" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8E7",
  },
  webview: {
    flex: 1,
    backgroundColor: "#FFF8E7",
  },
  iframe: {
    flex: 1,
    width: "100%",
    borderWidth: 0,
  },
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 248, 231, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
});
