// Terra Incognita — Kernwerkzeuge. Globaler Namensraum TI.
window.TI = window.TI || {};
(function () {
  'use strict';

  // xmur3 String-Hash -> 32-bit Seed-Generator
  TI.hash = function (str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  };

  TI.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  TI.rngFrom = (seedStr) => TI.mulberry32(TI.hash(seedStr)());
  TI.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  TI.lerp = (a, b, t) => a + (b - a) * t;
  TI.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  TI.TAU = Math.PI * 2;
  TI.hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;

  TI.hslToRgb = function (h, s, l) {
    h = (((h % 360) + 360) % 360) / 360; s /= 100; l /= 100;
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = t => {
      t = ((t % 1) + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
  };

  // 2D-Value-Noise mit fbm
  TI.makeNoise2 = function (rng) {
    const SZ = 256, perm = new Uint8Array(SZ * 2), vals = new Float32Array(SZ);
    const p = [...Array(SZ).keys()];
    for (let i = SZ - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const tmp = p[i]; p[i] = p[j]; p[j] = tmp; }
    for (let i = 0; i < SZ * 2; i++) perm[i] = p[i & 255];
    for (let i = 0; i < SZ; i++) vals[i] = rng();
    const fade = t => t * t * (3 - 2 * t);
    const at = (xi, yi) => vals[perm[(xi & 255) + perm[yi & 255]]];
    function noise(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi, u = fade(xf), v = fade(yf);
      return TI.lerp(TI.lerp(at(xi, yi), at(xi + 1, yi), u), TI.lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
    }
    noise.fbm = function (x, y, oct = 4, lac = 2, gain = 0.5) {
      let amp = 0.5, f = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) { sum += amp * noise(x * f, y * f); norm += amp; amp *= gain; f *= lac; }
      return sum / norm;
    };
    return noise;
  };

  // 0 = heller Tag, 1 = tiefste Nacht
  TI.nightness = tod => (1 - Math.cos(TI.TAU * (((tod % 1) + 1) % 1))) / 2;
})();
