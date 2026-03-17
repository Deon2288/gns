'use strict';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class SimControlClient {
  constructor(apiKey, baseURL) {
    this._apiKey = apiKey;
    this.baseURL = baseURL || 'https://app.simcontrol.co.za/api';
    this._tokens = 10;
    this._lastRefill = Date.now();
    this._maxTokens = 10;
    this._refillRate = 10; // tokens per second
  }

  _headers() {
    return {
      Authorization: `Bearer ${this._apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /** Token-bucket rate limiter: max 10 req/s */
  async _acquireToken() {
    const now = Date.now();
    const elapsed = (now - this._lastRefill) / 1000;
    this._tokens = Math.min(this._maxTokens, this._tokens + elapsed * this._refillRate);
    this._lastRefill = now;

    if (this._tokens < 1) {
      const waitMs = ((1 - this._tokens) / this._refillRate) * 1000;
      await sleep(waitMs);
      this._tokens = 0;
    } else {
      this._tokens -= 1;
    }
  }

  async _request(method, path, body) {
    await this._acquireToken();

    const url = `${this.baseURL}${path}`;
    const options = {
      method,
      headers: this._headers(),
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[SimControl] ${method} ${path}`);
        const res = await fetch(url, options);

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`SimControl API error ${res.status}: ${text}`);
        }

        return await res.json();
      } catch (err) {
        lastError = err;
        if (attempt < 2) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
          console.warn(`[SimControl] Retry ${attempt + 1} after ${delay}ms - ${err.message}`);
          await sleep(delay);
        }
      }
    }

    throw new Error(`SimControl request failed after 3 attempts: ${lastError.message}`);
  }

  getSIMs() {
    return this._request('GET', '/sims');
  }

  getSIMById(simId) {
    return this._request('GET', `/sims/${simId}`);
  }

  getSIMUsage(simId) {
    return this._request('GET', `/sims/${simId}/usage`);
  }

  getSIMBalance(simId) {
    return this._request('GET', `/sims/${simId}/balance`);
  }

  suspendSIM(simId) {
    return this._request('POST', `/sims/${simId}/suspend`);
  }

  reactivateSIM(simId) {
    return this._request('POST', `/sims/${simId}/reactivate`);
  }

  updateSIMSettings(simId, settings) {
    return this._request('PUT', `/sims/${simId}/settings`, settings);
  }

  getWebhookEvents() {
    return this._request('GET', '/webhooks/events');
  }

  async validateConnection() {
    try {
      await this._request('GET', '/sims?limit=1');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = SimControlClient;
