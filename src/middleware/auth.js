const { verifyAccessToken } = require('../lib/token');

async function authenticate(request, reply) {
  const authHeader = request.headers.authorization;
  const cookieToken = request.cookies.sso_access_token;
  
  let token = null;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (cookieToken) {
    token = cookieToken;
  }

  if (!token) {
    // CORREÇÃO: Usamos request.url para garantir que a leitura não falha
    if (request.url.startsWith('/app/')) {
      return reply.redirect('/login');
    }
    return reply.code(401).send({ detail: 'Token não fornecido.' });
  }

  try {
    const decoded = verifyAccessToken(token);
    request.user = decoded; // Dados do utilizador disponíveis em todas as rotas
    request.userId = decoded.userId;
  } catch (err) {
    // CORREÇÃO: Usamos request.url aqui também
    if (request.url.startsWith('/app/')) {
      return reply.redirect('/login');
    }
    return reply.code(401).send({ detail: 'Token inválido ou expirado.' });
  }
}

module.exports = { authenticate };