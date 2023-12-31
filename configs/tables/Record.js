const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING, DATE, DOUBLE, BOOLEAN, INTEGER } = DataTypes;

class Record extends Model { }

Record.init(
  {
    id: {
      type: UUID,
      primaryKey: true,
      unique: true,
      defaultValue: UUIDV4,
      allowNull: false,
      comment: 'Unique identifier for Record',
    },
    tid: {
      type: STRING,
      unique: true,
    },
    status: {
      type: STRING,
      allowNull: false
    },
    orderId: {
      type: STRING
    },
    operatorId: {
      type: STRING,
      allowNull: false
    },
    location: {
      type: STRING,
    },

    lockerId: {
      type: STRING,
    },
    completed: {
      type: BOOLEAN,
      defaultValue: false
    },
  },
  {
    sequelize, // <- must have sequelize option if using class to declare table
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'record',
    modelName: 'record',
  }
);

module.exports = Record;
