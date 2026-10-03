import { LEGAL } from './legalInfo';

/*
 * VORLAGE – keine Rechtsberatung. Vor dem Veröffentlichen prüfen (lassen),
 * z. B. mit einem Generator wie dem von eRecht24 oder durch eine Fachperson.
 * Inhalte beschreiben den aktuellen technischen Stand (siehe docs/STRUCTURE.md).
 */

export const LEGAL_PATHS = { imprint: '/impressum', privacy: '/datenschutz' } as const;

function Address() {
  return (
    <p>
      {LEGAL.name}
      <br />
      {LEGAL.street}
      <br />
      {LEGAL.city}
      <br />
      E-Mail: {LEGAL.email}
    </p>
  );
}

function Draft() {
  if (LEGAL.published) return null;
  return (
    <p className="legal__draft">
      Entwurf – noch nicht veröffentlicht. Angaben in <code>legal/legalInfo.ts</code> ausfüllen.
    </p>
  );
}

export function Imprint() {
  return (
    <main className="page page--narrow legal">
      <a href="/" className="link-button">
        Zurück
      </a>
      <h1 className="title">Impressum</h1>
      <Draft />

      <h2>Angaben gemäß § 5 DDG</h2>
      <Address />

      <h2>Hinweis</h2>
      <p>
        Cambio Online ist ein privates, nicht-kommerzielles Hobbyprojekt. Es werden keine Waren oder
        Dienstleistungen gegen Entgelt angeboten.
      </p>
    </main>
  );
}

export function Privacy() {
  return (
    <main className="page page--narrow legal">
      <a href="/" className="link-button">
        Zurück
      </a>
      <h1 className="title">Datenschutzerklärung</h1>
      <Draft />

      <h2>1. Verantwortlicher</h2>
      <Address />

      <h2>2. Überblick</h2>
      <p>
        Cambio Online ist ein Kartenspiel im Browser. Es gibt keine Benutzerkonten, keine Werbung,
        kein Tracking und keine Cookies. Es werden nur die Daten verarbeitet, die für das Spielen
        technisch nötig sind.
      </p>

      <h2>3. Hosting und Server-Logs</h2>
      <p>
        Die Seite wird bei Render Services, Inc., San Francisco, USA gehostet. Der Server steht in
        Frankfurt am Main. Beim Aufruf der Seite verarbeitet der Hoster technisch notwendige Daten,
        insbesondere IP-Adresse, Zeitpunkt, aufgerufene Adresse und Browserkennung, um die Seite
        auszuliefern und vor Angriffen zu schützen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
        (berechtigtes Interesse am sicheren Betrieb). Da Render ein US-Unternehmen ist, kann eine
        Übermittlung in die USA nicht ausgeschlossen werden; sie erfolgt auf Grundlage von
        [Standardvertragsklauseln / EU-US Data Privacy Framework – prüfen]. Mit Render besteht ein
        Vertrag zur Auftragsverarbeitung (Data Processing Addendum).
      </p>

      <h2>4. Spieldaten</h2>
      <p>
        Für ein Spiel gibst du einen frei wählbaren Namen ein. Name, Raumcode und Spielverlauf
        werden nur im Arbeitsspeicher des Servers gehalten und nicht dauerhaft gespeichert. Sie
        werden gelöscht, sobald der Raum leer ist (spätestens rund 10 Minuten, nachdem der letzte
        Spieler gegangen ist) oder der Server neu startet. Die anderen Spieler im Raum sehen deinen
        Namen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Spiels).
      </p>

      <h2>5. Speicher im Browser</h2>
      <p>
        Das Spiel speichert in deinem Browser deinen zuletzt verwendeten Namen (Local Storage) und
        die Zugangsdaten zum aktuellen Raum, damit du nach dem Neuladen weiterspielen kannst
        (Session Storage, wird beim Schließen des Tabs gelöscht). Diese Speicherung ist für den
        ausdrücklich gewünschten Dienst unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Du kannst
        sie jederzeit über die Einstellungen deines Browsers löschen.
      </p>

      <h2>6. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
        Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie das Recht, dich bei einer
        Datenschutz-Aufsichtsbehörde zu beschweren. Wende dich dazu an die oben genannte
        E-Mail-Adresse.
      </p>

      <p className="muted">Stand: {LEGAL.privacyDate}</p>
    </main>
  );
}

/** Kleine Fußzeile mit Links – erscheint erst, wenn die Angaben veröffentlicht sind. */
export function LegalFooter() {
  if (!LEGAL.published) return null;
  return (
    <footer className="legal-footer">
      <a href={LEGAL_PATHS.imprint}>Impressum</a>
      <a href={LEGAL_PATHS.privacy}>Datenschutz</a>
    </footer>
  );
}
