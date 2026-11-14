import { app } from "electron";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type { AppPreferences } from "@shared/types";

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  askBeforeClose: true,
};

const PREFERENCES_FILE = "preferences.json";

export function normalizeAppPreferences(value: unknown): AppPreferences {
  const candidate =
    typeof value === "object" && value !== null
      ? (value as Partial<AppPreferences>)
      : {};

  return {
    askBeforeClose:
      typeof candidate.askBeforeClose === "boolean"
        ? candidate.askBeforeClose
        : DEFAULT_APP_PREFERENCES.askBeforeClose,
  };
}

export function mergeAppPreferences(
  current: unknown,
  updates: Partial<AppPreferences>
): AppPreferences {
  return normalizeAppPreferences({
    ...normalizeAppPreferences(current),
    ...updates,
  });
}

function getPreferencesPath(): string {
  return join(app.getPath("userData"), PREFERENCES_FILE);
}

export async function getAppPreferences(): Promise<AppPreferences> {
  try {
    const raw = await readFile(getPreferencesPath(), "utf8");
    return normalizeAppPreferences(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Failed to read app preferences:", error);
    }
    return { ...DEFAULT_APP_PREFERENCES };
  }
}

export async function updateAppPreferences(
  updates: Partial<AppPreferences>
): Promise<AppPreferences> {
  const preferencesPath = getPreferencesPath();
  const current = await getAppPreferences();
  const next = mergeAppPreferences(current, updates);

  await mkdir(dirname(preferencesPath), { recursive: true });
  await writeFile(preferencesPath, JSON.stringify(next, null, 2), "utf8");

  return next;
}
