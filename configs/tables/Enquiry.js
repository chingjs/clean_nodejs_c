const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING, BOOLEAN } = DataTypes;

class Enquiry extends Model {}

Enquiry.init(
  {
    id: {
      type: UUID,
      primaryKey: true,
      unique: true,
      defaultValue: UUIDV4,
      allowNull: false,
      //   comment: 'Unique identifier for OTP',
    },
    full_name: {
      type: STRING,
    },
    email: {
      type: STRING,
      allowNull: false,
    },
    phone_number: {
      type: STRING,
    },
    orderId: {
      type: STRING,
      allowNull: true,
    },
    subject: {
      type: STRING,
    },
    message: {
      type: STRING,
    },
    status: {
      type: BOOLEAN,
      defaultValue: 'false',
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
    tableName: 'enquiry',
    modelName: 'enquiry',
  }
);

module.exports = Enquiry;
