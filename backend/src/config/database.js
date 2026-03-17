const { Sequelize } = require('sequelize');
const { DB, NODE_ENV } = require('./constants');
const logger = require('../utils/logger');

let sequelize;

if (NODE_ENV === 'test' || DB.DIALECT === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: DB.STORAGE,
    logging: false,
  });
} else {
  sequelize = new Sequelize(DB.NAME, DB.USER, DB.PASSWORD, {
    host: DB.HOST,
    port: DB.PORT,
    dialect: 'postgres',
    logging: NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
}

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established.');
    if (NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized.');
    }
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

module.exports = { sequelize, connectDB };
