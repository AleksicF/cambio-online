# Cambio Online

Online-Multiplayer-Version des Kartenspiels **Cambio** für 2–6 Spieler – mit Lobby, Raumcodes und Kartenanimationen.

- Spielregeln: [docs/RULES.md](docs/RULES.md)
- Architektur: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Voraussetzungen

- [Node.js](https://nodejs.org/) 22 oder neuer (empfohlen: 24, siehe `.nvmrc`)

## Entwicklung

```bash
npm install
npm run dev
```

Öffnet den Client auf http://localhost:5173 (Vite) und den Server auf http://localhost:3001.
Zum Testen mit mehreren Spielern einfach mehrere Browser-Tabs öffnen.

| Befehl              | Zweck                                                    |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Client + Server mit Hot Reload                           |
| `npm test`          | Tests (Vitest)                                           |
| `npm run lint`      | ESLint                                                   |
| `npm run typecheck` | TypeScript-Prüfung aller Pakete                          |
| `npm run format`    | Code mit Prettier formatieren                            |
| `npm run build`     | Produktions-Build von Client und Server                  |
| `npm start`         | Produktions-Server starten (liefert auch den Client aus) |

## Projektstruktur

```
packages/
  shared/   Spiellogik, Typen, Netzwerkprotokoll (+ Tests)
  server/   Node + Socket.IO
  client/   React + Vite + Framer Motion
docs/       Regeln & Architektur
```

## Deployment

```bash
docker build -t cambio-online .
docker run -p 3001:3001 cambio-online
```
