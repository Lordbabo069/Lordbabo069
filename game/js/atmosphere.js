// Terra Incognita — Renderpipeline: Terrain, Flora, Licht, Nebel, Nacht, Körnung.
window.TI = window.TI || {};
(function () {
  'use strict';

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
      g.addColorStop(0, TI.hsl(P.fogHue, 30, 60, 0.05 + fr() * 0.05));
      g.addColorStop(1, TI.hsl(P.fogHue, 30, 60, 0));
      fc.fillStyle = g;
      fc.beginPath(); fc.arc(x, y, r, 0, TI.TAU); fc.fill();
    }
    state.fogTex = fog;

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

  function drawFlora(ctx, state, f, sp, sx, sy) {
    const t = state.t;
    const pulse = sp.pulses ? 0.55 + 0.45 * Math.sin(t * 2.6 + f.ph) : 1;
    const glow = TI.clamp(pulse * (0.5 + sp.emit) + f.echo, 0, 1.6);
    const size = sp.size;
    const hue = sp.hue;
    const sway = Math.sin(t * 0.9 + f.ph) * 1.6;

    // weicher Grundschein
    if (sp.emit > 0 || f.lit || f.echo > 0 || sp.pulses) {
      const r = size * (2.2 + glow);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, TI.hsl(hue, 70, 55, 0.16 * glow + (f.lit ? 0.2 : 0)));
      g.addColorStop(1, TI.hsl(hue, 70, 55, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TI.TAU); ctx.fill();
    }

    ctx.strokeStyle = TI.hsl(hue, 45, 30 + 25 * pulse, 0.9);
    ctx.fillStyle = TI.hsl(hue, 55, 34 + 30 * pulse, 0.92);
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

  function drawMonolith(ctx, state, m, sx, sy) {
    const t = state.t;
    const near = TI.dist(state.player.x, state.player.y, m.x, m.y);
    const wake = TI.clamp(1 - near / 260, 0, 1) + m.seenT;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 4, 16, 5, 0, 0, TI.TAU); ctx.fill();
    const g = ctx.createLinearGradient(sx, sy - 64, sx, sy);
    g.addColorStop(0, TI.hsl(state.world.palette.baseHue, 12, 10));
    g.addColorStop(1, TI.hsl(state.world.palette.baseHue, 14, 5));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx - 9, sy);
    ctx.lineTo(sx - 6, sy - 62);
    ctx.lineTo(sx + 7, sy - 58);
    ctx.lineTo(sx + 10, sy);
    ctx.closePath();
    ctx.fill();
    if (wake > 0.05) {
      const a = (0.25 + 0.2 * Math.sin(t * 1.4)) * TI.clamp(wake, 0, 1);
      ctx.strokeStyle = TI.hsl(state.world.palette.hueB, 70, 65, a);
      ctx.lineWidth = 1.2;
      const gy = sy - 44 + (m.glyph % 3) * 8;
      ctx.beginPath();
      if (m.glyph % 2) { ctx.arc(sx, gy, 5, 0, TI.TAU); }
      else { ctx.moveTo(sx - 4, gy - 4); ctx.lineTo(sx + 4, gy + 4); ctx.moveTo(sx + 4, gy - 4); ctx.lineTo(sx - 4, gy + 4); }
      ctx.stroke();
    }
  }

  TI.render = function (state) {
    const ctx = state.ctx, W = state.vw, H = state.vh;
    const w = state.world, p = state.player;
    const camX = state.camX - W / 2, camY = state.camY - H / 2;
    const nightness = TI.nightness(state.tod);
    const dark = TI.lerp(w.palette.dayDark, w.palette.nightDark, nightness);
    const t = state.t;

    ctx.fillStyle = TI.hsl(w.palette.baseHue, 30, 2.5);
    ctx.fillRect(0, 0, W, H);

    // Terrain (weichgezeichnete Vorab-Renderung)
    const K = state.terrainK;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(state.terrain, camX / K, camY / K, W / K, H / K, 0, 0, W, H);

    // Lichtquellen sammeln
    state.lights.length = 0;
    if (p.dead <= 0) state.lights.push({ x: p.x, y: p.y, r: 100 + p.focus * 75, hue: w.palette.baseHue, int: 0.95 });
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
      drawMonolith(ctx, state, m, sx, sy);
    }

    // Flora
    for (const f of w.flora) {
      const sx = f.x - camX, sy = f.y - camY;
      if (sx < -70 || sy < -70 || sx > W + 70 || sy > H + 70) continue;
      const sp = w.species[f.s];
      drawFlora(ctx, state, f, sp, sx, sy);
      f.echo = Math.max(0, f.echo - state.dt * 0.7);
      if (f.lit) state.lights.push({ x: f.x, y: f.y, r: 150, hue: sp.hue, int: 0.85 });
      else if (sp.emit > 0) state.lights.push({ x: f.x, y: f.y, r: 62, hue: sp.hue, int: 0.5 });
      else if (f.echo > 0.05) state.lights.push({ x: f.x, y: f.y, r: 70 * f.echo, hue: sp.hue, int: 0.5 * f.echo });
    }

    TI.drawCreatures(ctx, state, camX, camY, W, H);
    TI.drawPlayer(ctx, state, p.x - camX, p.y - camY);

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

    // Nebel — zwei driftende Schichten
    const fd = w.palette.fogDensity * (0.55 + 0.45 * nightness);
    for (let layer = 0; layer < 2; layer++) {
      const sc = 1.4 + layer * 0.9;
      const ox = ((t * (6 + layer * 5) + camX * (0.12 + layer * 0.1)) % 512 + 512) % 512;
      const oy = ((t * (2.5 + layer * 2) + camY * (0.12 + layer * 0.1)) % 512 + 512) % 512;
      ctx.globalAlpha = fd * (0.5 + layer * 0.32);
      for (let x = -ox * sc; x < W; x += 512 * sc) {
        for (let y = -oy * sc; y < H; y += 512 * sc) {
          ctx.drawImage(state.fogTex, x, y, 512 * sc, 512 * sc);
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
    lc.fillStyle = TI.hsl(w.palette.baseHue, 45, 3, dark);
    lc.fillRect(0, 0, W, H);
    lc.globalCompositeOperation = 'destination-out';
    for (const L of state.lights) {
      const lx = L.x - camX, ly = L.y - camY;
      if (lx < -L.r || ly < -L.r || lx > W + L.r || ly > H + L.r) continue;
      const flick = 1 + Math.sin(t * 8 + L.x) * 0.035;
      const g = lc.createRadialGradient(lx, ly, 0, lx, ly, L.r * flick);
      g.addColorStop(0, 'rgba(0,0,0,' + (0.92 * L.int) + ')');
      g.addColorStop(0.55, 'rgba(0,0,0,' + (0.45 * L.int) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.beginPath(); lc.arc(lx, ly, L.r * flick, 0, TI.TAU); lc.fill();
    }
    ctx.drawImage(state.lightCanvas, 0, 0);

    // additiver Glanz der Lichter
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const L of state.lights) {
      const lx = L.x - camX, ly = L.y - camY;
      if (lx < -L.r || ly < -L.r || lx > W + L.r || ly > H + L.r) continue;
      const r = L.r * 0.75;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      g.addColorStop(0, TI.hsl(L.hue, 70, 58, 0.10 * L.int));
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

    // Vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
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
