const { verifyAccessToken } = require('../lib/token');

async function authenticate(request, reply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ detail: 'Token não fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    request.userId = decoded.userId;
    request.user = decoded;
  } catch (err) {
    return reply.code(401).send({ detail: 'Token inválido ou expirado.' });
  }
}

module.exports = { authenticate };
