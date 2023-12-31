const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { STRING, BOOLEAN, INTEGER } = DataTypes;

class Roles extends Model { }

Roles.init(
  {
    id: {
      type: INTEGER,
      autoIncrement: true,
      primaryKey: true,
      unique: true
    },
    name: {
      type: STRING,
    },
    type: {
      type: STRING,
    },
    location: {
      type: STRING,
    },
    category: {
      type: STRING,
    },
    status: {
      type: BOOLEAN,
    }
  },
  {
    sequelize,
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'roles',
    modelName: 'roles',
  }
);

module.exports = Roles;
