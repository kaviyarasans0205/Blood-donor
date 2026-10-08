import { Router } from 'express';
import * as ctrl from '../controllers/notificationController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', ctrl.list);
router.put('/read-all', ctrl.markAllRead);
router.put('/:id/read', ctrl.markRead);
router.post('/send', requireRole('admin'), ctrl.send);

export default router;
