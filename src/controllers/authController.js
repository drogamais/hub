const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { generateAccessToken, generateRefreshTokenString } = require('../lib/token');
const { resolveAppPermissionsForUser } = require('../lib/permissions');

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
    reply.setCookie('sso_access_token', access, { 
      path: '/', httpOnly: true, sameSite: 'lax', maxAge: 1 * 60 
    });
    
    // Guardamos o refresh em cookie para usar no endpoint de logout (MaxAge 1 dia)
    reply.setCookie('sso_refresh_token', refreshString, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1 * 24 * 60 * 60, // 1 dia em segundos
    });

    // 4. Retorna AMBOS os tokens para o frontend poder redirecionar (SSO)
    return reply.send({ access, refresh: refreshString, user: sanitizeUser(user) });
  },

  async logout(request, reply) {
    // Tenta invalidar o refresh token no banco se estiver no cookie
    const refreshToken = request.cookies.sso_refresh_token;
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true }
      });
    }

    reply.clearCookie('sso_access_token', { path: '/' });
    reply.clearCookie('sso_refresh_token', { path: '/' });
    return reply.send({ ok: true });
  }
  ,
  async refresh(request, reply) {
    // Accept refresh token either from cookie or JSON body { refresh }
    const refreshToken = request.cookies.sso_refresh_token || (request.body && request.body.refresh);
    if (!refreshToken) {
      console.log('[Hub Auth] Refresh requested without token.');
      return reply.code(400).send({ detail: 'refresh token required' });
    }

    const stored = await prisma.refreshToken.findFirst({ where: { token: refreshToken } });
    
    if (!stored) {
      console.warn('[Hub Auth] Refresh token not found in database.');
      return reply.code(401).send({ detail: 'refresh invalid' });
    }
    
    if (stored.revoked) {
      console.log('[Hub Auth] Refresh blocked: token has been revoked (Global Logout).');
      return reply.code(401).send({ detail: 'refresh invalid' });
    }

    if (stored.expires_at && new Date(stored.expires_at) < new Date()) {
      console.log('[Hub Auth] Refresh blocked: token expired.');
      return reply.code(401).send({ detail: 'refresh expired' });
    }

    // Load user to build access token payload
    const user = await prisma.user.findUnique({ where: { id: stored.id_usuario } });
    if (!user) {
      console.error('[Hub Auth] User not found during refresh lookup.');
      return reply.code(401).send({ detail: 'user not found' });
    }

    console.log('[Hub Auth] Session renewed for user:', user.username);
    const appPermissions = await resolveAppPermissionsForUser(user.id);
    const access = generateAccessToken({ userId: user.id, first_name: user.first_name, last_name: user.last_name, setor: user.setor, appPermissions });

    // Return only access token (SID will set its own cookie)
    return reply.send({ access });
  }
};

module.exports = authController;