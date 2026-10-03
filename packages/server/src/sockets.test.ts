import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  GameUpdate,
  RoomView,
  ServerToClientEvents,
  Session,
} from '@cambio/shared';
import { createAppServer } from './app';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const server = createAppServer();
let url = '';
const clients: Client[] = [];

beforeAll(async () => {
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const c of clients) c.disconnect();
  await server.io.close();
});

async function client(): Promise<Client> {
  const c: Client = connect(url, { transports: ['websocket'], forceNew: true });
  clients.push(c);
  await new Promise<void>((resolve) => c.once('connect', () => resolve()));
  return c;
}

const next = <E extends 'room' | 'game'>(c: Client, event: E) =>
  new Promise<E extends 'room' ? RoomView : GameUpdate | null>((resolve) =>
    c.once(event, resolve as never),
  );

describe('Socket-Protokoll', () => {
  it('Raum erstellen, beitreten, Einstellungen ändern, Spiel starten', async () => {
    const host = await client();
    const created = await host.emitWithAck('createRoom', { name: 'Anna' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const { roomCode } = created.session;
    expect(roomCode).toMatch(/^[A-Z]{4}$/);

    const guest = await client();
    const hostSeesJoin = next(host, 'room');
    const joined = await guest.emitWithAck('joinRoom', {
      code: roomCode.toLowerCase(),
      name: 'Ben',
    });
    expect(joined.ok).toBe(true);
    expect((await hostSeesJoin).players.map((p) => p.name)).toEqual(['Anna', 'Ben']);

    expect(await guest.emitWithAck('updateSettings', { snapWindow: 5 })).toEqual({
      ok: false,
      error: 'notHost',
    });
    expect(await host.emitWithAck('updateSettings', { snapWindow: 5 })).toEqual({ ok: true });

    const guestGame = next(guest, 'game');
    expect(await host.emitWithAck('startGame')).toEqual({ ok: true });
    const update = await guestGame;
    expect(update?.view.phase.type).toBe('initialPeek');
    expect(update?.view.settings.snapWindow).toBe(5);
  });

  it('lehnt ungültige Aktionen ab', async () => {
    const c = await client();
    expect(await c.emitWithAck('gameAction', { type: 'drawFromDeck' })).toEqual({
      ok: false,
      error: 'notInRoom',
    });
    await c.emitWithAck('createRoom', { name: 'Cem' });
    expect(await c.emitWithAck('gameAction', { type: 'hack' } as never)).toEqual({
      ok: false,
      error: 'invalidPayload',
    });
    expect(await c.emitWithAck('joinRoom', { code: 'ZZZZ', name: 'X' })).toEqual({
      ok: false,
      error: 'roomNotFound',
    });
  });

  it('Wiederverbinden mit Session nach Verbindungsabbruch', async () => {
    const a = await client();
    const created = await a.emitWithAck('createRoom', { name: 'Dora' });
    if (!created.ok) throw new Error();
    const session: Session = created.session;
    const b = await client();
    await b.emitWithAck('joinRoom', { code: session.roomCode, name: 'Emil' });

    const bSeesDisconnect = next(b, 'room');
    a.disconnect();
    const afterDisconnect = await bSeesDisconnect;
    expect(afterDisconnect.players.find((p) => p.id === session.playerId)?.connected).toBe(false);

    const a2 = await client();
    const roomState = next(a2, 'room');
    expect(await a2.emitWithAck('resumeSession', session)).toEqual({ ok: true });
    expect((await roomState).players.every((p) => p.connected)).toBe(true);

    expect(await a2.emitWithAck('resumeSession', { ...session, token: 'falsch' })).toEqual({
      ok: false,
      error: 'invalidSession',
    });
  });
});
