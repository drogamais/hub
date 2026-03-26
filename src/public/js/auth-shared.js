const ACCESS_KEY  = 'sid_access_token';
const REFRESH_KEY = 'sid_refresh_token';
const USER_KEY    = 'sid_user';

function saveSession(access, refresh, user) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getStoredUser() {
    try { 
        return JSON.parse(localStorage.getItem(USER_KEY)); 
    } catch { 
        return null; 
    }
}