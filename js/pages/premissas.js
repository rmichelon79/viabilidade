import { getState, setPremissas } from '../store.js'

export function render(container) {
  container.innerHTML = `
<div class="page-header">
  <h1 class="page-title">Premissas</h1>
  <p class="page-sub">Parâmetros base do estudo de viabilidade</p>
</div>

<div class="sections-grid">

<!-- DADOS DO ESTUDO -->
<div class="card">
  <div class="card-title">DADOS DO ESTUDO</div>
  <div class="field-stack">
    <label class="fl-s">Nome do empreendimento</label>
    <input class="fi" type="text" data-key="nome" placeholder="Ex: Residencial Central Park">
  </div>
  <div class="field-stack">
    <label class="fl-s">Endereço</label>
    <input class="fi" type="text" data-key="endereco" placeholder="Rua, número — Cidade/UF">
  </div>
  <div class="field-row" style="padding-top:8px">
    <label class="fl">Data base</label>
    <input class="fi w100" type="date" data-key="data">
  </div>
</div>

<!-- LINHA DO TEMPO -->
<div class="card">
  <div class="card-title">LINHA DO TEMPO</div>
  <div class="field-row">
    <label class="fl">Meses de desenvolvimento (pré-lançamento)</label>
    <div class="fi-unit"><input class="fi w80" type="number" min="0" data-key="mesesDesenvolvimento"><span class="unit">m</span></div>
  </div>
  <div class="field-row">
    <label class="fl">Prazo de obra</label>
    <div class="fi-unit"><input class="fi w80" type="number" min="1" data-key="prazoObra"><span class="unit">m</span></div>
  </div>
  <div class="field-row">
    <label class="fl">Duração do período de lançamento</label>
    <div class="fi-unit"><input class="fi w80" type="number" min="1" data-key="duracaoLancamento"><span class="unit">m</span></div>
  </div>
  <div class="divider"></div>
  <div class="field-row calc-row">
    <label class="fl">Mês do lançamento (calculado)</label>
    <span class="fv" id="calc-lancamento">–</span>
  </div>
  <div class="field-row calc-row">
    <label class="fl">Mês de entrega (calculado)</label>
    <span class="fv" id="calc-entrega">–</span>
  </div>
  <div class="field-row calc-row">
    <label class="fl">Total de meses do projeto</label>
    <span class="fv" id="calc-total">–</span>
  </div>
</div>

<!-- RECEITAS, IMPOSTOS E PERMUTAS -->
<div class="card">
  <div class="card-title">RECEITAS, IMPOSTOS E PERMUTAS</div>
  <div class="field-row">
    <label class="fl">Imposto sobre receita — RET</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="impostoRET"><span class="unit">%</span></div>
  </div>
  <div class="field-row">
    <label class="fl">INCC / correção durante obra</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="inccMensal"><span class="unit">% a.m.</span></div>
  </div>
  <div class="field-row">
    <label class="fl">Permuta financeira do terreno</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="permutaFinanceira"><span class="unit">% VGV</span></div>
  </div>
  <div class="field-row">
    <label class="fl">Permuta física do terreno</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="permutaFisica"><span class="unit">% VGV</span></div>
  </div>
  <div class="field-row calc-row">
    <label class="fl">Total deduções sobre receita</label>
    <span class="fv" id="calc-deducoes">–</span>
  </div>
</div>

<!-- CUSTOS DE TERRENO -->
<div class="card">
  <div class="card-title">CUSTOS DE TERRENO</div>
  <div class="field-row">
    <label class="fl">Aquisição em dinheiro</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="aquisicaoTerreno"><span class="unit">% VGV</span></div>
  </div>
  <div class="field-row">
    <label class="fl">ITBI e registro</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="itbiRegistro"><span class="unit">% VGV</span></div>
  </div>
  <div class="field-row">
    <label class="fl">IPTU do terreno</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="iptuAnual"><span class="unit">% VGV/ano</span></div>
  </div>
</div>

<!-- CUSTOS DE INCORPORAÇÃO E OBRA -->
<div class="card">
  <div class="card-title">CUSTOS DE INCORPORAÇÃO E OBRA</div>
  <div class="field-row">
    <label class="fl">Projetos</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="projetos"><span class="unit">% VGV</span></div>
  </div>
  <div class="field-row">
    <label class="fl">Alvarás e licenças</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="alvaras"><span class="unit">% VGV</span></div>
  </div>
  <div class="field-row">
    <label class="fl">Registros e incorporação</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="registrosInc"><span class="unit">% VGV</span></div>
  </div>
  <div class="field-row">
    <label class="fl">Seguros</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.01" data-key="seguros"><span class="unit">% VGV</span></div>
  </div>
  <div class="divider"></div>
  <div class="field-row">
    <label class="fl">Custo de construção (R$/m²)</label>
    <div class="fi-unit"><input class="fi w100" type="number" step="100" data-key="custoM2"><span class="unit">R$/m²</span></div>
  </div>
  <div class="field-row">
    <label class="fl">Área equivalente de construção</label>
    <div class="fi-unit"><input class="fi w100" type="number" step="10" data-key="areaEquivalente"><span class="unit">m²</span></div>
  </div>
  <div class="field-row calc-row">
    <label class="fl">Custo direto de obra (calculado)</label>
    <span class="fv" id="calc-custodireto">–</span>
  </div>
  <div class="field-row">
    <label class="fl">Custo indireto (BDI, fiscalização)</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.5" data-key="custoIndireto"><span class="unit">% custo direto</span></div>
  </div>
  <div class="field-row calc-row">
    <label class="fl">Custo total de obra (calculado)</label>
    <span class="fv" id="calc-custo-obra">–</span>
  </div>
</div>

<!-- DESPESAS COMERCIAIS -->
<div class="card">
  <div class="card-title">DESPESAS COMERCIAIS, MARKETING E ADM</div>
  <div class="field-row">
    <label class="fl">Comissões de venda</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.1" data-key="comissoes"><span class="unit">% VGV</span></div>
  </div>
  <div class="field-row">
    <label class="fl">Gestão comercial</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.1" data-key="gestaoComercial"><span class="unit">% VGV</span></div>
  </div>
  <div class="field-row">
    <label class="fl">Marketing</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.1" data-key="marketing"><span class="unit">% VGV</span></div>
  </div>
  <div class="field-row">
    <label class="fl">Gestão da incorporação / adm</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.1" data-key="gestaoAdm"><span class="unit">% VGV</span></div>
  </div>
  <div class="field-row calc-row">
    <label class="fl">Total despesas comerciais</label>
    <span class="fv" id="calc-comercial">–</span>
  </div>
</div>

<!-- FINANCIAMENTO BANCÁRIO -->
<div class="card">
  <div class="card-title">FINANCIAMENTO BANCÁRIO</div>
  <div class="field-row">
    <label class="fl">Financiamento (% custo direto de obra)</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="1" data-key="financiamentoPct"><span class="unit">%</span></div>
  </div>
  <div class="field-row">
    <label class="fl">Taxa de juros</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.1" data-key="taxaJurosAA"><span class="unit">% a.a.</span></div>
  </div>
  <div class="field-row calc-row">
    <label class="fl">Taxa equivalente mensal (calculada)</label>
    <span class="fv" id="calc-taxa-mensal">–</span>
  </div>
  <div class="field-row">
    <label class="fl">Mês de início do financiamento</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="1" data-key="mesInicioFinanciamento"><span class="unit">m</span></div>
  </div>
  <div class="field-row">
    <label class="fl">Prazo de amortização (0 = pago na entrega)</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="1" data-key="prazoAmortizacao"><span class="unit">m</span></div>
  </div>
  <div class="field-row calc-row">
    <label class="fl">Volume financiado (calculado)</label>
    <span class="fv" id="calc-volume-financ">–</span>
  </div>
</div>

<!-- TAXA DE DESCONTO VPL -->
<div class="card">
  <div class="card-title">TAXA DE DESCONTO (VPL)</div>
  <div class="field-row">
    <label class="fl">Taxa de desconto (custo de oportunidade)</label>
    <div class="fi-unit"><input class="fi w80" type="number" step="0.5" data-key="taxaDescontoAA"><span class="unit">% a.a.</span></div>
  </div>
  <div class="field-row calc-row">
    <label class="fl">Taxa mensal equivalente</label>
    <span class="fv" id="calc-taxa-desconto">–</span>
  </div>
</div>

</div><!-- /sections-grid -->
`

  populate(container)
  bindInputs(container)
}

