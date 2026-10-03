# Architektur

## Überblick

```
Browser (React-Client)  ⇄  Socket.IO  ⇄  Node-Server (autoritativ)
            └────────── @cambio/shared ──────────┘
```

- **Autoritativer Server:** Der komplette Spielzustand (inkl. verdeckter Karten) liegt nur auf dem Server. Jeder Client bekommt eine **gefilterte Sicht**, in der er nur die Karten sieht, die er laut Regeln sehen darf. So kann niemand über die Entwicklertools schummeln.
- **Gemeinsame Spiellogik:** `@cambio/shared` enthält reine Funktionen (Zustand + Aktion → neuer Zustand), Typen und das Netzwerkprotokoll. Der Server nutzt sie zur Validierung, der Client für Typen und Anzeige.
- **Zustand im Arbeitsspeicher:** Räume und Spiele werden vorerst nur im RAM gehalten (ein Server-Prozess). Eine Datenbank kommt erst mit Accounts/Statistiken dazu.

## Pakete

| Paket             | Inhalt                                                                  | Tooling                    |
| ----------------- | ----------------------------------------------------------------------- | -------------------------- |
| `packages/shared` | Karten, Regeln, Spielzustand, Protokoll-Typen                           | TypeScript, Vitest         |
| `packages/server` | Express + Socket.IO, Räume, Timer; liefert in Produktion den Client aus | tsx (dev), tsup (build)    |
| `packages/client` | UI, Animationen                                                         | React, Vite, Framer Motion |

`@cambio/shared` wird nicht separat gebaut, sondern als TypeScript-Quelle eingebunden (Vite bzw. tsup bündeln es mit).

## Deployment

Ein einzelner Docker-Container (siehe `Dockerfile`) enthält Server und gebauten Client. Der Server lauscht auf `PORT` (Standard 3001) und bietet `/health` für Health-Checks.

Start auf **Render** (Free Tier, WebSockets unterstützt, schläft bei Inaktivität ein). Später Umzug auf Railway oder einen eigenen VPS mit demselben Container.
