let appsCache = [];
let usersCache = [];

async function loadApps() {
  try {
    const res = await fetch('/api/apps/');
    if (res.ok) appsCache = await res.json();
  } catch (e) { console.error('Erro ao buscar apps', e); }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadApps();
  await loadGroupsAndUsers();
  startStatusPolling();
});

// Status polling
function updateStatusDot(id, online) {
  const el = document.getElementById(`status-dot-${id}`);
  if (!el) return;
  const dot = el.querySelector('span');
  const text = el.querySelector('span + span') || el.querySelector('span');
  if (online) {
    if (dot) { dot.className = 'text-xs'; dot.textContent = '🟢'; }
    if (text) text.textContent = 'Online';
  } else {
    if (dot) { dot.className = 'text-xs'; dot.textContent = '🔴'; }
    if (text) text.textContent = 'Offline';
  }
}

async function checkAppStatus(id) {
  const container = document.getElementById(`status-dot-${id}`);
  if (!container) return;
  const url = container.dataset.url;
  if (!url) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(url, { method: 'GET', mode: 'no-cors', signal: controller.signal });
    clearTimeout(timeout);
    updateStatusDot(id, true);
  } catch (e) {
    updateStatusDot(id, false);
  }
}

function startStatusPolling() {
  // initial check
  appsCache.forEach(a => { if (a && a.id) checkAppStatus(a.id); });
  // poll every 30s
  setInterval(() => {
    appsCache.forEach(a => { if (a && a.id) checkAppStatus(a.id); });
  }, 30 * 1000);
}

// Info modal
async function openInfo(id) {
  try {
    const res = await fetch(`/api/apps/${id}/`);
    if (!res.ok) throw new Error('Falha ao carregar app');
    const a = await res.json();
    document.getElementById('appInfoTitle').textContent = a.nome || 'Informações';
    document.getElementById('appInfoBody').innerHTML = `<p class="mb-2 text-sm text-slate-600">URL: <a href="${a.url}" target="_blank" class="text-sid-600 hover:underline">${a.url}</a></p><p class="text-sm text-slate-700">${a.descricao || '—'}</p>`;
    const el = document.getElementById('appInfoModal'); if (!el) return; el.classList.remove('hidden'); el.classList.add('flex');
  } catch (e) { alert(e.message); }
}

function closeInfoModal() { const el = document.getElementById('appInfoModal'); if (!el) return; el.classList.add('hidden'); el.classList.remove('flex'); }

async function loadGroupsAndUsers() {
  try {
    const uRes = await fetch('/api/apps/users-active');
    if (uRes.ok) usersCache = await uRes.json();
  } catch (e) { console.error('Erro ao buscar grupos/usuarios', e); }
}

// App permissions modal
window.openAppPermissionsModal = async function (id) {
  try {
    const res = await fetch(`/api/apps/${id}/`);
    if (!res.ok) throw new Error('Falha ao carregar aplicação.');
    const a = await res.json();

    document.getElementById('permAppId').value = a.id;
    const uMap = {};
    (a.usuarios || []).forEach(u => { uMap[u.id_usuario] = u.permissao; });

    const container = document.getElementById('permUsersList');
    container.innerHTML = '';

    usersCache.forEach(u => {
      const email = (u.email || '').toLowerCase();
      if (['ti@drogamais.com.br', 'inteligencia@drogamais.com.br'].includes(email)) return;

      const row = createUserRow(u, uMap[u.id]);
      row.dataset.search = `${email} ${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      row.dataset.setor = u.setor || '';
      container.appendChild(row);
    });

    document.getElementById('permSearch').value = '';
    const setorEl = document.getElementById('permSetor');
    if (setorEl) setorEl.value = '';

    const el = document.getElementById('permissionsModal');
    el.classList.remove('hidden');
    el.classList.add('flex');
  } catch (err) {
    alert(err.message);
  }
};

window.closePermissionsModal = function () {
  const el = document.getElementById('permissionsModal');
  if (!el) return;
  el.classList.add('hidden');
  el.classList.remove('flex');
};

function applyPermFilters() {
  const q = (document.getElementById('permSearch')?.value || '').toLowerCase();
  const setor = document.getElementById('permSetor')?.value || '';

  const rows = document.querySelectorAll('#permUsersList > div');
  rows.forEach(row => {
    const matchesQuery = !q || row.dataset.search.includes(q);
    const matchesSetor = !setor || row.dataset.setor === setor;

    if (matchesQuery && matchesSetor) {
      row.style.display = 'flex';
    } else {
      row.style.display = 'none';
    }
  });
}

document.getElementById('permSearch')?.addEventListener('input', applyPermFilters);
document.getElementById('permSetor')?.addEventListener('change', applyPermFilters);

document.getElementById('permissionsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('permFormError');
  const submitBtn = document.getElementById('permSubmitBtn');
  errorEl.classList.add('hidden');
  submitBtn.disabled = true;

  const appId = document.getElementById('permAppId').value;
  const selects = Array.from(document.querySelectorAll('#permUsersList select'));

  const usuariosOpts = selects
    .map(s => ({ id_usuario: parseInt(s.dataset.userId, 10), permissao: s.value }));

  try {
    const res = await fetch(`/api/apps/${appId}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarios: usuariosOpts })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.detail || 'Erro ao salvar permissões.');

    window.closePermissionsModal();
    window.location.reload();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
  }
});

