import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppServer } from './app';

const server = createAppServer();
let url = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await server.io.close();
});

describe('HTTP', () => {
  it('Health-Check antwortet', async () => {
    const res = await fetch(`${url}/health`);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('verbietet Suchmaschinen die Indexierung', async () => {
    const res = await fetch(`${url}/health`);
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
});
