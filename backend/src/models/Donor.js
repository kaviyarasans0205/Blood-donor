import mongoose from 'mongoose';

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
export const GENDERS = ['male', 'female', 'other'];

const donorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true, index: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: GENDERS, required: true },
    weight: { type: Number, min: 20, max: 250 },
    address: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 80, index: true },
    state: { type: String, trim: true, maxlength: 80 },
    pincode: { type: String, trim: true, match: [/^[0-9]{6}$/, 'Pincode must be 6 digits'] },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    lastDonationDate: { type: Date, default: null },
    eligibilityStatus: { type: String, enum: ['eligible', 'ineligible', 'unknown'], default: 'unknown' },
    nextEligibleDate: { type: Date, default: null },
    notificationConsent: { type: Boolean, default: true },
    availability: { type: String, enum: ['available', 'unavailable', 'busy'], default: 'available' },
    totalDonations: { type: Number, default: 0 },
    rewardPoints: { type: Number, default: 0 },
    reEngagementDisabled: { type: Boolean, default: false },
    lastEngagementAt: { type: Date, default: null },
  },
  { timestamps: true }
);

donorSchema.index({ latitude: 1, longitude: 1 });
donorSchema.index({ bloodGroup: 1, eligibilityStatus: 1, availability: 1 });

donorSchema.virtual('age').get(function age() {
  if (!this.dateOfBirth) return null;
  return Math.floor((Date.now() - this.dateOfBirth.getTime()) / (365.25 * 24 * 3600 * 1000));
});

donorSchema.set('toJSON', { virtuals: true });

const Donor = mongoose.model('Donor', donorSchema);
export default Donor;
