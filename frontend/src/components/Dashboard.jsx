import React from "react";

export default function Dashboard({ stats, alerts, loadingAlerts, onViewDetail }) {
  // Utility to parse basic markdown inside alerts and convert emojis to sleek icons
  const formatMarkdownText = (text) => {
    if (!text) return "";
    let formatted = text;
    // Replace emojis with FontAwesome icons
    formatted = formatted.replace(/⚠️/g, '<i class="fa-solid fa-triangle-exclamation text-red" style="margin-right: 6px;"></i>');
    formatted = formatted.replace(/🕵️/g, '<i class="fa-solid fa-magnifying-glass-chart text-cyan" style="margin-right: 6px;"></i>');
    formatted = formatted.replace(/💡/g, '<i class="fa-solid fa-lightbulb text-orange" style="margin-right: 6px;"></i>');
    formatted = formatted.replace(/🛡️/g, '<i class="fa-solid fa-shield-halved text-cyan" style="margin-right: 6px;"></i>');
    
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
    formatted = formatted.replace(/^\*\s(.*)/gm, "<li>$1</li>");
    return { __html: formatted };
  };

  const highRiskPct = stats.total_customers > 0 
    ? ((stats.high_risk_count / stats.total_customers) * 100).toFixed(1)
    : "0.0";

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
          <div className="card-header">
            <div className="header-title">
              <i className="fa-solid fa-bell text-red"></i>
              <h3>Alertas Ativos (Disparados por Agent_Notifier)</h3>
            </div>
            <span className="badge badge-red">{alerts.length} Ativos</span>
          </div>
          <div className="alerts-feed-container" id="alerts-feed">
            {loadingAlerts ? (
              <div className="loading-spinner">
                <i className="fa-solid fa-circle-notch fa-spin"></i> Carregando alertas...
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center text-muted" style={{ padding: "40px 0" }}>
                Nenhum alerta crítico registrado.
              </div>
            ) : (
              alerts.map((alert) => (
                <div className="alert-item-card" key={alert.id || alert.created_at}>
                  <div className="alert-card-top">
                    <div className="alert-card-title text-red">
                      <span
                        className="status-indicator"
                        style={{
                          backgroundColor: "var(--color-primary)",
                          boxShadow: "0 0 6px var(--color-primary)",
                        }}
                      ></span>
                      Risco Crítico ({alert.risk_pct}%)
                    </div>
                    <span className="alert-card-time">
                      <i className="fa-solid fa-clock"></i>{" "}
                      {new Date(alert.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div
                    className="alert-card-body"
                    dangerouslySetInnerHTML={formatMarkdownText(alert.message)}
                  />
                </div>
              ))
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
