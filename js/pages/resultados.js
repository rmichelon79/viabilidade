import { getState } from '../store.js'
import { calcAll } from '../calc.js'
import { exportJSON } from '../save.js'
import { exportFluxoXLS } from '../xlsexport.js'

const SC = ['otimista', 'base', 'pessimista']
const LABELS = { otimista: 'Otimista', base: 'Base', pessimista: 'Pessimista' }
const COLORS = { otimista: '#16a34a', base: '#2563eb', pessimista: '#dc2626' }

let _chartAcum = null
let _chartMensal = null

export function render(container) {
  container.innerHTML = `
<div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
  <div>
    <h1 class="page-title">Resultados</h1>
    <p class="page-sub">Comparativo de cenários — Viabilidade econômica</p>
  </div>
  <div class="no-print" style="display:flex;gap:8px;align-items:center;margin-top:4px">
    <button class="btn-sm btn-export" id="btn-export-xls"  style="display:flex;align-items:center;gap:6px">📊 Exportar XLS</button>
    <button class="btn-sm btn-export" id="btn-export-json" style="display:flex;align-items:center;gap:6px">⬇ Exportar JSON</button>
    <button class="btn-sm btn-export" id="btn-print"       style="display:flex;align-items:center;gap:6px">🖨 Imprimir / PDF</button>
  </div>
</div>
<div id="results-root"></div>
`
  document.getElementById('btn-export-xls')?.addEventListener('click',  () => exportFluxoXLS(getState(), calcAll(getState())))
  document.getElementById('btn-export-json')?.addEventListener('click', () => exportJSON(getState()))
  document.getElementById('btn-print')?.addEventListener('click',       () => window.print())
  renderResults(container)
}

function renderResults(container) {
  const state = getState()
  const p = state.premissas
  const res = calcAll(state)

  const root = document.getElementById('results-root')
  if (!root) return

  root.innerHTML = `

<!-- Projeto info -->
<div class="card" style="margin-bottom:16px">
  <div style="display:flex;gap:48px;flex-wrap:wrap">
    <div><span class="info-label">Empreendimento</span><br><strong>${esc(p.nome)}</strong></div>
    <div><span class="info-label">Endereço</span><br><strong>${esc(p.endereco)}</strong></div>
    <div><span class="info-label">Data base</span><br><strong>${p.data || '–'}</strong></div>
    <div><span class="info-label">Prazo total</span><br><strong>${res.base.totalM} meses</strong></div>
    <div><span class="info-label">Entrega</span><br><strong>Mês ${res.base.mesEntr}</strong></div>
  </div>
</div>

<!-- KPI cards por cenário -->
<div class="kpi-3col">
  ${SC.map(k => kpiCard(k, res[k])).join('')}
</div>

<!-- Tabela comparativa -->
<div class="card" style="margin-top:16px;overflow-x:auto">
  <div class="card-title">COMPARATIVO DETALHADO DE CENÁRIOS</div>
  <table class="data-table comp-table">
    <thead>
      <tr>
        <th>Indicador</th>
        <th style="color:${COLORS.otimista}">Otimista</th>
        <th style="color:${COLORS.base}">Base</th>
        <th style="color:${COLORS.pessimista}">Pessimista</th>
      </tr>
    </thead>
    <tbody>
      ${section('RECEITAS')}
      ${row('VGV Bruto Base (R$)',          SC.map(k => brl(res[k].vgvBruto)))}
      ${row('VGV Disponível Ajustado (R$)', SC.map(k => brl(res[k].vgvAjustado)))}
      ${row('Receita Bruta Recebida (R$)',  SC.map(k => brl(res[k].receitaBruta)))}
      ${row('(−) Permuta Financeira (R$)',  SC.map(k => brlN(res[k].permutaTotal)))}
      ${row('(−) Impostos sobre Receita (R$)', SC.map(k => brlN(res[k].impostosTotal)))}
      ${rowHL('Receita Líquida (R$)',        SC.map(k => brl(res[k].recLiqTotal)))}
      ${section('CUSTOS E DESPESAS')}
      ${row('(−) Total Custos e Despesas C&D (R$)', SC.map(k => brlN(res[k].totalCustos)))}
      ${section('RESULTADO OPERACIONAL')}
      ${rowHL('Resultado Operacional (R$)', SC.map(k => brlC(res[k].resultOp)))}
      ${row('Margem s/ VGV Bruto (%)',       SC.map(k => pct(res[k].margemVGV)))}
      ${row('Margem s/ Receita Líquida (%)', SC.map(k => pct(res[k].margemRec)))}
      ${section('FINANCIAMENTO BANCÁRIO')}
      ${row('(+) Desembolsos Recebidos (R$)', SC.map(k => brl(res[k].desembolsosTotal)))}
      ${row('(−) Amortização + Juros (R$)',   SC.map(k => brlN(res[k].amortTotal + res[k].jurosTotais)))}
      ${row('Juros Totais Pagos (R$)',         SC.map(k => brlN(res[k].jurosTotais)))}
      ${row('Custo Líquido do Financiamento (R$)', SC.map(k => brlC(res[k].custoLiqFinanc)))}
      ${section('RESULTADO FINAL')}
      ${rowHL('Resultado Final do Projeto (R$)', SC.map(k => brlC(res[k].resultFinal)))}
      ${row('Margem Final s/ VGV (%)',           SC.map(k => pct(res[k].margemFinal)))}
      ${section('INDICADORES FINANCEIROS')}
      ${rowHL('VPL do Projeto (R$)',             SC.map(k => brlC(res[k].vpl)))}
      ${rowHL('TIR do Projeto (% a.a.)',         SC.map(k => pctHL(res[k].tir)))}
      ${row('Exposição Máx. de Caixa (R$)',      SC.map(k => brlC(res[k].exposicao)))}
      ${row('Mês da Exposição Máxima',           SC.map(k => `m ${res[k].mesExposicao}`))}
      ${section('LINHA DO TEMPO')}
      ${row('Mês do Lançamento',  SC.map(k => `m ${res[k].mesLanc}`))}
      ${row('Prazo de Obra (m)',  SC.map(k => `${p.prazoObra} m`))}
      ${row('Mês de Entrega',     SC.map(k => `m ${res[k].mesEntr}`))}
      ${row('Total de Meses',     SC.map(k => `${res[k].totalM} m`))}
    </tbody>
  </table>
</div>

<!-- Gráficos -->
<div class="card" style="margin-top:16px">
  <div class="card-title">FLUXO DE CAIXA ACUMULADO (R$)</div>
  <div style="position:relative;height:320px">
    <canvas id="chart-acum"></canvas>
  </div>
</div>

<div class="card" style="margin-top:16px;margin-bottom:16px">
  <div class="card-title">FLUXO MENSAL — Cenário Base</div>
  <div style="position:relative;height:320px">
    <canvas id="chart-mensal"></canvas>
  </div>
</div>
`

  renderChartAcum(res)
  renderChartMensal(res.base)
}

