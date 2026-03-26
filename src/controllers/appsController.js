const prisma = require('../lib/prisma');

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
        include: { user_apps: true, group_apps: true }
      });
      if (!app) return reply.code(404).send({ detail: 'Aplicação não encontrada.' });

      const grupos = (app.group_apps || []).map(g => ({ id_grupo: g.id_grupo, permissao: g.permissao }));
      const usuarios = (app.user_apps || []).map(u => ({ id_usuario: u.id_usuario, permissao: u.permissao }));
      const payload = { ...sanitizeApp(app), grupos, usuarios };
      return reply.send(payload);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ detail: 'Erro ao buscar aplicação.' });
    }
  },

  async create(request, reply) {
    try {
      if (!request.user || request.user.role !== 'admin') return reply.code(403).send({ detail: 'Ação não autorizada.' });
      const { nome, descricao, url, ativo, icone, grupos, usuarios } = request.body || {};
      if (!nome) return reply.code(400).send({ detail: 'Nome é obrigatório.' });

      const app = await prisma.app.create({
        data: { nome, descricao: descricao || null, url: url || null, icone: icone || null, ativo: typeof ativo === 'undefined' ? true : !!ativo }
      });

      // Persist group mappings
      if (Array.isArray(grupos)) {
        const toCreate = grupos.filter(g => g.permissao && g.permissao !== 'none').map(g => ({ id_grupo: g.id_grupo, id_aplicacao: app.id, permissao: g.permissao }));
        if (toCreate.length > 0) await prisma.groupApp.createMany({ data: toCreate });
      }

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
      if (!request.user || request.user.role !== 'admin') return reply.code(403).send({ detail: 'Ação não autorizada.' });
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

      // Update group mappings
      if (Array.isArray(grupos)) {
        await prisma.groupApp.deleteMany({ where: { id_aplicacao: id } });
        const toCreate = grupos.filter(g => g.permissao && g.permissao !== 'none').map(g => ({ id_grupo: g.id_grupo, id_aplicacao: id, permissao: g.permissao }));
        if (toCreate.length > 0) await prisma.groupApp.createMany({ data: toCreate });
      }

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
      if (!request.user || request.user.role !== 'admin') return reply.code(403).send({ detail: 'Ação não autorizada.' });
      const id = parseInt(request.params.id, 10);
      const existing = await prisma.app.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ detail: 'Aplicação não encontrada.' });

      await prisma.app.delete({ where: { id } });
      if (request.headers['hx-request']) return '';
      return reply.code(204).send();
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ detail: 'Erro ao remover aplicação.' });
    }
  }
};

module.exports = appsController;
