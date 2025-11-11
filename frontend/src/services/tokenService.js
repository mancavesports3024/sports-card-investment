const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-9efa.up.railway.app';

class TokenService {
  constructor() {
    this.refreshPromise = null;
  }

  // Get access token from localStorage
  getAccessToken() {
    return localStorage.getItem('authToken');
  }

  // Get refresh token from localStorage
  getRefreshToken() {
    return localStorage.getItem('refreshToken');
  }

  // Set both tokens in localStorage
  setTokens(accessToken, refreshToken) {
    localStorage.setItem('authToken', accessToken);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  // Clear all tokens
  clearTokens() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  }

  // Check if token is expired (with 5 minute buffer)
  isTokenExpired(token) {
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      const bufferTime = 5 * 60; // 5 minutes in seconds
      
      return payload.exp < (currentTime + bufferTime);
    } catch (error) {
      console.error('Error parsing token:', error);
      return true;
    }
  }

  // Refresh token with debouncing
  async refreshToken() {
    // If a refresh is already in progress, return the existing promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    this.refreshPromise = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        this.setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      } else {
        throw new Error(data.error || 'Token refresh failed');
      }
    })
    .finally(() => {
      // Clear the promise after completion
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  // Validate current token
  async validateToken() {
    const token = this.getAccessToken();
    if (!token) {
      return { valid: false, error: 'No token available' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/validate`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return { valid: true, user: data.user };
      } else {
        return { valid: false, error: 'Token validation failed' };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Get a valid token (refresh if needed)
  async getValidToken() {
    const token = this.getAccessToken();
    
    if (!token) {
      throw new Error('No access token available');
    }

    if (this.isTokenExpired(token)) {
      console.log('Token expired, refreshing...');
      return await this.refreshToken();
    }

    return token;
  }

  // Create authenticated fetch with automatic token refresh
  async authenticatedFetch(url, options = {}) {
    try {
      const token = await this.getValidToken();
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
        },
      });

      // If we get a 401, try refreshing the token once
      if (response.status === 401) {
        console.log('Received 401, attempting token refresh...');
        const newToken = await this.refreshToken();
        
        // Retry the request with the new token
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`,
          },
        });

        if (retryResponse.status === 401) {
          // If still 401 after refresh, clear tokens and throw error
          this.clearTokens();
          throw new Error('Authentication failed after token refresh');
        }

        return retryResponse;
      }

      return response;
    } catch (error) {
      if (error.message.includes('No refresh token available') || 
          error.message.includes('Authentication failed after token refresh')) {
        this.clearTokens();
      }
      throw error;
    }
  }
}

// Export singleton instance
const tokenService = new TokenService();
export default tokenService;