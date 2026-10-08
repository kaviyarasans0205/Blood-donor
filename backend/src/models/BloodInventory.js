import mongoose from 'mongoose';
import { BLOOD_GROUPS } from './Donor.js';

export const INVENTORY_STATUS = ['available', 'reserved', 'expired', 'consumed', 'discarded'];

const bloodInventorySchema = new mongoose.Schema(
  {
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true, index: true },
    units: { type: Number, required: true, min: 0 },
    batchNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    collectionDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true, index: true },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: INVENTORY_STATUS, default: 'available', index: true },
    notes: { type: String, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

bloodInventorySchema.index({ bloodGroup: 1, status: 1, expiryDate: 1 });

bloodInventorySchema.pre('validate', function preValidate(next) {
  if (this.collectionDate && this.expiryDate && this.expiryDate <= this.collectionDate) {
    this.expiryDate.invalidate?.();
    this.invalidate('expiryDate', 'Expiry date must be after collection date');
  }
  next();
});

const BloodInventory = mongoose.model('BloodInventory', bloodInventorySchema);
export default BloodInventory;
