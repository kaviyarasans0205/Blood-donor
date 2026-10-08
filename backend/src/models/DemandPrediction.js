import mongoose from 'mongoose';
import { BLOOD_GROUPS } from './Donor.js';

const demandPredictionSchema = new mongoose.Schema(
  {
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true, index: true },
    forecastPeriodDays: { type: Number, required: true, min: 1, max: 365 },
    predictedDemand: { type: Number, required: true, min: 0 },
    currentStock: { type: Number, default: 0 },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    recommendation: { type: String, maxlength: 500 },
    modelMeta: {
      model: String,
      mape: Number,
      r2: Number,
      dataPoints: Number,
      generatedAt: Date,
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    isStale: { type: Boolean, default: false },
  },
  { timestamps: true }
);

demandPredictionSchema.index({ bloodGroup: 1, periodEnd: 1 });

const DemandPrediction = mongoose.model('DemandPrediction', demandPredictionSchema);
export default DemandPrediction;
