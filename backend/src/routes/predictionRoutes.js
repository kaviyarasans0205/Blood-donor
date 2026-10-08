import { Router } from 'express';
import * as ctrl from '../controllers/predictionController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.post('/demand', requireRole('admin', 'requester'), ctrl.predict);
router.post('/predict-demand', requireRole('admin', 'requester'), ctrl.oneOff);
router.get('/history', requireRole('admin'), ctrl.historySeries);
router.get('/trends', requireRole('admin'), ctrl.trends);

export default router;
