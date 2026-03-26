const authController = require('../controllers/authController');

async function authRoutes(fastify) {
  fastify.post('/login/', authController.login);
  fastify.post('/logout/', authController.logout);
  // Adicione aqui as outras rotas (authorize, token, etc) movidas para o controller
}

module.exports = authRoutes;