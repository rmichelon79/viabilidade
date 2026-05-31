import { getState } from '../store.js'
import { calcAll } from '../calc.js'

const KEYS   = ['otimista', 'base', 'pessimista']
const LABELS = { otimista: 'Otimista', base: 'Base', pessimista: 'Pessimista' }
const COLORS = { otimista: '#16a34a', base: '#2563eb', pessimista: '#dc2626' }

let _activeKey = 'base'

export function render(container) {
  container.innerHTML = `
<div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
  <div>
    <h1 class="page-title">Fluxo de Caixa</h1>
    <p class="page-sub">Demonstrativo mensal detalhado</p>
  </div>
  <div style="display:flex;gap:6px;align-items:center;margin-top:4px" id="fc-tabs"></div>
</div>
<div id="fc-root"></div>
`
  renderTabs(container)
  renderTable(container)
}

export function update(container) {
  renderTable(container)
}

function renderTabs(container) {
  const tabs = container.querySelector('#fc-tabs')
  tabs.innerHTML = KEYS.map(k => `
    <button class="fc-tab ${k === _activeKey ? 'fc-tab-active' : ''}"
      data-k="${k}"
      style="padding:6px 16px;border-radius:6px;border:2px solid ${k === _activeKey ? COLORS[k] : '#e2e8f0'};
             background:${k === _activeKey ? COLORS[k] + '12' : '#fff'};
             color:${k === _activeKey ? COLORS[k] : '#64748b'};
             font-size:0.8rem;font-weight:600;cursor:pointer;transition:all .15s">
      ${LABELS[k]}
    </button>`).join('')

  tabs.addEventListener('click', e => {
    const btn = e.target.closest('[data-k]')
    if (!btn) return
    _activeKey = btn.dataset.k
    renderTabs(container)
    renderTable(container)
  })
}

function renderTable(container) {
  const root = container.querySelector('#fc-root')
  if (!root) return

  const state  = getState()
  const res    = calcAll(state)
  const r      = res[_activeKey]
  const k      = _activeKey
  const n      = r.totalM + 1

  const recLiq  = r.recLiqMensal  || []
  const custos  = r.custos        || []
  const disb    = r.disb          || []
  const juros   = r.jurosMensal   || []
  const amort   = r.amortMensal   || []
  const fluxo   = r.fluxo         || []
  const acum    = r.fluxoAcum     || []

  const rows = []
  for (let t = 0; t < n; t++) {
    const isLanc = t === r.mesLanc
    const isEntr = t === r.mesEntr
    const tag = isLanc ? '🚀 Lanç.' : (isEntr ? '🔑 Entrega' : '')
    const f = fluxo[t] || 0
    const a = acum[t]  || 0
    rows.push(`
<tr class="${isLanc ? 'fc-row-lanc' : (isEntr ? 'fc-row-entr' : '')}" style="${Math.abs(f) < 0.01 && t > 0 ? 'color:#94a3b8' : ''}">
  <td style="text-align:center;font-weight:${isLanc||isEntr?'700':'400'}">${t}${tag ? `<br><span style="font-size:0.65rem;color:${isLanc?'#2563eb':'#d97706'}">${tag}</span>` : ''}</td>
  <td class="td-r">${brl(recLiq[t] || 0)}</td>
  <td class="td-r neg-val">${brl(-(custos[t] || 0))}</td>
  <td class="td-r">${(disb[t] || 0) > 0.01 ? brl(disb[t]) : '–'}</td>
  <td class="td-r neg-val">${(juros[t] || 0) > 0.01 ? brl(-(juros[t])) : '–'}</td>
  <td class="td-r neg-val">${(amort[t] || 0) > 0.01 ? brl(-(amort[t])) : '–'}</td>
  <td class="td-r" style="font-weight:600;color:${f >= 0 ? '#16a34a' : '#dc2626'}">${brl(f)}</td>
  <td class="td-r" style="font-weight:600;color:${a >= 0 ? '#16a34a' : '#dc2626'}">${brl(a)}</td>
</tr>`)
  }

  // Totals
  const totRec  = recLiq.slice(0,n).reduce((s,v)=>s+v,0)
  const totCust = custos.slice(0,n).reduce((s,v)=>s+v,0)
  const totDisb = disb.slice(0,n).reduce((s,v)=>s+v,0)
  const totJur  = juros.slice(0,n).reduce((s,v)=>s+v,0)
  const totAmort= amort.slice(0,n).reduce((s,v)=>s+v,0)
  const totFlux = fluxo.slice(0,n).reduce((s,v)=>s+v,0)

  root.innerHTML = `
<div class="card" style="overflow:hidden;padding:0">

  <!-- KPI strip -->
  <div style="display:flex;gap:0;border-bottom:1px solid #f1f5f9;flex-wrap:wrap">
    ${kpi('Resultado Final',    r.resultFinal,  true)}
    ${kpi('Receita Líquida',    r.recLiqTotal,  false)}
    ${kpi('Total Custos C&D',   -r.totalCustos, true)}
    ${kpi('Juros Totais',       -r.jurosTotais, true)}
    ${kpi('Exposição Máxima',   r.exposicao,    true)}
  </div>

  <!-- Table -->
  <div style="overflow-x:auto;overflow-y:auto;max-height:620px">
    <table class="data-table fc-table">
      <thead style="position:sticky;top:0;z-index:10;background:#f8fafc">
        <tr>
          <th style="text-align:center;min-width:60px">Mês</th>
          <th class="th-r">Receita Líq. (R$)</th>
          <th class="th-r">Custos (R$)</th>
          <th class="th-r">Financ. (R$)</th>
          <th class="th-r">Juros (R$)</th>
          <th class="th-r">Amort. (R$)</th>
          <th class="th-r" style="border-left:2px solid #e2e8f0">Fluxo Mensal (R$)</th>
          <th class="th-r">Fluxo Acum. (R$)</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join('')}
      </tbody>
      <tfoot style="position:sticky;bottom:0;background:#f8fafc;border-top:2px solid #e2e8f0">
        <tr style="font-weight:700">
          <td style="text-align:center">TOTAL</td>
          <td class="td-r">${brl(totRec)}</td>
          <td class="td-r neg-val">${brl(-totCust)}</td>
          <td class="td-r">${brl(totDisb)}</td>
          <td class="td-r neg-val">${brl(-totJur)}</td>
          <td class="td-r neg-val">${brl(-totAmort)}</td>
          <td class="td-r" style="border-left:2px solid #e2e8f0;color:${totFlux>=0?'#16a34a':'#dc2626'}">${brl(totFlux)}</td>
          <td class="td-r" style="color:${(acum[n-1]||0)>=0?'#16a34a':'#dc2626'}">${brl(acum[n-1]||0)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</div>`
}

function kpi(label, val, signed) {
  const color = signed ? (val >= 0 ? '#16a34a' : '#dc2626') : '#0f172a'
  return `
<div style="padding:14px 20px;flex:1;min-width:140px;border-right:1px solid #f1f5f9">
  <div style="font-size:0.68rem;color:#64748b;margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em">${label}</div>
  <div style="font-size:0.95rem;font-weight:700;color:${color}">${brlM(val)}</div>
</div>`
}

function brl(v) {
  const abs = Math.abs(Math.round(v))
  return (v < 0 ? '(' : '') + 'R$ ' + abs.toLocaleString('pt-BR') + (v < 0 ? ')' : '')
}
function brlM(v) {
  const m = Math.abs(v / 1e6)
  return (v < 0 ? '(' : '') + 'R$ ' + m.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'M' + (v < 0 ? ')' : '')
}
