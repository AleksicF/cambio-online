import { cardValue } from '../cards';
import type { GameSettings } from '../settings';
import type { PartieResult, PlayerState } from './types';

export function handSum(player: PlayerState): number {
  return player.slots.reduce((sum, card) => sum + (card ? cardValue(card) : 0), 0);
}

/** Alle IDs mit dem kleinsten Wert (Gleichstand = geteilter Sieg). */
export function lowest(values: Record<string, number>, ids: string[]): string[] {
  const min = Math.min(...ids.map((id) => values[id]!));
  return ids.filter((id) => values[id] === min);
}

/** Wertung einer Partie gemäß RULES §8. */
export function scorePartie(
  players: PlayerState[],
  callerId: string,
  settings: GameSettings,
  partieNumber: number,
): PartieResult {
  const sums = Object.fromEntries(players.map((p) => [p.id, handSum(p)]));
  const callerSum = sums[callerId]!;
  const others = players.map((p) => p.id).filter((id) => id !== callerId);

  if (settings.mode === 'single') {
    // Gleichstand mit dem Rufer: Der Nicht-Rufer gewinnt.
    const callerFailed = others.some((id) => sums[id]! <= callerSum);
    return {
      partieNumber,
      callerId,
      sums,
      points: { ...sums },
      callerFailed,
      winners: callerFailed ? lowest(sums, others) : [callerId],
    };
  }

  // Punktemodus: Gleichstand mit dem Rufer bleibt straffrei.
  const callerFailed = others.some((id) => sums[id]! < callerSum);
  const points = { ...sums };
  if (callerFailed) points[callerId] = callerSum + settings.callerPenalty;
  return {
    partieNumber,
    callerId,
    sums,
    points,
    callerFailed,
    winners: lowest(
      points,
      players.map((p) => p.id),
    ),
  };
}
