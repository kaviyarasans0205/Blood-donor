import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

const buildHandler = (isTest) => (req, res) => {
  if (isTest) return;
  res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later.',
    errorCode: 'RATE_LIMITED',
    retryAfter: Math.ceil(req.rateLimit.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 60),
  });
};

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
  handler: buildHandler(config.isTest),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
  handler: buildHandler(config.isTest),
});

export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
  handler: buildHandler(config.isTest),
});
