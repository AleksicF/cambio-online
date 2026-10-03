import type { Card, Rank, Suit } from '@cambio/shared';

/**
 * Eigene Kartendesigns (siehe docs/CARDS.md):
 * Bilder nach `packages/client/public/cards/` legen – Dateinamen siehe `cardCode`,
 * dazu `back` für die Rückseite – und `enabled` auf `true` setzen.
 */
export const CARD_IMAGES = {
  enabled: false,
  extension: 'svg' as 'svg' | 'png' | 'webp',
};

const SUIT_CODE: Record<Suit, string> = { hearts: 'H', diamonds: 'D', spades: 'S', clubs: 'C' };

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  spades: '♠',
  clubs: '♣',
};

/** Deutsche Beschriftung: Bube, Dame, König. */
export const RANK_LABEL: Record<Rank, string> = {
  A: 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'B',
  Q: 'D',
  K: 'K',
};

/** Dateiname ohne Endung, z. B. `KS` (König Pik), `10H` (Zehn Herz), `JOKER`. */
export function cardCode(card: Card): string {
  return card.kind === 'joker' ? 'JOKER' : `${card.rank}${SUIT_CODE[card.suit]}`;
}

export const cardImageUrl = (card: Card) => `/cards/${cardCode(card)}.${CARD_IMAGES.extension}`;
export const cardBackUrl = () => `/cards/back.${CARD_IMAGES.extension}`;

const SUIT_NAME: Record<Suit, string> = {
  hearts: 'Herz',
  diamonds: 'Karo',
  spades: 'Pik',
  clubs: 'Kreuz',
};
const RANK_NAME: Partial<Record<Rank, string>> = { A: 'Ass', J: 'Bube', Q: 'Dame', K: 'König' };

/** Lesbarer Name, z. B. „Pik König“. */
export function cardName(card: Card): string {
  if (card.kind === 'joker') return 'Joker';
  return `${SUIT_NAME[card.suit]} ${RANK_NAME[card.rank] ?? card.rank}`;
}

export const isRedCard = (card: Card) =>
  card.kind === 'standard' && (card.suit === 'hearts' || card.suit === 'diamonds');
