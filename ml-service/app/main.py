"""
FastAPI microservice exposing blood-demand forecasting endpoints.

Run:
    uvicorn app.main:app --host 0.0.0.0 --port 8000
    (from the ml-service/ directory)

The Node backend calls POST /predict-demand and falls back to its own local
moving-average forecast if this service is unreachable, so availability of
this service is optional but improves forecast quality.
"""

from __future__ import annotations

import os
import time
from typing import List, Literal, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .forecaster import ForecastResult, forecast

SERVICE_NAME = "blood-demand-forecast"
SERVICE_VERSION = "1.0.0"

app = FastAPI(
    title="Blood Demand Forecast Service",
    description=(
        "Statistical demand forecasting for blood groups. Decision-support only: "
        "forecasts are estimates from historical data, not medically validated "
        "predictions, and must not be used as autonomous medical decisions."
    ),
    version=SERVICE_VERSION,
    contact={"name": "Smart Blood Donor Management System"},
)

STARTED_AT = time.time()
BLOOD_GROUPS = {"A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"}


class PredictDemandRequest(BaseModel):
    bloodGroup: str = Field(..., description="ABO/Rh blood group, e.g. 'O-'")
    historicalData: List[float] = Field(
        ..., description="Daily demand series (units requested per day), oldest first"
    )
    forecastPeriod: int = Field(14, ge=1, le=180, description="Forecast horizon in days")
    model: Optional[Literal["holt_linear", "holt_damped", "sma"]] = Field(
        None, description="Force a specific model (default: auto-select by backtest MAPE)"
    )


class PredictDemandResponse(BaseModel):
    bloodGroup: str
    predictedDemand: float
    forecastPeriod: int
    model: str
    dataPoints: int
    quality: dict
    daily: List[float]
    disclaimer: str = (
        "Statistical estimate for decision support only. Not a medically "
        "validated prediction; must not be used as an autonomous medical decision."
    )


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    uptimeSeconds: float
    numpyVersion: str


@app.get("/health", response_model=HealthResponse, tags=["ops"])
def health() -> HealthResponse:
    import numpy as np

    return HealthResponse(
        status="ok",
        service=SERVICE_NAME,
        version=SERVICE_VERSION,
        uptimeSeconds=round(time.time() - STARTED_AT, 1),
        numpyVersion=np.__version__,
    )


@app.post("/predict-demand", response_model=PredictDemandResponse, tags=["forecast"])
def predict_demand(req: PredictDemandRequest) -> PredictDemandResponse:
    """Forecast total demand for one blood group over the requested horizon."""
    if req.bloodGroup not in BLOOD_GROUPS:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown bloodGroup '{req.bloodGroup}'. Expected one of {sorted(BLOOD_GROUPS)}",
        )
    if not req.historicalData:
        raise HTTPException(status_code=422, detail="historicalData must not be empty")

    result: ForecastResult = forecast(
        req.historicalData, req.forecastPeriod, model=req.model or "holt_linear"
    )
    return PredictDemandResponse(
        bloodGroup=req.bloodGroup,
        predictedDemand=result.predicted_demand,
        forecastPeriod=req.forecastPeriod,
        model=result.model,
        dataPoints=result.data_points,
        quality=result.quality,
        daily=result.daily,
    )


@app.post("/forecast", tags=["forecast"], summary="Alias for /predict-demand")
def forecast_alias(req: PredictDemandRequest) -> PredictDemandResponse:
    return predict_demand(req)


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.getenv("ML_HOST", "0.0.0.0"),
        port=int(os.getenv("ML_PORT", "8000")),
        reload=os.getenv("ML_RELOAD", "0") == "1",
    )
