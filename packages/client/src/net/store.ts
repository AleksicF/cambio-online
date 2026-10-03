import { useSyncExternalStore } from 'react';
import type {
  ActionError,
  AckResponse,
  GameSettings,
  GameUpdate,
  PlayerAction,
  RoomView,
  Session,
} from '@cambio/shared';
import { socket } from './socket';

export interface ClientState {
  connection: 'connecting' | 'connected' | 'disconnected';
  session: Session | null;
  room: RoomView | null;
  game: GameUpdate | null;
  /** Lokale Deadline des aktuellen Timers (ms seit Epoch). */
  deadline: number | null;
  kicked: boolean;
}

export type ClientError = ActionError | 'timeout';
export type Response<T extends object = object> =
  ({ ok: true } & T) | { ok: false; error: ClientError };

// Pro Tab gespeichert: Neuladen behält den Platz, ein neuer Tab ist ein neuer Spieler.
const SESSION_KEY = 'cambio.session';
const NAME_KEY = 'cambio.name';
const ACK_TIMEOUT_MS = 5_000;

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function storeSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Speicher nicht verfügbar – Sitzung gilt dann nur bis zum Neuladen.
  }
}

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignorieren
  }
}

let state: ClientState = {
  connection: 'connecting',
  session: loadSession(),
  room: null,
  game: null,
  deadline: null,
  kicked: false,
};
const listeners = new Set<() => void>();

function set(patch: Partial<ClientState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useClient(): ClientState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

async function request<T extends object>(
  emit: () => Promise<AckResponse<T>>,
): Promise<Response<T>> {
  try {
    return await emit();
  } catch {
    return { ok: false, error: 'timeout' };
  }
}

const withTimeout = () => socket.timeout(ACK_TIMEOUT_MS);

function enterRoom(session: Session) {
  storeSession(session);
  set({ session, kicked: false });
}

function resetRoom() {
  storeSession(null);
  set({ session: null, room: null, game: null, deadline: null });
}

// ---------------------------------------------------------------------------
// Verbindung

socket.on('connect', async () => {
  set({ connection: 'connected' });
  const session = state.session;
  if (!session) return;
  const r = await request(() => withTimeout().emitWithAck('resumeSession', session));
  if (!r.ok) resetRoom();
});

socket.on('disconnect', () => set({ connection: 'disconnected' }));
socket.on('room', (room) => set({ room }));
socket.on('game', (game) =>
  set({
    game,
    deadline: game?.timeLeftMs == null ? null : Date.now() + game.timeLeftMs,
  }),
);
socket.on('kicked', () => {
  resetRoom();
  set({ kicked: true });
});

export function connect() {
  if (!socket.connected) socket.connect();
}

// ---------------------------------------------------------------------------
// Aktionen

export const api = {
  async createRoom(name: string) {
    storeName(name);
    const r = await request(() => withTimeout().emitWithAck('createRoom', { name }));
    if (r.ok) enterRoom(r.session);
    return r;
  },

  async joinRoom(code: string, name: string) {
    storeName(name);
    const r = await request(() => withTimeout().emitWithAck('joinRoom', { code, name }));
    if (r.ok) enterRoom(r.session);
    return r;
  },

  async leaveRoom() {
    await request(() => withTimeout().emitWithAck('leaveRoom'));
    resetRoom();
  },

  updateSettings: (settings: Partial<GameSettings>) =>
    request(() => withTimeout().emitWithAck('updateSettings', settings)),
  kick: (playerId: string) => request(() => withTimeout().emitWithAck('kickPlayer', { playerId })),
  startGame: () => request(() => withTimeout().emitWithAck('startGame')),
  act: (action: PlayerAction) => request(() => withTimeout().emitWithAck('gameAction', action)),
  nextPartie: () => request(() => withTimeout().emitWithAck('nextPartie')),
  backToLobby: () => request(() => withTimeout().emitWithAck('backToLobby')),
};
