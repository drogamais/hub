// Funções de Token e Sessão
const ACCESS_KEY  = 'sid_access_token';
const REFRESH_KEY = 'sid_refresh_token';
const USER_KEY    = 'sid_user';

async function clearSession() {
    // 1. Pega o refresh token do localStorage antes de apagar tudo
    const refreshToken = localStorage.getItem(REFRESH_KEY);

    // 2. Limpa o armazenamento local
    localStorage.clear();

    try {
        // 3. Faz o logout no servidor esperando a resposta (await)
        await fetch('/api/auth/logout', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refreshToken }), // Envia no corpo como backup
            credentials: 'include' // ESSENCIAL: Envia os cookies HttpOnly para o servidor
        });
        console.log('[Auth] Logout remoto concluído');
    } catch (e) {
        console.warn('[Auth] Erro ao avisar o servidor do logout:', e);
    }
}

async function handleLogout() {
    if (confirm('Deseja realmente sair?')) {
        // Agora aguardamos o processo terminar antes de mudar de página
        await clearSession();
        window.location.href = '/login';
    }
}