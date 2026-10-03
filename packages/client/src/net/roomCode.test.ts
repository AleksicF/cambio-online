import { describe, expect, it } from 'vitest';
import { extractRoomCode } from './roomCode';

describe('extractRoomCode', () => {
  it('übernimmt einen eingetippten Code in Großbuchstaben', () => {
    expect(extractRoomCode('abcd')).toBe('ABCD');
  });

  it('liest den Code aus einem eingefügten Einladungslink', () => {
    expect(extractRoomCode('http://localhost:5173/?code=VTMG')).toBe('VTMG');
    expect(extractRoomCode('https://cambio-online.onrender.com/?foo=1&code=xyzw')).toBe('XYZW');
  });

  it('entfernt Leerzeichen und Sonderzeichen', () => {
    expect(extractRoomCode(' AB-CD ')).toBe('ABCD');
  });

  it('kürzt auf die Codelänge', () => {
    expect(extractRoomCode('ABCDEFG')).toBe('ABCD');
  });
});
