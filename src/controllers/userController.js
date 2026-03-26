const bcrypt = require('bcryptjs'); // Usando a versão que limpou os logs
const prisma = require('../lib/prisma');

const PAGE_SIZE = 20;

// Função auxiliar para limpar dados sensíveis
const sanitizeUser = (user) => {
  if (!user) return null;
  const u = { ...user };
  delete u.password;
  if (u.user_apps && Array.isArray(u.user_apps)) {
    u.aplicacoes = u.user_apps.map(ua => ua.app).filter(Boolean).map(a => ({ id: a.id, nome: a.nome }));
    delete u.user_apps;
  }
  return u;
};

const userController = {
  // Lista utilizadores (Suporta API e HTMX)
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
        where,
        skip: offset,
        take: PAGE_SIZE,
        include: { user_apps: { include: { app: { select: { id: true, nome: true } } } } },
      }),
    ]);

    const results = rows.map(sanitizeUser);

    // LÓGICA HTMX: Se for uma busca via HTMX, renderiza apenas a tabela
    if (request.headers['hx-request']) {
      return reply.view('partials/user-table-rows', { users: results });
    }

    return { count, results, totalPages: Math.ceil(count / PAGE_SIZE) };
  },

  async create(request, reply) {
    const { email, password, first_name, last_name, role, setor } = request.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: email.toLowerCase(),
        password: hashedPassword,
        first_name, last_name, role, setor
      }
    });
    return reply.code(201).send(sanitizeUser(user));
  },

  async delete(request, reply) {
    const id = parseInt(request.params.id, 10);
    const user = await prisma.user.findUnique({ where: { id } });

    if (user?.email === 'admin@drogamais.com.br') {
      return reply.code(403).send({ detail: 'Não pode apagar o admin principal.' });
    }

    await prisma.user.delete({ where: { id } });
    
    // HTMX: Se apagarmos via HTMX, retornamos vazio para remover a linha da tabela
    if (request.headers['hx-request']) return ''; 
    
    return reply.code(204).send();
  }
};

module.exports = userController;