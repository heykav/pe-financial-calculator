#!/usr/bin/env node
'use strict';
/*
 * Build data/companies.json (+ data/companies.js) from SEC EDGAR.
 *
 *   node scripts/build-company-snapshot.js --contact "Your Name you@example.com"
 *
 * Why a script and not a browser fetch: data.sec.gov sends no CORS headers and the SEC
 * requires a descriptive User-Agent, so the app cannot call it. This script runs on a
 * developer machine, writes a committed snapshot, and the app reads the snapshot.
 *
 * For every company it (1) maps XBRL company facts with scripts/lib/map-company.js and
 * (2) re-reads the 10-K itself and checks that every reported figure appears in the filing
 * text. A company that fails either step is left out and the reason is printed.
 *
 * Options: --contact "<name email>" (required, sent as User-Agent)
 *          --cache <dir>  reuse/store raw SEC responses (development only)
 *          --only AAPL,CSCO
 */
const fs = require('node:fs');
const path = require('node:path');
const { mapCompany, Unmappable } = require('./lib/map-company');

const COMPANIES = [
  ['AAPL', 'Apple Inc.', 320193],
  ['CSCO', 'Cisco Systems, Inc.', 858877],
  ['COST', 'Costco Wholesale Corporation', 909832],
  ['DIS', 'The Walt Disney Company', 1744489],
  ['GIS', 'General Mills, Inc.', 40704],
  ['KR', 'The Kroger Co.', 56873],
  ['LMT', 'Lockheed Martin Corporation', 936468],
  ['NVDA', 'NVIDIA Corporation', 1045810]
];
const MAX_FILING_AGE_DAYS = 500;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const contact = arg('contact');
if (!contact || !/@/.test(contact)) {
  console.error('Pass --contact "Your Name you@example.com". The SEC requires a descriptive User-Agent.');
  process.exit(2);
}
const cacheDir = arg('cache');
const only = arg('only') ? arg('only').split(',') : null;
const UA = `Rivet company snapshot (${contact})`;
const pad10 = (n) => String(n).padStart(10, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, key, asText) {
  const file = cacheDir && path.join(cacheDir, key);
  if (file && fs.existsSync(file)) { const t = fs.readFileSync(file, 'utf8'); return asText ? t : JSON.parse(t); }
  await sleep(250); // stay far below the SEC's 10 requests per second limit
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const text = await res.text();
  if (file) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, text); }
  return asText ? text : JSON.parse(text);
}

const comma = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 3 });
/** Renderings of a USD amount as a filing could print it: in millions, thousands, or whole dollars. */
function renderings(usd) {
  const out = new Set();
  [1e6, 1e3, 1].forEach((unit) => {
    const v = usd / unit;
    if (Math.abs(v) < 1) return;
    out.add(comma(Math.abs(v)));
    if (Math.abs(v) >= 1e6 && unit === 1e6) return;
    out.add(Math.abs(v).toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  });
  return [...out];
}

/** True if the figure appears as a whole number token, not inside a longer number. */
function hasNumber(text, token) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^0-9,.])${esc}(?![0-9]|,[0-9]|\\.[0-9])`).test(text);
}

function figures(c) {
  const list = [['revenue', c.revenue.usd], ['operating income', c.operatingIncome.usd], ['D&A', c.depreciationAmortization.usd]];
  if (c.priorRevenue) list.push(['prior-year revenue', c.priorRevenue.usd]);
  c.debt.items.forEach((i) => list.push([`debt ${i.tag}`, i.usd]));
  c.cash.items.forEach((i) => list.push([`cash ${i.tag}`, i.usd]));
  list.push(['shares on cover', c.shares.count]);
  return list.filter(([, usd]) => Math.abs(usd) >= 1000);
}

async function verifyAgainstFiling(c, cik) {
  const subs = await get(`https://data.sec.gov/submissions/CIK${pad10(cik)}.json`, `sub-${cik}.json`);
  const r = subs.filings.recent;
  const i = r.accessionNumber.indexOf(c.filing.accession);
  if (i < 0) throw new Unmappable('filing not in recent submissions list; cannot fetch the document to verify');
  const doc = r.primaryDocument[i];
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${c.filing.accession.replace(/-/g, '')}/${doc}`;
  const html = await get(url, `doc-${c.filing.accession}.html`, true);
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;|&#xa0;/gi, ' ').replace(/\s+/g, ' ');
  const missing = [];
  let checked = 0;
  for (const [label, usd] of figures(c)) {
    checked += 1;
    if (!renderings(usd).some((s) => hasNumber(text, s))) missing.push(label);
  }
  return { documentUrl: url, figuresChecked: checked, missing };
}

async function main() {
  const retrievedOn = new Date().toISOString().slice(0, 10);
  const included = [];
  const excluded = [];
  for (const [ticker, name, cik] of COMPANIES) {
    if (only && !only.includes(ticker)) continue;
    try {
      const facts = await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${pad10(cik)}.json`, `facts-${cik}.json`);
      const c = mapCompany(facts, { ticker, name, cik, retrievedOn });
      const ageDays = (Date.parse(retrievedOn) - Date.parse(c.filing.filed)) / 86400000;
      if (ageDays > MAX_FILING_AGE_DAYS) throw new Unmappable(`latest 10-K in the data was filed ${c.filing.filed}, too old to call current`);
      const v = await verifyAgainstFiling(c, cik);
      if (v.missing.length) throw new Unmappable(`not found in the filing text: ${v.missing.join(', ')}`);
      c.verification = { method: 'every figure re-found in the 10-K document text', documentUrl: v.documentUrl, figuresChecked: v.figuresChecked };
      included.push(c);
      console.log(`ok       ${ticker}  FY end ${c.filing.fiscalYearEnd}  ${v.figuresChecked} figures re-found in ${c.filing.accession}`);
    } catch (e) {
      if (!(e instanceof Unmappable)) throw e;
      excluded.push({ ticker, name, reason: e.message });
      console.log(`excluded ${ticker}  ${e.message}`);
    }
  }
  const snapshot = {
    label: `Real SEC filings, snapshot dated ${retrievedOn}. Not live data.`,
    source: 'SEC EDGAR XBRL company facts (data.sec.gov/api/xbrl/companyfacts), annual 10-K figures',
    retrievedOn,
    units: 'USD millions unless a field says usd (whole dollars) or count',
    notes: [
      'Revenue, operating income and D&A are for the fiscal year of the 10-K named. EBITDA is operating income plus D&A as reported, with no adjustments.',
      'Debt is balance-sheet debt at fiscal year end (noncurrent plus current portion, commercial paper, short-term borrowings). Lease liabilities are excluded. Cash includes current marketable securities or short-term investments only.',
      'No market data: share price and enterprise value are not in filings and are not included.'
    ],
    companies: included,
    excluded
  };
  const outDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const json = JSON.stringify(snapshot, null, 2) + '\n';
  fs.writeFileSync(path.join(outDir, 'companies.json'), json);
  // The page's CSP is connect-src 'none', so it cannot fetch JSON; it loads this as a script instead.
  fs.writeFileSync(path.join(outDir, 'companies.js'), `/* Generated by scripts/build-company-snapshot.js from data/companies.json. Do not edit. */\nwindow.RivetCompanies = ${JSON.stringify(snapshot)};\n`);
  console.log(`wrote ${included.length} companies, ${excluded.length} excluded`);
}

main().catch((e) => { console.error(e); process.exit(1); });
