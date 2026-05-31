// Formatação numérica robusta — não depende de Intl/toLocaleString
// funciona corretamente em Safari, iOS e qualquer locale do sistema

function intBR(n) {
  // Adiciona pontos como separador de milhar
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function decBR(n, dec) {
  if (dec === 0) return intBR(n)
  const factor = Math.pow(10, dec)
  const rounded = Math.round(Math.abs(n) * factor) / factor
  const [int, frac = ''] = rounded.toFixed(dec).split('.')
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${intFmt},${frac.padEnd(dec, '0')}`
}

export function brl(v, dec = 0) {
  if (v == null || isNaN(v)) return '–'
  return v < 0 ? `(R$ ${decBR(v, dec)})` : `R$ ${decBR(v, dec)}`
}

export function brlM(v) {
  if (v == null || isNaN(v)) return '–'
  const m = v / 1_000_000
  return v < 0 ? `(R$ ${decBR(m, 2)}M)` : `R$ ${decBR(m, 2)}M`
}

export function pct(v, dec = 1) {
  if (v == null || isNaN(v)) return '–'
  const s = Math.abs(v * 100).toFixed(dec).replace('.', ',')
  return v < 0 ? `(${s}%)` : `${s}%`
}

export function num(v, dec = 0) {
  if (v == null || isNaN(v)) return '–'
  return decBR(v, dec)
}

// Parses pt-BR formatted number string → number
export function parseNum(s) {
  if (typeof s === 'number') return s
  return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0
}

export function parsePct(s) {
  return parseFloat(String(s).replace(',', '.')) / 100 || 0
}
