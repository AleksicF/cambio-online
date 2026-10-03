import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { attachGameHandlers, type GameServer } from './sockets';

export const SERVER_VERSION = process.env.npm_package_version ?? '0.1.0';

/** Erstellt HTTP- und Socket.IO-Server, ohne ihn zu starten (auch für Tests). */
export function createAppServer() {
  const app = express();
  const httpServer = createServer(app);
  const io: GameServer = new Server(httpServer);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // In Produktion liefert der Server auch den gebauten Client aus.
  const clientDist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../client/dist',
  );
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/socket\.io).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  const { rooms } = attachGameHandlers(io, SERVER_VERSION);
  return { httpServer, io, rooms };
}
