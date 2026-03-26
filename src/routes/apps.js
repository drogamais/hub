const appsController = require('../controllers/appsController');
const { authenticate } = require('../middleware/auth');

async function appsRoutes(fastify) {
  // Todas rotas aqui exigem autenticação
  fastify.addHook('preHandler', authenticate);

  // GET /api/apps/ (list)
  fastify.get('/', appsController.list);

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
