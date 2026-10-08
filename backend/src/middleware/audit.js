import AuditLog from '../models/AuditLog.js';

export const audit = (action, entityType = null) => {
  return async (req, _res, next) => {
    req.audit = async (entityId, changes = null, status = 'success') => {
      try {
        await AuditLog.create({
          userId: req.user?.id || null,
          action,
          entityType,
          entityId: entityId || undefined,
          changes,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          status,
        });
      } catch (err) {
        console.warn('[audit] failed:', err.message);
      }
    };
    next();
  };
};
