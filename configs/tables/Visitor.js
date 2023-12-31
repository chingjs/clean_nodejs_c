const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING } = DataTypes;

class Visitor extends Model {}

Visitor.init(
  {
    id: {
      type: UUID,
      primaryKey: true,
      unique: true,
      defaultValue: UUIDV4,
      allowNull: false,
      comment: 'Unique identifier for OTP',
    },
    visitorId: {
      type: STRING,
      allowNull: false,
    },
    browser: {
      type: STRING,
    },
  },
  {
    sequelize, // <- must have sequelize option if using class to declare table
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'visitor',
    modelName: 'visitor',
  }
);

module.exports = Visitor;
