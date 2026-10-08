import { Router } from 'express';
import * as ctrl from '../controllers/donorController.js';
import { validate, R } from '../validators/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', requireRole('admin', 'requester'), ctrl.listDonors);
router.get('/eligible', requireRole('admin', 'requester'), ctrl.listEligibleDonors);
router.get('/compatible/:bloodGroup', requireRole('admin', 'requester'), ctrl.compatibleDonorsList);
router.get('/nearby', requireRole('admin', 'requester'), ctrl.nearbyDonors);
router.get('/dashboard/me', requireRole('donor'), ctrl.donorDashboard);
router.get('/:id', ctrl.getDonor);

router.put(
  '/:id',
  validate({
    bloodGroup: [R.oneOf(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'])],
    dateOfBirth: [R.date()],
    gender: [R.oneOf(['male', 'female', 'other'])],
    weight: [R.number(), R.min(20), R.max(250)],
    city: [R.maxLength(80)],
    state: [R.maxLength(80)],
    pincode: [R.regex(/^[0-9]{6}$/)],
    latitude: [R.lat()],
    longitude: [R.lng()],
    name: [R.maxLength(100)],
    phone: [R.regex(/^[0-9+\-\s()]{7,20}$/)],
    email: [R.email()],
  }),
  ctrl.updateDonor
);

export default router;
