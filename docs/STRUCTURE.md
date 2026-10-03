# Projektstruktur – was liegt wo?

Diese Datei erklärt jeden Ordner und jede wichtige Datei und zeigt, wo du was
änderst. Sie wird bei jeder Strukturänderung mit aktualisiert.

## Überblick

Das Projekt besteht aus drei Paketen, die zusammenarbeiten:

```
Browser (client)  ⇄  Internet / Socket.IO  ⇄  Server (server)
        └──────────── nutzen beide ───────────┘
                     Spiellogik (shared)
```

- **shared**: die Spielregeln als Code. Kennt weder Browser noch Server.
- **server**: verwaltet Räume, Timer und entscheidet, was erlaubt ist. Nur der Server kennt alle Karten.
- **client**: die Webseite, die Spieler sehen und bedienen.

## Ordnerbaum

```
Cambio Online/
├─ docs/                     Dokumentation
│  ├─ RULES.md               Spielregeln – verbindliche Vorlage für den Code
│  ├─ STRUCTURE.md           Diese Datei
│  ├─ ARCHITECTURE.md        Technischer Aufbau (für Entwickler)
│  └─ CARDS.md               Anleitung für eigene Kartenbilder
│
├─ packages/
│  ├─ shared/src/            ── Spiellogik ──
│  │  ├─ cards.ts            Kartenwerte, Deck, Mischen
│  │  ├─ settings.ts         Lobby-Einstellungen: Standardwerte und Grenzen
│  │  ├─ protocol.ts         Nachrichten zwischen Browser und Server
│  │  └─ game/
│  │     ├─ engine.ts        Herzstück: alle Spielzüge und Regeln
│  │     ├─ scoring.ts       Wertung (Einzelspiel, Punktemodus)
│  │     ├─ view.ts          Was ein Spieler sehen darf
│  │     └─ types.ts         Datentypen (Zustand, Aktionen, Ereignisse)
│  │
│  ├─ server/src/            ── Server ──
│  │  ├─ index.ts            Startpunkt (Port)
│  │  ├─ app.ts              Webserver, liefert die Seite aus, /health, Suchmaschinen-Sperre
│  │  ├─ sockets.ts          Empfängt Nachrichten der Spieler
│  │  ├─ validation.ts       Prüft Eingaben der Spieler auf Gültigkeit
│  │  └─ rooms/
│  │     ├─ Room.ts          Ein Raum: Spieler, Host, Timer, laufendes Spiel
│  │     └─ RoomManager.ts   Alle Räume, Raumcodes, Aufräumen leerer Räume
│  │
│  └─ client/                ── Webseite ──
│     ├─ index.html          HTML-Grundgerüst, Seitentitel
│     ├─ public/             Statische Dateien (z. B. später public/cards/ für Kartenbilder)
│     └─ src/
│        ├─ main.tsx         Startpunkt der Webseite
│        ├─ App.tsx          Entscheidet: Startseite, Lobby oder Spieltisch
│        ├─ styles.css       Gesamtes Aussehen: Farben, Abstände, Kartengröße
│        ├─ prefs.ts         Persönliche Einstellungen im Browser (Abwerfen per Klick/Ziehen, Hilfe an/aus)
│        ├─ screens/
│        │  ├─ Home.tsx      Startseite (Name, Raum erstellen/beitreten)
│        │  ├─ Lobby.tsx     Lobby (Spielerliste, Einstellungen, Start)
│        │  ├─ HowToPlay.tsx Spielanleitung (Pop-up auf Startseite und in der Lobby)
│        │  └─ PersonalSettings.tsx „Deine Bedienung“ in der Lobby (Abwerfen, Hilfe)
│        ├─ game/
│        │  ├─ Game.tsx      Spieltisch: Layout, Buttons, Hinweistexte
│        │  ├─ Results.tsx   Auswertung nach Partie/Spielende
│        │  ├─ interaction.ts Was beim Klick auf eine Karte passiert; Fähigkeitstexte
│        │  ├─ useFlights.tsx Flug-Animationen der Karten (Dauer, Tempo)
│        │  ├─ useSnapDrag.tsx Abwerfen per Ziehen auf die Ablage
│        │  ├─ HelpPanel.tsx Hilfe am Tisch: Kartenübersicht und Kurzinfos zu offenen Karten
│        │  ├─ useEventFeed.ts Protokoll-Texte, kurz aufgedeckte Karten
│        │  ├─ TimerBar.tsx  Zeitbalken
│        │  └─ anchors.ts    Positionsmarken für Animationen
│        ├─ cards/
│        │  ├─ CardView.tsx  Wie eine Karte gezeichnet wird
│        │  └─ cardAssets.ts Kartennamen, Beschriftung, Schalter für eigene Bilder
│        ├─ legal/
│        │  ├─ legalInfo.ts  Deine Angaben für Impressum/Datenschutz + Schalter „veröffentlicht“
│        │  └─ LegalPages.tsx Texte von Impressum (/impressum) und Datenschutz (/datenschutz)
│        └─ net/
│           ├─ store.ts      Verbindung zum Server, Spielzustand im Browser
│           ├─ socket.ts     Socket.IO-Verbindung
│           ├─ errors.ts     Fehlermeldungen (deutsche Texte)
│           └─ roomCode.ts   Raumcode aus Eingabe/Link lesen
│
├─ .github/workflows/ci.yml  Automatische Prüfung bei jedem Push auf GitHub
├─ render.yaml               Hosting-Konfiguration für Render
├─ Dockerfile                Container für anderes Hosting (z. B. eigener Server)
├─ package.json              Befehle (npm run …) und Abhängigkeiten
├─ README.md                 Einstieg, Befehle, Deployment
└─ CLAUDE.md                 Hinweise für Claude
```

