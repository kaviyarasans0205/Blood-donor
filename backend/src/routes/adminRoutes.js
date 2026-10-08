import { Router } from 'express';
import * as ctrl from '../controllers/adminController.js';
import * as reportCtrl from '../controllers/reportController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/dashboard', ctrl.dashboard);
router.get('/analytics', ctrl.analytics);
router.get('/donor-map', ctrl.donorMap);
router.get('/alerts', ctrl.alerts);
router.put('/alerts/:id/resolve', audit('alert:resolve', 'Alert'), ctrl.resolveAlert);
router.get('/reengagement', ctrl.reengagement);
router.post('/reengagement/send', audit('reengagement:send', 'Donor'), ctrl.sendReengagement);
router.get('/settings', ctrl.settings);
router.put('/settings', audit('settings:update', 'SystemSettings'), ctrl.settings);
router.get('/reports/types', reportCtrl.listTypes);
router.get('/reports', reportCtrl.generate);

export default router;
