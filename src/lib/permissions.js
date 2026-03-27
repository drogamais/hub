const prisma = require('../lib/prisma');

const RANK = { none: 0, normal: 1, admin: 2 };

function maxPerm(a, b) {
  const ar = RANK[a] ?? 0;
  const br = RANK[b] ?? 0;
  return ar >= br ? a : b;
}

async function resolveAppPermissionsForUser(userId) {
  // Load user
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return {};

  const PROTECTED_EMAILS = (process.env.SUPER_ADMIN_EMAILS || 'ti@drogamais.com.br,inteligencia@drogamais.com.br')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

    // Load user to detect SuperAdmin by email
    const isSuperAdmin = PROTECTED_EMAILS.includes((user.email || '').toLowerCase());

  // Load all apps
  const apps = await prisma.app.findMany({ select: { id: true, nome: true } });
  const result = {};
  if (isSuperAdmin) {
    apps.forEach(a => { result[a.nome] = 'admin'; });
    return result;
  }

  // Load user-specific permissions (rel_usuario_aplicacao)
  const uapps = await prisma.userApp.findMany({ where: { id_usuario: userId } });
  const userMap = {};
  uapps.forEach(u => { userMap[u.id_aplicacao] = u.permissao || 'normal'; });

  apps.forEach(a => {
    const u = userMap[a.id];
    result[a.nome] = (typeof u !== 'undefined') ? u : 'none';
  });

  return result;
}

async function isSuperAdmin(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return false;
  const PROTECTED_EMAILS = (process.env.SUPER_ADMIN_EMAILS || 'ti@drogamais.com.br,inteligencia@drogamais.com.br')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return PROTECTED_EMAILS.includes((user.email || '').toLowerCase());
}

module.exports = { resolveAppPermissionsForUser, maxPerm, isSuperAdmin };