function kpiCard(k, r) {
  const tirOk = isFinite(r.tir) && r.tir > 0
  const vplOk = r.vpl > 0
  return `
<div class="kpi-card" style="border-top:4px solid ${COLORS[k]}">
  <div class="kpi-scenario" style="color:${COLORS[k]}">${LABELS[k]}</div>
  <div class="kpi-block">
    <div class="kpi-label">VGV Bruto</div>
    <div class="kpi-value">${brlM(r.vgvBruto)}</div>
  </div>
  <div class="kpi-block">
    <div class="kpi-label">Resultado Final</div>
    <div class="kpi-value ${r.resultFinal >= 0 ? 'pos' : 'neg'}">${brlM(r.resultFinal)}</div>
  </div>
  <div class="kpi-block">
    <div class="kpi-label">Margem s/ VGV</div>
    <div class="kpi-value ${r.margemFinal >= 0 ? 'pos' : 'neg'}">${pct(r.margemFinal)}</div>
  </div>
  <div class="kpi-block">
    <div class="kpi-label">VPL</div>
    <div class="kpi-value ${vplOk ? 'pos' : 'neg'}">${brlM(r.vpl)}</div>
  </div>
  <div class="kpi-block">
    <div class="kpi-label">TIR a.a.</div>
    <div class="kpi-value ${tirOk ? 'pos' : 'neg'}">${tirOk ? pct(r.tir, 1) : '–'}</div>
  </div>
  <div class="kpi-block">
    <div class="kpi-label">Exposição Máx.</div>
    <div class="kpi-value neg">${brlM(r.exposicao)}</div>
  </div>
</div>`
}

