import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameUpdate, RoomView } from '@cambio/shared';
import { Room, type RoomTransport } from './Room';

function setup() {
  const rooms = new Map<string, RoomView>();
  const games = new Map<string, GameUpdate | null>();
  const transport: RoomTransport = {
    sendRoom: (id, room) => rooms.set(id, room),
    sendGame: (id, update) => games.set(id, update),
    sendKicked: () => {},
  };
  // Fester Zufall: Spiele sind reproduzierbar.
  let seed = 1;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const room = new Room('ABCD', transport, random);
  const host = room.join('Anna');
  if (!host.ok) throw new Error();
  return { room, hostId: host.member.id, rooms, games };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Bots in der Lobby', () => {
  it('Host fügt Bots hinzu, sie erscheinen als Spieler mit Schwierigkeit', () => {
    const { room, hostId, rooms } = setup();
    expect(room.addBot(hostId, 'easy').ok).toBe(true);
    expect(room.addBot(hostId, 'hard').ok).toBe(true);
    const players = rooms.get(hostId)!.players;
    expect(players.map((p) => [p.name, p.bot])).toEqual([
      ['Anna', null],
      ['Ada', 'easy'],
      ['Bruno', 'hard'],
    ]);
  });

  it('nur der Host darf Bots verwalten', () => {
    const { room, hostId } = setup();
    const guest = room.join('Ben');
    if (!guest.ok) throw new Error();
    expect(room.addBot(guest.member.id, 'easy')).toEqual({ ok: false, error: 'notHost' });
    const bot = room.addBot(hostId, 'easy');
    if (!bot.ok) throw new Error();
    expect(room.setBotDifficulty(guest.member.id, bot.member.id, 'hard').ok).toBe(false);
    expect(room.setBotDifficulty(hostId, bot.member.id, 'hard').ok).toBe(true);
    expect(room.members.find((m) => m.id === bot.member.id)?.bot).toBe('hard');
  });

  it('Bots zählen zur maximalen Spielerzahl und lassen sich entfernen', () => {
    const { room, hostId } = setup();
    room.updateSettings(hostId, { maxPlayers: 2 });
    const bot = room.addBot(hostId, 'medium');
    if (!bot.ok) throw new Error();
    expect(room.addBot(hostId, 'medium')).toEqual({ ok: false, error: 'roomFull' });
    expect(room.kick(hostId, bot.member.id).ok).toBe(true);
    expect(room.members).toHaveLength(1);
  });

  it('ein Bot wird nie Host, ein Raum nur mit Bots gilt als leer', () => {
    const { room, hostId } = setup();
    room.addBot(hostId, 'easy');
    room.setConnected(hostId, false);
    expect(room.effectiveHostId()).toBe(hostId);
    room.leave(hostId);
    expect(room.hasHumans()).toBe(false);
  });
});

describe('Einzelspieler gegen Bots', () => {
  it.each(['easy', 'medium', 'hard'] as const)(
    'Partie gegen zwei %s-Bots läuft bis zum Ende durch',
    (difficulty) => {
      const { room, hostId, games } = setup();
      room.addBot(hostId, difficulty);
      room.addBot(hostId, difficulty);
      // Der Mensch spielt nicht selbst – sein Zug läuft jeweils per Zeitlimit ab.
      room.updateSettings(hostId, { turnTimeLimit: 15, cambioFromLap: 2 });
      expect(room.start(hostId).ok).toBe(true);

      for (let i = 0; i < 60 * 60 && room.game?.phase.type !== 'gameEnd'; i++) {
        vi.advanceTimersByTime(1000);
      }
      expect(room.game?.phase.type).toBe('gameEnd');
      // Der Mensch hat die ganze Zeit Updates bekommen.
      expect(games.get(hostId)?.view.phase.type).toBe('gameEnd');
    },
  );

  it('bei „bis zur nächsten Karte“ lässt der Bot Zeit zum Abwerfen', () => {
    const { room, hostId } = setup();
    room.addBot(hostId, 'hard');
    room.updateSettings(hostId, { turnTimeLimit: null, snapWindowMode: 'untilNextCard' });
    room.start(hostId);
    vi.advanceTimersByTime(room.settings.peekDuration * 1000);
    const humanToMove = () =>
      room.game!.players[room.game!.currentPlayerIndex]!.id === hostId &&
      room.game!.phase.type === 'turn';
    for (let i = 0; i < 100 && !humanToMove(); i++) vi.advanceTimersByTime(100);
    expect(humanToMove()).toBe(true);

    room.act(hostId, { type: 'drawFromDeck' });
    room.act(hostId, { type: 'discardDrawn' });
    if (room.game!.phase.type === 'ability') room.act(hostId, { type: 'skipAbility' });
    expect(room.game!.snapOpen).toBe(true);

    // Der Bot ist jetzt dran; seine neue Karte darf frühestens nach Abwurf-Zeit + Animation kommen.
    let elapsed = 0;
    while (!humanToMove() && elapsed < 20_000) {
      vi.advanceTimersByTime(100);
      elapsed += 100;
    }
    expect(elapsed).toBeGreaterThanOrEqual(room.settings.snapWindow * 1000 + 800);
  });

  it('Bots handeln mit Bedenkzeit, nicht sofort', () => {
    const { room, hostId } = setup();
    const bot = room.addBot(hostId, 'hard');
    if (!bot.ok) throw new Error();
    room.updateSettings(hostId, { turnTimeLimit: null });
    room.start(hostId);
    vi.advanceTimersByTime(room.settings.peekDuration * 1000);
    // Den Bot an den Zug bringen, falls der Mensch beginnt.
    if (room.game!.players[room.game!.currentPlayerIndex]!.id === hostId) {
      room.act(hostId, { type: 'drawFromDeck' });
      room.act(hostId, { type: 'discardDrawn' });
      if (room.game!.phase.type === 'ability') room.act(hostId, { type: 'skipAbility' });
      vi.advanceTimersByTime(room.settings.snapWindow * 1000);
    }
    const before = JSON.stringify(room.game);
    vi.advanceTimersByTime(100);
    expect(JSON.stringify(room.game)).toBe(before);
    vi.advanceTimersByTime(5000);
    expect(JSON.stringify(room.game)).not.toBe(before);
  });
});
