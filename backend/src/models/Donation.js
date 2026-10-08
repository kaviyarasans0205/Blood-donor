import mongoose from 'mongoose';
import { BLOOD_GROUPS } from './Donor.js';

const donationSchema = new mongoose.Schema(
  {
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donor', required: true, index: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    units: { type: Number, default: 1, min: 1, max: 5 },
    donationDate: { type: Date, required: true, index: true },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'no-show'],
      default: 'completed',
    },
    notes: { type: String, maxlength: 500 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

donationSchema.index({ donationDate: -1 });
donationSchema.index({ donorId: 1, donationDate: -1 });

const Donation = mongoose.model('Donation', donationSchema);
export default Donation;
