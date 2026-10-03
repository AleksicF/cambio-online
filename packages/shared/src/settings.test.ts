import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from './settings';

describe('mergeSettings', () => {
  it('übernimmt gültige Werte', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { mode: 'points', roundCount: 7 })).toMatchObject({
      mode: 'points',
      roundCount: 7,
    });
  });

  it('begrenzt Zahlen auf den erlaubten Bereich', () => {
    const s = mergeSettings(DEFAULT_SETTINGS, { snapWindow: 99, maxPlayers: 1, pointLimit: 120.6 });
    expect(s.snapWindow).toBe(10);
    expect(s.maxPlayers).toBe(2);
    expect(s.pointLimit).toBe(121);
  });

  it('übernimmt Abwurf-Modus und Strafkarten-Art', () => {
    const s = mergeSettings(DEFAULT_SETTINGS, {
      snapWindowMode: 'untilNextCard',
      escalatingPenalty: false,
    });
    expect(s.snapWindowMode).toBe('untilNextCard');
    expect(s.escalatingPenalty).toBe(false);
    expect(
      mergeSettings(DEFAULT_SETTINGS, { snapWindowMode: 'x', escalatingPenalty: 'nein' }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it('erlaubt ein abgeschaltetes Zeitlimit', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { turnTimeLimit: null }).turnTimeLimit).toBeNull();
  });

  it('ignoriert Unsinn', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { mode: 'chaos', snapWindow: '5', foo: 1 })).toEqual(
      DEFAULT_SETTINGS,
    );
    expect(mergeSettings(DEFAULT_SETTINGS, null)).toEqual(DEFAULT_SETTINGS);
  });
});
