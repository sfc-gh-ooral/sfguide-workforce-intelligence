// Captures the landing-page screenshots and catalog card images from the hosted example.
//
//   npm run build:example        # refresh docs/try/ first if the UI changed
//   npm run capture              # writes docs/images/*.png and docs/catalog/*.jpg
//
// Runs headless Chromium at a fixed 16:10 viewport with a fresh profile and no sign-in, so only
// synthetic sample data can appear in the images. Review every image before publishing anyway.

import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const DOCS = join(ROOT, 'docs');
const BASE = '/sfguide-workforce-intelligence/try'; // must match basePath in next.config.ts
const CARD_ID = 'workforce-intelligence';            // catalog id: cards are <id>-<n>.jpg
const VIEWPORT = { width: 1600, height: 1000 };
const PAGE_SCALE = 1.25;  // 2000x1250 images for the landing page
const CARD_SCALE = 0.6;   // 1600x1000 CSS px -> 960x600 card

const AI = { timeout: 30000 };
const persona = (p) => async (page) => { await page.evaluate((x) => localStorage.setItem('wi-persona', x), p); await page.reload(); };

// The walkthrough, in story order. `card` marks which shots become catalog cards (in that order).
const SHOTS = [
  { name: '01-overview-hrbp', card: 1, path: '/', persona: 'hrbp' },
  { name: '02-pay-masked-hrbp', card: 3, path: '/pay-equity/', persona: 'hrbp' },
  { name: '03-attrition-hrbp', card: 2, path: '/attrition/', persona: 'hrbp' },
  {
    name: '04-team-brief-hrbp', path: '/attrition/', persona: 'hrbp',
    async act(page) {
      await page.locator('tbody tr a').first().click();
      await page.getByRole('button', { name: 'Draft a conversation plan' }).click();
      await page.locator('.prose-ai').waitFor(AI);
    },
  },
  {
    name: '05-voice-hrbp', card: 4, path: '/voice/', persona: 'hrbp',
    async act(page) {
      await page.getByRole('button', { name: 'Summarize the comments' }).click();
      await page.locator('.prose-ai').waitFor(AI);
      await page.evaluate(() => window.scrollTo(0, 420));
    },
  },
  {
    name: '06-pay-equity-comp', card: 5, path: '/pay-equity/', persona: 'comp',
    async act(page) {
      await page.getByRole('button', { name: 'Explain this gap' }).click();
      await page.locator('.prose-ai').waitFor(AI);
    },
  },
  { name: '07-attrition-chro', card: 6, path: '/attrition/', persona: 'chro' },
  {
    name: '08-ask-hrbp', card: 7, path: '/ask/', persona: 'hrbp',
    async act(page) {
      await page.getByRole('button', { name: 'Why are people leaving Payment Operations?' }).click();
      await page.locator('.prose-ai').nth(0).waitFor(AI);
      await page.getByRole('button', { name: 'How many open reqs in Technology are older than 60 days?' }).click();
      await page.locator('.prose-ai').nth(1).waitFor(AI);
    },
  },
  { name: '09-overview-chro-dark', path: '/', persona: 'chro', scheme: 'dark' },
];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

// Serves docs/try/ at the GitHub Pages path, the way the hosted example is published.
function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(BASE)) { res.writeHead(404).end(); return; }
    let file = normalize(join(DOCS, 'try', decodeURIComponent(url.pathname.slice(BASE.length))));
    if (!file.startsWith(join(DOCS, 'try'))) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

if (!existsSync(join(DOCS, 'try', 'index.html'))) throw new Error('Run `npm run build:example` first.');
mkdirSync(join(DOCS, 'images'), { recursive: true });
mkdirSync(join(DOCS, 'catalog'), { recursive: true });
const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}${BASE}`;
const browser = await chromium.launch();

async function capture(shot, scale, file, type) {
  const scheme = shot.scheme ?? 'light';
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: scale, colorScheme: scheme });
  await ctx.addInitScript((s) => { localStorage.setItem('wi-mode', 'sample'); localStorage.setItem('wi-theme', s); }, scheme);
  const page = await ctx.newPage();
  await page.goto(origin + shot.path, { waitUntil: 'networkidle' });
  await persona(shot.persona)(page);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1300); // let count-ups and charts settle
  if (shot.act) { await shot.act(page); await page.waitForTimeout(700); }
  await page.screenshot({ path: file, type, ...(type === 'jpeg' ? { quality: 80 } : {}) });
  await ctx.close();
}

for (const shot of SHOTS) {
  await capture(shot, PAGE_SCALE, join(DOCS, 'images', `${shot.name}.png`), 'png');
  if (shot.card) await capture(shot, CARD_SCALE, join(DOCS, 'catalog', `${CARD_ID}-${shot.card}.jpg`), 'jpeg');
  console.log(`captured ${shot.name}${shot.card ? ` (card ${shot.card})` : ''}`);
}
await browser.close();
server.close();
