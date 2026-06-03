import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

env_db_url = os.environ.get("DATABASE_URL")
print(f"Connecting to: {env_db_url[:40]}...[hidden]")

try:
    conn = psycopg2.connect(env_db_url, connect_timeout=5)
    cursor = conn.cursor()
    
    # List all tables
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    """)
    tables = cursor.fetchall()
    print("\nTables found in 'public' schema:")
    for t in tables:
        print(f"- {t[0]}")
        
    # Check if customers exists and get count
    if any(t[0] == 'customers' for t in tables):
        cursor.execute("SELECT COUNT(*) FROM customers")
        count = cursor.fetchone()[0]
        print(f"\nSUCCESS: 'customers' table exists with {count} rows.")
    else:
        print("\nWARNING: 'customers' table DOES NOT exist!")
        
    conn.close()
except Exception as e:
    print(f"ERROR: {e}")
