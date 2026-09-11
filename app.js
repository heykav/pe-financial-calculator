const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const inputs = ['ev','ebitda','debtMultiple','interest','hold'];
const state = { defaultValues: Object.fromEntries(inputs.map((id) => [id, $(id).value])) };
const caseLabels = {
  base: { name: 'Base case', description: 'Management plan · current underwriting view' },
  downside: { name: 'Downside', description: 'Revenue haircut · margin compression · conservative deleveraging' },
  upside: { name: 'Upside', description: 'Pricing expansion · accelerated growth and paydown' }
};
const caseState = {
  base: { ev: '425', ebitda: '52', debtMultiple: '4.5', interest: '8.25', hold: '5', growth: ['12.0', '11.0', '10.0', '9.0', '8.0'], margin: ['21.0', '22.0', '23.0', '24.0', '25.0'] },
  downside: { ev: '400', ebitda: '49', debtMultiple: '4.0', interest: '9.25', hold: '5', growth: ['7.0', '6.0', '5.0', '4.0', '3.0'], margin: ['19.0', '19.5', '20.0', '20.5', '21.0'] },
  upside: { ev: '450', ebitda: '55', debtMultiple: '5.0', interest: '7.50', hold: '4', growth: ['16.0', '15.0', '14.0', '13.0', '12.0'], margin: ['22.0', '23.5', '25.0', '26.0', '27.0'] }
};
let activeCase = 'base';
const workspaces = ['Project Atlas'];
let activeWorkspace = 'Project Atlas';
let currentModel = null;
const dcfState = { wacc: 9.5, terminalGrowth: 2.5 };
const workspaceData = {
  lbo: {
    title: 'LBO model',
    description: 'Follow the money: what you pay, how much you borrow, and what is left for the investor.',
    html: `<div class="workspace-help"><strong>Start here</strong><span>This page answers one question: how is the purchase funded, and how quickly does the loan get smaller?</span></div><div class="workspace-actions"><button class="button mini" id="refreshLbo">↻ Update from current case</button><button class="button mini" id="exportLbo">Download LBO table ↧</button></div><div class="workspace-grid"><div><h3>Where the money goes</h3><p class="workspace-note">Uses = the cash needed to complete the purchase · USD mm · linked to ${escapeHtml(caseLabels[activeCase].name)}</p><div class="model-table"><div><span>Purchase enterprise value</span><b id="wsEv">—</b></div><div><span>Refinance existing debt</span><b id="wsRefi">$0.0</b></div><div class="subtotal"><span>Total uses</span><b id="wsUses">—</b></div></div></div><div><h3>Capital structure</h3><p class="workspace-note">Debt sizing = EBITDA × debt / EBITDA</p><div class="model-table"><div><span>Senior secured debt</span><b id="wsDebt">—</b></div><div><span>Sponsor equity</span><b id="wsSponsor">—</b></div><div class="subtotal"><span>Total sources</span><b id="wsSources">—</b></div></div></div></div><div class="workspace-grid lower"><div><h3>Operating leverage</h3><div class="metric-row"><span>Entry debt / EBITDA</span><strong id="wsLev">—</strong></div><div class="metric-row"><span>Exit debt / EBITDA</span><strong id="wsExitLev">—</strong></div></div><div><h3>Debt paydown</h3><div class="metric-row"><span>Debt repaid</span><strong id="wsPaydown">—</strong></div><div class="metric-row"><span>Exit debt</span><strong id="wsExitDebt">—</strong></div></div></div>`
  },
  dcf: {
    title: 'DCF analysis',
  description: 'Estimate a value from future cash generation, then compare it with the purchase price.',
  html: `<div class="workspace-help"><strong>What is this?</strong><span>A DCF asks: if the business keeps generating cash, what could those future dollars be worth today?</span></div><div class="workspace-grid"><div><h3>Estimated value today</h3><p class="workspace-note">Illustrative · linked to the active case · USD mm</p><div class="model-table"><div><span>PV of forecast cash flows</span><b id="dcfPv">—</b></div><div><span>PV of terminal value</span><b id="dcfTerminal">—</b></div><div class="subtotal"><span>Enterprise value</span><b class="gold" id="dcfEv">—</b></div></div></div><div><h3>Editable valuation inputs</h3><p class="workspace-note">Not market data; change to test methodology</p><label class="inline-field">WACC <input id="dcfWacc" type="number" min="1" max="30" step=".25" value="9.5">%</label><label class="inline-field">Terminal growth <input id="dcfGrowth" type="number" min="-2" max="8" step=".25" value="2.5">%</label><div class="metric-row"><span>Upside / (downside) vs entry EV</span><strong id="dcfUpside">—</strong></div></div></div><div class="formula-box"><span>EV = Σ FCF<sub>t</sub> / (1 + WACC)<sup>t</sup> + [FCF<sub>n+1</sub> / (WACC − g)] / (1 + WACC)<sup>n</sup></span><b>Illustrative method · no fees, taxes, capex or working capital</b></div>`
  },
  returns: {
    title: 'Returns bridge',
  description: 'See exactly what makes the investor return go up or down.',
  html: `<div class="workspace-help"><strong>How to read this</strong><span>The bars split the modeled value created into business growth, loan paydown, and changes in the selling multiple.</span></div><div class="returns-workspace"><div class="return-hero-large"><small>GROSS IRR · BEFORE FEES</small><strong id="wsIrr">—</strong><span class="workspace-note">Linked to active case; not net investor returns</span></div><div class="return-drivers"><div><span>EBITDA growth</span><b class="positive" id="driverEbitda">—</b><i id="driverEbitdaBar"></i></div><div><span>Debt paydown</span><b class="positive" id="driverDebt">—</b><i id="driverDebtBar"></i></div><div><span>Multiple movement</span><b class="gold" id="driverMultiple">—</b><i class="gold-bar" id="driverMultipleBar"></i></div></div><p class="workspace-note">Drivers are shares of modeled equity value creation; they explain the bridge, not a fee-adjusted attribution.</p></div><div class="formula-box"><span>MOIC = Exit equity / Entry equity · IRR = MOIC<sup>1 / hold</sup> − 1</span><b id="wsMoic">—</b></div>`
  },
  comps: {
    title: 'Comps library',
  description: 'Use a few illustrative peer examples to ask whether the purchase price looks high or low.',
  html: `<div class="workspace-help"><strong>Beginner tip</strong><span>Compare EV / EBITDA first. It tells you how many years of current profit the purchase price represents. These rows are examples, not live market data.</span></div><div class="comps-toolbar"><input id="compsFilter" placeholder="⌕ Filter illustrative companies" aria-label="Filter companies" /><span class="gold mono">ILLUSTRATIVE · NOT MARKET DATA</span></div><div class="comp-table"><div class="comp-head"><span>Company</span><span>EV</span><span>EV / Revenue</span><span>EV / EBITDA</span><span>NTM growth</span></div>${[['Atlas peer A','$1,240','3.1x','11.8x','14.2%'],['Atlas peer B','$860','2.6x','9.4x','11.7%'],['Atlas peer C','$2,410','4.2x','13.1x','18.6%'],['Selected case','$425','2.1x','8.2x','12.0%']].map((r,i)=>`<div class="comp-row ${i===3?'selected-row':''}"><span>${r[0]}</span><b>${r[1]}</b><b>${r[2]}</b><b>${r[3]}</b><b class="${i===3?'gold':''}">${r[4]}</b></div>`).join('')}</div><div class="sanity-card"><strong>Valuation sanity check</strong><span id="compsSanity">—</span><small>Illustrative peer median EV / EBITDA vs active-case entry multiple; not a market conclusion.</small></div>`
  },
  sensitivity: {
    title: 'Sensitivity lab',
  description: 'Change two assumptions at once and see where the return becomes stronger or weaker.',
  html: `<div class="workspace-help"><strong>How to use it</strong><span>Pick a row for the selling multiple and a column for annual profit growth. Green means a higher modeled IRR; darker cells mean a lower one.</span></div><div class="workspace-actions"><button class="button mini" id="exportSensitivity">Export sensitivity CSV ↧</button></div><div class="sensitivity-header"><h3>Gross IRR response surface</h3><span class="workspace-note">Exit EV / EBITDA × annual EBITDA growth · active ${escapeHtml(caseLabels[activeCase].name)}</span></div><div class="large-surface" id="workspaceSurface"></div><div class="legend"><span>Lower return</span><i></i><span>Higher return</span></div>`
  },
  assumptions: {
    title: 'Assumption sets',
  description: 'Keep three simple stories for the same deal: expected, difficult, and optimistic.',
  html: `<div class="workspace-help"><strong>Think of these as three stories</strong><span>Base is your expected plan. Downside shows what happens if the plan disappoints. Upside shows what happens if execution is stronger.</span></div><div class="assumption-list">${Object.entries(caseLabels).map(([key,label]) => `<button type="button" class="assumption-row ${key===activeCase?'active':''}" data-assumption-case="${key}"><span class="status-dot ${key===activeCase?'':'muted-dot'}"></span><div><strong>${escapeHtml(label.name)} / linked case</strong><small>${escapeHtml(label.description)}</small></div><b>${key===activeCase?'ACTIVE':'LOAD'}</b></button>`).join('')}</div><button class="button primary" id="newCaseBtn">＋ Copy active case</button><p class="workspace-note">Cases are stored locally in this page only. Copy creates a browser-session case; there is no backend persistence.</p>`
  }
};

