const ACCESS_KEY  = 'sid_access_token';
const REFRESH_KEY = 'sid_refresh_token';
const USER_KEY    = 'sid_user';

function saveSession(access, refresh, user) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    // Also set cookies so server-side middleware (which checks cookie `sso_access_token`) accepts requests
    try {
        const opts = ['Path=/'];
        // session cookie (no Expires) will be cleared when browser closes; set as basic cookie
        document.cookie = `sso_access_token=${access}; ${opts.join('; ')}`;
        document.cookie = `sso_refresh_token=${refresh}; ${opts.join('; ')}`;
    } catch (e) {
        console.warn('Could not set session cookies', e);
    }
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