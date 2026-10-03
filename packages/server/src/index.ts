import { parseArgs } from 'node:util';
import { createAppServer } from './app';

// `--port` hat Vorrang vor PORT, damit der Dev-Server nicht den Vite-Port erbt.
const { values } = parseArgs({ options: { port: { type: 'string' } }, strict: false });
const PORT = Number(values.port ?? process.env.PORT ?? 3001);
const { httpServer } = createAppServer();

httpServer.listen(PORT, () => {
  console.log(`Cambio-Server läuft auf http://localhost:${PORT}`);
});
