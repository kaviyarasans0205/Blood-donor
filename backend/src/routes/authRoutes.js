import { Router } from 'express';
import * as ctrl from '../controllers/authController.js';
import { validate, R } from '../validators/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post(
  '/register',
  authLimiter,
  validate({
    name: [R.required(), R.string(), R.minLength(2), R.maxLength(100)],
    email: [R.required(), R.email()],
    password: [R.required(), R.minLength(8), R.maxLength(128)],
    phone: [R.required(), R.regex(/^[0-9+\-\s()]{7,20}$/, 'must be a valid phone number')],
    role: [R.oneOf(['donor', 'requester'])],
    bloodGroup: [R.oneOf(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'])],
    dateOfBirth: [R.date()],
    gender: [R.oneOf(['male', 'female', 'other'])],
    city: [R.maxLength(80)],
    state: [R.maxLength(80)],
    pincode: [R.regex(/^[0-9]{6}$/, 'must be a 6-digit pincode')],
    latitude: [R.lat()],
    longitude: [R.lng()],
    weight: [R.number(), R.min(20), R.max(250)],
  }),
  ctrl.register
);

router.post(
  '/login',
  authLimiter,
  validate({
    email: [R.required(), R.email()],
    password: [R.required(), R.string()],
  }),
  ctrl.login
);

router.post('/logout', ctrl.logout);
router.get('/me', requireAuth, ctrl.me);

export default router;
