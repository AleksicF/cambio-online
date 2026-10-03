import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../cards';
import { DEFAULT_SETTINGS, type GameSettings } from '../settings';
import { applyAction, applySystemAction, createGame, currentPlayer } from './engine';
import type { ActionResult, GameState, PlayerAction, SystemAction } from './types';
import { eventsFor, getPlayerView } from './view';

// ---------------------------------------------------------------------------
// Hilfsfunktionen

let nextId = 0;
const c = (rank: Rank, suit: Suit = 'spades'): Card => ({
  id: `${rank}-${suit}-${nextId++}`,
  kind: 'standard',
  rank,
  suit,
});
const joker = (): Card => ({ id: `joker-${nextId++}`, kind: 'joker' });
const rankOf = (card: Card | null | undefined) =>
  card?.kind === 'standard' ? card.rank : card?.kind;

const PLAYERS = [
  { id: 'a', name: 'Anna' },
  { id: 'b', name: 'Ben' },
  { id: 'c', name: 'Cem' },
];

const rng = () => 0;

function must(result: ActionResult): GameState {
  if (!result.ok) throw new Error(`Aktion fehlgeschlagen: ${result.error}`);
  return result.state;
}

const act = (s: GameState, playerId: string, action: PlayerAction) =>
  must(applyAction(s, playerId, action, rng));
const sys = (s: GameState, action: SystemAction) => must(applySystemAction(s, action, rng));

function errorOf(s: GameState, playerId: string, action: PlayerAction) {
  const r = applyAction(s, playerId, action, rng);
  return r.ok ? null : r.error;
}

interface Layout {
  hands?: Record<string, Card[]>;
  /** Letztes Element wird zuerst gezogen. */
  drawPile?: Card[];
  discardTop?: Card;
}

/** Spiel mit Spieler „a“ am Zug und frei festgelegten Karten. */
function setup(layout: Layout = {}, settings: Partial<GameSettings> = {}): GameState {
  const { state } = createGame(PLAYERS, { ...DEFAULT_SETTINGS, ...settings }, rng);
  const s = sys(state, { type: 'endInitialPeek' });
  for (const p of s.players) {
    p.slots = layout.hands?.[p.id] ?? [c('2'), c('2'), c('2'), c('2')];
  }
  s.drawPile = layout.drawPile ?? Array.from({ length: 30 }, () => c('3'));
  s.discardPile = [layout.discardTop ?? c('4')];
  return s;
}

/** Aktiver Spieler zieht eine Karte ohne Fähigkeit, legt sie ab, Fenster schließt. */
function passTurn(s: GameState): GameState {
  const id = currentPlayer(s).id;
  s = act(s, id, { type: 'drawFromDeck' });
  s = act(s, id, { type: 'discardDrawn' });
  if (s.phase.type === 'ability') s = act(s, id, { type: 'skipAbility' });
  return sys(s, { type: 'closeSnapWindow' });
}

function passTurns(s: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) s = passTurn(s);
  return s;
}

// ---------------------------------------------------------------------------

describe('Spielstart', () => {
  it('teilt 4 Karten pro Spieler aus und legt eine Karte auf die Ablage', () => {
    const { state } = createGame(PLAYERS, DEFAULT_SETTINGS, rng);
    expect(state.players.every((p) => p.slots.length === 4)).toBe(true);
    expect(state.discardPile).toHaveLength(1);
    expect(state.drawPile).toHaveLength(54 - 3 * 4 - 1);
    expect(state.phase.type).toBe('initialPeek');
  });

  it('zeigt jedem Spieler nur seine beiden unteren Karten', () => {
    const { state, events } = createGame(PLAYERS, DEFAULT_SETTINGS, rng);
    const forA = eventsFor(events, 'a').filter((e) => e.type === 'cardPeeked');
    const withCard = forA.filter((e) => e.type === 'cardPeeked' && e.card);
    expect(withCard).toEqual([
      {
        type: 'cardPeeked',
        viewerId: 'a',
        target: { playerId: 'a', slot: 2 },
        card: state.players[0]!.slots[2],
      },
      {
        type: 'cardPeeked',
        viewerId: 'a',
        target: { playerId: 'a', slot: 3 },
        card: state.players[0]!.slots[3],
      },
    ]);
    // Fremde Peeks sieht A nur ohne Karte.
    expect(
      forA
        .filter((e) => e.type === 'cardPeeked' && e.viewerId !== 'a')
        .every((e) => !('card' in e) || !e.card),
    ).toBe(true);
  });

  it('nach der Anschauzeit ist der Startspieler am Zug', () => {
    const { state } = createGame(PLAYERS, DEFAULT_SETTINGS, rng);
    const s = sys(state, { type: 'endInitialPeek' });
    expect(s.phase.type).toBe('turn');
    expect(currentPlayer(s).id).toBe('a');
  });

  it('lehnt zu wenige oder zu viele Spieler ab', () => {
    expect(() => createGame(PLAYERS.slice(0, 1), DEFAULT_SETTINGS)).toThrow();
    expect(() => createGame(PLAYERS, { ...DEFAULT_SETTINGS, maxPlayers: 2 })).toThrow();
  });
});

