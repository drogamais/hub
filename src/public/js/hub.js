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
    startHubStatusPolling();
});

async function checkAppStatus(id) {
  const container = document.getElementById(`hub-status-container-${id}`);
  if (!container) return;
  const url = container.dataset.url;
  if (!url) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // mode: 'no-cors' allows us to ping the URL to check reachability even if CORS isn't perfect
    const res = await fetch(url, { method: 'GET', mode: 'no-cors', signal: controller.signal });
    clearTimeout(timeout);
    updateHubStatusDot(id, true);
  } catch (e) {
    updateHubStatusDot(id, false);
  }
}

function updateHubStatusDot(id, online) {
  const container = document.getElementById(`hub-status-container-${id}`);
  if (!container) return;
  const dot = container.querySelector('span:first-child');
  const text = container.querySelector('span:last-child');
  if (online) {
    if (dot) dot.textContent = '🟢';
    if (text) { text.textContent = 'Online'; text.className = 'text-xs font-semibold text-slate-500'; }
  } else {
    if (dot) dot.textContent = '🔴';
    if (text) { text.textContent = 'Offline'; text.className = 'text-xs font-semibold text-slate-500'; }
  }
}

function startHubStatusPolling() {
  const containers = document.querySelectorAll('[id^="hub-status-container-"]');
  const ids = Array.from(containers).map(c => c.id.replace('hub-status-container-', ''));
  ids.forEach(id => checkAppStatus(id));
  setInterval(() => {
    ids.forEach(id => checkAppStatus(id));
  }, 30 * 1000);
}   