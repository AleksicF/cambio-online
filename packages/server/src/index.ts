import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@cambio/shared';

const PORT = Number(process.env.PORT ?? 3001);
const SERVER_VERSION = process.env.npm_package_version ?? '0.1.0';

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// In Produktion liefert der Server auch den gebauten Client aus.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

io.on('connection', (socket) => {
  socket.emit('welcome', { serverVersion: SERVER_VERSION });
  socket.on('ping', (ack) => ack(Date.now()));
});

httpServer.listen(PORT, () => {
  console.log(`Cambio-Server läuft auf http://localhost:${PORT}`);
});
