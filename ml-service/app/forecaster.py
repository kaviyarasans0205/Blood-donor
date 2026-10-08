"""
Blood demand forecasting for the Smart Blood Donor Management System.

Pure numpy/pandas implementation (no scikit-learn): an Application Control
policy on this machine blocks scipy DLLs, so the service deliberately relies
only on numpy + pandas. Models used, in order of preference:

1. Holt's linear trend (exponential smoothing with trend) - primary
2. Damped trend variant when the raw trend over/undershoots
3. Simple moving average fallback for very short series

Accuracy (MAPE, R^2) is measured on a rolling hold-out of the most recent
days and returned so the backend can display model quality transparently.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Optional, Sequence

import numpy as np


@dataclass
class ForecastResult:
    predicted_demand: float
    model: str
    data_points: int
    quality: dict = field(default_factory=dict)
    daily: List[float] = field(default_factory=list)


def _mape(y_true: np.ndarray, y_pred: np.ndarray) -> Optional[float]:
    mask = np.abs(y_true) > 0
    if not mask.any():
        return None
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def _r2(y_true: np.ndarray, y_pred: np.ndarray) -> Optional[float]:
    if len(y_true) < 2:
        return None
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    if ss_tot == 0:
        return None
    return round(1 - ss_res / ss_tot, 4)


def _holt_linear(series: np.ndarray, horizon: int, alpha: float = 0.4, beta: float = 0.15) -> np.ndarray:
    """Holt's linear trend method; returns `horizon` forecasted values."""
    level = float(series[0])
    trend = float(series[1] - series[0]) if len(series) > 1 else 0.0
    for value in series[1:]:
        prev_level = level
        level = alpha * value + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend
    return np.array([max(0.0, level + trend * h) for h in range(1, horizon + 1)])


def _holt_damped(series: np.ndarray, horizon: int, alpha: float = 0.4, beta: float = 0.1, phi: float = 0.9) -> np.ndarray:
    """Damped trend variant - dampens long-horizon trend drift."""
    level = float(series[0])
    trend = float(series[1] - series[0]) if len(series) > 1 else 0.0
    for value in series[1:]:
        prev_level = level
        level = alpha * value + (1 - alpha) * (level + phi * trend)
        trend = beta * (level - prev_level) + (1 - beta) * phi * trend
    forecasts = []
    damped = 0.0
    for h in range(1, horizon + 1):
        damped += phi ** (h - 1) * trend if h > 1 else trend
        forecasts.append(max(0.0, level + damped))
    return np.array(forecasts)


def _sma(series: np.ndarray, horizon: int) -> np.ndarray:
    window = max(1, min(7, len(series)))
    value = float(np.mean(series[-window:]))
    return np.full(horizon, max(0.0, value))


def _evaluate(fitted_fn, series: np.ndarray, holdout: int) -> tuple[np.ndarray, dict]:
    """Backtest on the last `holdout` points; refit on full series for output."""
    if holdout > 0 and len(series) - holdout >= 3:
        train, test = series[:-holdout], series[-holdout:]
        predicted = fitted_fn(train, holdout)
        quality = {
            "mape": round(_mape(test, predicted), 2) if _mape(test, predicted) is not None else None,
            "r2": _r2(test, predicted),
            "holdoutDays": int(holdout),
        }
    else:
        quality = {"mape": None, "r2": None, "holdoutDays": 0}
    return fitted_fn(series, 0), quality  # placeholder; replaced by caller


def forecast(
    historical: Sequence[float],
    horizon: int,
    model: str = "holt_linear",
) -> ForecastResult:
    """Forecast total demand over `horizon` days from a daily series."""
    series = np.asarray(historical, dtype=float)
    horizon = max(1, int(horizon))

    if series.size == 0:
        return ForecastResult(0.0, "no_data", 0, {"mape": None, "r2": None})

    # Non-negative, treat NaN as 0
    series = np.nan_to_num(series, nan=0.0, posinf=0.0, neginf=0.0)
    series = np.clip(series, 0, None)

    if series.size < 3:
        daily = _sma(series, horizon)
        return ForecastResult(
            predicted_demand=float(round(daily.sum(), 1)),
            model="sma_fallback",
            data_points=int(series.size),
            quality={"mape": None, "r2": None, "note": "insufficient history for backtest"},
            daily=[round(float(v), 2) for v in daily],
        )

    fitters = {
        "holt_linear": lambda s, h: _holt_linear(s, h),
        "holt_damped": lambda s, h: _holt_damped(s, h),
        "sma": lambda s, h: _sma(s, h),
    }

    holdout = int(min(7, max(3, series.size // 4)))
    candidates: list[tuple[str, dict, np.ndarray]] = []

    for name in ("holt_linear", "holt_damped", "sma"):
        train, test = series[:-holdout], series[-holdout:]
        pred = fitters[name](train, holdout)
        mape = _mape(test, pred)
        r2 = _r2(test, pred)
        # lower MAPE wins; None MAPE treated as inf
        score = mape if mape is not None else math.inf
        candidates.append((name, {"mape": round(mape, 2) if mape is not None else None, "r2": r2, "holdoutDays": holdout}, np.array([score])))
        candidates[-1] = (name, candidates[-1][1], None)
        candidates[-1] = (name, candidates[-1][1], score)

    # choose best by hold-out MAPE (sma treated as score via same path)
    best_name, best_quality, _ = min(candidates, key=lambda c: c[2])

    if model in fitters and model != best_name:
        # caller requested a specific model - honour it, but keep backtest quality
        chosen = model
        quality = next(q for n, q, _ in candidates if n == model)
    else:
        chosen = best_name
        quality = best_quality

    daily = fitters[chosen](series, horizon)
    return ForecastResult(
        predicted_demand=float(round(float(daily.sum()), 1)),
        model=f"np_{chosen}",
        data_points=int(series.size),
        quality=quality,
        daily=[round(float(v), 2) for v in daily],
    )


def forecast_with_pandas(dates, values, horizon: int) -> ForecastResult:
    """Optional convenience wrapper that resamples irregular dates to daily."""
    import pandas as pd

    df = pd.DataFrame({"date": pd.to_datetime(dates), "units": pd.to_float(values) if hasattr(pd, "to_float") else values})
    daily = df.set_index("date").resample("1D")["units"].sum().fillna(0.0)
    return forecast(daily.tolist(), horizon)
