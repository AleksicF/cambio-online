import type { SlotRef } from '@cambio/shared';

/** DOM-Anker (data-anchor) für Kartenpositionen – Grundlage der Flug-Animationen. */
export const DECK = 'deck';
export const DISCARD = 'discard';
export const DRAWN = 'drawn';
export const slotAnchor = (ref: SlotRef) => `slot:${ref.playerId}:${ref.slot}`;

export function measureAnchors(): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  document.querySelectorAll<HTMLElement>('[data-anchor]').forEach((el) => {
    rects.set(el.dataset.anchor!, el.getBoundingClientRect());
  });
  return rects;
}
