import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@cambio/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Verbindet sich mit demselben Host, von dem die Seite geladen wurde. */
export const socket: GameSocket = io({ autoConnect: false });
