import http from 'http';
import fs from 'fs';
import path from 'path';

export class ResourcePackServer {
  private server: http.Server;
  private port: number = 24464;

  constructor(private packsDir: string) {
    this.server = http.createServer((req, res) => {
      const packPath = path.join(this.packsDir, req.url || '');
      
      if (fs.existsSync(packPath) && fs.lstatSync(packPath).isFile()) {
        const stream = fs.createReadStream(packPath);
        res.writeHead(200, { 'Content-Type': 'application/zip' });
        stream.pipe(res);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
  }

  start() {
    this.server.listen(this.port);
    console.log(`Resource pack server listening on port ${this.port}`);
  }

  getPackUrl(filename: string, ip: string) {
    return `http://${ip}:${this.port}/${filename}`;
  }
}
