#!/usr/bin/env node
// Regenerates docs/img/hero-{dark,light}.svg and docs/img/social-preview.svg.
// Every number is computed by model.js at the documented base case; nothing is typed in by hand.
// Run: node scripts/make-hero.js   (then see README "Regenerating artwork" for the PNG step)
'use strict';
const fs = require('fs');
const path = require('path');
const M = require('../model.js');

const BASE = { ev: 425, ebitda: 52, debtMultiple: 4.5, interest: 0.0825, hold: 5, exitMultiple: 8.2, growth: [0.12, 0.11, 0.10, 0.09, 0.08], margin: [0.21, 0.22, 0.23, 0.24, 0.25], fcfConversion: 0.65, amortPct: 0.01, interestBasis: 'average' };
const r = M.lbo(BASE);
const a = r.attribution;
const f1 = (x) => x.toFixed(1);

const MONO = "'DejaVu Sans Mono',Menlo,Consolas,monospace";
const SERIF = "Georgia,'DejaVu Serif',serif";

const THEMES = {
  dark: { bg: '#090A09', panel: '#0E100E', line: '#1F231F', text: '#E9ECE6', mute: '#8A918A', acc: '#00FF66', acc2: '#B6FF2E', base: '#5B635B', neg: '#FF6B5E' },
  light: { bg: '#F4F5F2', panel: '#FFFFFF', line: '#D7DAD3', text: '#14170F', mute: '#5B635B', acc: '#0B8A3E', acc2: '#5E8A00', base: '#8A918A', neg: '#C23B2E' },
};

