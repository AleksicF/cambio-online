import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../cards';
import { DEFAULT_SETTINGS, type GameSettings } from '../settings';
import { applyAction, applySystemAction, createGame } from '../game/engine';
import type { AudiencedEvent, GameState, PlayerAction, SystemAction } from '../game/types';
import { eventsFor, getPlayerView } from '../game/view';
import { BotBrain } from './brain';
import { BOT_PROFILES, type BotDifficulty } from './profiles';

/** Deterministischer Zufall für reproduzierbare Tests. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let n = 0;
const c = (rank: Rank, suit: Suit = 'spades'): Card => ({
  id: `${rank}-${suit}-${n++}`,
  kind: 'standard',
  rank,
  suit,
});

/** Zufall immer 0: Jede Wahrscheinlichkeit > 0 wird zu „ja“. */
const always = () => 0;

const peekAll = (playerId: string, cards: (Card | null)[]) =>
  cards.map((card, slot) => ({
    type: 'cardPeeked' as const,
    viewerId: playerId,
    target: { playerId, slot },
    card: card!,
  }));

describe('Gedächtnis', () => {
  it('merkt sich die beiden unteren Karten zu Beginn', () => {
    const { state, events } = createGame(
      [
        { id: 'bot', name: 'Bot' },
        { id: 'x', name: 'X' },
      ],
      DEFAULT_SETTINGS,
      always,
    );
    const brain = new BotBrain('bot', BOT_PROFILES.hard, always);
    brain.observe(eventsFor(events, 'bot'));
    expect(brain.knownCard({ playerId: 'bot', slot: 2 })).toEqual(state.players[0]!.slots[2]);
    expect(brain.knownCard({ playerId: 'bot', slot: 0 })).toBeUndefined();
    expect(brain.knownCard({ playerId: 'x', slot: 2 })).toBeUndefined();
  });

  it('merkt sich Karten nur mit der Merk-Wahrscheinlichkeit', () => {
    const card = c('5');
    const forgetful = new BotBrain('bot', { ...BOT_PROFILES.easy, memory: 0.6 }, () => 0.9);
    forgetful.observe([
      { type: 'cardPeeked', viewerId: 'bot', target: { playerId: 'bot', slot: 0 }, card },
    ]);
    expect(forgetful.knownCard({ playerId: 'bot', slot: 0 })).toBeUndefined();
  });

  it('verfolgt fremde Tauschaktionen nur mit trackSwaps', () => {
    const card = c('A');
    const events = () => [
      {
        type: 'cardPeeked' as const,
        viewerId: 'bot',
        target: { playerId: 'x', slot: 1 },
        card,
      },
      {
        type: 'cardsSwapped' as const,
        playerId: 'x',
        a: { playerId: 'x', slot: 1 },
        b: { playerId: 'y', slot: 0 },
      },
    ];
    const tracker = new BotBrain('bot', BOT_PROFILES.hard, always);
    tracker.observe(events());
    expect(tracker.knownCard({ playerId: 'y', slot: 0 })).toEqual(card);
    const easy = new BotBrain('bot', { ...BOT_PROFILES.easy, memory: 1 }, always);
    easy.observe(events());
    expect(easy.knownCard({ playerId: 'y', slot: 0 })).toBeUndefined();
  });
});

