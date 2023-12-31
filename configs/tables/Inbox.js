const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING,DATE,BOOLEAN } = DataTypes;

class Inbox extends Model { }

Inbox.init(
  {
    id: {
      type: UUID,
      unique: true,
      defaultValue: UUIDV4,
      allowNull: false,
      primaryKey: true,
      comment: 'Unique identifier for Customer',
    },
    phone_number: {
      type: STRING,
    },
    title: {
      type: STRING,
    },
    message: {
      type: STRING,
    },
    read: {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize, // <- must have sequelize option if using class to declare table
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'inbox',
    modelName: 'inbox',
  }
);

module.exports = Inbox;
