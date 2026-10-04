export type BotDifficulty = 'easy' | 'medium' | 'hard';

export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ['easy', 'medium', 'hard'];

export const BOT_DIFFICULTY_LABEL: Record<BotDifficulty, string> = {
  easy: 'Einfach',
  medium: 'Mittel',
  hard: 'Schwer',
};

/**
 * Verhalten eines Bots. Wahrscheinlichkeiten von 0 bis 1, Zeiten in ms.
 * Zum Anpassen der Schwierigkeit nur diese Werte ändern.
 */
export interface BotProfile {
  /** Chance, sich eine gesehene Karte zu merken. */
  memory: number;
  /** Chance pro eigenem Zug, eine gemerkte Karte wieder zu vergessen. */
  forgetPerTurn: number;
  /** Verfolgt der Bot, wohin Karten getauscht werden (sonst vergisst er sie). */
  trackSwaps: boolean;
  /** Chance, eine passende eigene Karte abzuwerfen, die er kennt. */
  snapOwn: number;
  /** Chance, eine passende fremde Karte abzuwerfen, die er kennt. */
  snapForeign: number;
  /** Reaktionszeit beim Abwerfen [min, max]. */
  snapDelayMs: [number, number];
  /** Bedenkzeit pro Spielschritt [min, max]. */
  thinkMs: [number, number];
  /** Chance, die Fähigkeit einer Aktionskarte zu nutzen. */
  useAbility: number;
  /** Cambio rufen, wenn die geschätzte Summe höchstens so hoch ist … */
  cambioMaxSum: number;
  /** … und höchstens so viele eigene Karten unbekannt sind. */
  cambioMaxUnknown: number;
}

export const BOT_PROFILES: Record<BotDifficulty, BotProfile> = {
  easy: {
    memory: 0.6,
    forgetPerTurn: 0.2,
    trackSwaps: false,
    snapOwn: 0.5,
    snapForeign: 0.1,
    snapDelayMs: [1800, 3200],
    thinkMs: [1400, 2400],
    useAbility: 0.6,
    cambioMaxSum: 10,
    cambioMaxUnknown: 2,
  },
  medium: {
    memory: 0.85,
    forgetPerTurn: 0.07,
    trackSwaps: true,
    snapOwn: 0.85,
    snapForeign: 0.4,
    snapDelayMs: [1000, 1900],
    thinkMs: [900, 1600],
    useAbility: 0.9,
    cambioMaxSum: 7,
    cambioMaxUnknown: 1,
  },
  hard: {
    memory: 1,
    forgetPerTurn: 0,
    trackSwaps: true,
    snapOwn: 1,
    snapForeign: 0.8,
    snapDelayMs: [450, 900],
    thinkMs: [600, 1100],
    useAbility: 1,
    cambioMaxSum: 5,
    cambioMaxUnknown: 0,
  },
};

export const isBotDifficulty = (value: unknown): value is BotDifficulty =>
  BOT_DIFFICULTIES.includes(value as BotDifficulty);
