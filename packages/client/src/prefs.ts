import { useSyncExternalStore } from 'react';

/**
 * Persönliche Einstellungen, gespeichert im Browser (Local Storage).
 * Sie gelten nur für diesen Spieler und werden nicht an den Server geschickt.
 */
function createPref<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const listeners = new Set<() => void>();

  let value: T = fallback;
  try {
    const stored = localStorage.getItem(key);
    if (allowed.includes(stored as T)) value = stored as T;
  } catch {
    // Speicher nicht verfügbar – Standardwert verwenden.
  }

  function set(next: T) {
    value = next;
    try {
      localStorage.setItem(key, next);
    } catch {
      // Speicher nicht verfügbar – gilt dann nur bis zum Neuladen.
    }
    for (const l of listeners) l();
  }

  function use(): T {
    return useSyncExternalStore(
      (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      () => value,
    );
  }

  return { set, use };
}

/** Steuerung: Abwerfen per Ziehen (Rest klicken, Standard) oder alles per Klick. */
export type SnapMode = 'click' | 'drag';
const snapMode = createPref<SnapMode>('cambio.snapMode', ['click', 'drag'], 'drag');
export const useSnapMode = snapMode.use;
export const setSnapMode = snapMode.set;

/** Hilfe am Spieltisch (Kartenwerte und Fähigkeiten). Standard: an. */
const help = createPref<'on' | 'off'>('cambio.help', ['on', 'off'], 'on');
export const useShowHelp = () => help.use() === 'on';
export const setShowHelp = (show: boolean) => help.set(show ? 'on' : 'off');
