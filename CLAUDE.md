# Cambio Online

Multiplayer-Kartenspiel (TypeScript-Monorepo, npm workspaces). Kommunikation mit dem Nutzer auf Deutsch.

- `docs/RULES.md` ist die verbindliche Regel-Spezifikation. Regeländerungen zuerst dort eintragen, dann umsetzen.
- Spiellogik gehört als reine Funktionen in `packages/shared` und wird dort mit Vitest getestet.
- Der Server ist autoritativ: Clients bekommen nie Karten zu sehen, die sie laut Regeln nicht sehen dürfen.
- Vor dem Commit: `npm run format:check && npm run lint && npm run typecheck && npm test`.
- Node liegt unter `C:\Program Files\nodejs` (ggf. nicht im PATH der Bash-Shell).
