/*
 * Rivet UI helpers.
 *
 * Pure formatting, CSV, chart and summary-text helpers used by app.js. No DOM access,
 * so they run under `node --test` (test/ui-helpers.test.js). Works as a browser <script>
 * (exposes window.RivetUI) and as a Node CommonJS module (require('./ui-helpers.js')).
 * Percentages passed in here are PERCENT numbers (12.5 = 12.5%), matching the UI.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RivetUI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DASH = '—';
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  // Round half away from zero at 1 dp, then print; avoids "-0.0" for tiny negatives.
  const fixed = (value, dp) => {
    const s = value.toFixed(dp);
    return /^-0\.?0*$/.test(s) ? s.slice(1) : s;
  };

  /** USD millions, one decimal: 191 -> "$191.0", -5.25 -> "-$5.3". */
  function money(value) {
    if (!isNum(value)) return DASH;
    const s = fixed(Math.abs(value), 1);
    return `${value < 0 && s !== '0.0' ? '-' : ''}$${s}`;
  }
  /** Multiple, one decimal: 4.04 -> "4.0x". */
  function mult(value) { return isNum(value) ? `${fixed(value, 1)}x` : DASH; }
  /** Percent number, one decimal: 32.24 -> "32.2%". */
  function pct(value) { return isNum(value) ? `${fixed(value, 1)}%` : DASH; }
  /** Percent number with explicit sign for gains: 5 -> "+5.0%". */
  function signedPct(value) {
    if (!isNum(value)) return DASH;
    const s = fixed(value, 1);
    return `${value > 0 && s !== '0.0' ? '+' : ''}${s}%`;
  }

  /**
   * Heat-map colour bucket 1..7 for an IRR in percent: round(irr / 5), clamped.
   * 1 = below 7.5%, 7 = 32.5% or more. Non-finite values fall in bucket 1.
   */
  function heatBucket(irrPct) {
    if (!isNum(irrPct)) return 1;
    return Math.max(1, Math.min(7, Math.round(irrPct / 5)));
  }

  /**
   * Illustrative return envelope: FIXED offsets around the point IRR (percent).
   * Not a statistical distribution; there is no probability attached to either bound.
   */
  const ENVELOPE_OFFSETS = Object.freeze({ lower: 6.6, higher: 9.3 });
  function envelope(basePct) {
    if (!isNum(basePct)) return { lower: NaN, base: NaN, higher: NaN };
    return { lower: Math.max(-100, basePct - ENVELOPE_OFFSETS.lower), base: basePct, higher: basePct + ENVELOPE_OFFSETS.higher };
  }

  /**
   * Positions (0..100 %) of the three envelope points on a plain axis running from the
   * lower bound rounded down to a multiple of 5 minus 5, to the higher bound rounded up plus 5.
   */
  function envelopeScale(env) {
    if (!isNum(env.lower) || !isNum(env.higher)) return null;
    const min = Math.floor(env.lower / 5) * 5 - 5, max = Math.ceil(env.higher / 5) * 5 + 5;
    const at = (v) => ((v - min) / (max - min)) * 100;
    return { min, max, lower: at(env.lower), base: at(env.base), higher: at(env.higher) };
  }

  /** CSV for a sensitivity grid {multiples, growths (percent), values (percent IRR, rows = multiples)}. */
  function sensitivityCsv({ multiples, growths, values }) {
    const header = ['Exit EV/EBITDA \\ annual EBITDA growth', ...growths.map((g) => `${g}%`)].join(',');
    const rows = multiples.map((m, i) => [mult(m), ...values[i].map((v) => pct(v))].join(','));
    return [header, ...rows].join('\n');
  }

  /**
   * X-axis labels for the value chart: the entry point plus one label per held year.
   * firstYear is the two-digit fiscal year of forecast year 1 (26 -> "FY26E"). The final
   * point is the exit year, so the chart has exactly hold + 1 points and hold + 1 labels.
   */
  function chartXLabels(hold, firstYear = 26) {
    const n = Number.isInteger(hold) && hold > 0 ? hold : 0;
    return ['Entry', ...Array.from({ length: n }, (_, i) => `FY${String(firstYear + i).padStart(2, '0')}E${i === n - 1 ? ' · exit' : ''}`)];
  }

  const CHART_SERIES = Object.freeze({
    total: 'Enterprise value at the exit multiple',
    debt: 'Debt outstanding (year end)',
    profit: 'EBITDA'
  });

  /**
   * Series for the value chart (USD mm), hold + 1 points each:
   *   total  = [purchase EV, EBITDA_t x exit multiple ...]
   *   debt   = [entry debt, closing debt_t ...]
   *   profit = [EBITDA_0, EBITDA_t ...]
   * model: { ev, entryDebt, ebitda, exitMultiple, forecastEbitda[hold], debtSchedule[] }.
   */
  function chartSeries(model, key) {
    const forecast = model.forecastEbitda || [];
    const schedule = model.debtSchedule || [];
    if (key === 'debt') return [model.entryDebt, ...forecast.map((_, i) => Math.max(schedule[i] ? schedule[i].closingDebt : 0, 0))];
    if (key === 'profit') return [model.ebitda, ...forecast];
    return [model.ev, ...forecast.map((e) => e * model.exitMultiple)];
  }

  /** Text alternative for the chart: "<series>, USD mm: Entry $425.0; FY26E $477.6; ...". */
  function chartDescription(key, labels, values) {
    const name = CHART_SERIES[key] || CHART_SERIES.total;
    return `${name}, USD mm: ${values.map((v, i) => `${labels[i] || ''} ${money(v)}`.trim()).join('; ')}.`;
  }

  /** CSV of the LBO sources and uses / paydown lines (USD mm, one decimal, no currency sign). */
  function lboCsv(m) {
    const f = (v) => (isNum(v) ? fixed(v, 1) : '');
    return [
      'Line,USD mm',
      `Purchase enterprise value,${f(m.ev)}`,
      `Debt,${f(m.entryDebt)}`,
      `Sponsor equity,${f(m.entryEquity)}`,
      `Total sources,${f(m.entryDebt + m.entryEquity)}`,
      `Exit debt,${f(m.exitDebt)}`,
      `Exit net debt,${f(m.exitNetDebt)}`,
      `Net-debt reduction,${f(m.debtPaydown)}`
    ].join('\n');
  }

  /**
   * Plain-text deal summary for export. m is the app's currentModel (IRR, interest and growth in percent).
   * notes: array of warning strings shown in the app for this run.
   */
  function summaryText(m, caseName, notes = []) {
    const years = (m.forecastAll || []).map((r) => r.year);
    const growth = (m.input && m.input.growth ? m.input.growth : []).map((g) => pct(g * 100)).join(' / ');
    const margin = (m.input && m.input.margin ? m.input.margin : []).map((x) => pct(x * 100)).join(' / ');
    const span = years.length ? ` (years ${years[0]}–${years[years.length - 1]})` : '';
    const env = envelope(m.irr);
    const lines = [
      'RIVET / PROJECT ATLAS — ILLUSTRATIVE DEAL SUMMARY',
      'Educational, illustrative model output. Not a deal-grade underwriting model, investment advice or market data.',
      '',
      'CASE & HOLD',
      `Case: ${caseName}`,
      `Hold: ${m.hold} year${m.hold === 1 ? '' : 's'} (exit at the end of year ${m.hold})`,
      '',
      'TRANSACTION (USD mm)',
      `Entry enterprise value: ${money(m.ev)}`,
      `Entry EBITDA: ${money(m.ebitda)} (entry multiple ${mult(m.entryMultiple)})`,
      `Entry debt: ${money(m.entryDebt)} (${mult(m.entryDebt / m.ebitda)} EBITDA)`,
      `Entry sponsor equity: ${money(m.entryEquity)}`,
      '',
      'EXIT & RETURNS (gross, before fees, carry and taxes)',
      `Exit EBITDA: ${money(m.exitEbitda)}`,
      `Exit multiple: ${mult(m.exitMultiple)}`,
      `Exit enterprise value: ${money(m.exitEv)}`,
      `Exit debt: ${money(m.exitDebt)} · exit net debt: ${money(m.exitNetDebt)}`,
      `Exit equity: ${money(m.exitEquity)}`,
      `MOIC: ${isNum(m.moic) ? `${fixed(m.moic, 2)}x` : DASH}`,
      `Gross IRR: ${pct(m.irr)}`,
      `Illustrative range (fixed offsets -${ENVELOPE_OFFSETS.lower} / +${ENVELOPE_OFFSETS.higher} pts, not a probability range): ${pct(env.lower)} to ${pct(env.higher)}`,
      '',
      'ASSUMPTIONS',
      `Revenue growth${span}: ${growth}`,
      `EBITDA margin${span}: ${margin}`,
      `Interest: ${isNum(m.interest) ? `${fixed(m.interest, 2)}%` : DASH} on the average balance`,
      `Net-debt reduction over the hold: ${money(m.debtPaydown)}`
    ];
    if (notes.length) lines.push('', 'WARNINGS', ...notes.map((n) => `- ${n}`));
    lines.push('', 'METHODOLOGY',
      'Deterministic operating forecast; one debt tranche with interest on the average balance (solved iteratively), 1% mandatory amortisation and a 100% cash sweep; cash available for debt service is 65% of EBITDA before interest (a single proxy for taxes, capex and working capital). Exit proceeds repay net debt at par. IRR = MOIC^(1/hold) - 1 (single entry and exit cash flow). Formulas: docs/formulas.md.');
    return lines.join('\n');
  }

  return { isNum, money, mult, pct, signedPct, heatBucket, envelope, envelopeScale, ENVELOPE_OFFSETS, sensitivityCsv, chartXLabels, CHART_SERIES, chartSeries, chartDescription, lboCsv, summaryText };
});
