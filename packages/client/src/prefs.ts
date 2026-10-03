import { useSyncExternalStore } from 'react';

/** Persönliche Bedienung: Abwerfen per Klick oder per Ziehen auf die Ablage. */
export type SnapMode = 'click' | 'drag';

const SNAP_MODE_KEY = 'cambio.snapMode';
const listeners = new Set<() => void>();

function readSnapMode(): SnapMode {
  try {
    return localStorage.getItem(SNAP_MODE_KEY) === 'drag' ? 'drag' : 'click';
  } catch {
    return 'click';
  }
}

let snapMode = readSnapMode();

export function setSnapMode(mode: SnapMode) {
  snapMode = mode;
  try {
    localStorage.setItem(SNAP_MODE_KEY, mode);
  } catch {
    // Speicher nicht verfügbar – gilt dann nur bis zum Neuladen.
  }
  for (const l of listeners) l();
}

export function useSnapMode(): SnapMode {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapMode,
  );
}
