// Re-encodiert PNGs eines Verzeichnisses als skalierte JPEGs (via Chromium).
// Nutzung: node tools/reencode.mjs <dir> [breite] [qualitaet]
import { chromium } from 'playwright';
import { readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] || 'docs/shots');
const width = parseInt(process.argv[3] || '1024', 10);
const quality = parseInt(process.argv[4] || '72', 10);

let browser;
try { browser = await chromium.launch(); }
catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }); }

const files = readdirSync(dir).filter(f => f.endsWith('.png'));
for (const f of files) {
  const height = Math.round(width * 9 / 16);
  const page = await browser.newPage({ viewport: { width, height } });
  const htmlPath = path.join(dir, '_re.html');
  writeFileSync(htmlPath, `<body style="margin:0"><img src="${f}" style="width:${width}px;display:block">`);
  await page.goto('file://' + htmlPath);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, f.replace(/\.png$/, '.jpg')), type: 'jpeg', quality });
  await page.close();
  unlinkSync(path.join(dir, f));
  unlinkSync(htmlPath);
  console.log(f, '→ jpg');
}
await browser.close();
