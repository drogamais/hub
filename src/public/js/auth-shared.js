// Silent refresh helper: runs periodically to keep Hub session alive.
(function() {
  const REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 13 minutes for a 15m token

  async function doSilentRefresh() {
    try {
      const refreshUrl = (typeof window !== 'undefined' && window.HUB_REFRESH_URL) ? window.HUB_REFRESH_URL : '/api/auth/refresh';
      const res = await fetch(refreshUrl, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) {
        console.warn('[auth-shared] silent refresh failed', res.status);
        return;
      }
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        console.log('[auth-shared] silent refresh success', json);
      } catch (e) {
        console.log('[auth-shared] silent refresh response', text);
      }
    } catch (err) {
      console.warn('[auth-shared] error during silent refresh', err);
    }
  }

  // Start after small delay to avoid busy-start on page load
  setTimeout(() => {
    doSilentRefresh();
    setInterval(doSilentRefresh, REFRESH_INTERVAL_MS);
  }, 5000);
})();
const ACCESS_KEY  = 'sid_access_token';
const REFRESH_KEY = 'sid_refresh_token';
const USER_KEY    = 'sid_user';

function saveSession(access, refresh, user) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    // Cookies are now handled exclusively by the server (httpOnly) for better security and consistency.
    // However, we still clear them on logout below.
}

function getStoredUser() {
    try { 
        return JSON.parse(localStorage.getItem(USER_KEY)); 
    } catch { 
        return null; 
    }
}

function clearSessionCookies() {
    try {
        // Expire cookies
        document.cookie = 'sso_access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'sso_refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
    } catch (e) { /* ignore */ }
}