import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentPlayer, type GameUpdate, type RoomView } from '@cambio/shared';
import { ABSENT_PLAYER_TIMEOUT_MS, Room, type RoomTransport } from './Room';

function fakeTransport() {
  const rooms = new Map<string, RoomView>();
  const games = new Map<string, GameUpdate | null>();
  const kicked: string[] = [];
  const transport: RoomTransport = {
    sendRoom: (id, room) => rooms.set(id, room),
    sendGame: (id, update) => games.set(id, update),
    sendKicked: (id) => kicked.push(id),
  };
  return { transport, rooms, games, kicked };
}

function setupRoom(names = ['Anna', 'Ben']) {
  const t = fakeTransport();
  const room = new Room('ABCD', t.transport, () => 0);
  const ids = names.map((name) => {
    const r = room.join(name);
    if (!r.ok) throw new Error(r.error);
    return r.member.id;
  });
  return { room, ids, ...t };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Lobby', () => {
  it('erster Spieler wird Host', () => {
    const { room, ids } = setupRoom();
    expect(room.hostId).toBe(ids[0]);
  });

  it('prüft Namen und macht doppelte eindeutig', () => {
    const { room } = setupRoom(['Anna']);
    expect(room.join('   ')).toEqual({ ok: false, error: 'invalidName' });
    expect(room.join('x'.repeat(21))).toEqual({ ok: false, error: 'invalidName' });
    const r = room.join('anna');
    expect(r.ok && r.member.name).toBe('anna 2');
  });

  it('lehnt Beitritt ab, wenn der Raum voll ist', () => {
    const { room, ids } = setupRoom();
    room.updateSettings(ids[0]!, { maxPlayers: 2 });
    expect(room.join('Cem')).toEqual({ ok: false, error: 'roomFull' });
  });

  it('nur der Host darf Einstellungen ändern', () => {
    const { room, ids, rooms } = setupRoom();
    expect(room.updateSettings(ids[1]!, { snapWindow: 5 })).toEqual({
      ok: false,
      error: 'notHost',
    });
    expect(room.updateSettings(ids[0]!, { snapWindow: 5 }).ok).toBe(true);
    expect(rooms.get(ids[1]!)?.settings.snapWindow).toBe(5);
  });

  it('max. Spieler kann nicht unter die aktuelle Anzahl fallen', () => {
    const { room, ids } = setupRoom(['A', 'B', 'C']);
    room.updateSettings(ids[0]!, { maxPlayers: 2 });
    expect(room.settings.maxPlayers).toBe(3);
  });

  it('Host kann Spieler entfernen', () => {
    const { room, ids, kicked } = setupRoom();
    expect(room.kick(ids[0]!, ids[1]!).ok).toBe(true);
    expect(kicked).toEqual([ids[1]]);
    expect(room.members).toHaveLength(1);
  });

  it('Host-Rolle wandert weiter, wenn der Host geht', () => {
    const { room, ids } = setupRoom();
    room.leave(ids[0]!);
    expect(room.hostId).toBe(ids[1]);
  });

  it('Spiel braucht mindestens 2 Spieler', () => {
    const { room, ids } = setupRoom(['Anna']);
    expect(room.start(ids[0]!)).toEqual({ ok: false, error: 'notEnoughPlayers' });
  });
});

describe('Spiel', () => {
  it('Start schickt jedem Spieler seine eigene Sicht', () => {
    const { room, ids, games } = setupRoom();
    expect(room.start(ids[0]!).ok).toBe(true);
    const update = games.get(ids[1]!);
    expect(update?.view.me).toBe(ids[1]);
    expect(update?.view.phase.type).toBe('initialPeek');
    // Ben sieht seine beiden unteren Karten, aber keine von Anna.
    const peeks = update!.events.filter((e) => e.type === 'cardPeeked' && e.card);
    expect(peeks).toHaveLength(2);
    expect(peeks.every((e) => e.type === 'cardPeeked' && e.target.playerId === ids[1])).toBe(true);
  });

  it('Anschauzeit endet automatisch', () => {
    const { room, ids } = setupRoom();
    room.start(ids[0]!);
    vi.advanceTimersByTime(room.settings.peekDuration * 1000);
    expect(room.game?.phase.type).toBe('turn');
  });

  it('Zeitlimit pro Zug löst automatisches Handeln aus', () => {
    const { room, ids } = setupRoom();
    room.start(ids[0]!);
    vi.advanceTimersByTime(3000);
    const first = currentPlayer(room.game!).id;
    vi.advanceTimersByTime(30_000);
    expect(room.game?.phase.type).toBe('snapWindow');
    vi.advanceTimersByTime(3000);
    expect(currentPlayer(room.game!).id).not.toBe(first);
  });

  it('Teilschritte verlängern das Zeitlimit nicht', () => {
    const { room, ids } = setupRoom();
    room.start(ids[0]!);
    vi.advanceTimersByTime(3000);
    const active = currentPlayer(room.game!).id;
    vi.advanceTimersByTime(20_000);
    room.act(active, { type: 'drawFromDeck' });
    vi.advanceTimersByTime(10_000);
    expect(room.game?.phase.type).toBe('snapWindow');
  });

  it('ohne Zeitlimit wartet das Spiel', () => {
    const { room, ids } = setupRoom();
    room.updateSettings(ids[0]!, { turnTimeLimit: null });
    room.start(ids[0]!);
    vi.advanceTimersByTime(3000);
    vi.advanceTimersByTime(10 * 60_000);
    expect(room.game?.phase.type).toBe('turn');
  });

  it('abwesende Spieler bekommen ein kurzes Zeitlimit', () => {
    const { room, ids } = setupRoom();
    room.updateSettings(ids[0]!, { turnTimeLimit: null });
    room.start(ids[0]!);
    vi.advanceTimersByTime(3000);
    room.setConnected(currentPlayer(room.game!).id, false);
    vi.advanceTimersByTime(ABSENT_PLAYER_TIMEOUT_MS);
    expect(room.game?.phase.type).toBe('snapWindow');
  });

  it('meldet verbleibende Zeit mit', () => {
    const { room, ids, games } = setupRoom();
    room.start(ids[0]!);
    vi.advanceTimersByTime(3000);
    expect(games.get(ids[0]!)?.timeLeftMs).toBe(30_000);
  });

  it('kein Beitritt während eines laufenden Spiels', () => {
    const { room, ids } = setupRoom();
    room.start(ids[0]!);
    expect(room.join('Cem')).toEqual({ ok: false, error: 'gameInProgress' });
  });

  it('nach Spielende zurück in die Lobby, ausgestiegene Spieler werden entfernt', () => {
    const { room, ids, games } = setupRoom(['A', 'B', 'C']);
    room.updateSettings(ids[0]!, { cambioFromLap: 1 });
    room.start(ids[0]!);
    room.leave(ids[2]!);
    vi.advanceTimersByTime(3000);
    room.act(currentPlayer(room.game!).id, { type: 'callCambio' });
    // Restliche Züge laufen per Zeitlimit ab.
    vi.advanceTimersByTime(5 * 60_000);
    expect(room.game?.phase.type).toBe('gameEnd');
    expect(room.backToLobby(room.hostId).ok).toBe(true);
    expect(room.members.map((m) => m.id)).toEqual(ids.slice(0, 2));
    expect(games.get(ids[0]!)).toBeNull();
  });
});
