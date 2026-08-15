// Terra Incognita — Feldjournal: Beobachtungen kristallisieren zu Gesetzen.
// Kein Tutorial. Das Journal schreibt nur auf, was der Spieler selbst gesehen hat.
window.TI = window.TI || {};
(function () {
  'use strict';

  TI.journal = { seen: {}, obs: {}, laws: [], facts: {}, open: false, flash: 0, dirty: true };

  // Verben erscheinen ERST beim Kristallisieren — eine offene Vermutung weiß noch nichts.
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
      // Glyph-Spec der Spezies mitspeichern: das Gesetz ist die eigene Skizze, kein Bullet.
      const rec = TI.journal.seen['sp' + sp.id];
      const glyph = (rec && rec.glyph) ? rec.glyph : { shape: sp.shape, hue: sp.hue };
      TI.journal.laws.push({ text, sp: sp.id, tag, glyph, fresh: true });
      TI.events.push({ type: 'discovery', x: state.player.x, y: state.player.y, text });
    }
  };

  function drawGlyph(cv, spec) {
    const c = cv.getContext('2d');
    const s = cv.width;
    c.clearRect(0, 0, s, s);
    c.strokeStyle = c.fillStyle = TI.hsl(spec.hue, spec.sat != null ? spec.sat : 55, spec.light != null ? spec.light : 62, 0.9);
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

  // Farbton eines verstandenen Glyphen Richtung Gold (~46) anheben — Erkenntnis hat eine Farbe.
  function goldward(hue) {
    const h = ((hue % 360) + 360) % 360;
    const d = ((46 - h + 540) % 360) - 180;
    return h + d * 0.75;
  }

  // Handschrift-Kadenz: deterministisch aus dem Eintrags-Key, nie Math.random pro Frame.
  function cadence(el, key) {
    const h = TI.hash('jot:' + key)();
    el.style.transform = 'rotate(' + (((h % 5) - 2) * 0.4).toFixed(1) + 'deg)';
    el.style.marginLeft = ((h >>> 3) % 4) + 'px';
    el.style.marginTop = (2 + ((h >>> 5) % 3)) + 'px';
  }

  // Papier statt Panel: einmal pro Welt eine warme Korn-Textur, tonal aus der Weltpalette.
  let paperSeed = null, paperURL = '';
  function paperFor(w) {
    if (paperSeed === w.seed) return paperURL;
    const rng = TI.rngFrom('paper:' + w.seed);
    const S = 108;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const sat = 8 + rng() * 10; // gedeckt, deutlich unter 20
    const base = TI.hslToRgb(w.palette.baseHue, sat, 11 + rng() * 3);
    const img = c.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const g = (rng() - 0.5) * 13 + (rng() - 0.5) * 5;
      const fleck = rng() < 0.012 ? -(6 + rng() * 8) : 0;
      const j = i * 4;
      img.data[j] = TI.clamp(base[0] + g + fleck + 4, 0, 255);     // warmer Stich
      img.data[j + 1] = TI.clamp(base[1] + g + fleck + 1, 0, 255);
      img.data[j + 2] = TI.clamp(base[2] + g + fleck - 3, 0, 255);
      img.data[j + 3] = 250; // Papier, nicht Glas — die Welt scheint kaum noch durch
    }
    c.putImageData(img, 0, 0);
    paperSeed = w.seed;
    paperURL = cv.toDataURL();
    return paperURL;
  }

  TI.renderJournal = function (state) {
    const el = document.getElementById('journal');
    if (!el) return;
    el.style.display = TI.journal.open ? 'block' : 'none';
    if (!TI.journal.open || !TI.journal.dirty) return;
    TI.journal.dirty = false;

    const w = state.world;
    // Offen besitzt das Journal den Frame: großes Papier, rechts mittig, opak-warm.
    el.style.width = '38vw';
    el.style.maxHeight = '80vh';
    el.style.top = '50%';
    el.style.right = '3vw';
    el.style.transform = 'translateY(-50%)';
    el.style.padding = '26px 30px';
    el.style.backgroundColor = TI.hsl(w.palette.baseHue, 12, 7, 0.92);
    el.style.backgroundImage = 'url(' + paperFor(w) + ')';
    // Kein gerader UI-Rand: ein weicher, unregelmäßiger Papiersaum aus Schatten.
    el.style.border = 'none';
    el.style.borderRadius = '2px';
    el.style.boxShadow = 'inset 0 0 24px rgba(0,0,0,0.35), 0 0 40px rgba(0,0,0,0.5)';

    // Geritzte Linie — dieselbe Handschrift-Geste für Unverstandenes und Überschriften.
    function scratchLine(key) {
      const line = document.createElement('div');
      const hh = TI.hash('scratch:' + key)();
      line.style.borderBottom = '1px solid ' + TI.hsl(w.palette.baseHue, 18, 58, 0.28);
      line.style.height = '0';
      line.style.margin = '5px ' + (3 + (hh % 4)) + 'px 1px ' + (3 + ((hh >>> 4) % 4)) + 'px';
      line.style.transform = 'rotate(' + ((((hh >>> 2) % 5) - 2) * 0.5).toFixed(1) + 'deg)';
      return line;
    }

    el.innerHTML = '';
    const h = document.createElement('div');
    h.className = 'jtitle';
    h.textContent = 'Feldjournal — ' + w.name;
    el.appendChild(h);

    function section(title) {
      // Die Überschrift gehört zur Handschrift, nicht zum UI: leise, kursiv, mit Kratzlinie.
      const s = document.createElement('div');
      s.className = 'jsec';
      s.textContent = title.toLowerCase();
      s.style.fontStyle = 'italic';
      s.style.letterSpacing = '0';
      s.style.textTransform = 'none';
      s.style.fontSize = '12px';
      s.appendChild(scratchLine('sec:' + title));
      el.appendChild(s);
      return s;
    }

    if (TI.journal.laws.length) {
      section('Verstanden');
      for (const law of TI.journal.laws) {
        const d = document.createElement('div');
        d.className = 'jlaw';
        d.style.display = 'flex';
        d.style.alignItems = 'center';
        d.style.gap = '7px';
        const cv = document.createElement('canvas');
        cv.width = cv.height = 30;
        cv.style.flex = '0 0 auto';
        const spec = law.glyph || ((w.species[law.sp]) ? { shape: w.species[law.sp].shape, hue: w.species[law.sp].hue } : { shape: 'orb', hue: 46 });
        drawGlyph(cv, { shape: spec.shape, hue: goldward(spec.hue), sat: 60, light: 70 });
        d.appendChild(cv);
        const t = document.createElement('span');
        t.textContent = law.text;
        d.appendChild(t);
        cadence(d, 'law:' + law.sp + ':' + law.tag);
        if (law.fresh) {
          // Zweitaktiger Tinten-Reveal: erst schärft sich der Satz, dann kommt
          // die eigene Skizze an — warm, kurz, verdient. Nur beim ersten Aufschlagen.
          law.fresh = false;
          t.style.filter = 'blur(2.5px)';
          t.style.color = TI.hsl(46, 65, 70);
          t.style.transition = 'filter 1.6s ease-out, color 1.6s ease-out';
          cv.style.opacity = '0';
          cv.style.transition = 'opacity 1.2s ease-out 0.5s';
          d.style.boxShadow = '0 0 18px hsla(46,60%,60%,0.3)';
          d.style.transition = 'box-shadow 2.5s ease-out';
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              t.style.filter = 'blur(0)';
              t.style.color = '#e8c96a';
              cv.style.opacity = '1';
              d.style.boxShadow = '0 0 18px hsla(46,60%,60%,0)';
            });
          });
        }
        el.appendChild(d);
      }
    }

    const obsEntries = Object.entries(TI.journal.obs).filter(([, o]) => !o.done);
    const factEntries = Object.entries(TI.journal.facts);
    if (obsEntries.length || factEntries.length) {
      section('Vermutungen');
      for (const [key, o] of obsEntries) {
        const sp = w.species[o.sp];
        const d = document.createElement('div');
        d.className = 'jobs';
        // Kein Verb: die Vermutung darf das Gesetz nicht verraten.
        d.textContent = '· Das ' + sp.name + ' …?' + (o.night ? ' (nachts)' : '');
        // Evidenz wächst sichtbar: pro Sichtung ein kleiner Tintenstrich —
        // die Kristallisation bei n=2 kommt dann nicht aus dem Nichts.
        for (let i = 0; i < o.n; i++) {
          const tick = document.createElement('span');
          const th = TI.hash('tally:' + key + ':' + i)();
          tick.style.display = 'inline-block';
          tick.style.width = '0';
          tick.style.height = '9px';
          tick.style.borderLeft = '1.5px solid ' + TI.hsl(w.palette.baseHue, 22, 62, 0.55);
          tick.style.marginLeft = (i === 0 ? 8 : 3 + (th % 3)) + 'px';
          tick.style.verticalAlign = '-1px';
          tick.style.transform = 'rotate(' + ((((th >>> 3) % 7) - 3) * 2) + 'deg)';
          d.appendChild(tick);
        }
        cadence(d, 'obs:' + key);
        el.appendChild(d);
      }
      for (const [key, f] of factEntries) {
        const d = document.createElement('div');
        d.className = 'jobs';
        d.textContent = '· ' + f;
        cadence(d, 'fact:' + key);
        el.appendChild(d);
      }
    }

    const seenEntries = Object.entries(TI.journal.seen);
    if (seenEntries.length) {
      section('Gesichtet');
      const grid = document.createElement('div');
      grid.className = 'jgrid';
      for (const [key, s] of seenEntries) {
        const cell = document.createElement('div');
        cell.className = 'jcell';
        const cv = document.createElement('canvas');
        cv.width = cv.height = 30;
        drawGlyph(cv, s.glyph);
        cell.appendChild(cv);
        const lbl = document.createElement('div');
        lbl.textContent = s.label;
        cell.appendChild(lbl);
        const hasLaw = TI.journal.laws.some(l => ('sp' + l.sp) === key);
        if (!hasLaw) {
          // Das Unbekannte als Negativraum: eine leere geritzte Linie, keinerlei Worte.
          cell.appendChild(scratchLine(key));
        }
        cadence(cell, 'cell:' + key);
        grid.appendChild(cell);
      }
      el.appendChild(grid);
    }

    if (!TI.journal.laws.length && !obsEntries.length && !seenEntries.length && !factEntries.length) {
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
