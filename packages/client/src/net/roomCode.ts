import { ROOM_CODE_LENGTH } from '@cambio/shared';

/**
 * Macht aus einer Eingabe einen Raumcode. Akzeptiert auch einen eingefügten
 * Einladungslink (`…/?code=ABCD`) und entfernt alles außer Buchstaben.
 */
export function extractRoomCode(input: string): string {
  const fromLink = /[?&]code=([A-Za-z]+)/.exec(input)?.[1];
  return (fromLink ?? input)
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, ROOM_CODE_LENGTH);
}
