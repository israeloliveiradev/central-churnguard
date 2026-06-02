import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any

# Add current folder to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agent_analyst import AgentAnalyst

app = FastAPI(title="ChurnGuard ML Engine", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analyst = AgentAnalyst()

class CustomerDataInput(BaseModel):
    customerID: str
    name: str
    email: str
    gender: str
    SeniorCitizen: int
    Partner: str
    Dependents: str
    tenure: int
    PhoneService: str
    MultipleLines: str
    InternetService: str
    OnlineSecurity: str
    OnlineBackup: str
    DeviceProtection: str
    TechSupport: str
    StreamingTV: str
    StreamingMovies: str
    Contract: str
    PaperlessBilling: str
    PaymentMethod: str
    MonthlyCharges: float
    # Optional fields
    TotalCharges: float = 0.0
    NumServices: int = 0
    HasInternet: int = 0
    HasSupport: int = 0
    HasStreaming: int = 0

@app.on_event("startup")
def startup_event():
    # Warm up model
    print("Loading ML model on startup...")
    success = analyst.load_model()
    if not success:
        print("Warning: Model could not be loaded/trained on startup. Will attempt train on first request.")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model_loaded": analyst.model is not None,
        "database": "connected" if analyst.get_db_connection()[1] else "disconnected"
    }

@app.post("/predict")
def predict_churn(customer: Dict[str, Any]):
    try:
        prediction = analyst.predict(customer)
        return prediction
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction error: {str(e)}")

@app.post("/predict-batch")
def predict_churn_batch(customers: list[Dict[str, Any]]):
    try:
        predictions = analyst.predict_batch(customers)
        return predictions
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Batch prediction error: {str(e)}")

@app.post("/train")
def train_model():
    success = analyst.train_model()
    if success:
        return {"status": "success", "message": "Model retrained and saved successfully."}
    else:
        raise HTTPException(status_code=500, detail="Failed to retrain model. Check console logs.")


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "5000"))
    reload = os.getenv("RELOAD", "false").lower() == "true"
    print(f"Starting uvicorn server on {host}:{port} (reload={reload})...")
    uvicorn.run("main:app", host=host, port=port, reload=reload)
