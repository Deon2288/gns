const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: false,
    unique: true,
    field: 'ip_address',
  },
  hostname: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  deviceType: {
    type: DataTypes.STRING(50),
    defaultValue: 'unknown',
    field: 'device_type',
  },
  model: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  vendor: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'unknown'),
    defaultValue: 'unknown',
  },
  snmpEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'snmp_enabled',
  },
  snmpCommunity: {
    type: DataTypes.STRING(100),
    defaultValue: 'public',
    field: 'snmp_community',
  },
  snmpVersion: {
    type: DataTypes.STRING(5),
    defaultValue: '2c',
    field: 'snmp_version',
  },
  snmpPort: {
    type: DataTypes.INTEGER,
    defaultValue: 161,
    field: 'snmp_port',
  },
  lastSeen: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_seen',
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
}, {
  tableName: 'devices',
  underscored: true,
});

module.exports = Device;
