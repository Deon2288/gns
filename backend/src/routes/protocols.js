const express = require('express');
const router = express.Router();

// Supported protocols registry
const SUPPORTED_PROTOCOLS = {
    teltonika: {
        name: 'Teltonika',
        description: 'Teltonika FMB/FMT series GPS trackers (primary)',
        port: 5027,
        codec: 'codec8',
        manufacturer: 'Teltonika',
        supported_models: ['FMB125', 'FMB920', 'FMT100', 'FMB140', 'FMB003', 'FMB920R', 'FMB130', 'FMB110'],
        features: ['gps', 'io', 'gsm', 'obd', 'can'],
    },
    nmea: {
        name: 'NMEA 0183',
        description: 'Standard marine/GPS NMEA 0183 protocol',
        port: 10110,
        codec: 'nmea0183',
        manufacturer: 'Various',
        supported_models: ['Generic NMEA'],
        features: ['gps'],
    },
    http: {
        name: 'HTTP/REST',
        description: 'HTTP-based GPS reporting devices',
        port: 8080,
        codec: 'http_json',
        manufacturer: 'Various',
        supported_models: ['Generic HTTP'],
        features: ['gps', 'telemetry'],
    },
    mqtt: {
        name: 'MQTT',
        description: 'MQTT-based IoT GPS devices',
        port: 1883,
        codec: 'mqtt_json',
        manufacturer: 'Various',
        supported_models: ['Generic MQTT'],
        features: ['gps', 'telemetry', 'events'],
    },
    gt06: {
        name: 'GT06/GT06N',
        description: 'Concox GT06 protocol (widely used in China-made trackers)',
        port: 5013,
        codec: 'gt06',
        manufacturer: 'Concox',
        supported_models: ['GT06', 'GT06N', 'GT06E', 'WeTrack2'],
        features: ['gps', 'gsm', 'events'],
    },
    osmand: {
        name: 'OsmAnd',
        description: 'OsmAnd mobile tracking protocol',
        port: 5055,
        codec: 'osmand',
        manufacturer: 'OsmAnd',
        supported_models: ['Android App', 'iOS App'],
        features: ['gps'],
    },
    wialon: {
        name: 'Wialon IPS',
        description: 'Wialon IPS (Internet Protocol for GPS) protocol',
        port: 20332,
        codec: 'wialon_ips',
        manufacturer: 'Various',
        supported_models: ['Generic Wialon IPS'],
        features: ['gps', 'telemetry', 'events'],
    },
};

// ─── Protocol Listing ────────────────────────────────────────────────────────

// Get all supported protocols
router.get('/', (req, res) => {
    const protocols = Object.entries(SUPPORTED_PROTOCOLS).map(([id, info]) => ({
        protocol_id: id,
        ...info,
    }));
    res.json({ protocols, total: protocols.length });
});

// Get details for a specific protocol
router.get('/:protocolId', (req, res) => {
    const proto = SUPPORTED_PROTOCOLS[req.params.protocolId];
    if (!proto) {
        return res.status(404).json({ message: 'Protocol not supported', supported: Object.keys(SUPPORTED_PROTOCOLS) });
    }
    res.json({ protocol_id: req.params.protocolId, ...proto });
});

// ─── Protocol Detection ──────────────────────────────────────────────────────

// Detect the protocol a discovered device is using
router.post('/detect', (req, res) => {
    const { ip, port, manufacturer, model } = req.body;

    if (!ip) return res.status(400).json({ message: 'ip is required' });

    // Port-based detection
    const portMap = {};
    Object.entries(SUPPORTED_PROTOCOLS).forEach(([id, proto]) => {
        portMap[proto.port] = id;
    });

    if (port && portMap[port]) {
        const detectedId = portMap[port];
        return res.json({
            detected_protocol: detectedId,
            confidence: 'high',
            method: 'port_match',
            ...SUPPORTED_PROTOCOLS[detectedId],
        });
    }

    // Manufacturer-based detection
    if (manufacturer) {
        for (const [id, proto] of Object.entries(SUPPORTED_PROTOCOLS)) {
            if (proto.manufacturer.toLowerCase() === manufacturer.toLowerCase()) {
                return res.json({
                    detected_protocol: id,
                    confidence: 'medium',
                    method: 'manufacturer_match',
                    ...proto,
                });
            }
        }
    }

    // Default to teltonika as primary
    res.json({
        detected_protocol: 'teltonika',
        confidence: 'low',
        method: 'default_fallback',
        ...SUPPORTED_PROTOCOLS.teltonika,
    });
});

