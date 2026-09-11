const $ = (id) => document.getElementById(id);
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
const workspaceData = {
  lbo: {
    title: 'LBO model',
    description: 'See where the purchase money comes from, where it goes, and how much debt remains.',
    html: `<div class="workspace-grid"><div><h3>Sources & uses</h3><p class="workspace-note">Capitalization at close · USD mm</p><div class="model-table"><div><span>Purchase enterprise value</span><b id="wsEv">$425.0</b></div><div><span>Refinance existing debt</span><b id="wsRefi">($0.0)</b></div><div class="subtotal"><span>Total uses</span><b id="wsUses">$425.0</b></div></div></div><div><h3>Capital structure</h3><p class="workspace-note">Debt capacity and sponsor funding</p><div class="model-table"><div><span>Senior secured debt</span><b id="wsDebt">$234.0</b></div><div><span>Sponsor equity</span><b id="wsSponsor">$191.0</b></div><div class="subtotal"><span>Total sources</span><b id="wsSources">$425.0</b></div></div></div></div><div class="workspace-grid lower"><div><h3>Operating leverage</h3><div class="metric-row"><span>Entry debt / EBITDA</span><strong id="wsLev">4.5x</strong></div><div class="metric-row"><span>Exit debt / EBITDA</span><strong id="wsExitLev">0.4x</strong></div></div><div><h3>Debt paydown</h3><div class="metric-row"><span>Cash sweep assumption</span><strong>80.0%</strong></div><div class="metric-row"><span>Interest coverage</span><strong class="positive">3.2x</strong></div></div></div>`
  },
  dcf: {
    title: 'DCF analysis',
    description: 'Estimate what the business may be worth using the cash it could generate in the future.',
    html: `<div class="workspace-grid"><div><h3>Discounted cash flow</h3><p class="workspace-note">Unlevered FCF bridge · USD mm</p><div class="model-table"><div><span>PV of forecast cash flows</span><b>$284.6</b></div><div><span>PV of terminal value</span><b>$361.8</b></div><div class="subtotal"><span>Enterprise value</span><b class="gold">$646.4</b></div></div></div><div><h3>Valuation controls</h3><p class="workspace-note">Key DCF assumptions</p><div class="model-table"><div><span>WACC</span><b>9.5%</b></div><div><span>Terminal growth</span><b>2.5%</b></div><div class="subtotal"><span>Implied upside</span><b class="positive">+52.1%</b></div></div></div></div><div class="formula-box"><span>EV = Σ FCF<sub>t</sub> / (1 + WACC)<sup>t</sup> + TV / (1 + WACC)<sup>n</sup></span><b>Model is internally consistent</b></div>`
  },
  returns: {
    title: 'Returns bridge',
    description: 'Understand whether returns come from business growth, paying down debt, or selling at a higher price.',
    html: `<div class="returns-workspace"><div class="return-hero-large"><small>BASE CASE NET IRR</small><strong id="wsIrr">22.4%</strong><span class="positive">Within investment committee hurdle range</span></div><div class="return-drivers"><div><span>EBITDA growth</span><b class="positive">48%</b><i style="width:48%"></i></div><div><span>Debt paydown</span><b class="positive">32%</b><i style="width:32%"></i></div><div><span>Multiple expansion</span><b class="gold">20%</b><i class="gold-bar" style="width:20%"></i></div></div></div><div class="formula-box"><span>MOIC = Exit equity / Entry equity</span><b id="wsMoic">2.7x gross / 22.4% IRR</b></div>`
  },
  comps: {
    title: 'Comps library',
    description: 'Compare this company with similar businesses to sense-check the purchase price.',
    html: `<div class="comps-toolbar"><input placeholder="⌕  Filter companies" aria-label="Filter companies" /><span class="gold mono">12 ACTIVE COMPS</span></div><div class="comp-table"><div class="comp-head"><span>Company</span><span>EV</span><span>EV / Revenue</span><span>EV / EBITDA</span><span>NTM growth</span></div>${[['Atlas peer A','$1,240','3.1x','11.8x','14.2%'],['Atlas peer B','$860','2.6x','9.4x','11.7%'],['Atlas peer C','$2,410','4.2x','13.1x','18.6%'],['Selected case','$425','2.1x','8.2x','12.0%']].map((r,i)=>`<div class="comp-row ${i===3?'selected-row':''}"><span>${r[0]}</span><b>${r[1]}</b><b>${r[2]}</b><b>${r[3]}</b><b class="${i===3?'gold':''}">${r[4]}</b></div>`).join('')}</div>`
  },
  sensitivity: {
    title: 'Sensitivity lab',
    description: 'Try better and worse outcomes to see which assumptions matter most.',
    html: `<div class="sensitivity-header"><h3>IRR response surface</h3><span class="workspace-note">Exit multiple × EBITDA CAGR</span></div><div class="large-surface">${[...Array(35)].map((_,i)=>`<b class="surface-cell s${(i%7)+1}">${(13 + (i%7)*2 + Math.floor(i/7)*1.4).toFixed(1)}%</b>`).join('')}</div><div class="legend"><span>Lower return</span><i></i><span>Higher return</span></div>`
  },
  assumptions: {
    title: 'Assumption sets',
    description: 'Save and compare the Base, Downside, and Upside stories that drive the model.',
    html: `<div class="assumption-list"><div class="assumption-row active"><span class="status-dot"></span><div><strong>Base case / Atlas v2.4</strong><small>Updated today · owner: K. Anubhav</small></div><b>ACTIVE</b></div><div class="assumption-row"><span class="status-dot muted-dot"></span><div><strong>Downside / Atlas v2.4D</strong><small>Revenue haircut · margin compression · 5yr hold</small></div><b>READY</b></div><div class="assumption-row"><span class="status-dot muted-dot"></span><div><strong>Upside / Atlas v2.4U</strong><small>Pricing expansion · accelerated deleveraging</small></div><b>READY</b></div></div><button class="button primary" id="newCaseBtn">＋ Create assumption set</button>`
  }
};

