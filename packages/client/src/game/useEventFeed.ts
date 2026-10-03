import { useEffect, useRef, useState } from 'react';
import type { Card, GameUpdate, PlayerView } from '@cambio/shared';
import { cardName } from '../cards/cardAssets';
import { slotAnchor } from './anchors';

const MAX_LOG = 6;
const FAILED_SNAP_REVEAL_MS = 1500;
const PEEK_HIGHLIGHT_MS = 1500;

/**
 * Verarbeitet Ereignisse, die nicht im Zustand stehen: kurz aufgedeckte Karten
 * (Anschauen, Fehlwürfe), Hervorhebungen und das Protokoll.
 */
export function useEventFeed(update: GameUpdate | null) {
  const [reveals, setReveals] = useState<Map<string, Card>>(new Map());
  const [highlights, setHighlights] = useState<Set<string>>(new Set());
  const [log, setLog] = useState<string[]>([]);
  const processed = useRef<GameUpdate | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Beim Unmount Timer stoppen und Verarbeitung zurücksetzen – sonst blieben
  // Karten nach einem erneuten Mount (React StrictMode) dauerhaft aufgedeckt.
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      processed.current = null;
    },
    [],
  );

  // Ereignisse sind ein externer Strom: Jedes Update wird genau einmal verarbeitet.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!update || processed.current === update) return;
    processed.current = update;
    const { view, events } = update;
    const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? '?';
    const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

    const reveal = (key: string, card: Card, ms: number) => {
      setReveals((r) => new Map(r).set(key, card));
      later(ms, () =>
        setReveals((r) => {
          if (r.get(key) !== card) return r;
          const next = new Map(r);
          next.delete(key);
          return next;
        }),
      );
    };
    const highlight = (key: string) => {
      setHighlights((h) => new Set(h).add(key));
      later(PEEK_HIGHLIGHT_MS, () =>
        setHighlights((h) => {
          const next = new Set(h);
          next.delete(key);
          return next;
        }),
      );
    };

    const lines: string[] = [];
    const isDeal = events.some((e) => e.type === 'partieStarted');
    const peekMs = view.settings.peekDuration * 1000;

    for (const e of events) {
      switch (e.type) {
        case 'partieStarted':
          lines.push(`Partie ${e.partieNumber} beginnt – ${name(e.startingPlayerId)} startet.`);
          break;
        case 'cardPeeked':
          if (e.card) reveal(slotAnchor(e.target), e.card, peekMs);
          else if (!isDeal) {
            highlight(slotAnchor(e.target));
            lines.push(
              `${name(e.viewerId)} schaut eine Karte von ${ownerText(e.target.playerId, e.viewerId, view)} an.`,
            );
          }
          break;
        case 'tookDiscard':
          lines.push(`${name(e.playerId)} nimmt ${cardName(e.card)} von der Ablage.`);
          break;
        case 'swappedDrawn':
          lines.push(`${name(e.playerId)} tauscht und legt ${cardName(e.discarded)} ab.`);
          break;
        case 'discardedDrawn':
          lines.push(`${name(e.playerId)} legt ${cardName(e.card)} ab.`);
          break;
        case 'cardsSwapped':
          lines.push(
            `${name(e.playerId)} tauscht Karten von ${name(e.a.playerId)} und ${name(e.b.playerId)}.`,
          );
          break;
        case 'snapSucceeded':
          lines.push(
            e.target.playerId === e.snapperId
              ? `${name(e.snapperId)} wirft ${cardName(e.card)} ab.`
              : `${name(e.snapperId)} wirft ${cardName(e.card)} von ${name(e.target.playerId)} ab.`,
          );
          break;
        case 'snapFailed':
          reveal(slotAnchor(e.target), e.card, FAILED_SNAP_REVEAL_MS);
          lines.push(
            `${name(e.snapperId)} liegt daneben (${cardName(e.card)}) – ${e.penaltyCards} Strafkarte${e.penaltyCards === 1 ? '' : 'n'}.`,
          );
          break;
        case 'cardGiven':
          lines.push(`${name(e.from.playerId)} gibt ${name(e.to.playerId)} eine Karte.`);
          break;
        case 'cambioCalled':
          lines.push(`${name(e.playerId)} ruft Cambio!`);
          break;
        case 'deckReshuffled':
          lines.push('Der Ablagestapel wird neu gemischt.');
          break;
        default:
          break;
      }
    }
    if (isDeal) setLog(lines);
    else if (lines.length) setLog((l) => [...lines.reverse(), ...l].slice(0, MAX_LOG));
  }, [update]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { reveals, highlights, log };
}

function ownerText(ownerId: string, viewerId: string, view: PlayerView) {
  if (ownerId === viewerId) return 'sich';
  return view.players.find((p) => p.id === ownerId)?.name ?? '?';
}
