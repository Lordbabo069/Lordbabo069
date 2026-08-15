// Terra Incognita — Spielerbewegung, Fokus (Stillstehen = Wahrnehmung), Kamera.
window.TI = window.TI || {};
(function () {
  'use strict';

  TI.createPlayer = function (world) {
    return {
      x: world.shrine.x, y: world.shrine.y + 28, vx: 0, vy: 0,
      vitality: 1, focus: 0, still: 0,
      speedT: 0, slowT: 0, hurtT: 0, dead: 0, step: 0, facing: 1,
      faceT: 1, stride: 0, breathPh: 0, maxSp: 175
    };
  };

  TI.updatePlayer = function (state, dt) {
    const p = state.player, inp = state.input, w = state.world;

    if (p.dead > 0) {
      p.dead -= dt;
      if (p.dead <= 0) {
        p.x = w.shrine.x; p.y = w.shrine.y + 28;
        p.vx = p.vy = 0; p.vitality = 0.65; p.hurtT = 0;
        // Kamera schnappt mit — kein Peitschen vom Todesort quer durch die Welt.
        state.camX = p.x; state.camY = p.y;
      }
      return;
    }

    let ax = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let ay = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
    // Kontinuierliche Blickrichtung: Ziel ±1, Annäherung über ~0,12 s —
    // die Wendung liest sich als Körperdrehung, nicht als Spiegel-Pop.
    if (ax) p.faceT = ax > 0 ? 1 : -1;
    p.facing += (p.faceT - p.facing) * (1 - Math.exp(-dt / 0.12));

    // Buffs blenden über die letzten 0,6 s aus statt in einem Frame zu springen.
    const boost = 1 + 0.45 * TI.clamp(p.speedT / 0.6, 0, 1);
    const slow = 1 - 0.45 * TI.clamp(p.slowT / 0.6, 0, 1);
    const vit = 0.55 + 0.45 * p.vitality;
    const max = 175 * boost * slow * vit;
    p.maxSp = max; // für die Bob-Normierung im Renderer

    // Träge Hüllkurve: ~0,55 s bis Vollgas, ~0,4 s Ausgleiten — Gehen hat Masse.
    // Asymptotisch statt linear+Clamp: der Topspeed wird angenähert, nie angeschlagen.
    if (ax || ay) {
      const kAcc = 1 - Math.exp(-dt / 0.25);
      p.vx += (ax * max - p.vx) * kAcc;
      p.vy += (ay * max - p.vy) * kAcc;
    } else {
      const d = Math.pow(0.05, dt); p.vx *= d; p.vy *= d;
    }
    const sp = Math.hypot(p.vx, p.vy);

    // Blockierte Achsen klingen über ~0,15 s aus statt hart zu nullen:
    // Position bleibt an der Kante stehen, aber das Kamera-Look-Ahead
    // (hängt an vx/vy) gleitet zurück statt im selben Frame zu springen.
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (w.elevAt(nx, p.y) > w.GROUND) p.x = nx; else p.vx *= Math.exp(-dt * 18);
    if (w.elevAt(p.x, ny) > w.GROUND) p.y = ny; else p.vy *= Math.exp(-dt * 18);

    if (sp < 8 && !ax && !ay) {
      p.still += dt;
      p.focus = TI.clamp(p.focus + dt / 2.5, 0, 1);
    } else {
      p.still = 0;
      p.focus = TI.clamp(p.focus - dt * 0.3, 0, 1);
    }

    p.speedT = Math.max(0, p.speedT - dt);
    p.slowT = Math.max(0, p.slowT - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);

    // langsame Regeneration, stärker am Schrein
    const home = TI.dist(p.x, p.y, w.shrine.x, w.shrine.y) < 130;
    p.vitality = TI.clamp(p.vitality + dt * (home ? 0.05 : 0.006), 0, 1);

    p.step += Math.hypot(p.vx, p.vy) * dt / 70;
    if (p.step > 1) {
      p.step -= 1; // Phase behalten: Bob und Fußfall laufen ohne Sprung weiter
      p.stride = 1 - (p.stride || 0); // linker/rechter Fuß — Parität für den Halbfrequenz-Sway

      if (Math.hypot(p.vx, p.vy) > 40) TI.events.push({ type: 'step', x: p.x, y: p.y });
    }
  };

  TI.updateCamera = function (state, dt) {
    const p = state.player;
    // Atmung koppelt an Fokus: Stillstehen weitet die Wahrnehmung sichtbar, ohne Text.
    // Phasen-Akkumulator statt sin(t*f): Fokus verlangsamt den Atem ohne Chirp-Artefakte.
    p.breathPh = (p.breathPh || 0) + dt * (1.35 - 0.5 * p.focus);
    // Smoothstep-Amplitude: die Weitung liest sich als ein tiefes Einatmen.
    const f = p.focus * p.focus * (3 - 2 * p.focus);
    const breathAmp = 3 + 9 * f;
    const driftX = Math.sin(p.breathPh) * breathAmp;
    // Mikro-Fußfall (<1 px, gleiche Uhr wie Bob und Step-Sound):
    // man fühlt den Schritt in der Kamera, ohne ihn zu sehen.
    const footfall = Math.sin(p.step * TI.TAU * 2) * 0.6 *
      TI.clamp(Math.hypot(p.vx, p.vy) / (p.maxSp || 175), 0, 1);
    const driftY = Math.cos(p.breathPh * 0.82) * breathAmp * 0.75 + footfall;
    const look = 0.22 * (1 - 0.5 * p.focus);
    const k = 1 - Math.exp(-3 * dt);
    state.camX = TI.lerp(state.camX, p.x + driftX + p.vx * look, k);
    state.camY = TI.lerp(state.camY, p.y + driftY + p.vy * look, k);
    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 2.4);
      // Glatte Sinus-Summe statt Weißrauschen: Erschütterung mit Körper.
      const t = state.t;
      state.camX += (Math.sin(t * 31) + Math.sin(t * 47)) * 5 * state.shake * state.shake;
      state.camY += (Math.sin(t * 29 + 1.7) + Math.sin(t * 41 + 0.6)) * 5 * state.shake * state.shake;
    }
  };

  TI.drawPlayer = function (ctx, state, sx, sy) {
    const p = state.player, w = state.world, t = state.t;
    if (p.dead > 0) return;
    const sp = Math.hypot(p.vx, p.vy);
    // Bob-Phase aus p.step: Fußfall und Körperbewegung teilen dieselbe Uhr.
    const bob = Math.sin(p.step * TI.TAU) * TI.clamp(sp / (p.maxSp || 175), 0, 1) * 1.8;
    // Lateraler Sway: halbe Schrittfrequenz + Fußparität = das klassische
    // Links-rechts-Pendeln des Gehens. Uhr bleibt p.step (stride hält die Phase
    // über den Wrap bei 1 stetig und wechselt die Seite pro Fußfall).
    const sway = Math.sin((p.step + (p.stride || 0)) * TI.TAU * 0.5) * 1.0 *
      TI.clamp(sp / (p.maxSp || 175), 0, 1);

    // Schatten atmet mit dem Bob: Kontakt beim Fußfall, Lösen beim Heben.
    ctx.fillStyle = 'rgba(0,0,0,' + (0.35 + bob * 0.02).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(sx, sy + 9, 8 - bob * 0.5, 3.2, 0, 0, TI.TAU); ctx.fill();

    // Umhang
    ctx.save();
    ctx.translate(sx + sway, sy + bob);
    // facing ist kontinuierlich (±1 als Ziel); geklemmt auf |x| >= 0.15,
    // damit die Wendung als kurz schmale Silhouette liest, nie als Nullbreite.
    const face = p.facing < 0 ? Math.min(p.facing, -0.15) : Math.max(p.facing, 0.15);
    ctx.scale(face, 1);
    // Lean in Bewegungsrichtung — der Umhang lehnt sich in den Schritt.
    // Nach dem scale, damit das Vorzeichen unter Spiegelung stimmt.
    ctx.rotate(0.07 * TI.clamp(p.vx / (p.maxSp || 175), -1, 1) * p.facing);
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
