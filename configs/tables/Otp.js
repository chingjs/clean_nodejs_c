const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { INTEGER, UUIDV4, STRING } = DataTypes;

class OTP extends Model {}

OTP.init(
  {
    id: {
      type: INTEGER,
      autoIncrement: true,
      primaryKey: true,
      unique: true
    },
    phone_number: {
      type: STRING,
      allowNull: false,
    },
    otp: {
      type: STRING,
      allowNull: false,
    },
  },
  {
    sequelize, // <- must have sequelize option if using class to declare table
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'otp',
    modelName: 'otp',
  }
);

module.exports = OTP;
