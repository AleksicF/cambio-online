import type { Server, Socket } from 'socket.io';
import {
  isBotDifficulty,
  type Ack,
  type AckResponse,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type Session,
} from '@cambio/shared';
import type { Room, RoomTransport } from './rooms/Room';
import { RoomManager } from './rooms/RoomManager';
import { parseAction, parseObject, parseSession } from './validation';

interface SocketData {
  roomCode?: string;
  playerId?: string;
}

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

const SWEEP_INTERVAL_MS = 60_000;

/** Verbindet Socket.IO mit den Räumen. Payloads vom Client werden nie ungeprüft verwendet. */
export function attachGameHandlers(io: GameServer, serverVersion: string) {
  /** Aktueller Socket je Spieler-ID. */
  const sockets = new Map<string, GameSocket>();

  const transport: RoomTransport = {
    sendRoom: (id, room) => sockets.get(id)?.emit('room', room),
    sendGame: (id, update) => sockets.get(id)?.emit('game', update),
    sendKicked: (id) => {
      const socket = sockets.get(id);
      if (!socket) return;
      socket.emit('kicked');
      unbind(socket);
    },
  };
  const rooms = new RoomManager(transport);
  const sweepInterval = setInterval(() => rooms.sweep(), SWEEP_INTERVAL_MS);
  sweepInterval.unref();

  function bind(socket: GameSocket, room: Room, playerId: string) {
    const previous = sockets.get(playerId);
    if (previous && previous !== socket) {
      // Gleicher Spieler in neuem Tab: Die alte Verbindung wird getrennt.
      previous.data = {};
      previous.disconnect(true);
    }
    socket.data = { roomCode: room.code, playerId };
    sockets.set(playerId, socket);
  }

  function unbind(socket: GameSocket) {
    const { playerId } = socket.data;
    if (playerId && sockets.get(playerId) === socket) sockets.delete(playerId);
    socket.data = {};
  }

  function context(socket: GameSocket): { room: Room; playerId: string } | null {
    const room = rooms.get(socket.data.roomCode);
    const playerId = socket.data.playerId;
    return room && playerId ? { room, playerId } : null;
  }

  /** Führt `fn` im Raum des Sockets aus und beantwortet das Ack. */
  function withRoom(
    socket: GameSocket,
    ack: unknown,
    fn: (room: Room, playerId: string) => AckResponse,
  ) {
    if (typeof ack !== 'function') return;
    const ctx = context(socket);
    (ack as Ack)(ctx ? fn(ctx.room, ctx.playerId) : { ok: false, error: 'notInRoom' });
  }

  function leaveCurrentRoom(socket: GameSocket) {
    const ctx = context(socket);
    if (ctx) ctx.room.leave(ctx.playerId);
    unbind(socket);
    rooms.sweep();
  }

  function joinAndBind(
    socket: GameSocket,
    room: Room,
    name: unknown,
    ack: Ack<{ session: Session }>,
  ) {
    const result = room.join(name);
    if (!result.ok) {
      rooms.sweep();
      return ack(result);
    }
    bind(socket, room, result.member.id);
    room.sendStateTo(result.member.id);
    ack({
      ok: true,
      session: { roomCode: room.code, playerId: result.member.id, token: result.member.token },
    });
  }

  io.on('connection', (socket: GameSocket) => {
    socket.emit('welcome', { serverVersion });

    socket.on('ping', (ack) => {
      if (typeof ack === 'function') ack(Date.now());
    });

    socket.on('createRoom', (payload, ack) => {
      if (typeof ack !== 'function') return;
      leaveCurrentRoom(socket);
      joinAndBind(socket, rooms.create(), parseObject(payload)?.name, ack);
    });

    socket.on('joinRoom', (payload, ack) => {
      if (typeof ack !== 'function') return;
      const data = parseObject(payload);
      const room = rooms.get(data?.code);
      if (!room) return ack({ ok: false, error: 'roomNotFound' });
      leaveCurrentRoom(socket);
      joinAndBind(socket, room, data?.name, ack);
    });

    socket.on('resumeSession', (payload, ack) => {
      if (typeof ack !== 'function') return;
      const session = parseSession(payload);
      const room = session ? rooms.get(session.roomCode) : undefined;
      const member = session && room?.findByToken(session.playerId, session.token);
      if (!room || !member) return ack({ ok: false, error: 'invalidSession' });
      bind(socket, room, member.id);
      room.setConnected(member.id, true);
      room.sendStateTo(member.id);
      ack({ ok: true });
    });

    socket.on('leaveRoom', (ack) => {
      leaveCurrentRoom(socket);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('updateSettings', (settings, ack) =>
      withRoom(socket, ack, (room, id) => room.updateSettings(id, settings)),
    );

    socket.on('kickPlayer', (payload, ack) =>
      withRoom(socket, ack, (room, id) => {
        const target = parseObject(payload)?.playerId;
        return typeof target === 'string'
          ? room.kick(id, target)
          : { ok: false, error: 'invalidPayload' };
      }),
    );

    socket.on('addBot', (payload, ack) =>
      withRoom(socket, ack, (room, id) => {
        const difficulty = parseObject(payload)?.difficulty;
        if (!isBotDifficulty(difficulty)) return { ok: false, error: 'invalidPayload' };
        const result = room.addBot(id, difficulty);
        return result.ok ? { ok: true } : result;
      }),
    );

    socket.on('setBotDifficulty', (payload, ack) =>
      withRoom(socket, ack, (room, id) => {
        const data = parseObject(payload);
        if (typeof data?.playerId !== 'string' || !isBotDifficulty(data.difficulty)) {
          return { ok: false, error: 'invalidPayload' };
        }
        return room.setBotDifficulty(id, data.playerId, data.difficulty);
      }),
    );

    socket.on('startGame', (ack) => withRoom(socket, ack, (room, id) => room.start(id)));

    socket.on('gameAction', (payload, ack) =>
      withRoom(socket, ack, (room, id) => {
        const action = parseAction(payload);
        return action ? room.act(id, action) : { ok: false, error: 'invalidPayload' };
      }),
    );

    socket.on('nextPartie', (ack) => withRoom(socket, ack, (room, id) => room.nextPartie(id)));

    socket.on('backToLobby', (ack) => withRoom(socket, ack, (room, id) => room.backToLobby(id)));

    socket.on('disconnect', () => {
      const ctx = context(socket);
      if (!ctx || sockets.get(ctx.playerId) !== socket) return;
      sockets.delete(ctx.playerId);
      ctx.room.setConnected(ctx.playerId, false);
    });
  });

  return { rooms };
}
