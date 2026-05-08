import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  isAuthEnabled,
  signInWithGoogle as fbSignInWithGoogle,
  signInWithApple as fbSignInWithApple,
  signInWithEmail as fbSignInWithEmail,
  createEmailAccount as fbCreateEmailAccount,
  signOut as fbSignOut,
  onAuthChange,
  type FirebaseUser,
} from "@/lib/firebase";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface AppUser {
  uid: string;
  email: string | null;
  username: string;
  displayName: string | null;
  photoURL: string | null;
  authProvider: string;
}

interface AuthContextValue {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  needsUsername: boolean;
  authEnabled: boolean;
  showAuthModal: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createEmailAccount: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  registerUsername: (username: string, authProvider: string) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function fetchWithAuth<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    headers: {
      ...((options.headers ?? {}) as Record<string, string>),
      Authorization: `Bearer ${token}`,
    },
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(isAuthEnabled);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const registering = useRef(false);

  // Wire up the global auth token getter so all generated API calls include the token
  useEffect(() => {
    if (!isAuthEnabled) return;
    setAuthTokenGetter(async () => {
      if (!firebaseUser) return null;
      return firebaseUser.getIdToken();
    });
    return () => setAuthTokenGetter(null);
  }, [firebaseUser]);

  // After Firebase signs in, fetch/create the server-side user record
  const syncUser = useCallback(async (fbUser: FirebaseUser) => {
    if (registering.current) return;
    try {
      const token = await fbUser.getIdToken();
      const data = await fetchWithAuth<{ user: AppUser }>("/auth/me", token);
      setUser(data.user);
      setNeedsUsername(false);
      // Use Firebase UID as the playerToken so leaderboard scores are tied to account
      localStorage.setItem("ptq-player-token", fbUser.uid);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("404")) {
        // New user — needs to pick a username
        setNeedsUsername(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthEnabled) return;

    const unsub = onAuthChange(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await syncUser(fbUser);
      } else {
        setUser(null);
        setNeedsUsername(false);
      }
      setLoading(false);
    });

    return unsub;
  }, [syncUser]);

  const signInWithGoogle = useCallback(async () => {
    await fbSignInWithGoogle();
    setShowAuthModal(false);
  }, []);

  const signInWithApple = useCallback(async () => {
    await fbSignInWithApple();
    setShowAuthModal(false);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await fbSignInWithEmail(email, password);
    setShowAuthModal(false);
  }, []);

  const createEmailAccount = useCallback(async (email: string, password: string) => {
    await fbCreateEmailAccount(email, password);
    setShowAuthModal(false);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut();
    setUser(null);
    setFirebaseUser(null);
    setNeedsUsername(false);
    localStorage.removeItem("ptq-player-token");
  }, []);

  const registerUsername = useCallback(async (username: string, authProvider: string) => {
    if (!firebaseUser) throw new Error("Not signed in");
    registering.current = true;
    try {
      const token = await firebaseUser.getIdToken();
      const data = await fetchWithAuth<{ user: AppUser }>("/auth/register", token, {
        method: "POST",
        body: JSON.stringify({ username, authProvider }),
      });
      setUser(data.user);
      setNeedsUsername(false);
      localStorage.setItem("ptq-player-token", firebaseUser.uid);
    } finally {
      registering.current = false;
    }
  }, [firebaseUser]);

  const updateUsername = useCallback(async (username: string) => {
    if (!firebaseUser) throw new Error("Not signed in");
    const token = await firebaseUser.getIdToken();
    const data = await fetchWithAuth<{ user: AppUser }>("/auth/username", token, {
      method: "PUT",
      body: JSON.stringify({ username }),
    });
    setUser(data.user);
  }, [firebaseUser]);

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      loading,
      needsUsername,
      authEnabled: isAuthEnabled,
      showAuthModal,
      openAuthModal: () => setShowAuthModal(true),
      closeAuthModal: () => setShowAuthModal(false),
      signInWithGoogle,
      signInWithApple,
      signInWithEmail,
      createEmailAccount,
      signOut,
      registerUsername,
      updateUsername,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
