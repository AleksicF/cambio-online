# Cambio Online – Spielregeln

Dieses Dokument ist die **verbindliche Spezifikation** für die Spiellogik.
Einstellbare Werte stehen in §10 (Lobby-Einstellungen).

## Begriffe

| Begriff    | Bedeutung                                               |
| ---------- | ------------------------------------------------------- |
| **Zug**    | Ein Spieler ist einmal an der Reihe.                    |
| **Umlauf** | Jeder Spieler hatte genau einen Zug.                    |
| **Partie** | Vom Austeilen bis zur Auflösung (Aufdecken & Zählen).   |
| **Spiel**  | Eine oder mehrere Partien, je nach Spielmodus.          |
| **Slot**   | Fester Platz einer Karte in der Auslage eines Spielers. |

## 1. Material & Kartenwerte

54 Karten: 52er Deck + 2 Joker.

| Karte                | Punkte    |
| -------------------- | --------- |
| Joker                | 0         |
| Ass                  | 1         |
| 2–10                 | Augenzahl |
| Bube                 | 10        |
| Dame                 | 10        |
| König, rot (♥ ♦)     | −1        |
| König, schwarz (♠ ♣) | 31        |

## 2. Ziel

Am Ende einer Partie eine möglichst **niedrige Kartensumme** haben.

## 3. Aufbau einer Partie

1. Jeder Spieler erhält **4 Karten verdeckt** in einem 2×2-Raster (Slots 1–4; Slots 3 und 4 sind die unteren).
2. Restliche Karten = **Nachziehstapel**. Die oberste Karte wird aufgedeckt und bildet den **Ablagestapel**.
3. Die beiden unteren Karten jedes Spielers sind für die **Anschauzeit** (Standard 3 s) nur für ihn sichtbar. Danach beginnt der Startspieler.
4. **Startspieler**: in der ersten Partie zufällig, danach im Uhrzeigersinn rotierend.

## 4. Spielzug

Der aktive Spieler wählt genau eine Option:

**a) Vom Nachziehstapel ziehen.** Die Karte ist nur für ihn sichtbar. Dann:

- **tauschen**: Die gezogene Karte kommt verdeckt in einen eigenen Slot, die dortige Karte offen auf den Ablagestapel, **oder**
- **ablegen**: Die gezogene Karte kommt offen auf den Ablagestapel. Ist sie eine Aktionskarte, darf der Spieler ihre Fähigkeit nutzen (§5).

**b) Oberste Karte des Ablagestapels nehmen.** Sie **muss** gegen eine eigene Karte getauscht werden. Keine Fähigkeit.

**c) „Cambio“ rufen** (§7). Ersetzt den gesamten Zug.

Die Positionen der eigenen Karten dürfen nicht umsortiert werden.

## 5. Fähigkeiten

Nur wenn die Karte **vom Nachziehstapel gezogen und direkt abgelegt** wurde. Jede Fähigkeit ist **freiwillig**.

| Karte          | Fähigkeit                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| 7, 8           | Eine **eigene** Karte für die Anschauzeit ansehen.                                                          |
| 9, 10          | Eine **fremde** Karte für die Anschauzeit ansehen.                                                          |
| Bube, Dame     | **Blind tauschen**: zwei beliebige Karten verschiedener Spieler (eigene ↔ fremde **oder** fremde ↔ fremde). |
| König, schwarz | Eine **beliebige** Karte ansehen, danach **optional** zwei beliebige Karten verschiedener Spieler tauschen. |

Karten des Cambio-Rufers sind gesperrt und können weder angesehen noch getauscht werden (§7).

## 6. Abwerfen (Snap)

Sobald eine Karte durch einen Zug auf den Ablagestapel kommt, öffnet sich das **Abwurf-Fenster**. Solange es offen ist, darf **jeder Spieler** (auch der aktive) eine verdeckte Karte mit **gleichem Rang** abwerfen. Beide Könige gelten als gleicher Rang, beide Joker ebenso.

| Fall                  | Folge                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Eigene Karte, richtig | Karte ist weg, Slot bleibt leer.                                                                                      |
| Eigene Karte, falsch  | Karte geht zurück in ihren Slot, Strafkarten (s. u.).                                                                 |
| Fremde Karte, richtig | Karte ist weg. Der Abwerfer gibt dem Besitzer **eine eigene Karte seiner Wahl** verdeckt in den frei gewordenen Slot. |
| Fremde Karte, falsch  | Karte geht zurück, Strafkarten für den Abwerfer.                                                                      |

**Strafkarten:** Strafkarten werden verdeckt und ungesehen in neue Slots gelegt. Der Host wählt:

- **Steigend** (Standard): Der Fehlerzähler läuft **pro Spieler** und wird zu Beginn jeder Partie auf 0 gesetzt. Der n-te Fehler kostet **n Strafkarten** (1., 2., 3. … Fehler = 1, 2, 3 … Karten).
- **Gleichbleibend:** Jeder Fehler kostet genau **1 Strafkarte**.

**Dauer des Abwurf-Fensters:** Der Host wählt:

- **Feste Zeit** (Standard 3 s): Das Spiel wartet, bis das Fenster abgelaufen ist. Danach beginnt der nächste Zug.
- **Bis zur nächsten Karte:** Der nächste Zug beginnt sofort. Abwerfen bleibt möglich, bis die nächste Karte auf den Ablagestapel kommt – also auch während der nächste Spieler zieht oder eine Fähigkeit nutzt. Wirft jemand während eines fremden Zugs eine fremde Karte richtig ab, wird der Zug für das Abgeben der Karte kurz unterbrochen. Nach dem letzten Zug einer Partie gibt es ein normales Fenster mit fester Zeit, bevor aufgedeckt wird. Bots legen in diesem Modus frühestens nach der eingestellten Abwurf-Zeit (plus kurzer Animationszeit) eine neue Karte ab, damit Menschen genug Zeit zum Abwerfen haben.

