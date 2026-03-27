let allApps = [];

// 1. Ao carregar a página, vai buscar as aplicações ao servidor
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/apps/');
        if (res.ok) allApps = await res.json();
        // no groups — permissions are per-user
    } catch (e) { console.error('Erro ao buscar apps', e); }
});

function openModal() {
    document.getElementById('formModal').classList.remove('hidden');
    document.getElementById('formModal').classList.add('flex');
}

function closeModal() {
    document.getElementById('formModal').classList.add('hidden');
    document.getElementById('formModal').classList.remove('flex');
    document.getElementById('userForm').reset();
    document.getElementById('formError').classList.add('hidden');
    document.getElementById('editingId').value = '';
}

function renderAppsCheckboxes(selectedIds = []) {
    const appsSection = document.getElementById('appsSection');
    const appsGrid = document.getElementById('appsGrid');
    
    if (!allApps.length) {
        appsSection.classList.add('hidden');
        return;
    }
    
    appsSection.classList.remove('hidden');
    appsGrid.innerHTML = allApps.map(app => `
        <label class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-100 transition">
            <input type="checkbox" class="app-chk accent-sid-600 w-4 h-4 rounded" data-appid="${app.id}" ${selectedIds.includes(app.id) ? 'checked' : ''} />
            ${app.nome}
        </label>
    `).join('');
}

// 2. Ação de Clicar em NOVO USUÁRIO
document.querySelector('button[onclick="openModal()"]').addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = 'Novo usuário';
    document.getElementById('passwordLabel').textContent = 'Senha (Obrigatório)';
    document.getElementById('f_password').required = true;
    // set default group selection to empty
    // groups removed
});

// 3. Ação de Clicar em EDITAR (Adicione `onclick="openEditModal(<%= u.id %>)"` no botão "Editar" do seu ficheiro partials/user-table-rows.ejs)
window.openEditModal = async function(id) {
    try {
        // A BARRA NO FINAL É CRUCIAL PARA O FASTIFY RESPONDER
        const res = await fetch(`/api/users/${id}/`); 
        
        if (!res.ok) throw new Error('Falha ao carregar usuário.');
        const u = await res.json();

        document.getElementById('editingId').value = u.id;
        document.getElementById('modalTitle').textContent = 'Editar usuário';
        document.getElementById('passwordLabel').textContent = 'Nova Senha (Opcional)';
        document.getElementById('f_password').required = false;

        document.getElementById('f_email').value = u.email;
        document.getElementById('f_first_name').value = u.first_name;
        document.getElementById('f_last_name').value = u.last_name;
        // role removed — super-admin determined by email
        document.getElementById('f_setor').value = u.setor || '';
        document.getElementById('f_is_active').checked = u.is_active;
        const selectedAppIds = u.aplicacoes ? u.aplicacoes.map(a => a.id) : [];
        
        openModal();
    } catch (err) { 
        alert(err.message); 
    }
};

// 4. Salvar (POST ou PATCH)
document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('formError');
    const submitBtn = document.getElementById('modalSubmitBtn');
    
    errorEl.classList.add('hidden');
    submitBtn.disabled = true;

    const editingId = document.getElementById('editingId').value;
    const pw = document.getElementById('f_password').value;
    const selectedApps = Array.from(document.querySelectorAll('.app-chk:checked')).map(c => Number(c.dataset.appid));

    const payload = {
        email: document.getElementById('f_email').value,
        first_name: document.getElementById('f_first_name').value,
        last_name: document.getElementById('f_last_name').value,
        // role removed
        setor: document.getElementById('f_setor').value || null,
        is_active: document.getElementById('f_is_active').checked,
        aplicacoes: selectedApps,
        // groupId removed
    };

    if (pw) payload.password = pw;

    try {
        const url = editingId ? `/api/users/${editingId}/` : '/api/users/';
        const method = editingId ? 'PATCH' : 'POST';

        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json().catch(() => null);

        if (!res.ok) throw new Error(data?.detail || 'Erro ao salvar usuário.');

        closeModal();
        window.location.reload(); // Recarrega para exibir a tabela atualizada
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
    }
});