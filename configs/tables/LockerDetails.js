const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING, INTEGER, BOOLEAN } = DataTypes;

class LockerDetails extends Model { }

LockerDetails.init(
    {
        id: {
            type: UUID,
            unique: true,
            defaultValue: UUIDV4,
            allowNull: false,
            primaryKey: true,
            comment: 'Unique identifier for locker slot',
        },
        location: {
            type: STRING,
        },
        type: {
            type: STRING,
        },
        name: {
            type: STRING,
        },
        booking: {
            type: BOOLEAN,
            defaultValue: false
        },
        reserved: {
            type: BOOLEAN,
            defaultValue: false
        },
        lock: {
            type: BOOLEAN,
            defaultValue: true
        },
        empty: {
            type: BOOLEAN,
            defaultValue: true
        },
        status: {
            type: STRING,
            allowNull: false,
            defaultValue: 'Online',
        },
        address: {
            type: INTEGER,
        },
    },
    {
        sequelize, // <- must have sequelize option if using class to declare table
        timestamps: true,
        createdAt: true,
        updatedAt: true,
        tableName: 'locker_details',
        modelName: 'locker_details',
    }
);

module.exports = LockerDetails;
