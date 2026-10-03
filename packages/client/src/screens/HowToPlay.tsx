import { useEffect, useRef } from 'react';
import { DEFAULT_SETTINGS, cardValue, type Card } from '@cambio/shared';

const c = (rank: Extract<Card, { kind: 'standard' }>['rank'], suit: 'hearts' | 'spades'): Card => ({
  id: '',
  kind: 'standard',
  rank,
  suit,
});

/** Kartenwerte direkt aus der Spiellogik, damit die Anleitung nie veraltet. */
const VALUES: [string, number | string][] = [
  ['Joker', cardValue({ id: '', kind: 'joker' })],
  ['Ass', cardValue(c('A', 'spades'))],
  ['2 bis 10', 'Augenzahl'],
  ['Bube, Dame', cardValue(c('J', 'spades'))],
  ['König rot (♥ ♦)', cardValue(c('K', 'hearts'))],
  ['König schwarz (♠ ♣)', cardValue(c('K', 'spades'))],
];

const D = DEFAULT_SETTINGS;

/** Spielanleitung als modales Fenster. */
export function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="how-to-play-title"
      onClose={onClose}
      // Klick auf den abgedunkelten Hintergrund schließt das Fenster.
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="dialog__body">
        <header className="dialog__header">
          <h1 id="how-to-play-title">So wird gespielt</h1>
          <button type="button" className="link-button" onClick={onClose}>
            Schließen
          </button>
        </header>

        <section>
          <h2>Ziel</h2>
          <p>
            Am Ende einer Partie möglichst <strong>wenige Punkte</strong> vor dir liegen haben. Das
            Problem: Deine Karten liegen verdeckt – du musst dir merken, was wo liegt.
          </p>
        </section>

        <section>
          <h2>Kartenwerte</h2>
          <table className="dialog__table">
            <tbody>
              {VALUES.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Start</h2>
          <p>
            Jeder bekommt 4 verdeckte Karten im Quadrat. Zu Beginn siehst du deine{' '}
            <strong>beiden unteren Karten</strong> für ein paar Sekunden – merk sie dir. Karten
            bleiben immer an ihrem Platz, du darfst sie nicht umsortieren.
          </p>
        </section>

        <section>
          <h2>Dein Zug</h2>
          <p>Du machst genau eins davon:</p>
          <ul>
            <li>
              <strong>Vom Stapel ziehen.</strong> Nur du siehst die Karte. Tausche sie gegen eine
              deiner Karten (die alte kommt offen auf die Ablage) – oder lege sie direkt ab.
            </li>
            <li>
              <strong>Die offene Karte der Ablage nehmen.</strong> Sie muss gegen eine deiner Karten
              getauscht werden.
            </li>
            <li>
              <strong>„Cambio“ rufen</strong> – siehe unten.
            </li>
          </ul>
        </section>

        <section>
          <h2>Aktionskarten</h2>
          <p>
            Ziehst du eine dieser Karten vom Stapel und legst sie <strong>direkt ab</strong>, darfst
            du ihre Fähigkeit nutzen (musst aber nicht):
          </p>
          <table className="dialog__table">
            <tbody>
              <tr>
                <td>7, 8</td>
                <td>Eine eigene Karte ansehen</td>
              </tr>
              <tr>
                <td>9, 10</td>
                <td>Eine Karte eines Gegners ansehen</td>
              </tr>
              <tr>
                <td>Bube, Dame</td>
                <td>Zwei Karten verschiedener Spieler blind tauschen – auch zwei fremde</td>
              </tr>
              <tr>
                <td>König schwarz</td>
                <td>Eine beliebige Karte ansehen, danach optional zwei Karten tauschen</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Abwerfen</h2>
          <p>
            Sobald eine Karte auf die Ablage kommt, ist kurz ({D.snapWindow} Sekunden) das{' '}
            <strong>Abwurf-Fenster</strong> offen. Jetzt darf <strong>jeder</strong> eine verdeckte
            Karte mit dem <strong>gleichen Rang</strong> abwerfen – eine eigene oder die eines
            Gegners. Roter und schwarzer König zählen als gleicher Rang, Joker passt nur auf Joker.
            Nur der schnellste richtige Abwurf zählt.
          </p>
          <ul>
            <li>Eigene Karte richtig: Sie ist weg – eine Karte weniger.</li>
            <li>Fremde Karte richtig: Sie ist weg, und du gibst dem Spieler eine deiner Karten.</li>
            <li>
              Falsch: Die Karte bleibt liegen und du ziehst Strafkarten – beim 1. Fehler eine, beim
              2. Fehler zwei, beim 3. Fehler drei … (pro Partie).
            </li>
          </ul>
        </section>

        <section>
          <h2>Cambio</h2>
          <p>
            Glaubst du, die wenigsten Punkte zu haben, rufst du zu Beginn deines Zugs{' '}
            <strong>„Cambio“</strong> (frühestens ab dem {D.cambioFromLap}. Umlauf). Alle anderen
            haben noch genau einen Zug, deine Karten sind dabei gesperrt. Danach wird aufgedeckt.
            Hast du keine Karten mehr, musst du Cambio rufen.
          </p>
        </section>

        <section>
          <h2>Wertung</h2>
          <ul>
            <li>
              <strong>Einzelspiel:</strong> Die niedrigste Summe gewinnt. Hat jemand gleich viel
              oder weniger als der Rufer, verliert der Rufer.
            </li>
            <li>
              <strong>Punktemodus:</strong> Die Summen werden über mehrere Partien addiert. Hat
              jemand echt weniger als der Rufer, bekommt der Rufer {D.callerPenalty} Strafpunkte. Am
              Ende gewinnt, wer insgesamt die wenigsten Punkte hat.
            </li>
          </ul>
        </section>

        <section>
          <h2>Bedienung</h2>
          <ul>
            <li>Gelb umrandete Karten kannst du gerade anklicken.</li>
            <li>
              <strong>Ziehen:</strong> Stapel anklicken. Dann eine eigene Karte anklicken zum
              Tauschen – oder die Ablage bzw. „Ablegen“ zum Ablegen.
            </li>
            <li>
              <strong>Offene Karte nehmen:</strong> Ablage anklicken, dann die eigene Karte, die du
              dafür hergibst.
            </li>
            <li>
              <strong>Fähigkeiten:</strong> Zielkarte anklicken; zum Tauschen zwei Karten
              nacheinander. Mit „Überspringen“ lässt du die Fähigkeit aus.
            </li>
            <li>
              <strong>Abwerfen:</strong> Karte anklicken oder auf die Ablage ziehen – das stellst du
              in der Lobby unter „Deine Bedienung“ ein.
            </li>
            <li>
              <strong>Hilfe:</strong> Oben rechts am Tisch blendest du eine Kartenübersicht mit
              Werten und Fähigkeiten ein oder aus.
            </li>
            <li>Der Balken unter der Tischmitte zeigt die verbleibende Zeit.</li>
            <li>Verbindung weg oder Seite neu geladen? Einfach neu laden – du bist wieder drin.</li>
          </ul>
          <p className="muted">
            Zeiten, Strafpunkte und den Cambio-Umlauf kann der Host in der Lobby ändern. Hier stehen
            die Standardwerte.
          </p>
        </section>
      </div>
    </dialog>
  );
}
