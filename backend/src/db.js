const { Pool } = require('pg');

const pool = new Pool({
    user:     process.env.DB_USER     || 'gns_user',
    host:     process.env.DB_HOST     || 'localhost',
    database: process.env.DB_NAME     || 'gns_db',
    password: process.env.DB_PASSWORD || '',
    port:     Number(process.env.DB_PORT) || 5432,
});

module.exports = pool;
