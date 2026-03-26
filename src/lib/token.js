const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function generateAccessToken(payload) {
  // short lived JWT
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m' });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function generateRefreshTokenString() {
  return crypto.randomBytes(48).toString('hex');
}

module.exports = { generateAccessToken, verifyAccessToken, generateRefreshTokenString };
