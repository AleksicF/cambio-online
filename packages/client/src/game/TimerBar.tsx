import { useEffect, useRef } from 'react';

/** Schmaler Balken, der bis zur Deadline abläuft. Läuft per CSS-Transition. */
export function TimerBar({ deadline }: { deadline: number | null }) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bar.current;
    if (!el || deadline === null) return;
    const remaining = Math.max(0, deadline - Date.now());
    el.style.transition = 'none';
    el.style.transform = 'scaleX(1)';
    // Reflow erzwingen, damit die Transition vom vollen Balken startet.
    void el.offsetWidth;
    el.style.transition = `transform ${remaining}ms linear`;
    el.style.transform = 'scaleX(0)';
  }, [deadline]);

  return (
    <div className="timer" aria-hidden>
      {deadline !== null && <div ref={bar} className="timer__bar" />}
    </div>
  );
}
