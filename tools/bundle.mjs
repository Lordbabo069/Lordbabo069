// Bündelt das Spiel in eine einzelne selbsttragende HTML-Datei (für Artifact-Publishing).
// Nutzung: node tools/bundle.mjs [zieldatei]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(root, 'dist', 'terra-incognita.html');

const html = readFileSync(path.join(root, 'game', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);

const body = html
  .replace(/^[\s\S]*?<body>/, '')
  .replace(/<\/body>[\s\S]*$/, '')
  .replace(/<script src="[^"]+"><\/script>\s*/g, '');

const style = (html.match(/<style>[\s\S]*?<\/style>/) || [''])[0];

let js = '';
for (const s of scripts) {
  js += '\n// ==== ' + s + ' ====\n' + readFileSync(path.join(root, 'game', s), 'utf8');
}

const page = `<title>Terra Incognita</title>
${style}
${body}
<script>
${js}
</script>
`;

import { mkdirSync } from 'node:fs';
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, page);
console.log('gebündelt →', out, Math.round(page.length / 1024) + ' KB');
