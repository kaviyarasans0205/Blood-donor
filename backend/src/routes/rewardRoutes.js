import { Router } from 'express';
import * as ctrl from '../controllers/rewardController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', ctrl.summary);
router.get('/history', ctrl.history);
router.get('/config', requireRole('admin'), ctrl.config);
router.put('/config', requireRole('admin'), ctrl.config);
router.post('/adjust', requireRole('admin'), ctrl.adjust);

export default router;
