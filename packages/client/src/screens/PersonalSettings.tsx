import { setShowHelp, setSnapMode, useShowHelp, useSnapMode, type SnapMode } from '../prefs';

const OPTIONS: { value: SnapMode; label: string; hint: string }[] = [
  {
    value: 'drag',
    label: 'Abwerfen ziehen, Rest klicken',
    hint: 'Karte zum Abwerfen auf die Ablage ziehen (Standard)',
  },
  { value: 'click', label: 'Alles klicken', hint: 'auch zum Abwerfen die Karte anklicken' },
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
      <legend>Steuerung</legend>
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
