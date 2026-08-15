// Terra Incognita — Fauna: Treiber, Späher, Jäger. Verhalten hängt an den Weltgesetzen.
window.TI = window.TI || {};
(function () {
  'use strict';

  TI.spawnCreatures = function (world) {
    const rng = TI.rngFrom('c:' + world.seed);
    const list = [];
    function place(minShrineDist) {
      for (let i = 0; i < 500; i++) {
        const x = rng() * world.SIZE, y = rng() * world.SIZE;
        if (world.elevAt(x, y) > world.GROUND + 0.02 &&
            TI.dist(x, y, world.shrine.x, world.shrine.y) > minShrineDist) return { x, y };
      }
      return { x: world.shrine.x + 320, y: world.shrine.y };
    }
    const spec = world.creatureSpec;
    for (let i = 0; i < spec.drifters; i++) {
      const p = place(180);
      list.push({ kind: 'drifter', x: p.x, y: p.y, vx: 0, vy: 0, a: rng() * TI.TAU, ph: rng() * TI.TAU, size: 5 + rng() * 4, observed: 0 });
    }
    for (let i = 0; i < spec.watchers; i++) {
      const p = place(260);
      list.push({ kind: 'watcher', x: p.x, y: p.y, vx: 0, vy: 0, a: rng() * TI.TAU, ph: rng() * TI.TAU, size: 8 + rng() * 4, shy: 0.5 + rng() * 0.5, observed: 0 });
    }
    for (let i = 0; i < spec.stalkers; i++) {
      const p = place(700);
      list.push({ kind: 'stalker', x: p.x, y: p.y, vx: 0, vy: 0, a: rng() * TI.TAU, ph: rng() * TI.TAU, size: 11 + rng() * 5, aggro: 0, cool: 0, observed: 0 });
    }
    return list;
  };

  function nearestLitBeacon(world, x, y, maxD) {
    let best = null, bd = maxD;
    for (const f of world.flora) {
      if (!f.lit) continue;
      const d = TI.dist(f.x, f.y, x, y);
      if (d < bd) { bd = d; best = f; }
    }
    return best ? { f: best, d: bd } : null;
  }

  TI.updateCreatures = function (state, dt) {
    const w = state.world, p = state.player;
    const night = TI.nightness(state.tod) > 0.55;
    for (const c of state.creatures) {
      let tx = 0, ty = 0, speed = 0;

      if (c.kind === 'drifter') {
        c.a += Math.sin(state.t * 0.3 + c.ph) * 0.02 + (Math.random() - 0.5) * 0.08;
        tx = Math.cos(c.a); ty = Math.sin(c.a); speed = 17;
        if (w.laws.lightDraws) {
          const b = nearestLitBeacon(w, c.x, c.y, 480);
          if (b && b.d > 60) { tx = (b.f.x - c.x) / b.d; ty = (b.f.y - c.y) / b.d; speed = 26; }
        }
      } else if (c.kind === 'watcher') {
        const d = TI.dist(c.x, c.y, p.x, p.y);
        const psp = Math.hypot(p.vx, p.vy);
        if (d < 130 || (d < 260 && psp > 150)) {
          tx = (c.x - p.x) / (d || 1); ty = (c.y - p.y) / (d || 1); speed = 120 * c.shy + 40;
        } else if (d < 380 && d > 150) {
          tx = (p.x - c.x) / d; ty = (p.y - c.y) / d; speed = 14;
        } else {
          c.a += (Math.random() - 0.5) * 0.15;
          tx = Math.cos(c.a); ty = Math.sin(c.a); speed = 10;
        }
      } else if (c.kind === 'stalker') {
        c.cool = Math.max(0, c.cool - dt);
        c.aggro = Math.max(0, c.aggro - dt * 0.05);
        const d = TI.dist(c.x, c.y, p.x, p.y);
        const hunting = (night || c.aggro > 0) && d < 560 && c.cool <= 0;
        const playerStill = w.laws.stillnessHides && p.still > 1.2 && c.aggro <= 0;
        // Licht-Gesetz: vertreibt Licht, halten brennende Leuchten den Jäger fern
        let repelled = false;
        if (!w.laws.lightDraws) {
          const b = nearestLitBeacon(w, p.x, p.y, 150);
          if (b && d < 320) repelled = true;
        }
        if (hunting && !playerStill && !repelled) {
          tx = (p.x - c.x) / (d || 1); ty = (p.y - c.y) / (d || 1); speed = 96;
          if (d < c.size + 14) {
            TI.events.push({ type: 'maul', x: p.x, y: p.y });
            c.cool = 2.4;
            const kb = 240 / (d || 1);
            p.vx += (p.x - c.x) * kb; p.vy += (p.y - c.y) * kb;
          }
        } else if (repelled && d < 300) {
          tx = (c.x - p.x) / (d || 1); ty = (c.y - p.y) / (d || 1); speed = 70;
        } else {
          c.a += (Math.random() - 0.5) * 0.1;
          tx = Math.cos(c.a); ty = Math.sin(c.a); speed = night ? 30 : 8;
        }
      }

      c.vx = TI.lerp(c.vx, tx * speed, TI.clamp(dt * 2.2, 0, 1));
      c.vy = TI.lerp(c.vy, ty * speed, TI.clamp(dt * 2.2, 0, 1));
      const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
      if (w.elevAt(nx, ny) > w.GROUND) { c.x = nx; c.y = ny; }
      else {
        const cx = w.SIZE / 2 - c.x, cy = w.SIZE / 2 - c.y, l = Math.hypot(cx, cy) || 1;
        c.vx = cx / l * 20; c.vy = cy / l * 20; c.a = Math.atan2(cy, cx);
      }
    }
  };

  TI.drawCreatures = function (ctx, state, camX, camY, W, H) {
    const w = state.world, t = state.t;
    const hue = w.palette.hueC + w.creatureSpec.hueShift;
    const night = TI.nightness(state.tod) > 0.55;
    for (const c of state.creatures) {
      const sx = c.x - camX, sy = c.y - camY;
      if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) continue;
      const bob = Math.sin(t * 1.7 + c.ph) * 2;

      if (c.kind === 'drifter') {
        const g = ctx.createRadialGradient(sx, sy + bob, 0, sx, sy + bob, c.size * 2.4);
        g.addColorStop(0, TI.hsl(hue, 65, 62, 0.5));
        g.addColorStop(1, TI.hsl(hue, 65, 50, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy + bob, c.size * 2.4, 0, TI.TAU); ctx.fill();
        ctx.fillStyle = TI.hsl(hue, 55, 75, 0.85);
        ctx.beginPath(); ctx.arc(sx, sy + bob, c.size * 0.55, 0, TI.TAU); ctx.fill();
        for (let i = 1; i <= 3; i++) {
          ctx.fillStyle = TI.hsl(hue, 55, 70, 0.25 / i);
          ctx.beginPath();
          ctx.arc(sx - c.vx * 0.09 * i, sy + bob - c.vy * 0.09 * i + i, c.size * 0.3 / i + 1, 0, TI.TAU);
          ctx.fill();
        }
      } else if (c.kind === 'watcher') {
        ctx.fillStyle = TI.hsl(hue + 20, 25, 14, 0.9);
        ctx.beginPath();
        ctx.ellipse(sx, sy + bob * 0.5, c.size * 0.6, c.size * 1.25, 0, 0, TI.TAU);
        ctx.fill();
        const dx = state.player.x - c.x, dy = state.player.y - c.y, l = Math.hypot(dx, dy) || 1;
        const ex = sx + dx / l * 2.5, ey = sy + bob * 0.5 - c.size * 0.55 + dy / l * 2;
        ctx.fillStyle = TI.hsl(hue + 40, 80, 70, 0.9);
        ctx.beginPath(); ctx.arc(ex - 2.2, ey, 1.4, 0, TI.TAU); ctx.arc(ex + 2.2, ey, 1.4, 0, TI.TAU); ctx.fill();
      } else if (c.kind === 'stalker') {
        const vis = night || c.aggro > 0 ? 0.85 : 0.3;
        const ang = Math.atan2(c.vy, c.vx);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.fillStyle = TI.hsl(w.palette.baseHue, 20, 6, vis);
        ctx.beginPath();
        ctx.ellipse(0, 0, c.size * 1.5, c.size * 0.55, 0, 0, TI.TAU);
        ctx.fill();
        if (night || c.aggro > 0) {
          ctx.fillStyle = TI.hsl(8, 85, 55, 0.9);
          ctx.beginPath(); ctx.arc(c.size * 1.1, -2.5, 1.3, 0, TI.TAU); ctx.arc(c.size * 1.1, 2.5, 1.3, 0, TI.TAU); ctx.fill();
        }
        ctx.restore();
      }
    }
  };
})();
