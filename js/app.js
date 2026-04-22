import { render as renderPremissas } from './pages/premissas.js'
import { render as renderTabela } from './pages/tabela.js'
import { render as renderCenarios, destroy as destroyCenarios } from './pages/cenarios.js'
import { render as renderResultados, destroy as destroyResultados } from './pages/resultados.js'
import { subscribe, resetAll, getState, loadState } from './store.js'
import { getSaved, saveAnalysis, deleteAnalysis, exportJSON, importJSON } from './save.js'

const PAGES = {
  premissas:  { render: renderPremissas,  destroy: null },
  tabela:     { render: renderTabela,     destroy: null },
  cenarios:   { render: renderCenarios,   destroy: destroyCenarios },
  resultados: { render: renderResultados, destroy: destroyResultados },
}

let _currentPage = null

function navigate(page) {
  // Destroy current page if needed
  if (_currentPage && PAGES[_currentPage]?.destroy) {
    PAGES[_currentPage].destroy()
  }

  _currentPage = page

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page)
  })

  // Render page
  const container = document.getElementById('main-content')
  if (container && PAGES[page]) {
    PAGES[page].render(container)
  }

  // Update hash
  history.replaceState(null, '', '#' + page)
}

function init() {
  // Nav links
  document.querySelectorAll('.nav-link').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault()
      navigate(el.dataset.page)
    })
  })

  // Reset button
  const btnReset = document.getElementById('btn-reset')
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('Resetar todos os dados para os valores padrão (ALTANA)?')) {
        resetAll()
        navigate(_currentPage || 'premissas')
      }
    })
  }

  // Save analysis
  document.getElementById('btn-save')?.addEventListener('click', () => {
    const state = getState()
    const suggested = state.premissas?.nome || 'Análise'
    showModal('Salvar análise', `
      <p style="font-size:.85rem;color:#475569;margin-bottom:12px">Dê um nome para esta análise para recuperá-la depois.</p>
      <input id="save-name" class="fi" type="text" value="${esc(suggested)}" placeholder="Nome da análise" style="width:100%">
    `, [
      { label: 'Cancelar', cls: 'btn-sm', action: closeModal },
      { label: '💾 Salvar', cls: 'btn-add', action: () => {
        const name = document.getElementById('save-name')?.value?.trim()
        if (!name) return
        saveAnalysis(name, getState())
        closeModal()
        flashMsg('✅ Análise salva: ' + name)
      }},
    ])
    // Select text in input for easy replacement
    setTimeout(() => { const el = document.getElementById('save-name'); el?.select() }, 50)
  })

  // Open saved analyses
  document.getElementById('btn-open')?.addEventListener('click', () => showOpenModal())

  // Import JSON
  document.getElementById('btn-import')?.addEventListener('change', async e => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset so same file can be re-imported
    try {
      const state = await importJSON(file)
      if (confirm(`Importar "${file.name}"? O estado atual será substituído.`)) {
        loadState(state)
        navigate(_currentPage || 'premissas')
        flashMsg('✅ Importado: ' + file.name)
      }
    } catch (err) {
      alert('Erro ao importar: ' + err.message)
    }
  })

  // Subscribe to state changes to update calcs displayed on current page
  subscribe(state => {
    // Derived values on premissas page update themselves via event listeners
    // Resultados page should re-render on state change if visible
    if (_currentPage === 'resultados') {
      const container = document.getElementById('main-content')
      if (container) {
        destroyResultados()
        renderResultados(container)
      }
    }
  })

  // Browser back/forward navigation
  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '')
    if (PAGES[hash] && hash !== _currentPage) navigate(hash)
  })

  // Initial page from hash or default
  const hash = location.hash.replace('#', '')
  navigate(PAGES[hash] ? hash : 'premissas')
}

document.addEventListener('DOMContentLoaded', init)

// ─── MODAL HELPERS ───────────────────────────────────────────
function showModal(title, bodyHTML, buttons) {
  document.getElementById('modal-title').textContent = title
  document.getElementById('modal-body').innerHTML = bodyHTML
  const footer = document.getElementById('modal-footer')
  footer.innerHTML = ''
  buttons.forEach(({ label, cls, action }) => {
    const btn = document.createElement('button')
    btn.className = cls || 'btn-sm'
    btn.innerHTML = label
    btn.addEventListener('click', action)
    footer.appendChild(btn)
  })
  document.getElementById('modal-overlay').classList.remove('hidden')
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden')
}

// Close on overlay click
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal()
  })
})

function showOpenModal() {
  const saved = getSaved()
  const bodyHTML = saved.length === 0
    ? '<div class="modal-empty">Nenhuma análise salva ainda.<br>Use "Salvar análise" para guardar o estudo atual.</div>'
    : saved.map(e => `
      <div class="saved-item" data-id="${e.id}">
        <div class="saved-item-info">
          <div class="saved-item-name">${esc(e.name)}</div>
          <div class="saved-item-date">${esc(e.date)}</div>
        </div>
        <button class="saved-item-del" data-del="${e.id}" title="Excluir">🗑</button>
      </div>`).join('')

  showModal('Análises salvas', bodyHTML, [
    { label: 'Fechar', cls: 'btn-sm', action: closeModal },
  ])

  // Wire events inside modal
  document.getElementById('modal-body')?.addEventListener('click', e => {
    const item = e.target.closest('.saved-item')
    const delBtn = e.target.closest('[data-del]')
    if (delBtn) {
      e.stopPropagation()
      const id = Number(delBtn.dataset.del)
      if (confirm('Excluir esta análise?')) {
        deleteAnalysis(id)
        showOpenModal() // refresh
      }
      return
    }
    if (item) {
      const id = Number(item.dataset.id)
      const entry = getSaved().find(e => e.id === id)
      if (!entry) return
      if (confirm(`Carregar "${entry.name}"? O estado atual será substituído.`)) {
        loadState(entry.state)
        navigate(_currentPage || 'premissas')
        closeModal()
        flashMsg('✅ Carregado: ' + entry.name)
      }
    }
  })
}

let _flashTimer = null
function flashMsg(msg) {
  let el = document.getElementById('flash-msg')
  if (!el) {
    el = document.createElement('div')
    el.id = 'flash-msg'
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;font-size:.85rem;z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,.3);transition:opacity .3s'
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.style.opacity = '1'
  clearTimeout(_flashTimer)
  _flashTimer = setTimeout(() => { el.style.opacity = '0' }, 2500)
}

function esc(s) { return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