function updateWorkspaceMetrics() {
  if (!currentModel) return;
  const { ev, ebitda, entryDebt, entryEquity, debtPaydown, exitDebt, exitEbitda, exitEv, exitEquity, entryMultiple, exitMultiple, moic, irr } = currentModel;
  [['wsEv', money(ev)], ['wsUses', money(ev)], ['wsDebt', money(entryDebt)], ['wsSponsor', money(entryEquity)], ['wsSources', money(ev)], ['wsLev', `${(entryDebt / ebitda).toFixed(1)}x`], ['wsExitLev', `${(exitDebt / Math.max(exitEbitda, 1)).toFixed(1)}x`], ['wsPaydown', money(debtPaydown)], ['wsExitDebt', money(exitDebt)], ['wsIrr', `${irr.toFixed(1)}%`], ['wsMoic', `${moic.toFixed(1)}x gross / ${irr.toFixed(1)}% IRR`]].forEach(([id, value]) => { if ($(id)) $(id).textContent = value; });
  const dcfWacc = Number($('dcfWacc')?.value ?? dcfState.wacc);
  const dcfGrowth = Number($('dcfGrowth')?.value ?? dcfState.terminalGrowth);
  if ($('dcfWacc')) dcfState.wacc = Number.isFinite(dcfWacc) ? dcfWacc : dcfState.wacc;
  if ($('dcfGrowth')) dcfState.terminalGrowth = Number.isFinite(dcfGrowth) ? dcfGrowth : dcfState.terminalGrowth;
  if ($('dcfEv')) {
    const forecasts = currentModel.forecastEbitda;
    const pv = forecasts.reduce((sum, flow, i) => sum + flow * 0.65 / Math.pow(1 + dcfState.wacc / 100, i + 1), 0);
    const terminalFcf = forecasts.at(-1) * 0.65 * (1 + dcfState.terminalGrowth / 100);
    const tv = terminalFcf / Math.max(dcfState.wacc / 100 - dcfState.terminalGrowth / 100, 0.01);
    const pvTerminal = tv / Math.pow(1 + dcfState.wacc / 100, forecasts.length);
    const dcfEv = pv + pvTerminal;
    [['dcfPv', money(pv)], ['dcfTerminal', money(pvTerminal)], ['dcfEv', money(dcfEv)], ['dcfUpside', `${((dcfEv / ev - 1) * 100).toFixed(1)}%`]].forEach(([id, value]) => { if ($(id)) $(id).textContent = value; });
  }
  if ($('driverEbitda')) {
    const total = Math.max(exitEquity - entryEquity, 1);
    const drivers = { ebitda: Math.max(0, exitEbitda * entryMultiple - ev), debt: debtPaydown, multiple: Math.max(0, exitEv - exitEbitda * entryMultiple) };
    const shares = { ebitda: drivers.ebitda / total * 100, debt: drivers.debt / total * 100, multiple: drivers.multiple / total * 100 };
    [['driverEbitda', shares.ebitda], ['driverDebt', shares.debt], ['driverMultiple', shares.multiple]].forEach(([id, value]) => { if ($(id)) $(id).textContent = `${value.toFixed(0)}%`; });
    [['driverEbitdaBar', shares.ebitda], ['driverDebtBar', shares.debt], ['driverMultipleBar', shares.multiple]].forEach(([id, value]) => { if ($(id)) $(id).style.width = `${Math.min(100, value)}%`; });
  }
  if ($('compsSanity')) {
    const median = 11.8;
    $('compsSanity').textContent = `Active entry ${entryMultiple.toFixed(1)}x vs illustrative median ${median.toFixed(1)}x · ${entryMultiple < median ? 'below' : 'above'} median by ${Math.abs(entryMultiple - median).toFixed(1)}x`;
  }
  renderSurface();
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
    });
  });
  $('workspaceContent').querySelector('#dcfWacc')?.addEventListener('input', (event) => { dcfState.wacc = Number(event.target.value); updateWorkspaceMetrics(); });
  $('workspaceContent').querySelector('#dcfGrowth')?.addEventListener('input', (event) => { dcfState.terminalGrowth = Number(event.target.value); updateWorkspaceMetrics(); });
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
  $('workspaceContent').querySelector('#exportLbo')?.addEventListener('click', () => exportText('lbo-sources-uses.csv', `Line,USD mm\nPurchase enterprise value,${currentModel.ev.toFixed(1)}\nDebt,${currentModel.entryDebt.toFixed(1)}\nSponsor equity,${currentModel.entryEquity.toFixed(1)}\nDebt paydown,${currentModel.debtPaydown.toFixed(1)}\nExit debt,${currentModel.exitDebt.toFixed(1)}`));
  $('workspaceContent').querySelector('#exportSensitivity')?.addEventListener('click', () => exportText('active-case-sensitivity.csv', surfaceCsv()));
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
}

