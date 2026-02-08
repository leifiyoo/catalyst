import { app, shell } from 'electron';
import https from 'https';

// TODO: Update these values when you upload the project to GitHub!
const REPO_OWNER = 'leifiyoo'; // Change this
const REPO_NAME = 'catalyst';     // Change this

export type UpdateCheckResult = {
    updateAvailable: boolean;
    latestVersion: string;
    currentVersion: string;
    releaseUrl: string;
    error?: string;
};

export async function checkForUpdates(): Promise<UpdateCheckResult> {
    return new Promise((resolve) => {
        const currentVersion = app.getVersion();
        
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
            headers: {
                'User-Agent': 'Catalyst-Updater'
            }
        };

        https.get(options, (res) => {
            let data = '';

            if (res.statusCode === 404) {
                // Repo not found
                resolve({ 
                    updateAvailable: false, 
                    latestVersion: "0.0.0", 
                    currentVersion, 
                    releaseUrl: "", 
                    error: "Repository not found" 
                });
                return;
            }

            if (res.statusCode !== 200) {
                 resolve({ 
                    updateAvailable: false, 
                    latestVersion: "0.0.0", 
                    currentVersion, 
                    releaseUrl: "", 
                    error: `GitHub API error: ${res.statusCode}` 
                });
                return;
            }

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const release = JSON.parse(data);
                    const tagName = release.tag_name || ''; // e.g. "v1.0.1"
                    // Strip 'v' prefix if present
                    const cleanLatest = tagName.startsWith('v') ? tagName.substring(1) : tagName;
                    const cleanCurrent = currentVersion;

                    // Simple version comparison (assuming semver)
                    // If latest != current, and latest is likely newer.
                    // For simplicity, we just check non-equality or implement simple semver check.
                    
                    const isNewer = compareVersions(cleanLatest, cleanCurrent) > 0;
                    
                    resolve({
                        updateAvailable: isNewer,
                        latestVersion: cleanLatest,
                        currentVersion: cleanCurrent,
                        releaseUrl: release.html_url || `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`
                    });

                } catch (e) {
                    resolve({ 
                        updateAvailable: false, 
                        latestVersion: "0.0.0", 
                        currentVersion, 
                        releaseUrl: "", 
                        error: "Failed to parse release data" 
                    });
                }
            });
        }).on('error', (err) => {
            resolve({ 
                updateAvailable: false, 
                latestVersion: "0.0.0", 
                currentVersion, 
                releaseUrl: "", 
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
