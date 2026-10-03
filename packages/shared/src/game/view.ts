import type { Card } from '../cards';
import type { GameSettings } from '../settings';
import { canCallCambio, currentPlayer, mustCallCambio } from './engine';
import type { Ability, AudiencedEvent, GameEvent, GameState, PartieResult, SlotRef } from './types';

/**
 * Sicht eines einzelnen Spielers auf das Spiel. Enthält nur, was dieser
 * Spieler laut Regeln sehen darf – verdeckte Karten sind nicht enthalten.
 */
export interface PlayerView {
  me: string;
  settings: GameSettings;
  players: PlayerViewPlayer[];
  drawPileCount: number;
  discardTop: Card | null;
  discardCount: number;
  phase: PhaseView;
  currentPlayerId: string;
  lap: number;
  partieNumber: number;
  cambioCallerId: string | null;
  canCallCambio: boolean;
  mustCallCambio: boolean;
  results: PartieResult[];
}

export interface PlayerViewPlayer {
  id: string;
  name: string;
  /** `null` = leerer Platz. `card` ist nur nach Partie-Ende gesetzt. */
  slots: ({ card: Card | null } | null)[];
  errorCount: number;
  totalScore: number;
}

export type PhaseView =
  | { type: 'initialPeek' }
  | { type: 'turn' }
  /** `card` nur für den aktiven Spieler. */
  | { type: 'drawn'; card: Card | null }
  | { type: 'ability'; ability: Ability }
  | { type: 'kingSwap'; peeked: SlotRef }
  | { type: 'snapWindow' }
  | { type: 'snapGive'; snapperId: string; target: SlotRef }
  | { type: 'partieEnd'; result: PartieResult }
  | { type: 'gameEnd'; result: PartieResult; winners: string[] };

export function getPlayerView(s: GameState, playerId: string): PlayerView {
  const me = s.players.find((p) => p.id === playerId);
  const revealAll = s.phase.type === 'partieEnd' || s.phase.type === 'gameEnd';
  const active = currentPlayer(s);

  let phase: PhaseView = s.phase;
  if (s.phase.type === 'drawn' && active.id !== playerId) {
    phase = { type: 'drawn', card: null };
  }

  return {
    me: playerId,
    settings: s.settings,
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      slots: p.slots.map((card) => (card ? { card: revealAll ? card : null } : null)),
      errorCount: p.errorCount,
      totalScore: p.totalScore,
    })),
    drawPileCount: s.drawPile.length,
    discardTop: s.discardPile[s.discardPile.length - 1] ?? null,
    discardCount: s.discardPile.length,
    phase,
    currentPlayerId: active.id,
    lap: s.lap,
    partieNumber: s.partieNumber,
    cambioCallerId: s.cambioCallerId,
    canCallCambio: me ? canCallCambio(s, me) : false,
    mustCallCambio: me ? active.id === playerId && mustCallCambio(s, me) : false,
    results: s.results,
  };
}

/** Filtert Ereignisse auf die, die ein Spieler sehen darf. */
export function eventsFor(events: AudiencedEvent[], playerId: string): GameEvent[] {
  return events
    .filter(({ audience: a }) =>
      a.to === 'all' ? true : a.to === 'only' ? a.playerId === playerId : a.playerId !== playerId,
    )
    .map((e) => e.event);
}
