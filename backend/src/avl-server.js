const net = require('net');
const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
    user: process.env.DB_USER || 'gns_user',
    password: process.env.DB_PASSWORD || 'gns_password',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'gns_database'
});

pool.on('error', (err) => {
    console.error('Pool error:', err);
});

const AVL_PORT = 5027;
const AVL_HOST = '0.0.0.0';

// AVL Protocol Parser
class AVLParser {
    // Teltonika sends IMEI length first (2 bytes), then IMEI as ASCII string
    static parseIMEI(buffer) {
        try {
            if (buffer.length < 2) return null;
            
            // First 2 bytes = IMEI length (big-endian)
            const imeiLength = buffer.readUInt16BE(0);
            
            if (buffer.length < 2 + imeiLength) return null;
            
            // Read IMEI as ASCII starting at offset 2
            const imei = buffer.toString('ascii', 2, 2 + imeiLength);
            
            // Validate IMEI (should be 15 digits)
            if (!/^\d{15}$/.test(imei)) {
                console.log(`⚠️ Invalid IMEI format: ${imei}`);
                return null;
            }
            
            return imei;
        } catch (err) {
            console.error('Error parsing IMEI:', err);
            return null;
        }
    }

    static parseAVLData(buffer) {
        try {
            let offset = 0;

            // Skip preamble (4 bytes)
            if (buffer.length < 8) return null;
            offset += 4;

            // Read data length (4 bytes, big-endian)
            const dataLength = buffer.readUInt32BE(offset);
            offset += 4;

            // Check if we have the complete message
            if (buffer.length < offset + dataLength + 4) return null;

            const data = buffer.slice(offset, offset + dataLength);
            const records = [];

            let pos = 0;

            // Skip codec ID (1 byte)
            if (data.length < 1) return null;
            const codecId = data[pos];
            pos += 1;

            // Read number of records (1 byte)
            if (data.length < pos + 1) return null;
            const recordCount = data[pos];
            pos += 1;

            // Parse each record
            for (let i = 0; i < recordCount && pos < data.length; i++) {
                const record = {};

                // Timestamp (8 bytes, big-endian, milliseconds since epoch)
                if (pos + 8 > data.length) break;
                const timestampMs = Number(data.readBigInt64BE(pos));
                record.timestamp = new Date(timestampMs);
                pos += 8;

                // Priority (1 byte)
                if (pos + 1 > data.length) break;
                record.priority = data[pos];
                pos += 1;

                // Longitude (4 bytes, big-endian, signed integer, divide by 10^7)
                if (pos + 4 > data.length) break;
                const lonRaw = data.readInt32BE(pos);
                record.longitude = lonRaw / 10000000.0;
                pos += 4;

                // Latitude (4 bytes, big-endian, signed integer, divide by 10^7)
                if (pos + 4 > data.length) break;
                const latRaw = data.readInt32BE(pos);
                record.latitude = latRaw / 10000000.0;
                pos += 4;

                // Altitude (2 bytes, big-endian, signed)
                if (pos + 2 > data.length) break;
                record.altitude = data.readInt16BE(pos);
                pos += 2;

                // Angle (2 bytes, big-endian)
                if (pos + 2 > data.length) break;
                record.angle = data.readUInt16BE(pos);
                pos += 2;

                // Satellites (1 byte)
                if (pos + 1 > data.length) break;
                record.satellites = data[pos];
                pos += 1;

                // Speed (2 bytes, big-endian, in km/h)
                if (pos + 2 > data.length) break;
                record.speed = data.readUInt16BE(pos);
                pos += 2;

                // Event IO ID (2 bytes)
                if (pos + 2 > data.length) break;
                const eventId = data.readUInt16BE(pos);
                pos += 2;

                // Number of IO element groups (1 byte)
                if (pos + 1 > data.length) break;
                const ioGroupCount = data[pos];
                pos += 1;

                // Skip IO elements
                for (let j = 0; j < ioGroupCount && pos < data.length; j++) {
                    if (pos + 1 > data.length) break;
                    const ioGroupId = data[pos];
                    pos += 1;

                    // Number of elements in this group
                    if (pos + 1 > data.length) break;
                    const ioCount = data[pos];
                    pos += 1;

                    // Skip each IO element
                    for (let k = 0; k < ioCount && pos < data.length; k++) {
                        if (pos + 1 > data.length) break;
                        const ioId = data[pos];
                        pos += 1;

                        // IO element size based on ID
                        let ioSize = 1;
                        if (ioId <= 254) {
                            if (ioId <= 100) ioSize = 1;      // 1-byte
                            else if (ioId <= 200) ioSize = 2; // 2-byte
                            else if (ioId <= 300) ioSize = 4; // 4-byte
                            else ioSize = 8;                  // 8-byte
                        }

                        if (pos + ioSize > data.length) break;
                        pos += ioSize;
                    }
                }

                // Only add valid records
                if (record.latitude !== undefined && record.longitude !== undefined &&
                    !isNaN(record.latitude) && !isNaN(record.longitude) &&
                    record.latitude >= -90 && record.latitude <= 90 &&
                    record.longitude >= -180 && record.longitude <= 180) {
                    records.push(record);
                }
            }

            return { codecId, records };
        } catch (err) {
            console.error('Error parsing AVL data:', err);
            return null;
        }
    }


// TCP Server
const server = net.createServer(async (socket) => {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    let deviceIMEI = null;
    let imeiReceived = false;
    let buffer = Buffer.alloc(0);

    console.log(`📱 New connection from ${clientId}`);

    socket.on('data', async (chunk) => {
        try {
            // Append chunk to buffer
            buffer = Buffer.concat([buffer, chunk]);

            // First message should be IMEI
            if (!imeiReceived) {
                if (buffer.length < 2) return; // Need at least 2 bytes for length
                
                const imeiLength = buffer.readUInt16BE(0);
                if (buffer.length < 2 + imeiLength) return; // Wait for full IMEI
                
                deviceIMEI = AVLParser.parseIMEI(buffer);
                
                if (!deviceIMEI) {
                    console.log(`❌ Failed to parse IMEI from ${clientId}`);
                    socket.write(Buffer.from([0x00]));
                    socket.end();
                    return;
                }

                imeiReceived = true;
                buffer = buffer.slice(2 + imeiLength); // Remove IMEI from buffer

                console.log(`🔍 Device IMEI: ${deviceIMEI} from ${clientId}`);

                // Check if device exists
                const result = await pool.query(
                    'SELECT device_id FROM devices WHERE imei = $1',
                    [deviceIMEI]
                );

                if (result.rows.length > 0) {
                    socket.write(Buffer.from([0x01]));
                    console.log(`✅ IMEI ${deviceIMEI} registered`);
                } else {
                    // Auto-register device
                    const newDevice = await pool.query(
                        'INSERT INTO devices (user_id, device_name, imei, status) VALUES ($1, $2, $3, $4) RETURNING device_id',
                        [1, `Device ${deviceIMEI}`, deviceIMEI, 'active']
                    );
                    socket.write(Buffer.from([0x01]));
                    console.log(`✨ Auto-registered device ${deviceIMEI}`);
                }
                return;
            }

            // Parse AVL data packets
                while (buffer.length >= 8) {
                    // Log the first few bytes in hex for debugging
                    if (buffer.length >= 20) {
                        console.log(`🔍 Buffer (first 20 bytes hex):`, buffer.slice(0, 20).toString('hex'));
                    }

                    // Check for preamble
                    if (buffer.readUInt32BE(0) !== 0) {
                        console.log(`⚠️ No preamble found, skipping byte`);
                        buffer = buffer.slice(1);
                        continue;
                    }

                    const dataLength = buffer.readUInt32BE(4);
                    console.log(`📦 Data length: ${dataLength}, Buffer length: ${buffer.length}`);
                    
                    const totalLength = 4 + 4 + dataLength + 4;

                    if (buffer.length < totalLength) {
                        console.log(`⏳ Incomplete packet, waiting... (have ${buffer.length}, need ${totalLength})`);
                        break;
                    }

                    const packet = buffer.slice(0, totalLength);
                    buffer = buffer.slice(totalLength);

                    const avlData = AVLParser.parseAVLData(packet);
                    if (!avlData) {
                        console.log(`❌ Failed to parse AVL data`);
                        continue;
                    }

                    const { records } = avlData;
                    console.log(`✅ Parsed ${records.length} records from packet`);
                    
                    // Log first record for debugging
                    if (records.length > 0) {
                        console.log(`📍 Sample record:`, JSON.stringify(records[0], null, 2));
                    }

                                 // Insert GPS records
                for (const record of records) {
                    try {
                        // Strict validation
                        const lat = parseFloat(record.latitude);
                        const lon = parseFloat(record.longitude);
                        const speed = parseInt(record.speed) || 0;
                        const alt = parseInt(record.altitude) || 0;
                        
                        // Validate coordinates are within valid ranges
                        if (isNaN(lat) || isNaN(lon)) {
                            console.log(`⚠️ NaN coordinates detected, skipping`);
                            continue;
                        }
                        
                        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                            console.log(`⚠️ Out of bounds: ${lat}, ${lon}, skipping`);
                            continue;
                        }

                        // Validate speed (should be < 300 km/h for vehicles)
                        if (speed > 300) {
                            console.log(`⚠️ Speed ${speed} km/h invalid, skipping`);
                            continue;
                        }

                        // Validate altitude (should be between -500 and 10000 meters)
                        if (alt < -500 || alt > 10000) {
                            console.log(`⚠️ Altitude ${alt}m invalid, skipping`);
                            continue;
                        }

                        let timestamp = record.timestamp;
                        if (!timestamp || isNaN(timestamp.getTime()) || timestamp.getFullYear() < 2020 || timestamp.getFullYear() > 2030) {
                            console.log(`⚠️ Invalid timestamp, using current time`);
                            timestamp = new Date();
                        }

                        await pool.query(
                            `INSERT INTO gps_tracking (device_id, latitude, longitude, altitude, speed, course, satellites, timestamp) 
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                            [
                                device_id,
                                lat,
                                lon,
                                alt,
                                speed,
                                record.angle || 0,
                                record.satellites || 0,
                                timestamp
                            ]
                        );
                        
                        console.log(`✅ GPS inserted [${deviceIMEI}]: ${lat.toFixed(4)}, ${lon.toFixed(4)}, Speed: ${speed} km/h`);
                    } catch (insertErr) {
                        console.error(`Error inserting GPS:`, insertErr.message);
                    }
                }
                        // Validate data
                        if (record.latitude < -90 || record.latitude > 90 ||
                            record.longitude < -180 || record.longitude > 180) {
                            console.log(`⚠️ Invalid GPS coordinates: ${record.latitude}, ${record.longitude}`);
                            continue;
                        }

                        let timestamp = record.timestamp;
                        if (!timestamp || isNaN(timestamp.getTime())) {
                            timestamp = new Date();
                        }

                        await pool.query(
                            `INSERT INTO gps_tracking (device_id, latitude, longitude, altitude, speed, course, satellites, timestamp) 
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                            [
                                device_id,
                                parseFloat(record.latitude.toFixed(7)),
                                parseFloat(record.longitude.toFixed(7)),
                                record.altitude || 0,
                                record.speed || 0,
                                record.angle || 0,
                                record.satellites || 0,
                                timestamp
                            ]
                        );
                    } catch (insertErr) {
                        console.error(`Error inserting GPS:`, insertErr.message);
                    }
                }

		// Update device last_seen
                await pool.query(
                    'UPDATE devices SET last_seen = NOW() WHERE device_id = $1',
                    [device_id]
                );

                // Send acknowledgement
                const ackResponse = AVLParser.createResponse(records.length);
                socket.write(ackResponse);

                console.log(`📍 [${deviceIMEI}] Stored ${records.length} GPS records`);
            }

        } catch (err) {
            console.error(`Error processing data from ${clientId}:`, err.message);
        }
    });

    socket.on('end', () => {
        console.log(`📴 Connection closed: ${clientId} (IMEI: ${deviceIMEI})`);
    });

    socket.on('error', (err) => {
        console.error(`❌ Socket error for ${clientId}:`, err.message);
    });
});

server.listen(AVL_PORT, AVL_HOST, () => {
    console.log(`🚀 AVL Server listening on ${AVL_HOST}:${AVL_PORT}`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down AVL server...');
    server.close(() => {
        pool.end();
        process.exit(0);
    });
});

module.exports = server;
