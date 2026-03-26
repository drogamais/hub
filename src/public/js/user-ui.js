// Controle de Modais da página de Usuários
function openModal() {
    const modal = document.getElementById('formModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeModal() {
    const modal = document.getElementById('formModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('userForm').reset();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const newUserBtn = document.getElementById('newUserBtn');
    if (newUserBtn) newUserBtn.addEventListener('click', openModal);
});