import os
import math
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Archisynapse Fraud Detection Engine", version="1.0")

# Risk Assessment Threshold
MODEL_THRESHOLD = float(os.getenv("MODEL_THRESHOLD", 0.85))

class FraudCheckRequest(BaseModel):
    transaction_id: Optional[str] = None
    customer_id: str
    amount: int  # in cents
    currency: str = "USD"
    payment_method_token: Optional[str] = None

class FraudCheckResponse(BaseModel):
    fraud_score: float
    decision: str  # "APPROVE" or "BLOCK"
    threshold: float
    risk_factors: list[str]

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "engine": "Archisynapse ML Fraud Engine v1.0",
        "model_threshold": MODEL_THRESHOLD
    }

@app.post("/fraud/check", response_model=FraudCheckResponse)
def check_fraud(req: FraudCheckRequest):
    fraud_score = 0.0
    risk_factors = []

    # 1. Deterministic Rule triggers (for E2E verification/testability)
    if req.payment_method_token and "fraud_trigger" in req.payment_method_token:
        fraud_score = 0.99
        risk_factors.append("Blacklisted payment instrument token detected.")
    elif req.amount == 99999:  # Special test case ($999.99)
        fraud_score = 0.95
        risk_factors.append("Flagged transaction testing amount trigger.")
    else:
        # 2. Advanced Heuristic ML Model Simulation (Neural/Sigmoid)
        # Features: Logarithmic amount scale + Customer age risk proxy + Currency deviation
        amount_usd = req.amount / 100.0
        
        # Calculate base log-scale risk for transaction amount (higher amount = higher base risk)
        # e.g., $100 -> log(100)=4.6, $10000 -> log(10000)=9.2
        amount_log = math.log(max(1, amount_usd))
        
        # Simulating customer velocity / historical record age based on ID hash proxy
        # Deterministic simulation based on length of customer ID
        cust_risk_proxy = (len(req.customer_id) % 5) * 0.12
        
        # Sigmoid function simulation to squash weights into [0, 1] range
        # Weights: 0.25 on log amount, 0.4 on customer proxy, base intercept of -2.5
        z = (0.25 * amount_log) + (0.4 * cust_risk_proxy) - 2.5
        fraud_score = 1.0 / (1.0 + math.exp(-z))
        
        # Risk factors compilation
        if amount_usd > 5000:
            risk_factors.append("Large transaction amount exceeding $5,000 threshold.")
        if cust_risk_proxy > 0.35:
            risk_factors.append("Velocity score deviation indicating elevated profile activity.")

    # 3. Decision Boundary assessment
    decision = "BLOCK" if fraud_score >= MODEL_THRESHOLD else "APPROVE"

    return FraudCheckResponse(
        fraud_score=round(fraud_score, 4),
        decision=decision,
        threshold=MODEL_THRESHOLD,
        risk_factors=risk_factors
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
