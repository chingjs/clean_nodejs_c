const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING } = DataTypes;

class Operator extends Model {}

Operator.init(
  {
    id: {
      type: UUID,
      unique: true,
      defaultValue: UUIDV4,
      allowNull: false,
      primaryKey: true,
      comment: 'Unique identifier for Operator',
    },
    oid: {
      type: STRING,
      unique: true,
    },
    phone_number: {
      unique: true,
      type: STRING,
    },
    password: {
      type: STRING,
    },
    photo_url: {
      type: STRING,
    },
    full_name: {
      type: STRING,
    },
    email: {
      type: STRING,
    },
    status: {
      type: STRING,
      allowNull: false,
      defaultValue: 'Active',
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
    tableName: 'operator',
    modelName: 'Operator',
  }
);

module.exports = Operator;
