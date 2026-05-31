import { getCurve } from './curvass.js'

export function calcVGV(unidades) {
  return unidades.reduce((s, u) => s + (u.precoBase || 0) * (u.qtd || 1), 0)
}

function calcNPV(flows, r) {
  return flows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0)
}

function calcIRR(flows) {
  // Try multiple starting points; pick result with smallest |NPV|
  const starts = [0.005, 0.01, 0.02, 0.03, 0.05]
  let best = NaN, bestNPV = Infinity
  for (const s0 of starts) {
    let rate = s0
    for (let i = 0; i < 500; i++) {
      let npv = 0, dnpv = 0
      for (let t = 0; t < flows.length; t++) {
        const f = Math.pow(1 + rate, t)
        npv += flows[t] / f
        dnpv -= t * flows[t] / (f * (1 + rate))
      }
      if (Math.abs(dnpv) < 1e-14) break
      const nr = rate - npv / dnpv
      if (!isFinite(nr)) break
      if (Math.abs(nr - rate) < 1e-12) { rate = nr; break }
      rate = Math.max(-0.9999, Math.min(5, nr))
    }
    let npv0 = flows.reduce((s, cf, t) => s + cf / Math.pow(1 + rate, t), 0)
    if (Math.abs(npv0) < bestNPV && rate > -0.999) { best = rate; bestNPV = Math.abs(npv0) }
  }
  return isFinite(best) ? Math.pow(1 + best, 12) - 1 : NaN
}

// Convert UI % values (e.g. 5) to decimal (0.05)
function d(pctVal) { return pctVal / 100 }

