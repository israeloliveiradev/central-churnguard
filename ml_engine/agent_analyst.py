import os
import sys

# Force single-thread mode for ML/NumPy libraries to prevent fork-safety crashes and thread limit errors
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"

import pandas as pd
import numpy as np
import sqlite3
import psycopg2
import joblib
from dotenv import load_dotenv
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression

# Load environment variables from different possible directories
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))  # Local folder in prod
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))  # Repo root in dev
load_dotenv()

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.joblib")
DB_URL = os.environ.get("DATABASE_URL")

# Resolve SQLite path dynamically based on layout (dev vs production subdomains)
possible_sqlite_paths = [
    os.environ.get("SQLITE_DB_PATH"),
    os.path.join(os.path.dirname(__file__), "..", "backend", "churnguard.db"),
    os.path.join(os.path.dirname(__file__), "..", "api-churnguard", "churnguard.db"),
    os.path.join(os.path.dirname(__file__), "churnguard.db")
]
SQLITE_PATH = next((p for p in possible_sqlite_paths if p is not None and os.path.exists(p)), possible_sqlite_paths[1])


class AgentAnalyst:
    def __init__(self):
        self.model = None
        self.feature_names = None
        self.num_cols = [
            "SeniorCitizen", "tenure", "MonthlyCharges", "TotalCharges", 
            "NumServices", "HasInternet", "HasSupport", "HasStreaming"
        ]
        self.cat_cols = [
            "gender", "Partner", "Dependents", "PhoneService", "MultipleLines", 
            "InternetService", "OnlineSecurity", "OnlineBackup", "DeviceProtection", 
            "TechSupport", "StreamingTV", "StreamingMovies", "Contract", 
            "PaperlessBilling", "PaymentMethod"
        ]
        
    def get_db_connection(self):
        """
        Establishes database connection based on environment variables.
        Supports PostgreSQL (Supabase) and SQLite as fallback.
        """
        if DB_URL:
            try:
                # Direct PostgreSQL connection with timeout to prevent hangs
                conn = psycopg2.connect(DB_URL, connect_timeout=3)
                return conn, "postgresql"
            except Exception as e:
                print(f"Failed to connect to Supabase PostgreSQL: {e}. Falling back to SQLite.")
                
        # Fallback to local SQLite
        # Ensure directory exists
        db_dir = os.path.dirname(SQLITE_PATH)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir)
            
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        return conn, "sqlite"

    def fetch_training_data(self):
        """
        Retrieves all customers records for model fitting.
        """
        conn, db_type = self.get_db_connection()
        try:
            df = pd.read_sql_query("SELECT * FROM customers WHERE customerid NOT LIKE '%-NEW' AND customerid NOT LIKE '%-CSV'", conn)
            # Normalize column names to expected mixed-case casing
            mapping = {col.lower(): col for col in self.num_cols + self.cat_cols + ["customerID", "name", "email", "Churn", "customerid", "churn"]}
            df = df.rename(columns=mapping)
            return df
        finally:
            conn.close()

    def train_model(self):
        """
        Trains the Logistic Regression model using preprocessing pipeline.
        Saves trained pipeline to joblib.
        """
        print("Training Agent_Analyst model...")
        try:
            df = self.fetch_training_data()
        except Exception as e:
            print(f"Error fetching data to train model: {e}")
            return False

        if len(df) == 0:
            print("No training data available in the database.")
            return False

        # Exclude metadata and target column
        X = df.drop(columns=["customerid", "name", "email", "churn"], errors="ignore")
        # In case the columns are cased differently in database
        if "customerID" in df.columns:
            X = X.drop(columns=["customerID", "Churn"], errors="ignore")
            
        # Clip numerical outliers to protect the linear model from collinearity cancellation
        if "MonthlyCharges" in X.columns:
            X["MonthlyCharges"] = X["MonthlyCharges"].clip(upper=150.0)
        if "TotalCharges" in X.columns:
            X["TotalCharges"] = X["TotalCharges"].clip(upper=8000.0)

        y = df.get("churn", df.get("Churn"))
        if y is None:
            print("Target column (churn) not found in dataset.")
            return False
            
        y = y.astype(int)

        # Build column preprocessor
        self.preprocessor = ColumnTransformer([
            ("num", StandardScaler(), self.num_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore", drop="first"), self.cat_cols),
        ])

        self.model = Pipeline([
            ("pre", self.preprocessor),
            ("clf", LogisticRegression(
                C=0.1,
                class_weight={0: 1, 1: 2.5},
                max_iter=1000,
                random_state=42,
                solver="lbfgs"
            ))
        ])

        # Train
        self.model.fit(X, y)
        
        # Save feature names in the encoded space
        clf = self.model.named_steps["clf"]
        ohe = self.model.named_steps["pre"].named_transformers_["cat"]
        self.feature_names = self.num_cols + list(ohe.get_feature_names_out(self.cat_cols))
        
        # Save model joblib
        joblib.dump((self.model, self.feature_names), MODEL_PATH)
        print("Model trained and saved to:", MODEL_PATH)
        return True

    def load_model(self):
        """
        Loads pre-trained model. Automatically trains a new one if not found.
        """
        if os.path.exists(MODEL_PATH):
            try:
                self.model, self.feature_names = joblib.load(MODEL_PATH)
                self.preprocessor = self.model.named_steps["pre"]
                return True
            except Exception as e:
                print(f"Error loading model from disk: {e}. Retraining...")
                
        return self.train_model()

    def predict(self, customer_data: dict):
        """
        Predicts churn risk and evaluates contribution factors (SHAP).
        """
        if not self.model:
            loaded = self.load_model()
            if not loaded:
                raise ValueError("Model is not loaded or trained.")

        # Match columns casing to lower or upper depending on request schema
        # Normalizing keys
        normalized_data = {}
        for k, v in customer_data.items():
            normalized_data[k.lower()] = v

        # Convert to single DataFrame row
        # Map values back to standard keys
        input_dict = {}
        
        # Numeric values
        for col in self.num_cols:
            val = normalized_data.get(col.lower())
            if val is None:
                # Default fallbacks
                if col == "tenure": input_dict[col] = 1
                elif col == "MonthlyCharges": input_dict[col] = 50.0
                elif col == "TotalCharges": input_dict[col] = 50.0
                else: input_dict[col] = 0
            else:
                input_dict[col] = float(val)

            # Clip numerical outliers to match training bounds
            if col == "MonthlyCharges":
                input_dict[col] = min(input_dict[col], 150.0)
            elif col == "TotalCharges":
                input_dict[col] = min(input_dict[col], 8000.0)

        # Categorical values
        for col in self.cat_cols:
            val = normalized_data.get(col.lower())
            if val is None:
                input_dict[col] = "No"
            else:
                input_dict[col] = str(val)

        df_cust = pd.DataFrame([input_dict])

        # Predict probability
        proba = self.model.predict_proba(df_cust)[0, 1]
        risk_pct = round(proba * 100, 1)

        # -------------------------------------------------------------
        # SHAP calculation for Linear/Logistic Regression
        # -------------------------------------------------------------
        X_pre = self.preprocessor.transform(df_cust)
        if hasattr(X_pre, "toarray"):
            X_pre = X_pre.toarray()
        X_pre = X_pre[0]

        clf = self.model.named_steps["clf"]
        coefs = clf.coef_[0]

        contributions = {}
        for feat_name, val, coef in zip(self.feature_names, X_pre, coefs):
            contrib = val * coef
            contributions[feat_name] = contrib

        reasons = []
        for feat_name, contrib in contributions.items():
            if abs(contrib) < 0.05:
                continue
                
            friendly_name = feat_name
            
            # Map features to reader-friendly B2B language
            if "Contract_One year" in feat_name:
                friendly_name = "Contrato de 1 Ano"
            elif "Contract_Two year" in feat_name:
                friendly_name = "Contrato de 2 Anos"
            elif "Contract" in feat_name:
                friendly_name = "Contrato Mensal"
            elif "InternetService_Fiber optic" in feat_name:
                friendly_name = "Uso de Fibra Óptica"
            elif "InternetService_No" in feat_name:
                friendly_name = "Sem serviço de internet"
            elif "InternetService" in feat_name:
                friendly_name = "Internet DSL"
            elif "PaymentMethod_Electronic check" in feat_name:
                friendly_name = "Pagamento via Boleto Eletrônico"
            elif "PaymentMethod_Credit card" in feat_name:
                friendly_name = "Pagamento via Cartão de Crédito Automático"
            elif "PaymentMethod_Bank transfer" in feat_name:
                friendly_name = "Pagamento via Débito em Conta Automático"
            elif "OnlineSecurity" in feat_name:
                friendly_name = "Sem Segurança Online ativa" if contrib > 0 else "Segurança Online ativa"
            elif "TechSupport" in feat_name:
                friendly_name = "Sem Suporte Técnico ativo" if contrib > 0 else "Suporte Técnico ativo"
            elif "PaperlessBilling" in feat_name:
                friendly_name = "Faturamento Digital (Paperless)"
            elif "tenure" in feat_name:
                friendly_name = "Tempo de contrato curto" if contrib > 0 else "Cliente de longo prazo"
            elif "MonthlyCharges" in feat_name:
                friendly_name = "Fatura mensal elevada" if contrib > 0 else "Fatura mensal baixa"
            elif "TotalCharges" in feat_name:
                friendly_name = "Volume de cobrança acumulada"
            elif "NumServices" in feat_name:
                friendly_name = "Poucos serviços contratados" if contrib > 0 else "Diversos serviços contratados"
            elif "HasSupport" in feat_name:
                friendly_name = "Sem suporte ou segurança ativa" if contrib > 0 else "Serviços de suporte ativos"
            elif "HasStreaming" in feat_name:
                friendly_name = "Serviços de streaming ativos" if contrib > 0 else "Sem streaming ativo"
            elif "HasInternet" in feat_name:
                friendly_name = "Serviço de Internet ativo" if contrib > 0 else "Sem internet ativa"

            reasons.append({
                "feature": feat_name,
                "label": friendly_name,
                "contribution": contrib,
                "type": "risk" if contrib > 0 else "protection"
            })

        risk_factors = [r for r in reasons if r["type"] == "risk"]
        protection_factors = [r for r in reasons if r["type"] == "protection"]

        risk_factors = sorted(risk_factors, key=lambda x: x["contribution"], reverse=True)
        protection_factors = sorted(protection_factors, key=lambda x: x["contribution"])

        # Add fallback logic for contract & support if not explicit
        contract_val = input_dict.get("Contract")
        if contract_val == "Month-to-month" and not any("Contract" in r["feature"] for r in risk_factors):
            risk_factors.append({
                "feature": "Contract_Month-to-month",
                "label": "Contrato Mensal (Sem Fidelidade)",
                "contribution": 0.8,
                "type": "risk"
            })
            risk_factors = sorted(risk_factors, key=lambda x: x["contribution"], reverse=True)

        if input_dict.get("OnlineSecurity") == "No" and not any("OnlineSecurity" in r["feature"] for r in risk_factors):
            risk_factors.append({
                "feature": "OnlineSecurity_No",
                "label": "Falta de Segurança Online contratada",
                "contribution": 0.4,
                "type": "risk"
            })
            risk_factors = sorted(risk_factors, key=lambda x: x["contribution"], reverse=True)

        return {
            "customerid": customer_data.get("customerID") or customer_data.get("customerid"),
            "name": customer_data.get("name"),
            "risk_pct": risk_pct,
            "risk_factors": [r["label"] for r in risk_factors[:3]],
            "protection_factors": [r["label"] for r in protection_factors[:3]]
        }

    def predict_batch(self, customers_list: list):
        """
        Executes high-performance batch prediction on a list of customer profiles.
        Vectorized using pandas and scikit-learn to avoid looping overhead.
        """
        if not self.model:
            loaded = self.load_model()
            if not loaded:
                raise ValueError("Model is not loaded or trained.")

        if not customers_list:
            return []

        # 1. Prepare input dictionaries in batch
        prepared_inputs = []
        for customer_data in customers_list:
            normalized_data = {}
            for k, v in customer_data.items():
                normalized_data[k.lower()] = v

            input_dict = {}
            # Numeric columns
            for col in self.num_cols:
                val = normalized_data.get(col.lower())
                if val is None:
                    if col == "tenure": input_dict[col] = 1
                    elif col == "MonthlyCharges": input_dict[col] = 50.0
                    elif col == "TotalCharges": input_dict[col] = 50.0
                    else: input_dict[col] = 0
                else:
                    input_dict[col] = float(val)

                # Clip numerical outliers to match training bounds
                if col == "MonthlyCharges":
                    input_dict[col] = min(input_dict[col], 150.0)
                elif col == "TotalCharges":
                    input_dict[col] = min(input_dict[col], 8000.0)

            # Categorical columns
            for col in self.cat_cols:
                val = normalized_data.get(col.lower())
                if val is None:
                    input_dict[col] = "No"
                else:
                    input_dict[col] = str(val)

            prepared_inputs.append(input_dict)

        df_batch = pd.DataFrame(prepared_inputs)

        # 2. Batch predict probabilities
        probas = self.model.predict_proba(df_batch)[:, 1]

        # 3. Vectorized pre-processing for contribution calculation
        X_pre_all = self.preprocessor.transform(df_batch)
        if hasattr(X_pre_all, "toarray"):
            X_pre_all = X_pre_all.toarray()

        clf = self.model.named_steps["clf"]
        coefs = clf.coef_[0]

        results = []
        for idx, customer_data in enumerate(customers_list):
            risk_pct = round(probas[idx] * 100, 1)
            X_pre = X_pre_all[idx]

            contributions = {}
            for feat_name, val, coef in zip(self.feature_names, X_pre, coefs):
                contrib = val * coef
                contributions[feat_name] = contrib

            reasons = []
            for feat_name, contrib in contributions.items():
                if abs(contrib) < 0.05:
                    continue

                friendly_name = feat_name
                # Map features to reader-friendly B2B language
                if "Contract_One year" in feat_name:
                    friendly_name = "Contrato de 1 Ano"
                elif "Contract_Two year" in feat_name:
                    friendly_name = "Contrato de 2 Anos"
                elif "Contract" in feat_name:
                    friendly_name = "Contrato Mensal"
                elif "InternetService_Fiber optic" in feat_name:
                    friendly_name = "Uso de Fibra Óptica"
                elif "InternetService_No" in feat_name:
                    friendly_name = "Sem serviço de internet"
                elif "InternetService" in feat_name:
                    friendly_name = "Internet DSL"
                elif "PaymentMethod_Electronic check" in feat_name:
                    friendly_name = "Pagamento via Boleto Eletrônico"
                elif "PaymentMethod_Credit card" in feat_name:
                    friendly_name = "Pagamento via Cartão de Crédito Automático"
                elif "PaymentMethod_Bank transfer" in feat_name:
                    friendly_name = "Pagamento via Débito em Conta Automático"
                elif "OnlineSecurity" in feat_name:
                    friendly_name = "Sem Segurança Online ativa" if contrib > 0 else "Segurança Online ativa"
                elif "TechSupport" in feat_name:
                    friendly_name = "Sem Suporte Técnico ativo" if contrib > 0 else "Suporte Técnico ativo"
                elif "PaperlessBilling" in feat_name:
                    friendly_name = "Faturamento Digital (Paperless)"
                elif "tenure" in feat_name:
                    friendly_name = "Tempo de contrato curto" if contrib > 0 else "Cliente de longo prazo"
                elif "MonthlyCharges" in feat_name:
                    friendly_name = "Fatura mensal elevada" if contrib > 0 else "Fatura mensal baixa"
                elif "TotalCharges" in feat_name:
                    friendly_name = "Volume de cobrança acumulada"
                elif "NumServices" in feat_name:
                    friendly_name = "Poucos serviços contratados" if contrib > 0 else "Diversos serviços contratados"
                elif "HasSupport" in feat_name:
                    friendly_name = "Sem suporte ou segurança ativa" if contrib > 0 else "Serviços de suporte ativos"
                elif "HasStreaming" in feat_name:
                    friendly_name = "Serviços de streaming ativos" if contrib > 0 else "Sem streaming ativo"
                elif "HasInternet" in feat_name:
                    friendly_name = "Serviço de Internet ativo" if contrib > 0 else "Sem internet ativa"

                reasons.append({
                    "feature": feat_name,
                    "label": friendly_name,
                    "contribution": contrib,
                    "type": "risk" if contrib > 0 else "protection"
                })

            risk_factors = [r for r in reasons if r["type"] == "risk"]
            protection_factors = [r for r in reasons if r["type"] == "protection"]

            risk_factors = sorted(risk_factors, key=lambda x: x["contribution"], reverse=True)
            protection_factors = sorted(protection_factors, key=lambda x: x["contribution"])

            # Fallbacks
            contract_val = prepared_inputs[idx].get("Contract")
            if contract_val == "Month-to-month" and not any("Contract" in r["feature"] for r in risk_factors):
                risk_factors.append({
                    "feature": "Contract_Month-to-month",
                    "label": "Contrato Mensal (Sem Fidelidade)",
                    "contribution": 0.8,
                    "type": "risk"
                })
                risk_factors = sorted(risk_factors, key=lambda x: x["contribution"], reverse=True)

            if prepared_inputs[idx].get("OnlineSecurity") == "No" and not any("OnlineSecurity" in r["feature"] for r in risk_factors):
                risk_factors.append({
                    "feature": "OnlineSecurity_No",
                    "label": "Falta de Segurança Online contratada",
                    "contribution": 0.4,
                    "type": "risk"
                })
                risk_factors = sorted(risk_factors, key=lambda x: x["contribution"], reverse=True)

            results.append({
                "customerid": customer_data.get("customerID") or customer_data.get("customerid"),
                "name": customer_data.get("name"),
                "risk_pct": risk_pct,
                "risk_factors": [r["label"] for r in risk_factors[:3]],
                "protection_factors": [r["label"] for r in protection_factors[:3]]
            })

        return results


if __name__ == "__main__":
    analyst = AgentAnalyst()
    print("Testing connection...")
    try:
        df = analyst.fetch_training_data()
        print(f"Connected successfully! Found {len(df)} rows.")
    except Exception as e:
        print(f"Database fetch failed: {e}")
