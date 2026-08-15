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
    // Statur als Weltgesetz: ein per-Seed Faktor 0.6–2.0 skaliert ALLE Spezies,
    // plus per-Spezies Streuung — eine Welt liest sich als 'riesige Speere',
    // die nächste als 'Teppich winziger Kugeln'.
    const stature = 0.6 + rng() * 1.4;
    const species = roles.map((role, i) => ({
      id: i, role,
      shape: shapes[i],
      hue: hues[i],
      pulses: laws.pulseMeans === 'danger' ? role === 'hazard' : role === 'benefactor',
      emit: role === 'beacon' ? 1 : (rng() < 0.3 ? 0.45 : 0),
      size: (9 + rng() * 9) * stature * (0.75 + rng() * 0.5),
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

    // Monolithen — stumme Landmarken, die niemand erklärt.
    // (Vor der Flora erzeugt: das Wuchsgesetz 'rings' braucht ihre Positionen.)
    const monolithCount = 3 + ((rng() * 8) | 0);
    const monoliths = [];
    let guard = 0;
    while (monoliths.length < monolithCount && guard++ < 6000) {
      const x = rng() * S, y = rng() * S;
      if (elevAt(x, y) < GROUND + 0.03) continue;
      if (monoliths.some(o => TI.dist(o.x, o.y, x, y) < 550)) continue;
      monoliths.push({ x, y, glyph: (rng() * 8) | 0, seenT: 0 });
    }

    // WUCHSGESETZ — wie diese Welt ihren Raum füllt. Ein Gesetz pro Seed,
    // in einem einzigen Standbild lesbar:
    //   groves = dichte Haine um Mutterpunkte, leere Ebenen dazwischen
    //   veins  = Flora zeichnet Linien entlang einer Feuchte-Isolinie
    //   steppe = Blue-Noise, karg und gleichmäßig (Mindestabstand)
    //   rings  = Dichte-Maximum in Annuli um die Monolithen
    const growthLaw = pick(['groves', 'veins', 'steppe', 'rings']);

    const groveMoms = [];
    if (growthLaw === 'groves') {
      const momCount = 30 + ((rng() * 41) | 0);
      guard = 0;
      while (groveMoms.length < momCount && guard++ < 8000) {
        const x = rng() * S, y = rng() * S;
        if (elevAt(x, y) < GROUND + 0.015) continue;
        groveMoms.push({ x, y, r: 60 + rng() * 90 });
      }
    }

    // Ein Kandidaten-Ort nach dem Wuchsgesetz dieser Welt — von Kalibrierung
    // und Pflanz-Schleife gemeinsam benutzt, damit beide dieselbe Welt sehen.
    function sampleSite() {
      let x, y;
      if (growthLaw === 'groves') {
        if (!groveMoms.length) return null;
        // Poisson-Cluster: direkt im Radius eines Mutterpunkts säen.
        const mom = groveMoms[(rng() * groveMoms.length) | 0];
        const a = rng() * TI.TAU, r = Math.sqrt(rng()) * mom.r;
        x = mom.x + Math.cos(a) * r; y = mom.y + Math.sin(a) * r;
        if (x < 0 || y < 0 || x >= S || y >= S) return null;
      } else {
        x = rng() * S; y = rng() * S;
      }
      if (elevAt(x, y) < GROUND + 0.015) return null;
      const m = moistAt(x, y);
      // veins: Flora existiert nur auf der schmalen Feuchte-Isolinie — Linien im Bild.
      if (growthLaw === 'veins' && Math.abs(m - 0.5) >= 0.06) return null;
      // rings: fast alles Leben sammelt sich im Annulus um die Monolithen.
      if (growthLaw === 'rings') {
        let inRing = false;
        for (const o of monoliths) {
          const d = TI.dist(o.x, o.y, x, y);
          if (d > 120 && d < 260) { inRing = true; break; }
        }
        if (!inRing && rng() > 0.12) return null;
      }
      return { x, y, m };
    }

    // Dominanz: eine Spezies trägt 50–65% der Population — die Welt gehört ihr,
    // und sie wächst überall (kein Feuchteband bremst sie: das IST ihre Dominanz).
    // Hazard ist ausgenommen — 'Was brennt, steht allein' verträgt keinen 60%-Zensus.
    const domCandidates = species.filter(s => s.role !== 'hazard');
    const domSp = domCandidates[(rng() * domCandidates.length) | 0];
    const domShare = 0.5 + rng() * 0.15;
    // Kalibrierung: wie oft finden Nicht-Dominante an echten Wuchsorten ein
    // Feuchteband? Damit landet der realisierte Zensus wirklich bei domShare,
    // statt durch bandlose Orte systematisch darüber zu rutschen.
    let qHit = 0, qN = 0;
    for (let i = 0; i < 4000 && qN < 400; i++) {
      const site = sampleSite();
      if (!site) continue;
      qN++;
      if (species.some(s => site.m > s.band && site.m < s.band + 0.38)) qHit++;
    }
    const qCov = qN ? qHit / qN : 1;
    const domP = TI.clamp(domShare * qCov / (1 - domShare + domShare * qCov), 0.2, 0.95);

    // Flora verteilen — Dichte asymmetrisch geformt: karge UND wuchernde Welten
    // kommen wirklich vor. Guard-Abbruch wird akzeptiert, nie nachgestreut —
    // die Leere zwischen Hainen und die Kargheit der Steppe sind das Gesetz.
    let floraDensity = 140 + ((Math.pow(rng(), 1.6) * 1300) | 0);
    if (growthLaw === 'steppe') floraDensity = Math.min(floraDensity, 420);
    const acceptFactor = 0.15 + rng() * 0.3;
    const flora = [];
    const hazardFlora = [];
    guard = 0;
    while (flora.length < floraDensity && guard++ < 30000) {
      if (growthLaw === 'groves' && !groveMoms.length) break;
      const site = sampleSite();
      if (!site) continue;
      const x = site.x, y = site.y, m = site.m;
      const fits = species.filter(s => m > s.band && m < s.band + 0.38);
      if (rng() > 0.28 + m * acceptFactor) continue;
      // steppe: Blue-Noise — Mindestabstand zwischen ALLEN Flora-Items.
      if (growthLaw === 'steppe' && flora.some(f => TI.dist(f.x, f.y, x, y) < 55)) continue;
      let sp;
      if (rng() < domP) sp = domSp;
      else if (fits.length) sp = fits[(rng() * fits.length) | 0];
      else continue;
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

    // Schrein: Start- und Rückkehrort
    let shrine = { x: C, y: C };
    for (let r = 0; r < 1800; r += 25) {
      const a = rng() * TI.TAU, x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
      if (elevAt(x, y) > GROUND + 0.06) { shrine = { x, y }; break; }
    }

    // Wächter-Ring: der territoriale Jäger patrouilliert dauerhaft einen Ring um den
    // Schrein — in Sichtweite des Spawns (360–450 px: nah genug für den 1280×720-
    // Ausschnitt, fern genug, um nie sofort bedrohlich zu sein). Gewählt wird der
    // Radius mit dem höchsten Landanteil, damit der Ring begehbar bleibt.
    let wardenR = 420, wardenLand = -1;
    for (const R of [420, 390, 450, 360]) {
      let land = 0;
      for (let k = 0; k < 40; k++) {
        const a = k / 40 * TI.TAU;
        if (elevAt(shrine.x + Math.cos(a) * R, shrine.y + Math.sin(a) * R) > GROUND + 0.01) land++;
      }
      if (land > wardenLand) { wardenLand = land; wardenR = R; }
    }

    // Fauna-Zensus als Weltgesetz: swarm = das Bild lebt, wary = beobachtet werden,
    // hollow = fast leblose Welt — Stille selbst ist das lesbare Telegraph.
    const faunaProfile = pick(['swarm', 'wary', 'hollow']);
    let drifters, watchers, stalkers = 3 + ((rng() * 3) | 0);
    if (faunaProfile === 'swarm') {
      drifters = 30 + ((rng() * 16) | 0);
      watchers = 3 + ((rng() * 3) | 0);
    } else if (faunaProfile === 'wary') {
      drifters = 4 + ((rng() * 4) | 0);
      watchers = 14 + ((rng() * 7) | 0);
    } else {
      drifters = (rng() * 4) | 0;
      watchers = 2 + ((rng() * 3) | 0);
      stalkers += 1;
    }
    const creatureSpec = {
      profile: faunaProfile,
      drifters, watchers,
      stalkers: Math.max(2, stalkers), // Kriterium 5: Gefahr als Silhouette, unverhandelbar
      hueShift: rng() * 40 - 20,
      wardenR,
      wardenDir: rng() < 0.5 ? -1 : 1
    };

    return {
      seed: seedStr, name, palette, laws, species, music, growthLaw,
      flora, monoliths, shrine, creatureSpec,
      elevAt, moistAt, GROUND, SIZE: S
    };
  };
})();
