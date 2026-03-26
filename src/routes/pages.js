// ─── Rotas SSR de páginas HTML (EJS) ─────────────────────────────
async function pagesRoutes(fastify) {

  // GET /login  → tela de login
  fastify.get('/login', async (request, reply) => {
    return reply.view('login.ejs');
  });

  // GET /app/hub → tela do Hub (apps do usuário)
  fastify.get('/app/hub', async (request, reply) => {
    return reply.view('hub.ejs');
  });

  // GET /app/users → gerenciamento de usuários (admin)
  fastify.get('/app/users', async (request, reply) => {
    return reply.view('users.ejs');
  });

  // GET / → redireciona para /app/hub
  fastify.get('/', async (request, reply) => {
    return reply.redirect('/app/hub');
  });

  // POST /api/auth/logout → limpa o cookie HttpOnly
  fastify.post('/api/auth/logout', async (request, reply) => {
    reply.clearCookie('sso_access_token', { path: '/' });
    return reply.send({ ok: true });
  });
}

module.exports = pagesRoutes;
