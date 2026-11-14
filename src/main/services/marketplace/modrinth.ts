export class ModrinthService {
  private API_BASE = 'https://api.modrinth.com/v2';

  async getVersion(id: string) {
    const res = await fetch(`${this.API_BASE}/version/${id}`);
    return res.json();
  }

  async getLatestVersion(projectId: string) {
    const res = await fetch(`${this.API_BASE}/project/${projectId}/version`);
    const versions = await res.json();
    return versions[0];
  }

  async download(version: any) {
    const primaryFile = version.files.find((f: any) => f.primary) || version.files[0];
    console.log(`Downloading ${primaryFile.url}...`);
    // Implementation for local file storage
  }
}
