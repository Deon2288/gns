const net = require('net');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'gns_user',
    password: process.env.DB_PASSWORD || 'gns_password',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'gns_database',
});

const AVL_PORT = parseInt(process.env.AVL_PORT) || 5027;
const AVL_HOST = '0.0.0.0';

// Parse Teltonika Codec 8 / Codec 8 Extended AVL data
function parseAVLData(buffer) {
    if (buffer.length < 10) return null;

    let offset = 0;

    // Preamble: 4 bytes (0x00000000)
    offset += 4;

    // Data field length: 4 bytes
    if (offset + 4 > buffer.length) return null;
    const dataLength = buffer.readUInt32BE(offset);
    offset += 4;

    if (buffer.length < offset + dataLength + 4) return null;

    const data = buffer.slice(offset, offset + dataLength);
    offset += dataLength;

    // CRC-16: 4 bytes
    // (skipping CRC validation for simplicity)

    let pos = 0;
    if (data.length < 2) return null;

    const codecId = data[pos];
    pos += 1;

    const recordCount = data[pos];
    pos += 1;

    const records = [];

    for (let i = 0; i < recordCount && pos < data.length; i++) {
        const record = {};

        // Timestamp (8 bytes, ms since epoch)
        if (pos + 8 > data.length) break;
        const tsHigh = data.readUInt32BE(pos);
        const tsLow = data.readUInt32BE(pos + 4);
        record.timestamp = new Date(tsHigh * 0x100000000 + tsLow);
        pos += 8;

        // Priority (1 byte)
        if (pos + 1 > data.length) break;
        record.priority = data[pos];
        pos += 1;

        // GPS element
        // Longitude (4 bytes, signed, / 10000000)
        if (pos + 4 > data.length) break;
        record.longitude = data.readInt32BE(pos) / 10000000;
        pos += 4;

        // Latitude (4 bytes, signed, / 10000000)
        if (pos + 4 > data.length) break;
        record.latitude = data.readInt32BE(pos) / 10000000;
        pos += 4;

        // Altitude (2 bytes, signed)
        if (pos + 2 > data.length) break;
        record.altitude = data.readInt16BE(pos);
        pos += 2;

        // Angle/course (2 bytes)
        if (pos + 2 > data.length) break;
        record.course = data.readUInt16BE(pos);
        pos += 2;

        // Satellites (1 byte)
        if (pos + 1 > data.length) break;
        record.satellites = data[pos];
        pos += 1;

        // Speed (2 bytes, km/h)
        if (pos + 2 > data.length) break;
        record.speed = data.readUInt16BE(pos);
        pos += 2;

        // IO element
        if (codecId === 0x08) {
            // Codec 8
            if (pos + 1 > data.length) break;
            pos += 1; // Event IO ID

            if (pos + 1 > data.length) break;
            pos += 1; // Total IO count (not needed for parsing)

            // 1-byte IO elements
            if (pos + 1 > data.length) break;
            const count1 = data[pos];
            pos += 1;
            pos += count1 * 2;

            // 2-byte IO elements
            if (pos + 1 > data.length) break;
            const count2 = data[pos];
            pos += 1;
            pos += count2 * 3;

            // 4-byte IO elements
            if (pos + 1 > data.length) break;
            const count4 = data[pos];
            pos += 1;
            pos += count4 * 5;

            // 8-byte IO elements
            if (pos + 1 > data.length) break;
            const count8 = data[pos];
            pos += 1;
            pos += count8 * 9;
        } else if (codecId === 0x8E) {
            // Codec 8 Extended
            if (pos + 2 > data.length) break;
            pos += 2; // Event IO ID (2 bytes)

            if (pos + 2 > data.length) break;
            pos += 2; // Total IO count (not needed for parsing)

            for (const size of [1, 2, 4, 8]) {
                if (pos + 2 > data.length) break;
                const count = data.readUInt16BE(pos);
                pos += 2;
                pos += count * (2 + size);
            }

            // Variable length IO
            if (pos + 2 > data.length) break;
            const countX = data.readUInt16BE(pos);
            pos += 2;
            for (let j = 0; j < countX; j++) {
                if (pos + 4 > data.length) break;
                pos += 2; // IO ID
                const len = data.readUInt16BE(pos);
                pos += 2;
                pos += len;
            }
        }

        records.push(record);
    }

    return { codecId, records };
}

