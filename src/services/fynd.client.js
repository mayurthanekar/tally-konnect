// src/services/fynd.client.js
// Fynd Commerce Platform API client with multi-auth support
const axios = require('axios');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryption');
const { FyndAuthError, FyndApiError } = require('../utils/errors');

class FyndApiClient {
  constructor(apiConfig) {
    this.config = apiConfig;
    this.tokenCache = null;
    this.tokenExpiry = null;
  }

  /**
   * Build auth headers based on config auth type
   */
  async getAuthHeaders() {
    const cfg = this.config;

    switch (cfg.auth_type) {
      case 'bearer': {
        const token = cfg.bearer_token_enc ? decrypt(cfg.bearer_token_enc) : '';
        if (!token) throw new FyndAuthError('Bearer token not configured');
        return { Authorization: `Bearer ${token}` };
      }

      case 'api_key': {
        const key = cfg.api_key_enc ? decrypt(cfg.api_key_enc) : '';
        const header = cfg.api_key_header || 'x-api-key';
        if (!key) throw new FyndAuthError('API key not configured');
        return { [header]: key };
      }

      case 'basic': {
        const username = cfg.username_enc ? decrypt(cfg.username_enc) : '';
        const password = cfg.password_enc ? decrypt(cfg.password_enc) : '';
        if (!username) throw new FyndAuthError('Basic auth credentials not configured');
        const encoded = Buffer.from(`${username}:${password}`).toString('base64');
        return { Authorization: `Basic ${encoded}` };
      }

      case 'oauth2': {
        const token = await this.getOAuth2Token();
        return { Authorization: `Bearer ${token}` };
      }

      default:
        return {};
    }
  }

  /**
   * OAuth2 client credentials flow with token caching
   */
  async getOAuth2Token() {
    // Return cached token if still valid
    if (this.tokenCache && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.tokenCache;
    }

    const cfg = this.config;
    const clientId = cfg.client_id_enc ? decrypt(cfg.client_id_enc) : '';
    const clientSecret = cfg.client_secret_enc ? decrypt(cfg.client_secret_enc) : '';
    const tokenUrl = cfg.token_url;
    const scope = cfg.scope || '';

    if (!clientId || !tokenUrl) {
      throw new FyndAuthError('OAuth2 client ID or token URL not configured');
    }

    try {
      const response = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        ...(scope && { scope }),
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      });

      const { access_token, expires_in } = response.data;
      this.tokenCache = access_token;
      // Cache with 60s buffer before actual expiry
      this.tokenExpiry = Date.now() + ((expires_in || 3600) - 60) * 1000;

      return access_token;
    } catch (err) {
      throw new FyndAuthError(`OAuth2 token request failed: ${err.message}`);
    }
  }

  /**
   * Make authenticated request to Fynd API
   */
  async request(method, url, data = null, params = null) {
    const authHeaders = await this.getAuthHeaders();
    let customHeaders = {};

    try {
      customHeaders = JSON.parse(this.config.headers_json || '{}');
    } catch { /* ignore invalid JSON */ }

    try {
      const response = await axios({
        method: method || this.config.method || 'POST',
        url: url || this.config.endpoint,
        data,
        params,
        headers: { ...customHeaders, ...authHeaders },
        timeout: this.config.timeout_ms || 30000,
      });

      return response.data;
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        // Clear cached token and retry once
        this.tokenCache = null;
        this.tokenExpiry = null;
        throw new FyndAuthError(err.response?.data?.message || 'Authentication failed');
      }
      throw new FyndApiError(err.response?.data || err.message);
    }
  }

  /**
   * Fetch paginated data from Fynd
   */
  async fetchAll(url, params = {}, pageKey = 'page', itemsKey = 'items') {
    const allItems = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await this.request('GET', url, null, { ...params, [pageKey]: page });
      const items = data[itemsKey] || data.data || data.results || [];

      if (items.length === 0) {
        hasMore = false;
      } else {
        allItems.push(...items);
        page++;
        // Safety limit
        if (page > 100) {
          logger.warn('Pagination safety limit reached (100 pages)');
          hasMore = false;
        }
      }
    }

    return allItems;
  }

  /**
   * Test if the configured endpoint is reachable
   */
  async testConnection() {
    try {
      const authHeaders = await this.getAuthHeaders();
      const start = Date.now();

      const response = await axios({
        method: 'GET',
        url: this.config.endpoint,
        headers: { ...JSON.parse(this.config.headers_json || '{}'), ...authHeaders },
        timeout: 10000,
        validateStatus: () => true,
      });

      return {
        success: response.status >= 200 && response.status < 500,
        statusCode: response.status,
        responseTimeMs: Date.now() - start,
        message: response.status < 400 ? 'Connection successful' : `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        success: false,
        statusCode: 0,
        responseTimeMs: 0,
        message: err.message,
      };
    }
  }
}

module.exports = FyndApiClient;
