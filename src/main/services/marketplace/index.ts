import { ModrinthService } from './modrinth';
import { DependencyResolver } from './resolver';

export class MarketplaceService {
  private modrinth = new ModrinthService();
  private resolver = new DependencyResolver();

  async installMod(projectId: string, versionId?: string) {
    const version = versionId 
      ? await this.modrinth.getVersion(versionId)
      : await this.modrinth.getLatestVersion(projectId);
    
    const dependencies = await this.resolver.resolve(version);
    for (const dep of dependencies) {
      await this.modrinth.download(dep);
    }
    return await this.modrinth.download(version);
  }
}
