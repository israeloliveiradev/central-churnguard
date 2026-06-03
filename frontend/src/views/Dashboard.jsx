import { useState } from "react";

export default function Dashboard({ stats, alerts, loadingAlerts, onViewDetail }) {
  const [expandedAlerts, setExpandedAlerts] = useState({});
  const [alertSearch, setAlertSearch] = useState("");
  const [alertRiskFilter, setAlertRiskFilter] = useState("all");

  const toggleAlert = (id) => {
    setExpandedAlerts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Utility to parse basic markdown inside alerts and convert emojis to sleek icons
  const formatMarkdownText = (text) => {
    if (!text) return { __html: "" };
    
    // Escape HTML to prevent XSS
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    // Replace bold/italic symbols
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Replace emojis with FontAwesome icons
    escaped = escaped.replace(/⚠️/g, '<i class="fa-solid fa-triangle-exclamation text-red" style="margin-right: 6px;"></i>');
    escaped = escaped.replace(/🕵️/g, '<i class="fa-solid fa-magnifying-glass-chart text-cyan" style="margin-right: 6px;"></i>');
    escaped = escaped.replace(/💡/g, '<i class="fa-solid fa-lightbulb text-orange" style="margin-right: 6px;"></i>');
    escaped = escaped.replace(/🛡️/g, '<i class="fa-solid fa-shield-halved text-cyan" style="margin-right: 6px;"></i>');

    // Split lines to build clean lists and paragraphs
    const lines = escaped.split("\n");
    let html = "";
    let inList = false;

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        continue;
      }

      // Check if it's a list item starting with * or -
      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        if (!inList) {
          html += '<ul class="shap-list">';
          inList = true;
        }
        const bulletText = trimmed.startsWith("* ") ? trimmed.substring(2) : trimmed.substring(2);
        html += `<li>${bulletText}</li>`;
      } else {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        html += `<p class="alert-line">${trimmed}</p>`;
      }
    }
    if (inList) {
      html += "</ul>";
    }

    return { __html: html };
  };

  const highRiskPct = stats.total_customers > 0 
    ? ((stats.high_risk_count / stats.total_customers) * 100).toFixed(1)
    : "0.0";

  // Filter alerts by search terms and risk levels
  const filteredAlerts = (alerts || []).filter((alert) => {
    const matchesSearch = 
      (alert.customername || "").toLowerCase().includes(alertSearch.toLowerCase()) ||
      (alert.customerid || "").toLowerCase().includes(alertSearch.toLowerCase());
    
    const risk = parseFloat(alert.risk_pct || 0);
    let matchesRisk = true;
    if (alertRiskFilter === "critical") {
      matchesRisk = risk >= 80.0;
    } else if (alertRiskFilter === "high") {
      matchesRisk = risk >= 65.0;
    }
    
    return matchesSearch && matchesRisk;
  });

  const allExpanded = filteredAlerts.length > 0 && filteredAlerts.every(a => !!expandedAlerts[a.id || a.created_at]);

  const toggleExpandAll = () => {
    if (allExpanded) {
      const newExpanded = { ...expandedAlerts };
      filteredAlerts.forEach(a => {
        newExpanded[a.id || a.created_at] = false;
      });
      setExpandedAlerts(newExpanded);
    } else {
      const newExpanded = { ...expandedAlerts };
      filteredAlerts.forEach(a => {
        newExpanded[a.id || a.created_at] = true;
      });
      setExpandedAlerts(newExpanded);
    }
  };

  return (
    <div className="tab-pane">
      {/* Analytics Cards Grid */}
      <div className="metrics-grid">
        <div className="metric-card bg-gradient-cyan">
          <div className="card-icon"><i className="fa-solid fa-users"></i></div>
          <div className="card-data">
            <span className="card-label">Clientes Analisados</span>
            <h3>{stats.total_customers ?? "--"}</h3>
            <span className="card-trend text-cyan">
              <i className="fa-solid fa-circle-check"></i> 100% da base ativa
            </span>
          </div>
        </div>
        
        <div className="metric-card bg-gradient-red">
          <div className="card-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
          <div className="card-data">
            <span className="card-label">Clientes Críticos (&gt;65%)</span>
            <h3>{stats.high_risk_count ?? "--"}</h3>
            <span className="card-trend text-red">
              <i className="fa-solid fa-arrow-trend-up"></i> {highRiskPct}% da base
            </span>
          </div>
        </div>

        <div className="metric-card bg-gradient-orange">
          <div className="card-icon"><i className="fa-solid fa-chart-pie"></i></div>
          <div className="card-data">
            <span className="card-label">Risco Médio de Churn</span>
            <h3>{stats.average_risk ?? "--"}%</h3>
            <span className="card-trend text-orange">
              <i className="fa-solid fa-gauge-high"></i> Risco moderado
            </span>
          </div>
        </div>

        <div className="metric-card bg-gradient-purple">
          <div className="card-icon"><i className="fa-solid fa-bell"></i></div>
          <div className="card-data">
            <span className="card-label">Alertas Disparados</span>
            <h3>{stats.total_alerts ?? "--"}</h3>
            <span className="card-trend text-purple">
              <i className="fa-solid fa-clock-rotate-left"></i> Histórico total
            </span>
          </div>
        </div>
      </div>

      {/* Main Section Grid */}
      <div className="content-grid-two">
        {/* Notifications Feed Card */}
        <div className="glass-card panel-alerts">
          <div className="card-header-bar" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "10px" }}>
              <div className="header-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <i className="fa-solid fa-bell text-red"></i>
                <h3 style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>Alertas Ativos</h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="badge badge-red">{filteredAlerts.length} de {alerts.length}</span>
                <button 
                  className="btn btn-secondary btn-xs"
                  onClick={toggleExpandAll}
                  style={{ minHeight: "28px", height: "28px", padding: "0 10px" }}
                >
                  <i className={`fa-solid ${allExpanded ? "fa-compress" : "fa-expand"}`}></i> {allExpanded ? "Recolher" : "Expandir"}
                </button>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "8px", width: "100%", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Buscar por cliente ou ID..."
                value={alertSearch}
                onChange={(e) => setAlertSearch(e.target.value)}
                style={{
                  flexGrow: 1,
                  padding: "6px 12px",
                  fontSize: "12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-card)",
                  background: "var(--bg-panel-inner)",
                  color: "var(--text-primary)",
                  minWidth: "150px"
                }}
              />
              <select
                value={alertRiskFilter}
                onChange={(e) => setAlertRiskFilter(e.target.value)}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-card)",
                  background: "var(--bg-panel-inner)",
                  color: "var(--text-primary)"
                }}
              >
                <option value="all">Todos os riscos</option>
                <option value="critical">Crítico (&gt;80%)</option>
                <option value="high">Alto (&gt;65%)</option>
              </select>
            </div>
          </div>
          <div className="alerts-feed-container" id="alerts-feed">
            {loadingAlerts ? (
              <div className="loading-spinner">
                <i className="fa-solid fa-circle-notch fa-spin"></i> Carregando alertas...
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center text-muted" style={{ padding: "40px 0" }}>
                {alerts.length === 0 ? "Nenhum alerta crítico registrado." : "Nenhum alerta atende aos filtros."}
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const isExpanded = !!expandedAlerts[alert.id || alert.created_at];
                return (
                  <div 
                    className={`alert-item-card ${isExpanded ? "expanded" : ""}`} 
                    key={alert.id || alert.created_at}
                    onClick={() => toggleAlert(alert.id || alert.created_at)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="alert-card-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                      <div className="alert-card-title text-red" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          className="status-indicator"
                          style={{
                            backgroundColor: "var(--color-primary)",
                            boxShadow: "0 0 6px var(--color-primary)",
                            display: "inline-block"
                          }}
                        ></span>
                        <strong>{alert.risk_pct}%</strong>
                        <span className="text-muted" style={{ fontSize: "11px", fontWeight: "normal" }}>({alert.customerid})</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{alert.customername}</span>
                        <span className="alert-card-time" style={{ fontSize: "11px", color: "var(--color-muted)" }}>
                          <i className="fa-solid fa-clock" style={{ marginRight: "4px" }}></i>
                          {new Date(alert.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <i className={`fa-solid ${isExpanded ? "fa-chevron-up" : "fa-chevron-down"}`} style={{ fontSize: "11px", color: "var(--color-muted)" }}></i>
                      </div>
                    </div>
                    {isExpanded && (
                      <div
                        className="alert-card-body"
                        style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border-card)", width: "100%" }}
                        dangerouslySetInnerHTML={formatMarkdownText(alert.message)}
                        onClick={(e) => e.stopPropagation()} // Stop collapse click bubble-up
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Risk Customers */}
        <div className="glass-card panel-top-risk">
          <div className="card-header">
            <div className="header-title">
              <i className="fa-solid fa-skull-crossbones text-orange"></i>
              <h3>Principais Focos de Churn</h3>
            </div>
          </div>
          <div className="top-risk-list">
            {alerts.slice(0, 6).map((alert) => (
              <div
                className="risk-customer-row"
                key={alert.id || alert.customerid}
                onClick={() => onViewDetail(alert.customerid)}
              >
                <div className="customer-row-info">
                  <span className="customer-row-name">{alert.customername}</span>
                  <span className="customer-row-contract">
                    ID: {alert.customerid}
                  </span>
                </div>
                <div className="risk-score-badge high">{alert.risk_pct}%</div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="text-center text-muted" style={{ padding: "40px 0" }}>
                Nenhum cliente crítico no radar.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
