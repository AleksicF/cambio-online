/**
 * Angaben für Impressum und Datenschutzerklärung.
 *
 * Solange `published` auf `false` steht, sind die Seiten zwar unter
 * /impressum und /datenschutz erreichbar (zur Vorschau), aber nirgends verlinkt.
 * Zum Veröffentlichen: alle Felder in eckigen Klammern ausfüllen, die Texte in
 * LegalPages.tsx prüfen (lassen) und `published` auf `true` setzen.
 */
export const LEGAL = {
  published: false,
  name: '[Vor- und Nachname]',
  street: '[Straße und Hausnummer]',
  city: '[PLZ und Ort]',
  email: '[E-Mail-Adresse]',
  /** Stand der Datenschutzerklärung. */
  privacyDate: '[Monat Jahr]',
};
