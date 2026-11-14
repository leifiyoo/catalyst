import { describe, expect, test } from "vitest";

import {
  buildGracefulStopCommands,
  shouldConfirmClose,
  WORLD_SAVE_INTERVAL_MS,
} from "../../../main/lib/shutdown-policy";

describe("shutdown policy", () => {
  test("asks for close confirmation only when a server is running and the preference is enabled", () => {
    expect(shouldConfirmClose({ askBeforeClose: true }, 0)).toBe(false);
    expect(shouldConfirmClose({ askBeforeClose: false }, 1)).toBe(false);
    expect(shouldConfirmClose({ askBeforeClose: true }, 1)).toBe(true);
  });

  test("flushes world data before the graceful stop command", () => {
    expect(buildGracefulStopCommands()).toEqual(["save-all flush", "stop"]);
  });

  test("uses a short periodic save interval to limit power-loss data loss", () => {
    expect(WORLD_SAVE_INTERVAL_MS).toBeLessThanOrEqual(5 * 60 * 1000);
  });
});
