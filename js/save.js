// Análises salvas — agora no Supabase (tabela viab_analises), compartilhadas e
// persistentes. exportJSON/importJSON continuam por arquivo (inalterados).
import { SBC as supabase } from './supabase.js'

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}

export async function getSaved() {
  const { data, error } = await supabase
    .from('viab_analises')
    .select('id,nome,criado_em,payload')
    .order('criado_em', { ascending: false })
    .limit(50)
  if (error) return []
  return (data || []).map(r => ({ id: r.id, name: r.nome, date: fmtDate(r.criado_em), state: r.payload }))
}

export async function saveAnalysis(name, state) {
  const { data, error } = await supabase
    .from('viab_analises')
    .insert({ nome: name, payload: JSON.parse(JSON.stringify(state)) })
    .select('id,nome,criado_em,payload')
    .single()
  if (error) throw new Error(error.message)
  return { id: data.id, name: data.nome, date: fmtDate(data.criado_em), state: data.payload }
}

export async function deleteAnalysis(id) {
  const { error } = await supabase.from('viab_analises').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export function exportJSON(state) {
  const nome = state?.premissas?.nome || 'analise'
  const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), state }, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `viab-${nome.replace(/\s+/g, '-').replace(/[^\w-]/g, '')}.json`
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1500)
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result)
        if (data?.state) resolve(data.state)
        else if (data?.premissas) resolve(data)
        else reject(new Error('Formato inválido: arquivo não contém um estado válido'))
      } catch (err) { reject(new Error('JSON inválido: ' + err.message)) }
    }
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo'))
    reader.readAsText(file)
  })
}
