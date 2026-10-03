import { useEffect, useRef, useState } from 'react';
import type { SlotRef } from '@cambio/shared';
import { CardBack } from '../cards/CardView';
import { DISCARD, slotAnchor } from './anchors';

/** Toleranz um die Ablage herum, damit das Treffen auch am Handy leicht fällt. */
const DROP_MARGIN = 20;
/** Ab so vielen Pixeln Bewegung wird aus einem Klick ein Ziehen. */
const DRAG_THRESHOLD = 6;

interface Drag {
  /** Zu welcher Abwurf-Gelegenheit das Ziehen gehört. */
  windowKey: string;
  ref: SlotRef;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  /** Erst nach DRAG_THRESHOLD Pixeln aktiv – vorher ist es (noch) ein Klick. */
  active: boolean;
  overDiscard: boolean;
}

function isOverDiscard(x: number, y: number): boolean {
  const el = document.querySelector(`[data-anchor="${DISCARD}"]`);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return (
    x >= r.left - DROP_MARGIN &&
    x <= r.right + DROP_MARGIN &&
    y >= r.top - DROP_MARGIN &&
    y <= r.bottom + DROP_MARGIN
  );
}

/**
 * Abwerfen per Ziehen: Karte greifen und auf der Ablage loslassen.
 * Läuft über Pointer-Events und funktioniert damit mit Maus und Touch.
 * Ein Klick ohne Bewegung bleibt ein normaler Klick (für Zug-Aktionen).
 * `windowKey` identifiziert die aktuelle Abwurf-Gelegenheit (`null` = keine).
 * Ändert sie sich, verfällt ein laufendes Ziehen automatisch.
 */
export function useSnapDrag(windowKey: string | null, onDrop: (ref: SlotRef) => void) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const current = drag && drag.windowKey === windowKey ? drag : null;
  const onDropRef = useRef(onDrop);
  const latest = useRef<Drag | null>(null);
  useEffect(() => {
    onDropRef.current = onDrop;
    latest.current = current;
  });

  const dragKey = current ? slotAnchor(current.ref) : null;
  useEffect(() => {
    if (!dragKey) return;
    const move = (e: PointerEvent) =>
      setDrag((d) => {
        if (!d) return d;
        const active =
          d.active || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) >= DRAG_THRESHOLD;
        return {
          ...d,
          active,
          x: e.clientX,
          y: e.clientY,
          overDiscard: active && isOverDiscard(e.clientX, e.clientY),
        };
      });
    const up = (e: PointerEvent) => {
      const d = latest.current;
      setDrag(null);
      if (d?.active && isOverDiscard(e.clientX, e.clientY)) onDropRef.current(d.ref);
    };
    const cancel = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [dragKey]);

  function start(ref: SlotRef, e: React.PointerEvent<HTMLElement>) {
    if (!windowKey || e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDrag({
      windowKey,
      ref,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - r.left,
      offsetY: e.clientY - r.top,
      width: r.width,
      height: r.height,
      active: false,
      overDiscard: false,
    });
  }

  const activeDrag = current?.active ? current : null;
  const ghost = activeDrag && (
    <div
      className="card card--dragging"
      aria-hidden
      style={{
        width: activeDrag.width,
        height: activeDrag.height,
        transform: `translate(${activeDrag.x - activeDrag.offsetX}px, ${activeDrag.y - activeDrag.offsetY}px)`,
      }}
    >
      <CardBack />
    </div>
  );

  return { start, dragging: activeDrag, ghost };
}
