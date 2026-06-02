const axios = require("axios");
const { executeQuery, usePostgres } = require("../config/db");

class AgentNotifier {
  generateRecommendation(customer, riskFactors) {
    const contract = customer.Contract || customer.contract;
    const internet = customer.InternetService || customer.internetservice;
    const support = customer.TechSupport || customer.techsupport;
    const security = customer.OnlineSecurity || customer.onlinesecurity;
    const monthlyCharges = customer.MonthlyCharges || customer.monthlycharges || 0;
    const tenure = customer.tenure || 0;

    if (contract === "Month-to-month") {
      return "Oferecer migração para o Contrato Anual com 15% de desconto nas primeiras 6 parcelas para garantir a fidelização.";
    }

    if (internet === "Fiber optic" && monthlyCharges > 80) {
      return "Oferecer migração para um plano de internet DSL mais econômico ou aplicar desconto de fidelidade temporário na fibra óptica.";
    }

    if (support === "No" || security === "No") {
      return "Oferecer inclusão gratuita do pacote de Suporte Técnico Avançado e Segurança Online por 3 meses para elevar a percepção de valor.";
    }

    if (tenure < 6) {
      return "Realizar contato de onboarding imediato via Customer Success para identificar dificuldades iniciais na plataforma.";
    }

    return "Agendar um check-in de saúde operacional (QBR) com o gestor do cliente para realinhar objetivos e revisar a contratação.";
  }

  async scanBase(mlEngineUrl) {
    console.log("Agent_Notifier: Starting active scan...");
    const url = `${mlEngineUrl}/predict-batch`;

    try {
      // 1. Fetch all customers from database (only new ones)
      const res = await executeQuery("SELECT * FROM customers WHERE customerid LIKE '%-NEW' OR customerid LIKE '%-CSV'");
      const customers = res.rows;
      
      if (customers.length === 0) {
        console.log("Agent_Notifier: No customers found to scan.");
        return [];
      }

      // 2. Fetch all existing alerts to avoid duplicate notifications (1 single query in memory)
      const alertCheck = await executeQuery("SELECT DISTINCT customerid FROM alerts");
      const existingAlerts = new Set(alertCheck.rows.map(r => r.customerid || r.customerID));

      // 3. Request batch predictions from Python FastAPI ML engine (1 single HTTP request)
      console.log(`Agent_Notifier: Sending batch prediction request for ${customers.length} customers...`);
      const response = await axios.post(url, customers);
      const predictions = response.data; // List of predictions matching the customer list order
      
      // 4. Batch database updates for customers' risk score and factors
      if (usePostgres) {
        // High-performance bulk update for PostgreSQL (Supabase)
        const updateBatchSize = 1000;
        for (let i = 0; i < predictions.length; i += updateBatchSize) {
          const chunk = predictions.slice(i, i + updateBatchSize);
          const valuePlaceholders = [];
          const values = [];
          let pIndex = 1;
          
          for (const pred of chunk) {
            const cid = pred.customerid;
            const riskPct = pred.risk_pct;
            const riskFactors = JSON.stringify(pred.risk_factors || []);
            const protFactors = JSON.stringify(pred.protection_factors || []);
            
            valuePlaceholders.push(`($${pIndex++}, $${pIndex++}::real, $${pIndex++}::jsonb, $${pIndex++}::jsonb)`);
            values.push(cid, riskPct, riskFactors, protFactors);
          }
          
          const bulkUpdateQuery = `
            UPDATE customers AS c SET
              risk_pct = val.risk_pct,
              risk_factors = val.risk_factors,
              protection_factors = val.protection_factors
            FROM (VALUES ${valuePlaceholders.join(", ")}) AS val(customerid, risk_pct, risk_factors, protection_factors)
            WHERE c.customerid = val.customerid
          `;
          
          await executeQuery(bulkUpdateQuery, values);
        }
      } else {
        // Fallback for Local JSON DB (serial updates, safe because local dataset is small)
        for (const pred of predictions) {
          await executeQuery(
            `UPDATE customers 
             SET risk_pct = $1, risk_factors = $2, protection_factors = $3 
             WHERE customerid = $4`,
            [pred.risk_pct, JSON.stringify(pred.risk_factors || []), JSON.stringify(pred.protection_factors || []), pred.customerid]
          );
        }
      }
      
      console.log("Agent_Notifier: Database risk scores and factors updated.");

      // 5. Identify and batch insert new alerts
      const newAlerts = [];
      const newAlertsValues = [];
      let insertIndex = 1;
      const insertPlaceholders = [];

      for (let i = 0; i < customers.length; i++) {
        const cust = customers[i];
        const pred = predictions[i];
        const riskPct = pred.risk_pct;
        const customerID = cust.customerid || cust.customerID;
        const name = cust.name;
        
        if (riskPct > 65.0 && !existingAlerts.has(customerID)) {
          const recommendation = this.generateRecommendation(cust, pred.risk_factors);
          const factorsStr = (pred.risk_factors || []).map(f => `* ${f}`).join("\n");
          
          const alertMessage = 
`⚠️ **Alerta de Churn Guard!**
O cliente **${name}** atingiu **${riskPct}% de risco de cancelamento**.

🕵️ **Principais fatores de risco (SHAP):**
${factorsStr}

💡 *Ação de retenção recomendada:* ${recommendation}`;

          newAlerts.push({
            customerid: customerID,
            customername: name,
            risk_pct: riskPct,
            message: alertMessage
          });
          
          insertPlaceholders.push(`($${insertIndex++}, $${insertIndex++}, $${insertIndex++}, $${insertIndex++})`);
          newAlertsValues.push(customerID, name, riskPct, alertMessage);
          
          console.log(`Agent_Notifier: Triggered churn alert for customer ${name} (${riskPct}%)`);
        }
      }

      if (newAlerts.length > 0) {
        const bulkInsertQuery = `
          INSERT INTO alerts (customerid, customername, risk_pct, message)
          VALUES ${insertPlaceholders.join(", ")}
        `;
        await executeQuery(bulkInsertQuery, newAlertsValues);
        console.log(`Agent_Notifier: Inserted ${newAlerts.length} new alerts.`);
      }

      console.log(`Agent_Notifier: Active scan completed. Generated ${newAlerts.length} new alerts.`);
      return newAlerts;

    } catch (err) {
      console.error("Agent_Notifier: Scan failed:", err.message);
      throw err;
    }
  }
}

module.exports = new AgentNotifier();
