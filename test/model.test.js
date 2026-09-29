'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../model.js');

const close = (a, b, tol = 1e-9, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b}, got ${a}`);

test('NPV: -100 + 60/1.1 + 60/1.21 = 4.132231', () => {
  // 60/1.1 = 54.545454..., 60/1.21 = 49.586776... => 4.132231...
  close(M.npv(0.1, [-100, 60, 60]), 4.132231405, 1e-8);
  close(M.npv(0, [-100, 60, 60]), 20);
});

test('IRR: closed-form and textbook cases', () => {
  close(M.irr([-100, 110]), 0.10, 1e-10);
  close(M.irr([-1000, 0, 0, 1331]), 0.10, 1e-10);
  // 2.0x over 5 years: 2^(1/5)-1 = 14.8698355%
  close(M.irr([-100, 0, 0, 0, 0, 200]), Math.pow(2, 0.2) - 1, 1e-10);
  // annuity: 500 x 3 on 1000 => r where 500*(1-(1+r)^-3)/r = 1000 => 23.3751928%
  close(M.irr([-1000, 500, 500, 500]), 0.2337519, 1e-6);
  // interim negative flow: 300x^2 - 50x - 100 = 0 with x = 1/(1+r) => x = 2/3 => r = 50%
  close(M.irr([-100, -50, 300]), 0.5, 1e-10);
  // negative IRR
  close(M.irr([-100, 50]), -0.5, 1e-10);
  // two roots (10% and 20%): lowest returned
  close(M.irr([-100, 230, -132]), 0.10, 1e-9);
});

test('IRR: undefined cases throw a clear ModelError instead of returning junk', () => {
  for (const flows of [[-100, -50], [100, 50], [0, 0], [-100], [], [-100, NaN, 5], [-100, Infinity]]) {
    assert.throws(() => M.irr(flows), M.ModelError, JSON.stringify(flows));
  }
  try { M.irr([-1, -2]); } catch (e) { assert.equal(e.code, 'no_sign_change'); }
});

test('MOIC', () => {
  close(M.moic(191.25, 516.6), 516.6 / 191.25);
  assert.throws(() => M.moic(0, 10), M.ModelError);
  assert.throws(() => M.moic(10, -1), M.ModelError);
  assert.equal(M.moic(10, 0), 0);
});

test('CAPM and WACC hand values', () => {
  close(M.capm(0.04, 1.2, 0.05), 0.10);
  // E=600 D=400 Ke=10% Kd=5% t=20% => .6*.10 + .4*.05*.8 = .06+.016 = .076
  close(M.wacc({ equityValue: 600, debtValue: 400, costOfEquity: 0.10, costOfDebt: 0.05, taxRate: 0.2 }), 0.076);
  close(M.wacc({ equityValue: 100, debtValue: 0, costOfEquity: 0.12, costOfDebt: 0.05 }), 0.12);
  assert.throws(() => M.wacc({ equityValue: 0, debtValue: 0, costOfEquity: 0.1, costOfDebt: 0.05 }), M.ModelError);
  assert.throws(() => M.wacc({ equityValue: 1, debtValue: 1, costOfEquity: 0.1, costOfDebt: 0.05, taxRate: 1 }), M.ModelError);
});

test('Gordon growth terminal value and its guard', () => {
  close(M.gordonTerminalValue(100, 0.10, 0.02), 1275); // 100*1.02/0.08
  close(M.gordonTerminalValue(100, 0.10, -0.01), 100 * 0.99 / 0.11);
  for (const g of [0.10, 0.11, 0.5]) {
    assert.throws(() => M.gordonTerminalValue(100, 0.10, g), (e) => e instanceof M.ModelError && e.code === 'growth_ge_rate' && /below the discount rate/.test(e.message));
  }
});

test('DCF: perpetuity of 100 at 10% is worth 1000 (Gordon) and exit-multiple variant', () => {
  const g = M.dcf({ fcfs: [100, 100], rate: 0.10, terminal: { method: 'gordon', growth: 0 } });
  // PV FCF = 90.909091 + 82.644628 = 173.553719 ; TV = 1000 ; PV TV = 1000/1.21 = 826.446281
  close(g.pvFcf, 173.553719, 1e-6); close(g.pvTerminalValue, 826.446281, 1e-6); close(g.enterpriseValue, 1000, 1e-9);
  const m = M.dcf({ fcfs: [100, 100], rate: 0.10, terminal: { method: 'multiple', metric: 100, multiple: 8 } });
  close(m.enterpriseValue, 173.553719 + 800 / 1.21, 1e-6);
  assert.throws(() => M.dcf({ fcfs: [100], rate: 0.05, terminal: { method: 'gordon', growth: 0.05 } }), M.ModelError);
  assert.throws(() => M.dcf({ fcfs: [100], rate: 0.05 }), M.ModelError);
  assert.throws(() => M.dcf({ fcfs: [], rate: 0.05, terminal: { method: 'gordon', growth: 0 } }), M.ModelError);
});

test('Sources & uses balance', () => {
  const su = M.sourcesAndUses({ purchaseEv: 425, fees: 10, debt: 234 });
  assert.equal(su.uses.total, 435); assert.equal(su.sponsorEquity, 201); assert.equal(su.sources.total, su.uses.total);
  const roll = M.sourcesAndUses({ purchaseEv: 100, debt: 50, rolloverEquity: 10 });
  assert.equal(roll.sponsorEquity, 40);
  assert.throws(() => M.sourcesAndUses({ purchaseEv: 100, debt: 100 }), M.ModelError);
});

test('Debt schedule: average-balance circularity has closed form C = 78.947368', () => {
  // open 100, r 10%, pre-interest cash 30, 100% sweep, average basis:
  // C = 100 - (30 - 0.1*(100+C)/2) => C(1-0.05) = 75 => C = 78.9473684
  const [y] = M.debtSchedule({ openingDebt: 100, rate: 0.1, preInterestCash: [30] });
  close(y.closingDebt, 75 / 0.95, 1e-9); close(y.interest, 0.05 * (100 + 75 / 0.95), 1e-9);
  const [b] = M.debtSchedule({ openingDebt: 100, rate: 0.1, preInterestCash: [30], interestBasis: 'beginning' });
  close(b.interest, 10); close(b.closingDebt, 80);
});

test('Debt schedule: mandatory amortisation, partial sweep, full repayment, shortfall', () => {
  let [y] = M.debtSchedule({ openingDebt: 100, rate: 0, preInterestCash: [30], amortPct: 0.05 });
  close(y.mandatory, 5); close(y.sweep, 25); close(y.closingDebt, 70);
  [y] = M.debtSchedule({ openingDebt: 100, rate: 0, preInterestCash: [30], amortPct: 0.05, sweepPct: 0.5 });
  close(y.sweep, 12.5); close(y.closingDebt, 82.5); close(y.cash, 12.5);
  [y] = M.debtSchedule({ openingDebt: 10, rate: 0, preInterestCash: [30] });
  close(y.closingDebt, 0); close(y.cash, 20);
  // shortfall: interest 10 on 100 (beginning) vs 5 of cash => avail -5 => debt grows to 105
  [y] = M.debtSchedule({ openingDebt: 100, rate: 0.1, preInterestCash: [5], interestBasis: 'beginning' });
  close(y.closingDebt, 105); close(y.revolverDraw, 5);
  // 3-year multi-period check (beginning basis): 100 -> 100-(30-10)=80 -> 80-(30-8)=58 -> 58-(30-5.8)=33.8
  const rows = M.debtSchedule({ openingDebt: 100, rate: 0.1, preInterestCash: [30, 30, 30], interestBasis: 'beginning' });
  close(rows[0].closingDebt, 80); close(rows[1].closingDebt, 58); close(rows[2].closingDebt, 33.8);
  // zero debt
  [y] = M.debtSchedule({ openingDebt: 0, rate: 0.1, preInterestCash: [30] });
  close(y.interest, 0); close(y.cash, 30);
  assert.throws(() => M.debtSchedule({ openingDebt: 100, rate: 0.1, preInterestCash: [1], interestBasis: 'x' }), M.ModelError);
});

// Hand-worked LBO: EV 100, EBITDA 10 (margin 20% flat, 0% growth), 4.0x debt = 40, equity 60,
// interest 10% on beginning balance, cash conversion 50% => 5/yr, no amort, 100% sweep, hold 3, exit 10x.
// Y1 int 4.0 avail 1.0 -> 39.0 ; Y2 int 3.9 avail 1.1 -> 37.9 ; Y3 int 3.79 avail 1.21 -> 36.69
// Exit EV 100, equity 63.31, MOIC 1.0551667, IRR = 1.0551667^(1/3)-1 = 1.8061%
const base = { ev: 100, ebitda: 10, debtMultiple: 4, interest: 0.1, hold: 3, exitMultiple: 10, growth: [0, 0, 0, 0, 0], margin: [0.2, 0.2, 0.2, 0.2, 0.2], fcfConversion: 0.5, amortPct: 0, interestBasis: 'beginning' };

test('LBO end to end vs hand computation', () => {
  const r = M.lbo(base);
  close(r.entryDebt, 40); close(r.entryEquity, 60);
  close(r.schedule[0].closingDebt, 39); close(r.schedule[1].closingDebt, 37.9); close(r.schedule[2].closingDebt, 36.69, 1e-9);
  close(r.exitEv, 100); close(r.exitEquity, 63.31, 1e-9);
  close(r.moic, 63.31 / 60, 1e-12); close(r.irr, Math.pow(63.31 / 60, 1 / 3) - 1, 1e-9);
  close(r.irr, 0.018061, 1e-6);
  close(r.attribution.total, r.exitEquity - r.entryEquity, 1e-9);
  close(r.attribution.debtPaydown, 3.31, 1e-9);
});

test('Exit before maturity: later forecast years cannot change the result, debt is repaid at exit', () => {
  const a = M.lbo(base);
  const b = M.lbo({ ...base, growth: [0, 0, 0, 0.5, 0.5], margin: [0.2, 0.2, 0.2, 0.4, 0.4] });
  close(a.irr, b.irr, 1e-12); close(a.exitEquity, b.exitEquity, 1e-12);
  assert.ok(a.exitDebt > 0, 'debt still outstanding at exit is netted from proceeds');
});

test('Zero debt: equity = EV, cash accumulates, no interest', () => {
  const r = M.lbo({ ...base, debtMultiple: 0 });
  close(r.entryEquity, 100); close(r.exitDebt, 0); close(r.exitCash, 15); close(r.exitEquity, 115);
  close(r.moic, 1.15); close(r.irr, Math.pow(1.15, 1 / 3) - 1, 1e-9);
});

test('Attribution identity with growth and multiple expansion (hand: 50 + 30 + 10 = 90)', () => {
  const a = M.returnsAttribution({ ebitdaEntry: 10, ebitdaExit: 15, entryMultiple: 10, exitMultiple: 12, netDebtEntry: 40, netDebtExit: 30 });
  close(a.ebitdaGrowth, 50); close(a.multiple, 30); close(a.debtPaydown, 10); close(a.total, 90);
  close(a.shares.ebitdaGrowth + a.shares.multiple + a.shares.debtPaydown, 1);
  // EBITDA decline yields a negative contribution rather than being clamped to zero
  const d = M.returnsAttribution({ ebitdaEntry: 10, ebitdaExit: 8, entryMultiple: 10, exitMultiple: 10, netDebtEntry: 40, netDebtExit: 30 });
  close(d.ebitdaGrowth, -20); close(d.total, -10); assert.equal(d.shares.ebitdaGrowth, null);
  const full = M.lbo({ ...base, exitMultiple: 12, growth: [0.2, 0.2, 0.2, 0, 0], margin: [0.2, 0.2, 0.2, 0.2, 0.2], fees: 2 });
  close(full.attribution.total, full.rawExitEquity - full.entryEquity, 1e-9);
});

test('Total loss: exit EV below net debt gives 0.0x and -100%, flagged', () => {
  const r = M.lbo({ ...base, exitMultiple: 2 });
  assert.equal(r.exitEquity, 0); assert.equal(r.moic, 0); assert.equal(r.irr, -1); assert.equal(r.wipedOut, true);
});

test('Regression: interest rate must move returns (was a no-op below 8.25%)', () => {
  const irrAt = (i) => M.lbo({ ...base, interest: i, hold: 5 }).irr;
  assert.ok(irrAt(0.04) > irrAt(0.06) && irrAt(0.06) > irrAt(0.0825) && irrAt(0.0825) > irrAt(0.12));
});

test('Average-basis interest is below beginning-basis when debt is being repaid', () => {
  const avg = M.lbo({ ...base, interestBasis: 'average' }), beg = M.lbo(base);
  assert.ok(avg.schedule[0].interest < beg.schedule[0].interest);
  assert.ok(avg.exitEquity > beg.exitEquity);
});

test('lbo rejects invalid inputs with ModelError', () => {
  for (const patch of [{ ev: 0 }, { ebitda: -1 }, { debtMultiple: 9.5 }, { hold: 6 }, { hold: 2.5 }, { hold: 0 }, { interest: -0.01 }, { exitMultiple: 0 }, { ev: NaN }, { margin: [0, 0.2, 0.2, 0.2, 0.2] }, { growth: [-1, 0, 0, 0, 0] }]) {
    assert.throws(() => M.lbo({ ...base, ...patch }), M.ModelError, JSON.stringify(patch));
  }
});

test('Sensitivity grid: cell equals a direct run of the same assumptions', () => {
  const grid = M.sensitivity(base, [8, 10, 12], [-0.05, 0, 0.1]);
  const direct = M.lbo({ ...base, exitMultiple: 10, growth: Array(5).fill(0), margin: Array(5).fill(0.2) });
  close(grid[1][1], direct.irr, 1e-12);
  assert.ok(grid[2][2] > grid[0][0]);
  grid.flat().forEach((v) => assert.ok(Number.isFinite(v)));
});

test('validateDeal: blank/NaN/Infinity/out-of-range are errors; defaults pass', () => {
  const ok = { ev: '425', ebitda: '52', debtMultiple: '4.5', interest: '8.25', hold: '5', exitMultiple: '8.2', growth: ['12', '11', '10', '9', '8'], margin: ['21', '22', '23', '24', '25'] };
  const good = M.validateDeal(ok); assert.deepEqual(good.errors, []); close(good.input.interest, 0.0825);
  for (const patch of [{ ev: '' }, { ev: 'abc' }, { ev: 'Infinity' }, { ebitda: '0' }, { hold: '2.5' }, { hold: '6' }, { interest: '101' }, { debtMultiple: '9' }, { growth: ['', '11', '10', '9', '8'] }, { margin: ['0', '22', '23', '24', '25'] }, { exitMultiple: '-1' }]) {
    assert.ok(M.validateDeal({ ...ok, ...patch }).errors.length > 0, JSON.stringify(patch));
  }
  assert.match(M.validateDcf({ wacc: 5, terminalGrowth: 5 }), /below WACC/);
  assert.equal(M.validateDcf({ wacc: 9.5, terminalGrowth: 2.5 }), '');
  assert.ok(M.validateDcf({ wacc: '', terminalGrowth: 2 }));
});

test('Fuzz: any input either throws ModelError or yields only finite numbers', () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let ok = 0;
  for (let i = 0; i < 3000; i += 1) {
    const input = { ev: 10 + rnd() * 2000, ebitda: 1 + rnd() * 200, debtMultiple: rnd() * 9, interest: rnd() * 0.3, hold: 1 + Math.floor(rnd() * 5), exitMultiple: 1 + rnd() * 20,
      growth: Array.from({ length: 5 }, () => -0.5 + rnd() * 1), margin: Array.from({ length: 5 }, () => 0.01 + rnd() * 0.6), fcfConversion: rnd() };
    let r;
    try { r = M.lbo(input); } catch (e) { assert.ok(e instanceof M.ModelError, e.stack); continue; }
    ok += 1;
    [r.moic, r.irr, r.exitEquity, r.entryEquity, r.attribution.total, ...r.schedule.flatMap((s) => [s.closingDebt, s.interest, s.netLeverage])].forEach((x) => assert.ok(Number.isFinite(x), JSON.stringify(input)));
    close(r.attribution.total, r.rawExitEquity - r.entryEquity, 1e-6);
    assert.ok(r.irr >= -1);
  }
  assert.ok(ok > 500);
});
