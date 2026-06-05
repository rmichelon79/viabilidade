import { getState, setPremissas } from '../store.js'
import { calcVGV } from '../calc.js'

// ─── Lógica pura ─────────────────────────────────────────────────────────────
// Âncoras: VGV (tabela de preços) e CO = custo TOTAL de obra (direto + indireto).
export function calcAnchors(p, unidades) {
  const VGV = calcVGV(unidades)
  const custoDireto = (p.custoM2 || 0) * (p.areaEquivalente || 0)
  const CO = custoDireto * (1 + (p.custoIndireto || 0) / 100)
  return { VGV, custoDireto, CO }
}

// Grupos na ordem de apresentação pedida.
export const GROUPS = [
  { id: 'terreno',   title: 'PERMUTA E CUSTOS DO TERRENO' },
  { id: 'incorp',    title: 'CUSTOS DE INCORPORAÇÃO' },
  { id: 'obra',      title: 'CUSTOS DE OBRA' },
  { id: 'comercial', title: 'CUSTOS COMERCIAIS' },
  { id: 'marketing', title: 'DESPESAS DE MARKETING' },
  { id: 'adm',       title: 'DESPESAS ADMINISTRATIVAS' },
]

// kind: 'pct' (campo % VGV) | 'obra' (custoM2×área) | 'indireto' (% custo direto)
export const COST_ROWS = [
  { group: 'terreno',   desc: 'Permuta financeira do terreno', kind: 'pct', key: 'permutaFinanceira' },
  { group: 'terreno',   desc: 'Permuta física do terreno',     kind: 'pct', key: 'permutaFisica' },
  { group: 'terreno',   desc: 'Aquisição do Terreno',          kind: 'pct', key: 'aquisicaoTerreno' },
  { group: 'terreno',   desc: 'Legalização do Terreno (ITBI)', kind: 'pct', key: 'itbiRegistro' },
  { group: 'terreno',   desc: 'IPTU do Terreno (a.a.)',        kind: 'pct', key: 'iptuAnual' },
  { group: 'incorp',    desc: 'Consultorias e Projetos de Incorporação', kind: 'pct', key: 'projetos' },
  { group: 'incorp',    desc: 'Alvarás e licenças',            kind: 'pct', key: 'alvaras' },
  { group: 'incorp',    desc: 'Taxas e Registros da Incorporação', kind: 'pct', key: 'registrosInc' },
  { group: 'incorp',    desc: 'Seguros da Incorporação',       kind: 'pct', key: 'seguros' },
  { group: 'obra',      desc: 'Custo direto de obra',          kind: 'obra' },
  { group: 'obra',      desc: 'Custo indireto (BDI, fiscaliz.)', kind: 'indireto' },
  { group: 'comercial', desc: 'Comissões de vendas',           kind: 'pct', key: 'comissoes' },
  { group: 'comercial', desc: 'Equipe Comercial',              kind: 'pct', key: 'gestaoComercial' },
  { group: 'marketing', desc: 'Marketing',                     kind: 'pct', key: 'marketing' },
  { group: 'adm',       desc: 'Gestão da incorporação / adm',  kind: 'pct', key: 'gestaoAdm' },
]

const EDITAVEIS = {
  pct:      ['global', 'pctVGV', 'pctCO'],
  obra:     ['global', 'pctVGV'],
  indireto: ['global', 'pctVGV'],
}
function isEditable(row, col) { return EDITAVEIS[row.kind].includes(col) }

export function readRow(row, p, A) {
  const safe = (n, dd) => (dd ? n / dd : 0)
  if (row.kind === 'pct') {
    const pctVGV = p[row.key] || 0
    const global = pctVGV / 100 * A.VGV
    return { global, pctVGV, pctCO: safe(global, A.CO) * 100 }
  }
  if (row.kind === 'obra') {
    const global = (p.areaEquivalente || 0) * (p.custoM2 || 0)
    return { global, pctVGV: safe(global, A.VGV) * 100, pctCO: safe(global, A.CO) * 100 }
  }
  const global = A.custoDireto * (p.custoIndireto || 0) / 100
  return { global, pctVGV: safe(global, A.VGV) * 100, pctCO: safe(global, A.CO) * 100 }
}

