export default function AgentTopology({ logs, onClearLogs }) {
  return (
    <div className="tab-pane">
      <div className="content-grid-two">
        {/* Agent Flow Visualization */}
        <div className="glass-card panel-agent-viz">
          <div className="card-header">
            <h3>Arquitetura Multiagentes ChurnGuard</h3>
          </div>
          <div className="agent-viz-container">
            <div className="agent-node" id="node-notifier">
              <div className="node-icon">
                <i className="fa-solid fa-bell text-purple"></i>
              </div>
              <h4>Agent_Notifier</h4>
              <span className="node-role">Cron Ativo</span>
              <p>Varre a base de dados em busca de riscos elevados (&gt;65%)</p>
            </div>

            <div className="node-connect-line flow-vertical"></div>

            <div className="agent-node" id="node-analyst">
              <div className="node-icon">
                <i className="fa-solid fa-microscope text-cyan"></i>
              </div>
              <h4>Agent_Analyst</h4>
              <span className="node-role">ML & Explicações</span>
              <p>Regressão Logística e SHAP calculam risco e fatores</p>
            </div>

            <div className="node-connect-line flow-horizontal"></div>

            <div className="agent-node" id="node-interactivity">
              <div className="node-icon">
                <i className="fa-solid fa-comments text-red"></i>
              </div>
              <h4>Agent_Interactivity</h4>
              <span className="node-role">Chat Reativo</span>
              <p>Responde a comandos diretos de análise (/status, /fatores)</p>
            </div>

            {/* Legend / Meta */}
            <div className="agent-viz-meta">
              <div className="meta-item">
                <span className="flow-dot alert-dot"></span> Alerta de Churn &gt; 65%
              </div>
              <div className="meta-item">
                <span className="flow-dot data-dot"></span> Dados Estruturados
              </div>
            </div>
          </div>
        </div>

        {/* System Logs */}
        <div className="glass-card panel-logs">
          <div className="card-header">
            <div className="header-title">
              <i className="fa-solid fa-terminal text-green"></i>
              <h3>Console de Logs do Orquestrador</h3>
            </div>
            <button className="btn btn-secondary btn-xs" onClick={onClearLogs}>
              Limpar
            </button>
          </div>
          <div className="logs-console">
            {logs.map((log, idx) => (
              <div key={idx} className="log-line">
                [{log.time}] <span className={
                  log.agent === "SYSTEM" 
                    ? "text-muted" 
                    : log.agent === "ANALYST" 
                    ? "text-cyan" 
                    : log.agent === "NOTIFIER" 
                    ? "text-purple" 
                    : "text-orange"
                }>
                  [{log.agent}]
                </span> {log.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
