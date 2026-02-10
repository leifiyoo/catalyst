import { app } from 'electron';
import https from 'https';
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
    return new Promise((resolve) => {
        const currentVersion = app.getVersion();

        // Fetch the raw CHANGELOG.json from the repo
        const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/CHANGELOG.json`;

        const options = {
            hostname: 'raw.githubusercontent.com',
            path: `/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/CHANGELOG.json`,
            headers: {
                'User-Agent': 'Catalyst-Updater'
            }
        };

        https.get(options, (res) => {
            let data = '';

            if (res.statusCode !== 200) {
                resolve({
                    updateAvailable: false,
                    latestVersion: '0.0.0',
                    currentVersion,
                    releaseUrl: '',
                    error: `Failed to fetch changelog: HTTP ${res.statusCode}`
                });
                return;
            }

            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    const changelog: ChangelogData = JSON.parse(data);
                    
                    if (!changelog.versions || changelog.versions.length === 0) {
                        resolve({
                            updateAvailable: false,
                            latestVersion: currentVersion,
                            currentVersion,
                            releaseUrl: ''
                        });
                        return;
                    }

                    const latestEntry = changelog.versions[0];
                    const latestVersion = latestEntry.version;

                    const isNewer = compareVersions(latestVersion, currentVersion) > 0;

                    // Collect all changelog entries that are newer than the current version
                    const newChanges = changelog.versions.filter(
                        (entry) => compareVersions(entry.version, currentVersion) > 0
                    );

                    resolve({
                        updateAvailable: isNewer,
                        latestVersion,
                        currentVersion,
                        releaseUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`,
                        changelog: isNewer ? newChanges : undefined
                    });
                } catch (e) {
                    resolve({
                        updateAvailable: false,
                        latestVersion: '0.0.0',
                        currentVersion,
                        releaseUrl: '',
                        error: 'Failed to parse changelog data'
                    });
                }
            });
        }).on('error', (err) => {
            resolve({
                updateAvailable: false,
                latestVersion: '0.0.0',
                currentVersion,
                releaseUrl: '',
                error: err.message
            });
        });
    });
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
