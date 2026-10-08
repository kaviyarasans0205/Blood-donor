import { Router } from 'express';
import * as ctrl from '../controllers/eligibilityController.js';
import { validate, R } from '../validators/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/rules', ctrl.getRules);
router.put('/rules', requireRole('admin'), ctrl.updateRules);

router.post(
  '/check',
  validate({
    weightKg: [R.number(), R.min(20), R.max(250)],
    age: [R.number(), R.min(0), R.max(120)],
    answers: [],
  }),
  ctrl.check
);

router.get('/history', requireRole('donor'), ctrl.history);
router.get('/:donorId', requireRole('admin', 'requester'), ctrl.history);

export default router;
