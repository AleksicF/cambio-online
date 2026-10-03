import { setShowHelp, setSnapMode, useShowHelp, useSnapMode, type SnapMode } from '../prefs';

const OPTIONS: { value: SnapMode; label: string; hint: string }[] = [
  { value: 'click', label: 'Klicken', hint: 'Karte antippen bzw. anklicken' },
  { value: 'drag', label: 'Ziehen', hint: 'Karte auf die Ablage ziehen und loslassen' },
];

/** Persönliche Einstellungen, gelten nur für diesen Browser. */
export function PersonalSettings() {
  const showHelp = useShowHelp();
  return (
    <>
      <SnapModeSetting />
      <label className="choice__option choice__option--standalone">
        <input type="checkbox" checked={showHelp} onChange={(e) => setShowHelp(e.target.checked)} />
        <span>
          Hilfe am Spieltisch
          <span className="muted"> – Kartenwerte und Fähigkeiten einblenden</span>
        </span>
      </label>
    </>
  );
}

function SnapModeSetting() {
  const mode = useSnapMode();
  return (
    <fieldset className="choice">
      <legend>Abwerfen per</legend>
      {OPTIONS.map((o) => (
        <label key={o.value} className="choice__option">
          <input
            type="radio"
            name="snapMode"
            value={o.value}
            checked={mode === o.value}
            onChange={() => setSnapMode(o.value)}
          />
          <span>
            {o.label}
            <span className="muted"> – {o.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
