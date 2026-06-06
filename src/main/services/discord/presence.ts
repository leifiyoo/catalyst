import { Client } from 'discord-rpc';

export class DiscordPresenceService {
  private rpc: Client;
  private clientId: string = 'YOUR_APP_ID';

  constructor() {
    this.rpc = new Client({ transport: 'ipc' });
  }

  async connect() {
    await this.rpc.login({ clientId: this.clientId });
  }

  updateStatus(status: 'online' | 'offline' | 'restarting', serverName: string) {
    const details = status === 'online' ? `Managing: ${serverName}` : 'Idle';
    const state = status.charAt(0).toUpperCase() + status.slice(1);
    
    this.rpc.setActivity({
      details,
      state,
      largeImageKey: 'logo',
      largeImageText: 'Catalyst Control Center',
      instance: false,
    });
  }
}
