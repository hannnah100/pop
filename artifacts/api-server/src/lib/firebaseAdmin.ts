import { logger } from "./logger";

let _available = false;
let _auth: import("firebase-admin/auth").Auth | null = null;

export function initFirebaseAdmin(): void {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    logger.warn("Firebase Admin credentials not set — auth features disabled. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY to enable.");
    return;
  }

  try {
    // ESM-compatible firebase-admin imports
    import("firebase-admin/app").then(({ initializeApp, cert, getApps }) => {
      import("firebase-admin/auth").then(({ getAuth }) => {
        const apps = getApps();
        const app = apps.length > 0
          ? apps[0]!
          : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
        _auth = getAuth(app);
        _available = true;
        logger.info("Firebase Admin SDK initialized");
      });
    }).catch((err: unknown) => {
      logger.error({ err }, "Firebase Admin SDK failed to load");
    });
  } catch (err) {
    logger.error({ err }, "Firebase Admin initialization error");
  }
}

export function isFirebaseAvailable(): boolean {
  return _available;
}

export async function verifyIdToken(token: string): Promise<{ uid: string; email?: string } | null> {
  if (!_auth) return null;
  try {
    const decoded = await _auth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? undefined };
  } catch {
    return null;
  }
}
