const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const M = window.RivetModel;
const UI = window.RivetUI;
const { isNum, money, mult, pct, signedPct } = UI;
const FCF_CONVERSION = 0.65; // documented in docs/formulas.md
const inputs = ['ev','ebitda','debtMultiple','interest','hold','exitIn'];
const state = { defaultValues: Object.fromEntries(inputs.map((id) => [id, $(id).value])) };
const caseLabels = {
  base: { name: 'Base case', description: 'Management plan · current case view' },
  downside: { name: 'Downside', description: 'Revenue haircut · margin compression · conservative deleveraging' },
  upside: { name: 'Upside', description: 'Pricing expansion · accelerated growth and paydown' }
};
const caseState = {
  base: { ev: '425', ebitda: '52', debtMultiple: '4.5', interest: '8.25', hold: '5', exitIn: '8.2', growth: ['12.0', '11.0', '10.0', '9.0', '8.0'], margin: ['21.0', '22.0', '23.0', '24.0', '25.0'] },
  downside: { ev: '400', ebitda: '49', debtMultiple: '4.0', interest: '9.25', hold: '5', exitIn: '8.2', growth: ['7.0', '6.0', '5.0', '4.0', '3.0'], margin: ['19.0', '19.5', '20.0', '20.5', '21.0'] },
  upside: { ev: '450', ebitda: '55', debtMultiple: '5.0', interest: '7.50', hold: '4', exitIn: '8.2', growth: ['16.0', '15.0', '14.0', '13.0', '12.0'], margin: ['22.0', '23.5', '25.0', '26.0', '27.0'] }
};
let activeCase = 'base';
const workspaces = ['Project Atlas'];
let activeWorkspace = 'Project Atlas';
let currentModel = null;
let activeChart = 'total';
const dcfState = { wacc: 9.5, terminalGrowth: 2.5 };
const workspaceData = {
  lbo: {
    title: 'LBO model',
    description: 'Follow the money: what you pay, how much you borrow, and what is left for the investor.',
    html: `<div class="workspace-help"><strong>Start here</strong><span>This page answers one question: how is the purchase funded, and how quickly does the loan get smaller?</span></div><div class="workspace-actions"><button class="button mini" id="refreshLbo">↻ Update from current case</button><button class="button mini" id="exportLbo">Download LBO table ↧</button></div><div class="workspace-grid"><div><h3>Where the money goes</h3><p class="workspace-note">Uses = the cash needed to complete the purchase · USD mm · linked to <span id="lboCaseContext">${escapeHtml(caseLabels[activeCase].name)}</span></p><div class="model-table"><div><span>Purchase enterprise value</span><b id="wsEv">—</b></div><div><span>Refinance existing debt</span><b id="wsRefi">$0.0</b></div><div class="subtotal"><span>Total uses</span><b id="wsUses">—</b></div></div></div><div><h3>Capital structure</h3><p class="workspace-note">Debt sizing = EBITDA × debt / EBITDA</p><div class="model-table"><div><span>Senior secured debt</span><b id="wsDebt">—</b></div><div><span>Sponsor equity</span><b id="wsSponsor">—</b></div><div class="subtotal"><span>Total sources</span><b id="wsSources">—</b></div></div></div></div><div class="workspace-grid lower"><div><h3>Operating leverage</h3><div class="metric-row"><span>Entry debt / EBITDA</span><strong id="wsLev">—</strong></div><div class="metric-row"><span>Exit net debt / EBITDA</span><strong id="wsExitLev">—</strong></div></div><div><h3>Debt paydown</h3><div class="metric-row"><span>Debt repaid</span><strong id="wsPaydown">—</strong></div><div class="metric-row"><span>Exit debt</span><strong id="wsExitDebt">—</strong></div></div></div>`
  },
  dcf: {
    title: 'DCF analysis',
  description: 'Estimate a value from future cash generation, then compare it with the purchase price.',
  html: `<div class="workspace-help"><strong>What is this?</strong><span>A DCF asks: if the business keeps generating cash, what could those future dollars be worth today?</span></div><div class="workspace-grid"><div><h3>Estimated value today</h3><p class="workspace-note">Illustrative · linked to the active case · USD mm</p><div class="model-table"><div><span>PV of forecast cash flows</span><b id="dcfPv">—</b></div><div><span>PV of terminal value</span><b id="dcfTerminal">—</b></div><div class="subtotal"><span>Enterprise value</span><b class="gold" id="dcfEv">—</b></div></div></div><div><h3>Editable valuation inputs</h3><p class="workspace-note">Not market data; change to test methodology</p><label class="inline-field">WACC <input id="dcfWacc" type="number" min="1" max="30" step=".25" value="9.5">%</label><label class="inline-field">Terminal growth <input id="dcfGrowth" type="number" min="-2" max="8" step=".25" value="2.5">%</label><div class="metric-row"><span>Upside / (downside) vs entry EV</span><strong id="dcfUpside">—</strong></div></div></div><div class="model-alert" id="dcfAlert" hidden role="alert"></div><div class="formula-box"><span>EV = Σ FCF<sub>t</sub> / (1 + WACC)<sup>t</sup> + [FCF<sub>n+1</sub> / (WACC − g)] / (1 + WACC)<sup>n</sup></span><b>Illustrative method · no fees, taxes, capex or working capital</b></div>`
  },
  returns: {
    title: 'Returns bridge',
  description: 'See exactly what makes the investor return go up or down.',
  html: `<div class="workspace-help"><strong>How to read this</strong><span>The bars split the modeled value created into business growth, loan paydown, and changes in the selling multiple.</span></div><div class="returns-workspace"><div class="return-hero-large"><small>GROSS IRR · BEFORE FEES</small><strong id="wsIrr">—</strong><span class="workspace-note">Linked to active case; not net investor returns</span></div><div class="return-drivers"><div><span>EBITDA growth</span><b class="positive" id="driverEbitda">—</b><i id="driverEbitdaBar"></i></div><div><span>Debt paydown</span><b class="positive" id="driverDebt">—</b><i id="driverDebtBar"></i></div><div><span>Multiple movement</span><b class="gold" id="driverMultiple">—</b><i class="gold-bar" id="driverMultipleBar"></i></div></div><p class="workspace-note">Drivers are shares of modeled equity value creation; they explain the bridge, not a fee-adjusted attribution.</p></div><div class="formula-box"><span>MOIC = Exit equity / Entry equity · IRR = MOIC<sup>1 / hold</sup> − 1</span><b id="wsMoic">—</b></div>`
  },
  comps: {
    title: 'Comps library',
  description: 'Use a few illustrative peer examples to ask whether the purchase price looks high or low.',
  html: `<div class="workspace-help"><strong>Beginner tip</strong><span>Compare EV / EBITDA first. It tells you how many years of current profit the purchase price represents. These rows are examples, not live market data.</span></div><div class="comps-toolbar"><input id="compsFilter" placeholder="⌕ Filter illustrative companies" aria-label="Filter companies" /><span class="gold mono">ILLUSTRATIVE · NOT MARKET DATA</span></div><div class="comp-table"><div class="comp-head"><span>Company</span><span>EV</span><span>EV / Revenue</span><span>EV / EBITDA</span><span>NTM growth</span></div>${[['Atlas peer A','$1,240','3.1x','11.8x','14.2%'],['Atlas peer B','$860','2.6x','9.4x','11.7%'],['Atlas peer C','$2,410','4.2x','13.1x','18.6%'],['Selected case','$425','2.1x','8.2x','12.0%']].map((r,i)=>`<div class="comp-row ${i===3?'selected-row':''}"><span ${i===3?'data-comp-name':''}>${r[0]}</span><b ${i===3?'data-comp-ev':''}>${r[1]}</b><b>${r[2]}</b><b ${i===3?'data-comp-multiple':''}>${r[3]}</b><b class="${i===3?'gold':''}" ${i===3?'data-comp-growth':''}>${r[4]}</b></div>`).join('')}</div><div class="sanity-card"><strong>Valuation sanity check</strong><span id="compsSanity">—</span><small>Illustrative peer median EV / EBITDA vs active-case entry multiple; not a market conclusion.</small></div>`
  },
  sensitivity: {
    title: 'Sensitivity lab',
  description: 'Change two assumptions at once and see where the return becomes stronger or weaker.',
  html: `<div class="workspace-help"><strong>How to use it</strong><span>Pick a row for the selling multiple and a column for annual profit growth. Green means a higher modeled IRR; darker cells mean a lower one.</span></div><div class="workspace-actions"><button class="button mini" id="exportSensitivity">Export sensitivity CSV ↧</button></div><div class="sensitivity-header"><h3>Gross IRR response surface</h3><span class="workspace-note">Exit EV / EBITDA × annual EBITDA growth · active <span id="sensitivityCaseContext">${escapeHtml(caseLabels[activeCase].name)}</span></span></div><div class="large-surface" id="workspaceSurface"></div><div class="legend"><span>Lower return</span><i></i><span>Higher return</span></div>`
  },
  assumptions: {
    title: 'Assumption sets',
  description: 'Keep three simple stories for the same deal: expected, difficult, and optimistic.',
  html: `<div class="workspace-help"><strong>Think of these as three stories</strong><span>Base is your expected plan. Downside shows what happens if the plan disappoints. Upside shows what happens if execution is stronger.</span></div><div class="assumption-list">${Object.entries(caseLabels).map(([key,label]) => `<button type="button" class="assumption-row ${key===activeCase?'active':''}" data-assumption-case="${key}"><span class="status-dot ${key===activeCase?'':'muted-dot'}"></span><div><strong>${escapeHtml(label.name)} / linked case</strong><small>${escapeHtml(label.description)}</small></div><b>${key===activeCase?'ACTIVE':'LOAD'}</b></button>`).join('')}</div><button class="button primary" id="newCaseBtn">＋ Copy active case</button><p class="workspace-note">Cases are stored locally in this page only. Copy creates a browser-session case; there is no backend persistence.</p>`
  }
};

