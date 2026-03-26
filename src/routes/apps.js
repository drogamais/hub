const appsController = require('../controllers/appsController');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

async function appsRoutes(fastify) {
  // Todas rotas aqui exigem autenticação
  fastify.addHook('preHandler', authenticate);

  // GET /api/apps/ (list)
  fastify.get('/', appsController.list);

  // GET /api/apps/groups - lista de grupos para popular selects
  fastify.get('/groups', async (request, reply) => {
    const groups = await prisma.group.findMany({ orderBy: { nome: 'asc' } });
    return reply.send(groups);
  });

  // GET /api/apps/users-active - lista de utilizadores ativos para selects (exclui super-admins in UI)
  fastify.get('/users-active', async (request, reply) => {
    const users = await prisma.user.findMany({ where: { is_active: true }, select: { id: true, first_name: true, last_name: true, email: true, role: true, setor: true } });
    return reply.send(users);
  });

  // GET /api/apps/:id/
  fastify.get('/:id/', appsController.getById);

  // POST /api/apps/
  fastify.post('/', appsController.create);

  // PATCH /api/apps/:id/
  fastify.patch('/:id/', appsController.update);

  // DELETE /api/apps/:id/
  fastify.delete('/:id/', appsController.delete);
}

module.exports = appsRoutes;
