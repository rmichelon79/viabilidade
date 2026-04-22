import { getState, setCenario, setAbsorcao } from '../store.js'

const KEYS = ['otimista', 'base', 'pessimista']
const LABELS = { otimista: 'Otimista', base: 'Base', pessimista: 'Pessimista' }
const COLORS = { otimista: '#16a34a', base: '#2563eb', pessimista: '#dc2626' }

let _charts = {}

export function render(container) {
  container.innerHTML = `
<div class="page-header">
  <h1 class="page-title">Cenários</h1>
  <p class="page-sub">Condições de pagamento e velocidade de vendas</p>
</div>

<!-- Condições de pagamento -->
<div class="card">
  <div class="card-title">CONDIÇÕES DE PAGAMENTO</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>Parâmetro</th>
        <th style="color:${COLORS.otimista}">Otimista</th>
        <th style="color:${COLORS.base}">Base</th>
        <th style="color:${COLORS.pessimista}">Pessimista</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Desconto sobre tabela base (%)</td>
        ${KEYS.map(k => `<td><input class="td-input td-num sc-input" type="number" step="0.1" data-sc="${k}" data-key="desconto"></td>`).join('')}
      </tr>
      <tr>
        <td>% Entrada (assinatura)</td>
        ${KEYS.map(k => `<td><input class="td-input td-num sc-input" type="number" step="1" min="0" max="100" data-sc="${k}" data-key="pctEntrada"></td>`).join('')}
      </tr>
      <tr>
        <td>% Durante obra (parcelas)</td>
        ${KEYS.map(k => `<td><input class="td-input td-num sc-input" type="number" step="1" min="0" max="100" data-sc="${k}" data-key="pctObra"></td>`).join('')}
      </tr>
      <tr>
        <td>% Saldo chaves</td>
        ${KEYS.map(k => `<td><input class="td-input td-num sc-input sc-chaves" type="number" step="1" min="0" max="100" data-sc="${k}" data-key="pctChaves" readonly style="background:#f8fafc;color:#64748b"></td>`).join('')}
      </tr>
      <tr class="total-row">
        <td><strong>Total</strong></td>
        ${KEYS.map(k => `<td><span class="fv" id="total-pct-${k}">–</span></td>`).join('')}
      </tr>
    </tbody>
  </table>
</div>

<!-- Curva de absorção -->
<div class="card" style="margin-top:16px">
  <div class="card-title">CURVA DE ABSORÇÃO MENSAL — Velocidade de Vendas</div>
  <p style="font-size:0.8rem;color:#64748b;margin-bottom:16px">
    Informe o percentual de unidades vendidas em cada mês (% do total). A soma deve ser 100% por cenário.
  </p>

  <div style="display:flex;gap:24px;margin-bottom:20px;flex-wrap:wrap">
    ${KEYS.map(k => `
    <div style="flex:1;min-width:280px">
      <div style="font-weight:600;color:${COLORS[k]};margin-bottom:8px">${LABELS[k]}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
        <span style="font-size:0.8rem;color:#64748b">Total absorvido:</span>
        <span class="fv" id="abs-total-${k}" style="font-weight:600">–</span>
      </div>
      <button class="btn-sm" data-sc="${k}" data-action="add-month">+ Adicionar mês</button>
      <table class="data-table abs-table" id="abs-table-${k}" style="margin-top:8px">
        <thead><tr><th>Mês</th><th>% do Total</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>`).join('')}
  </div>

  <div style="margin-top:24px">
    <div style="font-weight:600;color:#374151;margin-bottom:12px">Visualização da Curva de Absorção</div>
    <canvas id="abs-chart" height="180"></canvas>
  </div>
</div>
`

  populatePaymentConditions(container)
  bindPaymentInputs(container)
  renderAbsorcao()
  bindAbsorcaoActions(container)
  renderAbsChart()
}

function populatePaymentConditions(container) {
  const c = getState().cenarios
  KEYS.forEach(k => {
    const sc = c[k]
    container.querySelectorAll(`[data-sc="${k}"]`).forEach(el => {
      if (!el.dataset.key) return
      const key = el.dataset.key
      if (key in sc) el.value = sc[key]
    })
    updateChavesField(container, k)
    updateTotalPct(container, k)
  })
}

function bindPaymentInputs(container) {
  container.addEventListener('input', e => {
    const el = e.target
    if (!el.classList.contains('sc-input')) return
    const k = el.dataset.sc
    const key = el.dataset.key
    const v = parseFloat(el.value) || 0
    setCenario(k, { [key]: v })
    updateChavesField(container, k)
    updateTotalPct(container, k)
  })
}

function updateChavesField(container, k) {
  const sc = getState().cenarios[k]
  const chaves = 100 - (sc.pctEntrada || 0) - (sc.pctObra || 0)
  setCenario(k, { pctChaves: Math.max(0, chaves) })
  const el = container.querySelector(`[data-sc="${k}"][data-key="pctChaves"]`)
  if (el) el.value = Math.max(0, chaves).toFixed(0)
}

