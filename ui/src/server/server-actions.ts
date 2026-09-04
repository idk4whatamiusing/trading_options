import {
  getPreferencePersistence,
  PREFERENCE_REGISTRY,
  type PreferenceKey,
  type PreferenceValueMap,
  parsePreference,
} from "@/lib/preferences/preferences-config";

// Static export (BUILD_TARGET=export) cannot use next/headers cookies().
// These helpers fall back to defaults when cookies() is unavailable.
async function getCookieStore() {
  if (process.env.BUILD_TARGET === "export") return null;
  try {
    const { cookies } = await import("next/headers");
    return await cookies();
  } catch {
    return null;
  }
}

export async function getValueFromCookie(key: string): Promise<string | undefined> {
  const cookieStore = await getCookieStore();
  return cookieStore?.get(key)?.value;
}

export async function setValueToCookie(
  key: string,
  value: string,
  options: { path?: string; maxAge?: number } = {},
): Promise<void> {
  const cookieStore = await getCookieStore();
  if (!cookieStore) return;
  cookieStore.set(key, value, {
    path: options.path ?? "/",
    maxAge: options.maxAge ?? 60 * 60 * 24 * 7, // default: 7 days
  });
}

export async function getPreference<K extends PreferenceKey>(
  key: K,
): Promise<PreferenceValueMap[K]> {
  const definition = PREFERENCE_REGISTRY[key];
  const persistence = getPreferencePersistence(key);

  if (persistence !== "client-cookie" && persistence !== "server-cookie") {
    return definition.defaultValue as PreferenceValueMap[K];
  }

  const cookieStore = await getCookieStore();
  if (!cookieStore) return definition.defaultValue as PreferenceValueMap[K];
  return parsePreference(key, cookieStore.get(key)?.value?.trim());
}
