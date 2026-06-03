import random
import csv
import os

headers = [
    "customerID", "name", "email", "gender", "SeniorCitizen", "Partner", "Dependents", "tenure",
    "PhoneService", "MultipleLines", "InternetService", "OnlineSecurity", "OnlineBackup",
    "DeviceProtection", "TechSupport", "StreamingTV", "StreamingMovies", "Contract",
    "PaperlessBilling", "PaymentMethod", "MonthlyCharges", "TotalCharges"
]

first_names_male = ["Carlos", "André", "Lucas", "Eduardo", "Thiago", "Bruno", "Gabriel", "Marcos", "Rafael", "Rodrigo", "Felipe", "Matheus", "Daniel", "Gustavo", "Vinicius"]
first_names_female = ["Ana", "Beatriz", "Gabriela", "Patricia", "Camila", "Mariana", "Juliana", "Amanda", "Letícia", "Larissa", "Fernanda", "Bruna", "Aline", "Jéssica", "Vanessa"]
surnames = ["Silva", "Souza", "Lima", "Pereira", "Alves", "Santos", "Costa", "Oliveira", "Rodrigues", "Gomes", "Martins", "Araujo", "Carvalho", "Melo", "Barbosa"]

rows = []
used_ids = set()

# Generate 50 unique high-risk customer records
for i in range(50):
    while True:
        # High-risk IDs starting with TST-H
        cid = f"TST-H{random.randint(1000, 9999)}"
        if cid not in used_ids:
            used_ids.add(cid)
            break
            
    is_male = random.choice([True, False])
    gender = "Male" if is_male else "Female"
    first = random.choice(first_names_male) if is_male else random.choice(first_names_female)
    last = random.choice(surnames)
    name = f"{first} {last}"
    
    clean_first = first.lower().replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    clean_last = last.lower().replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    email = f"{clean_first}.{clean_last}{random.randint(1, 99)}@exemplo.com"
    
    # High-Risk Churn Features:
    # 1. Higher senior citizen ratio
    senior = 1 if random.random() < 0.40 else 0
    # 2. Mostly no partner/dependents (less sticky)
    partner = "No" if random.random() < 0.7 else "Yes"
    dependents = "No" if random.random() < 0.8 else "Yes"
    # 3. Very low tenure (1 to 6 months)
    tenure = random.randint(1, 6)
    # 4. Fiber optic internet (statistically correlated with higher churn in Telco)
    internet = "Fiber optic"
    # 5. Lack of security addons (no online security, no advanced tech support)
    security = "No"
    support = "No"
    
    # Phone service with multiple lines is common
    phone = "Yes"
    multiple_lines = "Yes" if random.random() < 0.6 else "No"
    
    # Other features
    backup = "No" if random.random() < 0.7 else "Yes"
    device = "No" if random.random() < 0.7 else "Yes"
    tv = "Yes" if random.random() < 0.6 else "No"
    movies = "Yes" if random.random() < 0.6 else "No"
    
    # 6. Contract is month-to-month (very easy to drop)
    contract = "Month-to-month"
    # 7. Paperless billing & Electronic check payment (highly associated with churn)
    paperless = "Yes"
    pay = "Electronic check"
    
    # 8. High Monthly Charges (Fiber base of 70 + addons)
    base_charge = 80.0
    addons = [backup, device, tv, movies]
    monthly_charges = base_charge + sum(6.0 for a in addons if a == "Yes")
    monthly_charges = round(monthly_charges + random.uniform(-3.0, 5.0), 2)
    
    # Coherent total charges
    total_charges = round(monthly_charges * tenure, 2)
    
    rows.append([
        cid, name, email, gender, senior, partner, dependents, tenure,
        phone, multiple_lines, internet, security, backup, device, support,
        tv, movies, contract, paperless, pay, monthly_charges, total_charges
    ])

output_path = os.path.join(os.path.dirname(__file__), "..", "test_customers_high_risk_50.csv")
with open(output_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(headers)
    writer.writerows(rows)

print(f"Generated 50 high-risk customer records successfully in {output_path}!")