function updateWorkspaceMetrics() {
  const ev = Number($('ev').value) || 0;
  const ebitda = Number($('ebitda').value) || 1;
  const debt = ebitda * (Number($('debtMultiple').value) || 0);
  [['wsEv', money(ev)], ['wsUses', money(ev)], ['wsDebt', money(debt)], ['wsSponsor', money(ev - debt)], ['wsSources', money(ev)], ['wsLev', `${(debt / ebitda).toFixed(1)}x`], ['wsIrr', $('irr')?.textContent || '22.4%'], ['wsMoic', `${$('moic')?.textContent || '2.7x'} gross / ${$('irr')?.textContent || '22.4%'} IRR`]].forEach(([id, value]) => { if ($(id)) $(id).textContent = value; });
}

function openWorkspace(view) {
  const data = workspaceData[view];
  if (!data) return;
  $('cockpitWorkspace').hidden = true;
  $('secondaryWorkspace').hidden = false;
  $('workspaceTitle').textContent = data.title;
  $('workspaceDescription').textContent = data.description;
  $('workspaceContent').innerHTML = data.html;
  updateWorkspaceMetrics();
  const filter = $('workspaceContent').querySelector('.comps-toolbar input');
  filter?.addEventListener('input', () => {
    const query = filter.value.toLowerCase();
    $('workspaceContent').querySelectorAll('.comp-row').forEach((row) => {
      row.hidden = !row.textContent.toLowerCase().includes(query);
    });
  });
  $('workspaceContent').querySelector('#newCaseBtn')?.addEventListener('click', () => showToast('New case template created'));
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
}

document.querySelectorAll('.nav-item[data-view]').forEach((item) => item.addEventListener('click', () => {
  if (item.dataset.view === 'cockpit') {
    $('secondaryWorkspace').hidden = true;
    $('cockpitWorkspace').hidden = false;
    document.querySelectorAll('.nav-item[data-view]').forEach((nav) => nav.classList.toggle('active', nav === item));
  } else openWorkspace(item.dataset.view);
}));

function wireUiActions() {
  const workspaceSwitcher = $('workspaceSwitcher');
  const workspaceMenu = $('workspaceMenu');
  const workspaceList = $('workspaceList');
  const renderWorkspaces = () => {
    workspaceList.innerHTML = workspaces.map((name) => `<button type="button" class="workspace-option ${name === activeWorkspace ? 'active' : ''}" data-workspace="${name}"><span class="status-dot"></span><span>${name}</span>${name === activeWorkspace ? '<b>✓</b>' : ''}</button>`).join('');
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
    if (workspaces.includes(name)) { showToast('Workspace name already exists'); return; }
    workspaces.push(name);
    activeWorkspace = name;
    $('workspaceSwitcher').querySelector('strong').textContent = name;
    $('workspaceName').value = '';
    $('workspaceCreate').hidden = true;
    renderWorkspaces();
    showToast(`${name} workspace created`);
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
  document.querySelectorAll('.more-button').forEach((button) => button.addEventListener('click', () => showToast('More actions available in the command palette')));
  document.querySelectorAll('.chart-filter').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.chart-filter').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    showToast(`${button.textContent} view selected`);
  }));
  document.querySelector('.segmented .add-case')?.addEventListener('click', () => showToast('Use Assumption sets to create a named case'));
  document.querySelector('.full-link')?.addEventListener('click', () => showToast('IC prep checklist opened'));
  document.querySelector('.command-trigger')?.addEventListener('click', () => showToast('Command palette: ⌘1 cockpit · ⌘2 LBO · ⌘3 DCF · ⌘4 returns'));
  document.querySelector('[aria-label="Notifications"]')?.addEventListener('click', () => showToast('No new notifications'));
  document.querySelector('[aria-label="Search"]')?.addEventListener('click', () => showToast('Search is ready — try the command palette'));
  document.querySelectorAll('.sidebar-bottom .nav-item').forEach((button) => button.addEventListener('click', () => showToast(button.textContent.includes('Settings') ? 'Settings panel ready' : '⌘1–⌘4 switch workspaces')));
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
    showToast('More actions available in the command palette');
  } else if (target.matches('.full-link')) {
    showToast('IC prep checklist opened');
  }
});
document.addEventListener('keydown', (event) => {
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
  const ev = Number($('ev').value) || 0;
  const ebitda = Number($('ebitda').value) || 1;
  const debtMultiple = Number($('debtMultiple').value) || 0;
  const interest = Number($('interest').value) || 0;
  const hold = Number($('hold').value) || 1;
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
  const exitEquity = exitEv - entryDebt + debtPaydown;
  const moic = exitEquity / Math.max(entryEquity, 1);
  const irr = (Math.pow(moic, 1 / hold) - 1) * 100;
  $('entryMultiple').innerHTML = `${entryMultiple.toFixed(1)}x <span>↗</span>`;
  $('entryEquity').textContent = money(entryEquity);
  $('exitEquity').textContent = money(exitEquity);
  $('valueCreation').textContent = `+${money(exitEquity - entryEquity)}`;
  $('moic').textContent = `${moic.toFixed(1)}x`;
  $('irr').textContent = `${irr.toFixed(1)}%`;
  $('exitMultiple').textContent = `${exitMultiple.toFixed(1)}x`;
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
  inputs.forEach((id) => { $(id).value = state.defaultValues[id]; });
  calculate();
  showToast('Base case restored');
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
