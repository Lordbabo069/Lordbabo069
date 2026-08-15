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
  };

  // Bett um einen großen Moment herum ducken: schnell weg, kurz halten, langsam zurück.
  // Stille rahmt den Moment — die Lagerfeuer-Ruhe vor dem Signal.
  function duckBed(when) {
    const bed = TI.sound.bed;
    if (!bed) return;
    const t = TI.sound.ctx.currentTime + (when || 0);
    bed.gain.cancelScheduledValues(t);
    bed.gain.setValueAtTime(bed.gain.value, t);
    bed.gain.linearRampToValueAtTime(0.05, t + 0.1);
    bed.gain.setValueAtTime(0.05, t + 1.3);
    bed.gain.linearRampToValueAtTime(1, t + 4.3);
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
    o.connect(g); out.connect(dest || TI.sound.noteBus || TI.sound.master);
    o.start(t0); o.stop(t0 + D + 0.1);
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

  TI.sfx = function (name, opt) {
    if (!TI.sound.on) return;
    opt = opt || {};
    switch (name) {
      case 'touch': TI.note(1 + ((Math.random() * 3) | 0), 0.35, 0, 0.09, 'triangle'); break;
      case 'heal': TI.note(0, 0.5, 0, 0.1); TI.note(2, 0.6, 0.09, 0.09); break;
      case 'hurt': thud(0.32, 0.8); break;
      case 'maul': thud(0.45, 0.55); TI.note(-3, 0.4, 0.02, 0.1, 'sawtooth'); break;
      case 'kindle': TI.note(4, 1.4, 0, 0.07); TI.note(7, 1.8, 0.12, 0.05); break;
      case 'surge': for (let i = 0; i < 5; i++) TI.note(i * 2, 0.9, i * 0.07, 0.06); break;
      case 'discovery':
        // Stille rahmt die Erkenntnis: das Bett fällt weg, ein Atemzug Nichts,
        // erst dann der erste Ton. Danach schweigen die Rufe eine Weile.
        duckBed(0);
        TI.sound.holdCalls = TI.sound.ctx.currentTime + 8;
        TI.note(0, 0.8, 0.6, 0.13); TI.note(2, 0.8, 0.76, 0.12); TI.note(4, 1.6, 0.92, 0.12);
        TI.note(4 + 5, 2.2, 0.94, 0.05, 'sine', 0, 0.15);
        break;
      case 'call': {
        // Rufe sind eine Stimme, kein Zufall: festes 2-Ton-Motiv pro Seed.
        // 30% bleiben aus — Stille als Mittel. Ein dunkler Ruf ist ein ferner Ruf:
        // Per-Call-Tiefpass, Lautstärke folgt dem Cutoff.
        const ctx = TI.sound.ctx;
        if (TI.sound.holdCalls && ctx.currentTime < TI.sound.holdCalls) break;
        if (Math.random() < 0.3) break;
        const deg1 = 5 + ((TI.sound.rootN * 3) | 0);
        const deg2 = deg1 + (TI.sound.bright >= 0.5 ? 2 : 1);
        const cut = 500 + Math.random() * 1100;
        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.value = cut; flt.Q.value = 0.5;
        flt.connect(TI.sound.noteBus || TI.sound.master);
        const vol = 0.045 * (cut / 1600);
        TI.note(deg1, 0.8, 0, vol, 'sine', opt.pan || 0, 0.06, flt);
        TI.note(deg2, 1.3, 0.5, vol * 0.85, 'sine', opt.pan || 0, 0.06, flt);
        break;
      }
      case 'monolith':
        duckBed(0);
        TI.sound.holdCalls = TI.sound.ctx.currentTime + 8;
        // Der Stein schwillt an und summt — kein Anschlag.
        TI.note(-7, 3.5, 0, 0.14, 'sine', 0, 1.1);
        TI.note(-7, 3.5, 0.05, 0.08, 'triangle', 0, 0.9);
        break;
    }
  };
})();
