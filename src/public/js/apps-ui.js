let appsCache = [];

async function loadApps() {
  try {
    const res = await fetch('/api/apps/');
    if (res.ok) appsCache = await res.json();
  } catch (e) { console.error('Erro ao buscar apps', e); }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadApps();
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
  } catch (err) {
    alert(err.message);
  }
};

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
