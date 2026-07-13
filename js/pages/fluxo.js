import { getState } from '../store.js'
import { calcAll } from '../calc.js'
import { exportarParaOrcamento } from '../exportarOrcamento.js'

const KEYS   = ['otimista', 'base', 'pessimista']
const LABELS = { otimista: 'Otimista', base: 'Base', pessimista: 'Pessimista' }
const COLORS = { otimista: '#16a34a', base: '#7AA436', pessimista: '#dc2626' }

let _activeKey = 'base'
let _detalhado = false

export function render(container) {
  container.innerHTML = `
<div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
  <div>
    <h1 class="page-title">Fluxo de Caixa</h1>
    <p class="page-sub">Demonstrativo mensal detalhado</p>
  </div>
  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px">
    <div id="fc-tabs" style="display:flex;gap:6px"></div>
    <div style="width:1px;height:24px;background:#e2e8f0;margin:0 4px"></div>
    <button id="fc-toggle" style="padding:5px 12px;border-radius:6px;border:1px solid #e2e8f0;
      background:#fff;color:#475569;font-size:0.75rem;font-weight:600;cursor:pointer">
      ☰ Custos detalhados
    </button>
    <button id="fc-export" style="padding:5px 12px;border-radius:6px;border:1px solid #5A7A1F;
      background:#5A7A1F;color:#fff;font-size:0.75rem;font-weight:600;cursor:pointer">
      ⬆ Exportar p/ Orçamento
    </button>
  </div>
</div>
<div id="fc-root"></div>
`
  renderTabs(container)
  container.querySelector('#fc-export').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget
    const p = getState().premissas
    if (!confirm(`Exportar o cenário ${LABELS[_activeKey]} de "${p.nome}" para o Orçamento?\n\nCria uma NOVA versão por ano (não apaga as versões atuais).`)) return
    btn.disabled = true
    const txt = btn.textContent
    btn.textContent = 'Exportando…'
    try {
      const r = calcAll(getState())[_activeKey]
      const res = await exportarParaOrcamento(r, p, LABELS[_activeKey])
      const linhas = res.resumo.map(x => `  ${x.ano} v${x.versao}: ${x.lancamentos} lançamentos`).join('\n')
      const ov = res.overflow ? `\n\n(${res.overflow} mês(es) além do 7º ano somados em dez/${res.anoBase + 6})` : ''
      alert(`✅ Exportado para o Orçamento.\n\nEmpreendimento: ${res.empreendimento}\nCenário: ${res.cenario}\nHorizonte: ${res.anoBase}–${res.anoBase + 4}\n${linhas}${ov}`)
    } catch (err) {
      alert('Erro ao exportar: ' + err.message)
    } finally {
      btn.disabled = false
      btn.textContent = txt
    }
  })
  container.querySelector('#fc-toggle').addEventListener('click', e => {
    _detalhado = !_detalhado
    e.target.style.background = _detalhado ? '#EEF0DC' : '#fff'
    e.target.style.borderColor = _detalhado ? '#7AA436' : '#E4DED2'
    e.target.style.color       = _detalhado ? '#5A7A1F' : '#7C7568'
    renderTable(container)
  })
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

// Cost item definitions (label + key in custoDetalhe)
const COST_ITEMS = [
  { label: 'Terreno',      key: 'cTerreno'   },
  { label: 'ITBI',         key: 'cITBI'      },
  { label: 'IPTU',         key: 'cIPTU'      },
  { label: 'Proj./Alv.',   key: 'cProjAlv'   },
  { label: 'Registros',    key: 'cRegistros' },
  { label: 'Seguros',      key: 'cSeguros'   },
  { label: 'Obra',         key: 'cObra'      },
  { label: 'Comissões',    key: 'cComissoes' },
  { label: 'Gest. Com.',   key: 'cGestCom'   },
  { label: 'Marketing',    key: 'cMarketing' },
  { label: 'ADM',          key: 'cAdm'       },
]

