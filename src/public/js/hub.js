/**
 * Adiciona os tokens do localStorage à URL do app antes de navegar.
 * Isso garante que o SSO funcione mesmo que os tokens mudem.
 */
function appendSSOTokens(event, element) {
    event.preventDefault();
    
    const token = localStorage.getItem('sid_access_token') || '';
    const refresh = localStorage.getItem('sid_refresh_token') || '';
    const user = localStorage.getItem('sid_user') || '{}';
    
    const baseUrl = element.getAttribute('href');
    const separator = baseUrl.includes('?') ? '&' : '?';
    
    const finalUrl = `${baseUrl}${separator}access_token=${token}&refresh_token=${refresh}&user=${encodeURIComponent(user)}`;
    
    window.open(finalUrl, '_blank', 'noopener noreferrer');
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', () => {
    const user = getStoredUser();
    if (!user) {
        window.location.href = '/login';
    }
});