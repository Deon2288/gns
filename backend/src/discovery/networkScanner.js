'use strict';

/**
 * Network Scanner Module
 *
 * Supports:
 *   - Single IP            e.g. 192.168.1.100
 *   - CIDR notation        e.g. 192.168.1.0/24
 *   - Range notation       e.g. 192.168.1.1-192.168.1.254
 *   - Subnet notation      e.g. 192.168.1.0/255.255.255.0
 *
 * For each IP it probes the configured ports and runs protocol
 * fingerprinting to identify GPS devices.
 */

const net = require('net');
const { EventEmitter } = require('events');
const protocolDetector = require('./protocolDetector');

// Default ports associated with GPS devices
const DEFAULT_PORTS = [27015, 27016, 10110, 80, 8080, 1883, 5000];

// How many simultaneous connection attempts to allow
const DEFAULT_CONCURRENCY = 50;

// Connection attempt timeout (ms)
const DEFAULT_TIMEOUT_MS = 3000;

// ─────────────────────────────────────────────────────────────────────────────
// IP helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a dotted-decimal IPv4 string to a 32-bit unsigned integer.
 * @param {string} ip
 * @returns {number}
 */
function ipToLong(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Convert a 32-bit unsigned integer back to a dotted-decimal string.
 * @param {number} long
 * @returns {string}
 */
function longToIp(long) {
    return [
        (long >>> 24) & 0xff,
        (long >>> 16) & 0xff,
        (long >>> 8) & 0xff,
        long & 0xff,
    ].join('.');
}

/**
 * Validate that a string is a valid IPv4 address.
 * @param {string} ip
 * @returns {boolean}
 */
function isValidIp(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every((p) => {
        const n = parseInt(p, 10);
        return String(n) === p && n >= 0 && n <= 255;
    });
}

/**
 * Expand an IP range specification into an array of individual IPv4 strings.
 *
 * Supported formats:
 *   - Single IP:          "192.168.1.100"
 *   - CIDR:               "192.168.1.0/24"
 *   - Subnet mask:        "192.168.1.0/255.255.255.0"
 *   - Range:              "192.168.1.1-192.168.1.254"
 *                    or   "192.168.1.1-254"  (last-octet shorthand)
 *
 * @param {string} rangeStr
 * @returns {string[]}
 */
function expandIpRange(rangeStr) {
    const range = rangeStr.trim();

    // Range notation: "a.b.c.d-e.f.g.h" or "a.b.c.d-h" (short form)
    if (range.includes('-')) {
        const [startPart, endPart] = range.split('-');
        const startIp = startPart.trim();

        // Short form: "192.168.1.1-254"
        let endIp;
        if (endPart.includes('.')) {
            endIp = endPart.trim();
        } else {
            const prefix = startIp.substring(0, startIp.lastIndexOf('.') + 1);
            endIp = prefix + endPart.trim();
        }

        if (!isValidIp(startIp) || !isValidIp(endIp)) {
            throw new Error(`Invalid IP range: ${range}`);
        }

        const start = ipToLong(startIp);
        const end = ipToLong(endIp);
        if (start > end) {
            throw new Error(`Start IP must be less than or equal to end IP: ${range}`);
        }
        if (end - start > 65534) {
            throw new Error('IP range too large (max 65534 addresses)');
        }

        const ips = [];
        for (let i = start; i <= end; i++) {
            ips.push(longToIp(i));
        }
        return ips;
    }

    // CIDR notation: "a.b.c.d/prefix" or "a.b.c.d/mask"
    if (range.includes('/')) {
        const [ipPart, suffix] = range.split('/');
        const baseIp = ipPart.trim();

        if (!isValidIp(baseIp)) {
            throw new Error(`Invalid base IP in CIDR: ${range}`);
        }

        let prefixLen;
        if (suffix.includes('.')) {
            // Subnet mask form
            if (!isValidIp(suffix.trim())) {
                throw new Error(`Invalid subnet mask: ${suffix}`);
            }
            const maskLong = ipToLong(suffix.trim());
            // Count leading 1-bits
            let bits = 0;
            let m = maskLong;
            while (m & 0x80000000) {
                bits++;
                m = (m << 1) >>> 0;
            }
            prefixLen = bits;
        } else {
            prefixLen = parseInt(suffix.trim(), 10);
        }

        if (prefixLen < 0 || prefixLen > 32) {
            throw new Error(`Invalid prefix length: ${prefixLen}`);
        }
        if (prefixLen < 16) {
            throw new Error('Prefix length too small (min /16 to avoid huge scans)');
        }

        const hostCount = Math.pow(2, 32 - prefixLen);
        const networkAddr = (ipToLong(baseIp) & (~(hostCount - 1) >>> 0)) >>> 0;

        const ips = [];
        // Skip network address (i=0) and broadcast (i=hostCount-1)
        for (let i = 1; i < hostCount - 1; i++) {
            ips.push(longToIp(networkAddr + i));
        }
        return ips;
    }

    // Single IP
    if (!isValidIp(range)) {
        throw new Error(`Invalid IP address: ${range}`);
    }
    return [range];
}

// ─────────────────────────────────────────────────────────────────────────────
// Port / connection helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt a TCP connection to host:port.
 * Resolves with `true` if the port is open, `false` otherwise.
 *
 * @param {string}  host
 * @param {number}  port
 * @param {number}  timeoutMs
 * @returns {Promise<boolean>}
 */
function isPortOpen(host, port, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;

        const settle = (result) => {
            if (!settled) {
                settled = true;
                socket.destroy();
                resolve(result);
            }
        };

        socket.setTimeout(timeoutMs);
        socket.on('connect', () => settle(true));
        socket.on('timeout', () => settle(false));
        socket.on('error', () => settle(false));

        socket.connect(port, host);
    });
}

