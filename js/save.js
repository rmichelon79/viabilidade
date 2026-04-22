const SAVE_KEY = 'viab-saved-v1'

export function getSaved() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]') }
  catch { return [] }
}

export function saveAnalysis(name, state) {
  const saved = getSaved()
  const entry = {
    id: Date.now(),
    name,
    date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
    state: JSON.parse(JSON.stringify(state)),
  }
  saved.unshift(entry)
  localStorage.setItem(SAVE_KEY, JSON.stringify(saved.slice(0, 30)))
  return entry
}

export function deleteAnalysis(id) {
  const saved = getSaved().filter(e => e.id !== id)
  localStorage.setItem(SAVE_KEY, JSON.stringify(saved))
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
        else if (data?.premissas) resolve(data) // bare state object
        else reject(new Error('Formato inválido: arquivo não contém um estado válido'))
      } catch (err) { reject(new Error('JSON inválido: ' + err.message)) }
    }
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo'))
    reader.readAsText(file)
  })
}
