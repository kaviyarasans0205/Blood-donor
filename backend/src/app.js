import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import config from './config/index.js';
import { openApiSpec } from './config/swagger.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import donorRoutes from './routes/donorRoutes.js';
import eligibilityRoutes from './routes/eligibilityRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import rewardRoutes from './routes/rewardRoutes.js';
import predictionRoutes from './routes/predictionRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(compression());
app.use(mongoSanitize());

if (!config.isTest) app.use(apiLimiter);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'blood-bank-api', env: config.env, timestamp: new Date().toISOString() })
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'Blood Bank API Docs' }));

app.use('/api/auth', authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/eligibility', eligibilityRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/emergency-requests', emergencyRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/compatibility/:bloodGroup', async (req, res, next) => {
  try {
    const { compatibleRecipients } = await import('./services/compatibilityService.js');
    const recipients = compatibleRecipients(req.params.bloodGroup);
    if (!recipients.length) return res.status(400).json({ success: false, message: 'Invalid blood group', errorCode: 'INVALID_BLOOD_GROUP' });
    return res.json({ success: true, message: 'OK', data: { donorGroup: req.params.bloodGroup, canDonateTo: recipients } });
  } catch (e) { return next(e); }
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
