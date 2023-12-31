const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { DATE, STRING, INTEGER } = DataTypes;

class Reschedule extends Model { }

Reschedule.init(
  {
    id: {
      type: INTEGER,
      autoIncrement: true,
      primaryKey: true,
      unique: true
    },
    olddate: {
      type: DATE,
    },
    newdate: {
      type: DATE,
    },
    reason: {
      type: STRING
    },
    
  },
  {
    sequelize, // <- must have sequelize option if using class to declare table
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'reschedule',
    modelName: 'reschedule',
  }
);

module.exports = Reschedule;
