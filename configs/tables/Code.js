const { Model, STRING, BOOLEAN, INTEGER, DOUBLE, DATE } = require('sequelize');
const sequelize = require('../sequelize');

class Code extends Model {}
Code.init(
  {
    id: {
      type: INTEGER,
      autoIncrement: true,
      primaryKey: true,
      unique: true
    },
    code: {
        type: STRING,
        allowNull: false,
    },
    start_date: {
        type: DATE,
    },
    end_date: {
        type: DATE,
    },
    amount: {
        type: DOUBLE,
    },
    type: {
        type: STRING,
    },
    redeem_per_user: {
        type: INTEGER,
    },
    redeem_per_day: {
        type: INTEGER,
    },
    redeem_per_month: {
        type: INTEGER,
    },
    locationUse: {
        type: BOOLEAN,
    },
    location: {
        type: STRING,
    },
    serviceUse: {
        type: BOOLEAN,
    },
  },
  {
    sequelize, 
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'code',
    modelName: 'code',
  }
);

module.exports = Code;
