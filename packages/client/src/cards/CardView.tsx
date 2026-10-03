import type { Card } from '@cambio/shared';
import {
  CARD_IMAGES,
  RANK_LABEL,
  SUIT_SYMBOL,
  cardBackUrl,
  cardImageUrl,
  cardName,
  isRedCard,
} from './cardAssets';

export type CardMark =
  | 'selectable'
  | 'selected'
  | 'highlight'
  | 'locked'
  | 'draggable'
  | 'dragging'
  | 'drop-zone'
  | 'drop-target';

interface CardViewProps {
  /** `null` = verdeckte Karte. */
  card: Card | null;
  small?: boolean;
  marks?: CardMark[];
  /** Für Flug-Animationen: Position dieser Karte im DOM. */
  anchor?: string;
  hidden?: boolean;
  onClick?: () => void;
  /** Für Ziehen per Maus/Touch. */
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  title?: string;
}

/** Eine Karte – offen oder verdeckt. Einzige Stelle, die das Kartenaussehen bestimmt. */
export function CardView({
  card,
  small,
  marks = [],
  anchor,
  hidden,
  onClick,
  onPointerDown,
  title,
}: CardViewProps) {
  const classes = ['card', small && 'card--small', ...marks.map((m) => `card--${m}`)]
    .filter(Boolean)
    .join(' ');
  const label = card ? cardName(card) : (title ?? 'Verdeckte Karte');

  return (
    <button
      type="button"
      className={classes}
      data-anchor={anchor}
      style={{ visibility: hidden ? 'hidden' : undefined }}
      disabled={!onClick && !onPointerDown}
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-label={label}
      title={label}
      // Neuer Schlüssel bei Auf-/Zudecken → neu einhängen → CSS-Dreh-Animation.
      key={card ? card.id : 'back'}
    >
      {card ? <CardFace card={card} /> : <CardBack />}
    </button>
  );
}

export function CardFace({ card }: { card: Card }) {
  if (CARD_IMAGES.enabled) return <img className="card__image" src={cardImageUrl(card)} alt="" />;
  const red = isRedCard(card);
  if (card.kind === 'joker') {
    return <span className="card__face card__face--joker">Joker</span>;
  }
  return (
    <span className={`card__face${red ? ' card__face--red' : ''}`}>
      <span className="card__rank">{RANK_LABEL[card.rank]}</span>
      <span className="card__suit">{SUIT_SYMBOL[card.suit]}</span>
    </span>
  );
}

export function CardBack() {
  if (CARD_IMAGES.enabled) return <img className="card__image" src={cardBackUrl()} alt="" />;
  return <span className="card__back" />;
}

/** Leerer Kartenplatz (Karte abgeworfen oder weggegeben). */
export function EmptySlot({ small, anchor }: { small?: boolean; anchor?: string }) {
  return <span className={`card card--empty${small ? ' card--small' : ''}`} data-anchor={anchor} />;
}
