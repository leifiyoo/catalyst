import { app, net } from 'electron';
import { ChangelogData, ChangelogEntry } from '@shared/types';

const REPO_OWNER = 'leifiyoo';
const REPO_NAME = 'catalyst';
const BRANCH = 'main';

export type UpdateCheckResult = {
    updateAvailable: boolean;
    latestVersion: string;
    currentVersion: string;
    releaseUrl: string;
    changelog?: ChangelogEntry[];
    error?: string;
};

/**
 * Fetches CHANGELOG.json from the GitHub repo and compares the latest
 * version entry against the locally installed app version.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
    const currentVersion = app.getVersion();
    const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/refs/heads/${BRANCH}/CHANGELOG.json`;

    try {
        const response = await net.fetch(url, {
            headers: { 'User-Agent': 'Catalyst-Updater' }
        });

        if (!response.ok) {
            return {
                updateAvailable: false,
                latestVersion: '0.0.0',
                currentVersion,
                releaseUrl: '',
                error: `Failed to fetch changelog: HTTP ${response.status}`
            };
        }

        const data = await response.text();
        const changelog: ChangelogData = JSON.parse(data);

        if (!changelog.versions || changelog.versions.length === 0) {
            return {
                updateAvailable: false,
                latestVersion: currentVersion,
                currentVersion,
                releaseUrl: ''
            };
        }

        const latestEntry = changelog.versions[0];
        const latestVersion = latestEntry.version;
        const isNewer = compareVersions(latestVersion, currentVersion) > 0;

        // Collect all changelog entries that are newer than the current version
        const newChanges = changelog.versions.filter(
            (entry) => compareVersions(entry.version, currentVersion) > 0
        );

        return {
            updateAvailable: isNewer,
            latestVersion,
            currentVersion,
            releaseUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`,
            changelog: isNewer ? newChanges : undefined
        };
    } catch (e: unknown) {
        return {
            updateAvailable: false,
            latestVersion: '0.0.0',
            currentVersion,
            releaseUrl: '',
            error: e instanceof Error ? e.message : 'Unknown error checking for updates'
        };
    }
}

function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const val1 = parts1[i] || 0;
        const val2 = parts2[i] || 0;
        if (val1 > val2) return 1;
        if (val1 < val2) return -1;
    }
    return 0;
}
