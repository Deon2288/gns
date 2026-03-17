const winston = require('winston');
const { NODE_ENV } = require('../config/constants');

const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'warn' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, stack }) => {
            return stack
              ? `${timestamp} [${level}]: ${message}\n${stack}`
              : `${timestamp} [${level}]: ${message}`;
          })
        )
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

module.exports = logger;
