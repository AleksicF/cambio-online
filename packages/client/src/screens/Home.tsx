import { useState, type FormEvent } from 'react';
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH } from '@cambio/shared';
import { api, loadName, type Response } from '../net/store';
import { errorText } from '../net/errors';

function codeFromUrl(): string {
  return new URLSearchParams(window.location.search).get('code')?.toUpperCase() ?? '';
}

export function Home({ kicked }: { kicked: boolean }) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(codeFromUrl);
  const [error, setError] = useState<string | null>(
    kicked ? 'Du wurdest aus dem Raum entfernt.' : null,
  );
  const [busy, setBusy] = useState(false);
  const invited = codeFromUrl() !== '';

  async function run(fn: () => Promise<Response>) {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError(errorText(r.error));
  }

  function onJoin(e: FormEvent) {
    e.preventDefault();
    void run(() => api.joinRoom(code, name));
  }

  return (
    <main className="page page--narrow">
      <h1 className="title">Cambio</h1>
      <p className="muted">Kartenspiel für 2–6 Spieler.</p>

      <form className="stack" onSubmit={onJoin}>
        <label className="field">
          <span>Dein Name</span>
          <input
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!name}
            autoComplete="nickname"
          />
        </label>

        <div className="row">
          <label className="field field--grow">
            <span>Raumcode</span>
            <input
              value={code}
              maxLength={ROOM_CODE_LENGTH}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="input--code"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className={invited ? 'button button--primary' : 'button'}
            disabled={busy || !name.trim() || code.length !== ROOM_CODE_LENGTH}
          >
            Beitreten
          </button>
        </div>
      </form>

      <div className="divider">oder</div>

      <button
        type="button"
        className={invited ? 'button' : 'button button--primary'}
        disabled={busy || !name.trim()}
        onClick={() => void run(() => api.createRoom(name))}
      >
        Neuen Raum erstellen
      </button>

      {error && <p className="error">{error}</p>}
    </main>
  );
}
