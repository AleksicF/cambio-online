import { useState } from 'react';
import type { PlayerView, RoomView } from '@cambio/shared';
import { api, type Response } from '../net/store';
import { errorText } from '../net/errors';

/** Auswertung nach einer Partie bzw. am Spielende. */
export function Results({ view, room }: { view: PlayerView; room: RoomView }) {
  const [error, setError] = useState<string | null>(null);
  const phase = view.phase;
  if (phase.type !== 'partieEnd' && phase.type !== 'gameEnd') return null;

  const { result } = phase;
  const isHost = room.hostId === view.me;
  const points = view.settings.mode === 'points';
  const gameOver = phase.type === 'gameEnd';
  const winners = gameOver ? phase.winners : result.winners;
  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? '?';
  const caller = name(result.callerId);

  const winnerText =
    winners.length === 1
      ? winners[0] === view.me
        ? 'Du gewinnst!'
        : `${name(winners[0]!)} gewinnt.`
      : `Geteilter Sieg: ${winners.map(name).join(', ')}.`;

  const callerText = points
    ? result.callerFailed
      ? `${caller} hat Cambio gerufen und bekommt ${view.settings.callerPenalty} Strafpunkte.`
      : `${caller} hat Cambio gerufen.`
    : result.callerFailed
      ? `${caller} hat Cambio gerufen und verliert.`
      : `${caller} hat Cambio gerufen.`;

  async function run(fn: () => Promise<Response>) {
    setError(null);
    const r = await fn();
    if (!r.ok) setError(errorText(r.error));
  }

  const sorted = [...view.players].sort((a, b) =>
    gameOver && points ? a.totalScore - b.totalScore : result.points[a.id]! - result.points[b.id]!,
  );

  return (
    <section className="results">
      <h2>{gameOver ? 'Spielende' : `Partie ${result.partieNumber} vorbei`}</h2>
      <p className="results__winner">{winnerText}</p>
      <p className="muted">{callerText}</p>

      <table className="results__table">
        <thead>
          <tr>
            <th>Spieler</th>
            <th>Karten</th>
            {points && <th>Punkte</th>}
            {points && <th>Gesamt</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} className={winners.includes(p.id) ? 'is-winner' : undefined}>
              <td>{p.name}</td>
              <td>{result.sums[p.id]}</td>
              {points && <td>{result.points[p.id]}</td>}
              {points && <td>{p.totalScore}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p className="error">{error}</p>}

      {isHost ? (
        <div className="row row--end">
          {gameOver ? (
            <button
              type="button"
              className="button button--primary"
              onClick={() => void run(api.backToLobby)}
            >
              Zurück zur Lobby
            </button>
          ) : (
            <button
              type="button"
              className="button button--primary"
              onClick={() => void run(api.nextPartie)}
            >
              Nächste Partie
            </button>
          )}
        </div>
      ) : (
        <p className="muted">Warte auf den Host …</p>
      )}
    </section>
  );
}
