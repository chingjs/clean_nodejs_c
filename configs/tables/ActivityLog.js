const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { DATE, STRING, INTEGER, DOUBLE } = DataTypes;

class ActivityLog extends Model { }

ActivityLog.init(
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
    type: {
      type: STRING,
    },
  
  },
  {
    sequelize, // <- must have sequelize option if using class to declare table
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'activityLog',
    modelName: 'activityLog',
  }
);

module.exports = ActivityLog;