function updateWorkspaceMetrics() {
  if (!currentModel) return;
  const { ev, ebitda, entryDebt, entryEquity, debtPaydown, exitDebt, exitNetDebt, exitEbitda, exitEquity, entryMultiple, moic, irr } = currentModel;
  [['wsEv', money(ev)], ['wsUses', money(ev)], ['wsDebt', money(entryDebt)], ['wsSponsor', money(entryEquity)], ['wsSources', money(ev)], ['wsLev', mult(entryDebt / ebitda)], ['wsExitLev', mult(exitNetDebt / exitEbitda)], ['wsPaydown', money(debtPaydown)], ['wsExitDebt', money(exitDebt)], ['wsIrr', pct(irr)], ['wsMoic', `${mult(moic)} gross / ${pct(irr)} IRR`]].forEach(([id, value]) => { if ($(id)) $(id).textContent = value; });
  const dcfWaccRaw = $('dcfWacc')?.value ?? dcfState.wacc;
  const dcfGrowthRaw = $('dcfGrowth')?.value ?? dcfState.terminalGrowth;
  const dcfError = M.validateDcf({ wacc: dcfWaccRaw, terminalGrowth: dcfGrowthRaw });
  const dcfAlert = $('dcfAlert');
  if (dcfError) {
    if (dcfAlert) { dcfAlert.hidden = false; dcfAlert.textContent = `${dcfError} Valuation not updated.`; }
    ['dcfPv', 'dcfTerminal', 'dcfEv', 'dcfUpside'].forEach((id) => { if ($(id)) $(id).textContent = '—'; });
    $('dcfWacc')?.setAttribute('aria-invalid', 'true'); $('dcfGrowth')?.setAttribute('aria-invalid', 'true');
  } else {
    dcfState.wacc = Number(dcfWaccRaw); dcfState.terminalGrowth = Number(dcfGrowthRaw);
    $('dcfWacc')?.removeAttribute('aria-invalid'); $('dcfGrowth')?.removeAttribute('aria-invalid');
    if (dcfAlert) { dcfAlert.hidden = true; dcfAlert.textContent = ''; }
    if ($('dcfEv')) {
      // Full five-year horizon regardless of hold period, so the DCF does not change with hold length.
      const fcfs = currentModel.forecastAll.map((row) => row.ebitda * FCF_CONVERSION);
      const d = M.dcf({ fcfs, rate: dcfState.wacc / 100, terminal: { method: 'gordon', growth: dcfState.terminalGrowth / 100 } });
      [['dcfPv', money(d.pvFcf)], ['dcfTerminal', money(d.pvTerminalValue)], ['dcfEv', money(d.enterpriseValue)], ['dcfUpside', signedPct((d.enterpriseValue / ev - 1) * 100)]].forEach(([id, value]) => { if ($(id)) $(id).textContent = value; });
    }
  }
  if ($('driverEbitda')) {
    const a = currentModel.attribution;
    const shares = { ebitda: a.shares.ebitdaGrowth, debt: a.shares.debtPaydown, multiple: a.shares.multiple };
    [['driverEbitda', shares.ebitda], ['driverDebt', shares.debt], ['driverMultiple', shares.multiple]].forEach(([id, value]) => { if ($(id)) $(id).textContent = value === null ? 'n/a' : `${(value * 100).toFixed(0)}%`; });
    [['driverEbitdaBar', shares.ebitda], ['driverDebtBar', shares.debt], ['driverMultipleBar', shares.multiple]].forEach(([id, value]) => { if ($(id)) $(id).style.width = `${value === null ? 0 : Math.max(0, Math.min(100, value * 100))}%`; });
  }
  const selectedRow = document.querySelector('.selected-row');
  if (selectedRow) {
    selectedRow.querySelector('[data-comp-name]')?.replaceChildren(document.createTextNode(caseLabels[activeCase].name));
    selectedRow.querySelector('[data-comp-ev]')?.replaceChildren(document.createTextNode(money(ev)));
    selectedRow.querySelector('[data-comp-multiple]')?.replaceChildren(document.createTextNode(mult(entryMultiple)));
    selectedRow.querySelector('[data-comp-growth]')?.replaceChildren(document.createTextNode(pct(currentModel.growthRate || 0)));
  }
  if ($('compsSanity')) {
    const median = 11.8;
    $('compsSanity').textContent = `Active entry ${mult(entryMultiple)} vs illustrative median ${median.toFixed(1)}x · ${entryMultiple < median ? 'below' : 'above'} median by ${Math.abs(entryMultiple - median).toFixed(1)}x`;
  }
  updateWorkspaceContextLabels();
  renderCockpitSensitivity();
  renderSurface();
  renderValueChart();
}