function populate(container) {
  const p = getState().premissas
  container.querySelectorAll('[data-key]').forEach(el => {
    const k = el.dataset.key
    if (k in p) el.value = p[k]
  })
  updateCalcs(p)
}

function bindInputs(container) {
  container.addEventListener('input', e => {
    const el = e.target
    if (!el.dataset.key) return
    const k = el.dataset.key
    const v = el.type === 'number' ? parseFloat(el.value) || 0 : el.value
    setPremissas({ [k]: v })
    updateCalcs(getState().premissas)
  })
}

function updateCalcs(p) {
  const mesLanc = (p.mesesDesenvolvimento || 0) | 0
  const prazo   = (p.prazoObra || 0) | 0
  const entrega = mesLanc + prazo
  const total   = entrega + 6

  set('calc-lancamento', `m ${mesLanc}`)
  set('calc-entrega', `m ${entrega}`)
  set('calc-total', `${total} meses`)
  set('calc-deducoes', fmt(((p.impostoRET || 0) + (p.permutaFinanceira || 0) + (p.permutaFisica || 0)), 2) + '%')

  const custoDireto = (p.custoM2 || 0) * (p.areaEquivalente || 0)
  const custoIndir  = custoDireto * (p.custoIndireto || 0) / 100
  set('calc-custodireto', brl(custoDireto))
  set('calc-custo-obra', brl(custoDireto + custoIndir))
  set('calc-comercial', fmt((p.comissoes||0)+(p.gestaoComercial||0)+(p.marketing||0)+(p.gestaoAdm||0), 1) + '% VGV')

  const tjm = (Math.pow(1 + (p.taxaJurosAA||0)/100, 1/12) - 1) * 100
  set('calc-taxa-mensal', fmt(tjm, 4) + '% a.m.')
  const volFinanc = custoDireto * (p.financiamentoPct || 0) / 100
  set('calc-volume-financ', brl(volFinanc))

  const tdm = (Math.pow(1 + (p.taxaDescontoAA||0)/100, 1/12) - 1) * 100
  set('calc-taxa-desconto', fmt(tdm, 4) + '% a.m.')
}

function set(id, val) {
  const el = document.getElementById(id)
  if (el) el.textContent = val
}

function brl(v) {
  return 'R$ ' + String(Math.round(Math.abs(v))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmt(v, dec) {
  return v.toFixed(dec).replace('.', ',')
}
