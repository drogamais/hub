const { App } = require('../models');
const { authenticate } = require('../middleware/auth');

async function appsRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/apps/
  fastify.get('/', async (request, reply) => {
    const apps = await App.findAll({
      order: [['nome', 'ASC']],
    });
    return reply.send(apps);
  });
}

module.exports = appsRoutes;
