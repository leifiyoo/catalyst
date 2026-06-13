import type { AppPreferences } from "@shared/types";

export const WORLD_SAVE_INTERVAL_MS = 5 * 60 * 1000;
export const SAVE_ALL_FLUSH_COMMAND = "save-all flush";
export const STOP_COMMAND = "stop";

export function shouldConfirmClose(
  preferences: AppPreferences,
  runningServerCount: number
): boolean {
  return preferences.askBeforeClose && runningServerCount > 0;
}

export function buildGracefulStopCommands(): string[] {
  return [SAVE_ALL_FLUSH_COMMAND, STOP_COMMAND];
}
