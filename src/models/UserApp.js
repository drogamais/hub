const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserApp = sequelize.define('rel_usuario_aplicacao', {
  id_usuario: {
    type: DataTypes.INTEGER,
    references: {
      model: 'sid_users',
      key: 'id'
    },
    primaryKey: true
  },
  id_aplicacao: {
    type: DataTypes.INTEGER,
    references: {
      model: 'dim_aplicacao',
      key: 'id'
    },
    primaryKey: true
  }
}, {
  tableName: 'rel_usuario_aplicacao',
  timestamps: false,
});

module.exports = UserApp;
