// Terra Incognita — Renderpipeline: Terrain, Flora, Licht, Nebel, Nacht, Körnung.
window.TI = window.TI || {};
(function () {
  'use strict';

  // Lokale Glättung (core.js bleibt unangetastet)
  const smoothstep = (a, b, x) => {
    const t = TI.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  TI.initAtmosphere = function (state) {
    const w = state.world;
    const RES = 1050, K = w.SIZE / RES;
    const tc = document.createElement('canvas');
    tc.width = tc.height = RES;
    const t = tc.getContext('2d');
    const img = t.createImageData(RES, RES);
    const d = img.data;
    const P = w.palette;
    const jit = TI.rngFrom('jit:' + w.seed);
    for (let y = 0; y < RES; y++) {
      for (let x = 0; x < RES; x++) {
        const wx = x * K, wy = y * K;
        const e = w.elevAt(wx, wy);
        const m = w.moistAt(wx, wy);
        let h, s, l;
        if (e < 0.18) { h = P.baseHue; s = 30; l = 2.5; }
        else if (e < w.GROUND) {
          const depth = TI.clamp((w.GROUND - e) / 0.16, 0, 1);
          h = P.hueB; s = 36; l = TI.lerp(9, 3.5, depth);
        } else if (e < w.GROUND + 0.03) {
          h = P.baseHue + 10; s = P.groundSat * 0.7; l = P.groundLight + 5;
        } else {
          h = TI.lerp(P.baseHue, P.hueB, TI.clamp(m * 0.65, 0, 1));
          s = P.groundSat * (0.7 + m * 0.6);
          l = P.groundLight * (0.85 + (e - 0.4) * 1.1) + m * 4;
        }
        l += (jit() - 0.5) * 2.2;
        const rgb = TI.hslToRgb(h, TI.clamp(s, 0, 100), TI.clamp(l, 0, 100));
        const i = (y * RES + x) * 4;
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
      }
    }
    t.putImageData(img, 0, 0);
    state.terrain = tc;
    state.terrainK = K;

    // Nebeltextur: weiche Blobs, vorab in Nebelfarbe getönt
    const fog = document.createElement('canvas');
    fog.width = fog.height = 512;
    const fc = fog.getContext('2d');
    const fr = TI.rngFrom('fog:' + w.seed);
    for (let i = 0; i < 90; i++) {
      const x = fr() * 512, y = fr() * 512, r = 40 + fr() * 90;
      const g = fc.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, TI.hsl(P.fogHue, 30, 42, 0.05 + fr() * 0.05));
      g.addColorStop(1, TI.hsl(P.fogHue, 30, 42, 0));
      fc.fillStyle = g;
      fc.beginPath(); fc.arc(x, y, r, 0, TI.TAU); fc.fill();
    }
    state.fogTex = fog;

    // Ferne, hellere Nebelschicht: eigene Textur, +8 Lightness — Tiefenebene hinter den Bänken
    const fogFar = document.createElement('canvas');
    fogFar.width = fogFar.height = 512;
    const ffc = fogFar.getContext('2d');
    const ffr = TI.rngFrom('fogfar:' + w.seed);
    for (let i = 0; i < 70; i++) {
      const x = ffr() * 512, y = ffr() * 512, r = 60 + ffr() * 120;
      const g = ffc.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, TI.hsl(P.fogHue, 26, 50, 0.05 + ffr() * 0.05));
      g.addColorStop(1, TI.hsl(P.fogHue, 26, 50, 0));
      ffc.fillStyle = g;
      ffc.beginPath(); ffc.arc(x, y, r, 0, TI.TAU); ffc.fill();
    }
    state.fogTexFar = fogFar;

    // Kachelränder beider Nebeltexturen auf Alpha 0 ausblenden: da jede Kachelzelle
    // eine eigene Bank-Dichte bekommt, dürfen an den Zellgrenzen keine harten
    // Alphastufen aufeinandertreffen (sonst Naht-Linien im Bild).
    for (const c2d of [fc, ffc]) {
      c2d.globalCompositeOperation = 'destination-out';
      const F = 46;
      let g = c2d.createLinearGradient(0, 0, 0, F);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c2d.fillStyle = g; c2d.fillRect(0, 0, 512, F);
      g = c2d.createLinearGradient(0, 512, 0, 512 - F);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c2d.fillStyle = g; c2d.fillRect(0, 512 - F, 512, F);
      g = c2d.createLinearGradient(0, 0, F, 0);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c2d.fillStyle = g; c2d.fillRect(0, 0, F, 512);
      g = c2d.createLinearGradient(512, 0, 512 - F, 0);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c2d.fillStyle = g; c2d.fillRect(512 - F, 0, F, 512);
      c2d.globalCompositeOperation = 'source-over';
    }

    // Weltlicht-Textur: 8–12 sehr große weiche Zonen — Wolkenschatten & Lichtinseln am Tag.
    // Jeder Blob wird 3x3-gewrappt gezeichnet, damit die Kachelung nahtlos bleibt.
    const shade = document.createElement('canvas');
    shade.width = shade.height = 512;
    const shc = shade.getContext('2d');
    const shr = TI.rngFrom('shade:' + w.seed);
    const nShade = 8 + ((shr() * 5) | 0);
    for (let i = 0; i < nShade; i++) {
      const bx = shr() * 512, by = shr() * 512, br = 130 + shr() * 190;
      const isDark = shr() < 0.62;
      const a = isDark ? 0.12 + shr() * 0.18 : 0.05 + shr() * 0.06; // Dunkelanteile bis ~0.30
      const col = isDark ? [P.baseHue, 35, 4] : [P.baseHue, 22, 74];
      for (let dx = -512; dx <= 512; dx += 512) {
        for (let dy = -512; dy <= 512; dy += 512) {
          const x = bx + dx, y = by + dy;
          if (x + br < 0 || y + br < 0 || x - br > 512 || y - br > 512) continue;
          const g = shc.createRadialGradient(x, y, 0, x, y, br);
          g.addColorStop(0, TI.hsl(col[0], col[1], col[2], a));
          g.addColorStop(1, TI.hsl(col[0], col[1], col[2], 0));
          shc.fillStyle = g;
          shc.beginPath(); shc.arc(x, y, br, 0, TI.TAU); shc.fill();
        }
      }
    }
    state.shadeTex = shade;

    // Seed-gebundene Phase für ortsabhängige Nebelbänke
    state.seedPhase = (TI.hash('phase:' + w.seed)() % 6283) / 1000;

    // ——— Fernebene: Horizontband — Tiefe & Maßstab ———
    // Am oberen Bildrand liegt die Ferne: ein wirklich großes, unerreichbares Ding
    // (pro Seed Bergrücken ODER Über-Monolith, pro Seed positioniert) plus ferne
    // Leucht-Cluster aus der echten Flora dieser Welt — auf zwei Distanzstufen,
    // hinter der hintersten Nebelschicht gezeichnet, mit minimaler Parallaxe.
    {
      const hr = TI.rngFrom('horizon:' + w.seed);
      const HTW = 1536, HTH = 300;
      const hc = document.createElement('canvas');
      hc.width = HTW; hc.height = HTH;
      const h2 = hc.getContext('2d');
      const kind = hr() < 0.55 ? 'ridge' : 'colossus';
      // Silhouetten-Füllung: Luftperspektive — oben leicht zur Nebelfarbe aufgehellt
      const silFill = (top) => {
        const g = h2.createLinearGradient(0, top, 0, HTH);
        g.addColorStop(0, TI.hsl(P.fogHue, 12, 33));
        g.addColorStop(1, TI.hsl(P.fogHue, 18, 13));
        return g;
      };
      if (kind === 'ridge') {
        // Bergrücken: Zufallswanderung mit EINEM dominanten Gipfel; Enden angeglichen,
        // damit die Kachelung nahtlos bleibt.
        const step = 32, n = HTW / step;
        const raw = []; let yv = HTH * 0.62;
        for (let i = 0; i <= n; i++) { raw.push(yv); yv += (hr() - 0.5) * 30; yv = TI.clamp(yv, HTH * 0.42, HTH * 0.78); }
        const drift = raw[n] - raw[0];
        const peakU = HTW * (0.2 + hr() * 0.6), peakW = 260 + hr() * 320, peakH = 130 + hr() * 100;
        h2.beginPath(); h2.moveTo(0, HTH);
        for (let i = 0; i <= n; i++) {
          const x = i * step;
          const pk = Math.exp(-((x - peakU) * (x - peakU)) / (2 * peakW * peakW)) * peakH;
          h2.lineTo(x, raw[i] - drift * (i / n) - pk);
        }
        h2.lineTo(HTW, HTH); h2.closePath();
        h2.fillStyle = silFill(HTH * 0.2);
        h2.fill();
      } else {
        // Über-Monolith: die Anatomie der nahen Monolithen, ins Kolossale skaliert —
        // plus 1–2 kleinere Geschwister als Staffelung.
        const slabs = 1 + ((hr() * 2.4) | 0);
        for (let i = 0; i < slabs; i++) {
          const main = i === 0;
          const bx = HTW * (0.12 + hr() * 0.76);
          const bw = main ? 110 + hr() * 90 : 40 + hr() * 40;
          const topY = main ? 8 + hr() * 30 : HTH * (0.3 + hr() * 0.2);
          const lean = (hr() - 0.5) * bw * 0.5;
          h2.beginPath();
          h2.moveTo(bx - bw * 0.5, HTH);
          h2.lineTo(bx - bw * 0.34 + lean, topY);
          h2.lineTo(bx + bw * 0.36 + lean, topY + bw * 0.16);
          h2.lineTo(bx + bw * 0.55, HTH);
          h2.closePath();
          h2.fillStyle = silFill(topY);
          h2.fill();
        }
      }
      // Unterkante weich in den Boden setzen — langer, geglätteter Verlauf,
      // damit auf großen dunklen Flächen keine sichtbare Kante entsteht.
      h2.globalCompositeOperation = 'destination-out';
      const bg = h2.createLinearGradient(0, HTH * 0.34, 0, HTH);
      bg.addColorStop(0, 'rgba(0,0,0,0)');
      bg.addColorStop(0.45, 'rgba(0,0,0,0.3)');
      bg.addColorStop(0.75, 'rgba(0,0,0,0.72)');
      bg.addColorStop(1, 'rgba(0,0,0,1)');
      h2.fillStyle = bg; h2.fillRect(0, HTH * 0.34, HTW, HTH * 0.66);
      h2.globalCompositeOperation = 'source-over';

      // Ferne Leucht-Cluster: aus world.flora gesampelt (nur, was wirklich leuchtet) —
      // eine karge Welt bleibt auch am Horizont karg. Zwei Distanzstufen:
      // 'back' liegt hinter der Silhouette, 'front' schwebt davor (Grand-Reef-Sog).
      const emitters = w.flora.filter(f => { const sp = w.species[f.s]; return sp.emit > 0 || sp.pulses || f.lit; });
      const clusters = [];
      const want = Math.min(24, Math.ceil(emitters.length * 0.25));
      const stride = Math.max(1, (emitters.length / (want || 1)) | 0);
      for (let i = 0; i < emitters.length && clusters.length < want; i += stride) {
        const f = emitters[i]; const sp = w.species[f.s];
        const back = hr() < 0.55;
        clusters.push({
          u: (f.x / w.SIZE) * HTW + (hr() - 0.5) * 40,
          yk: back ? 0.2 + hr() * 0.32 : 0.5 + hr() * 0.3,
          r: back ? 5 + hr() * 9 : 9 + hr() * 15,
          hue: sp.hue, ph: f.ph,
          pulses: !!sp.pulses,
          back
        });
      }
      state.horizon = { tex: hc, HTW, HTH, kind, par: 0.022 + hr() * 0.02, clusters };
    }

    // Filmkorn
    const gr = document.createElement('canvas');
    gr.width = gr.height = 256;
    const gc = gr.getContext('2d');
    const gd = gc.createImageData(256, 256);
    for (let i = 0; i < gd.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      gd.data[i] = gd.data[i + 1] = gd.data[i + 2] = v;
      gd.data[i + 3] = 14;
    }
    gc.putImageData(gd, 0, 0);
    state.grainTex = gr;

    // Schwebeteilchen
    state.motes = [];
    for (let i = 0; i < 110; i++) {
      state.motes.push({ x: Math.random() * 1600, y: Math.random() * 1000, z: 0.5 + Math.random(), ph: Math.random() * TI.TAU });
    }
    state.bursts = [];
    state.lights = [];
  };

  TI.spawnBurst = function (state, x, y, hue, n, spread, up) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TI.TAU, s = Math.random() * (spread || 40);
      state.bursts.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - (up || 12),
        life: 0.9 + Math.random() * 0.9, age: 0,
        hue, size: 1 + Math.random() * 2.4
      });
    }
  };

  function drawFlora(ctx, state, f, sp, sx, sy, nightness) {
    const t = state.t;
    const P = state.world.palette;
    const pulse = sp.pulses ? 0.55 + 0.45 * Math.sin(t * 2.6 + f.ph) : 1;
    const glow = TI.clamp(pulse * (0.5 + sp.emit) + f.echo, 0, 1.6);
    const size = sp.size;
    // Farbdisziplin am Tag: Glow-Hue wird zur näheren Palettenfamilie gezogen;
    // nachts (nightness→1) bleibt der Arten-Hue voll erhalten.
    const hueTarget = (Math.abs(sp.hue - P.baseHue) % 360 < Math.abs(sp.hue - P.hueB) % 360) ? P.baseHue : P.hueB;
    const hue = TI.lerp(sp.hue, hueTarget, 0.45 * (1 - nightness));
    const sway = Math.sin(t * 0.9 + f.ph) * 1.6;

    // weicher Grundschein
    if (sp.emit > 0 || f.lit || f.echo > 0 || sp.pulses) {
      const r = size * (2.2 + glow);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      // nicht-pulsierende Emitter: tagsüber 0.04 statt 0.08 — das Licht gehört der Nacht
      const baseA = (sp.emit > 0 && !f.lit && !sp.pulses) ? TI.lerp(0.04, 0.08, nightness) : 0.16;
      g.addColorStop(0, TI.hsl(hue, 70, 55, baseA * glow + (f.lit ? 0.2 : 0)));
      g.addColorStop(1, TI.hsl(hue, 70, 55, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TI.TAU); ctx.fill();
    }

    // Nicht-leuchtende Flora fällt nachts zur Silhouette ab
    const sil = (sp.emit === 0 && !f.lit && !sp.pulses) ? 1 - 0.7 * nightness : 1;
    ctx.strokeStyle = TI.hsl(hue, 45, (30 + 25 * pulse) * sil, 0.9);
    ctx.fillStyle = TI.hsl(hue, 55, (34 + 30 * pulse) * sil, 0.92);
    ctx.lineWidth = 1.6;

    if (sp.shape === 'orb') {
      ctx.beginPath(); ctx.arc(sx + sway * 0.3, sy - size * 0.4, size * 0.55, 0, TI.TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sway * 0.3, sy - size * 0.4 + size * 0.5); ctx.stroke();
    } else if (sp.shape === 'stalk') {
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + sway, sy - size * 0.7, sx + sway * 1.4, sy - size * 1.35); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx + sway * 1.4, sy - size * 1.35, size * 0.3, 0, TI.TAU); ctx.fill();
    } else if (sp.shape === 'fan') {
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + i * 2 + sway, sy - size * 0.6, sx + i * size * 0.35 + sway, sy - size * (0.9 + Math.abs(i) * -0.12));
        ctx.stroke();
      }
    } else if (sp.shape === 'cluster') {
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TI.TAU + f.ph;
        ctx.beginPath();
        ctx.arc(sx + Math.cos(a) * size * 0.4, sy + Math.sin(a) * size * 0.22 - 2, size * 0.22, 0, TI.TAU);
        ctx.fill();
      }
    } else if (sp.shape === 'spire') {
      ctx.beginPath();
      ctx.moveTo(sx - size * 0.32, sy);
      ctx.lineTo(sx + sway * 0.25, sy - size * 1.5);
      ctx.lineTo(sx + size * 0.32, sy);
      ctx.closePath();
      ctx.fill();
    }
    if (f.lit) {
      ctx.fillStyle = TI.hsl(hue, 80, 72, 0.95);
      ctx.beginPath(); ctx.arc(sx + sway * 0.4, sy - size * 0.9, 2.4 + Math.sin(t * 6 + f.ph) * 0.7, 0, TI.TAU); ctx.fill();
    }
  }

  function drawMonolith(ctx, state, m, sx, sy, nightness) {
    const t = state.t;
    const near = TI.dist(state.player.x, state.player.y, m.x, m.y);
    const wake = TI.clamp(1 - near / 260, 0, 1) + m.seenT;
    // Maßstab: Monolithen überragen den Spieler (~14px) um ein Vielfaches — groß, unerreichbar
    const mh = 100 + (m.glyph % 4) * 18;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 5, 26, 8, 0, 0, TI.TAU); ctx.fill();
    const g = ctx.createLinearGradient(sx, sy - mh - 2, sx, sy);
    g.addColorStop(0, TI.hsl(state.world.palette.baseHue, 12, 10));
    g.addColorStop(1, TI.hsl(state.world.palette.baseHue, 14, 5));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx - 14, sy);
    ctx.lineTo(sx - 10, sy - mh);
    ctx.lineTo(sx + 11, sy - mh + 6);
    ctx.lineTo(sx + 16, sy);
    ctx.closePath();
    ctx.fill();
    // Luftperspektive: ferne Monolithen hellen zur Nebelfarbe auf — groß und unerreichbar;
    // nahe bleiben schwarz. Der Pfad des Körpers liegt noch an, wir füllen ihn erneut.
    {
      const P = state.world.palette;
      const hazeA = P.fogDensity * (1 - nightness) * TI.clamp(near / 600, 0, 0.55);
      if (hazeA > 0.01) {
        ctx.fillStyle = TI.hsl(P.fogHue, 25, 45, hazeA);
        ctx.fill();
      }
    }
    if (wake > 0.05) {
      const a = (0.25 + 0.2 * Math.sin(t * 1.4)) * TI.clamp(wake, 0, 1);
      ctx.strokeStyle = TI.hsl(state.world.palette.hueB, 70, 65, a);
      ctx.lineWidth = 1.2;
      const gy = sy - mh * 0.72 + (m.glyph % 3) * 10;
      ctx.beginPath();
      if (m.glyph % 2) { ctx.arc(sx, gy, 5, 0, TI.TAU); }
      else { ctx.moveTo(sx - 4, gy - 4); ctx.lineTo(sx + 4, gy + 4); ctx.moveTo(sx + 4, gy - 4); ctx.lineTo(sx - 4, gy + 4); }
      ctx.stroke();
    }
  }

  // Ferne Leucht-Cluster einer Distanzstufe: weiche, unscharfe Punkte mit Kern.
  // aScale erlaubt den zweiten, additiven Durchgang NACH der Dunkelschicht,
  // damit die fernen Lichter die Nacht überleben (Tiefe auch im Dunkeln).
  function drawHorizonClusters(ctx, state, camX, W, H, nightness, back, aScale) {
    const hor = state.horizon;
    const HB = H * 0.3, t = state.t;
    const px = back ? hor.par * 0.7 : 0.06;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const cl of hor.clusters) {
      if (cl.back !== back) continue;
      const u = (((cl.u - camX * px) % hor.HTW) + hor.HTW) % hor.HTW;
      const x = (u / hor.HTW) * W;
      const y = cl.yk * HB;
      const pulse = cl.pulses ? 0.55 + 0.45 * Math.sin(t * 2.6 + cl.ph) : 0.8 + 0.2 * Math.sin(t * 0.6 + cl.ph);
      // Ferne Lichter gehören der Nacht: am Tag nur ein Hauch im Dunst
      const a = (back ? 0.10 : 0.16) * pulse * (0.35 + 0.65 * nightness) * aScale;
      if (a < 0.008) continue;
      for (const xx of (x < cl.r * 3 ? [x, x + W] : x > W - cl.r * 3 ? [x, x - W] : [x])) {
        let g = ctx.createRadialGradient(xx, y, 0, xx, y, cl.r * 3);
        g.addColorStop(0, TI.hsl(cl.hue, 55, 62, a));
        g.addColorStop(1, TI.hsl(cl.hue, 55, 62, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(xx, y, cl.r * 3, 0, TI.TAU); ctx.fill();
        g = ctx.createRadialGradient(xx, y, 0, xx, y, cl.r);
        g.addColorStop(0, TI.hsl(cl.hue, 60, 72, a * 1.7));
        g.addColorStop(1, TI.hsl(cl.hue, 60, 72, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(xx, y, cl.r, 0, TI.TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  // Horizontband: Fernhaze (hell, entsättigt, weich), dahinter/davor die Leucht-Cluster,
  // dazwischen die große Silhouette — alles VOR Flora und Nebel gezeichnet, damit
  // Nähe scharf darüberliegt und die Nebelschichten die Ferne zusätzlich abschwächen.
  function drawHorizonBand(ctx, state, camX, W, H, nightness) {
    const hor = state.horizon;
    if (!hor) return;
    const P = state.world.palette;
    const HB = H * 0.3;
    // Fernhaze: oben am hellsten, läuft weit unter das Band aus — Distanz statt Vignette,
    // ohne sichtbare Unterkante auf flachem Grund.
    const hzL = TI.lerp(58, 24, nightness);
    const hzA = (0.36 + P.fogDensity * 0.55) * (1 - 0.35 * nightness);
    const hzH = H * 0.52;
    const g = ctx.createLinearGradient(0, 0, 0, hzH);
    g.addColorStop(0, TI.hsl(P.fogHue, 18, hzL, hzA));
    g.addColorStop(0.4, TI.hsl(P.fogHue, 18, hzL, hzA * 0.42));
    g.addColorStop(0.72, TI.hsl(P.fogHue, 18, hzL, hzA * 0.13));
    g.addColorStop(1, TI.hsl(P.fogHue, 18, hzL, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hzH);
    // hinterste Lichtstufe — hinter der Silhouette
    drawHorizonClusters(ctx, state, camX, W, H, nightness, true, 1);
    // die große, unerreichbare Form: minimale Parallaxe, kachelt seed-positioniert
    const sw = W * 1.7, sh = HB * 1.04;
    const off = (((camX * hor.par) % sw) + sw) % sw;
    for (let x = -off; x < W; x += sw) ctx.drawImage(hor.tex, x, HB - sh, sw, sh);
    // dünner Dunstschleier ÜBER der Silhouette: die Form versinkt in der Atmosphäre
    // (fern = hell, entsättigt, weich), statt hart davorzustehen
    const vg2 = ctx.createLinearGradient(0, 0, 0, HB);
    vg2.addColorStop(0, TI.hsl(P.fogHue, 18, hzL, hzA * 0.42));
    vg2.addColorStop(1, TI.hsl(P.fogHue, 18, hzL, 0));
    ctx.fillStyle = vg2;
    ctx.fillRect(0, 0, W, HB);
    // vordere Lichtstufe — schwebt vor der Silhouette
    drawHorizonClusters(ctx, state, camX, W, H, nightness, false, 1);
  }

  TI.render = function (state) {
    const ctx = state.ctx, W = state.vw, H = state.vh;
    const w = state.world, p = state.player;
    const camX = state.camX - W / 2, camY = state.camY - H / 2;
    const nightness = TI.nightness(state.tod);
    // Dämmerung als eigener Akt: statt pow(n,1.4) sofort in Fast-Nacht zu kollabieren,
    // hält ein Dämmer-Sockel (~0.5) ein Plateau, und erst spät (n>0.82) schließt die
    // Nacht auf ihr altes Ziel — bei nightness=1 exakt so dunkel wie zuvor.
    // (Fenster so gelegt, dass tod=0.38 → nightness≈0.86 noch auf dem Plateau liegt.)
    const nightZiel = TI.lerp(0.88, 0.97, (w.palette.nightDark - 0.6) / 0.25);
    const duskSockel = TI.lerp(w.palette.dayDark, 0.5, smoothstep(0.1, 0.55, nightness));
    const dark = TI.lerp(duskSockel, nightZiel, smoothstep(0.82, 1.0, nightness));
    const t = state.t;

    ctx.fillStyle = TI.hsl(w.palette.baseHue, 30, 2.5);
    ctx.fillRect(0, 0, W, H);

    // Terrain (weichgezeichnete Vorab-Renderung)
    const K = state.terrainK;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(state.terrain, camX / K, camY / K, W / K, H / K, 0, 0, W, H);

    // Weltlicht-Modulation: seed-gebundene Wolkenschatten & Lichtinseln kacheln über den
    // Boden — der Tag bekommt helle und dunkle Zonen statt Gleichlicht; nachts blendet es aus.
    if (nightness < 0.98) {
      const TS = 512 * 2.2; // Weltkachel ~1126px — Blobs werden bildschirmgroß
      const drift = t * 3; // Wolkenschatten ziehen sehr langsam
      const sox = (((camX + drift) % TS) + TS) % TS;
      const soy = ((camY % TS) + TS) % TS;
      ctx.globalAlpha = (1 - nightness) * 0.85;
      for (let x = -sox; x < W; x += TS) {
        for (let y = -soy; y < H; y += TS) {
          ctx.drawImage(state.shadeTex, x, y, TS, TS);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Fernebene: Horizontband mit großer Silhouette und Leucht-Clustern auf
    // zwei Distanzstufen — alles Nahe wird danach scharf darübergezeichnet.
    drawHorizonBand(ctx, state, camX, W, H, nightness);

    // Lichtquellen sammeln
    state.lights.length = 0;
    if (p.dead <= 0) state.lights.push({ x: p.x, y: p.y, r: 140 + p.focus * 75, hue: w.palette.baseHue, int: 0.95, isPlayer: true });
    state.lights.push({ x: w.shrine.x, y: w.shrine.y, r: 130, hue: w.palette.hueB, int: 0.8 });
    if (state.surgeT > 0) state.lights.push({ x: state.surgeX, y: state.surgeY, r: 340 * TI.clamp(state.surgeT / 2, 0, 1), hue: w.palette.hueB, int: 0.9 });

    // Schrein
    {
      const sx = w.shrine.x - camX, sy = w.shrine.y - camY;
      if (sx > -80 && sy > -80 && sx < W + 80 && sy < H + 80) {
        ctx.strokeStyle = TI.hsl(w.palette.hueB, 30, 45, 0.8);
        ctx.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const a = i / 7 * TI.TAU;
          const rx = sx + Math.cos(a) * 34, ry = sy + Math.sin(a) * 22;
          ctx.beginPath(); ctx.moveTo(rx, ry + 3); ctx.lineTo(rx, ry - 8 - (i % 3) * 3); ctx.stroke();
        }
        const g = ctx.createRadialGradient(sx, sy - 6, 0, sx, sy - 6, 30);
        g.addColorStop(0, TI.hsl(w.palette.hueB, 70, 65, 0.35 + Math.sin(t * 2) * 0.06));
        g.addColorStop(1, TI.hsl(w.palette.hueB, 70, 65, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy - 6, 30, 0, TI.TAU); ctx.fill();
      }
    }

    // Monolithen
    for (const m of w.monoliths) {
      const sx = m.x - camX, sy = m.y - camY;
      if (sx < -60 || sy < -80 || sx > W + 60 || sy > H + 40) continue;
      drawMonolith(ctx, state, m, sx, sy, nightness);
    }

    // Flora
    for (const f of w.flora) {
      const sx = f.x - camX, sy = f.y - camY;
      if (sx < -70 || sy < -70 || sx > W + 70 || sy > H + 70) continue;
      const sp = w.species[f.s];
      drawFlora(ctx, state, f, sp, sx, sy, nightness);
      f.echo = Math.max(0, f.echo - state.dt * 0.7);
      if (f.lit) state.lights.push({ x: f.x, y: f.y, r: 70, hue: sp.hue, int: 0.45 }); // Biolumineszenz-Wegweiser, kein Flutlicht
      else if (sp.emit > 0 && nightness < 0.35) state.lights.push({ x: f.x, y: f.y, r: 62, hue: sp.hue, int: 0.5 });
      else if (f.echo > 0.05) state.lights.push({ x: f.x, y: f.y, r: 70 * f.echo, hue: sp.hue, int: 0.5 * f.echo });
    }

    // Nacht-Lichtbudget: nachts dominiert das Spielerlicht — nur die 3 stärksten
    // Nicht-Spieler-Lichter behalten Kraft, der Rest wird zum fernen Glimmen gedimmt.
    if (nightness > 0.5) {
      const others = state.lights.filter(L => !L.isPlayer).sort((a, b) => b.int - a.int);
      for (let i = 3; i < others.length; i++) {
        others[i].int = Math.min(others[i].int, 0.35);
        others[i].r = Math.min(others[i].r, 60);
      }
    }

    TI.drawCreatures(ctx, state, camX, camY, W, H);
    TI.drawPlayer(ctx, state, p.x - camX, p.y - camY);

    // Luftperspektive über der Szene: was oben im Bild steht, ist fern — es hellt
    // zur Nebelfarbe auf und verliert Kontrast; die Bildmitte (der Spieler) bleibt scharf.
    {
      const P2 = w.palette;
      const apA = (0.12 + P2.fogDensity * 0.22) * (1 - 0.35 * nightness);
      const ag = ctx.createLinearGradient(0, 0, 0, H * 0.46);
      ag.addColorStop(0, TI.hsl(P2.fogHue, 16, TI.lerp(56, 22, nightness), apA));
      ag.addColorStop(1, TI.hsl(P2.fogHue, 16, TI.lerp(56, 22, nightness), 0));
      ctx.fillStyle = ag;
      ctx.fillRect(0, 0, W, H * 0.46);
    }

    // Partikel
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const mo of state.motes) {
      const mx = ((mo.x - camX * mo.z * 0.35) % (W + 60) + W + 60) % (W + 60) - 30;
      const my = ((mo.y - camY * mo.z * 0.35 + Math.sin(t * 0.5 + mo.ph) * 14) % (H + 60) + H + 60) % (H + 60) - 30;
      ctx.fillStyle = TI.hsl(w.palette.hueB, 40, 70, 0.05 + 0.04 * Math.sin(t + mo.ph));
      ctx.beginPath(); ctx.arc(mx, my, mo.z * 1.3, 0, TI.TAU); ctx.fill();
    }
    for (let i = state.bursts.length - 1; i >= 0; i--) {
      const b = state.bursts[i];
      b.age += state.dt;
      if (b.age > b.life) { state.bursts.splice(i, 1); continue; }
      b.x += b.vx * state.dt; b.y += b.vy * state.dt;
      b.vy -= 8 * state.dt;
      const k = 1 - b.age / b.life;
      ctx.fillStyle = TI.hsl(b.hue, 75, 62, 0.5 * k);
      ctx.beginPath(); ctx.arc(b.x - camX, b.y - camY, b.size * k + 0.4, 0, TI.TAU); ctx.fill();
    }
    ctx.restore();

    // Nebel — drei driftende Schichten mit ortsabhängiger Dichte (Bänke & Lichtungen)
    // Nebel gehört dem Tag/der Dämmerung — nachts frisst die Dunkelheit ihn
    const fd = w.palette.fogDensity * (0.9 - 0.8 * nightness);
    const sph = state.seedPhase || 0;
    // Fernschicht zuerst (größer, heller, langsamer, schwächere Parallaxe) — Tiefenebene
    const fogLayers = [
      { sc: 3.4, tex: state.fogTexFar, a: fd * 0.4, spdX: 3.5, spdY: 1.4, par: 0.06 },
      { sc: 1.4, tex: state.fogTex, a: fd * 0.5, spdX: 6, spdY: 2.5, par: 0.12 },
      { sc: 2.3, tex: state.fogTex, a: fd * 0.82, spdX: 11, spdY: 4.5, par: 0.22 }
    ];
    for (const L of fogLayers) {
      const sc = L.sc;
      const ox = ((t * L.spdX + camX * L.par) % 512 + 512) % 512;
      const oy = ((t * L.spdY + camY * L.par) % 512 + 512) % 512;
      for (let x = -ox * sc; x < W; x += 512 * sc) {
        for (let y = -oy * sc; y < H; y += 512 * sc) {
          // langsame Weltraumfunktion: pro Kachelzelle entstehen Nebelbänke und Lichtungen
          const bank = 0.35 + 0.65 * (0.5 + 0.5 *
            Math.sin((camX + x * sc) * 0.0011 + sph) *
            Math.sin((camY + y * sc) * 0.0013 + sph * 0.7));
          ctx.globalAlpha = TI.clamp(L.a * bank, 0, 1);
          ctx.drawImage(L.tex, x, y, 512 * sc, 512 * sc);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Dunkelheit mit Lichtlöchern
    if (!state.lightCanvas || state.lightCanvas.width !== W || state.lightCanvas.height !== H) {
      state.lightCanvas = document.createElement('canvas');
      state.lightCanvas.width = W; state.lightCanvas.height = H;
    }
    const lc = state.lightCanvas.getContext('2d');
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, W, H);
    // Nacht != Tag: die Dunkelschicht driftet nachts zum seed-eigenen Zweitton (hueB)
    lc.fillStyle = TI.hsl(TI.lerp(w.palette.baseHue, w.palette.hueB, nightness * 0.6), 45, 1.5, dark);
    lc.fillRect(0, 0, W, H);
    lc.globalCompositeOperation = 'destination-out';
    for (const L of state.lights) {
      const lx = L.x - camX, ly = L.y - camY;
      if (lx < -L.r || ly < -L.r || lx > W + L.r || ly > H + L.r) continue;
      const flick = 1 + Math.sin(t * 8 + L.x) * 0.035;
      const g = lc.createRadialGradient(lx, ly, 0, lx, ly, L.r * flick);
      g.addColorStop(0, 'rgba(0,0,0,' + (0.92 * L.int) + ')');
      g.addColorStop(0.4, 'rgba(0,0,0,' + (0.35 * L.int) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.beginPath(); lc.arc(lx, ly, L.r * flick, 0, TI.TAU); lc.fill();
    }
    ctx.drawImage(state.lightCanvas, 0, 0);

    // Ferne Lichter überleben die Nacht: schwacher additiver Zweitdurchgang
    // NACH der Dunkelschicht — winzige weiche Punkte in der Ferne, kein Flutlicht.
    if (state.horizon && nightness > 0.3) {
      const reA = 0.55 * smoothstep(0.3, 0.85, nightness);
      drawHorizonClusters(ctx, state, camX, W, H, nightness, true, reA);
      drawHorizonClusters(ctx, state, camX, W, H, nightness, false, reA);
    }

    // Dämmerungs-Akt: warme Horizont-Tönung Richtung hueB als vertikaler Screen-Gradient.
    // Fenster so gelegt, dass die Dämmerung (tod≈0.38, n≈0.86) voll getönt ist und die
    // Tönung zur tiefen Nacht (n→1) vollständig verschwindet — Nacht bleibt unangetastet.
    {
      const duskWin = smoothstep(0.12, 0.55, nightness) * (1 - smoothstep(0.88, 0.99, nightness));
      if (duskWin > 0.02) {
        const dg = ctx.createLinearGradient(0, 0, 0, H);
        dg.addColorStop(0, TI.hsl(w.palette.hueB, 55, 55, 0.16 * duskWin));
        dg.addColorStop(0.65, TI.hsl(w.palette.hueB, 55, 55, 0.03 * duskWin));
        dg.addColorStop(1, TI.hsl(w.palette.hueB, 55, 55, 0));
        ctx.fillStyle = dg;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // additiver Glanz der Lichter
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const L of state.lights) {
      if (L.int < 0.7) continue; // nur dominante Lichter blühen
      const lx = L.x - camX, ly = L.y - camY;
      if (lx < -L.r || ly < -L.r || lx > W + L.r || ly > H + L.r) continue;
      const r = L.r * 0.75;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      g.addColorStop(0, TI.hsl(L.hue, 70, 58, 0.14 * L.int));
      g.addColorStop(1, TI.hsl(L.hue, 70, 58, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(lx, ly, r, 0, TI.TAU); ctx.fill();
    }
    ctx.restore();

    // Entdeckungs-Glanz
    if (state.goldT > 0) {
      const k = state.goldT / 1.6;
      ctx.fillStyle = TI.hsl(46, 80, 60, 0.14 * k);
      ctx.fillRect(0, 0, W, H);
    }

    // Vignette — Zentrum leicht nach oben verschoben: unten/seitlich dunkelt die Nähe,
    // der obere Bildrand bleibt heller — er ist Ferne, keine Vignette.
    const vg = ctx.createRadialGradient(W / 2, H * 0.43, Math.min(W, H) * 0.32, W / 2, H * 0.43, Math.max(W, H) * 0.74);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,' + (0.5 + 0.2 * nightness) + ')');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // Schmerz / niedrige Vitalität
    if (p.hurtT > 0) {
      ctx.fillStyle = 'rgba(140,20,20,' + 0.28 * TI.clamp(p.hurtT, 0, 1) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (p.vitality < 0.45) {
      const a = (0.45 - p.vitality) * (0.55 + 0.25 * Math.sin(t * 3.2));
      const rg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.7);
      rg.addColorStop(0, 'rgba(90,10,10,0)');
      rg.addColorStop(1, 'rgba(90,10,10,' + a + ')');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
    if (p.dead > 0) {
      ctx.fillStyle = 'rgba(0,0,0,' + TI.clamp(1.2 - Math.abs(p.dead - 1.2), 0, 1) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // Korn
    ctx.globalAlpha = 0.05;
    ctx.drawImage(state.grainTex, (Math.random() * 128) | 0, (Math.random() * 128) | 0, 128, 128, 0, 0, W, H);
    ctx.globalAlpha = 1;

    // Journal-Hinweisfeder
    if (TI.journal.flash > 0) {
      TI.journal.flash -= state.dt;
      ctx.fillStyle = TI.hsl(46, 75, 62, TI.clamp(TI.journal.flash, 0, 0.9));
      ctx.font = '16px serif';
      ctx.fillText('✦', W - 34, 34);
    }
  };
})();
