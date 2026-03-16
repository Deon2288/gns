const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'gns_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'gns_database',
  password: process.env.DB_PASSWORD || 'gns_password',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = { pool, query: (text, params) => pool.query(text, params) };
