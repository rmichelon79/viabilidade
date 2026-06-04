import { getState, setPremissas } from '../store.js'
import { calcVGV } from '../calc.js'

// ─── Lógica pura (testável) ──────────────────────────────────────────────────
// Âncoras: VGV (tabela de preços) e CO = custo TOTAL de obra (direto + indireto).
export function calcAnchors(p, unidades) {
  const VGV = calcVGV(unidades)
  const custoDireto = (p.custoM2 || 0) * (p.areaEquivalente || 0)
  const CO = custoDireto * (1 + (p.custoIndireto || 0) / 100)
  return { VGV, custoDireto, CO }
}

// Linhas de custo. kind: 'pct' (campo é % VGV) | 'obra' (custoM2×área) | 'indireto' (% custo direto)
export const COST_ROWS = [
  { desc: 'Aquisição do terreno',            un: '% VGV', kind: 'pct', key: 'aquisicaoTerreno' },
  { desc: 'ITBI e registro',                 un: '% VGV', kind: 'pct', key: 'itbiRegistro' },
  { desc: 'Projetos',                        un: '% VGV', kind: 'pct', key: 'projetos' },
  { desc: 'Alvarás e licenças',              un: '% VGV', kind: 'pct', key: 'alvaras' },
  { desc: 'Registros e incorporação',        un: '% VGV', kind: 'pct', key: 'registrosInc' },
  { desc: 'Seguros',                         un: '% VGV', kind: 'pct', key: 'seguros' },
  { desc: 'Custo de obra (direto)',          un: 'm²',    kind: 'obra' },
  { desc: 'Custo indireto (BDI, fiscaliz.)', un: '—',     kind: 'indireto' },
  { desc: 'Comissões de venda',              un: '% VGV', kind: 'pct', key: 'comissoes' },
  { desc: 'Gestão comercial',                un: '% VGV', kind: 'pct', key: 'gestaoComercial' },
  { desc: 'Marketing',                       un: '% VGV', kind: 'pct', key: 'marketing' },
  { desc: 'Gestão da incorporação / adm',    un: '% VGV', kind: 'pct', key: 'gestaoAdm' },
]

// Colunas editáveis por tipo de linha (as demais são calculadas/bloqueadas).
const EDITAVEIS = {
  pct:      ['global', 'pctVGV', 'pctCO'],
  obra:     ['qtd', 'vu', 'global', 'pctVGV'],
  indireto: ['global', 'pctVGV'],
}

function isEditable(row, col) { return EDITAVEIS[row.kind].includes(col) }

// Lê os valores de uma linha a partir das premissas + âncoras.
export function readRow(row, p, A) {
  const safe = (n, dd) => (dd ? n / dd : 0)
  if (row.kind === 'pct') {
    const pctVGV = p[row.key] || 0
    const global = pctVGV / 100 * A.VGV
    return { qtd: null, vu: null, global, pctVGV, pctCO: safe(global, A.CO) * 100 }
  }
  if (row.kind === 'obra') {
    const qtd = p.areaEquivalente || 0
    const vu = p.custoM2 || 0
    const global = qtd * vu
    return { qtd, vu, global, pctVGV: safe(global, A.VGV) * 100, pctCO: safe(global, A.CO) * 100 }
  }
  const global = A.custoDireto * (p.custoIndireto || 0) / 100
  return { qtd: null, vu: null, global, pctVGV: safe(global, A.VGV) * 100, pctCO: safe(global, A.CO) * 100 }
}

// Dado um edit (coluna + valor), devolve o patch de premissas a salvar.
export function writeRow(row, col, val, p, A) {
  const v = Number(val) || 0
  const safe = (n, dd) => (dd ? n / dd : 0)
  if (row.kind === 'pct') {
    if (col === 'pctVGV') return { [row.key]: v }
    if (col === 'global') return { [row.key]: safe(v, A.VGV) * 100 }
    if (col === 'pctCO')  return { [row.key]: safe(v / 100 * A.CO, A.VGV) * 100 }
  } else if (row.kind === 'obra') {
    const area = p.areaEquivalente || 0
    if (col === 'qtd')    return { areaEquivalente: v }
    if (col === 'vu')     return { custoM2: v }
    if (col === 'global') return { custoM2: safe(v, area) }
    if (col === 'pctVGV') return { custoM2: safe(v / 100 * A.VGV, area) }
  } else if (row.kind === 'indireto') {
    if (col === 'global') return { custoIndireto: safe(v, A.custoDireto) * 100 }
    if (col === 'pctVGV') return { custoIndireto: safe(v / 100 * A.VGV, A.custoDireto) * 100 }
  }
  return {}
}

