// ─── PARECER DE VIABILIDADE — relatório pronto pro comitê (abre em nova aba → PDF) ───
import { getState } from './store.js'
import { calcAll } from './calc.js'
import { GROUPS, COST_ROWS, readRow, calcAnchors } from './pages/premissas.js'

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const brl = v => 'R$ ' + nf0.format(Math.round(v || 0))
const pct = v => (v === null || v === undefined || Number.isNaN(v) ? '—' : nf2.format(v) + '%')
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

// mês de projeto -> rótulo de mês/ano usando a data de início
function mesLabel(p, t) {
  const base = p.data ? new Date(p.data + 'T12:00:00') : null
  if (!base) return 'm' + t
  const d = new Date(base.getFullYear(), base.getMonth() + t, 1)
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

// payback = primeiro mês em que o fluxo acumulado fica >= 0 (após ter sido negativo)
function payback(res) {
  const a = res.fluxoAcum
  let viuNeg = false
  for (let t = 0; t < a.length; t++) {
    if (a[t] < 0) viuNeg = true
    if (viuNeg && a[t] >= 0) return t
  }
  return null
}

// agrega o fluxo por ano-calendário (usa a data de início)
function fluxoAnual(p, res) {
  const base = p.data ? new Date(p.data + 'T12:00:00') : new Date(2026, 0, 1)
  const y0 = base.getFullYear(), m0 = base.getMonth()
  const anos = {}
  const add = (t, campo, v) => {
    const ano = y0 + Math.floor((m0 + t) / 12)
    anos[ano] = anos[ano] || { rec: 0, custo: 0, fin: 0, fluxo: 0 }
    anos[ano][campo] += v
  }
  for (let t = 0; t <= res.totalM; t++) {
    add(t, 'rec', res.recLiqMensal[t])
    add(t, 'custo', res.custos[t])
    add(t, 'fin', res.disb[t] - res.jurosMensal[t] - res.amortMensal[t])
    add(t, 'fluxo', res.fluxo[t])
  }
  const linhas = Object.keys(anos).sort().map(ano => ({ ano, ...anos[ano] }))
  let acum = 0
  linhas.forEach(l => { acum += l.fluxo; l.acum = acum })
  return linhas
}

// SVG simples do fluxo acumulado (cenário base) — imprime sem depender de lib
function svgAcum(res) {
  const data = res.fluxoAcum
  const n = data.length
  if (n < 2) return ''
  const min = Math.min(0, ...data), max = Math.max(0, ...data)
  const W = 760, H = 220, pad = 6
  const X = i => pad + i * (W - 2 * pad) / (n - 1)
  const Y = v => H - pad - (v - min) / ((max - min) || 1) * (H - 2 * pad)
  const pts = data.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const zeroY = Y(0).toFixed(1)
  const area = `${X(0).toFixed(1)},${zeroY} ${pts} ${X(n - 1).toFixed(1)},${zeroY}`
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:200px">
    <polygon points="${area}" fill="rgba(29,158,117,.12)"/>
    <line x1="0" y1="${zeroY}" x2="${W}" y2="${zeroY}" stroke="#cbd5e1" stroke-width="1"/>
    <polyline points="${pts}" fill="none" stroke="#1D9E75" stroke-width="2.5"/>
  </svg>`
}

// recomendação automática (sugestão — decisão final é do comitê)
function recomendacao(res, p) {
  const b = res.base, pe = res.pessimista
  const tdAA = p.taxaDescontoAA || 0
  const tirB = isFinite(b.tir) ? b.tir * 100 : null
  const margemB = b.margemFinal * 100
  if (b.vpl > 0 && (tirB === null || tirB > tdAA) && margemB >= 10 && pe.vpl >= 0)
    return { nivel: 'GO', cor: '#1D9E75', texto: 'Projeto viável em todos os cenários analisados, com VPL positivo e margem adequada inclusive no cenário pessimista. Recomenda-se aprovação.' }
  if (b.vpl > 0 && margemB >= 8)
    return { nivel: 'GO CONDICIONADO', cor: '#EF9F27', texto: 'Viável no cenário base, porém sensível no pessimista. Recomenda-se aprovação condicionada à mitigação dos riscos de preço/ritmo de vendas e ao monitoramento da exposição de caixa.' }
  return { nivel: 'NÃO RECOMENDADO', cor: '#E24B4A', texto: 'Os indicadores no cenário base não atingem os patamares mínimos de retorno/margem. Recomenda-se revisar premissas (preço, custo, permuta) antes de prosseguir.' }
}

const CEN = [['otimista', 'Otimista'], ['base', 'Base'], ['pessimista', 'Pessimista']]

export function gerarParecer() {
  const state = getState()
  const p = state.premissas
  const res = calcAll(state)
  const A = calcAnchors(p, state.unidades)
  const rec = recomendacao(res, p)
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const mesEntr = res.base.mesEntr

  // ── Indicadores por cenário ──
  const indLinhas = [
    ['VGV bruto', c => brl(c.vgvBruto)],
    ['VGV ajustado', c => brl(c.vgvAjustado)],
    ['Receita líquida', c => brl(c.recLiqTotal)],
    ['Custos totais', c => brl(c.totalCustos)],
    ['Resultado operacional', c => brl(c.resultOp)],
    ['Custo líq. financiamento', c => brl(c.custoLiqFinanc)],
    ['Resultado final', c => brl(c.resultFinal)],
    ['Margem s/ VGV', c => pct(c.margemFinal * 100)],
    ['VPL', c => brl(c.vpl)],
    ['TIR (a.a.)', c => isFinite(c.tir) ? pct(c.tir * 100) : '—'],
    ['Exposição máx. de caixa', c => brl(c.exposicao)],
    ['Mês da exposição', c => mesLabel(p, c.mesExposicao)],
    ['Payback (acum. ≥ 0)', c => { const m = payback(c); return m === null ? '—' : mesLabel(p, m) }],
  ]
  const indHtml = `<table class="t">
    <thead><tr><th>Indicador</th>${CEN.map(([, l]) => `<th class="r">${l}</th>`).join('')}</tr></thead>
    <tbody>${indLinhas.map(([nome, fn]) =>
    `<tr><td>${nome}</td>${CEN.map(([k]) => `<td class="r">${fn(res[k])}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`

  // ── Premissas de cenário (condições de venda) ──
  const cenPrem = `<table class="t">
    <thead><tr><th>Premissa do cenário</th>${CEN.map(([, l]) => `<th class="r">${l}</th>`).join('')}</tr></thead>
    <tbody>
      ${[['Deconto/ágio s/ preço', 'desconto'], ['Entrada', 'pctEntrada'], ['Durante a obra', 'pctObra'], ['Nas chaves', 'pctChaves']]
      .map(([nome, key]) => `<tr><td>${nome}</td>${CEN.map(([k]) => `<td class="r">${pct(state.cenarios[k][key] || 0)}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>`

  // ── Premissas de custo (detalhado, base = cenário Base) ──
  const custoHtml = GROUPS.map(g => {
    const rows = COST_ROWS.map((row, i) => ({ row, i })).filter(x => x.row.group === g.id)
    if (!rows.length) return ''
    return `<tr class="grp"><td colspan="3">${g.title}</td></tr>` + rows.map(({ row }) => {
      const v = readRow(row, p, A)
      return `<tr><td>${esc(row.desc)}</td><td class="r">${brl(v.global)}</td><td class="r">${pct(v.pctVGV)}</td></tr>`
    }).join('')
  }).join('')

  // ── Fluxo de caixa anual (cenário base) ──
  const anos = fluxoAnual(p, res.base)
  const fluxoHtml = `<table class="t">
    <thead><tr><th>Ano</th><th class="r">Receita líq.</th><th class="r">Custos</th><th class="r">Financiamento líq.</th><th class="r">Fluxo</th><th class="r">Acumulado</th></tr></thead>
    <tbody>${anos.map(l => `<tr><td>${l.ano}</td><td class="r">${brl(l.rec)}</td><td class="r">${brl(-l.custo)}</td><td class="r">${brl(l.fin)}</td><td class="r">${brl(l.fluxo)}</td><td class="r">${brl(l.acum)}</td></tr>`).join('')}</tbody>
  </table>`

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Parecer de Viabilidade — ${esc(p.nome || 'Empreendimento')}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1f2937; font-size: 12px; line-height: 1.45; margin: 0; }
  h1 { font-size: 22px; margin: 0; }
  h2 { font-size: 14px; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #1D9E75; color: #0f172a; }
  .muted { color: #6b7280; }
  .cap { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f172a; padding-bottom: 12px; }
  .brand { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: #0f172a; }
  .badge { display: inline-block; color: #fff; font-weight: 700; padding: 6px 14px; border-radius: 6px; font-size: 14px; }
  .reco { border: 1px solid #e5e7eb; border-left: 6px solid; border-radius: 8px; padding: 12px 16px; margin-top: 8px; }
  table.t { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.t th, table.t td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  table.t th { background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; color: #475569; }
  table.t td.r, table.t th.r { text-align: right; font-variant-numeric: tabular-nums; }
  tr.grp td { background: #f1f5f9; font-weight: 700; font-size: 11px; text-transform: uppercase; }
  .kpis { display: flex; gap: 10px; margin-top: 10px; }
  .kpi { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
  .kpi .l { font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: .4px; }
  .kpi .v { font-size: 17px; font-weight: 700; color: #0f172a; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .avoid { page-break-inside: avoid; }
  .foot { margin-top: 26px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; }
  @media print { .noprint { display: none; } }
  .noprint { position: fixed; top: 10px; right: 10px; }
  .noprint button { background: #1D9E75; color: #fff; border: 0; border-radius: 6px; padding: 10px 16px; font-size: 14px; cursor: pointer; }
</style></head>
<body>
  <div class="noprint"><button onclick="window.print()">Salvar como PDF</button></div>

  <div class="cap">
    <div>
      <div class="brand">SOPRA</div>
      <div class="muted">Incorporações</div>
    </div>
    <div style="text-align:right">
      <h1>Parecer de Viabilidade</h1>
      <div class="muted">${esc(p.nome || 'Empreendimento')}${p.endereco ? ' · ' + esc(p.endereco) : ''}</div>
      <div class="muted">Emitido em ${hoje}</div>
    </div>
  </div>

  <h2>Recomendação</h2>
  <div class="reco avoid" style="border-left-color:${rec.cor}">
    <span class="badge" style="background:${rec.cor}">${rec.nivel}</span>
    <p style="margin:10px 0 0">${rec.texto}</p>
  </div>

  <h2>Resumo executivo (cenário base)</h2>
  <div class="kpis avoid">
    <div class="kpi"><div class="l">VGV bruto</div><div class="v">${brl(res.base.vgvBruto)}</div></div>
    <div class="kpi"><div class="l">Resultado final</div><div class="v">${brl(res.base.resultFinal)}</div></div>
    <div class="kpi"><div class="l">Margem s/ VGV</div><div class="v">${pct(res.base.margemFinal * 100)}</div></div>
  </div>
  <div class="kpis avoid">
    <div class="kpi"><div class="l">VPL</div><div class="v">${brl(res.base.vpl)}</div></div>
    <div class="kpi"><div class="l">TIR (a.a.)</div><div class="v">${isFinite(res.base.tir) ? pct(res.base.tir * 100) : '—'}</div></div>
    <div class="kpi"><div class="l">Exposição máx. de caixa</div><div class="v">${brl(res.base.exposicao)}</div></div>
  </div>

  <h2>Indicadores por cenário</h2>
  ${indHtml}

  <h2>Fluxo de caixa acumulado (cenário base)</h2>
  <div class="avoid">${svgAcum(res.base)}</div>

  <h2>Fluxo de caixa anual (cenário base)</h2>
  ${fluxoHtml}

  <div class="grid2">
    <div>
      <h2>Premissas — cronograma e receita</h2>
      <table class="t"><tbody>
        <tr><td>Início</td><td class="r">${p.data ? new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td></tr>
        <tr><td>Meses de desenvolvimento</td><td class="r">${p.mesesDesenvolvimento || 0}</td></tr>
        <tr><td>Duração do lançamento</td><td class="r">${p.duracaoLancamento || 0}</td></tr>
        <tr><td>Prazo de obra</td><td class="r">${p.prazoObra || 0}</td></tr>
        <tr><td>Entrega (mês)</td><td class="r">${mesLabel(p, mesEntr)}</td></tr>
        <tr><td>Custo total de obra</td><td class="r">${brl(A.CO)}</td></tr>
        <tr><td>Imposto s/ receita (RET)</td><td class="r">${pct(p.impostoRET || 0)}</td></tr>
        <tr><td>INCC (a.m.)</td><td class="r">${pct(p.inccMensal || 0)}</td></tr>
        <tr><td>Taxa de desconto (a.a.)</td><td class="r">${pct(p.taxaDescontoAA || 0)}</td></tr>
        <tr><td>Financiamento</td><td class="r">${pct(p.financiamentoPct || 0)} · juros ${pct(p.taxaJurosAA || 0)} a.a.</td></tr>
      </tbody></table>
    </div>
    <div>
      <h2>Premissas — condições de venda</h2>
      ${cenPrem}
    </div>
  </div>

  <h2>Premissas — custos detalhados (% do VGV)</h2>
  <table class="t"><thead><tr><th>Item</th><th class="r">Valor global</th><th class="r">% VGV</th></tr></thead>
    <tbody>${custoHtml}</tbody>
  </table>

  <h2>Sensibilidade (variação entre cenários)</h2>
  <p class="muted" style="margin:0 0 6px">Os três cenários refletem variações de preço de venda (desconto/ágio) e de ritmo de absorção. Principais riscos a monitorar: preço efetivo, velocidade de vendas, custo de obra e custo financeiro.</p>
  <table class="t">
    <thead><tr><th>Métrica</th><th class="r">Otimista</th><th class="r">Base</th><th class="r">Pessimista</th></tr></thead>
    <tbody>
      <tr><td>Resultado final</td>${CEN.map(([k]) => `<td class="r">${brl(res[k].resultFinal)}</td>`).join('')}</tr>
      <tr><td>VPL</td>${CEN.map(([k]) => `<td class="r">${brl(res[k].vpl)}</td>`).join('')}</tr>
      <tr><td>Margem s/ VGV</td>${CEN.map(([k]) => `<td class="r">${pct(res[k].margemFinal * 100)}</td>`).join('')}</tr>
    </tbody>
  </table>

  <div class="foot">
    Documento gerado automaticamente pela plataforma Sopra · Viabilidade. Os indicadores derivam das premissas cadastradas na data de emissão.
    A recomendação é uma sugestão automática e não substitui a deliberação do comitê.
  </div>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) { alert('Permita pop-ups para gerar o parecer.'); return }
  w.document.open()
  w.document.write(html)
  w.document.close()
}
