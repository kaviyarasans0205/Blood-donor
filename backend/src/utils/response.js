export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const success = (res, data = null, message = 'OK', meta = undefined) => {
  const body = { success: true, message };
  if (data !== null && data !== undefined) body.data = data;
  if (meta !== undefined) body.meta = meta;
  return res.json(body);
};

export const created = (res, data = null, message = 'Created') => {
  const body = { success: true, message };
  if (data !== null && data !== undefined) body.data = data;
  return res.status(201).json(body);
};

export const noContent = (res) => res.status(204).end();
