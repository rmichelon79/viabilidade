import { getState, setUnidades } from '../store.js'
import { calcVGV } from '../calc.js'

let nextId = 100

export function render(container) {
  container.innerHTML = `
<div class="page-header">
  <h1 class="page-title">Tabela de Preços</h1>
  <p class="page-sub">Cadastro de unidades do empreendimento</p>
</div>

<div class="card" style="overflow-x:auto">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div class="card-title" style="margin:0">UNIDADES</div>
    <button class="btn-add" id="btn-add-unit">+ Adicionar Unidade</button>
  </div>
  <table class="data-table" id="units-table">
    <thead>
      <tr>
        <th>Código</th>
        <th>Tipologia</th>
        <th>Qtd</th>
        <th>Área Priv. (m²)</th>
        <th>Preço Base / un (R$)</th>
        <th>VGV Linha (R$)</th>
        <th>% VGV</th>
        <th></th>
      </tr>
    </thead>
    <tbody id="units-body"></tbody>
    <tfoot>
      <tr id="units-total-row" class="total-row">
        <td colspan="2"><strong>TOTAL</strong></td>
        <td id="tot-qtd"></td>
        <td id="tot-area"></td>
        <td>–</td>
        <td id="tot-vgv"></td>
        <td>100%</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
</div>

<div class="card" style="margin-top:16px">
  <div class="card-title">RESUMO</div>
  <div class="kpi-row">
    <div class="kpi-mini"><div class="kpi-mini-label">Nº de Unidades</div><div class="kpi-mini-val" id="res-nunits">–</div></div>
    <div class="kpi-mini"><div class="kpi-mini-label">Área Total Privativa</div><div class="kpi-mini-val" id="res-area">–</div></div>
    <div class="kpi-mini"><div class="kpi-mini-label">VGV Bruto</div><div class="kpi-mini-val" id="res-vgv">–</div></div>
    <div class="kpi-mini"><div class="kpi-mini-label">Ticket Médio</div><div class="kpi-mini-val" id="res-ticket">–</div></div>
    <div class="kpi-mini"><div class="kpi-mini-label">Preço Médio / m²</div><div class="kpi-mini-val" id="res-pm2">–</div></div>
  </div>
</div>
`

  renderRows(container)

  document.getElementById('btn-add-unit').addEventListener('click', () => {
    const uns = getState().unidades.slice()
    uns.push({ id: 'U' + (++nextId), tipologia: '', qtd: 1, areaPriv: 0, precoBase: 0 })
    setUnidades(uns)
    renderRows(container)
  })

  container.querySelector('#units-body').addEventListener('input', e => {
    handleInput(e, container)
  })

  container.querySelector('#units-body').addEventListener('click', e => {
    if (e.target.classList.contains('btn-del')) {
      const id = e.target.dataset.id
      setUnidades(getState().unidades.filter(u => u.id !== id))
      renderRows(container)
    }
  })
}

function handleInput(e, container) {
  const el = e.target
  const id = el.closest('tr')?.dataset.id
  if (!id) return
  const key = el.dataset.key
  const uns = getState().unidades.map(u => {
    if (u.id !== id) return u
    const val = (key === 'tipologia') ? el.value : (parseFloat(el.value) || 0)
    return { ...u, [key]: val }
  })
  setUnidades(uns)
  updateRow(document.querySelector(`tr[data-id="${id}"]`), uns.find(u => u.id === id))
  updateSummary(container, uns)
}

function renderRows(container) {
  const uns = getState().unidades
  const vgv = calcVGV(uns)
  const tbody = document.getElementById('units-body')
  if (!tbody) return

  tbody.innerHTML = uns.map(u => {
    const lineVGV = (u.precoBase || 0) * (u.qtd || 1)
    const pctVGV  = vgv > 0 ? (lineVGV / vgv * 100).toFixed(2) : '0,00'
    return `
<tr data-id="${u.id}">
  <td><input class="td-input" type="text" data-key="id" value="${esc(u.id)}"></td>
  <td><input class="td-input td-wide" type="text" data-key="tipologia" value="${esc(u.tipologia)}"></td>
  <td><input class="td-input td-num" type="number" min="1" step="1" data-key="qtd" value="${u.qtd||1}"></td>
  <td><input class="td-input td-num" type="number" min="0" step="0.01" data-key="areaPriv" value="${u.areaPriv||0}"></td>
  <td><input class="td-input td-num" type="number" min="0" step="1000" data-key="precoBase" value="${u.precoBase||0}"></td>
  <td class="td-calc">${numBR(lineVGV)}</td>
  <td class="td-calc">${pctVGV.replace('.', ',')}%</td>
  <td><button class="btn-del" data-id="${u.id}">✕</button></td>
</tr>`
  }).join('')

  updateSummary(container, uns)
}

function updateRow(tr, u) {
  if (!tr) return
  const vgv = calcVGV(getState().unidades)
  const lineVGV = (u.precoBase || 0) * (u.qtd || 1)
  const pctVGV  = vgv > 0 ? (lineVGV / vgv * 100).toFixed(2) : '0,00'
  tr.querySelector('.td-calc:nth-child(6)').textContent = numBR(lineVGV)
  tr.querySelector('.td-calc:nth-child(7)').textContent = pctVGV.replace('.', ',') + '%'
}

function updateSummary(container, uns) {
  const vgv = calcVGV(uns)
  const nUnits = uns.reduce((s, u) => s + (u.qtd || 1), 0)
  const areaTotal = uns.reduce((s, u) => s + (u.areaPriv || 0) * (u.qtd || 1), 0)
  const ticket = nUnits > 0 ? vgv / nUnits : 0
  const pm2 = areaTotal > 0 ? vgv / areaTotal : 0

  set('tot-qtd', nUnits)
  set('tot-area', numBR(areaTotal) + ' m²')
  set('tot-vgv', numBR(vgv))
  set('res-nunits', nUnits)
  set('res-area', numBR(areaTotal) + ' m²')
  set('res-vgv', 'R$ ' + numBRM(vgv))
  set('res-ticket', 'R$ ' + numBRM(ticket))
  set('res-pm2', 'R$ ' + numBR(Math.round(pm2)))
}

function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val }
function numBR(v) { return Math.round(v).toLocaleString('pt-BR') }
function numBRM(v) { return (v/1e6).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) + 'M' }
function esc(s) { return String(s||'').replace(/"/g,'&quot;') }
