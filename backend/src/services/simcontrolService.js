const https = require('https');
const http = require('http');
const config = require('../config/simcontrol');

// Simple in-memory cache
const cache = new Map();

/**
 * Make an HTTP/HTTPS request to the SimControl API
 */
function makeRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        if (!config.apiKey) {
            return reject(new Error('SIMCONTROL_API_KEY is not configured'));
        }

        const url = new URL(config.apiUrl + path);
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: method.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
                'X-API-Key': config.apiKey,
                'Accept': 'application/json',
            },
        };

        const bodyStr = body ? JSON.stringify(body) : null;
        if (bodyStr) {
            options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
        }

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(Object.assign(new Error(parsed.message || `HTTP ${res.statusCode}`), {
                            statusCode: res.statusCode,
                            response: parsed,
                        }));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(config.timeout, () => {
            req.destroy(new Error('Request timed out'));
        });

        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

/**
 * Request with exponential backoff retry
 */
async function requestWithRetry(method, path, body, attempt = 1) {
    try {
        return await makeRequest(method, path, body);
    } catch (err) {
        if (attempt < config.retryAttempts && err.statusCode !== 400 && err.statusCode !== 404) {
            const delay = config.retryDelay * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, delay));
            return requestWithRetry(method, path, body, attempt + 1);
        }
        throw err;
    }
}

/**
 * Cached GET request
 */
async function cachedGet(path) {
    const now = Date.now();
    const cached = cache.get(path);
    if (cached && now - cached.ts < config.cacheTtl * 1000) {
        return cached.data;
    }
    const data = await requestWithRetry('GET', path);
    cache.set(path, { data, ts: now });
    return data;
}

/**
 * Make a GraphQL request to SimControl
 */
async function graphqlRequest(query, variables) {
    const graphqlPath = config.graphqlUrl.replace(config.apiUrl, '');
    return requestWithRetry('POST', graphqlPath, { query, variables });
}

// -------------------------
// SIM Operations
// -------------------------

/**
 * Get all SIMs for the account
 */
async function getAllSims() {
    return cachedGet(config.endpoints.sims);
}

/**
 * Get SIM details by SimControl SIM ID
 */
async function getSimDetails(simId) {
    return cachedGet(config.endpoints.simDetails.replace(':id', simId));
}

/**
 * Get SIM usage data
 */
async function getSimUsage(simId) {
    return cachedGet(config.endpoints.simUsage.replace(':id', simId));
}

/**
 * Get SIM usage history
 */
async function getSimHistory(simId) {
    return cachedGet(config.endpoints.simHistory.replace(':id', simId));
}

/**
 * Get SIM balance/billing info
 */
async function getSimBalance(simId) {
    return cachedGet(config.endpoints.simBalance.replace(':id', simId));
}

/**
 * Suspend a SIM
 */
async function suspendSim(simId) {
    cache.delete(config.endpoints.simDetails.replace(':id', simId));
    return requestWithRetry('POST', config.endpoints.simSuspend.replace(':id', simId));
}

/**
 * Reactivate a SIM
 */
async function reactivateSim(simId) {
    cache.delete(config.endpoints.simDetails.replace(':id', simId));
    return requestWithRetry('POST', config.endpoints.simReactivate.replace(':id', simId));
}

/**
 * Get SIM events/logs
 */
async function getSimEvents(simId) {
    return cachedGet(config.endpoints.simEvents.replace(':id', simId));
}

/**
 * Clear the entire cache (useful after a full sync)
 */
function clearCache() {
    cache.clear();
}

module.exports = {
    getAllSims,
    getSimDetails,
    getSimUsage,
    getSimHistory,
    getSimBalance,
    suspendSim,
    reactivateSim,
    getSimEvents,
    graphqlRequest,
    clearCache,
};
