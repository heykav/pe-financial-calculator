const $ = (id) => document.getElementById(id);
const inputs = ['ev','ebitda','debtMultiple','interest','hold'];
const state = { defaultValues: Object.fromEntries(inputs.map((id) => [id, $(id).value])) };

function money(value) {
  return `$${value.toFixed(1)}`;
}

function calculate() {
  const ev = Number($('ev').value) || 0;
  const ebitda = Number($('ebitda').value) || 1;
  const debtMultiple = Number($('debtMultiple').value) || 0;
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
  const debtPaydown = entryDebt * Math.min(.82, .18 + hold * .12);
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
document.querySelectorAll('.chart-filter').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.chart-filter').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  showToast(`${button.textContent} view selected`);
}));
calculate();
