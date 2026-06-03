import psycopg2
import os
from dotenv import load_dotenv
load_dotenv()

conn = psycopg2.connect(os.getenv("DATABASE_URL"))
cur = conn.cursor()

print("Checking TST- customers with -CSV:")
cur.execute("SELECT customerid, name, risk_pct FROM customers WHERE customerid LIKE 'TST-%-CSV'")
rows_csv = cur.fetchall()
print(f"Found {len(rows_csv)} customers with -CSV suffix.")
for row in rows_csv[:10]:
    print(f"ID: {row[0]}, Name: {row[1]}, Risk: {row[2]}%")

print("\nChecking TST- customers without -CSV:")
cur.execute("SELECT customerid, name, risk_pct FROM customers WHERE customerid LIKE 'TST-%' AND customerid NOT LIKE '%-CSV'")
rows_no_csv = cur.fetchall()
print(f"Found {len(rows_no_csv)} customers without -CSV suffix.")
for row in rows_no_csv[:10]:
    print(f"ID: {row[0]}, Name: {row[1]}, Risk: {row[2]}%")

cur.close()
conn.close()
