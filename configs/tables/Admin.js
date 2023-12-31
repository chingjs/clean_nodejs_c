const { Model, DataTypes, STRING, BOOLEAN, INTEGER } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4 } = DataTypes;

class Admin extends Model { }

Admin.init(
    {
        id: {
            type: UUID,
            unique: true,
            defaultValue: UUIDV4,
            allowNull: false,
            primaryKey: true,
            comment: 'Unique identifier for Admin',
        },
        username: {
            type: STRING,
            allowNull: false,
            unique: true,
        },
        password: {
            type: STRING,
            required: true
        },
        operatorId: {
            type: STRING,
        },
        email: {
            type: STRING,
        },
        status: {
            type: BOOLEAN,
        },
        type: {
            type: STRING,
        },
        createdBy: {
            type: STRING,
        },
        updatedBy: {
            type: STRING,
        },

        smsCredit: {
            type: INTEGER,
            default: 1000,
        }
    },
    {
        sequelize,
        timestamps: true,
        createdAt: true,
        updatedAt: true,
        tableName: 'admin',
        modelName: 'admin',
    }
);

module.exports = Admin;