export function writeRow(row, col, val, p, A) {
  const v = Number(val) || 0
  const safe = (n, dd) => (dd ? n / dd : 0)
  if (row.kind === 'pct') {
    if (col === 'pctVGV') return { [row.key]: v }
    if (col === 'global') return { [row.key]: safe(v, A.VGV) * 100 }
    if (col === 'pctCO')  return { [row.key]: safe(v / 100 * A.CO, A.VGV) * 100 }
  } else if (row.kind === 'obra') {
    const area = p.areaEquivalente || 0
    if (col === 'global') return { custoM2: safe(v, area) }
    if (col === 'pctVGV') return { custoM2: safe(v / 100 * A.VGV, area) }
  } else if (row.kind === 'indireto') {
    if (col === 'global') return { custoIndireto: safe(v, A.custoDireto) * 100 }
    if (col === 'pctVGV') return { custoIndireto: safe(v / 100 * A.VGV, A.custoDireto) * 100 }
  }
  return {}
}

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const brl = v => 'R$ ' + nf0.format(Math.round(v || 0))
function fmtCol(col, v) {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  if (col === 'global') return nf0.format(Math.round(v))
  return nf2.format(v)
}

// ─── Render ──────────────────────────────────────────────────────────────────
function costTable(groupId) {
  const rowsHtml = COST_ROWS
    .map((row, i) => ({ row, i }))
    .filter(x => x.row.group === groupId)
    .map(({ row, i }) => {
      const cellOf = (c) => {
        if (isEditable(row, c)) return `<td class="td-r"><input class="td-input td-num" type="text" inputmode="decimal" data-r="${i}" data-c="${c}"></td>`
        return `<td class="td-r td-calc" data-cc="${c}" data-rr="${i}"></td>`
      }
      return `<tr data-row="${i}"><td class="fl">${row.desc}</td>${cellOf('global')}${cellOf('pctVGV')}${cellOf('pctCO')}</tr>`
    }).join('')
  return `
  <table class="data-table prem-mini">
    <thead><tr><th>Descrição</th><th class="th-r">Valor global</th><th class="th-r">% VGV</th><th class="th-r">% custo obra</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>`
}

