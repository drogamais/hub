require('dotenv').config();

const path = require('path');
const fastify = require('fastify')({ logger: true });
const prisma = require('./lib/prisma');

// --- Environment checks (fail fast when secrets missing) ---
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.error('❌ Required JWT secrets not found in environment (JWT_SECRET, JWT_REFRESH_SECRET).');
  process.exit(1);
}

// Allowed origins for CORS (comma-separated) — add your apps in .env as ALLOWED_ORIGINS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean);

// ─── Plugins ─────────────────────────────────────────────────────
fastify.register(require('@fastify/formbody'));
fastify.register(require('@fastify/cookie'));
fastify.register(require('@fastify/view'), {
  engine: { ejs: require('ejs') },
  root: path.join(__dirname, 'views'),
});
// Registrar o plugin de arquivos estáticos
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/', // O navegador buscará em /public/css/style.css
});

// Lightweight CORS handling without external plugin (compatible with Fastify v5)
fastify.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;
  if (!origin) return; // allow server-to-server or curl where origin is not set
  if (allowedOrigins.indexOf(origin) !== -1) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    if (request.method === 'OPTIONS') {
      reply.code(204).send();
    }
  }
});

// ─── Routes ──────────────────────────────────────────────────────
// API routes (JSON)
fastify.register(require('./routes/auth'),  { prefix: '/api/auth' });
fastify.register(require('./routes/users'), { prefix: '/api/users' });
fastify.register(require('./routes/apps'),  { prefix: '/api/apps' });

// Pages routes (SSR / HTML)
fastify.register(require('./routes/pages'));

// Health check
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// ─── Start ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 8003;

async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Conexão com banco via Prisma estabelecida.');

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Hub rodando em http://localhost:${PORT}`);
  } catch (err) {
    console.error('❌ Erro ao iniciar o servidor:', err);
    process.exit(1);
  }
}

start();
