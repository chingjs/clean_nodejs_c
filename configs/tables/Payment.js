const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, DOUBLE, BOOLEAN, STRING } = DataTypes;

class Payment extends Model { }

Payment.init(
  {
    id: {
      type: UUID,
      primaryKey: true,
      unique: true,
      defaultValue: UUIDV4,
      allowNull: false,
      comment: 'Unique identifier for Payment',
    },
    transactionId: {
      type: STRING,
    },
    method: {
      type: STRING,
    },
    oid: {
      type: STRING,
    },

    amount: {
      type: DOUBLE,
    },
  },
  {
    sequelize, // <- must have sequelize option if using class to declare table
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'payment',
    modelName: 'payment',
  }
);

module.exports = Payment;
