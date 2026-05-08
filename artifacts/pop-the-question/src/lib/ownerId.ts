const OWNER_ID_KEY = "ptq-owner-id-v1";
const PLAYER_TOKEN_KEY = "ptq-player-token";

let _cachedId: string | null = null;

export function getOwnerId(): string {
  // If user is authenticated, their playerToken IS their Firebase UID — use it as ownerId
  // so custom games sync across devices.
  const playerToken = typeof window !== "undefined"
    ? window.localStorage.getItem(PLAYER_TOKEN_KEY)
    : null;
  // Firebase UIDs are 28 chars; anonymous UUIDs are 36. Use playerToken only if it looks like a UID.
  if (playerToken && playerToken.length >= 20 && playerToken.length <= 128 && !playerToken.includes("-")) {
    return playerToken;
  }

  if (_cachedId) return _cachedId;
  if (typeof window === "undefined") return "server";
  try {
    const stored = window.localStorage.getItem(OWNER_ID_KEY);
    if (stored && /^[0-9a-f-]{36}$/.test(stored)) {
      _cachedId = stored;
      return stored;
    }
    const newId = crypto.randomUUID();
    window.localStorage.setItem(OWNER_ID_KEY, newId);
    _cachedId = newId;
    return newId;
  } catch {
    return "fallback-owner";
  }
}

export function ownerHeaders(): Record<string, string> {
  return { "x-owner-id": getOwnerId() };
}

export async function customGamesFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...ownerHeaders(),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
