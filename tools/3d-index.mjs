#!/usr/bin/env node
// Writes 3d.json: every subtopic that has a 3D model, for the iPhone app's "View in 3D" button.
//   {"v":1,"at":"<date>","t":["<emoji> <title>",…],"m":{"<subject>/<level>/<board>":{"<subtopic>":<index into t>}}}
// The list comes from the page itself (Embed3D.index in index.html, after js/models.js has loaded), so
// it always matches what the 3D view shows. Run it after adding or changing models:
//   node tools/3d-index.mjs          (needs Playwright: npm i -g playwright && npx playwright install chromium)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.error('Playwright is needed: npm i -g playwright'); process.exit(1); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(ROOT, u.endsWith('/') ? u + 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // no backend calls: the list only needs the content and the models
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => (/fonts\.(googleapis|gstatic)\.com/.test(r.request().url()) ? r.continue() : r.abort()));
  await page.goto(`${base}/?app=3d#index`);
  await page.waitForSelector('#e3idx', { timeout: 120000 });
  const m = JSON.parse(await page.textContent('#e3idx'));
  const n = Object.values(m).reduce((a, o) => a + Object.keys(o).length, 0);
  if (n < 50) throw new Error(`only ${n} subtopics with a 3D model: something is wrong`);
  // the titles repeat a lot, so each is stored once and the subtopics point to it
  const t = [...new Set(Object.values(m).flatMap((o) => Object.values(o)))].sort(), ix = new Map(t.map((x, i) => [x, i]));
  const out = JSON.stringify({ v: 1, at: new Date().toISOString().slice(0, 10), t, m: Object.fromEntries(Object.entries(m).map(([k, o]) => [k, Object.fromEntries(Object.entries(o).map(([s, v]) => [s, ix.get(v)]))])) });
  fs.writeFileSync(path.join(ROOT, '3d.json'), out + '\n');
  console.log(`3d.json: ${n} subtopics in ${Object.keys(m).length} courses, ${Math.round(out.length / 1024)} KB`);
} finally {
  await browser.close();
  server.close();
}
