import { useState, useEffect } from "react";

export default function Customers({
  customers,
  loadingCustomers,
  onViewDetail,
  selectedCustomer,
  onCloseModal,
  search,
  setSearch,
  filter,
  setFilter,
  page,
  limit,
  totalCustomers,
  fetchCustomers,
  onAddCustomer,
  onCSVUpload
}) {
  const [localSearch, setLocalSearch] = useState(search);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvFileContent, setCsvFileContent] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const [viewMode, setViewMode] = useState("table");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    gender: "Male",
    SeniorCitizen: 0,
    Partner: "No",
    Dependents: "No",
    tenure: 12,
    Contract: "Month-to-month",
    PaperlessBilling: "Yes",
    PaymentMethod: "Electronic check",
    MonthlyCharges: 50.00,
    PhoneService: "Yes",
    MultipleLines: "No",
    InternetService: "Fiber optic",
    OnlineSecurity: "No",
    OnlineBackup: "No",
    DeviceProtection: "No",
    TechSupport: "No",
    StreamingTV: "No",
    StreamingMovies: "No"
  });

  // Keep local search in sync if parent search changes (e.g. cleared)
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Automated search debouncing (350ms after user stops typing)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (localSearch !== search) {
        setSearch(localSearch);
        fetchCustomers(localSearch, filter, 1);
      }
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [localSearch]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(localSearch);
    fetchCustomers(localSearch, filter, 1);
  };

  const handleFilterClick = (newFilter) => {
    setFilter(newFilter);
    fetchCustomers(localSearch, newFilter, 1);
  };

  const totalPages = Math.ceil(totalCustomers / limit) || 1;

  const handlePrevPage = () => {
    if (page > 1) {
      fetchCustomers(localSearch, filter, page - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      fetchCustomers(localSearch, filter, page + 1);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "SeniorCitizen" || name === "tenure" ? parseInt(value) || 0 : value
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const success = await onAddCustomer(formData);
    if (success) {
      setShowAddModal(false);
      // Reset form
      setFormData({
        name: "",
        email: "",
        gender: "Male",
        SeniorCitizen: 0,
        Partner: "No",
        Dependents: "No",
        tenure: 12,
        Contract: "Month-to-month",
        PaperlessBilling: "Yes",
        PaymentMethod: "Electronic check",
        MonthlyCharges: 50.00,
        PhoneService: "Yes",
        MultipleLines: "No",
        InternetService: "Fiber optic",
        OnlineSecurity: "No",
        OnlineBackup: "No",
        DeviceProtection: "No",
        TechSupport: "No",
        StreamingTV: "No",
        StreamingMovies: "No"
      });
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = 
      "customerID,name,email,gender,SeniorCitizen,Partner,Dependents,tenure,PhoneService,MultipleLines,InternetService,OnlineSecurity,OnlineBackup,DeviceProtection,TechSupport,StreamingTV,StreamingMovies,Contract,PaperlessBilling,PaymentMethod,MonthlyCharges,TotalCharges\n" +
      "TST-5506,Carlos Silva,carlos.silva@exemplo.com,Male,0,Yes,Yes,70,Yes,Yes,DSL,Yes,Yes,Yes,Yes,Yes,Yes,Two year,No,Mailed check,62.97,4407.9\n" +
      "TST-3615,Ana Souza,ana.souza@exemplo.com,Female,0,No,No,20,Yes,Yes,DSL,Yes,No,Yes,No,No,No,Month-to-month,No,Electronic check,83.92,1678.4\n";
      
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_clientes_churnguard.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCsvFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvFileContent(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleCSVSubmit = async (e) => {
    e.preventDefault();
    if (!csvFileContent) return;
    setUploadingCSV(true);
    const success = await onCSVUpload(csvFileContent);
    setUploadingCSV(false);
    if (success) {
      setShowCSVModal(false);
      setCsvFileContent("");
      setCsvFileName("");
    }
  };

  return (
    <div className="tab-pane">
      <div className="glass-card customer-manager">
        <div className="card-header-bar">
          <form onSubmit={handleSearchSubmit} className="search-box-container">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              placeholder="Nome ou ID (pressione Enter)..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
            <button type="submit" style={{ display: "none" }}>Buscar</button>
          </form>
          
          <div className="filter-group">
            <button
              className={`btn-filter btn-filter-all ${filter === "all" ? "active" : ""}`}
              onClick={() => handleFilterClick("all")}
            >
              Todos
            </button>
            <button
              className={`btn-filter btn-filter-high ${filter === "high" ? "active" : ""}`}
              onClick={() => handleFilterClick("high")}
            >
              <span className="dot dot-high"></span>
              Críticos (&gt;65%)
            </button>
            <button
              className={`btn-filter btn-filter-medium ${filter === "medium" ? "active" : ""}`}
              onClick={() => handleFilterClick("medium")}
            >
              <span className="dot dot-medium"></span>
              Médio (35%-65%)
            </button>
            <button
              className={`btn-filter btn-filter-low ${filter === "low" ? "active" : ""}`}
              onClick={() => handleFilterClick("low")}
            >
              <span className="dot dot-low"></span>
              Seguros (&lt;35%)
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* View Mode Toggle Group */}
            <div className="view-mode-toggle" style={{ display: "flex", background: "var(--bg-panel-inner)", border: "1px solid var(--border-card)", borderRadius: "8px", padding: "2px" }}>
              <button
                type="button"
                className={`btn-toggle-view ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                style={{
                  background: viewMode === "table" ? "var(--bg-card)" : "transparent",
                  border: "none",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer",
                  color: viewMode === "table" ? "var(--color-primary)" : "var(--text-secondary)",
                  boxShadow: viewMode === "table" ? "var(--shadow-card)" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <i className="fa-solid fa-list"></i> Tabela
              </button>
              <button
                type="button"
                className={`btn-toggle-view ${viewMode === "cards" ? "active" : ""}`}
                onClick={() => setViewMode("cards")}
                style={{
                  background: viewMode === "cards" ? "var(--bg-card)" : "transparent",
                  border: "none",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer",
                  color: viewMode === "cards" ? "var(--color-primary)" : "var(--text-secondary)",
                  boxShadow: viewMode === "cards" ? "var(--shadow-card)" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <i className="fa-solid fa-grip"></i> Cartões
              </button>
            </div>

            <button className="btn btn-secondary btn-xs" onClick={() => setShowCSVModal(true)}>
              <i className="fa-solid fa-file-csv"></i> Importar CSV
            </button>
            <button className="btn btn-primary btn-xs" onClick={() => setShowAddModal(true)}>
              <i className="fa-solid fa-plus"></i> Novo Cliente
            </button>
          </div>
        </div>

        {viewMode === "cards" ? (
          <div className="customer-cards-container" style={{ padding: "20px", overflowY: "auto", flexGrow: 1, maxHeight: "calc(100vh - 250px)" }}>
            {loadingCustomers ? (
              <div className="loading-spinner" style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                <i className="fa-solid fa-circle-notch fa-spin"></i> Consultando base de clientes...
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center text-muted" style={{ padding: "40px 0" }}>
                Nenhum cliente atende aos filtros atuais.
              </div>
            ) : (
              <div className="customer-cards-grid">
                {customers.map((cust) => {
                  let riskClass = "text-cyan";
                  let riskBadgeBg = "rgba(8, 145, 178, 0.08)";
                  let riskBadgeBorder = "rgba(8, 145, 178, 0.15)";
                  
                  if (cust.risk_pct > 65.0) {
                    riskClass = "text-red";
                    riskBadgeBg = "rgba(225, 29, 72, 0.08)";
                    riskBadgeBorder = "rgba(225, 29, 72, 0.15)";
                  } else if (cust.risk_pct > 35.0) {
                    riskClass = "text-orange";
                    riskBadgeBg = "rgba(234, 88, 12, 0.08)";
                    riskBadgeBorder = "rgba(234, 88, 12, 0.15)";
                  }

                  const risks = (cust.risk_factors || []).map((f) => (
                    <span key={f} className="table-factor-tag risk">
                      {f}
                    </span>
                  ));
                  const prots = (cust.protection_factors || []).map((p) => (
                    <span key={p} className="table-factor-tag prot">
                      {p}
                    </span>
                  ));

                  return (
                    <div className="customer-card glass-card" key={cust.customerID}>
                      <div className="card-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <code style={{ fontSize: "10px", display: "inline-block" }}>{cust.customerID}</code>
                          <h4 style={{ fontSize: "13.5px", fontWeight: "700", color: "var(--text-primary)", marginTop: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cust.name}</h4>
                          <span style={{ fontSize: "11px", color: "var(--color-muted)", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cust.email}</span>
                        </div>
                        <div 
                          className="risk-badge" 
                          style={{ 
                            fontSize: "11px", 
                            fontWeight: "700", 
                            padding: "4px 8px", 
                            borderRadius: "6px", 
                            background: riskBadgeBg, 
                            border: `1px solid ${riskBadgeBorder}`,
                            textAlign: "center",
                            flexShrink: 0
                          }}
                        >
                          <span className={riskClass}>{cust.risk_pct}%</span>
                          <span style={{ display: "block", fontSize: "8px", fontWeight: "normal", color: "var(--color-muted)" }}>Risco</span>
                        </div>
                      </div>

                      <div className="card-details-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", background: "var(--bg-panel-inner)", padding: "8px 12px", borderRadius: "8px", fontSize: "11px", margin: "10px 0" }}>
                        <div>
                          <span style={{ display: "block", color: "var(--color-muted)", fontSize: "8px", textTransform: "uppercase" }}>Contrato</span>
                          <strong style={{ color: "var(--text-primary)" }}>{cust.Contract}</strong>
                        </div>
                        <div>
                          <span style={{ display: "block", color: "var(--color-muted)", fontSize: "8px", textTransform: "uppercase" }}>Permanência</span>
                          <strong style={{ color: "var(--text-primary)" }}>{cust.tenure} meses</strong>
                        </div>
                        <div style={{ gridColumn: "span 2", borderTop: "1px solid var(--border-card)", paddingTop: "4px", marginTop: "4px" }}>
                          <span style={{ display: "block", color: "var(--color-muted)", fontSize: "8px", textTransform: "uppercase" }}>Mensalidade</span>
                          <strong style={{ color: "var(--text-primary)" }}>U$ {cust.MonthlyCharges.toFixed(2)}</strong>
                        </div>
                      </div>

                      { (risks.length > 0 || prots.length > 0) && (
                        <div className="card-factors-section" style={{ display: "flex", flexDirection: "column", gap: "6px", margin: "4px 0" }}>
                          {risks.length > 0 && (
                            <div>
                              <span style={{ display: "block", fontSize: "9px", color: "var(--color-muted)", marginBottom: "4px" }}>Fatores de Risco:</span>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>{risks}</div>
                            </div>
                          )}
                          {prots.length > 0 && (
                            <div>
                              <span style={{ display: "block", fontSize: "9px", color: "var(--color-muted)", marginBottom: "4px" }}>Proteção:</span>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>{prots}</div>
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ marginTop: "auto", paddingTop: "8px" }}>
                        <button
                          className="btn btn-secondary btn-xs"
                          style={{ width: "100%", justifyContent: "center", minHeight: "30px", height: "30px" }}
                          onClick={() => onViewDetail(cust.customerID)}
                        >
                          <i className="fa-solid fa-eye"></i> Detalhes
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Contrato</th>
                  <th>Permanência</th>
                  <th>Mensalidade</th>
                  <th>Risco Predito</th>
                  <th>Fatores Principais (SHAP)</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {loadingCustomers ? (
                  <tr>
                    <td colSpan="8" className="text-center">
                      <div className="loading-spinner">
                        <i className="fa-solid fa-circle-notch fa-spin"></i> Consultando base de clientes...
                      </div>
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted" style={{ padding: "40px" }}>
                      Nenhum cliente atende aos filtros atuais.
                    </td>
                  </tr>
                ) : (
                  customers.map((cust) => {
                    let riskClass = "text-cyan";
                    if (cust.risk_pct > 65.0) riskClass = "text-red";
                    else if (cust.risk_pct > 35.0) riskClass = "text-orange";
  
                    const risks = (cust.risk_factors || []).slice(0, 2).map((f) => (
                      <span key={f} className="table-factor-tag risk">
                        {f}
                      </span>
                    ));
                    const prots = (cust.protection_factors || []).slice(0, 1).map((p) => (
                      <span key={p} className="table-factor-tag prot">
                        {p}
                      </span>
                    ));
  
                    return (
                      <tr key={cust.customerID}>
                        <td>
                          <code>{cust.customerID}</code>
                        </td>
                        <td>
                          <strong>{cust.name}</strong>
                          <br />
                          <span className="text-muted" style={{ fontSize: "11px" }}>
                            {cust.email}
                          </span>
                        </td>
                        <td>{cust.Contract}</td>
                        <td>{cust.tenure} meses</td>
                        <td>U$ {cust.MonthlyCharges.toFixed(2)}</td>
                        <td>
                          <strong className={riskClass}>{cust.risk_pct}%</strong>
                        </td>
                        <td className="col-factors">
                          <div className="table-factors">
                            <div>{risks}</div>
                            <div style={{ marginTop: "2px" }}>{prots}</div>
                          </div>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => onViewDetail(cust.customerID)}
                          >
                            <i className="fa-solid fa-eye"></i> Detalhes
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalCustomers > 0 && (
          <div className="pagination-bar">
            <span>
              Exibindo <strong>{Math.min((page - 1) * limit + 1, totalCustomers)}</strong> a <strong>{Math.min(page * limit, totalCustomers)}</strong> de <strong>{totalCustomers}</strong> clientes
            </span>
            <div className="pagination-controls">
              <button
                className="btn btn-secondary btn-xs"
                onClick={handlePrevPage}
                disabled={page === 1 || loadingCustomers}
              >
                <i className="fa-solid fa-chevron-left"></i> Anterior
              </button>
              <span className="page-indicator">
                Página <strong>{page}</strong> de <strong>{totalPages}</strong>
              </span>
              <button
                className="btn btn-secondary btn-xs"
                onClick={handleNextPage}
                disabled={page === totalPages || loadingCustomers}
              >
                Próxima <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Add Customer Modal */}
      {showAddModal && (
        <div className="modal active" onClick={(e) => e.target.classList.contains("modal") && setShowAddModal(false)}>
          <div className="modal-content glass-card modal-lg">
            <div className="modal-header">
              <h3>Cadastrar Novo Cliente</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                <div className="form-section-title" style={{ marginTop: 0 }}>Dados Pessoais</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nome Completo</label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      placeholder="Ex: João da Silva"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>E-mail</label>
                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      placeholder="Ex: joao.silva@email.com"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Gênero</label>
                    <select name="gender" className="form-control" value={formData.gender} onChange={handleInputChange}>
                      <option value="Male">Masculino</option>
                      <option value="Female">Feminino</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Idoso (Senior Citizen)</label>
                    <select name="SeniorCitizen" className="form-control" value={formData.SeniorCitizen} onChange={handleInputChange}>
                      <option value={0}>Não</option>
                      <option value={1}>Sim</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Possui Parceiro(a)</label>
                    <select name="Partner" className="form-control" value={formData.Partner} onChange={handleInputChange}>
                      <option value="No">Não</option>
                      <option value="Yes">Sim</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Possui Dependentes</label>
                    <select name="Dependents" className="form-control" value={formData.Dependents} onChange={handleInputChange}>
                      <option value="No">Não</option>
                      <option value="Yes">Sim</option>
                    </select>
                  </div>
                </div>

                <div className="form-section-title">Informações de Contrato</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tempo de Contrato (meses)</label>
                    <input
                      type="number"
                      name="tenure"
                      min="1"
                      max="120"
                      className="form-control"
                      required
                      value={formData.tenure}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Tipo de Contrato</label>
                    <select name="Contract" className="form-control" value={formData.Contract} onChange={handleInputChange}>
                      <option value="Month-to-month">Mensal (Month-to-month)</option>
                      <option value="One year">Anual (One year)</option>
                      <option value="Two year">Bienal (Two year)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Mensalidade (USD)</label>
                    <input
                      type="number"
                      name="MonthlyCharges"
                      step="0.01"
                      min="1"
                      className="form-control"
                      required
                      value={formData.MonthlyCharges}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Método de Pagamento</label>
                    <select name="PaymentMethod" className="form-control" value={formData.PaymentMethod} onChange={handleInputChange}>
                      <option value="Electronic check">Electronic Check</option>
                      <option value="Mailed check">Mailed Check</option>
                      <option value="Credit card (automatic)">Cartão de Crédito Automático</option>
                      <option value="Bank transfer (automatic)">Transferência Bancária Automática</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Faturamento Digital (Paperless)</label>
                    <select name="PaperlessBilling" className="form-control" value={formData.PaperlessBilling} onChange={handleInputChange}>
                      <option value="Yes">Sim</option>
                      <option value="No">Não</option>
                    </select>
                  </div>
                </div>

                <div className="form-section-title">Serviços Contratados</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Serviço de Telefone</label>
                    <select name="PhoneService" className="form-control" value={formData.PhoneService} onChange={handleInputChange}>
                      <option value="Yes">Sim</option>
                      <option value="No">Não</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Múltiplas Linhas</label>
                    <select name="MultipleLines" className="form-control" value={formData.MultipleLines} onChange={handleInputChange}>
                      <option value="No">Não</option>
                      <option value="Yes">Sim</option>
                      <option value="No phone service">Sem serviço de telefone</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Plano de Internet</label>
                    <select name="InternetService" className="form-control" value={formData.InternetService} onChange={handleInputChange}>
                      <option value="Fiber optic">Fibra Óptica</option>
                      <option value="DSL">DSL</option>
                      <option value="No">Sem Internet</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Segurança Online</label>
                    <select name="OnlineSecurity" className="form-control" value={formData.OnlineSecurity} onChange={handleInputChange}>
                      <option value="No">Não</option>
                      <option value="Yes">Sim</option>
                      <option value="No internet service">Sem serviço de internet</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Backup Online</label>
                    <select name="OnlineBackup" className="form-control" value={formData.OnlineBackup} onChange={handleInputChange}>
                      <option value="No">Não</option>
                      <option value="Yes">Sim</option>
                      <option value="No internet service">Sem serviço de internet</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Proteção de Dispositivo</label>
                    <select name="DeviceProtection" className="form-control" value={formData.DeviceProtection} onChange={handleInputChange}>
                      <option value="No">Não</option>
                      <option value="Yes">Sim</option>
                      <option value="No internet service">Sem serviço de internet</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Suporte Técnico</label>
                    <select name="TechSupport" className="form-control" value={formData.TechSupport} onChange={handleInputChange}>
                      <option value="No">Não</option>
                      <option value="Yes">Sim</option>
                      <option value="No internet service">Sem serviço de internet</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Streaming de TV</label>
                    <select name="StreamingTV" className="form-control" value={formData.StreamingTV} onChange={handleInputChange}>
                      <option value="No">Não</option>
                      <option value="Yes">Sim</option>
                      <option value="No internet service">Sem serviço de internet</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Streaming de Filmes</label>
                    <select name="StreamingMovies" className="form-control" value={formData.StreamingMovies} onChange={handleInputChange}>
                      <option value="No">Não</option>
                      <option value="Yes">Sim</option>
                      <option value="No internet service">Sem serviço de internet</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-header" style={{ borderTop: "1px solid var(--border-card)", borderBottom: "none", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirmar e Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCSVModal && (
        <div className="modal active" onClick={(e) => e.target.classList.contains("modal") && setShowCSVModal(false)}>
          <div className="modal-content glass-card modal-sm">
            <div className="modal-header">
              <h3>Importar Clientes em Lote (CSV)</h3>
              <button className="close-btn" onClick={() => setShowCSVModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCSVSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: "1.5" }}>
                  Selecione um arquivo CSV contendo os dados dos clientes. O cabeçalho deve corresponder às colunas do padrão do dataset Telco Churn (ex: <code>customerID</code>, <code>gender</code>, <code>tenure</code>, <code>MonthlyCharges</code>, etc.).
                </p>
                <div style={{ marginBottom: "18px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={handleDownloadTemplate}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <i className="fa-solid fa-download"></i> Baixar CSV de Exemplo
                  </button>
                </div>
                <div className="form-group">
                  <label>Arquivo CSV</label>
                  <input
                    type="file"
                    accept=".csv"
                    className="form-control"
                    onChange={handleFileChange}
                    required
                  />
                  {csvFileName && (
                    <span style={{ fontSize: "11px", color: "var(--color-secondary)", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <i className="fa-solid fa-file-csv text-cyan"></i> {csvFileName}
                    </span>
                  )}
                </div>
              </div>
              <div className="modal-header" style={{ borderTop: "1px solid var(--border-card)", borderBottom: "none", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCSVModal(false)} disabled={uploadingCSV}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!csvFileContent || uploadingCSV}>
                  {uploadingCSV ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> Processando...
                    </>
                  ) : (
                    "Fazer Upload e Inserir"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedCustomer && (
        <div className="modal active" onClick={(e) => e.target.classList.contains("modal") && onCloseModal()}>
          <div className="modal-content glass-card">
            <div className="modal-header">
              <h3>Detalhes do Cliente</h3>
              <button className="close-btn" onClick={onCloseModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
                <div>
                  <h2 style={{ fontFamily: "var(--font-header)", fontSize: "22px" }}>{selectedCustomer.name}</h2>
                  <span className="text-muted" style={{ fontSize: "13px" }}>
                    ID: <code>{selectedCustomer.customerID}</code> &bull; {selectedCustomer.email}
                  </span>
                </div>
                <div
                  className={`risk-score-badge ${
                    selectedCustomer.risk_pct > 65.0
                      ? "high"
                      : selectedCustomer.risk_pct > 35.0
                      ? "medium"
                      : "low"
                  }`}
                  style={{ fontSize: "16px", padding: "6px 14px" }}
                >
                  Risco: {selectedCustomer.risk_pct}%
                </div>
              </div>

              <div className="detail-section">
                <h4>Cadastro e Contrato</h4>
                <div className="detail-grid-two">
                  <div className="detail-item">
                    <label>Gênero</label>
                    <span>{selectedCustomer.gender === "Male" ? "Masculino" : "Feminino"}</span>
                  </div>
                  <div className="detail-item">
                    <label>Idoso (SeniorCitizen)</label>
                    <span>{selectedCustomer.SeniorCitizen === 1 ? "Sim" : "Não"}</span>
                  </div>
                  <div className="detail-item">
                    <label>Possui Parceiro</label>
                    <span>{selectedCustomer.Partner === "Yes" ? "Sim" : "Não"}</span>
                  </div>
                  <div className="detail-item">
                    <label>Dependentes</label>
                    <span>{selectedCustomer.Dependents === "Yes" ? "Sim" : "Não"}</span>
                  </div>
                  <div className="detail-item">
                    <label>Tempo de Contrato</label>
                    <span>{selectedCustomer.tenure} meses</span>
                  </div>
                  <div className="detail-item">
                    <label>Tipo de Contrato</label>
                    <span>{selectedCustomer.Contract}</span>
                  </div>
                  <div className="detail-item">
                    <label>Mensalidade</label>
                    <span>U$ {selectedCustomer.MonthlyCharges.toFixed(2)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Cobrança Acumulada</label>
                    <span>U$ {selectedCustomer.TotalCharges.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Serviços Contratados</h4>
                <div className="detail-grid-two">
                  <div className="detail-item">
                    <label>Plano de Internet</label>
                    <span>{selectedCustomer.InternetService}</span>
                  </div>
                  <div className="detail-item">
                    <label>Serviço de Telefone</label>
                    <span>{selectedCustomer.PhoneService === "Yes" ? "Ativo" : "Não"}</span>
                  </div>
                  <div className="detail-item">
                    <label>Múltiplas Linhas</label>
                    <span>{selectedCustomer.MultipleLines}</span>
                  </div>
                  <div className="detail-item">
                    <label>Segurança Online</label>
                    <span>{selectedCustomer.OnlineSecurity}</span>
                  </div>
                  <div className="detail-item">
                    <label>Backup Online</label>
                    <span>{selectedCustomer.OnlineBackup}</span>
                  </div>
                  <div className="detail-item">
                    <label>Proteção de Dispositivo</label>
                    <span>{selectedCustomer.DeviceProtection}</span>
                  </div>
                  <div className="detail-item">
                    <label>Suporte Técnico</label>
                    <span>{selectedCustomer.TechSupport}</span>
                  </div>
                  <div className="detail-item">
                    <label>Total de Serviços</label>
                    <span>{selectedCustomer.NumServices} contratados</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Detalhamento ML (Analyst)</h4>
                <div className="detail-ml-card">
                  <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>Risco Geral:</span>
                    {selectedCustomer.risk_pct > 65.0 ? (
                      <span className="status-badge critical">
                        <i className="fa-solid fa-triangle-exclamation"></i> Crítico (Alerta)
                      </span>
                    ) : selectedCustomer.risk_pct > 35.0 ? (
                      <span className="status-badge warning">
                        <i className="fa-solid fa-circle-exclamation"></i> Moderado (Atenção)
                      </span>
                    ) : (
                      <span className="status-badge success">
                        <i className="fa-solid fa-circle-check"></i> Baixo (Seguro)
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <h5 style={{ fontSize: "11px", color: "var(--color-primary)", marginBottom: "6px", textTransform: "uppercase" }}>
                        Fatores de Churn (SHAP)
                      </h5>
                      <ul style={{ listStyle: "none", fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {(selectedCustomer.risk_factors || []).length > 0 ? (
                          selectedCustomer.risk_factors.map((f) => (
                            <li key={f} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <i className="fa-solid fa-circle-exclamation text-red" style={{ fontSize: "10px" }}></i> {f}
                            </li>
                          ))
                        ) : (
                          <li>Nenhum fator de risco pesado</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <h5 style={{ fontSize: "11px", color: "var(--color-secondary)", marginBottom: "6px", textTransform: "uppercase" }}>
                        Fatores de Retenção (SHAP)
                      </h5>
                      <ul style={{ listStyle: "none", fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {(selectedCustomer.protection_factors || []).length > 0 ? (
                          selectedCustomer.protection_factors.map((p) => (
                            <li key={p} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <i className="fa-solid fa-shield-halved text-cyan" style={{ fontSize: "10px" }}></i> {p}
                            </li>
                          ))
                        ) : (
                          <li>Nenhum fator de proteção pesado</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
