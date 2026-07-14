// ─── AUTENTICAÇÃO — Login único da Plataforma Sopra (Supabase Auth) ──────────
// Substitui a senha SHA-256 client-side. Mesmas contas do portal e do app de
// Gestão. O acesso é gated por app_access('viabilidade') (admin entra sempre).
import { SBC } from './supabase.js'

export async function logout() {
  try { await SBC.auth.signOut() } catch (_) {}
  location.href = 'https://rmichelon79.github.io/sopra-portal/'
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
    position:fixed;inset:0;background:#F7F5F0;
    display:flex;align-items:center;justify-content:center;
    z-index:9999;font-family:'DM Sans',system-ui,sans-serif;
  `
  overlay.innerHTML = `
    <div style="width:360px;padding:38px 34px;background:#FFFFFF;border:1px solid #E4DED2;border-radius:16px;
                box-shadow:0 1px 2px rgba(34,31,26,.04),0 18px 44px rgba(34,31,26,.10)">
      <div style="text-align:center;margin-bottom:30px">
        <img src="https://rmichelon79.github.io/sopra-portal/sopra-logo.png" alt="Sopra Incorporadora"
             style="height:30px;width:auto;display:block;margin:0 auto 12px">
        <div style="font-family:'DM Serif Display',Georgia,serif;font-size:1.5rem;color:#22201B">Viabilidade</div>
        <div style="font-size:0.8rem;color:#7C7568;margin-top:6px">Login único Sopra</div>
      </div>

      <div id="auth-error" style="display:none;background:#FCEBEB;color:#A32D2D;
           padding:10px 14px;border-radius:8px;font-size:0.8rem;margin-bottom:16px;
           border:1px solid #E9BCBB"></div>

      <div style="margin-bottom:16px">
        <label style="font-size:0.75rem;color:#7C7568;display:block;margin-bottom:6px">E-mail</label>
        <input id="auth-email" type="email" autocomplete="email"
          style="width:100%;padding:10px 14px;background:#F7F5F0;border:1px solid #D8D0C1;
                 border-radius:8px;color:#22201B;font-size:0.95rem;outline:none;
                 transition:border .15s;box-sizing:border-box"
          placeholder="seu.nome@sopraincorporadora.com.br">
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:0.75rem;color:#7C7568;display:block;margin-bottom:6px">Senha</label>
        <input id="auth-pwd" type="password" autocomplete="current-password"
          style="width:100%;padding:10px 14px;background:#F7F5F0;border:1px solid #D8D0C1;
                 border-radius:8px;color:#22201B;font-size:0.95rem;outline:none;
                 transition:border .15s;box-sizing:border-box"
          placeholder="••••••••">
      </div>

      <button id="auth-btn"
        style="width:100%;padding:11px;background:#7AA436;color:#22201B;border:none;
               border-radius:8px;font-size:0.9rem;font-weight:700;cursor:pointer;
               transition:background .15s">
        Entrar
      </button>

      <div style="text-align:center;margin-top:20px;font-size:0.7rem;color:#A8A093">
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
    el.addEventListener('focus', () => el.style.borderColor = '#7AA436')
    el.addEventListener('blur',  () => el.style.borderColor = '#D8D0C1')
  }
}
