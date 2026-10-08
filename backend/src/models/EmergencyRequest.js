import mongoose from 'mongoose';
import { BLOOD_GROUPS } from './Donor.js';

export const PRIORITIES = ['CRITICAL', 'URGENT', 'NORMAL'];
export const REQUEST_STATUSES = [
  'Pending',
  'Matching',
  'Fulfilled',
  'Partially Fulfilled',
  'Cancelled',
  'Expired',
];

const emergencyRequestSchema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientName: { type: String, required: true, trim: true, maxlength: 100 },
    hospital: { type: String, required: true, trim: true, maxlength: 150 },
    contactNumber: { type: String, required: true, trim: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true, index: true },
    requiredUnits: { type: Number, required: true, min: 1, max: 100 },
    fulfilledUnits: { type: Number, default: 0, min: 0 },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    address: { type: String, trim: true, maxlength: 200 },
    requiredAt: { type: Date, required: true, index: true },
    priority: { type: String, enum: PRIORITIES, required: true, index: true },
    priorityScore: { type: Number, default: 0 },
    priorityOverrideBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    priorityOverrideReason: { type: String, maxlength: 300 },
    status: { type: String, enum: REQUEST_STATUSES, default: 'Pending', index: true },
    notes: { type: String, maxlength: 1000 },
    matchedDonors: [
      {
        donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donor' },
        distanceKm: Number,
        notifiedAt: Date,
        respondedAt: Date,
        response: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
      },
    ],
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emergencyRequestSchema.index({ priority: 1, status: 1, createdAt: 1 });
emergencyRequestSchema.index({ bloodGroup: 1, status: 1 });

const EmergencyRequest = mongoose.model('EmergencyRequest', emergencyRequestSchema);
export default EmergencyRequest;
