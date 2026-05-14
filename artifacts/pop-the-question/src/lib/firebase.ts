import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  deleteUser as firebaseDeleteUser,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const isAuthEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!_app) {
    _app = initializeApp(firebaseConfig as Record<string, string>);
  }
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getFirebaseApp());
  }
  return _auth;
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  if (isNative()) {
    // Native Google flow via Capacitor plugin — uses the platform account
    // picker, not a popup (popups don't work in WKWebView).
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;
    if (!idToken) throw new Error("Google sign-in did not return an id token");
    const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
    const userCred = await signInWithCredential(getFirebaseAuth(), credential);
    return userCred.user;
  }
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(getFirebaseAuth(), provider);
  return result.user;
}

export async function signInWithApple(): Promise<FirebaseUser> {
  if (isNative()) {
    // Native Sign in with Apple via Capacitor plugin.
    const result = await FirebaseAuthentication.signInWithApple({
      scopes: ["email", "name"],
    });
    const idToken = result.credential?.idToken;
    if (!idToken) throw new Error("Apple sign-in did not return an id token");
    const provider = new OAuthProvider("apple.com");
    const credential = provider.credential({
      idToken,
      rawNonce: result.credential?.nonce,
    });
    const userCred = await signInWithCredential(getFirebaseAuth(), credential);
    return userCred.user;
  }
  // Web fallback: Apple OAuth via popup. Requires Apple provider enabled
  // in the Firebase console and an Apple Services ID configured.
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  const result = await signInWithPopup(getFirebaseAuth(), provider);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return result.user;
}

export async function createEmailAccount(email: string, password: string): Promise<FirebaseUser> {
  const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  return result.user;
}

export async function signOut(): Promise<void> {
  if (isNative()) {
    await FirebaseAuthentication.signOut().catch(() => {
      // Best-effort — Firebase JS signOut below is the source of truth.
    });
  }
  await firebaseSignOut(getFirebaseAuth());
}

export async function deleteCurrentUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth.currentUser) throw new Error("Not signed in");
  await firebaseDeleteUser(auth.currentUser);
  if (isNative()) {
    await FirebaseAuthentication.signOut().catch(() => {});
  }
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export type { FirebaseUser };
