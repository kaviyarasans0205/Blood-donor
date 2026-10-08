import nodemailer from 'nodemailer';
import config from '../config/index.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

let transporter = null;

function getTransporter() {
  if (!config.email.host || !config.email.user) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.password },
  });
  return transporter;
}

const isEmailConfigured = () => Boolean(config.email.host && config.email.user);
const isSmsConfigured = () => Boolean(config.sms.provider && config.sms.apiKey);

export const templates = {
  emergency_request: (d) => ({
    title: `URGENT: ${d.bloodGroup} blood needed at ${d.hospital}`,
    message: `A ${d.priority} blood request needs ${d.requiredUnits} unit(s) of ${d.bloodGroup} at ${d.hospital}. ${d.distanceKm ? `You are approx ${d.distanceKm} km away. ` : ''}Please check your dashboard to respond.`,
  }),
  donor_match: (d) => ({
    title: `You may be a match for a ${d.bloodGroup} request`,
    message: `Your blood group ${d.bloodGroup} matches an active request near you${d.distanceKm ? ` (${d.distanceKm} km)` : ''}. Open the app to respond if you are available and eligible.`,
  }),
  appointment_confirmation: (d) => ({
    title: 'Appointment confirmed',
    message: `Your donation appointment on ${d.date} at ${d.time} at ${d.location} is confirmed. Please carry a valid ID and stay hydrated.`,
  }),
  appointment_reminder: (d) => ({
    title: 'Upcoming donation appointment',
    message: `Reminder: your donation appointment is on ${d.date} at ${d.time} at ${d.location}.`,
  }),
  low_stock: (d) => ({
    title: `Low stock alert: ${d.bloodGroup}`,
    message: `${d.bloodGroup} blood stock is ${d.units} unit(s), below the configured minimum of ${d.threshold}. Please plan collection.`,
  }),
  expiry_warning: (d) => ({
    title: `${d.bloodGroup} blood expires soon`,
    message: `Batch ${d.batchNumber}: ${d.units} unit(s) of ${d.bloodGroup} expire in ${d.daysRemaining} day(s) on ${d.expiryDate}.`,
  }),
  reengagement_reminder: () => ({
    title: 'You may be eligible to donate again',
    message: 'It has been a while since your last donation. Please check your eligibility and contact an authorized blood bank to schedule your next donation.',
  }),
  reward_earned: (d) => ({
    title: `+${d.points} reward points earned`,
    message: `You earned ${d.points} points for your donation. Current balance: ${d.balance} points.`,
  }),
  general: (d) => ({ title: d.title || 'Notification', message: d.message || '' }),
};

async function deliverEmail(user, title, message) {
  const tx = getTransporter();
  if (!tx) return { status: 'mocked', error: 'Email provider not configured.' };
  try {
    await tx.sendMail({ from: config.email.from, to: user.email, subject: title, text: message });
    return { status: 'sent', sentAt: new Date() };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

async function deliverSms(user, _title, message) {
  if (!isSmsConfigured()) return { status: 'mocked', error: 'SMS provider not configured.' };
  // Provider-agnostic: real integration point for Twilio/MSG91/etc.
  try {
    const res = await fetch(`https://api.${config.sms.provider}.example.com/sms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.sms.apiKey}:${config.sms.apiSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.sms.from, to: user.phone, text: message }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Provider responded ${res.status}`);
    return { status: 'sent', sentAt: new Date() };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

/**
 * Queue + attempt delivery of a notification.
 * @returns {Promise<Notification>} the persisted notification document
 */
export async function notify({ userId, type = 'general', channels = ['inapp'], data = {}, title, message }) {
  const tpl = templates[type] ? templates[type](data) : { title: title || 'Notification', message: message || '' };
  const finalTitle = title || tpl.title;
  const finalMessage = message || tpl.message;
  const user = await User.findById(userId).select('email phone name');
  if (!user) throw new Error(`Cannot notify: user ${userId} not found`);

  const results = [];
  for (const channel of channels) {
    const doc = await Notification.create({
      userId,
      type,
      channel,
      title: finalTitle,
      message: finalMessage,
      status: 'queued',
      relatedEntity: data.relatedEntity,
    });
    let outcome;
    if (channel === 'email') outcome = await deliverEmail(user, finalTitle, finalMessage);
    else if (channel === 'sms') outcome = await deliverSms(user, finalTitle, finalMessage);
    else outcome = { status: 'sent', sentAt: new Date() };

    doc.status = outcome.status;
    doc.sentAt = outcome.sentAt || null;
    if (outcome.error) doc.error = outcome.error;
    await doc.save();
    results.push(doc);
  }
  return results.length === 1 ? results[0] : results;
}

export async function notifyMany(userIds, payload) {
  const out = [];
  for (const id of userIds) {
    try {
      out.push(await notify({ ...payload, userId: id }));
    } catch (err) {
      console.warn('[notify] skipped', id, err.message);
    }
  }
  return out;
}

export const notificationChannels = { isEmailConfigured, isSmsConfigured };

export default { notify, notifyMany, templates, notificationChannels };
