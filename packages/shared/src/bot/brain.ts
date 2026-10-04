import { cardValue, sameRank, type Card } from '../cards';
import type { GameEvent, PlayerAction, SlotRef } from '../game/types';
import type { PlayerView } from '../game/view';
import type { BotProfile } from './profiles';

/** Erwarteter Wert einer unbekannten Karte (Summe aller Karten / 54, gerundet). */
export const UNKNOWN_CARD_VALUE = 6.5;
/** Ab diesem Umlauf ruft ein Bot großzügiger Cambio, damit Partien enden. */
const LATE_LAP = 9;

const key = (ref: SlotRef) => `${ref.playerId}:${ref.slot}`;

/**
 * Entscheidungslogik eines Bots. Der Bot sieht nur, was ein Mensch an seiner
 * Stelle sähe (PlayerView + gefilterte Ereignisse) und merkt sich Karten mit
 * der Zuverlässigkeit seines Profils. Kein Zugriff auf verdeckte Karten.
 */
export class BotBrain {
  /** Gemerkte Karten je Slot. */
  private readonly known = new Map<string, Card>();
  /** Zuletzt selbst gezogene Karte (für den Tausch). */
  private drawn: Card | null = null;
  /** Abwurf-Gelegenheiten, über die schon entschieden wurde. */
  private readonly snapDecided = new Set<string>();

  constructor(
    readonly playerId: string,
    readonly profile: BotProfile,
    private readonly random: () => number = Math.random,
  ) {}

  // -------------------------------------------------------------------------
  // Wahrnehmen

  observe(events: GameEvent[]) {
    for (const e of events) this.observeEvent(e);
  }

  private observeEvent(e: GameEvent) {
    const me = this.playerId;
    switch (e.type) {
      case 'partieStarted':
        this.known.clear();
        this.snapDecided.clear();
        this.drawn = null;
        break;
      case 'cardPeeked':
        if (e.card && e.viewerId === me) this.learn(e.target, e.card, false);
        break;
      case 'drewFromDeck':
        if (e.playerId === me && e.card) this.drawn = e.card;
        break;
      case 'swappedDrawn': {
        const ref = { playerId: e.playerId, slot: e.slot };
        if (e.playerId === me && this.drawn) this.learn(ref, this.drawn, true);
        else this.known.delete(key(ref));
        this.drawn = null;
        break;
      }
      case 'discardedDrawn':
        this.drawn = null;
        break;
      case 'tookDiscard':
        // Offen genommen: Jeder weiß, welche Karte dort jetzt liegt.
        this.learn({ playerId: e.playerId, slot: e.slot }, e.card, true);
        break;
      case 'cardsSwapped':
        this.move(e.a, e.b, e.playerId === me, true);
        break;
      case 'snapSucceeded':
        this.known.delete(key(e.target));
        break;
      case 'snapFailed':
        // Die Karte wurde allen gezeigt und liegt wieder an ihrem Platz.
        this.learn(e.target, e.card, false);
        break;
      case 'cardGiven':
        this.move(e.from, e.to, e.from.playerId === me, false);
        break;
      case 'turnStarted':
        if (e.playerId === me) this.forgetSome();
        break;
      default:
        break;
    }
  }

  /** Karte merken – mit der Merk-Wahrscheinlichkeit des Profils. */
  private learn(ref: SlotRef, card: Card, slotChanged: boolean) {
    if (this.random() < this.profile.memory) this.known.set(key(ref), card);
    else if (slotChanged) this.known.delete(key(ref));
  }

  /** Karten wurden bewegt: Wissen mitnehmen (oder verlieren). */
  private move(a: SlotRef, b: SlotRef, ownAction: boolean, swap: boolean) {
    const ka = this.known.get(key(a));
    const kb = this.known.get(key(b));
    this.known.delete(key(a));
    this.known.delete(key(b));
    if (!this.profile.trackSwaps && !ownAction) return;
    if (ka) this.known.set(key(b), ka);
    if (kb && swap) this.known.set(key(a), kb);
  }

  private forgetSome() {
    for (const k of [...this.known.keys()]) {
      if (this.random() < this.profile.forgetPerTurn) this.known.delete(k);
    }
  }

  // -------------------------------------------------------------------------
  // Zeiten