function build({ theme, W, H, animate }) {
  const t = THEMES[theme];
  const S = H / 360; // vertical scale relative to the 1280x360 hero
  const winX = 24, winY = 24, winW = W - 48, winH = H - 48;
  const chartX0 = Math.round(W * 0.5), chartX1 = W - 64;
  const base = winY + winH - 56;
  const chartH = winH - 170;
  const k = chartH / (r.exitEquity * 1.0);
  const steps = [
    { label: 'ENTRY EQUITY', v: r.entryEquity, from: 0, to: r.entryEquity, col: t.base, txt: f1(r.entryEquity) },
    { label: 'EBITDA GROWTH', v: a.ebitdaGrowth, from: r.entryEquity, to: r.entryEquity + a.ebitdaGrowth, col: t.acc, txt: '+' + f1(a.ebitdaGrowth) },
    { label: 'MULTIPLE', v: a.multiple, from: r.entryEquity + a.ebitdaGrowth, to: r.entryEquity + a.ebitdaGrowth + a.multiple, col: t.acc2, txt: '+' + f1(a.multiple) },
    { label: 'DEBT PAYDOWN', v: a.debtPaydown, from: r.entryEquity + a.ebitdaGrowth + a.multiple, to: r.exitEquity, col: t.acc, txt: '+' + f1(a.debtPaydown) },
    { label: 'EXIT EQUITY', v: r.exitEquity, from: 0, to: r.exitEquity, col: t.acc2, txt: f1(r.exitEquity) },
  ];
  const n = steps.length, slot = (chartX1 - chartX0) / n, bw = Math.round(slot * 0.58);
  let css = `text{font-family:${MONO}}.serif{font-family:${SERIF}}`;
  let bars = '', labels = '', conn = '';
  steps.forEach((s, i) => {
    const x = Math.round(chartX0 + i * slot + (slot - bw) / 2);
    const yTop = base - s.to * k, h = Math.max(2, (s.to - s.from) * k);
    const cls = `b${i}`;
    // Bars grow from their own base edge; the resting (unanimated) state is the finished chart.
    bars += `<rect class="${cls}" x="${x}" y="${yTop.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="2" fill="${s.col}"/>`;
    labels += `<text x="${x + bw / 2}" y="${(yTop - 10).toFixed(1)}" font-size="${13 + (S > 1 ? 2 : 0)}" font-weight="700" fill="${t.text}" text-anchor="middle">${s.txt}</text>`;
    labels += `<text x="${x + bw / 2}" y="${base + 22}" font-size="10.5" fill="${t.mute}" text-anchor="middle">${s.label}</text>`;
    if (i < n - 1) {
      const yc = base - s.to * k;
      conn += `<line x1="${x + bw}" y1="${yc.toFixed(1)}" x2="${Math.round(chartX0 + (i + 1) * slot + (slot - bw) / 2)}" y2="${yc.toFixed(1)}" stroke="${t.base}" stroke-width="1" stroke-dasharray="3 3"/>`;
    }
    if (animate) {
      const delay = i * 0.07; // fraction of the loop
      const d0 = 80 + delay * 10, d1 = d0 + 3, d2 = Math.min(99.5, d1 + 9);
      css += `.${cls}{transform-box:fill-box;transform-origin:50% 100%;animation:k${i} 10s ease-in-out infinite}@keyframes k${i}{0%,${d0.toFixed(1)}%{transform:scaleY(1);opacity:1}${d1.toFixed(1)}%{transform:scaleY(0);opacity:.2}${d2.toFixed(1)}%,100%{transform:scaleY(1);opacity:1}}`;
    }
  });
  if (animate) {
    css += `.cur{animation:blink 1.2s steps(1) infinite}@keyframes blink{50%{opacity:0}}@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;
  }
  const lx = 64, big = H > 500 ? 62 : 46;
  const ly = winY + (H > 500 ? 150 : 140);
  const kpiY = base - 6;
  const kpi = (x, label, val) => `<text x="${x}" y="${kpiY - 40}" font-size="11" letter-spacing="1" fill="${t.mute}">${label}</text><text x="${x}" y="${kpiY}" font-size="${S > 1 ? 40 : 34}" font-weight="700" fill="${t.acc}">${val}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d"><title id="t">Rivet: make the deal legible</title><desc id="d">Illustrative terminal-style banner. A returns waterfall computed by the app's model at its documented base case (USD mm): entry equity ${f1(r.entryEquity)}, plus ${f1(a.ebitdaGrowth)} from EBITDA growth, plus ${f1(a.multiple)} from multiple change, plus ${f1(a.debtPaydown)} from debt paydown, equals exit equity ${f1(r.exitEquity)}. Gross MOIC ${r.moic.toFixed(1)}x, gross IRR ${(r.irr * 100).toFixed(1)}%. Illustrative, not investment advice.</desc><style>${css}</style>
<rect width="${W}" height="${H}" fill="${t.bg}"/>
<rect x="${winX}" y="${winY}" width="${winW}" height="${winH}" rx="12" fill="${t.panel}" stroke="${t.line}"/>
<path d="M${winX} ${winY + 40}H${winX + winW}" stroke="${t.line}"/>
<circle cx="${winX + 22}" cy="${winY + 20}" r="5.5" fill="${t.neg}"/><circle cx="${winX + 42}" cy="${winY + 20}" r="5.5" fill="${t.acc2}"/><circle cx="${winX + 62}" cy="${winY + 20}" r="5.5" fill="${t.acc}"/>
<text x="${W / 2}" y="${winY + 25}" font-size="12" fill="${t.mute}" text-anchor="middle">rivet ~ lbo --case base</text>
<text x="${lx}" y="${winY + 82}" font-size="14" fill="${t.acc}">$ rivet underwrite</text><rect class="cur" x="${lx + 168}" y="${winY + 69}" width="9" height="16" fill="${t.acc}"/>
<text class="serif" x="${lx}" y="${ly }" font-size="${big}" font-weight="700" fill="${t.text}" style="font-family:${SERIF}">Make the deal</text>
<text class="serif" x="${lx}" y="${ly + big * 1.1 }" font-size="${big}" font-weight="700" fill="${t.acc}" style="font-family:${SERIF}">legible.</text>
<text x="${lx}" y="${base - 86}" font-size="13" fill="${t.mute}">A browser-only first-pass LBO, DCF and returns</text>
<text x="${lx}" y="${base - 66}" font-size="13" fill="${t.mute}">calculator. Formulas documented, tests included.</text>
${kpi(lx, 'GROSS MOIC', r.moic.toFixed(1) + 'x')}${kpi(lx + 190, 'GROSS IRR', (r.irr * 100).toFixed(1) + '%')}
<text x="${chartX0}" y="${winY + 82}" font-size="11" letter-spacing="1" fill="${t.mute}">SPONSOR EQUITY BRIDGE · USD MM</text>
<line x1="${chartX0}" y1="${base}" x2="${chartX1}" y2="${base}" stroke="${t.line}"/>
${conn}${bars}${labels}
<text x="${W / 2}" y="${H - 6}" font-size="10.5" fill="${t.mute}" text-anchor="middle">Illustrative base case, computed by model.js: EV 425, EBITDA 52, 4.5x debt at 8.25%, 5-year hold, 8.2x exit. Gross; not investment advice.</text>
</svg>
`;
}

const out = path.join(__dirname, '..', 'docs', 'img');
fs.writeFileSync(path.join(out, 'hero-dark.svg'), build({ theme: 'dark', W: 1280, H: 460, animate: true }));
fs.writeFileSync(path.join(out, 'hero-light.svg'), build({ theme: 'light', W: 1280, H: 460, animate: true }));
fs.writeFileSync(path.join(out, 'social-preview.svg'), build({ theme: 'dark', W: 1280, H: 640, animate: false }));
console.log('moic', r.moic, 'irr', r.irr, 'exit', r.exitEquity);
