'use strict';

/**
 * Protocol Detector / Device Fingerprinting Module
 *
 * Probes a given IP:port and attempts to identify the GPS device protocol.
 * Supported probes: Teltonika AVL, NMEA 0183, HTTP, MQTT
 */

const net = require('net');
const http = require('http');

// ─────────────────────────────────────────────────────────────────────────────
// Teltonika probe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a Teltonika "fake IMEI" handshake packet.
 * The Teltonika codec expects the first message from a tracker to start with
 * two zero bytes followed by a 2-byte big-endian length and then the IMEI
 * as an ASCII string.  We send a probe packet and check whether the server
 * acknowledges with 0x01 (accepted) or 0x00 (denied).
 *
 * When probing a *server* that receives Teltonika data we instead check
 * whether the port is alive and returns any Teltonika-style response.
 */
function buildTeltonikaProbe() {
    // Minimal IMEI hello: 000F + 15-digit probe IMEI (ASCII)
    const imei = '000000000000000';
    const buf = Buffer.alloc(2 + 2 + imei.length);
    buf.writeUInt16BE(0, 0);          // preamble
    buf.writeUInt16BE(imei.length, 2); // length of IMEI
    buf.write(imei, 4, 'ascii');
    return buf;
}

/**
 * Attempt Teltonika protocol detection.
 * @param {string} ip
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<object|null>}  device info or null
 */
