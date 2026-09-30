// Zentrale Tuning-Werte. Alles Balancing hier.
const CONFIG = {
  lanes: [-1, 0, 1],
  laneWidth: 140,        // px bei z=0 (unten)
  horizonY: 0.34,        // Anteil der Canvas-Höhe (Fluchtpunkt)
  groundY: 0.92,         // Anteil: wo der Spieler steht
  spawnDistance: 90,     // Welt-Einheiten bis zum Horizont
  despawnZ: -4,

  baseSpeed: 22,         // Welt-Einheiten / Sekunde
  maxSpeed: 55,
  speedGain: 0.55,       // + pro Sekunde Überlebenszeit

  gravity: -60,          // Sprungphysik (Einheiten/s^2, y nach oben positiv)
  jumpVelocity: 22,
  rollTime: 0.7,         // Sekunden Rollen

  spawnIntervalStart: 1.15, // Sekunden zwischen Hindernis-Reihen
  spawnIntervalMin: 0.45,
  spawnIntervalGain: 0.012, // - pro Sekunde

  coinScore: 10,
  distScore: 1.2,        // Punkte pro Welt-Einheit
};
