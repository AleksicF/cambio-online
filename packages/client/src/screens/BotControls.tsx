import { useState } from 'react';
import {
  BOT_DIFFICULTIES,
  BOT_DIFFICULTY_LABEL,
  BOT_PROFILES,
  type BotDifficulty,
  type BotProfile,
} from '@cambio/shared';

const percent = (value: number) => `${Math.round(value * 100)} %`;
const seconds = ([min, max]: [number, number]) =>
  `${(min / 1000).toLocaleString('de-DE')}–${(max / 1000).toLocaleString('de-DE')} s`;

/** Erklärung der Stufen – direkt aus den Bot-Profilen, damit sie immer stimmt. */
const ROWS: { label: string; value: (p: BotProfile) => string }[] = [
  { label: 'Merkt sich gesehene Karten', value: (p) => percent(p.memory) },
  { label: 'Vergisst je Zug eine gemerkte Karte', value: (p) => percent(p.forgetPerTurn) },
  { label: 'Verfolgt getauschte Karten', value: (p) => (p.trackSwaps ? 'ja' : 'nein') },
  { label: 'Wirft eigene passende Karten ab', value: (p) => percent(p.snapOwn) },
  { label: 'Wirft fremde passende Karten ab', value: (p) => percent(p.snapForeign) },
  { label: 'Reaktionszeit beim Abwerfen', value: (p) => seconds(p.snapDelayMs) },
  { label: 'Bedenkzeit pro Schritt', value: (p) => seconds(p.thinkMs) },
  { label: 'Nutzt Fähigkeiten', value: (p) => percent(p.useAbility) },
];

export function BotDifficultySelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: BotDifficulty;
  onChange: (difficulty: BotDifficulty) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(e.target.value as BotDifficulty)}
    >
      {BOT_DIFFICULTIES.map((d) => (
        <option key={d} value={d}>
          {BOT_DIFFICULTY_LABEL[d]}
        </option>
      ))}
    </select>
  );
}

/** Bot hinzufügen (nur Host) und Erklärung der Schwierigkeitsstufen. */
export function BotControls({
  canAdd,
  onAdd,
}: {
  canAdd: boolean;
  onAdd: (difficulty: BotDifficulty) => void;
}) {
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');
  return (
    <div className="bots">
      <div className="row">
        <BotDifficultySelect
          value={difficulty}
          onChange={setDifficulty}
          label="Schwierigkeit des neuen Bots"
        />
        <button
          type="button"
          className="button"
          disabled={!canAdd}
          onClick={() => onAdd(difficulty)}
        >
          Bot hinzufügen
        </button>
      </div>

      <details className="bots__info">
        <summary>Was bedeuten die Stufen?</summary>
        <table className="dialog__table">
          <thead>
            <tr>
              <th />
              {BOT_DIFFICULTIES.map((d) => (
                <th key={d}>{BOT_DIFFICULTY_LABEL[d]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                {BOT_DIFFICULTIES.map((d) => (
                  <td key={d}>{row.value(BOT_PROFILES[d])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">
          Bots sehen nur, was ein Mensch an ihrer Stelle sehen würde – sie schummeln nicht.
        </p>
      </details>
    </div>
  );
}
