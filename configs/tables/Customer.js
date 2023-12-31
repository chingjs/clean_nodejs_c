const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING, DATE, BOOLEAN } = DataTypes;

class Customer extends Model { }

Customer.init(
  {
    id: {
      type: UUID,
      unique: true,
      defaultValue: UUIDV4,
      allowNull: false,
      primaryKey: true,
      comment: 'Unique identifier for Customer',
    },
    cid: {
      type: STRING,
    },
    phone_number: {
      type: STRING,
    },
    photo_url: {
      type: STRING,
    },
    full_name: {
      type: STRING,
    },
    address: {
      type: STRING,
    },
    email: {
      unique: true,
      type: STRING,
    },
    password: {
      type: STRING,
    },
    gender: {
      type: STRING,
    },
    birthday: {
      type: DATE,
    },
    verified: {
      type: BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    status: {
      type: STRING,
      allowNull: false,
      defaultValue: 'active',
    },
  },
  {
    sequelize, // <- must have sequelize option if using class to declare table
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'customer',
    modelName: 'customer',
  }
);

module.exports = Customer;
