#!/usr/bin/env node
/*
 * Regenerates the README screenshots from the running app.
 *
 *   node scripts/make_screenshots.mjs            # writes docs/screenshot.png and docs/img/app-*.png
 *
 * Serves the repository's static files on 127.0.0.1 (random port), opens them in headless
 * Chromium via Playwright and captures the default base case, the Sensitivity lab, the DCF
 * view and a validation error, at desktop and phone widths. It prints the headline numbers
 * read from the page so the README alt text can be checked against them.
 *
 * Playwright is NOT a dependency of this repo. The script uses a locally installed copy
 * (project or global `npm root -g`). Set CHROMIUM_PATH to use a specific Chromium binary.
 * PNGs are written as captured; see scripts/optimise_png.py to palette-quantise them.
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function loadPlaywright() {
  try { return require('playwright'); } catch { /* fall through to global install */ }
  const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  return require(path.join(globalRoot, 'playwright'));
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.json': 'application/json', '.txt': 'text/plain' };

function serve() {
  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.normalize(path.join(root, urlPath === '/' ? 'index.html' : urlPath));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const shots = [
  { name: 'app-lbo-returns', view: 'cockpit', fullPage: true },
  { name: 'app-sensitivity', view: 'sensitivity', mobileView: 'cockpit-sensitivity' },
  { name: 'app-dcf', view: 'dcf' },
  { name: 'app-validation-error', view: 'cockpit', debtMultiple: '9' }
];
const viewports = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};

async function main() {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const errors = [];
  await mkdir(path.join(root, 'docs/img'), { recursive: true });
  try {
    for (const [device, viewport] of Object.entries(viewports)) {
      for (const shot of shots) {
        const { width, height, ...device_ } = viewport;
        const context = await browser.newContext({ viewport: { width, height }, ...device_, colorScheme: 'dark', reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${shot.name}/${device}: ${e.message}`));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`${shot.name}/${device}: ${m.text()}`); });
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction(() => document.getElementById('irr')?.textContent.includes('%'));
        // The toast is position:fixed and parked just below the viewport; a full-page capture would show it.
        await page.addStyleTag({ content: '.toast{visibility:hidden}' });
        if (shot.debtMultiple) await page.fill('#debtMultiple', shot.debtMultiple);
        const view = device === 'mobile' && shot.mobileView ? shot.mobileView : shot.view;
        if (view === 'cockpit-sensitivity') await page.locator('#cockpitSensitivity').scrollIntoViewIfNeeded();
        else if (view !== 'cockpit') await page.click(`.nav-item[data-view="${view}"]`);
        await page.waitForTimeout(150);
        const file = path.join(root, 'docs/img', `${shot.name}-${device}.png`);
        if (view === 'cockpit-sensitivity') await page.locator('.sensitivity-panel').screenshot({ path: file });
        else await page.screenshot({ path: file, fullPage: Boolean(shot.fullPage && device === 'desktop') });
        const read = (id) => page.evaluate((i) => document.getElementById(i)?.textContent ?? null, id);
        console.log(`${path.relative(root, file)}\tIRR ${await read('irr')}\tMOIC ${await read('moic')}\tentry equity ${await read('entryEquity')}\texit equity ${await read('exitEquity')}\talert ${JSON.stringify((await read('modelAlert')) || '')}\tDCF EV ${await read('dcfEv')}\tPV FCF ${await read('dcfPv')}\tPV TV ${await read('dcfTerminal')}`);
        if (shot.name === 'app-lbo-returns' && device === 'desktop') {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: path.join(root, 'docs/screenshot.png') });
          console.log('docs/screenshot.png');
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) { console.error('Page errors:\n' + errors.join('\n')); process.exitCode = 1; }
}

main().catch((e) => { console.error(e); process.exit(1); });
