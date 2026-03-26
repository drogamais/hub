const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

async function pagesRoutes(fastify) {
  // Rotas públicas
  fastify.get('/login', async (request, reply) => reply.view('login.ejs'));

  // Rotas protegidas (Usa o novo authenticate)
  fastify.register(async function(protected) {
    protected.addHook('preHandler', authenticate);

    protected.get('/app/hub', async (request, reply) => {
      let appsParaMostrar = [];

      if (request.user.role === 'admin') {
        // Se for Admin, puxa TODOS os aplicativos ativos automaticamente
        appsParaMostrar = await prisma.app.findMany({ 
          where: { ativo: true },
          orderBy: { nome: 'asc' }
        });
      } else {
        // Se for usuário comum, puxa apenas os que ele tem permissão
        const userWithApps = await prisma.user.findUnique({
          where: { id: request.userId },
          include: { user_apps: { include: { app: true } } }
        });
        appsParaMostrar = userWithApps.user_apps.map(ua => ua.app);
      }

      return reply.view('hub.ejs', { 
        user: request.user, 
        apps: appsParaMostrar 
      });
    });

    protected.get('/app/users', async (request, reply) => {
      // Apenas admins podem entrar aqui
      if (request.user.role !== 'admin') return reply.redirect('/app/hub');
      
      const users = await prisma.user.findMany();
      return reply.view('users.ejs', { user: request.user, users });
    });

    // /app/apps — administração de aplicações (apenas admin)
    protected.get('/app/apps', async (request, reply) => {
      if (request.user.role !== 'admin') return reply.redirect('/app/hub');
      const apps = await prisma.app.findMany({ orderBy: { nome: 'asc' } });
      return reply.view('apps.ejs', { user: request.user, apps });
    });
  });

  fastify.get('/', async (request, reply) => reply.redirect('/app/hub'));
}

module.exports = pagesRoutes;