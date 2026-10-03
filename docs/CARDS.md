# Eigene Kartendesigns

Ohne eigene Bilder zeichnet der Client schlichte Karten aus Rang und Farbsymbol.
Eigene Designs lassen sich ohne Codeänderung an der Darstellung einsetzen.

## 1. Dateien ablegen

Alle Bilder kommen nach `packages/client/public/cards/`. Ein Format für alle
Karten, wahlweise `svg`, `png` oder `webp`.

| Karte         | Dateiname                                         |
| ------------- | ------------------------------------------------- |
| Rückseite     | `back`                                            |
| Joker         | `JOKER`                                           |
| Ass bis König | Rang + Farbe, z. B. `AS`, `7H`, `10D`, `QC`, `KS` |

- **Ränge:** `A`, `2`–`10`, `J` (Bube), `Q` (Dame), `K` (König)
- **Farben:** `H` Herz, `D` Karo, `S` Pik, `C` Kreuz

Insgesamt 54 Dateien: 52 Karten, `JOKER` und `back`.

## 2. Format

- Seitenverhältnis **5 : 7** (z. B. 500 × 700 px). Andere Verhältnisse werden beschnitten.
- Karten werden recht klein angezeigt (ca. 30–76 px breit): große, klare Symbole wirken besser als feine Details.
- Rand und Ecken zeichnet der Client selbst (dünne Linie, 4 px Radius). Das Bild sollte deshalb bis an den Rand gehen.

## 3. Einschalten

In `packages/client/src/cards/cardAssets.ts`:

```ts
export const CARD_IMAGES = {
  enabled: true,
  extension: 'svg', // oder 'png' / 'webp'
};
```

Die gesamte Kartendarstellung läuft über `packages/client/src/cards/CardView.tsx`.
Wer mehr als Bilder austauschen will (z. B. andere Ränder), ändert nur diese Datei
und die `.card`-Regeln in `styles.css`.
