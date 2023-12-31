const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING, DATE, DOUBLE, BOOLEAN, INTEGER, ARRAY } = DataTypes;

class Order extends Model { }

Order.init(
  {
    id: {
      type: UUID,
      primaryKey: true,
      unique: true,
      defaultValue: UUIDV4,
      allowNull: false,
      comment: 'Unique identifier for Order',
    },
    oid: {
      type: STRING,
      unique: true,
    },
    pick_up_date: {
      type: DATE,
      allowNull: false,
    },
    files: {
      type: ARRAY(STRING),
    },
    serviceType: {
      type: STRING,
    },
    quantity: {
      type: DOUBLE,
      allowNull: false,
    },
    price: {
      type: DOUBLE,
      allowNull: false,
    },
    extra: {
      type: DOUBLE,
    },
    deposit_time: {
      type: DATE,
      allowNull: true,
    },

    pick_up_time: {
      type: DATE,
      allowNull: true,
    },
    pick_up_driver: {
      type: STRING,
    },
    delivery_driver: {
      type: STRING,
    },
    delivered_time: {
      type: DATE,
      allowNull: true,
    },
    collectedDate: {
      type: DATE,
    },
    payment: {
      type: BOOLEAN,
      defaultValue: false,
    },
    paymenttype: {
      type: STRING,
    },
    paymentId: {
      type: STRING,
    },
    status: {
      type: STRING,
      allowNull: false,
      defaultValue: 'active',
    },
    location: {
      type: STRING,
    },

    lockerId: {
      type: STRING,
    },

    collectLockerId: {
      type: STRING,
    },
    note: {
      type: STRING,
    },
    phone_number: {
      type: STRING,
    },
    cancel: {
      type: BOOLEAN,
      defaultValue: false,
    },
    updatedBy: {
      type: STRING
    },
    // discountTotal: {
    //   type: DOUBLE,
    //   allowNull: false,
    //   defaultValue: 0,
    // }
  },
  {
    sequelize, // <- must have sequelize option if using class to declare table
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'order',
    modelName: 'order',
  }
);

module.exports = Order;
