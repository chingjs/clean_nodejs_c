const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { DATE, STRING, INTEGER, DOUBLE } = DataTypes;

class MDR extends Model { }

MDR.init(
  {
    id: {
      type: INTEGER,
      autoIncrement: true,
      primaryKey: true,
      unique: true
    },
    name: {
      type: STRING,
    },
    rate: {
      type: STRING,
    },
    min: {
      type: STRING,
    },
    fixed: {
      type: STRING
    },
    note: {
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
    tableName: 'mdr',
    modelName: 'mdr',
  }
);

module.exports = MDR;