describe('Spielzug', () => {
  it('nur der aktive Spieler darf ziehen', () => {
    expect(errorOf(setup(), 'b', { type: 'drawFromDeck' })).toBe('notYourTurn');
  });

  it('gezogene Karte gegen eigene tauschen', () => {
    const drawn = c('5');
    const own = c('9');
    let s = setup({ drawPile: [drawn], hands: { a: [own, c('2'), c('2'), c('2')] } });
    s = act(s, 'a', { type: 'drawFromDeck' });
    s = act(s, 'a', { type: 'swapDrawn', slot: 0 });
    expect(s.players[0]!.slots[0]).toEqual(drawn);
    expect(s.discardPile.at(-1)).toEqual(own);
    expect(s.phase.type).toBe('snapWindow');
  });

  it('Karte ohne Fähigkeit ablegen öffnet direkt das Abwurf-Fenster', () => {
    let s = setup({ drawPile: [c('5')] });
    s = act(s, 'a', { type: 'drawFromDeck' });
    s = act(s, 'a', { type: 'discardDrawn' });
    expect(s.phase.type).toBe('snapWindow');
  });

  it('Ablagekarte nehmen muss getauscht werden', () => {
    const top = c('A');
    const own = c('9');
    let s = setup({ discardTop: top, hands: { a: [c('2'), own, c('2'), c('2')] } });
    s = act(s, 'a', { type: 'takeDiscard', slot: 1 });
    expect(s.players[0]!.slots[1]).toEqual(top);
    expect(s.discardPile.at(-1)).toEqual(own);
    expect(s.phase.type).toBe('snapWindow');
  });

  it('nach dem Abwurf-Fenster ist der nächste Spieler dran', () => {
    const s = passTurn(setup());
    expect(currentPlayer(s).id).toBe('b');
    expect(s.phase.type).toBe('turn');
  });

  it('gezogene Karte ist nur für den aktiven Spieler sichtbar', () => {
    const drawn = c('6');
    const s = act(setup({ drawPile: [drawn] }), 'a', { type: 'drawFromDeck' });
    expect(getPlayerView(s, 'a').phase).toEqual({ type: 'drawn', card: drawn });
    expect(getPlayerView(s, 'b').phase).toEqual({ type: 'drawn', card: null });
  });

  it('zählt Umläufe', () => {
    let s = setup();
    expect(s.lap).toBe(1);
    s = passTurns(s, 3);
    expect(s.lap).toBe(2);
    expect(currentPlayer(s).id).toBe('a');
  });

  it('mischt den Ablagestapel ein, wenn der Nachziehstapel leer ist', () => {
    let s = setup({ drawPile: [] });
    const top = c('K', 'hearts');
    s.discardPile = [c('5'), c('6'), top];
    const r = applyAction(s, 'a', { type: 'drawFromDeck' }, rng);
    s = must(r);
    expect(s.discardPile).toEqual([top]);
    expect(s.drawPile).toHaveLength(1);
    expect(r.ok && r.events.some((e) => e.event.type === 'deckReshuffled')).toBe(true);
  });
});