// ─── Formatação ──────────────────────────────────────────────────────────────
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function fmtCol(col, v) {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  if (col === 'global' || col === 'vu') return nf0.format(Math.round(v))
  if (col === 'qtd') return nf0.format(v)
  return nf2.format(v)
}

// ─── Render ──────────────────────────────────────────────────────────────────
export function render(container) {
  container.innerHTML = `
<div class="page-header">
  <h1 class="page-title">Premissas</h1>
  <p class="page-sub">Custos em planilha (campos interligados) + parâmetros do estudo</p>
</div>

<div class="card" style="overflow-x:auto">
  <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:14px">
    <div><div class="kpi-mini-label">VGV (tabela de preços)</div><div class="kpi-mini-val" id="anchor-vgv">–</div></div>
    <div><div class="kpi-mini-label">Custo total de obra</div><div class="kpi-mini-val" id="anchor-co">–</div></div>
  </div>
  <table class="data-table" id="prem-table">
    <thead><tr>
      <th>Descrição</th><th>Unid.</th>
      <th class="th-r">Qtd</th><th class="th-r">Valor unitário</th>
      <th class="th-r">Valor global</th><th class="th-r">% do VGV</th><th class="th-r">% custo obra</th>
    </tr></thead>
    <tbody id="prem-body"></tbody>
    <tfoot><tr class="total-row">
      <td colspan="4"><strong>TOTAL DE CUSTOS</strong></td>
      <td class="td-r"><strong id="prem-tot-global"></strong></td>
      <td class="td-r"><strong id="prem-tot-vgv"></strong></td>
      <td></td>
    </tr></tfoot>
  </table>
  <p class="page-sub" style="margin-top:8px;font-size:.72rem">
    Edite <strong>qualquer</strong> das colunas Valor global / % do VGV / % custo obra — as outras recalculam.
    Em "Custo de obra", edite Qtd (área) ou Valor unitário (R$/m²). "% custo obra" das linhas de obra é fixo (elas definem o custo de obra).
  </p>
</div>

<div class="sections-grid">
  <div class="card">
    <div class="card-title">DADOS DO ESTUDO</div>
    <div class="field-stack"><label class="fl-s">Nome do empreendimento</label><input class="fi" type="text" data-key="nome"></div>
    <div class="field-stack"><label class="fl-s">Endereço</label><input class="fi" type="text" data-key="endereco"></div>
    <div class="field-row" style="padding-top:8px"><label class="fl">Data base</label><input class="fi w100" type="date" data-key="data"></div>
  </div>
  <div class="card">
    <div class="card-title">LINHA DO TEMPO</div>
    <div class="field-row"><label class="fl">Meses de desenvolvimento</label><div class="fi-unit"><input class="fi w80" type="number" min="0" data-key="mesesDesenvolvimento"><span class="unit">m</span></div></div>
    <div class="field-row"><label class="fl">Prazo de obra</label><div class="fi-unit"><input class="fi w80" type="number" min="1" data-key="prazoObra"><span class="unit">m</span></div></div>
    <div class="field-row"><label class="fl">Duração do lançamento</label><div class="fi-unit"><input class="fi w80" type="number" min="1" data-key="duracaoLancamento"><span class="unit">m</span></div></div>
  </div>
  <div class="card">
    <div class="card-title">RECEITAS, IMPOSTOS E PERMUTAS</div>
    <div class="field-row"><label class="fl">Imposto sobre receita — RET</label><div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="impostoRET"><span class="unit">%</span></div></div>
    <div class="field-row"><label class="fl">INCC / correção durante obra</label><div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="inccMensal"><span class="unit">% a.m.</span></div></div>
    <div class="field-row"><label class="fl">Permuta financeira do terreno</label><div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="permutaFinanceira"><span class="unit">% VGV</span></div></div>
    <div class="field-row"><label class="fl">Permuta física do terreno</label><div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="permutaFisica"><span class="unit">% VGV</span></div></div>
    <div class="field-row"><label class="fl">IPTU do terreno</label><div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="iptuAnual"><span class="unit">% VGV/ano</span></div></div>
  </div>
  <div class="card">
    <div class="card-title">FINANCIAMENTO E DESCONTO</div>
    <div class="field-row"><label class="fl">Financiamento (% custo direto)</label><div class="fi-unit"><input class="fi w80" type="number" step="1" data-key="financiamentoPct"><span class="unit">%</span></div></div>
    <div class="field-row"><label class="fl">Taxa de juros</label><div class="fi-unit"><input class="fi w80" type="number" step="0.1" data-key="taxaJurosAA"><span class="unit">% a.a.</span></div></div>
    <div class="field-row"><label class="fl">Mês de início do financiamento</label><div class="fi-unit"><input class="fi w80" type="number" step="1" data-key="mesInicioFinanciamento"><span class="unit">m</span></div></div>
    <div class="field-row"><label class="fl">Prazo de amortização (0 = na entrega)</label><div class="fi-unit"><input class="fi w80" type="number" step="1" data-key="prazoAmortizacao"><span class="unit">m</span></div></div>
    <div class="field-row"><label class="fl">Taxa de desconto (VPL)</label><div class="fi-unit"><input class="fi w80" type="number" step="0.5" data-key="taxaDescontoAA"><span class="unit">% a.a.</span></div></div>
  </div>
</div>
`
  renderGrid(container)

  const p = getState().premissas
  container.querySelectorAll('[data-key]').forEach(el => { if (el.dataset.key in p) el.value = p[el.dataset.key] })
  container.addEventListener('input', e => {
    const el = e.target
    if (!el.dataset.key) return
    const v = el.type === 'number' ? (parseFloat(el.value) || 0) : el.value
    setPremissas({ [el.dataset.key]: v })
    if (el.dataset.key === 'custoM2' || el.dataset.key === 'areaEquivalente' || el.dataset.key === 'custoIndireto') refreshGrid(container)
  })
}

