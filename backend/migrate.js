const axios = require("axios");
const { executeQuery, initDatabase, usePostgres } = require("./src/config/db");

// URL do dataset Telco Customer Churn público hospedado no GitHub
const DATASET_URL = "https://raw.githubusercontent.com/treselle-systems/customer_churn_analysis/master/WA_Fn-UseC_-Telco-Customer-Churn.csv";

const surnames = [
  "Oliveira", "Santos", "Souza", "Silva", "Costa", "Lima", "Mendes", "Rocha", "Pinto", "Almeida",
  "Gomes", "Ribeiro", "Carvalho", "Melo", "Barbosa", "Cardoso", "Teixeira", "Cavalcanti", "Dias", "Moreira"
];
const firstM = [
  "Gabriel", "Lucas", "Mateus", "Pedro", "João", "Guilherme", "Gustavo", "Felipe", "Rafael", "Daniel",
  "Thiago", "Bruno", "Rodrigo", "André", "Leonardo", "Marcos", "Ricardo", "Eduardo", "Alexandre", "Vitor"
];
const firstF = [
  "Maria", "Ana", "Beatriz", "Letícia", "Larissa", "Amanda", "Camila", "Bruna", "Juliana", "Mariana",
  "Gabriela", "Isabela", "Luana", "Fernanda", "Carolina", "Aline", "Júlia", "Patricia", "Camila", "Sofia"
];

function generateProfile(gender) {
  const isMale = gender === "Male";
  const name = isMale 
    ? `${firstM[Math.floor(Math.random() * firstM.length)]} ${surnames[Math.floor(Math.random() * surnames.length)]}`
    : `${firstF[Math.floor(Math.random() * firstF.length)]} ${surnames[Math.floor(Math.random() * surnames.length)]}`;
  
  // Normalizar e remover acentos para o e-mail
  const cleanName = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ /g, ".");
    
  const email = `${cleanName}@example.com`;
  return { name, email };
}

function parseCSV(csvText) {
  const lines = [];
  let currentLine = [];
  let currentVal = "";
  let inQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // pular próxima aspa
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentLine.push(currentVal.trim());
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentLine.push(currentVal.trim());
      if (currentLine.length > 1 || currentLine[0] !== "") {
        lines.push(currentLine);
      }
      currentLine = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  if (currentVal || currentLine.length > 0) {
    currentLine.push(currentVal.trim());
    if (currentLine.length > 1 || currentLine[0] !== "") {
      lines.push(currentLine);
    }
  }
  return lines;
}

async function insertBatch(batch) {
  const placeholders = [];
  const values = [];
  let paramIdx = 1;
  
  for (const row of batch) {
    const rowPlaceholders = [];
    for (let i = 0; i < 27; i++) {
      rowPlaceholders.push(`$${paramIdx++}`);
    }
    placeholders.push(`(${rowPlaceholders.join(", ")})`);
    values.push(...row);
  }
  
  const query = `
    INSERT INTO customers (
      customerid, name, email, gender, SeniorCitizen, Partner, Dependents, tenure,
      PhoneService, MultipleLines, InternetService, OnlineSecurity, OnlineBackup,
      DeviceProtection, TechSupport, StreamingTV, StreamingMovies, Contract,
      PaperlessBilling, PaymentMethod, MonthlyCharges, TotalCharges, NumServices,
      HasInternet, HasSupport, HasStreaming, Churn
    ) VALUES ${placeholders.join(", ")}
  `;
  
  await executeQuery(query, values);
}

async function run() {
  if (!usePostgres) {
    console.error("❌ ERRO: DATABASE_URL não está configurada no seu arquivo .env!");
    console.error("Por favor, configure sua conexão do Supabase e tente novamente.");
    process.exit(1);
  }

  console.log("🔄 Inicializando tabelas do banco de dados no Supabase...");
  await initDatabase();

  console.log("📥 Fazendo o download do dataset Telco Customer Churn...");
  let csvText;
  try {
    const response = await axios.get(DATASET_URL);
    csvText = response.data;
    console.log("✅ Download concluído com sucesso!");
  } catch (err) {
    console.error("❌ Falha ao fazer download do CSV:", err.message);
    process.exit(1);
  }

  console.log("Parsing CSV...");
  const records = parseCSV(csvText);
  
  // Remover a linha de cabeçalho
  const header = records.shift();
  console.log(`📊 Encontrados ${records.length} registros para processar.`);

  console.log("🧹 Limpando dados antigos na tabela de clientes do Supabase...");
  await executeQuery("TRUNCATE TABLE customers RESTART IDENTITY CASCADE");
  console.log("✅ Tabela 'customers' limpa!");

  console.log("🚀 Iniciando migração dos dados...");
  
  const batchSize = 100;
  let batch = [];
  let processed = 0;

  for (const record of records) {
    if (record.length < 21) {
      continue; // Ignorar linhas incompletas
    }

    const [
      customerID, gender, SeniorCitizen, Partner, Dependents, tenureStr,
      PhoneService, MultipleLines, InternetService, OnlineSecurity, OnlineBackup,
      DeviceProtection, TechSupport, StreamingTV, StreamingMovies, Contract,
      PaperlessBilling, PaymentMethod, MonthlyChargesStr, TotalChargesStr, ChurnStr
    ] = record;

    const senior = parseInt(SeniorCitizen) || 0;
    const tenure = parseInt(tenureStr) || 0;
    const monthlyCharges = parseFloat(MonthlyChargesStr) || 0.0;
    
    // TotalCharges pode ter espaços em branco no CSV para novos clientes (tenure = 0)
    let totalCharges = parseFloat(TotalChargesStr);
    if (isNaN(totalCharges)) {
      totalCharges = monthlyCharges * tenure;
    }

    // Gerar perfil sintético de nome e e-mail baseado no gênero
    const { name, email } = generateProfile(gender);

    // Calcular features adicionais
    const services = [PhoneService, MultipleLines, InternetService, OnlineSecurity, OnlineBackup, DeviceProtection, TechSupport, StreamingTV, StreamingMovies];
    const numServices = services.filter(v => v !== "No" && v !== "No internet service" && v !== "No phone service").length;
    const hasInternet = InternetService !== "No" ? 1 : 0;
    const hasSupport = (OnlineSecurity === "Yes" || TechSupport === "Yes") ? 1 : 0;
    const hasStreaming = (StreamingTV === "Yes" || StreamingMovies === "Yes") ? 1 : 0;
    const churn = ChurnStr === "Yes" ? 1 : 0;

    const rowData = [
      customerID, name, email, gender, senior, Partner, Dependents, tenure,
      PhoneService, MultipleLines, InternetService, OnlineSecurity, OnlineBackup,
      DeviceProtection, TechSupport, StreamingTV, StreamingMovies, Contract,
      PaperlessBilling, PaymentMethod, monthlyCharges, totalCharges, numServices,
      hasInternet, hasSupport, hasStreaming, churn
    ];

    batch.push(rowData);
    processed++;

    if (batch.length === batchSize) {
      await insertBatch(batch);
      console.log(`   ├── Progresso: ${processed}/${records.length} clientes migrados...`);
      batch = [];
    }
  }

  // Inserir registros restantes
  if (batch.length > 0) {
    await insertBatch(batch);
  }

  console.log(`🎉 Migração finalizada com sucesso! Total de ${processed} clientes importados para o Supabase.`);
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Ocorreu um erro crítico durante a migração:", err.message);
  process.exit(1);
});