export function render(container) {
  container.innerHTML = `
<div class="page-header">
  <h1 class="page-title">Premissas</h1>
  <p class="page-sub">Custos interligados (edite valor global, % VGV ou % custo obra — os outros recalculam)</p>
</div>

<style>
  .prem-mini { width:100%; }
  .prem-mini th, .prem-mini td { padding:5px 8px; }
  .prem-mini td.fl { color:#374151; }
  .prem-mini .td-calc { color:#64748b; }
  .prem-mini .td-input { width:100%; }
  .prem-card .card-title { display:flex; justify-content:space-between; align-items:baseline; }
  .prem-card .ct-sub { font-weight:400; color:#64748b; font-size:.72rem; letter-spacing:0; text-transform:none; }
  .anchor-bar { display:flex; gap:28px; flex-wrap:wrap; }
</style>

<div class="sections-grid">

  <div class="card">
    <div class="card-title">DADOS DO ESTUDO</div>
    <div class="field-stack"><label class="fl-s">Nome do empreendimento</label><input class="fi" type="text" data-key="nome"></div>
    <div class="field-stack"><label class="fl-s">Endereço</label><input class="fi" type="text" data-key="endereco"></div>
  </div>

  <div class="card">
    <div class="card-title">LINHA DO TEMPO</div>
    <div class="field-row"><label class="fl">Data de início</label><input class="fi w100" type="date" data-key="data"></div>
    <div class="field-row"><label class="fl">Meses de desenvolvimento</label><div class="fi-unit"><input class="fi w80" type="number" min="0" data-key="mesesDesenvolvimento"><span class="unit">m</span></div></div>
    <div class="field-row"><label class="fl">Prazo de obra</label><div class="fi-unit"><input class="fi w80" type="number" min="1" data-key="prazoObra"><span class="unit">m</span></div></div>
    <div class="field-row"><label class="fl">Duração do lançamento</label><div class="fi-unit"><input class="fi w80" type="number" min="1" data-key="duracaoLancamento"><span class="unit">m</span></div></div>
  </div>

  <div class="card">
    <div class="card-title">VGV E RECEITA</div>
    <div class="anchor-bar" style="margin-bottom:12px">
      <div><div class="kpi-mini-label">VGV (tabela de preços)</div><div class="kpi-mini-val" id="anchor-vgv">–</div></div>
      <div><div class="kpi-mini-label">Custo total de obra</div><div class="kpi-mini-val" id="anchor-co">–</div></div>
    </div>
    <div class="field-row"><label class="fl">Imposto sobre receita — RET</label><div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="impostoRET"><span class="unit">%</span></div></div>
    <div class="field-row"><label class="fl">INCC / correção durante obra</label><div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="inccMensal"><span class="unit">% a.m.</span></div></div>
    <div class="field-row"><label class="fl">Taxa de desconto (VPL)</label><div class="fi-unit"><input class="fi w80" type="number" step="0.5" data-key="taxaDescontoAA"><span class="unit">% a.a.</span></div></div>
  </div>

  <div class="card prem-card">
    <div class="card-title">PERMUTA E CUSTOS DO TERRENO</div>
    ${costTable('terreno')}
  </div>

  <div class="card prem-card">
    <div class="card-title">CUSTOS DE INCORPORAÇÃO</div>
    ${costTable('incorp')}
  </div>

  <div class="card prem-card">
    <div class="card-title">CUSTOS DE OBRA</div>
    <div class="field-row"><label class="fl">Área equivalente de construção</label><div class="fi-unit"><input class="fi w100" type="number" step="10" data-key="areaEquivalente"><span class="unit">m²</span></div></div>
    <div class="field-row"><label class="fl">Custo de construção</label><div class="fi-unit"><input class="fi w100" type="number" step="100" data-key="custoM2"><span class="unit">R$/m²</span></div></div>
    <div class="field-row"><label class="fl">Custo indireto (BDI, fiscalização)</label><div class="fi-unit"><input class="fi w80" type="number" step="0.5" data-key="custoIndireto"><span class="unit">% direto</span></div></div>
    <div class="divider"></div>
    ${costTable('obra')}
  </div>

  <div class="card prem-card">
    <div class="card-title">CUSTOS COMERCIAIS</div>
    ${costTable('comercial')}
  </div>

  <div class="card prem-card">
    <div class="card-title">DESPESAS DE MARKETING</div>
    ${costTable('marketing')}
  </div>

  <div class="card prem-card">
    <div class="card-title">DESPESAS ADMINISTRATIVAS</div>
    ${costTable('adm')}
  </div>

  <div class="card">
    <div class="card-title">FINANCIAMENTO</div>
    <div class="field-row"><label class="fl">Financiamento (% custo direto)</label><div class="fi-unit"><input class="fi w80" type="number" step="1" data-key="financiamentoPct"><span class="unit">%</span></div></div>
    <div class="field-row"><label class="fl">Taxa de juros</label><div class="fi-unit"><input class="fi w80" type="number" step="0.1" data-key="taxaJurosAA"><span class="unit">% a.a.</span></div></div>
    <div class="field-row"><label class="fl">Mês de início do financiamento</label><div class="fi-unit"><input class="fi w80" type="number" step="1" data-key="mesInicioFinanciamento"><span class="unit">m</span></div></div>
    <div class="field-row"><label class="fl">Prazo de amortização (0 = na entrega)</label><div class="fi-unit"><input class="fi w80" type="number" step="1" data-key="prazoAmortizacao"><span class="unit">m</span></div></div>
  </div>

</div>
`
  // popula parâmetros
  const p = getState().premissas
  container.querySelectorAll('[data-key]').forEach(el => { if (el.dataset.key in p) el.value = p[el.dataset.key] })
  refreshGrid(container)

  // listener delegado: parâmetros (data-key) + células de custo (data-c)
  container.addEventListener('input', e => {
    const el = e.target
    if (el.dataset.key !== undefined) {
      const v = el.type === 'number' ? (parseFloat(el.value) || 0) : el.value
      setPremissas({ [el.dataset.key]: v })
      if (['custoM2', 'areaEquivalente', 'custoIndireto'].includes(el.dataset.key)) refreshGrid(container, el)
      return
    }
    if (el.dataset.c !== undefined) {
      const row = COST_ROWS[Number(el.dataset.r)]
      const pNow = getState().premissas
      const A = calcAnchors(pNow, getState().unidades)
      setPremissas(writeRow(row, el.dataset.c, el.value, pNow, A))
      refreshGrid(container, el)
    }
  })
}

// Recalcula e reescreve todas as células (exceto a em edição) + âncoras.
function refreshGrid(container, exceptEl) {
  const p = getState().premissas
  const A = calcAnchors(p, getState().unidades)
  COST_ROWS.forEach((row, i) => {
    const vals = readRow(row, p, A)
    container.querySelectorAll(`[data-r="${i}"]`).forEach(inp => {
      if (inp !== exceptEl) inp.value = fmtCol(inp.dataset.c, vals[inp.dataset.c])
    })
    container.querySelectorAll(`[data-rr="${i}"]`).forEach(td => {
      td.textContent = fmtCol(td.dataset.cc, vals[td.dataset.cc])
    })
  })
  const set = (id, t) => { const el = container.querySelector('#' + id); if (el) el.textContent = t }
  set('anchor-vgv', brl(A.VGV))
  set('anchor-co', brl(A.CO))
}
