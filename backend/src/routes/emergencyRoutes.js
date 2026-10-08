import { Router } from 'express';
import * as ctrl from '../controllers/emergencyController.js';
import { validate, R } from '../validators/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { strictLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(requireAuth);

router.get('/priority-queue', requireRole('admin', 'requester'), ctrl.priorityQueue);

router.post(
  '/',
  requireRole('requester', 'admin'),
  strictLimiter,
  audit('emergency:create', 'EmergencyRequest'),
  validate({
    patientName: [R.required(), R.string(), R.minLength(2), R.maxLength(100)],
    hospital: [R.required(), R.string(), R.minLength(2), R.maxLength(150)],
    contactNumber: [R.required(), R.regex(/^[0-9+\-\s()]{7,20}$/, 'must be a valid phone')],
    bloodGroup: [R.required(), R.oneOf(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'])],
    requiredUnits: [R.required(), R.int(), R.min(1), R.max(100)],
    latitude: [R.required(), R.lat()],
    longitude: [R.required(), R.lng()],
    address: [R.maxLength(200)],
    requiredAt: [R.required(), R.date()],
    emergencyLevel: [R.oneOf(['critical', 'urgent', 'normal'])],
    notes: [R.maxLength(1000)],
  }),
  ctrl.create
);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.put('/:id', audit('emergency:update', 'EmergencyRequest'), ctrl.update);
router.post('/:id/match', requireRole('admin', 'requester'), ctrl.runMatching);
router.post('/:id/fulfill', requireRole('admin'), audit('emergency:fulfill', 'EmergencyRequest'), ctrl.fulfillFromInventory);

export default router;
