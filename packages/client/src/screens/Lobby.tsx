import { useState } from 'react';
import {
  MIN_PLAYERS,
  SETTINGS_LIMITS,
  type GameSettings,
  type RoomView,
  type Session,
} from '@cambio/shared';
import { api, type Response } from '../net/store';
import { errorText } from '../net/errors';
import { HowToPlay } from './HowToPlay';
import { SnapModeSetting } from './SnapModeSetting';

export function Lobby({ room, session }: { room: RoomView; session: Session }) {
  const isHost = room.hostId === session.playerId;
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [showRules, setShowRules] = useState(false);
  const inviteUrl = `${window.location.origin}/?code=${room.code}`;

  async function run(fn: () => Promise<Response>) {
    setError(null);
    const r = await fn();
    if (!r.ok) setError(errorText(r.error));
  }

  async function copy(what: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(what === 'code' ? room.code : inviteUrl);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Konnte nicht in die Zwischenablage kopiert werden.');
    }
  }

  return (
    <main className="page page--narrow">
      <header className="lobby-header">
        <div>
          <p className="muted">Raumcode</p>
          <p className="room-code">{room.code}</p>
        </div>
        <div className="lobby-header__actions">
          <button type="button" className="button" onClick={() => void copy('code')}>
            {copied === 'code' ? 'Kopiert' : 'Code kopieren'}
          </button>
          <button type="button" className="button" onClick={() => void copy('link')}>
            {copied === 'link' ? 'Kopiert' : 'Link kopieren'}
          </button>
        </div>
      </header>

      <section className="section">
        <h2>
          Spieler ({room.players.length}/{room.settings.maxPlayers})
        </h2>
        <ul className="player-list">
          {room.players.map((p) => (
            <li key={p.id}>
              <span>
                {p.name}
                {p.id === session.playerId && <span className="muted"> (du)</span>}
                {p.id === room.hostId && <span className="tag">Host</span>}
                {!p.connected && <span className="tag tag--muted">getrennt</span>}
              </span>
              {isHost && p.id !== session.playerId && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => void run(() => api.kick(p.id))}
                >
                  Entfernen
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>Einstellungen</h2>
        {!isHost && <p className="muted">Nur der Host kann die Einstellungen ändern.</p>}
        <SettingsForm
          settings={room.settings}
          disabled={!isHost}
          onChange={(patch) => void run(() => api.updateSettings(patch))}
        />
      </section>

      <section className="section">
        <h2>Deine Bedienung</h2>
        <SnapModeSetting />
      </section>

      {error && <p className="error">{error}</p>}

      <div className="row row--end">
        <button type="button" className="link-button" onClick={() => setShowRules(true)}>
          So wird gespielt
        </button>
        <button type="button" className="button" onClick={() => void api.leaveRoom()}>
          Verlassen
        </button>
        {isHost ? (
          <button
            type="button"
            className="button button--primary"
            disabled={room.players.length < MIN_PLAYERS}
            onClick={() => void run(api.startGame)}
          >
            Spiel starten
          </button>
        ) : (
          <p className="muted">Warte auf den Host …</p>
        )}
      </div>
      <HowToPlay open={showRules} onClose={() => setShowRules(false)} />
    </main>
  );
}

type NumberKey = keyof typeof SETTINGS_LIMITS;

function SettingsForm({
  settings,
  disabled,
  onChange,
}: {
  settings: GameSettings;
  disabled: boolean;
  onChange: (patch: Partial<GameSettings>) => void;
}) {
  const number = (key: NumberKey, label: string, unit?: string) => (
    <NumberSetting
      key={key}
      label={label}
      unit={unit}
      value={settings[key] ?? SETTINGS_LIMITS[key].min}
      limits={SETTINGS_LIMITS[key]}
      disabled={disabled}
      onCommit={(value) => onChange({ [key]: value })}
    />
  );

  return (
    <div className="settings">
      <label className="setting">
        <span>Spielmodus</span>
        <select
          value={settings.mode}
          disabled={disabled}
          onChange={(e) => onChange({ mode: e.target.value as GameSettings['mode'] })}
        >
          <option value="single">Einzelspiel</option>
          <option value="points">Punktemodus</option>
        </select>
      </label>

      {settings.mode === 'points' && (
        <>
          <label className="setting">
            <span>Spielende</span>
            <select
              value={settings.endCondition}
              disabled={disabled}
              onChange={(e) =>
                onChange({ endCondition: e.target.value as GameSettings['endCondition'] })
              }
            >
              <option value="pointLimit">bei Punktegrenze</option>
              <option value="rounds">nach Anzahl Partien</option>
            </select>
          </label>
          {settings.endCondition === 'rounds'
            ? number('roundCount', 'Anzahl Partien')
            : number('pointLimit', 'Punktegrenze', 'Punkte')}
          {number('callerPenalty', 'Strafpunkte für Rufer', 'Punkte')}
        </>
      )}

      <label className="setting">
        <span>Zeitlimit pro Zug</span>
        <span className="setting__control">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.turnTimeLimit !== null}
              disabled={disabled}
              onChange={(e) => onChange({ turnTimeLimit: e.target.checked ? 30 : null })}
            />
            an
          </label>
        </span>
      </label>
      {settings.turnTimeLimit !== null && number('turnTimeLimit', 'Sekunden pro Zug', 's')}
      {number('snapWindow', 'Abwurf-Fenster', 's')}
      {number('peekDuration', 'Anschauzeit', 's')}
      {number('cambioFromLap', 'Cambio ab Umlauf')}
      {number('maxPlayers', 'Max. Spieler')}
    </div>
  );
}

/** Zahlenfeld, das erst beim Verlassen oder mit Enter speichert. */
function NumberSetting({
  label,
  unit,
  value,
  limits,
  disabled,
  onCommit,
}: {
  label: string;
  unit?: string;
  value: number;
  limits: { min: number; max: number };
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const parsed = Number(draft);
    setDraft(null);
    if (draft.trim() !== '' && Number.isFinite(parsed) && parsed !== value) onCommit(parsed);
  }

  return (
    <label className="setting">
      <span>{label}</span>
      <span className="setting__control">
        <input
          type="number"
          min={limits.min}
          max={limits.max}
          value={draft ?? value}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <span className="setting__unit muted">{unit}</span>
      </span>
    </label>
  );
}