function renderValueChart() {
  if (!currentModel) return;
  const { entryDebt, ebitda, debtSchedule = [], hold } = currentModel;
  const forecast = currentModel.forecastEbitda || [];
  const values = UI.chartSeries(currentModel, activeChart);
  const labels = UI.chartXLabels(hold);
  const max = Math.max(...values, 1);
  const width = 800;
  const height = 220;
  const points = values.map((value, index) => {
    const x = index * (width / Math.max(values.length - 1, 1));
    const y = height - (Math.max(value, 0) / max) * height;
    return [x, y];
  });
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height + 30} L0,${height + 30} Z`;
  $('chartPath')?.setAttribute('d', line);
  $('chartArea')?.setAttribute('d', area);
  if ($('chartPoints')) $('chartPoints').innerHTML = points.map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="${index === points.length - 1 ? 5 : 3}" />`).join('');
  // One x label per plotted point (entry + each held year), so labels line up with the points.
  if ($('chartX')) $('chartX').innerHTML = labels.map((label) => `<span>${escapeHtml(label)}</span>`).join('');
  $('chartSvg')?.setAttribute('aria-label', UI.chartDescription(activeChart, labels, values));
  if ($('chartSeriesName')) $('chartSeriesName').textContent = `${UI.CHART_SERIES[activeChart] || UI.CHART_SERIES.total} · USD mm`;
  [['chartMax', max], ['chartMidHigh', max * .75], ['chartMid', max * .5], ['chartMidLow', max * .25]].forEach(([id, value]) => { if ($(id)) $(id).textContent = `$${Math.round(value)}`; });
  if ($('debtPaydownMultiple')) {
    const first = entryDebt / ebitda;
    const last = (debtSchedule[forecast.length - 1]?.netDebt ?? entryDebt) / (forecast.at(-1) || ebitda);
    $('debtPaydownMultiple').textContent = `${mult(first)} → ${mult(last)}`;
  }
}