**Ablauf:**

- Fähigkeiten (§5) werden **vor** dem Abwurf-Fenster ausgeführt. Das Fenster öffnet sich danach.
- Nur der **erste richtige** Abwurf zählt und schließt das Fenster. Falsche Abwürfe schließen es nicht.
- Abgeworfene Karten öffnen **kein** neues Fenster.
- Bei fester Zeit beginnt der nächste Zug, sobald das Fenster geschlossen ist.

## 7. Cambio & Ende der Partie

- Cambio darf frühestens im **3. Umlauf** (einstellbar) gerufen werden, und zwar zu Beginn des eigenen Zugs (statt zu ziehen).
- Danach hat **jeder andere Spieler noch genau einen Zug**. Dann endet die Partie.
- Die Karten des Rufers sind **gesperrt**: Sie können nicht angesehen, getauscht oder abgeworfen werden. Auch der Rufer selbst darf nach dem Ruf nicht mehr abwerfen.
- **0 Karten:** Hat ein Spieler zu Beginn seines Zugs keine Karten, **muss** er Cambio rufen, auch vor dem 3. Umlauf. Hat bereits jemand Cambio gerufen, ist er normal ein letztes Mal dran (und setzt aus).
- Am Ende werden alle Karten aufgedeckt und summiert.

## 8. Wertung & Spielmodi

Der Host wählt in der Lobby einen Modus.

### Einzelspiel

Eine Partie.

- Die **niedrigste Summe gewinnt**. Bei Gleichstand gibt es einen **geteilten Sieg**.
- Hat ein Nicht-Rufer **gleich viel oder weniger** als der Rufer, **verliert der Rufer**. Gewinner sind dann die Nicht-Rufer mit der niedrigsten Summe.

### Punktemodus

Mehrere Partien, die Punkte werden addiert.

- Jeder Spieler bekommt seine Kartensumme als Punkte (auch negativ).
- Hat ein anderer Spieler eine **echt niedrigere** Summe als der Rufer, bekommt der Rufer **+10 Strafpunkte**. Bei Gleichstand gibt es keine Strafe.
- **Spielende**, vom Host einstellbar:
  - nach einer festen **Anzahl Partien**, oder
  - sobald ein Spieler eine **Punktegrenze** erreicht oder überschreitet (die laufende Partie wird zu Ende gewertet).
- Gewinner ist, wer insgesamt die **wenigsten Punkte** hat. Bei Gleichstand gibt es einen geteilten Sieg.

## 9. Sonstiges

- Ist der Nachziehstapel leer, wird der Ablagestapel **ohne seine oberste Karte** gemischt und wird zum neuen Nachziehstapel. Das gilt auch beim Ziehen von Strafkarten.
- 2–6 Spieler.

## 10. Lobby-Einstellungen

Der Host legt vor Spielbeginn in einem Einstellungsfenster fest:

| Einstellung                         | Optionen                                 | Standard     |
| ----------------------------------- | ---------------------------------------- | ------------ |
| Spielmodus                          | Einzelspiel / Punktemodus                | Einzelspiel  |
| Spielende (nur Punktemodus)         | nach Anzahl Partien / bei Punktegrenze   | Punktegrenze |
| Anzahl Partien                      | 1–20                                     | 5            |
| Punktegrenze                        | 50–300                                   | 100          |
| Strafpunkte für Rufer (Punktemodus) | 0–30                                     | 10           |
| Zeitlimit pro Zug                   | aus / 15–120 s                           | 30 s         |
| Abwurf-Fenster                      | feste Zeit / bis zur nächsten Karte      | feste Zeit   |
| Abwurf-Zeit (fest bzw. Mindestzeit) | 2–10 s                                   | 3 s          |
| Strafkarten                         | steigend / gleichbleibend (1 pro Fehler) | steigend     |
| Anschauzeit (Start & Fähigkeiten)   | 2–10 s                                   | 3 s          |
| Cambio frühestens ab Umlauf         | 1–5                                      | 3            |
| Max. Spieler                        | 2–6                                      | 6            |

Läuft das Zeitlimit ab, wird automatisch gehandelt: Eine gezogene Karte wird abgelegt (ohne Fähigkeit), eine offene Fähigkeit verfällt. Hat der Spieler noch nicht gezogen, zieht er automatisch und legt die Karte ab.

## 11. Bots

Der Host kann in der Lobby Bots hinzufügen (auch zum Allein-Spielen). Bots zählen als Spieler (2–6) und spielen nach denselben Regeln.

- **Fairness:** Ein Bot sieht nur, was ein menschlicher Spieler an seiner Stelle sähe, und muss sich Karten merken.
- **Schwierigkeit** pro Bot: Einfach, Mittel, Schwer. Sie bestimmt, wie zuverlässig sich der Bot Karten merkt, wie oft er eigene und fremde Karten abwirft, wie schnell er reagiert und wie gut er Fähigkeiten nutzt. Die genauen Werte zeigt die Lobby unter „Was bedeuten die Stufen?“.
- Bots handeln mit Bedenk- und Reaktionszeit, nicht sofort.
