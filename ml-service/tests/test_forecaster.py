"""Unit tests for the numpy forecaster."""

import pytest

from app.forecaster import forecast


def test_empty_series_returns_zero():
    r = forecast([], 7)
    assert r.predicted_demand == 0
    assert r.model == "no_data"
    assert r.data_points == 0


def test_constant_series_forecasts_constant():
    r = forecast([4.0] * 20, 7)
    assert r.predicted_demand == pytest.approx(28.0, abs=1.5)
    assert len(r.daily) == 7
    assert all(v >= 0 for v in r.daily)


def test_never_negative_even_with_negative_series():
    r = forecast([-3, -1, -2, 0, -4], 4)
    assert r.predicted_demand >= 0
    assert all(v >= 0 for v in r.daily)


def test_short_series_uses_sma_fallback():
    r = forecast([2, 6], 3)
    assert r.model == "sma_fallback"
    assert r.predicted_demand == pytest.approx(12.0)  # mean 4 * 3


def test_rising_series_beats_flat_sma():
    rising = list(range(1, 31))
    r = forecast(rising, 10)
    sma_flat = 10 * (sum(rising) / len(rising))  # what a flat mean would predict
    assert r.predicted_demand > sma_flat


def test_quality_reported_for_long_series():
    r = forecast([1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8, 10, 9, 11, 10, 12], 7)
    assert "mape" in r.quality
    assert "r2" in r.quality
    assert r.data_points == 20
    assert r.model.startswith("np_")


def test_nan_and_inf_sanitized():
    r = forecast([1, float("nan"), 3, float("inf"), 2, 4, 3], 5)
    assert r.predicted_demand >= 0
    assert all(v == v and v != float("inf") for v in r.daily)  # finite


def test_forced_model_holt_damped():
    r = forecast(list(range(1, 25)), 6, model="holt_damped")
    assert r.model == "np_holt_damped"
    assert len(r.daily) == 6
