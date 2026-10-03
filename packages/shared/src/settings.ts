/** Lobby-Einstellungen gemäß docs/RULES.md §10. Zeiten in Sekunden. */
export interface GameSettings {
  mode: 'single' | 'points';
  /** Nur im Punktemodus relevant. */
  endCondition: 'rounds' | 'pointLimit';
  roundCount: number;
  pointLimit: number;
  callerPenalty: number;
  /** `null` = kein Zeitlimit. */
  turnTimeLimit: number | null;
  /** Sekunden, nur bei `snapWindowMode: 'timed'` (bzw. nach dem letzten Zug). */
  snapWindow: number;
  /** Abwurf-Fenster mit fester Zeit oder offen bis zur nächsten abgelegten Karte (RULES §6). */
  snapWindowMode: 'timed' | 'untilNextCard';
  /** Steigende Strafkarten (n-ter Fehler = n Karten) oder immer 1 Karte. */
  escalatingPenalty: boolean;
  peekDuration: number;
  cambioFromLap: number;
  maxPlayers: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'single',
  endCondition: 'pointLimit',
  roundCount: 5,
  pointLimit: 100,
  callerPenalty: 10,
  turnTimeLimit: 30,
  snapWindow: 3,
  snapWindowMode: 'timed',
  escalatingPenalty: true,
  peekDuration: 3,
  cambioFromLap: 3,
  maxPlayers: 6,
};

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

type NumericSetting =
  | 'roundCount'
  | 'pointLimit'
  | 'callerPenalty'
  | 'turnTimeLimit'
  | 'snapWindow'
  | 'peekDuration'
  | 'cambioFromLap'
  | 'maxPlayers';

/** Erlaubte Bereiche der Zahlen-Einstellungen (RULES §10). */
export const SETTINGS_LIMITS: Record<NumericSetting, { min: number; max: number }> = {
  roundCount: { min: 1, max: 20 },
  pointLimit: { min: 50, max: 300 },
  callerPenalty: { min: 0, max: 30 },
  turnTimeLimit: { min: 15, max: 120 },
  snapWindow: { min: 2, max: 10 },
  peekDuration: { min: 2, max: 10 },
  cambioFromLap: { min: 1, max: 5 },
  maxPlayers: { min: MIN_PLAYERS, max: MAX_PLAYERS },
};

const clamp = (value: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, Math.round(value)));

/**
 * Übernimmt gültige Felder aus `input` in `base`. Unbekannte oder ungültige
 * Werte werden ignoriert, Zahlen auf ihren erlaubten Bereich begrenzt.
 */
export function mergeSettings(base: GameSettings, input: unknown): GameSettings {
  const result = { ...base };
  if (typeof input !== 'object' || input === null) return result;
  const raw = input as Record<string, unknown>;

  if (raw.mode === 'single' || raw.mode === 'points') result.mode = raw.mode;
  if (raw.endCondition === 'rounds' || raw.endCondition === 'pointLimit') {
    result.endCondition = raw.endCondition;
  }
  if (raw.snapWindowMode === 'timed' || raw.snapWindowMode === 'untilNextCard') {
    result.snapWindowMode = raw.snapWindowMode;
  }
  if (typeof raw.escalatingPenalty === 'boolean') result.escalatingPenalty = raw.escalatingPenalty;
  for (const key of Object.keys(SETTINGS_LIMITS) as NumericSetting[]) {
    const value = raw[key];
    if (key === 'turnTimeLimit' && value === null) result.turnTimeLimit = null;
    else if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = clamp(value, SETTINGS_LIMITS[key]);
    }
  }
  return result;
}
