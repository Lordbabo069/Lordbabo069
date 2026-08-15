// Terra Incognita — Spielschleife, Eingabe, Interaktion, Ereignisse.
window.TI = window.TI || {};
(function () {
  'use strict';

  TI.events = [];

  const params = new URLSearchParams(location.search);
  const seed = params.get('seed') || Math.random().toString(36).slice(2, 8).toUpperCase();

  const canvas = document.getElementById('game');
  const state = {
    seed,
    world: null, player: null, creatures: null,
    input: {}, t: 0, dt: 0.016,
    tod: params.has('tod') ? parseFloat(params.get('tod')) : 0.07,
    todLocked: params.has('tod'),
    camX: 0, camY: 0, shake: 0,
    surgeT: 0, surgeX: 0, surgeY: 0, goldT: 0,
    ctx: canvas.getContext('2d'), canvas,
    vw: 0, vh: 0, frames: 0, callT: 4
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    state.vw = Math.round(window.innerWidth);
    state.vh = Math.round(window.innerHeight);
    canvas.width = Math.round(state.vw * dpr);
    canvas.height = Math.round(state.vh * dpr);
    canvas.style.width = state.vw + 'px';
    canvas.style.height = state.vh + 'px';
    state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  state.world = TI.generateWorld(seed);
  state.player = TI.createPlayer(state.world);
  state.creatures = TI.spawnCreatures(state.world);
  state.camX = state.player.x; state.camY = state.player.y;
  TI.initAtmosphere(state);

  document.getElementById('title').textContent = state.world.name;

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right'
  };

  window.addEventListener('keydown', e => {
    TI.initSound(state.world);
    const k = KEYMAP[e.code];
    if (k) { state.input[k] = true; e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'Space') { tryInteract(); e.preventDefault(); }
    if (e.code === 'Tab' || e.code === 'KeyJ') { TI.toggleJournal(state); e.preventDefault(); }
    hideHintSoon();
  });
  window.addEventListener('keyup', e => {
    const k = KEYMAP[e.code];
    if (k) state.input[k] = false;
  });
  window.addEventListener('pointerdown', () => TI.initSound(state.world));

  let hintT = 14;
  function hideHintSoon() { hintT = Math.min(hintT, 3.5); }

  function isNight() { return TI.nightness(state.tod) > 0.55; }

  function effectFor(sp) {
    const w = state.world, night = isNight();
    let tag;
    switch (sp.role) {
      case 'benefactor': tag = 'heal'; break;
      case 'hazard': tag = 'hurt'; break;
      case 'catalyst': tag = 'surge'; break;
      case 'beacon': tag = 'kindle'; break;
      case 'trickster': tag = night ? 'heal' : 'hurt'; break;
    }
    if (w.laws.nightInverts && night) {
      if (tag === 'heal') tag = 'hurt';
      else if (tag === 'hurt') tag = 'heal';
    }
    return tag;
  }

  function tryInteract() {
    const p = state.player, w = state.world;
    if (p.dead > 0) return;

    // Monolith?
    for (const m of w.monoliths) {
      if (TI.dist(p.x, p.y, m.x, m.y) < 70) {
        m.seenT = 3;
        TI.sfx('monolith');
        TI.spawnBurst(state, m.x, m.y - 40, w.palette.hueB, 14, 26, 20);
        TI.recordSighting(state, 'monolith', 'Monolith', { shape: 'monolith', hue: w.palette.hueB });
        TI.recordFact(state, 'monolith-hum', 'Die Steine summen. Für wen?');
        return;
      }
    }

    let best = null, bd = 48;
    for (const f of w.flora) {
      if (f.cd > 0) continue;
      const d = TI.dist(p.x, p.y, f.x, f.y);
      if (d < bd) { bd = d; best = f; }
    }
    if (!best) return;
    const sp = w.species[best.s];
    best.cd = 0.9;
    const night = isNight();
    const tag = effectFor(sp);

    TI.sfx('touch');
    TI.spawnBurst(state, best.x, best.y - 6, sp.hue, 10, 30, 16);

    if (tag === 'heal') {
      p.vitality = TI.clamp(p.vitality + 0.22, 0, 1);
      p.speedT = Math.max(p.speedT, 5);
      TI.sfx('heal');
    } else if (tag === 'hurt') {
      p.vitality -= 0.28;
      p.hurtT = 1;
      state.shake = Math.max(state.shake, 0.7);
      const d = bd || 1;
      p.vx += (p.x - best.x) / d * 190;
      p.vy += (p.y - best.y) / d * 190;
      TI.sfx('hurt');
      if (p.vitality <= 0) die();
    } else if (tag === 'surge') {
      state.surgeT = 12; state.surgeX = best.x; state.surgeY = best.y;
      for (const f of w.flora) if (w.species[f.s].role === 'beacon') f.lit = true;
      if (w.laws.lightDraws) for (const c of state.creatures) if (c.kind === 'stalker') c.aggro = 20;
      TI.sfx('surge');
      TI.spawnBurst(state, best.x, best.y, sp.hue, 30, 90, 30);
    } else if (tag === 'kindle') {
      best.lit = !best.lit;
      TI.sfx('kindle');
    }

    if (w.laws.touchEchoes) {
      for (const f of w.flora) {
        if (f !== best && f.s === best.s && TI.dist(f.x, f.y, best.x, best.y) < 280) f.echo = 1;
      }
    }

    TI.recordSighting(state, 'sp' + sp.id, sp.name, { shape: sp.shape, hue: sp.hue });
    TI.recordObservation(state, sp, tag, night);
  }

  function die() {
    const p = state.player;
    p.dead = 2.4;
    TI.recordFact(state, 'death', 'Der Boden nahm mich zurück zum Steinkreis.');
  }

  function processEvents(dt) {
    for (const ev of TI.events) {
      if (ev.type === 'maul') {
        state.player.vitality -= 0.34;
        state.player.hurtT = 1;
        state.shake = Math.max(state.shake, 1);
        TI.sfx('maul');
        TI.recordFact(state, 'stalker', 'Etwas jagt, wenn das Licht fehlt.');
        if (state.player.vitality <= 0) die();
      } else if (ev.type === 'discovery') {
        state.goldT = 1.6;
        TI.sfx('discovery');
        TI.spawnBurst(state, ev.x, ev.y, 46, 26, 60, 26);
      } else if (ev.type === 'step') {
        // Platz für Schritt-Effekte
      }
    }
    TI.events.length = 0;
  }

  function autoSight() {
    const p = state.player, w = state.world;
    for (const c of state.creatures) {
      const d = TI.dist(p.x, p.y, c.x, c.y);
      if (d < 240) {
        const label = c.kind === 'drifter' ? 'Treiber' : c.kind === 'watcher' ? 'Späher' : 'Jäger';
        if (c.kind !== 'stalker' || isNight() || c.aggro > 0) {
          TI.recordSighting(state, 'cr' + c.kind, label, { shape: 'creature', hue: w.palette.hueC + w.creatureSpec.hueShift });
        }
      }
      if (c.kind === 'watcher' && p.focus > 0.9 && TI.dist(p.x, p.y, c.x, c.y) < 240) {
        c.observed += state.dt;
        if (c.observed > 4) TI.recordFact(state, 'watcher-still', 'Die Späher bleiben, wenn ich still bin.');
      }
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = TI.clamp((now - last) / 1000, 0, 0.05);
    last = now;
    state.dt = dt;
    state.t += dt;
    if (!state.todLocked) state.tod = (state.tod + dt / 240) % 1;
    state.surgeT = Math.max(0, state.surgeT - dt);
    state.goldT = Math.max(0, state.goldT - dt);

    TI.updatePlayer(state, dt);
    TI.updateCreatures(state, dt);
    TI.updateCamera(state, dt);
    processEvents(dt);
    autoSight();

    // gelegentliche Rufe aus der Ferne
    state.callT -= dt;
    if (state.callT <= 0) {
      state.callT = 6 + Math.random() * 14;
      TI.sfx('call', { pan: Math.random() * 2 - 1 });
    }

    TI.render(state);
    TI.renderJournal(state);

    hintT -= dt;
    const hint = document.getElementById('hint');
    if (hint) hint.style.opacity = TI.clamp(hintT / 3, 0, 0.55);
    const title = document.getElementById('title');
    if (title) title.style.opacity = TI.clamp((5 - state.t) / 2, 0, 1);

    state.frames++;
    if (state.frames === 40) window.__ready = true;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Debug-API für Screenshot-Harness
  TI.debug = {
    state,
    teleport(x, y) { state.player.x = x; state.player.y = y; state.camX = x; state.camY = y; },
    setTod(v) { state.tod = v; state.todLocked = true; },
    openJournal() { TI.journal.open = true; TI.journal.dirty = true; TI.renderJournal(state); },
    poke(n) {
      // simuliere n Interaktionen mit nächstgelegener Flora für Journal-Tests
      for (let i = 0; i < (n || 3); i++) {
        for (const f of state.world.flora) f.cd = 0;
        tryInteract();
      }
    }
  };
})();