  thinkDelay(): number {
    return this.between(this.profile.thinkMs);
  }

  private between([min, max]: [number, number]) {
    return Math.round(min + this.random() * (max - min));
  }

  // -------------------------------------------------------------------------
  // Entscheiden

  /** Muss der Bot gerade einen Zugschritt machen (Zug, Fähigkeit, Abgeben)? */
  needsToAct(view: PlayerView): boolean {
    const { phase } = view;
    if (phase.type === 'snapGive') return phase.snapperId === this.playerId;
    const mine = view.currentPlayerId === this.playerId;
    return mine && ['turn', 'drawn', 'ability', 'kingSwap'].includes(phase.type);
  }

  /** Nächster Zugschritt oder `null`, wenn der Bot gerade nichts tun muss. */
  decideTurn(view: PlayerView): PlayerAction | null {
    if (!this.needsToAct(view)) return null;
    const { phase } = view;
    switch (phase.type) {
      case 'turn':
        return this.decideStart(view);
      case 'drawn':
        return phase.card ? this.decideDrawn(view, phase.card) : { type: 'discardDrawn' };
      case 'ability':
        return this.decideAbility(view, phase.ability);
      case 'kingSwap':
        return this.decideKingSwap(view);
      case 'snapGive': {
        const worst = this.worstOwnSlot(view);
        return worst ? { type: 'giveCard', slot: worst.slot } : null;
      }
      default:
        return null;
    }
  }

  private decideStart(view: PlayerView): PlayerAction {
    if (view.mustCallCambio) return { type: 'callCambio' };

    const own = this.ownSlots(view);
    const estimate = own.reduce((sum, slot) => sum + this.valueAt(view.me, slot), 0);
    const unknown = own.filter((slot) => !this.known.has(key({ playerId: view.me, slot }))).length;
    const late = view.lap >= LATE_LAP;
    if (
      view.canCallCambio &&
      ((estimate <= this.profile.cambioMaxSum && unknown <= this.profile.cambioMaxUnknown) ||
        (late && estimate <= this.profile.cambioMaxSum + 8))
    ) {
      return { type: 'callCambio' };
    }

    // Offene Karte nehmen, wenn sie deutlich besser ist als die schlechteste eigene.
    const top = view.discardTop;
    const worst = this.worstOwnSlot(view);
    if (top && worst && worst.value - cardValue(top) >= 3) {
      return { type: 'takeDiscard', slot: worst.slot };
    }
    return { type: 'drawFromDeck' };
  }

  private decideDrawn(view: PlayerView, card: Card): PlayerAction {
    const worst = this.worstOwnSlot(view);
    if (worst && worst.value - cardValue(card) >= 2) return { type: 'swapDrawn', slot: worst.slot };
    return { type: 'discardDrawn' };
  }

  private decideAbility(view: PlayerView, ability: string): PlayerAction {
    const skip: PlayerAction = { type: 'skipAbility' };
    if (this.random() >= this.profile.useAbility) return skip;

    switch (ability) {
      case 'peekOwn': {
        const slot = this.pick(this.unknownOwnSlots(view));
        return slot === undefined ? skip : { type: 'peekOwn', slot };
      }
      case 'peekOther': {
        const target = this.pick(this.opponentSlots(view, false));
        return target ? { type: 'peekOther', target } : skip;
      }
      case 'blindSwap': {
        const swap = this.bestSwap(view, 8);
        return swap ? { type: 'blindSwap', a: swap[0], b: swap[1] } : skip;
      }
      case 'king': {
        const own = this.pick(this.unknownOwnSlots(view));
        if (own !== undefined)
          return { type: 'kingPeek', target: { playerId: view.me, slot: own } };
        const target = this.pick(this.opponentSlots(view, false));
        return target ? { type: 'kingPeek', target } : skip;
      }
      default:
        return skip;
    }
  }

  private decideKingSwap(view: PlayerView): PlayerAction {
    const swap = this.bestSwap(view, 7);
    return swap ? { type: 'kingSwap', a: swap[0], b: swap[1] } : { type: 'skipAbility' };
  }

