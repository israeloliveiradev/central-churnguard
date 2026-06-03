const { predictChurnJS } = require("../backend/src/utils/predictor");

const mockCustomer = {
  customerid: "8680-NEW",
  name: "Vagner Love",
  Contract: "Month-to-month",
  InternetService: "Fiber optic",
  PaymentMethod: "Electronic check",
  TechSupport: "No",
  OnlineSecurity: "No",
  tenure: 2,
  MonthlyCharges: 95.0
};

const prediction = predictChurnJS(mockCustomer);
console.log("Calculated local JS prediction:", JSON.stringify(prediction, null, 2));
