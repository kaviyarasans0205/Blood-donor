import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/response.js';
import User from '../models/User.js';

export const signToken = (userId) =>
  jwt.sign({ sub: userId.toString() }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

export const verifyToken = (token) => jwt.verify(token, config.jwt.secret);

export const attachToken = (token) => `Bearer ${token}`;

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const cookieToken = req.cookies?.token;
  let token = null;
  if (header.startsWith('Bearer ')) token = header.slice(7);
  else if (cookieToken) token = cookieToken;

  if (!token) throw ApiError.unauthorized('Authentication required');

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Session expired, please log in again', 'TOKEN_EXPIRED');
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('Account is deactivated');

  req.user = user;
  next();
});

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires one of roles: ${roles.join(', ')}`, 'INSUFFICIENT_ROLE'));
    }
    return next();
  };

export const requireSelfOrRole =
  (paramName, ...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (roles.includes(req.user.role)) return next();
    const target = req.params[paramName];
    if (target && req.user.id === target) return next();
    return next(ApiError.forbidden('You may only access your own resources'));
  };
