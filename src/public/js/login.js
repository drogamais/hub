document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const emailEl = document.getElementById('emailInput');
    const passEl = document.getElementById('passwordInput');
    const errorBox = document.getElementById('errorBox');
    const btn = document.getElementById('submitBtn');

    // Verifica se já existe uma sessão ativa antes de mostrar o login
    (function checkAlreadyLoggedIn() {
        const user = getStoredUser();
        if (!user) return;

        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect');

        if (redirect) {
            const access = localStorage.getItem('sid_access_token') || '';
            const refresh = localStorage.getItem('sid_refresh_token') || '';
            const userData = encodeURIComponent(JSON.stringify(user));
            const separator = redirect.includes('?') ? '&' : '?';
            window.location.href = `${redirect}${separator}access_token=${access}&refresh_token=${refresh}&user=${userData}`;
        } else {
            window.location.href = '/app/hub';
        }
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