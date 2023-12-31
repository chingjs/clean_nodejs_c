const { Model, STRING, FLOAT } = require("sequelize");
const sequelize = require("../sequelize");

class Discount extends Model { }

Discount.init(
    {
        discountCode: {
            type: STRING,
            allowNull: false,
            comment: "The code used in payment page for discount"
        },
        discountAmount: {
            type: FLOAT,
            allowNull: false,
            comment: "Code discount amount"
        },
        totalDeductAmount: {
            type: FLOAT,
            defaultValue: 0,
        },
        discountType: {
            type: STRING,
            defaultValue: "Flat",
            allowNull: false,
            comment: "Flat (RM) / Rate (%)"
        }
    },
    {
        sequelize,
        timestamps: true,
        createdAt: true,
        updatedAt: true,
        tableName: "discount",
        modelName: "discount",
    }
);

module.exports = Discount;
