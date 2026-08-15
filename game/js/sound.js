// Terra Incognita — generativer Klang: Drone + Wind aus der Welt-Tonalität, Ereignisklänge.
window.TI = window.TI || {};
(function () {
  'use strict';

  TI.sound = { on: false, ctx: null, master: null, world: null };

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

    // Drone: zwei entstimmte Oszillatoren durch Tiefpass
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 340; lp.Q.value = 0.4;
    const dg = ctx.createGain(); dg.gain.value = 0.085;
    lp.connect(dg); dg.connect(master);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = root / 2;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = root * 0.751;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 4;
    lfo.connect(lfoG); lfoG.connect(o2.detune);
    o1.connect(lp); o2.connect(lp);
    o1.start(); o2.start(); lfo.start();

    // Wind: gefiltertes Rauschen, langsam wandernd
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.5;
    const wLfo = ctx.createOscillator(); wLfo.frequency.value = 0.055;
    const wLfoG = ctx.createGain(); wLfoG.gain.value = 240;
    wLfo.connect(wLfoG); wLfoG.connect(bp.frequency);
    const wg = ctx.createGain(); wg.gain.value = 0.045;
    src.connect(bp); bp.connect(wg); wg.connect(master);
    src.start(); wLfo.start();
  };

  function freqOf(deg) {
    const w = TI.sound.world;
    const sc = w.music.scale, n = sc.length;
    const oct = Math.floor(deg / n), st = sc[((deg % n) + n) % n];
    return w.music.root * Math.pow(2, oct + st / 12);
  }

  TI.note = function (deg, dur, when, vol, type, pan) {
    if (!TI.sound.on) return;
    const ctx = TI.sound.ctx, t0 = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freqOf(deg);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.5));
    let out = g;
    if (pan && ctx.createStereoPanner) {
      const pn = ctx.createStereoPanner();
      pn.pan.value = TI.clamp(pan, -1, 1);
      g.connect(pn); out = pn;
    }
    o.connect(g); out.connect(TI.sound.master);
    o.start(t0); o.stop(t0 + (dur || 0.5) + 0.1);
  };

  function thud(vol, pitch) {
    if (!TI.sound.on) return;
    const ctx = TI.sound.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(pitch || 120, t0);
    o.frequency.exponentialRampToValueAtTime(38, t0 + 0.28);
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
      case 'hurt': thud(0.32, 130); break;
      case 'maul': thud(0.45, 90); TI.note(-3, 0.4, 0.02, 0.1, 'sawtooth'); break;
      case 'kindle': TI.note(4, 1.4, 0, 0.07); TI.note(7, 1.8, 0.12, 0.05); break;
      case 'surge': for (let i = 0; i < 5; i++) TI.note(i * 2, 0.9, i * 0.07, 0.06); break;
      case 'discovery':
        TI.note(0, 0.8, 0, 0.13); TI.note(2, 0.8, 0.16, 0.12); TI.note(4, 1.6, 0.32, 0.12);
        TI.note(4 + 5, 2.2, 0.34, 0.05);
        break;
      case 'call': TI.note(5 + ((Math.random() * 4) | 0), 1.3, 0, 0.045, 'sine', opt.pan || 0); break;
      case 'monolith': TI.note(-7, 3.5, 0, 0.14, 'sine'); TI.note(-7, 3.5, 0.05, 0.08, 'triangle'); break;
    }
  };
})();