  /**
   * Eigene hohe Karte gegen eine bekannte niedrige (oder sonst unbekannte)
   * Karte eines Gegners tauschen – nur wenn es sich deutlich lohnt.
   */
  private bestSwap(view: PlayerView, minOwnValue: number): [SlotRef, SlotRef] | null {
    const worst = this.worstOwnSlot(view, true);
    if (!worst || worst.value < minOwnValue) return null;
    const mine = { playerId: view.me, slot: worst.slot };

    const knownLow = this.opponentSlots(view, true)
      .map((ref) => ({ ref, value: cardValue(this.known.get(key(ref))!) }))
      .sort((a, b) => a.value - b.value)[0];
    if (knownLow && worst.value - knownLow.value >= 3) return [mine, knownLow.ref];

    const unknown = this.pick(this.opponentSlots(view, false));
    if (unknown && worst.value - UNKNOWN_CARD_VALUE >= 3) return [mine, unknown];
    return null;
  }

  /** Abwerfen: einmal pro Ablagekarte entscheiden, ob und mit welcher Karte. */
  decideSnap(view: PlayerView): { target: SlotRef; delayMs: number; key: string } | null {
    const top = view.discardTop;
    if (!view.snapAllowed || !top || view.cambioCallerId === view.me) return null;
    const snapKey = snapOpportunityKey(view);
    if (this.snapDecided.has(snapKey)) return null;
    this.snapDecided.add(snapKey);

    const matches = (ref: SlotRef) => {
      const card = this.known.get(key(ref));
      return !!card && sameRank(card, top);
    };
    const own = this.ownSlots(view)
      .map((slot) => ({ playerId: view.me, slot }))
      .filter(matches);
    const foreign = this.opponentSlots(view, true).filter(matches);
    const canGive = this.ownSlots(view).length > 0;

    let target: SlotRef | undefined;
    if (own.length && this.random() < this.profile.snapOwn) target = own[0];
    else if (foreign.length && canGive && this.random() < this.profile.snapForeign) {
      target = foreign[0];
    }
    return target
      ? { target, delayMs: this.between(this.profile.snapDelayMs), key: snapKey }
      : null;
  }

  // -------------------------------------------------------------------------
  // Hilfsfunktionen

  private ownSlots(view: PlayerView): number[] {
    const me = view.players.find((p) => p.id === view.me);
    return me ? me.slots.flatMap((s, i) => (s ? [i] : [])) : [];
  }

  private unknownOwnSlots(view: PlayerView): number[] {
    return this.ownSlots(view).filter((slot) => !this.known.has(key({ playerId: view.me, slot })));
  }

  /** Karten der Gegner (ohne gesperrten Rufer); nur bekannte oder nur unbekannte. */
  private opponentSlots(view: PlayerView, known: boolean): SlotRef[] {
    return view.players
      .filter((p) => p.id !== view.me && p.id !== view.cambioCallerId)
      .flatMap((p) => p.slots.flatMap((s, slot) => (s ? [{ playerId: p.id, slot }] : [])))
      .filter((ref) => this.known.has(key(ref)) === known);
  }

  private valueAt(playerId: string, slot: number): number {
    const card = this.known.get(key({ playerId, slot }));
    return card ? cardValue(card) : UNKNOWN_CARD_VALUE;
  }

  /** Eigener Platz mit dem höchsten (erwarteten) Wert. */
  private worstOwnSlot(view: PlayerView, knownOnly = false) {
    let worst: { slot: number; value: number } | null = null;
    for (const slot of this.ownSlots(view)) {
      const isKnown = this.known.has(key({ playerId: view.me, slot }));
      if (knownOnly && !isKnown) continue;
      const value = this.valueAt(view.me, slot);
      if (!worst || value > worst.value) worst = { slot, value };
    }
    return worst;
  }

  private pick<T>(items: T[]): T | undefined {
    return items.length ? items[Math.floor(this.random() * items.length)] : undefined;
  }

  /** Nur für Tests: gemerkte Karte eines Platzes. */
  knownCard(ref: SlotRef): Card | undefined {
    return this.known.get(key(ref));
  }
}

/** Kennung der aktuellen Abwurf-Gelegenheit (eine oberste Ablagekarte). */
export function snapOpportunityKey(view: PlayerView): string {
  return `${view.partieNumber}:${view.discardCount}:${view.discardTop?.id ?? ''}`;
}
