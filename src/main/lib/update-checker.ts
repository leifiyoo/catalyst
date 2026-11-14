import { app, net } from "electron";
import type { ChangelogEntry, UpdateCheckResult } from "@shared/types";

const REPO_OWNER = "leifiyoo";
const REPO_NAME = "catalyst";
const RELEASES_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

export type GitHubRelease = {
  tag_name?: string;
  name?: string;
  html_url?: string;
  body?: string | null;
  published_at?: string;
};

export function normalizeVersion(version: string): string {
  const normalized = version.trim().replace(/^[vV]/, "");
  const match = normalized.match(/\d+(?:\.\d+)*(?:[-+][0-9A-Za-z.-]+)?/);
  return match?.[0] ?? normalized;
}

export function compareVersions(v1: string, v2: string): number {
  const parts1 = normalizeVersion(v1)
    .split(/[+-]/)[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10));
  const parts2 = normalizeVersion(v2)
    .split(/[+-]/)[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10));

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const val1 = Number.isFinite(parts1[i]) ? parts1[i] : 0;
    const val2 = Number.isFinite(parts2[i]) ? parts2[i] : 0;
    if (val1 > val2) return 1;
    if (val1 < val2) return -1;
  }
  return 0;
}

function buildChangelogEntry(release: GitHubRelease, latestVersion: string): ChangelogEntry | undefined {
  const releaseNotes = typeof release.body === "string" ? release.body.trim() : "";
  if (!releaseNotes) return undefined;

  return {
    version: latestVersion,
    date: release.published_at ? release.published_at.slice(0, 10) : "",
    title: release.name || `Catalyst ${latestVersion}`,
    changes: releaseNotes
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

export function buildUpdateCheckResult(
  release: GitHubRelease,
  currentVersion: string
): UpdateCheckResult {
  const latestVersion = normalizeVersion(release.tag_name || release.name || currentVersion);
  const releaseNotes = typeof release.body === "string" ? release.body.trim() : undefined;
  const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
  const changelogEntry = updateAvailable
    ? buildChangelogEntry(release, latestVersion)
    : undefined;

  return {
    updateAvailable,
    latestVersion,
    currentVersion,
    releaseUrl: release.html_url || RELEASES_URL,
    releaseName: release.name,
    publishedAt: release.published_at,
    releaseNotes,
    changelog: changelogEntry ? [changelogEntry] : undefined,
  };
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion();

  try {
    const response = await net.fetch(LATEST_RELEASE_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Catalyst-Updater",
      },
    });

    if (!response.ok) {
      return {
        updateAvailable: false,
        latestVersion: currentVersion,
        currentVersion,
        releaseUrl: RELEASES_URL,
        error: `Failed to fetch latest GitHub release: HTTP ${response.status}`,
      };
    }

    const release = (await response.json()) as GitHubRelease;
    return buildUpdateCheckResult(release, currentVersion);
  } catch (error: unknown) {
    return {
      updateAvailable: false,
      latestVersion: currentVersion,
      currentVersion,
      releaseUrl: RELEASES_URL,
      error: error instanceof Error ? error.message : "Unknown error checking for updates",
    };
  }
}
