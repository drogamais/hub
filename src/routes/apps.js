const appsController = require('../controllers/appsController');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

async function appsRoutes(fastify) {
  // Todas rotas aqui exigem autenticação
  fastify.addHook('preHandler', authenticate);

  // GET /api/apps/ (list)
  fastify.get('/', appsController.list);

  // GET /api/apps/users-active - lista de utilizadores ativos para selects (exclui super-admins in UI)
  fastify.get('/users-active', async (request, reply) => {
    const users = await prisma.user.findMany({ where: { is_active: true }, select: { id: true, first_name: true, last_name: true, email: true, setor: true } });
    return reply.send(users);
  });

  // GET /api/apps/:id/
  fastify.get('/:id/', appsController.getById);

  // GET /api/apps/:id/status - check remote app online status
  fastify.get('/:id/status', appsController.status);

  // POST /api/apps/
  fastify.post('/', appsController.create);

  // PATCH /api/apps/:id/
  fastify.patch('/:id/', appsController.update);

  // DELETE /api/apps/:id/
  fastify.delete('/:id/', appsController.delete);
}

module.exports = appsRoutes;
