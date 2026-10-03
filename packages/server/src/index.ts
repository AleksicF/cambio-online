import { createAppServer } from './app';

const PORT = Number(process.env.PORT ?? 3001);
const { httpServer } = createAppServer();

httpServer.listen(PORT, () => {
  console.log(`Cambio-Server läuft auf http://localhost:${PORT}`);
});
