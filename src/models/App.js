const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const App = sequelize.define('dim_aplicacao', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nome: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  descricao: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  url: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  icone: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'web',
  },
  client_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
  },
  client_secret: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  redirect_uris: {
    type: DataTypes.TEXT,
    allowNull: true,
    // store as newline-separated or JSON string
  },
  allowed_origins: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ativo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'dim_aplicacao',
  timestamps: true,
});

module.exports = App;
