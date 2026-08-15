// Ersetzt lokale <img src="..."> Verweise durch data:-URIs, damit die Seite selbsttragend ist.
// Nutzung: node tools/inline-images.mjs eingabe.html ausgabe.html
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [inFile, outFile] = process.argv.slice(2);
const base = path.dirname(path.resolve(inFile));
let html = readFileSync(inFile, 'utf8');

html = html.replace(/src="([^"]+\.(png|jpg|jpeg|webp))"/g, (m, rel) => {
  try {
    const p = path.resolve(base, rel);
    const b64 = readFileSync(p).toString('base64');
    const mime = rel.endsWith('.png') ? 'image/png' : rel.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return `src="data:${mime};base64,${b64}"`;
  } catch {
    return m;
  }
});

writeFileSync(outFile, html);
console.log('inlined →', outFile, Math.round(html.length / 1024) + ' KB');
