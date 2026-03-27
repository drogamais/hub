const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { generateAccessToken, generateRefreshTokenString } = require('../lib/token');
const { resolveAppPermissionsForUser } = require('../lib/permissions');

// Cookie configuration from environment
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || 'localhost';
const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || 'lax';
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';

function sanitizeUser(user) {
  if (!user) return null;
  const u = { ...user };
  delete u.password;
  return u;
}

const authController = {
  async login(request, reply) {
    const { username, password } = request.body || {};
    if (!username || !password) return reply.code(400).send({ detail: 'Usuário e senha são obrigatórios.' });

    const uname = username.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { username: uname },
      include: { user_apps: { include: { app: true } } }
    });

    if (!user || !user.is_active) return reply.code(401).send({ detail: 'Credenciais inválidas ou utilizador inativo.' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return reply.code(401).send({ detail: 'Credenciais inválidas.' });

    // Resolve app permissions map for this user
    const appPermissions = await resolveAppPermissionsForUser(user.id);

    // 1. Gera o Access Token (com o setor + appPermissions)
    const access = generateAccessToken({ 
      userId: user.id, first_name: user.first_name, 
      last_name: user.last_name, setor: user.setor, appPermissions 
    });

    // 2. Geração do Refresh Token de 1 DIA
    const refreshString = generateRefreshTokenString();
    const expiresAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1 dia em milissegundos
    
    // Atenção: Aqui não usamos 'stored' porque é um login novo
    await prisma.refreshToken.create({ 
      data: { token: refreshString, id_usuario: user.id, expires_at: expiresAt } 
    });

    // 3. Define os Cookies (para o SSR do Hub)
    const baseCookieOpts = { path: '/', httpOnly: true, sameSite: COOKIE_SAME_SITE, domain: COOKIE_DOMAIN, secure: COOKIE_SECURE };

    reply.setCookie('sso_access_token', access, { 
      ...baseCookieOpts,
      maxAge: 1 * 60 // seconds
    });
    
    // Guardamos o refresh em cookie para usar no endpoint de logout (MaxAge 1 dia)
    reply.setCookie('sso_refresh_token', refreshString, {
      ...baseCookieOpts,
      maxAge: 1 * 24 * 60 * 60, // 1 dia em segundos
    });

    // 4. Retorna AMBOS os tokens para o frontend poder redirecionar (SSO)
    return reply.send({ access, refresh: refreshString, user: sanitizeUser(user) });
  },

  async logout(request, reply) {
    // Tenta invalidar o refresh token no banco. Aceita token via cookie ou JSON body { refresh }
    const refreshToken = request.cookies.sso_refresh_token || (request.body && request.body.refresh);
    if (refreshToken) {
      try {
        await prisma.refreshToken.updateMany({
          where: { token: refreshToken },
          data: { revoked: true }
        });
        console.log('[Hub Auth] Revoked refresh token for logout.');
      } catch (e) {
        console.warn('[Hub Auth] Failed to revoke refresh token:', e && e.message);
      }
    }

    reply.clearCookie('sso_access_token', { path: '/', domain: COOKIE_DOMAIN });
    reply.clearCookie('sso_refresh_token', { path: '/', domain: COOKIE_DOMAIN });
    return reply.send({ ok: true });
  }
  ,
  async refresh(request, reply) {
    // Accept refresh token either from cookie or JSON body { refresh }
    const refreshToken = request.cookies.sso_refresh_token || (request.body && request.body.refresh);
    
    const result = await require('../lib/authService').refreshSession(refreshToken);
    
    if (!result) {
      console.log('[Hub Auth] Refresh blocked: token invalid, expired, or revoked.');
      return reply.code(401).send({ detail: 'refresh invalid or expired' });
    }

    console.log('[Hub Auth] Session renewed for user:', result.user.username);
    
    // If it came from cookie, we update the access cookie
    const baseCookieOpts = { path: '/', httpOnly: true, sameSite: COOKIE_SAME_SITE, domain: COOKIE_DOMAIN, secure: COOKIE_SECURE };
    if (request.cookies.sso_refresh_token) {
      reply.setCookie('sso_access_token', result.access, { 
        ...baseCookieOpts,
        maxAge: 1 * 60 
      });
    }

    // If a caller requests the hub to set the cookie (internal/service call), support via header
    // e.g. send 'x-set-sso-cookie: 1' to have the hub set the sso_access_token cookie.
    if (!request.cookies.sso_refresh_token && request.headers && request.headers['x-set-sso-cookie'] === '1') {
      reply.setCookie('sso_access_token', result.access, { 
        ...baseCookieOpts,
        maxAge: 1 * 60
      });
    }

    // Return only access token (SID will set its own cookie if needed)
    return reply.send({ access: result.access });
  }
};

module.exports = authController;