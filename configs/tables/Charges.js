const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING, DATE, DOUBLE, BOOLEAN, INTEGER } = DataTypes;

class Charges extends Model { }

Charges.init(
  {
    id: {
      type: UUID,
      primaryKey: true,
      unique: true,
      defaultValue: UUIDV4,
      allowNull: false,
      comment: 'Unique identifier for Record',
    },
    action: {
      type: STRING,
    },
    reason: {
      type: STRING,
      allowNull: false
    },
    oid: {
      type: STRING,
      allowNull: false
    },
    amount: {
      type: STRING
    },
    olditem: {
      type: STRING
    },
    oldprice: {
      type: STRING
    },
    item: {
      type: STRING
    },
    qty: {
      type: STRING
    },
    updatedBy: {
      type: STRING
    }
  },
  {
    sequelize, // <- must have sequelize option if using class to declare table
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'charges',
    modelName: 'charges',
  }
);

module.exports = Charges;
