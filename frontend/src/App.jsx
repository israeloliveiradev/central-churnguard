import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import Customers from "./components/Customers";
import ChatConsole from "./components/ChatConsole";
import AgentTopology from "./components/AgentTopology";

// API Base configuration
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function App() {
  const [activeTab, setActiveTab] = useState("tab-overview");
  const [stats, setStats] = useState({
    total_customers: 0,
    average_risk: 0.0,
    high_risk_count: 0,
    total_alerts: 0,
  });
  const [alerts, setAlerts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [logs, setLogs] = useState([
    { time: "11:06:51", agent: "SYSTEM", message: "ChurnGuard React Frontend inicializado." },
    { time: "11:06:52", agent: "SYSTEM", message: "Conectado ao endpoint da API Napoleon." }
  ]);
  
  const [selectedCustomerID, setSelectedCustomerID] = useState(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15); // Show 15 rows for clean aesthetics
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // Log logger helper
  const addLog = (agent, message) => {
    const time = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    setLogs((prev) => [...prev, { time, agent, message }]);
  };

  // Toast notifier helper
  const triggerToast = (title, body) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, title, body }]);
    
    // Auto remove after 6s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  // Fetch Stats API
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      const data = await res.json();
      setStats(data);
      addLog("SYSTEM", "Métricas gerais de churn carregadas.");
    } catch (err) {
      console.error(err);
      addLog("SYSTEM", "Erro ao sincronizar estatísticas.");
    }
  };

  // Fetch Alerts Feed
  const fetchAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts`);
      const data = await res.json();
      setAlerts(data);
      addLog("SYSTEM", `Carregados ${data.length} alertas acionáveis.`);
    } catch (err) {
      console.error(err);
      addLog("SYSTEM", "Erro ao carregar o feed de alertas.");
    } finally {
      setLoadingAlerts(false);
    }
  };

  // Fetch Customers Base
  const fetchCustomers = async (searchVal = search, filterVal = filter, pageNum = page) => {
    setLoadingCustomers(true);
    try {
      const queryParams = new URLSearchParams({
        search: searchVal,
        filter: filterVal,
        page: pageNum.toString(),
        limit: limit.toString()
      });
      const res = await fetch(`${API_BASE}/api/customers?${queryParams}`);
      const data = await res.json();
      setCustomers(data.customers || []);
      setTotalCustomers(data.total || 0);
      setPage(data.page || 1);
      addLog("SYSTEM", `Carregada página ${data.page || 1} da base de clientes.`);
    } catch (err) {
      console.error(err);
      addLog("SYSTEM", "Erro ao sincronizar cadastro de clientes.");
    } finally {
      setLoadingCustomers(false);
    }
  };

  // Add single customer manual
  const handleAddCustomer = async (custData) => {
    try {
      const res = await fetch(`${API_BASE}/api/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(custData)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao cadastrar cliente.");
      }
      const newCustomer = await res.json();
      addLog("ANALYST", `Cliente ${newCustomer.name} cadastrado e avaliado pelo ML com risco ${newCustomer.risk_pct}%.`);
      triggerToast("Cliente Cadastrado!", `O cliente ${newCustomer.name} foi adicionado à base.`);
      
      // Refresh current data
      fetchStats();
      fetchCustomers(search, filter, page);
      return true;
    } catch (err) {
      console.error(err);
      triggerToast("Erro no Cadastro", err.message);
      return false;
    }
  };

  // CSV Batch Upload
  const handleCSVUpload = async (csvText) => {
    try {
      const res = await fetch(`${API_BASE}/api/customers/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao importar CSV.");
      }
      const result = await res.json();
      addLog("SYSTEM", `Importados ${result.count} clientes via CSV.`);
      triggerToast("Importação Concluída!", `${result.count} clientes importados e analisados com sucesso.`);
      
      // Refresh current data
      fetchStats();
      fetchCustomers(search, filter, 1); // Reset to page 1
      return true;
    } catch (err) {
      console.error(err);
      triggerToast("Erro na Importação", err.message);
      return false;
    }
  };

  // Fetch Chat Bot History
  const fetchChatHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/history`);
      const data = await res.json();
      setChatHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger manual cron scan
  const handleManualScan = async () => {
    setScanning(true);
    addLog("NOTIFIER", "Iniciando varredura ativa na base (Napoleon)...");
    
    try {
      const res = await fetch(`${API_BASE}/api/alerts/trigger-scan`, { method: "POST" });
      const data = await res.json();
      
      addLog("NOTIFIER", "Varredura concluída com sucesso.");
      addLog("ANALYST", "Inferências de regressão calculadas.");

      if (data.new_alerts_count > 0) {
        addLog("NOTIFIER", `⚠️ ATENÇÃO: Detectados ${data.new_alerts_count} clientes críticos!`);
        triggerToast("Novos riscos de Churn!", `Foram gerados ${data.new_alerts_count} novos alertas no feed.`);
      } else {
        addLog("NOTIFIER", "Nenhum novo risco crítico foi detectado.");
      }

      // Refresh
      fetchStats();
      fetchAlerts();
      fetchCustomers(search, filter, page);
    } catch (err) {
      console.error(err);
      addLog("NOTIFIER", "Erro de comunicação ao acionar scanner.");
    } finally {
      setScanning(false);
    }
  };

  // Send message to Agent_Interactivity
  const handleSendMessage = async (message) => {
    // Add locally immediately
    setChatHistory((prev) => [...prev, { message, sender: "user" }]);
    addLog("INTERACTIVITY", `Comando enviado: "${message}"`);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      
      setChatHistory((prev) => [...prev, { message: data.response, sender: "agent" }]);
      addLog("INTERACTIVITY", "Resposta do bot recebida.");
    } catch (err) {
      console.error(err);
      setChatHistory((prev) => [
        ...prev,
        { message: "❌ Falha ao se conectar com o Agent_Interactivity.", sender: "agent" },
      ]);
    }
  };

  const handleClearLogs = () => {
    setLogs([{ time: new Date().toLocaleTimeString("pt-BR", { hour12: false }), agent: "SYSTEM", message: "Logs limpos." }]);
  };

  // Toggle Tab title
  const getTabTitle = () => {
    switch (activeTab) {
      case "tab-overview": return "Painel Geral";
      case "tab-customers": return "Base de Clientes";
      case "tab-chat": return "Chat Reativo";
      case "tab-topology": return "Agentes e Logs";
      default: return "Dashboard";
    }
  };

  // On page startup
  useEffect(() => {
    fetchStats();
    fetchAlerts();
    fetchCustomers(search, filter, page);
    fetchChatHistory();
  }, []);

  const selectedCustomer = customers.find((c) => c.customerID === selectedCustomerID);

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <i className="fa-solid fa-shield-halved text-cyan" style={{ fontSize: "24px", filter: "drop-shadow(0 0 8px rgba(0, 240, 255, 0.4))" }}></i>
          </div>
          <div className="logo-text">
            <h2>Churn<span>Guard</span></h2>
            <span className="logo-sub">Multi-Agent Console</span>
          </div>
        </div>

        <nav className="sidebar-menu">
          <button
            className={`menu-btn ${activeTab === "tab-overview" ? "active" : ""}`}
            onClick={() => setActiveTab("tab-overview")}
          >
            <i className="fa-solid fa-chart-line"></i> Painel Geral
          </button>
          <button
            className={`menu-btn ${activeTab === "tab-customers" ? "active" : ""}`}
            onClick={() => setActiveTab("tab-customers")}
          >
            <i className="fa-solid fa-users"></i> Base de Clientes
          </button>
          <button
            className={`menu-btn ${activeTab === "tab-chat" ? "active" : ""}`}
            onClick={() => setActiveTab("tab-chat")}
          >
            <i className="fa-solid fa-comments"></i> Chat Reativo
          </button>
          <button
            className={`menu-btn ${activeTab === "tab-topology" ? "active" : ""}`}
            onClick={() => setActiveTab("tab-topology")}
          >
            <i className="fa-solid fa-network-wired"></i> Agentes e Logs
          </button>
        </nav>

        <div className="system-status-card">
          <div className="status-header">
            <span className="status-indicator online"></span>
            <h4>Sistema Ativo</h4>
          </div>
          <p>Conectado a Vercel, Napoleon e Supabase.</p>
          <div className="status-mini-metric">
            <span>Orquestrador: <strong>NodeJS Express</strong></span>
            <span>ML Engine: <strong>Python FastAPI</strong></span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Topbar Header */}
        <header className="top-header">
          <div className="header-search">
            <i className="fa-solid fa-hashtag text-muted"></i>
            <span className="breadcrumb">
              Central / Orquestrador / <span id="current-tab-title">{getTabTitle()}</span>
            </span>
          </div>
          <div className="header-actions">
            <button className="btn btn-scan" id="btn-manual-scan" onClick={handleManualScan} disabled={scanning}>
              {scanning ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i> Escaneando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-rotate"></i> Forçar Varredura (Notifier)
                </>
              )}
            </button>
            <div className="user-profile">
              <div className="profile-avatar">CS</div>
              <div className="profile-info">
                <h5>Gestor CS</h5>
                <span>Nível: Diretor</span>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Router Panels */}
        {activeTab === "tab-overview" && (
          <Dashboard
            stats={stats}
            alerts={alerts}
            loadingAlerts={loadingAlerts}
            onViewDetail={(id) => {
              setSelectedCustomerID(id);
              setActiveTab("tab-customers");
            }}
          />
        )}
        
        {activeTab === "tab-customers" && (
          <Customers
            customers={customers}
            loadingCustomers={loadingCustomers}
            onViewDetail={setSelectedCustomerID}
            selectedCustomer={selectedCustomer}
            onCloseModal={() => setSelectedCustomerID(null)}
            search={search}
            setSearch={setSearch}
            filter={filter}
            setFilter={setFilter}
            page={page}
            setPage={setPage}
            limit={limit}
            totalCustomers={totalCustomers}
            fetchCustomers={fetchCustomers}
            onAddCustomer={handleAddCustomer}
            onCSVUpload={handleCSVUpload}
          />
        )}
        
        {activeTab === "tab-chat" && (
          <ChatConsole
            chatHistory={chatHistory}
            onSendMessage={handleSendMessage}
          />
        )}
        
        {activeTab === "tab-topology" && (
          <AgentTopology
            logs={logs}
            onClearLogs={handleClearLogs}
          />
        )}
      </main>

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            <div>
              <i className="fa-solid fa-triangle-exclamation text-red" style={{ fontSize: "20px" }}></i>
            </div>
            <div>
              <strong style={{ display: "block", marginBottom: "2px" }}>{toast.title}</strong>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{toast.body}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
