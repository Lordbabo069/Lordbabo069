// Terra Incognita — generativer Klang: Drone + Wind aus der Welt-Tonalität, Ereignisklänge.
// Das Bett atmet: Böen, Drone-Schwell, Ducking um große Momente, Hall-Raum für Ereignisse.
window.TI = window.TI || {};
(function () {
  'use strict';

  TI.sound = { on: false, ctx: null, master: null, world: null, bed: null, noteBus: null, holdCalls: 0 };

  // Helligkeit der Skala (0 = dunkel .. 1 = hell): große Terz/Sexte hell, kleine Terz/b6 dunkel.
  function scaleBrightness(sc) {
    let b = 0;
    if (sc.indexOf(4) >= 0) b++;
    if (sc.indexOf(9) >= 0) b++;
    if (sc.indexOf(3) >= 0) b--;
    if (sc.indexOf(8) >= 0) b--;
    return (b + 2) / 4;
  }

  TI.initSound = function (world) {
    if (TI.sound.on) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    TI.sound.ctx = ctx; TI.sound.master = master; TI.sound.world = world; TI.sound.on = true;

    const root = world.music.root / 2;
    const rootN = TI.clamp((world.music.root - 150) / 110, 0, 1); // 0..1, pro Seed
    const bright = scaleBrightness(world.music.scale);            // 0..1, pro Seed
    TI.sound.rootN = rootN; TI.sound.bright = bright;

    // Bett-Bus: Drone + Wind laufen hier durch — Ereignisse dürfen das Bett ducken.
    const bed = ctx.createGain();
    bed.gain.value = 1;
    bed.connect(master);
    TI.sound.bed = bed;

    // Drone: zwei entstimmte Oszillatoren durch Tiefpass.
    // Timbre pro Seed: dunkle Skalen -> tiefer Cutoff + sine, helle -> offener + triangle.
    const lp = ctx.createBiquadFilter();
    const lpBase = 260 + bright * 140;
    lp.type = 'lowpass'; lp.frequency.value = lpBase; lp.Q.value = 0.4;
    const dg = ctx.createGain(); dg.gain.value = 0.065;
    lp.connect(dg); dg.connect(bed);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = root / 2;
    const o2 = ctx.createOscillator();
    o2.type = bright >= 0.5 ? 'triangle' : 'sine';
    o2.frequency.value = root * 0.751;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 4;
    lfo.connect(lfoG); lfoG.connect(o2.detune);
    o1.connect(lp); o2.connect(lp);
    // Langsame Stimmführung: o2 ist keine eingefrorene Quinte mehr, sondern pendelt
    // alle 20–40 s (Rate pro Seed) zwischen 2–3 Skalen-Graden um die Quinte —
    // Harmonie aus der Welt-Tonalität, die sich über Minuten bewegt. Nie weiter
    // als die Nachbargrade: Kohärenz vor Zufall.
    const sc = world.music.scale;
    let fifthI = sc.indexOf(7);
    if (fifthI < 0) { fifthI = 0; for (let i = 1; i < sc.length; i++) if (Math.abs(sc[i] - 7) < Math.abs(sc[fifthI] - 7)) fifthI = i; }
    const pend = [
      sc[Math.max(0, fifthI - 1)],
      sc[fifthI],
      fifthI + 1 < sc.length ? sc[fifthI + 1] : sc[0] + 12
    ];
    const detuneK = (0.751 * 2) / Math.pow(2, 7 / 12); // seed-typische Schwebung gegen o1 bleibt
    let inverted = false;                              // nightInverts: nachts gespiegelte Stimme
    let pendSt = pend[1];
    function o2Freq(st) {
      // Gespiegelt = Intervall-Umkehrung um o1: die Quinte wird zur dunkleren Quarte.
      const s2 = inverted ? 12 - st : st;
      return (root / 2) * Math.pow(2, s2 / 12) * detuneK;
    }
    let vlStep = 0;
    const vlWalk = [1, 2, 1, 0]; // Quinte -> oben -> Quinte -> unten, Pendel statt Würfel
    setInterval(function () {
      vlStep = (vlStep + 1) % vlWalk.length;
      pendSt = pend[vlWalk[vlStep]];
      o2.frequency.setTargetAtTime(o2Freq(pendSt), ctx.currentTime, 4);
    }, (20 + rootN * 20) * 1000);
    // Atem des Drones: sehr langsamer Schwell (Periode 45–90 s, Rate pro Seed),
    // das Bett verschwindet fast und kehrt wieder — Tiefendröhnen statt Dauerton.
    const breath = ctx.createOscillator();
    breath.frequency.value = 1 / (90 - rootN * 45);
    const breathG = ctx.createGain(); breathG.gain.value = 0.035; // 0.065 ± 0.035 -> 0.03..0.10
    breath.connect(breathG); breathG.connect(dg.gain);
    o1.start(); o2.start(); lfo.start(); breath.start();

    // Wind: gefiltertes Rauschen, langsam wandernd
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    // Windfarbe pro Seed: helle Skalen pfeifen höher, tiefe Wurzeln singen enger.
    // Zwei leicht verstimmte Bandpässe links/rechts geben dem Bett Raumbreite.
    const wBase = 300 + bright * 360;
    const wQ = 1.2 + rootN * 1.2;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = wBase; bp.Q.value = wQ;
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass'; bp2.frequency.value = wBase * 1.12; bp2.Q.value = wQ;
    const wLfo = ctx.createOscillator(); wLfo.frequency.value = 0.055;
    const wLfoG = ctx.createGain(); wLfoG.gain.value = 240;
    wLfo.connect(wLfoG); wLfoG.connect(bp.frequency); wLfoG.connect(bp2.frequency);
    const wg = ctx.createGain(); wg.gain.value = 0.04;
    // Böen statt Konstante: zweiter Langsam-LFO auf die Windlautstärke (0.01..0.07),
    // Rate aus der Welt-Tonalität abgeleitet, damit jede Welt anders böt.
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.022 + rootN * 0.016; // ~0.03 Hz, pro Seed verschoben
    const gustG = ctx.createGain(); gustG.gain.value = 0.03; // 0.04 ± 0.03
    gust.connect(gustG); gustG.connect(wg.gain);
    src.connect(bp); src.connect(bp2);
    if (ctx.createStereoPanner) {
      const pnL = ctx.createStereoPanner(); pnL.pan.value = -0.5;
      const pnR = ctx.createStereoPanner(); pnR.pan.value = 0.5;
      bp.connect(pnL); bp2.connect(pnR); pnL.connect(wg); pnR.connect(wg);
    } else { bp.connect(wg); bp2.connect(wg); }
    wg.connect(bed);
    src.start(); wLfo.start(); gust.start();

    // Nachtschicht: ein Sub-Drone unter allem, tags stumm. Alle 250 ms liest das Bett
    // den Weltzustand — nachts öffnet sich die Tiefe, der Wind dünnt aus, der Tiefpass
    // schließt sich. Die Seed-Basistimbres (bright/rootN) bleiben unberührt.
    const sub = ctx.createOscillator();
    sub.type = 'sine'; sub.frequency.value = root / 4;
    const nightG = ctx.createGain(); nightG.gain.value = 0;
    sub.connect(nightG); nightG.connect(bed);
    sub.start();
    setInterval(function () {
      if (!TI.debug || !TI.debug.state || !TI.nightness) return;
      const n = TI.nightness(TI.debug.state.tod);
      const t = ctx.currentTime;
      // setTargetAtTime mit tc 0.7 s -> ~2 s bis zum Ziel, ohne Ramp-Knackser.
      nightG.gain.setTargetAtTime(n * 0.05, t, 0.7);
      lp.frequency.setTargetAtTime(lpBase * (1 - 0.45 * n), t, 0.7);
      wg.gain.setTargetAtTime(0.04 * (1 - 0.5 * n), t, 0.7);
      // nightInverts hörbar: die Zwillinge tauschen die Plätze auch im Klang —
      // beim Überschreiten von n>0.5 gleitet o2 auf den gespiegelten, dunkleren
      // Grad (tc 3 s), bei Tag zurück. Welten ohne dieses Gesetz behalten die
      // reine Vertiefung — Gesetze bleiben divergent.
      if (world.laws && world.laws.nightInverts) {
        const nowInv = n > 0.5;
        if (nowInv !== inverted) {
          inverted = nowInv;
          o2.frequency.setTargetAtTime(o2Freq(pendSt), t, 3);
        }
      }
    }, 250);

    // Send-Bus: Feedback-Delay mit Tiefpass in der Schleife — der Raum der Leere.
    // Ereignisklänge (TI.note) gehen zu ~25% hinein, das Bett bleibt trocken.
    const noteBus = ctx.createGain(); noteBus.gain.value = 1;
    noteBus.connect(master);
    const send = ctx.createGain(); send.gain.value = 0.25;
    const dly = ctx.createDelay(2);
    dly.delayTime.value = 0.38 + rootN * 0.14; // ~0.45 s, pro Seed divergent
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass'; dlp.frequency.value = 1500;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    noteBus.connect(send); send.connect(dly);
    dly.connect(dlp); dlp.connect(fb); fb.connect(dly);
    dlp.connect(master);
    TI.sound.noteBus = noteBus;

    // Blüh-Bus für Erkenntnis-Momente: wie noteBus, aber mit zusätzlichem Send
    // in den Delay-Raum (0.25 + 0.15 ≈ 0.4) — 'discovery'/'kindle' blühen nach
    // wie das Lagerfeuer-Thema, statt als trockener Sinus zu enden.
    const bloom = ctx.createGain(); bloom.gain.value = 1;
    bloom.connect(noteBus);
    const bloomSend = ctx.createGain(); bloomSend.gain.value = 0.15;
    bloom.connect(bloomSend); bloomSend.connect(dly);
    TI.sound.bloomBus = bloom;

    // Glints: seltene, einzelne Skalen-Noten 2–3 Oktaven über dem Drone-Grund —
    // die Fernenebene über dem Wind (Grand-Reef-Spektrum). Weich (Attack 0.4 s),
    // leise, weit gepannt, durch den noteBus, damit sie im Delay-Raum verblühen.
    // Nachts häufiger, tags seltener; Grundintervall pro Seed aus rootN.
    function scheduleGlint() {
      const n = (TI.debug && TI.debug.state && TI.nightness) ? TI.nightness(TI.debug.state.tod) : 0;
      const iv = (20 + rootN * 20) * (1.7 - n); // Tag ~34–68 s, Nacht ~14–28 s
      setTimeout(function () {
        if (TI.sound.on && !(TI.sound.holdCalls && ctx.currentTime < TI.sound.holdCalls)) {
          const nSc = world.music.scale.length;
          const deg = nSc * (1 + ((Math.random() * 2) | 0)) + ((Math.random() * nSc) | 0);
          const pan = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.3);
          TI.note(deg, 2.5 + Math.random() * 1.5, 0, 0.015 + Math.random() * 0.015, 'sine', pan, 0.4);
        }
        scheduleGlint();
      }, iv * 1000);
    }
    scheduleGlint();
  };

  // Bett um einen großen Moment herum ducken: schnell weg, halten, zurück.
  // Stille rahmt den Moment — die Lagerfeuer-Ruhe vor dem Signal.
  // floor/holdDur/releaseDur formen die Stille: 'discovery' kurz und warm,
  // 'monolith' echtes Nichts mit langem Atem zurück.
  function duckBed(when, floor, holdDur, releaseDur) {
    const bed = TI.sound.bed;
    if (!bed) return;
    const t = TI.sound.ctx.currentTime + (when || 0);
    const f = floor || 0.05, h = holdDur || 1.2, r = releaseDur || 3;
    bed.gain.cancelScheduledValues(t);
    bed.gain.setValueAtTime(bed.gain.value, t);
    bed.gain.linearRampToValueAtTime(f, t + 0.1);
    bed.gain.setValueAtTime(f, t + 0.1 + h);
    bed.gain.linearRampToValueAtTime(1, t + 0.1 + h + r);
  }

  function freqOf(deg) {
    const w = TI.sound.world;
    const sc = w.music.scale, n = sc.length;
    const oct = Math.floor(deg / n), st = sc[((deg % n) + n) % n];
    return w.music.root * Math.pow(2, oct + st / 12);
  }

  TI.note = function (deg, dur, when, vol, type, pan, attack, dest) {
    if (!TI.sound.on) return;
    const ctx = TI.sound.ctx, t0 = ctx.currentTime + (when || 0);
    const D = dur || 0.5;
    const atk = Math.min(attack || 0.02, D * 0.8);
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freqOf(deg);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + D);
    let out = g;
    if (pan && ctx.createStereoPanner) {
      const pn = ctx.createStereoPanner();
      pn.pan.value = TI.clamp(pan, -1, 1);
      g.connect(pn); out = pn;
    }
    o.connect(g);
    // Wärme statt Piepsen: Sinustöne bekommen einen zweiten, +7 Cent verstimmten
    // Oszillator bei halber Lautstärke — langsame Schwebung statt trockener Sinus.
    let ow = null;
    if ((type || 'sine') === 'sine') {
      ow = ctx.createOscillator();
      ow.type = 'sine';
      ow.frequency.value = o.frequency.value;
      ow.detune.value = 7;
      const gw = ctx.createGain(); gw.gain.value = 0.5;
      ow.connect(gw); gw.connect(g);
    }
    out.connect(dest || TI.sound.noteBus || TI.sound.master);
    o.start(t0); o.stop(t0 + D + 0.1);
    if (ow) { ow.start(t0); ow.stop(t0 + D + 0.1); }
  };

  // Schläge sind der Welt-Tonalität entnommen: Start als Verhältnis zur Wurzel,
  // Abklingen in den Sub-Grund (root/4) — dieselbe Tiefe, in die nachts das Bett sinkt.
  function thud(vol, ratio) {
    if (!TI.sound.on) return;
    const ctx = TI.sound.ctx, t0 = ctx.currentTime;
    const root = TI.sound.world.music.root;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(root * (ratio || 0.7), t0);
    o.frequency.exponentialRampToValueAtTime(root / 4, t0 + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    o.connect(g); g.connect(TI.sound.master);
    o.start(t0); o.stop(t0 + 0.4);
  }

  // Das 2-Ton-Rufmotiv der Welt: eine Stimme, kein Zufall — festes Motiv pro Seed.
  // Ein dunkler Ruf ist ein ferner Ruf: Per-Call-Tiefpass, Lautstärke folgt dem Cutoff
  // beim Aufrufer. Respektiert holdCalls (Stille um große Momente).
  function callMotif(when, vol, pan, cutoff) {
    const s = TI.sound;
    if (!s.on) return;
    const ctx = s.ctx;
    if (s.holdCalls && ctx.currentTime + (when || 0) < s.holdCalls) return;
    const deg1 = 5 + ((s.rootN * 3) | 0);
    const deg2 = deg1 + (s.bright >= 0.5 ? 2 : 1);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = cutoff; flt.Q.value = 0.5;
    flt.connect(s.noteBus || s.master);
    TI.note(deg1, 0.8, when || 0, vol, 'sine', pan, 0.06, flt);
    TI.note(deg2, 1.3, (when || 0) + 0.5, vol * 0.85, 'sine', pan, 0.06, flt);
  }

  TI.sfx = function (name, opt) {
    if (!TI.sound.on) return;
    opt = opt || {};
    switch (name) {
      case 'touch': {
        TI.note(1 + ((Math.random() * 3) | 0), 0.35, 0, 0.09, 'triangle');
        // touchEchoes telegraphieren: die Welt antwortet — nach 1.2–2 s kommt
        // dasselbe Rufmotiv leise, dumpf und weit von der Seite zurück.
        // Gesetz als Klang, ohne Text; Welten ohne das Gesetz bleiben stumm.
        const w = TI.sound.world;
        if (w && w.laws && w.laws.touchEchoes) {
          const side = (Math.random() < 0.5 ? -1 : 1) * 0.85;
          callMotif(1.2 + Math.random() * 0.8, 0.03, side, 500);
        }
        break;
      }
      case 'heal': TI.note(0, 0.5, 0, 0.1); TI.note(2, 0.6, 0.09, 0.09); break;
      case 'hurt': thud(0.32, 0.8); break;
      case 'maul': thud(0.45, 0.55); TI.note(-3, 0.4, 0.02, 0.1, 'sawtooth'); break;
      case 'kindle':
        TI.note(4, 1.4, 0, 0.07, 'sine', 0, 0, TI.sound.bloomBus);
        TI.note(7, 1.8, 0.12, 0.05, 'sine', 0, 0, TI.sound.bloomBus);
        break;
      case 'surge': for (let i = 0; i < 5; i++) TI.note(i * 2, 0.9, i * 0.07, 0.06); break;
      case 'discovery':
        // Stille rahmt die Erkenntnis: das Bett fällt weg, ein Atemzug Nichts,
        // erst dann der erste Ton. Danach schweigen die Rufe eine Weile.
        duckBed(0);
        TI.sound.holdCalls = TI.sound.ctx.currentTime + 8;
        // Durch den Blüh-Bus: der Erkenntnis-Moment blüht im Delay-Raum nach.
        TI.note(0, 0.8, 0.6, 0.13, 'sine', 0, 0, TI.sound.bloomBus);
        TI.note(2, 0.8, 0.76, 0.12, 'sine', 0, 0, TI.sound.bloomBus);
        TI.note(4, 1.6, 0.92, 0.12, 'sine', 0, 0, TI.sound.bloomBus);
        TI.note(4 + 5, 2.2, 0.94, 0.05, 'sine', 0, 0.15, TI.sound.bloomBus);
        break;
      case 'call': {
        // 30% bleiben aus — Stille als Mittel. Motiv und Ferne (Cutoff) siehe callMotif.
        if (Math.random() < 0.3) break;
        const cut = 500 + Math.random() * 1100;
        callMotif(0, 0.045 * (cut / 1600), opt.pan || 0, cut);
        break;
      }
      case 'monolith':
        // Echte Stille: das Bett fällt auf fast Nichts, hält 2 s den Atem an,
        // und kehrt über 8 s zurück, während der Stein längst summt.
        duckBed(0, 0.001, 2, 8);
        TI.sound.holdCalls = TI.sound.ctx.currentTime + 8;
        // Der Stein schwillt an und summt — kein Anschlag.
        TI.note(-7, 3.5, 0, 0.14, 'sine', 0, 1.1);
        TI.note(-7, 3.5, 0.05, 0.08, 'triangle', 0, 0.9);
        break;
    }
  };
})();
