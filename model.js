/*
 * Rivet calculation core.
 *
 * Pure functions only: no DOM, no globals, no I/O. Works as a browser <script>
 * (exposes window.RivetModel) and as a Node CommonJS module (require('./model.js')).
 * All rates are DECIMALS here (0.10 = 10%). All money is USD millions.
 * Hand-derived reference values for every function live in test/model.test.js
 * and the formulas are written out in docs/formulas.md.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RivetModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class ModelError extends Error {
    constructor(message, code) { super(message); this.name = 'ModelError'; this.code = code || 'invalid'; }
  }

  const finite = (v) => typeof v === 'number' && Number.isFinite(v);
  function need(value, name) {
    if (!finite(value)) throw new ModelError(`${name} must be a finite number.`, 'not_finite');
    return value;
  }

  // ---------- Time value of money ----------

  /** NPV with cashflows[0] at t=0 (undiscounted), cashflows[t] at end of year t. */
  function npv(rate, cashflows) {
    if (!Array.isArray(cashflows) || !cashflows.length) throw new ModelError('NPV needs at least one cash flow.', 'empty');
    need(rate, 'Discount rate');
    if (rate <= -1) throw new ModelError('Discount rate must be greater than -100%.', 'bad_rate');
    return cashflows.reduce((s, cf, t) => s + need(cf, 'Cash flow') / Math.pow(1 + rate, t), 0);
  }

  /**
   * IRR of periodic cash flows (cashflows[0] at t=0). Root of NPV(r)=0, r > -1.
   * Requires at least one negative and one positive flow, otherwise no IRR exists
   * and a ModelError('no_sign_change') is thrown (never a made-up number).
   * Scans from -99.9% upward for the first sign change, then bisects.
   * With several sign changes an IRR is not unique; the lowest root is returned.
   */
  function irr(cashflows) {
    if (!Array.isArray(cashflows) || cashflows.length < 2) throw new ModelError('IRR needs at least two cash flows.', 'too_few');
    cashflows.forEach((c) => need(c, 'Cash flow'));
    const hasNeg = cashflows.some((c) => c < 0), hasPos = cashflows.some((c) => c > 0);
    if (!hasNeg || !hasPos) throw new ModelError('IRR is undefined: cash flows need at least one outflow and one inflow.', 'no_sign_change');
    const f = (r) => npv(r, cashflows);
    // grid in log-space of (1+r): from 0.001 to 1000
    let lo = -0.999, flo = f(lo);
    if (flo === 0) return lo;
    for (let i = 1; i <= 4000; i += 1) {
      const hi = Math.exp(Math.log(0.001) + (Math.log(1000) - Math.log(0.001)) * i / 4000) - 1;
      const fhi = f(hi);
      if (fhi === 0) return hi;
      if (Math.sign(fhi) !== Math.sign(flo)) {
        let a = lo, b = hi, fa = flo;
        for (let k = 0; k < 200; k += 1) {
          const m = (a + b) / 2, fm = f(m);
          if (fm === 0) return m;
          if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m;
        }
        return (a + b) / 2;
      }
      lo = hi; flo = fhi;
    }
    throw new ModelError('IRR did not converge within -99.9% to +99,900%.', 'no_convergence');
  }

  /** Multiple on invested capital = total proceeds / total invested. */
  function moic(invested, proceeds) {
    need(invested, 'Invested equity'); need(proceeds, 'Proceeds');
    if (invested <= 0) throw new ModelError('Invested equity must be greater than zero.', 'bad_equity');
    if (proceeds < 0) throw new ModelError('Proceeds cannot be negative.', 'bad_proceeds');
    return proceeds / invested;
  }

  // ---------- Cost of capital ----------

  /** CAPM: Ke = rf + beta * ERP. */
  function capm(rf, beta, erp) { return need(rf, 'Risk-free rate') + need(beta, 'Beta') * need(erp, 'Equity risk premium'); }

  /** WACC = E/(D+E)*Ke + D/(D+E)*Kd*(1-t). Values are market values. */
  function wacc({ equityValue, debtValue, costOfEquity, costOfDebt, taxRate = 0 }) {
    need(equityValue, 'Equity value'); need(debtValue, 'Debt value'); need(costOfEquity, 'Cost of equity');
    need(costOfDebt, 'Cost of debt'); need(taxRate, 'Tax rate');
    if (equityValue < 0 || debtValue < 0 || equityValue + debtValue <= 0) throw new ModelError('Capital structure values must be non-negative and sum to more than zero.', 'bad_capital');
    if (taxRate < 0 || taxRate >= 1) throw new ModelError('Tax rate must be in [0, 100%).', 'bad_tax');
    const v = equityValue + debtValue;
    return equityValue / v * costOfEquity + debtValue / v * costOfDebt * (1 - taxRate);
  }

  // ---------- DCF ----------

  /** Gordon growth terminal value at end of final forecast year: TV = FCF_n (1+g) / (r - g). */
  function gordonTerminalValue(finalFcf, rate, growth) {
    need(finalFcf, 'Final-year FCF'); need(rate, 'Discount rate'); need(growth, 'Terminal growth');
    if (growth >= rate) throw new ModelError(`Terminal growth (${(growth * 100).toFixed(2)}%) must be below the discount rate (${(rate * 100).toFixed(2)}%); the Gordon formula is meaningless otherwise.`, 'growth_ge_rate');
    if (rate <= 0) throw new ModelError('Discount rate must be positive.', 'bad_rate');
    return finalFcf * (1 + growth) / (rate - growth);
  }

  /** Exit-multiple terminal value: TV = metric_n * multiple. */
  function exitMultipleTerminalValue(metric, multiple) {
    need(metric, 'Terminal metric'); need(multiple, 'Exit multiple');
    if (multiple < 0) throw new ModelError('Exit multiple cannot be negative.', 'bad_multiple');
    return metric * multiple;
  }

  /**
   * Enterprise value = sum FCF_t/(1+r)^t + TV/(1+r)^n, end-of-year discounting.
   * terminal: {method:'gordon', growth} | {method:'multiple', metric, multiple}
   */
  function dcf({ fcfs, rate, terminal }) {
    if (!Array.isArray(fcfs) || !fcfs.length) throw new ModelError('DCF needs at least one forecast cash flow.', 'empty');
    need(rate, 'Discount rate');
    if (rate <= -1) throw new ModelError('Discount rate must be greater than -100%.', 'bad_rate');
    const n = fcfs.length;
    const pvFcf = fcfs.reduce((s, f, i) => s + need(f, 'FCF') / Math.pow(1 + rate, i + 1), 0);
    let tv;
    if (!terminal) throw new ModelError('A terminal value method is required.', 'no_terminal');
    if (terminal.method === 'gordon') tv = gordonTerminalValue(fcfs[n - 1], rate, terminal.growth);
    else if (terminal.method === 'multiple') tv = exitMultipleTerminalValue(terminal.metric, terminal.multiple);
    else throw new ModelError('Unknown terminal value method.', 'bad_terminal');
    const pvTv = tv / Math.pow(1 + rate, n);
    const ev = pvFcf + pvTv;
    return { pvFcf, terminalValue: tv, pvTerminalValue: pvTv, enterpriseValue: ev, terminalShare: ev !== 0 ? pvTv / ev : null };
  }

  // ---------- Sources & uses ----------

  /**
   * Uses = purchase EV + refinanced debt + fees + cash to balance sheet.
   * Sources = debt + rollover equity + sponsor equity (plug).  Sources == Uses by construction.
   * (Purchase EV already includes the target's existing net debt; refinance is an
   * ADDITIONAL use only if the caller treats EV as equity purchase price.)
   */
  function sourcesAndUses({ purchaseEv, refinance = 0, fees = 0, cashToBalanceSheet = 0, debt, rolloverEquity = 0 }) {
    [['Purchase price', purchaseEv], ['Refinanced debt', refinance], ['Fees', fees], ['Cash to balance sheet', cashToBalanceSheet], ['Debt', debt], ['Rollover equity', rolloverEquity]]
      .forEach(([n, v]) => { need(v, n); if (v < 0) throw new ModelError(`${n} cannot be negative.`, 'negative'); });
    if (purchaseEv <= 0) throw new ModelError('Purchase price must be greater than zero.', 'bad_ev');
    const totalUses = purchaseEv + refinance + fees + cashToBalanceSheet;
    const sponsorEquity = totalUses - debt - rolloverEquity;
    if (sponsorEquity <= 0) throw new ModelError('Debt plus rollover equity would fund the entire purchase; sponsor equity must be positive.', 'no_equity');
    return { uses: { purchaseEv, refinance, fees, cashToBalanceSheet, total: totalUses }, sources: { debt, rolloverEquity, sponsorEquity, total: debt + rolloverEquity + sponsorEquity }, sponsorEquity };
  }

  // ---------- Operating forecast ----------

  /**
   * EBITDA_t. LTM revenue is not an input, so LTM margin is taken to equal the
   * year-1 margin m_1; then Rev_t = Rev_0 * prod(1+g_i), EBITDA_t = Rev_t * m_t
   * = EBITDA_0 * prod(1+g_i) * m_t / m_1.
   */
  function operatingForecast({ ebitda, growth, margin }) {
    need(ebitda, 'EBITDA');
    if (ebitda <= 0) throw new ModelError('Current EBITDA must be greater than zero.', 'bad_ebitda');
    if (!Array.isArray(growth) || !Array.isArray(margin) || growth.length !== margin.length || !growth.length) throw new ModelError('Growth and margin need the same number of years.', 'bad_forecast');
    growth.forEach((g) => { need(g, 'Revenue growth'); if (g <= -1) throw new ModelError('Revenue growth cannot be -100% or lower.', 'bad_growth'); });
    margin.forEach((m) => { need(m, 'EBITDA margin'); if (m <= 0 || m > 1) throw new ModelError('EBITDA margin must be above 0% and at most 100%.', 'bad_margin'); });
    const rev0 = ebitda / margin[0];
    let rev = rev0;
    return growth.map((g, i) => { rev *= 1 + g; return { year: i + 1, revenue: rev, ebitda: rev * margin[i] }; });
  }

  // ---------- Debt schedule ----------

  /**
   * One tranche, annual periods.  Per year t:
   *   interest_t   = rate * B_t, with B_t = opening ("beginning") or (opening+closing)/2 ("average")
   *   cashAvail_t  = preInterestCash_t - interest_t
   *   mandatory_t  = min(opening, amortPct * originalPrincipal)
   *   sweep_t      = min(opening - mandatory, sweepPct * max(0, cashAvail - mandatory))
   *   if cashAvail < mandatory the gap is drawn on the facility (debt rises by the shortfall)
   *   closing_t    = opening - (cashAvail >= mandatory ? mandatory + sweep : cashAvail)
   *   surplus cash after debt is fully repaid (or sweepPct<100%) accumulates in cash.
   * Average-balance interest is circular (closing depends on interest). It is solved
   * by fixed-point iteration to 1e-12; contraction factor is rate*sweepPct/2 < 1, so it converges.
   */
  function debtSchedule({ openingDebt, rate, preInterestCash, amortPct = 0, sweepPct = 1, interestBasis = 'average', openingCash = 0 }) {
    need(openingDebt, 'Opening debt'); need(rate, 'Interest rate'); need(amortPct, 'Amortisation'); need(sweepPct, 'Cash sweep'); need(openingCash, 'Opening cash');
    if (openingDebt < 0) throw new ModelError('Debt cannot be negative.', 'negative_debt');
    if (rate < 0 || rate > 1) throw new ModelError('Interest rate must be between 0% and 100%.', 'bad_rate');
    if (amortPct < 0 || amortPct > 1 || sweepPct < 0 || sweepPct > 1) throw new ModelError('Amortisation and sweep percentages must be between 0% and 100%.', 'bad_pct');
    if (interestBasis !== 'average' && interestBasis !== 'beginning') throw new ModelError('interestBasis must be "average" or "beginning".', 'bad_basis');
    if (!Array.isArray(preInterestCash) || !preInterestCash.length) throw new ModelError('Debt schedule needs at least one year.', 'empty');
    const original = openingDebt;
    let debt = openingDebt, cash = openingCash;
    const rows = [];
    preInterestCash.forEach((cfPre, i) => {
      need(cfPre, 'Pre-interest cash flow');
      const opening = debt;
      const mandatoryCap = Math.min(opening, amortPct * original);
      const solve = (closingGuess) => {
        const base = interestBasis === 'average' ? (opening + closingGuess) / 2 : opening;
        const interest = rate * base;
        const avail = cfPre - interest;
        let sweep = 0, draw = 0, repay;
        if (avail >= mandatoryCap) {
          sweep = Math.min(opening - mandatoryCap, sweepPct * (avail - mandatoryCap));
          repay = mandatoryCap + sweep;
        } else { draw = mandatoryCap - avail; repay = avail; } // mandatory still paid; shortfall drawn (net debt change = -avail)
        return { interest, avail, sweep, draw, closing: opening - repay };
      };
      let r = solve(opening);
      for (let k = 0; k < 500 && interestBasis === 'average'; k += 1) {
        const next = solve(r.closing);
        const done = Math.abs(next.closing - r.closing) < 1e-12;
        r = next;
        if (done) break;
      }
      const surplus = r.avail >= mandatoryCap ? r.avail - mandatoryCap - r.sweep : 0;
      cash += surplus;
      rows.push({ year: i + 1, openingDebt: opening, interest: r.interest, cashAvailable: r.avail, mandatory: mandatoryCap, sweep: r.sweep, revolverDraw: r.draw, closingDebt: r.closing, cash, netDebt: r.closing - cash });
      debt = r.closing;
    });
    return rows;
  }

  // ---------- LBO ----------

  /**
   * Full LBO. Inputs: ev, ebitda, debtMultiple (x EBITDA), interest (decimal), hold (integer 1..N),
   * exitMultiple (x), growth[], margin[] (decimals, N years), and optional
   * fcfConversion (default 0.65: pre-interest, pre-debt-service cash flow as a share of EBITDA;
   * absorbs taxes, capex, working capital), fees, amortPct (1%), sweepPct (100%), interestBasis ('average').
   */
  function lbo(input) {
    const { ev, ebitda, debtMultiple, interest, hold, exitMultiple, growth, margin } = input;
    const fcfConversion = input.fcfConversion ?? 0.65, fees = input.fees ?? 0, amortPct = input.amortPct ?? 0.01;
    const sweepPct = input.sweepPct ?? 1, interestBasis = input.interestBasis ?? 'average';
    [['Purchase price', ev], ['EBITDA', ebitda], ['Borrowing level', debtMultiple], ['Interest', interest], ['Years held', hold], ['Exit multiple', exitMultiple], ['Cash conversion', fcfConversion], ['Fees', fees]].forEach(([n, v]) => need(v, n));
    if (ev <= 0) throw new ModelError('Purchase price must be greater than zero.', 'bad_ev');
    if (ebitda <= 0) throw new ModelError('Current EBITDA must be greater than zero.', 'bad_ebitda');
    if (debtMultiple < 0) throw new ModelError('Borrowing level cannot be negative.', 'bad_debt');
    if (interest < 0) throw new ModelError('Interest cannot be negative.', 'bad_rate');
    if (exitMultiple <= 0) throw new ModelError('Exit multiple must be greater than zero.', 'bad_multiple');
    if (fcfConversion < 0 || fcfConversion > 1) throw new ModelError('Cash conversion must be between 0% and 100%.', 'bad_conversion');
    const forecast = operatingForecast({ ebitda, growth, margin });
    if (!Number.isInteger(hold) || hold < 1 || hold > forecast.length) throw new ModelError(`Years held must be a whole number from 1 to ${forecast.length}.`, 'bad_hold');
    const entryDebt = ebitda * debtMultiple;
    if (entryDebt > 0.9 * ev) throw new ModelError('Borrowing is too high: debt should stay below 90% of the purchase price.', 'debt_too_high');
    const su = sourcesAndUses({ purchaseEv: ev, fees, debt: entryDebt });
    const entryEquity = su.sponsorEquity;
    const schedule = debtSchedule({ openingDebt: entryDebt, rate: interest, preInterestCash: forecast.map((f) => f.ebitda * fcfConversion), amortPct, sweepPct, interestBasis });
    const rows = schedule.map((s, i) => ({ ...s, revenue: forecast[i].revenue, ebitda: forecast[i].ebitda, netLeverage: s.netDebt / forecast[i].ebitda }));
    const exitRow = rows[hold - 1];
    const entryMultiple = ev / ebitda;
    const exitEbitda = exitRow.ebitda;
    const exitEv = exitEbitda * exitMultiple;
    const exitNetDebt = exitRow.netDebt;
    const rawExitEquity = exitEv - exitNetDebt;            // repays debt at par at exit, so exit before maturity is handled
    const exitEquity = Math.max(0, rawExitEquity);         // limited liability
    const moicValue = exitEquity / entryEquity;
    let irrValue;
    if (exitEquity === 0) irrValue = -1;                   // total loss
    else irrValue = irr([-entryEquity, ...Array(hold - 1).fill(0), exitEquity]);
    const attribution = returnsAttribution({ ebitdaEntry: ebitda, ebitdaExit: exitEbitda, entryMultiple, exitMultiple, netDebtEntry: entryDebt, netDebtExit: exitNetDebt, fees });
    return {
      entryMultiple, entryDebt, entryEquity, sourcesAndUses: su, forecast, schedule: rows, hold,
      exitEbitda, exitMultiple, exitEv, exitDebt: exitRow.closingDebt, exitCash: exitRow.cash, exitNetDebt,
      rawExitEquity, exitEquity, valueCreation: exitEquity - entryEquity, debtPaydown: entryDebt - exitNetDebt,
      moic: moicValue, irr: irrValue, attribution, wipedOut: rawExitEquity < 0,
      shortfall: rows.slice(0, hold).some((r) => r.revolverDraw > 1e-9)
    };
  }

  /**
   * Exact identity (no clamping):  ExitEquity - EntryEquity =
   *   (E1 - E0) * M0        EBITDA growth at the entry multiple
   * + (M1 - M0) * E1        multiple change applied to exit EBITDA (cross term goes here)
   * + (ND0 - ND1)           net-debt reduction (debt paydown + cash build)
   * - fees                  transaction-fee leakage
   */
  function returnsAttribution({ ebitdaEntry, ebitdaExit, entryMultiple, exitMultiple, netDebtEntry, netDebtExit, fees = 0 }) {
    const ebitdaGrowth = (ebitdaExit - ebitdaEntry) * entryMultiple;
    const multiple = (exitMultiple - entryMultiple) * ebitdaExit;
    const debtPaydown = netDebtEntry - netDebtExit;
    const total = ebitdaGrowth + multiple + debtPaydown - fees;
    const share = (x) => (total > 0 ? x / total : null);
    return { ebitdaGrowth, multiple, debtPaydown, fees: -fees, total, shares: { ebitdaGrowth: share(ebitdaGrowth), multiple: share(multiple), debtPaydown: share(debtPaydown) } };
  }

  /**
   * IRR grid. Each cell re-runs the debt schedule with EBITDA_t = EBITDA_0 (1+g)^t
   * (constant EBITDA growth g) and the given exit multiple. Returns decimals.
   */
  function sensitivity(input, multiples, growths) {
    return multiples.map((m) => growths.map((g) => {
      const n = input.growth.length;
      const r = lbo({ ...input, exitMultiple: m, growth: Array(n).fill(g), margin: Array(n).fill(0.2) });
      return r.irr;
    }));
  }


  // ---------- Input parsing / validation (UI layer contract) ----------

  const num = (v) => (typeof v === 'string' ? (v.trim() === '' ? NaN : Number(v)) : (typeof v === 'number' ? v : NaN));

  /**
   * raw: {ev, ebitda, debtMultiple, interest(%), hold, exitMultiple, growth:[%], margin:[%]} as strings or numbers.
   * Returns {errors:[{field,index?,message}], input} where input is ready for lbo() (rates as decimals).
   * Blank, non-numeric, Infinity and NaN are all rejected: nothing non-finite reaches the model.
   */
  function validateDeal(raw) {
    const errors = [];
    const bad = (field, message, index) => errors.push(index === undefined ? { field, message } : { field, index, message });
    const v = {};
    ['ev', 'ebitda', 'debtMultiple', 'interest', 'hold', 'exitMultiple'].forEach((k) => { v[k] = num(raw[k]); });
    const label = { ev: 'Purchase price', ebitda: 'Current EBITDA', debtMultiple: 'Borrowing level', interest: 'Annual interest', hold: 'Years held', exitMultiple: 'Exit multiple' };
    Object.keys(label).forEach((k) => { if (!finite(v[k])) bad(k, `${label[k]} must be a number.`); });
    if (finite(v.ev) && v.ev <= 0) bad('ev', 'Purchase price must be greater than zero.');
    if (finite(v.ebitda) && v.ebitda <= 0) bad('ebitda', 'Current annual profit (EBITDA) must be greater than zero.');
    if (finite(v.debtMultiple) && v.debtMultiple < 0) bad('debtMultiple', 'Borrowing level cannot be negative.');
    if (finite(v.interest) && (v.interest < 0 || v.interest > 100)) bad('interest', 'Annual interest must be between 0% and 100%.');
    if (finite(v.hold) && (!Number.isInteger(v.hold) || v.hold < 1 || v.hold > 5)) bad('hold', 'Years held must be a whole number from 1 to 5 because the forecast models five operating years.');
    if (finite(v.exitMultiple) && v.exitMultiple <= 0) bad('exitMultiple', 'Exit multiple must be greater than zero.');
    const growth = (raw.growth || []).map(num), margin = (raw.margin || []).map(num);
    if (growth.length !== 5 || margin.length !== 5) bad('forecast', 'The forecast needs five years of growth and margin.');
    growth.forEach((g, i) => { if (!finite(g) || g < -100 || g > 100) bad('growth', `Revenue growth for year ${i + 1} must be a number from -100% to 100% (and above -100%).`, i); else if (g === -100) bad('growth', `Revenue growth for year ${i + 1} cannot be exactly -100%.`, i); });
    margin.forEach((m, i) => { if (!finite(m) || m <= 0 || m > 100) bad('margin', `EBITDA margin for year ${i + 1} must be above 0% and at most 100%.`, i); });
    if (finite(v.ev) && finite(v.ebitda) && finite(v.debtMultiple) && v.ev > 0 && v.ebitda > 0 && v.debtMultiple >= 0 && v.ebitda * v.debtMultiple > 0.9 * v.ev) bad('debtMultiple', 'Borrowing is too high: debt should stay below 90% of the purchase price.');
    const input = { ev: v.ev, ebitda: v.ebitda, debtMultiple: v.debtMultiple, interest: v.interest / 100, hold: v.hold, exitMultiple: v.exitMultiple, growth: growth.map((g) => g / 100), margin: margin.map((m) => m / 100) };
    return { errors, input };
  }

  /** Validate DCF inputs (percent numbers). */
  function validateDcf({ wacc: w, terminalGrowth: g }) {
    const W = num(w), G = num(g);
    if (!finite(W) || W < 1 || W > 30) return 'WACC must be a number from 1% to 30%.';
    if (!finite(G) || G < -2 || G > 8) return 'Terminal growth must be a number from -2% to 8%.';
    if (G >= W) return `Terminal growth (${G}%) must be below WACC (${W}%); the Gordon growth formula breaks down otherwise.`;
    return '';
  }

  return { validateDeal, validateDcf, ModelError, npv, irr, moic, capm, wacc, gordonTerminalValue, exitMultipleTerminalValue, dcf, sourcesAndUses, operatingForecast, debtSchedule, lbo, returnsAttribution, sensitivity };
});
