import { useEffect, useRef, useState } from 'react';
import type { SlotRef } from '@cambio/shared';
import { CardBack } from '../cards/CardView';
import { DISCARD, slotAnchor } from './anchors';

/** Toleranz um die Ablage herum, damit das Treffen auch am Handy leicht fällt. */
const DROP_MARGIN = 20;

interface Drag {
  /** Zu welchem Abwurf-Fenster das Ziehen gehört. */
  windowKey: string;
  ref: SlotRef;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
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
 * `windowKey` identifiziert das offene Abwurf-Fenster (`null` = keins). Endet
 * das Fenster, verfällt ein laufendes Ziehen automatisch.
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
      setDrag((d) =>
        d
          ? { ...d, x: e.clientX, y: e.clientY, overDiscard: isOverDiscard(e.clientX, e.clientY) }
          : d,
      );
    const up = (e: PointerEvent) => {
      const d = latest.current;
      setDrag(null);
      if (d && isOverDiscard(e.clientX, e.clientY)) onDropRef.current(d.ref);
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
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    setDrag({
      windowKey,
      ref,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - r.left,
      offsetY: e.clientY - r.top,
      width: r.width,
      height: r.height,
      overDiscard: false,
    });
  }

  const ghost = current && (
    <div
      className="card card--dragging"
      aria-hidden
      style={{
        width: current.width,
        height: current.height,
        transform: `translate(${current.x - current.offsetX}px, ${current.y - current.offsetY}px)`,
      }}
    >
      <CardBack />
    </div>
  );

  return { start, dragging: current, ghost };
}
