import { describe, expect, it } from 'vitest';
import { cardValue, createDeck, sameRank, shuffle, type Card } from './cards';

const card = (
  rank: Extract<Card, { kind: 'standard' }>['rank'],
  suit: 'hearts' | 'spades',
): Card => ({
  id: `${rank}-${suit}`,
  kind: 'standard',
  suit,
  rank,
});
const joker: Card = { id: 'joker-1', kind: 'joker' };

describe('createDeck', () => {
  it('enthält 54 eindeutige Karten', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(54);
    expect(new Set(deck.map((c) => c.id)).size).toBe(54);
  });
});

describe('cardValue', () => {
  it.each([
    [joker, 0],
    [card('A', 'spades'), 1],
    [card('7', 'hearts'), 7],
    [card('10', 'spades'), 10],
    [card('J', 'hearts'), 10],
    [card('Q', 'spades'), 10],
    [card('K', 'hearts'), -1],
    [card('K', 'spades'), 31],
  ])('%o = %i', (c, value) => {
    expect(cardValue(c)).toBe(value);
  });

  it('Gesamtwert des Decks', () => {
    const total = createDeck().reduce((sum, c) => sum + cardValue(c), 0);
    // 4 × (1+2+…+10 + 10 + 10) + 2 × (−1) + 2 × 31 + 2 × 0
    expect(total).toBe(4 * 75 - 2 + 62);
  });
});

describe('sameRank', () => {
  it('roter und schwarzer König sind gleicher Rang', () => {
    expect(sameRank(card('K', 'hearts'), card('K', 'spades'))).toBe(true);
  });
  it('Joker passt nur auf Joker', () => {
    expect(sameRank(joker, { id: 'joker-2', kind: 'joker' })).toBe(true);
    expect(sameRank(joker, card('A', 'spades'))).toBe(false);
  });
});

describe('shuffle', () => {
  it('verändert das Original nicht und behält alle Karten', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    expect(deck).toEqual(createDeck());
    expect([...shuffled].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...deck].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });
});
