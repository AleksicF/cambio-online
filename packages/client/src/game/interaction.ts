import type { Ability, PlayerAction, PlayerView, SlotRef } from '@cambio/shared';

/** Lokaler Bedienzustand, der noch nicht an den Server geschickt wurde. */
export interface LocalSelection {
  /** Spieler hat die offene Karte angeklickt und wählt jetzt den Tauschplatz. */
  takingDiscard: boolean;
  /** Bereits gewählte Karten für Tausch-Fähigkeiten. */
  picked: SlotRef[];
}

export const EMPTY_SELECTION: LocalSelection = { takingDiscard: false, picked: [] };

export type ClickResult =
  | { kind: 'action'; action: PlayerAction }
  | { kind: 'select'; selection: LocalSelection }
  | { kind: 'none' };

const sameRef = (a: SlotRef, b: SlotRef) => a.playerId === b.playerId && a.slot === b.slot;

/** Darf diese Karte gerade angeklickt werden? */
export function isSelectable(view: PlayerView, sel: LocalSelection, ref: SlotRef): boolean {
  const { me, phase, cambioCallerId } = view;
  const own = ref.playerId === me;
  const locked = ref.playerId === cambioCallerId;
  const myTurn = view.currentPlayerId === me;

  switch (phase.type) {
    case 'snapWindow':
      return me !== cambioCallerId && !locked;
    case 'snapGive':
      return phase.snapperId === me && own;
    case 'turn':
      return myTurn && sel.takingDiscard && own;
    case 'drawn':
      return myTurn && own;
    case 'ability':
      if (!myTurn || locked) return false;
      if (phase.ability === 'peekOwn') return own;
      if (phase.ability === 'peekOther') return !own;
      return true;
    case 'kingSwap':
      return myTurn && !locked;
    default:
      return false;
  }
}

/** Was passiert beim Klick auf eine Karte? */
export function clickCard(view: PlayerView, sel: LocalSelection, ref: SlotRef): ClickResult {
  if (!isSelectable(view, sel, ref)) return { kind: 'none' };
  const { phase } = view;

  switch (phase.type) {
    case 'snapWindow':
      return { kind: 'action', action: { type: 'snap', target: ref } };
    case 'snapGive':
      return { kind: 'action', action: { type: 'giveCard', slot: ref.slot } };
    case 'turn':
      return { kind: 'action', action: { type: 'takeDiscard', slot: ref.slot } };
    case 'drawn':
      return { kind: 'action', action: { type: 'swapDrawn', slot: ref.slot } };
    case 'ability':
      switch (phase.ability) {
        case 'peekOwn':
          return { kind: 'action', action: { type: 'peekOwn', slot: ref.slot } };
        case 'peekOther':
          return { kind: 'action', action: { type: 'peekOther', target: ref } };
        case 'king':
          return { kind: 'action', action: { type: 'kingPeek', target: ref } };
        case 'blindSwap':
          return pickForSwap(sel, ref, (a, b) => ({ type: 'blindSwap', a, b }));
      }
      break;
    case 'kingSwap':
      return pickForSwap(sel, ref, (a, b) => ({ type: 'kingSwap', a, b }));
  }
  return { kind: 'none' };
}

/** Zwei Karten verschiedener Spieler auswählen; die zweite löst die Aktion aus. */
function pickForSwap(
  sel: LocalSelection,
  ref: SlotRef,
  build: (a: SlotRef, b: SlotRef) => PlayerAction,
): ClickResult {
  const [first] = sel.picked;
  if (!first) return { kind: 'select', selection: { ...sel, picked: [ref] } };
  if (sameRef(first, ref)) return { kind: 'select', selection: { ...sel, picked: [] } };
  // Gleicher Spieler: Auswahl ersetzen statt ungültig tauschen.
  if (first.playerId === ref.playerId)
    return { kind: 'select', selection: { ...sel, picked: [ref] } };
  return { kind: 'action', action: build(first, ref) };
}

export const ABILITY_TEXT: Record<Ability, string> = {
  peekOwn: 'Schau dir eine deiner Karten an.',
  peekOther: 'Schau dir eine Karte eines Gegners an.',
  blindSwap: 'Tausche zwei Karten verschiedener Spieler, ohne sie anzusehen.',
  king: 'Schau dir eine beliebige Karte an – danach darfst du tauschen.',
};

/** Kurzname für Hilfe und Übersicht. */
export const ABILITY_LABEL: Record<Ability, string> = {
  peekOwn: 'Eigene Karte ansehen',
  peekOther: 'Fremde Karte ansehen',
  blindSwap: 'Blind tauschen',
  king: 'Ansehen, dann tauschen',
};

export const ABILITY_SHORT: Record<Ability, string> = {
  peekOwn: 'schaut eigene Karte an',
  peekOther: 'schaut fremde Karte an',
  blindSwap: 'tauscht blind',
  king: 'nutzt den König',
};
