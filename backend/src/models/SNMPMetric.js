const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Device = require('./Device');

const SNMPMetric = sequelize.define('SNMPMetric', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  deviceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'device_id',
    references: { model: Device, key: 'id' },
  },
  oid: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  oidName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'oid_name',
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  valueType: {
    type: DataTypes.STRING(30),
    defaultValue: 'string',
    field: 'value_type',
  },
  polledAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'polled_at',
  },
}, {
  tableName: 'snmp_metrics',
  underscored: true,
  updatedAt: false,
});

Device.hasMany(SNMPMetric, { foreignKey: 'device_id', as: 'metrics' });
SNMPMetric.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

module.exports = SNMPMetric;
