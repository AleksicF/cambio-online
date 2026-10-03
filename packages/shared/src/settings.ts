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
  snapWindow: number;
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
  peekDuration: 3,
  cambioFromLap: 3,
  maxPlayers: 6,
};

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
