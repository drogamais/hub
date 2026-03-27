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