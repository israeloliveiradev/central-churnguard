# Guia de Deploy no DirectAdmin (Napoleon) - ChurnGuard 🛡️🚀

Este guia foi elaborado para ajudar você e seu especialista DevOps a hospedarem com sucesso o **Backend (Node.js)** e a **ML Engine (Flask)** no painel **DirectAdmin** (Napoleon hosting).

---

## 🏛️ Estrutura Recomendada no Servidor

Recomendamos utilizar subdomínios separados para o Backend e a ML Engine. Suba os arquivos do repositório para o gerenciador de arquivos nas seguintes pastas da sua conta:

```
/home/usuario/
  ├── api-churnguard/      <-- Pasta do backend (arquivos da pasta /backend)
  └── ml-churnguard/       <-- Pasta da ML Engine (arquivos da pasta /ml_engine)
```

*(Nota: Você pode colocar as pastas fora do `public_html` para maior segurança, pois o DirectAdmin fará o mapeamento do tráfego).*

---

## 1. Configurando a ML Engine (Python + Flask)

A ML Engine utiliza o seletor **Setup Python App** (CloudLinux) integrado ao DirectAdmin.

### Passo 1.1: Criar a aplicação no painel
1. No painel do DirectAdmin, procure por **Setup Python App**.
2. Clique em **Create Application**.
3. Preencha as configurações:
   - **Python Version**: Selecione `3.10.x` ou `3.11.x`.
   - **Application root**: `ml-churnguard` (nome da pasta onde subiu a ML Engine).
   - **Application URL**: Selecione o seu subdomínio `churnguard-ml.rankia.cloud`.
   - **Application startup file**: `passenger_wsgi.py` (nosso script já está configurado para detectar dinamicamente o ambiente virtual).
   - **Application entry point**: `application` (mantenha o padrão).
4. Clique em **Create**.

### Passo 1.2: Variáveis de Ambiente
Na página do app criado, adicione a seguinte variável:
- `DATABASE_URL` = `sua_conexao_do_supabase` (Altamente recomendado para compartilhar a base com o backend).

### Passo 1.3: Instalar as dependências via Terminal/SSH
1. Copie o comando de ativação do virtualenv exibido no topo da tela do DirectAdmin. Ele se parece com:
   ```bash
   source /home/usuario/virtualenv/ml-churnguard/3.10/bin/activate && cd /home/usuario/ml-churnguard
   ```
2. Acesse seu servidor via SSH, cole o comando e execute para ativar o ambiente.
3. Instale os pacotes necessários:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
4. Retorne ao DirectAdmin e clique em **Restart Application**.
5. Teste se está funcionando acessando no navegador: `https://churnguard-ml.rankia.cloud/health`

---

## 2. Configurando o Backend (Node.js + Express)

O Backend roda usando o seletor **Setup Node.js App** no DirectAdmin.

### Passo 2.1: Criar a aplicação no painel
1. No DirectAdmin, procure por **Setup Node.js App**.
2. Clique em **Create Application**.
3. Preencha as configurações:
   - **Node.js Version**: Selecione `18.x` ou superior.
   - **Application Mode**: `production`
   - **Application root**: `api-churnguard` (pasta onde subiu o backend).
   - **Application URL**: Selecione o subdomínio correspondente `api-churnguard.rankia.cloud`.
   - **Application startup file**: `app.js` (nosso wrapper que chama o `server.js`).
4. Clique em **Create**.

### Passo 2.2: Variáveis de Ambiente
No painel do app Node.js, adicione estas variáveis:
- `DATABASE_URL` = `sua_conexao_do_supabase`
- `ML_ENGINE_URL` = `https://churnguard-ml.rankia.cloud` (Subdomínio da ML Engine configurado no passo anterior).
- `CORS_ALLOWED_ORIGINS` = `https://central.rankia.cloud` (adicione outras origens separadas por vírgula se necessário).
- `GROQ_API_KEY` = `sua_chave_de_api_da_groq`
- `PORT` = `passenger` (Opcional, o Passenger injeta isso automaticamente).

### Passo 2.3: Instalação de dependências e Inicialização
1. No painel do DirectAdmin do app Node.js, clique no botão **Run JS Install** ou **NPM Install**.
2. Se preferir fazer via SSH:
   ```bash
   cd /home/usuario/api-churnguard
   npm install --production
   ```
3. *(Opcional)* Se você estiver conectando o Supabase pela primeira vez e quiser popular o banco com os 7000+ registros de clientes reais do Telco Churn:
   ```bash
   node migrate.js
   ```
4. Clique em **Restart** no painel do DirectAdmin.
5. Teste o funcionamento acessando: `https://api-churnguard.rankia.cloud/api/stats`

---

## 3. Configurando o Frontend (Vercel / Netlify / Cloudflare Pages)

No deploy da sua aplicação frontend (React + Vite), certifique-se de configurar a seguinte variável de ambiente de build:
- `VITE_API_URL` = `https://api-churnguard.rankia.cloud`

---

## 💡 Dicas de DevOps (Resolução de Problemas)

- **Erros de CORS**: Se o seu frontend na Vercel reclamar de bloqueio de CORS nas chamadas da API do Backend, verifique se a URL do frontend está autorizada ou se as chamadas estão sendo feitas para `https` (exija SSL no DirectAdmin para ambos os subdomínios).
- **Sem SSL (Let's Encrypt)**: Lembre-se de ativar o Let's Encrypt gratuito no DirectAdmin para os dois subdomínios criados. O backend e o frontend da Vercel exigem comunicação segura via HTTPS.
- **Erro 500 na ML Engine (Flask/Python)**: Bibliotecas de Machine Learning (como NumPy e Scikit-Learn) usam paralelismo multi-thread interno que pode gerar travamento de concorrência ou segfault quando rodadas dentro do Phusion Passenger (que usa forks). Nós já resolvemos isso injetando a configuração de thread única (`OMP_NUM_THREADS=1`, `MKL_NUM_THREADS=1`, `OPENBLAS_NUM_THREADS=1`, `NUMEXPR_NUM_THREADS=1`, `VECLIB_MAXIMUM_THREADS=1`) direto no topo do arquivo `passenger_wsgi.py`. Se houver necessidade, seu DevOps também pode adicionar essas variáveis no painel do DirectAdmin Python App.
- **Reinicialização pós-alterações**: Toda vez que alterar o arquivo `.env` ou modificar códigos do backend ou da ML Engine, é necessário clicar em **Restart** no seletor correspondente do DirectAdmin para aplicar as mudanças.