function renderTable(container) {
  const root = container.querySelector('#fc-root')
  if (!root) return

  const r   = calcAll(getState())[_activeKey]
  const n   = r.totalM + 1
  const det = r.custoDetalhe || {}

  const recLiq = r.recLiqMensal || []
  const custos = r.custos       || []
  const disb   = r.disb         || []
  const juros  = r.jurosMensal  || []
  const amort  = r.amortMensal  || []
  const fluxo  = r.fluxo        || []
  const acum   = r.fluxoAcum    || []

  const costCols = _detalhado ? COST_ITEMS : [{ label: 'Custos', key: '_total' }]

  const headCols = costCols.map(c => `<th class="th-r">${c.label} (R$)</th>`).join('')
  const sepStyle = 'border-left:2px solid #e2e8f0'

  const rows = []
  for (let t = 0; t < n; t++) {
    const isLanc = t === r.mesLanc
    const isEntr = t === r.mesEntr
    const tag = isLanc ? '🚀' : (isEntr ? '🔑' : '')
    const f = fluxo[t] || 0
    const a = acum[t]  || 0
    const costCells = costCols.map(c => {
      const v = c.key === '_total' ? (custos[t] || 0) : (det[c.key]?.[t] || 0)
      return `<td class="td-r neg-val">${v > 0.005 ? brl(-v) : '–'}</td>`
    }).join('')
    rows.push(`
<tr class="${isLanc ? 'fc-row-lanc' : (isEntr ? 'fc-row-entr' : '')}">
  <td style="text-align:center;font-weight:${isLanc||isEntr?'700':'400'};white-space:nowrap">
    ${t}${tag ? ` <span style="font-size:0.7rem">${tag}</span>` : ''}
  </td>
  <td class="td-r">${(recLiq[t]||0) > 0.005 ? brl(recLiq[t]) : '–'}</td>
  ${costCells}
  <td class="td-r">${(disb[t]||0) > 0.005 ? brl(disb[t]) : '–'}</td>
  <td class="td-r neg-val">${(juros[t]||0) > 0.005 ? brl(-juros[t]) : '–'}</td>
  <td class="td-r neg-val">${(amort[t]||0) > 0.005 ? brl(-amort[t]) : '–'}</td>
  <td class="td-r" style="${sepStyle};font-weight:600;color:${f>=0?'#16a34a':'#dc2626'}">${brl(f)}</td>
  <td class="td-r" style="font-weight:600;color:${a>=0?'#16a34a':'#dc2626'}">${brl(a)}</td>
</tr>`)
  }

  const tot = arr => arr.slice(0,n).reduce((s,v)=>s+v,0)
  const totCostCells = costCols.map(c => {
    const v = c.key === '_total' ? tot(custos) : tot(det[c.key] || [])
    return `<td class="td-r neg-val"><strong>${brl(-v)}</strong></td>`
  }).join('')
  const totFlux = tot(fluxo)

  root.innerHTML = `
<div class="card" style="overflow:hidden;padding:0">
  <div style="display:flex;gap:0;border-bottom:1px solid #f1f5f9;flex-wrap:wrap">
    ${kpi('Resultado Final',  r.resultFinal, true)}
    ${kpi('VGV Ajustado',     r.vgvAjustado, false)}
    ${kpi('Total Custos C&D', -r.totalCustos, true)}
    ${kpi('Juros Totais',     -r.jurosTotais, true)}
    ${kpi('Exposição Máx.',   r.exposicao,   true)}
  </div>
  <div style="overflow-x:auto;overflow-y:auto;max-height:580px">
    <table class="data-table fc-table">
      <thead style="position:sticky;top:0;z-index:10;background:#f8fafc">
        <tr>
          <th style="text-align:center;min-width:58px">Mês</th>
          <th class="th-r">Receita Líq. (R$)</th>
          ${headCols}
          <th class="th-r">Financ. (R$)</th>
          <th class="th-r">Juros (R$)</th>
          <th class="th-r">Amort. (R$)</th>
          <th class="th-r" style="${sepStyle}">Fluxo Mensal (R$)</th>
          <th class="th-r">Fluxo Acum. (R$)</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
      <tfoot style="position:sticky;bottom:0;background:#f8fafc;border-top:2px solid #e2e8f0">
        <tr>
          <td style="text-align:center"><strong>TOTAL</strong></td>
          <td class="td-r"><strong>${brl(tot(recLiq))}</strong></td>
          ${totCostCells}
          <td class="td-r"><strong>${brl(tot(disb))}</strong></td>
          <td class="td-r neg-val"><strong>${brl(-tot(juros))}</strong></td>
          <td class="td-r neg-val"><strong>${brl(-tot(amort))}</strong></td>
          <td class="td-r" style="${sepStyle};color:${totFlux>=0?'#16a34a':'#dc2626'}"><strong>${brl(totFlux)}</strong></td>
          <td class="td-r" style="color:${(acum[n-1]||0)>=0?'#16a34a':'#dc2626'}"><strong>${brl(acum[n-1]||0)}</strong></td>
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

function _intBR(n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
function _decBR(n,d) { const r=(Math.round(Math.abs(n)*Math.pow(10,d))/Math.pow(10,d)).toFixed(d); const[i,f='']= r.split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+(f||'').padEnd(d,'0') }
function brl(v)  { return (v < 0 ? '(' : '') + 'R$ ' + _intBR(v)         + (v < 0 ? ')' : '') }
function brlM(v) { return (v < 0 ? '(' : '') + 'R$ ' + _decBR(v/1e6, 2) + 'M' + (v < 0 ? ')' : '') }
