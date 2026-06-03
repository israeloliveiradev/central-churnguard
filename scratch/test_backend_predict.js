const axios = require("axios");

const ML_ENGINE_URL = "http://127.0.0.1:5000";

const customerList = [
  {
    customerid: "TST-3615-CSV",
    customerID: "TST-3615-CSV",
    name: "Ana Souza",
    email: "ana.souza@exemplo.com",
    gender: "Female",
    SeniorCitizen: 0,
    Partner: "No",
    Dependents: "No",
    tenure: 20,
    PhoneService: "Yes",
    MultipleLines: "Yes",
    InternetService: "DSL",
    OnlineSecurity: "Yes",
    OnlineBackup: "No",
    DeviceProtection: "Yes",
    TechSupport: "No",
    StreamingTV: "No",
    StreamingMovies: "No",
    Contract: "Month-to-month",
    PaperlessBilling: "No",
    PaymentMethod: "Electronic check",
    MonthlyCharges: 83.92,
    TotalCharges: 1678.4,
    NumServices: 3,
    HasInternet: 1,
    HasSupport: 1,
    HasStreaming: 0,
    Churn: 0
  }
];

async function run() {
  try {
    console.log("Sending request to ML Engine...");
    const res = await axios.post(`${ML_ENGINE_URL}/predict-batch`, customerList);
    console.log("Response status:", res.status);
    console.log("Response data:", res.data);
  } catch (err) {
    console.error("Error connecting to ML Engine:");
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    } else {
      console.error(err.message);
    }
  }
}

run();
