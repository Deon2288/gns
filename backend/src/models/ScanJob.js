const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScanJob = sequelize.define('ScanJob', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  ipRange: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'ip_range',
  },
  status: {
    type: DataTypes.ENUM('pending', 'running', 'completed', 'failed'),
    defaultValue: 'pending',
  },
  devicesFound: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'devices_found',
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'started_at',
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'completed_at',
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message',
  },
  results: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
}, {
  tableName: 'scan_jobs',
  underscored: true,
});

module.exports = ScanJob;