function renderCockpitSensitivity() {
  const surface = $('cockpitSensitivity');
  if (!surface || !currentModel) return;
  const { multiples, growths, values } = generateSensitivity();
  surface.innerHTML = `<div class="heat-row" role="row"><div class="heat-label" role="columnheader">Exit ↓ / g →</div>${growths.map((growth) => `<span role="columnheader">${growth}%</span>`).join('')}</div>${multiples.map((multiple, row) => `<div class="heat-row" role="row"><div class="row-label" role="rowheader">${mult(multiple)}</div>${values[row].map((irr) => `<b class="heat h${UI.heatBucket(irr)}" role="cell">${pct(irr)}</b>`).join('')}</div>`).join('')}`;
}

function updateWorkspaceContextLabels() {
  const name = caseLabels[activeCase]?.name || activeCase;
  const copy = `Linked to active case: ${name}`;
  if ($('lboCaseContext')) $('lboCaseContext').textContent = name;
  if ($('sensitivityCaseContext')) $('sensitivityCaseContext').textContent = name;
  document.querySelectorAll('[data-active-case-copy]').forEach((el) => { el.textContent = copy; });
}

function openWorkspace(view) {
  const data = workspaceData[view];
  if (!data) return;
  $('cockpitWorkspace').hidden = true;
  $('secondaryWorkspace').hidden = false;
  $('workspaceTitle').textContent = data.title;
  $('workspaceDescription').textContent = data.description;
  let workspaceHtml = data.html;
  if (view === 'assumptions') {
    workspaceHtml = `<div class="workspace-help"><strong>Think of these as three stories</strong><span>Base is your expected plan. Downside shows what happens if the plan disappoints. Upside shows what happens if execution is stronger.</span></div><div class="assumption-list">${Object.entries(caseLabels).map(([key, label]) => `<button type="button" class="assumption-row ${key === activeCase ? 'active' : ''}" data-assumption-case="${escapeHtml(key)}"><span class="status-dot ${key === activeCase ? '' : 'muted-dot'}"></span><div><strong>${escapeHtml(label.name)} / linked case</strong><small>${escapeHtml(label.description)}</small></div><b>${key === activeCase ? 'ACTIVE' : 'LOAD'}</b></button>`).join('')}</div><button class="button primary" id="newCaseBtn">＋ Copy active case</button><p class="workspace-note">Cases are stored locally in this page only. Copy creates a browser-session case; there is no backend persistence.</p>`;
  }
  $('workspaceContent').innerHTML = workspaceHtml;
  updateWorkspaceMetrics();
  const filter = $('workspaceContent').querySelector('.comps-toolbar input');
  filter?.addEventListener('input', () => {
    const query = filter.value.toLowerCase();
    $('workspaceContent').querySelectorAll('.comp-row').forEach((row) => {
      row.hidden = !row.textContent.toLowerCase().includes(query);
      row.style.display = row.hidden ? 'none' : '';
    });
  });
  $('workspaceContent').querySelector('#dcfWacc')?.addEventListener('input', () => updateWorkspaceMetrics());
  $('workspaceContent').querySelector('#dcfGrowth')?.addEventListener('input', () => updateWorkspaceMetrics());
  $('workspaceContent').querySelectorAll('[data-assumption-case]').forEach((button) => button.addEventListener('click', () => { selectCase(button.dataset.assumptionCase); openWorkspace('assumptions'); }));
  $('workspaceContent').querySelector('#newCaseBtn')?.addEventListener('click', () => {
    const copyKey = `copy-${Object.keys(caseState).length + 1}`;
    caseState[copyKey] = { ...caseState[activeCase], growth: [...caseState[activeCase].growth], margin: [...caseState[activeCase].margin] };
    caseLabels[copyKey] = { name: `Copy of ${caseLabels[activeCase].name}`, description: 'Local working copy · edit cockpit inputs to diverge' };
    selectCase(copyKey);
    openWorkspace('assumptions');
    showToast(`${caseLabels[copyKey].name} created in this session`);
  });
  $('workspaceContent').querySelector('#refreshLbo')?.addEventListener('click', () => { calculate(); showToast('LBO refreshed from active case'); });
  $('workspaceContent').querySelector('#exportLbo')?.addEventListener('click', () => currentModel ? exportText('lbo-sources-uses.csv', UI.lboCsv(currentModel)) : showToast('Fix the highlighted inputs before exporting'));
  $('workspaceContent').querySelector('#exportSensitivity')?.addEventListener('click', () => exportText('active-case-sensitivity.csv', surfaceCsv()));
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
}

function generateSensitivity(model = currentModel, multiples = [7, 8, 9, 10, 11], growths = [-5, 0, 5, 10, 15, 20, 25]) {
  if (!model) return { multiples, growths, values: [] };
  // Each cell re-runs the debt schedule with constant EBITDA growth g and exit multiple m (see docs/formulas.md).
  const grid = M.sensitivity(model.input, multiples, growths.map((g) => g / 100));
  return { multiples, growths, values: grid.map((row) => row.map((v) => v * 100)) };
}

function renderSurface() {
  const surface = $('workspaceSurface');
  const sensitivity = generateSensitivity();
  if (!surface || !currentModel) return;
  const { multiples, growths, values } = sensitivity;
  surface.innerHTML = `<div class="surface-axis" role="row"><span role="columnheader">Exit EV / EBITDA ↓</span>${growths.map((g) => `<span role="columnheader">${g}% EBITDA growth</span>`).join('')}</div>${multiples.map((multiple, row) => `<div class="surface-row" role="row"><span class="surface-axis-label" role="rowheader">${mult(multiple)}</span>${values[row].map((irr) => `<b class="surface-cell s${UI.heatBucket(irr)}" role="cell">${pct(irr)}</b>`).join('')}</div>`).join('')}`;
  surface.setAttribute('role', 'table');
  surface.setAttribute('aria-label', 'Gross IRR by exit EV / EBITDA (rows) and annual EBITDA growth (columns)');
  surface.dataset.csv = UI.sensitivityCsv(sensitivity);
  document.querySelectorAll('[data-sensitivity-csv]').forEach((hook) => { hook.textContent = surface.dataset.csv; });
  document.querySelectorAll('[data-sensitivity-surface]').forEach((hook) => {
    hook.innerHTML = surface.innerHTML;
    hook.dataset.csv = surface.dataset.csv;
  });
}

