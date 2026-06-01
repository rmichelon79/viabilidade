// ─── AUTENTICAÇÃO — Login único da Plataforma Sopra (Supabase Auth) ──────────
// Substitui a senha SHA-256 client-side. Mesmas contas do portal e do app de
// Gestão. O acesso é gated por app_access('viabilidade') (admin entra sempre).
import { SBC } from './supabase.js'

export async function logout() {
  try { await SBC.auth.signOut() } catch (_) {}
  location.reload()
}

// Verifica se o usuário logado tem acesso ao app 'viabilidade'
async function hasAccess(user) {
  try {
    const [{ data: prof }, { data: acc }] = await Promise.all([
      SBC.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      SBC.from('app_access').select('can_view').eq('app', 'viabilidade').maybeSingle(),
    ])
    const isAdmin = prof && prof.role === 'admin'
    return isAdmin || (acc && acc.can_view === true)
  } catch (_) { return false }
}

export async function initAuth(onSuccess) {
  const { data: { session } } = await SBC.auth.getSession()
  if (session && session.user) {
    if (await hasAccess(session.user)) { onSuccess(); return }
    await SBC.auth.signOut() // logado, mas sem acesso a este módulo
  }
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
        <div style="font-size:0.8rem;color:#64748b;margin-top:6px">Login único Sopra</div>
      </div>

      <div id="auth-error" style="display:none;background:#7f1d1d;color:#fca5a5;
           padding:10px 14px;border-radius:8px;font-size:0.8rem;margin-bottom:16px;
           border:1px solid #dc2626"></div>

      <div style="margin-bottom:16px">
        <label style="font-size:0.75rem;color:#94a3b8;display:block;margin-bottom:6px">E-mail</label>
        <input id="auth-email" type="email" autocomplete="email"
          style="width:100%;padding:10px 14px;background:#0f172a;border:1px solid #334155;
                 border-radius:8px;color:#f8fafc;font-size:0.95rem;outline:none;
                 transition:border .15s;box-sizing:border-box"
          placeholder="seu.nome@sopraincorporadora.com.br">
      </div>

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

      <div style="text-align:center;margin-top:20px;font-size:0.7rem;color:#334155">
        🔒 Acesso protegido
      </div>
    </div>`

  document.body.appendChild(overlay)

  const email = overlay.querySelector('#auth-email')
  const input = overlay.querySelector('#auth-pwd')
  const btn   = overlay.querySelector('#auth-btn')
  const err   = overlay.querySelector('#auth-error')

  function showError(msg) { err.textContent = msg; err.style.display = 'block' }

  async function attempt() {
    err.style.display = 'none'
    btn.textContent = 'Entrando…'; btn.disabled = true
    const { data, error } = await SBC.auth.signInWithPassword({
      email: email.value.trim().toLowerCase(),
      password: input.value,
    })
    if (error) {
      showError('E-mail ou senha incorretos.')
      input.value = ''; input.focus()
      btn.textContent = 'Entrar'; btn.disabled = false
      return
    }
    if (!(await hasAccess(data.user))) {
      await SBC.auth.signOut()
      showError('Você não tem acesso ao módulo de Viabilidade.')
      btn.textContent = 'Entrar'; btn.disabled = false
      return
    }
    overlay.remove()
    onSuccess()
  }

  email.addEventListener('keydown', e => { if (e.key === 'Enter') input.focus() })
  input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt() })
  btn.addEventListener('click', attempt)
  email.focus()

  for (const el of [email, input]) {
    el.addEventListener('focus', () => el.style.borderColor = '#2563eb')
    el.addEventListener('blur',  () => el.style.borderColor = '#334155')
  }
}
