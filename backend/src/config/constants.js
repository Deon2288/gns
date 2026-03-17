module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'gns-secret-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  BCRYPT_ROUNDS: 10,
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: parseInt(process.env.DB_PORT) || 5432,
    NAME: process.env.DB_NAME || 'gns_db',
    USER: process.env.DB_USER || 'postgres',
    PASSWORD: process.env.DB_PASSWORD || 'password',
    DIALECT: process.env.DB_DIALECT || 'sqlite',
    STORAGE: process.env.DB_STORAGE || ':memory:',
  },
};