function surfaceCsv() { return $('workspaceSurface')?.dataset.csv || ''; }
function exportText(filename, text) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: filename.endsWith('.csv') ? 'text/csv' : 'text/plain' }));
  link.download = filename; link.click(); URL.revokeObjectURL(link.href); showToast(`${filename} exported`);
}

document.querySelectorAll('.nav-item[data-view]').forEach((item) => item.addEventListener('click', () => {
  if (item.dataset.view === 'cockpit') {
    $('secondaryWorkspace').hidden = true;
    $('cockpitWorkspace').hidden = false;
    document.querySelectorAll('.nav-item[data-view]').forEach((nav) => nav.classList.toggle('active', nav === item));
  } else openWorkspace(item.dataset.view);
}));

function wireUiActions() {
  const utilityModal = $('utilityModal');
  const appShell = document.querySelector('.app-shell');
  let utilityTrigger = null;
  const openUtility = (title, description, content, trigger = null) => {
    utilityTrigger = trigger || document.activeElement;
    $('utilityTitle').textContent = title;
    $('utilityDescription').textContent = description;
    $('utilityContent').innerHTML = content;
    utilityModal.hidden = false;
    appShell?.setAttribute('inert', '');
    $('utilityClose').focus();
  };
  const closeUtility = () => {
    utilityModal.hidden = true;
    appShell?.removeAttribute('inert');
    utilityTrigger?.focus();
    utilityTrigger = null;
  };
  $('utilityClose')?.addEventListener('click', closeUtility);
  utilityModal?.addEventListener('click', (event) => { if (event.target === utilityModal) closeUtility(); });
  $('keyboardButton')?.addEventListener('click', (event) => openUtility('Keyboard guide', 'Use these shortcuts to move around the model faster.', '<div class="shortcut-list"><div><kbd>⌘ / Ctrl + 1</kbd><span>Deal cockpit</span></div><div><kbd>⌘ / Ctrl + 2</kbd><span>LBO model</span></div><div><kbd>⌘ / Ctrl + 3</kbd><span>DCF analysis</span></div><div><kbd>⌘ / Ctrl + 4</kbd><span>Returns bridge</span></div><div><kbd>⌘ K</kbd><span>Open this guide</span></div><div><kbd>Esc</kbd><span>Close any open panel</span></div></div>', event.currentTarget));
  $('settingsButton')?.addEventListener('click', (event) => openUtility('Settings', 'Small preferences that make the model easier to work with.', '<div class="settings-list"><label><span><strong>Reduced motion</strong><small>Use fewer interface transitions.</small></span><input id="reducedMotionToggle" type="checkbox"></label><label><span><strong>Show teaching notes</strong><small>Keep the plain-English guidance visible.</small></span><input id="teachingNotesToggle" type="checkbox" checked></label></div>', event.currentTarget));
  $('modelStatusButton')?.addEventListener('click', (event) => openUtility('Model status', 'A quick health check for the active case.', `<div class="status-summary"><div class="status-summary-head"><span class="status-pill"><i></i> ${escapeHtml($('modelStatus').textContent)}</span><small>ACTIVE CASE</small></div><div><span>Active case</span><strong>${escapeHtml(caseLabels[activeCase].name)}</strong></div><div><span>Last calculation</span><strong>${escapeHtml($('lastRun').textContent)}</strong></div><div><span>Data source</span><strong>Local browser inputs</strong></div><p>No live market data or external data feed is connected. Treat outputs as illustrative until assumptions are verified.</p></div>`, event.currentTarget));
  utilityModal?.addEventListener('change', (event) => {
    if (event.target.id === 'reducedMotionToggle') document.documentElement.classList.toggle('reduced-motion', event.target.checked);
    if (event.target.id === 'teachingNotesToggle') document.body.classList.toggle('hide-teaching-notes', !event.target.checked);
  });
  const workspaceSwitcher = $('workspaceSwitcher');
  const workspaceMenu = $('workspaceMenu');
  const workspaceList = $('workspaceList');
  const renderWorkspaces = () => {
    workspaceList.innerHTML = workspaces.map((name) => `<button type="button" class="workspace-option ${name === activeWorkspace ? 'active' : ''}" data-workspace="${escapeHtml(name)}"><span class="status-dot"></span><span>${escapeHtml(name)}</span>${name === activeWorkspace ? '<b>✓</b>' : ''}</button>`).join('');
  };
  renderWorkspaces();
  workspaceSwitcher?.addEventListener('click', () => {
    workspaceMenu.hidden = !workspaceMenu.hidden;
    workspaceSwitcher.setAttribute('aria-expanded', String(!workspaceMenu.hidden));
  });
  $('newWorkspaceBtn')?.addEventListener('click', () => {
    $('workspaceCreate').hidden = false;
    $('workspaceName').focus();
  });
  $('createWorkspaceBtn')?.addEventListener('click', () => {
    const name = $('workspaceName').value.trim() || `Project ${workspaces.length + 1}`;
    if (workspaces.includes(name)) { showToast('That workspace already exists — choose a different name'); return; }
    workspaces.push(name);
    activeWorkspace = name;
    $('workspaceSwitcher').querySelector('strong').textContent = name;
    $('workspaceName').value = '';
    $('workspaceCreate').hidden = true;
    renderWorkspaces();
    workspaceMenu.hidden = true;
    workspaceSwitcher.setAttribute('aria-expanded', 'false');
    showToast(`${name} workspace created`);
  });
  document.addEventListener('click', (event) => {
    if (workspaceMenu.hidden || event.target.closest('#workspaceMenu, #workspaceSwitcher')) return;
    workspaceMenu.hidden = true;
    workspaceSwitcher.setAttribute('aria-expanded', 'false');
  });
  workspaceList?.addEventListener('click', (event) => {
    const option = event.target.closest('[data-workspace]');
    if (!option) return;
    activeWorkspace = option.dataset.workspace;
    $('workspaceSwitcher').querySelector('strong').textContent = activeWorkspace;
    renderWorkspaces();
    workspaceMenu.hidden = true;
    workspaceSwitcher.setAttribute('aria-expanded', 'false');
    showToast(`${activeWorkspace} workspace selected`);
  });
  document.querySelectorAll('.segmented button:not(.add-case)').forEach((button) => button.addEventListener('click', () => {
    selectCase(button.dataset.case);
    document.querySelectorAll('.segmented button').forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
    document.querySelectorAll('.segmented button[data-case]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    showToast(`${button.textContent.trim()} loaded`);
  }));
  document.querySelectorAll('.more-button').forEach((button) => button.addEventListener('click', () => showToast('No additional actions for this section yet')));
  document.querySelectorAll('.chart-filter').forEach((button) => button.addEventListener('click', () => {
    activeChart = button.dataset.chart || 'total';
    document.querySelectorAll('.chart-filter').forEach((item) => item.classList.remove('active'));
    document.querySelectorAll('.chart-filter').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    button.classList.add('active');
    renderValueChart();
    showToast(`${button.textContent} view selected`);
  }));
  document.querySelector('.segmented .add-case')?.addEventListener('click', () => showToast('Open Assumption sets to create a named case'));
  document.querySelector('.full-link')?.addEventListener('click', () => showToast('IC prep is a checklist prompt — complete the open items above'));
  document.querySelector('.command-trigger')?.addEventListener('click', () => $('keyboardButton')?.click());
  document.querySelector('[aria-label="Notifications"]')?.addEventListener('click', () => showToast('No new notifications'));
  document.querySelector('[aria-label="Search"]')?.addEventListener('click', () => showToast('Search is not connected yet — use the workspace navigation'));
  document.querySelectorAll('.sidebar-bottom .nav-item').forEach((button) => button.addEventListener('click', () => showToast(button.textContent.includes('Settings') ? 'Settings panel ready' : '⌘1–⌘4 switch workspaces')));
  document.querySelectorAll('.checklist input').forEach((input) => input.addEventListener('change', updateReadiness));
}

function updateReadiness() {
  const checks = [...document.querySelectorAll('.checklist input')];
  const complete = checks.filter((input) => input.checked).length;
  $('readiness').textContent = `${Math.round((complete / Math.max(checks.length, 1)) * 100)}% user verified`;
  document.querySelectorAll('.checklist label').forEach((label) => {
    const input = label.querySelector('input');
    const status = label.querySelector('em');
    if (status) {
      status.textContent = input.checked ? 'Done' : 'Open';
      status.classList.toggle('pending', !input.checked);
    }
  });
}

function saveCase(key = activeCase) {
  caseState[key] = {
    ...caseState[key],
    ...Object.fromEntries(inputs.map((id) => [id, $(id).value])),
    growth: [...document.querySelectorAll('[data-key="growth"]')].map((el) => el.value),
    margin: [...document.querySelectorAll('[data-key="margin"]')].map((el) => el.value)
  };
}

function selectCase(key) {
  if (!caseState[key]) return;
  saveCase();
  activeCase = key;
  const selected = caseState[key];
  inputs.forEach((id) => { $(id).value = selected[id]; });
  document.querySelectorAll('[data-key="growth"]').forEach((el, i) => { el.value = selected.growth[i]; });
  document.querySelectorAll('[data-key="margin"]').forEach((el, i) => { el.value = selected.margin[i]; });
  const context = $('caseContext');
  if (context) context.innerHTML = `<strong>${caseLabels[key].name}</strong><span>${caseLabels[key].description}</span>`;
  $('activeCaseStatus').textContent = caseLabels[key].name.toUpperCase();
  calculate();
}

wireUiActions();
document.addEventListener('keydown', (event) => {
  const modal = $('utilityModal');
  if (!modal.hidden && event.key === 'Tab') {
    const focusable = [...modal.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])')].filter((element) => !element.disabled);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }
  if (event.key === 'Escape') {
    if (!modal.hidden) {
      modal.querySelector('#utilityClose')?.click();
    }
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    $('keyboardButton')?.click();
    return;
  }
  if (!(event.metaKey || event.ctrlKey)) return;
  const routes = { '1': 'cockpit', '2': 'lbo', '3': 'dcf', '4': 'returns' };
  const view = routes[event.key];
  if (!view) return;
  event.preventDefault();
  const target = document.querySelector(`.nav-item[data-view="${view}"]`);
  target?.click();
});

// Illustrative envelope: fixed offsets around the point estimate (ui-helpers.js). NOT a statistical distribution.
function updateEnvelope(base) {
  const env = UI.envelope(base);
  $('p10').textContent = pct(env.lower);
  $('p50').textContent = pct(env.base);
  $('p90').textContent = pct(env.higher);
  const scale = UI.envelopeScale(env);
  if ($('rangeStrip')) $('rangeStrip').classList.toggle('empty', !scale);
  if (!scale) return;
  [['rangeLower', scale.lower], ['rangeBase', scale.base], ['rangeHigher', scale.higher]].forEach(([id, left]) => { if ($(id)) $(id).style.left = `${left}%`; });
  if ($('rangeSpan')) { $('rangeSpan').style.left = `${scale.lower}%`; $('rangeSpan').style.width = `${scale.higher - scale.lower}%`; }
  if ($('rangeMin')) $('rangeMin').textContent = pct(scale.min);
  if ($('rangeMax')) $('rangeMax').textContent = pct(scale.max);
}
const outputIds = ['entryMultiple', 'entryEquity', 'exitEquity', 'valueCreation', 'moic', 'irr', 'exitMultiple', 'tapeEntry', 'tapeLeverage', 'tapeIrr', 'tapeMoic', 'tapeExit', 'bridgeEntry', 'bridgeDebt', 'bridgeEbitda', 'bridgeMultiple', 'bridgeExit', 'debtPaydownMultiple'];
function clearOutputs() {
  outputIds.forEach((id) => { if ($(id)) $(id).textContent = '—'; });
  for (let i = 0; i < 5; i += 1) ['debtOpen', 'debtSweep', 'debtClose', 'debtLev'].forEach((k) => { if ($(`${k}${i}`)) $(`${k}${i}`).textContent = '—'; });
  ['wsEv', 'wsUses', 'wsDebt', 'wsSponsor', 'wsSources', 'wsLev', 'wsExitLev', 'wsPaydown', 'wsExitDebt', 'wsIrr', 'wsMoic', 'dcfPv', 'dcfTerminal', 'dcfEv', 'dcfUpside', 'driverEbitda', 'driverDebt', 'driverMultiple', 'compsSanity'].forEach((id) => { if ($(id)) $(id).textContent = '—'; });
  ['chartPath', 'chartArea'].forEach((id) => $(id)?.setAttribute('d', ''));
  if ($('chartPoints')) $('chartPoints').innerHTML = '';
  ['workspaceSurface', 'cockpitSensitivity'].forEach((id) => { if ($(id)) { $(id).innerHTML = '<p class="workspace-note">Fix the highlighted input to see this table.</p>'; if ($(id).dataset) $(id).dataset.csv = ''; } });
}

// Keeps the ticker and the sidebar status in step (the sidebar previously always read "Input checks pass").
function setModelStatus(text, level) {
  if ($('modelStatus')) $('modelStatus').textContent = text;
  const sidebar = $('modelStatusButton');
  const label = sidebar?.querySelector('strong');
  if (label) label.textContent = text.charAt(0) + text.slice(1).toLowerCase();
  [sidebar, $('modelStatus')?.closest('div')].forEach((el) => {
    if (!el) return;
    el.classList.toggle('status-warn', level === 'warn');
    el.classList.toggle('status-error', level === 'error');
  });
}

const fieldIds = { ev: 'ev', ebitda: 'ebitda', debtMultiple: 'debtMultiple', interest: 'interest', hold: 'hold', exitMultiple: 'exitIn' };

function calculate() {
  const alert = $('modelAlert');
  const raw = {
    ev: $('ev').value, ebitda: $('ebitda').value, debtMultiple: $('debtMultiple').value, interest: $('interest').value,
    hold: $('hold').value, exitMultiple: $('exitIn').value,
    growth: [...document.querySelectorAll('[data-key="growth"]')].map((el) => el.value),
    margin: [...document.querySelectorAll('[data-key="margin"]')].map((el) => el.value)
  };
  const { errors, input } = M.validateDeal(raw);
  const markValid = (el) => { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); };
  const markInvalid = (el) => { if (!el) return; el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', 'modelAlert'); };
  inputs.forEach((id) => markValid($(id)));
  document.querySelectorAll('.mini-input').forEach(markValid);
  let result = null;
  if (!errors.length) {
    try { result = M.lbo(input); } catch (error) {
      if (!(error instanceof M.ModelError)) throw error;
      errors.push({ field: 'model', message: error.message });
    }
  }
  if (errors.length) {
    errors.forEach((e) => {
      if (fieldIds[e.field]) markInvalid($(fieldIds[e.field]));
      if (e.index !== undefined) markInvalid(document.querySelectorAll(`[data-key="${e.field}"]`)[e.index]);
    });
    if (alert) { alert.hidden = false; alert.textContent = errors.map((e) => e.message).join(' '); }
    clearOutputs();
    updateEnvelope(NaN);
    currentModel = null;
    $('radial').style.background = 'conic-gradient(#253541 0 100%)';
    setModelStatus('NEEDS ATTENTION', 'error');
    return;
  }
  const notes = [];
  if (result.wipedOut) notes.push('At this exit multiple the sale price does not cover net debt: equity is wiped out (0.0x, -100%).');
  if (result.shortfall) notes.push('Cash flow does not cover interest and mandatory repayment in at least one year; the shortfall is assumed drawn on the debt facility.');
  if (alert) { alert.hidden = !notes.length; alert.textContent = notes.join(' '); }
  setModelStatus(notes.length ? 'CHECK WARNINGS' : 'INPUT CHECKS PASS', notes.length ? 'warn' : 'ok');
  const { ev, ebitda, hold } = input;
  const irrPct = result.irr * 100;
  result.schedule.forEach((row, year) => {
    const repaid = row.openingDebt - row.closingDebt;
    $(`debtOpen${year}`).textContent = money(row.openingDebt);
    $(`debtSweep${year}`).textContent = repaid >= 0 ? `(${money(repaid)})` : `+${money(-repaid)}`;
    $(`debtClose${year}`).textContent = money(row.closingDebt);
    $(`debtLev${year}`).textContent = mult(row.netLeverage);
    const tableRow = $(`debtOpen${year}`).closest('.debt-row');
    if (tableRow) {
      const afterExit = year >= hold;
      tableRow.classList.toggle('post-exit', afterExit);
      if (afterExit) tableRow.title = 'After the exit year: shown for reference, does not affect returns'; else tableRow.removeAttribute('title');
    }
  });
  $('entryMultiple').innerHTML = `${mult(result.entryMultiple)} <span>↗</span>`;
  $('entryEquity').textContent = money(result.entryEquity);
  $('exitEquity').textContent = money(result.exitEquity);
  $('valueCreation').textContent = `${result.valueCreation >= 0 ? '+' : ''}${money(result.valueCreation)}`;
  $('moic').textContent = mult(result.moic);
  $('irr').textContent = pct(irrPct);
  $('exitMultiple').textContent = mult(result.exitMultiple);
  const delta = result.exitMultiple - result.entryMultiple;
  if ($('exitExpansion')) $('exitExpansion').textContent = Math.abs(delta) < 0.05 ? 'no multiple expansion' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}x vs entry`;
  [['tapeEntry', mult(result.entryMultiple)], ['tapeLeverage', mult(input.debtMultiple)], ['tapeIrr', pct(irrPct)], ['tapeMoic', mult(result.moic)], ['tapeExit', mult(result.exitMultiple)]].forEach(([id, value]) => { if ($(id)) $(id).textContent = value; });
  const a = result.attribution;
  const bridge = { entry: result.entryEquity, debt: a.debtPaydown, ebitda: a.ebitdaGrowth, multiple: a.multiple, exit: result.exitEquity };
  const bridgeMax = Math.max(bridge.exit, bridge.entry, 1);
  [['Entry', bridge.entry], ['Debt', bridge.debt], ['Ebitda', bridge.ebitda], ['Multiple', bridge.multiple], ['Exit', bridge.exit]].forEach(([name, value]) => {
    const bar = $(`bar${name}`);
    const label = $(`bridge${name}`);
    if (bar) bar.style.height = `${Math.max(8, (Math.max(value, 0) / bridgeMax) * 100)}%`;
    if (label) label.textContent = money(value);
  });
  currentModel = {
    input, ev, ebitda, entryDebt: result.entryDebt, entryEquity: result.entryEquity, debtPaydown: result.debtPaydown,
    exitDebt: result.exitDebt, exitNetDebt: result.exitNetDebt, exitEbitda: result.exitEbitda, exitEv: result.exitEv, exitEquity: result.exitEquity,
    entryMultiple: result.entryMultiple, exitMultiple: result.exitMultiple, moic: result.moic, irr: irrPct, hold, interest: input.interest * 100,
    growthRate: input.growth[0] * 100, attribution: a, debtSchedule: result.schedule, forecastAll: result.forecast,
    forecastEbitda: result.forecast.slice(0, hold).map((row) => row.ebitda), notes
  };
  const fill = Math.max(0, Math.min(irrPct * 3.2, 96));
  $('radial').style.background = `conic-gradient(var(--mint) 0 ${fill}%, #253541 ${fill}% 100%)`;
  $('lastRun').textContent = `Today · ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}`;
  updateEnvelope(irrPct);
  updateWorkspaceMetrics();
}

function showToast(message) {
  const toast = $('toast');
  toast.firstChild.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2400);
}