const server = net.createServer((socket) => {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    let deviceIMEI = null;
    let imeiReceived = false;
    let dataBuffer = Buffer.alloc(0);

    console.log(`New AVL connection from ${clientId}`);

    socket.on('data', async (chunk) => {
        try {
            dataBuffer = Buffer.concat([dataBuffer, chunk]);

            if (!imeiReceived) {
                // First message: IMEI length (2 bytes) + IMEI string
                if (dataBuffer.length < 2) return;
                const imeiLen = dataBuffer.readUInt16BE(0);
                if (dataBuffer.length < 2 + imeiLen) return;

                deviceIMEI = dataBuffer.slice(2, 2 + imeiLen).toString('ascii');
                dataBuffer = dataBuffer.slice(2 + imeiLen);
                imeiReceived = true;

                console.log(`AVL device IMEI: ${deviceIMEI} from ${clientId}`);

                const result = await pool.query(
                    'SELECT device_id FROM devices WHERE imei = $1',
                    [deviceIMEI]
                );

                if (result.rows.length > 0) {
                    socket.write(Buffer.from([0x01]));
                    console.log(`IMEI ${deviceIMEI} accepted`);
                } else {
                    socket.write(Buffer.from([0x00]));
                    console.log(`IMEI ${deviceIMEI} not found in database`);
                    socket.end();
                }
                return;
            }

            // Parse AVL data packet
            if (dataBuffer.length < 8) return;

            const avlData = parseAVLData(dataBuffer);
            if (!avlData) {
                console.log(`Incomplete AVL packet from ${clientId}, waiting for more data`);
                return;
            }

            // Clear buffer after successful parse
            dataBuffer = Buffer.alloc(0);

            const { records } = avlData;
            console.log(`Received ${records.length} AVL records from ${deviceIMEI}`);

            const deviceResult = await pool.query(
                'SELECT device_id FROM devices WHERE imei = $1',
                [deviceIMEI]
            );

            if (deviceResult.rows.length === 0) {
                console.log(`Device ${deviceIMEI} not found`);
                return;
            }

            const device_id = deviceResult.rows[0].device_id;

            for (const record of records) {
                if (record.latitude === 0 && record.longitude === 0) continue;
                try {
                    await pool.query(
                        `INSERT INTO gps_data (device_id, latitude, longitude, altitude, speed, course, satellites, timestamp)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            device_id,
                            record.latitude,
                            record.longitude,
                            record.altitude || 0,
                            record.speed || 0,
                            record.course || 0,
                            record.satellites || 0,
                            record.timestamp,
                        ]
                    );
                } catch (insertErr) {
                    console.error('Error inserting AVL GPS record:', insertErr.message);
                }
            }

            if (records.length > 0) {
                await pool.query(
                    'UPDATE devices SET last_seen = NOW() WHERE device_id = $1',
                    [device_id]
                );
            }

            // Acknowledge number of records received
            const ack = Buffer.alloc(4);
            ack.writeUInt32BE(records.length, 0);
            socket.write(ack);
            console.log(`Acknowledged ${records.length} records from ${deviceIMEI}`);
        } catch (err) {
            console.error(`Error processing AVL data from ${clientId}:`, err.message);
        }
    });

    socket.on('end', () => {
        console.log(`AVL connection closed: ${clientId} (IMEI: ${deviceIMEI})`);
    });

    socket.on('error', (err) => {
        console.error(`AVL socket error for ${clientId}:`, err.message);
    });
});

server.listen(AVL_PORT, AVL_HOST, () => {
    console.log(`AVL TCP server listening on ${AVL_HOST}:${AVL_PORT}`);
});

server.on('error', (err) => {
    console.error('AVL server error:', err.message);
});

process.on('SIGINT', () => {
    server.close(() => {
        pool.end();
        process.exit(0);
    });
});

module.exports = server;
