import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# URL 1: From local .env
env_db_url = os.environ.get("DATABASE_URL")
print(f"Testing URL 1 (from .env): {env_db_url[:40]}...[hidden]")
try:
    conn = psycopg2.connect(env_db_url, connect_timeout=5)
    print("SUCCESS: Connected to URL 1 (from .env)!")
    conn.close()
except Exception as e:
    print(f"FAILURE: Failed to connect to URL 1: {e}")

# URL 2: From Streamlit Secrets
secrets_db_url = "postgresql://postgres:dZdK65S66HMHLwCh@db.ybthgnbwhkbbovwumohs.supabase.co:5432/postgres"
print(f"\nTesting URL 2 (from Streamlit secrets): {secrets_db_url[:40]}...[hidden]")
try:
    conn = psycopg2.connect(secrets_db_url, connect_timeout=5)
    print("SUCCESS: Connected to URL 2 (from Streamlit secrets)!")
    conn.close()
except Exception as e:
    print(f"FAILURE: Failed to connect to URL 2: {e}")
