const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { generateAccessToken, generateRefreshTokenString } = require('../lib/token');
const { resolveAppPermissionsForUser } = require('../lib/permissions');

// Cookie configuration
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || 'localhost';
const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || 'lax';
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';

// Opções padrão para consistência entre set e clear
const baseCookieOpts = { 
  path: '/', 
  httpOnly: true, 
  sameSite: COOKIE_SAME_SITE, 
  domain: COOKIE_DOMAIN, 
  secure: COOKIE_SECURE 
};

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

    const appPermissions = await resolveAppPermissionsForUser(user.id);

    const access = generateAccessToken({ 
      userId: user.id, first_name: user.first_name, 
      last_name: user.last_name, setor: user.setor, appPermissions 
    });

    const refreshString = generateRefreshTokenString();
    const expiresAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); 
    
    await prisma.refreshToken.create({ 
      data: { token: refreshString, id_usuario: user.id, expires_at: expiresAt } 
    });

    // Set Cookies
    reply.setCookie('sso_access_token', access, { 
      ...baseCookieOpts,
      maxAge: 1 * 60 
    });
    
    reply.setCookie('sso_refresh_token', refreshString, {
      ...baseCookieOpts,
      maxAge: 1 * 24 * 60 * 60,
    });

    return reply.send({ access, refresh: refreshString, user: sanitizeUser(user) });
  },

  async logout(request, reply) {
    try {
      // Pega o token do cookie ou do body
      const refreshToken = request.cookies.sso_refresh_token || (request.body && request.body.refresh);
      
      if (refreshToken) {
        // Usamos updateMany para evitar erro caso o token não exista mais no banco
        await prisma.refreshToken.updateMany({
          where: { token: refreshToken },
          data: { revoked: true }
        });
        console.log('[Hub Auth] Token revogado no banco.');
      }
    } catch (e) {
      console.error('[Hub Auth] Erro ao revogar token:', e.message);
      // Não damos return aqui para que os cookies sejam limpos mesmo se o banco falhar
    }

    // LIMPEZA DOS COOKIES - Importante passar as mesmas opções do baseCookieOpts
    reply.clearCookie('sso_access_token', baseCookieOpts);
    reply.clearCookie('sso_refresh_token', baseCookieOpts);

    return reply.code(200).send({ ok: true });
  },

  async refresh(request, reply) {
    const refreshToken = request.cookies.sso_refresh_token || (request.body && request.body.refresh);
    
    const result = await require('../lib/authService').refreshSession(refreshToken);
    
    if (!result) {
      return reply.code(401).send({ detail: 'refresh invalid or expired' });
    }

    if (request.cookies.sso_refresh_token || (request.headers && request.headers['x-set-sso-cookie'] === '1')) {
      reply.setCookie('sso_access_token', result.access, { 
        ...baseCookieOpts,
        maxAge: 1 * 60 
      });
    }

    return reply.send({ access: result.access });
  }
};

module.exports = authController;