/**
 * Simple async semaphore to limit concurrent async tasks.
 */
class Semaphore {
    constructor(max) {
        this._max = max;
        this._count = 0;
        this._queue = [];
    }

    acquire() {
        return new Promise((resolve) => {
            if (this._count < this._max) {
                this._count++;
                resolve();
            } else {
                this._queue.push(resolve);
            }
        });
    }

    release() {
        this._count--;
        if (this._queue.length > 0) {
            this._count++;
            this._queue.shift()();
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scanner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan a list of IPs for open ports and identify GPS device protocols.
 *
 * Emits:
 *   'progress'  { scanned, total, found }
 *   'device'    { ip, port, protocol, manufacturer, deviceModel, firmwareVersion, imei, responseData }
 *   'done'      { devices[] }
 *   'error'     Error
 *
 * @param {object} options
 * @param {string}   options.ipRange          - IP range string
 * @param {number[]} [options.ports]          - Ports to scan
 * @param {number}   [options.timeoutMs]      - Per-connection timeout in ms
 * @param {number}   [options.concurrency]    - Max simultaneous connections
 * @param {string[]} [options.protocols]      - Protocols to probe: 'teltonika','nmea','http','mqtt'
 * @returns {EventEmitter}
 */
function scanNetwork(options = {}) {
    const {
        ipRange,
        ports = DEFAULT_PORTS,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        concurrency = DEFAULT_CONCURRENCY,
        protocols = ['teltonika', 'nmea', 'http', 'mqtt'],
    } = options;

    const emitter = new EventEmitter();

    setImmediate(async () => {
        try {
            const ips = expandIpRange(ipRange);
            const total = ips.length * ports.length;
            let scanned = 0;
            const foundDevices = [];
            const sem = new Semaphore(concurrency);

            const tasks = [];
            for (const ip of ips) {
                for (const port of ports) {
                    tasks.push(async () => {
                        await sem.acquire();
                        try {
                            const open = await isPortOpen(ip, port, timeoutMs);
                            if (open) {
                                // Try to identify the protocol / device
                                const deviceInfo = await protocolDetector.identify(ip, port, {
                                    timeoutMs,
                                    protocols,
                                });
                                const device = { ip, port, ...deviceInfo };
                                foundDevices.push(device);
                                emitter.emit('device', device);
                            }
                        } finally {
                            sem.release();
                            scanned++;
                            emitter.emit('progress', {
                                scanned,
                                total,
                                found: foundDevices.length,
                            });
                        }
                    });
                }
            }

            await Promise.all(tasks.map((t) => t()));
            emitter.emit('done', { devices: foundDevices });
        } catch (err) {
            emitter.emit('error', err);
        }
    });

    return emitter;
}

/**
 * Test a single IP:port combination and optionally probe the protocol.
 *
 * @param {string}  ip
 * @param {number}  port
 * @param {object}  [options]
 * @param {number}  [options.timeoutMs]
 * @param {string[]}[options.protocols]
 * @returns {Promise<{open: boolean, protocol?: string, manufacturer?: string, ...}>}
 */
async function testConnection(ip, port, options = {}) {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, protocols = ['teltonika', 'nmea', 'http', 'mqtt'] } = options;

    if (!isValidIp(ip)) {
        throw new Error(`Invalid IP address: ${ip}`);
    }
    if (port < 1 || port > 65535) {
        throw new Error(`Invalid port: ${port}`);
    }

    const open = await isPortOpen(ip, port, timeoutMs);
    if (!open) {
        return { open: false };
    }

    const deviceInfo = await protocolDetector.identify(ip, port, { timeoutMs, protocols });
    return { open: true, ...deviceInfo };
}

module.exports = { scanNetwork, testConnection, expandIpRange, isValidIp, ipToLong, longToIp };
