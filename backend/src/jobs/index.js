import cron from 'node-cron';
import { expireOverdueBatches, refreshStockAlerts } from '../services/inventoryService.js';
import Appointment from '../models/Appointment.js';
import { notify } from '../services/notificationService.js';
import Donor from '../models/Donor.js';
import EmergencyRequest from '../models/EmergencyRequest.js';
import User from '../models/User.js';
import { getDemandPredictions } from '../services/predictionService.js';

let started = false;

export function startJobs() {
  if (started) return;
  started = true;

  // Every hour: expire overdue batches + refresh alerts
  cron.schedule('0 * * * *', async () => {
    try {
      const expired = await expireOverdueBatches();
      const alerts = await refreshStockAlerts();
      if (expired || alerts.length) console.log(`[jobs] expiry sweep: ${expired} expired, ${alerts.length} alerts`);
    } catch (e) { console.error('[jobs] expiry job failed:', e.message); }
  });

  // Every 6 hours: appointment reminders (24h ahead)
  cron.schedule('0 */6 * * *', async () => {
    try {
      const in24 = new Date(Date.now() + 24 * 3600 * 1000);
      const start = new Date(in24.setHours(0, 0, 0, 0));
      const end = new Date(start.getTime() + 86400000);
      const appts = await Appointment.find({
        appointmentDate: { $gte: start, $lt: end },
        status: { $in: ['Pending', 'Confirmed'] },
        reminderSentAt: null,
      }).populate({ path: 'donorId', select: 'userId city' });

      for (const a of appts) {
        const donorUserId = a.donorId?.userId;
        if (!donorUserId) continue;
        await notify({
          userId: donorUserId,
          type: 'appointment_reminder',
          channels: ['inapp', 'email'],
          data: {
            date: a.appointmentDate.toISOString().slice(0, 10),
            time: a.appointmentTime,
            location: a.location,
            relatedEntity: { entityType: 'Appointment', entityId: a._id },
          },
        });
        a.reminderSentAt = new Date();
        await a.save();
      }
      if (appts.length) console.log(`[jobs] sent ${appts.length} appointment reminders`);
    } catch (e) { console.error('[jobs] reminder job failed:', e.message); }
  });

  // Daily 3am: donor re-engagement (inactive 6+ months)
  cron.schedule('0 3 * * *', async () => {
    try {
      const months = 6;
      const cutoff = new Date(Date.now() - months * 30 * 86400000);
      const inactive = await Donor.find({
        $or: [{ lastDonationDate: { $lt: cutoff } }, { lastDonationDate: null }],
        reEngagementDisabled: { $ne: true },
        notificationConsent: true,
        lastEngagementAt: { $lt: new Date(Date.now() - 30 * 86400000) },
      }).limit(200);

      let sent = 0;
      for (const d of inactive) {
        try {
          await notify({ userId: d.userId, type: 'reengagement_reminder', channels: ['inapp', 'email'] });
          d.lastEngagementAt = new Date();
          await d.save();
          sent++;
        } catch { /* skip individual failures */ }
      }
      if (sent) console.log(`[jobs] re-engagement sent to ${sent} donors`);
    } catch (e) { console.error('[jobs] reengagement job failed:', e.message); }
  });

  // Daily 4am: refresh demand predictions (cached, not per-request)
  cron.schedule('0 4 * * *', async () => {
    try {
      const result = await getDemandPredictions({ forecastDays: 14, forceRefresh: true });
      console.log(`[jobs] demand predictions refreshed: ${result.predictions.length} groups`);
    } catch (e) { console.error('[jobs] prediction job failed:', e.message); }
  });

  // Every 15 min: expire stale emergency requests past requiredAt
  cron.schedule('*/15 * * * *', async () => {
    try {
      const res = await EmergencyRequest.updateMany(
        { status: { $in: ['Pending', 'Matching'] }, requiredAt: { $lt: new Date() } },
        { $set: { status: 'Expired', resolvedAt: new Date() } }
      );
      if (res.modifiedCount) console.log(`[jobs] expired ${res.modifiedCount} stale requests`);
    } catch (e) { console.error('[jobs] expire job failed:', e.message); }
  });

  console.log('[jobs] scheduled jobs registered (expiry, reminders, re-engagement, predictions, request expiry)');
}

export default { startJobs };
