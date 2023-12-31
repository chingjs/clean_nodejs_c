const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING, INTEGER, BOOLEAN, DOUBLE } = DataTypes;

class OrderDetails extends Model { }

OrderDetails.init(
    {
        id: {
            type: UUID,
            unique: true,
            defaultValue: UUIDV4,
            allowNull: false,
            primaryKey: true,
            comment: 'Unique identifier for order detail',
        },
        location: {
            type: STRING,
        },
        orderNo: {
            type: STRING,
        },
        phone_number: {
            type: STRING,
        },
        item: {
            type: STRING,
        },
        qty: {
            type: INTEGER,
        },
        price: {
            type: DOUBLE,
        },
        updatedBy: {
            type: STRING
        },
        cancel: {
            type: BOOLEAN,
            allowNull: false,
            defaultValue: false,
        }

    },
    {
        sequelize, // <- must have sequelize option if using class to declare table
        timestamps: true,
        createdAt: true,
        updatedAt: true,
        tableName: 'order_details',
        modelName: 'order_details',
    }
);

module.exports = OrderDetails;
