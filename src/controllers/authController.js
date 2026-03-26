const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { generateAccessToken, generateRefreshTokenString } = require('../lib/token');

// Função auxiliar para limpar dados do utilizador
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

    const appIds = user.user_apps ? user.user_apps.map(ua => ua.app.id) : [];

    const access = generateAccessToken({ 
    userId: user.id, 
    role: user.role, 
    first_name: user.first_name, 
    last_name: user.last_name, 
    setor: user.setor, // <-- Esta linha é a que resolve o sumiço da sidebar
    appIds 
    });

    // Cookie para o Hub (SSR)
    reply.setCookie('sso_access_token', access, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 15 * 60 // 15 min
    });

    return reply.send({ access, user: sanitizeUser(user) });
  },

  async logout(request, reply) {
    reply.clearCookie('sso_access_token', { path: '/' });
    return reply.send({ ok: true });
  }
};

module.exports = authController;