// ─── Teltonika Codec8 Parser ─────────────────────────────────────────────────

// Parse a Teltonika Codec8 hex data packet (simplified)
router.post('/teltonika/parse', (req, res) => {
    const { hex_data, imei } = req.body;

    if (!hex_data) return res.status(400).json({ message: 'hex_data is required' });

    try {
        const parsed = parseTeltonikaCodec8(hex_data, imei);
        res.json(parsed);
    } catch (err) {
        res.status(400).json({ message: 'Failed to parse Codec8 data', error: err.message });
    }
});

// ─── NMEA Parser ─────────────────────────────────────────────────────────────

// Parse an NMEA sentence
router.post('/nmea/parse', (req, res) => {
    const { sentence } = req.body;

    if (!sentence) return res.status(400).json({ message: 'sentence is required' });

    try {
        const parsed = parseNMEASentence(sentence);
        res.json(parsed);
    } catch (err) {
        res.status(400).json({ message: 'Failed to parse NMEA sentence', error: err.message });
    }
});

// ─── Protocol Parsers ────────────────────────────────────────────────────────

function parseTeltonikaCodec8(hex, imei) {
    // Simplified Codec8 parser — real implementation requires full binary parsing
    if (typeof hex !== 'string' || hex.length < 16) {
        throw new Error('Invalid hex data length');
    }

    // Strip preamble (8 zeros) and data field length (4 bytes)
    const dataLength = parseInt(hex.slice(8, 16), 16);
    const codecId = parseInt(hex.slice(16, 18), 16);
    const recordCount = parseInt(hex.slice(18, 20), 16);

    return {
        imei: imei || 'unknown',
        codec_id: `0x${codecId.toString(16).toUpperCase()}`,
        record_count: recordCount,
        data_length: dataLength,
        raw_hex: hex,
        note: 'Simplified parse — full binary decoding requires Codec8 library',
    };
}

function parseNMEASentence(sentence) {
    const sentenceTrimmed = sentence.trim();
    if (!sentenceTrimmed.startsWith('$')) {
        throw new Error('Invalid NMEA sentence: must start with $');
    }

    const parts = sentenceTrimmed.split(',');
    const type = parts[0].slice(1); // remove $

    if (type === 'GPRMC' || type === 'GNRMC') {
        return {
            type,
            time: parts[1],
            status: parts[2],  // A=active, V=void
            latitude: parseNMEALatLon(parts[3], parts[4]),
            longitude: parseNMEALatLon(parts[5], parts[6]),
            speed_knots: parseFloat(parts[7]) || 0,
            course: parseFloat(parts[8]) || 0,
            date: parts[9],
        };
    }

    if (type === 'GPGGA' || type === 'GNGGA') {
        return {
            type,
            time: parts[1],
            latitude: parseNMEALatLon(parts[2], parts[3]),
            longitude: parseNMEALatLon(parts[4], parts[5]),
            fix_quality: parseInt(parts[6]) || 0,
            satellites: parseInt(parts[7]) || 0,
            altitude: parseFloat(parts[9]) || 0,
            altitude_unit: parts[10] || 'M',
        };
    }

    return { type, raw: sentence_trimmed };
}

function parseNMEALatLon(value, direction) {
    if (!value) return null;
    const deg = parseInt(value.slice(0, value.indexOf('.') - 2));
    const min = parseFloat(value.slice(value.indexOf('.') - 2));
    let decimal = deg + min / 60;
    if (direction === 'S' || direction === 'W') decimal = -decimal;
    return parseFloat(decimal.toFixed(6));
}

module.exports = router;
module.exports.SUPPORTED_PROTOCOLS = SUPPORTED_PROTOCOLS;
