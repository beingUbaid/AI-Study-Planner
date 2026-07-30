import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

const ACCESS_TOKEN_EXPIRY    = '15m';
const REFRESH_TOKEN_EXPIRY   = '7d';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const generateAccessToken = (userId) =>
  jwt.sign({ id: userId }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

export const generateRefreshToken = (userId, familyId = crypto.randomUUID()) =>
  jwt.sign(
    { id: userId, familyId, jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

const _cookieOptions = (extra = {}) => {
  const opts = {
    httpOnly: true,
    secure:   env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    ...extra
  };
  // Only set domain when COOKIE_DOMAIN is explicitly configured
  if (env.COOKIE_DOMAIN) {
    opts.domain = env.COOKIE_DOMAIN;
  }
  return opts;
};

export const sendRefreshTokenCookie = (res, token) =>
  res.cookie('refreshToken', token, _cookieOptions({ maxAge: REFRESH_COOKIE_MAX_AGE }));

export const clearRefreshTokenCookie = (res) =>
  res.clearCookie('refreshToken', _cookieOptions());

export const verifyAccessToken  = (token) => jwt.verify(token, env.JWT_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);
