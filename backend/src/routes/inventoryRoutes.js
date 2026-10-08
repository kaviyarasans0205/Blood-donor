import { Router } from 'express';
import * as ctrl from '../controllers/inventoryController.js';
import { validate, R } from '../validators/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';

const router = Router();

router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/alerts', ctrl.alerts);
router.get('/expiring', ctrl.expiring);
router.get('/thresholds', ctrl.thresholds);

router.post(
  '/',
  requireRole('admin'),
  audit('inventory:create', 'BloodInventory'),
  validate({
    bloodGroup: [R.required(), R.oneOf(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'])],
    units: [R.required(), R.number(), R.min(1), R.max(500)],
    batchNumber: [R.required(), R.string(), R.minLength(3), R.maxLength(40)],
    collectionDate: [R.required(), R.date()],
    expiryDate: [R.required(), R.date()],
    location: [R.required(), R.string(), R.maxLength(120)],
    notes: [R.maxLength(500)],
  }),
  ctrl.create
);

router.put(
  '/thresholds',
  requireRole('admin'),
  audit('inventory:thresholds', 'SystemSettings'),
  validate({ thresholds: [] }),
  ctrl.thresholds
);

router.put('/:id', requireRole('admin'), audit('inventory:update', 'BloodInventory'), ctrl.update);
router.delete('/:id', requireRole('admin'), audit('inventory:delete', 'BloodInventory'), ctrl.remove);

export default router;