inputs.forEach((id) => $(id).addEventListener('input', calculate));
document.querySelectorAll('.mini-input').forEach((input) => input.addEventListener('input', calculate));
$('runBtn').addEventListener('click', () => { calculate(); showToast('Model recalculated'); });
$('resetBtn').addEventListener('click', () => {
  selectCase('base');
  document.querySelectorAll('.segmented button').forEach((item) => item.classList.toggle('selected', item.dataset.case === 'base'));
  document.querySelectorAll('.segmented button[data-case]').forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.case === 'base')));
  updateReadiness();
  showToast('Base case restored — model recalculated');
});
$('exportBtn').addEventListener('click', () => {
  const m = currentModel;
  if (!m) { showToast('Fix the highlighted inputs before exporting'); return; }
  const memo = UI.summaryText(m, caseLabels[activeCase].name, m.notes);
  const blob = new Blob([memo], {type: 'text/plain'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'project-atlas-deal-summary.txt';
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Deal summary exported');
});
$('downloadBtn').addEventListener('click', () => {
  if (!currentModel) { showToast('Fix the highlighted inputs before exporting'); return; }
  const csv = UI.sensitivityCsv(generateSensitivity());
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  link.download = 'atlas-irr-sensitivity.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Sensitivity CSV downloaded');
});
$('scenarioBtn').addEventListener('click', () => {
  const start = performance.now();
  $('scenarioStatus').textContent = 'building deterministic illustrative return envelope…';
  $('scenarioBtn').disabled = true;
  window.setTimeout(() => {
    const base = currentModel ? currentModel.irr : NaN;
    if (!isNum(base)) { $('scenarioStatus').textContent = 'fix the highlighted inputs first'; $('scenarioBtn').disabled = false; return; }
    updateEnvelope(base);
    $('scenarioStatus').textContent = `complete · illustrative range · ${((performance.now() - start) / 1000).toFixed(2)}s`;
    $('scenarioBtn').disabled = false;
    showToast('Scenario envelope refreshed');
  }, 650);
});
calculate();
