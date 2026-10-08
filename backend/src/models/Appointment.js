import mongoose from 'mongoose';

export const APPOINTMENT_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No-show'];

const appointmentSchema = new mongoose.Schema(
  {
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donor', required: true, index: true },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    appointmentDate: { type: Date, required: true, index: true },
    appointmentTime: { type: String, required: true, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM'] },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'Pending', index: true },
    notes: { type: String, maxlength: 500 },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

appointmentSchema.index(
  { donorId: 1, appointmentDate: 1, appointmentTime: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['Pending', 'Confirmed'] } } }
);

const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;
