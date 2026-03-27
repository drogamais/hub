const prisma = require('./prisma');
const { generateAccessToken } = require('./token');
const { resolveAppPermissionsForUser } = require('./permissions');

/**
 * Tries to refresh an access token using a refresh token.
 * Returns { access, user } or null if invalid.
 */
async function refreshSession(refreshToken) {
  if (!refreshToken) {
    console.log('[AuthService] No refresh token provided.');
    return null;
  }

  try {
    console.log('[AuthService] Searching for refresh token in DB...');
    const stored = await prisma.refreshToken.findFirst({ 
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!stored) {
      console.warn('[AuthService] Refresh token not found in DB.');
      return null;
    }

    if (stored.revoked) {
      console.warn('[AuthService] Refresh token is revoked.');
      return null;
    }

    if (stored.expires_at && new Date(stored.expires_at) < new Date()) {
      console.warn(`[AuthService] Refresh token expired at ${stored.expires_at}`);
      return null;
    }

    const { user } = stored;
    if (!user) {
      console.warn('[AuthService] User not found for refresh token.');
      return null;
    }
    
    if (!user.is_active) {
      console.warn(`[AuthService] User ${user.username} is inactive.`);
      return null;
    }

    // Update last_used_at
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { last_used_at: new Date() }
    });

    console.log(`[AuthService] Resolving permissions for user: ${user.username}`);
    const appPermissions = await resolveAppPermissionsForUser(user.id);
    const access = generateAccessToken({ 
      userId: user.id, 
      first_name: user.first_name, 
      last_name: user.last_name, 
      setor: user.setor, 
      appPermissions 
    });

    console.log('[AuthService] New access token generated successfully.');
    return { access, user, userId: user.id };
  } catch (error) {
    console.error('[AuthService] Error refreshing session:', error);
    return null;
  }
}

module.exports = { refreshSession };
