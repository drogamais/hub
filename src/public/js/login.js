document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const emailEl = document.getElementById('emailInput');
    const passEl = document.getElementById('passwordInput');
    const errorBox = document.getElementById('errorBox');
    const btn = document.getElementById('submitBtn');
    
    // Check for expiration errors in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'expired') {
        alert('Sessão expirada: seu token de acesso não pôde ser renovado ou foi revogado.');
        if (errorBox) {
            errorBox.textContent = 'logout: token expirado';
            errorBox.classList.remove('hidden');
        }
    }

    // Verifica se já existe uma sessão ativa antes de mostrar o login
    (function checkAlreadyLoggedIn() {
        const user = getStoredUser();
        const access = localStorage.getItem('sid_access_token');
        const refresh = localStorage.getItem('sid_refresh_token');

        // require both user and access token to consider session candidate
        if (!user || !access) return;

        // Try to renew/validate the access token using refresh token before redirecting.
        // If refresh is missing or invalid, clear stale session to avoid redirect loops.
        (async () => {
            try {
                if (!refresh) throw new Error('no refresh');
                const res = await fetch('/api/auth/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh })
                });
                if (!res.ok) throw new Error('refresh failed');
                const data = await res.json();
                const newAccess = data.access;
                if (!newAccess) throw new Error('no access');

                // Save renewed session (this will also set cookies)
                saveSession(newAccess, refresh, user);

                const params = new URLSearchParams(window.location.search);
                const redirect = params.get('redirect');
                if (redirect) {
                    const userData = encodeURIComponent(JSON.stringify(user));
                    const separator = redirect.includes('?') ? '&' : '?';
                    window.location.href = `${redirect}${separator}access_token=${newAccess}&refresh_token=${refresh}&user=${userData}`;
                } else {
                    window.location.href = '/app/hub';
                }
            } catch (err) {
                // stale or invalid tokens — clear and stay on login page
                try { clearSessionCookies(); } catch (e) {}
                localStorage.removeItem('sid_access_token');
                localStorage.removeItem('sid_refresh_token');
                localStorage.removeItem('sid_user');
                return;
            }
        })();
    })();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorBox.classList.add('hidden');
        btn.disabled = true;
        btn.textContent = 'Entrando...';

        const params = new URLSearchParams(window.location.search);
        const client_id = params.get('client_id');
        const redirect_uri = params.get('redirect_uri');
        const state = params.get('state');

        try {
            let res;
            const payload = {
                username: emailEl.value.trim().toLowerCase(),
                password: passEl.value,
            };

            if (client_id && redirect_uri) {
                // Fluxo de Confirmação SSO (Authorization Code)
                res = await fetch('/api/auth/authorize/confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...payload, client_id, redirect_uri, state }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Falha na autorização.');
                window.location.href = data.redirect;
            } else {
                // Login Normal no Hub
                res = await fetch('/api/auth/login/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Credenciais inválidas.');
                
                // Função saveSession deve estar no auth-shared.js
                saveSession(data.access, data.refresh, data.user);

                const redirect = params.get('redirect');
                if (redirect) {
                    const userData = encodeURIComponent(JSON.stringify(data.user));
                    const separator = redirect.includes('?') ? '&' : '?';
                    window.location.href = `${redirect}${separator}access_token=${data.access}&refresh_token=${data.refresh}&user=${userData}`;
                } else {
                    window.location.href = '/app/hub';
                }
            }
        } catch (err) {
            errorBox.textContent = err.message;
            errorBox.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Acessar Intranets';
        }
    });
});