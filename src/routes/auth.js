const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { generateAccessToken, generateRefreshTokenString, verifyAccessToken } = require('../lib/token');

function sanitizeUser(user) {
  if (!user) return null;
  const u = { ...user };
  delete u.password;
  if (u.user_apps && Array.isArray(u.user_apps)) {
    u.aplicacoes = u.user_apps.map(ua => ua.app).filter(Boolean).map(a => ({ id: a.id, nome: a.nome, url: a.url, icone: a.icone }));
    delete u.user_apps;
  }
  return u;
}

// ─── Fastify route plugin ────────────────────────────────────────
async function authRoutes(fastify) {

  // ── POST /api/auth/login ─────────────────────────────────────
  fastify.post('/login/', async (request, reply) => {
    try {
      const { username, password } = request.body || {};

      if (!username || !password) {
        return reply.code(400).send({ detail: 'Usuário e senha são obrigatórios.' });
      }

      const uname = username.trim().toLowerCase();
      const user = await prisma.user.findFirst({
        where: { username: uname },
        include: { user_apps: { include: { app: { select: { id: true, nome: true, url: true, icone: true } } } } },
      });

      if (!user) return reply.code(401).send({ detail: 'Credenciais inválidas.' });
      if (!user.is_active) return reply.code(401).send({ detail: 'Usuário inativo.' });

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) return reply.code(401).send({ detail: 'Credenciais inválidas.' });

      const appIds = user.user_apps ? user.user_apps.map(ua => ua.app.id) : [];
      const accessPayload = { userId: user.id, role: user.role, first_name: user.first_name, last_name: user.last_name, appIds };
      const access = generateAccessToken(accessPayload);

      // create opaque refresh token and persist
      const refreshString = generateRefreshTokenString();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await prisma.refreshToken.create({ data: { token: refreshString, id_usuario: user.id, id_aplicacao: null, expires_at: expiresAt } });

      // set access cookie for convenience (short lived)
      reply.setCookie('sso_access_token', access, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: Math.floor(15 * 60), // 15 minutes in seconds
      });

      return reply.send({ access, refresh: refreshString, user: sanitizeUser(user) });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Erro ao autenticar usuário.' });
    }
  });

  // ── GET /api/auth/authorize ───────────────────────────────────
  fastify.get('/authorize', async (request, reply) => {
    const { client_id, redirect_uri, state } = request.query || {};

    if (!client_id || !redirect_uri) {
      return reply.code(400).send({ detail: 'client_id e redirect_uri são obrigatórios.' });
    }

    try {
      const app = await prisma.app.findFirst({ where: { client_id } });
      if (!app) return reply.code(400).send({ detail: 'Aplicação inválida.' });

    // check auth via cookie
    const token = request.cookies && request.cookies.sso_access_token;
    let userId = null;
    try {
      if (token) {
        const decoded = verifyAccessToken(token);
        userId = decoded.userId;
      }
    } catch (e) {
      userId = null;
    }

      const codeString = require('crypto').randomBytes(24).toString('hex');

      if (userId) {
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await prisma.authorizationCode.create({ data: { code: codeString, id_usuario: userId, id_aplicacao: app.id, redirect_uri, expires_at: expiresAt } });
        const sep = redirect_uri.includes('?') ? '&' : '?';
        const dest = `${redirect_uri}${sep}code=${codeString}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
        return reply.redirect(dest);
      }
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Erro no fluxo de autorização.' });
    }

    // Not authenticated: render login with redirect params so client can POST to /authorize/confirm
    return reply.view('login', { client_id, redirect_uri, state });
  });

  // ── POST /api/auth/authorize/confirm ───────────────────────────
  fastify.post('/authorize/confirm', async (request, reply) => {
    const { username, password, client_id, redirect_uri, state } = request.body || {};

    if (!username || !password || !client_id || !redirect_uri) {
      return reply.code(400).send({ detail: 'Parâmetros inválidos.' });
    }

    try {
      const uname = username.trim().toLowerCase();
      const user = await prisma.user.findFirst({ where: { username: uname } });
      if (!user) return reply.code(401).send({ detail: 'Credenciais inválidas.' });
      if (!user.is_active) return reply.code(401).send({ detail: 'Usuário inativo.' });
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) return reply.code(401).send({ detail: 'Credenciais inválidas.' });

      const app = await prisma.app.findFirst({ where: { client_id } });
      if (!app) return reply.code(400).send({ detail: 'Aplicação inválida.' });

      const codeString = require('crypto').randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await prisma.authorizationCode.create({ data: { code: codeString, id_usuario: user.id, id_aplicacao: app.id, redirect_uri, expires_at: expiresAt } });

      const sep = redirect_uri.includes('?') ? '&' : '?';
      const dest = `${redirect_uri}${sep}code=${codeString}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
      return reply.send({ redirect: dest });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Erro na confirmação de autorização.' });
    }
  });

  // ── POST /api/auth/token ───────────────────────────────────────
  fastify.post('/token', async (request, reply) => {
    const { grant_type } = request.body || {};
    if (grant_type !== 'authorization_code') return reply.code(400).send({ detail: 'grant_type inválido.' });

    const { code, redirect_uri, client_id, client_secret } = request.body || {};
    if (!code || !client_id || !client_secret || !redirect_uri) return reply.code(400).send({ detail: 'Parâmetros obrigatórios ausentes.' });

    try {
      const app = await prisma.app.findFirst({ where: { client_id } });
      if (!app || app.client_secret !== client_secret) return reply.code(401).send({ detail: 'Client inválido.' });

      const stored = await prisma.authorizationCode.findUnique({ where: { code } });
      if (!stored || stored.used) return reply.code(400).send({ detail: 'Code inválido ou já usado.' });
      if (stored.redirect_uri !== redirect_uri) return reply.code(400).send({ detail: 'redirect_uri mismatch.' });
      if (new Date(stored.expires_at) < new Date()) return reply.code(400).send({ detail: 'Code expirado.' });

      const user = await prisma.user.findUnique({ where: { id: stored.id_usuario }, include: { user_apps: { include: { app: { select: { id: true } } } } } });
      if (!user || !user.is_active) return reply.code(401).send({ detail: 'Usuário inválido.' });

      // mark code used
      await prisma.authorizationCode.update({ where: { id: stored.id }, data: { used: true } });

      const appIds = user.user_apps ? user.user_apps.map(ua => ua.app.id) : [];
      const accessPayload = { userId: user.id, role: user.role, first_name: user.first_name, last_name: user.last_name, appIds };
      const access = generateAccessToken(accessPayload);

      const refreshString = generateRefreshTokenString();
      const expiresAtRefresh = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.refreshToken.create({ data: { token: refreshString, id_usuario: user.id, id_aplicacao: app.id, expires_at: expiresAtRefresh } });

      return reply.send({ access, refresh: refreshString, expires_in: process.env.ACCESS_TOKEN_EXPIRY || 900 });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Erro ao trocar código por token.' });
    }
  });

  // ── POST /api/auth/token/refresh ─────────────────────────────
  fastify.post('/token/refresh/', async (request, reply) => {
    const { refresh } = request.body || {};

    if (!refresh) {
      return reply.code(400).send({ detail: 'Refresh token é obrigatório.' });
    }

    try {
      // find persisted refresh token
      const stored = await prisma.refreshToken.findUnique({ where: { token: refresh } });
      if (!stored || stored.revoked) {
        return reply.code(401).send({ detail: 'Refresh token inválido ou revogado.' });
      }

      if (stored.expires_at && new Date(stored.expires_at) < new Date()) {
        return reply.code(401).send({ detail: 'Refresh token expirado.' });
      }

      const user = await prisma.user.findUnique({ where: { id: stored.id_usuario }, include: { user_apps: { include: { app: { select: { id: true } } } } } });

      if (!user || !user.is_active) {
        return reply.code(401).send({ detail: 'Token inválido.' });
      }

      const appIds = user.user_apps ? user.user_apps.map(ua => ua.app.id) : [];
      const accessPayload = { userId: user.id, role: user.role, first_name: user.first_name, last_name: user.last_name, appIds };
      const access = generateAccessToken(accessPayload);

      // rotate refresh token: revoke old, create new
      await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
      const newRefresh = generateRefreshTokenString();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.refreshToken.create({ data: { token: newRefresh, id_usuario: user.id, id_aplicacao: stored.id_aplicacao, expires_at: expiresAt } });

      // update access cookie
      reply.setCookie('sso_access_token', access, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: Math.floor(15 * 60),
      });

      return reply.send({ access, refresh: newRefresh });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Erro ao renovar refresh token.' });
    }
  });

  // POST /api/auth/logout - revoke a refresh token (body.refresh) or current cookie
  fastify.post('/logout/', async (request, reply) => {
    const { refresh } = request.body || {};
    let tokenStr = refresh;

    if (!tokenStr && request.cookies && request.cookies.sso_refresh_token) {
      tokenStr = request.cookies.sso_refresh_token;
    }

    if (!tokenStr) {
      // try to clear cookie and respond
      reply.clearCookie('sso_access_token');
      reply.clearCookie('sso_refresh_token');
      return reply.send({ ok: true });
    }

    try {
      const stored = await prisma.refreshToken.findUnique({ where: { token: tokenStr } });
      if (stored) {
        await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
      }
    } catch (err) {
      request.log.error(err);
      // continue - we still want to clear cookies
    }

    reply.clearCookie('sso_access_token');
    reply.clearCookie('sso_refresh_token');
    return reply.send({ ok: true });
  });

  // POST /api/auth/logout-all - revoke all refresh tokens for the authenticated user
  fastify.post('/logout-all/', async (request, reply) => {
    // try to get user from access cookie
    let userId = null;
    try {
      const token = request.cookies && request.cookies.sso_access_token;
      if (token) {
        const decoded = verifyAccessToken(token);
        userId = decoded.userId;
      }
    } catch (e) {
      // ignore
    }

    if (!userId) {
      return reply.code(401).send({ detail: 'Requer autenticação para logout-all.' });
    }

    try {
      await prisma.refreshToken.updateMany({ where: { id_usuario: userId }, data: { revoked: true } });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Erro ao revogar tokens.' });
    }

    reply.clearCookie('sso_access_token');
    reply.clearCookie('sso_refresh_token');
    return reply.send({ ok: true });
  });
}

module.exports = authRoutes;
