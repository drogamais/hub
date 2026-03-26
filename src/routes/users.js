const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { User, App } = require('../models');
const { authenticate } = require('../middleware/auth');

const PAGE_SIZE = 20;

function sanitizeUser(user) {
  const { password, ...rest } = user.toJSON();
  return rest;
}

function buildOrderClause(ordering) {
  if (!ordering) return [['first_name', 'ASC']];

  const desc = ordering.startsWith('-');
  const field = desc ? ordering.slice(1) : ordering;

  const allowedFields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'setor', 'is_active'];
  if (!allowedFields.includes(field)) return [['first_name', 'ASC']];

  return [[field, desc ? 'DESC' : 'ASC']];
}

async function usersRoutes(fastify) {

  // Todas as rotas desse plugin exigem autenticação
  fastify.addHook('preHandler', authenticate);

  // GET /api/users/
  fastify.get('/', async (request, reply) => {
    const page = Math.max(1, parseInt(request.query.page || '1', 10));
    const search = request.query.search || '';
    const ordering = request.query.ordering || 'first_name';

    const where = {};
    if (search) {
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (page - 1) * PAGE_SIZE;
    const { count, rows } = await User.findAndCountAll({
      where,
      order: buildOrderClause(ordering),
      limit: PAGE_SIZE,
      offset,
      attributes: { exclude: ['password'] },
      include: [{ model: App, as: 'aplicacoes', attributes: ['id', 'nome'] }]
    });

    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

    return reply.send({
      count,
      next: page < totalPages ? `?page=${page + 1}` : null,
      previous: page > 1 ? `?page=${page - 1}` : null,
      results: rows,
    });
  });

  // GET /api/users/:id
  fastify.get('/:id/', async (request, reply) => {
    const user = await User.findByPk(request.params.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: App, as: 'aplicacoes', attributes: ['id', 'nome'] }]
    });

    if (!user) {
      return reply.code(404).send({ detail: 'Usuário não encontrado.' });
    }

    return reply.send(user);
  });

  // POST /api/users/
  fastify.post('/', async (request, reply) => {
    const { email, first_name, last_name, role, setor, password, is_active, aplicacoes } = request.body || {};

    if (!email || !password) {
      return reply.code(400).send({ detail: 'E-mail e senha são obrigatórios.' });
    }

    const emailLower = email.trim().toLowerCase();

    const existing = await User.findOne({ where: { email: emailLower } });
    if (existing) {
      return reply.code(400).send({ detail: 'Já existe um usuário com este e-mail.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: emailLower,
      email: emailLower,
      password: hashedPassword,
      first_name: first_name || '',
      last_name: last_name || '',
      role: role || 'general',
      setor: setor || null,
      is_active: is_active !== undefined ? is_active : true,
    });

    if (aplicacoes && Array.isArray(aplicacoes)) {
      await user.setAplicacoes(aplicacoes);
    }

    await user.reload({
      include: [{ model: App, as: 'aplicacoes', attributes: ['id', 'nome'] }]
    });

    return reply.code(201).send(sanitizeUser(user));
  });

  // PATCH /api/users/:id
  fastify.patch('/:id/', async (request, reply) => {
    const user = await User.findByPk(request.params.id);
    if (!user) {
      return reply.code(404).send({ detail: 'Usuário não encontrado.' });
    }

    const { email, first_name, last_name, role, setor, password, is_active, aplicacoes } = request.body || {};

    if (email !== undefined) {
      const emailLower = email.trim().toLowerCase();
      user.email = emailLower;
      user.username = emailLower;
    }
    if (first_name !== undefined) user.first_name = first_name;
    if (last_name !== undefined) user.last_name = last_name;
    if (role !== undefined) user.role = role;
    if (setor !== undefined) user.setor = setor;
    if (is_active !== undefined) user.is_active = is_active;

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    if (aplicacoes !== undefined && Array.isArray(aplicacoes)) {
      await user.setAplicacoes(aplicacoes);
    }

    await user.reload({
      include: [{ model: App, as: 'aplicacoes', attributes: ['id', 'nome'] }]
    });

    return reply.send(sanitizeUser(user));
  });

  // DELETE /api/users/:id
  fastify.delete('/:id/', async (request, reply) => {
    const user = await User.findByPk(request.params.id);
    if (!user) {
      return reply.code(404).send({ detail: 'Usuário não encontrado.' });
    }

    await user.destroy();
    return reply.code(204).send();
  });
}

module.exports = usersRoutes;
