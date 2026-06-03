import os
import pandas as pd
from dotenv import load_dotenv
load_dotenv()

from ml_engine.agent_analyst import AgentAnalyst

try:
    print("Initializing AgentAnalyst...")
    analyst = AgentAnalyst()
    print("Loading model...")
    analyst.load_model()
    
    print("Reading test_customers.csv...")
    input_df = pd.read_csv("test_customers.csv")
    records = input_df.to_dict(orient="records")
    
    print(f"Running predict_batch for {len(records)} records...")
    results = analyst.predict_batch(records)
    print("Success! Number of results:", len(results))
    print("Sample result:", results[0])
except Exception as e:
    print("Error during predict_batch test:")
    import traceback
    traceback.print_exc()
