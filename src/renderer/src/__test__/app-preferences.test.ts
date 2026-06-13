import { describe, expect, test } from "vitest";

import {
  DEFAULT_APP_PREFERENCES,
  mergeAppPreferences,
  normalizeAppPreferences,
} from "../../../main/lib/app-preferences";

describe("app preferences", () => {
  test("asks before closing by default", () => {
    expect(normalizeAppPreferences(undefined)).toEqual(DEFAULT_APP_PREFERENCES);
    expect(normalizeAppPreferences({})).toEqual(DEFAULT_APP_PREFERENCES);
  });

  test("preserves an explicit disabled close warning preference", () => {
    expect(normalizeAppPreferences({ askBeforeClose: false })).toEqual({
      askBeforeClose: false,
    });
  });

  test("merges partial app preference updates over normalized current data", () => {
    expect(mergeAppPreferences(undefined, { askBeforeClose: false })).toEqual({
      askBeforeClose: false,
    });

    expect(
      mergeAppPreferences({ askBeforeClose: false }, { askBeforeClose: true })
    ).toEqual({
      askBeforeClose: true,
    });
  });
});
