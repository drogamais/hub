const prisma = require('../lib/prisma');

const sanitizeApp = (a) => a ? a : null;

const appsController = {
  async list(request, reply) {
    try {
      const apps = await prisma.app.findMany({ orderBy: { nome: 'asc' } });
      if (request.headers['hx-request']) {
        return reply.view('partials/app-table-rows', { apps });
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
      const app = await prisma.app.findUnique({ where: { id } });
      if (!app) return reply.code(404).send({ detail: 'Aplicação não encontrada.' });
      return reply.send(sanitizeApp(app));
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ detail: 'Erro ao buscar aplicação.' });
    }
  },

  async create(request, reply) {
    try {
      const { nome, descricao, url, ativo, icone } = request.body || {};
      if (!nome) return reply.code(400).send({ detail: 'Nome é obrigatório.' });

      const app = await prisma.app.create({
        data: { nome, descricao: descricao || null, url: url || null, icone: icone || null, ativo: typeof ativo === 'undefined' ? true : !!ativo }
      });
      return reply.code(201).send(app);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ detail: 'Erro ao criar aplicação.' });
    }
  },

  async update(request, reply) {
    try {
      const id = parseInt(request.params.id, 10);
      const { nome, descricao, url, ativo, icone } = request.body || {};
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
      return reply.send(updated);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ detail: 'Erro ao atualizar aplicação.' });
    }
  },

  async delete(request, reply) {
    try {
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
