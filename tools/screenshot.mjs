// Screenshot-Harness für Terra Incognita.
// Startet einen lokalen Server auf zufälligem Port, lädt definierte Szenen,
// speichert PNGs und meldet Konsolenfehler (Exit-Code 1 bei Fehlern).
// Nutzung: node tools/screenshot.mjs [--out shots/mydir] [--seeds VELT,ORUN]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function opt(name, dflt) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
}
const outDir = path.resolve(root, opt('out', 'shots'));
const seeds = opt('seeds', 'VELT,ORUN').split(',');
mkdirSync(outDir, { recursive: true });

const port = 8100 + Math.floor(Math.random() * 800);
const server = spawn('python3', ['-m', 'http.server', String(port), '--directory', path.join(root, 'game')], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const errors = [];
let browser;
try {
  browser = await chromium.launch();
} catch (e) {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
}
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

async function shot(name, url, actions) {
  await page.goto(`http://127.0.0.1:${port}/index.html${url}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 15000 }).catch(() => errors.push(name + ': __ready timeout'));
  if (actions) await actions(page);
  await page.waitForTimeout(4600);
  await page.screenshot({ path: path.join(outDir, name + '.png') });
  console.log('shot:', name);
}

for (const seed of seeds) {
  await shot(`${seed}-day`, `?seed=${seed}&tod=0.08`);
  await shot(`${seed}-dusk`, `?seed=${seed}&tod=0.38`);
  await shot(`${seed}-night`, `?seed=${seed}&tod=0.5`, async p => {
    await p.keyboard.press('KeyW'); // Sound-Init + Hint-Fade anstoßen
  });
}
// Journal-Szene: ein paar Interaktionen simulieren, Journal öffnen
await shot('journal', `?seed=${seeds[0]}&tod=0.2`, async p => {
  await p.evaluate('TI.debug.poke(6)');
  await p.evaluate('TI.debug.openJournal()');
});

await browser.close();
server.kill();

if (errors.length) {
  console.error('KONSOLENFEHLER:');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log('OK — keine Konsolenfehler. Bilder in', outDir);
