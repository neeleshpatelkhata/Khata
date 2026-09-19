class ApiClient {
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://khata-backend-l4ue.onrender.com/api/v1';
    this.token = localStorage.getItem('khata_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('khata_token', token);
    } else {
      localStorage.removeItem('khata_token');
    }
  }

  getHeaders(isMultipart = false) {
    const headers = {};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const isMultipart = options.body instanceof FormData;

    // Fail fast when the device is offline. Without this the app waits on a
    // fetch that cannot succeed and every screen feels frozen.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const offlineErr = new Error('Device is offline. Working from local ledger data.');
      offlineErr.code = 'NETWORK_OFFLINE';
      offlineErr.isOffline = true;
      throw offlineErr;
    }

    // A sleeping free-tier backend can hold a connection open for a minute.
    // Cap it so the UI falls back to local data promptly.
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? (isMultipart ? 60000 : 12000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const { timeoutMs: _ignored, ...fetchOptions } = options;
    const config = {
      ...fetchOptions,
      method: options.method || 'GET',
      signal: controller.signal,
      headers: {
        ...this.getHeaders(isMultipart),
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      const contentType = response.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        // Server returned HTML (e.g. index.html from a static dev server or the
        // Capacitor local server) rather than the API.
        await response.text().catch(() => '');
        const err = new Error('Backend API server is offline or unreachable. Local standalone mode active.');
        err.code = 'LOCAL_OFFLINE';
        err.isOffline = true;
        err.status = response.status;
        throw err;
      }

      const data = await response.json();

      if (!response.ok || data.success === false) {
        const errorMsg = data.error?.message || `Request failed with status ${response.status}`;
        const err = new Error(errorMsg);
        err.code = data.error?.code || 'API_ERROR';
        err.status = response.status;
        throw err;
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Backend did not respond in time. Working from local ledger data.');
        timeoutErr.code = 'TIMEOUT';
        timeoutErr.isOffline = true;
        throw timeoutErr;
      }
      if (err.name === 'SyntaxError' || err.message?.includes('JSON')) {
        const parseErr = new Error('Backend server is offline or returned invalid response. Standalone local mode enabled.');
        parseErr.code = 'LOCAL_OFFLINE';
        parseErr.isOffline = true;
        throw parseErr;
      }
      if (err.name === 'TypeError') {
        const netErr = new Error('Network connection offline. Operating in local outbox mode.');
        netErr.code = 'NETWORK_OFFLINE';
        netErr.isOffline = true;
        throw netErr;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // Generic verbs for callers that talk to endpoints not wrapped below.
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  }

  // Auth endpoints
  register(userData) {
    return this.request('/auth/register', { method: 'POST', body: JSON.stringify(userData) });
  }

  login(credentials) {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
  }

  loginOAuth(providerData) {
    return this.request('/auth/oauth', { method: 'POST', body: JSON.stringify(providerData) });
  }

  getMe() {
    return this.request('/auth/me');
  }

  // Workspaces
  getWorkspaces() {
    return this.request('/workspaces');
  }

  createWorkspace(name, currency) {
    return this.request('/workspaces', { method: 'POST', body: JSON.stringify({ name, currency }) });
  }

  // Parties
  getParties(workspaceId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/workspaces/${workspaceId}/parties?${query}`);
  }

  createParty(workspaceId, partyData) {
    return this.request(`/workspaces/${workspaceId}/parties`, {
      method: 'POST',
      body: JSON.stringify(partyData)
    });
  }

  updateParty(workspaceId, partyId, partyData) {
    return this.request(`/workspaces/${workspaceId}/parties/${partyId}`, {
      method: 'PUT',
      body: JSON.stringify(partyData)
    });
  }

  deleteParty(workspaceId, partyId) {
    return this.request(`/workspaces/${workspaceId}/parties/${partyId}`, {
      method: 'DELETE'
    });
  }

  // Transactions
  getTransactions(workspaceId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/workspaces/${workspaceId}/transactions?${query}`);
  }

  addTransaction(workspaceId, txData) {
    return this.request(`/workspaces/${workspaceId}/transactions`, {
      method: 'POST',
      body: JSON.stringify(txData)
    });
  }

  updateTransaction(workspaceId, txId, txData) {
    return this.request(`/workspaces/${workspaceId}/transactions/${txId}`, {
      method: 'PUT',
      body: JSON.stringify(txData)
    });
  }

  deleteTransaction(workspaceId, txId) {
    return this.request(`/workspaces/${workspaceId}/transactions/${txId}`, {
      method: 'DELETE'
    });
  }

  // Executive Summary
  getExecutiveSummary(workspaceId) {
    return this.request(`/workspaces/${workspaceId}/summary`);
  }

  // Sync Engine
  pushSyncOutbox(workspaceId, deviceId, outboxItems) {
    return this.request(`/workspaces/${workspaceId}/sync/push`, {
      method: 'POST',
      body: JSON.stringify({ deviceId, outboxItems })
    });
  }

  pullSyncChanges(workspaceId, lastSyncedAt) {
    return this.request(`/workspaces/${workspaceId}/sync/pull?lastSyncedAt=${lastSyncedAt || ''}`);
  }

  // Attachments
  uploadAttachment(transactionId, file) {
    const formData = new FormData();
    formData.append('attachment', file);
    return this.request(`/transactions/${transactionId}/attachments`, {
      method: 'POST',
      body: formData
    });
  }

  // AI Assist — proxied through the backend so the Gemini key never ships
  // inside the client bundle (Vite would otherwise inline it in plain text).
  parseInvoiceImage(imageBase64, mimeType) {
    return this.request('/ai/parse-invoice', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, mimeType }),
      timeoutMs: 30000
    });
  }

  parseNaturalLanguagePrompt(text, partyNames) {
    return this.request('/ai/parse-text', {
      method: 'POST',
      body: JSON.stringify({ text, partyNames }),
      timeoutMs: 20000
    });
  }

  transcribeAudio(audioBase64, mimeType, languageCode) {
    return this.request('/ai/transcribe-audio', {
      method: 'POST',
      body: JSON.stringify({ audioBase64, mimeType, languageCode }),
      timeoutMs: 30000
    });
  }

  // Backup Telemetry
  getBackupTelemetry() {
    return this.request('/backups/telemetry');
  }

  createBackup() {
    return this.request('/backups/create', { method: 'POST' });
  }

  restoreBackup(backupId) {
    return this.request(`/backups/${backupId}/restore`, { method: 'POST' });
  }

  createUserBackup(workspaceId, backupData) {
    return this.request(`/workspaces/${workspaceId}/user-backups`, {
      method: 'POST',
      body: JSON.stringify(backupData)
    });
  }

  getUserBackups(workspaceId) {
    return this.request(`/workspaces/${workspaceId}/user-backups`);
  }
}

export const apiClient = new ApiClient();
