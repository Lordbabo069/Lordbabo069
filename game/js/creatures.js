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
      list.push({ kind: 'stalker', x: p.x, y: p.y, vx: 0, vy: 0, a: rng() * TI.TAU, ph: rng() * TI.TAU, size: 11 + rng() * 5, aggro: 0, cool: 0, observed: 0, trail: [], shadow: 0, orbitDir: rng() < 0.5 ? -1 : 1, committed: false, scan: 0 });
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
          if (b) {
            const dx = (b.f.x - c.x) / (b.d || 1), dy = (b.f.y - c.y) / (b.d || 1);
            if (b.d < 110) {
              // Gesetz in einem Frame: nah an der Leuchte kreisen die Drifter tangential —
              // ein Halo aus Lichtmotten um brennende Flora macht 'Licht zieht an' sichtbar.
              const dir = c.ph < Math.PI ? 1 : -1;
              const rad = TI.clamp((b.d - 85) / 40, -1, 1); // sanfte Radiuskorrektur auf ~85 px
              tx = -dy * dir + dx * rad * 0.6;
              ty = dx * dir + dy * rad * 0.6;
              const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
              speed = 22;
            } else {
              tx = dx; ty = dy; speed = 26;
            }
          }
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
          c.scan = 0;
          // Beschattungsphase: erst im weiten Bogen am Nebelrand um den Spieler ziehen —
          // die erste Begegnung ist eine ferne, lange Silhouette, keine Kollision.
          const running = Math.hypot(p.vx, p.vy) > 150;
          if (!c.committed && c.shadow <= 0) {
            c.shadow = 3 + Math.random() * 3;
            c.orbitDir = Math.random() < 0.5 ? -1 : 1;
          }
          if (running || d < 160) c.committed = true;
          if (!c.committed) {
            c.shadow -= dt;
            if (c.shadow <= 0) c.committed = true;
            const ta = Math.atan2(c.y - p.y, c.x - p.x) + c.orbitDir * 0.55;
            const gx = p.x + Math.cos(ta) * 460, gy = p.y + Math.sin(ta) * 460;
            const gl = TI.dist(c.x, c.y, gx, gy) || 1;
            tx = (gx - c.x) / gl; ty = (gy - c.y) / gl; speed = 40;
          } else {
            tx = (p.x - c.x) / (d || 1); ty = (p.y - c.y) / (d || 1); speed = 96;
            if (d < c.size + 14) {
              TI.events.push({ type: 'maul', x: p.x, y: p.y });
              c.cool = 2.4;
              c.committed = false; c.shadow = 0;
              const kb = 240 / (d || 1);
              p.vx += (p.x - c.x) * kb; p.vy += (p.y - c.y) * kb;
            }
          }
        } else if (repelled && d < 300) {
          c.committed = false; c.shadow = 0; c.scan = 0;
          tx = (c.x - p.x) / (d || 1); ty = (c.y - p.y) / (d || 1); speed = 70;
        } else {
          // stillnessHides als Verhalten: bricht Stille die Jagd, verharrt der Jäger
          // ~2 s und pendelt suchend mit dem Kopf — der Spieler SIEHT, dass sein
          // Stillstand die Jagd gebrochen hat, statt es nur statistisch zu erahnen.
          if (hunting && playerStill && (c.committed || c.shadow > 0)) c.scan = 2;
          c.committed = false; c.shadow = 0;
          if (c.scan > 0) {
            c.scan -= dt;
            tx = 0; ty = 0; speed = 0;
            c.a += Math.sin(state.t * 3) * dt * 2;
          } else {
            c.a += (Math.random() - 0.5) * 0.1;
            tx = Math.cos(c.a); ty = Math.sin(c.a); speed = night ? 30 : 8;
            // Nachts zieht es den Jäger schwach Richtung Schrein: die Silhouette
            // taucht in der ersten Nacht am Bildrand auf, statt nie im Bild zu sein.
            if (night) {
              const sd = TI.dist(c.x, c.y, w.shrine.x, w.shrine.y);
              if (sd > 900) {
                tx = tx * 0.7 + (w.shrine.x - c.x) / sd * 0.3;
                ty = ty * 0.7 + (w.shrine.y - c.y) / sd * 0.3;
              }
            }
          }
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

      // Positions-Trail für den gegliederten Jägerkörper (Silhouette folgt dem Pfad)
      if (c.kind === 'stalker') {
        const h = c.trail[0];
        if (!h || TI.dist(c.x, c.y, h.x, h.y) > 3) {
          c.trail.unshift({ x: c.x, y: c.y });
          if (c.trail.length > 72) c.trail.length = 72;
        }
      }
    }
  };

  TI.drawCreatures = function (ctx, state, camX, camY, W, H) {
    const w = state.world, t = state.t;
    const hue = w.palette.hueC + w.creatureSpec.hueShift;
    const night = TI.nightness(state.tod) > 0.55;
    for (const c of state.creatures) {
      const sx = c.x - camX, sy = c.y - camY;
      const cull = c.kind === 'stalker' ? 160 : 60; // der lange Körper ragt weiter ins Bild
      if (sx < -cull || sy < -cull || sx > W + cull || sy > H + cull) continue;
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
        const vis = night || c.aggro > 0 ? 0.85 : 0.35;
        // Bei Fast-Stillstand (Scan nach gebrochener Jagd) trägt c.a das Kopfpendeln
        const ang = Math.hypot(c.vx, c.vy) > 4 ? Math.atan2(c.vy, c.vx) : c.a;

        // Weicher dunkler Halo hinter dem Körper — macht die Form im Nebel aus der Ferne lesbar
        const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, c.size * 4.5);
        halo.addColorStop(0, TI.hsl(w.palette.baseHue, 25, 4, vis * 0.4));
        halo.addColorStop(1, TI.hsl(w.palette.baseHue, 25, 4, 0));
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(sx, sy, c.size * 4.5, 0, TI.TAU); ctx.fill();

        // Gegliederter Körper: Segmente hintereinander auf dem Positions-Trail, Kopf voran
        const SEGS = 9, gap = c.size * 7 / (SEGS - 1);
        const pts = [];
        let px = c.x, py = c.y, ti = 0, walked = 0;
        pts.push({ x: c.x, y: c.y });
        for (let s = 1; s < SEGS; s++) {
          let need = s * gap - walked;
          while (ti < c.trail.length) {
            const q = c.trail[ti];
            const seg = Math.hypot(q.x - px, q.y - py);
            if (seg >= need && seg > 0) {
              const f = need / seg;
              pts.push({ x: px + (q.x - px) * f, y: py + (q.y - py) * f });
              px += (q.x - px) * f; py += (q.y - py) * f;
              walked = s * gap;
              break;
            }
            walked += seg; need -= seg; px = q.x; py = q.y; ti++;
          }
          // Trail zu kurz (frisch gespawnt): hinter der Blickrichtung extrapolieren
          if (pts.length <= s) {
            pts.push({ x: px - Math.cos(ang) * need, y: py - Math.sin(ang) * need });
            px = pts[s].x; py = pts[s].y; walked = s * gap;
          }
        }
        ctx.fillStyle = TI.hsl(w.palette.baseHue, 20, 6, vis);
        for (let s = SEGS - 1; s >= 0; s--) {
          const q = pts[s];
          const nxt = s > 0 ? pts[s - 1] : null;
          const sa = nxt ? Math.atan2(nxt.y - q.y, nxt.x - q.x) : ang;
          const taper = 1 - s / SEGS * 0.7;
          ctx.save();
          ctx.translate(q.x - camX, q.y - camY + Math.sin(t * 1.3 + c.ph + s * 0.8) * 1.2);
          ctx.rotate(sa);
          ctx.beginPath();
          ctx.ellipse(0, 0, c.size * (s === 0 ? 1.05 : 0.9) * taper + c.size * 0.25, c.size * 0.5 * taper + c.size * 0.1, 0, 0, TI.TAU);
          ctx.fill();
          ctx.restore();
        }

        // Augen nur, wenn der Jäger den Spieler ansieht — Welt-Farbton, kein Gegner-Rot
        const pdx = state.player.x - c.x, pdy = state.player.y - c.y, pl = Math.hypot(pdx, pdy) || 1;
        const facing = Math.cos(ang) * pdx / pl + Math.sin(ang) * pdy / pl;
        if (facing > 0.7) {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ang);
          ctx.fillStyle = TI.hsl(hue, 45, 62, 0.5 * vis);
          ctx.beginPath();
          ctx.arc(c.size * 0.95, -2.4, 1.2, 0, TI.TAU);
          ctx.arc(c.size * 0.95, 2.4, 1.2, 0, TI.TAU);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  };
})();
