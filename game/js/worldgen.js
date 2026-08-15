// Terra Incognita — Weltgenerator: pro Seed divergente, aber in sich stimmige Naturgesetze.
window.TI = window.TI || {};
(function () {
  'use strict';

  function pseudoword(rng, min, max) {
    const A = ['ve', 'or', 'qi', 'ma', 'thu', 'ren', 'ol', 'ka', 'ish', 'un', 'za', 'el', 'no', 'vy', 'mir', 'sa', 'du', 'he', 'ly', 'om'];
    const n = min + ((rng() * (max - min + 1)) | 0);
    let w = '';
    for (let i = 0; i < n; i++) w += A[(rng() * A.length) | 0];
    return w[0].toUpperCase() + w.slice(1);
  }

  TI.WORLD_SIZE = 4200;

  TI.generateWorld = function (seedStr) {
    const rng = TI.rngFrom('w:' + seedStr);
    const pick = a => a[(rng() * a.length) | 0];
    const shuffle = a => {
      a = a.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    };

    const name = (pseudoword(rng, 2, 2) + '-' + pseudoword(rng, 2, 3)).toUpperCase();

    const baseHue = rng() * 360;
    const scheme = pick(['analog', 'duotone', 'triad']);
    const hueB = baseHue + (scheme === 'analog' ? 40 : scheme === 'duotone' ? 180 : 120);
    const hueC = scheme === 'triad' ? baseHue + 240 : baseHue - 35;
    const palette = {
      baseHue, hueB, hueC, scheme,
      nightDark: 0.75 + rng() * 0.2,
      dayDark: 0.12 + rng() * 0.1,
      fogDensity: 0.25 + rng() * 0.45,
      fogHue: pick([baseHue, hueB]),
      groundSat: 18 + rng() * 22,
      groundLight: 15 + rng() * 9
    };

    // Die lernbaren Axiome dieser Welt. Divergent zwischen Seeds, konsistent innerhalb.
    const laws = {
      pulseMeans: pick(['danger', 'vigor']),   // Pulsierendes brennt — oder nährt
      lightDraws: rng() < 0.5,                 // Licht zieht Kreaturen an — oder vertreibt sie
      nightInverts: rng() < 0.4,               // nachts kehren sich Wirkungen um
      stillnessHides: rng() < 0.5,             // Stillstehen macht unsichtbar für Jäger
      touchEchoes: rng() < 0.6                 // Berührung lässt Artgenossen antworten
    };

    const roles = ['benefactor', 'hazard', 'catalyst', 'beacon', 'trickster'];
    const shapes = shuffle(['orb', 'stalk', 'fan', 'cluster', 'spire']);
    const hues = shuffle([baseHue, hueB, hueC, baseHue + 18, hueB + 28]);
    const species = roles.map((role, i) => ({
      id: i, role,
      shape: shapes[i],
      hue: hues[i],
      pulses: laws.pulseMeans === 'danger' ? role === 'hazard' : role === 'benefactor',
      emit: role === 'beacon' ? 1 : (rng() < 0.3 ? 0.45 : 0),
      size: 9 + rng() * 9,
      band: rng() * 0.55,
      name: pseudoword(rng, 2, 3)
    }));

    // nightInverts als Anatomie: benefactor und hazard sind sichtbare Zwillinge —
    // gleiche Gestalt, gleicher Wuchsraum, Farbton um 180 gespiegelt. Die nächtliche
    // Umkehr ist damit angekündigt ('die Zwillinge tauschen die Plätze'), ohne ein Wort Text.
    if (laws.nightInverts) {
      const ben = species.find(s => s.role === 'benefactor');
      const haz = species.find(s => s.role === 'hazard');
      haz.shape = ben.shape;
      haz.hue = ben.hue + 180;
      haz.band = ben.band;
      haz.size = ben.size;
    }

    const music = {
      root: 150 + rng() * 110,
      scale: pick([[0, 3, 5, 7, 10], [0, 2, 4, 7, 9], [0, 2, 3, 7, 8], [0, 2, 5, 7, 10]])
    };

    const elevN = TI.makeNoise2(TI.rngFrom('elev:' + seedStr));
    const moistN = TI.makeNoise2(TI.rngFrom('moist:' + seedStr));
    const S = TI.WORLD_SIZE, C = S / 2, GROUND = 0.34;

    function elevAt(x, y) {
      const d = Math.hypot(x - C, y - C) / C;
      return elevN.fbm(x * 0.0016, y * 0.0016, 4) - Math.pow(TI.clamp(d, 0, 1.2), 3) * 0.75;
    }
    function moistAt(x, y) { return moistN.fbm(x * 0.0021 + 7.7, y * 0.0021 + 3.1, 3); }

    // Flora verteilen — geclustert über Feuchtigkeitsbänder.
    // Anatomie divergiert pro Seed: karge Welten und wuchernde Welten sind beide möglich.
    const floraDensity = 380 + ((rng() * 520) | 0);
    const acceptFactor = 0.15 + rng() * 0.3;
    const flora = [];
    const hazardFlora = [];
    let guard = 0;
    while (flora.length < floraDensity && guard++ < 30000) {
      const x = rng() * S, y = rng() * S;
      if (elevAt(x, y) < GROUND + 0.015) continue;
      const m = moistAt(x, y);
      const fits = species.filter(s => m > s.band && m < s.band + 0.38);
      if (!fits.length) continue;
      if (rng() > 0.28 + m * acceptFactor) continue;
      const sp = fits[(rng() * fits.length) | 0];
      // Gesetz als Anatomie: Was brennt, steht allein. Hazard-Flora wächst isoliert —
      // nichts in ihrem Umkreis, und sie wächst in niemandes Umkreis. Der leere Ring
      // um jede Gefahr ist in einem einzigen Standbild lesbar.
      if (sp.role === 'hazard') {
        if (flora.some(f => TI.dist(f.x, f.y, x, y) < 70)) continue;
      } else if (hazardFlora.some(h => TI.dist(h.x, h.y, x, y) < 70)) continue;
      const item = { x, y, s: sp.id, ph: rng() * TI.TAU, lit: sp.role === 'beacon' ? rng() < 0.45 : false, cd: 0, echo: 0 };
      flora.push(item);
      if (sp.role === 'hazard') hazardFlora.push(item);
    }

    // Monolithen — stumme Landmarken, die niemand erklärt
    const monolithCount = 3 + ((rng() * 8) | 0);
    const monoliths = [];
    guard = 0;
    while (monoliths.length < monolithCount && guard++ < 6000) {
      const x = rng() * S, y = rng() * S;
      if (elevAt(x, y) < GROUND + 0.03) continue;
      if (monoliths.some(o => TI.dist(o.x, o.y, x, y) < 550)) continue;
      monoliths.push({ x, y, glyph: (rng() * 8) | 0, seenT: 0 });
    }

    // Schrein: Start- und Rückkehrort
    let shrine = { x: C, y: C };
    for (let r = 0; r < 1800; r += 25) {
      const a = rng() * TI.TAU, x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
      if (elevAt(x, y) > GROUND + 0.06) { shrine = { x, y }; break; }
    }

    const creatureSpec = {
      drifters: 12 + ((rng() * 6) | 0),
      watchers: 7 + ((rng() * 4) | 0),
      stalkers: 3 + ((rng() * 3) | 0),
      hueShift: rng() * 40 - 20
    };

    return {
      seed: seedStr, name, palette, laws, species, music,
      flora, monoliths, shrine, creatureSpec,
      elevAt, moistAt, GROUND, SIZE: S
    };
  };
})();
