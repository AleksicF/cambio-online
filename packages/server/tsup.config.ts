import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  clean: true,
  // Das Shared-Paket liegt als TypeScript-Quelle vor und wird deshalb mitgebündelt.
  noExternal: ['@cambio/shared'],
});
