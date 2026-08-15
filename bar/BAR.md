# Die Bar — Vergleichsmaßstab für Terra Incognita

## Zielgefühl (das einzige Kriterium, das zählt)

> **„Ich bin der erste Mensch, der diese Welt versteht."**
> Der Moment um 2 Uhr nachts, in dem man etwas sieht, es versteht — und weiß,
> dass niemand sonst diese Wahrheit kennt. Wissen als Folklore, nicht als Datenbank.

Teilgefühle: Ehrfurcht vor einer Welt, die größer und älter ist als ich ·
Angst vor dem, was ich noch nicht verstehe · das Kribbeln der Erkenntnis,
wenn eine Vermutung sich bestätigt.

## Referenz-Stills (die Bar)

Der Kritiker vergleicht unser Ergebnis blind gegen diese konkreten, bekannten Szenen.
**Warum diese Bar taugt:** Beide Spiele kommen dem Zielgefühl am nächsten, besitzen
aber unser Kernkonzept (pro Welt divergente Naturgesetze) nicht — wir messen uns
also am Gefühl, nicht an kopierbaren Features.

1. **Outer Wilds — Lagerfeuer auf Timber Hearth bei Nacht:** winzige warme Lichtinsel,
   riesiger kalter Sternenhimmel; eine Lichtquelle dominiert, alles andere fällt weich ab.
2. **Outer Wilds — Blick von Brittle Hollow in den schwarzen Kern:** Vertigo; die Welt
   hat eine sichtbare, unerklärte Anomalie im Bild, die eine Frage stellt.
3. **Subnautica — Abstieg in die Blood-Kelp-Zone:** fast völlige Dunkelheit, Biolumineszenz
   als einzige Orientierung; Sichtweite ≈ Mut; Farbdisziplin (2–3 Farbtöne, Rest schluckt das Dunkel).
4. **Subnautica — erster Blick auf einen Reaper aus der Ferne im Nebel:** die Gefahr ist
   eine Silhouette, kein Gegner-UI; man versteht sie über Form und Verhalten, nie über Text.
5. **Subnautica — Grand Reef mit schwebenden Leuchtinseln:** Tiefe durch Nebelschichten,
   Lichter in mehreren Entfernungsebenen, Blick wird in die Ferne gezogen.

## Prüfkriterien (je 1–10; 8 = ein blinder Juror könnte unseres wählen)

| # | Kriterium | Konkret prüfbar im Screenshot / im Spiel |
|---|-----------|------------------------------------------|
| 1 | **Lichtdisziplin** | Wenige dominante Lichtquellen mit weichem Falloff; Dunkelheit ist wirklich dunkel; Licht hat Bedeutung (Sicherheit ODER Gefahr — je nach Weltgesetz) |
| 2 | **Tiefe & Maßstab** | Nebel-/Parallaxebenen erzeugen Ferne; irgendetwas im Bild ist groß und unerreichbar; der Spieler wirkt klein |
| 3 | **Farbdisziplin** | 2–3 Farbfamilien, koordiniert; kein Buntstich; Nacht ≠ Tag deutlich unterscheidbar |
| 4 | **Sichtbares Mysterium** | In jedem Screenshot ist mindestens ein Ding, das eine Frage stellt (Monolith, Silhouette, Leuchtmuster) — ohne Text, ohne Marker |
| 5 | **Gefahr als Silhouette** | Bedrohung liest sich über Form/Verhalten/Klang, nie über UI; erste Begegnung = Unklarheit, nicht Healthbar |
| 6 | **Erkenntnis-Moment** | Wenn eine Vermutung sich bestätigt (Journal kristallisiert), trägt Audio+Bild den Moment wie OW: warm, kurz, verdient — nicht als Popup-Belohnung |
| 7 | **Klang der Leere** | Drone + Wind geben der Welt Gewicht; Ereignisklänge sind der Welt-Tonalität entnommen; Stille wird als Gestaltungsmittel genutzt |
| 8 | **Bewegungsgefühl** | Gehen fühlt sich gewichtig und ruhig an (OW-Spaziergang, nicht Arcade); Kamera atmet; nichts ruckt |

## A/B-Protokoll für Kritiker

1. `node tools/screenshot.mjs --out shots/<teilbereich>` ausführen, PNGs ansehen.
2. Für das eigene Teilgebiet: Stelle unser Bild gedanklich NEBEN das passendste Referenz-Still.
   Frage: *Würde ein blinder Juror, der nur nach dem Zielgefühl urteilt, unseres wählen?*
3. Score 1–10 vergeben. Dann die EINE größte Lücke benennen (nicht fünf kleine).
4. Konkrete, umsetzbare Direktiven formulieren — Dateien und Parameter benennen.
5. Sound-Kritiker: Da Audio nicht hörbar ist, `game/js/sound.js` lesen und das Klang-Design
   gegen Kriterium 7 prüfen (Frequenzen, Hüllkurven, Dichte, Stille).

## Nicht verhandelbar (Design-Invarianten)

- **Kein Text erklärt die Welt.** Das Journal schreibt nur auf, was der Spieler selbst sah.
- **Regeln bleiben pro Seed divergent** (`worldgen.js: laws`) — kein Kritiker darf Vereinheitlichung fordern.
- **Kohärenz vor Zufall:** Jedes Gesetz braucht ein lesbares Telegraph (Puls, Farbe, Klang), sonst ist es Rauschen.
- **Spielbar bleiben:** Nach jeder Änderung muss `node tools/screenshot.mjs` ohne Konsolenfehler durchlaufen.
