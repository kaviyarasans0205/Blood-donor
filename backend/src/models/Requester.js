import mongoose from 'mongoose';

const requesterSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    organizationName: { type: String, required: true, trim: true, maxlength: 150 },
    organizationType: {
      type: String,
      enum: ['hospital', 'blood_bank', 'clinic', 'ngo', 'individual'],
      default: 'hospital',
    },
    licenseNumber: { type: String, trim: true, maxlength: 60 },
    address: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 80, index: true },
    state: { type: String, trim: true, maxlength: 80 },
    pincode: { type: String, trim: true },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Requester = mongoose.model('Requester', requesterSchema);
export default Requester;
