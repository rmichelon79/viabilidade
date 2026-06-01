import { DEFAULT_PREMISSAS, DEFAULT_UNIDADES, DEFAULT_CENARIOS } from './defaults.js'
import { supabase } from './supabase.js'

const KEY = 'viab-state-v1'        // cache local (espelho)
const REMOTE_ID = 'sopra'          // doc compartilhado no Supabase

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

// Normaliza qualquer payload (local ou remoto) mesclando com os defaults.
function mergeState(src) {
  return {
    premissas: { ...DEFAULT_PREMISSAS, ...(src.premissas || {}) },
    unidades: Array.isArray(src.unidades) ? src.unidades.map(u => ({ ...u })) : DEFAULT_UNIDADES.map(u => ({ ...u })),
    cenarios: {
      otimista:   { ...DEFAULT_CENARIOS.otimista,   ...(src.cenarios?.otimista   || {}), absorcao: Array.isArray(src.cenarios?.otimista?.absorcao)   ? [...src.cenarios.otimista.absorcao]   : [...DEFAULT_CENARIOS.otimista.absorcao]   },
      base:       { ...DEFAULT_CENARIOS.base,       ...(src.cenarios?.base       || {}), absorcao: Array.isArray(src.cenarios?.base?.absorcao)       ? [...src.cenarios.base.absorcao]       : [...DEFAULT_CENARIOS.base.absorcao]       },
      pessimista: { ...DEFAULT_CENARIOS.pessimista, ...(src.cenarios?.pessimista || {}), absorcao: Array.isArray(src.cenarios?.pessimista?.absorcao) ? [...src.cenarios.pessimista.absorcao] : [...DEFAULT_CENARIOS.pessimista.absorcao] },
    },
  }
}

function loadLocal() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) _state = mergeState(JSON.parse(saved))
  } catch (_) {}
}

let _lsBlocked = false
function persistLocal() {
  try {
    localStorage.setItem(KEY, JSON.stringify(_state))
    _lsBlocked = false
  } catch (e) {
    _lsBlocked = true
    let warn = document.getElementById('ls-warning')
    if (!warn) {
      warn = document.createElement('div')
      warn.id = 'ls-warning'
      warn.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#7f1d1d;color:#fca5a5;text-align:center;padding:8px 16px;font-size:0.8rem;z-index:9998;'
      warn.innerHTML = '⚠️ <strong>Cache local indisponível</strong> — mas seus dados estão sendo salvos na nuvem (Supabase).'
      document.body.appendChild(warn)
    }
  }
}

// ── Persistência remota (Supabase) com debounce ──────────────────────────────
let _remoteTimer = null
function scheduleRemoteSave() {
  clearTimeout(_remoteTimer)
  _remoteTimer = setTimeout(saveRemote, 800)
}
async function saveRemote() {
  try {
    await supabase.from('viab_estado').upsert({
      id: REMOTE_ID,
      payload: _state,
      updated_at: new Date().toISOString(),
    })
  } catch (_) { /* offline/sem permissão: o cache local ainda guarda */ }
}

/** Carrega do Supabase no login. Remoto vence; se vazio, semeia com o local. */
export async function loadRemote() {
  try {
    const { data } = await supabase
      .from('viab_estado')
      .select('payload')
      .eq('id', REMOTE_ID)
      .maybeSingle()
    const remote = data && data.payload
    if (remote && Object.keys(remote).length > 0) {
      _state = mergeState(remote)
      persistLocal()
      notify()
    } else {
      await saveRemote() // 1ª vez: sobe o estado atual (vindo do localStorage)
    }
  } catch (_) { /* mantém o que veio do localStorage */ }
}

function persist() {
  persistLocal()
  scheduleRemoteSave()
}

export function getState() { return _state }

export function setPremissas(partial) {
  _state.premissas = { ..._state.premissas, ...partial }
  persist(); notify()
}
export function setUnidades(unidades) {
  _state.unidades = unidades
  persist(); notify()
}
export function setCenario(key, partial) {
  _state.cenarios[key] = { ..._state.cenarios[key], ...partial }
  persist(); notify()
}
export function setAbsorcao(key, absorcao) {
  _state.cenarios[key] = { ..._state.cenarios[key], absorcao }
  persist(); notify()
}

export function loadState(newState) {
  _state = mergeState(newState)
  persist(); notify()
}

export function resetAll() {
  _state = mergeState({})
  persist(); notify()
}

export function subscribe(fn) { _listeners.add(fn) }
export function unsubscribe(fn) { _listeners.delete(fn) }
function notify() { _listeners.forEach(fn => fn(_state)) }

loadLocal()
