'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const UI = require('../ui-helpers.js');
const M = require('../model.js');

test('money / mult / pct / signedPct: one decimal, dash for non-finite, no "-0.0"', () => {
  assert.equal(UI.money(191), '$191.0');
  assert.equal(UI.money(-5.25), '-$5.3');
  assert.equal(UI.money(-0.04), '$0.0'); // rounds to zero: no stray minus sign
  assert.equal(UI.money(0), '$0.0');
  assert.equal(UI.mult(4.04), '4.0x');
  assert.equal(UI.mult(-0.01), '0.0x');
  assert.equal(UI.pct(32.24), '32.2%');
  assert.equal(UI.pct(-0.04), '0.0%');
  assert.equal(UI.signedPct(5), '+5.0%');
  assert.equal(UI.signedPct(-5), '-5.0%');
  assert.equal(UI.signedPct(0.01), '0.0%'); // no "+0.0%"
  for (const bad of [NaN, Infinity, -Infinity, undefined, null, '12']) {
    assert.equal(UI.money(bad), '—'); assert.equal(UI.mult(bad), '—'); assert.equal(UI.pct(bad), '—'); assert.equal(UI.signedPct(bad), '—');
  }
});

test('heatBucket: round(irr/5) clamped to 1..7', () => {
  // 7.4/5 = 1.48 -> 1 ; 7.5/5 = 1.5 -> 2 ; 22.4/5 = 4.48 -> 4 ; 32.5/5 = 6.5 -> 7
  assert.equal(UI.heatBucket(-40), 1); assert.equal(UI.heatBucket(7.4), 1); assert.equal(UI.heatBucket(7.5), 2);
  assert.equal(UI.heatBucket(22.4), 4); assert.equal(UI.heatBucket(32.5), 7); assert.equal(UI.heatBucket(90), 7);
  assert.equal(UI.heatBucket(NaN), 1);
});

test('envelope: fixed offsets -6.6 / +9.3 points, lower bound floored at -100%', () => {
  const e = UI.envelope(22.4);
  assert.ok(Math.abs(e.lower - 15.8) < 1e-12); assert.equal(e.base, 22.4); assert.ok(Math.abs(e.higher - 31.7) < 1e-12);
  assert.equal(UI.envelope(-98).lower, -100); // -98 - 6.6 = -104.6 -> floored
  assert.ok(Number.isNaN(UI.envelope(NaN).base));
});

test('sensitivityCsv: header carries units, rows follow multiples, cells follow growths', () => {
  const csv = UI.sensitivityCsv({ multiples: [7, 8], growths: [-5, 0, 5], values: [[1, 2, 3], [4.25, 5, 6]] });
  assert.equal(csv, 'Exit EV/EBITDA \\ annual EBITDA growth,-5%,0%,5%\n7.0x,1.0%,2.0%,3.0%\n8.0x,4.3%,5.0%,6.0%');
});

test('chartXLabels: exactly hold + 1 labels, last one marks the exit year', () => {
  assert.deepEqual(UI.chartXLabels(5), ['Entry', 'FY26E', 'FY27E', 'FY28E', 'FY29E', 'FY30E · exit']);
  assert.deepEqual(UI.chartXLabels(1), ['Entry', 'FY26E · exit']);
  assert.deepEqual(UI.chartXLabels(0), ['Entry']);
  assert.deepEqual(UI.chartXLabels(2.5), ['Entry']);
});

test('chartSeries: hold + 1 points and matches the model output', () => {
  // Hand: EV 100, EBITDA 10 flat, debt 40 at 10% (beginning basis), 50% conversion, hold 3, exit 10x.
  // Closing debt 39.0 / 37.9 / 36.69 (see model.test.js); EV at exit multiple = 10 x 10 = 100 each year.
  const r = M.lbo({ ev: 100, ebitda: 10, debtMultiple: 4, interest: 0.1, hold: 3, exitMultiple: 10, growth: [0, 0, 0, 0, 0], margin: [0.2, 0.2, 0.2, 0.2, 0.2], fcfConversion: 0.5, amortPct: 0, interestBasis: 'beginning' });
  const model = { ev: 100, ebitda: 10, entryDebt: r.entryDebt, exitMultiple: 10, debtSchedule: r.schedule, forecastEbitda: r.forecast.slice(0, 3).map((f) => f.ebitda) };
  const debt = UI.chartSeries(model, 'debt');
  assert.equal(debt.length, 4);
  [40, 39, 37.9, 36.69].forEach((v, i) => assert.ok(Math.abs(debt[i] - v) < 1e-9, `debt[${i}]`));
  UI.chartSeries(model, 'total').forEach((v) => assert.ok(Math.abs(v - 100) < 1e-9));
  UI.chartSeries(model, 'profit').forEach((v) => assert.ok(Math.abs(v - 10) < 1e-9));
  assert.equal(UI.chartSeries(model, 'total').length, UI.chartXLabels(3).length);
  assert.equal(UI.chartDescription('debt', ['Entry', 'FY26E'], [40, 39]), 'Debt outstanding (year end), USD mm: Entry $40.0; FY26E $39.0.');
});

