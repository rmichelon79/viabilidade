// Exporta o fluxo de caixa da viabilidade para o app de Orçamento (plurianual).
// Cria uma NOVA versão por ano (não apaga as atuais). Mapeia linha→conta (por código)
// e mês de projeto→(ano,mês) pela data base. Juros/amortização entram negativos.
import { SBC as supabase } from './supabase.js'

// linha do fluxo → conta do plano (código) + sinal
export const MAP = [
  { get: r => r.recLiqMensal,          codigo: '1.1.3',  sinal: 1 },  // Previsão de Receita de Novas Vendas
  { get: r => r.custoDetalhe.cTerreno, codigo: '2.1.1',  sinal: 1 },  // Aquisição do Terreno
  { get: r => r.custoDetalhe.cITBI,    codigo: '2.1.2',  sinal: 1 },  // Legalização do Terreno
  { get: r => r.custoDetalhe.cIPTU,    codigo: '2.1.3',  sinal: 1 },  // IPTU do Terreno
  { get: r => r.custoDetalhe.cProjAlv, codigo: '2.2.2',  sinal: 1 },  // Consultorias e Projetos de Incorporação
  { get: r => r.custoDetalhe.cRegistros, codigo: '2.2.3', sinal: 1 }, // Taxas e Registros da Incorporação
  { get: r => r.custoDetalhe.cSeguros, codigo: '2.2.4',  sinal: 1 },  // Seguros da Incorporação
  { get: r => r.custoDetalhe.cObra,    codigo: '2.3.12', sinal: 1 },  // Custo de Obra (estimativa viab.)
  { get: r => r.custoDetalhe.cComissoes, codigo: '2.4.3', sinal: 1 }, // Comissões de vendas
  { get: r => r.custoDetalhe.cGestCom, codigo: '2.4.1',  sinal: 1 },  // Equipe Comercial
  { get: r => r.custoDetalhe.cMarketing, codigo: '2.5.13', sinal: 1 },// Marketing (estimativa viab.)
  { get: r => r.custoDetalhe.cAdm,     codigo: '2.6.16', sinal: 1 },  // Gestão / Adm (estimativa viab.)
  { get: r => r.disb,                  codigo: '3.1',    sinal: 1 },  // Financiamentos (entrada)
  { get: r => r.jurosMensal,           codigo: '3.2',    sinal: -1 }, // Juros (negativo)
  { get: r => r.amortMensal,           codigo: '3.4',    sinal: -1 }, // Amortização (negativo)
]

export function parseDataBase(dataStr) {
  const m = /^(\d{4})-(\d{2})/.exec(dataStr || '')
  if (m) return { year: +m[1], month: +m[2] }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

/** Lógica pura: acumula valores por `${ano}|${codigo}|${mes}`. Testável sem Supabase. */
export function acumular(r, premissas, anoBase) {
  const base = parseDataBase(premissas.data)
  const acc = new Map()
  let overflow = 0
  for (let t = 0; t <= r.totalM; t++) {
    const mi = (base.month - 1) + t
    let ano = base.year + Math.floor(mi / 12)
    let mes = (mi % 12) + 1
    if (ano < anoBase) { ano = anoBase; mes = 1 }
    if (ano > anoBase + 6) { ano = anoBase + 6; mes = 12; overflow++ }
    for (const m of MAP) {
      const v = ((m.get(r) || [])[t] || 0) * m.sinal
      if (Math.abs(v) < 0.005) continue
      const k = `${ano}|${m.codigo}|${mes}`
      acc.set(k, (acc.get(k) || 0) + v)
    }
  }
  return { acc, overflow }
}

/** Escreve no Supabase: nova versão por ano + lançamentos. */
export async function exportarParaOrcamento(r, premissas, cenarioLabel) {
  const nome = (premissas.nome || '').trim()
  if (!nome) throw new Error('Defina o nome do empreendimento nas premissas.')

  const { data: emps, error: e1 } = await supabase
    .from('empreendimentos').select('id,codigo,nome,ano_base')
  if (e1) throw new Error(e1.message)
  const up = nome.toUpperCase()
  const emp = (emps || []).find(e => e.codigo.toUpperCase() === up || (e.nome || '').toUpperCase() === up)
  if (!emp) throw new Error(`Empreendimento "${nome}" não encontrado no orçamento. O nome da premissa precisa casar com o código/nome de um empreendimento (ex: ALTANA).`)
  const anoBase = emp.ano_base || parseDataBase(premissas.data).year

  const { data: contas, error: e2 } = await supabase.from('contas').select('id,codigo')
  if (e2) throw new Error(e2.message)
  const idByCod = {}
  for (const c of contas) idByCod[c.codigo] = c.id
  for (const m of MAP) {
    if (!idByCod[m.codigo]) throw new Error(`Conta ${m.codigo} não existe no plano de contas. Rode o alinhamento de contas.`)
  }

  const { acc, overflow } = acumular(r, premissas, anoBase)
  const anos = Array.from({ length: 7 }, (_, i) => anoBase + i)
  const resumo = []

  for (const ano of anos) {
    const { data: vs } = await supabase
      .from('orcamentos').select('versao')
      .eq('empreendimento_id', emp.id).eq('ano', ano)
      .order('versao', { ascending: false }).limit(1)
    const prox = ((vs?.[0]?.versao) || 0) + 1
    const { data: novo, error: e3 } = await supabase
      .from('orcamentos')
      .insert({ empreendimento_id: emp.id, ano, versao: prox, status: 'rascunho' })
      .select('id,versao').single()
    if (e3) throw new Error(e3.message)

    const rows = []
    for (const [k, val] of acc) {
      const [a, cod, mes] = k.split('|')
      if (+a !== ano) continue
      rows.push({ orcamento_id: novo.id, conta_id: idByCod[cod], mes: +mes, valor: Math.round(val * 100) / 100 })
    }
    if (rows.length) {
      const { error: e4 } = await supabase.from('lancamentos').insert(rows)
      if (e4) throw new Error(e4.message)
    }
    resumo.push({ ano, versao: novo.versao, lancamentos: rows.length })
  }

  return { empreendimento: emp.codigo, cenario: cenarioLabel, anoBase, overflow, resumo }
}
