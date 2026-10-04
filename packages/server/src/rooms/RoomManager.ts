import { ROOM_CODE_LENGTH } from '@cambio/shared';
import { Room, type RoomTransport } from './Room';

/** Ohne I und O, damit Codes nicht mit 1 und 0 verwechselt werden. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
/** Räume ohne verbundene Spieler werden nach dieser Zeit gelöscht. */
export const EMPTY_ROOM_TTL_MS = 10 * 60_000;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly transport: RoomTransport,
    private readonly random: () => number = Math.random,
  ) {}

  create(): Room {
    let code: string;
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)],
      ).join('');
    } while (this.rooms.has(code));
    const room = new Room(code, this.transport, this.random);
    this.rooms.set(code, room);
    return room;
  }

  get(code: unknown): Room | undefined {
    return typeof code === 'string' ? this.rooms.get(code.trim().toUpperCase()) : undefined;
  }

  get size() {
    return this.rooms.size;
  }

  /** Entfernt leere Räume und solche, in denen schon länger niemand verbunden ist. */
  sweep(now = Date.now()) {
    for (const [code, room] of this.rooms) {
      const empty = !room.hasHumans();
      const abandoned = room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS;
      if (empty || abandoned) {
        room.dispose();
        this.rooms.delete(code);
      }
    }
  }
}
