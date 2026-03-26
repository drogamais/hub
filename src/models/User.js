const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('dim_users', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  first_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    defaultValue: '',
  },
  last_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    defaultValue: '',
  },
  role: {
    type: DataTypes.ENUM('admin', 'general'),
    allowNull: false,
    defaultValue: 'general',
  },
  setor: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'dim_users',
});


module.exports = User;
