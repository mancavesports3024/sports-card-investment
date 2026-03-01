// PSA Service: wrapper around PSA Public API
// Docs: https://www.psacard.com/publicapi/documentation
// Base URL: https://api.psacard.com/publicapi/
//
// NOTE:
// - You must generate an access token from your PSA account:
//   https://www.psacard.com/publicapi
// - Then set PSA_API_TOKEN in your .env file:
//   PSA_API_TOKEN=your_token_here

const axios = require('axios');

class PsaService {
  constructor() {
    this.baseUrl = 'https://api.psacard.com/publicapi';
    this.timeoutMs = 15000;
  }

  getAuthHeader() {
    const token = process.env.PSA_API_TOKEN;
    if (!token) {
      throw new Error(
        'PSA_API_TOKEN is not set. Generate a token at https://www.psacard.com/publicapi and add it to your .env file.'
      );
    }

    return {
      Authorization: `bearer ${token}`,
    };
  }

  /**
   * Look up a PSA cert by cert number.
   * This uses the official public API method:
   *   GET /cert/GetByCertNumber/{certNumber}
   *
   * @param {string|number} certNumber
   * @returns {Promise<{success: boolean, data?: any, error?: string, status?: number}>}
   */
  async getCertByNumber(certNumber) {
    if (!certNumber) {
      return {
        success: false,
        error: 'Missing cert number',
      };
    }

    const trimmed = String(certNumber).trim();
    if (!/^\d+$/.test(trimmed)) {
      return {
        success: false,
        error: 'Cert number must be numeric',
      };
    }

    const url = `${this.baseUrl}/cert/GetByCertNumber/${encodeURIComponent(trimmed)}`;

    try {
      console.log(`🔎 PSA cert lookup: ${trimmed}`);

      const response = await axios.get(url, {
        headers: this.getAuthHeader(),
        timeout: this.timeoutMs,
      });

      return {
        success: true,
        status: response.status,
        data: response.data,
      };
    } catch (error) {
      const status = error.response?.status;
      const body = error.response?.data;

      console.error('❌ PSA API error:', {
        message: error.message,
        status,
        body,
      });

      let errorMessage = 'Failed to fetch cert from PSA API';
      if (status === 500) {
        errorMessage = 'PSA API returned 500 – often invalid or expired token; refresh at https://www.psacard.com/publicapi';
      } else if (status === 401) {
        errorMessage = 'PSA API returned 401 – token missing or invalid';
      } else if (status === 204) {
        errorMessage = 'PSA API returned 204 – missing or invalid cert number';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Could not reach PSA API (network error)';
      }

      // Surface PSA's message or axios error so caller can debug
      let details = null;
      if (body != null) {
        details = typeof body === 'string' ? body : (body.ServerMessage || body.message || JSON.stringify(body));
      } else if (error.message) {
        details = error.message;
      }

      return {
        success: false,
        status,
        error: errorMessage,
        details,
      };
    }
  }

  /**
   * Generic GET helper for PSA API (same auth and error handling as cert lookup).
   * @param {string} path - e.g. '/pop/GetSports' or '/pop/GetBrands'
   * @returns {Promise<{success: boolean, data?: any, error?: string, status?: number, details?: any}>}
   */
  async _get(path) {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    try {
      const response = await axios.get(url, {
        headers: this.getAuthHeader(),
        timeout: this.timeoutMs,
      });
      return { success: true, status: response.status, data: response.data };
    } catch (error) {
      const status = error.response?.status;
      const body = error.response?.data;
      console.error('❌ PSA API error:', { path, message: error.message, status, body });
      let details = null;
      if (body != null) {
        details = typeof body === 'string' ? body : (body.ServerMessage || body.message || JSON.stringify(body));
      } else if (error.message) {
        details = error.message;
      }
      return {
        success: false,
        status,
        error: error.response ? `PSA API error (${status})` : error.message || 'Request failed',
        details,
      };
    }
  }

  // --- Population Report (from Postman/Swagger) ---

  /** GET /pop/GetSports - All sports in the population report */
  async getSports() {
    return this._get('/pop/GetSports');
  }

  /** GET /pop/GetBrands - All brands */
  async getBrands() {
    return this._get('/pop/GetBrands');
  }

  /** GET /pop/GetSetsByYear/{year} - Sets for a given year (e.g. 2023) */
  async getSetsByYear(year) {
    if (!year) return { success: false, error: 'Missing year' };
    return this._get(`/pop/GetSetsByYear/${encodeURIComponent(year)}`);
  }

  /** GET /pop/GetSetsByBrand/{brandId} - Sets for a brand */
  async getSetsByBrand(brandId) {
    if (!brandId) return { success: false, error: 'Missing brandId' };
    return this._get(`/pop/GetSetsByBrand/${encodeURIComponent(brandId)}`);
  }

  /** GET /pop/GetSetInfo/{setId} - Info for a specific set */
  async getSetInfo(setId) {
    if (!setId) return { success: false, error: 'Missing setId' };
    return this._get(`/pop/GetSetInfo/${encodeURIComponent(setId)}`);
  }

  /** GET /pop/GetPopulationReport/{setId} - Population report for a set (grades, etc.) */
  async getPopulationReport(setId) {
    if (!setId) return { success: false, error: 'Missing setId' };
    return this._get(`/pop/GetPopulationReport/${encodeURIComponent(setId)}`);
  }

  // --- Card lookup by order ---

  /** GET /cert/GetByOrder/{orderNumber} - All cards in a PSA order */
  async getCardsByOrder(orderNumber) {
    if (!orderNumber) return { success: false, error: 'Missing order number' };
    return this._get(`/cert/GetByOrder/${encodeURIComponent(orderNumber)}`);
  }

  // --- SMR Pricing ---

  /** GET /smr/GetSMRPriceByCertNumber/{certNumber} - SMR price for a cert */
  async getSMRPriceByCertNumber(certNumber) {
    if (!certNumber) return { success: false, error: 'Missing cert number' };
    const trimmed = String(certNumber).trim();
    if (!/^\d+$/.test(trimmed)) return { success: false, error: 'Cert number must be numeric' };
    return this._get(`/smr/GetSMRPriceByCertNumber/${encodeURIComponent(trimmed)}`);
  }
}

module.exports = new PsaService();