Dateien mit `.test.ts` im Namen sind automatische Tests. Sie liegen neben
der Datei, die sie prüfen.

Nicht von Hand ändern: `package-lock.json` (wird von npm verwaltet),
`node_modules/` und `dist/` (werden automatisch erzeugt).

## Wo ändere ich was?

| Ich will …                                       | Datei                                                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Farben, Schriftgrößen, Abstände ändern           | `packages/client/src/styles.css` – Farben ganz oben unter `:root`                                                     |
| Kartengröße ändern                               | `styles.css` → `--card-w` (eigene Karten) und `--card-w-small` (Gegner)                                               |
| Eigene Kartenbilder einsetzen                    | siehe `docs/CARDS.md`                                                                                                 |
| Kartenbeschriftung ändern (z. B. „B“ für Bube)   | `packages/client/src/cards/cardAssets.ts` → `RANK_LABEL`                                                              |
| Texte auf der Startseite / Lobby ändern          | `screens/Home.tsx` bzw. `screens/Lobby.tsx`                                                                           |
| Hinweistexte am Spieltisch ändern                | `game/Game.tsx` → Funktion `Prompt`; Fähigkeiten in `game/interaction.ts`                                             |
| Protokoll-Texte ändern                           | `game/useEventFeed.ts`                                                                                                |
| Fehlermeldungen ändern                           | `net/errors.ts`                                                                                                       |
| Dauer der Landungs-Markierung                    | `game/useFlights.tsx` → `LANDED_MS` (Millisekunden)                                                                   |
| Steuerung standardmäßig „Alles klicken“          | `packages/client/src/prefs.ts` → bei `snapMode` den letzten Wert `'drag'` auf `'click'`                               |
| Anordnung der Karten (2 Reihen, neue rechts)     | `game/Game.tsx` → `slotPosition`                                                                                      |
| Animationstempo ändern                           | `game/useFlights.tsx` → `DURATION` (Sekunden pro Flug), `STEP` (Abstand zwischen Flügen), `DEAL_STEP` (Austeilen)     |
| Standardwerte der Lobby-Einstellungen            | `packages/shared/src/settings.ts` → `DEFAULT_SETTINGS`                                                                |
| Erlaubte Bereiche der Einstellungen              | `settings.ts` → `SETTINGS_LIMITS`                                                                                     |
| Kartenwerte ändern (z. B. schwarzer König)       | `packages/shared/src/cards.ts` → `cardValue`                                                                          |
| Welche Karte welche Fähigkeit hat                | `packages/shared/src/game/engine.ts` → `abilityOf`                                                                    |
| Spielregeln ändern                               | zuerst `docs/RULES.md`, dann `engine.ts` (und Tests in `engine.test.ts`)                                              |
| Wertung / Strafpunkte                            | `packages/shared/src/game/scoring.ts`                                                                                 |
| Text der Spielanleitung                          | `packages/client/src/screens/HowToPlay.tsx` (Kartenwerte kommen automatisch aus `cards.ts`)                           |
| Trefferzone beim Ziehen auf die Ablage           | `game/useSnapDrag.tsx` → `DROP_MARGIN` (Pixel um die Ablage herum)                                                    |
| Texte der Hilfe am Spieltisch                    | `game/HelpPanel.tsx`; Fähigkeitsnamen in `game/interaction.ts` → `ABILITY_LABEL`                                      |
| Hilfe standardmäßig aus statt an                 | `packages/client/src/prefs.ts` → bei `help` den letzten Wert `'on'` auf `'off'`                                       |
| Seitentitel im Browser-Tab                       | `packages/client/index.html`                                                                                          |
| Impressum/Datenschutz ausfüllen und freischalten | `packages/client/src/legal/legalInfo.ts` (Angaben, `published: true`)                                                 |
| Texte von Impressum/Datenschutz ändern           | `packages/client/src/legal/LegalPages.tsx`                                                                            |
| Seite für Suchmaschinen freigeben                | `packages/server/src/app.ts` → `NO_INDEX = false` **und** `robots`-Meta-Tag in `packages/client/index.html` entfernen |

**Achtung bei Regeländerungen:** Die Tests prüfen die aktuellen Regeln. Wenn du
zum Beispiel einen Kartenwert änderst, schlägt `npm test` fehl, bis der
passende Test angepasst ist. Das ist gewollt: So fällt kein Regelfehler unbemerkt durch.

## Datenschutz im Blick behalten

Die Datenschutzerklärung beschreibt, welche Daten das Spiel verarbeitet. Wenn
neue Funktionen Daten speichern oder an Dritte senden (z. B. Accounts, Chat,
Statistiken, externe Schriftarten, Analyse-Tools), muss `LegalPages.tsx`
angepasst werden.

## Nach einer Änderung

```bash
npm run dev          # Spiel lokal starten: http://localhost:5173
npm test             # Tests ausführen
npm run lint         # Code-Stil prüfen
npm run typecheck    # Typfehler finden
npm run format       # Code automatisch einheitlich formatieren
```

Änderungen an `client` erscheinen im Browser sofort. Änderungen an `server`
oder `shared` starten den Server neu, dabei gehen laufende Testspiele verloren.