function updateTotalPct(container, k) {
  const sc = getState().cenarios[k]
  const total = (sc.pctEntrada || 0) + (sc.pctObra || 0) + (sc.pctChaves || 0)
  const el = document.getElementById(`total-pct-${k}`)
  if (el) {
    el.textContent = total.toFixed(0) + '%'
    el.style.color = Math.abs(total - 100) < 0.1 ? '#16a34a' : '#dc2626'
  }
}

function renderAbsorcao() {
  KEYS.forEach(k => {
    const tbody = document.querySelector(`#abs-table-${k} tbody`)
    if (!tbody) return
    const abs = getState().cenarios[k].absorcao || []
    const nonzero = abs.map((v, i) => ({ m: i, v })).filter(x => x.v > 0)

    tbody.innerHTML = nonzero.map(({ m, v }) => `
<tr data-sc="${k}" data-month="${m}">
  <td><input class="td-input td-num abs-month-in" type="number" min="0" max="89" step="1" value="${m}"></td>
  <td><input class="td-input td-num abs-val-in" type="number" min="0" max="100" step="0.01" value="${(v*100).toFixed(4)}"></td>
  <td><button class="btn-del abs-del" data-sc="${k}" data-month="${m}">✕</button></td>
</tr>`).join('')

    updateAbsTotal(k, abs)
  })
}

function bindAbsorcaoActions(container) {
  container.addEventListener('click', e => {
    if (e.target.dataset.action === 'add-month') {
      const k = e.target.dataset.sc
      const abs = [...(getState().cenarios[k].absorcao || new Array(90).fill(0))]
      // Find first month with 0 after launch
      const first = abs.findIndex((v, i) => i >= 6 && v === 0)
      if (first !== -1) abs[first] = 0.01
      setAbsorcao(k, abs)
      renderAbsorcao()
      renderAbsChart()
    }
    if (e.target.classList.contains('abs-del')) {
      const k = e.target.dataset.sc
      const m = parseInt(e.target.dataset.month)
      const abs = [...(getState().cenarios[k].absorcao || new Array(90).fill(0))]
      abs[m] = 0
      setAbsorcao(k, abs)
      renderAbsorcao()
      renderAbsChart()
    }
  })

  container.addEventListener('change', e => {
    if (!e.target.classList.contains('abs-month-in') && !e.target.classList.contains('abs-val-in')) return
    const tr = e.target.closest('tr')
    if (!tr) return
    const k = tr.dataset.sc
    const oldMonth = parseInt(tr.dataset.month)
    const abs = [...(getState().cenarios[k].absorcao || new Array(90).fill(0))]
    const monthInput = tr.querySelector('.abs-month-in')
    const valInput = tr.querySelector('.abs-val-in')
    const newMonth = Math.min(89, Math.max(0, parseInt(monthInput.value) || 0))
    const newVal = Math.max(0, parseFloat(valInput.value) || 0) / 100

    if (newMonth !== oldMonth) abs[oldMonth] = 0
    abs[newMonth] = newVal
    tr.dataset.month = newMonth
    tr.querySelector('.abs-del').dataset.month = newMonth

    setAbsorcao(k, abs)
    updateAbsTotal(k, abs)
    renderAbsChart()
  })
}

function updateAbsTotal(k, abs) {
  const total = (abs || []).reduce((s, v) => s + v, 0) * 100
  const el = document.getElementById(`abs-total-${k}`)
  if (el) {
    el.textContent = total.toFixed(2).replace('.', ',') + '%'
    el.style.color = Math.abs(total - 100) < 0.1 ? '#16a34a' : (Math.abs(total - 100) < 2 ? '#d97706' : '#dc2626')
  }
}

let _absChart = null
function renderAbsChart() {
  const canvas = document.getElementById('abs-chart')
  if (!canvas) return
  const c = getState().cenarios
  const maxM = 90

  const labels = Array.from({ length: maxM }, (_, i) => i)
  const datasets = KEYS.map(k => ({
    label: LABELS[k],
    data: Array.from({ length: maxM }, (_, i) => ((c[k].absorcao || [])[i] || 0) * 100),
    borderColor: COLORS[k],
    backgroundColor: COLORS[k] + '22',
    borderWidth: 2,
    fill: false,
    pointRadius: (ctx) => ctx.raw > 0 ? 4 : 0,
    tension: 0,
  }))

  if (_absChart) {
    _absChart.data.datasets = datasets
    _absChart.update()
    return
  }

  _absChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top' }, tooltip: {
        callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw.toFixed(2).replace('.', ',')}%` }
      }},
      scales: {
        x: { title: { display: true, text: 'Mês' } },
        y: { title: { display: true, text: '% VGV' }, min: 0,
          ticks: { callback: v => v.toFixed(1) + '%' } },
      },
    },
  })
}

export function destroy() {
  if (_absChart) { _absChart.destroy(); _absChart = null }
}
