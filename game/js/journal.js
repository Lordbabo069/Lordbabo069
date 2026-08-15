// Terra Incognita — Feldjournal: Beobachtungen kristallisieren zu Gesetzen.
// Kein Tutorial. Das Journal schreibt nur auf, was der Spieler selbst gesehen hat.
window.TI = window.TI || {};
(function () {
  'use strict';

  TI.journal = { seen: {}, obs: {}, laws: [], facts: {}, open: false, flash: 0, dirty: true };

  const VERBS = {
    heal: 'nährt', hurt: 'brennt', surge: 'ruft die Lichter',
    kindle: 'trägt Feuer', hum: 'summt aus der Tiefe'
  };

  TI.recordSighting = function (state, key, label, glyph) {
    if (TI.journal.seen[key]) return;
    TI.journal.seen[key] = { label, glyph };
    TI.journal.dirty = true;
    TI.journal.flash = Math.max(TI.journal.flash, 1.2);
  };

  TI.recordFact = function (state, key, text) {
    if (TI.journal.facts[key]) return;
    TI.journal.facts[key] = text;
    TI.journal.dirty = true;
    TI.journal.flash = Math.max(TI.journal.flash, 1.6);
  };

  TI.recordObservation = function (state, sp, tag, night) {
    const w = state.world;
    const nightMatters = night && (w.laws.nightInverts || sp.role === 'trickster');
    const key = sp.id + ':' + tag + (nightMatters ? '@n' : '');
    const o = (TI.journal.obs[key] = TI.journal.obs[key] || { n: 0, sp: sp.id, tag, night: nightMatters, done: false });
    o.n++;
    TI.journal.dirty = true;
    if (o.n === 2 && !o.done) {
      o.done = true;
      const prefix = nightMatters ? 'Bei Nacht: ' : '';
      const text = prefix + 'Das ' + sp.name + ' ' + (VERBS[tag] || tag) + '.';
      TI.journal.laws.push({ text, sp: sp.id, tag });
      TI.events.push({ type: 'discovery', x: state.player.x, y: state.player.y, text });
    }
  };

  function drawGlyph(cv, spec) {
    const c = cv.getContext('2d');
    const s = cv.width;
    c.clearRect(0, 0, s, s);
    c.strokeStyle = c.fillStyle = TI.hsl(spec.hue, 55, 62, 0.9);
    c.lineWidth = 1.5;
    const m = s / 2;
    if (spec.shape === 'orb') { c.beginPath(); c.arc(m, m, s * 0.28, 0, TI.TAU); c.fill(); }
    else if (spec.shape === 'stalk') { c.beginPath(); c.moveTo(m, s * 0.85); c.quadraticCurveTo(m + 3, m, m, s * 0.25); c.stroke(); c.beginPath(); c.arc(m, s * 0.22, s * 0.12, 0, TI.TAU); c.fill(); }
    else if (spec.shape === 'fan') { for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(m, s * 0.8); c.quadraticCurveTo(m + i * 4, m, m + i * 6, s * 0.25); c.stroke(); } }
    else if (spec.shape === 'cluster') { for (let i = 0; i < 5; i++) { const a = i / 5 * TI.TAU; c.beginPath(); c.arc(m + Math.cos(a) * s * 0.2, m + Math.sin(a) * s * 0.2, s * 0.1, 0, TI.TAU); c.fill(); } }
    else if (spec.shape === 'spire') { c.beginPath(); c.moveTo(m - s * 0.18, s * 0.82); c.lineTo(m, s * 0.18); c.lineTo(m + s * 0.18, s * 0.82); c.closePath(); c.stroke(); }
    else if (spec.shape === 'creature') { c.beginPath(); c.ellipse(m, m, s * 0.3, s * 0.18, 0, 0, TI.TAU); c.stroke(); c.beginPath(); c.arc(m + s * 0.12, m - s * 0.06, 1.5, 0, TI.TAU); c.fill(); }
    else if (spec.shape === 'monolith') { c.strokeRect(m - s * 0.12, s * 0.2, s * 0.24, s * 0.6); }
  }

  TI.renderJournal = function (state) {
    const el = document.getElementById('journal');
    if (!el) return;
    el.style.display = TI.journal.open ? 'block' : 'none';
    if (!TI.journal.open || !TI.journal.dirty) return;
    TI.journal.dirty = false;

    const w = state.world;
    el.innerHTML = '';
    const h = document.createElement('div');
    h.className = 'jtitle';
    h.textContent = 'Feldjournal — ' + w.name;
    el.appendChild(h);

    function section(title) {
      const s = document.createElement('div');
      s.className = 'jsec';
      s.textContent = title;
      el.appendChild(s);
      return s;
    }

    if (TI.journal.laws.length) {
      section('Verstanden');
      for (const law of TI.journal.laws) {
        const d = document.createElement('div');
        d.className = 'jlaw';
        d.textContent = '✦ ' + law.text;
        el.appendChild(d);
      }
    }

    const openObs = Object.values(TI.journal.obs).filter(o => !o.done);
    const facts = Object.values(TI.journal.facts);
    if (openObs.length || facts.length) {
      section('Vermutungen');
      for (const o of openObs) {
        const sp = w.species[o.sp];
        const d = document.createElement('div');
        d.className = 'jobs';
        d.textContent = '· Das ' + sp.name + ' … ' + (VERBS[o.tag] || o.tag) + '? ' + (o.night ? '(nachts) ' : '');
        el.appendChild(d);
      }
      for (const f of facts) {
        const d = document.createElement('div');
        d.className = 'jobs';
        d.textContent = '· ' + f;
        el.appendChild(d);
      }
    }

    const seen = Object.values(TI.journal.seen);
    if (seen.length) {
      section('Gesichtet');
      const grid = document.createElement('div');
      grid.className = 'jgrid';
      for (const s of seen) {
        const cell = document.createElement('div');
        cell.className = 'jcell';
        const cv = document.createElement('canvas');
        cv.width = cv.height = 30;
        drawGlyph(cv, s.glyph);
        cell.appendChild(cv);
        const lbl = document.createElement('div');
        lbl.textContent = s.label;
        cell.appendChild(lbl);
        grid.appendChild(cell);
      }
      el.appendChild(grid);
    }

    if (!TI.journal.laws.length && !openObs.length && !seen.length && !facts.length) {
      const d = document.createElement('div');
      d.className = 'jobs';
      d.textContent = 'Noch leer. Die Welt wartet.';
      el.appendChild(d);
    }
  };

  TI.toggleJournal = function (state) {
    TI.journal.open = !TI.journal.open;
    TI.journal.dirty = true;
    TI.renderJournal(state);
  };
})();
