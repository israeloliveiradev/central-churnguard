import random
import csv
import os

# Field structures matching the Telco Churn CSV schema
headers = [
    "customerID", "name", "email", "gender", "SeniorCitizen", "Partner", "Dependents", "tenure",
    "PhoneService", "MultipleLines", "InternetService", "OnlineSecurity", "OnlineBackup",
    "DeviceProtection", "TechSupport", "StreamingTV", "StreamingMovies", "Contract",
    "PaperlessBilling", "PaymentMethod", "MonthlyCharges", "TotalCharges"
]

first_names_male = ["Carlos", "André", "Lucas", "Eduardo", "Thiago", "Bruno", "Gabriel", "Marcos", "Rafael", "Rodrigo", "Felipe", "Matheus", "Daniel", "Gustavo", "Vinicius"]
first_names_female = ["Ana", "Beatriz", "Gabriela", "Patricia", "Camila", "Mariana", "Juliana", "Amanda", "Letícia", "Larissa", "Fernanda", "Bruna", "Aline", "Jéssica", "Vanessa"]
surnames = ["Silva", "Souza", "Lima", "Pereira", "Alves", "Santos", "Costa", "Oliveira", "Rodrigues", "Gomes", "Martins", "Araujo", "Carvalho", "Melo", "Barbosa"]

internet_services = ["DSL", "Fiber optic", "No"]
contracts = ["Month-to-month", "One year", "Two year"]
payment_methods = ["Electronic check", "Mailed check", "Credit card (automatic)", "Bank transfer (automatic)"]

rows = []
used_ids = set()

# Generate 100 unique customer records
for i in range(100):
    # Generate unique ID
    while True:
        cid = f"TST-{random.randint(1000, 9999)}"
        if cid not in used_ids:
            used_ids.add(cid)
            break
            
    is_male = random.choice([True, False])
    gender = "Male" if is_male else "Female"
    first = random.choice(first_names_male) if is_male else random.choice(first_names_female)
    last = random.choice(surnames)
    name = f"{first} {last}"
    
    # Remove accents for email standard
    clean_first = first.lower().replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    clean_last = last.lower().replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    email = f"{clean_first}.{clean_last}{random.randint(1, 99)}@exemplo.com"
    
    senior = 1 if random.random() < 0.15 else 0
    partner = "Yes" if random.random() < 0.5 else "No"
    dependents = "Yes" if random.random() < 0.3 else "No"
    
    tenure = random.randint(1, 72)
    phone = "Yes" if random.random() < 0.9 else "No"
    
    if phone == "Yes":
        multiple_lines = "Yes" if random.random() < 0.4 else "No"
    else:
        multiple_lines = "No phone service"
        
    internet = random.choice(internet_services)
    
    if internet != "No":
        security = "Yes" if random.random() < 0.4 else "No"
        backup = "Yes" if random.random() < 0.4 else "No"
        device = "Yes" if random.random() < 0.4 else "No"
        support = "Yes" if random.random() < 0.4 else "No"
        tv = "Yes" if random.random() < 0.5 else "No"
        movies = "Yes" if random.random() < 0.5 else "No"
        
        # Fiber is more expensive
        base_charge = 70.0 if internet == "Fiber optic" else 45.0
        # Add up services cost
        addons = [security, backup, device, support, tv, movies]
        monthly_charges = base_charge + sum(5.0 for a in addons if a == "Yes")
    else:
        security = backup = device = support = tv = movies = "No internet service"
        monthly_charges = 20.0  # Base line phone cost
        
    # Apply random float variation to monthly charges
    monthly_charges = round(monthly_charges + random.uniform(-5.0, 5.0), 2)
    
    # Coherent total charges
    total_charges = round(monthly_charges * tenure, 2)
    
    contract = random.choice(contracts)
    paperless = "Yes" if random.random() < 0.6 else "No"
    pay = random.choice(payment_methods)
    
    rows.append([
        cid, name, email, gender, senior, partner, dependents, tenure,
        phone, multiple_lines, internet, security, backup, device, support,
        tv, movies, contract, paperless, pay, monthly_charges, total_charges
    ])

output_path = os.path.join(os.path.dirname(__file__), "..", "test_customers_100.csv")
with open(output_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(headers)
    writer.writerows(rows)

print(f"Generated 100 customer records successfully in {output_path}!")