test('lboCsv: sources balance and figures come from the model', () => {
  const csv = UI.lboCsv({ ev: 425, entryDebt: 234, entryEquity: 191, exitDebt: 44.66, exitNetDebt: 44.66, debtPaydown: 189.34 });
  assert.equal(csv, 'Line,USD mm\nPurchase enterprise value,425.0\nDebt,234.0\nSponsor equity,191.0\nTotal sources,425.0\nExit debt,44.7\nExit net debt,44.7\nNet-debt reduction,189.3');
});

test('summaryText: base case figures, disclaimer, warnings and no probability wording', () => {
  const { input } = M.validateDeal({ ev: '425', ebitda: '52', debtMultiple: '4.5', interest: '8.25', hold: '5', exitMultiple: '8.2', growth: ['12', '11', '10', '9', '8'], margin: ['21', '22', '23', '24', '25'] });
  const r = M.lbo(input);
  const m = { input, ev: 425, ebitda: 52, entryDebt: r.entryDebt, entryEquity: r.entryEquity, entryMultiple: r.entryMultiple, exitEbitda: r.exitEbitda, exitMultiple: r.exitMultiple, exitEv: r.exitEv, exitDebt: r.exitDebt, exitNetDebt: r.exitNetDebt, exitEquity: r.exitEquity, moic: r.moic, irr: r.irr * 100, hold: 5, interest: 8.25, debtPaydown: r.debtPaydown, forecastAll: r.forecast };
  const text = UI.summaryText(m, 'Base case', []);
  // 425 - 52 x 4.5 = 425 - 234 = 191.0 sponsor equity
  assert.match(text, /Entry sponsor equity: \$191\.0/);
  assert.match(text, /Entry debt: \$234\.0 \(4\.5x EBITDA\)/);
  assert.match(text, new RegExp(`Gross IRR: ${UI.pct(r.irr * 100).replace('.', '\\.')}`));
  assert.match(text, /Revenue growth \(years 1–5\): 12\.0% \/ 11\.0% \/ 10\.0% \/ 9\.0% \/ 8\.0%/);
  assert.match(text, /Not a deal-grade underwriting model/);
  assert.match(text, /not a probability range/);
  assert.doesNotMatch(text, /P10|P90|percentile|confidence|likely|probability of/i);
  assert.doesNotMatch(text, /WARNINGS/);
  assert.match(UI.summaryText(m, 'Base case', ['Equity is wiped out.']), /WARNINGS\n- Equity is wiped out\./);
  assert.match(UI.summaryText({ ...m, hold: 1 }, 'X'), /Hold: 1 year \(exit at the end of year 1\)/);
});

test('envelopeScale: points placed linearly on a padded axis', () => {
  // env 15.8 / 22.4 / 31.7 -> axis min floor(15.8/5)*5 - 5 = 10, max ceil(31.7/5)*5 + 5 = 40 (span 30)
  // lower (15.8-10)/30 = 19.333%, base 12.4/30 = 41.333%, higher 21.7/30 = 72.333%
  const s = UI.envelopeScale(UI.envelope(22.4));
  assert.equal(s.min, 10); assert.equal(s.max, 40);
  assert.ok(Math.abs(s.lower - 19.3333333) < 1e-6); assert.ok(Math.abs(s.base - 41.3333333) < 1e-6); assert.ok(Math.abs(s.higher - 72.3333333) < 1e-6);
  assert.equal(UI.envelopeScale(UI.envelope(NaN)), null);
});