function renderChartAcum(res) {
  const canvas = document.getElementById('chart-acum')
  if (!canvas) return
  const maxM = Math.max(...SC.map(k => res[k].totalM))
  const labels = Array.from({ length: maxM + 1 }, (_, i) => i)

  const mesLanc = res.base.mesLanc
  const mesEntr = res.base.mesEntr

  const datasets = SC.map(k => ({
    label: LABELS[k],
    data: res[k].fluxoAcum.slice(0, maxM + 1),
    borderColor: COLORS[k],
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.3,
  }))

  // Annotation lines via extra datasets
  const zeroLine = { label: '', data: labels.map(() => 0), borderColor: '#94a3b8', borderWidth: 1, borderDash: [4,4], pointRadius: 0, fill: false }

  if (_chartAcum) { _chartAcum.destroy(); _chartAcum = null }

  _chartAcum = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [...datasets, zeroLine] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { filter: i => i.text !== '' } },
        tooltip: {
          callbacks: {
            label: ctx => ctx.dataset.label
              ? `${ctx.dataset.label}: R$ ${Math.round(ctx.raw).toLocaleString('pt-BR')}`
              : null,
          },
        },
        annotation: {
          annotations: {
            lanc: { type: 'line', xMin: mesLanc, xMax: mesLanc, borderColor: '#94a3b8', borderWidth: 1, borderDash: [6,3], label: { content: 'Lançamento', display: true, position: 'start', font: { size: 10 } } },
            entr: { type: 'line', xMin: mesEntr, xMax: mesEntr, borderColor: '#94a3b8', borderWidth: 1, borderDash: [6,3], label: { content: 'Entrega', display: true, position: 'start', font: { size: 10 } } },
          }
        },
      },
      scales: {
        x: { title: { display: true, text: 'Mês' } },
        y: { title: { display: true, text: 'R$' }, ticks: { callback: v => 'R$ ' + fmtM(v) } },
      },
    },
  })
}

function renderChartMensal(r) {
  const canvas = document.getElementById('chart-mensal')
  if (!canvas) return
  const n = r.totalM + 1
  const labels = Array.from({ length: n }, (_, i) => i)

  if (_chartMensal) { _chartMensal.destroy(); _chartMensal = null }

  _chartMensal = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Receita Líquida', data: r.recLiqMensal.slice(0, n), backgroundColor: '#2563eb55', borderColor: '#2563eb', borderWidth: 1 },
        { label: '(-) Custos', data: r.custos.slice(0, n).map(v => -v), backgroundColor: '#dc262655', borderColor: '#dc2626', borderWidth: 1 },
        { label: 'Financiamento', data: r.disb.slice(0, n).map((v, i) => v), backgroundColor: '#f59e0b55', borderColor: '#f59e0b', borderWidth: 1 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top' }, tooltip: {
        callbacks: { label: ctx => `${ctx.dataset.label}: R$ ${Math.round(Math.abs(ctx.raw)).toLocaleString('pt-BR')}` }
      }},
      scales: {
        x: { stacked: false, title: { display: true, text: 'Mês' } },
        y: { title: { display: true, text: 'R$' }, ticks: { callback: v => 'R$ ' + fmtM(v) } },
      },
    },
  })
}

export function update(container) { renderResults(container) }
export function destroy() {
  if (_chartAcum)  { _chartAcum.destroy();  _chartAcum = null }
  if (_chartMensal){ _chartMensal.destroy(); _chartMensal = null }
}

// Helpers
function section(label) {
  return `<tr><td colspan="4" style="background:#f1f5f9;font-weight:700;font-size:0.75rem;color:#475569;padding:6px 12px;letter-spacing:0.05em">${label}</td></tr>`
}
function row(label, vals) {
  return `<tr><td>${label}</td>${vals.map(v => `<td>${v}</td>`).join('')}</tr>`
}
function rowHL(label, vals) {
  return `<tr style="background:#f8fafc"><td><strong>${label}</strong></td>${vals.map(v => `<td><strong>${v}</strong></td>`).join('')}</tr>`
}
function brl(v)       { return 'R$ ' + Math.round(v).toLocaleString('pt-BR') }
function brlN(v)      { return '(R$ ' + Math.round(v).toLocaleString('pt-BR') + ')' }
function brlC(v)      { return v >= 0 ? brl(v) : brlN(-v) }
function brlM(v)      { const m = v/1e6; return (v<0?'(R$ ':'R$ ') + Math.abs(m).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) + 'M' + (v<0?')':'') }
function pct(v, d=1)  { return (v*100).toFixed(d).replace('.', ',') + '%' }
function pctHL(v)     { return isFinite(v) && v > 0 ? pct(v, 1) : '–' }
function fmtM(v)      { const m = Math.abs(v)/1e6; return (v<0?'-':'') + m.toFixed(1).replace('.',',') + 'M' }
function esc(s)       { return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
