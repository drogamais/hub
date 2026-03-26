const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuthorizationCode = sequelize.define('authorization_codes', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  code: {
    type: DataTypes.STRING(256),
    allowNull: false,
    unique: true,
  },
  id_usuario: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  id_aplicacao: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  redirect_uri: {
    type: DataTypes.STRING(1024),
    allowNull: true,
  },
  used: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'authorization_codes',
  timestamps: true,
});

module.exports = AuthorizationCode;
