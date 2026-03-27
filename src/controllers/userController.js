const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { isSuperAdmin } = require('../lib/permissions');

const PAGE_SIZE = 20;
const PROTECTED_EMAILS = ['inteligencia@drogamais.com.br']; // Protege a seed

const sanitizeUser = (user) => {
  if (!user) return null;
  const u = { ...user };
  delete u.password;
  if (u.user_apps && Array.isArray(u.user_apps)) {
    u.aplicacoes = u.user_apps.map(ua => ua.app).filter(Boolean);
    delete u.user_apps;
  }
  return u;
};

const userController = {
  // Lista todos (para a tabela HTMX)
  async list(request, reply) {
    const page = Math.max(1, parseInt(request.query.page || '1', 10));
    const search = request.query.search || '';
    const offset = (page - 1) * PAGE_SIZE;

    const where = search ? {
      OR: [
        { first_name: { contains: search } },
        { email: { contains: search } },
        { username: { contains: search } },
      ]
    } : {};

    const [count, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where, skip: offset, take: PAGE_SIZE,
        include: { user_apps: { include: { app: true } } },
      }),
    ]);

    const results = rows.map(sanitizeUser);
    if (request.headers['hx-request']) {
      return reply.view('partials/user-table-rows', { users: results });
    }
    return { count, results, totalPages: Math.ceil(count / PAGE_SIZE) };
  },

  // Retorna os dados para preencher o Modal de Edição
  async getById(request, reply) {
    const id = parseInt(request.params.id, 10);
    const user = await prisma.user.findUnique({
      where: { id },
      include: { user_apps: { include: { app: true } } }
    });
    if (!user) return reply.code(404).send({ detail: 'Usuário não encontrado.' });
    return reply.send(sanitizeUser(user));
  },

  // Cria um usuário novo e salva os cards (aplicacoes)
  async create(request, reply) {
    // Only Super Admins can create users
    if (!request.userId || !(await isSuperAdmin(request.userId))) {
      return reply.code(403).send({ detail: 'Apenas Super Administradores podem criar usuários.' });
    }
    const { email, password, first_name, last_name, setor, is_active, aplicacoes } = request.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(), username: email.toLowerCase(),
        password: hashedPassword, first_name, last_name, setor,
        is_active: is_active ?? true,
        // Salva as marcações de aplicativos
        user_apps: {
          create: (aplicacoes || []).map(appId => ({ id_aplicacao: appId }))
        }
      },
      include: { user_apps: { include: { app: true } } }
    });
    return reply.code(201).send(sanitizeUser(user));
  },

  // Edita o usuário e seus cards
  async update(request, reply) {
    const id = parseInt(request.params.id, 10);
    const { email, password, first_name, last_name, setor, is_active, aplicacoes } = request.body;
    
    // Only Super Admins can update users
    if (!request.userId || !(await isSuperAdmin(request.userId))) {
      return reply.code(403).send({ detail: 'Apenas Super Administradores podem editar usuários.' });
    }
    const currentUser = await prisma.user.findUnique({ where: { id } });
    if (!currentUser) return reply.code(404).send({ detail: 'Usuário não encontrado.' });

    // Impede edição dos Super Admins
    if (PROTECTED_EMAILS.includes(currentUser.email)) {
      return reply.code(403).send({ detail: 'Os Super Administradores da matriz não podem ser alterados.' });
    }

    const updateData = { first_name, last_name, setor, is_active };
    if (email) { updateData.email = email.toLowerCase(); updateData.username = email.toLowerCase(); }
    if (password) { updateData.password = await bcrypt.hash(password, 10); }

    await prisma.user.update({ where: { id }, data: updateData });

    // Atualiza os apps (Deleta os antigos e insere os novos marcados)
    if (aplicacoes && Array.isArray(aplicacoes)) {
      await prisma.userApp.deleteMany({ where: { id_usuario: id } });
      if (aplicacoes.length > 0) {
        await prisma.userApp.createMany({
          data: aplicacoes.map(appId => ({ id_usuario: id, id_aplicacao: appId }))
        });
      }
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id }, include: { user_apps: { include: { app: true } } }
    });
    return reply.send(sanitizeUser(updatedUser));
  },

  // Deleta o usuário (Protegendo a Seed)
  async delete(request, reply) {
    const id = parseInt(request.params.id, 10);
    const user = await prisma.user.findUnique({ where: { id } });

    if (user && PROTECTED_EMAILS.includes(user.email)) {
      return reply.code(403).send({ detail: 'Os Super Administradores da matriz não podem ser apagados.' });
    }

    // Only Super Admins can delete users
    if (!request.userId || !(await isSuperAdmin(request.userId))) {
      return reply.code(403).send({ detail: 'Apenas Super Administradores podem apagar usuários.' });
    }

    await prisma.user.delete({ where: { id } });
    if (request.headers['hx-request']) return ''; 
    return reply.code(204).send();
  }
};

module.exports = userController;