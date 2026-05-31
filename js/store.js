import { DEFAULT_PREMISSAS, DEFAULT_UNIDADES, DEFAULT_CENARIOS } from './defaults.js'

const KEY = 'viab-state-v1'

let _state = {
  premissas: { ...DEFAULT_PREMISSAS },
  unidades: DEFAULT_UNIDADES.map(u => ({ ...u })),
  cenarios: {
    otimista: { ...DEFAULT_CENARIOS.otimista, absorcao: [...DEFAULT_CENARIOS.otimista.absorcao] },
    base:     { ...DEFAULT_CENARIOS.base,     absorcao: [...DEFAULT_CENARIOS.base.absorcao] },
    pessimista:{ ...DEFAULT_CENARIOS.pessimista, absorcao: [...DEFAULT_CENARIOS.pessimista.absorcao] },
  },
}

const _listeners = new Set()

function load() {
  try {
    const saved = localStorage.getItem(KEY)
    if (!saved) return
    const parsed = JSON.parse(saved)
    if (parsed.premissas) _state.premissas = { ...DEFAULT_PREMISSAS, ...parsed.premissas }
    if (parsed.unidades) _state.unidades = parsed.unidades
    if (parsed.cenarios) {
      for (const k of ['otimista', 'base', 'pessimista']) {
        if (parsed.cenarios[k]) {
          _state.cenarios[k] = { ...DEFAULT_CENARIOS[k], ...parsed.cenarios[k] }
          if (Array.isArray(parsed.cenarios[k].absorcao))
            _state.cenarios[k].absorcao = parsed.cenarios[k].absorcao
        }
      }
    }
  } catch (_) {}
}

let _lsBlocked = false

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(_state))
    _lsBlocked = false
  } catch (e) {
    _lsBlocked = true
    // Avisa o usuário que os dados não serão salvos (modo privado ou ITP do Safari)
    let warn = document.getElementById('ls-warning')
    if (!warn) {
      warn = document.createElement('div')
      warn.id = 'ls-warning'
      warn.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#7f1d1d;color:#fca5a5;text-align:center;padding:8px 16px;font-size:0.8rem;z-index:9998;'
      warn.innerHTML = '⚠️ <strong>Modo privado ou restrições do Safari detectadas</strong> — os dados <u>não serão salvos</u> ao fechar. Use "💾 Salvar análise" e "⬇ Exportar JSON" para preservar seu trabalho.'
      document.body.appendChild(warn)
    }
  }
}

export function getState() { return _state }

export function setPremissas(partial) {
  _state.premissas = { ..._state.premissas, ...partial }
  persist()
  notify()
}

export function setUnidades(unidades) {
  _state.unidades = unidades
  persist()
  notify()
}

export function setCenario(key, partial) {
  _state.cenarios[key] = { ..._state.cenarios[key], ...partial }
  persist()
  notify()
}

export function setAbsorcao(key, absorcao) {
  _state.cenarios[key] = { ..._state.cenarios[key], absorcao }
  persist()
  notify()
}

export function loadState(newState) {
  _state = {
    premissas: { ...DEFAULT_PREMISSAS, ...(newState.premissas || {}) },
    unidades: Array.isArray(newState.unidades) ? newState.unidades.map(u => ({ ...u })) : DEFAULT_UNIDADES.map(u => ({ ...u })),
    cenarios: {
      otimista:   { ...DEFAULT_CENARIOS.otimista,   ...(newState.cenarios?.otimista   || {}), absorcao: newState.cenarios?.otimista?.absorcao   ? [...newState.cenarios.otimista.absorcao]   : [...DEFAULT_CENARIOS.otimista.absorcao]   },
      base:       { ...DEFAULT_CENARIOS.base,       ...(newState.cenarios?.base       || {}), absorcao: newState.cenarios?.base?.absorcao       ? [...newState.cenarios.base.absorcao]       : [...DEFAULT_CENARIOS.base.absorcao]       },
      pessimista: { ...DEFAULT_CENARIOS.pessimista, ...(newState.cenarios?.pessimista || {}), absorcao: newState.cenarios?.pessimista?.absorcao ? [...newState.cenarios.pessimista.absorcao] : [...DEFAULT_CENARIOS.pessimista.absorcao] },
    },
  }
  persist()
  notify()
}

export function resetAll() {
  localStorage.removeItem(KEY)
  _state = {
    premissas: { ...DEFAULT_PREMISSAS },
    unidades: DEFAULT_UNIDADES.map(u => ({ ...u })),
    cenarios: {
      otimista:  { ...DEFAULT_CENARIOS.otimista,  absorcao: [...DEFAULT_CENARIOS.otimista.absorcao] },
      base:      { ...DEFAULT_CENARIOS.base,      absorcao: [...DEFAULT_CENARIOS.base.absorcao] },
      pessimista:{ ...DEFAULT_CENARIOS.pessimista, absorcao: [...DEFAULT_CENARIOS.pessimista.absorcao] },
    },
  }
  notify()
}

export function subscribe(fn) { _listeners.add(fn) }
export function unsubscribe(fn) { _listeners.delete(fn) }
function notify() { _listeners.forEach(fn => fn(_state)) }

load()
