// ─── AUTENTICAÇÃO CLIENT-SIDE ────────────────────────────────────────────────
// Proteção por senha com hash SHA-256 (Web Crypto API).
// Para alterar a senha:
//   1. Gere o novo hash: python3 -c "import hashlib; print(hashlib.sha256(b'NOVA_SENHA').hexdigest())"
//   2. Atualize PASSWORD_HASH abaixo

const PASSWORD_HASH   = '0fbe383c4cf3d7e411898386da36f44ef5bc4f168b98388b435ee1d7f4fd0cac'
const SESSION_KEY     = 'viab-session-v1'
const SESSION_DAYS    = 30
const MAX_ATTEMPTS    = 5
const LOCKOUT_MINUTES = 15

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

function saveSession() {
  const expires = Date.now() + SESSION_DAYS * 86_400_000
  localStorage.setItem(SESSION_KEY, JSON.stringify({ expires }))
}

function isSessionValid() {
  const s = getSession()
  return s && s.expires > Date.now()
}

function getAttempts() {
  try { return JSON.parse(sessionStorage.getItem('viab-attempts') || '{"count":0,"since":0}') }
  catch { return { count: 0, since: 0 } }
}

function recordAttempt() {
  const a = getAttempts()
  const now = Date.now()
  // Reset counter after lockout period
  if (now - a.since > LOCKOUT_MINUTES * 60_000) { a.count = 0; a.since = now }
  a.count++
  sessionStorage.setItem('viab-attempts', JSON.stringify(a))
  return a
}

function clearAttempts() {
  sessionStorage.removeItem('viab-attempts')
}

function isLockedOut() {
  const a = getAttempts()
  return a.count >= MAX_ATTEMPTS && (Date.now() - a.since) < LOCKOUT_MINUTES * 60_000
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
  location.reload()
}

export function initAuth(onSuccess) {
  if (isSessionValid()) { onSuccess(); return }
  renderLogin(onSuccess)
}

function renderLogin(onSuccess) {
  const overlay = document.createElement('div')
  overlay.id = 'auth-overlay'
  overlay.style.cssText = `
    position:fixed;inset:0;background:#0f172a;
    display:flex;align-items:center;justify-content:center;
    z-index:9999;font-family:'Inter',sans-serif;
  `
  overlay.innerHTML = `
    <div style="width:360px;padding:40px 36px;background:#1e293b;border-radius:14px;
                box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="text-align:center;margin-bottom:32px">
        <div style="font-size:0.7rem;font-weight:600;letter-spacing:.15em;color:#475569;
                    text-transform:uppercase;margin-bottom:6px">Sopra Incorporações</div>
        <div style="font-size:1.5rem;font-weight:700;color:#f8fafc">Viabilidade</div>
        <div style="font-size:0.8rem;color:#64748b;margin-top:6px">Acesso restrito</div>
      </div>

      <div id="auth-error" style="display:none;background:#7f1d1d;color:#fca5a5;
           padding:10px 14px;border-radius:8px;font-size:0.8rem;margin-bottom:16px;
           border:1px solid #dc2626"></div>

      <div style="margin-bottom:16px">
        <label style="font-size:0.75rem;color:#94a3b8;display:block;margin-bottom:6px">Senha</label>
        <input id="auth-pwd" type="password" autocomplete="current-password"
          style="width:100%;padding:10px 14px;background:#0f172a;border:1px solid #334155;
                 border-radius:8px;color:#f8fafc;font-size:0.95rem;outline:none;
                 transition:border .15s;box-sizing:border-box"
          placeholder="••••••••">
      </div>

      <button id="auth-btn"
        style="width:100%;padding:11px;background:#2563eb;color:#fff;border:none;
               border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer;
               transition:background .15s">
        Entrar
      </button>

      <div id="auth-lock" style="display:none;text-align:center;color:#f87171;
           font-size:0.78rem;margin-top:14px"></div>

      <div style="text-align:center;margin-top:20px;font-size:0.7rem;color:#334155">
        🔒 Acesso protegido por senha
      </div>
    </div>`

  document.body.appendChild(overlay)

  const input = overlay.querySelector('#auth-pwd')
  const btn   = overlay.querySelector('#auth-btn')
  const err   = overlay.querySelector('#auth-error')
  const lock  = overlay.querySelector('#auth-lock')

  function showError(msg) {
    err.textContent = msg; err.style.display = 'block'
  }

  async function attempt() {
    if (isLockedOut()) {
      const a = getAttempts()
      const rem = Math.ceil((LOCKOUT_MINUTES * 60_000 - (Date.now() - a.since)) / 60_000)
      lock.textContent = `Muitas tentativas. Aguarde ${rem} min.`
      lock.style.display = 'block'; return
    }

    btn.textContent = 'Verificando…'; btn.disabled = true

    const hash = await sha256(input.value)
    if (hash === PASSWORD_HASH) {
      clearAttempts()
      saveSession()
      overlay.remove()
      onSuccess()
    } else {
      const a = recordAttempt()
      const rem = MAX_ATTEMPTS - a.count
      showError(rem > 0
        ? `Senha incorreta. ${rem} tentativa${rem > 1 ? 's' : ''} restante${rem > 1 ? 's' : ''}.`
        : `Acesso bloqueado por ${LOCKOUT_MINUTES} minutos.`)
      input.value = ''; input.focus()
      btn.textContent = 'Entrar'; btn.disabled = false
    }
  }

  input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt() })
  btn.addEventListener('click', attempt)
  input.focus()

  // Style input focus
  input.addEventListener('focus',  () => input.style.borderColor = '#2563eb')
  input.addEventListener('blur',   () => input.style.borderColor = '#334155')
}
