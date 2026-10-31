'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mapCompany, Unmappable } = require('../scripts/lib/map-company.js');
const M = require('../model.js');

// Excerpt of the real SEC response for Apple's FY2025 10-K (accession 0000320193-25-000079).
const apple = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'aapl-companyfacts-excerpt.json'), 'utf8'));
const meta = { ticker: 'AAPL', name: 'Apple Inc.', cik: 320193, retrievedOn: '2026-10-30' };
const clone = (o) => JSON.parse(JSON.stringify(o));

test('Apple FY2025 maps to the figures printed in the 10-K (USD mm)', () => {
  const c = mapCompany(apple, meta);
  assert.equal(c.filing.accession, '0000320193-25-000079');
  assert.equal(c.filing.fiscalYearEnd, '2025-09-27');
  assert.equal(c.revenue.usdMm, 416161);
  assert.equal(c.priorRevenue.usdMm, 391035);
  assert.equal(c.operatingIncome.usdMm, 133050);
  assert.equal(c.depreciationAmortization.usdMm, 11698);
  assert.equal(c.ebitda.usdMm, 133050 + 11698);
  // 78,328 noncurrent + 12,350 current portion + 7,979 commercial paper
  assert.equal(c.debt.totalUsdMm, 78328 + 12350 + 7979);
  assert.equal(c.cash.totalUsdMm, 35934 + 18763);
  assert.equal(c.netDebtUsdMm, 98657 - 54697);
  assert.equal(c.shares.count, 14776353000);
});

test('LongTermDebt identity: total equals noncurrent + current portion (90,678 = 78,328 + 12,350)', () => {
  const c = mapCompany(apple, meta);
  assert.equal(c.debt.items.find((i) => i.tag === 'LongTermDebtNoncurrent').usdMm + c.debt.items.find((i) => i.tag === 'LongTermDebtCurrent').usdMm, 90678);
});

test('a broken debt identity leaves the company out instead of guessing', () => {
  const bad = clone(apple);
  bad.facts['us-gaap'].LongTermDebt.units.USD.find((f) => f.end === '2025-09-27').val += 1e6;
  assert.throws(() => mapCompany(bad, meta), Unmappable);
});

test('ambiguous D&A (two tags, different values) is refused', () => {
  const bad = clone(apple);
  const base = bad.facts['us-gaap'].DepreciationDepletionAndAmortization.units.USD.find((f) => f.end === '2025-09-27');
  bad.facts['us-gaap'].DepreciationAndAmortization = { units: { USD: [{ ...base, val: base.val - 5e8 }] } };
  assert.throws(() => mapCompany(bad, meta), /ambiguous/);
});

test('missing pieces are refused: no operating income, no cash, no noncurrent debt', () => {
  for (const tag of ['OperatingIncomeLoss', 'CashAndCashEquivalentsAtCarryingValue', 'LongTermDebtNoncurrent']) {
    const bad = clone(apple);
    delete bad.facts['us-gaap'][tag];
    assert.throws(() => mapCompany(bad, meta), Unmappable, tag);
  }
});

test('facts from another filing are never mixed in', () => {
  const bad = clone(apple);
  bad.facts['us-gaap'].OperatingIncomeLoss.units.USD.forEach((f) => { f.accn = '0000000000-00-000000'; });
  assert.throws(() => mapCompany(bad, meta), Unmappable);
});

test('two share classes on the cover page are refused', () => {
  const bad = clone(apple);
  const s = bad.facts.dei.EntityCommonStockSharesOutstanding.units.shares;
  const last = s.reduce((a, b) => (b.filed > a.filed ? b : a));
  s.push({ ...last, val: 1 });
  assert.throws(() => mapCompany(bad, meta), /share classes/);
});

test('companyInputs: EBITDA, growth and margin come from the filing, price is a placeholder', () => {
  const f = M.companyInputs(mapCompany(apple, meta));
  assert.equal(f.ebitda, 144748);
  assert.equal(f.growthPct, 6.4);       // 416161 / 391035 - 1 = 6.425%
  assert.equal(f.marginPct, 34.8);      // 144748 / 416161 = 34.78%
  assert.equal(f.ev, Math.round(144748 * 8.2 * 10) / 10);
});

test('companyInputs refuses non-positive EBITDA', () => {
  const c = mapCompany(apple, meta);
  c.ebitda.usdMm = -1;
  assert.throws(() => M.companyInputs(c), M.ModelError);
});

test('impliedEv: price x shares + net debt', () => {
  const r = M.impliedEv({ price: 100, shares: 2e9, netDebtMm: 500 });
  assert.equal(r.marketCap, 200000);
  assert.equal(r.ev, 200500);
  assert.throws(() => M.impliedEv({ price: 0, shares: 1, netDebtMm: 0 }), M.ModelError);
});

test('the Apple inputs run through the LBO core without error', () => {
  const f = M.companyInputs(mapCompany(apple, meta));
  const r = M.lbo({ ev: f.ev, ebitda: f.ebitda, debtMultiple: 4.5, interest: 0.0825, hold: 5, exitMultiple: 8.2, growth: Array(5).fill(f.growthPct / 100), margin: Array(5).fill(f.marginPct / 100) });
  assert.ok(Number.isFinite(r.irr) && r.moic > 0);
});

// ---- the committed snapshot ----
const snap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'companies.json'), 'utf8'));

test('committed snapshot: label, date and per-company provenance present', () => {
  assert.match(snap.label, /not live/i);
  assert.match(snap.retrievedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(snap.companies.length >= 3);
  for (const c of snap.companies) {
    assert.match(c.filing.accession, /^\d{10}-\d{2}-\d{6}$/, c.ticker);
    assert.equal(c.filing.form, '10-K');
    assert.match(c.verification.documentUrl, /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//);
    assert.ok(c.verification.figuresChecked >= 8, c.ticker);
  }
});

test('committed snapshot: arithmetic identities hold for every company', () => {
  for (const c of snap.companies) {
    const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${c.ticker} ${a} vs ${b}`);
    close(c.ebitda.usdMm, c.operatingIncome.usdMm + c.depreciationAmortization.usdMm);
    close(c.debt.totalUsdMm, c.debt.items.reduce((s, i) => s + i.usdMm, 0));
    close(c.cash.totalUsdMm, c.cash.items.reduce((s, i) => s + i.usdMm, 0));
    close(c.netDebtUsdMm, c.debt.totalUsdMm - c.cash.totalUsdMm);
    for (const i of [...c.debt.items, ...c.cash.items]) close(i.usdMm * 1e6, i.usd);
    assert.ok(c.ebitda.usdMm > 0 && c.revenue.usdMm > c.ebitda.usdMm, c.ticker);
  }
});

test('committed snapshot: companies.js is the same data as companies.json', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'data', 'companies.js'), 'utf8');
  const sandbox = { window: {} };
  new Function('window', js)(sandbox.window);
  assert.deepEqual(sandbox.window.RivetCompanies, snap);
});
