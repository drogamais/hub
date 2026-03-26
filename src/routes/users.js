const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

async function usersRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', userController.list);
  fastify.post('/', userController.create);
  fastify.delete('/:id/', userController.delete);
}

module.exports = usersRoutes;