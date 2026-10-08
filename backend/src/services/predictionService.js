import axios from 'axios';
import config from '../config/index.js';
import DemandPrediction from '../models/DemandPrediction.js';
import { getAvailableStock } from './inventoryService.js';
import { BLOOD_GROUPS } from '../models/Donor.js';
import Donation from '../models/Donation.js';
import EmergencyRequest from '../models/EmergencyRequest.js';

/**
 * Local fallback forecast (simple moving-average / linear trend) used when the
 * Python ML service is unavailable. Clearly marked as model: 'local_sma'.
 */
export function localForecast(series, horizon) {
  if (!Array.isArray(series) || series.length === 0) return { predicted: 0, model: 'local_sma', dataPoints: 0 };
  const n = series.length;
  const window = Math.min(7, n);
  const recent = series.slice(-window);
  const sma = recent.reduce((a, b) => a + b, 0) / window;

  let slope = 0;
  if (n >= 2) {
    const xs = series.map((_, i) => i);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = series.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - meanX) * (series[i] - meanY);
      den += (xs[i] - meanX) ** 2;
    }
    slope = den === 0 ? 0 : num / den;
  }

  let total = 0;
  for (let h = 1; h <= horizon; h++) total += Math.max(0, sma + slope * h);
  return {
    predicted: Math.round(total * 10) / 10,
    model: 'local_sma',
    dataPoints: n,
    slope: Math.round(slope * 1000) / 1000,
  };
}

async function buildHistoricalSeries(bloodGroup, days) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const [donations, requests] = await Promise.all([
    Donation.aggregate([
      { $match: { bloodGroup, donationDate: { $gte: since }, status: 'completed' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$donationDate' } }, units: { $sum: '$units' } } },
      { $sort: { _id: 1 } },
    ]),
    EmergencyRequest.aggregate([
      { $match: { bloodGroup, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, units: { $sum: '$requiredUnits' } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const demandMap = new Map(requests.map((r) => [r._id, r.units]));
  const daysArr = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    daysArr.push({ date: d, unitsRequested: demandMap.get(d) || 0 });
  }
  return { days: daysArr, donations };
}

/** Classify risk of stock shortfall vs predicted demand. */
export function classifyRisk(currentStock, predictedDemand) {
  if (predictedDemand <= 0) return 'LOW';
  const ratio = currentStock / predictedDemand;
  if (ratio < 0.5) return 'CRITICAL';
  if (ratio < 0.85) return 'HIGH';
  if (ratio < 1.2) return 'MEDIUM';
  return 'LOW';
}

export function recommendationFor(bloodGroup, risk) {
  const map = {
    CRITICAL: `Critical shortage projected for ${bloodGroup}. Escalate collection drives and coordinate inter-bank transfers immediately.`,
    HIGH: `Increase ${bloodGroup} collection planning; schedule donor outreach for the coming week.`,
    MEDIUM: `${bloodGroup} stock is near projected demand. Monitor closely and maintain current collection cadence.`,
    LOW: `${bloodGroup} supply is adequate relative to projected demand.`,
  };
  return map[risk];
}

/**
 * Get (or refresh cached) demand predictions for all blood groups.
 * Does NOT run heavy ML on every page load — results persisted in DemandPrediction.
 */
export async function getDemandPredictions({ forecastDays = 14, historyDays = 90, forceRefresh = false } = {}) {
  const cacheMaxAgeMs = 6 * 3600 * 1000;
  if (!forceRefresh) {
    const cached = await DemandPrediction.find({ forecastPeriodDays: forecastDays, isStale: false, updatedAt: { $gte: new Date(Date.now() - cacheMaxAgeMs) } });
    if (cached.length === BLOOD_GROUPS.length) return { predictions: cached, source: 'cache' };
  }

  const stock = await getAvailableStock();
  const predictions = [];

  for (const bg of BLOOD_GROUPS) {
    const { days } = await buildHistoricalSeries(bg, historyDays);
    const series = days.map((d) => d.unitsRequested);

    let result = null;
    try {
      const res = await axios.post(
        `${config.mlServiceUrl}/predict-demand`,
        { bloodGroup: bg, historicalData: series, forecastPeriod: forecastDays },
        { timeout: 5000 }
      );
      result = { predicted: res.data.predictedDemand, model: res.data.model, dataPoints: res.data.dataPoints ?? series.length, quality: res.data.quality };
    } catch {
      result = localForecast(series, forecastDays);
    }

    const currentStock = stock[bg] ?? 0;
    const riskLevel = classifyRisk(currentStock, result.predicted);
    const periodStart = new Date();
    const periodEnd = new Date(Date.now() + forecastDays * 24 * 3600 * 1000);

    const doc = await DemandPrediction.findOneAndUpdate(
      { bloodGroup: bg, forecastPeriodDays: forecastDays },
      {
        bloodGroup: bg,
        forecastPeriodDays: forecastDays,
        predictedDemand: result.predicted,
        currentStock,
        riskLevel,
        recommendation: recommendationFor(bg, riskLevel),
        modelMeta: {
          model: result.model || 'unknown',
          mape: result.quality?.mape ?? null,
          r2: result.quality?.r2 ?? null,
          dataPoints: result.dataPoints,
          generatedAt: new Date(),
        },
        periodStart,
        periodEnd,
        isStale: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    predictions.push(doc);
  }

  return { predictions, source: 'computed' };
}

export default { getDemandPredictions, localForecast, classifyRisk, recommendationFor };