describe('Fähigkeiten', () => {
  const drawAndDiscard = (card: Card, layout: Layout = {}) => {
    let s = setup({ ...layout, drawPile: [card] });
    s = act(s, 'a', { type: 'drawFromDeck' });
    return act(s, 'a', { type: 'discardDrawn' });
  };

  it.each([
    ['7', 'peekOwn'],
    ['8', 'peekOwn'],
    ['9', 'peekOther'],
    ['10', 'peekOther'],
    ['J', 'blindSwap'],
    ['Q', 'blindSwap'],
  ] as const)('%s → %s', (rank, ability) => {
    expect(drawAndDiscard(c(rank)).phase).toEqual({ type: 'ability', ability });
  });

  it('schwarzer König hat eine Fähigkeit, roter König und Joker nicht', () => {
    expect(drawAndDiscard(c('K', 'clubs')).phase).toEqual({ type: 'ability', ability: 'king' });
    expect(drawAndDiscard(c('K', 'diamonds')).phase.type).toBe('snapWindow');
    expect(drawAndDiscard(joker()).phase.type).toBe('snapWindow');
  });

  it('keine Fähigkeit, wenn die Karte getauscht statt abgelegt wird', () => {
    let s = setup({ drawPile: [c('7')] });
    s = act(s, 'a', { type: 'drawFromDeck' });
    s = act(s, 'a', { type: 'swapDrawn', slot: 0 });
    expect(s.phase.type).toBe('snapWindow');
  });

  it('7/8: eigene Karte ansehen – Karte nur für den Spieler sichtbar', () => {
    const own = c('A');
    const s = drawAndDiscard(c('7'), { hands: { a: [own, c('2'), c('2'), c('2')] } });
    const r = applyAction(s, 'a', { type: 'peekOwn', slot: 0 }, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(eventsFor(r.events, 'a')).toContainEqual({
      type: 'cardPeeked',
      viewerId: 'a',
      target: { playerId: 'a', slot: 0 },
      card: own,
    });
    expect(eventsFor(r.events, 'b')).toContainEqual({
      type: 'cardPeeked',
      viewerId: 'a',
      target: { playerId: 'a', slot: 0 },
    });
    expect(r.state.phase.type).toBe('snapWindow');
  });

  it('9/10: nur fremde Karten ansehen', () => {
    const s = drawAndDiscard(c('9'));
    expect(errorOf(s, 'a', { type: 'peekOther', target: { playerId: 'a', slot: 0 } })).toBe(
      'samePlayer',
    );
    expect(act(s, 'a', { type: 'peekOther', target: { playerId: 'b', slot: 0 } }).phase.type).toBe(
      'snapWindow',
    );
  });

  it('Bube/Dame: blind tauschen, auch zwischen zwei Gegnern', () => {
    const bCard = c('A');
    const cCard = c('K', 'spades');
    const s = drawAndDiscard(c('J'), {
      hands: { b: [bCard, c('2'), c('2'), c('2')], c: [cCard, c('2'), c('2'), c('2')] },
    });
    const after = act(s, 'a', {
      type: 'blindSwap',
      a: { playerId: 'b', slot: 0 },
      b: { playerId: 'c', slot: 0 },
    });
    expect(after.players[1]!.slots[0]).toEqual(cCard);
    expect(after.players[2]!.slots[0]).toEqual(bCard);
  });

  it('Bube/Dame: nicht innerhalb derselben Auslage tauschen', () => {
    const s = drawAndDiscard(c('Q'));
    expect(
      errorOf(s, 'a', {
        type: 'blindSwap',
        a: { playerId: 'b', slot: 0 },
        b: { playerId: 'b', slot: 1 },
      }),
    ).toBe('samePlayer');
  });

  it('schwarzer König: ansehen, dann optional tauschen', () => {
    let s = drawAndDiscard(c('K', 'spades'));
    s = act(s, 'a', { type: 'kingPeek', target: { playerId: 'b', slot: 2 } });
    expect(s.phase).toEqual({ type: 'kingSwap', peeked: { playerId: 'b', slot: 2 } });
    const swapped = act(s, 'a', {
      type: 'kingSwap',
      a: { playerId: 'a', slot: 0 },
      b: { playerId: 'b', slot: 2 },
    });
    expect(swapped.phase.type).toBe('snapWindow');
    expect(act(s, 'a', { type: 'skipAbility' }).phase.type).toBe('snapWindow');
  });

  it('jede Fähigkeit darf ausgelassen werden', () => {
    const s = act(drawAndDiscard(c('10')), 'a', { type: 'skipAbility' });
    expect(s.phase.type).toBe('snapWindow');
  });
});

describe('Abwerfen', () => {
  /** A legt eine 5 ab, das Abwurf-Fenster ist offen. */
  const withFiveOnTop = (hands: Layout['hands']) => {
    let s = setup({ hands, drawPile: [c('3'), c('3'), c('3'), c('5', 'hearts')] });
    s = act(s, 'a', { type: 'drawFromDeck' });
    return act(s, 'a', { type: 'discardDrawn' });
  };

  it('eigene Karte richtig: Karte weg, Fenster zu, nächster Spieler', () => {
    const s = act(withFiveOnTop({ b: [c('2'), c('5'), c('2'), c('2')] }), 'b', {
      type: 'snap',
      target: { playerId: 'b', slot: 1 },
    });
    expect(s.players[1]!.slots[1]).toBeNull();
    expect(rankOf(s.discardPile.at(-1))).toBe('5');
    expect(currentPlayer(s).id).toBe('b');
    expect(s.phase.type).toBe('turn');
  });

  it('auch der aktive Spieler darf abwerfen', () => {
    const s = act(withFiveOnTop({ a: [c('5'), c('2'), c('2'), c('2')] }), 'a', {
      type: 'snap',
      target: { playerId: 'a', slot: 0 },
    });
    expect(s.players[0]!.slots[0]).toBeNull();
  });

  it('fremde Karte richtig: Abwerfer gibt eine eigene Karte ab', () => {
    const gift = c('K', 'spades');
    let s = withFiveOnTop({
      b: [gift, c('2'), c('2'), c('2')],
      c: [c('2'), c('2'), c('5'), c('2')],
    });
    s = act(s, 'b', { type: 'snap', target: { playerId: 'c', slot: 2 } });
    expect(s.phase).toEqual({
      type: 'snapGive',
      snapperId: 'b',
      target: { playerId: 'c', slot: 2 },
    });
    expect(errorOf(s, 'c', { type: 'giveCard', slot: 0 })).toBe('notYourTurn');
    s = act(s, 'b', { type: 'giveCard', slot: 0 });
    expect(s.players[2]!.slots[2]).toEqual(gift);
    expect(s.players[1]!.slots[0]).toBeNull();
    expect(currentPlayer(s).id).toBe('b');
  });

  it('roter und schwarzer König passen zusammen', () => {
    let s = setup({
      drawPile: [c('K', 'hearts')],
      hands: { b: [c('K', 'clubs'), c('2'), c('2'), c('2')] },
    });
    s = act(s, 'a', { type: 'drawFromDeck' });
    s = act(s, 'a', { type: 'discardDrawn' });
    s = act(s, 'b', { type: 'snap', target: { playerId: 'b', slot: 0 } });
    expect(s.players[1]!.slots[0]).toBeNull();
  });

  it('Fehler kosten steigend viele Strafkarten, Fenster bleibt offen', () => {
    let s = withFiveOnTop({ b: [c('6'), c('7'), c('2'), c('2')] });
    s = act(s, 'b', { type: 'snap', target: { playerId: 'b', slot: 0 } });
    expect(s.players[1]!.slots).toHaveLength(5);
    expect(s.players[1]!.slots[0]).not.toBeNull();
    expect(s.phase.type).toBe('snapWindow');
    s = act(s, 'b', { type: 'snap', target: { playerId: 'b', slot: 1 } });
    expect(s.players[1]!.slots).toHaveLength(7);
    expect(s.players[1]!.errorCount).toBe(2);
  });

  it('Fehlerzähler wird in der nächsten Partie zurückgesetzt', () => {
    let s = withFiveOnTop({ b: [c('6'), c('2'), c('2'), c('2')] });
    s = act(s, 'b', { type: 'snap', target: { playerId: 'b', slot: 0 } });
    s.phase = { type: 'partieEnd', result: undefined as never };
    s = sys(s, { type: 'startNextPartie' });
    expect(s.players[1]!.errorCount).toBe(0);
  });

  it('außerhalb des Fensters nicht möglich', () => {
    expect(errorOf(setup(), 'b', { type: 'snap', target: { playerId: 'b', slot: 0 } })).toBe(
      'wrongPhase',
    );
  });
});

describe('Cambio', () => {
  it('frühestens im 3. Umlauf', () => {
    let s = setup();
    expect(errorOf(s, 'a', { type: 'callCambio' })).toBe('cambioTooEarly');
    s = passTurns(s, 3);
    expect(errorOf(s, 'a', { type: 'callCambio' })).toBe('cambioTooEarly');
    s = passTurns(s, 3);
    expect(s.lap).toBe(3);
    expect(act(s, 'a', { type: 'callCambio' }).cambioCallerId).toBe('a');
  });

  it('Umlauf-Grenze ist einstellbar', () => {
    const s = setup({}, { cambioFromLap: 1 });
    expect(act(s, 'a', { type: 'callCambio' }).cambioCallerId).toBe('a');
  });

  it('jeder andere hat noch genau einen Zug, dann endet die Partie', () => {
    let s = setup({}, { cambioFromLap: 1 });
    s = act(s, 'a', { type: 'callCambio' });
    expect(currentPlayer(s).id).toBe('b');
    s = passTurn(s);
    expect(currentPlayer(s).id).toBe('c');
    s = passTurn(s);
    expect(s.phase.type).toBe('gameEnd');
  });

  it('Karten des Rufers sind gesperrt, Rufer darf nicht abwerfen', () => {
    let s = setup(
      { hands: { a: [c('3'), c('2'), c('2'), c('2')] }, drawPile: [c('3'), c('9')] },
      { cambioFromLap: 1 },
    );
    s = act(s, 'a', { type: 'callCambio' });
    s = act(s, 'b', { type: 'drawFromDeck' });
    s = act(s, 'b', { type: 'discardDrawn' });
    expect(errorOf(s, 'b', { type: 'peekOther', target: { playerId: 'a', slot: 0 } })).toBe(
      'lockedCard',
    );
    s = act(s, 'b', { type: 'skipAbility' });
    expect(errorOf(s, 'b', { type: 'snap', target: { playerId: 'a', slot: 0 } })).toBe(
      'lockedCard',
    );
    expect(errorOf(s, 'a', { type: 'snap', target: { playerId: 'b', slot: 0 } })).toBe(
      'callerCannotAct',
    );
  });

  it('ohne Karten muss man Cambio rufen – auch vor dem 3. Umlauf', () => {
    const s = setup({ hands: { a: [null as never, null as never] } });
    expect(errorOf(s, 'a', { type: 'drawFromDeck' })).toBe('mustCallCambio');
    expect(getPlayerView(s, 'a').mustCallCambio).toBe(true);
    expect(act(s, 'a', { type: 'callCambio' }).cambioCallerId).toBe('a');
  });

  it('nach dem Ruf setzt ein Spieler ohne Karten seinen letzten Zug aus', () => {
    let s = setup({ hands: { b: [] } }, { cambioFromLap: 1 });
    s = act(s, 'a', { type: 'callCambio' });
    expect(currentPlayer(s).id).toBe('c');
  });
});

describe('Wertung', () => {
  /** A ruft sofort Cambio, B und C passen. */
  const playOut = (hands: Layout['hands'], settings: Partial<GameSettings> = {}) => {
    let s = setup({ hands }, { cambioFromLap: 1, ...settings });
    s = act(s, 'a', { type: 'callCambio' });
    return passTurns(s, 2);
  };

  it('Einzelspiel: Rufer gewinnt mit alleiniger niedrigster Summe', () => {
    const s = playOut({
      a: [c('A'), c('K', 'hearts')],
      b: [c('5'), c('5')],
      c: [c('9'), c('J')],
    });
    expect(s.phase.type).toBe('gameEnd');
    if (s.phase.type !== 'gameEnd') return;
    expect(s.phase.result.sums).toEqual({ a: 0, b: 10, c: 19 });
    expect(s.phase.winners).toEqual(['a']);
  });

  it('Einzelspiel: bei Gleichstand verliert der Rufer', () => {
    const s = playOut({ a: [c('4')], b: [c('4')], c: [c('4')] });
    if (s.phase.type !== 'gameEnd') throw new Error();
    expect(s.phase.result.callerFailed).toBe(true);
    expect(s.phase.winners).toEqual(['b', 'c']);
  });

  it('Punktemodus: Gleichstand ohne Strafe', () => {
    const s = playOut({ a: [c('4')], b: [c('4')], c: [c('9')] }, { mode: 'points' });
    if (s.phase.type !== 'partieEnd') throw new Error();
    expect(s.phase.result.callerFailed).toBe(false);
    expect(s.phase.result.points).toEqual({ a: 4, b: 4, c: 9 });
  });

  it('Punktemodus: Rufer bekommt Strafpunkte, wenn jemand weniger hat', () => {
    const s = playOut({ a: [c('6')], b: [c('3')], c: [c('9')] }, { mode: 'points' });
    if (s.phase.type !== 'partieEnd') throw new Error();
    expect(s.phase.result.points).toEqual({ a: 16, b: 3, c: 9 });
    expect(s.players.map((p) => p.totalScore)).toEqual([16, 3, 9]);
  });

  it('Punktemodus: Spielende nach Anzahl Partien', () => {
    const settings = { mode: 'points', endCondition: 'rounds', roundCount: 2 } as const;
    let s = playOut({ a: [c('A')], b: [c('2')], c: [c('3')] }, settings);
    expect(s.phase.type).toBe('partieEnd');
    s = sys(s, { type: 'startNextPartie' });
    expect(s.partieNumber).toBe(2);
    // Startspieler rotiert: jetzt B.
    expect(currentPlayer(s).id).toBe('b');
    s = sys(s, { type: 'endInitialPeek' });
    for (const p of s.players) p.slots = [c('2')];
    s = act(s, 'b', { type: 'callCambio' });
    s = passTurns(s, 2);
    expect(s.phase.type).toBe('gameEnd');
    if (s.phase.type !== 'gameEnd') return;
    // a: 1 + 2 = 3, b: 2 + 2 = 4, c: 3 + 2 = 5 (Gleichstand → B ohne Strafe)
    expect(s.phase.winners).toEqual(['a']);
  });

  it('Punktemodus: Spielende bei Punktegrenze', () => {
    const s = playOut(
      { a: [c('A')], b: [c('K', 'spades'), c('K', 'clubs')], c: [c('3')] },
      { mode: 'points', endCondition: 'pointLimit', pointLimit: 50 },
    );
    expect(s.phase.type).toBe('gameEnd');
  });

  it('nach Partie-Ende sind alle Karten sichtbar', () => {
    const s = playOut({ a: [c('A')], b: [c('2')], c: [c('3')] });
    expect(getPlayerView(s, 'a').players[1]!.slots[0]!.card).not.toBeNull();
  });
});

describe('Zeitlimit', () => {
  it('ohne Zug: automatisch ziehen und ohne Fähigkeit ablegen', () => {
    const s = sys(setup({ drawPile: [c('7')] }), { type: 'timeout' });
    expect(s.phase.type).toBe('snapWindow');
    expect(rankOf(s.discardPile.at(-1))).toBe('7');
  });

  it('offene Fähigkeit verfällt', () => {
    let s = setup({ drawPile: [c('J')] });
    s = act(s, 'a', { type: 'drawFromDeck' });
    s = act(s, 'a', { type: 'discardDrawn' });
    expect(sys(s, { type: 'timeout' }).phase.type).toBe('snapWindow');
  });

  it('Abgeben nach fremdem Abwurf passiert automatisch', () => {
    let s = setup({
      drawPile: [c('5')],
      hands: { b: [null as never, c('9'), c('2')], c: [c('5'), c('2')] },
    });
    s = act(s, 'a', { type: 'drawFromDeck' });
    s = act(s, 'a', { type: 'discardDrawn' });
    s = act(s, 'b', { type: 'snap', target: { playerId: 'c', slot: 0 } });
    s = sys(s, { type: 'timeout' });
    expect(rankOf(s.players[2]!.slots[0])).toBe('9');
    expect(s.phase.type).toBe('turn');
  });
});

describe('Spielersicht', () => {
  it('enthält keine verdeckten Karten', () => {
    const s = setup();
    const view = getPlayerView(s, 'a');
    expect(view.players.flatMap((p) => p.slots).every((slot) => slot?.card === null)).toBe(true);
    expect(JSON.stringify(view)).not.toContain('"rank":"2"');
  });
});
