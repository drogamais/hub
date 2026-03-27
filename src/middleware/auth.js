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

  // Se o token de ACESSO está faltando, tentamos refresh antes de desistir
  if (!token) {
    console.log('[Auth Middleware] Access token missing. Checking refresh token...');
    const refreshToken = request.cookies.sso_refresh_token;
    if (refreshToken) {
      const { refreshSession } = require('../lib/authService');
      const result = await refreshSession(refreshToken);
      if (result) {
        console.log(`[Auth Middleware] Silent refresh successful for user: ${result.user?.username}`);
        reply.setCookie('sso_access_token', result.access, { 
          path: '/', httpOnly: true, sameSite: 'lax', maxAge: 1 * 60 
        });
        request.user = result.user;
        request.userId = result.userId;
        // Flag para sincronização client-side (localStorage)
        request.refreshedData = { access: result.access, refresh: refreshToken, user: result.user };
        return; // Prossegue para a rota
      }
    }

    console.log(`[Auth Middleware] No token and refresh failed. Redirecting/401 for: ${request.url}`);
    if (request.url.startsWith('/app/')) {
      return reply.redirect('/login');
    }
    return reply.code(401).send({ detail: 'Token não fornecido.' });
  }

  try {
    const decoded = verifyAccessToken(token);
    request.user = decoded; 
    request.userId = decoded.userId;
  } catch (err) {
    console.log(`[Auth Middleware] Token verification failed: ${err.name} - ${err.message}`);
    
    // Tenta refresh automático se o token expirou
    if (err.name === 'TokenExpiredError') {
      const refreshToken = request.cookies.sso_refresh_token;
      console.log(`[Auth Middleware] Token expired. Attempting refresh with cookie: ${!!refreshToken}`);
      
      if (refreshToken) {
        const { refreshSession } = require('../lib/authService');
        const result = await refreshSession(refreshToken);
        
        if (result) {
          console.log(`[Auth Middleware] Refresh successful for user: ${result.user?.username}`);
          reply.setCookie('sso_access_token', result.access, { 
            path: '/', httpOnly: true, sameSite: 'lax', maxAge: 1 * 60 
          });
          request.user = result.user;
          request.userId = result.userId;
          // Flag para sincronização client-side (localStorage)
          request.refreshedData = { access: result.access, refresh: refreshToken, user: result.user };
          return; 
        } else {
          console.warn('[Auth Middleware] Refresh failed (session invalid/expired).');
        }
      }
    }

    console.log(`[Auth Middleware] Final rejection for URL: ${request.url}`);
    if (request.url.startsWith('/app/')) {
      return reply.redirect('/login');
    }
    return reply.code(401).send({ detail: 'Token inválido ou expirado.' });
  }
}

module.exports = { authenticate };