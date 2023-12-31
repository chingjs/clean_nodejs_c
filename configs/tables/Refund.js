const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING, DATE, DOUBLE, BOOLEAN, INTEGER } = DataTypes;

class Refund extends Model { }

Refund.init(
  {
    id: {
      type: UUID,
      primaryKey: true,
      unique: true,
      defaultValue: UUIDV4,
      allowNull: false,
      comment: 'Unique identifier for Record',
    },
    refundAmount: {
      type: STRING
    },
  },
  {
    sequelize, // <- must have sequelize option if using class to declare table
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'refund',
    modelName: 'refund',
  }
);

module.exports = Refund;
