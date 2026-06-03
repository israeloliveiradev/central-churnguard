import os
import sys
import streamlit as st

# Copy Streamlit secrets to environment variables so they are visible to the agent analyst
try:
    for key in st.secrets:
        os.environ[key] = str(st.secrets[key])
except Exception:
    pass

import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime

# Force single-thread mode for ML/NumPy libraries to prevent crashes
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"

# Add application directory to path
app_dir = os.path.dirname(os.path.abspath(__file__))
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

from agent_analyst import AgentAnalyst

# -------------------------------------------------------------
# PAGE CONFIG & PREMIUM CUSTOM STYLING
# -------------------------------------------------------------
st.set_page_config(
    page_title="ChurnGuard | ML Engine Dashboard",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Premium Custom CSS Injection for styling metric cards, buttons, and layouts
st.markdown("""
<style>
    /* Main Fonts and Theme Integration */
    .stApp {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    
    /* Headers & Subheaders */
    h1, h2, h3, h4, h5, h6 {
        font-weight: 700 !important;
    }
    
    /* Sleek Clean Cards */
    .kpi-card {
        background-color: var(--secondary-background-color, #ffffff);
        border: 1px solid rgba(128, 128, 128, 0.15);
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 4px 12px 0 rgba(0, 0, 0, 0.02);
        margin-bottom: 15px;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .kpi-card:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 6px 0 rgba(0, 0, 0, 0.08), 0 8px 16px 0 rgba(0, 0, 0, 0.04);
    }
    
    .kpi-title {
        color: var(--text-color, #0f172a);
        opacity: 0.65;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 6px;
    }
    
    .kpi-value {
        color: var(--primary-color, #e11d48);
        font-size: 32px;
        font-weight: 700;
    }
    
    /* Status Badge Container */
    .status-container {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        background: var(--secondary-background-color, #ffffff);
        border: 1px solid rgba(128, 128, 128, 0.15);
        color: var(--text-color, #0f172a);
        width: fit-content;
        margin-bottom: 10px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    
    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }
    
    /* Factor Cards (Risk & Protection) */
    .factor-card {
        padding: 12px 16px;
        border-radius: 10px;
        margin-bottom: 8px;
        font-weight: 500;
        font-size: 13px;
    }
    
    .risk-card {
        background: rgba(225, 29, 72, 0.06);
        border: 1px solid rgba(225, 29, 72, 0.15);
        color: #e11d48;
    }
    
    .protection-card {
        background: rgba(22, 163, 74, 0.06);
        border: 1px solid rgba(22, 163, 74, 0.15);
        color: #16a34a;
    }
    
    /* Custom buttons */
    div.stButton > button {
        background-color: #e11d48 !important; /* rose-600 */
        color: #ffffff !important;
        border-radius: 8px !important;
        border: 1px solid transparent !important;
        font-weight: 600 !important;
        padding: 8px 20px !important;
        transition: all 0.2s ease !important;
        box-shadow: 0 4px 12px rgba(225, 29, 72, 0.12) !important;
        font-size: 14px !important;
        min-height: 40px;
    }
    div.stButton > button:hover {
        background-color: #f43f5e !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 6px 16px rgba(225, 29, 72, 0.2) !important;
    }
    div.stButton > button:active {
        transform: scale(0.98) !important;
    }
</style>
""", unsafe_allow_html=True)

# -------------------------------------------------------------
# INITIALIZE CORE ANALYST ENGINE
# -------------------------------------------------------------
@st.cache_resource
def get_analyst():
    analyst_instance = AgentAnalyst()
    analyst_instance.load_model()
    return analyst_instance

analyst = get_analyst()

# -------------------------------------------------------------
# DATABASE CONNECTION & STATUS
# -------------------------------------------------------------
db_connected = False
db_type = "offline"
total_db_rows = 0
db_error = None

try:
    conn, db_type = analyst.get_db_connection()
    if conn:
        db_connected = True
        # Get row count
        cursor = conn.cursor()
        if db_type == "postgresql":
            cursor.execute("SELECT COUNT(*) FROM customers WHERE customerid NOT LIKE '%-NEW' AND customerid NOT LIKE '%-CSV'")
            total_db_rows = cursor.fetchone()[0]
        else:
            # SQLite
            cursor.execute("SELECT COUNT(*) FROM customers WHERE customerid NOT LIKE '%-NEW' AND customerid NOT LIKE '%-CSV'")
            total_db_rows = cursor.fetchone()[0]
        conn.close()
except Exception as e:
    db_connected = False
    db_type = "offline"
    db_error = str(e)

# -------------------------------------------------------------
# SIDEBAR NAVIGATION & APP METADATA
# -------------------------------------------------------------
with st.sidebar:
    st.image("https://img.icons8.com/color/96/shield.png", width=70)
    st.title("ChurnGuard 🛡️")
    st.write("Inteligência Artificial aplicada à Retenção de Clientes.")
    st.write("---")
    
    # Navigation
    menu = st.radio(
        "Navegação",
        ["📊 Visão Geral", "👤 Analisar Cliente", "📁 Predição em Lote (CSV)", "⚙️ Treinar & Configurar"],
        index=0
    )
    
    st.write("---")
    st.subheader("Status do Sistema")
    
    # DB Status Badge
    db_badge_color = "#22c55e" if db_connected else "#ef4444"
    db_badge_text = "Supabase Conectado" if db_type == "postgresql" else ("SQLite Local" if db_connected else "Banco Desconectado")
    st.markdown(f"""
    <div class="status-container">
        <div class="status-dot" style="background-color: {db_badge_color};"></div>
        <span>{db_badge_text}</span>
    </div>
    """, unsafe_allow_html=True)
    
    # Model Status Badge
    model_loaded = analyst.model is not None
    model_badge_color = "#22c55e" if model_loaded else "#ef4444"
    model_badge_text = "Modelo Carregado" if model_loaded else "Modelo não Treinado"
    st.markdown(f"""
    <div class="status-container">
        <div class="status-dot" style="background-color: {model_badge_color};"></div>
        <span>{model_badge_text}</span>
    </div>
    """, unsafe_allow_html=True)
    
    if db_connected:
        st.caption(f"Registros na base de treino: {total_db_rows:,}")
    else:
        if db_error:
            st.error(f"Erro de Conexão: {db_error}")
    
    st.write("---")
    st.caption(f"© {datetime.now().year} ChurnGuard ML Engine. V1.0.0")

# -------------------------------------------------------------
# SECTION 1: VISÃO GERAL (DASHBOARD OVERVIEW)
# -------------------------------------------------------------
if menu == "📊 Visão Geral":
    st.title("📊 Painel Analítico Geral")
    st.write("Métricas e visualizações globais dos dados de clientes em tempo real.")
    
    if not db_connected:
        st.warning("⚠️ Banco de dados indisponível no momento. Conecte o Supabase para carregar métricas e gráficos históricos.")
        
        # Display Static Fallback Cards
        col1, col2, col3 = st.columns(3)
        with col1:
            st.markdown("""
            <div class="kpi-card">
                <div class="kpi-title">Clientes Simulados</div>
                <div class="kpi-value">7.043</div>
            </div>
            """, unsafe_allow_html=True)
        with col2:
            st.markdown("""
            <div class="kpi-card">
                <div class="kpi-title">Churn Médio da Indústria</div>
                <div class="kpi-value">26.5%</div>
            </div>
            """, unsafe_allow_html=True)
        with col3:
            st.markdown("""
            <div class="kpi-card">
                <div class="kpi-title">Faturamento sob Risco Médio</div>
                <div class="kpi-value">R$ 143.2k</div>
            </div>
            """, unsafe_allow_html=True)
            
    else:
        # Load data from database
        with st.spinner("Carregando estatísticas da base de dados..."):
            try:
                df = analyst.fetch_training_data()
                
                # Clean targets/numeric data
                df['churn_val'] = df['churn'].astype(int)
                df['tenure'] = df['tenure'].astype(int)
                df['MonthlyCharges'] = df['MonthlyCharges'].astype(float)
                
                total_cust = len(df)
                churn_rate = (df['churn_val'].sum() / total_cust) * 100
                avg_tenure = df['tenure'].mean()
                avg_monthly = df['MonthlyCharges'].mean()
                
                # KPIs Row
                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    st.markdown(f"""
                    <div class="kpi-card">
                        <div class="kpi-title">Total de Clientes</div>
                        <div class="kpi-value">{total_cust:,}</div>
                    </div>
                    """, unsafe_allow_html=True)
                with col2:
                    st.markdown(f"""
                    <div class="kpi-card">
                        <div class="kpi-title">Taxa de Churn Atual</div>
                        <div class="kpi-value">{churn_rate:.1f}%</div>
                    </div>
                    """, unsafe_allow_html=True)
                with col3:
                    st.markdown(f"""
                    <div class="kpi-card">
                        <div class="kpi-title">Fidelidade Média (Tenure)</div>
                        <div class="kpi-value">{avg_tenure:.1f} meses</div>
                    </div>
                    """, unsafe_allow_html=True)
                with col4:
                    st.markdown(f"""
                    <div class="kpi-card">
                        <div class="kpi-title">Mensalidade Média</div>
                        <div class="kpi-value">R$ {avg_monthly:.2f}</div>
                    </div>
                    """, unsafe_allow_html=True)
                
                # Visualizations Row
                st.write("### Análise de Distribuição e Fatores Críticos")
                
                # Tabbed analysis
                tab1, tab2, tab3 = st.tabs([
                    "📊 Drivers de Churn (Comportamento)", 
                    "⚙️ Engajamento & Financeiro", 
                    "🧠 Explicabilidade IA (Cérebro do Modelo)"
                ])
                
                with tab1:
                    st.markdown("""
                    Nesta seção, analisamos como o comportamento do cliente e os serviços contratados impactam a taxa de cancelamento.
                    Use estes insights para propor novas ofertas ou ajustar políticas comerciais.
                    """)
                    
                    chart_col1, chart_col2 = st.columns(2)
                    
                    with chart_col1:
                        # 1. Churn by Contract Type (Significant factor)
                        contract_churn = df.groupby('Contract')['churn_val'].mean().reset_index()
                        contract_churn['churn_val'] = contract_churn['churn_val'] * 100
                        fig1 = px.bar(
                            contract_churn,
                            x='Contract',
                            y='churn_val',
                            title='Taxa de Churn (%) por Tipo de Contrato',
                            labels={'Contract': 'Tipo de Contrato', 'churn_val': 'Churn (%)'},
                            color='Contract',
                            color_discrete_sequence=['#ef4444', '#f59e0b', '#10b981']
                        )
                        fig1.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#94a3b8')
                        st.plotly_chart(fig1, use_container_width=True)
                        st.caption("💡 **Insight:** Clientes com contrato mensal (Month-to-month) cancelam muito mais rápido. Estimular contratos anuais é a melhor estratégia de retenção.")
                        
                    with chart_col2:
                        # 2. Churn by Internet Service
                        internet_churn = df.groupby('InternetService')['churn_val'].mean().reset_index()
                        internet_churn['churn_val'] = internet_churn['churn_val'] * 100
                        fig3 = px.bar(
                            internet_churn,
                            x='InternetService',
                            y='churn_val',
                            title='Taxa de Churn (%) por Tipo de Internet',
                            labels={'InternetService': 'Serviço de Internet', 'churn_val': 'Churn (%)'},
                            color='InternetService',
                            color_discrete_sequence=['#a855f7', '#0284c7', '#64748b']
                        )
                        fig3.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#94a3b8')
                        st.plotly_chart(fig3, use_container_width=True)
                        st.caption("💡 **Insight:** Clientes de fibra óptica têm taxas de churn elevadas. Pode haver problemas de instabilidade de conexão ou atrito de preço.")
                        
                    chart_col_extra1, chart_col_extra2 = st.columns(2)
                    
                    with chart_col_extra1:
                        # 3. Churn by Tech Support
                        support_churn = df.groupby('TechSupport')['churn_val'].mean().reset_index()
                        support_churn['churn_val'] = support_churn['churn_val'] * 100
                        fig_support = px.bar(
                            support_churn,
                            x='TechSupport',
                            y='churn_val',
                            title='Taxa de Churn (%) por Suporte Técnico Extra',
                            labels={'TechSupport': 'Suporte Técnico', 'churn_val': 'Churn (%)'},
                            color='TechSupport',
                            color_discrete_sequence=['#ef4444', '#10b981', '#64748b']
                        )
                        fig_support.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#94a3b8')
                        st.plotly_chart(fig_support, use_container_width=True)
                        st.caption("💡 **Insight:** Oferecer suporte técnico ativo reduz o cancelamento pela metade. O suporte atua como barreira de proteção.")
                        
                    with chart_col_extra2:
                        # 4. Churn by Payment Method
                        payment_churn = df.groupby('PaymentMethod')['churn_val'].mean().reset_index()
                        payment_churn['churn_val'] = payment_churn['churn_val'] * 100
                        
                        # Shorten payment method names for clean display
                        short_names = {
                            "Electronic check": "Boleto/Débito Eletrônico",
                            "Mailed check": "Cheque por Correio",
                            "Bank transfer (automatic)": "Transf. Automática",
                            "Credit card (automatic)": "Cartão Automático"
                        }
                        payment_churn['PaymentMethodFriendly'] = payment_churn['PaymentMethod'].map(short_names).fillna(payment_churn['PaymentMethod'])
                        
                        fig_payment = px.bar(
                            payment_churn,
                            y='PaymentMethodFriendly',
                            x='churn_val',
                            orientation='h',
                            title='Taxa de Churn (%) por Forma de Pagamento',
                            labels={'PaymentMethodFriendly': 'Método', 'churn_val': 'Churn (%)'},
                            color='PaymentMethodFriendly',
                            color_discrete_sequence=['#ef4444', '#64748b', '#10b981', '#0284c7']
                        )
                        fig_payment.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#94a3b8')
                        st.plotly_chart(fig_payment, use_container_width=True)
                        st.caption("💡 **Insight:** Faturamento em Boleto Eletrônico tem churn assustador. Estimular cobrança no cartão recorrente blinda o cliente.")

                with tab2:
                    st.markdown("""
                    Aqui analisamos o impacto financeiro (mensalidades) e a fidelidade temporal dos clientes contratados.
                    Entenda onde está o atrito financeiro e a curva de tempo ideal.
                    """)
                    
                    chart_col3, chart_col4 = st.columns(2)
                    
                    with chart_col3:
                        # 1. Churn vs Monthly Charges Boxplot
                        fig2 = px.box(
                            df,
                            x='churn',
                            y='MonthlyCharges',
                            title='Distribuição de Mensalidades por Status de Churn',
                            labels={'churn': 'Sofreu Churn? (1=Sim, 0=Não)', 'MonthlyCharges': 'Fatura Mensal (R$)'},
                            color='churn',
                            color_discrete_sequence=['#10b981', '#ef4444']
                        )
                        fig2.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#94a3b8')
                        st.plotly_chart(fig2, use_container_width=True)
                        st.caption("💡 **Insight:** Clientes que cancelam pagam valores mensais medianos mais elevados. O preço é um fator de fricção ativo.")
                        
                    with chart_col4:
                        # 2. Tenure Histogram
                        fig4 = px.histogram(
                            df,
                            x='tenure',
                            color='churn',
                            title='Distribuição do Tempo de Contrato (Tenure) em Meses',
                            labels={'tenure': 'Tempo de Contrato (Meses)', 'count': 'Número de Clientes'},
                            barmode='overlay',
                            color_discrete_sequence=['#10b981', '#ef4444']
                        )
                        fig4.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#94a3b8')
                        st.plotly_chart(fig4, use_container_width=True)
                        st.caption("💡 **Insight:** O risco de cancelamento é máximo nos primeiros 6 meses de contratação (onboarding crítico). Após 12 meses, a retenção estabiliza.")

                    st.write("---")
                    
                    # 3. Lock-in Line chart (New visual)
                    st.write("#### Efeito Multi-Serviços (Lock-in) na Taxa de Cancelamento")
                    services_churn = df.groupby('NumServices')['churn_val'].mean().reset_index()
                    services_churn['churn_val'] = services_churn['churn_val'] * 100
                    
                    fig_services = px.line(
                        services_churn,
                        x='NumServices',
                        y='churn_val',
                        markers=True,
                        title='Efeito Lock-In: Taxa de Churn (%) vs Número de Serviços Contratados',
                        labels={'NumServices': 'Quantidade de Serviços Ativos', 'churn_val': 'Churn Rate (%)'},
                        color_discrete_sequence=['#e11d48']
                    )
                    fig_services.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#94a3b8')
                    st.plotly_chart(fig_services, use_container_width=True)
                    st.markdown("""
                    **🔍 Análise Estratégica:** O gráfico de linha demonstra claramente o efeito de **Lock-in**. 
                    Clientes com apenas 1 ou 2 serviços têm mais de **35% de taxa de churn**. Conforme o cliente adiciona serviços (como backup, streaming, suporte técnico extra), ele cria dependência e o churn cai para **menos de 5%**.
                    **Recomendação de Negócio:** Realizar ações de cross-selling para clientes mono-serviço para aumentar a aderência.
                    """)

                with tab3:
                    st.markdown("""
                    Esta aba exibe os parâmetros internos da Inteligência Artificial. 
                    Aqui você vê exatamente quais fatores a IA considera de maior risco para tomada de decisões automáticas de churn.
                    """)
                    
                    if model_loaded:
                        try:
                            clf = analyst.model.named_steps["clf"]
                            coefs = clf.coef_[0]
                            feature_names = analyst.feature_names
                            
                            # Map features to friendly names
                            friendly_mapping = {
                                "Contract_One year": "Contrato de 1 Ano",
                                "Contract_Two year": "Contrato de 2 Anos",
                                "InternetService_Fiber optic": "Internet Fibra Óptica",
                                "InternetService_No": "Sem Serviço de Internet",
                                "TechSupport_Yes": "Possui Suporte Técnico Ativo",
                                "TechSupport_No internet service": "Sem Internet (Suporte)",
                                "PaymentMethod_Electronic check": "Pagamento por Boleto Eletrônico",
                                "PaymentMethod_Credit card (automatic)": "Cartão de Crédito Automático",
                                "PaymentMethod_Mailed check": "Cheque por Correio",
                                "PaymentMethod_Bank transfer (automatic)": "Transferência Bancária Automática",
                                "OnlineSecurity_Yes": "Possui Segurança Online",
                                "OnlineSecurity_No internet service": "Sem Internet (Segurança)",
                                "OnlineBackup_Yes": "Possui Backup Online",
                                "OnlineBackup_No internet service": "Sem Internet (Backup)",
                                "DeviceProtection_Yes": "Possui Proteção de Dispositivo",
                                "DeviceProtection_No internet service": "Sem Internet (Proteção)",
                                "PaperlessBilling_Yes": "Faturamento Digital (Paperless)",
                                "MultipleLines_Yes": "Múltiplas Linhas Telefônicas",
                                "MultipleLines_No phone service": "Sem Linha Telefônica",
                                "PhoneService_Yes": "Possui Serviço de Telefone",
                                "gender_Male": "Gênero Masculino",
                                "Partner_Yes": "Possui Parceiro(a)",
                                "Dependents_Yes": "Possui Dependentes",
                                "SeniorCitizen": "Cliente Aposentado/Idoso",
                                "tenure": "Tempo de Casa (Tenure)",
                                "MonthlyCharges": "Valor da Fatura Mensal",
                                "TotalCharges": "Valor Acumulado Pago",
                                "NumServices": "Quantidade de Serviços",
                                "HasInternet": "Possui Internet",
                                "HasSupport": "Possui Suporte/Segurança",
                                "HasStreaming": "Possui Streaming de TV/Vídeo"
                            }
                            
                            coef_data = []
                            for name, val in zip(feature_names, coefs):
                                friendly = friendly_mapping.get(name, name)
                                coef_data.append({
                                    "Fator de Análise": friendly,
                                    "Impacto no Risco": float(val),
                                    "Efeito": "⚠️ Aumenta Risco (Churn)" if val > 0 else "🛡️ Evita Risco (Retenção)"
                                })
                            
                            df_coef = pd.DataFrame(coef_data)
                            df_coef["AbsImpact"] = df_coef["Impacto no Risco"].abs()
                            df_coef = df_coef.sort_values(by="AbsImpact", ascending=False).head(12)
                            
                            fig_coef = px.bar(
                                df_coef,
                                x="Impacto no Risco",
                                y="Fator de Análise",
                                color="Efeito",
                                orientation="h",
                                title="Fatores de Maior Impacto na Tomada de Decisão da IA (Top 12)",
                                color_discrete_map={"⚠️ Aumenta Risco (Churn)": "#ef4444", "🛡️ Evita Risco (Retenção)": "#10b981"},
                                labels={"Impacto no Risco": "Força de Decisão da IA (Coeficiente)", "Fator de Análise": "Fator de Comportamento"}
                            )
                            fig_coef.update_layout(
                                yaxis={'categoryorder': 'total ascending'},
                                plot_bgcolor='rgba(0,0,0,0)',
                                paper_bgcolor='rgba(0,0,0,0)',
                                font_color='#94a3b8'
                            )
                            st.plotly_chart(fig_coef, use_container_width=True)
                            
                            st.markdown("""
                            #### 🔍 Como ler este cérebro de IA?
                            * **Barras Vermelhas (Direita):** São os fatores que a IA considera de alto risco. Clientes que possuem essas características têm maior chance de receber um score de churn elevado. Boleto eletrônico e fibra óptica (sem suporte) são os principais atritos.
                            * **Barras Verdes (Esquerda):** São os fatores de proteção. Quando presentes, eles derrubam o score de risco do cliente. Contratos de 2 anos e tempo de casa são os escudos mais fortes.
                            """)
                        except Exception as e_coef:
                            st.warning(f"Erro ao processar coeficientes do modelo: {e_coef}")
                    else:
                        st.error("❌ O modelo de IA não está treinado ou carregado. Treine-o primeiro na aba 'Treinar & Configurar'.")
            except Exception as e:
                st.error(f"Erro ao carregar dados analíticos da base: {e}")

# -------------------------------------------------------------
# SECTION 2: ANALISAR CLIENTE INDIVIDUAL
# -------------------------------------------------------------
elif menu == "👤 Analisar Cliente":
    st.title("👤 Análise de Churn Individual")
    st.write("Insira as informações do cliente para calcular a probabilidade de cancelamento (Churn) e entender as razões da pontuação.")
    
    if not model_loaded:
        st.error("❌ O modelo de inteligência artificial não está carregado. Treine o modelo primeiro na aba de configurações.")
    else:
        st.write("---")
        
        # Form layout
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.subheader("📋 Dados Demográficos")
            gender = st.selectbox("Gênero", ["Female", "Male"])
            senior = st.selectbox("Idoso / Aposentado? (SeniorCitizen)", ["Não", "Sim"])
            partner = st.selectbox("Possui Parceiro(a)?", ["Yes", "No"])
            dependents = st.selectbox("Possui Dependentes?", ["Yes", "No"])
            tenure = st.slider("Fidelidade (Tenure) em meses", min_value=1, max_value=72, value=12)
            
        with col2:
            st.subheader("🔌 Serviços Contratados")
            phone = st.selectbox("Serviço de Telefone?", ["Yes", "No"])
            multiple = st.selectbox("Múltiplas Linhas?", ["No", "Yes", "No phone service"])
            internet = st.selectbox("Serviço de Internet?", ["DSL", "Fiber optic", "No"])
            
            # Sub-options conditional on Internet Service
            if internet != "No":
                security = st.selectbox("Segurança Online?", ["No", "Yes"])
                backup = st.selectbox("Backup Online?", ["No", "Yes"])
                protection = st.selectbox("Proteção de Dispositivo?", ["No", "Yes"])
                support = st.selectbox("Suporte Técnico Extra?", ["No", "Yes"])
                tv = st.selectbox("Streaming de TV?", ["No", "Yes"])
                movies = st.selectbox("Streaming de Filmes?", ["No", "Yes"])
            else:
                security = "No internet service"
                backup = "No internet service"
                protection = "No internet service"
                support = "No internet service"
                tv = "No internet service"
                movies = "No internet service"
                
        with col3:
            st.subheader("💳 Faturamento e Contrato")
            contract = st.selectbox("Tipo de Contrato", ["Month-to-month", "One year", "Two year"])
            paperless = st.selectbox("Faturamento Digital (Paperless)?", ["Yes", "No"])
            payment = st.selectbox("Forma de Pagamento", [
                "Electronic check", "Mailed check", 
                "Bank transfer (automatic)", "Credit card (automatic)"
            ])
            monthly = st.number_input("Valor da Fatura Mensal (R$)", min_value=18.0, max_value=150.0, value=65.0, step=0.5)
            
            # Automated calculation for TotalCharges with option to edit
            total_charges_default = float(monthly * tenure)
            total = st.number_input("Valor Acumulado Pago (TotalCharges)", min_value=18.0, max_value=10000.0, value=total_charges_default, step=10.0)

        st.write("---")
        
        # Action button
        if st.button("🛡️ Calcular Risco de Churn", use_container_width=True):
            # Parse inputs to dict
            senior_val = 1 if senior == "Sim" else 0
            
            customer_payload = {
                "customerID": "INPUT-CLIENT",
                "name": "Simulated Client",
                "email": "test@client.com",
                "gender": gender,
                "SeniorCitizen": senior_val,
                "Partner": partner,
                "Dependents": dependents,
                "tenure": int(tenure),
                "PhoneService": phone,
                "MultipleLines": multiple,
                "InternetService": internet,
                "OnlineSecurity": security,
                "OnlineBackup": backup,
                "DeviceProtection": protection,
                "TechSupport": support,
                "StreamingTV": tv,
                "StreamingMovies": movies,
                "Contract": contract,
                "PaperlessBilling": paperless,
                "PaymentMethod": payment,
                "MonthlyCharges": float(monthly),
                "TotalCharges": float(total),
                # Pre-calculated aggregations
                "NumServices": sum([1 for s in [phone, multiple, security, backup, protection, support, tv, movies] if s == "Yes"]),
                "HasInternet": 1 if internet != "No" else 0,
                "HasSupport": 1 if (security == "Yes" or support == "Yes") else 0,
                "HasStreaming": 1 if (tv == "Yes" or movies == "Yes") else 0
            }
            
            with st.spinner("Calculando risco com o modelo de Machine Learning..."):
                try:
                    result = analyst.predict(customer_payload)
                    risk_pct = result["risk_pct"]
                    
                    st.write("## Resultado da Análise")
                    
                    # Layout result
                    res_col1, res_col2 = st.columns([1, 2])
                    
                    with res_col1:
                        # Define color badge based on risk
                        if risk_pct < 30:
                            risk_color = "#22c55e"
                            risk_lbl = "Baixo Risco"
                        elif risk_pct < 60:
                            risk_color = "#f59e0b"
                            risk_lbl = "Risco Moderado"
                        else:
                            risk_color = "#ef4444"
                            risk_lbl = "Alto Risco de Churn"
                            
                        # Render Gauge chart using Plotly
                        fig = go.Figure(go.Indicator(
                            mode = "gauge+number",
                            value = risk_pct,
                            domain = {'x': [0, 1], 'y': [0, 1]},
                            title = {'text': "Probabilidade de Cancelamento", 'font': {'size': 18, 'color': '#f8fafc'}},
                            number = {'suffix': "%", 'font': {'size': 44, 'color': risk_color}},
                            gauge = {
                                'axis': {'range': [None, 100], 'tickwidth': 1, 'tickcolor': "#475569"},
                                'bar': {'color': risk_color},
                                'bgcolor': "rgba(30,41,59,0.5)",
                                'borderwidth': 2,
                                'bordercolor': "#334155",
                                'steps': [
                                    {'range': [0, 30], 'color': 'rgba(34, 197, 94, 0.1)'},
                                    {'range': [30, 60], 'color': 'rgba(245, 158, 11, 0.1)'},
                                    {'range': [60, 100], 'color': 'rgba(239, 68, 68, 0.1)'}
                                ],
                            }
                        ))
                        fig.update_layout(
                            paper_bgcolor='rgba(0,0,0,0)', 
                            plot_bgcolor='rgba(0,0,0,0)',
                            margin=dict(l=10, r=10, t=40, b=10),
                            height=250
                        )
                        st.plotly_chart(fig, use_container_width=True)
                        st.markdown(f"<h3 style='text-align: center; color: {risk_color} !important;'>{risk_lbl}</h3>", unsafe_allow_html=True)
                        
                    with res_col2:
                        st.subheader("📊 Explicação do Modelo (Fatores SHAP)")
                        st.write("Abaixo estão listados os maiores fatores que influenciaram a pontuação deste cliente:")
                        
                        explain_col1, explain_col2 = st.columns(2)
                        
                        with explain_col1:
                            st.markdown("⚠️ **Fatores que Aumentam o Risco**")
                            if result["risk_factors"]:
                                for factor in result["risk_factors"]:
                                    st.markdown(f'<div class="factor-card risk-card">📈 {factor}</div>', unsafe_allow_html=True)
                            else:
                                st.write("Nenhum fator de risco relevante identificado.")
                                
                        with explain_col2:
                            st.markdown("🟢 **Fatores que Protegem (Fidelizam)**")
                            if result["protection_factors"]:
                                for factor in result["protection_factors"]:
                                    st.markdown(f'<div class="factor-card protection-card">🛡️ {factor}</div>', unsafe_allow_html=True)
                            else:
                                st.write("Nenhum fator protetivo relevante identificado.")
                                
                except Exception as e:
                    st.error(f"Erro ao processar predição: {e}")

# -------------------------------------------------------------
# SECTION 3: PREDIÇÃO EM LOTE (BATCH UPLOAD)
# -------------------------------------------------------------
elif menu == "📁 Predição em Lote (CSV)":
    st.title("📁 Predição de Churn em Lote")
    st.write("Faça upload de um arquivo CSV contendo os dados dos seus clientes para gerar análises e calcular o risco de churn de todos de uma única vez.")
    
    if not model_loaded:
        st.error("❌ O modelo de inteligência artificial não está carregado. Treine o modelo primeiro na aba de configurações.")
    else:
        st.write("---")
        
        # Download template
        st.markdown("#### 📥 Baixar Modelo de Exemplo")
        st.write("Seu arquivo CSV deve seguir o modelo padrão (contendo dados demográficos, serviços e cobrança).")
        
        # Let's read test_customers.csv if exists to offer download
        try:
            sample_df = pd.read_csv(os.path.join(app_dir, "..", "test_customers.csv"))
            csv_data = sample_df.to_csv(index=False).encode('utf-8')
            st.download_button(
                label="Download do CSV de Exemplo",
                data=csv_data,
                file_name="exemplo_churnguard.csv",
                mime="text/csv",
            )
        except Exception:
            pass
            
        st.write("---")
        
        # File uploader
        uploaded_file = st.file_uploader("Selecione o arquivo CSV de Clientes", type=["csv"])
        
        if uploaded_file is not None:
            try:
                # Load CSV
                input_df = pd.read_csv(uploaded_file)
                st.success(f"Arquivo carregado com sucesso! Encontrados {len(input_df)} clientes.")
                
                # Preview
                st.write("### Pré-visualização dos Dados")
                st.dataframe(input_df.head(5), use_container_width=True)
                
                # Initialize session state for batch results
                if "batch_results" not in st.session_state:
                    st.session_state.batch_results = None
                if "uploaded_file_name" not in st.session_state:
                    st.session_state.uploaded_file_name = None

                # Reset results if a new file is uploaded
                if st.session_state.uploaded_file_name != uploaded_file.name:
                    st.session_state.batch_results = None
                    st.session_state.uploaded_file_name = uploaded_file.name

                col_btn, col_reset = st.columns([4, 1])
                with col_btn:
                    trigger_process = st.button("🚀 Processar Predições em Lote", use_container_width=True)
                with col_reset:
                    if st.button("🔄 Limpar", use_container_width=True):
                        st.session_state.batch_results = None
                        st.rerun()

                if trigger_process:
                    with st.spinner("Otimizando e calculando risco com scikit-learn..."):
                        # Convert to list of dicts for analyst
                        records = input_df.to_dict(orient="records")
                        
                        # Run batch prediction
                        results = analyst.predict_batch(records)
                        
                        # Process results to DataFrame
                        res_list = []
                        for res in results:
                            res_list.append({
                                "customerid": res["customerid"],
                                "name": res["name"],
                                "risk_pct": res["risk_pct"],
                                "principal_fator_risco": res["risk_factors"][0] if res["risk_factors"] else "Nenhum",
                                "principal_fator_protecao": res["protection_factors"][0] if res["protection_factors"] else "Nenhum",
                            })
                            
                        res_df = pd.DataFrame(res_list)
                        
                        # Merge with original data
                        final_df = input_df.copy()
                        cust_id_col = next((col for col in final_df.columns if col.lower() == 'customerid'), None)
                        if cust_id_col:
                            final_df = final_df.merge(res_df, left_on=cust_id_col, right_on="customerid", how="left")
                            if "customerid_y" in final_df.columns:
                                final_df = final_df.drop(columns=["customerid_y"]).rename(columns={"customerid_x": "customerid"})
                        else:
                            final_df = pd.concat([final_df, res_df.drop(columns=["customerid"])], axis=1)
                            
                        st.session_state.batch_results = final_df
                        st.rerun()

                # Render results if they exist in session state
                if st.session_state.batch_results is not None:
                    final_df = st.session_state.batch_results
                    
                    # Layout batch results
                    st.write("---")
                    st.write("## 📊 Resultados do Processamento")
                    
                    # Metrics
                    high_risk_count = len(final_df[final_df["risk_pct"] >= 50])
                    high_risk_pct = (high_risk_count / len(final_df)) * 100
                    avg_batch_risk = final_df["risk_pct"].mean()
                    
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.markdown(f"""
                        <div class="kpi-card">
                            <div class="kpi-title">Clientes Analisados</div>
                            <div class="kpi-value">{len(final_df)}</div>
                        </div>
                        """, unsafe_allow_html=True)
                    with col2:
                        st.markdown(f"""
                        <div class="kpi-card">
                            <div class="kpi-title">Clientes em Alto Risco (>=50%)</div>
                            <div class="kpi-value" style="color: #ef4444;">{high_risk_count} ({high_risk_pct:.1f}%)</div>
                        </div>
                        """, unsafe_allow_html=True)
                    with col3:
                        st.markdown(f"""
                        <div class="kpi-card">
                            <div class="kpi-title">Risco Médio do Lote</div>
                            <div class="kpi-value" style="color: #f59e0b;">{avg_batch_risk:.1f}%</div>
                        </div>
                        """, unsafe_allow_html=True)
                        
                    # Chart
                    st.write("### Distribuição das Pontuações de Risco")
                    fig = px.histogram(
                        final_df,
                        x="risk_pct",
                        nbins=20,
                        title="Frequência de Clientes por Faixa de Risco de Churn",
                        labels={"risk_pct": "Risco de Churn (%)", "count": "Número de Clientes"},
                        color_discrete_sequence=["#38bdf8"]
                    )
                    fig.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font_color='#94a3b8')
                    st.plotly_chart(fig, use_container_width=True)
                    
                    # Full results table
                    st.write("### Detalhes de Todos os Clientes Analisados")
                    display_cols = ["customerid", "name", "risk_pct", "principal_fator_risco", "principal_fator_protecao"]
                    st.dataframe(final_df[display_cols].sort_values(by="risk_pct", ascending=False), use_container_width=True)
                    
                    # Download button
                    st.write("---")
                    final_csv_data = final_df.to_csv(index=False).encode('utf-8')
                    st.download_button(
                        label="📥 Baixar Planilha Completa com Predições",
                        data=final_csv_data,
                        file_name="churnguard_analise_lote.csv",
                        mime="text/csv",
                    )
                        
            except Exception as e:
                st.error(f"Erro ao processar arquivo de lote: {e}")

