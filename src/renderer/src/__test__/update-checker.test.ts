import { describe, expect, test } from "vitest";

import {
  buildUpdateCheckResult,
  compareVersions,
  normalizeVersion,
} from "../../../main/lib/update-checker";

describe("GitHub release update checker helpers", () => {
  test("normalizes version tags from GitHub releases", () => {
    expect(normalizeVersion("v1.3.0")).toBe("1.3.0");
    expect(normalizeVersion("  release-2.0.1  ")).toBe("2.0.1");
  });

  test("compares semantic versions with pre-release suffixes", () => {
    expect(compareVersions("1.3.0", "1.2.9")).toBe(1);
    expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.0-beta.1", "1.2.0")).toBe(0);
  });

  test("maps a newer GitHub release to an update notification result", () => {
    const result = buildUpdateCheckResult(
      {
        tag_name: "v1.3.0",
        name: "Catalyst 1.3.0",
        html_url: "https://github.com/leifiyoo/catalyst/releases/tag/v1.3.0",
        published_at: "2026-06-13T10:00:00Z",
        body: "- Added safer shutdown\n- Improved update checks",
      },
      "1.2.0"
    );

    expect(result).toMatchObject({
      updateAvailable: true,
      latestVersion: "1.3.0",
      currentVersion: "1.2.0",
      releaseName: "Catalyst 1.3.0",
      publishedAt: "2026-06-13T10:00:00Z",
      releaseUrl: "https://github.com/leifiyoo/catalyst/releases/tag/v1.3.0",
      releaseNotes: "- Added safer shutdown\n- Improved update checks",
    });
  });

  test("does not report an update for the current release", () => {
    const result = buildUpdateCheckResult(
      {
        tag_name: "v1.2.0",
        html_url: "https://github.com/leifiyoo/catalyst/releases/tag/v1.2.0",
      },
      "1.2.0"
    );

    expect(result.updateAvailable).toBe(false);
    expect(result.latestVersion).toBe("1.2.0");
    expect(result.currentVersion).toBe("1.2.0");
  });
});
