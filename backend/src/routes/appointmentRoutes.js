import { Router } from 'express';
import * as ctrl from '../controllers/appointmentController.js';
import { validate, R } from '../validators/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  requireRole('donor'),
  audit('appointment:book', 'Appointment'),
  validate({
    location: [R.required(), R.string(), R.maxLength(120)],
    appointmentDate: [R.required(), R.date()],
    appointmentTime: [R.required(), R.regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:MM')],
    notes: [R.maxLength(500)],
  }),
  ctrl.create
);

router.get('/', ctrl.list);
router.put('/:id', audit('appointment:update', 'Appointment'), ctrl.update);
router.delete('/:id', audit('appointment:cancel', 'Appointment'), ctrl.remove);

export default router;