# -------------------------------------------------------------
# SECTION 4: CONFIGURAÇÕES & TREINAMENTO
# -------------------------------------------------------------
elif menu == "⚙️ Treinar & Configurar":
    st.title("⚙️ Gerenciamento e Treinamento do Modelo")
    st.write("Gerencie os dados, verifique a conexão com o banco e retreine a Inteligência Artificial com dados atualizados.")
    
    st.write("---")
    
    # Model info card
    st.subheader("Ficha Técnica do Modelo Atual")
    if model_loaded:
        st.success("✅ Modelo carregado com sucesso na memória.")
        
        # Details
        model_size = os.path.getsize(os.path.join(app_dir, "model.joblib")) / 1024
        st.write(f"- **Localização do arquivo:** `ml_engine/model.joblib`")
        st.write(f"- **Tamanho do arquivo em disco:** {model_size:.2f} KB")
        st.write(f"- **Tipo de Algoritmo:** Regressão Logística com Normalização Standard e OneHot Encoding Pipeline")
        st.write(f"- **Recursos Utilizados (Features):** {len(analyst.num_cols)} numéricas e {len(analyst.cat_cols)} categóricas")
    else:
        st.error("❌ Nenhum modelo de Machine Learning foi carregado. A IA não pode fazer predições.")
        
    st.write("---")
    
    # Database info card
    st.subheader("Status de Conexão")
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("#### Banco de Dados")
        if db_connected:
            st.write(f"- **Status:** Conectado")
            st.write(f"- **Tipo de Banco:** `{db_type.upper()}`")
            st.write(f"- **Registros para Treinamento:** {total_db_rows:,}")
        else:
            st.write("- **Status:** Desconectado")
            st.write("- **Mensagem:** Não foi possível estabelecer conexão com o Supabase. Verifique a URL na variável `DATABASE_URL` no arquivo `.env`.")
            
    with col2:
        st.markdown("#### Integrações de Pipeline")
        st.write(f"- **FastAPI API Server (main.py):** Integrado e rodando")
        st.write(f"- **Node.js Gateway:** Mapeado para `process.env.ML_ENGINE_URL`")
        
    st.write("---")
    
    # Retraining section
    st.subheader("Treinar Novo Modelo")
    st.write("Se novos clientes se cadastraram ou foram importados via planilha para o banco de dados, você pode retreinar o algoritmo de Machine Learning para atualizar suas variáveis SHAP e coeficientes de predição.")
    
    if not db_connected:
        st.warning("⚠️ O treinamento está indisponível porque o banco de dados está desconectado. Conecte o Supabase ou configure o arquivo SQLite.")
    else:
        st.info("💡 O treinamento é feito em segundo plano e atualizará instantaneamente a API e as predições do Streamlit após a conclusão.")
        
        if st.button("🚀 Iniciar Retreinamento da IA"):
            with st.spinner("Buscando dados no Supabase e ajustando regressão logística..."):
                try:
                    success = analyst.train_model()
                    if success:
                        st.success("🎉 Sucesso! O modelo de Machine Learning foi retreinado e o arquivo 'model.joblib' foi atualizado no servidor.")
                        # Force refresh
                        st.cache_resource.clear()
                        st.rerun()
                    else:
                        st.error("Falha ao treinar o modelo. Verifique os logs do console da Napoleon.")
                except Exception as e:
                    st.error(f"Erro crítico durante treinamento: {e}")
