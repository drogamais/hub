const prisma = require('../lib/prisma');

const RANK = { none: 0, normal: 1, admin: 2 };

function maxPerm(a, b) {
  const ar = RANK[a] ?? 0;
  const br = RANK[b] ?? 0;
  return ar >= br ? a : b;
}

async function resolveAppPermissionsForUser(userId) {
  // Load user with group
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return {};

  // Super Admin rule: role admin and setor in TI or INTELIGÊNCIA DE MERCADO
  const setor = (user.setor || '').toString().toUpperCase();
  const isSuperAdmin = user.role === 'admin' && (setor === 'TI' || setor === 'INTELIGÊNCIA DE MERCADO');

  // Load all apps
  const apps = await prisma.app.findMany({ select: { id: true, nome: true } });
  const result = {};
  if (isSuperAdmin) {
    apps.forEach(a => { result[a.nome] = 'admin'; });
    return result;
  }

  // Load group mappings for this user's group
  const groupId = user.groupId || null;
  const groupMap = {};
  if (groupId) {
    const gaps = await prisma.groupApp.findMany({ where: { id_grupo: groupId } });
    gaps.forEach(g => { groupMap[g.id_aplicacao] = g.permissao || 'normal'; });
  }

  // Load user exceptions
  const uapps = await prisma.userApp.findMany({ where: { id_usuario: userId } });
  const userMap = {};
  uapps.forEach(u => { userMap[u.id_aplicacao] = u.permissao || 'normal'; });

  apps.forEach(a => {
    const g = groupMap[a.id] || 'none';
    const u = userMap[a.id];
    let final;
    if (typeof u !== 'undefined') final = maxPerm(g, u);
    else final = g;
    // Normalize 'none' to 'none', keep values
    result[a.nome] = final || 'none';
  });

  return result;
}

module.exports = { resolveAppPermissionsForUser, maxPerm };
