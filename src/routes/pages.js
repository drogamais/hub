const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

async function pagesRoutes(fastify) {
  // Rotas públicas
  fastify.get('/login', async (request, reply) => reply.view('login.ejs'));

  // Rotas protegidas (Usa o novo authenticate)
  fastify.register(async function(protected) {
    protected.addHook('preHandler', authenticate);

    protected.get('/app/hub', async (request, reply) => {
      // Busca apps permitidos para este utilizador específico
      const userWithApps = await prisma.user.findUnique({
        where: { id: request.userId },
        include: { user_apps: { include: { app: true } } }
      });
      
      return reply.view('hub.ejs', { 
        user: request.user, 
        apps: userWithApps.user_apps.map(ua => ua.app) 
      });
    });

    protected.get('/app/users', async (request, reply) => {
      // Apenas admins podem entrar aqui
      if (request.user.role !== 'admin') return reply.redirect('/app/hub');
      
      const users = await prisma.user.findMany();
      return reply.view('users.ejs', { user: request.user, users });
    });
  });

  fastify.get('/', async (request, reply) => reply.redirect('/app/hub'));
}

module.exports = pagesRoutes;