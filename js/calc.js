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
  const custos = new Array(totalM + 1).fill(0)
  const curve = getCurve(p.prazoObra)

  const custoDireto = (p.custoM2 || 0) * (p.areaEquivalente || 0)
  const custoIndir = custoDireto * d(p.custoIndireto)

  // C01 Aquisição: month 0
  custos[0] += vgvBruto * d(p.aquisicaoTerreno)

  // C02 ITBI: month 0
  custos[0] += vgvBruto * d(p.itbiRegistro)

  // C03 IPTU: spread evenly over mesesDesenvolvimento
  const iptuTotal = vgvBruto * d(p.iptuAnual) * mesLanc / 12
  const md = Math.max(1, mesLanc)
  for (let t = 0; t < md; t++) custos[t] += iptuTotal / md

  // C04–C05 Projetos + Alvarás: spread over pre-launch
  const devPreLanc = vgvBruto * (d(p.projetos) + d(p.alvaras))
  for (let t = 0; t < md; t++) custos[t] += devPreLanc / md

  // C06 Registros e incorporação: at launch month
  custos[mesLanc] += vgvBruto * d(p.registrosInc)

  // C07 Seguros: spread over construction via S-curve
  const segurosTotal = vgvBruto * d(p.seguros)
  for (let t = 0; t < p.prazoObra; t++) {
    const m = mesLanc + t
    if (m <= totalM) custos[m] += segurosTotal * curve[t]
  }

  // C08+C09 Custo direto + indireto: S-curve over construction
  for (let t = 0; t < p.prazoObra; t++) {
    const m = mesLanc + t
    if (m <= totalM) custos[m] += (custoDireto + custoIndir) * curve[t]
  }

  // C10 Comissões + C11 Gestão Comercial + C12 Marketing: proportional to absorption
  const despVendas = vgvBruto * (d(p.comissoes) + d(p.gestaoComercial) + d(p.marketing))
  for (let t = 0; t <= totalM; t++) custos[t] += despVendas * (abs[t] || 0)

  // C13 Gestão adm: spread evenly over all months
  const gestaoTotal = vgvBruto * d(p.gestaoAdm)
  for (let t = 0; t <= totalM; t++) custos[t] += gestaoTotal / (totalM + 1)

  const totalCustos = custos.reduce((a, b) => a + b, 0)
  const resultOp = recLiqTotal - totalCustos
  const margemVGV = vgvBruto > 0 ? resultOp / vgvBruto : 0
  const margemRec = recLiqTotal > 0 ? resultOp / recLiqTotal : 0

  // === FINANCIAMENTO ===
  const volumeFinanc = custoDireto * d(p.financiamentoPct)
  const disb = new Array(totalM + 1).fill(0)
  for (let t = 0; t < p.prazoObra; t++) {
    const m = mesLanc + t
    if (m <= totalM) disb[m] += volumeFinanc * curve[t]
  }

  let saldo = 0
  const jurosMensal = new Array(totalM + 1).fill(0)
  const amortMensal = new Array(totalM + 1).fill(0)

  for (let t = 0; t <= totalM; t++) {
    // Interest on balance BEFORE this month's disbursement
    const j = saldo * tjm
    jurosMensal[t] = j
    saldo += disb[t]
    if (t === mesEntr && p.prazoAmortizacao === 0) {
      amortMensal[t] = saldo
      saldo = 0
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
    vpl, tir, exposicao, mesExposicao,
    mesLanc, mesEntr, totalM,
    fluxo, fluxoAcum,
    recLiqMensal, custos, disb, jurosMensal, amortMensal,
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
