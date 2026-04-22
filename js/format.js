export function brl(v, dec = 0) {
  if (v == null || isNaN(v)) return '–'
  const abs = Math.abs(v)
  const s = abs.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
  return v < 0 ? `(R$ ${s})` : `R$ ${s}`
}

export function brlM(v) {
  if (v == null || isNaN(v)) return '–'
  const m = v / 1_000_000
  const s = Math.abs(m).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return v < 0 ? `(R$ ${s}M)` : `R$ ${s}M`
}

export function pct(v, dec = 1) {
  if (v == null || isNaN(v)) return '–'
  const s = (Math.abs(v) * 100).toFixed(dec).replace('.', ',')
  return v < 0 ? `(${s}%)` : `${s}%`
}

export function num(v, dec = 0) {
  if (v == null || isNaN(v)) return '–'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export function parseNum(s) {
  if (typeof s === 'number') return s
  return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0
}

export function parsePct(s) {
  return parseFloat(String(s).replace(',', '.')) / 100 || 0
}
