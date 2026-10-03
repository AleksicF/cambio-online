import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Card, GameUpdate } from '@cambio/shared';
import { CardBack, CardFace } from '../cards/CardView';
import { DECK, DISCARD, DRAWN, measureAnchors, slotAnchor } from './anchors';

interface FlightPlan {
  from: string;
  to: string;
  card: Card | null;
  delay: number;
}

interface Flight extends FlightPlan {
  id: number;
  fromRect: DOMRect;
  toRect: DOMRect;
}

const DURATION = 0.4;
const STEP = 0.12;
const DEAL_STEP = 0.035;
const FLIGHT_GRACE_MS = 300;

/** Übersetzt Spielereignisse in Kartenbewegungen zwischen DOM-Ankern. */
function planFlights(update: GameUpdate): FlightPlan[] {
  const plans: FlightPlan[] = [];
  let t = 0;
  const add = (from: string, to: string, card: Card | null = null) =>
    plans.push({ from, to, card, delay: t });

  for (const e of update.events) {
    switch (e.type) {
      case 'partieStarted':
        for (let i = 0; i < 4; i++) {
          for (const p of update.view.players) {
            add(DECK, slotAnchor({ playerId: p.id, slot: i }));
            t += DEAL_STEP;
          }
        }
        break;
      case 'drewFromDeck':
        add(DECK, DRAWN, e.card ?? null);
        break;
      case 'swappedDrawn':
        add(DRAWN, slotAnchor({ playerId: e.playerId, slot: e.slot }));
        add(slotAnchor({ playerId: e.playerId, slot: e.slot }), DISCARD, e.discarded);
        break;
      case 'discardedDrawn':
        add(DRAWN, DISCARD, e.card);
        break;
      case 'tookDiscard':
        add(DISCARD, slotAnchor({ playerId: e.playerId, slot: e.slot }), e.card);
        add(slotAnchor({ playerId: e.playerId, slot: e.slot }), DISCARD, e.discarded);
        break;
      case 'cardsSwapped':
        add(slotAnchor(e.a), slotAnchor(e.b));
        add(slotAnchor(e.b), slotAnchor(e.a));
        break;
      case 'snapSucceeded':
        add(slotAnchor(e.target), DISCARD, e.card);
        break;
      case 'snapFailed': {
        const slots = update.view.players.find((p) => p.id === e.snapperId)?.slots.length ?? 0;
        for (let i = slots - e.penaltyCards; i < slots; i++) {
          add(DECK, slotAnchor({ playerId: e.snapperId, slot: i }));
          t += STEP / 2;
        }
        break;
      }
      case 'cardGiven':
        add(slotAnchor(e.from), slotAnchor(e.to));
        break;
      default:
        continue;
    }
    t += STEP;
  }
  return plans;
}

/**
 * Plant Flug-Animationen für jedes neue Spiel-Update. Ausgangspunkte stammen
 * aus dem Layout vor dem Update, Ziele aus dem neuen Layout. Zielkarten sind
 * versteckt, bis die fliegende Karte gelandet ist.
 */
export function useFlights(update: GameUpdate | null) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const previousRects = useRef(new Map<string, DOMRect>());
  const processed = useRef<GameUpdate | null>(null);
  const nextId = useRef(0);

  const remove = useCallback((id: number) => {
    setFlights((f) => f.filter((flight) => flight.id !== id));
  }, []);

  useLayoutEffect(() => {
    if (!update || processed.current === update) return;
    processed.current = update;
    // Unsichtbare Tabs animieren nicht – dort sofort den Endzustand zeigen.
    if (document.visibilityState === 'hidden') return;
    const current = measureAnchors();
    const planned: Flight[] = [];
    for (const plan of planFlights(update)) {
      const fromRect = previousRects.current.get(plan.from) ?? current.get(plan.from);
      const toRect = current.get(plan.to) ?? previousRects.current.get(plan.to);
      if (fromRect && toRect) planned.push({ ...plan, id: nextId.current++, fromRect, toRect });
    }
    // Messen nach dem Layout und dann rendern ist hier der Zweck des Effekts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (planned.length) setFlights((f) => [...f, ...planned]);
  }, [update]);

  // Nach jedem Rendern merken, wo alles liegt (Ausgangspunkt für das nächste Update).
  useLayoutEffect(() => {
    previousRects.current = measureAnchors();
  });

  const hidden = useMemo(() => new Set(flights.map((f) => f.to)), [flights]);

  const layer = (
    <div className="flight-layer" aria-hidden>
      {flights.map((f) => (
        <FlightCard key={f.id} flight={f} onDone={remove} />
      ))}
    </div>
  );

  return { hidden, layer };
}

/** Eine fliegende Karte; animiert per Web Animations API von Start- zu Zielposition. */
function FlightCard({ flight, onDone }: { flight: Flight; onDone: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const frame = (r: DOMRect) => ({
      transform: `translate(${r.left}px, ${r.top}px)`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    const animation = el.animate([frame(flight.fromRect), frame(flight.toRect)], {
      duration: DURATION * 1000,
      delay: flight.delay * 1000,
      easing: 'ease-in-out',
      fill: 'both',
    });
    animation.onfinish = () => onDone(flight.id);
    // Sicherheitsnetz: Die Karte verschwindet auch, wenn die Animation nicht läuft
    // (z. B. Tab im Hintergrund) – sonst bliebe die Zielkarte versteckt.
    const fallback = setTimeout(
      () => onDone(flight.id),
      (flight.delay + DURATION) * 1000 + FLIGHT_GRACE_MS,
    );
    return () => {
      clearTimeout(fallback);
      animation.cancel();
    };
  }, [flight, onDone]);

  return (
    <div ref={ref} className="card card--flying">
      {flight.card ? <CardFace card={flight.card} /> : <CardBack />}
    </div>
  );
}
