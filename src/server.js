require('dotenv').config();

const path = require('path');
const fastify = require('fastify')({ logger: true });
const prisma = require('./lib/prisma');

// --- Environment checks ---
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.error('❌ Required JWT secrets not found in environment (JWT_SECRET, JWT_REFRESH_SECRET).');
  process.exit(1);
}

// ─── CORS 100% DINÂMICO VIA BANCO DE DADOS (Sem .env) ───
const ORIGINS_TTL_MS = 5 * 60 * 1000; // Atualiza o cache a cada 5 minutos
let cachedOrigins = [];
let lastCacheUpdate = 0;
let refreshingOriginsPromise = null;

async function refreshOriginsFromDB() {
  try {
    const apps = await prisma.app.findMany({ select: { url: true } });
    
    const origins = apps
      .map(a => {
        try { return new URL(a.url).origin; } catch (e) { return null; }
      })
      .filter(Boolean);
    
    // Adicionamos localhost:3000 por segurança para você acessar o Hub localmente
    cachedOrigins = Array.from(new Set(['http://localhost:3000', ...origins]));
    lastCacheUpdate = Date.now();
    fastify.log.debug({ cachedOrigins }, 'CORS atualizado com sucesso via Banco de Dados');
  } catch (err) {
    fastify.log.warn({ err }, 'Falha ao buscar intranets no banco; mantendo o cache anterior');
  } finally {
    refreshingOriginsPromise = null;
  }
}

async function getCachedOrigins() {
  if (Date.now() - lastCacheUpdate > ORIGINS_TTL_MS) {
    if (!refreshingOriginsPromise) refreshingOriginsPromise = refreshOriginsFromDB();
    await refreshingOriginsPromise;
  }
  return cachedOrigins;
}

async function isOriginAllowed(origin) {
  if (!origin) return true; // permite chamadas server-to-server onde a origem é nula
  const dbOrigins = await getCachedOrigins();
  return dbOrigins.includes(origin);
}

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
  prefix: '/public/', 
});

// ─── Hook de CORS Dinâmico ───────────────────────────────────────
fastify.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin;
  if (!origin) return; 
  
  try {
    const allowed = await isOriginAllowed(origin);
    if (allowed) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header('Access-Control-Allow-Headers', 'Authorization,Content-Type');
      reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      
      if (request.method === 'OPTIONS') {
        return reply.code(204).send();
      }
    }
  } catch (err) {
    fastify.log.error({ err }, 'Erro ao checar a origem para o CORS');
  }
});

// ─── Routes ──────────────────────────────────────────────────────
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