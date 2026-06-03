import os
import sys
from flask import Flask, request, jsonify

# Add current folder to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agent_analyst import AgentAnalyst

app = Flask(__name__)
analyst = AgentAnalyst()

# Attempt to load model on startup safely (non-blocking)
try:
    analyst.load_model()
except Exception as e:
    print(f"Warning: Model load on startup failed (will load lazily): {e}")

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "online",
        "message": "ChurnGuard ML Engine is running."
    })

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "model_loaded": analyst.model is not None
    })

@app.route("/predict", methods=["POST"])
def predict_churn():
    try:
        customer = request.json
        prediction = analyst.predict(customer)
        return jsonify(prediction)
    except Exception as e:
        return jsonify({"error": f"Prediction error: {str(e)}"}), 400

@app.route("/predict-batch", methods=["POST"])
def predict_churn_batch():
    try:
        customers = request.json
        predictions = analyst.predict_batch(customers)
        return jsonify(predictions)
    except Exception as e:
        return jsonify({"error": f"Batch prediction error: {str(e)}"}), 400

@app.route("/train", methods=["POST"])
def train_model():
    success = analyst.train_model()
    if success:
        return jsonify({"status": "success", "message": "Model retrained and saved successfully."})
    else:
        return jsonify({"error": "Failed to retrain model. Check console logs."}), 500

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("ML_PORT", "5000"))
    app.run(host=host, port=port)
