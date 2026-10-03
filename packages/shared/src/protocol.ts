import type { GameError, GameEvent, PlayerAction } from './game/types';
import type { PlayerView } from './game/view';
import type { GameSettings } from './settings';

/** Zugangsdaten, mit denen ein Client nach einem Verbindungsabbruch zurückkehrt. */
export interface Session {
  roomCode: string;
  playerId: string;
  token: string;
}

export interface RoomPlayer {
  id: string;
  name: string;
  connected: boolean;
}

export interface RoomView {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  settings: GameSettings;
  status: 'lobby' | 'playing';
}

export interface GameUpdate {
  view: PlayerView;
  /** Ereignisse seit dem letzten Update – Grundlage für Animationen. */
  events: GameEvent[];
  /** Verbleibende Zeit des aktuellen Timers in ms (Zug, Abwurf-Fenster, …). */
  timeLeftMs: number | null;
}

export type RoomError =
  | 'roomNotFound'
  | 'roomFull'
  | 'gameInProgress'
  | 'invalidName'
  | 'invalidPayload'
  | 'invalidSession'
  | 'notInRoom'
  | 'notHost'
  | 'notEnoughPlayers'
  | 'notInLobby';

export type ActionError = RoomError | GameError;

export type AckResponse<T extends object = object> =
  ({ ok: true } & T) | { ok: false; error: ActionError };
export type Ack<T extends object = object> = (response: AckResponse<T>) => void;

/** Socket.IO-Events, die der Server an den Client sendet. */
export interface ServerToClientEvents {
  welcome: (info: { serverVersion: string }) => void;
  room: (room: RoomView) => void;
  /** `null` = kein laufendes Spiel (zurück in der Lobby). */
  game: (update: GameUpdate | null) => void;
  /** Der Spieler wurde aus dem Raum entfernt. */
  kicked: () => void;
}

/** Socket.IO-Events, die der Client an den Server sendet. */
export interface ClientToServerEvents {
  ping: (ack: (serverTime: number) => void) => void;
  createRoom: (payload: { name: string }, ack: Ack<{ session: Session }>) => void;
  joinRoom: (payload: { code: string; name: string }, ack: Ack<{ session: Session }>) => void;
  resumeSession: (session: Session, ack: Ack) => void;
  leaveRoom: (ack: Ack) => void;
  updateSettings: (settings: Partial<GameSettings>, ack: Ack) => void;
  kickPlayer: (payload: { playerId: string }, ack: Ack) => void;
  startGame: (ack: Ack) => void;
  gameAction: (action: PlayerAction, ack: Ack) => void;
  nextPartie: (ack: Ack) => void;
  backToLobby: (ack: Ack) => void;
}

export const MAX_NAME_LENGTH = 20;
export const ROOM_CODE_LENGTH = 4;