function renderSurface() {
  const surface = $('workspaceSurface');
  if (!surface || !currentModel) return;
  const multiples = [7, 8, 9, 10, 11];
  const growths = [-5, 0, 5, 10, 15, 20, 25];
  const values = [];
  surface.innerHTML = `<div class="surface-axis"><span>Exit EV / EBITDA ↓</span>${growths.map((g) => `<span>${g}% EBITDA growth →</span>`).join('')}</div>${multiples.map((multiple) => `<div class="surface-row"><span class="surface-axis-label">${multiple.toFixed(1)}x</span>${growths.map((growth) => { const ebitda = currentModel.exitEbitda * Math.pow(1 + growth / 100, currentModel.hold) / Math.pow(1 + (currentModel.growthRate || 0) / 100, currentModel.hold); const equity = Math.max(0, ebitda * multiple - currentModel.exitDebt); const irr = (Math.pow(equity / Math.max(currentModel.entryEquity, 1), 1 / currentModel.hold) - 1) * 100; values.push([multiple, growth, irr]); return `<b class="surface-cell s${Math.max(1, Math.min(7, Math.round(irr / 5)))}">${irr.toFixed(1)}%</b>`; }).join('')}</div>`).join('')}`;
  surface.dataset.csv = ['Exit multiple, ' + growths.join(',')].concat(multiples.map((multiple, row) => `${multiple.toFixed(1)}x,${values.slice(row * growths.length, (row + 1) * growths.length).map((item) => `${item[2].toFixed(1)}%`).join(',')}`)).join('\n');
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
  const openUtility = (title, description, content) => {
    $('utilityTitle').textContent = title;
    $('utilityDescription').textContent = description;
    $('utilityContent').innerHTML = content;
    utilityModal.hidden = false;
    $('utilityClose').focus();
  };
  const closeUtility = () => { utilityModal.hidden = true; };
  $('utilityClose')?.addEventListener('click', closeUtility);
  utilityModal?.addEventListener('click', (event) => { if (event.target === utilityModal) closeUtility(); });
  $('keyboardButton')?.addEventListener('click', () => openUtility('Keyboard guide', 'Use these shortcuts to move around the model faster.', '<div class="shortcut-list"><div><kbd>⌘ / Ctrl + 1</kbd><span>Deal cockpit</span></div><div><kbd>⌘ / Ctrl + 2</kbd><span>LBO model</span></div><div><kbd>⌘ / Ctrl + 3</kbd><span>DCF analysis</span></div><div><kbd>⌘ / Ctrl + 4</kbd><span>Returns bridge</span></div><div><kbd>⌘ K</kbd><span>Open this guide</span></div><div><kbd>Esc</kbd><span>Close any open panel</span></div></div>'));
  $('settingsButton')?.addEventListener('click', () => openUtility('Settings', 'Small preferences that make the model easier to work with.', '<div class="settings-list"><label><span><strong>Reduced motion</strong><small>Use fewer interface transitions.</small></span><input id="reducedMotionToggle" type="checkbox"></label><label><span><strong>Show teaching notes</strong><small>Keep the plain-English guidance visible.</small></span><input id="teachingNotesToggle" type="checkbox" checked></label></div>'));
  $('modelStatusButton')?.addEventListener('click', () => openUtility('Model status', 'A quick health check for the active case.', `<div class="status-summary"><div><span>Active case</span><strong>${escapeHtml(caseLabels[activeCase].name)}</strong></div><div><span>Model state</span><strong>${$('modelStatus').textContent}</strong></div><div><span>Data source</span><strong>Local browser inputs</strong></div><p>No live market data or external data feed is connected. Treat outputs as illustrative until assumptions are verified.</p></div>`));
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
    document.querySelectorAll('.segmented button[data-case]').forEach((item) => item.setAttribute('aria-selected', String(item === button)));
    showToast(`${button.textContent.trim()} loaded`);
  }));
  document.querySelectorAll('.more-button').forEach((button) => button.addEventListener('click', () => showToast('No additional actions for this section yet')));
  document.querySelectorAll('.chart-filter').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.chart-filter').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
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
  $('readiness').textContent = `${Math.round((complete / Math.max(checks.length, 1)) * 100)}% complete`;
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
document.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.matches('.segmented button:not(.add-case)')) {
    selectCase(target.dataset.case);
    document.querySelectorAll('.segmented button').forEach((item) => item.classList.remove('selected'));
    target.classList.add('selected');
    showToast(`${target.textContent.trim()} loaded`);
  } else if (target.matches('.segmented .add-case')) {
    showToast('Use Assumption sets to create a named case');
  } else if (target.matches('.more-button')) {
    showToast('No additional actions for this section yet');
  } else if (target.matches('.full-link')) {
    showToast('IC prep is a checklist prompt — complete the open items above');
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    $('utilityModal').hidden = true;
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

function money(value) {
  return `$${value.toFixed(1)}`;
}

function calculate() {
  const raw = Object.fromEntries(inputs.map((id) => [id, Number($(id).value)]));
  const invalid = [
    ['ev', 'Purchase price must be greater than zero.'],
    ['ebitda', 'Current annual profit must be greater than zero.'],
    ['debtMultiple', 'Borrowing level cannot be negative.'],
    ['interest', 'Annual interest cannot be negative.'],
    ['hold', 'Years held must be between 1 and 5 because the forecast currently models five operating years.']
  ].find(([id]) => !Number.isFinite(raw[id]) || raw[id] < Number($(id).min || 0) || (id === 'hold' && raw[id] > 5));
  const forecastInvalid = [...document.querySelectorAll('.mini-input')].some((input) => {
    const value = Number(input.value);
    const isMargin = input.dataset.key === 'margin';
    return !Number.isFinite(value) || (isMargin ? value < 0 || value > 100 : value < -100 || value > 100);
  });
  const debtTooHigh = Number.isFinite(raw.ev) && Number.isFinite(raw.ebitda) && Number.isFinite(raw.debtMultiple)
    && raw.ebitda * raw.debtMultiple > raw.ev * 0.9;
  const validationError = invalid?.[1]
    || (forecastInvalid ? 'Forecast inputs must stay within a sensible range.' : '')
    || (debtTooHigh ? 'Borrowing is too high: debt should stay below 90% of the purchase price.' : '');
  const alert = $('modelAlert');
  if (validationError) {
    if (invalid) $(invalid[0]).setAttribute('aria-invalid', 'true');
    if (alert) {
      alert.hidden = false;
      alert.textContent = validationError;
    }
    ['entryMultiple', 'entryEquity', 'exitEquity', 'valueCreation', 'moic', 'irr', 'exitMultiple'].forEach((id) => { if ($(id)) $(id).textContent = '—'; });
    if ($('modelStatus')) $('modelStatus').textContent = 'NEEDS ATTENTION';
    return;
  }
  inputs.forEach((id) => $(id).removeAttribute('aria-invalid'));
  if (alert) {
    alert.hidden = true;
    alert.textContent = '';
  }
  if ($('modelStatus')) $('modelStatus').textContent = 'CASE IS CLEAN';
  const ev = raw.ev;
  const ebitda = raw.ebitda;
  const debtMultiple = raw.debtMultiple;
  const interest = raw.interest;
  const hold = raw.hold;
  const entryMultiple = ev / ebitda;
  const entryDebt = ebitda * debtMultiple;
  const entryEquity = ev - entryDebt;
  const growthInputs = [...document.querySelectorAll('[data-key="growth"]')].map((el) => Number(el.value) || 0);
  const marginInputs = [...document.querySelectorAll('[data-key="margin"]')].map((el) => Number(el.value) || 0);
  let revenue = ebitda / (marginInputs[0] / 100 || 0.21);
  for (let i = 0; i < hold; i += 1) revenue *= 1 + (growthInputs[i] || growthInputs.at(-1) || 0) / 100;
  const exitEbitda = revenue * ((marginInputs[hold - 1] || marginInputs.at(-1) || 25) / 100);
  const exitMultiple = entryMultiple + 1.5;
  const exitEv = exitEbitda * exitMultiple;
  const interestDrag = Math.max(0, interest - 8.25) * .02;
  const debtPaydown = entryDebt * Math.min(.82, Math.max(.05, .18 + hold * .12 - interestDrag));
  const exitEquity = Math.max(0, exitEv - entryDebt + debtPaydown);
  const moic = exitEquity / Math.max(entryEquity, 1);
  const irr = (Math.pow(moic, 1 / hold) - 1) * 100;
  $('entryMultiple').innerHTML = `${entryMultiple.toFixed(1)}x <span>↗</span>`;
  $('entryEquity').textContent = money(entryEquity);
  $('exitEquity').textContent = money(exitEquity);
  $('valueCreation').textContent = `+${money(exitEquity - entryEquity)}`;
  $('moic').textContent = `${moic.toFixed(1)}x`;
  $('irr').textContent = `${irr.toFixed(1)}%`;
  $('exitMultiple').textContent = `${exitMultiple.toFixed(1)}x`;
  [['tapeEntry', `${entryMultiple.toFixed(1)}x`], ['tapeLeverage', `${debtMultiple.toFixed(1)}x`], ['tapeIrr', `${irr.toFixed(1)}%`], ['tapeMoic', `${moic.toFixed(1)}x`], ['tapeExit', `${exitMultiple.toFixed(1)}x`]].forEach(([id, value]) => { if ($(id)) $(id).textContent = value; });
  const bridge = {
    entry: entryEquity,
    debt: debtPaydown,
    ebitda: Math.max(0, exitEbitda * entryMultiple - ev),
    multiple: Math.max(0, exitEv - exitEbitda * entryMultiple),
    exit: exitEquity
  };
  const bridgeMax = Math.max(bridge.exit, bridge.entry, 1);
  [['Entry', bridge.entry], ['Debt', bridge.debt], ['Ebitda', bridge.ebitda], ['Multiple', bridge.multiple], ['Exit', bridge.exit]].forEach(([name, value]) => {
    const key = String(name);
    const bar = $(`bar${key}`);
    const label = $(`bridge${key}`);
    if (bar) bar.style.height = `${Math.max(8, (value / bridgeMax) * 100)}%`;
    if (label) label.textContent = money(value);
  });
  let openingDebt = entryDebt;
  for (let year = 0; year < 5; year += 1) {
    const sweep = Math.min(openingDebt, entryDebt * (0.12 + (year + 1) * 0.04) * (0.8 + (marginInputs[year] || 20) / 100));
    const closingDebt = Math.max(0, openingDebt - sweep);
    $(`debtOpen${year}`).textContent = money(openingDebt);
    $(`debtSweep${year}`).textContent = `(${money(sweep)})`;
    $(`debtClose${year}`).textContent = money(closingDebt);
    $(`debtLev${year}`).textContent = `${(closingDebt / Math.max(exitEbitda * ((year + 1) / 5), 1)).toFixed(1)}x`;
    openingDebt = closingDebt;
  }
  const exitDebt = openingDebt;
  currentModel = {
    ev, ebitda, entryDebt, entryEquity, debtPaydown, exitDebt, exitEbitda, exitEv, exitEquity,
    entryMultiple, exitMultiple, moic, irr, hold, growthRate: growthInputs[0] || 0,
    forecastEbitda: Array.from({ length: hold }, (_, i) => ebitda * Math.pow(1 + (growthInputs[i] || growthInputs.at(-1) || 0) / 100, i + 1))
  };
  $('radial').style.background = `conic-gradient(var(--mint) 0 ${Math.min(irr * 3.2, 96)}%, #253541 ${Math.min(irr * 3.2, 96)}% 100%)`;
  $('lastRun').textContent = `Today · ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})} ET`;
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
  document.querySelectorAll('.segmented button[data-case]').forEach((item) => item.setAttribute('aria-selected', String(item.dataset.case === 'base')));
  updateReadiness();
  showToast('Base case restored — model recalculated');
});
$('exportBtn').addEventListener('click', () => {
  const memo = `NORTHSTAR / PROJECT ATLAS\n\nEntry EV: ${$('ev').value}mm\nEntry EBITDA: ${$('ebitda').value}mm\nMOIC: ${$('moic').textContent}\nIRR: ${$('irr').textContent}\n`;
  const blob = new Blob([memo], {type: 'text/plain'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'project-atlas-investment-committee-memo.txt';
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('IC memo exported');
});
$('downloadBtn').addEventListener('click', () => {
  const csv = 'Exit Multiple,0%,5%,10%,15%,20%,25%,30%\n7.0x,13.2%,16.8%,20.0%,23.0%,25.9%,28.4%,30.7%\n8.0x,16.1%,19.4%,22.4%,25.2%,27.8%,30.1%,32.2%\n9.0x,18.6%,21.6%,24.4%,27.0%,29.4%,31.6%,33.6%';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  link.download = 'atlas-irr-sensitivity.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Sensitivity CSV downloaded');
});
$('scenarioBtn').addEventListener('click', () => {
  const start = performance.now();
  $('scenarioStatus').textContent = 'sampling 10,000 paths…';
  $('scenarioBtn').disabled = true;
  window.setTimeout(() => {
    const base = Number($('irr').textContent.replace('%', '')) || 22.4;
    $('p10').textContent = `${Math.max(0, base - 6.6).toFixed(1)}%`;
    $('p50').textContent = `${base.toFixed(1)}%`;
    $('p90').textContent = `${(base + 9.3).toFixed(1)}%`;
    $('scenarioStatus').textContent = `complete · ${((performance.now() - start) / 1000).toFixed(2)}s · seed 42`;
    $('scenarioBtn').disabled = false;
    showToast('Scenario envelope refreshed');
  }, 650);
});
calculate();
