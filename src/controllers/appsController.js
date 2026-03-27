const prisma = require('../lib/prisma');

const { isSuperAdmin } = require('../lib/permissions');
const sanitizeApp = (a) => a ? a : null;

const appsController = {
  async list(request, reply) {
    try {
      const apps = await prisma.app.findMany({ orderBy: { nome: 'asc' } });
      if (request.headers['hx-request']) {
        return reply.view('partials/app-table-rows', { apps, user: request.user });
      }
      return reply.send(apps);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ detail: 'Erro ao listar aplicações.' });
    }
  },

  async getById(request, reply) {
    try {
      const id = parseInt(request.params.id, 10);
      const app = await prisma.app.findUnique({
        where: { id },
        include: { user_apps: true }
      });
      if (!app) return reply.code(404).send({ detail: 'Aplicação não encontrada.' });
      const usuarios = (app.user_apps || []).map(u => ({ id_usuario: u.id_usuario, permissao: u.permissao }));
      const payload = { ...sanitizeApp(app), usuarios };
      return reply.send(payload);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ detail: 'Erro ao buscar aplicação.' });
    }
  },

  async status(request, reply) {
    try {
      const id = parseInt(request.params.id, 10);
      const app = await prisma.app.findUnique({ where: { id } });
      if (!app) return reply.code(404).send({ detail: 'Aplicação não encontrada.' });

      // Try to fetch the app URL with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      let online = false;
      try {
        const res = await fetch(app.url, { method: 'GET', signal: controller.signal });
        online = res && res.ok;
      } catch (e) {
        online = false;
      } finally {
        clearTimeout(timeout);
      }

      return reply.send({ online });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ detail: 'Erro ao verificar status da aplicação.' });
    }
  },

  async create(request, reply) {
    try {
      if (!request.userId || !(await isSuperAdmin(request.userId))) return reply.code(403).send({ detail: 'Ação não autorizada.' });
      const { nome, descricao, url, ativo, icone, usuarios } = request.body || {};
      if (!nome) return reply.code(400).send({ detail: 'Nome é obrigatório.' });

      const app = await prisma.app.create({
        data: { nome, descricao: descricao || null, url: url || null, icone: icone || null, ativo: typeof ativo === 'undefined' ? true : !!ativo }
      });

      // Persist user exceptions
      if (Array.isArray(usuarios)) {
        for (const u of usuarios) {
          const uid = parseInt(u.id_usuario, 10);
          const p = u.permissao;
          if (!uid) continue;
          if (!p || p === 'inherit') {
            await prisma.userApp.deleteMany({ where: { id_usuario: uid, id_aplicacao: app.id } });
          } else {
            await prisma.userApp.upsert({
              where: { id_usuario_id_aplicacao: { id_usuario: uid, id_aplicacao: app.id } },
              create: { id_usuario: uid, id_aplicacao: app.id, permissao: p },
              update: { permissao: p }
            });
          }
        }
      }

      return reply.code(201).send(app);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ detail: 'Erro ao criar aplicação.' });
    }
  },

  async update(request, reply) {
    try {
      if (!request.userId || !(await isSuperAdmin(request.userId))) return reply.code(403).send({ detail: 'Ação não autorizada.' });
      const id = parseInt(request.params.id, 10);
      const { nome, descricao, url, ativo, icone, grupos, usuarios } = request.body || {};
      const existing = await prisma.app.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ detail: 'Aplicação não encontrada.' });

      const updated = await prisma.app.update({
        where: { id },
        data: {
          nome: nome ?? existing.nome,
          descricao: typeof descricao === 'undefined' ? existing.descricao : descricao,
          url: url ?? existing.url,
          icone: typeof icone === 'undefined' ? existing.icone : icone,
          ativo: typeof ativo === 'undefined' ? existing.ativo : !!ativo,
        }
      });

      // Update user exceptions
      if (Array.isArray(usuarios)) {
        for (const u of usuarios) {
          const uid = parseInt(u.id_usuario, 10);
          const p = u.permissao;
          if (!uid) continue;
          if (!p || p === 'inherit') {
            await prisma.userApp.deleteMany({ where: { id_usuario: uid, id_aplicacao: id } });
          } else {
            await prisma.userApp.upsert({
              where: { id_usuario_id_aplicacao: { id_usuario: uid, id_aplicacao: id } },
              create: { id_usuario: uid, id_aplicacao: id, permissao: p },
              update: { permissao: p }
            });
          }
        }
      }
      return reply.send(updated);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ detail: 'Erro ao atualizar aplicação.' });
    }
  },

  async delete(request, reply) {
    try {
    if (!request.userId || !(await isSuperAdmin(request.userId))) return reply.code(403).send({ detail: 'Ação não autorizada.' });
      const id = parseInt(request.params.id, 10);
      const existing = await prisma.app.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ detail: 'Aplicação não encontrada.' });

      // Remove dependent records first to avoid foreign key constraint errors
      await prisma.$transaction([
        prisma.userApp.deleteMany({ where: { id_aplicacao: id } }),
        prisma.authorizationCode.deleteMany({ where: { id_aplicacao: id } }),
        prisma.refreshToken.deleteMany({ where: { id_aplicacao: id } }),
        prisma.app.delete({ where: { id } })
      ]);

      if (request.headers['hx-request']) return '';
      return reply.code(204).send();
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ detail: 'Erro ao remover aplicação.' });
    }
  }
};

module.exports = appsController;
