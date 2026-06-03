import urllib.request
import json

try:
    print("Fetching customers from backend API...")
    url = "http://127.0.0.1:8000/api/customers?limit=100"
    res = urllib.request.urlopen(url, timeout=2).read()
    data = json.loads(res.decode('utf-8'))
    
    customers = data.get("customers", [])
    print(f"Received {len(customers)} customers.")
    tst_customers = [c for c in customers if "customerID" in c and c["customerID"].startswith("TST-")]
    
    print(f"Found {len(tst_customers)} TST- customers in API response:")
    for c in tst_customers:
        print(f"ID: {c.get('customerID')}, Name: {c.get('name')}, Risk: {c.get('risk_pct')}%")
except Exception as e:
    print("Error calling backend API:", e)
