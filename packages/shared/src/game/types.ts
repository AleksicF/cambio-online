import type { Card } from '../cards';
import type { GameSettings } from '../settings';

/** Verweis auf einen Kartenplatz in der Auslage eines Spielers. */
export interface SlotRef {
  playerId: string;
  slot: number;
}

export interface PlayerState {
  id: string;
  name: string;
  /** Feste Plätze; `null` = Karte wurde abgeworfen bzw. weggegeben. */
  slots: (Card | null)[];
  /** Fehlerzähler beim Abwerfen, wird jede Partie zurückgesetzt (RULES §6). */
  errorCount: number;
  /** Summe aller bisherigen Partien (Punktemodus). */
  totalScore: number;
}

/** Fähigkeit einer direkt abgelegten Aktionskarte (RULES §5). */
export type Ability = 'peekOwn' | 'peekOther' | 'blindSwap' | 'king';

export interface PartieResult {
  partieNumber: number;
  callerId: string;
  /** Kartensumme jedes Spielers. */
  sums: Record<string, number>;
  /** Punkte dieser Partie inkl. Strafpunkte (Punktemodus); im Einzelspiel = Summen. */
  points: Record<string, number>;
  /** Einzelspiel: Rufer hat verloren. Punktemodus: Rufer bekommt Strafpunkte. */
  callerFailed: boolean;
  winners: string[];
}

export type Phase =
  /** Alle sehen kurz ihre unteren beiden Karten. */
  | { type: 'initialPeek' }
  /** Aktiver Spieler muss ziehen, Ablage nehmen oder Cambio rufen. */
  | { type: 'turn' }
  /** Aktiver Spieler hält eine Karte vom Nachziehstapel. */
  | { type: 'drawn'; card: Card }
  /** Fähigkeit der abgelegten Karte kann genutzt werden. */
  | { type: 'ability'; ability: Ability }
  /** Schwarzer König: Karte wurde angesehen, jetzt optional tauschen. */
  | { type: 'kingSwap'; peeked: SlotRef }
  /** Abwurf-Fenster ist offen. */
  | { type: 'snapWindow' }
  /**
   * Fremde Karte richtig abgeworfen: Abwerfer muss eine eigene Karte abgeben.
   * `resume`: unterbrochene Zugphase (Abwerfen bis zur nächsten Karte), sonst `null`.
   */
  | { type: 'snapGive'; snapperId: string; target: SlotRef; resume: Phase | null }
  | { type: 'partieEnd'; result: PartieResult }
  | { type: 'gameEnd'; result: PartieResult; winners: string[] };

export interface GameState {
  settings: GameSettings;
  players: PlayerState[];
  /** Letztes Element = oberste Karte. */
  drawPile: Card[];
  /** Letztes Element = oberste Karte. */
  discardPile: Card[];
  phase: Phase;
  currentPlayerIndex: number;
  startingPlayerIndex: number;
  /** Umlauf, beginnt bei 1. */
  lap: number;
  /** Partie, beginnt bei 1. */
  partieNumber: number;
  cambioCallerId: string | null;
  /** Abwerfen auf die oberste Ablagekarte ist noch erlaubt (Modus „bis zur nächsten Karte“). */
  snapOpen: boolean;
  /** Verbleibende Züge nach dem Cambio-Ruf. */
  finalTurnsLeft: number;
  results: PartieResult[];
}

export type PlayerAction =
  | { type: 'drawFromDeck' }
  | { type: 'takeDiscard'; slot: number }
  | { type: 'swapDrawn'; slot: number }
  | { type: 'discardDrawn' }
  | { type: 'callCambio' }
  | { type: 'peekOwn'; slot: number }
  | { type: 'peekOther'; target: SlotRef }
  | { type: 'blindSwap'; a: SlotRef; b: SlotRef }
  | { type: 'kingPeek'; target: SlotRef }
  | { type: 'kingSwap'; a: SlotRef; b: SlotRef }
  | { type: 'skipAbility' }
  | { type: 'snap'; target: SlotRef }
  | { type: 'giveCard'; slot: number };

/** Aktionen, die nur der Server auslöst (Timer, Host-Steuerung). */
export type SystemAction =
  | { type: 'endInitialPeek' }
  | { type: 'closeSnapWindow' }
  | { type: 'timeout' }
  | { type: 'startNextPartie' };

export type GameEvent =
  | { type: 'partieStarted'; partieNumber: number; startingPlayerId: string }
  | { type: 'cardPeeked'; viewerId: string; target: SlotRef; card?: Card }
  | { type: 'drewFromDeck'; playerId: string; card?: Card }
  | { type: 'tookDiscard'; playerId: string; slot: number; card: Card; discarded: Card }
  | { type: 'swappedDrawn'; playerId: string; slot: number; discarded: Card }
  | { type: 'discardedDrawn'; playerId: string; card: Card }
  | { type: 'abilitySkipped'; playerId: string }
  | { type: 'cardsSwapped'; playerId: string; a: SlotRef; b: SlotRef }
  | { type: 'snapSucceeded'; snapperId: string; target: SlotRef; card: Card }
  | { type: 'snapFailed'; snapperId: string; target: SlotRef; card: Card; penaltyCards: number }
  | { type: 'cardGiven'; from: SlotRef; to: SlotRef }
  | { type: 'snapWindowClosed' }
  | { type: 'turnStarted'; playerId: string; lap: number }
  | { type: 'cambioCalled'; playerId: string }
  | { type: 'deckReshuffled' }
  | { type: 'partieEnded'; result: PartieResult }
  | { type: 'gameEnded'; winners: string[] };

/** Wer ein Ereignis sehen darf. */
export type Audience =
  { to: 'all' } | { to: 'only'; playerId: string } | { to: 'except'; playerId: string };

export interface AudiencedEvent {
  audience: Audience;
  event: GameEvent;
}

export type ActionResult =
  { ok: true; state: GameState; events: AudiencedEvent[] } | { ok: false; error: GameError };

export type GameError =
  | 'wrongPhase'
  | 'notYourTurn'
  | 'invalidSlot'
  | 'emptySlot'
  | 'lockedCard'
  | 'samePlayer'
  | 'cambioTooEarly'
  | 'mustCallCambio'
  | 'callerCannotAct'
  | 'notOwnCard'
  | 'unknownPlayer'
  | 'emptyDeck';