describe('Entscheidungen', () => {
  function stateWith(hand: Card[], settings: Partial<GameSettings> = {}) {
    const { state } = createGame(
      [
        { id: 'bot', name: 'Bot' },
        { id: 'x', name: 'X' },
      ],
      { ...DEFAULT_SETTINGS, ...settings },
      always,
    );
    const r = applySystemAction(state, { type: 'endInitialPeek' }, always);
    if (!r.ok) throw new Error(r.error);
    r.state.players[0]!.slots = hand;
    return r.state;
  }

  it('tauscht eine gezogene niedrige Karte gegen die schlechteste bekannte', () => {
    let s = stateWith([c('2'), c('K'), c('3'), c('4')]);
    s.drawPile.push(c('A'));
    const brain = new BotBrain('bot', BOT_PROFILES.hard, always);
    brain.observe(peekAll('bot', s.players[0]!.slots));
    const r = applyAction(s, 'bot', { type: 'drawFromDeck' });
    if (!r.ok) throw new Error(r.error);
    s = r.state;
    brain.observe(eventsFor(r.events, 'bot'));
    expect(brain.decideTurn(getPlayerView(s, 'bot'))).toEqual({ type: 'swapDrawn', slot: 1 });
  });

  it('wirft eine bekannte passende eigene Karte ab – einmal pro Ablagekarte', () => {
    const s = stateWith([c('9'), c('2'), c('3'), c('4')]);
    s.discardPile.push(c('9', 'hearts'));
    s.phase = { type: 'snapWindow' };
    const brain = new BotBrain('bot', BOT_PROFILES.hard, always);
    brain.observe(peekAll('bot', s.players[0]!.slots));
    const snap = brain.decideSnap(getPlayerView(s, 'bot'));
    expect(snap?.target).toEqual({ playerId: 'bot', slot: 0 });
    expect(brain.decideSnap(getPlayerView(s, 'bot'))).toBeNull();
  });

  it('ruft Cambio mit niedriger bekannter Summe', () => {
    const s = stateWith([c('A'), c('2'), c('A', 'hearts'), c('K', 'hearts')], {
      cambioFromLap: 1,
    });
    const brain = new BotBrain('bot', BOT_PROFILES.hard, always);
    brain.observe(peekAll('bot', s.players[0]!.slots));
    expect(brain.decideTurn(getPlayerView(s, 'bot'))).toEqual({ type: 'callCambio' });
  });

  it('wird nicht aktiv, wenn ein anderer am Zug ist', () => {
    const s = stateWith([c('A'), c('2'), c('3'), c('4')]);
    s.currentPlayerIndex = 1;
    const brain = new BotBrain('bot', BOT_PROFILES.hard, always);
    expect(brain.decideTurn(getPlayerView(s, 'bot'))).toBeNull();
  });
});

/** Spielt eine komplette Partie nur mit Bots – ohne Timer, Schritt für Schritt. */
function simulate(
  difficulties: BotDifficulty[],
  seed: number,
  settings: Partial<GameSettings> = {},
): GameState {
  const random = seeded(seed);
  const players = difficulties.map((_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const brains = difficulties.map((d, i) => new BotBrain(`p${i}`, BOT_PROFILES[d], random));
  const created = createGame(players, { ...DEFAULT_SETTINGS, ...settings }, random);
  let state = created.state;
  const feed = (events: AudiencedEvent[]) =>
    brains.forEach((b) => b.observe(eventsFor(events, b.playerId)));
  const applyPlayer = (playerId: string, action: PlayerAction) => {
    const r = applyAction(state, playerId, action, random);
    if (!r.ok) throw new Error(`${playerId} ${action.type}: ${r.error}`);
    state = r.state;
    feed(r.events);
  };
  const applySystem = (action: SystemAction) => {
    const r = applySystemAction(state, action, random);
    if (!r.ok) throw new Error(`${action.type}: ${r.error}`);
    state = r.state;
    feed(r.events);
  };

  feed(created.events);
  applySystem({ type: 'endInitialPeek' });
  for (let step = 0; step < 3000; step++) {
    if (state.phase.type === 'partieEnd' || state.phase.type === 'gameEnd') return state;
    for (const b of brains) {
      const snap = b.decideSnap(getPlayerView(state, b.playerId));
      if (snap) applyPlayer(b.playerId, { type: 'snap', target: snap.target });
    }
    const actor = brains.find((b) => b.needsToAct(getPlayerView(state, b.playerId)));
    if (actor) {
      const action = actor.decideTurn(getPlayerView(state, actor.playerId));
      if (!action) throw new Error('Bot ist am Zug, entscheidet aber nichts');
      applyPlayer(actor.playerId, action);
    } else if (state.phase.type === 'snapWindow') {
      applySystem({ type: 'closeSnapWindow' });
    }
  }
  throw new Error('Partie endet nicht');
}

const finalSums = (s: GameState): Record<string, number> =>
  s.phase.type === 'gameEnd' || s.phase.type === 'partieEnd' ? s.phase.result.sums : {};

describe('Simulation', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('Bot-Partie %i endet regulär ohne ungültige Züge', (seed) => {
    expect(simulate(['easy', 'medium', 'hard', 'hard'], seed).phase.type).toBe('gameEnd');
  });

  it('funktioniert auch mit Abwerfen bis zur nächsten Karte', () => {
    for (let seed = 10; seed < 16; seed++) {
      const s = simulate(['easy', 'hard'], seed, { snapWindowMode: 'untilNextCard' });
      expect(s.phase.type).toBe('gameEnd');
    }
  });

  it('schwere Bots haben im Schnitt weniger Punkte als einfache', () => {
    let easy = 0;
    let hard = 0;
    for (let seed = 100; seed < 160; seed++) {
      const sums = finalSums(simulate(['easy', 'hard'], seed));
      easy += sums.p0!;
      hard += sums.p1!;
    }
    expect(hard).toBeLessThan(easy);
  });
});
