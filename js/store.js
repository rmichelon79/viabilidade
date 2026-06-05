import { DEFAULT_PREMISSAS, DEFAULT_UNIDADES, DEFAULT_CENARIOS } from './defaults.js'
import { SBC as supabase } from './supabase.js'

const KEY = 'viab-state-v1'   // prefixo do cache local; chave real = `${KEY}:${empId}`
const LAST_KEY = 'viab-last-emp'

let _empId = null
let _state = defaults()
const _listeners = new Set()

function defaults() {
  return {
    premissas: { ...DEFAULT_PREMISSAS },
    unidades: DEFAULT_UNIDADES.map(u => ({ ...u })),
    cenarios: {
      otimista: { ...DEFAULT_CENARIOS.otimista, absorcao: [...DEFAULT_CENARIOS.otimista.absorcao] },
      base:     { ...DEFAULT_CENARIOS.base,     absorcao: [...DEFAULT_CENARIOS.base.absorcao] },
      pessimista:{ ...DEFAULT_CENARIOS.pessimista, absorcao: [...DEFAULT_CENARIOS.pessimista.absorcao] },
    },
  }
}

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

export function getEmpId() { return _empId }
export function getState() { return _state }
export function getLastEmpId() { try { return localStorage.getItem(LAST_KEY) } catch { return null } }

function cacheKey() { return `${KEY}:${_empId}` }
function loadLocalFor(empId) {
  try {
    const saved = localStorage.getItem(`${KEY}:${empId}`)
    if (saved) return mergeState(JSON.parse(saved))
  } catch (_) {}
  return null
}

let _lsBlocked = false
function persistLocal() {
  if (!_empId) return
  try {
    localStorage.setItem(cacheKey(), JSON.stringify(_state))
    _lsBlocked = false
  } catch (e) {
    _lsBlocked = true
    let warn = document.getElementById('ls-warning')
    if (!warn) {
      warn = document.createElement('div')
      warn.id = 'ls-warning'
      warn.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#7f1d1d;color:#fca5a5;text-align:center;padding:8px 16px;font-size:0.8rem;z-index:9998;'
      warn.innerHTML = '⚠️ <strong>Cache local indisponível</strong> — mas seus dados estão sendo salvos na nuvem.'
      document.body.appendChild(warn)
    }
  }
}

let _remoteTimer = null
function scheduleRemoteSave() {
  clearTimeout(_remoteTimer)
  _remoteTimer = setTimeout(saveRemote, 800)
}
async function saveRemote() {
  if (!_empId) return
  try {
    await supabase.from('viab_estudos').upsert({
      empreendimento_id: _empId,
      payload: _state,
      updated_at: new Date().toISOString(),
    })
  } catch (_) { /* offline/sem permissão: cache local guarda */ }
}

/** Seleciona um empreendimento e carrega o estudo dele (remoto > cache local > defaults). */
export async function selectEmpreendimento(empId, nome) {
  if (_empId && _empId !== empId) await saveRemote() // salva o anterior
  _empId = empId
  try { localStorage.setItem(LAST_KEY, empId) } catch (_) {}

  let loaded = null
  let fromRemote = false
  try {
    const { data } = await supabase
      .from('viab_estudos').select('payload')
      .eq('empreendimento_id', empId).maybeSingle()
    if (data && data.payload && Object.keys(data.payload).length > 0) {
      loaded = mergeState(data.payload); fromRemote = true
    }
  } catch (_) {}
  if (!loaded) loaded = loadLocalFor(empId)

  _state = loaded || defaults()
  if (nome) _state.premissas = { ..._state.premissas, nome }
  persistLocal()
  notify()
  if (!fromRemote) saveRemote() // semeia/atualiza o remoto
}

function persist() {
  persistLocal()
  scheduleRemoteSave()
}

export function setPremissas(partial) { _state.premissas = { ..._state.premissas, ...partial }; persist(); notify() }
export function setUnidades(unidades) { _state.unidades = unidades; persist(); notify() }
export function setCenario(key, partial) { _state.cenarios[key] = { ..._state.cenarios[key], ...partial }; persist(); notify() }
export function setAbsorcao(key, absorcao) { _state.cenarios[key] = { ..._state.cenarios[key], absorcao }; persist(); notify() }

export function loadState(newState) { _state = mergeState(newState); persist(); notify() }
export function resetAll() { _state = defaults(); persist(); notify() }

export function subscribe(fn) { _listeners.add(fn) }
export function unsubscribe(fn) { _listeners.delete(fn) }
function notify() { _listeners.forEach(fn => fn(_state)) }