function openModal() {
  document.getElementById('formModal').classList.remove('hidden');
  document.getElementById('formModal').classList.add('flex');
  document.getElementById('modalTitle').textContent = 'Nova aplicação';
  document.getElementById('appForm').reset();
  document.getElementById('editingId').value = '';
  document.getElementById('formError').classList.add('hidden');
}

function closeModal() {
  document.getElementById('formModal').classList.add('hidden');
  document.getElementById('formModal').classList.remove('flex');
  document.getElementById('appForm').reset();
  document.getElementById('editingId').value = '';
  document.getElementById('formError').classList.add('hidden');
}

window.openEditModal = async function (id) {
  try {
    const res = await fetch(`/api/apps/${id}/`);
    if (!res.ok) throw new Error('Falha ao carregar aplicação.');
    const a = await res.json();

    document.getElementById('editingId').value = a.id;
    document.getElementById('modalTitle').textContent = 'Editar aplicação';
    document.getElementById('f_nome').value = a.nome || '';
    document.getElementById('f_url').value = a.url || '';
    document.getElementById('f_descricao').value = a.descricao || '';
    document.getElementById('f_icone').value = a.icone || '';
    document.getElementById('f_ativo').checked = !!a.ativo;
    openModal();
  } catch (err) {
    alert(err.message);
  }
};

// groups removed — permissions are per-user only

function createUserRow(u, selected) {
  const container = document.createElement('div');
  container.className = 'flex items-center justify-between gap-3 bg-white p-3 border-b border-slate-100';
  const label = document.createElement('div');
  label.className = 'flex-1 text-sm text-slate-700';
  label.textContent = `${u.first_name} ${u.last_name} - ${u.email} ${u.setor ? `(${u.setor})` : ''}`;

  const select = document.createElement('select');
  select.className = 'rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sid-500 focus:bg-white transition';
  select.dataset.userId = u.id;
  ['none', 'normal', 'admin'].forEach(v => {
    const opt = document.createElement('option'); opt.value = v;
    if (v === 'none') opt.text = 'Sem Acesso (None)';
    if (v === 'normal') opt.text = 'Normal';
    if (v === 'admin') opt.text = 'Admin';
    if (v === (selected || 'none')) opt.selected = true;
    select.appendChild(opt);
  });
  container.appendChild(label);
  container.appendChild(select);
  return container;
}

async function deleteApp(id) {
  if (!confirm('Deseja realmente excluir esta aplicação?')) return;
  try {
    const res = await fetch(`/api/apps/${id}/`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || 'Erro ao apagar aplicação.');
    }
    const row = document.getElementById(`app-row-${id}`);
    if (row) row.remove();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('appForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('formError');
  const submitBtn = document.getElementById('modalSubmitBtn');
  errorEl.classList.add('hidden');
  submitBtn.disabled = true;

  const editingId = document.getElementById('editingId').value;
  const payload = {
    nome: document.getElementById('f_nome').value,
    descricao: document.getElementById('f_descricao').value,
    url: document.getElementById('f_url').value,
    icone: document.getElementById('f_icone').value,
    ativo: document.getElementById('f_ativo').checked,
  };

  // Usuarios são gerenciados por modal separado  
  try {
    const url = editingId ? `/api/apps/${editingId}/` : '/api/apps/';
    const method = editingId ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.detail || 'Erro ao salvar aplicação.');

    closeModal();
    window.location.reload();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
  }
});
