let appsCache = [];
let groupsCache = [];
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
});

async function loadGroupsAndUsers() {
  try {
    const [gRes, uRes] = await Promise.all([fetch('/api/apps/groups'), fetch('/api/apps/users-active')]);
    if (gRes.ok) groupsCache = await gRes.json();
    if (uRes.ok) usersCache = await uRes.json();
  } catch (e) { console.error('Erro ao buscar grupos/usuarios', e); }
}

function openModal() {
  document.getElementById('formModal').classList.remove('hidden');
  document.getElementById('formModal').classList.add('flex');
  document.getElementById('modalTitle').textContent = 'Nova aplicação';
  document.getElementById('appForm').reset();
  document.getElementById('editingId').value = '';
  document.getElementById('formError').classList.add('hidden');
  populatePermissionControls();
}

function closeModal() {
  document.getElementById('formModal').classList.add('hidden');
  document.getElementById('formModal').classList.remove('flex');
  document.getElementById('appForm').reset();
  document.getElementById('editingId').value = '';
  document.getElementById('formError').classList.add('hidden');
}

window.openEditModal = async function(id) {
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
    populatePermissionControls(a.grupos || [], a.usuarios || []);
  } catch (err) {
    alert(err.message);
  }
};

function createGroupRow(g, selected) {
  const container = document.createElement('div');
  container.className = 'flex items-center gap-3';
  const label = document.createElement('div');
  label.className = 'flex-1 text-sm text-slate-700';
  label.textContent = g.nome;

  const select = document.createElement('select');
  select.className = 'rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm';
  select.dataset.groupId = g.id;
  ['none','normal','admin'].forEach(v => {
    const opt = document.createElement('option'); opt.value = v; opt.text = v === 'none' ? 'Sem Acesso' : (v === 'normal' ? 'Normal' : 'Admin');
    if (v === (selected || 'none')) opt.selected = true;
    select.appendChild(opt);
  });
  container.appendChild(label);
  container.appendChild(select);
  return container;
}

function createUserRow(u, selected) {
  const container = document.createElement('div');
  container.className = 'flex items-center gap-3';
  const label = document.createElement('div');
  label.className = 'flex-1 text-sm text-slate-700';
  label.textContent = `${u.first_name} ${u.last_name} (${u.email})`;

  const select = document.createElement('select');
  select.className = 'rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm';
  select.dataset.userId = u.id;
  ['inherit','none','normal','admin'].forEach(v => {
    const opt = document.createElement('option'); opt.value = v;
    if (v === 'inherit') opt.text = 'Herdar do Grupo';
    if (v === 'none') opt.text = 'Sem Acesso';
    if (v === 'normal') opt.text = 'Normal';
    if (v === 'admin') opt.text = 'Admin';
    if (v === (selected || 'inherit')) opt.selected = true;
    select.appendChild(opt);
  });
  container.appendChild(label);
  container.appendChild(select);
  return container;
}

function populatePermissionControls(grupos = [], usuarios = []) {
  const groupsListEl = document.getElementById('groupsList');
  const usersListEl = document.getElementById('usersList');
  if (!groupsListEl || !usersListEl) return;
  groupsListEl.innerHTML = '';
  usersListEl.innerHTML = '';

  // Map selections by id
  const gMap = {};
  (grupos || []).forEach(g => { gMap[g.id_grupo] = g.permissao; });
  const uMap = {};
  (usuarios || []).forEach(u => { uMap[u.id_usuario] = u.permissao; });

  // Groups
  groupsCache.forEach(g => {
    const row = createGroupRow(g, gMap[g.id]);
    groupsListEl.appendChild(row);
  });

  // Users (exclude super-admins)
  usersCache.forEach(u => {
    const setor = (u.setor || '').toString().toUpperCase();
    const isSuperAdmin = u.role === 'admin' && (setor === 'TI' || setor === 'INTELIGÊNCIA DE MERCADO');
    if (isSuperAdmin) return; // skip
    const row = createUserRow(u, uMap[u.id]);
    usersListEl.appendChild(row);
  });
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

  // Collect grupos and usuarios selections
  const gruposEls = Array.from(document.querySelectorAll('#groupsList select'));
  if (gruposEls.length > 0) {
    payload.grupos = gruposEls.map(s => ({ id_grupo: parseInt(s.dataset.groupId, 10), permissao: s.value }));
  }
  const usuariosEls = Array.from(document.querySelectorAll('#usersList select'));
  if (usuariosEls.length > 0) {
    payload.usuarios = usuariosEls.map(s => ({ id_usuario: parseInt(s.dataset.userId, 10), permissao: s.value }));
  }

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
