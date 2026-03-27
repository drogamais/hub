// Funções de Token e Sessão
const ACCESS_KEY  = 'sid_access_token';
const REFRESH_KEY = 'sid_refresh_token';
const USER_KEY    = 'sid_user';

const getToken = () => localStorage.getItem(ACCESS_KEY);
const getStoredUser = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
};

function clearSession() {
    localStorage.clear();
    try { clearSessionCookies(); } catch (e) {}
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

async function handleLogout() {
    if (confirm('Deseja realmente sair?')) {
        clearSession();
        window.location.href = '/login';
    }
}