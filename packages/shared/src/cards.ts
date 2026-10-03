export const SUITS = ['hearts', 'diamonds', 'spades', 'clubs'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];

export type Card =
  { id: string; kind: 'standard'; suit: Suit; rank: Rank } | { id: string; kind: 'joker' };

export const isRed = (suit: Suit): boolean => suit === 'hearts' || suit === 'diamonds';

/** Punktwert einer Karte gemäß docs/RULES.md §1. */
export function cardValue(card: Card): number {
  if (card.kind === 'joker') return 0;
  switch (card.rank) {
    case 'A':
      return 1;
    case 'J':
    case 'Q':
      return 10;
    case 'K':
      return isRed(card.suit) ? -1 : 31;
    default:
      return Number(card.rank);
  }
}

/** Gleicher Rang für das Abwerfen (§6): Könige untereinander und Joker untereinander gleich. */
export function sameRank(a: Card, b: Card): boolean {
  if (a.kind === 'joker' || b.kind === 'joker') return a.kind === b.kind;
  return a.rank === b.rank;
}

/** Erzeugt ein ungemischtes Deck: 52 Karten + 2 Joker. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}-${suit}`, kind: 'standard', suit, rank });
    }
  }
  deck.push({ id: 'joker-1', kind: 'joker' }, { id: 'joker-2', kind: 'joker' });
  return deck;
}

/** Fisher-Yates-Mischen; `random` ist injizierbar für deterministische Tests. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
