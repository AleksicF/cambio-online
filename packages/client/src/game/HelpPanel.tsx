import { abilityOf, cardValue, type Card } from '@cambio/shared';
import { ABILITY_LABEL } from './interaction';

const card = (rank: Extract<Card, { kind: 'standard' }>['rank'], red = false): Card => ({
  id: '',
  kind: 'standard',
  rank,
  suit: red ? 'hearts' : 'spades',
});

/**
 * Übersichtszeilen. Werte und Fähigkeiten werden aus der Spiellogik berechnet,
 * damit die Hilfe nach Regeländerungen automatisch stimmt.
 */
const ROWS: { label: string; sample: Card; value?: string }[] = [
  { label: 'Joker', sample: { id: '', kind: 'joker' } },
  { label: 'Ass', sample: card('A') },
  { label: '2 – 6', sample: card('2'), value: 'Augenzahl' },
  { label: '7, 8', sample: card('7'), value: '7, 8' },
  { label: '9, 10', sample: card('9'), value: '9, 10' },
  { label: 'Bube, Dame', sample: card('J') },
  { label: 'König ♥ ♦', sample: card('K', true) },
  { label: 'König ♠ ♣', sample: card('K') },
];

/** Kompakte Kartenübersicht am Spieltisch – ein- und ausschaltbar. */
export function HelpPanel() {
  return (
    <section className="help" aria-label="Kartenübersicht">
      <table className="help__table">
        <thead>
          <tr>
            <th>Karte</th>
            <th>Punkte</th>
            <th>Fähigkeit</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ label, sample, value }) => {
            const ability = abilityOf(sample);
            return (
              <tr key={label}>
                <td>{label}</td>
                <td>{value ?? cardValue(sample)}</td>
                <td>{ability ? ABILITY_LABEL[ability] : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="help__note">
        Fähigkeiten gelten nur, wenn du die Karte vom Stapel ziehst und direkt ablegst.
      </p>
    </section>
  );
}

/** Kurzinfo zu einer offenen Karte, z. B. „10 Punkte · Blind tauschen“. */
export function cardHint(c: Card, withAbility: boolean): string {
  const value = cardValue(c);
  const points = `${value} ${Math.abs(value) === 1 ? 'Punkt' : 'Punkte'}`;
  const ability = withAbility ? abilityOf(c) : null;
  return ability ? `${points} · ${ABILITY_LABEL[ability]}` : points;
}
