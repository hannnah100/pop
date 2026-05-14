import React, { useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const WEB_APP_URL = "https://poptq.com";

export default function WebViewScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const onLoadEnd = useCallback(() => {
    setLoading(false);
    setRefreshing(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    webViewRef.current?.reload();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <WebView
          ref={webViewRef}
          source={{ uri: WEB_APP_URL }}
          style={styles.webview}
          onLoadEnd={onLoadEnd}
          allowsBackForwardNavigationGestures
          bounces={false}
          overScrollMode="never"
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => null}
        />
      </ScrollView>

      {loading && !refreshing && (
        <View style={styles.spinnerOverlay}>
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
  scrollContent: {
    flexGrow: 1,
  },
  webview: {
    flex: 1,
    minHeight: 400,
    ...(Platform.OS === "web" ? { height: "100vh" } : {}),
  },
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFF8E7",
    justifyContent: "center",
    alignItems: "center",
  },
});
