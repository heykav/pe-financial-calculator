'use strict';
/*
 * Map SEC XBRL "company facts" JSON (data.sec.gov/api/xbrl/companyfacts) onto the
 * handful of numbers Rivet needs. Pure functions, no I/O, so it is unit-tested offline.
 *
 * Principle: never guess. Every number comes from one 10-K (one accession number), one
 * fiscal period, one named us-gaap tag. If a company's tags are ambiguous, missing, or
 * fail an identity check, mapCompany throws Unmappable and the company is left out.
 */

class Unmappable extends Error {
  constructor(message) { super(message); this.name = 'Unmappable'; }
}

const DAY = 86400000;
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

// Tag rules. Anything not listed here is not used.
const REVENUE_TAGS = ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax'];
const OPERATING_INCOME_TAG = 'OperatingIncomeLoss';
const DA_TAGS = ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization'];
const CASH_TAG = 'CashAndCashEquivalentsAtCarryingValue';
const SHORT_INVEST_TAGS = ['MarketableSecuritiesCurrent', 'ShortTermInvestments'];

function usdFacts(facts, tag) {
  const node = facts && facts.facts && facts.facts['us-gaap'] && facts.facts['us-gaap'][tag];
  return node && node.units && node.units.USD ? node.units.USD : [];
}

/** Latest 10-K by filing date that carries a cover-page share count. */
function latestAnnualFiling(facts) {
  const node = facts && facts.facts && facts.facts.dei && facts.facts.dei.EntityCommonStockSharesOutstanding;
  const list = node && node.units && node.units.shares ? node.units.shares.filter((f) => f.form === '10-K') : [];
  if (!list.length) throw new Unmappable('no 10-K cover-page share count');
  const last = list.reduce((a, b) => (b.filed > a.filed ? b : a));
  const sameFiling = list.filter((f) => f.accn === last.accn);
  if (sameFiling.length !== 1) throw new Unmappable('several share classes on the cover page; refusing to pick one');
  return { accn: last.accn, filed: last.filed, shares: last.val, sharesAsOf: last.end };
}

/** Duration fact of ~1 year inside this filing, latest period end. */
function annualDuration(facts, tag, accn, wantEnd) {
  const list = usdFacts(facts, tag).filter((f) => f.accn === accn && f.start && f.end && days(f.start, f.end) >= 350 && days(f.start, f.end) <= 380);
  if (wantEnd) return list.filter((f) => f.end === wantEnd);
  return list;
}

/** Point-in-time (balance sheet) fact in this filing at this date. */
function instant(facts, tag, accn, end) {
  return usdFacts(facts, tag).filter((f) => f.accn === accn && !f.start && f.end === end);
}

function one(list, what) {
  if (!list.length) return null;
  const vals = new Set(list.map((f) => f.val));
  if (vals.size > 1) throw new Unmappable(`${what}: conflicting values in one filing`);
  return list[0];
}

function ref(tag, fact) {
  return { tag, usd: fact.val, period: fact.start ? `${fact.start}..${fact.end}` : fact.end };
}