export function calcScenario(p, unidades, sc, nome) {
  const mesLanc = p.mesesDesenvolvimento | 0
  const mesEntr = mesLanc + (p.prazoObra | 0)
  // Extend totalM to cover all absorption months (pessimista may sell post-delivery)
  const abs = sc.absorcao || []
  const lastAbsMonth = abs.reduce((max, v, i) => v > 0 ? i : max, 0)
  const totalM = Math.max(mesEntr + 6, lastAbsMonth + 1)

  const vgvBruto = calcVGV(unidades)
  const descontoDec = d(sc.desconto)
  const vgvAjustado = vgvBruto * (1 - d(p.permutaFisica)) * (1 + descontoDec)

  const tjm = Math.pow(1 + d(p.taxaJurosAA), 1 / 12) - 1
  const tdm = Math.pow(1 + d(p.taxaDescontoAA), 1 / 12) - 1
  const incc = d(p.inccMensal)

  const pctE = d(sc.pctEntrada)
  const pctO = d(sc.pctObra)
  const pctC = d(sc.pctChaves)

  // === RECEITA BRUTA MENSAL ===
  const recBruta = new Array(totalM + 1).fill(0)

  for (let ts = 0; ts <= totalM; ts++) {
    const frac = abs[ts] || 0
    if (!frac) continue
    const vv = vgvAjustado * frac

    if (ts >= mesEntr) {
      recBruta[ts] += vv
    } else {
      recBruta[ts] += vv * pctE
      const mr = mesEntr - ts - 1
      if (mr > 0) {
        const parc = (vv * pctO) / mr
        for (let t = ts + 1; t < mesEntr && t <= totalM; t++) {
          recBruta[t] += parc * Math.pow(1 + incc, t - ts)
        }
      } else {
        recBruta[ts] += vv * pctO
      }
      if (mesEntr <= totalM) recBruta[mesEntr] += vv * pctC
    }
  }

  // Totals: use vgvAjustado as canonical total (INCC sem efeito no total)
  const perm = d(p.permutaFinanceira)
  const ret = d(p.impostoRET)
  const recBrutaTotal = vgvAjustado
  const permutaTotal = recBrutaTotal * perm
  const impostosTotal = recBrutaTotal * ret
  const recLiqTotal = recBrutaTotal - permutaTotal - impostosTotal

  // Monthly net receipts (scaled to canonical total to avoid INCC drift)
  const rawTotal = recBruta.reduce((a, b) => a + b, 0)
  const scale = rawTotal > 0 ? recBrutaTotal / rawTotal : 1
  const recLiqMensal = recBruta.map(r => r * scale * (1 - perm - ret))

  // === CUSTOS MENSAIS ===
  const z = () => new Array(totalM + 1).fill(0)
  const cTerreno   = z()  // C01 Aquisição terreno
  const cITBI      = z()  // C02 ITBI e registro
  const cIPTU      = z()  // C03 IPTU
  const cProjAlv   = z()  // C04+C05 Projetos + Alvarás
  const cRegistros = z()  // C06 Registros e incorporação
  const cSeguros   = z()  // C07 Seguros
  const cObra      = z()  // C08+C09 Custo direto + indireto
  const cComissoes = z()  // C10 Comissões de venda
  const cGestCom   = z()  // C11 Gestão comercial
  const cMarketing = z()  // C12 Marketing
  const cAdm       = z()  // C13 Gestão ADM

  const curve = getCurve(p.prazoObra)
  const custoDireto = (p.custoM2 || 0) * (p.areaEquivalente || 0)
  const custoIndir  = custoDireto * d(p.custoIndireto)
  const md = Math.max(1, mesLanc)

  // C01 Aquisição: month 0
  cTerreno[0] = vgvBruto * d(p.aquisicaoTerreno)

  // C02 ITBI: month 0
  cITBI[0] = vgvBruto * d(p.itbiRegistro)

  // C03 IPTU: spread evenly over mesesDesenvolvimento
  const iptuTotal = vgvBruto * d(p.iptuAnual) * mesLanc / 12
  for (let t = 0; t < md; t++) cIPTU[t] = iptuTotal / md

  // C04–C05 Projetos + Alvarás: spread over pre-launch
  const devPreLanc = vgvBruto * (d(p.projetos) + d(p.alvaras))
  for (let t = 0; t < md; t++) cProjAlv[t] = devPreLanc / md

  // C06 Registros e incorporação: at launch month
  cRegistros[mesLanc] = vgvBruto * d(p.registrosInc)

  // C07 Seguros: spread over construction via S-curve
  const segurosTotal = vgvBruto * d(p.seguros)
  for (let t = 0; t < p.prazoObra; t++) {
    const m = mesLanc + t
    if (m <= totalM) cSeguros[m] = segurosTotal * curve[t]
  }

  // C08+C09 Custo direto + indireto: S-curve over construction
  for (let t = 0; t < p.prazoObra; t++) {
    const m = mesLanc + t
    if (m <= totalM) cObra[m] = (custoDireto + custoIndir) * curve[t]
  }

  // C10 Comissões e C11 Gestão Comercial: proporcionais à absorção
  // Base = vgvAjustado (incidem sobre o preço efetivo de venda, que varia por cenário)
  const totComissoes = vgvAjustado * d(p.comissoes)
  const totGestCom   = vgvAjustado * d(p.gestaoComercial)
  for (let t = 0; t <= totalM; t++) {
    const f = abs[t] || 0
    cComissoes[t] = totComissoes * f
    cGestCom[t]   = totGestCom   * f
  }

  // C12 Marketing: base = vgvAjustado (budget atrelado ao valor efetivo de vendas)
  // 50% nos meses do período de lançamento (uniform),
  // 50% nos meses restantes (proporcional à absorção)
  const totMarketing   = vgvAjustado * d(p.marketing)
  const durLancPrem    = Math.max(1, (p.duracaoLancamento || 1) | 0)
  const mktLanc        = totMarketing * 0.5
  const mktPost        = totMarketing * 0.5
  // 50% distribuído uniformemente no período de lançamento
  for (let t = 0; t < durLancPrem; t++) {
    const m = mesLanc + t
    if (m <= totalM) cMarketing[m] += mktLanc / durLancPrem
  }
  // 50% distribuído proporcionalmente à absorção nos meses fora do lançamento
  const lancFim   = mesLanc + durLancPrem
  const absRestante = abs.slice(lancFim).reduce((s, v) => s + v, 0)
  if (absRestante > 1e-9) {
    for (let t = lancFim; t <= totalM; t++)
      cMarketing[t] += mktPost * (abs[t] || 0) / absRestante
  } else {
    // Fallback: se não há absorção pós-lançamento, distribui uniformemente
    for (let t = lancFim; t <= totalM; t++)
      cMarketing[t] += mktPost / Math.max(1, totalM - lancFim + 1)
  }

  // C13 Gestão ADM: base = vgvAjustado (honorário sobre receita efetiva)
  const gestaoTotal = vgvAjustado * d(p.gestaoAdm)
  for (let t = 0; t <= totalM; t++) cAdm[t] = gestaoTotal / (totalM + 1)

  // Soma total de custos
  const custos = new Array(totalM + 1).fill(0)
  const _itens = [cTerreno, cITBI, cIPTU, cProjAlv, cRegistros, cSeguros, cObra, cComissoes, cGestCom, cMarketing, cAdm]
  for (let t = 0; t <= totalM; t++)
    custos[t] = _itens.reduce((s, arr) => s + arr[t], 0)

  const totalCustos = custos.reduce((a, b) => a + b, 0)
  const resultOp = recLiqTotal - totalCustos
  const margemVGV = vgvBruto > 0 ? resultOp / vgvBruto : 0
  const margemRec = recLiqTotal > 0 ? resultOp / recLiqTotal : 0

  // === FINANCIAMENTO ===
  const volumeFinanc    = custoDireto * d(p.financiamentoPct)
  // Desembolsos seguem a CurvaS a partir do mês de início do financiamento
  // (mínimo = mesLanc, pois obra só começa no lançamento)
  const mesInicioFinanc = Math.max(mesLanc, (p.mesInicioFinanciamento || 0) | 0)
  const disb = new Array(totalM + 1).fill(0)
  for (let t = 0; t < p.prazoObra; t++) {
    const m = mesInicioFinanc + t
    if (m <= totalM) disb[m] += volumeFinanc * curve[t]
  }

  let saldo = 0
  let saldoEntrega = 0
  const jurosMensal = new Array(totalM + 1).fill(0)
  const amortMensal = new Array(totalM + 1).fill(0)
  const prazoAmort  = (p.prazoAmortizacao || 0) | 0

  for (let t = 0; t <= totalM; t++) {
    // Juros sobre saldo ANTES do desembolso do mês
    jurosMensal[t] = saldo * tjm
    saldo += disb[t]

    if (prazoAmort === 0) {
      // Bullet: amortização total na entrega
      if (t === mesEntr) { amortMensal[t] = saldo; saldo = 0 }
    } else {
      // SAC: amortização constante a partir da entrega
      if (t === mesEntr) saldoEntrega = saldo
      if (t >= mesEntr && saldoEntrega > 0.01) {
        const parcela = Math.min(saldoEntrega / prazoAmort, saldo)
        if (parcela > 0.01) { amortMensal[t] = parcela; saldo -= parcela }
      }
    }
  }

  const desembolsosTotal = disb.reduce((a, b) => a + b, 0)
  const jurosTotais = jurosMensal.reduce((a, b) => a + b, 0)
  const amortTotal = amortMensal.reduce((a, b) => a + b, 0)
  const custoLiqFinanc = desembolsosTotal - amortTotal - jurosTotais

  const resultFinal = resultOp + custoLiqFinanc

  // === FLUXO DE CAIXA ===
  const fluxo = new Array(totalM + 1).fill(0)
  for (let t = 0; t <= totalM; t++) {
    fluxo[t] = recLiqMensal[t] - custos[t] + disb[t] - jurosMensal[t] - amortMensal[t]
  }

  const fluxoAcum = []
  let acum = 0
  for (const v of fluxo) { acum += v; fluxoAcum.push(acum) }

  const exposicao = Math.min(...fluxoAcum)
  const mesExposicao = fluxoAcum.indexOf(exposicao)

  const vpl = calcNPV(fluxo, tdm)
  const tir = calcIRR(fluxo)

  return {
    nome,
    vgvBruto, vgvAjustado,
    receitaBruta: recBrutaTotal,
    permutaTotal, impostosTotal, recLiqTotal,
    totalCustos, resultOp, margemVGV, margemRec,
    desembolsosTotal, jurosTotais, amortTotal,
    custoLiqFinanc,
    resultFinal,
    margemFinal: vgvBruto > 0 ? resultFinal / vgvBruto : 0,
    margemAjustado: vgvAjustado > 0 ? resultFinal / vgvAjustado : 0,
    vpl, tir, exposicao, mesExposicao,
    mesLanc, mesEntr, totalM,
    fluxo, fluxoAcum,
    recLiqMensal, custos, disb, jurosMensal, amortMensal,
    custoDetalhe: { cTerreno, cITBI, cIPTU, cProjAlv, cRegistros, cSeguros, cObra, cComissoes, cGestCom, cMarketing, cAdm },
  }
}

export function calcAll(state) {
  const { premissas: p, unidades, cenarios: c } = state
  return {
    otimista: calcScenario(p, unidades, c.otimista, 'Otimista'),
    base: calcScenario(p, unidades, c.base, 'Base'),
    pessimista: calcScenario(p, unidades, c.pessimista, 'Pessimista'),
  }
}
