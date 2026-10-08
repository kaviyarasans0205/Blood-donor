import User from '../models/User.js';
import Donor, { BLOOD_GROUPS } from '../models/Donor.js';
import Requester from '../models/Requester.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler, success, created } from '../utils/response.js';
import { signToken } from '../middleware/auth.js';
import config from '../config/index.js';
import AuditLog from '../models/AuditLog.js';

const cookieOpts = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: config.isProd ? 'strict' : 'lax',
  maxAge: config.jwt.cookieMaxAge,
};

const ageFromDob = (dob) => Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role = 'donor', bloodGroup, dateOfBirth, gender, address, city, state, pincode, latitude, longitude, weight, organizationName, organizationType } = req.body;

  if (role !== 'donor' && role !== 'requester') {
    throw ApiError.forbidden('Only donor or requester accounts can self-register', 'FORBIDDEN_ROLE');
  }

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');

  const user = new User({ name, email, phone, role });
  await user.setPassword(password);

  if (role === 'donor') {
    if (!bloodGroup || !BLOOD_GROUPS.includes(bloodGroup)) throw ApiError.unprocessable('Valid blood group is required for donors', 'VALIDATION_ERROR', [{ field: 'bloodGroup', message: 'must be a valid blood group' }]);
    if (!dateOfBirth) throw ApiError.unprocessable('Date of birth is required for donors', 'VALIDATION_ERROR', [{ field: 'dateOfBirth', message: 'is required' }]);
    const age = ageFromDob(dateOfBirth);
    if (age < 16 || age > 100) throw ApiError.unprocessable('Date of birth is out of acceptable range', 'VALIDATION_ERROR', [{ field: 'dateOfBirth', message: 'age must be between 16 and 100' }]);

    const donor = new Donor({
      userId: user._id,
      bloodGroup,
      dateOfBirth,
      gender: gender || 'other',
      weight: weight ? Number(weight) : undefined,
      address, city, state, pincode,
      latitude: latitude != null && latitude !== '' ? Number(latitude) : undefined,
      longitude: longitude != null && longitude !== '' ? Number(longitude) : undefined,
    });
    await donor.save();
  } else if (role === 'requester') {
    if (!organizationName) throw ApiError.unprocessable('Organization name is required', 'VALIDATION_ERROR', [{ field: 'organizationName', message: 'is required' }]);
    await Requester.create({ userId: user._id, organizationName, organizationType: organizationType || 'hospital', address, city, state, pincode, latitude: latitude != null && latitude !== '' ? Number(latitude) : undefined, longitude: longitude != null && longitude !== '' ? Number(longitude) : undefined });
  }

  await user.save();
  const token = signToken(user.id);

  await AuditLog.create({ userId: user.id, action: 'auth:register', entityType: 'User', entityId: user._id, ip: req.ip, userAgent: req.headers['user-agent'] });

  if (!config.isTest) res.cookie('token', token, cookieOpts);
  return created(res, { token, user: user.toSafeJSON() }, 'Registration successful');
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  if (!user.isActive) throw ApiError.forbidden('Account is deactivated', 'ACCOUNT_DISABLED');

  const ok = await user.comparePassword(password);
  if (!ok) {
    await AuditLog.create({ userId: user.id, action: 'auth:login_failed', ip: req.ip, status: 'failure' });
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user.id);
  await AuditLog.create({ userId: user.id, action: 'auth:login', entityType: 'User', entityId: user._id, ip: req.ip, userAgent: req.headers['user-agent'] });

  if (!config.isTest) res.cookie('token', token, cookieOpts);
  return success(res, { token, user: user.toSafeJSON() }, 'Login successful');
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', { ...cookieOpts, maxAge: 0 });
  return success(res, null, 'Logged out');
});

export const me = asyncHandler(async (req, res) => {
  const user = req.user;
  let profile = null;
  if (user.role === 'donor') profile = await Donor.findOne({ userId: user.id }).lean();
  else if (user.role === 'requester') profile = await Requester.findOne({ userId: user.id }).lean();
  return success(res, { user: user.toSafeJSON(), profile });
});

export default { register, login, logout, me };
