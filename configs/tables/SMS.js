const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { STRING } = DataTypes;

class SMS extends Model { }

SMS.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      unique: true
    },
    phone_number: {
      type: STRING,
      allowNull: false,
    },
    type: {
      type: STRING,
      allowNull: false,
    },
    message: {
      type: STRING,
      allowNull: false,
    },
  },
  {
    sequelize, // <- must have sequelize option if using class to declare table
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'sms',
    modelName: 'sms',
  }
);

module.exports = SMS;
