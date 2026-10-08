"""API tests for the blood demand forecast service (pytest + FastAPI TestClient)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "blood-demand-forecast"
    assert float(body["uptimeSeconds"]) >= 0


@pytest.mark.parametrize("group", GROUPS)
def test_predict_demand_all_groups(group):
    series = [0, 2, 1, 3, 0, 4, 2, 1, 5, 3, 2, 0, 1, 4, 6, 2, 3, 1, 0, 2]
    res = client.post(
        "/predict-demand",
        json={"bloodGroup": group, "historicalData": series, "forecastPeriod": 7},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["bloodGroup"] == group
    assert body["forecastPeriod"] == 7
    assert body["predictedDemand"] >= 0
    assert body["dataPoints"] == len(series)
    assert body["model"].startswith("np_")
    assert len(body["daily"]) == 7
    assert sum(body["daily"]) == pytest.approx(body["predictedDemand"], abs=0.2)
    assert "disclaimer" in body and "decision support" in body["disclaimer"].lower()


def test_predict_demand_invalid_group():
    res = client.post(
        "/predict-demand",
        json={"bloodGroup": "X+", "historicalData": [1, 2, 3], "forecastPeriod": 7},
    )
    assert res.status_code == 422


def test_predict_demand_empty_series():
    res = client.post(
        "/predict-demand",
        json={"bloodGroup": "O+", "historicalData": [], "forecastPeriod": 7},
    )
    assert res.status_code == 422


def test_predict_demand_short_series_uses_fallback():
    res = client.post(
        "/predict-demand",
        json={"bloodGroup": "O+", "historicalData": [3, 1], "forecastPeriod": 5},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["model"] == "sma_fallback"
    assert body["predictedDemand"] == pytest.approx(10.0, abs=0.01)  # mean 2 * 5


def test_predict_demand_zero_series():
    res = client.post(
        "/predict-demand",
        json={"bloodGroup": "AB-", "historicalData": [0] * 14, "forecastPeriod": 7},
    )
    assert res.status_code == 200
    assert res.json()["predictedDemand"] == 0


def test_predict_demand_increasing_trend_forecasts_more_than_average():
    series = list(range(1, 21))  # 1..20 rising
    res = client.post(
        "/predict-demand",
        json={"bloodGroup": "A+", "historicalData": series, "forecastPeriod": 7},
    )
    body = res.json()
    # simple mean of history is 10.5/day -> 73.5 total; a trend model should beat flat mean
    assert body["predictedDemand"] > 73.5


def test_forecast_alias_endpoint():
    res = client.post(
        "/forecast",
        json={"bloodGroup": "B+", "historicalData": [1, 2, 1, 3, 2, 4, 3], "forecastPeriod": 3},
    )
    assert res.status_code == 200
    assert res.json()["forecastPeriod"] == 3


def test_forced_model_respected():
    res = client.post(
        "/predict-demand",
        json={
            "bloodGroup": "O+",
            "historicalData": [1, 2, 3, 2, 4, 3, 5, 4, 6],
            "forecastPeriod": 5,
            "model": "sma",
        },
    )
    assert res.status_code == 200
    assert res.json()["model"] == "np_sma"
