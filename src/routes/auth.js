const bcrypt = require('bcrypt');
const { User, App, RefreshToken } = require('../models');
const { generateAccessToken, generateRefreshTokenString, verifyAccessToken } = require('../lib/token');

function sanitizeUser(user) {
  const { password, ...rest } = user.toJSON();
  return rest;
}

// ─── Fastify route plugin ────────────────────────────────────────
async function authRoutes(fastify) {

  // ── POST /api/auth/login ─────────────────────────────────────
  fastify.post('/login/', async (request, reply) => {
    const { username, password } = request.body || {};

    if (!username || !password) {
      return reply.code(400).send({ detail: 'Usuário e senha são obrigatórios.' });
    }

    const user = await User.findOne({
      where: { username: username.trim().toLowerCase() },
      include: [{
        model: App,
        as: 'aplicacoes',
        attributes: ['id', 'nome', 'url', 'icone']
      }]
    });

    if (!user) {
      return reply.code(401).send({ detail: 'Credenciais inválidas.' });
    }

    if (!user.is_active) {
      return reply.code(401).send({ detail: 'Usuário inativo.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return reply.code(401).send({ detail: 'Credenciais inválidas.' });
    }

    const appIds = user.aplicacoes ? user.aplicacoes.map(a => a.id) : [];

    const accessPayload = { userId: user.id, role: user.role, first_name: user.first_name, last_name: user.last_name, appIds };
    const access = generateAccessToken(accessPayload);

    // create opaque refresh token and persist
    const refreshString = generateRefreshTokenString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await RefreshToken.create({ token: refreshString, id_usuario: user.id, id_aplicacao: null, expires_at: expiresAt });

    // set access cookie for convenience (short lived)
    reply.setCookie('sso_access_token', access, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: Math.floor(15 * 60), // 15 minutes in seconds
    });

    return reply.send({ access, refresh: refreshString, user: sanitizeUser(user) });
  });

  // ── GET /api/auth/authorize ───────────────────────────────────
  fastify.get('/authorize', async (request, reply) => {
    const { client_id, redirect_uri, state } = request.query || {};

    if (!client_id || !redirect_uri) {
      return reply.code(400).send({ detail: 'client_id e redirect_uri são obrigatórios.' });
    }

    const app = await App.findOne({ where: { client_id } });
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
    const AuthorizationCode = require('../models').AuthorizationCode;

    if (userId) {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      await AuthorizationCode.create({ code: codeString, id_usuario: userId, id_aplicacao: app.id, redirect_uri, expires_at: expiresAt });
      const sep = redirect_uri.includes('?') ? '&' : '?';
      const dest = `${redirect_uri}${sep}code=${codeString}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
      return reply.redirect(dest);
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

    const user = await User.findOne({ where: { username: username.trim().toLowerCase() } });
    if (!user) return reply.code(401).send({ detail: 'Credenciais inválidas.' });
    if (!user.is_active) return reply.code(401).send({ detail: 'Usuário inativo.' });
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return reply.code(401).send({ detail: 'Credenciais inválidas.' });

    const app = await App.findOne({ where: { client_id } });
    if (!app) return reply.code(400).send({ detail: 'Aplicação inválida.' });

    const AuthorizationCode = require('../models').AuthorizationCode;
    const codeString = require('crypto').randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await AuthorizationCode.create({ code: codeString, id_usuario: user.id, id_aplicacao: app.id, redirect_uri, expires_at: expiresAt });

    const sep = redirect_uri.includes('?') ? '&' : '?';
    const dest = `${redirect_uri}${sep}code=${codeString}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
    return reply.send({ redirect: dest });
  });

  // ── POST /api/auth/token ───────────────────────────────────────
  fastify.post('/token', async (request, reply) => {
    const { grant_type } = request.body || {};
    if (grant_type !== 'authorization_code') return reply.code(400).send({ detail: 'grant_type inválido.' });

    const { code, redirect_uri, client_id, client_secret } = request.body || {};
    if (!code || !client_id || !client_secret || !redirect_uri) return reply.code(400).send({ detail: 'Parâmetros obrigatórios ausentes.' });

    const app = await App.findOne({ where: { client_id } });
    if (!app || app.client_secret !== client_secret) return reply.code(401).send({ detail: 'Client inválido.' });

    const { AuthorizationCode } = require('../models');
    const stored = await AuthorizationCode.findOne({ where: { code } });
    if (!stored || stored.used) return reply.code(400).send({ detail: 'Code inválido ou já usado.' });
    if (stored.redirect_uri !== redirect_uri) return reply.code(400).send({ detail: 'redirect_uri mismatch.' });
    if (new Date(stored.expires_at) < new Date()) return reply.code(400).send({ detail: 'Code expirado.' });

    const user = await User.findByPk(stored.id_usuario, { include: [{ model: App, as: 'aplicacoes', attributes: ['id'] }] });
    if (!user || !user.is_active) return reply.code(401).send({ detail: 'Usuário inválido.' });

    // mark code used
    await stored.update({ used: true });

    const appIds = user.aplicacoes ? user.aplicacoes.map(a => a.id) : [];
    const accessPayload = { userId: user.id, role: user.role, first_name: user.first_name, last_name: user.last_name, appIds };
    const access = generateAccessToken(accessPayload);

    const refreshString = generateRefreshTokenString();
    const expiresAtRefresh = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await RefreshToken.create({ token: refreshString, id_usuario: user.id, id_aplicacao: app.id, expires_at: expiresAtRefresh });

    return reply.send({ access, refresh: refreshString, expires_in: process.env.ACCESS_TOKEN_EXPIRY || 900 });
  });

  // ── POST /api/auth/token/refresh ─────────────────────────────
  fastify.post('/token/refresh/', async (request, reply) => {
    const { refresh } = request.body || {};

    if (!refresh) {
      return reply.code(400).send({ detail: 'Refresh token é obrigatório.' });
    }

    // find persisted refresh token
    const stored = await RefreshToken.findOne({ where: { token: refresh } });
    if (!stored || stored.revoked) {
      return reply.code(401).send({ detail: 'Refresh token inválido ou revogado.' });
    }

    if (stored.expires_at && new Date(stored.expires_at) < new Date()) {
      return reply.code(401).send({ detail: 'Refresh token expirado.' });
    }

    const user = await User.findByPk(stored.id_usuario, {
      include: [{ model: App, as: 'aplicacoes', attributes: ['id'] }]
    });

    if (!user || !user.is_active) {
      return reply.code(401).send({ detail: 'Token inválido.' });
    }

    const appIds = user.aplicacoes ? user.aplicacoes.map(a => a.id) : [];
    const accessPayload = { userId: user.id, role: user.role, first_name: user.first_name, last_name: user.last_name, appIds };
    const access = generateAccessToken(accessPayload);

    // rotate refresh token: revoke old, create new
    await stored.update({ revoked: true });
    const newRefresh = generateRefreshTokenString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await RefreshToken.create({ token: newRefresh, id_usuario: user.id, id_aplicacao: stored.id_aplicacao, expires_at: expiresAt });

    // update access cookie
    reply.setCookie('sso_access_token', access, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: Math.floor(15 * 60),
    });

    return reply.send({ access, refresh: newRefresh });
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

    const stored = await RefreshToken.findOne({ where: { token: tokenStr } });
    if (stored) {
      await stored.update({ revoked: true });
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

    await RefreshToken.update({ revoked: true }, { where: { id_usuario: userId } });

    reply.clearCookie('sso_access_token');
    reply.clearCookie('sso_refresh_token');
    return reply.send({ ok: true });
  });
}

module.exports = authRoutes;
