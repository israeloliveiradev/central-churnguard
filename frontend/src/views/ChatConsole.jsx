import { useState } from "react";

const COMMANDS = [
  { name: "/status", description: "Consulta o risco atual de um cliente", syntax: "/status [Nome ou ID]" },
  { name: "/fatores", description: "Detalha os motivos de risco (SHAP) do cliente", syntax: "/fatores [Nome ou ID]" },
  { name: "/relatorio", description: "Gera um resumo consolidado da base de clientes", syntax: "/relatorio" }
];

export default function ChatConsole({ chatHistory, onSendMessage, onClearChat }) {
  const [inputText, setInputText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (showSuggestions) return; // Prevent sending while selecting suggestions
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputText(value);

    if (value.startsWith("/")) {
      const parts = value.split(" ");
      if (parts.length === 1) {
        const filtered = COMMANDS.filter(cmd => cmd.name.startsWith(parts[0].toLowerCase()));
        if (filtered.length > 0) {
          setSuggestions(filtered);
          setShowSuggestions(true);
          setActiveIndex(prev => Math.min(prev, filtered.length - 1));
          return;
        }
      }
    }
    setShowSuggestions(false);
  };

  const selectSuggestion = (cmd) => {
    setInputText(cmd.name + (cmd.name === "/relatorio" ? "" : " "));
    setShowSuggestions(false);
    const input = document.getElementById("chat-input-text");
    if (input) input.focus();
  };

  const handleKeyDown = (e) => {
    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    }
  };

  const formatMarkdownText = (text) => {
    if (!text) return "";
    let formatted = text;
    // Replace emojis with FontAwesome icons
    formatted = formatted.replace(/🤖/g, '<i class="fa-solid fa-robot text-cyan" style="margin-right: 6px;"></i>');
    formatted = formatted.replace(/🧠/g, '<i class="fa-solid fa-brain text-rose" style="margin-right: 6px;"></i>');
    formatted = formatted.replace(/👉/g, '<i class="fa-solid fa-chevron-right text-cyan" style="margin-right: 6px;"></i>');
    formatted = formatted.replace(/⚠️/g, '<i class="fa-solid fa-triangle-exclamation text-red" style="margin-right: 6px;"></i>');
    formatted = formatted.replace(/🕵️/g, '<i class="fa-solid fa-magnifying-glass-chart text-cyan" style="margin-right: 6px;"></i>');
    formatted = formatted.replace(/💡/g, '<i class="fa-solid fa-lightbulb text-orange" style="margin-right: 6px;"></i>');
    formatted = formatted.replace(/🛡️/g, '<i class="fa-solid fa-shield-halved text-cyan" style="margin-right: 6px;"></i>');
    formatted = formatted.replace(/❌/g, '<i class="fa-solid fa-circle-xmark text-red" style="margin-right: 6px;"></i>');
    
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
    formatted = formatted.replace(/^\*\s(.*)/gm, "<li>$1</li>");
    return { __html: formatted };
  };

  return (
    <div className="tab-pane chat-pane-container">
      <div className="chat-interface-wrapper">
        {/* Chat Sidebar Info */}
        <div className="chat-info-sidebar">
          <div className="ai-profile-card">
            <span className="badge badge-purple" style={{ marginBottom: "8px", alignSelf: "flex-start", fontSize: "10px", padding: "5px 9px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <i className="fa-solid fa-microchip" style={{ fontSize: "11px" }}></i> Inteligência Preditiva
            </span>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0", fontSize: "18px" }}>
              <i className="fa-solid fa-brain text-rose" style={{ filter: "drop-shadow(0 0 4px rgba(244, 63, 94, 0.25))" }}></i> Sophia AI
            </h3>
            <p className="text-muted" style={{ fontSize: "12px", lineHeight: "1.4", margin: "6px 0 0 0" }}>
              Sua assistente inteligente especializada em retenção e Customer Success do ChurnGuard.
            </p>
          </div>

          <div className="chat-suggested-commands">
            <h4>Comandos Rápidos</h4>
            <button
              className="btn-command-pill"
              onClick={() => onSendMessage("/relatorio")}
            >
              <div className="cmd-icon-wrapper">
                <i className="fa-solid fa-chart-pie"></i>
              </div>
              <div className="cmd-text-wrapper">
                <span className="cmd-name">/relatorio</span>
                <span className="cmd-desc">Resumo consolidado da base</span>
              </div>
            </button>
            <button
              className="btn-command-pill"
              onClick={() => onSendMessage("/status Alice Souza")}
            >
              <div className="cmd-icon-wrapper">
                <i className="fa-solid fa-user-shield"></i>
              </div>
              <div className="cmd-text-wrapper">
                <span className="cmd-name">/status Alice Souza</span>
                <span className="cmd-desc">Ver status de churn do cliente</span>
              </div>
            </button>
            <button
              className="btn-command-pill"
              onClick={() => onSendMessage("/fatores Bruno Silva")}
            >
              <div className="cmd-icon-wrapper">
                <i className="fa-solid fa-magnifying-glass-chart"></i>
              </div>
              <div className="cmd-text-wrapper">
                <span className="cmd-name">/fatores Bruno Silva</span>
                <span className="cmd-desc">Explicar fatores de risco (SHAP)</span>
              </div>
            </button>
          </div>

          <div className="chat-manual-guide">
            <h5>
              <i className="fa-solid fa-circle-info"></i> Dica de Uso
            </h5>
            <p>
              Você pode consultar dados de qualquer cliente digitando{" "}
              <code>/status [Nome ou ID]</code> ou <code>/fatores [Nome ou ID]</code> no input.
            </p>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="chat-panel">
          <div className="chat-header">
            <div className="chat-agent-profile">
              <div className="agent-avatar" style={{ background: "rgba(244, 63, 94, 0.05)", borderColor: "rgba(244, 63, 94, 0.15)" }}>
                <i className="fa-solid fa-brain text-rose" style={{ fontSize: "18px" }}></i>
              </div>
              <div className="agent-details">
                <h4>Sophia AI</h4>
                <span className="badge badge-success">Online e pronta</span>
              </div>
            </div>
            {chatHistory.length > 0 && (
              <button className="btn-clear-chat" onClick={onClearChat} title="Limpar histórico de conversas">
                <i className="fa-solid fa-trash-can"></i>
                <span>Limpar Conversa</span>
              </button>
            )}
          </div>

          <div className="chat-body">
            {chatHistory.length === 0 ? (
              <div className="chat-msg agent" style={{ alignSelf: "flex-start", maxWidth: "600px", background: "var(--bg-panel-inner)", border: "1px solid var(--border-card)", padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(244, 63, 94, 0.06)", border: "1px solid rgba(244, 63, 94, 0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <i className="fa-solid fa-brain text-rose" style={{ fontSize: "14px" }}></i>
                  </div>
                  <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>Sophia AI Assistant</strong>
                </div>
                
                <p style={{ margin: "0 0 12px 0", fontSize: "13.5px", color: "var(--text-primary)", fontWeight: "500" }}>
                  Olá! Eu sou a <strong>Sophia</strong>, a inteligência artificial do ChurnGuard.
                </p>
                <p style={{ margin: "0", fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                  Posso consultar dados de clientes, realizar previsões de risco em tempo real e sugerir ações de retenção personalizadas para apoiar a operação de Customer Success.
                </p>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div key={idx} className={`chat-msg ${msg.sender}`}>
                  <div dangerouslySetInnerHTML={formatMarkdownText(msg.message)} />
                </div>
              ))
            )}
          </div>

          <div className="chat-footer" style={{ position: "relative" }}>
            {showSuggestions && (
              <div className="chat-suggestions-menu">
                {suggestions.map((cmd, idx) => (
                  <div
                    key={cmd.name}
                    onClick={() => selectSuggestion(cmd)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`chat-suggestion-item ${idx === activeIndex ? "active" : ""}`}
                  >
                    <div>
                      <strong style={{ color: "var(--color-secondary)", fontFamily: "monospace", fontSize: "13px" }}>
                        {cmd.name}
                      </strong>
                      <span style={{ fontSize: "11px", marginLeft: "12px", color: "var(--color-muted)" }}>
                        {cmd.description}
                      </span>
                    </div>
                    <kbd style={{
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "var(--text-secondary)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontFamily: "monospace"
                    }}>
                      {cmd.syntax}
                    </kbd>
                  </div>
                ))}
              </div>
            )}
            <form id="chat-input-form" onSubmit={handleSubmit}>
              <input
                type="text"
                id="chat-input-text"
                autoComplete="off"
                placeholder="Digite uma pergunta ou comando (ex: /relatorio)..."
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                maxLength={400}
              />
              <button type="submit" className="btn btn-primary" id="btn-chat-send">
                <i className="fa-solid fa-paper-plane"></i>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