function renderGrid(container) {
  const p = getState().premissas
  const A = calcAnchors(p, getState().unidades)
  const COLS = ['qtd', 'vu', 'global', 'pctVGV', 'pctCO']
  const body = container.querySelector('#prem-body')
  body.innerHTML = COST_ROWS.map((row, i) => {
    const vals = readRow(row, p, A)
    const cells = COLS.map(c => {
      const editable = isEditable(row, c)
      const val = fmtCol(c, vals[c])
      if (!editable) return `<td class="td-r td-calc" data-cc="${c}">${(c === 'qtd' || c === 'vu') && vals[c] === null ? '' : val}</td>`
      return `<td class="td-r"><input class="td-input td-num" type="text" inputmode="decimal" data-r="${i}" data-c="${c}" value="${val}"></td>`
    }).join('')
    return `<tr data-row="${i}"><td>${row.desc}</td><td class="unit">${row.un}</td>${cells}</tr>`
  }).join('')
  refreshAnchorsAndTotals(container, p, A)

  body.addEventListener('input', e => {
    const el = e.target
    if (el.dataset.c === undefined) return
    const row = COST_ROWS[Number(el.dataset.r)]
    const pNow = getState().premissas
    const Anow = calcAnchors(pNow, getState().unidades)
    setPremissas(writeRow(row, el.dataset.c, el.value, pNow, Anow))
    refreshGrid(container, el)
  })
}

// Recalcula e reescreve todas as células (exceto a em edição) + âncoras/totais.
function refreshGrid(container, exceptEl) {
  const p = getState().premissas
  const A = calcAnchors(p, getState().unidades)
  container.querySelectorAll('#prem-body tr[data-row]').forEach(tr => {
    const i = Number(tr.dataset.row)
    const vals = readRow(COST_ROWS[i], p, A)
    tr.querySelectorAll('[data-c]').forEach(inp => { if (inp !== exceptEl) inp.value = fmtCol(inp.dataset.c, vals[inp.dataset.c]) })
    tr.querySelectorAll('td[data-cc]').forEach(td => {
      const c = td.dataset.cc
      td.textContent = (c === 'qtd' || c === 'vu') && vals[c] === null ? '' : fmtCol(c, vals[c])
    })
  })
  refreshAnchorsAndTotals(container, p, A)
}

function refreshAnchorsAndTotals(container, p, A) {
  const brl = v => 'R$ ' + nf0.format(Math.round(v))
  const set = (id, t) => { const el = container.querySelector('#' + id); if (el) el.textContent = t }
  set('anchor-vgv', brl(A.VGV))
  set('anchor-co', brl(A.CO))
  let totG = 0
  COST_ROWS.forEach(row => { totG += readRow(row, p, A).global })
  set('prem-tot-global', brl(totG))
  set('prem-tot-vgv', (A.VGV ? (totG / A.VGV * 100) : 0).toFixed(1).replace('.', ',') + '%')
}
