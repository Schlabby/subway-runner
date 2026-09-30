# 🚇 Subway Runner – Subway-Surfers-Klon (Browser, Canvas)

Pseudo-3D Endless Runner mit 3 Spuren, Spurwechsel, Springen, Rollen,
Hindernissen, Münzen, Score und steigender Schwierigkeit. Keine Abhängigkeiten,
keine Assets – alles wird mit Canvas gezeichnet.

## Projektstruktur

```
Subway_Surfers_OS/
├── index.html        # Canvas + HUD + Menüs (Start / Pause / Game Over)
├── css/style.css     # Layout, HUD, Overlays
├── js/
│   ├── config.js     # Balancing (Speed, Spawns, Physik)
│   ├── input.js      # Tastatur + Touch/Swipe + Buttons
│   ├── entities.js   # Projektion, Player, Obstacle, Coin, spawnRow()
│   ├── game.js       # Loop, Spawning, Kollision, Score, Rendering
│   └── main.js       # Bootstrap + roundRect-Polyfill
└── README.md
```

## Spiel starten

**Option 1 – Doppelklick (einfach):**
`index.html` im Browser öffnen. Läuft, da keine Module/Fetch verwendet werden.

**Option 2 – lokaler Server (empfohlen):**
```bash
cd Subway_Surfers_OS
python3 -m http.server 8000
# dann öffnen: http://localhost:8000
```

## Steuerung

| Aktion | Tastatur | Touch |
|---|---|---|
| Links / Rechts | `←`/`→` oder `A`/`D` | Swipe links/rechts |
| Springen | `↑` / `W` / `Space` | Swipe hoch oder Tap |
| Rollen | `↓` / `S` | Swipe runter |
| Pause | `P` / `Esc` | – |
| Start / Neustart | `Enter` oder Button | Button tippen |

## Regeln

- 🟧 **Niedrige Barriere:** springen (`y > 2.0` im Kollisionscheck)
- 🟥 **Hohe Barriere (ROLLEN-Schild):** rollen
- 🚂 **Zug (kurz/lang):** Spur wechseln – weder Sprung noch Rolle hilft
- 🪙 **Münzen:** +10 Punkte, auch in Sprungbögen
- Score = Distanz × 1.2 + Münzen. Speed steigt von 22 → 55, Spawn-Intervall sinkt von 1.15s → 0.45s.
- Highscore wird in `localStorage` gespeichert.

## Getestet

- [x] IDs HTML↔JS konsistent, Klammern balanciert
- [x] Sprungphysik: max. Höhe 4.03 > 2.0 Threshold; Zeitfenster 0.52s > Hindernisfenster (0.11s bei Start, 0.04s bei Max-Speed)
- [x] `spawnRow()` lässt immer mind. 1 Spur frei (außer Full-Width-Reihen, die per Sprung/Rolle passierbar sind)
- [x] Alle Dateien per `python3 -m http.server` mit HTTP 200 erreichbar