function probeTeltonika(ip, port, timeoutMs) {
    return new Promise((resolve) => {
        const probe = buildTeltonikaProbe();
        const socket = new net.Socket();
        let settled = false;
        let responseData = Buffer.alloc(0);

        const done = (result) => {
            if (!settled) {
                settled = true;
                socket.destroy();
                resolve(result);
            }
        };

        socket.setTimeout(timeoutMs);
        socket.on('timeout', () => done(null));
        socket.on('error', () => done(null));

        socket.on('data', (chunk) => {
            responseData = Buffer.concat([responseData, chunk]);
            // Teltonika server responds 0x01 to accept the IMEI
            if (responseData.length >= 1) {
                if (responseData[0] === 0x01 || responseData[0] === 0x00) {
                    done({
                        protocol: 'teltonika',
                        manufacturer: 'Teltonika',
                        deviceModel: 'Unknown Teltonika Device',
                        firmwareVersion: null,
                        imei: null,
                        responseData: { raw: responseData.toString('hex'), accepted: responseData[0] === 0x01 },
                    });
                }
            }
        });

        socket.connect(port, ip, () => {
            socket.write(probe);
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// NMEA probe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt NMEA 0183 protocol detection.
 * We send a $GPGGA request and look for any sentence starting with '$'.
 * @param {string} ip
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<object|null>}
 */
function probeNmea(ip, port, timeoutMs) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;
        let buffer = '';

        const done = (result) => {
            if (!settled) {
                settled = true;
                socket.destroy();
                resolve(result);
            }
        };

        socket.setTimeout(timeoutMs);
        socket.on('timeout', () => done(null));
        socket.on('error', () => done(null));

        socket.on('data', (chunk) => {
            buffer += chunk.toString('ascii');
            // Look for NMEA sentence pattern: $GPXXX or $GNXXX
            if (/\$G[PN][A-Z]{3}/.test(buffer)) {
                const sentences = buffer.match(/\$[A-Z]{5},[^\r\n]*/g) || [];
                done({
                    protocol: 'nmea',
                    manufacturer: 'NMEA Device',
                    deviceModel: 'NMEA 0183 Compatible',
                    firmwareVersion: null,
                    imei: null,
                    responseData: { sentences: sentences.slice(0, 5) },
                });
            }
        });

        socket.connect(port, ip, () => {
            // Send a generic poll request
            socket.write('$GPGGA,000000.00,0000.0000,N,00000.0000,E,0,00,99.0,0.0,M,0.0,M,,*00\r\n');
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP probe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt HTTP-based device detection by querying GET /status.
 * @param {string} ip
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<object|null>}
 */
function probeHttp(ip, port, timeoutMs) {
    return new Promise((resolve) => {
        let settled = false;

        const done = (result) => {
            if (!settled) {
                settled = true;
                resolve(result);
            }
        };

        const req = http.request(
            {
                host: ip,
                port,
                path: '/status',
                method: 'GET',
                timeout: timeoutMs,
                headers: { 'User-Agent': 'GNS-Discovery/1.0' },
            },
            (res) => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => {
                    let parsed = null;
                    try { parsed = JSON.parse(body); } catch (_) { /* not JSON */ }

                    const info = {
                        protocol: 'http',
                        manufacturer: parsed && parsed.manufacturer ? parsed.manufacturer : 'HTTP Device',
                        deviceModel: parsed && parsed.model ? parsed.model : 'HTTP-capable Device',
                        firmwareVersion: parsed && parsed.firmware ? parsed.firmware : null,
                        imei: parsed && parsed.imei ? parsed.imei : null,
                        responseData: {
                            statusCode: res.statusCode,
                            headers: res.headers,
                            body: parsed || body.substring(0, 200),
                        },
                    };
                    done(info);
                });
            }
        );

        req.on('timeout', () => { req.destroy(); done(null); });
        req.on('error', () => done(null));
        req.end();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// MQTT probe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt MQTT protocol detection by sending a CONNECT packet and looking for CONNACK.
 * MQTT CONNECT packet (minimal, protocol version 3.1.1).
 * @param {string} ip
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<object|null>}
 */
function probeMqtt(ip, port, timeoutMs) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;
        let responseData = Buffer.alloc(0);

        const done = (result) => {
            if (!settled) {
                settled = true;
                socket.destroy();
                resolve(result);
            }
        };

        // Minimal MQTT 3.1.1 CONNECT packet
        const clientId = 'gns-discovery';
        const connectPacket = Buffer.alloc(4 + 6 + 2 + clientId.length + 2);
        let offset = 0;
        // Fixed header: CONNECT (0x10), remaining length
        const remainingLength = 6 + 2 + clientId.length;
        connectPacket[offset++] = 0x10;
        connectPacket[offset++] = remainingLength;
        // Variable header: protocol name "MQTT", version 4, connect flags 0x02, keepalive 60
        connectPacket[offset++] = 0x00;
        connectPacket[offset++] = 0x04;
        connectPacket.write('MQTT', offset); offset += 4;
        connectPacket[offset++] = 0x04;  // protocol level
        connectPacket[offset++] = 0x02;  // clean session
        connectPacket[offset++] = 0x00;  // keepalive MSB
        connectPacket[offset++] = 60;    // keepalive LSB
        // Payload: client ID
        connectPacket[offset++] = 0x00;
        connectPacket[offset++] = clientId.length;
        connectPacket.write(clientId, offset);

        socket.setTimeout(timeoutMs);
        socket.on('timeout', () => done(null));
        socket.on('error', () => done(null));

        socket.on('data', (chunk) => {
            responseData = Buffer.concat([responseData, chunk]);
            // MQTT CONNACK is 0x20 followed by remaining length 0x02
            if (responseData.length >= 2 && responseData[0] === 0x20) {
                done({
                    protocol: 'mqtt',
                    manufacturer: 'MQTT Device',
                    deviceModel: 'MQTT-capable Device',
                    firmwareVersion: null,
                    imei: null,
                    responseData: { returnCode: responseData[3] || 0 },
                });
            }
        });

        socket.connect(port, ip, () => {
            socket.write(connectPacket);
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main identify function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Try each configured protocol probe and return the first successful match.
 * If no protocol is identified the device is still reported as 'unknown'.
 *
 * @param {string}   ip
 * @param {number}   port
 * @param {object}   options
 * @param {number}   options.timeoutMs
 * @param {string[]} options.protocols  - ordered list of protocols to attempt
 * @returns {Promise<object>}
 */
async function identify(ip, port, options = {}) {
    const { timeoutMs = 3000, protocols = ['teltonika', 'nmea', 'http', 'mqtt'] } = options;

    // Map probe names → functions and well-known port hints
    const probeMap = {
        teltonika: { fn: probeTeltonika, ports: [27015, 27016] },
        nmea:      { fn: probeNmea,      ports: [10110] },
        http:      { fn: probeHttp,      ports: [80, 8080, 5000] },
        mqtt:      { fn: probeMqtt,      ports: [1883, 8883] },
    };

    // Prioritise by port hint first
    const ordered = [...protocols].sort((a, b) => {
        const aHint = (probeMap[a] && probeMap[a].ports.includes(port)) ? -1 : 0;
        const bHint = (probeMap[b] && probeMap[b].ports.includes(port)) ? -1 : 0;
        return aHint - bHint;
    });

    for (const proto of ordered) {
        if (!probeMap[proto]) continue;
        try {
            const result = await probeMap[proto].fn(ip, port, timeoutMs);
            if (result) return result;
        } catch (_) {
            // probe failed – try next
        }
    }

    // No protocol matched – report generic open port
    return {
        protocol: 'unknown',
        manufacturer: null,
        deviceModel: null,
        firmwareVersion: null,
        imei: null,
        responseData: null,
    };
}

module.exports = { identify, probeTeltonika, probeNmea, probeHttp, probeMqtt };
