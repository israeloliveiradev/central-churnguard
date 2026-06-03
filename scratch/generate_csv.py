import pandas as pd
import numpy as np
import random

# Seed for reproducibility
random.seed(42)
np.random.seed(42)

# Names and emails
male_names = ["Carlos Silva", "Bruno Santos", "Gabriel Oliveira", "Eduardo Souza", "Lucas Pereira", 
              "Thiago Costa", "Rodrigo Lima", "Rafael Rodrigues", "André Alves", "Mateus Rocha"]
female_names = ["Ana Souza", "Beatriz Lima", "Camila Santos", "Daniela Rocha", "Fernanda Costa", 
                "Gabriela Silva", "Juliana Oliveira", "Larissa Pereira", "Mariana Alves", "Patricia Rodrigues"]

payment_methods = ["Electronic check", "Mailed check", "Bank transfer (automatic)", "Credit card (automatic)"]
contracts = ["Month-to-month", "One year", "Two year"]
internet_services = ["DSL", "Fiber optic", "No"]
yes_no = ["Yes", "No"]
genders = ["Male", "Female"]

rows = []
for i in range(1, 21):
    gender = random.choice(genders)
    if gender == "Male":
        name = random.choice(male_names)
    else:
        name = random.choice(female_names)
    
    email = f"{name.lower().replace(' ', '.')}@exemplo.com"
    
    cust_id = f"TST-{random.randint(1000, 9999)}"
    senior = 1 if random.random() < 0.15 else 0
    partner = random.choice(yes_no)
    dependents = random.choice(yes_no)
    tenure = random.randint(1, 72)
    
    phone = "Yes" if random.random() < 0.9 else "No"
    if phone == "Yes":
        multiple = random.choice(["No", "Yes"])
    else:
        multiple = "No phone service"
        
    internet = random.choice(internet_services)
    if internet != "No":
        security = random.choice(yes_no)
        backup = random.choice(yes_no)
        device_prot = random.choice(yes_no)
        tech_support = random.choice(yes_no)
        tv = random.choice(yes_no)
        movies = random.choice(yes_no)
    else:
        security = "No internet service"
        backup = "No internet service"
        device_prot = "No internet service"
        tech_support = "No internet service"
        tv = "No internet service"
        movies = "No internet service"
        
    contract = random.choice(contracts)
    paperless = random.choice(yes_no)
    payment = random.choice(payment_methods)
    
    # Generate realistic monthly charges
    if internet == "No":
        monthly = round(random.uniform(18.0, 25.0), 2)
    elif internet == "DSL":
        monthly = round(random.uniform(45.0, 85.0), 2)
    else: # Fiber optic
        monthly = round(random.uniform(70.0, 118.0), 2)
        
    # Calculate Total Charges
    total = round(monthly * tenure, 2)
    
    rows.append({
        "customerID": cust_id,
        "name": name,
        "email": email,
        "gender": gender,
        "SeniorCitizen": senior,
        "Partner": partner,
        "Dependents": dependents,
        "tenure": tenure,
        "PhoneService": phone,
        "MultipleLines": multiple,
        "InternetService": internet,
        "OnlineSecurity": security,
        "OnlineBackup": backup,
        "DeviceProtection": device_prot,
        "TechSupport": tech_support,
        "StreamingTV": tv,
        "StreamingMovies": movies,
        "Contract": contract,
        "PaperlessBilling": paperless,
        "PaymentMethod": payment,
        "MonthlyCharges": monthly,
        "TotalCharges": total
    })

df = pd.DataFrame(rows)
df.to_csv("e:/Workspace/central-churnguard/test_customers.csv", index=False)
print("CSV generated successfully!")