function mapCompany(facts, { ticker, name, cik, retrievedOn }) {
  const filing = latestAnnualFiling(facts);
  const { accn } = filing;

  // Revenue: prefer the broader "Revenues" if the filing reports it for the year.
  let revenue = null;
  for (const tag of REVENUE_TAGS) {
    const cands = annualDuration(facts, tag, accn);
    if (!cands.length) continue;
    const end = cands.reduce((a, b) => (b.end > a ? b.end : a), '');
    const hit = one(cands.filter((f) => f.end === end), `revenue ${tag}`);
    if (hit) { revenue = { tag, fact: hit }; break; }
  }
  if (!revenue) throw new Unmappable('no annual revenue in the latest 10-K');
  const fyEnd = revenue.fact.end;

  const prior = (() => {
    const cands = annualDuration(facts, revenue.tag, accn).filter((f) => f.end < fyEnd && days(f.end, fyEnd) >= 350 && days(f.end, fyEnd) <= 380);
    return one(cands, 'prior-year revenue');
  })();

  const oi = one(annualDuration(facts, OPERATING_INCOME_TAG, accn, fyEnd), 'operating income');
  if (!oi) throw new Unmappable('no operating income for the fiscal year');

  // D&A: both tags present with different values means the cash-flow figure is ambiguous.
  const daHits = DA_TAGS.map((tag) => ({ tag, fact: one(annualDuration(facts, tag, accn, fyEnd), `D&A ${tag}`) })).filter((x) => x.fact);
  if (!daHits.length) throw new Unmappable('no allowed D&A tag for the fiscal year');
  if (new Set(daHits.map((x) => x.fact.val)).size > 1) throw new Unmappable('D&A tags disagree; ambiguous');
  const da = daHits[0];

  // Debt: long-term noncurrent (required) + current portion.
  const ltdNon = one(instant(facts, 'LongTermDebtNoncurrent', accn, fyEnd), 'noncurrent debt');
  if (!ltdNon) throw new Unmappable('no noncurrent long-term debt at fiscal year end');
  const debtItems = [ref('LongTermDebtNoncurrent', ltdNon)];
  const debtCurrentTotal = one(instant(facts, 'DebtCurrent', accn, fyEnd), 'DebtCurrent');
  const ltdCur = one(instant(facts, 'LongTermDebtCurrent', accn, fyEnd), 'current portion of debt');
  if (debtCurrentTotal) {
    debtItems.push(ref('DebtCurrent', debtCurrentTotal));
  } else {
    const parts = [['LongTermDebtCurrent', ltdCur], ['CommercialPaper', one(instant(facts, 'CommercialPaper', accn, fyEnd), 'commercial paper')], ['ShortTermBorrowings', one(instant(facts, 'ShortTermBorrowings', accn, fyEnd), 'short-term borrowings')]].filter(([, f]) => f);
    if (!parts.length) throw new Unmappable('no current debt tags at fiscal year end');
    parts.forEach(([tag, f]) => debtItems.push(ref(tag, f)));
  }
  // Identity check: if the filing also reports total long-term debt, it must equal noncurrent + current portion.
  const ltdTotal = one(instant(facts, 'LongTermDebt', accn, fyEnd), 'LongTermDebt');
  if (ltdTotal) {
    if (!ltdCur) throw new Unmappable('total LongTermDebt reported but no current portion to reconcile it');
    if (ltdNon.val + ltdCur.val !== ltdTotal.val) throw new Unmappable('LongTermDebt does not equal noncurrent + current portion');
  }

  // Cash and short-term investments.
  const cash = one(instant(facts, CASH_TAG, accn, fyEnd), 'cash');
  if (!cash) throw new Unmappable('no cash and equivalents at fiscal year end');
  const cashItems = [ref(CASH_TAG, cash)];
  const inv = SHORT_INVEST_TAGS.map((tag) => ({ tag, fact: one(instant(facts, tag, accn, fyEnd), tag) })).filter((x) => x.fact);
  if (inv.length > 1) throw new Unmappable('both marketable securities and short-term investments reported; ambiguous');
  if (inv.length === 1) cashItems.push(ref(inv[0].tag, inv[0].fact));

  const sum = (items) => items.reduce((s, i) => s + i.usd, 0);
  const totalDebt = sum(debtItems), totalCash = sum(cashItems);
  const mm = (usd) => usd / 1e6;

  const ebitdaUsd = oi.val + da.fact.val;
  return {
    ticker, name, cik,
    filing: { form: '10-K', accession: accn, filed: filing.filed, fiscalYearEnd: fyEnd },
    retrievedOn,
    revenue: { ...ref(revenue.tag, revenue.fact), usdMm: mm(revenue.fact.val) },
    priorRevenue: prior ? { ...ref(revenue.tag, prior), usdMm: mm(prior.val) } : null,
    operatingIncome: { ...ref(OPERATING_INCOME_TAG, oi), usdMm: mm(oi.val) },
    depreciationAmortization: { ...ref(da.tag, da.fact), usdMm: mm(da.fact.val) },
    ebitda: { usd: ebitdaUsd, usdMm: mm(ebitdaUsd), definition: 'operating income + depreciation and amortization, both as reported, no adjustments' },
    debt: { items: debtItems.map((i) => ({ ...i, usdMm: mm(i.usd) })), totalUsdMm: mm(totalDebt) },
    cash: { items: cashItems.map((i) => ({ ...i, usdMm: mm(i.usd) })), totalUsdMm: mm(totalCash) },
    netDebtUsdMm: mm(totalDebt - totalCash),
    shares: { count: filing.shares, asOf: filing.sharesAsOf, tag: 'dei:EntityCommonStockSharesOutstanding' }
  };
}

module.exports = { mapCompany, latestAnnualFiling, Unmappable };
