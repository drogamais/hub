const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

async function appsRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/apps/
  fastify.get('/', async (request, reply) => {
    try {
      const apps = await prisma.app.findMany({
        orderBy: { nome: 'asc' },
      });
      return reply.send(apps);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar aplicações.' });
    }
  });
}

module.exports = appsRoutes;
