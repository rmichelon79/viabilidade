// Requires SheetJS (XLSX) loaded globally via CDN

export function exportFluxoXLS(state, results) {
  if (typeof XLSX === 'undefined') {
    alert('Biblioteca SheetJS não carregada. Verifique a conexão e recarregue a página.')
    return
  }

  const { base, otimista, pessimista } = results
  const nome = state.premissas?.nome || 'Viabilidade'
  const wb = XLSX.utils.book_new()

  // ── ABA 1: RESUMO ────────────────────────────────────────────
  const resumoData = [
    [nome],
    [`Exportado em: ${new Date().toLocaleString('pt-BR')}`],
    [],
    ['Indicador', 'Otimista', 'Base', 'Pessimista'],
    // Receitas
    ['RECEITAS', '', '', ''],
    ['VGV Bruto (R$)',              otimista.vgvBruto,       base.vgvBruto,       pessimista.vgvBruto],
    ['VGV Ajustado (R$)',           otimista.vgvAjustado,    base.vgvAjustado,    pessimista.vgvAjustado],
    ['Receita Bruta (R$)',          otimista.receitaBruta,   base.receitaBruta,   pessimista.receitaBruta],
    ['(-) Permuta Financeira (R$)', otimista.permutaTotal,   base.permutaTotal,   pessimista.permutaTotal],
    ['(-) Impostos s/ Receita (R$)',otimista.impostosTotal,  base.impostosTotal,  pessimista.impostosTotal],
    ['Receita Líquida (R$)',        otimista.recLiqTotal,    base.recLiqTotal,    pessimista.recLiqTotal],
    // Custos
    ['CUSTOS E DESPESAS', '', '', ''],
    ['(-) Total Custos C&D (R$)',   otimista.totalCustos,    base.totalCustos,    pessimista.totalCustos],
    // Resultado operacional
    ['RESULTADO OPERACIONAL', '', '', ''],
    ['Resultado Operacional (R$)',  otimista.resultOp,       base.resultOp,       pessimista.resultOp],
    ['Margem s/ VGV Bruto (%)',     otimista.margemVGV*100,  base.margemVGV*100,  pessimista.margemVGV*100],
    ['Margem s/ Receita Líq. (%)',  otimista.margemRec*100,  base.margemRec*100,  pessimista.margemRec*100],
    // Financiamento
    ['FINANCIAMENTO', '', '', ''],
    ['(+) Desembolsos (R$)',        otimista.desembolsosTotal, base.desembolsosTotal, pessimista.desembolsosTotal],
    ['(-) Juros Totais (R$)',       otimista.jurosTotais,    base.jurosTotais,    pessimista.jurosTotais],
    ['(-) Amortização (R$)',        otimista.amortTotal,     base.amortTotal,     pessimista.amortTotal],
    ['Custo Líq. Financiamento (R$)',otimista.custoLiqFinanc,base.custoLiqFinanc, pessimista.custoLiqFinanc],
    // Resultado final
    ['RESULTADO FINAL', '', '', ''],
    ['Resultado Final (R$)',        otimista.resultFinal,    base.resultFinal,    pessimista.resultFinal],
    ['Margem Final s/ VGV (%)',     otimista.margemFinal*100,base.margemFinal*100,pessimista.margemFinal*100],
    // Indicadores financeiros
    ['INDICADORES FINANCEIROS', '', '', ''],
    ['VPL (R$)',                    otimista.vpl,            base.vpl,            pessimista.vpl],
    ['TIR (% a.a.)',                otimista.tir*100,        base.tir*100,        pessimista.tir*100],
    ['Exposição Máx. (R$)',         otimista.exposicao,      base.exposicao,      pessimista.exposicao],
    ['Mês da Exposição Máx.',       otimista.mesExposicao,   base.mesExposicao,   pessimista.mesExposicao],
    // Linha do tempo
    ['LINHA DO TEMPO', '', '', ''],
    ['Mês de Lançamento',           otimista.mesLanc,        base.mesLanc,        pessimista.mesLanc],
    ['Mês de Entrega',              otimista.mesEntr,        base.mesEntr,        pessimista.mesEntr],
    ['Total de Meses',              otimista.totalM,         base.totalM,         pessimista.totalM],
  ]

  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData)
  // Formato numérico para R$
  styleResumoSheet(wsResumo, resumoData)
  wsResumo['!cols'] = [{ wch: 38 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

  // ── ABAS 2-4: FLUXO MENSAL POR CENÁRIO ──────────────────────
  const cenarios = [
    { key: 'otimista',   label: 'Otimista',   r: otimista   },
    { key: 'base',       label: 'Base',        r: base       },
    { key: 'pessimista', label: 'Pessimista',  r: pessimista },
  ]

  for (const { label, r } of cenarios) {
    const n = r.totalM + 1
    const header = ['Mês', 'Receita Líq. (R$)', 'Custos (R$)', 'Financiamento (R$)', 'Juros (R$)', 'Amortização (R$)', 'Fluxo Mensal (R$)', 'Fluxo Acumulado (R$)']

    // Build rows — guard arrays with fallback to empty
    const recLiq  = r.recLiqMensal  || []
    const custos  = r.custos        || []
    const disb    = r.disb          || []
    const juros   = r.jurosMensal   || []
    const amort   = r.amortMensal   || []
    const fluxo   = r.fluxo         || []
    const fluxAcum= r.fluxoAcum     || []

    const rows = [header]
    for (let t = 0; t < n; t++) {
      rows.push([
        t,
        round2(recLiq[t]  || 0),
        round2(custos[t]  || 0),
        round2(disb[t]    || 0),
        round2(juros[t]   || 0),
        round2(amort[t]   || 0),
        round2(fluxo[t]   || 0),
        round2(fluxAcum[t]|| 0),
      ])
    }
    // Totals row
    rows.push([
      'TOTAL',
      round2(recLiq.slice(0,n).reduce((a,b)=>a+b,0)),
      round2(custos.slice(0,n).reduce((a,b)=>a+b,0)),
      round2(disb.slice(0,n).reduce((a,b)=>a+b,0)),
      round2(juros.slice(0,n).reduce((a,b)=>a+b,0)),
      round2(amort.slice(0,n).reduce((a,b)=>a+b,0)),
      '',
      round2(fluxAcum[n-1] || 0),
    ])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 22 },
      { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 22 },
    ]
    // Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(wb, ws, `Fluxo ${label}`)
  }

  // ── DOWNLOAD ─────────────────────────────────────────────────
  const filename = `viab-${nome.replace(/\s+/g,'-').replace(/[^\w-]/g,'')}-fluxo.xlsx`
  XLSX.writeFile(wb, filename)
}

function round2(v) { return Math.round(v * 100) / 100 }

function styleResumoSheet(ws, data) {
  // Apply number format to numeric cells in columns B/C/D (rows 5+)
  const FMT_BRL  = '#,##0'
  const FMT_PCT  = '0.00"%"'
  const pctRows  = new Set([15, 16, 24, 26, 27])  // 0-indexed in data

  data.forEach((row, r) => {
    row.forEach((val, c) => {
      if (c === 0 || typeof val !== 'number') return
      const cellRef = XLSX.utils.encode_cell({ r, c })
      if (!ws[cellRef]) return
      const isPct = pctRows.has(r)
      ws[cellRef].z = isPct ? FMT_PCT : FMT_BRL
    })
  })
}
