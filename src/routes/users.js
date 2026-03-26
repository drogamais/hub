const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const PAGE_SIZE = 20;

function sanitizeUser(user) {
  if (!user) return null;
  const u = { ...user };
  delete u.password;
  // map user_apps -> aplicacoes
  if (u.user_apps && Array.isArray(u.user_apps)) {
    u.aplicacoes = u.user_apps.map(ua => ua.app).filter(Boolean).map(a => ({ id: a.id, nome: a.nome }));
    delete u.user_apps;
  }
  return u;
}

function buildOrderClause(ordering) {
  const allowedFields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'setor', 'is_active'];
  if (!ordering) return [{ first_name: 'asc' }];
  const desc = ordering.startsWith('-');
  const field = desc ? ordering.slice(1) : ordering;
  if (!allowedFields.includes(field)) return [{ first_name: 'asc' }];
  return [{ [field]: desc ? 'desc' : 'asc' }];
}

async function usersRoutes(fastify) {

  // Todas as rotas desse plugin exigem autenticação
  fastify.addHook('preHandler', authenticate);

  // GET /api/users/
  fastify.get('/', async (request, reply) => {
    try {
      const page = Math.max(1, parseInt(request.query.page || '1', 10));
      const search = request.query.search || '';
      const ordering = request.query.ordering || 'first_name';

      const where = {};
      if (search) {
        where.OR = [
          { first_name: { contains: search } },
          { last_name: { contains: search } },
          { email: { contains: search } },
          { username: { contains: search } },
        ];
      }

      const offset = (page - 1) * PAGE_SIZE;

      const [count, rows] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy: buildOrderClause(ordering),
          skip: offset,
          take: PAGE_SIZE,
          include: { user_apps: { include: { app: { select: { id: true, nome: true } } } } },
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

      const results = rows.map(sanitizeUser);

      return reply.send({
        count,
        next: page < totalPages ? `?page=${page + 1}` : null,
        previous: page > 1 ? `?page=${page - 1}` : null,
        results,
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Erro ao listar usuários.' });
    }
  });

  // GET /api/users/:id
  fastify.get('/:id/', async (request, reply) => {
    try {
      const id = parseInt(request.params.id, 10);
      const user = await prisma.user.findUnique({
        where: { id },
        include: { user_apps: { include: { app: { select: { id: true, nome: true } } } } },
      });

      if (!user) return reply.code(404).send({ detail: 'Usuário não encontrado.' });

      return reply.send(sanitizeUser(user));
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar usuário.' });
    }
  });

  // POST /api/users/
  fastify.post('/', async (request, reply) => {
    try {
      const { email, first_name, last_name, role, setor, password, is_active, aplicacoes } = request.body || {};

      if (!email || !password) {
        return reply.code(400).send({ detail: 'E-mail e senha são obrigatórios.' });
      }

      const emailLower = email.trim().toLowerCase();

      const existing = await prisma.user.findFirst({ where: { email: emailLower } });
      if (existing) {
        return reply.code(400).send({ detail: 'Já existe um usuário com este e-mail.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          username: emailLower,
          email: emailLower,
          password: hashedPassword,
          first_name: first_name || '',
          last_name: last_name || '',
          role: role || 'general',
          setor: setor || null,
          is_active: is_active !== undefined ? is_active : true,
        },
      });

      if (aplicacoes && Array.isArray(aplicacoes) && aplicacoes.length) {
        const relations = aplicacoes.map(aid => ({ id_usuario: user.id, id_aplicacao: parseInt(aid, 10) }));
        await prisma.userApp.createMany({ data: relations, skipDuplicates: true });
      }

      const fresh = await prisma.user.findUnique({
        where: { id: user.id },
        include: { user_apps: { include: { app: { select: { id: true, nome: true } } } } },
      });

      return reply.code(201).send(sanitizeUser(fresh));
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Erro ao criar usuário.' });
    }
  });

  // PATCH /api/users/:id
  fastify.patch('/:id/', async (request, reply) => {
    try {
      const id = parseInt(request.params.id, 10);
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ detail: 'Usuário não encontrado.' });

      const { email, first_name, last_name, role, setor, password, is_active, aplicacoes } = request.body || {};

      const data = {};
      if (email !== undefined) {
        const emailLower = String(email).trim().toLowerCase();
        data.email = emailLower;
        data.username = emailLower;
      }
      if (first_name !== undefined) data.first_name = first_name;
      if (last_name !== undefined) data.last_name = last_name;
      if (role !== undefined) data.role = role;
      if (setor !== undefined) data.setor = setor;
      if (is_active !== undefined) data.is_active = is_active;
      if (password) data.password = await bcrypt.hash(password, 10);

      await prisma.user.update({ where: { id }, data });

      if (aplicacoes !== undefined && Array.isArray(aplicacoes)) {
        // replace relations
        await prisma.userApp.deleteMany({ where: { id_usuario: id } });
        if (aplicacoes.length) {
          const relations = aplicacoes.map(aid => ({ id_usuario: id, id_aplicacao: parseInt(aid, 10) }));
          await prisma.userApp.createMany({ data: relations, skipDuplicates: true });
        }
      }

      const fresh = await prisma.user.findUnique({
        where: { id },
        include: { user_apps: { include: { app: { select: { id: true, nome: true } } } } },
      });

      return reply.send(sanitizeUser(fresh));
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Erro ao atualizar usuário.' });
    }
  });

  // DELETE /api/users/:id
  fastify.delete('/:id/', async (request, reply) => {
    try {
      const id = parseInt(request.params.id, 10);
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ detail: 'Usuário não encontrado.' });

      await prisma.user.delete({ where: { id } });
      return reply.code(204).send();
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Erro ao deletar usuário.' });
    }
  });
}

module.exports = usersRoutes;
