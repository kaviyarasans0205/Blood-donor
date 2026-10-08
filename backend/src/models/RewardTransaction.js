import mongoose from 'mongoose';

const rewardTransactionSchema = new mongoose.Schema(
  {
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donor', required: true, index: true },
    points: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    transactionType: {
      type: String,
      enum: ['donation', 'referral', 'streak_bonus', 'appointment_kept', 'redemption', 'adjustment'],
      required: true,
    },
    donationRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', default: null },
    description: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

rewardTransactionSchema.index({ donorId: 1, createdAt: -1 });

const RewardTransaction = mongoose.model('RewardTransaction', rewardTransactionSchema);
export default RewardTransaction;
