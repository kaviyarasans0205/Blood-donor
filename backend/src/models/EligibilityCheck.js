import mongoose from 'mongoose';

const eligibilityCheckSchema = new mongoose.Schema(
  {
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donor', required: true, index: true },
    answers: { type: mongoose.Schema.Types.Mixed, required: true },
    result: { type: String, enum: ['ELIGIBLE', 'NOT_ELIGIBLE'], required: true },
    reasons: [{ type: String, maxlength: 300 }],
    rulesVersion: { type: String, default: '1' },
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isManual: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const EligibilityCheck = mongoose.model('EligibilityCheck', eligibilityCheckSchema);
export default EligibilityCheck;
