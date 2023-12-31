const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING, BOOLEAN, INTEGER } = DataTypes;

class Locker extends Model { }

Locker.init(
    {
        id: {
            type: UUID,
            unique: true,
            defaultValue: UUIDV4,
            allowNull: false,
            primaryKey: true,
            comment: 'Unique identifier for Admin',
        },
        url: {
            type: STRING,
        },
        name: {
            type: STRING,
        },
        total: {
            type: INTEGER,
        },
        used: {
            type: INTEGER,
        },
        empty: {
            type: INTEGER
        },
        location: {
            type: STRING,
        },
        state: {
            type: STRING,
        },
        city: {
            type: STRING,
        },
        postcode: {
            type: STRING,
        },
        address: {
            type: STRING,
        },
        strategy: {
            type: STRING,
        },
        status: {
            type: BOOLEAN,
        },
        deviceId: {
            type: STRING,
        },
    },
    {
        sequelize,
        timestamps: true,
        createdAt: true,
        updatedAt: true,
        tableName: 'locker',
        modelName: 'locker',
    }
);

module.exports = Locker;
