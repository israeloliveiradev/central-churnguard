// API Base configuration
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

/**
 * Helper to handle fetch responses and throw error if not OK.
 */
async function handleResponse(res) {
  if (!res.ok) {
    let errorMsg = `HTTP Error: ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.error) {
        errorMsg = data.error;
      } else if (data && data.detail) {
        errorMsg = data.detail;
      }
    } catch {
      // Ignorar e usar mensagem padrão
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * Fetch general statistics for ChurnGuard.
 */
export async function fetchStats() {
  const res = await fetch(`${API_BASE}/api/stats`);
  return handleResponse(res);
}

/**
 * Fetch alert notifications feed.
 */
export async function fetchAlerts() {
  const res = await fetch(`${API_BASE}/api/alerts`);
  return handleResponse(res);
}

/**
 * Fetch customer list with pagination, search and filters.
 */
export async function fetchCustomers(searchVal = "", filterVal = "all", pageNum = 1, limitNum = 15) {
  const queryParams = new URLSearchParams({
    search: searchVal,
    filter: filterVal,
    page: pageNum.toString(),
    limit: limitNum.toString()
  });
  const res = await fetch(`${API_BASE}/api/customers?${queryParams}`);
  return handleResponse(res);
}

/**
 * Add a single customer manually.
 */
export async function addCustomer(custData) {
  const res = await fetch(`${API_BASE}/api/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(custData)
  });
  return handleResponse(res);
}

/**
 * Upload a batch of customers via CSV text.
 */
export async function uploadCSV(csvText) {
  const res = await fetch(`${API_BASE}/api/customers/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csvText })
  });
  return handleResponse(res);
}

/**
 * Fetch reactive chatbot history.
 */
export async function fetchChatHistory() {
  const res = await fetch(`${API_BASE}/api/chat/history`);
  return handleResponse(res);
}

/**
 * Trigger manual database scanner scan.
 */
export async function triggerManualScan() {
  const res = await fetch(`${API_BASE}/api/alerts/trigger-scan`, {
    method: "POST"
  });
  return handleResponse(res);
}

/**
 * Send interactive message to chatbot agent.
 */
export async function sendMessage(message) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });
  return handleResponse(res);
}

/**
 * Clear chatbot logs and database records.
 */
export async function clearChatHistory() {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "DELETE"
  });
  return handleResponse(res);
}
