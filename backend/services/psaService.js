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
        errorMessage = 'PSA API returned 500 – this often indicates invalid credentials';
      } else if (status === 204) {
        errorMessage = 'PSA API returned 204 – missing or invalid cert number';
      }

      return {
        success: false,
        status,
        error: errorMessage,
        details: typeof body === 'string' ? body : body?.ServerMessage || body,
      };
    }
  }
}

module.exports = new PsaService();

