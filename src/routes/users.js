const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

async function usersRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', userController.list);
  fastify.get('/:id/', userController.getById); // Faltava esta
  fastify.post('/', userController.create);
  fastify.patch('/:id/', userController.update); // Faltava esta
  fastify.delete('/:id/', userController.delete);
}

module.exports = usersRoutes;