// Terra Incognita — Spielerbewegung, Fokus (Stillstehen = Wahrnehmung), Kamera.
window.TI = window.TI || {};
(function () {
  'use strict';

  TI.createPlayer = function (world) {
    return {
      x: world.shrine.x, y: world.shrine.y + 28, vx: 0, vy: 0,
      vitality: 1, focus: 0, still: 0,
      speedT: 0, slowT: 0, hurtT: 0, dead: 0, step: 0, facing: 1
    };
  };

  TI.updatePlayer = function (state, dt) {
    const p = state.player, inp = state.input, w = state.world;

    if (p.dead > 0) {
      p.dead -= dt;
      if (p.dead <= 0) {
        p.x = w.shrine.x; p.y = w.shrine.y + 28;
        p.vx = p.vy = 0; p.vitality = 0.65; p.hurtT = 0;
      }
      return;
    }

    let ax = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let ay = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
    if (ax) p.facing = ax > 0 ? 1 : -1;

    const boost = p.speedT > 0 ? 1.45 : 1;
    const slow = p.slowT > 0 ? 0.55 : 1;
    const vit = 0.55 + 0.45 * p.vitality;
    const max = 175 * boost * slow * vit;

    p.vx += ax * 840 * dt; p.vy += ay * 840 * dt;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > max) { p.vx *= max / sp; p.vy *= max / sp; }
    if (!ax && !ay) { const d = Math.pow(0.001, dt); p.vx *= d; p.vy *= d; }

    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (w.elevAt(nx, p.y) > w.GROUND) p.x = nx; else p.vx *= -0.2;
    if (w.elevAt(p.x, ny) > w.GROUND) p.y = ny; else p.vy *= -0.2;

    if (sp < 8 && !ax && !ay) {
      p.still += dt;
      p.focus = TI.clamp(p.focus + dt / 2.5, 0, 1);
    } else {
      p.still = 0;
      p.focus = TI.clamp(p.focus - dt * 1.8, 0, 1);
    }

    p.speedT = Math.max(0, p.speedT - dt);
    p.slowT = Math.max(0, p.slowT - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);

    // langsame Regeneration, stärker am Schrein
    const home = TI.dist(p.x, p.y, w.shrine.x, w.shrine.y) < 130;
    p.vitality = TI.clamp(p.vitality + dt * (home ? 0.05 : 0.006), 0, 1);

    p.step += Math.hypot(p.vx, p.vy) * dt / 34;
    if (p.step > 1) {
      p.step = 0;
      if (Math.hypot(p.vx, p.vy) > 40) TI.events.push({ type: 'step', x: p.x, y: p.y });
    }
  };

  TI.updateCamera = function (state, dt) {
    const p = state.player;
    const driftX = Math.sin(state.t * 0.11) * 12;
    const driftY = Math.cos(state.t * 0.09) * 9;
    const k = TI.clamp(dt * 3.0, 0, 1);
    state.camX = TI.lerp(state.camX, p.x + driftX + p.vx * 0.22, k);
    state.camY = TI.lerp(state.camY, p.y + driftY + p.vy * 0.22, k);
    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 2.4);
      state.camX += (Math.random() - 0.5) * 14 * state.shake;
      state.camY += (Math.random() - 0.5) * 14 * state.shake;
    }
  };

  TI.drawPlayer = function (ctx, state, sx, sy) {
    const p = state.player, w = state.world, t = state.t;
    if (p.dead > 0) return;
    const sp = Math.hypot(p.vx, p.vy);
    const bob = Math.sin(t * 8) * TI.clamp(sp / 175, 0, 1) * 1.8;

    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 9, 8, 3.2, 0, 0, TI.TAU); ctx.fill();

    // Umhang
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.scale(p.facing, 1);
    const g = ctx.createLinearGradient(0, -14, 0, 10);
    g.addColorStop(0, TI.hsl(w.palette.baseHue, 18, 22));
    g.addColorStop(1, TI.hsl(w.palette.baseHue, 22, 9));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.quadraticCurveTo(7, -6, 5.5, 9);
    ctx.quadraticCurveTo(0, 11, -5.5, 9);
    ctx.quadraticCurveTo(-7, -6, 0, -13);
    ctx.fill();
    // Kapuze / Kopf
    ctx.fillStyle = TI.hsl(w.palette.baseHue, 16, 28);
    ctx.beginPath(); ctx.arc(0, -12, 4.6, 0, TI.TAU); ctx.fill();
    // Gesichtsschimmer in Blickrichtung
    ctx.fillStyle = TI.hsl(w.palette.hueB, 60, 70, 0.8);
    ctx.beginPath(); ctx.arc(1.8, -12, 1.5, 0, TI.TAU); ctx.fill();
    ctx.restore();
  };
})();
