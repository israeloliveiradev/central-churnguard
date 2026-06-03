import { useState } from "react";

const COMMANDS = [
  { name: "/status", description: "Consulta o risco atual de um cliente", syntax: "/status [nome]" },
  { name: "/fatores", description: "Detalha os motivos de risco (SHAP) do cliente", syntax: "/fatores [nome]" },
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
            <span className="badge badge-purple" style={{ marginBottom: "8px", alignSelf: "flex-start", fontSize: "10px", padding: "4px 8px" }}>
              🤖 Inteligência Preditiva
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
              <code>/status [Nome]</code> ou <code>/fatores [Nome]</code> no input.
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
              <div className="chat-msg agent">
                Olá! Eu sou a **Sophia**, a inteligência artificial do ChurnGuard. 🧠
                <br />
                <br />
                Posso consultar dados de clientes, fazer análises em tempo real e fornecer estratégias de retenção personalizadas para o seu time de Customer Success.
                <br />
                <br />
                Escolha um dos comandos rápidos na barra lateral ou digite diretamente abaixo:
                <br />
                <br />
                👉 <code>/relatorio</code> — Resumo executivo consolidado da base
                <br />
                👉 <code>/status [Nome]</code> — Ver o nível de risco de um cliente específico
                <br />
                👉 <code>/fatores [Nome]</code> — Detalhar os fatores de risco (SHAP) do cliente
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
